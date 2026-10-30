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
if(process.env.REPORTES){
  const hist=[[3,3,3,6500,72.8,0],[2,3,3,7200,72.6,2],[3,3,4,8100,72.5,3],[3,3,4,7900,72.1,2],[2,3,3,8400,72.2,4],[3,3,4,9000,71.9,5]];
  const est=['hecho','','hecho','','flojo','',''];
  ej.forEach((f,i)=>{ const d=JSON.parse(f.datos||'{}'); d.historia=hist.map((h,k)=>({semana:String(k+1),entrenos:h[0]-(i&&k===5?1:0),objetivo:h[1],energia:h[2],pasos:h[3],peso:h[4],molestia:h[5]})); d.dias=est.map(e=>({estado:e})); f.datos=JSON.stringify(d); });
  const v=(id,cli,quedan,msg,tit)=>({id,fecha:'2026-10-23',tipo:'viernes',cliente_id:'c0'+id.slice(-1),cliente:cli,orden:'1',semaforo:quedan?'amarillo':'verde',titular:tit,semana_entreno:'Lleva 2 de 3. El martes con poca energía, lo hizo tranquilo.',semana_personal:'Sábado comida familiar; domingo libre.',datos:JSON.stringify({entrenos:{hechos:3-quedan,objetivo:3},quedan,energia:'normal',dias:[{estado:'hecho'},{estado:''},{estado:quedan?'flojo':'hecho'},{estado:''},{estado:quedan?'toca':'hecho'},{estado:''},{estado:''}]}),mensaje:msg,mensaje_estado:'propuesto',ejemplo:'TRUE'});
  { const d0=JSON.parse(ej[0].datos); d0.motiva='Las dominadas: el martes hizo 3 seguidas sin goma y lo contó con un audio de 2 minutos'; d0.fotos={proxima:'2026-10-20',ultima:'2026-09-22',estado:'pendiente'}; d0.anadir=[{titulo:'🚀 Objetivo de la semana',texto:'Esta semana vas muy liada, así que vamos a por 2 entrenos: lunes y miércoles. Si un día vas justa, la versión mínima cuenta igual 🚀'}]; ej[0].datos=JSON.stringify(d0);
    const c0=JSON.parse(ej[0].cambios||'[]'); if(c0[0]){ c0[0].params=Object.assign({},c0[0].params,{semanas:2,viejo:'bulgara'}); } ej[0].cambios=JSON.stringify(c0);
    const d1=JSON.parse(ej[1].datos); d1.oportunidad={tipo:'grandslam',texto:'Mes 3, 4 semanas completas y muy contenta con los centímetros: buen momento para ofrecerle el anual.'}; ej[1].datos=JSON.stringify(d1); ej[1].cliente_id='c03'; }
  ej.push({id:'r-m-1',fecha:'2026-10-22',tipo:'revision',cliente_id:'c08',cliente:'Claudia (mensual de ejemplo)',orden:'1',semaforo:'amarillo',titular:'Primer mes: 9 de 12 entrenos y −3 cm de cintura',semana_entreno:'Mes irregular al principio, las 2 últimas semanas completas.',semana_personal:'Mucho trabajo; dice que ya no le cuesta tanto ponerse.',
    datos:JSON.stringify({semana_programa:4,entrenos:{hechos:3,objetivo:3},historia:[[1,3,2,73.4],[2,3,3,73.1],[3,3,3,72.9],[3,3,4,72.6]].map((h,k)=>({semana:String(k+1),entrenos:h[0],objetivo:h[1],energia:h[2],peso:h[3]})),constancia:{hechos:9,previstos:12,semanas_completas:2,racha:'2 semanas'},medidas:[{zona:'Cintura',antes:82,ahora:79},{zona:'Cadera',antes:101,ahora:99.5},{zona:'Muslo',antes:58,ahora:57.5}],marcas:[{ej:'Hip thrust',inicio:'20 kg × 10',ahora:'35 kg × 10'},{ej:'Remo con mancuerna',inicio:'6 kg × 10',ahora:'10 kg × 12'}],fotos:{ultima:'2026-10-21',estado:'hecha',proxima:'2026-11-18',carpeta:'https://drive.google.com/'},aprendido:'Ya se organiza los días el domingo.',foco:'Pasar de 2 a 3 días fijos y cenar antes de las 22.',anadir:[{titulo:'Mini objetivo 1',texto:'Para este mes: 3 días fijos a la semana, aunque uno sea la versión corta'},{titulo:'Mini objetivo 2',texto:'Cenar antes de las 22 al menos 4 días'}]}),
    mensaje:'Claudia!\n\nUn mes ya, y 3 cm menos de cintura 💪\n\nUn abrazo!',mensaje_estado:'propuesto',ejemplo:'TRUE'});
  ej.push(v('r-v-1','Sole Peña',1,'Genial Sole!\n\nDos entrenos con la semana que llevas, y el del miércoles tranquilo cuenta igual.\n\nTe queda el del viernes: si sale, dale. Y el domingo el formulario, vale? Buen finde!','Le queda un entreno; comida familiar el sábado'),v('r-v-2','Marta',0,'Semana completa Marta! Disfruta el finde y el domingo me rellenas el formulario. Un abrazo!','Semana completa'));
}
const filas=ej.map(f=>RC.map(c=>f[c]||''));
// una tarjeta real (no ejemplo) para probar «Aplicar» contra la hoja de app simulada
const real=Object.assign({},ej[0],{id:'r-test',cliente:'Prueba Real',ejemplo:'',codigo_app:'PRUEBA-1',fecha:'2026-10-19'});
filas.push(RC.map(c=>real[c]||''));
panel.Ronda=[RC,...filas];
if(process.env.REPORTES){ const ci=panel.Clientes[0].indexOf('fin'); const r3=panel.Clientes.find(r=>r[0]==='c03'); if(r3) r3[ci]=new Date(Date.now()+12*864e5).toISOString().slice(0,10); }
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
        else if(u.pathname==='/panel/ia'&&body.que==='versiones'){ out=process.env.IA_FALLA?{ok:false,error:'API 529 Overloaded'}:{ok:true,data:{versiones:[{tipo:'cercano',titulo:'Más cercano',texto:'Sole!\n\nDos entrenos con la semana que llevabas, y el del miércoles tranquilo cuenta igual.\n\nUn abrazo!'},{tipo:'directo',titulo:'Más directo',texto:'Sole, 2 de 3 esta semana.\n\nEl viernes, la versión corta y listo. Dale!'},{tipo:'corto',titulo:'Más corto',texto:'2 de 3 con la semana que llevas, Sole. El viernes, versión corta 💪'}]}}; }
        else if(u.pathname==='/panel/ia'){ const r=ctx.P_despachar({k:body.k,accion:'rondaPedir',datos:body}); out=r.ok?{ok:true,data:{fila:r.data,ia:false}}:r; }
        else if(body.accion==='avisos') out={ok:true,data:{avisos:[{id:'S|1',codigo:'SOLE-BG7KGUVT',cliente:'Sole Peña',cliente_id:'c03',telefono:'34600111222',tipo:'molestia',nivel:'rojo',titulo:'Molestia de 7/10 en Goblet',detalle:'Día 1 de la semana 1.'},{id:'S|2',codigo:'SOLE-BG7KGUVT',cliente:'Sole Peña',cliente_id:'c03',telefono:'',tipo:'semana',nivel:'ambar',titulo:'Semana a medias: lleva 1 de 3',detalle:'Por sus días ya tocaban 2 (sin hacer: Día 2, miércoles).'},{id:'T|1',codigo:'TXUS',cliente:'Txus Balles',cliente_id:'',telefono:'',tipo:'nota',nivel:'ambar',titulo:'Te ha dejado una nota',detalle:'«El hombro bien, pero la prensa se me hizo larga» · Día 2, semana 1'}],errores:[]}};
        else if(body.accion==='entregas') out={ok:true,data:{entregas:[{id:'e1',cliente_id:'c03',cliente:'Sole Peña',telefono:'34600111222',tipo:'formulario',formulario:'Puesta al día',desde:'2026-10-23',dias:1,notas:''},{id:'e2',cliente_id:'',cliente:'Miguel Merodio',telefono:'',tipo:'fotos',formulario:'',desde:'2026-10-20',dias:4,notas:'fotos del mes'}],hoy:'2026-10-24'}};
        else if(body.accion==='avisoVisto') out={ok:true,data:{ok:true}};
        else if(body.accion==='calendarioCliente'){ const iso=d=>d.toISOString().slice(0,10), hoy=new Date(), lun=new Date(hoy); lun.setDate(lun.getDate()-((lun.getDay()+6)%7)-7*5);
          const semanas=[], entrenos=[], peso=[], extras=[];
          for(let w=1;w<=6;w++){ const l=new Date(lun); l.setDate(l.getDate()+(w-1)*7); let h=0;
            [['d1',0],['d2',2],['d3',4]].forEach(([k,o],i)=>{ const f=new Date(l); f.setDate(f.getDate()+o); if(f>hoy) return; if((w===3&&k==='d3')||(w===5&&k!=='d1')) return; entrenos.push({fecha:iso(f),w,k,hecho:true,flojo:w===4&&k==='d2'}); h++; });
            const v=new Date(l); v.setDate(v.getDate()+4); if(v<=hoy) peso.push({fecha:iso(v),peso:(72.8-w*0.2).toFixed(1)});
            const pa=new Date(l); pa.setDate(pa.getDate()+5); if(pa<=hoy) extras.push({fecha:iso(pa),tipo:'Caminar',min:40});
            semanas.push({w,lunes:iso(l),objetivo:3,hechos:h}); }
          const m4=new Date(lun); m4.setDate(m4.getDate()+3*7+4);
          out={ok:true,data:{nombre:'Sole',semana:6,desde:1,hoy:iso(hoy),entrenos,peso,medidas:[iso(m4)],fotos:[iso(m4)],extras,semanas,dias:{d1:{n:'Día 1',ds:'lunes'},d2:{n:'Día 2',ds:'miércoles'},d3:{n:'Día 3',ds:'viernes'}}}}; }
        else if(body.accion==='fotos') out={ok:true,data:{cliente:'Claudia',fotos:['2026-09-22','2026-10-21','2026-08-25','2026-07-28'].flatMap(f=>['frente','lado','espalda'].filter((t,i)=>!(f==='2026-07-28'&&i==2)).map(t=>({id:f+'_'+t,fecha:f,tipo:t,mini:'',de:'app'})))}};
        else if(body.accion==='formularios') out={ok:true,data:{cliente:'Claudia',formularios:[
          {tipo:'Mensual',fecha:'2027-01-05T10:00',qa:[['Cómo te sientes este mes?','Subo las escaleras de casa sin pararme y la ropa me queda mejor. Me siento más fuerte.'],['Qué puedes hacer ahora que hace un mes no podías?','Hacer 10 flexiones en la encimera seguidas'],['Cintura (cm)','78'],['Del 1 al 5, cómo vas de… [Estrés (1 = nada, 5 = muchísimo)]','2'],['Del 1 al 5, cómo vas de… [Descanso y recuperación]','4'],['Cuántas horas has dormido de media estas semanas?','7']]},
          {tipo:'Semanal',fecha:'2026-12-20T10:00',qa:[['Cómo ha sido esta semana?','Normal']]},
          {tipo:'Primer mes',fecha:'2026-11-02T10:00',qa:[['Cómo te ves y cómo te notas este mes?','Con más energía'],['Me dejas usar alguna frase tuya, sin tu nombre, en mis redes?','Sí'],['Si tuvieras que resumir tu primer mes en una frase, cuál sería?','Por fin he encontrado algo que me engancha y que puedo mantener con mi trabajo']]},
          {tipo:'Inicial',fecha:'2026-10-05T10:00',qa:[['Cómo te ves y cómo te sientes hoy?','Me veo hinchada y sin energía, me cuesta subir escaleras y no me gusta cómo me queda la ropa'],['Qué quieres conseguir?','Sentirme fuerte y bajar la tripa'],['Y si dentro de 6 meses todo siguiera igual, cómo te sentirías?','Fatal, decepcionada conmigo'],['Cintura (cm)','82'],['Del 1 al 5, cuánto estrés tienes últimamente?','4'],['Y del 1 al 5, qué tal duermes?','2'],['Cuántas horas duermes?','6'],['Cuántas comidas haces al día?','3']]}]}};
        else { out=ctx.P_despachar(body); if(out.ok&&body.accion==='rondaCargar') out.data.ia=false; if(out.ok&&body.accion==='llamadasCargar') out.data.ia=!process.env.SIN_IA; }
      }catch(e){ out={ok:false,error:String(e)}; }
      if(process.env.LOG) console.log(body.accion||'ia', '->', out.ok, out.error||'');
      send(out); },LAT); }); return; }
  if(u.pathname==='/panel/foto' && /_frente$/.test(u.searchParams.get('id')||'') && fs.existsSync('/tmp/claude-0/s/ana/antes.jpg')){ const id=u.searchParams.get('id'); res.writeHead(200,{'Content-Type':'image/jpeg'}); return res.end(fs.readFileSync('/tmp/claude-0/s/ana/'+(id.startsWith('2026-10-21')?'despues':'antes')+'.jpg')); }
  if(u.pathname==='/panel/foto'){ const id=u.searchParams.get('id')||''; const col={frente:'#c9a27e',lado:'#8fa3b8',espalda:'#9bb59a'}[id.split('_')[1]]||'#ccc'; res.writeHead(200,{'Content-Type':'image/svg+xml'}); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="'+col+'"/><text x="40" y="420" font-size="48" fill="#222">'+id+'</text></svg>'); }
  res.writeHead(404); res.end('no');
}).listen(+(process.env.PORT||8798),()=>console.log('mock ronda http://localhost:'+(process.env.PORT||8798)+'/panel?k=__PANEL_KEY__'));
