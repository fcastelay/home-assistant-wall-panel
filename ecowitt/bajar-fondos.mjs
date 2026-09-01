// Baja las fotos de fondo del portal, con sus créditos.
//
//   node bajar-fondos.mjs                  las que usa el pliego de diseño
//   node bajar-fondos.mjs 1016 1043 984    otras, por id de Picsum
//   node bajar-fondos.mjs --ver            sólo muestra de quién son, sin bajar
//
// POR QUE SE BAJAN Y NO SE ENLAZAN
//
// Misma razón que la tipografía: el panel no puede pedirle nada a internet. Si los fondos
// vinieran de un CDN, el día que se corte la conexión —justo cuando uno quiere mirar si los
// datos salen— el portal aparece sin identidad. Y peor: un `img` que no carga deja el velo de
// legibilidad sobre nada y el texto puede quedar ilegible.
//
// DE DONDE SALEN Y CON QUE LICENCIA
//
// De Picsum, que sirve fotos de Unsplash y **dice de quién es cada una**. Eso importa porque
// este proyecto se publica: quien lo forkee hereda las imágenes, y una foto sin procedencia es
// un problema legal esperando. Por eso el script no baja nada sin escribir antes el archivo de
// créditos con el autor y el enlace al original.
//
// La licencia de Unsplash permite usarlas, incluso comercialmente, sin pedir permiso. No exige
// atribución — pero se pone igual: cuesta una línea y es lo correcto.
//
// LO QUE ESTE SCRIPT NO PUEDE HACER: mirar las fotos. Baja las que se le piden e imprime el
// enlace de cada una para que una persona las vea y cambie las que no sirvan. Un fondo de
// portal se elige mirándolo.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const DESTINO = path.join(AQUI, 'recursos', 'fondos')
const VER = process.argv.includes('--ver')

// Las cinco del pliego de diseño. Se pueden cambiar por argumento.
const IDS_POR_DEFECTO = ['1015', '1018', '1036', '1043', '1053']
const ids = process.argv.slice(2).filter(a => /^\d+$/.test(a))
const IDS = ids.length ? ids : IDS_POR_DEFECTO

// Dos medidas, las que pide el pliego. La vertical es para el layout mobile.
const MEDIDAS = [
  { nombre: 'ancho', w: 1600, h: 900 },
  { nombre: 'alto', w: 800, h: 1600 },
]

const bajar = async (url) => {
  const r = await fetch(url, { redirect: 'follow' })
  if (!r.ok) throw new Error('HTTP ' + r.status)
  return r
}

const main = async () => {
  fs.mkdirSync(DESTINO, { recursive: true })
  console.log('=== fondos del portal')
  console.log('')

  const fichas = []
  for (const id of IDS) {
    try {
      const info = await (await bajar('https://picsum.photos/id/' + id + '/info')).json()
      fichas.push(info)
      console.log('   ' + String(id).padEnd(6) + String(info.author || '?').padEnd(26) + info.url)
    } catch (e) {
      console.log('   ' + String(id).padEnd(6) + 'NO SE PUDO: ' + e.message)
    }
  }

  console.log('')
  console.log('   Abrí esos enlaces y mirá las fotos. Este script no puede verlas: si alguna no')
  console.log('   sirve para un fondo de portal, corré de nuevo con otros ids.')

  if (VER) { console.log('\n   (modo --ver: no se bajó nada)'); return }

  console.log('')
  let total = 0
  for (const f of fichas) {
    for (const m of MEDIDAS) {
      const archivo = 'fondo-' + f.id + '-' + m.nombre + '.webp'
      const datos = Buffer.from(await (await bajar(
        'https://picsum.photos/id/' + f.id + '/' + m.w + '/' + m.h + '.webp')).arrayBuffer())
      fs.writeFileSync(path.join(DESTINO, archivo), datos)
      total += datos.length
      console.log('   ' + archivo.padEnd(30) + (datos.length / 1024).toFixed(0) + ' KB   ' +
        m.w + 'x' + m.h)
    }
  }

  // LOS CREDITOS SE ESCRIBEN SIEMPRE, y antes de dar el trabajo por terminado. Una foto sin
  // procedencia en un repositorio publico es un problema esperando a que alguien lo encuentre.
  const creditos = [
    '# Créditos de las fotos de fondo',
    '',
    'Bajadas con `node scripts/ecowitt/bajar-fondos.mjs`.',
    '',
    'Vienen de [Picsum](https://picsum.photos), que sirve fotografías de',
    '[Unsplash](https://unsplash.com). La licencia de Unsplash permite usarlas, incluso',
    'comercialmente, sin pedir permiso y sin exigir atribución. **Se atribuye igual**: cuesta una',
    'línea y es lo correcto.',
    '',
    '| Archivo | Autor | Original |',
    '|---|---|---|',
    ...fichas.map(f => '| `fondo-' + f.id + '-*.webp` | ' + (f.author || '?') +
      ' | [' + f.url.replace('https://unsplash.com/photos/', '') + '](' + f.url + ') |'),
    '',
    '## Si las cambiás',
    '',
    'Corré el script con otros ids y este archivo se regenera:',
    '',
    '```',
    'node scripts/ecowitt/bajar-fondos.mjs 1016 1043 984 1024',
    '```',
    '',
    'O poné fotos propias en esta carpeta con el mismo nombre y borrá las filas de acá. Fotos',
    'propias del cielo de tu casa quedan mejor que cualquier banco de imágenes, y no tienen',
    'ninguna letra chica.',
    '',
    '## Peso',
    '',
    'El portal rota cuatro fondos con transición. Si los cuatro se cargan de entrada son casi',
    'un megabyte en la primera visita, y este panel suele vivir en una tablet vieja colgada en',
    'la pared. **Cargar sólo el primero y los otros tres en diferido.**',
    '',
  ]
  fs.writeFileSync(path.join(DESTINO, 'CREDITOS.md'), creditos.join('\n'))

  console.log('')
  console.log('=== ' + fichas.length + ' fotos, ' + (total / 1024 / 1024).toFixed(1) + ' MB en total')
  console.log('    créditos escritos en recursos/fondos/CREDITOS.md')
}

main().catch(e => { console.error('falló: ' + e.message); process.exit(1) })
