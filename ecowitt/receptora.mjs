// Puente Ecowitt: recibe los datos de una o varias estaciones, los archiva y los reparte.
//
//   node receptora.mjs                 escucha en el puerto 8088
//   node receptora.mjs --puerto N
//   node receptora.mjs --seco          no reenvía a nadie: sólo muestra y archiva
//   node receptora.mjs --sin-mqtt      reenvía pero NO publica a Home Assistant
//
// TODO SE PUEDE CONFIGURAR POR ENTORNO, que es lo que hace que esto sirva fuera de la casa
// donde se escribió. Ver `.env.ejemplo`. Nada acá adentro tiene una IP, un puerto ni una ruta
// escritos a mano.
//
// POR QUE EXISTE, y no es una capa de más
//
// Una pasarela Ecowitt sube a cuatro nubes de fábrica **y a UN solo servidor personalizado**.
// Uno. Si ese lugar va a Home Assistant, no queda ninguno para nada más — ni Windy, ni
// Windguru, ni una base propia, ni lo que aparezca mañana.
//
// Este puente se queda con ese único lugar y lo reparte a todos los destinos que haga falta.
//
// VARIAS ESTACIONES EN UN MISMO NODO, y sin darlas de alta a mano. Cada envío trae un PASSKEY
// que identifica al gateway: la primera vez que llega uno desconocido, el puente crea la
// estación, la deja apagada y la muestra en el panel para que alguien la bautice. Instalar es
// levantar el contenedor y apuntar el gateway; no hay ningún identificador que averiguar.
//
// UNA ESTACION APAGADA SE ARCHIVA IGUAL. Recibe, se guarda en disco, y no se reparte ni se
// publica a Home Assistant hasta que alguien la enciende. Es la única combinación segura para
// algo que apareció solo: no se pierde el dato, y no se manda a ningún lado sin permiso.
//
// EL ARCHIVO CRUDO ES LA MITAD DEL VALOR, y quizá la más importante.
//
// Cada envío se escribe tal cual llegó, antes de reenviarlo a ningún lado. Ese archivo no
// depende de que Home Assistant esté vivo, ni del grabador —que purga a los 30 días— ni de que
// las estadísticas existan. Es la copia que sobrevive a todo lo demás, y es la lección de la
// WS2900: se cayó el 15/08 y sus 33 sensores quedaron en unavailable sin dejar rastro.
//
// EL PROTOCOLO, en un párrafo: el gateway hace un POST con application/x-www-form-urlencoded a
// la ruta que uno le configure. Los campos son los de Ecowitt: PASSKEY, stationtype, dateutc,
// tempinf, humidityin, tempf, windspeedmph, rainratein y compañía. No hay autenticación: el
// PASSKEY identifica la estación pero viaja en claro, así que esto **sólo se expone a la red
// local**, nunca a internet.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// EL CLIENTE MQTT SE BUSCA EN DOS LUGARES, y no es capricho: en el contenedor todos los
// archivos quedan planos en /app, pero en el repositorio _mqtt.mjs vive en scripts/garnet/ —es
// el mismo cliente, ya probado con la alarma, y se copia al desplegar en vez de duplicarlo. Sin
// este respaldo, el puente **no se puede correr fuera del contenedor**, que es justo donde uno
// quiere probarlo antes de subirlo.
const { conectar } = await import('./_mqtt.mjs').catch(() => import('../garnet/_mqtt.mjs'))
import { normalizar, pareceEnvio } from './_normalizar.mjs'
import { enviarA } from './_destinos.mjs'
import { RECETAS } from './_recetas.mjs'
import * as cfg from './_config.mjs'
import { descubrimientos, descubrimientosNodo, retirosDestino, retirosEstacion, temas, idDe }
  from './_sensores.mjs'
import { atender, revisar } from './_panel.mjs'
import * as usuarios from './_usuarios.mjs'
import { anotar, anotarLectura, olvidarLecturas, verEventos, verLecturas } from './_registro.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? (process.argv[i + 1] ?? true) : d }

const PUERTO = Number(arg('puerto', process.env.PUERTO || 8088))
const SECO = process.argv.includes('--seco') || process.env.SECO === '1'
// SIN MQTT: para probar sin tocar el broker de casa.
//
// Existe por un error propio del 31/08/2026: una prueba con destinos inventados se conectó al
// broker real y creó 15 entidades falsas en Home Assistant que hubo que retirar a mano.
// **Una prueba no puede escribir en la casa.** Con esta bandera, no lo hace.
const SIN_MQTT = process.argv.includes('--sin-mqtt') || process.env.SIN_MQTT === '1'
const DATOS = process.env.ARCHIVO || process.env.RUTA_DATOS || path.join(AQUI, 'datos')

// LA SEMILLA: lo que el `.env` decide sobre cómo NACE esta instalación. Sólo se aplica cuando
// no hay config.json todavía; de ahí en más manda el panel. Ver `iniciar` en _config.mjs.
//
// Los campos vacíos se sacan a propósito: una variable sin definir no puede pisar un valor por
// defecto con una cadena vacía.
const sinVacios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))
cfg.iniciar(DATOS, [path.join(AQUI, 'destinos.json')], {
  nodo: sinVacios({ nombre: process.env.NOMBRE_NODO, raiz: process.env.RAIZ_MQTT }),
  mqtt: sinVacios({
    host: process.env.MQTT_HOST,
    puerto: process.env.MQTT_PUERTO ? Number(process.env.MQTT_PUERTO) : undefined,
    usuario: process.env.MQTT_USUARIO,
    clave: process.env.MQTT_CLAVE,
    prefijo: process.env.PREFIJO_HA,
  }),
})
// La clave con la que se firman las sesiones. Se genera sola la primera vez y vive en el
// volumen: si estuviera en memoria, cada actualización del contenedor echaría a todo el mundo.
usuarios.iniciar(DATOS)
let CONFIG = cfg.cargar()

// ---------------------------------------------------------------- el administrador inicial
//
// SE PUEDE CREAR DESDE EL DOCKER, con ADMIN_USUARIO y ADMIN_CLAVE. Es lo cómodo para quien
// instala: pone las dos variables en su .env, levanta el contenedor y ya entra.
//
// SOLO SE APLICA SI NO HAY NINGUN USUARIO. Si alguien cambió su contraseña desde el panel, un
// reinicio del contenedor NO se la revierte: eso sería una puerta trasera permanente escrita en
// un archivo de texto, y además haría imposible cambiarla de verdad.
//
// PARA RECUPERAR UNA CONTRASEÑA PERDIDA está ADMIN_RESET=1, que sí pisa la que hubiera. Es la
// salida de emergencia, y por eso se anota en el registro cuando se usa: un reseteo silencioso
// es indistinguible de alguien entrando por la ventana.
//
// LA CLAVE QUEDA EN TEXTO PLANO en el .env, y eso es inevitable con este método. Lo que sí se
// puede es no dejarla ahí para siempre: quien quiera, la cambia después desde el panel y borra
// las dos variables. Acá nunca se imprime.
const admUsuario = (process.env.ADMIN_USUARIO || '').trim()
const admClave = process.env.ADMIN_CLAVE || ''
if (admUsuario && admClave) {
  const hay = usuarios.hayUsuarios(CONFIG)
  const forzar = process.env.ADMIN_RESET === '1'
  if (!hay || forzar) {
    const r = usuarios.ponerUsuario(CONFIG, admUsuario, admClave, 'admin')
    if (r.error) {
      console.error('ADMIN_USUARIO/ADMIN_CLAVE: ' + r.error)
    } else {
      CONFIG = cfg.guardar({ ...CONFIG, usuarios: r.usuarios })
      console.log(hay
        ? 'ADMIN_RESET: se rehizo la contraseña de "' + admUsuario + '". Sacá ADMIN_RESET del entorno.'
        : 'administrador "' + admUsuario + '" creado desde las variables del contenedor')
    }
  }
}

const opcionesMqtt = () => ({
  raiz: CONFIG.nodo.raiz || 'estacion',
  prefijo: CONFIG.mqtt.prefijo || 'homeassistant',
  nombre: CONFIG.nodo.nombre,
})

/**
 * Con qué credenciales se habla con el broker.
 *
 * SE RESUELVE EN VIVO, en cada intento de conexión, y es la única excepción a la regla de la
 * semilla: lo que esté cargado en el panel gana, y si el panel está vacío se usa el entorno.
 * Así se puede rotar la clave del broker cambiando el `.env` y reiniciando, sin entrar al panel.
 *
 * DEVUELVE null SI NO HAY NADA CONFIGURADO, y eso no es un error: un puente sin Home Assistant
 * recibe, archiva y reparte igual. Lo único que se pierde es la vigilancia desde HA.
 */
const credencialesMqtt = () => {
  const m = CONFIG.mqtt || {}
  const host = m.host || process.env.MQTT_HOST || ''
  const usuario = m.usuario || process.env.MQTT_USUARIO || ''
  const clave = m.clave || process.env.MQTT_CLAVE || ''
  if (!host || !usuario || !clave) return null
  return { host, puerto: Number(m.puerto || process.env.MQTT_PUERTO || 1883), usuario, clave }
}

/**
 * Las estaciones a las que le toca un destino. Un comodín se expande a todas las que existan.
 *
 * TODO SE CUENTA POR PAR destino × estación: el estado, las entidades de Home Assistant y las
 * filas del panel. Un comodín que recibe de tres estaciones son tres relojes, tres latencias y
 * tres entidades, porque puede fallarle con una y andarle bien con las otras.
 */
const estacionesDe = (d) => d.estacion === '*'
  ? Object.keys(CONFIG.estaciones)
  : (CONFIG.estaciones[d.estacion] ? [d.estacion] : [])

/** Los destinos que le corresponden a una estación: los suyos, más los comodín. */
const destinosDe = (id) => CONFIG.destinos.filter(d =>
  d.activo !== false && (d.estacion === id || d.estacion === '*'))

const estacionesActivas = () => Object.values(CONFIG.estaciones).filter(e => e.activa)

// ---------------------------------------------------------------- estado en memoria
//
// Vive en memoria y se pierde al reiniciar, y está bien que así sea: es información de
// vigilancia, no un dato de la estación. Lo que no se puede perder ya está en datos/.

/** Por estación: cuántos envíos entraron, cuándo, y la última lectura. */
const EST = new Map()
const estadoEstacion = (id) => {
  if (!EST.has(id)) EST.set(id, { recibidos: 0, ultimo: null, campos: {}, crudo: '', anunciado: '' })
  return EST.get(id)
}

/**
 * Por destino Y POR ESTACION, y eso importa: un destino comodín que recibe de tres estaciones
 * tiene tres relojes distintos. Si compartieran el intervalo mínimo, la segunda estación se
 * quedaría siempre sin mandar porque la primera acaba de gastar el turno.
 */
const DEST = new Map()
const claveDestino = (nombre, idEstacion) => nombre + ' ' + idEstacion
const estadoDestino = (nombre, idEstacion) => {
  const k = claveDestino(nombre, idEstacion)
  if (!DEST.has(k)) DEST.set(k, {})
  return DEST.get(k)
}

let recibidosNodo = 0
let mqtt = null
let mqttMotivo = 'sin conectar'

// ---------------------------------------------------------------- archivo crudo

/**
 * Guarda el envío tal como llegó, una carpeta por estación y un archivo por día.
 *
 * SE ESCRIBE ANTES DE REENVIAR, y ese orden importa: si un destino cuelga o el proceso se cae a
 * mitad del reparto, el dato ya está en disco. Al revés se perdería justo el envío de la
 * tormenta que uno quería mirar.
 *
 * EL ARCHIVO SE NOMBRA CON EL DIA LOCAL, no con el UTC, y la marca de tiempo de cada línea va
 * en ISO (UTC). Es a propósito: uno busca "qué pasó el martes a la tarde" en horario de acá,
 * pero cada línea tiene que ser comparable con cualquier otro registro. Entre las 21 y las 24
 * los dos días no coinciden — conviene saberlo antes de buscar un dato y no encontrarlo.
 */
const archivar = (idEstacion, cuerpo) => {
  try {
    const dir = path.join(DATOS, idEstacion)
    fs.mkdirSync(dir, { recursive: true })
    const d = new Date()
    const nombre = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') + '.txt'
    fs.appendFileSync(path.join(dir, nombre), d.toISOString() + '\t' + cuerpo + '\n')
    return true
  } catch (e) {
    anotar('error', 'NO SE PUDO ARCHIVAR (' + idEstacion + '): ' + e.message)
    return false
  }
}

// ---------------------------------------------------------------- MQTT

const publicar = (tema, valor, retener = true) => { if (mqtt) mqtt.publicar(tema, valor, retener) }

/**
 * Se conecta al broker y reintenta para siempre si se cae.
 *
 * NO DEPENDE DE MQTT PARA FUNCIONAR: si el broker no está, el puente igual recibe, archiva y
 * reparte. Lo único que se pierde es la vigilancia. Al revés —caerse porque no hay broker—
 * sería dejar de guardar datos por no poder avisar que se guardan.
 */
let esperaMqtt = 5000
let conectando = false
function conectarMqtt () {
  if (SECO || SIN_MQTT || conectando || mqtt) return
  conectando = true
  const t = temas(opcionesMqtt().raiz, '_')
  // El testamento: si este proceso se muere, el broker publica "offline" por él y TODAS las
  // entidades, de todas las estaciones, quedan no disponibles en vez de congeladas.
  const will = { tema: t.disponible, contenido: 'offline' }
  const reintentar = (motivo) => {
    mqtt = null
    conectando = false
    mqttMotivo = motivo
    anotar('aviso', 'sin MQTT (' + motivo + '). Reintento en ' + Math.round(esperaMqtt / 1000) + ' s.')
    setTimeout(conectarMqtt, esperaMqtt)
    esperaMqtt = Math.min(esperaMqtt * 2, 60000)
  }
  // NO SE DEJA QUE EL CLIENTE BUSQUE POR SU CUENTA. `credenciales()` de _mqtt.mjs tiene la IP y
  // las rutas de la casa donde se escribió: sirve para la alarma, no para alguien que instale
  // esto en su casa. Acá las credenciales se arman explícitas o no se conecta.
  const propias = credencialesMqtt()
  if (!propias) {
    conectando = false
    mqttMotivo = 'sin configurar'
    anotar('info', 'sin MQTT: no hay broker configurado. El puente recibe, archiva y reparte ' +
      'igual; lo único que falta es la vigilancia desde Home Assistant.')
    return
  }

  conectar((e) => reintentar(e.message), { id: 'ecowitt-puente', will, credenciales: propias })
    .then(c => {
      mqtt = c
      conectando = false
      mqttMotivo = ''
      esperaMqtt = 5000
      publicar(t.disponible, 'online')
      anunciarTodo('conexión al broker')
      publicarNodo()
    })
    .catch(e => reintentar(e.message))
}

/**
 * Publica el auto-descubrimiento de todas las estaciones activas y del nodo.
 *
 * SE VUELVE A ANUNCIAR cuando cambian los destinos, cuando se enciende una estación, o cuando
 * aparece un sensor que antes no estaba. Los mensajes son idempotentes: republicar el mismo
 * descubrimiento no duplica nada en Home Assistant, sólo lo actualiza.
 */
function anunciarTodo (motivo) {
  if (!mqtt) return
  const o = opcionesMqtt()
  let n = 0
  for (const m of descubrimientosNodo(o)) {
    publicar(m.tema, m.contenido); n++
  }
  for (const est of estacionesActivas()) {
    const e = estadoEstacion(est.id)
    for (const m of descubrimientos(est, e.campos, destinosDe(est.id), o)) {
      publicar(m.tema, m.contenido); n++
    }
    e.anunciado = Object.keys(e.campos).sort().join(',')
  }
  anotar('info', n + ' entidades anunciadas a Home Assistant (' + motivo + ')')
}

/** ¿Esta estación dejó de reportar? */
function estaMuda (est) {
  const e = estadoEstacion(est.id)
  if (!e.ultimo) return false
  // El umbral son tres intervalos declarados por la estación, con piso de diez minutos: un
  // envío perdido pasa, tres seguidos ya es un problema.
  //
  // ESTE ES EL SENSOR QUE MAS FALTA HACE, y el que no existía cuando se cayó la WS2900. Un
  // sensor quieto no se distingue de uno que mide siempre lo mismo: hay que calcularlo mirando
  // el reloj, no los valores.
  const intervalo = (e.campos.intervalo || 60) * 1000
  return (Date.now() - new Date(e.ultimo).getTime()) > Math.max(3 * intervalo, 600000)
}

function publicarEstacion (est) {
  const o = opcionesMqtt()
  const t = temas(o.raiz, est.id)
  const e = estadoEstacion(est.id)
  publicar(t.datos, JSON.stringify(e.campos))
  publicar(t.estacion, JSON.stringify({
    ultimo: e.ultimo, recibidos: e.recibidos, muda: estaMuda(est) ? 'ON' : 'OFF',
  }))
}

/** El estado de todos los destinos, en un solo tema. La clave es la misma que usa _sensores. */
function publicarDestinos () {
  const o = opcionesMqtt()
  const t = temas(o.raiz, '_')
  const mapa = {}
  for (const d of CONFIG.destinos) {
    for (const id of estacionesDe(d)) {
      const s = estadoDestino(d.nombre, id)
      mapa[idDe(d.nombre) + '_' + id] = {
        problema: (d.activo !== false && s.ultimoDetalle && s.ultimoDetalle !== 'ok') ? 'ON' : 'OFF',
        detalle: d.activo === false ? 'apagado' : (s.ultimoDetalle || 'sin enviar'),
        latencia: s.latencia ?? null,
        ultimo_ok: s.ultimoOk ? new Date(s.ultimoOk).toISOString() : null,
      }
    }
  }
  publicar(t.destinos, JSON.stringify(mapa))
}

function publicarNodo () {
  const o = opcionesMqtt()
  const t = temas(o.raiz, '_')
  const activas = estacionesActivas()
  const mudas = activas.filter(estaMuda).length
  const caidos = [...DEST.values()].filter(s => s.ultimoDetalle && s.ultimoDetalle !== 'ok').length
  publicar(t.nodo, JSON.stringify({
    estaciones: activas.length,
    recibidos: recibidosNodo,
    algo_mal: (mudas || caidos) ? 'ON' : 'OFF',
  }))
  for (const est of activas) publicarEstacion(est)
  publicarDestinos()
}

// ---------------------------------------------------------------- reparto

async function repartir (est, crudo, campos) {
  const lista = destinosDe(est.id)
  if (SECO || !lista.length) return []
  // TODOS EN PARALELO: con quince destinos, en serie el último saldría minutos después del
  // primero, y uno lento retrasaría a todos los que siguen.
  // LA CLAVE DE ESTADO ES SIEMPRE LA ESTACION CONCRETA, tambien para los comodines. La primera
  // version usaba la cadena '*' para ellos y eso les daba UN SOLO reloj compartido: la segunda
  // estacion se quedaba sin mandar porque la primera acababa de gastar el turno. Lo encontro la
  // prueba, contra un comentario de este mismo archivo que ya advertia el problema.
  const r = await Promise.all(lista.map(async d => ({
    d, res: await enviarA(d, crudo, campos, estadoDestino(d.nombre, est.id)),
  })))

  // UN DESTINO SALTADO POR SU INTERVALO NO ES UN FALLO: se deja el estado anterior. Si se
  // marcara caído cada vez que le toca esperar, el que sube cada 15 minutos figuraría en
  // problemas catorce de cada quince envíos.
  for (const m of r.filter(x => !x.res.ok && !x.res.saltado)) {
    anotar('error', est.id + ' → ' + m.d.nombre + ': ' + m.res.detalle)
  }
  const buenos = r.filter(x => x.res.ok && !x.res.saltado).length
  if (buenos) anotar('ok', est.id + ': ' + buenos + ' destino' + (buenos > 1 ? 's' : '') + ' al día')
  return r
}

// ---------------------------------------------------------------- lo que usa el panel

/** Una fila por destino Y POR ESTACION que le toca. Un comodín con tres estaciones son tres. */
function filasDestino () {
  const filas = []
  for (const d of CONFIG.destinos) {
    const receta = RECETAS[d.receta]
    const base = {
      nombre: d.nombre,
      servicio: receta ? receta.nombre : (d.tipo || 'ecowitt'),
      verificado: receta ? receta.verificado : true,
      comodin: d.estacion === '*',
      activo: d.activo !== false,
    }
    const donde = estacionesDe(d).map(id =>
      ({ id, nombre: (CONFIG.estaciones[id] || {}).nombre || id }))
    // Un destino comodín sin ninguna estación todavía no tiene filas. Se muestra igual, con la
    // estación en blanco: si no, un destino recién creado desaparecería del panel.
    if (!donde.length) donde.push({ id: '', nombre: d.estacion === '*' ? 'ninguna estación todavía' : d.estacion })
    for (const w of donde) {
      const s = estadoDestino(d.nombre, w.id)
      const minimo = Number(d.intervalo_min || 0) * 1000
      filas.push({
        ...base,
        estacion: w.id, estacion_nombre: w.nombre,
        ultimo_intento: s.ultimoIntento ? new Date(s.ultimoIntento).toISOString() : null,
        ultimo_ok: s.ultimoOk ? new Date(s.ultimoOk).toISOString() : null,
        detalle: s.ultimoDetalle || null,
        latencia: s.latencia ?? null,
        enviados: s.enviados || 0,
        fallidos: s.fallidos || 0,
        esperando: !!(minimo && s.ultimoIntento && (Date.now() - s.ultimoIntento) < minimo),
        problema: !!(s.ultimoDetalle && s.ultimoDetalle !== 'ok'),
      })
    }
  }
  return filas
}

const contexto = {
  estado () {
    const estaciones = Object.values(CONFIG.estaciones).map(est => {
      const e = estadoEstacion(est.id)
      return {
        id: est.id, nombre: est.nombre, modelo: est.modelo, activa: est.activa,
        passkey: est.passkey ? '…' + String(est.passkey).slice(-4) : '',
        visto_primera: est.visto_primera, visto_ultima: est.visto_ultima,
        recibidos: e.recibidos, ultimo: e.ultimo,
        muda: estaMuda(est) ? 'ON' : 'OFF',
        datos: e.campos,
        historial: verLecturas(est.id).slice(-240),
      }
    })
    const filas = filasDestino()
    return {
      nodo: {
        nombre: CONFIG.nodo.nombre,
        recibidos: recibidosNodo,
        estaciones: estaciones.length,
        activas: estaciones.filter(e => e.activa).length,
        seco: SECO,
        algo_mal: (estaciones.some(e => e.activa && e.muda === 'ON') ||
                   filas.some(f => f.activo && f.problema)) ? 'ON' : 'OFF',
      },
      mqtt: { conectado: !!mqtt, motivo: SIN_MQTT ? 'desactivado' : mqttMotivo },
      estaciones,
      destinos: filas,
      log: verEventos(60),
    }
  },

  config: () => CONFIG,

  guardar (nueva) {
    CONFIG = cfg.guardar(nueva)
    anotar('info', 'configuración guardada desde el panel')
    if (mqtt) {
      anunciarTodo('cambio de configuración')
      publicarNodo()
    } else if (credencialesMqtt()) {
      // SE INTENTA CONECTAR AHI MISMO, y esto arregla algo que pasó de verdad el 01/09/2026:
      // el puente arrancó sin broker configurado, se dijo "sin MQTT" y no volvió a intentarlo
      // nunca. Después alguien cargó el broker en el panel, guardó, y **no pasó nada** — había
      // que reiniciar el contenedor para que sirviera, cosa que sólo decía una nota al pie.
      //
      // Guardar una configuración y que no tenga efecto es la peor forma de fallar: no hay
      // error, no hay señal, y el que la cargó se queda mirando una pantalla que dice que todo
      // está bien.
      anotar('info', 'se cargó un broker: intentando conectar')
      conectarMqtt()
    }
    return CONFIG
  },

  /**
   * Renombra o enciende una estación. El id NO se puede cambiar: es la raíz de sus temas MQTT
   * y de su carpeta de archivo, y cambiarlo dejaría entidades huérfanas en Home Assistant y
   * partiría el histórico en dos.
   */
  estacion (id, parcial) {
    const est = CONFIG.estaciones[id]
    if (!est) return { error: 'no existe la estación "' + id + '"' }
    const antes = est.activa
    const nueva = { ...est, ...parcial, id }
    CONFIG = cfg.guardar({ ...CONFIG, estaciones: { ...CONFIG.estaciones, [id]: nueva } })
    anotar('info', 'estación ' + id + ': ' + (parcial.nombre !== undefined ? 'renombrada a "' + parcial.nombre + '"' : '') +
      (parcial.activa !== undefined ? (parcial.activa ? 'encendida' : 'apagada') : ''))
    if (mqtt) {
      // Al apagarla se retiran sus entidades: si no, quedan en Home Assistant mostrando para
      // siempre el último valor que tuvieron, que es la falla que este puente existe para evitar.
      if (antes && !nueva.activa) {
        for (const m of retirosEstacion(id, opcionesMqtt())) publicar(m.tema, m.contenido)
      }
      anunciarTodo('estación ' + id)
      publicarNodo()
    }
    return { ok: true }
  },

  borrarEstacion (id) {
    if (!CONFIG.estaciones[id]) return { error: 'no existe "' + id + '"' }
    const est = CONFIG.estaciones[id]
    const resto = { ...CONFIG.estaciones }
    delete resto[id]
    // Los destinos que apuntaban SOLO a ella se van con ella: quedarían mudos para siempre.
    const huerfanos = CONFIG.destinos.filter(d => d.estacion === id)
    CONFIG = cfg.guardar({
      ...CONFIG, estaciones: resto,
      destinos: CONFIG.destinos.filter(d => d.estacion !== id),
    })
    for (const m of retirosEstacion(id, opcionesMqtt())) publicar(m.tema, m.contenido)
    for (const d of huerfanos) {
      for (const m of retirosDestino(d, id, opcionesMqtt())) publicar(m.tema, m.contenido)
      DEST.delete(claveDestino(d.nombre, id))
    }
    EST.delete(id)
    olvidarLecturas(id)
    anotar('aviso', 'estación borrada: ' + (est.nombre || id) +
      (huerfanos.length ? ' (y ' + huerfanos.length + ' destinos suyos)' : ''))
    // EL ARCHIVO CRUDO NO SE BORRA. Borrar una estación del panel es dejar de vigilarla, no
    // tirar su historia: la carpeta datos/<id>/ queda, y si alguien la vuelve a apuntar, sigue
    // escribiendo donde estaba.
    if (mqtt) publicarNodo()
    return { ok: true, aviso: 'El archivo crudo de datos/' + id + '/ NO se borró.' }
  },

  /** Alta o edición de un destino. anterior = el nombre que tenía, o null si es nuevo. */
  destino (anterior, parcial) {
    const lista = [...CONFIG.destinos]
    const i = anterior ? lista.findIndex(x => x.nombre === anterior) : -1
    if (anterior && i === -1) return { error: 'no existe el destino "' + anterior + '"' }
    const previo = i !== -1 ? lista[i] : {}

    const d = {
      estacion: '*', ...previo, ...parcial,
      // Una credencial en blanco significa "dejá la que estaba". Sin esto, tocar el botón de
      // apagar borraría la API key, porque el formulario no la manda de vuelta nunca.
      credenciales: cfg.fundirSecretos(
        { ...(previo.credenciales || {}), ...(parcial.credenciales || {}) },
        previo.credenciales),
    }
    if (d.estacion !== '*' && !CONFIG.estaciones[d.estacion]) {
      return { error: 'no existe la estación "' + d.estacion + '"' }
    }

    const choque = lista.findIndex(x => x.nombre === d.nombre)
    if (choque !== -1 && choque !== i) return { error: 'ya hay un destino llamado "' + d.nombre + '"' }

    const v = revisar(d)
    if (v.error) return v

    if (i !== -1) lista[i] = d
    else lista.push(d)
    const estacionAntes = previo.estacion
    CONFIG = cfg.guardar({ ...CONFIG, destinos: lista })

    // Si le cambiaron el nombre o la estación, las entidades viejas quedarían huérfanas.
    if (anterior && (anterior !== d.nombre || estacionAntes !== d.estacion)) {
      const viejo = { ...previo, nombre: anterior, estacion: estacionAntes }
      for (const id of estacionesDe(viejo)) {
        for (const m of retirosDestino(viejo, id, opcionesMqtt())) publicar(m.tema, m.contenido)
        DEST.delete(claveDestino(anterior, id))
      }
    }
    anotar('info', (i !== -1 ? 'destino actualizado: ' : 'destino agregado: ') + d.nombre +
      ' → ' + (d.estacion === '*' ? 'todas las estaciones' : d.estacion) +
      (d.activo ? '' : ' (apagado)'))
    if (mqtt) { anunciarTodo('destino ' + d.nombre); publicarNodo() }
    return { ok: true, faltan: v.faltan || [] }
  },

  borrar (nombre) {
    const d = CONFIG.destinos.find(x => x.nombre === nombre)
    if (!d) return { error: 'no existe "' + nombre + '"' }
    CONFIG = cfg.guardar({ ...CONFIG, destinos: CONFIG.destinos.filter(x => x.nombre !== nombre) })
    // SE RETIRAN SUS ENTIDADES. Sin esto quedan para siempre en Home Assistant mostrando el
    // último valor que tuvieron, que es justo lo que hubo que limpiar a mano el 31/08/2026.
    for (const id of estacionesDe(d)) {
      for (const m of retirosDestino(d, id, opcionesMqtt())) publicar(m.tema, m.contenido)
      DEST.delete(claveDestino(nombre, id))
    }
    anotar('aviso', 'destino borrado: ' + nombre)
    if (mqtt) publicarNodo()
    return { ok: true }
  },

  /**
   * Prueba un destino ahora mismo, salteándose su intervalo.
   *
   * SE USA LA ULTIMA LECTURA REAL, nunca una inventada. Si todavía no llegó ninguna, se dice y
   * no se manda: un dato falso publicado en Windy o en Home Assistant queda ahí, y después hay
   * que ir a borrarlo. Ya pasó una vez y costó una limpieza a mano.
   */
  async probar (nombre, idEstacion) {
    const d = CONFIG.destinos.find(x => x.nombre === nombre)
    if (!d) return { ok: false, detalle: 'no existe "' + nombre + '"' }

    // Con qué lectura se prueba: la de su estación, o la de la que haya reportado más recién si
    // el destino es comodín.
    let id = idEstacion && idEstacion !== '*' ? idEstacion : d.estacion
    if (id === '*') {
      const conDatos = [...EST.entries()].filter(([, e]) => e.ultimo)
        .sort((a, b) => new Date(b[1].ultimo) - new Date(a[1].ultimo))
      id = conDatos.length ? conDatos[0][0] : null
    }
    const e = id ? estadoEstacion(id) : null
    if (!e || !e.ultimo) {
      return {
        ok: false,
        detalle: 'todavía no llegó ningún envío. No se manda un dato inventado: quedaría ' +
          'publicado en el servicio.',
      }
    }
    const s = { ...estadoDestino(nombre, id) }
    delete s.ultimoIntento          // saltea el intervalo mínimo, sólo para esta prueba
    const r = await enviarA({ ...d, reintentos: 0 }, e.crudo, e.campos, s)
    anotar(r.ok ? 'ok' : 'error', 'prueba manual · ' + nombre + ' con datos de ' + id + ': ' + r.detalle)
    return r
  },
}

// ---------------------------------------------------------------- recepción

/** Saca los pocos campos que sirven para el registro. No interpreta el resto. */
const resumen = (c) => {
  const p = []
  if (c.temp_ext !== undefined) p.push('ext ' + c.temp_ext + '°')
  if (c.temp_int !== undefined) p.push('int ' + c.temp_int + '°')
  if (c.viento !== undefined) p.push('viento ' + c.viento + ' km/h')
  if (c.lluvia_dia !== undefined) p.push('lluvia ' + c.lluvia_dia + ' mm')
  return p.join(' · ') || (c.estacion || 'sin campos conocidos')
}

/**
 * Encuentra la estación de un envío, o la crea.
 *
 * LA ESTACION NUEVA NACE APAGADA Y SIN NOMBRE. Es lo único seguro para algo que apareció solo:
 * se archiva desde el primer envío, y no se manda a ningún lado ni se publica a Home Assistant
 * hasta que una persona la mire y la encienda.
 */
function ubicar (campos, ruta) {
  const identidad = cfg.identificar(campos, ruta)
  const id = cfg.estacionDe(CONFIG, identidad)
  if (id) {
    const est = CONFIG.estaciones[id]
    // La última vez que se la vio se guarda, pero no en cada envío: escribir el config.json
    // sesenta veces por hora por estación es desgaste de disco para un dato que sólo importa
    // cuando una estación deja de reportar. Se actualiza cada media hora.
    const visto = new Date(est.visto_ultima || 0).getTime()
    if (Date.now() - visto > 1800000) {
      CONFIG = cfg.guardar({
        ...CONFIG,
        estaciones: { ...CONFIG.estaciones, [id]: { ...est, visto_ultima: new Date().toISOString() } },
      })
    }
    return CONFIG.estaciones[id]
  }

  if (!identidad) {
    // Sin PASSKEY, sin ID y sin ruta propia no hay con qué distinguirla de otra. Se archiva
    // aparte y se avisa: es preferible a mezclar dos estaciones en la misma carpeta.
    const suelta = CONFIG.estaciones.sin_identificar ||
      { ...cfg.estacionNueva('sin_identificar', ''), nombre: 'Sin identificar' }
    if (!CONFIG.estaciones.sin_identificar) {
      CONFIG = cfg.guardar({ ...CONFIG, estaciones: { ...CONFIG.estaciones, sin_identificar: suelta } })
      anotar('aviso', 'llegó un envío sin PASSKEY ni ID. Se archiva en datos/sin_identificar/. ' +
        'Si son dos estaciones así, hay que darles rutas distintas en el gateway.')
    }
    return CONFIG.estaciones.sin_identificar
  }

  const nuevoId = identidad.clave === 'passkey'
    ? cfg.idLibre(CONFIG, campos)
    : (cfg.aId(identidad.valor) || cfg.idLibre(CONFIG, campos))
  const est = {
    ...cfg.estacionNueva(nuevoId, identidad.clave === 'passkey' ? identidad.valor : '', campos),
  }
  CONFIG = cfg.guardar({ ...CONFIG, estaciones: { ...CONFIG.estaciones, [nuevoId]: est } })
  anotar('aviso', 'ESTACION NUEVA descubierta: ' + nuevoId + ' (' + (campos.estacion || 'modelo desconocido') +
    '). Está apagada: se archiva pero no se reparte. Ponele nombre y encendela en el panel.')
  if (mqtt) publicarNodo()
  return CONFIG.estaciones[nuevoId]
}

const servidor = http.createServer(async (req, res) => {
  // El panel primero. Si no era para él, es de una estación.
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
    // Un POST de una estación mide menos de 1 KB. Con este corte, algo que mande basura no
    // llena la memoria del contenedor.
    if (cuerpo.length > 64 * 1024) req.destroy()
  })

  req.on('end', async () => {
    if (!pareceEnvio(cuerpo)) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('Esto no parece un envío de estación.\n')
    }

    const campos = normalizar(cuerpo)
    const est = ubicar(campos, new URL(req.url, 'http://x').pathname)

    // 1) archivar SIEMPRE y PRIMERO, esté la estación encendida o apagada
    const guardado = archivar(est.id, cuerpo)

    // 2) contestar YA, sin esperar a los destinos. La estación no tiene por qué esperar a que
    //    Home Assistant conteste: si un destino tarda 15 s, el gateway daría el envío por
    //    fallado y algunos gateways dejan de mandar después de varios fallos.
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('OK')

    recibidosNodo++
    const e = estadoEstacion(est.id)
    e.recibidos++
    e.ultimo = new Date().toISOString()
    e.campos = campos
    e.crudo = cuerpo
    anotarLectura(est.id, campos)
    anotar('info', est.id + ' #' + e.recibidos + '  ' + resumen(campos) +
      (guardado ? '' : '   [SIN ARCHIVAR]') + (est.activa ? '' : '   [apagada: no se reparte]'))

    if (!est.activa) return

    publicarEstacion(est)
    // Si apareció un sensor que antes no estaba, hay que anunciarlo o su entidad no existe.
    if (mqtt && Object.keys(campos).sort().join(',') !== e.anunciado) anunciarTodo('sensor nuevo en ' + est.id)

    await repartir(est, cuerpo, campos)
    publicarNodo()
  })
})

servidor.on('error', e => {
  console.error('No se pudo escuchar en el puerto ' + PUERTO + ': ' + e.code)
  process.exit(1)
})

servidor.listen(PUERTO, () => {
  const n = Object.keys(CONFIG.estaciones).length
  console.log('=== ' + (CONFIG.nodo.nombre || 'Puente Ecowitt') + ', puerto ' + PUERTO)
  console.log('    panel:         http://localhost:' + PUERTO + '/')
  console.log('    archivo crudo: ' + DATOS)
  console.log('    estaciones:    ' + (n
    ? Object.values(CONFIG.estaciones).map(e => (e.nombre || e.id) + (e.activa ? '' : ' [apagada]')).join(', ')
    : 'ninguna todavía — apuntá un gateway y aparece sola'))
  console.log('    destinos:      ' + (CONFIG.destinos.length
    ? CONFIG.destinos.map(d => d.nombre + ' → ' + d.estacion).join(', ')
    : 'ninguno — sólo archiva'))
  if (SECO) console.log('    modo seco: no reenvía')
  if (SIN_MQTT) console.log('    sin MQTT: no publica a Home Assistant')
  console.log('')
  console.log('    En el gateway -> Weather Services -> Customized:')
  console.log('      Protocol: Ecowitt   Port: ' + PUERTO + '   Path: /data/report')
  conectarMqtt()
})

// Relee la configuración por si alguien editó config.json a mano, y refresca el estado en HA.
// Lo segundo hace falta para que "sin reportar" se encienda sola cuando dejan de llegar envíos:
// si sólo se publicara al recibir uno, el silencio nunca se notaría.
setInterval(() => {
  cfg.olvidar()
  const antes = JSON.stringify(CONFIG)
  CONFIG = cfg.cargar()
  if (JSON.stringify(CONFIG) !== antes) {
    anotar('info', 'configuración recargada desde disco')
    if (mqtt) anunciarTodo('config.json cambió')
  }
  publicarNodo()
}, 60000)

const despedirse = () => {
  // Se avisa que el puente se va ANTES de irse. El testamento cubre la muerte súbita; esto
  // cubre la salida ordenada, que es la que pasa cuando se actualiza el contenedor.
  publicar(temas(opcionesMqtt().raiz, '_').disponible, 'offline')
  console.log('\n' + recibidosNodo + ' envíos recibidos.')
  setTimeout(() => process.exit(0), 150)
}
process.on('SIGINT', despedirse)
process.on('SIGTERM', despedirse)
