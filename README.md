# Multilan Helper

**Switch languages, instantly**

A Figma plugin that enables switching text content between languages (EN, FR, NL, DE) by linking text layers to multilanIds.

## Features

- **View Mode** (all users): Preview translations, see multilanId info without modifying file
- **Edit Mode** (editors only): Switch language, link/unlink text to multilanIds
- **Fuzzy Search**: Search translations by text content or multilanId
- **Scope Control**: Apply to entire page or current selection

## Commands

```bash
npm install            # Install dependencies
npm run build          # Build the plugin
npm run build:watch    # Build with watch mode for development
npm run typecheck      # Run TypeScript type checking
npm run lint           # Run ESLint
npm run lint:fix       # Run ESLint with auto-fix
```

## Development Workflow

1. Run `npm run build:watch` to start the dev server
2. In Figma desktop app: Plugins → Development → Import plugin from manifest
3. Select the `manifest.json` file
4. Run the plugin from Plugins → Development menu

## Architecture

| File | Description |
|------|-------------|
| `src/code.ts` | Main plugin code (Figma sandbox) |
| `src/ui.html` | Plugin UI (iframe) |
| `src/translations.json` | Bundled translation data |
| `manifest.json` | Figma plugin manifest |
| `specs/multilang-switcher.md` | Full product specification |

## Data Storage

- MultilanId links stored in `pluginData` on each TextNode
- User preferences stored in `clientStorage`
- Translations bundled in plugin code
