# Multilan Helper

A Figma plugin for managing multilingual text. It links Figma text layers to translation IDs (**multilanIds**) so designers can switch a design between English, French, Dutch, and German in place. Translation data comes from `.tra` files that users upload at runtime — nothing is bundled at build time.

> New to the codebase? Read **[How It Works](#how-it-works)** first, then **[Project Structure](#project-structure)**. For the data-source design (ports & adapters), see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## How It Works

A Figma plugin runs as **two separate programs** that cannot call each other directly — they only exchange messages:

```
┌─────────────────────────┐   postMessage    ┌──────────────────────────┐
│   UI  (iframe)           │  ───────────────▶ │  Plugin  (Figma sandbox) │
│   src/ui/                │                   │  src/plugin/             │
│   • renders HTML/CSS     │ ◀───────────────  │  • reads/writes the      │
│   • no access to canvas  │   postMessage     │    Figma document        │
└─────────────────────────┘                   └──────────────────────────┘
```

- **The UI** (`src/ui/`) is a normal web page. It renders the panel, but it *cannot* touch the Figma canvas. It sends requests like "link this node" and renders whatever the plugin sends back.
- **The plugin** (`src/plugin/`) runs in Figma's sandbox with access to the document (nodes, text, selection). It has no DOM. It receives messages, mutates the document, and posts results back.

Every interaction is a round trip:

```
User clicks "Link"  →  pluginBridge.linkNode(id)  →  postMessage
                    →  plugin router (figma.ui.onmessage)  →  linkingService.linkTextNode()
                    →  plugin writes multilanId onto the node  →  postMessage("node-updated")
                    →  UI store updates  →  component re-renders
```

The two sides share **only types**, from `src/shared/types.ts` — most importantly `PluginMessage`, the union of every message that can cross the boundary.

### Where translation data comes from

Translation data is loaded through a **ports-and-adapters (hexagonal) architecture** so the plugin core never depends on a specific file or API format. Today the only live source is uploaded `.tra` files, but the design leaves room for API sources without touching the core. See **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## Project Structure

```
src/
├── plugin/                      # Runs in the Figma sandbox (has document access, no DOM)
│   ├── index.ts                 # Entry point + message router (figma.ui.onmessage) + handlers
│   └── services/
│       ├── translationService.ts  # Search, fuzzy scoring, exact-match cache, language detection
│       ├── nodeService.ts         # Read/write text nodes & their pluginData (multilanId, etc.)
│       ├── linkingService.ts      # Link / unlink / switch-language / placeholder operations
│       └── storageService.ts      # LRU-aware writes to figma.clientStorage (5 MB quota)
│
├── ui/                          # Runs in the iframe (has DOM, no document access)
│   ├── index.html               # HTML shell
│   ├── main.ts                  # Entry point: wires components, dispatches incoming messages
│   ├── components/              # One file per piece of UI
│   │   ├── FolderSelector.ts      # EB / EBB / PCB folder buttons (+ upload timestamps)
│   │   ├── LanguageBar.ts         # EN / FR / NL / DE buttons (disabled if not uploaded)
│   │   ├── SearchPanel.ts         # Search box, results, single-node match banner
│   │   ├── FramePanel.ts          # Multi-selection / frame mode (per-node matches)
│   │   ├── ManualLinkWidget.ts    # Manual multilanId entry + verification
│   │   ├── TraUploadModal.ts      # Drag-and-drop .tra upload modal
│   │   ├── StatusBar.ts           # Status line + view-only mode
│   │   ├── Toast.ts               # Transient notifications
│   │   ├── Tabs.ts                # Single-tab stub (kept for a future multi-tab UI)
│   │   └── index.ts               # Barrel export
│   ├── services/
│   │   └── pluginBridge.ts        # The UI half of the message bridge (typed send/receive)
│   ├── state/
│   │   └── store.ts               # Single source of UI state + subscribe/notify
│   └── styles/main.css
│
├── shared/
│   └── types.ts                 # Types shared by BOTH sides (incl. PluginMessage union)
│
├── ports/                       # Hexagonal architecture — see ARCHITECTURE.md
│   └── translationPort.ts       # TranslationDataPort: the contract every data source implements
├── adapters/                    # Turn an external format INTO the port's shape
│   ├── index.ts                 # Adapter registry + factory (createAdapter / detectAdapterType)
│   ├── types/                   # External-format type definitions + parsers/type-guards
│   └── implementations/         # traFileAdapter (active), currentApiAdapter & searchApiAdapter (future)
│
└── translations/                # Sample .tra files (real data is uploaded at runtime)
```

### The two message endpoints

If you only remember two files, remember these:

| Side | File | Role |
|------|------|------|
| UI → Plugin | `src/ui/services/pluginBridge.ts` | Typed methods (`linkNode`, `globalSearch`, …) that `postMessage` to the plugin, plus a subscription list for replies. |
| Plugin → UI | `src/plugin/index.ts` (`figma.ui.onmessage`) | A single `switch` on `msg.type` that routes each message to a handler. |

Every message type is a member of the `PluginMessage` union in `src/shared/types.ts` — the single place to look to see what can cross the boundary.

---

## Features

### Translation file upload
- **Runtime upload** of `.tra` files per folder (EB / EBB / PCB) — no build-time bundling
- **Drag & drop** all four language files at once, or pick them
- **Auto-detection** of language from filename (`en-BE.tra` → EN)
- **Partial & incremental**: upload 1–4 languages, add more later without losing prior uploads
- **Per-user storage**: uploads are compressed and cached in `figma.clientStorage`
- **LRU eviction**: if the 5 MB quota is hit, the least-recently-used folder is evicted first

### Search & matching
- **Global search** by multilanId or text, with fuzzy matching
- **Exact match** via an O(1) text→ID map (case-sensitive — `Private` ≠ `private`)
- **Fuzzy match** via Levenshtein scoring with early termination and cancellation
- **Translation preview** across all uploaded languages, with status badges

### Frame / multi-selection mode
- Select several text nodes (or a frame) to see all matches at once
- Per-node link / unlink / browse close-match suggestions

### Language switching
- Switch EN / FR / NL / DE for all linked nodes (page or selection scope)
- Detects the current language from already-linked nodes
- `###variable###` placeholders prompt for values and are preserved across languages

### Other
- **Auto-unlink** when a linked layer's text is edited by hand
- **Highlight unlinked** text nodes on the canvas
- **View-only mode** for users without edit permission

---

## Getting Started

```bash
npm install
```

| Command | Description |
|---------|-------------|
| `npm run build` | Build plugin + UI into `dist/` |
| `npm run build:watch` | Rebuild on change (use this while developing) |
| `npm run test` | Run the Vitest suite |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint |

To load the plugin:

1. Run `npm run build:watch`.
2. In the Figma desktop app: **Plugins → Development → Import plugin from manifest**.
3. Select `manifest.json` from this project.
4. Run it from **Plugins → Development**.

---

## Data Storage

| Data | Storage | Scope |
|------|---------|-------|
| MultilanId link | `pluginData` on each TextNode | Per-document |
| Expected text (for auto-unlink) | `pluginData` on each TextNode | Per-document |
| `.tra` content (compressed) | `figma.clientStorage` | Per-user |
| Upload metadata & timestamps | `figma.clientStorage` | Per-user |
| Selected folder | `figma.clientStorage` | Per-user |

The `pluginData` keys are defined once in `src/shared/types.ts` (`PLUGIN_DATA_KEY`, `EXPECTED_TEXT_KEY`, `PLACEHOLDER_KEY`) and read/written only through `nodeService.ts`.

## `.tra` File Format

```
multilanId,"translation text","ignored"
10001,"Submit","All"
10002,"Cancel","All"
10003,"Hello, ###name###!","All"
```

- **Column 1** — numeric multilanId
- **Column 2** — quoted translation text (`""` escapes a literal quote)
- **Column 3** — ignored

Each folder (EB / EBB / PCB) has up to four language files: `en-BE.tra`, `fr-BE.tra`, `nl-BE.tra`, `de-BE.tra`.

## Variables

Translations may embed `###variable###` placeholders, e.g. `"Welcome back, ###username###!"`. When linking, an input appears per variable, and the values are preserved when the language is switched.

## Performance

Tuned for folders with 80,000+ multilanIds:

- Async, chunked `.tra` parsing (yields to the event loop, never blocks the UI)
- Async, chunked text→ID map building, cached until the data source changes
- Chunked fuzzy search with cancellation (a new query cancels the previous one)
- Compressed `.tra` storage (fflate `deflate`) to stay within the 5 MB quota
- Parallelized `clientStorage` reads/writes

---

## Related Docs

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — the ports-and-adapters data layer and how to add a new data source
- **[TESTING.md](./TESTING.md)** — how the tests are organized
- **[PUBLISHING.md](./PUBLISHING.md)** — release process
</content>
</invoke>
