# Mi Música — versión simple

Pegas el enlace de tu carpeta pública de Drive y ya suena. Sin iniciar sesión.

---

## Paso 1 — Hacer pública la carpeta (30 segundos)

En Google Drive, clic derecho sobre tu carpeta de música → **Compartir** → en *Acceso general* elige **Cualquier persona con el enlace**, rol **Lector**. **Copiar enlace**.

> Esto significa que cualquiera que tenga ese enlace puede oír tu música. No aparece en buscadores ni la encuentra nadie por casualidad, pero conviene que lo sepas. Si prefieres que siga privada, dímelo y te paso la otra versión, que pide iniciar sesión pero no expone nada.

## Paso 2 — Sacar la clave de API (2 minutos, una sola vez)

1. Entra a **https://console.cloud.google.com/apis/credentials** y crea un proyecto cualquiera.
2. Busca **Google Drive API** en el buscador de arriba y toca **Habilitar**.
3. Vuelve a **Credenciales** → **Crear credenciales** → **Clave de API**.
4. Copia la clave (empieza por `AIza...`).

*Opcional pero recomendado:* toca **Restringir clave** → *Restricciones de aplicación* → **Sitios web** → añade `https://TU-USUARIO.github.io/*`. Así nadie más puede usar tu clave.

## Paso 3 — Publicar la app

1. Crea un repositorio en **https://github.com** (público).
2. **Add file → Upload files** y sube estos 8 archivos:

   ```
   index.html   app.js   config.js   sw.js
   manifest.webmanifest   icon-192.png   icon-512.png   icon-maskable.png
   ```

3. **Settings → Pages →** Source: *Deploy from a branch*, rama **main**, carpeta **/ (root)**. **Save**.
4. A los dos minutos tendrás `https://TU-USUARIO.github.io/musica/`.

## Paso 4 — Abrir y usar

Abre la dirección: te pide el enlace de la carpeta y la clave, tocas **Empezar** y aparece tu música. Queda guardado en el dispositivo; la próxima vez abre directo.

**Instalar:** en Android sale el botón **⬇ Instalar** (o menú ⋮ → *Instalar aplicación*). En iPhone, Compartir → *Añadir a pantalla de inicio*. En el computador, el ícono de instalar en la barra de direcciones.

> Si quieres que no pregunte nada en ningún dispositivo, pon la clave y la carpeta dentro de `config.js` antes de subirlo.

---

## Qué trae

| | |
|---|---|
| 📁 Cambiar | Otra carpeta u otra clave |
| ↻ | Volver a leer la carpeta si agregaste música |
| Desplegable | Reproducir solo una subcarpeta |
| Buscador | Por canción, artista o álbum, sin importar las tildes |
| −10s / +10s | Atrasar y adelantar |
| Barra | Saltar a cualquier punto, al instante |
| 🔀 / 🔁 | Aleatorio y repetir |

Lee las etiquetas ID3, así que un archivo llamado `03 - pista.mp3` aparece con su título y artista reales, también en la pantalla bloqueada. Recuerda dónde quedaste. Funciona con la pantalla apagada.

**Teclado:** `Espacio` play/pausa · `→` `←` ±10 s · `N` / `P` siguiente y anterior · `S` aleatorio · `R` repetir.

---

## Qué se simplificó frente a la versión anterior

| | Con inicio de sesión | Esta |
|---|---|---|
| Trámite en Google | proyecto + API + pantalla de consentimiento + usuarios de prueba + ID de OAuth | proyecto + API + clave |
| Al abrir | botón *Conectar*, aviso de "app no verificada" | nada, entra directo |
| Token | caduca cada hora, hay que renovarlo | no hay token |
| Piezas que pueden fallar | página, service worker de puente, Google Identity | página |
| Privacidad | carpeta privada | carpeta pública con enlace |

El audio ahora lo pide el navegador directamente a Google, sin intermediarios: por eso arranca en ~150 ms y saltar es instantáneo.

---

## Si algo falla

| Mensaje | Qué hacer |
|---|---|
| "La clave de API no es válida" | Revisa que la copiaste completa; empieza por `AIza` |
| "Falta activar la API de Drive" | Paso 2, punto 2: habilitar **Google Drive API** |
| "La carpeta no es pública" | Paso 1: compartir como *Cualquier persona con el enlace* |
| "La clave está restringida a otra página" | En Google Cloud, añade `https://TU-USUARIO.github.io/*` |
| "No encontré esa carpeta" | El enlace está mal; cópialo otra vez desde Drive |
| Canciones nuevas no salen | Toca **↻** |
