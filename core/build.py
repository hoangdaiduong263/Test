"""Gộp page.html + data.js + engine.js + ui.js thành một trang (artifact).
python3 core/build.py <data.js> <out.html> [--only Vùng]   (--only: bản trình bày cho một vùng, mở sẵn đổi cỡ xe)"""
import sys, pathlib
here = pathlib.Path(__file__).parent
data, out = sys.argv[1], sys.argv[2]
only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
page = (here / "page.html").read_text()
for tag, src in (("/*DATA*/", pathlib.Path(data).read_text()), ("/*ENGINE*/", (here / "engine.js").read_text()), ("/*CALIB*/", (here / "calib.js").read_text()), ("/*LIVE*/", (here / "live.js").read_text()), ("/*UI*/", (here / "ui.js").read_text())):
    assert page.count(tag) == 1, tag
    page = page.replace(tag, src.replace("</script", "<\\/script"))
if only:
    assert page.count("/*UI*/") == 0 and "<script>" in page
    page = page.replace("<script>", "<script>window.D2S_ONLY=" + repr(only).replace("'", '"') + ";", 1)
    page = page.replace("<title>D2S Core Planner</title>", f"<title>D2S Planner {only}</title>", 1).replace("<h1>D2S Planner</h1>", f"<h1>D2S Planner · {only}</h1>", 1)
pathlib.Path(out).write_text(page)
print(out, round(len(page) / 1e6, 2), "MB")
