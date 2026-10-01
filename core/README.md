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

## Bước 2: headcount (`simRoute`, `headcount`)
Mô phỏng ngày đông (phân vị `peakP`), từng lượt xe:
- **Hàng có từ:** giờ xe thật tới − thời gian FTE riêng sort phần đó (không trước giờ seller mở). Vì vậy FTE riêng tái hiện đúng giờ hiện nay.
- **3 loại người:**

  | Loại | Hàng sẵn lúc nào | Chi phí |
  |---|---|---|
  | FTE riêng | Như hiện nay | Số người theo ngày đông × lương × ngày chạy |
  | FTE dùng chung | Một nhóm đi lần lượt các điểm của tuyến (theo thứ tự xe ghé), sort xong điểm này mới sang điểm kia | Số người theo tổng đơn × lương |
  | Rider Pay Per Scan | Seller tự đóng hàng; rider quét lúc giao, nên cộng thời gian quét vào lúc xe đứng | Đơn × đ/đơn |

- **Xe:** tới điểm đầu đúng lúc hàng sẵn, chờ hàng ở điểm sau nếu chưa sẵn; thời gian đứng = cố định + phút/đơn (đo từ chuyến thật).
- **Trễ** = giờ xe rời điểm − hạn COT (Packed) của lượt. Hiện nay đã đi muộn hơn hạn thì hạn = giờ đi hiện nay.
- **Thử mọi cách dùng người, chọn cách rẻ nhất có trễ ≤ `lateTol`:**
  - mỗi điểm chọn FTE riêng hoặc PPS;
  - hoặc cả tuyến dùng chung một nhóm FTE.
- Tuyến hiện nay mô phỏng đã trễ hơn `lateTol`: tuyến mới chứa điểm của nó chỉ cần không trễ hơn.

## Chưa có (cố ý bỏ để gọn)
- Nhóm FTE chung giữa các điểm khác tuyến xe.
- Số chỗ chất hàng tại điểm (xe chất song song không giới hạn).
- Thể tích/khối lượng hàng.
- SOC sort lại, ké FM/LM, thuê xe ca 12H, ưu tiên điểm.
