# BDJobs Auto-Fill (Chrome Extension)

A **generic** auto-fill extension for **any** job-application form (BDJobs, BOGMC /
Petrobangla, private company career pages — anything with a web form). It is a
**template**: you capture the fields from a page, edit them manually, save them
into a **profile**, and refill with one click. Supports **multiple profiles** and
**JSON import / export**.

## Install (load unpacked)

1. Open Chrome (or any Chromium browser) → `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** → select this `bogmc-autofill` folder.
4. (Optional) Pin the icon to the toolbar.

> The folder name doesn't matter; the extension name is **BDJobs Auto-Fill**.

## How to use

1. Open the job application form in a tab.
2. Click the extension icon.
3. **Capture from page** — it scans the form and lists every fillable field
   (with a CSS locator, current value, and field type).
4. Edit the **values** (and locators/names if you like). Blank rows are ignored.
5. **Save profile**. Create more profiles with **＋** and switch via the dropdown.
6. **Fill form ↧** (popup) or the red **⚡ BDJobs Auto-Fill** button on the page.
7. Review, type the **Captcha** manually, and submit.

## What a profile looks like

Each profile is just a list of field mappings:

```json
{
  "fields": [
    { "key": "Applicant Name", "locator": "#name",        "value": "MD. KARIM", "type": "text" },
    { "key": "District",       "locator": "#present_district", "value": "Dhaka", "type": "select" },
    { "key": "Upazila",        "locator": "#present_upazila",  "value": "Rampura", "type": "select" },
    { "key": "Agree",          "locator": "#agree",        "value": "true", "type": "checkbox" }
  ]
}
```

- **key** — a friendly label you choose.
- **locator** — how to find the element on the page. Usually `#id` or
  `[name="..."]`. Capture fills this in automatically; you can edit it.
- **value** — what to put in the field. For `select`, use the option **text**
  (e.g. `"Dhaka"`, `"GPA(out of 5)"`, `"Male"`); for `checkbox`/`radio` use
  `true` / the option value.
- **type** — `text`, `select`, `checkbox`, or `radio`.

## Features

- **Generic** — no hardcoded site. Works wherever there's a `<form>`.
- **Capture** — auto-detects inputs/selects/textareas, their best locator, label,
  and current value, so you rarely type locators by hand.
- **Manual edit & save** — every field is editable and stored in the profile.
- **Multiple profiles** — switch the active one from the dropdown.
- **Dependent dropdowns** — after setting a value the extension waits briefly,
  so parent→child selects (District→Upazila, Exam→Group, Result→GPA) resolve in
  capture order.
- **JSON Import / Export** — back up all profiles, or import a full backup / a
  single profile object (merged by name).
- **Raw JSON** tab — edit the whole profile as JSON if you prefer.
- **Floating button** — appears on any page that has a form.

## Import / Export format

Export produces:

```json
{
  "_type": "bdjobs-profiles",
  "active": "BOGMC Example",
  "profiles": { "BOGMC Example": { "fields": [ ... ] } }
}
```

A single exported profile (or any object with a `fields` array) is also accepted
on import.

## Notes & limitations

- **Captcha and file uploads (photo, CV) cannot be auto-filled** — do those
  manually. Custom (JS-built) dropdowns that aren't native `<select>` elements may
  also need manual entry.
- Fields the server has already **locked/verified** can't be overwritten.
- Always **review the preview** before final submission.
- For sites with very unusual markup, use **Capture**, then tweak the **locator**
  of any row that didn't fill.
