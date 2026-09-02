# Multilan Helper Plugin - Testing Guide

## Loading the Plugin in Figma

1. Open Figma Desktop App
2. Open any file (or create a new one)
3. Go to **Plugins** > **Development** > **Import plugin from manifest...**
4. Navigate to this folder and select `manifest.json`
5. Run the plugin: **Plugins** > **Development** > **Multilan Helper**

---

## Uploading Translation Files

The plugin requires a release **`.zip`** to be uploaded at runtime. Each folder (EB, EBB, PCB) can have up to 4 language files, extracted from the zip in the UI.

### How to Upload

1. Open the plugin — folder buttons (EB, EBB, PCB) appear at the top
2. Click any folder button — the upload modal opens
3. Either:
   - **Drag & drop** the release `.zip` onto the drop zone, or
   - Click **Choose .zip file** and select it
4. Language is auto-detected from each `.tra` filename inside the zip (e.g., `en-BE.tra` -> EN)
5. Click **Upload** when at least 1 language is detected
6. A toast notification confirms: "Loaded X translations for EB"

Dropping loose `.tra` files is rejected with *"Please upload the original .zip file, not the individual .tra files."*

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

1. Upload a release zip for EB (at least EN inside)
2. Verify toast shows translation count
3. Verify EB button has green dot indicator
4. Click PCB button — upload modal appears (no data yet)
5. Upload a zip for PCB
6. Switch back to EB — loads instantly from cache (no modal)
7. Click the **active** EB button — the modal reopens for re-upload and shows the last upload date + zip name

### 2. Partial Language Upload

1. Upload a zip containing only `en-BE.tra` for EB
2. Verify EN button is enabled, FR/NL/DE are disabled
3. Upload a zip containing `fr-BE.tra` for EB (incremental)
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
   - Layer name updates to `Original Name • multilanId`
   - Match badge shows "Linked"
   - The node's text becomes the official translation in the **currently selected language**
   - A green ID badge appears on canvas next to the node
5. Click **Unlink** — the link, the name suffix and the badge are removed

### 6. Manual Link by MultilanId

1. Select an unlinked text node
2. Click **Link by multilanId**, paste an ID, click **Verify**
3. Verify the four translations preview appears (or "Multilan ID not found")
4. Click **Link**

### 7. Variable Support

1. Find a translation with `###variable###` patterns and link a node to it
2. Verify the node shows the raw template (`Hello, ###name###!`)
3. Switch languages — the template markers are preserved
4. Type an interpolated value by hand, then reopen the plugin — the node is rewritten back to the template form

### 8. Language Switching

1. Link several text nodes to multilanIds
2. With **nothing selected**, click a language button — the whole page switches
3. With a frame selected, click a language button — only that selection switches
4. Verify unlinked nodes remain unchanged, and IDs missing that language show `*Multilan not available*`

### 9. Auto-Unlink Detection

1. Link a text node to a multilanId
2. Manually edit the text in Figma (change it from the linked translation)
3. Close and reopen the plugin
4. Verify the node is auto-unlinked with a notification

### 10. Out-of-Date Detection & Update

1. Link nodes to a few IDs
2. Upload a newer zip where those IDs have different wording
3. Verify those nodes show the amber **Out of date** badge (card + frame summary count)
4. Click **⟳ Update** on one card — only that node's text changes; the others stay out of date
5. Verify a node you edited by hand is auto-unlinked instead of being flagged out of date

### 11. On-Canvas Badges

1. Link a node inside a frame — a green badge with a dashed leader line appears outside the frame
2. Verify all badges sit in one page-level **"Multilan IDs"** group and can be hidden together
3. Switch **Badge side** (Auto / Left / Right) on a card — only that node's badge moves
4. Unlink — only that node's badge disappears

### 12. Highlight Unlinked

1. Select a frame with mixed linked/unlinked text nodes
2. Click the **Highlight unlinked** button
3. Unlinked nodes are stepped through one at a time, each selected on canvas; the status bar shows the count
4. Click again (**Hide unlinked**) to exit highlight mode

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
- [ ] Upload release .zip via drag & drop
- [ ] Upload release .zip via file picker
- [ ] Loose .tra files are rejected with the "upload the original .zip" hint
- [ ] Partial upload (1-2 languages) works
- [ ] Missing language buttons are disabled
- [ ] Folder switching loads from cache
- [ ] Re-upload merges with existing data
- [ ] Search by ID works
- [ ] Search by text (fuzzy, accent-insensitive) works
- [ ] Frame mode shows all text nodes, with a linked/out-of-date/unmatched summary
- [ ] Link/unlink works (name suffix, text, canvas badge)
- [ ] Manual link by multilanId verifies and links
- [ ] Language switching works (selection scope vs page scope)
- [ ] ###var### templates stay in template form
- [ ] Auto-unlink detects modified text
- [ ] Out-of-date badge appears after a newer upload, and **Update** applies per node
- [ ] Canvas badges group under "Multilan IDs" and respect Badge side
- [ ] Highlight unlinked steps through nodes one at a time
- [ ] Preview mode (no edit rights) hides editing controls
- [ ] Toast notifications appear for uploads
