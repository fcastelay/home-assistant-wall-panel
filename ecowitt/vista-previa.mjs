// Genera una vista previa autónoma del panel, con datos de ejemplo.
//
//   node scripts/ecowitt/vista-previa.mjs [archivo.html]
//
// POR QUE EXISTE
//
// El panel vive dentro de la imagen del contenedor, así que para ver un cambio de diseño hay
// que reconstruirla y —en este Synology— eliminar y recrear el proyecto. Eso es mucha ceremonia
// para mirar si un espaciado quedó bien.
//
// Esto toma **la página real, sin copiarla**, le enchufa un `fetch` de mentira con una lectura
// verosímil, y escribe un HTML que se abre con doble clic. Lo que se ve es exactamente lo que
// va a servir el contenedor: si acá está bien, allá está bien.
//
// NO SE DUPLICA EL DISEÑO, Y ESA ES LA REGLA. Un segundo archivo con "más o menos el mismo
// HTML" se desincroniza en la primera corrección y termina mintiendo. Acá el estilo y el guion
// salen de `_pagina.mjs`; lo único propio de este archivo son los datos inventados.
//
// LOS DATOS SON INVENTADOS Y LA PAGINA LO DICE, arriba de todo y en el título. Una página que
// muestra mediciones fabricadas sin avisarlo es una página que engaña, aunque el que la hizo
// supiera que eran de ejemplo.

import fs from 'node:fs'
import { PAGINA } from './_pagina.mjs'

const SALIDA = process.argv[2] || 'vista-previa.html'

// Una tarde de primavera con tormenta acercándose: presión bajando, viento del noreste
// entrando fuerte, algo de lluvia acumulada. Los números son coherentes entre sí a propósito
// —el rocío por debajo de la temperatura, la ráfaga por encima del viento— porque una lectura
// imposible haría dudar del panel en vez de mostrarlo.
const DATOS = {
  estacion: 'GW3000A_V1.0.5', intervalo: 60,
  fecha_iso: new Date().toISOString(),
  temp_ext: 16.5, temp_ext_imp: 61.7, temp_int: 22.5,
  hum_ext: 64, hum_int: 48, rocio: 9.7, sensacion: 15.1,
  presion_rel: 1009.4, presion_abs: 1006.2,
  viento: 24.1, rafaga: 41.8, rafaga_max_dia: 52.3, viento_dir: 45,
  lluvia_tasa: 1.8, lluvia_hora: 1.27, lluvia_dia: 3.05, lluvia_mes: 31.2,
  solar: 210.5, uv: 2, pm25: 11, tierra_1: 42,
}

const DESTINOS = [
  { nombre: 'Home Assistant', servicio: 'Home Assistant (webhook Ecowitt)', verificado: true,
    activo: true, ultimo_intento: hace(38), ultimo_ok: hace(38), detalle: 'ok',
    latencia: 41, enviados: 1184, fallidos: 0, esperando: false, problema: false },
  { nombre: 'Windy', servicio: 'Windy', verificado: false,
    activo: true, ultimo_intento: hace(212), ultimo_ok: hace(212), detalle: 'ok',
    latencia: 386, enviados: 237, fallidos: 2, esperando: false, problema: false },
  { nombre: 'Windguru', servicio: 'Windguru', verificado: false,
    activo: true, ultimo_intento: hace(140), ultimo_ok: hace(9400), detalle: 'HTTP 401 · bad hash',
    latencia: 512, enviados: 88, fallidos: 31, esperando: false, problema: true },
  { nombre: 'Weathercloud', servicio: 'Weathercloud', verificado: false,
    activo: true, ultimo_intento: hace(190), ultimo_ok: hace(190), detalle: 'espera 410 s',
    latencia: 274, enviados: 42, fallidos: 0, esperando: true, problema: false },
  { nombre: 'Base propia', servicio: 'Webhook genérico (JSON)', verificado: true,
    activo: false, ultimo_intento: null, ultimo_ok: null, detalle: null,
    latencia: null, enviados: 0, fallidos: 0, esperando: false, problema: false },
]

function hace (segundos) { return new Date(Date.now() - segundos * 1000).toISOString() }

/** Una curva de temperatura de las últimas cuatro horas, cayendo con la tormenta. */
function historial () {
  const l = []
  for (let i = 240; i >= 0; i--) {
    const t = 19.4 - (240 - i) * 0.012 + Math.sin(i / 11) * 0.35 + Math.sin(i / 3.3) * 0.12
    l.push({ t: hace(i * 60), temp: Math.round(t * 10) / 10, hum: 64, viento: 24, presion: 1009, lluvia: 3 })
  }
  return l
}

const ESTADO = {
  puente: { recibidos: 1184, ultimo: hace(38), muda: 'OFF', seco: false },
  mqtt: { conectado: true, motivo: '' },
  datos: DATOS,
  destinos: DESTINOS,
  historial: historial(),
  log: [
    { t: hace(38), nivel: 'info', texto: '#1184  ext 16.5° · int 22.5° · viento NN km/h · lluvia 3.05 mm' },
    { t: hace(37), nivel: 'ok', texto: '3 destinos al día' },
    { t: hace(37), nivel: 'error', texto: 'Windguru: HTTP 401 · bad hash' },
    { t: hace(98), nivel: 'info', texto: '#1183  ext 16.6° · int 22.5° · viento NN km/h · lluvia 2.79 mm' },
    { t: hace(600), nivel: 'aviso', texto: 'MQTT se cayó (el broker cerró la conexión). Reintento en 5 s.' },
    { t: hace(595), nivel: 'info', texto: '41 entidades anunciadas a Home Assistant (conexión al broker)' },
  ],
}

const RECETAS = [
  { id: 'homeassistant', nombre: 'Home Assistant (webhook Ecowitt)', verificado: true, intervalo_sug: 0,
    doc: 'https://www.home-assistant.io/integrations/ecowitt/',
    notas: 'Reenvía el cuerpo tal cual llegó, sin interpretar nada. El identificador del webhook lo muestra Home Assistant en Ajustes → Dispositivos y servicios → Ecowitt → Configurar.',
    campos: [{ clave: 'url_base', etiqueta: 'URL de Home Assistant', obligatorio: true },
             { clave: 'webhook', etiqueta: 'ID del webhook', secreto: true, obligatorio: true }] },
  { id: 'windy', nombre: 'Windy', verificado: false, intervalo_sug: 300, doc: '',
    notas: 'Windy pide métrico: grados Celsius, metros por segundo, pascales y milímetros de la última hora.',
    campos: [{ clave: 'api_key', etiqueta: 'API key de Windy', secreto: true, obligatorio: true },
             { clave: 'station', etiqueta: 'Nº de estación', obligatorio: false }] },
]

const CONFIG = {
  mqtt: { host: '', puerto: 1883, usuario: 'mqtt', clave: '••••••', prefijo: 'homeassistant' },
  ajustes: { estacion: 'Estación meteorológica', base: 'estacion', historial: 200 },
  destinos: [
    { nombre: 'Home Assistant', tipo: 'receta', receta: 'homeassistant', intervalo_min: 0, activo: true, credenciales: { url_base: 'http://mi-servidor:8123', webhook: '••••••' } },
    { nombre: 'Windy', tipo: 'receta', receta: 'windy', intervalo_min: 300, activo: true, credenciales: { api_key: '••••••', station: '0' } },
    { nombre: 'Windguru', tipo: 'receta', receta: 'windguru', intervalo_min: 300, activo: true, credenciales: {} },
    { nombre: 'Weathercloud', tipo: 'receta', receta: 'weathercloud', intervalo_min: 600, activo: true, credenciales: {} },
    { nombre: 'Base propia', tipo: 'receta', receta: 'webhook', intervalo_min: 0, activo: false, credenciales: {} },
  ],
}

// ---------------------------------------------------------------- el injerto

/**
 * Reemplaza `fetch` antes de que corra el guion de la página.
 *
 * La página no se entera: pide `/api/estado` como siempre y recibe lo de arriba. Por eso lo
 * que se ve es el comportamiento real —el giro de la barba, los estados de la tabla, los
 * formularios armados desde las recetas— y no una maqueta.
 */
const INJERTO = [
  '<script>',
  'var RESPUESTAS = {',
  '  "/api/estado": ' + JSON.stringify(ESTADO) + ',',
  '  "/api/recetas": ' + JSON.stringify(RECETAS) + ',',
  '  "/api/config": ' + JSON.stringify(CONFIG),
  '};',
  'window.fetch = function (ruta, opciones) {',
  '  var r = RESPUESTAS[String(ruta).split("?")[0]];',
  '  if (!r && /destino|probar|config/.test(String(ruta))) r = { ok: true };',
  '  return Promise.resolve({ status: 200, json: function () { return Promise.resolve(r || {}); } });',
  '};',
  '</script>',
].join('\n')

// El aviso. Va arriba de todo y no se puede cerrar: una página con mediciones inventadas tiene
// que decirlo mientras se la mira, no en una nota al pie.
const AVISO = [
  '<div style="background:var(--sodio);color:#fff;padding:8px 26px;font:600 12px/1.4 system-ui,sans-serif;',
  'letter-spacing:.06em">VISTA PREVIA · los datos son inventados. El panel real corre en el NAS y',
  ' muestra la estación de verdad.</div>',
].join('')

// Los dos bloques que necesita el visor de artefactos: cuando alguien elige tema a mano, se
// estampa data-theme en la raíz y `prefers-color-scheme` deja de alcanzar. En el contenedor no
// hacen falta —no hay selector de tema— así que se agregan sólo acá.
const TEMAS = [
  '<style>',
  ':root[data-theme="dark"] {',
  '  --papel:#0e181d; --papel-alto:#14222a; --tinta:#d8e3e5; --tinta-media:#9fb2b8;',
  '  --tinta-suave:#75898f; --isobara:#24383f; --isobara-fina:#1b2c33;',
  '  --frio:#5aa5d6; --calor:#e0666a; --sodio:#e0a44e; --sombra:none;',
  '}',
  ':root[data-theme="light"] {',
  '  --papel:#e6eae9; --papel-alto:#f3f6f5; --tinta:#16262c; --tinta-media:#3d565f;',
  '  --tinta-suave:#6d838b; --isobara:#c2cbca; --isobara-fina:#d5dcdb;',
  '  --frio:#1d5f8a; --calor:#a83236; --sodio:#b3701a; --sombra:0 1px 0 rgba(22,38,44,.04);',
  '}',
  '</style>',
].join('\n')

let html = PAGINA
  .replace('</head>', TEMAS + '\n</head>')
  .replace('<body>', '<body>\n' + INJERTO + '\n' + AVISO)

// LA GUARDA. Este archivo esta hecho para mostrarselo a alguien, asi que antes de escribirlo
// se revisa que no se haya colado un secreto de verdad. No alcanza con "los datos son
// inventados": la pagina real trae marcadores de posicion, y manaña alguien podria poner un
// ejemplo copiado de su instalacion sin pensarlo.
//
// Se revisa por FORMA, no por lista de valores conocidos: una lista se olvida del proximo.
const PELIGROS = [
  [/eyJ[A-Za-z0-9_-]{20,}/, 'un token JWT'],
  [/\/api\/webhook\/[A-Za-z0-9_-]{12,}/, 'un identificador de webhook real'],
  [/\b[0-9a-f]{32,}\b/i, 'un identificador largo que parece una credencial'],
  // OJO CON ESTA: la primera version incluia `clave` y se disparaba sola, porque en el
  // esquema de las recetas `clave` es el NOMBRE de un campo ("clave":"url_base"), no una
  // contraseña. Una guarda que grita siempre se termina desactivando, y ese es el peor final
  // posible para una guarda. Se pide valor largo y que no sean los puntitos del enmascarado.
  [/(password|passwd|secret|apikey|api_key|access_token)["'\s]*[:=]["'\s]*(?![•*]+)[^"'\s,;}]{12,}/i,
   'algo con forma de contraseña'],
]
for (const [re, que] of PELIGROS) {
  const m = html.match(re)
  if (m) {
    console.error('NO SE ESCRIBE: la vista previa contiene ' + que + '.')
    console.error('   cerca de: ...' + html.slice(Math.max(0, m.index - 40), m.index).slice(-40) + '[...]')
    process.exit(1)
  }
}
const ips = [...new Set((html.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []))]
if (ips.length) console.log('    direcciones que quedan (revisar que sean de ejemplo): ' + ips.join(', '))

fs.writeFileSync(SALIDA, html)
console.log('=== vista previa escrita en ' + SALIDA)
console.log('    ' + Math.round(html.length / 1024) + ' KB, sin pedir nada a la red')
console.log('    Se abre con doble clic. Lo que se ve es la página real con datos de ejemplo.')
