/**
 * Directory form receiver (version 28: faster submit, slim Pending tab, Approved By column, auto-approve email)
 * Paste the WHOLE file into Apps Script. Then Deploy > Manage deployments > pencil > New version.
 * NEVER click "New deployment".
 * BUILD: bump this line every time you paste a new copy in. Check it anytime with
 * Directory menu > "What build is live?" (no need to open the code to check).
 *
 * Sheet layout (row 1, columns A to H):
 *   A Business Name   (name, blank line, category in grey)
 *   B Slogan or short description
 *   C Contact   (name + title, then Phone, Email, Website, Facebook, NextDoor lines)
 *   D Address   E Area Served   F About   G Details   H Logo
 * The script adds these private columns by itself, after Logo:
 *   Timestamp, Name, Title, How to contact you..., Owner Key (private),
 *   Google Account Email (private), Hidden (private),
 *   Status (private), Confirm Code (private), Check Notes (private), Replaces (private), Notified (private)
 *
 * STATUS: Unconfirmed -> (owner taps email link) -> Pending -> (hourly check) -> Approved or Flagged.
 *   Flagged = waiting for you. Change Status to Approved (goes live) or Rejected (removed).
 *   Rows with an empty Status (all the old listings) stay live.
 */

// ---------------------------------------------------------------
// Settings
// ---------------------------------------------------------------
var CLIENT_ID = '429873674496-c3ld7ru88i8b0acssaeh26adtvfok12e.apps.googleusercontent.com';
var BUILD = '2026-10-20 11:40pm — fix remove for pending-only listings';
var SHEET_ID = '1mSNjflXI-u1B4zHkbUT2SKx7lklbE08nFwmoFFzYQvE';
var SHEET_GID = 112379302;
var LOGO_FOLDER_NAME = 'Directory Logos';
var DIRECTORY_URL = 'https://diyseosupport.github.io/charlotte-directory/';
var FORM_URL = 'https://diyseosupport.github.io/charlotte-directory/form.html';
var FROM_EMAIL = 'DIYSEO.support@gmail.com';
var QR_URL = 'https://diyseosupport.github.io/charlotte-directory/diyseo_logo_static.png';
var BANNER_URL = 'https://diyseosupport.github.io/charlotte-directory/hero.jpg';
var DIYSEO_LOGO_URL = 'https://diyseosupport.github.io/charlotte-directory/diyseo_logo_static.png';
var FB_ICON = 'https://cdn-icons-png.flaticon.com/24/733/733547.png';
var ND_ICON = 'https://cdn-icons-png.flaticon.com/24/2111/2111398.png';

var TIMESTAMP_HEADER = 'Timestamp';
var OTHER_HEADER = 'Other details'; // what owners type when they pick category Other
var NAME_HEADER = 'Name';
var TITLE_HEADER = 'Title';
var HOW_HEADER = 'How to contact you with questions about your submission?';
var OWNER_HEADER = 'Owner Key (private)';
var EMAIL_HEADER = 'Google Account Email (private)';
var HIDDEN_HEADER = 'Hidden (private)';
var STATUS_HEADER = 'Status (private)';
var TOKEN_HEADER = 'Confirm Code (private)';
var NOTES_HEADER = 'Check Notes (private)';
var REPLACES_HEADER = 'Replaces (private)';
var NOTIFIED_HEADER = 'Notified (private)';
var APPROVED_HEADER = 'Approved By (private)';
var LIVE_HEADER = 'Live Since';
var LICENSED_HEADER = 'Licensed & Insured';
// Pending tab shows only these columns (others are hidden there, data is kept). Change the words if you want more or less.
var PENDING_SHOW = /^business name|^contact$|^name$|^title$|how to contact|google account email|^timestamp$|status \(private\)|check notes|approved by/i;
var STATUS_LIST = ['Unconfirmed', 'Pending', 'Approved', 'Flagged', 'Rejected', 'PendingRemoval'];
var WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw3yK823DH4sQqc1nFkvPKMbAhq2-oa0jrXDS_af_bXADEdrayXn5_XUrvfQE5gSx7wJg/exec';
var MAX_CHECKS_PER_RUN = 12;
var PENDING_TAB = 'Pending';
var REJECTED_TAB = 'Rejected';
var SITE_URL = 'https://diyseosupport.github.io/maps-guide-landing/';
var SITE_TEXT = 'diyseosupport.github.io/maps-guide-landing';

var ADMIN_EMAILS = ['diyseo.support@gmail.com'];
var ALLOW_CLAIM_OLD_ROWS = true;
var PROTECTED_NAMES = ['diyseo']; // nameKey_() values that can never be removed via the form (sheet edit only)
function isDiyseo_(name) { return /^diyseo$/i.test(String(name || '').trim()); }

var EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/;
var URL_RE = /^(https?:\/\/)?([A-Za-z0-9\-]+\.)+[A-Za-z]{2,}(:\d+)?([\/?#]\S*)?$/;

// Columns that will be hidden later. For now nothing is hidden: these are shaded light blue.
var SHADE_HEADERS = /^name$|^title$|how to contact|owner key|google account email|^logo$|status \(private\)|confirm code|check notes|replaces \(private\)|notified \(private\)|approved by/i;
var SHADE_COLOR = '#CFE2F3';

// Business Name cell: name, then this many blank lines, then the category (grey, not bold)
var CATEGORY_GAP = 1;
var CATEGORY_COLOR = '#666666';
var NAME_COLOR = '#5B2A86';

// ---------------------------------------------------------------
// Run once so Google asks for permission
// ---------------------------------------------------------------
// One extra check about a minute after an owner confirms, so good listings go live fast
function checkSoon_() {
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'runChecksSoon') ScriptApp.deleteTrigger(t); });
    ScriptApp.newTrigger('runChecksSoon').timeBased().after(60 * 1000).create();
  } catch (e) { Logger.log('checkSoon_ failed: ' + e); }
}
function runChecksSoon() {
  try { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'runChecksSoon') ScriptApp.deleteTrigger(t); }); } catch (e) { }
  runChecks();
}

// Submitting the form should feel instant. Mail (owner email + boss ping) is queued here and
// sent a second later by a one-off trigger, so doPost does not make the browser wait on GmailApp.
function queueMail_(job) {
  try {
    var id = 'MAILQ_' + Utilities.getUuid();
    PropertiesService.getScriptProperties().setProperty(id, JSON.stringify(job));
    ScriptApp.newTrigger('sendQueuedMail_').timeBased().after(1000).create();
  } catch (e) { Logger.log('queueMail_ failed: ' + e); }
}
function sendQueuedMail_() {
  try { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sendQueuedMail_') ScriptApp.deleteTrigger(t); }); } catch (e) { }
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var stuck = false;
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('MAILQ_') !== 0) return;
    try {
      var job = JSON.parse(all[k]);
      if (job.kind === 'confirm') sendConfirm_(job.to, job.name, job.token, job.ckind, job.data);
      else if (job.kind === 'boss') notifyBoss_(job.name, job.d, job.label);
      else if (job.kind === 'removeConfirm') sendRemoveConfirm_(job.to, job.name, job.token, job.wasLive);
      else if (job.kind === 'removed') {
        if (!job.ownerSent) { sendRemoved_(job.by, job.name, job.wasLive !== false); job.ownerSent = true; props.setProperty(k, JSON.stringify(job)); }
      }
      props.deleteProperty(k);
    } catch (e2) { stuck = true; Logger.log('sendQueuedMail_ job failed, leaving queued to retry: ' + e2); }
  });
  if (stuck) { try { ScriptApp.newTrigger('sendQueuedMail_').timeBased().after(5 * 60 * 1000).create(); } catch (e3) { } }
}

// Adds a "Directory" menu in the sheet
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Directory')
      .addItem('Check pending now (move approved)', 'runChecks')
      .addItem('Refresh the public directory now', 'refreshDirectoryNow')
      .addItem('Send me a test alert email', 'testBossEmail')
      .addItem('What build is live?', 'showBuild')
      .addItem('Backup now', 'backupNowMenu_')
      .addToUi();
  } catch (e) { }
}

function showBuild() {
  try { SpreadsheetApp.getUi().alert('Live build', BUILD, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { }
}

// ---------------------------------------------------------------
// Backups: a full copy of the whole spreadsheet (Full Form, Saves, Pending,
// everything) goes to a "Charlotte Directory Backups" Drive folder once a day,
// plus on demand via the "Backup now" menu item. Keeps the last 30 days; older
// copies are trashed automatically so Drive doesn't fill up. Restoring from a
// bad accidental row deletion: open the backup copy from the day before, copy
// the missing row(s) back into the live sheet - or just rename the backup copy
// to take over, if the damage is bigger than a few rows.
// ---------------------------------------------------------------
var BACKUP_FOLDER_NAME = 'Charlotte Directory Backups';
var BACKUP_KEEP_DAYS = 30;

function backupFolder_() {
  var it = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(BACKUP_FOLDER_NAME);
}

function backupNow() {
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
  var file = DriveApp.getFileById(SHEET_ID).makeCopy('Directory backup ' + stamp, backupFolder_());
  pruneBackups_();
  return file.getUrl();
}

function backupNowMenu_() {
  try {
    var url = backupNow();
    SpreadsheetApp.getUi().alert('Backup created', 'Saved a full copy of the spreadsheet:\n' + url, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Backup failed', String(e), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function dailyBackup_() {
  try { backupNow(); } catch (e) { Logger.log('dailyBackup_ failed: ' + e); }
}

function pruneBackups_() {
  var cutoff = new Date(Date.now() - BACKUP_KEEP_DAYS * 24 * 60 * 60 * 1000);
  var files = backupFolder_().getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getDateCreated() < cutoff) f.setTrashed(true);
  }
}

function refreshDirectoryNow() {
  try { CacheService.getScriptCache().remove('directory_csv'); } catch (e) { }
}

function authorizeOnce() {
  SpreadsheetApp.openById(SHEET_ID).getName();
  getLogoFolder_();
  PropertiesService.getScriptProperties().getKeys();
  UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=test', { muteHttpExceptions: true });
  MailApp.getRemainingDailyQuota();
  pendingSheet_();
  ScriptApp.getProjectTriggers();
  try { Logger.log('Send-as addresses: ' + GmailApp.getAliases().join(', ')); } catch (e) { Logger.log('Gmail permission needed: ' + e); }
  Logger.log('All set. Now Deploy > Manage deployments > pencil > New version.');
}

// ---------------------------------------------------------------
// Web app
// ---------------------------------------------------------------
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.preview) {
    var c = CacheService.getScriptCache(), msg = 'Preview already sent in the last 2 minutes.';
    if (!c.get('preview')) { c.put('preview', '1', 120); try { msg = previewEmails(); } catch (pe) { msg = 'Preview failed: ' + pe; } }
    return ContentService.createTextOutput(msg);
  }
  if (p.ping) return ContentService.createTextOutput('Directory form receiver is running. Build: ' + BUILD);
  var useCallback = p.callback && /^[A-Za-z_][\w.]*$/.test(p.callback);
  if (p.check) {
    var rep; try { rep = healthCheck_(); } catch (ce) { rep = 'Check failed: ' + ce; }
    if (useCallback) return ContentService.createTextOutput(p.callback + '(' + JSON.stringify(rep) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
    return ContentService.createTextOutput(rep);
  }
  if (p.logo && useCallback) return logoReply_(p.logo, p.callback);
  if (p.saves && useCallback) return savesReply_(p, p.callback);
  if (p.pending && useCallback) return pendingReply_(p, p.callback);
  if (p.confirm && useCallback) {
    return ContentService.createTextOutput(p.callback + '(' + JSON.stringify(confirmToken_(String(p.confirm))) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  if (p.confirm) return confirmPage_(String(p.confirm));
  if (p.confirmRemove && useCallback) {
    return ContentService.createTextOutput(p.callback + '(' + JSON.stringify(confirmRemoveToken_(String(p.confirmRemove))) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  if (p.confirmRemove) return confirmRemovePage_(String(p.confirmRemove));
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

    // Feedback from the directory site — signed-in users only, no reply sent.
    if (data.action === 'feedback') {
      var msg = String(data.message || '').trim().slice(0, 4000);
      if (!msg) return reply_({ ok: false, error: 'Message is empty.' });
      var shots = (data.shots || []).slice(0, 3).map(function (b64, i) {
        return Utilities.newBlob(Utilities.base64Decode(String(b64)), 'image/jpeg', 'screenshot-' + (i + 1) + '.jpg');
      });
      sendMail_(ADMIN_EMAILS[0], 'Directory feedback', 'From: ' + email + '\n\n' + msg +
          (shots.length ? '\n\n' + shots.length + ' screenshot(s) attached.' : ''), '', { attachments: shots });
      return reply_({ ok: true, kind: 'feedback' });
    }

    var sheet = findSheet_();
    var pend = pendingSheet_();
    var ownerCol = ensureColumn_(sheet, OWNER_HEADER);   // pendingSheet_ above already added every other column
    var key = ownerKey_(email);

    // "Which businesses do I own?"
    if (data.action === 'mine') {
      return reply_({ ok: true, kind: 'mine', businesses: getMine_(sheet, key, isAdmin, ownerCol, pend, email) });
    }

    // "Remove my business" - Step 1: send confirmation email, set status to PendingRemoval
    if (data.action === 'remove') {
      var rmName = String(data.businessName || '').trim();
      if (!rmName) return reply_({ ok: false, error: 'No business chosen.' });
      if (PROTECTED_NAMES.indexOf(nameKey_(rmName)) !== -1) return reply_({ ok: false, error: 'This listing cannot be removed.' });
      if (!ownerAllowed_(sheet, ownerCol, rmName, key) && !ownerAllowed_(pend, ownerCol, rmName, key)) return reply_({ ok: false, error: 'WRONG_OWNER' });
      var headersRm = getHeaders_(sheet);
      var headersPendRm = getHeaders_(pend);
      var rmRows = liveRows_(sheet).filter(function (r) {
        return nameKey_(r.name) === nameKey_(rmName) && (isAdmin || mineMatch_(headersRm, r, ownerCol, key, email));
      });
      var rmPendRows = pendingRows_(pend).filter(function (r) {
        return nameKey_(r.name) === nameKey_(rmName) && (isAdmin || mineMatch_(headersPendRm, r, ownerCol, key, email));
      });
      var siRm = colNamed_(headersRm, STATUS_HEADER);
      rmRows = rmRows.filter(function (r) { return isLiveStatus_(siRm >= 0 ? r.vals[siRm] : ''); });
      if (!rmRows.length && !rmPendRows.length) return reply_({ ok: false, error: 'Business not found.' });
      // Generate removal confirmation token
      var rmToken = Utilities.getUuid().replace(/-/g, '');
      var rmReason = String(data.reason || '').trim().slice(0, 1000);
      var tcRm = colNamed_(headersRm, TOKEN_HEADER);
      var ncRm = colNamed_(headersRm, NOTES_HEADER);
      var noteRm = 'Removal requested by owner (' + email + ') on ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') +
          (rmReason ? '. Reason: ' + rmReason : '');
      // Set status to PendingRemoval and store token (on main sheet rows)
      rmRows.forEach(function (r) {
        if (siRm >= 0) sheet.getRange(r.row, siRm + 1).setValue('PendingRemoval');
        if (tcRm >= 0) sheet.getRange(r.row, tcRm + 1).setValue(rmToken);
        if (ncRm >= 0) sheet.getRange(r.row, ncRm + 1).setValue(noteRm);
      });
      // Also mark pending rows
      var siPendRm = colNamed_(headersPendRm, STATUS_HEADER);
      var tcPendRm = colNamed_(headersPendRm, TOKEN_HEADER);
      var ncPendRm = colNamed_(headersPendRm, NOTES_HEADER);
      rmPendRows.forEach(function (r) {
        if (siPendRm >= 0) pend.getRange(r.row, siPendRm + 1).setValue('PendingRemoval');
        if (tcPendRm >= 0) pend.getRange(r.row, tcPendRm + 1).setValue(rmToken);
        if (ncPendRm >= 0) pend.getRange(r.row, ncPendRm + 1).setValue(noteRm);
      });
      // Send confirmation email - use public business email if available
      var rmLive = rmRows.length > 0;
      var emColRm = colNamed_(headersRm, 'Email');
      var rmSendTo = email;
      if (emColRm >= 0 && rmRows.length > 0) {
        var pubEmail = String(rmRows[0].vals[emColRm] || '').trim().toLowerCase();
        if (pubEmail && EMAIL_RE.test(pubEmail)) rmSendTo = pubEmail;
      }
      queueMail_({ kind: 'removeConfirm', to: rmSendTo, name: rmName, token: rmToken, wasLive: rmLive });
      return reply_({ ok: true, kind: 'remove' });
    }

    var problem = validate_(data);
    if (problem) return reply_({ ok: false, error: problem });

    var newName = String(data.businessName).trim();
    var oldName = String(data.originalName || '').trim();
    var checkName = oldName || newName;

    if (!isAdmin && !(ownerAllowed_(sheet, ownerCol, checkName, key) && ownerAllowed_(pend, ownerCol, checkName, key))) {
      return reply_({ ok: false, error: 'WRONG_OWNER' });
    }

    var live = liveRows_(sheet);
    if (oldName && !isAdmin) {
      var hdUp = getHeaders_(sheet), siUp = colNamed_(hdUp, STATUS_HEADER);
      var ownLive = live.some(function (r) {
        return nameKey_(r.name) === nameKey_(oldName) && isLiveStatus_(siUp >= 0 ? r.vals[siUp] : '') && mineMatch_(hdUp, r, ownerCol, key, email);
      });
      var hpUp = getHeaders_(pend), pocUp = colNamed_(hpUp, OWNER_HEADER) + 1;
      var ownWaiting = pendingRows_(pend).some(function (r) {
        return nameKey_(r.name) === nameKey_(oldName) && mineMatch_(hpUp, r, pocUp, key, email);
      });
      if (!ownLive && !ownWaiting) return reply_({ ok: false, error: 'NOT_LIVE' });
    }
    var pendNow = pendingRows_(pend).filter(function (r) { return nameKey_(r.name) === nameKey_(checkName); });
    pendNow.forEach(function (r) { r.tab = 'p'; });
    var oldRows = live.filter(function (r) { return nameKey_(r.name) === nameKey_(checkName); }).concat(pendNow);

    // Renaming to a name somebody else already uses
    if (oldName && nameKey_(oldName) !== nameKey_(newName)) {
      var taken = live.some(function (r) { return nameKey_(r.name) === nameKey_(newName); });
      if (taken) return reply_({ ok: false, error: 'NAME_TAKEN' });
    }

    var headers = getHeaders_(sheet);
    var logoIdx = colByKey_(headers, 'logo');
    var ownerIdx = ownerCol - 1;
    var emailIdx = colOf_(headers, function (t) { return t === EMAIL_HEADER; });
    var statusIdx = colOf_(headers, function (t) { return t === STATUS_HEADER; });
    var lastOld = oldRows.length ? oldRows[oldRows.length - 1] : null;
    var oldLogo = (lastOld && logoIdx >= 0) ? String(lastOld.vals[logoIdx] || '') : '';

    // Keep the first owner (so admin edits do not steal a listing)
    var saveKey = key, saveEmail = email;
    if (lastOld && String(lastOld.vals[ownerIdx] || '')) {
      saveKey = String(lastOld.vals[ownerIdx]);
      if (emailIdx >= 0 && String(lastOld.vals[emailIdx] || '')) saveEmail = String(lastOld.vals[emailIdx]);
    }

    // Old rows that are LIVE stay live until the new version is approved. Unfinished old versions are replaced now.
    var liveOld = oldRows.filter(function (r) { return isLiveStatus_(statusIdx >= 0 ? r.vals[statusIdx] : ''); });
    var staleOld = oldRows.filter(function (r) { return r.tab === 'p'; });

    // Logo
    var logoUrl = '';
    if (data.logoData) {
      logoUrl = saveLogo_(data);
    } else if (data.logoAction === 'keep') {
      logoUrl = oldLogo;
    } else if (data.logoAction === 'delete') {
      if (!liveOld.length) trashLogo_(oldLogo);
      logoUrl = '';
    }

    var listEmail = String(data.email || '').trim().toLowerCase();
    var sendTo = listEmail || email;
    // Updates skip the email check (this account already owns the listing): straight to Pending
    var ckind = liveOld.length ? 'updateLive' : (oldRows.length ? 'updateWaiting' : 'new');
    var isUpdate = ckind !== 'new';
    var token = isUpdate ? '' : Utilities.getUuid().replace(/-/g, '');
    var status = isUpdate ? 'Pending' : 'Unconfirmed';
    var replaces = (oldName && nameKey_(oldName) !== nameKey_(newName)) ? oldName : '';

    var extra = {};
    extra[STATUS_HEADER] = status;
    extra[TOKEN_HEADER] = token;
    extra[NOTES_HEADER] = '';
    extra[REPLACES_HEADER] = replaces;
    extra[NOTIFIED_HEADER] = '';
    addRow_(pend, data, logoUrl, saveKey, saveEmail, extra);
    hideRows_(pend, staleOld);
    CacheService.getScriptCache().remove('directory_csv');

    // Send the email now (queued mail waits on a Google timer that can take minutes). Queue it only if this fails.
    // Skip confirmation emails for DIYSEO entries
    if (!isDiyseo_(newName)) {
      try { sendConfirm_(sendTo, newName, token, ckind, data); }
      catch (ce) { queueMail_({ kind: 'confirm', to: sendTo, name: newName, token: token, ckind: ckind, data: data }); }
    }
    if (isUpdate) checkSoon_();
    return reply_({ ok: true, status: status, emailTo: sendTo });
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

function htmlEsc_(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Confirmation email to the person who submitted: a neat copy of what was saved, in the directory's brand look
function sendLink_(to, businessName, d, logoUrl) {
  d = d || {};
  var BADGE = 'YOUR LISTING IS LIVE!';
  var rows = [];
  function add(label, value, href, shown, icon) {
    value = String(value || '').trim();
    if (!value) return;
    rows.push({ label: label, value: value, href: href || '', shown: shown || '', icon: icon || '' });
  }
  var listingUrl = DIRECTORY_URL + '?card=' + encodeURIComponent(businessName);
  var who = [d.pubName, d.pubTitle].filter(function (x) { return String(x || '').trim(); }).join(', ');
  var stateZip = [d.state, d.zip].filter(function (x) { return String(x || '').trim(); }).join(' ');
  var addr = [d.street, d.city, stateZip].filter(function (x) { return String(x || '').trim(); }).join(', ');
  add('Category', d.category);
  add('Slogan', d.slogan);
  add('Contact', who);
  add('Phone', d.phone, d.phone ? 'tel:' + String(d.phone).replace(/[^\d+]/g, '') : '');
  add('Email', d.email, d.email ? 'mailto:' + d.email : '');
  add('Website', d.website, d.website ? fullUrl_(d.website) : '');
  add('Facebook', d.facebook, d.facebook ? fullUrl_(d.facebook) : '', '', FB_ICON);
  add('NextDoor', d.ndBiz, d.ndBiz ? fullUrl_(d.ndBiz) : '', '', ND_ICON);
  add('NextDoor', d.ndPersonal, d.ndPersonal ? fullUrl_(d.ndPersonal) : '', '', ND_ICON);
  add('Google Reviews', d.reviews, d.reviews ? fullUrl_(d.reviews) : '', 'See our Google reviews');
  add('Address', addr, addr ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr) : '');
  add('About', splitDescribe_(d.describe).text);
  add('Mobile service area', d.area);

  var INK = '#1a1033', PURPLE = '#7b3ff2', MAGENTA = '#0070e0', ORANGE = '#ff7a1a', YELLOW = '#ffd23f', CREAM = '#fff6dc';
  var HEAD = "'Bangers','Impact','Arial Black',sans-serif";
  var BODY = "'Walter Turncoat','Comic Sans MS','Trebuchet MS',Arial,sans-serif";

  var trs = rows.map(function (r) {
    var val = r.href
        ? '<a href="' + htmlEsc_(r.href) + '" style="color:' + PURPLE + ';font-weight:bold">' + htmlEsc_(r.shown || r.value.replace(/^https?:\/\//i, '')) + '</a>'
        : htmlEsc_(r.value).replace(/\n/g, '<br>');
    var iconHtml = r.icon ? '<img src="' + htmlEsc_(r.icon) + '" width="18" height="18" alt="" style="display:inline-block;vertical-align:middle;margin-right:6px;width:18px;height:18px">' : '';
    return '<tr><td style="padding:10px 0;border-bottom:2px dotted #d9c9a0">' +
        '<div class="lbl" style="font-family:' + HEAD + ';font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:' + MAGENTA + ';line-height:1.2;padding-bottom:3px">' + iconHtml + htmlEsc_(r.label) + '</div>' +
        '<div class="val" style="font-family:' + BODY + ';font-size:16px;color:' + INK + ';line-height:1.4;word-break:break-word">' + val + '</div></td></tr>';
  }).join('');

  var inline = {};
  var logoHtml = '';
  var lm = /[?&]id=([\w-]+)/.exec(String(logoUrl || ''));
  if (lm) {
    try {
      try { inline.logo = DriveApp.getFileById(lm[1]).getBlob().setName('logo'); }
      catch (e1) { inline.logo = UrlFetchApp.fetch('https://lh3.googleusercontent.com/d/' + lm[1], { muteHttpExceptions: false }).getBlob().setName('logo'); }
      logoHtml = '<td width="76" style="padding-right:14px;vertical-align:middle"><img src="cid:logo" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:contain;background:#fff;border:3px solid ' + INK + ';border-radius:10px"></td>';
    } catch (logoErr) { inline = {}; logoHtml = ''; }
  }

  var html =
      '<html><head><meta charset="utf-8"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:480px){.pad{padding:16px 14px 6px!important}.biz{font-size:24px!important}.lbl{font-size:13px!important}.val{font-size:15px!important}.bar{padding:10px 14px!important}}</style><link href="https://fonts.googleapis.com/css2?family=Walter+Turncoat&family=Bangers&display=swap" rel="stylesheet"></head>' +
      '<body style="margin:0;padding:0;background:' + PURPLE + '">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + PURPLE + '"><tr><td align="center" style="padding:20px 10px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:' + CREAM + ';border:4px solid ' + INK + ';border-radius:18px;overflow:hidden;box-shadow:6px 6px 0 ' + INK + '">' +
      // banner
      '<tr><td style="padding:0;background:' + PURPLE + '"><img src="' + htmlEsc_(BANNER_URL) + '" width="600" alt="Charlotte County Small Business Directory" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:#fff;font-family:' + HEAD + ';font-size:22px"></td></tr>' +
      // color stripe
      '<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td height="10" width="25%" style="background:' + PURPLE + ';font-size:0;line-height:0">&nbsp;</td><td width="25%" style="background:' + MAGENTA + ';font-size:0;line-height:0">&nbsp;</td>' +
      '<td width="25%" style="background:' + ORANGE + ';font-size:0;line-height:0">&nbsp;</td><td width="25%" style="background:' + YELLOW + ';font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>' +
      '<tr><td class="pad" style="padding:22px 22px 8px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="text-align:center">' +
      '<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center" bgcolor="' + PURPLE + '" style="background:' + PURPLE + ';color:#ffffff;border:3px solid ' + INK + ';border-radius:8px;padding:6px 16px;font-family:' + HEAD + ';font-size:20px;letter-spacing:1.5px;text-align:center">' + BADGE + '</td></tr></table>' +
      '</td></tr></table>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>' + logoHtml +
      '<td style="vertical-align:middle"><div class="biz" style="font-family:' + HEAD + ';font-size:30px;letter-spacing:1px;color:#0e95a8;line-height:1.1">' + htmlEsc_(businessName) + '</div></td></tr></table>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse">' + trs + '</table>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 10px"><tr><td align="center" style="text-align:center">' +
      '<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center"><a href="' + htmlEsc_(listingUrl) + '" style="background:' + ORANGE + ';color:#fff;text-decoration:none;padding:12px 26px;border:3px solid ' + INK + ';border-radius:12px;font-family:' + HEAD + ';font-size:20px;letter-spacing:1.5px;display:block;text-align:center;box-shadow:3px 3px 0 ' + INK + '">SEE YOUR LISTING</a></td></tr></table>' +
      '</td></tr></table>' +
      '<p style="font-family:' + BODY + ';font-size:14px;color:' + INK + ';line-height:1.5">Need to change or remove it? <a href="' + htmlEsc_(FORM_URL) + '" style="color:' + PURPLE + ';font-weight:bold">Open the form</a>, sign in with this same Google account, and pick &ldquo;Update my business&rdquo; or &ldquo;Remove my business&rdquo;.</p>' +
      '</td></tr>' +
      '<tr><td class="bar" style="background:' + INK + ';padding:12px 22px;font-family:' + HEAD + ';font-size:14px;letter-spacing:2px;color:' + YELLOW + ';text-align:center;line-height:1.5">CHARLOTTE COUNTY<br>SMALL BUSINESS DIRECTORY</td></tr>' +
      footerRow_() + '</table></td></tr></table></body></html>';

  var text = 'Your listing "' + businessName + '" is live in the directory.\n\n' +
      rows.map(function (r) { return r.label + ': ' + (r.href && r.label !== 'Phone' && r.label !== 'Email' ? r.href : r.value); }).join('\n') + '\n\n' +
      'See your listing: ' + listingUrl + '\n\n' +
      'Need to change or remove it? Open the form (' + FORM_URL + '), sign in with this same Google account, ' +
      'and pick "Update my business" or "Remove my business".\n\n' +
      SITE_TEXT + '  ' + SITE_URL;

  var opts = {
    to: to,
    subject: "You're live in the directory: " + businessName,
    body: text,
    htmlBody: html,
    name: 'Charlotte County Small Business Directory'
  };
  if (inline.logo) opts.inlineImages = inline;
  opts.replyTo = FROM_EMAIL;
  if (DRY_RUN_) { DRY_RUN_.push(opts.subject); return; }
  try {
    // Sends as FROM_EMAIL (needs the Send-as alias set up in Gmail)
    var g = { htmlBody: html, name: 'Charlotte County Small Business Directory', from: FROM_EMAIL, replyTo: FROM_EMAIL };
    if (inline.logo) g.inlineImages = inline;
    GmailApp.sendEmail(to, opts.subject, text, g);
  } catch (aliasErr) {
    MailApp.sendEmail(opts);   // fallback: sends from the script owner
  }
}

// ---------------------------------------------------------------
// Status (Unconfirmed -> Pending -> Approved / Flagged / Rejected)
// ---------------------------------------------------------------
// Empty status = an old listing from before v25. It stays live.
function isLiveStatus_(v) {
  var t = String(v == null ? '' : v).trim().toLowerCase();
  return t === '' || t === 'approved';
}

function statusRule_() {
  return SpreadsheetApp.newDataValidation().requireValueInList(STATUS_LIST, true).setAllowInvalid(true).build();
}

function ensureStatusCols_(sheet) {
  ensureColumns_(sheet, [STATUS_HEADER, TOKEN_HEADER, NOTES_HEADER, REPLACES_HEADER, NOTIFIED_HEADER, APPROVED_HEADER]);
}

// Adds every missing heading with ONE read and ONE write
function ensureColumns_(sheet, list) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
  var add = list.filter(function (h) { return headers.indexOf(h) === -1; });
  if (!add.length) return;
  sheet.getRange(1, lastCol + 1, 1, add.length).setValues([add]);
}

function cellByKey_(headers, vals, key) {
  var i = colByKey_(headers, key);
  if (i < 0) return '';
  var v = vals[i];
  return (v instanceof Date) ? '' : String(v == null ? '' : v);
}

function colNamed_(headers, name) {
  return colOf_(headers, function (t) { return t === name; });
}

// ---------------------------------------------------------------
// Emails: confirm, pending, rejected (live uses sendLink_)
// ---------------------------------------------------------------
// Bottom of every email: your logo and website
function footerRow_() {
  return '<tr><td align="center" style="background:#7b3ff2;padding:8px 12px;text-align:center">' +
    '<a href="' + htmlEsc_(SITE_URL) + '" style="text-decoration:none;display:inline-block;vertical-align:middle">' +
    '<img src="' + htmlEsc_(QR_URL) + '" width="32" height="32" alt="DIYSEO" style="display:inline-block;vertical-align:middle;width:32px;height:32px;object-fit:contain;background:transparent;border:0;border-radius:0"></a>' +
    '</td></tr>';
}

function sendMail_(to, subject, text, html, extra) {
  extra = extra || {};
  if (DRY_RUN_) { DRY_RUN_.push(subject); return; }
  try {
    var g = { htmlBody: html, name: 'Charlotte County Small Business Directory', from: FROM_EMAIL, replyTo: FROM_EMAIL };
    if (extra.attachments) g.attachments = extra.attachments;
    GmailApp.sendEmail(to, subject, text, g);
  } catch (aliasErr) {
    var o = { to: to, subject: subject, body: text, htmlBody: html, name: 'Charlotte County Small Business Directory', replyTo: FROM_EMAIL };
    if (extra.attachments) o.attachments = extra.attachments;
    MailApp.sendEmail(o);
  }
}

// Same look as the listing email: banner, stripe, cream card, one message, optional button
function noticeHtml_(badge, businessName, paragraphs, buttonLabel, buttonHref, badgeHref, afterParagraphs, rawHtml) {
  var INK = '#1a1033', PURPLE = '#7b3ff2', MAGENTA = '#0070e0', ORANGE = '#ff7a1a', YELLOW = '#ffd23f', CREAM = '#fff6dc';
  var HEAD = "'Bangers','Impact','Arial Black',sans-serif";
  var BODY = "'Walter Turncoat','Comic Sans MS','Trebuchet MS',Arial,sans-serif";
  var paraStyle = 'font-family:' + BODY + ';font-size:16px;color:' + INK + ';line-height:1.5;margin:0 0 12px';
  var paras = paragraphs.map(function (t) {
    return '<p style="' + paraStyle + '">' + t + '</p>';
  }).join('');
  var afterParas = (afterParagraphs || []).map(function (t) {
    return '<p style="' + paraStyle + '">' + t + '</p>';
  }).join('');
  var extraHtml = rawHtml || '';
  var btn = buttonHref
      ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 10px"><tr><td align="center" style="text-align:center"><table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center"><a href="' + htmlEsc_(buttonHref) + '" style="background:' + ORANGE + ';color:#fff;text-decoration:none;padding:12px 26px;border:3px solid ' + INK + ';border-radius:12px;font-family:' + HEAD + ';font-size:20px;letter-spacing:1.5px;display:block;text-align:center;box-shadow:3px 3px 0 ' + INK + '">' + htmlEsc_(buttonLabel) + '</a></td></tr></table></td></tr></table>'
      : '';
  var badgeInner = badgeHref
      ? '<a href="' + htmlEsc_(badgeHref) + '" style="color:#ffffff;text-decoration:none;display:block">' + htmlEsc_(badge) + '</a>'
      : htmlEsc_(badge);
  return '<html><head><meta charset="utf-8"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:480px){.pad{padding:16px 14px 6px!important}.biz{font-size:24px!important}.bar{padding:10px 14px!important}}</style><link href="https://fonts.googleapis.com/css2?family=Walter+Turncoat&family=Bangers&display=swap" rel="stylesheet"></head>' +
      '<body style="margin:0;padding:0;background:' + PURPLE + '">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + PURPLE + '"><tr><td align="center" style="padding:20px 10px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:' + CREAM + ';border:4px solid ' + INK + ';border-radius:18px;overflow:hidden;box-shadow:6px 6px 0 ' + INK + '">' +
      '<tr><td style="padding:0;background:' + PURPLE + '"><img src="' + htmlEsc_(BANNER_URL) + '" width="600" alt="Charlotte County Small Business Directory" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:#fff;font-family:' + HEAD + ';font-size:22px"></td></tr>' +
      '<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td height="10" width="25%" style="background:' + PURPLE + ';font-size:0;line-height:0">&nbsp;</td><td width="25%" style="background:' + MAGENTA + ';font-size:0;line-height:0">&nbsp;</td>' +
      '<td width="25%" style="background:' + ORANGE + ';font-size:0;line-height:0">&nbsp;</td><td width="25%" style="background:' + YELLOW + ';font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>' +
      '<tr><td class="pad" style="padding:22px 22px 8px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="text-align:center">' +
      '<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center" bgcolor="' + PURPLE + '" style="background:' + PURPLE + ';color:#ffffff;border:3px solid ' + INK + ';border-radius:8px;padding:6px 16px;font-family:' + HEAD + ';font-size:20px;letter-spacing:1.5px;text-align:center">' + badgeInner + '</td></tr></table>' +
      '</td></tr></table>' +
      '<div class="biz" style="font-family:' + HEAD + ';font-size:30px;letter-spacing:1px;color:#0e95a8;line-height:1.1;margin:16px 0 12px">' + htmlEsc_(businessName) + '</div>' +
      paras + btn + afterParas + extraHtml +
      '</td></tr>' +
      '<tr><td class="bar" style="background:' + INK + ';padding:12px 22px;font-family:' + HEAD + ';font-size:14px;letter-spacing:2px;color:' + YELLOW + ';text-align:center;line-height:1.5">CHARLOTTE COUNTY<br>SMALL BUSINESS DIRECTORY</td></tr>' +
      footerRow_() + '</table></td></tr></table></body></html>';
}

function sendConfirm_(to, businessName, token, kind, data) {
  // Our own page, not the web app: Apps Script pages break for people signed into several Google accounts
  var link = DIRECTORY_URL + '?confirm=' + encodeURIComponent(token);
  var upd = kind === 'updateLive' || kind === 'updateWaiting';
  if (upd) return sendUpdatePending_(to, businessName, kind === 'updateLive', data);
  var intro = kind === 'updateLive'
      ? 'Thanks for updating your listing. Your changes are <b>not</b> live yet. Your current listing stays up until the changes are approved.'
      : kind === 'updateWaiting'
      ? 'Thanks for updating your listing. It replaces the version you sent before, and it is <b>not</b> listed yet.'
      : 'Thanks for adding your business to the directory. It is <b>not</b> listed yet.';
  var html = noticeHtml_(upd ? 'CONFIRM YOUR UPDATE' : 'CONFIRM YOUR EMAIL', businessName, [
    intro,
    'Tap the button to confirm this email is yours.'
  ], 'CONFIRM MY EMAIL', link, link, [
    '<b>Next:</b> we check that your website works and matches your listing details. We review images for clarity, obscenity, etc. If needed, we may text, call, or email you. Usually a few hours, up to 12. We will email you when you are live.',
    'Not you? Ignore this email.'
  ]);
  var text = (upd ? 'Confirm your update' : 'Confirm your email') + '\n\n' + intro.replace(/<[^>]+>/g, '') + '\n\nConfirm this email is yours:\n' + link +
      '\n\nNext: we check that your website works and matches your listing details. We review images for clarity, obscenity, etc. If needed, we may text, call, or email you. Usually a few hours, up to 12. We will email you when you are live.' +
      '\n\nNot you? Ignore this email.';
  sendMail_(to, (upd ? 'Confirm your update: ' : 'Confirm your email: ') + businessName, text, html);
}

// Updates need no email check: just tell the owner the new version is waiting for review
function sendUpdatePending_(to, businessName, wasLive, data) {
  data = data || {};
  var listingUrl = DIRECTORY_URL + '?card=' + encodeURIComponent(businessName);
  var first = wasLive
      ? 'We got your changes. They are <b>pending</b> review. Your current listing stays up until they are approved.'
      : 'We got your changes. They replace the version you sent before and are <b>pending</b> review.';
  var next = 'We check that your website works and matches your listing details, and we review images for clarity, obscenity, etc. Usually a few hours, up to 12. We will email you when the changes are live.';

  // Build submitted changes summary
  var changes = [];
  if (data.category) changes.push('<b>Category:</b> ' + htmlEsc_(data.category));
  if (data.pubName || data.pubTitle) changes.push('<b>Contact:</b> ' + htmlEsc_([data.pubName, data.pubTitle].filter(Boolean).join(', ')));
  if (data.phone) changes.push('<b>Phone:</b> ' + htmlEsc_(data.phone));
  if (data.email) changes.push('<b>Email:</b> ' + htmlEsc_(data.email));
  if (data.website) changes.push('<b>Website:</b> ' + htmlEsc_(data.website));
  if (data.describe) changes.push('<b>About:</b> ' + htmlEsc_(splitDescribe_(data.describe).text));
  if (data.slogan) changes.push('<b>Slogan:</b> ' + htmlEsc_(data.slogan));
  if (data.street || data.city) changes.push('<b>Address:</b> ' + htmlEsc_([data.street, data.city, data.state, data.zip].filter(Boolean).join(', ')));
  if (data.area) changes.push('<b>Service area:</b> ' + htmlEsc_(data.area));
  if (data.facebook) changes.push('<b>Facebook:</b> ' + htmlEsc_(data.facebook));
  if (data.ndBiz) changes.push('<b>NextDoor:</b> ' + htmlEsc_(data.ndBiz));
  if (data.logoAction === 'new') changes.push('<b>Logo:</b> New logo uploaded');
  if (data.logoAction === 'delete') changes.push('<b>Logo:</b> Removed');

  var BODY = "'Walter Turncoat','Comic Sans MS','Trebuchet MS',Arial,sans-serif";
  var changesHtml = changes.length ? '<p style="margin:16px 0 8px;font-weight:bold;font-family:' + BODY + ';font-size:16px;color:#1a1033">Your submitted changes:</p><ul style="margin:0;padding-left:20px;font-family:' + BODY + ';font-size:15px;color:#1a1033">' + changes.map(function(c){ return '<li style="margin:4px 0">' + c + '</li>'; }).join('') + '</ul>' : '';
  var linkHtml = wasLive ? '<p style="margin:16px 0;font-family:' + BODY + '"><a href="' + htmlEsc_(listingUrl) + '" style="color:#7b3ff2;font-weight:bold">See your current listing</a></p>' : '';

  var html = noticeHtml_('UPDATE PENDING', businessName, [first, next, 'Did not do this? Reply to this email right away.'], null, null, null, null, changesHtml + linkHtml);

  var textChanges = changes.length ? '\n\nYour submitted changes:\n' + changes.map(function(c){ return '- ' + c.replace(/<[^>]+>/g, ''); }).join('\n') : '';
  var text = 'Update pending\n\n' + first.replace(/<[^>]+>/g, '') + '\n\n' + next + textChanges + (wasLive ? '\n\nSee your current listing: ' + listingUrl : '') + '\n\nDid not do this? Reply to this email right away.';
  sendMail_(to, 'Update pending: ' + businessName, text, html);
}

function sendRemoveConfirm_(to, businessName, token, wasLive) {
  var link = FORM_URL + '?confirmRemove=' + encodeURIComponent(token);
  var intro = wasLive
      ? 'You requested to remove <b>' + htmlEsc_(businessName) + '</b> from the directory.'
      : 'You requested to withdraw your submission for <b>' + htmlEsc_(businessName) + '</b>.';
  var html = noticeHtml_('CONFIRM REMOVAL', businessName, [
    intro,
    'Tap the button below to confirm this removal. If you did not request this, just ignore this email.'
  ], 'CONFIRM REMOVAL', link, link, [
    'This link expires in 24 hours.'
  ]);
  var text = 'Confirm removal\n\n' + intro.replace(/<[^>]+>/g, '') + '\n\nTap the link to confirm:\n' + link +
      '\n\nIf you did not request this, just ignore this email. This link expires in 24 hours.';
  sendMail_(to, 'Confirm removal: ' + businessName, text, html);
}

function sendRemoved_(to, businessName, wasLive) {
  var first = wasLive
      ? '<b>' + htmlEsc_(businessName) + '</b> is no longer in the directory.'
      : 'Your submission for <b>' + htmlEsc_(businessName) + '</b> was withdrawn. It will not be listed.';
  var html = noticeHtml_(wasLive ? 'LISTING REMOVED' : 'SUBMISSION WITHDRAWN', businessName, [
    first,
    'Changed your mind? Sign in and add it again as a new business.',
    'Did not do this? Reply to this email right away.'
  ]);
  var text = (wasLive ? 'Listing removed' : 'Submission withdrawn') + '\n\n' + first.replace(/<[^>]+>/g, '') + '\n\n' +
      'Changed your mind? Sign in and add it again as a new business.\n\nDid not do this? Reply to this email right away.';
  sendMail_(to, (wasLive ? 'Listing removed: ' : 'Submission withdrawn: ') + businessName, text, html);
}

function sendRejected_(to, businessName) {
  var html = noticeHtml_('NOT APPROVED', businessName, [
    'We reviewed <b>' + htmlEsc_(businessName) + '</b> and could not approve it for the directory.',
    'Questions? Just reply to this email.'
  ], '', '');
  var text = 'Not approved\n\n"' + businessName + '" could not be approved for the directory.\n\nQuestions? Just reply to this email.';
  sendMail_(to, 'Update on your listing: ' + businessName, text, html);
}

// ---------------------------------------------------------------
// The confirm link in the email lands here (web app, ?confirm=CODE)
// ---------------------------------------------------------------
function confirmPageHtml_(title, lines, good) {
  var INK = '#1a1033', PURPLE = '#7b3ff2', ORANGE = '#ff7a1a', YELLOW = '#ffd23f', CREAM = '#fff6dc';
  var body = lines.map(function (t) { return '<p>' + t + '</p>'; }).join('');
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_top">' +
      '<link href="https://fonts.googleapis.com/css2?family=Walter+Turncoat&family=Bangers&display=swap" rel="stylesheet">' +
      '<style>body{margin:0;background:' + PURPLE + ';font-family:"Walter Turncoat","Comic Sans MS",Arial,sans-serif;color:' + INK + ';padding:20px 12px}' +
      '.c{max-width:520px;margin:0 auto;background:' + CREAM + ';border:4px solid ' + INK + ';border-radius:18px;box-shadow:6px 6px 0 ' + INK + ';padding:22px;text-align:center}' +
      'h1{font-family:Bangers,Impact,sans-serif;font-weight:400;letter-spacing:1.5px;font-size:30px;margin:0 0 10px;color:' + (good ? PURPLE : INK) + ';border-bottom:4px dotted ' + (good ? YELLOW : '#d9c9a0') + ';padding-bottom:8px;display:inline-block}' +
      'p{font-size:17px;line-height:1.5;margin:12px 0}a.b{display:inline-block;background:' + ORANGE + ';color:#fff;text-decoration:none;font-family:Bangers,Impact,sans-serif;letter-spacing:1.5px;font-size:20px;padding:12px 26px;border:3px solid ' + INK + ';border-radius:12px;box-shadow:3px 3px 0 ' + INK + '}</style></head><body><div class="c">' +
      '<h1>' + htmlEsc_(title) + '</h1>' + body +
      '<p><a class="b" href="' + htmlEsc_(DIRECTORY_URL) + '">SEE THE DIRECTORY</a></p>' +
      '<p style="margin-top:18px"><a href="' + htmlEsc_(SITE_URL) + '" style="text-decoration:none;display:inline-block;vertical-align:middle">' +
      '<img src="' + htmlEsc_(QR_URL) + '" width="32" height="32" alt="DIYSEO" style="display:inline-block;vertical-align:middle;width:32px;height:32px;object-fit:contain;background:transparent;border:0;border-radius:0"></a></p></div></body></html>';
}

// Confirms the email for a pending row. Returns { res: 'done' | 'used' | 'error', name }.
// form.html?confirm=CODE calls this by JSONP; old emails that link to the web app use confirmPage_.
function confirmToken_(token) {
  var out;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var done = false, bizName = '', sendTo = '', d = null;
    if (/^[A-Fa-f0-9]{20,64}$/.test(token)) {
      var sheet = pendingSheet_();
      var headers = getHeaders_(sheet);
      var tc = colNamed_(headers, TOKEN_HEADER), sc = colNamed_(headers, STATUS_HEADER), n = nameCol_(headers);
      var lastRow = sheet.getLastRow();
      if (tc >= 0 && sc >= 0 && n >= 0 && lastRow >= 2) {
        var vals = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
        for (var i = 0; i < vals.length; i++) {
          if (String(vals[i][tc]) === token && String(vals[i][sc]).trim().toLowerCase() === 'unconfirmed') {
            var r = { row: i + 2, name: firstLine_(vals[i][n]), vals: vals[i] };
            sheet.getRange(r.row, sc + 1).setValue('Pending');
            sheet.getRange(r.row, tc + 1).setValue('');
            var ec = colNamed_(headers, EMAIL_HEADER);
            d = rowObj_(headers, r);
            bizName = r.name;
            sendTo = String(d.email || '').trim().toLowerCase() || (ec >= 0 ? String(vals[i][ec] || '') : '');
            done = true;
            break;
          }
        }
      }
    }
    if (done) {
      checkSoon_();
    }
    out = { res: done ? 'done' : 'used', name: bizName };
  } catch (err) {
    out = { res: 'error', name: '' };
  } finally {
    try { lock.releaseLock(); } catch (ignore) { }
  }
  return out;
}

function confirmPage_(token) {
  var r = confirmToken_(token), out, bizName = r.name;
  if (r.res === 'done') {
    out = confirmPageHtml_("YOU'RE PENDING!", [
      'Thank you! Your email is confirmed.',
      '<b>' + htmlEsc_(bizName) + '</b> is now <b>Pending</b> while we verify it.',
      'Verification checks that your website (if any) loads and shows your business name, phone, or email, and that your logo is not copyrighted, obscene, or graphic. This usually takes a few hours and can take up to 12. We will email you the result.'
    ], true);
  } else {
    out = confirmPageHtml_('ALL SET', [
      'This link was already used, or it is no longer valid.',
      'If you added a business, your email is already confirmed and your listing is Pending while we verify it. Verification usually takes a few hours and can take up to 12. We will email you the result.'
    ], false);
  }
  if (r.res === 'error') out = confirmPageHtml_('OOPS', ['Something went wrong. Please try the link again in a minute, or email us.'], false);
  return HtmlService.createHtmlOutput(out).setTitle('Charlotte County Small Business Directory')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Confirms a removal request. Returns { res: 'done' | 'used' | 'error', name }.
// form.html?confirmRemove=CODE calls this by JSONP.
function confirmRemoveToken_(token) {
  var out;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var done = false, bizName = '', sendTo = '';
    if (/^[A-Fa-f0-9]{20,64}$/.test(token)) {
      var sheet = directorySheet_();
      var pend = pendingSheet_();
      var headers = getHeaders_(sheet);
      var headersPend = getHeaders_(pend);
      var tc = colNamed_(headers, TOKEN_HEADER), sc = colNamed_(headers, STATUS_HEADER), n = nameCol_(headers);
      var ec = colNamed_(headers, EMAIL_HEADER), nc = colNamed_(headers, NOTES_HEADER);
      var tcP = colNamed_(headersPend, TOKEN_HEADER), scP = colNamed_(headersPend, STATUS_HEADER), nP = nameCol_(headersPend);
      var ecP = colNamed_(headersPend, EMAIL_HEADER), ncP = colNamed_(headersPend, NOTES_HEADER);

      // Check main directory sheet
      var lastRow = sheet.getLastRow();
      if (tc >= 0 && sc >= 0 && n >= 0 && lastRow >= 2) {
        var vals = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
        for (var i = 0; i < vals.length; i++) {
          if (String(vals[i][tc]) === token && String(vals[i][sc]).trim().toLowerCase() === 'pendingremoval') {
            bizName = firstLine_(vals[i][n]);
            sendTo = ec >= 0 ? String(vals[i][ec] || '') : '';
            var noteVal = nc >= 0 ? String(vals[i][nc] || '') : '';
            noteVal += ' | Confirmed removal on ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
            if (nc >= 0) sheet.getRange(i + 2, nc + 1).setValue(noteVal);
            sheet.hideRows(i + 2);
            sheet.getRange(i + 2, tc + 1).setValue('');
            done = true;
          }
        }
      }
      // Check pending sheet
      var lastRowP = pend.getLastRow();
      if (tcP >= 0 && scP >= 0 && nP >= 0 && lastRowP >= 2) {
        var valsP = pend.getRange(2, 1, lastRowP - 1, pend.getLastColumn()).getValues();
        for (var j = 0; j < valsP.length; j++) {
          if (String(valsP[j][tcP]) === token && String(valsP[j][scP]).trim().toLowerCase() === 'pendingremoval') {
            if (!bizName) bizName = firstLine_(valsP[j][nP]);
            if (!sendTo && ecP >= 0) sendTo = String(valsP[j][ecP] || '');
            var noteValP = ncP >= 0 ? String(valsP[j][ncP] || '') : '';
            noteValP += ' | Confirmed removal on ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
            if (ncP >= 0) pend.getRange(j + 2, ncP + 1).setValue(noteValP);
            pend.hideRows(j + 2);
            pend.getRange(j + 2, tcP + 1).setValue('');
            done = true;
          }
        }
      }
      // Send final removal confirmation email
      if (done && sendTo) {
        try { CacheService.getScriptCache().remove('directory_csv'); } catch (cacheErr) { }
        queueMail_({ kind: 'removed', by: sendTo, name: bizName, wasLive: true });
      }
    }
    out = { res: done ? 'done' : 'used', name: bizName };
  } catch (err) {
    out = { res: 'error', name: '' };
  } finally {
    try { lock.releaseLock(); } catch (ignore) { }
  }
  return out;
}

function confirmRemovePage_(token) {
  var r = confirmRemoveToken_(token), out, bizName = r.name;
  if (r.res === 'done') {
    out = confirmPageHtml_('LISTING REMOVED', [
      '<b>' + htmlEsc_(bizName) + '</b> has been removed from the directory.',
      'Changed your mind? You can sign in and add it again as a new business.'
    ], true);
  } else {
    out = confirmPageHtml_('LINK EXPIRED', [
      'This removal link was already used or has expired.',
      'If you still want to remove your listing, sign in to the form and request removal again.'
    ], false);
  }
  if (r.res === 'error') out = confirmPageHtml_('OOPS', ['Something went wrong. Please try the link again in a minute, or email us.'], false);
  return HtmlService.createHtmlOutput(out).setTitle('Charlotte County Small Business Directory')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------------------------------------------------------------
// Pending tab (v27): new submissions wait here. When approved they move to the directory tab.
// ---------------------------------------------------------------
// Pending tab shows the same columns, in the same order, as the directory tab.
// (A reordered-header version of this shipped briefly and was reverted: Sheets has no safe way
// to relabel column 1 as "Status" without physically moving the data underneath it, and rewriting
// just the header row desynced old rows from their own data. Scannability comes from color-coding
// and hidden columns below instead, neither of which touches where data actually lives.)
function pendHeaderOrder_(mainHeaders) {
  return mainHeaders;
}
// Same row, reordered from one sheet's column layout to another's, by header name (not position).
function remapRow_(srcHeaders, destHeaders, vals) {
  return destHeaders.map(function (h) {
    var i = srcHeaders.indexOf(h);
    return i >= 0 ? vals[i] : '';
  });
}
function trimHeaders_(h) { return h.map(function (x) { return String(x).trim(); }); }

function pendingSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var main = findSheet_();
  ensureColumns_(main, [TIMESTAMP_HEADER, NAME_HEADER, TITLE_HEADER, HOW_HEADER, OWNER_HEADER, EMAIL_HEADER, HIDDEN_HEADER,
    STATUS_HEADER, TOKEN_HEADER, NOTES_HEADER, REPLACES_HEADER, NOTIFIED_HEADER, APPROVED_HEADER, LICENSED_HEADER, OTHER_HEADER]);
  var pend = ss.getSheetByName(PENDING_TAB);
  var cols = main.getLastColumn();
  if (!pend) {
    pend = ss.insertSheet(PENDING_TAB, ss.getSheets().length);
    try { pend.setTabColor('#ff7a1a'); } catch (e) { }
    try { pend.setFrozenRows(1); } catch (e2) { }
  }
  if (pend.getMaxColumns() < cols) pend.insertColumnsAfter(pend.getMaxColumns(), cols - pend.getMaxColumns());
  var mh = trimHeaders_(main.getRange(1, 1, 1, cols).getValues()[0]);
  var target = pendHeaderOrder_(mh);
  var ph = pend.getLastColumn() ? trimHeaders_(pend.getRange(1, 1, 1, Math.min(pend.getLastColumn(), target.length)).getValues()[0]) : [];
  var same = ph.length === target.length;
  for (var i = 0; same && i < target.length; i++) { if (ph[i] !== target[i]) same = false; }
  if (!same) {
    pend.getRange(1, 1, 1, target.length).setValues([target]);
    target.forEach(function (h, idx) {
      var srcCol = mh.indexOf(h) + 1;
      if (srcCol > 0) { try { pend.setColumnWidth(idx + 1, main.getColumnWidth(srcCol)); } catch (we) { } }
    });
    try { pend.showColumns(1, target.length); } catch (se) { }
    target.forEach(function (h, idx) {
      if (!PENDING_SHOW.test(h)) { try { pend.hideColumns(idx + 1); } catch (he) { } }
    });
    applyPendingStatusColors_(pend, target.indexOf(STATUS_HEADER) + 1, target.length);
  }
  return pend;
}

// Rejected rows land here instead of being deleted, so you can look back at them.
function rejectedSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var pend = pendingSheet_();
  var cols = pend.getLastColumn();
  var rej = ss.getSheetByName(REJECTED_TAB);
  if (!rej) {
    rej = ss.insertSheet(REJECTED_TAB, ss.getSheets().length);
    try { rej.setTabColor('#e5322d'); } catch (e) { }
    try { rej.setFrozenRows(1); } catch (e2) { }
  }
  if (rej.getMaxColumns() < cols) rej.insertColumnsAfter(rej.getMaxColumns(), cols - rej.getMaxColumns());
  var ph = trimHeaders_(pend.getRange(1, 1, 1, cols).getValues()[0]);
  var rh = rej.getLastColumn() ? trimHeaders_(rej.getRange(1, 1, 1, Math.min(rej.getLastColumn(), ph.length)).getValues()[0]) : [];
  var same = rh.length === ph.length;
  for (var i = 0; same && i < ph.length; i++) { if (rh[i] !== ph[i]) same = false; }
  if (!same) rej.getRange(1, 1, 1, ph.length).setValues([ph]);
  return rej;
}

// Status at a glance: Flagged (needs you) yellow, Approved green, Rejected red - whole row, not just the cell.
function applyPendingStatusColors_(pend, statusCol, lastCol) {
  if (statusCol < 1 || statusCol > 26) return; // keeps the formula's column letter simple
  try {
    var lastRow = Math.max(pend.getMaxRows(), 200);
    var range = pend.getRange(2, 1, lastRow - 1, lastCol);
    var L = String.fromCharCode(64 + statusCol);
    var rules = [
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L + '2="Flagged"').setBackground('#FFF3B0').setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L + '2="Approved"').setBackground('#D9F2D0').setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L + '2="Rejected"').setBackground('#F8D0D0').setRanges([range]).build()
    ];
    pend.setConditionalFormatRules(rules);
  } catch (e) { Logger.log('applyPendingStatusColors_ failed: ' + e); }
}

// Rows of the pending tab that are still in line
function pendingRows_(pend) {
  return liveRows_(pend);
}

// Moves any waiting rows still sitting in the directory tab over to the Pending tab (runs by itself)
function migratePendingRows_(main, pend) {
  var mainHeaders = trimHeaders_(getHeaders_(main));
  var pendHeaders = trimHeaders_(getHeaders_(pend));
  var sc = colNamed_(mainHeaders, STATUS_HEADER);
  if (sc < 0) return;
  var rows = liveRows_(main).filter(function (o) {
    var st = String(o.vals[sc] || '').trim().toLowerCase();
    return st === 'unconfirmed' || st === 'pending' || st === 'flagged';
  });
  if (!rows.length) return;
  var pendSc = colNamed_(pendHeaders, STATUS_HEADER);
  rows.forEach(function (o) {
    var target = nextFreeRow_(pend, pendHeaders);
    var destVals = remapRow_(mainHeaders, pendHeaders, o.vals);
    pend.getRange(target, 1, 1, destVals.length).setValues([destVals]);
    if (pendSc >= 0) { try { pend.getRange(target, pendSc + 1).setDataValidation(statusRule_()); } catch (e) { } }
  });
  for (var i = rows.length - 1; i >= 0; i--) { main.deleteRow(rows[i].row); }
  try { CacheService.getScriptCache().remove('directory_csv'); } catch (ce) { }
}

// Approved rows move to the directory tab (then the normal approve step emails the owner and replaces old versions).
// Rejected rows email the owner and leave the tab.
function movePendingDecisions_(main, pend) {
  var headers = trimHeaders_(getHeaders_(pend));
  var mainHeaders = trimHeaders_(getHeaders_(main));
  var sc = colNamed_(headers, STATUS_HEADER), nfc = colNamed_(headers, NOTIFIED_HEADER);
  var ec = colNamed_(headers, EMAIL_HEADER), apc = colNamed_(headers, APPROVED_HEADER);
  var mainSc = colNamed_(mainHeaders, STATUS_HEADER);
  if (sc < 0) return;
  var rows = liveRows_(pend);
  var moved = false;
  for (var i = rows.length - 1; i >= 0; i--) {
    var o = rows[i];
    var st = String(o.vals[sc] || '').trim().toLowerCase();
    if (st === 'approved') {
      var vals = o.vals.slice();
      if (nfc >= 0) vals[nfc] = '';
      if (apc >= 0 && !String(vals[apc] || '').trim()) vals[apc] = 'Manual (you) ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
      var destVals = remapRow_(headers, mainHeaders, vals);
      var target = nextFreeRow_(main, mainHeaders);
      main.getRange(target, 1, 1, destVals.length).setValues([destVals]);
      if (mainSc >= 0) { try { main.getRange(target, mainSc + 1).setDataValidation(statusRule_()); } catch (e) { } }
      try { main.getRange(target, 1, 1, destVals.length).setFontFamily('Montserrat'); } catch (fe) { }
      pend.deleteRow(o.row);
      moved = true;
    } else if (st === 'rejected') {
      var d = rowObj_(headers, o);
      var to = String(d.email || '').trim().toLowerCase() || (ec >= 0 ? String(o.vals[ec] || '') : '');
      var rej = rejectedSheet_();
      var rejHeaders = trimHeaders_(getHeaders_(rej));
      var rTarget = nextFreeRow_(rej, rejHeaders);
      var rVals = remapRow_(headers, rejHeaders, o.vals);
      rej.getRange(rTarget, 1, 1, rVals.length).setValues([rVals]);
      pend.deleteRow(o.row);
      moved = true;
    }
  }
  if (moved) finishRows_(main);
}

// ---------------------------------------------------------------
// Hourly check. Run setupTriggers once. After that it runs by itself.
//   Pending rows are checked: website loads and shows the business, no duplicate owner.
//   Pass -> Approved (live, owner emailed). Fail -> Flagged (you decide in the sheet).
//   Rows you set to Approved or Rejected are finished here too.
// ---------------------------------------------------------------
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'runChecks' || fn === 'onStatusEdit_' || fn === 'dailyBackup_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runChecks').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('onStatusEdit_').forSpreadsheet(SHEET_ID).onEdit().create();
  ScriptApp.newTrigger('dailyBackup_').timeBased().everyDays(1).atHour(3).create();
  Logger.log('Hourly check, instant-approve-on-edit, and the daily backup are on. You can also run runChecks or Backup now by hand any time.');
}

// You setting Status to Approved/Rejected by hand in the Pending tab moves it to the
// main tab (and the live directory) right away, instead of waiting for the hourly check.
// Any hand edit to the Full Form tab (delete a row, blank it out, tweak a field) also
// busts the directory cache right away, so the live site matches the sheet within a minute
// instead of waiting up to 6 hours for the cache to expire on its own.
function onStatusEdit_(e) {
  try {
    var sh = e.range.getSheet();
    if (sh.getName() !== PENDING_TAB) {
      if (sh.getSheetId() === SHEET_GID) { try { CacheService.getScriptCache().remove('directory_csv'); } catch (ce) { } }
      return;
    }
    var headers = getHeaders_(sh);
    var sc = colNamed_(headers, STATUS_HEADER);
    if (sc < 0) return;
    var col = sc + 1;
    if (col < e.range.getColumn() || col > e.range.getLastColumn()) return;
    var val = String(sh.getRange(e.range.getRow(), col).getValue() || '').trim().toLowerCase();
    if (val !== 'approved' && val !== 'rejected') return;
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return;
    try {
      var main = findSheet_();
      movePendingDecisions_(main, sh);
      finishRows_(main);
    } finally { lock.releaseLock(); }
  } catch (err) { Logger.log('onStatusEdit_ failed: ' + err); }
}

function digits10_(v) {
  var d = String(v || '').replace(/\D/g, '');
  if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
  return d.length === 10 ? d : '';
}

function hostOf_(v) {
  var t = String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  return t.split(/[\/?#]/)[0];
}

function checkListing_(d, ownerKeyVal, rowNo, allRows) {
  // rowNo is a unique id like 'p12' (pending tab) or 'd12' (directory tab)
  var notes = [], fail = false;
  if (d.logoId) { notes.push('Logo needs your review'); fail = true; }

  // 1. Website (or, if there is none, Facebook or NextDoor) loads and shows the owner's phone
  // number (digits only). Business name is not required. Tries each page in turn, stops at the first pass.
  var pages = [['website', 'Website'], ['facebook', 'Facebook'], ['ndBiz', 'NextDoor']]
      .filter(function (p) { return String(d[p[0]] || '').trim(); });
  if (!pages.length) {
    notes.push('No website, Facebook, or NextDoor page to check');
    fail = true;
  } else {
    var ph = digits10_(d.phone);
    var passed = false, lastNote = '';
    for (var pi = 0; pi < pages.length && !passed; pi++) {
      var label = pages[pi][1], url = String(d[pages[pi][0]]).trim();
      try {
        var resp = UrlFetchApp.fetch(fullUrl_(url), { muteHttpExceptions: true, followRedirects: true, validateHttpsCertificates: true,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DirectoryCheck/1.0)' } });
        var code = resp.getResponseCode();
        if (code >= 400) { lastNote = label + ' will not load (error ' + code + ')'; continue; }
        var pageDigits = resp.getContentText().replace(/\D/g, '');
        if (ph && pageDigits.indexOf(ph) !== -1) { notes.push(label + ' loads and shows the phone number'); passed = true; }
        else lastNote = 'Phone not found on ' + label;
      } catch (fe) {
        lastNote = label + ' will not load';
      }
    }
    if (!passed) { notes.push(lastNote || 'Phone not found'); fail = true; }
  }

  // 2. Duplicates owned by somebody else (live or in line)
  var ph2 = digits10_(d.phone), em2 = String(d.email || '').trim().toLowerCase(), host2 = hostOf_(d.website);
  var dup = [];
  allRows.forEach(function (o) {
    if (o.uid === rowNo) return;
    if (String(o.vals[o.ownerCol - 1] || '') === ownerKeyVal) return;
    var st = String(o.status || '').trim().toLowerCase();
    if (st === 'rejected') return;
    var c = parseContact_(cellByKey_(o.headers, o.vals, 'contact'));
    if (ph2 && digits10_(c.phone) === ph2) dup.push('phone matches "' + o.name + '" (row ' + o.row + ')');
    else if (em2 && String(c.email || '').trim().toLowerCase() === em2) dup.push('email matches "' + o.name + '" (row ' + o.row + ')');
    else if (host2 && hostOf_(c.website) === host2) dup.push('website matches "' + o.name + '" (row ' + o.row + ')');
  });
  if (dup.length) { notes.push('Duplicate: ' + dup.slice(0, 3).join('; ')); fail = true; }
  else notes.push('No duplicates');

  return { ok: !fail, notes: notes.join(' | ') };
}

function runChecks() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var main = findSheet_();
    var sheet = pendingSheet_();
    migratePendingRows_(main, sheet);
    var headers = getHeaders_(sheet).map(function (h) { return String(h).trim(); });
    var mainHeaders = getHeaders_(main).map(function (h) { return String(h).trim(); });
    var sc = colNamed_(headers, STATUS_HEADER), nc = colNamed_(headers, NOTES_HEADER);
    var mainSc = colNamed_(mainHeaders, STATUS_HEADER);
    var ownerCol = colNamed_(headers, OWNER_HEADER) + 1;
    var mainOwnerCol = colNamed_(mainHeaders, OWNER_HEADER) + 1;
    var inLine = liveRows_(sheet);
    inLine.forEach(function (o) { o.status = String(o.vals[sc] || ''); o.uid = 'p' + o.row; o.headers = headers; o.ownerCol = ownerCol; });
    var dirRows = liveRows_(main);
    dirRows.forEach(function (o) { o.status = String(o.vals[mainSc] || ''); o.uid = 'd' + o.row; o.headers = mainHeaders; o.ownerCol = mainOwnerCol; });
    var live = inLine.concat(dirRows);

    // Pending -> Approved / Flagged
    var pending = inLine.filter(function (o) { return o.status.trim().toLowerCase() === 'pending'; }).slice(0, MAX_CHECKS_PER_RUN);
    var newlyFlagged = [];
    var apc = colNamed_(headers, APPROVED_HEADER);
    pending.forEach(function (o) {
      var d = rowObj_(headers, o);
      var res;
      try { res = checkListing_(d, String(o.vals[ownerCol - 1] || ''), o.uid, live); }
      catch (e) { res = { ok: false, notes: 'Check error: ' + e }; }
      var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
      sheet.getRange(o.row, nc + 1).setValue(stamp + ' - ' + res.notes);
      sheet.getRange(o.row, sc + 1).setValue(res.ok ? 'Approved' : 'Flagged');
      if (res.ok && apc >= 0) sheet.getRange(o.row, apc + 1).setValue('Auto-check ' + stamp);
      o.status = res.ok ? 'Approved' : 'Flagged';
      if (!res.ok) newlyFlagged.push({ name: o.name, d: d, notes: res.notes });
    });

    movePendingDecisions_(main, sheet);
    finishRows_(main);
    try { CacheService.getScriptCache().remove('directory_csv'); } catch (ce0) { }
    // One email per listing that needs you (with its logo). Auto-approved listings send you nothing.
    newlyFlagged.forEach(function (f) { notifyBoss_(f.name, f.d, 'NEEDS YOUR REVIEW', f.notes); });
  } finally {
    try { lock.releaseLock(); } catch (ignore) { }
  }
}

// Rows set to Approved (by the check or by you) go live and the owner is told. Rows set to Rejected are removed.
function finishRows_(sheet) {
  ensureColumns_(sheet, [LIVE_HEADER]);
  var headers = getHeaders_(sheet);
  var sc = colNamed_(headers, STATUS_HEADER), nfc = colNamed_(headers, NOTIFIED_HEADER), rc = colNamed_(headers, REPLACES_HEADER);
  var ec = colNamed_(headers, EMAIL_HEADER), tsc = colByKey_(headers, 'timestamp'), lvc = colNamed_(headers, LIVE_HEADER);
  if (sc < 0 || nfc < 0) return;
  var live = liveRows_(sheet);
  var changed = false;
  live.forEach(function (o) {
    var st = String(o.vals[sc] || '').trim().toLowerCase();
    if (String(o.vals[nfc] || '').trim() !== '') return;
    if (st !== 'approved' && st !== 'rejected') return;
    var d = rowObj_(headers, o);
    var to = String(d.email || '').trim().toLowerCase() || (ec >= 0 ? String(o.vals[ec] || '') : '');
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    if (st === 'approved') {
      // Replace the older live version(s) of this listing
      var keys = {};
      keys[nameKey_(o.name)] = 1;
      if (rc >= 0 && String(o.vals[rc] || '').trim()) keys[nameKey_(o.vals[rc])] = 1;
      var myTime = (tsc >= 0 && o.vals[tsc] instanceof Date) ? o.vals[tsc].getTime() : Infinity;
      var older = live.filter(function (x) {
        if (x.row === o.row || !keys[nameKey_(x.name)]) return false;
        var xs = String(x.vals[sc] || '').trim().toLowerCase();
        if (xs !== '' && xs !== 'approved') return false;
        var xt = (tsc >= 0 && x.vals[tsc] instanceof Date) ? x.vals[tsc].getTime() : 0;
        return xt < myTime;
      });
      hideRows_(sheet, older);
      sheet.getRange(o.row, nfc + 1).setValue(stamp);
      if (lvc >= 0) sheet.getRange(o.row, lvc + 1).setValue(stamp);
      changed = true;
      if (!to && !isDiyseo_(o.name)) sendBossMail_('\u26A0\uFE0F NO EMAIL FOR LIVE LISTING: ' + o.name, 'This listing went live but has no email to tell the owner.');
      if (to && !isDiyseo_(o.name)) {
        try { sendLink_(to, o.name, d, 'https://drive.google.com/open?id=' + (d.logoId || '')); }
        catch (me) { sendBossMail_('\u26A0\uFE0F LIVE EMAIL FAILED: ' + o.name, 'Could not send the "your listing is live" email to ' + to + '.\n\n' + me); }
      }
    } else {
      hideRows_(sheet, [o]);
      sheet.getRange(o.row, nfc + 1).setValue(stamp);
      changed = true;
      if (to) {
        try { sendRejected_(to, o.name); } catch (me) { }
      }
    }
  });
  if (changed) { try { CacheService.getScriptCache().remove('directory_csv'); } catch (ce) { } }
}

// ---------------------------------------------------------------
// Saved cards (one row per signed-in user, tab "Saves")
// ---------------------------------------------------------------
function savesSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName('Saves');
  var isNew = !sh;
  if (isNew) sh = ss.insertSheet('Saves');
  // Keeps the header row correct even on a tab that existed before this column layout shipped.
  var head = ['Email (private)', 'Saved cards (JSON)', 'Updated', 'Saved businesses -->'];
  sh.getRange(1, 1, 1, head.length).setValues([head]);
  if (isNew) { sh.setFrozenRows(1); sh.setFrozenColumns(3); }
  return sh;
}

function savesReply_(p, cb) {
  var out;
  try {
    var email = verifyToken_(p.token);
    if (!email) {
      out = { ok: false, error: 'LOGIN_EXPIRED' };
    } else {
      var ops = {};
      try { ops = JSON.parse(p.ops || '{}'); } catch (e) { ops = {}; }
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        var sh = savesSheet_();
        var data = sh.getDataRange().getValues();
        var row = 0, keys = {};
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][0]).toLowerCase() === email) {
            row = i + 1;
            try { JSON.parse(String(data[i][1])).forEach(function (k) { keys[k] = 1; }); } catch (e2) { }
            break;
          }
        }
        var n = 0;
        for (var k in ops) {
          if (n++ > 500) break;
          var kk = String(k).slice(0, 150);
          if (ops[k]) keys[kk] = 1; else delete keys[kk];
        }
        var list = Object.keys(keys).slice(0, 300);
        var json = JSON.stringify(list);
        var neededCols = 3 + list.length;
        if (sh.getMaxColumns() < neededCols) sh.insertColumnsAfter(sh.getMaxColumns(), neededCols - sh.getMaxColumns());
        if (row) {
          var oldLast = sh.getLastColumn();
          if (oldLast >= 4) sh.getRange(row, 4, 1, oldLast - 3).clearContent();
          if (list.length) sh.getRange(row, 4, 1, list.length).setValues([list]);
          sh.getRange(row, 2, 1, 2).setValues([[json, new Date()]]);
        } else {
          sh.appendRow([email, json, new Date()].concat(list));
        }
        out = { ok: true, keys: list };
      } finally {
        lock.releaseLock();
      }
    }
  } catch (err) {
    out = { ok: false, error: 'Could not sync saves.' };
  }
  var js = JSON.stringify(out).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return ContentService.createTextOutput(cb + '(' + js + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
}


// ---------------------------------------------------------------
// Boss alerts (v26)
// ---------------------------------------------------------------
// Email to you when a listing becomes Pending. Subject always starts with "NEW PENDING:" so you can filter it.
function notifyBoss_(name, d, label, notes) {
  try {
    d = d || {};
    var pend = pendingSheet_();
    var pendingUrl = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit#gid=' + pend.getSheetId();
    var listingUrl = DIRECTORY_URL + '?card=' + encodeURIComponent(name);
    var lines = [
      'Tap the link below to open the Pending tab, then set Status to Approved (goes live) or Rejected.',
      notes ? 'Why it needs you: ' + notes : '',
      '',
      'Business: ' + name,
      'Category: ' + (d.category || ''),
      'Contact: ' + [d.pubName, d.pubTitle].filter(Boolean).join(', '),
      'Phone: ' + (d.phone || ''),
      'Email: ' + (d.email || ''),
      'Website: ' + (d.website || '(none)'),
      'Logo: ' + (d.logoId ? 'attached below, check it before approving' : '(none)'),
      '',
      'SEE LISTING: ' + listingUrl,
      'OPEN PENDING TAB: ' + pendingUrl,
      '',
      SITE_TEXT + '  ' + SITE_URL
    ];
    var logo = null;
    if (d.logoId) { try { logo = DriveApp.getFileById(d.logoId).getBlob().setName('logo-' + nameKey_(name).replace(/[^a-z0-9]+/g, '-') + '.jpg'); } catch (le) { lines.push('', '(Could not attach the logo: ' + le + ')'); } }
    sendBossMail_('\uD83D\uDD14 ' + label + ': ' + name, lines.join('\n'), logo);
  } catch (e) { Logger.log('notifyBoss_ failed: ' + e); }
}

// Tries the normal way first, then the backup way. Errors go to the log (Apps Script > Executions).
// image (optional): a logo blob, shown in the email and attached so you can open it full size
function sendBossMail_(subject, body, image) {
  if (DRY_RUN_) { DRY_RUN_.push(subject); return; }
  var o = { name: 'Charlotte County Small Business Directory' };
  if (image) {
    o.htmlBody = '<pre style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">' + htmlEsc_(body) + '</pre>' +
        '<p><img src="cid:logo" alt="Logo" style="max-width:320px;border:2px solid #1a1033;border-radius:8px"></p>';
    o.inlineImages = { logo: image };
    o.attachments = [image];
  }
  try {
    MailApp.sendEmail({ to: ADMIN_EMAILS[0], subject: subject, body: body, name: o.name, htmlBody: o.htmlBody, inlineImages: o.inlineImages, attachments: o.attachments });
  } catch (e1) {
    Logger.log('MailApp failed: ' + e1);
    try { GmailApp.sendEmail(ADMIN_EMAILS[0], subject, body, o); }
    catch (e2) { Logger.log('GmailApp failed too: ' + e2); }
  }
}

// Read-only health check: open the web app URL with ?check=1. Sends no email, changes nothing in the sheet.
// Every owner email is built (so a broken one shows up here) but caught before it goes out.
var DRY_RUN_ = null;
function healthCheck_() {
  var out = ['Build: ' + BUILD, ''], bad = 0;
  function ok(msg) { out.push('OK       ' + msg); }
  function no(msg) { out.push('PROBLEM  ' + msg); bad++; }
  var ss = SpreadsheetApp.openById(SHEET_ID), main = null, mh = [];
  try { main = findSheet_(); mh = trimHeaders_(getHeaders_(main)); ok('Full Form tab found, ' + liveRows_(main).length + ' listings showing'); }
  catch (e) { no('Full Form tab: ' + e); }
  if (main) {
    var need = [TIMESTAMP_HEADER, OWNER_HEADER, EMAIL_HEADER, HIDDEN_HEADER, STATUS_HEADER, TOKEN_HEADER, NOTES_HEADER, OTHER_HEADER];
    var missing = need.filter(function (h) { return mh.indexOf(h) < 0; });
    if (missing.length) no('Full Form missing columns: ' + missing.join(', ') + ' (added on next submission)');
    else ok('Full Form has all script columns');
  }
  var pend = ss.getSheetByName(PENDING_TAB);
  if (!pend) no('No Pending tab (made on next submission)');
  else if (main) {
    var ph = pend.getLastColumn() ? trimHeaders_(pend.getRange(1, 1, 1, pend.getLastColumn()).getValues()[0]) : [];
    var off = [];
    mh.forEach(function (h, i) { if (ph[i] !== h) off.push(String.fromCharCode(65 + (i % 26)) + ' "' + h + '" vs "' + (ph[i] || '') + '"'); });
    if (off.length) no('Pending headers do not line up with Full Form: ' + off.slice(0, 5).join('; ') + ' (do not move Pending columns)');
    else ok('Pending headers line up with Full Form');
    var sc = ph.indexOf(STATUS_HEADER), counts = {};
    if (sc >= 0 && pend.getLastRow() > 1) {
      pend.getRange(2, 1, pend.getLastRow() - 1, ph.length).getValues().forEach(function (r) {
        if (!String(r[0]).trim()) return;
        var s = String(r[sc]).trim() || '(blank)'; counts[s] = (counts[s] || 0) + 1;
      });
    }
    var parts = Object.keys(counts).map(function (k) { return k + ' ' + counts[k]; });
    ok('Pending rows: ' + (parts.length ? parts.join(', ') : 'none'));
    if (counts.Flagged) out.push('         ' + counts.Flagged + ' Flagged waiting for your review');
  }
  try { var q = MailApp.getRemainingDailyQuota(); (q > 5 ? ok : no)('Emails left today: ' + q); } catch (e2) { no('Email quota: ' + e2); }
  var queued = Object.keys(PropertiesService.getScriptProperties().getProperties()).filter(function (k) { return k.indexOf('MAILQ_') === 0; }).length;
  (queued ? no : ok)('Emails waiting in queue: ' + queued + (queued ? ' (retrying every 5 min)' : ''));
  var fns = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  ['runChecks', 'onStatusEdit_', 'dailyBackup_'].forEach(function (f) { (fns.indexOf(f) >= 0 ? ok : no)('Trigger ' + f + (fns.indexOf(f) >= 0 ? ' is on' : ' is missing (run setupTriggers)')); });
  try { var fs = DriveApp.getFoldersByName(LOGO_FOLDER_NAME); (fs.hasNext() ? ok : no)('Logo folder "' + LOGO_FOLDER_NAME + '"' + (fs.hasNext() ? ' found' : ' not found (made on first logo)')); } catch (e3) { no('Drive: ' + e3); }
  try { var csv = publicCsv_(); ok('Directory data builds (' + csv.length + ' characters)'); } catch (e4) { no('Directory data: ' + e4); }
  DRY_RUN_ = [];
  try {
    var to = ADMIN_EMAILS[0], name = 'Sample Business', d = {};
    if (main) { var rows = liveRows_(main), r = rows[rows.length - 1]; if (r) { d = rowObj_(main.getRange(1, 1, 1, main.getLastColumn()).getValues()[0], r); name = r.name; } }
    sendConfirm_(to, name, 'CHECK000000000000000000', null, d);
    sendUpdatePending_(to, name, true, d);
    sendLink_(to, name, d, '');
    sendRejected_(to, name);
    sendRemoved_(to, name, true);
    sendRemoved_(to, name, false);
    ok('Emails build fine (none sent): ' + DRY_RUN_.length);
    DRY_RUN_.forEach(function (s) { out.push('           ' + s); });
  } catch (e5) { no('Building emails: ' + e5); }
  DRY_RUN_ = null;
  out.splice(1, 0, bad ? bad + ' problem(s) found' : 'All good');
  return out.join('\n');
}

// Run this once by hand. It sends you a test email so you know alerts reach you.
// Sends one copy of every owner email (confirm, live, not approved, removed) to the boss.
// Run it from the editor, or open the web app URL with ?preview=1 (only ever mails the boss).
function previewEmails() {
  var to = ADMIN_EMAILS[0];
  var main = findSheet_(), headers = getHeaders_(main);
  var rows = liveRows_(main), r = rows[rows.length - 1];
  var d = r ? rowObj_(headers, r) : {}, name = r ? r.name : 'Sample Business';
  sendConfirm_(to, name, 'PREVIEW0000000000000000', null, d);
  sendConfirm_(to, name, 'PREVIEW0000000000000000', 'updateLive', d);
  sendLink_(to, name, d, 'https://drive.google.com/open?id=' + (d.logoId || ''));
  sendRejected_(to, name);
  sendRemoved_(to, name, true);
  sendRemoved_(to, name, false);
  return 'Sent 6 preview emails to ' + to + ' using "' + name + '".';
}

function testBossEmail() {
  sendBossMail_('\uD83D\uDD14 TEST: boss alerts work', 'If you can read this, new-listing alerts will reach you.\n\n' + SITE_TEXT + '  ' + SITE_URL);
  Logger.log('Test email sent to ' + ADMIN_EMAILS[0] + '. Check Inbox and Spam. Daily mail quota left: ' + MailApp.getRemainingDailyQuota());
}

// Safety net: once an hour, one email for any waiting listing you have not been told about yet
function bossDigest_(pend) {
  try {
    var props = PropertiesService.getScriptProperties();
    var seen = {};
    try { JSON.parse(props.getProperty('BOSS_SEEN') || '[]').forEach(function (k) { seen[k] = 1; }); } catch (pe) { }
    var headers = getHeaders_(pend);
    var sc = colNamed_(headers, STATUS_HEADER);
    var fresh = [];
    liveRows_(pend).forEach(function (o) {
      var st = String(o.vals[sc] || '').trim().toLowerCase();
      if (st !== 'pending' && st !== 'flagged' && st !== 'unconfirmed') return;
      var k = nameKey_(o.name) + '|' + st;
      if (seen[k]) return;
      seen[k] = 1;
      fresh.push(o.name + ' (' + st + ')');
    });
    if (!fresh.length) return;
    props.setProperty('BOSS_SEEN', JSON.stringify(Object.keys(seen).slice(-400)));
    sendBossMail_('\uD83D\uDCCB WAITING: ' + fresh.length + ' listing(s) in the Pending tab',
      'These are waiting:\n\n' + fresh.join('\n') + '\n\n' + SpreadsheetApp.openById(SHEET_ID).getUrl() + '\n\n' + SITE_TEXT + '  ' + SITE_URL);
  } catch (e) { Logger.log('bossDigest_ failed: ' + e); }
}

// Sign-in alert: when YOU sign in on the directory, it asks how many listings are waiting. Others get nothing.
function pendingReply_(p, cb) {
  var out = { ok: false };
  try {
    var email = verifyToken_(p.token);
    var isAdmin = email && ADMIN_EMAILS.map(function (a) { return String(a).toLowerCase(); }).indexOf(email) !== -1;
    if (!isAdmin) {
      out = { ok: true, admin: false };
    } else {
      var c = { pending: 0, flagged: 0, unconfirmed: 0 };
      [pendingSheet_(), findSheet_()].forEach(function (sheet) {
        var headers = getHeaders_(sheet);
        var sc = colNamed_(headers, STATUS_HEADER);
        if (sc < 0) return;
        liveRows_(sheet).forEach(function (o) {
          var st = String(o.vals[sc] || '').trim().toLowerCase();
          if (c[st] !== undefined) c[st]++;
        });
      });
      out = { ok: true, admin: true, pending: c.pending, flagged: c.flagged, unconfirmed: c.unconfirmed };
    }
  } catch (err) { out = { ok: false }; }
  var js = JSON.stringify(out);
  return ContentService.createTextOutput(cb + '(' + js + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
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
// A row counts as "mine" if the owner key matches, or (legacy rows with no
// owner key yet) the row's own contact email matches the signed-in email.
function mineMatch_(headers, r, ownerCol, key, loginEmail) {
  var stored = String(r.vals[ownerCol - 1] || '');
  if (stored) return stored === key;
  var o = rowObj_(headers, r);
  return String(o.email || '').trim().toLowerCase() === loginEmail;
}

function getMine_(sheet, key, isAdmin, ownerCol, pend, loginEmail) {
  var headers = getHeaders_(sheet);
  var latest = {};
  var si = colOf_(headers, function (t) { return t === STATUS_HEADER; });
  // Live listings, then waiting ones (Unconfirmed / Pending / Flagged) on top: the newest version is what the owner edits
  liveRows_(sheet).forEach(function (r) {
    if (isLiveStatus_(si >= 0 ? r.vals[si] : '')) latest[nameKey_(r.name)] = { r: r, h: headers, st: 'Approved' };
  });
  if (pend) {
    var ph = getHeaders_(pend), psi = colNamed_(ph, STATUS_HEADER);
    pendingRows_(pend).forEach(function (r) {
      var st = psi >= 0 ? String(r.vals[psi] || '').trim() : '';
      if (/^(rejected|approved)$/i.test(st)) return;
      latest[nameKey_(r.name)] = { r: r, h: ph, st: st || 'Pending' };
    });
  }
  var out = [];
  Object.keys(latest).forEach(function (k) {
    var x = latest[k];
    var oc = colNamed_(x.h, OWNER_HEADER) + 1;
    var mine = isAdmin || mineMatch_(x.h, x.r, oc, key, loginEmail);
    if (!mine) return;
    var o = rowObj_(x.h, x.r);
    o.status = x.st;
    out.push(o);
  });
  out.sort(function (a, b) { return a.businessName.toLowerCase().localeCompare(b.businessName.toLowerCase()); });
  return out;
}


// One sheet row -> the same boxes the form uses (name, phone, street...)
function rowObj_(headers, r) {
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
      delete cp.sites;
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
  var typeLine = (o.street || o.city) ? 'Physical Location'
    : o.area ? 'Mobile Service (landscaping, housecleaner etc)'
    : 'Online Only';
  o.describe = typeLine + '\n\n' + descVal;
  var m = /[?&]id=([\w-]+)/.exec(o.logo || '');
  o.logoId = m ? m[1] : '';
  delete o.logo;
  o.businessName = o.businessName || r.name;
  return o;
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
  ['NextDoor Business', 'ndBiz'], ['NextDoor Personal', 'ndPersonal'], ['Google Reviews', 'reviews']
];
// Short labels typed by hand are understood too
var REVIEW_RE = /(g\.page|g\.co\/kgs|goo\.gl\/maps|maps\.app\.goo\.gl|share\.google|search\.google\.com|google\.[a-z.]+\/(maps|search|business)|maps\.google\.)/i;
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
  var out = { pubName: '', pubTitle: '', phone: '', email: '', website: '', facebook: '', ndBiz: '', ndPersonal: '', reviews: '', sites: [] };
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
    if (noSpace && REVIEW_RE.test(line)) { out.reviews = line; return; }
    if (noSpace && /(facebook\.com|fb\.com|fb\.me)/i.test(line)) { out.facebook = line; return; }
    if (noSpace && (/^(https?:\/\/|www\.)/i.test(line) || /\.[a-z]{2,}(\/|$)/i.test(line))) { if (!out.website) out.website = line; else out.sites.push(line); return; }
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
  var stc = colOf_(head, function (t) { return t === STATUS_HEADER; });

  function cell(row, key) {
    if (idx[key] === undefined) return '';
    var v = row[idx[key]];
    return (v instanceof Date) ? '' : String(v == null ? '' : v).trim();
  }

  var heads = ['Business Name', 'Category', 'Public Contact Name', 'Public Contact Title',
      'About your business', 'Other details', 'Slogan', 'Phone', 'Website', 'Email', 'Facebook',
      'NextDoor Business', 'NextDoor Personal', 'Google Reviews', 'Address', 'Area Served', 'Logo', 'Licensed & Insured'];
  var lines = [heads.map(csvCell_).join(',')];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (n < 0 || firstLine_(row[n]) === '') continue;
    if (hc >= 0 && String(row[hc]).trim() !== '') continue;
    if (stc >= 0 && !isLiveStatus_(row[stc])) continue;

    var nameParts = splitNameCell_(row[n]);
    var bizName = nameParts.name;
    var category = cell(row, 'category') || nameParts.category;

    var ct = parseContact_(cell(row, 'contact'));

    var about = cell(row, 'about');

    lines.push([
      bizName, category, ct.pubName, ct.pubTitle, about, cell(row, 'other'), cell(row, 'slogan'),
      ct.phone, [ct.website].concat(ct.sites).filter(Boolean).join('\n'), ct.email, ct.facebook,
      ct.ndBiz, ct.ndPersonal, ct.reviews, cell(row, 'address'), cell(row, 'area'),
      cell(row, 'logo'), cell(row, 'licensed')
    ].map(csvCell_).join(','));
  }

  var csv = lines.join('\n');
  try { cache.put('directory_csv', csv, 21600); } catch (tooBig) { Logger.log('directory_csv too big to cache (' + csv.length + ' bytes) - every open is rebuilding from the sheet: ' + tooBig); }
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
  ensureStatusCols_(sheet);
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
  all.setFontFamily('Montserrat').setFontSize(11).setVerticalAlignment('top').setWrap(true);
  all.setBorder(true, true, true, true, true, true, '#333333', SpreadsheetApp.BorderStyle.SOLID);

  // Body rows: stripes, bold names, replaced rows red + strikethrough
  var n = nameCol_(headers);
  var hc = colOf_(headers, function (t) { return t === HIDDEN_HEADER; });
  var body = sheet.getRange(2, 1, lastRow - 1, lastCol);
  var vals = body.getValues();
  var shade = headers.map(function (h) { return SHADE_HEADERS.test(String(h).trim()); });
  var sc = colOf_(headers, function (t) { return t === STATUS_HEADER; });
  var STATUS_BG = { unconfirmed: '#EAD1DC', pending: '#FFF2CC', flagged: '#F9CB9C', rejected: '#F4CCCC', approved: '#D9EAD3' };
  var bg = [], fc = [], fl = [], fw = [];
  for (var i = 0; i < vals.length; i++) {
    var replaced = hc >= 0 && String(vals[i][hc]).trim() !== '';
    var stripe = (i % 2 === 0) ? '#FFF6DC' : '#FFFFFF';
    var b = [], f = [], l = [], w = [];
    for (var c = 0; c < lastCol; c++) {
      var sbg = (c === sc && !replaced) ? STATUS_BG[String(vals[i][sc]).trim().toLowerCase()] : '';
      b.push(replaced ? '#F4CCCC' : (sbg || (shade[c] ? SHADE_COLOR : stripe)));
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
      .setBackground('#1A73E8').setFontColor('#FFFFFF').setFontFamily('Oswald').setFontSize(14)
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

  if (sc >= 0) { try { sheet.getRange(2, sc + 1, Math.max(lastRow - 1, 1), 1).setDataValidation(statusRule_()); } catch (dvErr2) { } }
  sheet.getRange(1, 1, lastRow, lastCol).createFilter();
}

// ---------------------------------------------------------------
// Logo
// ---------------------------------------------------------------
// Sends one logo picture (only files inside the Directory Logos folder) so the page can put it in PDFs and contact cards
function logoReply_(id, callback) {
  var obj = {};
  try {
    var f = DriveApp.getFileById(String(id));
    var inFolder = false, parents = f.getParents();
    while (parents.hasNext()) { if (parents.next().getName() === LOGO_FOLDER_NAME) { inFolder = true; break; } }
    if (inFolder) {
      var blob = f.getBlob(), bytes = blob.getBytes();
      if (bytes.length < 1500000) {
        obj = { data: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(bytes) };
      }
    }
  } catch (err) { }
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

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
function addRow_(sheet, data, logoUrl, ownerKey, email, extra) {
  extra = extra || {};
  var headers = getHeaders_(sheet);
  var target = nextFreeRow_(sheet, headers);
  var n = headers.length;
  if (target > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), target - sheet.getMaxRows());
  var tmpl = sheet.getLastRow() >= 2 ? sheet.getRange(2, 1, 1, n).getFormulas()[0] : [];
  var here = sheet.getRange(target, 1, 1, n).getFormulas()[0];
  var row = [], used = {}, statusAt = -1;
  for (var c = 0; c < n; c++) {
    var t = String(headers[c]).trim();
    var value;
    if (t === OWNER_HEADER) value = ownerKey;
    else if (t === EMAIL_HEADER) value = email;
    else if (t === HIDDEN_HEADER) value = '';
    else if (extra.hasOwnProperty(t)) value = extra[t];
    else {
      var key = keyFor_(t);
      // skip headings the form does not fill, and repeat headings (helper/formula columns): keep whatever formula is already there
      if (!key || used[key] || tmpl[c]) { row.push(here[c] || ''); continue; }
      used[key] = true;
      value = valueFor_(t, data, logoUrl);
    }
    if (t === STATUS_HEADER) statusAt = c;
    row.push(value);
  }
  sheet.getRange(target, 1, 1, n).setValues([row]);
  var tsCol = colNamed_(headers, TIMESTAMP_HEADER);
  // colNamed_ is 0-based. Format the whole column so older rows show their time too.
  if (tsCol >= 0) sheet.getRange(2, tsCol + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('M/d/yyyy h:mm am/pm');
  if (statusAt >= 0) { try { sheet.getRange(target, statusAt + 1).setDataValidation(statusRule_()); } catch (dvErr) { } }
  // Keep the data font: Montserrat
  try { sheet.getRange(target, 1, 1, n).setFontFamily('Montserrat'); } catch (fontErr) { }
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
  if (k === 'details' || k === 'other details') return 'other';
  if (k === 'logo') return 'logo';
  if (/licensed/.test(k)) return 'licensed';
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
    var line1 = [String(d.street || '').trim(), String(d.street2 || '').trim()].filter(Boolean).join(', ');
    var line2 = [String(d.city || '').trim(), stateZip].filter(Boolean).join(', ');
    return clean_([line1, line2].filter(Boolean).join('\n'));
  }
  return clean_(d[key]);
}

// Stops a typed answer from being read as a spreadsheet formula
function clean_(value) {
  var v = String(value == null ? '' : value).trim();
  return /^[=+@-]/.test(v) ? "'" + v : v;
}
