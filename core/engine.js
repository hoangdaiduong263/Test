/* D2S Core — 2 bước:
   [1] LINEHAUL: tìm cách ghép điểm thành tuyến xe + chọn cỡ xe để tiền xe thấp nhất (chỉ xét tiền, không xét giờ).
   [2] HEADCOUNT: với mỗi tuyến mới, mô phỏng người + xe ở ngày đông; chọn loại người rẻ nhất mà vẫn kịp COT (trễ ≤ P.lateTol phút).
       Tuyến không cách nào kịp → cấm → chạy lại [1]. Lặp tới khi mọi tuyến mới đều qua [2].
   Dùng được trên trình duyệt và Node: Core(D, REF) → {P, run(R), ...}. */
function Core(D, REF) {
  const S = D.S, TY = D.TY, TRP = D.T || {}, TRN = D.TN || [], GEO = D.GEO || {};
  const DAYS = D.dates.map((_, d) => d);
  const REGIONS = [...new Set(S.map(s => s.R))];

  /* ---------- tham số (sửa được trên trang) ---------- */
  const P = {
    // xe
    fill: 85,          // % lấp đầy tối đa mỗi xe
    maxStops: 4,       // số điểm tối đa trên một tuyến
    maxKm: 30,         // hai điểm cách nhau quá số km này thì không ghép (0 = không giới hạn)
    cotGap: 180,       // giờ xe tới lượt đầu của hai điểm lệch quá số phút này thì không ghép (0 = bỏ qua)
    minGain: 0.5e6,    // một bước ghép/tách phải lợi ít nhất bấy nhiêu đ/kỳ
    cityKm: 30,        // xa SOC hơn số km này thì giá xe theo bảng km
    dropSur: 10,       // xe trả nhiều SOC trên một chuyến: +% giá mỗi SOC thêm
    // người
    peakP: 90,         // ngày đông = phân vị này của đơn/ngày
    lateTol: 60,       // cho trễ COT tối đa (phút)
    fteDay: 2000,      // năng suất FTE: đơn/người/ngày
    fteH: 7,           // FTE làm bao nhiêu giờ/ngày
    ftePay: 520000,    // lương FTE đ/người/ngày
    bulkyF: 2,         // một đơn hàng to tốn công bằng mấy đơn thường
    ppsRate: 700,      // Rider Pay Per Scan: đ/đơn quét
    ppsSpd: 600,       // Rider quét bao nhiêu đơn/giờ (cộng vào thời gian xe đứng ở điểm)
    open: 480,         // giờ seller bắt đầu làm nếu không có dữ liệu (phút từ 0h)
  };
  const VEH = [{ k: "VAN", n: 1000, b: 350, p: 500000 }, { k: "1T25", n: 1300, b: 450, p: 600000 }, { k: "1T9", n: 2000, b: 700, p: 790000 },
    { k: "5T", n: 3700, b: 1000, p: 1200000 }, { k: "8T", n: 6000, b: 1800, p: 1800000 }];
  /* giá thuê chuyến theo vùng (trung vị bảng giá nhà xe); thiếu thì dùng giá chung ở VEH */
  const VEH_R = { HCM: { VAN: 807500, "1T25": 522500, "1T9": 665000, "5T": 1100000 }, South: { VAN: 807500, "1T25": 522500, "1T9": 665000, "5T": 1100000 },
    HN: { VAN: 750500, "1T25": 674100, "1T9": 750000, "5T": 1251900 }, North: { VAN: 700000, "1T25": 674100, "1T9": 800000, "5T": 1300000 } };
  /* giá theo km (xa SOC hơn P.cityKm): [km tới hết bậc, giá cơ bản, đ/km một chiều]; VAN/1T25 theo 1T9 nhân tỉ lệ giá chuyến */
  const KM_T = { "1T9": [[24, 380000, 5000], [49, 332500, 5000], [74, 285000, 5000], [99, 237500, 5000], [149, 190000, 5125], [199, 146250, 5000], [249, 145000, 5000], [300, 97500, 5000], [1e9, 194500, 4750]],
    "5T": [[24, 760000, 7500], [49, 617500, 7500], [74, 475000, 7500], [99, 332500, 7500], [149, 277000, 7550], [199, 282750, 7400], [249, 258250, 7000], [300, 258250, 7100], [1e9, 435600, 6800]],
    "8T": [[24, 1125000, 11000], [49, 1035000, 11000], [74, 810000, 11000], [99, 630000, 11000], [149, 440000, 11000], [199, 380000, 9900], [249, 380000, 9700], [300, 380000, 9750], [1e9, 490600, 9500]] };

  /* ---------- tiện ích ---------- */
  const med = a => { const b = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const pct = (a, p) => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.round((b.length - 1) * p / 100))] : 0; };
  const key = g => g.slice().sort((a, b) => a - b).join(",");
  const nm = i => S[i].n.trim();
  const active = i => DAYS.filter(d => (S[i].v[d] || 0) > 0);
  const hubCode = h => h ? h.replace(/ Hub$/, "").replace(/^(\d+)-(\w+) /, "$1$2-").replace(/[^A-Za-z0-9-]/g, "").slice(0, 18) : "";

  /* ---------- tọa độ: chim bay × 1,3 ≈ đường bộ ---------- */
  const geo = n => n ? GEO[String(n).trim()] || null : null;
  const kmAB = (a, b) => { if (!a || !b) return null; const r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h))) * 1.3; };
  const kmPt = (i, j) => kmAB(geo(S[i].n), geo(S[j].n));
  /* SOC đích chính: theo data; thiếu thì SOC mà chuyến thật của điểm tới nhiều nhất */
  S.forEach(s => { if (s.soc && s.soc.length) return; const c = {};
    (s.tc || []).forEach(L => (L || []).forEach(t => { const T = TRP[t]; if (!T) return; T[5].forEach(p => { if (p[1] === 2) { const n = String(TRN[p[0]]).trim(); c[n] = (c[n] || 0) + 1; } }); }));
    s.soc = Object.entries(c).sort((a, b) => b[1] - a[1]).map(x => x[0]); });
  const socOf = i => (S[i].soc || [])[0] || null;
  const kmSoc = i => kmAB(geo(S[i].n), geo(socOf(i)));
  /* thứ tự ghé: điểm xa SOC nhất trước, rồi điểm gần nhất kế tiếp */
  function routeOrder(g) { if (g.length < 2) return g.slice(); const d = i => kmSoc(i) ?? 0; let cur = g.slice().sort((a, b) => d(b) - d(a))[0];
    const left = g.filter(x => x !== cur), out = [cur]; while (left.length) { left.sort((a, b) => (kmPt(cur, a) ?? 99) - (kmPt(cur, b) ?? 99)); cur = left.shift(); out.push(cur); } return out; }
  /* km một chuyến: d0 = km từ điểm xa nhất về SOC; dt = km đi vòng thêm để ghé các điểm còn lại */
  const TKM = {};
  function tripKm(g) { const k = key(g); if (k in TKM) return TKM[k]; const o = routeOrder(g), d0 = Math.max(...g.map(i => kmSoc(i) ?? 0));
    let L = 0; for (let x = 1; x < o.length; x++) L += kmPt(o[x - 1], o[x]) ?? 0; L += kmSoc(o[o.length - 1]) ?? 0;
    return TKM[k] = { d0, dt: g.length > 1 ? Math.max(0, L - (kmSoc(o[0]) ?? 0)) : 0 }; }

  /* ---------- giá xe ---------- */
  const pTrip = (k, R) => ((VEH_R[R] || {})[k]) || (VEH.find(v => v.k === k) || {}).p || 0;
  function kmTab(k, R) { if (KM_T[k]) return { t: KM_T[k], sc: 1 }; return { t: KM_T["1T9"], sc: pTrip(k, R) / pTrip("1T9", R) }; }
  /* giá một chuyến của xe loại k: thuê chuyến; xa SOC thì theo bảng km; tuyến nhiều điểm cộng đ/km × km đi vòng */
  function price(k, R, km) { let p = pTrip(k, R); const d0 = km ? km.d0 : 0, dt = km ? km.dt : 0, { t, sc } = kmTab(k, R);
    if (d0 > P.cityKm) { const r = t.find(x => d0 <= x[0]) || t[t.length - 1]; p = Math.max(p, (r[1] + r[2] * d0) * sc); }
    return p + t[0][2] * sc * dt; }
  /* sức chứa một xe (đơn) với tỷ lệ hàng to beta, ở mức lấp đầy fl */
  const cap = (v, beta, fl) => fl / ((1 - beta) / v.n + beta / v.b);
  /* đội xe rẻ nhất chở Q đơn ở mức lấp đầy fl: n xe loại chính (+1 xe nhỏ hơn cho phần lẻ) */
  function fleet(Q, beta, R, km, fl) { if (Q <= 0) return { c: 0, t: 0, mix: {} }; fl = fl || P.fill / 100; let best = null;
    const one = VEH.map(v => ({ v, q: cap(v, beta, fl), p: price(v.k, R, km) }));
    const add = (c, t, mix) => { if (!best || c < best.c - 1 || (Math.abs(c - best.c) <= 1 && t < best.t)) best = { c, t, mix }; };
    for (const m of one) { const n = Math.floor(Q / m.q - 1e-9), rest = Q - n * m.q;
      add((n + 1) * m.p, n + 1, { [m.v.k]: n + 1 });
      if (rest > 0) for (const u of one) if (u.q >= rest) { const mix = {}; if (n > 0) mix[m.v.k] = n; mix[u.v.k] = (mix[u.v.k] || 0) + 1; add(n * m.p + u.p, n + 1, mix); } }
    return best; }
  const mixLabel = mix => Object.entries(mix).filter(x => x[1] > 0).map(([k, n]) => `${Math.round(n * 10) / 10}×${k}`).join(" + ");

  const HY = new Set(REF.HY || []);
  /* ---------- COT & lượt xe từ chuyến thật ---------- */
  function lastArr(i) { const v = []; for (const d of DAYS) { let mx = null; ((S[i].tc && S[i].tc[d]) || []).forEach(c => { const t = TRP[c]; if (!t) return;
    t[5].forEach(p => { if (p[1] === 0 && String(TRN[p[0]]).trim() === nm(i) && p[4] != null) mx = Math.max(mx ?? -1, p[4]); }); }); if (mx != null) v.push(mx); }
    return v.length ? pct(v, 90) : null; }
  /* giờ bàn giao cuối của seller: sheet thông tin seller > deck > giờ xe tới muộn nhất (p90) */
  const CLC = {};
  const closeOf = i => i in CLC ? CLC[i] : (CLC[i] = REF.HANDOVER[nm(i)] ?? REF.CLOSE[nm(i)] ?? lastArr(i));
  /* COT của điểm: theo vùng; COT cuối = giờ bàn giao cuối của seller. r = FMHub_received, p = FMLH_Packed (phút từ 0h) */
  const COC = {};
  function cotsOf(i) { if (COC[i]) return COC[i]; const R = S[i].R, L = (R === "North" && HY.has(nm(i)) ? REF.COT_NHY : (REF.COTS[R] || REF.COTS.North)).map(c => Object.assign({}, c)), cl = closeOf(i);
    if (cl != null) { const out = L.filter(c => c.p < cl); out.push({ r: cl - 60, p: cl, close: 1 }); return COC[i] = out; } return COC[i] = L; }
  const cotIdx = (i, dep) => { const L = cotsOf(i); for (let k = 0; k < L.length; k++) if (L[k].p >= dep - 45) return k; return L.length - 1; };
  /* thời gian xe đứng ở điểm = cố định + phút/đơn × đơn (hồi quy trung vị trên các lần dừng thật) */
  function fitDwell(Pt) { if (Pt.length < 6) return null; const xs = Pt.map(p => p[0]); if (Math.max(...xs) < 1.5 * Math.min(...xs)) return null; const sl = [];
    for (let a = 0; a < Pt.length; a++) for (let b = a + 1; b < Pt.length; b++) { const dx = Pt[b][0] - Pt[a][0]; if (Math.abs(dx) >= 20) sl.push((Pt[b][1] - Pt[a][1]) / dx); }
    if (!sl.length) return null; const rate = Math.max(0, med(sl)); return { fix: Math.min(90, Math.max(0, med(Pt.map(p => p[1] - rate * p[0])))), rate }; }
  /* lượt xe của điểm (mỗi COT một lượt): trung vị giờ xe tới / rời, số xe, số đơn lên; chỉ giữ COT có xe ≥ 30% số ngày */
  const STC = {};
  function waves(i) { if (i in STC) return STC[i]; const s = S[i], byC = {}, dw = [], legs = [], spt = []; let nd = 0;
    for (const d of DAYS) { const st = []; ((s.tc && s.tc[d]) || []).forEach(c => { const t = TRP[c]; if (!t) return;
        t[5].forEach((p, k) => { if (p[1] !== 0 || String(TRN[p[0]]).trim() !== nm(i) || p[4] == null) return; const dep = p[5] ?? p[4];
          const soc = [...new Set(t[5].slice(k + 1).filter(q => q[1] === 2).map(q => String(TRN[q[0]]).trim()))].sort();
          st.push({ arr: p[4], dep, up: p[2] || 0, soc }); if (p[2] >= 20 && dep > p[4]) dw.push([p[2], dep - p[4]]); }); });
      if (!st.length) continue; nd++; const W = {};
      st.forEach(x => { const k = cotIdx(i, x.dep), w = W[k] || (W[k] = { k, arr: x.arr, dep: x.dep, n: 0, up: 0, ds: new Set() }); w.arr = Math.min(w.arr, x.arr); w.dep = Math.max(w.dep, x.dep); w.n++; w.up += x.up;
        w.ds.add(x.soc.join("|")); spt.push(Math.max(1, x.soc.length)); });
      Object.values(W).forEach(w => { (byC[w.k] = byC[w.k] || []).push(w); legs.push(w.ds.size); }); }
    if (!nd) return STC[i] = null;
    let ks = Object.keys(byC).map(Number).sort((a, b) => a - b).filter(k => byC[k].length >= 0.3 * nd);
    if (!ks.length) ks = [Number(Object.keys(byC).sort((a, b) => byC[b].length - byC[a].length)[0])];
    const w = ks.map(k => ({ k, arr: med(byC[k].map(x => x.arr)), dep: med(byC[k].map(x => x.dep)), n: med(byC[k].map(x => x.n)), up: med(byC[k].map(x => x.up)) || 1 }));
    /* legs: số xe tách theo SOC đích trong một lượt (trung vị); spt: số SOC trên một chuyến (xe trả nhiều SOC) */
    return STC[i] = { w, dw: fitDwell(dw), legs: Math.max(1, Math.round(med(legs) || 1)), spt: Math.max(1, Math.round(med(spt) || 1)) }; }
  const nWaves = i => { const w = waves(i); return w ? w.w.length : 1; };
  const legsOf = i => { const w = waves(i); return w ? w.legs : 1; };
  const sptOf = i => { const w = waves(i); return w ? w.spt : 1; };
  /* tốc độ xe & thời gian dừng chung (trung vị toàn mạng) cho điểm thiếu data */
  let SK = null;
  function simK() { if (SK) return SK; const r = [], f = [], v = []; S.forEach((s, i) => { const t = waves(i); if (t && t.dw) { r.push(t.dw.rate); f.push(t.dw.fix); } });
    for (const c in TRP) { const t = TRP[c], st = t[5]; for (let x = 1; x < st.length; x++) { const a = st[x - 1], b = st[x], km = kmAB(geo(TRN[a[0]]), geo(TRN[b[0]]));
      if (km > 2 && a[5] != null && b[4] != null && b[4] > a[5]) v.push(km / (b[4] - a[5])); } }
    return SK = { rate: med(r) ?? 0.05, fix: med(f) ?? 15, spd: Math.min(1.2, Math.max(0.2, med(v) ?? 0.5)) }; }
  const dwell = (i, q) => { const w = waves(i), d = w && w.dw ? w.dw : simK(); return d.fix + d.rate * q; };
  const legMin = (i, j) => 5 + (kmPt(i, j) ?? 10) / simK().spd;
  const openOf = i => REF.OPENT[nm(i)] ?? Math.min(P.open, (() => { const w = waves(i); return w ? Math.min(...w.w.map(x => x.arr)) - 60 : 1e9; })());
  /* hạn của một lượt = giờ Packed của COT; nếu hiện nay xe đã đi muộn hơn thì hạn = giờ đi hiện nay (không bắt tốt hơn thực tế) */
  function deadline(i, w) { const c = cotsOf(i)[w.k]; return w.dep > c.p && !c.close ? w.dep : c.p; }

  /* ---------- chuyến đi chung thật (để biết tuyến hiện nay) ---------- */
  let CO = null;
  const coOf = (i, j) => { if (!CO) { CO = {}; const ix = {}; S.forEach((s, k) => { ix[nm(k)] = k; });
      for (const c in TRP) { const pts = [...new Set(TRP[c][5].filter(p => p[1] === 0).map(p => ix[String(TRN[p[0]]).trim()]).filter(x => x != null))];
        for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) { const k = Math.min(pts[a], pts[b]) + "-" + Math.max(pts[a], pts[b]); CO[k] = (CO[k] || 0) + 1; } } }
    return CO[Math.min(i, j) + "-" + Math.max(i, j)] || 0; };

  /* ---------- điểm được tối ưu: có đơn, chạy xe riêng/ghép (T1/T2), tiền xe không do hub trả ---------- */
  const HUBPAY = new Set(REF.HUBPAY || []);
  const isNode = i => active(i).length > 0 && (S[i].tt === "T1" || S[i].tt === "T2") && !HUBPAY.has(nm(i));
  const nodes = R => S.map((_, i) => i).filter(i => S[i].R === R && isNode(i));
  /* tuyến hiện nay: cùng cụm ghép trong data, hoặc thực tế đi chung chuyến ≥ 80% số ngày (cùng SOC) */
  function baseRoutes(R) { const g = {}; nodes(R).forEach(i => { const s = S[i], tg = s.tt === "T2" ? (s.cl || hubCode(s.h)) : ""; const k = tg ? "G|" + tg : "i|" + i; (g[k] = g[k] || []).push(i); });
    const L = Object.values(g), sg = L.filter(x => x.length === 1).map(x => x[0]), par = {}; const fd = i => par[i] == null || par[i] === i ? i : (par[i] = fd(par[i]));
    sg.forEach((i, a) => sg.slice(a + 1).forEach(j => { if (socOf(i) && socOf(i) === socOf(j) && coOf(i, j) >= 0.8 * Math.min(active(i).length, active(j).length)) par[fd(j)] = fd(i); }));
    const m = {}; sg.forEach(i => { (m[fd(i)] = m[fd(i)] || []).push(i); }); return L.filter(x => x.length > 1).concat(Object.values(m)); }

  /* ---------- mức lấp đầy theo chuyến thật của từng điểm ----------
     x = đơn lên xe ÷ sức chứa 100% các xe thật trong ngày.
     - Ngày xe phải chạy thêm chuyến (số chuyến ≥ 1,25 × số chuyến tối thiểu): xe đã "đầy" ở mức x → lấy p90 các ngày đó (≥ 5 ngày) nếu thấp hơn P.fill.
     - Xe thật thường chở nhiều hơn sức chứa chuẩn (trung vị x > P.fill): đơn của điểm nhỏ hơn chuẩn → lấy trung vị x. */
  const CAL = {};
  function fillOf(i) { if (i in CAL) return CAL[i]; const s = S[i], f0 = P.fill / 100, full = [], all = [];
    const legs = legsOf(i);
    for (const d of DAYS) { const tv = s.tr && s.tr[d], v = s.v[d] || 0; if (!Array.isArray(tv) || v <= 0) continue; const beta = (s.b[d] || 0) / v; let c = 0, tt = 0;
      tv.forEach((x, j) => { const vv = VEH.find(u => u.k === (TY[j] === "KHAC" ? "VAN" : TY[j])); if (x > 0 && vv) { c += x * cap(vv, beta, 1); tt += x; } });
      if (c <= 0) continue; const ld = Math.max(v, (s.to && s.to[d]) || 0) / c, smin = legs * ((s.wvd && s.wvd[d]) || s.wv || 1); all.push(ld); if (tt >= smin + 1 && tt >= smin * 1.25) full.push(ld); }
    let f = f0; if (full.length >= 5) { const k = pct(full, 90); if (k < f0) f = Math.max(0.1, k); }
    if (f === f0) { const m = med(all); if (m != null && m > f0) f = m; }
    return CAL[i] = f; }
  /* nhiều điểm chung xe: mức lấp đầy chung = bình quân theo chỗ chiếm */
  function grpFill(g, d) { let U = 0, W = 0; g.forEach(i => { const u = (S[i].v[d] - (S[i].b[d] || 0)) / 2000 + (S[i].b[d] || 0) / 700; U += u; W += u / fillOf(i); }); return U > 0 && W > 0 ? U / W : P.fill / 100; }

  /* ---------- [1] TIỀN XE ---------- */
  /* tiền xe thật của điểm cả kỳ: số chuyến thật theo loại xe (đã chia phần nếu đi chung) × giá chuyến */
  function realCost(i) { let c = 0; const km = { d0: kmSoc(i) ?? 0, dt: 0 }; for (const d of DAYS) { const tr = S[i].tr && S[i].tr[d]; if (!Array.isArray(tr)) continue;
    tr.forEach((x, j) => { if (x > 0) c += x * price(TY[j] === "KHAC" ? "VAN" : TY[j], S[i].R, km); }); } return c; }
  /* tiền xe mô hình của một tuyến trong một ngày: gom đơn các điểm, chia đều cho số lượt (COT) × số xe tách theo SOC mỗi lượt (theo chuyến thật),
     chọn đội xe rẻ nhất; xe trả nhiều SOC trên một chuyến cộng P.dropSur % giá mỗi SOC thêm */
  function routeDay(g, d) { const act = g.filter(i => (S[i].v[d] || 0) > 0); if (!act.length) return null;
    let N = 0, b = 0, mt = 1, legs = 1, spt = 1; act.forEach(i => { N += S[i].v[d]; b += S[i].b[d] || 0; mt = Math.max(mt, nWaves(i)); legs = Math.max(legs, legsOf(i)); spt = Math.max(spt, sptOf(i)); });
    const m = mt * legs, f = fleet(N / m, N > 0 ? b / N : 0, S[act[0]].R, tripKm(act), grpFill(act, d)), sur = 1 + P.dropSur / 100 * (spt - 1);
    return { c: f.c * m * sur, t: f.t * m, mix: Object.fromEntries(Object.entries(f.mix).map(([v, n]) => [v, n * m])), N, mt, legs }; }
  const RC = {};
  function routeCost(g) { const k = key(g); if (k in RC) return RC[k]; let c = 0, t = 0; const mix = {}, nd = new Set();
    for (const d of DAYS) { const x = routeDay(g, d); if (!x) continue; c += x.c; t += x.t; nd.add(d); Object.entries(x.mix).forEach(([v, n]) => { mix[v] = (mix[v] || 0) + n; }); }
    Object.keys(mix).forEach(v => { mix[v] /= Math.max(1, nd.size); }); return RC[k] = { c, t: t / Math.max(1, nd.size), mix, days: nd.size }; }
  /* hai điểm được phép đi chung xe: chung SOC, chạy trùng đủ ngày, không quá xa, giờ xe lượt đầu không lệch quá — hoặc đã đi chung chuyến thật */
  function pairOk(i, j) { if (coOf(i, j) >= 3) return true; if (!(S[i].soc || []).some(x => (S[j].soc || []).includes(x))) return false;
    const a = active(i), b = new Set(active(j)), both = a.filter(d => b.has(d)).length; if (both < Math.max(3, 0.5 * Math.min(a.length, b.size))) return false;
    const km = kmPt(i, j); if (P.maxKm > 0 && km != null && km > P.maxKm) return false;
    if (P.cotGap > 0) { const wi = waves(i), wj = waves(j); if (wi && wj && Math.abs(wi.w[0].arr - wj.w[0].arr) > P.cotGap) return false; }
    return true; }
  /* tìm kiếm cục bộ: lặp lại bước có lợi nhất trong (ghép 2 tuyến · chuyển 1 điểm · tách 1 điểm · đổi chéo 2 điểm) tới khi không còn bước lợi ≥ P.minGain.
     ban: tập tuyến bị bước [2] loại → không được tạo lại */
  function search(R, T0, ban) { const N = nodes(R), cst = g => g.length ? routeCost(g).c : 0, nb = {}, okG = g => !ban.has(key(g));
    N.forEach(i => { nb[i] = N.filter(j => j !== i && pairOk(i, j)); }); const okAll = (i, B) => B.every(x => x === i || pairOk(i, x));
    let T = T0.map(g => g.slice()); const log = [];
    for (let it = 0; it < 800; it++) { const gm = {}; T.forEach((g, k) => g.forEach(i => { gm[i] = k; })); let best = null;
      const tryMv = (dc, f, what) => { if (dc < -P.minGain && (!best || dc < best.dc)) best = { dc, f, what }; };
      for (let a = 0; a < T.length; a++) for (let b = a + 1; b < T.length; b++) { const A = T[a], B = T[b]; if (A.length + B.length > P.maxStops) continue;
        if (!A.some(i => nb[i].some(j => gm[j] === b)) || !A.every(i => okAll(i, B))) continue; const U = A.concat(B); if (!okG(U)) continue;
        tryMv(cst(U) - cst(A) - cst(B), () => { T[a] = U; T[b] = []; }, ["ghép", U]); }
      N.forEach(i => { const a = gm[i], A = T[a], A2 = A.filter(x => x !== i), cA = cst(A), cA2 = cst(A2);
        if (A.length > 1 && (A2.length < 2 || okG(A2))) tryMv(cA2 + cst([i]) - cA, () => { T[a] = A2; T.push([i]); }, ["tách", [i]]);
        const seen = new Set(); nb[i].forEach(j => { const b = gm[j]; if (b === a) return; const B = T[b], cB = cst(B);
          if (!seen.has(b)) { seen.add(b); const B2 = B.concat([i]); if (B.length < P.maxStops && okAll(i, B) && okG(B2) && (A2.length < 2 || okG(A2))) tryMv(cA2 + cst(B2) - cA - cB, () => { T[a] = A2; T[b] = B2; }, ["chuyển", B2]); }
          if (i < j && A.length > 1 && B.length > 1) { const A3 = A2.concat([j]), B3 = B.filter(x => x !== j).concat([i]);
            if (okAll(j, A2) && okAll(i, B3.filter(x => x !== i)) && okG(A3) && okG(B3)) tryMv(cst(A3) + cst(B3) - cA - cB, () => { T[a] = A3; T[b] = B3; }, ["đổi chéo", A3]); } }); });
      if (!best) break; best.f(); T = T.filter(g => g.length); log.push({ what: best.what[0], g: best.what[1].slice(), dc: best.dc }); }
    return { T, log }; }

  /* ---------- [2] HEADCOUNT ---------- */
  const volPk = i => pct(active(i).map(d => S[i].v[d]), P.peakP);
  const betaOf = i => { let v = 0, b = 0; active(i).forEach(d => { v += S[i].v[d]; b += S[i].b[d] || 0; }); return v ? b / v : 0; };
  const effPk = i => volPk(i) * (1 + betaOf(i) * (P.bulkyF - 1));                  // đơn quy đổi (hàng to tốn công hơn)
  const fteN = eff => Math.max(1, Math.ceil(eff / P.fteDay - 1e-9));
  const rateOf = n => n * P.fteDay / (P.fteH * 60);                                  // đơn quy đổi/phút của n FTE
  /* các lượt của tuyến: lượt của điểm nhiều lượt nhất; lượt của điểm khác gắn vào lượt gần giờ nhất, đơn chia theo đơn lên từng lượt */
  function slotsOf(g) { const T = g.map(waves); if (T.some(t => !t)) return null; let L = 0; T.forEach((t, k) => { if (t.w.length > T[L].w.length) L = k; });
    const sl = T[L].w.map(w => ({ t: w.arr, m: [] })); g.forEach((i, k) => { const W = T[k].w, tot = W.reduce((a, w) => a + w.up, 0);
      W.forEach(w => { let b = 0; sl.forEach((x, y) => { if (Math.abs(x.t - w.arr) < Math.abs(sl[b].t - w.arr)) b = y; }); sl[b].m.push({ i, w, sh: w.up / tot }); }); }); return sl.filter(s => s.m.length); }
  const perms = a => a.length <= 1 ? [a] : a.flatMap((x, k) => perms(a.slice(0, k).concat(a.slice(k + 1))).map(p => [x].concat(p)));
  /* mô phỏng ngày đông của tuyến g với cách dùng người `mode` ({i: "F" | "P"} hoặc "S" = một nhóm FTE chung cho cả tuyến)
     - hàng của lượt có từ: giờ xe thật tới − thời gian FTE riêng sort phần đó (không trước giờ seller mở) → FTE riêng tái hiện đúng giờ hiện nay
     - FTE riêng (F): hàng sẵn đúng lúc như hiện nay · Rider PPS (P): seller tự đóng, rider quét lúc giao (cộng thời gian quét vào xe đứng)
     - FTE chung (S): một nhóm đi lần lượt các điểm theo thứ tự xe ghé, sort xong điểm này mới sang điểm kia
     - xe tới điểm đầu đúng lúc hàng sẵn, chờ hàng ở điểm sau nếu chưa sẵn; trễ = giờ xe rời điểm − hạn COT của lượt */
  function simRoute(g, mode, order) { const sl = slotsOf(g); if (!sl) return null; const R = S[g[0]].R, shared = mode === "S";
    const nT = shared ? fteN(g.reduce((a, i) => a + effPk(i), 0)) : 0, rT = rateOf(nT); let teamFree = -1e9, teamAt = null;
    const rows = []; let late = -1e9;
    for (const s of sl) { const q = {}, w = {}; s.m.forEach(x => { q[x.i] = (q[x.i] || 0) + volPk(x.i) * x.sh; w[x.i] = x.w; });
      const pts = order.filter(i => q[i] > 0), Q = pts.reduce((a, i) => a + q[i], 0), beta = Q ? pts.reduce((a, i) => a + q[i] * betaOf(i), 0) / Q : 0;
      const nTr = Math.max(1, fleet(Q, beta, R, tripKm(pts), Math.min(...pts.map(fillOf))).t);
      const avail = i => Math.max(openOf(i), w[i].arr - q[i] * (1 + betaOf(i) * (P.bulkyF - 1)) / rateOf(fteN(effPk(i))));
      const ready = {};
      pts.forEach(i => { const qe = q[i] * (1 + betaOf(i) * (P.bulkyF - 1));
        if (shared) { const st = Math.max(avail(i), teamFree + (teamAt != null && teamAt !== i ? legMin(teamAt, i) : 0)); ready[i] = st + qe / rT; teamFree = ready[i]; teamAt = i; }
        else ready[i] = avail(i) + qe / rateOf(fteN(effPk(i))); });
      let t = null, prev = null; const st = [];
      pts.forEach(i => { const arr = prev == null ? ready[i] : t + legMin(prev, i), ls = Math.max(arr, ready[i]);
        const dw = dwell(i, q[i] / nTr) + (!shared && mode[i] === "P" ? q[i] / nTr / (P.ppsSpd / 60) : 0), dep = ls + dw, dl = deadline(i, w[i]);
        st.push({ i, q: q[i], ready: ready[i], arr, ls, dep, dl, late: dep - dl }); late = Math.max(late, dep - dl); t = dep; prev = i; });
      rows.push({ t: s.t, nTr, st }); }
    return { rows, late, nT }; }
  /* tiền người cả kỳ của tuyến theo cách dùng người */
  function labCost(g, mode) { const runD = i => active(i).length;
    if (mode === "S") { const nd = new Set(g.flatMap(active)).size, n = fteN(g.reduce((a, i) => a + effPk(i), 0)); return { c: n * P.ftePay * nd, hc: n }; }
    let c = 0, hc = 0; g.forEach(i => { if (mode[i] === "P") c += active(i).reduce((a, d) => a + S[i].v[d], 0) * P.ppsRate; else { const n = fteN(effPk(i)); c += n * P.ftePay * runD(i); hc += n; } });
    return { c, hc }; }
  const modeLabel = (g, mode) => mode === "S" ? "FTE chung" : g.map(i => mode[i] === "P" ? "PPS" : "FTE riêng");
  /* chọn cách dùng người rẻ nhất mà kịp (trễ ≤ tol phút); không có thì lấy cách trễ ít nhất → không khả thi */
  function headcount(g, tol = P.lateTol) { const ords = g.length <= 4 ? perms(g) : [routeOrder(g)], modes = [];
    for (let m = 0; m < (1 << g.length); m++) modes.push(Object.fromEntries(g.map((i, k) => [i, (m >> k) & 1 ? "P" : "F"])));
    if (g.length > 1) modes.push("S");
    let best = null;
    for (const mode of modes) { const lc = labCost(g, mode); let bo = null;
      for (const o of ords) { const r = simRoute(g, mode, o); if (!r) return { ok: true, nodata: true, lab: labCost(g, Object.fromEntries(g.map(i => [i, "F"]))), mode: "F" };
        if (!bo || r.late < bo.sim.late) bo = { o, sim: r }; }
      const ok = bo.sim.late <= tol, c = { ok, tol, mode, order: bo.o, sim: bo.sim, lab: lc, late: bo.sim.late, label: modeLabel(g, mode) };
      if (!best || (ok && (!best.ok || lc.c < best.lab.c)) || (!ok && !best.ok && c.late < best.late)) best = c; }
    return best; }

  /* ---------- gom thay đổi thành gói: tuyến mới + tuyến cũ bị cắt, nối qua điểm chung ---------- */
  function packs(T0, T) { const k0 = new Set(T0.map(key)), k1 = new Set(T.map(key)), nw = T.filter(g => !k0.has(key(g))), cut = T0.filter(g => !k1.has(key(g)));
    const par = {}, fd = x => par[x] === x ? x : (par[x] = fd(par[x])); nw.concat(cut).forEach(g => g.forEach(i => { if (par[i] == null) par[i] = i; par[fd(i)] = fd(g[0]); }));
    const by = {}; nw.forEach(g => { (by[fd(g[0])] = by[fd(g[0])] || { nw: [], cut: [] }).nw.push(g); }); cut.forEach(g => { (by[fd(g[0])] = by[fd(g[0])] || { nw: [], cut: [] }).cut.push(g); });
    return Object.values(by).map(p => { const before = p.cut.reduce((a, g) => a + routeCost(g).c, 0), after = p.nw.reduce((a, g) => a + routeCost(g).c, 0); return Object.assign(p, { before, after, gain: before - after }); })
      .sort((a, b) => b.gain - a.gain); }

  /* ---------- chạy cả vùng: [1] → [2] → cấm tuyến không khả thi → lặp ---------- */
  function run(R, maxIter = 15) { const T0 = baseRoutes(R), k0 = new Set(T0.map(key)), ban = new Set(), iters = [];
    /* tuyến hiện nay mô phỏng đã trễ hơn P.lateTol (thường do mô phỏng chưa sát tuyến đó): tuyến mới chứa điểm của nó chỉ cần không trễ hơn */
    const hcMap = {}, lateNow = {}; T0.forEach(g => { const h = hcMap[key(g)] = headcount(g); g.forEach(i => { lateNow[i] = h.ok ? -1e9 : h.late; }); });
    const tolOf = g => Math.max(P.lateTol, ...g.map(i => lateNow[i] ?? -1e9));
    let res;
    for (let it = 0; it < maxIter; it++) { res = search(R, T0, ban); const fail = [];
      res.T.forEach(g => { const k = key(g); if (!(k in hcMap)) hcMap[k] = headcount(g, tolOf(g)); if (!k0.has(k) && !hcMap[k].ok) fail.push(g); });
      iters.push({ routes: res.T.filter(g => !k0.has(key(g))).map(g => g.slice()), banned: fail.map(g => ({ g: g.slice(), late: hcMap[key(g)].late })) });
      if (!fail.length) break; fail.forEach(g => ban.add(key(g))); }
    const T = res.T, hc = g => hcMap[key(g)] || (hcMap[key(g)] = headcount(g, tolOf(g)));
    const sum = L => L.reduce((a, g) => a + routeCost(g).c, 0), labSum = L => L.reduce((a, g) => a + hc(g).lab.c, 0);
    const N = nodes(R), real = N.reduce((a, i) => a + realCost(i), 0);
    return { R, T0, T, iters, ban: [...ban], packs: packs(T0, T), hc,
      truck: { real, base: sum(T0), plan: sum(T) }, lab: { base: labSum(T0), plan: labSum(T) }, nodes: N }; }

  return { P, VEH, REGIONS, S, run, fillOf, nodes, routeCost, realCost, headcount, simRoute, waves, cotsOf, deadline, openOf, mixLabel, key, nm, kmPt, tripKm, routeOrder,
    reset() { [TKM, RC, STC, COC, CLC, CAL].forEach(o => Object.keys(o).forEach(k => delete o[k])); SK = null; } };
}
if (typeof module !== "undefined") module.exports = { Core };
