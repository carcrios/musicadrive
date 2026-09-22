# 🎵 Mi Música — Google Drive Player

Reproductor musical **PWA, ligero y sin backend** para reproducir una carpeta pública de Google Drive directamente desde el navegador.

## ✨ Novedades de la versión 2

- Interfaz renovada, responsive y optimizada para móvil.
- ❤️ Favoritos persistentes en el dispositivo.
- 🎧 Reproductor compacto y reproductor a pantalla completa.
- 📱 Mejor experiencia PWA y controles de pantalla bloqueada mediante Media Session.
- 🔎 Búsqueda por título, artista, álbum y carpeta.
- 📂 Carpetas y subcarpetas de Google Drive.
- 🔀 Aleatorio y 🔁 repetición.
- ⏪ / ⏩ saltos de 10 segundos.
- 💾 Guarda última canción, posición, volumen, filtro y preferencias.
- 🏷️ Lectura de etiquetas ID3 para título, artista y álbum.
- ⚡ Caché local de la biblioteca para abrir más rápido.
- 🔐 La clave API puede introducirse en el dispositivo y dejar `config.js` sin secretos.

## 🚀 Publicarlo en GitHub Pages

1. Crea un repositorio público en GitHub.
2. Sube los archivos de esta carpeta al repositorio.
3. Ve a **Settings → Pages**.
4. Selecciona **Deploy from a branch**, rama `main` y carpeta `/ (root)`.
5. Abre la URL que te entregue GitHub Pages.

## 🔑 Configurar Google Drive API

La aplicación utiliza la Google Drive API v3 para listar archivos de una carpeta pública.

1. Crea un proyecto en Google Cloud.
2. Habilita **Google Drive API**.
3. Crea una **API Key**.
4. En Google Drive, comparte la carpeta como **Cualquier persona con el enlace → Lector**.
5. Abre Mi Música y pega el enlace de la carpeta y la API Key.

### Recomendación de seguridad

No publiques una API Key personal dentro de `config.js` en un repositorio público.

Si quieres restringir la clave, utiliza las restricciones de aplicación de Google Cloud para limitarla a tu dominio de GitHub Pages, por ejemplo:

```text
https://TU-USUARIO.github.io/*
```

También puedes dejar `config.js` así:

```js
window.API_KEY = '';
window.CARPETA = '';
window.DRIVE_API = 'https://www.googleapis.com/drive/v3';
```

En ese caso cada usuario introduce sus propios datos y quedan guardados únicamente en su navegador mediante `localStorage`.

> ⚠️ La carpeta de Drive debe ser pública mediante enlace. Cualquier persona que tenga ese enlace puede acceder a los archivos según los permisos de Drive.

## 📁 Estructura

```text
mi-musica/
├── index.html
├── app.js
├── config.js
├── sw.js
├── manifest.webmanifest
├── icon-192.png
├── icon-512.png
└── icon-maskable.png
```

## 🎮 Atajos de teclado

| Tecla | Acción |
|---|---|
| `Espacio` | Play / pausa |
| `←` / `→` | −10 / +10 segundos |
| `Shift + ←` / `Shift + →` | −30 / +30 segundos |
| `N` | Siguiente |
| `P` | Anterior |
| `S` | Aleatorio |
| `R` | Repetición |
| `Esc` | Cerrar reproductor ampliado |

## 🧩 Notas técnicas

- El audio se solicita directamente al navegador desde Google Drive; no se sube ni se retransmite mediante un servidor propio.
- La biblioteca se almacena comprimida en `localStorage` para reducir espacio.
- Los favoritos, sesión y etiquetas también se guardan localmente.
- El Service Worker únicamente almacena los recursos de la aplicación; no intercepta el audio de Google Drive.
- La compatibilidad con reproducción en segundo plano y controles de pantalla bloqueada depende del navegador y sistema operativo.

## 📄 Licencia

MIT. Puedes modificar y adaptar el proyecto. Si lo redistribuyes, conserva el aviso de licencia.


## v2.6.1 — reproducción estable

Esta versión mantiene la reproducción mediante `fetch → Blob → ObjectURL → audio`, pero no solicita etiquetas ID3 mientras inicia una canción ni precarga los primeros 64 KB de la siguiente. También espera `canplay` antes de llamar a `play()` y hace un único reintento ante un fallo transitorio de descarga.
