// La configuración: dónde vive, cómo se lee, cómo se escribe sin romperla.
//
// UN SOLO ARCHIVO, `config.json`, Y EN EL VOLUMEN DE DATOS. No al lado del código.
//
// La razón es del contenedor: el código se monta de sólo lectura —el proceso no tiene por qué
// poder reescribir su propio programa— pero la configuración la edita el panel web. Si vivieran
// en la misma carpeta habría que dar permiso de escritura al código entero para poder cambiar
// una credencial.
//
// SE ESCRIBE ATOMICO: a un temporal y después `rename`. Un corte de luz a mitad de una
// escritura directa deja un JSON truncado, y un JSON truncado es un puente **sin ningún
// destino** que sólo se descubre leyendo el log. El `rename` es atómico en el sistema de
// archivos: o está el archivo viejo o está el nuevo, nunca medio archivo.
//
// Y SE RESPALDA ANTES DE CADA CAMBIO, con fecha en el nombre. Un respaldo que se pisa a sí
// mismo deja de servir justo cuando hace falta.
//
// ---------------------------------------------------------------------------------------
// VERSION 2: VARIAS ESTACIONES EN UN MISMO NODO
//
// La versión 1 daba por sentado que había una estación. Eso alcanzaba para una casa y no
// alcanza para nada más: una quinta con la estación del parque y la del invernadero, alguien
// que hospeda el puente para dos vecinos, o simplemente una segunda estación que uno agrega y
// que quiere mandar a otros servicios.
//
// LAS ESTACIONES NO SE DAN DE ALTA A MANO: SE DESCUBREN SOLAS. Cada envío de Ecowitt trae un
// `PASSKEY`, que es un identificador estable del gateway. La primera vez que llega uno
// desconocido, el puente crea la estación, la deja **apagada y sin nombre**, y la muestra en el
// panel para que alguien la bautice.
//
// Eso vuelve la instalación trivial: se levanta el contenedor, se apunta el gateway, y la
// estación aparece. No hay que averiguar ningún identificador ni escribirlo en ningún lado.
//
// UN DESTINO PERTENECE A UNA ESTACION, o a todas. `estacion: "patio"` recibe sólo lo del patio;
// `estacion: "*"` recibe lo de todas, que es lo que hace falta para un archivo central o un
// webhook que guarda todo. Sin el comodín, agregar una estación obligaría a duplicar cada
// destino genérico.

import fs from 'node:fs'
import path from 'node:path'

export const VERSION = 2

/** Estructura vacía. Es también la documentación del formato. */
export const VACIA = {
  version: VERSION,

  // Ajustes del nodo entero. Lo que no se toca desde el panel llega por variables de entorno.
  nodo: {
    nombre: 'Weather Station Bridge',
    // Prefijo de los temas MQTT de cada estación. El id de la estación se agrega solo:
    // `estacion/patio/datos`. Se puede cambiar si ya hay otro puente publicando en la misma
    // raíz, que es el caso de quien corre dos nodos contra un mismo Home Assistant.
    raiz: 'estacion',
  },

  mqtt: {
    // Vacío = usar las variables de entorno (MQTT_HOST, MQTT_USUARIO, MQTT_CLAVE...).
    // Lo que se cargue acá desde el panel tiene prioridad sobre el entorno.
    host: '', puerto: 1883, usuario: '', clave: '', prefijo: 'homeassistant',
  },

  // Mapa por id. El id es un slug estable que se usa en las rutas de archivo y en los temas
  // MQTT, así que **no cambia nunca** una vez creado: cambiarlo dejaría entidades huérfanas en
  // Home Assistant y partiría el archivo histórico en dos. El nombre visible sí se puede
  // cambiar cuando uno quiera.
  estaciones: {},

  destinos: [],

  // Quién puede entrar al panel. Vacío = todavía no se instaló nadie, y entonces el panel sólo
  // muestra la pantalla de crear el administrador. Ver _usuarios.mjs: no hay contraseña de
  // fábrica a propósito.
  usuarios: {},

  ajustes: {
    // Cuántas lecturas por estación se guardan en memoria para el gráfico del panel.
    historial: 240,
  },
}

/** Una estación recién descubierta. Nace apagada: nadie mandó nada a ningún lado todavía. */
export const estacionNueva = (id, passkey, campos = {}) => ({
  id,
  passkey: passkey || '',
  nombre: '',                       // vacío = "sin nombre", el panel invita a bautizarla
  modelo: campos.estacion || campos.modelo || '',
  activa: false,
  visto_primera: new Date().toISOString(),
  visto_ultima: new Date().toISOString(),
})

let RUTA = null
let CACHE = null
let HEREDADOS = []
let SEMILLA = {}

/**
 * @param carpetaDatos  el volumen persistente; ahi vive `config.json`
 * @param heredar       rutas de `destinos.json` de la version anterior, para migrar
 * @param semilla       valores del entorno, que se usan SOLO al crear la configuracion
 *
 * LA SEMILLA SOLO SIEMBRA UNA VEZ, y esa es la regla que hace que el `.env` sirva sin volverse
 * una trampa.
 *
 * Si el entorno pisara la configuracion en cada arranque, cambiar algo desde el panel duraria
 * hasta el proximo reinicio del contenedor y despues volveria solo, sin que nadie entienda por
 * que. Y si el entorno no se usara nunca, las variables del instalador serian decoracion: el
 * 01/09/2026 se midio que RAIZ_MQTT, PREFIJO_HA y NOMBRE_NODO estaban declaradas en el
 * .env.ejemplo, en el compose, y **no hacian absolutamente nada**, porque los valores por
 * defecto se rellenaban antes de mirarlas.
 *
 * La regla queda: **el .env decide como nace la instalacion; el panel decide como sigue.**
 * La excepcion son las credenciales del broker, que se resuelven en vivo — ver receptora.mjs:
 * asi se puede rotar la clave del MQTT sin entrar al panel.
 */
export function iniciar (carpetaDatos, heredar = [], semilla = {}) {
  RUTA = path.join(carpetaDatos, 'config.json')
  HEREDADOS = heredar
  SEMILLA = semilla || {}
  fs.mkdirSync(carpetaDatos, { recursive: true })
  return RUTA
}

/**
 * Lee la configuración de disco. Si no existe, la crea; si existía la de una versión anterior,
 * la migra.
 *
 * LA MIGRACION NO ES CORTESIA: sin ella, la primera vez que arranque esta versión el puente se
 * quedaría sin los destinos que ya estaban andando, y lo haría en silencio.
 */
export function cargar () {
  if (CACHE) return CACHE
  if (fs.existsSync(RUTA)) {
    try {
      CACHE = completar(JSON.parse(fs.readFileSync(RUTA, 'utf8')))
      return CACHE
    } catch (e) {
      // NO se pisa un archivo ilegible: podría ser el único lugar donde están las credenciales,
      // y sobrescribirlo con la plantilla vacía las borraría para siempre. Se lo aparta con
      // otro nombre y se sigue con la vacía, dejándolo dicho.
      const roto = RUTA + '.roto-' + Date.now()
      try { fs.renameSync(RUTA, roto) } catch {}
      console.error('config.json ilegible (' + e.message + '). Apartado en ' + path.basename(roto))
    }
  }
  // Recien creada: se siembra con lo que dijo el entorno. De aca en mas manda el panel.
  const base = migrarViejo()
  CACHE = completar({
    ...base,
    nodo: { ...(base.nodo || {}), ...(SEMILLA.nodo || {}) },
    mqtt: { ...(base.mqtt || {}), ...(SEMILLA.mqtt || {}) },
  })
  try {
    escribir(CACHE)
  } catch (e) {
    // NO SE DEJA SALIR EL ERROR CRUDO. El 01/09/2026 esto fue un EACCES sin atrapar: el
    // contenedor moría en 0,6 segundos, en bucle, y como además el registro estaba anulado en
    // el compose, la pestaña Registro del Container Manager aparecía vacía. Dos horas de
    // adivinar algo que el propio programa sabía.
    console.error('')
    console.error('=== NO SE PUEDE ESCRIBIR EN EL VOLUMEN DE DATOS')
    console.error('    ' + RUTA)
    console.error('    ' + e.code + ': ' + e.message)
    console.error('')
    console.error('    Este proceso corre como uid ' + (process.getuid ? process.getuid() : '?') +
      ' y la carpeta no le pertenece.')
    console.error('    En Docker lo resuelve entrada.sh, que acomoda el dueño antes de arrancar.')
    console.error('    Si estás viendo esto DENTRO del contenedor, el volumen es de sólo lectura.')
    console.error('')
    process.exit(1)
  }
  return CACHE
}

/** Trae lo que haya de versiones anteriores: el `destinos.json` suelto o un config.json v1. */
function migrarViejo () {
  for (const p of [...HEREDADOS, path.join(path.dirname(RUTA), 'destinos.json')]) {
    try {
      if (!fs.existsSync(p)) continue
      const l = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (Array.isArray(l) && l.length) {
        console.log('config.json creado desde ' + p + ' (' + l.length + ' destinos)')
        return { ...VACIA, destinos: l }
      }
    } catch {}
  }
  return { ...VACIA }
}

/**
 * Rellena lo que falte y sube de versión, para que una configuración vieja no rompa una nueva.
 *
 * DE LA v1 A LA v2: los destinos de la v1 no tenían estación porque había una sola. Se les pone
 * el comodín `*`, no la primera estación que aparezca. Es la única opción que **conserva el
 * comportamiento exacto** que tenían: recibían todo lo que llegara, sin importar de dónde.
 * Asignarlos a una estación concreta los dejaría mudos si el gateway cambiara de PASSKEY.
 */
function completar (c) {
  const salida = {
    ...VACIA, ...c,
    version: VERSION,
    nodo: { ...VACIA.nodo, ...(c.nodo || {}) },
    mqtt: { ...VACIA.mqtt, ...(c.mqtt || {}) },
    ajustes: { ...VACIA.ajustes, ...(c.ajustes || {}) },
    estaciones: { ...(c.estaciones || {}) },
    destinos: Array.isArray(c.destinos) ? c.destinos : [],
    usuarios: { ...(c.usuarios || {}) },
  }

  // v1 llamaba `ajustes.base` a la raíz de los temas y `ajustes.estacion` al nombre del
  // aparato. Se traen para no perder una configuración que ya andaba.
  if (c.ajustes && c.ajustes.base && !(c.nodo && c.nodo.raiz)) salida.nodo.raiz = c.ajustes.base
  delete salida.ajustes.base
  delete salida.ajustes.estacion

  salida.destinos = salida.destinos.map(d => ({ ...d, estacion: d.estacion || '*' }))

  // Cada estación se completa con lo que falte, por si viene de una versión intermedia.
  for (const [id, e] of Object.entries(salida.estaciones)) {
    salida.estaciones[id] = { ...estacionNueva(id, e.passkey), ...e, id }
  }
  return salida
}

function escribir (c) {
  const tmp = RUTA + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(c, null, 2) + '\n')
  fs.renameSync(tmp, RUTA)
}

/** Guarda, con respaldo fechado del anterior. Devuelve la configuración ya normalizada. */
export function guardar (nueva) {
  const c = completar(nueva)
  if (fs.existsSync(RUTA)) {
    const dir = path.join(path.dirname(RUTA), 'respaldos')
    fs.mkdirSync(dir, { recursive: true })
    const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    fs.copyFileSync(RUTA, path.join(dir, 'config_' + sello + '.json'))
    // Se conservan los 30 últimos: suficiente para volver atrás, poco para llenar el disco.
    const viejos = fs.readdirSync(dir).filter(f => f.startsWith('config_')).sort()
    for (const f of viejos.slice(0, -30)) { try { fs.unlinkSync(path.join(dir, f)) } catch {} }
  }
  escribir(c)
  CACHE = c
  return c
}

/** Vuelve a leer de disco en la próxima llamada. Para cuando alguien edita el JSON a mano. */
export function olvidar () { CACHE = null }

// ---------------------------------------------------------------- identidad de estación

/**
 * Convierte un texto cualquiera en un id usable en rutas de archivo y temas MQTT.
 *
 * Se usa para el id de la estación, así que **tiene que ser estable**: el mismo nombre da
 * siempre el mismo id, y no puede producir cadenas vacías ni con barras.
 */
export const aId = (texto) => String(texto || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)

/**
 * Con qué se reconoce a una estación, en orden de preferencia.
 *
 * 1. `PASSKEY`, que es lo que manda el protocolo Ecowitt: un identificador estable del gateway.
 * 2. `ID`, que es lo que manda el protocolo Wunderground, donde no hay PASSKEY.
 * 3. La ruta del POST. Sirve para gateways raros y para separar a mano dos estaciones que por
 *    lo que sea comparten identificador: se les da una ruta distinta a cada una.
 *
 * Devuelve null si no hay con qué: ese envío se archiva igual, bajo `sin_identificar`.
 */
export function identificar (campos, ruta) {
  if (campos.passkey) return { clave: 'passkey', valor: String(campos.passkey) }
  if (campos.wu_id) return { clave: 'id', valor: String(campos.wu_id) }
  const r = String(ruta || '').replace(/^\/+|\/+$/g, '')
  if (r && r !== 'data/report') return { clave: 'ruta', valor: r }
  return null
}

/** Busca la estación que corresponde a una identidad. Devuelve su id o null. */
export function estacionDe (config, identidad) {
  if (!identidad) return null
  for (const [id, e] of Object.entries(config.estaciones)) {
    if (identidad.clave === 'passkey' && e.passkey && e.passkey === identidad.valor) return id
    if (identidad.clave !== 'passkey' && id === aId(identidad.valor)) return id
  }
  return null
}

/**
 * Un id libre a partir de una identidad. Si el modelo del gateway está a mano se usa eso;
 * si no, un número. Nunca se usa el PASSKEY como id: es largo, feo, y no dice nada.
 */
export function idLibre (config, campos) {
  const base = aId(campos.modelo || campos.estacion) || 'estacion'
  if (!config.estaciones[base]) return base
  for (let i = 2; i < 100; i++) if (!config.estaciones[base + '_' + i]) return base + '_' + i
  return base + '_' + Date.now().toString(36)
}

// ---------------------------------------------------------------- secretos
//
// EL PANEL NUNCA DEVUELVE UNA CREDENCIAL. Manda los puntitos en su lugar y muestra un campo
// vacío con la marca de que ya hay una cargada. Al guardar, un campo vacío significa "dejá la
// que estaba", no "borrala".
//
// Sin esto, cualquiera que abra el panel —o cualquier captura de pantalla, o el registro de un
// navegador— se lleva la clave de Wunderground y el webhook de Home Assistant.

export const SECRETO = /^(clave|password|pass|api_key|apikey|token|key|salt|webhook|secreto)$/i

/** Una copia sin credenciales, para mandar al navegador. */
export function sinSecretos (c) {
  const limpiar = (o) => {
    const s = {}
    for (const [k, v] of Object.entries(o || {})) s[k] = SECRETO.test(k) ? (v ? '••••••' : '') : v
    return s
  }
  const { usuarios, ...resto } = c
  return {
    ...resto,
    // LOS USUARIOS NO SALEN DE ACA, ni siquiera con la contraseña cifrada. Un scrypt en pantalla
    // es un scrypt que alguien puede llevarse y atacar sin apuro. La lista de nombres y roles
    // va por su propio endpoint, y sólo para el administrador.
    mqtt: limpiar(c.mqtt),
    // El PASSKEY identifica al gateway y viaja en claro en cada envío, pero no tiene por qué
    // andar dando vueltas en la pantalla: se muestran los últimos cuatro, que alcanzan para
    // reconocer cuál es cuál cuando hay dos estaciones parecidas.
    estaciones: Object.fromEntries(Object.entries(c.estaciones || {}).map(([id, e]) =>
      [id, { ...e, passkey: e.passkey ? '…' + String(e.passkey).slice(-4) : '' }])),
    destinos: c.destinos.map(d => ({
      ...d,
      url: ocultarEnUrl(d.url),
      credenciales: limpiar(d.credenciales),
    })),
  }
}

/** Tapa lo que parezca credencial dentro de una URL suelta. */
export function ocultarEnUrl (url) {
  if (!url) return url
  return String(url)
    .replace(/([?&](?:key|password|pass|token|apikey|api_key|id|pw|salt)=)[^&]*/gi, '$1••••••')
    .replace(/(\/api\/webhook\/)[^/?#]+/g, '$1••••••')
    .replace(/(\/pws\/update\/)[^/?#]+/g, '$1••••••')
    // Weathercloud pone la credencial en la RUTA, no en los parámetros: /key/LACLAVE/temp/165
    .replace(/(\/key\/)[^/?#]+/g, '$1••••••')
}

/**
 * Mezcla lo que llegó del panel con lo que ya había: un secreto que viene vacío o con los
 * puntitos conserva su valor anterior.
 */
export function fundirSecretos (nuevo, anterior) {
  const r = { ...nuevo }
  for (const [k, v] of Object.entries(nuevo || {})) {
    if (!SECRETO.test(k)) continue
    if (v === '' || v === null || v === undefined || /^[•*…]+$/.test(String(v))) {
      if (anterior && anterior[k] !== undefined) r[k] = anterior[k]
      else delete r[k]
    }
  }
  return r
}
