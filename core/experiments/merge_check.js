/* BƯỚC 1 · KIỂM CHỨNG TUYẾN GHÉP BẰNG THÍ NGHIỆM TỰ NHIÊN
   Cặp điểm (i, j) có ngày đi chung xe và có ngày đi riêng.
   - Chiều GHÉP: học chỉ trên ngày đi riêng (mỗi điểm là một tuyến), dự báo tiền xe tuyến ghép [i, j] (như tuyến mới của plan) cho ngày đi chung → so với thật.
     Kèm: model "đi riêng" cho ngày đi chung → tiết kiệm model hứa (riêng − ghép dự báo) vs tiết kiệm thực hiện (riêng − ghép thật).
   - Chiều TÁCH: học trên ngày đi chung ([i, j] là một tuyến), dự báo tiền xe [i], [j] riêng cho ngày đi riêng → so với thật.
   BAU=1: chỉ dùng ngày thường (bỏ ngày sale CP / Mini CP) cho cả hai trạng thái, để so cùng loại ngày.
   node core/experiments/merge_check.js <data.js> [csv ra] */
const fs = require("fs"), { Core } = require("../engine.js");
const src = fs.readFileSync(process.argv[2], "utf8"), D = eval("(" + src.match(/^const D=(.*);$/m)[1] + ")"), REF = eval("(" + src.match(/^const REF=(.*);$/m)[1] + ")");
const C = Core(D, REF); if (process.env.PO) Object.assign(C.P, JSON.parse(process.env.PO)); const BAU = process.env.BAU === "1", ok = d => (!D.lh || D.lh[d]) && (!BAU || !D.dt[d]), tr = x => (x / 1e6).toFixed(1);
const pairs = [];
for (const R of ["HN", "HCM", "North", "South"]) { const N = C.nodes(R);
  for (let a = 0; a < N.length; a++) for (let b = a + 1; b < N.length; b++) { const i = N[a], j = N[b], tog = [], apt = [];
    for (const d of C.DAYS) { if (!ok(d)) continue; const ti = new Set((C.S[i].tc && C.S[i].tc[d]) || []), tj = (C.S[j].tc && C.S[j].tc[d]) || []; if (!ti.size || !tj.length) continue;
      const sh = tj.filter(c => ti.has(c)).length; if (sh === 0) apt.push(d); else if (sh >= 0.5 * Math.min(ti.size, tj.length)) tog.push(d); }
    if (tog.length >= 2 && apt.length >= 3) pairs.push({ R, i, j, tog, apt }); } }
const real = (g, days) => days.reduce((a, d) => a + g.reduce((b, k) => b + C.realCost(k, d), 0), 0);
const pred = (g, days) => days.reduce((a, d) => { const x = C.routeDay(g, d); return a + (x ? x.c : 0); }, 0);
const part = (R, i, j, together) => { C.setFit(null); C.setBase(R, null); const L = C.baseRoutes(R).map(g => g.filter(k => k !== i && k !== j)).filter(g => g.length); return together ? L.concat([[i, j]]) : L.concat([[i], [j]]); };
const rows = [];
for (const p of pairs) { const { R, i, j } = p;
  /* chiều ghép */
  let L = part(R, i, j, false); C.setFit(p.apt); C.setBase(R, L);
  const mergeReal = real([i, j], p.tog), mergePred = pred([i, j], p.tog), soloPred = pred([i], p.tog) + pred([j], p.tog);
  /* chiều tách */
  L = part(R, i, j, true); C.setFit(p.tog); C.setBase(R, L);
  const splitReal = real([i], p.apt) + real([j], p.apt), splitPred = pred([i], p.apt) + pred([j], p.apt);
  rows.push({ R, a: C.nm(i), b: C.nm(j), nTog: p.tog.length, nApt: p.apt.length, mergeReal, mergePred, soloPred, splitReal, splitPred }); }
C.setFit(null); C.setBase("HN", null);
const S = f => rows.reduce((a, r) => a + f(r), 0), pc = x => (x >= 0 ? "+" : "") + x.toFixed(1) + "%";
console.log(`${rows.length} cặp (${[...new Set(rows.map(r => r.R))].map(R => R + " " + rows.filter(r => r.R === R).length).join(", ")})`);
const mR = S(r => r.mergeReal), mP = S(r => r.mergePred), sP = S(r => r.soloPred);
console.log(`GHÉP · ngày đi chung: thật ${tr(mR)} · model dự báo tuyến ghép ${tr(mP)} (lệch ${pc((mP - mR) / mR * 100)}, sai số theo cặp ${(S(r => Math.abs(r.mergePred - r.mergeReal)) / mR * 100).toFixed(1)}%)`);
console.log(`      model đi riêng ${tr(sP)} → tiết kiệm model hứa ${tr(sP - mP)} (${(100 * (sP - mP) / sP).toFixed(1)}%) · tiết kiệm thực hiện ${tr(sP - mR)} (${(100 * (sP - mR) / sP).toFixed(1)}%) · tỷ lệ thực hiện/hứa ${((sP - mR) / (sP - mP) * 100).toFixed(0)}%`);
const tR = S(r => r.splitReal), tP = S(r => r.splitPred);
console.log(`TÁCH · ngày đi riêng: thật ${tr(tR)} · model dự báo ${tr(tP)} (lệch ${pc((tP - tR) / tR * 100)}, sai số theo cặp ${(S(r => Math.abs(r.splitPred - r.splitReal)) / tR * 100).toFixed(1)}%)`);
rows.sort((x, y) => Math.abs(y.mergePred - y.mergeReal) - Math.abs(x.mergePred - x.mergeReal));
rows.forEach(r => console.log(`  ${r.R.padEnd(5)} ${(r.a + " + " + r.b).slice(0, 62).padEnd(62)} chung ${String(r.nTog).padStart(2)}n: thật ${tr(r.mergeReal).padStart(6)} model ${tr(r.mergePred).padStart(6)} riêng-model ${tr(r.soloPred).padStart(6)} | riêng ${String(r.nApt).padStart(2)}n: thật ${tr(r.splitReal).padStart(6)} model ${tr(r.splitPred).padStart(6)}`));
if (process.argv[3]) fs.writeFileSync(process.argv[3], "vung,a,b,ngay_chung,ngay_rieng,ghep_that,ghep_model,rieng_model_ngay_chung,rieng_that,rieng_model\n" + rows.map(r => [r.R, JSON.stringify(r.a), JSON.stringify(r.b), r.nTog, r.nApt, r.mergeReal, r.mergePred, r.soloPred, r.splitReal, r.splitPred].map(x => typeof x === "number" ? Math.round(x) : x).join(",")).join("\n"));
