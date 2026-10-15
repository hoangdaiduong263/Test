/* % đơn theo sort code từng điểm D2S cho build_ns2.js, từ sheet "Volume by Sort Code" lưu thành CSV:
   node core/pivot2json.js <pivot.csv> <pivot.json>
   Cột: Trạm D2S, các sort code…, TỔNG. Bỏ 4PL, HCM, SIP (không đi qua cài đặt chute của seller) và cột TỔNG; % tính trên các mã còn lại.
   Ra { tên điểm: { n: tổng đơn các mã còn lại, sh: { mã: % (1 số lẻ) } } }
   Ô có ngoặc kép ("Kho A, B", "15,810") giữ nguyên dấu phẩy bên trong; số đơn là số nguyên nên bỏ mọi dấu phân cách nghìn (, hoặc .) */
const fs = require("fs"), [inp, out] = process.argv.slice(2), DROP = new Set(["4PL", "HCM", "SIP", "TỔNG"]);
const split = l => { const o = [""]; let q = false; for (let i = 0; i < l.length; i++) { const c = l[i];
  if (q) { if (c !== '"') o[o.length - 1] += c; else if (l[i + 1] === '"') { o[o.length - 1] += c; i++; } else q = false; }
  else if (c === '"') q = true; else if (c === ",") o.push(""); else o[o.length - 1] += c; } return o; };
const num = s => +String(s || "").replace(/[^\d-]/g, "") || 0;
const rows = fs.readFileSync(inp, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim()).map(split);
const H = rows[0].map(s => s.trim()), keep = H.map((h, j) => j > 0 && !DROP.has(h) ? j : -1).filter(j => j >= 0), o = {};
rows.slice(1).forEach(r => { const name = (r[0] || "").trim(); if (!name) return; const n = keep.reduce((a, j) => a + num(r[j]), 0); if (!n) return;
  o[name] = { n, sh: Object.fromEntries(keep.map(j => [H[j], Math.round(num(r[j]) / n * 1000) / 10])) }; });
fs.writeFileSync(out, JSON.stringify(o)); console.log(out, Object.keys(o).length, "điểm");
