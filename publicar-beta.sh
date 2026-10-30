#!/bin/bash
# Sube la BETA (nunca toca lo real): Apps Script propio + worker alexaranda-entrena-beta, contra las copias de las hojas.
# La primera vez crea el proyecto y su implementación y los guarda en secretos/beta.json.
# Hace falta tener activada la «API de Google Apps Script» en https://script.google.com/home/usersettings
set -euo pipefail
cd "$(dirname "$0")"
B=secretos/beta.json
leer(){ python3 -I -c 'import json,sys;print(json.load(open(sys.argv[1])).get(sys.argv[2],""))' "$B" "$1"; }
poner(){ python3 -I -c 'import json,sys;d=json.load(open(sys.argv[1]));d[sys.argv[2]]=sys.argv[3];json.dump(d,open(sys.argv[1],"w"),indent=2)' "$B" "$1" "$2"; }
if [ -z "$(leer SCRIPT_ID)" ]; then
  T=$(mktemp -d); (cd "$T" && clasp create-script --type standalone --title "BETA (pruebas) · App y panel de Alex" >/dev/null)
  poner SCRIPT_ID "$(python3 -I -c 'import json,sys;print(json.load(open(sys.argv[1]))["scriptId"])' "$T/.clasp.json")"; rm -rf "$T"
fi
python3 build.py --beta
(cd dist-beta && clasp push -f)
if [ -z "$(leer EXEC)" ]; then
  ID=$(cd dist-beta && clasp create-deployment -d "beta" | grep -o 'AKfyc[A-Za-z0-9_-]*' | head -1)
  poner EXEC "https://script.google.com/macros/s/$ID/exec"; poner DEPLOY "$ID"
  python3 build.py --beta
else
  (cd dist-beta && clasp create-deployment -i "$(leer DEPLOY)" -d "beta $(date '+%d/%m %H:%M')" >/dev/null)
fi
node --check dist-beta/worker.js
wrangler deploy --config wrangler.beta.toml 2>&1 | grep -E "workers.dev|Uploaded|ERROR" || true
echo "Beta subida. Falta (solo la primera vez): autorizar el Apps Script beta y poner la clave de Claude:"
echo "  wrangler secret put ANTHROPIC_API_KEY --config wrangler.beta.toml"
