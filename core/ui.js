/* Trang D2S Core: chọn vùng → chạy Core.run(R) → hiện dải 2 bước, các gói, tuyến bị loại, tham số */
(function () {
  const C = Core(D, REF), P = C.P;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tr = x => (x / 1e6).toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const sg = x => (x >= 0 ? "+" : "−") + tr(Math.abs(x));
  const hm = m => { if (m == null || !isFinite(m)) return "–"; const x = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0"); };
  const mins = m => (m > 0 ? "+" : "") + Math.round(m) + "'";
  const short = i => C.nm(i).replace(/^(HN|HCM|DNCH|North|South)\s*(SPC|Seller)?\s*[-_]\s*/i, "").trim();
  const ORDER = ["HN", "HCM", "North", "South", "DNCH"];
  const REGS = ORDER.filter(R => C.nodes(R).length);
  const ST = { R: null, res: {}, open: new Set() };
  try { const s = localStorage.getItem("d2s-core-R"); if (REGS.includes(s)) ST.R = s; } catch (e) {}
  ST.R = ST.R || REGS[0];

  const res = R => ST.res[R] || (ST.res[R] = C.run(R));
  const K = Calib(C, REF), CAL = {}, GAP = {}; ST.line = "1"; try { ST.line = localStorage.getItem("d2s-core-line") || "1"; } catch (e) {}
  /* hạn COT chỉnh tay: lưu trên trình duyệt, nạp lại khi mở trang */
  try { const o = JSON.parse(localStorage.getItem("d2s-core-dl") || "{}"), ld = (M, f) => Object.entries(M || {}).forEach(([n, m]) => Object.entries(m).forEach(([k, v]) => f(n, +k, v)));
    if (o.dl || o.av || o.hc || o.tr) { ld(o.dl, C.setDeadline); ld(o.av, C.setAvail); Object.entries(o.hc || {}).forEach(([n, v]) => C.setHC(n, v)); ld(o.tr, C.setTruck); } else ld(o, C.setDeadline); } catch (e) {}
  const LV = Live(C, $("live"), { onApply(ch, pts) { ch.forEach(c => c.f === "tr" ? C.setTruck(c.rk, c.k, c.v) : c.f === "hc" ? C.setHC(c.name, c.v) : (c.f === "av" ? C.setAvail : C.setDeadline)(c.name, c.k, c.v)); try { localStorage.setItem("d2s-core-dl", JSON.stringify({ dl: C.DLOV, av: C.AVOV, hc: C.HCOV, tr: C.TROV })); } catch (e) {}
    const R = ST.R; delete ST.res[R]; ST.open.clear(); document.querySelector(".wrap").classList.add("busy");
    setTimeout(() => { const r = res(R); document.querySelector(".wrap").classList.remove("busy"); render();
      /* mở lại tuyến có nhiều điểm chung nhất với tuyến đang xem (kế hoạch có thể đổi sau khi chạy lại) */
      let bk = null, bn = 0; r.T.forEach(g => { const n = g.filter(i => pts.includes(i)).length; if (n > bn) { bn = n; bk = C.key(g); } });
      if (bk) openRoute(r, bk); else LV.close(); }, 20); } });
  /* live một tuyến kế hoạch (các tuyến cùng gói hiện thành thẻ để chuyển) */
  function openRoute(r, k) { const g = r.T.find(x => C.key(x) === k); if (!g) return; const p = r.packs.find(p => p.nw.some(x => C.key(x) === k));
    if (p) LV.open(r, p, `${r.R} · ${names(g)}`, p.nw.findIndex(x => C.key(x) === k)); else LV.open(r, { cut: [g], nw: [g] }, `${r.R} · ${names(g)}`, 0); }

  const rt = g => `<span class="rt">${g.map(i => `<span class="pt" title="${esc(C.nm(i))}">${esc(short(i))}</span>`).join("<i>·</i>")}</span>`;
  const names = g => g.map(i => esc(short(i))).join(" · ");
  const modeOf = (g, h, i) => h.A && h.A[i] ? C.modeTxt(h.A[i], i) : "FTE riêng";
  const DAYS = () => (C.LH ? C.LH.filter(Boolean).length : C.DATES.length) || 1;

  /* GIÁ TRỊ: theo nhóm thay đổi (các tuyến phải làm cùng nhau vì đổi chỗ điểm cho nhau) và theo từng tuyến "làm riêng"
     (chỉ kéo điểm của tuyến ra khỏi tuyến hiện nay, phần còn lại giữ nguyên). Người tính theo điểm. */
  const VAL = new WeakMap();
  function values(r) { if (VAL.has(r)) return VAL.get(r); const lab = g => g.reduce((a, i) => a + (r.L0.cost[i] || 0) - (r.L1.cost[i] || 0), 0);
    const pk = r.packs.map(p => ({ p, net: p.net, routes: p.nw.map(g => ({ g, h: r.hc(g), k: C.key(g), isNew: true, solo: C.standalone(r, g) + lab(g), xs: C.standalone(r, g), ls: lab(g),
      from: p.cut.filter(b => b.some(i => g.includes(i))) })).sort((a, b) => b.solo - a.solo) }));
    pk.sort((a, b) => b.net - a.net);
    const inP = new Set(r.packs.flatMap(p => p.nw.flat())), keep0 = r.T.filter(g => !g.some(i => inP.has(i)));
    /* tuyến giữ nguyên mà tiền người đổi: do nhóm FTE chung của nó (hiện nay hoặc kế hoạch) có điểm thuộc một nhóm thay đổi → tính vào nhóm thay đổi đó */
    const owner = g => { for (const i of g) for (const A of [r.L0.A, r.L1.A]) { const t = A[i] && A[i].m === "H" ? A[i].team : null; if (!t) continue;
      const x = pk.find(P0 => P0.p.nw.some(h => h.some(j => t.pts.includes(j)))); if (x) return x; } return null; };
    const keep = []; keep0.forEach(g => { const d = lab(g), o = Math.abs(d) >= 0.05e6 ? owner(g) : null;
      if (o) { o.net += d; o.side = (o.side || 0) + d; (o.sideR = o.sideR || []).push({ g, d }); if (Math.abs(r.xCost(g)) >= 0.05e6) keep.push({ g, v: -r.xCost(g) }); }
      else if (Math.abs(d - r.xCost(g)) >= 0.05e6) keep.push({ g, v: d - r.xCost(g) }); });
    pk.sort((a, b) => b.net - a.net);
    const kv = keep.reduce((a, x) => a + x.v, 0);
    const out = { pk, keep: keep.map(x => Object.assign(x, { h: r.hc(x.g), k: C.key(x.g) })).sort((a, b) => a.v - b.v), kv, nKeep: keep0.length };
    VAL.set(r, out); return out; }
  const total = r => (r.truck.base - r.truck.plan) + (r.lab.base - r.lab.plan);

  function tabs() {
    $("tabs").innerHTML = REGS.map(R => { const r = ST.res[R];
      return `<button type="button" role="tab" id="tab-${R}" aria-selected="${R === ST.R}" data-r="${R}">${R}${r ? `<small class="${total(r) >= 0 ? "pos" : "neg"}">${sg(total(r))}</small>` : ""}</button>`; }).join(""); }

  /* tóm tắt: một con số + vài sự thật */
  function summary(r) { const V = values(r), t = total(r), dT = r.truck.base - r.truck.plan, dL = r.lab.base - r.lab.plan, nd = DAYS();
    const ch = V.pk.reduce((a, x) => a + x.routes.length, 0), late = r.T.filter(g => { const h = r.hc(g); return h && h.sim && h.sim.late > 0.5; }).length;
    $("sum").innerHTML = `<div class="hero"><div><div class="lab">Tiết kiệm · ${nd} ngày dữ liệu · ${r.R}</div>
      <div class="val ${t >= 0 ? "pos" : "neg"}">${sg(t)} <span>tr</span></div>
      <div class="sub">≈ ${sg(t / nd * 30)} tr/tháng · xe ${sg(dT)} · người ${sg(dL)}</div></div>
      <ul class="facts"><li><b>${ch}</b> tuyến đổi</li><li class="${late ? "neg" : ""}"><b>${late}</b> tuyến trễ COT</li><li><b>${r.L1.teams.length}</b> nhóm người chung</li></ul>
      <button type="button" class="btn ghost" data-ov="plan">▶ Mô phỏng cả vùng</button></div>`; }

  /* RỦI RO: tính khi mở tuyến (vài chục lần mô phỏng) */
  const RISK = new Map();
  const conseq = (x, b) => x.late > Math.max(0, b.late) + 0.5 ? `<span class="neg">trễ COT ${Math.round(x.late)}' ở ${esc(short(x.pt))}</span>`
    : x.roll > b.roll + 1 ? `kịp COT, dồn ${Math.round(x.roll - b.roll)} đơn sang COT sau` : `<span class="pos">không ảnh hưởng</span>`;
  function riskHtml(x) { const R = riskOf(x); if (!R) return `<p class="muted">Thiếu chuyến thật để mô phỏng.</p>`;
    const side = (lab, S, tip) => `<div class="rk"><div class="rkh"><b>${lab}</b><span class="muted">${tip(S)}</span></div>
      <table class="mini"><tbody>${S.at.map(a => `<tr><td class="mono">+${a.d}'</td><td>${conseq(a, R.base)}</td></tr>`).join("")}</tbody></table></div>`;
    return side("Seller bàn giao trễ", R.av, S => S.ok >= 120 ? "chịu được trên 2 giờ" : `kịp COT nếu trễ ≤ ${S.ok}'`) +
      side("Xe tới trễ so với lịch", R.tr, S => S.ok >= 120 ? "chịu được trên 2 giờ" : S.ok ? `kịp COT nếu trễ ≤ ${S.ok}'` : "trễ bao nhiêu là trễ COT bấy nhiêu"); }

  /* KHÁC THỰC TẾ / GIẢ ĐỊNH đang dùng cho tuyến */
  function notes(r, x) { const g = x.g, h = x.h, L = [], R = r.R;
    if (x.isNew) L.push(`Tuyến mới, chưa từng chạy: tiền xe là dự báo. Thí nghiệm ghép/tách cho thấy model đoán thấp hơn thật 8–19%${P.newPen ? ` (đã cộng ${P.newPen}%)` : ""}.`);
    if (h && h.tol > P.lateTol + 0.5) L.push(`Tuyến hiện nay của các điểm này mô phỏng đã trễ ${Math.round(h.tol)}': kế hoạch chỉ phải không trễ hơn.`);
    g.forEach(i => { const n = esc(short(i));
      C.dlInfo(i).forEach(d => { if (d.ov != null) L.push(`${n} · COT${d.k + 1}: hạn chỉnh tay ${hm(d.ov)}.`); else if (d.auto > d.p + 0.5) L.push(`${n} · COT${d.k + 1}: hạn = giờ xe hiện nay rời ${hm(d.auto)} (muộn hơn Packed ${hm(d.p)}).`);
        if (d.avOv != null) L.push(`${n} · COT${d.k + 1}: giờ có hàng chỉnh tay ${hm(d.avOv)}.`); });
      if (!C.COTW[R] && REF.HANDOVER[C.nm(i)] == null && REF.CLOSE[C.nm(i)] == null) L.push(`${n}: chưa có giờ đóng/bàn giao cuối — giả định = giờ xe tới muộn nhất (p90).`);
      const a = h && h.A && h.A[i]; if (a && a.m === "F" && a.n > C.fteBase(i)) L.push(`${n}: thêm ${a.n - C.fteBase(i)} FTE riêng để kịp COT.`);
      if (C.HCOV[C.nm(i)] != null) L.push(`${n}: số người chỉnh tay ${C.HCOV[C.nm(i)]}.`);
      const sn = C.socN(i), so = C.socShare(i); if (sn != null && sn > 1) L.push(`${n}: chia ${sn} SOC (${Object.entries(so).filter(e => e[1] >= P.socMin / 100).sort((p, q) => q[1] - p[1]).map(e => `${esc(e[0].replace(/ Mega SOC| SOC/g, ""))} ${Math.round(e[1] * 100)}%`).join(", ")}).`); });
    if (C.TROV[C.rkey(g)]) L.push(`Giờ xe chỉnh tay.`);
    const ex = h && h.sim ? h.sim.rows.reduce((a, s) => a + (s.extra || 0), 0) : 0; if (ex) L.push(`Thêm ${ex} xe (chia điểm cho xe) để kịp COT: ${tr(r.xCost(g))} tr/kỳ đã tính vào tiền xe.`);
    if (!g.some(i => (C.S[i].tc || []).some(t => t && t.length))) L.push(`Không có chuyến thật: thời gian chạy và đứng lấy theo trung bình vùng.`);
    L.push(`Giờ có hàng suy từ giờ xe thật tới trừ thời gian sort (chưa có giờ bàn giao thật của seller).`);
    return `<ul class="notes">${L.map(t => `<li>${t}</li>`).join("")}</ul>`; }

  function scheduleTable(r, g) { const h = r.hc(g);
    if (!h || h.nodata || !h.sim) return `<p class="muted">Thiếu chuyến thật để mô phỏng giờ.</p>`;
    const rows = h.sim.rows.map(s => s.st.map((z, k) => `<tr>${k === 0 ? `<td class="slot" rowspan="${s.st.length}">${hm(s.t)}<br><span class="muted mono">${s.nTr} xe</span>${s.soc ? `<br><span class="muted">→ ${esc(s.soc.replace(/ Mega SOC| SOC/g, "").replace(/\|/g, " + "))}</span>` : ""}</td>` : ""}
      <td>${esc(short(z.i))} <span class="muted">· ${esc(modeOf(g, h, z.i))}</span></td><td class="r mono">${Math.round(z.q)}</td><td class="r mono">${hm(z.ready)}</td><td class="r mono">${hm(z.arr)}</td>
      <td class="r mono">${hm(z.dep)}</td><td class="r mono">${hm(z.dl)}</td><td class="r mono ${z.late > h.tol + 0.5 ? "neg" : z.late > 0.5 ? "" : "pos"}">${mins(z.late)}</td></tr>`).join("")).join("");
    return `<div class="scroll"><table class="tl"><thead><tr><th>Lượt</th><th>Điểm · người</th><th class="r">Đơn</th><th class="r">Hàng sẵn</th><th class="r">Xe tới</th><th class="r">Xe rời</th><th class="r">Hạn</th><th class="r">So hạn</th></tr></thead><tbody>${rows}</tbody></table></div>`; }

  /* độ chịu đựng: seller bàn giao trễ tối đa bao nhiêu phút mà tuyến vẫn kịp COT */
  const riskOf = x => { if (!RISK.has(x.k)) RISK.set(x.k, x.h && x.h.A ? C.risk(x.g, x.h.A) : null); return RISK.get(x.k); };
  const ppl = x => { let f = 0; const H = new Set(); x.g.forEach(i => { const a = x.h && x.h.A && x.h.A[i]; if (a && a.m === "H") H.add(a.team.id ?? "?"); else f += a && a.n != null ? a.n : C.fteBase(i); });
    return [f ? `${f} FTE riêng` : "", H.size ? `nhóm chung ${[...H].join(", ")}` : ""].filter(Boolean).join(" · "); };
  function routes(r) { const V = values(r); let n = 0;
    const body = x => `<div class="body"><div class="cols">
          <section><h3>Giá trị · tr/kỳ</h3><dl class="kv">${x.isNew ? `<dt>Làm riêng · tiền xe</dt><dd class="${x.xs >= 0 ? "pos" : "neg"}">${sg(x.xs)}</dd><dt>Tiền người các điểm</dt><dd class="${x.ls >= 0 ? "pos" : "neg"}">${sg(x.ls)}</dd>
            <dt>Tuyến hiện nay</dt><dd class="tx">${x.from.map(b => esc(b.map(short).join(" + "))).join("<br>")}</dd>` : `<dt>Đổi người · xe thêm</dt><dd class="${x.v >= 0 ? "pos" : "neg"}">${sg(x.v)}</dd>`}
            <dt>Xe/ngày</dt><dd>${C.routeCost(x.g).t.toFixed(1)} · ${esc(C.mixLabel(C.routeCost(x.g).mix))}</dd><dt>Người</dt><dd>${esc(ppl(x))}</dd></dl></section>
          <section><h3>Rủi ro</h3>${riskHtml(x)}</section>
          <section><h3>Khác thực tế · giả định</h3>${notes(r, x)}</section></div>
          <details class="sch"><summary>Lịch ngày đông</summary>${scheduleTable(r, x.g)}</details></div>`;
    const stTxt = x => { const R = riskOf(x), late = x.h && x.h.sim ? x.h.sim.late : null;
      return !R ? `<span class="muted">thiếu data giờ</span>` : late > 0.5 ? `<span class="neg">trễ COT ${Math.round(late)}'</span>` : R.av.ok >= 120 ? `<span class="pos">rất an toàn</span>`
        : R.av.ok >= 30 ? `<span>seller trễ ≤ ${R.av.ok}' vẫn kịp</span>` : `<span class="warn">mong manh: seller trễ ${R.av.ok ? `quá ${R.av.ok}'` : "là"} trễ COT</span>`; };
    const item = (x, val, sub, cls) => { const id = "r:" + x.k, open = ST.open.has(id); n++;
      return `<article class="it ${cls || ""}${open ? " open" : ""}"><div class="row" data-tg="${id}" tabindex="0" role="button" aria-expanded="${open}">
        <span class="no mono">${n}</span><div class="main"><div class="nm">${names(x.g)}</div><div class="meta">${stTxt(x)}${sub ? ` · ${sub}` : ""}</div></div>
        ${val}<button type="button" class="play" data-rl="${esc(x.k)}" aria-label="Chạy live tuyến ${n}" title="Chạy live">▶</button></div>${open ? body(x) : ""}</article>`; };
    const vv = (v, lab) => `<div class="v mono ${v >= 0 ? "pos" : "neg"}">${sg(v)}${lab ? `<small>${lab}</small>` : ""}</div>`;
    const side = P0 => P0.sideR ? `<div class="gside muted">gồm ${sg(P0.side)} tr tiền người ở tuyến giữ nguyên ${P0.sideR.map(x => esc(x.g.map(short).join(" + "))).join(", ")} — nhóm FTE chung của các điểm này bị xếp lại vì nhóm thay đổi này</div>` : "";
    const html = V.pk.map(P0 => P0.routes.length === 1 ? item(P0.routes[0], vv(P0.net), P0.sideR ? `<span class="muted">gồm ${sg(P0.side)} người ở tuyến khác</span>` : "")
      : `<div class="grp"><div class="gh"><span>${P0.routes.length} tuyến đổi điểm cho nhau</span><span class="mono ${P0.net >= 0 ? "pos" : "neg"}">làm cả nhóm ${sg(P0.net)}</span></div>${side(P0)}
        ${P0.routes.map(x => item(x, vv(x.solo, "làm riêng"), x.solo < 0 ? `<span class="warn">chỉ lợi khi làm cùng nhóm</span>` : "", "in")).join("")}</div>`).join("")
      + (V.keep.length ? `<div class="grp"><div class="gh"><span>Giữ tuyến, đổi người / thêm xe (không do nhóm thay đổi nào)</span><span class="mono ${V.kv >= 0 ? "pos" : "neg"}">${sg(V.kv)}</span></div>${V.keep.map(x => item(x, vv(x.v), `<span class="muted">nhóm người chung xếp lại</span>`, "in")).join("")}</div>` : "");
    const nR = V.pk.reduce((a, x) => a + x.routes.length, 0);
    $("routes").innerHTML = `<header class="sh"><h2>Tuyến</h2><span class="muted">${nR} tuyến mới · ${V.nKeep} tuyến giữ nguyên · bấm để xem rủi ro &amp; giả định</span></header>
      ${html || `<p class="empty">Không có thay đổi nào lợi hơn ${tr(P.minGain)} tr/kỳ.</p>`}
      ${r.dropped && r.dropped.length ? `<p class="muted note3">Đã bỏ ${r.dropped.length} nhóm lỗ sau khi tính cả tiền người (giữ tuyến hiện nay, lợi thêm ${sg(r.dropped.reduce((a, d) => a + d.net, 0))} tr): ${r.dropped.map(d => d.nw.map(g => esc(g.map(short).join(" + "))).join(" ; ")).join(" | ")}.</p>` : ""}`; }

  /* NHÓM NGƯỜI CHUNG: giá trị = tiền người các điểm của nhóm (đã nằm trong giá trị tuyến) */
  const TRISK = new Map();
  function teamsL(r) { const T = r.L1.teams;
    const item = t => { const id = "t:" + t.id, open = ST.open.has(id), v = t.pts.reduce((a, i) => a + (r.L0.cost[i] || 0) - (r.L1.cost[i] || 0), 0);
      let rk = ""; if (open) { const k = r.R + t.id; if (!TRISK.has(k)) TRISK.set(k, C.teamRisk(r, t)); const x = TRISK.get(k);
        rk = !x ? `<p class="muted">Nhóm 1 người: vắng là không có người làm — cần người dự phòng.</p>` : `<table class="mini"><tbody><tr><td>Thiếu 1 người (còn ${t.n - 1})</td><td>${x.late > Math.max(0, x.late0) + 0.5 ? `<span class="neg">trễ COT ${Math.round(x.late)}' ở ${esc(short(x.pt))}</span>` : x.roll > 1 ? `kịp COT, dồn ${Math.round(x.roll)} đơn sang COT sau` : `<span class="pos">vẫn kịp, không dồn đơn</span>`}</td></tr></tbody></table>`; }
      return `<article class="it${open ? " open" : ""}"><div class="row" data-tg="${id}" tabindex="0" role="button" aria-expanded="${open}">
        <span class="no mono">${t.id}</span><div class="main"><div class="nm">${names(t.pts)}</div><div class="meta"><span class="muted">${esc(t.hub || "")} · ${t.n} người</span></div></div>
        <div class="v mono ${v >= 0 ? "pos" : "neg"}">${sg(v)}</div><button type="button" class="play" data-team="${t.id}" aria-label="Chạy live nhóm ${t.id}" title="Chạy live">▶</button></div>
        ${open ? `<div class="body"><div class="cols"><section><h3>Rủi ro</h3>${rk}</section><section><h3>Cách làm</h3><p class="muted">Đi lần lượt các điểm theo hạn COT sớm nhất; ở lại tới khi xe lên hàng xong mới đi tiếp. ${tr(t.c)} tr/kỳ.</p></section></div></div>` : ""}</article>`; };
    $("teams").innerHTML = `<header class="sh"><h2>Nhóm người chung</h2><span class="muted">FTE chung theo FM Hub · giá trị đã nằm trong các tuyến</span></header>` +
      (T.length ? T.map(item).join("") : `<p class="empty">Không có nhóm FTE chung nào rẻ hơn FTE riêng.</p>`); }

  /* phần phụ: tuyến đã thử & bị loại, FM Hub */
  const WHY = { "xa": "cách điểm khác > " + P.hubKm + " km", "trễ": "gom thì tuyến xe trễ COT", "đắt hơn": "gom không rẻ hơn FTE riêng" };
  function more(r) { const it = r.iters.filter(x => x.banned.length), H = r.L1.hubs || [];
    $("more").innerHTML = `<summary>Đã thử và loại · FM Hub</summary><div class="mb">
      <h3>Tuyến bị loại vì trễ COT</h3>${it.length ? `<ul class="notes">${it.flatMap(x => x.banned).map(b => `<li>${names(b.g)} <span class="neg">trễ ${mins(b.late)}</span></li>`).join("")}</ul>` : `<p class="muted">Không có.</p>`}
      <h3>FM Hub cover ≥ 2 điểm</h3>${H.length ? `<ul class="notes">${H.map(h => `<li><b>${esc(h.h)}</b> · ${h.pts.length} điểm${h.teams.length ? ` · nhóm ${h.teams.map(t => t.id).join(", ")}` : ""}${h.solo.length ? ` · <span class="muted">vẫn FTE riêng: ${h.solo.map(x => `${esc(short(x.i))} (${esc(Object.entries(x.why).sort((a, b) => b[1] - a[1]).map(e => WHY[e[0]] || e[0]).join(" / ") || (C.HCOV[C.nm(x.i)] != null ? "số người chỉnh tay" : "không còn điểm cùng hub"))})`).join(", ")}</span>` : ""}</li>`).join("")}</ul>` : `<p class="muted">Không có.</p>`}</div>`; }

  /* tham số: [nhóm, khóa, nhãn, đơn vị, hệ số hiển thị] */
  const PF = [["Xe", "fill", "Lấp đầy xe tối đa", "%", 1], ["Xe", "maxStops", "Số điểm tối đa một tuyến", "điểm", 1], ["Xe", "maxKm", "Hai điểm cách nhau tối đa", "km", 1],
    ["Xe", "cotGap", "Giờ xe lượt đầu lệch tối đa", "phút", 1], ["Xe", "minGain", "Mỗi bước phải lợi ít nhất", "tr/kỳ", 1e6], ["Xe", "cityKm", "Xa SOC hơn thì giá theo km", "km", 1], ["Xe", "dropSur", "Xe trả nhiều SOC: + mỗi SOC", "%", 1], ["Xe", "vehMin", "As-is: chỉ dùng loại xe chiếm ≥", "% chuyến", 1], ["Xe", "vehFree", "Đòn bẩy đổi loại xe (1 = mọi loại)", "", 1], ["Xe", "newPen", "Tuyến mới đắt hơn model (thận trọng)", "%", 1], ["Xe", "socGrp", "Tiền xe: chia đơn theo nhóm SOC đích (1 = bật)", "", 1], ["Xe", "socSim", "Mô phỏng giờ: xe riêng theo nhóm SOC (1 = bật)", "", 1], ["Xe", "socP", "Nhóm SOC có xe riêng khi có mặt ≥", "% ngày", 1], ["Xe", "split", "Lượt trễ: chia điểm cho các xe (1 = bật)", "", 1], ["Xe", "splitExtra", "Chia điểm: thêm tối đa", "xe/lượt", 1],
    ["Người", "lateTol", "Cho trễ COT tối đa", "phút", 1], ["Xe", "closeMin", "Chốt xe sau khi hàng cuối sẵn", "phút", 1], ["Xe", "early", "Xe đi sớm, dồn đơn chưa xong sang COT sau (1 = bật, 0 = chờ đủ đơn)", "", 1], ["Xe", "rollMax", "Mỗi lượt-điểm dồn tối đa", "% đơn", 1], ["Người", "maxExtra", "Tuyến trễ: thêm FTE riêng tối đa mỗi điểm", "người", 1], ["Người", "peakP", "Ngày đông = phân vị", "%", 1], ["Người", "fteH", "Một người làm", "giờ/ngày", 1],
    ["Năng suất (theo đặc điểm seller)", "prodBase", "Sort lý tưởng (1 chute, 10% hàng to)", "đơn/người/ngày", 1], ["Năng suất (theo đặc điểm seller)", "socSt", "Số SOC phải chia theo chuyến thật (1) / theo bảng luồng (0)", "", 1], ["Năng suất (theo đặc điểm seller)", "socMin", "SOC tính là phải chia khi nhận ≥", "% đơn", 1], ["Năng suất (theo đặc điểm seller)", "prodHand", "Không sort (quét, bàn giao)", "đơn/người/ngày", 1],
    ["Năng suất (theo đặc điểm seller)", "prodChute", "Mỗi chute thêm ngoài 1", "−%", 1], ["Năng suất (theo đặc điểm seller)", "prodBulky", "Mỗi 10 điểm % hàng to lệch 10%", "−%", 1],
    ["Loại người", "ftePay", "FTE riêng", "k/người/ngày", 1e3], ["Loại người", "hubPay", "FTE chung (nhóm FM Hub)", "k/người/ngày", 1e3], ["Loại người", "hubKm", "FTE chung: điểm cách nhau tối đa", "km", 1],
    ["Loại người", "hubSpd", "FTE chung di chuyển", "km/giờ", 1]];
  function pform() { let gr = ""; $("pform").innerHTML = `<div class="pgrid">${PF.map(([g, k, lab, u, f]) => (g !== gr ? `<h3>${(gr = g)}</h3>` : "") +
      `<div class="pf"><label for="p-${k}">${lab}</label><span><input id="p-${k}" type="number" step="any" value="${+(P[k] / f).toFixed(3)}"><span class="u">${u}</span></span></div>`).join("")}</div>
      <div class="pbar"><button type="button" class="btn" id="prun">Chạy lại</button><button type="button" class="btn ghost" id="pdef">Về mặc định</button></div>`; }
  const DEF = Object.assign({}, P);

  /* ---------- DÂY CHUYỀN 0: dữ liệu & kiểm định as-is ---------- */
  const pass = ok => `<span class="chip ${ok ? "ok" : "bad"}">${ok ? "ĐẠT" : "CHƯA ĐẠT"}</span>`, pf = x => x == null ? "–" : Math.round(x) + "%";
  function calib(R) { const c = CAL[R] || (CAL[R] = K.run(R)), p = c.ph, T = K.T, sgn = x => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}%`;
    const tile = (t, ok, big, line) => `<div class="tile"><div class="th"><span>${t}</span>${ok == null ? "" : pass(ok)}</div><div class="tv mono">${big}</div><div class="tl2">${line}</div></div>`;
    const det = (t, body) => `<details class="more"><summary>${t}</summary><div class="mb">${body}</div></details>`;
    const allOk = c.ok.rep && c.ok.cost && c.ok.time;
    $("calib").innerHTML = `<div class="hero"><div><div class="lab">Mô hình hiện trạng · ${R}</div><div class="val ${allOk ? "pos" : "neg"}">${allOk ? "Đạt" : "Chưa đạt"}</div>
        <div class="sub">Dự báo tiền xe từng tuyến chỉ từ số đơn, lệch ${c.wRoute.toFixed(1)}% so với thật (ngưỡng ${T.calRoute}%)</div></div></div>
      <div class="tiles">
        ${tile("Khớp lại kỳ", c.ok.rep, Math.max(c.rep.cost, c.rep.trips).toFixed(1) + "%", `sai số tiền & chuyến theo tuyến · ngưỡng ${T.calRep}%`)}
        ${tile("Kiểm định độc lập", c.ok.cost, c.wRoute.toFixed(1) + "%", `học ngày lẻ, đoán ngày chẵn · tổng ${sgn(c.gap)}`)}
        ${c.fwd ? tile("Dự báo tháng sau", null, c.fwd.wRoute.toFixed(1) + "%", `học trước ${esc(c.fwd.cut)}, đoán ${c.fwd.nt} ngày sau`) : ""}
        ${tile("Giờ xe", c.ok.time, pf(Math.min(p.depSys, p.socSys)), `giờ rời điểm & tới SOC lệch ≤ ${T.calTime}'`)}
      </div>
      ${det("Chi tiết số liệu", `<dl class="kv">
        <dt>Thực tế · mô hình (kiểm định độc lập)</dt><dd>${tr(c.rc)} · ${tr(c.mc)} tr</dd><dt>Mức nhiễu ngày (không thể thấp hơn)</dt><dd>${c.wNoise.toFixed(1)}%</dd>
        <dt>Chuyến/ngày mô hình · thật</dt><dd>${c.mt.toFixed(0)} · ${c.rt.toFixed(0)}</dd><dt>Sai số chuyến tuyến × ngày · mốc thống kê</dt><dd>${pf(c.wTrip)} · ${pf(c.wStat)}</dd>
        ${c.fwd ? `<dt>Dự báo tháng sau: tổng · nhiễu</dt><dd>${sgn(c.fwd.gap)} · ${c.fwd.wNoise.toFixed(1)}%</dd>` : ""}
        <dt>Giờ rời điểm · tới SOC (nhóm) · trần</dt><dd>${pf(p.depSys)} · ${pf(p.socSys)} · ${pf(p.depCeil)}</dd><dt>Xe đứng chờ &gt; 30' ngoài thời gian chất</dt><dd>${pf(p.waitBig)}</dd></dl>`)}
      ${det("Kế hoạch đang khác hiện trạng thế nào", gapCard(R))}
      ${det("Nguồn dữ liệu", `<div class="scroll"><table><thead><tr><th>Dữ liệu</th><th class="r">Có data</th><th class="r">Giả định</th><th>Nguồn · cách giả định</th></tr></thead><tbody>${c.src.map(([n, a, b, w]) =>
          `<tr><td>${esc(n)}</td><td class="r mono">${a}</td><td class="r mono ${b ? "neg" : ""}">${b}</td><td class="muted">${esc(w)}</td></tr>`).join("")}</tbody></table></div>`)}
      ${det("Tuyến lệch tiền nhiều nhất", `<div class="scroll"><table><thead><tr><th>Tuyến hiện nay</th><th class="r">Thật</th><th class="r">Mô hình</th><th class="r">Lệch</th><th class="r">Ngày</th></tr></thead><tbody>${c.rows.slice(0, 15).map(x =>
          `<tr><td>${rt(x.g)}</td><td class="r mono">${tr(x.rc)}</td><td class="r mono">${tr(x.mc)}</td><td class="r mono ${Math.abs(x.gap) > T.calRoute ? "neg" : "pos"}">${x.gap >= 0 ? "+" : ""}${x.gap.toFixed(0)}%</td><td class="r mono">${x.nd}</td></tr>`).join("")}</tbody></table></div>`)}`; }
  /* bảng: dây chuyền 1–4 đang dùng khác dây chuyền 0 thế nào (đo trên tuyến hiện nay, ngày đông) */
  function gapCard(R) { const G = GAP[R] && GAP[R].g; if (!G) return ""; const m = x => x == null ? "–" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(Math.round(x))}'`, p = x => x == null ? "–" : Math.round(x) + "%";
    const sev = (bad, txt) => `<td class="${bad ? "neg" : "pos"}">${txt}</td>`;
    const rows = [
      ["Tiền xe & số chuyến/ngày", "công thức đã hiệu chỉnh từng tuyến (lượt, lấp đầy, loại xe, hệ số)", "cùng công thức", sev(false, "giống nhau")],
      ["Số xe mỗi lượt khi mô phỏng giờ", "chuyến thật", "tính lại theo sức chở từng lượt, ngày đông, mọi lượt đều chạy", sev(Math.abs(G.trucks.sim - G.trucks.real) > 0.1 * G.trucks.real, `mô phỏng ${Math.round(G.trucks.sim)} xe · công thức tiền ${Math.round(G.trucks.cost)} · thật ${Math.round(G.trucks.real)} (ngày đơn gần ngày đông nhất)`)],
      ["Giờ xe tới điểm", "giờ thật", "model tự xếp (tới vừa lúc hàng sẵn)", sev(G.arr.in15 < 80, `trung vị ${m(G.arr.med)} so với thật · ${p(G.arr.in15)} lượt lệch ≤ 15'`)],
      ["Giờ xe rời điểm", "giờ thật tới + thời gian đứng theo giờ", "model tự xếp", sev(G.dep.in15 < 80, `trung vị ${m(G.dep.med)} · ${p(G.dep.in15)} lệch ≤ 15' · ${p(G.dep.in60)} lệch ≤ 60'`)],
      ["Thời gian xe đứng ở điểm", "theo khung giờ xe tới (gồm cả chờ hàng)", "một con số cả ngày (chờ hàng do mô phỏng tự sinh)", sev(G.dwell.big < 80, `trung vị chênh ${m(G.dwell.med)} · ${p(G.dwell.big)} lượt chênh ≤ 15'`)],
      ["Thời gian chạy về SOC", "theo giờ xuất phát", "một con số cả ngày", sev(G.soc.big < 80, `trung vị chênh ${m(G.soc.med)} · ${p(G.soc.big)} chuyến chênh ≤ 15'`)],
      ["Giờ có hàng & hạn COT", "không dùng", "giờ có hàng suy từ giờ xe thật tới; hạn = Packed / giờ đóng (p90 giờ xe tới muộn nhất)", sev(G.contra > 0, G.contra ? `${G.contra} lượt-điểm mô phỏng hàng sẵn sau hạn trong khi thật xe vẫn đi kịp — giả định mâu thuẫn` : "không thấy mâu thuẫn")],
      ["Trễ COT của chính tuyến hiện nay", "–", "mô phỏng tuyến hiện nay với người hiện nay", sev(G.late.late > 0, `${G.late.late}/${G.late.n} lượt-điểm trễ · nặng nhất ${Math.round(G.late.worst)}'`)],
      ["Người ở seller", "không kiểm định", "model tự bố trí cho cả \"hiện nay\"", sev(true, "chưa có dữ liệu người thật để so")],
      ["Ngày dùng để kiểm giờ", "mọi ngày", "một ngày đông (đơn p90)", sev(false, "cố ý: kiểm ngày khó nhất")]];
    return `<p class="muted">Đo trên các tuyến hiện nay, ngày đông · đỏ = cần hiệu chỉnh</p><div class="scroll"><table><thead><tr><th>Hạng mục</th><th>Dây chuyền 0 (kiểm định)</th><th>Dây chuyền 1–4 (plan, người, live)</th><th>Chênh lệch đo được</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${r[0]}</b></td><td class="muted">${r[1]}</td><td class="muted">${r[2]}</td>${r[3]}</tr>`).join("")}</tbody></table></div>`; }
  function lines() { document.querySelectorAll("#lines [data-line]").forEach(b => b.setAttribute("aria-pressed", b.dataset.line === ST.line)); $("calib").hidden = ST.line !== "0"; $("plan").hidden = ST.line === "0"; }

  function render() { tabs(); lines(); const R = ST.R;
    if (ST.line === "0") { if (!CAL[R] || !GAP[R] || GAP[R].r !== ST.res[R]) { document.querySelector(".wrap").classList.add("busy"); setTimeout(() => { if (!CAL[R]) CAL[R] = K.run(R); const rr = res(R); GAP[R] = { r: rr, g: K.gap(R, rr) }; document.querySelector(".wrap").classList.remove("busy"); render(); }, 20); return; } calib(R); return; }
    if (!ST.res[R]) { document.querySelector(".wrap").classList.add("busy"); setTimeout(() => { res(R); document.querySelector(".wrap").classList.remove("busy"); render(); queue(); }, 20); return; }
    const r = ST.res[R]; ovr(); summary(r); routes(r); teamsL(r); more(r);
    if (ST.ovOpen) { const m = ST.ovOpen; ST.ovOpen = null; openOv(r, m); } }
  /* mô phỏng toàn vùng (xe + người); đổi vùng ở thẻ trên cùng thì mở lại cho vùng mới */
  function openOv(r, mode) { ST.ov = mode; LV.openRegion(r, mode, m => { ST.ov = m; }); }
  /* dải báo chỉnh tay đang áp dụng (lưu trên trình duyệt, áp cho mọi vùng / mọi lần mở trang) */
  const OVS = () => [["hạn COT", C.DLOV], ["giờ có hàng", C.AVOV], ["số người", C.HCOV], ["giờ xe", C.TROV]];
  function ovr() { const L = OVS().map(([lab, M]) => [lab, Object.keys(M)]).filter(x => x[1].length), e = $("ovr");
    if (!L.length) { e.hidden = true; e.innerHTML = ""; return; }
    e.hidden = false; e.innerHTML = `<b>Đang áp dụng chỉnh tay</b><span>${L.map(([lab, ks]) => `${lab}: ${ks.length} ${lab === "giờ xe" ? "tuyến" : "điểm"}`).join(" · ")}</span>
      <span class="muted">${esc([...new Set(L.flatMap(x => x[1]))].map(n => n.replace(/^(HN|HCM|DNCH|North|South)\s*(SPC|Seller)?\s*[-_]\s*/i, "")).slice(0, 8).join(", "))}${new Set(L.flatMap(x => x[1])).size > 8 ? "…" : ""} · điểm chỉnh số người được giữ FTE riêng, không gom nhóm chung</span>
      <button type="button" class="btn ghost" id="ovr-clr">Bỏ tất cả chỉnh tay</button>`; }
  /* tính dần các vùng còn lại để tab hiện số */
  function queue() { const R = REGS.find(x => !ST.res[x]); if (R) setTimeout(() => { res(R); tabs(); queue(); }, 30); }

  document.addEventListener("click", e => { const t = e.target;
    const ln = t.closest("[data-line]"); if (ln) { ST.line = ln.dataset.line; try { localStorage.setItem("d2s-core-line", ST.line); } catch (x) {} render(); return; }
    const ovb = t.closest("[data-ov]"); if (ovb) { openOv(ST.res[ST.R], ovb.dataset.ov); $("live").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const tb = t.closest("[data-r]"); if (tb) {  ST.ovOpen = $("live").hidden ? null : ST.ov || null; LV.close(); ST.R = tb.dataset.r; try { localStorage.setItem("d2s-core-R", ST.R); } catch (x) {} render(); return; }
    if (t.id === "ovr-clr") { OVS().forEach(([, M]) => Object.keys(M).forEach(k => { delete M[k]; })); try { localStorage.removeItem("d2s-core-dl"); } catch (x) {}
      LV.close(); C.reset(); ST.res = {}; ST.open.clear(); render(); return; }
    const tmb = t.closest("[data-team]"); if (tmb) { ST.ov = null; const r = ST.res[ST.R], tm = r.L1.teams.find(x => x.id === +tmb.dataset.team); if (tm) { LV.openTeam(r, tm, `Nhóm FTE chung ${tm.id} · ${tm.hub} · ${r.R}`); $("live").scrollIntoView({ behavior: "smooth", block: "start" }); } return; }
    const lv = t.closest("[data-rl]"); if (lv) { ST.ov = null; openRoute(ST.res[ST.R], lv.dataset.rl); $("live").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const tg = t.closest("[data-tg]"); if (tg) { const id = tg.dataset.tg; ST.open.has(id) ? ST.open.delete(id) : ST.open.add(id); const r = ST.res[ST.R]; id[0] === "t" ? teamsL(r) : routes(r); return; }
    if (t.id === "prun" || t.id === "pdef") { PF.forEach(([, k, , , f]) => { const v = t.id === "pdef" ? DEF[k] : parseFloat($("p-" + k).value) * f; if (isFinite(v)) P[k] = v; });
      if (t.id === "pdef") pform(); LV.close(); C.reset(); Object.keys(CAL).forEach(k => delete CAL[k]); ST.res = {}; ST.open.clear(); render(); } });
  document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("[data-tg]")) { e.preventDefault(); e.target.click(); } });

  pform(); render();
})();
