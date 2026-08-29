// Vista "Mas": el cajon de las seis vistas que salieron de la barra.
//
// POR QUE EXISTE
//
// La barra tenia CATORCE rutas. En una pantalla vertical eso son catorce iconos de 26 px
// apretados en una fila: nadie apunta bien, y las que se usan todos los dias —Inicio,
// Luces, Alarma— quedan al mismo nivel que la factura de la EPE, que se mira una vez cada
// dos meses.
//
// La barra bajo a nueve y las otras seis viven aca. **Las vistas no se tocaron**: siguen
// existiendo con su misma ruta y se llega igual escribiendo la URL. Lo unico que cambio es
// que dejaron de ocupar un lugar fijo en la barra.
//
// LOS ICONOS SON LOS DE LAS TABLAS de NAVBAR-Y-MAS.md e ICONOS-PANEL-COMPLETO.md,
// exactos. Son PNG servidos desde /local/iconos/color/ (ver scripts/panel2/bajar-iconos.mjs).

import { T, R, js, tarjeta, aire, cuadro, fondoOlas } from '../diseno.mjs'
import { navbar } from '../navbar.mjs'
import { rotulo } from '../restilar.mjs'

// nombre, subtitulo, icono MDI, ruta destino, color.
//
// UN COLOR POR TARJETA. La primera version las puso todas en acento, razonando que "son
// puertas, no informan nada". Persona 1 pidio lo contrario y tiene razon practica: seis
// tarjetas identicas obligan a LEER cada una para encontrar la que se busca. Con un color
// distinto se reconocen por posicion y tono, sin leer.
//
// Son los mismos tonos que la barra, para que Redes se vea igual aca que alla.
const DESTINOS = [
  ['Aparatos', 'Pedro y freidora', 'robot.png', 'aparatos', '#57c7ff'],
  ['Camioneta', 'Ranger XLT', 'camioneta.png', 'camioneta', '#ffc14f'],
  ['Factura EPE', 'Bimestre y boletas', 'recibo.png', 'factura-epe', '#ff9dc4'],
  ['Sausalito', 'La otra casa', 'casitas.png', 'sausalito', '#5fe0a0'],
  ['Redes', 'Equipos y estado', 'red.png', 'redes', '#7ba9ff'],
  ['Rutinas', 'Automatizaciones', 'engranaje.png', 'automatizaciones', '#c58bff'],
]

/**
 * Una tarjeta de navegacion.
 *
 * Mismo molde que las acciones rapidas de Inicio: caja de icono de 48 px, nombre de 18 px
 * y subtitulo. Se repite el estilo a proposito, para que se entienda que se tocan igual.
 *
 * El icono es un PNG a color de Fluent Emoji, de 30 px, sobre la caja tintada al 12 % con
 * el color de la tarjeta. El tinte se conserva aunque el icono ya traiga color propio: es
 * lo que agrupa visualmente la caja con el nombre y lo que hace que las seis se distingan
 * de un vistazo sin leerlas.
 */
const destino = ([nombre, sub, imagen, ruta, color]) => tarjeta({
  tap: { action: 'navigate', navigation_path: `/panel-vertical-2/${ruta}` },
  radio: 22,
  relleno: '22px 24px',
  alto: '88px',
  html: js(`
    return '<div style="display:flex;align-items:center;gap:14px;width:100%">'
      + '<span style="width:48px;height:48px;border-radius:14px;background:${color}1f;'
      +   'display:grid;place-items:center;flex:none">'
      +   '<img src="/local/iconos/color/${imagen}" width="30" height="30" style="display:block">'
      + '</span>'
      + '<span style="min-width:0">'
      +   '<span style="display:block;font-size:18px;font-weight:600;color:${T.texto};line-height:1.2">${nombre}</span>'
      +   '<span style="display:block;font-size:13.5px;color:${T.texto2};margin-top:3px">${sub}</span>'
      + '</span>'
      + '</div>';
  `),
})

export function vistaMas () {
  return {
    title: 'Más',
    path: 'mas',
    icon: 'mdi:dots-horizontal',
    type: 'sections',
    max_columns: 2,
    theme: 'Vidrio Animado',
    background: fondoOlas(),
    sections: [
      {
        type: 'grid',
        column_span: 2,
        cards: [
          rotulo('Más', DESTINOS.length + ' vistas'),
          // `cuadro()` (el protector de pantalla) va ACA y no en su propia seccion: solo,
          // se dibujaba como una tarjeta vacia debajo de la grilla. En el resto de las
          // vistas siempre acompaña al encabezado, por esto mismo.
          cuadro(),
          {
            type: 'grid',
            columns: 2,
            square: false,
            grid_options: { columns: 'full' },
            cards: DESTINOS.map(destino),
          },
        ],
      },
      { type: 'grid', column_span: 2, cards: [aire(120), navbar()] },
    ],
  }
}
