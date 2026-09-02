# Multilan Helper

A Figma plugin for managing multilingual text. It links Figma text layers to translation IDs (**multilanIds**) so designers can switch a design between English, French, Dutch, and German in place. Translation data comes from `.tra` files that users upload at runtime — nothing is bundled at build time.

> New to the codebase? Read **[How It Works](#how-it-works)** first, then **[Project Structure](#project-structure)**. For the data-source design (ports & adapters), see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.
>
> **Not a developer?** Read **[USER-GUIDE.md](./USER-GUIDE.md)** instead — how designers use the plugin, in plain language.

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
- **Runtime upload** of a release **`.zip`** per folder (EB / EBB / PCB) — no build-time bundling. Loose `.tra` files are rejected with a hint to upload the original zip.
- **Drag & drop** the zip or pick it; the `.tra` files inside are extracted in the UI (`fflate`), macOS `__MACOSX` junk skipped
- **Auto-detection** of language from filename (`en-BE.tra` → EN); the zip name and any date in it are stored as upload metadata
- **Partial & incremental**: a zip with 1–4 languages works; later uploads merge
- **Per-user storage**: uploads are compressed and cached in `figma.clientStorage`
- **LRU eviction**: if the 5 MB quota is hit, the least-recently-used folder is evicted first
- **Re-upload** by clicking the already-active folder button; the last upload date/zip name is shown

### Search & matching
- **Global search** by multilanId or text, with fuzzy matching, insensitive to case, accents, apostrophe/space variants (`foldForSearch`)
- **Exact match** via an O(1) text→ID map (strict — NFC normalization only); all IDs sharing the same text are surfaced, not just the first
- **Fuzzy match** via Levenshtein scoring with early termination and cancellation, run **on demand** per node ("Find close match")
- **Translation preview** across all uploaded languages, with status badges (status metadata exists only for API sources; `.tra` files carry none)
- **Manual link by multilanId** — paste an ID, verify it, preview its translations, then link

### Frame / multi-selection mode
- Select several text nodes (or a frame) to see all matches at once
- Per-node link / unlink / update / badge side / browse close-match suggestions
- Header summary (`N linked, N out of date, N unmatched`); clicking a card selects and zooms the node
- Nodes hidden via their own or an ancestor's `visible` flag are skipped everywhere

### Language switching
- Switch EN / FR / NL / DE for all linked nodes — **selection scope when something is selected, page scope otherwise**
- Detects the current language from already-linked nodes at startup
- Missing translations become `*Multilan not available*` and are reported back to the UI
- `###variable###` templates are kept in canonical template form (interpolated text is rewritten back on refresh)

### On-canvas multilanId badges
- Linking draws a green badge + dashed leader line outside the frame, readable by anyone without the plugin
- All badges live in one page-level **"Multilan IDs"** group so they can be hidden/shown together
- Badges are added/removed incrementally on link, unlink, create and side change; the whole page reconciles on plugin start and refresh
- Per-node **badge side**: `auto` / `left` / `right`, stored on the node

### Out-of-date detection
- A linked, un-edited node whose `.tra` wording has since changed is flagged **Out of date** (`isOutOfDate`), using the language recorded on the node at link/switch time
- **Update** applies the current `.tra` value to **one node at a time** — deliberately no bulk update, so layout breakage stays visible and per-layer
- Nodes edited by hand are *not* "out of date" — they are auto-unlinked instead

### Other
- **Auto-unlink** when a linked layer's text is edited by hand (runs on plugin start and on refresh)
- **Highlight unlinked** — walks the selection's unlinked nodes one at a time, selecting each on canvas
- **Preview (read-only) mode in Dev Mode** — every write handler is gated by `hasEditPermission()`, i.e. `figma.editorType === "figma"`. On a dev seat the UI hides the language bar, highlight-unlinked, link/unlink/update/badge-side and manual link; it keeps folder upload, search, match detection, out-of-date badges and translation previews, and *adds* per-language copy buttons. Users with neither seat can't run the plugin at all — for them the on-canvas badges and the `• multilanId` layer-name suffix are the whole interface. See [USER-GUIDE.md § Who can do what](./USER-GUIDE.md#8-who-can-do-what--designers-developers-everyone-else).

  > ⚠️ `manifest.json` currently declares `"editorType": ["figma"]`. For the plugin to actually appear in Dev Mode this must be `["figma", "dev"]` — the read-only code path is complete, the manifest is the only thing gating it.
- **Resizable** panel (drag handle) and **collapse to header**

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
| Expected language (for out-of-date checks) | `pluginData` on each TextNode | Per-document |
| Badge side preference | `pluginData` on each TextNode | Per-document |
| Annotation markers (badge nodes + container group) | `pluginData` on the annotation nodes | Per-document |
| `.tra` content (compressed) | `figma.clientStorage` | Per-user |
| Upload metadata & timestamps | `figma.clientStorage` | Per-user |
| Selected folder | `figma.clientStorage` | Per-user |

Anything on a node is shared with everyone who opens the file (links, badges); anything in `clientStorage` is local to one user — each teammate uploads the release zip themselves.

The `pluginData` keys are defined once in `src/shared/types.ts` (`PLUGIN_DATA_KEY`, `EXPECTED_TEXT_KEY`, `EXPECTED_LANG_KEY`, `PLACEHOLDER_KEY`, `ANNOTATION_KEY`, `ANNOTATION_TARGET_KEY`, `ANNOTATION_SIDE_KEY`, `ANNOTATION_CONTAINER_KEY`) and read/written only through `nodeService.ts` / `annotationService.ts`.

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

Translations may embed `###variable###` placeholders, e.g. `"Welcome back, ###username###!"`. Nodes keep the canonical template form on canvas: a node whose text was interpolated in an earlier version (`"Welcome back, Ana!"`) is rewritten back to the template on refresh, and `isOutOfDate` treats an interpolated form as matching its template rather than as a change.

## Performance

Tuned for folders with 80,000+ multilanIds:

- Async, chunked `.tra` parsing (yields to the event loop, never blocks the UI)
- Async, chunked text→ID map building, cached until the data source changes
- Chunked fuzzy search with cancellation (a new query cancels the previous one)
- Compressed `.tra` storage (fflate `deflate`) to stay within the 5 MB quota
- Parallelized `clientStorage` reads/writes

---

## Related Docs

- **[USER-GUIDE.md](./USER-GUIDE.md)** — the designer-facing manual (what each button does, in plain language)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — the ports-and-adapters data layer and how to add a new data source
- **[TESTING.md](./TESTING.md)** — how the tests are organized
- **[PUBLISHING.md](./PUBLISHING.md)** — release process
</content>
</invoke>
