/* Kiểm định theo thời gian: học trên các ngày trước <ngày cắt>, dự báo các ngày từ <ngày cắt> chỉ từ số đơn.
   node core/forward.js <data.js> <ngày cắt, ví dụ 2026-09-01> [ngày dự báo cuối] [ngày học đầu tiên] */
const fs = require("fs"), { Core } = require("./engine.js"), { Calib } = require("./calib.js");
const src = fs.readFileSync(process.argv[2], "utf8"), cut = process.argv[3], end = process.argv[4] || "9999", from = process.argv[5] || "";
const D = eval("(" + src.match(/^const D=(.*);$/m)[1] + ")"), REF = eval("(" + src.match(/^const REF=(.*);$/m)[1] + ")");
const C = Core(D, REF), K = Calib(C, REF), f = x => x == null ? "-" : Math.round(x);
const lh = d => !D.lh || D.lh[d], fit = d => lh(d) && D.dates[d] < cut && D.dates[d] >= from, test = d => lh(d) && D.dates[d] >= cut && D.dates[d] <= end;
console.log(`loại ngày: ${D.dates.map((x, d) => test(d) && D.dt[d] ? x.slice(5) + (D.dt[d] === 2 ? " CP" : " Mini") : "").filter(Boolean).join(", ") || "-"}`);
console.log(`học ${D.dates.filter((_, d) => fit(d)).length} ngày · dự báo ${D.dates.filter((_, d) => test(d)).length} ngày`);
for (const R of ["HN", "HCM", "North", "South"]) { const r = K.run(R, [[fit, test]]), p = r.ph;
  console.log(`${R}: tiền tổng ${r.gap >= 0 ? "+" : ""}${r.gap.toFixed(1)}% · theo tuyến ${r.wRoute.toFixed(1)}% (nhiễu ${r.wNoise.toFixed(1)}%) · chuyến tuyến×ngày ${f(r.wTrip)}% (mốc thống kê ${f(r.wStat)}%) · giờ rời ${f(p.depSys)}% · tới SOC ${f(p.socSys)}%`); }
