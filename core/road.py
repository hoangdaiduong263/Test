"""Quãng đường bộ thật (OSRM trên bản đồ OpenStreetMap, miễn phí) cho các cặp điểm–điểm và điểm–SOC cùng vùng; ghi vào data.js thành D.RD.
python3 core/road.py <data.js> [máy chủ OSRM, mặc định https://router.project-osrm.org] [km chim bay tối đa để lấy hình đường, mặc định 25]
- RD.km["A>B"]: km đường bộ từ A tới B (bảng khoảng cách /table, theo lô ≤ 100 toạ độ)
- RD.min["A>B"]: phút xe con không kẹt xe theo OSRM (chỉ để tham khảo; mô hình dùng km đường bộ ÷ tốc độ học từ chuyến thật)
- RD.path["A|B"] (A < B): hình đường (polyline mã hoá, độ chính xác 5) cho cặp cách nhau ≤ ngưỡng km, cặp đi nối nhau trên chuyến thật và điểm → SOC
Chạy lại được: cặp đã có thì bỏ qua. Máy chủ demo giới hạn ~1 lần gọi/giây."""
import sys, json, re, math, time, urllib.request, urllib.error

DATA = sys.argv[1]
SRV = (sys.argv[2] if len(sys.argv) > 2 else 'https://router.project-osrm.org').rstrip('/')
MAXKM = float(sys.argv[3]) if len(sys.argv) > 3 else 25
src = open(DATA, encoding='utf8').read()
m = re.search(r'^const D=(.*);$', src, re.M)
D = json.loads(m[1])
GEO = D['GEO']
RD = D.get('RD') or {}
for k in ('km', 'min', 'path'): RD.setdefault(k, {})
last = [0.0]

def get(url):
    for k in range(6):
        wait = 1.1 - (time.time() - last[0])
        if wait > 0: time.sleep(wait)
        last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'd2s-network-optimizer'}), timeout=60) as r:
                j = json.loads(r.read())
            if j.get('code') == 'Ok': return j
            print('  OSRM', j.get('code'), j.get('message', ''))
            return None
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            print('  lỗi', e, '— thử lại'); time.sleep(2 ** k)
    raise SystemExit('Không gọi được ' + SRV)

ll = lambda n: f"{GEO[n][1]},{GEO[n][0]}"
def crow(a, b):
    (la1, lo1), (la2, lo2) = GEO[a], GEO[b]; r = math.radians
    h = math.sin(r(la2 - la1) / 2) ** 2 + math.cos(r(la1)) * math.cos(r(la2)) * math.sin(r(lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))

# 1. bảng km theo vùng: điểm D2S của vùng + SOC các điểm đó đi
TN = [str(n).strip() for n in D['TN']]
regions = {}
for s in D['S']:
    n = s['n'].strip()
    if n not in GEO: continue
    L = regions.setdefault(s['R'], set()); L.add(n)
    for x in s.get('soc') or []:
        if x.strip() in GEO: L.add(x.strip())
for R, ns in regions.items():
    ns = sorted(ns); B = 50; blocks = [ns[i:i + B] for i in range(0, len(ns), B)]
    for A in blocks:
        for Bk in blocks:
            if all((a + '>' + b) in RD['km'] for a in A for b in Bk if a != b): continue
            co = A + [x for x in Bk if x not in A]; ix = {n: k for k, n in enumerate(co)}
            j = get(f"{SRV}/table/v1/driving/{';'.join(ll(n) for n in co)}?sources={';'.join(str(ix[a]) for a in A)}&destinations={';'.join(str(ix[b]) for b in Bk)}&annotations=distance,duration")
            if not j: continue
            for p, a in enumerate(A):
                for q, b in enumerate(Bk):
                    dd, tt = j['distances'][p][q], j['durations'][p][q]
                    if a != b and dd is not None: RD['km'][a + '>' + b] = round(dd / 100) / 10; RD['min'][a + '>' + b] = round(tt / 6) / 10
    print(R, len(ns), 'điểm+SOC · km', len(RD['km']))

# 2. hình đường: cặp gần nhau cùng vùng, cặp đi nối nhau trên chuyến thật, điểm → SOC
want = set()
for R, ns in regions.items():
    ns = sorted(ns)
    for i, a in enumerate(ns):
        for b in ns[i + 1:]:
            if crow(a, b) <= MAXKM: want.add((a, b))
for t in D['T'].values():
    st = [TN[p[0]] for p in t[5]]
    for a, b in zip(st, st[1:]):
        if a != b and a in GEO and b in GEO: want.add(tuple(sorted((a, b))))
for s in D['S']:
    n = s['n'].strip()
    for x in s.get('soc') or []:
        if n in GEO and x.strip() in GEO: want.add(tuple(sorted((n, x.strip()))))
todo = [p for p in sorted(want) if p[0] + '|' + p[1] not in RD['path']]
print('hình đường cần lấy', len(todo), '/', len(want))
for k, (a, b) in enumerate(todo):
    j = get(f"{SRV}/route/v1/driving/{ll(a)};{ll(b)}?overview=simplified&geometries=polyline")
    if j: RD['path'][a + '|' + b] = j['routes'][0]['geometry']
    if k % 200 == 199:
        open(DATA, 'w', encoding='utf8').write(src.replace(m[1], json.dumps(dict(D, RD=RD), ensure_ascii=False, separators=(',', ':')), 1)); print(' ', k + 1, 'đã lưu')
out = src.replace(m[1], json.dumps(dict(D, RD=RD), ensure_ascii=False, separators=(',', ':')), 1)
open(DATA, 'w', encoding='utf8').write(out)
print('xong', DATA, '· km', len(RD['km']), '· hình đường', len(RD['path']))
