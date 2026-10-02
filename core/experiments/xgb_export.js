/* xuất bảng tuyến × ngày cho thử nghiệm XGBoost: đặc trưng chỉ dùng thông tin biết trước + dự báo của model cấu trúc (ngoài mẫu) */
const fs=require("fs"),{Core}=require("../engine.js");const src=fs.readFileSync(process.argv[2],"utf8");
const D=eval("("+src.match(/^const D=(.*);$/m)[1]+")"),REF=eval("("+src.match(/^const REF=(.*);$/m)[1]+")");const C=Core(D,REF);
const ok=d=>D.lh[d],realT=(i,d)=>{const t=C.S[i].tr[d];return Array.isArray(t)?t.reduce((a,x)=>a+x,0):0};
const REG={HN:0,HCM:1,North:2,South:3},out=[];
function rowsFor(fitDays,testDays,tag,role){C.setFit(fitDays);const F=new Set(fitDays);
 for(const R of ["HN","HCM","North","South"])for(const g of C.baseRoutes(R)){
  const fd=fitDays.filter(d=>g.some(i=>(C.S[i].v[d]||0)>0)),V=d=>g.reduce((a,i)=>a+(C.S[i].v[d]||0),0),B=d=>g.reduce((a,i)=>a+(C.S[i].b[d]||0),0),RT=d=>g.reduce((a,i)=>a+realT(i,d),0),RC=d=>g.reduce((a,i)=>a+C.realCost(i,d),0);
  const n=fd.length,mv=n?fd.reduce((a,d)=>a+V(d),0)/n:0,mtr=n?fd.reduce((a,d)=>a+RT(d),0)/n:0,mco=n?fd.reduce((a,d)=>a+RC(d),0)/n:0,sd=n?Math.sqrt(fd.reduce((a,d)=>a+(RT(d)-mtr)**2,0)/n):0,run=n?fd.filter(d=>RT(d)>0).length/n:0;
  for(const d of testDays){if(!g.some(i=>(C.S[i].v[d]||0)>0))continue;const m=C.routeDay(g,d),v=V(d);
   out.push({tag,role,key:g.map(C.nm).join("+"),R,d,v,beta:v?B(d)/v:0,dt:D.dt[d],dow:new Date(D.dates[d]).getDay(),np:g.length,reg:REG[R],nfit:n,mv,mtr,mco,sd,run,cpt:mtr?mco/mtr:0,vr:mv?v/mv:1,mt:m?m.t:0,mc:m?m.c:0,rt:RT(d),rc:RC(d)});}}}
const L=C.DAYS.filter(ok),half=(A,p)=>A.filter((_,k)=>k%2===p);
function scheme(tag,fit,test){rowsFor(fit,test,tag,"test");for(const p of [0,1])rowsFor(half(fit,1-p),half(fit,p),tag,"train");}
scheme("fwd",L.filter(d=>D.dates[d]<"2026-09-01"),L.filter(d=>D.dates[d]>="2026-09-01"&&D.dates[d]<="2026-09-18"));
scheme("oddA",L.filter(d=>d%2===1),L.filter(d=>d%2===0));scheme("oddB",L.filter(d=>d%2===0),L.filter(d=>d%2===1));
C.setFit(null);fs.writeFileSync(process.argv[3],JSON.stringify(out));console.log(out.length,"rows");
