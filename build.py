#!/usr/bin/env python3
"""Construye lo que se publica, en dist/ (no se sube a GitHub porque lleva las claves):
  dist/worker.js   → Cloudflare (Workers › alexaranda-entrena)
  dist/Code.gs     → Apps Script de la APP (hoja «App entrenos – maestra»)
  dist/Panel.gs    → Apps Script del PANEL (hoja «Panel Alex – datos»)
  dist/gas/        → lo que sube clasp: app y panel viven en el mismo proyecto de Apps Script
Las claves salen de secretos/claves.json y secretos/vapid.json (fuera de git).
Uso:  python3 build.py
"""
import json, base64, os

R = os.path.dirname(os.path.abspath(__file__))
p = lambda *a: os.path.join(R, *a)
claves = json.load(open(p('secretos', 'claves.json')))
vapid = json.load(open(p('secretos', 'vapid.json')))
PANEL_KEY, PUSH_KEY, EXEC = claves['PANEL_KEY'], claves['PUSH_KEY'], claves['EXEC']
os.makedirs(p('dist'), exist_ok=True)

# ── App (Index.html servido por el worker) ──
h = open(p('app', 'Index.html'), encoding='utf-8').read()
h = h.replace('<?!= codigoJson ?>', '__CODIGO__').replace('<?!= vistaJson ?>', '__VISTA__')
s = h.index('function api(accion, datos){'); e = h.index('/* ═════════ Almacenamiento local')
h = h[:s] + '''function api(accion, datos){
  return fetch("/api", {method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
    body: JSON.stringify({accion, codigo: CODIGO, zona: ZONA, datos: datos || {}})})
    .then(r=>{ if(!r.ok) throw new Error("Sin conexión con el servidor"); return r.json(); })
    .then(r=>{ if(r && r.ok) return r.data; throw new Error((r && r.error) || "Error del servidor"); });
}

''' + h[e:]
h = h.replace('<link rel="apple-touch-icon" href="https://lh3.googleusercontent.com/d/1DEyXplqYKwxxBbkqLSsGsav_iMDs9ywd">',
  '<link rel="apple-touch-icon" href="/icon.png">\n<link rel="icon" href="/icon.png">\n<link rel="manifest" href="/manifest.json">\n'
  '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Alex Aranda">\n<meta name="theme-color" content="#F6F1EA">')
a = 'const VISTA_INICIAL = __VISTA__;'; assert h.count(a) == 1
h = h.replace(a, a + '\ntry{ if(CODIGO) localStorage.setItem("app_codigo", CODIGO); }catch(e){}')
h = h.replace('__VAPID_PUB__', vapid['pub'])

icon = base64.b64encode(open(p('assets', 'icono-aa-192.png'), 'rb').read()).decode()
alex = base64.b64encode(open(p('assets', 'alex-240.jpg'), 'rb').read()).decode()
panel = open(p('panel', 'panel.html'), encoding='utf-8').read()

# ── Apps Script con sus claves ──
open(p('dist', 'Code.gs'), 'w', encoding='utf-8').write(open(p('app', 'Code.gs'), encoding='utf-8').read().replace("'__PUSH_KEY__'", "'" + PUSH_KEY + "'"))
open(p('dist', 'Panel.gs'), 'w', encoding='utf-8').write(open(p('panel', 'Panel.gs'), encoding='utf-8').read().replace("'__PANEL_KEY__'", "'" + PANEL_KEY + "'"))

# ── Carpeta que sube clasp (un solo proyecto de Apps Script con app y panel), con los nombres que tiene en Google ──
os.makedirs(p('dist', 'gas'), exist_ok=True)
for origen, destino in [(p('dist', 'Code.gs'), 'Código.gs'), (p('dist', 'Panel.gs'), 'Panel.gs'), (p('app', 'appsscript.json'), 'appsscript.json')]:
    open(p('dist', 'gas', destino), 'w', encoding='utf-8').write(open(origen, encoding='utf-8').read())
open(p('dist', 'gas', 'Index.html'), 'w', encoding='utf-8').write(
    open(p('app', 'Index.html'), encoding='utf-8').read().replace('__VAPID_PUB__', vapid['pub']))

# ── Worker ──
tpl = open(p('worker', 'template.js'), encoding='utf-8').read()
for k, v in {'/*EXEC*/': EXEC, '/*HTML*/': h, '/*ICON*/': icon, '/*ALEX*/': alex, '/*PANEL*/': panel, '/*PANEL_KEY*/': PANEL_KEY,
             '/*PUSH_KEY*/': PUSH_KEY, '/*VAPID_PUB*/': vapid['pub'], '/*VAPID_JWK*/': vapid['jwk']}.items():
    assert k in tpl, k
    tpl = tpl.replace(k, json.dumps(v))
open(p('dist', 'worker.js'), 'w', encoding='utf-8').write(tpl)
print('Hecho: dist/worker.js, dist/Code.gs, dist/Panel.gs')
