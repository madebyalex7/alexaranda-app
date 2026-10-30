#!/bin/bash
# Construye, comprueba y publica lo que haya cambiado desde la última vez. Nada se sube sin el OK de Alex.
#   ./publicar.sh              pregunta antes de subir cada parte (escribir «si»)
#   ./publicar.sh --comprobar  solo construye y comprueba; no sube nada
#   ./publicar.sh --si         Alex ya ha dado el OK en el chat (para Claude Code)
# Worker → wrangler deploy (wrangler.toml). Apps Script (app + panel) → clasp push + nueva versión
# de la implementación que usa el worker (la de EXEC en secretos/claves.json; nunca una nueva).
set -euo pipefail
cd "$(dirname "$0")"

MODO="${1:-}"
case "$MODO" in ""|--comprobar|--si) ;; *) echo "Uso: ./publicar.sh [--comprobar|--si]"; exit 1 ;; esac

ok(){
  [ "$MODO" = "--si" ] && return 0
  [ -t 0 ] || { echo "   Sin terminal para preguntar: no se publica."; return 1; }
  read -r -p "   ¿Publicar $1? (escribe si) " r
  case "$r" in si|s|y|yes|SI|Si|S|Y) return 0;; esac
  echo "   No has escrito si: $1 NO se publica."; NO_PUBLICADO=1; return 1
}
huella(){ cat "$@" | shasum -a 256 | cut -d' ' -f1; }
VERSION_DATOS(){ grep -o "VERSION_DATOS = '[^']*'" app/Code.gs; }

echo "1. Construir"
python3 build.py
echo "2. Comprobar"
node --check dist/worker.js && echo "   dist/worker.js OK"
wrangler deploy --dry-run 2>&1 | grep -E "Total Upload|ERROR" | sed 's/^/   /'

H_WORKER=$(huella dist/worker.js)
H_GAS=$(huella dist/gas/*)
CAMBIA_WORKER=$([ "$H_WORKER" != "$(cat dist/.publicado-worker 2>/dev/null)" ] && echo si || echo no)
CAMBIA_GAS=$([ "$H_GAS" != "$(cat dist/.publicado-gas 2>/dev/null)" ] && echo si || echo no)
echo "3. Cambios desde la última publicación hecha con este script"
echo "   Worker de Cloudflare: $CAMBIA_WORKER"
echo "   Apps Script (app y panel): $CAMBIA_GAS"
if [ "$CAMBIA_GAS" = si ] && [ "$(VERSION_DATOS)" = "$(cat dist/.publicado-version-datos 2>/dev/null)" ]; then
  echo "   Ojo: $(VERSION_DATOS) es la misma que la última vez. Si ha cambiado app/Code.gs, súbela (caché)."
fi
[ "$MODO" = "--comprobar" ] && { echo "Solo comprobar: no se ha subido nada."; exit 0; }

if [ "$CAMBIA_WORKER" = si ] && ok "el worker en Cloudflare"; then
  wrangler deploy
  echo "$H_WORKER" > dist/.publicado-worker
fi

if [ "$CAMBIA_GAS" = si ] && ok "el Apps Script (app y panel)"; then
  ID=$(python3 -I -c 'import json,re,sys;print(re.search(r"/s/([^/]+)/exec",json.load(open(sys.argv[1]))["EXEC"]).group(1))' secretos/claves.json)
  clasp push
  clasp deploy -i "$ID" -d "publicar.sh $(date '+%d/%m %H:%M')"
  echo "$H_GAS" > dist/.publicado-gas
  VERSION_DATOS > dist/.publicado-version-datos
fi
if [ -n "${NO_PUBLICADO:-}" ]; then echo "Ojo: no se ha publicado todo. Vuelve a ejecutarlo."; else echo "Listo."; fi
