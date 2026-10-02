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
- người tại seller: chỉ FTE riêng và FTE chung (nhóm FM Hub). Rider PPS tạm chưa đưa vào model; code còn giữ, bật bằng `pps = 1`.
- người ở SOC;
- tiền rider / FM Hub tiết kiệm được nhờ D2S.

**Đề xuất, chờ duyệt (chưa đưa vào mô phỏng):**
- tiền xe chờ theo hợp đồng nhà xe (100k/giờ, tối đa 600k/điểm/ngày);
- chuyến adhoc khi vượt sức chứa;
- tăng ca / phụ cấp ca tối;
- SOC sort lại khi seller chia ít chute hơn luồng chuẩn;
- phí thuê thêm xe khi chia xe trong lượt;
- chi phí trễ SLA (nếu có quy đổi).
- phụ phí xe trả nhiều SOC (`dropSur`, trước đây mặc định +10%/SOC, nay tắt).

## Người
- **FTE riêng:** số người = khối việc ngày đông (p90) ÷ 7 giờ, tức đã làm 100% công suất. Không bớt thêm được; bộ lọc ≤ 85% sẽ còn đòi thêm người.
- **FTE chung:** nhóm người của một FM Hub đi nhiều điểm D2S cùng hub.
  - Cần ≥ 2 điểm (`minTeam`).
  - Các điểm cách nhau ≤ 15 km.
  - Mỗi người: làm + đi lại ≤ 7 giờ.
  - Mọi tuyến xe vẫn kịp COT.
  - Chỉ gom khi rẻ hơn FTE riêng.
- **Có người mới lên hàng được:** nhóm FTE chung ở lại điểm tới khi xe lên hàng xong và rời, rồi mới đi điểm sau.
  - Mô phỏng nhóm và mô phỏng xe chạy đan nhau, lặp tới khi giờ khớp (`teamSim`). Có một vòng chốt cuối cho mọi nhóm cùng lúc.
  - Đã kiểm: 0 chặng nhóm rời trước xe, 0 chặng xe lên hàng trước khi nhóm tới.
- **Bảng "FM Hub cover ≥ 2 điểm"** trên trang ghi điểm nào vào nhóm, điểm nào không và vì sao.
- **Chỉnh tay** (hạn, giờ có hàng, số người, giờ xe) lưu trên trình duyệt và áp cho mọi lần mở trang. Có dải báo kèm nút "Bỏ tất cả chỉnh tay". Điểm chỉnh số người bị giữ FTE riêng.

## Live
Chạy từng tuyến đề xuất riêng. Thẻ "Tuyến 1…n" ở đầu khung live để chuyển tuyến; mỗi tuyến trong bảng gói có nút ▶ riêng.

**Mô phỏng toàn vùng** (nút "▶ Mô phỏng toàn vùng" ở bảng gói; chọn vùng bằng thẻ vùng trên cùng, đổi vùng thì mở lại cho vùng mới):
- **Hai chế độ:** "Kế hoạch" và "Hiện nay".
- **Bản đồ:** mọi tuyến xe và mọi nhóm FTE chung; phóng / thu / kéo được. Tên điểm không có chỗ thì ẩn (rê chuột để xem, phóng to để hiện).
- **Dải thời gian:** mỗi nhóm một dải, tồn hàng gom theo tuyến.
- **Dải số liệu:** nhóm đang đi đường / sort / ở lại cho xe / chờ hàng.
- **Chỉ để xem:** muốn chỉnh tay thì mở live từng tuyến.

**Live theo nhóm FTE chung** (nút ▶ ở bảng nhóm và bảng FM Hub):
- **Bản đồ:** nhóm di chuyển từ điểm sang điểm, kèm mọi tuyến xe có điểm của nhóm.
  - Biểu tượng người luôn hiện: đứng ở điểm khi chờ / sort, chạy dọc đường nét đứt khi di chuyển.
  - Bản đồ phóng vào các điểm của nhóm.
  - Khi nhóm đang đi đường, tốc độ phát tự chậm lại còn tối đa 3 phút/giây.
- **Lịch nhóm:** từng chặng gồm di chuyển, sort, giờ xe tới/rời, hạn COT.
- **Dải thời gian của nhóm:** chung trục giờ với biểu đồ tồn. Màu xám là di chuyển, màu xanh là sort, ▼ là giờ xe rời điểm (đỏ nếu trễ).

Thời gian di chuyển của nhóm = km ÷ `hubSpd` (40 km/h). Nhóm đi theo hạn COT sớm nhất trước; giờ sort xong = giờ hàng sẵn cho xe.

## Bước 1 · Kiểm chứng tuyến ghép (đã làm)
Chi tiết ở `core/experiments/README.md`.
- **Phát hiện:** model đoán tuyến chưa từng chạy rẻ hơn thật 8–19%, vì tuyến ghép ngoài đời vẫn cho xe tới nhiều lượt và chở chưa đầy.
- **Cách báo tiết kiệm:** luôn kèm khoảng thận trọng (`newPen` 8% và 19%).
- **Kết quả 48 ngày:** 2,85 tỷ (27%) theo model, 2,43 tỷ (23%) và 1,90 tỷ (18%) khi thận trọng.
- **Còn mở:** làm sao cho tuyến ghép đạt hiệu quả của model (gom lượt, xe đầy hơn). Đây là đòn bẩy vận hành riêng, cần dây chuyền 2 (mô phỏng theo từng ngày) chứng minh khả thi.

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
- **Dây chuyền 0 — đã có, bản 2: kiểm định độc lập** (`calib.js`, tab "0 · Dữ liệu & kiểm định as-is")
  - **Độc lập:** model học thông số as-is trên ngày lẻ, dự báo ngày chẵn chỉ từ đơn của ngày đó, rồi đổi vai. Không ngày nào được chấm bằng thông số học từ chính nó.
  - **Model số chuyến của một tuyến trong một ngày** (học từ chuyến thật):
    - Mỗi lượt có ba thông số: tỷ lệ ngày lượt chạy, phần đơn của lượt, số xe tách theo SOC.
    - Loại xe và cách chọn xe theo từng tuyến: cố định theo tỷ lệ thật, rẻ nhất, hoặc vừa hàng. Tuyến nào cần thì có thêm "xe thường trực" mỗi lượt. Cách nào khớp nhất trên ngày học thì dùng cách đó.
    - Mức lấp đầy chỉnh để số chuyến khớp thật trên ngày học. Tuyến ghép mới dùng sức chở vật lý: không vượt tải p95 của xe thật, không dưới P.fill.
    - Tiền xe chia theo đơn khi xe thật ghé cả hub hoặc điểm ngoài tuyến.
    - Tuyến hiện nay = các điểm đi chung ≥ 30% số chuyến.
  - **Giờ giấc:**
    - Thời gian xe đứng: hệ số phút/đơn cộng phần cố định theo khung giờ xe tới (60').
    - Thời gian chạy về SOC: trung vị theo khung giờ xuất phát.
  - **Ngưỡng đạt:**
    - tiền tổng ±5% và sai số theo tuyến cả kỳ ≤ 10%;
    - giờ rời điểm và giờ tới SOC: ≥ 80% lần dừng thuộc nhóm điểm × COT có trung vị lệch ≤ 15'.
  - **Thước đo phụ:** sai số theo tuyến × ngày, đặt cạnh "mốc thống kê" (đoán số chuyến bằng đường thẳng theo đơn) để biết model còn bỏ sót bao nhiêu phần giải thích được.
  - **Kết quả (ngoài mẫu):**

    | Vùng | Tiền tổng | Tuyến cả kỳ | Chuyến tuyến × ngày (mốc thống kê) | Giờ rời / tới SOC |
    |---|---|---|---|---|
    | HN | +1,3% | 4% | 12% (10%) | 100% / 100% |
    | HCM | −0,3% | 4% | 19% (19%) | 96% / 92% |
    | North | +4,2% | 7% | 14% (12%) | 93% / 96% |
    | South | +1,6% | 3% | 17% (16%) | 99% / 98% |
  - **Bản 3 (mục tiêu sai số theo tuyến ≤ 1%):**
    - **Mô phỏng lại kỳ** (học toàn kỳ, chạy lại toàn kỳ): mỗi tuyến hiện nay có hệ số chuyến `tf` và hệ số giá `cf` học từ ngày học. Sai số theo tuyến 0,0% ở cả 4 vùng; ngưỡng ≤ 1%. Đây là bài khớp lại, không phải bằng chứng dự báo.
    - **Kiểm định độc lập:**
      - Lượt phụ chạy theo ngưỡng đơn học từ data.
      - Mức lấp đầy lấy cao nhất trong các mức cùng khớp (không đánh giá thấp sức chở khi ngày học chưa có ngày cao điểm).
      - Sửa lỗi: tuyến nhiều điểm có điểm vắng đơn trong ngày vẫn được nhận là tuyến hiện nay.
      - Lệch có hệ thống về gần 0. Kết quả: tổng vùng HN +0,4%, HCM +0,3%, North +2,1%, South −1,0%; theo tuyến 2,0–3,2%.
    - **Giới hạn của dữ liệu:** sai số độc lập theo tuyến đã thấp hơn mức nhiễu ngày (2,5–4,4%). Muốn ≤ 1% khi chấm độc lập cần dữ liệu dài hơn khoảng 11–35 lần.
  - **Dữ liệu 1/8–18/9 (48 ngày có chuyến)** dựng bằng `core/build_data.py` từ hai file xlsx (Volume Tracking Ver2, Linehaul Data). Kết quả khớp tuyệt đối với bản Apps Script trên tháng 8. Ngày 2/9 không có chuyến nên bỏ khỏi phần chấm.
    - **Kiểu chạy "xe theo lịch":** mỗi lượt ít nhất bằng số xe trung vị, thêm xe khi vượt sức chở vật lý. Mỗi tuyến chọn kiểu chạy theo độ khớp từng ngày.
    - **Kết quả:**

      | Vùng | Ngày lẻ/chẵn: tuyến | Dự báo 1–18/9 (học tháng 8): tổng | Tuyến | Nhiễu | Mốc thống kê |
      |---|---|---|---|---|---|
      | HN | 1,2% | +2,2% | 7,5% | 3,5% | 7,4% |
      | HCM | 2,9% | +4,0% | 11,7% | 6,2% | 13,4% |
      | North | 2,4% | −3,8% | 13,3% | 5,7% | 10,7% |
      | South | 1,4% | −0,4% | 6,3% | 5,3% | 7,0% |

      Mốc thống kê: tiền theo tuyến = đường thẳng theo đơn, học tháng 8.
    - Phần lệch trên mức nhiễu khi dự báo theo thời gian là thay đổi vận hành:
      - Top Gia HCM giảm đội xe giữa tháng 9;
      - HAPAS chuyển từ đi ghép sang xe riêng từ 21/8;
      - KhoBim 3Mien tăng đơn 10 lần và chuyển sang đi ghép;
      - POSY chở ít đơn/xe hơn.
    - Học từ ngày gần nhất không giúp (ít ngày học hơn, mất các ngày sale để model học theo).
  - **Gỡ các tuyến còn lệch > 10%** (Elmich, Tiki Bình Tân, Innisfree, Kho Nuty, SaoThaiDuong, Fastock, ECV-HOME+HISEN):
    - Đơn ít hơn mức thấp nhất từng có xe thì khả năng có xe giảm theo tỷ lệ (`vRunOn`).
    - Kiểu xe theo lịch chỉ được chọn khi có ≥ 8 ngày học (`nbDays`). Số xe theo lịch = trung vị (`nbPct`).
    - Số xe tách theo SOC = trung bình, không làm tròn (`lgMean`).
    - Sức chở tính theo tỷ lệ hàng to bình quân của điểm, không theo từng ngày (`betaAvg`). Tỷ lệ hàng to trong file volume nhảy 21–62% giữa các ngày, trong khi xe thật không đổi.
    - Kết quả: không còn tuyến nào lệch > 10%, trừ 2 tuyến chỉ có 1 ngày dữ liệu (không kiểm định độc lập được).
    - Chấm độc lập ngày lẻ/chẵn, sai số theo tuyến: HN 0,7%, HCM 1,9%, North 1,7%, South 1,5%.
    - Dự báo 1–18/9 theo tuyến: 7,5% / 11,5% / 12,1% / 7,5%.
  - **Chi phí đã tắt:** `dropSur` (xe trả nhiều SOC +%/SOC) mặc định 0. Bảng giá không có khoản này, nên nó chuyển sang danh sách chờ duyệt.
