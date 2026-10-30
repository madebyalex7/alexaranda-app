# Panel · Alex Aranda

Página privada con dos pestañas, **Clientes** y **Leads**. Todo se edita en el propio panel: se guarda solo («Guardado ✓»). Desde ahora, la fuente de verdad es el panel. Los Excel antiguos no se actualizan.

## Archivos
- `panel.html`: la página. El Worker la sirve en `/panel?k=CLAVE` y solo habla con `POST /panel/api`.
- `Panel.gs`: se pega como archivo nuevo en el proyecto de Apps Script de la app. Entrada única: `P_despachar(cuerpo)`.
  - `Code.gs` ya tiene el enganche en `doPost`: `if (cuerpo.panel) return json_(P_despachar(cuerpo))`.
  - El panel manda `panel: true` en el cuerpo.
  - Acciones: `cargar`, `guardar`, `nuevo`, `archivar` y `desarchivar`.
- `test/mock-server.mjs` + `test/prueba.mjs`: prueba local que ejecuta el `Panel.gs` real contra una hoja simulada.

## Hoja de datos
**Panel Alex – datos**, en Drive › 01 Panel y cobros.
- id: `1SmU2r84U-k2lq5RR1R9f0BVamwIU4-mwtRd8uRVnZ48`
- https://docs.google.com/spreadsheets/d/1SmU2r84U-k2lq5RR1R9f0BVamwIU4-mwtRd8uRVnZ48/edit

Todas las celdas van en formato texto. Las fechas se guardan como `yyyy-MM-dd`.

| Pestaña | Columnas |
|---|---|
| Clientes (20) | id, nombre, nombre_whatsapp, estado, programa, inicio, fin, precio_total, forma_pago, metodo, cuotas, importe_cuota, dia_cobro, semaforo (verde/amarillo/rojo/vacío), semaforo_nota, seguimiento, proxima_conversacion, conversacion_motivo, retomar_fecha, retomar_motivo, notas, actualizado, archivado |
| Leads (9) | id, nombre, instagram, whatsapp, origen, temperatura, estado, preocupacion, ultima_fecha, ultima_resumen, siguiente_paso, proximo_contacto, notas, actualizado, archivado |
| Cobros (46) | id, fecha, cliente_id, cliente, concepto, importe, estado (Pendiente/Cobrado), ultimo, metodo, notas, actualizado, archivado |

«Archivar» no borra la fila: rellena `archivado` con la fecha. Desde «Ver archivados» se puede recuperar.

## De dónde sale cada dato
- **Clientes y cobros:** de «Panel clientes» (Drive › 01 Panel y cobros), pestañas Clientes y Cobros. Solo se leyó, no se tocó.
  - El «próximo cobro» de cada cliente es el primer cobro «Pendiente» de la pestaña Cobros.
  - «Ingresos del mes» es lo cobrado en el mes en curso, junto a lo previsto.
- **Lourdes:** inactiva (fuera desde el 22/10, según `pendientes-alex.md`).
- **Yahaira:** inactiva y por confirmar. Sale en el antiguo «Control de Clientes» y en el protocolo de rescate, pero no en «Panel clientes».
- **Flori:** activa, con «Sin seguimiento proactivo».
- **Semáforo:**
  - Sole 🟢, Amanda 🟢, Claudia 🟡, Lourdes 🔴 y Yahaira 🔴, sacados de los documentos locales (`sole-seguimiento.md`, `planes-casa-unificados.md` y `protocolo-rescate.md`).
  - El resto, **por confirmar**: los `<cliente>-estado.md` del proyecto no se pudieron leer, porque la herramienta del proyecto no estaba disponible en esta sesión.
- **Leads:** de «Seguimiento de Leads» (Drive). Se importaron los 9 «caliente» y «templado» (templado pasa a «medio»). Fuera quedan los 2 «frío» (roci_p_a y yanida).
  - Estado: Follow up.
  - Último toque, próximo contacto, próxima acción y notas: tal cual estaban en el Excel.
  - La hoja «Leads – Llamada sin cierre» está vacía.
  - «Análisis Anuncios.xlsx» mide el coste de los anuncios, no recoge leads.

## Por confirmar (con Alex)
- Semáforo de 13 clientes activos.
- Origen de todos los leads (en el Excel estaba vacío) y «qué le preocupa».
- Método de pago de Claudia, Amanda, Paris y Tatiana.
- Precio total de Alex Casares (mensual, 60 €).
- Importe de los plazos de Isaac.
- Cobro del 25/01/2027: en el original pone «Tatiana Vargas – Mensualidad 60 €», pero parece la de Alex Casares.
- Sole: «Panel clientes» dice pago único de 980 € (cobrado). El antiguo «Control de Clientes» decía 2 cuotas, con el próximo pago el 27/10.
- Fecha de la charla de renovación de Gris: se ha puesto el 13/11 como propuesta (acaba el 05/01).
- Lourdes y Yahaira: cuándo y cómo retomar.

## Capturas (prueba local)
`capturas/`: movil-clientes.png, movil-ficha-cliente.png, movil-leads.png, movil-lead-nuevo.png, movil-oscuro.png, escritorio-clientes.png, escritorio-leads.png.

## Probar en local
```
cd test && PORT=8799 node mock-server.mjs     # http://localhost:8799/panel?k=…
node prueba.mjs ../capturas                    # en otra terminal
```
