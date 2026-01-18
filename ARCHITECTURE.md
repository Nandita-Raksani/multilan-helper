# Developer Guide: API Adapter Layer

This plugin uses a hexagonal (ports-and-adapters) architecture to decouple external API formats from the internal plugin logic. This allows supporting different API formats without changing the core plugin code.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SOURCES                             │
│  api-data.json    │  Real-time API  │  Other Sources           │
│  (static file)    │  (future)       │  (extensible)            │
└────────┬──────────┴───────┬─────────┴───────────┬───────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ADAPTERS LAYER                             │
│  src/adapters/implementations/                                  │
│  - currentApiAdapter.ts  (transforms current JSON format)       │
│  - yourNewAdapter.ts     (transforms your API response)         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PORT (contract)                              │
│  src/ports/translationPort.ts                                   │
│  - getTranslationMap(): TranslationMap                          │
│  - getMetadataMap(): MetadataMap                                │
│  - getTranslationCount(): number                                │
│  - getSourceIdentifier(): string                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                PLUGIN CORE (unchanged)                          │
│  Uses TranslationMap & MetadataMap - doesn't care about source  │
└─────────────────────────────────────────────────────────────────┘
```

## Current JSON Structure (api-data.json)

The current static JSON file has this structure:

```json
[
  {
    "id": 10001,
    "status": "FINAL",
    "createdAt": "2024-06-15T10:30:00Z",
    "modifiedAt": "2025-01-10T14:22:00Z",
    "modifiedBy": "john.smith@company.com",
    "multilanTextList": [
      { "languageId": "en", "wording": "Submit", "id": 1, "sourceLanguageId": "en" },
      { "languageId": "fr", "wording": "Soumettre", "id": 2, "sourceLanguageId": "en" },
      { "languageId": "nl", "wording": "Indienen", "id": 3, "sourceLanguageId": "en" },
      { "languageId": "de", "wording": "Einreichen", "id": 4, "sourceLanguageId": "en" }
    ]
  }
]
```

### Field descriptions:

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique multilanId for the translation entry |
| `status` | string | Translation status: `FINAL`, `DRAFT`, `IN_TRANSLATION`, `TO_TRANSLATE_INTERNALLY`, `TO_TRANSLATE_EXTERNALLY`, `FOUR_EYES_CHECK` |
| `createdAt` | string | ISO timestamp of creation |
| `modifiedAt` | string | ISO timestamp of last modification |
| `modifiedBy` | string | Email/name of last modifier |
| `multilanTextList` | array | Array of translations per language |
| `multilanTextList[].languageId` | string | Language code (e.g., `en`, `fr`, `nl`, `de`) |
| `multilanTextList[].wording` | string | The translated text |
| `multilanTextList[].id` | number | Unique ID for this specific translation |
| `multilanTextList[].sourceLanguageId` | string | Source language the translation was made from |

## Internal Format (What Adapters Must Produce)

Adapters transform external data into these internal formats:

### TranslationMap

```typescript
{
  "10001": {
    "en": "Submit",
    "fr": "Soumettre",
    "nl": "Indienen",
    "de": "Einreichen"
  },
  "10002": {
    "en": "Cancel",
    "fr": "Annuler",
    // ...
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

## How to Add a New API Adapter

### Step 1: Define External Types

Create `src/adapters/types/newApi.types.ts`:

```typescript
// Define the structure of your API response
export interface NewApiTranslation {
  key: string;           // Your API's translation identifier
  texts: {
    [lang: string]: string;
  };
  meta?: {
    status?: string;
    updatedAt?: string;
  };
}

export interface NewApiResponse {
  translations: NewApiTranslation[];
}

// Type guard for validation
export function isNewApiFormat(data: unknown): data is NewApiResponse {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    "translations" in obj &&
    Array.isArray(obj.translations)
  );
}
```

### Step 2: Create the Adapter

Create `src/adapters/implementations/newApiAdapter.ts`:

```typescript
import { TranslationDataPort } from "../../ports/translationPort";
import { TranslationMap, MetadataMap } from "../../shared/types";
import { NewApiResponse, isNewApiFormat } from "../types/newApi.types";

export class NewApiAdapter implements TranslationDataPort {
  private translationMap: TranslationMap;
  private metadataMap: MetadataMap;

  constructor(data: unknown) {
    if (!isNewApiFormat(data)) {
      throw new Error("Invalid data format: expected NewApiResponse");
    }
    this.translationMap = this.buildTranslationMap(data);
    this.metadataMap = this.buildMetadataMap(data);
  }

  private buildTranslationMap(data: NewApiResponse): TranslationMap {
    const map: TranslationMap = {};

    for (const item of data.translations) {
      // Map your API's key to multilanId
      map[item.key] = { ...item.texts };
    }

    return map;
  }

  private buildMetadataMap(data: NewApiResponse): MetadataMap {
    const map: MetadataMap = {};

    for (const item of data.translations) {
      map[item.key] = {
        status: item.meta?.status as any,
        modifiedAt: item.meta?.updatedAt,
      };
    }

    return map;
  }

  getTranslationMap(): TranslationMap {
    return this.translationMap;
  }

  getMetadataMap(): MetadataMap {
    return this.metadataMap;
  }

  getTranslationCount(): number {
    return Object.keys(this.translationMap).length;
  }

  getSourceIdentifier(): string {
    return "new-api";
  }
}
```

### Step 3: Register the Adapter

Update `src/adapters/index.ts`:

```typescript
import { NewApiAdapter } from "./implementations/newApiAdapter";
import { isNewApiFormat } from "./types/newApi.types";

// Add to AdapterType
export type AdapterType = "current-api" | "new-api";

// Add to registry
const adapterRegistry: Map<AdapterType, AdapterFactory> = new Map([
  ["current-api", (data) => new CurrentApiAdapter(data)],
  ["new-api", (data) => new NewApiAdapter(data)],  // Add this
]);

// Update detectAdapterType
export function detectAdapterType(data: unknown): AdapterType | null {
  if (isNewApiFormat(data)) {
    return "new-api";  // Check new format first if needed
  }
  if (isCurrentApiFormat(data)) {
    return "current-api";
  }
  return null;
}
```

### Step 4: Use the Adapter

In `src/plugin/index.ts` (for real-time API):

```typescript
// Option A: Auto-detect format
const response = await fetch("https://api.example.com/translations");
const data = await response.json();
const adapter = createAdapter(data);  // Auto-detects format

// Option B: Explicit format
const adapter = createAdapter(data, "new-api");

// Use as before
const translationData = adapter.getTranslationMap();
const metadataData = adapter.getMetadataMap();
```

### Step 5: Add Tests

Create `tests/adapters/newApiAdapter.test.ts` to test your adapter.

## Key Points

1. **Adapters transform external → internal format** (not external → other external)
2. **The internal format is the contract** - plugin code only uses `TranslationMap` and `MetadataMap`
3. **Adapters handle validation** - use type guards to validate input data
4. **Plugin core stays unchanged** - only the adapter layer knows about external formats

## File Structure

```
src/
├── ports/
│   └── translationPort.ts       # Port interface (contract)
├── adapters/
│   ├── index.ts                 # Registry & factory
│   ├── types/
│   │   ├── currentApi.types.ts  # Current JSON types
│   │   └── newApi.types.ts      # Your new API types
│   └── implementations/
│       ├── currentApiAdapter.ts # Current adapter
│       └── newApiAdapter.ts     # Your new adapter
└── shared/
    └── types.ts                 # Internal types (TranslationMap, etc.)
```
