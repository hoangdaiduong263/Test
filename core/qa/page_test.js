/* SỐ CHUẨN (bản build mặc định 01–31/08, HCM & South): seller mẫu Tân Phú và tổng lời/lỗ từng vùng. Đổi dữ liệu / engine có chủ ý → sửa số ở đây */
const GOLD={vh:["Đang nhập: Est. −28,8 tr/tháng","+80,3 tr"],HCM:["cả 16 điểm: −181,6 tr"],South:["cả 23 điểm: +154,8 tr"]},txt={};
const {chromium}=require("playwright");(async()=>{const b=await chromium.launch(require("fs").existsSync("/opt/pw-browsers/chromium")?{executablePath:"/opt/pw-browsers/chromium"}:{});const errs=[];
const p=await b.newPage({viewport:{width:1280,height:900}});p.on("pageerror",e=>errs.push("PAGE "+e.message));p.on("console",m=>{if(m.type()==="error"&&!/ERR_CERT|fonts|net::/.test(m.text()))errs.push("CON "+m.text());});
const out=process.argv[3];await p.goto("file://"+require("path").resolve(process.argv[2]));await p.waitForTimeout(500);
txt.data=await p.textContent("#h-data");console.log("home h1",await p.textContent("#h-title"),"|",txt.data,"|",await p.textContent("#h-npts"));
await p.click('.hcard [data-go="form"]');await p.waitForTimeout(200);
console.log("go disabled",await p.evaluate(()=>document.getElementById("go").disabled),"waves",await p.$$eval("#f-waves input",e=>e.length),"hubs",await p.$$eval("#f-hub option",e=>e.length));
await p.selectOption("#f-ex","abc");await p.waitForTimeout(300);
console.log("hubhint",await p.textContent("#hubhint"),"| mix",await p.textContent("#mix-sim-t"),"| impact",await p.textContent("#impact"));
console.log("go disabled after",await p.evaluate(()=>document.getElementById("go").disabled),await p.textContent("#gomsg"));
await p.screenshot({path:out+"/r_form.png",fullPage:true});
const t0=Date.now();await p.click("#go");await p.waitForFunction(()=>!document.getElementById("v-dash").hidden||/Lỗi/.test(document.getElementById("busy-t").textContent),null,{timeout:120000});console.log("compute ms",Date.now()-t0,"busy",await p.textContent("#busy-t"));
await p.waitForTimeout(300);
txt.vh=await p.textContent("#v-h");for(const id of ["v-h","v-ded","kpis","t-ins","t-note","p-ins","c-ins","l-ins","lev-no","b-ins","g-ins","s-ins","s-do"])console.log("--",id,":",((await p.textContent("#"+id))||"").slice(0,600));
await p.screenshot({path:out+"/r_dash.png",fullPage:true});
await p.click('#planseg [data-plan="inp"]').catch(()=>{});await p.waitForTimeout(200);
await p.click('.dtseg[data-for="p"] [data-dt="2"]');await p.click('.dtseg[data-for="t"] [data-dt="2"]');await p.waitForTimeout(200);
await p.click('#stepNav [data-go="home"]');await p.click('.hcard [data-go="run"]');await p.waitForTimeout(300);
txt.HCM=await p.textContent("#stats");console.log("run rows",await p.$$eval("#t-run tbody tr",e=>e.length),"| stats",txt.HCM,"| ins",await p.textContent("#run-ins"));
await p.screenshot({path:out+"/r_run.png",fullPage:true});
await p.click('#rreg [data-rr="South"]');await p.waitForTimeout(200);txt.South=await p.textContent("#stats");console.log("south rows",await p.$$eval("#t-run tbody tr",e=>e.length),"| stats",txt.South);
await p.click('#rreg [data-rr="HCM"]');await p.waitForTimeout(100);
await p.click('#t-run [data-sort="HCMSeller-BOX ME Binh Chanh"]');await p.waitForTimeout(300);console.log("net",await p.textContent("#o-name"),"|",await p.textContent("#n-impact"));
await p.click('#p-net [data-qa="1"]');await p.click("#n-save");await p.waitForTimeout(300);console.log("after save",await p.textContent("#n-impact"));
await p.screenshot({path:out+"/r_net.png",fullPage:false});
await p.setViewportSize({width:390,height:800});for(const v of ["home","form","dash","run","net"]){await p.evaluate(v=>go(v),v);await p.waitForTimeout(150);console.log("mobile",v,await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth));}
if(/01\/08\/2026 – 31\/08\/2026 · HCM & South/.test(txt.data))for(const k in GOLD)GOLD[k].forEach(s=>{if(!(txt[k]||"").includes(s))errs.push("GOLD "+k+" thiếu \""+s+"\"");});else console.log("gold: bỏ qua (không phải bản build mặc định)");
console.log("errors",errs);await b.close();if(errs.length)process.exitCode=1;})();
