# Multilan Helper — User Guide

A guide for designers using the **Multilan Helper** plugin in Figma. No technical
knowledge needed. If you are looking for the code documentation instead, see
[README.md](./README.md).

---

## What this plugin is for

Every piece of text in our products exists in four languages — English, French,
Dutch and German — and each one has an **ID number** (a *multilanId*, e.g. `10001`).
The translation team maintains those texts; designers have to make sure the words in
a Figma mockup are the *real* words, in every language.

Multilan Helper connects the two. It lets you:

- look up any official text by its ID or by what it says, in all four languages;
- **link** a Figma text layer to its ID, so everyone knows which text it is;
- flip a screen (or a whole page) between EN / FR / NL / DE in place;
- see when a text has **changed in a newer translation release**, and update it;
- show the ID next to each layer on the canvas, so developers and reviewers can
  read them without installing anything.

---

## Words you will see

| Term | What it means |
|---|---|
| **multilanId** | The number that identifies one piece of text across all four languages — e.g. `10001` is "Submit" / "Soumettre" / "Indienen" / "Einreichen". |
| **Release .zip** | The file the translation team publishes (e.g. `EB_Release_PROD_2026-03-25.zip`). It contains one `.tra` file per language. This is what you load into the plugin. |
| **Folder (EB / EBB / PCB)** | The product the texts belong to. Each has its own release file and its own set of IDs. |
| **Linked layer** | A Figma text layer that has been tagged with a multilanId. Its layer name gets the ID added at the end, like `Button label • 10001`. |
| **Badge** | The small green label the plugin draws on the canvas next to a linked layer, showing its ID. |
| **Out of date** | The layer is still linked, but the translation team has since changed the wording of that ID. |

---

## 1. Open the plugin

In Figma: **Plugins → Multilan Helper**.

The panel opens on the right. You can:

- **resize** it by dragging the bottom-right corner (handy on a second screen);
- **collapse** it to just its title bar with the small arrow in the top-right —
  useful when you want the canvas back but don't want to lose your place.

---

## 2. Load a translation release (do this first)

The plugin ships empty. It only knows the texts you give it.

1. At the top of the panel, click the product folder you need: **EB**, **EBB** or **PCB**.
2. A window opens: **drop the release `.zip` file** onto it, or click **Choose .zip file**.
3. Click **Upload**. A message confirms, for example *"Loaded 1 240 translations for EB"*.

A few things worth knowing:

- **Drop the `.zip`, not the individual `.tra` files.** The plugin will tell you if
  you try the loose files. Keep the zip exactly as the translation team sent it —
  its name (with the release date) is remembered and shown later.
- A folder that already has data shows a **small dot** on its button. Hover a folder
  button to see when it was last uploaded and from which zip.
- **The upload is yours alone.** It is stored on your machine, for you. Your
  teammates each need to upload the release once themselves. What *is* shared is the
  work you do in the file — the links and the canvas badges live in the Figma file
  and everyone sees them.

### Getting a newer release

When the translation team publishes an update, click the folder button that is
**already active** — the upload window opens again. Drop in the new zip and upload.
Any linked layers whose wording changed will now show **Out of date** (see §5).

### Missing languages

A release may not contain all four languages. Language buttons you have no data for
stay greyed out. Upload a zip containing them and they light up.

---

## 3. Link a text layer to its translation

Linking is what makes everything else work: language switching, update checks and
the canvas badges all apply to *linked* layers only.

> **Pick your working language first** (EN / FR / NL / DE at the top). When you link
> a layer, the plugin writes the official text **in the language currently selected**
> into that layer.

### The usual case — one layer

1. Select a text layer on the canvas.
2. The panel shows the text you selected, and underneath it what the plugin found:

| What you see | What it means | What to do |
|---|---|---|
| **Linked** (green) | The layer already has an ID. | Nothing — or **Unlink** to remove it. |
| **Match** (green) | The text is exactly one of the official texts. | Click **Link**. If several IDs share the same wording (common for words like "From"), use the ‹ › arrows to pick the right one. |
| **No exact match** | The wording is not in the release, character for character. | Click **Find close match** — see below. |

3. **Find close match** searches for near-identical texts and shows them with a
   similarity score (e.g. *92%*). Browse them with the ‹ › arrows and click **Link**
   on the right one.

### When you already know the ID

On any unlinked layer, click **Link by multilanId**, paste the number, and press
**Verify**. The plugin shows you the four translations for that ID so you can check
it is the right one, then click **Link**.

### A whole screen at once

Select a **frame** (or several text layers). The panel switches to a list of every
visible text layer inside it, each with its own card and its own buttons — link,
unlink, find close match, link by ID.

- The header summarises the screen: *"12 linked, 2 out of date, 3 unmatched"*.
- Clicking a card selects and zooms to that layer on the canvas, so you always know
  which text you are looking at.
- Hidden layers are ignored on purpose — they are usually another state of the
  screen and would only add noise.

### Searching the release

The search box finds any text in the loaded release, whether or not you have
something selected. Type an **ID** (`10001`) or **any part of the wording**
(`submit appl`). Accents, apostrophes and capitals don't matter — *"operation"*
finds *"opération"*. Each result shows all four languages, and the copy button next
to the ID copies it to your clipboard.

---

## 4. Switch the language of a design

Use the **EN / FR / NL / DE** buttons at the top.

- **Nothing selected on canvas → the whole page changes.**
- **Something selected → only that selection changes** (a frame, a group, or a few
  layers).

Only linked layers change; everything else is left alone. If an ID has no
translation in the language you picked, that layer shows
`*Multilan not available*` so the gap is visible rather than silent.

Texts that contain a variable — like `Hello, ###name###!` — keep the `###…###`
marker when the language changes. That marker is part of the official text: leave it
in place, it is what the real application fills in.

---

## 5. Keep text up to date after a new release

When you upload a newer release, wording sometimes changes for an ID you already
used in your designs. Those layers keep their link and get an amber **Out of date**
badge, in the layer's card and in the frame summary.

To fix one, click the amber **⟳ Update** button on that layer's card. The layer text
is replaced with the current wording from the release.

**This is deliberately one layer at a time.** There is no "update everything"
button: a wording change can break a layout, push a button label onto two lines, or
change a screen's meaning. You decide, layer by layer, and you see each result on
the canvas as you go.

---

## 6. Find the text you haven't linked yet

Select a frame and click **Highlight unlinked** (top-right, next to the language
buttons). The plugin collects every text layer in the selection that has no ID and
walks you through them **one at a time**, selecting each on the canvas so you can
link it right away. The status line at the bottom tells you how many are left.

Click the button again (**Hide unlinked**) to stop.

---

## 7. The ID badges on the canvas

When you link a layer, the plugin draws a small **green badge with its ID** just
outside the frame, joined to the layer by a dashed line. This is the part everyone
else benefits from: developers, reviewers and translators can read the IDs straight
from the file, without the plugin and without a full Figma seat.

- Badges are created, moved and removed automatically as you link and unlink.
- They live together in one layer group called **Multilan IDs**. Hide that group
  (the eye icon in Figma's layer list) when you want a clean screenshot, and show it
  again afterwards.
- If a badge sits awkwardly over other content, use **Badge side** on the layer's
  card: **Auto** (the plugin decides), **Left** or **Right**.
- Don't edit or move the badge text by hand — the plugin owns those layers and will
  redraw them.

---

## 8. Who can do what — designers, developers, everyone else

The plugin behaves differently depending on **which Figma editor it is opened in**,
not on your job title:

### 1. Designers — full seat, Figma's design editor

Everything in this guide. Load releases, link and unlink, switch languages, update
out-of-date text, move badges, walk through unlinked layers. **This is the only mode
where the plugin writes anything into the file** — every link, every badge and every
translation on the canvas is put there by someone working in design mode.

### 2. Developers — dev seat, Figma Dev Mode

In Dev Mode the plugin opens **read-only**. A banner at the top says *"Preview Mode
— Browse translations and copy text"*, and every button that would change the file
is hidden. What you get is a translation reference sitting next to the design:

- **search the release** by ID or by wording, and read all four languages side by side;
- **select a layer** to see which multilanId it is linked to and what that ID says in
  EN / FR / NL / DE;
- **select a frame** to get the same list for every text layer in the screen, including
  which ones are still unlinked;
- **see the amber "Out of date" flag** — you can tell that a text has changed in a
  newer release, even though only a designer can apply the change;
- **copy anything**: the ID, and each individual translation — the per-language copy
  buttons appear only in this read-only mode;
- **upload a release zip** yourself, so you're reading against the release you care
  about.

Not available in Dev Mode: linking and unlinking, switching languages, updating
out-of-date text, badge side, and highlight-unlinked. Those all write to the file.

And of course the two things already *in* the file are right there in Dev Mode
without touching the plugin: the **green ID badge** on the canvas, and the **layer
name** ending in its ID — `Button label • 10001`.

### 3. Everyone else — no dev seat and no full seat

**The plugin isn't available at all.** No panel, no search, no translations.

What these people *can* still see is the work designers already did, because it is
ordinary content in the file: the **green ID badges** on the canvas and the
**`• 10001` suffix** on every linked layer name. That's enough to read which text is
which, quote an ID in a ticket or a translation request, and tell at a glance which
layers have been checked against the official copy and which haven't.

To look a text up in the other three languages, they need someone with a seat — or
the ID, which they can read off the badge.

### At a glance

| | Designer<br>(full seat) | Developer<br>(dev seat, Dev Mode) | No seat |
|---|---|---|---|
| Plugin available | ✅ full | ✅ read-only | ❌ |
| See which layers are linked, and their IDs | ✅ panel + canvas | ✅ panel + canvas | ✅ canvas badge + layer name |
| Read all four translations | ✅ | ✅ | ❌ |
| Search the release | ✅ | ✅ | ❌ |
| Copy an ID | ✅ | ✅ | ✅ from the badge / layer name |
| Copy a single translation | — | ✅ | ❌ |
| See that a text is **Out of date** | ✅ | ✅ | ❌ |
| Upload a release zip | ✅ | ✅ | ❌ |
| Link / unlink layers | ✅ | ❌ | ❌ |
| Switch EN / FR / NL / DE | ✅ | ❌ | ❌ |
| Update out-of-date text | ✅ | ❌ | ❌ |
| Change badge side | ✅ | ❌ | ❌ |
| Highlight unlinked layers | ✅ | ❌ | ❌ |
| Hide the **Multilan IDs** badge group | ✅ (Figma layer visibility) | ❌ | ❌ |

---

## 9. What the plugin does on its own

- **A layer whose text you retyped by hand gets unlinked.** When you edit a linked
  layer's wording yourself, it no longer matches the official text, so the next time
  the plugin opens it removes the link and tells you (*"Auto-unlinked 2 modified
  nodes"*). Link it again to whatever it should be. This is different from *Out of
  date*, which is the release changing, not you.
- **Badges are kept in sync** with the links each time the plugin opens.
- **Hidden layers are skipped** everywhere — lists, search, highlighting.
- **The plugin's own badge labels are ignored** — they never show up as text to link.

---

## 10. Troubleshooting

| What you see | Why | What to do |
|---|---|---|
| Language buttons are greyed out | No release loaded for this folder, or that language wasn't in the zip. | Click the folder button and upload the release zip. |
| "No exact match" on a text you know exists | The exact-match check is strict — one different character, an extra space or a different apostrophe is enough. | Click **Find close match**, or search for part of the wording. |
| `*Multilan not available*` appears on the canvas | That ID has no translation in the language you switched to. | Check with the translation team; switch back to a language that has it. |
| A layer lost its link on its own | Its text was edited by hand. | Link it again (§3). |
| **Out of date** won't go away | The update only applies when you click **⟳ Update** on that layer. | Click it on each layer you want to update (§5). |
| A colleague sees no translations | Uploads are per person. | They open the plugin and upload the release zip once (§2). |
| Green badges everywhere on the canvas | That's the ID annotation layer group. | Hide the **Multilan IDs** group in Figma's layer list (§7). |
| Nothing happens when clicking a language | Nothing on the page is linked, or you have view-only rights. | Link some layers first (§3), or ask for edit rights. |

---

## Quick reference

**Badges**

| Badge | Meaning |
|---|---|
| **Linked** (green) | The layer is tagged with a multilanId. |
| **Match** (green) | The layer's text is exactly an official text, not yet linked. |
| **Close Match** (amber, with %) | A similar official text, found on request. |
| **Out of date** (amber) | Linked, but the release now has different wording. |
| **No match** (red) | Nothing similar found in the loaded release. |

**Buttons**

| Button | What it does |
|---|---|
| **Link** | Tags the layer with that ID and writes the official text in the current language. |
| **Unlink** | Removes the ID and its canvas badge. Text stays as it is. |
| **⟳ Update** | Replaces the layer text with the current wording from the release. |
| **Link by multilanId** | Link using an ID you already know. |
| **Find close match** | Look for near-identical official texts. |
| **Highlight unlinked** | Step through unlinked text layers in the selection. |
| **Badge side** | Which side of the frame this layer's ID badge sits on. |
| **EN / FR / NL / DE** | Switch the language of the selection, or of the whole page when nothing is selected. |
