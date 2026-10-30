import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const URL='http://localhost:8799/panel?k=__PANEL_KEY__';
const OUT=process.argv[2]||'.';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const errores=[];
async function pag(w,h,dark){ const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,colorScheme:dark?'dark':'light'}); const p=await c.newPage();
  p.on('console',m=>{ if(m.type()==='error'||m.type()==='warning') errores.push(m.type()+': '+m.text()); }); p.on('pageerror',e=>errores.push('pageerror: '+e.message));
  await p.goto(URL); await p.waitForSelector('.resumen'); return p; }
let p=await pag(390,844);
await p.screenshot({path:OUT+'/movil-clientes.png',fullPage:true});
// abrir Claudia y editar
await p.click('.fila[data-id="c08"] .cab'); await p.waitForSelector('.fila.abierta .ficha');
await p.fill('.fila.abierta [data-campo="semaforo_nota"]','Prueba de nota');
await p.click('.fila.abierta [data-semaf="verde"]');
await p.waitForTimeout(1500);
await p.screenshot({path:OUT+'/movil-ficha-cliente.png',fullPage:false});
const sync=await p.textContent('#sync'); console.log('sync:',sync);
await p.click('#tabLeads'); await p.waitForSelector('.lista.lea');
await p.screenshot({path:OUT+'/movil-leads.png',fullPage:true});
await p.click('.fila[data-id="l03"] .cab'); await p.click('.fila.abierta [data-pospon="7"]'); await p.waitForTimeout(800);
await p.click('#btnNuevo'); await p.waitForFunction(()=>{ const i=document.querySelector('.fila.abierta [data-campo="nombre"]'); return i && i.value===''; }); await p.fill('.fila.abierta [data-campo="nombre"]','Lead de prueba'); await p.waitForTimeout(1500);
await p.screenshot({path:OUT+'/movil-lead-nuevo.png'});
// recargar y comprobar persistencia
await p.reload(); await p.waitForSelector('.resumen, .lista.lea');
const persist=await p.evaluate(()=>document.body.innerText.includes('Lead de prueba'));
console.log('persistencia lead nuevo:',persist);
console.log('l03 intacto:', await p.evaluate(()=>document.querySelector('.fila[data-id="l03"] .nom').textContent));
await p.click('#tabClientes'); await p.click('.fila[data-id="c08"] .cab');
console.log('nota guardada:', await p.inputValue('.fila.abierta [data-campo="semaforo_nota"]'));
let d=await pag(1366,900);
await d.screenshot({path:OUT+'/escritorio-clientes.png',fullPage:true});
await d.click('#tabLeads'); await d.screenshot({path:OUT+'/escritorio-leads.png',fullPage:true});
let k=await pag(390,844,true); await k.screenshot({path:OUT+'/movil-oscuro.png'});
let s=await pag(360,740); const sw=await s.evaluate(()=>document.documentElement.scrollWidth); console.log('scrollWidth a 360:',sw);
console.log('errores consola:',errores.length?errores:'ninguno');
await b.close();
