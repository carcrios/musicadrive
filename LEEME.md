# Mi Música 2.6.7 — controles y avance automático

Esta versión congela el funcionamiento de reproducción y evita cambios experimentales.

### Motor de reproducción
1. `files/{id}?alt=media` directamente en `<audio>` para mantener reproducción nativa y búsqueda.
2. Si el navegador no acepta esa fuente, usa `webContentLink` cuando Drive lo entrega.
3. Como último recurso, descarga la respuesta como `Blob` y la entrega al `<audio>` mediante `URL.createObjectURL()`.

La reproducción no hace consultas ID3 al iniciar una canción ni precarga metadatos de la siguiente. Esto reduce solicitudes simultáneas a Google Drive.

### Después de actualizar GitHub Pages
Ya no hace falta recargar a la fuerza: el service worker pide el código a la red antes que a la copia guardada, así que la versión nueva entra sola al recargar. Si alguna vez queda algo a medias, abre la dirección con **`?reset=1`** al final: borra la copia guardada y empieza limpio.

Esta versión no cambia el motor de reproducción. Solo mejora la integración de Media Session y los controles del sistema.


## Controles en pantalla bloqueada (iPhone)

Los controles del sistema tienen **solo dos ranuras** a los lados del botón de reproducir. Si la app declara `seekbackward`/`seekforward`, iOS las ocupa con los saltos de 10 s y **esconde** los botones de canción anterior y siguiente.

Por eso, **en iPhone y iPad esos dos manejadores no se declaran** (y se retiran explícitamente, por si quedaron puestos de una versión anterior). Resultado: la pantalla bloqueada muestra ⏮ ⏯ ⏭. Los saltos de ±10 s siguen dentro de la app, y `seekto` se mantiene para que la barra de posición del sistema funcione.

En Android y escritorio sí caben ambos, así que allí se declaran los cuatro. citeturn535792search0turn535792search4


---

## Avance automático de canción

Al terminar una canción no pasaba a la siguiente con la pantalla bloqueada. Eran dos cosas sumadas:

1. **Se soltaba el elemento de audio.** Antes de cada canción se hacía `pause()`, `removeAttribute('src')` y `load()`. Con la pantalla bloqueada, eso hace que iOS retire el permiso de audio, y ya no se puede volver a arrancar. Ahora, cuando el cambio es automático, la fuente se reemplaza directamente sin soltar el elemento. (Cuando eres tú quien elige la canción, se sigue limpiando como antes: ahí hay un toque tuyo de por medio y no hay riesgo.)

2. **Se esperaba a `canplay` para llamar a `play()`.** Cuando ese evento llegaba, el permiso ya se había perdido. Ahora `play()` se llama en el mismo instante en que termina la anterior; los eventos siguen ahí para la cadena de respaldo.

Además hay una red de seguridad: si `ended` no llega (algunas fuentes de Drive no lo disparan), el final se detecta por la posición o por una pausa a menos de un segundo del final.

## Pendiente / ideas

- **Etiquetas ID3**: hoy no se consultan al arrancar (decisión correcta para no saturar Drive). Se podrían leer solo de las filas visibles, en tiempo muerto, y así recuperar artista y título sin peticiones de más.
- **Registrar qué fuente se usa**: la cadena `alt=media → webContentLink → Blob` es lo que da estabilidad, pero conviene saber cuál se usa de verdad. Si casi siempre cae en `Blob`, se pierde el salto instantáneo y se gasta más datos.
