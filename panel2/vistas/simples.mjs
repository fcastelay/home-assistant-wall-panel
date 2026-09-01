// Vistas que el handoff define como "el diseño actual con los tokens nuevos":
// Ambientes, Cámaras y Escenas. Se transforman las tarjetas del panel viejo en
// vez de reescribirlas, para no perder ninguna accion ni entidad.

import { T, R, aire, cuadro, fondoOlas, tarjeta } from '../diseno.mjs'
import { navbar } from '../navbar.mjs'
import { rotulo, marco, restilarAmbiente, restilarCamara, restilarEscena } from '../restilar.mjs'

const base = (title, path, icon) => ({
  title,
  path,
  icon,
  type: 'sections',
  max_columns: 2,
  theme: 'Vidrio Animado',
  background: fondoOlas(),
})

// ------------------------------------------------------------- Ambientes

/** Grilla 2×7 con las fotos del floorplan y las camaras. */
export function vistaAmbientes (vieja) {
  const ambientes = []
  for (const s of vieja.sections || []) {
    for (const c of s.cards || []) if (c.type === 'custom:button-card' && c.custom_fields) ambientes.push(c)
  }

  return {
    ...base('Ambientes', 'habitaciones', 'mdi:floor-plan'),
    sections: [
      { type: 'grid', column_span: 2, cards: [rotulo('Ambientes', ambientes.length + ' lugares'), cuadro()] },
      {
        type: 'grid',
        column_span: 2,
        cards: [{
          type: 'grid',
          columns: 2,
          square: false,
          grid_options: { columns: 'full' },
          cards: ambientes.map(c => restilarAmbiente(c, '212px')),
        }],
      },
      { type: 'grid', column_span: 2, cards: [aire(120), navbar()] },
    ],
  }
}

// --------------------------------------------------------------- Cámaras

// LA LISTA ES EXPLICITA, y dejo de derivarla del panel viejo. Cambio del 31/08/2026.
//
// Antes se tomaban las camaras de las secciones del tablero anterior y se parcheaban. Con
// cuatro correcciones encima —dos que salen, dos que entran, y los nombres— el codigo decia
// una cosa y la pantalla mostraba otra. Declararlas es mas corto y no miente.
//
// QUE CAMARA ENTRA Y POR QUE, medido con `scripts/ha/auditar-camaras.mjs`:
//
//     patio_nest, cocina_nest, portero_nest   nest    NO dan foto fija, si video     -> live
//     patio, czha_..._lavadero                ezviz   foto de 28 y 26 KB             -> sirven
//
// QUE QUEDA AFUERA, y ninguna es capricho:
//
//     salon, puerta_principal, cocina,
//     habitacion                              canary  HTTP 500: ni foto ni video
//     terraza_2, sausalito_garage             ezviz   HTTP 500, y ademas son de otra casa
//
// **Las Canary fallan en silencio**: la entidad dice `recording`, sin `unavailable` y sin una
// linea en el log. Parecen sanas y dibujan un rectangulo gris. Mientras esa integracion no se
// arregle, no van: un hueco gris en la pared es peor que una camara menos.
//
// Si alguna vuelve, correr el auditor y agregarla aca.
const GRUPOS = [
  {
    titulo: 'Afuera',
    // Cuatro entran en una grilla de 2x2 exacta. Es la razon de que Portero este aca y no en
    // un grupo "Accesos" propio: un grupo de uno deja la mitad de la fila vacia.
    camaras: [
      ['camera.patio_nest', 'Patio'],
      ['camera.patio', 'Patio Casa'],
      ['camera.portero_nest', 'Portero'],
      // "Galeria" y no "Camara Galeria Lavadero": el nombre largo no entra en media columna
      // y se corta con puntos suspensivos.
      ['camera.czha_ara_galerqian_lavadero', 'Galería'],
    ],
  },
  {
    titulo: 'Adentro',
    // Una sola: va a ancho completo y mas panoramica. Dejarla en media columna con el hueco
    // al lado se lee como si faltara una camara.
    camaras: [['camera.cocina_nest', 'Cocina']],
  },
]

const camara = (ent, nombre) => ({
  type: 'picture-entity',
  entity: ent,
  name: nombre,
  camera_view: 'auto',   // `restilarCamara` lo pasa a `live` en las que solo transmiten
  show_state: false,
})

/** Las camaras que de verdad muestran algo, agrupadas por zona. */
export function vistaCamaras () {
  const secciones = GRUPOS.map(g => {
    const solaUna = g.camaras.length === 1
    return {
      type: 'grid',
      column_span: 2,
      cards: [
        rotulo(g.titulo),
        {
          type: 'grid',
          columns: solaUna ? 1 : 2,
          square: false,
          grid_options: { columns: 'full' },
          cards: g.camaras.map(([e, n]) =>
            restilarCamara({ ...camara(e, n), aspect_ratio: solaUna ? '16:9' : '16:10' })),
        },
      ],
    }
  })

  return {
    ...base('Cámaras', 'camaras', 'mdi:cctv'),
    sections: [
      ...secciones,
      { type: 'grid', column_span: 2, cards: [cuadro(), aire(120), navbar()] },
    ],
  }
}

// --------------------------------------------------------------- Escenas

/**
 * Escenas: se recorren las secciones viejas respetando el orden
 * titulo → grilla de escenas, y se restilan las piezas una por una.
 */
export function vistaEscenas (vieja) {
  const secciones = []

  for (const s of vieja.sections || []) {
    const cards = []
    for (const c of s.cards || []) {
      if (c.type === 'custom:cuadro-card' || c.type === 'custom:liquid-lens-navbar-card') continue

      if (c.type === 'custom:mushroom-title-card') {
        cards.push(rotulo(c.title || c.subtitle || ''))
      } else if (c.type === 'grid' && (c.cards || []).some(x => x.type === 'custom:button-card')) {
        cards.push({
          ...c,
          columns: 2,
          square: false,
          grid_options: { columns: 'full' },
          cards: c.cards.map(x => (x.type === 'custom:button-card' ? restilarEscena(x) : x)),
        })
      } else {
        cards.push(marco({ ...c, grid_options: { columns: 'full' } }))
      }
    }
    if (cards.length) secciones.push({ type: 'grid', cards })
  }

  return {
    ...base('Escenas', 'escenas', 'mdi:palette'),
    sections: [
      ...secciones,
      { type: 'grid', column_span: 2, cards: [cuadro(), aire(120), navbar()] },
    ],
  }
}
