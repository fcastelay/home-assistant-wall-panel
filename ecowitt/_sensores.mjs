// El auto-descubrimiento de Home Assistant: qué entidad se crea por cada campo y cómo.
//
// DOS TEMAS DE ESTADO, NO CUARENTA. Todos los sensores meteorológicos leen del mismo tema
// (<base>/datos) con un JSON adentro, y cada entidad saca su valor con un value_template. Lo
// mismo con los destinos, que van juntos en <base>/destinos.
//
// La alternativa —un tema por sensor— serían cuarenta publicaciones retenidas por minuto para
// mandar el mismo objeto partido en pedazos, y un broker lleno de temas que hay que ir a
// borrar a mano el día que se saca un sensor. Con un JSON, sacar un sensor es dejar de
// publicar esa clave.
//
// LA DISPONIBILIDAD ES LA MITAD DEL VALOR. Todas las entidades apuntan a <base>/estado, que el
// broker pone en "offline" solo si el puente se muere (el testamento MQTT, ver _mqtt.mjs). Sin
// eso, un puente caído deja sus últimos valores retenidos y Home Assistant sigue mostrando la
// temperatura de hace tres días como si fuera de ahora. Así falló la WS2900 el 15/08 y nadie
// se enteró: los sensores no dijeron "no sé", se quedaron quietos.
//
// SOLO SE ANUNCIA LO QUE LLEGO. Un WH51 que no está no genera una entidad vacía. La lista de
// abajo es el catálogo de lo posible; el anuncio se arma con la primera lectura real y se
// completa si más adelante aparece un sensor nuevo.

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

/**
 * Arma todos los mensajes de descubrimiento. Devuelve una lista de { tema, contenido } lista
 * para publicar retenida.
 *
 * @param campos     un objeto normalizado real: sólo se anuncia lo que trajo
 * @param destinos   la lista de destinos configurados
 * @param ajustes    { base, estacion, prefijo }
 */
export function descubrimientos (campos, destinos, ajustes) {
  const base = ajustes.base || 'estacion'
  const pre = ajustes.prefijo || 'homeassistant'
  const disponible = base + '/estado'

  const aparato = {
    identifiers: ['ecowitt_bridge'],
    name: ajustes.estacion || 'Estación meteorológica',
    model: campos.estacion || 'Ecowitt',
    manufacturer: 'Ecowitt',
    sw_version: 'ecowitt-bridge',
  }
  const comun = {
    device: aparato,
    availability_topic: disponible,
    payload_available: 'online',
    payload_not_available: 'offline',
  }
  const msgs = []
  const anunciar = (tipo, id, cfg) => msgs.push({
    tema: pre + '/' + tipo + '/' + base + '/' + id + '/config',
    contenido: JSON.stringify({ ...comun, ...cfg, unique_id: base + '_' + id, object_id: base + '_' + id }),
  })

  // --- los sensores meteorológicos, uno por campo presente
  for (const campo of Object.keys(campos)) {
    const d = describir(campo)
    if (!d) continue
    anunciar('sensor', campo, {
      name: d.n,
      state_topic: base + '/datos',
      value_template: '{{ value_json.' + campo + ' | default(none) }}',
      ...(d.u ? { unit_of_measurement: d.u } : {}),
      ...(d.c ? { device_class: d.c } : {}),
      ...(d.i ? { icon: d.i } : {}),
      // Sin state_class no hay estadísticas de largo plazo, y a los 30 días el dato se pierde.
      state_class: d.e || 'measurement',
    })
  }

  // --- diagnóstico del puente
  anunciar('sensor', 'ultimo_envio', {
    name: 'Último envío', state_topic: base + '/puente',
    value_template: '{{ value_json.ultimo }}', device_class: 'timestamp',
    entity_category: 'diagnostic', icon: 'mdi:clock-check-outline',
  })
  anunciar('sensor', 'envios', {
    name: 'Envíos recibidos', state_topic: base + '/puente',
    value_template: '{{ value_json.recibidos }}', state_class: 'total_increasing',
    entity_category: 'diagnostic', icon: 'mdi:counter',
  })
  // ESTE ES EL QUE HAY QUE MIRAR: ON si la estación dejó de mandar. Lo calcula el puente, que
  // sabe cada cuánto debería llegar un envío.
  anunciar('binary_sensor', 'estacion_muda', {
    name: 'Estación sin reportar', state_topic: base + '/puente',
    value_template: '{{ value_json.muda }}', payload_on: 'ON', payload_off: 'OFF',
    device_class: 'problem', entity_category: 'diagnostic',
  })
  anunciar('binary_sensor', 'algun_destino_caido', {
    name: 'Algún destino caído', state_topic: base + '/puente',
    value_template: '{{ value_json.alguno_caido }}', payload_on: 'ON', payload_off: 'OFF',
    device_class: 'problem', entity_category: 'diagnostic',
  })

  // --- un trío de entidades por destino: si falla, qué dijo, y cuánto tardó
  for (const d of destinos) {
    const id = idDe(d.nombre)
    const v = (clave) => '{{ value_json["' + id + '"].' + clave + ' | default(none) }}'
    anunciar('binary_sensor', 'destino_' + id, {
      name: d.nombre + ' · problema', state_topic: base + '/destinos',
      value_template: v('problema'), payload_on: 'ON', payload_off: 'OFF',
      device_class: 'problem', entity_category: 'diagnostic',
    })
    anunciar('sensor', 'estado_' + id, {
      name: d.nombre + ' · estado', state_topic: base + '/destinos',
      value_template: v('detalle'), icon: 'mdi:cloud-upload', entity_category: 'diagnostic',
    })
    anunciar('sensor', 'latencia_' + id, {
      name: d.nombre + ' · latencia', state_topic: base + '/destinos',
      value_template: v('latencia'), unit_of_measurement: 'ms', state_class: 'measurement',
      icon: 'mdi:timer-outline', entity_category: 'diagnostic',
    })
    anunciar('sensor', 'ultimo_ok_' + id, {
      name: d.nombre + ' · último envío OK', state_topic: base + '/destinos',
      value_template: v('ultimo_ok'), device_class: 'timestamp',
      icon: 'mdi:cloud-check-outline', entity_category: 'diagnostic',
    })
  }

  return msgs
}

/**
 * Los mensajes que RETIRAN un descubrimiento: mismo tema, contenido vacío.
 *
 * Hace falta al borrar un destino. Sin esto, sus cuatro entidades se quedan para siempre en
 * Home Assistant mostrando el último valor que tuvieron — que es exactamente lo que hubo que
 * limpiar a mano el 31/08/2026 después de una prueba con destinos inventados.
 */
export function retiros (nombreDestino, ajustes) {
  const base = ajustes.base || 'estacion'
  const pre = ajustes.prefijo || 'homeassistant'
  const id = idDe(nombreDestino)
  return [
    ['binary_sensor', 'destino_' + id],
    ['sensor', 'estado_' + id],
    ['sensor', 'latencia_' + id],
    ['sensor', 'ultimo_ok_' + id],
  ].map(([tipo, e]) => ({ tema: pre + '/' + tipo + '/' + base + '/' + e + '/config', contenido: '' }))
}
