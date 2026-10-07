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
    reg[R] = { cots, sh: shM, soc: Object.keys(socs).sort((a, b) => (SSH[R][b] || 0) - (SSH[R][a] || 0)), socN: socs, socCur: cur, socMulti: SN[R], socSh: Object.fromEntries(Object.keys(socs).map(x => [x, +((SSH[R][x] || 0) * 100).toFixed(1)])), km: Object.fromEntries(Object.entries(kms).map(([s, a]) => [s, Math.round(nsMed(a))])),
      ch: Math.round(nsMed(cs.map(x => x.ch))), st: Math.round(nsMed(cs.map(x => x.st))),
      price: Object.fromEntries(NS_KS.map(k => [k, Array.from({ length: 61 }, (_, j) => Math.round(C.price(k, R, { d0: j * 5, dt: 0 })))])) };
  });
  const dw = C.simK();
  return { v: 1, sel, reg, dw: { fix: +dw.fix.toFixed(2), rate: +dw.rate.toFixed(4) },
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
  const socs = main ? dir.length ? dir.map(o => o === main ? Object.assign({}, o, { sh: o.sh + all.filter(y => y.fw).reduce((a, y) => a + y.sh, 0), fwd: all.filter(y => y.fw).map(y => y.s) }) : o) : [Object.assign({}, main, { sh: shS, fwd: all.filter(y => y !== main).map(y => y.s) })] : [];
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
  /* số chute seller chia: theo từng loại ngày (x.ch = số hoặc [BAU, Mini CP, CP]). Chia ít chute hơn số SOC thì SOC chính nhận túi chung và chia lại (như luồng 1 chute South từ 1/10) */
  const st = Math.max(1, all.filter(o => o.sh / shS >= 0.05).length), stepF = (i, a, s, r) => 1 - Math.round(Math.abs(i - a) / s) * r / 100;
  const workOf = c => { const ch = Math.max(1, c | 0 || 1), sm = ch > 1 ? 1 : 0, bg = Math.min(ch, st) > 1 ? 1 : 0, sv = (1 - beta) * sm + beta * bg, bp = sv > 0 ? beta * bg / sv * 100 : 0;
    const prod = Math.max(1, P.prodBase * stepF(1, ch, 1, P.prodChute) * stepF(10, bp, 10, P.prodBulky)); return { ch, st, prod: Math.round(prod), w: sv / prod + (1 - sv) / P.prodHand, sort: sm ? (bg ? "big" : "small") : "none" }; };
  const chs = [0, 1, 2].map(t => Array.isArray(x.ch) ? x.ch[t] ?? x.ch[0] : x.ch), works = chs.map(workOf);
  const fmU = (1 - beta) * (ref.fm.rS + ref.fm.hS) + beta * (ref.fm.rS * ref.fm.rM + ref.fm.hS * ref.fm.hM);
  /* khung bàn giao của seller theo lượt: x.win[k] = [từ, đến] (phút từ 0h); thiếu thì theo khung COT của vùng, không trước giờ người bắt đầu làm (x.open) */
  const open = x.open ?? P.open, cots = G.cots.map((c, k) => { const w = (x.win || [])[k]; return { p: c.p, a0: c.a, b0: c.b, a: w ? w[0] : Math.max(c.a, open), b: w ? w[1] : c.b }; });
  const bays = Math.max(1, x.bays | 0), sh = G.cots.map((_, k) => Math.max(0, +(x.sh[k] || 0))), shT = sh.reduce((a, b) => a + b, 0) || 1;
  /* 3b. SOC đích: mỗi SOC một đội xe riêng, giá theo km tới SOC đó */
  const best = Q => socs.map(o => { const q = Q * o.sh / shS; return Object.assign(fleet(q, o.km), { s: [o.s], fwd: o.fwd || [], Q: q }); });
  /* người tại điểm: FTE riêng (520k/ngày) · nhóm FM Hub (350k/ngày, như Core) · Rider PPS (700 đ/đơn, seller tự đóng hàng; rider quét lúc giao → cộng vào thời gian xe đứng) */
  const lab = x.lab === "hub" || x.lab === "pps" ? x.lab : "fte", pay = lab === "hub" ? P.hubPay : P.ftePay;
  const dwFix = x.dwFix != null && x.dwFix !== "" ? +x.dwFix : ref.dw.fix, dwRate = x.dwRate != null && x.dwRate !== "" ? +x.dwRate / 100 : ref.dw.rate;
  const tail = Math.min(1, Math.max(0, (+x.tail || 0) / 100)), slackMin = Math.max(0, +x.slackMin || 0), osCap = +x.osCap > 0 ? Math.round(+x.osCap) : null;
  const stage = +x.area > 0 && +x.dens > 0 ? +x.area * +x.dens : null;   // số đơn tập kết được cùng lúc
  /* 4. một loại ngày: xe từng lượt, người, giờ xe rời so với hạn COT */
  const day = (X, dly, t) => { dly = dly || 0; const wk = works[t || 0], w = wk.w;
    /* SOC chia lại: chia ít chute hơn số SOC phải chia thì phần (SOC − chute) ÷ SOC số đơn được SOC chính sort lại,
       năng suất như sort đủ chute tại điểm, 520k/người/ngày (như Seller Planner: soc.same, soc.pay) */
    const rs = wk.ch < st ? X * (st - wk.ch) / st : 0, socC = rs > 0 ? rs / workOf(st).prod * P.ftePay : 0;
    const W = cots.map((c, k) => { const Q = X * sh[k] / shT, legs = best(Q), mix = {};
      /* chỗ tập kết không đủ chứa cả lượt: số xe ít nhất = ⌈đơn ÷ chỗ tập kết⌉ (xe phải lấy nhiều đợt); thêm xe cỡ nhỏ nhất đủ chở phần chia */
      let xs = 0; if (stage && legs.length) { const need = Math.ceil(Q / stage - 1e-9), t0 = legs.reduce((a, l) => a + l.t, 0);
        if (need > t0) { const L = legs.slice().sort((a, b) => b.Q - a.Q)[0], km = (socs.find(o => o.s === L.s[0]) || {}).km || 0, v = ksAt(km).find(u => u.q >= Q / need) || ksAt(km).slice(-1)[0];
          xs = need - t0; L.mix[v.k] = (L.mix[v.k] || 0) + xs; L.t += xs; L.c += xs * v.p; L.q += xs * v.q; } }
      legs.forEach(l => { for (const k2 in l.mix) mix[k2] = (mix[k2] || 0) + l.mix[k2]; });
      const t = legs.reduce((a, l) => a + l.t, 0), q = legs.reduce((a, l) => a + l.q, 0);
      return { k, c, Q, mix, t, xs, legs, cost: legs.reduce((a, l) => a + l.c, 0), fill: q ? Q / q : 0 }; }).filter(v => v.Q > 0.5);
    /* giờ: đơn về trong khung [a, b] (tail % dồn vào 60' cuối); người làm theo năng suất; xe chất theo đợt chỗ chất */
    const sim = hc => { let free = open, worst = 1e9; const r = W.map(v => { const a = v.c.a + dly, b = v.c.b + dly, begin = Math.max(free, open, a), per = w * P.fteH * 60 / hc;
        const work = lab === "pps" ? 0 : v.Q * per, done = lab === "pps" ? b : Math.max(b, begin + work, b - 60 + v.Q * tail * per);
        const qT = v.t ? v.Q / v.t : 0, dw = dwFix + dwRate * qT + (lab === "pps" ? qT / (P.ppsSpd / 60) : 0), batch = Math.ceil(v.t / bays);
        const dep = done + P.closeMin + (batch - 1) * dw, slack = v.c.p - dep; free = done; worst = Math.min(worst, slack); return { done, dep, slack, batch, dw }; }); return { r, worst }; };
    const hc0 = lab === "pps" ? 0 : Math.max(1, Math.ceil(X * w - 1e-9)); let hc = hc0, s = sim(Math.max(1, hc));
    if (lab !== "pps") while (s.worst < slackMin && hc < hc0 + P.maxExtra && (osCap == null || hc < osCap)) { hc++; s = sim(hc); }
    W.forEach((v, j) => Object.assign(v, s.r[j]));
    const truck = W.reduce((a, v) => a + v.cost, 0), labC = lab === "pps" ? X * P.ppsRate : hc * pay, fm = X * fmU;
    return { X, W, hc, hc0, short: osCap != null && hc0 > osCap ? hc0 - osCap : 0, truck, lab: labC, rs, soc: socC, cost: truck + labC + socC, fm, net: fm - truck - labC - socC, trucks: W.reduce((a, v) => a + v.t, 0), xs: W.reduce((a, v) => a + v.xs, 0), worst: s.worst };
  };
  const days = x.ado.map((X, t) => ({ t, ...day(Math.max(0, +X || 0), 0, t), n: +x.days[t] || 0, work: works[t] }));
  /* thử seller giao trễ x.delay phút trên ngày đông nhất (cùng số người) */
  const dly = Math.max(0, +x.delay || 0), pk = days.reduce((a, d) => d.X > a.X ? d : a, days[0]), late = dly && pk.X > 0 ? day(pk.X, dly, pk.t) : null;
  const sum = f => days.reduce((a, d) => a + d.n * f(d), 0), V = sum(d => d.X);
  const month = { orders: V, truck: sum(d => d.truck), lab: sum(d => d.lab), soc: sum(d => d.soc), fm: sum(d => d.fm) }; month.cost = month.truck + month.lab + month.soc; month.net = month.fm - month.cost;
  /* 5. ngưỡng ADO hoà vốn (ngày BAU; Mini CP và CP giữ tỷ lệ so với BAU): mức thấp nhất mà từ đó tới gấp đôi đều lời */
  const r0 = +x.ado[0] || 1, netAt = a => { let n = 0; x.ado.forEach((X, t) => { const d = day(a * (+X || 0) / r0, 0, t); n += (+x.days[t] || 0) * d.net; }); return n; };
  const grid = []; for (let a = 20; a <= 3000; a += 20) grid.push(a); for (let a = 3050; a <= 20000; a += 50) grid.push(a);
  const ok = grid.map(a => netAt(a) >= 0); let thr = null;
  for (let j = 0; j < grid.length && thr == null; j++) { if (!ok[j]) continue; let all = true; for (let k = j; k < grid.length && grid[k] <= 2 * grid[j]; k++) if (!ok[k]) { all = false; break; } if (all) thr = grid[j]; }
  /* 6. KẾT LUẬN cho Ops: nên chạy D2S khi lời cả tháng, trên ngưỡng hoà vốn, kịp COT mọi loại ngày với mức dư yêu cầu, đủ người */
  const run = days.filter(d => d.X > 0 && d.n > 0), chk = { profit: month.net > 0, thr: thr != null && (+x.ado[0] || 0) >= thr, cot: run.every(d => d.worst >= slackMin), people: run.every(d => !d.short), delay: !late || late.worst >= 0 };
  const verdict = chk.profit && chk.thr && chk.cot && chk.people ? (chk.delay ? "go" : "cond") : "no";
  return { cap: NS_KS.map((k, j) => ({ k, q: Math.round(cap[j]), q0: Math.round(capLearn[j]), on: j <= mi, p: G.price[k][kmI(km0)] })), km0, how, pool: pool.map(s => s.n), work: works[0], works, fmU, days, month, thr, cots, open, lab, pay, dw: { fix: dwFix, rate: dwRate }, stage, slackMin, osCap, dly, late, pk: pk.t, ok: chk, verdict };
}
if (typeof module !== "undefined") module.exports = { nsRef, nsPlan, NS_KS };
