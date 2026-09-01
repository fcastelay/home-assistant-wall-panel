// El auto-descubrimiento de Home Assistant: qué entidad se crea por cada campo y cómo.
//
// UN APARATO POR ESTACION, MAS UNO DEL NODO. Con varias estaciones esto deja de ser un detalle:
// en Home Assistant, "Patio" y "Quinta" tienen que ser dos aparatos distintos, cada uno con sus
// sensores, para poder ponerlos en tarjetas separadas y para que un sensor no aparezca dos veces
// con el mismo nombre. El nodo es un aparato aparte, con lo que no pertenece a ninguna estación:
// cuántas estaciones hay y si algún destino está fallando.
//
// DOS TEMAS DE ESTADO POR ESTACION, NO CUARENTA. Todos los sensores de una estación leen del
// mismo tema con un JSON adentro, y cada entidad saca su valor con un value_template.
//
// La alternativa —un tema por sensor— serían cuarenta publicaciones retenidas por minuto y por
// estación para mandar el mismo objeto partido en pedazos, y un broker lleno de temas que hay
// que ir a borrar a mano el día que se saca un sensor. Con un JSON, sacar un sensor es dejar de
// publicar esa clave.
//
// LA DISPONIBILIDAD ES LA MITAD DEL VALOR. Todas las entidades, de todas las estaciones,
// apuntan al MISMO tema de disponibilidad del nodo, que el broker pone en "offline" solo si el
// puente se muere (el testamento MQTT, ver _mqtt.mjs). Es correcto que sea uno solo: el
// testamento es de la conexión, y hay una sola conexión. Si el nodo se cae, ninguna estación
// está reportando.
//
// Sin eso, un puente caído deja sus últimos valores retenidos y Home Assistant sigue mostrando
// la temperatura de hace tres días como si fuera de ahora. Así falló la WS2900 el 15/08 y nadie
// se enteró: los sensores no dijeron "no sé", se quedaron quietos.
//
// SOLO SE ANUNCIA LO QUE LLEGO. Un WH51 que no está no genera una entidad vacía. La lista de
// abajo es el catálogo de lo posible; el anuncio se arma con la primera lectura real de cada
// estación y se completa si más adelante aparece un sensor nuevo.

/**
 * Catálogo: campo normalizado -> cómo se ve en Home Assistant.
 *
 * device_class y unit_of_measurement no son decoración: son lo que hace que HA guarde
 * estadísticas de largo plazo y que la unidad se pueda convertir en la interfaz. Un sensor sin
 * state_class se pierde a los 30 días, cuando el grabador purga. Es la misma lección de los
 * sensores de salud del NNN/NN.
 */
export const CATALOGO = {
  temp_ext:      { n: 'Temperatura exterior', u: '°C', c: 'temperature' },
  temp_int:      { n: 'Temperatura interior', u: '°C', c: 'temperature' },
  rocio:         { n: 'Punto de rocío', u: '°C', c: 'temperature' },
  sensacion:     { n: 'Sensación térmica', u: '°C', c: 'temperature' },
  hum_ext:       { n: 'Humedad exterior', u: '%', c: 'humidity' },
  hum_int:       { n: 'Humedad interior', u: '%', c: 'humidity' },
  presion_rel:   { n: 'Presión relativa', u: 'hPa', c: 'atmospheric_pressure' },
  presion_abs:   { n: 'Presión absoluta', u: 'hPa', c: 'atmospheric_pressure' },
  viento:        { n: 'Viento', u: 'km/h', c: 'wind_speed' },
  rafaga:        { n: 'Ráfaga', u: 'km/h', c: 'wind_speed' },
  rafaga_max_dia:{ n: 'Ráfaga máxima del día', u: 'km/h', c: 'wind_speed' },
  viento_dir:    { n: 'Dirección del viento', u: '°', i: 'mdi:compass-outline' },
  lluvia_tasa:   { n: 'Intensidad de lluvia', u: 'mm/h', c: 'precipitation_intensity' },
  lluvia_evento: { n: 'Lluvia del evento', u: 'mm', c: 'precipitation' },
  lluvia_hora:   { n: 'Lluvia de la última hora', u: 'mm', c: 'precipitation' },
  // Los acumulados son total_increasing: se reinician a cero al cambiar el período y HA lo
  // entiende como el arranque de un ciclo, no como un dato que se fue a cero.
  lluvia_dia:    { n: 'Lluvia del día', u: 'mm', c: 'precipitation', e: 'total_increasing' },
  lluvia_semana: { n: 'Lluvia de la semana', u: 'mm', c: 'precipitation', e: 'total_increasing' },
  lluvia_mes:    { n: 'Lluvia del mes', u: 'mm', c: 'precipitation', e: 'total_increasing' },
  lluvia_anio:   { n: 'Lluvia del año', u: 'mm', c: 'precipitation', e: 'total_increasing' },
  lluvia_total:  { n: 'Lluvia total', u: 'mm', c: 'precipitation', e: 'total_increasing' },
  solar:         { n: 'Radiación solar', u: 'W/m²', c: 'irradiance' },
  uv:            { n: 'Índice UV', u: 'UV index', i: 'mdi:weather-sunny-alert' },
  pm25:          { n: 'PM2.5', u: 'µg/m³', c: 'pm25' },
  pm25_24h:      { n: 'PM2.5 media 24 h', u: 'µg/m³', c: 'pm25' },
  pm10:          { n: 'PM10', u: 'µg/m³', c: 'pm10' },
  co2:           { n: 'CO₂', u: 'ppm', c: 'carbon_dioxide' },
  co2_int:       { n: 'CO₂ interior', u: 'ppm', c: 'carbon_dioxide' },
  rayos_dist:    { n: 'Rayo más cercano', u: 'km', c: 'distance' },
  rayos_dia:     { n: 'Rayos del día', i: 'mdi:flash', e: 'total_increasing' },
}

/** Los canales numerados se describen con una regla, no una fila cada uno. */
const PATRONES = [
  [/^temp_ch(\d+)$/,      (m) => ({ n: 'Temperatura canal ' + m[1], u: '°C', c: 'temperature' })],
  [/^hum_ch(\d+)$/,       (m) => ({ n: 'Humedad canal ' + m[1], u: '%', c: 'humidity' })],
  [/^tierra_(\d+)$/,      (m) => ({ n: 'Humedad de tierra ' + m[1], u: '%', c: 'moisture' })],
  [/^hoja_(\d+)$/,        (m) => ({ n: 'Humedad de hoja ' + m[1], u: '%', i: 'mdi:leaf' })],
  [/^pm25_(\d+)$/,        (m) => ({ n: 'PM2.5 canal ' + m[1], u: 'µg/m³', c: 'pm25' })],
]

/**
 * Cómo se describe un campo. Devuelve null si no está en el catálogo — y entonces NO se
 * anuncia: mejor un campo de menos que una entidad sin nombre ni unidad, que después nadie
 * sabe qué mide.
 */
export function describir (campo) {
  if (CATALOGO[campo]) return CATALOGO[campo]
  for (const [re, f] of PATRONES) { const m = campo.match(re); if (m) return f(m) }
  return null
}

/** Un id de entidad estable a partir de un nombre cualquiera. */
export const idDe = (nombre) => String(nombre).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'x'

// ---------------------------------------------------------------- temas

export const temas = (raiz, idEstacion) => ({
  // Uno solo para todo el nodo: el testamento es de la conexión, y hay una sola conexión.
  disponible: raiz + '/estado',
  nodo: raiz + '/nodo',
  destinos: raiz + '/destinos',
  datos: raiz + '/' + idEstacion + '/datos',
  estacion: raiz + '/' + idEstacion + '/estado',
})

/**
 * NO SE MANDA `object_id`, y sacarlo fue una medición, no una preferencia.
 *
 * El 01/09/2026 se comprobó contra un HA real: mandando `object_id: 'estacion_envios'` con
 * nombre 'Envíos recibidos', la entidad quedó como `sensor.<aparato>_envios_recibidos`. **El
 * object_id no se usó**: HA arma el identificador con el nombre del aparato más el de la
 * entidad.
 *
 * LO QUE SI IMPORTA ES EL `unique_id`: es lo que ata la entidad a su entrada del registro.
 * Mientras no cambie, HA reconoce la entidad y **conserva el entity_id que le puso la primera
 * vez**, aunque después se le cambie el nombre. Por eso el id de una estación no se cambia
 * nunca una vez creado.
 */
function armador (msgs, pre, aparato, disponible) {
  const comun = {
    device: aparato,
    availability_topic: disponible,
    payload_available: 'online',
    payload_not_available: 'offline',
  }
  return (tipo, unico, cfg) => msgs.push({
    tema: pre + '/' + tipo + '/' + unico + '/config',
    contenido: JSON.stringify({ ...comun, ...cfg, unique_id: unico }),
  })
}

/**
 * Los mensajes de descubrimiento de UNA estación.
 *
 * @param est      la estación de la configuración
 * @param campos   una lectura real suya: sólo se anuncia lo que trajo
 * @param destinos los destinos que le corresponden (los suyos y los comodín)
 * @param o        { raiz, prefijo, nodo }
 */
export function descubrimientos (est, campos, destinos, o) {
  const raiz = o.raiz || 'estacion'
  const pre = o.prefijo || 'homeassistant'
  const t = temas(raiz, est.id)
  const msgs = []

  const aparato = {
    identifiers: [raiz + '_' + est.id],
    name: est.nombre || ('Estación ' + est.id),
    model: est.modelo || campos.estacion || 'Ecowitt',
    manufacturer: 'Ecowitt',
    // Con varias estaciones conviene que cuelguen del nodo: en Home Assistant quedan agrupadas
    // y se ve de un vistazo cuál puente las trae.
    via_device: raiz + '_nodo',
  }
  const anunciar = armador(msgs, pre, aparato, t.disponible)
  const u = (sufijo) => raiz + '_' + est.id + '_' + sufijo

  // --- los sensores meteorológicos, uno por campo presente
  for (const campo of Object.keys(campos)) {
    const d = describir(campo)
    if (!d) continue
    anunciar('sensor', u(campo), {
      name: d.n,
      state_topic: t.datos,
      value_template: '{{ value_json.' + campo + ' | default(none) }}',
      ...(d.u ? { unit_of_measurement: d.u } : {}),
      ...(d.c ? { device_class: d.c } : {}),
      ...(d.i ? { icon: d.i } : {}),
      // Sin state_class no hay estadísticas de largo plazo, y a los 30 días el dato se pierde.
      state_class: d.e || 'measurement',
    })
  }

  // --- diagnóstico de la estación
  anunciar('sensor', u('ultimo_envio'), {
    name: 'Último envío', state_topic: t.estacion,
    value_template: '{{ value_json.ultimo }}', device_class: 'timestamp',
    entity_category: 'diagnostic', icon: 'mdi:clock-check-outline',
  })
  anunciar('sensor', u('envios'), {
    name: 'Envíos recibidos', state_topic: t.estacion,
    value_template: '{{ value_json.recibidos }}', state_class: 'total_increasing',
    entity_category: 'diagnostic', icon: 'mdi:counter',
  })
  // ESTE ES EL QUE HAY QUE MIRAR: ON si esta estación dejó de mandar. Lo calcula el puente, que
  // sabe cada cuánto debería llegar un envío de ella.
  anunciar('binary_sensor', u('sin_reportar'), {
    name: 'Sin reportar', state_topic: t.estacion,
    value_template: '{{ value_json.muda }}', payload_on: 'ON', payload_off: 'OFF',
    device_class: 'problem', entity_category: 'diagnostic',
  })

  // --- los destinos de esta estación, comodines incluidos, colgados de ella
  //
  // UN COMODIN TAMBIEN CUELGA DE CADA ESTACION, y no del nodo. Puede estar andando bien con una
  // y fallando con otra —una credencial que sólo vale para una cuenta, un servicio que rechaza
  // la segunda estación— y una entidad única no tendría forma de decirlo.
  for (const d of destinos) msgs.push(...entidadesDestino(d, est.id, raiz, pre, aparato, t))

  return msgs
}

/** Las cuatro entidades de un destino. Se arman igual cuelguen de una estación o del nodo. */
function entidadesDestino (d, idEstacion, raiz, pre, aparato, t) {
  const msgs = []
  const anunciar = armador(msgs, pre, aparato, t.disponible)
  const clave = idDe(d.nombre) + '_' + idEstacion
  const u = (sufijo) => raiz + '_destino_' + clave + '_' + sufijo
  const v = (c) => '{{ value_json["' + clave + '"].' + c + ' | default(none) }}'
  const et = (n) => d.nombre + ' · ' + n

  anunciar('binary_sensor', u('problema'), {
    name: et('problema'), state_topic: t.destinos, value_template: v('problema'),
    payload_on: 'ON', payload_off: 'OFF', device_class: 'problem', entity_category: 'diagnostic',
  })
  anunciar('sensor', u('estado'), {
    name: et('estado'), state_topic: t.destinos, value_template: v('detalle'),
    icon: 'mdi:cloud-upload', entity_category: 'diagnostic',
  })
  anunciar('sensor', u('latencia'), {
    name: et('latencia'), state_topic: t.destinos, value_template: v('latencia'),
    unit_of_measurement: 'ms', state_class: 'measurement',
    icon: 'mdi:timer-outline', entity_category: 'diagnostic',
  })
  anunciar('sensor', u('ultimo_ok'), {
    name: et('último envío OK'), state_topic: t.destinos, value_template: v('ultimo_ok'),
    device_class: 'timestamp', icon: 'mdi:cloud-check-outline', entity_category: 'diagnostic',
  })
  return msgs
}

/**
 * Los mensajes de descubrimiento del NODO: lo que no pertenece a ninguna estación.
 *
 * Los destinos NO aparecen acá: cada uno cuelga de la estación que le toca, incluso los
 * comodines. Ver el comentario en `descubrimientos`.
 */
export function descubrimientosNodo (o) {
  const raiz = o.raiz || 'estacion'
  const pre = o.prefijo || 'homeassistant'
  const t = temas(raiz, '_')
  const msgs = []

  const aparato = {
    identifiers: [raiz + '_nodo'],
    name: o.nombre || 'Puente Ecowitt',
    model: 'Puente multi-estación',
    manufacturer: 'ecowitt-bridge',
  }
  const anunciar = armador(msgs, pre, aparato, t.disponible)
  const u = (s) => raiz + '_nodo_' + s

  anunciar('sensor', u('estaciones'), {
    name: 'Estaciones activas', state_topic: t.nodo,
    value_template: '{{ value_json.estaciones }}', icon: 'mdi:home-group',
    entity_category: 'diagnostic',
  })
  anunciar('sensor', u('envios'), {
    name: 'Envíos recibidos', state_topic: t.nodo,
    value_template: '{{ value_json.recibidos }}', state_class: 'total_increasing',
    icon: 'mdi:counter', entity_category: 'diagnostic',
  })
  // El de reojo: ON si CUALQUIER cosa está mal, en cualquier estación o destino. Es el único
  // que hace falta poner en una tarjeta; los demás dicen dónde.
  anunciar('binary_sensor', u('algo_mal'), {
    name: 'Algo no está funcionando', state_topic: t.nodo,
    value_template: '{{ value_json.algo_mal }}', payload_on: 'ON', payload_off: 'OFF',
    device_class: 'problem', entity_category: 'diagnostic',
  })

  return msgs
}

/**
 * Los mensajes que RETIRAN un descubrimiento: mismo tema, contenido vacío.
 *
 * Hace falta al borrar un destino o una estación. Sin esto, sus entidades se quedan para
 * siempre en Home Assistant mostrando el último valor que tuvieron — que es exactamente lo que
 * hubo que limpiar a mano el 31/08/2026 después de una prueba con destinos inventados.
 */
export function retirosDestino (destino, idEstacion, o) {
  const raiz = o.raiz || 'estacion'
  const pre = o.prefijo || 'homeassistant'
  const clave = idDe(destino.nombre) + '_' + idEstacion
  return [
    ['binary_sensor', 'problema'], ['sensor', 'estado'],
    ['sensor', 'latencia'], ['sensor', 'ultimo_ok'],
  ].map(([tipo, s]) => ({
    tema: pre + '/' + tipo + '/' + raiz + '_destino_' + clave + '_' + s + '/config', contenido: '',
  }))
}

/** Lo mismo para una estación entera: sus diagnósticos y todos sus sensores posibles. */
export function retirosEstacion (idEstacion, o) {
  const raiz = o.raiz || 'estacion'
  const pre = o.prefijo || 'homeassistant'
  const base = raiz + '_' + idEstacion + '_'
  const fuera = []
  for (const campo of Object.keys(CATALOGO)) {
    fuera.push({ tema: pre + '/sensor/' + base + campo + '/config', contenido: '' })
  }
  // Los canales numerados: se retiran todos los posibles, existan o no. Publicar un retiro de
  // algo que no existe no hace nada; olvidarse de uno lo deja huérfano para siempre.
  for (let i = 1; i <= 16; i++) {
    for (const p of ['temp_ch', 'hum_ch', 'tierra_', 'hoja_', 'pm25_']) {
      fuera.push({ tema: pre + '/sensor/' + base + p + i + '/config', contenido: '' })
    }
  }
  fuera.push({ tema: pre + '/sensor/' + base + 'ultimo_envio/config', contenido: '' })
  fuera.push({ tema: pre + '/sensor/' + base + 'envios/config', contenido: '' })
  fuera.push({ tema: pre + '/binary_sensor/' + base + 'sin_reportar/config', contenido: '' })
  return fuera
}
