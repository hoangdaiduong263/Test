# D2S Network Optimizer — thiết kế

**Mục tiêu:** chứng minh mạng D2S còn dư địa tối ưu. Cách làm: một bậc thang tiết kiệm, đi từ **as-is đã kiểm định** tới **to-be khả thi**. Mỗi bậc giải thích được và qua bộ lọc vận hành.

## Nguyên tắc
1. **As-is bám data.** Có data thì dùng nguyên, thiếu thì giả định có gắn nhãn. Không sửa data gốc.
2. **To-be là các đòn bẩy có tên.** Mỗi đòn bẩy bật/tắt và chỉnh được, không đụng vào dữ liệu gốc.
3. **Nhà máy nhiều dây chuyền.** Mỗi dây chuyền làm một việc, nhận và giao "phiếu" dữ liệu cố định. Dây sau không tính lại việc của dây trước.
4. **Một mô phỏng sự kiện duy nhất.** KPI, tồn, live, Lịch xe, đường cong SOC đều đọc cùng một nhật ký sự kiện.
5. **Mỗi con số có nhãn nguồn:** `data` · `giả định` · `chỉnh tay` · `đòn bẩy`.

## Thứ tự ưu tiên ràng buộc
| # | Mốc | Vai trò |
|---|---|---|
| 1 | **COT Pickup Ontime** (FLM) | **Cứng.** Xe rời seller ≤ mốc, 100% lượt |
| 2 | COT Outbound D2S | Mềm. Giờ SOC nhận → đường cong SOC nhận hàng theo giờ → người ở SOC |
| 2 | Giờ đóng của seller | Cứng cho ca người và giờ xe (sau giờ này seller không bàn giao) |
| 3 | Giờ và lưu lượng bàn giao trong ngày | Đầu vào: đơn sẵn lúc nào |

Đơn bàn giao sau mốc pickup thì thuộc mốc sau, tức là "dồn". Model đếm số đơn dồn và cộng thật vào lượt sau.

## Dây chuyền
| # | Dây chuyền | Nhận | Giao ra |
|---|---|---|---|
| 0 | Dữ liệu & kiểm định | Data gốc (chỉ đọc), bảng giả định | Bộ dữ liệu as-is có nhãn nguồn; **cổng kiểm định**: mô phỏng as-is phải ra lại thực tế trong sai số cho phép |
| 1 | Plan linehaul | Nhu cầu, mạng lưới, giá xe | Top-K phương án: tuyến, lượt theo mốc pickup, số xe và cách chia xe trong lượt, cỡ xe, khung giờ |
| 2 | Plan HC | Mỗi phương án linehaul, đường bàn giao | Plan HC rẻ nhất cho phương án đó: loại người (FTE riêng / nhóm FM Hub / PPS), số người, ca, người SOC |
| 3 | Bộ lọc | Cặp linehaul + HC | Đạt/không kèm lý do; điểm phức tạp. Không đạt thì quay về dây 1 |
| 4 | Live & thử thách | Phương án đã qua lọc | Mô phỏng sự kiện từng ngày, phát lại; "thử chỉnh": mọi chỉnh tay hiện chênh lệch tiền và KPI so với phương án của model; cận dưới lý thuyết |

## Dữ liệu
| Bảng | Nguồn | Khi chưa có |
|---|---|---|
| COT Pickup Ontime theo vùng/hub | FLM | **Cần bạn cung cấp** |
| Volume ngày × seller × mốc pickup | BI (đang xin) | Suy từ chuyến xe thật, nhãn `giả định` |
| COT Outbound D2S (khung nhận đơn → Packed) | Đã có (HN) | Theo vùng |
| Giờ đóng/mở của seller | Sheet seller | Giờ xe tới muộn nhất (p90), nhãn `giả định` |
| Đường bàn giao trong ngày | Cộng dồn số đơn lên xe theo giờ ở mọi lần dừng thật = mức tối thiểu đã bàn giao | Phân đều trong khung, nhãn `giả định` |
| Chuyến xe, giá xe, toạ độ, năng suất | Đã có | |

## Phạm vi tiền
**Đưa vào mô phỏng:**
- tiền xe linehaul;
- người tại seller (FTE riêng, nhóm FM Hub, PPS);
- người ở SOC;
- tiền rider / FM Hub tiết kiệm được nhờ D2S.

**Đề xuất, chờ duyệt (chưa đưa vào mô phỏng):**
- tiền xe chờ theo hợp đồng nhà xe (100k/giờ, tối đa 600k/điểm/ngày);
- chuyến adhoc khi vượt sức chứa;
- tăng ca / phụ cấp ca tối;
- SOC sort lại khi seller chia ít chute hơn luồng chuẩn;
- phí thuê thêm xe khi chia xe trong lượt;
- chi phí trễ SLA (nếu có quy đổi).

## Bộ lọc độ phức tạp (dây chuyền 3)
Mỗi ngưỡng là tham số:
- Một lượt xe ghé **> 5 điểm** thì loại.
- Người làm **gần 100% công suất**, không còn buffer, thì loại. Mặc định dùng tối đa 85% giờ làm.
- **Ping-pong:**
  - xe hoặc nhóm người quay lại một điểm đã ghé trong cùng khung giờ;
  - lịch đổi qua lại giữa các điểm liên tục.

  Tình huống này bị loại hoặc phạt điểm.
- Báo kèm số seller bị đổi so với hiện nay, và số nhóm hub.

## Lộ trình
1. **Dây chuyền 0 + mô phỏng sự kiện duy nhất.** Chạy mọi ngày trong kỳ; cổng kiểm định as-is theo vùng.
2. **Dây chuyền 1–2 trên bộ khung mới:** mốc pickup là lượt, chia xe trong lượt, ca người, người SOC.
3. **Dây chuyền 3:** bộ lọc khả thi và độ phức tạp.
4. **Dây chuyền 4:** live mọi ngày, chế độ thử chỉnh, cận dưới.
5. Nạp volume theo mốc pickup từ BI khi có.

## Trạng thái
- **Dây chuyền 0 — đã có** (`calib.js`, tab "0 · Dữ liệu & kiểm định as-is"):
  - Tiền xe và số chuyến: model dựng lại tuyến hiện nay cho từng ngày, so với chuyến thật.
  - Vật lý mô phỏng: phát lại từng chuyến thật (giờ tới điểm đầu thật), so giờ rời từng điểm và giờ tới SOC. Thời gian chạy lấy trung vị thật theo cặp điểm và từ điểm về SOC; thiếu thì dùng tốc độ trung vị của vùng.
  - Bảng nguồn dữ liệu: data / giả định.
  - "Dư địa thấy ngay": tỷ lệ lần dừng xe đứng chờ quá 30 phút ngoài thời gian chất.
  - Ngưỡng: tiền ±5%, ≥ 80% lần dừng lệch ≤ 15'.
