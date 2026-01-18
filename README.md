# Multilan Helper

A Figma plugin for managing multilingual text content by linking text layers to translation IDs (multilanIds).

## Features

### Search Tab
- **Global Search**: Search translations by multilanId or text content
- **Translation Preview**: View all language variants (EN, FR, NL, DE) for each result
- **Status Badges**: See translation status (Final, Draft, In Translation, Review, To Translate)
- **Metadata Tooltips**: Hover to see created/modified dates, author, and source language
- **Link**: Connect selected text layer to a translation
- **Create**: Create a new linked text node from any search result
- **Variable Support**: Translations with `###variable###` patterns show inline inputs for value replacement
- **Copy ID**: Click multilanId button to copy to clipboard

### Links Tab
- **Text Node List**: View all text layers on page or current selection
- **Link Status**: See which nodes are linked or unlinked
- **Quick Link/Unlink**: Manage links directly from the list
- **Auto-Link All**: Automatically link unlinked nodes that match translations exactly
- **Filter**: Search/filter text nodes by name or content

### Language Switching
- **Supported Languages**: English, French, Dutch, German (EN, FR, NL, DE)
- **Auto-Detection**: Automatically detects current language from linked nodes
- **Bulk Update**: Switch language for all linked nodes at once
- **Variable Preservation**: Maintains variable values when switching languages

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
2. In Figma desktop app: Plugins → Development → Import plugin from manifest
3. Select the `manifest.json` file from this project
4. Run the plugin from Plugins → Development menu

## Project Structure

```
src/
├── plugin/                 # Figma sandbox code
│   ├── index.ts           # Main plugin entry point
│   └── services/          # Plugin services
│       ├── translationService.ts  # Translation lookup & search
│       ├── nodeService.ts         # Text node operations
│       └── linkingService.ts      # Link/unlink operations
├── ui/                     # Plugin UI (iframe)
│   ├── index.html         # HTML template
│   ├── main.ts            # UI entry point
│   ├── components/        # UI components
│   ├── services/          # UI services
│   ├── state/             # State management
│   └── styles/            # CSS styles
├── shared/                 # Shared types
│   └── types.ts
└── translations/           # Translation data
    └── api-data.json
```

## Data Storage

- **MultilanId links**: Stored in `pluginData` on each TextNode
- **Expected text**: Stored for modification detection (auto-unlinks if text is manually changed)
- **Variable values**: Stored for language switching with variables
- **Translations**: Bundled in plugin code from `api-data.json`

## Translation Data Format

```json
{
  "id": 10001,
  "status": "FINAL",
  "createdAt": "2024-01-15T10:30:00Z",
  "modifiedAt": "2024-01-20T14:45:00Z",
  "modifiedBy": "john.doe",
  "multilanTextList": [
    { "languageId": "en", "wording": "Hello ###name###!", "sourceLanguageId": "en" },
    { "languageId": "fr", "wording": "Bonjour ###name###!", "sourceLanguageId": "en" }
  ]
}
```

## Variable Format

Translations can include variables using the `###variable###` format:
- Example: `"Welcome back, ###username###! You have ###count### messages."`
- When linking or creating, input fields appear for each variable
- Variable values are preserved when switching languages
