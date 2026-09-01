// Weather Station Bridge: recibe una o varias estaciones meteorologicas, las archiva y las
// reparte a los servicios que hagan falta.
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
// Casi todas las estaciones domesticas suben a las nubes de su marca **y a UN solo servidor
// personalizado**. Uno. Si ese lugar va a Home Assistant, no queda ninguno para nada mas — ni
// Windy, ni Windguru, ni una base propia, ni lo que aparezca mañana.
//
// QUE ESTACIONES ENTRAN: las que hablan Ecowitt, las que hablan el formato de Weather
// Underground —que son casi todas las demas marcas— y cualquier cosa que sepa mandar un JSON.
// Ver `_protocolos.mjs`.
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
// LOS PROTOCOLOS, en un parrafo: el gateway manda los datos a la ruta que uno le configure, en
// el cuerpo de un POST (Ecowitt) o en la URL de un GET (Wunderground). Ninguno de los dos tiene
// autenticacion —el PASSKEY identifica la estacion pero viaja en claro— asi que esto **solo se
// expone a la red local**, nunca a internet. Ver `_protocolos.mjs`.

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
import { normalizar } from './_normalizar.mjs'
import { reconocer, catalogo as catalogoProtocolos } from './_protocolos.mjs'
import { enviarA } from './_destinos.mjs'
import { RECETAS } from './_recetas.mjs'
import * as cfg from './_config.mjs'
import { descubrimientos, descubrimientosNodo, retirosDestino, retirosEstacion, temas, idDe }
  from './_sensores.mjs'
import { atender, revisar } from './_panel.mjs'
import { inventario } from './_estaticos.mjs'
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
  if (!EST.has(id)) {
    EST.set(id, {
      recibidos: 0, ultimo: null, campos: {}, crudo: '', anunciado: '',
      // Los paquetes del día llevan de qué día son: al cruzar la medianoche se reinician solos.
      // Se guarda el día LOCAL, que es el que uno quiere leer, igual que el archivo crudo.
      hoy: { dia: '', cuenta: 0 },
    })
  }
  return EST.get(id)
}

/** El día local, como AAAA-MM-DD. Sirve para saber cuándo reiniciar los contadores diarios. */
const diaLocal = () => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

const ARRANQUE = Date.now()
const VERSION = '2.0'

/**
 * Por destino Y POR ESTACION, y eso importa: un destino comodín que recibe de tres estaciones
 * tiene tres relojes distintos. Si compartieran el intervalo mínimo, la segunda estación se
 * quedaría siempre sin mandar porque la primera acaba de gastar el turno.
 */
const DEST = new Map()

/**
 * La ventana de 24 horas de un destino: 24 baldes de una hora.
 *
 * SE USAN BALDES Y NO UNA LISTA DE ENVIOS porque una lista crece con el tráfico: con 200
 * estaciones mandando cada minuto son 288.000 entradas por día y por destino. Veinticuatro
 * baldes ocupan lo mismo con una estación que con doscientas.
 *
 * Cada balde guarda cuántos envíos hubo, cuántos salieron bien y cuánto sumaron de latencia. La
 * hora se calcula con el reloj: al dar la vuelta, el balde que se reusa se vacía primero.
 */
const anotarVentana = (estado, ok, ms) => {
  if (!estado.ventana) estado.ventana = Array.from({ length: 24 }, () => ({ h: -1, n: 0, ok: 0, ms: 0 }))
  const hora = Math.floor(Date.now() / 3600000)
  const b = estado.ventana[hora % 24]
  if (b.h !== hora) { b.h = hora; b.n = 0; b.ok = 0; b.ms = 0 }
  b.n++
  if (ok) b.ok++
  if (ms) b.ms += ms
}

/** Lo que dice esa ventana: tasa de aciertos y latencia media de las últimas 24 h. */
const resumenVentana = (estado) => {
  const hora = Math.floor(Date.now() / 3600000)
  let n = 0, ok = 0, ms = 0
  for (const b of (estado.ventana || [])) {
    if (b.h < 0 || hora - b.h >= 24) continue
    n += b.n; ok += b.ok; ms += b.ms
  }
  return {
    envios24h: n,
    tasa24h: n ? Math.round((ok / n) * 1000) / 10 : null,
    latencia_media: n ? Math.round(ms / n) : null,
  }
}
// El separador es un NUL escrito como escape, no como byte literal. Sirve porque no puede
// aparecer ni en el nombre de un destino ni en el id de una estacion, asi que dos pares
// distintos nunca dan la misma clave. Y va como \u0000 y no crudo: un byte de control
// invisible en el codigo hace que grep trate el archivo como binario y deje de buscar en el.
const claveDestino = (nombre, idEstacion) => nombre + '\u0000' + idEstacion
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

  conectar((e) => reintentar(e.message), { id: 'ws-bridge', will, credenciales: propias })
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

/**
 * En qué situación está una estación. Los umbrales son los del pliego de diseño:
 *
 *   en_linea    reportó hace menos de 2 intervalos
 *   demorada    entre 2 intervalos y 30 minutos
 *   sin_senal   más de 30 minutos
 *   apagada     no se reparte ni se publica, aunque siga archivando
 *   sin_datos   nunca reportó
 *
 * SON CUATRO ESTADOS Y NO DOS, y la diferencia importa: "demorada" es un envío que se perdió y
 * pasa todos los días; "sin señal" es la falla que hay que mirar. Tratarlas igual hace que el
 * panel avise tanto que uno deja de mirarlo.
 */
function situacion (est) {
  if (!est.activa) return 'apagada'
  const e = estadoEstacion(est.id)
  if (!e.ultimo) return 'sin_datos'
  const pasado = Date.now() - new Date(e.ultimo).getTime()
  const intervalo = (e.campos.intervalo || 60) * 1000
  if (pasado < 2 * intervalo) return 'en_linea'
  if (pasado < 1800000) return 'demorada'
  return 'sin_senal'
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
  const r = await Promise.all(lista.map(async d => {
    const s = estadoDestino(d.nombre, est.id)
    const res = await enviarA(d, crudo, campos, s)
    // Un salteado por intervalo no cuenta: no se intentó nada, y meterlo en la ventana bajaría
    // la tasa de aciertos de un destino que está funcionando perfecto.
    if (!res.saltado) anotarVentana(s, res.ok, res.latencia)
    return { d, res }
  }))

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

const contexto = {
  /**
   * SOLO AGREGADOS. Es lo que el panel pide cada 5 segundos, así que **no puede crecer con la
   * cantidad de estaciones**.
   *
   * La primera versión devolvía todo: cada estación con sus 67 campos y sus 240 puntos de
   * historial. Medido el 01/09/2026 con 200 estaciones: **4,6 MB por pedido, cada 5 segundos**
   * —55 MB por minuto—. Con una estación no se nota; con doscientas el panel es una manguera.
   *
   * El listado vive en `estaciones()`, paginado, y el detalle de una en `verEstacion()`.
   */
  estado () {
    const todas = Object.values(CONFIG.estaciones)
    const cuenta = { en_linea: 0, demorada: 0, sin_senal: 0, apagada: 0, sin_datos: 0 }
    let paquetesHoy = 0
    const dia = diaLocal()
    for (const est of todas) {
      cuenta[situacion(est)]++
      const e = estadoEstacion(est.id)
      if (e.hoy.dia === dia) paquetesHoy += e.hoy.cuenta
    }

    // Un renglón por destino, no por par destino × estación: acá interesa el servicio, no cada
    // combinación. El detalle por estación está en el listado y en el detalle.
    const destinos = CONFIG.destinos.map(d => {
      const receta = RECETAS[d.receta]
      const ids = estacionesDe(d)
      let problema = 0, esperando = 0, n = 0, ok = 0, ms = 0, ultimoOk = null
      for (const id of ids) {
        const st = estadoDestino(d.nombre, id)
        const v = resumenVentana(st)
        if (st.ultimoDetalle && st.ultimoDetalle !== 'ok') problema++
        const minimo = Number(d.intervalo_min || 0) * 1000
        if (minimo && st.ultimoIntento && (Date.now() - st.ultimoIntento) < minimo) esperando++
        n += v.envios24h
        if (v.tasa24h !== null) ok += v.envios24h * v.tasa24h / 100
        if (v.latencia_media !== null) ms += v.latencia_media * v.envios24h
        if (st.ultimoOk && (!ultimoOk || st.ultimoOk > ultimoOk)) ultimoOk = st.ultimoOk
      }
      return {
        nombre: d.nombre,
        servicio: receta ? receta.nombre : (d.tipo || 'ecowitt'),
        verificado: receta ? receta.verificado : true,
        activo: d.activo !== false,
        comodin: d.estacion === '*',
        estaciones: ids.length,
        problema, esperando,
        envios24h: n,
        tasa24h: n ? Math.round((ok / n) * 1000) / 10 : null,
        latencia_media: n ? Math.round(ms / n) : null,
        ultimo_ok: ultimoOk ? new Date(ultimoOk).toISOString() : null,
      }
    })

    const mem = process.memoryUsage()
    return {
      nodo: {
        nombre: CONFIG.nodo.nombre,
        recibidos: recibidosNodo,
        paquetes_hoy: paquetesHoy,
        estaciones: todas.length,
        activas: todas.length - cuenta.apagada,
        situaciones: cuenta,
        seco: SECO,
        algo_mal: (cuenta.sin_senal || destinos.some(x => x.activo && x.problema)) ? 'ON' : 'OFF',
        // Lo que el pliego de diseño muestra en el panel de Sistema.
        uptime_s: Math.round((Date.now() - ARRANQUE) / 1000),
        memoria_mb: Math.round(mem.rss / 1048576),
        version: VERSION,
      },
      mqtt: { conectado: !!mqtt, motivo: SIN_MQTT ? 'desactivado' : mqttMotivo },
      destinos,
      log: verEventos(40),
    }
  },

  /**
   * Una página del listado. Sólo lo que muestra la tabla — sin los 67 campos y sin historial.
   *
   * SE FILTRA, SE ORDENA Y SE PAGINA ACA, no en el navegador: mandar 200 estaciones para que el
   * navegador muestre 10 es exactamente el problema que este endpoint viene a resolver.
   */
  estaciones ({ pagina = 1, por = 20, buscar = '', filtro = 'todas', orden = 'nombre' } = {}) {
    const dia = diaLocal()
    let filas = Object.values(CONFIG.estaciones).map(est => {
      const e = estadoEstacion(est.id)
      return {
        id: est.id,
        nombre: est.nombre,
        modelo: est.modelo,
        activa: est.activa,
        situacion: situacion(est),
        ultimo: e.ultimo,
        recibidos: e.recibidos,
        paquetes_hoy: e.hoy.dia === dia ? e.hoy.cuenta : 0,
        temp: e.campos.temp_ext ?? null,
        viento: e.campos.viento ?? null,
        viento_dir: e.campos.viento_dir ?? null,
        lluvia_tasa: e.campos.lluvia_tasa ?? null,
        destinos: destinosDe(est.id).length,
      }
    })

    const cuenta = { todas: filas.length }
    for (const f of filas) cuenta[f.situacion] = (cuenta[f.situacion] || 0) + 1

    const q = String(buscar).trim().toLowerCase()
    if (q) {
      filas = filas.filter(f => f.id.includes(q) ||
        (f.nombre || '').toLowerCase().includes(q) ||
        (f.modelo || '').toLowerCase().includes(q))
    }
    if (filtro && filtro !== 'todas') filas = filas.filter(f => f.situacion === filtro)

    const cmp = {
      nombre: (a, b) => (a.nombre || a.id).localeCompare(b.nombre || b.id),
      ultimo: (a, b) => new Date(b.ultimo || 0) - new Date(a.ultimo || 0),
      temp: (a, b) => (b.temp ?? -999) - (a.temp ?? -999),
      paquetes: (a, b) => b.paquetes_hoy - a.paquetes_hoy,
    }
    filas.sort(cmp[orden] || cmp.nombre)

    const total = filas.length
    const porPagina = Math.min(200, Math.max(1, Number(por) || 20))
    const paginas = Math.max(1, Math.ceil(total / porPagina))
    const p = Math.min(paginas, Math.max(1, Number(pagina) || 1))
    return {
      total, pagina: p, por: porPagina, paginas, cuenta,
      estaciones: filas.slice((p - 1) * porPagina, p * porPagina),
    }
  },

  /** El detalle de una: acá sí van los 67 campos, el historial y sus destinos. */
  verEstacion (id) {
    const est = CONFIG.estaciones[id]
    if (!est) return { error: 'no existe la estacion "' + id + '"' }
    const e = estadoEstacion(id)
    return {
      id: est.id,
      nombre: est.nombre,
      modelo: est.modelo,
      activa: est.activa,
      passkey: est.passkey ? '...' + String(est.passkey).slice(-4) : '',
      visto_primera: est.visto_primera,
      visto_ultima: est.visto_ultima,
      situacion: situacion(est),
      recibidos: e.recibidos,
      paquetes_hoy: e.hoy.dia === diaLocal() ? e.hoy.cuenta : 0,
      ultimo: e.ultimo,
      datos: e.campos,
      historial: verLecturas(id).slice(-240),
      destinos: destinosDe(id).map(d => {
        const st = estadoDestino(d.nombre, id)
        const receta = RECETAS[d.receta]
        const minimo = Number(d.intervalo_min || 0) * 1000
        return {
          nombre: d.nombre,
          servicio: receta ? receta.nombre : (d.tipo || 'ecowitt'),
          verificado: receta ? receta.verificado : true,
          comodin: d.estacion === '*',
          activo: d.activo !== false,
          ultimo_intento: st.ultimoIntento ? new Date(st.ultimoIntento).toISOString() : null,
          ultimo_ok: st.ultimoOk ? new Date(st.ultimoOk).toISOString() : null,
          detalle: st.ultimoDetalle || null,
          latencia: st.latencia ?? null,
          enviados: st.enviados || 0,
          fallidos: st.fallidos || 0,
          esperando: !!(minimo && st.ultimoIntento && (Date.now() - st.ultimoIntento) < minimo),
          problema: !!(st.ultimoDetalle && st.ultimoDetalle !== 'ok'),
          ...resumenVentana(st),
        }
      }),
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

  // UN GET TAMBIEN PUEDE SER UN ENVIO. El formato Wunderground —el que mas marcas soportan como
  // servidor personalizado— manda los datos en la URL. Hasta el 01/09/2026 esto contestaba 404
  // y la estacion no avisaba nada.
  //
  // El panel ya se atendio arriba, asi que un GET que llega hasta aca no es del panel.
  if (req.method === 'GET') {
    const visto = reconocer(req, '', new URL(req.url, 'http://x').search.slice(1))
    if (!visto) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('No hay nada aca. El panel esta en /\n')
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('success\n')
    return void ingresar(visto, new URL(req.url, 'http://x').pathname)
  }

  if (req.method !== 'POST') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    return res.end('No hay nada aca. El panel esta en /\n')
  }

  let cuerpo = ''
  req.on('data', c => {
    cuerpo += c
    // Un POST de una estación mide menos de 1 KB. Con este corte, algo que mande basura no
    // llena la memoria del contenedor.
    if (cuerpo.length > 64 * 1024) req.destroy()
  })

  req.on('end', async () => {
    const visto = reconocer(req, cuerpo, '')
    if (!visto) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('Esto no parece un envio de estacion.\n')
    }

    // 2) contestar YA, sin esperar a los destinos. La estacion no tiene por que esperar a que
    //    Home Assistant conteste: si un destino tarda 15 s, el gateway daria el envio por
    //    fallado y algunos dejan de mandar despues de varios fallos.
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('OK')
    ingresar(visto, new URL(req.url, 'http://x').pathname)
  })
})

/**
 * Lo que pasa con un envio ya reconocido, venga por GET o por POST.
 *
 * ESTA APARTE PORQUE LOS DOS CAMINOS HACEN LO MISMO. Cuando estaba duplicado dentro del
 * servidor, el de GET no existia; el dia que se agrego, tener una sola copia evito que se
 * fueran separando.
 */
async function ingresar (visto, ruta) {
  {
    const cuerpo = visto.crudo
    const campos = normalizar(visto.params)
    campos.protocolo = visto.protocolo
    const est = ubicar(campos, ruta)

    // 1) archivar SIEMPRE y PRIMERO, esté la estación encendida o apagada
    const guardado = archivar(est.id, cuerpo)

    recibidosNodo++
    const e = estadoEstacion(est.id)
    e.recibidos++
    const dia = diaLocal()
    if (e.hoy.dia !== dia) { e.hoy.dia = dia; e.hoy.cuenta = 0 }
    e.hoy.cuenta++
    e.ultimo = new Date().toISOString()
    e.campos = campos
    e.crudo = cuerpo
    anotarLectura(est.id, campos)
    anotar('info', est.id + ' #' + e.recibidos + ' [' + visto.protocolo + ']  ' + resumen(campos) +
      (guardado ? '' : '   [SIN ARCHIVAR]') + (est.activa ? '' : '   [apagada: no se reparte]'))

    if (!est.activa) return

    publicarEstacion(est)
    // Si apareció un sensor que antes no estaba, hay que anunciarlo o su entidad no existe.
    if (mqtt && Object.keys(campos).sort().join(',') !== e.anunciado) anunciarTodo('sensor nuevo en ' + est.id)

    await repartir(est, cuerpo, campos)
    publicarNodo()
  }
}

servidor.on('error', e => {
  console.error('No se pudo escuchar en el puerto ' + PUERTO + ': ' + e.code)
  process.exit(1)
})

servidor.listen(PUERTO, () => {
  const n = Object.keys(CONFIG.estaciones).length
  console.log('=== ' + (CONFIG.nodo.nombre || 'Weather Station Bridge') + ', puerto ' + PUERTO)
  console.log('    panel:         http://localhost:' + PUERTO + '/')
  console.log('    archivo crudo: ' + DATOS)
  console.log('    estaciones:    ' + (n
    ? Object.values(CONFIG.estaciones).map(e => (e.nombre || e.id) + (e.activa ? '' : ' [apagada]')).join(', ')
    : 'ninguna todavía — apuntá un gateway y aparece sola'))
  console.log('    destinos:      ' + (CONFIG.destinos.length
    ? CONFIG.destinos.map(d => d.nombre + ' → ' + d.estacion).join(', ')
    : 'ninguno — sólo archiva'))
  const inv = inventario()
  console.log('    recursos:      ' + inv.fuentes + ' tipografias · ' + inv.iconos +
    ' iconos · ' + inv.fondos + ' fondos' +
    ((inv.fuentes && inv.iconos) ? '' : '   [FALTAN: correr bajar-recursos.mjs]'))
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
