import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const URL='http://localhost:8827/panel?k=__PANEL_KEY__';
const OUT=process.argv[2]||'/tmp/claude-0/ronda'; 
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const errores=[];
async function pag(w,h,dark){ const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,colorScheme:dark?'dark':'light'}); const p=await c.newPage();
  p.on('console',m=>{ if(m.type()==='error') errores.push(m.text()); }); p.on('pageerror',e=>errores.push('pageerror: '+e.message));
  p.on('dialog',d=>d.accept());
  await p.goto(URL); await p.waitForSelector('#tabRonda'); await p.click('#tabRonda'); await p.waitForSelector('.rlista, .pantalla'); return p; }
let p=await pag(390,844);
await p.screenshot({path:OUT+'/m-lista.png',fullPage:true});
await p.click('.rfila[data-rid="r-ej-marta"] .rc'); await p.waitForSelector('.rfila.abierta .rcuerpo');
await p.screenshot({path:OUT+'/m-marta.png',fullPage:true});
// pedir otra versión del mensaje
await p.fill('.rfila.abierta input[data-ped="mensaje"]','más corto'); await p.click('.rfila.abierta [data-pedir="mensaje"]'); await p.waitForTimeout(400);
console.log('estado msg:', await p.textContent('.rfila.abierta .estado-m'));
// aplicar en ejemplo (debe dar error)
await p.click('.rfila.abierta .cambio[data-cid="c1"] [data-aplicar]'); await p.waitForTimeout(300);
console.log('sync tras aplicar ejemplo:', await p.textContent('#sync'));
// editar mensaje y marcar enviado
await p.fill('.rfila.abierta textarea[data-rc="mensaje"]','Hola Marta! prueba'); await p.waitForTimeout(900);
await p.click('.rfila.abierta [data-mest="enviado"]'); await p.waitForTimeout(300);
await p.click('.rfila.abierta [data-siguiente]'); await p.waitForTimeout(400);
console.log('abierta ahora:', await p.getAttribute('.rfila.abierta','data-rid'));
// tarjeta real: cambiar fecha a 2026-10-19
await p.selectOption('#rFecha','2026-10-19'); await p.waitForSelector('.rfila[data-rid="r-test"]');
await p.click('.rfila[data-rid="r-test"] .rc'); await p.waitForSelector('.rfila.abierta .cambio');
await p.click('.rfila.abierta .cambio[data-cid="c1"] [data-aplicar]'); await p.waitForTimeout(400);
await p.click('.rfila.abierta .cambio[data-cid="c2"] [data-aplicar]'); await p.waitForTimeout(400);
console.log('resultados:', await p.$$eval('.rfila.abierta .cr', e=>e.map(x=>x.textContent)));
await p.screenshot({path:OUT+'/m-real-aplicado.png',fullPage:true});
const dump=await (await fetch('http://localhost:8827/dump')).json();
console.log('maestra:', JSON.stringify(dump.m)); console.log('ajustes:', JSON.stringify(dump.aj)); console.log('aplicados:', dump.aplicados && dump.aplicados.length);
let d=await pag(1366,900); await d.click('.rfila[data-rid="r-ej-javier"] .rc'); await d.waitForTimeout(200); await d.screenshot({path:OUT+'/d-javier.png',fullPage:true});
let k=await pag(390,844,true); await k.click('.rfila[data-rid="r-ej-sole"] .rc'); await k.waitForTimeout(200); await k.screenshot({path:OUT+'/m-oscuro-sole.png',fullPage:true});
let s=await pag(360,740); console.log('scrollWidth 360:', await s.evaluate(()=>document.documentElement.scrollWidth));
console.log('errores:', errores.length?errores:'ninguno');
await b.close();
