# Mi Música 2.6.5: controles con el celular bloqueado

### Qué se corrigió
- **⏭ / ⏮ con el celular bloqueado.** Antes, al cambiar de canción la app pausaba, vaciaba el `<audio>` y esperaba a que Drive cargara (`canplay`) para recién entonces llamar a `play()`. Con la pantalla bloqueada el sistema solo permite arrancar el audio si `play()` se llama en el mismo instante en que se pulsa el botón, así que lo rechazaba: cambiaba el título y se quedaba en "Toca ▶". Ahora se cambia `src` y se llama a `play()` de inmediato, sin pausar ni vaciar el reproductor.
- **Paso automático a la siguiente canción** con la pantalla bloqueada: mismo arreglo.
- **iPhone/iPad:** la pantalla bloqueada muestra ⏮ ⏯ ⏭. iOS no muestra a la vez los botones de ±10 s y los de canción anterior/siguiente; se dejan los de canción. Para moverte dentro de la canción usa la barra de la pantalla bloqueada.
- **Android y PC:** ⏮ ⏭ y ±10 s en la notificación, como antes.
- **"Quedaste en X — toca ▶ para seguir"** ahora sí retoma en ese punto (antes empezaba desde 0).
- **Service worker:** primero descarga la versión nueva y usa la copia guardada solo sin conexión. Antes, después de actualizar GitHub Pages, la app seguía mostrando la versión vieja.

### Motor de reproducción (sin cambios en el orden)
1. PC/Android: `files/{id}?alt=media` → `webContentLink` → Blob.
2. iPhone/iPad: `webContentLink` → `files/{id}?alt=media` → Blob.

### Después de subir a GitHub Pages
1. Abre la app una vez, ciérrala del todo (quítala de las apps recientes) y vuelve a abrirla. La primera apertura todavía la controla el service worker viejo.
2. Prueba: pon una canción, bloquea el celular y usa ⏭ / ⏮ en la pantalla bloqueada.
3. Si sigues viendo la versión anterior en PC: `Ctrl + Shift + R`, o **F12 → Application → Storage → Clear site data**.
