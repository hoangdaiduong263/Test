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
- Mỗi COT: FMHub_received (FTE nhận/sort xong) và FMLH_Packed (giao linehaul). HCM 13/14h, 17/18h, 23/24h; North & Central 13/14h, 21h30/22h30 (North gần HY chỉ COT 2); South 13/14h, 20h30/21h30; HN 13/14h, 17/19h (hoặc 17/21h vùng cấm tải), 23/24h. COT cuối: Packed = giờ seller đóng cửa, Received = đóng cửa − 1h (có giờ đóng cửa BAU của 6 seller HCM/South).
- Lượt xe hiện nay gắn vào COT sớm nhất có Packed không trước giờ xe đi quá 45 phút; hạn = max(Packed, giờ xe đi hiện nay).
- Đạt khi xe rời mỗi điểm trước hạn Packed; nhóm người chung còn phải sort xong trước Received (`truck.cotTol` = phút được trễ, mặc định 0).
- Kết quả (tháng 8): gốc −1.124 tr (47/368 ngày-nhóm chung phải thêm người); tối ưu mạng: North +112, South +127, HN +176, HCM +15 tr.

## Cập nhật 30/09: thời gian dừng theo volume, ngày đông, chỗ chất hàng
- Thời gian dừng một xe = phần cố định + phút/đơn × số đơn xe lấy, ước lượng Theil–Sen trên các lần dừng thật của từng điểm (`fitDwell`); thiếu data thì dùng trung vị toàn mạng (~10 phút + 5 phút/100 đơn).
- Tuyến ghép được kiểm ở ngày đông: đơn/ngày phân vị `truck.peakP` (mặc định p90) của từng điểm; nhóm người vẫn kiểm theo đơn từng ngày.
- Số chỗ chất hàng mỗi điểm = số xe chất chồng giờ nhau thường gặp trong data (p75 theo ngày), tối thiểu `truck.docks`; xe sau chờ chỗ trống.
- Tuyến lớn hơn 5 điểm (tuyến gốc) không thử mọi thứ tự ghé.
- Nút "Bật kế hoạch mạng + đổi cỡ xe": bật gói mạng lưới và mọi dòng "Đổi cỡ xe" có lời trong vùng; "Đổi cỡ xe" giờ đi cùng được với tuyến mạng lưới (điểm đó tính theo xe đúng cỡ trên tuyến mới).
