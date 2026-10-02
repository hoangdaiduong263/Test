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
