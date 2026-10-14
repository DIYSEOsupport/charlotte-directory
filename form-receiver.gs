/**
 * Directory form receiver (version 10)
 * Paste the WHOLE file into Apps Script. Then Deploy > Manage deployments > pencil > New version.
 * NEVER click "New deployment".
 *
 * Sheet layout (row 1, columns A to H):
 *   A Business Name   (name, blank line, category in grey)
 *   B Slogan or short description
 *   C Contact   (name + title, then Phone, Email, Website, Facebook, NextDoor lines)
 *   D Address   E Area Served   F About   G Details   H Logo
 * The script adds these private columns by itself, after Logo:
 *   Timestamp, Name, Title, How to contact you..., Owner Key (private),
 *   Google Account Email (private), Hidden (private)
 */

// ---------------------------------------------------------------
// Settings
// ---------------------------------------------------------------
var CLIENT_ID = '429873674496-c3ld7ru88i8b0acssaeh26adtvfok12e.apps.googleusercontent.com';
var SHEET_ID = '1mSNjflXI-u1B4zHkbUT2SKx7lklbE08nFwmoFFzYQvE';
var SHEET_GID = 112379302;
var LOGO_FOLDER_NAME = 'Directory Logos';
var DIRECTORY_URL = 'https://diyseosupport.github.io/charlotte-directory/index.html';

var TIMESTAMP_HEADER = 'Timestamp';
var NAME_HEADER = 'Name';
var TITLE_HEADER = 'Title';
var HOW_HEADER = 'How to contact you with questions about your submission?';
var OWNER_HEADER = 'Owner Key (private)';
var EMAIL_HEADER = 'Google Account Email (private)';
var HIDDEN_HEADER = 'Hidden (private)';

var ADMIN_EMAILS = ['diyseo.support@gmail.com'];
var ALLOW_CLAIM_OLD_ROWS = true;

var EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/;
var URL_RE = /^(https?:\/\/)?([A-Za-z0-9\-]+\.)+[A-Za-z]{2,}(:\d+)?([\/?#]\S*)?$/;

// Columns that will be hidden later. For now nothing is hidden: these are shaded light blue.
var SHADE_HEADERS = /^name$|^title$|how to contact|owner key|google account email|^logo$/i;
var SHADE_COLOR = '#CFE2F3';

// Business Name cell: name, then this many blank lines, then the category (grey, not bold)
var CATEGORY_GAP = 1;
var CATEGORY_COLOR = '#666666';
var NAME_COLOR = '#5B2A86';

// ---------------------------------------------------------------
// Run once so Google asks for permission
// ---------------------------------------------------------------
function authorizeOnce() {
  SpreadsheetApp.openById(SHEET_ID).getName();
  getLogoFolder_();
  PropertiesService.getScriptProperties().getKeys();
  UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=test', { muteHttpExceptions: true });
  MailApp.getRemainingDailyQuota();
  Logger.log('All set. Now Deploy > Manage deployments > pencil > New version.');
}

// ---------------------------------------------------------------
// Web app
// ---------------------------------------------------------------
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.ping) return ContentService.createTextOutput('Directory form receiver is running.');
  var useCallback = p.callback && /^[A-Za-z_][\w.]*$/.test(p.callback);
  var csv = '', problem = '';
  try { csv = publicCsv_(); } catch (err) { problem = String(err); }
  if (useCallback) {
    var js = (JSON.stringify(csv) + ',' + JSON.stringify(problem))
        .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return ContentService.createTextOutput(p.callback + '(' + js + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  // Plain text so the browser shows it in the tab instead of downloading a file
  return ContentService.createTextOutput(problem ? 'Error: ' + problem : csv)
      .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var raw = (e.parameter && e.parameter.payload) ? e.parameter.payload : e.postData.contents;
    var data = JSON.parse(raw);

    var email = verifyToken_(data.idToken);
    if (!email) return reply_({ ok: false, error: 'LOGIN_EXPIRED' });
    var isAdmin = ADMIN_EMAILS.map(function (a) { return String(a).toLowerCase(); }).indexOf(email) !== -1;

    var sheet = findSheet_();
    ensureColumn_(sheet, TIMESTAMP_HEADER);
    ensureColumn_(sheet, NAME_HEADER);
    ensureColumn_(sheet, TITLE_HEADER);
    ensureColumn_(sheet, HOW_HEADER);
    var ownerCol = ensureColumn_(sheet, OWNER_HEADER);
    ensureColumn_(sheet, EMAIL_HEADER);
    ensureColumn_(sheet, HIDDEN_HEADER);
    var key = ownerKey_(email);

    // "Which businesses do I own?"
    if (data.action === 'mine') {
      return reply_({ ok: true, kind: 'mine', businesses: getMine_(sheet, key, isAdmin, ownerCol) });
    }

    // "Remove my business" (hides the row, stamps column P, recoverable)
    if (data.action === 'remove') {
      var rmName = String(data.businessName || '').trim();
      if (!rmName) return reply_({ ok: false, error: 'No business chosen.' });
      if (!ownerAllowed_(sheet, ownerCol, rmName, key)) return reply_({ ok: false, error: 'WRONG_OWNER' });
      var rmRows = liveRows_(sheet).filter(function (r) {
        return nameKey_(r.name) === nameKey_(rmName) && String(r.vals[ownerCol - 1] || '') === key;
      });
      if (!rmRows.length) return reply_({ ok: false, error: 'Business not found.' });
      hideRows_(sheet, rmRows);
      try { CacheService.getScriptCache().remove('directory_csv'); } catch (cacheErr) { }
      return reply_({ ok: true, kind: 'remove' });
    }

    var problem = validate_(data);
    if (problem) return reply_({ ok: false, error: problem });

    var newName = String(data.businessName).trim();
    var oldName = String(data.originalName || '').trim();
    var checkName = oldName || newName;

    if (!isAdmin && !ownerAllowed_(sheet, ownerCol, checkName, key)) {
      return reply_({ ok: false, error: 'WRONG_OWNER' });
    }

    var live = liveRows_(sheet);
    var oldRows = live.filter(function (r) { return nameKey_(r.name) === nameKey_(checkName); });

    // Renaming to a name somebody else already uses
    if (oldName && nameKey_(oldName) !== nameKey_(newName)) {
      var taken = live.some(function (r) { return nameKey_(r.name) === nameKey_(newName); });
      if (taken) return reply_({ ok: false, error: 'NAME_TAKEN' });
    }

    var headers = getHeaders_(sheet);
    var logoIdx = colByKey_(headers, 'logo');
    var ownerIdx = ownerCol - 1;
    var emailIdx = colOf_(headers, function (t) { return t === EMAIL_HEADER; });
    var lastOld = oldRows.length ? oldRows[oldRows.length - 1] : null;
    var oldLogo = (lastOld && logoIdx >= 0) ? String(lastOld.vals[logoIdx] || '') : '';

    // Keep the first owner (so admin edits do not steal a listing)
    var saveKey = key, saveEmail = email;
    if (lastOld && String(lastOld.vals[ownerIdx] || '')) {
      saveKey = String(lastOld.vals[ownerIdx]);
      if (emailIdx >= 0 && String(lastOld.vals[emailIdx] || '')) saveEmail = String(lastOld.vals[emailIdx]);
    }

    // Logo
    var logoUrl = '';
    if (data.logoData) {
      logoUrl = saveLogo_(data);
    } else if (data.logoAction === 'keep') {
      logoUrl = oldLogo;
    } else if (data.logoAction === 'delete') {
      trashLogo_(oldLogo);
      logoUrl = '';
    }

    addRow_(sheet, data, logoUrl, saveKey, saveEmail);
    hideRows_(sheet, oldRows);
    CacheService.getScriptCache().remove('directory_csv');

    try { sendLink_(email, newName); } catch (mailErr) { /* mail failing never blocks a save */ }
    return reply_({ ok: true });
  } catch (err) {
    return reply_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) { }
  }
}

function reply_(obj) {
  obj.dirForm = true;
  var safe = JSON.stringify(obj).replace(/</g, '\\u003c');
  return HtmlService
      .createHtmlOutput('<script>window.top.postMessage(' + safe + ", '*');</script>")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function sendLink_(to, businessName) {
  MailApp.sendEmail(to,
      'Your listing is saved: ' + businessName,
      'Thank you! Your listing "' + businessName + '" is saved.\n\n' +
      'See the directory: ' + DIRECTORY_URL + '\n\n' +
      'Need to change it later? Open the form, sign in with this same Google account, ' +
      'and pick "Update my business".\n\n' +
      'Need help? DIYSEO.support@gmail.com');
}

// ---------------------------------------------------------------
// Google sign-in check
// ---------------------------------------------------------------
function verifyToken_(token) {
  if (!token) return '';
  var resp = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
      { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return '';
  var info = JSON.parse(resp.getContentText());
  if (info.aud !== CLIENT_ID) return '';
  if (String(info.email_verified) !== 'true') return '';
  if (Number(info.exp) * 1000 < Date.now()) return '';
  return String(info.email || '').toLowerCase();
}

// ---------------------------------------------------------------
// Checks
// ---------------------------------------------------------------
function validate_(d) {
  if (!d.businessName || !String(d.businessName).trim()) return 'BAD_NAME';
  d.phone = formatPhone_(d.phone);
  if (d.phone && d.phone.replace(/\D/g, '').length !== 10) return 'BAD_PHONE';
  d.email = String(d.email || '').trim().toLowerCase();
  if (d.email && !EMAIL_RE.test(d.email)) return 'BAD_EMAIL';
  if (d.how && String(d.how).indexOf('@') !== -1 && !EMAIL_RE.test(String(d.how).trim())) return 'BAD_EMAIL';
  var urlFields = ['website', 'facebook', 'ndBiz', 'ndPersonal'];
  for (var i = 0; i < urlFields.length; i++) {
    var k = urlFields[i];
    var v = String(d[k] || '').trim();
    if (v && !URL_RE.test(v)) return 'BAD_URL';
    d[k] = v.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  }
  return '';
}

function formatPhone_(value) {
  var digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
  if (digits.length !== 10) return String(value || '').trim();
  return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
}

// ---------------------------------------------------------------
// Owner key
// ---------------------------------------------------------------
// Only the first line of a Business Name cell is the name (line 2 is the category)
function firstLine_(value) {
  return String(value == null ? '' : value).split(/\r?\n/)[0].trim();
}

// Business Name cell -> { name: first line, category: the remaining text }
function splitNameCell_(value) {
  var lines = String(value == null ? '' : value).split(/\r?\n/);
  var name = lines[0].trim();
  var rest = lines.slice(1).map(function (x) { return x.trim(); }).filter(Boolean);
  return { name: name, category: rest.join(' ') };
}

function nameKey_(name) {
  return firstLine_(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('OWNER_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('OWNER_SECRET', secret);
  }
  return secret;
}

function ownerKey_(email) {
  var bytes = Utilities.computeHmacSha256Signature('owner|' + String(email).toLowerCase(), getSecret_());
  return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

// ---------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------
function findSheet_() {
  var sheets = SpreadsheetApp.openById(SHEET_ID).getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === SHEET_GID) return sheets[i];
  }
  throw new Error('Could not find the sheet tab. Check SHEET_GID.');
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

// 0-based index of first heading that passes the test, or -1
function colOf_(headers, test) {
  for (var i = 0; i < headers.length; i++) {
    if (test(String(headers[i]).trim())) return i;
  }
  return -1;
}

function nameCol_(headers) {
  return colOf_(headers, function (t) { return /^business name/i.test(t); });
}

function colByKey_(headers, key) {
  return colOf_(headers, function (t) { return keyFor_(t) === key; });
}

// Adds a column with this heading if it is not there yet. Returns 1-based column.
function ensureColumn_(sheet, heading) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === heading) return i + 1;
  }
  sheet.getRange(1, lastCol + 1).setValue(heading);
  return lastCol + 1;
}

// Rows that have a business name and are not hidden
function liveRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = sheet.getLastColumn();
  var headers = getHeaders_(sheet);
  var n = nameCol_(headers);
  if (n < 0) return [];
  var hc = colOf_(headers, function (t) { return t === HIDDEN_HEADER; });
  var vals = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var name = firstLine_(vals[i][n]);
    if (!name) continue;
    if (hc >= 0 && String(vals[i][hc]).trim() !== '') continue;
    out.push({ row: i + 2, name: name, vals: vals[i] });
  }
  return out;
}

// True when this business name is new, or this account owns it
function ownerAllowed_(sheet, ownerCol, businessName, ownerKey) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return true;
  var headers = getHeaders_(sheet);
  var n = nameCol_(headers);
  if (n < 0) return true;
  var names = sheet.getRange(2, n + 1, lastRow - 1, 1).getValues();
  var keys = sheet.getRange(2, ownerCol, lastRow - 1, 1).getValues();
  var wanted = nameKey_(businessName);
  var found = false, anyOwner = false;
  for (var r = 0; r < names.length; r++) {
    if (nameKey_(names[r][0]) !== wanted) continue;
    found = true;
    var stored = String(keys[r][0] || '');
    if (stored) {
      anyOwner = true;
      if (stored === ownerKey) return true;
    }
  }
  if (!found) return true;
  if (!anyOwner) return ALLOW_CLAIM_OLD_ROWS;
  return false;
}

// Marks old rows as replaced (red + strikethrough is done in formatSheet_)
function hideRows_(sheet, rows) {
  if (!rows.length) return;
  var hc = ensureColumn_(sheet, HIDDEN_HEADER);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  rows.forEach(function (r) { sheet.getRange(r.row, hc).setValue(stamp); });
  rows.forEach(function (r) { try { sheet.hideRows(r.row); } catch (hideErr) { } });
}

// Businesses owned by this account (everyone, admin too, sees only their own). Newest row per name only.
// Gives the form back its separate boxes (name/title, street/city/state/zip, type/describe).
function getMine_(sheet, key, isAdmin, ownerCol) {
  var headers = getHeaders_(sheet);
  var latest = {};
  liveRows_(sheet).forEach(function (r) { latest[nameKey_(r.name)] = r; });
  var out = [];
  Object.keys(latest).forEach(function (k) {
    var r = latest[k];
    var stored = String(r.vals[ownerCol - 1] || '');
    if (stored !== key) return;
    var o = {};
    var descVal = '';
    for (var c = 0; c < headers.length; c++) {
      var fk = keyFor_(String(headers[c]).trim());
      if (!fk || fk === 'timestamp') continue;
      var v = r.vals[c];
      v = (v instanceof Date) ? '' : String(v == null ? '' : v).trim();
      if (!v) continue;
      if (fk === 'businessName') {
        var parts = splitNameCell_(v);
        if (!o.businessName) o.businessName = parts.name;
        if (!o.category && parts.category) o.category = parts.category;
      } else if (fk === 'about') {
        if (!descVal) descVal = v;
      } else if (fk === 'contact') {
        var cp = parseContact_(v);
        Object.keys(cp).forEach(function (f) { if (cp[f] && !o[f]) o[f] = cp[f]; });
      } else if (fk === 'address') {
        if (!o.street && !o.city) {
          var a = splitAddress_(v);
          o.street = a.street; o.city = a.city; o.state = a.state; o.zip = a.zip;
        }
      } else if (!o[fk]) {
        o[fk] = v;
      }
    }
    o.describe = descVal;
    var m = /[?&]id=([\w-]+)/.exec(o.logo || '');
    o.logoId = m ? m[1] : '';
    delete o.logo;
    o.businessName = o.businessName || r.name;
    out.push(o);
  });
  out.sort(function (a, b) { return a.businessName.toLowerCase().localeCompare(b.businessName.toLowerCase()); });
  return out;
}

// "123 Main St, Port Charlotte, FL 33948" -> street, city, state, zip.
// If it does not fit that shape, everything goes in street.
function splitAddress_(text) {
  var t = String(text || '').replace(/\s*\n\s*/g, ', ').trim();
  var m = /^(.*),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5})$/.exec(t);
  if (m) return { street: m[1].trim(), city: m[2].trim(), state: m[3].toUpperCase(), zip: m[4] };
  return { street: t, city: '', state: '', zip: '' };
}

// One Contact cell holds every way to reach the business, one per line:
//   Diana, Owner
//   941-555-1234
//   name@example.com
//   https://example.com
//   https://facebook.com/page
//   https://nextdoor.com/pages/x
//   https://nextdoor.com/u/y
// (old rows with labels like "Phone:" are still understood)
var CONTACT_LABELS = [
  ['Phone', 'phone'], ['Email', 'email'], ['Website', 'website'], ['Facebook Business', 'facebook'],
  ['NextDoor Business', 'ndBiz'], ['NextDoor Personal', 'ndPersonal']
];
// Short labels typed by hand are understood too
var CONTACT_ALIASES = [['Facebook', 'facebook'], ['NextDoor', 'ndBiz']];

function fullUrl_(v) {
  v = String(v || '').trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : 'https://' + v.replace(/^\/+/, '');
}

// Column D is written with NO labels: name/title first, then each item on its own line.
function buildContact_(d) {
  var lines = [];
  var who = [String(d.pubName || '').trim(), String(d.pubTitle || '').trim()].filter(Boolean).join(', ');
  if (who) lines.push(who);
  CONTACT_LABELS.forEach(function (pair) {
    var v = String(d[pair[1]] || '').trim();
    if (!v) return;
    if (pair[1] === 'phone' || pair[1] === 'email') lines.push(v);
    else lines.push(fullUrl_(v));
  });
  return lines.join('\n');
}

// Reads labeled lines (old rows) AND plain lines (new rows) by what they look like.
function parseContact_(text) {
  var out = { pubName: '', pubTitle: '', phone: '', email: '', website: '', facebook: '', ndBiz: '', ndPersonal: '' };
  String(text == null ? '' : text).split(/\r?\n/).forEach(function (line) {
    line = line.trim();
    if (!line) return;
    var all = CONTACT_LABELS.concat(CONTACT_ALIASES);
    for (var i = 0; i < all.length; i++) {
      var label = all[i][0];
      if (line.toLowerCase().indexOf(label.toLowerCase() + ':') === 0) {
        out[all[i][1]] = line.slice(label.length + 1).trim();
        return;
      }
    }
    var noSpace = !/\s/.test(line);
    if (noSpace && line.indexOf('@') > 0 && line.indexOf('/') === -1) { out.email = line; return; }
    if (noSpace && /nextdoor\.com/i.test(line)) {
      if (/\/pages\//i.test(line) || !out.ndBiz && !/\/(u|profile|p)\//i.test(line)) out.ndBiz = line;
      else out.ndPersonal = line;
      return;
    }
    if (noSpace && /(facebook\.com|fb\.com|fb\.me)/i.test(line)) { out.facebook = line; return; }
    if (noSpace && (/^(https?:\/\/|www\.)/i.test(line) || /\.[a-z]{2,}(\/|$)/i.test(line))) { out.website = line; return; }
    if (/^[\d\s().+\-x]+$/i.test(line) && line.replace(/\D/g, '').length >= 7) { out.phone = line; return; }
    if (!out.pubName && !out.pubTitle) {
      var c = line.indexOf(', ');
      if (c === -1) { out.pubName = line; }
      else { out.pubName = line.slice(0, c).trim(); out.pubTitle = line.slice(c + 2).trim(); }
    }
  });
  return out;
}

// The form sends type + blank line + description. Pick list "Other" sends only the description.
function splitDescribe_(text) {
  var t = String(text == null ? '' : text).trim();
  if (!t) return { type: '', text: '' };
  var lines = t.split(/\r?\n/);
  var first = lines[0].trim();
  if (/^(physical location|online only|mobile service)/i.test(first)) {
    return { type: first, text: lines.slice(1).join('\n').trim() };
  }
  return { type: 'Other', text: t };
}

// ---------------------------------------------------------------
// Public copy of the sheet (only the columns that may be shown)
// Builds the headings the directory page already understands.
// Private columns are never copied.
// ---------------------------------------------------------------
function csvCell_(v) {
  return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
}

function publicCsv_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('directory_csv');
  if (cached) return cached;

  var sheet = findSheet_();
  var values = sheet.getDataRange().getValues();
  var head = values[0];
  var idx = {};
  for (var c = 0; c < head.length; c++) {
    var k = keyFor_(String(head[c]).trim());
    if (k && (idx[k] === undefined || k === 'address')) idx[k] = c;
  }
  var n = nameCol_(head);
  var hc = colOf_(head, function (t) { return t === HIDDEN_HEADER; });

  function cell(row, key) {
    if (idx[key] === undefined) return '';
    var v = row[idx[key]];
    return (v instanceof Date) ? '' : String(v == null ? '' : v).trim();
  }

  var heads = ['Business Name', 'Category', 'Public Contact Name', 'Public Contact Title',
      'About your business', 'Other details', 'Slogan', 'Phone', 'Website', 'Email', 'Facebook',
      'NextDoor Business', 'NextDoor Personal', 'Address', 'Area Served', 'Logo'];
  var lines = [heads.map(csvCell_).join(',')];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (n < 0 || firstLine_(row[n]) === '') continue;
    if (hc >= 0 && String(row[hc]).trim() !== '') continue;

    var nameParts = splitNameCell_(row[n]);
    var bizName = nameParts.name;
    var category = cell(row, 'category') || nameParts.category;

    var ct = parseContact_(cell(row, 'contact'));

    var about = cell(row, 'about');

    lines.push([
      bizName, category, ct.pubName, ct.pubTitle, about, cell(row, 'other'), cell(row, 'slogan'),
      ct.phone, ct.website, ct.email, ct.facebook,
      ct.ndBiz, ct.ndPersonal, cell(row, 'address'), cell(row, 'area'),
      cell(row, 'logo')
    ].map(csvCell_).join(','));
  }

  var csv = lines.join('\n');
  try { cache.put('directory_csv', csv, 60); } catch (tooBig) { }
  return csv;
}

// ---------------------------------------------------------------
// Sort + pretty sheet. Run tidySheet by hand any time.
// ---------------------------------------------------------------
function tidySheet() {
  var sheet = findSheet_();
  ensureColumn_(sheet, TIMESTAMP_HEADER);
  ensureColumn_(sheet, NAME_HEADER);
  ensureColumn_(sheet, TITLE_HEADER);
  ensureColumn_(sheet, HOW_HEADER);
  ensureColumn_(sheet, OWNER_HEADER);
  ensureColumn_(sheet, EMAIL_HEADER);
  ensureColumn_(sheet, HIDDEN_HEADER);
  deleteBlankRows_(sheet);
  sortSheet_(sheet);
  formatSheet_(sheet);
  Logger.log('Sheet tidied.');
}

function deleteBlankRows_(sheet) {
  var lastRow = sheet.getLastRow();
  var n = nameCol_(getHeaders_(sheet));
  if (n < 0 || lastRow < 2) return;
  var names = sheet.getRange(2, n + 1, lastRow - 1, 1).getValues();
  for (var r = names.length - 1; r >= 0; r--) {
    if (firstLine_(names[r][0]) === '') sheet.deleteRow(r + 2);
  }
}

// A to Z by business name. Same name: oldest first, newest last.
function sortSheet_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 3) return;
  if (sheet.getFilter()) sheet.getFilter().remove();
  var headers = getHeaders_(sheet);
  var n = nameCol_(headers);
  if (n < 0) return;
  var t = colByKey_(headers, 'timestamp');
  var spec = [{ column: n + 1, ascending: true }];
  if (t >= 0) spec.push({ column: t + 1, ascending: true });
  sheet.getRange(2, 1, lastRow - 1, lastCol).sort(spec);
}

function widthFor_(header) {
  var k = String(header).toLowerCase().trim();
  if (/^business name/.test(k)) return 240;
  if (k === 'about') return 360;
  if (k === 'details') return 300;
  if (k === 'contact') return 320;
  if (/slogan/.test(k)) return 260;
  if (k === 'address') return 280;
  if (/served|area/.test(k)) return 200;
  if (/logo/.test(k)) return 230;
  if (/timestamp|hidden/.test(k)) return 150;
  return 160;
}

function formatSheet_(sheet) {
  var lastCol = sheet.getLastColumn();
  var lastRow = Math.max(sheet.getLastRow(), 2);
  var headers = getHeaders_(sheet);

  var maxRows = sheet.getMaxRows();
  if (maxRows > lastRow + 1) sheet.deleteRows(lastRow + 2, maxRows - lastRow - 1);

  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getBandings().forEach(function (b) { b.remove(); });

  var all = sheet.getRange(1, 1, lastRow, lastCol);
  all.setFontFamily('Walter Turncoat').setFontSize(11).setVerticalAlignment('top').setWrap(true);
  all.setBorder(true, true, true, true, true, true, '#333333', SpreadsheetApp.BorderStyle.SOLID);

  // Body rows: stripes, bold names, replaced rows red + strikethrough
  var n = nameCol_(headers);
  var hc = colOf_(headers, function (t) { return t === HIDDEN_HEADER; });
  var body = sheet.getRange(2, 1, lastRow - 1, lastCol);
  var vals = body.getValues();
  var shade = headers.map(function (h) { return SHADE_HEADERS.test(String(h).trim()); });
  var bg = [], fc = [], fl = [], fw = [];
  for (var i = 0; i < vals.length; i++) {
    var replaced = hc >= 0 && String(vals[i][hc]).trim() !== '';
    var stripe = (i % 2 === 0) ? '#FFF6DC' : '#FFFFFF';
    var b = [], f = [], l = [], w = [];
    for (var c = 0; c < lastCol; c++) {
      b.push(replaced ? '#F4CCCC' : (shade[c] ? SHADE_COLOR : stripe));
      f.push(replaced ? '#CC0000' : '#5B2A86');
      l.push(replaced ? 'line-through' : 'none');
      w.push('normal');
    }
    bg.push(b); fc.push(f); fl.push(l); fw.push(w);
  }
  body.setBackgrounds(bg).setFontColors(fc).setFontLines(fl).setFontWeights(fw);

  // Business Name cells: name bold, category (below it) not bold and medium dark grey
  if (n >= 0) {
    var nameStyle = SpreadsheetApp.newTextStyle().setBold(true).setForegroundColor(NAME_COLOR).build();
    var catStyle = SpreadsheetApp.newTextStyle().setBold(false).setForegroundColor(CATEGORY_COLOR).build();
    var rich = [];
    for (var q = 0; q < vals.length; q++) {
      var text = String(vals[q][n] == null ? '' : vals[q][n]);
      var rv = SpreadsheetApp.newRichTextValue().setText(text);
      var rowReplaced = hc >= 0 && String(vals[q][hc]).trim() !== '';
      if (text && !rowReplaced) {
        var cut = text.search(/\r?\n/);
        if (cut === -1) cut = text.length;
        if (cut > 0) rv.setTextStyle(0, cut, nameStyle);
        if (cut < text.length) rv.setTextStyle(cut, text.length, catStyle);
      }
      rich.push([rv.build()]);
    }
    sheet.getRange(2, n + 1, vals.length, 1).setRichTextValues(rich);
  }

  // Header row
  sheet.getRange(1, 1, 1, lastCol)
      .setBackground('#1A73E8').setFontColor('#FFFFFF').setFontFamily('Bangers').setFontSize(14)
      .setFontLine('none').setFontWeight('normal')
      .setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(true);
  // Headings of the columns that will be hidden later: light blue too
  for (var s2 = 0; s2 < shade.length; s2++) {
    if (shade[s2]) sheet.getRange(1, s2 + 1).setBackground(SHADE_COLOR).setFontColor('#1A3C6E');
  }
  sheet.setRowHeight(1, 38);
  sheet.setFrozenRows(1);

  // Widths. Nothing is hidden for now.
  for (var w2 = 0; w2 < headers.length; w2++) sheet.setColumnWidth(w2 + 1, widthFor_(headers[w2]));
  sheet.showColumns(1, lastCol);

  sheet.getRange(1, 1, lastRow, lastCol).createFilter();
}

// ---------------------------------------------------------------
// Logo
// ---------------------------------------------------------------
function saveLogo_(data) {
  if (!data.logoData) return '';
  var match = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(data.logoData);
  if (!match) return '';
  var mime = match[1];
  var ext = mime.split('/')[1].replace('jpeg', 'jpg').replace(/\+.*$/, '');
  var safeName = String(data.businessName || 'logo').replace(/[^\w\- ]+/g, '').trim() || 'logo';
  var blob = Utilities.newBlob(Utilities.base64Decode(match[2]), mime, safeName + '.' + ext);
  var file = getLogoFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/open?id=' + file.getId();
}

function trashLogo_(url) {
  var m = /[?&]id=([\w-]+)/.exec(String(url || ''));
  if (!m) return;
  try { DriveApp.getFileById(m[1]).setTrashed(true); } catch (err) { }
}

function getLogoFolder_() {
  var folders = DriveApp.getFoldersByName(LOGO_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(LOGO_FOLDER_NAME);
}

// ---------------------------------------------------------------
// Add one row that matches the headings already in the sheet
// ---------------------------------------------------------------
function addRow_(sheet, data, logoUrl, ownerKey, email) {
  var headers = getHeaders_(sheet);
  var target = nextFreeRow_(sheet, headers);
  var used = {};
  for (var c = 0; c < headers.length; c++) {
    var t = String(headers[c]).trim();
    var value;
    if (t === OWNER_HEADER) value = ownerKey;
    else if (t === EMAIL_HEADER) value = email;
    else if (t === HIDDEN_HEADER) value = '';
    else {
      var key = keyFor_(t);
      // skip headings the form does not fill, and repeat headings (helper/formula columns)
      if (!key || used[key]) continue;
      if (sheet.getRange(2, c + 1).getFormula()) continue;
      used[key] = true;
      value = valueFor_(t, data, logoUrl);
    }
    sheet.getRange(target, c + 1).setValue(value);
  }
}

function nextFreeRow_(sheet, headers) {
  var n = nameCol_(headers);
  var lastRow = sheet.getLastRow();
  if (n < 0 || lastRow < 2) return lastRow + 1;
  var names = sheet.getRange(2, n + 1, lastRow - 1, 1).getValues();
  for (var r = names.length - 1; r >= 0; r--) {
    if (firstLine_(names[r][0]) !== '') return r + 3;
  }
  return 2;
}

// What a column heading means. Used to write AND to read rows.
function keyFor_(header) {
  var k = String(header).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!k) return '';
  if (k === 'timestamp') return 'timestamp';
  if (k === 'name') return 'name';
  if (k === 'title') return 'title';
  if (/how to contact/.test(k)) return 'how';
  if (k.indexOf('business name') === 0) return 'businessName';
  if (/^slogan/.test(k)) return 'slogan';
  if (k === 'contact') return 'contact';
  if (k === 'address' || k === 'raw address') return 'address';
  if (/^category/.test(k)) return 'category';
  if (/area served/.test(k)) return 'area';
  if (k === 'about') return 'about';
  if (k === 'details') return 'other';
  if (k === 'logo') return 'logo';
  return '';
}

function valueFor_(header, d, logoUrl) {
  var key = keyFor_(header);
  if (!key) return '';
  if (key === 'timestamp') return new Date();
  if (key === 'logo') return logoUrl || '';
  if (key === 'businessName') return clean_(d.businessName);
  if (key === 'about') return clean_(splitDescribe_(d.describe).text);
  if (key === 'contact') return clean_(buildContact_(d));
  if (key === 'address') {
    var stateZip = [String(d.state || '').trim(), String(d.zip || '').trim()].filter(Boolean).join(' ');
    return clean_([String(d.street || '').trim(), String(d.city || '').trim(), stateZip]
        .filter(Boolean).join(', '));
  }
  return clean_(d[key]);
}

// Stops a typed answer from being read as a spreadsheet formula
function clean_(value) {
  var v = String(value == null ? '' : value).trim();
  return /^[=+@-]/.test(v) ? "'" + v : v;
}
