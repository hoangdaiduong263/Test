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
