// MEEZAB CORE - the real code of the "Meezab leads" Sheet. Loaded automatically by the small loader in the Sheet
// (Meezab-loader.gs). To update the Sheet, publish a new version of this file on GitHub and raise VERSION. Nothing to paste.
var VERSION = '6.2';
// MEEZAB E RAHEMAT - leads, feedback, news, My Hajj and the Admin meezab app in one Google Sheet.   (version 6.2, 10 Nov 2026)
// New in 6.2: runs through the self-updating loader (no more copy-paste in the Sheet).
// Fix in 6.1: 'Add pilgrim' from the Admin meezab app now saves a NEW row (6.0 wrote over the Pilgrims header row).
//             The Pilgrims tab repairs itself automatically (header put back on row 1, the pilgrim moves to row 2).
// New in version 6 - MY HAJJ + ADMIN MEEZAB:
//   * Pilgrims tab: booked Hajj pilgrims. Each gets a private code (e.g. MZB-7K4Q-2P) that opens their My Hajj page in the app.
//   * Alerts tab: messages to all pilgrims or one pilgrim (auto-translated to Urdu, Hindi, Gujarati).
//   * Admin meezab app (for Sulait and Basil): add pilgrims, tick their checklist, send alerts, see leads. Every action is logged.
//   * Passwords: Sheet menu  Meezab > Set admin password.  Stored scrambled in the script settings - never inside any app.
//   * Safety: 5 wrong passwords = 15 minutes locked; logins last 30 days; Meezab > Log out all admin phones ends them all.
//     No passport or ID numbers are stored - only 'yes' when a document is received.
// From version 5 - automatic Hajj & Umrah news:
// New in version 5 - AUTOMATIC HAJJ & UMRAH NEWS (free, runs on Google every morning):
//   * fetchNews() reads Google News, keeps ONLY Hajj/Umrah news from TRUSTED sources (list below),
//     skips adverts (package / offer / booking / price ...), translates the headline into Urdu, Hindi and Gujarati,
//     and adds up to 3 new rows to the "News" tab.
//   * FULLY AUTOMATIC (AUTO_PUBLISH = true): the news appears in the app by itself (Show = yes).
//     To hide one item, change its "yes" to "no". (Set AUTO_PUBLISH = false to approve each item first.)
//   * Basil and Sulait get one short email listing what was published.
//   * The app shows each item in the reader's language with "Source: ..." and a link to the full story.
//   * Run setupNewsTimer() ONCE to start the daily 7 am run.
// From version 4: "Notes" column says "Email sent" / "Email FAILED: <reason>"; web-app link says "... working (v5)".
// From version 3: every new enquiry is emailed to Basil and Sulait; spam protection.
//
// Tabs it creates:
//   "Leads"    - every registration from the app (one row per person). Change "Status" as you follow up.
//   "Feedback" - star ratings and comments from pilgrims.
//   "News"     - automatic news (Show = check) + any row you add yourself (Date, Title, Text, Show = yes).
//
// Safety: the app only knows this web-app link. No passwords or keys are in the app.
// The Sheet itself stays private - do NOT share it publicly.

var NOTIFY_EMAILS = 'basilayyubi09@gmail.com,ayyubisulait220762@gmail.com';   // add more, separated by commas
var MIN_FORM_MS   = 3000;   // a real person needs at least 3 seconds to fill the form
var SAME_MOBILE_MIN = 10;   // the same mobile number again within 10 minutes is ignored
var MAX_PER_HOUR  = 30;     // more than this many in one hour = flood, ignored

// ---- automatic news settings ----
var AUTO_PUBLISH = true;    // true = trusted news goes live in the app by itself (Show = yes). false = wait for your OK (Show = check)
var NEWS_PER_DAY = 3;       // at most this many new items each morning
var NEWS_HOUR    = 7;       // runs every day around this hour (India time)
// Only news from these websites is accepted (government, Saudi official, and well-known newspapers).
var NEWS_TRUSTED = ['spa.gov.sa', 'haj.gov.sa', 'hajcommittee.gov.in', 'minorityaffairs.gov.in', 'pib.gov.in',
  'mea.gov.in', 'ddnews.gov.in', 'newsonair.gov.in', 'saudigazette.com.sa', 'arabnews.com', 'arabnews.pk',
  'thehindu.com', 'indianexpress.com', 'timesofindia.indiatimes.com', 'hindustantimes.com', 'ndtv.com',
  'livemint.com', 'deccanherald.com', 'thehindubusinessline.com', 'news18.com', 'indiatoday.in', 'aninews.in',
  'ptinews.com', 'reuters.com', 'bbc.com', 'bbc.co.uk', 'khaleejtimes.com', 'gulfnews.com', 'gulf-times.com',
  'aljazeera.com', 'apnews.com', 'siasat.com', 'inquilab.com'];
// Headlines with these words are adverts or off-topic and are skipped.
var NEWS_SKIP = /\b(package|packages|offer|offers|discount|book now|booking|cheapest|cheap|price|prices|tour operator|travel agency|agents? fraud|stock|shares|sensex|cricket|film|movie|actor|actress|bollywood)\b/i;
var NEWS_MUST = /\b(hajj|haj|umrah|umra|nusuk|pilgrim|pilgrims|hujjaj|haji|hajis|haram|masjid al-haram|masjid an-nabawi|mina|arafat|muzdalifah|haj committee)\b/i;

var LEAD_HEAD = ['Time', 'Name', 'Mobile', 'WhatsApp', 'City', 'Package interest', 'Travellers', 'Best time to call',
                 'Language', 'Source', 'Status', 'Notes', 'Lead ID'];
var FB_HEAD   = ['Time', 'Stars', 'Feedback', 'Language', 'Source', 'Status', 'Lead ID'];
var NEWS_HEAD = ['Date', 'Title', 'Text', 'Show (yes/no/check)', 'Source', 'Link',
                 'Title Urdu', 'Title Hindi', 'Title Gujarati', 'Text Urdu', 'Text Hindi', 'Text Gujarati'];
var LANGS = { en: 'English', ur: 'Urdu', hi: 'Hindi', gu: 'Gujarati' };
var INTERESTS = ['Hajj 2027 Long Stay Package', 'Hajj 2027 Signature Package', 'Hajj 2027 Short Package', 'Umrah', 'Not sure yet'];
var CALL_TIMES = ['Any time', 'Morning', 'Afternoon', 'Evening'];

// Run this once from the editor (select "setup" and press Run). It also asks Google for permission to send the emails.
function setup() {
  var ss = SpreadsheetApp.getActive();
  sheet_(ss, 'Leads', LEAD_HEAD);
  sheet_(ss, 'Feedback', FB_HEAD);
  newsSheet_(ss);
  myHajjSheets_(ss);
  MailApp.getRemainingDailyQuota(); // makes Google ask for the "send email" permission now
}

function sheet_(ss, name, head) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(head);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#F8E4A6');
    sh.setFrozenRows(1);
    if (name === 'Leads') sh.getRange('C:C').setNumberFormat('@'); // keep mobile numbers as text
  }
  return sh;
}

// The News tab: creates it, or adds the new version-5 columns to an old one (old rows are kept as they are).
function newsSheet_(ss) {
  var sh = sheet_(ss, 'News', NEWS_HEAD);
  var have = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  if (have.length < NEWS_HEAD.length || String(have[4]) !== 'Source') {
    sh.getRange(1, 1, 1, NEWS_HEAD.length).setValues([NEWS_HEAD]).setFontWeight('bold').setBackground('#F8E4A6');
  }
  return sh;
}

function clean_(v, max) {
  v = String(v === null || v === undefined ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return v.slice(0, max || 100);
}

function out_(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}

function seen_(sh, idCol, id) {
  var last = sh.getLastRow();
  if (!id || last < 2) return false;
  var from = Math.max(2, last - 499);
  var ids = sh.getRange(from, idCol, last - from + 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return true;
  return false;
}

// Flood guard: counts per hour in the script cache. Returns true if this one is over the limit.
function flood_(kind) {
  var c = CacheService.getScriptCache(), k = 'n_' + kind + '_' + Math.floor(Date.now() / 3600000);
  var n = (parseInt(c.get(k), 10) || 0) + 1;
  c.put(k, String(n), 3700);
  return n > MAX_PER_HOUR;
}

// Robots: trap field filled, or the form was sent faster than a person can type.
function robot_(d) {
  if (d.website) return true;
  var min = d.type === 'Feedback' ? 1500 : MIN_FORM_MS; // tapping stars is quicker than typing a form
  if (d.ft !== undefined && d.ft !== null && (parseInt(d.ft, 10) || 0) < min) return true;
  return false;
}

function notify_(row) {
  if (!NOTIFY_EMAILS) return 'Email off (no address)';
  var esc = function (v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var lines = [['Name', row.name], ['Mobile', '+91 ' + row.mobile], ['City', row.city || '–'], ['Package', row.interest],
               ['Travellers', row.travellers], ['Best time to call', row.callTime || 'Any time'], ['Language', row.lang]];
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#222">' +
    '<h2 style="color:#A87B28;margin:0 0 10px">New Hajj enquiry from the app</h2><table cellpadding="6" style="border-collapse:collapse">' +
    lines.map(function (l) { return '<tr><td style="color:#777">' + l[0] + '</td><td><b>' + esc(l[1]) + '</b></td></tr>'; }).join('') +
    '</table><p><a href="tel:+91' + row.mobile + '">Call</a> &nbsp;·&nbsp; <a href="https://wa.me/91' + row.mobile + '">WhatsApp</a>' +
    ' &nbsp;·&nbsp; <a href="' + SpreadsheetApp.getActive().getUrl() + '">Open the Leads sheet</a></p></div>';
  var text = lines.map(function (l) { return l[0] + ': ' + l[1]; }).join('\n');
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return 'Email FAILED: daily email limit reached';
    MailApp.sendEmail({ to: NOTIFY_EMAILS, subject: 'New enquiry: ' + row.name + ' (' + row.city + ') – ' + row.interest,
                        body: text, htmlBody: html, name: 'Meezab E Rahemat App' });
    return 'Email sent';
  } catch (x) { // the row is already saved; email failure must not lose the lead
    return ('Email FAILED: ' + (x && x.message ? x.message : x)).slice(0, 300);
  }
}

// The app sends a plain-text POST with JSON inside (works without CORS).
function doPost(e) {
  var d;
  try { d = JSON.parse(e && e.postData && e.postData.contents || ''); } catch (x) { return out_('bad request'); }
  if (!d || typeof d !== 'object') return out_('bad request');
  if (d.type === 'myhajj' || d.type === 'admin') {
    var lk = LockService.getScriptLock();
    try { lk.waitLock(20000); } catch (x) { return json_({ ok: false, err: 'busy' }); }
    try { return json_(d.type === 'myhajj' ? myHajj_(d) : admin_(d)); }
    catch (x) { return json_({ ok: false, err: 'error' }); }
    finally { lk.releaseLock(); }
  }
  if (robot_(d)) return out_('ok'); // pretend ok, save nothing

  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (x) { return out_('busy'); }
  try {
    var ss = SpreadsheetApp.getActive();
    var id = clean_(d.id, 40).replace(/[^A-Za-z0-9]/g, '');
    var lang = LANGS[d.lang] || 'English';
    var source = clean_(d.source, 80);

    if (d.type === 'Feedback') {
      var fb = sheet_(ss, 'Feedback', FB_HEAD);
      if (seen_(fb, FB_HEAD.length, id)) return out_('ok (already saved)');
      var stars = Math.max(0, Math.min(5, parseInt(d.rating, 10) || 0));
      var note = clean_(d.notes, 2000);
      if (!stars && !note) return out_('empty feedback');
      if (/https?:\/\/|www\./i.test(note) && note.length < 40) return out_('ok'); // link-only spam
      if (flood_('fb')) return out_('ok');
      fb.appendRow([new Date(), stars || '', note, lang, source, 'New', id]);
      return out_('ok');
    }

    // Registration
    var mobile = String(d.mobile || '').replace(/\D/g, '');
    if (mobile.length === 12 && mobile.indexOf('91') === 0) mobile = mobile.slice(2);
    if (!/^[6-9]\d{9}$/.test(mobile) || /^(\d)\1{9}$/.test(mobile)) return out_('bad mobile');
    var name = clean_(d.name, 80);
    if (name.replace(/[\d\s.]/g, '').length < 2 || /https?:|www\./i.test(name)) return out_('bad name');
    var interest = INTERESTS.indexOf(d.interest) >= 0 ? d.interest : clean_(d.interest, 60);
    var callTime = CALL_TIMES.indexOf(d.callTime) >= 0 ? d.callTime : '';
    var travellers = Math.max(1, Math.min(20, parseInt(d.travelers, 10) || 1));
    var city = clean_(d.city, 60);

    var sh = sheet_(ss, 'Leads', LEAD_HEAD);
    if (seen_(sh, LEAD_HEAD.length, id)) return out_('ok (already saved)');
    var cache = CacheService.getScriptCache();
    if (cache.get('m_' + mobile)) return out_('ok (already saved)'); // same number again within 10 minutes
    if (flood_('lead')) return out_('ok');
    cache.put('m_' + mobile, '1', SAME_MOBILE_MIN * 60);

    sh.appendRow([new Date(), name, mobile, '', city, interest, travellers, callTime, lang, source, 'New', '', id]);
    sh.getRange(sh.getLastRow(), 4).setFormula('=HYPERLINK("https://wa.me/91' + mobile + '","Chat")');
    var mailNote = notify_({ name: name, mobile: mobile, city: city, interest: interest, travellers: travellers, callTime: callTime, lang: lang });
    sh.getRange(sh.getLastRow(), LEAD_HEAD.indexOf('Notes') + 1).setValue(mailNote);
    return out_('ok');
  } catch (err) {
    return out_('error');
  } finally {
    lock.releaseLock();
  }
}

// Opening the web-app link in a browser shows "Meezab leads link is working (v6)".
// The app calls ...?action=news to get the news rows that are approved (Show = yes, or empty for old rows).
function doGet(e) {
  if (!e || !e.parameter || e.parameter.action !== 'news') return out_('Meezab leads link is working (v' + VERSION + ')');
  var sh = SpreadsheetApp.getActive().getSheetByName('News');
  var list = [];
  if (sh && sh.getLastRow() > 1) {
    var w = Math.max(4, Math.min(NEWS_HEAD.length, sh.getLastColumn()));
    list = sh.getRange(2, 1, sh.getLastRow() - 1, w).getValues()
      .filter(function (r) { var s = String(r[3]).toLowerCase().trim(); return r[0] && r[1] && (s === 'yes' || s === ''); })
      .map(function (r) {
        var dt = r[0] instanceof Date ? r[0] : new Date(r[0]);
        var g = function (i, n) { return String(r[i] === undefined ? '' : r[i]).slice(0, n); };
        return {
          date: isNaN(dt) ? String(r[0]) : Utilities.formatDate(dt, 'Asia/Kolkata', 'd MMM yyyy').toUpperCase(),
          title: g(1, 160), text: g(2, 600), source: g(4, 60), link: /^https:\/\//.test(g(5, 600)) ? g(5, 600) : '',
          tr: { ur: { t: g(6, 200), x: g(9, 700) }, hi: { t: g(7, 200), x: g(10, 700) }, gu: { t: g(8, 200), x: g(11, 700) } }
        };
      })
      .reverse().slice(0, 10);
  }
  return ContentService.createTextOutput(JSON.stringify(list)).setMimeType(ContentService.MimeType.JSON);
}

// ======================= AUTOMATIC NEWS =======================

// Run ONCE from the editor: starts the daily automatic news (about 7 am India time). Safe to run again.
function setupNewsTimer() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'fetchNews') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('fetchNews').timeBased().everyDays(1).atHour(NEWS_HOUR).inTimezone('Asia/Kolkata').create();
  newsSheet_(SpreadsheetApp.getActive());
  Logger.log('Daily news timer is ON (about ' + NEWS_HOUR + ' am India time). Running once now as a test...');
  fetchNews();
}

// Daily job: collect trusted Hajj & Umrah news -> "News" tab (Show = yes if AUTO_PUBLISH, else check).
function fetchNews() {
  var ss = SpreadsheetApp.getActive(), sh = newsSheet_(ss);
  var known = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
      known[newsKey_(r[1])] = 1; if (r[5]) known[String(r[5])] = 1;
    });
  }
  var queries = ['hajj', 'umrah', '"haj committee" OR nusuk'];
  var found = [];
  queries.forEach(function (q) {
    var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent('(' + q + ') when:3d') + '&hl=en-IN&gl=IN&ceid=IN:en';
    var xml = '';
    try { xml = UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText(); } catch (x) { Logger.log('Fetch failed: ' + x); }
    newsParse_(xml).forEach(function (it) { found.push(it); });
  });
  var picked = newsPick_(found, known, NEWS_PER_DAY);
  picked.forEach(function (it) {
    var tr = function (to) { try { return LanguageApp.translate(it.title, 'en', to); } catch (x) { return ''; } };
    sh.appendRow([it.date, it.title, '', AUTO_PUBLISH ? 'yes' : 'check', it.source, it.link, tr('ur'), tr('hi'), tr('gu'), '', '', '']);
  });
  Logger.log('News: ' + found.length + ' found, ' + picked.length + ' new trusted item(s) added' + (AUTO_PUBLISH ? ' and published.' : ' with Show = check.'));
  if (picked.length && NOTIFY_EMAILS) {
    try {
      MailApp.sendEmail({ to: NOTIFY_EMAILS, name: 'Meezab E Rahemat App',
        subject: picked.length + (AUTO_PUBLISH ? ' Hajj/Umrah news published in the app' : ' Hajj/Umrah news waiting for your OK'),
        body: (AUTO_PUBLISH ? 'These trusted news items are now in the app. To remove one, open the "News" tab and change its "yes" to "no".\n\n'
                            : 'New news in the "News" tab (Show = check). Change "check" to "yes" to show it in the app, or "no" to hide it.\n\n') +
              picked.map(function (it) { return '- ' + it.title + ' (' + it.source + ')\n  ' + it.link; }).join('\n\n') +
              '\n\nOpen the Sheet: ' + ss.getUrl() });
    } catch (x) { Logger.log('News email failed: ' + x); }
  }
}

// Reads Google News RSS text into {title, link, date, source, domain}.
function newsParse_(xml) {
  var items = [], m, re = /<item>([\s\S]*?)<\/item>/g;
  var tag = function (s, t) { var r = new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + t + '>').exec(s); return r ? newsText_(r[1]) : ''; };
  while ((m = re.exec(xml || ''))) {
    var s = m[1], src = /<source\s+url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/.exec(s);
    var domain = src ? String(src[1]).replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase() : '';
    var source = src ? newsText_(src[2]) : '';
    var title = tag(s, 'title');
    if (source && title.slice(-(source.length + 3)) === ' - ' + source) title = title.slice(0, -(source.length + 3));
    var d = new Date(tag(s, 'pubDate'));
    items.push({ title: title.trim(), link: tag(s, 'link'), date: isNaN(d) ? new Date() : d, source: source, domain: domain });
  }
  return items;
}

// Keeps only trusted, on-topic, non-advert, not-yet-saved items; newest first.
function newsPick_(items, known, max) {
  var out = [], keys = {};
  items.sort(function (a, b) { return b.date - a.date; });
  for (var i = 0; i < items.length && out.length < max; i++) {
    var it = items[i], k = newsKey_(it.title);
    var ok = NEWS_TRUSTED.some(function (t) { return it.domain === t || it.domain.slice(-(t.length + 1)) === '.' + t; });
    if (!ok || !it.title || !NEWS_MUST.test(it.title) || NEWS_SKIP.test(it.title)) continue;
    if (!/^https:\/\//.test(it.link) || known[k] || known[it.link] || keys[k]) continue;
    keys[k] = 1; out.push(it);
  }
  return out;
}

function newsKey_(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80); }
function newsText_(s) {
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}


// ======================= MY HAJJ + ADMIN MEEZAB (version 6) =======================
// Tabs (created by setup):
//   "Pilgrims"  - one row per booked Hajj pilgrim. The Code is made automatically by the Admin meezab app.
//   "Alerts"    - messages for pilgrims (to "all" or to one pilgrim's code). Shown in the pilgrim's My Hajj page.
//   "Admin log" - who did what in the Admin meezab app (Sulait / Basil), with time.
// Passwords: Sheet menu  Meezab  >  Set admin password  (stored scrambled in the script settings, never in any app).

var LEADER_NAME  = 'Basil Ayyubi';     // group leader shown to every pilgrim (name only, no designation)
var LEADER_PHONE = '';                 // Basil's mobile with 91, e.g. '919800000000' - empty = office number below
var OFFICE_PHONE = '917038422399';     // office WhatsApp / call number
var ADMIN_USERS  = ['sulait', 'basil'];
var TOKEN_DAYS   = 30;                 // stay logged in on the admin phone for 30 days
var CODE_CHARS   = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L confusion

var PIL_HEAD = ['Code', 'Active (yes/no)', 'Name', 'Mobile', 'Package', 'Group',
  'Going flight', 'Going date & time', 'Return flight', 'Return date & time', 'Airport reporting',
  'Makkah hotel', 'Madinah hotel', 'Shifting hotel', 'Room Makkah', 'Room Madinah', 'Room shifting',
  'Passport', 'Visa', 'Vaccination', 'Photos', 'Ihram & kit', 'Advance paid', '2nd instalment', 'Balance paid',
  'Note for pilgrim', 'Added by', 'Added on', 'Updated by', 'Updated on'];
var PIL_EDIT = PIL_HEAD.slice(2, 26);                 // fields the admin app may change
var CHECKS = ['Passport', 'Visa', 'Vaccination', 'Photos', 'Ihram & kit', 'Advance paid', '2nd instalment', 'Balance paid'];
var ALERT_HEAD = ['Time', 'To (all / code)', 'Title', 'Message', 'Show (yes/no)', 'By',
  'Title Urdu', 'Title Hindi', 'Title Gujarati', 'Message Urdu', 'Message Hindi', 'Message Gujarati'];
var LOG_HEAD = ['Time', 'User', 'Action', 'Details'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Meezab')
    .addItem('Set admin password', 'menuSetPassword')
    .addItem('Log out all admin phones', 'menuLogoutAll')
    .addToUi();
}

function myHajjSheets_(ss) {
  var p = sheet_(ss, 'Pilgrims', PIL_HEAD);
  if (String(p.getRange(1, 1).getValue()) !== 'Code') {   // 6.1 repair: header row was overwritten by version 6.0
    p.insertRowBefore(1);
    p.getRange(1, 1, 1, PIL_HEAD.length).setValues([PIL_HEAD]).setFontWeight('bold').setBackground('#F8E4A6');
    p.setFrozenRows(1);
  }
  p.getRange('A:A').setNumberFormat('@'); p.getRange('D:D').setNumberFormat('@');
  return { p: p, a: sheet_(ss, 'Alerts', ALERT_HEAD), l: sheet_(ss, 'Admin log', LOG_HEAD) };
}

// ---------- passwords (menu in the Sheet) ----------
function hash_(s) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8));
}
function menuSetPassword() {
  var ui = SpreadsheetApp.getUi();
  var u = ui.prompt('Admin meezab', 'Whose password? Type  sulait  or  basil', ui.ButtonSet.OK_CANCEL);
  if (u.getSelectedButton() !== ui.Button.OK) return;
  var user = String(u.getResponseText()).toLowerCase().trim();
  if (ADMIN_USERS.indexOf(user) < 0) { ui.alert('Please type sulait or basil.'); return; }
  var p = ui.prompt('Admin meezab', 'New password for ' + user + ' (at least 8 letters/numbers):', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  var pass = String(p.getResponseText());
  if (pass.length < 8) { ui.alert('Too short - use at least 8 characters.'); return; }
  var props = PropertiesService.getScriptProperties(), salt = Utilities.getUuid();
  props.setProperty('pw_' + user, salt + ':' + hash_(salt + pass));
  props.deleteProperty('tok_' + user); // old logins end
  myHajjSheets_(SpreadsheetApp.getActive());
  ui.alert('Password saved for ' + user + '. Use it to log in to the Admin meezab app.');
}
function menuLogoutAll() {
  var props = PropertiesService.getScriptProperties();
  ADMIN_USERS.forEach(function (u) { props.deleteProperty('tok_' + u); });
  SpreadsheetApp.getUi().alert('All admin phones are logged out.');
}

// ---------- helpers ----------
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function yes_(v) { v = String(v).toLowerCase().trim(); return v === 'yes' || v === 'y' || v === 'true' || v === '✓' || v === 'done'; }
function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Kolkata', 'd MMM yyyy, h:mm a');
  return String(v === null || v === undefined ? '' : v);
}
function newCode_(p) {
  var have = {}, last = p.getLastRow();
  if (last > 1) p.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) { have[String(r[0])] = 1; });
  for (var n = 0; n < 50; n++) {
    var b = Utilities.getUuid().replace(/-/g, ''), s = '';
    for (var i = 0; i < 6; i++) s += CODE_CHARS.charAt(parseInt(b.substr(i * 2, 2), 16) % CODE_CHARS.length);
    var c = 'MZB-' + s.slice(0, 4) + '-' + s.slice(4);
    if (!have[c]) return c;
  }
  throw new Error('could not make a code');
}
function findRow_(p, code) {
  var last = p.getLastRow(); if (last < 2) return 0;
  var codes = p.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < codes.length; i++) if (String(codes[i][0]).toUpperCase() === code) return i + 2;
  return 0;
}
function cleanCode_(c) {
  c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.indexOf('MZB') === 0) c = c.slice(3);
  return c.length === 6 ? 'MZB-' + c.slice(0, 4) + '-' + c.slice(4) : '';
}
function log_(ss, user, action, details) {
  try { myHajjSheets_(ss).l.appendRow([new Date(), user, action, clean_(details, 300)]); } catch (x) {}
}
function alertsFor_(a, code) {
  var last = a.getLastRow(); if (last < 2) return [];
  return a.getRange(2, 1, last - 1, ALERT_HEAD.length).getValues()
    .filter(function (r) { var to = String(r[1]).toUpperCase().trim(); return r[3] && yes_(r[4] || 'yes') && (to === 'ALL' || to === code); })
    .map(function (r) {
      return { time: str_(r[0]), title: str_(r[2]).slice(0, 120), text: str_(r[3]).slice(0, 800), to: String(r[1]).toUpperCase() === 'ALL' ? 'all' : 'me',
        tr: { ur: { t: str_(r[6]), x: str_(r[9]) }, hi: { t: str_(r[7]), x: str_(r[10]) }, gu: { t: str_(r[8]), x: str_(r[11]) } } };
    }).reverse().slice(0, 30);
}

// ---------- pilgrim: My Hajj ----------
function myHajj_(d) {
  var c = CacheService.getScriptCache(), k = 'mh_bad_' + Math.floor(Date.now() / 3600000);
  if ((parseInt(c.get(k), 10) || 0) > 120) return { ok: false, err: 'busy' };   // guessing guard
  var code = cleanCode_(d.code);
  var ss = SpreadsheetApp.getActive(), sh = myHajjSheets_(ss), row = code ? findRow_(sh.p, code) : 0;
  var r = row ? sh.p.getRange(row, 1, 1, PIL_HEAD.length).getValues()[0] : null;
  if (!r || !yes_(r[1] || 'yes')) { c.put(k, String((parseInt(c.get(k), 10) || 0) + 1), 3700); return { ok: false, err: 'code' }; }
  var g = function (h) { return str_(r[PIL_HEAD.indexOf(h)]); };
  var checks = {}; CHECKS.forEach(function (h) { checks[h] = yes_(r[PIL_HEAD.indexOf(h)]); });
  var dep = r[PIL_HEAD.indexOf('Going date & time')];
  return { ok: true, code: code, name: g('Name'), pkg: g('Package'), group: g('Group'),
    going: { flight: g('Going flight'), when: g('Going date & time'), at: dep instanceof Date ? dep.getTime() : 0, report: g('Airport reporting') },
    back: { flight: g('Return flight'), when: g('Return date & time') },
    hotels: { makkah: g('Makkah hotel'), madinah: g('Madinah hotel'), shifting: g('Shifting hotel'),
              roomMakkah: g('Room Makkah'), roomMadinah: g('Room Madinah'), roomShifting: g('Room shifting') },
    checks: checks, note: g('Note for pilgrim'),
    leader: { name: LEADER_NAME, phone: LEADER_PHONE || OFFICE_PHONE }, office: OFFICE_PHONE,
    alerts: alertsFor_(sh.a, code) };
}

// ---------- admin: Admin meezab app ----------
function admin_(d) {
  var props = PropertiesService.getScriptProperties(), cache = CacheService.getScriptCache();
  var user = String(d.user || '').toLowerCase().trim();
  if (ADMIN_USERS.indexOf(user) < 0) return { ok: false, err: 'login' };
  var lockKey = 'adm_bad_' + user, bad = parseInt(cache.get(lockKey), 10) || 0;
  if (bad >= 5) return { ok: false, err: 'locked' };          // 5 wrong passwords = 15 minutes locked
  var ss = SpreadsheetApp.getActive();

  if (d.action === 'login') {
    var saved = props.getProperty('pw_' + user);
    if (!saved) return { ok: false, err: 'nopass' };
    var parts = saved.split(':');
    if (hash_(parts[0] + String(d.pass || '')) !== parts[1]) {
      cache.put(lockKey, String(bad + 1), 900); return { ok: false, err: 'login', left: Math.max(0, 4 - bad) };
    }
    cache.remove(lockKey);
    var tok = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('tok_' + user, hash_(tok) + ':' + (Date.now() + TOKEN_DAYS * 864e5));
    log_(ss, user, 'login', '');
    return { ok: true, token: tok, user: user };
  }
  // every other action needs the token from login
  var t = String(props.getProperty('tok_' + user) || '').split(':');
  if (!d.token || t.length < 2 || hash_(String(d.token)) !== t[0] || Date.now() > Number(t[1])) return { ok: false, err: 'login' };

  var sh = myHajjSheets_(ss), data = d.data || {};
  switch (d.action) {
    case 'pilgrims': {
      var last = sh.p.getLastRow(), list = [];
      if (last > 1) list = sh.p.getRange(2, 1, last - 1, PIL_HEAD.length).getValues().map(function (r) {
        var o = {}; PIL_HEAD.forEach(function (h, i) { o[h] = str_(r[i]); }); return o; });
      return { ok: true, head: PIL_HEAD, checks: CHECKS, list: list.reverse() };
    }
    case 'savePilgrim': {
      var code = cleanCode_(data.Code), row = code ? findRow_(sh.p, code) : 0, now = new Date();
      if (!clean_(data.Name, 80)) return { ok: false, err: 'name' };
      var isNew = !row;
      if (!row) { code = newCode_(sh.p);                       // 6.1: append a row that already has content
        var blank = PIL_HEAD.map(function () { return ''; });
        blank[0] = code; blank[1] = 'yes'; blank[PIL_HEAD.indexOf('Added by')] = user; blank[PIL_HEAD.indexOf('Added on')] = now;
        sh.p.appendRow(blank); row = sh.p.getLastRow();
        if (String(sh.p.getRange(row, 1).getValue()) !== code) throw new Error('row not added'); }
      var vals = sh.p.getRange(row, 1, 1, PIL_HEAD.length).getValues()[0];
      PIL_EDIT.forEach(function (h) { if (data[h] !== undefined) {
        var v = CHECKS.indexOf(h) >= 0 ? (yes_(data[h]) ? 'yes' : '') : clean_(data[h], h === 'Note for pilgrim' ? 500 : 120);
        vals[PIL_HEAD.indexOf(h)] = v; } });
      if (data['Active (yes/no)'] !== undefined) vals[1] = yes_(data['Active (yes/no)']) ? 'yes' : 'no';
      vals[PIL_HEAD.indexOf('Updated by')] = user; vals[PIL_HEAD.indexOf('Updated on')] = now;
      sh.p.getRange(row, 1, 1, PIL_HEAD.length).setValues([vals]);
      log_(ss, user, isNew ? 'add pilgrim' : 'update pilgrim', code + ' ' + vals[2]);
      return { ok: true, code: code };
    }
    case 'sendAlert': {
      var to = String(data.to || 'all').toUpperCase() === 'ALL' ? 'all' : cleanCode_(data.to);
      var title = clean_(data.title, 120), msg = clean_(data.text, 800);
      if (!to || !msg) return { ok: false, err: 'alert' };
      var tr = function (s, l) { if (!s) return ''; try { return LanguageApp.translate(s, '', l); } catch (x) { return ''; } };
      sh.a.appendRow([new Date(), to, title, msg, 'yes', user, tr(title, 'ur'), tr(title, 'hi'), tr(title, 'gu'), tr(msg, 'ur'), tr(msg, 'hi'), tr(msg, 'gu')]);
      log_(ss, user, 'alert', to + ': ' + (title || msg));
      return { ok: true };
    }
    case 'alerts': {
      var al = sh.a.getLastRow(), rows = [];
      if (al > 1) rows = sh.a.getRange(2, 1, al - 1, 6).getValues().map(function (r, i) {
        return { row: i + 2, time: str_(r[0]), to: str_(r[1]), title: str_(r[2]), text: str_(r[3]), show: str_(r[4]), by: str_(r[5]) }; });
      return { ok: true, list: rows.reverse().slice(0, 100) };
    }
    case 'hideAlert': {
      var ar = parseInt(data.row, 10);
      if (ar >= 2 && ar <= sh.a.getLastRow()) { sh.a.getRange(ar, 5).setValue(yes_(data.show) ? 'yes' : 'no'); log_(ss, user, 'alert show/hide', 'row ' + ar); }
      return { ok: true };
    }
    case 'leads': {
      var ls = ss.getSheetByName('Leads'), ll = ls ? ls.getLastRow() : 0, leads = [];
      if (ll > 1) leads = ls.getRange(2, 1, ll - 1, LEAD_HEAD.length).getValues().map(function (r, i) {
        var o = { row: i + 2 }; LEAD_HEAD.forEach(function (h, j) { o[h] = str_(r[j]); }); return o; });
      return { ok: true, list: leads.reverse().slice(0, 200) };
    }
    case 'leadStatus': {
      var lsh = ss.getSheetByName('Leads'), lr = parseInt(data.row, 10);
      if (lsh && lr >= 2 && lr <= lsh.getLastRow()) {
        lsh.getRange(lr, LEAD_HEAD.indexOf('Status') + 1).setValue(clean_(data.status, 40));
        if (data.note !== undefined) lsh.getRange(lr, LEAD_HEAD.indexOf('Notes') + 1).setValue(clean_(data.note, 300));
        log_(ss, user, 'lead status', 'row ' + lr + ' ' + data.status);
      }
      return { ok: true };
    }
    case 'logout': { props.deleteProperty('tok_' + user); return { ok: true }; }
  }
  return { ok: false, err: 'action' };
}

// TEST 1 - run from the editor: adds one test row to "Leads" AND emails Basil + Sulait. (Delete the test row afterwards.)
function testLead() {
  var r = doPost({ postData: { contents: JSON.stringify({
    type: 'Registration', name: 'Test Pilgrim', mobile: '9876543210', city: 'Malegaon',
    interest: 'Hajj 2027 Long Stay Package', travelers: 2, callTime: 'Evening', lang: 'en',
    source: 'Test from editor', id: 'test' + Date.now(), ft: 9000 }) } });
  Logger.log('Lead: ' + r.getContent());
}

// TEST 2 - run from the editor: adds one test row to "Feedback". (Delete it afterwards.)
function testFeedback() {
  var r = doPost({ postData: { contents: JSON.stringify({
    type: 'Feedback', rating: 5, notes: 'Test feedback from the editor', lang: 'en',
    source: 'Test from editor', id: 'fbtest' + Date.now(), ft: 9000 }) } });
  Logger.log('Feedback: ' + r.getContent());
}

// TEST 3 - run from the editor: sends a plain test email. Shows a RED error if email is blocked (permission missing).
function testEmail() {
  try {
    MailApp.sendEmail(NOTIFY_EMAILS, 'Meezab test email', 'If you can read this, enquiry emails work.');
    Logger.log('Email sent to ' + NOTIFY_EMAILS + '. Remaining today: ' + MailApp.getRemainingDailyQuota());
  } catch (x) {
    Logger.log('EMAIL BLOCKED: ' + (x && x.message ? x.message : x));
    throw x;
  }
}
