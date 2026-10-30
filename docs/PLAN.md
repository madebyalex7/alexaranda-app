# Plan de cambios (acordado con Alex el 30/10/2026)

Se construye todo en la **beta** (worker `alexaranda-entrena-beta` + Apps Script beta + copias de las hojas) y Alex lo revisa al final. Nada se publica en real sin su OK.

**Lo que no se toca:** las normas, skills, libros y tareas programadas del Proyecto «Clientes» de claude.ai (lectura diaria, reportes, planes, correcciones). Si algo de aquí necesita que el Proyecto escriba un dato nuevo en la hoja, se deja preparado el texto de la skill para que Alex lo pegue él. En las hojas reales nunca se renombran ni quitan pestañas o columnas: solo se añaden.

## Cómo funcionan los bloques y controles (lo que dijo Alex)
- Alta = primer día de pago. Alex marca el primer día de servicio (cuando entrega el entreno) = inicio de la semana 1.
- Bloques de 12 semanas, subbloques de 6.
- Cada viernes: peso (martes opcional) + formulario semanal.
- Cada 4 viernes (semanas 4, 8, 12 del bloque): peso + medidas + fotos + formulario de control **en lugar del semanal**:
  - semana 4 del primer bloque: «Primer mes»;
  - semanas 4 y 8 de los bloques siguientes: «Mensual» (en el mes 2 añade cómo se ve en un año);
  - semana 8 del último bloque contratado: «Previo a renovación»;
  - semana 12: el de 3, 6, 9 o 12 meses;
  - si no renueva: «Fin de programa».
- El lunes siguiente al formulario de control (semana 5, 9, 13…) va la **revisión mensual**, que sustituye a la semanal de ese cliente.
- Programas de 3, 6 y 12 meses. Aviso de renovación en la revisión que sigue a «Previo a renovación» (la 2.ª en 3 meses, la 5.ª en 6 meses, la 11.ª en 12 meses) y recordatorio semanal después.
- Grand Slam (oferta de renovación anual): avisar desde la revisión del mes 1 (skill `momento-grand-slam`).
- Formularios que hay: Inicial (al pagar), Puesta al día (una vez, clientes antiguos), Semanal, Primer mes, Mensual, Previo a renovación, 3/6/9/12 meses, Fin de programa.

## Fase 1 · Arreglos rápidos
- [x] Un entreno empezado se cierra solo a las 4 h y cuenta como hecho.
- [x] «Modificar mensaje» en el feedback: 3 versiones (más cercano, más directo, más corto) en la voz de Alex; arreglar el fallo actual.
- [x] Caminar (sale del formulario semanal/mensual) no cuenta como entreno fallado; contador aparte.
- [x] Semanas antes de la migración: contar desde el primer registro de cada cliente en esta app.
- [x] El calentamiento se pliega al acabarlo.
- [x] Próximos eventos: solo los de esa semana, en una línea con el día («Viernes: …»).
- [ ] Feedback: mensaje principal corto + frases sueltas que Alex añade; sin repetir ni aplaudir de más; nunca preguntar cuándo van a entrenar.

## Fase 2 · Estructura del panel
- [x] Menú lateral con iconos.
- [x] Ficha del cliente a pantalla completa (no ventana emergente); pagos recogidos en un botón.
- [x] Ver los formularios de cada cliente en su ficha.
- [x] Carga más rápida (caché) y animaciones suaves en panel y app.

## Fase 3 · Revisiones y correcciones
- [x] Reportes en tipos: lunes, mensual, vídeos (y viernes como está).
- [x] Calendario de controles según lo de arriba (mes 1, 2, 3 = fin de bloque…).
- [x] Semanal: si se pesó la semana pasada y si mandó vídeos, y tenerlo en cuenta en el mensaje.
- [x] Mensual: fotos subidas, gráfica de peso, medidas, troncales uno a uno.
- [x] En toda revisión: ver entreno y nutrición en un panel lateral sin salir.
- [ ] Contexto del cliente (motiva, frustra, eventos, pasado): lo escribe el Proyecto; el panel lo enseña.
- [x] Evolución de pesos y repes: sugerir a quién toca subir peso.
- [ ] Propuestas de cambio de ejercicio (lesión, dificultad, cambio de bloque o subbloque): 2-3 opciones con el porqué, solo con los ejercicios de las skills; las prepara el Proyecto. En cambio de bloque, casa → gimnasio.
- [ ] Mensajes destacados → ficha + carpeta «Para historias» (con marca de permiso; se quitan de la carpeta, no de la ficha).
- [x] Correcciones de vídeo: enlace de Cap + transcripción → mensaje con enlace y resumen, sugerencia de vídeos a pedir hasta el martes, y a la ficha.
- [x] Aviso Grand Slam desde el mes 1; aviso de renovación (ver arriba); fin de programa a la vista.
- [x] Semáforo automático y alerta temprana (7-10 días sin registrar).

## Fase 4 · Altas y candados
- [x] Nueva alta: WhatsApp, nombre, Instagram, casa/gimnasio, días (si el formulario dice menos, mandan los del formulario).
- [x] Mensaje de bienvenida con vídeo de pilares + formulario inicial (vídeos: pendientes de Alex).
- [ ] Al llegar el formulario: propuesta de plan automática (la hace el Proyecto) + mensaje con usuario de la app y vídeos de app y seguimiento.
- [x] App con candados en entreno y nutrición hasta que tenga fotos + peso y Alex dé el OK al plan.
- [ ] Seguimiento de las 2 primeras semanas: foto y feedback de cada entreno, fotos de comidas y cenas la primera semana.
- [x] Enviar = abrir WhatsApp con el texto escrito (`wa.me`); nunca scripts conectados a WhatsApp.

## Fase 5 · App
- [x] Barra de abajo con iconos; más visual.
- [ ] Clientes de gimnasio: una tarjeta de entreno corto en casa (unos 15 min, sin material, a su nivel).
- [x] Fotos cada 4 viernes: recordatorio el miércoles, aviso y banner ese viernes, y cada 48 h hasta que las suba.

## Fase 6 · Dinero
- [x] Panel general: cash collected, facturación y gastos.
- [x] Gastos con categorías (Anuncios, Software y las que añada Alex) y recurrentes.
- [x] Apartado de finanzas: mensual, trimestral, semestral, por categoría.

## Fase 7 · Contenido
- [x] Calendario de historias (tipo + guion) y reels (vídeo, texto, hora, carpeta de Drive).
- [ ] Más adelante: publicar reels y ver anuncios con la API de Instagram (Alex lo conecta después).
- [ ] Libros en Drive para consultas puntuales (pendiente de que Alex los suba).

## Estado (30/10, sin publicar y sin probar aún contra Google ni la IA real)
- [x] = hecho en el código y probado con mocks. Lo que sigue en [ ] depende de algo de fuera: el Proyecto («Clientes» de claude.ai, ver PARA-EL-PROYECTO.md), los vídeos, los libros o Instagram.
- Mensajes destacados: ya existía el banco «Para redes» (Redes), con permiso y «usada»; falta comprobar con Alex si le basta.
- Para subir la beta: activar la API de Apps Script (https://script.google.com/home/usersettings) y ./publicar-beta.sh.
