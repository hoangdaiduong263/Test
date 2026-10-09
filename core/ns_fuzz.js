/* Kiểm tra bất biến engine New Seller trên hồ sơ ngẫu nhiên: node core/ns_fuzz.js <ref.json (NS_CACHE)> [số ca=300] [seed=1]
   Báo: lỗi chạy, số không hữu hạn, lượt cuối còn dồn, đơn không bảo toàn (chở + dồn = tổng), độ đầy > 100%, thêm người mà trễ hơn hẳn, kết luận lệch với các điều kiện. */
const fs=require("fs");const REF=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));const {nsPlan,NS_KS}=require("./newseller.js");
const N=+process.argv[3]||300;let seed=+process.argv[4]||1;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const ri=(a,b)=>a+Math.floor(rnd()*(b-a+1)),pick=a=>a[Math.floor(rnd()*a.length)],ch=p=>rnd()<p;
const fin=v=>typeof v==="number"&&isFinite(v);const issues={};let nErr=0,tMax=0,tSum=0,worstCase=null;
const bad=(k,info)=>{(issues[k]=issues[k]||[]).push(info);};
for(let it=0;it<N;it++){
  const R=pick(Object.keys(REF.reg)),G=REF.reg[R];
  const socs=G.soc.map(s=>({s,sh:ch(.3)?0:ri(1,100),km:ri(0,60),fw:false}));if(!socs.some(o=>o.sh>0))socs[0].sh=100;
  const nW=G.cots.length,win=G.cots.map(c=>{const a=ri(360,1380),b=a+ri(0,600);return ch(.4)?[Math.max(c.a,480),c.b]:[a,Math.min(b,c.p+60)];});
  const x={R,socs,open:ri(300,800),win,ado:[0,1,2].map(()=>ch(.1)?0:ri(20,20000)),days:ch(.8)?[25,4,1]:[0,1,2].map(()=>ri(0,31)),beta:rnd(),sh:G.cots.map(()=>ch(.2)?0:ri(0,100)),
    maxK:pick(NS_KS),bays:ri(1,6),ch:ch(.5)?null:[0,1,2].map(()=>ri(1,socs.length)),tail:ri(0,100),hoProf:pick(["even","end","lump","batch"]),hoN:ri(2,6),late:ch(.7)?0:ri(0,120),
    hoRate:ch(.6)?"":ri(50,3000),gates:ch(.6)?1:ri(2,5),gMode:pick(["auto","tour","each"]),gMove:ch(.5)?"":ri(0,30),capK:ch(.5)?{}:Object.fromEntries(NS_KS.filter(()=>ch(.4)).map(k=>[k,ri(50,3000)])),
    lab:pick(["fte","fte","hub","pps"]),ban:pick(["auto","off"]),osCap:ch(.7)?"":ri(1,60),slackMin:ch(.6)?0:ri(0,40),delay:ri(0,60),area:ch(.7)?"":ri(10,500),dens:ch(.7)?"":ri(1,50),
    hcIn:[0,1,2].map(()=>ch(.6)?"":ri(1,60)),ll:ch(.15)?null:[(G.pts.find(q=>q.ll)||{ll:[10.8,106.7]}).ll[0]+(rnd()-.5)*.4,(G.pts.find(q=>q.ll)||{ll:[10.8,106.7]}).ll[1]+(rnd()-.5)*.4],
    hub:"",sup:ch(.5)?"":(pick(G.hs||[["",""]])[1]||""),pick:ch(.3)&&G.rts?[ "r"+ri(0,G.rts.length-1)]:[],dwFix:ch(.8)?"":ri(0,60),dwRate:ch(.8)?"":ri(0,20),like:null};
  let p;const t0=Date.now();
  try{p=nsPlan(REF,x);}catch(e){nErr++;bad("EXCEPTION",{it,msg:e.message,stack:e.stack.split("\n").slice(0,3).join(" | ")});continue;}
  const dt=Date.now()-t0;tSum+=dt;if(dt>tMax){tMax=dt;worstCase={it,x:JSON.stringify(x).slice(0,400)};}
  if(!["go","cond","no"].includes(p.verdict))bad("verdict",{it,v:p.verdict});
  if(!fin(p.month.net))bad("month.net NaN",{it});
  p.days.forEach(d=>{if(!(d.X>0))return;const tag={it,R,t:d.t,X:d.X};
    ["net","cost","truck","lab","hc","worst"].forEach(k=>{if(!fin(d[k]))bad("day."+k+" not finite",{...tag,v:d[k]});});
    if(x.lab!=="pps"&&!(d.hc>=1))bad("hc<1",{...tag,hc:d.hc});
    if(d.hc>1000&&x.lab!=="pps")bad("hc>1000",{...tag,hc:d.hc});
    const W=d.W;W.forEach((w,j)=>{const wt={...tag,w:j};
      ["dep","done","slack","roll","Qt","fillU"].forEach(k=>{if(w[k]!=null&&!fin(w[k]))bad("wave."+k+" not finite",{...wt,v:w[k]});});
      if(w.roll<-0.01)bad("roll<0",wt);
      if(w.last&&w.roll>0.5)bad("LAST WAVE ROLLS",{...wt,roll:w.roll});
      if(j===W.length-1&&!w.last)bad("last flag missing",wt);
      if(w.fillU>1.02)bad("fillU>1",{...wt,f:w.fillU});
      if(w.fill>1.02&&!(w.shared&&w.shared.length))bad("plan fill>1",{...wt,f:w.fill});
      if(j>0&&Math.abs((W[j-1].roll||0)-(w.carryIn||0))>1)bad("carry mismatch",{...wt,prevRoll:W[j-1].roll,carryIn:w.carryIn});
      const ld=(w.trk||[]).reduce((a,z)=>a+(z.q||0),0);
      if(!w.last&&w.roll<=0.5&&w.dep>w.c.p+Math.max(0,-(p.slackMin??0))+0.5&&!(w.shared||[]).length)bad("non-last dep after COT w/o roll",{...wt,dep:w.dep,cot:w.c.p,pick:x.pick.length,shared:(w.shared||[]).length,hvW:w.hvW});
      (w.trk||[]).forEach(z=>{if(!fin(z.dep))bad("truck dep not finite",wt);});
      if(!(w.shared||[]).length&&(w.trk||[]).length&&Math.abs(ld-(w.Qt-w.roll))>2)bad("orders not conserved",{...wt,loaded:ld,Qt:w.Qt,roll:w.roll});
    });
    if(d.rec&&d.rec.ok&&d.hc>=d.rec.hc&&!(d.roll>0.5)===false&&x.lab!=="pps")bad("more staff than rec but rolls",{...tag,hc:d.hc,rec:d.rec.hc,roll:d.roll});
  });
  if(it%4===0&&x.lab!=="pps"){const x2=JSON.parse(JSON.stringify(x));x2.hcIn=p.days.map(d=>d.X>0?d.hc+3:"");const p2=nsPlan(REF,x2);
    p.days.forEach((d,t)=>{if(d.X>0&&p2.days[t].worst<d.worst-30&&!(p2.days[t].roll<d.roll-0.5)&&!(d.worst>1e8))bad("more staff -> later",{it,t,w1:d.worst,w2:p2.days[t].worst,hc:d.hc});});}
  if(p.be){if(p.be.ado&&p.be.ado.some(v=>!fin(v)))bad("be.ado NaN",{it});if(p.be.cap1T9!=null&&!fin(p.be.cap1T9))bad("cap1T9 NaN",{it});}
  (p.thrs||[]).forEach(v=>{if(v!=null&&!fin(v))bad("thr NaN",{it});});
  (p.mrg.list||[]).forEach(o=>{if(!fin(o.save))bad("mrg save NaN",{it,n:o.n});(o.fw||[]).forEach(e=>{["add","fO","fP","f0","f1","t0","t1"].forEach(k=>{if(!fin(e[k]))bad("fw."+k+" NaN",{it,n:o.n,v:e[k]});});});});
  const chk=p.ok,v=chk.profit&&chk.cot&&chk.people?(chk.thr&&chk.delay?"go":"cond"):"no";if(v!==p.verdict)bad("verdict mismatch",{it});
}
console.log("cases",N,"exceptions",nErr,"avg ms",(tSum/N).toFixed(0),"max ms",tMax);
for(const k in issues)console.log(k.padEnd(36),issues[k].length,JSON.stringify(issues[k].slice(0,2)).slice(0,600));
console.log("slowest",JSON.stringify(worstCase).slice(0,500));
