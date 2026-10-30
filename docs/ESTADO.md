# Estado del sistema y encargo inicial (30/10/2026)

Documento de arranque para trabajar con Claude Code. Lo escribió el chat de la app del Proyecto «Clientes» de claude.ai, donde se construyó todo hasta el 30/10.

## 1. Qué hay y cómo encaja
- **App del cliente** (`app/Index.html` + `app/Code.gs`): web app instalable (icono en la pantalla de inicio) en `https://alexaranda-entrena.alexaranda7793.workers.dev/?c=CODIGO`. Cada cliente tiene su hoja de Google («App · Nombre») con su programa: pestañas Plan, Calentamiento, Finisher, Días plan, Progresión, Bloques, Recordatorios, Agenda, Correcciones, Ajustes. La app escribe en Registro, Días, Extra, Pasos, Historial, Peso, Medidas, Fotos y Molestias. **La progresión la marca la hoja, no la app.**
  - Hoja maestra «App entrenos – maestra» (`1UKuXBYxFLsjNVN6ecR2ALC6AI1J--08YpvC8XacFJ78`): Registro clientes (código → hoja), Biblioteca de ejercicios, Semana de Alex, Vídeos pedidos, Avisos móvil.
  - Cliente ficticio para pruebas: **Beta** (`BETA-ALEX25`, plan de Sole). Nunca probar en hojas de clientes reales.
- **Panel de Alex** (`panel/panel.html` + `panel/Panel.gs`): `/panel?k=…`. Hoja «Panel Alex – datos» (`1SmU2r84U-k2lq5RR1R9f0BVamwIU4-mwtRd8uRVnZ48`) con Clientes, Leads, Cobros, Altas, Tareas, Ronda (reportes), Entregas (formularios), Redes, FotosAjuste, Planes, Aplicados, AvisosVistos. Pestañas: Hoy, Reportes, Llamadas, Clientes (con ficha completa a pantalla entera: Resumen, Su entreno, Su camino, Programa y pagos), Leads, Tareas, Redes.
- **Worker de Cloudflare** (`worker/template.js`): sirve app y panel, reenvía a los dos Apps Script, avisos push (cron cada 15 min), `/panel/ia` (API de Claude con el secreto `ANTHROPIC_API_KEY` de Cloudflare) y `/nutricion` (PDF del plan).
- **Respuestas de formularios de Google:** hoja `1nAtltPRklp8lEi0UPR-08SHIX4n3poUWE2eVIjsmn6c`.
- **Lo que NO es código y sigue en los chats del Proyecto** (tareas programadas): lectura diaria de WhatsApp a las 6:00, reportes de lunes y viernes (escriben en la pestaña Ronda), formularios del finde, revisión del domingo.

> **Actualizado el 30/10:** Encargo 1 hecho y cambios del Encargo 2 publicados (ver `docs/PLAN.md`). Beta aparte con `./publicar-beta.sh`. Lo que depende del Proyecto, en `docs/PARA-EL-PROYECTO.md`.

## 2. Publicar
Desde el 30/10, desde el Mac con Claude Code: `./publicar.sh --comprobar` construye y dice qué ha cambiado; `./publicar.sh` publica cada parte solo si Alex escribe «si» (`--si` cuando Alex ya ha dado el OK en el chat).
- Worker: `wrangler deploy` con `wrangler.toml` (cron cada 15 min, logs; no toca el secreto `ANTHROPIC_API_KEY` ni las variables del panel de Cloudflare).
- Apps Script: **la app y el panel viven en el mismo proyecto** (`1J3DGG…`, en la hoja «App entrenos – maestra»: archivos `Código`, `Panel`, `Index`). `build.py` deja en `dist/gas/` lo que sube `clasp push`; después `clasp deploy -i` crea una versión nueva de la implementación que usa el worker (la de `EXEC`), sin cambiar la URL.
- Si cambia `app/Code.gs`, subir `VERSION_DATOS` (caché); `publicar.sh` avisa si sigue igual.
- Antes (a mano): `python3 build.py` y copiar `dist/worker.js` en Cloudflare y `dist/Code.gs` / `dist/Panel.gs` en Apps Script (Implementar › Gestionar implementaciones › Nueva versión).

## 3. Encargo 1: dejar Claude Code listo para publicar (con Alex delante)
1. Instalar Node.js si no está, y después `npm i -g wrangler @google/clasp`.
2. `wrangler login` (abre el navegador; Alex entra con su cuenta de Cloudflare `alexaranda7793`). Crear `wrangler.toml` para el worker `alexaranda-entrena` apuntando a `dist/worker.js`, **conservando** el cron de cada 15 min y el secreto `ANTHROPIC_API_KEY` que ya existen (no tocar secretos). Probar con `wrangler deploy --dry-run`.
3. `clasp login` y enlazar los dos proyectos de Apps Script (app y panel) en carpetas de `dist/` o con `.clasp.json` (scriptId de cada uno: Alex los copia de Apps Script › Configuración del proyecto). Publicar = `clasp push` + nueva versión de la implementación existente (la URL del worker usa la implementación «app clientes»; no crear implementaciones nuevas).
4. Las claves: Alex tiene el archivo `secretos.zip` (se lo pasó el chat de la app el 30/10). Se descomprime en la carpeta `secretos/` del repositorio en el Mac (`claves.json` y `vapid.json`). Nunca al chat ni a GitHub.
5. Un script `publicar.sh` (o similar) que construye, comprueba y publica lo que haya cambiado, **solo con el OK de Alex**.

## 4. Encargo 2: cambios ya decididos y pendientes (después de la lista de Alex)
Alex pasará su lista de cambios del panel y la app; se ordena junto a estos (filas de la pestaña Tareas del panel):
- **Altas sin chat de Altas (decidido 30/10):** el repaso automático de altas se ha desactivado. Flujo deseado: alta en el panel (Llamadas › «Ha entrado ✓» / «+ Alta sin llamada») → «📝 Mandar formulario inicial» → **cuando llega el formulario inicial, se genera sola la propuesta de plan** (entreno y nutrición) para que Alex la revise en el panel. Necesita: activador «al enviar el formulario» en la hoja de respuestas que marque la fila de Altas, y que un agente de Claude (tarea programada o petición desde el panel) prepare la propuesta con las skills `inicia-nuevo-cliente`, `planes-entreno-clientes` y `plan-nutricion-clientes` del Proyecto.
- **Formularios al momento** (t-2510-1816-ap1): activador al enviar → Entregas «hecha» y aviso en Hoy/ficha.
- **Lectura diaria más ligera** (t-3010-0733-ap1): la hoja calcula cada noche una fila de resumen por cliente; la lectura de las 6:00 solo lee esa tabla + WhatsApp.
- **Agente de WhatsApp** (t-3010-0733-ap2) y botones del panel «Actualizar WhatsApp» y «Aprobar y enviar» (Alex aprueba en el panel y el agente envía desde WhatsApp Web; nada sin su OK).
- **Panel:** Formularios y Fotos a pantalla completa dentro de la ficha; mejoras propuestas de la ficha (último WhatsApp, formulario pendiente, miniaturas, línea de tiempo, nutrición como sección, flechas entre clientes).
- **App:** tarjetas de estiramientos y movilidad (t-2510-1754-ap1, para el 30/10); formularios dentro de la app; niveles y puntos (más adelante).
- **Su camino:** planes con el bloque entero (franjas `semana_desde/hasta`, columna `motivo`, Bloques › `foco_tecnico`) lo rellena el chat de planes; el panel ya lo enseña.

## 5. Cómo trabajar
- Normas del repositorio: `CLAUDE.md`.
- Documentos de referencia en el Proyecto «Clientes» (si la sesión tiene acceso): `claude/webapp-plan.md` (columnas de las hojas), `claude/panel-alex.md`, `claude/ronda-panel.md`, `claude/app-datos-lectura.md`, `claude/normas-programacion.md`, `claude/voz-alex.md`. Si no hay acceso, pedir a Alex lo que haga falta.
