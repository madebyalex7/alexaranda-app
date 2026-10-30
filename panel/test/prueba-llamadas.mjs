import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const BASE='http://localhost:8818', URL=BASE+'/panel?k=__PANEL_KEY__';
const OUT=process.argv[2]||'/tmp/claude-0/llam';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const errores=[];
async function pag(w,h,dark){ const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,colorScheme:dark?'dark':'light'}); const p=await c.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|fonts/.test(m.text())) errores.push(m.text()); }); p.on('pageerror',e=>errores.push('pageerror: '+e.message));
  p.on('dialog',d=>d.accept());
  await p.goto(URL); await p.waitForSelector('#tabLlam'); await p.click('#tabLlam'); await p.waitForSelector('.lsec, .pantalla'); return p; }
const dump=async()=> (await fetch(BASE+'/dumpp')).json();
let p=await pag(390,844);
console.log('pestaña cuenta:', await p.textContent('#nLla'));
await p.screenshot({path:OUT+'/m-lista.png',fullPage:true});
console.log('secciones:', await p.$$eval('.lsec h2', hs=>hs.map(h=>h.textContent.trim())));
// abrir Laura (hoy)
await p.click('.lfila:has-text("Laura") .rc'); await p.waitForSelector('.lfila.abierta .rcuerpo');
await p.click('.lfila.abierta [data-lia="preparar"]'); await p.waitForTimeout(500);
console.log('chuleta:', (await p.inputValue('.lfila.abierta [data-lc="chuleta"]')).slice(0,40).replace(/\n/g,' | '));
await p.fill('.lfila.abierta [data-lg="objetivo"]','Quiere sentirse bien en verano'); await p.fill('.lfila.abierta [data-lc="notas_llamada"]','Muy motivada'); await p.waitForTimeout(900);
await p.screenshot({path:OUT+'/m-laura.png',fullPage:true});
// ha entrado
await p.click('.lfila.abierta [data-lentra]'); await p.waitForSelector('.lalta');
await p.click('.lalta [data-lplan]:has-text("6 meses")');
await p.selectOption('.lalta [data-lf="cuotas"]','4'); await p.waitForTimeout(200);
await p.setChecked('.lalta [data-lf="pagado"]',true); await p.waitForTimeout(200);
console.log('cuotas:', await p.$$eval('.lalta .lcob tr', t=>t.map(r=>[...r.querySelectorAll('input')].map(i=>i.value).join(' ')+' '+r.lastChild.textContent)));
await p.screenshot({path:OUT+'/m-alta.png',fullPage:true});
await p.click('.lalta [data-lcrear]'); await p.waitForTimeout(700);
console.log('tras crear:', (await p.textContent('.lfila.abierta .rsec:last-child')).replace(/\s+/g,' ').slice(0,160));
let d=await dump();
const cl=d.Clientes[d.Clientes.length-1], cab=d.Clientes[0];
console.log('cliente:', ['nombre','programa','inicio','fin','precio_total','forma_pago','cuotas','telefono','metodo'].map(k=>k+'='+cl[cab.indexOf(k)]).join(' '));
console.log('cobros:', d.Cobros.slice(-4).map(r=>r[1]+' '+r[4]+' '+r[5]+' '+r[6]+' '+r[7]).join(' | '));
console.log('altas:', d.Altas.length-1, d.Altas[1]&&d.Altas[1].slice(3,11).join(' / '));
// no entra: Pedro (pasada)
await p.click('.lfila:has-text("Pedro") .rc'); await p.waitForSelector('.lfila.abierta [data-lno]');
await p.click('.lfila.abierta [data-lno]'); await p.click('.lfila.abierta [data-lmot="Precio"]'); await p.waitForTimeout(400);
await p.click('.lfila.abierta [data-lia="seguimiento"]'); await p.waitForTimeout(500);
console.log('seguimiento msg:', (await p.inputValue('.lfila.abierta [data-lc="seguimiento_msg"]')).slice(0,50).replace(/\n/g,' '));
await p.screenshot({path:OUT+'/m-pedro.png',fullPage:true});
await p.click('.lfila.abierta [data-lescrito]'); await p.waitForTimeout(500);
d=await dump(); const L=d.Leads, lc=L[0]; const pe=L.find(r=>String(r[1]).includes('Pedro'));
console.log('pedro:', ['llamada_estado','motivo_no','seguimiento_paso','proximo_contacto','estado'].map(k=>k+'='+pe[lc.indexOf(k)]).join(' '));
// plan nuevo y editar precio
await p.click('details.lpl summary'); await p.fill('tr[data-plid] input[data-lp="precio"] >> nth=0','480'); await p.press('tr[data-plid] input[data-lp="precio"] >> nth=0','Tab'); await p.waitForTimeout(900);
d=await dump(); console.log('planes:', d.Planes.slice(1).map(r=>r[1]+':'+r[3]).join(' '));
// manual
await p.click('#lNueva'); await p.waitForTimeout(500); await p.fill('.lfila.abierta [data-lc="nombre"]','Lucía Manual'); await p.press('.lfila.abierta [data-lc="nombre"]','Tab'); await p.waitForTimeout(900);
console.log('manual en lista:', await p.$$eval('.lfila .rnom', n=>n.map(x=>x.textContent).filter(t=>t.includes('Lucía')).length));
console.log('scrollWidth:', await p.evaluate(()=>document.documentElement.scrollWidth));
await p.screenshot({path:OUT+'/m-final.png',fullPage:true});
let q=await pag(1280,900); await q.click('.lfila:has-text("Marta") .rc'); await q.waitForTimeout(300); await q.screenshot({path:OUT+'/d-marta.png',fullPage:true});
let r=await pag(390,844,true); await r.screenshot({path:OUT+'/m-oscuro.png',fullPage:true});
console.log('errores:', errores);
await b.close();
