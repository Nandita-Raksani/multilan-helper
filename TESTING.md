# Multilan Helper Plugin - Testing Guide

## Loading the Plugin in Figma

1. Open Figma Desktop App
2. Open any file (or create a new one)
3. Go to **Plugins** > **Development** > **Import plugin from manifest...**
4. Navigate to this folder and select `manifest.json`
5. Run the plugin: **Plugins** > **Development** > **Multilan Helper**

---

## NEW: Search Tab (Design-First Workflow)

The **Search** tab is now the default tab. Use it to find translations before adding them to your design.

### How to Use

1. Open the plugin - you'll land on the **Search** tab
2. Type in the search box:
   - Search by **multilanId**: `10001`, `10009`, etc.
   - Search by **text**: `Submit`, `Cancel`, `Sett` (partial match)
3. **Hover** over any result to see the multilanId in a tooltip
4. Click **Create Text Node** to add a linked text directly to your canvas
5. Click **Copy** to copy the text to clipboard

### Test Scenarios

1. **Search by ID**: Type `10001` → Should show "Submit" with all translations
2. **Search by text**: Type `save` → Should show ID 10009 with "Save"
3. **Partial search**: Type `log` → Should show "Login successful" and "Log out"
4. **Create text**: Click "Create Text Node" → A linked text appears on canvas
5. **Hover tooltip**: Hover any result → Should show "ID: 10001" tooltip
6. **Layer name**: Check Layers panel → Node should be named `Submit [10001]`

### MultilanId in Layer Names

When you link or create a text node, the **multilanId appears in the layer name**:

- Before linking: `Submit`
- After linking: `Submit [10001]`

This is visible:
- In the **Layers panel** (left sidebar)
- When **hovering** over the layer in the layers list
- When **selecting** the node (shows in properties panel)

---

## Sample Text Nodes for Testing

Create text layers in Figma with these exact texts to test **Auto-Link** (exact matching):

| Text to type        | Will match ID |
|---------------------|---------------|
| Submit              | 10001         |
| Cancel              | 10002         |
| Welcome             | 10003         |
| Username            | 10004         |
| Password            | 10005         |
| Save                | 10009         |
| Delete              | 10010         |
| Settings            | 10011         |
| Profile             | 10012         |
| Search              | 10014         |
| Home                | 10015         |
| Back                | 10016         |
| Next                | 10017         |
| Loading...          | 10018         |
| Success!            | 10020         |

For fuzzy matching, try similar text like:
- "Submitting" (partial match for "Submit")
- "Username field" (partial match)
- "Save changes" (contains "Save")

---

## Test Scenarios

### 1. Test Create Tab (MultilanId First Workflow)

1. Open the plugin and click the **Create** tab
2. **Valid ID lookup:**
   - Enter `10001` in the multilanId field
   - Should show all translations (EN: Submit, FR: Soumettre, etc.)
   - Click "Copy" buttons to test clipboard copy

3. **Invalid ID / Placeholder:**
   - Enter `99999` (doesn't exist)
   - Should show "ID not found" message
   - Select a text layer in Figma
   - Enter placeholder text (e.g., "New Button")
   - Click "Mark as Placeholder"
   - The text should turn **orange** and show "Placeholder" badge

### 2. Test Placeholder Visual Indicator

1. Create a placeholder (see above)
2. In the **Texts** tab, verify:
   - Node shows orange background highlight
   - "Placeholder" badge appears next to the name
3. Select the placeholder node and go to **Link** tab
4. Search and link it to a real ID (e.g., search "Submit")
5. Verify:
   - Text color returns to normal (original)
   - Placeholder badge disappears

### 3. Test Bulk Auto-Linking

1. Create 5-10 text layers with mixed content:
   - Some matching translations exactly: "Submit", "Cancel", "Save"
   - Some with partial matches: "Submit button", "Cancel order"
   - Some completely unrelated: "Random text xyz"

2. Open the plugin, go to **Texts** tab
3. Click **Auto-Link All** button
4. In the modal, verify:
   - **Exact matches** section shows nodes with exact text
   - **Possible matches** section shows fuzzy suggestions
   - **No matches** section shows unmatched nodes

5. Click **Apply Exact Matches** to auto-link all exact matches
6. For fuzzy matches, click **Link** or **Skip** per suggestion
7. Close modal and verify text list updated correctly

### 4. Test Language Switching

1. Link several text nodes to multilanIds
2. Click language buttons (EN, FR, NL, DE)
3. Verify linked text nodes update to the selected language
4. Check that unlinked nodes remain unchanged

---

## Available Translation IDs

| ID    | EN                     | FR                           |
|-------|------------------------|------------------------------|
| 10001 | Submit                 | Soumettre                    |
| 10002 | Cancel                 | Annuler                      |
| 10003 | Welcome                | Bienvenue                    |
| 10004 | Username               | Nom d'utilisateur            |
| 10005 | Password               | Mot de passe                 |
| 10006 | Login successful       | Connexion réussie            |
| 10007 | This field is required | Ce champ est obligatoire     |
| 10008 | Hello {username}       | Bonjour {username}           |
| 10009 | Save                   | Enregistrer                  |
| 10010 | Delete                 | Supprimer                    |
| 10011 | Settings               | Paramètres                   |
| 10012 | Profile                | Profil                       |
| 10013 | Log out                | Déconnexion                  |
| 10014 | Search                 | Rechercher                   |
| 10015 | Home                   | Accueil                      |
| 10016 | Back                   | Retour                       |
| 10017 | Next                   | Suivant                      |
| 10018 | Loading...             | Chargement...                |
| 10019 | Error occurred         | Une erreur s'est produite    |
| 10020 | Success!               | Succès !                     |

---

## Quick Test Checklist

- [ ] Plugin loads without errors
- [ ] Create tab: Valid ID shows translations with copy buttons
- [ ] Create tab: Invalid ID shows placeholder creation form
- [ ] Placeholder: Text turns orange when marked as placeholder
- [ ] Placeholder: Badge appears in Texts list
- [ ] Placeholder: Linking to real ID restores original color
- [ ] Auto-Link: Modal shows exact/fuzzy/unmatched sections
- [ ] Auto-Link: Apply Exact Matches links correct nodes
- [ ] Auto-Link: Fuzzy suggestions can be accepted/skipped
- [ ] Language switching works for linked nodes
