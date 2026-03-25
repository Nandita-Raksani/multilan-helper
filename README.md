# Multilan Helper

A Figma plugin for managing multilingual text content by linking text layers to translation IDs (multilanIds). Translation data is loaded from `.tra` files uploaded at runtime.

## Features

### Translation File Upload
- **Runtime Upload**: Upload `.tra` files per folder (EB, EBB, PCB) — no build-time bundling
- **Drag & Drop**: Drop all 4 language files at once, or use a file picker
- **Auto-Detection**: Language detected from filename (e.g., `en-BE.tra` -> EN)
- **Partial Upload**: Upload 1-4 languages per folder; missing languages are disabled
- **Incremental Upload**: Add languages to a folder over time without losing previously uploaded ones
- **Per-User Storage**: Each user's uploads cached locally in Figma's clientStorage
- **Upload Tracking**: Last upload timestamp shown on folder buttons

### Search & Matching
- **Global Search**: Search translations by multilanId or text content with fuzzy matching
- **Exact Match**: O(1) lookup via cached text-to-ID map
- **Fuzzy Match**: Levenshtein distance scoring with early termination
- **Translation Preview**: View all language variants (EN, FR, NL, DE) for each result
- **Status Badges**: See match status (Linked, Match, Close Match, No Match)
- **Copy ID**: Click multilanId to copy to clipboard

### Frame/Multi-Selection Mode
- **Batch View**: Select multiple text nodes or a frame to see all matches at once
- **Per-Node Actions**: Link, unlink, or find close matches for individual nodes
- **Carousel**: Browse through close match suggestions per node

### Language Switching
- **Supported Languages**: English, French, Dutch, German (EN, FR, NL, DE)
- **Per-Folder Availability**: Language buttons disabled for languages not uploaded
- **Auto-Detection**: Detects current language from linked nodes
- **Bulk Update**: Switch language for all linked nodes (page or selection scope)
- **Variable Support**: `###variable###` patterns prompt for values when linking

### Other Features
- **Auto-Unlink**: Detects when linked text is manually modified and unlinks it
- **Highlight Unlinked**: Select all unlinked text nodes on canvas
- **Toast Notifications**: Visual feedback for uploads and actions
- **View Mode**: Read-only mode for users without edit permissions

## Installation

```bash
npm install
```

## Commands

```bash
npm run build          # Build the plugin
npm run build:watch    # Build with watch mode for development
npm run test           # Run tests
npm run typecheck      # Run TypeScript type checking
npm run lint           # Run ESLint
npm run lint:fix       # Run ESLint with auto-fix
```

## Development

1. Run `npm run build:watch` to start development build
2. In Figma desktop app: Plugins > Development > Import plugin from manifest
3. Select the `manifest.json` file from this project
4. Run the plugin from Plugins > Development menu

## Project Structure

```
src/
├── plugin/                 # Figma sandbox code
│   ├── index.ts           # Main plugin entry point (message router + handlers)
│   └── services/          # Plugin services
│       ├── translationService.ts  # Search, scoring, language detection
│       ├── nodeService.ts         # Text node operations (read/write pluginData)
│       └── linkingService.ts      # Link/unlink/switch language operations
├── ui/                     # Plugin UI (iframe)
│   ├── index.html         # HTML template
│   ├── main.ts            # UI entry point & message handler
│   ├── components/        # UI components
│   │   ├── FolderSelector.ts     # EB/EBB/PCB folder buttons
│   │   ├── LanguageBar.ts        # EN/FR/NL/DE language buttons
│   │   ├── SearchPanel.ts        # Search input & results rendering
│   │   ├── FramePanel.ts         # Multi-selection frame mode
│   │   ├── TraUploadModal.ts     # .tra file upload modal (drag & drop)
│   │   ├── VariablePromptModal.ts # Variable input modal
│   │   ├── Toast.ts              # Toast notifications
│   │   ├── StatusBar.ts          # Status bar
│   │   └── Tabs.ts               # Tab switching
│   ├── services/
│   │   └── pluginBridge.ts       # UI <-> Plugin message bridge
│   ├── state/
│   │   └── store.ts              # Centralized UI state management
│   └── styles/
│       └── main.css              # All CSS styles
├── shared/                 # Shared types (used by both plugin and UI)
│   └── types.ts
├── ports/                  # Hexagonal architecture ports
│   └── translationPort.ts
├── adapters/               # Data format adapters
│   ├── index.ts           # Adapter registry & factory
│   ├── types/             # External format type definitions
│   │   └── traFile.types.ts
│   └── implementations/   # Adapter implementations
│       └── traFileAdapter.ts
└── translations/           # .tra files (gitignored, uploaded at runtime)
```

## Data Storage

| Data | Storage | Scope |
|------|---------|-------|
| MultilanId links | `pluginData` on each TextNode | Per-document |
| Expected text | `pluginData` on each TextNode | Per-document |
| .tra file content | `figma.clientStorage` | Per-user |
| Upload metadata | `figma.clientStorage` | Per-user |
| Selected folder | `figma.clientStorage` | Per-user |

## Translation Data Format (.tra files)

```
multilanId,"translation text","ignored"
10001,"Submit","All"
10002,"Cancel","All"
10003,"Hello, ###name###!","All"
```

Each folder (EB, EBB, PCB) has up to 4 language files: `en-BE.tra`, `fr-BE.tra`, `nl-BE.tra`, `de-BE.tra`.

## Variable Format

Translations can include variables using the `###variable###` format:
- Example: `"Welcome back, ###username###! You have ###count### messages."`
- When linking, input fields appear for each variable
- Variable values are preserved when switching languages

## Performance

Optimized for datasets with 80,000+ multilans per folder:
- Async chunked .tra file parsing (non-blocking)
- Async chunked text-to-ID map building
- Chunked fuzzy search with cancellation support
- Page scan caching with 5-second TTL
- Parallelized clientStorage calls
- No memory-heavy pre-built indexes
