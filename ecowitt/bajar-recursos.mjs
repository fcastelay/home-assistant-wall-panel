// Baja la tipografía y los iconos que pide el diseño, para servirlos desde el contenedor.
//
//   node bajar-recursos.mjs
//
// POR QUE SE BAJAN Y NO SE ENLAZAN
//
// El panel no puede pedirle nada a internet: su trabajo es decir si los datos están saliendo, y
// si para dibujarse necesita bajar una fuente de Google, el día que se corte internet —justo el
// día en que uno quiere mirarlo— aparece sin tipografía y sin iconos.
//
// El propio pliego de diseño lo anticipa: *"considerar self-hostear fuente e iconos"*. Acá no
// es una consideración, es la única opción.
//
// ESTO SE CORRE UNA VEZ, a mano, y lo que baja se versiona. No es parte del arranque del
// contenedor: un contenedor que necesita internet para levantar es exactamente lo que se está
// evitando.
//
// QUE BAJA
//
//   Source Serif 4, sólo los subconjuntos latin y latin-ext, en tres cortes (400, 600, itálica
//   400). Google sirve 18 variantes —cirílico, griego, vietnamita— que en un panel en español no
//   se usan nunca y pesarían cinco veces más.
//
//   Los iconos Phosphor en peso duotone, sólo los del mapa del pliego. Son SVG de menos de 1 KB
//   cada uno y se inyectan en la página; no se baja el paquete entero de 9.000 iconos.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const DESTINO = path.join(AQUI, 'recursos')

// Sólo estos dos subconjuntos. El resto de los que sirve Google no se usan en español.
const SUBCONJUNTOS = ['latin', 'latin-ext']

// Los iconos del mapa del pliego, más los que pide la navegación de un listado paginado.
const ICONOS = [
  'stack', 'check-circle', 'gauge', 'pulse',
  'thermometer-simple', 'wind', 'drop', 'cloud-rain', 'sun', 'cloud',
  'warning-circle', 'x-circle', 'clock', 'house', 'globe', 'broadcast',
  'list', 'magnifying-glass', 'caret-left', 'caret-right', 'sign-out', 'gear',
  'plus', 'arrow-left', 'dots-three',
]

const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const bajar = async (url, cabeceras = {}) => {
  const r = await fetch(url, { headers: { 'User-Agent': NAVEGADOR, ...cabeceras } })
  if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + url)
  return r
}

// ---------------------------------------------------------------- la tipografía

/**
 * Google devuelve un @font-face por corte Y por subconjunto, con un comentario arriba que dice
 * cuál es. Se parte por esos comentarios y se queda con los dos que importan.
 */
async function fuente () {
  const css = await (await bajar(
    'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap'
  )).text()

  const bloques = css.split('/*').slice(1).map(b => {
    const nombre = b.slice(0, b.indexOf('*/')).trim()
    const cuerpo = b.slice(b.indexOf('*/') + 2)
    return { nombre, cuerpo }
  })

  const caras = []
  for (const b of bloques) {
    if (!SUBCONJUNTOS.includes(b.nombre)) continue
    const url = (b.cuerpo.match(/https:\/\/[^)]+\.woff2/) || [])[0]
    const peso = (b.cuerpo.match(/font-weight:\s*(\d+)/) || [])[1] || '400'
    const estilo = /font-style:\s*italic/.test(b.cuerpo) ? 'italica' : 'normal'
    const rango = (b.cuerpo.match(/unicode-range:\s*([^;]+)/) || [])[1] || ''
    if (!url) continue
    caras.push({ url, peso, estilo, rango: rango.trim(), sub: b.nombre })
  }

  const lineas = [
    '/* Source Serif 4, bajada por bajar-recursos.mjs. Sólo latin y latin-ext. */',
    '/* Se sirve desde el propio contenedor: el panel no le pide nada a internet. */',
    '',
  ]
  let total = 0
  for (const c of caras) {
    const archivo = 'sourceserif-' + c.peso + '-' + c.estilo + '-' + c.sub + '.woff2'
    const datos = Buffer.from(await (await bajar(c.url)).arrayBuffer())
    fs.writeFileSync(path.join(DESTINO, archivo), datos)
    total += datos.length
    console.log('   ' + archivo.padEnd(44) + (datos.length / 1024).toFixed(1) + ' KB')
    lineas.push('@font-face {',
      '  font-family: "Source Serif 4";',
      '  font-style: ' + (c.estilo === 'italica' ? 'italic' : 'normal') + ';',
      '  font-weight: ' + c.peso + ';',
      '  font-display: swap;',
      '  src: url(/recursos/' + archivo + ') format("woff2");',
      '  unicode-range: ' + c.rango + ';',
      '}', '')
  }
  fs.writeFileSync(path.join(DESTINO, 'fuente.css'), lineas.join('\n'))
  return { caras: caras.length, total }
}

// ---------------------------------------------------------------- los iconos

/**
 * Los SVG duotone del repositorio oficial. Se guardan crudos y se limpian: el `width`, el
 * `height` y el `fill` fijos molestan cuando el color lo tiene que poner el CSS.
 */
async function iconos () {
  const salida = {}
  let total = 0, faltaron = []
  for (const n of ICONOS) {
    const url = 'https://raw.githubusercontent.com/phosphor-icons/core/main/assets/duotone/' +
      n + '-duotone.svg'
    try {
      let svg = await (await bajar(url)).text()
      // Se saca todo lo que impida que el color y el tamaño los ponga el CSS.
      svg = svg.replace(/<\?xml[^>]*\?>/g, '')
        .replace(/\s(width|height)="[^"]*"/g, '')
        .replace(/fill="#[0-9a-fA-F]{3,8}"/g, 'fill="currentColor"')
        .replace(/\s+/g, ' ').trim()
      salida[n] = svg
      total += svg.length
    } catch (e) { faltaron.push(n + ' (' + e.message + ')') }
  }
  fs.writeFileSync(path.join(DESTINO, 'iconos.json'), JSON.stringify(salida, null, 1))
  return { cuantos: Object.keys(salida).length, total, faltaron }
}

// ----------------------------------------------------------------

const main = async () => {
  fs.mkdirSync(DESTINO, { recursive: true })
  console.log('=== bajando a ' + DESTINO)
  console.log('')
  console.log('--- Source Serif 4 (latin y latin-ext)')
  const f = await fuente()
  console.log('   ' + f.caras + ' archivos, ' + (f.total / 1024).toFixed(0) + ' KB en total')

  console.log('')
  console.log('--- iconos Phosphor duotone')
  const i = await iconos()
  console.log('   ' + i.cuantos + ' de ' + ICONOS.length + ' iconos, ' +
    (i.total / 1024).toFixed(1) + ' KB en un solo JSON')
  if (i.faltaron.length) {
    console.log('   NO SE PUDIERON BAJAR: ' + i.faltaron.join(', '))
    console.log('   (revisar el nombre en phosphoricons.com; el archivo se llama <nombre>-duotone.svg)')
  }

  console.log('')
  console.log('=== lo que NO se baja acá, y hay que decidir:')
  console.log('   Las fotos de fondo. El pliego pide al menos 4, apaisadas 1600x900, y usa')
  console.log('   placeholders de picsum.photos. Bajar fotos de stock a un repositorio público')
  console.log('   arrastra su licencia: eso se elige, no se automatiza.')
}

main().catch(e => { console.error('falló: ' + e.message); process.exit(1) })
