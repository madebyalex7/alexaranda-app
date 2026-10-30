/**
 * App de entrenos · Alex Aranda
 * Backend en Apps Script, pegado en la hoja «App entrenos – maestra».
 *
 * Capas (para poder pasar el front a su propio dominio sin tocar la lógica):
 *   1. LÓGICA     · funciones puras: reciben objetos y devuelven objetos. No tocan hojas ni caché.
 *   2. DATOS      · leer y escribir pestañas (Spreadsheet), caché y bloqueo.
 *   3. SERVICIO   · despachar_(accion, codigo, datos): valida a la clienta y orquesta datos + lógica.
 *   4. TRANSPORTE · doGet (página), api() y funciones sueltas para google.script.run, doPost (JSON).
 * Todas las entradas pasan por despachar_, así que la respuesta es la misma venga de donde venga:
 *   { ok: true, data: … }  o  { ok: false, error: "…" }
 */

// ───────────────────────── Configuración ─────────────────────────
var MAESTRA_ID = '1UKuXBYxFLsjNVN6ecR2ALC6AI1J--08YpvC8XacFJ78';
var TZ = 'Europe/Madrid';
var CACHE_CLIENTE_S = 60;     // si Alex pone activa = FALSE, como mucho tarda 1 minuto en cortar
var CACHE_DATOS_S = 300;
/** Cambia con cada versión del código: así, al publicar una versión nueva, no se sirven datos guardados por la anterior */
var VERSION_DATOS = '2026-10-25b';      // cambios de Alex en el plan se ven en 5 minutos como mucho
var DIAS_ENTRENO = ['d1', 'd2', 'd3'];   // por defecto; cada hoja lo define en «Días plan» (todos menos «st»)

// ═════════════════════════ 1. LÓGICA (pura) ═════════════════════════

function L_num(v) {
  if (v === '' || v === null || v === undefined) return '';
  var n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? '' : n;
}
function L_bool(v) { return v === true || String(v).toUpperCase() === 'TRUE' || v === 1 || v === '1'; }
function L_int(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

/** 'yyyy-MM-dd' + n días → 'yyyy-MM-dd' (sin zonas horarias) */
function L_sumarDias(iso, n) {
  var p = String(iso).split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.toISOString().slice(0, 10);
}
/** La semana 1 siempre empieza en lunes: si la fecha de inicio no es lunes, se lleva al lunes de esa semana
 *  (y un domingo, al lunes siguiente: «empieza el domingo 25» quiere decir el lunes 26). */
function L_aLunes(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  var p = iso.split('-').map(Number), w = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return w === 1 ? iso : L_sumarDias(iso, w === 0 ? 1 : 1 - w);
}
function L_diasEntre(a, b) {
  var pa = String(a).split('-').map(Number), pb = String(b).split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5);
}

/** ID de YouTube desde shorts/ID, watch?v=ID o youtu.be/ID */
function L_youtubeId(url) {
  var m = String(url || '').match(/(?:shorts\/|watch\?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : '';
}

/** Los Shorts son verticales: el reproductor de la app cambia de forma */
function L_vertical(url) { return /shorts\//.test(String(url || '')); }

/** Días de entreno de la hoja (todos los de «Días plan» menos «st») */
function L_diasEntreno(diasplan) {
  var k = (diasplan || []).map(function (d) { return String(d.dia || ''); }).filter(function (x) { return x && x !== 'st'; });
  return k.length ? k : DIAS_ENTRENO.slice();
}
/** Objetivo de días por semana: ajuste «dias_semana» o, si no está, el número de días de entreno */
function L_objetivo(aj, entreno) { return aj && aj.dias_semana ? aj.dias_semana : entreno.length; }

/* ── Planes por semanas (bloques de 12) ──
 * Columnas opcionales semana_desde / semana_hasta en Plan, Calentamiento, Finisher, Finisher ejercicios, Días plan, Bloques,
 * Progresión y Recordatorios (también vale desde_semana / hasta_semana). Sin franja = todas las semanas.
 * Las semanas son del programa (Ajustes › semana, que avanza el domingo a las 22:00 España), no del calendario. */
function L_franja(r) {
  r = r || {};
  return { d: L_int(r.semana_desde || r.desde_semana), h: L_int(r.semana_hasta || r.hasta_semana) };
}
function L_enFranja(r, w) { var f = L_franja(r); return (!f.d || w >= f.d) && (!f.h || w <= f.h); }
function L_filtrarSemana(filas, w) { return (filas || []).filter(function (r) { return L_enFranja(r, w); }); }

/* Pestaña opcional «Bloques»: semana_desde, semana_hasta, bloque, objetivo, siguiente_bloque, siguiente_bloque_texto,
 * texto_calentamiento, movilidad, dias_semana. La fila de la semana w manda sobre Ajustes (lo que deje vacío, sale de Ajustes).
 * De paso marca dónde empieza y acaba el bloque (semana_inicio_bloque / fin_bloque). Sin pestaña, todo como antes. */
var CAMPOS_BLOQUE = ['bloque', 'objetivo', 'siguiente_bloque', 'siguiente_bloque_texto', 'texto_calentamiento', 'movilidad'];
function L_aplicarBloque(aj, bloques, w) {
  var b = null;
  (bloques || []).forEach(function (f) { if (L_enFranja(f, w) && (f.bloque || f.semana_desde || f.desde_semana)) b = f; });
  if (!b) return aj;
  CAMPOS_BLOQUE.forEach(function (c) { var v = String(b[c] === undefined || b[c] === null ? '' : b[c]).trim(); if (v) aj[c] = v; });
  if (L_int(b.dias_semana)) aj.dias_semana = L_int(b.dias_semana);
  var f = L_franja(b);
  if (f.d) aj.semana_inicio_bloque = f.d;
  if (f.h) aj.fin_bloque = f.h;
  return aj;
}

/* Pausa (Ajustes › pausa_desde y pausa_hasta, fechas): esas semanas no cuentan. Al volver, sigue en la semana en la que lo dejó
 * y todo el plan (franjas, progresión, bloques) se mueve con él. Una sola pausa a la vez: al terminar, se pueden borrar los dos
 * valores solo si se mueve fecha_inicio_semana1 lo mismo (si no, déjalos puestos). */
/** Pausa en semanas enteras de calendario: si no empieza en lunes, empieza el lunes siguiente (esa semana sigue normal);
 *  la semana en la que acaba cuenta entera como pausa. Devuelve {a, b} (semanas de calendario) o null. */
function L_pausa(aj) {
  if (!aj.fecha_inicio_semana1 || !aj.pausa_desde || !aj.pausa_hasta) return null;
  var a = L_semanaPorFecha(aj.fecha_inicio_semana1, aj.pausa_desde), b = L_semanaPorFecha(aj.fecha_inicio_semana1, aj.pausa_hasta);
  if (L_diasEntre(aj.fecha_inicio_semana1, aj.pausa_desde) % 7 !== 0) a++;
  return a && b >= a ? { a: a, b: b } : null;
}
/** Semana del programa en una fecha (calendario menos semanas de pausa) */
function L_semanaPrograma(aj, hoy) {
  var c = L_semanaPorFecha(aj.fecha_inicio_semana1, hoy), p = L_pausa(aj);
  if (!c || !p) return c;
  var n = Math.max(0, Math.min(c - 1, p.b) - p.a + 1);
  return c - n;
}
/** Lunes real de la semana S del programa */
function L_lunesPrograma(aj, S) {
  if (!aj.fecha_inicio_semana1) return '';
  var p = L_pausa(aj), c = p && S >= p.a ? S + (p.b - p.a + 1) : S;
  return L_sumarDias(aj.fecha_inicio_semana1, (c - 1) * 7);
}
/**
 * Plantillas A/B alternas (opcional, columnas plantilla_impar / plantilla_par en «Días plan»).
 * Devuelve tpl(k, w) → clave de la plantilla que usa el día k en la semana w (o k si no alterna).
 */
/**
 * «Días plan» › dia_semana (opcional): el día de la semana en que la clienta suele hacer ese entreno, para que se sitúe
 * («Entreno del lunes») y para los avisos del panel («semana a medias»). Acepta «lunes», «L», «lun», «X» (miércoles)
 * o varios separados por «/», «,» o «y»: «lunes/jueves». Devuelve los nombres en minúscula unidos por « o », o ''.
 */
var L_DSEM = { l: 'lunes', lu: 'lunes', lun: 'lunes', lunes: 'lunes', m: 'martes', ma: 'martes', mar: 'martes', martes: 'martes',
  x: 'miércoles', mi: 'miércoles', mie: 'miércoles', 'mié': 'miércoles', miercoles: 'miércoles', 'miércoles': 'miércoles',
  j: 'jueves', ju: 'jueves', jue: 'jueves', jueves: 'jueves', v: 'viernes', vi: 'viernes', vie: 'viernes', viernes: 'viernes',
  s: 'sábado', sa: 'sábado', sab: 'sábado', 'sáb': 'sábado', sabado: 'sábado', 'sábado': 'sábado',
  d: 'domingo', do: 'domingo', dom: 'domingo', domingo: 'domingo' };
function L_diaSemana(v) {
  var out = [];
  String(v || '').toLowerCase().split(/\s*(?:[\/,;+]|\by\b|\bo\b)\s*/).forEach(function (x) {
    x = x.trim().replace(/\.$/, ''); var n = L_DSEM[x]; if (n && out.indexOf(n) < 0) out.push(n);
  });
  return out.join(' o ');
}
function L_plantillas(diasplan) {
  var m = {};
  (diasplan || []).forEach(function (d) {
    var k = String(d.dia || ''); if (!k) return;
    m[k] = { i: String(d.plantilla_impar || '').trim(), p: String(d.plantilla_par || '').trim(), tp: String(d.titulo_par || '') };
  });
  return function (k, w) {
    var x = m[k]; if (!x) return k;
    var t = (w % 2 === 0) ? (x.p || x.i) : (x.i || x.p);
    return t || k;
  };
}

function L_ajustes(filas) {
  var a = {};
  filas.forEach(function (f) { if (f.clave) a[String(f.clave)] = f.valor; });
  return {
    nombre: String(a.nombre || ''),
    semana: L_int(a.semana) || 1,
    zona: String(a.zona || '').trim(), zona_movil: String(a.zona_movil || '').trim(),
    fecha_inicio_semana1: L_aLunes(String(a.fecha_inicio_semana1 || '').slice(0, 10)),
    pausa_desde: String(a.pausa_desde || '').slice(0, 10), pausa_hasta: String(a.pausa_hasta || '').slice(0, 10),
    bloque: String(a.bloque || ''),
    ciclo_inicio: L_int(a.ciclo_inicio) || 1,
    semanas_aprender: L_int(a.semanas_aprender),
    semana_inicio_bloque: L_int(a.semana_inicio_bloque) || 1,
    paleta: String(a.paleta || 'marca'),
    crono: L_bool(a.crono),
    objetivo_pasos: L_int(a.objetivo_pasos),
    peso_desde_semana: L_int(a.peso_desde_semana) || 1,
    // Báscula (Alex, 23/10): una vez por semana, los miércoles, en ayunas. semanal (por defecto) · quincenal · libre (cuando quiera, aviso el miércoles) · no (solo medidas)
    // Ajustes › peso_cada: 1 = semanal (por defecto) · 2 = cada 2 semanas · 0 = no se pide. También vale peso_frecuencia (semanal · quincenal · libre · no)
    peso_frecuencia: (function (c, v) {
      c = String(c === undefined || c === null ? '' : c).trim(); v = String(v || '').toLowerCase();
      if (c === '0') return 'no'; if (c === '2') return 'quincenal';
      return /quinc|2 sem/.test(v) ? 'quincenal' : /libre|m[aá]s/.test(v) ? 'libre' : /^no|nada|medidas/.test(v) ? 'no' : 'semanal';
    })(a.peso_cada, a.peso_frecuencia),
    importa: String(a.importa || 'cintura,cadera,peso,fuerza,constancia'),
    carpeta_fotos: String(a.carpeta_fotos || '').trim(),
    nutricion_pdf: String(a.nutricion_pdf || '').trim(),          // id (o enlace) del PDF de su plan de alimentación en Drive (Alex, 25/10)
    nutricion_fecha: String(a.nutricion_fecha || '').slice(0, 10),
    nivel: /^exp|^avan|^inter/i.test(String(a.nivel || '').trim()) ? 'exp' : 'nuevo',          // Ajustes › nivel: nuevo (por defecto) o experiencia
    pesos_disponibles: String(a.pesos_disponibles || '').trim(),                              // p. ej. «2,4,6,8,10» (mancuernas de casa)
    dias_semana: L_int(a.dias_semana),
    texto_calentamiento: String(a.texto_calentamiento || ''),
    movilidad: String(a.movilidad || ''),
    porque: String(a.porque || '').trim(),
    objetivo: String(a.objetivo || '').trim(),
    siguiente_bloque: String(a.siguiente_bloque || '').trim(),
    siguiente_bloque_texto: String(a.siguiente_bloque_texto || '').trim(),
    sexo: /^h|^m[aá]sc|^chico/i.test(String(a.sexo || '').trim()) ? 'h' : 'm'   // Ajustes › sexo: mujer (por defecto) u hombre
  };
}


/**
 * Pestaña «Progresión» (opcional): semana_desde, semana_hasta, aplica_a, series, repes, nota, test.
 * aplica_a: «todos», «principal», «accesorio» (todo lo que no es principal) o un ejercicio_id.
 * Para series y para repes, por separado, gana la fila más concreta que las tenga: ejercicio_id > principal/accesorio > todos.
 * Las repes solo se aplican a ejercicios con rango numérico simple en Plan («10-12»); los de tiempo o «por lado» se quedan como en Plan.
 * repes puede ser un rango («11-13») o relativo al de Plan («+2» → 10-12 pasa a 12-14).
 */
function L_progresion(filas) {
  return (filas || []).map(function (f) {
    var fr = L_franja(f), d = fr.d || 1, h = fr.h || d;
    return { d: d, h: h, a: String(f.aplica_a || 'todos').trim(), sr: L_int(f.series), rp: String(f.repes || '').trim(),
             nota: String(f.nota || '').trim(), test: L_bool(f.test) };
  });
}
function L_tramo(prog, e, w, campo) {
  var mejor = null, nivel = -1;
  prog.forEach(function (p) {
    if (w < p.d || w > p.h || !p[campo]) return;
    var n = p.a === e.id ? 2 : (p.a === 'principal' && e.s) || (p.a === 'accesorio' && !e.s) ? 1 : p.a === 'todos' ? 0 : -1;
    if (n > nivel) { nivel = n; mejor = p; }
  });
  return mejor;
}
var RANGO_SIMPLE = /^\d+\s*-\s*\d+$|^\d+$/;
/** Series y repes de un ejercicio en la semana w (Progresión si la hay; si no, Plan) */
function L_pauta(prog, e, w) {
  var ts = L_tramo(prog, e, w, 'sr'), tr = L_tramo(prog, e, w, 'rp'), sr = e.sr0, rp = e.rp0;
  if (ts) sr = ts.sr;
  if (tr && RANGO_SIMPLE.test(e.rp0)) {
    var rel = /^\+\s*(\d+)$/.exec(tr.rp);   // «+2»: sube el rango de Plan esas repes
    rp = rel ? e.rp0.replace(/\d+/g, function (n) { return String(+n + (+rel[1])); }) : tr.rp;
  }
  return { sr: sr, rp: rp };
}
/** Notas de la semana (revisa pesos, descarga…) y si un ejercicio lleva serie test */
function L_notasSemana(prog, w) {
  var out = [];
  prog.forEach(function (p) { if (p.nota && w >= p.d && w <= p.h && out.indexOf(p.nota) < 0) out.push(p.nota); });
  return out;
}
function L_esTest(prog, e, w) {
  return prog.some(function (p) { return p.test && w >= p.d && w <= p.h && (p.a === e.id || (p.a === 'principal' && e.s)); });
}
/** «Para ti» con el peso orientativo entre corchetes: [La primera vez: unos 40-50 kg.] */
function L_partirPeso(txt) {
  var w = [];
  var limpio = String(txt || '').replace(/\[([^\]]*)\]/g, function (_, x) { w.push(x.trim()); return ''; }).replace(/\s{2,}/g, ' ').trim();
  return { pt: limpio, ptw: w.join(' ') };
}
/** Recordatorio general por tramos (pestaña opcional «Recordatorios»: semana_desde, semana_hasta, texto) */
function L_recordatorio(filas, w) {
  var r = '';
  (filas || []).forEach(function (f) {
    var fr = L_franja(f), d = fr.d || 1, h = fr.h || 999;
    if (w >= d && w <= h && f.texto) r = String(f.texto);
  });
  return r;
}


/** «Lo próximo»: 1-2 cosas que vienen, de la Progresión, del Plan (ejercicios que entran más adelante) y de la pestaña opcional «Agenda» */
var DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
function L_cuandoSemana(w, S) { var n = w - S; return n <= 0 ? 'Esta semana' : n === 1 ? 'La semana que viene' : 'En ' + n + ' semanas'; }
function L_cuandoFecha(f, hoy) {
  var n = L_diasEntre(hoy, f); if (n <= 0) return 'Hoy'; if (n === 1) return 'Mañana';
  if (n < 7) { var p = String(f).split('-').map(Number); return 'El ' + DIAS_SEM[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()]; }
  if (n < 14) return 'La semana que viene';
  return 'En ' + Math.round(n / 7) + ' semanas';
}
function L_proximo(prog, plan, agenda, S, lunes, hoy, aj) {
  aj = aj || {};
  var objetivo = String(aj.objetivo || '').trim(), sb = String(aj.siguiente_bloque || '').trim(), sbt = String(aj.siguiente_bloque_texto || '').trim();
  var items = [], visto = {};
  var add = function (dist, txt, prio) { if (!visto[txt]) { visto[txt] = 1; items.push({ d: dist, t: txt, p: prio || 0 }); } };
  var EMO = { fotos: '📸', peso: '⚖️', medidas: '📏', revision: '📋', 'revisión': '📋' };
  (agenda || []).forEach(function (a) {
    var txt = String(a.texto || '').trim(); if (!txt) return;
    var tipo = String(a.tipo || '').trim().toLowerCase(), emo = EMO[tipo] && txt.indexOf(EMO[tipo]) < 0 ? ' ' + EMO[tipo] : '';
    var MOT = { fotos: '. Ya verás el cambio', medidas: ': lo que la báscula no cuenta', revision: ': repasamos juntos todo lo que has avanzado', 'revisión': ': repasamos juntos todo lo que has avanzado' };
    if (MOT[tipo] && !/[.!]$/.test(txt) && txt.length < 40) txt += MOT[tipo];
    if (a.fecha) { var f = String(a.fecha).slice(0, 10); var n = L_diasEntre(hoy, f); if (n < 0 || n > 35) return; add(n, L_cuandoFecha(f, hoy) + ': ' + txt + emo, 1); }
    else if (a.semana) { var w = L_int(a.semana); if (w < S || w > S + 5) return; add((w - S) * 7 + 0.5, L_cuandoSemana(w, S) + ': ' + txt + emo, 1); }
  });
  var futuro = function (w) { return w > S && w <= S + 6; };
  prog.forEach(function (p) {
    if (!futuro(p.d)) return;
    var C = L_cuandoSemana(p.d, S), dist = (p.d - S) * 7;
    if (p.test) add(dist, C + ': serie test. Te van a caber más de las que crees 💪');
    if (/revis|ajust/i.test(p.nota)) add(dist + 0.1, C + ' toca revisar pesos: si llegas al tope del rango, subimos 💪');
    if (/descarga|suave/i.test(p.nota)) add(dist + 0.2, C + ', semana suave para recargar pilas 🌿');
    if (/ciclo nuevo/i.test(p.nota)) add(dist + 0.25, C + ' empieza ciclo nuevo: subimos un poquito el peso' + (objetivo ? ', todo para ' + objetivo : '') + ' 💪');
  });
  // Ejercicios que entran más adelante (columna semana_desde del Plan) = cambio de sub-bloque
  var cambio = null;
  (plan || []).forEach(function (r) { var w = L_franja(r).d; if (futuro(w) && (cambio === null || w < cambio)) cambio = w; });
  if (cambio !== null) add((cambio - S) * 7 + 0.3, L_cuandoSemana(cambio, S) + ' cambiamos ejercicios: nuevo reto para seguir progresando' + (objetivo ? ', todo para ' + objetivo : '') + ' 💪');
  // Fin del bloque: la última semana de la Progresión
  var fin = 0; prog.forEach(function (p) { if (p.h < 900 && p.h > fin) fin = p.h; });
  if (aj.fin_bloque) fin = aj.fin_bloque;   // con pestaña Bloques, el fin es el de su bloque (no la última semana de toda la Progresión)
  if (fin >= 6 && fin >= S && fin <= S + 4) {
    var txtFin;
    if (sb) txtFin = (fin === S ? 'La semana que viene' : 'En ' + (fin + 1 - S) + ' semanas') + ' empieza tu próximo bloque: «' + sb + '». Prepárate, que viene ' + (sbt || 'un paso más') + (objetivo ? '. Todo para ' + objetivo : '') + ' 🔥';
    else txtFin = (fin === S ? 'Esta semana' : L_cuandoSemana(fin, S)) + ' acabas el bloque: miramos todo lo que has mejorado y arrancamos el siguiente' + (objetivo ? ', todo para ' + objetivo : '') + ' 🔥';
    if (fin === S && sb) add(6, 'Última semana del bloque: dalo todo, que la semana que viene empieza «' + sb + '» 🔥');
    else add((fin - S) * 7 + 6.5, txtFin);
  }
  items.sort(function (a, b) { return a.d - b.d || b.p - a.p; });
  return items.slice(0, 2).map(function (x) { return x.t; });
}
/** Mejora desde la primera vez en un principal (la mayor subida en kg) */
function L_desdeInicio(porSemEj, dias, entreno) {
  var mejor = null, vistos = {};
  entreno.forEach(function (k) {
    if (!dias[k]) return;
    dias[k].ej.forEach(function (e) {
      if (!e.s) return;
      var pk = dias[k].tk + '|' + e.id; if (vistos[pk]) return; vistos[pk] = 1;
      var porW = porSemEj[pk] || {}, ws = Object.keys(porW).map(Number).sort(function (a, b) { return a - b; });
      var kgs = ws.map(function (w) { var b = L_mejorSerie(porW[w]); return b && b.kg !== '' ? +b.kg : null; }).filter(function (x) { return x !== null; });
      if (kgs.length < 2) return;
      var dif = Math.round((Math.max.apply(null, kgs) - kgs[0]) * 10) / 10;
      if (dif > 0 && (!mejor || dif > mejor.dif)) mejor = { nm: e.nm, ini: kgs[0], now: Math.max.apply(null, kgs), dif: dif };
    });
  });
  return mejor;
}

/**
 * Medallas: totales de las semanas ya cerradas (antes de la actual). El front suma la semana en curso.
 * Devuelve { entrenos, semCompletas, mejorRacha, marcas, extras, test, mes, semBloque }.
 */
function L_logros(t, diasIdx, porSemEj, dias, S, aj, entreno, objetivo) {
  var entrenos = 0, semCompletas = 0, mejorRacha = 0, racha = 0;
  for (var w = 1; w < S; w++) {
    var n = L_diasHechos(diasIdx[w] || {}, entreno, objetivo);
    entrenos += n;
    if (n >= objetivo) { semCompletas++; racha++; if (racha > mejorRacha) mejorRacha = racha; } else racha = 0;
  }
  var marcas = 0, vistos = {};
  entreno.forEach(function (k) {
    if (!dias[k]) return;
    dias[k].ej.forEach(function (e) {
      if (!e.s) return;
      var pk = dias[k].tk + '|' + e.id; if (vistos[pk]) return; vistos[pk] = 1;
      var porW = porSemEj[pk] || {}, ws = Object.keys(porW).map(Number).filter(function (x) { return x < S; }).sort(function (a, b) { return a - b; });
      var best = null;
      ws.forEach(function (x) {
        var b = L_mejorSerie(porW[x]); if (!b) return;
        var bk = +b.kg || 0;
        if (best && (bk > (+best.kg || 0) || (bk === (+best.kg || 0) && b.r > best.r))) marcas++;
        if (!best || bk > (+best.kg || 0) || (bk === (+best.kg || 0) && b.r > best.r)) best = b;
      });
    });
  });
  var extras = (t.extra || []).filter(function (x) { return L_int(x.semana) && L_int(x.semana) < S; }).length;
  var test = (t.registro || []).some(function (r) { return r.test_estimacion !== undefined && r.test_estimacion !== ''; });
  var mes = !!(aj.fecha_inicio_semana1 && t.hoy && L_diasEntre(aj.fecha_inicio_semana1, t.hoy) >= 28);
  var semBloque = S - (L_int(aj.semana_inicio_bloque) || 1) + 1;
  return { entrenos: entrenos, semCompletas: semCompletas, mejorRacha: mejorRacha, marcas: marcas, extras: extras, test: test, mes: mes, semBloque: semBloque };
}

/** Mejor serie de una lista: más kg y, a igualdad, más repes */
/** Mi progreso: pesos, medidas y fotos (solo fecha y tipo: las miniaturas se piden aparte con la acción «fotos») */
var MEDIDAS = ['cintura', 'cadera', 'pecho', 'muslo', 'brazo'];
function L_miProgreso(t, aj) {
  var fe = function (x) { return String(x || '').slice(0, 10); };
  var pesos = (t.peso || []).filter(function (r) { return /^\d{4}-\d{2}-\d{2}$/.test(fe(r.fecha)) && L_num(r.peso) !== ''; })
    .map(function (r) { var o = { f: fe(r.fecha), p: +L_num(r.peso) }; if (r.regla) o.c = String(r.regla); return o; }).sort(function (a, b) { return a.f < b.f ? -1 : 1; });
  var medidas = (t.medidas || []).filter(function (r) { return /^\d{4}-\d{2}-\d{2}$/.test(fe(r.fecha)); }).map(function (r) {
    var o = { f: fe(r.fecha) }; MEDIDAS.forEach(function (m) { var v = L_num(r[m]); if (v !== '') o[m] = +v; }); return o;
  }).sort(function (a, b) { return a.f < b.f ? -1 : 1; });
  var fotos = (t.fotos || []).filter(function (r) { return /^\d{4}-\d{2}-\d{2}$/.test(fe(r.fecha)) && r.archivo_id; })
    .map(function (r) { return { f: fe(r.fecha), t: String(r.tipo || '') }; });
  var molestias = (t.molestias || []).filter(function (r) { return /^\d{4}-\d{2}-\d{2}$/.test(fe(r.fecha)); })
    .map(function (r) { return { f: fe(r.fecha), z: String(r.zona || ''), v: L_int(r.valor), d: String(r.desde || ''), t: String(r.texto || ''), uid: String(r.uid || '') }; })
    .sort(function (a, b) { return a.f < b.f ? 1 : -1; }).slice(0, 20);
  return { pesos: pesos, medidas: medidas, fotos: fotos, molestias: molestias, importa: aj.importa, pesoDesde: aj.peso_desde_semana, pesoFrec: aj.peso_frecuencia };
}

function L_mejorSerie(series) {
  var b = null;
  series.forEach(function (s) {
    var kg = L_num(s.peso), r = L_int(s.repes);
    if (r <= 0) return;
    var x = { kg: kg, r: r };
    var bk = b ? (+b.kg || 0) : -1, xk = +kg || 0;
    if (!b || xk > bk || (xk === bk && r > b.r)) b = x;
  });
  return b;
}

/** Molestias guardadas como "id:v;id2:v2" */
function L_leerMol(txt) {
  var o = {};
  String(txt || '').split(';').forEach(function (p) {
    var kv = p.split(':'); if (kv.length === 2 && kv[0]) o[kv[0]] = L_int(kv[1]);
  });
  return o;
}
function L_escribirMol(txt, id, v) {
  var o = L_leerMol(txt); o[id] = v;
  return Object.keys(o).map(function (k) { return k + ':' + o[k]; }).join(';');
}

/** Días que cuentan en la semana: d1-d3 hechos + «Sin tiempo» si sustituye a uno pendiente */
function L_diasHechos(diasSemana, entreno, objetivo) {
  entreno = entreno || DIAS_ENTRENO; objetivo = objetivo || entreno.length;
  var h = {}; entreno.forEach(function (k) { h[k] = !!(diasSemana[k] && diasSemana[k].hecho); });
  var n = entreno.filter(function (k) { return h[k]; }).length;
  var st = diasSemana.st;
  if (st && st.hecho && n < objetivo) {
    if (!st.sustituye || !h[st.sustituye]) n++;
  }
  return Math.min(n, objetivo);
}

function L_racha(historial, semana, objetivo) {
  objetivo = objetivo || 3;
  var porSem = {};
  historial.forEach(function (h) { porSem[L_int(h.semana)] = L_int(h.dias_hechos); });
  var n = 0;
  for (var w = semana - 1; w >= 1; w--) {
    if (porSem[w] >= objetivo) n++; else break;
  }
  return n;
}

/** Agrupa filas de la pestaña Días por semana y día */
function L_json(v) { try { var o = JSON.parse(String(v || '')); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
function L_indiceDias(filas) {
  var o = {};
  filas.forEach(function (f) {
    var w = L_int(f.semana), k = String(f.dia || '');
    if (!w || !k) return;
    (o[w] = o[w] || {})[k] = {
      hecho: L_bool(f.hecho), flojo: L_bool(f.flojo),
      sens: L_int(f.sensacion) || null, nota: String(f.nota || ''),
      mol: L_leerMol(f.molestia), sustituye: String(f.sustituye || ''),
      energia: L_int(f.energia) || null,
      fecha: (/^\d{4}-\d{2}-\d{2}/.test(String(f.fecha || '')) ? String(f.fecha) : String(f.fin || f.actualizado || '')).slice(0, 10), minE: L_int(f.min_entreno) || null,
      molDet: L_json(f.molestia_detalle), molFin: String(f.molestia_fin || '')
    };
  });
  return o;
}

/**
 * Pestaña «Correcciones» (opcional): fecha, ejercicio_id, texto, estado (activa | superada), mostrar_hasta.
 * Se ve al menos 14 días desde la fecha; después, mientras no esté «superada» (y no pase mostrar_hasta).
 * Si hay varias del mismo ejercicio, la más reciente. Devuelve { ejercicio_id: { fecha, texto } }.
 */
/**
 * Correcciones superadas: durante 4 semanas desde que se superan se recuerdan en una línea al final de «Para ti».
 * Fecha de superada: columna superada_el; si está vacía, mostrar_hasta; si tampoco, fecha + 6 semanas.
 * Texto: columna resumen (corta, p. ej. «codos pegados»); si no hay, el texto. Devuelve { ejercicio_id: { fecha, texto } }.
 */
function L_corrSuperadas(filas, hoy, activas) {
  var out = {};
  (filas || []).forEach(function (f) {
    var id = String(f.ejercicio_id || '').trim(), fe = String(f.fecha || '').slice(0, 10);
    if (!id || !/superad/i.test(String(f.estado || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(fe) || (activas && activas[id])) return;
    var tx = String(f.resumen || '').trim() || String(f.texto || '').trim(); if (!tx) return;
    var su = String(f.superada_el || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(su)) su = String(f.mostrar_hasta || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(su)) su = L_sumarDias(fe, 42);
    if (su > hoy || hoy > L_sumarDias(su, 28)) return;
    if (!out[id] || out[id].fecha < su) out[id] = { fecha: su, texto: tx };
  });
  return out;
}

function L_correcciones(filas, hoy) {
  var out = {};
  (filas || []).forEach(function (f) {
    var id = String(f.ejercicio_id || '').trim(), tx = String(f.texto || '').trim(), fe = String(f.fecha || '').slice(0, 10);
    if (!id || !tx || !/^\d{4}-\d{2}-\d{2}$/.test(fe) || fe > hoy) return;
    var minimo = L_sumarDias(fe, 14), hasta = String(f.mostrar_hasta || '').slice(0, 10);
    var superada = /superad/i.test(String(f.estado || ''));
    var visible = hoy <= minimo || (!superada && (!hasta || hoy <= hasta));
    if (!visible) return;
    if (!out[id] || out[id].fecha < fe) out[id] = { fecha: fe, texto: tx };
  });
  return out;
}

/**
 * Construye todo lo que necesita la app en una sola respuesta.
 * t = { ajustes:[], plan:[], cal:[], fin:[], finej:[], diasplan:[], registro:[], dias:[], extra:[], pasos:[],
 *       historial:[], notas:[], videos:[], codigo, hoy:'yyyy-MM-dd', paletaMaestra }
 */
function L_construir(t) {
  var aj = L_ajustes(t.ajustes);
  var S = aj.semana;
  L_aplicarBloque(aj, t.bloques, S);
  // Solo lo que toca esta semana del programa (filas sin franja = todas las semanas)
  var diasplan = L_filtrarSemana(t.diasplan, S);
  var diasIdx = L_indiceDias(t.dias);
  var entreno = L_diasEntreno(diasplan), objetivo = L_objetivo(aj, entreno);
  var tpl = L_plantillas(diasplan);
  var famDe = {}; (t.plan || []).forEach(function (p) { var f = String(p.familia || '').trim(); if (f) famDe[String(p.ejercicio_id)] = f; });

  // Plan por día
  var dias = {}, orden = [];
  diasplan.forEach(function (d) {
    var k = String(d.dia); if (!k || dias[k]) return;
    orden.push(k);
    var tk = tpl(k, S);
    dias[k] = { k: k, tk: tk, ds: L_diaSemana(d.dia_semana), foco: String(d.foco || '').trim().toLowerCase(), n: String(d.nombre || ''), t: String((S % 2 === 0 && d.titulo_par) ? d.titulo_par : (d.titulo || '')), ej: [], cal: [], fin: null, fv: [] };
  });
  // Filas de plan, calentamiento y finisher: van al día real o a la plantilla que use esta semana
  var destinos = function (clave) {
    clave = String(clave); return orden.filter(function (k) { return k === clave || dias[k].tk === clave; }).map(function (k) { return dias[k]; });
  };
  t.plan.slice().sort(function (a, b) { return L_int(a.orden) - L_int(b.orden); }).forEach(function (p) {
    // Columnas opcionales semana_desde / semana_hasta: el ejercicio solo sale en esas semanas (p. ej. el step-up desde la 7)
    if (!L_enFranja(p, S)) return;
    var pp = L_partirPeso(p.para_ti);
    destinos(p.dia).forEach(function (d) { d.ej.push({
      id: String(p.ejercicio_id), nm: String(p.nombre), g: String(p.grupo || ''),
      sr0: L_int(p.series) || 3, rp0: String(p.repes || ''), ds: String(p.descanso || ''),
      pt: pp.pt, ptw: pp.ptw, c: String(p.como || ''), alt: String(p.alternativa || ''),
      yt: L_youtubeId(p.video), yv: L_vertical(p.video), img: String(p.imagen_id || ''),
      s: L_bool(p.principal), mol: L_bool(p.molestia), fam: famDe[String(p.ejercicio_id)] || '',   // familia: variantes del mismo ejercicio
      ad: String(p.adaptado || '').trim(),          // Plan › adaptado: «sí» (o la zona: «rodilla», «lumbar»…) → aviso «Adaptado para ti, vamos con cuidado»
      go: String(p.goma || '').trim(),              // Plan › goma: «Goma 20 kg · un paso largo desde la puerta» (distancia con palabras, sin marcas)
      ge: String(p.siguiente_escalon || '').trim(), // Plan › siguiente_escalon: el siguiente paso cuando llegue al tope
      el: String(p.entre_lados || '').trim(),       // Plan › entre_lados: descanso entre una pierna y otra (si no, se deduce)
      tq: String(p.tranquilo || '').trim()          // Plan › tranquilo: en el día tranquilo, «fuera» (o «fuera: ya lo trabajas en el remo») o el número de series
    }); });
  });
  L_filtrarSemana(t.cal, S).slice().sort(function (a, b) { return L_int(a.orden) - L_int(b.orden); }).forEach(function (c) {
    var x = { nm: String(c.nombre), rp: String(c.repes || ''), yt: L_youtubeId(c.video), yv: L_vertical(c.video),
              pq: String(c.para_que || ''), c: String(c.como || '') };
    // Opcionales: rondas (p. ej. 2 = el circuito se repite) y tipo «previo» (p. ej. 3 min de remo antes del circuito)
    if (L_int(c.rondas) > 1) x.rd = L_int(c.rondas);
    if (/previo|antes|cardio/i.test(String(c.tipo || ''))) x.pre = 1;
    var vuelta = /vuelta/i.test(String(c.tipo || ''));
    destinos(c.dia).forEach(function (d) { (vuelta ? (d.vc = d.vc || []) : d.cal).push(x); });
  });
  L_filtrarSemana(t.fin, S).forEach(function (f) {
    destinos(f.dia).forEach(function (d) { d.fin = {
      titulo: String(f.titulo || 'Finisher'), texto: String(f.texto || ''), prog: String(f.progresion || ''),
      emom: L_int(f.emom_min), sec: String(f.secuencia || '').split('|').map(function (s) { return s.trim(); }).filter(String)
    }; });
  });
  L_filtrarSemana(t.finej, S).forEach(function (f) {
    destinos(f.dia).forEach(function (d) { d.fv.push({ nm: String(f.nombre), yt: L_youtubeId(f.video), yv: L_vertical(f.video) }); });
  });

  // Registro: estado de esta semana + historial por ejercicio
  var reg = {}, porSemEj = {}, flojoEj = {}, conPeso = {};
  t.registro.forEach(function (r) {
    var w = L_int(r.semana), k = String(r.dia), id = String(r.ejercicio_id), j = L_int(r.serie);
    if (!w || !k || !id || !j) return;
    if (w === S) {
      reg[k + '|' + id + '|' + (j - 1)] = { p: r.peso === '' ? '' : String(r.peso), r: r.repes === '' ? '' : String(r.repes), ok: L_bool(r.hecho) };
      if (r.test_estimacion !== undefined && r.test_estimacion !== '') reg[k + '|' + id + '|' + (j - 1)].est = L_int(r.test_estimacion);
      if (r.sobrado !== undefined && r.sobrado !== '') reg[k + '|' + id + '|' + (j - 1)].sb = L_bool(r.sobrado);
    }
    if (w < S && r.peso !== '' && r.peso !== undefined) conPeso[id] = true;
    if (w < S) {
      // El historial va por plantilla (A/B) cuando el día alterna; si no, por día
      var key = tpl(k, w) + '|' + id;
      ((porSemEj[key] = porSemEj[key] || {})[w] = porSemEj[key][w] || []).push(r);
      if (diasIdx[w] && diasIdx[w][k] && diasIdx[w][k].flojo) (flojoEj[key] = flojoEj[key] || {})[w] = true;
      // Y por ejercicio en cualquier día: si en el bloque nuevo cambia de día, se ve igual «la última vez que lo hiciste»
      var kid = '*|' + id;
      ((porSemEj[kid] = porSemEj[kid] || {})[w] = porSemEj[kid][w] || []).push(r);
      if (diasIdx[w] && diasIdx[w][k] && diasIdx[w][k].flojo) (flojoEj[kid] = flojoEj[kid] || {})[w] = true;
    }
  });
  var histTpl = {};
  Object.keys(porSemEj).forEach(function (key) {
    var semanas = Object.keys(porSemEj[key]).map(Number).sort(function (a, b) { return b - a; });
    var out = [];
    semanas.forEach(function (w) {
      if (out.length >= 2) return;
      var b = L_mejorSerie(porSemEj[key][w]);
      if (b) {
        // rmin: repes más bajas de las series hechas; igual: todas con el mismo peso (para proponer subir peso)
        var hechas = porSemEj[key][w].filter(function (s) { return L_int(s.repes) > 0; });
        var rmin = hechas.reduce(function (m, s) { return Math.min(m, L_int(s.repes)); }, 999);
        var igual = hechas.every(function (s) { return String(L_num(s.peso)) === String(b.kg); });
        // sb: lo que contestó a «¿Te ha sobrado?» (true/false), si contestó
        var sbs = porSemEj[key][w].filter(function (s) { return s.sobrado !== undefined && s.sobrado !== ''; });
        var it = { w: w, kg: b.kg, r: b.r, fl: !!(flojoEj[key] && flojoEj[key][w]), rmin: rmin === 999 ? 0 : rmin, ns: hechas.length, igual: igual };
        if (sbs.length) it.sb = L_bool(sbs[0].sobrado);
        out.push(it);
      }
    });
    if (out.length) histTpl[key] = out;
  });
  // El front pide el historial por «día real|ejercicio»
  var hist = {};
  orden.forEach(function (k) {
    dias[k].ej.forEach(function (e) { var h = histTpl[dias[k].tk + '|' + e.id] || histTpl['*|' + e.id]; if (h) hist[k + '|' + e.id] = h; });
  });

  // Pauta de la semana (Progresión o Plan), repes de las 2 semanas anteriores para los avisos, test y peso orientativo
  var prog = L_progresion(t.progresion);
  orden.forEach(function (k) {
    dias[k].ej.forEach(function (e) {
      var p = L_pauta(prog, e, S); e.sr = p.sr; e.rp = p.rp;
      e.rpw = {}; [S - 1, S - 2].forEach(function (w) { if (w >= 1) e.rpw[w] = L_pauta(prog, e, w).rp; });
      e.test = L_esTest(prog, e, S);
      e.yaPeso = !!conPeso[e.id];
    });
  });
  var notasSemana = L_notasSemana(prog, S);
  // Objetivo de pasos por tramos: filas de Progresión con aplica_a = «pasos» y el número en «repes»
  var pasosObj = aj.objetivo_pasos;
  prog.forEach(function (p) { if (p.a === 'pasos' && S >= p.d && S <= p.h && L_int(p.rp)) pasosObj = L_int(p.rp); });
  var recordatorio = L_recordatorio(t.recordatorios, S);

  // Estado de la semana actual
  var est = { hechos: {}, flojo: {}, sens: {}, nota: {}, mol: {}, sust: {}, energia: {}, fecha: {}, min: {}, molDet: {}, molFin: {} };
  var dS = diasIdx[S] || {};
  Object.keys(dS).forEach(function (k) {
    var x = dS[k];
    est.hechos[k] = x.hecho; est.flojo[k] = x.flojo;
    if (x.sens) est.sens[k] = x.sens; if (x.nota) est.nota[k] = x.nota;
    Object.keys(x.mol).forEach(function (id) { est.mol[k + '|' + id] = x.mol[id]; });
    if (x.sustituye) est.sust[k] = x.sustituye;
    if (x.energia) est.energia[k] = x.energia;
    if (x.hecho && /^\d{4}-\d{2}-\d{2}$/.test(x.fecha)) est.fecha[k] = x.fecha;
    if (x.minE) est.min[k] = x.minE;
    Object.keys(x.molDet).forEach(function (id) { est.molDet[k + '|' + id] = String(x.molDet[id]); });
    if (x.molFin) est.molFin[k] = x.molFin;
  });

  // Progreso del bloque (principales con peso)
  var progBloque = [], vistos = {};
  entreno.forEach(function (k) {
    if (!dias[k]) return;
    dias[k].ej.forEach(function (e) {
      if (!e.s) return;
      var pk = dias[k].tk + '|' + e.id; if (vistos[pk]) return; vistos[pk] = 1;
      var porW = porSemEj[pk] || {};
      var ws = Object.keys(porW).map(Number).filter(function (w) { return w >= aj.semana_inicio_bloque; }).sort(function (a, b) { return a - b; });
      var kgs = ws.map(function (w) { var b = L_mejorSerie(porW[w]); return b && b.kg !== '' ? +b.kg : null; }).filter(function (x) { return x !== null; });
      if (!kgs.length) return;
      progBloque.push({ id: e.id, nm: e.nm, ini: kgs[0], now: Math.max.apply(null, kgs) });
    });
  });

  // Nota de Alex y vídeos pedidos (miércoles a martes)
  var notaAlex = '';
  t.notas.forEach(function (n) {
    if (String(n.codigo) !== t.codigo || !n.nota) return;
    // valida_desde (opcional) permite dejarla preparada; valida_hasta = mismo día para una nota de un solo día. Gana la última fila válida
    if (n.valida_desde && String(n.valida_desde) > t.hoy) return;
    if (!n.valida_hasta || String(n.valida_hasta) >= t.hoy) notaAlex = String(n.nota);
  });
  var vped = {};
  t.videos.forEach(function (v) {
    if (String(v.codigo) !== t.codigo || !v.ejercicio_id) return;
    var desde = String(v.desde || ''), hasta = String(v.hasta || '');
    if ((!desde || desde <= t.hoy) && (!hasta || hasta >= t.hoy)) vped[String(v.ejercicio_id)] = { ind: String(v.indicacion || ''), como: String(v.como_grabar || ''), grabado: String(v.grabado || '').slice(0, 10) };
  });
  var correcciones = L_correcciones(t.correcciones, t.hoy);
  var corrSup = L_corrSuperadas(t.correcciones, t.hoy, correcciones);

  // Extra de esta semana y últimos pasos
  var extras = t.extra.filter(function (x) { return L_int(x.semana) === S; }).map(function (x) {
    return { uid: String(x.uid || ''), fecha: String(x.fecha), tipo: String(x.tipo), min: L_int(x.minutos), km: L_num(x.km), ritmo: String(x.ritmo || ''), sens: L_int(x.sensacion) || null, nota: String(x.nota || '') };
  });
  var pasos = {};
  t.pasos.forEach(function (p) { if (p.fecha) pasos[String(p.fecha)] = L_int(p.pasos); });

  var lunes = L_lunesPrograma(aj, S);
  var proximo = L_proximo(prog, t.plan, t.agenda, S, lunes, t.hoy, aj);
  var desdeInicio = L_desdeInicio(porSemEj, dias, entreno);

  return {
    v: 1, codigo: t.codigo, nombre: aj.nombre, semana: S, bloque: aj.bloque, lunes: lunes,
    ciclo_inicio: aj.ciclo_inicio, semanas_aprender: aj.semanas_aprender,
    ajustes: { paleta: aj.paleta || t.paletaMaestra || 'marca', crono: aj.crono, objetivo_pasos: pasosObj }, sexo: aj.sexo,
    nivel: aj.nivel, pesosDisp: aj.pesos_disponibles,
    orden: orden, dias: dias, hist: hist, est: est, reg: reg, entreno: entreno, objetivo: objetivo,
    racha: L_racha(t.historial, S, objetivo), progreso: progBloque, notaAlex: notaAlex, vped: vped,
    extras: extras, pasos: pasos, hoy: t.hoy,
    nutri: aj.nutricion_pdf ? { fecha: aj.nutricion_fecha || '' } : null,
    notasSemana: notasSemana, recordatorio: recordatorio, textoCal: aj.texto_calentamiento, movilidad: aj.movilidad,
    proximo: proximo, desdeInicio: desdeInicio,
    correcciones: correcciones, corrSup: corrSup, porque: aj.porque,
    logros: L_logros(t, diasIdx, porSemEj, dias, S, aj, entreno, objetivo),
    mp: L_miProgreso(t, aj),
    semAnt: S > 1 && diasIdx[S - 1] ? L_diasHechos(diasIdx[S - 1], entreno, objetivo) : null   // solo si ya usaba la app la semana pasada
  };
}

/**
 * Valida una operación del front y la traduce a un cambio de hoja.
 * Devuelve { tabla, clave:{…}, valores:{…}, mol? } o lanza Error.
 * plan = { d1:['sentadilla-goblet', …], … } para comprobar día y ejercicio.
 */
function L_normalizarOp(op, plan, ahora) {
  if (!op || typeof op !== 'object') throw new Error('Operación vacía');
  var sem = L_int(op.semana);
  var txt = function (v, max) { return String(v === undefined || v === null ? '' : v).slice(0, max); };
  var dia = function () { if (!plan[op.k]) throw new Error('Día no válido: ' + op.k); return op.k; };
  var semOk = function () { if (sem < 1 || sem > 300) throw new Error('Semana no válida'); return sem; };
  switch (op.fn) {
    case 'serie': {
      var k = dia();
      if (plan[k].indexOf(String(op.id)) < 0) throw new Error('Ejercicio no válido: ' + op.id);
      var j = L_int(op.j); if (j < 0 || j > 9) throw new Error('Serie no válida');
      var p = L_num(op.p), r = op.r === '' || op.r === undefined ? '' : L_int(op.r);
      if (p !== '' && (p < 0 || p > 500)) throw new Error('Peso no válido');
      if (r !== '' && (r < 0 || r > 500)) throw new Error('Repes no válidas');
      return { tabla: 'Registro', clave: { semana: semOk(), dia: k, ejercicio_id: String(op.id), serie: j + 1 },
               valores: { peso: p, repes: r, hecho: !!op.ok, actualizado: ahora } };
    }
    case 'molnota': {
      // «Descríbeme la molestia» (molestia de 4 o más en un ejercicio). Días › molestia_detalle (JSON por ejercicio)
      var kn = dia();
      if (plan[kn].indexOf(String(op.id)) < 0) throw new Error('Ejercicio no válido');
      return { tabla: 'Días', clave: { semana: semOk(), dia: kn }, valores: { actualizado: ahora }, molnota: { id: String(op.id), t: txt(op.t, 400) } };
    }
    case 'molfin': {
      // Al cerrar el día, si hubo molestia: ¿siguió durante el entreno? (se fue · igual · a más)
      var kf = dia(), vf = String(op.v || '');
      if (['se fue', 'igual', 'a más', 'a menos', ''].indexOf(vf) < 0) throw new Error('Valor no válido');
      return { tabla: 'Días', clave: { semana: semOk(), dia: kf }, valores: { molestia_fin: vf, actualizado: ahora } };
    }
    case 'molestia': {
      // Mi progreso › «Avisar de una molestia» (fuera de un ejercicio)
      if (!op.uid) throw new Error('Falta uid');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(op.fecha))) throw new Error('Fecha no válida');
      var mvv = L_int(op.v); if (mvv < 0 || mvv > 10) throw new Error('Valor no válido');
      return { tabla: 'Molestias', clave: { uid: txt(op.uid, 40) }, valores: { fecha: String(op.fecha), zona: txt(op.zona, 60), valor: mvv, desde: txt(op.desde, 60), texto: txt(op.texto, 600), actualizado: ahora } };
    }
    case 'sobra': {
      // «¿Te ha sobrado?» al acabar un ejercicio con todas las series al máximo del rango. Se guarda en la serie 1
      var ks = dia();
      if (plan[ks].indexOf(String(op.id)) < 0) throw new Error('Ejercicio no válido: ' + op.id);
      return { tabla: 'Registro', clave: { semana: semOk(), dia: ks, ejercicio_id: String(op.id), serie: 1 }, valores: { sobrado: !!op.v, actualizado: ahora } };
    }
    case 'test': {
      var kt = dia();
      if (plan[kt].indexOf(String(op.id)) < 0) throw new Error('Ejercicio no válido: ' + op.id);
      var jt = L_int(op.j); if (jt < 0 || jt > 9) throw new Error('Serie no válida');
      var et = op.est === '' || op.est === undefined || op.est === null ? '' : L_int(op.est);
      if (et !== '' && (et < 0 || et > 200)) throw new Error('Estimación no válida');
      return { tabla: 'Registro', clave: { semana: semOk(), dia: kt, ejercicio_id: String(op.id), serie: jt + 1 },
               valores: { test_estimacion: et, actualizado: ahora } };
    }
    case 'dia': {
      var k2 = dia();
      if (op.campo !== 'hecho' && op.campo !== 'flojo') throw new Error('Campo no válido');
      var v = {}; v[op.campo] = !!op.valor; v.actualizado = ahora;
      // El día en que lo hizo, según su móvil (si sincroniza tarde, no cuenta el día en que llegó)
      if (op.campo === 'hecho') v.fecha = op.valor && /^\d{4}-\d{2}-\d{2}$/.test(String(op.fecha)) ? String(op.fecha) : '';
      return { tabla: 'Días', clave: { semana: semOk(), dia: k2 }, valores: v };
    }
    case 'cierre': {
      var k3 = dia();
      var sens = op.sens === null || op.sens === undefined || op.sens === '' ? '' : L_int(op.sens);
      if (sens !== '' && (sens < 1 || sens > 5)) throw new Error('Sensación no válida');
      var sus = op.sustituye ? String(op.sustituye) : '';
      if (sus && (sus === 'st' || !plan[sus])) throw new Error('Sustituye no válido');
      return { tabla: 'Días', clave: { semana: semOk(), dia: k3 }, valores: { sensacion: sens, nota: txt(op.nota, 1000), sustituye: sus, actualizado: ahora } };
    }
    case 'energia': {
      var ke = dia();
      var en = L_int(op.v); if (en < 1 || en > 3) throw new Error('Energía no válida');
      return { tabla: 'Días', clave: { semana: semOk(), dia: ke }, valores: { energia: en, actualizado: ahora } };
    }
    case 'mol': {
      var k4 = dia();
      if (plan[k4].indexOf(String(op.id)) < 0) throw new Error('Ejercicio no válido');
      var mv = L_int(op.v); if (mv < 0 || mv > 10) throw new Error('Molestia no válida');
      return { tabla: 'Días', clave: { semana: semOk(), dia: k4 }, valores: { actualizado: ahora }, mol: { id: String(op.id), v: mv } };
    }
    case 'extra': {
      if (!op.uid) throw new Error('Falta uid');
      var min = L_int(op.minutos), km = L_num(op.km);
      if (min < 1 || min > 600) throw new Error('Minutos no válidos');
      if (km !== '' && (km <= 0 || km > 200)) throw new Error('Km no válidos');
      var es = op.sens ? L_int(op.sens) : '';
      return { tabla: 'Extra', clave: { uid: txt(op.uid, 40) },
               valores: { fecha: txt(op.fecha, 10), semana: semOk(), tipo: txt(op.tipo, 40) || 'Otro', minutos: min, km: km,
                          ritmo: L_ritmo(min, km), sensacion: es, nota: txt(op.nota, 500) } };
    }
    case 'tiempos': {
      // Tiempos de la sesión (ms desde 1970). null = borrar (al desmarcar el día). Solo para Alex.
      var kti = dia(), ms = ahora.getTime(), vt = { actualizado: ahora };
      var tm = function (x, campo) {
        if (x === undefined || x === '') return undefined;
        if (x === null) return null;
        var n = Number(x);
        if (!isFinite(n) || n < ms - 10 * 864e5 || n > ms + 15 * 6e4) throw new Error('Hora no válida: ' + campo);
        return n;
      };
      var ini = tm(op.ini, 'inicio'), fca = tm(op.fcal, 'fin_calentamiento'), ffi = tm(op.fin, 'fin');
      if (ini && fca && fca < ini) fca = ini;
      if (ini && ffi && ffi < ini) throw new Error('Fin antes del inicio');
      if (ini && ffi && ffi - ini > 6 * 36e5) throw new Error('Sesión demasiado larga');
      if (ini !== undefined) vt.inicio = ini ? new Date(ini) : '';
      if (fca !== undefined) vt.fin_calentamiento = fca ? new Date(fca) : '';
      if (ffi !== undefined) vt.fin = ffi ? new Date(ffi) : '';
      if (ini && fca) vt.min_calentamiento = Math.round((fca - ini) / 6e4);
      else if (ini === null || fca === null) vt.min_calentamiento = '';
      if (ffi === null) vt.min_entreno = '';
      else if (ffi && (fca || ini)) vt.min_entreno = Math.round((ffi - (fca || ini)) / 6e4);
      return { tabla: 'Días', clave: { semana: semOk(), dia: kti }, valores: vt };
    }
    case 'video': {
      // «Ya lo he grabado»: se apunta en la maestra › Vídeos pedidos › grabado (fecha), en la fila activa del ejercicio
      var idv = String(op.id || '');
      var todos = Object.keys(plan).reduce(function (a, x) { return a.concat(plan[x]); }, []);
      if (todos.indexOf(idv) < 0) throw new Error('Ejercicio no válido');
      var fv = op.hecho ? (/^\d{4}-\d{2}-\d{2}$/.test(String(op.fecha)) ? String(op.fecha) : Utilities.formatDate(ahora, TZ, 'yyyy-MM-dd')) : '';   // la fecha la manda el móvil (su día)
      return { video: { id: idv, grabado: fv } };
    }
    case 'peso': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(op.fecha))) throw new Error('Fecha no válida');
      var pk = op.peso === '' || op.peso === null || op.peso === undefined ? '' : L_num(op.peso);
      if (pk !== '' && (pk < 25 || pk > 300)) throw new Error('Peso no válido');
      var rg = ['antes', 'con'].indexOf(String(op.regla || '')) >= 0 ? String(op.regla) : '';   // regla: antes (la semana antes) · con (la tiene)
      return { tabla: 'Peso', clave: { fecha: String(op.fecha) }, valores: { peso: pk, regla: rg, actualizado: ahora } };
    }
    case 'medidas': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(op.fecha))) throw new Error('Fecha no válida');
      var vm = { actualizado: ahora };
      MEDIDAS.forEach(function (m) {
        if (op[m] === undefined) return;
        var x = op[m] === '' || op[m] === null ? '' : L_num(op[m]);
        if (x !== '' && (x < 10 || x > 250)) throw new Error('Medida no válida: ' + m);
        vm[m] = x;
      });
      if (op.nota !== undefined) vm.nota = txt(op.nota, 300);
      return { tabla: 'Medidas', clave: { fecha: String(op.fecha) }, valores: vm };
    }
    case 'pasos': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(op.fecha))) throw new Error('Fecha no válida');
      var ps = L_int(op.pasos); if (ps < 0 || ps > 100000) throw new Error('Pasos no válidos');
      return { tabla: 'Pasos', clave: { fecha: String(op.fecha) }, valores: { pasos: ps } };
    }
    case 'ajustes': {
      var out = [];
      if (op.paleta !== undefined) {
        if (['marca', 'salvia', 'rosa', 'noche', 'oceano', 'mar'].indexOf(op.paleta) < 0) throw new Error('Paleta no válida');
        out.push({ tabla: 'Ajustes', clave: { clave: 'paleta' }, valores: { valor: op.paleta } });
      }
      if (op.crono !== undefined) out.push({ tabla: 'Ajustes', clave: { clave: 'crono' }, valores: { valor: !!op.crono } });
      return out;
    }
  }
  throw new Error('Operación desconocida: ' + op.fn);
}

/** Ritmo en min/km, p. ej. "6:05 min/km" */
function L_ritmo(min, km) {
  if (!km || !min) return '';
  var s = Math.round(min * 60 / km);
  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) + ' min/km';
}

/** Resumen de una semana para la pestaña Historial */
function L_resumenSemana(dias, extra, semana, hoy, entreno, objetivo) {
  entreno = entreno || DIAS_ENTRENO;
  var d = L_indiceDias(dias)[semana] || {};
  var flojos = entreno.filter(function (k) { return d[k] && d[k].hecho && d[k].flojo; }).length;
  return {
    semana: semana, dias_hechos: L_diasHechos(d, entreno, objetivo), flojos: flojos,
    sin_tiempo: d.st && d.st.hecho ? 1 : 0,
    extras: extra.filter(function (x) { return L_int(x.semana) === semana; }).length,
    cerrado_el: hoy
  };
}

/** Semana que toca por calendario (lunes = cambio). Antes del inicio, 1. */
function L_semanaPorFecha(inicio, hoy) {
  if (!inicio) return 0;
  var d = L_diasEntre(inicio, hoy);
  return d < 0 ? 1 : Math.floor(d / 7) + 1;
}

// ═════════════════════════ 2. DATOS ═════════════════════════

function D_hoy() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

/** Fecha de la hoja → 'yyyy-MM-dd'. Una fecha sin hora (medianoche en la zona de la hoja) se lee en la zona de la hoja,
 *  para que «2026-10-26» siga siendo el 26 aunque la hoja no esté en hora de España; con hora, en hora de España. */
function D_valor(v, tz, zona) {
  if (!(v instanceof Date)) return v;
  if (tz && Utilities.formatDate(v, tz, 'HH:mm:ss') === '00:00:00') return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  return Utilities.formatDate(v, zona || TZ, 'yyyy-MM-dd');   // con hora (un momento real): el día en la zona de la clienta
}
/** Zona horaria válida (IANA) o '' */
function D_zonaOk(z) {
  z = String(z || '').trim();
  if (!z || z.length > 60 || !/^[A-Za-z_]+(\/[A-Za-z0-9_+\-]+){0,2}$/.test(z)) return '';
  try {
    // Una zona desconocida no da error: se queda en GMT. Se acepta si en enero o en julio no es +0000, o si es de verdad de GMT
    var en = Utilities.formatDate(new Date(Date.UTC(2026, 0, 15)), z, 'Z'), ju = Utilities.formatDate(new Date(Date.UTC(2026, 6, 15)), z, 'Z');
    if (en !== '+0000' || ju !== '+0000') return z;
    return /^(UTC|GMT|Etc\/(UTC|GMT)|Atlantic\/Reykjavik|Africa\/(Abidjan|Accra|Dakar|Bamako|Conakry|Freetown|Lome|Monrovia|Nouakchott|Ouagadougou|Banjul|Bissau))$/.test(z) ? z : '';
  } catch (e) { return ''; }
}
/** Hoy en una zona */
function D_hoyEn(zona) { return Utilities.formatDate(new Date(), zona || TZ, 'yyyy-MM-dd'); }
/**
 * Cambio de semana (decidido por Alex el 24/10): para todas a la vez, el lunes a las 05:00 de Lombok (domingo 22:00 de España
 * en invierno, 23:00 en verano). Esta fecha es la que decide qué semana del programa toca; el «hoy» de cada clienta y las
 * fechas que se guardan van en su zona (la del móvil).
 */
var ZONA_SEMANA = 'Asia/Makassar', HORA_SEMANA = 5;
function D_diaSemanal() { return Utilities.formatDate(new Date(Date.now() - HORA_SEMANA * 36e5), ZONA_SEMANA, 'yyyy-MM-dd'); }

/** Pestañas que la app crea sola la primera vez que hacen falta */
var TABLAS_AUTO = {
  'Peso': ['fecha', 'peso', 'regla', 'actualizado'],
  'Molestias': ['fecha', 'zona', 'valor', 'desde', 'texto', 'uid', 'actualizado'],
  'Medidas': ['fecha', 'cintura', 'cadera', 'pecho', 'muslo', 'brazo', 'nota', 'actualizado'],
  'Fotos': ['fecha', 'tipo', 'archivo_id', 'mini', 'actualizado']
};
function D_crearSiFalta(ss, nombre) {
  if (ss.getSheetByName(nombre) || !TABLAS_AUTO[nombre]) return ss;
  var sh = ss.insertSheet(nombre);
  sh.getRange(1, 1, 1, TABLAS_AUTO[nombre].length).setValues([TABLAS_AUTO[nombre]]);
  sh.setFrozenRows(1);
  return ss;
}
function D_tabla(ss, nombre) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) throw new Error('Falta la pestaña «' + nombre + '»');
  var v = sh.getDataRange().getValues();
  var cab = (v[0] || []).map(function (c) { return String(c).trim(); });
  var tz = ''; try { tz = ss.getSpreadsheetTimeZone(); } catch (e) {}
  return { sh: sh, cab: cab, filas: v.slice(1), tz: tz };
}

function D_objetos(t, zona) {
  return t.filas.filter(function (f) { return f.some(function (c) { return c !== ''; }); }).map(function (f) {
    var o = {}; t.cab.forEach(function (c, i) { if (c) o[c] = D_valor(f[i], t.tz, zona); }); return o;
  });
}

function D_leer(ss, nombre, zona) { return D_objetos(D_tabla(ss, nombre), zona); }
/** Pestaña opcional: si no existe, lista vacía */
function D_leerOpc(ss, nombre, zona) { return ss.getSheetByName(nombre) ? D_leer(ss, nombre, zona) : []; }

/** Columnas nuevas que la app puede crear sola al final de la pestaña si aún no existen */
var COLS_AUTO = ['inicio', 'fin_calentamiento', 'fin', 'min_calentamiento', 'min_entreno', 'grabado', 'sobrado', 'molestia_detalle', 'molestia_fin', 'regla', 'desde'];
function D_asegurarCols(t, nombres) {
  nombres.forEach(function (c) {
    if (t.cab.indexOf(c) >= 0 || COLS_AUTO.indexOf(c) < 0) return;
    t.sh.getRange(1, t.cab.length + 1).setValue(c);
    t.cab.push(c);
  });
  t.filas.forEach(function (f) { while (f.length < t.cab.length) f.push(''); });
}

/** Actualiza la fila que coincide con la clave (solo los campos dados) o la añade al final */
function D_upsert(t, clave, valores) {
  D_asegurarCols(t, Object.keys(valores));
  var cols = Object.keys(clave).map(function (c) { return t.cab.indexOf(c); });
  if (cols.some(function (i) { return i < 0; })) throw new Error('Columnas de clave no encontradas en ' + t.sh.getName());
  var claves = Object.keys(clave);
  var fila = -1;
  for (var i = 0; i < t.filas.length; i++) {
    var ok = true;
    for (var c = 0; c < claves.length; c++) {
      if (String(D_valor(t.filas[i][cols[c]], t.tz)) !== String(clave[claves[c]])) { ok = false; break; }
    }
    if (ok) { fila = i; break; }
  }
  var todo = Object.assign({}, clave, valores);
  if (fila < 0) {
    var nueva = t.cab.map(function (c) { return todo.hasOwnProperty(c) ? todo[c] : ''; });
    t.sh.appendRow(nueva); t.filas.push(nueva);
    return nueva;
  }
  Object.keys(valores).forEach(function (c) { var i = t.cab.indexOf(c); if (i >= 0) t.filas[fila][i] = valores[c]; });
  t.sh.getRange(fila + 2, 1, 1, t.cab.length).setValues([t.filas[fila]]);
  return t.filas[fila];
}

function D_cache() { return CacheService.getScriptCache(); }

/** Fila de la clienta en «Registro clientes», o null si no existe o no está activa */
function D_cliente(codigo) {
  var c = D_cache(), k = 'cli_' + codigo, h = c.get(k);
  if (h) return h === 'x' ? null : JSON.parse(h);
  var m = SpreadsheetApp.openById(MAESTRA_ID);
  var fila = D_leer(m, 'Registro clientes').filter(function (r) { return String(r.codigo).trim() === codigo; })[0];
  var cli = fila && L_bool(fila.activa) && fila.hoja_datos_id && fila.hoja_datos_id !== 'PENDIENTE'
    ? { codigo: codigo, nombre: String(fila.nombre), hoja: String(fila.hoja_datos_id).trim(), paleta: String(fila.paleta || '') } : null;
  c.put(k, cli ? JSON.stringify(cli) : 'x', CACHE_CLIENTE_S);
  return cli;
}

function D_conBloqueo(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function D_planIds(ss) {
  return L_planIds(D_leer(ss, 'Días plan'), D_leer(ss, 'Plan'));
}
/** { díaReal: [ids] } uniendo sus plantillas (sirve para validar semanas pares e impares) */
function L_planIds(diasplan, planFilas) {
  var porClave = {}, plan = {};
  planFilas.forEach(function (p) { (porClave[String(p.dia)] = porClave[String(p.dia)] || []).push(String(p.ejercicio_id)); });
  diasplan.forEach(function (d) {
    var k = String(d.dia || ''); if (!k) return;
    var ids = [];
    [k, String(d.plantilla_impar || '').trim(), String(d.plantilla_par || '').trim()].forEach(function (c) {
      (porClave[c] || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    });
    plan[k] = ids;
  });
  return plan;
}

// ═════════════════════════ 3. SERVICIO ═════════════════════════

/** Marca (o desmarca) como grabado el vídeo pedido activo de ese ejercicio para esa clienta */
function D_marcarVideo(t, codigo, v, ahora) {
  D_asegurarCols(t, ['grabado']);
  var hoy = /^\d{4}-\d{2}-\d{2}$/.test(String(v.grabado)) ? String(v.grabado) : Utilities.formatDate(ahora, TZ, 'yyyy-MM-dd');   // su día (lo manda el móvil)
  var ic = t.cab.indexOf('codigo'), ie = t.cab.indexOf('ejercicio_id'), id = t.cab.indexOf('desde'), ih = t.cab.indexOf('hasta'), ig = t.cab.indexOf('grabado');
  var n = 0;
  t.filas.forEach(function (f, i) {
    if (String(f[ic]) !== codigo || String(f[ie]) !== v.id) return;
    var de = id >= 0 ? String(D_valor(f[id], t.tz) || '') : '', ha = ih >= 0 ? String(D_valor(f[ih], t.tz) || '') : '';
    if ((de && de > hoy) || (ha && ha < hoy)) return;
    f[ig] = v.grabado; t.sh.getRange(i + 2, ig + 1).setValue(v.grabado); n++;
  });
  if (!n) throw new Error('No hay vídeo pedido activo para ' + v.id);
}

/**
 * Zonas horarias (Alex, 24/10): la zona de cada clienta la detecta la app sola (la del móvil, en cada llamada; se apunta en
 * Ajustes › zona_movil). Con ella van «hoy» y las fechas que se guardan (su día de verdad). El cambio de semana es el mismo
 * para todas: el lunes a las 05:00 de Lombok (D_diaSemanal). Un entreno empezado antes del cambio sigue en su semana.
 */
function S_zona(cli, aj) { return D_zonaOk(cli && cli.zona) || D_zonaOk(aj && aj.zona_movil) || D_zonaOk(aj && aj.zona) || TZ; }   // la del móvil (sola)

function S_cargar(cli) {
  var ss = SpreadsheetApp.openById(cli.hoja);
  var filasAj = D_leer(ss, 'Ajustes'), aj0 = L_ajustes(filasAj), zona = S_zona(cli, aj0), hoy = D_hoyEn(zona);
  // Si en su zona ya es la semana siguiente y el cambio de semana aún no ha pasado por su hoja, se hace ahora (con su Historial)
  var Shoy = aj0.fecha_inicio_semana1 ? L_semanaPrograma(aj0, D_diaSemanal()) : 0;
  if (Shoy > aj0.semana) {
    try { D_conBloqueo(function () { D_ponerAlDia(ss, []); }); filasAj = D_leer(ss, 'Ajustes'); D_cacheFuera(cli.codigo); }
    catch (e) { console.error('ponerAlDia ' + cli.codigo + ': ' + e); filasAj = filasAj.filter(function (f) { return String(f.clave) !== 'semana'; }).concat([{ clave: 'semana', valor: Shoy }]); }
  }
  var c = D_cache(), k = 'dat_' + VERSION_DATOS + '_' + cli.codigo + '_' + hoy, h = c.get(k);
  if (h) return JSON.parse(h);
  var m = SpreadsheetApp.openById(MAESTRA_ID);
  var datos = L_construir({
    codigo: cli.codigo, hoy: hoy, paletaMaestra: cli.paleta,
    ajustes: filasAj, plan: D_leer(ss, 'Plan'), cal: D_leer(ss, 'Calentamiento'),
    fin: D_leer(ss, 'Finisher'), finej: D_leer(ss, 'Finisher ejercicios'), diasplan: D_leer(ss, 'Días plan'),
    registro: D_leer(ss, 'Registro', zona), dias: D_leer(ss, 'Días', zona), extra: D_leer(ss, 'Extra', zona), pasos: D_leer(ss, 'Pasos', zona),
    historial: D_leer(ss, 'Historial', zona), notas: D_leer(m, 'Semana de Alex'), videos: D_leer(m, 'Vídeos pedidos'),
    bloques: D_leerOpc(ss, 'Bloques'), progresion: D_leerOpc(ss, 'Progresión'), recordatorios: D_leerOpc(ss, 'Recordatorios'), agenda: D_leerOpc(ss, 'Agenda'),
    correcciones: D_leerOpc(ss, 'Correcciones'),
    peso: D_leerOpc(ss, 'Peso', zona), medidas: D_leerOpc(ss, 'Medidas', zona), fotos: D_leerOpc(ss, 'Fotos', zona), molestias: D_leerOpc(ss, 'Molestias', zona)
  });
  datos.zona = zona;
  try { c.put(k, JSON.stringify(datos), CACHE_DATOS_S); } catch (e) { /* respuesta > 100 KB: sin caché */ }
  return datos;
}
/** Borra los datos guardados en caché de una clienta (la clave lleva su «hoy»: se borran ayer, hoy y mañana para cubrir cualquier zona) */
function D_cacheFuera(codigo) {
  var b = D_hoy(), ks = [-1, 0, 1].map(function (d) { return 'dat_' + VERSION_DATOS + '_' + codigo + '_' + L_sumarDias(b, d); });
  try { D_cache().removeAll(ks); } catch (e) {}
}
/**
 * Pone al día la semana de una clienta (sin bloqueo: lo pone quien llama). En su zona:
 *  · si ya toca una semana nueva, cierra en «Historial» las que faltan y pasa Ajustes › semana;
 *  · rehace el resumen de las semanas ya cerradas que se pidan (apuntes que llegan tarde: sin conexión, o el entreno del
 *    domingo que se marca después de las 00:00) y, los 2 primeros días de la semana, el de la semana anterior.
 * Devuelve la semana actual.
 */
function D_ponerAlDia(ss, rehacer) {
  var tAj = D_tabla(ss, 'Ajustes'), aj = L_ajustes(D_objetos(tAj));
  var zona = D_zonaOk(aj.zona_movil) || D_zonaOk(aj.zona) || TZ, hoy = D_hoyEn(zona), dsem = D_diaSemanal();
  var objetivo = aj.fecha_inicio_semana1 ? L_semanaPrograma(aj, dsem) : aj.semana;
  var nueva = Math.max(aj.semana, objetivo);
  var lunes = aj.fecha_inicio_semana1 ? L_lunesPrograma(aj, nueva) : '';
  var w = {};
  for (var x = aj.semana; x < nueva && x < aj.semana + 8; x++) w[x] = 'cerrar';
  (rehacer || []).forEach(function (r) { r = L_int(r); if (r >= 1 && r < nueva && !w[r]) w[r] = 'rehacer'; });
  if (lunes && L_diasEntre(lunes, dsem) <= 1 && nueva > 1 && !w[nueva - 1]) w[nueva - 1] = 'rehacer';
  var ws = Object.keys(w).map(Number).sort(function (a, b) { return a - b; });
  if (ws.length) {
    var tHist = D_tabla(ss, 'Historial');
    var cerradas = D_objetos(tHist).map(function (h) { return L_int(h.semana); });
    var dias = D_leer(ss, 'Días', zona), extra = D_leer(ss, 'Extra', zona);
    var dp = D_leer(ss, 'Días plan'), bloques = D_leerOpc(ss, 'Bloques');
    ws.forEach(function (sem) {
      if (w[sem] === 'rehacer' && cerradas.indexOf(sem) < 0) return;   // solo se rehace lo que ya estaba cerrado
      // Los días y el objetivo de esa semana (si en el bloque 2 cambian, no se mezclan)
      var ajW = L_aplicarBloque(L_ajustes(D_objetos(tAj)), bloques, sem);
      var entreno = L_diasEntreno(L_filtrarSemana(dp, sem)), obj = L_objetivo(ajW, entreno);
      D_upsert(tHist, { semana: sem }, L_resumenSemana(dias, extra, sem, hoy, entreno, obj));
    });
  }
  if (nueva !== aj.semana) D_upsert(tAj, { clave: 'semana' }, { valor: nueva });
  return nueva;
}

/** Aplica una lista de operaciones del front. Todas o las válidas: devuelve cuáles fallaron. */
function S_ops(cli, ops) {
  if (!Array.isArray(ops)) throw new Error('ops debe ser una lista');
  if (ops.length > 200) throw new Error('Demasiadas operaciones de una vez');
  return D_conBloqueo(function () {
    var ss = SpreadsheetApp.openById(cli.hoja);
    var plan = D_planIds(ss), ahora = new Date();
    var tablas = {}, hechas = 0, errores = [];
    var tabla = function (n) { return tablas[n] || (tablas[n] = D_tabla(D_crearSiFalta(ss, n), n)); };
    var tm_ = null, maestra = function () { return tm_ || (tm_ = D_tabla(SpreadsheetApp.openById(MAESTRA_ID), 'Vídeos pedidos')); };
    ops.forEach(function (op, i) {
      try {
        var cambios = L_normalizarOp(op, plan, ahora);
        (Array.isArray(cambios) ? cambios : [cambios]).forEach(function (cb) {
          if (cb.video) { D_marcarVideo(maestra(), cli.codigo, cb.video, ahora); return; }
          var t = tabla(cb.tabla);
          if (cb.molnota) {
            var fn = D_upsert(t, cb.clave, cb.valores), idn = t.cab.indexOf('molestia_detalle');
            var det = L_json(idn >= 0 ? fn[idn] : ''); det[cb.molnota.id] = cb.molnota.t; if (!cb.molnota.t) delete det[cb.molnota.id];
            D_upsert(t, cb.clave, { molestia_detalle: JSON.stringify(det) });
          } else if (cb.mol) {
            var fila = D_upsert(t, cb.clave, cb.valores);
            var im = t.cab.indexOf('molestia');
            var v = {}; v.molestia = L_escribirMol(fila[im], cb.mol.id, cb.mol.v);
            D_upsert(t, cb.clave, v);
          } else {
            D_upsert(t, cb.clave, cb.valores);
          }
        });
        hechas++;
      } catch (e) { errores.push({ i: i, error: String(e.message || e) }); }
    });
    // Apuntes de una semana ya cerrada (llegan tarde): se rehace su resumen en Historial. Y la zona del móvil, aparte.
    try {
      var tAj = D_tabla(ss, 'Ajustes'), aj = L_ajustes(D_objetos(tAj)), viejas = [];
      ops.forEach(function (op) { var w = L_int(op && op.semana); if (w && w < aj.semana && viejas.indexOf(w) < 0) viejas.push(w); });
      if (viejas.length) D_ponerAlDia(ss, viejas);
      if (D_zonaOk(cli.zona) && cli.zona !== aj.zona_movil) D_upsert(D_tabla(ss, 'Ajustes'), { clave: 'zona_movil' }, { valor: cli.zona });
    } catch (e) { console.error('ponerAlDia ops ' + cli.codigo + ': ' + e); }
    D_cacheFuera(cli.codigo);
    if (errores.length) { try { D_avisarRechazos(cli, ops, errores, ahora); } catch (x) {} }
    var recargar = errores.some(function (e) { return /no válido: |Ejercicio no válido|Día no válido/.test(e.error); });
    return { hechas: hechas, errores: errores, recargar: recargar };
  });
}

/**
 * Lo que la app no ha podido guardar (p. ej. una serie de un ejercicio que Alex acaba de quitar del plan)
 * se apunta en la maestra › «Avisos app» para que salga en el resumen del día. Se crea sola.
 */
function D_avisarRechazos(cli, ops, errores, ahora) {
  var m = SpreadsheetApp.openById(MAESTRA_ID), sh = m.getSheetByName('Avisos app');
  if (!sh) { sh = m.insertSheet('Avisos app'); sh.appendRow(['fecha', 'codigo', 'que', 'semana', 'dia', 'ejercicio_id', 'error', 'visto']); sh.setFrozenRows(1); }
  var filas = errores.slice(0, 20).map(function (e) {
    var op = ops[e.i] || {};
    return [ahora, cli.codigo, String(op.fn || ''), op.semana || '', op.k || '', op.id || '', e.error, ''];
  });
  sh.getRange(sh.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
}

/** Sube una foto de progreso a la carpeta del cliente (Ajustes › carpeta_fotos; si no hay, la crea) y guarda la miniatura */
function S_subirFoto(cli, d) {
  var fecha = String(d.fecha || ''), tipo = String(d.tipo || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha no válida');
  if (['frente', 'lado', 'espalda'].indexOf(tipo) < 0) throw new Error('Tipo no válido');
  var img = String(d.img || ''), mini = String(d.mini || '');
  if (!/^[A-Za-z0-9+\/=]+$/.test(img) || img.length > 3000000) throw new Error('Imagen no válida');
  if (!/^[A-Za-z0-9+\/=]*$/.test(mini) || mini.length > 45000) throw new Error('Miniatura no válida');
  return D_conBloqueo(function () {
    var ss = SpreadsheetApp.openById(cli.hoja);
    var aj = {}; D_leer(ss, 'Ajustes').forEach(function (f) { if (f.clave) aj[String(f.clave)] = f.valor; });
    var carpeta = null, id = String(aj.carpeta_fotos || '').trim();
    if (id) { try { carpeta = DriveApp.getFolderById(id); } catch (e) { carpeta = null; } }
    if (!carpeta) {
      carpeta = DriveApp.createFolder('Fotos de progreso (app) · ' + (aj.nombre || cli.codigo));
      D_upsert(D_tabla(ss, 'Ajustes'), { clave: 'carpeta_fotos' }, { valor: carpeta.getId() });
    }
    var blob = Utilities.newBlob(Utilities.base64Decode(img), 'image/jpeg', fecha + ' ' + tipo + '.jpg');
    var archivo = carpeta.createFile(blob);
    var t = D_tabla(D_crearSiFalta(ss, 'Fotos'), 'Fotos');
    D_upsert(t, { fecha: fecha, tipo: tipo }, { archivo_id: archivo.getId(), mini: mini, actualizado: new Date() });
    D_cacheFuera(cli.codigo);
    return { ok: true };
  });
}
function S_fotos(cli) {
  var ss = SpreadsheetApp.openById(cli.hoja);
  return D_leerOpc(ss, 'Fotos').filter(function (r) { return r.archivo_id && r.mini; })
    .map(function (r) { return { f: String(r.fecha).slice(0, 10), t: String(r.tipo), m: String(r.mini) }; })
    .sort(function (a, b) { return a.f < b.f ? -1 : 1; }).slice(-30);
}

function despachar_(accion, codigo, datos, zona) {
  try {
    codigo = String(codigo || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,24}$/.test(codigo)) throw new Error('Código no válido');
    var cli = D_cliente(codigo);
    if (!cli) throw new Error('Este enlace no está activo');
    cli = Object.assign({}, cli, { zona: D_zonaOk(zona) });
    datos = datos || {};
    var r;
    switch (accion) {
      case 'cargar': r = S_cargar(cli); break;
      case 'sincronizar': r = S_ops(cli, datos.ops); break;
      case 'guardarSerie': r = S_ops(cli, [Object.assign({ fn: 'serie' }, datos)]); break;
      case 'marcarSerieHecha': r = S_ops(cli, [Object.assign({ fn: 'serie' }, datos)]); break;
      case 'marcarDia': r = S_ops(cli, [Object.assign({ fn: 'dia' }, datos)]); break;
      case 'guardarCierre': r = S_ops(cli, [Object.assign({ fn: 'cierre' }, datos)]); break;
      case 'guardarMolestia': r = S_ops(cli, [Object.assign({ fn: 'mol' }, datos)]); break;
      case 'guardarExtra': r = S_ops(cli, [Object.assign({ fn: 'extra' }, datos)]); break;
      case 'guardarPasos': r = S_ops(cli, [Object.assign({ fn: 'pasos' }, datos)]); break;
      case 'guardarAjustes': r = S_ops(cli, [Object.assign({ fn: 'ajustes' }, datos)]); break;
      case 'guardarTest': r = S_ops(cli, [Object.assign({ fn: 'test' }, datos)]); break;
      case 'guardarEnergia': r = S_ops(cli, [Object.assign({ fn: 'energia' }, datos)]); break;
      case 'guardarTiempos': r = S_ops(cli, [Object.assign({ fn: 'tiempos' }, datos)]); break;
      case 'guardarVideo': r = S_ops(cli, [Object.assign({ fn: 'video' }, datos)]); break;
      case 'subirFoto': r = S_subirFoto(cli, datos); break;
      case 'nutricion': r = S_nutricion(cli); break;
      case 'fotos': r = S_fotos(cli); break;
      case 'pushAlta': r = X_alta(cli, datos); break;
      case 'avisoPush': r = X_aviso(cli); break;
      default: throw new Error('Acción desconocida: ' + accion);
    }
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

// ═════════════════════════ 4. TRANSPORTE ═════════════════════════

/** Icono AA de la app (Drive público, carpeta de imágenes). */
var ICONO_URL = 'https://lh3.googleusercontent.com/d/1DEyXplqYKwxxBbkqLSsGsav_iMDs9ywd';

/** Página: …/exec?c=CODIGO&v=vista (vista opcional: home, week, d1, d2, d3, st, extra) */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var codigo = String(p.c || '').trim().toUpperCase();
  var vista = /^(home|week|extra|d[1-9]|st)$/.test(String(p.v || '')) ? String(p.v) : 'home';
  if (!/^[A-Z0-9-]{4,24}$/.test(codigo) || !D_cliente(codigo)) {
    return HtmlService.createHtmlOutput(
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<div style="font-family:Georgia,serif;max-width:420px;margin:60px auto;padding:0 16px;color:#3B2F28;background:#F6F1EA">' +
      '<h2 style="font-weight:400">Este enlace no está activo</h2><p>Escríbele a Alex y te pasa el tuyo.</p></div>')
      .setTitle('Alex Aranda');
  }
  var t = HtmlService.createTemplateFromFile('Index');
  t.codigoJson = JSON.stringify(codigo);
  t.vistaJson = JSON.stringify(vista);
  var out = t.evaluate().setTitle('Alex Aranda');
  return out
    .addMetaTag('apple-mobile-web-app-title', 'Alex Aranda')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** Entrada única para google.script.run: api(accion, codigo, datos) → { ok, data | error } */
function api(accion, codigo, datos) { return despachar_(accion, codigo, datos); }

/** Entrada JSON para el futuro front en su propio dominio.
 *  POST con cuerpo { "accion": "cargar", "codigo": "SOLE-…", "datos": {…} }
 *  (enviar como text/plain para evitar la petición previa CORS). */
function doPost(e) {
  var cuerpo = {};
  try { cuerpo = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) {
    return json_({ ok: false, error: 'JSON no válido' });
  }
  if (cuerpo.push) return json_(X_despachar(cuerpo));                                   // avisos al móvil (los pide el Worker cada 15 min)
  if (cuerpo.panel) return json_(typeof P_despachar === 'function' ? P_despachar(cuerpo) : { ok: false, error: 'Falta Panel.gs' });   // panel de Alex
  return json_(despachar_(cuerpo.accion, cuerpo.codigo, cuerpo.datos, cuerpo.zona));
}

/** Ejecutar UNA vez desde el editor (botón ▶) para dar permiso a Drive (fotos de progreso). */
/** PDF de su plan de alimentación (Ajustes › nutricion_pdf: id o enlace de Drive). Lo sirve el Worker en /nutricion sin compartir el archivo */
function S_nutricion(cli) {
  var aj = L_ajustes(D_leer(SpreadsheetApp.openById(cli.hoja), 'Ajustes'));
  var id = String(aj.nutricion_pdf || ''), m = id.match(/[-\w]{25,}/);
  if (!m) throw new Error('Todavía no tienes el plan de alimentación en la app');
  var f = DriveApp.getFileById(m[0]), b = f.getBlob();
  if (!/pdf/i.test(b.getContentType())) b = b.getAs('application/pdf');
  return { nombre: f.getName().replace(/\.pdf$/i, '') + '.pdf', b64: Utilities.base64Encode(b.getBytes()) };
}
function autorizar() { DriveApp.getRootFolder(); SpreadsheetApp.openById(MAESTRA_ID); return 'ok'; }

// ═════════════════════════ AVISOS AL MÓVIL (push) ═════════════════════════
// El Worker de Cloudflare pregunta cada 15 min qué avisos tocan (X_pendientes) y manda un «toque» al móvil.
// El móvil (sw.js) pide entonces el texto con la acción «avisoPush». Las suscripciones van en la maestra › «Avisos móvil».
var PUSH_KEY = '__PUSH_KEY__';
var PUSH_CAB = ['codigo', 'endpoint', 'zona', 'aviso_peso', 'aviso_entreno', 'alta', 'ultimo_titulo', 'ultimo_texto', 'ultimo_url', 'ultimo_en', 'envio_peso', 'envio_entreno'];
function X_tabla() {
  var m = SpreadsheetApp.openById(MAESTRA_ID), sh = m.getSheetByName('Avisos móvil');
  if (!sh) {
    sh = m.insertSheet('Avisos móvil'); sh.getRange(1, 1, 1, PUSH_CAB.length).setValues([PUSH_CAB]); sh.setFrozenRows(1);
    ['aviso_peso', 'envio_peso', 'envio_entreno'].forEach(function (c) { var j = PUSH_CAB.indexOf(c) + 1; sh.getRange(1, j, sh.getMaxRows(), 1).setNumberFormat('@'); });
  }
  return D_tabla(m, 'Avisos móvil');
}
function X_despachar(c) {
  try {
    if (!c || c.k !== PUSH_KEY || PUSH_KEY.indexOf('__') === 0) throw new Error('No autorizado');
    if (c.accion === 'pendientes') return { ok: true, data: X_pendientes() };
    if (c.accion === 'baja') return { ok: true, data: X_baja(c.endpoints || []) };
    throw new Error('Acción desconocida');
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
/** Alta o cambio de preferencias desde la app: { endpoint, zona, peso: '07:30' | 'no', entreno: true/false } */
function X_alta(cli, d) {
  var ep = String(d.endpoint || '');
  if (!/^https:\/\/[^\s]{10,800}$/.test(ep)) throw new Error('Suscripción no válida');
  var zona = String(d.zona || TZ); try { Utilities.formatDate(new Date(), zona, 'HH'); } catch (e) { zona = TZ; }
  var peso = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(d.peso)) ? String(d.peso) : 'no';
  return D_conBloqueo(function () {
    var t = X_tabla();
    D_upsert(t, { endpoint: ep }, { codigo: cli.codigo, zona: zona, aviso_peso: peso, aviso_entreno: d.entreno !== false, alta: new Date() });
    return { ok: true };
  });
}
/** Texto del último aviso de este cliente (lo pide el móvil al recibir el toque) */
function X_aviso(cli) {
  var t = X_tabla(), i = function (c) { return t.cab.indexOf(c); }, mejor = null;
  t.filas.forEach(function (f) {
    if (String(f[i('codigo')]) !== cli.codigo || !(f[i('ultimo_en')] instanceof Date)) return;
    if (!mejor || f[i('ultimo_en')] > mejor[i('ultimo_en')]) mejor = f;
  });
  if (!mejor || Date.now() - mejor[i('ultimo_en')].getTime() > 3 * 3600e3) return { titulo: 'Alex Aranda', texto: 'Tienes algo nuevo en tu app 💪', url: '/' };
  return { titulo: String(mejor[i('ultimo_titulo')]), texto: String(mejor[i('ultimo_texto')]), url: String(mejor[i('ultimo_url')] || '/') };
}
function X_baja(endpoints) {
  return D_conBloqueo(function () {
    var t = X_tabla(), ie = t.cab.indexOf('endpoint'), n = 0;
    for (var r = t.filas.length - 1; r >= 0; r--) if (endpoints.indexOf(String(t.filas[r][ie])) >= 0) { t.sh.deleteRow(r + 2); n++; }
    return { borradas: n };
  });
}
function X_crudo(ss, nombre) {   // filas con los valores tal cual (fechas como Date, con hora)
  var sh = ss.getSheetByName(nombre); if (!sh) return [];
  var v = sh.getDataRange().getValues(), cab = (v[0] || []).map(function (c) { return String(c).trim(); });
  return v.slice(1).map(function (f) { var o = {}; cab.forEach(function (c, j) { if (c) o[c] = f[j]; }); return o; });
}
/** Qué avisos tocan ahora. Devuelve { enviar: [endpoint, …] } y deja el texto guardado para X_aviso */
function X_pendientes() {
  return D_conBloqueo(function () {
    var t = X_tabla(), i = function (c) { return t.cab.indexOf(c); };
    if (!t.filas.length) return { enviar: [] };
    var clientes = {}; D_leer(SpreadsheetApp.openById(MAESTRA_ID), 'Registro clientes').forEach(function (c) { if (L_bool(c.activa)) clientes[String(c.codigo).trim()] = c; });
    var ahora = new Date(), datos = {}, enviar = [];
    var info = function (cod) {
      if (datos[cod] !== undefined) return datos[cod];
      var c = clientes[cod]; if (!c || !c.hoja_datos_id) return (datos[cod] = null);
      try {
        var ss = SpreadsheetApp.openById(String(c.hoja_datos_id).trim()), tz = ss.getSpreadsheetTimeZone();
        var aj = L_ajustes(D_leer(ss, 'Ajustes'));
        return (datos[cod] = { aj: aj, tz: tz, dias: X_crudo(ss, 'Días'), registro: X_crudo(ss, 'Registro'), peso: X_crudo(ss, 'Peso') });
      } catch (e) { return (datos[cod] = null); }
    };
    t.filas.forEach(function (f, r) {
      var cod = String(f[i('codigo')]), zona = String(f[i('zona')] || TZ), d = info(cod); if (!d) return;
      var hh = Utilities.formatDate(ahora, zona, 'HH:mm'), hoyL = Utilities.formatDate(ahora, zona, 'yyyy-MM-dd'), dow = Utilities.formatDate(ahora, zona, 'u');
      var cz = d.aj.sexo === 'h' ? '💪' : '💛', msg = null;
      // 1) Entreno abierto: empezó (inicio), sin fin ni hecho, 45 min sin apuntar nada. Solo de 8:00 a 22:00 de su hora; una vez por día de entreno
      if (L_bool(f[i('aviso_entreno')]) && hh >= '08:00' && hh < '22:00') {
        d.dias.forEach(function (x) {
          if (msg || L_int(x.semana) !== d.aj.semana || !(x.inicio instanceof Date) || x.fin instanceof Date || L_bool(x.hecho)) return;
          var ult = x.inicio.getTime();
          d.registro.forEach(function (rg) { if (L_int(rg.semana) === d.aj.semana && String(rg.dia) === String(x.dia) && rg.actualizado instanceof Date) ult = Math.max(ult, rg.actualizado.getTime()); });
          var quieto = ahora.getTime() - ult, marca = d.aj.semana + '|' + x.dia;
          if (quieto >= 45 * 6e4 && ahora.getTime() - x.inicio.getTime() < 12 * 3600e3 && String(f[i('envio_entreno')]) !== marca) {
            msg = { titulo: 'Te quedó el entreno abierto ' + cz, texto: (d.aj.nombre ? d.aj.nombre + ', s' : 'S') + 'i ya acabaste, entra y dale a «Marcar día hecho». Si no, sigue cuando puedas.', url: '/', campo: 'envio_entreno', valor: marca };
          }
        });
      }
      // 2) Pesarse: los miércoles (3) a la hora elegida, si aún no lo ha apuntado hoy y le toca esa semana. Una vez
      var tzm = ''; try { tzm = t.sh.getParent().getSpreadsheetTimeZone(); } catch (e) {}
      var hp = f[i('aviso_peso')] instanceof Date ? Utilities.formatDate(f[i('aviso_peso')], tzm || TZ, 'HH:mm') : String(f[i('aviso_peso')] || 'no');
      var ep = f[i('envio_peso')] instanceof Date ? Utilities.formatDate(f[i('envio_peso')], tzm || TZ, 'yyyy-MM-dd') : String(f[i('envio_peso')] || '');
      var enPausa = !!(d.aj.pausa_desde && d.aj.pausa_hasta && hoyL >= d.aj.pausa_desde && hoyL <= d.aj.pausa_hasta);   // en pausa, nada de avisos de peso
      var fq = d.aj.peso_frecuencia, semPeso = fq === 'semanal' || fq === 'libre' || (fq === 'quincenal' && (d.aj.semana - d.aj.peso_desde_semana) % 2 === 0);
      if (!msg && !enPausa && /^\d\d:\d\d$/.test(hp) && dow === '3' && semPeso && hh >= hp && hh < '12:00' && d.aj.semana >= d.aj.peso_desde_semana && ep !== 'd' + hoyL && ep !== hoyL) {
        var yaHoy = d.peso.some(function (p) { return String(D_valor(p.fecha, d.tz)) === hoyL && L_num(p.peso) !== ''; });
        if (!yaHoy) msg = { titulo: 'Hoy toca pesarse ⚖️', texto: 'Buenos días' + (d.aj.nombre ? ', ' + d.aj.nombre : '') + '. En ayunas, después del baño y antes de comer o beber. Lo apuntas en la app y listo ' + cz, url: '/?v=prog', campo: 'envio_peso', valor: 'd' + hoyL };
      }
      if (!msg) return;
      var fila = t.filas[r];
      fila[i('ultimo_titulo')] = msg.titulo; fila[i('ultimo_texto')] = msg.texto; fila[i('ultimo_url')] = msg.url; fila[i('ultimo_en')] = ahora;
      fila[i(msg.campo)] = msg.valor;
      t.sh.getRange(r + 2, 1, 1, t.cab.length).setValues([fila]);
      enviar.push(String(f[i('endpoint')]));
    });
    return { enviar: enviar };
  });
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Funciones sueltas (mismo contrato que api) por si se quieren llamar directamente.
function cargar(codigo) { return despachar_('cargar', codigo); }
function sincronizar(codigo, ops) { return despachar_('sincronizar', codigo, { ops: ops }); }
function guardarSerie(codigo, d) { return despachar_('guardarSerie', codigo, d); }
function marcarSerieHecha(codigo, d) { return despachar_('marcarSerieHecha', codigo, d); }
function marcarDia(codigo, d) { return despachar_('marcarDia', codigo, d); }
function guardarCierre(codigo, d) { return despachar_('guardarCierre', codigo, d); }
function guardarMolestia(codigo, d) { return despachar_('guardarMolestia', codigo, d); }
function guardarExtra(codigo, d) { return despachar_('guardarExtra', codigo, d); }
function guardarPasos(codigo, d) { return despachar_('guardarPasos', codigo, d); }
function guardarAjustes(codigo, d) { return despachar_('guardarAjustes', codigo, d); }

// ═════════════════════════ Tareas programadas ═════════════════════════

/**
 * Cambio de semana: el lunes a las 05:00 de Lombok para todas (D_diaSemanal). El activador corre cada hora (si uno falla,
 * el siguiente lo hace) y, además, la app lo hace al abrirse si aún no ha pasado. Cierra la semana en «Historial» y pasa a
 * la siguiente. No borra nada del Registro. Si un lunes se saltó, se pone al día. Rehace el resumen de semanas cerradas
 * cuando llegan apuntes tarde.
 */
function resetSemanal() {
  var m = SpreadsheetApp.openById(MAESTRA_ID);
  D_leer(m, 'Registro clientes').forEach(function (fila) {
    if (!L_bool(fila.activa) || !fila.hoja_datos_id || fila.hoja_datos_id === 'PENDIENTE') return;
    try {
      D_conBloqueo(function () {
        var ss = SpreadsheetApp.openById(String(fila.hoja_datos_id).trim());
        D_ponerAlDia(ss, []);
        D_cacheFuera(String(fila.codigo).trim());
      });
    } catch (e) { console.error('resetSemanal ' + fila.codigo + ': ' + e); }
  });
}

/* ═════════ Comprobación del plan (semana a semana) ═════════
 * L_revisarPlan(t) → lista de avisos. t = { plan, cal, fin, finej, diasplan, bloques, progresion, biblioteca }.
 * Mira de la semana 1 a la última que aparezca en alguna franja y agrupa las semanas de cada aviso («semanas 3-12»). */
function L_rangos(ws) {
  ws = ws.slice().sort(function (a, b) { return a - b; });
  var out = [], i = 0;
  while (i < ws.length) { var a = ws[i], b = a; while (i + 1 < ws.length && ws[i + 1] === b + 1) { i++; b = ws[i]; } out.push(a === b ? String(a) : a + '-' + b); i++; }
  return (ws.length > 1 ? 'semanas ' : 'semana ') + out.join(', ');
}
function L_revisarPlan(t) {
  var plan = t.plan || [], dp = t.diasplan || [], bloques = t.bloques || [];
  var todas = [].concat(plan, t.cal || [], t.fin || [], t.finej || [], dp, bloques, t.progresion || []);
  var W = 1;
  todas.forEach(function (r) { var f = L_franja(r); if (f.d > W) W = f.d; if (f.h && f.h < 900 && f.h > W) W = f.h; });
  var avisos = {}, add = function (txt, w) { (avisos[txt] = avisos[txt] || []).push(w); };
  for (var w = 1; w <= W; w++) {
    var dpw = L_filtrarSemana(dp, w), tpl = L_plantillas(dpw), vistosDia = {};
    dpw.forEach(function (d) { var k = String(d.dia || ''); if (!k) return; if (vistosDia[k]) add('Días plan: el día «' + k + '» sale dos veces', w); vistosDia[k] = 1; });
    var pw = L_filtrarSemana(plan, w);
    L_diasEntreno(dpw).forEach(function (k) {
      var clave = tpl(k, w), filas = pw.filter(function (p) { return String(p.dia) === k || String(p.dia) === clave; });
      if (!filas.length) { add('Día «' + k + '» sin ejercicios', w); return; }
      var porOrden = {}, porId = {}, porFam = {};
      filas.forEach(function (p) {
        var o = String(p.orden), id = String(p.ejercicio_id), fam = String(p.familia || '').trim();
        if (porOrden[o] && porOrden[o] !== id) add('Día «' + k + '»: dos ejercicios con el orden ' + o + ' (' + porOrden[o] + ' y ' + id + ')', w);
        porOrden[o] = porOrden[o] || id;
        if (porId[id]) add('Día «' + k + '»: «' + id + '» está repetido', w); porId[id] = 1;
        if (fam) { if (porFam[fam] && porFam[fam] !== id) add('Día «' + k + '»: dos variantes de la familia «' + fam + '» a la vez (' + porFam[fam] + ' y ' + id + '): las franjas se solapan', w); porFam[fam] = porFam[fam] || id; }
      });
    });
    if (bloques.length) {
      var bw = bloques.filter(function (b) { return L_franja(b).d && L_enFranja(b, w); });
      if (!bw.length) add('Bloques: ninguna fila cubre esta semana', w);
      if (bw.length > 1) add('Bloques: dos bloques a la vez (' + bw.map(function (b) { return b.bloque || '?'; }).join(' y ') + ')', w);
    }
  }
  var out = Object.keys(avisos).map(function (txt) { return L_rangos(avisos[txt]) + ': ' + txt; });
  var bib = {}; (t.biblioteca || []).forEach(function (b) { if (b.ejercicio_id) bib[String(b.ejercicio_id).trim()] = 1; });
  var vistos = {};
  plan.forEach(function (p) {
    var id = String(p.ejercicio_id || '').trim(); if (!id) { out.push('Plan: fila sin ejercicio_id (día ' + p.dia + ', orden ' + p.orden + ')'); return; }
    if (vistos[id]) return; vistos[id] = 1;
    if (t.biblioteca && !bib[id]) out.push('«' + id + '» no está en la Biblioteca');
    var conVideo = plan.some(function (q) { return String(q.ejercicio_id).trim() === id && L_youtubeId(q.video); });
    var conImg = plan.some(function (q) { return String(q.ejercicio_id).trim() === id && String(q.imagen_id || '').trim(); });
    if (!conVideo) out.push('«' + id + '» sin vídeo');
    if (!conImg) out.push('«' + id + '» sin imagen');
  });
  plan.forEach(function (p) { var f = L_franja(p); if (f.d && f.h && f.h < f.d) out.push('«' + p.ejercicio_id + '»: semana_hasta (' + f.h + ') antes que semana_desde (' + f.d + ')'); });
  return out.length ? out : ['Todo bien: semanas 1-' + W + ' revisadas, sin avisos.'];
}
/** Ejecutar desde el editor: revisa el plan de todos los clientes activos (o solo el código que pongas) y lo escribe en el registro. */
function revisarPlan(codigo) {
  var m = SpreadsheetApp.openById(MAESTRA_ID), bib = D_leer(m, 'Biblioteca');
  D_leer(m, 'Registro clientes').forEach(function (fila) {
    if (!L_bool(fila.activa) || !fila.hoja_datos_id || fila.hoja_datos_id === 'PENDIENTE') return;
    if (codigo && String(fila.codigo).trim() !== codigo) return;
    var ss = SpreadsheetApp.openById(String(fila.hoja_datos_id).trim());
    var res = L_revisarPlan({ plan: D_leer(ss, 'Plan'), cal: D_leer(ss, 'Calentamiento'), fin: D_leer(ss, 'Finisher'), finej: D_leer(ss, 'Finisher ejercicios'),
      diasplan: D_leer(ss, 'Días plan'), bloques: D_leerOpc(ss, 'Bloques'), progresion: D_leerOpc(ss, 'Progresión'), biblioteca: bib });
    console.log('── ' + fila.nombre + ' (' + fila.codigo + ')\n' + res.map(function (x) { return '· ' + x; }).join('\n'));
  });
}

/** Ejecutar UNA vez a mano desde el editor: activador cada hora del cambio de semana (lunes 05:00 de Lombok).
 *  Borra el activador antiguo (domingo 22:00 de España). */
function crearTriggerLunes() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'resetSemanal') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('resetSemanal').timeBased().everyHours(1).create();
}

// Para Node (pruebas locales). En Apps Script `module` no existe y esto no hace nada.
if (typeof module !== 'undefined') module.exports = { L_corrSuperadas: L_corrSuperadas, L_logros: L_logros, L_construir: L_construir, L_correcciones: L_correcciones, L_normalizarOp: L_normalizarOp, L_resumenSemana: L_resumenSemana, L_semanaPorFecha: L_semanaPorFecha, L_ritmo: L_ritmo, L_diasHechos: L_diasHechos, L_indiceDias: L_indiceDias, L_escribirMol: L_escribirMol, L_planIds: L_planIds, L_diasEntreno: L_diasEntreno, L_progresion: L_progresion, L_pauta: L_pauta, L_partirPeso: L_partirPeso, L_recordatorio: L_recordatorio, L_proximo: L_proximo, L_desdeInicio: L_desdeInicio, L_revisarPlan: L_revisarPlan, L_semanaPrograma: L_semanaPrograma, L_lunesPrograma: L_lunesPrograma, L_aplicarBloque: L_aplicarBloque, L_ajustes: L_ajustes };
