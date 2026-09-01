// Prueba de punta a punta del puente, contra servicios falsos.
//
//   node probar.mjs
//
// QUE COMPRUEBA, y por qué cada cosa
//
//   Acceso      que sin usuarios no se vea nada, que el que mira no pueda cambiar, y que
//               usuario inexistente y clave equivocada den el MISMO mensaje.
//   Estaciones  que dos gateways distintos aparezcan solos, apagados, y en carpetas separadas.
//   Reparto     que una estación apagada archive y no reparta; que un destino de una estación
//               no reciba lo de la otra; que un comodín reciba de las dos.
//   Errores     que un 4xx no se reintente y un 5xx sí; que el intervalo mínimo se respete, y
//               que se respete POR ESTACION.
//   Secretos    que el panel no devuelva nunca una credencial, y que guardar con el campo en
//               blanco no borre la que había.
//
// NUNCA TOCA EL BROKER DE LA CASA: el puente arranca con --sin-mqtt y sus datos van a una
// carpeta temporal. Es una regla que salió de un error propio: el 31/08/2026 una prueba con
// destinos inventados se conectó al MQTT real y creó 15 entidades falsas en Home Assistant.
// Una prueba no puede escribir en la casa.
//
// TAMPOCO SALE A INTERNET. Todos los destinos apuntan a un servidor falso en localhost. El
// 01/09/2026 una prueba anterior mandó de verdad a Windy y se comió un 401 real: no hizo daño,
// pero una prueba que depende de la red falla los días que la red anda mal.

import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'ecowitt-prueba-'))
const PUERTO = 18088
const FALSO = 18089

let fallas = 0
const revisar = (bien, texto, detalle) => {
  console.log('  ' + (bien ? 'ok  ' : 'MAL ') + texto + (detalle ? '   ' + detalle : ''))
  if (!bien) fallas++
}
const titulo = (t) => console.log('\n--- ' + t)
const dormir = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * Espera a que un puerto conteste. Devuelve false si nunca contesta.
 *
 * SE ESPERA A QUE CONTESTE, no un tiempo fijo: un tiempo fijo falla el dia que la maquina esta
 * ocupada, y entonces uno depura una prueba en vez del programa.
 *
 * Y SI NO ARRANCA, SE DICE. La primera version seguia igual y reventaba veinte lineas mas
 * abajo con un ENOENT sobre un config.json que nunca se escribio. El motivo real —el puerto
 * ocupado por otro proceso— estaba en la salida del hijo, que nadie miraba.
 */
const esperarPuerto = async (puerto, salida) => {
  for (let i = 0; i < 60; i++) {
    try { await fetch('http://127.0.0.1:' + puerto + '/salud'); return true } catch { await dormir(100) }
  }
  console.log('  MAL el puente no arranco en el puerto ' + puerto)
  for (const l of (salida || []).join('').split(/\r?\n/).slice(0, 6)) console.log('      ' + l)
  fallas++
  return false
}

// ---------------------------------------------------------------- servicios falsos
const golpes = []
const falso = http.createServer((req, res) => {
  golpes.push({ ruta: req.url.split('?')[0], cuerpo: '', t: Date.now() })
  let b = ''
  req.on('data', c => { b += c })
  req.on('end', () => {
    golpes[golpes.length - 1].cuerpo = b
    if (req.url.startsWith('/roto')) { res.writeHead(404); return res.end('no existe') }
    if (req.url.startsWith('/caido')) { res.writeHead(500); return res.end('reventado') }
    res.writeHead(200); res.end('OK')
  })
})
const cuenta = (ruta) => golpes.filter(g => g.ruta === ruta).length

// ---------------------------------------------------------------- los dos gateways
//
// Dos PASSKEY distintos: es así como el puente los distingue. Los valores imperiales son los
// que manda una estación de verdad; el puente los convierte.
const envio = (passkey, modelo, tempf) =>
  'PASSKEY=' + passkey + '&stationtype=' + modelo + '&model=' + modelo +
  '&dateutc=2026-09-01+18:10:00&interval=60' +
  '&tempinf=72.5&humidityin=48&baromrelin=29.92&tempf=' + tempf +
  '&humidity=64&winddir=180&windspeedmph=5.6&windgustmph=9.2&dailyrainin=0.12' +
  '&solarradiation=210.5&uv=2&soilmoisture1=42'

// ---------------------------------------------------------------- cliente con cookie
let COOKIE = ''
const api = async (ruta, opciones = {}) => {
  const r = await fetch('http://127.0.0.1:' + PUERTO + ruta, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(COOKIE ? { Cookie: COOKIE } : {}), ...(opciones.headers || {}) },
  })
  const set = r.headers.get('set-cookie')
  if (set) COOKIE = set.split(';')[0]
  const t = await r.text()
  try { return { codigo: r.status, cuerpo: JSON.parse(t) } } catch { return { codigo: r.status, cuerpo: t } }
}
const post = (ruta, cuerpo) => api(ruta, { method: 'POST', body: JSON.stringify(cuerpo) })
const mandar = (cuerpo, ruta = '/data/report') => fetch('http://127.0.0.1:' + PUERTO + ruta, {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: cuerpo,
})

// ---------------------------------------------------------------- la corrida

const main = async () => {
  console.log('=== prueba del puente Ecowitt')
  console.log('    carpeta temporal: ' + CARPETA + '\n')

  await new Promise(ok => falso.listen(FALSO, ok))
  const hijo = spawn(process.execPath, [path.join(AQUI, 'receptora.mjs'), '--puerto', String(PUERTO), '--sin-mqtt'], {
    env: { ...process.env, ARCHIVO: CARPETA, PANEL_ABIERTO: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const salida = []
  hijo.stdout.on('data', d => salida.push(String(d)))
  hijo.stderr.on('data', d => salida.push(String(d)))

  if (!await esperarPuerto(PUERTO, salida)) {
    hijo.kill('SIGTERM'); falso.close(); process.exit(1)
  }

  try {
    // ============================================================ acceso
    titulo('acceso')
    const sinSesion = await api('/api/estado')
    revisar(sinSesion.codigo === 401, 'sin usuarios, el estado NO se ve', 'HTTP ' + sinSesion.codigo)
    const sesion0 = await api('/api/sesion')
    revisar(sesion0.cuerpo.instalado === false, 'la página sabe que falta instalar')

    revisar((await post('/api/instalar', { usuario: 'jefe', clave: '123' })).cuerpo.error,
      'una contraseña corta se rechaza')
    revisar((await post('/api/instalar', { usuario: 'jefe', clave: 'password1' })).cuerpo.error,
      'una contraseña obvia se rechaza')
    revisar((await post('/api/instalar', { usuario: 'jefe', clave: 'tormenta2026' })).cuerpo.ok === true,
      'se crea el administrador en el primer arranque')
    revisar((await api('/api/sesion')).cuerpo.rol === 'admin', 'y queda con la sesión abierta')

    const otra = await post('/api/instalar', { usuario: 'colado', clave: 'tormenta2026' })
    revisar(otra.codigo === 409, 'la instalación no se puede repetir', 'HTTP ' + otra.codigo)

    const guardo = COOKIE
    COOKIE = ''
    const malUsuario = await post('/api/entrar', { usuario: 'nadie', clave: 'x' })
    const malClave = await post('/api/entrar', { usuario: 'jefe', clave: 'equivocada' })
    revisar(malUsuario.cuerpo.error === malClave.cuerpo.error,
      'usuario inexistente y clave mala dan el MISMO mensaje', malClave.cuerpo.error)

    revisar((await post('/api/entrar', { usuario: 'jefe', clave: 'tormenta2026' })).cuerpo.ok === true,
      'se entra con la clave correcta')
    revisar((await api('/api/estado')).codigo === 200, 'y ahora sí se ve el estado')

    // --- un usuario que sólo mira
    revisar((await post('/api/usuarios', { usuario: 'vecina', clave: 'llovizna2026', rol: 'mirar' })).cuerpo.ok === true,
      'el administrador crea un usuario de sólo lectura')
    const cookieJefe = COOKIE
    COOKIE = ''
    await post('/api/entrar', { usuario: 'vecina', clave: 'llovizna2026' })
    revisar((await api('/api/estado')).codigo === 200, 'el que mira puede ver el estado')
    const intento = await post('/api/destino', { destino: { nombre: 'X', tipo: 'receta', receta: 'webhook' } })
    revisar(intento.codigo === 403, 'el que mira NO puede crear un destino', 'HTTP ' + intento.codigo)
    const vistaMirar = await api('/api/config')
    revisar(vistaMirar.cuerpo.usuarios === undefined, 'el que mira no ve la lista de usuarios')
    COOKIE = cookieJefe

    // ============================================================ estaciones
    titulo('las estaciones aparecen solas')
    await mandar(envio('AAA111', 'GW3000A', '61.7'))
    await mandar(envio('BBB222', 'GW2000A', '50.0'))
    await dormir(600)

    let est = (await api('/api/estado')).cuerpo.estaciones
    revisar(est.length === 2, 'se descubrieron 2 estaciones', est.map(e => e.id).join(', '))
    revisar(est.every(e => !e.activa), 'las dos nacen APAGADAS')
    revisar(est.every(e => e.nombre === ''), 'y sin nombre, esperando que alguien las bautice')
    revisar(est.every(e => /^…/.test(e.passkey)), 'el PASSKEY sólo se muestra por sus últimos dígitos')

    const dia = (() => { const h = new Date(); return h.getFullYear() + String(h.getMonth() + 1).padStart(2, '0') + String(h.getDate()).padStart(2, '0') + '.txt' })()
    const a = est[0].id, b = est[1].id
    revisar(fs.existsSync(path.join(CARPETA, a, dia)) && fs.existsSync(path.join(CARPETA, b, dia)),
      'cada una archiva en su propia carpeta', a + '/ y ' + b + '/')
    const crudoA = fs.readFileSync(path.join(CARPETA, a, dia), 'utf8')
    revisar(crudoA.includes('AAA111') && !crudoA.includes('BBB222'),
      'y no se mezclan: en la carpeta de una no hay envíos de la otra')

    revisar((await post('/api/estacion', { id: a, nombre: 'Patio', activa: true })).cuerpo.ok === true,
      'se la bautiza y se la enciende')
    est = (await api('/api/estado')).cuerpo.estaciones
    revisar(est.find(e => e.id === a).nombre === 'Patio', 'queda con su nombre')

    // ============================================================ reparto
    titulo('el reparto')
    const alta = (nombre, url, extra = {}) => post('/api/destino', {
      destino: {
        nombre, tipo: 'receta', receta: 'webhook', estacion: a,
        credenciales: { url: 'http://127.0.0.1:' + FALSO + url },
        activo: true, reintentos: 1, ...extra,
      },
    })
    revisar((await alta('Del patio', '/patio')).cuerpo.ok === true, 'destino atado a una estación')
    revisar((await alta('Roto', '/roto')).cuerpo.ok === true, 'destino que da 404')
    revisar((await alta('Caido', '/caido')).cuerpo.ok === true, 'destino que da 500')
    revisar((await alta('Central', '/central', { estacion: '*' })).cuerpo.ok === true,
      'destino comodín, para todas las estaciones')
    revisar((await alta('Lento', '/lento', { estacion: '*', intervalo_min: 600 })).cuerpo.ok === true,
      'comodín con intervalo de 600 s')

    const inventada = await alta('Fantasma', '/x', { estacion: 'no_existe' })
    revisar(!!inventada.cuerpo.error, 'no se puede atar un destino a una estación que no existe')

    golpes.length = 0
    await mandar(envio('AAA111', 'GW3000A', '63.5'))       // la encendida
    await mandar(envio('BBB222', 'GW2000A', '52.0'))       // la apagada
    await dormir(3500)

    revisar(cuenta('/patio') === 1, 'el destino de la estación recibió 1 vez', 'golpes=' + cuenta('/patio'))
    revisar(cuenta('/central') === 1, 'el comodín recibió sólo de la encendida',
      'golpes=' + cuenta('/central'))
    revisar(cuenta('/roto') === 1, 'el 404 NO se reintenta pese a reintentos:1', 'golpes=' + cuenta('/roto'))
    revisar(cuenta('/caido') === 2, 'el 500 SI se reintenta una vez', 'golpes=' + cuenta('/caido'))

    const est2 = (await api('/api/estado')).cuerpo.estaciones
    const apagada = est2.find(e => e.id === b)
    revisar(apagada.recibidos === 2, 'la estación apagada igual cuenta sus envíos')
    revisar(fs.readFileSync(path.join(CARPETA, b, dia), 'utf8').split('\n').filter(Boolean).length === 2,
      'y los archiva todos: apagada NO es ignorada')

    // --- ahora se enciende la segunda y el comodín tiene que alcanzarla
    titulo('se enciende la segunda estación')
    await post('/api/estacion', { id: b, nombre: 'Quinta', activa: true })
    golpes.length = 0
    await mandar(envio('BBB222', 'GW2000A', '53.0'))
    await dormir(1200)
    revisar(cuenta('/central') === 1, 'el comodín ahora sí recibe de la segunda')
    revisar(cuenta('/patio') === 0, 'y el destino de la primera NO recibe lo de la segunda')
    revisar(cuenta('/lento') === 1,
      'el de 600 s recibe igual: su reloj es POR ESTACION, y con esta nunca había mandado')

    // ============================================================ mismo servicio, dos estaciones
    //
    // EL CASO QUE IMPORTA: la misma receta cargada dos veces, con credenciales distintas, una
    // por estacion. Es lo normal — cada estacion es una cuenta distinta en el servicio— y si el
    // puente mezclara las credenciales, los datos del patio se publicarian en la estacion de la
    // quinta sin que nadie lo note.
    titulo('el mismo servicio con credenciales distintas por estacion')
    const dosVeces = async (nombre, estacion, url) => post('/api/destino', {
      destino: {
        nombre, tipo: 'receta', receta: 'webhook', estacion,
        credenciales: { url: 'http://127.0.0.1:' + FALSO + url, token: 'clave-de-' + estacion },
        activo: true,
      },
    })
    revisar((await dosVeces('Servicio A patio', a, '/svc-patio')).cuerpo.ok === true,
      'se carga el servicio para la primera estacion')
    revisar((await dosVeces('Servicio A quinta', b, '/svc-quinta')).cuerpo.ok === true,
      'y el MISMO servicio para la segunda, con otras credenciales')

    golpes.length = 0
    await mandar(envio('AAA111', 'GW3000A', '64.0'))
    await dormir(1200)
    revisar(cuenta('/svc-patio') === 1 && cuenta('/svc-quinta') === 0,
      'un envio de la primera va SOLO a las credenciales de la primera')

    golpes.length = 0
    await mandar(envio('BBB222', 'GW2000A', '54.0'))
    await dormir(1200)
    revisar(cuenta('/svc-quinta') === 1 && cuenta('/svc-patio') === 0,
      'y uno de la segunda, SOLO a las de la segunda')

    const cfgDos = (await api('/api/config')).cuerpo
    const dA = cfgDos.destinos.find(d => d.nombre === 'Servicio A patio')
    const dB = cfgDos.destinos.find(d => d.nombre === 'Servicio A quinta')
    revisar(dA.estacion === a && dB.estacion === b,
      'cada uno queda atado a su estacion', dA.estacion + ' / ' + dB.estacion)

    // ============================================================ el panel
    titulo('el estado que ve el panel')
    const e3 = (await api('/api/estado')).cuerpo
    revisar(e3.nodo.estaciones === 2 && e3.nodo.activas === 2, 'el nodo cuenta 2 estaciones activas')
    revisar(e3.nodo.algo_mal === 'ON', 'y avisa que algo no está funcionando (el 404 y el 500)')
    const filas = e3.destinos
    revisar(filas.filter(f => f.nombre === 'Central').length === 2,
      'el comodín aparece como DOS filas, una por estación', filas.filter(f => f.nombre === 'Central').map(f => f.estacion).join(', '))
    revisar(filas.filter(f => f.nombre === 'Del patio').length === 1, 'y el atado a una, como una sola')
    const roto = filas.find(f => f.nombre === 'Roto')
    revisar(String(roto.detalle).startsWith('HTTP 404') && roto.problema === true, 'el 404 figura como problema')

    // ============================================================ secretos
    titulo('las credenciales')
    await post('/api/destino', {
      destino: {
        nombre: 'Con token', tipo: 'receta', receta: 'webhook', estacion: '*',
        credenciales: { url: 'http://127.0.0.1:' + FALSO + '/token', token: 'SECRETO-DE-VERDAD' },
        activo: true,
      },
    })
    const vista = await api('/api/config')
    revisar(!JSON.stringify(vista.cuerpo).includes('SECRETO-DE-VERDAD'), 'el panel NUNCA devuelve el token')
    revisar(!JSON.stringify(vista.cuerpo).includes('tormenta2026') &&
      !JSON.stringify(vista.cuerpo).match(/"hash"/), 'ni las contraseñas de los usuarios, ni cifradas')
    revisar(Array.isArray(vista.cuerpo.usuarios) && vista.cuerpo.usuarios.length === 2,
      'el administrador sí ve la lista de usuarios, con nombre y rol')

    await post('/api/destino', {
      anterior: 'Con token',
      destino: {
        nombre: 'Con token', tipo: 'receta', receta: 'webhook', estacion: '*',
        credenciales: { url: 'http://127.0.0.1:' + FALSO + '/token', token: '' }, activo: true,
      },
    })
    const enDisco = JSON.parse(fs.readFileSync(path.join(CARPETA, 'config.json'), 'utf8'))
    revisar(enDisco.destinos.find(d => d.nombre === 'Con token').credenciales.token === 'SECRETO-DE-VERDAD',
      'guardar con el campo en blanco NO borra el secreto anterior')

    // ============================================================ borrar
    titulo('probar y borrar')
    const prueba = await post('/api/probar', { nombre: 'Del patio' })
    revisar(prueba.cuerpo.ok === true, 'Probar manda la última lectura real al destino')

    revisar((await api('/api/destino?nombre=Roto', { method: 'DELETE' })).cuerpo.ok === true, 'se borra un destino')
    const borrada = await api('/api/estacion?id=' + b, { method: 'DELETE' })
    revisar(borrada.cuerpo.ok === true, 'se borra una estación')
    const cfgFinal = (await api('/api/config')).cuerpo
    revisar(!cfgFinal.estaciones[b], 'y deja de figurar')
    revisar(fs.existsSync(path.join(CARPETA, b, dia)),
      'pero su archivo crudo NO se borra: dejar de vigilarla no es tirar su historia')

    const soloAdmin = us_ultimo(cfgFinal)
    revisar(soloAdmin, 'queda al menos un administrador')

    // ============================================================ la página
    titulo('la página')
    const pagina = await fetch('http://127.0.0.1:' + PUERTO + '/')
    const html = await pagina.text()
    revisar(pagina.status === 200 && html.includes('Puente Ecowitt'), 'la página se sirve sin sesión')
    revisar(html.includes('id="tabla-destinos"'), 'y trae la tabla de destinos')
    const salud = await fetch('http://127.0.0.1:' + PUERTO + '/salud')
    revisar(salud.status === 200, 'la sonda de salud contesta sin pedir sesión')
    const basura = await mandar('hola')
    revisar(basura.status === 400, 'un POST que no es un envío se rechaza')
  } finally {
    hijo.kill('SIGTERM')
    falso.close()
    await dormir(300)
  }

  // ============================================================ el admin por entorno
  // Segunda instancia, carpeta nueva y las dos variables puestas. Es el camino que va a usar
  // todo el que instale con Docker, asi que tiene que estar probado y no supuesto.
  titulo('el administrador desde las variables del contenedor')
  const carpeta2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ecowitt-env-'))
  const hijo2 = spawn(process.execPath, [path.join(AQUI, 'receptora.mjs'), '--puerto', '18091', '--sin-mqtt'], {
    env: { ...process.env, ARCHIVO: carpeta2, ADMIN_USUARIO: 'duenio', ADMIN_CLAVE: 'granizo2026' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const entrar2 = (clave) => fetch('http://127.0.0.1:18091/api/entrar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: 'duenio', clave }),
  })
  try {
    const salida2 = []
    hijo2.stdout.on('data', d => salida2.push(String(d)))
    hijo2.stderr.on('data', d => salida2.push(String(d)))
    if (!await esperarPuerto(18091, salida2)) throw new Error('no arranco')
    const ses = await (await fetch('http://127.0.0.1:18091/api/sesion')).json()
    revisar(ses.instalado === true, 'arranca YA instalado, sin pasar por la pantalla de crear')
    revisar((await entrar2('otra')).status === 401, 'con la clave equivocada no entra')
    revisar((await entrar2('granizo2026')).status === 200, 'y con la del entorno, si')

    const guardado = JSON.parse(fs.readFileSync(path.join(carpeta2, 'config.json'), 'utf8'))
    revisar(!JSON.stringify(guardado).includes('granizo2026'),
      'la contraseña NO queda escrita en config.json, solo su scrypt')
    revisar(guardado.usuarios.duenio.rol === 'admin', 'y el usuario quedo como administrador')
  } finally {
    hijo2.kill('SIGTERM')
    await dormir(300)
    try { fs.rmSync(carpeta2, { recursive: true, force: true }) } catch {}
  }


  // ============================================================ las variables del instalador
  //
  // ESTO SE PRUEBA PORQUE YA FALLO. El 01/09/2026 RAIZ_MQTT, PREFIJO_HA y NOMBRE_NODO estaban
  // declaradas en el .env.ejemplo y en el compose, y no hacian nada: los valores por defecto se
  // rellenaban antes de mirarlas. Una variable que figura y no funciona es peor que una que no
  // esta, porque el que instala cree que la configuro.
  titulo('las variables del instalador')
  const carpeta3 = fs.mkdtempSync(path.join(os.tmpdir(), 'ecowitt-var-'))
  const entorno = {
    ...process.env, ARCHIVO: carpeta3,
    RAIZ_MQTT: 'miclima', PREFIJO_HA: 'micasa', NOMBRE_NODO: 'Puente de la quinta',
    MQTT_HOST: 'TU_IP_WAN', MQTT_PUERTO: '8883', MQTT_USUARIO: 'juan', MQTT_CLAVE: 'secreta123',
    ADMIN_USUARIO: 'duenio', ADMIN_CLAVE: 'granizo2026',
  }
  const arrancar3 = (env) => spawn(process.execPath,
    [path.join(AQUI, 'receptora.mjs'), '--puerto', '18092', '--sin-mqtt'],
    { env, stdio: ['ignore', 'pipe', 'pipe'] })

  let h3 = arrancar3(entorno)
  try {
    const s3 = []
    h3.stdout.on('data', d => s3.push(String(d)))
    h3.stderr.on('data', d => s3.push(String(d)))
    if (!await esperarPuerto(18092, s3)) throw new Error('no arranco')
    let c3 = JSON.parse(fs.readFileSync(path.join(carpeta3, 'config.json'), 'utf8'))
    revisar(c3.nodo.raiz === 'miclima', 'RAIZ_MQTT siembra la raiz de los temas', c3.nodo.raiz)
    revisar(c3.nodo.nombre === 'Puente de la quinta', 'NOMBRE_NODO siembra el nombre', c3.nodo.nombre)
    revisar(c3.mqtt.prefijo === 'micasa', 'PREFIJO_HA siembra el prefijo', c3.mqtt.prefijo)
    revisar(c3.mqtt.host === 'TU_IP_WAN' && c3.mqtt.puerto === 8883 && c3.mqtt.usuario === 'juan',
      'MQTT_HOST, MQTT_PUERTO y MQTT_USUARIO siembran el broker')
    revisar(s3.join('').indexOf('Puente de la quinta') !== -1, 'y el puente arranca con ese nombre')

    // Ahora se cambia algo desde el panel y se reinicia con OTRO entorno: lo del panel manda.
    h3.kill('SIGTERM'); await dormir(400)
    c3.nodo.raiz = 'cambiada_a_mano'
    fs.writeFileSync(path.join(carpeta3, 'config.json'), JSON.stringify(c3, null, 2))
    h3 = arrancar3({ ...entorno, RAIZ_MQTT: 'otra_del_entorno' })
    const s4 = []
    h3.stdout.on('data', d => s4.push(String(d)))
    if (!await esperarPuerto(18092, s4)) throw new Error('no arranco')
    c3 = JSON.parse(fs.readFileSync(path.join(carpeta3, 'config.json'), 'utf8'))
    revisar(c3.nodo.raiz === 'cambiada_a_mano',
      'y un reinicio con otro entorno NO pisa lo que ya estaba configurado', c3.nodo.raiz)
  } finally {
    h3.kill('SIGTERM')
    await dormir(300)
    try { fs.rmSync(carpeta3, { recursive: true, force: true }) } catch {}
  }

  // Sin broker configurado no es un error: el puente sirve igual.
  titulo('sin Home Assistant')
  const carpeta4 = fs.mkdtempSync(path.join(os.tmpdir(), 'ecowitt-nomqtt-'))
  const limpio = { ...process.env, ARCHIVO: carpeta4, ADMIN_USUARIO: 'x', ADMIN_CLAVE: 'sinbroker2026' }
  delete limpio.MQTT_HOST; delete limpio.MQTT_USUARIO; delete limpio.MQTT_CLAVE
  const h4 = spawn(process.execPath, [path.join(AQUI, 'receptora.mjs'), '--puerto', '18093'],
    { env: limpio, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const s5 = []
    h4.stdout.on('data', d => s5.push(String(d)))
    h4.stderr.on('data', d => s5.push(String(d)))
    if (!await esperarPuerto(18093, s5)) throw new Error('no arranco')
    await dormir(500)
    const texto = s5.join('')
    revisar(texto.indexOf('no hay broker configurado') !== -1,
      'lo dice una vez y sigue andando, en vez de reintentar para siempre')
    revisar(texto.indexOf('192.168') === -1,
      'y NO intenta conectarse a la IP de la casa donde se escribio esto')
  } finally {
    h4.kill('SIGTERM')
    await dormir(300)
    try { fs.rmSync(carpeta4, { recursive: true, force: true }) } catch {}
  }

  console.log('\n=== ' + (fallas ? fallas + ' FALLAS' : 'todo bien'))
  if (fallas) { console.log('\n--- salida del puente:'); console.log(salida.join('')) }
  // La carpeta temporal se borra: si no, cada corrida deja una copia con credenciales de
  // prueba adentro.
  try { fs.rmSync(CARPETA, { recursive: true, force: true }) } catch {}
  process.exit(fallas ? 1 : 0)
}

const us_ultimo = (cfg) => Array.isArray(cfg.usuarios) && cfg.usuarios.some(u => u.rol === 'admin')

main()
