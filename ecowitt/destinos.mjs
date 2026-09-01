// Administra los destinos del puente desde la línea de comandos.
//
//   node scripts/ecowitt/destinos.mjs                            lista lo que hay
//   node scripts/ecowitt/destinos.mjs --recetas                  qué servicios se pueden cargar
//   node scripts/ecowitt/destinos.mjs --probar "<nombre>"        le manda la última lectura real
//   node scripts/ecowitt/destinos.mjs --agregar <archivo.json>   alta o edición desde un archivo
//   node scripts/ecowitt/destinos.mjs --activar    "<nombre>"
//   node scripts/ecowitt/destinos.mjs --desactivar "<nombre>"
//   node scripts/ecowitt/destinos.mjs --borrar     "<nombre>"
//   node scripts/ecowitt/destinos.mjs --puente http://otra-ip:8088
//
// HABLA CON EL PANEL, NO CON EL ARCHIVO. Es la decisión importante de este script.
//
// Editar config.json por Samba también funcionaría —el puente lo relee cada 60 segundos— pero
// habría dos programas escribiendo el mismo archivo: el panel web y esto. Dos escritores sobre
// un JSON terminan, tarde o temprano, con uno pisando el cambio del otro. Yendo por la API hay
// un solo escritor, el puente, y de paso se validan las credenciales y se retiran las entidades
// de Home Assistant al borrar un destino — cosas que editar el archivo a mano no hace.
//
// EL DESTINO NUEVO SE PASA EN UN ARCHIVO, NO POR LA LINEA DE COMANDOS. Las credenciales de
// estos servicios llevan &, ? y $, y en este proyecto pasar eso por el shell ya se comió parte
// de un texto tres veces (ver CLAUDE.md). Además así la clave no queda en el historial de la
// terminal.

import fs from 'node:fs'

const arg = (n) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : null }
const tiene = (n) => process.argv.includes('--' + n)

const PUENTE = (arg('puente') || process.env.PUENTE || 'http://TU_IP_LAN:8088').replace(/\/+$/, '')
const CLAVE = process.env.PANEL_CLAVE || ''

const api = async (ruta, opciones = {}) => {
  let r
  try {
    r = await fetch(PUENTE + ruta, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', 'x-clave': CLAVE, ...(opciones.headers || {}) },
      signal: AbortSignal.timeout(20000),
    })
  } catch (e) {
    console.error('No se pudo hablar con el puente en ' + PUENTE)
    console.error('  ' + e.message)
    console.error('\n  - ¿está levantado el contenedor en Container Manager?')
    console.error('  - si corre en otra máquina: --puente http://IP:PUERTO')
    process.exit(1)
  }
  if (r.status === 401) {
    console.error('El panel pide clave. Definir PANEL_CLAVE con la misma que tiene el contenedor.')
    process.exit(1)
  }
  const t = await r.text()
  try { return JSON.parse(t) } catch { return { error: t.slice(0, 200) } }
}

const fin = (r) => {
  if (r && r.error) { console.error('\n' + r.error); process.exit(1) }
  return r
}

// ---------------------------------------------------------------- ver

const listar = async () => {
  const e = await api('/api/estado')
  console.log('=== ' + PUENTE)
  console.log('    envíos recibidos: ' + e.puente.recibidos +
    (e.puente.ultimo ? '   último: ' + new Date(e.puente.ultimo).toLocaleString('es-AR') : '   (ninguno todavía)'))
  console.log('    MQTT: ' + (e.mqtt.conectado ? 'conectado' : 'SIN CONECTAR — ' + (e.mqtt.motivo || '')))
  if (e.puente.muda === 'ON') console.log('    LA ESTACION DEJO DE REPORTAR')
  console.log('')
  if (!e.destinos.length) {
    console.log('    ningún destino: el puente archiva pero no reenvía')
    return e
  }
  console.log('    estado    destino                  servicio               último    resultado')
  for (const d of e.destinos) {
    const estado = !d.activo ? 'apagado' : (d.esperando ? 'espera ' : (d.problema ? 'FALLA  ' : 'ok     '))
    const cuando = d.ultimo_intento
      ? new Date(d.ultimo_intento).toLocaleTimeString('es-AR', { hour12: false }).slice(0, 5)
      : '  --  '
    console.log('    ' + estado + '   ' + d.nombre.padEnd(24) + String(d.servicio).padEnd(22) +
      cuando.padEnd(10) + (d.detalle || '') +
      (d.verificado === false ? '   [receta sin verificar]' : ''))
  }
  return e
}

const verRecetas = async () => {
  const r = await api('/api/recetas')
  console.log('=== servicios que se pueden cargar\n')
  for (const x of r) {
    console.log('  ' + x.id.padEnd(15) + x.nombre + (x.verificado ? '' : '   [sin verificar]'))
    console.log('  ' + ' '.repeat(15) + 'credenciales: ' + x.campos.map(c => c.clave).join(', '))
    if (x.intervalo_sug) console.log('  ' + ' '.repeat(15) + 'intervalo sugerido: ' + x.intervalo_sug + ' s')
    console.log('')
  }
  console.log('Para dar de alta uno, un archivo así:\n')
  console.log(JSON.stringify({
    nombre: 'Windy de casa', tipo: 'receta', receta: 'windy',
    credenciales: { api_key: 'LA-CLAVE', station: 0 },
    intervalo_min: 300, reintentos: 2, activo: false,
  }, null, 2))
  console.log('\n  node scripts/ecowitt/destinos.mjs --agregar windy.json')
}

// ---------------------------------------------------------------- cambiar

const agregar = async (ruta) => {
  if (!fs.existsSync(ruta)) { console.error('No existe ' + ruta); process.exit(1) }
  let nuevo
  try { nuevo = JSON.parse(fs.readFileSync(ruta, 'utf8')) }
  catch (e) { console.error('El archivo no es JSON válido: ' + e.message); process.exit(1) }

  for (const d of (Array.isArray(nuevo) ? nuevo : [nuevo])) {
    // Se manda APAGADO salvo que el archivo diga lo contrario a propósito: primero se lo prueba
    // y recién después se lo enciende. Uno que arranca prendido puede estar mandando mal
    // durante días sin que nadie lo mire.
    const r = fin(await api('/api/destino', {
      method: 'POST',
      body: JSON.stringify({ anterior: d.anterior || null, destino: { ...d, activo: d.activo === true } }),
    }))
    console.log('guardado: ' + d.nombre + (d.activo === true ? '' : '   (apagado: encenderlo con --activar)'))
    if (r.faltan && r.faltan.length) console.log('   OJO, le faltan: ' + r.faltan.join(', '))
  }
}

const alternar = async (nombre, activo) => {
  fin(await api('/api/destino', {
    method: 'POST',
    body: JSON.stringify({ anterior: nombre, destino: { nombre, activo } }),
  }))
  console.log(nombre + ': ' + (activo ? 'encendido' : 'apagado'))
}

const borrar = async (nombre) => {
  fin(await api('/api/destino?nombre=' + encodeURIComponent(nombre), { method: 'DELETE' }))
  console.log('borrado: ' + nombre + '   (y retiradas sus entidades de Home Assistant)')
}

const probar = async (nombre) => {
  const r = await api('/api/probar', { method: 'POST', body: JSON.stringify({ nombre }) })
  console.log((r.ok ? 'ok   ' : 'FALLA ') + nombre + ': ' + (r.detalle || ''))
  if (r.respuesta) console.log('       contestó: ' + r.respuesta)
  if (!r.ok) process.exitCode = 1
}

// ----------------------------------------------------------------

const main = async () => {
  if (tiene('recetas')) return verRecetas()

  const a = arg('agregar')
  if (a) { await agregar(a); return void await listar() }

  for (const [bandera, valor] of [['activar', true], ['desactivar', false]]) {
    const n = arg(bandera)
    if (n) { await alternar(n, valor); return void await listar() }
  }

  const b = arg('borrar')
  if (b) { await borrar(b); return void await listar() }

  const p = arg('probar')
  if (p) return probar(p)

  await listar()
}

main()
