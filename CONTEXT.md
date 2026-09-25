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
