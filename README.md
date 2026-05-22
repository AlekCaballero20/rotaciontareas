# Rotador de Tareas · Alek

App web estática para llevar tareas diarias con una lógica tipo Bloc de notas mejorado, pero sin castigo visual de Windows 98.

- `x` marca la tarea principal donde vas.
- `*` marca la subtarea activa de cada tarea.
- **Completar paso** termina la subtarea activa de la tarea con `x`, mueve el `*` a la siguiente subtarea de esa misma tarea y rota la `x` a la siguiente tarea pendiente.
- **Solo rotar** mueve la `x` a la siguiente tarea sin completar nada.
- Importa texto pegado desde Bloc de notas.
- Guarda todo en `localStorage`, así que no necesita backend.
- Incluye PWA básica para instalar en el navegador.
- Tiene temporizador ajustable de 1 a 180 minutos.
- Permite elegir qué pasa cuando termina el temporizador: solo avisar, rotar la X o completar paso y rotar.
- Incluye temas visuales: Alek tech, Claro sobrio y Musicala suave.

## Cómo usar

Abre `index.html` en el navegador o sube la carpeta completa a GitHub Pages.

## Formato de importación

```txt
Seguimiento de tareas del día
0. Apps personal y laboral
1. Vacante
- LinkedIn
- Computrabajo *
2. Marketing x
- Configuración de campañas
- Creación de contenido *
```

Las líneas numeradas se interpretan como tareas. Las líneas con `-` o `•` se interpretan como subtareas de la tarea anterior.
