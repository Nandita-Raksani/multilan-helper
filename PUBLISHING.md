# Publishing Multilan Helper Plugin

## Step 1: Get Your Plugin ID

1. Go to [Figma](https://www.figma.com) and open any file
2. Click the **Figma menu** (top-left) > **Plugins** > **Manage plugins...**
3. Click **"+ Create new plugin"** (or go to your [plugin dashboard](https://www.figma.com/developers/plugins))
4. Enter plugin name: `Multilan Helper`
5. Click **"Create plugin"**
6. Copy the **Plugin ID** shown (a long number like `1234567890123456789`)

## Step 2: Update manifest.json

Replace `REPLACE_WITH_YOUR_PLUGIN_ID` in `manifest.json` with your actual plugin ID:

```json
{
  "name": "Multilan Helper",
  "id": "1234567890123456789",
  ...
}
```

## Step 3: Build the Plugin

```bash
npm run build
```

This produces:
- `dist/code.js` — Plugin sandbox code (~47KB)
- `dist/ui.html` — Plugin UI (HTML + CSS + JS bundled)

## Step 4: Test Locally

1. In Figma: **Plugins** > **Development** > **Import plugin from manifest...**
2. Select the `manifest.json` file
3. Test all features:
   - Upload .tra files for a folder
   - Search translations
   - Link/unlink text nodes
   - Switch languages

## Step 5: Publish

### Option A: Publish to Figma Community (Public)

1. Go to your [plugin dashboard](https://www.figma.com/developers/plugins)
2. Find your plugin and click **"Publish"**
3. Fill in required info:
   - **Description**: Manage multilingual text translations in Figma
   - **Icon**: Upload a 128x128 PNG icon
   - **Cover image**: 1920x960 PNG recommended
   - **Tags**: localization, translation, i18n, text
4. Submit for review (usually 1-3 days)

### Option B: Share Within Organization (Private)

1. Go to your [plugin dashboard](https://www.figma.com/developers/plugins)
2. Click **"Share"** on your plugin
3. Choose **"Organization only"**
4. Team members can find it under **Plugins** > **Organization plugins**

## File Checklist for Publishing

- [x] `manifest.json` — Plugin configuration
- [x] `dist/code.js` — Compiled plugin code
- [x] `dist/ui.html` — Plugin UI (self-contained)
- [ ] `icon.png` — 128x128 plugin icon (you need to create this)
- [ ] `cover.png` — 1920x960 cover image (optional but recommended)

## Notes

- **No bundled translations**: Users upload their own `.tra` files at runtime
- **Per-user storage**: Each user's uploaded files are cached locally
- **No network access**: The plugin runs entirely offline (`networkAccess: "none"`)
- **Free Figma accounts**: Can use published plugins from Community
- **Paid seats**: Required to use organization-shared plugins
- **Dev mode**: Only you can see plugins imported from manifest
