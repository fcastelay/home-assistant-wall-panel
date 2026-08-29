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

/** Las camaras agrupadas por zona, como estaban. */
export function vistaCamaras (vieja) {
  const grupos = []
  for (const s of vieja.sections || []) {
    const titulo = (s.cards || []).find(c => c.type === 'heading')
    const camaras = (s.cards || []).filter(c => c.type === 'picture-entity')
    if (camaras.length) grupos.push({ titulo: titulo ? titulo.heading : '', camaras })
  }

  const secciones = grupos.map(g => ({
    type: 'grid',
    column_span: 2,
    cards: [
      rotulo(g.titulo),
      {
        // Siempre 2 columnas: con 3 quedaban chiquitas y sobraba media pantalla.
        type: 'grid',
        columns: 2,
        square: false,
        grid_options: { columns: 'full' },
        cards: g.camaras.map(c => restilarCamara({ ...c, aspect_ratio: '16:10' })),
      },
    ],
  }))

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
