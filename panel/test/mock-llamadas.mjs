// Mock con Ronda y Llamadas: Panel.gs real + stubs de Code.gs (D_cliente, D_cache, MAESTRA_ID, VERSION_DATOS) + hoja de app simulada
import http from 'node:http'; import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const seed = JSON.parse(fs.readFileSync(path.join(DIR, 'seed.json'), 'utf8'));
const ej = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'ronda', 'ejemplo.json'), 'utf8'));
function mkSheet(rows, name){ let data=rows.map(r=>r.slice()); const sh={ name, data:()=>data,
  getLastRow:()=>data.length, getLastColumn:()=>data.reduce((m,r)=>Math.max(m,r.length),0), getMaxRows:()=>1000, setFrozenRows(){},
  appendRow(r){ data.push(r.slice()); },
  getDataRange(){ return this.getRange(1,1,Math.max(data.length,1),Math.max(this.getLastColumn(),1)); },
  getRange(r,c,nr=1,nc=1){ return { getValues(){ const out=[]; for(let i=0;i<nr;i++){ const row=[]; for(let j=0;j<nc;j++){ const v=(data[r-1+i]||[])[c-1+j]; row.push(v==null?'':v);} out.push(row);} return out; },
    setValues(v){ for(let i=0;i<nr;i++){ while(data.length<r+i) data.push([]); for(let j=0;j<nc;j++) data[r-1+i][c-1+j]=v[i][j]; } return this; },
    setValue(x){ while(data.length<r) data.push([]); data[r-1][c-1]=x; return this; },
    setNumberFormat(){return this;}, setFontWeight(){return this;} }; } }; return sh; }
function book(tabs){ const sheets={}; for(const [n,rows] of Object.entries(tabs)) sheets[n]=mkSheet(rows,n); return { sheets, getSheetByName:(n)=>sheets[n]||null, insertSheet:(n)=>(sheets[n]=mkSheet([],n)) }; }
const panel={}; for (const t of Object.keys(seed)) panel[t]=[seed[t].cols, ...seed[t].rows.map(r=>seed[t].cols.map(c=>r[c]))];
const RC=['id','fecha','tipo','cliente_id','cliente','codigo_app','orden','semaforo','titular','semana_personal','semana_entreno','datos','progreso','tener_en_cuenta','voz','mensaje','mensaje_estado','mensaje_peticion','mensaje_versiones','cambios','nota_alex','revisado','ejemplo','actualizado','archivado'];
const filas=ej.map(f=>RC.map(c=>f[c]||''));
// una tarjeta real (no ejemplo) para probar «Aplicar» contra la hoja de app simulada
const real=Object.assign({},ej[0],{id:'r-test',cliente:'Prueba Real',ejemplo:'',codigo_app:'PRUEBA-1',fecha:'2026-10-19'});
filas.push(RC.map(c=>real[c]||''));
panel.Ronda=[RC,...filas];
const BOOKS={ PANEL: book(panel),
  MAESTRA: book({'Semana de Alex':[['codigo','nota','valida_hasta']]}),
  APP1: book({Ajustes:[['clave','valor'],['semana',5],['dias_semana',4]], Plan:[['dia','orden','ejercicio_id','nombre','series','repes'],['d1',1,'sentadilla-goblet','Goblet',3,'10-12'],['d1',2,'bulgara','Búlgara',3,'8-10']]}) };
const fmtParts=(d)=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(d).map(p=>[p.type,p.value]));
const H=(h)=>new Date(Date.now()+h*36e5);
const EVS=[
  {t:'Llamada con Laura Gómez',d:'IG: @laura.fit\nWA: +34 600 111 222',s:H(3)},
  {t:'Dentista',d:'',s:H(6)},{t:'Llamada con Sole Peña',d:'',s:H(8)},{t:'Revisión llamada Gris',d:'',s:H(9)},
  {t:'Llamada - Marta Ruiz',d:'instagram.com/marta_r\nTel: 611 222 333',s:H(50)},
  {t:'Llamada valoración Pedro',d:'IG: pedro.runs',s:H(-30)},
];
const CAL={getTimeZone:()=>'Europe/Madrid',getEvents:()=>EVS.map((e,i)=>({getTitle:()=>e.t,getDescription:()=>e.d,getStartTime:()=>e.s,getId:()=>'ev'+i,isAllDayEvent:()=>false}))};
const ctx = vm.createContext({
  CalendarApp:{ getDefaultCalendar:()=>CAL },
  SpreadsheetApp:{ openById:(id)=> id==='M'?BOOKS.MAESTRA: id==='APP1'?BOOKS.APP1: BOOKS.PANEL },
  LockService:{ getScriptLock:()=>({ tryLock:()=>true, releaseLock(){} }) },
  Utilities:{ formatDate(d,tz,f){ const p=fmtParts(d); const day=`${p.year}-${p.month}-${p.day}`; if(f.indexOf('XXX')>0){ const off=Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute)-Math.floor(d.getTime()/6e4)*6e4)/6e4); const a=Math.abs(off); return `${day}T${p.hour}:${p.minute}${off>=0?'+':'-'}${String(Math.floor(a/60)).padStart(2,'0')}:${String(a%60).padStart(2,'0')}`; } return f==='yyyy-MM-dd'?day:f.indexOf(':ss')>0?`${day}T${p.hour}:${p.minute}:${p.second}`:`${day}T${p.hour}:${p.minute}`; } },
  MAESTRA_ID:'M', VERSION_DATOS:'v', D_cache:()=>({remove(){}}), D_cliente:(c)=> c==='PRUEBA-1'?{hoja:'APP1'}:null,
  console, Date, Math, JSON, String, Object, parseFloat, parseInt, isNaN
});
vm.runInContext(fs.readFileSync(path.join(DIR,'..','Panel.gs'),'utf8'), ctx, {filename:'Panel.gs'});
globalThis.__BOOKS=BOOKS; globalThis.__ctx=ctx;
const LAT=+(process.env.LATENCIA||60);
http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');
  const send=(o)=>{ res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(o)); };
  if(u.pathname==='/panel'){ res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); return res.end(fs.readFileSync(path.join(DIR,'..','panel.html'))); }
  if(u.pathname==='/dumpp'){ const t=(n)=>(BOOKS.PANEL.sheets[n]||{data:()=>null}).data(); return send({Clientes:t('Clientes'),Cobros:t('Cobros'),Altas:t('Altas'),Leads:t('Leads'),Planes:t('Planes')}); }
  if(u.pathname==='/dump'){ return send({app:BOOKS.APP1.sheets, m:BOOKS.MAESTRA.sheets['Semana de Alex'].data(), plan:BOOKS.APP1.sheets.Plan.data(), aj:BOOKS.APP1.sheets.Ajustes.data(), prog:(BOOKS.APP1.sheets['Progresión']||{data:()=>null}).data(), aplicados:(BOOKS.PANEL.sheets.Aplicados||{data:()=>null}).data()}); }
  if((u.pathname==='/panel/api'||u.pathname==='/panel/ia') && req.method==='POST'){ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ setTimeout(()=>{
      let body=JSON.parse(b), out;
      try{
        if(u.pathname==='/panel/ia'&&body.que==='lead'){ const l=ctx.LL_lead(body.id); const txt=body.modo==='seguimiento'?'Hola '+l.nombre+'!\n\nMe acordé de lo que me contaste'+(body.peticion?' ('+body.peticion+')':'')+'. Qué tal la semana?':'QUIÉN ES\n'+l.nombre+(l.preocupacion?', le preocupa: '+l.preocupacion:'')+'\n\nPREGUNTAS ADAPTADAS\n- Situación: cuéntame cómo es tu semana con el trabajo\n- Objetivo: qué te gustaría notar en 3 meses?'; const r=ctx.P_despachar({k:body.k,accion:'llamadaIA',datos:{id:body.id,texto:txt,modo:body.modo}}); out=r.ok?{ok:true,data:{lead:r.data,ia:true}}:r; }
        else if(u.pathname==='/panel/ia'){ const r=ctx.P_despachar({k:body.k,accion:'rondaPedir',datos:body}); out=r.ok?{ok:true,data:{fila:r.data,ia:false}}:r; }
        else if(body.accion==='avisos') out={ok:true,data:{avisos:[{id:'S|1',codigo:'SOLE-BG7KGUVT',cliente:'Sole Peña',cliente_id:'c03',telefono:'34600111222',tipo:'molestia',nivel:'rojo',titulo:'Molestia de 7/10 en Goblet',detalle:'Día 1 de la semana 1.'},{id:'S|2',codigo:'SOLE-BG7KGUVT',cliente:'Sole Peña',cliente_id:'c03',telefono:'',tipo:'semana',nivel:'ambar',titulo:'Semana a medias: lleva 1 de 3',detalle:'Por sus días ya tocaban 2 (sin hacer: Día 2, miércoles).'},{id:'T|1',codigo:'TXUS',cliente:'Txus Balles',cliente_id:'',telefono:'',tipo:'nota',nivel:'ambar',titulo:'Te ha dejado una nota',detalle:'«El hombro bien, pero la prensa se me hizo larga» · Día 2, semana 1'}],errores:[]}};
        else if(body.accion==='entregas') out={ok:true,data:{entregas:[{id:'e1',cliente_id:'c03',cliente:'Sole Peña',telefono:'34600111222',tipo:'formulario',formulario:'Puesta al día',desde:'2026-10-23',dias:1,notas:''},{id:'e2',cliente_id:'',cliente:'Miguel Merodio',telefono:'',tipo:'fotos',formulario:'',desde:'2026-10-20',dias:4,notas:'fotos del mes'}],hoy:'2026-10-24'}};
        else if(body.accion==='avisoVisto') out={ok:true,data:{ok:true}};
        else { out=ctx.P_despachar(body); if(out.ok&&body.accion==='rondaCargar') out.data.ia=false; if(out.ok&&body.accion==='llamadasCargar') out.data.ia=!process.env.SIN_IA; }
      }catch(e){ out={ok:false,error:String(e)}; }
      if(process.env.LOG) console.log(body.accion||'ia', '->', out.ok, out.error||'');
      send(out); },LAT); }); return; }
  res.writeHead(404); res.end('no');
}).listen(+(process.env.PORT||8798),()=>console.log('mock ronda http://localhost:'+(process.env.PORT||8798)+'/panel?k=__PANEL_KEY__'));
