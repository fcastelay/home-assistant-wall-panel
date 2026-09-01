// Puente Ecowitt: recibe los datos de la estación, los archiva y los reparte.
//
//   node scripts/ecowitt/receptora.mjs             escucha en el puerto 8088
//   node scripts/ecowitt/receptora.mjs --puerto N
//   node scripts/ecowitt/receptora.mjs --seco      no reenvía a nadie: sólo muestra y archiva
//   node scripts/ecowitt/receptora.mjs --sin-mqtt  reenvía pero NO publica a Home Assistant
//
// POR QUE EXISTE, y no es una capa de más
//
// El GW3000 sube a cuatro nubes (ecowitt.net, Wunderground, Weathercloud, WOW) **y a UN solo
// servidor personalizado**. Uno. Si ese slot va a Home Assistant, no queda ninguno para nada
// más — ni otro HA, ni Windy, ni Windguru, ni una base propia, ni lo que aparezca mañana.
//
// Este puente se queda con ese único slot y lo reparte a todos los destinos que haga falta. La
// estación le habla a él, y él le habla a quien sea.
//
// LO QUE **NO** CONVIENE MANDAR POR ACA: las cuatro nubes que el gateway ya soporta nativo.
// Pasarlas por este proceso agrega un punto de falla sin ganar nada. Que las siga subiendo el
// gateway. Las recetas de Wunderground y WOW existen para el caso de una segunda cuenta, y lo
// dicen en sus notas.
//
// EL ARCHIVO CRUDO ES LA MITAD DEL VALOR, y quizá la más importante.
//
// Cada envío se escribe tal cual llegó, antes de reenviarlo a ningún lado. Ese archivo no
// depende de que HA esté vivo, ni del grabador —que purga a los 30 días— ni de que las
// estadísticas existan. Es la copia que sobrevive a todo lo demás, y es la lección de la
// WS2900: se cayó el 15/08 y sus 33 sensores quedaron en unavailable sin dejar rastro.
//
// EL PROTOCOLO, en un párrafo: el gateway hace un POST con application/x-www-form-urlencoded
// a la ruta que uno le configure. Los campos son los de Ecowitt: PASSKEY, stationtype,
// dateutc, tempinf, humidityin, tempf, windspeedmph, rainratein y compañía. No hay
// autenticación: el PASSKEY identifica la estación pero viaja en claro, así que esto **sólo se
// expone a la red de casa**, nunca a internet.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// EL CLIENTE MQTT SE BUSCA EN DOS LUGARES, y no es capricho: en el contenedor todos los
// archivos quedan planos en /app, pero en el repositorio _mqtt.mjs vive en scripts/garnet/ —es
// el mismo cliente, ya probado en esta casa con la alarma, y se copia al desplegar en vez de
// duplicarlo. Sin este respaldo, el puente **no se puede correr fuera del contenedor**, que es
// justo donde uno quiere probarlo antes de subirlo.
const { conectar } = await import('./_mqtt.mjs').catch(() => import('../garnet/_mqtt.mjs'))
import { normalizar, pareceEnvio } from './_normalizar.mjs'
import { enviarA } from './_destinos.mjs'
import { RECETAS } from './_recetas.mjs'
import * as cfg from './_config.mjs'
import { descubrimientos, retiros, idDe } from './_sensores.mjs'
import { atender, revisar } from './_panel.mjs'
import { anotar, anotarLectura, verEventos, verLecturas } from './_registro.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? (process.argv[i + 1] ?? true) : d }
const PUERTO = Number(arg('puerto', process.env.PUERTO || 8088))
const SECO = process.argv.includes('--seco')
// SIN MQTT: para probar sin tocar el broker de la casa.
//
// Existe por un error propio del 31/08/2026: una prueba con destinos inventados se conectó al
// broker real y creó 15 entidades falsas en Home Assistant —"Servicio métrico", "Roto (404)"—
// que hubo que retirar a mano publicando descubrimientos vacíos.
//
// **Una prueba no puede escribir en la casa.** Con esta bandera, no lo hace.
const SIN_MQTT = process.argv.includes('--sin-mqtt')
const DATOS = process.env.ARCHIVO || path.join(AQUI, 'datos')

cfg.iniciar(DATOS, [path.join(AQUI, 'destinos.json')])
let CONFIG = cfg.cargar()
const ajustes = () => ({ ...CONFIG.ajustes, prefijo: CONFIG.mqtt.prefijo || 'homeassistant' })
const activos = () => CONFIG.destinos.filter(d => d.activo !== false)

// ---------------------------------------------------------------- estado en memoria
//
// Cada destino lleva su propio contador y su propio reloj: cuándo fue el último intento —para
// respetar su intervalo mínimo—, cuántos envíos le fueron bien y cuántos mal.
//
// Vive en memoria y se pierde al reiniciar, y está bien que así sea: es información de
// vigilancia, no un dato de la estación. Lo que no se puede perder ya está en datos/.
const ESTADOS = new Map()
const estadoDe = (nombre) => {
  if (!ESTADOS.has(nombre)) ESTADOS.set(nombre, {})
  return ESTADOS.get(nombre)
}

let recibidos = 0
let ultimo = null
let ultimosCampos = {}
let ultimoCrudo = ''
let mqtt = null
let mqttMotivo = 'sin conectar'
let camposAnunciados = ''

// ---------------------------------------------------------------- archivo crudo

/**
 * Guarda el envío tal como llegó, un archivo por día.
 *
 * EL ARCHIVO SE NOMBRA CON EL DIA LOCAL, no con el UTC, y la marca de tiempo de cada línea va
 * en ISO (UTC). Es a propósito: uno busca "qué pasó el martes a la tarde" en horario de acá,
 * pero cada línea tiene que ser comparable con cualquier otro registro. Entre las 21 y las 24
 * los dos días no coinciden — conviene saberlo antes de buscar un dato y no encontrarlo.
 *
 * SE ESCRIBE ANTES DE REENVIAR, y ese orden importa: si un destino cuelga o el proceso se cae
 * a mitad del reparto, el dato ya está en disco. Al revés se perdería justo el envío de la
 * tormenta que uno quería mirar.
 */
const archivar = (cuerpo) => {
  try {
    fs.mkdirSync(DATOS, { recursive: true })
    const d = new Date()
    const nombre = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') + '.txt'
    fs.appendFileSync(path.join(DATOS, nombre), d.toISOString() + '\t' + cuerpo + '\n')
    return true
  } catch (e) {
    anotar('error', 'NO SE PUDO ARCHIVAR: ' + e.message)
    return false
  }
}

// ---------------------------------------------------------------- MQTT

const publicar = (tema, valor, retener = true) => { if (mqtt) mqtt.publicar(tema, valor, retener) }
const temaBase = () => (CONFIG.ajustes.base || 'estacion')

/**
 * Se conecta al broker y reintenta para siempre si se cae.
 *
 * NO DEPENDE DE MQTT PARA FUNCIONAR: si el broker no está, el puente igual recibe, archiva y
 * reparte. Lo único que se pierde es la vigilancia. Al revés —caerse porque no hay broker—
 * sería dejar de guardar datos por no poder avisar que se guardan.
 *
 * REINTENTA CON ESPERA CRECIENTE hasta un minuto: el broker se reinicia cuando se reinicia HA,
 * y sin reconexión el puente quedaría mudo en Home Assistant hasta que alguien lo notara.
 */
let esperaMqtt = 5000
function conectarMqtt () {
  if (SECO || SIN_MQTT) return
  // El testamento: si este proceso se muere, el broker publica "offline" por él y todas las
  // entidades quedan como no disponibles en vez de congeladas en su último valor.
  const will = { tema: temaBase() + '/estado', contenido: 'offline' }
  const reintentar = (motivo) => {
    mqtt = null
    mqttMotivo = motivo
    anotar('aviso', 'sin MQTT (' + motivo + '). Reintento en ' + Math.round(esperaMqtt / 1000) + ' s.')
    setTimeout(conectarMqtt, esperaMqtt)
    esperaMqtt = Math.min(esperaMqtt * 2, 60000)
  }
  // Lo que se cargo en el panel manda sobre las variables de entorno. Si el panel esta vacio,
  // se pasa `undefined` y el cliente cae en su propia busqueda: primero el entorno del
  // contenedor, despues la configuracion de HA por Samba.
  const m = CONFIG.mqtt || {}
  const propias = (m.host && m.usuario && m.clave)
    ? { host: m.host, puerto: Number(m.puerto) || 1883, usuario: m.usuario, clave: m.clave }
    : undefined
  conectar((e) => reintentar(e.message), { id: 'ecowitt-puente', will, credenciales: propias })
    .then(c => {
      mqtt = c
      mqttMotivo = ''
      esperaMqtt = 5000
      publicar(temaBase() + '/estado', 'online')
      anunciar('conexión al broker')
      publicarPuente()
    })
    .catch(e => reintentar(e.message))
}

/**
 * Publica el auto-descubrimiento.
 *
 * SE VUELVE A ANUNCIAR cuando cambian los destinos o cuando aparece un sensor que antes no
 * estaba —un WH51 nuevo, por ejemplo—. Los mensajes son idempotentes: republicar el mismo
 * descubrimiento no duplica nada en Home Assistant, sólo lo actualiza.
 */
function anunciar (motivo) {
  if (!mqtt) return
  const msgs = descubrimientos(ultimosCampos, CONFIG.destinos, ajustes())
  for (const m of msgs) publicar(m.tema, m.contenido)
  camposAnunciados = Object.keys(ultimosCampos).sort().join(',')
  anotar('info', msgs.length + ' entidades anunciadas a Home Assistant (' + motivo + ')')
}

function publicarPuente () {
  const b = temaBase()
  const caidos = activos().some(d => {
    const e = estadoDe(d.nombre)
    return e.ultimoDetalle && e.ultimoDetalle !== 'ok'
  })
  publicar(b + '/puente', JSON.stringify({
    ultimo, recibidos,
    muda: estaMuda() ? 'ON' : 'OFF',
    alguno_caido: caidos ? 'ON' : 'OFF',
  }))
  const porDestino = {}
  for (const d of CONFIG.destinos) {
    const e = estadoDe(d.nombre)
    porDestino[idDe(d.nombre)] = {
      problema: (d.activo !== false && e.ultimoDetalle && e.ultimoDetalle !== 'ok') ? 'ON' : 'OFF',
      detalle: d.activo === false ? 'apagado' : (e.ultimoDetalle || 'sin enviar'),
      latencia: e.latencia ?? null,
      ultimo_ok: e.ultimoOk ? new Date(e.ultimoOk).toISOString() : null,
    }
  }
  publicar(b + '/destinos', JSON.stringify(porDestino))
}

/**
 * ¿La estación dejó de reportar?
 *
 * ESTE ES EL SENSOR QUE MAS FALTA HACE, y el que no existía cuando se cayó la WS2900. Un
 * sensor que se queda quieto no se distingue de uno que mide siempre lo mismo: hay que
 * calcularlo mirando el reloj, no los valores.
 *
 * El umbral son tres intervalos declarados por la estación, con un piso de diez minutos: un
 * envío perdido pasa, tres seguidos ya es un problema.
 */
function estaMuda () {
  if (!ultimo) return false
  const intervalo = (ultimosCampos.intervalo || 60) * 1000
  return (Date.now() - new Date(ultimo).getTime()) > Math.max(3 * intervalo, 600000)
}

// ---------------------------------------------------------------- reparto

async function repartir (crudo, campos) {
  const lista = activos()
  if (SECO || !lista.length) return []
  // TODOS EN PARALELO: con quince destinos, en serie el último saldría minutos después del
  // primero, y uno lento retrasaría a todos los que siguen.
  const r = await Promise.all(lista.map(async d =>
    ({ d, res: await enviarA(d, crudo, campos, estadoDe(d.nombre)) })))

  // UN DESTINO SALTADO POR SU INTERVALO NO ES UN FALLO: se deja el estado anterior. Si se
  // marcara caído cada vez que le toca esperar, el que sube cada 15 minutos figuraría en
  // problemas catorce de cada quince envíos.
  for (const m of r.filter(x => !x.res.ok && !x.res.saltado)) {
    anotar('error', m.d.nombre + ': ' + m.res.detalle)
  }
  const buenos = r.filter(x => x.res.ok && !x.res.saltado).length
  if (buenos) anotar('ok', buenos + ' destino' + (buenos > 1 ? 's' : '') + ' al día')
  return r
}

// ---------------------------------------------------------------- lo que usa el panel

const contexto = {
  estado () {
    const ds = CONFIG.destinos.map(d => {
      const e = estadoDe(d.nombre)
      const receta = RECETAS[d.receta]
      const minimo = Number(d.intervalo_min || 0) * 1000
      return {
        nombre: d.nombre,
        servicio: receta ? receta.nombre : (d.tipo || 'ecowitt'),
        verificado: receta ? receta.verificado : true,
        activo: d.activo !== false,
        ultimo_intento: e.ultimoIntento ? new Date(e.ultimoIntento).toISOString() : null,
        ultimo_ok: e.ultimoOk ? new Date(e.ultimoOk).toISOString() : null,
        detalle: e.ultimoDetalle || null,
        latencia: e.latencia ?? null,
        enviados: e.enviados || 0,
        fallidos: e.fallidos || 0,
        esperando: !!(minimo && e.ultimoIntento && (Date.now() - e.ultimoIntento) < minimo),
        problema: !!(e.ultimoDetalle && e.ultimoDetalle !== 'ok'),
      }
    })
    return {
      puente: { recibidos, ultimo, muda: estaMuda() ? 'ON' : 'OFF', seco: SECO },
      mqtt: { conectado: !!mqtt, motivo: SIN_MQTT ? 'desactivado' : mqttMotivo },
      datos: ultimosCampos,
      destinos: ds,
      historial: verLecturas().slice(-240),
      log: verEventos(60),
    }
  },

  config: () => CONFIG,

  guardar (nueva) {
    CONFIG = cfg.guardar(nueva)
    anotar('info', 'configuración guardada desde el panel')
    if (mqtt) { anunciar('cambio de configuración'); publicarPuente() }
    return CONFIG
  },

  /** Alta o edición. anterior = el nombre que tenía, o null si es nuevo. */
  destino (anterior, parcial) {
    const lista = [...CONFIG.destinos]
    const i = anterior ? lista.findIndex(x => x.nombre === anterior) : -1
    if (anterior && i === -1) return { error: 'no existe el destino "' + anterior + '"' }
    const previo = i !== -1 ? lista[i] : {}

    const d = {
      ...previo, ...parcial,
      // Una credencial en blanco significa "dejá la que estaba". Sin esto, tocar el botón de
      // apagar borraría la API key, porque el formulario no la manda de vuelta nunca.
      credenciales: cfg.fundirSecretos(
        { ...(previo.credenciales || {}), ...(parcial.credenciales || {}) },
        previo.credenciales),
    }

    const choque = lista.findIndex(x => x.nombre === d.nombre)
    if (choque !== -1 && choque !== i) return { error: 'ya hay un destino llamado "' + d.nombre + '"' }

    const v = revisar(d)
    if (v.error) return v

    if (i !== -1) lista[i] = d
    else lista.push(d)
    CONFIG = cfg.guardar({ ...CONFIG, destinos: lista })

    // Si le cambiaron el nombre, las entidades viejas quedarían huérfanas en Home Assistant.
    if (anterior && anterior !== d.nombre) {
      for (const m of retiros(anterior, ajustes())) publicar(m.tema, m.contenido)
      ESTADOS.delete(anterior)
    }
    anotar('info', (i !== -1 ? 'destino actualizado: ' : 'destino agregado: ') + d.nombre +
      (d.activo ? '' : ' (apagado)'))
    if (mqtt) { anunciar('destino ' + d.nombre); publicarPuente() }
    return { ok: true, faltan: v.faltan || [] }
  },

  borrar (nombre) {
    const lista = CONFIG.destinos.filter(x => x.nombre !== nombre)
    if (lista.length === CONFIG.destinos.length) return { error: 'no existe "' + nombre + '"' }
    CONFIG = cfg.guardar({ ...CONFIG, destinos: lista })
    ESTADOS.delete(nombre)
    // SE RETIRAN SUS ENTIDADES. Sin esto quedan para siempre en Home Assistant mostrando el
    // último valor que tuvieron, que es justo lo que hubo que limpiar a mano el 31/08/2026.
    for (const m of retiros(nombre, ajustes())) publicar(m.tema, m.contenido)
    anotar('aviso', 'destino borrado: ' + nombre)
    if (mqtt) publicarPuente()
    return { ok: true }
  },

  /**
   * Prueba un destino ahora mismo, salteándose su intervalo.
   *
   * SE USA LA ULTIMA LECTURA REAL, nunca una inventada. Si todavía no llegó ninguna, se dice y
   * no se manda: un dato falso publicado en Windy o en Home Assistant queda ahí, y después hay
   * que ir a borrarlo. Ya pasó una vez y costó una limpieza a mano.
   */
  async probar (nombre) {
    const d = CONFIG.destinos.find(x => x.nombre === nombre)
    if (!d) return { ok: false, detalle: 'no existe "' + nombre + '"' }
    if (!ultimo) {
      return {
        ok: false,
        detalle: 'todavía no llegó ningún envío de la estación. No se manda un dato inventado: ' +
          'quedaría publicado en el servicio.',
      }
    }
    const e = { ...estadoDe(nombre) }
    delete e.ultimoIntento          // saltea el intervalo mínimo, sólo para esta prueba
    const r = await enviarA({ ...d, reintentos: 0 }, ultimoCrudo, ultimosCampos, e)
    anotar(r.ok ? 'ok' : 'error', 'prueba manual · ' + nombre + ': ' + r.detalle)
    return r
  },
}

// ---------------------------------------------------------------- servidor

/** Saca los pocos campos que sirven para el registro. No interpreta el resto. */
const resumen = (c) => {
  const p = []
  if (c.temp_ext !== undefined) p.push('ext ' + c.temp_ext + '°')
  if (c.temp_int !== undefined) p.push('int ' + c.temp_int + '°')
  if (c.viento !== undefined) p.push('viento ' + c.viento + ' km/h')
  if (c.lluvia_dia !== undefined) p.push('lluvia ' + c.lluvia_dia + ' mm')
  return p.join(' · ') || (c.estacion || 'sin campos conocidos')
}

const servidor = http.createServer(async (req, res) => {
  // El panel primero. Si no era para él, es de la estación.
  try {
    if (await atender(req, res, contexto)) return
  } catch (e) {
    anotar('error', 'el panel falló: ' + e.message)
    if (!res.headersSent) { res.writeHead(500); res.end('error') }
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    return res.end('No hay nada acá. El panel está en /\n')
  }

  let cuerpo = ''
  req.on('data', c => {
    cuerpo += c
    // Un POST de la estación mide menos de 1 KB. Con este corte, algo que mande basura no
    // llena la memoria del contenedor.
    if (cuerpo.length > 64 * 1024) req.destroy()
  })

  req.on('end', async () => {
    if (!pareceEnvio(cuerpo)) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('Esto no parece un envío de estación.\n')
    }

    recibidos++
    ultimo = new Date().toISOString()
    ultimoCrudo = cuerpo

    // 1) archivar SIEMPRE y PRIMERO
    const guardado = archivar(cuerpo)

    // 2) contestar YA, sin esperar a los destinos. La estación no tiene por qué esperar a que
    //    HA conteste: si un destino tarda 15 s, el gateway daría el envío por fallado.
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('OK')

    const campos = normalizar(cuerpo)
    ultimosCampos = campos
    anotarLectura(campos)
    anotar('info', '#' + recibidos + '  ' + resumen(campos) + (guardado ? '' : '   [SIN ARCHIVAR]'))

    publicar(temaBase() + '/datos', JSON.stringify(campos))
    // Si apareció un sensor que antes no estaba, hay que anunciarlo o su entidad no existe.
    if (mqtt && Object.keys(campos).sort().join(',') !== camposAnunciados) anunciar('sensor nuevo')

    await repartir(cuerpo, campos)
    publicarPuente()
  })
})

servidor.on('error', e => {
  console.error('No se pudo escuchar en el puerto ' + PUERTO + ': ' + e.code)
  process.exit(1)
})

servidor.listen(PUERTO, () => {
  console.log('=== puente Ecowitt, puerto ' + PUERTO)
  console.log('    panel:         http://localhost:' + PUERTO + '/')
  console.log('    archivo crudo: ' + DATOS)
  console.log('    destinos:      ' + (CONFIG.destinos.length
    ? CONFIG.destinos.map(d => d.nombre + (d.activo ? '' : ' [apagado]')).join(', ')
    : 'ninguno — sólo archiva'))
  if (SECO) console.log('    modo seco: no reenvía')
  if (SIN_MQTT) console.log('    sin MQTT: no publica a Home Assistant')
  console.log('')
  console.log('    En el GW3000 -> Weather Services -> Customized:')
  console.log('      Protocol: Ecowitt   Port: ' + PUERTO + '   Path: /data/report')
  conectarMqtt()
})

// Relee la configuración por si alguien editó config.json a mano, y refresca el estado en HA.
// Lo segundo hace falta para que "estación sin reportar" se encienda sola cuando dejan de
// llegar envíos: si sólo se publicara al recibir uno, el silencio nunca se notaría.
setInterval(() => {
  cfg.olvidar()
  const antes = JSON.stringify(CONFIG)
  CONFIG = cfg.cargar()
  if (JSON.stringify(CONFIG) !== antes) {
    anotar('info', 'configuración recargada desde disco')
    if (mqtt) anunciar('config.json cambió')
  }
  publicarPuente()
}, 60000)

const despedirse = () => {
  // Se avisa que el puente se va ANTES de irse. El testamento cubre la muerte súbita; esto
  // cubre la salida ordenada, que es la que pasa cuando se actualiza el contenedor.
  publicar(temaBase() + '/estado', 'offline')
  console.log('\n' + recibidos + ' envíos recibidos.')
  setTimeout(() => process.exit(0), 150)
}
process.on('SIGINT', despedirse)
process.on('SIGTERM', despedirse)
