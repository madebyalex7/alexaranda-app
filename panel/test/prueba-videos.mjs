// Prueba de las correcciones de vídeo (Panel.gs › CV_*) con Code.gs real contra hojas simuladas: qué se escribe y dónde.
// Uso: node panel/test/prueba-videos.mjs
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import assert from 'node:assert';
const DIR = path.dirname(new URL(import.meta.url).pathname);
function hoja(nombre, filas) {
  const data = filas.map(r => r.slice());
  return { data, getName: () => nombre, getLastRow: () => data.length, getLastColumn: () => data.reduce((m, r) => Math.max(m, r.length), 0), getMaxRows: () => 1000, getMaxColumns: () => 40,
    setFrozenRows() {}, appendRow(r) { data.push(r.slice()); },
    getDataRange() { return this.getRange(1, 1, Math.max(data.length, 1), Math.max(this.getLastColumn(), 1)); },
    getRange(r, c, nr = 1, nc = 1) { return {
      getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (data[r - 1 + i] || [])[c - 1 + j]; row.push(v == null ? '' : v); } o.push(row); } return o; },
      setValues(v) { for (let i = 0; i < nr; i++) { while (data.length < r + i) data.push([]); for (let j = 0; j < nc; j++) data[r - 1 + i][c - 1 + j] = v[i][j]; } return this; },
      setValue(x) { while (data.length < r) data.push([]); data[r - 1][c - 1] = x; return this; },
      setNumberFormat() { return this; }, setFontWeight() { return this; } }; } };
}
function libro(pest) { const sh = {}; for (const [n, f] of Object.entries(pest)) sh[n] = hoja(n, f);
  return { sh, getSheetByName: n => sh[n] || null, insertSheet: n => (sh[n] = hoja(n, [])), getSpreadsheetTimeZone: () => 'Europe/Madrid' }; }
const PANEL = libro({ Clientes: [['id', 'nombre', 'telefono', 'codigo_app', 'estado', 'archivado'], ['c1', 'Sole', '600111222', 'SOLE-1', 'Activo', ''], ['c2', 'Sin app', '', '', 'Activo', '']],
  Ronda: [['id', 'cliente_id', 'voz']], Aplicados: [['id', 'fecha', 'cliente', 'codigo_app', 'tipo', 'detalle', 'resultado', 'pasado_a_docs', 'actualizado', 'archivado']] });
const MAESTRA = libro({ 'Registro clientes': [['codigo', 'nombre', 'hoja_datos_id', 'activa'], ['SOLE-1', 'Sole', 'APP1', 'TRUE']],
  'Vídeos pedidos': [['codigo', 'ejercicio_id', 'indicacion', 'desde', 'hasta', 'como_grabar', 'grabado'], ['SOLE-1', 'goblet', 'x', '2026-10-21', '2026-10-27', 'de lado', '2026-10-25']] });
const APP1 = libro({ Plan: [['dia', 'ejercicio_id', 'nombre', 'principal'], ['d1', 'goblet', 'Goblet', 'TRUE'], ['d1', 'remo', 'Remo', ''], ['d2', 'hip', 'Hip thrust', 'TRUE']],
  Correcciones: [['fecha', 'ejercicio_id', 'texto', 'estado', 'mostrar_hasta', 'superada_el', 'resumen'], ['2026-10-21', 'goblet', 'Talones abajo', 'activa', '', '', '']],
  Registro: [['semana', 'dia', 'ejercicio_id', 'serie', 'peso', 'repes', 'hecho'], [3, 'd1', 'goblet', 1, 10, 12, true]], Ajustes: [['clave', 'valor']] });
const LIBROS = { PANEL: PANEL, M: MAESTRA, APP1: APP1 };
const fmt = (d, tz, f) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(d).map(x => [x.type, x.value]));
  const dia = `${p.year}-${p.month}-${p.day}`; return f === 'yyyy-MM-dd' ? dia : f === 'HH:mm:ss' ? `${p.hour}:${p.minute}:${p.second}` : `${dia}T${p.hour}:${p.minute}:${p.second}`; };
const ctx = vm.createContext({ console, Date, Math, JSON, String, Object, Number, parseFloat, parseInt, isNaN, isFinite,
  SpreadsheetApp: { openById: id => LIBROS[id] || (id === '1SmU2r84U-k2lq5RR1R9f0BVamwIU4-mwtRd8uRVnZ48' ? PANEL : id === '1UKuXBYxFLsjNVN6ecR2ALC6AI1J--08YpvC8XacFJ78' ? MAESTRA : null) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }) },
  Utilities: { formatDate: fmt } });
vm.runInContext(fs.readFileSync(path.join(DIR, '..', '..', 'app', 'Code.gs'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, '..', 'Panel.gs'), 'utf8'), ctx);
const K = ctx.PANEL_KEY, api = (accion, datos) => { const r = ctx.P_despachar({ k: K, accion, datos }); if (!r.ok) throw new Error(r.error); return r.data; };

const lista = api('videosCargar', {});
assert.equal(lista.clientes.length, 1, 'solo clientes activos con app');
assert.equal(lista.clientes[0].grabados, 1);
const det = api('videosCliente', { cliente_id: 'c1' });
assert.deepEqual(det.ejercicios.map(e => e.id), ['goblet', 'remo', 'hip']);
assert.equal(det.correcciones.length, 1);
const antesVid = MAESTRA.sh['Vídeos pedidos'].data.length, antesCor = APP1.sh.Correcciones.data.length;
const r = api('videosGuardar', { cliente_id: 'c1', cap: 'https://cap.so/s/x', mensaje: 'Hola',
  correcciones: [{ ejercicio_id: 'remo', texto: 'Codo atrás' }, { ejercicio_id: 'inventado', texto: 'no' }, { ejercicio_id: 'hip', texto: '  ' }],
  superar: ['goblet', 'otro'], videos: [{ ejercicio_id: 'hip', indicacion: 'Aprieta arriba', como_grabar: 'de lado' }, { ejercicio_id: 'nada' }] });
assert.deepEqual([r.correcciones, r.superadas, r.videos], [1, 1, 1], 'solo ejercicios de su plan y con texto');
const cor = APP1.sh.Correcciones.data;
assert.equal(cor.length, antesCor + 1);
assert.equal(cor[1][3], 'superada'); assert.match(String(cor[1][5]), /^\d{4}-\d{2}-\d{2}$/);
assert.deepEqual(cor[2].slice(1, 4), ['remo', 'Codo atrás', 'activa']);
const vp = MAESTRA.sh['Vídeos pedidos'].data;
assert.equal(vp.length, antesVid + 1);
assert.deepEqual([vp[vp.length - 1][0], vp[vp.length - 1][1], vp[vp.length - 1][5]], ['SOLE-1', 'hip', 'de lado']);
assert.equal(new Date(vp[vp.length - 1][4] + 'T12:00:00Z').getUTCDay(), 2, 'hasta = un martes');
assert.equal(PANEL.sh.Aplicados.data.length, 2, 'queda apuntado en Aplicados');
assert.deepEqual(Object.keys(APP1.sh).sort(), ['Ajustes', 'Correcciones', 'Plan', 'Registro'], 'no crea ni toca otras pestañas');
assert.throws(() => api('videosGuardar', { cliente_id: 'c2' }), /no tiene la app/);
// Candado: lo que escribe el panel (R_ajuste) es lo que lee la app (L_ajustes → L_candado). Ante la duda, abierto.
const aj = () => ctx.L_ajustes(ctx.D_leer(APP1, 'Ajustes'));
assert.equal(ctx.L_candado(aj(), [], []), null, 'sin candado: abierto');
ctx.R_ajuste(APP1, 'candado', 'TRUE');
assert.deepEqual(JSON.parse(JSON.stringify(ctx.L_candado(aj(), [], []))), { fotos: false, peso: false, plan: false, sinPeso: false });
ctx.R_ajuste(APP1, 'plan_ok', '2026-10-30');
assert.equal(ctx.L_candado(aj(), [{ archivo_id: 'f1' }], [{ peso: 70.2 }]), null, 'fotos + peso + OK: abierto');
assert.notEqual(ctx.L_candado(aj(), [{ archivo_id: 'f1' }], []), null, 'sin peso: cerrado');
ctx.R_ajuste(APP1, 'desbloqueado', 'TRUE');
assert.equal(ctx.L_candado(aj(), [], []), null, 'desbloqueado a mano: abierto');
ctx.R_ajuste(APP1, 'desbloqueado', ''); ctx.R_ajuste(APP1, 'candado', '');
assert.equal(ctx.L_candado(aj(), [], []), null, 'quitar candado: abierto');
assert.equal(ctx.L_candado(undefined, null, null), null, 'datos raros: abierto');
// Sin báscula o pesándose más adelante: el peso no puede dejarle la app cerrada
ctx.R_ajuste(APP1, 'candado', 'TRUE'); ctx.R_ajuste(APP1, 'plan_ok', '2026-10-30'); ctx.R_ajuste(APP1, 'peso_frecuencia', 'no');
assert.equal(ctx.L_candado(aj(), [{ archivo_id: 'f1' }], [], 1), null, 'sin báscula: se abre con fotos y OK');
ctx.R_ajuste(APP1, 'peso_frecuencia', 'semanal'); ctx.R_ajuste(APP1, 'peso_desde_semana', '2');
assert.equal(ctx.L_candado(aj(), [{ archivo_id: 'f1' }], [], 1), null, 'se pesa desde la semana 2: en la 1 no le cierra');
assert.notEqual(ctx.L_candado(aj(), [{ archivo_id: 'f1' }], [], 2), null, 'en la semana 2 ya le pide peso');
// Renovar: alarga desde el fin, crea cuotas que suman el precio y apunta la fila
api('guardar', { tabla: 'Clientes', id: 'c1', campos: { fin: '2099-01-10', metodo: 'Bizum' } });
const rn = api('renovar', { cliente_id: 'c1', resultado: 'renueva', meses: 6, precio: 850, cuotas: 3, primero: '2099-01-10' });
assert.equal(rn.cliente.fin, '2099-07-10'); assert.equal(rn.cobros.length, 3);
assert.equal(rn.cobros.reduce((a, c) => a + parseFloat(c.importe), 0).toFixed(2), '850.00');
assert.equal(api('renovar', { cliente_id: 'c1', resultado: 'no' }).renovacion.resultado, 'no');
assert.throws(() => api('renovar', { cliente_id: 'c1', resultado: 'renueva', meses: 6 }), /precio/);
console.log('prueba-videos: OK');
