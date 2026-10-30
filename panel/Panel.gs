/**
 * Panel.gs · Panel privado de Alex (clientes, cobros y leads).
 *
 * Se pega como archivo nuevo en el mismo proyecto de Apps Script que Code.gs.
 * Entrada única: P_despachar(cuerpo) con cuerpo = {k, accion, datos}. Devuelve {ok, data} o {ok:false, error}.
 * Todo lo de aquí lleva el prefijo P_ / PANEL_ para no chocar con Code.gs (L_, D_, S_, X_, TZ, MAESTRA_ID…).
 *
 * Hoja de datos: «Panel Alex – datos» con pestañas Clientes, Leads y Cobros.
 * La primera fila de cada pestaña son los nombres de columna; la columna «id» va siempre la primera.
 * Las fechas se guardan como texto 'yyyy-MM-dd' (las columnas están en formato texto «@»).
 */

var PANEL_KEY = '__PANEL_KEY__';
var PANEL_HOJA_ID = '1SmU2r84U-k2lq5RR1R9f0BVamwIU4-mwtRd8uRVnZ48';
var P_ZONA = 'Europe/Madrid';
var P_TABLAS = {
  Clientes: { pref: 'c', cols: ['id', 'nombre', 'nombre_whatsapp', 'telefono', 'codigo_app', 'estado', 'programa', 'inicio', 'fin', 'precio_total', 'forma_pago', 'metodo', 'cuotas', 'importe_cuota', 'dia_cobro', 'semaforo', 'semaforo_nota', 'seguimiento', 'proxima_conversacion', 'conversacion_motivo', 'retomar_fecha', 'retomar_motivo', 'notas', 'actualizado', 'archivado', 'carpeta_fotos', 'vida'] },
  Leads: { pref: 'l', largo: true, cols: ['id', 'nombre', 'instagram', 'whatsapp', 'origen', 'temperatura', 'estado', 'preocupacion', 'ultima_fecha', 'ultima_resumen', 'siguiente_paso', 'proximo_contacto', 'notas', 'actualizado', 'archivado',
    'llamada', 'llamada_evento', 'llamada_estado', 'motivo_no', 'notas_llamada', 'cliente_id',
    'chat_ig', 'chuleta', 'guion', 'seguimiento_paso', 'seguimiento_msg'] },
  // Planes que se ofrecen en la llamada (los edita Alex desde el panel). cuotas = lista separada por comas: 1,2,3
  Planes: { pref: 'pl', cols: ['id', 'nombre', 'meses', 'precio', 'cuotas', 'activo', 'orden', 'notas', 'actualizado', 'archivado'] },
  // Altas creadas desde la llamada: Claude las monta en el siguiente chequeo (skill inicia-nuevo-cliente y chat del cliente)
  // Banco de frases para redes: respuestas de formularios que Alex guarda desde el panel (con permiso del cliente) y marca cuando las usa
  Redes: { pref: 'rd', largo: true, cols: ['id', 'guardado', 'cliente_id', 'cliente', 'clase', 'formulario', 'pregunta', 'texto', 'antes', 'fecha_antes', 'fecha', 'permiso', 'usada', 'notas', 'actualizado', 'archivado'] },
  // Recorte de cada foto para el carrusel (Alex 25/10): la original no se toca; z = zoom, x/y = encuadre (−1 a 1), cara = «ocultar cara», tipo = frente/lado/espalda
  FotosAjuste: { pref: 'fa', cols: ['id', 'foto_id', 'cliente_id', 'z', 'x', 'y', 'cara', 'tipo', 'luz', 'actualizado', 'archivado'] },
  // Tareas de Alex (las añaden los chats y Alex; una fila por tarea, nunca se reescribe la tabla entera)
  Tareas: { pref: 't', cols: ['id', 'tarea', 'cliente', 'cliente_id', 'prioridad', 'fecha', 'estado', 'origen', 'creada', 'hecha_el', 'notas', 'actualizado', 'archivado'] },
  // Lo que cada cliente tiene que entregar (formularios que no son el semanal, fotos, medidas, peso). Lo apunta la lectura de las 6:00;
  // el panel comprueba solo si ya está hecho (hoja de respuestas de formularios y hoja de su app)
  Entregas: { pref: 'e', cols: ['id', 'cliente_id', 'cliente', 'codigo_app', 'tipo', 'formulario', 'desde', 'estado', 'hecha_el', 'como', 'notas', 'actualizado', 'archivado'] },
  // Avisos de la app que Alex ya ha visto (id = clave del aviso)
  AvisosVistos: { pref: 'av', cols: ['id', 'codigo', 'tipo', 'fecha', 'actualizado', 'archivado'] },
  Altas: { pref: 'al', cols: ['id', 'fecha', 'cliente_id', 'cliente', 'lead_id', 'telefono', 'instagram', 'programa', 'inicio', 'resumen', 'estado', 'chat', 'resultado', 'formulario_enviado', 'paso', 'listo', 'bienvenida_enviada', 'actualizado', 'archivado'] },
  Cobros: { pref: 'p', cols: ['id', 'fecha', 'cliente_id', 'cliente', 'concepto', 'importe', 'estado', 'ultimo', 'metodo', 'notas', 'revisado', 'actualizado', 'archivado'] },
  // Ronda del lunes (y revisiones): una fila por cliente y ronda. La rellena Claude; Alex decide en el panel.
  Ronda: { pref: 'r', largo: true, cols: ['id', 'fecha', 'tipo', 'cliente_id', 'cliente', 'codigo_app', 'orden', 'semaforo', 'titular',
    'semana_personal', 'semana_entreno', 'datos', 'progreso', 'tener_en_cuenta', 'voz',
    'mensaje', 'mensaje_estado', 'mensaje_peticion', 'mensaje_versiones', 'cambios', 'nota_alex', 'nutricion', 'revisado', 'ejemplo', 'actualizado', 'archivado'] },
  // Registro de lo que se aplica desde el panel (para que Claude lo pase a los documentos del cliente)
  // Gastos del negocio (Alex 30/10). recurrente: vacío (una vez), mensual o anual, desde «fecha» hasta «hasta» (vacío = sigue)
  Gastos: { pref: 'g', cols: ['id', 'fecha', 'concepto', 'categoria', 'importe', 'recurrente', 'hasta', 'notas', 'actualizado', 'archivado'] },
  // Calendario de contenido (Alex 30/10). tipo: Reel o Historia; estado: Idea, Grabado, Programado, Publicado
  Contenido: { pref: 'ct', largo: true, cols: ['id', 'fecha', 'hora', 'tipo', 'titulo', 'guion', 'texto', 'enlace', 'estado', 'notas', 'actualizado', 'archivado'] },
  // Renovaciones (Alex 30/10): resultado renueva o no, para la tasa y la facturación
  Renovaciones: { pref: 'rn', cols: ['id', 'fecha', 'cliente_id', 'cliente', 'resultado', 'meses', 'precio', 'notas', 'actualizado', 'archivado'] },
  // Ajustes del panel (Alex 30/10): enlaces de los vídeos de las altas y lo que haga falta. id = clave
  Config: { pref: 'cf', cols: ['id', 'valor', 'actualizado', 'archivado'] },
  Aplicados: { pref: 'a', cols: ['id', 'fecha', 'cliente', 'codigo_app', 'ronda_id', 'cambio_id', 'tipo', 'detalle', 'resultado', 'pasado_a_docs', 'actualizado', 'archivado'] }
};

function P_despachar(cuerpo) {
  try {
    if (!cuerpo || cuerpo.k !== PANEL_KEY) return { ok: false, error: 'No autorizado' };
    var d = cuerpo.datos || {};
    switch (cuerpo.accion) {
      case 'cargar': return { ok: true, data: P_cargar() };
      case 'guardar': return { ok: true, data: P_escribir(function () { return P_guardar(d.tabla, d.id, d.campos || {}); }) };
      case 'nuevo': return { ok: true, data: P_escribir(function () { return P_nuevo(d.tabla, d.campos || {}); }) };
      case 'archivar': return { ok: true, data: P_escribir(function () { return P_guardar(d.tabla, d.id, { archivado: P_hoy() }); }) };
      case 'desarchivar': return { ok: true, data: P_escribir(function () { return P_guardar(d.tabla, d.id, { archivado: '' }); }) };
      case 'rondaCargar': return { ok: true, data: R_cargar(d.fecha, d.tipo) };
      case 'rondaFila': return { ok: true, data: R_fila(d.id) };
      case 'rondaPedir': return { ok: true, data: P_escribir(function () { return R_pedir(d); }) };
      case 'rondaAplicar': return { ok: true, data: P_escribir(function () { return R_aplicar(d.id, d.cid); }) };
      case 'rondaNuevoMensaje': return { ok: true, data: P_escribir(function () { return R_nuevoMensaje(d.id, d.texto, d.peticion, d.actual); }) };
      case 'rondaReemplazarCambio': return { ok: true, data: P_escribir(function () { return R_reemplazarCambio(d.id, d.cid, d.nuevo); }) };
      case 'rondaCambio': return { ok: true, data: P_escribir(function () { return R_estadoCambio(d.id, d.cid, d.estado, d.peticion); }) };
      case 'entregas': return { ok: true, data: EN_cargar() };
      case 'formularios': return { ok: true, data: FO_cliente(d.cliente_id, d.nombre) };
      case 'entrenoCliente': return { ok: true, data: EC_cliente(d.cliente_id) };
      case 'caminoCliente': return { ok: true, data: EV_cliente(d.cliente_id) };
      case 'calendarioCliente': return { ok: true, data: CA_cliente(d.cliente_id) };
      case 'appAcceso': P_escribir(function () { AC_cambiar(d.cliente_id, d.que); }); return { ok: true, data: CA_cliente(d.cliente_id, true) };
      case 'renovar': return { ok: true, data: P_escribir(function () { return RN_guardar(d); }) };
      case 'copiaAhora': return { ok: true, data: CO_copia() };
      case 'copiaProgramar': return { ok: true, data: CO_programar() };
      case 'nutriPdf': return { ok: true, data: P_escribir(function () { return AC_nutri(d.cliente_id, d.url); }) };
      case 'videosCargar': return { ok: true, data: CV_cargar() };
      case 'videosCliente': return { ok: true, data: CV_cliente(d.cliente_id) };
      case 'videosGuardar': return { ok: true, data: P_escribir(function () { return CV_guardar(d); }) };
      case 'fotos': return { ok: true, data: FT_lista(d.cliente_id) };
      case 'fotoArchivo': return { ok: true, data: FT_archivo(d.id) };
      case 'avisos': return { ok: true, data: AV_cargar(!!d.fresco) };
      case 'avisoVisto': return { ok: true, data: P_escribir(function () { return AV_visto(d.id, d.codigo, d.tipo); }) };
      case 'llamadasCargar': return { ok: true, data: LL_cargar(d.sync !== false) };
      case 'llamadaLead': return { ok: true, data: LL_lead(d.id) };
      case 'llamadaCrearCliente': return { ok: true, data: P_escribir(function () { return LL_crearCliente(d.lead_id, d.alta || {}); }) };
      case 'llamadaIA': return { ok: true, data: P_escribir(function () { return LL_guardarIA(d.id, d.texto, d.modo); }) };
      default: return { ok: false, error: 'Acción desconocida: ' + cuerpo.accion };
    }
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

// ───────── utilidades ─────────
function P_hoy() { return Utilities.formatDate(new Date(), P_ZONA, 'yyyy-MM-dd'); }
function P_ahora() { return Utilities.formatDate(new Date(), P_ZONA, "yyyy-MM-dd'T'HH:mm:ss"); }
function P_num(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; }
function P_sumarDias(iso, n) {
  var p = iso.split('-'), f = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  f.setUTCDate(f.getUTCDate() + n);
  return f.toISOString().slice(0, 10);
}
function P_texto(v) {
  if (v instanceof Date) return Utilities.formatDate(v, P_ZONA, 'yyyy-MM-dd');   // por si alguien escribe a mano una fecha en la hoja
  return v == null ? '' : String(v);
}

/** Si la pestaña tiene menos columnas que las que hacen falta, las añade (si no, getRange falla fuera de la cuadrícula) */
function P_ancho(sh, n) {
  var max = sh.getMaxColumns ? sh.getMaxColumns() : n;
  if (max < n && sh.insertColumnsAfter) sh.insertColumnsAfter(max, n - max);
}

function P_def(tabla) {
  var t = P_TABLAS[tabla];
  if (!t) throw new Error('Tabla no válida: ' + tabla);
  return t;
}

/** Devuelve la pestaña; si no existe, la crea con cabecera y formato texto. Si faltan columnas, las añade al final. */
function P_hoja(tabla) {
  var def = P_def(tabla), libro = SpreadsheetApp.openById(PANEL_HOJA_ID), sh = libro.getSheetByName(tabla);
  if (!sh) {
    sh = libro.insertSheet(tabla);
    sh.getRange(1, 1, sh.getMaxRows(), def.cols.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function P_cabecera(sh, tabla) {
  var def = P_def(tabla), ncol = Math.max(sh.getLastColumn(), 1);
  var cab = sh.getRange(1, 1, 1, ncol).getValues()[0].map(function (h) { return String(h).trim(); });
  var faltan = def.cols.filter(function (c) { return cab.indexOf(c) < 0; });
  if (faltan.length) {
    var desde = cab.filter(String).length + 1;
    P_ancho(sh, desde + faltan.length - 1);
    sh.getRange(1, desde, sh.getMaxRows(), faltan.length).setNumberFormat('@');
    sh.getRange(1, desde, 1, faltan.length).setValues([faltan]).setFontWeight('bold');
    cab = cab.filter(String).concat(faltan);
  }
  return cab;
}

function P_leer(tabla) {
  var sh = P_hoja(tabla), cab = P_cabecera(sh, tabla), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var vals = sh.getRange(2, 1, n, cab.length).getValues(), out = [];
  for (var i = 0; i < vals.length; i++) {
    if (!String(vals[i][0]).trim()) continue;
    var o = {};
    for (var j = 0; j < cab.length; j++) if (cab[j]) o[cab[j]] = P_texto(vals[i][j]);
    out.push(o);
  }
  return out;
}

function P_escribir(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Ocupado, prueba otra vez en unos segundos');
  try { return fn(); } finally { lock.releaseLock(); }
}

function P_limpiar(tabla, campos) {
  var def = P_def(tabla), o = {};
  Object.keys(campos).forEach(function (k) {
    if (k === 'id' || def.cols.indexOf(k) < 0) return;           // solo columnas conocidas; el id no se cambia
    var v = campos[k];
    o[k] = v == null ? '' : String(v).slice(0, def.largo ? 45000 : 5000);
  });
  return o;
}

/** Upsert por id. Si el id no existe, crea la fila con ese id. */
function P_guardar(tabla, id, campos) {
  if (!id) throw new Error('Falta id');
  var sh = P_hoja(tabla), cab = P_cabecera(sh, tabla), c = P_limpiar(tabla, campos);
  c.actualizado = P_ahora();
  var n = sh.getLastRow() - 1, fila = -1;
  if (n > 0) {
    var ids = sh.getRange(2, 1, n, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) { fila = i + 2; break; }
  }
  if (fila < 0) {
    fila = sh.getLastRow() + 1;
    var nueva = cab.map(function (h) { return h === 'id' ? String(id) : (c[h] != null ? c[h] : ''); });
    sh.getRange(fila, 1, 1, cab.length).setNumberFormat('@').setValues([nueva]);
  } else {
    var actual = sh.getRange(fila, 1, 1, cab.length).getValues()[0];
    var cambio = cab.map(function (h, j) { return c.hasOwnProperty(h) ? c[h] : P_texto(actual[j]); });
    sh.getRange(fila, 1, 1, cab.length).setNumberFormat('@').setValues([cambio]);
  }
  var o = {};
  var fin = sh.getRange(fila, 1, 1, cab.length).getValues()[0];
  cab.forEach(function (h, j) { if (h) o[h] = P_texto(fin[j]); });
  return o;
}

function P_nuevo(tabla, campos) {
  var def = P_def(tabla);
  var id = def.pref + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  return P_guardar(tabla, id, campos);
}

// ───────── carga y resumen ─────────
function P_cargar() {
  var clientes = P_leer('Clientes'), leads = P_leer('Leads'), cobros = P_leer('Cobros');
  var config = {}; P_leer('Config').forEach(function (r) { if (!r.archivado) config[r.id] = r.valor; });
  return { config: config, renovaciones: P_leer('Renovaciones'), gastos: P_leer('Gastos'), contenido: P_leer('Contenido'), clientes: clientes, leads: leads, cobros: cobros, tareas: P_leer('Tareas'), redes: P_leer('Redes'), altas: P_leer('Altas'), resumen: P_resumen(clientes, leads, cobros), hoy: P_hoy(), generado: P_ahora() };
}

function P_resumen(clientes, leads, cobros) {
  var hoy = P_hoy(), mes = hoy.slice(0, 7), en30 = P_sumarDias(hoy, 30);
  var dow = new Date(hoy + 'T12:00:00Z').getUTCDay();                 // 0 = domingo
  var domingo = P_sumarDias(hoy, dow === 0 ? 0 : 7 - dow);
  var vivos = function (r) { return !r.archivado; };
  var activos = clientes.filter(vivos).filter(function (c) { return c.estado === 'Activo'; });
  var cobrado = 0, previsto = 0;
  cobros.filter(vivos).forEach(function (p) {
    if (String(p.fecha).slice(0, 7) !== mes) return;
    previsto += P_num(p.importe);
    if (p.estado === 'Cobrado') cobrado += P_num(p.importe);
  });
  return {
    activos: activos.length,
    cobrado_mes: Math.round(cobrado * 100) / 100,
    previsto_mes: Math.round(previsto * 100) / 100,
    caducan_30: activos.filter(function (c) { return c.fin && c.fin >= hoy && c.fin <= en30; }).length,
    retomar_semana: clientes.filter(vivos).filter(function (c) { return c.estado !== 'Activo' && c.retomar_fecha && c.retomar_fecha <= domingo; }).length,
    leads_hoy: leads.filter(vivos).filter(function (l) { return l.proximo_contacto && l.proximo_contacto <= hoy && ['Cerrado', 'Perdido'].indexOf(l.estado) < 0; }).length
  };
}

/** Para probar desde el editor (▶): comprueba que lee la hoja. */
function P_probar() { return JSON.stringify(P_despachar({ k: PANEL_KEY, accion: 'cargar' }).data.resumen); }

// ═════════ Ronda del lunes (y revisiones) ═════════
/*
 * Una fila por cliente y ronda en la pestaña «Ronda». La escribe Claude (lectura del lunes a las 6:00 o revisión):
 *   fecha (lunes de la ronda), tipo (lunes · revision · viernes), cliente_id (de Clientes), cliente, codigo_app (si tiene app), orden,
 *   semaforo (verde · amarillo · rojo), titular (una línea), semana_personal, semana_entreno (texto corto),
 *   datos (JSON: {semana_programa, entrenos:{hechos,objetivo,flojos,sin_tiempo}, energia, sensacion, molestias:[{zona,valor,nota}],
 *          pasos, peso:{tendencia,texto}, formulario:{fecha,resumen}}),
 *   progreso (JSON: [{ej, antes, ahora, dir: sube|igual|baja, nota}]), tener_en_cuenta (una cosa por línea),
 *   voz (cómo le habla Alex a este cliente: para pedir otra versión al momento), mensaje (propuesto),
 *   cambios (JSON: [{cid, titulo, porque, tipo, params, estado, peticion, resultado}]).
 * Alex, desde el panel: edita el mensaje, lo abre en WhatsApp, lo marca enviado o pide otra versión; aplica, descarta o pide cambiar
 * cada cambio de plan; deja una nota para el seguimiento y marca la tarjeta como revisada.
 * Tipos que el panel aplica solo (cambios pequeños, decidido por Alex el 24/10): nota_semana, pausa, semana_suave, series_repes,
 * cambiar_ejercicio, ajuste. Cualquier otro (manual) queda «aprobado» y lo aplica Claude en el siguiente chequeo.
 */
var R_AUTO = ['nota_semana', 'pausa', 'semana_suave', 'series_repes', 'cambiar_ejercicio', 'alargar_cambio', 'ajuste'];
var R_AJUSTES_OK = ['dias_semana', 'objetivo_pasos', 'peso_cada', 'peso_frecuencia', 'nivel', 'pesos_disponibles', 'crono'];

function R_json(s, def) { try { var v = JSON.parse(s); return v == null ? def : v; } catch (e) { return def; } }

/** Reportes: «mensual» (revisiones), «lunes» y «viernes». Sin tipo: el mensual si queda alguno por hacer; si no, el semanal más reciente. */
function R_grupo(r) { var t = String(r.tipo || '').toLowerCase(); return t === 'viernes' ? 'viernes' : (t === 'revision' || t === 'mensual') ? 'mensual' : 'lunes'; }
function R_hecha(r) { return !!r.revisado || r.mensaje_estado === 'enviado' || r.mensaje_estado === 'descartado'; }
function R_cargar(fecha, tipo) {
  var todas = P_leer('Ronda').filter(function (r) { return !r.archivado; });
  var ult = { lunes: '', viernes: '', mensual: '' }, pendMens = 0, hace45 = P_sumarDias(P_hoy(), -45);
  todas.forEach(function (r) { var g = R_grupo(r); if (r.fecha && r.fecha > ult[g]) ult[g] = r.fecha; if (g === 'mensual' && !R_hecha(r)) pendMens++; });
  if (['lunes', 'viernes', 'mensual'].indexOf(tipo) < 0) tipo = pendMens ? 'mensual' : (ult.viernes > ult.lunes ? 'viernes' : 'lunes');
  var filas = todas.filter(function (r) { return R_grupo(r) === tipo; });
  var tel = {};
  P_leer('Clientes').forEach(function (c) { tel[c.id] = { telefono: c.telefono || '', semaforo: c.semaforo || '' }; });
  if (tipo === 'mensual') {   // las revisiones caen en fechas distintas: todas las pendientes y las hechas de los últimos 45 días
    var lm = filas.filter(function (r) { return !R_hecha(r) || (r.fecha || '') >= hace45; })
      .sort(function (a, b) { return (R_hecha(a) - R_hecha(b)) || String(a.fecha).localeCompare(String(b.fecha)) || (P_num(a.orden) || 99) - (P_num(b.orden) || 99); });
    return { tipo: tipo, ultimas: ult, pend_mensual: pendMens, fechas: [], fecha: ult.mensual, filas: lm, clientes: tel, hoy: P_hoy() };
  }
  var fechas = []; filas.forEach(function (r) { if (r.fecha && fechas.indexOf(r.fecha) < 0) fechas.push(r.fecha); });
  fechas.sort().reverse();
  var f = fecha && fechas.indexOf(fecha) >= 0 ? fecha : fechas[0] || '';
  var lista = filas.filter(function (r) { return r.fecha === f; }).sort(function (a, b) { return (P_num(a.orden) || 99) - (P_num(b.orden) || 99); });
  return { tipo: tipo, ultimas: ult, pend_mensual: pendMens, fechas: fechas, fecha: f, filas: lista, clientes: tel, hoy: P_hoy() };
}

function R_fila(id) {
  var r = P_leer('Ronda').filter(function (x) { return x.id === id; })[0];
  if (!r) throw new Error('No encuentro esa tarjeta');
  return r;
}

function R_cambio(r, cid) {
  var cs = R_json(r.cambios, []), c = cs.filter(function (x) { return x.cid === cid; })[0];
  if (!c) throw new Error('No encuentro ese cambio');
  return { lista: cs, c: c };
}

/** Alex pide otra versión (sin IA conectada): queda marcado y Claude lo rehace en el siguiente chequeo */
function R_pedir(d) {
  var r = R_fila(d.id), pet = String(d.peticion || '').slice(0, 2000);
  if (d.que === 'mensaje') return P_guardar('Ronda', r.id, { mensaje_estado: 'rehacer', mensaje_peticion: pet });
  var x = R_cambio(r, d.cid); x.c.estado = 'rehacer'; x.c.peticion = pet; x.c.fecha_estado = P_ahora();
  return P_guardar('Ronda', r.id, { cambios: JSON.stringify(x.lista) });
}

/** Versión nueva del mensaje (la escribe el Worker con la API de Claude): guarda la anterior en el historial */
function R_nuevoMensaje(id, texto, peticion, actual) {
  var r = R_fila(id); texto = String(texto || '').trim();
  if (!texto) throw new Error('La versión nueva ha salido vacía; prueba otra vez');
  if (r.mensaje_estado === 'enviado') throw new Error('Ese mensaje ya está enviado');
  var vers = R_json(r.mensaje_versiones, []), previo = actual != null ? String(actual) : r.mensaje;
  if (previo) vers.push({ texto: previo, peticion: String(peticion || ''), fecha: P_ahora() });
  return P_guardar('Ronda', r.id, { mensaje: texto, mensaje_estado: 'propuesto', mensaje_peticion: '', mensaje_versiones: JSON.stringify(vers.slice(-8)) });
}
/** Cambio rehecho (lo escribe el Worker): solo toca ese cambio, releyendo la fila dentro del bloqueo */
function R_reemplazarCambio(id, cid, nuevo) {
  var r = R_fila(id), x = R_cambio(r, cid), c = x.c; nuevo = nuevo || {};
  if (c.estado === 'aplicado') throw new Error('Ese cambio ya está aplicado en su hoja');
  c.antes = { titulo: c.titulo, porque: c.porque, tipo: c.tipo, params: c.params };
  c.titulo = String(nuevo.titulo || c.titulo); c.porque = String(nuevo.porque || c.porque);
  c.tipo = String(nuevo.tipo || c.tipo); c.params = nuevo.params || {};
  c.estado = 'propuesto'; c.peticion = ''; c.resultado = ''; c.fecha_estado = P_ahora();
  return P_guardar('Ronda', r.id, { cambios: JSON.stringify(x.lista) });
}

function R_estadoCambio(id, cid, estado, peticion) {
  if (['propuesto', 'descartado', 'aprobado'].indexOf(estado) < 0) throw new Error('Estado no válido');
  var r = R_fila(id), x = R_cambio(r, cid);
  if (x.c.estado === 'aplicado') throw new Error('Ese cambio ya está aplicado en su hoja');
  x.c.estado = estado; x.c.fecha_estado = P_ahora(); if (peticion != null) x.c.peticion = String(peticion).slice(0, 2000);
  return P_guardar('Ronda', r.id, { cambios: JSON.stringify(x.lista) });
}

/** Aplica un cambio pequeño en la hoja de la app del cliente (o lo deja aprobado para Claude) */
/** Alarga un cambio temporal: el nuevo sigue «semanas» más y el de antes vuelve más tarde. p = {dia, nuevo (ejercicio_id), viejo, semanas} */
var R_REVISAR = '';   // lunes en que se revisa un cambio temporal (lo usa R_aplicar)
function R_lunes() {   // lunes de la semana de programa en curso (la semana cambia el lunes a las 05:00 de Lombok)
  var d; try { d = D_diaSemanal(); } catch (e) { d = P_hoy(); }
  var p = String(d).split('-'), f = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])), wd = (f.getUTCDay() + 6) % 7;
  return P_sumarDias(String(d).slice(0, 10), -wd);
}
function R_alargarCambio(ss, S, p) {
  var mas = parseInt(p.semanas, 10) || 2;
  if (!p.dia || !p.nuevo || !p.viejo) throw new Error('Faltan datos para alargar el cambio (día, nuevo y viejo)');
  var sh = ss.getSheetByName('Plan'); if (!sh) throw new Error('Su hoja no tiene la pestaña Plan');
  var v = sh.getDataRange().getValues(), cab = v[0].map(function (h) { return String(h).trim(); });
  var iD = cab.indexOf('dia'), iE = cab.indexOf('ejercicio_id'), iSd = cab.indexOf('semana_desde'), iSh = cab.indexOf('semana_hasta');
  if (iSd < 0 || iSh < 0) throw new Error('Su plan no tiene semanas: no hay cambio temporal que alargar');
  var fN = -1, fV = -1, fin = 0;
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][iD]) !== String(p.dia)) continue;
    var sd = parseInt(v[i][iSd], 10) || 0, shh = parseInt(v[i][iSh], 10) || 0;
    if (String(v[i][iE]) === String(p.nuevo) && shh && shh >= S - 1 && (fN < 0 || shh > fin)) { fN = i; fin = shh; }
  }
  if (fN < 0) throw new Error('No encuentro el cambio temporal de «' + p.nuevo + '» en el ' + p.dia);
  for (var k = 1; k < v.length; k++) if (String(v[k][iD]) === String(p.dia) && String(v[k][iE]) === String(p.viejo) && (parseInt(v[k][iSd], 10) || 0) === fin + 1) { fV = k; break; }
  var nf = fin + mas;
  if (fV >= 0) {
    var hv = parseInt(v[fV][iSh], 10) || 0;
    if (hv && hv <= nf) { sh.getRange(fN + 1, iSh + 1).setValue(hv); sh.getRange(fV + 1, iSd + 1).setValue(hv + 1); }   // raro: el viejo se acababa antes
    else { sh.getRange(fN + 1, iSh + 1).setValue(nf); sh.getRange(fV + 1, iSd + 1).setValue(nf + 1); }
  } else sh.getRange(fN + 1, iSh + 1).setValue(nf);
  R_REVISAR = P_sumarDias(R_lunes(), (nf - S) * 7);
  return '«' + p.nuevo + '» sigue ' + mas + ' semanas más (hasta la ' + nf + ')' + (fV >= 0 ? '; «' + p.viejo + '» vuelve en la ' + (nf + 1) : '');
}

function R_aplicar(id, cid) {
  var r = R_fila(id), x = R_cambio(r, cid), c = x.c;
  if (String(r.ejemplo).toUpperCase() === 'TRUE' || r.ejemplo === 'sí') throw new Error('Es una tarjeta de ejemplo: no se aplica en ninguna hoja');
  if (c.estado === 'aplicado') return r;
  if (c.estado && c.estado !== 'propuesto') throw new Error('Solo se aplica un cambio propuesto (este está «' + c.estado + '»)');
  var resultado;
  if (R_AUTO.indexOf(c.tipo) < 0) {
    c.estado = 'aprobado'; resultado = 'Aprobado: lo aplica Claude en el siguiente chequeo';
  } else {
    if (!r.codigo_app) throw new Error('Este cliente no tiene la app: lo aplica Claude a mano');
    R_REVISAR = '';
    resultado = R_ejecutar(r.codigo_app, c.tipo, c.params || {});
    c.estado = 'aplicado';
    if (R_REVISAR) c.revisar = R_REVISAR;
  }
  c.resultado = resultado; c.fecha_estado = P_ahora();
  var fila = P_guardar('Ronda', r.id, { cambios: JSON.stringify(x.lista) });      // primero se marca (si algo falla después, no se repite)
  try {
    P_nuevo('Aplicados', { fecha: P_hoy(), cliente: r.cliente, codigo_app: r.codigo_app, ronda_id: r.id, cambio_id: cid, tipo: c.tipo,
      detalle: (c.titulo || '') + ' · ' + JSON.stringify(c.params || {}), resultado: resultado + (c.revisar ? ' · revisar el ' + c.revisar : ''), pasado_a_docs: '' });
  } catch (e) { console.error('Aplicados: ' + e); }
  return fila;
}

// ───────── escribir en la hoja de la app del cliente ─────────
function R_hojaCliente(codigo) {
  var cli = D_cliente(codigo);
  if (!cli) throw new Error('No encuentro la app de ' + codigo + ' (o no está activa)');
  return SpreadsheetApp.openById(cli.hoja);
}
/** Añade una fila por nombres de columna; crea la pestaña o las columnas que falten */
function R_append(ss, nombre, obj, cabBase) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) { sh = ss.insertSheet(nombre); sh.getRange(1, 1, 1, cabBase.length).setValues([cabBase]); sh.setFrozenRows(1); }
  var ncol = Math.max(sh.getLastColumn(), 1), cab = sh.getRange(1, 1, 1, ncol).getValues()[0].map(function (h) { return String(h).trim(); }).filter(String);
  Object.keys(obj).forEach(function (k) { if (cab.indexOf(k) < 0) { P_ancho(sh, cab.length + 1); sh.getRange(1, cab.length + 1).setValue(k); cab.push(k); } });
  R_filaNueva(sh, cab.map(function (h) { return obj.hasOwnProperty(h) ? obj[h] : ''; }));
  return cab;
}
/** Escribe una fila al final en formato texto, para que «10-12» o «+2» no se conviertan en fecha o número (los números siguen siendo números) */
function R_filaNueva(sh, valores) {
  var f = sh.getLastRow() + 1;
  if (sh.getMaxRows && sh.insertRowsAfter && f > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 10);
  sh.getRange(f, 1, 1, valores.length).setNumberFormat('@').setValues([valores]);
}
function R_ajuste(ss, clave, valor) {
  var sh = ss.getSheetByName('Ajustes'); if (!sh) throw new Error('Su hoja no tiene la pestaña Ajustes');
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === clave) { sh.getRange(i + 1, 2).setNumberFormat('@').setValue(String(valor)); return; }
  R_filaNueva(sh, [clave, String(valor)]);
}
/** Semana del programa hoy: la mayor entre Ajustes › semana y la calculada por fecha (por si el cambio del domingo aún no ha pasado) */
/** Semana actual de la clienta, en SU zona (Ajustes › zona; si no hay, España) */
function R_semana(ss) {
  if (!ss.getSheetByName('Ajustes')) throw new Error('Su hoja no tiene la pestaña Ajustes');
  try {
    var aj = L_ajustes(D_leer(ss, 'Ajustes')), S = aj.semana || 1;
    var porFecha = aj.fecha_inicio_semana1 ? L_semanaPrograma(aj, D_diaSemanal()) : 0;   // la semana cambia el lunes a las 05:00 de Lombok
    return porFecha > S ? porFecha : S;
  } catch (e) {   // sin Code.gs (pruebas): la semana de Ajustes
    var filas = ss.getSheetByName('Ajustes').getDataRange().getValues(), w = 1;
    for (var i = 1; i < filas.length; i++) if (String(filas[i][0]).trim() === 'semana') w = parseInt(filas[i][1], 10) || 1;
    return w;
  }
}
/** «Hoy» en la zona de la clienta de ese código */
function R_hoyCliente(codigo) {
  try { var aj = L_ajustes(D_leer(R_hojaCliente(codigo), 'Ajustes')); return D_hoyEn(D_zonaOk(aj.zona_movil) || D_zonaOk(aj.zona) || P_ZONA); } catch (e) { return P_hoy(); }
}
function R_fechaOk(f) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f || ''))) throw new Error('Fecha no válida: ' + f); return String(f); }

function R_ejecutar(codigo, tipo, p) {
  var ss, S, txt;
  if (tipo === 'nota_semana') {
    if (!p.nota) throw new Error('Falta el texto de la nota');
    var hoy = R_hoyCliente(codigo), desde = p.desde ? R_fechaOk(p.desde) : hoy, hasta = p.hasta ? R_fechaOk(p.hasta) : P_sumarDias(desde, 6);
    R_append(SpreadsheetApp.openById(MAESTRA_ID), 'Semana de Alex', { codigo: codigo, nota: String(p.nota), valida_desde: desde, valida_hasta: hasta }, ['codigo', 'nota', 'valida_desde', 'valida_hasta']);
    txt = 'Nota de la semana puesta del ' + desde + ' al ' + hasta;
  } else {
    ss = R_hojaCliente(codigo); S = R_semana(ss);
    if (tipo === 'pausa') {
      R_ajuste(ss, 'pausa_desde', R_fechaOk(p.desde)); R_ajuste(ss, 'pausa_hasta', R_fechaOk(p.hasta));
      txt = 'Pausa del ' + p.desde + ' al ' + p.hasta;
    } else if (tipo === 'semana_suave' || tipo === 'series_repes') {
      var w1 = parseInt(p.desde || p.semana, 10) || S, w2 = parseInt(p.hasta || p.semana, 10) || w1;
      if (w1 < S) throw new Error('La semana ' + w1 + ' ya ha pasado (ahora va por la ' + S + ')');
      var fila = { semana_desde: w1, semana_hasta: w2, aplica_a: String(p.aplica_a || 'todos'),
        series: p.series != null ? p.series : (tipo === 'semana_suave' ? 2 : ''), repes: p.repes || '',
        nota: p.nota || (tipo === 'semana_suave' ? 'Semana suave: 2 series por ejercicio y sin apretar, para recargar pilas' : '') };
      R_append(ss, 'Progresión', fila, ['semana_desde', 'semana_hasta', 'aplica_a', 'series', 'repes', 'nota', 'test']);
      txt = (tipo === 'semana_suave' ? 'Semana suave' : 'Series/repes') + ' en las semanas ' + w1 + '-' + w2 + ' (' + fila.aplica_a + ')';
    } else if (tipo === 'cambiar_ejercicio') {
      txt = R_cambiarEjercicio(ss, S, p);
    } else if (tipo === 'alargar_cambio') {
      txt = R_alargarCambio(ss, S, p);
    } else if (tipo === 'ajuste') {
      if (R_AJUSTES_OK.indexOf(p.clave) < 0) throw new Error('Ese ajuste no se cambia desde el panel: ' + p.clave);
      R_ajuste(ss, p.clave, p.valor); txt = 'Ajustes › ' + p.clave + ' = ' + p.valor;
    } else throw new Error('Tipo no soportado: ' + tipo);
  }
  try { if (typeof D_cacheFuera === 'function') D_cacheFuera(codigo); else D_cache().remove('dat_' + VERSION_DATOS + '_' + codigo); } catch (e) {}
  return txt;
}

/** El ejercicio «viejo» de ese día termina la semana anterior a «desde» y entra el nuevo (misma posición en el día) */
function R_cambiarEjercicio(ss, S, p) {
  var n = p.nuevo || {}, desde = parseInt(p.desde, 10) || S;
  if (!p.dia || !p.viejo || !n.ejercicio_id || !n.nombre) throw new Error('Faltan datos del cambio de ejercicio (día, viejo y nuevo)');
  if (desde < S) throw new Error('La semana ' + desde + ' ya ha pasado (ahora va por la ' + S + ')');
  var sh = ss.getSheetByName('Plan'); if (!sh) throw new Error('Su hoja no tiene la pestaña Plan');
  var v = sh.getDataRange().getValues(), cab = v[0].map(function (h) { return String(h).trim(); });
  ['semana_desde', 'semana_hasta'].forEach(function (k) { if (cab.indexOf(k) < 0) { P_ancho(sh, cab.length + 1); sh.getRange(1, cab.length + 1).setValue(k); cab.push(k); } });
  var iD = cab.indexOf('dia'), iE = cab.indexOf('ejercicio_id'), iSd = cab.indexOf('semana_desde'), iSh = cab.indexOf('semana_hasta');
  var fila = -1;
  for (var i = 1; i < v.length; i++) {
    var sd = parseInt(v[i][iSd], 10) || 0, shh = parseInt(v[i][iSh], 10) || 0;
    if (String(v[i][iD]) === String(p.dia) && String(v[i][iE]) === String(p.viejo) && (!sd || sd <= desde) && (!shh || shh >= desde)) { fila = i; break; }
  }
  if (fila < 0) throw new Error('No encuentro «' + p.viejo + '» en el ' + p.dia + ' para la semana ' + desde);
  var vieja = v[fila].slice(); while (vieja.length < cab.length) vieja.push('');
  var hastaVieja = vieja[iSh];
  // Del viejo solo se copia la estructura (día, orden, superserie, series, repes, descanso); vídeo, imagen y textos son del nuevo
  var COPIAR = ['dia', 'orden', 'grupo', 'series', 'repes', 'descanso', 'principal', 'semana_desde', 'semana_hasta'];
  var nueva = cab.map(function (h, j) { return n.hasOwnProperty(h) ? n[h] : (COPIAR.indexOf(h) >= 0 ? vieja[j] : ''); });
  nueva[iSd] = desde; nueva[iSh] = hastaVieja || '';
  // Cambio temporal (p. ej. por una molestia): el nuevo dura «semanas» y después vuelve solo el de antes
  var semanas = parseInt(p.semanas, 10) || 0, fin = semanas ? desde + semanas - 1 : 0, vuelve = null;
  if (semanas) {
    var hv = parseInt(hastaVieja, 10) || 0;
    if (!hv || hv > fin) { nueva[iSh] = fin; vuelve = vieja.slice(); vuelve[iSd] = fin + 1; vuelve[iSh] = hastaVieja || ''; }
  }
  if (desde <= (parseInt(vieja[iSd], 10) || 1)) {
    sh.getRange(fila + 1, 1, 1, cab.length).setNumberFormat('@').setValues([nueva]);   // sustituye la fila (sin semanas previas que guardar)
  } else {
    sh.getRange(fila + 1, iSh + 1).setValue(desde - 1);
    R_filaNueva(sh, nueva);
  }
  if (vuelve) R_filaNueva(sh, vuelve);
  // Si el viejo vuelve en semanas siguientes (otra fila con semana_desde posterior), también se cambia ahí
  var mas = 0;
  for (var k = 1; k < v.length; k++) {
    if (k === fila) continue;
    var sd2 = parseInt(v[k][iSd], 10) || 0;
    if (String(v[k][iD]) === String(p.dia) && String(v[k][iE]) === String(p.viejo) && sd2 > desde && (!fin || sd2 <= fin)) {
      var fk = v[k].slice(); while (fk.length < cab.length) fk.push('');
      cab.forEach(function (h, j) { if (n.hasOwnProperty(h)) fk[j] = n[h]; else if (['para_ti', 'como', 'video', 'imagen_id', 'alternativa'].indexOf(h) >= 0) fk[j] = ''; });
      sh.getRange(k + 1, 1, 1, cab.length).setNumberFormat('@').setValues([fk]); mas++;
    }
  }
  if (semanas) R_REVISAR = P_sumarDias(R_lunes(), (fin - S) * 7);
  if (semanas) return '«' + p.viejo + '» → «' + n.ejercicio_id + '» en el ' + p.dia + ', semanas ' + desde + '-' + fin + (vuelve ? '; en la ' + (fin + 1) + ' vuelve «' + p.viejo + '» sola' : '');
  return (mas ? '(también en ' + mas + ' tramo' + (mas > 1 ? 's' : '') + ' siguiente' + (mas > 1 ? 's' : '') + ') ' : '') + '«' + p.viejo + '» → «' + n.ejercicio_id + '» en el ' + p.dia + ' desde la semana ' + desde;
}


// ═════════ Llamadas (leads calientes con llamada agendada) ═════════
/*
 * Los leads con llamada viven en la misma pestaña «Leads», con estas columnas extra:
 *   llamada ('yyyy-MM-ddTHH:mm+08:00': la hora con su desfase; el panel la enseña en la hora del móvil de Alex y en la de España), llamada_evento (id del evento de Google Calendar, si viene de ahí),
 *   llamada_estado (agendada · hecha · cerrado · no_cerrado · no_presentado · cancelada), motivo_no, notas_llamada,
 *   cliente_id (si entró), chat_ig (conversación de Instagram pegada o leída por Claude), chuleta (preparación de la llamada:
 *   la escribe la IA del panel o Claude en el chequeo de las 6:00), guion (JSON {parte: lo que apunta Alex en la llamada}),
 *   seguimiento_paso (1 = a los 2 días, 2 = a la semana, 3 = al mes, fin), seguimiento_msg (mensaje propuesto para ese paso).
 * Calendar: se leen los eventos del calendario principal de Alex de los últimos 14 días y los próximos 60. Cuenta como llamada
 *   el evento cuyo título tenga «llamada» o «call», o cuya descripción tenga Instagram/IG o WhatsApp/WA/Tel.
 *   En la descripción: «IG: @usuario» o instagram.com/usuario, «WA: +34 600 000 000» (o Tel:), y si quiere «Nombre: …».
 */
var LL_DIAS_ATRAS = 14, LL_DIAS_DELANTE = 60;
var LL_PLANES_BASE = [
  { nombre: '3 meses', meses: '3', precio: '450', cuotas: '1,2,3', activo: 'Sí', orden: '1' },
  { nombre: '6 meses', meses: '6', precio: '850', cuotas: '1,2,3,4,5,6', activo: 'Sí', orden: '2' },
  { nombre: '12 meses', meses: '12', precio: '1450', cuotas: '1,2,3,4,5,6', activo: 'Sí', orden: '3' }
];

function LL_cargar(conSync) {
  var sync = { leidos: 0, nuevos: 0, cambiados: 0, error: '' };
  if (conSync) {
    try { sync = P_escribir(LL_sincronizar); }
    catch (e) { sync.error = String(e && e.message || e); }
  }
  var planes = P_leer('Planes');
  if (!planes.length) planes = P_escribir(function () { return LL_PLANES_BASE.map(function (p) { return P_nuevo('Planes', p); }); });
  return { leads: P_leer('Leads'), planes: planes, altas: P_leer('Altas'), sync: sync, hoy: P_hoy(), ahora: P_ahora() };
}

function LL_lead(id) {
  var l = P_leer('Leads').filter(function (x) { return x.id === id; })[0];
  if (!l) throw new Error('No encuentro ese lead');
  return l;
}

function LL_digitos(s) { return String(s || '').replace(/[^0-9]/g, '').replace(/^00/, ''); }
/** Teléfono para wa.me: solo números y con prefijo (un móvil español de 9 cifras se queda con 34 delante). */
function LL_tel(s) { var d = LL_digitos(s); return /^[6789]\d{8}$/.test(d) ? '34' + d : d; }
function LL_ig(s) { return String(s || '').toLowerCase().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/[/?].*$/, '').trim(); }

/** Saca nombre, Instagram y WhatsApp de un evento. Devuelve null si no parece una llamada de venta. */
function LL_parsear(titulo, desc) {
  titulo = String(titulo || ''); desc = String(desc || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ');
  var esLlamada = /llamada|call|valoraci[oó]n/i.test(titulo) || /(instagram|\big\s*:|whats\s*app|\bwa\s*:|\btel[eé]?f?o?n?o?\s*:)/i.test(desc);
  if (!esLlamada) return null;
  var m, ig = '', wa = '', nombre = '';
  if ((m = desc.match(/instagram\.com\/([A-Za-z0-9._]+)/i))) ig = m[1];
  else if ((m = desc.match(/(?:instagram|\big)\s*:?\s*@?([A-Za-z0-9._]{2,30})/i))) ig = m[1];
  if ((m = desc.match(/(?:whats\s*app|\bwa|\btel[eé]fono|\btel|\bm[oó]vil)\s*:?\s*(\+?[\d\s().-]{9,20})/i))) wa = LL_tel(m[1]);
  else if ((m = desc.match(/(\+?\d[\d\s.-]{8,16}\d)/))) wa = LL_tel(m[1]);
  if ((m = desc.match(/nombre\s*:\s*([^\n]+)/i))) nombre = m[1].trim();
  if (!nombre) nombre = titulo.replace(/^\s*(llamada|call)(\s+(de\s+)?valoraci[oó]n)?(\s+(con|de|a))?\s*[-:–]?\s*/i, '').replace(/\(.*?\)/g, '').trim();
  if (!nombre && ig) nombre = '@' + ig;
  return { nombre: nombre || 'Sin nombre', instagram: ig ? '@' + LL_ig(ig) : '', whatsapp: wa };
}

function LL_sincronizar() {
  var res = { leidos: 0, nuevos: 0, cambiados: 0, error: '' };
  var cal = CalendarApp.getDefaultCalendar(), tzc = P_ZONA;
  try { tzc = cal.getTimeZone() || P_ZONA; } catch (e) {}   // las horas, en la zona del calendario de Alex (Lombok), como las ve él
  var desde = new Date(Date.now() - LL_DIAS_ATRAS * 864e5), hasta = new Date(Date.now() + LL_DIAS_DELANTE * 864e5);
  var eventos = cal.getEvents(desde, hasta), leads = P_leer('Leads'), vistos = {};
  // Las llamadas con clientes (revisiones, check-ins) no son leads: fuera por título o por nombre de cliente
  var clientes = {};
  P_leer('Clientes').forEach(function (c) { [c.nombre, c.nombre_whatsapp].forEach(function (n) { n = String(n || '').trim().toLowerCase(); if (n) clientes[n] = true; }); });
  eventos.forEach(function (ev) {
    if (ev.isAllDayEvent()) return;
    if (/revisi[oó]n|check|seguimiento|cliente/i.test(ev.getTitle())) return;
    var p = LL_parsear(ev.getTitle(), ev.getDescription());
    if (!p || clientes[p.nombre.toLowerCase()]) return;
    res.leidos++;
    var eid = ev.getId() + '|' + ev.getStartTime().getTime();
    var cuando = Utilities.formatDate(ev.getStartTime(), tzc, "yyyy-MM-dd'T'HH:mmXXX");   // con su desfase: el panel la enseña en tu hora y en la de España
    vistos[eid] = true;
    var l = leads.filter(function (x) { return x.llamada_evento === eid; })[0];
    if (!l) {   // ¿es un lead que ya existe? (por Instagram, teléfono o nombre)
      l = leads.filter(function (x) {
        if (x.llamada_evento) return false;
        if (p.instagram && LL_ig(x.instagram) && LL_ig(x.instagram) === LL_ig(p.instagram)) return true;
        if (p.whatsapp && LL_digitos(x.whatsapp).length >= 9 && LL_digitos(x.whatsapp).slice(-9) === p.whatsapp.slice(-9)) return true;
        return p.nombre !== 'Sin nombre' && String(x.nombre).trim().toLowerCase() === p.nombre.toLowerCase();
      })[0];
    }
    if (!l) {
      P_nuevo('Leads', { nombre: p.nombre, instagram: p.instagram, whatsapp: p.whatsapp, origen: 'por confirmar', temperatura: 'caliente',
        estado: 'Llamada agendada', llamada: cuando, llamada_evento: eid, llamada_estado: 'agendada', ultima_fecha: P_hoy(),
        siguiente_paso: 'Llamada', notas: 'Creado desde Google Calendar' });
      res.nuevos++;
      return;
    }
    var c = {};
    if (l.llamada_evento !== eid) c.llamada_evento = eid;
    if (Date.parse(l.llamada) !== Date.parse(cuando) && (!l.llamada_estado || l.llamada_estado === 'agendada' || l.llamada_estado === 'cancelada' || l.llamada_evento !== eid)) {
      c.llamada = cuando; c.llamada_estado = 'agendada';
      if (['Cerrado', 'Perdido'].indexOf(l.estado) < 0) c.estado = 'Llamada agendada';
    }
    if (!l.instagram && p.instagram) c.instagram = p.instagram;
    if (!l.whatsapp && p.whatsapp) c.whatsapp = p.whatsapp;
    if (!l.llamada_estado && !c.llamada_estado) c.llamada_estado = 'agendada';
    if (Object.keys(c).length) { P_guardar('Leads', l.id, c); res.cambiados++; }
  });
  // Llamadas futuras que ya no están en el calendario: canceladas
  var ahora = Date.now();
  leads.forEach(function (l) {
    var t = Date.parse(l.llamada);
    if (!l.llamada_evento || vistos[l.llamada_evento] || l.llamada_estado !== 'agendada' || !(t > ahora)) return;
    if (t > hasta.getTime()) return;
    P_guardar('Leads', l.id, { llamada_estado: 'cancelada', notas_llamada: (l.notas_llamada ? l.notas_llamada + '\n' : '') + 'El evento ya no está en el calendario (' + P_hoy() + ')' });
    res.cambiados++;
  });
  return res;
}

function LL_sumarMeses(iso, n) {
  var p = iso.split('-'), y = +p[0], m = +p[1] - 1 + n, d = +p[2];
  var f = new Date(Date.UTC(y, m, 1)), ult = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).getUTCDate();
  f.setUTCDate(Math.min(d, ult));
  return f.toISOString().slice(0, 10);
}

/** Crea el cliente desde la llamada: ficha en Clientes, sus cobros, la fila de Altas y el lead como Cerrado. */
function LL_crearCliente(leadId, a) {
  var l = LL_lead(leadId);
  if (l.cliente_id) throw new Error('Este lead ya tiene ficha de cliente (' + l.cliente_id + ')');
  var nombre = String(a.nombre || l.nombre || '').trim(); if (!nombre) throw new Error('Falta el nombre');
  var inicio = R_fechaOk(a.inicio), meses = parseInt(a.meses, 10), precio = P_num(a.precio);
  if (!(meses > 0)) throw new Error('Falta la duración del plan');
  if (!(precio > 0)) throw new Error('Falta el precio');
  var cobros = (a.cobros || []).filter(function (c) { return c && c.fecha; });
  if (!cobros.length) throw new Error('Faltan los cobros');
  cobros.forEach(function (c) { R_fechaOk(c.fecha); if (!(P_num(c.importe) > 0)) throw new Error('Hay un cobro sin importe'); });
  var suma = cobros.reduce(function (t, c) { return t + P_num(c.importe); }, 0);
  if (Math.abs(suma - precio) > 0.05) throw new Error('Los cobros suman ' + suma.toFixed(2) + ' € y el precio es ' + precio.toFixed(2) + ' €');
  var n = cobros.length, programa = a.programa || (meses + ' meses');
  var cli = P_nuevo('Clientes', {
    nombre: nombre, nombre_whatsapp: a.nombre_whatsapp || nombre, telefono: LL_tel(a.telefono || l.whatsapp), estado: 'Activo',
    programa: programa, inicio: inicio, fin: LL_sumarMeses(inicio, meses), precio_total: String(precio),
    forma_pago: n === 1 ? 'Pago único' : n + ' cuotas', metodo: a.metodo || '', cuotas: String(n),
    importe_cuota: n === 1 ? String(precio) : String(P_num(cobros[0].importe)), dia_cobro: n > 1 ? String(+cobros[0].fecha.slice(8, 10)) : '',
    seguimiento: 'Normal', semaforo: 'verde', semaforo_nota: 'Recién entrado',
    notas: 'Alta desde la llamada del ' + String(l.llamada || '').slice(0, 10) + (a.instagram || l.instagram ? ' · IG ' + (a.instagram || l.instagram) : '') +
      (a.lugar ? ' · entrena en ' + String(a.lugar).toLowerCase() : '') + (a.dias ? ' · ' + a.dias + ' días' : '') + (a.nota_pago ? '\nPago: ' + a.nota_pago : '') + (a.notas ? '\n' + a.notas : '')
  });
  var nuevos = cobros.map(function (c, i) {
    return P_nuevo('Cobros', { fecha: c.fecha, cliente_id: cli.id, cliente: nombre, concepto: (n === 1 ? 'Pago único' : 'Cuota ' + (i + 1) + '/' + n) + ' · ' + programa,
      importe: String(Math.round(P_num(c.importe) * 100) / 100), estado: c.cobrado ? 'Cobrado' : 'Pendiente', ultimo: i === n - 1 ? 'Sí' : '', metodo: a.metodo || '', notas: String(a.nota_pago || '').slice(0, 300) });
  });
  var guion = R_json(l.guion, {}), partes = Object.keys(guion).filter(function (k) { return String(guion[k] || '').trim(); })
    .map(function (k) { return '- ' + k + ': ' + guion[k]; }).join('\n');
  var resumen = [l.preocupacion && 'Le preocupa: ' + l.preocupacion, partes && 'Lo hablado en la llamada:\n' + partes, l.notas_llamada && 'Notas de la llamada: ' + l.notas_llamada,
    l.ultima_resumen && 'Última conversación: ' + l.ultima_resumen, (a.lugar || a.dias) && 'Empieza en ' + String(a.lugar || '').toLowerCase() + (a.dias ? ', ' + a.dias + ' días por semana (si en el formulario dice menos, mandan los del formulario)' : ''),
    a.nota_pago && 'Pago: ' + a.nota_pago, a.notas && 'Notas de Alex para el alta: ' + a.notas].filter(Boolean).join('\n');
  var alta = P_nuevo('Altas', { fecha: P_hoy(), cliente_id: cli.id, cliente: nombre, lead_id: l.id, telefono: cli.telefono, instagram: a.instagram || l.instagram,
    programa: programa, inicio: inicio, resumen: resumen, estado: 'pendiente' });
  var lead = P_guardar('Leads', l.id, { nombre: l.nombre || nombre, whatsapp: l.whatsapp || cli.telefono, estado: 'Cerrado', llamada_estado: 'cerrado', cliente_id: cli.id, ultima_fecha: P_hoy(), proximo_contacto: '', siguiente_paso: 'Cliente: ' + programa });
  return { cliente: cli, cobros: nuevos, alta: alta, lead: lead };
}

function LL_guardarIA(id, texto, modo) {
  var l = LL_lead(id), c = {};
  if (modo === 'seguimiento') c.seguimiento_msg = String(texto || '');
  else c.chuleta = String(texto || '');
  return P_guardar('Leads', l.id, c);
}

/** Ejecutar una vez desde el editor (▶) para dar permiso al calendario. */
function LL_probar() { return JSON.stringify(LL_sincronizar()); }


// ═════════ Avisos de la app (24/10, ideas de Alex y Ramón) ═════════
/*
 * Se calculan en directo con la hoja de cada clienta activa (maestra › Registro clientes), en SU zona horaria
 * (la del móvil, Ajustes › zona_movil; si no hay, España). La semana, la común (lunes 05:00 de Lombok). Solo lectura: no toca la app. Tipos:
 *   no_entra  · días sin apuntar nada en la app (4 o más: ámbar; 7 o más: rojo), o nada apuntado desde que empezó
 *   semana    · semana a medias: con «Días plan › dia_semana», los días que ya tocaban y no están hechos;
 *               sin ese dato, solo cuando ya no le dan los días que quedan para completar la semana
 *   molestia  · 6 o más en un ejercicio o en «Avisar de una molestia» (rojo); 4-5 dos semanas seguidas en el mismo (ámbar)
 *   abierto   · entreno empezado hace más de 2 horas sin terminar
 *   nota      · nota en «Algo que contarme» (esta semana o la anterior)
 *   peso      · peso del viernes sin apuntar (sábado y domingo, si se pesa cada semana) y fotos de control sin subir
 * Alex pulsa «Visto» y desaparece (pestaña AvisosVistos). Se guardan 5 minutos en caché.
 */
var AV_CACHE = 'avisos_panel_v1';
function AV_cargar(fresco) {
  var c = CacheService.getScriptCache();
  if (!fresco) { var h = c.get(AV_CACHE); if (h) return JSON.parse(h); var v = c.get(AV_CACHE + '_viejo'); if (v) { var rv = JSON.parse(v); rv.viejo = true; return rv; } }
  var vistos = {}; P_leer('AvisosVistos').forEach(function (v) { if (!v.archivado) vistos[v.id] = true; });
  var porCodigo = {}; P_leer('Clientes').forEach(function (cl) { if (cl.codigo_app && !cl.archivado) porCodigo[String(cl.codigo_app).trim()] = cl; });
  var out = [], errores = [], semanas = {};
  D_leer(SpreadsheetApp.openById(MAESTRA_ID), 'Registro clientes').forEach(function (fila) {
    if (!L_bool(fila.activa) || !fila.hoja_datos_id || fila.hoja_datos_id === 'PENDIENTE') return;
    var codigo = String(fila.codigo).trim(), cl = porCodigo[codigo] || {};
    try {
      // Su semana real (la de la app, con pausas): el panel cuenta con ella sus controles
      var ssA = SpreadsheetApp.openById(String(fila.hoja_datos_id).trim()), ajS = L_ajustes(D_leer(ssA, 'Ajustes')), hoyS = D_diaSemanal();
      var nB = String(ajS.bloque || '').match(/\d+/);   // «Bloque 2 de casa», «Plan Casares 2»
      semanas[codigo] = { b: nB ? +nB[0] : 1, ini: ajS.fecha_inicio_semana1 || '', s: Math.max(ajS.semana, L_semanaPrograma(ajS, hoyS) || 0), pausa: !!(ajS.pausa_desde && ajS.pausa_hasta && hoyS >= ajS.pausa_desde && hoyS <= ajS.pausa_hasta) };
      AV_cliente(ssA).forEach(function (a) {
        a.id = codigo + '|' + a.clave; if (vistos[a.id]) return;
        a.codigo = codigo; a.cliente = cl.nombre || fila.nombre || codigo; a.cliente_id = cl.id || ''; a.telefono = cl.telefono || '';
        delete a.clave; out.push(a);
      });
    } catch (e) { errores.push(codigo + ': ' + (e && e.message || e)); }
  });
  out.sort(function (a, b) { return (a.nivel === 'rojo' ? 0 : 1) - (b.nivel === 'rojo' ? 0 : 1) || String(a.cliente).localeCompare(String(b.cliente)); });
  var res = { avisos: out, errores: errores, semanas: semanas, generado: P_ahora() };
  try { c.put(AV_CACHE, JSON.stringify(res), 300); c.put(AV_CACHE + '_viejo', JSON.stringify(res), 21600); } catch (e) {}
  return res;
}

function AV_visto(id, codigo, tipo) {
  if (!id) throw new Error('Falta el aviso');
  P_guardar('AvisosVistos', id, { codigo: codigo || '', tipo: tipo || '', fecha: P_hoy() });
  try { CacheService.getScriptCache().remove(AV_CACHE); } catch (e) {}
  return { ok: true };
}

var AV_DSEM = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
/** Avisos de una clienta. Devuelve [{clave, tipo, nivel, titulo, detalle}] */
function AV_cliente(ss) {
  var aj = L_ajustes(D_leer(ss, 'Ajustes')), zona = D_zonaOk(aj.zona_movil) || D_zonaOk(aj.zona) || P_ZONA, hoy = D_hoyEn(zona), out = [];
  if (!aj.fecha_inicio_semana1 || hoy < aj.fecha_inicio_semana1) return out;                       // aún no ha empezado
  var pz = L_pausa(aj), cal = L_semanaPorFecha(aj.fecha_inicio_semana1, hoy);
  if (pz && cal >= pz.a && cal <= pz.b) return out;                                                      // en pausa (semanas enteras)
  var finPausa = pz && cal > pz.b ? L_sumarDias(aj.fecha_inicio_semana1, pz.b * 7) : '';                 // lunes de vuelta
  var S = Math.max(aj.semana, L_semanaPrograma(aj, D_diaSemanal())), lunes = L_lunesPrograma(aj, S), dHoy = Math.min(6, Math.max(0, L_diasEntre(lunes, hoy)));
  var bloques = D_leerOpc(ss, 'Bloques'), ajW = L_aplicarBloque(L_ajustes(D_leer(ss, 'Ajustes')), bloques, S);
  var dp = L_filtrarSemana(D_leer(ss, 'Días plan'), S), entreno = L_diasEntreno(dp), objetivo = L_objetivo(ajW, entreno);
  var tDias = D_tabla(ss, 'Días'), dias = D_objetos(tDias, zona), idx = L_indiceDias(dias), dS = idx[S] || {};
  var hechos = L_diasHechos(dS, entreno, objetivo);
  var nombres = {}; D_leer(ss, 'Plan').forEach(function (p) { if (p.ejercicio_id) nombres[String(p.ejercicio_id)] = String(p.nombre || p.ejercicio_id); });
  var nomDia = {}; dp.forEach(function (d) { nomDia[String(d.dia)] = String(d.nombre || d.dia); });

  // Última vez que apuntó algo (Días, Registro, Extra, Pasos, Peso)
  var ult = '';
  var mirar = function (v) { v = String(v || '').slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= hoy && v > ult) ult = v; };
  dias.forEach(function (r) { mirar(r.actualizado); mirar(r.fin); mirar(r.inicio); });
  D_leerOpc(ss, 'Registro', zona).forEach(function (r) { mirar(r.actualizado); });
  D_leerOpc(ss, 'Extra', zona).forEach(function (r) { mirar(r.fecha); });
  D_leerOpc(ss, 'Pasos', zona).forEach(function (r) { mirar(r.fecha); });
  var peso = D_leerOpc(ss, 'Peso', zona); peso.forEach(function (r) { if (r.peso !== '') mirar(r.fecha); });
  var desde = ult || aj.fecha_inicio_semana1;
  if (finPausa && desde < finPausa) desde = finPausa;                                                    // los días de pausa no cuentan
  var sin = L_diasEntre(desde, hoy), noEntra = false;
  if (!ult && sin >= 3 && !finPausa) { noEntra = true; out.push({ clave: 'no_entra|nunca', tipo: 'no_entra', nivel: sin >= 7 ? 'rojo' : 'ambar', titulo: 'Todavía no ha apuntado nada en la app', detalle: 'Empezó el ' + AV_fecha(aj.fecha_inicio_semana1) + ' (' + sin + ' días).' }); }
  else if (sin >= 4 && (ult || finPausa)) { noEntra = true; out.push({ clave: 'no_entra|' + (ult || 'pausa') + '|' + desde, tipo: 'no_entra', nivel: sin >= 7 ? 'rojo' : 'ambar', titulo: 'No entra en la app desde hace ' + sin + ' días', detalle: (desde === finPausa ? 'Desde que acabó su pausa (' + AV_fecha(finPausa) + ').' : 'Lo último que apuntó fue el ' + AV_fecha(ult) + '.') }); }

  // Semana a medias
  if (!noEntra && hechos < objetivo) {
    var dsem = {}, todos = true;
    entreno.forEach(function (k) {
      var d = dp.filter(function (x) { return String(x.dia) === k; })[0] || {}, n = L_diaSemana(d.dia_semana).split(' o ')[0];
      var i = AV_DSEM.indexOf(n); if (i < 0) todos = false; else dsem[k] = i;
    });
    if (todos && entreno.length) {
      var tocaban = entreno.filter(function (k) { return dsem[k] < dHoy; }).sort(function (a, b) { return dsem[a] - dsem[b]; });
      var esperados = Math.min(tocaban.length, objetivo);
      if (hechos < esperados) {
        var faltan = tocaban.filter(function (k) { return !(dS[k] && dS[k].hecho); });
        out.push({ clave: 'semana|' + S + '|' + hechos + '|' + esperados, tipo: 'semana', nivel: esperados - hechos >= 2 ? 'rojo' : 'ambar',
          titulo: 'Semana a medias: lleva ' + hechos + ' de ' + objetivo,
          detalle: 'Por sus días ya tocaban ' + esperados + (faltan.length ? ' (sin hacer: ' + faltan.map(function (k) { return (nomDia[k] || k) + ', ' + AV_DSEM[dsem[k]]; }).join(' · ') + ')' : '') + '.' });
      }
    } else {
      var quedan = 7 - dHoy;   // hoy incluido
      if (objetivo - hechos > quedan) out.push({ clave: 'semana|' + S + '|' + hechos + '|' + quedan, tipo: 'semana', nivel: 'ambar',
        titulo: 'Semana a medias: lleva ' + hechos + ' de ' + objetivo,
        detalle: (quedan === 1 ? 'Queda 1 día' : 'Quedan ' + quedan + ' días') + ' de semana: ya no le da para todos. (Si pones en «Días plan» qué día hace cada entreno, este aviso afina más.)' });
    }
  }

  // Molestias
  var molAnt = {};
  [S - 1, S].forEach(function (w) {
    Object.keys(idx[w] || {}).forEach(function (k) {
      var m = idx[w][k].mol;
      Object.keys(m).forEach(function (id) {
        var v = m[id], nm = nombres[id] || id;
        if (w === S && v >= 6) out.push({ clave: 'molestia|' + w + '|' + k + '|' + id + '|' + v, tipo: 'molestia', nivel: 'rojo', titulo: 'Molestia de ' + v + '/10 en ' + nm, detalle: (nomDia[k] || k) + ' de la semana ' + w + '.' });
        if (v >= 4 && v <= 5) { if (w === S - 1) molAnt[id] = v; else if (molAnt[id]) out.push({ clave: 'molestia|' + w + '|' + id + '|seguida', tipo: 'molestia', nivel: 'ambar', titulo: 'Molestia de ' + v + '/10 en ' + nm + ' dos semanas seguidas', detalle: 'La semana pasada marcó ' + molAnt[id] + '/10.' }); }
      });
    });
  });
  D_leerOpc(ss, 'Molestias', zona).forEach(function (r) {
    var v = L_int(r.valor), f = String(r.fecha || '').slice(0, 10);
    if (v >= 4 && f && L_diasEntre(f, hoy) <= 7) out.push({ clave: 'molestia|libre|' + (r.uid || f + r.zona), tipo: 'molestia', nivel: v >= 6 ? 'rojo' : 'ambar', titulo: 'Avisa de una molestia: ' + (r.zona || 'sin zona') + ', ' + v + '/10', detalle: AV_fecha(f) + (r.texto ? ' · «' + String(r.texto).slice(0, 140) + '»' : '') });
  });

  // Entreno abierto (inicio sin fin, hace más de 2 horas y menos de 2 días)
  var ci = tDias.cab.indexOf('inicio'), cf = tDias.cab.indexOf('fin'), ch = tDias.cab.indexOf('hecho'), cs = tDias.cab.indexOf('semana'), cd = tDias.cab.indexOf('dia');
  if (ci >= 0) tDias.filas.forEach(function (f) {
    var ini = f[ci]; if (!(ini instanceof Date) || (cf >= 0 && f[cf] instanceof Date) || (ch >= 0 && L_bool(f[ch]))) return;
    var horas = (Date.now() - ini.getTime()) / 36e5;
    if (horas > 2 && horas < 48) out.push({ clave: 'abierto|' + f[cs] + '|' + f[cd], tipo: 'abierto', nivel: 'ambar', titulo: 'Entreno a medias: ' + (nomDia[String(f[cd])] || f[cd]), detalle: 'Lo empezó hace ' + Math.round(horas) + ' horas y no lo ha cerrado.' });
  });

  // Notas de «Algo que contarme»
  [S - 1, S].forEach(function (w) {
    Object.keys(idx[w] || {}).forEach(function (k) {
      var n = String(idx[w][k].nota || '').trim();
      if (n) out.push({ clave: 'nota|' + w + '|' + k + '|' + n.length, tipo: 'nota', nivel: 'ambar', titulo: 'Te ha dejado una nota', detalle: '«' + n.slice(0, 220) + (n.length > 220 ? '…' : '') + '» · ' + (nomDia[k] || k) + ', semana ' + w });
    });
  });

  // Peso del viernes (Alex 30/10; antes miércoles): vale el del jueves o el fin de semana
  if (aj.peso_frecuencia === 'semanal' && S >= aj.peso_desde_semana && dHoy >= 5) {
    var vie = L_sumarDias(lunes, 4);
    if (!peso.some(function (r) { return String(r.fecha).slice(0, 10) >= L_sumarDias(vie, -1) && r.peso !== ''; }))
      out.push({ clave: 'peso|' + vie, tipo: 'peso', nivel: 'ambar', titulo: 'No ha apuntado el peso del viernes', detalle: 'Viernes ' + AV_fecha(vie) + '.' });
  }
  // Fotos de control (cada 4 viernes) sin subir, desde el sábado
  var viC = pz && hoy >= aj.pausa_desde && hoy <= aj.pausa_hasta ? '' : L_viernesControl(S, hoy, lunes);
  if (viC && hoy > viC && L_diasEntre(viC, hoy) <= 8 && !D_leerOpc(ss, 'Fotos', zona).some(function (r) { return String(r.fecha).slice(0, 10) >= L_sumarDias(viC, -3); }))
    out.push({ clave: 'fotos|' + viC, tipo: 'peso', nivel: 'ambar', titulo: 'No ha subido las fotos de control', detalle: 'Tocaban el viernes ' + AV_fecha(viC) + '. La app se las recuerda cada 48 h.' });
  return out;
}
function AV_fecha(iso) { var p = String(iso).split('-'); return p.length === 3 ? (+p[2]) + '/' + (+p[1]) : String(iso); }


// ═════════ Entregas de los clientes (portada «Hoy», 24/10) ═════════
/*
 * Una fila por cosa que un cliente tiene que entregar: tipo = formulario (formulario = nombre de la pestaña de la hoja de
 * respuestas: «Primer mes», «Mensual», «Fin de bloque 3 meses», «Puesta al día»…), fotos, medidas o peso; desde = desde
 * cuándo toca. La lectura de las 6:00 las apunta (y Alex puede añadirlas). El panel mira solo si ya está hecho:
 *   formulario → una respuesta con su nombre en esa pestaña desde 3 días antes de «desde»;
 *   fotos / medidas / peso → una fila en esa pestaña de la hoja de su app con fecha desde 3 días antes.
 * Si está hecho, se marca hecha (como = auto). El semanal no va aquí (se mira el lunes en la Ronda).
 */
var EN_RESPUESTAS_ID = '1nAtltPRklp8lEi0UPR-08SHIX4n3poUWE2eVIjsmn6c';
function EN_norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim(); }
/** ¿El nombre de la respuesta es de este cliente? Todas las palabras de su nombre en el panel están en la respuesta */
function EN_esDe(nombreResp, nombreCli) {
  var r = EN_norm(nombreResp).split(' '), c = EN_norm(nombreCli).split(' ').filter(String);
  return c.length > 0 && c.every(function (w) { return r.indexOf(w) >= 0; });
}
function EN_cargar() {
  var hoy = P_hoy(), filas = P_leer('Entregas').filter(function (e) { return !e.archivado && (e.estado || 'pendiente') === 'pendiente' && (!e.desde || e.desde <= hoy); });
  if (!filas.length) return { entregas: [], hoy: hoy };
  var clientes = {}; P_leer('Clientes').forEach(function (c) { clientes[c.id] = c; });
  var hojas = {}; try { D_leer(SpreadsheetApp.openById(MAESTRA_ID), 'Registro clientes').forEach(function (r) { if (r.codigo && r.hoja_datos_id) hojas[String(r.codigo).trim()] = String(r.hoja_datos_id).trim(); }); } catch (e) {}
  var resp = null, cacheResp = {}, cacheApp = {};
  var respuestas = function (pest) {
    if (cacheResp[pest]) return cacheResp[pest];
    resp = resp || SpreadsheetApp.openById(EN_RESPUESTAS_ID);
    var sh = resp.getSheetByName(pest), out = [];
    if (sh) { var v = sh.getDataRange().getValues(); for (var i = 1; i < v.length; i++) if (v[i][0] instanceof Date) out.push({ t: v[i][0].getTime(), n: String(v[i][1] || '') }); }
    return (cacheResp[pest] = out);
  };
  var app = function (codigo, pest) {
    var k = codigo + '|' + pest; if (cacheApp[k]) return cacheApp[k];
    var out = [];
    try { if (hojas[codigo]) out = D_leerOpc(SpreadsheetApp.openById(hojas[codigo]), pest).map(function (r) { return String(r.fecha || '').slice(0, 10); }).filter(String); } catch (e) {}
    return (cacheApp[k] = out);
  };
  var out = [];
  filas.forEach(function (e) {
    var c = clientes[e.cliente_id] || {}, nombre = c.nombre || e.cliente, desde = e.desde || hoy, margen = P_sumarDias(desde, -3), hecha = '';
    try {
      if (e.tipo === 'formulario' && e.formulario) {
        var lim = new Date(margen + 'T00:00:00Z').getTime();
        respuestas(e.formulario).forEach(function (r) { if (!hecha && r.t >= lim && EN_esDe(r.n, nombre)) hecha = Utilities.formatDate(new Date(r.t), P_ZONA, 'yyyy-MM-dd'); });
      } else if (['fotos', 'medidas', 'peso'].indexOf(e.tipo) >= 0) {
        var codigo = String(e.codigo_app || c.codigo_app || '').trim();
        if (codigo) app(codigo, { fotos: 'Fotos', medidas: 'Medidas', peso: 'Peso' }[e.tipo]).forEach(function (f) { if (!hecha && f >= margen) hecha = f; });
      }
    } catch (x) {}
    if (hecha) { P_escribir(function () { P_guardar('Entregas', e.id, { estado: 'hecha', hecha_el: hecha, como: 'auto' }); }); return; }
    out.push({ id: e.id, cliente_id: e.cliente_id, cliente: nombre, telefono: c.telefono || '', tipo: e.tipo, formulario: e.formulario, desde: desde,
      dias: Math.round((Date.parse(hoy) - Date.parse(desde)) / 864e5), notas: e.notas || '' });
  });
  var peso = { formulario: 0, fotos: 1, medidas: 2, peso: 3 };
  out.sort(function (a, b) { return (peso[a.tipo] || 9) - (peso[b.tipo] || 9) || b.dias - a.dias; });
  return { entregas: out, hoy: hoy };
}

// ═════════ Formularios de un cliente (para consultarlos en el panel y comparar «antes y ahora») ═════════
/** Nombre limpio de cada pestaña de la hoja de respuestas */
function FO_tipo(t) {
  t = String(t || '');
  if (/^Respuestas de formulario/i.test(t)) return 'Fin de programa';
  return t.replace(/\s*\(antigua \d+\)\s*$/i, '').trim();
}
function FO_fecha(v) {
  if (v instanceof Date) return Utilities.formatDate(v, P_ZONA, "yyyy-MM-dd'T'HH:mm");
  var m = String(v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return String(v || '');
  var z = function (n) { return ('0' + n).slice(-2); };
  return m[3] + '-' + z(m[2]) + '-' + z(m[1]) + (m[4] ? 'T' + z(m[4]) + ':' + m[5] : '');
}
/** Todas las respuestas de un cliente, de la más reciente a la más antigua: [{tipo, fecha, qa:[[pregunta, respuesta]]}] */
function FO_cliente(cid, nombre) {
  var c = cid ? P_leer('Clientes').filter(function (x) { return x.id === cid; })[0] : null;
  var nom = String((c && c.nombre) || nombre || '').trim();
  if (!nom) throw new Error('Falta el nombre del cliente');
  var libro = SpreadsheetApp.openById(EN_RESPUESTAS_ID), out = [];
  libro.getSheets().forEach(function (sh) {
    var tab = sh.getName(); if (/^enlaces$/i.test(tab)) return;
    var n = sh.getLastRow(), m = sh.getLastColumn(); if (n < 2 || m < 2) return;
    var v = sh.getRange(1, 1, n, m).getDisplayValues(), cab = v[0].map(function (h) { return String(h).trim(); });
    var iN = cab.indexOf('Tu nombre y apellidos'); if (iN < 0) iN = 1;
    for (var i = 1; i < v.length; i++) {
      if (!EN_esDe(v[i][iN], nom)) continue;
      var qa = [];
      for (var j = 0; j < cab.length; j++) { if (j === 0 || j === iN || !cab[j]) continue; var r = String(v[i][j] || '').trim(); if (r) qa.push([cab[j], r]); }
      out.push({ tipo: FO_tipo(tab), fecha: FO_fecha(v[i][0]), qa: qa });
    }
  });
  out.sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
  return { cliente: nom, formularios: out };
}

// ═════════ Fotos de progreso de un cliente (las de la app y las de su carpeta de Drive), para compararlas en el panel ═════════
var FT_TIPOS = { frente: 'frente', lado: 'lado', perfil: 'lado', espalda: 'espalda', detras: 'espalda', 'detrás': 'espalda' };
function FT_lista(cid) {
  var c = P_leer('Clientes').filter(function (x) { return x.id === cid; })[0];
  if (!c) throw new Error('No encuentro ese cliente');
  var out = [], vistos = {}, carpetas = [];
  // 1. Las que sube en la app (pestaña Fotos de su hoja, con miniatura)
  if (c.codigo_app) {
    try {
      var reg = D_leer(SpreadsheetApp.openById(MAESTRA_ID), 'Registro clientes').filter(function (r) { return String(r.codigo).trim() === String(c.codigo_app).trim(); })[0];
      if (reg && reg.hoja_datos_id) {
        var ss = SpreadsheetApp.openById(String(reg.hoja_datos_id).trim());
        var sh = ss.getSheetByName('Fotos');
        if (sh && sh.getLastRow() > 1) {
          var v = sh.getDataRange().getValues(), cab = v[0].map(String);
          for (var i = 1; i < v.length; i++) {
            var o = {}; cab.forEach(function (h, j) { o[h] = v[i][j]; });
            if (!o.archivo_id) continue;
            vistos[String(o.archivo_id)] = 1;
            out.push({ id: String(o.archivo_id), fecha: o.fecha instanceof Date ? Utilities.formatDate(o.fecha, P_ZONA, 'yyyy-MM-dd') : String(o.fecha).slice(0, 10), tipo: String(o.tipo || ''), mini: String(o.mini || ''), de: 'app' });
          }
        }
        try { D_leer(ss, 'Ajustes').forEach(function (f) { if (f.clave === 'carpeta_fotos' && f.valor) carpetas.push(String(f.valor).trim()); }); } catch (e) {}
      }
    } catch (e) { console.error('fotos app: ' + e); }
  }
  // 2. Las de su carpeta «Fotos de progreso» de Drive (las que manda por otros medios)
  if (c.carpeta_fotos) carpetas.push(String(c.carpeta_fotos).trim());
  carpetas.filter(function (x, i, a) { return x && a.indexOf(x) === i; }).forEach(function (id) {
    try {
      var it = DriveApp.getFolderById(id).getFiles(), n = 0;
      while (it.hasNext() && n < 80) {
        var f = it.next(); if (vistos[f.getId()] || !/^image\//.test(f.getMimeType())) continue; n++;
        var nom = f.getName(), m = nom.match(/(\d{4})-(\d{2})-(\d{2})/), tipo = '';
        Object.keys(FT_TIPOS).some(function (k) { if (new RegExp(k, 'i').test(nom)) { tipo = FT_TIPOS[k]; return true; } return false; });
        var mini = ''; try { var th = f.getThumbnail(); if (th) mini = Utilities.base64Encode(th.getBytes()); } catch (e2) {}
        out.push({ id: f.getId(), fecha: m ? m[1] + '-' + m[2] + '-' + m[3] : Utilities.formatDate(f.getDateCreated(), P_ZONA, 'yyyy-MM-dd'), tipo: tipo, mini: mini, de: 'drive', nombre: nom });
      }
    } catch (e) { console.error('fotos carpeta ' + id + ': ' + e); }
  });
  // 3. Recortes guardados desde el panel
  try {
    var aj = {}; P_leer('FotosAjuste').forEach(function (r) { if (!r.archivado && r.cliente_id === cid) aj[r.foto_id] = r; });
    out.forEach(function (f) { var r = aj[f.id]; if (r) f.aj = { fa_id: r.id, z: r.z, x: r.x, y: r.y, cara: r.cara, tipo: r.tipo, luz: r.luz }; });
  } catch (e) { console.error('ajustes fotos: ' + e); }
  out.sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)) || String(a.tipo).localeCompare(String(b.tipo)); });
  return { cliente: c.nombre, fotos: out };
}
/** La foto entera (solo imágenes); la entrega el Worker en /panel/foto */
function FT_archivo(id) {
  var f = DriveApp.getFileById(String(id || ''));
  if (!/^image\//.test(f.getMimeType())) throw new Error('No es una imagen');
  return { tipo: f.getMimeType(), b64: Utilities.base64Encode(f.getBlob().getBytes()) };
}



// ═════════ Su entreno (ficha del panel): plan visual + datos de todas las semanas (25/10) ═════════
function EC_cliente(cid) {
  var cl = P_leer('Clientes').filter(function (c) { return c.id === cid; })[0];
  if (!cl || !cl.codigo_app) return { sinApp: true };
  var cli = D_cliente(String(cl.codigo_app).trim()); if (!cli) return { sinApp: true };
  var D = S_cargar(cli), ss = SpreadsheetApp.openById(cli.hoja), zona = D.zona;
  var dias = D_leer(ss, 'Días', zona).map(function (f) {
    return { w: L_int(f.semana), k: String(f.dia || ''), hecho: L_bool(f.hecho), flojo: L_bool(f.flojo), sens: L_int(f.sensacion) || null, nota: String(f.nota || ''),
      mol: L_leerMol(f.molestia), molDet: L_json(f.molestia_detalle) || {}, en: L_int(f.energia) || null, min: L_int(f.min_entreno) || null,
      fecha: String(f.fecha || f.fin || '').slice(0, 10), sust: String(f.sustituye || '') };
  }).filter(function (x) { return x.w && x.k; });
  var mols = []; try { mols = D_leerOpc(ss, 'Molestias', zona).slice(-40); } catch (e) {}
  return { D: { nombre: D.nombre, semana: D.semana, bloque: D.bloque, orden: D.orden, dias: D.dias, hist: D.hist, progreso: D.progreso, entreno: D.entreno, objetivo: D.objetivo }, dias: dias, molestias: mols };
}


// ═════════ Su camino (ficha del panel): bloques y sub-bloques encadenados, qué cambia y por qué (25/10) ═════════
function EV_cliente(cid) {
  var ec = EC_cliente(cid); if (ec.sinApp) return ec;
  var cl = P_leer('Clientes').filter(function (c) { return c.id === cid; })[0];
  var cli = D_cliente(String(cl.codigo_app).trim()), ss = SpreadsheetApp.openById(cli.hoja);
  var txt = function (v) { return v === null || v === undefined ? '' : String(v).trim(); };
  var plan = D_leer(ss, 'Plan').map(function (p) {
    return { dia: txt(p.dia), orden: L_int(p.orden) || 0, id: txt(p.ejercicio_id), nm: txt(p.nombre), g: txt(p.grupo), sr0: L_int(p.series) || 3, rp0: txt(p.repes), ds: txt(p.descanso),
      s: L_bool(p.principal), img: txt(p.imagen_id), fam: txt(p.familia), d: L_int(p.semana_desde || p.desde_semana), h: L_int(p.semana_hasta || p.hasta_semana),
      motivo: txt(p.motivo), tq: txt(p.tranquilo), alt: txt(p.alternativa), ad: txt(p.adaptado) };
  }).filter(function (p) { return p.dia && p.id; });
  var aj = {}; D_leer(ss, 'Ajustes').forEach(function (f) { if (f.clave) aj[String(f.clave).trim()] = txt(f.valor); });
  var bloques = D_leerOpc(ss, 'Bloques').map(function (b) { return { d: L_int(b.semana_desde || b.desde_semana), h: L_int(b.semana_hasta || b.hasta_semana), bloque: txt(b.bloque), objetivo: txt(b.objetivo),
    foco: txt(b.foco_tecnico), sig: txt(b.siguiente_bloque), sigTxt: txt(b.siguiente_bloque_texto), dias: L_int(b.dias_semana) }; }).filter(function (b) { return b.d || b.bloque; });
  var diasPlan = D_leer(ss, 'Días plan').map(function (f) { return { k: txt(f.dia), n: txt(f.nombre), t: txt(f.titulo), d: L_int(f.semana_desde), h: L_int(f.semana_hasta) }; }).filter(function (f) { return f.k; });
  ec.camino = { plan: plan, prog: L_progresion(D_leerOpc(ss, 'Progresión')), bloques: bloques, diasPlan: diasPlan,
    aj: { semana: L_int(aj.semana) || 1, bloque: aj.bloque || '', objetivo: aj.objetivo || '', porque: aj.porque || '', sig: aj.siguiente_bloque || '', sigTxt: aj.siguiente_bloque_texto || '', inicio: aj.fecha_inicio_semana1 || '', foco: aj.foco_tecnico || '' } };
  return ec;
}

// ═════════ Calendario de un cliente (Alex 30/10): qué hizo cada día del mes ═════════
/*
 * Devuelve todo lo fechado de su hoja de la app (pocas filas: cabe entero) y el panel pinta el mes:
 *   entrenos [{fecha, w, k, hecho, flojo}], peso [{fecha, peso}], medidas [fecha], fotos [fecha], extras [{fecha, tipo, min}],
 *   semanas: lunes de cada semana del programa con su objetivo y lo hecho, desde la primera semana en la app hasta la actual.
 * Un día que tocaba y no se hizo solo se marca si ese día tiene «día de la semana» en Días plan; si no, la semana dice «2 de 3».
 */
function CA_cliente(cid, fresco) {
  var cc = CacheService.getScriptCache(), ck = 'ca2_' + cid; if (!fresco) { var ch = cc.get(ck); if (ch) return JSON.parse(ch); }
  var cl = P_leer('Clientes').filter(function (c) { return c.id === cid; })[0];
  if (!cl || !cl.codigo_app) return { sinApp: true };
  var cli = D_cliente(String(cl.codigo_app).trim()); if (!cli) return { sinApp: true };
  // Solo las pestañas que hacen falta (antes, S_cargar leía unas 20 y tardaba 10-15 s)
  var ss = SpreadsheetApp.openById(cli.hoja), aj = L_ajustes(D_leer(ss, 'Ajustes')), zona = D_zonaOk(aj.zona_movil) || D_zonaOk(aj.zona) || P_ZONA;
  var S = Math.max(aj.semana, L_semanaPrograma(aj, D_diaSemanal()) || 0), diasCrudo = D_leer(ss, 'Días', zona), reg = D_leer(ss, 'Registro', zona);
  var dpS = L_filtrarSemana(D_leer(ss, 'Días plan'), S), entrenoS = L_diasEntreno(dpS), objetivoS = L_objetivo(L_aplicarBloque(L_ajustes(D_leer(ss, 'Ajustes')), D_leerOpc(ss, 'Bloques'), S), entrenoS);
  var D = { semana: S, objetivo: objetivoS, hoy: D_hoyEn(zona), desdeApp: L_primeraSemana(L_indiceDias(diasCrudo), reg, aj, S) };
  var f10 = function (v) { var t = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''; };
  var entrenos = diasCrudo.map(function (f) {
    return { fecha: f10(f.fecha) || (L_bool(f.hecho) ? f10(f.fin) || f10(f.actualizado) : ''), w: L_int(f.semana), k: String(f.dia || ''), hecho: L_bool(f.hecho), flojo: L_bool(f.flojo) };
  }).filter(function (x) { return x.w && x.k && (x.hecho || x.flojo); });
  var peso = D_leerOpc(ss, 'Peso', zona).map(function (f) { return { fecha: f10(f.fecha), peso: f.peso }; }).filter(function (x) { return x.fecha; });
  var medFilas = D_leerOpc(ss, 'Medidas', zona).filter(function (f) { return f10(f.fecha); }).sort(function (a, b) { return f10(a.fecha) < f10(b.fecha) ? -1 : 1; });
  var medidas = medFilas.map(function (f) { return f10(f.fecha); });
  var medVal = function (f) { var o = { fecha: f10(f.fecha) }; MEDIDAS.forEach(function (m) { var v = L_num(f[m]); if (v !== '') o[m] = +v; }); return o; };
  var medUlt = medFilas.slice(-2).map(medVal), medPrim = medFilas.length ? medVal(medFilas[0]) : null;
  var fotosCrudo = D_leerOpc(ss, 'Fotos', zona), pesoCrudo = D_leerOpc(ss, 'Peso', zona);
  var fotos = fotosCrudo.map(function (f) { return f10(f.fecha); }).filter(String);
  var extras = D_leerOpc(ss, 'Extra', zona).map(function (f) { return { fecha: f10(f.fecha), tipo: String(f.tipo || ''), min: L_int(f.minutos) || 0 }; }).filter(function (x) { return x.fecha; });
  var semanas = [], desde = D.desdeApp || 1;
  for (var w = desde; w <= D.semana; w++) {
    var lun = L_lunesPrograma(aj, w); if (!lun) break;
    var hechos = {}; entrenos.forEach(function (e) { if (e.w === w && e.hecho) hechos[e.k] = 1; });
    semanas.push({ w: w, lunes: lun, objetivo: D.objetivo, hechos: Object.keys(hechos).length });
  }
  var dias = {}; dpS.forEach(function (d) { var k = String(d.dia || ''); if (k && k !== 'st' && k !== 'casa') dias[k] = { n: String(d.nombre || ''), ds: L_diaSemana(d.dia_semana) }; });
  // Troncales (principal en su Plan): la mejor serie de cada semana y si toca subir (todas las series de la última semana, con su peso más alto, en el tope del rango)
  var troncales = [], vistoT = {};
  D_leer(ss, 'Plan').forEach(function (p) {
    var id = String(p.ejercicio_id || '').trim(); if (!id || vistoT[id] || !L_bool(p.principal)) return; vistoT[id] = 1;
    var nums = String(p.repes || '').match(/\d+/g), tope = nums ? Math.max.apply(null, nums.map(Number)) : 0, porW = {};
    reg.forEach(function (r) { var kg = L_num(r.peso), re = L_int(r.repes), w = L_int(r.semana); if (String(r.ejercicio_id) !== id || !w || kg === '' || !re) return; (porW[w] = porW[w] || []).push({ kg: +kg, re: re }); });
    var serie = Object.keys(porW).map(Number).sort(function (a, b) { return a - b; }).map(function (w) { var m = porW[w].reduce(function (a, b) { return b.kg > a.kg || (b.kg === a.kg && b.re > a.re) ? b : a; }); return { w: w, kg: m.kg, re: m.re }; });
    if (!serie.length) return;
    var u = serie[serie.length - 1], deU = porW[u.w].filter(function (x) { return x.kg === u.kg; });
    troncales.push({ id: id, nm: String(p.nombre || id), rango: String(p.repes || ''), serie: serie, subir: !!tope && deU.every(function (x) { return x.re >= tope; }) });
  });
  var acceso = { candado: !!aj.candado, desbloqueado: !!aj.desbloqueado, plan_ok: aj.plan_ok || '', cerrado: L_candado(aj, fotosCrudo, pesoCrudo, S) };
  var res = { medUlt: medUlt, medPrim: medPrim, troncales: troncales, acceso: acceso, nombre: aj.nombre, semana: D.semana, desde: desde, hoy: D.hoy || P_hoy(), entrenos: entrenos, peso: peso, medidas: medidas, fotos: fotos, extras: extras, semanas: semanas, dias: dias };
  try { cc.put(ck, JSON.stringify(res), 300); } catch (e) {}
  return res;
}

// ═════════ Correcciones de vídeos desde el panel (Alex 30/10) ═════════
/*
 * Reportes › Vídeos: quién ha grabado (maestra › Vídeos pedidos › grabado), Alex pega el enlace de Cap y la transcripción,
 * la IA del worker prepara el mensaje (aplauso → enlace → resumen → vídeos de la semana) y, al guardar:
 *   · hoja del cliente › Correcciones: una fila por ejercicio (fecha · ejercicio_id · texto · estado activa); las que ya hace bien, superada;
 *   · maestra › Vídeos pedidos: los de la semana (desde hoy hasta el martes siguiente) con como_grabar;
 *   · panel › Aplicados: una fila «correccion» con el enlace y el mensaje, para que el Proyecto lo pase a sus documentos.
 * Solo eso: el resto de las hojas no se toca. Nada se envía al cliente: Alex lo abre en WhatsApp y lo manda él.
 */
var CV_COLS = ['fecha', 'ejercicio_id', 'texto', 'estado', 'mostrar_hasta', 'superada_el', 'resumen'];
function CV_f(v) { if (v instanceof Date) return Utilities.formatDate(v, P_ZONA, 'yyyy-MM-dd'); var t = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''; }
function CV_martes(hoy) {   // martes siguiente (si hoy es martes, el de la semana que viene)
  var p = hoy.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])), w = d.getUTCDay(), n = (2 - w + 7) % 7 || 7;
  return P_sumarDias(hoy, n);
}
function CV_cargar() {
  var hoy = P_hoy(), hace = P_sumarDias(hoy, -14);
  var porCod = {};
  D_leer(SpreadsheetApp.openById(MAESTRA_ID), 'Vídeos pedidos').forEach(function (v) {
    var c = String(v.codigo || '').trim(); if (!c) return;
    var x = { ejercicio_id: String(v.ejercicio_id || ''), indicacion: String(v.indicacion || ''), desde: CV_f(v.desde), hasta: CV_f(v.hasta), grabado: CV_f(v.grabado) };
    if ((x.grabado && x.grabado >= hace) || (!x.hasta || x.hasta >= hoy)) (porCod[c] = porCod[c] || []).push(x);
  });
  var clientes = P_leer('Clientes').filter(function (c) { return !c.archivado && c.estado === 'Activo' && c.codigo_app; }).map(function (c) {
    var vs = porCod[String(c.codigo_app).trim()] || [];
    return { id: c.id, nombre: c.nombre, telefono: c.telefono || '', codigo_app: c.codigo_app, videos: vs,
      grabados: vs.filter(function (v) { return v.grabado; }).length, pedidos: vs.filter(function (v) { return !v.grabado && (!v.hasta || v.hasta >= hoy); }).length };
  });
  clientes.sort(function (a, b) { return (b.grabados - a.grabados) || String(a.nombre).localeCompare(String(b.nombre)); });
  return { hoy: hoy, martes: CV_martes(hoy), clientes: clientes };
}
function CV_hojaDe(cid) {
  var cl = P_leer('Clientes').filter(function (c) { return c.id === cid; })[0];
  if (!cl || !cl.codigo_app) throw new Error('Ese cliente no tiene la app');
  var cli = D_cliente(String(cl.codigo_app).trim()); if (!cli) throw new Error('No encuentro su hoja de la app');
  return { cl: cl, cli: cli, ss: SpreadsheetApp.openById(cli.hoja) };
}
function CV_cliente(cid) {
  var h = CV_hojaDe(cid), vistos = {}, ejercicios = [];
  D_leer(h.ss, 'Plan').forEach(function (p) { var id = String(p.ejercicio_id || '').trim(); if (id && !vistos[id]) { vistos[id] = 1; ejercicios.push({ id: id, nombre: String(p.nombre || id), dia: String(p.dia || ''), principal: L_bool(p.principal) }); } });
  var corr = D_leerOpc(h.ss, 'Correcciones').map(function (f) { return { fecha: CV_f(f.fecha), ejercicio_id: String(f.ejercicio_id || ''), texto: String(f.texto || ''), estado: String(f.estado || ''), superada_el: CV_f(f.superada_el) }; })
    .filter(function (f) { return f.ejercicio_id && f.texto; });
  var reg = {}; try { D_leer(h.ss, 'Registro').forEach(function (r) { var id = String(r.ejercicio_id || ''); if (id && r.peso !== '' && r.peso != null) reg[id] = { semana: L_int(r.semana), peso: r.peso, repes: r.repes }; }); } catch (e) {}
  var ronda = P_leer('Ronda').filter(function (r) { return r.cliente_id === cid && r.voz; }).pop();
  return { cliente: h.cl.nombre, telefono: h.cl.telefono || '', ejercicios: ejercicios, correcciones: corr.slice(-30), ultimoPeso: reg, voz: ronda ? ronda.voz : '' };
}
function CV_guardar(d) {
  var h = CV_hojaDe(d.cliente_id), hoy = P_hoy(), codigo = String(h.cl.codigo_app).trim();
  var ids = {}; D_leer(h.ss, 'Plan').forEach(function (p) { if (p.ejercicio_id) ids[String(p.ejercicio_id).trim()] = 1; });
  var limpio = function (lista) { return (lista || []).filter(function (x) { return x && ids[String(x.ejercicio_id || '').trim()]; }); };
  var corr = limpio(d.correcciones).filter(function (x) { return String(x.texto || '').trim(); }), vids = limpio(d.videos), sup = (d.superar || []).filter(function (id) { return ids[id]; });
  // Correcciones en su hoja
  var sh = h.ss.getSheetByName('Correcciones');
  if (!sh) { sh = h.ss.insertSheet('Correcciones'); sh.getRange(1, 1, 1, CV_COLS.length).setValues([CV_COLS]); sh.setFrozenRows(1); }
  var t = D_tabla(h.ss, 'Correcciones'); D_asegurarCols(t, []);
  CV_COLS.forEach(function (c) { if (t.cab.indexOf(c) < 0) { t.sh.getRange(1, t.cab.length + 1).setValue(c); t.cab.push(c); t.filas.forEach(function (f) { f.push(''); }); } });   // hojas antiguas: solo se añade
  var ix = function (c) { return t.cab.indexOf(c); };
  sup.forEach(function (id) {
    t.filas.forEach(function (f, i) {
      if (String(f[ix('ejercicio_id')]) !== id || /superad/i.test(String(f[ix('estado')]))) return;
      t.sh.getRange(i + 2, ix('estado') + 1).setValue('superada');
      t.sh.getRange(i + 2, ix('superada_el') + 1).setValue(hoy);
    });
  });
  corr.forEach(function (x) {
    var fila = t.cab.map(function (c) { return c === 'fecha' ? hoy : c === 'ejercicio_id' ? String(x.ejercicio_id).trim() : c === 'texto' ? String(x.texto).trim().slice(0, 600) : c === 'estado' ? 'activa' : c === 'resumen' ? String(x.resumen || '').slice(0, 300) : ''; });
    t.sh.appendRow(fila);
  });
  // Vídeos de la semana en la maestra
  if (vids.length) {
    var tv = D_tabla(SpreadsheetApp.openById(MAESTRA_ID), 'Vídeos pedidos'), hasta = CV_martes(hoy);
    vids.forEach(function (v) {
      tv.sh.appendRow(tv.cab.map(function (c) { return c === 'codigo' ? codigo : c === 'ejercicio_id' ? String(v.ejercicio_id).trim() : c === 'indicacion' ? String(v.indicacion || '').slice(0, 300) : c === 'desde' ? hoy : c === 'hasta' ? hasta : c === 'como_grabar' ? String(v.como_grabar || '').slice(0, 300) : ''; }));
    });
  }
  try { D_cacheFuera(codigo); } catch (e) {}
  P_nuevo('Aplicados', { fecha: P_ahora(), cliente: h.cl.nombre, codigo_app: codigo, tipo: 'correccion',
    detalle: JSON.stringify({ cap: String(d.cap || ''), mensaje: String(d.mensaje || '').slice(0, 4000), correcciones: corr, superadas: sup, videos: vids }).slice(0, 4900), resultado: 'guardado', pasado_a_docs: '' });
  return { correcciones: corr.length, superadas: sup.length, videos: vids.length, hasta: vids.length ? CV_martes(hoy) : '' };
}

// ═════════ Acceso a la app de un cliente nuevo (Alex 30/10) ═════════
/* Ajustes de su hoja: candado (TRUE = entreno y alimentación cerrados hasta fotos + peso + plan_ok), plan_ok (fecha del OK de Alex)
   y desbloqueado (TRUE = abierto ya, pase lo que pase). Devuelve su calendario con el estado nuevo. */
function AC_cambiar(cid, que) {
  var h = CV_hojaDe(cid), hoy = P_hoy();
  var c = { candado: { candado: 'TRUE', desbloqueado: '' }, plan_ok: { plan_ok: hoy }, desbloquear: { desbloqueado: 'TRUE' }, quitar: { candado: '', desbloqueado: '' } }[que];
  if (!c) throw new Error('Acción no válida');
  Object.keys(c).forEach(function (k) { R_ajuste(h.ss, k, c[k]); });
  try { D_cacheFuera(String(h.cl.codigo_app).trim()); } catch (e) {}
}

// ═════════ Renovaciones (Alex 30/10) ═════════
/* Renueva: alarga «fin» desde donde acabe, crea sus cobros y apunta la fila. No renueva: solo la fila (el estado lo cambia Alex). */
function RN_guardar(d) {
  var cl = P_leer('Clientes').filter(function (c) { return c.id === d.cliente_id; })[0]; if (!cl) throw new Error('No encuentro ese cliente');
  if (d.resultado === 'no') return { renovacion: P_nuevo('Renovaciones', { fecha: P_hoy(), cliente_id: cl.id, cliente: cl.nombre, resultado: 'no', notas: String(d.notas || '') }) };
  var meses = parseInt(d.meses, 10), precio = P_num(d.precio), n = parseInt(d.cuotas, 10) || 1, primero = R_fechaOk(d.primero || P_hoy());
  if (!(meses > 0)) throw new Error('Falta la duración'); if (!(precio > 0)) throw new Error('Falta el precio'); if (n < 1 || n > 24) throw new Error('Cuotas no válidas');
  var base = /^\d{4}-\d{2}-\d{2}$/.test(cl.fin) && cl.fin > P_hoy() ? cl.fin : P_hoy(), fin = LL_sumarMeses(base, meses), cents = Math.round(precio * 100), cuota = Math.floor(cents / n), cobros = [];
  for (var i = 0; i < n; i++) cobros.push(P_nuevo('Cobros', { fecha: LL_sumarMeses(primero, i), cliente_id: cl.id, cliente: cl.nombre, concepto: 'Renovación ' + meses + ' meses' + (n > 1 ? ' · cuota ' + (i + 1) + '/' + n : ''),
    importe: String((i === n - 1 ? cents - cuota * (n - 1) : cuota) / 100), estado: 'Pendiente', ultimo: i === n - 1 ? 'Sí' : '', metodo: String(d.metodo || cl.metodo || '') }));
  return { cliente: P_guardar('Clientes', cl.id, { fin: fin, estado: 'Activo' }), cobros: cobros, renovacion: P_nuevo('Renovaciones', { fecha: P_hoy(), cliente_id: cl.id, cliente: cl.nombre, resultado: 'renueva', meses: String(meses), precio: String(precio) }) };
}

// ═════════ Copia de seguridad (Alex 30/10) ═════════
/* Copia en Drive la hoja del panel, la maestra y las hojas de los clientes activos en una carpeta con la fecha; guarda 8 semanas (las viejas, a la papelera). */
var CO_CARPETA = 'Copias de seguridad · App y panel';
function CO_copia() {
  var ini = Date.now(), nombre = (typeof ES_BETA !== 'undefined' && ES_BETA ? 'BETA · ' : '') + CO_CARPETA, it = DriveApp.getFoldersByName(nombre), raiz = it.hasNext() ? it.next() : DriveApp.createFolder(nombre);
  var hoy = P_hoy(), dest = raiz.createFolder(hoy), ids = [[PANEL_HOJA_ID, 'Panel Alex – datos'], [MAESTRA_ID, 'App entrenos – maestra']], hechas = 0, fallos = [];
  D_leer(SpreadsheetApp.openById(MAESTRA_ID), 'Registro clientes').forEach(function (f) { if (L_bool(f.activa) && f.hoja_datos_id && f.hoja_datos_id !== 'PENDIENTE') ids.push([String(f.hoja_datos_id).trim(), 'App · ' + (f.nombre || f.codigo)]); });
  ids.forEach(function (x) {
    if (Date.now() - ini > 300000) { fallos.push(x[1] + ' (sin tiempo)'); return; }
    try { DriveApp.getFileById(x[0]).makeCopy(x[1] + ' · ' + hoy, dest); hechas++; } catch (e) { fallos.push(x[1]); }
  });
  var limite = P_sumarDias(hoy, -56), sub = raiz.getFolders();
  while (sub.hasNext()) { var c = sub.next(); if (/^\d{4}-\d{2}-\d{2}$/.test(c.getName()) && c.getName() < limite) c.setTrashed(true); }
  P_guardar('Config', 'copia_ultima', { valor: hoy + ' · ' + hechas + ' hojas' + (fallos.length ? ' · falló: ' + fallos.join(', ') : '') });
  return { fecha: hoy, hechas: hechas, fallos: fallos, url: dest.getUrl() };
}
function copiaSemanal() { CO_copia(); }
function CO_programar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'copiaSemanal') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('copiaSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
  P_guardar('Config', 'copia_programada', { valor: P_hoy() });
  return { ok: true };
}

/* Nutrición (Alex 30/10): enlazar su PDF de Drive desde el panel. Comprueba que se puede abrir antes de guardarlo; así se habilita en su app */
function AC_nutri(cid, url) {
  var h = CV_hojaDe(cid), m = String(url || '').match(/[-\w]{25,}/); if (!m) throw new Error('Ese enlace no parece de Drive');
  var f; try { f = DriveApp.getFileById(m[0]); } catch (e) { throw new Error('No puedo abrir ese archivo con tu cuenta de Drive'); }
  R_ajuste(h.ss, 'nutricion_pdf', m[0]); R_ajuste(h.ss, 'nutricion_fecha', P_hoy());
  try { D_cacheFuera(String(h.cl.codigo_app).trim()); } catch (e) {}
  return { nombre: f.getName(), fecha: P_hoy() };
}
