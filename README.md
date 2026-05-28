# Rotador urgente · Alek

Versión simplificada para seguimiento rápido de tareas urgentes del día.

## Qué incluye

- Un solo estilo claro y sobrio: blanco, grises, negro y azul suave.
- Tareas con prioridad: Urgente, Alta y Normal.
- Subtareas agregables directamente dentro de cada tarjeta de tarea.
- X para marcar la tarea activa.
- * para marcar la subtarea activa dentro de la tarea.
- Botón **Completar paso** que marca el paso actual y rota a la siguiente tarea pendiente.
- Botón **Rotar X** para cambiar de tarea sin completar nada.
- Reordenamiento de tareas con flechas ↑ ↓ para definir el orden de rotación.
- Filtros: Todas, Pendientes, Urgentes, Actual y Listas.
- Búsqueda rápida.
- Importación desde bloc de notas.
- Copiar resumen del día.
- Modo foco.
- Temporizador sencillo con presets de 10, 15, 25 y 45 minutos.
- Barra de racha con pasos seguidos, XP y combo.
- Microinteracciones al completar pasos: +XP flotante, confeti sutil y animaciones de progreso.
- Colores de urgencia en el temporizador cuando queda poco tiempo.
- Guardado local en el navegador usando localStorage.
- PWA básica con manifest y service worker.

## Formato para importar

```txt
1. Marketing x
- Revisar presupuesto *
- Crear anuncio
2. Ventas
- Responder leads
```

- `x` al final marca la tarea activa.
- `*` al final marca la subtarea activa.
- Los números crean tareas.
- Los guiones crean subtareas dentro de la última tarea.

## Archivos

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `icon.svg`
