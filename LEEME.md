# Mi Música 2.6.4 — versión estable

Esta versión congela el funcionamiento de reproducción y evita cambios experimentales.

### Motor de reproducción
1. `files/{id}?alt=media` directamente en `<audio>` para mantener reproducción nativa y búsqueda.
2. Si el navegador no acepta esa fuente, usa `webContentLink` cuando Drive lo entrega.
3. Como último recurso, descarga la respuesta como `Blob` y la entrega al `<audio>` mediante `URL.createObjectURL()`.

La reproducción no hace consultas ID3 al iniciar una canción ni precarga metadatos de la siguiente. Esto reduce solicitudes simultáneas a Google Drive.

### Después de actualizar GitHub Pages
Haz una recarga fuerte (`Ctrl + Shift + R`). Si el navegador conserva la versión anterior, usa **F12 → Application → Storage → Clear site data**.

No cambies `app.js` mientras se prueba esta versión. Primero validemos la reproducción de varias canciones; las mejoras visuales se deben hacer después y de forma aislada.


## Y2K MP3/CD
La pantalla de reproducción completa incluye una interfaz visual estilo reproductor MP3/CD de principios de los 2000. Los cambios son visuales y no modifican el motor de reproducción de audio.


### Diseño
La interfaz Y2K está optimizada para móvil y escritorio; el reproductor completo usa una distribución horizontal en PC y vertical en pantallas pequeñas.
