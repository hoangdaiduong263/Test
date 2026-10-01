# D2S Core

Bản rút gọn của D2S Seller Planner, chỉ giữ 2 bước:

```
Data (đơn/ngày, chuyến thật, COT, toạ độ, giá xe)
  → [1] LINEHAUL  tìm cách ghép điểm thành tuyến + chọn cỡ xe để tiền xe thấp nhất (chỉ xét tiền)
  → [2] HEADCOUNT mỗi tuyến mới: mô phỏng ngày đông, chọn cách dùng người rẻ nhất mà vẫn kịp COT
        tuyến nào trễ quá P.lateTol (60') → cấm → chạy lại [1] → lặp tới khi mọi tuyến mới đều qua
```

## File
| File | Việc |
|---|---|
| `engine.js` | Toàn bộ logic. `Core(D, REF)` → `{P, run(R), …}`. Chạy được trên trình duyệt và Node |
| `ui.js`, `page.html` | Trang hiển thị |
| `live.js` | Live: phát lại mô phỏng ngày đông của một gói theo đồng hồ (bản đồ + nhật ký). Chỉ đọc kết quả mô phỏng, không tính lại |
| `build.py` | Gộp data + engine + ui thành một trang: `python3 core/build.py <data.js> <out.html>` |
| `extract.js` | Tách `data.js` từ app cũ: `node core/extract.js gas/App.html <app cũ .html> <data.js>` |
| `test.js` | Chạy thử trên Node, in kết quả từng vùng: `node core/test.js <data.js> [vùng]` |

`data.js` (khoảng 1,8 MB, có tên seller) không nằm trong repo.

## Bước 1: tiền xe (`routeDay`, `routeCost`, `search`)
- Tuyến hiện nay (`baseRoutes`): cùng cụm ghép trong data, hoặc thực tế đi chung chuyến ≥ 80% số ngày.
- Tiền xe một tuyến một ngày: gom đơn → chia cho số lượt (COT) × số xe tách theo SOC mỗi lượt (đếm từ chuyến thật) → đội xe rẻ nhất (`fleet`).
  - Giá chuyến theo vùng; xa SOC hơn `cityKm` thì giá theo bảng km; tuyến nhiều điểm cộng đ/km × km đi vòng.
  - Sức chứa theo số đơn (đơn thường / hàng to) × mức lấp đầy của điểm (`fillOf`). Mức lấp đầy chỉnh theo chuyến thật:
    - xe hay chạy thêm chuyến vì đầy → hạ xuống;
    - xe thật chở nhiều hơn chuẩn → nâng lên.
- Tìm kiếm cục bộ: lặp bước lợi nhất trong 4 kiểu (ghép · chuyển 1 điểm · tách · đổi chéo), mỗi bước phải lợi ≥ `minGain`.
- Hai điểm chỉ ghép được khi:
  - chung SOC, chạy trùng đủ ngày;
  - cách nhau ≤ `maxKm`;
  - giờ xe lượt đầu lệch ≤ `cotGap`;
  - hoặc đã đi chung chuyến thật.
- So sánh mô hình với mô hình: "tuyến hiện nay" và "kế hoạch" đều tính bằng cùng một công thức. Số "thực tế" chỉ để đối chiếu độ sát của mô hình.

## Bước 2: headcount (`work`, `simRoute`, `routeBest`, `assign`)

**Năng suất theo đặc điểm seller** (`work`, giống model cũ):
- `ch` = số chute chia (theo luồng D2S của vùng), `st` = số SOC xe chở tới.
- Chia 1 chute thì không sort. Nhiều chute thì sort hàng nhỏ. Xe tới ≥ 2 SOC thì sort cả hàng to.
- Năng suất sort = `prodBase` × (−`prodChute` % mỗi chute ngoài 1) × (−`prodBulky` % mỗi 10 điểm % hàng to lệch khỏi 10%).
- Phần không sort (quét, bàn giao) tính theo `prodHand`.
- Người-ngày/đơn = phần sort ÷ năng suất sort + phần không sort ÷ `prodHand`.

**Mô phỏng ngày đông** (`simRoute`), từng lượt xe:
- **Hàng có từ:** giờ xe thật tới − thời gian FTE riêng làm phần đó (không trước giờ seller mở).
- **Xe:** tới điểm đầu lúc hàng sẵn, chờ hàng ở điểm sau; thời gian đứng = cố định + phút/đơn (đo từ chuyến thật).
- **Trễ** = giờ xe rời − hạn COT (Packed) của lượt.

**3 loại người:**

| Loại | Hàng sẵn | Tiền |
|---|---|---|
| FTE riêng | Như hiện nay | số người (theo khối việc ngày đông) × `ftePay` × ngày chạy |
| Rider PPS | Như hiện nay; rider quét lúc giao, nên cộng thời gian quét vào lúc xe đứng | đơn × `ppsRate` |
| Nhóm FM Hub | Nhóm đi lần lượt các lượt-điểm theo hạn COT sớm nhất trước; đi giữa 2 điểm mất km ÷ `hubSpd` | số người × `hubPay` × ngày chạy |

**Hai tầng chọn:**
1. **[2a] Từng tuyến mới** (`routeBest`): thử mọi tổ hợp FTE riêng / PPS, chọn rẻ nhất có trễ ≤ `lateTol`.
   - Không tổ hợp nào kịp thì tuyến bị cấm, chạy lại bước 1.
   - Tuyến hiện nay mô phỏng đã trễ hơn `lateTol` thì tuyến mới chứa điểm của nó chỉ cần không trễ hơn.
2. **[2b] Cả vùng** (`assign`): từ kết quả 2a, gom dần điểm thành **nhóm FM Hub** khi nhóm rẻ hơn và mọi tuyến xe bị ảnh hưởng vẫn kịp.
   - Điều kiện nhóm: cùng hub, mọi cặp điểm cách nhau ≤ `hubKm`.
   - Nhóm được đi vòng các điểm thuộc tuyến xe khác nhau.
   - Số người của nhóm = nhỏ nhất mà vẫn kịp.
   - Tiền nhóm chia cho từng điểm theo khối việc.

## Chưa có (cố ý bỏ để gọn)
- Trần số người tại điểm / số người hub cấp được.
- Năng suất theo % đủ diện tích và bàn giao pallet (đang coi là đủ diện tích, bàn giao lẻ).
- Số chỗ chất hàng tại điểm (xe chất song song không giới hạn).
- Thể tích/khối lượng hàng.
- SOC sort lại, ké FM/LM, thuê xe ca 12H, ưu tiên điểm.
