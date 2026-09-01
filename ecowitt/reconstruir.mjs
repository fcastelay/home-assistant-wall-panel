// Reconstruye el proyecto del puente en Container Manager, sin tocar la interfaz del NAS.
//
//   node scripts/ecowitt/reconstruir.mjs           detiene, compila y arranca
//   node scripts/ecowitt/reconstruir.mjs --ver     dice qué haría, sin tocar nada
//   node scripts/ecowitt/reconstruir.mjs --otp 123456
//
// POR QUE HACE FALTA CADA VEZ QUE CAMBIA UNA LINEA DE CODIGO
//
// El código del puente **va dentro de la imagen**, no montado desde la carpeta. Eso es
// deliberado —el contenedor no tiene por qué poder reescribir su propio programa— pero tiene
// una consecuencia que conviene tener presente: copiar los archivos al NAS no alcanza. Hasta
// que la imagen no se vuelve a construir, el contenedor sigue corriendo la versión anterior.
//
// Reiniciar el contenedor tampoco sirve: reinicia la imagen vieja.
//
// DONDE ESTA EL BOTON EN LA INTERFAZ, que fue la pregunta del 01/09/2026: **en la pestaña
// Proyecto, no en Contenedor.** Se selecciona el proyecto, y ahí aparece "Acción → Compilar".
// Desde la pestaña Contenedor no existe, porque un contenedor suelto no tiene con qué
// compilarse. El proyecto de esta casa se llama `ecowittbridge` y no `ecowitt`.
//
// LO QUE ESTE SCRIPT NO HACE, y no es un olvido: no borra el proyecto ni lo "limpia". Esas dos
// operaciones existen en la API y se dejaron afuera a propósito. Reconstruir es rutina; borrar
// es una decisión, y una decisión no se toma desde un script que uno corre sin leer.

import { entrar, salir, llamar } from '../synology/_api.mjs'

const VER = process.argv.includes('--ver')
const NOMBRE = 'ecowittbridge'

const dormir = (ms) => new Promise(r => setTimeout(r, ms))

/** Busca el proyecto por nombre. La API devuelve un mapa por id, no una lista. */
const buscarProyecto = async () => {
  // OJO: `list` con limit/offset devuelve VACIO. Sin parámetros, devuelve el mapa completo.
  // Medido el 01/09/2026 — con los parámetros puestos parecía que no había ningún proyecto.
  const r = await llamar('SYNO.Docker.Project', 'list', 1, {})
  if (!r.ok) return { error: 'no se pudo listar: ' + r.error }
  const todos = Object.values(r.datos || {})
  const p = todos.find(x => x.name === NOMBRE) || todos.find(x => /ecowitt/i.test(x.name || ''))
  if (!p) {
    return {
      error: 'no hay ningún proyecto de Ecowitt. Hay: ' +
        (todos.map(x => x.name).join(', ') || 'ninguno'),
    }
  }
  return { id: p.id, nombre: p.name, ruta: p.path, estado: p.status }
}

const paso = async (metodo, id, texto) => {
  process.stdout.write('    ' + texto.padEnd(34))
  const r = await llamar('SYNO.Docker.Project', metodo, 1, { id })
  console.log(r.ok ? 'ok' : 'no  (' + r.error + ')')
  return r.ok
}

const main = async () => {
  const e = await entrar()
  if (!e.ok) {
    console.error('No se pudo entrar al DSM: ' + e.error)
    if (e.codigo === 403 || e.codigo === 406) console.error('Pasar el código de dos pasos:  --otp 123456')
    process.exit(1)
  }

  try {
    const p = await buscarProyecto()
    if (p.error) { console.error(p.error); process.exit(1) }

    console.log('=== proyecto ' + p.nombre)
    console.log('    ruta    ' + p.ruta)
    console.log('    estado  ' + p.estado)

    if (VER) {
      console.log('\n    Se detendría, compilaría y arrancaría. Correr sin --ver.')
      return
    }

    console.log('')
    await paso('stop', p.id, 'deteniendo')
    // Un momento antes de compilar: si el contenedor todavía está bajando, el build encuentra
    // el nombre ocupado y falla con un error que no dice nada de eso.
    await dormir(3000)

    // `build` es lo que hace el botón Compilar: reconstruye la imagen y recrea el contenedor.
    // Si el nombre del método cambiara entre versiones de DSM, se prueba el otro y se dice.
    let compilado = await paso('build', p.id, 'compilando la imagen')
    if (!compilado) compilado = await paso('up', p.id, 'levantando (up)')
    if (!compilado) {
      console.log('\n    No se pudo compilar por la API. A mano, en el NAS:')
      console.log('    Container Manager -> pestaña PROYECTO -> ' + p.nombre + ' -> Acción -> Compilar')
      console.log('    (en la pestaña Contenedor ese botón no existe)')
      return
    }

    // La construcción tarda: apk add, el COPY y el chown. Se espera antes de arrancar.
    console.log('    esperando a que termine...')
    await dormir(25000)
    await paso('start', p.id, 'arrancando')

    console.log('\n    Ahora:  node scripts/ecowitt/diagnosticar.mjs')
  } finally {
    await salir()
  }
}

main()
