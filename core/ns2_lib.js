/* NEW SELLER (bản gộp) — phần dùng chung giữa build (Node) và trang:
   14 sort code của sheet "Volume by Sort Code" → nhóm LM trên slide mạng lưới → SOC nhà (bản nháp, chờ Ops xác nhận các mã DRAFT),
   bảng chute theo sort code → đầu vào engine (SOC đích, chute theo SOC, phần đơn phải rã bao thêm so với FLM chuẩn). */
const NS2_CODES = ["HN", "HCB", "HCA", "MTA", "CT", "SE1", "MB", "SE2", "DN", "MBD", "SW", "MBA", "MBC", "MT"];
/* sort code → nhóm LM (NS_NET_G) */
const NS2_LMG = { HCA: "HCA", HCB: "HCB", SE1: "SE1, SE2", SE2: "SE1, SE2", MTA: "13 Cen2", MT: "13 Cen2", CT: "SW2", SW: "SW1", DN: "Cen_DN", HN: "HN, North_A", MBA: "HN, North_A", MB: "North_B", MBC: "North_C", MBD: "North_D" };
/* SOC mở bao của nhóm như FLM chuẩn (13 Cen2: BD A sort thẳng tới hub qua Mini SOC — như chute chung SE1, SE2 ở FLM HCM, nên coi như nhà là BD A) */
const NS2_HOME = { HCA: "HCM Mega SOC", HCB: "BD B Mega SOC", SE1: "BD A Mega SOC", SE2: "BD A Mega SOC", MTA: "BD A Mega SOC", MT: "BD A Mega SOC", CT: "SW SOC", SW: "LA Temp", DN: "DN Mega SOC", HN: "BN A Mega SOC", MBA: "BN A Mega SOC", MB: "BN B Mega SOC", MBC: "HY SOC", MBD: "HN1 SOC" };
const NS2_DRAFT = ["CT", "MTA", "MT", "MB", "MBA", "MBC", "SW"];
/* SOC xe D2S tới được (có toạ độ, có giá) */
const NS2_TOS = ["BD A Mega SOC", "HCM Mega SOC", "BD B Mega SOC", "SW SOC"];
const NS2_SHORT = { "BD A Mega SOC": "BD A", "HCM Mega SOC": "HCM Mega", "BD B Mega SOC": "BD B", "SW SOC": "SW SOC", "LA Temp": "LA Temp", "DN Mega SOC": "DN Mega", "BN A Mega SOC": "BN A", "BN B Mega SOC": "BN B", "HY SOC": "HY", "HN1 SOC": "HN1" };
const ns2Hav = (a, b) => { const r = v => v * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h))); };
/* bảng chute mẫu: 1 = một chute về BD A; 3 = BD A · HCM Mega · BD B; flm = như FLM chuẩn của vùng (mỗi nhóm một chute, đi qua SOC transit) */
function ns2Preset(k, R) {
  const A = "BD A Mega SOC", H = "HCM Mega SOC", B = "BD B Mega SOC", SW = "SW SOC", all = NS2_CODES.slice();
  if (k === "1") return [{ to: A, g: all }];
  if (k === "3") return [{ to: A, g: all.filter(c => c !== "HCA" && c !== "HCB") }, { to: H, g: ["HCA"] }, { to: B, g: ["HCB"] }];
  if (k === "2") return [{ to: A, g: all.filter(c => c !== "HCA") }, { to: H, g: ["HCA"] }];
  /* FLM: HCM (slide 7) bắc đi qua BD B; South (FLM SE) bắc đi qua BD A */
  const nb = R === "HCM" ? B : A;
  return [{ to: H, g: ["HCA"] }, { to: B, g: ["HCB"] }, { to: A, g: ["SE1", "SE2", "MTA", "MT"] }, { to: R === "HCM" ? SW : A, g: ["CT"], via: R === "HCM" ? "" : "SW SOC" }, { to: R === "HCM" ? SW : A, g: ["SW"], via: "LA Temp" },
    { to: A, g: ["DN"], via: "DN Mega SOC" }, { to: nb, g: ["HN", "MBA"], via: "BN A Mega SOC" }, { to: nb, g: ["MB"], via: "BN B Mega SOC" }, { to: nb, g: ["MBC"], via: "HY SOC" }, { to: nb, g: ["MBD"], via: "HN1 SOC" }];
}
/* chute mặc định của một seller đang chạy: mỗi SOC xe thật tới (≥ 5% đơn) một chute; nhóm về chute có SOC nhà, còn lại vào chute SOC chính */
function ns2Derived(soc) {
  const L = Object.entries(soc || {}).filter(e => e[1] >= 0.05 && NS2_TOS.includes(e[0])).sort((a, b) => b[1] - a[1]).map(e => e[0]);
  if (!L.length) L.push("BD A Mega SOC");
  const B = L.map(to => ({ to, g: [] })); NS2_CODES.forEach(c => { const j = L.indexOf(NS2_HOME[c]); B[j >= 0 ? j : 0].g.push(c); }); return B;
}
/* phần đơn phải rã bao thêm so với FLM: chute bị mở ở SOC đích (trừ chute chỉ chứa nhóm của đúng một SOC nhà khác SOC đích — chuyển thẳng),
   nhóm nào SOC nhà khác SOC đích thì SOC đích phải sort lại thêm một lần */
function ns2Extra(B, mix) {
  const tot = NS2_CODES.reduce((a, c) => a + Math.max(0, +mix[c] || 0), 0) || 1, X = new Set();
  (B || []).forEach(c => { if (!c.g.length) return; const homes = new Set(c.g.map(g => NS2_HOME[g])); if (homes.size === 1 && !homes.has(c.to)) return; c.g.forEach(g => { if (NS2_HOME[g] !== c.to) X.add(g); }); });
  return { set: X, sh: [...X].reduce((a, g) => a + Math.max(0, +mix[g] || 0), 0) / tot };
}
/* bình quân có trọng số theo số đơn của các hồ sơ pivot */
function ns2MixAvg(L) { const o = {}; let n = 0; L.forEach(p => { if (!p || !p.sh) return; n += p.n || 1; NS2_CODES.forEach(c => { o[c] = (o[c] || 0) + (p.n || 1) * (+p.sh[c] || 0); }); });
  return Object.fromEntries(NS2_CODES.map(c => [c, n ? Math.round(o[c] / n * 10) / 10 : 0])); }
/* HỒ SƠ (form) → đầu vào nsPlan. prof: { R, ll, hub, sup, ado, days, beta (0–1), betaT, open, win, sh (0–1), mix, boards[3], socLL, socsReal?, … các ô nâng cao giữ nguyên tên của engine } */
function ns2X(prof, socLL) {
  const B = prof.boards, mix = prof.mix, eff = (g, to) => NS2_TOS.includes(NS2_HOME[g]) ? NS2_HOME[g] : to;
  let socs;
  if (prof.socsReal) socs = prof.socsReal.map(o => Object.assign({}, o));
  else { const sh = {}; NS2_TOS.forEach(s => { sh[s] = 0; }); B[0].forEach(c => c.g.forEach(g => { sh[eff(g, c.to)] += Math.max(0, +mix[g] || 0); }));
    const ll = prof.ll; socs = NS2_TOS.map(s => ({ s, sh: Math.round(sh[s] * 10) / 10, km: ll && socLL && socLL[s] ? +(ns2Hav(ll, socLL[s]) * 1.3).toFixed(1) : 15, fw: false })).filter(o => o.sh > 0); }
  const names = new Set(socs.map(o => o.s));
  const chutes = B.map(L => L.filter(c => c.g.length).map(c => { let s = [...new Set(c.g.map(g => eff(g, c.to)))].filter(n => names.has(n)); if (!s.length) s = [c.to]; return { to: c.to, socs: s }; }));
  /* SOC đích của chute chưa có trong danh sách SOC (vd seller đang chạy chưa từng đi SOC đó) → thêm với 0% đơn để có giá xe */
  B.forEach(L => L.forEach(c => { if (c.g.length && !names.has(c.to)) { names.add(c.to); socs.push({ s: c.to, sh: 0.1, km: prof.ll && socLL && socLL[c.to] ? +(ns2Hav(prof.ll, socLL[c.to]) * 1.3).toFixed(1) : 15, fw: false }); } }));
  const o = Object.assign({}, prof, { socs, chutes, ch: null, chCnt: B.map(L => L.filter(c => c.g.length).length || 1), rsOv: B.map(L => ns2Extra(L, mix).sh), rsCost: prof.rsCost || 260 });
  delete o.boards; delete o.mix; delete o.socsReal; delete o.socLL; return o;
}
if (typeof module !== "undefined") module.exports = { NS2_CODES, NS2_LMG, NS2_HOME, NS2_DRAFT, NS2_TOS, NS2_SHORT, ns2Preset, ns2Derived, ns2Extra, ns2MixAvg, ns2X, ns2Hav };
