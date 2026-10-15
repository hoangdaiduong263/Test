const { chromium } = require("playwright"); (async () => { const b = await chromium.launch(require("fs").existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {}); const errs = [];
  for (const [w, h, tag] of [[1280, 900, "d"], [390, 844, "m"]]) { const p = await b.newPage({ viewport: { width: w, height: h } }); p.on("pageerror", e => errs.push(tag + " PAGE " + e.message)); p.on("console", m => { if (m.type() === "error" && !/ERR_CERT|fonts|net::/.test(m.text())) errs.push(tag + " CON " + m.text()); });
    await p.goto("file://" + require("path").resolve(process.argv[2])); await p.waitForTimeout(400);
    await p.click('.home-asm [data-go="asm"]'); await p.waitForTimeout(300);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(tag, "title", await p.textContent("#h-title"), "| nav visible", await p.$$eval("#stepNav button:not([hidden])", e => e.map(x => x.textContent.trim()).join(" / ")), "| overflow", ov, "| sections", await p.$$eval(".asm-s", e => e.length), "| text len", (await p.textContent("#asm")).length);
    await p.screenshot({ path: process.argv[3] + "/asm_" + tag + ".png", fullPage: true });
    if (tag === "d") { await p.click(".asm-d summary"); await p.waitForTimeout(100); await (await p.$("#asm-cap")).screenshot({ path: process.argv[3] + "/asm_cap_d.png" });
      /* từ bộ B: nav giữ bộ B */ await p.click('#stepNav [data-go="home"]'); await p.click('.hcard [data-go="run"]'); await p.waitForTimeout(300); await p.click('#stepNav [data-nav="asm"]'); await p.waitForTimeout(200);
      console.log("from B nav", await p.$$eval("#stepNav button:not([hidden])", e => e.map(x => x.textContent.trim()).join(" / ")));
      await p.click('#stepNav [data-nav="run"]'); await p.waitForTimeout(200); console.log("run ins", (await p.textContent("#run-ins")).slice(0, 400)); console.log("ba flags", await p.$$eval("#t-run tbody tr", e => e.filter(r => /hàng to = tổng/.test(r.textContent)).length)); }
    await p.close(); }
  console.log("errors", JSON.stringify(errs)); await b.close(); })();
