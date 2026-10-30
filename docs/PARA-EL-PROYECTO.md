# Cambios que necesita el Proyecto «Clientes» de claude.ai

Desde Claude Code no se tocan las skills ni los documentos del Proyecto. Aquí quedan los cambios que hacen falta allí para que lo nuevo del panel y la app funcione del todo. **Los revisa Alex y, si le valen, los pega él** (o se los pasa a la skill `barrido-cambios`).

## 1. Mensajes de los reportes (skill `reportes-clientes` / `mensajes-plantillas.md`)
Pedido por Alex el 30/10:
- El mensaje principal, corto: 3-5 líneas. Lo demás va en «Añadir al mensaje» (`datos.anadir`), que Alex suma con un toque.
- No repetir una idea con otras palabras ni encadenar elogios: un reconocimiento concreto basta.
- **Nunca preguntar qué días o a qué hora va a entrenar** (el lunes ya no lo pide).
- Uno o dos emojis como mucho.

## 2. Semanas antes de la migración (lectura diaria y reportes)
La app ya no cuenta como saltadas las semanas de antes de que el cliente usara esta app (`desdeApp` = primera semana con algo apuntado, o Ajustes › `semana_app_desde` si Alex la pone). En `datos.historia` del reporte, empezar en esa semana y no poner 0 entrenos en las anteriores.

## 3. Paseos aparte (lectura del formulario semanal o mensual)
Los paseos salen del formulario. Si se apuntan en `datos.paseos` (número de días o texto corto), el panel los enseña en su propia casilla, aparte de los entrenos, y no cuentan como entreno fallado.

## 4. Altas nuevas: candado de la app (skill `inicia-nuevo-cliente`)
- Al crear la hoja «App · Nombre» de un cliente nuevo, poner en **Ajustes**: `candado` = `TRUE`. Así su entreno y su alimentación salen cerrados hasta que tenga fotos + peso y Alex dé el OK al plan.
- El OK lo da Alex desde el panel («✅ OK al plan» en su ficha o en Reportes › Nuevos): escribe `plan_ok` con la fecha. Si algo no cuadra, «🔓 Desbloquear ya» (`desbloqueado` = `TRUE`).
- Los clientes que ya existen no tienen `candado`: no cambia nada para ellos. Ante cualquier error, la app se abre.
- Cuando llega el formulario inicial, el panel propone el mensaje con su usuario de la app y los vídeos de la app y del seguimiento (Llamadas › 🎬 Vídeos de las altas). La propuesta de plan automática al recibir el formulario sigue siendo cosa del Proyecto (decidido el 30/10).

## 5. Correcciones de vídeo hechas desde el panel
Reportes › 🎥 Vídeos deja una fila en **Aplicados** (`tipo` = `correccion`, `detalle` con el enlace de Cap, el mensaje, las correcciones y los vídeos pedidos). Ya quedan escritas en la pestaña Correcciones de su hoja y en Vídeos pedidos de la maestra; falta pasarlas a `<cliente>-correcciones.md` y a su estado, y marcar `pasado_a_docs`.

## 6. Promesas de Alex
No hace falta cambiar nada: el panel lee lo que ya apunta la lectura diaria (Tareas con `cliente_id` y estado pendiente; `hecha` al verla enviada). Ojo: cualquier tarea con `cliente_id` sale como promesa.

## 7. Entreno corto en casa para clientes de gimnasio (skill `planes-entreno-clientes`)
Añadir en su hoja un día `casa` en **Días plan**, con nombre «Salvar el día en casa», y sus ejercicios en **Plan**: unos 15 minutos, sin material y a su nivel, con tus normas. La app lo enseña como un día más; es opcional, no sube el objetivo de la semana y, si lo hace, cuenta como un entreno hecho.

## 8. Peso los viernes
La app, los avisos y el panel ya piden el peso el viernes (martes opcional). Revisar en las skills y documentos lo que aún diga «miércoles», y hacer lo mismo con `recordatorios-formularios.md` si lo menciona.

## 9. Nutrición en la app
Al terminar un plan de nutrición, poner en **Ajustes** de su hoja `nutricion_pdf` (id o enlace del PDF en Drive) y `nutricion_fecha`. Sin eso, en su app sale «Tu plan está en camino». También se puede enlazar a mano desde el panel (ficha › Nutrición).

## 10. Pasos
La app ya no pide los pasos de ayer (Alex 30/10): van en el formulario semanal o mensual. La pestaña Pasos de cada hoja se queda como está.
