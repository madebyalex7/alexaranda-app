// Servidor de prueba: sirve panel.html en /panel y ejecuta Panel.gs (real) contra una hoja simulada en memoria.
import http from 'node:http'; import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const seed = JSON.parse(fs.readFileSync(path.join(DIR, 'seed.json'), 'utf8'));
// hoja simulada
function mkSheet(rows){ let data=rows.map(r=>r.slice()); const sh={
  getLastRow:()=>data.length, getLastColumn:()=>data.reduce((m,r)=>Math.max(m,r.length),0), getMaxRows:()=>1000,
  setFrozenRows(){},
  getRange(r,c,nr=1,nc=1){ return { getValues(){ const out=[]; for(let i=0;i<nr;i++){ const row=[]; for(let j=0;j<nc;j++){ const v=(data[r-1+i]||[])[c-1+j]; row.push(v==null?'':v);} out.push(row);} return out; },
    setValues(v){ for(let i=0;i<nr;i++){ while(data.length<r+i) data.push([]); for(let j=0;j<nc;j++) data[r-1+i][c-1+j]=v[i][j]; } return this; },
    setNumberFormat(){return this;}, setFontWeight(){return this;} }; } }; return sh; }
const sheets={}; for (const t of Object.keys(seed)) sheets[t]=mkSheet([seed[t].cols, ...seed[t].rows.map(r=>seed[t].cols.map(c=>r[c]))]);
const fmtParts=(d)=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(d).map(p=>[p.type,p.value]));
const ctx = vm.createContext({
  SpreadsheetApp:{ openById:()=>({ getSheetByName:(n)=>sheets[n]||null, insertSheet:(n)=>(sheets[n]=mkSheet([])) }) },
  LockService:{ getScriptLock:()=>({ tryLock:()=>true, releaseLock(){} }) },
  Utilities:{ formatDate(d,tz,f){ const p=fmtParts(d); const day=`${p.year}-${p.month}-${p.day}`; return f==='yyyy-MM-dd'?day:`${day}T${p.hour}:${p.minute}:${p.second}`; } },
  console, Date, Math, JSON, String, Object, parseFloat, isNaN
});
vm.runInContext(fs.readFileSync(path.join(DIR,'..','Panel.gs'),'utf8'), ctx, {filename:'Panel.gs'});
const LAT = +(process.env.LATENCIA||150);
http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');
  if(u.pathname==='/panel'){ res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); return res.end(fs.readFileSync(path.join(DIR,'..','panel.html'))); }
  if(u.pathname==='/panel/api' && req.method==='POST'){ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ setTimeout(()=>{
      let out; try{ out=ctx.P_despachar(JSON.parse(b)); }catch(e){ out={ok:false,error:String(e)}; }
      if(process.env.LOG) console.log(JSON.parse(b).accion, JSON.stringify(JSON.parse(b).datos||{}).slice(0,160), '->', out.ok);
      res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(out)); },LAT); }); return; }
  res.writeHead(404); res.end('no');
}).listen(+(process.env.PORT||8787),()=>console.log('mock en http://localhost:'+(process.env.PORT||8787)+'/panel?k=__PANEL_KEY__'));
