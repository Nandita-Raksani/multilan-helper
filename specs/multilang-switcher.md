# Figma Multilingual Switcher Plugin - Specification

## Overview

A Figma plugin that enables designers and non-technical users to switch the language of an entire screen/page with a single click. Text elements are linked to translation keys (multilanIds), and the plugin fetches translations from an internal API.

## Supported Languages

- English (EN) - Default
- French (FR)
- Dutch (NL)
- German (DE)

---

## Core Features (MVP)

### Permission Model

| Feature | Viewers / Dev Seats | Editors / Designers |
|---------|---------------------|---------------------|
| Preview translations | Yes | Yes |
| See multilanId info | Yes | Yes |
| Switch language (modify file) | No | Yes |
| Link text to multilanId | No | Yes |

---

### 1. View Mode (All Users)

For viewers, dev seats, and anyone without edit access. **Does not modify the file.**

**Side Panel List:**
- Shows all text layers with their linked multilanIds
- Displays original text + translations for selected language
- Searchable/filterable list

**Hover Tooltips:**
- Hover over any text layer to see:
  - Linked multilanId
  - Translations in all languages
  - Link status (linked/unlinked)

**Overlay Badges:**
- Optional toggle to show translated text as overlay near each text layer
- Visual preview without changing actual content

---

### 2. Edit Mode (Editors/Designers Only)

**Language Switching:**
Floating mini bar with language buttons (EN | FR | NL | DE)
- One-click to switch languages
- Non-intrusive, stays visible while working
- Position: Top or bottom of canvas (user movable)

**Scope Options (configurable per user):**
- Default: Entire page
- Alternative: Selected frame only, or current selection

**Behavior:**
- Replaces all linked text with translations from selected language
- Uses Figma's native undo (Cmd+Z) for reverting changes

**Text-to-MultilanId Linking:**
1. Designer selects a text layer
2. Plugin shows searchable list of multilanIds
3. Fuzzy matching suggests relevant IDs based on current text content
4. Designer confirms the link
5. MultilanId stored in Figma's `pluginData` on the text node

**Smart Suggestions:**
- Search bundled translations by text content (fuzzy match)
- Show top matching multilanIds with their translations
- Allow manual search/entry as fallback

---

## UI Design

### Floating Mini Bar (Primary)
```
┌─────────────────────────────┐
│  EN  │  FR  │  NL  │  DE   │
└─────────────────────────────┘
```
- Compact, minimal footprint
- Active language highlighted
- Draggable to reposition

### Expanded Panel (For Linking)
Accessible via settings icon on mini bar:
- Text linking interface
- Search multilanIds
- View/edit linked text in current selection
- Settings (scope, sample values for placeholders)

---

## Data Strategy (Secure - No External API Exposure)

### Approach: Bundled Translations with CI/CD Auto-Publish

Translations are bundled directly into the plugin and published as an **organization-only private plugin** (Figma Enterprise). CI/CD automates updates.

**Why this approach:**
- No API gateway or proxy required
- No authentication flow needed in plugin
- Translations never leave company infrastructure
- Only org members can access the plugin

### CI/CD Release Pipeline

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Translation     │    │ CI/CD Pipeline   │    │ Figma Org       │
│ Release (3x/wk) │───▶│ Build & Publish  │───▶│ Plugin Library  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

**Pipeline steps:**
1. Trigger: Translation release event (or scheduled 3x/week)
2. Fetch: Script pulls JSON from internal translation API
3. Bundle: JSON embedded into plugin build (`translations.json` → `code.js`)
4. Publish: Figma Plugin API publishes new version to org
5. Distribute: Org users auto-update or receive update notification

### Data Size
- 89,000 multilanIds × 4 languages ≈ 10-20MB JSON
- Acceptable for plugin bundle (loads once on plugin open)
- Optimization: gzip or split by language if performance issues arise

### Data Storage (Figma)
- **Translations:** Bundled in plugin code (read-only)
- **MultilanId links:** `pluginData` on each text node
- **User preferences:** `clientStorage` (last language, scope setting)
- **Original text:** Not stored (rely on Figma undo)

---

## Edge Cases & Warnings

### Missing Translations
**Behavior:** Highlight + fallback
- Show English (fallback) text
- Visually highlight layer (colored border/badge)
- List missing translations in panel

### Text Overflow
**Behavior:** Warn designer
- After language switch, scan for text that may overflow
- Highlight affected layers
- Show list in panel with layer links

### Dynamic Placeholders
**Example:** "Hello {username}, you have {count} messages"
**Behavior:** Configurable sample values
- User can set sample values per placeholder type
- Default samples provided (e.g., {username} → "John", {count} → "5")
- Settings stored per user

### Unlinked Text
**Highlight Mode:** Toggle to show unlinked text
- Unlinked translatable text highlighted in yellow/red
- Helps catch missing translations during design review

---

## User Settings

| Setting | Options | Default |
|---------|---------|---------|
| Scope | Page / Frame / Selection | Page |
| Default language | EN / FR / NL / DE | EN |
| Placeholder samples | Custom key-value pairs | Built-in defaults |

Settings persist per user (not per file).

---

## Technical Considerations

### Figma Plugin Architecture
- **Main thread (code.ts):** API calls, data processing, plugin logic
- **UI thread (ui.html):** Floating bar, linking interface

### CI/CD Requirements
- Access to internal translation API (from CI runner)
- Figma Plugin API credentials (for org publishing)
- Build script to bundle JSON into plugin

### Performance
- Translations loaded once on plugin open (bundled, no network calls)
- Fuzzy search runs client-side on bundled data
- Consider lazy-loading languages if 20MB bundle causes slow startup

---

## Out of Scope (Future Phases)

- RTL language support (Arabic, Hebrew)
- Edit translations and sync back to API
- Per-file language persistence
- Detailed analytics/tracking

---

## Open Questions

1. **CI/CD Integration:** Which CI/CD system will run the pipeline? (Jenkins, GitHub Actions, etc.)
2. **Figma API Credentials:** Who will manage the Figma Plugin API token for automated publishing?
3. **Translation API Access:** Can the CI runner access the internal translation API?
4. **Versioning:** Should plugin version auto-increment with each translation release?

---

## Success Criteria

1. **All users** (including viewers/dev seats) can preview translations and see multilanId info
2. **Editors** can switch all text on a page to any supported language in one click
3. **Editors** can link text to multilanIds with intuitive fuzzy search
4. Missing/overflow issues are clearly visible
5. Non-technical users can use View Mode without training