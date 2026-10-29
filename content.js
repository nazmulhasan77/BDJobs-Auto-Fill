/* ===========================================================================
 * BDJobs Auto-Fill — Content Script (GENERIC, works on any job site)
 *
 * A profile is a list of field mappings:
 *   { key, locator, value, type }   type ∈ text|select|checkbox|radio
 *
 * Filling is generic: for each mapping we locate the element (by CSS locator,
 * id, name or label), set its value, and dispatch input/change events. A small
 * delay after each field lets dependent dropdowns (District→Upazila, etc.)
 * populate before their child is filled.
 * =========================================================================== */
(function () {
  'use strict';

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const cssEscape = (s) => String(s).replace(/"/g, '\\"');

  /* ---- events ----------------------------------------------------------- */

  function fire(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  const isTrue = (v) => v === true || v === 'true' || v === '1' || v === 'yes' || v === 'Yes' || v === 1;

  /* ---- select matching (value or text, with fuzzy fallback) ------------- */

  function setSelect(sel, value) {
    if (!sel || value === undefined || value === null || value === '') return false;
    const v = String(value).trim();
    const lower = v.toLowerCase();
    for (const o of sel.options) {
      if (o.value !== '' && o.value.toLowerCase() === lower) { sel.value = o.value; fire(sel); return true; }
    }
    for (const o of sel.options) {
      if (o.textContent.trim().toLowerCase() === lower) { sel.value = o.value; fire(sel); return true; }
    }
    let best = null;
    for (const o of sel.options) {
      const t = o.textContent.trim().toLowerCase();
      if (!t) continue;
      if (t === lower) { best = o; break; }
      if (t.includes(lower) || lower.includes(t)) {
        if (!best || t.length < best.textContent.trim().length) best = o;
      }
    }
    if (best) { sel.value = best.value; fire(sel); return true; }
    return false;
  }

  /* ---- locate an element for a mapping ---------------------------------- */

  function cssPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let sel = node.tagName.toLowerCase();
      if (node.id) { sel = '#' + node.id; parts.unshift(sel); break; }
      const parent = node.parentNode;
      if (parent && parent.children) {
        const sibs = Array.prototype.filter.call(parent.children, (c) => c.tagName === node.tagName);
        if (sibs.length > 1) sel += ':nth-child(' + (Array.prototype.indexOf.call(parent.children, node) + 1) + ')';
      }
      parts.unshift(sel);
      node = parent;
    }
    return parts.join(' > ');
  }

  function bestLocator(el) {
    if (el.id) return '#' + el.id;
    if (el.name) return '[name="' + cssEscape(el.name) + '"]';
    return cssPath(el);
  }

  function findByLabel(text) {
    text = String(text).trim().toLowerCase();
    const labels = document.querySelectorAll('label');
    for (const l of labels) {
      if (l.textContent.trim().toLowerCase().includes(text)) {
        if (l.htmlFor) { const el = document.getElementById(l.htmlFor); if (el) return el; }
        const ctrl = l.querySelector('input,select,textarea'); if (ctrl) return ctrl;
      }
    }
    const all = document.querySelectorAll('input,select,textarea');
    for (const el of all) {
      const ph = (el.placeholder || '').trim().toLowerCase();
      if (ph && ph.includes(text)) return el;
    }
    return null;
  }

  function locate(f) {
    try { if (f.locator) { const e = document.querySelector(f.locator); if (e) return e; } } catch (e) {}
    if (f.id) { const e = document.getElementById(f.id); if (e) return e; }
    if (f.name) { try { const e = document.querySelector('[name="' + cssEscape(f.name) + '"]'); if (e) return e; } catch (e) {} }
    if (f.label) { const e = findByLabel(f.label); if (e) return e; }
    return null;
  }

  /* ---- set a value on an element ---------------------------------------- */

  function guessType(el) {
    if (el.tagName === 'SELECT') return 'select';
    if (el.type === 'checkbox') return 'checkbox';
    if (el.type === 'radio') return 'radio';
    return 'text';
  }

  function setElementValue(el, value, type) {
    type = type || guessType(el);
    if (el.tagName === 'SELECT') return setSelect(el, value);
    if (el.type === 'checkbox') { el.checked = isTrue(value); fire(el); return true; }
    if (el.type === 'radio') {
      const group = document.querySelectorAll('input[type="radio"][name="' + cssEscape(el.name) + '"]');
      const want = String(value).trim().toLowerCase();
      for (const r of group) {
        if (r.value && r.value.toLowerCase() === want) { r.checked = true; fire(r); return true; }
      }
      return false;
    }
    el.value = String(value); fire(el); return true;
  }

  /* ---- main fill -------------------------------------------------------- */

  // Set a <select> and confirm it actually applied. If the option list is still
  // loading (AJAX-dependent child dropdowns), retry until it appears or we give up.
  async function setSelectRobust(el, value) {
    for (let attempt = 0; attempt < 8; attempt++) {
      if (setSelect(el, value)) {
        // ignore the empty/disabled "Select" placeholder
        if (el.value && el.value !== '') return true;
      }
      await delay(250); // wait for async option population, then retry
    }
    return false;
  }

  async function fillProfile(profile) {
    if (!profile || !Array.isArray(profile.fields)) return { ok: false, msg: 'Profile has no fields.' };
    const filled = [];
    const failed = [];
    for (const f of profile.fields) {
      if (f.value === undefined || f.value === null || f.value === '') continue; // skip blanks
      const el = locate(f);
      if (!el) { failed.push(f.key || f.locator || '?'); continue; }
      let ok;
      if (el.tagName === 'SELECT') {
        ok = await setSelectRobust(el, f.value);
      } else {
        ok = setElementValue(el, f.value, f.type);
      }
      (ok ? filled : failed).push(f.key || f.locator || '?');
      // give dependent dropdowns / handlers time to react before the next field
      await delay(el.tagName === 'SELECT' ? 250 : 50);
    }
    return { ok: true, filled, failed };
  }

  /* ---- capture current form fields ------------------------------------- */

  function friendlyName(el) {
    if (el.id) return el.id;
    if (el.name) return el.name;
    if (el.placeholder) return el.placeholder;
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    const lbl = el.closest('label');
    if (lbl) return lbl.textContent.trim();
    return '';
  }

  function captureForm() {
    const fields = [];
    const seen = new Set();
    const els = document.querySelectorAll('input, select, textarea');
    for (const el of els) {
      if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button' || el.type === 'reset' || el.type === 'image') continue;
      if (el.disabled) continue;
      const loc = bestLocator(el);
      if (!loc || seen.has(loc)) continue;
      seen.add(loc);
      const type = guessType(el);
      let value = '';
      if (el.tagName === 'SELECT') {
        const o = el.options[el.selectedIndex];
        value = o ? o.textContent.trim() : '';
      } else if (el.type === 'checkbox' || el.type === 'radio') {
        value = el.checked ? (el.value || 'true') : '';
      } else {
        value = el.value;
      }
      fields.push({ key: friendlyName(el), locator: loc, value, type });
    }
    return fields;
  }

  /* ---- messaging -------------------------------------------------------- */

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'fill') {
      (async () => { sendResponse(await fillProfile(msg.profile)); })();
      return true;
    }
    if (msg.action === 'capture') {
      sendResponse({ ok: true, fields: captureForm() });
      return;
    }
  });

  /* ---- floating button -------------------------------------------------- */

  function toast(btn, msg) {
    const t = btn.querySelector('.bdjobs-toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { t.style.display = 'none'; }, 8000);
  }

  function injectButton() {
    if (document.getElementById('bdjobsAFBtn')) return;
    if (!document.querySelector('form')) return; // only on pages with a form
    const btn = document.createElement('div');
    btn.id = 'bdjobsAFBtn';
    btn.innerHTML = '<button type="button">⚡ BDJobs Auto-Fill</button><div class="bdjobs-toast"></div>';
    const st = document.createElement('style');
    st.textContent =
      '#bdjobsAFBtn{position:fixed;top:8px;right:8px;z-index:2147483647;font-family:Arial,sans-serif;}' +
      '#bdjobsAFBtn button{background:#d8361f;color:#fff;border:none;padding:9px 13px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.35);}' +
      '#bdjobsAFBtn button:hover{background:#b62a16;}' +
      '.bdjobs-toast{margin-top:6px;background:#222;color:#fff;padding:9px 11px;border-radius:6px;font-size:12px;max-width:300px;line-height:1.35;display:none;white-space:pre-wrap;}';
    document.head.appendChild(st);
    document.body.appendChild(btn);
    btn.querySelector('button').addEventListener('click', async () => {
      const res = await chrome.storage.local.get(['bdjobs_profiles', 'bdjobs_active']);
      const profiles = res.bdjobs_profiles || {};
      const profile = res.bdjobs_active ? profiles[res.bdjobs_active] : null;
      if (!profile) { toast(btn, 'No active profile saved. Open the extension popup and add one.'); return; }
      toast(btn, 'Filling…');
      const r = await fillProfile(profile);
      if (!r.ok) { toast(btn, 'Fill failed: ' + (r.msg || 'unknown')); return; }
      const miss = r.failed.length ? ('\nNot filled: ' + r.failed.join(', ')) : '\nAll fields filled.';
      toast(btn, 'Filled ' + r.filled.length + ' fields.' + miss + '\n(Captcha / file uploads are manual.)');
    });
  }

  if (document.readyState !== 'loading') injectButton();
  else document.addEventListener('DOMContentLoaded', injectButton);
})();
