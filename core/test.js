/* chạy thử lõi trên Node: node core/test.js <đường dẫn data.js> [vùng] */
const fs = require("fs"), { Core } = require("./engine.js");
const src = fs.readFileSync(process.argv[2], "utf8"); const D = eval("(" + src.match(/^const D=(.*);$/m)[1] + ")"), REF = eval("(" + src.match(/^const REF=(.*);$/m)[1] + ")");
const C = Core(D, REF), tr = x => (x / 1e6).toFixed(1), nmS = i => C.nm(i).replace(/^(HN|HCM|DNCH|North|South)?(SPC|Seller)?\s*[-_]\s*/i, "").slice(0, 22);
for (const R of (process.argv[3] ? [process.argv[3]] : C.REGIONS)) { const t0 = Date.now(), r = C.run(R);
  console.log(`\n=== ${R} · ${r.nodes.length} điểm · ${Date.now() - t0}ms · ${r.iters.length} vòng`);
  console.log(`Tiền xe/kỳ: thật ${tr(r.truck.real)} · mô hình tuyến hiện nay ${tr(r.truck.base)} · kế hoạch ${tr(r.truck.plan)}  | tiền người: hiện nay ${tr(r.lab.base)} · kế hoạch ${tr(r.lab.plan)}`);
  r.iters.forEach((it, k) => { if (it.banned.length) console.log(`  vòng ${k + 1}: loại ${it.banned.map(b => b.g.map(nmS).join("+") + ` (trễ ${Math.round(b.late)}')`).join(" | ")}`); });
  r.packs.forEach((p, k) => console.log(`  Gói ${k + 1} +${tr(p.gain)}: ${p.cut.map(g => g.map(nmS).join("+")).join(" ; ")}  →  ${p.nw.map(g => { const h = r.hc(g); return g.map(nmS).join("+") + ` [${h.ok ? "✓" : "✗"} trễ ${Math.round(h.late)}' ${Array.isArray(h.label) ? h.label.join("/") : h.label}]`; }).join(" ; ")}`)); }
