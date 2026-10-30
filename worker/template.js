// App de entrenos · Alex Aranda — Cloudflare Worker
// Sirve la app, pasa los datos a Google (Apps Script), manda los avisos al móvil (cron cada 15 min) y sirve el panel de Alex.
const EXEC = /*EXEC*/;
const HTML = /*HTML*/;
const ICON = /*ICON*/;
const ALEX = /*ALEX*/;
const PANEL_HTML = /*PANEL*/;
const PANEL_KEY = /*PANEL_KEY*/;
const PUSH_KEY = /*PUSH_KEY*/;
const VAPID_PUB = /*VAPID_PUB*/;
const VAPID_JWK = /*VAPID_JWK*/;
const SUB = "https://alexaranda-entrena.alexaranda7793.workers.dev";
// Sin código y sin código guardado (p. ej. icono añadido antes del 26/10 en iPhone): explicar cómo arreglarlo
const SIN_CODIGO = '<script>(function(){var c="";try{c=localStorage.getItem("app_codigo")||""}catch(e){}if(c)return;document.addEventListener("DOMContentLoaded",function(){document.body.innerHTML=\'<div style="font-family:system-ui,sans-serif;max-width:420px;margin:18vh auto;padding:24px;text-align:center;color:#3B2F28"><div style="font-size:40px;letter-spacing:4px;font-weight:300;margin-bottom:18px">AA</div><h2 style="font-weight:500">Falta un paso</h2><p style="line-height:1.5">Abre el enlace de tu app que te mandé por WhatsApp y vuelve a añadirla a la pantalla de inicio (Compartir › Añadir a pantalla de inicio). Puedes borrar este icono.</p></div>\'})})()</script>';
// El icono de la pantalla de inicio abre start_url: lleva el código de cada cliente (en iPhone la app del icono no comparte memoria con Safari)
const manifiesto = c => JSON.stringify({name:"Alex Aranda",short_name:"Alex Aranda",start_url:c?"/?c="+c:"/",scope:"/",display:"standalone",background_color:"#F6F1EA",theme_color:"#F6F1EA",icons:[{src:"/icon.png",sizes:"192x192",type:"image/png"}]});

// Service worker de la app: recibe el «toque» del aviso, pide el texto y lo enseña
const SW = `const C = new URL(self.location).searchParams.get("c") || "";
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  e.waitUntil((async () => {
    let m = { titulo: "Alex Aranda", texto: "Tienes algo nuevo en tu app 💪", url: "/" };
    try {
      const r = await fetch("/api", { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ accion: "avisoPush", codigo: C }) });
      const j = await r.json(); if (j && j.ok && j.data && j.data.titulo) m = j.data;
    } catch (x) {}
    return self.registration.showNotification(m.titulo, { body: m.texto, icon: "/icon.png", badge: "/icon.png", tag: "aviso-alex", data: { url: m.url || "/" } });
  })());
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const u = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin);
  if (C && !u.searchParams.get("c")) u.searchParams.set("c", C);
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of cs) { if ("focus" in c) { try { await c.navigate(u.href); } catch (x) {} return c.focus(); } }
    return self.clients.openWindow(u.href);
  })());
});`;

const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function vapid(aud) {
  const key = await crypto.subtle.importKey("jwk", VAPID_JWK, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const h = enc({ typ: "JWT", alg: "ES256" }), p = enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUB });
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(h + "." + p));
  return `vapid t=${h}.${p}.${b64u(sig)}, k=${VAPID_PUB}`;
}
async function google(cuerpo) {
  const r = await fetch(EXEC, { method: "POST", body: JSON.stringify(cuerpo), headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "follow" });
  return r.json();
}
// Cada 15 min: Google dice a quién avisar; aquí se manda el toque (sin contenido) a cada móvil
async function enviarAvisos() {
  const r = await google({ push: true, k: PUSH_KEY, accion: "pendientes" });
  if (!r || !r.ok) { console.log("avisos: " + (r && r.error)); return; }
  const muertos = [];
  for (const ep of (r.data.enviar || [])) {
    try {
      const res = await fetch(ep, { method: "POST", headers: { TTL: "3600", Urgency: "high", "Content-Length": "0", Authorization: await vapid(new URL(ep).origin) } });
      if (res.status === 404 || res.status === 410) muertos.push(ep);
      else if (!res.ok) console.log("push " + res.status + " " + (await res.text()).slice(0, 200));
    } catch (e) { console.log("push error " + e); }
  }
  if (muertos.length) await google({ push: true, k: PUSH_KEY, accion: "baja", endpoints: muertos });
}

// ───────── Ronda del panel: «otra versión» al momento con la API de Claude (si hay clave en Cloudflare › Settings › Variables: ANTHROPIC_API_KEY) ─────────
const VOZ_ALEX = `Escribes como Alex Aranda, entrenador personal online, por WhatsApp a un cliente suyo. Reglas obligatorias:
- Suena a Alex escribiendo desde el móvil: frases cortas, párrafos de una o dos líneas, sin viñetas ni listas.
- Nunca signos de apertura (¿ ¡). Risa «Hahaha». Pocos emojis (😊 o 💪 como mucho).
- Muletillas suyas cuando encajen: «Genial!», «vale?» de coletilla, «Dale!», «vamos a» (en plural, como equipo), «un pelín», «Un abrazo!».
- Primero reconoce un hecho concreto de su semana (afirmar, no valorar: nada de «eres una máquina», «tiene muchísimo mérito», «estoy orgulloso»).
- Nada de «no pasa nada», «no te preocupes» ni «tranquila» ante lo que siente: «normal que te fastidie», «normal sentirse así», y después lo que sí hizo.
- Nunca «fallar», «cumplir», «tienes que», «deberías», «compensa». Comida sin prohibiciones: se suma un hábito.
- Tras una semana floja, deja la semana siguiente en versión mínima y concreta (sus días y la versión corta que cuenta como hecho).
- Dolor: hasta 3/10 se sigue; más de 3 o va a más, menos rango, peso o más lento; punzante o 6+, ese ejercicio fuera y que avise.
- Una sola corrección como mucho, el porqué en media frase, y como mucho una pregunta. Cierre con pregunta o abrazo.
- Sin palabras de informe («feedback», «adherencia», «te comento que»).
- Corto: el mensaje principal en 3-5 líneas. No repitas una idea con otras palabras ni encadenes elogios: un reconocimiento concreto basta.
- Nunca preguntes qué días o a qué hora va a entrenar esta semana (Alex no lo quiere).
- Uno o dos emojis como mucho en todo el mensaje, y solo si señalan algo (💪 🎥 📋).`;
const NORMAS_CAMBIO = `Propones UN cambio pequeño en el plan de entreno de este cliente, siguiendo las normas de Alex: los ejercicios principales no se cambian en el bloque salvo con un porqué (lesión, material, que no pueda); se dejan 2 repes en recámara; dolor hasta 3/10 se sigue; ante la duda, la opción conservadora. Tipos que el panel sabe aplicar y sus params:
- nota_semana {nota, desde?, hasta?} (fechas yyyy-MM-dd; nota en la voz de Alex, corta)
- pausa {desde, hasta}
- semana_suave {semana?, series?, nota?}
- series_repes {aplica_a: todos|principal|accesorio|<ejercicio_id>, desde, hasta, series?, repes?, nota?}
- cambiar_ejercicio {dia, viejo, desde, nuevo:{ejercicio_id, nombre, series, repes, descanso, para_ti, como}}
- ajuste {clave: dias_semana|objetivo_pasos|peso_cada|peso_frecuencia|nivel|pesos_disponibles|crono, valor}
- manual {descripcion} (lo aplica Claude a mano)
Responde SOLO con un JSON: {"titulo": "...", "porque": "...", "tipo": "...", "params": {...}}`;
async function claudeTexto(env, system, user, max) {
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.CLAUDE_MODEL || "claude-sonnet-5-5", max_tokens: max || 900, system, messages: [{ role: "user", content: user }] }) });
  const j = await r.json();
  if (!r.ok) throw new Error((j && j.error && j.error.message) || ("API " + r.status));
  return (j.content || []).filter(c => c.type === "text").map(c => c.text).join("").trim();
}
function contextoFila(f) {
  const parte = (t, v) => v ? `\n## ${t}\n${v}` : "";
  const vi = String(f.tipo || "").toLowerCase() === "viernes", mens = /revision|mensual/.test(String(f.tipo || "").toLowerCase());
  const tipo = mens ? "\n## Qué mensaje es\nMensaje de la REVISIÓN MENSUAL: empieza por su logro más visible del mes con un dato concreto (constancia, centímetros, fuerza, cómo se siente), después lo que ha aprendido y el foco del mes que viene. Sin juicios sobre el cuerpo." : vi ? "\n## Qué mensaje es\nMensaje del VIERNES: 2-3 líneas (4 como mucho). Cierra la semana con un reflejo concreto de lo que ha hecho, recuerda el formulario semanal si toca y anima al finde. Sin preguntas que pidan respuesta larga y sin hablar de técnica." : "\n## Qué mensaje es\nMensaje del LUNES: un reconocimiento concreto de su semana, algo de su formulario o de la app y, si hace falta, una idea para esta semana. Como mucho una pregunta y nunca sobre qué días o a qué hora entrenará.";
  return `Cliente: ${f.cliente}${tipo}${parte("Cómo le habla Alex", f.voz)}${parte(vi ? "Su finde" : "Su semana (personal)", f.semana_personal)}${parte("Su semana (entreno)", f.semana_entreno)}${parte("Datos", f.datos)}${parte("Progreso", f.progreso)}${parte("A tener en cuenta", f.tener_en_cuenta)}`;
}
async function rondaIA(b, env) {
  if (!env || !env.ANTHROPIC_API_KEY) {
    const r = await google({ panel: true, k: PANEL_KEY, accion: "rondaPedir", datos: { id: b.id, que: b.que, cid: b.cid, peticion: b.peticion } });
    if (r && r.ok) r.data = { fila: r.data, ia: false };
    return r;
  }
  const g = await google({ panel: true, k: PANEL_KEY, accion: "rondaFila", datos: { id: b.id } });
  if (!g || !g.ok) return g;
  const f = g.data, pet = String(b.peticion || "").slice(0, 2000);
  let s;
  if (b.que === "mensaje") {
    if (f.mensaje_estado === "enviado") return { ok: false, error: "Ese mensaje ya está enviado" };
    const actual = b.actual != null ? String(b.actual) : (f.mensaje || "");
    const txt = await claudeTexto(env, VOZ_ALEX, `${contextoFila(f)}\n\n## Mensaje propuesto ahora\n${actual || "(ninguno)"}\n\n## Lo que pide Alex\n${pet || "Otra versión"}\n\nEscribe solo el mensaje nuevo, listo para pegar en WhatsApp, sin comillas ni explicaciones.`, 900);
    s = await google({ panel: true, k: PANEL_KEY, accion: "rondaNuevoMensaje", datos: { id: f.id, texto: txt, peticion: pet, actual } });
  } else {
    let cs = []; try { cs = JSON.parse(f.cambios || "[]"); } catch (e) {}
    const c = cs.find(x => x.cid === b.cid); if (!c) return { ok: false, error: "No encuentro ese cambio" };
    if (c.estado === "aplicado") return { ok: false, error: "Ese cambio ya está aplicado" };
    const raw = await claudeTexto(env, NORMAS_CAMBIO, `${contextoFila(f)}\n\n## Cambio propuesto ahora\n${JSON.stringify({ titulo: c.titulo, porque: c.porque, tipo: c.tipo, params: c.params })}\n\n## Lo que pide Alex\n${pet}`, 900);
    let n; try { n = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); } catch (e) { return { ok: false, error: "La respuesta no se entendió; prueba otra vez" }; }
    s = await google({ panel: true, k: PANEL_KEY, accion: "rondaReemplazarCambio", datos: { id: f.id, cid: b.cid, nuevo: n } });
  }
  if (s && s.ok) s.data = { fila: s.data, ia: true };
  return s;
}

// «Modificar» (Alex 30/10): tres versiones del mensaje a la vez para elegir una; no se guarda nada hasta que Alex elige
const TRES_VERSIONES = `Devuelve SOLO un JSON con tres versiones del mismo mensaje, sin texto fuera del JSON:
{"cercano": "...", "directo": "...", "corto": "..."}
- cercano: más cálido y personal, que se note que Alex le conoce (algo concreto suyo).
- directo: más firme y al grano, sin perder el cariño; sin «tienes que» ni «deberías».
- corto: 2-3 líneas como mucho.
Las tres con las mismas reglas de voz y con los mismos hechos (no inventes nada que no esté en el contexto).`;
async function rondaVersiones(b, env) {
  if (!env || !env.ANTHROPIC_API_KEY) return { ok: false, error: "Para las 3 versiones hace falta la IA conectada (ANTHROPIC_API_KEY en Cloudflare)" };
  const g = await google({ panel: true, k: PANEL_KEY, accion: "rondaFila", datos: { id: b.id } });
  if (!g || !g.ok) return g || { ok: false, error: "Google no responde ahora" };
  const f = g.data, actual = b.actual != null ? String(b.actual) : (f.mensaje || ""), pet = String(b.peticion || "").slice(0, 1000);
  if (f.mensaje_estado === "enviado") return { ok: false, error: "Ese mensaje ya está enviado" };
  const raw = await claudeTexto(env, VOZ_ALEX + "\n\n" + TRES_VERSIONES, `${contextoFila(f)}\n\n## Mensaje propuesto ahora\n${actual || "(ninguno)"}${b.extra ? "\n\n## Esta semana, además (de su app)\n" + String(b.extra).slice(0, 600) + "\nSi no se pesó o no mandó los vídeos pedidos, recuérdaselo con una frase corta, sin reproche." : ""}${pet ? "\n\n## Lo que pide Alex además\n" + pet : ""}`, 1400);
  let j; try { j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); } catch (e) { return { ok: false, error: "La respuesta no se entendió; prueba otra vez" }; }
  const versiones = [["cercano", "Más cercano"], ["directo", "Más directo"], ["corto", "Más corto"]].map(([k, t]) => ({ tipo: k, titulo: t, texto: String(j[k] || "").trim() })).filter(v => v.texto);
  if (!versiones.length) return { ok: false, error: "No han salido versiones; prueba otra vez" };
  return { ok: true, data: { versiones } };
}

// ───────── Correcciones de vídeo (Alex 30/10): transcripción de Cap → mensaje, correcciones para la app y vídeos de la semana ─────────
const CORRECCION = `Preparas la corrección de vídeos de Alex Aranda para un cliente, a partir de lo que Alex dice en su vídeo de Cap (la transcripción). Reglas:
- Lo que se corrige es SOLO lo que Alex dice en la transcripción. No valores la técnica por tu cuenta ni añadas correcciones suyas. Lo dudoso, «(por confirmar)».
- Mensaje de WhatsApp, un solo bloque, en este orden: 1) un reconocimiento concreto de lo que hace bien; 2) el enlace de Cap (escribe exactamente {{CAP}} donde va); 3) un resumen de 2-4 puntos numerados (por ejercicio: lo bien hecho, qué cambiar con una señal fácil y qué debería notar); 4) los vídeos de esta semana: qué grabar y cómo (ángulo, qué serie, que se vea el cuerpo entero).
- Una sola corrección por ejercicio. Sin tecnicismos (omóplatos, isquios, core, retroversión, rango articular…): las palabras de Alex.
- Si mejoró algo que se le había corregido, dilo.
- Vídeos de la semana: 2 o 3, por este orden: correcciones abiertas (primero las de su zona sensible), ejercicios que cambian esta semana o nunca grabados, lo que le cuesta. No pidas lo que ya domina. Solo ejercicios de su lista (usa su ejercicio_id).
- Si en la transcripción se intuye dolor o molestia nueva, dilo en «aviso» para Alex (no lo decidas tú).
Responde SOLO con este JSON:
{"mensaje": "...", "correcciones": [{"ejercicio_id": "...", "texto": "una frase corta en la voz de Alex, la misma del mensaje"}], "superadas": ["ejercicio_id de correcciones abiertas que Alex dice que ya hace bien"], "videos": [{"ejercicio_id": "...", "indicacion": "en qué fijarse, corto", "como_grabar": "de lado, la 2.ª serie, que se vea todo el cuerpo", "porque": "media frase para Alex"}], "aviso": ""}`;
async function correccionIA(b, env) {
  if (!env || !env.ANTHROPIC_API_KEY) return { ok: false, error: "Para preparar la corrección hace falta la IA conectada (ANTHROPIC_API_KEY en Cloudflare)" };
  const tr = String(b.transcripcion || "").trim().slice(0, 30000), cap = String(b.cap || "").trim().slice(0, 300);
  if (tr.length < 20) return { ok: false, error: "Pega la transcripción del vídeo de Cap" };
  const g = await google({ panel: true, k: PANEL_KEY, accion: "videosCliente", datos: { cliente_id: b.cliente_id } });
  if (!g || !g.ok) return g || { ok: false, error: "Google no responde ahora" };
  const c = g.data;
  const ejs = c.ejercicios.map(e => `- ${e.id}: ${e.nombre}${e.principal ? " (principal)" : ""}${c.ultimoPeso[e.id] ? " · último: " + c.ultimoPeso[e.id].peso + " kg × " + c.ultimoPeso[e.id].repes : ""}`).join("\n");
  const abiertas = c.correcciones.filter(x => !/superad/i.test(x.estado)).map(x => `- ${x.fecha} · ${x.ejercicio_id}: ${x.texto}`).join("\n") || "(ninguna)";
  const ctx = `Cliente: ${c.cliente}${c.voz ? "\n## Cómo le habla Alex\n" + c.voz : ""}\n## Sus ejercicios (ejercicio_id: nombre)\n${ejs}\n## Correcciones abiertas\n${abiertas}${b.nota ? "\n## Lo que añade Alex\n" + String(b.nota).slice(0, 1500) : ""}\n## Transcripción de Cap\n${tr}`;
  const raw = await claudeTexto(env, VOZ_ALEX + "\n\n" + CORRECCION, ctx, 2200);
  let j; try { j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); } catch (e) { return { ok: false, error: "La respuesta no se entendió; prueba otra vez" }; }
  const ids = new Set(c.ejercicios.map(e => e.id));
  const out = { mensaje: String(j.mensaje || "").split("{{CAP}}").join(cap || "(enlace de Cap)"), aviso: String(j.aviso || ""),
    correcciones: (j.correcciones || []).filter(x => x && ids.has(x.ejercicio_id) && x.texto),
    superadas: (j.superadas || []).filter(x => ids.has(x)),
    videos: (j.videos || []).filter(x => x && ids.has(x.ejercicio_id)).slice(0, 4), ejercicios: c.ejercicios, abiertas: c.correcciones.filter(x => !/superad/i.test(x.estado)) };
  return { ok: true, data: out };
}

// ───────── Llamadas: preparar la llamada y mensaje de seguimiento (API de Claude) ─────────
const PREPARAR_LLAMADA = `Eres el ayudante de Alex Aranda, entrenador personal online (entreno y nutrición; sobre todo mujeres de 30 a 50 años que quieren perder grasa, sentirse bien y tienen poco tiempo). Preparas la chuleta de su llamada de valoración con un lead. Usa SOLO lo que hay en los datos y en el chat; si algo no se sabe, dilo («no lo sabemos: preguntarlo»). Nada inventado.
Formato: texto plano, corto, que se lea en 1 minuto, con estos apartados en mayúsculas y guiones:
QUIÉN ES (2 líneas)
LO QUE YA HA CONTADO (con sus palabras, entre comillas si son literales)
PREGUNTAS ADAPTADAS para cada parte del guion: Situación · Objetivo · Por qué ahora · Qué ha probado · Qué le frena · Compromiso (0-10). Preguntas abiertas («qué», «cómo», «cuéntame»), no «por qué».
OBJECIONES PROBABLES y cómo responder (desde lo que ella dijo, sin presionar)
PLAN QUE ENCAJA (3, 6 o 12 meses) y por qué, sin prometer resultados en X semanas
OJO: salud, lesión, embarazo, TCA o mucha emoción → decirlo arriba del todo.`;
const SEGUIMIENTO_LEAD = `Escribes como Alex Aranda, entrenador personal online, un mensaje de WhatsApp o Instagram a una persona que tuvo llamada de valoración con él y no entró (todavía). Reglas:
- Frases cortas, párrafos de una o dos líneas, sin listas. Nunca signos de apertura (¿ ¡). Uno o ningún emoji.
- Cercano y sin presión: nada de descuentos, urgencias falsas, «última oportunidad» ni culpas. Nada de «no pasa nada».
- Referencia concreta a algo que contó en la llamada (su objetivo, su situación, lo que le frenaba).
- Aporta algo útil y pequeño (una idea práctica para su caso) o un recordatorio de su porqué; deja la puerta abierta.
- Termina con UNA pregunta abierta que se pueda responder fácil.
- Paso 1 (a los 2 días): cómo está, algo útil. Paso 2 (a la semana): una idea práctica ligada a su objetivo. Paso 3 (al mes): retomar con calma, si sigue con la idea.
Escribe solo el mensaje, listo para pegar.`;
function contextoLead(l) {
  const parte = (t, v) => v ? `\n## ${t}\n${v}` : "";
  let guion = ""; try { const g = JSON.parse(l.guion || "{}"); guion = Object.keys(g).filter(k => g[k]).map(k => `- ${k}: ${g[k]}`).join("\n"); } catch (e) {}
  return `Lead: ${l.nombre}${parte("Instagram", l.instagram)}${parte("De dónde viene", l.origen)}${parte("Qué le preocupa / objetivo", l.preocupacion)}${parte("Última conversación", l.ultima_resumen)}${parte("Notas", l.notas)}${parte("Chat de Instagram o WhatsApp", String(l.chat_ig || "").slice(-12000))}${parte("Lo apuntado en la llamada", guion)}${parte("Notas de la llamada", l.notas_llamada)}${parte("Motivo por el que no entró", l.motivo_no)}`;
}
async function leadIA(b, env) {
  if (!env || !env.ANTHROPIC_API_KEY) return { ok: false, error: "La IA no está conectada (falta ANTHROPIC_API_KEY en Cloudflare)" };
  const g = await google({ panel: true, k: PANEL_KEY, accion: "llamadaLead", datos: { id: b.id } });
  if (!g || !g.ok) return g;
  const l = g.data, seg = b.modo === "seguimiento", pet = String(b.peticion || "").slice(0, 1500);
  const paso = Math.min(Math.max(parseInt(l.seguimiento_paso || "1", 10) || 1, 1), 3);
  const txt = seg
    ? await claudeTexto(env, SEGUIMIENTO_LEAD, `${contextoLead(l)}\n\n## Paso\n${paso}${l.seguimiento_msg ? "\n\n## Mensaje propuesto ahora\n" + l.seguimiento_msg : ""}${pet ? "\n\n## Lo que pide Alex\n" + pet : ""}`, 700)
    : await claudeTexto(env, PREPARAR_LLAMADA, contextoLead(l) + (pet ? "\n\n## Lo que pide Alex\n" + pet : ""), 1400);
  const s = await google({ panel: true, k: PANEL_KEY, accion: "llamadaIA", datos: { id: l.id, texto: txt, modo: seg ? "seguimiento" : "preparar" } });
  if (s && s.ok) s.data = { lead: s.data, ia: true };
  return s;
}

const js = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(enviarAvisos()); },
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === "/api" && req.method === "POST") {
      const body = await req.text();
      try {
        const r = await fetch(EXEC, { method: "POST", body, headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "follow" });
        const t = await r.text();
        if (!t.trim().startsWith("{")) return js({ ok: false, error: "Google no responde ahora" }, 502);
        return new Response(t, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
      } catch (e) {
        return js({ ok: false, error: "Google no responde ahora" }, 502);
      }
    }
    // Plan de alimentación en PDF: Apps Script lo lee de Drive (sin compartir el archivo) y aquí se entrega para ver o descargar
    if (u.pathname === "/nutricion" && req.method === "GET") {
      const c = String(u.searchParams.get("c") || "").toUpperCase();
      try {
        const r = await fetch(EXEC, { method: "POST", body: JSON.stringify({ accion: "nutricion", codigo: c, datos: {} }), headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "follow" });
        const j = await r.json();
        if (!j || !j.ok) return new Response("<meta charset=utf-8><p style='font:16px sans-serif;padding:24px'>" + String((j && j.error) || "No he podido abrir tu plan ahora. Prueba en un rato.").replace(/</g, "&lt;") + "</p>", { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
        const bin = Uint8Array.from(atob(j.data.b64), ch => ch.charCodeAt(0));
        const nom = String(j.data.nombre || "Plan de alimentación.pdf").replace(/["\\]/g, "");
        return new Response(bin, { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=300",
          "Content-Disposition": (u.searchParams.get("d") ? "attachment" : "inline") + "; filename*=UTF-8''" + encodeURIComponent(nom) } });
      } catch (e) { return new Response("No he podido abrir tu plan ahora. Prueba en un rato.", { status: 502 }); }
    }
    if (u.pathname === "/sw.js") return new Response(SW, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" } });
    // Panel privado de Alex: /panel?k=CLAVE
    if (u.pathname === "/panel") {
      if (!PANEL_HTML || u.searchParams.get("k") !== PANEL_KEY) return new Response("No encontrado", { status: 404 });
      return new Response(PANEL_HTML, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
    }
    // Foto de progreso a tamaño completo (para comparar en el panel). Solo con la clave del panel; no se comparte el archivo
    if (u.pathname === "/panel/foto" && req.method === "GET") {
      if (u.searchParams.get("k") !== PANEL_KEY) return new Response("No autorizado", { status: 403 });
      try {
        const r = await google({ panel: true, k: PANEL_KEY, accion: "fotoArchivo", datos: { id: String(u.searchParams.get("id") || "") } });
        if (!r || !r.ok) return new Response((r && r.error) || "No encontrada", { status: 404 });
        const bin = Uint8Array.from(atob(r.data.b64), ch => ch.charCodeAt(0));
        return new Response(bin, { headers: { "Content-Type": r.data.tipo || "image/jpeg", "Cache-Control": "private, max-age=86400" } });
      } catch (e) { return new Response("Google no responde ahora", { status: 502 }); }
    }
    if (u.pathname === "/panel/api" && req.method === "POST") {
      let b = {}; try { b = JSON.parse(await req.text()); } catch (e) { return js({ ok: false, error: "JSON no válido" }, 400); }
      if (b.k !== PANEL_KEY) return js({ ok: false, error: "No autorizado" }, 403);
      try {
        const r = await google(Object.assign({}, b, { panel: true }));
        if (r && r.ok && (b.accion === "rondaCargar" || b.accion === "llamadasCargar") && r.data) r.data.ia = !!(env && env.ANTHROPIC_API_KEY);
        return js(r);
      } catch (e) { return js({ ok: false, error: "Google no responde ahora" }, 502); }
    }
    if (u.pathname === "/panel/ia" && req.method === "POST") {
      let b = {}; try { b = JSON.parse(await req.text()); } catch (e) { return js({ ok: false, error: "JSON no válido" }, 400); }
      if (b.k !== PANEL_KEY) return js({ ok: false, error: "No autorizado" }, 403);
      try { return js(await (b.que === "lead" ? leadIA(b, env) : b.que === "versiones" ? rondaVersiones(b, env) : b.que === "correccion" ? correccionIA(b, env) : rondaIA(b, env))); } catch (e) { return js({ ok: false, error: String(e.message || e).slice(0, 300) }, 502); }
    }
    if (u.pathname === "/icon.png") {
      const b = Uint8Array.from(atob(ICON), c => c.charCodeAt(0));
      return new Response(b, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
    }
    if (u.pathname === "/alex.jpg") {
      const b = Uint8Array.from(atob(ALEX), c => c.charCodeAt(0));
      return new Response(b, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=604800" } });
    }
    if (u.pathname === "/manifest.json") {
      const cm = (u.searchParams.get("c") || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
      return new Response(manifiesto(cm), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } });
    }
    // Página: /?c=CODIGO  (el código se recuerda en el móvil para que funcione al abrir desde el icono)
    const c = (u.searchParams.get("c") || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
    const v = /^(home|hub|prog|week|extra|d[1-9]|st)$/.test(u.searchParams.get("v") || "") ? u.searchParams.get("v") : "home";
    const page = HTML.replace("__CODIGO__", c ? JSON.stringify(c) : '(function(){try{return localStorage.getItem("app_codigo")||""}catch(e){return ""}})()')
                     .replace("__VISTA__", JSON.stringify(v))
                     .replace('href="/manifest.json"', 'href="/manifest.json' + (c ? "?c=" + c : "") + '"')
                     .replace("</body>", c ? "</body>" : SIN_CODIGO + "</body>");
    return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
};
