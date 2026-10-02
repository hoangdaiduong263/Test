# Thử nghiệm XGBoost trong kiểm định (dây chuyền 0)

```
node core/experiments/xgb_export.js <data.js> ml.json     # bảng tuyến × ngày, đặc trưng biết trước + dự báo model cấu trúc (ngoài mẫu)
pip install xgboost && python3 core/experiments/xgb_compare.py ml.json
```

So sánh 3 cách dự báo tiền xe tuyến × ngày, cùng cách chia ngày với kiểm định:
1. model cấu trúc;
2. XGBoost thuần (số đơn, tỷ lệ hàng to, loại ngày, thứ, thống kê tuyến trên ngày học);
3. lai: XGBoost học phần sai của model cấu trúc.

Ở tập train, dự báo của model cấu trúc cũng lấy ngoài mẫu (chia đôi ngày học), để XGBoost không học trên phần đã khớp sẵn.

**Kết quả trên dữ liệu 1/8–18/9:**

| Bài | XGBoost thuần | Lai |
|---|---|---|
| Dự báo 1–18/9, theo tuyến | Kém hơn model cấu trúc (HCM 19% so với 11,5%) | Tốt hơn chút ở HN, North, South (−0,4 đến −1,2 điểm); kém hơn ở HCM (13,7% so với 11,5%) |
| Theo ngày | | Tốt hơn 1–2 điểm |
| Chấm lẻ/chẵn, theo tuyến | | Kém hơn model cấu trúc |

**Kết luận:** chưa đưa XGBoost vào lõi.

# Bước 1 · Kiểm chứng tuyến ghép bằng thí nghiệm tự nhiên

```
node core/experiments/merge_check.js <data.js>          # mọi ngày
BAU=1 node core/experiments/merge_check.js <data.js>    # chỉ ngày thường, cho hai trạng thái cùng loại ngày
```

**Thí nghiệm tự nhiên:** cặp điểm có ngày đi chung xe và có ngày đi riêng. Dữ liệu 1/8–18/9 có 27 cặp: North 22, South 4, HN 1, HCM 0.
- **Chiều ghép:** model học trên ngày đi riêng, dự báo tiền xe tuyến ghép cho ngày đi chung.
- **Chiều tách:** model học trên ngày đi chung, dự báo ngày đi riêng.

**Kết quả** (lệch = model so với thật):

| Phạm vi | Ghép | Tách |
|---|---|---|
| Mọi ngày | −11,7% | −20,5% |
| Chỉ ngày thường | −8,3% | −18,6% |

Model đoán một cách chạy chưa từng thấy rẻ hơn thật. Ngoài đời, tuyến ghép vẫn cho xe tới nhiều lượt và chở chưa đầy, ví dụ nhóm Cocoon Juno / TRUE CARE / HAPAS / sociolla: 4–6 xe/ngày, mỗi xe 85–350 đơn.

**Phép thử "đổi nhãn":** lấy tuyến đang chạy, không đổi gì, tính tiền như tuyến mới (`forceNew`). Tổng chỉ chênh −1,6% (HN), +3,0% (HCM), +0,4% (North), −0,8% (South). Tiết kiệm của plan không đến từ việc đổi cách tính.

**Tham số `newPen`:** % cộng thêm vào tiền xe tuyến mới. Optimizer chạy lại với phụ phí này. Tổng tiết kiệm (xe + người) 48 ngày:

| `newPen` | Tổng | % tiền xe |
|---|---|---|
| 0% | 2.853 tr | 27% |
| 8% | 2.430 tr | 23% |
| 19% | 1.903 tr | 18% |
