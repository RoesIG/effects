# FX Tools · Skin Editor 1.0 Beta 6

Revisión de la Beta 5 a partir de pruebas de uso. Lee `../LEEME_SKIN_EDITOR_BETA6.txt` para el registro completo, pruebas hechas y pendientes.

## Comenzar

Abre `skin-editor/index.html` para el editor estático. No requiere instalar nada para trabajar localmente o exportar PNG/.fxskin.

**Importación oficial por nombre**: los servicios de Mojang no permiten peticiones CORS directas desde una página cualquiera. Esta distribución incluye un servidor opcional en `../serve.mjs`: ejecuta `node serve.mjs` con Node 18+ desde la carpeta raíz y visita `http://localhost:8765/skin-editor/`. Para publicarlo en línea debes desplegar también `/api/skin`. El editor no necesita cuenta y no cambia tu skin oficial.

## Cambios importantes

- Selección de destino respetada por Pegar, vista previa de la copia, reflejo y botón directo de duplicación al brazo opuesto.
- Menú Figuras desplegable; controles Copiar y Pegar más visibles.
- Selecciones desde el espacio UV vacío, selección de cara, pieza y cuerpo completo, y atajo Esc. Pintar fuera del área elegida no la quita.
- Degradados radiales acotados por radio sin selección y cálculo continuo en espacio 3D cuando hay una selección activa en vista 3D.
- Nuevo selector de color integrado con Confirmar/Cancelar.
- Aclarar y Oscurecer disponibles sin selección sobre píxeles visibles, incluso si la capa de trabajo está vacía.
- Correcciones preventivas al renderizado 3D en Canvas/WebGL para reducir colores filtrados en bordes.
- Conserva formato `.fxskin` y los recursos de FX Tools.

## Conocidas limitaciones

Revisar los trazos superpuestos en WebGL real, importar por nombre en un servidor con conectividad y las selecciones que arrastran desde fuera del atlas (solo se permiten desde píxeles vacíos dentro del atlas). Los efectos 3D completos deben comprobarse a 360° en el equipo del usuario. Esta sigue siendo una beta.
