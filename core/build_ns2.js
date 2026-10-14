/* Trang D2S New Seller (bản gộp: trang chủ 2 thẻ — A đánh giá seller mới, B seller đang chạy + mạng lưới SPX):
   node core/build_ns2.js <data.js> <out.html> [hubsup.json] [pivot.json]
   Kỳ và vùng: NS_FROM / NS_TO (mặc định 2026-08-01 → 2026-08-31), NS_REG (mặc định HCM,South).
   pivot.json: % đơn theo sort code từng điểm D2S (sheet "Volume by Sort Code", đã bỏ 4PL, HCM, SIP): { tên điểm: { n, sh: { mã: % } } }.
   Học số từ Core trên đúng kỳ / vùng, tính sẵn mỗi seller đang chạy như seller mới (cùng engine), nhúng engine + số học được vào trang. */
const fs = require("fs"), path = require("path"), { Core } = require("./engine.js"), { nsRef, nsPlan, NS_KS } = require("./newseller.js"), { sliceD } = require("./sliceD.js"), L2 = require("./ns2_lib.js");
const [data, out, hsf, pvf] = process.argv.slice(2);
const FROM = process.env.NS_FROM || "2026-08-01", TO = process.env.NS_TO || "2026-08-31", REG = (process.env.NS_REG || "HCM,South").split(",");
const src = fs.readFileSync(data, "utf8"), D0 = eval("(" + src.match(/^const D=(.*);$/m)[1] + ")"), REF = eval("(" + src.match(/^const REF=(.*);$/m)[1] + ")");
const D = sliceD(D0, FROM, TO, REG), C = Core(D, REF), ref = nsRef(C, REF);
for (const R of Object.keys(ref.reg)) if (!REG.includes(R)) delete ref.reg[R];
ref.sel = ref.sel.filter(s => REG.includes(s.R)); ref.dates = [D.dates[0], D.dates[D.dates.length - 1], D.dates.length];
/* Hub / Sup cả vùng (core/hubsup.py): Sup điểm D2S thiếu hoặc lỗi thì lấy theo hub */
const HS = hsf ? JSON.parse(fs.readFileSync(hsf, "utf8")) : {};
Object.entries(ref.reg).forEach(([R, G]) => { G.hs = HS[R] || []; const one = {}; G.hs.forEach(([h, s]) => { if (s) (one[h] = one[h] || new Set()).add(s); });
  G.pts.forEach(q => { if ((!q.sup || q.sup.startsWith("(")) && one[q.hub] && one[q.hub].size === 1) q.sup = [...one[q.hub]][0]; }); });
/* pivot theo sort code: khớp tên điểm (bỏ khác biệt khoảng trắng) */
const norm = s => String(s).replace(/\s+/g, " ").replace(/- /g, "-").trim().toLowerCase();
const PV = pvf ? JSON.parse(fs.readFileSync(pvf, "utf8")) : {}, piv = {};
Object.entries(PV).forEach(([k, v]) => { if (v && v.sh && k !== "TỔNG") piv[norm(k)] = v; });
const pivOf = n => piv[norm(n)] || null, pivAll = Object.values(piv);
/* toạ độ SOC (giá xe theo km) và FM Hub (gợi ý hub gần nhất theo toạ độ seller) */
const socLL = Object.fromEntries(L2.NS2_TOS.filter(s => D.GEO[s]).map(s => [s, D.GEO[s].map(v => +(+v).toFixed(5))]));
const hubs = Object.fromEntries(REG.map(R => [R, (HS[R] || []).filter(([h]) => D.GEO[h]).map(([h, s]) => [h, +D.GEO[h][0].toFixed(5), +D.GEO[h][1].toFixed(5), s || ""])]));
/* SELLER ĐANG CHẠY như seller mới: hồ sơ dựng từ dữ liệu thật của kỳ (như profOf của trang cũ), chute suy từ SOC xe thật tới, % sort code theo pivot (South chưa có → trung bình HCM) */
const avgHCM = L2.ns2MixAvg(pivAll), K = C.learnK(), idxOf = {}; C.S.forEach((s, i) => { idxOf[C.nm(i)] = i; });
const profOf = (q, R) => { const G = ref.reg[R], open = ref.P.open, a3 = q.a3 && q.a3.some(v => v > 0) ? q.a3.slice() : [q.ado, q.ado, q.ado], sh = (q.sh || []).reduce((a, v) => a + v, 0) > 0 ? q.sh : G.sh;
  const inSel = ref.sel.some(z => z.n === q.n), qi = G.pts.indexOf(q), tm = (G.tm0 || []).some(t => t.m.includes(qi)), pv = pivOf(q.n);
  return { R, ll: q.ll, hub: q.hub || "", sup: q.sup || "", self: q.n, ado: a3, days: [25, 4, 1], beta: q.b || 0, sh, open,
    win: G.cots.map((k, j) => { const a = Math.max(k.a, open), r = q.rw && q.rw[3] && q.rw[3][j]; return r ? [a, Math.round(Math.min(k.p - ref.P.closeMin, Math.max(a + 30, r[1] - r[4])))] : [a, k.b]; }),
    like: inSel ? q.n : null, capK: inSel ? {} : Object.fromEntries(NS_KS.map((k, j) => [k, q.c && q.c[j] > 0 ? q.c[j] : ""]).filter(e => e[1] !== "")),
    dwFix: q.dw ? q.dw[0] : "", dwRate: q.dw ? +(q.dw[1] * 100).toFixed(2) : "", lab: tm ? "hub" : "fte", ban: "auto", maxK: "8T", bays: 4, lateTol: 12,
    betaT: q.b3 ? q.b3.map(v => v == null || Math.abs(v - (q.b || 0)) < 0.01 ? "" : v) : ["", "", ""], pick: [], groups: [],
    socsReal: Object.entries(q.soc || {}).map(([s, v]) => ({ s, sh: Math.round(v * 1000) / 10, km: q.skm && q.skm[s] != null ? q.skm[s] : (G.km[s] ?? 15), fw: false })),
    mix: pv ? pv.sh : avgHCM, mixSrc: pv ? "pivot" : "avg", boards: [0, 1, 2].map(() => L2.ns2Derived(q.soc)) }; };
const fillOf = p => { let n = 0, c = 0; p.days.forEach(d => { if (!(d.X > 0)) return; d.W.forEach(w => (w.trk || []).forEach(z => { if (z.fill > 0) { n += z.q * d.n; c += z.q / z.fill * d.n; } })); }); return c ? Math.round(n / c * 100) : null; };
const run = {};
for (const R of REG) { const G = ref.reg[R]; if (!G) continue; run[R] = G.pts.map(q => {
  const prof = profOf(q, R), x = L2.ns2X(prof, socLL); let p; try { p = nsPlan(ref, x); } catch (e) { console.error(q.n, e.message); return null; }
  const m = p.month, i = idxOf[q.n], ordReal = i != null ? C.S[i].v.reduce((a, v) => a + (v || 0), 0) : 0, trReal = i != null ? C.realCost(i) : 0;
  /* THỰC TẾ CẢ KỲ: chuyến thật (phần chuyến của điểm × giá theo cỡ xe), độ đầy = đơn ÷ sức chở các chuyến đó (sức chở học được của chính điểm) */
  let tripEq = 0, capEq = 0, nDays = 0; const kind = {};
  if (i != null) C.S[i].tr.forEach((tr, d) => { if (!Array.isArray(tr)) return; if (tr.some(v => v > 0)) nDays++; tr.forEach((v, j) => { if (!(v > 0)) return; const k = C.TY[j] === "KHAC" ? "VAN" : C.TY[j]; tripEq += v; kind[k] = (kind[k] || 0) + v; capEq += v * (K.cap(i, k) || 0); }); });
  const fillReal = capEq > 0 ? Math.round(ordReal / capEq * 100) : null, kMain = Object.keys(kind).sort((a, b) => kind[b] - kind[a])[0] || null;
  const U = v => m.orders ? v / m.orders : 0, estT8 = ordReal * (U(m.fm) - U(m.lab) - U(m.soc)) - trReal, sc = m.orders ? ordReal / m.orders : 0;
  const lite = ex => { try { return nsPlan(ref, Object.assign({}, x, ex, { lite: true })); } catch (e) { return null; } };
  const lev = [], chN = prof.boards[0].length;
  /* đổi cài đặt sort (đổi SOC đích): lời/lỗ mới = FM − (xe mô hình của cài đặt mới + người + rã bao) trên số đơn thật; so với lời/lỗ thực tế (xe thật) */
  const estNew = v => { const u = k => v.month.orders ? v.month[k] / v.month.orders : 0; return ordReal * (u("fm") - u("lab") - u("soc") - u("truck")); };
  if (chN > 1) { const B1 = [0, 1, 2].map(() => L2.ns2Preset("1", R)), v = lite(L2.ns2X(Object.assign({}, prof, { boards: B1 }), socLL)); if (v) lev.push({ k: "1ch", t: "Gộp 1 chute → BD A, xe đúng cỡ", g: estNew(v) - estT8 }); }
  if (x.lab !== "hub") { const v = lite({ lab: "hub" }); if (v && v.month.net - m.net > 1e5) lev.push({ k: "hub", t: "Nhóm FM Hub dùng chung người", g: (v.month.net - m.net) * sc }); }
  const mg = (p.mrg.list || []).filter(o => ["go", "check", "watch"].includes(o.st) && o.save > 0).sort((a, b) => b.save - a.save)[0];
  if (mg) lev.push({ k: "mrg", t: "Ghép xe với " + mg.mem.filter(n => n !== q.n).map(n => n.replace(/^(HCMSeller|HCMSPC|SouthSeller|South Seller|South)-\s*/, "")).join(", "), g: mg.save * sc, st: mg.st, km: mg.km });
  /* tiền xe thực tế cả kỳ so với mô hình (cùng số đơn): chênh = xe to hơn cần / thừa chuyến */
  const trRealU = ordReal ? trReal / ordReal : null, trModU = m.orders ? m.truck / m.orders : null;
  if (trRealU != null && trModU != null && trRealU > trModU * 1.1) lev.push({ k: "truck", t: "Đặt xe đúng cỡ, đúng số chuyến", g: (trRealU - trModU) * ordReal });
  lev.sort((a, b) => b.g - a.g); let best = lev[0] && lev[0].g > 0 ? lev[0] : null;
  if (estT8 < 0 && (!best || estT8 + best.g < 0)) best = { k: "fm", t: "Về FM pickup", g: -estT8 };
  const bau = p.days.find(d => d.X > 0) || p.days[0];
  return { n: q.n, R, ll: q.ll, hub: q.hub, sup: q.sup, a3: prof.ado, ordReal, nDays, trReal, estT8, cpoT8: ordReal ? (trReal + ordReal * (U(m.lab) + U(m.soc))) / ordReal : null, fmU: U(m.fm), labU: U(m.lab), socU: U(m.soc),
    fillReal, tripsDay: nDays ? +(tripEq / nDays).toFixed(1) : null, kMain, est: m.net, orders: m.orders, cost: m.cost, fm: m.fm, truck: m.truck, lab: m.lab, soc: m.soc,
    trRealU, trModU, fill: fillOf(p), trips: p.days.map(d => d.X > 0 ? d.trucks : null), hc: p.days.map(d => d.X > 0 ? d.hc : null), worst: Math.min(...p.days.filter(d => d.X > 0).map(d => d.worst)),
    vd: p.verdict, chN, tos: prof.boards[0].map(c => c.to), soc: q.soc, mixSrc: prof.mixSrc, mix: prof.mix, rsSh: x.rsOv[0], b: q.b, lev, best, prof: Object.assign({}, prof, { socLL: undefined }) }; }).filter(Boolean); }
const XT = { socLL, hubs, piv: Object.fromEntries(Object.values(ref.reg).flatMap(G => G.pts).map(q => [q.n, pivOf(q.n)]).filter(e => e[1])), pivAvg: avgHCM, pivN: pivAll.reduce((a, p) => a + (p.n || 0), 0), pivPts: pivAll.length, run, from: FROM, to: TO };
let page = fs.readFileSync(path.join(__dirname, "ns2_page.html"), "utf8");
const strip = f => fs.readFileSync(path.join(__dirname, f), "utf8").replace(/^if \(typeof module.*$/m, "");
for (const [tag, v] of [["/*NSREF*/", JSON.stringify(ref)], ["/*NSXT*/", JSON.stringify(XT)], ["/*NSJS*/", strip("newseller.js") + "\n" + strip("ns2_lib.js")], ["/*NSUI*/", fs.readFileSync(path.join(__dirname, "ns2_ui.js"), "utf8")]]) { if (page.split(tag).length !== 2) throw tag; page = page.replace(tag, () => v.replace(/<\/script/g, "<\\/script")); }
fs.writeFileSync(out, page); console.log(out, (page.length / 1e3).toFixed(0), "kB ·", ref.dates.join(" → "), "·", Object.entries(run).map(([R, L]) => R + " " + L.length).join(", "));
if (process.env.NS_DUMP) fs.writeFileSync(process.env.NS_DUMP, JSON.stringify({ ref, XT }));
