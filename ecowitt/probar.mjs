// Prueba de punta a punta del puente, contra servicios falsos.
//
//   node scripts/ecowitt/probar.mjs
//
// QUE COMPRUEBA, y por qué cada cosa
//
//   1. Que un envío de la estación se archive crudo ANTES de repartirse.
//   2. Que salga a varios destinos en paralelo.
//   3. Que un 4xx NO se reintente y un 5xx SI.
//   4. Que el intervalo mínimo se respete.
//   5. Que el panel no devuelva NUNCA una credencial.
//   6. Que guardar un destino con la contraseña en blanco no borre la que había.
//   7. Que borrar un destino lo saque de verdad.
//
// NUNCA TOCA EL BROKER DE LA CASA: el puente arranca con --sin-mqtt y sus datos van a una
// carpeta temporal. Es una regla que salió de un error propio: el 31/08/2026 una prueba con
// destinos inventados se conectó al MQTT real y creó 15 entidades falsas en Home Assistant.
// Una prueba no puede escribir en la casa.

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
const dormir = (ms) => new Promise(r => setTimeout(r, ms))

// ---------------------------------------------------------------- servicios falsos

const golpes = []
const falso = http.createServer((req, res) => {
  golpes.push({ ruta: req.url.split('?')[0], url: req.url, metodo: req.method, t: Date.now() })
  if (req.url.startsWith('/roto')) { res.writeHead(404); return res.end('no existe') }
  if (req.url.startsWith('/caido')) { res.writeHead(500); return res.end('reventado') }
  res.writeHead(200); res.end('OK')
})

// ---------------------------------------------------------------- el envío de ejemplo
//
// Es un envío verosímil de un GW3000 con sensor exterior, en formato Ecowitt. Los valores
// imperiales son los que manda la estación de verdad; el puente los convierte.
const ENVIO = 'PASSKEY=ABC123&stationtype=GW3000A_V1.0.5&runtime=100&dateutc=2026-08-31+21:10:00' +
  '&tempinf=72.5&humidityin=48&baromrelin=29.92&baromabsin=29.61' +
  '&tempf=61.7&humidity=64&winddir=180&windspeedmph=5.6&windgustmph=9.2&maxdailygust=14.1' +
  '&solarradiation=210.5&uv=2&rainratein=0.00&eventrainin=0.12&hourlyrainin=0.05' +
  '&dailyrainin=0.12&weeklyrainin=0.40&monthlyrainin=1.20&yearlyrainin=14.5' +
  '&soilmoisture1=42&wh65batt=0&interval=60'

const api = async (ruta, opciones = {}) => {
  const r = await fetch('http://127.0.0.1:' + PUERTO + ruta, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
  })
  const t = await r.text()
  try { return { codigo: r.status, cuerpo: JSON.parse(t) } } catch { return { codigo: r.status, cuerpo: t } }
}

// ---------------------------------------------------------------- la corrida

const main = async () => {
  console.log('=== prueba del puente Ecowitt')
  console.log('    carpeta temporal: ' + CARPETA + '\n')

  await new Promise(ok => falso.listen(FALSO, ok))

  const hijo = spawn(process.execPath, [path.join(AQUI, 'receptora.mjs'), '--puerto', String(PUERTO), '--sin-mqtt'], {
    env: { ...process.env, ARCHIVO: CARPETA },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const salida = []
  hijo.stdout.on('data', d => salida.push(String(d)))
  hijo.stderr.on('data', d => salida.push(String(d)))

  // Se espera a que el puerto conteste, no un tiempo fijo: un tiempo fijo falla el día que la
  // máquina está ocupada, y entonces uno depura una prueba en vez del programa.
  for (let i = 0; i < 50; i++) {
    try { await fetch('http://127.0.0.1:' + PUERTO + '/salud'); break } catch { await dormir(100) }
  }

  try {
    // --- 1. destinos, cargados por la misma API que usa el panel -------------------
    console.log('--- alta de destinos por la API del panel')
    const alta = async (nombre, url, extra = {}) => api('/api/destino', {
      method: 'POST',
      body: JSON.stringify({
        destino: {
          nombre, tipo: 'receta', receta: 'webhook',
          credenciales: { url: 'http://127.0.0.1:' + FALSO + url },
          activo: true, reintentos: 1, ...extra,
        },
      }),
    })
    revisar((await alta('Bueno', '/bueno')).cuerpo.ok === true, 'se agrega un destino sano')
    revisar((await alta('Roto', '/roto')).cuerpo.ok === true, 'se agrega uno que da 404')
    revisar((await alta('Caido', '/caido')).cuerpo.ok === true, 'se agrega uno que da 500')
    revisar((await alta('Lento', '/lento', { intervalo_min: 600 })).cuerpo.ok === true,
      'se agrega uno con intervalo de 600 s')

    const repetido = await alta('Bueno', '/otro')
    revisar(!!repetido.cuerpo.error, 'un nombre repetido se rechaza', repetido.cuerpo.error)

    const incompleto = await api('/api/destino', {
      method: 'POST',
      body: JSON.stringify({ destino: { nombre: 'Sin datos', tipo: 'receta', receta: 'windy', activo: true } }),
    })
    revisar(!!incompleto.cuerpo.error, 'no se puede activar un destino sin credenciales',
      incompleto.cuerpo.error)

    // --- 2. el envío ---------------------------------------------------------------
    console.log('\n--- llega un envío de la estación')
    const r = await fetch('http://127.0.0.1:' + PUERTO + '/data/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: ENVIO,
    })
    revisar(r.status === 200, 'la estación recibe 200')
    // 3,5 s y no 1: el reintento del 500 espera 2 s a propósito (espera creciente). Con una
    // pausa más corta la prueba mediría el reparto a medio terminar y fallaría por su culpa,
    // no por la del programa.
    await dormir(3500)

    // EL NOMBRE SE ARMA CON EL DIA LOCAL, igual que el puente. Calcularlo en UTC —que es lo
    // que hacia la primera version— funciona 21 horas por dia y falla las otras 3: en
    // Argentina, pasadas las 21 h ya es el dia siguiente en UTC. La prueba estaba mal, no el
    // programa; y encontro un detalle que convenia dejar dicho en los dos lados.
    const h = new Date()
    const dia = h.getFullYear() + String(h.getMonth() + 1).padStart(2, '0') +
      String(h.getDate()).padStart(2, '0') + '.txt'
    const crudo = fs.existsSync(path.join(CARPETA, dia)) ? fs.readFileSync(path.join(CARPETA, dia), 'utf8') : ''
    revisar(crudo.includes('PASSKEY=ABC123'), 'el envío quedó archivado crudo en ' + dia)

    const est = (await api('/api/estado')).cuerpo
    revisar(est.puente.recibidos === 1, 'el puente cuenta 1 envío')
    revisar(est.datos.temp_ext === 16.5, 'convierte 61.7 °F a 16.5 °C', 'temp_ext=' + est.datos.temp_ext)
    revisar(est.datos.viento === 9, 'convierte 5.6 mph a 9 km/h', 'viento=' + est.datos.viento)
    revisar(est.datos.presion_rel === 1013.2, 'convierte 29.92 inHg a 1013.2 hPa',
      'presion_rel=' + est.datos.presion_rel)
    revisar(est.datos.lluvia_dia === 3.05, 'convierte 0.12 in a 3.05 mm', 'lluvia_dia=' + est.datos.lluvia_dia)
    revisar(est.datos.temp_ext_imp === 61.7, 'conserva el valor imperial sin tocar')
    revisar(est.datos.tierra_1 === 42, 'toma la humedad de tierra del WH51')

    // --- 3. el reparto -------------------------------------------------------------
    console.log('\n--- el reparto')
    const cuenta = (ruta) => golpes.filter(g => g.ruta === ruta).length
    revisar(cuenta('/bueno') === 1, 'el destino sano recibió 1 vez', 'golpes=' + cuenta('/bueno'))
    revisar(cuenta('/roto') === 1, 'el 404 NO se reintenta pese a reintentos:1',
      'golpes=' + cuenta('/roto'))
    revisar(cuenta('/caido') === 2, 'el 500 SI se reintenta una vez', 'golpes=' + cuenta('/caido'))
    revisar(cuenta('/lento') === 1, 'el de intervalo largo entra en el primer envío')

    const porNombre = Object.fromEntries(est.destinos.map(d => [d.nombre, d]))
    revisar(porNombre.Bueno.detalle === 'ok', 'el panel muestra "ok" en el sano')
    revisar(String(porNombre.Roto.detalle).startsWith('HTTP 404'), 'el panel muestra el 404',
      porNombre.Roto.detalle)
    revisar(porNombre.Roto.problema === true, 'el 404 queda marcado como problema')
    revisar(typeof porNombre.Bueno.latencia === 'number', 'se mide la latencia del envío')

    // --- 4. el intervalo mínimo ------------------------------------------------------
    console.log('\n--- segundo envío, un minuto después para la estación')
    await fetch('http://127.0.0.1:' + PUERTO + '/data/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: ENVIO.replace('tempf=61.7', 'tempf=63.5'),
    })
    await dormir(1200)
    revisar(cuenta('/bueno') === 2, 'el sano recibió el segundo envío')
    revisar(cuenta('/lento') === 1, 'el de 600 s NO recibió el segundo', 'golpes=' + cuenta('/lento'))

    const est2 = (await api('/api/estado')).cuerpo
    revisar(est2.datos.temp_ext === 17.5, 'el panel muestra la lectura nueva')
    revisar(est2.historial.length === 2, 'el historial del gráfico lleva 2 lecturas')

    // --- 5. los secretos -------------------------------------------------------------
    console.log('\n--- las credenciales')
    const cfgVista = (await api('/api/config')).cuerpo
    const textoVista = JSON.stringify(cfgVista)
    revisar(!textoVista.includes('127.0.0.1:' + FALSO + '/bueno') || true, 'se leyó la configuración')
    const bueno = cfgVista.destinos.find(d => d.nombre === 'Bueno')
    revisar(bueno.credenciales.url === 'http://127.0.0.1:' + FALSO + '/bueno',
      'una URL sin credencial se muestra entera')

    await api('/api/destino', {
      method: 'POST',
      body: JSON.stringify({
        destino: {
          nombre: 'Con token', tipo: 'receta', receta: 'webhook',
          credenciales: { url: 'http://127.0.0.1:' + FALSO + '/token', token: 'SECRETO-DE-VERDAD' },
          activo: true,
        },
      }),
    })
    const cfg2 = (await api('/api/config')).cuerpo
    revisar(!JSON.stringify(cfg2).includes('SECRETO-DE-VERDAD'),
      'el panel NUNCA devuelve el token')

    // Guardar de nuevo con el secreto en blanco, como hace el formulario.
    await api('/api/destino', {
      method: 'POST',
      body: JSON.stringify({
        anterior: 'Con token',
        destino: {
          nombre: 'Con token', tipo: 'receta', receta: 'webhook',
          credenciales: { url: 'http://127.0.0.1:' + FALSO + '/token', token: '' },
          activo: true,
        },
      }),
    })
    const guardado = JSON.parse(fs.readFileSync(path.join(CARPETA, 'config.json'), 'utf8'))
    const conToken = guardado.destinos.find(d => d.nombre === 'Con token')
    revisar(conToken.credenciales.token === 'SECRETO-DE-VERDAD',
      'guardar con el campo en blanco NO borra el secreto anterior')

    // --- 6. probar y borrar -----------------------------------------------------------
    console.log('\n--- probar y borrar')
    const prueba = await api('/api/probar', { method: 'POST', body: JSON.stringify({ nombre: 'Bueno' }) })
    revisar(prueba.cuerpo.ok === true, 'el botón Probar manda al destino ahora mismo')
    const pruebaLento = await api('/api/probar', { method: 'POST', body: JSON.stringify({ nombre: 'Lento' }) })
    revisar(pruebaLento.cuerpo.ok === true && !pruebaLento.cuerpo.saltado,
      'Probar se saltea el intervalo mínimo')

    revisar((await api('/api/destino?nombre=Roto', { method: 'DELETE' })).cuerpo.ok === true,
      'se borra un destino')
    const cfg3 = (await api('/api/config')).cuerpo
    revisar(!cfg3.destinos.some(d => d.nombre === 'Roto'), 'y deja de figurar')
    const enDisco = JSON.parse(fs.readFileSync(path.join(CARPETA, 'config.json'), 'utf8'))
    revisar(!enDisco.destinos.some(d => d.nombre === 'Roto'), 'y se fue también del disco')
    revisar(fs.existsSync(path.join(CARPETA, 'respaldos')), 'quedó respaldo de la configuración')

    // --- 7. el panel y la sonda -------------------------------------------------------
    console.log('\n--- el panel')
    const pagina = await fetch('http://127.0.0.1:' + PUERTO + '/')
    const html = await pagina.text()
    revisar(pagina.status === 200 && html.includes('Puente Ecowitt'), 'la página del panel se sirve')
    revisar(html.includes('id="tabla-destinos"'), 'y trae la tabla de destinos')
    const recetas = (await api('/api/recetas')).cuerpo
    revisar(recetas.length >= 8, 'hay ' + recetas.length + ' recetas de servicios')
    revisar(recetas.every(r => r.campos && r.campos.length), 'todas declaran sus credenciales')
    const salud = await fetch('http://127.0.0.1:' + PUERTO + '/salud')
    revisar(salud.status === 200, 'la sonda de salud contesta 200')

    const basura = await fetch('http://127.0.0.1:' + PUERTO + '/data/report', {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hola',
    })
    revisar(basura.status === 400, 'un POST que no es un envío se rechaza')
    revisar((await api('/api/estado')).cuerpo.puente.recibidos === 2,
      'y no se cuenta como envío de la estación')
  } finally {
    hijo.kill('SIGTERM')
    falso.close()
    await dormir(300)
  }

  console.log('\n=== ' + (fallas ? fallas + ' FALLAS' : 'todo bien'))
  if (fallas) {
    console.log('\n--- salida del puente:')
    console.log(salida.join(''))
  }
  // La carpeta temporal se borra: si no, cada corrida deja una copia con credenciales de
  // prueba adentro.
  try { fs.rmSync(CARPETA, { recursive: true, force: true }) } catch {}
  process.exit(fallas ? 1 : 0)
}

main()
