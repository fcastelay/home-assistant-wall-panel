// La página del panel: HTML, estilo y guion, todo en un archivo y sin dependencias.
//
// POR QUE SIN NINGUNA LIBRERIA, ni siquiera por CDN
//
// Este panel corre en el NAS, en la red de casa, y su trabajo es decir si la estación está
// subiendo datos. Si para dibujarse necesita bajar Tailwind de internet, entonces el día que
// se corte internet —justo el día en que uno quiere saber si los datos están saliendo— el
// panel aparece en blanco. Una herramienta de diagnóstico no puede depender de lo que está
// diagnosticando.
//
// El gráfico se dibuja con canvas a mano por la misma razón, y son treinta líneas.
//
// OJO AL EDITAR: todo esto vive dentro de una plantilla de JavaScript. **No se puede escribir
// un acento grave acá adentro**, ni un dólar seguido de llave: cierran la plantilla y el error
// de sintaxis aparece cuarenta líneas más abajo, en un lugar que no tiene nada que ver. Ya
// pasó. El guion de la página usa concatenación con + por eso mismo.

export const PAGINA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Puente Ecowitt</title>
<style>
  :root {
    --fondo: #0f1419; --panel: #1a2027; --borde: #2a333d; --texto: #e6edf3;
    --suave: #8b98a5; --ok: #3fb950; --mal: #f85149; --aviso: #d29922; --acento: #58a6ff;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --fondo: #f4f6f8; --panel: #fff; --borde: #dde3ea; --texto: #1a2027;
      --suave: #5b6b7b; --ok: #1a7f37; --mal: #cf222e; --aviso: #9a6700; --acento: #0969da;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fondo); color: var(--texto); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { padding: 14px 20px; border-bottom: 1px solid var(--borde); display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
  h1 { font-size: 17px; margin: 0; font-weight: 600; }
  h2 { font-size: 14px; margin: 0 0 12px; color: var(--suave); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  main { padding: 20px; max-width: 1200px; margin: 0 auto; }
  .pill { font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--borde); color: var(--suave); }
  .pill.ok { color: var(--ok); border-color: var(--ok); }
  .pill.mal { color: var(--mal); border-color: var(--mal); }
  nav { margin-left: auto; display: flex; gap: 4px; }
  nav button { background: none; border: 1px solid transparent; color: var(--suave); padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 14px; }
  nav button.sel { background: var(--panel); border-color: var(--borde); color: var(--texto); }
  section { display: none; }
  section.sel { display: block; }
  .caja { background: var(--panel); border: 1px solid var(--borde); border-radius: 12px; padding: 16px; margin-bottom: 18px; }
  .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .dato { background: var(--fondo); border: 1px solid var(--borde); border-radius: 10px; padding: 12px; }
  .dato .v { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .dato .e { font-size: 12px; color: var(--suave); }
  .dato .u { font-size: 13px; color: var(--suave); font-weight: 400; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-size: 12px; color: var(--suave); text-transform: uppercase; letter-spacing: .04em; padding: 6px 8px; border-bottom: 1px solid var(--borde); font-weight: 600; }
  td { padding: 9px 8px; border-bottom: 1px solid var(--borde); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .punto { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 7px; }
  .p-ok { background: var(--ok); } .p-mal { background: var(--mal); } .p-off { background: var(--suave); } .p-esp { background: var(--aviso); }
  button.acc { background: var(--fondo); border: 1px solid var(--borde); color: var(--texto); border-radius: 7px; padding: 4px 10px; cursor: pointer; font-size: 13px; margin-right: 4px; }
  button.acc:hover { border-color: var(--acento); color: var(--acento); }
  button.pri { background: var(--acento); border-color: var(--acento); color: #fff; }
  button.peli:hover { border-color: var(--mal); color: var(--mal); }
  label { display: block; font-size: 13px; color: var(--suave); margin: 10px 0 4px; }
  input, select, textarea { width: 100%; background: var(--fondo); border: 1px solid var(--borde); color: var(--texto); border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 14px; }
  textarea { min-height: 60px; font-family: ui-monospace, monospace; font-size: 13px; }
  .fila { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .log { font-family: ui-monospace, monospace; font-size: 12.5px; max-height: 340px; overflow-y: auto; }
  .log div { padding: 3px 0; border-bottom: 1px solid var(--borde); }
  .log .h { color: var(--suave); margin-right: 8px; }
  .log .error { color: var(--mal); } .log .aviso { color: var(--aviso); } .log .ok { color: var(--ok); }
  .nota { font-size: 13px; color: var(--suave); margin: 6px 0 0; }
  .amarillo { color: var(--aviso); }
  canvas { width: 100%; height: 110px; display: block; }
  .vacio { color: var(--suave); text-align: center; padding: 24px; font-size: 14px; }
  @media (max-width: 640px) { .fila { grid-template-columns: 1fr; } main { padding: 12px; } }
</style>
</head>
<body>
<header>
  <h1>Puente Ecowitt</h1>
  <span class="pill" id="p-estacion">estación…</span>
  <span class="pill" id="p-mqtt">MQTT…</span>
  <span class="pill" id="p-destinos">destinos…</span>
  <nav>
    <button data-v="monitor" class="sel">Monitor</button>
    <button data-v="destinos">Destinos</button>
    <button data-v="ajustes">Ajustes</button>
  </nav>
</header>
<main>

<section id="v-monitor" class="sel">
  <div class="caja">
    <h2>Última lectura <span id="cuando" class="nota" style="text-transform:none;letter-spacing:0"></span></h2>
    <div class="grilla" id="datos"></div>
  </div>
  <div class="caja">
    <h2>Temperatura exterior · últimas horas</h2>
    <canvas id="grafico"></canvas>
    <p class="nota" id="grafico-nota"></p>
  </div>
  <div class="caja">
    <h2>Destinos</h2>
    <table><thead><tr>
      <th>Destino</th><th>Servicio</th><th>Último intento</th><th>Resultado</th>
      <th>Latencia</th><th>OK / fallos</th><th></th>
    </tr></thead><tbody id="tabla-destinos"></tbody></table>
  </div>
  <div class="caja">
    <h2>Eventos</h2>
    <div class="log" id="log"></div>
  </div>
</section>

<section id="v-destinos">
  <div class="caja">
    <h2 id="titulo-form">Nuevo destino</h2>
    <div class="fila">
      <div>
        <label>Nombre (así se va a llamar en Home Assistant)</label>
        <input id="f-nombre" placeholder="Windy de casa">
      </div>
      <div>
        <label>Servicio</label>
        <select id="f-receta"></select>
      </div>
    </div>
    <p class="nota" id="f-notas"></p>
    <div id="f-credenciales"></div>
    <div class="fila">
      <div>
        <label>Intervalo mínimo entre envíos (segundos, 0 = cada envío)</label>
        <input id="f-intervalo" type="number" min="0" step="10" value="0">
      </div>
      <div>
        <label>Reintentos ante un fallo pasajero</label>
        <input id="f-reintentos" type="number" min="0" max="5" value="2">
      </div>
    </div>
    <label><input type="checkbox" id="f-activo" style="width:auto;margin-right:8px">Activo</label>
    <p class="nota">Un destino nuevo se guarda apagado a propósito: primero se lo prueba con
      <b>Probar</b> y recién después se lo enciende. Uno que arranca prendido puede estar
      mandando mal durante días sin que nadie lo mire.</p>
    <div style="margin-top:14px">
      <button class="acc pri" id="b-guardar">Guardar destino</button>
      <button class="acc" id="b-cancelar" style="display:none">Cancelar</button>
    </div>
  </div>
  <div class="caja">
    <h2>Configurados</h2>
    <table><thead><tr><th>Destino</th><th>Servicio</th><th>Intervalo</th><th>Estado</th><th></th></tr></thead>
    <tbody id="tabla-config"></tbody></table>
  </div>
</section>

<section id="v-ajustes">
  <div class="caja">
    <h2>Home Assistant · MQTT</h2>
    <div class="fila">
      <div><label>Host del broker</label><input id="m-host" placeholder="TU_HOST_HA"></div>
      <div><label>Puerto</label><input id="m-puerto" type="number" value="1883"></div>
    </div>
    <div class="fila">
      <div><label>Usuario</label><input id="m-usuario"></div>
      <div><label>Contraseña</label><input id="m-clave" type="password" placeholder="(sin cambios)"></div>
    </div>
    <label>Prefijo de auto-descubrimiento</label><input id="m-prefijo" value="homeassistant">
    <p class="nota">Vacío = se usan las variables de entorno del contenedor
      (MQTT_HOST, MQTT_USUARIO, MQTT_CLAVE). Lo que se cargue acá tiene prioridad.
      Los cambios de MQTT necesitan reiniciar el contenedor.</p>
  </div>
  <div class="caja">
    <h2>Estación</h2>
    <div class="fila">
      <div><label>Nombre del aparato en Home Assistant</label><input id="a-estacion"></div>
      <div><label>Raíz de los temas MQTT</label><input id="a-base"></div>
    </div>
    <p class="nota">Cambiar la raíz crea entidades nuevas en Home Assistant y deja huérfanas las
      viejas. Se cambia una vez, al principio.</p>
    <div style="margin-top:14px"><button class="acc pri" id="b-ajustes">Guardar ajustes</button></div>
  </div>
</section>

</main>
<script>
var CLAVE = sessionStorage.getItem('clave') || '';

function pedir (ruta, opciones) {
  opciones = opciones || {};
  opciones.headers = Object.assign({ 'x-clave': CLAVE }, opciones.headers || {});
  return fetch(ruta, opciones).then(function (r) {
    if (r.status === 401) {
      var c = prompt('Clave del panel:');
      if (c) { CLAVE = c; sessionStorage.setItem('clave', c); return pedir(ruta, opciones); }
      throw new Error('sin clave');
    }
    return r.json();
  });
}

// ---------------------------------------------------------------- pestañas
var botones = document.querySelectorAll('nav button');
for (var i = 0; i < botones.length; i++) {
  botones[i].onclick = function () {
    var v = this.dataset.v;
    for (var j = 0; j < botones.length; j++) botones[j].classList.toggle('sel', botones[j].dataset.v === v);
    var secs = document.querySelectorAll('section');
    for (var k = 0; k < secs.length; k++) secs[k].classList.toggle('sel', secs[k].id === 'v-' + v);
    if (v !== 'monitor') cargarConfig();
  };
}

// ---------------------------------------------------------------- monitor
var UNIDADES = {
  temp_ext: ['Exterior', '°C'], temp_int: ['Interior', '°C'], hum_ext: ['Humedad', '%'],
  hum_int: ['Humedad int.', '%'], viento: ['Viento', 'km/h'], rafaga: ['Ráfaga', 'km/h'],
  viento_dir: ['Dirección', '°'], presion_rel: ['Presión', 'hPa'], lluvia_dia: ['Lluvia hoy', 'mm'],
  lluvia_tasa: ['Intensidad', 'mm/h'], uv: ['UV', ''], solar: ['Solar', 'W/m²'],
  rocio: ['Rocío', '°C'], pm25: ['PM2.5', 'µg/m³'], co2: ['CO2', 'ppm']
};

function hhmm (iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
function hace (iso) {
  if (!iso) return 'nunca';
  var s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(s)) return '—';
  if (s < 60) return 'hace ' + s + ' s';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
  return 'hace ' + Math.round(s / 86400) + ' d';
}
function esc (t) {
  return String(t === null || t === undefined ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pintarEstado (e) {
  var pe = document.getElementById('p-estacion');
  pe.textContent = e.puente.recibidos ? 'estación · ' + hace(e.puente.ultimo) : 'estación · sin datos aún';
  pe.className = 'pill ' + (e.puente.recibidos ? (e.puente.muda === 'ON' ? 'mal' : 'ok') : '');
  var pm = document.getElementById('p-mqtt');
  pm.textContent = 'MQTT · ' + (e.mqtt.conectado ? 'conectado' : (e.mqtt.motivo || 'desconectado'));
  pm.className = 'pill ' + (e.mqtt.conectado ? 'ok' : 'mal');
  var caidos = 0;
  for (var i = 0; i < e.destinos.length; i++) if (e.destinos[i].activo && e.destinos[i].problema) caidos++;
  var pd = document.getElementById('p-destinos');
  pd.textContent = e.destinos.length + ' destinos' + (caidos ? ' · ' + caidos + ' con problemas' : '');
  pd.className = 'pill ' + (caidos ? 'mal' : (e.destinos.length ? 'ok' : ''));

  document.getElementById('cuando').textContent = e.puente.ultimo
    ? hhmm(e.puente.ultimo) + ' · ' + hace(e.puente.ultimo) + ' · ' + e.puente.recibidos + ' envíos'
    : '';

  var h = '';
  for (var k in UNIDADES) {
    if (e.datos[k] === undefined || e.datos[k] === null) continue;
    h += '<div class="dato"><div class="e">' + UNIDADES[k][0] + '</div><div class="v">' +
      esc(e.datos[k]) + ' <span class="u">' + UNIDADES[k][1] + '</span></div></div>';
  }
  document.getElementById('datos').innerHTML = h ||
    '<div class="vacio">Todavía no llegó ningún envío de la estación.</div>';

  var t = '';
  for (var j = 0; j < e.destinos.length; j++) {
    var d = e.destinos[j];
    var clase = !d.activo ? 'p-off' : (d.esperando ? 'p-esp' : (d.problema ? 'p-mal' : (d.ultimo_ok ? 'p-ok' : 'p-off')));
    t += '<tr><td><span class="punto ' + clase + '"></span>' + esc(d.nombre) + '</td>' +
      '<td>' + esc(d.servicio) + (d.verificado === false ? ' <span class="amarillo" title="receta sin probar contra el servicio real">sin verificar</span>' : '') + '</td>' +
      '<td>' + hace(d.ultimo_intento) + '</td>' +
      '<td>' + esc(d.detalle || (d.activo ? '—' : 'apagado')) + '</td>' +
      '<td>' + (d.latencia ? d.latencia + ' ms' : '—') + '</td>' +
      '<td>' + (d.enviados || 0) + ' / ' + (d.fallidos || 0) + '</td>' +
      '<td><button class="acc" onclick="probar(\\'' + esc(d.nombre).replace(/'/g, '') + '\\')">Probar</button></td></tr>';
  }
  document.getElementById('tabla-destinos').innerHTML = t ||
    '<tr><td colspan="7" class="vacio">Ningún destino configurado. El puente archiva igual.</td></tr>';

  var l = '';
  for (var m = 0; m < e.log.length; m++) {
    l += '<div><span class="h">' + hhmm(e.log[m].t) + '</span><span class="' + e.log[m].nivel + '">' +
      esc(e.log[m].texto) + '</span></div>';
  }
  document.getElementById('log').innerHTML = l || '<div class="vacio">Sin eventos.</div>';

  dibujar(e.historial);
}

function dibujar (h) {
  var c = document.getElementById('grafico');
  var ctx = c.getContext('2d');
  var an = c.clientWidth, al = 110;
  c.width = an * devicePixelRatio; c.height = al * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, an, al);
  var pts = [];
  for (var i = 0; i < h.length; i++) if (h[i].temp !== null) pts.push(h[i].temp);
  var nota = document.getElementById('grafico-nota');
  if (pts.length < 2) {
    nota.textContent = 'Hacen falta al menos dos lecturas. Van ' + pts.length + '.';
    return;
  }
  var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
  if (max - min < 1) { max = max + 0.5; min = min - 0.5; }
  var est = getComputedStyle(document.body);
  ctx.strokeStyle = est.getPropertyValue('--acento') || '#58a6ff';
  ctx.lineWidth = 2; ctx.beginPath();
  for (var j = 0; j < pts.length; j++) {
    var x = (j / (pts.length - 1)) * (an - 4) + 2;
    var y = al - 12 - ((pts[j] - min) / (max - min)) * (al - 26);
    if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
  nota.textContent = pts.length + ' lecturas · mínima ' + min.toFixed(1) + ' °C · máxima ' +
    max.toFixed(1) + ' °C · el historial del panel se borra al reiniciar (el archivo crudo, no)';
}

function probar (nombre) {
  pedir('/api/probar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: nombre })
  }).then(function (r) {
    alert(r.ok ? 'OK · ' + (r.detalle || '') : 'Falló · ' + (r.detalle || 'sin detalle'));
    refrescar();
  });
}

function refrescar () { pedir('/api/estado').then(pintarEstado).catch(function () {}); }

// ---------------------------------------------------------------- configuración
var RECETAS = [], CONFIG = null, EDITANDO = null;

function cargarRecetas () {
  return pedir('/api/recetas').then(function (r) {
    RECETAS = r;
    var s = document.getElementById('f-receta');
    var h = '';
    for (var i = 0; i < r.length; i++) {
      h += '<option value="' + r[i].id + '">' + esc(r[i].nombre) + (r[i].verificado ? '' : ' · sin verificar') + '</option>';
    }
    s.innerHTML = h;
    s.onchange = pintarCampos;
    pintarCampos();
  });
}

function recetaSel () {
  var id = document.getElementById('f-receta').value;
  for (var i = 0; i < RECETAS.length; i++) if (RECETAS[i].id === id) return RECETAS[i];
  return null;
}

function pintarCampos (valores) {
  var r = recetaSel();
  if (!r) return;
  document.getElementById('f-notas').innerHTML =
    (r.verificado ? '' : '<b class="amarillo">Receta sin verificar contra el servicio real.</b> ') +
    esc(r.notas) + (r.doc ? ' <a href="' + esc(r.doc) + '" target="_blank" rel="noopener">documentación</a>' : '');
  var h = '';
  for (var i = 0; i < r.campos.length; i++) {
    var c = r.campos[i];
    var v = valores && valores[c.clave] ? valores[c.clave] : '';
    h += '<label>' + esc(c.etiqueta) + (c.obligatorio ? '' : ' <span class="nota">(opcional)</span>') + '</label>' +
      '<input data-cred="' + c.clave + '"' + (c.secreto ? ' type="password" placeholder="(sin cambios)"' : '') +
      ' value="' + esc(c.secreto ? '' : v) + '">';
  }
  document.getElementById('f-credenciales').innerHTML = h;
  if (!valores) document.getElementById('f-intervalo').value = r.intervalo_sug || 0;
}

function cargarConfig () {
  return pedir('/api/config').then(function (c) {
    CONFIG = c;
    document.getElementById('m-host').value = c.mqtt.host || '';
    document.getElementById('m-puerto').value = c.mqtt.puerto || 1883;
    document.getElementById('m-usuario').value = c.mqtt.usuario || '';
    document.getElementById('m-prefijo').value = c.mqtt.prefijo || 'homeassistant';
    document.getElementById('a-estacion').value = c.ajustes.estacion || '';
    document.getElementById('a-base').value = c.ajustes.base || '';
    var h = '';
    for (var i = 0; i < c.destinos.length; i++) {
      var d = c.destinos[i];
      var n = esc(d.nombre).replace(/'/g, '');
      h += '<tr><td>' + esc(d.nombre) + '</td><td>' + esc(d.receta || d.tipo) + '</td>' +
        '<td>' + (d.intervalo_min ? d.intervalo_min + ' s' : 'cada envío') + '</td>' +
        '<td>' + (d.activo ? '<span class="punto p-ok"></span>activo' : '<span class="punto p-off"></span>apagado') + '</td>' +
        '<td style="text-align:right">' +
        '<button class="acc" onclick="editar(\\'' + n + '\\')">Editar</button>' +
        '<button class="acc" onclick="alternar(\\'' + n + '\\')">' + (d.activo ? 'Apagar' : 'Encender') + '</button>' +
        '<button class="acc peli" onclick="borrar(\\'' + n + '\\')">Borrar</button></td></tr>';
    }
    document.getElementById('tabla-config').innerHTML = h ||
      '<tr><td colspan="5" class="vacio">Ninguno todavía.</td></tr>';
  });
}

function buscar (nombre) {
  for (var i = 0; i < CONFIG.destinos.length; i++) if (CONFIG.destinos[i].nombre === nombre) return CONFIG.destinos[i];
  return null;
}

function editar (nombre) {
  var d = buscar(nombre);
  if (!d) return;
  EDITANDO = nombre;
  document.getElementById('titulo-form').textContent = 'Editando: ' + nombre;
  document.getElementById('f-nombre').value = d.nombre;
  document.getElementById('f-receta').value = d.receta || 'webhook';
  pintarCampos(d.credenciales || {});
  document.getElementById('f-intervalo').value = d.intervalo_min || 0;
  document.getElementById('f-reintentos').value = d.reintentos === undefined ? 2 : d.reintentos;
  document.getElementById('f-activo').checked = !!d.activo;
  document.getElementById('b-cancelar').style.display = '';
  window.scrollTo(0, 0);
}

document.getElementById('b-cancelar').onclick = function () {
  EDITANDO = null;
  document.getElementById('titulo-form').textContent = 'Nuevo destino';
  document.getElementById('f-nombre').value = '';
  document.getElementById('f-activo').checked = false;
  document.getElementById('b-cancelar').style.display = 'none';
  pintarCampos();
};

document.getElementById('b-guardar').onclick = function () {
  var cred = {};
  var ins = document.querySelectorAll('#f-credenciales input');
  for (var i = 0; i < ins.length; i++) cred[ins[i].dataset.cred] = ins[i].value;
  var d = {
    nombre: document.getElementById('f-nombre').value.trim(),
    tipo: 'receta',
    receta: document.getElementById('f-receta').value,
    credenciales: cred,
    intervalo_min: Number(document.getElementById('f-intervalo').value) || 0,
    reintentos: Number(document.getElementById('f-reintentos').value) || 0,
    activo: document.getElementById('f-activo').checked
  };
  if (!d.nombre) { alert('Falta el nombre.'); return; }
  pedir('/api/destino', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anterior: EDITANDO, destino: d })
  }).then(function (r) {
    if (r.error) { alert(r.error); return; }
    if (r.faltan && r.faltan.length) alert('Guardado, pero le faltan credenciales: ' + r.faltan.join(', '));
    document.getElementById('b-cancelar').onclick();
    cargarConfig();
  });
};

function alternar (nombre) {
  var d = buscar(nombre);
  if (!d) return;
  pedir('/api/destino', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anterior: nombre, destino: { nombre: nombre, activo: !d.activo } })
  }).then(cargarConfig);
}

function borrar (nombre) {
  if (!confirm('Borrar "' + nombre + '"?\\n\\nSe quitan también sus entidades de Home Assistant.')) return;
  pedir('/api/destino?nombre=' + encodeURIComponent(nombre), { method: 'DELETE' }).then(cargarConfig);
}

document.getElementById('b-ajustes').onclick = function () {
  pedir('/api/config', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mqtt: {
        host: document.getElementById('m-host').value.trim(),
        puerto: Number(document.getElementById('m-puerto').value) || 1883,
        usuario: document.getElementById('m-usuario').value.trim(),
        clave: document.getElementById('m-clave').value,
        prefijo: document.getElementById('m-prefijo').value.trim() || 'homeassistant'
      },
      ajustes: {
        estacion: document.getElementById('a-estacion').value.trim(),
        base: document.getElementById('a-base').value.trim() || 'estacion'
      }
    })
  }).then(function (r) {
    document.getElementById('m-clave').value = '';
    alert(r.error ? r.error : 'Guardado. Los cambios de MQTT se aplican al reiniciar el contenedor.');
    cargarConfig();
  });
};

cargarRecetas().then(cargarConfig);
refrescar();
setInterval(refrescar, 5000);
</script>
</body>
</html>`
