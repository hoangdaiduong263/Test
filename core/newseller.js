/* NEW SELLER — kế hoạch cho một seller sắp nhận, dùng đúng số Core Planner đã học:
   sức chở theo cỡ xe (kích thước đơn của các seller giống), giá xe theo vùng & km, thời gian xe đứng, năng suất người, mốc COT của vùng.
   nsRef(C, REF): rút gọn số đã học (chạy lúc build, cần dữ liệu đầy đủ) · nsPlan(ref, x): kế hoạch cho hồ sơ x (chạy trên trang, không cần dữ liệu gốc) */
const NS_KS = ["VAN", "1T25", "1T9", "5T", "8T"];
/* CẤM TẢI (Ops chấp nhận tạm thời, 10/2026): chỉ ràng buộc xe nặng; xe nhẹ thực tế vẫn chạy trong giờ cấm (giấy phép).
   HN: vùng ~VĐ3,5 (≈ 14,5 km quanh Hoàn Kiếm; trong vùng 24 điểm, 6.708 chuyến không có xe nặng) — xe nặng chỉ 21:00–06:00 (QĐ 01/2026).
   HCM: luật theo cụm điểm (≤ 2 km) trong ~15 km quanh trung tâm, suy từ giờ xe nặng thật: xe nặng chạy cả 16–21h → không ràng buộc;
   có ≥ 3 chuyến nặng nhưng né 16–21h → chỉ các khung đã thấy xe nặng chạy (9–16h, 21–06h); gần như không xe nặng mà ≥ 40% đợt phải chồng nhiều xe nhẹ → chỉ 22:00–06:00 (QĐ 23/2018);
   còn lại → chưa đủ dữ liệu (cảnh báo, không ràng buộc). South, North: không thấy dấu hiệu cấm theo giờ.
   Seller mới: theo điểm D2S gần nhất (≤ near km) có luật; HN ngoài bán kính đó thì theo vùng */
/* cổng bàn giao: phút xe chuyển sang cổng kế tiếp (giả định, chưa đo) */
const NS_GATE = { move: 10 };
const NS_BAN = { heavy: ["5T", "8T"], clKm: 2, near: 3,
  HN: { zone: 1, c: [21.0285, 105.8542], r: 14.5, allow: [[1260, 1800]] },
  HCM: { c: [10.7724, 106.698], r: 15, allow: [[1320, 1800]] } };
const nsKm = (a, b) => { const r = v => v * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h))); };
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
  /* giờ rời điểm của từng chuyến thật (loại xe, phút, ngày) — để suy luật cấm tải */
  const DEP = {}; Object.values(C.TRP).forEach(t => { const k = C.TY[t[1]] === "KHAC" ? "VAN" : C.TY[t[1]]; t[5].forEach(p => { if (p[1] !== 0 || p[4] == null) return; const n = String(C.TRN[p[0]]).trim(); (DEP[n] = DEP[n] || []).push({ k, m: p[5] ?? p[4], d: t[0] }); }); });
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
    /* CẤM TẢI suy từ giờ chạy thật của các điểm gần nhau (xem NS_BAN): mỗi điểm một luật cho xe nặng (5T, 8T) */
    const bz = NS_BAN[R], H = new Set(NS_BAN.heavy), pe = reg[R].pts.map(q => { const L = DEP[q.n] || [], dy = {}; L.forEach(e => (dy[e.d] = dy[e.d] || []).push(e));
      let w = 0, stk = 0; Object.values(dy).forEach(a => { a.sort((x, y) => x.m - y.m); let cur = []; const fl = () => { if (cur.length) { w++; if (!cur.some(e => H.has(e.k)) && cur.length >= 2) stk++; } cur = []; };
        a.forEach(e => { if (cur.length && e.m - cur[cur.length - 1].m > 45) fl(); cur.push(e); }); fl(); });
      return { hv: L.filter(e => H.has(e.k)).map(e => Math.floor((e.m % 1440) / 60)), w, stk }; });
    const par = reg[R].pts.map((_, j) => j), fd = j => par[j] === j ? j : (par[j] = fd(par[j]));
    reg[R].pts.forEach((a, j) => reg[R].pts.forEach((b, l) => { if (l > j && a.ll && b.ll && nsKm(a.ll, b.ll) <= NS_BAN.clKm) par[fd(j)] = fd(l); }));
    const cl = {}; reg[R].pts.forEach((_, j) => (cl[fd(j)] = cl[fd(j)] || []).push(j));
    Object.values(cl).forEach(js => { const hv = js.flatMap(j => pe[j].hv), w = js.reduce((a, j) => a + pe[j].w, 0), stk = js.reduce((a, j) => a + pe[j].stk, 0), n16 = hv.filter(h => h >= 16 && h < 21).length;
      const ev = { nH: hv.length, n16, w, stk, pts: js.length };
      js.forEach(j => { const q = reg[R].pts[j], kc = q.ll && bz && bz.c ? nsKm(q.ll, bz.c) : null; let b;
        if (!bz || !q.ll) b = { m: "free" };
        else if (bz.zone) b = kc <= bz.r ? { m: "zone", allow: bz.allow } : { m: "free" };
        else if (kc > bz.r) b = { m: "free" };
        else if (hv.length >= 10 && n16 / hv.length >= 0.2) b = { m: "free" };
        else if (hv.length >= 3) { const al = []; if (hv.some(h => h >= 9 && h < 16)) al.push([540, 960]); if (hv.some(h => h >= 21 || h < 6)) al.push([1260, 1800]); if (hv.some(h => h >= 6 && h < 9)) al.push([360, 540]); b = { m: "obs", allow: al }; }
        else if (w >= 20 && stk / w >= 0.4) b = { m: "restr", allow: bz.allow };
        else b = { m: "unk" };
        q.ban = Object.assign(b, { ev, km: kc == null ? null : +kc.toFixed(1) }); }); });
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
  /* SOC chính = SOC nhiều đơn nhất. Tiền chuyển hàng giữa SOC (transit, chia lại xong chuyển) không tính vào D2S */
  const all = (x.socs || []).filter(o => o.sh > 0), shS = all.reduce((a, o) => a + o.sh, 0) || 1, main = all.slice().sort((a, b) => b.sh - a.sh)[0];
  /* CHUTE và TO (theo loại ngày): x.chutes[t] = [{ socs: [SOC được sort vào chute], to: SOC đích của TO }]; 1 chute = 1 TO, 1 TO đi đúng 1 SOC.
     Chute chỉ chứa SOC khác SOC đích → SOC đích chuyển tiếp nguyên túi (transit, không chia lại); chute trộn nhiều SOC → SOC đích chia lại các SOC khác nó.
     Mỗi SOC đích một đội xe (các chute cùng đích đi chung xe). SOC chưa nằm trong chute nào → vào chute đi SOC chính.
     Thiếu x.chutes[t]: x.ch[t] SOC nhiều đơn nhất có chute riêng, còn lại trộn vào chute SOC chính */
  const rank = all.slice().sort((a, b) => b.sh - a.sh), chN = t => Array.isArray(x.ch) ? x.ch[t] ?? x.ch[0] : x.ch, byS = Object.fromEntries(all.map(o => [o.s, o]));
  const chutesT = [0, 1, 2].map(t => { if (!main) return [];
    let L = Array.isArray(x.chutes) && Array.isArray(x.chutes[t]) ? x.chutes[t].map(c => ({ socs: (c.socs || []).filter(n => byS[n]), to: byS[c.to] ? c.to : null })).filter(c => c.socs.length) : null;
    if (!L) { const n = Math.max(1, +chN(t) || all.length); L = rank.slice(0, n).map(o => ({ socs: [o.s], to: o.s })); if (!L.some(c => c.to === main.s)) L[0] = { socs: [main.s], to: main.s }; }
    L.forEach(c => { if (!c.to) c.to = c.socs.includes(main.s) ? main.s : c.socs.map(n => byS[n]).sort((a, b) => b.sh - a.sh)[0].s; });
    const seen = new Set(); L = L.map(c => ({ to: c.to, socs: c.socs.filter(n => !seen.has(n) && seen.add(n)) })).filter(c => c.socs.length);
    const miss = all.filter(o => !seen.has(o.s)).map(o => o.s); if (miss.length) { let m = L.find(c => c.to === main.s); if (!m) L.push(m = { to: main.s, socs: [] }); m.socs.push(...miss); }
    return L.map(c => Object.assign(c, { mixed: c.socs.length > 1 })); });
  /* đội xe mỗi loại ngày: mỗi SOC đích một đội xe; fwd = SOC đích chuyển tiếp nguyên túi, rsm = SOC đích chia lại */
  const socsT = chutesT.map(L => [...new Set(L.map(c => c.to))].map(d => { const cs = L.filter(c => c.to === d), mem = cs.flatMap(c => c.socs);
    return Object.assign({}, byS[d], { sh: mem.reduce((a, n) => a + byS[n].sh, 0), fwd: cs.filter(c => !c.mixed).flatMap(c => c.socs).filter(n => n !== d), rsm: cs.filter(c => c.mixed).flatMap(c => c.socs).filter(n => n !== d) }); }));
  const socs = socsT[0];
  /* phần đơn SOC chính phải chia lại mỗi loại ngày = đơn các SOC không có chute */
  const rsSh = socsT.map(L => L.reduce((a, l) => a + l.rsm.reduce((b, n) => b + byS[n].sh, 0), 0) / shS);
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
  const mi = Math.max(0, NS_KS.indexOf(x.maxK)), ksAt = (km, wk) => NS_KS.slice(0, mi + 1).map((k, j) => ({ k, q: cap[j], p: G.price[k][kmI(km)] })).filter(v => v.q > 0 && (wk == null || hvOk[wk] || !HV.has(v.k)));
  /* 2. đội xe rẻ nhất chở Q đơn: n xe loại chính + 1 xe vừa phần lẻ (như Core), không quá 100% sức chở học được */
  const fleet = (Q, km, wk) => { if (Q <= 0) return { t: 0, c: 0, mix: {}, q: 0 }; let best = null; const ks = ksAt(km, wk);
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
  const chs = chutesT.map(L => L.length || 1), works = chs.map(workOf);
  const fmU = (1 - beta) * (ref.fm.rS + ref.fm.hS) + beta * (ref.fm.rS * ref.fm.rM + ref.fm.hS * ref.fm.hM);
  /* khung bàn giao của seller theo lượt: x.win[k] = [từ, đến] (phút từ 0h); thiếu thì theo khung COT của vùng, không trước giờ người bắt đầu làm (x.open) */
  const open = x.open ?? P.open, cots = G.cots.map((c, k) => { const w = (x.win || [])[k]; return { p: c.p, a0: c.a, b0: c.b, a: w ? w[0] : Math.max(c.a, open), b: w ? w[1] : c.b }; });
  const bays = Math.max(1, x.bays | 0), sh = G.cots.map((_, k) => Math.max(0, +(x.sh[k] || 0))), shT = sh.reduce((a, b) => a + b, 0) || 1;
  /* 3b. SOC đích: mỗi SOC một đội xe riêng, giá theo km tới SOC đó */
  const best = (Q, t, wk, gm) => socsT[t || 0].map(o => { const q = Q * o.sh / shS;
    /* mỗi cổng xe riêng: đội xe cho phần một cổng, nhân số cổng */
    if (gm === "each" && gates > 1) { const f = fleet(q / gates, o.km, wk), mix = {}; for (const k in f.mix) mix[k] = f.mix[k] * gates;
      return { t: f.t * gates, c: f.c * gates, mix, q: f.q * gates, gmix: f.mix, gates, s: [o.s], fwd: o.fwd || [], rsm: o.rsm || [], Q: q }; }
    return Object.assign(fleet(q, o.km, wk), { s: [o.s], fwd: o.fwd || [], rsm: o.rsm || [], Q: q }); });
  /* người tại điểm: FTE riêng (520k/ngày) · nhóm FM Hub (350k/ngày, như Core) · Rider PPS (700 đ/đơn, seller tự đóng hàng; rider quét lúc giao → cộng vào thời gian xe đứng) */
  const lab = x.lab === "hub" || x.lab === "pps" ? x.lab : "fte", pay = lab === "hub" ? P.hubPay : P.ftePay;
  const dwFix = x.dwFix != null && x.dwFix !== "" ? +x.dwFix : ref.dw.fix, dwRate = x.dwRate != null && x.dwRate !== "" ? +x.dwRate / 100 : ref.dw.rate;
  /* BÀN GIAO: cách seller nhả hàng trong khung (hoProf: even đều · end dồn x% vào 60′ cuối · lump một cục cuối khung · batch n đợt đều),
     tốc độ bàn giao mỗi cổng (hoRate đơn/giờ; trống = không giới hạn), seller thường giao trễ (late phút, mọi ngày),
     số cổng bàn giao (gates): mỗi cổng ≥ 1 người; xe lấy hàng nhiều cổng: tour = 1 xe đi vòng các cổng (+ gMove phút mỗi cổng thêm), each = mỗi cổng xe riêng, auto = chọn rẻ hơn mà kịp COT */
  const hoN = Math.max(2, Math.round(+x.hoN || 3)), gates = Math.max(1, Math.round(+x.gates || 1)), hoRate = +x.hoRate > 0 ? +x.hoRate : null, lateBase = Math.max(0, +x.late || 0);
  const gMove = x.gMove != null && x.gMove !== "" ? Math.max(0, +x.gMove) : NS_GATE.move, gMode = ["tour", "each"].includes(x.gMode) ? x.gMode : "auto";
  const tail = Math.min(1, Math.max(0, (+x.tail || 0) / 100)), prof = ["even", "end", "lump", "batch"].includes(x.hoProf) ? x.hoProf : (tail > 0 ? "end" : "even"), slackMin = Math.max(0, +x.slackMin || 0), osCap = +x.osCap > 0 ? Math.round(+x.osCap) : null;
  const stage = +x.area > 0 && +x.dens > 0 ? +x.area * +x.dens : null;   // số đơn tập kết được cùng lúc
  /* khoảng cách (chim bay × 1,3 như Core khi chưa có đường bộ) và đội xe rẻ nhất cho nhiều seller chung xe: mỗi seller chiếm q ÷ sức chở của chính nó */
  const R6 = 6371, hav = (a, b) => { const r = v => v * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * R6 * Math.asin(Math.min(1, Math.sqrt(h))) * 1.3; };
  const KS2 = NS_KS.slice(0, mi + 1), capN = cap.map(Math.round);
  const fleetUx = (loads, km, dt, wk) => { let best = null; const kmI0 = kmI(km);
    const one = KS2.filter(k => wk == null || hvOk[wk] || !HV.has(k)).map(k => { const j = NS_KS.indexOf(k); const U = loads.reduce((a, l) => a + (l.c[j] > 0 ? l.q / l.c[j] : 1e9), 0); return { k, U, p: G.price[k][kmI0] + (G.pkm[k] || 0) * (dt || 0) }; }).filter(o => o.U < 1e8);
    if (!one.length || loads.every(l => !(l.q > 0))) return { c: 0, t: 0, mix: {}, U: 0 };
    const add = (c, t, mix, U) => { if (!best || c < best.c - 1 || (Math.abs(c - best.c) <= 1 && t < best.t)) best = { c, t, mix, U }; };
    for (const m of one) { const n = Math.floor(m.U - 1e-9); add((n + 1) * m.p, n + 1, { [m.k]: n + 1 }, m.U);
      for (const u of one) { const ru = (m.U - n) * u.U / m.U; if (ru <= 1 + 1e-9) { const mix = {}; if (n > 0) mix[m.k] = n; mix[u.k] = (mix[u.k] || 0) + 1; add(n * m.p + u.p, n + 1, mix, m.U); } } }
    return best; };
  const fleetU = (loads, km, dt, wk) => fleetUx(loads, km, dt, wk).c;
  /* điểm D2S đang chạy được CHỌN để ghép xe (x.pick): xe chở chung ở các lượt và SOC hai bên cùng có hàng; tiền xe của seller mới = tiền xe chung − tiền xe các điểm đó chạy riêng */
  const llOk = !!(x.ll && x.ll.length === 2 && isFinite(x.ll[0]) && isFinite(x.ll[1]));
  /* ghép theo TUYẾN của kế hoạch Core: chọn một tuyến = xe chở chung với mọi điểm trên tuyến đó (điểm đang đi chung không tách ra được) */
  const rts = (G.rts || G.pts.map((_, j) => ({ m: [j], now: 1 }))).map((r, j) => ({ id: "r" + j, now: r.now, ps: r.m.map(i => G.pts[i]) }));
  const partners = llOk ? rts.filter(r => (x.pick || []).includes(r.id)).flatMap(r => r.ps.map(q => Object.assign({}, q, { rt: r.id }))).filter(q => q.ll).map(q => Object.assign(q, { km: hav(x.ll, q.ll) })).sort((a, b) => a.km - b.km) : [];
  /* LUẬT CẤM TẢI cho seller mới (x.ban: "auto" | "off"): theo điểm D2S gần nhất trong NS_BAN.near km có luật; HN ngoài đó thì theo vùng; HCM trong vùng nội đô mà không có điểm gần → chưa đủ dữ liệu */
  const ban = (() => { const bz = NS_BAN[x.R]; if (x.ban === "off") return { m: "off" }; if (!llOk || !bz) return { m: llOk ? "free" : "noll" };
    const near = G.pts.filter(q => q.ll && q.ban).map(q => ({ q, km: nsKm(x.ll, q.ll) })).filter(o => o.km <= NS_BAN.near).sort((a, b) => a.km - b.km);
    const kc = nsKm(x.ll, bz.c), src = near.find(o => o.q.ban.m !== "unk");
    if (bz.zone) return kc <= bz.r ? { m: "zone", allow: bz.allow, kc } : { m: "free", kc };
    if (src) return Object.assign({}, src.q.ban, { from: src.q.n, fromKm: +src.km.toFixed(1), kc });
    return kc <= bz.r ? { m: "unk", kc, from: near[0] ? near[0].q.n : null, fromKm: near[0] ? +near[0].km.toFixed(1) : null } : { m: "free", kc }; })();
  const AL = ban.allow || null, HV = new Set(NS_BAN.heavy);
  /* giờ sớm nhất ≥ t mà xe nặng được rời (khung có thể qua nửa đêm: phút > 1440) */
  const nextOk = t => { if (!AL) return t; let b = null; for (const [a, z] of AL) for (const o of [0, -1440, 1440]) { const A = a + o, Z = z + o; const c = t >= A && t < Z ? t : t < A ? A : null; if (c != null && (b == null || c < b)) b = c; } return b == null ? 1e9 : b; };
  /* lượt k: xe nặng dùng được nếu từ lúc hàng xong (≈ cuối khung bàn giao + 5′) tới hạn COT có khung được rời */
  const hvOk = cots.map(c => !AL || nextOk(c.b + P.closeMin) <= c.p);
  const chainKm = ps => { let d = 0, prev = x.ll; ps.forEach(q => { d += hav(prev, q.ll); prev = q.ll; }); return d; };
  const chainP = ps => { let d = 0; ps.forEach((q, j) => { if (j) d += hav(ps[j - 1].ll, q.ll); }); return d; };
  /* tiền xe các tuyến đó đang chạy (không có seller mới): mỗi tuyến một đội xe, km đi vòng giữa các điểm của tuyến */
  const aloneOf = (ps, kmS, wk) => { const g = {}; ps.forEach(o => (g[o.pj.rt] = g[o.pj.rt] || []).push(o)); return Object.values(g).reduce((a, L) => a + fleetU(L.map(o => ({ q: o.q, c: o.pj.c })), kmS, chainP(L.map(o => o.pj)), wk), 0); };
  /* lịch xe chung: điểm sẵn hàng trước lấy trước; tính ngược từ điểm cuối (như Core) để xe tới điểm sau vừa lúc hàng sẵn, không tới sớm rồi nằm chờ */
  const chainRun = stops => { stops.sort((a, b) => a.rd - b.rd);
    const dzs = stops.map(z => dwFix + dwRate * z.q), trs = stops.map((z, j) => j ? hav(stops[j - 1].ll, z.ll) / ref.dw.spd : 0), LD = [];
    for (let j = stops.length - 1; j >= 0; j--) LD[j] = j === stops.length - 1 ? stops[j].rd + P.closeMin : Math.min(stops[j].dl, LD[j + 1] - dzs[j + 1] - trs[j + 1]);
    let t0 = null, sl = 1e9, me = -1e9; const tt = [];
    stops.forEach((z, j) => { const dz = dzs[j], d0 = t0 == null ? Math.max(z.rd + P.closeMin, LD[j]) : Math.max(t0 + trs[j] + dz, z.rd + P.closeMin), arr = t0 == null ? d0 - dz : t0 + trs[j];
      t0 = d0; if (z.me) me = d0; sl = Math.min(sl, z.dl - d0); tt.push({ n: z.me ? null : z.n, me: z.me || 0, rd: z.rd, arr, dw: dz, dep: d0, dl: z.dl, q: z.q, km: z.km }); });
    return { tt, sl, me }; };
  /* 4. một loại ngày: xe từng lượt, người, giờ xe rời so với hạn COT */
  const day = (X, dly, t, prt, gm) => { prt = prt || partners; gm = gm || GM; const tD = t || 0; dly = dly || 0; const dl = lateBase + dly; if (!(X > 0)) return { X: 0, W: [], hc: 0, hc0: 0, short: 0, truck: 0, lab: 0, rs: 0, soc: 0, cost: 0, fm: 0, net: 0, trucks: 0, xs: 0, worst: 1e9 }; const wk = works[tD], w = wk.w, socs = socsT[tD];
    /* SOC chia lại: chia ít chute hơn số SOC phải chia thì phần (SOC − chute) ÷ SOC số đơn được SOC chính sort lại,
       năng suất như sort đủ chute tại điểm, 520k/người/ngày (như Seller Planner: soc.same, soc.pay) */
    const rs = X * rsSh[tD], socC = rs > 0 ? rs / workOf(st).prod * P.ftePay : 0;
    const W = cots.map((c, k) => { const Q = X * sh[k] / shT, legs = best(Q, tD, k, prt.length ? "tour" : gm), mix = {};
      if (prt.length) legs.forEach(l => { const z = l.s[0], kmS = (socs.find(o => o.s === z) || {}).km || 0;
        const ps = prt.map(pj => ({ pj, q: pj.ado * (pj.sh[k] || 0) * (pj.soc[z] || 0) })).filter(o => o.q > 0.5); if (!ps.length || !(l.Q > 0)) return;
        const m = fleetUx([{ q: l.Q, c: capN }].concat(ps.map(o => ({ q: o.q, c: o.pj.c }))), kmS, chainKm(ps.map(o => o.pj)), k), alone = aloneOf(ps, kmS, k);
        Object.assign(l, { c: Math.max(0, m.c - alone), t: m.t, mix: m.mix, q: m.t ? l.Q * m.t / Math.max(1e-9, m.U) : l.q, shared: ps.map(o => ({ n: o.pj.n, q: o.q, pj: o.pj })), fillAll: m.t ? m.U / m.t : 0 }); });
      /* chỗ tập kết không đủ chứa cả lượt: số xe ít nhất = ⌈đơn ÷ chỗ tập kết⌉ (xe phải lấy nhiều đợt); thêm xe cỡ nhỏ nhất đủ chở phần chia */
      let xs = 0; if (stage && legs.length) { const need = Math.ceil(Q / stage - 1e-9), t0 = legs.reduce((a, l) => a + l.t, 0);
        if (need > t0) { const L = legs.slice().sort((a, b) => b.Q - a.Q)[0], km = (socs.find(o => o.s === L.s[0]) || {}).km || 0, v = ksAt(km, k).find(u => u.q >= Q / need) || ksAt(km, k).slice(-1)[0];
          xs = need - t0; L.mix[v.k] = (L.mix[v.k] || 0) + xs; L.t += xs; L.c += xs * v.p; L.q += xs * v.q; } }
      legs.forEach(l => { for (const k2 in l.mix) mix[k2] = (mix[k2] || 0) + l.mix[k2]; });
      const t = legs.reduce((a, l) => a + l.t, 0), q = legs.reduce((a, l) => a + l.q, 0);
      const shr = legs.filter(l => l.shared), fill = shr.length ? shr.reduce((a, l) => a + l.fillAll * l.t, 0) / Math.max(1, shr.reduce((a, l) => a + l.t, 0)) : q ? Q / q : 0;
      return { k, c, Q, mix, t, xs, legs, hvBan: !hvOk[k], hv: Object.keys(mix).some(z => HV.has(z)), shared: [...new Set(shr.flatMap(l => l.shared.map(o => o.n)))], cost: legs.reduce((a, l) => a + l.c, 0), fill }; }).filter(v => v.Q > 0.5);
    /* giờ: đơn về trong khung [a, b] (tail % dồn vào 60' cuối); người làm theo năng suất; xe chất theo đợt chỗ chất */
    /* MÔ PHỎNG GIỜ theo bước 5′ (mỗi lượt): hàng seller nhả ra (kiểu nhả, trễ, tốc độ × số cổng) → người sort ngay khi hàng tới →
       xe đầy thì đi (xe lớn trước, tối đa `bays` xe chất cùng lúc). Tới hạn COT xe phải đóng tải và đi dù chưa đầy (xe vơi);
       hàng chưa kịp dồn sang lượt sau (thiếu chỗ thì gọi thêm xe, tính tiền); hàng dồn của lượt cuối vào lượt đầu hôm sau (chạy 2 vòng cho ổn định). */
    const STEP = 5;
    const sim = hc => { const per = lab === "pps" ? 0 : w * P.fteH * 60 / Math.max(1, hc), S = per > 0 ? STEP / per : 1e12, Rt = hoRate ? gates * hoRate * STEP / 60 : 1e12;
      const pass = cy0 => { let free = open, cS = cy0, cU = 0, worst = 1e9, rollC = 0, xr = 0, rollT = 0; const r = W.map(v => {
        const a = v.c.a + dl, b = Math.max(a, v.c.b + dl), Lc = v.c.p, Qn = v.Q, cy = cS + cU, Qt = Qn + cy, tour = gates > 1 && !v.legs.some(l => l.gates > 1);
        /* luỹ kế hàng seller định nhả tới giờ t (chưa tính giới hạn tốc độ) */
        const tgt = t => { if (t < a) return 0; if (prof === "lump") return t >= b ? Qn : 0;
          if (prof === "batch") return Qn * Math.min(1, Math.floor((t - a) / Math.max(1e-9, (b - a) / hoN) + 1e-9) / hoN);
          if (b <= a) return Qn; if (prof === "end" && tail > 0 && b - a > 60) { const m = b - 60; return t <= m ? Qn * (1 - tail) * (t - a) / (m - a) : Math.min(Qn, Qn * (1 - tail) + Qn * tail * (t - m) / 60); }
          return Math.min(Qn, Qn * (t - a) / (b - a)); };
        /* hàng về (As), đã sort (Ps) theo thời gian; người bắt đầu khi rảnh tay và đã tới giờ làm; hàng dồn đã sort sẵn sàng ngay */
        const sb = Math.max(open, free), t0 = Math.min(a, sb), tE = Math.max(Lc, b) + 900, ts = [], Ps = [], As = []; let An = 0, Pq = cS, hoEnd = null, doneT = null;
        for (let t = t0; t <= tE; t += STEP) { An = Math.min(tgt(t), An + Rt); const A = cy + An; if (t >= sb) Pq = Math.min(A, Pq + S);
          ts.push(t); Ps.push(Pq); As.push(A); if (hoEnd == null && An >= Qn - 1e-6) hoEnd = t; if (doneT == null && Pq >= Qt - 1e-6) doneT = t; if (doneT != null && t >= Lc) break; }
        const Pat = t => { const i = Math.floor((t - ts[0]) / STEP); return i < 0 ? cS : Ps[Math.min(Ps.length - 1, i)]; };
        const tAt = q => { for (let i = 0; i < Ps.length; i++) if (Ps[i] >= q - 1e-6) return ts[i]; return Infinity; };
        /* làn xe: mỗi SOC một đội xe; mỗi cổng xe riêng thì mỗi cổng một làn; 1 xe đi vòng các cổng thì cộng giờ chuyển cổng vào thời gian chất */
        const lanes = []; v.legs.forEach(l => { const sh = v.Q > 0 ? l.Q / v.Q : 0, cpu = l.shared ? (l.t ? l.q / l.t : 0) : null;
          const tr = m => Object.entries(m || {}).flatMap(([k, n]) => Array.from({ length: n }, () => ({ k, cap: cpu != null ? cpu : cap[NS_KS.indexOf(k)] }))).sort((p2, q2) => q2.cap - p2.cap);
          if (l.gates > 1 && !l.shared) for (let g = 0; g < l.gates; g++) lanes.push({ sh: sh / l.gates, trucks: tr(l.gmix) }); else lanes.push({ sh, trucks: tr(l.mix) }); });
        lanes.forEach(L => { L.q = Qt * L.sh; });
        /* hàng dồn từ lượt trước làm vượt chỗ xe của lượt này → gọi thêm xe rẻ nhất đủ chở phần dư (tính tiền) */
        lanes.forEach((L, li) => { const capL = L.trucks.reduce((p2, z) => p2 + z.cap, 0); if (L.q > capL + 0.5) { const km = (socs.find(o => o.s === ((v.legs[li] || v.legs[0] || {}).s || [])[0]) || socs[0] || {}).km || 0, f = fleet(L.q - capL, km, v.k);
            Object.entries(f.mix).forEach(([k, n]) => { for (let i = 0; i < n; i++) L.trucks.push({ k, cap: cap[NS_KS.indexOf(k)], extra: 1 }); }); rollC += f.c; xr += f.t; } });
        const all = []; lanes.forEach((L, li) => { let cum = 0; L.trucks.forEach(z => { const to = Math.min(cum + z.cap, L.q), ld = Math.max(0, to - cum);
          const dw0 = dwFix + dwRate * ld + (lab === "pps" ? ld / (P.ppsSpd / 60) : 0) + (tour ? gMove * (gates - 1) : 0);
          all.push({ li, k: z.k, cap: z.cap, from: cum, to, ld, tau: ld > 0 ? tAt(to / Math.max(1e-9, L.sh)) : Infinity, dw: dw0, extra: z.extra || 0 }); cum = to; }); });
        all.sort((p2, q2) => p2.tau - q2.tau);
        const dock = Array(bays).fill(-1e9), got = lanes.map(() => 0); let depL = null, dep1 = null, cut = 0, hvW = 0, loaded = 0, want = -1e9;
        all.forEach(z => { if (!(z.ld > 0)) { z.load = 0; return; } const L = lanes[z.li], mn = Math.min(...dock), di = dock.indexOf(mn);
          const start = Math.max(Math.min(z.tau, 1e9) - z.dw, mn); let dep = Math.max(z.tau + P.closeMin, start + z.dw);
          if (HV.has(z.k) && AL && isFinite(dep)) { const d2 = nextOk(dep); hvW = Math.max(hvW, d2 - dep); dep = d2; }
          if (!(dep <= Lc)) { /* tới hạn COT: đóng tải với phần đã sort xong (xe vơi); phần còn lại dồn lượt sau */
            const okDock = Math.max(z.tau === Infinity ? -1e9 : start, mn) <= Lc - P.closeMin, okHv = !(HV.has(z.k) && AL) || nextOk(Lc) <= Lc;
            const av = okDock && okHv ? Math.max(0, Math.min(z.to, Pat(Lc - P.closeMin) * L.sh) - Math.max(z.from, got[z.li])) : 0;
            z.load = Math.min(z.ld, av); z.cut = 1; want = Math.max(want, isFinite(dep) ? dep : 1e9); dep = Lc; if (z.load > 0.5) cut++; }
          else z.load = z.ld;
          z.dep = dep; got[z.li] = Math.max(got[z.li], z.from + z.load); if (z.load > 0.5) { dock[di] = dep; loaded += z.load; dep1 = dep1 == null ? dep : Math.min(dep1, dep); depL = depL == null ? dep : Math.max(depL, dep); } });
        const roll = Math.max(0, Qt - loaded) > 0.5 ? Qt - loaded : 0, sortedAtCut = Math.min(Qt, Pat(Lc - P.closeMin));
        /* dư COT: âm = xe lẽ ra phải rời trễ chừng ấy phút để chở hết (thay vì dồn hàng) */
        let slack = roll > 0 ? Math.min(-STEP, Lc - Math.min(want, (doneT != null ? doneT : tE) + P.closeMin + 120)) : Lc - (depL != null ? depL : Lc);
        cS = Math.max(0, Math.min(roll, sortedAtCut - loaded)); cU = Math.max(0, roll - cS); rollT += roll;
        free = doneT != null ? Math.min(doneT, Lc) : Lc;
        const used = all.filter(z => z.load > 0.5), capU = used.reduce((p2, z) => p2 + z.cap, 0);
        const curve = []; for (let i = 0; i < ts.length; i++) { if (ts[i] > Lc + 30) break; if (i % 3 === 0 || ts[i] === Lc) curve.push([ts[i], Math.round(As[i]), Math.round(Ps[i])]); }
        let dep = depL != null ? depL : Lc; const done = doneT != null ? doneT : Lc;
        const dw = used.length ? used.reduce((p2, z) => p2 + z.dw, 0) / used.length : dwFix;
        /* LỊCH CHẠY của lượt: mỗi điểm theo thứ tự xe ghé — hàng sẵn, xe tới, chất (phút), xe rời, hạn; rồi giờ tới SOC chính */
        let tt = [{ n: null, me: 1, rd: Math.min(done, Lc), arr: dep - dw, dw, dep, dl: Lc, q: used.length ? loaded / used.length : 0 }];
        /* xe chung: lấy điểm sẵn hàng trước, chạy sang điểm sau (km ÷ tốc độ trung vị vùng); điểm có sẵn không trễ hơn giờ xe thật đang rời */
        const ps = prt.filter(pj => v.shared.includes(pj.n) && pj.dep[v.k] != null);
        if (ps.length) { const qPer = q => q / Math.max(1, v.t), c = chainRun([{ me: 1, ll: x.ll, rd: Math.min(done, Lc), q: qPer(v.Q), dl: Lc }].concat(ps.map(pj => ({ n: pj.n, km: pj.km, ll: pj.ll, rd: pj.dep[v.k] - P.closeMin + dly, q: qPer(pj.ado * pj.sh[v.k]), dl: Math.max(Lc, pj.dep[v.k]) }))));
          dep = Math.max(dep, c.me); tt = c.tt.map(z => z.me ? Object.assign(z, { dep }) : z); slack = Math.min(slack, c.sl); }
        const last = tt[tt.length - 1], kmSoc = ((socs.slice().sort((p2, q2) => q2.sh - p2.sh)[0]) || {}).km || 0;
        const socArr = last.dep + kmSoc / ref.dw.spd;
        worst = Math.min(worst, slack);
        return { a, b, hoEnd, done, dep, dep1, slack, roll, carryIn: cy, cut, fillU: capU ? loaded / capU : 0, trk: used.map(z => ({ k: z.k, dep: z.dep, fill: z.cap ? z.load / z.cap : 0, cut: z.cut || 0, extra: z.extra })),
          curve, Qt, batch: 1, dw, tt, socArr, kmSoc, hvW, tour }; });
        return { r, worst, rollC, xr, rollT, rollDay: r.length ? r[r.length - 1].roll : 0 }; };
      const p1 = pass(0); return p1.rollDay > 0 ? pass(p1.rollDay) : p1; };
    const hc0 = lab === "pps" ? 0 : Math.max(1, gates, Math.ceil(X * w - 1e-9)); let hc = hc0, s = sim(Math.max(1, hc));
    /* trễ (hoặc dư dưới mức yêu cầu) thì thêm từng người, chỉ giữ khi giờ xe rời thật sự sớm hơn (trễ do chỗ chất xe thì thêm người không giúp) */
    if (lab !== "pps") while (s.worst < slackMin && hc < hc0 + P.maxExtra && (osCap == null || hc < osCap)) { const s2 = sim(hc + 1); if (s2.worst <= s.worst + 0.5) break; hc++; s = s2; }
    W.forEach((v, j) => Object.assign(v, s.r[j]));
    const truck = W.reduce((a, v) => a + v.cost, 0) + s.rollC, labC = lab === "pps" ? X * P.ppsRate : hc * pay, fm = X * fmU;
    return { X, W, hc, hc0, short: osCap != null && hc0 > osCap ? hc0 - osCap : 0, truck, lab: labC, rs, soc: socC, cost: truck + labC + socC, fm, net: fm - truck - labC - socC, trucks: W.reduce((a, v) => a + v.t, 0) + s.xr, xs: W.reduce((a, v) => a + v.xs, 0), xr: s.xr, rollC: s.rollC, roll: s.rollT, rollDay: s.rollDay, worst: s.worst, gm };
  };
  /* nhiều cổng: tính cả 2 cách xe lấy hàng trên hồ sơ đang nhập; tự chọn = ít hàng dồn hơn, rồi rẻ hơn */
  let GM = gMode === "each" ? "each" : "tour", gateCmp = null;
  if (gates > 1) { const sm = gm => { const D = x.ado.map((X, t) => ({ d: day(Math.max(0, +X || 0), 0, t, null, gm), n: +x.days[t] || 0 })).filter(o => o.d.X > 0 && o.n > 0);
      return { cost: D.reduce((a, o) => a + o.n * o.d.cost, 0), roll: D.reduce((a, o) => a + o.n * o.d.roll, 0), trucks: D.reduce((a, o) => a + o.n * o.d.trucks, 0), worst: D.length ? Math.min(...D.map(o => o.d.worst)) : 0, hc: Math.max(0, ...D.map(o => o.d.hc)) }; };
    gateCmp = { tour: sm("tour"), each: sm("each") };
    const better = gateCmp.each.roll < gateCmp.tour.roll - 0.5 || (Math.abs(gateCmp.each.roll - gateCmp.tour.roll) <= 0.5 && gateCmp.each.cost < gateCmp.tour.cost) ? "each" : "tour";
    gateCmp.pick = gMode === "auto" ? better : gMode; gateCmp.best = better; GM = gateCmp.pick; }
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
  /* HOÀ VỐN THÁNG: nhân cả bộ ADO đang nhập (giữ tỷ lệ BAU / Mini CP / CP và số ngày mỗi loại) tới mức nhỏ nhất mà cả tháng không lỗ.
     Tìm thô theo ADO của loại ngày đầu có đơn (bước 100 tới 3.000, 250 tới 20.000), rồi tìm mịn (bước 10) trong khoảng vừa vượt; ghi dải lỗ lại tới 2× */
  const ado0 = x.ado.map(v => Math.max(0, +v || 0)), dn = x.ado.map((_, t) => +x.days[t] || 0), bi = ado0.findIndex((v, t) => v > 0 && dn[t] > 0);
  const netM = a => ado0.reduce((s0, v, t) => { const X = Math.round(v * a / ado0[bi]); return dn[t] > 0 && X > 0 ? s0 + dn[t] * day(X, 0, t).net : s0; }, 0);
  const be = { ado: null, bands: [], base: bi };
  if (bi >= 0) { const g = []; for (let a = 100; a <= 3000; a += 100) g.push(a); for (let a = 3250; a <= 20000; a += 250) g.push(a);
    const nv = g.map(netM), j0 = nv.findIndex(v => v >= 0);
    if (j0 >= 0) { let a0 = g[j0]; for (let a = (j0 ? g[j0 - 1] : 0) + 10; a < g[j0]; a += 10) if (netM(a) >= 0) { a0 = a; break; }
      be.ado = ado0.map(v => Math.round(v * a0 / ado0[bi])); let cur = null;
      for (let j = j0; j < g.length && g[j] <= 2 * a0; j++) { if (nv[j] < 0) { if (!cur) be.bands.push(cur = [g[j], g[j]]); else cur[1] = g[j]; } else cur = null; } } }
  /* không hoà vốn ở mức đơn nào: tiền xe tối thiểu mỗi đơn (giá ÷ sức chở, cỡ rẻ nhất mỗi đơn, theo SOC) + tiền người + chia lại ≥ FM pickup.
     Cần sức chở gấp f lần mới có thể hoà vốn → quy ra số đơn tối thiểu một xe 1T9 */
  { const t0 = Math.max(0, bi), wk0 = works[t0], labO = lab === "pps" ? P.ppsRate : pay * wk0.w, socO = rsSh[t0] * P.ftePay / Math.max(1, workOf(st).prod);
    const trO = socsT[t0].reduce((a, o) => a + o.sh / shS * Math.min(...ksAt(o.km).map(v => v.p / v.q)), 0), room = fmU - labO - socO;
    be.floor = { truck: trO, lab: labO, soc: socO, fm: fmU, ok: room > 0 && trO < room }; }
  /* SỨC CHỞ HOÀ VỐN: ở đúng ADO đang nhập, xe 1T9 phải chở tối thiểu bao nhiêu đơn thì cả tháng không lỗ (đổi mọi cỡ xe cùng tỷ lệ, như ô seller báo).
     Chia đôi trên hệ số sức chở 0,2–8×; trên 8× coi như không đạt (tiền người / chia lại đã cao hơn FM pickup) */
  if (bi >= 0) { const c0 = cap.slice(), netAt = f => { for (let j = 0; j < cap.length; j++) cap[j] = c0[j] * f; try { return netM(ado0[bi]); } finally { for (let j = 0; j < cap.length; j++) cap[j] = c0[j]; } };
    if (netAt(8) < 0) be.cap1T9 = null; else { let lo = 0.2, hi = 8; if (netAt(lo) >= 0) hi = lo; else for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (netAt(mid) >= 0) hi = mid; else lo = mid; }
      be.cap1T9 = Math.ceil(c0[2] * hi / 10) * 10; } }
  /* số chuyến tối thiểu mỗi ngày (mỗi lượt có hàng × mỗi SOC đích của TO ≥ 1 xe): ở ADO thấp đây là lý do chở bao nhiêu cũng lỗ */
  if (bi >= 0 && days[bi].W) { const Wb = days[bi].W; be.minTrips = Wb.reduce((a, v) => a + v.legs.filter(l => l.Q > 0.5).length, 0); be.waves = Wb.length; be.dest = socsT[bi].length; be.cur1T9 = Math.round(cap[2]); }
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
  return { ban, gates, gateCmp, gm: GM, ho: { prof, hoN, hoRate, late: lateBase, gMove, tail: Math.round(tail * 100) }, chutes: chutesT, main: main ? main.s : null, rsSh, cap: NS_KS.map((k, j) => ({ k, q: Math.round(cap[j]), q0: Math.round(capLearn[j]), on: j <= mi, p: G.price[k][kmI(km0)] })), km0, how, pool: pool.map(s => s.n), work: works[0], works, fmU, days, month, thr, cots, open, lab, pay, dw: { fix: dwFix, rate: dwRate }, stage, slackMin, osCap, dly, late, pk: pk.t, ok: chk, verdict, thrs, thrBands: thrR.map(o => o.bands), be, mrg, picked: partners.map(q => q.n) };
}
if (typeof module !== "undefined") module.exports = { nsRef, nsPlan, NS_KS, NS_BAN };
