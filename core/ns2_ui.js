/* ===== D2S NEW SELLER (bản gộp) — giao diện trên engine thật (nsPlan) và số học từ dữ liệu của kỳ =====
   Trang chủ 2 thẻ: A = đánh giá seller mới (form 9 mục → kết quả), B = seller đang chạy + mạng lưới SPX. */
const $ = id => document.getElementById(id);
const nf = (v, d = 0) => (+v).toLocaleString("vi-VN", { maximumFractionDigits: d, minimumFractionDigits: d });
const fa = (v, d = 1) => (v < 0 ? "−" : "") + nf(Math.abs(v), d);
const fs = (v, d = 1) => (v > 0.049 ? "+" : v < -0.049 ? "−" : "±") + nf(Math.abs(v), d);
const tr = v => v / 1e6;   /* đồng → triệu */
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hm = m => m == null || !isFinite(m) ? "—" : String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0") + ":" + String(Math.round(((m % 60) + 60) % 60)).padStart(2, "0");
const cotL = p => p >= 1440 ? "24:00" : hm(p);
const tmin = s => { const m = /^(\d{1,2}):?(\d{2})$/.exec(String(s || "").trim()); return m ? +m[1] * 60 + +m[2] : null; };
const shortN = n => String(n || "").replace(/^(HCMSeller|HCMSPC|SouthSeller|South Seller|South)\s*-\s*/, "").trim();
const SN = s => NS2_SHORT[s] || String(s || "").replace(" Mega SOC", "").replace(" SOC", "");
const DTN = ["BAU", "Mini CP", "CP"], SHIFT = REF.P.ftePay || 350000;
const DC = { "BD A Mega SOC": "var(--s1)", "HCM Mega SOC": "var(--s2)", "BD B Mega SOC": "var(--s3)", "SW SOC": "var(--s4)" };

/* ===== tooltip dùng chung: phần tử có data-tip ===== */
const tip = $("tip");
document.addEventListener("pointermove", e => { const t = e.target.closest && e.target.closest("[data-tip]"); if (!t) { tip.hidden = true; return; } tip.innerHTML = t.dataset.tip; tip.hidden = false; const w = tip.offsetWidth, h = tip.offsetHeight; let x = e.clientX + 14, y = e.clientY + 14; if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y + h > innerHeight - 8) y = e.clientY - h - 14; tip.style.left = x + "px"; tip.style.top = y + "px"; });
const S = (w, h, inner, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${inner}</svg>`;
/* thanh ngang có đầu bo 4px (bo phía ngoài), bắt đầu từ trục; cột đứng bo 4px phía trên */
const hbar = (x, y, w, h, fill, tipTxt, roundEnd) => { if (w <= 0) return ""; const r = roundEnd ? Math.min(4, w, h / 2) : 0; return roundEnd ? `<path d="M${x} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x}Z" fill="${fill}" data-tip="${tipTxt}"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" data-tip="${tipTxt}"/>`; };
const vbar = (x, y0, w, y, fill, tipTxt) => { const h = y0 - y; if (h <= 0) return ""; const r = Math.min(4, w / 2, h); return `<path d="M${x} ${y0}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y0}Z" fill="${fill}" data-tip="${tipTxt}"/>`; };
const ddmm = d => d ? d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4) : "";
$("h-data").textContent = `Dữ liệu thật · ${ddmm(XT.from)} – ${ddmm(XT.to)} · ${Object.keys(REF.reg).join(" & ")}`;
$("h-npts").textContent = Object.entries(XT.run).map(([R, L]) => `${L.length} điểm ${R}`).join(" · ");
$("ex-dates").textContent = `(${ddmm(REF.dates[0])} – ${ddmm(REF.dates[1])}, ${REF.dates[2]} ngày)`;

/* ===== ĐIỀU HƯỚNG: trang chủ 2 thẻ, mỗi thẻ một bộ tab ===== */
const SUITE = { home: "home", form: "A", busy: "A", dash: "A", run: "B", net: "B" }, VIEW = { home: "v-home", form: "v-form", busy: "v-busy", dash: "v-dash", run: "p-run", net: "p-net" };
const HEAD = { home: ["D2S New Seller", "Hai việc khác nhau: đánh giá một seller sắp nhận, và xem các điểm D2S đang chạy để chỉnh cài đặt sort."], A: ["Đánh giá seller mới", "Điền thông tin seller sắp nhận, bấm tính: lời/lỗ, xe, người và ca, COT, cách chạy rẻ hơn, ghép xe và so với seller giống — trên số học từ dữ liệu thật."], B: ["Seller đang chạy & mạng lưới SPX", "Lời/lỗ từng điểm D2S đang chạy với tiền xe thật của kỳ, nút thắt và đòn bẩy tốt nhất; chỉnh cài đặt sort của từng điểm."] };
let DONE = false;
function go(v) { const su = SUITE[v]; document.body.dataset.suite = su; Object.entries(VIEW).forEach(([k, id]) => { $(id).hidden = k !== v; });
  $("stepNav").hidden = su === "home"; document.querySelectorAll("#stepNav [data-nav]").forEach(b => { const k = b.dataset.nav; b.hidden = SUITE[k] !== su; b.setAttribute("aria-current", (k === v || (v === "busy" && k === "dash")) ? "page" : "false"); if (k === "dash") b.disabled = !DONE; });
  const h = HEAD[su === "home" ? "home" : su]; $("h-title").textContent = h[0]; $("h-sub").textContent = h[1];
  if (v === "run") drawRun(); if (v === "net") drawNet(); window.scrollTo({ top: 0 }); }
document.addEventListener("click", e => { const b = e.target.closest("[data-nav],[data-go]"); if (!b || b.disabled) return; go(b.dataset.nav || b.dataset.go); });

/* ===== DIỄN GIẢI & VÍ DỤ TỪNG Ô ===== */
const HELP = {
  "f-name": ["Tên kho hoặc seller, để lưu và tìm lại kết quả.", "Kho ABC Tân Phú."],
  "f-ll": ["Toạ độ kho: gợi ý FM Hub, Sup, tính km tới từng SOC (giá xe) và tìm điểm gần để ghép xe. Trên Google Maps: nhấn giữ vào kho → bấm vào toạ độ để copy.", "10.79, 106.63"],
  "f-hub": ["FM Hub đang lấy hàng seller này: để so tiền FM pickup và tìm điểm cùng hub dùng chung người. Tự gợi ý hub gần nhất theo toạ độ.", "50-HCM Tan Phu/Tan Quy Hub."],
  "f-sup": ["Sup quản lý điểm. Chỉ ghép xe với điểm cùng Sup (quy định OE).", ""],
  "f-a0": ["Số đơn trung bình một ngày thường (không campaign). Lấy từ seller/KAM, hoặc 30 ngày FM pickup gần nhất. Seller chỉ chạy D2S ngày campaign thì để 0.", "4.000."],
  "f-a1": ["Số đơn một ngày Mini CP (15/15, 25/25…).", "6.400 (≈ 1,6 × BAU)."],
  "f-a2": ["Số đơn ngày CP lớn (9/9, 10/10, 11/11, 12/12).", "10.000 (≈ 2,5 × BAU)."],
  "f-d0": ["Số ngày BAU trong tháng, để quy ra tiền mỗi tháng.", "25."], "f-d1": ["Số ngày Mini CP trong tháng.", "4."], "f-d2": ["Số ngày CP trong tháng.", "1."],
  "f-bk": ["% đơn là hàng to, cồng kềnh. Hàng to làm xe chở được ít đơn hơn, sort chậm hơn và đơn giá FM pickup cao hơn.", "mỹ phẩm ~10%, gia dụng ~35%."],
  "f-bk0": ["Chỉ điền nếu ngày BAU khác % chung.", ""], "f-bk1": ["Chỉ điền nếu ngày Mini CP khác % chung.", ""], "f-bk2": ["Chỉ điền nếu ngày CP khác % chung.", "ngày CP bán nhiều đồ nhỏ → 25."],
  "f-open": ["Giờ người SPX có mặt tại kho đầu ngày.", "08:00."],
  "f-hop": ["Seller giao hàng ra sao trong khung giờ: đều, dồn cuối, một cục cuối khung, hay theo đợt.", "kho in đơn theo batch 2 tiếng → “Theo đợt”."],
  "f-tail": ["% đơn tới trong 60 phút cuối khung. Càng cao càng dễ trễ COT.", "30."], "f-hon": ["Số lần seller đẩy hàng ra trong một lượt.", "3."],
  "f-late": ["Seller thường giao trễ bao nhiêu phút so với hết khung (trung bình).", "15."],
  "f-gates": ["Số chỗ seller giao hàng cho SPX. Nhiều cổng thì cần thêm người hoặc xe đi vòng.", "1 (kho nhỏ), 2 (kho hai toà)."],
  "f-horate": ["Một cổng giao được bao nhiêu đơn mỗi giờ (giới hạn bởi băng chuyền hoặc người của seller). Trống = không giới hạn.", "900."],
  "f-gmode": ["Khi có nhiều cổng: một xe đi vòng các cổng hay mỗi cổng một xe. “Tự chọn” = chọn cách ít dồn/trễ, rồi rẻ.", ""], "f-gmove": ["Phút xe di chuyển giữa hai cổng.", "10."],
  "f-like": ["Seller có hàng giống (ngành hàng, cỡ đơn) để học số đơn chất được trên mỗi cỡ xe. Tự động = trung vị các seller cùng vùng có % hàng to gần.", ""],
  "f-dwfix": ["Phút xe đứng cố định mỗi lần lấy hàng: vào cổng, ký giấy, niêm phong. Trống = trung vị học từ chuyến thật.", "15."],
  "f-dwrate": ["Phút thêm cho mỗi 100 đơn chất lên xe. Trống = học từ chuyến thật.", "2 → 800 đơn thêm 16 phút."],
  "f-lab": ["Ai làm tại kho: FTE riêng 350k/ca; nhóm FM Hub (cùng lương, chia người với điểm D2S cùng hub); hoặc rider PPS 700 đ/đơn.", ""],
  "f-oscap": ["Số người tối đa có thể cấp cho điểm này. Kế hoạch cần nhiều hơn thì kết quả báo thiếu người, dồn đơn hoặc trễ.", "6."],
  "f-pbase": ["Một người sort được bao nhiêu đơn/ngày ở điều kiện chuẩn (1 chute, 10% hàng to).", "2.000."], "f-phand": ["Việc không phải sort: quét nhận, bàn giao, xếp xe.", "2.000 đơn/người/ngày."],
  "f-pchute": ["Mỗi chute thêm làm năng suất sort giảm bao nhiêu %.", "10 → 3 chute giảm 20%."], "f-pbulky": ["Mỗi 10 điểm % hàng to lệch khỏi 10% làm năng suất giảm bao nhiêu %.", "35% hàng to, 5 → giảm 12,5%."],
  "f-pfteh": ["Giờ làm thực trong ca 8 giờ (trừ nghỉ, họp).", "7."],
  "f-latetol": ["Xe được rời điểm trễ hạn COT tối đa bao nhiêu phút. Trễ trong ngưỡng vẫn chạy nhưng đánh dấu “theo dõi”.", "12."],
  "f-slack": ["Muốn mỗi lượt dư ít nhất bao nhiêu phút trước hạn COT (đệm kẹt xe).", "15."], "f-delay": ["Thử: nếu seller giao trễ thêm X phút ở ngày đông nhất thì còn kịp không.", "20."],
  "f-ban": ["Luật cấm xe 5T/8T đang áp dụng quanh kho. “Tự động” lấy theo các điểm D2S gần (≤ 3 km) suy từ giờ xe nặng chạy thật.", ""],
  "f-bna": ["Giờ bắt đầu cấm.", "06:00."], "f-bnb": ["Giờ hết cấm.", "22:00."], "f-bnfrom": ["Ngày luật bắt đầu áp dụng.", ""],
  "f-maxk": ["Xe lớn nhất vào được cổng và đường vào kho (chỉ các cỡ có chạy D2S ở vùng này).", "hẻm nhỏ → 1T9."], "f-bays": ["Số xe chất hàng cùng lúc được.", "4."],
  "f-area": ["Diện tích để hàng chờ xe ngày thường.", "120 m²."], "f-dens": ["Mỗi m² để được bao nhiêu đơn.", "40."], "f-dock": ["Phút để xe trước ra, xe sau de vào dock.", "5."],
  "f-gmax": ["% đơn qua cổng đông nhất (khi nhiều cổng).", "60."], "f-hodev": ["% năng suất mất khi seller giao lắt nhắt hoặc lệch giờ đã thống nhất.", "10."],
  "f-gfix": ["Tick nếu các cổng xa nhau, mỗi cổng phải có người đứng cố định.", ""], "f-areacp": ["Diện tích tập kết thêm ngày Mini CP/CP (có bạt, lều).", "300 m²."], "f-shelter": ["Có mái che thì năng suất tăng bao nhiêu % ngày campaign.", "5."],
  "f-camhas": ["Seller có camera quay khu bàn giao và đồng ý cung cấp khi đối soát mất/thiếu hàng.", ""], "f-camself": ["SPX tự lắp camera được không (thiết bị riêng, mạng của hub, không quay khu làm việc của kho).", ""], "f-camzone": ["Khu bàn giao của SPX nằm trong hay ngoài kho seller.", "ngoài kho như MCL."],
  "f-cusame": ["Bỏ chọn để cài riêng chute cho ngày Mini CP / CP.", "ngày CP tách thêm chute HCM Mega khi đủ đầy xe."]
};
function addHelp() { Object.entries(HELP).forEach(([id, [t, ex]]) => { const e = $(id); if (!e) return; const ck = e.closest("label.ck"), host = ck || e.closest("label.f") || e.parentElement;
    const p = document.createElement("p"); p.className = "fh"; p.innerHTML = t + (ex ? ` <i>${ex}</i>` : ""); if (ck) { p.style.marginTop = "-6px"; ck.after(p); } else host.appendChild(p); });
  const cap = document.querySelector(".g5"); if (cap) { const p = document.createElement("p"); p.className = "fh"; p.style.marginTop = "-6px"; p.innerHTML = `Seller hoặc Ops ước 1 xe mỗi cỡ chất được bao nhiêu đơn. Trống = học từ seller giống (số mờ, đã theo % hàng to).`; cap.after(p); } }
addHelp();
const setHelp = on => { document.body.classList.toggle("nohelp", !on); try { localStorage.setItem("ns-help", on ? "1" : "0"); } catch (e) { } };
try { if (localStorage.getItem("ns-help") === "0") { $("f-help").checked = false; setHelp(false); } } catch (e) { }
$("f-help").addEventListener("change", () => setHelp($("f-help").checked));

/* ===== FORM ===== */
let R = Object.keys(REF.reg)[0], MIX = {}, MIXSRC = "sim", PEERM = [], HUBMAN = false;
const V = id => $(id).value.trim(), VP = id => V(id) || $(id).placeholder;
const numv = id => { const v = V(id).replace(/\s/g, ""); if (v === "") return null; const n = +v.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."); return isFinite(n) ? n : null; };
const parseLL = s => { const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s || ""); return m ? [+m[1], +m[2]] : null; };
const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? " selected" : ""}>${esc(t ?? v)}</option>`;
/* giá trị điền sẵn coi là mặc định (đếm "đã chỉnh" chỉ tính phần người dùng sửa) */
const markDefaults = root => root.querySelectorAll("input,select").forEach(e => { if (e.type === "checkbox" || e.type === "radio") e.defaultChecked = e.checked; else if (e.tagName === "SELECT") [...e.options].forEach(o => { o.defaultSelected = o.selected; }); else e.defaultValue = e.value; });
/* cài đặt giá rã bao (tab Mạng lưới → nâng cao): giá tay, giá ASM, % ASM ở BD A / BD B */
const NETC = { man: 260, asm: null, pa: null, pb: null };
const costAt = to => { const p = to === "BD A Mega SOC" ? NETC.pa : to === "BD B Mega SOC" ? NETC.pb : null; return NETC.asm != null && p != null ? p / 100 * NETC.asm + (1 - p / 100) * NETC.man : NETC.man; };
/* giá một lần rã bao bình quân theo SOC mở bao của bảng chute (ngày BAU) */
const rsCostOf = (B, mix) => { let w = 0, c = 0; (B || []).forEach(ch => { const x = ns2Extra([ch], mix).sh; w += x; c += x * costAt(ch.to); }); return w > 0 ? c / w : NETC.man; };
function fillRegion() { const G = REF.reg[R], open = REF.P.open;
  $("f-waves").innerHTML = `<span class="h">COT (hạn giao linehaul)</span><span class="h">Bàn giao từ</span><span class="h">đến</span><span class="h">% đơn</span>` + G.cots.map((c, k) => `<b class="num">${cotL(c.p)}</b><input class="num" data-w="a${k}" value="${hm(Math.max(c.a, open))}" aria-label="Lượt ${cotL(c.p)} bàn giao từ"><input class="num" data-w="b${k}" value="${hm(c.b)}" aria-label="Lượt ${cotL(c.p)} bàn giao đến"><input class="num" data-w="s${k}" value="${Math.round(G.sh[k] * 100)}" aria-label="Lượt ${cotL(c.p)} % đơn">`).join("");
  const hubs = (XT.hubs[R] || []).slice().sort((a, b) => a[0].localeCompare(b[0])); $("f-hub").innerHTML = opt("", "(chưa chọn)") + hubs.map(h => opt(h[0])).join("");
  const sups = [...new Set((XT.hubs[R] || []).map(h => h[3]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")); $("f-sup").innerHTML = opt("", "(theo hub)") + sups.map(s => opt(s)).join("");
  $("f-like").innerHTML = opt("", "Tự động · seller cùng vùng, % hàng to gần") + REF.sel.filter(s => s.R === R).sort((a, b) => shortN(a.n).localeCompare(shortN(b.n))).map(s => opt(s.n, shortN(s.n))).join("");
  const fl = NS_KS.filter(k => !G.fleet || !G.fleet.length || G.fleet.includes(k)).reverse(); $("f-maxk").innerHTML = fl.map((k, i) => opt(k, k, i === 0)).join("");
  $("bn-wrap").hidden = !G.banNew; if (G.banNew) { document.querySelectorAll("[data-ban]").forEach(e => { e.checked = G.banNew.hv.includes(e.dataset.ban); }); $("f-bna").value = hm(G.banNew.ban[0]); $("f-bnb").value = hm(G.banNew.ban[1]); }
  $("f-dwfix").placeholder = nf(REF.dw.fix, 1); $("f-dwrate").placeholder = nf(REF.dw.rate * 100, 1);
  $("f-pbase").placeholder = nf(REF.P.prodBase); $("f-phand").placeholder = nf(REF.P.prodHand); $("f-pchute").placeholder = REF.P.prodChute; $("f-pbulky").placeholder = REF.P.prodBulky; $("f-pfteh").placeholder = REF.P.fteH;
  BRD = [ns2Preset(R === "HCM" ? "3" : "1", R), null, null]; HIST = []; SEL = null; HUBMAN = false;
  capPh(); mixDefault(); markDefaults($("v-form")); }
/* sức chở gợi ý theo % hàng to (trung vị seller cùng vùng ±10 điểm, như engine) */
function capPh() { const be = (numv("f-bk") ?? 35) / 100; let pool = REF.sel.filter(s => s.R === R && Math.abs(s.b - be) <= 0.1); if (pool.length < 3) pool = REF.sel.filter(s => Math.abs(s.b - be) <= 0.1); if (pool.length < 3) pool = REF.sel.slice().sort((a, b) => Math.abs(a.b - be) - Math.abs(b.b - be)).slice(0, 5);
  const med = a => { const b = a.filter(v => v > 0).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; }; let prev = 0;
  NS_KS.forEach((k, j) => { const v = Math.max(prev, med(pool.map(s => s.c[j]))); prev = v; const e = $("f-cap" + k); if (e) e.placeholder = v ? nf(v) : "—"; }); }
/* seller giống: cùng vùng, ADO BAU ±50% (khi đã nhập), gần nhất theo toạ độ */
function peersOf(ll, a0, n) { const L = (XT.run[R] || []).filter(r => r.ll); let C = a0 > 0 ? L.filter(r => r.a3[0] > 0 && Math.abs(r.a3[0] - a0) <= 0.5 * a0) : L.slice();
  if (C.length < (n || 3)) C = C.concat(L.filter(r => !C.includes(r)).sort((a, b) => Math.abs((a.a3[0] || a.a3[2]) - (a0 || 0)) - Math.abs((b.a3[0] || b.a3[2]) - (a0 || 0))));
  const km = r => ll ? ns2Hav(ll, r.ll) : 0; return C.slice(0, Math.max(n || 3, 3) * 3).sort((a, b) => km(a) - km(b)).slice(0, n || 3).map(r => Object.assign({ km: ll ? km(r) : null }, r)); }
function mixDefault() { const ll = parseLL(V("f-ll")), a0 = numv("f-a0") || 0, withPiv = (XT.run[R] || []).filter(r => XT.piv[r.n]);
  PEERM = R === "HCM" ? (() => { const L = withPiv.filter(r => r.ll), C = a0 > 0 ? L.filter(r => r.a3[0] > 0 && Math.abs(r.a3[0] - a0) <= 0.5 * a0) : L; const km = r => ll ? ns2Hav(ll, r.ll) : 0; return (C.length >= 2 ? C : L).slice().sort((a, b) => km(a) - km(b)).slice(0, 3); })() : [];
  $("mix-sim-t").textContent = PEERM.length ? PEERM.map(r => shortN(r.n) + (ll ? ` (${nf(ns2Hav(ll, r.ll), 1)} km)` : "")).join(", ") + " · cùng vùng" + (a0 > 0 ? ", ADO ±50%" : "") + ", gần nhất" : "Vùng này chưa có Volume by Sort Code";
  $("mix-avg-t").textContent = `${XT.pivPts} điểm · ${nf(XT.pivN / 1e6, 2)} triệu đơn tháng 8 (bỏ 4PL, HCM, SIP)`;
  const sim = document.querySelector("[name=mixsrc][value=sim]"); sim.disabled = !PEERM.length; if (!PEERM.length && MIXSRC === "sim") { MIXSRC = "avg"; document.querySelector("[name=mixsrc][value=avg]").checked = true; }
  $("mix-warn").hidden = R === "HCM"; $("mix-warn").textContent = R === "HCM" ? "" : `Volume by Sort Code chưa có điểm D2S ${R} → tạm dùng trung bình D2S HCM; có số ${R} thì thay.`;
  if (MIXSRC === "sim") MIX = ns2MixAvg(PEERM.map(r => XT.piv[r.n])); else if (MIXSRC === "avg") MIX = Object.assign({}, XT.pivAvg);
  drawMix(); }
function drawMix() { const top = NS2_CODES.slice().sort((a, b) => (MIX[b] || 0) - (MIX[a] || 0)), mx = Math.max(1, ...top.map(c => MIX[c] || 0));
  $("mix").innerHTML = top.slice(0, 8).map(g => `<div class="r"><span>${g}</span><span><span class="b" style="display:block;width:${(MIX[g] || 0) / mx * 100}%" data-tip="${g}: ${nf(MIX[g] || 0, 1)}% đơn · nhóm LM ${esc(NS2_LMG[g])} · SOC nhà ${SN(NS2_HOME[g])}"></span></span><span class="v">${nf(MIX[g] || 0, 1)}%</span></div>`).join("") + `<p class="hint">+ ${top.length - 8} mã nhỏ: ${top.slice(8).map(g => g + " " + nf(MIX[g] || 0, 1) + "%").join(" · ")}</p>`;
  $("mixin").innerHTML = NS2_CODES.map(g => `<label class="f"><span>${g}</span><input class="num" data-mix="${g}" value="${nf(MIX[g] || 0, 1)}" aria-label="% đơn mã ${g}"></label>`).join("") + `<p class="hint" style="grid-column:1/-1" id="mixsum"></p>`; mixSum(); }
const mixSum = () => { const t = NS2_CODES.reduce((a, c) => a + (MIX[c] || 0), 0); if ($("mixsum")) $("mixsum").innerHTML = `Tổng ${nf(t, 1)}%` + (Math.abs(t - 100) > 0.5 ? ` · <span class="err">nên bằng 100%</span>` : ""); };
document.querySelectorAll("[name=mixsrc]").forEach(r => r.addEventListener("change", () => { MIXSRC = document.querySelector("[name=mixsrc]:checked").value; const man = MIXSRC === "man"; $("mixin").hidden = !man; $("mix").hidden = man; if (!man) mixDefault(); check(); }));
$("mixin").addEventListener("input", e => { const g = e.target.dataset.mix; if (!g) return; const v = +String(e.target.value).replace(",", "."); MIX[g] = isFinite(v) ? Math.max(0, v) : 0; mixSum(); drawBoard(); });
/* hub gần nhất theo toạ độ; Sup theo hub */
function hubSuggest() { const ll = parseLL(V("f-ll")); if (!ll) { $("hubhint").textContent = ""; return; } const L = (XT.hubs[R] || []).map(h => [h, ns2Hav(ll, [h[1], h[2]])]).sort((a, b) => a[1] - b[1]);
  if (!L.length) return; const [h, km] = L[0]; if (!HUBMAN) { $("f-hub").value = h[0]; if (h[3]) $("f-sup").value = h[3]; }
  $("hubhint").textContent = `Hub gần nhất: ${h[0]} (${nf(km, 1)} km)` + (h[3] ? ` · Sup ${h[3]}` : "") + (HUBMAN ? " · đang dùng hub chọn tay" : ""); }
$("f-hub").addEventListener("change", () => { HUBMAN = true; const h = (XT.hubs[R] || []).find(z => z[0] === $("f-hub").value); if (h && h[3]) $("f-sup").value = h[3]; hubSuggest(); check(); });
$("f-ll").addEventListener("input", () => { hubSuggest(); mixDefault(); });
$("f-a0").addEventListener("change", mixDefault); $("f-bk").addEventListener("input", capPh);
/* bảng chute ngay trong form (mục 5): kéo hoặc chạm sort code vào chute; mỗi chute = 1 TO đi 1 SOC */
let BRD = [ns2Preset("3", "HCM"), null, null], CU = 0, SEL = null, HIST = [];
const board = () => $("f-cusame").checked || !CU ? BRD[0] : (BRD[CU] || (BRD[CU] = JSON.parse(JSON.stringify(BRD[0]))));
const boardsAll = () => [0, 1, 2].map(t => JSON.parse(JSON.stringify($("f-cusame").checked || !t ? BRD[0] : (BRD[t] || BRD[0]))));
const ordMonth = () => [0, 1, 2].reduce((a, i) => a + (numv("f-a" + i) || 0) * (numv("f-d" + i) || 0), 0);
function chipH(g, X, sel) { return `<span class="chip${X.has(g) ? " x" : ""}${sel === g ? " sel" : ""}" draggable="true" tabindex="0" role="button" data-g="${g}" data-tip="${g} · ${nf(MIX[g] || 0, 1)}% đơn · nhóm LM ${esc(NS2_LMG[g])} · SOC nhà ${SN(NS2_HOME[g])}${NS2_DRAFT.includes(g) ? " (nháp)" : ""}${X.has(g) ? " · <b>SOC đích phải rã bao, sort lại</b>" : ""}">${g}<small>${nf(MIX[g] || 0, 1)}</small></span>`; }
function effTxt(c) { if (!c.g.length) return "Chute trống — kéo mã vào."; if (c.via) return `${SN(c.to)} chuyển thẳng (transit) → ${SN(c.via)}`; const homes = [...new Set(c.g.map(g => NS2_HOME[g]))]; if (homes.length === 1 && homes[0] !== c.to) return `${SN(c.to)} chuyển thẳng → ${SN(homes[0])}`;
  const o = c.g.filter(g => NS2_HOME[g] !== c.to); return `${SN(c.to)} rã bao${o.length ? `: sort lại ${o.length} mã (${nf(o.reduce((a, g) => a + (MIX[g] || 0), 0), 1)}% đơn)` : ", sort tới hub"}`; }
function boardHTML(B, X, sel, pre) { const used = new Set(B.flatMap(c => c.g)), tray = NS2_CODES.filter(g => !used.has(g));
  return (tray.length ? `<div class="chute tray" data-c="-1"><div class="hd"><span>Chưa xếp chute</span></div><div class="chips">${tray.map(g => chipH(g, X, sel)).join("")}</div></div>` : "") +
    B.map((c, i) => `<div class="chute" data-c="${i}"><div class="hd"><span>Chute ${i + 1} · ${nf(c.g.reduce((a, g) => a + (MIX0(pre)[g] || 0), 0), 1)}%</span><button type="button" class="lk" data-del="${i}" aria-label="Bỏ chute ${i + 1}">Bỏ</button></div><div class="chips">${c.g.length ? c.g.map(g => chipH(g, X, sel)).join("") : `<span class="meta">Kéo mã vào</span>`}</div>
      <label class="f">TO → SOC 1<select data-to="${i}">${NS2_TOS.map(s => `<option value="${esc(s)}"${s === c.to ? " selected" : ""}>${SN(s)}</option>`).join("")}</select></label><div class="eff">${effTxt(c)}</div></div>`).join(""); }
const MIX0 = () => MIX;
function drawBoard() { const B = board(), ex = ns2Extra(B, MIX), live = B.filter(c => c.g.length), dest = new Set(live.map(c => c.to)), om = ordMonth(), nw = REF.reg[R].cots.length;
  $("impact").innerHTML = `<span><b>${live.length}</b> chute</span><span><b>${dest.size}</b> SOC đích → ít nhất <b>${dest.size * nw}</b> chuyến/ngày (mỗi SOC ≥ 1 xe mỗi lượt)</span><span>Rã bao thêm so với FLM: <b style="color:${ex.sh > 0 ? "var(--s2)" : "var(--good)"}">${nf(ex.sh * 100, 1)}%</b> đơn${om ? ` ≈ Est. ${nf(tr(ex.sh * rsCostOf(B, MIX) * om), 1)} tr/tháng công sort lại` : ""}</span>${NS2_CODES.some(g => !B.some(c => c.g.includes(g))) ? `<span class="soc" style="color:var(--warn)">Còn mã chưa xếp chute</span>` : ""}`;
  $("board").innerHTML = boardHTML(B, ex.set, SEL); check(); }
const edit = f => { HIST.push(JSON.stringify(board())); f(board()); drawBoard(); };
const setBoard = B => { if ($("f-cusame").checked || !CU) BRD[0] = B; else BRD[CU] = B; };
const move = (g, ci) => edit(B => { B.forEach(c => { c.g = c.g.filter(x => x !== g); }); if (ci >= 0 && B[ci]) B[ci].g.push(g); });
document.querySelector("#s5 .qa").addEventListener("click", e => { const b = e.target.closest("[data-qa]"); if (!b) return; const k = b.dataset.qa; if (k === "add") edit(B => B.push({ to: "BD A Mega SOC", g: [] })); else { HIST.push(JSON.stringify(board())); setBoard(ns2Preset(k, R)); SEL = null; drawBoard(); } });
$("undo").addEventListener("click", () => { const h = HIST.pop(); if (h) { setBoard(JSON.parse(h)); drawBoard(); } });
function wireBoard(el, get, mv, ed, redraw, selRef) {
  el.addEventListener("click", e => { const d = e.target.closest("[data-del]"); if (d) { const i = +d.dataset.del; ed(B => { const c = B.splice(i, 1)[0]; }); return; }
    const c = e.target.closest("[data-g]"); if (c) { selRef(selRef() === c.dataset.g ? null : c.dataset.g); redraw(); return; }
    const ch = e.target.closest("[data-c]"); if (ch && selRef() && !e.target.closest("select,label")) { const g = selRef(); selRef(null); mv(g, +ch.dataset.c); } });
  el.addEventListener("keydown", e => { const c = e.target.closest("[data-g]"); if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selRef(selRef() === c.dataset.g ? null : c.dataset.g); redraw(); } });
  el.addEventListener("change", e => { const s = e.target.dataset.to; if (s != null) { e.stopPropagation(); ed(B => { B[+s].to = e.target.value; delete B[+s].via; }); } });
  el.addEventListener("dragstart", e => { const c = e.target.closest("[data-g]"); if (c) e.dataTransfer.setData("text/plain", c.dataset.g); });
  el.addEventListener("dragover", e => { const c = e.target.closest("[data-c]"); if (c) { e.preventDefault(); c.classList.add("ov"); } });
  el.addEventListener("dragleave", e => { const c = e.target.closest("[data-c]"); if (c && !c.contains(e.relatedTarget)) c.classList.remove("ov"); });
  el.addEventListener("drop", e => { const c = e.target.closest("[data-c]"); if (!c) return; e.preventDefault(); const g = e.dataTransfer.getData("text/plain"); if (g) mv(g, +c.dataset.c); }); }
wireBoard($("board"), board, move, edit, drawBoard, v => v === undefined ? SEL : (SEL = v));
$("f-cusame").addEventListener("change", () => { const same = $("f-cusame").checked; document.querySelectorAll("#cu-dt [data-cu]").forEach(b => { if (b.dataset.cu !== "0") b.disabled = same; }); if (same) { CU = 0; document.querySelectorAll("#cu-dt [data-cu]").forEach(b => b.setAttribute("aria-pressed", b.dataset.cu === "0")); } drawBoard(); });
document.querySelectorAll("#cu-dt [data-cu]").forEach(b => b.addEventListener("click", () => { CU = +b.dataset.cu; SEL = null; document.querySelectorAll("#cu-dt [data-cu]").forEach(x => x.setAttribute("aria-pressed", x === b)); drawBoard(); }));

/* bắt buộc → nút xanh; mỗi mục có dòng tóm tắt + đếm số ô khác mặc định */
const REQ = [["f-name", "Tên seller"], ["f-ll", "Toạ độ"], ["f-a0", "ADO BAU"], ["f-a1", "ADO Mini CP"], ["f-a2", "ADO CP"]];
const wavesNow = () => REF.reg[R].cots.map((c, k) => { const q = s => document.querySelector(`[data-w="${s}${k}"]`); return { p: c.p, a: tmin(q("a").value), b: tmin(q("b").value), s: +String(q("s").value).replace(",", ".") || 0 }; });
const SUM = {
  s1: () => [V("f-name") || "(chưa có tên)", R, $("f-hub").value || "(chưa có hub)"].join(" · "),
  s2: () => `ADO ${["f-a0", "f-a1", "f-a2"].map(i => V(i) ? nf(numv(i) || 0) : "?").join(" / ")} · ${V("f-d0")}/${V("f-d1")}/${V("f-d2")} ngày · ${V("f-bk")}% hàng to`,
  s3: () => `Bắt đầu ${V("f-open")} · ` + wavesNow().map(w => `${cotL(w.p)} ${nf(w.s)}%`).join(" · ") + ` · ${$("f-hop").selectedOptions[0].text.toLowerCase()} · ${V("f-gates")} cổng · trễ ${V("f-late")}′`,
  s4: () => ({ sim: "Theo seller giống", avg: "Trung bình D2S HCM", man: "Nhập tay" })[MIXSRC] + " · " + NS2_CODES.slice().sort((a, b) => (MIX[b] || 0) - (MIX[a] || 0)).slice(0, 4).map(g => `${g} ${nf(MIX[g] || 0)}%`).join(" · ") + " …",
  s5: () => { const L = BRD[0].filter(c => c.g.length); return `${L.length} chute → ${[...new Set(L.map(c => SN(c.to)))].join(" · ")} · rã bao thêm ${nf(ns2Extra(BRD[0], MIX).sh * 100)}% đơn` + ($("f-cusame").checked ? " · mọi loại ngày" : " · riêng theo loại ngày"); },
  s6: () => `${$("f-like").value ? shortN($("f-like").value) : "Seller giống tự động"} · 1T9 ${VP("f-cap1T9")} đơn/xe · xe đứng ${VP("f-dwfix")}′ + ${VP("f-dwrate")}′/100 đơn`,
  s7: () => `${$("f-lab").selectedOptions[0].text.split(" · ")[0]} · tối đa ${V("f-oscap") || "không giới hạn"} · sort ${VP("f-pbase")} đơn/người/ngày · ${VP("f-pfteh")} giờ sort/công`,
  s8: () => `Trễ tối đa ${V("f-latetol")}′ · cấm 5T/8T: ${$("f-ban").value === "auto" ? "theo điểm gần" : "không áp"}` + (REF.reg[R].banNew ? ` · luật cấm tải mới: ${$("f-bnon").checked ? "bật" : "tắt"}` : ""),
  s9: () => { const site = ["f-area", "f-dens", "f-dock", "f-gmax", "f-hodev", "f-areacp", "f-shelter"].filter(i => V(i)).length + ["f-camhas", "f-camself", "f-camzone"].filter(i => $(i).value).length; return `Xe tới ${$("f-maxk").value} · ${V("f-bays")} chỗ chất · ${site ? site + " thông số site đã nhập" : "chưa đi site · dùng mặc định"}`; }
};
const changed = el => { let n = 0; const seen = new Set(); el.querySelectorAll("input,select").forEach(e => { if (REQ.some(([id]) => id === e.id) || e.closest("#board") || e.id === "f-ll" || e.id === "f-hub" || e.id === "f-sup") return;
    if (e.type === "radio") { if (seen.has(e.name)) return; seen.add(e.name); const c = el.querySelector(`[name="${e.name}"]:checked`); if (c && !c.defaultChecked) n++; return; }
    if (e.type === "checkbox") { if (e.checked !== e.defaultChecked) n++; return; }
    if (e.tagName === "SELECT") { const o = [...e.options], d = Math.max(0, o.findIndex(x => x.defaultSelected)); if (e.selectedIndex !== d) n++; return; }
    if (e.value !== e.defaultValue) n++; }); if (el.id === "s5" && JSON.stringify(BRD[0]) !== JSON.stringify(ns2Preset(R === "HCM" ? "3" : "1", R))) n++; return n; };
function whenSync() { document.querySelectorAll("#v-form [data-when]").forEach(el => { const w = el.dataset.when; let ok;
  if (w.includes("=")) { const [id, v] = w.split("="); ok = $(id).value === v; } else if (w.includes(">")) { const [id, v] = w.split(">"); ok = +$(id).value > +v; } else ok = $(w).checked; el.hidden = !ok; }); }
function check() { const miss = REQ.filter(([id]) => !V(id)).map(([, l]) => l), llBad = V("f-ll") && !parseLL(V("f-ll")), adoBad = ["f-a0", "f-a1", "f-a2"].every(i => !(numv(i) > 0));
  $("go").disabled = miss.length > 0 || llBad || adoBad;
  $("gomsg").innerHTML = miss.length ? `Còn thiếu: <b>${miss.join(", ")}</b>` : llBad ? `<b class="err">Toạ độ chưa đúng dạng “lat, long”</b>` : adoBad ? `<b class="err">Cần ít nhất một loại ngày có đơn</b>` : `<b style="color:var(--good)">Đủ thông tin</b> · sẵn sàng tính`;
  REQ.forEach(([id]) => $(id).classList.toggle("miss", !V(id)));
  $("s1").classList.toggle("done", !!(V("f-name") && parseLL(V("f-ll")))); $("s2").classList.toggle("done", ["f-a0", "f-a1", "f-a2"].every(V));
  Object.entries(SUM).forEach(([s, f]) => { const el = $(s); el.querySelector(".s").textContent = f(); const n = changed(el), c = el.querySelector(".ch"); c.textContent = n ? `đã chỉnh ${n}` : ""; c.hidden = !n; });
  whenSync(); }
document.querySelectorAll("#v-form input,#v-form select").forEach(e => { if (e.closest("#board")) return; e.addEventListener("input", check); e.addEventListener("change", check); });
["f-a0", "f-a1", "f-a2", "f-d0", "f-d1", "f-d2"].forEach(id => $(id).addEventListener("input", drawBoard));
$("f-waves").addEventListener("input", check);
document.querySelectorAll("[data-reg]").forEach(b => { b.disabled = !REF.reg[b.dataset.reg]; b.addEventListener("click", () => { if (b.disabled || b.dataset.reg === R) return; R = b.dataset.reg; document.querySelectorAll("[data-reg]").forEach(x => x.setAttribute("aria-pressed", x === b)); fillRegion(); hubSuggest(); drawBoard(); }); });
/* điền nhanh theo ví dụ: mẫu + các seller đang chạy (hồ sơ thật của kỳ) */
(() => { const L = Object.values(XT.run).flat().filter(r => r.a3[0] > 0).sort((a, b) => b.ordReal - a.ordReal).slice(0, 8);
  $("f-ex").innerHTML = opt("", "Tự nhập seller mới") + opt("abc", "Mẫu: Kho ABC Tân Phú (HCM)") + L.map(r => opt(r.n, `${shortN(r.n)} (${r.R}, đang chạy)`)).join(""); })();
$("f-ex").addEventListener("change", () => { const v = $("f-ex").value; if (!v) return; const r = Object.values(XT.run).flat().find(z => z.n === v), R2 = r ? r.R : "HCM";
  if (R2 !== R) document.querySelector(`[data-reg="${R2}"]`).click();
  $("f-name").value = r ? shortN(r.n) + " (thử như seller mới)" : "Kho ABC Tân Phú"; $("f-ll").value = r ? r.ll.join(", ") : "10.79, 106.63";
  const a = r ? r.a3 : [4000, 6400, 10000]; ["f-a0", "f-a1", "f-a2"].forEach((id, i) => { $(id).value = a[i]; }); $("f-bk").value = r ? Math.round((r.b || 0) * 100) : 35;
  HUBMAN = false; hubSuggest(); if (r && r.hub && [...$("f-hub").options].some(o => o.value === r.hub)) { $("f-hub").value = r.hub; HUBMAN = true; if (r.sup) $("f-sup").value = r.sup; }
  capPh(); mixDefault(); drawBoard(); });
/* HỒ SƠ từ form → đầu vào engine (qua ns2X: SOC đích, chute theo SOC, phần rã bao thêm) */
const camV = (id, m) => m[$(id).value] || "";
function profOfForm() { const w = wavesNow(), mix = Object.assign({}, MIX), boards = boardsAll();
  return { R, ll: parseLL(V("f-ll")), hub: $("f-hub").value, sup: $("f-sup").value, ado: [0, 1, 2].map(i => Math.max(0, numv("f-a" + i) || 0)), days: [0, 1, 2].map(i => Math.max(0, numv("f-d" + i) ?? 0)),
    beta: Math.min(100, Math.max(0, numv("f-bk") ?? 35)) / 100, betaT: ["f-bk0", "f-bk1", "f-bk2"].map(id => { const v = numv(id); return v == null ? "" : Math.min(100, Math.max(0, v)) / 100; }),
    open: tmin(V("f-open")) ?? REF.P.open, win: w.map(z => [z.a, z.b]), sh: w.map(z => Math.max(0, z.s) / 100), mix, boards, like: $("f-like").value || null,
    capK: Object.fromEntries(NS_KS.map(k => [k, numv("f-cap" + k)]).filter(e => e[1] > 0)), dwFix: numv("f-dwfix") ?? "", dwRate: numv("f-dwrate") ?? "", lab: $("f-lab").value, osCap: numv("f-oscap") ?? "",
    prod: { base: numv("f-pbase") ?? "", hand: numv("f-phand") ?? "", chute: numv("f-pchute") ?? "", bulky: numv("f-pbulky") ?? "", fteH: numv("f-pfteh") ?? "" },
    hoProf: $("f-hop").value, tail: numv("f-tail") || 0, hoN: numv("f-hon") || 3, late: numv("f-late") || 0, hoRate: numv("f-horate") ?? "", gates: numv("f-gates") || 1, gMode: $("f-gmode").value, gMove: numv("f-gmove") ?? "",
    lateTol: numv("f-latetol") ?? 12, slackMin: numv("f-slack") || 0, delay: numv("f-delay") || 0, ban: $("f-ban").value,
    banNew: { on: REF.reg[R].banNew ? $("f-bnon").checked : false, hv: [...document.querySelectorAll("[data-ban]:checked")].map(e => e.dataset.ban), ban: [tmin(V("f-bna")), tmin(V("f-bnb"))], from: V("f-bnfrom") },
    maxK: $("f-maxk").value, bays: numv("f-bays") || 4, area: numv("f-area") ?? "", dens: numv("f-dens") ?? "", dockSwap: numv("f-dock") ?? "", gateFix: $("f-gfix").checked, gateMax: numv("f-gmax") ?? "", hoDev: numv("f-hodev") ?? "", areaCP: numv("f-areacp") ?? "", shelter: numv("f-shelter") ?? "",
    cam: { has: camV("f-camhas", { "Có": "y", "Không": "n" }), self: camV("f-camself", { "Được": "y", "Không": "n" }), zone: camV("f-camzone", { "Ngoài kho (như MCL)": "out", "Trong kho (như Tiki)": "in" }) },
    pick: [], groups: [], rsCost: rsCostOf(boards[0], mix), name: V("f-name") }; }

/* ===== TÍNH: engine thật cho cài đặt đang nhập + các cách chia chute khác, rồi các biến thể (người, sự cố, đòn bẩy, ngưỡng ADO) ===== */
const NSX = p => ns2X(Object.assign({}, p, { rsCost: rsCostOf(p.boards[0], p.mix) }), XT.socLL);
const plan = (p, ex) => nsPlan(REF, Object.assign(NSX(p), ex || {}));
const tick = () => new Promise(r => setTimeout(r, 0));
const sameB = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CANDS = R => R === "HCM" ? [["1", "1 chute → BD A"], ["2", "2 chute: BD A · HCM Mega"], ["3", "3 chute: BD A · HCM Mega · BD B"], ["flm", "Như FLM HCM (mỗi nhóm một chute)"]] : [["1", "1 chute → BD A"], ["3", "3 chute: BD A · HCM Mega · BD B"], ["flm", "Như FLM SE (mỗi nhóm một chute)"]];
const bLabel = B => { const L = B.filter(c => c.g.length); return `${L.length} chute → ${[...new Set(L.map(c => SN(c.to)))].join(" · ")}`; };
const feas = p => p.ok.cot && p.ok.people;
const actT = r => { const t = r.days.findIndex(d => d.X > 0 && d.n > 0); return t < 0 ? 0 : t; };
let RES = null, PL = "best", TDT = 0, PDT = 0;
async function compute() {
  const P0 = profOfForm(), st = t => { $("busy-t").textContent = t; };
  st("Đang tính cài đặt đang nhập…"); await tick(); const inp = plan(P0);
  st("Đang thử các cách chia chute khác…"); await tick();
  const C = [{ k: "in", l: "Đang nhập · " + bLabel(P0.boards[0]), B: P0.boards, lite: plan(P0, { lite: true }) }];
  for (const [k, l] of CANDS(P0.R)) { const B = [0, 1, 2].map(() => ns2Preset(k, P0.R)); if (sameB(B, P0.boards)) { C[0].l = "Đang nhập · " + l; continue; } C.push({ k, l, B, lite: plan(Object.assign({}, P0, { boards: B }), { lite: true }) }); }
  const okC = C.filter(c => feas(c.lite)), pick = (okC.length ? okC : C).reduce((a, c) => c.lite.month.net > a.lite.month.net + 1e5 ? c : a, (okC.length ? okC : C)[0]);
  const isBest = pick === C[0], PB = isBest ? P0 : Object.assign({}, P0, { boards: pick.B });
  st("Đang tính kỹ cách đề xuất (ghép xe, hoà vốn)…"); await tick(); const best = isBest ? inp : plan(PB);
  st("Đang thử thiếu / thêm 1 người…"); await tick();
  const adj = (p, r) => r.lab === "pps" ? [null, null] : [-1, 1].map(d => plan(p, { lite: true, hcIn: r.days.map(z => z.X > 0 ? Math.max(1, z.hc + d) : "") }));
  const A = { best: adj(PB, best), in: isBest ? null : adj(P0, inp) }; if (!A.in) A.in = A.best;
  st("Đang thử sự cố…"); await tick();
  const hcB = best.days.map(z => z.X > 0 ? z.hc : ""), G = REF.reg[PB.R], pr = PB.prod || {};
  const STD = [["late", "Seller giao trễ 20′ mọi lượt", { late: (+PB.late || 0) + 20 }], ["k", "ADO cao hơn 20%", { ado: PB.ado.map(v => Math.round(v * 1.2)) }], ["tail", "Seller dồn 30% đơn vào 60′ cuối khung", { hoProf: "end", tail: 30 }],
    ["rk", "Năng suất thấp hơn 15% (tuần đầu)", { prod: Object.assign({}, pr, { base: (+pr.base || REF.P.prodBase) * 0.85, hand: (+pr.hand || REF.P.prodHand) * 0.85 }) }]];
  if (G.banNew && !(PB.banNew && PB.banNew.on)) STD.push(["ban", `Luật cấm tải mới bật (${(PB.banNew.hv || G.banNew.hv).join(", ")} cấm ${hm(PB.banNew.ban[0] ?? G.banNew.ban[0])}–${hm(PB.banNew.ban[1] ?? G.banNew.ban[1])})`, { banNew: Object.assign({}, PB.banNew, { on: true }) }]);
  const ST = STD.map(([id, l, ex]) => { const same = best.lab === "pps" ? plan(PB, Object.assign({ lite: true }, ex)) : plan(PB, Object.assign({ lite: true, hcIn: hcB }, ex)), re = plan(PB, Object.assign({ lite: true }, ex));
    return { id, l, per: best.days.map((d, t) => { const s = same.days[t], w = s.W && s.W.length ? s.W.reduce((a, z) => (z.slack ?? 1e9) < (a.slack ?? 1e9) ? z : a, s.W[0]) : null;
      return { X: s.X, worst: s.worst, roll: s.roll, wc: w ? cotL(w.c.p) : "", need: re.days[t].hc, base: d.hc, trucks: re.days[t].trucks, bt: d.trucks }; }), dEst: re.month.net - best.month.net, re }; });
  st("Đang thử đòn bẩy người và ghép xe…"); await tick();
  const bl = pick.lite, LV = [], NO = [];
  if (!isBest) LV.push({ k: "board", t: `Đổi cài đặt sort: ${bLabel(P0.boards[0])} → ${bLabel(PB.boards[0])}`, v: bl.month.net - C[0].lite.month.net, m: `Rã bao thêm ở SOC ${nf(NSX(PB).rsOv[0] * 100)}% đơn (đang nhập ${nf(NSX(P0).rsOv[0] * 100)}%); COT vẫn kịp.` });
  C.filter(c => c !== pick && c !== C[0]).forEach(c => NO.push(`${c.l}: Est. ${fs(tr(c.lite.month.net))} tr, kém đề xuất ${nf(tr(bl.month.net - c.lite.month.net), 1)} tr${feas(c.lite) ? "" : " (không kịp COT / thiếu người)"}.`));
  if (!isBest && C[0].lite.month.net < bl.month.net) NO.unshift(`${C[0].l}: Est. ${fs(tr(C[0].lite.month.net))} tr (đang nhập).`);
  if (PB.lab !== "hub") { const q = plan(PB, { lite: true, lab: "hub" }), pool = q.days.map(d => d.pool).find(z => z && z.ok);
    if (pool) { const d = q.month.net - bl.month.net; (d > 1e5 ? LV : NO).push(d > 1e5 ? { k: "hub", t: `Dùng chung người với ${pool.pts.length} điểm cùng FM Hub`, v: d, m: `${pool.pts.map(shortN).join(", ")} · Hub chỉ cần thêm ${pool.add} người ngày đông thay vì ${q.days.find(z => z.pool && z.pool.ok).hc} người riêng.` } : `Dùng chung người với điểm cùng hub: không rẻ hơn (${fs(tr(d))} tr).`); } }
  if (PB.lab !== "pps") { const q = plan(PB, { lite: true, lab: "pps" }), d = q.month.net - bl.month.net; if (d > 1e5) LV.push({ k: "pps", t: "Rider PPS thay FTE", v: d, m: `Tiền người ${nf(tr(q.month.lab), 1)} tr thay vì ${nf(tr(bl.month.lab), 1)} tr.` }); else NO.push(`Rider PPS thay FTE: tiền người ${nf(tr(q.month.lab), 1)} tr thay vì ${nf(tr(bl.month.lab), 1)} tr (kém ${nf(tr(-d), 1)} tr).`); }
  const MG = (best.mrg && best.mrg.list) || [], mg = MG.filter(o => ["go", "check", "watch"].includes(o.st) && o.save > 0).sort((a, b) => b.save - a.save)[0];
  if (mg) LV.push({ k: "mrg", t: `Ghép xe với ${mg.mem.map(shortN).join(", ")}`, v: mg.save, m: `${nf(mg.km, 1)} km · ${mg.waves.length} lượt chung · dư COT ${fa(mg.slack, 0)}′${mg.st === "check" ? " · khác Sup/hub: cần OE duyệt" : mg.st === "watch" ? " · trễ trong mức cho phép (theo dõi)" : ""}.` });
  LV.sort((a, b) => b.v - a.v);
  st("Đang vẽ ngưỡng ADO…"); await tick();
  const t0 = PB.ado[0] > 0 ? 0 : PB.ado[1] > 0 ? 1 : 2, base = PB.ado[t0], rat = PB.ado.map(v => v / base), hi = Math.max(base * 2.5, 3000), stp = [50, 100, 200, 250, 500, 1000, 2000].find(s => hi / s <= 24) || 2500, CV = [];
  for (let a = stp; a <= hi + 1; a += stp) { const ado = rat.map(r => Math.round(a * r)), q1 = plan(PB, { lite: true, ado }), q2 = isBest ? null : plan(P0, { lite: true, ado }); CV.push({ a, best: q1.month.net, inp: q2 ? q2.month.net : null }); }
  RES = { P0, PB, inp, best, isBest, pick, C, A, ST, LV, NO, mg, MG, CV, t0, peers: peersOf(PB.ll, PB.ado[0], 3) };
  DONE = true; go("dash"); $("d-name").textContent = P0.name || "Seller mới"; $("d-sub").textContent = `${P0.R} · ${P0.hub || "chưa chọn hub"} · ADO ${P0.ado.map(v => nf(v)).join(" / ")} · ${nf(best.month.orders)} đơn/tháng`;
  drawDash(); }
$("go").addEventListener("click", async () => { go("busy"); try { await compute(); } catch (e) { console.error(e); $("busy-t").innerHTML = `<span class="err">Lỗi khi tính: ${esc(e.message)}</span>`; } });
$("edit").addEventListener("click", () => go("form"));

/* ===== DASHBOARD ===== */
const stCls = s => s == null ? "bad" : s < -(RES ? RES.best.lateTol : 12) ? "bad" : s < 15 ? "warn" : "good";
const minW = r => { let best = null; r.days.forEach((d, t) => { if (!(d.X > 0) || !(d.n > 0)) return; d.W.forEach(w => { if (!(w.Q > 0.5)) return; if (!best || (w.slack ?? -1e9) < best.s) best = { s: w.slack ?? -1e9, t, c: cotL(w.c.p) }; }); }); return best || { s: 0, t: 0, c: "" }; };
const cur = () => PL === "best" ? RES.best : RES.inp;
const fillAvg = d => { let n = 0, c = 0; d.W.forEach(w => (w.trk || []).forEach(z => { if (z.fill > 0) { n += z.q; c += z.q / z.fill; } })); return c ? Math.round(n / c * 100) : null; };
/* xe từng lượt kèm SOC đích (trk xếp theo thứ tự legs) */
const trucksOf = w => { const out = []; let j = 0; (w.legs || []).forEach(l => { for (let i = 0; i < l.t; i++) { const z = (w.trk || [])[j++]; if (z) out.push(Object.assign({ d: l.s[0] }, z)); } }); return out; };
const VTXT = { go: ["Nên chạy D2S", "good"], cond: ["Chạy được · cần theo dõi", "warn"], no: ["Chưa nên chạy D2S", "bad"] };
function drawDash() { $("plan-inp").textContent = RES.isBest ? "So sánh · " + (RES.C[1] ? RES.C.slice(1).sort((a, b) => b.lite.month.net - a.lite.month.net)[0].l : "—") : "Đang nhập · " + bLabel(RES.P0.boards[0]);
  $("plan-inp").hidden = RES.isBest; if (RES.isBest) RES.alt = RES.C.slice(1).sort((a, b) => b.lite.month.net - a.lite.month.net)[0];
  PL = "best"; document.querySelectorAll("#planseg [data-plan]").forEach(x => x.setAttribute("aria-pressed", x.dataset.plan === "best"));
  document.querySelector('#planseg [data-plan="best"]').textContent = "Đề xuất · " + bLabel(RES.PB.boards[0]);
  drawVerdict(); drawKpis(); drawTrk(); drawPpl(); drawCot(); drawLev(); drawBE(); drawShare(); drawPeer(); }
function drawVerdict() { const r = RES, bm = r.best.month, im = r.inp.month, mg = r.mg, v = VTXT[r.best.verdict] || VTXT.no, pill = $("d-pill"), lb = bLabel(r.PB.boards[0]), li = bLabel(r.P0.boards[0]);
  pill.className = "pill " + v[1]; pill.textContent = v[0] + (!r.isBest && r.best.verdict !== "no" ? " · đổi cài đặt sort" : "");
  const be = r.best.be && r.best.be.ado ? r.best.be.ado[r.t0] : null;
  $("v-h").innerHTML = bm.net < 0 ? `${v[0]}: kể cả cách tốt nhất (${lb}) vẫn lỗ Est. <span class="neg">${fs(tr(bm.net))} tr/tháng</span>` + (be ? `; hoà vốn khi ADO ${DTN[r.t0]} ≥ ~${nf(be)}.` : ".")
    : !r.isBest ? `${v[0]} — nhưng với <u>${lb}</u>, không phải ${li} đang nhập. Đang nhập: Est. <span class="${im.net >= 0 ? "pos" : "neg"}">${fs(tr(im.net))} tr/tháng</span>; đổi cài đặt: <span class="pos">${fs(tr(bm.net))} tr</span>.`
    : `${v[0]} với cài đặt đang nhập (${lb}): Est. <span class="pos">${fs(tr(bm.net))} tr/tháng</span>` + (mg ? `; ghép xe thêm thì ${fs(tr(bm.net + mg.save))} tr.` : ".");
  const S3 = []; if (!r.isBest) S3.push(["Đang nhập · " + li, im.net]); S3.push([(r.isBest ? "Đang nhập = đề xuất · " : "Đề xuất · ") + lb, bm.net]); if (mg) S3.push(["+ ghép xe với " + shortN(mg.mem[0]) + (mg.mem.length > 1 ? "…" : ""), bm.net + mg.save]); if (r.isBest && r.alt) S3.push(["Nếu chạy " + r.alt.l, r.alt.lite.month.net]);
  $("v-steps").innerHTML = S3.slice(0, 3).map(([l, x]) => `<div><span class="l">${esc(l)}</span><span class="v ${x >= 0 ? "pos" : "neg"}">${fs(tr(x))} tr</span><span class="l">Est. / tháng</span></div>`).join("");
  /* chuỗi suy luận */
  const t = actT(r.best), bd = r.best.days[t], id = r.inp.days[t], c19 = (r.best.cap.find(c => c.k === "1T9") || {}).q, L = [];
  const wmin = bd.W.filter(w => w.Q > 0.5).reduce((a, w) => !a || w.Q < a.Q ? w : a, null);
  if (wmin) L.push(`Ngày ${DTN[t]} ${nf(bd.X)} đơn chia ${bd.W.filter(w => w.Q > 0.5).length} lượt; lượt ít nhất (COT ${cotL(wmin.c.p)}) có <b>${nf(wmin.Q)}</b> đơn — 1 xe 1T9 chở ~<b>${nf(c19)}</b> đơn ở ${nf(r.PB.beta * 100)}% hàng to (học từ chuyến thật).`);
  const toN = B => new Set(B.filter(c => c.g.length).map(c => c.to)).size;
  if (!r.isBest) { L.push(`${li}: ${toN(r.P0.boards[0])} SOC đích → mỗi lượt ít nhất ${toN(r.P0.boards[0])} xe: ngày ${DTN[t]} <b>${id.trucks}</b> chuyến; ${lb}: <b>${bd.trucks}</b> chuyến.`);
    const legs = id.W.flatMap(w => (w.legs || []).map(l => ({ d: l.s[0], q: l.Q, c: l.c }))), mainS = r.inp.main, oth = legs.filter(l => l.d !== mainS), tq = legs.reduce((a, l) => a + l.q, 0), tc = legs.reduce((a, l) => a + l.c, 0);
    if (oth.length && tq && tc) { const fl = id.W.flatMap(w => trucksOf(w).filter(z => z.d !== mainS).map(z => Math.round(z.fill * 100))); L.push(`Các chuyến đi ${[...new Set(oth.map(l => SN(l.d)))].join(", ")} chở <b>${nf(oth.reduce((a, l) => a + l.q, 0) / tq * 100)}%</b> đơn nhưng tốn <b>${nf(oth.reduce((a, l) => a + l.c, 0) / tc * 100)}%</b> tiền xe ngày ${DTN[t]}${fl.length ? ` (đầy ${Math.min(...fl)}–${Math.max(...fl)}%)` : ""}.`); }
    const d = k => tr(bm[k] - im[k]); L.push(`Đổi sang ${lb}: rã bao ở SOC ${fs(d("soc"))} tr, tiền xe ${fs(d("truck"))} tr, tiền người ${fs(d("lab"))} tr mỗi tháng → Est. ${fs(tr(bm.net - im.net))} tr.`); }
  else if (r.alt) { const a = r.alt.lite.month, d = k => tr(bm[k] - a[k]); L.push(`So với ${r.alt.l}: Est. hơn <b>${nf(tr(bm.net - a.net), 1)}</b> tr/tháng (xe ${fs(-d("truck"))} tr, người ${fs(-d("lab"))} tr, rã bao ${fs(-d("soc"))} tr theo hướng có lợi cho đề xuất).`); }
  const rsN = NSX(r.PB).rsOv[t] * bd.X, mw = minW(r.best); const mainTo = r.best.main;
  L.push(`Điều kiện: ${SN(mainTo)} rã bao, sort lại thêm ~<b>${nf(Math.round(rsN / 10) * 10)}</b> đơn/ngày ${DTN[t]} (${nf(NSX(r.PB).rsOv[t] * 100)}%, giá ${nf(rsCostOf(r.PB.boards[0], r.PB.mix))} đ/đơn); dư COT thấp nhất <b>${nf(mw.s)}′</b> (${DTN[mw.t]}, lượt ${mw.c}).`);
  const ok = r.best.ok; if (!ok.people) L.push(`<span class="neg">Thiếu người so với số tối đa cấp được</span> ở ít nhất một loại ngày.`); if (ok.cam === "n") L.push(`Camera đối soát: seller không có, SPX không lắp được → chưa đủ điều kiện "nên chạy" thẳng.`); if (r.best.lossDays && r.best.lossDays.length) L.push(`Lỗ ở ngày ${r.best.lossDays.map(d => DTN[d.t]).join(", ")} (lời cả tháng nhờ ngày khác).`);
  $("v-ded").innerHTML = L.map(x => `<li><span>${x}</span></li>`).join("");
  $("stack-cap").textContent = `Triệu đồng/tháng · ${nf(bm.orders)} đơn/tháng (${r.P0.days.join(" / ")} ngày BAU / Mini CP / CP). Est. = FM pickup − D2S.`;
  const RW = [["FM pickup (hiện tại)", [[tr(bm.fm), "var(--fm)", "FM pickup"]], null, tr(bm.fm)]], seg = m => [[tr(m.truck), "var(--s1)", "Xe"], [tr(m.lab), "var(--s2)", "Người"], [tr(m.soc), "var(--s3)", "Rã bao, sort lại ở SOC"]];
  if (!r.isBest) RW.push(["D2S · đang nhập", seg(im), tr(im.net), tr(im.cost)]); RW.push([r.isBest ? "D2S · đang nhập (đề xuất)" : "D2S · đề xuất", seg(bm), tr(bm.net), tr(bm.cost)]);
  if (mg) RW.push(["+ ghép xe", seg(Object.assign({}, bm, { truck: bm.truck - mg.save })), tr(bm.net + mg.save), tr(bm.cost - mg.save)]); else if (r.isBest && r.alt) RW.push(["D2S · " + r.alt.l.replace(/ \(.*\)/, ""), seg(r.alt.lite.month), tr(r.alt.lite.month.net), tr(r.alt.lite.month.cost)]);
  const W = 600, Lw = 178, Rr = 118, bh = 24, gap = 20, T = 8, H = T + RW.length * (bh + gap), mx = Math.ceil(Math.max(...RW.map(x => x[3])) / 50) * 50 || 50, x = v => Lw + (W - Lw - Rr) * Math.max(0, v) / mx;
  let g = [0, mx / 2, mx].map(v => `<line class="gl" x1="${x(v)}" x2="${x(v)}" y1="${T - 4}" y2="${H - 14}"/><text x="${x(v)}" y="${H - 2}" text-anchor="middle">${nf(v)}</text>`).join("");
  RW.forEach(([lab, sg, est, tot], k) => { const y = T + k * (bh + gap); let x0 = x(0); g += `<text x="${Lw - 10}" y="${y + bh / 2 + 4}" text-anchor="end" style="fill:var(--ink)">${esc(lab.length > 28 ? lab.slice(0, 27) + "…" : lab)}</text>`;
    sg.forEach(([v2, f, l], j) => { const w = x(v2) - x(0) - (j < sg.length - 1 ? 2 : 0); g += hbar(x0, y, w, bh, f, `${esc(lab)} · ${l}: <b>${nf(v2, 1)} tr</b>`, j === sg.length - 1); x0 += x(v2) - x(0); });
    g += `<text class="vl" x="${x0 + 8}" y="${y + bh / 2 + 4}">${nf(tot, 1)}</text>` + (est != null ? `<text x="${x0 + 8 + nf(tot, 1).length * 7.5 + 8}" y="${y + bh / 2 + 4}" style="fill:${est >= 0 ? "var(--good)" : "var(--bad)"};font-weight:600">${fs(est)}</text>` : ""); });
  $("c-stack").innerHTML = S(W, H, g, "Chi phí mỗi tháng theo cách chạy"); }
function drawKpis() { const p = cur(), m = p.month, D = p.days, act = D.filter(d => d.X > 0 && d.n > 0), mw = minW(p), b0 = D[actT(p)];
  const K = [["Est. tiết kiệm / tháng", `${fs(tr(m.net))} <small>tr</small>`, `so với FM pickup ${nf(tr(m.fm), 1)} tr`, m.net >= 0 ? "pos" : "neg", true],
    ["Chi phí / đơn", `${nf(m.cost / m.orders)} <small>đ</small>`, `FM pickup ${nf(m.fm / m.orders)} đ · ${fs((m.cost / m.fm - 1) * 100, 0)}%`],
    ["Chuyến xe / ngày", D.map(d => d.X > 0 ? d.trucks : "–").join(" / "), "BAU / Mini CP / CP"],
    ["Độ đầy xe " + DTN[actT(p)], `${fillAvg(b0) ?? "–"} <small>%</small>`, D.map((d, t) => t !== actT(p) && d.X > 0 ? `${DTN[t]} ${fillAvg(d)}%` : "").filter(Boolean).join(" · ") || "sức chở học từ chuyến thật"],
    ["Người tại điểm", D.map(d => d.X > 0 ? (p.lab === "pps" ? "PPS" : d.hc) : "–").join(" / "), p.lab === "hub" ? "nhóm FM Hub" : p.lab === "pps" ? "rider PPS" : "FTE riêng · BAU / Mini CP / CP"],
    ["Dư COT thấp nhất", `${nf(mw.s)} <small>phút</small>`, `${DTN[mw.t]} · lượt ${mw.c}`, mw.s < 15 ? "wrn" : ""]];
  $("kpis").innerHTML = K.map(([l, v, s, c, h]) => `<div class="kpi${h ? " hero" : ""}"><span class="l">${l}</span><span class="v ${c || ""}">${v}</span><span class="d">${s}</span></div>`).join(""); }
function drawTrk() { const p = cur(), d = p.days[TDT]; if (!(d.X > 0)) { $("c-trk").innerHTML = `<p class="meta">Loại ngày này không có đơn.</p>`; $("t-ins").textContent = ""; $("t-note").textContent = ""; $("trk-lg").innerHTML = ""; return; }
  const capOf = k => (p.cap.find(c => c.k === k) || {}).q || 1000, all = d.W.flatMap(trucksOf), mxC = Math.max(...all.map(z => capOf(z.k)), 1), k = 170 / mxC, W = 1100, L = 74, rh = 70, T = 22, H = T + d.W.length * rh; let g = "";
  d.W.forEach((w, i) => { const y = T + i * rh, Z = trucksOf(w); let x0 = L; g += `<text x="${L - 12}" y="${y + 18}" text-anchor="end" style="fill:var(--ink);font-weight:600">${cotL(w.c.p)}</text><text x="${L - 12}" y="${y + 33}" text-anchor="end" style="font-size:10.5px">${nf(w.Q)} đơn</text>`;
    Z.forEach(z => { const bw = Math.max(42, capOf(z.k) * k), fw = bw * Math.min(1, z.fill), tt = `COT ${cotL(w.c.p)} · ${z.k} đi ${SN(z.d)}<br><b>${Math.round(z.fill * 100)}%</b> sức chở · ${nf(z.q)} đơn · rời ${hm(z.dep)}`;
      g += `<rect x="${x0}" y="${y}" width="${bw}" height="26" rx="4" fill="var(--soft)" stroke="var(--ink3)" stroke-width="1" data-tip="${tt}"/><rect x="${x0}" y="${y}" width="${fw}" height="26" rx="4" fill="${DC[z.d] || "var(--fm)"}" data-tip="${tt}"/><text class="vl" x="${x0 + 4}" y="${y - 5}">${Math.round(z.fill * 100)}%</text><text x="${x0 + 4}" y="${y + 40}">${z.k}</text>`; x0 += bw + 8; });
    g += `<text x="${W - 4}" y="${y + 18}" text-anchor="end" class="vl">${nf(w.cost / 1000)}k</text><text x="${W - 4}" y="${y + 33}" text-anchor="end" style="font-size:10.5px">${Z.length} xe</text>`; });
  $("c-trk").innerHTML = S(W, H, g, "Từng xe mỗi lượt và độ đầy");
  const dests = [...new Set(all.map(z => z.d))]; $("trk-lg").innerHTML = dests.map(s => `<span><i style="background:${DC[s] || "var(--fm)"}"></i>đi ${SN(s)}</span>`).join("") + `<span><i style="background:var(--soft);border:1px solid var(--ink3)"></i>chỗ trống</span>`;
  const fl = all.map(z => Math.round(z.fill * 100)), legs = d.W.flatMap(w => (w.legs || []).map(l => ({ d: l.s[0], q: l.Q, c: l.c }))), oth = legs.filter(l => l.d !== p.main), tq = legs.reduce((a, l) => a + l.q, 0) || 1, tc = legs.reduce((a, l) => a + l.c, 0) || 1;
  let t = `${d.trucks} chuyến ngày ${DTN[TDT]}, đầy ${Math.min(...fl)}–${Math.max(...fl)}%.`;
  if (oth.length) t += ` Chuyến đi ${[...new Set(oth.map(l => SN(l.d)))].join(", ")} chở ${nf(oth.reduce((a, l) => a + l.q, 0) / tq * 100)}% đơn nhưng tốn ${nf(oth.reduce((a, l) => a + l.c, 0) / tc * 100)}% tiền xe.`;
  const wm = d.W.filter(w => w.Q > 0.5).reduce((a, w) => !a || w.Q < a.Q ? w : a, null); if (wm) { const cp = trucksOf(wm).reduce((a, z) => a + capOf(z.k), 0), sp = Math.round(cp - wm.Q); if (sp > 100) t += ` Lượt ${cotL(wm.c.p)} còn trống ~${nf(sp)} đơn → chỗ để ghép xe với điểm nhỏ gần đó.`; }
  $("t-ins").textContent = t;
  const wb = d.W.filter(w => w.Q > 0.5).reduce((a, w) => !a || (trucksOf(w).reduce((s, z) => s + capOf(z.k), 0) - w.Q) < (trucksOf(a).reduce((s, z) => s + capOf(z.k), 0) - a.Q) ? w : a, null);
  if (wb) { const cp = trucksOf(wb).reduce((s, z) => s + capOf(z.k), 0), th = d.X * cp / wb.Q; $("t-note").textContent = `Bậc xe: lượt ${cotL(wb.c.p)} đang dùng ${Math.round(wb.Q / cp * 100)}% sức chở các xe của lượt; ADO ${DTN[TDT]} vượt ~${nf(Math.round(th / 50) * 50)} thì lượt này phải thêm hoặc đổi xe. Sức chở 1T9 ~${nf(capOf("1T9"))} đơn, 5T ~${nf(capOf("5T"))} đơn (học từ chuyến thật, theo % hàng to).`; } }
/* ca gợi ý: một ca nếu khung làm ≤ 8 giờ; hai ca chồng giờ đỉnh nếu dài hơn — chia người theo khối việc mỗi nửa ngày (engine chưa giới hạn giờ mỗi người) */
function shiftsOf(d, open) { const W = d.W.filter(w => (w.Qt || w.Q) > 0.5); if (!W.length || !(d.hc > 0)) return { st: open, en: open + 480, S: [] };
  const st = Math.min(open, ...W.map(w => w.a)), en = Math.max(...W.map(w => w.dep || w.done || w.b)) + 10, N = d.hc;
  if (en - st <= 495 || N <= 1) return { st, en, S: [{ s: st, e: Math.max(en, st + 480), n: N, over: en - st > 495 }] };
  const ld = (a, b) => W.reduce((s, w) => { const e = w.hoEnd ?? w.b, len = Math.max(1, e - w.a), o = Math.max(0, Math.min(b, e) - Math.max(a, w.a)); return s + (w.Qt || w.Q) * o / len; }, 0), A = ld(st, en - 480), B = ld(st + 480, en), O = ld(en - 480, st + 480), tt = A + B + O || 1;
  const nA = Math.max(1, Math.min(N - 1, Math.round(N * (A + O / 2) / tt))); return { st, en, S: [{ s: st, e: st + 480, n: nA }, { s: en - 480, e: en, n: N - nA }] }; }
function drawPpl() { const p = cur(), d = p.days[PDT], open = p.open ?? REF.P.open;
  if (!(d.X > 0)) { $("c-ppl").innerHTML = `<p class="meta">Loại ngày này không có đơn.</p>`; $("p-ins").textContent = ""; } else {
    const sh = shiftsOf(d, open), wpo = (d.work ? d.work.w : 0) * REF.P.fteH, h0 = Math.floor(sh.st / 60), h1 = Math.ceil(sh.en / 60), HR = [];
    for (let h = h0; h < h1; h++) { let a = 0; d.W.forEach(w => { const e = w.hoEnd ?? w.b, len = Math.max(1, e - w.a), o = Math.max(0, Math.min(h * 60 + 60, e) - Math.max(h * 60, w.a)); a += (w.Qt || w.Q) * o / len; });
      const pres = sh.S.reduce((s, z) => s + z.n * Math.max(0, Math.min(h * 60 + 60, z.e) - Math.max(h * 60, z.s)) / 60, 0); HR.push({ h, arr: a, need: a * wpo, pres }); }
    const W = 1100, L = 36, Rr = 10, T = 14, H1 = 170, y0 = T + H1, mxv = Math.ceil(Math.max(1, ...HR.map(h => Math.max(h.need, h.pres)))) + 1, slot = (W - L - Rr) / Math.max(1, HR.length), x = h => L + (h - h0) * slot, y = v => y0 - H1 * v / mxv;
    let g = ""; for (let v = 0; v <= mxv; v += mxv > 8 ? 2 : 1) g += `<line class="gl" x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    HR.forEach(h => { g += vbar(x(h.h) + 4, y0, slot - 8, y(h.need), "var(--s2)", `${hm(h.h * 60)}–${hm(h.h * 60 + 60)}<br>Hàng tới ${nf(h.arr)} đơn → cần <b>${nf(h.need, 1)}</b> người<br>Có mặt ${nf(h.pres, 1)} người`); });
    g += `<path d="${HR.map((h, i) => `${i ? "L" : "M"}${x(h.h)} ${y(h.pres)}H${x(h.h + 1)}`).join("")}" fill="none" stroke="var(--s1)" stroke-width="2"/>`;
    const gy = y0 + 30, xm = m => L + (m / 60 - h0) * slot; sh.S.forEach((z, i) => { const yy = gy + i * 24; g += `<rect x="${xm(z.s)}" y="${yy}" width="${Math.max(4, xm(Math.min(z.e, h1 * 60)) - xm(z.s))}" height="18" rx="4" fill="var(--s1-soft)" data-tip="Ca ${hm(z.s)}–${hm(z.e)} · ${z.n} người"/><text x="${xm(z.s) + 6}" y="${yy + 13}" style="fill:var(--ink);font-size:11px">${hm(z.s)}–${hm(z.e)} · ${z.n} người${z.over ? " · quá 8 giờ: cần 2 ca hoặc tăng ca" : ""}</text>`; });
    d.W.filter(w => w.Q > 0.5).forEach(w => { const xx = xm(w.dep); if (xx > L && xx < W) g += `<line x1="${xx}" x2="${xx}" y1="${T}" y2="${y0}" stroke="var(--ink3)" stroke-dasharray="3 3"/><text x="${xx > W - 140 ? xx - 3 : xx + 3}" y="${T + 8}" text-anchor="${xx > W - 140 ? "end" : "start"}" style="font-size:10px">xe ${cotL(w.c.p)} rời ${hm(w.dep)}</text>`; });
    const H = gy + sh.S.length * 24 + 18; for (let h = h0; h <= h1; h += 2) g += `<text x="${x(h)}" y="${H - 2}" text-anchor="${h === h0 ? "start" : x(h) > W - 30 ? "end" : "middle"}">${h >= 24 ? "24:00" : hm(h * 60)}</text>`; g += `<text x="${L}" y="${T - 4}" style="font-size:10.5px">người</text>`;
    $("c-ppl").innerHTML = S(W, H, g, "Người cần theo giờ so với người có mặt và các ca gợi ý");
    const gap = HR.filter(h => h.need > h.pres + 0.05), mw = d.W.reduce((a, w) => (w.slack ?? 1e9) < (a.slack ?? 1e9) ? w : a, d.W[0]), busy = d.hc > 0 && d.work ? Math.round(d.X * d.work.w / d.hc * 100) : null;
    $("p-ins").innerHTML = p.lab === "pps" ? `${DTN[PDT]}: rider PPS quét lúc giao, không cần người tại điểm; tiền người ${nf(tr(d.lab), 2)} tr/ngày.` : `${DTN[PDT]}: <b>${d.hc}</b> người${p.lab === "hub" && d.pool && d.pool.ok ? ` (nhóm FM Hub: thêm ${d.pool.add} người cho cả nhóm)` : ""}, bận <b>${busy ?? "–"}%</b> khối việc. ` + (gap.length ? `${hm(gap[0].h * 60)}–${hm(gap[gap.length - 1].h * 60 + 60)} hàng tới cần tới ${nf(Math.max(...gap.map(h => h.need)), 1)} người trong khi ca gợi ý có ${nf(Math.min(...gap.map(h => h.pres)), 1)} → hàng chờ dồn lại, xử lý sau. ` : "Hàng tới luôn dưới sức người có mặt. ") + `Dư COT thấp nhất <b>${nf(mw.slack)}′</b> (lượt ${cotL(mw.c.p)}).`; }
  /* thiếu / thêm 1 người */
  const A = PL === "best" ? RES.A.best : RES.A.in;
  const cell = (dd, N, t, kind) => { if (!dd || !(dd.X > 0)) return `<div class="cell">–</div>`; const lt = cur().lateTol, roll = dd.roll || 0, bad = roll > 0.5 || dd.worst < -lt, ms = dd.W.reduce((a, w) => (w.slack ?? 1e9) < (a.slack ?? 1e9) ? w : a, dd.W[0]);
    if (bad) return `<div class="cell"><span class="pill sm bad">${N} người · Không kịp</span>${roll > 0.5 ? `~${nf(roll)} đơn dồn sang lượt sau / hôm sau` : `trễ ${nf(-dd.worst)}′ lượt ${cotL(ms.c.p)}`}</div>`;
    const ot = dd.work && N > 0 ? dd.X * dd.work.w * REF.P.fteH / N - REF.P.fteH : 0;
    if (ot > 0.25) return `<div class="cell"><span class="pill sm warn">${N} người · Phải tăng ca</span>kịp COT nếu mỗi người làm thêm ~${nf(ot, 1)} giờ (khối việc ${nf(dd.X * dd.work.w, 1)} người-ngày)</div>`;
    const c = stCls(dd.worst), lb = c === "good" ? "Chạy được" : "Sát"; return `<div class="cell"><span class="pill sm ${c}">${N} người · ${lb}</span>${dd.worst < 0 ? `Trễ ${nf(-dd.worst)}′ lượt ${cotL(ms.c.p)} (theo dõi)` : `Dư thấp nhất ${nf(dd.worst)}′ (lượt ${cotL(ms.c.p)})`}${kind === "hi" ? ` · +${nf(SHIFT * (RES.P0.days[t] || 0) / 1e6, 2)} tr/tháng` : ""}</div>`; };
  $("t-n").querySelector("tbody").innerHTML = p.lab === "pps" ? `<tr><td colspan="4" class="meta">Rider PPS: không có người tại điểm.</td></tr>` : DTN.map((k, t) => { const d0 = p.days[t]; if (!(d0.X > 0)) return `<tr><td><b>${k}</b></td><td colspan="3" class="meta">Không có đơn</td></tr>`;
    return `<tr><td><b>${k}</b><span class="sub">${RES.P0.days[t]} ngày/tháng</span></td><td>${d0.hc <= 1 ? `<div class="cell"><span class="pill sm warn">1 người</span>không bớt được nữa</div>` : cell(A[0] && A[0].days[t], d0.hc - 1, t, "lo")}</td><td>${cell(d0, d0.hc, t, "n")}</td><td>${cell(A[1] && A[1].days[t], d0.hc + 1, t, "hi")}</td></tr>`; }).join("");
  const L1 = []; if (p.lab !== "pps") { DTN.forEach((k, t) => { const d0 = p.days[t], hi = A[1] && A[1].days[t], lo = A[0] && A[0].days[t]; if (!(d0.X > 0)) return;
      if (d0.worst < 15 && hi && hi.worst >= 15 && !(hi.roll > 0.5)) L1.push(`Ngày ${k}: xếp ${d0.hc + 1} người (+${nf(SHIFT * (RES.P0.days[t] || 0) / 1e6, 2)} tr/tháng) để dư COT từ ${nf(d0.worst)}′ lên ${nf(hi.worst)}′.`);
      if (d0.hc > 1 && lo && (lo.roll > 0.5 || lo.worst < -p.lateTol)) L1.push(`Ngày ${k}: thiếu 1 người là không kịp${lo.roll > 0.5 ? ` (~${nf(lo.roll)} đơn dồn)` : ""} → luôn có 1 người dự phòng gọi được trong 30′${RES.P0.hub ? ` (${RES.P0.hub})` : ""}.`); });
    const hub = RES.LV.find(l => l.k === "hub"); if (hub) L1.push(`${hub.t}: Est. ${fs(tr(hub.v))} tr/tháng. ${hub.m}`);
    const pps = RES.NO.find(s => s.startsWith("Rider PPS")); if (pps) L1.push(pps); }
  L1.push(`Số người theo giả định năng suất của Seller Planner (sort ${nf(REF.P.prodBase)} đơn/người/ngày khi 1 chute, trừ theo số chute và % hàng to) — chưa có chấm công thật; đo 2 tuần đầu để chốt.`);
  $("p-do").innerHTML = `<span class="k">Nên làm</span>` + L1.map(x => `<p>${x}</p>`).join(""); }
const lc = s => /^[A-ZĐ][a-zà-ỹ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const PREV = { late: "Chốt với seller giờ chốt nhận mỗi lượt sớm hơn 20′, hoặc giữ thêm người cuối ca ngày đông.", k: "Khi ADO thật vượt mức nhập vài ngày liền: xếp lại người và đặt lại xe theo số cột “cần”.", tail: "Thống nhất seller nhả hàng đều trong khung (theo đợt mỗi 1–2 giờ), không dồn cuối.", rk: "Hai tuần đầu thêm người từ FM Hub cho tới khi năng suất ổn định.", ban: "Nếu luật áp dụng: chuẩn bị xe nhỏ (VAN) cho các lượt trong giờ cấm hoặc dời giờ bàn giao." };
function drawCot() { const p = cur(), D = p.days, lt = p.lateTol;
  $("t-cot").innerHTML = `<thead><tr><th>Lượt</th>${DTN.map(k => `<th style="text-align:center">${k}</th>`).join("")}</tr></thead><tbody>${p.cots.map((c, i) => `<tr><td><b>${cotL(c.p)}</b></td>${D.map((d, t) => { const w = d.W && d.W[i]; if (!(d.X > 0) || !w || !(w.Q > 0.5)) return `<td class="c" style="color:var(--ink3)">–</td>`;
      const rl = (w.roll || 0) > 0.5; return `<td class="c h-${rl ? "bad" : stCls(w.slack)}" data-tip="${DTN[t]} · lượt ${cotL(c.p)}: xe rời ${hm(w.dep)}, hạn ${cotL(c.p)}${rl ? `<br>${nf(w.roll)} đơn dồn sang lượt sau` : ""}">${rl ? "dồn" : nf(w.slack) + "′"}</td>`; }).join("")}</tr>`).join("")}</tbody>`;
  $("t-str").querySelector("tbody").innerHTML = RES.ST.map(s => `<tr><td class="w" style="color:var(--ink)"><b>${esc(s.l)}</b></td>${s.per.map((q, t) => { if (!(q.X > 0)) return `<td class="meta">–</td>`;
      const nd = q.need > q.base ? ` · cần ${q.need} người` : "", tk = s.id === "ban" && q.trucks !== q.bt ? ` · ${q.bt}→${q.trucks} chuyến` : "";
      if (q.roll > 0.5) return `<td><div class="cell"><span class="pill sm bad">dồn ${nf(q.roll)} đơn</span>lượt ${q.wc}${nd}${tk}</div></td>`;
      const c = stCls(q.worst); return `<td><div class="cell"><span class="pill sm ${c}">${q.worst < 0 ? "trễ " + nf(-q.worst) : "dư " + nf(q.worst)}′</span>lượt ${q.wc}${nd}${tk}</div></td>`; }).join("")}<td class="n ${s.dEst > 1e5 ? "pos" : s.dEst < -1e5 ? "neg" : ""}">${fs(tr(s.dEst))}</td></tr>`).join("");
  const mw = minW(p), worst = RES.ST.reduce((a, s) => s.dEst < a.dEst ? s : a, RES.ST[0]), rol = RES.ST.filter(s => s.per.some(q => q.roll > 0.5 || q.worst < -lt));
  $("c-ins").innerHTML = `Lượt yếu nhất: ${DTN[mw.t]} lượt ${mw.c}, dư <b>${nf(mw.s)}′</b>. ` + (worst && worst.dEst < -1e5 ? `Sự cố tốn nhất: ${esc(lc(worst.l))} (Est. <b>${fs(tr(worst.dEst))}</b> tr/tháng). ` : "") + (rol.length ? `Sự cố làm trễ / dồn đơn khi giữ số người: ${rol.map(s => esc(lc(s.l))).join("; ")}.` : "Giữ số người đề xuất vẫn kịp COT ở mọi sự cố đã thử.");
  const P = RES.ST.filter(s => s.per.some(q => q.X > 0 && (q.roll > 0.5 || q.worst < 15 || q.need > q.base)) || s.dEst < -1e6);
  $("c-do").innerHTML = `<span class="k">Phòng ngừa</span>` + (P.length ? P.map(s => `<p><b style="font-family:var(--f-ui)">${esc(s.l)}:</b> ${PREV[s.id]}${s.id === "k" ? ` Cần ${s.per.map((q, t) => q.X > 0 ? `${DTN[t]} ${q.need}` : "").filter(Boolean).join(", ")} người.` : ""}</p>`).join("") : `<p>Kế hoạch chịu được các sự cố đã thử.</p>`); }
function drawLev() { const r = RES, Ls = r.LV, mx = Math.max(1, ...Ls.map(l => Math.abs(l.v)));
  $("lev").innerHTML = Ls.length ? Ls.map(l => `<div class="r"><span class="t">${esc(l.t)}</span><span class="v ${l.v >= 0 ? "pos" : "neg"}">${fs(tr(l.v))} tr</span><span class="m">${esc(l.m)}</span><span class="bar" style="width:${Math.max(2, Math.abs(l.v) / mx * 100)}%;background:${l.v >= 0 ? "var(--s1)" : "var(--s2)"}" data-tip="${esc(l.t)}: <b>${fs(tr(l.v))} tr/tháng</b>"></span></div>`).join("") : `<p class="meta">Chưa thấy cách nào rẻ hơn trong các đòn bẩy đang có của mô hình.</p>`;
  const top = r.best.month.net + Ls.filter(l => l.k !== "board").reduce((a, l) => a + Math.max(0, l.v), 0);
  $("l-ins").innerHTML = Ls.length ? `${Ls[0].k === "board" ? `Đổi cài đặt sort là đòn bẩy lớn nhất (<b>${fs(tr(Ls[0].v))}</b> tr). ` : ""}Làm hết các đòn bẩy còn lại thì Est. lên khoảng <b>${fs(tr(top))}</b> tr/tháng (cộng gộp, có thể chồng nhau).` : "Cài đặt đề xuất đã là cách rẻ nhất trong các cách đã thử.";
  $("lev-no").innerHTML = r.NO.map(t => `<li>${esc(t)}</li>`).join("") || `<li>—</li>`; }
function drawBE() { const C = RES.CV, has2 = C.some(c => c.inp != null), vals = C.flatMap(c => [c.best, c.inp].filter(v => v != null)).map(tr), W = 560, H = 250, L = 46, Rr = 14, T = 16, B = 28;
  const ys = [Math.floor(Math.min(0, ...vals) / 25) * 25, Math.ceil(Math.max(0, ...vals) / 25) * 25 || 25], xs = [C[0].a, C[C.length - 1].a], x = v => L + (W - L - Rr) * (v - xs[0]) / (xs[1] - xs[0] || 1), y = v => T + (H - T - B) * (1 - (v - ys[0]) / (ys[1] - ys[0] || 1));
  const stp = (ys[1] - ys[0]) / 50 > 6 ? 100 : (ys[1] - ys[0]) / 25 > 6 ? 50 : 25; let g = ""; for (let v = Math.ceil(ys[0] / stp) * stp; v <= ys[1]; v += stp) g += `<line class="gl" x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  [0, 0.33, 0.66, 1].forEach(f => { const v = Math.round((xs[0] + (xs[1] - xs[0]) * f) / 100) * 100; g += `<text x="${x(v)}" y="${H - 8}" text-anchor="${f === 1 ? "end" : f === 0 ? "start" : "middle"}">${nf(v)}</text>`; });
  g += `<line x1="${L}" x2="${W - Rr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--ink3)"/><text x="${W - Rr}" y="${y(0) - 6}" text-anchor="end">hoà vốn</text><text x="${L}" y="${T - 4}" style="font-size:10.5px">Est. tr/tháng</text><text x="${W - Rr}" y="${H - 8}" text-anchor="end" dy="-13" style="font-size:10.5px">ADO ${DTN[RES.t0]}</text>`;
  const be = k => { for (let j = 1; j < C.length; j++) if (C[j - 1][k] != null && C[j - 1][k] < 0 && C[j][k] >= 0) { const a = C[j - 1], c = C[j]; return Math.round((a.a + (c.a - a.a) * (-a[k]) / (c[k] - a[k])) / 50) * 50; } return C[0][k] >= 0 ? -1 : null; };
  [["best", "var(--s1)"], ["inp", "var(--s2)"]].forEach(([k, col]) => { if (C.every(c => c[k] == null)) return; g += `<path d="${C.map((c, j) => `${j ? "L" : "M"}${x(c.a)} ${y(tr(c[k]))}`).join("")}" fill="none" stroke="${col}" stroke-width="2"/>`; const b = be(k); if (b > 0) g += `<circle cx="${x(b)}" cy="${y(0)}" r="4.5" fill="var(--panel)" stroke="${col}" stroke-width="2"/><text x="${x(b)}" y="${y(0) + 18}" text-anchor="middle" style="fill:var(--ink)">${nf(b)}</text>`; });
  const a0 = RES.PB.ado[RES.t0]; g += `<line x1="${x(a0)}" x2="${x(a0)}" y1="${T}" y2="${H - B}" stroke="var(--ink2)" stroke-dasharray="3 3"/><text x="${x(a0) + 4}" y="${T + 10}" class="vl">${nf(a0)} · đang nhập</text>`;
  g += C.map(c => `<rect x="${x(c.a) - 10}" y="${T}" width="20" height="${H - T - B}" fill="transparent" data-tip="ADO ${DTN[RES.t0]} ${nf(c.a)}<br>Đề xuất: <b>${fs(tr(c.best))} tr</b>${c.inp != null ? `<br>Đang nhập: <b>${fs(tr(c.inp))} tr</b>` : ""}"/>`).join("");
  $("c-be").innerHTML = S(W, H, g, "Est. tiết kiệm theo ADO");
  $("be-l1").textContent = "Đề xuất · " + bLabel(RES.PB.boards[0]); $("be-l2w").hidden = !has2; $("be-l2").textContent = "Đang nhập · " + bLabel(RES.P0.boards[0]);
  const b1 = be("best"), b2 = has2 ? be("inp") : null, bt = v => v === -1 ? `có lời từ mức thấp nhất đã thử (${nf(C[0].a)})` : v ? `có lời từ ADO ${DTN[RES.t0]} ~<b>${nf(v)}</b>` : `chưa có lời tới ${nf(xs[1])}`;
  $("b-ins").innerHTML = `Đề xuất ${bt(b1)}` + (has2 ? `; đang nhập ${bt(b2)}.` : ".") + ` Mức đang nhập (${nf(a0)}): ${fs(tr(RES.best.month.net))} tr/tháng.`;
  $("be-note").textContent = `Giữ tỷ lệ các loại ngày như đang nhập (${RES.PB.ado.map(v => nf(v / a0, 2)).join(" : ")}) và mọi cài đặt khác; số người, xe tính lại ở mỗi mức. Đường gãy là lúc phải thêm hoặc đổi cỡ xe. Điểm dưới ngưỡng thường chỉ lời khi ghép xe với điểm gần.`; }
const MST = { go: ["good", "Nên ghép", o => `cùng Sup, kịp COT (dư ${o.slack}′)`], check: ["warn", "Kiểm tra", o => `${o.supOk ? "" : "khác Sup"}${!o.supOk && !o.hubOk ? ", " : ""}${o.hubOk ? "" : "khác hub"} — cần OE / Sup duyệt`], watch: ["warn", "Theo dõi", o => `trễ ${-o.slack}′ trong mức cho phép`], late: ["bad", "Không ghép", o => `trễ COT ${-o.slack}′`], oe: ["bad", "Không ghép", () => "quy định OE (khác Sup)"], nogain: ["bad", "Không lợi", () => "đi chung không rẻ hơn đi riêng"], na: ["bad", "Không ghép", () => "không có lượt / SOC chung"] };
function drawShare() { const M = RES.best.mrg || {}, L = (M.list || []).slice(0, 8);
  if (M.need) { $("g-ins").textContent = "Cần toạ độ seller để tìm điểm ghép xe."; $("t-share").querySelector("tbody").innerHTML = ""; return; }
  $("t-share").querySelector("tbody").innerHTML = L.length ? L.map(o => { const s = MST[o.st] || MST.na; return `<tr><td><b>${esc(o.mem.map(shortN).join(", "))}</b><span class="sub">${o.ado ? "ADO " + nf(o.ado) : "chỉ chạy ngày campaign"} · ${esc(o.hub || "")}</span></td><td class="n">${nf(o.km, 1)} km</td><td>${o.supOk ? "Cùng Sup" : "Khác Sup"} · ${o.hubOk ? "cùng hub" : "khác hub"}</td><td>${o.waves.map(cotL).join(", ")}<span class="sub">${o.socs.map(SN).join(", ")}</span></td><td class="n ${s[0] === "good" ? "pos" : ""}">${fs(tr(o.save))} tr</td><td class="n">${o.slack == null ? "–" : fa(o.slack, 0) + "′"}</td><td><div class="cell"><span class="pill sm ${s[0]}">${s[1]}</span>${esc(s[2](o))}</div></td></tr>`; }).join("") : `<tr><td colspan="7" class="meta">Không có tuyến nào chung SOC, chung lượt trong bán kính tìm.</td></tr>`;
  const ok = L.filter(o => o.st === "go" && o.save > 0).sort((a, b) => b.save - a.save)[0], ck = L.filter(o => (o.st === "check" || o.st === "watch") && o.save > 0).sort((a, b) => b.save - a.save)[0];
  $("g-ins").innerHTML = ok ? `Ghép được với ${esc(ok.mem.map(shortN).join(", "))} (${nf(ok.km, 1)} km): Est. <b>${fs(tr(ok.save))}</b> tr/tháng, dư COT ${ok.slack}′.` : ck ? `Có thể ghép với ${esc(ck.mem.map(shortN).join(", "))}: Est. <b>${fs(tr(ck.save))}</b> tr/tháng nhưng ${esc(MST[ck.st][2](ck))}.` : "Chưa có tuyến ghép nào vừa lợi vừa kịp COT."; }
function drawPeer() { const P = RES.peers, bm = RES.best.month, me = { xe: bm.truck / bm.orders, ng: bm.lab / bm.orders, so: bm.soc / bm.orders, fm: bm.fm / bm.orders };
  $("peer-cap").textContent = `Cùng vùng ${RES.PB.R}, ADO BAU ±50% (nếu đủ), gần nhất theo toạ độ. Số của seller giống là thực tế ${ddmm(XT.from)}–${ddmm(XT.to)}: tiền xe thật; người và rã bao theo cùng mô hình.`;
  if (!P.length) { $("c-br").innerHTML = `<p class="meta">Chưa có seller giống.</p>`; return; }
  const ref = P.reduce((a, p) => Math.abs((p.a3[0] || 0) - RES.PB.ado[0]) < Math.abs((a.a3[0] || 0) - RES.PB.ado[0]) ? p : a), rf = { xe: ref.trRealU, ng: ref.labU, so: ref.socU }, rc = rf.xe + rf.ng + rf.so, mc = me.xe + me.ng + me.so; $("s-ref").textContent = shortN(ref.n);
  const st = [["", shortN(ref.n), rc, "base"], ["Xe", me.xe - rf.xe], ["Người", me.ng - rf.ng], ["Rã bao", me.so - rf.so], ["", "Seller mới", mc, "end"]];
  const W = 520, H = 250, L = 50, Rr = 10, T = 18, B = 40, lo = Math.max(0, Math.floor((Math.min(rc, mc, rc + Math.min(0, me.xe - rf.xe)) - 300) / 100) * 100), hi = Math.ceil((Math.max(rc, mc, rc + Math.max(0, me.xe - rf.xe)) + 200) / 100) * 100, y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo)), bw = 60, gx = (W - L - Rr) / st.length;
  let g = ""; const sp = (hi - lo) / 500 > 4 ? 500 : (hi - lo) / 100 > 8 ? 200 : 100; for (let v = lo; v <= hi; v += sp) g += `<line class="gl" x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${nf(v)}</text>`;
  let run = rc; st.forEach((s, i) => { const cx = L + gx * i + gx / 2, x0 = cx - bw / 2;
    if (s[3]) { const v = s[2], f = s[3] === "end" ? "var(--s1)" : "var(--fm)"; g += vbar(x0, y(lo), bw, y(v), f, `${esc(s[1])}: <b>${nf(v)} đ/đơn</b>`) + `<text class="vl" x="${cx}" y="${y(v) - 6}" text-anchor="middle">${nf(v)}</text><text x="${cx}" y="${H - 22}" text-anchor="middle" style="fill:var(--ink)">${esc(s[1].length > 14 ? s[1].slice(0, 13) + "…" : s[1])}</text>`; }
    else { const d = s[1], a = run, b = run + d, top = Math.max(a, b), bot = Math.min(a, b); g += `<rect x="${x0}" y="${y(top)}" width="${bw}" height="${Math.max(2, y(bot) - y(top))}" rx="3" fill="${d < 0 ? "var(--good)" : "var(--bad)"}" data-tip="${s[0]}: <b>${fs(d, 0)} đ/đơn</b>"/><text class="vl" x="${cx}" y="${y(top) - 6}" text-anchor="middle">${fs(d, 0)}</text><text x="${cx}" y="${H - 22}" text-anchor="middle" style="fill:var(--ink)">${s[0]}</text>`;
      g += `<line x1="${x0 - gx + bw}" x2="${x0}" y1="${y(a)}" y2="${y(a)}" stroke="var(--ink3)" stroke-dasharray="2 2"/>`; run = b; } });
  g += `<text x="${L}" y="${T - 6}" style="font-size:10.5px">đ / đơn</text><text x="${L + gx * 2.5}" y="${H - 6}" text-anchor="middle" style="font-size:10.5px">xanh: seller mới rẻ hơn · đỏ: đắt hơn</text>`;
  $("c-br").innerHTML = S(W, H, g, "Chênh lệch chi phí mỗi đơn so với seller giống");
  const fr = v => v == null ? "–" : v > 100 ? "đi ghép" : v + "%", row = (n, sub, ado, ch, fill, c, parts, est, meCls) => `<tr${meCls ? ' class="me"' : ""}><td><b>${esc(n)}</b><span class="sub">${esc(sub)}</span></td><td class="n">${ado}</td><td class="n">${ch}</td><td class="n">${fill}</td><td class="n">${nf(c)}<span class="sub">${parts}</span></td><td class="n ${est >= 0 ? "pos" : "neg"}">${fs(tr(est))} tr</td></tr>`;
  $("t-peer").querySelector("tbody").innerHTML = P.map(p => row(shortN(p.n), `${p.km != null ? nf(p.km, 1) + " km · " : ""}${p.hub || ""}`, p.a3[0] ? nf(p.a3[0]) : "chỉ campaign", p.chN, fr(p.fillReal), p.cpoT8, `xe ${nf(p.trRealU)} · người ${nf(p.labU)} · rã bao ${nf(p.socU)}`, p.estT8)).join("")
    + row("Seller mới · đề xuất", `${nf(RES.PB.beta * 100)}% hàng to · mô hình`, nf(RES.PB.ado[0]), RES.PB.boards[0].filter(c => c.g.length).length, (fillAvg(RES.best.days[actT(RES.best)]) ?? "–") + "%", mc, `xe ${nf(me.xe)} · người ${nf(me.ng)} · rã bao ${nf(me.so)}`, bm.net, true);
  const dif = [["xe", me.xe - rf.xe], ["người", me.ng - rf.ng], ["rã bao", me.so - rf.so]].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  $("s-ins").innerHTML = `So với ${esc(shortN(ref.n))} (ADO BAU ${ref.a3[0] ? nf(ref.a3[0]) : "–"}), seller mới ${mc < rc ? "rẻ" : "đắt"} hơn <b>${nf(Math.abs(rc - mc))}</b> đ/đơn; chênh lớn nhất ở ${dif[0]} (${fs(dif[1], 0)} đ/đơn).`;
  const L1 = [], hiT = P.filter(p => p.trRealU > p.trModU * 1.2);
  if (hiT.length) L1.push(`${hiT.map(p => esc(shortN(p.n))).join(", ")} đang tốn xe thật ${hiT.map(p => nf(p.trRealU)).join(" / ")} đ/đơn, cao hơn mô hình đúng cỡ ${hiT.map(p => nf(p.trModU)).join(" / ")} đ/đơn → khi chạy thật, giữ đúng cỡ xe và số chuyến như kế hoạch thì mới ra Est. ở trên.`);
  const mc2 = P.filter(p => p.chN > 1); if (mc2.length) L1.push(`${mc2.map(p => esc(shortN(p.n)) + ` (${p.chN} chute, đầy ${fr(p.fillReal)})`).join(", ")}: nhiều SOC đích nên mỗi lượt nhiều xe.`);
  if (me.fm && Math.abs(me.fm - (ref.fmU || me.fm)) > 50) L1.push(`Đơn giá FM pickup khác nhau vì % hàng to: seller mới ${nf(me.fm)} đ/đơn, ${esc(shortN(ref.n))} ${nf(ref.fmU)} đ/đơn — nên so cả Est., không chỉ đ/đơn.`);
  $("s-do").innerHTML = `<span class="k">Đọc ra gì</span>` + (L1.length ? L1.map(x => `<p>${x}</p>`).join("") : `<p>Seller mới và seller giống có cùng cấu trúc chi phí.</p>`); }
document.querySelectorAll("#planseg [data-plan]").forEach(b => b.addEventListener("click", () => { PL = b.dataset.plan === "best" ? "best" : "in"; document.querySelectorAll("#planseg [data-plan]").forEach(x => x.setAttribute("aria-pressed", x === b)); drawKpis(); drawTrk(); drawPpl(); drawCot(); }));
document.querySelectorAll(".dtseg").forEach(sg => sg.addEventListener("click", e => { const b = e.target.closest("[data-dt]"); if (!b) return; sg.querySelectorAll("[data-dt]").forEach(x => x.setAttribute("aria-pressed", x === b)); if (sg.dataset.for === "t") { TDT = +b.dataset.dt; drawTrk(); } else { PDT = +b.dataset.dt; drawPpl(); } }));

/* ===== SELLER ĐANG CHẠY (số thật của kỳ: tiền xe thật; người và rã bao theo mô hình) ===== */
let RR = Object.keys(XT.run)[0], VF = "all"; const RUNO = {};
const rowOf = r => Object.assign({}, r, RUNO[r.n] || {});
const vdOf = r => r.estT8 >= 0 ? (r.vd === "go" ? "go" : "cond") : "no", VL = { go: ["Nên chạy", "good"], cond: ["Theo dõi", "warn"], no: ["Chưa đạt", "bad"] };
$("rreg").innerHTML = Object.keys(XT.run).map(R => `<button type="button" aria-pressed="${R === RR}" data-rr="${R}">${R} · ${XT.run[R].length}</button>`).join("");
$("rreg").addEventListener("click", e => { const b = e.target.closest("[data-rr]"); if (!b) return; RR = b.dataset.rr; $("rreg").querySelectorAll("[data-rr]").forEach(x => x.setAttribute("aria-pressed", x === b)); drawRun(); });
document.querySelectorAll("#vfilter [data-v]").forEach(b => b.addEventListener("click", () => { VF = b.dataset.v; document.querySelectorAll("#vfilter [data-v]").forEach(x => x.setAttribute("aria-pressed", x === b)); drawRun(); }));
$("q").addEventListener("input", drawRun);
const botTxt = r => { const b = r.best; if (!b) return "—"; if (b.k === "truck") return `Xe thật ${nf(r.trRealU)} đ/đơn; đúng cỡ chỉ ${nf(r.trModU)}`;
  if (b.k === "1ch") return `${r.chN} chute: mỗi lượt xe riêng cho từng SOC`; if (b.k === "mrg") return `Chạy xe riêng; có tuyến ghép gần (${nf(b.km, 1)} km)`; if (b.k === "hub") return "Người riêng; nhóm FM Hub rẻ hơn";
  if (b.k === "fm") return r.ordReal / Math.max(1, r.nDays) < 800 ? `Đơn ít (~${nf(r.ordReal / Math.max(1, r.nDays))}/ngày có hàng) so với tiền xe` : `Tiền xe thật ${nf(r.trRealU)} đ/đơn cao hơn FM pickup`; return "—"; };
function drawRun() { const all = (XT.run[RR] || []).map(rowOf), q = $("q").value.trim().toLowerCase(), R2 = all.filter(r => (VF === "all" || vdOf(r) === VF) && (!q || r.n.toLowerCase().includes(q))).sort((a, b) => b.estT8 - a.estT8);
  const pos = all.filter(r => r.estT8 > 0), c = k => all.filter(r => vdOf(r) === k).length, ord = all.reduce((a, r) => a + r.ordReal, 0), lv = all.reduce((a, r) => a + (r.best && r.best.k !== "fm" ? r.best.g : 0), 0);
  $("stats").innerHTML = [[`Điểm D2S ${RR}`, all.length, `${nf(ord / 1e6, 2)} triệu đơn ${ddmm(XT.from)}–${ddmm(XT.to)}`], ["Est. kỳ (cộng điểm lời)", `+${nf(tr(pos.reduce((a, r) => a + r.estT8, 0)), 1)} <small>tr</small>`, `cả ${all.length} điểm: ${fs(tr(all.reduce((a, r) => a + r.estT8, 0)))} tr`, 1],
    ["Nên chạy", c("go"), `${c("cond")} theo dõi · ${c("no")} chưa đạt`], ["Đòn bẩy cộng lại", `+${nf(tr(lv), 1)} <small>tr</small>`, "Est. nếu làm đòn bẩy tốt nhất mỗi điểm"]].map(([l, v, d, h]) => `<div class="kpi${h ? " hero" : ""}"><span class="l">${l}</span><span class="v">${v}</span><span class="d">${d}</span></div>`).join("");
  const by = k => all.filter(r => r.best && r.best.k === k), sm = L => nf(tr(L.reduce((a, r) => a + r.best.g, 0)), 1), parts = [];
  if (by("truck").length) parts.push(`<b>${by("truck").length}</b> điểm tốn xe thật hơn mô hình đúng cỡ → đặt xe đúng cỡ, đúng số chuyến Est. <b>+${sm(by("truck"))}</b> tr`);
  if (by("1ch").length) parts.push(`<b>${by("1ch").length}</b> điểm chạy nhiều chute → gộp 1 chute Est. <b>+${sm(by("1ch"))}</b> tr`);
  if (by("mrg").length) parts.push(`<b>${by("mrg").length}</b> điểm ghép được xe với tuyến gần Est. <b>+${sm(by("mrg"))}</b> tr`);
  if (by("hub").length) parts.push(`<b>${by("hub").length}</b> điểm nên dùng chung người FM Hub Est. <b>+${sm(by("hub"))}</b> tr`);
  if (by("fm").length) parts.push(`<b>${by("fm").length}</b> điểm lỗ mà không đòn bẩy nào cứu được → cân nhắc về FM pickup`);
  $("run-ins").innerHTML = parts.join(". ") + (parts.length ? "." : "");
  $("run-h").textContent = `Est. tiết kiệm theo seller · ${ddmm(XT.from)}–${ddmm(XT.to)}`;
  const W = 760, L = 210, Rr = 66, rh = 22, H = Math.max(40, R2.length * rh + 28), vs = R2.map(r => tr(r.estT8)), mn = Math.min(0, Math.floor(Math.min(0, ...vs) / 25) * 25), mx = Math.max(25, Math.ceil(Math.max(0, ...vs) / 25) * 25), x = v => L + (W - L - Rr) * (v - mn) / (mx - mn || 1);
  const tk = [...new Set([mn, mn / 2, 0, mx / 2, mx].map(v => Math.round(v)))]; let g = tk.map(v => `<line class="gl" x1="${x(v)}" x2="${x(v)}" y1="2" y2="${H - 22}"/><text x="${x(v)}" y="${H - 6}" text-anchor="middle">${nf(v)}</text>`).join("") + `<line x1="${x(0)}" x2="${x(0)}" y1="2" y2="${H - 22}" stroke="var(--ink3)"/>`;
  R2.forEach((r, i) => { const y = 4 + i * rh, v = tr(r.estT8), f = v >= 0 ? "var(--s1)" : "var(--s2)", x0 = v >= 0 ? x(0) : x(v), w = Math.abs(x(v) - x(0)), tt = `<b>${esc(shortN(r.n))}</b>: ${fs(v)} tr<br>Nút thắt: ${esc(botTxt(r))}<br>Đòn bẩy: ${esc(r.best ? r.best.t : "—")}${r.best ? ` · ${fs(tr(r.best.g))} tr` : ""}`;
    g += `<text x="${L - 8}" y="${y + 13}" text-anchor="end" style="fill:var(--ink)">${esc(shortN(r.n).slice(0, 30))}</text>` + (v >= 0 ? hbar(x0, y + 3, w, rh - 7, f, tt, true) : `<rect x="${x0}" y="${y + 3}" width="${w}" height="${rh - 7}" rx="3" fill="${f}" data-tip="${tt}"/>`) + `<text class="vl" x="${v >= 0 ? x(v) + 6 : x(0) + 6}" y="${y + 13}">${fs(v)}</text>`; });
  $("c-run").innerHTML = R2.length ? S(W, H, g, "Est. tiết kiệm theo seller") : `<p class="meta">Không có seller khớp bộ lọc.</p>`;
  $("t-run").querySelector("tbody").innerHTML = R2.map(r => `<tr><td><b>${esc(shortN(r.n))}</b><span class="sub">${esc(r.hub || "")}${RUNO[r.n] ? " · đã chỉnh cài đặt sort" : ""}</span></td><td class="n">${r.a3.map(v => v ? nf(v) : "–").join(" / ")}<span class="sub">${nf(r.ordReal)} đơn kỳ</span></td><td class="n ${r.estT8 >= 0 ? "pos" : "neg"}">${fs(tr(r.estT8))} tr</td><td class="n">${nf(r.cpoT8)}<span class="sub">FM ${nf(r.fmU)}</span></td><td class="n">${r.fillReal == null ? "–" : r.fillReal > 100 ? "đi ghép" : "đầy " + r.fillReal + "%"}<span class="sub">${r.tripsDay == null ? "" : nf(r.tripsDay, 1) + " chuyến · " + (r.kMain || "")}</span></td><td style="white-space:nowrap">${r.chN} chute<span class="sub">${r.tos.map(SN).join(" · ")}</span><button class="lk" data-sort="${esc(r.n)}" style="font-size:12px">Cài đặt sort</button></td><td><span class="pill ${VL[vdOf(r)][1]}">${VL[vdOf(r)][0]}</span></td><td class="w">${esc(botTxt(r))}</td><td class="w"><b style="color:var(--ink)">${esc(r.best ? r.best.t : "Giữ nguyên")}</b>${r.best ? `<span class="sub" style="color:var(--good);font-family:var(--f-num)">Est. ${fs(tr(r.best.g))} tr/kỳ</span>` : ""}</td></tr>`).join(""); }
$("p-run").addEventListener("click", e => { const s = e.target.closest("[data-sort]"); if (s) { ORG = s.dataset.sort; go("net"); } });

/* ===== MẠNG LƯỚI SPX: cài đặt sort (sort code → chute → SOC) từng điểm; mặc định suy từ SOC xe thật tới ===== */
let ORG = (XT.run[RR] && XT.run[RR][0] || {}).n, NSEL = null, NHIST = []; const NB = {};
const runOf = n => Object.values(XT.run).flat().find(r => r.n === n);
const FLMO = Object.keys(REF.reg).map(R => ({ n: "FLM chuẩn · " + R, R, flm: 1 }));
const nboard = () => { if (NB[ORG]) return NB[ORG]; const r = runOf(ORG), f = FLMO.find(o => o.n === ORG); return (NB[ORG] = JSON.parse(JSON.stringify(r ? r.prof.boards[0] : ns2Preset("flm", f ? f.R : "HCM")))); };
const nmix = () => { const r = runOf(ORG); return r ? r.mix : XT.pivAvg; };
function drawNet() { const L1 = Object.entries(XT.run).map(([R, L]) => `<h4>Seller D2S ${R} · ${L.length}</h4>` + L.slice().sort((a, b) => b.ordReal - a.ordReal).map(r => `<button data-o="${esc(r.n)}" aria-current="${r.n === ORG}">${esc(shortN(r.n))}<span>${(NB[r.n] || r.prof.boards[0]).filter(c => c.g.length).length}</span></button>`).join("")).join("");
  $("olist").innerHTML = `<input id="oq" placeholder="Tìm điểm…" aria-label="Tìm điểm" style="margin-bottom:4px">${L1}<h4>FM Hub chuẩn (FLM)</h4>${FLMO.map(f => `<button data-o="${esc(f.n)}" aria-current="${f.n === ORG}">${esc(f.n)}<span>${ns2Preset("flm", f.R).length}</span></button>`).join("")}`;
  const r = runOf(ORG); $("o-kind").textContent = r ? `Seller D2S đang chạy · ${r.R}` : "Điểm gốc chuẩn"; $("o-name").textContent = r ? shortN(ORG) : ORG;
  $("o-sub").textContent = r ? `${nf(r.ordReal)} đơn ${ddmm(XT.from)}–${ddmm(XT.to)} · SOC xe thật tới: ${Object.entries(r.soc || {}).sort((a, b) => b[1] - a[1]).map(([s, v]) => `${SN(s)} ${nf(v * 100)}%`).join(", ")} · % sort code: ${r.mixSrc === "pivot" ? "Volume by Sort Code của điểm" : "trung bình HCM (chưa có số của điểm)"}` : "Như FLM chuẩn trên slide mạng lưới (mỗi nhóm một chute)";
  $("n-save").hidden = !r; drawNBoard(); }
function drawNBoard() { const B = nboard(), mix = nmix(), ex = ns2Extra(B, mix), r = runOf(ORG), live = B.filter(c => c.g.length), dest = new Set(live.map(c => c.to)), nw = r ? REF.reg[r.R].cots.length : 3, cs = rsCostOf(B, mix);
  $("n-impact").innerHTML = `<span><b>${live.length}</b> chute</span><span><b>${dest.size}</b> SOC đích → ít nhất ${dest.size * nw} chuyến/ngày</span><span>Rã bao thêm so với FLM: <b style="color:${ex.sh > 0 ? "var(--s2)" : "var(--good)"}">${nf(ex.sh * 100, 1)}%</b> đơn</span>` + (r ? `<span class="meta">≈ ${nf(ex.sh * cs)} đ/đơn · Est. ${nf(tr(ex.sh * cs * r.ordReal), 1)} tr công sort lại trong kỳ (giá ${nf(cs)} đ/lần)</span>` : "") + (RUNO[ORG] ? `<span class="meta" style="color:var(--good)">${RUNO[ORG].msg}</span>` : "");
  const MIXs = MIX; MIX = mix; $("n-board").innerHTML = boardHTML(B, ex.set, NSEL); MIX = MIXs; drawFlow(); }
function drawFlow() { const B = nboard().filter(c => c.g.length), W = 760, rows = [];
  [...new Set(B.map(c => c.to))].forEach(t => B.filter(c => c.to === t).forEach(c => { const homes = [...new Set(c.g.map(g => NS2_HOME[g]))].sort((a, b) => (b === t) - (a === t)); homes.forEach(h => rows.push({ c, h, gs: c.g.filter(g => NS2_HOME[g] === h) })); }));
  const rh = 34, H = Math.max(rows.length, 1) * rh + 20, X0 = 10, X1 = 200, X2 = 400, X3 = 600, NW = 150, NH = 24, y = i => 14 + i * rh, tos = [...new Set(B.map(c => c.to))], ty = {};
  tos.forEach(t => { const ii = rows.map((r, i) => r.c.to === t ? i : -1).filter(i => i >= 0), own = rows.findIndex(r => r.c.to === t && r.h === t); ty[t] = own >= 0 ? y(own) : (y(ii[0]) + y(ii[ii.length - 1])) / 2; });
  const oy = (y(0) + y(Math.max(0, rows.length - 1))) / 2, node = (x, yy, t, cl) => `<g class="nd ${cl || ""}"><rect x="${x}" y="${yy - NH / 2}" width="${NW}" height="${NH}" rx="6"/><text x="${x + NW / 2}" y="${yy + 4}" text-anchor="middle">${esc(t)}</text></g>`, ed = (x1, y1, x2, y2, k) => `<path class="e-${k}" d="M${x1} ${y1}C${x1 + 40} ${y1} ${x2 - 40} ${y2} ${x2} ${y2}" fill="none" stroke-width="1.8"/>`;
  let g = ""; tos.forEach(t => { g += ed(X0 + NW, oy, X1, ty[t], "soc"); });
  rows.forEach((r, i) => { const open = !(new Set(r.c.g.map(g => NS2_HOME[g])).size === 1 && NS2_HOME[r.c.g[0]] !== r.c.to) && !r.c.via;
    if (r.h === r.c.to) g += ed(X1 + NW, ty[r.c.to], X3, y(i), "lm"); else { g += ed(X1 + NW, ty[r.c.to], X2, y(i), open ? "soc" : "tr") + ed(X2 + NW, y(i), X3, y(i), "lm") + node(X2, y(i), SN(r.h)); }
    g += node(X3, y(i), r.gs.join(", "), "lm"); });
  const on = shortN(ORG); g += node(X0, oy, on.length > 20 ? on.slice(0, 19) + "…" : on, "o") + tos.map(t => node(X1, ty[t], SN(t))).join("");
  $("c-flow").innerHTML = S(W, H, g, "Luồng hàng theo cài đặt sort"); }
$("olist").addEventListener("click", e => { const b = e.target.closest("[data-o]"); if (b) { ORG = b.dataset.o; NSEL = null; NHIST = []; drawNet(); } });
$("olist").addEventListener("input", e => { if (e.target.id !== "oq") return; const q = e.target.value.toLowerCase(); $("olist").querySelectorAll("[data-o]").forEach(b => { b.hidden = q && !b.dataset.o.toLowerCase().includes(q); }); });
const nedit = f => { NHIST.push(JSON.stringify(nboard())); f(nboard()); drawNBoard(); };
const nmove = (g, ci) => nedit(B => { B.forEach(c => { c.g = c.g.filter(x => x !== g); }); if (ci >= 0 && B[ci]) B[ci].g.push(g); });
wireBoard($("n-board"), nboard, nmove, nedit, drawNBoard, v => v === undefined ? NSEL : (NSEL = v));
document.querySelector("#p-net .qa").addEventListener("click", e => { const b = e.target.closest("[data-qa]"); if (!b) return; const k = b.dataset.qa, r = runOf(ORG); if (k === "add") nedit(B => B.push({ to: "BD A Mega SOC", g: [] })); else { NHIST.push(JSON.stringify(nboard())); NB[ORG] = ns2Preset(k, r ? r.R : "HCM"); drawNBoard(); } });
$("n-undo").addEventListener("click", () => { const h = NHIST.pop(); if (h) { NB[ORG] = JSON.parse(h); drawNBoard(); } });
/* lưu: tính lại điểm đang chạy với cài đặt mới (cùng engine, cùng hồ sơ), cộng chênh vào lời/lỗ thực tế của kỳ */
$("n-save").addEventListener("click", () => { const r = runOf(ORG); if (!r) return; const B = nboard(), prof = Object.assign({}, r.prof, { boards: [0, 1, 2].map(() => JSON.parse(JSON.stringify(B))) });
  try { const p1 = nsPlan(REF, Object.assign(NSX(prof), { lite: true })), sameTo = sameB([...new Set(B.filter(c => c.g.length).map(c => c.to))].sort(), [...new Set(r.prof.boards[0].map(c => c.to))].sort()), u = k => p1.month.orders ? p1.month[k] / p1.month.orders : 0;
    /* lời/lỗ của kỳ với cài đặt mới: FM − người − rã bao (theo cài đặt mới) − xe (giữ xe thật nếu SOC đích không đổi; đổi SOC đích thì xe theo mô hình) */
    const est = r.ordReal * (u("fm") - u("lab") - u("soc")) - (sameTo ? r.trReal : u("truck") * r.ordReal), d = est - r.estT8; RUNO[ORG] = { estT8: est, chN: B.filter(c => c.g.length).length, tos: [...new Set(B.filter(c => c.g.length).map(c => c.to))], cpoT8: r.ordReal ? r.cpoT8 - d / r.ordReal : r.cpoT8, msg: `Đã lưu: Est. kỳ ${fs(tr(r.estT8))} → ${fs(tr(est))} tr${sameTo ? " (giữ tiền xe thật)" : " (đổi SOC đích: tiền xe theo mô hình đúng cỡ)"}` };
    $("n-save").textContent = "Đã lưu"; setTimeout(() => { $("n-save").textContent = "Lưu cài đặt"; }, 1400); drawNBoard(); } catch (e) { console.error(e); } });
/* bảng mã sort code → nhóm LM → SOC mở bao; giá rã bao */
$("t-map").innerHTML = NS2_CODES.map(g => `<tr><td><b>${g}</b></td><td class="n">${nf(XT.pivAvg[g] || 0, 1)}%</td><td>${esc(NS2_LMG[g])}</td><td>${SN(NS2_HOME[g])}</td><td>${NS2_DRAFT.includes(g) ? `<span class="tag">cần xác nhận</span>` : ""}</td></tr>`).join("");
["n-cman", "n-casm", "n-pa", "n-pb"].forEach(id => $(id).addEventListener("input", () => { const v = id => { const x = +String($(id).value).replace(",", "."); return $(id).value.trim() === "" || !isFinite(x) ? null : x; };
  NETC.man = v("n-cman") ?? 260; NETC.asm = v("n-casm"); NETC.pa = v("n-pa"); NETC.pb = v("n-pb"); drawNBoard(); drawBoard(); }));

/* ===== KHỞI ĐỘNG ===== */
document.querySelectorAll("[data-reg]").forEach(x => x.setAttribute("aria-pressed", x.dataset.reg === R));
fillRegion(); drawBoard(); go("home");
