# Developer Guide: Hexagonal Architecture

This plugin uses a hexagonal (ports-and-adapters) architecture to decouple external data formats from internal plugin logic.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SOURCES                              │
│  .tra files       │  API response    │  Other Sources            │
│  (user upload)    │  (future)        │  (extensible)             │
└────────┬──────────┴───────┬──────────┴───────────┬──────────────┘
         │                  │                      │
         ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ADAPTERS LAYER                              │
│  src/adapters/implementations/                                   │
│  - traFileAdapter.ts       (async, parses .tra CSV format)       │
│  - currentApiAdapter.ts    (transforms JSON API format)          │
│  - searchApiAdapter.ts     (transforms search API format)        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PORT (contract)                               │
│  src/ports/translationPort.ts                                    │
│  - getTranslationMap(): TranslationMap                           │
│  - getMetadataMap(): MetadataMap                                 │
│  - getTranslationCount(): number                                 │
│  - getSourceIdentifier(): string                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                PLUGIN CORE (unchanged)                           │
│  Uses TranslationMap & MetadataMap — doesn't care about source  │
└─────────────────────────────────────────────────────────────────┘
```

## Current Data Source: .tra Files

Users upload `.tra` files at runtime via the plugin UI. The `TraFileAdapter` parses them asynchronously.

### .tra File Format

```
multilanId,"translation text","ignored"
10001,"Submit","All"
10002,"Cancel","All"
10003,"Say ""Hello""","All"
```

- **Column 1**: Numeric multilanId
- **Column 2**: Quoted translation text (supports `""` for escaped quotes)
- **Column 3**: Ignored metadata (typically "All")

### How .tra Files Are Loaded

1. User clicks a folder button (EB/EBB/PCB) or drags files onto the upload modal
2. UI reads files via `FileReader` with encoding detection (UTF-8, falls back to Windows-1252)
3. Raw text content sent to plugin via `postMessage`
4. Plugin merges with existing data (incremental uploads supported)
5. `TraFileAdapter.createAsync()` parses files asynchronously in chunks
6. Data cached in `figma.clientStorage` (per-user, persists across sessions)

### TraFileAdapter

```typescript
// Async factory — parses in chunks to avoid blocking
const adapter = await TraFileAdapter.createAsync(traFileData);
const translationMap = adapter.getTranslationMap();
const metadataMap = adapter.getMetadataMap();  // Empty for .tra files
```

The adapter:
- Parses 4 language files in parallel via `Promise.all()`
- Yields to the event loop every 2000 lines (non-blocking)
- Handles partial uploads (1-4 languages)

## Internal Formats (What Adapters Must Produce)

### TranslationMap

```typescript
{
  "10001": {
    "en": "Submit",
    "fr": "Soumettre",
    "nl": "Indienen",
    "de": "Einreichen"
  }
}
```

### MetadataMap

```typescript
{
  "10001": {
    "status": "FINAL",
    "createdAt": "2024-06-15T10:30:00Z",
    "modifiedAt": "2025-01-10T14:22:00Z",
    "modifiedBy": "john.smith@company.com",
    "sourceLanguageId": "en"
  }
}
```

Note: .tra files don't contain metadata, so `MetadataMap` is empty for that adapter.

## Adding a New Adapter

### Step 1: Define External Types

Create `src/adapters/types/newApi.types.ts`:

```typescript
export interface NewApiResponse {
  translations: Array<{
    key: string;
    texts: { [lang: string]: string };
    meta?: { status?: string; updatedAt?: string };
  }>;
}

export function isNewApiFormat(data: unknown): data is NewApiResponse {
  if (typeof data !== "object" || data === null) return false;
  return "translations" in (data as Record<string, unknown>);
}
```

### Step 2: Create the Adapter

Create `src/adapters/implementations/newApiAdapter.ts` implementing `TranslationDataPort`.

### Step 3: Register in `src/adapters/index.ts`

Add to `AdapterType`, `adapterRegistry`, and `detectAdapterType()`.

## File Structure

```
src/
├── ports/
│   └── translationPort.ts          # Port interface (contract)
├── adapters/
│   ├── index.ts                    # Registry & async factory
│   ├── types/
│   │   ├── traFile.types.ts        # .tra file types & parser
│   │   ├── currentApi.types.ts     # JSON API types
│   │   └── searchApi.types.ts      # Search API types
│   └── implementations/
│       ├── traFileAdapter.ts       # .tra file adapter (async)
│       ├── currentApiAdapter.ts    # JSON API adapter
│       └── searchApiAdapter.ts     # Search API adapter
└── shared/
    └── types.ts                    # Internal types (TranslationMap, etc.)
```

## Key Design Principles

1. **Adapters transform external -> internal format** only
2. **The internal format is the contract** — plugin core only uses `TranslationMap` and `MetadataMap`
3. **Adapters handle validation** via type guards
4. **Plugin core stays unchanged** when adding new data sources
5. **Adapter factory is async** — `createAdapter()` returns `Promise<TranslationDataPort>`
