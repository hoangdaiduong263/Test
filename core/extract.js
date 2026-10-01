/* Tách dữ liệu (const D) và bảng tham chiếu (COT, giờ mở/đóng cửa, hub trả tiền xe) từ app cũ.
   node core/extract.js gas/App.html <app cũ đã build (.html)> <data.js ra> */
const fs=require('fs');const app=fs.readFileSync(process.argv[2],'utf8').split('\n');
const want=['SCHED','HYS','COTS','CLOSE','COT_NHY','HANDOVER','OPENT'];const ref={};
const txt=app.join('\n');for(const name of want){const st=txt.indexOf('\nconst '+name+'=')+('\nconst '+name+'=').length;let dep=0,k=st,q=null;
  for(;k<txt.length;k++){const c=txt[k];if(q){if(c==='\\'){k++;continue;}if(c===q)q=null;continue;}if(c==='"'||c==="'")q=c;else if(c==='{'||c==='[')dep++;else if(c==='}'||c===']'){dep--;if(dep===0){k++;break;}}}
  ref[name]=eval('('+txt.slice(st,k)+')');}
const out={COTS:ref.COTS,COT_NHY:ref.COT_NHY,CLOSE:ref.CLOSE,HANDOVER:ref.HANDOVER,OPENT:ref.OPENT,HY:Object.keys(ref.HYS),HUBPAY:Object.keys(ref.SCHED).filter(k=>ref.SCHED[k].hub)};
const art=fs.readFileSync(process.argv[3],'utf8').split('\n');const dl=art.find(l=>l.startsWith('const D='));
fs.writeFileSync(process.argv[4],dl.replace(/;?\s*$/,';')+'\nconst REF='+JSON.stringify(out)+';\n');
console.log(Object.fromEntries(Object.entries(out).map(([k,v])=>[k,Array.isArray(v)?v.length:Object.keys(v).length])),(fs.statSync(process.argv[4]).size/1e6).toFixed(2)+'MB');
