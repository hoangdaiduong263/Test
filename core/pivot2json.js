/* % đơn theo sort code từng điểm D2S cho build_ns2.js, từ sheet "Volume by Sort Code" lưu thành CSV:
   node core/pivot2json.js <pivot.csv> <pivot.json>
   Cột: Trạm D2S, các sort code…, TỔNG. Bỏ 4PL, HCM, SIP (không đi qua cài đặt chute của seller) và cột TỔNG; % tính trên các mã còn lại.
   Ra { tên điểm: { n: tổng đơn các mã còn lại, sh: { mã: % (1 số lẻ) } } } */
const fs = require("fs"), [inp, out] = process.argv.slice(2), DROP = new Set(["4PL", "HCM", "SIP", "TỔNG"]);
const rows = fs.readFileSync(inp, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim()).map(l => l.split(","));
const H = rows[0].map(s => s.trim()), keep = H.map((h, j) => j > 0 && !DROP.has(h) ? j : -1).filter(j => j >= 0), o = {};
rows.slice(1).forEach(r => { const name = (r[0] || "").trim(); if (!name) return; const n = keep.reduce((a, j) => a + (+r[j] || 0), 0); if (!n) return;
  o[name] = { n, sh: Object.fromEntries(keep.map(j => [H[j], Math.round((+r[j] || 0) / n * 1000) / 10])) }; });
fs.writeFileSync(out, JSON.stringify(o)); console.log(out, Object.keys(o).length, "điểm");
