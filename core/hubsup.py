"""Danh sách FM Hub → Supervisor cho trang New Seller, từ tab "Mng treemap" của sheet Network Address.
   python3 core/hubsup.py <Network Address.xlsx> <out.json>
   Ra {vùng model: [[hub, sup], ...]}; chỉ lấy dòng loại Hub; vùng treemap quy về 4 vùng của model (Central, X-metro không có D2S thì bỏ)."""
import json, sys
import openpyxl

REG = {"HN": "HN", "Ha Noi": "HN", "Ho Chi Minh": "HCM", "South East": "South", "South West": "South", "South": "South", "North": "North", "North 2": "North"}


def main(src, out):
    ws = openpyxl.load_workbook(src, read_only=True, data_only=True)["Mng treemap"]
    rows = list(ws.iter_rows(values_only=True))
    hd = [str(h or "").strip() for h in rows[0]]
    ix = {k: hd.index(k) for k in ("Region", "Hub Station", "SOC/Hub", "Supervisor")}
    res = {}
    for r in rows[1:]:
        if not r or not r[ix["Hub Station"]] or str(r[ix["SOC/Hub"]] or "").strip() != "Hub":
            continue
        R = REG.get(str(r[ix["Region"]] or "").strip())
        if not R:
            continue
        pair = [str(r[ix["Hub Station"]]).strip(), str(r[ix["Supervisor"]] or "").strip()]
        if pair not in res.setdefault(R, []):
            res[R].append(pair)
    for R in res:
        res[R].sort()
    json.dump(res, open(out, "w"), ensure_ascii=False)
    print({R: len(v) for R, v in res.items()})


if __name__ == "__main__":
    main(*sys.argv[1:3])
