#!/usr/bin/env python3
"""Construye lo que se publica, en dist/ (no se sube a GitHub porque lleva las claves):
  dist/worker.js   → Cloudflare (Workers › alexaranda-entrena)
  dist/Code.gs     → Apps Script de la APP (hoja «App entrenos – maestra»)
  dist/Panel.gs    → Apps Script del PANEL (hoja «Panel Alex – datos»)
  dist/gas/        → lo que sube clasp: app y panel viven en el mismo proyecto de Apps Script
Las claves salen de secretos/claves.json y secretos/vapid.json (fuera de git).
Uso:  python3 build.py          → dist/
      python3 build.py --beta   → dist-beta/: lo mismo contra las COPIAS de las hojas (secretos/beta.json),
                                  con una franja «BETA» arriba. Se publica con ./publicar-beta.sh
"""
import json, base64, os, sys

R = os.path.dirname(os.path.abspath(__file__))
p = lambda *a: os.path.join(R, *a)
BETA = '--beta' in sys.argv
claves = json.load(open(p('secretos', 'claves.json')))
vapid = json.load(open(p('secretos', 'vapid.json')))
PANEL_KEY, PUSH_KEY, EXEC = claves['PANEL_KEY'], claves['PUSH_KEY'], claves['EXEC']
DIST = 'dist-beta' if BETA else 'dist'
if BETA:
    beta = json.load(open(p('secretos', 'beta.json')))
    EXEC = beta.get('EXEC') or EXEC.replace('/exec', '/__sin_implementar__')
os.makedirs(p(DIST), exist_ok=True)

def a_beta(txt, cual):
    """Las copias en lugar de las hojas reales; el resto del código, igual"""
    if not BETA: return txt
    for var, clave in [('MAESTRA_ID', 'MAESTRA_ID'), ('PANEL_HOJA_ID', 'PANEL_HOJA_ID')]:
        viejo = "var %s = '" % var
        if viejo in txt:
            i = txt.index(viejo) + len(viejo); j = txt.index("'", i)
            txt = txt[:i] + beta[clave] + txt[j:]
    if cual == 'Code':
        assert 'var ES_BETA = false;' in txt
        txt = txt.replace('var ES_BETA = false;', 'var ES_BETA = true;')
    return txt

FRANJA = ('<div style="position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#B5462F;color:#fff;font:600 11px/1.9 system-ui,sans-serif;'
          'text-align:center;letter-spacing:.14em;pointer-events:none">BETA · PRUEBAS · NO ES LA REAL</div></body>')
def franja(html): return html.replace('</body>', FRANJA, 1) if BETA else html

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
h = franja(h.replace('__VAPID_PUB__', vapid['pub']))

icon = base64.b64encode(open(p('assets', 'icono-aa-192.png'), 'rb').read()).decode()
alex = base64.b64encode(open(p('assets', 'alex-240.jpg'), 'rb').read()).decode()
panel = franja(open(p('panel', 'panel.html'), encoding='utf-8').read())

# ── Apps Script con sus claves ──
open(p(DIST, 'Code.gs'), 'w', encoding='utf-8').write(a_beta(open(p('app', 'Code.gs'), encoding='utf-8').read().replace("'__PUSH_KEY__'", "'" + PUSH_KEY + "'"), 'Code'))
open(p(DIST, 'Panel.gs'), 'w', encoding='utf-8').write(a_beta(open(p('panel', 'Panel.gs'), encoding='utf-8').read().replace("'__PANEL_KEY__'", "'" + PANEL_KEY + "'"), 'Panel'))

# ── Carpeta que sube clasp (un solo proyecto de Apps Script con app y panel), con los nombres que tiene en Google ──
os.makedirs(p(DIST, 'gas'), exist_ok=True)
for origen, destino in [(p(DIST, 'Code.gs'), 'Código.gs'), (p(DIST, 'Panel.gs'), 'Panel.gs'), (p('app', 'appsscript.json'), 'appsscript.json')]:
    open(p(DIST, 'gas', destino), 'w', encoding='utf-8').write(open(origen, encoding='utf-8').read())
open(p(DIST, 'gas', 'Index.html'), 'w', encoding='utf-8').write(
    open(p('app', 'Index.html'), encoding='utf-8').read().replace('__VAPID_PUB__', vapid['pub']))
if BETA and beta.get('SCRIPT_ID'):
    json.dump({'scriptId': beta['SCRIPT_ID'], 'rootDir': 'gas', 'scriptExtensions': ['.gs'], 'htmlExtensions': ['.html'], 'jsonExtensions': ['.json']},
              open(p(DIST, '.clasp.json'), 'w'), indent=2)

# ── Worker ──
tpl = open(p('worker', 'template.js'), encoding='utf-8').read()
for k, v in {'/*EXEC*/': EXEC, '/*HTML*/': h, '/*ICON*/': icon, '/*ALEX*/': alex, '/*PANEL*/': panel, '/*PANEL_KEY*/': PANEL_KEY,
             '/*PUSH_KEY*/': PUSH_KEY, '/*VAPID_PUB*/': vapid['pub'], '/*VAPID_JWK*/': vapid['jwk']}.items():
    assert k in tpl, k
    tpl = tpl.replace(k, json.dumps(v))
open(p(DIST, 'worker.js'), 'w', encoding='utf-8').write(tpl)
print('Hecho: %s/worker.js, %s/Code.gs, %s/Panel.gs' % (DIST, DIST, DIST))
