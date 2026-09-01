// Una receta por servicio: qué URL arma, con qué unidades y qué credenciales pide.
//
// POR QUE UNA RECETA Y NO UN TRADUCTOR POR SERVICIO
//
// Todos estos servicios hacen lo mismo —un GET con los datos en la URL— y se diferencian en
// tres cosas: cómo se llama cada campo, en qué unidad lo quieren, y cómo se autentican. Eso
// entra en una tabla. Un archivo de código por servicio serían quince lugares donde
// equivocarse la conversión de millas por hora, y ninguno parecido al anterior.
//
// LAS UNIDADES SON EL 90% DE LOS ERRORES DE ESTA CAPA, y no avisan: un servicio que recibe
// nudos donde esperaba km/h no contesta un error, publica un viento equivocado. Por eso la
// conversión se hace UNA vez en _normalizar.mjs y acá sólo se elige cuál de los valores ya
// calculados va en cada campo. Ninguna receta hace cuentas propias, salvo las de escala fija
// que el servicio impone (Weathercloud multiplica todo por diez).
//
// LO QUE NO ESTA VERIFICADO ESTA MARCADO. verificado:false significa que la receta se escribió
// leyendo documentación pero **no se probó contra el servicio real**, y el panel lo muestra en
// amarillo. Es preferible a que parezca que anda: en esta casa ya pasó ocho veces que algo
// figurara prolijo en una lista y nunca se hubiera disparado.
//
// COMO AGREGAR UN SERVICIO NUEVO: copiar la receta más parecida, cambiar los nombres de los
// campos y dejar el enlace a la documentación en doc. No hace falta tocar nada más — ni la
// receptora, ni el panel, ni el despliegue.

import crypto from 'node:crypto'

const enc = (v) => encodeURIComponent(String(v ?? ''))

/** Agrega clave=valor sólo si el valor existe. Lo que no está no se inventa. */
const poner = (q, clave, valor) => {
  if (valor !== undefined && valor !== null && !Number.isNaN(valor)) q.set(clave, String(valor))
}

/** Redondea a d decimales, o devuelve undefined si no hay dato. */
const r = (v, d = 1) => (v === undefined || v === null) ? undefined : Math.round(v * 10 ** d) / 10 ** d

// Las tres unidades que ninguno de los servicios de abajo comparte con la estación.
const ms = (kmh) => kmh === undefined ? undefined : kmh / 3.6
const nudos = (kmh) => kmh === undefined ? undefined : kmh / 1.852
const pascal = (hpa) => hpa === undefined ? undefined : hpa * 100

/** Une base y parámetros sin dejar un ? colgando si no hubo ninguno. */
const conQuery = (base, q) => base + (q.toString() ? (base.includes('?') ? '&' : '?') + q.toString() : '')

/**
 * El juego de campos de Wunderground, que además usan PWSWeather y WOW.
 *
 * SE MANDAN LOS VALORES IMPERIALES TAL COMO LLEGARON de la estación, sin pasar por métrico y
 * volver: cada ida y vuelta redondea, y tres servicios distintos terminarían publicando tres
 * temperaturas apenas distintas de la misma lectura.
 */
function wuQuery (c, d) {
  const q = new URLSearchParams()
  if (c.id) q.set('ID', c.id)
  if (c.password) q.set('PASSWORD', c.password)
  q.set('dateutc', d.fecha_utc || new Date().toISOString().slice(0, 19).replace('T', ' '))
  poner(q, 'tempf', d.temp_ext_imp)
  poner(q, 'indoortempf', d.temp_int_imp)
  poner(q, 'dewptf', d.rocio_imp)
  poner(q, 'windchillf', d.sensacion_imp)
  poner(q, 'humidity', d.hum_ext)
  poner(q, 'indoorhumidity', d.hum_int)
  poner(q, 'windspeedmph', d.viento_imp)
  poner(q, 'windgustmph', d.rafaga_imp)
  poner(q, 'winddir', d.viento_dir)
  poner(q, 'baromin', d.presion_rel_imp)
  poner(q, 'rainin', d.lluvia_hora_imp)
  poner(q, 'dailyrainin', d.lluvia_dia_imp)
  poner(q, 'weeklyrainin', d.lluvia_semana_imp)
  poner(q, 'monthlyrainin', d.lluvia_mes_imp)
  poner(q, 'solarradiation', d.solar)
  poner(q, 'UV', d.uv)
  poner(q, 'AqPM2.5', d.pm25)
  q.set('softwaretype', 'ecowitt-bridge')
  q.set('action', 'updateraw')
  return q
}

// ---------------------------------------------------------------- el recetario

export const RECETAS = {

  // ---- Home Assistant --------------------------------------------------------
  homeassistant: {
    nombre: 'Home Assistant (webhook Ecowitt)',
    doc: 'https://www.home-assistant.io/integrations/ecowitt/',
    verificado: true,
    intervalo_sug: 0,
    notas: 'Reenvía el cuerpo TAL CUAL llegó, sin interpretar nada: no hay forma de estropear ' +
           'un dato al copiarlo. El identificador del webhook lo muestra HA en Ajustes → ' +
           'Dispositivos y servicios → Ecowitt → Configurar.',
    campos: [
      { clave: 'url_base', etiqueta: 'URL de HA (ej. http://TU_HOST_HA:8123)', obligatorio: true },
      { clave: 'webhook', etiqueta: 'ID del webhook', secreto: true, obligatorio: true },
    ],
    construir (c) {
      return {
        url: String(c.url_base || '').replace(/\/+$/, '') + '/api/webhook/' + enc(c.webhook),
        crudo: true,
      }
    },
  },

  // ---- Windy -----------------------------------------------------------------
  windy: {
    nombre: 'Windy',
    doc: 'https://community.windy.com/topic/8168/report-your-weather-station-data-to-windy',
    verificado: false,
    intervalo_sug: 300,
    notas: 'Windy pide métrico: °C, m/s, pascales, mm de la última hora. La API key sale de ' +
           'Windy → Settings → API key, la de "Stations" (no la de mapas).',
    campos: [
      { clave: 'api_key', etiqueta: 'API key de Windy', secreto: true, obligatorio: true },
      { clave: 'station', etiqueta: 'Nº de estación (0 si es la única)', obligatorio: false },
    ],
    construir (c, d) {
      const q = new URLSearchParams()
      poner(q, 'station', c.station || 0)
      poner(q, 'temp', r(d.temp_ext))
      poner(q, 'dewpoint', r(d.rocio))
      poner(q, 'wind', r(ms(d.viento), 2))
      poner(q, 'gust', r(ms(d.rafaga), 2))
      poner(q, 'winddir', r(d.viento_dir, 0))
      poner(q, 'rh', r(d.hum_ext, 0))
      poner(q, 'pressure', r(pascal(d.presion_rel), 0))
      poner(q, 'precip', r(d.lluvia_hora, 2))
      poner(q, 'uv', r(d.uv, 1))
      return { url: conQuery('https://stations.windy.com/pws/update/' + enc(c.api_key), q) }
    },
  },

  // ---- Windguru --------------------------------------------------------------
  windguru: {
    nombre: 'Windguru',
    doc: 'https://stations.windguru.cz/upload_api.php',
    verificado: false,
    intervalo_sug: 300,
    notas: 'Windguru no manda la contraseña: manda un md5 de sal+uid+contraseña, y la sal cambia ' +
           'en cada envío. Por eso ésta es la única receta que calcula algo — no se puede ' +
           'expresar como una plantilla fija.',
    campos: [
      { clave: 'uid', etiqueta: 'UID de la estación', obligatorio: true },
      { clave: 'password', etiqueta: 'Contraseña de la estación', secreto: true, obligatorio: true },
    ],
    construir (c, d) {
      // La sal tiene que ser distinta en cada envío: es lo que impide que alguien que vio un
      // hash lo reenvíe más tarde. Se usa la marca de tiempo en segundos, como su ejemplo.
      const salt = String(Math.floor(Date.now() / 1000))
      const hash = crypto.createHash('md5').update(salt + c.uid + c.password).digest('hex')
      const q = new URLSearchParams({ uid: String(c.uid), salt, hash })
      poner(q, 'wind_avg', r(nudos(d.viento), 1))
      poner(q, 'wind_max', r(nudos(d.rafaga), 1))
      poner(q, 'wind_direction', r(d.viento_dir, 0))
      poner(q, 'temperature', r(d.temp_ext))
      poner(q, 'rh', r(d.hum_ext, 0))
      poner(q, 'mslp', r(d.presion_rel, 1))
      poner(q, 'precip', r(d.lluvia_hora, 2))
      return { url: conQuery('https://www.windguru.cz/upload/api.php', q) }
    },
  },

  // ---- Weather Underground ---------------------------------------------------
  wunderground: {
    nombre: 'Weather Underground',
    doc: 'https://support.weather.com/s/article/PWS-Upload-Protocol',
    verificado: false,
    intervalo_sug: 60,
    notas: 'IMPERIAL: °F, pulgadas de mercurio, millas por hora. Son los valores tal como los ' +
           'manda la estación, sin convertir. OJO: el GW3000 ya sube a Wunderground por su ' +
           'cuenta — pasarlo por el puente sólo tiene sentido con una segunda estación o un ID ' +
           'distinto.',
    campos: [
      { clave: 'id', etiqueta: 'Station ID', obligatorio: true },
      { clave: 'password', etiqueta: 'Station key', secreto: true, obligatorio: true },
    ],
    construir (c, d) {
      return { url: conQuery(
        'https://weatherstation.wunderground.com/weatherstation/updateweatherstation.php',
        wuQuery(c, d)) }
    },
  },

  // ---- PWSWeather ------------------------------------------------------------
  pwsweather: {
    nombre: 'PWSWeather (AerisWeather)',
    doc: 'https://dashboard.pwsweather.com/',
    verificado: false,
    intervalo_sug: 300,
    notas: 'Habla el mismo protocolo que Wunderground, con otra dirección. Imperial.',
    campos: [
      { clave: 'id', etiqueta: 'Station ID', obligatorio: true },
      { clave: 'password', etiqueta: 'API key', secreto: true, obligatorio: true },
    ],
    construir (c, d) {
      return { url: conQuery('https://pwsupdate.pwsweather.com/api/v1/submitwx', wuQuery(c, d)) }
    },
  },

  // ---- WOW (Met Office) ------------------------------------------------------
  wow: {
    nombre: 'WOW · Met Office',
    doc: 'https://wow.metoffice.gov.uk/support/dataformats',
    verificado: false,
    intervalo_sug: 300,
    notas: 'Mismos nombres de campo que Wunderground, pero con siteid y siteAuthenticationKey ' +
           '(6 dígitos). El GW3000 también lo soporta nativo.',
    campos: [
      { clave: 'siteid', etiqueta: 'Site ID', obligatorio: true },
      { clave: 'key', etiqueta: 'Authentication key (6 dígitos)', secreto: true, obligatorio: true },
    ],
    construir (c, d) {
      const q = wuQuery({}, d)
      q.set('siteid', String(c.siteid))
      q.set('siteAuthenticationKey', String(c.key))
      return { url: conQuery('http://wow.metoffice.gov.uk/automaticreading', q) }
    },
  },

  // ---- Weathercloud ----------------------------------------------------------
  weathercloud: {
    nombre: 'Weathercloud',
    doc: 'https://weathercloud.readthedocs.io/',
    verificado: false,
    intervalo_sug: 600,
    notas: 'Weathercloud no usa parámetros: arma la URL con pares /clave/valor, y **todos los ' +
           'valores van multiplicados por diez** (18,5 °C se manda como 185). Las cuentas ' +
           'gratuitas no aceptan más de un envío cada 10 minutos.',
    campos: [
      { clave: 'wid', etiqueta: 'Weathercloud ID', obligatorio: true },
      { clave: 'key', etiqueta: 'Key', secreto: true, obligatorio: true },
    ],
    construir (c, d) {
      const t = []
      const x10 = (clave, v) => {
        if (v !== undefined && v !== null && !Number.isNaN(v)) t.push(clave, String(Math.round(v * 10)))
      }
      const entero = (clave, v) => {
        if (v !== undefined && v !== null && !Number.isNaN(v)) t.push(clave, String(Math.round(v)))
      }
      x10('temp', d.temp_ext)
      x10('tempin', d.temp_int)
      x10('dew', d.rocio)
      x10('chill', d.sensacion)
      entero('hum', d.hum_ext)
      entero('humin', d.hum_int)
      x10('wspd', ms(d.viento))
      x10('wspdhi', ms(d.rafaga))
      entero('wdir', d.viento_dir)
      x10('bar', d.presion_rel)
      x10('rain', d.lluvia_dia)
      x10('rainrate', d.lluvia_tasa)
      x10('solarrad', d.solar)
      x10('uvi', d.uv)
      return {
        url: 'https://api.weathercloud.net/v01/set/wid/' + enc(c.wid) + '/key/' + enc(c.key) +
          (t.length ? '/' + t.map(enc).join('/') : ''),
      }
    },
  },

  // ---- Webhook genérico ------------------------------------------------------
  webhook: {
    nombre: 'Webhook genérico (JSON)',
    doc: '',
    verificado: true,
    intervalo_sug: 0,
    notas: 'Manda un POST con TODOS los campos normalizados en JSON, métricos e imperiales. Es ' +
           'la salida para cualquier cosa que no tenga receta: una base propia, un n8n, otro HA. ' +
           'Ambient Weather va por acá: su red no publica un punto de entrada para estaciones ' +
           'de terceros, así que no tiene receta propia y sería inventarla.',
    campos: [
      { clave: 'url', etiqueta: 'URL completa', obligatorio: true },
      { clave: 'token', etiqueta: 'Bearer token (opcional)', secreto: true },
    ],
    construir (c, d) {
      return {
        url: c.url,
        metodo: 'POST',
        contenido: 'application/json',
        cuerpo: JSON.stringify(d),
        cabeceras: c.token ? { Authorization: 'Bearer ' + c.token } : {},
      }
    },
  },
}

// ---------------------------------------------------------------- consultas

/** La lista que consume el panel: sin funciones, lista para mandar como JSON. */
export function catalogo () {
  return Object.entries(RECETAS).map(([id, x]) => ({
    id, nombre: x.nombre, doc: x.doc, verificado: x.verificado,
    intervalo_sug: x.intervalo_sug, notas: x.notas, campos: x.campos,
  }))
}

/** Qué credenciales obligatorias le faltan a un destino. Vacío = está completo. */
export function faltantes (receta, credenciales) {
  const x = RECETAS[receta]
  if (!x) return ['receta desconocida: ' + receta]
  return x.campos.filter(c => c.obligatorio && !(credenciales || {})[c.clave]).map(c => c.etiqueta)
}
