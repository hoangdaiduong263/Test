/* Trang New Seller: node core/build_ns.js <data.js> <out.html> [hubsup.json]
   Học số từ Core Planner (sức chở, giá, COT, thời gian xe đứng) rồi nhúng bản rút gọn vào trang — trang không cần dữ liệu gốc.
   hubsup.json (core/hubsup.py, tab Mng treemap): FM Hub → Sup của cả vùng cho ô Hub / Sup; Sup điểm D2S thiếu hoặc lỗi thì lấy theo hub */
const fs = require("fs"), path = require("path"), { Core } = require("./engine.js"), { nsRef } = require("./newseller.js");
const [data, out, hsf] = process.argv.slice(2), src = fs.readFileSync(data, "utf8");
const D = eval("(" + src.match(/^const D=(.*);$/m)[1] + ")"), REF = eval("(" + src.match(/^const REF=(.*);$/m)[1] + ")");
const ref = nsRef(Core(D, REF), REF);
if (hsf) { const HS = JSON.parse(fs.readFileSync(hsf, "utf8"));
  Object.entries(ref.reg).forEach(([R, G]) => { G.hs = HS[R] || []; const one = {}; G.hs.forEach(([h, s]) => { if (s) (one[h] = one[h] || new Set()).add(s); });
    G.pts.forEach(q => { if ((!q.sup || q.sup.startsWith("(")) && one[q.hub] && one[q.hub].size === 1) q.sup = [...one[q.hub]][0]; }); }); }
let page = fs.readFileSync(path.join(__dirname, "ns_page.html"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "newseller.js"), "utf8").replace(/^if \(typeof module.*$/m, "");
for (const [tag, v] of [["/*NSREF*/", JSON.stringify(ref)], ["/*NSJS*/", js]]) { if (page.split(tag).length !== 2) throw tag; page = page.replace(tag, () => v.replace(/<\/script/g, "<\\/script")); }
fs.writeFileSync(out, page); console.log(out, (page.length / 1e3).toFixed(0), "kB");
