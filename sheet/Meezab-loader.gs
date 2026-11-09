// MEEZAB LEADS SHEET - SELF-UPDATING LOADER (paste ONCE, never changes)                     10 Nov 2026
// This small file stays in the Sheet's Apps Script for good. The real code ("Meezab core") lives on GitHub:
//   https://github.com/ayyubisulait220762-spec/admin-meezab/blob/main/sheet/meezab-core.js
// Claude publishes new versions there. The Sheet picks them up by itself within about 10 minutes.
// Safety:
//   * A new version is only used after it passes a check (complete file, no code errors, and a test run).
//     If it fails, the Sheet keeps using the last good version and emails Basil and Sulait once.
//   * The last good version is saved inside the Sheet's settings, so the apps keep working even if GitHub is down.
//   * Sheet menu: Meezab > Update now (check at once)  /  Go back to previous version.
// ONE-TIME SETUP: paste this file, Save, run "install" and press Allow, then Deploy > Manage deployments > Edit > New version.

var CORE_URL  = 'https://raw.githubusercontent.com/ayyubisulait220762-spec/admin-meezab/main/sheet/meezab-core.js';
var CACHE_SEC = 600;     // check GitHub for a new version at most every 10 minutes
var CHUNK     = 3000;    // characters per saved piece (Google limits each setting to 9 KB)

// ---------- the apps call these (they never change) ----------
function doGet(e)  { return run_('doGet', e, function () { return ContentService.createTextOutput('Meezab link: code not loaded'); }); }
function doPost(e) {
  return run_('doPost', e, function () {
    var t = '';
    try { t = JSON.parse(e.postData.contents).type; } catch (x) {}
    return t === 'myhajj' || t === 'admin'
      ? ContentService.createTextOutput(JSON.stringify({ ok: false, err: 'busy' })).setMimeType(ContentService.MimeType.JSON)
      : ContentService.createTextOutput('busy');
  });
}
function fetchNews(e)       { return run_('fetchNews', e); }        // daily news timer
function timer(e)           { return run_('timer_', e); }           // for future timers
function setup()            { return run_('setup'); }
function setupNewsTimer()   { return run_('setupNewsTimer'); }
function menuSetPassword()  { return run_('menuSetPassword'); }
function menuLogoutAll()    { return run_('menuLogoutAll'); }
function testLead()         { return run_('testLead'); }
function testFeedback()     { return run_('testFeedback'); }
function testEmail()        { return run_('testEmail'); }
function menuX1() { return run_('menuX1'); } function menuX2() { return run_('menuX2'); }
function menuX3() { return run_('menuX3'); } function menuX4() { return run_('menuX4'); }

function onOpen() {
  var m = SpreadsheetApp.getUi().createMenu('Meezab')
    .addItem('Set admin password', 'menuSetPassword')
    .addItem('Log out all admin phones', 'menuLogoutAll');
  try {  // extra menu items a newer core may add: [["Label","menuX1"], ...]
    JSON.parse(PropertiesService.getScriptProperties().getProperty('menu_extra') || '[]').slice(0, 4)
      .forEach(function (i) { if (/^menuX[1-4]$/.test(i[1])) m.addItem(String(i[0]).slice(0, 40), i[1]); });
  } catch (x) {}
  m.addSeparator().addItem('Update now', 'menuUpdateNow').addItem('Go back to previous version', 'menuRollback').addToUi();
}

// ---------- ONE-TIME: run from the editor ----------
function install() {
  Logger.log('1/3 Downloading the Meezab code from GitHub ...');
  var src = load_(true);
  var core = compile_(src);
  Logger.log('2/3 Running setup (tabs) for v' + core('VERSION') + ' ...');
  core('setup')();
  Logger.log('3/3 Restarting the daily news timer ...');
  core('setupNewsTimer')();
  Logger.log('ALL DONE. The Sheet now runs Meezab v' + core('VERSION') + ' and updates itself from GitHub.');
}

function menuUpdateNow() {
  var ui = SpreadsheetApp.getUi();
  try { var src = load_(true); ui.alert('Meezab update', 'The Sheet is on v' + verOf_(src) + '.' + note_(), ui.ButtonSet.OK); }
  catch (x) { ui.alert('Meezab update', 'Could not check: ' + msg_(x), ui.ButtonSet.OK); }
}

function menuRollback() {
  var ui = SpreadsheetApp.getUi(), P = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var live = getBig_('live'), prev = getBig_('prev');
    if (!prev) { ui.alert('There is no earlier version saved to go back to.'); return; }
    if (ui.alert('Go back from v' + verOf_(live) + ' to v' + verOf_(prev) + '?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    P.setProperty('hold', verOf_(live));       // do not use that version again until a newer one is published
    putBig_('live', prev); delBig_('prev'); clearCache_();
    mail_(prev, 'Meezab Sheet went back to v' + verOf_(prev),
      'v' + P.getProperty('hold') + ' was removed by the menu "Go back to previous version". Please tell Claude what went wrong.');
    ui.alert('Done. The Sheet and the apps are back on v' + verOf_(prev) + '.');
  } finally { lock.releaseLock(); }
}

// ---------- loader machinery ----------
function msg_(x) { return String(x && x.message ? x.message : x).slice(0, 400); }
function note_() { var h = PropertiesService.getScriptProperties().getProperty('hold'); return h ? ' (v' + h + ' is on hold after "Go back".)' : ''; }
function verOf_(src) { var m = /var VERSION = '(\d+(?:\.\d+){0,3})';/.exec(String(src || '')); return m ? m[1] : ''; }

function run_(name, arg, fallback) {
  var core;
  try { core = compile_(load_(false)); }
  catch (x) { Logger.log('Meezab code could not load: ' + msg_(x)); if (fallback) return fallback(); throw x; }
  var f = core(name);
  if (typeof f !== 'function') { if (fallback) return fallback(); throw new Error('This version has no "' + name + '".'); }
  return f(arg);
}

// Turns the code text into a lookup: core('doPost') -> the function. Throws on code errors.
function compile_(src) {
  if (compile_.src === src && compile_.fn) return compile_.fn;
  var fn = new Function(src + '\n;return function (n) { try { return eval(n); } catch (e) { return undefined; } };')();
  compile_.src = src; compile_.fn = fn;
  return fn;
}

// Checks a new version before it is used. Returns '' if fine, else the reason.
function check_(src) {
  src = String(src || '');
  if (src.length < 20000) return 'file too short';
  if (!verOf_(src)) return 'no version number';
  var need = ['MEEZAB CORE', 'function doPost(', 'function doGet(', 'function fetchNews(', 'function setup(',
              'function setupNewsTimer(', 'function menuSetPassword(', 'function menuLogoutAll('];
  for (var i = 0; i < need.length; i++) if (src.indexOf(need[i]) < 0) return 'missing: ' + need[i];
  try {
    var core = new Function(src + '\n;return function (n) { try { return eval(n); } catch (e) { return undefined; } };')();
    var out = core('doGet')({ parameter: {} }).getContent();
    if (String(out).indexOf('v' + verOf_(src)) < 0) return 'test run gave: ' + String(out).slice(0, 80);
  } catch (x) { return 'code error: ' + msg_(x); }
  return '';
}

// Returns the code to run now. force = skip the 10-minute memory and ask GitHub at once.
function load_(force) {
  if (!force) { var c = cacheGet_(); if (c) return c; }
  var P = PropertiesService.getScriptProperties();
  var live = getBig_('live'), remote = null, err = '';
  try {
    var r = UrlFetchApp.fetch(CORE_URL + '?t=' + Date.now(), { muteHttpExceptions: true, headers: { 'Cache-Control': 'no-cache' } });
    if (r.getResponseCode() === 200) remote = r.getContentText(); else err = 'GitHub said ' + r.getResponseCode();
  } catch (x) { err = 'GitHub not reachable: ' + msg_(x); }

  var rv = verOf_(remote), lv = verOf_(live);
  if (remote && rv && rv !== lv && rv !== P.getProperty('hold')) {
    var bad = check_(remote);
    if (!bad) {
      var lock = LockService.getScriptLock();
      if (lock.tryLock(20000)) {
        try {
          live = getBig_('live'); lv = verOf_(live);           // another run may have done it meanwhile
          if (rv !== lv) {
            if (live) putBig_('prev', live);
            putBig_('live', remote);
            P.deleteProperty('hold'); P.deleteProperty('failed');
            if (lv) mail_(remote, 'Meezab Sheet updated to v' + rv,
              'The Meezab Sheet updated itself from v' + lv + ' to v' + rv + '.\nThe app links stay the same. Nothing to do.\n\n' +
              'If something looks wrong: Sheet menu Meezab > Go back to previous version.');
            try { compile_(remote)('log_')(SpreadsheetApp.getActive(), 'auto-update', 'update', 'v' + (lv || '-') + ' -> v' + rv); } catch (x) {}
          }
          live = remote; lv = rv;
        } finally { lock.releaseLock(); }
      } else { live = remote; lv = rv; }                          // busy saving elsewhere: use it this time
    } else if (P.getProperty('failed') !== rv) {
      P.setProperty('failed', rv);
      mail_(live || remote, 'Meezab Sheet: v' + rv + ' was NOT installed',
        'The new version failed the safety check, so the Sheet keeps using v' + (lv || '?') + '. The apps keep working.\n' +
        'Reason: ' + bad + '\n\nPlease forward this email to Claude.');
    }
  }
  if (!live) throw new Error('No Meezab code yet. ' + (err || 'The file on GitHub did not pass the check: ' + check_(remote)));
  cachePut_(live);
  return live;
}

function mail_(src, subject, body) {
  try {
    var to = compile_(src)('NOTIFY_EMAILS'); if (!to) return;
    MailApp.sendEmail({ to: to, subject: subject, name: 'Meezab E Rahemat App', body: body + '\n\nSheet: ' + SpreadsheetApp.getActive().getUrl() });
  } catch (x) { Logger.log('mail failed: ' + msg_(x)); }
}

// ---------- storage: big text split into pieces ----------
function putBig_(key, text) {
  var P = PropertiesService.getScriptProperties(), n = Math.ceil(text.length / CHUNK), o = {};
  for (var i = 0; i < n; i++) o[key + '_' + i] = text.substr(i * CHUNK, CHUNK);
  o[key + '_n'] = String(n);
  delBig_(key);
  P.setProperties(o);
}
function getBig_(key) {
  var P = PropertiesService.getScriptProperties(), n = parseInt(P.getProperty(key + '_n'), 10) || 0, s = '';
  for (var i = 0; i < n; i++) { var part = P.getProperty(key + '_' + i); if (part === null) return ''; s += part; }
  return s;
}
function delBig_(key) {
  var P = PropertiesService.getScriptProperties(), n = parseInt(P.getProperty(key + '_n'), 10) || 0;
  for (var i = 0; i < n; i++) P.deleteProperty(key + '_' + i);
  P.deleteProperty(key + '_n');
}
function cachePut_(text) {
  try {
    var C = CacheService.getScriptCache(), n = Math.ceil(text.length / 90000), o = { core_n: String(n) };
    for (var i = 0; i < n; i++) o['core_' + i] = text.substr(i * 90000, 90000);
    C.putAll(o, CACHE_SEC);
  } catch (x) {}
}
function cacheGet_() {
  try {
    var C = CacheService.getScriptCache(), n = parseInt(C.get('core_n'), 10) || 0, s = '';
    if (!n) return '';
    for (var i = 0; i < n; i++) { var part = C.get('core_' + i); if (part === null) return ''; s += part; }
    return s;
  } catch (x) { return ''; }
}
function clearCache_() { try { CacheService.getScriptCache().remove('core_n'); } catch (x) {} }

// Never runs. It only tells Google which permissions the Meezab code needs (Sheet, email, internet, timers,
// translation, and Google Drive for the planned document copies), so new versions never need a new "Allow".
function permissions_() {
  SpreadsheetApp.getActive(); SpreadsheetApp.getUi(); MailApp.sendEmail('', '', ''); UrlFetchApp.fetch('');
  ScriptApp.newTrigger(''); LanguageApp.translate('', '', ''); DriveApp.getRootFolder(); DriveApp.createFolder('');
}
