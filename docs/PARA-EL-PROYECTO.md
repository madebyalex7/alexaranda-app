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
