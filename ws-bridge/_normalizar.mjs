// Traduce el envío crudo de la estación a un juego de campos con nombre y unidad conocidos.
//
// ESTA ES LA PIEZA QUE HACE QUE ESCALE, y conviene entender por qué antes de tocarla.
//
// Con dos destinos uno se tienta con escribir "para Wunderground agarro tempf y lo mando tal
// cual; para el otro lo paso a Celsius". Con quince destinos eso son quince lugares donde se
// puede equivocar una conversión, y ninguno se parece al anterior.
//
// Acá se hace **una sola vez**: el envío entra en formato Ecowitt y sale como un objeto con
// los campos en unidades conocidas. Cada destino después sólo elige cuáles quiere y con qué
// nombre los llama. Se parsea una vez, se renderiza muchas.
//
// SE DEVUELVEN LAS DOS UNIDADES, métricas e imperiales, y no es indecisión: la mitad de los
// servicios meteorológicos del mundo piden °F y pulgadas —Wunderground, PWSWeather, WOW— y la
// otra mitad °C y milímetros —Windy, Windguru, Weathercloud—. Tener las dos calculadas evita
// que cada receta haga su propia cuenta, que es justo donde aparecen los errores.
//
// LO QUE NO ESTA NO SE INVENTA: si la estación no manda un campo, no aparece en la salida. Un
// destino que lo pida va a recibir el hueco, y eso es correcto — mejor que mandar un cero que
// se lea como "no hay viento" cuando en realidad es "no sabemos".
//
// TAMBIEN ENTIENDE EL FORMATO WUNDERGROUND, que es el otro que sabe hablar la pasarela. Son
// casi los mismos nombres; las tres diferencias reales están marcadas abajo.

/** °F -> °C */
const c = (f) => (f - 32) * 5 / 9
/** pulgadas -> mm */
const mm = (inch) => inch * 25.4
/** pulgadas de mercurio -> hPa */
const hpa = (inhg) => inhg * 33.8639
/** millas por hora -> km/h */
const kmh = (mph) => mph * 1.609344

/**
 * @param cuerpo  el POST tal como llegó (application/x-www-form-urlencoded) o el query de un GET
 * @returns objeto con los campos presentes, en métrico y en imperial
 */
export function normalizar (cuerpo) {
  // Acepta el texto crudo o un mapa de claves ya armado. Lo segundo es lo que le pasa
  // `_protocolos.mjs`, que ya reconocio de que protocolo viene y aplano el JSON si hacia falta.
  const p = cuerpo instanceof URLSearchParams ? cuerpo : new URLSearchParams(cuerpo)
  const n = (...claves) => {
    for (const k of claves) {
      const v = p.get(k)
      if (v === null || v === '') continue
      const f = parseFloat(v)
      if (!Number.isNaN(f)) return f
    }
    return null
  }
  const s = (...claves) => { for (const k of claves) { const v = p.get(k); if (v) return v } return null }

  const salida = {}
  /** Agrega el campo sólo si el valor existe. */
  const set = (k, v) => { if (v !== null && v !== undefined && !Number.isNaN(v)) salida[k] = v }
  /** Agrega un par métrico/imperial de una vez. */
  const par = (base, imperial, conv, dec = 2) => {
    if (imperial === null) return
    set(base + '_imp', Math.round(imperial * 100) / 100)
    set(base, Math.round(conv(imperial) * 10 ** dec) / 10 ** dec)
  }

  // --- identidad
  set('estacion', s('stationtype'))
  set('modelo', s('model'))
  set('passkey', s('PASSKEY'))
  // El identificador de estacion del protocolo Wunderground. Ahi no hay PASSKEY, asi que es lo
  // unico con que distinguir dos estaciones que le hablen al mismo puente.
  set('wu_id', s('ID'))
  set('intervalo', n('interval'))
  // dateutc viene como "2026-08-31 23:10:00" (hora UTC, sin zona). Se deja tal cual y además
  // en ISO, porque cada servicio pide uno de los dos.
  const fecha = s('dateutc')
  if (fecha && fecha !== 'now') {
    salida.fecha_utc = fecha
    const d = new Date(fecha.replace(' ', 'T') + 'Z')
    if (!Number.isNaN(d.getTime())) salida.fecha_iso = d.toISOString()
  }
  if (!salida.fecha_iso) {
    salida.fecha_iso = new Date().toISOString()
    salida.fecha_utc = salida.fecha_iso.slice(0, 19).replace('T', ' ')
  }

  // --- temperatura y humedad
  par('temp_ext', n('tempf'), c, 1)
  par('temp_int', n('tempinf', 'indoortempf'), c, 1)
  set('hum_ext', n('humidity'))
  set('hum_int', n('humidityin', 'indoorhumidity'))
  par('rocio', n('dewptf'), c, 1)
  par('sensacion', n('windchillf'), c, 1)

  // --- presión.
  //     PRIMERA DIFERENCIA CON WUNDERGROUND: allá la presión relativa se llama baromin, acá
  //     baromrelin. Si no se contemplan las dos, un envío en formato WU entra sin presión.
  par('presion_rel', n('baromrelin', 'baromin'), hpa, 1)
  par('presion_abs', n('baromabsin'), hpa, 1)

  // --- viento
  par('viento', n('windspeedmph'), kmh, 1)
  par('rafaga', n('windgustmph'), kmh, 1)
  par('rafaga_max_dia', n('maxdailygust'), kmh, 1)
  set('viento_dir', n('winddir'))

  // --- lluvia.
  //     SEGUNDA DIFERENCIA: Wunderground llama rainin a la lluvia de la última hora, que en
  //     Ecowitt es hourlyrainin. El mismo nombre para cosas distintas no existe acá, pero el
  //     malentendido sí: se acepta rainin como lluvia horaria, que es lo que significa en WU.
  par('lluvia_tasa', n('rainratein'), mm, 2)
  par('lluvia_evento', n('eventrainin'), mm, 2)
  par('lluvia_hora', n('hourlyrainin', 'rainin'), mm, 2)
  par('lluvia_dia', n('dailyrainin'), mm, 2)
  par('lluvia_semana', n('weeklyrainin'), mm, 2)
  par('lluvia_mes', n('monthlyrainin'), mm, 2)
  par('lluvia_anio', n('yearlyrainin'), mm, 2)
  par('lluvia_total', n('totalrainin'), mm, 2)

  // --- sol. TERCERA DIFERENCIA: Wunderground escribe UV en mayúsculas.
  set('solar', n('solarradiation'))
  set('uv', n('uv', 'UV'))

  // --- calidad de aire
  set('pm25', n('pm25_ch1', 'AqPM2.5'))
  set('pm25_24h', n('pm25_avg_24h_ch1'))
  set('pm10', n('pm10_ch1', 'AqPM10'))
  set('co2', n('co2'))
  set('co2_int', n('co2in'))
  for (let i = 2; i <= 4; i++) set('pm25_' + i, n('pm25_ch' + i))

  // --- canales extra (los WH31 de ambiente, los WH51 de tierra, los WH35 de hoja)
  for (let i = 1; i <= 8; i++) {
    par('temp_ch' + i, n('temp' + i + 'f'), c, 1)
    set('hum_ch' + i, n('humidity' + i))
    set('hoja_' + i, n('leafwetness_ch' + i))
  }
  for (let i = 1; i <= 16; i++) set('tierra_' + i, n('soilmoisture' + i))

  // --- rayos (WH57) y fugas de agua (WH55)
  set('rayos_dist', n('lightning'))
  set('rayos_dia', n('lightning_num'))
  set('rayos_hora', n('lightning_time'))
  for (let i = 1; i <= 4; i++) set('fuga_' + i, n('leak_ch' + i))

  // --- baterías.
  //     LA CONVENCION DE ECOWITT NO ES UNIFORME Y ESO IMPORTA: en los sensores de tipo binario
  //     (wh65batt, wh25batt) 0 = bien y 1 = baja, al revés de lo que uno esperaría. En los de
  //     tipo pila (soilbatt) viene el voltaje. Acá se guarda el número tal cual y la
  //     interpretación queda documentada donde se muestra, no escondida en una cuenta.
  set('bat_wh65', n('wh65batt'))
  set('bat_wh25', n('wh25batt'))
  set('bat_wh57', n('wh57batt'))
  for (let i = 1; i <= 8; i++) {
    set('bat_ch' + i, n('batt' + i, 'wh31batt' + i))
    set('bat_tierra_' + i, n('soilbatt' + i))
  }

  // LOS NOMBRES YA NORMALIZADOS ENTRAN TAL CUAL, y eso hace que un puente le pueda hablar a
  // otro: lo que sale por el webhook generico vuelve a entrar por el protocolo JSON sin
  // traducir nada. Se aceptan solo los que el catalogo conoce, para que un campo cualquiera no
  // se cuele con nombre de medicion.
  for (const k of Object.keys(salida)) { /* ya estan */ }
  for (const [k, v] of p.entries()) {
    if (salida[k] !== undefined) continue
    if (!/^(temp_ext|temp_int|hum_ext|hum_int|rocio|sensacion|presion_rel|presion_abs|viento|rafaga|rafaga_max_dia|viento_dir|lluvia_[a-z]+|solar|uv|pm25|pm10|co2|co2_int|rayos_[a-z]+|tierra_\d+|hoja_\d+|temp_ch\d+|hum_ch\d+)$/.test(k)) continue
    const f = parseFloat(v)
    if (!Number.isNaN(f)) salida[k] = f
  }

  // LOS NOMBRES YA NORMALIZADOS ENTRAN TAL CUAL, y eso hace que un puente le pueda hablar a
  // otro: lo que sale por el webhook generico vuelve a entrar por el protocolo JSON sin
  // traducir nada. Se aceptan solo los que el catalogo conoce, para que un campo cualquiera no
  // se cuele con nombre de medicion.
  for (const k of Object.keys(salida)) { /* ya estan */ }
  for (const [k, v] of p.entries()) {
    if (salida[k] !== undefined) continue
    if (!/^(temp_ext|temp_int|hum_ext|hum_int|rocio|sensacion|presion_rel|presion_abs|viento|rafaga|rafaga_max_dia|viento_dir|lluvia_[a-z]+|solar|uv|pm25|pm10|co2|co2_int|rayos_[a-z]+|tierra_\d+|hoja_\d+|temp_ch\d+|hum_ch\d+)$/.test(k)) continue
    const f = parseFloat(v)
    if (!Number.isNaN(f)) salida[k] = f
  }

  // LOS NOMBRES YA NORMALIZADOS ENTRAN TAL CUAL, y eso hace que un puente le pueda hablar a
  // otro: lo que sale por el webhook generico vuelve a entrar por el protocolo JSON sin
  // traducir nada. Se aceptan solo los que el catalogo conoce, para que un campo cualquiera no
  // se cuele con nombre de medicion.
  for (const k of Object.keys(salida)) { /* ya estan */ }
  for (const [k, v] of p.entries()) {
    if (salida[k] !== undefined) continue
    if (!/^(temp_ext|temp_int|hum_ext|hum_int|rocio|sensacion|presion_rel|presion_abs|viento|rafaga|rafaga_max_dia|viento_dir|lluvia_[a-z]+|solar|uv|pm25|pm10|co2|co2_int|rayos_[a-z]+|tierra_\d+|hoja_\d+|temp_ch\d+|hum_ch\d+)$/.test(k)) continue
    const f = parseFloat(v)
    if (!Number.isNaN(f)) salida[k] = f
  }

  return salida
}

/**
 * ¿Este cuerpo parece un envío de estación y no otra cosa?
 *
 * Hace falta porque el mismo puerto atiende el panel web: un POST del formulario de
 * configuración no es un envío de la estación, y confundirlos archivaría credenciales en el
 * registro crudo.
 */
export function pareceEnvio (cuerpo) {
  if (!cuerpo || cuerpo.length > 64 * 1024) return false
  const p = new URLSearchParams(cuerpo)
  return ['PASSKEY', 'stationtype', 'tempf', 'tempinf', 'dateutc', 'ID', 'baromrelin']
    .some(k => p.has(k))
}
