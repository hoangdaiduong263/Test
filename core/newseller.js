/* NEW SELLER — kế hoạch cho một seller sắp nhận, dùng đúng số Core Planner đã học:
   sức chở theo cỡ xe (kích thước đơn của các seller giống), giá xe theo vùng & km, thời gian xe đứng, năng suất người, mốc COT của vùng.
   nsRef(C, REF): rút gọn số đã học (chạy lúc build, cần dữ liệu đầy đủ) · nsPlan(ref, x): kế hoạch cho hồ sơ x (chạy trên trang, không cần dữ liệu gốc) */
const NS_KS = ["VAN", "1T25", "1T9", "5T", "8T"];
const nsMed = a => { const b = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

function nsRef(C, REF) {
  const K = C.learnK(), P = C.P, sel = [], reg = {};
  /* phần đơn theo SOC đích từ chuyến thật T8–9 (luồng cũ, trước khi South gom 1 chute từ 1/10): trung bình trên các seller của vùng */
  const f0 = P.flow1cOn; P.flow1cOn = 0; C.reset(); const SSH = {}; ["HN", "HCM", "South", "North"].forEach(R => { const o = {}, N = C.nodes(R);
    N.forEach(i => { const sh = C.socShare(i); for (const x in sh) o[x] = (o[x] || 0) + sh[x] / N.length; }); SSH[R] = o; }); P.flow1cOn = f0; C.reset();
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
    reg[R] = { cots, sh: shM, soc: Object.keys(socs).sort((a, b) => (SSH[R][b] || 0) - (SSH[R][a] || 0)), socN: socs, socCur: cur, socSh: Object.fromEntries(Object.keys(socs).map(x => [x, +((SSH[R][x] || 0) * 100).toFixed(1)])), km: Object.fromEntries(Object.entries(kms).map(([s, a]) => [s, Math.round(nsMed(a))])),
      ch: Math.round(nsMed(cs.map(x => x.ch))), st: Math.round(nsMed(cs.map(x => x.st))),
      price: Object.fromEntries(NS_KS.map(k => [k, Array.from({ length: 61 }, (_, j) => Math.round(C.price(k, R, { d0: j * 5, dt: 0 })))])),
      /* đ/km đi thêm giữa các SOC (xe trả nhiều SOC), và km giữa các SOC */
      pkm: Object.fromEntries(NS_KS.map(k => [k, Math.round(C.price(k, R, { d0: 0, dt: 1 }) - C.price(k, R, { d0: 0, dt: 0 }))])),
      skm: Object.fromEntries(Object.keys(socs).map(a => [a, Object.fromEntries(Object.keys(socs).map(b => [b, a === b ? 0 : Math.round(C.kmN(a, b) ?? 30)]))])) };
  });
  const dw = C.simK();
  return { v: 1, sel, reg, dw: { fix: +dw.fix.toFixed(2), rate: +dw.rate.toFixed(4) },
    P: { prodBase: P.prodBase, prodHand: P.prodHand, prodChute: P.prodChute, prodBulky: P.prodBulky, fteH: P.fteH, ftePay: P.ftePay, closeMin: P.closeMin, open: P.open, maxExtra: P.maxExtra },
    /* đơn giá FM pickup (rider + hub, đ/đơn; hàng to nhân hệ số) — cùng giả định với Seller Planner */
    fm: { rS: 669, rM: 2.2, hS: 632.2157, hM: 1.4 } };
}

/* x = { R, socs: [{ s, sh (% đơn), km }], ado: [BAU, Mini CP, CP], days: [..], beta (0–1), sh: [phần đơn mỗi lượt], maxK, bays, ch, st, like (tên seller | null) } */
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
  const mi = Math.max(0, NS_KS.indexOf(x.maxK)), ksAt = km => NS_KS.slice(0, mi + 1).map((k, j) => ({ k, q: cap[j], p: G.price[k][kmI(km)] })).filter(v => v.q > 0);
  /* 2. đội xe rẻ nhất chở Q đơn: n xe loại chính + 1 xe vừa phần lẻ (như Core), không quá 100% sức chở học được */
  const fleet = (Q, km, dt) => { if (Q <= 0) return { t: 0, c: 0, mix: {}, q: 0 }; let best = null; const ks = ksAt(km).map(v => Object.assign({}, v, { p: v.p + (G.pkm[v.k] || 0) * (dt || 0) }));
    const add = (c, t, mix, q) => { if (!best || c < best.c - 1 || (Math.abs(c - best.c) <= 1 && t < best.t)) best = { c, t, mix, q }; };
    for (const m of ks) { const n = Math.floor(Q / m.q - 1e-9), rest = Q - n * m.q; add((n + 1) * m.p, n + 1, { [m.k]: n + 1 }, (n + 1) * m.q);
      if (rest > 0) for (const u of ks) if (u.q >= rest) { const mix = {}; if (n > 0) mix[m.k] = n; mix[u.k] = (mix[u.k] || 0) + 1; add(n * m.p + u.p, n + 1, mix, n * m.q + u.q); } }
    return best; };
  /* 3. người: khối việc mỗi đơn theo số chute chia và số SOC xe chở tới (như Core) */
  /* số SOC phải chia riêng = SOC nhận ≥ 5% đơn (như Core, socMin) — kể cả SOC đi chuyển tiếp: túi vẫn phải chia riêng ở seller */
  const st = Math.max(1, all.filter(o => o.sh / shS >= 0.05).length), ch = Math.max(st, x.ch | 0), sm = ch > 1 ? 1 : 0, bg = Math.min(ch, st) > 1 ? 1 : 0;
  const sv = (1 - beta) * sm + beta * bg, bp = sv > 0 ? beta * bg / sv * 100 : 0, stepF = (i, a, s, r) => 1 - Math.round(Math.abs(i - a) / s) * r / 100;
  const prod = Math.max(1, P.prodBase * stepF(1, ch, 1, P.prodChute) * stepF(10, bp, 10, P.prodBulky)), w = sv / prod + (1 - sv) / P.prodHand;
  const sort = sm ? (bg ? "big" : "small") : "none";
  const fmU = (1 - beta) * (ref.fm.rS + ref.fm.hS) + beta * (ref.fm.rS * ref.fm.rM + ref.fm.hS * ref.fm.hM);
  const bays = Math.max(1, x.bays | 0), sh = G.cots.map((_, k) => Math.max(0, +(x.sh[k] || 0))), shT = sh.reduce((a, b) => a + b, 0) || 1;
  /* 3b. SOC đích: chia các SOC thành nhóm, mỗi nhóm một đội xe đi lần lượt các SOC trong nhóm (xe trả nhiều SOC, cộng tiền km đi thêm giữa các SOC);
     thử mọi cách chia, giữ cách rẻ nhất — SOC ít đơn đi ké xe của SOC khác thay vì một xe gần rỗng */
  const parts = a => { if (!a.length) return [[]]; const [h, ...r] = a, out = []; parts(r).forEach(p => { out.push([[h], ...p]); p.forEach((b, j) => out.push(p.map((y, i) => i === j ? [h, ...y] : y))); }); return out; };
  const PARTS = parts(socs.map((_, j) => j));
  const best = Q => { let bb = null; for (const pt of PARTS) { const legs = pt.map(g => { const o = g.map(j => socs[j]).sort((a, b) => a.km - b.km), q = o.reduce((a, y) => a + Q * y.sh / shS, 0);
        let dt = 0; for (let j = 1; j < o.length; j++) dt += (G.skm[o[j - 1].s] || {})[o[j].s] ?? 30; return Object.assign(fleet(q, o[0].km, dt), { s: o.map(y => y.s), fwd: o.flatMap(y => y.fwd || []), Q: q, dt }); });
      const c = legs.reduce((a, l) => a + l.c, 0), t = legs.reduce((a, l) => a + l.t, 0); if (!bb || c < bb.c - 1 || (Math.abs(c - bb.c) <= 1 && t < bb.t)) bb = { c, t, legs }; } return bb ? bb.legs : []; };
  /* 4. một loại ngày: xe từng lượt, người, giờ xe rời so với hạn COT */
  const day = X => {
    const W = G.cots.map((c, k) => { const Q = X * sh[k] / shT, legs = best(Q), mix = {};
      legs.forEach(l => { for (const k2 in l.mix) mix[k2] = (mix[k2] || 0) + l.mix[k2]; });
      const t = legs.reduce((a, l) => a + l.t, 0), q = legs.reduce((a, l) => a + l.q, 0);
      return { k, c, Q, mix, t, legs, cost: legs.reduce((a, l) => a + l.c, 0), fill: q ? Q / q : 0 }; }).filter(v => v.Q > 0.5);
    const sim = hc => { let free = P.open, worst = 1e9; const r = W.map(v => { const begin = Math.max(free, v.c.a < P.open ? P.open : v.c.a), work = v.Q * w * P.fteH * 60 / hc;
        const done = Math.max(v.c.b, begin + work), qT = v.t ? v.Q / v.t : 0, dw = ref.dw.fix + ref.dw.rate * qT, batch = Math.ceil(v.t / bays);
        const dep = done + P.closeMin + (batch - 1) * dw, slack = v.c.p - dep; free = done; worst = Math.min(worst, slack); return { done, dep, slack, batch, dw }; }); return { r, worst }; };
    const hc0 = Math.max(1, Math.ceil(X * w - 1e-9)); let hc = hc0, s = sim(hc);
    while (s.worst < 0 && hc < hc0 + P.maxExtra) { hc++; s = sim(hc); }
    W.forEach((v, j) => Object.assign(v, s.r[j]));
    const truck = W.reduce((a, v) => a + v.cost, 0), lab = hc * P.ftePay, fm = X * fmU;
    return { X, W, hc, hc0, truck, lab, cost: truck + lab, fm, net: fm - truck - lab, trucks: W.reduce((a, v) => a + v.t, 0), worst: s.worst };
  };
  const days = x.ado.map((X, t) => ({ t, ...day(Math.max(0, +X || 0)), n: +x.days[t] || 0 }));
  const sum = f => days.reduce((a, d) => a + d.n * f(d), 0), V = sum(d => d.X);
  const month = { orders: V, truck: sum(d => d.truck), lab: sum(d => d.lab), fm: sum(d => d.fm) }; month.cost = month.truck + month.lab; month.net = month.fm - month.cost;
  /* 5. ngưỡng ADO hoà vốn (ngày BAU; Mini CP và CP giữ tỷ lệ so với BAU): mức thấp nhất mà từ đó tới gấp đôi đều lời */
  const r0 = +x.ado[0] || 1, netAt = a => { let n = 0; x.ado.forEach((X, t) => { const d = day(a * (+X || 0) / r0); n += (+x.days[t] || 0) * d.net; }); return n; };
  const grid = []; for (let a = 20; a <= 3000; a += 20) grid.push(a); for (let a = 3050; a <= 20000; a += 50) grid.push(a);
  const ok = grid.map(a => netAt(a) >= 0); let thr = null;
  for (let j = 0; j < grid.length && thr == null; j++) { if (!ok[j]) continue; let all = true; for (let k = j; k < grid.length && grid[k] <= 2 * grid[j]; k++) if (!ok[k]) { all = false; break; } if (all) thr = grid[j]; }
  return { cap: NS_KS.map((k, j) => ({ k, q: Math.round(cap[j]), on: j <= mi, p: G.price[k][kmI(km0)] })), km0, how, pool: pool.map(s => s.n), work: { w, prod: Math.round(prod), sort, ch, st }, fmU, days, month, thr, cots: G.cots };
}
if (typeof module !== "undefined") module.exports = { nsRef, nsPlan, NS_KS };
