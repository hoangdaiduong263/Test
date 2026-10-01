/* DÂY CHUYỀN 0 · KIỂM ĐỊNH AS-IS
   Model tự dựng lại tuyến hiện nay (tuyến T0, FTE riêng như hiện nay) cho TỪNG NGÀY rồi so với chuyến thật:
   - tiền xe: mô hình (đội xe rẻ nhất cho đơn của ngày) vs chuyến thật × giá
   - số chuyến: mô hình vs thật
   - vật lý mô phỏng: phát lại từng chuyến thật (giờ tới điểm đầu thật) → giờ rời từng điểm, giờ tới SOC vs thật
   Đạt khi: |lệch tiền| ≤ calCost %, và ≥ calShare % lượt-điểm có |lệch giờ rời| ≤ calTime phút.
   Kèm thống kê NGUỒN của từng loại dữ liệu (data / giả định). */
function Calib(C, REF) {
  const T = { calCost: 5, calTime: 15, calShare: 80 };
  const med = a => { const b = a.slice().sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const realTrips = (i, d) => { const tr = C.S[i].tr && C.S[i].tr[d]; return Array.isArray(tr) ? tr.reduce((a, x) => a + x, 0) : 0; };

  /* TIỀN XE & SỐ CHUYẾN: mô hình (đội xe rẻ nhất cho đơn của từng ngày) vs chuyến thật */
  function route(g) { let mc = 0, mt = 0, rt = 0; const days = new Set();
    for (const d of C.DAYS) { if (!g.some(i => (C.S[i].v[d] || 0) > 0)) continue; days.add(d);
      const x = C.routeDay(g, d); if (x) { mc += x.c; mt += x.t; } g.forEach(i => { rt += realTrips(i, d); }); }
    const rc = g.reduce((a, i) => a + C.realCost(i), 0), nd = Math.max(1, days.size);
    return { g, rc, mc, gap: rc > 0 ? (mc - rc) / rc * 100 : 0, rtd: rt / nd, mtd: mt / nd }; }

  /* VẬT LÝ MÔ PHỎNG: phát lại từng chuyến thật — xe tới điểm đầu đúng giờ thật, model tính thời gian chất (cố định + phút/đơn)
     và thời gian chạy giữa các điểm / về SOC; so giờ rời từng điểm và giờ tới SOC với thật. Không đụng chính sách điều xe. */
  function physics(R) { const ix = {}; C.S.forEach((s, i) => { ix[C.nm(i)] = i; }); const stops = [], socs = [], spd = C.simK().spd;
    for (const code in C.TRP) { const t = C.TRP[code], P5 = t[5], pk = P5.filter(p => p[1] === 0 && p[4] != null);
      if (!pk.length) continue; const pts = pk.map(p => ix[String(C.TRN[p[0]]).trim()]); if (pts.some(i => i == null) || C.S[pts[0]].R !== R) continue;
      let tm = pk[0][4], prev = null;
      pk.forEach((p, k) => { const i = pts[k], arr = prev == null ? p[4] : tm + C.legMin(prev, i), dep = Math.max(arr, p[4]) + C.dwell(i, p[2] || 0);
        if (p[5] != null) stops.push({ i, e: dep - p[5], first: k === 0, wait: p[5] - p[4] - C.dwell(i, p[2] || 0) }); tm = dep; prev = i; });
      const sc = P5.find(p => p[1] === 2 && p[4] != null), last = pk[pk.length - 1];
      if (sc && last[5] != null) socs.push({ e: (last[5] + C.toSoc(pts[pts.length - 1])) - sc[4] }); }
    const pctIn = L => L.length ? L.filter(x => Math.abs(x.e) <= T.calTime).length / L.length * 100 : null;
    const after = stops.filter(x => !x.first);
    return { n: stops.length, dep: pctIn(stops), depMed: med(stops.map(x => x.e)), next: pctIn(after), nNext: after.length, soc: pctIn(socs), socMed: med(socs.map(x => x.e)), nSoc: socs.length,
      waitMed: med(stops.map(x => x.wait)), waitBig: stops.length ? stops.filter(x => x.wait > 30).length / stops.length * 100 : null }; }

  /* nguồn dữ liệu của các điểm: data hay giả định */
  function sources(N) { const c = (f) => N.filter(f).length, nm = i => C.nm(i), R = C.S[N[0]] && C.S[N[0]].R;
    return [
      ["Đơn theo ngày", N.length, 0, "file volume"],
      ["Chuyến xe, giờ tới/rời, đơn lên", c(i => C.S[i].tc && C.S[i].tc.some(x => x && x.length)), c(i => !(C.S[i].tc && C.S[i].tc.some(x => x && x.length))), "file linehaul"],
      ["Toạ độ", c(i => C.geo(nm(i))), c(i => !C.geo(nm(i))), "sheet Station"],
      ["Giờ mở cửa", c(i => REF.OPENT[nm(i)] != null), c(i => REF.OPENT[nm(i)] == null), "sheet seller · thiếu: min(08:00, xe tới sớm nhất − 60')"],
      ["Giờ đóng / bàn giao cuối", C.COTW[R] ? 0 : c(i => REF.HANDOVER[nm(i)] != null || REF.CLOSE[nm(i)] != null), C.COTW[R] ? 0 : c(i => REF.HANDOVER[nm(i)] == null && REF.CLOSE[nm(i)] == null), C.COTW[R] ? "theo khung COT Outbound của vùng" : "sheet seller / deck · thiếu: giờ xe tới muộn nhất (p90)"],
      ["Thời gian chất hàng", c(i => C.waves(i) && C.waves(i).dw), c(i => !(C.waves(i) && C.waves(i).dw)), "hồi quy trên lần dừng thật · thiếu: trung vị toàn mạng"],
      ["Mức lấp đầy xe", N.length, 0, "chỉnh theo chuyến thật của điểm"],
      ["COT Pickup Ontime", 0, N.length, "chưa có — chờ FLM"],
      ["Năng suất người", 0, N.length, "giả định theo đặc điểm seller (model cũ)"],
    ]; }

  function run(R) { const T0 = C.baseRoutes(R), rows = T0.map(route).sort((a, b) => Math.abs(b.mc - b.rc) - Math.abs(a.mc - a.rc));
    const rc = rows.reduce((a, r) => a + r.rc, 0), mc = rows.reduce((a, r) => a + r.mc, 0), gap = rc > 0 ? (mc - rc) / rc * 100 : 0;
    const rt = rows.reduce((a, r) => a + r.rtd, 0), mt = rows.reduce((a, r) => a + r.mtd, 0), ph = physics(R);
    return { R, rows, rc, mc, gap, rt, mt, ph, ok: { cost: Math.abs(gap) <= T.calCost, time: ph.dep != null && ph.dep >= T.calShare }, src: sources(C.nodes(R)) }; }
  return { T, run };
}
if (typeof module !== "undefined") module.exports = { Calib };
