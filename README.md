# BDJobs Auto-Fill — Chrome Extension

**BDJobs Auto-Fill** is a generic, template-based auto-fill extension for **any**
job-application form on the web (BDJobs, BOGMC / Petrobangla, private company
career pages — anything with an HTML form). Instead of hard-coding one site, it
lets you **capture the fields from any page, edit them manually, save them into a
profile, and refill with one click**. It supports **multiple profiles** and
**JSON import / export**, making it reusable across sites and across applications.

> Tagline: *Fill once, save the profile, auto-fill every time.*

---

## ✨ Features

- **Works on any site** — no per-site coding. `host_permissions` is `<all_urls>`.
- **Capture & Save** — fill the form by hand once, click *Capture & Save*, and the
  extension stores every field (name, locator, value, type) into the active profile.
- **One-click Fill** — *Fill form* (popup) or the floating **⚡ BDJobs Auto-Fill**
  button on the page auto-fills everything.
- **Multiple profiles** — switch the active profile from the dropdown; each is
  stored separately in `chrome.storage.local`.
- **Manual field editing** — every field is an editable card (Field name, Value,
  Type). Add / delete rows freely. The internal CSS locator (`#id`) is auto-filled
  and hidden; expand *Locator* only when a field fails to fill.
- **Dependent dropdowns handled** — after setting a value the extension waits, so
  parent→child selects (District→Upazila, Exam→Group, Result→GPA) resolve in the
  captured order. Slow AJAX-driven lists are retried until options appear.
- **JSON Import / Export** — back up all profiles, or import a full backup / a
  single profile object (merged by name).
- **Raw JSON editor** — edit the whole profile as JSON if you prefer.

---

## 📦 Install (load unpacked)

1. Open Chrome (or any Chromium browser) → `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** → select this `bogmc-autofill` folder (the folder that
   contains `manifest.json` directly).
4. (Optional) Pin the icon to the toolbar.

The extension icon will appear in `chrome://extensions` and on the toolbar.

---

## 🚀 How to use

1. Open the job-application form in a tab.
2. Click the extension icon, pick or create a **profile** (＋).
3. **Fill the form manually** on the site, then click **Capture & Save** — it reads
   the current page and stores all fields into the profile.
4. (Optional) Switch to the **Fields** tab to review / tweak values, add fields, or
   tap *Locator* on a card to fix a field that didn't fill. Click **Save edits**.
5. Next time, open the form and click **Fill form ↧** (popup) or the floating
   **⚡ BDJobs Auto-Fill** button.
6. Review the form, type the **Captcha** yourself, and submit.

Import / Export lives under the **Import / Export** tab.

### Profile data shape

Each profile is just a list of field mappings:

```json
{
  "fields": [
    { "key": "Applicant Name", "locator": "#name", "value": "MD. KARIM", "type": "text" },
    { "key": "District", "locator": "#present_district", "value": "Dhaka", "type": "select" },
    { "key": "Agree", "locator": "#agree", "value": "true", "type": "checkbox" }
  ]
}
```

- **key** — friendly label you choose.
- **locator** — CSS selector (`#id` or `[name="..."]`) used to find the element.
- **value** — what to put in. For `select`, use the option **text** (e.g. `"Dhaka"`,
  `"GPA(out of 5)"`); for `checkbox`/`radio` use `true` or the option value.
- **type** — `text`, `select`, `checkbox`, or `radio`.

---

## ⚠️ Notes & limitations

- **Captcha and file uploads** (photo, CV) cannot be auto-filled — do those manually.
- Custom JS-built dropdowns (not native `<select>`) may need a manual locator tweak.
- Fields the server has already **locked/verified** can't be overwritten.
- Always **review the preview** before final submission.

---

## 🖼️ Logo / Icon — generation & usage guideline

Chrome Manifest V3 extensions require **PNG** icons at standard sizes
(**16, 32, 48, 128 px**). SVG is *not* supported for extension icons, so the
artwork must be rasterized.

### How the bundled logo was produced
1. **Generate** a square-ish app icon with an AI image tool (e.g. the in-product
   image generator) — prompt example:
   > *"Flat modern app icon for a Chrome extension named BDJobs Auto-Fill. A bold
   > white lightning bolt over a stylized document/form, on a rounded-square red
   > (#d8361f) background. Minimal, clean, vector style, no text, centered."*
2. **Make it square** (icons must be square). If the output is landscape, crop the
   center to a square, e.g. with ImageMagick:
   ```bash
   convert logo.png -gravity center -extent 768x768 logo_square.png
   ```
3. **Resize** to the required sizes:
   ```bash
   for s in 16 32 48 128; do
     convert logo_square.png -resize ${s}x${s} images/icon-${s}.png
   done
   ```
4. **Register** the files in `manifest.json`:
   ```json
   "icons": {
     "16":  "images/icon-16.png",
     "32":  "images/icon-32.png",
     "48":  "images/icon-48.png",
     "128": "images/icon-128.png"
   },
   "action": {
     "default_icon": {
       "16":  "images/icon-16.png",
       "32":  "images/icon-32.png",
       "48":  "images/icon-48.png",
       "128": "images/icon-128.png"
     },
     "default_popup": "popup.html"
   }
   ```
5. **Reload** the extension in `chrome://extensions` (click the reload ↻ icon) to
   pick up the new icons.

### To use your own logo
Replace the four PNGs in `images/` with the same filenames (keep the sizes), then
reload the extension. No code changes needed.

---

## 📁 Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest, permissions, icons, content script |
| `content.js` | Generic fill / capture logic running on the page |
| `popup.html` / `popup.css` / `popup.js` | Profile manager & field editor UI |
| `images/icon-*.png` | Toolbar / store icons |
| `sample_profile.json` | Example profile (43 BOGMC fields) for import |
| `README.md` | This document |
