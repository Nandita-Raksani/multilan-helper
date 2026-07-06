# Architecture: The Translation Data Layer (Ports & Adapters)

This document explains **how translation data enters the plugin**. For the overall
UI ↔ plugin message flow and the project layout, see [README.md](./README.md).

## Why a hexagonal architecture?

The plugin core — search, matching, linking, language switching — only ever needs
translation data in **one internal shape**. It should not know or care whether that
data came from an uploaded `.tra` file, a REST API, or anything else.

Ports-and-adapters (a.k.a. hexagonal architecture) enforces exactly that split:

- A **port** is an interface — the contract the core depends on.
- An **adapter** implements the port by converting some external format into it.

Add a new data source → write a new adapter. The core never changes.

```
   EXTERNAL FORMATS                 ADAPTERS                    PORT                 CORE
  (what the world has)      (translate → internal shape)    (the contract)     (format-agnostic)

  .tra files  ──────────▶  TraFileAdapter        ┐
  JSON API    ──────────▶  CurrentApiAdapter      ├─▶  TranslationDataPort  ─▶  plugin/services/*
  Search API  ──────────▶  SearchApiAdapter      ┘                              (search, link, …)
```

## The port

`src/ports/translationPort.ts` defines the whole contract:

```typescript
export interface TranslationDataPort {
  getTranslationMap(): TranslationMap;   // { multilanId: { en, fr, nl, de } }
  getMetadataMap(): MetadataMap;         // { multilanId: { status, modifiedBy, … } }
  getTranslationCount(): number;
  getSourceIdentifier(): string;         // e.g. "tra-files"
}
```

Every adapter returns data in these two internal shapes:

```typescript
// TranslationMap — keyed by multilanId
{ "10001": { en: "Submit", fr: "Soumettre", nl: "Indienen", de: "Einreichen" } }

// MetadataMap — keyed by multilanId (empty for .tra files, which carry no metadata)
{ "10001": { status: "FINAL", modifiedBy: "john@company.com", modifiedAt: "2025-01-10T14:22:00Z" } }
```

## The adapters

`src/adapters/implementations/` holds three adapters. **One is live; two are
extensibility points** kept (and unit-tested) so a future API source can be wired in
without redesigning the core.

| Adapter | External format | Status |
|---------|-----------------|--------|
| `TraFileAdapter` | `.tra` CSV text, up to 4 languages | **Active** — the only source used at runtime |
| `CurrentApiAdapter` | Legacy JSON array of multilans | Extensibility (tested, not wired) |
| `SearchApiAdapter` | `resultList` search-API shape | Extensibility (tested, not wired) |

### TraFileAdapter (the active one)

```typescript
// Async factory — parses in chunks so a huge upload never blocks the UI.
const adapter = await TraFileAdapter.createAsync(traFileData);
const translationMap = adapter.getTranslationMap();
const metadataMap = adapter.getMetadataMap();  // empty — .tra has no metadata
```

It parses the (up to) four language files in parallel via `Promise.all`, yields to
the event loop every ~2000 lines, and tolerates partial uploads (1–4 languages).

### How a `.tra` upload flows to the core

1. User picks a folder (EB/EBB/PCB) or drops files on the upload modal.
2. The **UI** reads each file with `FileReader` (UTF-8, falling back to Windows-1252).
3. Raw text is sent to the **plugin** via `postMessage`.
4. The plugin merges it with any previously uploaded languages (incremental uploads).
5. `createAdapter(traData, "tra-files")` builds a `TraFileAdapter` and parses asynchronously.
6. The result is compressed (fflate) and cached in `figma.clientStorage`
   (see `storageService.ts` for the 5 MB-quota LRU eviction).

## The registry & factory

`src/adapters/index.ts` is the single entry point to the adapter layer:

```typescript
// Pick an adapter explicitly (what production does — the source is always known):
const adapter = await createAdapter(traData, "tra-files");

// …or let the factory sniff the format (used by the future API paths & tests):
const type = detectAdapterType(data);   // "search-api" | "current-api" | "tra-files" | null
```

`createAdapter` looks the type up in `adapterRegistry` (a `Map` of type → factory) and
awaits the factory. New sources register with `registerAdapter(type, factory)`.

> Note: today the plugin always calls `createAdapter(data, "tra-files")` with an explicit
> type, so `detectAdapterType` is exercised mainly by the future-API adapters and the tests.

## Adding a new data source

1. **Define the external types + a type guard** in `src/adapters/types/newApi.types.ts`:

   ```typescript
   export interface NewApiResponse { translations: Array<{ key: string; texts: Record<string, string> }>; }

   export function isNewApiFormat(data: unknown): data is NewApiResponse {
     return typeof data === "object" && data !== null && "translations" in data;
   }
   ```

2. **Implement the adapter** in `src/adapters/implementations/newApiAdapter.ts` so it
   satisfies `TranslationDataPort` (map external → `TranslationMap` / `MetadataMap`).

3. **Register it** in `src/adapters/index.ts`: add to `AdapterType`, `adapterRegistry`,
   and (if you want auto-detection) `detectAdapterType`.

The plugin core in `src/plugin/services/` needs **no changes** — that is the whole point.

## File map

```
src/
├── ports/
│   └── translationPort.ts          # The contract (TranslationDataPort)
├── adapters/
│   ├── index.ts                    # Registry, createAdapter, detectAdapterType
│   ├── types/
│   │   ├── traFile.types.ts        # .tra format + parser + isTraFileData   (active)
│   │   ├── currentApi.types.ts     # legacy JSON format + guard             (future)
│   │   └── searchApi.types.ts      # search-API format + guard              (future)
│   └── implementations/
│       ├── traFileAdapter.ts       # active adapter (async)
│       ├── currentApiAdapter.ts    # future adapter
│       └── searchApiAdapter.ts     # future adapter
└── shared/
    └── types.ts                    # Internal shapes (TranslationMap, MetadataMap, …)
```

## Design principles

1. **Adapters only translate** external → internal. No business logic.
2. **The internal format is the contract.** The core depends on `TranslationMap` /
   `MetadataMap`, never on a source format.
3. **Adapters own validation** via type guards (`isTraFileData`, `isSearchApiFormat`, …).
4. **The core stays untouched** when a data source is added.
5. **The factory is async** — `createAdapter()` returns `Promise<TranslationDataPort>`,
   because parsing large uploads must not block.
</content>
