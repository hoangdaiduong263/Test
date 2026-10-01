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
  /* hạn COT chỉnh tay: lưu trên trình duyệt, nạp lại khi mở trang */
  try { const o = JSON.parse(localStorage.getItem("d2s-core-dl") || "{}"), ld = (M, f) => Object.entries(M || {}).forEach(([n, m]) => Object.entries(m).forEach(([k, v]) => f(n, +k, v)));
    if (o.dl || o.av) { ld(o.dl, C.setDeadline); ld(o.av, C.setAvail); } else ld(o, C.setDeadline); } catch (e) {}
  const LV = Live(C, $("live"), { onApply(ch, pts) { ch.forEach(c => (c.f === "av" ? C.setAvail : C.setDeadline)(c.name, c.k, c.v)); try { localStorage.setItem("d2s-core-dl", JSON.stringify({ dl: C.DLOV, av: C.AVOV })); } catch (e) {}
    const R = ST.R; delete ST.res[R]; ST.open.clear(); document.querySelector(".wrap").classList.add("busy");
    setTimeout(() => { const r = res(R); document.querySelector(".wrap").classList.remove("busy"); render();
      /* mở lại gói có nhiều điểm chung nhất với gói đang xem (kế hoạch có thể đổi sau khi chạy lại) */
      let best = -1, bn = 0; r.packs.forEach((p, k) => { const n = p.nw.flat().filter(i => pts.includes(i)).length; if (n > bn) { bn = n; best = k; } });
      if (best >= 0) LV.open(r, r.packs[best], `Gói ${best + 1} · ${R}`); else LV.close(); }, 20); } });
  const total = r => (r.truck.base - r.truck.plan) + (r.lab.base - r.lab.plan);

  function tabs() {
    $("tabs").innerHTML = REGS.map(R => { const r = ST.res[R];
      return `<button type="button" role="tab" id="tab-${R}" aria-selected="${R === ST.R}" data-r="${R}">${R}${r ? `<small class="${total(r) >= 0 ? "pos" : "neg"}">${sg(total(r))}</small>` : ""}</button>`; }).join(""); }

  function flow(r) { const k0 = new Set(r.T0.map(C.key)), nw = r.T.filter(g => !k0.has(C.key(g))), dT = r.truck.base - r.truck.plan, dL = r.lab.base - r.lab.plan, t = dT + dL;
    $("flow").innerHTML = `
      <div class="step"><h2><span class="n">1</span>Linehaul · tiền xe</h2>
        <div class="big ${dT >= 0 ? "pos" : "neg"}">${sg(dT)} <span class="muted" style="font-size:13px">tr/kỳ</span></div>
        <dl class="kv"><dt>Thực tế (chuyến thật)</dt><dd>${tr(r.truck.real)}</dd><dt>Mô hình · tuyến hiện nay</dt><dd>${tr(r.truck.base)}</dd><dt>Mô hình · kế hoạch</dt><dd>${tr(r.truck.plan)}</dd></dl></div>
      <div class="arrow" aria-hidden="true">→</div>
      <div class="step"><h2><span class="n">2</span>Headcount · lọc khả thi</h2>
        <div class="big">${nw.length} <span class="muted" style="font-size:13px">tuyến mới qua</span></div>
        <dl class="kv"><dt>Bị loại (trễ &gt; ${P.lateTol}')</dt><dd>${r.ban.length}</dd><dt>Số vòng chạy lại</dt><dd>${r.iters.length}</dd>
          <dt>Tiền người · hiện nay → kế hoạch</dt><dd>${tr(r.lab.base)} → ${tr(r.lab.plan)}</dd></dl></div>
      <div class="arrow" aria-hidden="true">=</div>
      <div class="step res"><h2>Kế hoạch cuối · xe + người</h2>
        <div class="big ${t >= 0 ? "pos" : "neg"}">${sg(t)} <span class="muted" style="font-size:13px">tr/kỳ</span></div>
        <dl class="kv"><dt>Tiền xe</dt><dd class="${dT >= 0 ? "pos" : "neg"}">${sg(dT)}</dd><dt>Tiền người</dt><dd class="${dL >= 0 ? "pos" : "neg"}">${sg(dL)}</dd>
          <dt>Điểm tối ưu</dt><dd>${r.nodes.length}</dd></dl></div>`; }

  const rt = g => `<span class="rt">${g.map(i => `<span class="pt" title="${esc(C.nm(i))}">${esc(short(i))}</span>`).join("<i>+</i>")}</span>`;
  const verdict = h => h.nodata ? `<span class="chip info">thiếu data</span>` : `<span class="chip ${h.ok ? "ok" : "bad"}">${h.ok ? "✓" : "✗"} trễ ${mins(h.late)}</span>`;
  const modeOf = (g, h, i) => h.A && h.A[i] ? C.modeTxt(h.A[i]) : "FTE riêng";

  function routeDetail(r, g) { const h = r.hc(g), rc = C.routeCost(g), ord = h.order || C.routeOrder(g);
    const ppl = [...new Set(g.map(i => modeOf(g, h, i)))].join(" · ");
    const head = `<div class="rhead">${verdict(h)}<span>${ord.map(i => esc(short(i))).join(" → ")} → SOC</span>
      <span class="muted">xe <b class="mono">${rc.t.toFixed(1)}</b>/ngày · ${esc(C.mixLabel(rc.mix))}</span><span class="muted">người <b>${esc(ppl)}</b> · ${tr(h.lab.c)} tr/kỳ</span>
      ${h.tol > P.lateTol ? `<span class="chip info" title="Tuyến hiện nay của các điểm này mô phỏng đã trễ ${Math.round(h.tol)}'">chỉ cần không trễ hơn ${Math.round(h.tol)}'</span>` : ""}</div>`;
    if (h.nodata || !h.sim) return `<div class="route">${head}<p class="muted" style="margin:0">Thiếu chuyến thật để mô phỏng giờ.</p></div>`;
    const rows = h.sim.rows.map(s => s.st.map((z, k) => `<tr>${k === 0 ? `<td class="slot" rowspan="${s.st.length}">${hm(s.t)}<br><span class="muted mono">${s.nTr} xe</span></td>` : ""}
      <td>${esc(short(z.i))} <span class="muted">· ${esc(modeOf(g, h, z.i))} · ${esc(C.work(z.i).sort)}</span></td><td class="r mono">${Math.round(z.q)}</td><td class="r mono">${hm(z.ready)}</td><td class="r mono">${hm(z.arr)}</td>
      <td class="r mono">${hm(z.dep)}</td><td class="r mono">${hm(z.dl)}</td><td class="r mono late ${z.late > h.tol ? "neg" : z.late > 0 ? "" : "pos"}">${mins(z.late)}</td></tr>`).join("")).join("");
    return `<div class="route">${head}<div class="scroll"><table class="tl"><thead><tr><th>Lượt</th><th>Điểm · người</th><th class="r">Đơn</th><th class="r">Hàng sẵn</th><th class="r">Xe tới</th><th class="r">Xe rời</th><th class="r">Hạn COT</th><th class="r">Trễ</th></tr></thead><tbody>${rows}</tbody></table></div></div>`; }

  function packs(r) { const L = r.packs;
    if (!L.length) { $("packs").innerHTML = `<header><h2>Các gói</h2></header><p class="empty">Không có thay đổi nào lợi hơn ${tr(P.minGain)} tr/kỳ.</p>`; return; }
    const body = L.map((p, k) => { const id = r.R + ":" + k, open = ST.open.has(id), lab = p.nw.flat().reduce((a, i) => a + r.L1.cost[i], 0) - p.cut.flat().reduce((a, i) => a + r.L0.cost[i], 0);
      return `<tr class="pk" data-p="${id}" aria-expanded="${open}" tabindex="0"><td class="mono">${k + 1} <button type="button" class="play" data-live="${k}" aria-label="Chạy live gói ${k + 1}" title="Chạy live">▶</button></td>
        <td><div class="grp">${p.cut.map(rt).join("")}</div></td>
        <td><div class="grp">${p.nw.map(g => `<div class="rt">${rt(g)} ${verdict(r.hc(g))}</div>`).join("")}</div></td>
        <td class="r mono pos">${sg(p.gain)}</td><td class="r mono ${lab <= 0 ? "pos" : "neg"}">${sg(-lab)}</td></tr>
        ${open ? `<tr class="det"><td colspan="5">${p.nw.map(g => routeDetail(r, g)).join("")}</td></tr>` : ""}`; }).join("");
    $("packs").innerHTML = `<header><h2>Các gói · ${r.R}</h2><span class="muted" style="font-size:12px">bấm một gói để xem lịch từng lượt ở ngày đông</span></header>
      <div class="scroll"><table><thead><tr><th>#</th><th>Hiện nay</th><th>Kế hoạch · bước 2</th><th class="r">Tiền xe tr/kỳ</th><th class="r">Tiền người tr/kỳ</th></tr></thead><tbody>${body}</tbody></table></div>`; }

  function teams(r) { const T = r.L1.teams, cnt = A => Object.values(A).reduce((o, a) => (o[a.m] = (o[a.m] || 0) + 1, o), {}), c0 = cnt(r.L0.A), c1 = cnt(r.L1.A);
    const mix = c => `FTE riêng ${c.F || 0} · PPS ${c.P || 0} · nhóm hub ${c.H || 0}`;
    $("teams").innerHTML = `<header><h2>Người · ${r.R}</h2><span class="muted" style="font-size:12px">số điểm theo cách dùng người: hiện nay ${mix(c0)} → kế hoạch ${mix(c1)}</span></header>` +
      (T.length ? `<div class="scroll"><table><thead><tr><th>Nhóm FM Hub</th><th>Hub</th><th>Điểm (đi theo hạn COT sớm nhất trước)</th><th class="r">Người</th><th class="r">tr/kỳ</th></tr></thead><tbody>${T.map(t =>
        `<tr><td class="mono">${t.id}</td><td>${esc(t.hub)}</td><td>${rt(t.pts)}</td><td class="r mono">${t.n}</td><td class="r mono">${tr(t.c)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">Không có nhóm FM Hub nào rẻ hơn FTE riêng / PPS.</p>`); }

  function bans(r) { const it = r.iters.filter(x => x.banned.length);
    $("bans").innerHTML = `<header><h2>Tuyến bị bước 2 loại</h2><span class="muted" style="font-size:12px">loại xong, bước 1 tìm lại tuyến khác</span></header>` +
      (it.length ? `<div class="bans">${r.iters.map((x, k) => x.banned.length ? `<div class="ban"><span class="it">vòng ${k + 1}</span><div class="grp">${x.banned.map(b => `<div class="rt">${rt(b.g)} <span class="chip bad">trễ ${mins(b.late)}</span></div>`).join("")}</div></div>` : "").join("")}</div>`
        : `<p class="empty">Không tuyến nào bị loại: mọi tuyến bước 1 tìm ra đều kịp ngay vòng đầu.</p>`); }

  /* tham số: [nhóm, khóa, nhãn, đơn vị, hệ số hiển thị] */
  const PF = [["Xe", "fill", "Lấp đầy xe tối đa", "%", 1], ["Xe", "maxStops", "Số điểm tối đa một tuyến", "điểm", 1], ["Xe", "maxKm", "Hai điểm cách nhau tối đa", "km", 1],
    ["Xe", "cotGap", "Giờ xe lượt đầu lệch tối đa", "phút", 1], ["Xe", "minGain", "Mỗi bước phải lợi ít nhất", "tr/kỳ", 1e6], ["Xe", "cityKm", "Xa SOC hơn thì giá theo km", "km", 1], ["Xe", "dropSur", "Xe trả nhiều SOC: + mỗi SOC", "%", 1],
    ["Người", "lateTol", "Cho trễ COT tối đa", "phút", 1], ["Người", "peakP", "Ngày đông = phân vị", "%", 1], ["Người", "fteH", "Một người làm", "giờ/ngày", 1],
    ["Năng suất (theo đặc điểm seller)", "prodBase", "Sort lý tưởng (1 chute, 10% hàng to)", "đơn/người/ngày", 1], ["Năng suất (theo đặc điểm seller)", "prodHand", "Không sort (quét, bàn giao)", "đơn/người/ngày", 1],
    ["Năng suất (theo đặc điểm seller)", "prodChute", "Mỗi chute thêm ngoài 1", "−%", 1], ["Năng suất (theo đặc điểm seller)", "prodBulky", "Mỗi 10 điểm % hàng to lệch 10%", "−%", 1],
    ["Loại người", "ftePay", "FTE riêng", "k/người/ngày", 1e3], ["Loại người", "hubPay", "Nhóm FM Hub", "k/người/ngày", 1e3], ["Loại người", "hubKm", "Nhóm hub: điểm cách nhau tối đa", "km", 1],
    ["Loại người", "hubSpd", "Nhóm hub di chuyển", "km/giờ", 1], ["Loại người", "ppsRate", "Rider PPS", "đ/đơn", 1], ["Loại người", "ppsSpd", "Rider quét", "đơn/giờ", 1]];
  function pform() { let gr = ""; $("pform").innerHTML = `<div class="pgrid">${PF.map(([g, k, lab, u, f]) => (g !== gr ? `<h3>${(gr = g)}</h3>` : "") +
      `<div class="pf"><label for="p-${k}">${lab}</label><span><input id="p-${k}" type="number" step="any" value="${+(P[k] / f).toFixed(3)}"><span class="u">${u}</span></span></div>`).join("")}</div>
      <div class="pbar"><button type="button" class="btn" id="prun">Chạy lại</button><button type="button" class="btn ghost" id="pdef">Về mặc định</button></div>`; }
  const DEF = Object.assign({}, P);

  function render() { tabs(); const R = ST.R;
    if (!ST.res[R]) { document.querySelector(".wrap").classList.add("busy"); setTimeout(() => { res(R); document.querySelector(".wrap").classList.remove("busy"); render(); queue(); }, 20); return; }
    const r = ST.res[R]; flow(r); packs(r); teams(r); bans(r); }
  /* tính dần các vùng còn lại để tab hiện số */
  function queue() { const R = REGS.find(x => !ST.res[x]); if (R) setTimeout(() => { res(R); tabs(); queue(); }, 30); }

  document.addEventListener("click", e => { const t = e.target;
    const tb = t.closest("[data-r]"); if (tb) { LV.close(); ST.R = tb.dataset.r; try { localStorage.setItem("d2s-core-R", ST.R); } catch (x) {} render(); return; }
    const lv = t.closest("[data-live]"); if (lv) { const r = ST.res[ST.R], k = +lv.dataset.live; LV.open(r, r.packs[k], `Gói ${k + 1} · ${r.R}`); $("live").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const pk = t.closest("tr.pk"); if (pk) { const id = pk.dataset.p; ST.open.has(id) ? ST.open.delete(id) : ST.open.add(id); packs(ST.res[ST.R]); return; }
    if (t.id === "prun" || t.id === "pdef") { PF.forEach(([, k, , , f]) => { const v = t.id === "pdef" ? DEF[k] : parseFloat($("p-" + k).value) * f; if (isFinite(v)) P[k] = v; });
      if (t.id === "pdef") pform(); LV.close(); C.reset(); ST.res = {}; ST.open.clear(); render(); } });
  document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("tr.pk")) { e.preventDefault(); e.target.click(); } });

  pform(); render();
})();
