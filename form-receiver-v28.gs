/**
 * Directory form receiver (version 28: faster submit, slim Pending tab, Approved By column, auto-approve email)
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
var SHEET_ID = '1mSNjflXI-u1B4zHkbUT2SKx7lklbE08nFwmoFFzYQvE';
var SHEET_GID = 112379302;
var LOGO_FOLDER_NAME = 'Directory Logos';
var DIRECTORY_URL = 'https://diyseosupport.github.io/charlotte-directory/';
var FORM_URL = 'https://diyseosupport.github.io/charlotte-directory/form.html';
var FROM_EMAIL = 'DIYSEO.support@gmail.com';
var QR_URL = 'https://diyseosupport.github.io/charlotte-directory/qr-logo.png';
var BANNER_URL = 'https://diyseosupport.github.io/charlotte-directory/email-logo.png';

var TIMESTAMP_HEADER = 'Timestamp';
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
// Pending tab shows only these columns (others are hidden there, data is kept). Change the words if you want more or less.
var PENDING_SHOW = /^business name|^contact$|^name$|^title$|how to contact|google account email|^timestamp$|status \(private\)|check notes|approved by/i;
var STATUS_LIST = ['Unconfirmed', 'Pending', 'Approved', 'Flagged', 'Rejected'];
var WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw3yK823DH4sQqc1nFkvPKMbAhq2-oa0jrXDS_af_bXADEdrayXn5_XUrvfQE5gSx7wJg/exec';
var MAX_CHECKS_PER_RUN = 12;
var PENDING_TAB = 'Pending';
var SITE_URL = 'https://diyseo.support.gumroad.com';
var SITE_TEXT = 'DIYSEO.support.gumroad.com';

var ADMIN_EMAILS = ['diyseo.support@gmail.com'];
var ALLOW_CLAIM_OLD_ROWS = true;

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
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('MAILQ_') !== 0) return;
    try {
      var job = JSON.parse(all[k]);
      if (job.kind === 'confirm') sendConfirm_(job.to, job.name, job.token);
      else if (job.kind === 'pending') sendPending_(job.to, job.name);
      else if (job.kind === 'boss') notifyBoss_(job.name, job.d, job.label);
    } catch (e2) { Logger.log('sendQueuedMail_ job failed: ' + e2); }
    props.deleteProperty(k);
  });
}

// Adds a "Directory" menu in the sheet
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Directory')
      .addItem('Check pending now (move approved)', 'runChecks')
      .addItem('Refresh the public directory now', 'refreshDirectoryNow')
      .addItem('Send me a test alert email', 'testBossEmail')
      .addToUi();
  } catch (e) { }
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
  if (p.ping) return ContentService.createTextOutput('Directory form receiver is running.');
  var useCallback = p.callback && /^[A-Za-z_][\w.]*$/.test(p.callback);
  if (p.logo && useCallback) return logoReply_(p.logo, p.callback);
  if (p.saves && useCallback) return savesReply_(p, p.callback);
  if (p.pending && useCallback) return pendingReply_(p, p.callback);
  if (p.confirm) return confirmPage_(String(p.confirm));
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
    var pend = pendingSheet_();
    var ownerCol = ensureColumn_(sheet, OWNER_HEADER);   // pendingSheet_ above already added every other column
    var key = ownerKey_(email);

    // "Which businesses do I own?"
    if (data.action === 'mine') {
      return reply_({ ok: true, kind: 'mine', businesses: getMine_(sheet, key, isAdmin, ownerCol, pend, email) });
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
      hideRows_(pend, pendingRows_(pend).filter(function (r) { return nameKey_(r.name) === nameKey_(rmName) && String(r.vals[ownerCol - 1] || '') === key; }));
      try { CacheService.getScriptCache().remove('directory_csv'); } catch (cacheErr) { }
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

    // Does this person already control the listing email? Then no confirm email is needed.
    var listEmail = String(data.email || '').trim().toLowerCase();
    var sendTo = listEmail || email;
    var already = (sendTo === email);
    if (!already && emailIdx >= 0) {
      already = liveOld.some(function (r) { return String(r.vals[ownerIdx] || '') === saveKey && parseContact_(cellByKey_(headers, r.vals, 'contact')).email.toLowerCase() === listEmail; });
    }
    var token = already ? '' : Utilities.getUuid().replace(/-/g, '');
    var status = already ? 'Pending' : 'Unconfirmed';
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

    queueMail_({ kind: status === 'Unconfirmed' ? 'confirm' : 'pending', to: sendTo, name: newName, token: token });
    queueMail_({ kind: 'boss', name: newName, d: data, label: status === 'Pending' ? 'NEW PENDING' : 'NEW SUBMISSION (not confirmed yet)' });
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
  function add(label, value, href, shown) {
    value = String(value || '').trim();
    if (!value) return;
    rows.push({ label: label, value: value, href: href || '', shown: shown || '' });
  }
  var who = [d.pubName, d.pubTitle].filter(function (x) { return String(x || '').trim(); }).join(', ');
  var stateZip = [d.state, d.zip].filter(function (x) { return String(x || '').trim(); }).join(' ');
  var addr = [d.street, d.city, stateZip].filter(function (x) { return String(x || '').trim(); }).join(', ');
  add('Category', d.category);
  add('Slogan', d.slogan);
  add('Contact', who);
  add('Phone', d.phone, d.phone ? 'tel:' + String(d.phone).replace(/[^\d+]/g, '') : '');
  add('Email', d.email, d.email ? 'mailto:' + d.email : '');
  add('Website', d.website, d.website ? fullUrl_(d.website) : '');
  add('Facebook', d.facebook, d.facebook ? fullUrl_(d.facebook) : '');
  add('NextDoor business', d.ndBiz, d.ndBiz ? fullUrl_(d.ndBiz) : '');
  add('NextDoor personal', d.ndPersonal, d.ndPersonal ? fullUrl_(d.ndPersonal) : '');
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
    return '<tr><td style="padding:10px 0;border-bottom:2px dotted #d9c9a0">' +
        '<div class="lbl" style="font-family:' + HEAD + ';font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:' + MAGENTA + ';line-height:1.2;padding-bottom:3px">' + htmlEsc_(r.label) + '</div>' +
        '<div class="val" style="font-family:' + BODY + ';font-size:16px;color:' + INK + ';line-height:1.4;word-break:break-word">' + val + '</div></td></tr>';
  }).join('');

  var inline = {};
  var logoHtml = '';
  var lm = /[?&]id=([\w-]+)/.exec(String(logoUrl || ''));
  if (lm) {
    try {
      try { inline.logo = DriveApp.getFileById(lm[1]).getBlob().setName('logo'); }
      catch (e1) { inline.logo = UrlFetchApp.fetch('https://drive.google.com/thumbnail?id=' + lm[1] + '&sz=w300', { muteHttpExceptions: false }).getBlob().setName('logo'); }
      logoHtml = '<td width="76" style="padding-right:14px;vertical-align:middle"><img src="cid:logo" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:contain;background:#fff;border:3px solid ' + INK + ';border-radius:10px"></td>';
    } catch (logoErr) { inline = {}; logoHtml = ''; }
  }

  var html =
      '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:480px){.pad{padding:16px 14px 6px!important}.biz{font-size:24px!important}.lbl{font-size:13px!important}.val{font-size:15px!important}.bar{padding:10px 14px!important}}</style><link href="https://fonts.googleapis.com/css2?family=Walter+Turncoat&family=Bangers&display=swap" rel="stylesheet"></head>' +
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
      '<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center" style="background:' + YELLOW + ';color:' + INK + ';border:3px solid ' + INK + ';border-radius:8px;padding:6px 16px;font-family:' + HEAD + ';font-size:20px;letter-spacing:1.5px;text-align:center">' + BADGE + '</td></tr></table>' +
      '</td></tr></table>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>' + logoHtml +
      '<td style="vertical-align:middle"><div class="biz" style="font-family:' + HEAD + ';font-size:30px;letter-spacing:1px;color:' + PURPLE + ';line-height:1.1">' + htmlEsc_(businessName) + '</div></td></tr></table>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse">' + trs + '</table>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 10px"><tr><td align="center" style="text-align:center">' +
      '<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center"><a href="' + htmlEsc_(DIRECTORY_URL) + '" style="background:' + ORANGE + ';color:#fff;text-decoration:none;padding:12px 26px;border:3px solid ' + INK + ';border-radius:12px;font-family:' + HEAD + ';font-size:20px;letter-spacing:1.5px;display:block;text-align:center;box-shadow:3px 3px 0 ' + INK + '">SEE THE DIRECTORY</a></td></tr></table>' +
      '</td></tr></table>' +
      '<p style="font-family:' + BODY + ';font-size:14px;color:' + INK + ';line-height:1.5">Need to change or remove it? <a href="' + htmlEsc_(FORM_URL) + '" style="color:' + PURPLE + ';font-weight:bold">Open the form</a>, sign in with this same Google account, and pick &ldquo;Update my business&rdquo; or &ldquo;Remove my business&rdquo;.</p>' +
      '<p style="font-family:' + BODY + ';font-size:13px;color:#5b4a73">Need help? <a href="mailto:DIYSEO.support@gmail.com" style="color:' + PURPLE + '">DIYSEO.support@gmail.com</a></p>' +
      '</td></tr>' +
      '<tr><td align="center" style="background:' + CREAM + ';padding:16px 0 4px;text-align:center"><img src="' + htmlEsc_(QR_URL) + '" width="110" height="110" alt="DIYSEO.support.gumroad.com" style="display:block;margin:0 auto;width:110px;height:110px;border:0"></td></tr>' +
      '<tr><td class="bar" style="background:' + INK + ';padding:12px 22px;font-family:' + HEAD + ';font-size:14px;letter-spacing:2px;color:' + YELLOW + ';text-align:center;line-height:1.5">CHARLOTTE COUNTY<br>SMALL BUSINESS DIRECTORY</td></tr>' +
      footerRow_() + '</table></td></tr></table></body></html>';

  var text = 'Your listing "' + businessName + '" is live in the directory.\n\n' +
      rows.map(function (r) { return r.label + ': ' + (r.href && r.label !== 'Phone' && r.label !== 'Email' ? r.href : r.value); }).join('\n') + '\n\n' +
      'See the directory: ' + DIRECTORY_URL + '\n\n' +
      'Need to change or remove it? Open the form (' + FORM_URL + '), sign in with this same Google account, ' +
      'and pick "Update my business" or "Remove my business".\n\n' +
      'Need help? DIYSEO.support@gmail.com\n' + SITE_TEXT + '  ' + SITE_URL;

  var opts = {
    to: to,
    subject: "You're live in the directory: " + businessName,
    body: text,
    htmlBody: html,
    name: 'Charlotte County Small Business Directory'
  };
  var vcf = buildVcf_(businessName, d, addr);
  var vblob = Utilities.newBlob(vcf, 'text/vcard', (String(businessName).replace(/[^\w\- ]+/g, '').trim() || 'contact') + '.vcf');
  opts.attachments = [vblob];
  if (inline.logo) opts.inlineImages = inline;
  opts.replyTo = FROM_EMAIL;
  try {
    // Sends as FROM_EMAIL (needs the Send-as alias set up in Gmail)
    var g = { attachments: [vblob], htmlBody: html, name: 'Charlotte County Small Business Directory', from: FROM_EMAIL, replyTo: FROM_EMAIL };
    if (inline.logo) g.inlineImages = inline;
    GmailApp.sendEmail(to, opts.subject, text, g);
  } catch (aliasErr) {
    MailApp.sendEmail(opts);   // fallback: sends from the script owner
  }
}

function vEsc_(x) { return String(x == null ? '' : x).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
function buildVcf_(biz, d, addr) {
  var c = String(d.pubName || '').replace(/\s+/g, ' ').trim();
  var parts = c.split(' ');
  var v = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + vEsc_(c || biz),
    'N:' + (c ? vEsc_(parts.slice(1).join(' ')) + ';' + vEsc_(parts[0]) + ';;;' : vEsc_(biz) + ';;;;'),
    'ORG:' + vEsc_(biz)];
  if (d.pubTitle) v.push('TITLE:' + vEsc_(d.pubTitle));
  if (d.phone) v.push('TEL;TYPE=WORK,VOICE:' + String(d.phone).replace(/\s*ext.*$/i, ''));
  if (d.email) v.push('EMAIL;TYPE=WORK:' + d.email);
  [d.website, d.facebook, d.ndBiz].forEach(function (u) { if (u) v.push('URL:' + fullUrl_(u)); });
  if (addr) v.push('ADR;TYPE=WORK:;;' + vEsc_(d.street) + ';' + vEsc_(d.city) + ';' + vEsc_(d.state) + ';' + vEsc_(d.zip) + ';');
  v.push('NOTE:' + vEsc_('Found in the Charlotte County Small Business Directory'));
  v.push('END:VCARD');
  return v.join('\r\n');
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
  return '<tr><td align="center" style="background:#7b3ff2;padding:14px 12px;text-align:center">' +
    '<a href="' + htmlEsc_(SITE_URL) + '" style="text-decoration:none"><img src="' + htmlEsc_(BANNER_URL) + '" width="220" alt="DIYSEO" style="display:block;margin:0 auto 8px;width:220px;max-width:70%;height:auto;border:0"></a>' +
    '<a href="' + htmlEsc_(SITE_URL) + '" style="font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffd23f;text-decoration:none">' + htmlEsc_(SITE_TEXT) + '</a>' +
    '</td></tr>';
}

function sendMail_(to, subject, text, html, extra) {
  extra = extra || {};
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
function noticeHtml_(badge, businessName, paragraphs, buttonLabel, buttonHref) {
  var INK = '#1a1033', PURPLE = '#7b3ff2', MAGENTA = '#0070e0', ORANGE = '#ff7a1a', YELLOW = '#ffd23f', CREAM = '#fff6dc';
  var HEAD = "'Bangers','Impact','Arial Black',sans-serif";
  var BODY = "'Walter Turncoat','Comic Sans MS','Trebuchet MS',Arial,sans-serif";
  var paras = paragraphs.map(function (t) {
    return '<p style="font-family:' + BODY + ';font-size:16px;color:' + INK + ';line-height:1.5;margin:0 0 12px">' + t + '</p>';
  }).join('');
  var btn = buttonHref
      ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 10px"><tr><td align="center" style="text-align:center"><table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center"><a href="' + htmlEsc_(buttonHref) + '" style="background:' + ORANGE + ';color:#fff;text-decoration:none;padding:12px 26px;border:3px solid ' + INK + ';border-radius:12px;font-family:' + HEAD + ';font-size:20px;letter-spacing:1.5px;display:block;text-align:center;box-shadow:3px 3px 0 ' + INK + '">' + htmlEsc_(buttonLabel) + '</a></td></tr></table></td></tr></table>'
      : '';
  return '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:480px){.pad{padding:16px 14px 6px!important}.biz{font-size:24px!important}.bar{padding:10px 14px!important}}</style><link href="https://fonts.googleapis.com/css2?family=Walter+Turncoat&family=Bangers&display=swap" rel="stylesheet"></head>' +
      '<body style="margin:0;padding:0;background:' + PURPLE + '">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + PURPLE + '"><tr><td align="center" style="padding:20px 10px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:' + CREAM + ';border:4px solid ' + INK + ';border-radius:18px;overflow:hidden;box-shadow:6px 6px 0 ' + INK + '">' +
      '<tr><td style="padding:0;background:' + PURPLE + '"><img src="' + htmlEsc_(BANNER_URL) + '" width="600" alt="Charlotte County Small Business Directory" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:#fff;font-family:' + HEAD + ';font-size:22px"></td></tr>' +
      '<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td height="10" width="25%" style="background:' + PURPLE + ';font-size:0;line-height:0">&nbsp;</td><td width="25%" style="background:' + MAGENTA + ';font-size:0;line-height:0">&nbsp;</td>' +
      '<td width="25%" style="background:' + ORANGE + ';font-size:0;line-height:0">&nbsp;</td><td width="25%" style="background:' + YELLOW + ';font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>' +
      '<tr><td class="pad" style="padding:22px 22px 8px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="text-align:center">' +
      '<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center" style="background:' + YELLOW + ';color:' + INK + ';border:3px solid ' + INK + ';border-radius:8px;padding:6px 16px;font-family:' + HEAD + ';font-size:20px;letter-spacing:1.5px;text-align:center">' + htmlEsc_(badge) + '</td></tr></table>' +
      '</td></tr></table>' +
      '<div class="biz" style="font-family:' + HEAD + ';font-size:30px;letter-spacing:1px;color:' + PURPLE + ';line-height:1.1;margin:16px 0 12px">' + htmlEsc_(businessName) + '</div>' +
      paras + btn +
      '<p style="font-family:' + BODY + ';font-size:13px;color:#5b4a73">Need help? <a href="mailto:DIYSEO.support@gmail.com" style="color:' + PURPLE + '">DIYSEO.support@gmail.com</a></p>' +
      '</td></tr>' +
      '<tr><td align="center" style="background:' + CREAM + ';padding:16px 0 4px;text-align:center"><img src="' + htmlEsc_(QR_URL) + '" width="110" height="110" alt="DIYSEO.support.gumroad.com" style="display:block;margin:0 auto;width:110px;height:110px;border:0"></td></tr>' +
      '<tr><td class="bar" style="background:' + INK + ';padding:12px 22px;font-family:' + HEAD + ';font-size:14px;letter-spacing:2px;color:' + YELLOW + ';text-align:center;line-height:1.5">CHARLOTTE COUNTY<br>SMALL BUSINESS DIRECTORY</td></tr>' +
      footerRow_() + '</table></td></tr></table></body></html>';
}

function sendConfirm_(to, businessName, token) {
  var link = WEB_APP_URL + '?confirm=' + encodeURIComponent(token);
  var html = noticeHtml_('ONE MORE STEP!', businessName, [
    'Thanks for adding your business to the directory. It is <b>not</b> listed yet.',
    'Tap the button to confirm this email is yours. Then your listing is <b>Pending</b> and goes live within 12 hours, after a quick check.',
    'Did not add a business? Ignore this email. Nothing will be listed.'
  ], 'CONFIRM MY LISTING', link);
  var text = 'One more step!\n\n"' + businessName + '" is not listed yet.\n\nConfirm this email is yours:\n' + link +
      '\n\nAfter you confirm, your listing is Pending and goes live within 12 hours, after a quick check.\n\n' +
      'Did not add a business? Ignore this email.\n\nNeed help? DIYSEO.support@gmail.com';
  sendMail_(to, 'Confirm your listing: ' + businessName, text, html);
}

function sendPending_(to, businessName) {
  var html = noticeHtml_('YOU\'RE PENDING!', businessName, [
    'Thank you! Your email is confirmed.',
    'Your listing is <b>Pending</b>. We are checking it now. It goes live <b>within 12 hours</b>, and we will email you as soon as it is live.',
    'We check every new listing to make sure it is a real local business. This keeps the directory trusted. Most go live within a few hours, and no more than 12.',
    'Need to change something? <a href="' + htmlEsc_(FORM_URL) + '" style="color:#7b3ff2;font-weight:bold">Open the form</a>, sign in with the same Google account, and pick &ldquo;Update my business&rdquo;.'
  ], 'SEE THE DIRECTORY', DIRECTORY_URL);
  var text = 'Thank you! Your email is confirmed.\n\n"' + businessName + '" is Pending. We are checking it now. ' +
      'It goes live within 12 hours, and we will email you as soon as it is live.\n\n' +
      'We check every new listing to make sure it is a real local business. This keeps the directory trusted. Most go live within a few hours, and no more than 12.\n\n' +
      'Need to change something? Open the form (' + FORM_URL + '), sign in with the same Google account, and pick "Update my business".\n\nNeed help? DIYSEO.support@gmail.com';
  sendMail_(to, 'Your listing is pending: ' + businessName, text, html);
}

function sendRejected_(to, businessName) {
  var html = noticeHtml_('WE NEED A HAND', businessName, [
    'We could not verify this listing, so it was not added to the directory.',
    'Reply to this email and tell us a little about your business, and we will take another look.'
  ], 'EMAIL US', 'mailto:DIYSEO.support@gmail.com');
  var text = '"' + businessName + '" could not be verified, so it was not added to the directory.\n\nReply to this email and tell us about your business, and we will take another look.\n\nDIYSEO.support@gmail.com';
  sendMail_(to, 'About your listing: ' + businessName, text, html);
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
      '<p style="font-size:14px">Need help? <a href="mailto:DIYSEO.support@gmail.com">DIYSEO.support@gmail.com</a></p></div></body></html>';
}

function confirmPage_(token) {
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
      try { if (sendTo) sendPending_(sendTo, bizName); } catch (mailErr) { }
      notifyBoss_(bizName, d, 'NEW PENDING');
      checkSoon_();
      out = confirmPageHtml_("YOU'RE PENDING!", [
        'Thank you! Your email is confirmed.',
        '<b>' + htmlEsc_(bizName) + '</b> is <b>Pending</b>. It goes live within 12 hours, and we will email you when it is live.',
        'We check every new listing to make sure it is a real local business. This keeps the directory trusted. Most go live within a few hours, and no more than 12.'
      ], true);
    } else {
      out = confirmPageHtml_('ALL SET', [
        'This link was already used, or it is no longer valid.',
        'If you added a business, your email is already confirmed and your listing is Pending. We check every new listing to make sure it is a real local business, so it is not live yet &mdash; it goes live within 12 hours, and we will email you when it is.'
      ], false);
    }
  } catch (err) {
    out = confirmPageHtml_('OOPS', ['Something went wrong. Please try the link again in a minute, or email us.'], false);
  } finally {
    try { lock.releaseLock(); } catch (ignore) { }
  }
  return HtmlService.createHtmlOutput(out).setTitle('Charlotte County Small Business Directory')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}


// ---------------------------------------------------------------
// Pending tab (v27): new submissions wait here. When approved they move to the directory tab.
// ---------------------------------------------------------------
function pendingSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var main = findSheet_();
  ensureColumns_(main, [TIMESTAMP_HEADER, NAME_HEADER, TITLE_HEADER, HOW_HEADER, OWNER_HEADER, EMAIL_HEADER, HIDDEN_HEADER,
    STATUS_HEADER, TOKEN_HEADER, NOTES_HEADER, REPLACES_HEADER, NOTIFIED_HEADER, APPROVED_HEADER]);
  var pend = ss.getSheetByName(PENDING_TAB);
  var cols = main.getLastColumn();
  if (!pend) {
    pend = ss.insertSheet(PENDING_TAB, ss.getSheets().length);
    try { pend.setTabColor('#ff7a1a'); } catch (e) { }
    try { pend.setFrozenRows(1); } catch (e2) { }
  }
  if (pend.getMaxColumns() < cols) pend.insertColumnsAfter(pend.getMaxColumns(), cols - pend.getMaxColumns());
  // Same headings, same order, same look as the directory tab
  var mh = main.getRange(1, 1, 1, cols).getValues()[0];
  var ph = pend.getLastColumn() ? pend.getRange(1, 1, 1, Math.min(pend.getLastColumn(), cols)).getValues()[0] : [];
  var same = ph.length === cols;
  for (var i = 0; same && i < cols; i++) { if (String(ph[i]) !== String(mh[i])) same = false; }
  if (!same) {
    main.getRange(1, 1, 1, cols).copyTo(pend.getRange(1, 1, 1, cols));
    for (var c = 1; c <= cols; c++) { try { pend.setColumnWidth(c, main.getColumnWidth(c)); } catch (we) { } }
    try { pend.showColumns(1, cols); } catch (se) { }
    for (var h = 0; h < cols; h++) {
      if (!PENDING_SHOW.test(String(mh[h]).trim())) { try { pend.hideColumns(h + 1); } catch (he) { } }
    }
  }
  return pend;
}

// Rows of the pending tab that are still in line
function pendingRows_(pend) {
  return liveRows_(pend);
}

// Moves any waiting rows still sitting in the directory tab over to the Pending tab (runs by itself)
function migratePendingRows_(main, pend) {
  var headers = getHeaders_(main);
  var sc = colNamed_(headers, STATUS_HEADER);
  if (sc < 0) return;
  var rows = liveRows_(main).filter(function (o) {
    var st = String(o.vals[sc] || '').trim().toLowerCase();
    return st === 'unconfirmed' || st === 'pending' || st === 'flagged';
  });
  if (!rows.length) return;
  rows.forEach(function (o) {
    var target = nextFreeRow_(pend, getHeaders_(pend));
    pend.getRange(target, 1, 1, o.vals.length).setValues([o.vals]);
    try { pend.getRange(target, sc + 1).setDataValidation(statusRule_()); } catch (e) { }
  });
  for (var i = rows.length - 1; i >= 0; i--) { main.deleteRow(rows[i].row); }
  try { CacheService.getScriptCache().remove('directory_csv'); } catch (ce) { }
}

// Approved rows move to the directory tab (then the normal approve step emails the owner and replaces old versions).
// Rejected rows email the owner and leave the tab.
function movePendingDecisions_(main, pend) {
  var headers = getHeaders_(pend);
  var sc = colNamed_(headers, STATUS_HEADER), nfc = colNamed_(headers, NOTIFIED_HEADER);
  var ec = colNamed_(headers, EMAIL_HEADER), apc = colNamed_(headers, APPROVED_HEADER);
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
      var target = nextFreeRow_(main, getHeaders_(main));
      main.getRange(target, 1, 1, vals.length).setValues([vals]);
      try { main.getRange(target, sc + 1).setDataValidation(statusRule_()); } catch (e) { }
      try { main.getRange(target, 1, 1, vals.length).setFontFamily('Montserrat'); } catch (fe) { }
      pend.deleteRow(o.row);
      moved = true;
    } else if (st === 'rejected') {
      var d = rowObj_(headers, o);
      var to = String(d.email || '').trim().toLowerCase() || (ec >= 0 ? String(o.vals[ec] || '') : '');
      if (to) { try { sendRejected_(to, o.name); } catch (me) { } }
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
    if (t.getHandlerFunction() === 'runChecks') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runChecks').timeBased().everyHours(1).create();
  Logger.log('Hourly check is on. You can also run runChecks by hand any time.');
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

function checkListing_(d, name, ownerKeyVal, rowNo, allRows, headers, ownerCol) {
  // rowNo is a unique id like 'p12' (pending tab) or 'd12' (directory tab)
  var notes = [], fail = false;

  // 1. Website loads and shows the owner's phone number (digits only). Business name is not required.
  var site = String(d.website || '').trim();
  if (!site) {
    notes.push('No website');
    fail = true;
  } else {
    try {
      var resp = UrlFetchApp.fetch(fullUrl_(site), { muteHttpExceptions: true, followRedirects: true, validateHttpsCertificates: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DirectoryCheck/1.0)' } });
      var code = resp.getResponseCode();
      if (code >= 400) {
        notes.push('Site will not load (error ' + code + ')');
        fail = true;
      } else {
        var pageDigits = resp.getContentText().replace(/\D/g, '');
        var ph = digits10_(d.phone);
        if (ph && pageDigits.indexOf(ph) !== -1) notes.push('Website loads and shows the phone number');
        else { notes.push('Phone not found on website'); fail = true; }
      }
    } catch (fe) {
      notes.push('Site will not load');
      fail = true;
    }
  }

  // 2. Duplicates owned by somebody else (live or in line)
  var ph2 = digits10_(d.phone), em2 = String(d.email || '').trim().toLowerCase(), host2 = hostOf_(d.website);
  var dup = [];
  allRows.forEach(function (o) {
    if (o.uid === rowNo) return;
    if (String(o.vals[ownerCol - 1] || '') === ownerKeyVal) return;
    var st = String(o.status || '').trim().toLowerCase();
    if (st === 'rejected') return;
    var c = parseContact_(cellByKey_(headers, o.vals, 'contact'));
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
    var headers = getHeaders_(sheet);
    var sc = colNamed_(headers, STATUS_HEADER), nc = colNamed_(headers, NOTES_HEADER);
    var ownerCol = colNamed_(headers, OWNER_HEADER) + 1;
    var inLine = liveRows_(sheet);
    inLine.forEach(function (o) { o.status = String(o.vals[sc] || ''); o.uid = 'p' + o.row; });
    var dirRows = liveRows_(main);
    dirRows.forEach(function (o) { o.status = String(o.vals[sc] || ''); o.uid = 'd' + o.row; });
    var live = inLine.concat(dirRows);

    // Pending -> Approved / Flagged
    var pending = inLine.filter(function (o) { return o.status.trim().toLowerCase() === 'pending'; }).slice(0, MAX_CHECKS_PER_RUN);
    var newlyFlagged = [], autoOk = [];
    var apc = colNamed_(headers, APPROVED_HEADER);
    pending.forEach(function (o) {
      var d = rowObj_(headers, o);
      var res;
      try { res = checkListing_(d, o.name, String(o.vals[ownerCol - 1] || ''), o.uid, live, headers, ownerCol); }
      catch (e) { res = { ok: false, notes: 'Check error: ' + e }; }
      var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
      sheet.getRange(o.row, nc + 1).setValue(stamp + ' - ' + res.notes);
      sheet.getRange(o.row, sc + 1).setValue(res.ok ? 'Approved' : 'Flagged');
      if (res.ok && apc >= 0) sheet.getRange(o.row, apc + 1).setValue('Auto-check ' + stamp);
      if (res.ok) autoOk.push(o.name + ': ' + res.notes);
      o.status = res.ok ? 'Approved' : 'Flagged';
      if (!res.ok) newlyFlagged.push(o.name + ': ' + res.notes);
    });

    movePendingDecisions_(main, sheet);
    finishRows_(main);
    try { CacheService.getScriptCache().remove('directory_csv'); } catch (ce0) { }
    if (autoOk.length) {
      sendBossMail_('\u2705 AUTO-APPROVED: ' + autoOk.length + ' listing(s) went live',
        'The script checked these and approved them. They are now in the directory tab (column "Approved By (private)" says Auto-check).\n\n' +
        autoOk.join('\n') + '\n\n' + SpreadsheetApp.openById(SHEET_ID).getUrl() + '\n\n' + SITE_TEXT + '  ' + SITE_URL);
    }
    bossDigest_(sheet);

    if (newlyFlagged.length) {
      try {
        var url = SpreadsheetApp.openById(SHEET_ID).getUrl();
        MailApp.sendEmail({ to: ADMIN_EMAILS[0], subject: '\u26A0\uFE0F FLAGGED: ' + newlyFlagged.length + ' listing(s) need your OK',
          body: 'These listings could not be approved by the auto-check. Open the "Pending" tab, read "Check Notes (private)", then set Status to Approved (moves to the directory) or Rejected:\n\n' +
            newlyFlagged.join('\n') + '\n\n' + url + '\n\n' + SITE_TEXT + '  ' + SITE_URL, name: 'Charlotte County Small Business Directory' });
      } catch (ae) { }
    }
  } finally {
    try { lock.releaseLock(); } catch (ignore) { }
  }
}

// Rows set to Approved (by the check or by you) go live and the owner is told. Rows set to Rejected are removed.
function finishRows_(sheet) {
  var headers = getHeaders_(sheet);
  var sc = colNamed_(headers, STATUS_HEADER), nfc = colNamed_(headers, NOTIFIED_HEADER), rc = colNamed_(headers, REPLACES_HEADER);
  var ec = colNamed_(headers, EMAIL_HEADER), tsc = colByKey_(headers, 'timestamp');
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
      changed = true;
      if (to) {
        try { sendLink_(to, o.name, d, 'https://drive.google.com/open?id=' + (d.logoId || '')); } catch (me) { }
      }
    } else {
      hideRows_(sheet, [o]);
      sheet.getRange(o.row, nfc + 1).setValue(stamp);
      changed = true;
      if (to) { try { sendRejected_(to, o.name); } catch (me2) { } }
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
  if (!sh) {
    sh = ss.insertSheet('Saves');
    sh.appendRow(['Email (private)', 'Saved cards', 'Updated']);
    sh.setFrozenRows(1);
  }
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
        if (row) sh.getRange(row, 2, 1, 2).setValues([[json, new Date()]]);
        else sh.appendRow([email, json, new Date()]);
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
function notifyBoss_(name, d, label) {
  try {
    d = d || {};
    var url = SpreadsheetApp.openById(SHEET_ID).getUrl();
    var lines = [
      'A new listing is waiting. Open the "Pending" tab in the sheet to see it.',
      '',
      'Business: ' + name,
      'Category: ' + (d.category || ''),
      'Contact: ' + [d.pubName, d.pubTitle].filter(Boolean).join(', '),
      'Phone: ' + (d.phone || ''),
      'Email: ' + (d.email || ''),
      'Website: ' + (d.website || '(none)'),
      '',
      'Sheet: ' + url,
      '',
      SITE_TEXT + '  ' + SITE_URL
    ];
    sendBossMail_('\uD83D\uDD14 ' + label + ': ' + name, lines.join('\n'));
  } catch (e) { Logger.log('notifyBoss_ failed: ' + e); }
}

// Tries the normal way first, then the backup way. Errors go to the log (Apps Script > Executions).
function sendBossMail_(subject, body) {
  try {
    MailApp.sendEmail({ to: ADMIN_EMAILS[0], subject: subject, body: body, name: 'Charlotte County Small Business Directory' });
  } catch (e1) {
    Logger.log('MailApp failed: ' + e1);
    try { GmailApp.sendEmail(ADMIN_EMAILS[0], subject, body, { name: 'Charlotte County Small Business Directory' }); }
    catch (e2) { Logger.log('GmailApp failed too: ' + e2); }
  }
}

// Run this once by hand. It sends you a test email so you know alerts reach you.
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
function getMine_(sheet, key, isAdmin, ownerCol, pend, loginEmail) {
  var headers = getHeaders_(sheet);
  var latest = {};
  liveRows_(sheet).forEach(function (r) { latest[nameKey_(r.name)] = r; });
  if (pend) pendingRows_(pend).forEach(function (r) { latest[nameKey_(r.name)] = r; });
  var out = [];
  Object.keys(latest).forEach(function (k) {
    var r = latest[k];
    var stored = String(r.vals[ownerCol - 1] || '');
    var o = rowObj_(headers, r);
    var mine = isAdmin || stored === key ||
        (!stored && String(o.email || '').trim().toLowerCase() === loginEmail);
    if (!mine) return;
    var si = colOf_(headers, function (t) { return t === STATUS_HEADER; });
    var st = si >= 0 ? String(r.vals[si] || '').trim() : '';
    o.status = st || 'Approved';
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
  o.describe = descVal;
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
      'NextDoor Business', 'NextDoor Personal', 'Google Reviews', 'Address', 'Area Served', 'Logo'];
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
      cell(row, 'logo')
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
