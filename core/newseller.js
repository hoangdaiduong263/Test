/* NEW SELLER — kế hoạch cho một seller sắp nhận, dùng đúng số Core Planner đã học:
   sức chở theo cỡ xe (kích thước đơn của các seller giống), giá xe theo vùng & km, thời gian xe đứng, năng suất người, mốc COT của vùng.
   nsRef(C, REF): rút gọn số đã học (chạy lúc build, cần dữ liệu đầy đủ) · nsPlan(ref, x): kế hoạch cho hồ sơ x (chạy trên trang, không cần dữ liệu gốc) */
const NS_KS = ["VAN", "1T25", "1T9", "5T", "8T"];
const nsMed = a => { const b = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

function nsRef(C, REF) {
  const K = C.learnK(), P = C.P, sel = [], reg = {};
  /* phần đơn theo SOC đích từ chuyến thật T8–9 (luồng cũ, trước khi South gom 1 chute từ 1/10): trung vị trên các seller của vùng đi từ 2 SOC trở lên (mỗi SOC ≥ 5% đơn),
     chuẩn hoá về 100% — hồ sơ một seller nhiều SOC điển hình, không phải trung bình cả vùng (trung bình pha seller 1 SOC làm SOC phụ nhỏ giả tạo) */
  const f0 = P.flow1cOn; P.flow1cOn = 0; C.reset(); const SSH = {}, SN = {}; ["HN", "HCM", "South", "North"].forEach(R => { const N = C.nodes(R), L = [];
    N.forEach(i => { const sh = C.socShare(i), k = Object.keys(sh).filter(x => sh[x] >= 0.05); if (k.length >= 2) L.push(sh); });
    const ks = [...new Set(L.flatMap(Object.keys))], o = Object.fromEntries(ks.map(x => [x, nsMed(L.map(sh => sh[x] || 0)) || 0])), t = Object.values(o).reduce((a, b) => a + b, 0) || 1;
    for (const x in o) o[x] /= t; SSH[R] = o; SN[R] = { multi: L.length, all: N.length }; }); P.flow1cOn = f0; C.reset();
  C.S.forEach((s, i) => { const act = C.active(i); if (!act.length || !K.sizeOk(i)) return;
    sel.push({ n: C.nm(i), R: s.R, b: +C.betaOf(i).toFixed(3), c: NS_KS.map(k => Math.round(K.cap(i, k))), ado: Math.round(nsMed(act.map(d => s.v[d]))) }); });
  ["HN", "HCM", "South", "North"].forEach(R => {
    const N = C.nodes(R);
    /* mốc COT của vùng: khung bàn giao [a, b] và hạn xe rời điểm p (phút từ 0h) */
    const cots = C.COTW[R] ? C.COTW[R].map(c => ({ a: c.a, b: c.b, p: c.p })) : (REF.COTS[R] || REF.COTS.North).map((c, k, L) => ({ a: k ? L[k - 1].r : -1e9, b: c.r, p: c.p }));
    /* phần đơn mỗi lượt: trung bình trên các seller của vùng (lượt xếp vào COT đầu tiên có hạn ≥ giờ rời − 45') */
    const sh = cots.map(() => []);
    N.forEach(i => { const w = C.waves(i); if (!w) return; const o = cots.map(() => 0); w.w.forEach(x => { let k = cots.findIndex(c => c.p >= x.dep - 45); if (k < 0) k = cots.length - 1; o[k] += x.sh; }); o.forEach((v, k) => sh[k].push(v)); });
    let shM = sh.map(a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0); const t = shM.reduce((a, b) => a + b, 0) || 1; shM = shM.map(v => +(v / t).toFixed(3));
    /* SOC: mọi SOC xe D2S của vùng từng tới (chuyến thật T8–9), xếp theo phần đơn; cur = SOC theo luồng hiện nay (South từ 1/10: 1 chute về BD A Mega SOC) */
    const socs = {}, cur = {}; N.forEach(i => { const s = C.socOf(i); if (s) cur[s] = (cur[s] || 0) + 1; (C.S[i].soc || []).forEach(x => { socs[x] = (socs[x] || 0) + 1; }); });
    const kms = {}; N.forEach(i => Object.keys(socs).forEach(x => { const k = C.kmN(C.S[i].n, x); if (k != null) (kms[x] = kms[x] || []).push(k); }));
    const cs = N.map(i => C.chSt(i));
    reg[R] = { oe: !P.oeRules || P.oeRules.includes(R) ? 1 : 0, cots, sh: shM, soc: Object.keys(socs).sort((a, b) => (SSH[R][b] || 0) - (SSH[R][a] || 0)), socN: socs, socCur: cur, socMulti: SN[R], socSh: Object.fromEntries(Object.keys(socs).map(x => [x, +((SSH[R][x] || 0) * 100).toFixed(1)])), km: Object.fromEntries(Object.entries(kms).map(([s, a]) => [s, Math.round(nsMed(a))])),
      ch: Math.round(nsMed(cs.map(x => x.ch))), st: Math.round(nsMed(cs.map(x => x.st))),
      price: Object.fromEntries(NS_KS.map(k => [k, Array.from({ length: 61 }, (_, j) => Math.round(C.price(k, R, { d0: j * 5, dt: 0 })))])),
      /* đ/km đi thêm khi xe ghé thêm một điểm */
      pkm: Object.fromEntries(NS_KS.map(k => [k, Math.round(C.price(k, R, { d0: 0, dt: 1 }) - C.price(k, R, { d0: 0, dt: 0 }))])),
      /* các điểm D2S đang chạy: toạ độ, FM Hub, Sup, SOC (luồng hiện nay), phần đơn và giờ xe rời mỗi lượt, đơn/ngày, sức chở học được */
      pts: N.map(i => { const w = C.waves(i), o = cots.map(() => 0), dep = cots.map(() => null);
        if (w) w.w.forEach(x => { let k = cots.findIndex(c => c.p >= x.dep - 45); if (k < 0) k = cots.length - 1; o[k] += x.sh; dep[k] = dep[k] == null ? x.dep : Math.max(dep[k], x.dep); });
        const act = C.active(i), g = C.geo(C.nm(i)), sh = C.socShare(i);
        return { n: C.nm(i), ll: g ? [+g[0].toFixed(5), +g[1].toFixed(5)] : null, hub: C.S[i].h || "", sup: C.supOf(i) || "", lock: C.locked(i) ? 1 : 0, solo: (P.soloKeep || []).includes(C.nm(i)) ? 1 : 0,
          soc: Object.fromEntries(Object.entries(sh).filter(e => e[1] >= 0.02).map(([k, v]) => [k, +v.toFixed(3)])), sh: o.map(v => +v.toFixed(3)), dep: dep.map(v => v == null ? null : Math.round(v)),
          ado: Math.round(nsMed(act.map(d => C.S[i].v[d])) || 0), b: +C.betaOf(i).toFixed(3), c: NS_KS.map(k => Math.round(K.cap(i, k))) }; }) };
    /* tuyến của mạng theo kế hoạch Core Planner (đi riêng = tuyến 1 điểm); now = 0 nếu kế hoạch khác tuyến đang chạy */
    const run = C.run(R), kNow = new Set(run.T0.map(g => g.slice().sort().join("|")));
    reg[R].rts = run.T.map(g => ({ m: g.map(i => N.indexOf(i)).filter(j => j >= 0), now: kNow.has(g.slice().sort().join("|")) ? 1 : 0 })).filter(r => r.m.length);
  });
  const dw = C.simK();
  return { v: 1, sel, reg, dw: { fix: +dw.fix.toFixed(2), rate: +dw.rate.toFixed(4), spd: +dw.spd.toFixed(3) },
    P: { prodBase: P.prodBase, prodHand: P.prodHand, prodChute: P.prodChute, prodBulky: P.prodBulky, fteH: P.fteH, ftePay: P.ftePay, hubPay: P.hubPay, ppsRate: P.ppsRate, ppsSpd: P.ppsSpd, closeMin: P.closeMin, open: P.open, maxExtra: P.maxExtra },
    /* đơn giá FM pickup (rider + hub, đ/đơn; hàng to nhân hệ số) — cùng giả định với Seller Planner */
    fm: { rS: 669, rM: 2.2, hS: 632.2157, hM: 1.4 } };
}

/* BIẾN ĐẦU VÀO (to-be). Để trống = theo số Core Planner đã học / giả định mặc định:
   hành vi seller: socs, win, open, tail (% đơn dồn vào 60' cuối khung bàn giao), dwFix + dwRate (phút xe đứng: cố định + mỗi 100 đơn)
   hồ sơ đơn: ado, days, beta, sh · kích thước đơn: like, capOv (seller báo: đơn/xe 1T9)
   giới hạn vận hành: ch, lab ("fte" | "hub" | "pps"), osCap (số người tối đa cấp được), slackMin (phút dư tối thiểu), delay (phút seller trễ để thử)
   mặt bằng: maxK, bays, area (m² tập kết) + dens (đơn/m²): hàng một lượt vượt chỗ tập kết thì xe phải lấy nhiều đợt
   x = { R, socs: [{ s, sh (% đơn), km, fw }], win: [[từ, đến] mỗi lượt], open (giờ người bắt đầu), ado: [BAU, Mini CP, CP], days: [..], beta (0–1), sh: [phần đơn mỗi lượt], maxK, bays, ch, st, like (tên seller | null) } */
function nsPlan(ref, x) {
  const G = ref.reg[x.R], P = ref.P, beta = Math.min(1, Math.max(0, x.beta)), kmI = km => Math.min(60, Math.max(0, Math.round((+km || 0) / 5)));
  /* SOC đích của seller: % đơn và km tới từng SOC */
  /* SOC đánh dấu fw: không có xe tới, túi đi kèm xe về SOC chính (SOC nhiều đơn nhất có xe) để SOC đó chuyển tiếp nguyên túi — tiền chuyển tiếp giữa SOC không tính vào D2S */
  const all = (x.socs || []).filter(o => o.sh > 0), shS = all.reduce((a, o) => a + o.sh, 0) || 1, dir = all.filter(o => !o.fw), main = dir.slice().sort((a, b) => b.sh - a.sh)[0] || all[0];
  /* GÁN CHUTE (theo loại ngày): o.cu[t] = SOC có chute riêng ngày loại t. SOC không có chute → túi chung trong chute SOC chính, đi xe SOC chính, SOC chính chia lại.
     SOC chính luôn có chute. Không gán (o.cu thiếu): x.ch[t] SOC nhiều đơn nhất có chute */
  const rank = all.slice().sort((a, b) => b.sh - a.sh), chN = t => Array.isArray(x.ch) ? x.ch[t] ?? x.ch[0] : x.ch;
  const own = (o, t) => o === main || (Array.isArray(o.cu) ? !!o.cu[t] : rank.indexOf(o) < Math.max(1, +chN(t) || all.length));
  /* đội xe mỗi loại ngày: SOC có chute và không đánh dấu Qua SOC thì có xe riêng; còn lại đi kèm xe SOC chính (fwd = túi riêng chuyển tiếp, rsm = túi chung SOC chính chia lại) */
  const socsT = [0, 1, 2].map(t => { if (!main) return []; const fold = all.filter(o => o !== main && (o.fw || !own(o, t)));
    return all.filter(o => o === main || (!o.fw && own(o, t))).map(o => o === main ? Object.assign({}, o, { sh: o.sh + fold.reduce((a, y) => a + y.sh, 0), fwd: fold.filter(y => own(y, t)).map(y => y.s), rsm: fold.filter(y => !own(y, t)).map(y => y.s) }) : o); });
  const socs = socsT[0];
  /* phần đơn SOC chính phải chia lại mỗi loại ngày = đơn các SOC không có chute */
  const rsSh = [0, 1, 2].map(t => all.filter(o => !own(o, t)).reduce((a, o) => a + o.sh, 0) / shS);
  const km0 = socs.length ? socs.reduce((a, o) => a + o.sh * o.km, 0) / shS : 0;
  /* 1. sức chở theo cỡ xe: trung vị các seller giống (cùng vùng, % hàng to ±10 điểm), hoặc đúng một seller chọn tay; cỡ lớn không chở ít hơn cỡ nhỏ */
  let pool, how;
  if (x.like) { pool = ref.sel.filter(s => s.n === x.like); how = { k: "like", n: pool.length, name: x.like }; }
  if (!pool || !pool.length) { pool = ref.sel.filter(s => s.R === x.R && Math.abs(s.b - beta) <= 0.1); how = { k: "reg", n: pool.length };
    if (pool.length < 3) { pool = ref.sel.filter(s => Math.abs(s.b - beta) <= 0.1); how = { k: "all", n: pool.length }; }
    if (pool.length < 3) { pool = ref.sel.slice().sort((a, b) => Math.abs(a.b - beta) - Math.abs(b.b - beta)).slice(0, 5); how = { k: "near", n: pool.length }; } }
  const cap = NS_KS.map((k, j) => nsMed(pool.map(s => s.c[j])) || 0); for (let j = 1; j < cap.length; j++) cap[j] = Math.max(cap[j], cap[j - 1]);
  /* seller tự báo một xe 1T9 chở bao nhiêu đơn: quy mọi cỡ theo cùng tỷ lệ (giữ tỷ lệ giữa các cỡ đã học) */
  const capLearn = cap.slice(); if (+x.capOv > 0 && cap[2] > 0) { const f = +x.capOv / cap[2]; for (let j = 0; j < cap.length; j++) cap[j] *= f; how.ov = Math.round(+x.capOv); }
  const mi = Math.max(0, NS_KS.indexOf(x.maxK)), ksAt = km => NS_KS.slice(0, mi + 1).map((k, j) => ({ k, q: cap[j], p: G.price[k][kmI(km)] })).filter(v => v.q > 0);
  /* 2. đội xe rẻ nhất chở Q đơn: n xe loại chính + 1 xe vừa phần lẻ (như Core), không quá 100% sức chở học được */
  const fleet = (Q, km) => { if (Q <= 0) return { t: 0, c: 0, mix: {}, q: 0 }; let best = null; const ks = ksAt(km);
    const add = (c, t, mix, q) => { if (!best || c < best.c - 1 || (Math.abs(c - best.c) <= 1 && t < best.t)) best = { c, t, mix, q }; };
    for (const m of ks) { const n = Math.floor(Q / m.q - 1e-9), rest = Q - n * m.q; add((n + 1) * m.p, n + 1, { [m.k]: n + 1 }, (n + 1) * m.q);
      if (rest > 0) for (const u of ks) if (u.q >= rest) { const mix = {}; if (n > 0) mix[m.k] = n; mix[u.k] = (mix[u.k] || 0) + 1; add(n * m.p + u.p, n + 1, mix, n * m.q + u.q); } }
    return best; };
  /* 3. người: khối việc mỗi đơn theo số chute chia và số SOC xe chở tới (như Core) */
  /* số SOC phải chia riêng = SOC nhận ≥ 5% đơn (như Core, socMin) — kể cả SOC đi chuyển tiếp: túi vẫn phải chia riêng ở seller */
  /* số chute seller chia mỗi loại ngày = số SOC có chute riêng (gán ở trên); SOC không có chute → túi chung, SOC chính chia lại (như luồng 1 chute South từ 1/10) */
  const st = Math.max(1, all.filter(o => o.sh / shS >= 0.05).length), stepF = (i, a, s, r) => 1 - Math.round(Math.abs(i - a) / s) * r / 100;
  const workOf = c => { const ch = Math.max(1, c | 0 || 1), sm = ch > 1 ? 1 : 0, bg = Math.min(ch, st) > 1 ? 1 : 0, sv = (1 - beta) * sm + beta * bg, bp = sv > 0 ? beta * bg / sv * 100 : 0;
    const prod = Math.max(1, P.prodBase * stepF(1, ch, 1, P.prodChute) * stepF(10, bp, 10, P.prodBulky)); return { ch, st, prod: Math.round(prod), w: sv / prod + (1 - sv) / P.prodHand, sort: sm ? (bg ? "big" : "small") : "none" }; };
  const chs = [0, 1, 2].map(t => all.filter(o => own(o, t)).length || 1), works = chs.map(workOf);
  const fmU = (1 - beta) * (ref.fm.rS + ref.fm.hS) + beta * (ref.fm.rS * ref.fm.rM + ref.fm.hS * ref.fm.hM);
  /* khung bàn giao của seller theo lượt: x.win[k] = [từ, đến] (phút từ 0h); thiếu thì theo khung COT của vùng, không trước giờ người bắt đầu làm (x.open) */
  const open = x.open ?? P.open, cots = G.cots.map((c, k) => { const w = (x.win || [])[k]; return { p: c.p, a0: c.a, b0: c.b, a: w ? w[0] : Math.max(c.a, open), b: w ? w[1] : c.b }; });
  const bays = Math.max(1, x.bays | 0), sh = G.cots.map((_, k) => Math.max(0, +(x.sh[k] || 0))), shT = sh.reduce((a, b) => a + b, 0) || 1;
  /* 3b. SOC đích: mỗi SOC một đội xe riêng, giá theo km tới SOC đó */
  const best = (Q, t) => socsT[t || 0].map(o => { const q = Q * o.sh / shS; return Object.assign(fleet(q, o.km), { s: [o.s], fwd: o.fwd || [], rsm: o.rsm || [], Q: q }); });
  /* người tại điểm: FTE riêng (520k/ngày) · nhóm FM Hub (350k/ngày, như Core) · Rider PPS (700 đ/đơn, seller tự đóng hàng; rider quét lúc giao → cộng vào thời gian xe đứng) */
  const lab = x.lab === "hub" || x.lab === "pps" ? x.lab : "fte", pay = lab === "hub" ? P.hubPay : P.ftePay;
  const dwFix = x.dwFix != null && x.dwFix !== "" ? +x.dwFix : ref.dw.fix, dwRate = x.dwRate != null && x.dwRate !== "" ? +x.dwRate / 100 : ref.dw.rate;
  const tail = Math.min(1, Math.max(0, (+x.tail || 0) / 100)), slackMin = Math.max(0, +x.slackMin || 0), osCap = +x.osCap > 0 ? Math.round(+x.osCap) : null;
  const stage = +x.area > 0 && +x.dens > 0 ? +x.area * +x.dens : null;   // số đơn tập kết được cùng lúc
  /* khoảng cách (chim bay × 1,3 như Core khi chưa có đường bộ) và đội xe rẻ nhất cho nhiều seller chung xe: mỗi seller chiếm q ÷ sức chở của chính nó */
  const R6 = 6371, hav = (a, b) => { const r = v => v * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * R6 * Math.asin(Math.min(1, Math.sqrt(h))) * 1.3; };
  const KS2 = NS_KS.slice(0, mi + 1), capN = cap.map(Math.round);
  const fleetUx = (loads, km, dt) => { let best = null; const kmI0 = kmI(km);
    const one = KS2.map(k => { const j = NS_KS.indexOf(k); const U = loads.reduce((a, l) => a + (l.c[j] > 0 ? l.q / l.c[j] : 1e9), 0); return { k, U, p: G.price[k][kmI0] + (G.pkm[k] || 0) * (dt || 0) }; }).filter(o => o.U < 1e8);
    if (!one.length || loads.every(l => !(l.q > 0))) return { c: 0, t: 0, mix: {}, U: 0 };
    const add = (c, t, mix, U) => { if (!best || c < best.c - 1 || (Math.abs(c - best.c) <= 1 && t < best.t)) best = { c, t, mix, U }; };
    for (const m of one) { const n = Math.floor(m.U - 1e-9); add((n + 1) * m.p, n + 1, { [m.k]: n + 1 }, m.U);
      for (const u of one) { const ru = (m.U - n) * u.U / m.U; if (ru <= 1 + 1e-9) { const mix = {}; if (n > 0) mix[m.k] = n; mix[u.k] = (mix[u.k] || 0) + 1; add(n * m.p + u.p, n + 1, mix, m.U); } } }
    return best; };
  const fleetU = (loads, km, dt) => fleetUx(loads, km, dt).c;
  /* điểm D2S đang chạy được CHỌN để ghép xe (x.pick): xe chở chung ở các lượt và SOC hai bên cùng có hàng; tiền xe của seller mới = tiền xe chung − tiền xe các điểm đó chạy riêng */
  const llOk = !!(x.ll && x.ll.length === 2 && isFinite(x.ll[0]) && isFinite(x.ll[1]));
  /* ghép theo TUYẾN của kế hoạch Core: chọn một tuyến = xe chở chung với mọi điểm trên tuyến đó (điểm đang đi chung không tách ra được) */
  const rts = (G.rts || G.pts.map((_, j) => ({ m: [j], now: 1 }))).map((r, j) => ({ id: "r" + j, now: r.now, ps: r.m.map(i => G.pts[i]) }));
  const partners = llOk ? rts.filter(r => (x.pick || []).includes(r.id)).flatMap(r => r.ps.map(q => Object.assign({}, q, { rt: r.id }))).filter(q => q.ll).map(q => Object.assign(q, { km: hav(x.ll, q.ll) })).sort((a, b) => a.km - b.km) : [];
  const chainKm = ps => { let d = 0, prev = x.ll; ps.forEach(q => { d += hav(prev, q.ll); prev = q.ll; }); return d; };
  const chainP = ps => { let d = 0; ps.forEach((q, j) => { if (j) d += hav(ps[j - 1].ll, q.ll); }); return d; };
  /* tiền xe các tuyến đó đang chạy (không có seller mới): mỗi tuyến một đội xe, km đi vòng giữa các điểm của tuyến */
  const aloneOf = (ps, kmS) => { const g = {}; ps.forEach(o => (g[o.pj.rt] = g[o.pj.rt] || []).push(o)); return Object.values(g).reduce((a, L) => a + fleetU(L.map(o => ({ q: o.q, c: o.pj.c })), kmS, chainP(L.map(o => o.pj))), 0); };
  /* lịch xe chung: điểm sẵn hàng trước lấy trước; tính ngược từ điểm cuối (như Core) để xe tới điểm sau vừa lúc hàng sẵn, không tới sớm rồi nằm chờ */
  const chainRun = stops => { stops.sort((a, b) => a.rd - b.rd);
    const dzs = stops.map(z => dwFix + dwRate * z.q), trs = stops.map((z, j) => j ? hav(stops[j - 1].ll, z.ll) / ref.dw.spd : 0), LD = [];
    for (let j = stops.length - 1; j >= 0; j--) LD[j] = j === stops.length - 1 ? stops[j].rd + P.closeMin : Math.min(stops[j].dl, LD[j + 1] - dzs[j + 1] - trs[j + 1]);
    let t0 = null, sl = 1e9, me = -1e9; const tt = [];
    stops.forEach((z, j) => { const dz = dzs[j], d0 = t0 == null ? Math.max(z.rd + P.closeMin, LD[j]) : Math.max(t0 + trs[j] + dz, z.rd + P.closeMin), arr = t0 == null ? d0 - dz : t0 + trs[j];
      t0 = d0; if (z.me) me = d0; sl = Math.min(sl, z.dl - d0); tt.push({ n: z.me ? null : z.n, me: z.me || 0, rd: z.rd, arr, dw: dz, dep: d0, dl: z.dl, q: z.q, km: z.km }); });
    return { tt, sl, me }; };
  /* 4. một loại ngày: xe từng lượt, người, giờ xe rời so với hạn COT */
  const day = (X, dly, t, prt) => { prt = prt || partners; const tD = t || 0; dly = dly || 0; if (!(X > 0)) return { X: 0, W: [], hc: 0, hc0: 0, short: 0, truck: 0, lab: 0, rs: 0, soc: 0, cost: 0, fm: 0, net: 0, trucks: 0, xs: 0, worst: 1e9 }; const wk = works[tD], w = wk.w, socs = socsT[tD];
    /* SOC chia lại: chia ít chute hơn số SOC phải chia thì phần (SOC − chute) ÷ SOC số đơn được SOC chính sort lại,
       năng suất như sort đủ chute tại điểm, 520k/người/ngày (như Seller Planner: soc.same, soc.pay) */
    const rs = X * rsSh[tD], socC = rs > 0 ? rs / workOf(st).prod * P.ftePay : 0;
    const W = cots.map((c, k) => { const Q = X * sh[k] / shT, legs = best(Q, tD), mix = {};
      if (prt.length) legs.forEach(l => { const z = l.s[0], kmS = (socs.find(o => o.s === z) || {}).km || 0;
        const ps = prt.map(pj => ({ pj, q: pj.ado * (pj.sh[k] || 0) * (pj.soc[z] || 0) })).filter(o => o.q > 0.5); if (!ps.length || !(l.Q > 0)) return;
        const m = fleetUx([{ q: l.Q, c: capN }].concat(ps.map(o => ({ q: o.q, c: o.pj.c }))), kmS, chainKm(ps.map(o => o.pj))), alone = aloneOf(ps, kmS);
        Object.assign(l, { c: Math.max(0, m.c - alone), t: m.t, mix: m.mix, q: m.t ? l.Q * m.t / Math.max(1e-9, m.U) : l.q, shared: ps.map(o => ({ n: o.pj.n, q: o.q, pj: o.pj })), fillAll: m.t ? m.U / m.t : 0 }); });
      /* chỗ tập kết không đủ chứa cả lượt: số xe ít nhất = ⌈đơn ÷ chỗ tập kết⌉ (xe phải lấy nhiều đợt); thêm xe cỡ nhỏ nhất đủ chở phần chia */
      let xs = 0; if (stage && legs.length) { const need = Math.ceil(Q / stage - 1e-9), t0 = legs.reduce((a, l) => a + l.t, 0);
        if (need > t0) { const L = legs.slice().sort((a, b) => b.Q - a.Q)[0], km = (socs.find(o => o.s === L.s[0]) || {}).km || 0, v = ksAt(km).find(u => u.q >= Q / need) || ksAt(km).slice(-1)[0];
          xs = need - t0; L.mix[v.k] = (L.mix[v.k] || 0) + xs; L.t += xs; L.c += xs * v.p; L.q += xs * v.q; } }
      legs.forEach(l => { for (const k2 in l.mix) mix[k2] = (mix[k2] || 0) + l.mix[k2]; });
      const t = legs.reduce((a, l) => a + l.t, 0), q = legs.reduce((a, l) => a + l.q, 0);
      const shr = legs.filter(l => l.shared), fill = shr.length ? shr.reduce((a, l) => a + l.fillAll * l.t, 0) / Math.max(1, shr.reduce((a, l) => a + l.t, 0)) : q ? Q / q : 0;
      return { k, c, Q, mix, t, xs, legs, shared: [...new Set(shr.flatMap(l => l.shared.map(o => o.n)))], cost: legs.reduce((a, l) => a + l.c, 0), fill }; }).filter(v => v.Q > 0.5);
    /* giờ: đơn về trong khung [a, b] (tail % dồn vào 60' cuối); người làm theo năng suất; xe chất theo đợt chỗ chất */
    const sim = hc => { let free = open, worst = 1e9; const r = W.map(v => { const a = v.c.a + dly, b = v.c.b + dly, begin = Math.max(free, open, a), per = w * P.fteH * 60 / hc;
        const work = lab === "pps" ? 0 : v.Q * per, done = lab === "pps" ? b : Math.max(b, begin + work, b - 60 + v.Q * tail * per);
        const qT = v.t ? v.Q / v.t : 0, dw = dwFix + dwRate * qT + (lab === "pps" ? qT / (P.ppsSpd / 60) : 0), batch = Math.ceil(v.t / bays);
        let dep = done + P.closeMin + (batch - 1) * dw, slack = v.c.p - dep;
        /* LỊCH CHẠY của lượt: mỗi điểm theo thứ tự xe ghé — hàng sẵn, xe tới, chất (phút), xe rời, hạn; rồi giờ tới SOC chính */
        let tt = [{ n: null, me: 1, rd: done, arr: dep - dw, dw, dep, dl: v.c.p, q: v.t ? v.Q / v.t : 0 }];
        /* xe chung: lấy điểm sẵn hàng trước, chạy sang điểm sau (km ÷ tốc độ trung vị vùng); điểm có sẵn không trễ hơn giờ xe thật đang rời */
        const ps = prt.filter(pj => v.shared.includes(pj.n) && pj.dep[v.k] != null);
        if (ps.length) { const qPer = q => q / Math.max(1, v.t), c = chainRun([{ me: 1, ll: x.ll, rd: done, q: qPer(v.Q), dl: v.c.p }].concat(ps.map(pj => ({ n: pj.n, km: pj.km, ll: pj.ll, rd: pj.dep[v.k] - P.closeMin + dly, q: qPer(pj.ado * pj.sh[v.k]), dl: Math.max(v.c.p, pj.dep[v.k]) }))));
          dep = Math.max(dep, c.me); tt = c.tt.map(z => z.me ? Object.assign(z, { dep }) : z); slack = Math.min(v.c.p - dep, c.sl); }
        const last = tt[tt.length - 1], kmSoc = ((socs.slice().sort((a, b) => b.sh - a.sh)[0]) || {}).km || 0;
        const socArr = last.dep + kmSoc / ref.dw.spd;   // km tới SOC chính tính từ seller mới (điểm ghép gần đó)
        free = done; worst = Math.min(worst, slack); return { done, dep, slack, batch, dw, tt, socArr, kmSoc }; }); return { r, worst }; };
    const hc0 = lab === "pps" ? 0 : Math.max(1, Math.ceil(X * w - 1e-9)); let hc = hc0, s = sim(Math.max(1, hc));
    /* trễ (hoặc dư dưới mức yêu cầu) thì thêm từng người, chỉ giữ khi giờ xe rời thật sự sớm hơn (trễ do chỗ chất xe thì thêm người không giúp) */
    if (lab !== "pps") while (s.worst < slackMin && hc < hc0 + P.maxExtra && (osCap == null || hc < osCap)) { const s2 = sim(hc + 1); if (s2.worst <= s.worst + 0.5) break; hc++; s = s2; }
    W.forEach((v, j) => Object.assign(v, s.r[j]));
    const truck = W.reduce((a, v) => a + v.cost, 0), labC = lab === "pps" ? X * P.ppsRate : hc * pay, fm = X * fmU;
    return { X, W, hc, hc0, short: osCap != null && hc0 > osCap ? hc0 - osCap : 0, truck, lab: labC, rs, soc: socC, cost: truck + labC + socC, fm, net: fm - truck - labC - socC, trucks: W.reduce((a, v) => a + v.t, 0), xs: W.reduce((a, v) => a + v.xs, 0), worst: s.worst };
  };
  const days = x.ado.map((X, t) => ({ t, ...day(Math.max(0, +X || 0), 0, t), n: +x.days[t] || 0, work: works[t] }));
  /* thử seller giao trễ x.delay phút trên ngày đông nhất (cùng số người) */
  const dly = Math.max(0, +x.delay || 0), pk = days.reduce((a, d) => d.X > a.X ? d : a, days[0]), late = dly && pk.X > 0 ? day(pk.X, dly, pk.t) : null;
  const sum = f => days.reduce((a, d) => a + d.n * f(d), 0), V = sum(d => d.X);
  const month = { orders: V, truck: sum(d => d.truck), lab: sum(d => d.lab), soc: sum(d => d.soc), fm: sum(d => d.fm) }; month.cost = month.truck + month.lab + month.soc; month.net = month.fm - month.cost;
  /* 5. ngưỡng ADO hoà vốn, RIÊNG từng loại ngày: mức đơn thấp nhất mà một ngày loại đó rẻ hơn FM pickup.
     Chỉ phụ thuộc hồ sơ của loại ngày đó, không phụ thuộc ADO đang nhập. Phía trên ngưỡng có thể có dải lỗ lại (nhảy bậc xe / người) → ghi riêng tới 2× ngưỡng */
  const grid = []; for (let a = 20; a <= 3000; a += 20) grid.push(a); for (let a = 3050; a <= 20000; a += 50) grid.push(a);
  const thrOf = t => { const net = grid.map(a => day(a, 0, t).net), j0 = net.findIndex(v => v >= 0); if (j0 < 0) return { v: null, bands: [] };
    const bands = []; let cur = null; for (let j = j0; j < grid.length && grid[j] <= 2 * grid[j0]; j++) { if (net[j] < 0) { if (!cur) bands.push(cur = [grid[j], grid[j]]); else cur[1] = grid[j]; } else cur = null; }
    return { v: grid[j0], bands }; };
  const thrR = [0, 1, 2].map(thrOf), thrs = thrR.map(o => o.v), thr = thrs[0];
  /* 7. GHÉP VỚI TUYẾN D2S ĐANG CHẠY (tuyến theo kế hoạch Core: đi riêng = 1 điểm, đi chung = nhiều điểm một đội xe): toạ độ (x.ll), FM Hub (x.hub), Sup (x.sup)
     → tuyến có điểm cách ≤ 30 km, chung SOC, chung lượt COT. Tiền xe: seller mới đi riêng + tuyến đang chạy so với một đội xe chở cả tuyến và seller mới
     (mỗi seller chiếm chỗ theo sức chở của mình, cộng đ/km đi vòng). Điểm có sẵn: đơn/ngày = trung vị đơn của điểm (mọi loại ngày), phần đơn mỗi lượt và SOC theo chuyến thật.
     Kịp COT (ngày BAU): lịch xe chung như phần Lịch chạy */
  const mrg = { need: !llOk, list: [] };
  if (!mrg.need) {
    const mySoc = Object.fromEntries(socs.map(o => [o.s, o.sh / shS])), runT = days.filter(d => d.X > 0 && d.n > 0), bau = days.find(d => d.t === 0 && d.X > 0) || runT[0];
    rts.forEach(r => { const ps = r.ps.filter(q => q.ll).map(q => Object.assign({}, q, { rt: r.id, km: hav(x.ll, q.ll) })).sort((a, b) => a.km - b.km); if (!ps.length) return;
      const km = ps[0].km; if (km > 30) return;
      const cs = Object.keys(mySoc).filter(z => ps.some(q => q.soc[z] > 0)), ws = cots.map((_, k) => k).filter(k => sh[k] > 0 && ps.some(q => q.sh[k] > 0));
      /* luật OE (vùng đang áp): khác Sup thì không ghép; tuyến có seller giữ chuyến ghé hub hoặc OE yêu cầu chạy riêng thì không ghép */
      const oeNo = ps.some(q => q.solo) ? "solo" : ps.some(q => q.lock) ? "hub" : G.oe && x.sup && ps.some(q => q.sup && q.sup !== x.sup) ? "sup" : null;
      const o = { n: r.id, mem: ps.map(q => q.n), now: r.now, km: +km.toFixed(1), sup: ps[0].sup, hub: ps[0].hub, supOk: !!x.sup && ps.every(q => q.sup === x.sup), hubOk: !!x.hub && ps.some(q => q.hub === x.hub), oeNo, socs: cs, waves: ws.map(k => cots[k].p), ado: ps.reduce((a, q) => a + q.ado, 0), save: 0, slack: null };
      /* Est. lợi và COT: chạy lại đúng kế hoạch như khi tick tuyến này (cùng số xe, lịch chạy) — tiền xe seller mới đi riêng − tiền xe phần thêm khi đi chung, cả tháng; COT = mức dư nhỏ nhất ngày BAU */
      if (cs.length && ws.length && runT.length) {
        runT.forEach(d => { o.save += d.n * (day(d.X, 0, d.t, []).truck - day(d.X, 0, d.t, ps).truck); });
        if (bau) { const y = day(bau.X, 0, bau.t, ps); o.slack = y.worst < 1e8 ? Math.round(y.worst) : null; } }
      mrg.list.push(o); });
    mrg.list.forEach(o => { o.st = !o.socs.length || !o.waves.length ? "na" : o.oeNo ? "oe" : o.slack != null && o.slack < slackMin ? "late" : o.save <= 0 ? "nogain" : !o.supOk ? "check" : "go"; });
    const rk = { go: 0, check: 1, late: 2, oe: 3, nogain: 4, na: 5 }; mrg.list.sort((a, b) => rk[a.st] - rk[b.st] || b.save - a.save || a.km - b.km); }
  /* 6. KẾT LUẬN cho Ops: nên chạy D2S khi lời cả tháng, trên ngưỡng hoà vốn, kịp COT mọi loại ngày với mức dư yêu cầu, đủ người */
  const run = days.filter(d => d.X > 0 && d.n > 0), chk = { profit: month.net > 0, thr: run.length > 0 && run.every(d => d.net >= 0), cot: run.every(d => d.worst >= slackMin), people: run.every(d => !d.short), delay: !late || late.worst >= 0 };
  const verdict = chk.profit && chk.thr && chk.cot && chk.people ? (chk.delay ? "go" : "cond") : "no";
  return { chute: all.map(o => ({ s: o.s, main: o === main, fw: !!o.fw, cu: [0, 1, 2].map(t => own(o, t)) })), rsSh, cap: NS_KS.map((k, j) => ({ k, q: Math.round(cap[j]), q0: Math.round(capLearn[j]), on: j <= mi, p: G.price[k][kmI(km0)] })), km0, how, pool: pool.map(s => s.n), work: works[0], works, fmU, days, month, thr, cots, open, lab, pay, dw: { fix: dwFix, rate: dwRate }, stage, slackMin, osCap, dly, late, pk: pk.t, ok: chk, verdict, thrs, thrBands: thrR.map(o => o.bands), mrg, picked: partners.map(q => q.n) };
}
if (typeof module !== "undefined") module.exports = { nsRef, nsPlan, NS_KS };
