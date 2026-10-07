/* Trang New Seller: node core/build_ns.js <data.js> <out.html>
   Học số từ Core Planner (sức chở, giá, COT, thời gian xe đứng) rồi nhúng bản rút gọn vào trang — trang không cần dữ liệu gốc */
const fs = require("fs"), path = require("path"), { Core } = require("./engine.js"), { nsRef } = require("./newseller.js");
const [data, out] = process.argv.slice(2), src = fs.readFileSync(data, "utf8");
const D = eval("(" + src.match(/^const D=(.*);$/m)[1] + ")"), REF = eval("(" + src.match(/^const REF=(.*);$/m)[1] + ")");
const ref = nsRef(Core(D, REF), REF);
let page = fs.readFileSync(path.join(__dirname, "ns_page.html"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "newseller.js"), "utf8").replace(/^if \(typeof module.*$/m, "");
for (const [tag, v] of [["/*NSREF*/", JSON.stringify(ref)], ["/*NSJS*/", js]]) { if (page.split(tag).length !== 2) throw tag; page = page.replace(tag, () => v.replace(/<\/script/g, "<\\/script")); }
fs.writeFileSync(out, page); console.log(out, (page.length / 1e3).toFixed(0), "kB");
