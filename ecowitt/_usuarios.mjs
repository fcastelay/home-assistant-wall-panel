// Usuarios, contraseñas y sesiones. Sin una sola dependencia.
//
// EL PRIMER ARRANQUE NO TIENE CONTRASEÑA POR DEFECTO, y esa es la decisión más importante de
// este archivo.
//
// Lo cómodo sería venir con `admin`/`admin` y un cartel que diga "cambiala". Nadie la cambia.
// Un panel publicado en GitHub con una contraseña de fábrica es un panel con la puerta abierta
// en todas las instalaciones del mundo, para siempre, y el que lo instaló cree que la cerró.
//
// Acá, mientras no haya ningún usuario, **el panel no muestra nada**: sólo la pantalla de crear
// el administrador. La primera persona que abra el panel lo crea con la clave que quiera. No
// hay ventana de exposición porque no hay nada que ver hasta que exista un dueño.
//
// DOS ROLES, y alcanzan:
//
//   admin   ve todo y cambia todo: estaciones, destinos, credenciales, usuarios.
//   mirar   ve el estado y los datos. No puede cambiar nada ni crear usuarios.
//
// Un tercer rol intermedio ("puede encender destinos pero no editarlos") sonaría prolijo y no
// resuelve ningún problema real que hoy exista. Cuando aparezca, se agrega.
//
// LAS CONTRASEÑAS NO SE GUARDAN. Se guarda un `scrypt` con sal por usuario, que es lo que
// recomienda Node de fábrica y no necesita instalar nada. Ni el panel ni el registro ni un
// respaldo de la configuración tienen con qué reconstruir la clave.
//
// LA SESION ES UNA COOKIE FIRMADA, no una tabla en memoria. Con una tabla, cada actualización
// del contenedor echaría a todo el mundo — y este contenedor se actualiza seguido. Con una
// firma HMAC sobre una clave guardada en el volumen, la sesión sobrevive al reinicio y no hay
// ninguna lista que crezca sin techo.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const DIAS = 7
const ROLES = new Set(['admin', 'mirar'])

let CLAVE_FIRMA = null

/**
 * La clave con la que se firman las sesiones. Se genera sola la primera vez y vive en el
 * volumen, con permisos de sólo el dueño.
 *
 * SI SE BORRA, todas las sesiones abiertas dejan de valer y hay que volver a entrar. Es
 * exactamente lo que uno quiere si sospecha que alguien se llevó una cookie.
 */
export function iniciar (carpetaDatos) {
  const ruta = path.join(carpetaDatos, 'clave_sesion')
  try {
    CLAVE_FIRMA = fs.readFileSync(ruta)
  } catch {
    CLAVE_FIRMA = crypto.randomBytes(32)
    fs.writeFileSync(ruta, CLAVE_FIRMA, { mode: 0o600 })
  }
  return ruta
}

// ---------------------------------------------------------------- contraseñas

const b64 = (b) => Buffer.from(b).toString('base64url')

/** Deriva la contraseña. Devuelve lo único que se guarda: sal y resultado, nunca el original. */
export function cifrar (clave) {
  const sal = crypto.randomBytes(16)
  // N=16384 es el parámetro que Node trae por defecto: unos 60 ms por intento en una máquina
  // modesta. Suficiente para que probar contraseñas a ciegas no sea gratis, y poco para que
  // entrar al panel no se sienta lento.
  const hash = crypto.scryptSync(String(clave), sal, 64)
  return { sal: sal.toString('hex'), hash: hash.toString('hex') }
}

/** Compara en tiempo constante: una comparación normal filtra la clave por cuánto tarda. */
export function verificar (clave, guardado) {
  if (!guardado || !guardado.sal || !guardado.hash) return false
  try {
    const hash = crypto.scryptSync(String(clave), Buffer.from(guardado.sal, 'hex'), 64)
    return crypto.timingSafeEqual(hash, Buffer.from(guardado.hash, 'hex'))
  } catch { return false }
}

/**
 * Lo mínimo que se le pide a una contraseña.
 *
 * OCHO CARACTERES Y NADA MAS. Sin obligar a mayúsculas, números ni símbolos: esas reglas
 * producen `Passw0rd!` en todas las instalaciones del mundo y no agregan nada. Este panel vive
 * en una red local y su enemigo realista es alguien que prueba `1234`, no un ataque dirigido.
 */
export function revisarClave (clave) {
  const c = String(clave || '')
  if (c.length < 8) return 'La contraseña necesita al menos 8 caracteres.'
  if (/^(1234|admin|clave|password|qwerty)/i.test(c)) return 'Esa contraseña es de las primeras que alguien probaría.'
  return null
}

export function revisarNombre (nombre) {
  const n = String(nombre || '').trim()
  if (!/^[a-zA-Z0-9._-]{2,32}$/.test(n)) {
    return 'El usuario va con letras, números, punto, guion o guion bajo. Entre 2 y 32.'
  }
  return null
}

// ---------------------------------------------------------------- sesiones

const firmar = (texto) => b64(crypto.createHmac('sha256', CLAVE_FIRMA).update(texto).digest())

/** Arma la cookie de sesión: usuario, vencimiento y firma. No lleva la contraseña ni el rol. */
export function abrirSesion (usuario) {
  const vence = Date.now() + DIAS * 86400000
  const cuerpo = b64(usuario) + '.' + vence
  return cuerpo + '.' + firmar(cuerpo)
}

/**
 * Lee la cookie y devuelve el nombre de usuario, o null.
 *
 * EL ROL NO VIAJA EN LA COOKIE. Se lee de la configuración en cada pedido, así que degradar a
 * alguien de admin a mirar tiene efecto inmediato. Si el rol viajara firmado, seguiría siendo
 * admin hasta que venciera su sesión.
 */
export function leerSesion (cookie) {
  if (!cookie || !CLAVE_FIRMA) return null
  const partes = String(cookie).split('.')
  if (partes.length !== 3) return null
  const [u, vence, firma] = partes
  const esperada = firmar(u + '.' + vence)
  // Comparación en tiempo constante, igual que con la contraseña.
  if (firma.length !== esperada.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null
  if (!Number(vence) || Number(vence) < Date.now()) return null
  try { return Buffer.from(u, 'base64url').toString('utf8') } catch { return null }
}

/**
 * La cookie, con las tres marcas que importan.
 *
 * NO LLEVA `Secure`, y no es un descuido: este panel se sirve por HTTP en una red local, y con
 * `Secure` el navegador no la mandaría nunca. Quien lo ponga detrás de un proxy con TLS —que es
 * lo correcto si se expone— debería agregarla ahí.
 */
export const galleta = (valor) =>
  'sesion=' + (valor || '') + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' +
  (valor ? DIAS * 86400 : 0)

export const deCookie = (cabecera, nombre = 'sesion') => {
  for (const parte of String(cabecera || '').split(';')) {
    const [k, ...v] = parte.trim().split('=')
    if (k === nombre) return v.join('=')
  }
  return null
}

// ---------------------------------------------------------------- el padrón

export const hayUsuarios = (config) => Object.keys(config.usuarios || {}).length > 0

/** Qué puede hacer quien pide. Devuelve { usuario, rol } o null. */
export function quienEs (config, cabeceraCookie) {
  const nombre = leerSesion(deCookie(cabeceraCookie))
  if (!nombre) return null
  const u = (config.usuarios || {})[nombre]
  if (!u) return null                 // lo borraron mientras tenía la sesión abierta
  return { usuario: nombre, rol: u.rol === 'admin' ? 'admin' : 'mirar' }
}

/** Alta o cambio de contraseña. Devuelve el mapa de usuarios nuevo, o { error }. */
export function ponerUsuario (config, nombre, clave, rol) {
  const malNombre = revisarNombre(nombre)
  if (malNombre) return { error: malNombre }
  if (!ROLES.has(rol)) return { error: 'El rol va "admin" o "mirar".' }
  const usuarios = { ...(config.usuarios || {}) }
  const existe = usuarios[nombre]
  if (clave || !existe) {
    const malClave = revisarClave(clave)
    if (malClave) return { error: malClave }
    usuarios[nombre] = { ...cifrar(clave), rol, creado: existe ? existe.creado : new Date().toISOString() }
  } else {
    usuarios[nombre] = { ...existe, rol }
  }
  return { usuarios }
}

/**
 * Baja de un usuario.
 *
 * NO SE PUEDE BORRAR AL ULTIMO ADMINISTRADOR. Sin esta guarda, un clic deja el panel sin nadie
 * que pueda configurarlo y la única salida es editar el JSON a mano en el NAS.
 */
export function sacarUsuario (config, nombre) {
  const usuarios = { ...(config.usuarios || {}) }
  if (!usuarios[nombre]) return { error: 'no existe el usuario "' + nombre + '"' }
  delete usuarios[nombre]
  if (!Object.values(usuarios).some(u => u.rol === 'admin')) {
    return { error: 'Es el único administrador. Creá otro antes de borrar este.' }
  }
  return { usuarios }
}

/** La lista para el panel: nombres y roles, nunca las contraseñas. */
export const listar = (config) => Object.entries(config.usuarios || {})
  .map(([nombre, u]) => ({ nombre, rol: u.rol === 'admin' ? 'admin' : 'mirar', creado: u.creado }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre))
