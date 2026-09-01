// Los protocolos de ENTRADA: cómo puede hablarle una estación a este puente.
//
// NO CONFUNDIR CON `_recetas.mjs`. Las recetas son de SALIDA: cómo le habla el puente a Windy o
// a Weathercloud. Esto es lo de adentro: cómo entra el dato.
//
// POR QUE UNA TABLA Y NO UN `if` EN LA RECEPTORA
//
// Cada marca de estación habla lo que quiere. El día que entre una Davis o una Tempest, agregar
// su formato tiene que ser una entrada más acá — no tocar el servidor. Y sobre todo: el
// reconocimiento tiene que estar **en un solo lugar**, porque el error más caro de esta capa es
// aceptar un envío como si fuera de otro protocolo y guardar los campos cambiados de lugar.
//
// TODOS TERMINAN EN EL MISMO OBJETO. Cada protocolo sólo tiene que dejar los datos en el
// vocabulario que entiende `normalizar()`; de ahí para abajo el puente no sabe ni le importa de
// qué marca vino.
//
// ---------------------------------------------------------------------------------------
// EL QUE FALTABA, y era el más importante
//
// El formato **Wunderground es el que más marcas soportan** como "servidor personalizado":
// Ambient Weather, Acurite, Meteobridge, WeeWX, Cumulus MX, Weather Display, y las Davis por
// WeatherLink. Casi cualquier estación que no sea Ecowitt habla eso.
//
// Y se manda **por GET, con los datos en la URL**. Hasta el 01/09/2026 este puente sólo
// atendía POST: una estación configurada así recibía un 404 y nadie se enteraba, porque el
// gateway no avisa. Medido antes de arreglarlo.

/**
 * Los campos que delatan un envío de estación, sin importar el protocolo.
 *
 * Se usan para dos cosas: reconocer el protocolo, y —lo más importante— distinguir un envío de
 * un formulario del panel. Sin eso, un POST de configuración terminaría archivado en el
 * registro crudo de datos meteorológicos, con las credenciales adentro.
 */
const SEÑAS = {
  ecowitt: ['PASSKEY', 'stationtype'],
  wunderground: ['ID', 'action'],
  comunes: ['tempf', 'tempinf', 'baromrelin', 'baromin', 'dateutc', 'windspeedmph', 'humidity'],
}

const tiene = (p, claves) => claves.some(k => p.has(k))

export const PROTOCOLOS = {
  // ---- Ecowitt -----------------------------------------------------------------
  ecowitt: {
    nombre: 'Ecowitt',
    transporte: 'HTTP POST',
    notas: 'El de las pasarelas Ecowitt, Froggit y Ambient con firmware Ecowitt. Manda un POST ' +
           'con los datos en el cuerpo y trae PASSKEY, que identifica al aparato.',
    reconoce (p, req) {
      return req.method === 'POST' && tiene(p, SEÑAS.ecowitt)
    },
  },

  // ---- Wunderground ------------------------------------------------------------
  wunderground: {
    nombre: 'Weather Underground',
    transporte: 'HTTP GET o POST',
    notas: 'El formato que más marcas soportan como servidor personalizado: Ambient, Acurite, ' +
           'Meteobridge, WeeWX, Cumulus MX, Davis por WeatherLink. Va por GET con los datos en ' +
           'la URL. No trae PASSKEY: identifica la estación con ID.',
    reconoce (p) {
      // El ID es lo que lo distingue. Se pide además un campo de medición para no confundirlo
      // con cualquier GET que traiga un parámetro llamado ID.
      return p.has('ID') && (p.get('action') === 'updateraw' || tiene(p, SEÑAS.comunes))
    },
  },

  // ---- JSON genérico -----------------------------------------------------------
  json: {
    nombre: 'JSON genérico',
    transporte: 'HTTP POST con application/json',
    notas: 'Para lo que no habla ninguno de los otros: un script propio, un WeeWX con un plugin, ' +
           'un ESP32 casero. Acepta los mismos nombres de campo que Ecowitt o Wunderground, y ' +
           'también los ya normalizados (temp_ext, viento). La estación se identifica con ' +
           'PASSKEY, ID o estacion.',
    reconoce (p) {
      return p.has('PASSKEY') || p.has('ID') || p.has('estacion') || tiene(p, SEÑAS.comunes)
    },
  },
}

/**
 * Convierte un JSON en el mismo mapa de claves que usan los otros dos.
 *
 * SE ACEPTAN LOS NOMBRES NORMALIZADOS ADEMAS DE LOS CRUDOS, y eso hace que el puente pueda
 * hablarle a otro puente: la salida de un webhook de este mismo programa entra por acá sin
 * traducir nada.
 */
const desdeJson = (obj) => {
  const p = new URLSearchParams()
  const plano = (o, prefijo) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (v === null || v === undefined) continue
      if (typeof v === 'object' && !Array.isArray(v)) { plano(v, prefijo + k + '_'); continue }
      p.set(prefijo + k, String(v))
    }
  }
  plano(obj, '')
  return p
}

/**
 * ¿De qué protocolo es esto, y con qué campos?
 *
 * @param req     el pedido, para mirar el método
 * @param cuerpo  el cuerpo crudo, si lo hubo
 * @param query   los parámetros de la URL
 * @returns { protocolo, params, crudo } o null si no parece un envío de estación
 *
 * EL ORDEN IMPORTA: Ecowitt primero porque su PASSKEY es inequívoco; JSON al final porque es el
 * más permisivo y se comería a los otros dos.
 */
export function reconocer (req, cuerpo, query) {
  const tipo = String(req.headers['content-type'] || '')

  // --- JSON: el cuerpo se aplana a claves antes de mirarlo
  if (req.method === 'POST' && tipo.includes('application/json') && cuerpo) {
    let obj
    try { obj = JSON.parse(cuerpo) } catch { return null }
    if (!obj || typeof obj !== 'object') return null
    const p = desdeJson(obj)

    // LA IDENTIDAD SE TRADUCE AL VOCABULARIO DE WUNDERGROUND. Un JSON casero no tiene por que
    // saber que la clave se llama ID: acepta `estacion`, `station` o `id`, y se pasa a `ID`,
    // que es lo que ya sabe leer `identificar()`.
    //
    // Sin esto, todo lo que entra por JSON cae en `sin_identificar` y dos estaciones distintas
    // terminan mezcladas en la misma carpeta. Lo decia la documentacion de este archivo y no
    // era cierto: se comprobo mandando dos JSON y viendo que los dos iban al mismo lado.
    if (!p.has('ID') && !p.has('PASSKEY')) {
      for (const k of ['estacion', 'station', 'station_id', 'id']) {
        if (p.has(k)) { p.set('ID', p.get(k)); break }
      }
    }

    if (!PROTOCOLOS.json.reconoce(p)) return null
    // El crudo que se archiva es el JSON tal como llegó: es lo que mandó la estación.
    return { protocolo: 'json', params: p, crudo: cuerpo }
  }

  // --- los dos de formulario. Los datos pueden venir en el cuerpo (POST) o en la URL (GET).
  const p = new URLSearchParams(req.method === 'POST' ? (cuerpo || '') : (query || ''))
  if (![...p.keys()].length) return null

  for (const [id, proto] of Object.entries(PROTOCOLOS)) {
    if (id === 'json') continue
    if (proto.reconoce(p, req)) {
      return { protocolo: id, params: p, crudo: p.toString() }
    }
  }

  // Un envío que trae campos de medición pero no las señas de ninguno: se acepta como Ecowitt,
  // que es el vocabulario base. Es preferible a rechazarlo — una estación rara que manda
  // `tempf` y nada más igual está diciendo algo, y el archivo crudo guarda el original.
  if (tiene(p, SEÑAS.comunes)) return { protocolo: 'ecowitt', params: p, crudo: p.toString() }

  return null
}

/** La lista para el panel y la documentación. */
export const catalogo = () => Object.entries(PROTOCOLOS).map(([id, p]) => ({
  id, nombre: p.nombre, transporte: p.transporte, notas: p.notas,
}))
