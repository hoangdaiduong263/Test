/**
 * D2S Simulation – Apps Script backend
 * Gắn script này vào Google Sheet "Linehaul Data" (Extensions → Apps Script).
 *
 * Việc của file này:
 *   1. Đọc sheet Linehaul Data (bound) + Google Sheet D2S Volume Tracking (theo ID).
 *   2. Nén thành 1 gói JSON đúng cấu trúc mà trang web cần.
 *   3. Cất gói đó vào sheet ẩn _D2S_CACHE để web mở nhanh (không phải tính lại).
 *   4. Phục vụ web app (doGet) + lưu cấu hình người dùng vào sheet _D2S_CONFIG.
 */

/* ===================== CẤU HÌNH – SỬA Ở ĐÂY ===================== */
var VOLUME_SPREADSHEET_ID = 'DÁN_ID_CỦA_D2S_VOLUME_TRACKING_VÀO_ĐÂY';
var VOLUME_SHEET          = 'Transformed';    // sheet có cột virtual_station_name, cdate, shipment_count...
var DAYTYPE_SHEET         = 'Config [Report]'; // sheet có cột DATE / TYPE (BAU, Mini, CP). Tên tìm theo kiểu 'gần đúng' nên 'Config Report' cũng khớp.
var LINEHAUL_SHEET        = 'Data';           // sheet dữ liệu chuyến trong chính file này
var STATION_SHEET         = 'Station';        // sheet danh sách trạm (cột Tên trạm, Vĩ độ, Kinh độ) trong chính file này. Không có thì web vẫn chạy, chỉ thiếu số km.
var WINDOW_DAYS           = 92;               // số ngày dữ liệu nạp vào web; trên web tự chọn khoảng ngày trong đó
var WINDOW_END            = '';               // để trống = tới ngày mới nhất; hoặc '2026-08-31' để khoá cửa sổ
/* ===================================================================== */

var BACKEND_VERSION = 8;   // v8: ngày của chuyến theo ngày xe thật tới điểm (Giờ đến điểm), không theo ngày plan
// v7: thêm tọa độ (GEO) từ sheet 'Station' để tính khoảng cách giữa các điểm/Hub/SOC
// v6: chia tiền chuyến theo SỐ ĐƠN lên tại điểm (cột 'Đơn lên tại điểm'), không theo TO
// v5: thêm lộ trình từng chuyến (T, TN) cho popup (i) cạnh loại xe. Tăng BACKEND_VERSION mỗi lần đổi cấu trúc gói dữ liệu.
var CACHE_SHEET  = '_D2S_CACHE';
var CONFIG_SHEET = '_D2S_CONFIG';
var VEH_TYPES    = ['1T9', '5T', '1T25', 'VAN', '8T', 'KHAC'];

/* ---------- Menu trong Sheet ---------- */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('D2S Simulation')
    .addItem('Cập nhật dữ liệu ngay', 'rebuildCache')
    .addItem('Kiểm tra dữ liệu có bao nhiêu ngày', 'checkData')
    .addItem('Tạo lịch cập nhật hằng ngày (07:00)', 'installDailyTrigger')
    .addItem('Mở link web app', 'showWebAppUrl')
    .addToUi();
}

function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rebuildCache') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rebuildCache').timeBased().atHour(7).everyDays(1).create();
  // Chạy lại mỗi khi chính file Linehaul Data thay đổi (crawl ghi thêm dòng)
  ScriptApp.newTrigger('rebuildCache').forSpreadsheet(SpreadsheetApp.getActive()).onChange().create();
  SpreadsheetApp.getUi().alert('Đã đặt lịch: 07:00 hằng ngày và mỗi khi file Linehaul Data thay đổi.');
}

/**
 * Kiểm tra vì sao web chỉ chọn được một số ngày.
 * Báo: mỗi sheet có bao nhiêu ngày, từ ngày nào đến ngày nào, và cửa sổ web đang nhận.
 */
function checkData() {
  var out = [];
  var ss = SpreadsheetApp.openById(VOLUME_SPREADSHEET_ID);
  var here = SpreadsheetApp.getActive();

  out.push('CÁC SHEET ĐANG CÓ');
  out.push('· Volume Tracking: ' + sheetNames_(ss).join(' | '));
  out.push('· File này (Linehaul): ' + sheetNames_(here).filter(function (n) { return n.indexOf('_D2S_') !== 0; }).join(' | '));
  out.push('');

  // Tìm sheet + kiểm cột bắt buộc + đếm ngày
  function check(ss2, wanted, dateCol, need, label) {
    var sh = sheetByName_(ss2, wanted);
    if (!sh) { out.push('✗ ' + label + ': KHÔNG TÌM THẤY sheet tên "' + wanted + '".'); return null; }
    var hit = sh.getName() === wanted ? '' : ' (khớp gần đúng với sheet "' + sh.getName() + '")';
    var v = sh.getDataRange().getValues();
    if (!v || v.length < 2) { out.push('✗ ' + label + hit + ': sheet rỗng.'); return null; }
    var miss = [];
    for (var k in need) { var ix = idx_(v[0], {x: need[k]}); if (ix.x < 0) miss.push(need[k].join('/')); }
    var ix2 = idx_(v[0], { d: dateCol });
    var ds = [];
    if (ix2.d >= 0) { var set = {};
      for (var r = 1; r < v.length; r++) { var d = dstr_(v[r][ix2.d]); if (d) set[d] = 1; }
      ds = Object.keys(set).sort(); }
    out.push((miss.length ? '! ' : '✓ ') + label + hit + ': ' + (v.length - 1) + ' dòng' +
      (ds.length ? ', ' + ds.length + ' ngày ' + ds[0] + ' → ' + ds[ds.length - 1] : ', không đọc được ngày') +
      (miss.length ? '\n   THIẾU CỘT: ' + miss.join(', ') : ''));
    return ds;
  }

  var volDates = check(ss, VOLUME_SHEET, ['cdate'],
    { a: ['region'], b: ['cdate'], c: ['virtual_station_name'], d: ['shipment_count', 'total_vol'],
      e: ['bulky_count', 'bulky_order'], f: ['fm_hub_name', 'fm_hub_cover'] }, 'Sheet đơn hàng');
  check(ss, DAYTYPE_SHEET, ['DATE'], { a: ['DATE'], b: ['TYPE'] }, 'Sheet loại ngày');
  check(here, LINEHAUL_SHEET, ['Ngày'],
    { a: ['Ngày'], b: ['Mã chuyến'], c: ['Thứ tự dừng'], d: ['Tên điểm'], e: ['Loại điểm'],
      f: ['Đơn lên tại điểm', 'TO lên tại điểm'], g: ['Loại xe'], h: ['Giờ tải hàng (loading_time)'] }, 'Sheet chuyến');

  out.push('');
  out.push('CỬA SỔ NGÀY');
  out.push('WINDOW_DAYS = ' + WINDOW_DAYS + ' · WINDOW_END = ' + (WINDOW_END || '(trống – tới ngày mới nhất)'));
  if (volDates && volDates.length) {
    var av = volDates.slice();
    if (WINDOW_END) av = av.filter(function (d) { return d <= WINDOW_END; });
    var win = av.slice(-WINDOW_DAYS);
    out.push('→ Web sẽ nhận ' + win.length + ' ngày: ' + win[0] + ' → ' + win[win.length - 1]);
    out.push(win.length < WINDOW_DAYS
      ? 'Bị giới hạn bởi DỮ LIỆU (sheet ' + VOLUME_SHEET + ' chỉ có ' + av.length + ' ngày), không phải bởi WINDOW_DAYS.'
      : 'Bị cắt bởi WINDOW_DAYS. Tăng số đó rồi chạy lại "Cập nhật dữ liệu ngay".');
  }

  var info = getDataInfo();
  out.push('');
  out.push('GÓI ĐANG PHỤC VỤ WEB: ' + (info && info.rows ? info.rows : 'chưa có') +
           (info && info.builtAt ? ' · cập nhật ' + info.builtAt : ''));
  out.push('Khác với dòng "Web sẽ nhận" ⇒ chưa chạy lại "Cập nhật dữ liệu ngay" sau khi sửa Code.gs.');

  SpreadsheetApp.getUi().alert('Kiểm tra dữ liệu D2S', out.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  Logger.log(out.join('\n'));
  return out.join('\n');
}

function showWebAppUrl() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(url ? url : 'Chưa deploy. Vào Deploy → New deployment → Web app.');
}

/* ---------- Web app ---------- */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('D2S Seller Planner')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Trang gọi hàm này để lấy dữ liệu (trả về chuỗi JSON đã nén sẵn trong cache). */
function getData() {
  var json = readCache();
  if (!json) json = rebuildCache();
  return json;
}

function getDataInfo() {
  var p = PropertiesService.getDocumentProperties();
  return { builtAt: p.getProperty('builtAt') || '', rows: p.getProperty('rows') || '' };
}

/* ---------- Cache: cất JSON vào sheet ẩn, mỗi ô tối đa 45.000 ký tự ---------- */
function cacheSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CACHE_SHEET);
  if (!sh) { sh = ss.insertSheet(CACHE_SHEET); sh.hideSheet(); }
  return sh;
}

function writeCache_(json) {
  var sh = cacheSheet_(), size = 45000, parts = [];
  for (var i = 0; i < json.length; i += size) parts.push([json.substr(i, size)]);
  sh.clear();
  if (parts.length) sh.getRange(1, 1, parts.length, 1).setValues(parts);
}

function readCache() {
  var sh = SpreadsheetApp.getActive().getSheetByName(CACHE_SHEET);
  if (!sh || sh.getLastRow() === 0) return null;
  return sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return r[0]; }).join('');
}

/* ---------- Lưu cấu hình người dùng ---------- */
function configSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CONFIG_SHEET);
  if (!sh) { sh = ss.insertSheet(CONFIG_SHEET); sh.hideSheet(); sh.appendRow(['key', 'json', 'updatedAt']); }
  return sh;
}

function loadConfig() {
  var sh = configSheet_(), out = {};
  if (sh.getLastRow() < 2) return JSON.stringify(out);
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (r[0]) out[r[0]] = r[1];
  });
  return JSON.stringify(out);
}

function saveConfig(key, json) {
  var sh = configSheet_(), rows = sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var now = new Date();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) { sh.getRange(i + 2, 2, 1, 2).setValues([[json, now]]); return 'ok'; }
  }
  sh.appendRow([key, json, now]);
  return 'ok';
}

/* ===================== DỰNG DỮ LIỆU ===================== */

function rebuildCache() {
  var t0 = new Date();
  var data = buildData_();
  var json = JSON.stringify(data);
  writeCache_(json);
  PropertiesService.getDocumentProperties().setProperties({
    builtAt: Utilities.formatDate(t0, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
    rows: String(data.S.length) + ' điểm · ' + data.dates.length + ' ngày (' +
          data.dates[0] + ' → ' + data.dates[data.dates.length - 1] + ')'
  });
  return json;
}

/**
 * Tìm sheet theo tên, chấp nhận lệch dấu ngoặc / khoảng trắng / hoa thường.
 * 'Config Report' khớp được 'Config [Report]', 'config-report'...
 * Trả về null nếu không có sheet nào gần đúng.
 */
function sheetByName_(ss, name) {
  if (!ss || !name) return null;
  var exact = ss.getSheetByName(name);
  if (exact) return exact;
  var norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  var want = norm(name), all = ss.getSheets();
  for (var i = 0; i < all.length; i++) if (norm(all[i].getName()) === want) return all[i];
  return null;
}
function sheetNames_(ss) {
  return ss.getSheets().map(function (s) { return s.getName(); });
}

function num_(v) {
  // Cột "TO lên tại điểm" hay bị định dạng thành ngày; đổi ngược về số.
  if (v === '' || v === null || v === undefined) return 0;
  if (v instanceof Date) return Math.round((v.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
  if (typeof v === 'string') {
    var m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000);
    if (/^\d{1,2}:\d{2}/.test(v)) return 0;
  }
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

function dstr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}

function idx_(header, names) {
  var map = {};
  header.forEach(function (h, i) { map[String(h).trim()] = i; });
  var out = {};
  Object.keys(names).forEach(function (k) {
    var found = -1;
    names[k].forEach(function (n) { if (found < 0 && map[n] !== undefined) found = map[n]; });
    out[k] = found;
  });
  return out;
}

function vehType_(v) {
  v = String(v || '').toUpperCase();
  if (v.indexOf('1T9') >= 0) return '1T9';
  if (v.indexOf('1T25') >= 0) return '1T25';
  if (v.indexOf('5T') >= 0) return '5T';
  if (v.indexOf('8T') >= 0) return '8T';
  if (v.indexOf('VAN') >= 0) return 'VAN';
  return 'KHAC';
}

function median_(a) {
  a = a.filter(function (x) { return x !== null && !isNaN(x); }).sort(function (x, y) { return x - y; });
  if (!a.length) return null;
  var m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function buildData_() {
  /* ---- 1. Đơn theo điểm theo ngày (từ file Volume Tracking) ---- */
  var vsh = sheetByName_(SpreadsheetApp.openById(VOLUME_SPREADSHEET_ID), VOLUME_SHEET);
  if (!vsh) throw new Error('Không thấy sheet ' + VOLUME_SHEET + ' trong file Volume Tracking.');
  var vv = vsh.getDataRange().getValues();
  var vi = idx_(vv[0], {
    region: ['region'], date: ['cdate'], hub: ['fm_hub_name', 'fm_hub_cover'],
    vs: ['virtual_station_name'], vol: ['shipment_count', 'total_vol'], bk: ['bulky_count', 'bulky_order']
  });

  var vol = {}, dateSet = {}, hubVol = {}, regionOf = {};
  for (var r = 1; r < vv.length; r++) {
    var vs = String(vv[r][vi.vs] || '').trim(); if (!vs) continue;
    var d = dstr_(vv[r][vi.date]); if (!d) continue;
    var q = num_(vv[r][vi.vol]), bq = num_(vv[r][vi.bk]);
    if (q <= 0) continue;
    dateSet[d] = 1;
    regionOf[vs] = String(vv[r][vi.region] || '').trim();
    var k = vs + '|' + d;
    if (!vol[k]) vol[k] = [0, 0];
    vol[k][0] += q; vol[k][1] += bq;
    var hub = String(vv[r][vi.hub] || '').trim();
    if (hub) { var hk = vs + '|' + hub; hubVol[hk] = (hubVol[hk] || 0) + q; }
  }

  var allDates = Object.keys(dateSet).sort();
  if (WINDOW_END) allDates = allDates.filter(function (d) { return d <= WINDOW_END; });
  var dates = allDates.slice(-WINDOW_DAYS);
  var dayIx = {}; dates.forEach(function (d, i) { dayIx[d] = i; });
  var ND = dates.length;

  /* ---- 2. Loại ngày BAU / Mini CP / CP ---- */
  var dt = dates.map(function () { return 0; });
  var warn = [];
  var csh = sheetByName_(SpreadsheetApp.openById(VOLUME_SPREADSHEET_ID), DAYTYPE_SHEET);
  if (!csh) {
    warn.push('Không tìm thấy sheet loại ngày "' + DAYTYPE_SHEET + '" trong file Volume Tracking (các sheet đang có: ' +
      sheetNames_(SpreadsheetApp.openById(VOLUME_SPREADSHEET_ID)).join(', ') +
      '). MỌI NGÀY ĐANG BỊ COI LÀ BAU — số liệu ngày Mini CP và CP sẽ sai.');
  } else {
    var cv = csh.getDataRange().getValues(), ci = idx_(cv[0], { d: ['DATE'], t: ['TYPE'] });
    if (ci.d < 0 || ci.t < 0) {
      warn.push('Sheet "' + csh.getName() + '" thiếu cột DATE hoặc TYPE. Mọi ngày đang bị coi là BAU.');
    } else {
      var nHit = 0;
      for (var i = 1; i < cv.length; i++) {
        var dd = dstr_(cv[i][ci.d]); if (dayIx[dd] === undefined) continue;
        var ty = String(cv[i][ci.t] || '').toUpperCase();
        dt[dayIx[dd]] = ty.indexOf('CP') === 0 ? 2 : (ty.indexOf('MINI') === 0 ? 1 : 0);
        nHit++;
      }
      if (!nHit) warn.push('Sheet "' + csh.getName() + '" không có ngày nào trùng với cửa sổ đang tính. Mọi ngày đang bị coi là BAU.');
    }
  }

  /* ---- 3. Chuyến linehaul ---- */
  var lsh = sheetByName_(SpreadsheetApp.getActive(), LINEHAUL_SHEET);
  if (!lsh) throw new Error('Không thấy sheet ' + LINEHAUL_SHEET + ' trong file Linehaul Data.');
  var lv = lsh.getDataRange().getValues();
  var li = idx_(lv[0], {
    date: ['Ngày'], code: ['Mã chuyến'], seq: ['Thứ tự dừng'], name: ['Tên điểm'],
    type: ['Loại điểm'], up: ['Đơn lên tại điểm', 'TO lên tại điểm'], veh: ['Loại xe'], load: ['Giờ tải hàng (loading_time)'],
    src: ['Nguồn chuyến'], vendor: ['Nhà thầu'],
    dn: ['Đơn xuống tại điểm', 'TO xuống tại điểm'], toN: ['Số TO (API đơn)'], arr: ['Giờ đến điểm'], dep: ['Giờ đi điểm'], arrK: ['Giờ đến KH'],
    plate: ['Biển số'], km: ['Quãng đường (km)']
  });
  var tz = Session.getScriptTimeZone();
  // phút tính từ 0h ngày của chuyến (qua ngày thì > 1440)
  function minOf_(v, d0) {
    if (!(v instanceof Date)) return null;
    var hh = Utilities.formatDate(v, tz, 'HH:mm').split(':');
    var dd = Math.round((Date.parse(dstr_(v)) - Date.parse(d0)) / 86400000);
    return dd * 1440 + (+hh[0]) * 60 + (+hh[1]);
  }

  var trips = {}, lhSeen = {};
  /* Ngày của chuyến = ngày xe THỰC TẾ tới điểm D2S đầu tiên (cột Giờ đến điểm).
     Cột Ngày là ngày theo plan: có chuyến plan ngày 7 nhưng xe chạy ngày 6, hàng là của ngày 6. */
  var rowsOf = {}, order = [];
  for (var r1 = 1; r1 < lv.length; r1++) {
    var c1 = String(lv[r1][li.code] || '').trim(); if (!c1) continue;
    if (!rowsOf[c1]) { rowsOf[c1] = []; order.push(c1); }
    rowsOf[c1].push(r1);
  }
  var dayOfTrip = {};
  order.forEach(function (c1) {
    var rs = rowsOf[c1].slice().sort(function (a, b) { return num_(lv[a][li.seq]) - num_(lv[b][li.seq]); });
    var d0 = dstr_(lv[rs[0]][li.date]);
    for (var q = 0; q < rs.length; q++) {
      var ty = String(lv[rs[q]][li.type] || '').trim();
      if (ty === 'SOC' || ty === 'Hub') continue;
      var av = li.arr >= 0 ? lv[rs[q]][li.arr] : null;
      if (av instanceof Date) d0 = dstr_(av);
      break;
    }
    dayOfTrip[c1] = d0;
  });
  var allRows = [];
  order.forEach(function (c1) { rowsOf[c1].forEach(function (r) { allRows.push(r); }); });
  for (var rr = 0; rr < allRows.length; rr++) {
    var r2 = allRows[rr];
    var code = String(lv[r2][li.code] || '').trim();
    var d2 = dayOfTrip[code]; if (dayIx[d2] === undefined) continue;
    lhSeen[d2] = 1;
    var t = trips[code] || (trips[code] = { d: d2, veh: vehType_(lv[r2][li.veh]), stops: [], socs: {}, upAll: 0, upD2S: 0, upHub: 0, firstType: null,
      adhoc: li.src >= 0 && String(lv[r2][li.src] || '').trim().toLowerCase() === 'adhoc',
      inh: li.vendor >= 0 && String(lv[r2][li.vendor] || '').trim().toLowerCase() === 'in-house',
      path: [], plate: li.plate >= 0 ? String(lv[r2][li.plate] || '').trim() : '',
      km: li.km >= 0 && lv[r2][li.km] !== '' ? Math.round(num_(lv[r2][li.km]) * 10) / 10 : null });
    var type = String(lv[r2][li.type] || '').trim();
    var up = num_(lv[r2][li.up]);
    var name = String(lv[r2][li.name] || '').trim();
    var seq = num_(lv[r2][li.seq]);
    if (t.firstType === null || seq === 1) t.firstType = type;
    t.path.push([seq, name, type === 'SOC' ? 2 : (type === 'Hub' ? 1 : 0), up, li.dn >= 0 ? num_(lv[r2][li.dn]) : 0,
      li.arr >= 0 ? minOf_(lv[r2][li.arr], d2) : null, li.dep >= 0 ? minOf_(lv[r2][li.dep], d2) : null,
      li.arrK >= 0 ? minOf_(lv[r2][li.arrK], d2) : null, li.toN >= 0 ? num_(lv[r2][li.toN]) : 0]);
    t.upAll += up;
    if (type === 'SOC') t.socs[name] = 1;
    else if (type === 'Hub') t.upHub += up;
    else { // Seller (D2S) hoặc SPC
      t.upD2S += up;
      t.stops.push({ vs: name, up: up, load: lv[r2][li.load] });
    }
  }

  /* ---- 4. Gom theo điểm – ngày ---- */
  var per = {};  // vs|day -> {tr:[6], tc:[], to:0, socs:{}, multi:[0,0], loads:[]}
  var pairCount = {};
  Object.keys(trips).forEach(function (code) {
    var t = trips[code];
    if (!t.stops.length) return;
    var share = t.upAll > 0 ? t.upD2S / t.upAll : 1;
    var nSoc = Object.keys(t.socs).length;
    var vIx = VEH_TYPES.indexOf(t.veh); if (vIx < 0) vIx = VEH_TYPES.length - 1;
    var names = t.stops.map(function (s) { return s.vs; });
    for (var a = 0; a < names.length; a++) {
      for (var b = a + 1; b < names.length; b++) {
        var kk = [names[a], names[b]].sort().join('||');
        pairCount[kk] = (pairCount[kk] || 0) + 1;
      }
    }
    t.stops.forEach(function (s) {
      var frac = t.upD2S > 0 ? share * s.up / t.upD2S : share / t.stops.length;
      var k = s.vs + '|' + t.d;
      var p = per[k] || (per[k] = { tr: VEH_TYPES.map(function () { return 0; }), tc: [], to: 0, socs: {}, multi: [0, 0], loads: [], types: {}, ad: 0, ih: 0 });
      p.tr[vIx] += frac;
      if (t.adhoc) p.ad += frac;   // chuyến adhoc (ngoài plan)
      if (t.inh) p.ih += frac;     // xe in-house
      if (p.tc.indexOf(code) < 0) p.tc.push(code);
      p.to += s.up;
      Object.keys(t.socs).forEach(function (n) { p.socs[n] = 1; });
      p.multi[1]++; if (nSoc >= 2) p.multi[0]++;
      if (s.load instanceof Date) p.loads.push(s.load.getTime());
      var tt = (t.firstType === 'SOC') ? 'T4' : (t.upHub > 0 ? 'T3' : (t.stops.length === 1 ? 'T1' : 'T2'));
      p.types[tt] = (p.types[tt] || 0) + 1;
    });
  });

  /* ---- 5. Cụm ghép xe (các điểm đi chung >= 3 chuyến) ---- */
  var parent = {};
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(a, b) { parent[a] = parent[a] || a; parent[b] = parent[b] || b; var ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
  Object.keys(pairCount).forEach(function (k) {
    if (pairCount[k] < 3) return;
    var ab = k.split('||'); union(ab[0], ab[1]);
  });
  var clusterName = {}, clusterSeq = {};
  Object.keys(parent).forEach(function (v) {
    var root = find(v), reg = (regionOf[v] || 'X').slice(0, 4);
    if (!clusterName[root]) { clusterSeq[reg] = (clusterSeq[reg] || 0) + 1; clusterName[root] = reg + '-X' + clusterSeq[reg]; }
  });

  /* ---- 6. Ghép thành danh sách điểm ---- */
  var vsList = {};
  Object.keys(vol).forEach(function (k) { vsList[k.split('|')[0]] = 1; });

  var hubOf = {};
  Object.keys(hubVol).forEach(function (k) {
    var p = k.split('|'), vs = p[0], hub = p[1];
    if (!hubOf[vs] || hubVol[k] > hubOf[vs][1]) hubOf[vs] = [hub, hubVol[k]];
  });
  var hubCount = {};
  Object.keys(hubOf).forEach(function (vs) {
    var key = (regionOf[vs] || '') + '|' + hubOf[vs][0];
    hubCount[key] = (hubCount[key] || 0) + 1;
  });

  var typeDays = [0, 0, 0]; dt.forEach(function (t) { typeDays[t]++; });

  var S = Object.keys(vsList).sort().map(function (vs) {
    var v = [], b = [], tr = [], tc = [], to = [], ad = [], ih = [], runT = [0, 0, 0];
    var nsList = [], mdN = 0, mdD = 0, waves = [], typeCount = {}, socCount = {};
    var wvd = [], lt1 = [];   // số lượt bàn giao và giờ lấy hàng đầu tiên của TỪNG ngày
    for (var i = 0; i < ND; i++) {
      var k = vs + '|' + dates[i], q = vol[k] || [0, 0];
      v.push(Math.round(q[0])); b.push(Math.round(q[1]));
      if (q[0] > 0) runT[dt[i]]++;
      var p = per[vs + '|' + dates[i]];
      if (p) {
        tr.push(p.tr.map(function (x) { return Math.round(x * 1000) / 1000; }));
        tc.push(p.tc); to.push(Math.round(p.to));
        ad.push(Math.round(p.ad * 1000) / 1000); ih.push(Math.round(p.ih * 1000) / 1000);
        nsList.push(Object.keys(p.socs).length);
        Object.keys(p.socs).forEach(function (n) { socCount[n] = (socCount[n] || 0) + 1; });
        mdN += p.multi[0]; mdD += p.multi[1];
        var ls = p.loads.sort(function (x, y) { return x - y; }), w = ls.length ? 1 : 0;
        for (var j = 1; j < ls.length; j++) if (ls[j] - ls[j - 1] > 2 * 3600 * 1000) w++;
        if (w) waves.push(w);
        wvd.push(w || null);
        lt1.push(ls.length ? Utilities.formatDate(new Date(ls[0]), Session.getScriptTimeZone(), 'HH:mm') : null);
        Object.keys(p.types).forEach(function (t) { typeCount[t] = (typeCount[t] || 0) + p.types[t]; });
      } else { tr.push(q[0] > 0 ? 0 : null); tc.push(null); to.push(0); ad.push(null); ih.push(null); wvd.push(null); lt1.push(null); }
    }
    var tt = Object.keys(typeCount).sort(function (x, y) { return typeCount[y] - typeCount[x]; })[0] || '';
    var hub = hubOf[vs] ? hubOf[vs][0] : '';
    return {
      n: vs, R: regionOf[vs] || '', k: vs.toUpperCase().indexOf('SPC') >= 0 ? 'SPC' : 'Seller', h: hub,
      v: v, b: b, tr: tr, tc: tc, to: to, ad: ad, ih: ih,
      on: [0, 1, 2].map(function (t) { return (typeDays[t] > 0 && runT[t] >= 0.5 * typeDays[t]) ? 1 : 0; }),
      ns: median_(nsList) || 1, nsMed: median_(nsList), nsMax: nsList.length ? Math.max.apply(null, nsList) : null,
      mdSh: mdD ? Math.round(mdN / mdD * 100) / 100 : 0,
      wv: waves.length ? Math.round(median_(waves)) : 1, wvd: wvd, lt1: lt1,
      soc: Object.keys(socCount).sort(function (a, b) { return socCount[b] - socCount[a]; }).slice(0, 8),
      socN: Object.keys(socCount).sort(function (a, b) { return socCount[b] - socCount[a]; }).slice(0, 8).map(function (n) { return socCount[n]; }),
      tpd: null, tt: tt, cl: clusterName[parent[vs] ? find(vs) : ''] || '',
      hubn: hub ? (hubCount[(regionOf[vs] || '') + '|' + hub] || 1) : 0
    };
  }).filter(function (s) { return s.v.some(function (x) { return x > 0; }); });

  /* ---- 7. Lộ trình từng chuyến có điểm D2S (cho popup "xem từng chuyến") ---- */
  var TN = [], tnIx = {}, T = {};
  function ni_(n) { if (tnIx[n] === undefined) { tnIx[n] = TN.length; TN.push(n); } return tnIx[n]; }
  Object.keys(trips).forEach(function (code) {
    var t = trips[code]; if (!t.stops.length) return;
    var vIx = VEH_TYPES.indexOf(t.veh); if (vIx < 0) vIx = VEH_TYPES.length - 1;
    var st = t.path.sort(function (a, b) { return a[0] - b[0]; }).map(function (p) {
      return [ni_(p[1]), p[2], Math.round(p[3]), Math.round(p[4]), p[5], p[6], p[7], Math.round(p[8] || 0)]; });
    T[code] = [dayIx[t.d], vIx, (t.adhoc ? 1 : 0) | (t.inh ? 2 : 0), t.km, t.plate, st];
  });

  /* ---- 8. Tọa độ các điểm, Hub, SOC (sheet Station) → web tính khoảng cách, đường vòng khi ghép ---- */
  var GEO = {};
  try {
    var ssh = sheetByName_(SpreadsheetApp.getActive(), STATION_SHEET);
    if (ssh) {
      var sv = ssh.getDataRange().getValues(), shd = sv[0].map(function (h) { return String(h).trim(); });
      var cN = shd.indexOf('Tên trạm'), cLa = shd.indexOf('Vĩ độ'), cLo = shd.indexOf('Kinh độ');
      if (cN >= 0 && cLa >= 0 && cLo >= 0) {
        var pos = {}, posL = {};
        for (var r = 1; r < sv.length; r++) {
          var nm = String(sv[r][cN] || '').trim(), la = Number(String(sv[r][cLa]).replace(',', '.')), lo = Number(String(sv[r][cLo]).replace(',', '.'));
          if (!nm || !isFinite(la) || !isFinite(lo) || !la || !lo) continue;
          if (!pos[nm]) pos[nm] = [Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5];
          if (!posL[nm.toLowerCase()]) posL[nm.toLowerCase()] = pos[nm];
        }
        var want = {};
        S.forEach(function (s) { want[s.n.trim()] = 1; if (s.h) want[String(s.h).trim()] = 1; (s.soc || []).forEach(function (n) { want[String(n).trim()] = 1; }); });
        TN.forEach(function (n) { want[String(n).trim()] = 1; });
        Object.keys(want).forEach(function (n) { var g = pos[n] || posL[n.toLowerCase()]; if (g) GEO[n] = g; });
      } else warn.push('Sheet ' + STATION_SHEET + ' thiếu cột Tên trạm / Vĩ độ / Kinh độ: chưa có số km.');
    } else warn.push('Không thấy sheet ' + STATION_SHEET + ': chưa có số km giữa các điểm.');
  } catch (e) { warn.push('Không đọc được tọa độ: ' + e.message); }

  // lh[i] = 1 nếu ngày thứ i có dữ liệu chuyến trong file Linehaul; 0 nghĩa là ngày đó tiền xe chỉ là ước tính
  var lh = dates.map(function (d) { return lhSeen[d] ? 1 : 0; });
  // v = phiên bản backend. Web dùng nó để biết gói dữ liệu đang chạy Code.gs bản nào.
  return { v: BACKEND_VERSION, win: WINDOW_DAYS, warn: warn, dates: dates, dt: dt, lh: lh, TY: VEH_TYPES, S: S, T: T, TN: TN, GEO: GEO };
}
