// Baja los iconos a color de Fluent Emoji a /config/www/icons/color/.
//
//   node scripts/panel2/bajar-iconos.mjs          ensayo: dice que bajaria
//   node scripts/panel2/bajar-iconos.mjs --bajar  los descarga
//
// POR QUE ESTE ARCHIVO
//
// El panel pasa de iconos MDI monocromos a los PNG 3D de `microsoft/fluentui-emoji`
// (licencia MIT). **Se bajan una sola vez y quedan servidos por Home Assistant**: no se
// referencian desde GitHub. Un panel de pared no puede depender de que internet ande para
// dibujar su propia barra, y ademas cada carga saldria a buscarlos afuera.
//
// LA CARPETA SE LLAMA `iconos` Y NO `icons`, y no fue una eleccion: **el recurso Samba de
// Home Assistant NO deja crear una carpeta llamada `icons` en /config/www**. Devuelve "no
// se pudo encontrar el archivo 'icons'" y `Test-Path` da falso, aunque cualquier otro
// nombre —probado con `pruebaclaude`— se crea sin problema. Debe ser un patron vetado en la
// configuracion del complemento. Se uso `iconos`, que anda, y las rutas del panel apuntan
// a /local/iconos/color/.
//
// EL NOMBRE DE LA CARPETA EN EL REPO NO ES OBVIO. Fluent Emoji usa el nombre CLDR del
// emoji, con espacios y mayusculas: "Light bulb", "Sun behind rain cloud". Y algunos
// cuelgan de `<Carpeta>/3D/` mientras otros tienen variantes y cuelgan de
// `<Carpeta>/Default/3D/`. Por eso se prueban las dos rutas antes de darse por vencido.

import fs from 'node:fs'
import path from 'node:path'

const DESTINO = '//TU_HOST_HA/config/www/iconos/color'
const BASE = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets'
const APLICAR = process.argv.includes('--bajar')

// guardar como, carpeta del repo, archivo
const ICONOS = [
  ['casa.png', 'House', 'house_3d.png'],
  ['lampara.png', 'Light bulb', 'light_bulb_3d.png'],
  ['escudo.png', 'Shield', 'shield_3d.png'],
  ['camara.png', 'Video camera', 'video_camera_3d.png'],
  ['ambientes.png', 'Houses', 'houses_3d.png'],
  ['clima.png', 'Sun behind rain cloud', 'sun_behind_rain_cloud_3d.png'],
  ['musica.png', 'Musical note', 'musical_note_3d.png'],
  ['rayo.png', 'High voltage', 'high_voltage_3d.png'],
  ['mas.png', 'Plus', 'plus_3d.png'],
  ['robot.png', 'Robot', 'robot_3d.png'],
  ['camioneta.png', 'Pickup truck', 'pickup_truck_3d.png'],
  ['recibo.png', 'Receipt', 'receipt_3d.png'],
  ['casitas.png', 'House with garden', 'house_with_garden_3d.png'],
  ['red.png', 'Globe with meridians', 'globe_with_meridians_3d.png'],
  ['engranaje.png', 'Gear', 'gear_3d.png'],

  // --- Los 28 del resto del panel (ICONOS-PANEL-COMPLETO.md) ---
  ['candado.png', 'Locked', 'locked_3d.png'],
  ['candado-abierto.png', 'Unlocked', 'unlocked_3d.png'],
  ['llave.png', 'Old key', 'old_key_3d.png'],
  ['microfono.png', 'Studio microphone', 'studio_microphone_3d.png'],
  ['luna.png', 'Crescent moon', 'crescent_moon_3d.png'],
  ['foco.png', 'Bullseye', 'bullseye_3d.png'],
  ['claqueta.png', 'Clapper board', 'clapper_board_3d.png'],
  ['vela.png', 'Candle', 'candle_3d.png'],
  ['playa.png', 'Beach with umbrella', 'beach_with_umbrella_3d.png'],
  ['teatro.png', 'Performing arts', 'performing_arts_3d.png'],
  ['gota.png', 'Droplet', 'droplet_3d.png'],
  ['viento.png', 'Wind face', 'wind_face_3d.png'],
  ['ola.png', 'Water wave', 'water_wave_3d.png'],
  ['sirena.png', 'Police car light', 'police_car_light_3d.png'],
  ['pila.png', 'Battery', 'battery_3d.png'],
  ['zapatilla.png', 'Running shoe', 'running_shoe_3d.png'],
  ['satelite.png', 'Satellite', 'satellite_3d.png'],
  ['antena.png', 'Satellite antenna', 'satellite_antenna_3d.png'],
  ['termometro.png', 'Thermometer', 'thermometer_3d.png'],
  ['tele.png', 'Television', 'television_3d.png'],
  ['parlante.png', 'Speaker high volume', 'speaker_high_volume_3d.png'],
  ['foto.png', 'Framed picture', 'framed_picture_3d.png'],
  ['papas.png', 'French fries', 'french_fries_3d.png'],
  ['brujula.png', 'Compass', 'compass_3d.png'],
  ['surtidor.png', 'Fuel pump', 'fuel_pump_3d.png'],
  ['dinero.png', 'Money bag', 'money_bag_3d.png'],
  ['enchufe.png', 'Electric plug', 'electric_plug_3d.png'],
  ['hielo.png', 'Ice', 'ice_3d.png'],
]

const url = (carpeta, archivo, conDefault) =>
  BASE + '/' + encodeURIComponent(carpeta) + (conDefault ? '/Default' : '') + '/3D/' + archivo

const bajar = async (carpeta, archivo) => {
  // Primero sin `Default`, que es la forma mas comun; despues con.
  for (const conDefault of [false, true]) {
    const u = url(carpeta, archivo, conDefault)
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(20000) })
      if (r.ok) return { ok: true, datos: Buffer.from(await r.arrayBuffer()), url: u }
    } catch { /* se prueba la otra */ }
  }
  return { ok: false }
}

if (!APLICAR) {
  console.log('ENSAYO. Se bajarian ' + ICONOS.length + ' iconos a ' + DESTINO)
  for (const [n, c, a] of ICONOS) console.log('   ' + n.padEnd(16) + c + '/3D/' + a)
  console.log('\nCorrer con --bajar')
} else {
  // NO se usa fs.mkdirSync sobre la ruta UNC: cuelga sin devolver nunca. La carpeta se
  // crea aparte con PowerShell (New-Item). Aca solo se comprueba que exista.
  if (!fs.existsSync(DESTINO)) {
    console.error('Falta ' + DESTINO + '. Crearla con:')
    console.error('  New-Item -ItemType Directory "\\TU_HOST_HA\config\www\iconos\color"')
    process.exit(1)
  }
  let bien = 0
  const fallaron = []
  for (const [nombre, carpeta, archivo] of ICONOS) {
    const r = await bajar(carpeta, archivo)
    if (!r.ok) { console.log('   ' + nombre.padEnd(16) + 'FALLO   ' + carpeta + '/' + archivo); fallaron.push(nombre); continue }
    fs.writeFileSync(path.join(DESTINO, nombre), r.datos)
    console.log('   ' + nombre.padEnd(16) + Math.round(r.datos.length / 1024) + ' KB')
    bien++
  }
  console.log('\n' + bien + '/' + ICONOS.length + ' bajados')

  // Un archivo escrito no es un archivo servible: se comprueba que Home Assistant los
  // devuelva por /local/, que es como los va a pedir el panel.
  console.log('\ncomprobando que HA los sirva por /local/icons/color/ ...')
  let servidos = 0
  for (const [nombre] of ICONOS) {
    try {
      const r = await fetch('http://TU_HOST_HA:8123/local/iconos/color/' + nombre,
        { signal: AbortSignal.timeout(10000) })
      const tipo = r.headers.get('content-type') || ''
      const ok = r.ok && /image/.test(tipo)
      if (ok) servidos++
      else console.log('   ' + nombre.padEnd(16) + 'HTTP ' + r.status + '  ' + tipo)
    } catch (e) { console.log('   ' + nombre.padEnd(16) + 'sin respuesta') }
  }
  console.log(servidos + '/' + ICONOS.length + ' se sirven bien por /local/')
  if (fallaron.length) process.exitCode = 1
}
