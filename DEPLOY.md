# Deploying **Squarespace ID Finder+** to the Chrome Web Store

This guide walks you from a folder of files to a published, installable Chrome
extension. Budget ~30 minutes for the first submission; Google review typically
takes anywhere from a few hours to a few business days.

---

## 0. What's in this folder

```
squarespace-id-finder/
├── manifest.json      # extension config (Manifest V3)
├── background.js      # service worker – keeps the toolbar badge in sync
├── popup.html         # the dropdown panel (opens on icon click)
├── popup.css          # panel styles
├── popup.js           # panel logic – master switch, toggles, injects overlay
├── content.js         # the overlay logic (scans page, draws labels)
├── content.css        # overlay label styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon512.png    # source art (not shipped, handy for the store listing)
├── DEPLOY.md          # this file
└── README.md
```

---

## 1. Test it locally first (always do this before publishing)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this `squarespace-id-finder` folder.
4. Pin the extension (puzzle-piece icon → pin), open any Squarespace site, and
   click the toolbar icon. The panel should drop down; flipping a toggle should
   make labels appear on the page.
5. After any code change, return to `chrome://extensions` and click the
   **↻ reload** button on the extension card.

> If nothing appears, open the page's DevTools console to check for errors, and
> right-click the popup → *Inspect* to debug the panel itself.

---

## 2. Create the upload ZIP

The Web Store wants a ZIP whose **manifest.json sits at the root** (not inside a
nested folder).

From a terminal:

```bash
cd "/Users/sam/Squarespace/squarespace-id-finder"
# Exclude docs, the source art, and macOS cruft. Ship only what runs.
zip -r ../squarespace-id-finder-upload.zip . \
  -x "*.DS_Store" -x "DEPLOY.md" -x "README.md" -x "icons/icon512.png"
```

This produces `squarespace-id-finder-upload.zip` one level up. Double-check it
by unzipping into a temp folder — `manifest.json` must be at the top level.

**Bump `version` in `manifest.json` for every new upload** (e.g. `1.0.0` →
`1.0.1`). The store rejects a re-upload with an unchanged version.

---

## 3. Register as a Chrome Web Store developer (one-time)

1. Go to the **[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)**.
2. Sign in with the Google account you want to own the listing.
3. Pay the **one-time US $5 registration fee** (covers up to 20 extensions).
4. Accept the developer agreement. If you'll ever charge money, also set up a
   verified contact email and (optionally) a merchant account.

---

## 4. Create the listing & upload

1. In the dashboard click **Add new item**.
2. Upload `squarespace-id-finder-upload.zip`. Fields auto-fill from the manifest.
3. Fill in the **Store listing** tab:
   - **Description** – what it does and how to use it (one click on the icon).
   - **Category** – *Developer Tools*.
   - **Language** – English.
   - **Screenshots** – at least one **1280×800** or **640×400** PNG/JPG. Take a
     screenshot of the overlay running on a real Squarespace page. This is the
     single biggest driver of installs — make it clear.
   - **Small promo tile** – 440×280 (optional but recommended).
   - **Store icon** – 128×128 (use `icons/icon128.png`).

---

## 5. Privacy & permissions (this is where submissions get held up)

On the **Privacy practices** tab:

- **Single purpose** – e.g. *"Reveals and copies Squarespace page, section and
  block IDs, block class names, and image URLs on the page you're viewing."*
- **Permission justifications:**
  - `activeTab` – *"Read the current tab's DOM only after the user opens the
    panel, to find Squarespace IDs on that page."*
  - `scripting` – *"Inject the overlay script/styles into the active tab when
    the user opens the panel."*
  - `storage` – *"Remember which label types the user has toggled on/off, saved
    locally on their own device."*
- **Data usage** – tick **does not collect user data**. `storage` is used only
  for the user's own on/off preferences and never leaves the device: no
  analytics, no network calls, nothing sent off-device. Declare that honestly
  and fill the required data-handling certifications.
- **Host permissions** – none are requested (we rely on `activeTab`), which
  keeps review fast and avoids the broad-host-permission warning.

---

## 6. Submit for review

1. Choose **visibility**: *Public*, *Unlisted* (only people with the link), or
   *Private* (specific testers). *Unlisted* is a good soft-launch choice.
2. Click **Submit for review**.
3. You'll get an email when it's approved or if changes are requested. Approved
   items go live automatically (unless you set a manual publish).

---

## 7. Publishing updates later

1. Make your changes and **bump `version`** in `manifest.json`.
2. Rebuild the ZIP (step 2).
3. Dashboard → your item → **Package** tab → **Upload new package** → resubmit.
4. Existing users auto-update within a few hours of approval.

---

## Troubleshooting the review

- **"Permissions not justified"** – tighten the wording in step 5; make each
  justification concrete and user-facing.
- **"Requesting more permissions than needed"** – we only ask for `activeTab`
  and `scripting`; don't add `<all_urls>` or `tabs` unless truly required.
- **Rejected for metadata** – usually a low-quality screenshot or a description
  that doesn't match behavior. Fix and resubmit; it doesn't count against you.

---

### Quick reference

| Item | Value |
|------|-------|
| Manifest version | 3 |
| Permissions | `activeTab`, `scripting`, `storage` |
| Host permissions | none |
| Registration fee | US $5 (one-time) |
| Store category | Developer Tools |
| Store icon | 128×128 |
| Screenshot | 1280×800 or 640×400 |
