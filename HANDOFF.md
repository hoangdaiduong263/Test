# Bàn giao — D2S Core Planner / New Seller

Đọc file này trước khi làm tiếp. `CONTEXT.md` là lịch sử bản GAS cũ (Seller Planner); phần đang làm nằm trong `core/`.

## 1. Bắt đầu nhanh
- Repo `hoangdaiduong263/Test`, nhánh làm việc `claude/jolly-brahmagupta-enlz0l` (commit gần nhất: capacity fixes + tab Giả định & ràng buộc).
- Đọc theo thứ tự: `HANDOFF.md` → `core/README.md` (lệnh build, file) → `core/DESIGN.md` (thiết kế engine) → tab **Giả định & ràng buộc** trong trang New Seller (mọi luật, ràng buộc, cách xử lý thiếu dữ liệu; code ở `drawAsm` trong `core/ns2_ui.js`).
- Node ≥ 18. Test trang dùng Playwright (`npm i playwright` hoặc dùng bản cài sẵn; trên cloud: `NODE_PATH=/opt/node22/lib/node_modules`).

## 2. Dữ liệu (KHÔNG có trong repo — không commit)
Đặt vào thư mục `data/` ở gốc repo (đã có trong `.gitignore`):

| File | Nội dung | Dựng lại từ nguồn |
|---|---|---|
| `data/data.js` (~4,5 MB) | `const D=…; const REF=…;` — đơn/ngày, chuyến thật, COT, toạ độ, giá xe; 01/08–18/09/2026, mọi vùng | `python3 core/build_data.py <VolumeTracking.xlsx> <Linehaul_Data.xlsx> <data.js cũ (lấy REF)> data/data.js 2026-09-18` |
| `data/hubsup.json` | FM Hub → Sup theo vùng | `python3 core/hubsup.py <Network Address.xlsx> data/hubsup.json` (tab "Mng treemap") |
| `data/pivot_aug.json` | % đơn theo sort code từng điểm D2S (tháng 8) | Sheet "Volume by Sort Code" lưu CSV → `node core/pivot2json.js pivot.csv data/pivot_aug.json` |

Người dùng giữ bản zip `d2s_data.zip` của 3 file này (gửi từ phiên trước).

## 3. Build, test, publish
```
# trang New Seller (bản gộp) — kỳ/vùng mặc định 01–31/08, HCM,South
node core/build_ns2.js data/data.js out/D2S_New_Seller.html data/hubsup.json data/pivot_aug.json
#   NS_FROM / NS_TO / NS_REG đổi kỳ, vùng; NS_DUMP=out/dump.json để so trước/sau (core/qa/run_cmp.js)

# Core Planner
python3 core/build.py data/data.js out/D2S_Core_Planner.html
node core/test.js data/data.js [vùng]          # số từng vùng (tiền xe thật / hiện nay / kế hoạch, gói)

# kiểm tra
node core/ns_fuzz.js <ref.json> 150             # ref.json = .ref của NS_DUMP; mong đợi: exceptions 0, không dòng lỗi
node core/qa/cap_check.js data/data.js          # sức chở học được: đường theo % hàng to, các số "chạm trần" bị chặn, điểm hàng to = tổng
node core/qa/page_test.js out/D2S_New_Seller.html out/shots   # chạy trang thật: form mẫu → kết quả, seller đang chạy, mạng lưới, mobile, lỗi JS
node core/qa/asm_test.js  out/D2S_New_Seller.html out/shots   # tab Giả định & ràng buộc (desktop + mobile, tràn ngang, lỗi JS)
```
Publish: Artifact tool, cập nhật đúng link cũ bằng `url` (phiên mới phải `read` artifact trước rồi mới publish được).

## 4. Artifact
| Link | Là gì | Trạng thái |
|---|---|---|
| https://claude.ai/artifact/NDnAv1ic9m3wuqWv3cXraB | **D2S New Seller (bản gộp, dữ liệu thật 01–31/08, HCM & South)** — bộ A đánh giá seller mới, bộ B seller đang chạy + mạng lưới SPX, tab Giả định & ràng buộc | Bản chính, v6 |
| https://claude.ai/artifact/WSkqDmNS97yKkT55k55U8e | New Seller bản cũ (trước bản gộp) | Chưa quyết thay bằng bản gộp hay giữ |
| https://claude.ai/artifact/SnR3GLJG7s3v1rvwbehZqX | "Đánh giá seller mới" — bản tách, thừa | Chưa quyết xoá |
| https://claude.ai/artifact/Q47vUGQ3KLMj6Kpooc9WG7 | New Seller Fit — walkthrough | **Đóng băng, không sửa** |
| https://claude.ai/artifact/Q4jH7oKjpSxq5HYAeG8eGr | D2S Core Planner | Chưa cập nhật theo sửa sức chở (xem §6) |
| https://claude.ai/artifact/LHcPrSNN6gWPXs3zgLSikq · https://claude.ai/artifact/5fAWcs29PRKuaLoeA9KGWs | Core Planner: cách model chạy / thuật toán và mô phỏng | Tài liệu |
| https://claude.ai/artifact/ShdKHGqvWT2L8L4JwGsEKM · https://claude.ai/artifact/AUEhGunEa331SC54wYbdw6 | Brief họp OE (South / chung) | Tài liệu |

## 5. Trạng thái hiện tại
- **Engine** (`core/engine.js`, dùng chung Core Planner + New Seller). Sức chở học từ chuyến thật (`learnK`, 6 bước). Sửa gần nhất:
  - bỏ điểm "hàng to = tổng đơn" (`bulkAll`) khỏi đường sức chở theo % hàng to;
  - chặn số "chạm trần" trái tỷ lệ thể tích giữa các cỡ xe (`P.kSatChk` 0,7, lặp tới ổn định; 6 trường hợp, vd Top Gia 5T 583 → 1.058);
  - `adoptK(C2)` để dùng sức chở học ở Core khác.
- **New Seller** (`core/newseller.js` = `nsRef`/`nsPlan`; `core/ns2_lib.js`; `core/ns2_ui.js` + `core/ns2_page.html`; build `core/build_ns2.js`):
  - Sức chở học trên mọi chuyến 01/08–18/09, mọi vùng; số đơn, tiền xe thật và lời/lỗ chỉ tính trong kỳ.
  - Seller mới lấy sức chở theo đường cong học được tại % hàng to của chính seller (`ref.curve`: 1T9 = 1/((1−β)/2.802 + β/491)); dải seller giống chỉ để đối chiếu.
  - Seller đang chạy: lời/lỗ = FM pickup − (xe thật + người + rã bao theo mô hình).
- **Số mới nhất:**
  - Seller mẫu Tân Phú (ADO 4.000, 35% hàng to): 3 chute −28,8 tr/tháng · 1 chute +80,3 tr/tháng.
  - Seller đang chạy (kỳ 01–31/08): HCM tổng −181,6 tr · South +154,8 tr.
  - Core Planner (`core/test.js`, 49 ngày): tiết kiệm tiền xe 588,9 → 655,0 tr (HCM +39 → +72, North 0 → +33).

## 6. Việc mở / chờ quyết
1. Gửi BI xác nhận 16 điểm đang chạy (103/191 toàn bộ dữ liệu) có hàng to = tổng đơn gần như mọi ngày; danh sách ở tab Giả định & ràng buộc. Hiện FM pickup của các điểm này tính như 100% hàng to → lời/lỗ có thể cao hơn thật.
2. Core Planner artifact + deck + con số "~850 tr/tháng" chưa cập nhật theo số sức chở mới (+~40 tr/tháng tiền xe). Hỏi người dùng trước khi đổi.
3. Ops xác nhận mã nhóm sort nháp: CT, MTA, MT, MB, MBA, MBC, SW (`NS2_DRAFT` trong `core/ns2_lib.js`).
4. Giá và % sort trên ASM (đang dùng sort tay 260 đ/lần).
5. Link WSkq (thay bằng bản gộp?) và SnR3 (xoá?).
6. South chưa có % theo sort code (đang dùng trung bình HCM); năng suất chưa hiệu chỉnh bằng chấm công.

## 7. Quy ước làm việc với người dùng
- Trả lời tiếng Việt, ngắn gọn. Chữ trên trang: dễ hiểu, tối giản; ô nhập ẩn mặc định, chỉ mở khi cần.
- Mọi số tiết kiệm ghi "Est.". Giữ câu chuyện ~850 tr/tháng của Core Planner trừ khi người dùng duyệt đổi.
- COT: trễ ≤ 12′ vẫn tính kịp nhưng chip vàng "theo dõi", không bao giờ xanh.
- Thêm khoản chi phí mới hoặc đòn bẩy mới → hỏi duyệt trước. Đổi số Core Planner → hỏi duyệt trước.
- Có dữ liệu thật thì dùng, không tự giả định.
- Không ghi ghi chú riêng của người dùng lên slide/deck.
- Không commit file dữ liệu. Không ghi tên model vào commit/PR.
- Không mở PR khi chưa được yêu cầu. Push lên đúng nhánh làm việc.
