# Changelog

Todos los cambios notables de **labelWise** se documentan en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [1.0.3] — 2026-05-31

### Agregado
- **Persistencia de sesión** con IndexedDB: imágenes (como `ArrayBuffer`), anotaciones, etiquetas y colores se restauran automáticamente al recargar la página.
- **Paleta de colores inteligente**: al crear una nueva etiqueta se asigna automáticamente el color con mayor distancia angular respecto a los colores existentes, evitando colores iguales o muy similares.
- **Editor de color por etiqueta**: sección "Colores de etiquetas" en el panel derecho; cada etiqueta muestra un swatch clickeable que abre el selector de color nativo del sistema.
- **Footer** con versión actual y enlace a este changelog.

### Cambiado
- `buildRandomLabelColor` reemplazado por `buildLabelColor(hue)` + `getDistinctHue(existingHues[])` para una asignación determinista y visualmente diferenciada.
- `LabelColor` ahora incluye el campo `hue: number` para facilitar conversiones hex ↔ hue.

---

## [1.0.2] — 2026-05-30

### Agregado
- **Scroll horizontal y vertical** en el panel de anotación: cuando la imagen supera el tamaño del viewport tras hacer zoom, aparecen scrollbars nativas.
- **Scrollbars personalizadas** en toda la app: delgadas (6 px), track transparente, thumb con el color del tema y efecto hover.

### Cambiado
- El modo **Mover** ahora manipula `scrollLeft`/`scrollTop` del viewport en lugar de desplazar el stage con `left`/`top` absoluto.
- El stage dejó de ser `position: absolute` con pan calculado; vive en un wrapper flex que centra la imagen y crece cuando hay zoom.

---

## [1.0.1] — 2026-05-28

### Agregado
- Importación de múltiples imágenes con vista previa en el panel izquierdo.
- Dibujo de bounding boxes con etiqueta activa seleccionable.
- Redimensionado y movimiento de boxes con handles en las esquinas.
- Selección múltiple con `Ctrl/Cmd + clic`, copiar y pegar anotaciones.
- Importación de anotaciones desde CSV (`label_name, bbox_x, bbox_y, bbox_width, bbox_height, image_name`).
- Exportación de anotaciones a CSV con dimensiones de imagen.
- Vista **CSV** en el panel de anotación: tabla editable con campos numéricos y selector de etiqueta.
- Modo **Guía** con grid superpuesto al canvas.
- Zoom con botones `+` / `−` / `Reset` (rango 50 % – 300 %).
- Colores aleatorios por etiqueta con overlay y overlay fuerte para selección.
- Gestión de etiquetas: agregar una a una, por lote (separadas por coma o salto de línea) y eliminar cuadros individualmente.

---

## [1.0.0] — 2026-05-27

### Agregado
- Estructura inicial del proyecto con **Vite + React + TypeScript**.
- Integración de **Tailwind CSS v4**, **shadcn/ui** y **lucide-react**.
- Layout de tres columnas: lista de imágenes · panel de anotación · panel de etiquetas.
- Tema oscuro personalizado con paleta `tom-thumb`.
