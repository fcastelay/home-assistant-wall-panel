// Arma la carpeta del puente Ecowitt y la copia al Synology.
//
//   node scripts/ecowitt/desplegar-nas.mjs --ver          dice qué haría, sin escribir
//   node scripts/ecowitt/desplegar-nas.mjs                copia al NAS
//   node scripts/ecowitt/desplegar-nas.mjs --armar ./build   la arma en una carpeta local
//
// POR QUE HACE FALTA ARMAR Y NO ALCANZA CON `docker build`
//
// Los archivos del puente viven en scripts/ecowitt/, pero `_mqtt.mjs` viene de scripts/garnet/:
// es el mismo cliente MQTT, ya probado en esta casa con la alarma, y tener dos copias
// significaría que un arreglo sirve para una sola. Docker no puede salir de su contexto de
// construcción, así que primero se junta todo en una carpeta y ahí adentro se construye.
//
// MISMO LUGAR Y MISMO PATRON QUE LA RECEPTORA DE LA GARNET, y por la misma razón: el NAS está
// siempre encendido, mientras que HA corre en la mini PC que —cita del CLAUDE.md— "se cae
// seguido y tiene un vigía que la revive". Si HA se reinicia, el puente **sigue recibiendo y
// archivando**: se pierde el reenvío de esos minutos, no el dato.
//
// EL DESTINO A HOME ASSISTANT NO SE ESCRIBE SOLO: el webhook de la integración Ecowitt lo
// muestra HA en Ajustes -> Dispositivos y servicios -> Ecowitt -> Configurar, y se carga desde
// el panel del puente. Se hace así a propósito: ese identificador es lo único que protege ese
// webhook, y no tiene por qué pasar por la pantalla ni por el registro de una sesión.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VER = process.argv.includes('--ver')
const iArmar = process.argv.indexOf('--armar')
const AQUI = path.dirname(fileURLToPath(import.meta.url))
const DESTINO = iArmar !== -1 ? path.resolve(process.argv[iArmar + 1] || './build') : '//TU_IP_LAN/docker/ecowitt'
const PUERTO = 8088

// Todo lo que va a la imagen. Si mañana se agrega un módulo, va acá — el Dockerfile hace
// COPY *.mjs y no hay que tocarlo.
const PROPIOS = [
  'receptora.mjs', '_normalizar.mjs', '_destinos.mjs', '_recetas.mjs',
  '_sensores.mjs', '_config.mjs', '_panel.mjs', '_pagina.mjs', '_registro.mjs',
]
// El .dockerignore va SI O SI: sin él, el contexto de construcción se lleva datos/ y mqtt.env
// —o sea las credenciales de todos los destinos y la clave del broker— al motor de Docker, y
// en una imagen que después se comparta quedan adentro.
const SUELTOS = ['Dockerfile', '.dockerignore', 'docker-compose.yml', 'README.md']
const COMPARTIDOS = [[path.join(AQUI, '..', 'garnet', '_mqtt.mjs'), '_mqtt.mjs']]

/**
 * Escribe mqtt.env leyendo la clave del broker de la propia configuración de Home Assistant.
 *
 * LA CLAVE VA DIRECTO AL ARCHIVO, sin pasar por pantalla ni por el registro de la sesión. Misma
 * lección que en _secreto.mjs.
 *
 * SE ESCRIBE SIEMPRE, aunque no se pueda leer la clave: el docker-compose.yml lo declara en
 * env_file, y si el archivo falta el contenedor no arranca — con un error que no dice nada
 * sobre MQTT y manda a buscar el problema al lado equivocado.
 */
const escribirMqttEnv = (carpeta) => {
  const cfg = '//TU_HOST_HA/config/.storage/core.config_entries'
  const cabecera = [
    '# Generado por scripts/ecowitt/desplegar-nas.mjs. NO se versiona.',
    '# También se puede cargar el broker desde el panel del puente (Ajustes -> MQTT).',
  ]
  let lineas = cabecera.concat(['# No se pudo leer la configuración de HA al desplegar.', ''])
  try {
    if (fs.existsSync(cfg)) {
      const m = JSON.parse(fs.readFileSync(cfg, 'utf8')).data.entries.find(e => e.domain === 'mqtt')
      if (m) {
        lineas = cabecera.concat([
          'MQTT_HOST=TU_HOST_HA',
          'MQTT_PUERTO=' + (m.data.port || 1883),
          'MQTT_USUARIO=' + m.data.username,
          'MQTT_CLAVE=' + m.data.password,
          '',
        ])
        return { ruta: path.join(carpeta, 'mqtt.env'), texto: lineas.join('\n'), conClave: true }
      }
    }
  } catch {}
  return { ruta: path.join(carpeta, 'mqtt.env'), texto: lineas.join('\n'), conClave: false }
}

const main = () => {
  console.log('=== puente Ecowitt')
  console.log('    destino: ' + DESTINO + (VER ? '   [modo diagnóstico: no escribe]' : ''))
  console.log('')

  for (const f of [...PROPIOS, ...SUELTOS]) {
    const origen = path.join(AQUI, f)
    if (!fs.existsSync(origen)) { console.error('   FALTA ' + f); process.exit(1) }
    console.log('   ' + f.padEnd(24) + fs.statSync(origen).size + ' bytes')
  }
  for (const [origen, nombre] of COMPARTIDOS) {
    if (!fs.existsSync(origen)) { console.error('   FALTA ' + origen); process.exit(1) }
    console.log('   ' + nombre.padEnd(24) + 'compartido con garnet/')
  }
  console.log('   mqtt.env                 generado (con la clave, sin mostrarla)')

  if (VER) {
    console.log('\n   Correr sin --ver para copiar.')
    return
  }

  fs.mkdirSync(DESTINO, { recursive: true })
  const datos = path.join(DESTINO, 'datos')
  fs.mkdirSync(datos, { recursive: true })

  for (const f of [...PROPIOS, ...SUELTOS]) fs.copyFileSync(path.join(AQUI, f), path.join(DESTINO, f))
  for (const [origen, nombre] of COMPARTIDOS) fs.copyFileSync(origen, path.join(DESTINO, nombre))

  // El LEEME.md de la version anterior queda huerfano y dice cosas que ya no son ciertas.
  // Dos documentos que se contradicen son peores que uno solo.
  const leemeViejo = path.join(DESTINO, 'LEEME.md')
  if (fs.existsSync(leemeViejo)) {
    fs.unlinkSync(leemeViejo)
    console.log('\n   LEEME.md de la versión anterior borrado (lo reemplaza README.md)')
  }

  const env = escribirMqttEnv(DESTINO)
  fs.writeFileSync(env.ruta, env.texto)
  if (!env.conClave) {
    console.log('\n   OJO: no se pudo leer la clave del broker de HA.')
    console.log('   El archivo se creó igual (si falta, el contenedor no arranca).')
    console.log('   Cargar el broker desde el panel: Ajustes -> MQTT.')
  }

  // LA CONFIGURACION NO SE PISA NUNCA: ahí viven las credenciales de todos los destinos, y
  // sobrescribirla en cada despliegue las borraría justo cuando todo funcionaba.
  const conf = path.join(datos, 'config.json')
  if (fs.existsSync(conf)) {
    console.log('\n   datos/config.json YA EXISTE: no se toca')
  } else {
    // Un destinos.json de la versión anterior se muda a datos/, que es donde el puente lo
    // busca para migrarlo solo en el primer arranque. Sin esto, una instalación que ya
    // funcionaba se quedaría sin sus destinos y en silencio.
    const viejo = path.join(DESTINO, 'destinos.json')
    if (fs.existsSync(viejo)) {
      fs.copyFileSync(viejo, path.join(datos, 'destinos.json'))
      fs.renameSync(viejo, viejo + '.migrado')
      console.log('\n   destinos.json de la versión anterior movido a datos/ para migrarlo')
    }
  }

  console.log('\n=== copiado. Lo que sigue, a mano:')
  console.log('')
  console.log('  1. Container Manager -> Proyecto -> Crear')
  console.log('     ruta: docker/ecowitt     fuente: docker-compose.yml')
  console.log('     (construye la imagen; la primera vez tarda un minuto)')
  console.log('  2. Abrir el panel: http://TU_IP_LAN:' + PUERTO + '/')
  console.log('  3. Cuando llegue el GW3000: apuntarlo al NAS, puerto ' + PUERTO + ', ruta /data/report')
  console.log('  4. Cargar los destinos desde el panel, empezando por Home Assistant')
  console.log('')
  console.log('  El paso 4 va ULTIMO: primero que lleguen datos y se archiven, y recién')
  console.log('  después conectarlo a HA. Así, si algo falla, se sabe cuál de las dos mitades.')
}

main()
