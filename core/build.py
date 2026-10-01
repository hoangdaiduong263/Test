"""Gộp page.html + data.js + engine.js + ui.js thành một trang (artifact).
python3 core/build.py <data.js> <out.html>"""
import sys, pathlib
here = pathlib.Path(__file__).parent
data, out = sys.argv[1], sys.argv[2]
page = (here / "page.html").read_text()
for tag, src in (("/*DATA*/", pathlib.Path(data).read_text()), ("/*ENGINE*/", (here / "engine.js").read_text()), ("/*UI*/", (here / "ui.js").read_text())):
    assert page.count(tag) == 1, tag
    page = page.replace(tag, src.replace("</script", "<\\/script"))
pathlib.Path(out).write_text(page)
print(out, round(len(page) / 1e6, 2), "MB")
