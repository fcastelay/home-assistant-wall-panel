// Instalador: hace las preguntas y escribe el `.env`. Sin dependencias.
//
//   node instalar.mjs              pregunta todo, con valores sugeridos
//   node instalar.mjs --rehacer    vuelve a preguntar aunque ya haya un .env
//   node instalar.mjs --ver        muestra lo que escribiría, sin escribir
//
// Y SIN PREGUNTAR, para quien lo automatiza:
//
//   node instalar.mjs --sin-preguntar --puerto 9090 --datos /srv/ecowitt
//   node instalar.mjs --sin-preguntar --admin juan --clave miclave123
//   node instalar.mjs --sin-preguntar --mqtt-host TU_IP_LAN --mqtt-usuario ha --mqtt-clave xxxx
//
// Cualquier opción que no se pase toma su valor por defecto. Sirve para instalarlo desde un
// script, desde Ansible o desde un contenedor de arranque, que es el caso de quien pone esto
// en más de un lugar.
//
// POR QUE EXISTE
//
// El `.env.ejemplo` tenía todo lo configurable desde el principio, y aun así la instalación se
// sentía cerrada: había que saber que existía ese archivo, copiarlo, abrirlo con un editor y
// entender veinte variables comentadas para cambiar un puerto.
//
// **Tener algo configurable y que se pueda configurar son dos cosas distintas.** Un archivo de
// ejemplo es documentación; esto es una instalación.
//
// LAS PREGUNTAS SON POCAS Y TODAS TIENEN UNA SUGERENCIA. Se puede apretar Enter en todas y
// queda una instalación que funciona. Lo que no se pregunta es lo que casi nadie cambia: eso
// sigue en el `.env.ejemplo` para el que lo necesite.
//
// NO PISA UN .env QUE YA EXISTA sin que se lo pidan. El 01/09/2026 un `.env` a medias —dos
// líneas escritas a mano— dejó al puente sin broker durante horas, y desde afuera parecía que
// MQTT estaba roto. Un instalador que sobrescribe en silencio repite ese día.

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const DESTINO = path.join(AQUI, '.env')
const VER = process.argv.includes('--ver')
const REHACER = process.argv.includes('--rehacer')

// Las opciones de la línea de comandos. Si hay alguna, gana sobre la pregunta.
const opcion = (n) => {
  const i = process.argv.indexOf('--' + n)
  return i !== -1 ? (process.argv[i + 1] || '') : null
}
const CALLADO = process.argv.includes('--sin-preguntar')

const rl = CALLADO ? null : readline.createInterface({ input: process.stdin, output: process.stdout })
const preguntar = (t) => new Promise(r => rl.question(t, x => r(x)))

/**
 * Una pregunta con sugerencia. Enter deja la sugerencia.
 *
 * `revisar` puede devolver un texto de error y la pregunta se repite. Validar acá y no al
 * arrancar el contenedor es la diferencia entre enterarse ahora y enterarse cuando algo no
 * levanta y hay que ir a leer un registro.
 */
const campo = async (texto, sugerido, revisar, bandera) => {
  // Lo que vino por la linea de comandos no se pregunta. Y en modo callado no se pregunta nada:
  // se toma la opcion si esta, y si no el valor sugerido.
  const dado = bandera ? opcion(bandera) : null
  if (dado !== null || CALLADO) {
    const v = dado !== null ? dado : (sugerido || '')
    const mal = revisar ? revisar(v) : null
    if (mal) { console.error('  --' + bandera + ': ' + mal); process.exit(1) }
    return v
  }
  for (;;) {
    const r = (await preguntar('  ' + texto + (sugerido ? ' [' + sugerido + ']' : '') + ': ')).trim()
    const v = r || sugerido || ''
    const mal = revisar ? revisar(v) : null
    if (!mal) return v
    console.log('    ' + mal)
  }
}

const siNo = async (texto, porDefecto = true, bandera) => {
  if (CALLADO || (bandera && opcion(bandera) !== null)) {
    return bandera ? opcion(bandera) !== null : porDefecto
  }
  const r = (await preguntar('  ' + texto + (porDefecto ? ' [S/n]: ' : ' [s/N]: '))).trim().toLowerCase()
  if (!r) return porDefecto
  return r[0] === 's' || r[0] === 'y'
}

const puertoValido = (v) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1 || n > 65535) return 'Un puerto va de 1 a 65535.'
  if (n < 1024) return 'Por debajo de 1024 hace falta ser root. Elegí uno más alto.'
  return null
}

const main = async () => {
  console.log('')
  console.log('=== Weather Station Bridge · instalación')
  console.log('')

  if (fs.existsSync(DESTINO) && !REHACER && !VER) {
    console.log('  Ya hay un .env en esta carpeta.')
    console.log('  Para volver a empezar:  node instalar.mjs --rehacer')
    console.log('  Para ver qué tiene:     cat .env')
    if (rl) rl.close()
    return
  }

  console.log('  Enter en todas deja una instalación que funciona. Lo que preguntamos es sólo')
  console.log('  lo que cambia de una casa a otra; el resto está en .env.ejemplo.')
  console.log('')

  // ---------------------------------------------------------------- lo básico
  console.log('--- Dónde va a vivir')
  const puerto = await campo('Puerto por el que vas a abrir el panel', '8088', puertoValido, 'puerto')
  const datos = await campo('Carpeta donde guardar los datos', './datos', null, 'datos')
  const tz = await campo('Zona horaria (para la hora del registro)',
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', null, 'tz')

  // ---------------------------------------------------------------- el dueño
  console.log('')
  console.log('--- Quién entra al panel')
  console.log('  Si lo dejás vacío, el panel te lo va a pedir la primera vez que lo abras.')
  const usuario = await campo('Usuario administrador', '', null, 'admin')
  let clave = ''
  if (usuario) {
    clave = await campo('Contraseña (mínimo 8)', '', (v) =>
      v.length < 8 ? 'Necesita al menos 8 caracteres.' : null, 'clave')
  }

  // ---------------------------------------------------------------- Home Assistant
  console.log('')
  console.log('--- Home Assistant (opcional)')
  console.log('  Sin esto el puente funciona igual: recibe, archiva y reparte a los servicios.')
  console.log('  Lo único que falta es que los sensores aparezcan solos en Home Assistant.')
  const conHa = await siNo('¿Publicar a Home Assistant por MQTT?', false, 'mqtt-host')
  let mqtt = { host: '', puerto: '1883', usuario: '', clave: '' }
  if (conHa) {
    mqtt.host = await campo('Host del broker MQTT', '', (v) => v ? null : 'Hace falta el host.', 'mqtt-host')
    mqtt.puerto = await campo('Puerto del broker', '1883', puertoValido, 'mqtt-puerto')
    mqtt.usuario = await campo('Usuario del broker', '', (v) => v ? null : 'Hace falta el usuario.', 'mqtt-usuario')
    mqtt.clave = await campo('Contraseña del broker', '', (v) => v ? null : 'Hace falta la contraseña.', 'mqtt-clave')
  }

  // ---------------------------------------------------------------- el volumen
  console.log('')
  console.log('--- Permisos de la carpeta de datos')
  console.log('  Por defecto el contenedor arranca como root, acomoda el dueño de esa carpeta y')
  console.log('  después baja a un usuario sin privilegios. Eso funciona casi siempre.')
  console.log('  Si tu sistema no deja hacer ese chown —pasa en algunos NAS y en montajes de')
  console.log('  red— hay que decirle con qué uid correr.')
  const uidPropio = await siNo('¿Fijar vos el usuario del contenedor?', false, 'uid')
  let uid = '0', gid = '0'
  if (uidPropio) {
    uid = await campo('uid dueño de la carpeta (en Linux/macOS: id -u)', '1000', null, 'uid')
    gid = await campo('gid (id -g)', '1000', null, 'gid')
  }

  // ---------------------------------------------------------------- se escribe
  const lineas = [
    '# Generado por instalar.mjs. NO se versiona: acá adentro hay contraseñas.',
    '# Todas las variables, explicadas una por una, están en .env.ejemplo.',
    '',
    '# Por dónde abrís el panel y a dónde apuntás los gateways.',
    'PUERTO=' + puerto,
    'RUTA_DATOS=' + datos,
    'TZ=' + tz,
    '',
    '# El administrador. Sólo se aplican si todavía no hay ningún usuario.',
    'ADMIN_USUARIO=' + usuario,
    'ADMIN_CLAVE=' + clave,
    '',
    '# Home Assistant. Vacío = el puente funciona igual, sin publicar.',
    'MQTT_HOST=' + mqtt.host,
    'MQTT_PUERTO=' + mqtt.puerto,
    'MQTT_USUARIO=' + mqtt.usuario,
    'MQTT_CLAVE=' + mqtt.clave,
    '',
    '# Quién corre el proceso. 0 = arranca root y baja solo.',
    'UID_DATOS=' + uid,
    'GID_DATOS=' + gid,
    '',
  ]

  console.log('')
  console.log('=== quedaría así:')
  console.log('')
  // NUNCA SE IMPRIME UNA CONTRASEÑA, ni la que la persona acaba de tipear. Queda en el registro
  // de la terminal, en el historial, y en cualquier captura de pantalla de la instalación.
  for (const l of lineas) {
    console.log('    ' + l.replace(/^((?:ADMIN|MQTT)_CLAVE=)(.+)$/, '$1<<oculta>>'))
  }

  if (VER) {
    console.log('  (modo --ver: no se escribió nada)')
    if (rl) rl.close()
    return
  }

  fs.writeFileSync(DESTINO, lineas.join('\n'))
  console.log('')
  console.log('=== escrito en ' + DESTINO)
  console.log('')
  console.log('  Ahora:')
  console.log('     docker compose up -d')
  console.log('')
  console.log('  Y el panel queda en:  http://localhost:' + puerto + '/')
  console.log('')
  console.log('  En el gateway -> Weather Services -> Customized:')
  console.log('     Protocol: Ecowitt   Port: ' + puerto + '   Path: /data/report')
  console.log('')
  console.log('  La estación aparece sola en el panel con el primer envío. Ponele nombre y')
  console.log('  encendela: hasta entonces se archiva pero no se reparte.')
  if (rl) rl.close()
}

main()
