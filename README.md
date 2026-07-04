# Squarespace ID Finder+

A tiny, friendly Chrome extension for Squarespace. Click the toolbar icon to open
a small panel, flip on what you want to see, then **click any tag on the page to
copy it** — page IDs, section IDs, block IDs, block class names, and image URLs.
Built to be usable by anyone, no code knowledge required.

Perfect for writing targeted Custom CSS / code injection without digging through
DevTools.

## What you can reveal & copy

| Toggle | Copies | Example |
|--------|--------|---------|
| **Page ID** *(on by default)* | the page/collection selector | `#collection-6890fa04…` |
| **Section IDs** *(on by default)* | the section selector | `[data-section-id="689127fd…"]` |
| **Block IDs** *(on by default)* | the block selector | `#block-yui_3_17_2_1_…` |
| **Block class names** | the Fluid-Engine wrapper class | `.fe-block-yui_3_17_2_1_…` |
| **Image URLs** | the raw CDN image URL (sizing query stripped) | `https://images.squarespace-cdn.com/…` |

Every value is shown **in full** (never truncated) and uses one consistent color;
the small tag word (PAGE / ID / SECTION / BLOCK / CLASS / IMAGE) tells you what it
is.

**Search.** A search box in the panel filters everything at once — type any part
of a block id, section id, `.fe-block-…` class, or image URL. Matches are listed
in the panel (click to copy) and the on-page overlay narrows to just those
elements, so you can locate one selector among hundreds.

**Section colour themes** *(toggle, off by default)* — labels each section with
its Squarespace colour-theme name (e.g. `white-bold`, `black`) plus swatches for
the theme's background and text colours.

**Contrast (WCAG)** *(toggle, off by default)* — a per-section badge showing the
theme's text-vs-background contrast ratio with AA / AAA pass or fail (green /
red). It reads the section's computed text colour and its `--siteBackgroundColor`
theme variable, and skips sections whose background is an image/video (contrast
over media can't be judged from CSS).

**Site theme.** The panel also reads the site's theme straight from the page and
shows it (independent of the on-page labels):

- **Site colours** — the 5-colour palette (White, Black, Light accent, Dark
  accent, Accent) as swatches; click one to copy. A **Hex / RGB / HSL** toggle
  chooses the copy format (all three are valid in Squarespace).
- **Fonts** — the **Heading**, **Body**, and **Miscellaneous** font families;
  click one to copy the font name.
- **Custom fonts on this page** — any other font families actually loaded on the
  page (detected via the `FontFaceSet` API), beyond the theme fonts and
  Squarespace's system/icon fonts. These are fonts added on top, e.g. via Custom
  CSS / code injection or an uploaded font used directly.

The theme colours/fonts come from Squarespace's CSS variables
(`--{white,black,lightAccent,darkAccent,accent}-hsl` and
`--{heading,body,meta}-font-font-family`); custom fonts come from `document.fonts`.

> **Uploaded vs. custom-coded:** whether a custom font was *uploaded* to
> Squarespace or *added via code* is stored in the `@font-face` rule inside
> Squarespace's cross-origin CSS, which the extension can't read without broad
> host permissions. So custom fonts are detected and listed, but not definitively
> labelled by source.

**Custom section IDs.** If a section has an ID set in the editor (e.g.
`first-section`), it's shown as a second box beside the section selector, so the
first section reads `[ ID #first-section ] [ SECTION [data-section-id="…"] ]`.
Only real sections (24-char hex `data-section-id`s) are labelled — Squarespace's
`header` / `overlay-nav` regions and framework-generated ids are skipped.

**Only what's on screen.** Labels appear only for elements that are actually
visible right now. Content hidden in an inactive tab, a collapsed accordion, or a
hover-reveal panel gets no label until you reveal it — then its label appears
instantly. Nothing is pinned; labels scroll away with their element.

## How to use

1. Install (see below) and pin the extension.
2. Open any Squarespace site.
3. Click the toolbar icon — a panel drops down.
4. The **Show IDs on page** master switch at the top turns the whole overlay on
   or off. Below it, the panel shows the **page ID** with a Copy button and a
   toggle switch for each label type. Page, Section and Block are on by default;
   flip on Block class names or Image URLs when you need them.
5. On the page, **click any tag** to copy its value (it flashes “Copied!”).
6. Hover a tag to highlight the exact element it points to.
7. While IDs are showing, a small dot appears on the toolbar icon so you can see
   at a glance that the overlay is on. Flip the master switch off (or reload the
   page) to clear it.

## Install for local use / development

1. Go to `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open a Squarespace page and click the icon.

Reload the extension card after any code change.

## Publishing to the Chrome Web Store

See **[DEPLOY.md](DEPLOY.md)** for the full step-by-step guide.

## Privacy

Everything runs locally in your browser. The extension only reads the page you're
on, and only after you open the panel (`activeTab`). Your toggle preferences are
saved locally (`storage`). No data is collected, stored remotely, or sent
anywhere — no analytics, no network requests.

## How it works

- `popup.html` / `popup.js` / `popup.css` — the dropdown panel. It reads/writes
  your master + toggle prefs to `chrome.storage.local` and, on open, injects the
  overlay into the active tab (`chrome.scripting`). The **master switch** gates
  the whole overlay; individual toggles pick which types show while it's on.
- `background.js` — a tiny service worker that keeps the toolbar badge (the dot
  shown while IDs are on) in sync, clearing it when a tab reloads.
- `content.js` scans the DOM once for the `collection-…` page id, hex
  `[data-section-id]` sections (plus any editor-set section id), `[id^="block-"]`
  (plus each block's `.fe-<id>` wrapper class), and Squarespace-CDN `<img>`s. It
  draws fixed-position labels and shows/hides each layer based on the saved
  toggle state, re-reacting instantly when you flip a switch
  (`chrome.storage.onChanged`).
- Each label is only shown when its element passes a live visibility check
  (`element.checkVisibility({checkOpacity, checkVisibilityCSS})` + a non-zero,
  in-viewport rect), re-evaluated on scroll / resize / hover / click /
  transition so labels track reveals in real time.
- `content.css` styles the labels — single color, full values, high z-index so it
  floats above the host site without inheriting its styles.

## Tech notes

- Manifest V3, no build step, no dependencies.
- The block class name is derived as `.fe-` + the block id, which is exactly the
  Fluid-Engine wrapper class Squarespace puts on each block's parent
  (`#block-X` ⟶ parent `.fe-block-X`) — verified against live markup.
- Labels use `position: fixed` and are repositioned via `requestAnimationFrame`;
  they are never vertically clamped, so they scroll away naturally (nothing
  sticks to the viewport). The page label is anchored to the document top and
  centered so it doesn't collide with the top-left section labels.
- All overlay DOM/CSS is namespaced with `sqsf-`.
