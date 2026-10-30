import w from '../dist/worker.js';
import fs from 'fs';
import http from 'http';
const mock = JSON.parse(fs.readFileSync(process.env.MOCK || new URL('../app/test/mockB.json', import.meta.url).pathname));
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt) => {
  if (String(url).includes('script.google.com')) {
    const b = JSON.parse(opt.body);
    const ops = (b.datos && b.datos.ops) || []; const rej = process.env.REJECT ? ops.map((o,i)=>o.fn==='serie'?{i,error:'Ejercicio no válido: '+o.id}:null).filter(Boolean) : [];
    const data = b.accion === 'cargar' ? mock : b.accion === 'fotos' ? [] : { hechas: ops.length - rej.length, errores: rej, recargar: rej.length > 0 };
    return new Response(JSON.stringify({ ok: true, data }));
  }
  return realFetch(url, opt);
};
http.createServer(async (rq, rs) => {
  let body = ''; for await (const ch of rq) body += ch;
  const req = new Request('http://localhost:8787' + rq.url, { method: rq.method, body: rq.method === 'POST' ? body : undefined });
  const r = await w.fetch(req);
  rs.writeHead(r.status, Object.fromEntries(r.headers)); rs.end(Buffer.from(await r.arrayBuffer()));
}).listen(+(process.env.PORT||8787), () => console.log('up'));
