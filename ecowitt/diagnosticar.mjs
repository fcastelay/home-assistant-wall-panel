// Por qué no levanta el contenedor: se le pregunta al DSM en vez de suponer.
//
//   node scripts/ecowitt/diagnosticar.mjs
//   node scripts/ecowitt/diagnosticar.mjs --otp 123456
//   node scripts/ecowitt/diagnosticar.mjs --contenedor otro-nombre
//
// POR QUE EXISTE
//
// Un contenedor que no arranca en Container Manager muestra un cartel de dos líneas y manda a
// buscar el registro a mano, con el navegador, entrando a la interfaz del NAS. Desde acá no se
// llega ni por Samba —el registro no es un archivo de la carpeta compartida— así que la
// alternativa era adivinar. Adivinar por qué falla algo que tiene el motivo escrito en su
// propio registro es exactamente lo que este proyecto no hace.
//
// NO SE VUELCA NUNCA LA RESPUESTA ENTERA, y esto es una cicatriz del 01/09/2026.
//
// `SYNO.Docker.Container.get` devuelve `details`, y ahí adentro viene `Config.Env` con TODAS
// las variables del contenedor — incluida la clave del broker MQTT. La primera versión de este
// script la imprimió. El filtro del cliente de Synology tapa la clave del DSM, no las de
// adentro de una respuesta exitosa: **el que llama tiene que elegir qué muestra**. Por eso acá
// se enumeran los campos uno por uno y no hay ningún JSON.stringify de un objeto completo.
//
// LOS NOMBRES DE LA API DE CONTAINER MANAGER NO ESTAN DOCUMENTADOS, así que primero se le
// pregunta al DSM qué tiene (SYNO.API.Info). Medido en este NAS el 01/09/2026:
//
//     SYNO.Docker.Container.Log   metodo `get`    (no `list`: da 103)
//     SYNO.Docker.Container       metodo `get`    con { name }
//     SYNO.Docker.Log             no sirve para esto

import { entrar, salir, llamar } from '../synology/_api.mjs'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const CONTENEDOR = arg('contenedor', 'ecowitt-puente')

const titulo = (t) => console.log('\n=== ' + t)

/** Los códigos de salida que dicen algo. Sin esto, "ExitCode 1" no orienta a ningún lado. */
const EXPLICAR_SALIDA = {
  0: 'salió bien (o lo pararon)',
  1: 'el programa lanzó una excepción — el motivo está en el registro',
  126: 'el ejecutable de arranque no tiene permiso de ejecución',
  127: 'no existe el ejecutable de arranque (¿falta un archivo en la imagen?)',
  137: 'lo mataron (SIGKILL). Si OOMKilled es true, se quedó sin memoria',
  139: 'segmentación: falla del propio Node, no del programa',
  143: 'lo pararon (SIGTERM). Es lo normal al detenerlo a mano',
}

const main = async () => {
  const e = await entrar()
  if (!e.ok) {
    console.error('No se pudo entrar al DSM: ' + e.error)
    if (e.codigo === 403 || e.codigo === 406) console.error('Pasar el código de dos pasos:  --otp 123456')
    process.exit(1)
  }

  try {
    // --- 1. el contenedor existe y en qué estado está
    titulo('El contenedor ' + CONTENEDOR)
    const lista = await llamar('SYNO.Docker.Container', 'list', 1, { limit: '-1', offset: '0' })
    if (!lista.ok) { console.log('    no se pudo listar: ' + lista.error); return }
    const c = (lista.datos.containers || []).find(x => x.name === CONTENEDOR)
    if (!c) {
      console.log('    NO EXISTE. Hay ' + (lista.datos.containers || []).length + ' contenedores en el NAS:')
      console.log('    ' + (lista.datos.containers || []).map(x => x.name).join(', '))
      console.log('\n    Si el proyecto está creado pero el contenedor no, falló la CONSTRUCCION')
      console.log('    de la imagen. Ese registro está en el proyecto, no acá.')
      return
    }
    console.log('    imagen    ' + c.image)
    console.log('    estado    ' + c.status)

    const det = await llamar('SYNO.Docker.Container', 'get', 1, { name: CONTENEDOR })
    // Campo por campo, a mano y a propósito. Ver el comentario de arriba.
    const s = det.ok ? (det.datos.details?.State || {}) : {}
    if (s.Status) {
      console.log('    arrancó   ' + String(s.StartedAt).slice(0, 19).replace('T', ' '))
      console.log('    murió     ' + String(s.FinishedAt).slice(0, 19).replace('T', ' '))
      console.log('    salida    ' + s.ExitCode + '   ' + (EXPLICAR_SALIDA[s.ExitCode] || ''))
      if (s.OOMKilled) console.log('    SE QUEDO SIN MEMORIA')
      if (s.Error) console.log('    error     ' + s.Error)
      if (s.Health?.Status) console.log('    salud     ' + s.Health.Status)
      const vida = new Date(s.FinishedAt) - new Date(s.StartedAt)
      if (vida > 0 && vida < 5000) {
        console.log('')
        console.log('    Vivió ' + (vida / 1000).toFixed(1) + ' s. Morir tan rápido es casi siempre el arranque:')
        console.log('    un archivo que falta, un permiso, o una variable de entorno.')
      }
    }

    // --- 2. EL REGISTRO, que es lo que se vino a buscar
    titulo('Registro del contenedor')
    const log = await llamar('SYNO.Docker.Container.Log', 'get', 1,
      { name: CONTENEDOR, limit: 120, offset: 0 })
    if (!log.ok) {
      console.log('    no se pudo leer: ' + log.error)
    } else if (!(log.datos.logs || []).length) {
      console.log('    VACIO (' + log.datos.total + ' líneas).')
      console.log('')
      console.log('    Un contenedor que muere sin dejar registro suele ser una de dos:')
      console.log('      - el compose ANULA el driver de registro (logging: json-file). Entonces')
      console.log('        el DSM no lo indexa y su pestaña Registro aparece vacía. Pasó el')
      console.log('        01/09/2026 y por eso el compose ya no lo anula.')
      console.log('      - el arranque falla antes de que el programa escriba nada.')
    } else {
      for (const l of (log.datos.logs || []).slice().reverse()) {
        const t = String(l.created || l.time || '').slice(0, 19).replace('T', ' ')
        console.log('    ' + t + '  ' + String(l.stream ?? l.log ?? l.message ?? '').trimEnd())
      }
    }
  } finally {
    await salir()
  }
}

main()
