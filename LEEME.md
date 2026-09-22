# Mi Música 2.6.5 — controles de pantalla bloqueada

Esta versión congela el funcionamiento de reproducción y evita cambios experimentales.

### Motor de reproducción
1. `files/{id}?alt=media` directamente en `<audio>` para mantener reproducción nativa y búsqueda.
2. Si el navegador no acepta esa fuente, usa `webContentLink` cuando Drive lo entrega.
3. Como último recurso, descarga la respuesta como `Blob` y la entrega al `<audio>` mediante `URL.createObjectURL()`.

La reproducción no hace consultas ID3 al iniciar una canción ni precarga metadatos de la siguiente. Esto reduce solicitudes simultáneas a Google Drive.

### Después de actualizar GitHub Pages
Haz una recarga fuerte (`Ctrl + Shift + R`). Si el navegador conserva la versión anterior, usa **F12 → Application → Storage → Clear site data**.

Esta versión no cambia el motor de reproducción. Solo mejora la integración de Media Session y los controles del sistema.


## Controles en pantalla bloqueada (iPhone)

El reproductor usa la Media Session API para exponer reproducir/pausar, anterior/siguiente y avance/retroceso al sistema cuando el navegador y la versión de iOS los ofrecen. Los saltos predeterminados de avance/retroceso son de 10 segundos y el control de posición se mantiene actualizado mientras suena la canción. La API permite que los controles del sistema de la pantalla bloqueada y otros dispositivos envíen acciones `seekbackward`, `seekforward` y `seekto`. citeturn535792search0turn535792search4
