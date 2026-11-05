/* =========================================================
   MI MUSICA  ·  version simple
   Carpeta publica + clave de API. Sin iniciar sesion.
   ========================================================= */
'use strict';

var $ = function (i) { return document.getElementById(i); };
var API = window.DRIVE_API || 'https://www.googleapis.com/drive/v3';
var CARPETA_MIME = 'application/vnd.google-apps.folder';
var EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i;

var LL = { clave: 'mus_clave', carpeta: 'mus_carpeta', lista: 'mus_lista_v6',
           sesion: 'mus_sesion', tags: 'mus_tags', fav: 'mus_favoritos' };
var favoritos = leer(LL.fav, {});

var audio = $('au');
var clave = '', carpeta = '';
var cn = [], or = [], pos = -1, fc = '', alea = false, rep = 'no';
var vis = [], dib = 0, PAG = 150, arrastre = false, pendiente = 0, deberia = false;
var tags = {}, instalador = null, playToken = 0, audioObjectUrl = '';
var cargaAudioToken = 0;

var ES_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}

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

var VERSION = '2.6.6';
var LOG_KEY = 'mus_diag';
var registro = leer(LOG_KEY, []);
if (!Array.isArray(registro)) registro = [];
function diag(msg) {
  try {
    var d = new Date(), ms = String(d.getMilliseconds());
    while (ms.length < 3) ms = '0' + ms;
    registro.push(d.toTimeString().slice(0, 8) + '.' + ms + (document.hidden ? ' 🔒 ' : '    ') + msg);
    if (registro.length > 300) registro.splice(0, registro.length - 300);
    guardar(LOG_KEY, registro);
  } catch (e) {}
}

function sacarId(texto) {
  var t = String(texto || '').trim();
  if (!t) return '';
  var patrones = [/\/folders\/([^/?#&]+)/, /\/file\/d\/([^/?#&]+)/, /[?&]id=([^&#]+)/];
  for (var i = 0; i < patrones.length; i++) {
    var m = patrones[i].exec(t);
    if (m && m[1]) return m[1];
  }
  if (/^[-\w]{10,}$/.test(t)) return t; 
  var g = /[-\w]{15,}/.exec(t);
  return g ? g[0] : '';
}

function mensajeError(r, cuerpo) {
  var m = '';
  try { m = (cuerpo && cuerpo.error && cuerpo.error.message) || ''; } catch (e) {}
  if (r.status === 400 && /API key not valid|API_KEY_INVALID/i.test(m)) return 'La clave de API no es válida.';
  if (r.status === 403 && /not been used|disabled/i.test(m)) return 'Falta activar la API de Drive.';
  if (r.status === 403 && /referer|blocked/i.test(m)) return 'La clave está restringida.';
  if (r.status === 403) return 'La carpeta no es pública.';
  if (r.status === 404) return 'No encontré esa carpeta.';
  return 'Google respondió ' + r.status + (m ? ': ' + m : '');
}

function drive(ruta) {
  var sep = ruta.indexOf('?') >= 0 ? '&' : '?';
  return fetch(API + ruta + sep + 'key=' + encodeURIComponent(clave)).then(function (r) {
    return r.text().then(function (txt) { var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
      if (!r.ok) throw new Error(mensajeError(r, j));
      return j;
    });
  });
}

function urlHijos(id, pageToken) {
  var q = "'" + id + "' in parents and trashed=false";
  var u = '/files?q=' + encodeURIComponent(q) + '&fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType,size,webContentLink,resourceKey)') + '&pageSize=1000&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true';
  if (pageToken) u += '&pageToken=' + encodeURIComponent(pageToken);
  return u;
}

function urlAudio(s) {
  return API + '/files/' + encodeURIComponent(s.id) + '?alt=media&supportsAllDrives=true&key=' + encodeURIComponent(clave);
}

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
              z: Number(f.size || 0), w: f.webContentLink || '', rk: f.resourceKey || ''
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
    pistas.sort(function (a, b) { return (a.c + ' ' + a.n).localeCompare(b.c + ' ' + b.n, 'es', { numeric: true }); });
    return pistas;
  });
}

function comprimir(lista) {
  var rutas = [], iR = {}, mimes = [], iM = {};
  var p = lista.map(function (s) {
    if (iR[s.c] === undefined) { iR[s.c] = rutas.length; rutas.push(s.c); }
    if (iM[s.m] === undefined) { iM[s.m] = mimes.length; mimes.push(s.m); }
    return [s.id, s.n, iR[s.c], iM[s.m], s.z, s.w || '', s.rk || ''];
  });
  return { c: rutas, m: mimes, p: p, de: carpeta };
}
function expandir(g) {
  var rutas = g.c || [], mimes = g.m || [];
  cn = (g.p || []).map(function (f) {
    var c = rutas[f[2]] || '';
    return { id: f[0], n: f[1], c: c, m: mimes[f[3]] || 'audio/mpeg', z: f[4] || 0, w: f[5] || '', rk: f[6] || '', k: norm(f[1] + ' ' + c) };
  });
}

function cargarBiblioteca(forzar) {
  if (!forzar) {
    var g = leer(LL.lista, null);
    if (g && g.p && g.p.length && g.de === carpeta) { expandir(g); preparar(); return Promise.resolve(); }
  }
  $('ls').innerHTML = '<div class="va">Leyendo la carpeta…<br><span id="pg">0 canciones</span></div>';
  return escanear(carpeta, function (n, f) {
    var e = $('pg'); if (e) e.textContent = n + ' canciones en ' + f + ' carpetas';
  }).then(function (pistas) {
    if (!pistas.length) {
      $('ls').innerHTML = '<div class="va">La carpeta no tiene archivos de audio.</div>';
      $('ct').textContent = '';
      return;
    }
    cn = pistas.map(function (s) { s.k = norm(s.n + ' ' + s.c); return s; });
    guardar(LL.lista, comprimir(cn));
    preparar();
  })['catch'](function (e) {
    $('ls').innerHTML = '<div class="va"><b>No pude leer la carpeta.</b><br><br><button class="bt" id="bo">📁 Cambiar</button></div>';
    var b = $('bo'); if (b) b.onclick = abrirInicio;
  });
}

function preparar() {
  tags = leer(LL.tags, {}); favoritos = leer(LL.fav, {});
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
    rep = m.rep || 'no'; $('re').className = 'ico md' + (rep !== 'no' ? ' on' : '');
    $('r1').style.display = rep === 'una' ? '' : 'none';
    if (m.fc) { $('fc').value = m.fc; fc = $('fc').value === m.fc ? m.fc : ''; }
  }
  var idx = m && m.id ? indice(m.id) : -1;
  orden(idx >= 0 ? idx : null);
  pintar();
  actualizarFavoritosUI();
  if (idx >= 0) {
    var s = cn[idx];
    $('ti').textContent = titulo(s);
    pendiente = (m.seg && m.seg > 5) ? m.seg : 0;
    est(pendiente ? 'Quedaste en ' + fmt(pendiente) + ' — toca ▶' : 'Toca ▶ para seguir');
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
  var h = '<option value="">Todas las carpetas</option>';
  Object.keys(cu).sort().forEach(function (r) {
    var niv = r.split(' / ').length - 1, san = '';
    for (var i = 0; i < niv; i++) san += '   ';
    h += '<option value="' + esc(r) + '">' + san + (niv ? '└ ' : '') + esc(r.split(' / ').pop()) + ' (' + cu[r] + ')</option>';
  });
  $('fc').innerHTML = h;
}

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
function indice(id) { for (var i = 0; i < cn.length; i++) if (cn[i].id === id) return i; return -1; }
function titulo(s) { var g = tags[s.id]; return g && g.t ? (g.a ? g.t + ' — ' + g.a : g.t) : s.n; }
function iconoMusica(){return '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>';}
function esFavorito(id){return !!favoritos[id];}
function fila(i, n) {
  var s = cn[i], a = act(), g = tags[s.id];
  var nom = g && g.t ? g.t : s.n;
  var sub = g && g.a ? g.a + (g.b ? ' · ' + g.b : '') + (s.c ? ' · ' + s.c : '') : s.c;
  return '<div class="pi' + (a && a.id === s.id ? ' ac' : '') + '" data-i="' + i + '"><div class="nu">' + (n + 1) + '</div><div class="cover">' + iconoMusica() + '</div><div class="in"><div class="nm">' + esc(nom) + '</div>' + (sub ? '<div class="sb">' + esc(sub) + '</div>' : '') + '</div><button class="fav' + (esFavorito(s.id) ? ' on' : '') + '" data-fav="' + esc(s.id) + '">' + (esFavorito(s.id) ? '♥' : '♡') + '</button></div>';
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
  $('ms').innerHTML = dib < vis.length ? '<div class="va">' + dib + ' de ' + vis.length + ' · sigue bajando</div>' : '';
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

function texto(v, ini, largo) {
  var cod = v[ini], d = v.subarray(ini + 1, ini + largo), et = 'utf-8';
  if (cod === 0) et = 'iso-8859-1'; else if (cod === 1) et = 'utf-16'; else if (cod === 2) et = 'utf-16be';
  var s = '';
  try { s = new TextDecoder(et).decode(d); } catch (e) { try { s = new TextDecoder('utf-8').decode(d); } catch (e2) { s = ''; } }
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
    var t = ver === 4 ? (((v[i+4]&0x7f)<<21)|((v[i+5]&0x7f)<<14)|((v[i+6]&0x7f)<<7)|(v[i+7]&0x7f)) : ((v[i+4]<<24)|(v[i+5]<<16)|(v[i+6]<<8)|v[i+7]);
    if (t <= 0 || i + 10 + t > fin) break;
    if (id === 'TIT2') r.t = texto(v, i + 10, t);
    else if (id === 'TPE1') r.a = texto(v, i + 10, t);
    else if (id === 'TALB') r.b = texto(v, i + 10, t);
    i += 10 + t;
  }
  return (r.t || r.a || r.b) ? r : null;
}
function buscarTags(s) {
  if (!s || tags[s.id]) return;
  fetch(urlAudio(s), { headers: { Range: 'bytes=0-65535' } }).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      var g = null; try { g = leerID3(buf); } catch (e) {}
      if (!g) return;
      tags[s.id] = g; guardar(LL.tags, tags);
      var i = indice(s.id);
      if (i >= 0) cn[i].k = norm((g.t || s.n) + ' ' + (g.a || '') + ' ' + (g.b || '') + ' ' + s.n + ' ' + s.c);
      var a = act();
      if (a && a.id === s.id) { $('ti').textContent = titulo(s); mediaInfo(s); }
      refrescarFila(s.id);
    })['catch'](function () {});
}

var sourceToken = 0;
var sourceTimer = null;
var cargando = false;
var limpiarIntento = null;
var SALTO_BLOQUEO = 10;

function liberarAudioBlob() {
  if (audioObjectUrl) { try { URL.revokeObjectURL(audioObjectUrl); } catch (e) {} audioObjectUrl = ''; }
}

function urlWeb(s) { return s && s.w ? s.w : ''; }
function urlMedia(s) { return API + '/files/' + encodeURIComponent(s.id) + '?alt=media&supportsAllDrives=true&key=' + encodeURIComponent(clave); }

function fuentesDe(s) {
  var f = [];
  if (cacheAudio[s.id]) f.push({ modo: 'memoria', url: cacheAudio[s.id].url });
  if (ES_IOS && urlWeb(s)) { f.push({ modo: 'web', url: urlWeb(s) }, { modo: 'media', url: urlMedia(s) }); } 
  else { f.push({ modo: 'media', url: urlMedia(s) }); if (urlWeb(s)) f.push({ modo: 'web', url: urlWeb(s) }); }
  return f;
}

var PRECARGAR = ES_IOS;
var PRECARGA_MAX_MB = 25;      
var cacheAudio = {};           
var precargaId = '', precargaCtrl = null, precargaTimer = null;
var precargaFallo = {};        

function vecino(d) {
  if (pos < 0 || !or.length) return -1;
  var p = pos + d;
  if (p >= or.length) { if (alea) return -1; p = p % or.length; }
  if (p < 0) return -1;
  return or[p];
}

function idsAPrecargar() {
  var a = act(), r = [];
  [1].forEach(function (d) {
    var i = vecino(d), s = i >= 0 ? cn[i] : null;
    if (!s || (a && s.id === a.id) || r.indexOf(s.id) >= 0) return;
    r.push(s.id);
  });
  return r;
}

function quitarDeMemoria(id) {
  var c = cacheAudio[id];
  if (!c) return;
  delete cacheAudio[id];
  try { URL.revokeObjectURL(c.url); } catch (e) {}
}

function programarPrecarga(espera) {
  if (!PRECARGAR) return;
  if (precargaTimer) clearTimeout(precargaTimer);
  precargaTimer = setTimeout(function () { precargaTimer = null; precargar(); }, espera || 0);
}

function precargar() {
  var a = act();
  if (!a || !clave) return;
  var quiero = idsAPrecargar();

  Object.keys(cacheAudio).forEach(function (id) {
    if (id === a.id || quiero.indexOf(id) >= 0 || audio.src === cacheAudio[id].url) return;
    quitarDeMemoria(id);
  });

  if (precargaId) {
    if (quiero.indexOf(precargaId) >= 0) return;    
    try { if (precargaCtrl) precargaCtrl.abort(); } catch (e) {}
    precargaId = ''; precargaCtrl = null;
  }

  var ahora = Date.now(), id = '';
  for (var k = 0; k < quiero.length && !id; k++) {
    var q = quiero[k], c = cn[indice(q)];
    if (!c || cacheAudio[q]) continue;
    if (precargaFallo[q] && ahora - precargaFallo[q] < 120000) continue;
    if (c.z && c.z > PRECARGA_MAX_MB * 1048576) continue;
    id = q;
  }
  if (!id) return;

  var s = cn[indice(id)], t0 = Date.now();
  precargaId = id;
  precargaCtrl = typeof AbortController === 'function' ? new AbortController() : null;
  fetch(urlMedia(s), precargaCtrl ? { signal: precargaCtrl.signal } : {}).then(function (r) {
    if (!r.ok) throw new Error('Drive respondió HTTP ' + r.status);
    return r.blob();
  }).then(function (b) {
    if (precargaId !== id) return;                  
    var tipo = (b.type || '').toLowerCase();
    if (tipo.indexOf('audio/') !== 0) {
      if (tipo && tipo.indexOf('application/octet-stream') !== 0) throw new Error('Drive devolvió ' + tipo);
      b = new Blob([b], { type: s.m || 'audio/mpeg' });  
    }
    cacheAudio[id] = { url: URL.createObjectURL(b), mb: b.size / 1048576 };
    diag('precargada: ' + s.n);
  })['catch'](function (e) {
    if (e && e.name === 'AbortError') return;
    precargaFallo[id] = Date.now();
  }).then(function () {
    if (precargaId === id) { precargaId = ''; precargaCtrl = null; }
    programarPrecarga(300);
  });
}

function reproducirFuente(s, token, urls, idx) {
  if (token !== sourceToken || !s || act() !== s) return;
  if (limpiarIntento) limpiarIntento();
  if (idx >= urls.length) { cargando = false; est('No se pudo cargar.'); return; }

  var modo = urls[idx].modo;
  var url = urls[idx].url;
  var resuelto = false;
  cargando = true;

  function vigente() { return !resuelto && token === sourceToken && act() === s; }
  function limpiar() {
    audio.removeEventListener('playing', ok);
    audio.removeEventListener('loadedmetadata', meta);
    audio.removeEventListener('error', fallo);
    if (sourceTimer) { clearTimeout(sourceTimer); sourceTimer = null; }
    if (limpiarIntento === limpiar) limpiarIntento = null;
  }
  function terminar() { resuelto = true; cargando = false; limpiar(); }
  function ok() { if (vigente()) terminar(); }
  function meta() { if (vigente() && sourceTimer) { clearTimeout(sourceTimer); sourceTimer = null; } }
  function fallo() { if (!vigente()) return; siguienteFuente(); }

  function siguienteFuente() {
    if (!vigente()) return;
    resuelto = true;
    limpiar();
    if (modo === 'memoria') quitarDeMemoria(s.id);
    if (modo === 'blob') { cargando = false; est('No se pudo cargar.'); return; }
    if (idx + 1 < urls.length) { reproducirFuente(s, token, urls, idx + 1); return; }
    descargarBlob(s, token).then(function (blob) {
      if (token !== sourceToken || act() !== s) return;
      reproducirFuente(s, token, [{ modo: 'blob', url: URL.createObjectURL(blob) }], 0);
    })['catch'](function (e) {
      if (token !== sourceToken || act() !== s) return;
      cargando = false; est('No se pudo reproducir.');
    });
  }

  limpiarIntento = limpiar;
  audio.addEventListener('playing', ok);
  audio.addEventListener('loadedmetadata', meta);
  audio.addEventListener('error', fallo);

  var blobViejo = audioObjectUrl;
  audio.src = url;
  audioObjectUrl = modo === 'blob' ? url : '';
  if (blobViejo && blobViejo !== url) { try { URL.revokeObjectURL(blobViejo); } catch (e) {} }

  var pr;
  try { pr = audio.play(); } catch (e) { pr = null; }
  if (pr && pr.then) pr.then(function () {}, function (e) {
    if (!vigente()) return;
    if (e && e.name === 'NotAllowedError') {
      if (sourceTimer) { clearTimeout(sourceTimer); sourceTimer = null; }
      est('Toca ▶ para reproducir'); return;
    }
    if (e && e.name === 'AbortError') return;   
    siguienteFuente();
  });

  sourceTimer = setTimeout(function () {
    if (vigente() && deberia) { siguienteFuente(); }
  }, 15000);
}

function descargarBlob(s, token) {
  var u = urlMedia(s);
  return fetch(u, { cache: 'no-store' }).then(function (r) {
    var type = (r.headers.get('Content-Type') || '').toLowerCase();
    if (!r.ok) {
      return r.text().then(function (txt) {
        throw new Error('HTTP ' + r.status);
      });
    }
    if (token !== sourceToken) throw new Error('Cancelada');
    return r.blob().then(function (blob) { return blob; });
  });
}

function tocar(p) {
  if (p < 0 || p >= or.length) return;
  pos = p;
  var s = act();
  deberia = true;

  var token = ++sourceToken;
  if (sourceTimer) { clearTimeout(sourceTimer); sourceTimer = null; }

  var fuentes = fuentesDe(s);
  reproducirFuente(s, token, fuentes, 0);

  limpiarPosicion();
  mediaInfo(s);

  $('ti').textContent = titulo(s);
  if (cargando) est('Cargando audio…');
  marcar();
  guardarSesion();
  actualizarFavoritosUI();
  actualizarFull();
}

function sig(auto) {
  if (!or.length) return;
  if (auto && rep === 'una') {
    audio.currentTime = 0;
    var pr = audio.play();
    if (pr && pr['catch']) pr['catch'](function () {});
    return;
  }
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
  if (audio.currentTime > 3 || pos <= 0) { audio.currentTime = 0; posicion(); return; }
  pendiente = 0;
  tocar(pos - 1);
}
function salto(g) {
  if (!isFinite(audio.duration) || audio.duration <= 0) return;
  audio.currentTime = Math.max(0, Math.min(audio.duration - 0.25, audio.currentTime + g));
  posicion();
}

function controlesBloqueo() {
  if (!('mediaSession' in navigator)) return;
  var mh = function (a, f) { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} };
  
  mh('play', function () {
    deberia = true;
    if (!audio.src || audio.error || audio.readyState === 0) { 
      if (or.length) { pendiente = audio.currentTime || 0; tocar(pos >= 0 ? pos : 0); }
      return; 
    }
    var pr = audio.play();
    if (pr && pr['catch']) pr['catch'](function (e) {
      if (or.length) { pendiente = audio.currentTime || 0; tocar(pos >= 0 ? pos : 0); }
    });
  });
  
  mh('pause', function () { deberia = false; audio.pause(); });
  mh('nexttrack', function () { sig(false); });
  mh('previoustrack', function () { ant(); });
  mh('seekto', function (d) {
    if (!d || !isFinite(d.seekTime) || !isFinite(audio.duration)) return;
    var t = Math.max(0, Math.min(audio.duration, d.seekTime));
    try {
      if (d.fastSeek && typeof audio.fastSeek === 'function') audio.fastSeek(t);
      else audio.currentTime = t;
    } catch (e) { try { audio.currentTime = t; } catch (x) {} }
    posicion();
  });
  if (ES_IOS) {
    mh('seekbackward', null); mh('seekforward', null);
  } else {
    mh('seekbackward', function (d) { salto(-((d && d.seekOffset) || SALTO_BLOQUEO)); });
    mh('seekforward', function (d) { salto((d && d.seekOffset) || SALTO_BLOQUEO); });
  }
}

function mediaInfo(s) {
  if (!('mediaSession' in navigator)) return;
  controlesBloqueo(); // Re-vincular los controles del sistema siempre
  var g = tags[s.id] || {};
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: g.t || s.n, artist: g.a || 'Google Drive', album: g.b || s.c || 'Mi Música',
      artwork: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }]
    });
  } catch (e) {}
  posicion();
}

function posicion() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  var dur = Number(audio.duration), cur = Number(audio.currentTime) || 0, vel = Number(audio.playbackRate) || 1;
  if (!isFinite(dur) || dur <= 0 || vel <= 0) return;
  try {
    navigator.mediaSession.setPositionState({ duration: dur, position: Math.max(0, Math.min(cur, dur)), playbackRate: vel });
  } catch (e) {}
}
function limpiarPosicion() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  try { navigator.mediaSession.setPositionState(); } catch (e) {}
}

function guardarSesion() {
  var a = act();
  guardar(LL.sesion, { id: a ? a.id : null, seg: a ? (audio.currentTime || 0) : 0, vol: audio.volume, alea: alea, rep: rep, fc: fc });
}

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
  if (!id) { e.textContent = 'Copia la dirección completa de Drive.'; e.className = 'err ver'; return; }
  if (!k) { e.textContent = 'Falta la clave API.'; e.className = 'err ver'; return; }
  e.className = 'err';
  $('bv').disabled = true; $('bv').textContent = 'Comprobando…';
  clave = k; carpeta = id;

  drive(urlHijos(id, null)).then(function () {
    guardar(LL.clave, clave); guardar(LL.carpeta, carpeta);
    cerrarInicio(); cargarBiblioteca(true);
  })['catch'](function (err) {
    e.textContent = err.message || String(err); e.className = 'err ver';
  }).then(function () {
    $('bv').disabled = false; $('bv').textContent = 'Empezar';
  });
};

function actualizarFavoritosUI(){
  var a=act(), mf=$('mfav');
  if(mf){mf.textContent=a&&esFavorito(a.id)?'♥':'♡'; mf.className='ico'+(a&&esFavorito(a.id)?' md on':'');}
  var bf=$('bfav'); if(bf) bf.textContent=Object.keys(favoritos).length?'♥ ('+Object.keys(favoritos).length+')':'♡ Favoritos';
}
function alternarFavorito(id){
  if(!id)return;
  if(favoritos[id]) delete favoritos[id]; else favoritos[id]=Date.now();
  guardar(LL.fav,favoritos); actualizarFavoritosUI(); pintar();
}
function mostrarFavoritos(){
  if(!Object.keys(favoritos).length){est('Todavía no tienes favoritos'); return;}
  $('bu').value=''; fc=''; $('fc').value='';
  vis=ambito().filter(function(i){return esFavorito(cn[i].id);}); dib=0;
  if(!vis.length){$('ls').innerHTML='<div class="va">Favoritos vacíos.</div>';return;}
  $('ls').innerHTML='<div class="sectionbar"><span>♥ FAVORITOS</span><span>'+vis.length+'</span></div><div id="fs"></div><div id="ms"></div>';mas();
}
function abrirFull(){
  var a=act(); if(!a)return;
  $('playerFull').style.display='flex'; actualizarFull();
}
function cerrarFull(){$('playerFull').style.display='none';}
function actualizarFull(){
  var a=act(), g=a?tags[a.id]:null;
  $('pfti').textContent=a?(g&&g.t||a.n):'Elige una canción';
  $('pfes').textContent=a?((g&&g.a)||a.c||'') : '';
  $('pfplay').textContent=audio.paused?'▶':'Ⅱ';
  $('pft1').textContent=fmt(audio.currentTime||0); $('pft2').textContent=fmt(audio.duration);
  $('pfpr').value=isFinite(audio.duration)&&audio.duration?audio.currentTime/audio.duration*1000:0;
}

$('ls').addEventListener('click', function (e) {
  var fav = e.target.closest ? e.target.closest('[data-fav]') : null;
  if (fav) { e.stopPropagation(); alternarFavorito(fav.getAttribute('data-fav')); return; }
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
  programarPrecarga(1000);
});
$('br').onclick = function () { cargarBiblioteca(true); };
$('bc').onclick = abrirInicio;
document.addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('#bo') : null;
  if (b) { e.preventDefault(); abrirInicio(); }
});
$('bfav').onclick = mostrarFavoritos;
$('mfav').onclick = function(){var a=act();if(a)alternarFavorito(a.id);};
$('expand').onclick = abrirFull;
$('closefull').onclick = cerrarFull;
$('pfplay').onclick = function(){ $('pl').onclick(); actualizarFull(); };
$('pfan').onclick = function(){ ant(); actualizarFull(); };
$('pfsi').onclick = function(){ sig(false); actualizarFull(); };
$('pfm10').onclick = function(){ salto(-10); actualizarFull(); };
$('pfd10').onclick = function(){ salto(10); actualizarFull(); };
$('pfpr').addEventListener('input',function(){if(isFinite(audio.duration))audio.currentTime=this.value/1000*audio.duration; actualizarFull();});

$('pl').onclick = function () {
  if (!or.length) return;
  if (pos < 0) { tocar(0); return; }
  if (!audio.src || audio.error || audio.readyState === 0) { 
    pendiente = audio.currentTime || 0;
    tocar(pos); 
    return; 
  }
  
  if (audio.paused) { 
    deberia = true; 
    var pr = audio.play(); 
    if (pr && pr['catch']) pr['catch'](function (e) {
        pendiente = audio.currentTime || 0;
        tocar(pos);
    }); 
  } 
  else { deberia = false; audio.pause(); }
};
$('si').onclick = function () { sig(false); };
$('an').onclick = ant;
$('d10').onclick = function () { salto(10); };
$('a10').onclick = function () { salto(-10); };
$('al').onclick = function () {
  alea = !alea; orden(pos >= 0 ? or[pos] : null);
  $('al').className = 'ico md' + (alea ? ' on' : '');
  est(alea ? 'Aleatorio ON' : 'Aleatorio OFF');
  guardarSesion(); programarPrecarga(1000);
};
$('re').onclick = function () {
  rep = rep === 'no' ? 'todas' : rep === 'todas' ? 'una' : 'no';
  $('re').className = 'ico md' + (rep !== 'no' ? ' on' : '');
  $('r1').style.display = rep === 'una' ? '' : 'none';
  est(rep === 'no' ? 'Repetir OFF' : rep === 'todas' ? 'Repetir Lista' : 'Repetir Canción');
  guardarSesion();
};
$('vo').oninput = function (e) { audio.volume = e.target.value / 100; guardarSesion(); };

$('pr').addEventListener('input', function () {
  arrastre = true;
  if (isFinite(audio.duration)) $('t1').textContent = fmt($('pr').value / 1000 * audio.duration);
});
$('pr').addEventListener('change', function () {
  if (isFinite(audio.duration)) audio.currentTime = $('pr').value / 1000 * audio.duration;
  arrastre = false; posicion();
});

var ultimo = 0;
audio.addEventListener('timeupdate', function () {
  if (arrastre || !isFinite(audio.duration)) return;
  $('pr').value = audio.currentTime / audio.duration * 1000;
  $('t1').textContent = fmt(audio.currentTime);
  
  if ($('playerFull').style.display === 'flex') {
    $('pfpr').value = audio.currentTime / audio.duration * 1000;
    $('pft1').textContent = fmt(audio.currentTime);
  }

  if (audio.buffered.length) {
    $('bf').style.width = Math.min(100, audio.buffered.end(audio.buffered.length - 1) / audio.duration * 100) + '%';
  }
  
  var n = Date.now();
  if (n - ultimo > 5000) { ultimo = n; guardarSesion(); posicion(); }
});

audio.addEventListener('loadedmetadata', function () {
  $('t2').textContent = fmt(audio.duration);
  if (pendiente > 0) { try { audio.currentTime = pendiente; } catch (e) {} pendiente = 0; }
  posicion(); actualizarFull();
});
audio.addEventListener('durationchange', posicion);
audio.addEventListener('seeked', posicion);

var recoveryTimer = null;
audio.addEventListener('playing', function () {
  if (recoveryTimer) { clearTimeout(recoveryTimer); recoveryTimer = null; }
  var a = act(); est(a ? (a.c || '') : '');
  programarPrecarga(2500);   
});

audio.addEventListener('waiting', function () { 
  if (deberia && !recoveryTimer) {
    recoveryTimer = setTimeout(function() {
      if (deberia && (audio.paused || audio.readyState < 3)) {
        pendiente = audio.currentTime || 0;
        tocar(pos);
      }
      recoveryTimer = null;
    }, 3000); 
  }
});

audio.addEventListener('ended', function () { sig(true); });

audio.addEventListener('play', function () {
  deberia = true;
  $('i1').style.display = 'none'; $('i2').style.display = '';
  try { navigator.mediaSession.playbackState = 'playing'; } catch (e) {}
  posicion(); actualizarFull();
  controlesBloqueo(); // Re-asegurar los controles del sistema al dar play
});

audio.addEventListener('pause', function () {
  $('i1').style.display = ''; $('i2').style.display = 'none';
  try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {}
  guardarSesion(); actualizarFull();
  if (act()) {
      var s = act();
      var g = tags[s.id] || {};
      try {
          navigator.mediaSession.metadata = new MediaMetadata({
              title: g.t || s.n,
              artist: g.a || 'Google Drive',
              album: g.b || s.c || 'Mi Música',
              artwork: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }]
          });
      } catch(e){}
  }
});

audio.addEventListener('error', function () {
  if (!audio.src || cargando) return;
  if (deberia && audio.currentTime > 0) {
      pendiente = audio.currentTime || 0;
      tocar(pos);
      return;
  }
  var mediaError = audio.error; var code = mediaError ? mediaError.code : 0;
  if (code === 1) return;
  est('No se pudo reproducir el archivo.');
});

window.addEventListener('beforeunload', function () { liberarAudioBlob(); guardarSesion(); });

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && $('playerFull').style.display === 'flex') { cerrarFull(); return; }
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

controlesBloqueo();

window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault(); instalador = e; $('bi').className = 'bt';
});
$('bi').onclick = function () {
  if (!instalador) return;
  instalador.prompt();
  instalador.userChoice.then(function () { instalador = null; $('bi').className = 'bt oculto'; });
};
window.addEventListener('appinstalled', function () { $('bi').className = 'bt oculto'; });

(function () {
  if (navigator.serviceWorker) navigator.serviceWorker.register('sw.js')['catch'](function () {});
  audio.volume = 0.9;
  clave = window.API_KEY || leer(LL.clave, '') || '';
  carpeta = window.CARPETA ? sacarId(window.CARPETA) : (leer(LL.carpeta, '') || '');
  if (clave && carpeta) cargarBiblioteca(false); else abrirInicio();
})();
