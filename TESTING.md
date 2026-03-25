# Multilan Helper Plugin - Testing Guide

## Loading the Plugin in Figma

1. Open Figma Desktop App
2. Open any file (or create a new one)
3. Go to **Plugins** > **Development** > **Import plugin from manifest...**
4. Navigate to this folder and select `manifest.json`
5. Run the plugin: **Plugins** > **Development** > **Multilan Helper**

---

## Uploading Translation Files

The plugin requires `.tra` files to be uploaded at runtime. Each folder (EB, EBB, PCB) can have up to 4 language files.

### How to Upload

1. Open the plugin — folder buttons (EB, EBB, PCB) appear at the top
2. Click any folder button — the upload modal opens
3. Either:
   - **Drag & drop** all `.tra` files onto the drop zone, or
   - Click **Choose files** and select them
4. Language is auto-detected from filename (e.g., `en-BE.tra` -> EN)
5. Click **Upload** when at least 1 language is selected
6. A toast notification confirms: "Loaded X translations for EB"

### Partial Uploads

- You can upload 1-4 languages per folder
- Missing language buttons will be disabled
- Upload more languages later — they merge with existing data

### Re-uploading

- Click the **currently active** folder button to re-upload
- New files merge with existing data (doesn't replace)

---

## Test Scenarios

### 1. Upload & Folder Switching

1. Upload `.tra` files for EB (at least EN)
2. Verify toast shows translation count
3. Verify EB button has green dot indicator
4. Click PCB button — upload modal appears (no data yet)
5. Upload `.tra` files for PCB
6. Switch back to EB — loads instantly from cache (no modal)

### 2. Partial Language Upload

1. Upload only `en-BE.tra` for EB
2. Verify EN button is enabled, FR/NL/DE are disabled
3. Upload `fr-BE.tra` for EB (incremental)
4. Verify EN and FR are now both enabled

### 3. Search

1. Upload `.tra` files for any folder
2. Type in the search box:
   - Search by **multilanId**: `10001`
   - Search by **text**: `Submit`, `Cancel`
   - Partial match: `Sub` (fuzzy matching)
3. Results appear with match badges (Match, Close Match)

### 4. Frame/Multi-Selection Mode

1. Select a frame containing multiple text nodes
2. Plugin switches to frame mode showing all text nodes
3. Each node shows its match status (Linked, Match, No Match)
4. Click **Find close match** on unmatched nodes
5. Use carousel arrows to browse suggestions

### 5. Linking & Unlinking

1. Select a single text node in Figma
2. Search for a translation in the plugin
3. Click **Link** on a search result
4. Verify:
   - Layer name updates to `Text [multilanId]`
   - Match badge shows "Linked"
5. Click **Unlink** to remove the link

### 6. Variable Support

1. Find a translation with `###variable###` patterns
2. Click **Link** — a variable input modal appears
3. Enter values for each variable
4. Click **Apply & Link**
5. Verify text updates with variable values substituted

### 7. Language Switching

1. Link several text nodes to multilanIds
2. Click language buttons (EN, FR, NL, DE) — only enabled ones work
3. Verify linked text nodes update to the selected language
4. Unlinked nodes remain unchanged

### 8. Auto-Unlink Detection

1. Link a text node to a multilanId
2. Manually edit the text in Figma (change it from the linked translation)
3. Reload or refresh the plugin
4. Verify the node is auto-unlinked with a notification

### 9. Highlight Unlinked

1. Select a frame with mixed linked/unlinked text nodes
2. Click the **Highlight unlinked** button
3. All unlinked text nodes are selected on canvas
4. Click again to exit highlight mode

---

## Running Automated Tests

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

Test files are in `tests/`:
- `tests/adapters/traFileAdapter.test.ts` — .tra file parsing and adapter
- `tests/plugin/services/` — Translation service, node service, linking service

---

## Quick Test Checklist

- [ ] Plugin loads without errors
- [ ] Upload .tra files via drag & drop
- [ ] Upload .tra files via file picker
- [ ] Partial upload (1-2 languages) works
- [ ] Missing language buttons are disabled
- [ ] Folder switching loads from cache
- [ ] Re-upload merges with existing data
- [ ] Search by ID works
- [ ] Search by text (fuzzy) works
- [ ] Frame mode shows all text nodes
- [ ] Link/unlink works
- [ ] Language switching works
- [ ] Variable prompts appear for ###var### translations
- [ ] Auto-unlink detects modified text
- [ ] Toast notifications appear for uploads
