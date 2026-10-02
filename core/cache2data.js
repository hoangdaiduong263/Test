/* Chuyển sheet _D2S_CACHE (tải về dạng CSV từ file Linehaul Data) thành data.js cho lõi.
   node core/cache2data.js <_D2S_CACHE.csv> <data.js cũ (lấy bảng REF)> <data.js mới>
   CSV: mỗi dòng là một ô chứa một đoạn JSON (tối đa 45.000 ký tự), nối lại theo thứ tự. */
const fs = require("fs");
const [csv, oldData, out] = process.argv.slice(2);
const cell = l => { l = l.replace(/\r$/, ""); return l.startsWith('"') ? l.slice(1, l.endsWith('"') ? -1 : undefined).replace(/""/g, '"') : l; };
const json = fs.readFileSync(csv, "utf8").split("\n").filter(l => l.length).map(cell).join("");
const D = JSON.parse(json);
const ref = fs.readFileSync(oldData, "utf8").match(/^const REF=(.*);$/m)[1];
fs.writeFileSync(out, "const D=" + JSON.stringify(D) + ";\nconst REF=" + ref + ";\n");
console.log(out, "·", D.dates.length, "ngày:", D.dates[0], "→", D.dates[D.dates.length - 1], "·", D.S.length, "điểm ·", Object.keys(D.T || {}).length, "chuyến");
