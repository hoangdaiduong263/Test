/* Cắt data.js theo kỳ và vùng: node core/sliceD.js <data.js> <out.js> [từ ngày] [đến ngày] [vùng,vùng]
   vd: node core/sliceD.js data.js data_t8.js 2026-08-01 2026-08-31 HCM,South
   Giữ các ngày trong kỳ (mảng theo ngày cắt lại, chuyến ngoài kỳ bỏ), chỉ giữ điểm của các vùng chọn và chuyến có lấy hàng ở các điểm đó.
   Các chỉ số tổng hợp từng điểm tính lại trên kỳ mới như buildData_ (gas/Code.gs): on, ns/nsMed/nsMax (số SOC mỗi ngày), wv (số lượt), soc/socN (SOC xe tới). */
const fs = require("fs");
function sliceD(D, from, to, regs) {
const keep = D.dates.map((d, i) => (!from || d >= from) && (!to || d <= to) ? i : -1).filter(i => i >= 0);
if (!keep.length) throw new Error("kỳ không có ngày nào");
const i0 = keep[0], i1 = keep[keep.length - 1] + 1, RS = regs && regs.length ? new Set(regs) : null;
const cut = a => Array.isArray(a) && a.length === D.dates.length ? a.slice(i0, i1) : a;
const med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
/* chuyến trong kỳ (đánh lại chỉ số ngày) */
const T = {}; for (const [id, t] of Object.entries(D.T)) if (t[0] >= i0 && t[0] < i1) { const u = t.slice(); u[0] = t[0] - i0; T[id] = u; }
const S = D.S.filter(s => !RS || RS.has(s.R)).map(s => { const o = {}; for (const k in s) o[k] = cut(s[k]); return o; });
const names = new Set(S.map(s => s.n)), TN = D.TN;
/* chỉ giữ chuyến có lấy hàng ở một điểm được giữ */
if (RS) for (const id of Object.keys(T)) if (!T[id][5].some(p => p[1] === 0 && names.has(String(TN[p[0]]).trim()))) delete T[id];
const dt = cut(D.dt), typeDays = [0, 0, 0]; (dt || []).forEach(t => { if (t != null) typeDays[t]++; });
S.forEach(s => {
  const runT = [0, 0, 0], ns = [], socCount = {};
  s.v.forEach((v, d) => { if (v > 0 && dt) runT[dt[d]]++; const ids = (s.tc && s.tc[d]) || []; if (!ids.length) return;
    const socs = new Set(); ids.forEach(id => { const t = T[id]; if (t) t[5].forEach(p => { if (p[1] === 2) socs.add(String(TN[p[0]]).trim()); }); });
    if (socs.size) { ns.push(socs.size); socs.forEach(n => { socCount[n] = (socCount[n] || 0) + 1; }); } });
  if (dt) s.on = [0, 1, 2].map(t => typeDays[t] > 0 && runT[t] >= 0.5 * typeDays[t] ? 1 : 0);
  s.ns = med(ns) || 1; s.nsMed = med(ns); s.nsMax = ns.length ? Math.max(...ns) : null;
  const wv = (s.wvd || []).filter(w => w); s.wv = wv.length ? Math.round(med(wv)) : 1;
  const top = Object.keys(socCount).sort((a, b) => socCount[b] - socCount[a]).slice(0, 8); s.soc = top; s.socN = top.map(n => socCount[n]);
});
const O = Object.assign({}, D, { dates: D.dates.slice(i0, i1), dt, lh: cut(D.lh), S, T });
if (O.pbt) for (const k of Object.keys(O.pbt)) if (!names.has(k)) delete O.pbt[k];
return O; }
if (typeof module !== "undefined") module.exports = { sliceD };
if (require.main === module) { const [inp, out, from, to, regs] = process.argv.slice(2);
const src = fs.readFileSync(inp, "utf8"), D = eval("(" + src.match(/^const D=(.*);$/m)[1] + ")"), refLine = src.match(/^const REF=(.*);$/m)[0], O = sliceD(D, from, to, regs ? regs.split(",") : null), S = O.S, T = O.T;
fs.writeFileSync(out, "const D=" + JSON.stringify(O) + ";\n" + refLine + "\n");
console.log(out, "·", O.dates.length, "ngày:", O.dates[0], "→", O.dates[O.dates.length - 1], "·", S.length, "điểm ·", Object.keys(T).length, "chuyến"); }
