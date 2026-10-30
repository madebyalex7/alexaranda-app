# Normas para trabajar en este repositorio

- **Nada se publica sin el OK de Alex.** Primero se prueba (mocks de `panel/test` y `worker/test.mjs`), después se le enseña, y solo entonces se publica.
- **Beta permanente (Alex 30/10):** cada cambio se sube antes a la beta (`./publicar-beta.sh`: copias de las hojas, sin avisos al móvil) y Alex lo mira ahí; lo real, después, con `./publicar.sh`.
- **Las claves nunca van al código ni a GitHub:** `secretos/` y `dist/` están fuera de git. En el código van los marcadores `__PANEL_KEY__` y `__PUSH_KEY__`; `build.py` los sustituye en `dist/`.
- **Una sola fuente por archivo:** `panel/panel.html` lleva dentro todo el JavaScript del panel; `app/Index.html` el de la app. No crear copias sueltas.
- **Antes de dar algo por hecho**, construir (`python3 build.py`), `node --check dist/worker.js` y probarlo en el navegador (Playwright) con los mocks.
- **Datos de clientes:** las hojas son de verdad. Nunca escribir en la hoja de un cliente para probar; usar el cliente ficticio Beta (`BETA-ALEX25`).
- **Textos que lee el cliente:** en la voz de Alex (sin ¿ ni ¡, cercano, frases cortas). Las normas de entreno y la voz están en el Proyecto «Clientes» de claude.ai (`claude/normas-programacion.md`, `claude/voz-alex.md`).
- Cada cambio, un commit con lo que cambia y por qué, en español.
