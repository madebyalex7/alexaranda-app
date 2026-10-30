# Alex Aranda · app de clientes y panel

Código de la app de entreno de los clientes, del panel de Alex y del servidor que los une.

| Carpeta | Qué es | Dónde se publica |
|---|---|---|
| `app/Index.html` | La app del cliente (una sola página) | Va dentro del worker |
| `app/Code.gs` | Apps Script de la app (lee y escribe la hoja de cada cliente) | Apps Script de «App entrenos – maestra» |
| `panel/panel.html` | El panel de Alex | Va dentro del worker (`/panel`) |
| `panel/Panel.gs` | Apps Script del panel | Apps Script de «Panel Alex – datos» |
| `worker/template.js` | El worker de Cloudflare: sirve app y panel y habla con Apps Script y la API de Claude | Cloudflare › Workers › `alexaranda-entrena` |
| `assets/` | Icono y foto de Alex | Van dentro del worker |

## Construir
```
python3 build.py
```
Deja en `dist/` (fuera de git) lo que se publica: `worker.js`, `Code.gs` y `Panel.gs`, ya con las claves.
Las claves están en `secretos/claves.json` y `secretos/vapid.json` (fuera de git; plantilla en `secretos/claves.example.json`).

## Probar sin tocar nada real
- Panel: `cd panel/test && PORT=8787 node mock-server.mjs` → `http://localhost:8787/panel?k=__PANEL_KEY__` (hoja simulada en memoria con `seed.json`).
- App: `python3 build.py && PORT=8787 node worker/test.mjs` → `http://localhost:8787/?c=CODIGO` (datos de `app/test/mockB.json`, o `MOCK=ruta.json`).

## Publicar
Siempre con el OK de Alex, después de probar. Hoy a mano (copiar `dist/…` en Cloudflare y en cada Apps Script, «Nueva versión»); más adelante con `wrangler` y `clasp`.
