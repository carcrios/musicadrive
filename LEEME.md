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


## v2.6.4.3
Actualiza la caché de la biblioteca para volver a consultar los metadatos de Drive (`webContentLink`/`resourceKey`) y declara la sesión de audio como `playback` cuando el navegador lo permite. La reproducción existente no fue reescrita.
