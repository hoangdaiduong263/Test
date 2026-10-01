# D2S Seller Planner — context

## Mục tiêu
Dùng data thật (Volume Tracking, Linehaul, Data Simulation) + simulation (trang HTML) để tìm **mức ADO hợp lý cho từng vùng** (North, South, HN, HCM, DNCH) sao cho tối ưu vận hành và chi phí. Mỗi vùng xét riêng, không áp chung một mức ADO.

Hai yêu cầu kèm theo:
- **Bỏ giả định "1 seller = 1 FTE".** Hub quản nhiều seller thường dùng một nhóm FTE đi lần lượt từng seller. Trang đã tính người theo FM Hub: các điểm cùng Hub cộng khối lượng, cộng hao hụt đi lại, làm tròn một lần rồi chia lại theo khối lượng. "Tự chọn cách rẻ hơn" so hai cách và giữ cách rẻ hơn cho mỗi Hub.
- Chỗ nào thiếu data thì nêu ra hoặc tự đặt giả định.

## Nguồn dữ liệu
| Nguồn | Nội dung | Ghi chú |
|---|---|---|
| Google Sheet Linehaul Data (bound script) — https://docs.google.com/spreadsheets/d/1c5RbLor1SEmdcCqa45QV5rR1j_tkr_sqH3H9GLUpPos | sheet `Data` (chuyến, từng điểm dừng), `Station` (toạ độ) | |
| D2S Volume Tracking (Ver2) | sheet `Transformed` (đơn theo điểm theo ngày, hàng to, FM Hub), `Config [Report]` (loại ngày BAU / Mini CP / CP) | ID dán vào `VOLUME_SPREADSHEET_ID` trong `gas/Code.gs` |
| Data Simulation | danh sách có / không có data | |
| Artifact trên Cowork — https://claude.ai/cowork/cse_01MkkMrj8RHjEFZrqu6zqJjr?artifact=9c80fb18-4a8c-4a91-8974-794d6c369772 | bản standalone (data nhúng sẵn, bản 63) | Không commit vào repo vì có data thật và nặng 2 MB |

## Cấu trúc code
- `gas/Code.gs` (BACKEND_VERSION 8): đọc 2 file sheet, nén thành gói JSON `{v, win, warn, dates, dt, lh, TY, S, T, TN, GEO}`, cất vào sheet ẩn `_D2S_CACHE`, lưu cấu hình người dùng vào `_D2S_CONFIG`. Có menu: Cập nhật dữ liệu ngay, Kiểm tra dữ liệu, Tạo lịch 07:00, Mở link web app.
- `gas/Index.html` → include `Styles`, `Body`, `App`.
- `gas/Styles.html`: CSS (font Be Vietnam Pro + IBM Plex Mono, có dark mode).
- `gas/Body.html`: khung trang. Các tab: Seller mới, Ngưỡng ADO, và 4 bước (Kỳ & dữ liệu → Gốc → Chọn điều chỉnh → Kết quả).
- `gas/App.html`: toàn bộ logic (`initApp`, khoảng 200 hàm). Code giống hệt bản artifact, chỉ khác phần lưu trữ: GAS dùng `boot`/`initStore` qua `google.script.run`, artifact dùng `initDb`/`applyLoaded`.

## Các quyết định đã chốt (đến bản artifact 63 / Code.gs v8)
1. **Đơn D2S chỉ xuống ở SOC.** Hub dỡ hàng thì trừ vào hàng LM hoặc hàng của Hub, không trừ vào đơn D2S. Ví dụ LT0Q864V05A01: BN B Mega nhận 387 = 337 (Quảng Xương Hub) + 50 D2S.
2. **Ngày của chuyến = ngày xe thật tới điểm D2S đầu tiên** (cột `Giờ đến điểm`), không theo cột `Ngày` (ngày plan). Tỷ lệ khớp ngày với Volume Tracker tăng từ 97,2% lên 98,2%. Ví dụ LT0Q864UY0DY1 được tính cho 06/08.
3. **Chia đơn về SOC khi chuyến ghé nhiều SOC:** có 171 chuyến không tách chính xác được (61 chở chung với hàng không phải D2S, 110 chỉ có D2S nhưng nhiều điểm + nhiều SOC), khoảng 83.000 đơn (1,6%). Cách đang dùng: lấy "thói quen SOC" của từng điểm từ các chuyến chỉ ghé 1 SOC, rồi cân lại cho khớp số đơn lên ở từng điểm và số đơn xuống ở từng SOC (`SOCSH` trong App.html). Muốn tách chính xác thì cần **data mức TO (mã TO, điểm lên, SOC đích)**, chưa có.
4. Tiền chuyến chia theo **số đơn lên tại điểm** (v6), không chia theo TO.

## Việc còn mở
- **Sheet `Data` mất 41 dòng** (dòng 13181–13221, 19 chuyến ngày 01/08, phần lớn HCM/South: BOX ME Tân Tạo, INDOMIE, Shop Mẹ Cá Heo, B1B2 nhựa Chợ Lớn…; ví dụ LT0Q814UA8L81 mất 2 dòng xuống BD A/B Mega SOC). Artifact đã ghép bù, nhưng bản GAS còn thiếu tới khi load lại đầy đủ ngày 01/08.
- "Chưa rõ SOC" còn 118 đơn cả kỳ (khoảng 4 đơn/ngày): Xơ Dừa Miền Tây-PBT (98) và 534 TA HL_PBT (9) không có chuyến nào trong file linehaul; HQ Mart 03/08 (9): xe ghé 6 lần nhưng 0 đơn, có thể bị quét chung với Land Mart; BOO Mart, Masan 31/08 (mỗi điểm 1 đơn).
- Chờ data mức TO để thay phần đoán SOC.
- Chưa có trong công thức: ngành hàng, địa điểm, diện tích thật (đang giả định đủ diện tích 100%), giờ cut-off (xử lý bằng ô "Số mốc COT").

## Tối ưu toàn mạng (bước 3, mục 0)
- Mỗi vùng là một mạng: nút = điểm D2S; ghép được xe khi chung SOC + trùng ≥ 50% ngày + cách ≤ `gKm`, hoặc đang đi chung ≥ 3 chuyến thật; dùng chung người **chỉ khi cùng FM Hub** (≤ `tKm`), vì KPI tính theo hub nên hub nào lo seller của hub đó.
- Tìm kiếm cục bộ bắt đầu từ mạng đang chạy: gộp, chuyển, đổi chỗ, tách; giữ nước làm cả vùng lời nhất. Tuyến ≤ `truck.stops` điểm, nhóm người ≤ `lab.tMax` điểm.
- So trên cùng mô hình khi tìm; số hiện ra = tiền xe thật + phần mô hình thay đổi (action `net` dùng `tsrc:"real"`), nên không lẫn phần đổi cỡ xe.
- Xe ghép có thêm chi phí km đi vòng (`truck.kmP`, mặc định 10.000 đ/km, giả định), dùng cho mọi chuyến ghép.
- Kết quả gom thành gói (tuyến mới + tuyến cũ bị cắt). Loại điều chỉnh mới: `net` (tuyến), `nett` (nhóm người). Bộ đề xuất = kế hoạch mạng trước, rồi đổi cỡ xe / 1 xe nhiều SOC cho điểm còn lại.
- Cặp ghép từng điểm (`ghep`) giờ tính cả điểm bị bỏ lại trên tuyến đang chạy (`pairNet`).
- Chưa kiểm: khung giờ lấy hàng, đường đi thực tế.
- Trực quan (bước 3, mục 0): tóm tắt mỗi tuyến/nhóm một dòng (chuyến/ngày hoặc người/ngày trước → sau), thẻ từng tuyến (bản đồ nhỏ, số thứ tự lấy hàng, rê chuột xem tên), thẻ nhóm người theo FM Hub (hình người trước → sau), dumbbell chỉ số cả vùng, cầu lãi/lỗ theo gói. Đã bỏ bản đồ toàn cảnh vì rối.

## Cập nhật 29/09
- **Hai bộ trang**: trang chủ có 2 thẻ, A = New Seller & ADO Thresholds (tab Seller mới, Ngưỡng ADO), B = Optimization Opportunities (bước 1–4). Luôn mở vào trang chủ.
- **COT / giờ bàn giao**: Volume Tracker chưa tách đơn theo sàn/mốc COT (Shopee FHR: đơn trước 14h bàn giao trước 23:59 D0, sau 14h trước 23:59 D+1; NSS: trước 15h lấy 23:59 D0). Model dùng giờ xe thật tới điểm (file linehaul) làm hạn: `waveTimes(i)`.
  - Xe ghép: giờ xe tới các điểm lệch ≤ `truck.cotGap` (90 phút), và đi vòng + dừng (`truck.dwell` 20 phút/điểm, tốc độ `lab.spd`) phải gói trong khoảng đó.
  - Nhóm người đi vòng (`poolHc`): đi lần lượt theo giờ xe tới, bắt đầu `lab.st` giờ, mỗi người `lab.hrs` giờ/ngày; không kịp thì thêm người, tới mức bằng tổng người riêng.
- **Bước 4** có "Mạng lưới sau điều chỉnh": điểm xếp theo xe ghép (từng tuyến) / xe riêng / ké FLM / xe hub trả, và nhóm đi vòng / người riêng; đánh dấu điểm đổi so với gốc.
- **Báo cáo Linehaul** (artifact riêng, data tháng 8): seller lỗ do xe, nguyên nhân (xe to hơn cần, thừa chuyến, sàn chuyến do SOC × COT, nhiều adhoc).
- **Occupancy của BI**: sheet "Occu Seller" = TO lên ÷ tổng sức chứa danh nghĩa các chuyến ghé điểm (1T9 2.000, 5T 3.700, 8T 6.000, 1T25 1.300, VAN 1.000); khớp các dòng đã đối chiếu. Sheet "Occu SPC" chưa khớp cách này, cần BI xác nhận định nghĩa. Connector Drive chỉ đọc được dòng mẫu của hai sheet.

## Cập nhật 29/09 (chiều): lịch mô phỏng từ chuyến thật
- Mỗi điểm, mỗi lượt xe (cách nhau > 2 giờ là lượt mới): giờ xe tới đầu/cuối, giờ đi, giờ về SOC sớm nhất/muộn nhất, số xe, số đơn lên; tốc độ chất hàng (phút/đơn) và thời gian từ điểm về SOC; tốc độ xe chung đo từ data (`stT`, `simK`).
- `simRun`: mỗi lượt chia thành n xe (n = đơn của lượt ÷ `truck.simCap`), xe j lấy phần hàng sẵn ở mốc j/(n−1) giữa giờ xe tới đầu và cuối hiện nay. Người riêng: hàng sẵn từ giờ xe tới hiện nay (sort độc lập với xe). Nhóm người chung: sort chỉ bắt đầu khi xe đã tới VÀ nhóm có mặt; xe chờ sort xong mới chất.
- Đạt khi mọi điểm về SOC không trễ quá `truck.cotTol` (mặc định 30 phút) so với hiện nay. Xe ghép thử mọi thứ tự ghé (≤ 4 điểm). Điểm đang đi chung chuyến thật thì lấy data thật làm căn cứ, không mô phỏng.
- Tuyến ghép chạy theo số lượt của điểm nhiều lượt nhất; lượt của điểm khác gắn vào lượt gần giờ nhất (2, 3 COT được mô phỏng từng lượt).
- Hệ quả: gốc lỗ thêm ~210 tr vì các hub dùng chung người (≥ 3 điểm) phải thêm người để giữ giờ về SOC; lời từ ghép xe giảm mạnh (HN: 0 ở mức 30 phút, +131 tr ở 60 phút, +287 tr ở 90 phút).

## Cập nhật 29/09 (tối): COT chính thức (deck "Sellers direct to SOC", slide 13–14)
- Mỗi COT: FMHub_received (FTE nhận/sort xong) và FMLH_Packed (giao linehaul). HCM 13/14h, 17/18h, 23/24h; North & Central 13/14h, 21h30/22h30; North gần HY (sheet "D2S HY SOC") tháng 8 chạy một COT 19h/20h; South 13/14h, 20h30/21h30; HN 13/14h, 17/19h (hoặc 17/21h vùng cấm tải), 23/24h. COT cuối: Packed = giờ seller đóng cửa, Received = đóng cửa − 1h (có giờ đóng cửa BAU của 6 seller HCM/South).
- Lượt xe hiện nay gắn vào COT sớm nhất có Packed không trước giờ xe đi quá 45 phút; hạn = max(Packed, giờ xe đi hiện nay).
- Đạt khi xe rời mỗi điểm trước hạn Packed; nhóm người chung còn phải sort xong trước Received (`truck.cotTol` = phút được trễ, mặc định 0).
- Kết quả (tháng 8): gốc −1.124 tr (47/368 ngày-nhóm chung phải thêm người); tối ưu mạng: North +112, South +127, HN +176, HCM +15 tr.

## Cập nhật 30/09: thời gian dừng theo volume, ngày đông, chỗ chất hàng
- Thời gian dừng một xe = phần cố định + phút/đơn × số đơn xe lấy, ước lượng Theil–Sen trên các lần dừng thật của từng điểm (`fitDwell`); thiếu data thì dùng trung vị toàn mạng (~10 phút + 5 phút/100 đơn).
- Tuyến ghép được kiểm ở ngày đông: đơn/ngày phân vị `truck.peakP` (mặc định p90) của từng điểm; nhóm người vẫn kiểm theo đơn từng ngày.
- Số chỗ chất hàng mỗi điểm = số xe chất chồng giờ nhau thường gặp trong data (p75 theo ngày), tối thiểu `truck.docks`; xe sau chờ chỗ trống.
- Tuyến lớn hơn 5 điểm (tuyến gốc) không thử mọi thứ tự ghé.
- Nút "Bật kế hoạch mạng + đổi cỡ xe": bật gói mạng lưới và mọi dòng "Đổi cỡ xe" có lời trong vùng; "Đổi cỡ xe" giờ đi cùng được với tuyến mạng lưới (điểm đó tính theo xe đúng cỡ trên tuyến mới).
- (30/09) Tuyến mạng lưới tự chọn xe đúng cỡ (`tsrc:"fit"`): tiền xe mỗi điểm = min(xe đúng cỡ trên tuyến mới, xe thật + phần chênh do đổi tuyến). Dòng "Đổi cỡ xe" của điểm trong tuyến mạng lưới bị khoá (đã gồm). Gói ghi hai phần: đổi cấu trúc và xe đúng cỡ.

## Cập nhật 30/09 (tối): rà lại COT từng seller
- Sửa lỗi `cotsOf`: seller có giờ đóng cửa trước COT cuối bị mất COT giữa; nay giữ mọi COT có Packed trước giờ đóng cửa, thêm COT cuối = đóng cửa.
- Lượt xe gom theo COT (mỗi chuyến gắn COT theo giờ đi, `cotIdx`) thay cho gom theo khoảng trống 2h (trước đây gộp nhầm 2 COT gần nhau).
- COT "thường bàn giao" = COT có xe ≥ `truck.cotMin`% (mặc định 30%) số ngày có chuyến; số COT mặc định của seller = số COT thường bàn giao.
- Số COT từng ngày (`dayN`) lấy theo chuyến thật: ngày seller không có hàng ở một COT thì không tính lượt đó (không có bàn giao → không có xe/người).
- HN: COT2 17h/21h chỉ cho seller trong vùng cấm tải (`BAN`, đang trống — cần danh sách); còn lại 17h/19h.
- Bảng "COT từng seller" ở bước 1: % ngày có xe theo từng COT, phút đi trễ so với Packed, số COT trung bình/ngày.

## Cập nhật 30/09 (khuya): giờ bàn giao cuối của seller
- COT cuối trong ngày của mỗi seller = giờ bàn giao cuối ngày BAU, ưu tiên: (1) sheet "[D2S] - Thông tin Seller/SPC" cột "Các COT bàn giao" (`HANDOVER`, 86 seller; SPC HN theo giờ mở cửa, đa số 21h); (2) giờ đóng cửa trên deck (`CLOSE`); (3) giờ xe linehaul tới điểm muộn nhất trong ngày, mức `truck.lastP` (90%) số ngày (`lastArr`).
- Sheet khác deck ở 6 seller (dùng sheet): Top Gia HCM 22h (deck 21h), BOX ME Bình Chánh/Bình Tân/Tân Tạo 20h (deck 19h/24h/24h), Cocoon Juno 21h (deck 19h), An Đạt 20h (deck 23h).
- Received của COT sớm hơn giờ xe thật tới thì nhóm người chung chỉ cần sort xong trước giờ xe đi.
- Hệ quả: gốc −1.255 tr (−111 tr, gần hết ở North: nhóm người chung SongLo, NamDinh4 phải xong trước giờ xe đi thật ~17h thay vì 21h30). Kế hoạch mạng (xe/người, tr): North 29/32, South 171/41, HN 477/0, HCM 33/7.

## Cập nhật 30/09 (khuya, 2): nhóm người chung chạy lịch riêng
- Nhóm người chung đi vòng theo lịch riêng, không chờ xe: làm lần lượt theo hạn COT gần nhất, sort xong điểm này mới sang điểm kia (có thời gian đi giữa điểm). Hàng của một COT sort được từ sau lượt xe trước của điểm, không sớm hơn `lab.sortWin` (180) phút trước giờ Packed. Xe tới mà nhóm chưa xong thì xe chờ.
- Số người của nhóm chỉ tăng vì trễ do nhóm gây ra (so với cùng lịch xe khi sort không tốn thời gian); xe đã trễ sẵn thì không đẩy nhóm về người riêng.
- Tuyến xe > 5 điểm thử thêm thứ tự ghé theo giờ xe thật tới (lượt đầu và lượt cuối), trước đây chỉ theo đường đi nên có tuyến bị đảo thứ tự (SongLo).
- Kết quả: gốc −1.085 tr; kế hoạch mạng (xe/người, tr): North 29/63, South 171/45, HN 477/0, HCM 33/12.

## Cập nhật 30/09 (khuya, 3): xe chạy sớm trước giờ đóng cửa, nhịp sort theo năng suất
- COT cuối (giờ seller đóng cửa) là hạn cứng, không nới theo giờ xe đi hiện nay. Các COT khác vẫn nới như cũ.
- Lượt xe có nguy cơ rời điểm sau giờ COT chuẩn thì cả lượt (mọi xe của lượt) chạy sớm hơn, tối đa `truck.shiftMax` (120) phút; mô phỏng lặp tối đa 4 lần.
- Người riêng tại điểm: tổng đơn đã chất lên xe tới giờ t ≤ phần người kịp sort tới t. Số người = làm tròn lên người-ngày sort; năng suất như bảng Năng suất (2.000 đơn lý tưởng, trừ chute/COT/bulky), làm liên tục `lab.prodH` (7) giờ, bắt đầu từ giờ seller mở (`OPENT` theo sheet: giờ mở cửa SPC HN, checkin; không có thì min(`lab.open` 8h, xe tới sớm nhất − 60')). Nhóm chung: thời gian sort cũng theo 7 giờ làm.
- Khi xét ghép xe, nhịp sort tính ở ngày đông (`pdPeak`).
- Kết quả: gốc −1.118 tr; kế hoạch mạng (xe/người, tr): North 67/66, South 288/51, HN 981/0 (cấu trúc 480 + xe đúng cỡ 501), HCM 50/11.

## Cập nhật 30/09: lịch mô phỏng dạng dòng thời gian
- `schedHtml` vẽ SVG thay cho chữ: mỗi hàng một điểm (thứ tự ghé) + hàng "Về SOC", trục ngang là giờ (khoảng không có xe > 60' thu thành khe ≈), mỗi lần xe ghé là khối có số xe (xanh = kịp, cam = sát hạn, đỏ = trễ), nét mảnh nối các điểm của một xe, vạch đứng = hạn COT, vùng gạch = sau giờ đóng cửa, thanh xanh lá = nhóm sort. Lần ghé chồng giờ xếp thành làn nhỏ. Chi tiết (giờ, số đơn, chờ, hạn) khi rê chuột.

## Cập nhật 30/09: chi tiết tuyến/nhóm trong popup
- Thẻ tuyến/nhóm chỉ còn 1 dòng tóm tắt lịch (số xe, số lượt COT, kịp/trễ, chạy sớm) và nút "Chi tiết & kế hoạch linehaul" (`data-nvd`), mở popup qua hệ popup sẵn có (`MR.nvd` → `nvDetail`).
- Popup: ô chỉ số trước → sau (đơn/ngày, chuyến xe/ngày, loại xe, số COT có hàng, người lên hàng, km đi vòng; nhóm người: người/ngày, hub), bảng từng điểm (COT có hàng, giờ bàn giao cuối + nguồn, người hiện nay riêng/chung, xe hiện nay riêng/ghép + loại xe + chuyến/ngày, lời), rồi kế hoạch linehaul tách theo từng COT, mỗi COT một dòng thời gian khung rộng (`schedHtml(...,{W:780,bare:true})`).

## Cập nhật 30/09: nhóm người dễ hiểu hơn + chỉnh tay chia người trong Hub
- Thời gian làm của nhóm người chung và nhịp của người riêng tính theo toàn bộ công việc `w` (sort + quét, bàn giao, chất xe), không chỉ phần sort chia chute. Gốc −1.213 tr (North −87 tr ở các hub dùng chung người); kế hoạch mạng (xe/người, tr): North 67/74, South 288/51, HN 981/0, HCM 50/8.
- Popup nhóm người: khung "Nhóm này làm gì?" (bao nhiêu người, hub nào, điểm nào dùng chung, cách nhóm đi vòng, xe chờ khi nào, trước đây ra sao), "Một ngày của nhóm người" (từng bước: sort ở đâu, đi sang đâu, xe tới lấy lúc nào, chờ nhóm bao lâu), và trên dòng thời gian thêm hàng "Nhóm người" (khối sort có số điểm, nét đứt là đi đường). Điểm chỉ đi cùng xe, không thuộc nhóm, ghi "(đi cùng xe)".
- Chỉnh tay chia người trong một FM Hub (`MR.hubed`, mở từ popup nhóm): mỗi điểm chọn Người riêng / Nhóm A / B / C (`team` của điểm; A = mã nhóm mặc định của hub, B/C = `mã-B`, `mã-C`); bảng ngày bấm từng ô để ghi đè riêng ngày đó (`team` theo ngày, "-" = người riêng). Tính người theo từng ngày theo nhóm của ngày đó (`computeOnce`). Có nút bỏ mọi chỉnh tay của hub. Theo chế độ chỉnh: thử thay đổi (kịch bản) hoặc sửa cho đúng thực tế (vào gốc).

## Cập nhật 30/09: nhóm người chung phải có mặt để chất xe
- Mỗi điểm của nhóm: sort xong mới được chất; khi xe tới nhóm phải có mặt để chất hàng lên xe, xe rời thì nhóm đi tiếp.
- Lịch nhóm lập tham lam theo giờ xe dự kiến (chạy thử không có nhóm): luôn làm việc có xe tới sớm nhất; trong lúc chờ xe, nếu kịp đi sort trước điểm khác rồi quay về trước khi xe tới thì đi (sort trước cả vòng, rồi đi một vòng chất xe). Xe tới muộn hơn dự kiến thì lịch nhóm phía sau lùi theo.
- Popup: "Một ngày của nhóm người" liệt kê sort / chờ xe / chất xe / đi đường theo giờ; hàng "Nhóm người" trên dòng thời gian có khối đậm (sort) và khối nhạt (chất xe).
- Kết quả: gốc −1.300 tr (North −84 tr: nhóm phải có mặt khi xe tới nên cần thêm người); kế hoạch mạng (xe/người, tr): North 67/103, South 288/55, HN 981/0, HCM 50/8.

## Cập nhật 30/09: xe dùng cùng cửa sổ giờ với người
- Xe không còn neo vào giờ tới thật tháng 8: hàng của một COT lấy được từ `openW` (sau lượt xe trước của điểm, sớm nhất `lab.sortWin` phút trước Packed, không trước giờ seller mở) — cùng cửa sổ với nhóm người sort.
- Mỗi xe được kéo tới đúng lúc hàng sẵn (đã sort xong / người riêng sort kịp / nhóm có mặt); xe tới sớm mà phải chờ ở mọi điểm thì lùi xe lại (`PL` theo từng xe, lặp tối đa 6 lần cùng với việc cho chạy sớm khi trễ hạn).
- Popup nhóm: mô phỏng ngày trung bình với số người nhỏ nhất đủ kịp giờ; nếu không kịp dù tăng người thì ghi rõ điểm vướng và nói model tính người riêng những ngày đó.
- Kết quả: gốc −1.251 tr; kế hoạch mạng (xe/người, tr): North 81/86, South 244/43, HN 899/0, HCM 97/8.

## Cập nhật 30/09: so người "trước → sau" đúng phạm vi
- Thẻ/popup nhóm người trước đây lấy cả số người của nhóm cũ (kể cả điểm không vào nhóm mới) để so với nhóm mới. Nay "trước" = phần người của các điểm trong nhóm mới, chia theo đơn (`nvShare`); khung "Trước" ghi rõ nhóm cũ gồm ai, bao nhiêu đơn/người, và phần của các điểm này.
- (30/09) Xe phải chờ ở một điểm (nhóm người chưa sort/chưa tới) thì cho xe tới muộn hơn đúng khoảng chờ, miễn các điểm ghé trước vẫn kịp hạn; chỉ giữ thay đổi nếu không làm trễ thêm (bộ xếp lịch nhóm là tham lam). Gốc −1.259 tr; kế hoạch mạng (xe/người, tr): North 81/76, South 244/43, HN 899/0, HCM 97/8.
- (30/09) Xe được tới sớm và đứng chờ (bỏ việc lùi giờ xe để tránh chờ). Lúc chờ xe, nhóm người xét mọi điểm chưa sort (không chỉ điểm kế tiếp) để sort trước. Gốc −1.236 tr; kế hoạch mạng (xe/người, tr): North 81/65, South 244/43, HN 899/0, HCM 97/8.

## Cập nhật 30/09: giá xe theo vùng, thuê ca 12H, phí chờ theo hợp đồng
- Giá theo vùng `G.vehR` (trung vị bảng giá 7 nhà xe, file "LH ICIR and X-Metro Final Price LH check_1"): [thuê chuyến, thuê ca 12H]. HCM & South = HCM không chạy giờ cấm tải; HN = HN ngoài trung tâm; North = BN ngoài trung tâm; DNCH và 8T giữ giá chung. Chỉnh ở trang cấu hình (bảng "Giá xe theo vùng"). Mọi chỗ tính tiền xe đặt vùng trước khi tính (`PR_R`, `vehP`).
- Thuê ca 12H (trong `truckCost`): điểm/tuyến chạy từ 2 lượt/ngày thì so tiền thuê chuyến với thuê ca (số xe = số xe tối đa trong một lượt) và lấy cách rẻ hơn; tắt bằng `G.truck.ca=false`. Gốc vẫn tính theo chuyến thật; thuê ca đi vào phương án mới (mạng lưới, đổi cỡ xe).
- Phí xe chờ nhóm người: `truck.waitH` 100.000 đ/giờ, tối đa `truck.waitCap` 600.000 đ/điểm/ngày (phí chờ xe 2T trong hợp đồng).
- Kết quả: gốc −955 tr (giá vùng +326 tr so với trước); kế hoạch mạng (xe/người, tr): North 81/64, South 103/43, HN 1.337/0, HCM 197/8. Không có thuê ca: HN 962, HCM 91, South 109.
- Chưa mô phỏng giờ cấm tải.

## Cập nhật 30/09: kế hoạch người & năng lực từng điểm (bằng chứng khả thi của tuyến ghép)
- Popup tuyến xe có phần "Kế hoạch người & năng lực tại từng điểm": số người riêng, ca làm, năng suất (đơn/người/giờ); biểu đồ lũy kế đơn đã sort xong so với đơn xe lấy đi; mỗi lượt xe: hàng sẵn lúc nào, dư/chờ bao lâu, thời gian chất; căn cứ chất xe = công thức đo từ các lần dừng thật + 3 lần dừng thật có số đơn gần nhất (`realStops`).
- Người riêng sort lần lượt từng lượt; hàng của một lượt chỉ có sau lượt xe trước của điểm (hoặc từ giờ mở cửa) — trước đây coi hàng cả ngày có sẵn từ sáng.
- Kế hoạch mạng chỉ nhận nhóm người mới kịp giờ ở ngày trung bình (`teamOk` trong `netSearch`).
- Kết quả: gốc −950 tr; kế hoạch mạng (xe/người, tr): North 81/64, South 103/43, HN 998/0, HCM 136/7.
- Giới hạn: nhóm người được mô hình là một khối đi chung; hub lớn (vd. Thủ Đức 13 người, 7 điểm) không mô hình được việc chia người đứng tại các điểm lớn.

## Cập nhật 30/09: chỉnh tay giờ xe tới + plan dễ thực hiện
- Chỉnh tay giờ xe tới cho từng lượt xe của bất kỳ tuyến/nhóm nào: trong popup, mỗi khung COT có ô "Xe tới <điểm đầu>" (`G.tov[gkey(tuyến)|k]`, lưu trong cấu hình); nút "Tự động" bỏ chỉnh. Lượt chỉnh tay giữ cố định (không kéo sớm/lùi), model tính lại lịch người, tiền chờ, đạt/trễ.
- `lab.oneVisit` (mặc định bật): nhóm người sort xong ở điểm nào thì ở lại chất xe luôn rồi mới đi điểm kế — không đi sort trước điểm khác rồi quay lại.
- Xe có nhóm người được kéo tới sớm theo lúc hàng sẵn ở điểm đầu; xe được chờ nhóm ở điểm sau (có tính tiền chờ), bước lùi xe bỏ qua khoảng chờ không tránh được này.
- Kết quả: gốc −937 tr; kế hoạch mạng (xe/người, tr): North 83/89, South 103/42, HN 998/0, HCM 136/7.

## Cập nhật 30/09: tối ưu thời gian tải (kết quả không đổi)
- Mở trang chỉ tính một lần (trước đây tính 2 lần: lúc khởi động và sau khi nạp trạng thái đã lưu) — `initStore` (GAS) / đuôi artifact chỉ bật trạng thái "đang tính".
- Cache: `cotsOf` (COTC), `cotOfWave` (gắn trên lượt), `openOf` (OPC), danh sách xe theo vùng (VLC), số người nhóm theo nhóm+ngày+số liệu (POOLM); trong mỗi `simRun` nhớ sẵn điểm trong lượt, cửa sổ sort, năng suất, đơn. `computeBase` chỉ xóa kế hoạch mạng sau khi tính gốc (giữ cache mô phỏng). Tất cả xóa trong `netReset` khi đổi cấu hình.
- Thẻ ngưỡng ADO ở bước 2 và bước 3: chỉ tính vùng đang xem (`thrOne`), hiện "đang tính…" rồi điền sau khi trang đã hiện.
- Đo (headless): mở trang 10,1 s → 1,8 s; bước 2: 4,7 s → ~0,05 s (thẻ ngưỡng điền sau ~1–3 s); bước 3 / kế hoạch mạng: ~32 s → ~3,4 s.

## Cập nhật 30/09: hiện trạng trước điều chỉnh trong popup
- Đầu mỗi popup tuyến/nhóm (`nvBefore`): mọi điểm liên quan = điểm của plan + điểm đang đi chung xe/chung người với chúng. Liệt kê tuyến xe hiện nay (X1…: các điểm, loại xe, chuyến/ngày, giờ xe thật tới T8) và nhóm người hiện nay (N1…: hub, người/ngày, từng điểm + đơn), rồi bảng từng điểm: xe trước / người trước → xe sau / người sau (giữ nguyên, tuyến/nhóm mới gồm ai, hay đi riêng). Điểm ngoài plan nhưng bị ảnh hưởng ghi rõ.
- Bảng từng điểm của plan ghi tên các điểm đang chung người / ghép xe thay cho "chung 6 điểm".

## Cập nhật 30/09: mô phỏng lịch không gò 1 cỡ xe + giá theo km của nhà xe
- Mô phỏng lịch (`simRun`) bỏ `simCap` (3.000 đơn/xe cố định): mỗi lượt xe chọn tổ hợp xe rẻ nhất theo `fleet()` (VAN/1T25/1T9/5T/8T theo giá vùng, lấp đầy, tỉ lệ hàng cồng kềnh); mỗi xe của lượt mang loại xe (`J.veh`) và phần đơn (`J.fr` = sức chứa xe / tổng sức chứa lượt). Tooltip và tiêu đề khung COT trong popup ghi loại xe (vd. "2 xe: 2×1T9").
- Giá theo km (bảng "Intra Region by KM" của nhà xe, trung vị các bên, `G.kmT`; `truck.kmMode`, `truck.cityKm` = 30):
  - Điểm/tuyến có điểm xa SOC hơn 30 km (km 1 chiều): giá xe = max(giá chuyến nội thành theo vùng, giá cơ bản theo bậc km + đ/km × km).
  - Tuyến nhiều điểm: cộng đ/km của loại xe (1T9 5.000, 5T 7.600, 8T 12.000; VAN/1T25 quy theo 1T9 × tỉ lệ giá chuyến) × km đi vòng để ghé thêm điểm. Bỏ giả định +10% mỗi điểm và 10.000 đ/km đi vòng.
  - `tripKm(pts)` → `{d0: km 1 chiều từ điểm xa nhất về SOC chính, dt: km đi vòng}` (cache TKM); đặt `PR_K` ở mọi nơi gọi `truckCost`.
- Kết quả: gốc −961 tr; kế hoạch mạng (xe/người, tr): North 126/90, South 123/41, HN 894/0, HCM 129/8 (tắt giá km: North 83/99, South 112/41, HN 1.047/0, HCM 120/8). HN giảm vì các tuyến ghép đang chạy cũng không còn bị cộng 10%/điểm → gốc để so rẻ hơn.

## Cập nhật 30/09: chỉnh người hàng loạt + khóa người riêng
- Modal "Chỉnh người hàng loạt" (`MR.bulkp`, nút ở đầu khối kế hoạch mạng, trong "Hiện trạng trước điều chỉnh" và trong "Chia người trong Hub"): chọn nhiều điểm của vùng (tick từng điểm, tick cả hub, hoặc dán danh sách tên — khớp theo chuỗi con, báo tên không tìm thấy), rồi một thao tác cho tất cả, tính lại một lần (`bulkApply`):
  - Hiện trạng: người riêng / chung nhóm A/B/C (nhóm trong cùng FM Hub của từng điểm) / bỏ chỉnh tay. Chế độ "Sửa cho đúng thực tế" → vào gốc (đổi cả "Hiện trạng trước điều chỉnh"); "Thử thay đổi" → vào kịch bản.
  - 🔒 Khóa người riêng trong kế hoạch (`G.lkeep` theo tên điểm, lưu cấu hình): `netLOk` không ghép điểm khóa; điểm khóa đang chung người được tách khỏi nhóm trước khi tìm kiếm.
- Hub editor có thêm cột "Giữ người riêng"; ví dụ khóa GGGVIETNAM + mojistore: North người 90 → 65 tr.

## Cập nhật 30/09: đổi FM Hub cover
- Hub cover chỉnh tay ưu tiên hơn sheet "1. SPC to SOC" và data (`applyHubMap`, `hSrc="tay"`): `HUBFIX` trong code (đính chính từ vận hành) + `G.hubOv` (đổi trong "Chỉnh người hàng loạt": chọn điểm → "Đổi FM Hub cover", hoặc "Trả hub theo dữ liệu").
- HCMSeller-Shop Me Ca Heo: 50-HCM Thu Duc/Hiep Binh Phuoc → **51-HCM Thu Duc/Binh Chieu Hub**. Trong data chưa có điểm nào khác ở hub 51 nên điểm này dùng người riêng (4,7 tr cả kỳ); hub 50 còn 7 điểm. Gốc −961 → −962 tr; kế hoạch mạng không đổi (HCM 129/8).

## Cập nhật 30/09: "Chỉnh người hàng loạt" dạng cây
- Ba bước đánh số: ① chọn điểm (dán tên) · ② thao tác (khung dính trên cùng khi cuộn; chia 3 nhóm: Người hiện trạng / Kế hoạch mạng / FM Hub; chip các điểm đã chọn, bấm × để bỏ) · ③ danh sách cây FM Hub → nhóm người (chip màu A/B/C, riêng) → điểm, thụt lề theo cấp.
- Hub đóng/mở (▸/▾), "mở tất cả / thu gọn tất cả", "chỉ hiện điểm đã chọn"; hub có điểm đang chọn tự mở. Ô tick ở cấp hub và nhóm (chọn cả cấp; chọn một phần thì hiện nửa tick).
- Mỗi điểm: đơn/ngày, người/ngày, thẻ 🔒 khóa / hub chỉnh tay / nhóm chỉnh tay, và kế hoạch mạng ("giữ nguyên" hoặc "→ nhóm mới N điểm / người riêng", in đậm khi đổi).
- Thẻ tần suất chạy ở mỗi điểm (theo cấu hình chạy D2S của điểm `set.on` = [BAU, Mini CP, CP]): **Daily** (chạy cả ngày BAU), **Mini/CP** (chỉ Mini CP + CP), **CP** (chỉ CP), "Không chạy"; tooltip ghi số ngày có hàng theo loại ngày. Dòng hub đếm số điểm theo tần suất.

## Cập nhật 30/09: bỏ COT xe ghé mà không lấy hàng
- `stT`: COT của seller chỉ giữ khi có xe ≥ `cotMin` % số ngày **và** trung vị đơn/lượt ≥ `truck.cotMinQ` (mặc định 10 đơn) hoặc ≥ 5% đơn/ngày của điểm. Trước đây xe sáng ghé TranHa / Hoang Minh Huan 74–77% số ngày nhưng trung vị 0 đơn vẫn được tính là COT 1 → lịch mô phỏng có lượt chất 1–2 đơn.
- Ảnh hưởng: Hoang Minh Huan, TranHa (North: chỉ còn COT 2), Bibo Mart (HCM: bỏ COT 2, 0 đơn). Kết quả không đổi (gốc −961; North 126/90, South 123/41, HN 894/0, HCM 129/8).
- Số trong ô trên biểu đồ lịch: ô xe = số thứ tự xe trong COT; ô "Nhóm người" = thứ tự điểm nhóm ghé (không phải số đơn; số đơn xem tooltip).

## Cập nhật 30/09: sửa thứ tự việc của nhóm người
- Lỗi: lịch nhóm chọn việc theo giờ xe tới. Khi xe của COT sau bị kéo/lùi sớm (vd. xe COT 2 tới TRUE CARE 12:37 dù hàng chỉ sort được từ 14:22), nhóm chọn việc đó trước, đứng chờ tới 14:22, sort + chất xong mới sang sociollavn → xe COT 1 ở sociollavn chờ từ 12:41 tới 16:08 (trễ +199').
- Sửa (`simRun` → `plan`): xếp lịch nhóm theo 2 cách — theo giờ xe tới, và theo lúc việc làm được thật = max(giờ xe tới, lúc hàng sort xong sớm nhất) — giữ cách có tổng phút trễ ít hơn. sociollavn: nhóm sort 11:00, xe COT 1 rời 12:51–13:01 (hạn 14:00).
- Kết quả toàn mạng không đổi (gốc −961; North 126/90, South 123/41, HN 894/0, HCM 129/8).

## Cập nhật 30/09: rà soát toàn bộ lịch + giờ có hàng / giờ người có mặt
Rà soát tự động mọi tuyến xe (30) và nhóm người (18) trong kế hoạch mạng, 397 lần dừng. Sửa 4 lỗi:
1. **Mọi xe của lượt ghé mọi điểm** (chia đều đơn): điểm nhỏ phải tiếp cả đoàn xe của điểm lớn (vd. xiaomi 160 đơn tiếp 6 xe × 60' chất, 1 chỗ đỗ → MASAN trễ 225'). Nay đơn từng điểm được gán cho xe cụ thể (`J.qi`): điểm nhỏ chỉ lên số xe cần (xe có giờ gần giờ xe thật tới điểm đó), điểm lớn lấp phần còn lại; giờ xe tới theo điểm đầu tiên xe đó ghé.
2. **Nhóm người mới không kịp giờ lọt vào kế hoạch**: bước tách nhóm trong `netSearch` không kiểm lại phần còn lại (vd. nhóm HCM Keyphone… trễ 457'). Nay sau tìm kiếm, nhóm mới nào không kịp thì bỏ dần điểm làm trễ nhiều nhất.
3. **Bước lùi giờ xe (giảm tiền chờ) tạo trễ mới**: chỉ kiểm trễ lớn nhất toàn lịch → xe khác được lùi tới mức trễ đó. Nay kiểm từng xe.
4. **Nhóm mới "không trễ hơn người riêng trong mô hình"** nhưng vẫn trễ hơn thực tế: nay còn phải không trễ hơn trễ thật hiện nay (`realLateOf`).
- Sau sửa: không còn đề xuất mới nào trễ giờ. Còn cờ ở 5 tuyến/nhóm **hiện trạng** giữ nguyên (lịch mô phỏng dùng ngày đông cho tuyến xe; 2 nhóm người hiện nay model coi là không kịp).
- Kết quả: gốc −965; North 137/59, South 205/43, HN 894/0, HCM 183/8 (trước: −961; 126/90, 123/41, 894/0, 129/8).

Giờ có hàng / giờ người có mặt:
- Popup tuyến/nhóm: mỗi COT có bảng "Giờ từng điểm": Có hàng từ (sửa được, `G.rdyOv[điểm|COT]`) · Người có mặt (người riêng: đúng giờ; nhóm: lúc nhóm tới) · Sort · Xe tới · Chất (chờ) · Rời · Hạn · ±. Sort bắt đầu = muộn hơn giữa giờ có hàng và giờ người có mặt.
- Mặc định giờ có hàng: nhóm chung + giờ chất xe = max(mở cửa, lượt xe trước rời, Packed − `lab.sortWin`); người riêng sort từ mở cửa / lượt xe trước. Kiểm với data thật (160 điểm): quy tắc này khớp 129/160 điểm về trễ >30'; áp 3h cho cả người riêng chỉ khớp 109/160 (báo 60 điểm trễ, thực tế 29).
- Độ nhạy theo `sortWin`: 3h → gốc −965; 4h → −927; không giới hạn → −871. `sortWin` hiện trong cấu hình người ("Giả định — chưa xác nhận").

## Cập nhật 30/09: xe điều tới theo yêu cầu
- Vận hành xác nhận: xe được yêu cầu tới lúc nào thì điều tới lúc đó. `truck.onCall` (mặc định bật): bỏ giới hạn chạy sớm `shiftMax` 120'; xe tới điểm đầu đúng lúc bắt đầu chất (bỏ chờ ở điểm đầu, chính xác vì giờ chất/rời/các điểm sau không đổi); bước lùi giờ xe áp cả cho điểm người riêng; bước kiểm từng xe khi lùi giờ: tối đa 12 vòng trả lại riêng xe bị trễ thêm.
- Chia hàng cho xe dùng sức chở thật (không ép bằng tổng đơn), điểm lớn xếp trước, ưu tiên xe còn đủ chỗ cho cả điểm → ít tách điểm (vd. Anh Quan 2.790 đơn lên trọn 1 xe, không còn 87 đơn lên xe Cafe So phải chờ Cafe So sort xong).
- Kết quả: gốc −949 (bớt tiền xe chờ); North 127/56, South 157/43, HN 894/0, HCM 183/8. Không còn đề xuất mới nào trễ; còn cờ ở 6 tuyến/nhóm hiện trạng (3 tuyến HN trễ ngày đông do người riêng sort chưa kịp; 3 nhóm người hiện nay).

## Cập nhật 30/09: volume tháng 8 mới (sheet Detail [Semi] / Bulky [Semi])
- Đọc qua Drive (xuất cả file dạng HTML zip, vì connector chỉ xuất CSV tab đầu và xlsx quá giới hạn): 198 điểm × 31 ngày, đơn (Detail [Semi]) và hàng to (Bulky [Semi]); ghi đè `S[].v`/`S[].b` trong gói dữ liệu của artifact (dòng `const D=` của bản gốc). Bản GAS đọc sheet trực tiếp.
- 19 điểm đổi. Lớn nhất: **HNSPC_56 Thôn Đường Đa 22.292 → 814.982 đơn/tháng** (~26k/ngày; khớp số đơn xe thật lấy ~26.473/ngày trong file linehaul, nên số cũ mới là số sai). 6 điểm HN khác lệch ±1–23 đơn; còn lại chỉnh hàng to.
- Tổng đơn T8: 5.378.568 → 6.171.285. Gốc −949 → **−220** (HN −603 → +126; Thôn Đường Đa −84 → +645: tiết kiệm 1.064, xe 95, người 324 ≈ 20 người/ngày). Kế hoạch: North 127/56, South 157/43, HN 916/0, HCM 183/8 → sau kế hoạch +1.270.
- Đo lại ảnh hưởng từng thành phần trên số mới (trang checkpoint `docs/checkpoint_2026-09-30.html`).

## Cập nhật 30/09: sửa lỗi chỉnh giờ có hàng / giờ xe tới trong popup
- Ô giờ `type=time` bắn "change" ngay khi gõ xong phần giờ → app tính lại và vẽ lại popup giữa lúc gõ, ghi đè phần đang gõ. Trình duyệt dạng 12h (AM/PM) còn giữ PM cũ: gõ 0930 thành 21:30. Nay: ô chữ 24h (`.tin`, `parseHM`: "930", "09:30", "9h30", "21"), bấm vào ô thì xóa để gõ mới (giờ cũ hiện mờ), chỉ áp khi Enter hoặc rời ô (`timeCommit`); giờ không đổi thì không biến thành chỉnh tay; giờ sai định dạng thì trả lại giờ cũ.
- Popup tuyến/nhóm trước đây nhớ theo vị trí thẻ (`NVD[kind][j]`): chỉnh giờ → kế hoạch tính lại, thứ tự thẻ đổi → popup trống hoặc nhảy sang tuyến khác. Nay nhớ theo các điểm (`m.key = gkey(g)`); nếu kế hoạch mới không còn tuyến/nhóm đó thì vẫn hiện lịch của nó theo giờ đã chỉnh, kèm cảnh báo.
- Ô "Có hàng từ" hiện giờ anh nhập; nếu model phải dùng giờ muộn hơn (sau lượt xe trước rời) thì ghi "áp dụng HH:MM".

## Cập nhật 30/09: "giờ có hàng" quyết định giờ sort (cho cả người riêng)
- Trước đây người riêng sort liên tục từ giờ mở cửa; "có hàng từ" (mặc định 3h trước Packed) chỉ chặn giờ xe chất → popup hiện "có hàng 13:43" nhưng "sort 08:00" (vô lý), và tuyến Hukan → TiemTraRumi → Nguyen Lieu → Unie được kéo xe tới 13:43 (sớm 152') chỉ nhờ giả định đó.
- Nay: giờ có hàng của một COT = giờ bắt đầu sort được, cho cả người riêng lẫn nhóm; xe chỉ chất sau khi sort xong.
- Mặc định (khi chưa nhập giờ thật, `lab.rdyData`): theo data của chính điểm = giờ xe thật tới lượt đó − thời gian người riêng sort phần đơn của lượt (đơn điểm × tỉ lệ lượt theo đơn xe thật lấy), không trước giờ mở cửa / xe lượt trước rời. `lab.rdyWin` (mặc định 0 = tắt) thay `lab.sortWin`: nếu đặt thì thêm mốc "sớm nhất X phút trước Packed".
- Kiểm với data thật (160 điểm, lượt hiện nay): theo data điểm khớp 141/160 (báo trễ 26, thực tế 29), giờ xe rời lệch trung vị −9' (tuyệt đối 19'); từ giờ mở cửa: 129/160 nhưng xe rời sớm hơn thực tế 215'; 3h trước Packed: 109/160 (báo trễ 60).
- Kết quả: gốc −317 (North −98: nhóm người Hub cần thêm người vì không sort được từ sáng); kế hoạch North 43/64, South 128/45, HN 403/0, HCM 177/8 → sau kế hoạch +552. Nhiều tuyến ghép trước đây chỉ khả thi nhờ giả định 3h bị loại (HN 916 → 403).
- Độ nhạy: từ giờ mở cửa → +1.509; 3h trước Packed → +50. Giờ có hàng là yếu tố lớn nhất hiện nay.

## Cập nhật 30/09: bảng nhập "Giờ có hàng của seller"
- Nút "Giờ có hàng của seller →" ở đầu khối kế hoạch mạng (và link trong bảng "Giờ từng điểm" của popup tuyến): bảng mọi điểm của vùng × COT (`MR.rdyed`), mỗi ô là giờ bắt đầu ra hàng của COT đó; ô nhập tay viền cam (ưu tiên), ô thường = tự tính từ data (`rdyAuto`: giờ xe thật tới − thời gian sort lượt đó, ngày thường). Lọc theo tên; ↺ trả về tự tính; xóa hết giờ nhập của vùng.
- Dán từ Sheets/Excel (`rdPaste`): mỗi dòng `tên điểm ⇥ giờ COT1 ⇥ giờ COT2…` hoặc `tên điểm ⇥ số COT ⇥ giờ`; tên khớp một phần; báo tên không tìm thấy / giờ sai. "Chép bảng ra" (`rdCopy`) chép TSV giờ hiện dùng để sửa trong Sheets rồi dán lại.
- Giờ nhập lưu trong cấu hình (`G.rdyOv`, theo tên điểm × COT) nên giữ nguyên khi nạp data tháng mới; dùng cho kế hoạch tương lai khi seller đổi giờ ra hàng.

## Cập nhật 01/10: kế hoạch xe và người nhất quán + kiểm tra nhất quán tự động
- Lỗi: tuyến xe và nhóm người tối ưu ở 2 bước. (1) Popup tuyến xe luôn mô phỏng mọi điểm như người riêng, kể cả điểm thuộc nhóm người chung của kế hoạch → "1 người riêng" ở trên nhưng "người sau: giữ nguyên N1" ở dưới. (2) Chỉ nhóm người MỚI được kiểm với tuyến xe mới; nhóm giữ nguyên (vd. N1 5 điểm Tu Son 2) không được kiểm lại dù tuyến xe của điểm trong nhóm đã đổi.
- Sửa: `routeSimPlan(g)` — lịch tuyến xe lấy từ mô phỏng của nhóm người chung trong kế hoạch người (ngày TB) nếu tuyến có điểm thuộc nhóm; phần "Kế hoạch người & năng lực" ghi rõ nhóm, số người, giờ nhóm tới/sort. `netPlan`: nhóm giữ nguyên có điểm đổi tuyến xe cũng phải kịp giờ, không thì tách dần như nhóm mới.
- `planAudit(R)` (nút "✓ nhất quán / ⚠ n lỗi" ở đầu khối kế hoạch mạng, chạy mỗi lần tính): lỗi = bố trí người trong lịch tuyến khác kế hoạch người; tuyến mới trễ hơn cả hiện nay; nhóm người mới không kịp. Lưu ý = hiện trạng giữ nguyên nhưng mô phỏng trễ. Hiện: 0 lỗi mọi vùng; lưu ý North 11, HN 4.

## Cập nhật 01/10: kế hoạch linehaul kèm kế hoạch nhân sự, liên kết chéo tuyến ↔ nhóm
- Popup tuyến xe: mục "Nhân sự thực hiện tuyến này" (từng điểm: người riêng — số người, ca; hoặc nhóm chung — các điểm cùng nhóm, người/ngày, nút "xem kế hoạch nhóm →"). Biểu đồ lịch từng COT có hàng nhân sự: mỗi nhóm người chung một hàng (sort đậm, chất nhạt, nét đứt = đi đường), và thanh xanh mảnh dưới mỗi điểm người riêng = lúc người riêng sort phần đơn của lượt (số = người).
- Popup nhóm người: mục "Tuyến xe gắn liền với nhóm" (từng điểm: xe riêng hoặc tuyến ghép mới/giữ nguyên, nút "xem kế hoạch linehaul →"). Liên kết mở được cả tuyến/nhóm giữ nguyên (popup dựng tại chỗ, `data-nvopen`).
- `simRun` nhận nhiều nhóm người độc lập (`team.teams`): tuyến đi qua điểm của 2 nhóm được mô phỏng chung cả 2 nhóm với toàn bộ việc của từng nhóm (`routeSimPlan`); kiểm tra nhất quán bắt mọi điểm thuộc nhóm mà lịch tuyến coi là người riêng.
- Sửa tiêu đề popup luôn ghi "Tuyến 1/Nhóm 1".

## Cập nhật 01/10: đóng các lỗ nhất quán còn lại (kiểm tra nhất quán báo 1 lỗi bên người dùng)
- `netSearch`: nhóm còn lại sau khi bớt một điểm (tuyến xe hoặc nhóm người) cũng phải đạt `gok`, trừ khi nhóm cũ vốn không đạt. Trước đây chỉ nhóm nhận điểm được kiểm → tuyến còn lại có thể không kịp (vd. GULU FOODS → KhoBim 3Mien → TopGia MienBac trong cấu hình người dùng).
- `routeTimeOk`: tuyến các điểm đang đi chung chuyến thật chỉ được nhận nếu mô phỏng không trễ hơn hiện nay (cùng luật với kiểm tra nhất quán).
- Sau khi có cả kế hoạch xe và người: tuyến xe MỚI được kiểm với đúng bố trí người của kế hoạch (nhiều nhóm cùng lúc); không kịp thì các điểm của tuyến rời nhóm chung (vd. Cross kho 24 → Hannah-Seyo → MASAN).
- `simRun`: (1) người riêng sort theo thứ tự COT, tính sẵn (`thrM`) — trước đây theo thứ tự xe được xử lý: xe COT1 bị lùi sau xe COT2 thì hàng COT1 sort sau, xe chờ, bị lùi tiếp (Song Lo: xe COT1 NongSan3Mien bị lùi 521' tới 17:47). (2) Chỗ chất hàng theo khung giờ (khe trống sớm nhất), không xếp hàng theo thứ tự xử lý. (3) Chỉ cho cả lượt chạy sớm khi chính xe là nút thắt (không chờ hàng/người/chỗ ở điểm trễ hoặc trước đó) — trước đây với xe theo yêu cầu, lượt bị đẩy sớm 706' vô ích.
- Kiểm với data thật: vẫn khớp 141/160, giờ xe rời lệch trung vị −10'. Kết quả: gốc −332; North 43/65, South 105/41, HN 482/0, HCM 177/8. Kiểm tra nhất quán: 0 lỗi mọi vùng; lưu ý North 11, HN 4 (tuyến/nhóm giữ nguyên; phần lớn là ngày đông, 2 chỗ mô phỏng lệch xa thực tế: KhoPhiHung → Si Le và nhóm GaoChungTri).

## Cập nhật 01/10: ghép chuyến = ghép trọn
- Vận hành xác nhận: tuyến ghép phải chở hết hàng của các điểm ghép, mọi xe của tuyến ghé tất cả các điểm (không "ghép nửa vời": xe đầy hàng một điểm đi thẳng + xe gom phần lẻ). `truck.fullGhep` (mặc định bật): mỗi điểm chia hàng cho mọi xe của lượt theo sức chở; tiền đi vòng tính cho mọi xe (`PR_DS`=1). Tắt thì về kiểu dùng chung đội xe (điểm lớn lên trọn xe, chỉ gom phần lẻ; tiền đi vòng chỉ cho phần xe ghép ước tính `PR_DS`).
- Hiển thị: thẻ tuyến ghi "Ghép trọn: n xe/ngày đông, xe nào cũng ghé đủ k điểm" (hoặc số xe đi thẳng / xe ghép nếu tắt); đầu mỗi COT trong popup liệt kê xe đi thẳng / xe ghép.
- Cụm MASAN + xiaomi + Cross kho 24 + Hannah-Seyo (5/7 xe mỗi COT đi thẳng MASAN) không còn được đề xuất.
- Kết quả: gốc −335; North 43/66, South 76/41, HN 571/0, HCM 129/8 → sau kế hoạch +599. Kiểm tra nhất quán 0 lỗi; khớp data thật 141/160.

## Cập nhật 01/10: SOC thiếu + tiết kiệm ảo của điểm đã đi chung xe; vạch nhân sự thống nhất
- Gói dữ liệu artifact thiếu SOC cho 16 điểm (chuyến của các điểm này có ghé FM Hub trên đường về SOC). `fillSoc`: điểm thiếu SOC lấy SOC mà chuyến xe thật giao tới nhiều nhất (14/16 điểm; 2 điểm không có chuyến tới SOC). Ảnh hưởng: luật ghép cùng SOC, giá theo km, SOC trên thẻ/popup.
- Gia dung Duc Hi + Gia dung Thao Van ngày nào cũng lên cùng một xe 5T chạy vòng FM Hub (Chợ Mới 02 → Chợ Mới → SW SOC), nhưng cấu hình ghi "đi riêng" → kế hoạch đề xuất "tuyến mới" và tính tiết kiệm ảo. Sửa: `netTBase` coi các điểm "đi riêng" mà đi chung chuyến thật ≥80% số ngày (cùng SOC) là đang đi chung; `netTC` giữ tiền xe thật cho nhóm như vậy.
- Biểu đồ lịch popup tuyến: mỗi điểm có một vạch nhân sự cố định ở đáy hàng (người riêng: lúc sort phần đơn từng xe, số người ghi một lần; nhóm chung: lúc nhóm sort ở điểm), thay cho thanh rải theo làn xe. Dòng mô tả xe gộp xe giống nhau ("xe nào cũng ghé: …").
- Kết quả: gốc −335; North 28/66, South 79/41, HN 571/0, HCM 129/8 → sau kế hoạch +518. Kiểm tra nhất quán 0 lỗi.

## Cập nhật 01/10: thay đổi bắt buộc được tính tiền và giải thích
- `netPacks` trước đây bỏ mọi gói có lợi cấu trúc ≤ 0 (`filter(p=>p.gm>0)`). Các thay đổi do luật khả thi ép (tách nhóm người không còn kịp giờ với tuyến xe mới, điểm rời nhóm cho tuyến mới kịp giờ) vẫn nằm trong kế hoạch nhưng không có gói → thẻ hiện "–" và tiền tăng không được trừ vào tổng. Nay giữ mọi gói; gói không tiết kiệm đánh dấu `forced` (bắt buộc), tiền tính vào tổng.
- Thẻ tuyến/nhóm của gói bắt buộc ghi "Thay đổi bắt buộc, không phải để tiết kiệm…" + tiền tốn thêm. Nhóm/tuyến bị giải tán (mọi điểm về người riêng/đi riêng) có ô riêng (`nvSplitNote`) trong cả hai tab, khớp với cầu lãi/lỗ (trước đây tab người ghi "Không có nhóm người nào đổi" trong khi cầu có "Tách … −2,1").
- Hiện có 2 gói bắt buộc (North, nhóm người): tách Bim BabyCare · ShopDienMay · ChiNhanhMacDinh (−2,1 tr) và nhóm Song Lo 9 điểm (−2,6 tr). Kết quả: gốc −335; North 28/61, South 79/41, HN 571/0, HCM 129/8 → sau kế hoạch +513.

## Cập nhật 01/10: GÓI KẾ HOẠCH (tuyến xe + nhóm người), nhãn Compulsory / Nice-to-have
- View mặc định của khối kế hoạch mạng: "Gói kế hoạch (xe + người)" (`nvPackCards`); hai tab cũ thành "Chi tiết tuyến xe" / "Chi tiết nhóm người".
- `netPlan` → `P.up`: gộp gói xe (`tp`) và gói người (`lp`) có điểm chung. Mỗi phần gắn nhãn:
  - **Bắt buộc · Compulsory**: thay đổi bị ép để kế hoạch khả thi — gói không tự tiết kiệm (`forced`), hoặc nhóm người cũ có điểm đổi tuyến xe và không còn kịp giờ với tuyến mới (`dep`, kể cả khi tự nó cũng có lợi), hoặc sửa chỗ hiện trạng đang trễ (`why=late`).
  - **Nên làm · Nice-to-have**: tự có lợi, làm hay không tùy chọn.
  - Nhãn cả gói: "Cần làm cả tuyến xe + nhóm người" / "Tuyến xe và nhóm người làm riêng được" / "Chỉ cần đổi tuyến xe" / "Chỉ cần đổi nhóm người" / "Sửa chỗ hiện đang trễ".
- Một công tắc bật/tắt cả gói (mọi phần). Mỗi phần có link "xem →" mở popup tuyến/nhóm.
- Kiểm tra nhất quán thêm: tổng các gói = tổng kế hoạch; mọi thay đổi trong kế hoạch nằm trong một gói. Hiện: North 7 gói, South 5, HN 3, HCM 3; tổng khớp mọi vùng; 0 lỗi.

## Cập nhật: mỗi gói luôn có lõi bắt buộc
- Quy tắc gắn nhãn trong `netPlan` (P.up): nếu gói có phần phụ thuộc tuyến xe (`dep`) hoặc phần buộc phải sửa (`forced`) thì mọi phần đều **Bắt buộc**. Nếu không, phần có lợi lớn nhất là **lõi** (Bắt buộc, `core`), các phần còn lại là **Nên làm**.
- `gMust` = lợi của phần bắt buộc; `mustIds` = id của phần bắt buộc. Công tắc gói bật mustIds (tắt gói thì tắt hết). Mỗi phần "Nên làm" có công tắc riêng (`data-togit`); bật nó sẽ bật kèm lõi (`data-req`).
- Thẻ: kiểu "Lõi + phần gắn thêm" hiện "phần bắt buộc · cả gói". Lõi chỉ ghi "Lõi của gói."; lý do "phải đổi theo" chỉ hiện cho phần `forced`.
- Kiểm tra: mọi vùng đều 0 gói thiếu phần bắt buộc; planAudit 0 lỗi.

## Cập nhật: kiểm chứng gói độc lập, số trên thẻ gói là số thật
- Kiểm tra: không gói nào có điểm chung với gói khác. Bật từng gói riêng rồi cộng lại = bật tất cả một lần (North 83,4 · South 112,7 · HN 570,5 · HCM 136,8 tr). Lợi của một gói không đổi khi các gói khác đang bật hay tắt.
- planAudit thêm lỗi "các gói không độc lập" khi tổng từng gói (tính lại cả mạng) ≠ netVerify(R).
- Số trên thẻ gói/phần trước đây lấy từ mô hình (netTC/netLC), có chỗ lệch so với kịch bản thật: North Gói "Nguyen Lieu Pha Che + TiemTraRumi" ghi +12,4 nhưng thật +5,7, trong đó tuyến xe "nên làm" ghi +6,2 nhưng thật chỉ +0,8.
  - Nay `netPlan` tính lại bằng `netWith` (computeOnce cả mạng):
    - `u.g` = cả gói; `u.gMust` = phần bắt buộc;
    - `it.gr`: với phần bắt buộc là phần đóng góp, với phần nên làm là lợi THÊM khi bật kèm lõi;
    - `weak` nếu ≤ 0,5 tr.
  - Số mô hình giữ ở `gModel`.
  - Lõi được chọn lại theo lợi thật khi bật một mình.
- netTC: chỉ giữ tiền xe thật ("đi chung ≥80% ngày") khi chuyến thật không chở thêm điểm ngoài nhóm. Nếu một điểm rời chuyến, tiền xe chia cho ít điểm hơn nên không giữ nguyên được.
- Phần "nên làm" có lợi thêm thật ≤ 0,5 tr/kỳ (minG) không còn được đề xuất mà bị BỎ khỏi kế hoạch:
  - trả các tuyến/nhóm cắt về như hiện nay (T1/L1, tp/lp, NET.t1of);
  - gói tính lại `ids`/`g`/`pts`/`need`;
  - thẻ ghi "Đã cân nhắc và bỏ: … bật kèm chỉ x tr/kỳ".
  - Kiểm bằng ngưỡng 1 tr: North bỏ tuyến Hukan + MoonBook; planAudit 0 lỗi, các gói vẫn độc lập.

## Cập nhật: chi tiết tuyến/nhóm chia lớp + chỉnh giờ đóng cửa
- `nvDetail` chia 2 lớp:
  - **Lớp 1 – tóm tắt:** một câu kết luận (gom mấy điểm, chuyến/xe hoặc người trước → sau), huy hiệu trạng thái giờ (kịp mọi COT / sát hạn / trễ), và 5 số chính.
  - **Lớp 2 – tab** (`ui.nvdTab`; đổi tab chỉ ẩn/hiện DOM, không tính lại):
    - Lịch chạy: kế hoạch linehaul theo COT. Bảng giờ từng điểm gập lại, mở/đóng nhớ ở `ui.stOpen`.
    - Điểm & giờ: bảng điểm, có ô chỉnh giờ đóng cửa.
    - Nhân sự: với tuyến là nhân sự + năng lực từng điểm; với nhóm là "Nhóm làm gì", tuyến gắn liền và một ngày của nhóm.
    - Trước điều chỉnh: nvBefore.
- Giờ đóng cửa / bàn giao cuối nhập tay: `G.closeOv["tên điểm"]` (phút), ưu tiên hơn sheet/deck/xe muộn nhất.
  - `closeOf` trả `src:"tay"`.
  - Ô nhập `closeInp(i)` (`data-cls`, commit qua `timeCommit`; ↺ `data-clsx` trả về mặc định) có ở tab "Điểm & giờ" và cột "Đóng cửa" trong bảng giờ seller (MR.rdyed).
  - Đổi giờ thì COT cuối = giờ mới và kế hoạch tính lại.

## Cập nhật: sửa lỗi tổng gói khi bỏ phần "nên làm" + hiện tiền đi vòng
- Lỗi kiểm tra "tổng các gói ≠ tổng kế hoạch" (South, có từ v58): khi bỏ một phần "nên làm", `u.gModel` chưa trừ phần đó. Nay tính lại `u.gModel` theo các phần còn lại.
- Biểu đồ trước → sau:
  - dòng Km đi vòng/ngày ghi thêm tiền đi vòng trước → sau (`vehMix(g).kmc` = Σ kmS của truckCost, nay truyền routeKm);
  - thêm dòng "Tiền xe (tr/kỳ)" (Σ netTC, đã gồm đi vòng).
- HN mặc định: km 42 → 145/ngày, tiền đi vòng 5,3 → 24 tr/kỳ; tiền xe 2.617,8 → 2.047,1 tr/kỳ; chuyến 116,5 → 93,4/ngày.

## Cập nhật: popup tuyến/nhóm bị tách ghi đúng là "hiện nay · kế hoạch tách"
- Trước đây, link "xem hiện nay" của một nhóm/tuyến mà kế hoạch tách ra mở popup có nhãn "giữ nguyên" và mô tả như nhóm vẫn chung người. Lý do: popup chỉ xét "có trong hiện trạng" mà không xét "có trong kế hoạch sau".
- Nay `data-nvopen` xét cả T1/L1:
  - mới / giữ nguyên / **hiện nay · kế hoạch tách**;
  - `D.x.split` = nơi các điểm đi sau khi tách.
- Tóm tắt trong popup ghi: "Đây là nhóm HIỆN NAY. Kế hoạch tách: … → người riêng; người/ngày a → b". Nhãn giờ thêm "nếu giữ nguyên:". Link trên thẻ gói đổi thành "xem vì sao tách →".

## Cập nhật: lịch chạy Trước / Sau trong popup, gộp tab
- Popup tuyến/nhóm chỉ còn 2 tab:
  - **Lịch chạy**: có nút Trước / Sau (`ui.nvdBA`), mỗi nút kèm trạng thái giờ;
  - **Điểm & hiện trạng**: bảng điểm (chỉnh giờ đóng cửa) + nvBefore.
- "Nhân sự / Nhóm làm gì" nằm trong ô gập `.nvd-more` (`ui.nvMore`) dưới lịch Sau. Với nhóm người còn có "Một ngày của nhóm".
- `nvSimWith(focus,Ts,Ls)`: mô phỏng ngày trung bình cho một bố trí tuyến/nhóm bất kỳ.
  - Lấy cả tuyến và cả nhóm dính tới điểm; người/nhóm = teamSim(t).h.
- TRƯỚC = nếu KHÔNG làm thay đổi này: thay các nhóm/tuyến kế hoạch của các điểm bằng nhóm/tuyến cũ (T0/L0), phần còn lại theo kế hoạch.
  - Với nhóm bị tách thì TRƯỚC = giữ nhóm.
  - SAU = theo kế hoạch.
- `nvCotSecs(sim,o)`: khối COT tách ra từ nvDetail. Chỉ lịch Sau của tuyến/nhóm mới có ô chỉnh giờ xe (`o.edit`).
- Ví dụ South, Masan + Gooby: giữ nhóm trễ +188', tách → kịp, dư 14'.

## Cập nhật: lịch một ngày của nhóm người — không mất điểm, nói rõ lúc chờ, bỏ lỗi "lùi xe" làm nhóm đứng không
- Lịch "Trước" (nvSimWith) trước đây chỉ giữ các lượt có điểm đang xem, nên mất việc của nhóm ở điểm khác. Ví dụ nhóm 6 điểm cũ mất HAPAS / BOXME, trông như nhóm đi 16' mà 1,5h sau mới sort.
  - Nay có `rowsT` = mọi lượt có điểm của các nhóm dính tới điểm đang xem; dùng cho biểu đồ nhóm và "Một ngày của nhóm".
- teamDay: khoảng trống của nhóm ghi rõ lý do: "chờ hàng của X sẵn (seller có hàng từ hh:mm) · n phút", hoặc "chờ xe tới". Chờ ≥ 30' tô màu cảnh báo.
- simRun:
  - Bước cuối "lùi giờ xe cho khớp lúc hàng sẵn" giữ lịch nhóm cố định nên có thể đổi thứ tự việc của nhóm. Hệ quả là xe khác chờ tới 2h (South sociolla: xe tới 16:50 mà 18:43 mới chất), vẫn được nhận vì không trễ COT. Nay chỉ nhận khi tổng phút xe chờ giảm và nhóm không đứng không nhiều hơn (`idleOf`).
  - `plan` xếp lại lịch nhóm theo giờ xe tới thật của lịch vừa có (tối đa 3 vòng).
- Kết quả không đổi: kế hoạch, kiểm tra nhất quán, kiểm chứng với thực tế (141/160). Nhóm South không còn phút đứng không.

## Cập nhật: kiểm TRƯỚC / SAU mọi đề xuất, bỏ thay đổi bắt buộc không sửa được giờ
- Trong `netPlan`, sau khi có tp/lp, mỗi gói được tính `lateB` / `lateA` = trễ lớn nhất (ngày TB) khi không làm / khi làm, bằng nvSimWith, cùng cách với popup.
- Gói **bắt buộc** (forced, không tự tiết kiệm) mà không bớt trễ được ≥ 5' thì BỎ, giữ tuyến/nhóm như hiện nay. Danh sách bỏ lưu ở `NET.rev[R]`.
  - North bỏ 2 gói: tách nhóm Song Lo 9 điểm (119' → 125', trễ do chính xe 8T ghé 9 điểm chứ không do người) và tách Bim BabyCare + ChiNhanhMacDinh + ShopDienMay (20' → 20').
  - Kế hoạch North +82,7 → +87,4 tr (không còn trả 4,1 tr cho hai thay đổi vô ích). Hai nhóm này thành "lưu ý": hiện nay đã trễ.
- planAudit thêm 2 lỗi:
  - thay đổi bắt buộc không bớt trễ;
  - làm rồi trễ hơn cả khi không làm lẫn thực tế (`lateA > max(lateB, realLate, 0) + tol`).
- Thẻ gói: mỗi phần ghi "Giờ ngày TB: không làm … → làm …".
