import json, sys, numpy as np, xgboost as xgb
rows = json.load(open(sys.argv[1]))
F = ["vr", "beta", "dt", "dow", "np", "reg", "nfit", "sd", "run", "cpt", "mv", "mtr"]
def fit_pred(tr, te, target, base_tr, base_te, extra=[]):
    f = F + extra
    Xtr = np.array([[r[k] for k in f] for r in tr], float); Xte = np.array([[r[k] for k in f] for r in te], float)
    btr = np.array(base_tr, float); bte = np.array(base_te, float)
    ok = btr > 0; y = np.where(ok, np.array([r[target] for r in tr]) / np.maximum(btr, 1), 1.0)
    m = xgb.XGBRegressor(n_estimators=300, max_depth=3, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, min_child_weight=5, reg_lambda=5)
    m.fit(Xtr[ok], np.clip(y[ok], 0, 5), sample_weight=btr[ok])
    p = np.clip(m.predict(Xte), 0, 5) * bte
    return np.where(bte > 0, p, bte), m
def score(te, pred, lab):
    out = []
    for R in ["HN", "HCM", "North", "South"]:
        idx = [k for k, r in enumerate(te) if r["R"] == R]
        rc = sum(te[k]["rc"] for k in idx); by = {}
        for k in idx: o = by.setdefault(te[k]["key"], [0, 0]); o[0] += te[k]["rc"]; o[1] += pred[k]
        route = sum(abs(a - b) for a, b in by.values()) / rc * 100
        day = sum(abs(te[k]["rc"] - pred[k]) for k in idx) / rc * 100
        tot = (sum(pred[k] for k in idx) - rc) / rc * 100
        out.append(f"{R} {tot:+5.1f}% tuyến {route:4.1f}% ngày {day:4.1f}%")
    print(f"  {lab:24s}", " | ".join(out))
for name, tags in [("DỰ BÁO 1–18/9 (học tháng 8)", ["fwd"]), ("CHẤM ĐỘC LẬP lẻ/chẵn", ["oddA", "oddB"])]:
    print(name)
    TE, P = [], {"Model cấu trúc": [], "XGBoost thuần": [], "Lai (cấu trúc + XGB)": []}; imp = None
    for t in tags:
        tr = [r for r in rows if r["tag"] == t and r["role"] == "train"]; te = [r for r in rows if r["tag"] == t and r["role"] == "test"]
        TE += te; P["Model cấu trúc"] += [r["mc"] for r in te]
        px, _ = fit_pred(tr, te, "rc", [r["mco"] for r in tr], [r["mco"] for r in te]); P["XGBoost thuần"] += list(px)
        for r in tr + te: r["sr"] = r["mc"] / r["mco"] if r["mco"] else 1
        ph, m = fit_pred(tr, te, "rc", [r["mc"] for r in tr], [r["mc"] for r in te], ["sr"]); P["Lai (cấu trúc + XGB)"] += list(ph)
        imp = m.feature_importances_
    for k, v in P.items(): score(TE, v, k)
    print("  độ quan trọng (lai):", ", ".join(f"{n}={w:.2f}" for n, w in sorted(zip(F + ["sr"], imp), key=lambda x: -x[1])[:6]))
