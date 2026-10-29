/* ===========================================================================
 * BDJobs Auto-Fill — Popup logic (generic)
 * Manages multiple profiles (each = an array of editable field mappings) in
 * chrome.storage.local, drives the content script to fill / capture, and
 * supports JSON import & export.
 * =========================================================================== */

const STORE_PROFILES = 'bdjobs_profiles';
const STORE_ACTIVE = 'bdjobs_active';
const TYPES = ['text', 'select', 'checkbox', 'radio'];

/* ---- state -------------------------------------------------------------- */

let profiles = {};   // { name: { fields: [ {key,locator,value,type}, ... ] } }
let active = null;   // active profile name

/* ---- storage helpers ---------------------------------------------------- */

function load() {
  return new Promise((res) => {
    chrome.storage.local.get([STORE_PROFILES, STORE_ACTIVE], (r) => {
      profiles = r[STORE_PROFILES] || {};
      active = r[STORE_ACTIVE] || null;
      if (!active || !profiles[active]) active = Object.keys(profiles)[0] || null;
      res();
    });
  });
}
function save() {
  return new Promise((res) => {
    chrome.storage.local.set({ [STORE_PROFILES]: profiles, [STORE_ACTIVE]: active }, res);
  });
}
function activeProfile() {
  if (!active) { profiles[active = 'Profile 1'] = { fields: [] }; }
  if (!profiles[active]) profiles[active] = { fields: [] };
  if (!Array.isArray(profiles[active].fields)) profiles[active].fields = [];
  return profiles[active];
}

/* ---- DOM refs ----------------------------------------------------------- */

const $ = (id) => document.getElementById(id);
function setStatus(msg, kind) {
  const el = $('status');
  el.textContent = msg || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
}
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---- rendering ---------------------------------------------------------- */

function renderProfileList() {
  const sel = $('profileSelect');
  sel.innerHTML = '';
  const names = Object.keys(profiles);
  if (!names.length) {
    sel.appendChild(new Option('(no profiles)', ''));
    return;
  }
  names.forEach((n) => {
    const o = new Option(n, n);
    if (n === active) o.selected = true;
    sel.appendChild(o);
  });
}

function shortLoc(loc) {
  if (!loc) return 'not set';
  return loc.length > 28 ? loc.slice(0, 27) + '…' : loc;
}

function buildFields() {
  const box = $('fieldsBox');
  box.innerHTML = '';
  const p = activeProfile();
  p.fields.forEach((f, i) => {
    const card = document.createElement('div');
    card.className = 'fcard';
    card.innerHTML =
      '<div class="frow">' +
        '<input class="fk" placeholder="Field name" value="' + esc(f.key) + '">' +
        '<select class="ft">' + TYPES.map((t) => '<option' + (t === f.type ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' +
        '<button class="fd" title="Delete">✕</button>' +
      '</div>' +
      '<textarea class="fv" rows="2" placeholder="Value to fill">' + esc(f.value) + '</textarea>' +
      '<div class="fadv">' +
        '<button class="ftoggle" type="button">Locator: ' + esc(shortLoc(f.locator)) + ' ▾</button>' +
        '<input class="fl" placeholder="#id or [name=&quot;...&quot;]" value="' + esc(f.locator) + '">' +
      '</div>';

    card.querySelector('.fk').addEventListener('input', (e) => { p.fields[i].key = e.target.value; });
    card.querySelector('.ft').addEventListener('change', (e) => { p.fields[i].type = e.target.value; });
    card.querySelector('.fv').addEventListener('input', (e) => { p.fields[i].value = e.target.value; });
    card.querySelector('.fl').addEventListener('input', (e) => { p.fields[i].locator = e.target.value; });
    card.querySelector('.fd').addEventListener('click', () => { p.fields.splice(i, 1); buildFields(); });
    card.querySelector('.ftoggle').addEventListener('click', () => {
      const adv = card.querySelector('.fadv');
      adv.classList.toggle('open');
      card.querySelector('.ftoggle').textContent = 'Locator: ' + esc(shortLoc(p.fields[i].locator)) + (adv.classList.contains('open') ? ' ▴' : ' ▾');
    });
    box.appendChild(card);
  });
}

function refreshRaw() {
  $('rawJson').value = JSON.stringify(activeProfile(), null, 2);
}

/* ---- messaging ---------------------------------------------------------- */

function sendToActiveTab(message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) { reject(new Error('No active tab.')); return; }
      chrome.tabs.sendMessage(tabs[0].id, message, (resp) => {
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
        resolve(resp);
      });
    });
  });
}

/* ---- actions ------------------------------------------------------------ */

async function doFill() {
  const p = activeProfile();
  if (!p.fields.length) { setStatus('No fields in this profile. Capture or add some first.', 'err'); return; }
  setStatus('Filling…');
  try {
    const resp = await sendToActiveTab({ action: 'fill', profile: p });
    if (!resp || !resp.ok) { setStatus('Fill failed: ' + (resp && resp.msg ? resp.msg : 'unknown'), 'err'); return; }
    const miss = resp.failed.length ? ('\nNot filled: ' + resp.failed.join(', ')) : '\nAll fields filled.';
    setStatus('Filled ' + resp.filled.length + ' fields.' + miss + '\n(Captcha / file uploads are manual.)', 'ok');
  } catch (e) {
    setStatus(e.message, 'err');
  }
}

// Capture the currently-filled page and save it straight into the active profile.
async function doCaptureAndSave() {
  setStatus('Reading page & saving…');
  try {
    const resp = await sendToActiveTab({ action: 'capture' });
    if (!resp || !resp.ok) { await doSaveEdits(); return; }
    const p = activeProfile();
    p.fields = resp.fields;
    await save();
    buildFields();
    refreshRaw();
    setStatus('Saved "' + active + '" with ' + resp.fields.length + ' fields from the page. Now use Fill form ↧.', 'ok');
  } catch (e) {
    // page not reachable (e.g. not a form tab) — fall back to saving editor edits
    setStatus('Could not read the page (' + e.message + '). Saved your edits instead.', 'err');
    await doSaveEdits();
  }
}

// Save the manually-edited fields in the editor WITHOUT re-capturing the page.
async function doSaveEdits() {
  if (!active) { setStatus('Create a profile first.', 'err'); return; }
  const p = activeProfile();
  // drop fully-empty rows
  p.fields = p.fields.filter((f) => (f.key || f.locator || f.value));
  await save();
  refreshRaw();
  setStatus('Saved "' + active + '" (' + p.fields.length + ' fields).', 'ok');
}

async function doAdd() {
  const name = prompt('New profile name:', 'Profile ' + (Object.keys(profiles).length + 1));
  if (!name) return;
  if (profiles[name]) { setStatus('That name already exists.', 'err'); return; }
  profiles[name] = { fields: [] };
  active = name;
  await save();
  renderProfileList();
  buildFields();
  refreshRaw();
  setStatus('Created "' + name + '".', 'ok');
}

async function doDelete() {
  if (!active) return;
  if (!confirm('Delete profile "' + active + '"?')) return;
  delete profiles[active];
  active = Object.keys(profiles)[0] || null;
  await save();
  renderProfileList();
  buildFields();
  refreshRaw();
  setStatus('Deleted. ' + Object.keys(profiles).length + ' left.', 'ok');
}

function applyRawJson() {
  if (!active) { setStatus('Create a profile first.', 'err'); return; }
  try {
    const obj = JSON.parse($('rawJson').value);
    if (!Array.isArray(obj.fields)) throw new Error('profile must contain a "fields" array');
    profiles[active] = obj;
    save().then(() => { buildFields(); setStatus('Applied JSON to "' + active + '".', 'ok'); });
  } catch (e) {
    setStatus('Invalid JSON: ' + e.message, 'err');
  }
}

/* ---- import / export ---------------------------------------------------- */

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function doExportAll() {
  if (!Object.keys(profiles).length) { setStatus('Nothing to export.', 'err'); return; }
  download('bdjobs_profiles.json', JSON.stringify({ _type: 'bdjobs-profiles', active, profiles }, null, 2));
  setStatus('Exported ' + Object.keys(profiles).length + ' profiles.', 'ok');
}
function doExportActive() {
  if (!active) { setStatus('No active profile.', 'err'); return; }
  download('bdjobs_' + active.replace(/\s+/g, '_') + '.json', JSON.stringify(activeProfile(), null, 2));
  setStatus('Exported "' + active + '".', 'ok');
}
function doImport(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      let n = 0;
      if (data && data.profiles && typeof data.profiles === 'object') {
        Object.assign(profiles, data.profiles);
        if (data.active && profiles[data.active]) active = data.active;
        n = Object.keys(data.profiles).length;
      } else if (data && Array.isArray(data.fields)) {
        const nm = file.name.replace(/\.json$/i, '') || 'Imported';
        profiles[nm] = data; active = nm; n = 1;
      } else {
        throw new Error('Unrecognized JSON shape');
      }
      await save();
      renderProfileList(); buildFields(); refreshRaw();
      setStatus('Imported ' + n + ' profile(s).', 'ok');
    } catch (e) {
      setStatus('Import failed: ' + e.message, 'err');
    }
  };
  reader.readAsText(file);
}

/* ---- wire up ------------------------------------------------------------ */

function init() {
  load().then(() => {
    if (!active) { profiles['Profile 1'] = { fields: [] }; active = 'Profile 1'; save(); }
    renderProfileList();
    buildFields();
    refreshRaw();

    $('profileSelect').addEventListener('change', async (e) => {
      active = e.target.value || null;
      await save();
      buildFields(); refreshRaw();
    });
    $('addBtn').addEventListener('click', doAdd);
    $('delBtn').addEventListener('click', doDelete);
    $('fillBtn').addEventListener('click', doFill);
    $('capSaveBtn').addEventListener('click', doCaptureAndSave);
    $('saveEditsBtn').addEventListener('click', doSaveEdits);
    $('addFieldBtn').addEventListener('click', () => {
      activeProfile().fields.push({ key: '', locator: '', value: '', type: 'text' });
      buildFields();
    });
    $('applyJson').addEventListener('click', applyRawJson);
    $('exportAllBtn').addEventListener('click', doExportAll);
    $('exportActiveBtn').addEventListener('click', doExportActive);
    $('importFile').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) doImport(e.target.files[0]);
    });
    document.querySelectorAll('.tab').forEach((t) => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
        document.querySelectorAll('.tabpane').forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        document.getElementById('tab-' + t.dataset.tab).classList.add('active');
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
