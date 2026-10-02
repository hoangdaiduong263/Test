/* DÂY CHUYỀN 0 · KIỂM ĐỊNH AS-IS ĐỘC LẬP
   Model học thông số as-is (lượt, tỷ lệ chạy, tách SOC, lấp đầy, loại xe, thời gian chất/chạy) từ MỘT NỬA số ngày (ngày lẻ),
   rồi dự báo NỬA CÒN LẠI (ngày chẵn) chỉ từ đơn của ngày đó; đổi vai và gộp lại. Không ngày nào được chấm bằng thông số học từ chính nó.
   - tiền xe & số chuyến: mỗi tuyến hiện nay × mỗi ngày, mô hình vs chuyến thật × giá
   - vật lý: phát lại từng chuyến thật (giờ tới điểm đầu thật) → giờ rời từng điểm, giờ tới SOC vs thật
   - mốc so sánh "thống kê": đoán số chuyến của tuyến bằng đường thẳng theo đơn, học trên cùng nửa ngày — mức sai số tối thiểu khó vượt
   Đạt khi: |lệch tiền tổng| ≤ calCost %, sai số tiền theo tuyến (cả kỳ) ≤ calRoute %, và ≥ calShare % lần dừng thuộc nhóm điểm × COT lệch ≤ calTime phút.
   Kèm thống kê NGUỒN của từng loại dữ liệu (data / giả định). */
function Calib(C, REF) {
  const T = { calCost: 5, calRoute: 10, calRep: 1, calTime: 15, calShare: 80 };
  const med = a => { const b = a.slice().sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const realTrips = (i, d) => { const tr = C.S[i].tr && C.S[i].tr[d]; return Array.isArray(tr) ? tr.reduce((a, x) => a + x, 0) : 0; };
  /* chỉ chấm những ngày có dữ liệu chuyến (ngày lễ / ngày file linehaul chưa có thì bỏ) */
  const ok = d => !C.LH || !!C.LH[d];
  const FOLDS = [[d => ok(d) && d % 2 === 1, d => ok(d) && d % 2 === 0], [d => ok(d) && d % 2 === 0, d => ok(d) && d % 2 === 1]];
  /* dự báo theo thời gian: học các ngày trước tháng cuối, dự báo tháng cuối (cần ≥ 20 ngày học và ≥ 7 ngày dự báo) */
  function fwdFold() { const L = C.DAYS.filter(ok); if (!L.length) return null; const cut = C.DATES[L[L.length - 1]].slice(0, 7) + "-01";
    const f = d => ok(d) && C.DATES[d] < cut, t = d => ok(d) && C.DATES[d] >= cut;
    return L.filter(f).length >= 20 && L.filter(t).length >= 7 ? { cut, folds: [[f, t]], nf: L.filter(f).length, nt: L.filter(t).length } : null; }

  /* TIỀN XE & SỐ CHUYẾN của tuyến g trên các ngày test (thông số đã học từ ngày fit) + mốc thống kê */
  function routeDays(g, fit, test, out) {
    const pts = C.DAYS.filter(d => g.some(i => (C.S[i].v[d] || 0) > 0)).map(d => ({ d, v: g.reduce((a, i) => a + (C.S[i].v[d] || 0), 0), t: g.reduce((a, i) => a + realTrips(i, d), 0) }));
    const F = pts.filter(x => fit(x.d)); let a = 0, b = 0;
    if (F.length) { const mv = F.reduce((s, x) => s + x.v, 0) / F.length, mt = F.reduce((s, x) => s + x.t, 0) / F.length; let sxy = 0, sxx = 0;
      F.forEach(x => { sxy += (x.v - mv) * (x.t - mt); sxx += (x.v - mv) ** 2; }); b = sxx > 0 ? Math.max(0, sxy / sxx) : 0; a = mt - b * mv; }
    pts.filter(x => test(x.d)).forEach(x => { const m = C.routeDay(g, x.d);
      out.push({ g, d: x.d, rc: g.reduce((s, i) => s + C.realCost(i, x.d), 0), mc: m ? m.c : 0, rt: x.t, mt: m ? m.t : 0, st: F.length ? Math.max(0, a + b * x.v) : x.t }); }); }

  /* VẬT LÝ MÔ PHỎNG: phát lại từng chuyến thật — xe tới điểm đầu đúng giờ thật, model tính thời gian chất (cố định + phút/đơn)
     và thời gian chạy giữa các điểm / về SOC; so giờ rời từng điểm và giờ tới SOC với thật. Không đụng chính sách điều xe. */
  function physics(R, test, stops, socs) { const ix = {}; C.S.forEach((s, i) => { ix[C.nm(i)] = i; });
    for (const code in C.TRP) { const t = C.TRP[code], P5 = t[5], pk = P5.filter(p => p[1] === 0 && p[4] != null);
      if (!pk.length || !test(t[0])) continue; const pts = pk.map(p => ix[String(C.TRN[p[0]]).trim()]); if (pts.some(i => i == null) || C.S[pts[0]].R !== R) continue;
      let tm = pk[0][4], prev = null;
      pk.forEach((p, k) => { const i = pts[k], arr = prev == null ? p[4] : tm + C.legMin(prev, i), dw = C.dwellAt(i, p[2] || 0, Math.max(arr, p[4])), dep = Math.max(arr, p[4]) + dw;
        if (p[5] != null) stops.push({ i, g: i + "|" + cot(i, p[5]), e: dep - p[5], real: p[5] - p[4], first: k === 0, wait: p[5] - p[4] - C.dwell(i, p[2] || 0) }); tm = dep; prev = i; });
      const sc = P5.find(p => p[1] === 2 && p[4] != null), last = pk[pk.length - 1], il = pts[pts.length - 1];
      if (sc && last[5] != null) socs.push({ g: il + "|" + cot(il, last[5]), e: (last[5] + C.toSocAt(il, last[5])) - sc[4], real: sc[4] - last[5] }); }
  }
  function physSum(stops, socs) {
    const pctIn = L => L.length ? L.filter(x => Math.abs(x.e) <= T.calTime).length / L.length * 100 : null;
    /* lệch hệ thống: gom theo điểm × COT, lấy trung vị lệch của nhóm; % lần dừng thuộc nhóm có |trung vị lệch| ≤ calTime */
    const sys = L => { const G = {}; L.forEach(x => { (G[x.g] = G[x.g] || []).push(x); }); const m = {}; for (const k in G) m[k] = med(G[k].map(x => x.e));
      return L.length ? L.filter(x => Math.abs(m[x.g]) <= T.calTime).length / L.length * 100 : null; };
    /* trần của mọi mô hình tất định: đoán mỗi lần dừng bằng trung vị thật của nhóm điểm × COT → % lệch ≤ calTime. Phần còn lại là dao động thật */
    const ceil = L => { const G = {}; L.forEach(x => { (G[x.g] = G[x.g] || []).push(x.real); }); const m = {}; for (const k in G) m[k] = med(G[k]);
      return L.length ? L.filter(x => Math.abs(x.real - m[x.g]) <= T.calTime).length / L.length * 100 : null; };
    const after = stops.filter(x => !x.first);
    return { n: stops.length, dep: pctIn(stops), depSys: sys(stops), depCeil: ceil(stops), depMed: med(stops.map(x => x.e)), next: pctIn(after), nNext: after.length,
      soc: pctIn(socs), socSys: sys(socs), socCeil: ceil(socs), socMed: med(socs.map(x => x.e)), nSoc: socs.length,
      waitMed: med(stops.map(x => x.wait)), waitBig: stops.length ? stops.filter(x => x.wait > 30).length / stops.length * 100 : null }; }
  const cot = (i, dep) => { const L = C.cotsOf(i); for (let k = 0; k < L.length; k++) if (L[k].p >= dep - 45) return k; return L.length - 1; };

  /* nguồn dữ liệu của các điểm: data hay giả định */
  function sources(N) { const c = (f) => N.filter(f).length, nm = i => C.nm(i), R = C.S[N[0]] && C.S[N[0]].R;
    return [
      ["Đơn theo ngày", N.length, 0, "file volume"],
      ["Chuyến xe, giờ tới/rời, đơn lên", c(i => C.S[i].tc && C.S[i].tc.some(x => x && x.length)), c(i => !(C.S[i].tc && C.S[i].tc.some(x => x && x.length))), "file linehaul"],
      ["Toạ độ", c(i => C.geo(nm(i))), c(i => !C.geo(nm(i))), "sheet Station"],
      ["Giờ mở cửa", c(i => REF.OPENT[nm(i)] != null), c(i => REF.OPENT[nm(i)] == null), "sheet seller · thiếu: min(08:00, xe tới sớm nhất − 60')"],
      ["Giờ đóng / bàn giao cuối", C.COTW[R] ? 0 : c(i => REF.HANDOVER[nm(i)] != null || REF.CLOSE[nm(i)] != null), C.COTW[R] ? 0 : c(i => REF.HANDOVER[nm(i)] == null && REF.CLOSE[nm(i)] == null), C.COTW[R] ? "theo khung COT Outbound của vùng" : "sheet seller / deck · thiếu: giờ xe tới muộn nhất (p90)"],
      ["Thời gian chất hàng", c(i => C.waves(i) && C.waves(i).dw), c(i => !(C.waves(i) && C.waves(i).dw)), "hồi quy trên lần dừng thật, theo khung giờ xe tới · thiếu: trung vị toàn mạng"],
      ["Lượt xe, tỷ lệ ngày chạy, phần đơn mỗi lượt, số xe tách theo SOC", c(i => C.waves(i)), c(i => !C.waves(i)), "chuyến thật · thiếu: 1 lượt, 1 xe"],
      ["Loại xe & cách chọn xe (cố định / rẻ nhất / vừa hàng, ± xe thường trực)", c(i => C.waves(i)), c(i => !C.waves(i)), "chuyến thật, chọn cách khớp nhất trên ngày học"],
      ["Mức lấp đầy xe", c(i => C.waves(i)), c(i => !C.waves(i)), "chỉnh để số chuyến khớp thật trên ngày học · tuyến ghép mới: không vượt tải p95 xe thật"],
      ["Thời gian chạy về SOC", c(i => C.travelData().soc[i] != null), c(i => C.travelData().soc[i] == null), "trung vị chuyến thật theo khung giờ · thiếu: km ÷ tốc độ vùng"],
      ["COT Pickup Ontime", 0, N.length, "chưa có — chờ FLM"],
      ["Năng suất người", 0, N.length, "giả định theo đặc điểm seller (model cũ)"],
    ]; }

  /* folds: mặc định 2 nửa ngày lẻ/chẵn; truyền [[fit, test]] để kiểm định theo thời gian (ví dụ học tháng 8, dự báo tháng 9) */
  function run(R, folds) { const out = evalF(R, folds || FOLDS);
    if (!folds) { const fw = fwdFold(); if (fw) { const x = evalF(R, fw.folds); out.fwd = { cut: fw.cut, nf: fw.nf, nt: fw.nt, gap: x.gap, wRoute: x.wRoute, wNoise: x.wNoise, wStat: x.wStat, wTrip: x.wTrip, dep: x.ph.depSys, soc: x.ph.socSys }; } }
    return out; }
  function evalF(R, folds) { const T0 = C.baseRoutes(R), days = [], stops = [], socs = [];
    try { for (const [fit, test] of folds) { C.setFit(C.DAYS.filter(fit)); T0.forEach(g => routeDays(g, fit, test, days)); physics(R, test, stops, socs); } } finally { C.setFit(null); }
    const by = new Map(); days.forEach(x => { const o = by.get(x.g) || { g: x.g, rc: 0, mc: 0, rt: 0, mt: 0, n: 0 }; o.rc += x.rc; o.mc += x.mc; o.rt += x.rt; o.mt += x.mt; o.n++; by.set(x.g, o); });
    const rows = [...by.values()].map(o => ({ g: o.g, rc: o.rc, mc: o.mc, gap: o.rc > 0 ? (o.mc - o.rc) / o.rc * 100 : 0, rtd: o.rt / o.n, mtd: o.mt / o.n, nd: o.n })).sort((a, b) => Math.abs(b.mc - b.rc) - Math.abs(a.mc - a.rc));
    const sum = f => days.reduce((a, x) => a + f(x), 0), rc = sum(x => x.rc), mc = sum(x => x.mc), rT = sum(x => x.rt), nDay = Math.max(1, new Set(days.map(x => x.d)).size);
    const gap = rc > 0 ? (mc - rc) / rc * 100 : 0, wRoute = rc > 0 ? rows.reduce((a, r) => a + Math.abs(r.mc - r.rc), 0) / rc * 100 : 0;
    const wDay = rc > 0 ? sum(x => Math.abs(x.mc - x.rc)) / rc * 100 : 0, wTrip = rT > 0 ? sum(x => Math.abs(x.mt - x.rt)) / rT * 100 : 0, wStat = rT > 0 ? sum(x => Math.abs(x.st - x.rt)) / rT * 100 : 0;
    const ph = physSum(stops, socs);
    /* nhiễu ngày: nếu sai số từng ngày là ngẫu nhiên (trung bình 0), tổng theo tuyến vẫn lệch khoảng 0,8 × căn(tổng bình phương) — mức không model nào xuống thấp hơn được */
    const e2 = new Map(); days.forEach(x => e2.set(x.g, (e2.get(x.g) || 0) + (x.mc - x.rc) ** 2)); const wNoise = rc > 0 ? [...e2.values()].reduce((a, v) => a + 0.798 * Math.sqrt(v), 0) / rc * 100 : 0;
    /* MÔ PHỎNG LẠI KỲ: học trên toàn kỳ, chạy lại toàn kỳ — sai số theo tuyến (tiền, chuyến) */
    let r1 = 0, m1c = 0, r1t = 0, m1t = 0;
    T0.forEach(g => { let a = 0, b = 0, c = 0, d2 = 0; for (const d of C.DAYS) { if (!ok(d) || !g.some(i => (C.S[i].v[d] || 0) > 0)) continue; const m = C.routeDay(g, d); a += g.reduce((s, i) => s + C.realCost(i, d), 0); b += m ? m.c : 0; c += g.reduce((s, i) => s + realTrips(i, d), 0); d2 += m ? m.t : 0; }
      r1 += a; m1c += Math.abs(b - a); r1t += c; m1t += Math.abs(d2 - c); });
    const rep = { cost: r1 > 0 ? m1c / r1 * 100 : 0, trips: r1t > 0 ? m1t / r1t * 100 : 0 };
    return { R, rows, rc, mc, gap, wRoute, wDay, wTrip, wStat, wNoise, rep, rt: rT / nDay, mt: sum(x => x.mt) / nDay, ph,
      ok: { rep: rep.cost <= T.calRep && rep.trips <= T.calRep, cost: Math.abs(gap) <= T.calCost && wRoute <= T.calRoute, time: ph.depSys != null && ph.depSys >= T.calShare && ph.socSys >= T.calShare }, src: sources(C.nodes(R)) }; }
  /* DÂY CHUYỀN 1–4 ĐANG DÙNG KHÁC DÂY CHUYỀN 0 THẾ NÀO — đo trên các tuyến hiện nay, người như mô hình hiện nay (r.L0), ngày đông */
  function gap(R, r) { const out = {}, stops = [], socs = [], tk = [];
    r.T0.forEach(g => { const h = r.L0.routes[C.key(g)]; if (!h || !h.sim) return;
      h.sim.rows.forEach(s => { const last = s.st[s.st.length - 1];
        s.st.forEach(z => { const W = C.waves(z.i), w = W && W.w.find(x => x.k === z.k), qT = z.q / Math.max(1, s.nTr);
          stops.push({ i: z.i, k: z.k, d0: C.dwell(z.i, qT), d1: C.dwellAt(z.i, qT, z.arr), arr: z.arr, dep: z.dep, rArr: w ? w.arr : null, rDep: w ? w.dep : null, ready: z.ready, dl: z.dl, late: z.dep - z.dl }); });
        socs.push({ a: C.toSoc(last.i), b: C.toSocAt(last.i, last.dep) }); });
      /* số xe ngày đông: mô phỏng giờ (tổng xe các lượt) vs công thức tiền xe & thật ở ngày có đơn gần ngày đông nhất */
      const pk = g.reduce((a, i) => a + C.volPk(i), 0), days = C.DAYS.filter(d => ok(d) && g.some(i => (C.S[i].v[d] || 0) > 0));
      if (days.length) { const d = days.reduce((b, x) => Math.abs(g.reduce((a, i) => a + (C.S[i].v[x] || 0), 0) - pk) < Math.abs(g.reduce((a, i) => a + (C.S[i].v[b] || 0), 0) - pk) ? x : b, days[0]);
        const m = C.routeDay(g, d); tk.push({ sim: h.sim.rows.reduce((a, s) => a + s.nTr, 0), cost: m ? m.t : 0, real: g.reduce((a, i) => a + realTrips(i, d), 0) }); } });
    const md = a => med(a), pin = (L, f, x) => L.length ? L.filter(v => Math.abs(f(v)) <= x).length / L.length * 100 : null;
    const sd = stops.filter(z => z.rDep != null);
    out.dwell = { n: stops.length, med: md(stops.map(z => z.d1 - z.d0)), big: pin(stops, z => z.d1 - z.d0, 15) };
    out.soc = { n: socs.length, med: md(socs.map(z => z.b - z.a)), big: pin(socs, z => z.b - z.a, 15) };
    out.dep = { n: sd.length, med: md(sd.map(z => z.dep - z.rDep)), in15: pin(sd, z => z.dep - z.rDep, 15), in60: pin(sd, z => z.dep - z.rDep, 60) };
    out.arr = { med: md(sd.map(z => z.arr - z.rArr)), in15: pin(sd, z => z.arr - z.rArr, 15) };
    out.late = { n: stops.length, late: stops.filter(z => z.late > 0.5).length, worst: Math.max(0, ...stops.map(z => z.late)) };
    out.contra = stops.filter(z => z.ready > z.dl + 0.5 && z.rDep != null && z.rDep <= z.dl + 15).length;   // mô phỏng: hàng sẵn sau hạn, trong khi thật xe đã rời trước / đúng hạn
    out.trucks = { sim: tk.reduce((a, x) => a + x.sim, 0), cost: tk.reduce((a, x) => a + x.cost, 0), real: tk.reduce((a, x) => a + x.real, 0) };
    return out; }
  return { T, run, gap };
}
if (typeof module !== "undefined") module.exports = { Calib };
