/* D2S Core — 2 bước:
   [1] LINEHAUL: tìm cách ghép điểm thành tuyến xe + chọn cỡ xe để tiền xe thấp nhất (chỉ xét tiền, không xét giờ).
   [2] HEADCOUNT: với mỗi tuyến mới, mô phỏng người + xe ở ngày đông; chọn loại người rẻ nhất mà vẫn kịp COT (trễ ≤ P.lateTol phút).
       Tuyến không cách nào kịp → cấm → chạy lại [1]. Lặp tới khi mọi tuyến mới đều qua [2].
   Dùng được trên trình duyệt và Node: Core(D, REF) → {P, run(R), ...}. */
function Core(D, REF) {
  const S = D.S, TY = D.TY, TRP = D.T || {}, TRN = D.TN || [], GEO = D.GEO || {};
  const DAYS = D.dates.map((_, d) => d);
  /* NGÀY HỌC (chỉ ngày có dữ liệu chuyến): thông số as-is (lượt, lấp đầy, loại xe, thời gian chất/chạy…) chỉ học từ các ngày này. Mặc định mọi ngày;
     kiểm định độc lập đặt một nửa số ngày để học và chấm trên nửa còn lại */
  let FIT = null; const TD = {}; S.forEach(s => (s.tc || []).forEach((L, d) => (L || []).forEach(c => { TD[c] = d; })));
  const LHD = DAYS.filter(d => !D.lh || D.lh[d]), FD = () => FIT ? DAYS.filter(d => FIT.has(d)) : LHD, fitTrip = c => !FIT || FIT.has(TD[c]);
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
    dropSur: 0,         // ĐỀ XUẤT, chờ duyệt: xe trả nhiều SOC cộng % giá mỗi SOC thêm (bảng giá hiện không có khoản này)
    // người
    peakP: 90,         // ngày đông = phân vị này của đơn/ngày
    maxExtra: 3,       // tuyến trễ: cho thêm tối đa bấy nhiêu FTE riêng mỗi điểm để kịp COT (ưu tiên không trễ trước, chi phí sau)
    lateTol: 0,        // cho trễ COT tối đa (phút) — ưu tiên không trễ; điểm mà hiện nay đã trễ thì chỉ cần không trễ hơn
    early: 1,          // 1 = xe lấy phần đã sort và rời để kịp hạn, đơn chưa xong dồn sang COT sau · 0 = xe chờ đủ đơn của COT
    rollMax: 10,       // mỗi lượt-điểm được dồn tối đa bấy nhiêu % đơn sang COT sau (vượt thì xe phải chờ thêm, có thể trễ)
    closeMin: 5,       // xe chất dần hàng đã sort; sau khi hàng cuối sẵn cần thêm bấy nhiêu phút để chốt xe rời
    prodBase: 2000,    // năng suất sort lý tưởng: đơn/người/ngày (1 chute, 10% hàng to)
    prodHand: 2000,    // năng suất phần không sort (quét, bàn giao, xếp xe): đơn/người/ngày
    prodChute: 10,     // mỗi chute chia thêm ngoài 1: −% năng suất sort
    prodBulky: 5,      // mỗi 10 điểm % hàng to lệch khỏi 10%: −% năng suất sort
    fteH: 7,           // một người làm bao nhiêu giờ/ngày
    ftePay: 520000,    // FTE riêng: đ/người/ngày
    hubPay: 350000,    // nhóm FM Hub đi vòng: đ/người/ngày
    splitExtra: 2,     // chia điểm cho xe: được thêm tối đa bấy nhiêu xe mỗi lượt nếu cần để kịp COT (chỉ kế hoạch; tiền xe thêm cộng vào kế hoạch)
    split: 1,          // lượt đi chung bị trễ: cho các xe trong lượt chia điểm (giữ tuyến & số xe)
    teamLate: 0,       // FTE chung: 1 = mỗi điểm được trễ tới lateTol (hoặc như khi dùng FTE riêng nếu đã trễ hơn); 0 = nhóm chung không được thêm trễ
    minTeam: 2,        // FTE chung: số điểm tối thiểu của một nhóm (1 = cho phép nhóm 1 điểm theo giá hub)
    hubKm: 15,         // nhóm FM Hub: các điểm cách nhau tối đa (km)
    hubSpd: 40,        // nhóm FM Hub di chuyển (km/giờ)
    pps: 0,            // Rider PPS: 0 = không đưa vào model (chỉ FTE riêng & FTE chung theo nhóm FM Hub)
    ppsRate: 700,      // Rider Pay Per Scan: đ/đơn quét
    ppsSpd: 600,       // Rider quét bao nhiêu đơn/giờ (cộng vào thời gian xe đứng ở điểm)
    open: 480,         // giờ seller bắt đầu làm nếu không có dữ liệu (phút từ 0h)
    dwBin: 60,         // as-is: thời gian xe đứng học riêng theo khung giờ xe tới (phút)
    polSel: 1,         // as-is: mỗi tuyến chọn cách chọn xe khớp nhất trên ngày học (0 = luôn cố định theo tỷ lệ)
    thrOn: 1,          // as-is: lượt phụ chạy theo ngưỡng đơn (0 = theo tỷ lệ ngày chạy)
    lgMean: 1,         // as-is: số xe tách theo SOC mỗi lượt = trung bình (không làm tròn) thay vì trung vị
    vRunOn: 1,         // as-is: đơn ít hơn mức thấp nhất từng có xe thì khả năng có xe giảm theo tỷ lệ
    nbPct: 50,         // as-is: xe theo lịch = phân vị % số xe thật mỗi lượt
    nbDays: 8,         // as-is: cần ≥ ngày học để được chọn kiểu xe theo lịch
    betaAvg: 1,        // as-is: sức chở tính theo tỷ lệ hàng to bình quân của điểm (ngày học), không theo từng ngày
    forceNew: 0,       // thí nghiệm: coi mọi tuyến là tuyến mới (đo phần tiết kiệm "ảo" do đổi cách tính)
    newPen: 0,         // % cộng thêm vào tiền xe tuyến mới (thận trọng); thí nghiệm ghép/tách: 8–19%
    socGrp: 1,         // đơn theo SOC: mỗi lượt chia đơn theo nhóm SOC đích học từ chuyến thật (xe theo từng nhóm); 0 = chia đều cho số xe tách trung bình
    socSim: 1,         // đơn theo SOC: mô phỏng giờ tách xe theo nhóm SOC đích (nhóm có mặt ≥ socP % ngày lượt chạy)
    socP: 50,          // mô phỏng giờ: nhóm SOC đích có mặt ≥ % ngày lượt chạy thì có xe riêng; nhóm hiếm dồn vào nhóm chính của điểm
    socSt: 1,          // người sort: số SOC phải chia = số SOC nhận ≥ socMin % đơn của điểm (theo chuyến thật); 0 = theo bảng luồng
    socMin: 5,         // % đơn tối thiểu để một SOC tính là phải chia riêng
    calFac: 1,         // as-is: hệ số chuyến & giá theo tuyến học từ ngày học (0 = tắt)
    coMin: 30,         // as-is: hai điểm đi chung ≥ % số chuyến (của điểm ít chuyến hơn) thì là một tuyến hiện nay
    vehMin: 10,        // as-is: loại xe chiếm ≥ % số chuyến thật của điểm mới được dùng
    vehFree: 0,        // đòn bẩy đổi loại xe: 1 = chọn mọi loại xe
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
  /* đội xe chở Q đơn ở mức lấp đầy fl. ks = tỷ lệ loại xe as-is của tuyến (null = mọi loại, đòn bẩy đổi loại xe). Cách chọn xe as-is (pol):
     0 cố định: xe "pha" theo tỷ lệ loại xe thật (sức chứa, giá bình quân), số xe làm tròn lên
     1 rẻ nhất trong các loại tuyến đang dùng
     2 vừa hàng: xe nhỏ nhất (trong các loại đang dùng) chở đủ; hàng nhiều hơn xe lớn nhất thì n xe lớn nhất + 1 xe vừa phần lẻ
     (routeDay: pol 3–5 = như 0–2 cộng XE THEO LỊCH: mỗi lượt ít nhất bằng số xe thật trung vị của lượt; sức chở = sức chở vật lý) */
  function fleet(Q, beta, R, km, fl, ks, pol) { if (Q <= 0) return { c: 0, t: 0, mix: {} }; fl = fl || P.fill / 100; let best = null;
    if (ks && !pol) { let q = 0, p = 0; for (const k in ks) { const v = VEH.find(u => u.k === k); if (!v) continue; q += ks[k] * cap(v, beta, fl); p += ks[k] * price(k, R, km); }
      if (q > 0) { const t = Math.ceil(Q / q - 1e-9); return { c: t * p, t, mix: Object.fromEntries(Object.entries(ks).map(([k, x]) => [k, t * x])) }; } }
    const one = VEH.filter(v => !ks || v.k in ks).map(v => ({ v, q: cap(v, beta, fl), p: price(v.k, R, km) }));
    if (ks && pol === 2 && one.length) { one.sort((a, b) => a.q - b.q); const L = one[one.length - 1], n = Math.floor(Q / L.q - 1e-9), rest = Q - n * L.q, u = one.find(x => x.q >= rest) || L, mix = {};
      if (n > 0) mix[L.v.k] = n; mix[u.v.k] = (mix[u.v.k] || 0) + 1; return { c: n * L.p + u.p, t: n + 1, mix }; }
    const add = (c, t, mix) => { if (!best || c < best.c - 1 || (Math.abs(c - best.c) <= 1 && t < best.t)) best = { c, t, mix }; };
    for (const m of one) { const n = Math.floor(Q / m.q - 1e-9), rest = Q - n * m.q;
      add((n + 1) * m.p, n + 1, { [m.v.k]: n + 1 });
      if (rest > 0) for (const u of one) if (u.q >= rest) { const mix = {}; if (n > 0) mix[m.v.k] = n; mix[u.v.k] = (mix[u.v.k] || 0) + 1; add(n * m.p + u.p, n + 1, mix); } }
    return best; }
  const mixLabel = mix => Object.entries(mix).filter(x => x[1] > 0).map(([k, n]) => `${Math.round(n * 10) / 10}×${k}`).join(" + ");

  const HYS = REF.HYS || {}, HY = new Set(Object.keys(HYS));
  /* ---------- COT & lượt xe từ chuyến thật ---------- */
  function lastArr(i) { const v = []; for (const d of FD()) { let mx = null; ((S[i].tc && S[i].tc[d]) || []).forEach(c => { const t = TRP[c]; if (!t) return;
    t[5].forEach(p => { if (p[1] === 0 && String(TRN[p[0]]).trim() === nm(i) && p[4] != null) mx = Math.max(mx ?? -1, p[4]); }); }); if (mx != null) v.push(mx); }
    return v.length ? pct(v, 90) : null; }
  /* giờ bàn giao cuối của seller: sheet thông tin seller > deck > giờ xe tới muộn nhất (p90) */
  const CLC = {};
  const closeOf = i => i in CLC ? CLC[i] : (CLC[i] = REF.HANDOVER[nm(i)] ?? REF.CLOSE[nm(i)] ?? lastArr(i));
  /* COT của điểm: theo vùng; COT cuối = giờ bàn giao cuối của seller. r = FMHub_received, p = FMLH_Packed (phút từ 0h) */
  const COC = {};
  /* COT có khung nhận đơn (DOP Received a → b, phút từ 0h D0; a âm = từ hôm trước) và hạn FM_LH Packed p. Vùng có ở đây thì dùng bảng này,
     không dùng COT theo deck / giờ bàn giao cuối. */
  const COTW = {
    HN: [{ a: -180, b: 840, p: 899 }, { a: 840, b: 1080, p: 1139 }, { a: 1080, b: 1260, p: 1319 }],   // 21:00 D-1→13:59 · 14:59 | 14:00→17:59 · 18:59 | 18:00→20:59 · 21:59
  };
  function cotsOf(i) { if (COC[i]) return COC[i]; const R = S[i].R; if (COTW[R]) return COC[i] = COTW[R].map(c => ({ r: c.b, p: c.p, a: c.a, b: c.b, win: 1 }));
    const L = (R === "North" && HY.has(nm(i)) ? REF.COT_NHY : (REF.COTS[R] || REF.COTS.North)).map(c => Object.assign({}, c)), cl = closeOf(i);
    if (cl != null) { const out = L.filter(c => c.p < cl); out.push({ r: cl - 60, p: cl, close: 1 }); return COC[i] = out; } return COC[i] = L; }
  /* khung giờ xe tới (P.dwBin phút) để học thời gian đứng theo giờ */
  const kArr = (i, arr) => Math.floor(arr / P.dwBin);
  const cotIdx = (i, dep) => { const L = cotsOf(i); for (let k = 0; k < L.length; k++) if (L[k].p >= dep - 45) return k; return L.length - 1; };
  /* thời gian xe đứng ở điểm = cố định + phút/đơn × đơn (hồi quy trung vị trên các lần dừng thật) */
  function fitDwell(Pt) { if (Pt.length < 6) return null; const xs = Pt.map(p => p[0]); if (Math.max(...xs) < 1.5 * Math.min(...xs)) return null; const sl = [];
    for (let a = 0; a < Pt.length; a++) for (let b = a + 1; b < Pt.length; b++) { const dx = Pt[b][0] - Pt[a][0]; if (Math.abs(dx) >= 20) sl.push((Pt[b][1] - Pt[a][1]) / dx); }
    if (!sl.length) return null; const rate = Math.max(0, med(sl)); return { fix: Math.min(90, Math.max(0, med(Pt.map(p => p[1] - rate * p[0])))), rate }; }
  /* lượt xe của điểm (mỗi COT một lượt): trung vị giờ xe tới / rời, số xe, số đơn lên; chỉ giữ COT có xe ≥ 30% số ngày */
  const STC = {};
  function waves(i) { if (i in STC) return STC[i]; const s = S[i], byC = {}, dw = [], legs = [], spt = []; let nd = 0;
    for (const d of FD()) { const st = []; ((s.tc && s.tc[d]) || []).forEach(c => { const t = TRP[c]; if (!t) return;
        t[5].forEach((p, k) => { if (p[1] !== 0 || String(TRN[p[0]]).trim() !== nm(i) || p[4] == null) return; const dep = p[5] ?? p[4];
          const soc = [...new Set(t[5].slice(k + 1).filter(q => q[1] === 2).map(q => String(TRN[q[0]]).trim()))].sort();
          st.push({ arr: p[4], dep, up: p[2] || 0, soc }); if (p[2] >= 20 && dep > p[4]) dw.push([p[2], dep - p[4], kArr(i, p[4])]); }); });
      if (!st.length) continue; nd++; const W = {};
      st.forEach(x => { const k = cotIdx(i, x.dep), w = W[k] || (W[k] = { k, d, arr: x.arr, dep: x.dep, n: 0, up: 0, ds: new Set(), gv: {} }); w.arr = Math.min(w.arr, x.arr); w.dep = Math.max(w.dep, x.dep); w.n++; w.up += x.up;
        const gk = x.soc.join("|"); w.ds.add(gk); w.gv[gk] = (w.gv[gk] || 0) + x.up; spt.push(Math.max(1, x.soc.length)); });
      Object.values(W).forEach(w => { (byC[w.k] = byC[w.k] || []).push(w); legs.push(w.ds.size); }); }
    if (!nd) return STC[i] = null;
    /* lượt phụ chạy theo ngưỡng đơn: ngày điểm có đơn ≥ thr thì lượt chạy. Chọn thr ít ngày sai nhất trên ngày học; chỉ dùng khi sai ít hơn hẳn đoán theo tỷ lệ */
    const Dv = FD().filter(d => (s.v[d] || 0) > 0), thrOf = {};
    for (const k in byC) { const ran = new Set(byC[k].map(x => x.d)), nR = Dv.filter(d => ran.has(d)).length, base = Math.min(nR, Dv.length - nR); let best = null;
      for (const th of [...new Set(Dv.map(d => s.v[d]))]) { const e = Dv.reduce((a, d) => a + (ran.has(d) !== (s.v[d] >= th) ? 1 : 0), 0); if (!best || e < best.e) best = { th, e }; }
      if (P.thrOn && best && base > 0 && best.e <= base - 2) thrOf[k] = best.th; }
    let ks = Object.keys(byC).map(Number).sort((a, b) => a - b).filter(k => byC[k].length >= 0.3 * nd || (k in thrOf && byC[k].length >= 2));
    if (!ks.length) ks = [Number(Object.keys(byC).sort((a, b) => byC[b].length - byC[a].length)[0])];
    const w = ks.map(k => ({ k, arr: med(byC[k].map(x => x.arr)), dep: med(byC[k].map(x => x.dep)), n: med(byC[k].map(x => x.n)), up: med(byC[k].map(x => x.up)) || 1 }));
    /* p: tỷ lệ ngày có đơn mà lượt này chạy; sh: phần đơn của lượt; lg: số xe tách theo SOC khi lượt chạy */
    const upAll = ks.reduce((a, k) => a + byC[k].reduce((b, x) => b + x.up, 0), 0), upD = {}; ks.forEach(k => byC[k].forEach(x => { upD[x.d] = (upD[x.d] || 0) + x.up; }));
    const nv = Math.max(nd, Dv.length);
    /* sr: phần đơn của lượt trong những ngày lượt chạy; thr: ngưỡng đơn (nếu có) */
    w.forEach(x => { const L = byC[x.k], uR = L.reduce((a, y) => a + (upD[y.d] || 0), 0); x.p = Math.min(1, L.length / nv); x.thr = thrOf[x.k] ?? null;
      x.sr = uR > 0 ? L.reduce((a, y) => a + y.up, 0) / uR : 1; x.sh = upAll > 0 ? L.reduce((a, y) => a + y.up, 0) / upAll : 1 / ks.length; x.lg = Math.max(1, P.lgMean ? L.reduce((a, y) => a + y.ds.size, 0) / L.length : Math.round(med(L.map(y => y.ds.size)))); x.nb = pct(L.map(y => y.n), P.nbPct);
      /* nhóm SOC đích của lượt (mỗi nhóm = tập SOC một xe trả): e = phần đơn của lượt đi nhóm này, pg = tỷ lệ ngày lượt chạy có xe đi nhóm này */
      const gv = {}, gd = {}, U = L.reduce((a, y) => a + y.up, 0); L.forEach(y => { for (const gk in y.gv) { gv[gk] = (gv[gk] || 0) + y.gv[gk]; gd[gk] = (gd[gk] || 0) + 1; } });
      x.gr = Object.keys(gv).map(gk => ({ key: gk, e: U > 0 ? gv[gk] / U : 1 / Object.keys(gv).length, pg: gd[gk] / L.length })).sort((a, b) => b.e - a.e); });
    /* legs: số xe tách theo SOC đích trong một lượt (trung vị); spt: số SOC trên một chuyến (xe trả nhiều SOC) */
    /* thời gian đứng theo khung giờ xe tới: cùng hệ số phút/đơn, phần cố định riêng mỗi khung (≥ 3 lần dừng) */
    const fd = fitDwell(dw), dk = {}; if (fd) dw.forEach(x => { (dk[x[2]] = dk[x[2]] || []).push(x[1] - fd.rate * x[0]); });
    const dwk = {}; for (const k in dk) if (dk[k].length >= 3) dwk[k] = Math.min(240, Math.max(0, med(dk[k])));
    /* vRun: số đơn thấp nhất trong ngày mà điểm từng có xe (ngày học) — ít hơn thì khả năng có xe giảm theo tỷ lệ */
    const ran = Dv.filter(d => ((s.tc && s.tc[d]) || []).length), vRun = ran.length ? Math.min(...ran.map(d => s.v[d])) : 0;
    return STC[i] = { w, dw: fd, dwk, vRun, nFit: Dv.length, legs: Math.max(1, Math.round(med(legs) || 1)), spt: Math.max(1, Math.round(med(spt) || 1)) }; }
  const nWaves = i => { const w = waves(i); return w ? w.w.length : 1; };
  /* lượt xe THẬT của điểm trong một ngày (theo COT): giờ tới sớm nhất, giờ rời muộn nhất, số xe, số đơn lên */
  function dayWaves(i, d) { const W = {}; ((S[i].tc && S[i].tc[d]) || []).forEach(c => { const t = TRP[c]; if (!t) return;
      t[5].forEach(p => { if (p[1] !== 0 || String(TRN[p[0]]).trim() !== nm(i) || p[4] == null) return; const dep = p[5] ?? p[4], k = cotIdx(i, dep), x = W[k] || (W[k] = { k, arr: p[4], dep, n: 0, up: 0 });
        x.arr = Math.min(x.arr, p[4]); x.dep = Math.max(x.dep, dep); x.n++; x.up += p[2] || 0; }); });
    return Object.values(W).sort((a, b) => a.k - b.k); }
  const legsOf = i => { const w = waves(i); return w ? w.legs : 1; };
  const sptOf = i => { const w = waves(i); return w ? w.spt : 1; };
  /* tốc độ xe & thời gian dừng chung (trung vị toàn mạng) cho điểm thiếu data */
  let SK = null;
  function simK() { if (SK) return SK; const r = [], f = [], v = []; S.forEach((s, i) => { const t = waves(i); if (t && t.dw) { r.push(t.dw.rate); f.push(t.dw.fix); } });
    for (const c in TRP) { if (!fitTrip(c)) continue; const t = TRP[c], st = t[5]; for (let x = 1; x < st.length; x++) { const a = st[x - 1], b = st[x], km = kmAB(geo(TRN[a[0]]), geo(TRN[b[0]]));
      if (km > 2 && a[5] != null && b[4] != null && b[4] > a[5]) v.push(km / (b[4] - a[5])); } }
    return SK = { rate: med(r) ?? 0.05, fix: med(f) ?? 15, spd: Math.min(1.2, Math.max(0.2, med(v) ?? 0.5)) }; }
  const dwell = (i, q) => { const w = waves(i), d = w && w.dw ? w.dw : simK(); return d.fix + d.rate * q; };
  /* as-is: thời gian xe đứng ở điểm khi tới lúc arr (phút từ 0h) — kể cả phần chờ hàng điển hình của lượt đó */
  const dwellAt = (i, q, arr) => { const w = waves(i); if (!w || !w.dw) return dwell(i, q); const f = w.dwk[kArr(i, arr)]; return (f ?? w.dw.fix) + w.dw.rate * q; };
  /* THỜI GIAN CHẠY từ chuyến thật: trung vị theo cặp điểm đi nối nhau, và từ điểm về SOC (≥ 3 lần); thiếu thì km ÷ tốc độ trung vị của vùng */
  let TT = null;
  function travelData() { if (TT) return TT; const ix = {}; S.forEach((s, i) => { ix[nm(i)] = i; }); const pr = {}, so = {}, sb = {}, s2 = {}, vr = {};
    for (const c in TRP) { if (!fitTrip(c)) continue; const P5 = TRP[c][5]; let pv = null;
      P5.forEach(p => { const i = p[1] === 0 ? ix[String(TRN[p[0]]).trim()] : null;
        if (p[1] === 0 && i != null) { if (pv && pv.dep != null && p[4] != null && p[4] > pv.dep) { const k = Math.min(pv.i, i) + "-" + Math.max(pv.i, i), m = p[4] - pv.dep; (pr[k] = pr[k] || []).push(m);
            const km = kmPt(pv.i, i); if (km > 2) (vr[S[i].R] = vr[S[i].R] || []).push(km / m); }
          pv = { i, dep: p[5] ?? p[4] }; }
        else if (p[1] === 2 && pv && pv.dep != null && p[4] != null && p[4] > pv.dep) { (so[pv.i] = so[pv.i] || []).push(p[4] - pv.dep); const k2 = pv.i + "|" + String(TRN[p[0]]).trim(); (s2[k2] = s2[k2] || []).push(p[4] - pv.dep); (sb[pv.i + "|" + kArr(pv.i, pv.dep)] = sb[pv.i + "|" + kArr(pv.i, pv.dep)] || []).push(p[4] - pv.dep); const km = kmSoc(pv.i); if (km > 2) (vr[S[pv.i].R] = vr[S[pv.i].R] || []).push(km / (p[4] - pv.dep)); pv = null; } }); }
    const md = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v.length >= 3).map(([k, v]) => [k, med(v)]));
    return TT = { pair: md(pr), soc: md(so), socB: md(sb), socTo: md(s2), spd: Object.fromEntries(Object.entries(vr).map(([k, v]) => [k, Math.min(1.2, Math.max(0.2, med(v)))])) }; }
  const spdR = i => travelData().spd[S[i].R] || simK().spd;
  const legMin = (i, j) => { const d = travelData().pair[Math.min(i, j) + "-" + Math.max(i, j)]; return d != null ? d : 5 + (kmPt(i, j) ?? 10) / spdR(i); };
  /* as-is: thời gian chạy về SOC khi rời điểm lúc t (theo khung giờ, ≥ 3 chuyến; thiếu thì trung vị cả ngày) */
  const toSocAt = (i, t) => { const d = travelData().socB[i + "|" + kArr(i, t)]; return d != null ? d : toSoc(i); };
  /* thời gian chạy từ điểm về đúng SOC đó (nhóm SOC của xe): trung vị chuyến thật đi thẳng (≥ 3 lần); thiếu thì km ÷ tốc độ vùng; không có toạ độ SOC thì như toSoc */
  const toSocTo = (i, soc) => { const d = travelData().socTo[i + "|" + soc]; if (d != null) return d; const a = geo(nm(i)), b = geo(soc); return a && b ? kmAB(a, b) / spdR(i) : toSoc(i); };
  const toSoc = i => { const d = travelData().soc[i]; return d != null ? d : (kmSoc(i) ?? 15) / spdR(i); };
  const openOf = i => REF.OPENT[nm(i)] ?? Math.min(P.open, (() => { const w = waves(i); return w ? Math.min(...w.w.map(x => x.arr)) - 60 : 1e9; })());
  /* hạn của một lượt = giờ Packed của COT; nếu hiện nay xe đã đi muộn hơn thì hạn = giờ đi hiện nay (không bắt tốt hơn thực tế) */
  /* hạn chỉnh tay theo điểm × COT (phút từ 0h), ưu tiên hơn mọi quy tắc trên */
  const DLOV = {}, AVOV = {};
  const dlAuto = (i, w) => { const c = cotsOf(i)[w.k]; return w.dep > c.p && !c.close ? w.dep : c.p; };
  function deadline(i, w) { const o = DLOV[nm(i)]; return o && o[w.k] != null ? o[w.k] : dlAuto(i, w); }
  /* bảng hạn của một điểm: mỗi lượt xe thật → giờ Packed của COT, giờ rời hiện nay, hạn tự tính, hạn chỉnh tay */
  const dlInfo = i => { const W = waves(i); return W ? W.w.map(w => { const c = cotsOf(i)[w.k], o = (DLOV[nm(i)] || {})[w.k];
    const q = volPk(i) * shareOf(i)(w), ao = (AVOV[nm(i)] || {})[w.k], aa = availBase(i, w, q);
    return { k: w.k, p: c.p, a: c.a, b: c.b, win: !!c.win, close: !!c.close, dep: w.dep, arr: w.arr, auto: dlAuto(i, w), ov: o ?? null, dl: o ?? dlAuto(i, w), avAuto: aa, avOv: ao ?? null, av: ao ?? aa }; }) : []; };
  const setOv = M => (name, k, v) => { if (v == null) { if (M[name]) { delete M[name][k]; if (!Object.keys(M[name]).length) delete M[name]; } } else (M[name] = M[name] || {})[k] = v; };
  const setAvail = setOv(AVOV);
  const setDeadline = (name, k, v) => { if (v == null) { if (DLOV[name]) { delete DLOV[name][k]; if (!Object.keys(DLOV[name]).length) delete DLOV[name]; } } else (DLOV[name] = DLOV[name] || {})[k] = v; };

  /* ---------- chuyến đi chung thật (để biết tuyến hiện nay) ---------- */
  let CO = null;
  const coOf = (i, j) => { if (!CO) { CO = {}; const ix = {}; S.forEach((s, k) => { ix[nm(k)] = k; });
      for (const c in TRP) { const pts = [...new Set(TRP[c][5].filter(p => p[1] === 0).map(p => ix[String(TRN[p[0]]).trim()]).filter(x => x != null))];
        for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) { const k = Math.min(pts[a], pts[b]) + "-" + Math.max(pts[a], pts[b]); CO[k] = (CO[k] || 0) + 1; } } }
    return CO[Math.min(i, j) + "-" + Math.max(i, j)] || 0; };

  /* số chuyến thật có ghé điểm (cả kỳ) */
  const NT = {}, nTrips = i => i in NT ? NT[i] : (NT[i] = new Set(DAYS.flatMap(d => (S[i].tc && S[i].tc[d]) || [])).size);

  /* ---------- điểm được tối ưu: có đơn, chạy xe riêng/ghép (T1/T2), tiền xe không do hub trả ---------- */
  const HUBPAY = new Set(REF.HUBPAY || []);
  const isNode = i => active(i).length > 0 && (S[i].tt === "T1" || S[i].tt === "T2") && !HUBPAY.has(nm(i));
  const nodes = R => S.map((_, i) => i).filter(i => S[i].R === R && isNode(i));
  /* tuyến hiện nay: cùng cụm ghép trong data, hoặc thực tế đi chung ≥ P.coMin % số chuyến của điểm ít chuyến hơn */
  const BR = {};
  /* trả bản sao: bước tìm kiếm sửa trực tiếp mảng tuyến */
  const baseRoutes = R => base0(R).map(x => x.slice());
  function base0(R) { if (BR[R]) return BR[R]; const g = {}; nodes(R).forEach(i => { const s = S[i], tg = s.tt === "T2" ? (s.cl || hubCode(s.h)) : ""; const k = tg ? "G|" + tg : "i|" + i; (g[k] = g[k] || []).push(i); });
    const L = Object.values(g), sg = L.filter(x => x.length === 1).map(x => x[0]), par = {}; const fd = i => par[i] == null || par[i] === i ? i : (par[i] = fd(par[i]));
    sg.forEach((i, a) => sg.slice(a + 1).forEach(j => { if (coOf(i, j) >= P.coMin / 100 * Math.min(nTrips(i), nTrips(j))) par[fd(j)] = fd(i); }));
    const m = {}; sg.forEach(i => { (m[fd(i)] = m[fd(i)] || []).push(i); }); return BR[R] = L.filter(x => x.length > 1).concat(Object.values(m)); }

  /* ---------- mức lấp đầy theo chuyến thật của từng điểm ----------
     x = đơn lên xe ÷ sức chứa 100% các xe thật trong ngày.
     - Ngày xe phải chạy thêm chuyến (số chuyến ≥ 1,25 × số chuyến tối thiểu): xe đã "đầy" ở mức x → lấy p90 các ngày đó (≥ 5 ngày) nếu thấp hơn P.fill.
     - Xe thật thường chở nhiều hơn sức chứa chuẩn (trung vị x > P.fill): đơn của điểm nhỏ hơn chuẩn → lấy trung vị x. */
  /* MỨC LẤP ĐẦY as-is: với mỗi tuyến hiện nay, tìm mức lấp đầy để tổng số chuyến mô hình = tổng số chuyến thật trên các ngày học.
     Điểm thiếu chuyến thật: P.fill. Tuyến mới (ghép) dùng bình quân của các điểm (grpFill) */
  const CAL = {}, POL = {}, TF = {}, CF = {};
  function fillOf(i) { if (i in CAL) return CAL[i]; CAL[i] = P.fill / 100; POL[i] = 0; TF[i] = 1; CF[i] = 1; const g = base0(S[i].R).find(x => x.includes(i)) || [i];
    const days = FD().filter(d => g.some(j => (S[j].v[d] || 0) > 0)), rT = d => g.reduce((b, j) => b + realTrips(j, d), 0), real = days.reduce((a, d) => a + rT(d), 0);
    if (real <= 0 || !days.length) return CAL[i];
    const rC = {}; days.forEach(d => { rC[d] = g.reduce((b, j) => b + realCost(j, d), 0); });
    let best = null;
    const nF = Math.min(...g.map(j => (waves(j) || {}).nFit || 0));
    for (const pol of P.vehFree ? [1] : P.polSel ? (nF >= P.nbDays ? [0, 1, 2, 3, 4, 5] : [0, 1, 2]) : [0]) { const trips = f => days.reduce((a, d) => { const x = routeDay(g, d, f, pol); return a + (x ? x.t : 0); }, 0);
      let lo = 0.05, hi = 8;
      /* xe theo lịch (pol ≥ 3): sức chở = sức chở vật lý, không chỉnh theo tổng chuyến */
      if (pol >= 3) hi = Math.max(P.fill / 100, g.reduce((a, j) => Math.max(a, fillCap(j)), 0));
      else if (trips(hi) > real) lo = hi; else if (trips(lo) < real) hi = lo; else for (let it = 0; it < 30; it++) { const m = Math.sqrt(lo * hi); if (trips(m) > real) lo = m; else hi = m; }
      /* nhiều mức lấp đầy cùng khớp (xe chưa đầy trong ngày học): lấy mức cao nhất vẫn cho cùng số chuyến, tối đa bằng sức chở vật lý */
      if (pol < 3) { const t0 = trips(hi), up = Math.max(hi, Math.min(8, g.reduce((a, j) => Math.max(a, fillCap(j)), 0)));
      if (up > hi) { if (trips(up) >= t0 - 1e-6) hi = up; else { let a = hi, b = up; for (let it = 0; it < 25; it++) { const m = Math.sqrt(a * b); if (trips(m) >= t0 - 1e-6) a = m; else b = m; } hi = a; } } }
      /* so độ khớp TỪNG NGÀY sau khi đưa tổng tiền về bằng thật (hệ số chỉnh sẽ làm việc đó) */
      const mc = days.map(d => { const x = routeDay(g, d, hi, pol); return x ? x.c : 0; }), sc = mc.reduce((a, x) => a + x, 0), k = sc > 0 ? days.reduce((a, d) => a + rC[d], 0) / sc : 1;
      const err = days.reduce((a, d, j) => a + Math.abs(mc[j] * k - rC[d]), 0);
      if (!best || err < best.err - 1) best = { f: hi, pol, err }; }
    /* phần lệch còn lại của tuyến trên ngày học → hệ số chuyến (tf) và hệ số giá (cf); P.calFac = 0 thì tắt */
    let mT = 0, mC = 0; days.forEach(d => { const x = routeDay(g, d, best.f, best.pol); if (x) { mT += x.t; mC += x.c; } });
    const rCs = days.reduce((a, d) => a + rC[d], 0), cl = (x, a, b) => Math.min(b, Math.max(a, x));
    const tf = P.calFac && mT > 0 ? cl(real / mT, 0.3, 3) : 1, cf = P.calFac && mC > 0 ? cl(rCs / (mC * tf), 0.5, 2) : 1;
    g.forEach(j => { CAL[j] = best.f; POL[j] = best.pol; TF[j] = tf; CF[j] = cf; }); return CAL[i]; }
  const polOf = i => { fillOf(i); return POL[i]; };
  /* tỷ lệ hàng to bình quân của điểm trên ngày học (tỷ lệ theo ngày trong file volume dao động mạnh, xe thật không đổi theo) */
  const BF = {}; const betaFit = i => { if (i in BF) return BF[i]; let v = 0, b = 0; for (const d of FD()) { v += S[i].v[d] || 0; b += S[i].b[d] || 0; } return BF[i] = v > 0 ? b / v : 0; };
  /* sức chở vật lý của điểm: tải cao nhất thường gặp (p95) của xe thật = đơn lên ở các điểm trong mạng ÷ sức chứa 100% của loại xe; không dưới P.fill.
     Tuyến mới (ghép) dùng min(mức đã chỉnh, sức chở vật lý) — tuyến hiện nay chưa bao giờ đầy xe thì không được coi là xe chở vô hạn */
  const FCAP = {};
  function fillCap(i) { if (i in FCAP) return FCAP[i]; const L = [], seen = new Set(); let v = 0, b = 0; for (const d of FD()) { v += S[i].v[d] || 0; b += S[i].b[d] || 0; }
    const beta = v > 0 ? b / v : 0, inS = new Set(S.map((_, k) => nm(k)));
    for (const d of FD()) ((S[i].tc && S[i].tc[d]) || []).forEach(c => { const t = TRP[c]; if (!t || seen.has(c)) return; seen.add(c);
      const vv = VEH.find(u => u.k === (TY[t[1]] === "KHAC" ? "VAN" : TY[t[1]])); if (!vv) return; let u = 0;
      t[5].forEach(p => { if (p[1] === 0 && inS.has(String(TRN[p[0]]).trim())) u += p[2] || 0; }); if (u > 0) L.push(u / cap(vv, beta, 1)); });
    return FCAP[i] = Math.max(P.fill / 100, L.length >= 3 ? pct(L, 95) : 0); }
  const isBase = g => { if (P.forceNew) return false; const b = base0(S[g[0]].R).find(x => x.includes(g[0])); return !!b && b.length === g.length && g.every(i => b.includes(i)); };
  const realTrips = (i, d) => { const tr = S[i].tr && S[i].tr[d]; return Array.isArray(tr) ? tr.reduce((a, x) => a + x, 0) : 0; };
  /* loại xe điểm đang dùng thật (≥ P.vehMin % số chuyến thật; KHAC tính là VAN). As-is chỉ chọn trong các loại này;
     đòn bẩy P.vehFree = 1 cho chọn mọi loại xe. Tuyến nhiều điểm: hợp các loại của từng điểm */
  const VU = {};
  function vehOf(i) { if (i in VU) return VU[i]; const n = {};
    for (const d of FD()) { const tv = S[i].tr && S[i].tr[d]; if (Array.isArray(tv)) tv.forEach((x, j) => { if (x > 0) { const k = TY[j] === "KHAC" ? "VAN" : TY[j]; n[k] = (n[k] || 0) + x; } }); }
    return VU[i] = Object.keys(n).length ? n : null; }
  /* as-is: tỷ lệ loại xe thật của tuyến (số chuyến theo loại, bỏ loại < P.vehMin %); null = đòn bẩy đổi loại xe bật, hoặc thiếu data */
  function vehSet(g) { if (P.vehFree) return null; const u = {}; for (const i of g) { const k = vehOf(i); if (!k) return null; for (const x in k) u[x] = (u[x] || 0) + k[x]; }
    const t = Object.values(u).reduce((a, x) => a + x, 0), m = {}; for (const x in u) if (u[x] >= P.vehMin / 100 * t) m[x] = u[x];
    const tt = Object.values(m).reduce((a, x) => a + x, 0); for (const x in m) m[x] /= tt; return m; }
  /* phần xe của tuyến: chuyến thật của điểm còn ghé hub / điểm khác ngoài tuyến thì tiền xe chia theo đơn lên;
     netOf(i, g) = trung bình trên các chuyến (ngày học) của điểm: đơn lên ở các điểm thuộc tuyến g ÷ tổng đơn lên */
  const NET = {};
  function netOf(i, g) { const gs = new Set(g.map(nm)), k = i + "|" + [...gs].sort().join("|"); if (k in NET) return NET[k]; const seen = new Set(); let a = 0, n = 0;
    for (const d of FD()) ((S[i].tc && S[i].tc[d]) || []).forEach(c => { const t = TRP[c]; if (!t || seen.has(c)) return; seen.add(c); let u = 0, all = 0;
      t[5].forEach(p => { if (p[1] === 0 || p[1] === 1) { all += p[2] || 0; if (p[1] === 0 && gs.has(String(TRN[p[0]]).trim())) u += p[2] || 0; } });
      if (all > 0) { a += u / all; n++; } });
    return NET[k] = n ? a / n : 1; }
  /* nhiều điểm chung xe: mức lấp đầy chung = bình quân theo chỗ chiếm */
  function grpFill(g, d) { if (isBase(g)) return fillOf(g[0]); let U = 0, W = 0; g.forEach(i => { const u = (S[i].v[d] - (S[i].b[d] || 0)) / 2000 + (S[i].b[d] || 0) / 700; U += u; W += u / Math.min(fillOf(i), fillCap(i)); }); return U > 0 && W > 0 ? U / W : P.fill / 100; }

  /* ---------- [1] TIỀN XE ---------- */
  /* tiền xe thật của điểm cả kỳ: số chuyến thật theo loại xe (đã chia phần nếu đi chung) × giá chuyến */
  function realCost(i, dd) { let c = 0; const km = { d0: kmSoc(i) ?? 0, dt: 0 }; for (const d of (dd == null ? DAYS : [dd])) { const tr = S[i].tr && S[i].tr[d]; if (!Array.isArray(tr)) continue;
    tr.forEach((x, j) => { if (x > 0) c += x * price(TY[j] === "KHAC" ? "VAN" : TY[j], S[i].R, km); }); } return c; }
  /* tiền xe mô hình của một tuyến trong một ngày: gom đơn các điểm, chia đều cho số lượt (COT) × số xe tách theo SOC mỗi lượt (theo chuyến thật),
     chọn đội xe rẻ nhất; xe trả nhiều SOC trên một chuyến cộng P.dropSur % giá mỗi SOC thêm */
  function routeDay(g, d, flo, pol) { const act = g.filter(i => (S[i].v[d] || 0) > 0); if (!act.length) return null;
    let N = 0, b = 0, spt = 1; const K = {};
    act.forEach(i => { const v = S[i].v[d], W = waves(i); N += v; b += S[i].b[d] || 0; spt = Math.max(spt, sptOf(i));
      /* lượt chạy hôm nay: r = 1/0 theo ngưỡng đơn, không có ngưỡng thì r = tỷ lệ ngày chạy (kỳ vọng); đơn chia theo phần đơn khi chạy, chuẩn hoá trong ngày */
      const L = W ? W.w : [{ k: 0, sr: 1, p: 1, lg: 1, nb: 0, thr: null }], r = L.map(x => x.thr != null ? (v >= x.thr ? 1 : 0) : x.p);
      if (!r.some(x => x > 0)) r[L.reduce((a, x, j) => x.p > L[a].p ? j : a, 0)] = 1;
      const rho = P.vRunOn && W && W.vRun > 0 ? Math.min(1, v / W.vRun) : 1; for (let j = 0; j < r.length; j++) r[j] *= rho;
      const nz = L.reduce((a, x, j) => a + r[j] * x.sr, 0) || 1;
      L.forEach((x, j) => { if (r[j] <= 0) return; const o = K[x.k] || (K[x.k] = { q: 0, p: 0, lg: 1, nb: 0, G: {} }), qx = v * r[j] * x.sr / nz; o.q += qx; o.p = Math.max(o.p, r[j]); o.lg = Math.max(o.lg, x.lg); o.nb = Math.max(o.nb, x.nb || 0);
        (x.gr && x.gr.length ? x.gr : [{ key: "", e: 1, pg: 1 }]).forEach(z => { const G = o.G[z.key] || (o.G[z.key] = { q: 0, p: 0 }); G.q += qx * z.e; G.p = Math.max(G.p, r[j] * z.pg); }); }); });
    /* mỗi lượt: khi chạy chở q ÷ p đơn, tách lg xe theo SOC, mỗi xe chọn đội xe rẻ nhất trong loại xe đang dùng; kỳ vọng theo tỷ lệ ngày lượt chạy */
    const R = S[act[0]].R, km = tripKm(act), fl = flo || (isBase(g) ? fillOf(g[0]) : grpFill(act, d)), ks = vehSet(act), pl = pol ?? polOf(act.reduce((a, i) => S[i].v[d] > S[a].v[d] ? i : a, act[0])), beta = N > 0 ? (P.betaAvg ? act.reduce((a, i) => a + S[i].v[d] * betaFit(i), 0) : b) / N : 0, mix = {}; let c = 0, t = 0, legs = 1;
    Object.values(K).forEach(o => { if (o.q <= 0 || o.p <= 0) return;
      /* đơn theo SOC: mỗi nhóm SOC đích một (vài) xe riêng, chở phần đơn của nhóm khi nhóm có mặt; xe theo lịch (pl ≥ 3): tổng xe không dưới số xe theo lịch */
      if (P.socGrp) { const Gs = Object.values(o.G).filter(G => G.q > 0 && G.p > 0); if (Gs.length) { const fs = Gs.map(G => fleet(G.q / G.p, beta, R, km, fl, ks, pl % 3)), tot = Gs.reduce((a, G, j) => a + G.p * fs[j].t, 0);
        const sc = pl >= 3 && tot > 0 ? Math.max(o.p * o.nb, tot) / tot : 1; legs = Math.max(legs, Gs.length);
        Gs.forEach((G, j) => { const w = G.p * sc; c += fs[j].c * w; t += fs[j].t * w; Object.entries(fs[j].mix).forEach(([v, n]) => { mix[v] = (mix[v] || 0) + n * w; }); }); return; } }
      const f = fleet(o.q / o.p / o.lg, beta, R, km, fl, ks, pl % 3), w = o.p * (pl >= 3 ? Math.max(o.nb, f.t * o.lg) / Math.max(1e-9, f.t) : o.lg); c += f.c * w; t += f.t * w; legs = Math.max(legs, o.lg);
      Object.entries(f.mix).forEach(([v, n]) => { mix[v] = (mix[v] || 0) + n * w; }); });
    const sur = 1 + P.dropSur / 100 * (spt - 1), net = act.reduce((a, i) => a + S[i].v[d] * netOf(i, g), 0) / N;
    Object.keys(mix).forEach(v => { mix[v] *= net; });
    /* hệ số chỉnh của tuyến hiện nay (chuyến × giá); tuyến ghép mới chỉ mang hệ số giá của các điểm (bình quân theo đơn) */
    let tf = 1, cf = 1; if (pol == null) { if (isBase(g)) { fillOf(g[0]); tf = TF[g[0]]; cf = CF[g[0]]; } else { cf = act.reduce((a, i) => { fillOf(i); return a + S[i].v[d] * CF[i]; }, 0) / N;
      /* phụ phí thận trọng cho tuyến mới: thí nghiệm ghép/tách cho thấy model đoán tuyến chưa từng chạy rẻ hơn thật 8–19% */
      cf *= 1 + P.newPen / 100; } }
    Object.keys(mix).forEach(v => { mix[v] *= tf; });
    return { c: c * sur * net * tf * cf, t: t * net * tf, net, mix, N, mt: Object.keys(K).length, legs, tf, cf }; }
  const RC = {};
  function routeCost(g) { const k = key(g); if (k in RC) return RC[k]; let c = 0, t = 0; const mix = {}, nd = new Set();
    for (const d of LHD) { const x = routeDay(g, d); if (!x) continue; c += x.c; t += x.t; nd.add(d); Object.entries(x.mix).forEach(([v, n]) => { mix[v] = (mix[v] || 0) + n; }); }
    Object.keys(mix).forEach(v => { mix[v] /= Math.max(1, nd.size); }); return RC[k] = { c, t: t / Math.max(1, nd.size), mix, days: nd.size }; }
  /* hai điểm được phép đi chung xe: chung SOC, chạy trùng đủ ngày, không quá xa, giờ xe lượt đầu không lệch quá — hoặc đã đi chung chuyến thật */
  function pairOk(i, j) { if (coOf(i, j) >= 3) return true; if (!(S[i].soc || []).some(x => (S[j].soc || []).includes(x))) return false;
    const a = active(i), b = new Set(active(j)), both = a.filter(d => b.has(d)).length; if (both < Math.max(3, 0.5 * Math.min(a.length, b.size))) return false;
    const km = kmPt(i, j); if (P.maxKm > 0 && km != null && km > P.maxKm) return false;
    if (P.cotGap > 0) { const wi = waves(i), wj = waves(j); if (wi && wj && Math.abs(wi.w[0].arr - wj.w[0].arr) > P.cotGap) return false; }
    return true; }
  /* tìm kiếm cục bộ: lặp lại bước có lợi nhất trong (ghép 2 tuyến · chuyển 1 điểm · tách 1 điểm · đổi chéo 2 điểm) tới khi không còn bước lợi ≥ P.minGain.
     ban: tập tuyến bị bước [2] loại → không được tạo lại */
  function search(R, T0, ban) { const N = nodes(R), cst = g => g.length ? routeCost(g).c : 0, nb = {}, okG = g => !ban.some(b => b.every(i => g.includes(i)));   // tuyến chứa trọn một tuyến đã bị loại cũng bị loại
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
  /* NĂNG SUẤT theo đặc điểm seller (giống model cũ):
     - ch = số chute seller chia (theo luồng D2S của vùng), st = số SOC xe chở tới
     - chia 1 chute → không sort, chỉ quét + bàn giao + xếp xe; nhiều chute → sort hàng nhỏ; xe tới ≥ 2 SOC → sort cả hàng to
     - năng suất sort = prodBase × (1 − prodChute % mỗi chute ngoài 1) × (1 − prodBulky % mỗi 10 điểm % hàng to lệch khỏi 10%)
     - phần không sort theo prodHand. Chưa có: % đủ diện tích, bàn giao pallet (mặc định đủ, bàn giao lẻ) */
  const FLOW = { HCM: [3, 3], SSP: [2, 2], SE: [4, 3], SW1: [4, 3], SW2: [4, 1], DNCH: [1, 1], NHY: [4, 1], NOT: [3, 1], HN: [3, 3], SPCHN: [3, 3] };
  function flowOf(s) { const p = +((s.h || "").match(/^(\d+)-/) || [])[1];
    if (s.R === "HCM") return "HCM"; if (s.R === "DNCH") return "DNCH"; if (s.R === "HN") return s.k === "SPC" ? "SPCHN" : "HN";
    if (s.R === "North") return HYS[s.n.trim()] ? "NHY" : "NOT"; if (s.R === "South") return p === 70 ? "SW1" : p > 70 ? "SW2" : "SE"; return "NOT"; }
  /* phần đơn của điểm về từng SOC (chuyến thật, ngày học): đơn lên ở điểm chia cho các SOC xe trả sau điểm theo đơn xuống ở mỗi SOC
     (SOC ghi xuống 0 → chia đều cho các SOC xe ghé sau điểm) */
  const SSH = {};
  function socShare(i) { if (i in SSH) return SSH[i]; const o = {}, seen = new Set(); let U = 0;
    for (const d of FD()) ((S[i].tc && S[i].tc[d]) || []).forEach(c => { const t = TRP[c]; if (!t || seen.has(c)) return; seen.add(c);
      t[5].forEach((p, k) => { if (p[1] !== 0 || String(TRN[p[0]]).trim() !== nm(i) || !(p[2] > 0)) return; const so = t[5].slice(k + 1).filter(q => q[1] === 2); if (!so.length) return;
        const dn = so.reduce((a, q) => a + (q[3] || 0), 0); so.forEach(q => { const n = String(TRN[q[0]]).trim(); o[n] = (o[n] || 0) + p[2] * (dn > 0 ? (q[3] || 0) / dn : 1 / so.length); }); U += p[2]; }); });
    for (const n in o) o[n] /= U || 1; return SSH[i] = o; }
  /* số SOC điểm phải chia riêng: SOC nhận ≥ P.socMin % đơn (ít nhất 1); null = thiếu chuyến thật */
  const socN = i => { const o = socShare(i), n = Object.values(o).filter(x => x >= P.socMin / 100).length; return Object.keys(o).length ? Math.max(1, n) : null; };
  function chSt(i) { const s = S[i], f = flowOf(s), sn = P.socSt ? socN(i) : null; if (f === "HCM") { const n = sn ?? Math.max(1, Math.round(s.nsMed || s.ns || 1)); return { ch: n, st: n }; }
    let [ch, st] = FLOW[f]; if (sn != null) st = sn; const y = HYS[nm(i)]; if (f === "NHY" && y && !y[0] && !y[1]) ch -= 1; return { ch, st }; }
  const stepF = (ideal, act, step, rate) => 1 - Math.round(Math.abs(ideal - act) / step) * rate / 100;
  const volPk = i => pct(active(i).map(d => S[i].v[d]), P.peakP);
  const betaOf = i => { let v = 0, b = 0; active(i).forEach(d => { v += S[i].v[d]; b += S[i].b[d] || 0; }); return v ? b / v : 0; };
  /* người-ngày cho mỗi đơn của điểm = phần phải sort ÷ năng suất sort + phần không sort ÷ năng suất bàn giao */
  const PW = {};
  function work(i) { if (i in PW) return PW[i]; const { ch, st } = chSt(i), beta = betaOf(i), sm = ch > 1 ? 1 : 0, bg = Math.min(ch, st) > 1 ? 1 : 0;
    const sv = (1 - beta) * sm + beta * bg, bp = sv > 0 ? beta * bg / sv * 100 : 0;
    const prod = Math.max(1, P.prodBase * stepF(1, ch, 1, P.prodChute) * stepF(10, bp, 10, P.prodBulky));
    return PW[i] = { w: sv / prod + (1 - sv) / P.prodHand, prod, ch, st, sort: sm ? (bg ? "sort cả hàng to" : "sort hàng nhỏ") : "không sort" }; }
  const fteN = i => Math.max(1, Math.ceil(volPk(i) * work(i).w - 1e-9));            // FTE riêng: đủ khối việc ngày đông
  const durMin = (i, q, n) => q * work(i).w * P.fteH * 60 / n;                      // phút để n người làm q đơn của điểm i
  const travel = (i, j) => i === j ? 0 : (kmPt(i, j) ?? P.hubKm) / P.hubSpd * 60;   // nhóm hub đi giữa 2 điểm (phút)
  /* hàng của một lượt có từ: giờ xe thật tới − thời gian FTE riêng làm phần đó (không trước giờ seller mở) → FTE riêng tái hiện đúng giờ hiện nay */
  /* giờ có hàng chỉnh tay theo điểm × COT (seller báo kho có hàng từ giờ đó) ưu tiên hơn giờ suy từ chuyến xe thật */
  const availAuto = (i, w, q) => Math.max(openOf(i), w.arr - durMin(i, q, fteN(i)));
  /* có hàng từ: chỉnh tay > khung nhận đơn của COT (không trước giờ seller mở) > suy từ giờ xe thật tới */
  const availBase = (i, w, q) => { const c = cotsOf(i)[w.k]; return c && c.win ? Math.max(openOf(i), c.a) : availAuto(i, w, q); };
  const avail = (i, w, q) => { const o = AVOV[nm(i)]; return o && o[w.k] != null ? o[w.k] : availBase(i, w, q); };
  /* lượt chỉ sort xong khi đã hết khung nhận đơn (đơn cuối tới lúc b) */
  const winEnd = (i, w) => { const o = AVOV[nm(i)]; if (o && o[w.k] != null) return -1e9; const c = cotsOf(i)[w.k]; return c && c.win ? c.b : -1e9; };
  /* FTE riêng / seller (PPS) làm lần lượt theo COT: lượt sau bắt đầu khi có hàng và đã xong lượt trước */
  /* số FTE riêng tại điểm: chỉnh tay > theo khối việc ngày đông */
  const HCOV = {};
  const fteBase = i => HCOV[nm(i)] ?? fteN(i);
  const nOf = (i, a) => a && a.n ? a.n : fteBase(i);
  /* người ở điểm làm lần lượt theo COT; n người (mặc định FTE riêng của điểm); PPS: seller tự đóng như hiện nay */
  /* đơn của điểm: ngày đông (day = null) hoặc đúng ngày day */
  const qOf = (i, day) => day == null ? volPk(i) : (S[i].v[day] || 0);
  function ownReady(i, n, day) { n = n || fteN(i); const W = waves(i), sh = shareOf(i), o = {}; let t = -1e9;
    W.w.slice().sort((a, b) => a.k - b.k).forEach(w => { const q = qOf(i, day) * sh(w), st = Math.max(avail(i, w, q), t); t = Math.max(winEnd(i, w), st + durMin(i, q, n)); o[w.k] = { st, end: t }; }); return o; }
  const shareOf = i => { const W = waves(i); const tot = W ? W.w.reduce((a, w) => a + w.up, 0) : 1; return w => w.up / tot; };
  /* các lượt của tuyến: một lượt cho mỗi COT (theo chỉ số COT của từng điểm), giờ lượt = giờ xe thật tới sớm nhất trong các điểm.
     (Trước đây gắn lượt theo giờ gần nhất → hai lượt của cùng một điểm có thể rơi vào một lượt tuyến và mất hạn COT sớm.) */
  function slotsOf(g) { const T = g.map(waves); if (T.some(t => !t)) return null; const by = {};
    g.forEach((i, k) => { const sh = shareOf(i); T[k].w.forEach(w => { const s = by[w.k] || (by[w.k] = { k: w.k, t: w.arr, m: [] }); s.t = Math.min(s.t, w.arr); s.m.push({ i, w, sh: sh(w) }); }); });
    return Object.values(by).sort((a, b) => a.t - b.t); }
  const perms = a => a.length <= 1 ? [a] : a.flatMap((x, k) => perms(a.slice(0, k).concat(a.slice(k + 1))).map(p => [x].concat(p)));
  /* NHÓM FM HUB: n người đi lần lượt các lượt-điểm theo hạn COT sớm nhất trước; sang điểm khác mất km ÷ hubSpd */
  /* nhóm FTE chung làm lần lượt theo hạn COT sớm nhất; hold[i|k] = giờ xe rời điểm i lượt k: nhóm phải Ở LẠI tới lúc đó (có người mới bàn giao / lên hàng được), rồi mới đi tiếp */
  function teamReady(pts, n, hold) { const tasks = [];
    pts.forEach(i => { const W = waves(i); if (!W) return; const sh = shareOf(i); W.w.forEach(w => { const q = volPk(i) * sh(w); tasks.push({ i, w, q, av: avail(i, w, q), be: winEnd(i, w), dl: deadline(i, w) }); }); });
    tasks.sort((a, b) => a.dl - b.dl || a.av - b.av); let t = -1e9, at = null; const rd = {}, rs = {}, seg = [];
    tasks.forEach(x => { const kk = x.i + "|" + x.w.k, from = at, leave = t, st = at == null ? x.av : Math.max(x.av, t + travel(at, x.i)), end = Math.max(x.be, st + durMin(x.i, x.q, n));
      const out = Math.max(end, hold && hold[kk] != null ? hold[kk] : end); at = x.i; rd[kk] = end; rs[kk] = st; t = out;
      seg.push({ i: x.i, k: x.w.k, from, leave, av: x.av, start: st, end, hold: out, q: x.q }); });
    return { rd, rs, seg }; }
  /* mô phỏng ngày đông của tuyến g theo cách dùng người A[i] = {m: "F" | "P" | "H", team}
     F (FTE riêng): hàng sẵn như hiện nay · P (Rider PPS): seller tự đóng như hiện nay, rider quét lúc giao → cộng thời gian quét vào xe đứng
     H (nhóm FM Hub): hàng sẵn khi nhóm làm xong lượt đó
     xe tới điểm đầu lúc hàng sẵn, chờ hàng ở điểm sau; trễ = giờ xe rời điểm − hạn COT của lượt */
  /* giờ xe tới điểm đầu chỉnh tay theo tuyến × COT (khóa = tên các điểm của tuyến) */
  const TROV = {}, rkey = g => g.map(nm).sort().join(" | ");
  const setTruck = (rk, k, v) => { if (v == null) { if (TROV[rk]) { delete TROV[rk][k]; if (!Object.keys(TROV[rk]).length) delete TROV[rk]; } } else (TROV[rk] = TROV[rk] || {})[k] = v; };
  let XTRA = true;   // được thêm xe khi chia điểm (kế hoạch); bản hiện nay thì không
  function simRoute(g, A, order, day) { const sl = slotsOf(g); if (!sl) return null; const tov = TROV[rkey(g)] || {}; const R = S[g[0]].R, rows = []; let late = -1e9;
    for (const s of sl) { const q = {}, w = {}; s.m.forEach(x => { q[x.i] = (q[x.i] || 0) + qOf(x.i, day) * x.sh; w[x.i] = x.w; });
      if (!g.some(i => q[i] > 0)) continue;
      const inS = g.filter(i => q[i] > 0), Q = inS.reduce((a, i) => a + q[i], 0), beta = Q ? inS.reduce((a, i) => a + q[i] * betaOf(i), 0) / Q : 0;
      const nTr = Math.max(1, fleet(Q, beta, R, tripKm(inS), Math.min(...inS.map(fillOf)), vehSet(inS)).t);
      const own = {}, ow = i => (own[i] || (own[i] = ownReady(i, A[i].m === "F" ? nOf(i, A[i]) : fteN(i), day)))[w[i].k];
      const ready = i => A[i].m === "H" ? A[i].team.rd[i + "|" + w[i].k] : ow(i).end, sortSt = i => A[i].m === "H" ? A[i].team.rs[i + "|" + w[i].k] : ow(i).st;
      /* XE CHẤT DẦN: tới nơi là chất phần đã sort (không trước lúc bắt đầu sort); rời khi chất xong cả lượt và đã qua lúc hàng cuối sẵn + closeMin.
         Điểm đầu: mặc định xe tới vừa đủ sớm để chất xong đúng lúc hàng cuối sẵn + closeMin */
      /* số đơn đã sort xong tại điểm i tới giờ t (đơn về dần theo khung / về một lần; người sort theo năng suất) */
      const cl01 = x => Math.min(1, Math.max(0, x));
      const sortedAt = (i, t) => { const rd = ready(i); if (t >= rd) return q[i]; const c = cotsOf(i)[w[i].k], ov = (AVOV[nm(i)] || {})[w[i].k];
        const Aq = ov != null ? (t >= ov ? q[i] : 0) : c && c.win ? q[i] * cl01((t - c.a) / Math.max(1, c.b - c.a)) : (t >= avail(i, w[i], q[i]) ? q[i] : 0);
        const s0 = sortSt(i), Sx = A[i].m === "H" ? q[i] * cl01((t - s0) / Math.max(1, rd - s0)) : (t - s0) * q[i] / Math.max(0.1, durMin(i, q[i], A[i].m === "F" ? nOf(i, A[i]) : fteN(i)));
        return Math.max(0, Math.min(Aq, Sx)); };
      /* giờ sớm nhất đã sort đủ (1 − rollMax%) đơn của lượt */
      const TR = {}, tRoll = i => i in TR ? TR[i] : (TR[i] = tRoll0(i)), tRoll0 = i => { const need = q[i] * (1 - P.rollMax / 100); let lo = sortSt(i), hi = ready(i); if (sortedAt(i, lo) >= need) return lo;
        for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (sortedAt(i, m) >= need) hi = m; else lo = m; } return hi; };
      /* nT = số xe chạy chung lịch qua các điểm pts (mặc định cả lượt); đơn mỗi xe = q / nT */
      /* FR: phần đơn của điểm đi nhóm SOC đang chạy (null = cả lượt); GK: khoá nhóm cho bộ nhớ thời gian đứng */
      let FR = null, GK = ""; const qf = i => FR ? q[i] * FR[i] : q[i];
      const DW = {}, run0 = (pts, a0, nT = nTr) => { let t = null, prev = null, lt = -1e9; const st = [];
        const dwOf = i => DW[i + "|" + nT + "|" + GK] ?? (DW[i + "|" + nT + "|" + GK] = dwell(i, qf(i) / nT) + (A[i].m === "P" ? qf(i) / nT / (P.ppsSpd / 60) : 0));
        /* XE ĐI SỚM: giờ rời muộn nhất ở mỗi điểm để mọi điểm sau vẫn kịp hạn (tính ngược từ điểm cuối) */
        const LD = []; for (let x = pts.length - 1; x >= 0; x--) { const i = pts[x], own = Math.max(deadline(i, w[i]), tRoll(i) + P.closeMin);   // điểm không thể kịp thì không ép điểm trước đi sớm vì nó
          LD[x] = x === pts.length - 1 ? own : Math.min(own, LD[x + 1] - legMin(i, pts[x + 1]) - dwOf(pts[x + 1])); }
        pts.forEach((i, x) => { const rd = ready(i), dwq = dwOf(i), full = rd + P.closeMin, dl = deadline(i, w[i]);
          const tgt = P.early ? Math.min(full, Math.max(LD[x], tRoll(i) + P.closeMin)) : full;   // xe đi sớm: rời lúc cần để kịp, nhưng không dồn quá rollMax%
          const arr = prev == null ? (a0 ?? Math.max(sortSt(i), Math.min(rd, tgt - dwq))) : t + legMin(prev, i), ls = Math.max(arr, Math.min(rd, sortSt(i)));
          const dep = Math.max(ls + dwq, tgt), roll = P.early ? Math.max(0, q[i] - sortedAt(i, dep - P.closeMin)) * (FR ? FR[i] : 1) : 0;
          st.push({ i, k: w[i].k, q: qf(i), ready: rd, arr, ls, dep, dl, dwq, roll, late: dep - dl }); lt = Math.max(lt, dep - dl); t = dep; prev = i; }); return { st, lt, end: t }; };
      /* lùi giờ xuất phát tới muộn nhất mà không trễ thêm và không về muộn hơn: xe không phải tới sớm rồi nằm chờ đơn cuối ở điểm sau */
      const run1 = (pts, nT = nTr) => { if (tov[s.k] != null) return run0(pts, tov[s.k], nT); const x0 = run0(pts, null, nT); let best = x0, idle = 0;
        x0.st.forEach(z => { idle += Math.max(0, z.dep - z.arr - z.dwq); if (idle < 0.5) return; const x = run0(pts, x0.st[0].arr + idle, nT);
          if (x.lt <= x0.lt + 0.5 && x.end <= x0.end + 0.5 && x.st[0].arr > best.st[0].arr) best = x; });
        return best; };
      /* thứ tự ghé chọn riêng cho từng lượt: trễ ít nhất, rồi về sớm nhất (order = null) — hoặc theo thứ tự cho trước */
      const bestOf = (pts, nT) => { let b = null; for (const o of pts.length <= 5 ? perms(pts) : [routeOrder(pts)]) { const x = run1(o, nT); if (!b || x.lt < b.lt - 1e-9 || (Math.abs(x.lt - b.lt) < 1e-9 && x.end < b.end)) b = x; } return b; };
      let best = null; for (const o of order ? [order.filter(i => q[i] > 0)] : (inS.length <= 5 ? perms(inS) : [routeOrder(inS)])) { const x = run1(o); if (!best || x.lt < best.lt - 1e-9 || (Math.abs(x.lt - best.lt) < 1e-9 && x.end < best.end)) best = x; }
      /* CHIA ĐIỂM CHO XE trong lượt (P.split): lượt đi chung bị trễ thì thử mọi cách chia các điểm thành nhóm, mỗi nhóm một số xe riêng.
         Giữ nguyên tuyến (đủ các điểm) và tổng số xe; mỗi nhóm cần số xe theo đúng sức chở như khi đi chung, tổng không vượt số xe của lượt; chọn cách trễ ít nhất */
      /* CHIA ĐIỂM CHO XE trong lượt (P.split): xe đi chung bị trễ thì thử mọi cách chia các điểm thành nhóm, mỗi nhóm một số xe riêng.
         Giữ nguyên tuyến (đủ các điểm) và tổng số xe; mỗi nhóm cần số xe theo đúng sức chở như khi đi chung, tổng không vượt số xe (kế hoạch: thêm tối đa P.splitExtra xe); chọn cách trễ ít nhất */
      const splitPts = (pts, nT0, x0) => { let gp = [{ nT: nT0, x: x0 }];
        if (!(P.split && !order && tov[s.k] == null && x0.lt > 0.5 && nT0 >= 2 && pts.length >= 2 && pts.length <= 6)) return gp;
        const fl0 = Math.min(...pts.map(fillOf)), ks0 = vehSet(pts), needOf = G => { const Qg = G.reduce((a, i) => a + qf(i), 0), bg = Qg ? G.reduce((a, i) => a + qf(i) * betaOf(i), 0) / Qg : 0; return Math.max(1, fleet(Qg, bg, R, tripKm(G), fl0, ks0).t); }, NC = {};
        for (const pa of setParts(pts)) { if (pa.length < 2 || pa.length > nT0) continue; const need = pa.map(G => NC[G.join()] ?? (NC[G.join()] = needOf(G)));
          let left = nT0 - need.reduce((a, n) => a + n, 0); if (left < -(XTRA ? P.splitExtra : 0)) continue; left = Math.max(0, left);
          while (left-- > 0) { const j = need.reduce((m, n, k) => pa[k].reduce((a, i) => a + qf(i), 0) / n > pa[m].reduce((a, i) => a + qf(i), 0) / need[m] ? k : m, 0); need[j]++; }
          const xs = pa.map((G, j) => ({ nT: need[j], x: bestOf(G, need[j]) })), lt = Math.max(...xs.map(y => y.x.lt));
          const cur = Math.max(...gp.map(y => y.x.lt)), nUse = xs.reduce((a, y) => a + y.nT, 0), nCur = gp.reduce((a, y) => a + y.nT, 0);
          if (lt < cur - 0.5 && !(cur <= 0.5) || (Math.abs(lt - cur) <= 0.5 && nUse < nCur && gp.length > 1)) gp = xs; }
        return gp; };
      /* ĐƠN THEO SOC: mỗi nhóm SOC đích (có mặt ≥ P.socP % ngày lượt chạy) có xe riêng, chở phần đơn của nhóm, ghé các điểm có hàng đi nhóm đó.
         Nhóm hiếm dồn vào các nhóm còn lại của điểm theo tỷ lệ; điểm không có nhóm đủ thường xuyên thì đi nhóm chính của điểm. Xe một nhóm bị trễ thì chia điểm như trên */
      const SG = {}; if (P.socSim) inS.forEach(i => { const gr = (w[i].gr || []).filter(z => z.e > 0); if (!gr.length) return; let use = gr.filter(z => z.pg >= P.socP / 100); if (!use.length) use = [gr[0]];
        const z0 = use.reduce((a, z) => a + z.e, 0); use.forEach(z => { const o = SG[z.key] || (SG[z.key] = { pts: [], fr: {} }); o.pts.push(i); o.fr[i] = z.e / z0; }); });
      const sgs = Object.entries(SG); let grp, base;
      if (sgs.length > 1 && inS.every(i => sgs.some(([, o]) => o.fr[i] > 0))) { grp = []; base = 0;
        sgs.forEach(([key, o]) => { FR = o.fr; GK = key; const pts = order ? order.filter(i => o.fr[i] > 0 && q[i] > 0) : o.pts, Qg = pts.reduce((a, i) => a + qf(i), 0), bg = Qg ? pts.reduce((a, i) => a + qf(i) * betaOf(i), 0) / Qg : 0;
          const nT = Math.max(1, fleet(Qg, bg, R, tripKm(pts), Math.min(...pts.map(fillOf)), vehSet(pts)).t), x = order ? run1(pts, nT) : bestOf(pts, nT); base += nT;
          splitPts(pts, nT, x).forEach(y => grp.push(Object.assign(y, { soc: key }))); });
        FR = null; GK = ""; }
      else { base = nTr; grp = splitPts(inS, nTr, best); }
      const used = grp.reduce((a, y) => a + y.nT, 0);
      grp.forEach((y, j) => { late = Math.max(late, y.x.lt); rows.push({ t: s.t, k: s.k, nTr: y.nT, st: y.x.st, grp: grp.length > 1 ? j + 1 : 0, of: grp.length, extra: j === 0 ? Math.max(0, used - base) : 0, base, soc: y.soc ?? null }); }); }
    return { rows, late }; }
  /* mọi cách chia tập điểm thành các nhóm khác rỗng (≤ 6 điểm → tối đa 203 cách) */
  function setParts(a) { if (!a.length) return [[]]; const [h, ...t] = a, out = [];
    setParts(t).forEach(p => { p.forEach((G, k) => out.push(p.map((H, j) => j === k ? [h, ...H] : H))); out.push([[h], ...p]); }); return out; }
  /* mỗi lượt tự chọn thứ tự ghé tốt nhất */
  function routeEval(g, A) { const r = simRoute(g, A, null); if (!r) return null; return { order: r.rows[0] ? r.rows[0].st.map(z => z.i) : g, sim: r, late: r.late }; }
  const runD = i => active(i).length;
  const ppsCost = i => active(i).reduce((a, d) => a + S[i].v[d], 0) * P.ppsRate;
  const fCost = (i, n) => (n || fteBase(i)) * P.ftePay * runD(i);
  /* [2a] từng tuyến: FTE riêng ở mọi điểm (P.pps = 1 thì thử thêm mọi tổ hợp FTE riêng / PPS), chọn rẻ nhất mà trễ ≤ tol; không có thì tuyến không khả thi */
  const costA = (g, A) => g.reduce((a, i) => a + (A[i].m === "P" ? ppsCost(i) : fCost(i, A[i].n)), 0);
  function routeBest(g, tol, noExtra) { let best = null; const all = [];
    const better = x => !best || (x.ok && (!best.ok || x.c < best.c)) || (!x.ok && !best.ok && x.late < best.late);
    for (let m = 0; m < (P.pps ? 1 << g.length : 1); m++) { if (g.some((i, k) => (m >> k) & 1 && HCOV[nm(i)] != null)) continue;   // điểm có số FTE chỉnh tay: luôn FTE riêng
      const A = Object.fromEntries(g.map((i, k) => [i, (m >> k) & 1 ? { m: "P" } : { m: "F", n: fteBase(i) }])), e = routeEval(g, A);
      if (!e) return { ok: true, nodata: true, A: Object.fromEntries(g.map(i => [i, { m: "F", n: fteBase(i) }])), late: 0, tol };
      const x = { ok: e.late <= tol, A, late: e.late, c: costA(g, A), tol }; all.push(x); if (better(x)) best = x; }
    /* không cách nào kịp: thêm dần FTE riêng (mỗi lần 1 người, ở điểm giúp giảm trễ nhiều nhất), tối đa P.maxExtra người/điểm, thử từ 3 cách trễ ít nhất */
    /* ưu tiên không trễ: còn trễ (> 0) thì thử thêm người kể cả khi đã nằm trong mức cho phép */
    if (best.late > 0.5 && P.maxExtra > 0 && !noExtra) all.sort((a, b) => a.late - b.late).slice(0, 3).forEach(x0 => { let A = x0.A, late = x0.late;
      for (let it = 0; it < P.maxExtra * g.length && late > 0.5; it++) { let bx = null;
        g.forEach(i => { if (A[i].m !== "F" || A[i].n >= fteBase(i) + P.maxExtra) return; const A2 = Object.assign({}, A, { [i]: { m: "F", n: A[i].n + 1 } }), e = routeEval(g, A2);
          if (e.late < late - 0.5 && (!bx || e.late < bx.late)) bx = { A: A2, late: e.late }; });
        if (!bx) break; A = bx.A; late = bx.late; }
      const x = { ok: late <= tol, A, late, c: costA(g, A), tol, extra: true }; if (x.ok && (!best.ok || x.late < best.late - 0.5) || better(x)) best = x; });
    return best; }
  /* [2b] cả vùng: bắt đầu từ kết quả [2a], gom dần điểm thành NHÓM FM HUB (cùng hub, mọi cặp cách nhau ≤ hubKm) nếu rẻ hơn
     và mọi tuyến xe bị ảnh hưởng vẫn kịp (không trễ hơn mức cho phép, hoặc không trễ hơn trước nếu vốn đã trễ) */
  function assign(T, tolOf, isBase) { const A = {}, routeOf = {}, base = {};
    T.forEach(g => { const b = routeBest(g, tolOf(g), isBase); g.forEach(i => { A[i] = Object.assign({}, b.A[i]); routeOf[i] = g; }); base[key(g)] = b; });
    const lateOf = (g, A2) => { const e = routeEval(g, A2); return e ? e.late : -1e9; }, lim = {}; T.forEach(g => { lim[key(g)] = Math.max(tolOf(g), lateOf(g, A)); });
    /* nhận nhóm FTE chung khi KHÔNG điểm nào (trên mọi tuyến bị ảnh hưởng) trễ hơn mức cho phép của chính điểm đó:
       P.teamLate = 1 → max(P.lateTol, trễ khi dùng FTE riêng); 0 → max(0, trễ khi dùng FTE riêng) (nhóm chung không được thêm trễ).
       Không dùng khoảng dư "tuyến hiện nay đã trễ" của cả tuyến — tránh nhóm 1 người ôm nhiều điểm rồi dồn trễ */
    const plate = (g, A2) => { const e = routeEval(g, A2), o = {}; if (e) e.sim.rows.forEach(s => s.st.forEach(z => { const k = z.i + "|" + z.k; o[k] = Math.max(o[k] ?? -1e9, z.dep - z.dl); })); return o; };
    const pl0 = {}; T.forEach(g => Object.assign(pl0, plate(g, A)));
    const okWith = (pts, A2) => [...new Set(pts.map(i => routeOf[i]))].every(g => { const o = plate(g, A2);
      return Object.entries(o).every(([k, v]) => v <= Math.max(P.teamLate ? P.lateTol : 0, pl0[k] ?? -1e9) + 1e-6); });
    const pc = i => A[i].m === "P" ? ppsCost(i) : A[i].m === "F" ? fCost(i, A[i].n) : 0;
    const teams = []; const tCost = t => t.n * P.hubPay * new Set(t.pts.flatMap(active)).size;
    /* nhóm FTE chung: các điểm cách nhau ≤ hubKm; số người nhỏ nhất sao cho (1) mỗi người làm + đi lại trong ca ≤ fteH giờ ngày đông,
       (2) mọi tuyến xe vẫn kịp. why = lý do không lập được (để báo cáo) */
    /* nhóm + xe chạy đan nhau: nhóm sort → xe tới lên hàng (nhóm phải còn ở đó) → xe rời → nhóm mới đi điểm sau. Lặp tới khi giờ khớp (tối đa 6 vòng) */
    function teamSim(pts, n) { let tr = teamReady(pts, n), t, A2; const G = [...new Set(pts.map(i => routeOf[i]).filter(Boolean))];
      for (let it = 0; it < 6; it++) { t = { pts, n, rd: tr.rd, rs: tr.rs, seg: tr.seg }; A2 = Object.assign({}, A); pts.forEach(i => { A2[i] = { m: "H", team: t }; });
        const h = {}; G.forEach(g => { const e = routeEval(g, A2); if (e) e.sim.rows.forEach(s => s.st.forEach(z => { if (pts.includes(z.i)) h[z.i + "|" + z.k] = z.dep; })); });
        const tr2 = teamReady(pts, n, h), d = Math.max(0, ...Object.keys(tr2.rd).map(k => Math.abs(tr2.rd[k] - tr.rd[k]))), dh = Math.max(0, ...tr2.seg.map((sg, j) => Math.abs(sg.hold - (tr.seg[j].hold ?? sg.hold))));
        tr = tr2; if (d < 1 && dh < 1) break; }
      t = { pts, n, rd: tr.rd, rs: tr.rs, seg: tr.seg }; A2 = Object.assign({}, A); pts.forEach(i => { A2[i] = { m: "H", team: t }; }); return { t, A2, tr }; }
    function tryTeam(pts, why, before) { if (pts.some((i, a) => pts.slice(a + 1).some(j => (kmPt(i, j) ?? 1e9) > P.hubKm))) { if (why) why.r = "xa"; return null; }
      const W = pts.reduce((a, i) => a + volPk(i) * work(i).w, 0), n0 = Math.max(1, Math.ceil(W - 1e-9));
      const days = new Set(pts.flatMap(active)).size;
      for (let n = n0; n <= n0 + 6; n++) { if (before != null && before - n * P.hubPay * days <= 1) { if (why) why.r = "đắt hơn"; return null; }
        /* lọc nhanh: chưa tính việc ở lại chờ xe mà đã trễ thì chắc chắn trễ */
        const t0 = teamReady(pts, n), q = { pts, n, rd: t0.rd, rs: t0.rs, seg: t0.seg }, A0 = Object.assign({}, A); pts.forEach(i => { A0[i] = { m: "H", team: q }; }); if (!okWith(pts, A0)) continue;
        const { t, A2, tr } = teamSim(pts, n);
        const mv = tr.seg.reduce((a, sg) => a + (sg.from != null && sg.from !== sg.i ? travel(sg.from, sg.i) : 0), 0);
        if (W * P.fteH * 60 / n + mv > P.fteH * 60 + 1e-6) continue;
        if (okWith(pts, A2)) { t.c = tCost(t); t.mv = mv; return t; } } if (why) why.r = "trễ"; return null; }
    const apply = (t, old) => { old.forEach(o => teams.splice(teams.indexOf(o), 1)); t.hub = S[t.pts[0]].h; teams.push(t); t.pts.forEach(i => { A[i] = { m: "H", team: t }; }); };
    const byHub = {}, byHubAll = {}; Object.keys(A).map(Number).filter(i => waves(i) && S[i].h).forEach(i => { (byHubAll[S[i].h] = byHubAll[S[i].h] || []).push(i); if (HCOV[nm(i)] == null) (byHub[S[i].h] = byHub[S[i].h] || []).push(i); });
    const whyOf = {};
    for (const pts of Object.values(byHub)) {
      /* FTE chung = một nhóm người đi nhiều điểm: cần ≥ P.minTeam điểm (P.minTeam = 1 thì cho cả nhóm 1 điểm theo giá hub) */
      if (P.minTeam <= 1) pts.forEach(i => { const t = tryTeam([i]); if (t && t.c < pc(i) - 1) apply(t, []); });
      for (let it = 0; it < 200; it++) { let best = null; const tm = teams.filter(t => t.pts.some(i => pts.includes(i))), free = pts.filter(i => A[i].m !== "H");
        const tryM = (P2, before, old) => { const w = {}, t = tryTeam(P2, w, before); if (t && before - t.c > 1 && (!best || before - t.c > best.g)) best = { g: before - t.c, t, old };
          const r = t ? (before - t.c > 1 ? null : "đắt hơn") : w.r; if (r) P2.forEach(i => { if (A[i].m !== "H") (whyOf[i] = whyOf[i] || {})[r] = (whyOf[i][r] || 0) + 1; }); };
        tm.forEach((a, x) => { tm.slice(x + 1).forEach(b => tryM(a.pts.concat(b.pts), a.c + b.c, [a, b])); free.forEach(i => tryM(a.pts.concat([i]), a.c + pc(i), [a])); });
        /* hai điểm đang FTE riêng gom thành một nhóm mới */
        free.forEach((i, x) => free.slice(x + 1).forEach(j => tryM([i, j], pc(i) + pc(j), [])));
        if (!best) break; apply(best.t, best.old); } }
    /* chốt cuối: mọi nhóm cùng lúc — nhóm ở lại tới khi xe rời (giờ xe rời đã tính với đủ các nhóm), lặp tới khi khớp */
    const G0 = [...new Set(Object.values(routeOf))];
    for (let it = 0; it < 8 && teams.length; it++) { const h = {}; G0.forEach(g => { const e = routeEval(g, A); if (e) e.sim.rows.forEach(s => s.st.forEach(z => { h[z.i + "|" + z.k] = z.dep; })); });
      let d = 0; teams.forEach(t => { const tr = teamReady(t.pts, t.n, h); tr.seg.forEach((sg, j) => { d = Math.max(d, Math.abs(sg.hold - (t.seg[j] ? t.seg[j].hold : 0)), Math.abs(sg.end - (t.seg[j] ? t.seg[j].end : 0))); }); t.rd = tr.rd; t.rs = tr.rs; t.seg = tr.seg; });
      if (d < 1) break; }
    teams.forEach((t, k) => { t.id = k + 1; });
    /* tiền người từng điểm: nhóm hub chia theo khối việc */
    const cost = {}; Object.keys(A).map(Number).forEach(i => { cost[i] = pc(i); });
    teams.forEach(t => { const W = t.pts.reduce((a, i) => a + volPk(i) * work(i).w, 0); t.pts.forEach(i => { cost[i] = t.c * volPk(i) * work(i).w / W; }); });
    const out = {}; T.forEach(g => { const e = routeEval(g, A), b = base[key(g)];
      out[key(g)] = { ok: !e || e.late <= lim[key(g)] + 1e-6, nodata: !e, late: e ? e.late : 0, tol: tolOf(g), order: e ? e.order : routeOrder(g), sim: e ? e.sim : null,
        A: Object.fromEntries(g.map(i => [i, A[i]])), lab: { c: g.reduce((a, i) => a + cost[i], 0) } }; });
    /* báo cáo từng FM Hub có ≥ 2 điểm: điểm nào vào nhóm chung, điểm nào không và vì sao */
    const hubs = Object.entries(byHubAll).filter(([, pts]) => pts.length >= 2).map(([h, pts]) => ({ h, pts, km: Math.max(...pts.flatMap((i, a) => pts.slice(a + 1).map(j => kmPt(i, j) ?? 1e9))),
      teams: teams.filter(t => t.pts.some(i => pts.includes(i))), solo: pts.filter(i => A[i].m !== "H").map(i => ({ i, why: whyOf[i] || {} })) }));
    return { A, teams, hubs, routes: out, cost, lab: Object.values(cost).reduce((a, c) => a + c, 0) }; }
  /* nhãn cách dùng người của một điểm */
  const modeTxt = (a, i) => a.m === "H" ? `FTE chung · nhóm ${a.team.id} (${a.team.n} người)` : a.m === "P" ? "PPS" : `FTE riêng${a.n ? ` ${a.n} người` : ""}${a.n && i != null && a.n > fteBase(i) ? ` (+${a.n - fteBase(i)})` : ""}`;
  const truckOv = g => TROV[rkey(g)] || {};
  const setHC = (name, v) => { if (v == null) delete HCOV[name]; else HCOV[name] = v; };

  /* ---------- gom thay đổi thành gói: tuyến mới + tuyến cũ bị cắt, nối qua điểm chung ---------- */
  function packs(T0, T) { const k0 = new Set(T0.map(key)), k1 = new Set(T.map(key)), nw = T.filter(g => !k0.has(key(g))), cut = T0.filter(g => !k1.has(key(g)));
    const par = {}, fd = x => par[x] === x ? x : (par[x] = fd(par[x])); nw.concat(cut).forEach(g => g.forEach(i => { if (par[i] == null) par[i] = i; par[fd(i)] = fd(g[0]); }));
    const by = {}; nw.forEach(g => { (by[fd(g[0])] = by[fd(g[0])] || { nw: [], cut: [] }).nw.push(g); }); cut.forEach(g => { (by[fd(g[0])] = by[fd(g[0])] || { nw: [], cut: [] }).cut.push(g); });
    return Object.values(by).map(p => { const before = p.cut.reduce((a, g) => a + routeCost(g).c, 0), after = p.nw.reduce((a, g) => a + routeCost(g).c, 0); return Object.assign(p, { before, after, gain: before - after }); })
      .sort((a, b) => b.gain - a.gain); }

  /* ---------- chạy cả vùng: [1] → [2a] từng tuyến mới, cấm tuyến không khả thi → lặp → [2b] gom nhóm FM Hub cho cả vùng ---------- */
  function run(R, maxIter = 15) { const T0 = baseRoutes(R), k0 = new Set(T0.map(key)), ban = [], iters = [];
    /* tuyến hiện nay mô phỏng đã trễ hơn P.lateTol (thường do mô phỏng chưa sát tuyến đó): tuyến mới chứa điểm của nó chỉ cần không trễ hơn */
    XTRA = false; const rb = {}, lateNow = {}; T0.forEach(g => { const b = rb[key(g)] = routeBest(g, P.lateTol, true); g.forEach(i => { lateNow[i] = b.ok ? -1e9 : b.late; }); });
    XTRA = true; const tolOf = g => Math.max(P.lateTol, ...g.map(i => lateNow[i] ?? -1e9));
    let res;
    for (let it = 0; it < maxIter; it++) { res = search(R, T0, ban); const fail = [];
      res.T.forEach(g => { const k = key(g); if (k0.has(k)) return; if (!(k in rb)) rb[k] = routeBest(g, tolOf(g)); if (!rb[k].ok) fail.push(g); });
      iters.push({ routes: res.T.filter(g => !k0.has(key(g))).map(g => g.slice()), banned: fail.map(g => ({ g: g.slice(), late: rb[key(g)].late })) });
      if (!fail.length) break; fail.forEach(g => ban.push(g.slice())); }
    /* hết vòng mà vẫn còn tuyến mới không khả thi: tách tuyến đó về đi riêng */
    const left = res.T.filter(g => !k0.has(key(g)) && rb[key(g)] && !rb[key(g)].ok);
    const T = left.length ? res.T.filter(g => !left.includes(g)).concat(left.flatMap(g => g.map(i => [i]))) : res.T;
    if (left.length) iters.push({ routes: [], banned: left.map(g => ({ g: g.slice(), late: rb[key(g)].late })), split: true });
    XTRA = false; const L0 = assign(T0, tolOf, true); XTRA = true; const L1 = assign(T, tolOf);
    /* tiền xe thêm do chia điểm (kế hoạch): mỗi xe thêm của một lượt × giá bình quân một chuyến của tuyến × số ngày tuyến chạy */
    const xCost = g => { const h = L1.routes[key(g)]; if (!h || !h.sim) return 0; const x = h.sim.rows.reduce((a, s) => a + (s.extra || 0), 0); if (!x) return 0;
      const rc = routeCost(g); return x * (rc.t > 0 ? rc.c / (rc.t * Math.max(1, rc.days)) : 0) * rc.days; };
    const hc = g => L1.routes[key(g)] || L0.routes[key(g)];
    const sum = L => L.reduce((a, g) => a + routeCost(g).c, 0), N = nodes(R), real = N.reduce((a, i) => a + realCost(i), 0);
    return { R, T0, T, iters, ban: ban.map(key).concat(left.map(key)), packs: packs(T0, T), hc, L0, L1,
      truck: { real, base: sum(T0), plan: sum(T) + T.reduce((a, g) => a + xCost(g), 0), extra: T.reduce((a, g) => a + xCost(g), 0) }, xCost, lab: { base: L0.lab, plan: L1.lab }, nodes: N }; }

  function reset() { TT = null; [TKM, RC, STC, COC, CLC, CAL, POL, TF, CF, FCAP, BF, PW, VU, NET, BR, SSH].forEach(o => Object.keys(o).forEach(k => delete o[k])); SK = null; }
  return { toSocTo, socShare, socN, chSt, volPk, fleet, vehSet, betaOf, DATES: D.dates, LH: D.lh || null, fillCap, dwellAt, toSocAt, P, VEH, REGIONS, S, COTW, run, simRoute, fteBase, geo, dayWaves, legMin, dwell, TRP, TRN, toSoc, travelData, baseRoutes, routeDay, DAYS, active, closeOf, openOf, dlInfo, setDeadline, DLOV, setAvail, AVOV, ownReady, setHC, HCOV, fteBase, setTruck, TROV, rkey, truckOv, fillOf, nodes, routeCost, realCost, routeBest, simRoute, work, fteN, modeTxt, geo, socOf, kmSoc, simK, durMin, travel, waves, cotsOf, deadline, openOf, mixLabel, key, nm, kmPt, tripKm, routeOrder,
    reset, setFit(days) { FIT = days ? new Set(days) : null; reset(); }, get FIT() { return FIT; },
    /* đặt tay "tuyến hiện nay" của một vùng (thí nghiệm ghép/tách); null = về cách dựng từ data */
    setBase(R, L) { reset(); if (L) BR[R] = L.map(x => x.slice()); } };
}
if (typeof module !== "undefined") module.exports = { Core };
