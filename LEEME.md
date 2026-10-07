# Mi Música 2.6.6: precarga para iPhone bloqueado

### Qué cambió en 2.6.6
- **iPhone: precarga en memoria.** Aunque 2.6.5 ya pedía `play()` en el instante correcto, la canción nueva todavía tenía que bajar de Drive. Mientras baja no suena nada, y con el iPhone bloqueado iOS congela la app justo en ese momento: la descarga no termina y la canción solo arranca al desbloquear. Ahora, mientras suena una canción, la app guarda en memoria la siguiente, la de después y la anterior (archivos de hasta 60 MB). ⏭, ⏮ y el paso automático arrancan al instante desde el teléfono.
- Si tocas ⏭ antes de que termine la precarga (por ejemplo, apenas empezó la canción), esa vez se usa la red, como antes.
- **Registro de diagnóstico (botón 🩺).** Anota en el teléfono qué pasa al tocar ⏭/⏮ con la pantalla bloqueada (🔒 = app en segundo plano). Con **Copiar** se puede enviar para revisar.
- Los controles de la pantalla bloqueada se registran una sola vez (antes se registraban de nuevo en cada canción).

---

## 2.6.5: controles con el celular bloqueado

### Qué se corrigió
- **⏭ / ⏮ con el celular bloqueado.** Antes, al cambiar de canción la app pausaba, vaciaba el `<audio>` y esperaba a que Drive cargara (`canplay`) para recién entonces llamar a `play()`. Con la pantalla bloqueada el sistema solo permite arrancar el audio si `play()` se llama en el mismo instante en que se pulsa el botón, así que lo rechazaba: cambiaba el título y se quedaba en "Toca ▶". Ahora se cambia `src` y se llama a `play()` de inmediato, sin pausar ni vaciar el reproductor.
- **Paso automático a la siguiente canción** con la pantalla bloqueada: mismo arreglo.
- **iPhone/iPad:** la pantalla bloqueada muestra ⏮ ⏯ ⏭. iOS no muestra a la vez los botones de ±10 s y los de canción anterior/siguiente; se dejan los de canción. Para moverte dentro de la canción usa la barra de la pantalla bloqueada.
- **Android y PC:** ⏮ ⏭ y ±10 s en la notificación, como antes.
- **"Quedaste en X — toca ▶ para seguir"** ahora sí retoma en ese punto (antes empezaba desde 0).
- **Service worker:** primero descarga la versión nueva y usa la copia guardada solo sin conexión. Antes, después de actualizar GitHub Pages, la app seguía mostrando la versión vieja.

### Motor de reproducción
0. iPhone/iPad: la copia en memoria si ya está precargada (se baja con `fetch` de `files/{id}?alt=media`).
1. PC/Android: `files/{id}?alt=media` → `webContentLink` → Blob.
2. iPhone/iPad: `webContentLink` → `files/{id}?alt=media` → Blob.

### Después de subir a GitHub Pages
1. Abre la app con internet. Desde 2.6.5 carga la versión nueva al abrir; si ves el botón 🩺 arriba, ya tienes la 2.6.6. Si no aparece, ciérrala del todo (quítala de las apps recientes) y ábrela de nuevo.
2. Prueba: pon una canción, déjala sonar unos 20 segundos (para que precargue las siguientes), bloquea el celular y usa ⏭ / ⏮ en la pantalla bloqueada.
3. Si algo falla, desbloquea, toca 🩺 → **Copiar** y envía el texto.
4. Si sigues viendo la versión anterior en PC: `Ctrl + Shift + R`, o **F12 → Application → Storage → Clear site data**.
