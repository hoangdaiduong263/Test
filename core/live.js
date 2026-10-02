/* LIVE: phát lại mô phỏng ngày đông của MỘT tuyến đề xuất (trong một gói) theo đồng hồ — thẻ phía trên để chuyển tuyến — bản đồ (điểm, SOC, FM Hub, xe, nhóm hub) + nhật ký sự kiện.
   Mọi mốc giờ lấy từ kết quả mô phỏng (r.hc(g).sim, nhóm hub t.seg): đây là phát lại, không tính lại. */
function Live(C, root, opts) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hm = m => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0"); };
  const short = i => C.nm(i).replace(/^(HN|HCM|DNCH|North|South)\s*(SPC|Seller)?\s*[-_]\s*/i, "").trim();
  const NS = "http://www.w3.org/2000/svg";
  let M = null, raf = null;

  /* ---------- dựng kịch bản phát lại từ kết quả mô phỏng ---------- */
  /* routes: các tuyến cần phát lại; opt.team: nhóm FTE chung đang xem (live theo nhóm) */
  function build(r, routes, opt) { opt = opt || {};
    const pts = [...new Set(routes.flat())], inP = new Set(pts), spd = C.simK().spd, ev = [], trucks = [], sorts = [], moves = [], dls = [];
    const geoP = i => C.geo(C.nm(i)), socs = {}, hubs = {}, teams = new Map();
    const many = routes.length > 1, tn = gi => many ? `tuyến ${gi + 1} · ` : "";
    const HC = opt.hc || r.hc;
    routes.forEach((g, gi) => { const h = HC(g); if (!h || !h.sim) return;
      h.sim.rows.forEach((s, si) => { const z0 = s.st[0], zl = s.st[s.st.length - 1], soc = (s.soc && C.geo(s.soc.split("|").pop()) ? s.soc.split("|").pop() : null) || C.socOf(zl.i), late = Math.max(...s.st.map(z => z.dep - z.dl));
        socs[soc] = C.geo(soc); const tS0 = s.soc ? C.toSocTo(z0.i, soc) : C.toSoc(z0.i), tS1 = s.soc ? C.toSocTo(zl.i, soc) : C.toSoc(zl.i);
        const way = [{ t: z0.arr - tS0, xy: socs[soc] }]; s.st.forEach(z => { way.push({ t: z.arr, xy: geoP(z.i) }, { t: z.dep, xy: geoP(z.i) }); }); way.push({ t: zl.dep + tS1, xy: socs[soc] });
        const tk = { id: `${gi + 1}.${si + 1}`, gi, n: s.nTr, way, late, soc }; trucks.push(tk);
        ev.push({ t: way[0].t, k: "truck", txt: `Xe ${tn(gi)}lượt ${hm(s.t)}${s.grp ? ` nhóm ${s.grp}/${s.of}` : ""} (${s.nTr} xe${s.soc ? ` · đơn đi ${s.soc.replace(/\|/g, " + ")}` : ""}) rời ${soc}` });
        ev.push({ t: way[way.length - 1].t, k: late > 0 ? "late" : "ok", txt: `Xe ${tn(gi)}lượt ${hm(s.t)} về ${soc}${late > 0 ? ` · trễ ${Math.round(late)}'` : ""}` });
        s.st.forEach(z => { const a = h.A[z.i], nm = short(z.i);
          dls.push({ gi, i: z.i, k: z.k, q: z.q, dl: z.dl, dep: z.dep, arr: z.arr, ls: z.ls, ready: z.ready, dwq: z.dwq, roll: z.roll || 0 });
          ev.push({ t: z.ready, k: "ready", txt: `Hàng sẵn · ${nm} (${Math.round(z.q)} đơn)` });
          ev.push({ t: z.arr, k: "truck", txt: `Xe tới ${nm}${z.ls > z.arr + 0.5 ? ` · chờ hàng ${Math.round(z.ls - z.arr)}'` : z.ready > z.arr + 0.5 ? ` · chất dần, chờ đơn cuối (${hm(z.ready)})` : ""}` });
          ev.push({ t: z.dep, k: z.dep > z.dl ? "late" : "ok", txt: `Xe rời ${nm} · ${z.dep > z.dl ? `trễ ${Math.round(z.dep - z.dl)}'` : `kịp, dư ${Math.round(z.dl - z.dep)}'`} (hạn ${hm(z.dl)})${z.roll >= 1 ? ` · dồn ${Math.round(z.roll)} đơn sang COT sau` : ""}` });
          if (z.dep > z.dl) ev.push({ t: z.dl, k: "late", txt: `⚠ Hạn COT ${hm(z.dl)} · ${nm}: xe chưa rời` });
          if (a.m !== "H") { const nn = a.m === "F" ? (a.n || C.fteBase(z.i)) : C.fteN(z.i), st = C.ownReady(z.i, nn)[z.k].st; sorts.push({ i: z.i, k: z.k, av: st, a: st, b: z.ready, n: nn, p0: st, p1: 1e9, who: a.m === "P" ? "seller đóng (PPS)" : `${nn} FTE riêng` });
            ev.push({ t: st, k: "sort", txt: `${a.m === "P" ? "Seller bắt đầu đóng hàng" : `${a.m === "F" ? (a.n || C.fteBase(z.i)) : C.fteN(z.i)} FTE riêng bắt đầu sort`} · ${nm}` }); }
          else teams.set(a.team.id, a.team); }); }); });
    if (opt.team) teams.set(opt.team.id, opt.team);
    teams.forEach(t => { const hg = C.geo(t.hub); if (hg) hubs[t.hub] = hg;
      t.seg.forEach(sg => { if (!inP.has(sg.i)) { if (sg.from != null && sg.from !== sg.i && inP.has(sg.from)) ev.push({ t: sg.leave, k: "team", txt: `FTE chung nhóm ${t.id} đi ${short(sg.from)} → ${short(sg.i)} (tuyến khác, ${Math.round(C.travel(sg.from, sg.i))}')` }); return; } sorts.push({ i: sg.i, k: sg.k, av: sg.av, a: sg.start, b: sg.end, n: t.n, p0: sg.start, p1: sg.end, who: `FTE chung nhóm ${t.id} (${t.n} người)` });
        ev.push({ t: sg.start, k: "sort", txt: `FTE chung nhóm ${t.id} (${t.n} người) bắt đầu sort · ${short(sg.i)}` });
        if (sg.from != null && sg.from !== sg.i && (!opt.team || t.id === opt.team.id)) { moves.push({ id: t.id, a: sg.leave, b: sg.leave + C.travel(sg.from, sg.i), p0: geoP(sg.from), p1: geoP(sg.i) });
          ev.push({ t: sg.leave, k: "team", txt: `FTE chung nhóm ${t.id} đi ${short(sg.from)} → ${short(sg.i)} (${Math.round(C.travel(sg.from, sg.i))}')` }); } }); });
    ev.sort((a, b) => a.t - b.t);
    const t0 = Math.floor((Math.min(...ev.map(e => e.t)) - 20) / 30) * 30, t1 = Math.ceil((Math.max(...ev.map(e => e.t)) + 20) / 30) * 30;
    /* hành trình của từng nhóm FTE chung trên bản đồ (live theo nhóm: chỉ nhóm đó) — từng chặng: đi đường from → i, rồi chờ hàng / sort tại i */
    const tracks = []; teams.forEach(t => { if (opt.team && t.id !== opt.team.id) return;
      const segs = t.seg.filter(sg => geoP(sg.i)).map(sg => { const mv = sg.from != null && sg.from !== sg.i && geoP(sg.from) ? C.travel(sg.from, sg.i) : 0; return { i: sg.i, k: sg.k, from: sg.from, start: sg.start, end: sg.end, hold: sg.hold ?? sg.end, leave: sg.leave, mv }; }).sort((a, b) => a.start - b.start);
      if (segs.length) tracks.push({ id: t.id, n: t.n, segs }); });
    /* điểm của tuyến khác mà nhóm FTE chung phải ghé: vẽ chấm nhạt để thấy người đi sang đó */
    const extra = [...new Set(tracks.flatMap(tr => tr.segs.map(sg => sg.i)))].filter(i => !inP.has(i));
    return { pts, geoP, socs, hubs, trucks, sorts, moves, dls, ev, t0, t1, routes, team: opt.team || null, tracks, extra, region: !!opt.region, HC };
  }

  /* ---------- TỒN tại điểm: mỗi lượt q đơn — có từ av (chờ sort) → sort a..b (chuyển dần sang chờ xe) → chất ls..dep (lên xe) ---------- */
  /* tồn từng lượt, tính theo từng 2 phút:
     đơn về dần trong khung nhận đơn của COT (hoặc về một lần lúc "có hàng từ" nếu chỉnh tay / vùng không có khung);
     người sort với năng suất của đúng số người đang dùng (đơn/phút), chỉ khi có mặt; xong hẳn lúc hàng sẵn; xe chất dần từ lúc bắt đầu chất tới lúc rời */
  function invOf(M) { const dt = 2, ts = []; for (let t = M.t0; t <= M.t1; t += dt) ts.push(t);
    const series = (i, d) => { const so = M.sorts.find(s => s.i === d.i && s.k === d.k) || { a: d.ready, n: 1, p0: d.ready, p1: 1e9 }, x = C.dlInfo(i).find(y => y.k === d.k) || {}, q = d.q;
      const win = x.avOv == null && x.win, A = t => win ? q * Math.min(1, Math.max(0, (t - x.a) / Math.max(1, x.b - x.a))) : (t >= (x.avOv ?? so.av ?? so.a) ? q : 0);
      const r = q / Math.max(0.1, C.durMin(i, q, so.n || 1)); let S = 0;
      return ts.map(t => { const a = A(t); if (t >= so.p0 && t < so.p1) S = Math.min(a, S + r * dt); if (t >= d.ready) S = q;
        /* xe chất với tốc độ chất thật (cả lượt mất dwq phút) nhưng chỉ chất được phần đã sort; rời lúc dep thì đã chất hết */
        /* xe rời: đã chất q − dồn; phần dồn nằm lại điểm tới lượt xe sau của điểm */
        const Ld = t < d.ls ? 0 : t >= d.dep ? q - (d.roll || 0) : q * (t - d.ls) / Math.max(1, d.dwq || d.dep - d.ls), L = Math.min(S, Ld);
        if (t >= d.dep && d.roll >= 1) { const nx = M.dls.filter(e => e.i === i && e.dep > d.dep).sort((a2, b2) => a2.dep - b2.dep)[0]; if (!nx || t >= nx.dep) return { u: 0, s: 0, late: 0, a }; }
        const u = Math.max(0, a - S), s2 = Math.max(0, S - L); return { u, s: s2, late: t > d.dl && t < d.dep ? u + s2 : 0, a }; }); };
    const add = (A, B) => A.map((v, k) => ({ u: v.u + B[k].u, s: v.s + B[k].s, late: v.late + B[k].late })), zero = ts.map(() => ({ u: 0, s: 0, late: 0 })), pc = {};
    const wave = {};   // chuỗi tồn của từng lượt (điểm|COT) để ghi nhãn trên bản đồ
    const rows = M.pts.map(i => { const L = M.dls.filter(d => d.i === i); L.forEach(d => { (pc[i] = pc[i] || []).push(d); }); return L.length ? { i, v: L.reduce((acc, d) => { const sr = wave[i + "|" + d.k] = series(i, d); return add(acc, sr); }, zero) } : null; }).filter(Boolean);
    const tot = { i: null, lab: M.region ? "Cả vùng" : "Cả tuyến", v: rows.reduce((acc, r) => add(acc, r.v), zero) };
    /* toàn vùng: tồn gom theo tuyến */
    if (M.region) { const R2 = M.routes.map((g, gi) => ({ i: null, lab: `Tuyến ${gi + 1} · ${g.length} điểm`, v: rows.filter(x => g.includes(x.i)).reduce((acc, x) => add(acc, x.v), zero) }));
      return { ts, wave, idx: t => Math.max(0, Math.min(ts.length - 1, Math.round((t - M.t0) / dt))), rows: [tot].concat(R2), at: (r, t) => r.v[Math.max(0, Math.min(ts.length - 1, Math.round((t - M.t0) / dt)))], dl: pc }; }
    return { ts, wave, idx: t => Math.max(0, Math.min(ts.length - 1, Math.round((t - M.t0) / dt))), rows: [tot].concat(rows), at: (r, t) => r.v[Math.max(0, Math.min(ts.length - 1, Math.round((t - M.t0) / dt)))], dl: pc }; }
  function invDraw(M) { const I = M.inv = invOf(M), W = 760, lw = 150, rh = 46, gap = 8, LN = M.team || M.region ? M.tracks : [], TL = LN.length * 36 + (LN.length ? 4 : 0), H = TL + I.rows.length * (rh + gap) + 18, x = t => lw + (t - M.t0) / (M.t1 - M.t0) * (W - lw - 8);
    const svg = root.querySelector("#lv-inv"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = "";
    const cp = el("clipPath", { id: "lv-clip" }, el("defs", {}, svg)); M.clip = el("rect", { x: lw, y: 0, width: 0, height: H }, cp);
    for (let t = Math.ceil(M.t0 / 120) * 120; t <= M.t1; t += 120) { el("line", { x1: x(t), x2: x(t), y1: 0, y2: H - 16, class: "lv-grid" }, svg); el("text", { x: x(t), y: H - 4, class: "lv-ax c" }, svg).textContent = hm(t); }
    /* dải của nhóm FTE chung: di chuyển (xám) · sort tại điểm (màu) · ở lại cho xe lên hàng (nhạt) · ▼ giờ xe rời điểm đó (đỏ nếu trễ) — cùng trục giờ với tồn */
    LN.forEach((tr, li) => { const y = 6 + li * 36, lg = el("g", {}, svg);
      el("text", { x: 0, y: y + 14, class: "lv-lab l" + (M.region ? " sm" : "") }, lg).textContent = `Nhóm ${tr.id} · ${tr.n} người`;
      el("line", { x1: lw, x2: W - 8, y1: y + 10, y2: y + 10, class: "lv-base" }, lg);
      tr.segs.forEach(sg => { const mv = sg.mv || 0;
        if (mv) el("rect", { x: x(sg.leave), y: y + 6, width: Math.max(1, x(sg.leave + mv) - x(sg.leave)), height: 8, class: "lv-tmv" }, lg);
        if ((sg.hold ?? sg.end) > sg.end + 0.5) el("rect", { x: x(sg.end), y: y + 4, width: Math.max(1, x(sg.hold) - x(sg.end)), height: 12, class: "lv-thold" }, lg);
        const bw = Math.max(2, x(sg.end) - x(sg.start)); el("rect", { x: x(sg.start), y: y + 2, width: bw, height: 16, rx: 3, class: "lv-tsort" }, lg);
        if (bw > 34) el("text", { x: x(sg.start) + 3, y: y + 14, class: "lv-tlab" }, lg).textContent = short(sg.i).slice(0, Math.floor(bw / 6));
        const d = M.dls.find(z => z.i === sg.i && z.k === sg.k); if (d) el("path", { d: `M${x(d.dep) - 4},${y + 22} L${x(d.dep) + 4},${y + 22} L${x(d.dep)},${y + 30} Z`, class: "lv-tdep" + (d.dep > d.dl ? " late" : "") }, lg); }); });
    M.invLab = I.rows.map((r, k) => { const y0 = TL + k * (rh + gap), mx = Math.max(1, ...r.v.map(v => v.u + v.s)), y = v => y0 + rh - v / mx * (rh - 4);
      el("text", { x: 0, y: y0 + 14, class: "lv-lab l" + (r.i == null ? "" : " sm") }, svg).textContent = r.lab || short(r.i).slice(0, 22);
      const val = el("text", { x: 0, y: y0 + 30, class: "lv-val" }, svg);
      el("line", { x1: lw, x2: W - 8, y1: y0 + rh, y2: y0 + rh, class: "lv-base" }, svg);
      const g = el("g", { "clip-path": "url(#lv-clip)" }, svg), area = (f0, f1) => "M" + I.ts.map((t, j) => `${x(t).toFixed(1)},${y(f1(r.v[j])).toFixed(1)}`).join("L") + "L" + I.ts.slice().reverse().map((t, j) => `${x(t).toFixed(1)},${y(f0(r.v[I.ts.length - 1 - j])).toFixed(1)}`).join("L") + "Z";
      el("path", { d: area(() => 0, v => v.u), class: "lv-a-u" }, g); el("path", { d: area(v => v.u, v => v.u + v.s), class: "lv-a-s" }, g);
      el("path", { d: area(() => 0, v => Math.min(v.late, v.u + v.s)), class: "lv-a-late" }, g);
      if (r.i != null) I.dl[r.i].forEach(d => { el("line", { x1: x(d.dl), x2: x(d.dl), y1: y0 + 2, y2: y0 + rh, class: "lv-dl" + (d.dep > d.dl ? " late" : "") }, svg); });
      return val; });
    M.invNow = el("line", { x1: lw, x2: lw, y1: 0, y2: H - 16, class: "lv-now" }, svg); M.invX = x; }
  function invUpd(M) { const t = M.t, X = M.invX(t); M.clip.setAttribute("width", Math.max(0, X - 150)); M.invNow.setAttribute("x1", X); M.invNow.setAttribute("x2", X);
    M.inv.rows.forEach((r, k) => { const v = M.inv.at(r, t), n = Math.round(v.u + v.s); M.invLab[k].textContent = n ? `${n.toLocaleString("vi-VN")} đơn${v.late > 0.5 ? " · quá hạn" : ""}` : "trống";
      M.invLab[k].setAttribute("class", "lv-val" + (v.late > 0.5 ? " bad" : "")); }); }

  /* ---------- chiếu toạ độ vào khung SVG ---------- */
  /* live theo nhóm: phóng vào các điểm của nhóm (xe đi về SOC ra ngoài khung); live theo tuyến: thấy cả SOC */
  function proj(M) { const all = (M.team ? M.team.pts.map(M.geoP) : M.region ? M.pts.map(M.geoP).concat(Object.values(M.hubs)) : M.pts.concat(M.extra || []).map(M.geoP).concat(Object.values(M.socs), Object.values(M.hubs))).filter(Boolean);
    const la = all.map(x => x[0]), lo = all.map(x => x[1]), c = Math.cos((Math.min(...la) + Math.max(...la)) / 2 * Math.PI / 180);
    const W = 760, H = M.region ? 640 : 460, px = M.region ? 90 : 120, py = 50, sx = (Math.max(...lo) - Math.min(...lo)) * c || 0.01, sy = (Math.max(...la) - Math.min(...la)) || 0.01, k = Math.min((W - 2 * px) / sx, (H - 2 * py) / sy);
    const ox = (W - sx * k) / 2, oy = (H - sy * k) / 2;
    return { W, H, f: g => g ? [ox + (g[1] - Math.min(...lo)) * c * k, H - oy - (g[0] - Math.min(...la)) * k] : null }; }

  /* chữ trên bản đồ không chồng nhau, không đè vòng tròn điểm: tên điểm thử lần lượt dưới / trên / phải / trái của chính điểm đó;
     chữ SOC, hub thì dời xuống từng nấc. Trạng thái điểm đi ngay dưới tên điểm */
  function unclash(svg) { const box = e => { const b = e.getBBox(); return { x: b.x - 2, y: b.y - 1, w: b.width + 4, h: b.height + 2 }; }, hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const done = [...svg.querySelectorAll("circle.lv-ring, path.lv-hub, rect.lv-soc")].map(c => { const b = c.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }), free = b => !done.some(d => hit(d, b));
    try {
      Object.values(M.ptEl).forEach(e => { const [x, y] = e.xy, L = e.lab, C = [[x, y + 28, "middle"], [x, y - 22, "middle"], [x + 20, y + 4, "start"], [x - 20, y + 4, "end"]];
        let b = null, ok = false; L.style.display = ""; for (const [cx, cy, an] of C) { L.setAttribute("x", cx); L.setAttribute("y", cy); L.style.textAnchor = an; b = box(L); if (free(b)) { ok = true; break; } }
        if (!ok && M.region) { L.style.display = "none"; return; }   // không còn chỗ: ẩn tên (rê chuột vào điểm để xem, phóng to để hiện)
        done.push(b); e.st.setAttribute("x", L.getAttribute("x")); e.st.setAttribute("y", +L.getAttribute("y") + 12); e.st.style.textAnchor = L.style.textAnchor; });
      [...svg.querySelectorAll("text.lv-lab")].filter(e => !Object.values(M.ptEl).some(p => p.lab === e)).forEach(e => { let b = box(e); for (let k = 0; k < 8 && !free(b); k++) { e.setAttribute("y", +e.getAttribute("y") + b.h); b = box(e); } done.push(b); });
    } catch (x) {} }
  const el = (tag, at, par) => { const e = document.createElementNS(NS, tag); Object.entries(at || {}).forEach(([k, v]) => e.setAttribute(k, v)); if (par) par.appendChild(e); return e; };
  const lerp = (w, t) => { if (t <= w[0].t) return null; for (let k = 1; k < w.length; k++) if (t <= w[k].t) { const a = w[k - 1], b = w[k], f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1; return [a.xy[0] + (b.xy[0] - a.xy[0]) * f, a.xy[1] + (b.xy[1] - a.xy[1]) * f]; } return null; };

  /* thẻ chọn tuyến đề xuất trong gói */
  const tabsOf = (r, p, gi) => p.nw.length < 2 ? "" : `<div class="lv-rt" role="tablist" aria-label="Tuyến đề xuất trong gói">${p.nw.map((g, k) => { const h = r.hc(g), bad = h && !h.ok;
    return `<button type="button" role="tab" aria-selected="${k === gi}" data-lvg="${k}" class="${bad ? "bad" : ""}"><b>Tuyến ${k + 1}</b> ${esc(g.map(short).join(" + ").slice(0, 48))}</button>`; }).join("")}</div>`;
  /* live MỘT tuyến đề xuất của gói */
  function open(r, p, title, gi) { gi = gi || 0; stop(); M = build(r, [p.nw[gi]]);
    show(r, `${title}${p.nw.length > 1 ? ` · tuyến ${gi + 1}/${p.nw.length}` : ""}`, tabsOf(r, p, gi), "ngày đông · phát lại mô phỏng");
    root.querySelectorAll("[data-lvg]").forEach(b => { b.onclick = () => open(r, p, title, +b.dataset.lvg); }); }
  /* live MỘT nhóm FTE chung: nhóm đi từ điểm sang điểm + mọi tuyến xe có điểm của nhóm (cùng trục giờ) */
  function openTeam(r, t, title) { stop(); const routes = r.T.filter(g => g.some(i => t.pts.includes(i))); M = build(r, routes, { team: t });
    const leg = routes.length > 1 ? `<div class="lv-rt">${routes.map((g, k) => `<span class="lv-rk"><b>Tuyến ${k + 1}</b> ${esc(g.map(short).join(" + ").slice(0, 60))}</span>`).join("")}</div>` : "";
    show(r, title, leg, `${t.n} người · ${t.pts.length} điểm · đi lại ${Math.round(t.mv || 0)}' ngày đông`); }
  /* live TOÀN VÙNG: mọi tuyến xe + mọi nhóm người; mode "plan" (kế hoạch) / "base" (hiện nay) */
  function openRegion(r, mode, onMode) { stop(); const base = mode === "base", routes = base ? r.T0 : r.T, HC = base ? (g => r.L0.routes[C.key(g)]) : r.hc;
    M = build(r, routes, { hc: HC, region: true });
    const L = base ? r.L0 : r.L1, nF = Object.values(L.A).filter(a => a.m === "F").length, nT = L.teams.length;
    const top = `<div class="lv-rt" role="tablist" aria-label="Kế hoạch hay hiện nay"><button type="button" role="tab" data-ovm="plan" aria-selected="${!base}"><b>Kế hoạch</b> ${r.T.length} tuyến</button><button type="button" role="tab" data-ovm="base" aria-selected="${base}"><b>Hiện nay</b> ${r.T0.length} tuyến</button></div>`;
    show(r, `Toàn vùng ${r.R} · ${base ? "hiện nay" : "kế hoạch"}`, top, `${routes.length} tuyến · ${M.pts.length} điểm · FTE riêng ${nF} điểm · FTE chung ${nT} nhóm · ngày đông`);
    root.querySelectorAll("[data-ovm]").forEach(b => { b.onclick = () => { openRegion(r, b.dataset.ovm, onMode); if (onMode) onMode(b.dataset.ovm); }; }); }
  /* vẽ bản đồ theo phép chiếu hiện tại (M.F đã gồm mức phóng): vẽ lại khi phóng / kéo để chữ giữ cỡ */
  function drawMap() {
    const svg = root.querySelector("#lv-svg"), F = M.F; svg.innerHTML = "";
    /* tuyến: đường nối các điểm theo thứ tự ghé rồi về SOC */
    M.trucks.forEach(tk => { el("polyline", { points: tk.way.map(w => F(w.xy).map(v => v.toFixed(1)).join(",")).join(" "), class: "lv-route" }, svg); });
    Object.entries(M.socs).forEach(([n, g]) => { const [x, y] = F(g); el("rect", { x: x - 9, y: y - 9, width: 18, height: 18, rx: 3, class: "lv-soc" }, svg); el("text", { x: x + 13, y: y + 4, class: "lv-lab" }, svg).textContent = n; });
    Object.entries(M.hubs).forEach(([n, g]) => { const [x, y] = F(g); el("path", { d: `M${x},${y - 9} L${x + 8},${y + 6} L${x - 8},${y + 6} Z`, class: "lv-hub" }, svg); el("text", { x: x + 11, y: y + 4, class: "lv-lab sm" }, svg).textContent = n.replace(/^\d+-\w+ /, ""); });
    (M.extra || []).forEach(i => { const xy = F(M.geoP(i)); if (!xy) return; const g = el("g", { class: "lv-ext" }, svg); el("circle", { cx: xy[0], cy: xy[1], r: 9, class: "lv-ring" }, g);
      el("text", { x: xy[0], y: xy[1] + 24, class: "lv-lab sm c" }, g).textContent = `${short(i).slice(0, 20)} (tuyến khác)`; el("title", {}, g).textContent = `${short(i)}: điểm của tuyến khác, nhóm FTE chung ghé`; });
    M.ptEl = {}; M.pts.forEach(i => { const xy = F(M.geoP(i)); if (!xy) return; const g = el("g", {}, svg);
      const ring = el("circle", { cx: xy[0], cy: xy[1], r: 15, class: "lv-ring" }, g); const dot = el("circle", { cx: xy[0], cy: xy[1], r: 11, class: "lv-pt s-idle" }, g);
      const lab = el("text", { x: xy[0], y: xy[1] + 28, class: "lv-lab c" }, g); lab.textContent = short(i).slice(0, 22);
      const tip = el("title", {}, g);
      const st = el("text", { x: xy[0], y: xy[1] + 41, class: "lv-st c" }, g); M.ptEl[i] = { dot, ring, st, xy, lab, tip }; });
    /* nhóm người: đường đi (nét đứt) + biểu tượng người luôn hiện — đứng ở điểm khi chờ / sort, chạy dọc đường khi di chuyển */
    M.tracks.forEach(tr => { const L = []; tr.segs.forEach(sg => { const xy = F(M.geoP(sg.i)); if (xy && (!L.length || L[L.length - 1] !== xy.join())) L.push(xy.join()); });
      if (L.length > 1) el("polyline", { points: L.join(" "), class: "lv-tpath" }, svg); });
    M.teamEl = {}; M.tracks.forEach(tr => { const g = el("g", { class: "lv-team" }, svg); el("circle", { r: 12, class: "bg" }, g);
      el("circle", { cx: 0, cy: -4, r: 3.2, class: "fg" }, g); el("path", { d: "M-6,7 Q-6,0 0,0 Q6,0 6,7 Z", class: "fg" }, g);
      el("text", { x: -16, y: 4, class: "lv-tname e" }, g).textContent = `N${tr.id}`; const st = el("text", { x: -16, y: 10, class: "lv-tst e" }, g);
      el("title", {}, g).textContent = `Nhóm FTE chung ${tr.id} · ${tr.n} người`; M.teamEl[tr.id] = { g, st, tr }; });
    unclash(svg);
    M.truckEl = M.trucks.map(tk => { const g = el("g", { class: "lv-truck" + (tk.late > 0 ? " late" : "") }, svg); el("rect", { x: -13, y: -8, width: 26, height: 16, rx: 4 }, g); el("text", { y: 4, class: "c" }, g).textContent = (M.routes.length > 1 ? (tk.gi + 1) + (tk.n > 1 ? "×" + tk.n : "") : tk.n > 1 ? "×" + tk.n : "xe"); return g; });
  }
  /* phóng / thu / kéo bản đồ: đổi phép chiếu rồi vẽ lại */
  function zoomUI() { const svg = root.querySelector("#lv-svg"), Z = M.Z, W = M.PW, H = M.PH;
    const apply = () => { M.F = g => { const p = M.F0(g); return p ? [(p[0] - Z.cx) * Z.k + W / 2, (p[1] - Z.cy) * Z.k + H / 2] : null; }; drawMap(); draw(); };
    const at = (k, sx, sy) => { const bx = (sx - W / 2) / Z.k + Z.cx, by = (sy - H / 2) / Z.k + Z.cy; Z.k = Math.max(1, Math.min(12, k)); Z.cx = bx - (sx - W / 2) / Z.k; Z.cy = by - (sy - H / 2) / Z.k; if (Z.k === 1) { Z.cx = W / 2; Z.cy = H / 2; } apply(); };
    const pt = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
    svg.addEventListener("wheel", e => { e.preventDefault(); const [x, y] = pt(e); at(Z.k * (e.deltaY < 0 ? 1.3 : 1 / 1.3), x, y); }, { passive: false });
    let drag = null; svg.addEventListener("pointerdown", e => { if (Z.k > 1) { drag = pt(e); svg.setPointerCapture(e.pointerId); } });
    svg.addEventListener("pointermove", e => { if (!drag) return; const p2 = pt(e); Z.cx -= (p2[0] - drag[0]) / Z.k; Z.cy -= (p2[1] - drag[1]) / Z.k; drag = p2; apply(); });
    svg.addEventListener("pointerup", () => { drag = null; });
    const box = root.querySelector(".lv-zoom"); if (box) { box.querySelector("[data-z='+']").onclick = () => at(Z.k * 1.5, W / 2, H / 2); box.querySelector("[data-z='-']").onclick = () => at(Z.k / 1.5, W / 2, H / 2); box.querySelector("[data-z='0']").onclick = () => at(1, W / 2, H / 2); } }
  function show(r, title, top, sub) {
    if (!M.ev.length) { root.hidden = false; root.innerHTML = `${top}<p class="empty">Thiếu chuyến thật để phát lại.</p>`; return; }
    const PJ = proj(M); M.F0 = PJ.f; M.F = PJ.f; M.PW = PJ.W; M.PH = PJ.H; M.Z = { k: 1, cx: PJ.W / 2, cy: PJ.H / 2 }; M.t = M.t0; M.speed = 60; M.play = false; M.seen = 0;
    root.hidden = false;
    root.innerHTML = `<header><h2>Live · ${esc(title)}</h2><span class="muted" style="font-size:12px">${esc(sub)}</span><button type="button" class="x" id="lv-x" aria-label="Đóng live">✕</button></header>${top}
      <div class="lv-ctl"><button type="button" class="btn" id="lv-play">▶ Chạy</button><button type="button" class="btn ghost" id="lv-reset">↺</button>
        <span class="lv-clock mono" id="lv-clock">${hm(M.t0)}</span>
        <input type="range" id="lv-scrub" min="${M.t0}" max="${M.t1}" step="1" value="${M.t0}" aria-label="Thời gian">
        <label class="muted" for="lv-speed">Tốc độ</label><select id="lv-speed"><option value="5">5 phút/giây</option><option value="15">15 phút/giây</option><option value="30">30 phút/giây</option><option value="60" selected>1 giờ/giây</option><option value="120">2 giờ/giây</option></select></div>
      <div class="lv-dlw" id="lv-dl"></div>
      <div class="lv-dlw" id="lv-tm"></div>
      <div class="lv-dlw" id="lv-tr"></div>
      <div class="lv-grid"><div class="lv-map"><div class="lv-zoom"><button type="button" data-z="+" aria-label="Phóng to">+</button><button type="button" data-z="-" aria-label="Thu nhỏ">−</button><button type="button" data-z="0" aria-label="Về toàn cảnh">⟲</button></div><svg id="lv-svg" viewBox="0 0 ${PJ.W} ${PJ.H}" role="img" aria-label="Bản đồ tuyến"></svg>
        <div class="lv-leg"><span><i class="s-idle"></i>chưa có hàng</span><span><i class="s-sort"></i>đang sort</span><span><i class="s-ready"></i>hàng chờ xe</span><span><i class="s-load"></i>xe đang chất</span><span><i class="s-done"></i>đã đi</span><span><i class="s-late"></i>quá hạn COT</span></div></div>
        <div class="lv-side"><div class="lv-kpi" id="lv-kpi"></div><ol class="lv-log" id="lv-log"></ol></div></div>
      <div class="lv-invw"><div class="lv-ih"><h3>Tồn tại điểm</h3><div class="lv-leg"><span><i class="s-sort"></i>chờ sort</span><span><i class="s-ready"></i>đã sort, chờ xe / đang chất</span><span><i class="s-late"></i>quá hạn COT chưa đi</span><span><b class="lv-dlk"></b>hạn COT</span></div></div>
        <div class="scroll"><svg id="lv-inv" role="img" aria-label="Tồn hàng tại từng điểm theo giờ"></svg></div></div>`;
    drawMap(); zoomUI();
    if (M.region) { root.querySelector("#lv-dl").innerHTML = `<p class="muted" style="margin:0;font-size:12px">Toàn vùng chỉ để xem. Muốn chỉnh giờ có hàng, hạn COT, số người, giờ xe: mở live từng tuyến (▶ ở bảng gói).</p>`; root.querySelector("#lv-tr").innerHTML = ""; root.querySelector("#lv-tm").innerHTML = ""; }
    else { dlTable(r); trTable(r); tmTable(); } invDraw(M); wire(); draw(); }

  /* ---------- bảng HẠN COT: sửa tay từng điểm × COT rồi chạy lại cả 2 bước ---------- */
  const toMin = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ""); return m ? +m[1] * 60 + +m[2] : null; };
  function dlTable(r) { const pts = M.pts, aOf = i => { const g = M.routes.find(x => x.includes(i)), h = g && r.hc(g); return h && h.A ? h.A[i] : null; }, info = Object.fromEntries(pts.map(i => [i, C.dlInfo(i)])), ks = [...new Set(pts.flatMap(i => info[i].map(x => x.k)))].sort((a, b) => a - b);
    const why = x => x.ov != null ? "chỉnh tay" : x.close ? "bàn giao cuối" : x.auto > x.p ? `nới: hiện nay rời ${hm(x.dep)}` : `Packed ${hm(x.p)}`;
    const whyA = x => x.avOv != null ? "chỉnh tay" : x.win ? `nhận đơn ${hm(x.a)}→${hm(x.b - 1)}` : `suy từ xe tới ${hm(x.arr)}`;
    const inp = (i, k, f, v, cls, lab) => `<input type="text" inputmode="numeric" pattern="[0-9]{1,2}:[0-9]{2}" maxlength="5" size="5" placeholder="hh:mm" id="${f}-${i}-${k}" data-i="${i}" data-k="${k}" data-f="${f}" value="${hm(v)}" class="${cls}" aria-label="${lab}">`;
    root.querySelector("#lv-dl").innerHTML = `<div class="lv-ih"><h3>Giờ có hàng, hạn COT &amp; số người</h3><span class="muted" style="font-size:12px">sửa giờ rồi bấm chạy lại · lưu trên trình duyệt này</span></div>
      <div class="scroll"><table class="lv-dlt"><thead><tr><th>Điểm</th>${ks.map(k => `<th>COT${k + 1}<br><span class="muted">có hàng từ → hạn</span></th>`).join("")}<th>FTE riêng<br><span class="muted">người</span></th></tr>
        <tr class="all"><td>Áp cho cả tuyến</td>${ks.map(k => `<td><div class="dlp"><input type="text" inputmode="numeric" maxlength="5" size="5" placeholder="có hàng" data-allk="${k}" data-allf="av" aria-label="Có hàng COT${k + 1} cả tuyến"><span class="muted">→</span><input type="text" inputmode="numeric" maxlength="5" size="5" placeholder="hạn" data-allk="${k}" data-allf="dl" aria-label="Hạn COT${k + 1} cả tuyến"></div></td>`).join("")}<td></td></tr></thead><tbody>${pts.map(i => `<tr><td>${esc(short(i))}</td>${ks.map(k => { const x = info[i].find(y => y.k === k);
        return x ? `<td><div class="dlp">${inp(i, k, "av", x.av, x.avOv != null ? "ov" : "", `Có hàng COT${k + 1} ${esc(short(i))}`)}<span class="muted">→</span>${inp(i, k, "dl", x.dl, x.ov != null ? "ov" : "", `Hạn COT${k + 1} ${esc(short(i))}`)}</div><small>${esc(whyA(x))} · ${esc(why(x))}</small></td>` : `<td class="muted">–</td>`; }).join("")}${(() => { const a = aOf(i), n = a && a.m === "F" ? a.n || C.fteBase(i) : C.fteBase(i), auto = C.fteN(i);
          return `<td><input type="number" min="1" max="99" step="1" id="hc-${i}" data-i="${i}" data-f="hc" value="${n}" class="hc${C.HCOV[C.nm(i)] != null ? " ov" : ""}" aria-label="FTE riêng ${esc(short(i))}"><small>${a && a.m !== "F" ? "đang dùng FTE chung" : n > C.fteBase(i) ? `tự thêm +${n - C.fteBase(i)}` : C.HCOV[C.nm(i)] != null ? "chỉnh tay" : `theo khối việc ${auto}`}</small></td>`; })()}</tr>`).join("")}</tbody></table></div>
      <div class="pbar" style="padding:8px 0 0"><button type="button" class="btn" id="lv-dlrun">Chạy lại</button><button type="button" class="btn ghost" id="lv-dlclr">Bỏ chỉnh tay các điểm này</button></div>`;
    root.querySelectorAll("#lv-dl [data-allk]").forEach(e => { e.oninput = () => { if (toMin(e.value) == null) return;
      root.querySelectorAll(`#lv-dl tbody input[data-k="${e.dataset.allk}"][data-f="${e.dataset.allf}"]`).forEach(x => { x.value = e.value; x.classList.add("chg"); }); }; });
    const send = clr => { const ch = []; root.querySelectorAll("#lv-dl tbody input").forEach(e => { const i = +e.dataset.i, k = +e.dataset.k, f = e.dataset.f;
      if (f === "hc") { const v = parseInt(e.value, 10), ov = C.HCOV[C.nm(i)]; if (clr) { if (ov != null) ch.push({ f, name: C.nm(i), v: null }); }
        else if (v >= 1 && e.classList.contains("chg")) ch.push({ f, name: C.nm(i), v: v === C.fteN(i) ? null : v }); return; }
      const x = info[i].find(y => y.k === k), v = toMin(e.value);
      const cur = f === "av" ? x.av : x.dl, auto = f === "av" ? x.avAuto : x.auto, ov = f === "av" ? x.avOv : x.ov;
      if (clr) { if (ov != null) ch.push({ f, name: C.nm(i), k, v: null }); } else if (v != null && v !== Math.round(cur)) ch.push({ f, name: C.nm(i), k, v: v === Math.round(auto) ? null : v }); });
      if (ch.length && opts && opts.onApply) opts.onApply(ch, pts); };
    root.querySelector("#lv-dlrun").onclick = () => send(false); root.querySelector("#lv-dlclr").onclick = () => send(true);
    root.querySelectorAll("#lv-dl tbody input").forEach(e => { e.oninput = () => e.classList.add("chg"); }); }

  /* ---------- bảng LỊCH XE: mỗi tuyến × lượt COT, sửa giờ xe tới điểm đầu ---------- */
  function trTable(r) { const rows = [], many = M.routes.length > 1;
    M.routes.forEach((g, gi) => { const h = r.hc(g); if (!h || !h.sim) return; const ov = C.truckOv(g), rk = C.rkey(g);
      h.sim.rows.forEach(s => { const z0 = s.st[0];
        rows.push(`<tr>${many ? `<td class="mono">${gi + 1}</td>` : ""}<td>COT${s.k + 1}${s.grp ? `<br><span class="chip info">nhóm xe ${s.grp}/${s.of}</span>` : ""}${s.soc ? `<br><span class="muted">→ ${s.soc.replace(/\|/g, " + ")}</span>` : ""}<br><span class="muted mono">${s.nTr} xe</span></td>
          <td><input type="text" inputmode="numeric" maxlength="5" size="5" data-rk="${esc(rk)}" data-k="${s.k}" data-v0="${Math.round(z0.arr)}" value="${hm(z0.arr)}" class="${ov[s.k] != null ? "ov" : ""}" aria-label="Xe tới điểm đầu tuyến ${gi + 1} COT${s.k + 1}">
            <small>${ov[s.k] != null ? "chỉnh tay" : `lúc hàng sẵn ở ${esc(short(z0.i))}`}</small></td>
          <td><div class="trs">${s.st.map(z => `<span class="${z.late > 0 ? "neg" : ""}"><b>${esc(short(z.i))}</b> tới ${hm(z.arr)}${z.ls > z.arr + 0.5 ? ` (chờ hàng ${Math.round(z.ls - z.arr)}')` : z.ready > z.arr + 0.5 ? ` (chất dần tới ${hm(z.ready)})` : ""} · rời ${hm(z.dep)} · hạn ${hm(z.dl)}${z.late > 0 ? ` · trễ ${Math.round(z.late)}'` : ""}${z.roll >= 1 ? ` · dồn ${Math.round(z.roll)} đơn` : ""}</span>`).join("<i>→</i>")}</div></td></tr>`); }); });
    const el2 = root.querySelector("#lv-tr"); if (!rows.length) { el2.innerHTML = ""; return; }
    el2.innerHTML = `<div class="lv-ih"><h3>Lịch xe</h3><span class="muted" style="font-size:12px">sửa giờ xe tới điểm đầu của lượt · xe tới trước giờ hàng sẵn thì đứng chờ</span></div>
      <div class="scroll"><table class="lv-dlt lv-trt"><thead><tr>${many ? "<th>Tuyến</th>" : ""}<th>Lượt</th><th>Xe tới điểm đầu</th><th>Thứ tự ghé · giờ tới / rời từng điểm</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
      <div class="pbar" style="padding:8px 0 0"><button type="button" class="btn" id="lv-trrun">Chạy lại với giờ xe này</button><button type="button" class="btn ghost" id="lv-trclr">Bỏ chỉnh giờ xe</button></div>`;
    const send = clr => { const ch = []; el2.querySelectorAll("input[data-rk]").forEach(e => { const rk = e.dataset.rk, k = +e.dataset.k, v = toMin(e.value), has = (C.TROV[rk] || {})[k] != null;
      if (clr) { if (has) ch.push({ f: "tr", rk, k, v: null }); } else if (v != null && e.classList.contains("chg") && v !== +e.dataset.v0) ch.push({ f: "tr", rk, k, v }); });
      if (ch.length && opts && opts.onApply) opts.onApply(ch, M.pts); };
    el2.querySelector("#lv-trrun").onclick = () => send(false); el2.querySelector("#lv-trclr").onclick = () => send(true);
    el2.querySelectorAll("input[data-rk]").forEach(e => { e.oninput = () => e.classList.add("chg"); }); }

  /* ---------- LỊCH NHÓM FTE CHUNG: từng chặng, đặt cạnh giờ xe của đúng điểm × COT ---------- */
  function tmTable() { const e = root.querySelector("#lv-tm"), t = M.team; if (!t) { e.innerHTML = ""; return; }
    const rows = t.seg.map((sg, k) => { const d = M.dls.find(x => x.i === sg.i && x.k === sg.k), mv = sg.from != null && sg.from !== sg.i ? C.travel(sg.from, sg.i) : 0, wait = mv ? Math.max(0, sg.start - (sg.leave + mv)) : 0;
      return `<tr><td class="mono">${k + 1}</td><td><b>${esc(short(sg.i))}</b> · COT${sg.k + 1}<br><span class="muted mono">${Math.round(sg.q)} đơn</span></td>
        <td class="mono">${mv ? `${hm(sg.leave)} → ${hm(sg.leave + mv)}<br><span class="muted">${Math.round(mv)}' từ ${esc(short(sg.from))}</span>` : `<span class="muted">bắt đầu ca</span>`}</td>
        <td class="mono">${hm(sg.start)} → ${hm(sg.end)}${wait >= 1 ? `<br><span class="muted">chờ hàng ${Math.round(wait)}'</span>` : ""}</td>
        <td class="mono">${hm(sg.hold ?? sg.end)}${(sg.hold ?? sg.end) > sg.end + 0.5 ? `<br><span class="muted">ở lại ${Math.round(sg.hold - sg.end)}' cho xe</span>` : ""}</td>
        <td class="mono">${d ? `${hm(d.arr)} / ${hm(d.dep)}` : "–"}${d && M.routes.length > 1 ? `<br><span class="muted">tuyến ${d.gi + 1}</span>` : ""}</td><td class="mono ${d && d.dep > d.dl ? "neg" : ""}">${d ? hm(d.dl) : "–"}${d && d.dep > d.dl ? `<br>trễ ${Math.round(d.dep - d.dl)}'` : ""}</td></tr>`; });
    e.innerHTML = `<div class="lv-ih"><h3>Lịch nhóm FTE chung ${t.id} · ${t.n} người</h3><span class="muted" style="font-size:12px">đi theo hạn COT sớm nhất trước · di chuyển ${P0.hubSpd} km/h · nhóm ở lại tới khi xe lên hàng xong mới đi tiếp</span></div>
      <div class="scroll"><table class="lv-dlt"><thead><tr><th>#</th><th>Điểm · lượt</th><th>Di chuyển</th><th>Sort</th><th>Rời điểm</th><th>Xe tới / rời</th><th>Hạn COT</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`; }
  const P0 = C.P;

  /* ---------- vẽ trạng thái ở thời điểm M.t ---------- */
  function stateOf(i, t) { const L = M.dls.filter(d => d.i === i).sort((a, b) => a.dep - b.dep), cur = L.find(d => d.dep > t);
    if (!cur) return L.length && t >= L[L.length - 1].dep ? ["s-done", ""] : ["s-idle", ""];
    if (t > cur.dl) return ["s-late", `trễ ${Math.round(t - cur.dl)}'`];
    if (t >= cur.ls) return ["s-load", "đang chất"];
    if (t >= cur.ready) return ["s-ready", t >= cur.arr ? "xe chờ…" : "chờ xe"];
    /* đang sort: nhãn theo số đơn — còn bao nhiêu đơn chờ sort, hay đã sort kịp phần đơn đã về (đơn của lượt còn về tiếp) */
    const sr = M.inv && M.inv.wave[i + "|" + cur.k]; if (sr) { const v = sr[M.inv.idx(t)]; if (v.a > 0.5) return v.u >= 1 ? ["s-sort", `còn ${Math.round(v.u).toLocaleString("vi-VN")} chờ sort`] : ["s-sort", `sort kịp · ${Math.round(v.a / Math.max(1, cur.q) * 100)}% đơn đã về`]; }
    return ["s-idle", ""]; }
  function draw() { const t = M.t, F = M.F; invUpd(M);
    root.querySelector("#lv-clock").textContent = hm(t); root.querySelector("#lv-scrub").value = Math.round(t);
    let late = 0, worst = 0, sorting = 0; M.pts.forEach(i => { const e = M.ptEl[i]; if (!e) return; const [c, txt] = stateOf(i, t); e.dot.setAttribute("class", "lv-pt " + c); e.ring.setAttribute("class", "lv-ring " + c); e.st.textContent = M.region ? "" : txt; e.tip.textContent = `${short(i)}${txt ? " · " + txt : ""}`;
      if (c === "s-sort") sorting++; });
    M.dls.forEach(d => { if (t > d.dl && d.dep > d.dl) { late++; worst = Math.max(worst, Math.min(t, d.dep) - d.dl); } });
    let road = 0; M.trucks.forEach((tk, k) => { const xy = lerp(tk.way, t), g = M.truckEl[k]; if (!xy || t >= tk.way[tk.way.length - 1].t) { g.setAttribute("visibility", "hidden"); return; }
      road += tk.n; const [x, y] = F(xy); g.setAttribute("visibility", "visible"); g.setAttribute("transform", `translate(${x.toFixed(1)},${(y - 18).toFixed(1)})`); });
    const teamTxt = []; Object.values(M.teamEl).forEach(({ g, st, tr }) => { const p = teamAt(tr, t);
      if (!p) { g.setAttribute("visibility", "hidden"); return; } g.setAttribute("visibility", "visible"); g.setAttribute("class", "lv-team " + p.c);
      g.setAttribute("transform", `translate(${(p.xy[0] - 30).toFixed(1)},${p.xy[1].toFixed(1)})`); st.textContent = ""; g.querySelector("title").textContent = `Nhóm ${tr.id} · ${tr.n} người: ${p.txt}`; teamTxt.push(`Nhóm ${tr.id}: ${p.txt}`); });
    const fin = M.dls.filter(d => d.dep <= t), ok = fin.filter(d => d.dep <= d.dl).length, rolled = fin.reduce((a, d) => a + (d.roll || 0), 0);
    root.querySelector("#lv-kpi").innerHTML = `<div><span>Xe đang chạy</span><b class="mono">${road}</b></div><div><span>Điểm đang sort</span><b class="mono">${sorting}</b></div>
      ${!M.region && M.tracks.length ? `<div class="wide"><span>Người (FTE chung)</span><b>${esc(teamTxt.map(x => x.replace(/^Nhóm (\d+)/, "N$1")).join(" · ") || "chưa vào ca")}</b></div>` : M.region && M.tracks.length ? (() => { const c = { mv: 0, sort: 0, load: 0, wait: 0 }; M.tracks.forEach(tr => { const p = teamAt(tr, t); if (p && c[p.c] != null) c[p.c]++; });
        return `<div class="wide"><span>Nhóm FTE chung (${M.tracks.length})</span><b>${c.mv} đi đường · ${c.sort} đang sort · ${c.load} ở lại cho xe · ${c.wait} chờ hàng</b></div>`; })() : ""}<div><span>Lượt đã đi · kịp</span><b class="mono">${ok}/${fin.length}</b></div><div><span>Đơn dồn sang COT sau</span><b class="mono">${Math.round(rolled).toLocaleString("vi-VN")}</b></div><div class="${late ? "bad" : ""}"><span>Quá hạn COT</span><b class="mono">${late}${late ? ` · ${Math.round(worst)}'` : ""}</b></div>`;
    const n = M.ev.filter(e => e.t <= t).length; if (n !== M.seen) { const log = root.querySelector("#lv-log");
      log.innerHTML = M.ev.slice(0, n).reverse().slice(0, 60).map((e, k) => `<li class="${e.k}${k === 0 && n > M.seen ? " new" : ""}"><span class="mono">${hm(e.t)}</span>${esc(e.txt)}</li>`).join(""); M.seen = n; } }

  /* ---------- điều khiển ---------- */
  /* vị trí & trạng thái nhóm lúc t */
  function teamAt(tr, t) { const S = tr.segs, xyOf = i => M.F(M.geoP(i)); if (!S.length || t < S[0].start - (S[0].mv || 0)) return null;
    for (const s of S) if (s.mv && t >= s.leave && t < s.leave + s.mv) { const a = xyOf(s.from), b = xyOf(s.i), f = (t - s.leave) / s.mv; if (a && b) return { xy: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], c: "mv", txt: `đi ${short(s.from)} → ${short(s.i)} (${Math.round(s.leave + s.mv - t)}')` }; }
    let cur = S[0]; for (const s of S) if ((s.mv ? s.leave + s.mv : s.start) <= t) cur = s; const xy = xyOf(cur.i); if (!xy) return null;
    return t < cur.start ? { xy, c: "wait", txt: `chờ hàng ở ${short(cur.i)}` } : t < cur.end ? { xy, c: "sort", txt: `sort ở ${short(cur.i)} · COT${cur.k + 1}` }
      : t < cur.hold ? { xy, c: "load", txt: `ở lại ${short(cur.i)} cho xe lên hàng (tới ${hm(cur.hold)})` } : { xy, c: "idle", txt: cur === S[S.length - 1] ? "xong ca" : `xong ${short(cur.i)}, chờ đi tiếp` }; }
  /* live theo nhóm: chậm lại còn tối đa 3 phút/giây khi nhóm đang đi đường để thấy người di chuyển */
  const moving = t => M.team && M.tracks.some(tr => tr.segs.some(s => s.mv && t >= s.leave - 1 && t < s.leave + s.mv + 1));
  function tick(ts) { if (!M || !M.play) return; if (M.last != null) M.t = Math.min(M.t1, M.t + (ts - M.last) / 1000 * (moving(M.t) ? Math.min(M.speed, 3) : M.speed)); M.last = ts; draw();
    if (M.t >= M.t1) { M.play = false; root.querySelector("#lv-play").textContent = "▶ Chạy"; return; } raf = requestAnimationFrame(tick); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; if (M) { M.play = false; M.last = null; } }
  function wire() { const b = root.querySelector("#lv-play");
    b.onclick = () => { if (M.play) { stop(); b.textContent = "▶ Chạy"; return; } if (M.t >= M.t1) M.t = M.t0; M.play = true; M.last = null; b.textContent = "❚❚ Dừng"; raf = requestAnimationFrame(tick); };
    root.querySelector("#lv-reset").onclick = () => { stop(); b.textContent = "▶ Chạy"; M.t = M.t0; M.seen = -1; draw(); };
    root.querySelector("#lv-scrub").oninput = e => { M.t = +e.target.value; M.seen = -1; draw(); };
    root.querySelector("#lv-speed").onchange = e => { M.speed = +e.target.value; };
    root.querySelector("#lv-x").onclick = () => { stop(); M = null; root.hidden = true; root.innerHTML = ""; }; }
  return { open, openTeam, openRegion, close: () => { stop(); M = null; root.hidden = true; root.innerHTML = ""; } };
}
