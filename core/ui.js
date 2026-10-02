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
  const K = Calib(C, REF), CAL = {}; ST.line = "1"; try { ST.line = localStorage.getItem("d2s-core-line") || "1"; } catch (e) {}
  /* hạn COT chỉnh tay: lưu trên trình duyệt, nạp lại khi mở trang */
  try { const o = JSON.parse(localStorage.getItem("d2s-core-dl") || "{}"), ld = (M, f) => Object.entries(M || {}).forEach(([n, m]) => Object.entries(m).forEach(([k, v]) => f(n, +k, v)));
    if (o.dl || o.av || o.hc || o.tr) { ld(o.dl, C.setDeadline); ld(o.av, C.setAvail); Object.entries(o.hc || {}).forEach(([n, v]) => C.setHC(n, v)); ld(o.tr, C.setTruck); } else ld(o, C.setDeadline); } catch (e) {}
  const LV = Live(C, $("live"), { onApply(ch, pts) { ch.forEach(c => c.f === "tr" ? C.setTruck(c.rk, c.k, c.v) : c.f === "hc" ? C.setHC(c.name, c.v) : (c.f === "av" ? C.setAvail : C.setDeadline)(c.name, c.k, c.v)); try { localStorage.setItem("d2s-core-dl", JSON.stringify({ dl: C.DLOV, av: C.AVOV, hc: C.HCOV, tr: C.TROV })); } catch (e) {}
    const R = ST.R; delete ST.res[R]; ST.open.clear(); document.querySelector(".wrap").classList.add("busy");
    setTimeout(() => { const r = res(R); document.querySelector(".wrap").classList.remove("busy"); render();
      /* mở lại tuyến có nhiều điểm chung nhất với tuyến đang xem (kế hoạch có thể đổi sau khi chạy lại) */
      let best = -1, bg = 0, bn = 0; r.packs.forEach((p, k) => p.nw.forEach((g, gi) => { const n = g.filter(i => pts.includes(i)).length; if (n > bn) { bn = n; best = k; bg = gi; } }));
      if (best >= 0) LV.open(r, r.packs[best], `Gói ${best + 1} · ${R}`, bg); else LV.close(); }, 20); } });
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
  const modeOf = (g, h, i) => h.A && h.A[i] ? C.modeTxt(h.A[i], i) : "FTE riêng";

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
        <td><div class="grp">${p.nw.map((g, gi) => `<div class="rt"><button type="button" class="play sm" data-live="${k}" data-gi="${gi}" aria-label="Chạy live gói ${k + 1} tuyến ${gi + 1}" title="Chạy live tuyến này">▶</button>${rt(g)} ${verdict(r.hc(g))}</div>`).join("")}</div></td>
        <td class="r mono pos">${sg(p.gain)}</td><td class="r mono ${lab <= 0 ? "pos" : "neg"}">${sg(-lab)}</td></tr>
        ${open ? `<tr class="det"><td colspan="5">${p.nw.map(g => routeDetail(r, g)).join("")}</td></tr>` : ""}`; }).join("");
    $("packs").innerHTML = `<header><h2>Các gói · ${r.R}</h2><span class="muted" style="font-size:12px">bấm một gói để xem lịch từng lượt ở ngày đông</span></header>
      <div class="scroll"><table><thead><tr><th>#</th><th>Hiện nay</th><th>Kế hoạch · bước 2</th><th class="r">Tiền xe tr/kỳ</th><th class="r">Tiền người tr/kỳ</th></tr></thead><tbody>${body}</tbody></table></div>`; }

  /* từng FM Hub có ≥ 2 điểm D2S: điểm nào vào nhóm FTE chung, điểm nào không và vì sao */
  const WHY = { "xa": "cách điểm khác > " + P.hubKm + " km", "trễ": "gom thì tuyến xe trễ COT", "đắt hơn": "gom không rẻ hơn FTE riêng" };
  function hubRep(r) { const H = r.L1.hubs || []; if (!H.length) return `<p class="empty">Không FM Hub nào cover từ 2 điểm D2S trở lên.</p>`;
    const n = H.reduce((a, h) => a + h.pts.length, 0), nin = H.reduce((a, h) => a + h.pts.length - h.solo.length, 0);
    return `<div class="scroll"><table><thead><tr><th>FM Hub cover ≥ 2 điểm · ${nin}/${n} điểm vào nhóm chung</th><th class="r">Điểm</th><th class="r">Xa nhất</th><th>Nhóm FTE chung</th><th>Vẫn FTE riêng · vì sao</th></tr></thead><tbody>${H.map(h =>
      `<tr><td>${esc(h.h)}</td><td class="r mono">${h.pts.length}</td><td class="r mono">${h.km > 1e8 ? "?" : h.km.toFixed(0) + " km"}</td><td>${h.teams.map(t => `${t.id}: ${rt(t.pts)} <span class="muted mono">${t.n} người</span>`).join("<br>") || `<span class="muted">–</span>`}</td>
        <td>${h.solo.map(x => `${esc(short(x.i))} <span class="muted">${esc(Object.entries(x.why).sort((a, b) => b[1] - a[1]).map(e => WHY[e[0]] || e[0]).join(" / ") || (C.HCOV[C.nm(x.i)] != null ? "số người chỉnh tay" : "không còn điểm cùng hub để gom"))}</span>`).join("<br>") || `<span class="muted">–</span>`}</td></tr>`).join("")}</tbody></table></div>`; }
  function teams(r) { const T = r.L1.teams, cnt = A => Object.values(A).reduce((o, a) => (o[a.m] = (o[a.m] || 0) + 1, o), {}), c0 = cnt(r.L0.A), c1 = cnt(r.L1.A);
    const mix = c => `FTE riêng ${c.F || 0} · FTE chung ${c.H || 0}`;
    $("teams").innerHTML = `<header><h2>Người · ${r.R}</h2><span class="muted" style="font-size:12px">số điểm theo cách dùng người: hiện nay ${mix(c0)} → kế hoạch ${mix(c1)}</span></header>` +
      hubRep(r) + (T.length ? `<div class="scroll"><table><thead><tr><th>Nhóm FTE chung</th><th>Hub</th><th>Điểm (đi theo hạn COT sớm nhất trước)</th><th class="r">Người</th><th class="r">tr/kỳ</th></tr></thead><tbody>${T.map(t =>
        `<tr><td class="mono">${t.id}</td><td>${esc(t.hub)}</td><td>${rt(t.pts)}</td><td class="r mono">${t.n}</td><td class="r mono">${tr(t.c)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">Không có nhóm FTE chung nào rẻ hơn FTE riêng.</p>`); }

  function bans(r) { const it = r.iters.filter(x => x.banned.length);
    $("bans").innerHTML = `<header><h2>Tuyến bị bước 2 loại</h2><span class="muted" style="font-size:12px">loại xong, bước 1 tìm lại tuyến khác</span></header>` +
      (it.length ? `<div class="bans">${r.iters.map((x, k) => x.banned.length ? `<div class="ban"><span class="it">vòng ${k + 1}</span><div class="grp">${x.banned.map(b => `<div class="rt">${rt(b.g)} <span class="chip bad">trễ ${mins(b.late)}</span></div>`).join("")}</div></div>` : "").join("")}</div>`
        : `<p class="empty">Không tuyến nào bị loại: mọi tuyến bước 1 tìm ra đều kịp ngay vòng đầu.</p>`); }

  /* tham số: [nhóm, khóa, nhãn, đơn vị, hệ số hiển thị] */
  const PF = [["Xe", "fill", "Lấp đầy xe tối đa", "%", 1], ["Xe", "maxStops", "Số điểm tối đa một tuyến", "điểm", 1], ["Xe", "maxKm", "Hai điểm cách nhau tối đa", "km", 1],
    ["Xe", "cotGap", "Giờ xe lượt đầu lệch tối đa", "phút", 1], ["Xe", "minGain", "Mỗi bước phải lợi ít nhất", "tr/kỳ", 1e6], ["Xe", "cityKm", "Xa SOC hơn thì giá theo km", "km", 1], ["Xe", "dropSur", "Xe trả nhiều SOC: + mỗi SOC", "%", 1], ["Xe", "vehMin", "As-is: chỉ dùng loại xe chiếm ≥", "% chuyến", 1], ["Xe", "vehFree", "Đòn bẩy đổi loại xe (1 = mọi loại)", "", 1], ["Xe", "newPen", "Tuyến mới đắt hơn model (thận trọng)", "%", 1],
    ["Người", "lateTol", "Cho trễ COT tối đa", "phút", 1], ["Xe", "closeMin", "Chốt xe sau khi hàng cuối sẵn", "phút", 1], ["Xe", "early", "Xe đi sớm, dồn đơn chưa xong sang COT sau (1 = bật, 0 = chờ đủ đơn)", "", 1], ["Xe", "rollMax", "Mỗi lượt-điểm dồn tối đa", "% đơn", 1], ["Người", "maxExtra", "Tuyến trễ: thêm FTE riêng tối đa mỗi điểm", "người", 1], ["Người", "peakP", "Ngày đông = phân vị", "%", 1], ["Người", "fteH", "Một người làm", "giờ/ngày", 1],
    ["Năng suất (theo đặc điểm seller)", "prodBase", "Sort lý tưởng (1 chute, 10% hàng to)", "đơn/người/ngày", 1], ["Năng suất (theo đặc điểm seller)", "prodHand", "Không sort (quét, bàn giao)", "đơn/người/ngày", 1],
    ["Năng suất (theo đặc điểm seller)", "prodChute", "Mỗi chute thêm ngoài 1", "−%", 1], ["Năng suất (theo đặc điểm seller)", "prodBulky", "Mỗi 10 điểm % hàng to lệch 10%", "−%", 1],
    ["Loại người", "ftePay", "FTE riêng", "k/người/ngày", 1e3], ["Loại người", "hubPay", "FTE chung (nhóm FM Hub)", "k/người/ngày", 1e3], ["Loại người", "hubKm", "FTE chung: điểm cách nhau tối đa", "km", 1],
    ["Loại người", "hubSpd", "FTE chung di chuyển", "km/giờ", 1]];
  function pform() { let gr = ""; $("pform").innerHTML = `<div class="pgrid">${PF.map(([g, k, lab, u, f]) => (g !== gr ? `<h3>${(gr = g)}</h3>` : "") +
      `<div class="pf"><label for="p-${k}">${lab}</label><span><input id="p-${k}" type="number" step="any" value="${+(P[k] / f).toFixed(3)}"><span class="u">${u}</span></span></div>`).join("")}</div>
      <div class="pbar"><button type="button" class="btn" id="prun">Chạy lại</button><button type="button" class="btn ghost" id="pdef">Về mặc định</button></div>`; }
  const DEF = Object.assign({}, P);

  /* ---------- DÂY CHUYỀN 0: dữ liệu & kiểm định as-is ---------- */
  const pass = ok => `<span class="chip ${ok ? "ok" : "bad"}">${ok ? "ĐẠT" : "CHƯA ĐẠT"}</span>`, pf = x => x == null ? "–" : Math.round(x) + "%";
  function calib(R) { const c = CAL[R] || (CAL[R] = K.run(R)), p = c.ph, T = K.T;
    $("calib").innerHTML = `<div class="gate">
      <div class="step"><h2>Mô phỏng lại kỳ ${pass(c.ok.rep)}</h2><div class="big ${c.ok.rep ? "pos" : "neg"}">${Math.max(c.rep.cost, c.rep.trips).toFixed(1)}%</div>
        <dl class="kv"><dt>Sai số tiền theo tuyến</dt><dd>${c.rep.cost.toFixed(1)}%</dd><dt>Sai số số chuyến theo tuyến</dt><dd>${c.rep.trips.toFixed(1)}%</dd><dt>Ngưỡng</dt><dd>≤ ${T.calRep}%</dd></dl>
        <p class="note2">Học và chạy lại trên chính kỳ này, mỗi tuyến hiện nay có hệ số chỉnh chuyến và giá. Đây là bài khớp lại, chưa phải bằng chứng dự báo — xem kiểm định độc lập.</p></div>
      <div class="step"><h2>Kiểm định độc lập ${pass(c.ok.cost)}</h2><div class="big ${c.ok.cost ? "pos" : "neg"}">${c.gap >= 0 ? "+" : "−"}${Math.abs(c.gap).toFixed(1)}%</div>
        <dl class="kv"><dt>Thực tế (chuyến thật × giá)</dt><dd>${tr(c.rc)}</dd><dt>Mô hình dự báo</dt><dd>${tr(c.mc)}</dd><dt>Ngưỡng tổng</dt><dd>±${T.calCost}%</dd>
        <dt>Sai số theo tuyến, cả kỳ</dt><dd class="${c.wRoute <= T.calRoute ? "pos" : "neg"}">${c.wRoute.toFixed(1)}%</dd><dt>Mức nhiễu ngày (không thể thấp hơn)</dt><dd>${c.wNoise.toFixed(1)}%</dd><dt>Ngưỡng</dt><dd>≤ ${T.calRoute}%</dd></dl>
        <p class="note2">Học trên ngày lẻ, dự báo ngày chẵn chỉ từ số đơn, rồi đổi vai.</p></div>
      ${c.fwd ? `<div class="step"><h2>Dự báo theo thời gian</h2><div class="big">${c.fwd.gap >= 0 ? "+" : "−"}${Math.abs(c.fwd.gap).toFixed(1)}%</div>
        <dl class="kv"><dt>Học ${c.fwd.nf} ngày trước ${esc(c.fwd.cut)}, dự báo ${c.fwd.nt} ngày sau</dt><dd></dd><dt>Sai số theo tuyến</dt><dd>${c.fwd.wRoute.toFixed(1)}%</dd><dt>Mức nhiễu ngày</dt><dd>${c.fwd.wNoise.toFixed(1)}%</dd>
        <dt>Chuyến tuyến × ngày · mốc thống kê</dt><dd>${pf(c.fwd.wTrip)} · ${pf(c.fwd.wStat)}</dd><dt>Giờ rời điểm · tới SOC</dt><dd>${pf(c.fwd.dep)} · ${pf(c.fwd.soc)}</dd></dl>
        <p class="note2">Bài khó nhất: vận hành đổi theo thời gian (đổi đội xe, đổi ghép xe, seller tăng đơn). Phần lệch trên mức nhiễu là thay đổi mà dữ liệu cũ không báo trước.</p></div>` : ""}
      <div class="step"><h2>Số chuyến/ngày</h2><div class="big">${c.mt.toFixed(0)} <span class="muted" style="font-size:13px">vs ${c.rt.toFixed(0)} thật</span></div>
        <dl class="kv"><dt>Sai số chuyến, tuyến × ngày</dt><dd>${pf(c.wTrip)}</dd><dt>Mốc thống kê (đường thẳng theo đơn)</dt><dd>${pf(c.wStat)}</dd><dt>Sai số tiền, tuyến × ngày</dt><dd>${pf(c.wDay)}</dd></dl>
        <p class="note2">Mốc thống kê: đoán chuyến chỉ từ số đơn, học cùng nửa ngày. Model sát mốc này là đã lấy hết phần data giải thích được.</p></div>
      <div class="step"><h2>Vật lý mô phỏng ${pass(c.ok.time)}</h2><div class="big ${c.ok.time ? "pos" : "neg"}">${pf(Math.min(p.depSys, p.socSys))}</div>
        <dl class="kv"><dt>Giờ rời điểm: nhóm điểm × COT lệch ≤ ${T.calTime}' (${p.n} lần dừng)</dt><dd>${pf(p.depSys)}</dd><dt>Giờ tới SOC: nhóm lệch ≤ ${T.calTime}' (${p.nSoc} chuyến)</dt><dd>${pf(p.socSys)}</dd><dt>Ngưỡng</dt><dd>≥ ${T.calShare}%</dd>
        <dt>Từng lần dừng lệch ≤ ${T.calTime}' · trần</dt><dd>${pf(p.dep)} · ${pf(p.depCeil)}</dd><dt>Từng chuyến tới SOC · trần</dt><dd>${pf(p.soc)} · ${pf(p.socCeil)}</dd></dl>
        <p class="note2">Phát lại từng chuyến thật. Trần = đoán mỗi lần bằng trung vị thật của nhóm; phần trên trần là dao động ngày-qua-ngày.</p></div>
      <div class="step res"><h2>Dư địa thấy ngay</h2><div class="big">${pf(p.waitBig)}</div>
        <dl class="kv"><dt>Lần dừng xe đứng chờ &gt; 30' ngoài thời gian chất</dt><dd>${pf(p.waitBig)}</dd></dl>
        <p class="note2">Model vật lý không đoán được phần chờ này. Đây là thời gian xe nằm ở seller, đòn bẩy cho to-be.</p></div></div>
      <section class="card"><header><h2>Nguồn dữ liệu · ${R}</h2><span class="muted" style="font-size:12px">as-is bám data, thiếu thì giả định, không sửa data gốc</span></header>
        <div class="scroll"><table><thead><tr><th>Dữ liệu</th><th class="r">Điểm có data</th><th class="r">Điểm giả định</th><th>Nguồn · cách giả định</th></tr></thead><tbody>${c.src.map(([n, a, b, w]) =>
          `<tr><td>${esc(n)}</td><td class="r mono">${a}</td><td class="r mono ${b ? "neg" : ""}">${b}</td><td class="muted">${esc(w)}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="card"><header><h2>Tuyến hiện nay lệch tiền nhiều nhất · kiểm định độc lập</h2><span class="muted" style="font-size:12px">tr/kỳ · chuyến/ngày</span></header>
        <div class="scroll"><table><thead><tr><th>Tuyến hiện nay</th><th class="r">Thực tế</th><th class="r">Mô hình</th><th class="r">Lệch</th><th class="r">Ngày</th><th class="r">Chuyến/ngày thật → mô hình</th></tr></thead><tbody>${c.rows.slice(0, 15).map(x =>
          `<tr><td>${rt(x.g)}</td><td class="r mono">${tr(x.rc)}</td><td class="r mono">${tr(x.mc)}</td><td class="r mono ${Math.abs(x.gap) > T.calRoute ? "neg" : "pos"}">${x.gap >= 0 ? "+" : ""}${x.gap.toFixed(0)}%</td><td class="r mono">${x.nd}${x.nd < 4 ? ' <span class="muted">ít dữ liệu</span>' : ""}</td><td class="r mono">${x.rtd.toFixed(1)} → ${x.mtd.toFixed(1)}</td></tr>`).join("")}</tbody></table></div></section>`; }
  function lines() { document.querySelectorAll("#lines [data-line]").forEach(b => b.setAttribute("aria-pressed", b.dataset.line === ST.line)); $("calib").hidden = ST.line !== "0"; $("plan").hidden = ST.line === "0"; }

  function render() { tabs(); lines(); const R = ST.R;
    if (ST.line === "0") { if (!CAL[R]) { document.querySelector(".wrap").classList.add("busy"); setTimeout(() => { CAL[R] = K.run(R); document.querySelector(".wrap").classList.remove("busy"); render(); }, 20); return; } calib(R); return; }
    if (!ST.res[R]) { document.querySelector(".wrap").classList.add("busy"); setTimeout(() => { res(R); document.querySelector(".wrap").classList.remove("busy"); render(); queue(); }, 20); return; }
    const r = ST.res[R]; ovr(); flow(r); packs(r); teams(r); bans(r); }
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
    const tb = t.closest("[data-r]"); if (tb) { LV.close(); ST.R = tb.dataset.r; try { localStorage.setItem("d2s-core-R", ST.R); } catch (x) {} render(); return; }
    if (t.id === "ovr-clr") { OVS().forEach(([, M]) => Object.keys(M).forEach(k => { delete M[k]; })); try { localStorage.removeItem("d2s-core-dl"); } catch (x) {}
      LV.close(); C.reset(); ST.res = {}; ST.open.clear(); render(); return; }
    const lv = t.closest("[data-live]"); if (lv) { const r = ST.res[ST.R], k = +lv.dataset.live; LV.open(r, r.packs[k], `Gói ${k + 1} · ${r.R}`, +(lv.dataset.gi || 0)); $("live").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const pk = t.closest("tr.pk"); if (pk) { const id = pk.dataset.p; ST.open.has(id) ? ST.open.delete(id) : ST.open.add(id); packs(ST.res[ST.R]); return; }
    if (t.id === "prun" || t.id === "pdef") { PF.forEach(([, k, , , f]) => { const v = t.id === "pdef" ? DEF[k] : parseFloat($("p-" + k).value) * f; if (isFinite(v)) P[k] = v; });
      if (t.id === "pdef") pform(); LV.close(); C.reset(); Object.keys(CAL).forEach(k => delete CAL[k]); ST.res = {}; ST.open.clear(); render(); } });
  document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("tr.pk")) { e.preventDefault(); e.target.click(); } });

  pform(); render();
})();
