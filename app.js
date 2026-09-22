/* =========================================================
   MI MUSICA  ·  version simple
   Carpeta publica + clave de API. Sin iniciar sesion.
   El navegador le pide el audio a Google directamente, asi que
   la reproduccion es nativa: arranca rapido, salta al instante
   y sigue sonando con la pantalla apagada.
   ========================================================= */
'use strict';

window.APP_VER = '4';   // debe coincidir con HTML_VER en index.html

var $ = function (i) { return document.getElementById(i); };
var API = window.DRIVE_API || 'https://www.googleapis.com/drive/v3';
var CARPETA_MIME = 'application/vnd.google-apps.folder';
var EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i;

var LL = { clave: 'mus_clave', carpeta: 'mus_carpeta', lista: 'mus_lista',
           sesion: 'mus_sesion', tags: 'mus_tags' };

var audio = $('au');
var clave = '', carpeta = '';
var cn = [], or = [], pos = -1, fc = '', alea = false, rep = 'no';
var vis = [], dib = 0, PAG = 150, arrastre = false, pendiente = 0, deberia = false;
var tags = {}, instalador = null;

/* ================= utilidades ================= */
function fmt(s) {
  if (!isFinite(s) || s < 0) return '0:00';
  s = Math.floor(s);
  var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), g = s % 60;
  return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (g < 10 ? '0' : '') + g;
}
function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function norm(s) {
  s = String(s == null ? '' : s).toLowerCase();
  try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
  return s;
}
function est(t) { $('es').textContent = t || ''; }
function act() { return pos >= 0 && pos < or.length ? cn[or[pos]] : null; }
function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function leer(k, x) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : x; } catch (e) { return x; } }

/** Saca el ID de una URL de Drive. Acepta todas estas formas:
 *   drive.google.com/drive/folders/ID
 *   drive.google.com/drive/u/0/folders/ID?usp=sharing
 *   drive.google.com/open?id=ID
 *   drive.google.com/file/d/ID/view
 *   o el ID pelado.
 */
function sacarId(texto) {
  var t = String(texto || '').trim();
  if (!t) return '';
  var patrones = [/\/folders\/([^/?#&]+)/, /\/file\/d\/([^/?#&]+)/, /[?&]id=([^&#]+)/];
  for (var i = 0; i < patrones.length; i++) {
    var m = patrones[i].exec(t);
    if (m && m[1]) return m[1];
  }
  if (/^[-\w]{10,}$/.test(t)) return t;          // pegaron solo el ID
  var g = /[-\w]{15,}/.exec(t);
  return g ? g[0] : '';
}

/* ================= Drive (carpeta publica + clave) ================= */
function mensajeError(r, cuerpo) {
  var m = '';
  try { m = (cuerpo && cuerpo.error && cuerpo.error.message) || ''; } catch (e) {}
  if (r.status === 400 && /API key not valid|API_KEY_INVALID/i.test(m))
    return 'La clave de API no es válida. Revísala; empieza por AIza.';
  if (r.status === 403 && /not been used|disabled|SERVICE_DISABLED/i.test(m))
    return 'Falta activar la API de Drive en tu proyecto de Google Cloud (búscala y toca Habilitar).';
  if (r.status === 403 && /referer|referrer|blocked/i.test(m))
    return 'La clave está restringida a otra página. Quita la restricción o añade esta dirección.';
  if (r.status === 403)
    return 'La carpeta no es pública. Compártela como “Cualquier persona con el enlace”.';
  if (r.status === 404)
    return 'No encontré esa carpeta. Revisa el enlace.';
  return 'Google respondió ' + r.status + (m ? ': ' + m : '');
}

function drive(ruta) {
  var sep = ruta.indexOf('?') >= 0 ? '&' : '?';
  return fetch(API + ruta + sep + 'key=' + encodeURIComponent(clave)).then(function (r) {
    return r.json()['catch'](function () { return null; }).then(function (j) {
      if (!r.ok) throw new Error(mensajeError(r, j));
      return j;
    });
  });
}

function urlHijos(id, pageToken) {
  var q = "'" + id + "' in parents and trashed=false";
  var u = '/files?q=' + encodeURIComponent(q) +
    '&fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType,size)') +
    '&pageSize=1000&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true';
  if (pageToken) u += '&pageToken=' + encodeURIComponent(pageToken);
  return u;
}

/** El enlace directo del audio: el navegador lo reproduce sin intermediarios. */
function urlAudio(s) {
  return API + '/files/' + encodeURIComponent(s.id) + '?alt=media&supportsAllDrives=true&key=' +
    encodeURIComponent(clave);
}

/** Recorre la carpeta y todas sus subcarpetas. */
function escanear(raiz, avanzar) {
  var pistas = [], vistos = {}, leidas = 0, fallo = null;
  var cola = [{ id: raiz, ruta: '', t: null }];

  function tanda() {
    if (!cola.length || fallo) return Promise.resolve();
    var lote = cola.splice(0, 12);
    return Promise.all(lote.map(function (n) {
      return drive(urlHijos(n.id, n.t)).then(function (r) {
        leidas++;
        (r.files || []).forEach(function (f) {
          if (f.mimeType === CARPETA_MIME) {
            cola.push({ id: f.id, ruta: n.ruta ? n.ruta + ' / ' + f.name : f.name, t: null });
          } else if (String(f.mimeType || '').indexOf('audio/') === 0 || EXT.test(f.name)) {
            if (vistos[f.id]) return;
            vistos[f.id] = true;
            pistas.push({
              id: f.id, n: f.name.replace(/\.[^.]+$/, ''), c: n.ruta || '',
              m: String(f.mimeType || '').indexOf('audio/') === 0 ? f.mimeType : 'audio/mpeg',
              z: Number(f.size || 0)
            });
          }
        });
        if (r.nextPageToken) cola.push({ id: n.id, ruta: n.ruta, t: r.nextPageToken });
      })['catch'](function (e) { if (!fallo && !leidas) fallo = e; });
    })).then(function () {
      if (avanzar) avanzar(pistas.length, leidas);
      return tanda();
    });
  }

  return tanda().then(function () {
    if (fallo) throw fallo;
    pistas.sort(function (a, b) {
      return (a.c + ' ' + a.n).localeCompare(b.c + ' ' + b.n, 'es', { numeric: true });
    });
    return pistas;
  });
}

/* ================= biblioteca ================= */
function comprimir(lista) {
  var rutas = [], iR = {}, mimes = [], iM = {};
  var p = lista.map(function (s) {
    if (iR[s.c] === undefined) { iR[s.c] = rutas.length; rutas.push(s.c); }
    if (iM[s.m] === undefined) { iM[s.m] = mimes.length; mimes.push(s.m); }
    return [s.id, s.n, iR[s.c], iM[s.m], s.z];
  });
  return { c: rutas, m: mimes, p: p, de: carpeta };
}
function expandir(g) {
  var rutas = g.c || [], mimes = g.m || [];
  cn = (g.p || []).map(function (f) {
    var c = rutas[f[2]] || '';
    return { id: f[0], n: f[1], c: c, m: mimes[f[3]] || 'audio/mpeg', z: f[4] || 0, k: norm(f[1] + ' ' + c) };
  });
}

function cargarBiblioteca(forzar) {
  if (!forzar) {
    var g = leer(LL.lista, null);
    if (g && g.p && g.p.length && g.de === carpeta) { expandir(g); preparar(); return Promise.resolve(); }
  }
  $('ls').innerHTML = '<div class="va">Leyendo la carpeta…<br><span id="pg">0 canciones</span></div>';
  return escanear(carpeta, function (n, f) {
    var e = $('pg');
    if (e) e.textContent = n + ' canciones en ' + f + ' carpetas';
  }).then(function (pistas) {
    if (!pistas.length) {
      $('ls').innerHTML = '<div class="va">La carpeta no tiene archivos de audio.<br>Toca <b>📁 Cambiar</b> para probar con otra.</div>';
      $('ct').textContent = '';
      return;
    }
    cn = pistas.map(function (s) { s.k = norm(s.n + ' ' + s.c); return s; });
    guardar(LL.lista, comprimir(cn));
    preparar();
  })['catch'](function (e) {
    $('ls').innerHTML = '<div class="va"><b>No pude leer la carpeta.</b><br><br>' +
      '<span style="color:#ff9a9a">' + esc(e.message || e) + '</span><br><br>' +
      '<button class="bt" id="bo">📁 Cambiar carpeta o clave</button></div>';
    var b = $('bo');
    if (b) b.onclick = abrirInicio;
  });
}

function preparar() {
  tags = leer(LL.tags, {});
  cn.forEach(function (s) {
    var g = tags[s.id];
    if (g) s.k = norm((g.t || s.n) + ' ' + (g.a || '') + ' ' + (g.b || '') + ' ' + s.n + ' ' + s.c);
  });
  $('ct').textContent = cn.length + ' canciones';
  llenarFiltro();

  var m = leer(LL.sesion, null);
  if (m) {
    if (typeof m.vol === 'number') { audio.volume = m.vol; $('vo').value = Math.round(m.vol * 100); }
    alea = !!m.alea; $('al').className = 'ico md' + (alea ? ' on' : '');
    rep = m.rep || 'no';
    $('re').className = 'ico md' + (rep !== 'no' ? ' on' : '');
    $('r1').style.display = rep === 'una' ? '' : 'none';
    if (m.fc) { $('fc').value = m.fc; fc = $('fc').value === m.fc ? m.fc : ''; }
  }
  var idx = m && m.id ? indice(m.id) : -1;
  orden(idx >= 0 ? idx : null);
  pintar();
  if (idx >= 0) {
    var s = cn[idx];
    $('ti').textContent = titulo(s);
    pendiente = (m.seg && m.seg > 5) ? m.seg : 0;
    est(pendiente ? 'Quedaste en ' + fmt(pendiente) + ' — toca ▶ para seguir' : 'Toca ▶ para seguir');
    marcar();
  }
}

function llenarFiltro() {
  var cu = {};
  cn.forEach(function (s) {
    if (!s.c) return;
    var pt = s.c.split(' / ');
    for (var i = 1; i <= pt.length; i++) {
      var k = pt.slice(0, i).join(' / ');
      cu[k] = (cu[k] || 0) + 1;
    }
  });
  var h = '<option value="">Todas las carpetas (' + cn.length + ')</option>';
  Object.keys(cu).sort().forEach(function (r) {
    var niv = r.split(' / ').length - 1, san = '';
    for (var i = 0; i < niv; i++) san += '   ';
    h += '<option value="' + esc(r) + '">' + san + (niv ? '└ ' : '') +
      esc(r.split(' / ').pop()) + ' (' + cu[r] + ')</option>';
  });
  $('fc').innerHTML = h;
}

/* ================= orden y lista ================= */
function ambito() {
  var r = [];
  for (var i = 0; i < cn.length; i++) {
    var c = cn[i].c || '';
    if (!fc || c === fc || c.indexOf(fc + ' / ') === 0) r.push(i);
  }
  return r;
}
function orden(ia) {
  or = ambito();
  if (alea) {
    for (var i = or.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = or[i]; or[i] = or[j]; or[j] = t;
    }
    if (ia != null && or.indexOf(ia) >= 0) { or.splice(or.indexOf(ia), 1); or.unshift(ia); }
  }
  pos = ia == null ? -1 : or.indexOf(ia);
}
function indice(id) {
  for (var i = 0; i < cn.length; i++) if (cn[i].id === id) return i;
  return -1;
}
function titulo(s) {
  var g = tags[s.id];
  return g && g.t ? (g.a ? g.t + ' — ' + g.a : g.t) : s.n;
}
function fila(i, n) {
  var s = cn[i], a = act(), g = tags[s.id];
  var nom = g && g.t ? g.t : s.n;
  var sub = g && g.a ? g.a + (s.c ? ' · ' + s.c : '') : s.c;
  return '<div class="pi' + (a && a.id === s.id ? ' ac' : '') + '" data-i="' + i + '">' +
    '<div class="nu">' + (n + 1) + '</div><div class="in"><div class="nm">' + esc(nom) + '</div>' +
    (sub ? '<div class="sb">' + esc(sub) + '</div>' : '') + '</div></div>';
}
function pintar() {
  var t = norm($('bu').value.trim());
  vis = ambito().filter(function (i) { return !t || cn[i].k.indexOf(t) >= 0; });
  dib = 0;
  if (!cn.length) return;
  if (!vis.length) { $('ls').innerHTML = '<div class="va">Sin resultados.</div>'; return; }
  $('ls').innerHTML = '<div id="fs"></div><div id="ms"></div>';
  $('ls').scrollTop = 0;
  mas();
}
function mas() {
  var caja = $('fs');
  if (!caja || dib >= vis.length) return;
  var h = '', n = Math.min(dib + PAG, vis.length);
  for (var i = dib; i < n; i++) h += fila(vis[i], i);
  caja.insertAdjacentHTML('beforeend', h);
  dib = n;
  $('ms').innerHTML = dib < vis.length
    ? '<div class="va">' + dib + ' de ' + vis.length + ' · sigue bajando</div>' : '';
}
function marcar() {
  var p = $('ls').querySelector('.pi.ac');
  if (p) p.className = 'pi';
  var a = act(); if (!a) return;
  var idx = indice(a.id);
  var el = $('ls').querySelector('.pi[data-i="' + idx + '"]');
  if (!el) {
    var n = vis.indexOf(idx), g = 0;
    if (n < 0) return;
    while (dib <= n && dib < vis.length && g++ < 300) mas();
    el = $('ls').querySelector('.pi[data-i="' + idx + '"]');
  }
  if (el) { el.className = 'pi ac'; el.scrollIntoView({ block: 'nearest' }); }
}
function refrescarFila(id) {
  var idx = indice(id);
  var el = $('ls').querySelector('.pi[data-i="' + idx + '"]');
  if (!el) return;
  var n = vis.indexOf(idx);
  el.outerHTML = fila(idx, n >= 0 ? n : 0);
}

/* ================= etiquetas ID3 ================= */
function texto(v, ini, largo) {
  var cod = v[ini], d = v.subarray(ini + 1, ini + largo), et = 'utf-8';
  if (cod === 0) et = 'iso-8859-1';
  else if (cod === 1) et = 'utf-16';
  else if (cod === 2) et = 'utf-16be';
  var s = '';
  try { s = new TextDecoder(et).decode(d); }
  catch (e) { try { s = new TextDecoder('utf-8').decode(d); } catch (e2) { s = ''; } }
  return s.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
}
function leerID3(buf) {
  var v = new Uint8Array(buf);
  if (v.length < 10 || v[0] !== 0x49 || v[1] !== 0x44 || v[2] !== 0x33) return null;
  var ver = v[3];
  var tam = ((v[6] & 0x7f) << 21) | ((v[7] & 0x7f) << 14) | ((v[8] & 0x7f) << 7) | (v[9] & 0x7f);
  var fin = Math.min(10 + tam, v.length), i = 10, r = {};
  while (i + 10 <= fin) {
    var id = String.fromCharCode(v[i], v[i + 1], v[i + 2], v[i + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    var t = ver === 4
      ? (((v[i+4]&0x7f)<<21)|((v[i+5]&0x7f)<<14)|((v[i+6]&0x7f)<<7)|(v[i+7]&0x7f))
      : ((v[i+4]<<24)|(v[i+5]<<16)|(v[i+6]<<8)|v[i+7]);
    if (t <= 0 || i + 10 + t > fin) break;
    if (id === 'TIT2') r.t = texto(v, i + 10, t);
    else if (id === 'TPE1') r.a = texto(v, i + 10, t);
    else if (id === 'TALB') r.b = texto(v, i + 10, t);
    i += 10 + t;
  }
  return (r.t || r.a || r.b) ? r : null;
}
/** Solo los primeros 64 KB: suficiente para artista y titulo. */
function buscarTags(s) {
  if (!s || tags[s.id]) return;
  fetch(urlAudio(s), { headers: { Range: 'bytes=0-65535' } })
    .then(function (r) { return r.arrayBuffer(); })
    .then(function (buf) {
      var g = null;
      try { g = leerID3(buf); } catch (e) {}
      if (!g) return;
      tags[s.id] = g;
      guardar(LL.tags, tags);
      var i = indice(s.id);
      if (i >= 0) cn[i].k = norm((g.t || s.n) + ' ' + (g.a || '') + ' ' + (g.b || '') + ' ' + s.n + ' ' + s.c);
      var a = act();
      if (a && a.id === s.id) { $('ti').textContent = titulo(s); mediaInfo(s); }
      refrescarFila(s.id);
    })['catch'](function () {});
}

/* ================= reproduccion ================= */
var genTocar = 0;      // cada cancion que se pide anula la anterior
var relojCarga = null;

function tocar(p) {
  if (p < 0 || p >= or.length) return;
  pos = p;
  var s = act(), mio = ++genTocar;
  $('ti').textContent = titulo(s);
  est('Cargando…');
  marcar();
  guardarSesion();

  clearTimeout(relojCarga);
  // Si en 15 s no ha empezado a sonar, preguntarle a Google que pasa.
  relojCarga = setTimeout(function () {
    if (mio === genTocar && audio.paused) diagnosticar(s, null);
  }, 15000);

  // Asignar src ya inicia la carga; llamar a load() ademas aborta el play().
  audio.src = urlAudio(s);
  mediaInfo(s);

  var pr = audio.play();
  if (pr && pr['catch']) pr['catch'](function (e) {
    if (mio !== genTocar) return;                       // el usuario ya eligio otra
    var m = (e && e.message) || '';
    // Estas dos NO son fallos: pasan al cambiar rapido de cancion.
    if (e && (e.name === 'AbortError' || /interrupted by|interrupted because/i.test(m))) return;
    if (e && e.name === 'NotAllowedError') { est('Toca ▶ para reproducir'); return; }
    diagnosticar(s, e);
  });

  buscarTags(s);
  if (pos + 1 < or.length) buscarTags(cn[or[pos + 1]]);
}

/** Cuando el audio no arranca, se le pregunta a Google por el archivo
 *  y se muestra SU respuesta, que es la que explica de verdad el problema. */
function diagnosticar(s, e) {
  est('Comprobando el archivo…');
  fetch(urlAudio(s), { headers: { Range: 'bytes=0-1' } }).then(function (r) {
    if (r.ok || r.status === 206) {
      // Google entrega el archivo: el problema es del reproductor, no del acceso.
      est(e ? ('No se pudo reproducir: ' + (e.message || e))
            : 'El archivo llega pero el navegador no lo reproduce. ¿Formato no compatible?');
      return;
    }
    if (r.status === 404) {                    // es ESTA cancion, no la carpeta
      est('Esa canción ya no está en Drive. Pasando a la siguiente…');
      setTimeout(function () { sig(true); }, 1200);
      return;
    }
    return r.json()['catch'](function () { return null; }).then(function (j) {
      est(mensajeError(r, j));
    });
  })['catch'](function () {
    est('Sin conexión con Google. Revisa el internet.');
  });
}

function sig(auto) {
  if (!or.length) return;
  if (auto && rep === 'una') { audio.currentTime = 0; audio.play(); return; }
  var p = pos + 1;
  if (p >= or.length) {
    if (auto && rep === 'no') { est('Fin de la lista'); return; }
    if (alea) orden(null);
    p = 0;
  }
  pendiente = 0;
  tocar(p);
}
function ant() {
  if (!or.length) return;
  if (audio.currentTime > 3 || pos <= 0) { audio.currentTime = 0; return; }
  pendiente = 0;
  tocar(pos - 1);
}
function salto(g) {
  if (isFinite(audio.duration)) {
    audio.currentTime = Math.max(0, Math.min(audio.duration - 0.25, audio.currentTime + g));
  }
}
function mediaInfo(s) {
  if (!('mediaSession' in navigator)) return;
  var g = tags[s.id] || {};
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: g.t || s.n, artist: g.a || 'Google Drive', album: g.b || s.c || 'Mi Música',
      artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }]
    });
  } catch (e) {}
  posicion();
}
function posicion() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  if (!isFinite(audio.duration) || audio.duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      position: Math.min(audio.currentTime || 0, audio.duration),
      playbackRate: audio.playbackRate || 1
    });
  } catch (e) {}
}
function guardarSesion() {
  var a = act();
  guardar(LL.sesion, {
    id: a ? a.id : null, seg: a ? (audio.currentTime || 0) : 0,
    vol: audio.volume, alea: alea, rep: rep, fc: fc
  });
}

/* ================= pantalla de inicio ================= */
function abrirInicio() {
  $('ini').className = 'ver';
  $('en').value = carpeta ? 'https://drive.google.com/drive/folders/' + carpeta : '';
  $('kk').value = clave || '';
  if (window.API_KEY) { $('kk').style.display = 'none'; $('etk').style.display = 'none'; $('ay').style.display = 'none'; }
  $('er').className = 'err';
}
function cerrarInicio() { $('ini').className = ''; }

$('bv').onclick = function () {
  var id = sacarId($('en').value);
  var k = (window.API_KEY || $('kk').value || '').trim();
  var e = $('er');
  if (!id) { e.textContent = 'Ese enlace no tiene un ID de carpeta. Copia la dirección completa desde Drive.'; e.className = 'err ver'; return; }
  if (!k) { e.textContent = 'Falta la clave de API. Mira las instrucciones de abajo.'; e.className = 'err ver'; return; }

  e.className = 'err';
  $('bv').disabled = true;
  $('bv').textContent = 'Comprobando…';
  clave = k; carpeta = id;

  drive(urlHijos(id, null)).then(function () {
    guardar(LL.clave, clave);
    guardar(LL.carpeta, carpeta);
    cerrarInicio();
    cargarBiblioteca(true);
  })['catch'](function (err) {
    e.textContent = err.message || String(err);
    e.className = 'err ver';
  }).then(function () {
    $('bv').disabled = false;
    $('bv').textContent = 'Empezar';
  });
};

/* ================= controles ================= */
$('ls').addEventListener('click', function (e) {
  var el = e.target.closest ? e.target.closest('.pi') : null;
  if (!el) return;
  pendiente = 0;
  var i = +el.getAttribute('data-i');
  if (alea) { orden(i); tocar(0); } else { orden(null); tocar(or.indexOf(i)); }
});
$('ls').addEventListener('scroll', function () {
  var l = $('ls');
  if (l.scrollTop + l.clientHeight > l.scrollHeight - 400) mas();
});
$('bu').addEventListener('input', pintar);
$('fc').addEventListener('change', function (e) {
  fc = e.target.value;
  var a = act(), idx = a ? indice(a.id) : -1;
  orden(idx >= 0 && ambito().indexOf(idx) >= 0 ? idx : null);
  pintar(); guardarSesion();
  est(fc ? 'Solo: ' + fc : '');
});
$('br').onclick = function () { cargarBiblioteca(true); };
$('bc').onclick = abrirInicio;

$('pl').onclick = function () {
  if (!or.length) return;
  if (pos < 0) { tocar(0); return; }
  if (!audio.src) { tocar(pos); return; }
  if (audio.paused) { deberia = true; audio.play(); } else { deberia = false; audio.pause(); }
};
$('si').onclick = function () { sig(false); };
$('an').onclick = ant;
$('d10').onclick = function () { salto(10); };
$('a10').onclick = function () { salto(-10); };
$('al').onclick = function () {
  alea = !alea;
  orden(pos >= 0 ? or[pos] : null);
  $('al').className = 'ico md' + (alea ? ' on' : '');
  est(alea ? 'Aleatorio activado' : 'Aleatorio desactivado');
  guardarSesion();
};
$('re').onclick = function () {
  rep = rep === 'no' ? 'todas' : rep === 'todas' ? 'una' : 'no';
  $('re').className = 'ico md' + (rep !== 'no' ? ' on' : '');
  $('r1').style.display = rep === 'una' ? '' : 'none';
  est(rep === 'no' ? 'Repetir desactivado' : rep === 'todas' ? 'Repetir toda la lista' : 'Repetir esta canción');
  guardarSesion();
};
$('vo').oninput = function (e) { audio.volume = e.target.value / 100; guardarSesion(); };

$('pr').addEventListener('input', function () {
  arrastre = true;
  if (isFinite(audio.duration)) $('t1').textContent = fmt($('pr').value / 1000 * audio.duration);
});
$('pr').addEventListener('change', function () {
  if (isFinite(audio.duration)) audio.currentTime = $('pr').value / 1000 * audio.duration;
  arrastre = false;
});

var ultimo = 0;
audio.addEventListener('timeupdate', function () {
  if (arrastre || !isFinite(audio.duration)) return;
  $('pr').value = audio.currentTime / audio.duration * 1000;
  $('t1').textContent = fmt(audio.currentTime);
  if (audio.buffered.length) {
    $('bf').style.width = Math.min(100,
      audio.buffered.end(audio.buffered.length - 1) / audio.duration * 100) + '%';
  }
  var n = Date.now();
  if (n - ultimo > 5000) { ultimo = n; guardarSesion(); posicion(); }
});
audio.addEventListener('loadedmetadata', function () {
  $('t2').textContent = fmt(audio.duration);
  if (pendiente > 0) { try { audio.currentTime = pendiente; } catch (e) {} pendiente = 0; }
  posicion();
});
audio.addEventListener('playing', function () {
  clearTimeout(relojCarga);
  var a = act();
  est(a ? (a.c || '') : '');
});
audio.addEventListener('ended', function () { sig(true); });
audio.addEventListener('play', function () {
  deberia = true;
  $('i1').style.display = 'none'; $('i2').style.display = '';
  try { navigator.mediaSession.playbackState = 'playing'; } catch (e) {}
  posicion();
});
audio.addEventListener('pause', function () {
  $('i1').style.display = ''; $('i2').style.display = 'none';
  try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {}
  guardarSesion();
});
audio.addEventListener('error', function () {
  if (!audio.src) return;
  var s = act();
  if (!s) return;
  // Antes saltaba a la siguiente sin mirar: con un problema general eso
  // recorria la biblioteca entera fallando. Ahora primero se averigua.
  fetch(urlAudio(s), { headers: { Range: 'bytes=0-1' } }).then(function (r) {
    if (r.status === 404) {                       // solo ese archivo: seguir
      est('Esa canción ya no está en Drive. Pasando a la siguiente…');
      setTimeout(function () { sig(true); }, 1200);
      return;
    }
    if (r.ok || r.status === 206) {
      est('El navegador no pudo reproducir este archivo (formato). Pasando a la siguiente…');
      setTimeout(function () { sig(true); }, 1200);
      return;
    }
    return r.json()['catch'](function () { return null; }).then(function (j) {
      est(mensajeError(r, j));                    // problema general: parar y explicar
    });
  })['catch'](function () { est('Sin conexión con Google.'); });
});
window.addEventListener('beforeunload', guardarSesion);
document.addEventListener('visibilitychange', function () {
  if (!document.hidden && deberia && audio.paused && audio.src) {
    var p = audio.play();
    if (p && p['catch']) p['catch'](function () {});
  }
});
document.addEventListener('keydown', function (e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  var k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); $('pl').onclick(); }
  else if (k === 'arrowright') { e.preventDefault(); salto(e.shiftKey ? 30 : 10); }
  else if (k === 'arrowleft') { e.preventDefault(); salto(e.shiftKey ? -30 : -10); }
  else if (k === 'n') sig(false);
  else if (k === 'p') ant();
  else if (k === 's') $('al').onclick();
  else if (k === 'r') $('re').onclick();
});

if ('mediaSession' in navigator) {
  var mh = function (a, f) { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} };
  mh('play', function () { deberia = true; audio.play(); });
  mh('pause', function () { deberia = false; audio.pause(); });
  mh('nexttrack', function () { sig(false); });
  mh('previoustrack', ant);
  mh('seekto', function (d) { if (isFinite(audio.duration)) audio.currentTime = d.seekTime; });

  // En iPhone los controles de la pantalla bloqueada tienen solo dos ranuras
  // laterales: si se declaran los saltos de 10 s, iOS los pone ahi y esconde
  // los botones de cancion anterior y siguiente. Por eso en iPhone no se
  // declaran: asi salen los de cambiar de cancion, que es lo util fuera de la app.
  // (Para tener los de 10 s en su lugar, borra la condicion de abajo.)
  var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!esIOS) {
    mh('seekforward', function (d) { salto((d && d.seekOffset) || 10); });
    mh('seekbackward', function (d) { salto(-((d && d.seekOffset) || 10)); });
  }
}

/* ================= instalacion ================= */
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault(); instalador = e; $('bi').className = 'bt';
});
$('bi').onclick = function () {
  if (!instalador) return;
  instalador.prompt();
  instalador.userChoice.then(function () { instalador = null; $('bi').className = 'bt oculto'; });
};
window.addEventListener('appinstalled', function () { $('bi').className = 'bt oculto'; });

/* ================= reinicio de emergencia ================= */
/* Abrir la app con  ?reset=1  al final de la direccion borra la copia
   guardada y el service worker, y vuelve a empezar de cero.
   Sirve cuando una actualizacion se queda a medias. */
if (location.search.indexOf('reset=1') >= 0) {
  document.getElementById('ls').innerHTML = '<div class="va">Limpiando…</div>';
  var tareas = [];
  try { localStorage.clear(); } catch (e) {}
  if (window.caches && caches.keys) {
    tareas.push(caches.keys().then(function (k) {
      return Promise.all(k.map(function (n) { return caches.delete(n); }));
    }));
  }
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    tareas.push(navigator.serviceWorker.getRegistrations().then(function (rs) {
      return Promise.all(rs.map(function (r) { return r.unregister(); }));
    }));
  }
  Promise.all(tareas)['catch'](function () {}).then(function () {
    location.replace(location.pathname);
  });
} else

/* ================= arranque ================= */
(function () {
  if (navigator.serviceWorker) navigator.serviceWorker.register('sw.js')['catch'](function () {});
  audio.volume = 0.9;

  clave = window.API_KEY || leer(LL.clave, '') || '';
  carpeta = window.CARPETA ? sacarId(window.CARPETA) : (leer(LL.carpeta, '') || '');

  if (clave && carpeta) cargarBiblioteca(false);
  else abrirInicio();
})();

window.__LISTO = true;   // llego al final sin errores
