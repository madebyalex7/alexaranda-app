const { chromium } = require('playwright');
const fs = require('fs');
const html = fs.readFileSync('../Index.html','utf8')
  .replace('<?!= codigoJson ?>', '"SOLE-V6Y3E4"').replace('<?!= vistaJson ?>', '"home"');
const mock = (data, failFirst) => `<script>
window.__ops=[]; window.__calls=0; window.__fail=${failFirst?1:0};
window.google={script:{run:(function mk(ok,ko){return {
  withSuccessHandler(f){return mk(f,ko)}, withFailureHandler(f){return mk(ok,f)},
  api(accion,codigo,datos){ window.__calls++; setTimeout(()=>{
    if(accion==='sincronizar' && window.__fail>0){ window.__fail--; ko(new Error('offline')); return; }
    if(accion==='cargar') ok({ok:true,data:JSON.parse(JSON.stringify(${JSON.stringify(data)}))});
    else { window.__ops.push(...datos.ops); ok({ok:true,data:{hechas:datos.ops.length,errores:[]}}); }
  }, accion==='cargar'?400:80); }
}})()}};
</script>`;
const errs=[]; const shots=[];
(async()=>{
  const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}).catch(()=>chromium.launch());
  async function nueva(data, failFirst){
    const ctx = await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true});
    await ctx.route('https://fonts.googleapis.com/**', r=>r.fulfill({contentType:'text/css', body:''}));
    await ctx.route('https://fonts.gstatic.com/**', r=>r.fulfill({status:204, body:''}));
    await ctx.route('https://lh3.googleusercontent.com/**', r=>r.fulfill({contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="675"><rect width="900" height="675" fill="#fff"/><circle cx="450" cy="300" r="120" fill="#E9DDCE"/><text x="450" y="560" font-size="36" text-anchor="middle" fill="#6E5A4A" font-family="sans-serif">imagen del ejercicio (simulada)</text></svg>'}));
    await ctx.route('https://www.youtube-nocookie.com/**', r=>r.fulfill({contentType:'text/html', body:'<body style="margin:0;background:#000;color:#fff;display:grid;place-items:center;font:16px sans-serif;height:100vh">▶ vídeo (simulado en la prueba)</body>'}));
    await ctx.route('http://app.local/', r=>r.fulfill({contentType:'text/html', body: html.replace('<head>','<head>'+mock(data,failFirst))}));
    const page = await ctx.newPage();
    page.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
    page.on('pageerror', e=>errs.push('pageerror: '+e.message));
    await page.goto('http://app.local/');
    return {ctx,page};
  }
  const shot = async (page,name)=>{ const p=`/tmp/claude-0/app-${name}.png`; await page.screenshot({path:p, fullPage:true}); shots.push(p); };
  const A = JSON.parse(fs.readFileSync('mockA.json')), B = JSON.parse(fs.readFileSync('mockB.json'));

  // ── A · datos reales de Sole ──
  let {ctx,page} = await nueva(A, true);
  await page.waitForTimeout(100); await shot(page,'00-cargando');
  await page.waitForSelector('h1'); await shot(page,'01-home');
  for (const k of ['d1','d2','d3','st']) {
    await page.click(`.card[data-d="${k}"]`); await page.waitForSelector('.dayhead');
    if (k==='d1') { await page.click('details.como summary'); }
    await shot(page,`02-dia-${k}`);
    await page.click('#volver');
  }
  // Día 1: apuntar series, marcar hecho, cierre (con primer envío fallando = sin conexión)
  await page.click('.card[data-d="d1"]');
  await page.fill('#p-d1-0-0','7'); await page.fill('#r-d1-0-0','12'); await page.check('#c-d1-0-0');
  await page.click('[data-mol="1"][data-v="5"]');
  await page.click('#hecho'); await page.waitForSelector('.fin');
  await page.click('[data-feel="4"]'); await page.fill('#nota-d1','Me ha ido bien, el cuello ni lo he notado');
  await page.waitForTimeout(400);
  const colaOffline = await page.evaluate(()=>JSON.parse(localStorage.getItem('cola_SOLE-V6Y3E4')||'[]').length);
  await shot(page,'03-cierre');
  await page.waitForTimeout(4500);   // reintento automático
  const colaDespues = await page.evaluate(()=>JSON.parse(localStorage.getItem('cola_SOLE-V6Y3E4')||'[]').length);
  const ops = await page.evaluate(()=>window.__ops);
  // Día flojo
  await page.click('#volver'); await page.click('.card[data-d="d2"]'); await page.check('#flojo-d2'); await page.waitForTimeout(100); await shot(page,'04-dia-flojo');
  await page.click('#volver');
  // Extra
  await page.click('.card[data-d="extra"]'); await page.click('[data-tipo="Correr"]'); await page.fill('#min','32'); await page.fill('#km','5,2'); await page.click('[data-feel="5"]');
  await shot(page,'05-extra-form'); await page.click('#xguardar'); await page.waitForTimeout(150); await shot(page,'06-extra-guardado');
  await page.click('#volver');
  // Pasos y paleta rosa
  await page.fill('#pasos','9200'); await page.click('#pasosOk');
  await page.click('#ajbtn'); await page.click('[data-pal="rosa"]'); await shot(page,'07-home-rosa-pasos');
  await page.click('[data-pal="marca"]');
  await page.click('#t-week'); await shot(page,'08-semana');
  // Recarga: debe salir al instante con lo guardado en el móvil
  await page.reload(); await page.waitForSelector('h1', {timeout:300}); const recargaInstantanea = true;
  await ctx.close();

  // ── B · simulación semana 4 con historial ──
  ({ctx,page} = await nueva(B, false));
  await page.waitForSelector('h1'); await shot(page,'10-sim-home');
  await page.click('.card[data-d="d1"]'); await page.waitForSelector('.dayhead');
  await page.fill('#p-d1-0-1','9'); await page.fill('#r-d1-0-1','12'); await page.waitForTimeout(50);
  const badge = await page.isVisible('#badge-d1-0'); await shot(page,'11-sim-d1-pistas-marca');
  await page.click('#volver'); await page.click('.card[data-d="d2"]'); await page.waitForSelector('.dayhead'); await shot(page,'12-sim-d2-aviso-flojo');
  await page.click('#card-d2-0 .vimg'); await page.waitForTimeout(200); await page.screenshot({path:'/tmp/claude-0/app-13-video.png'}); shots.push('/tmp/claude-0/app-13-video.png');
  const src = await page.getAttribute('#vif','src'); const yt = await page.getAttribute('#vyt','href');
  await page.click('#vclose'); const cerrado = await page.isHidden('#vmodal');
  await page.click('#volver'); await page.click('.card[data-d="st"]'); await page.click('#hecho'); await page.waitForSelector('.fin'); await shot(page,'14-sim-st-sustituye');
  await page.click('#volver'); await shot(page,'15-sim-home-tras-st');
  await page.click('#t-week'); await shot(page,'16-sim-semana-progreso');
  await ctx.close(); await browser.close();
  console.log(JSON.stringify({errores_consola: errs, cola_sin_conexion: colaOffline, cola_tras_reintento: colaDespues,
    ops_recibidas: ops.map(o=>o.fn+(o.campo?':'+o.campo:'')), badge_nueva_marca: badge, video_src: src, abrir_youtube: yt, modal_cerrado: cerrado, recargaInstantanea, capturas: shots.length}, null, 1));
})().catch(e=>{ console.error(e); process.exit(1); });
