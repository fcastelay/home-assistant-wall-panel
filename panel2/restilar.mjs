// Transformaciones sobre las tarjetas del panel viejo.
//
// Varias vistas del handoff son "el diseño actual con los tokens nuevos". Para
// esas conviene TRANSFORMAR la tarjeta existente en vez de reescribirla: asi no
// se pierde ningun tap_action, template ni entidad por descuido.

import { T, R, alfa, tarjeta } from './diseno.mjs'

/** Rotulo de seccion, el reemplazo de mushroom-title-card. */
export const rotulo = (texto, derecha = '') => tarjeta({
  grid: { columns: 'full' },
  relleno: '0 6px',
  fondo: 'transparent', borde: 'transparent', radio: 0,
  html: `<div style="display:flex;justify-content:space-between;align-items:baseline">
    <span style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">${texto}</span>
    ${derecha ? `<span style="font-size:14px;color:${T.texto3}">${derecha}</span>` : ''}
  </div>`,
})

/** Le pone el marco nuevo a una tarjeta nativa que se conserva tal cual. */
export const marco = (carta, extra = '') => ({
  ...carta,
  card_mod: {
    style: `ha-card {
      background: ${T.tarjeta} !important;
      border: 1px solid ${T.borde} !important;
      border-radius: ${R.grande}px !important;
      box-shadow: none !important;
      backdrop-filter: blur(6px);
    }
    ${extra}`,
  },
})

/** Saca el color de acento de un button-card de escena del panel viejo. */
export function colorDeEscena (carta) {
  const reglas = (carta.styles && carta.styles.card) || []
  for (const r of reglas) {
    const v = r['border-left'] || r.border || r.background
    const m = v && String(v).match(/#[0-9a-f]{6}/i)
    if (m) return m[0]
  }
  return T.acento
}

/**
 * Escena: mismo entity y misma llamada a script, look nuevo.
 * Circulo lleno 44px del color + nombre 19px + borde izquierdo 6px (DISENO).
 */
export function restilarEscena (carta, alto = '92px') {
  const color = colorDeEscena(carta)
  return tarjeta({
    entidad: carta.entity,
    tap: carta.tap_action,
    hold: carta.hold_action || { action: 'more-info' },
    radio: R.media,
    relleno: '16px 18px',
    alto,
    fondo: color + '1f',
    borde: color + '66',
    bordeIzq: `6px solid ${color}`,
    html: `<div style="display:flex;align-items:center;gap:14px;height:100%">
      <span style="width:44px;height:44px;border-radius:50%;background:${color};flex:none"></span>
      <span style="font-size:17px;font-weight:600;color:${T.texto};line-height:1.2;overflow-wrap:anywhere">${carta.name || ''}</span>
    </div>`,
  })
}

/**
 * Ambiente (vista Habitaciones): la tarjeta con foto de fondo ya tiene el
 * diseño bueno; solo cambian radios, tipografia y el tinte de los chips.
 */
export function restilarAmbiente (carta, alto = '220px') {
  const reemplazos = [
    // El .45 que pide el DISENO se lee mal sobre los recortes claros del
    // floorplan: se queda en .55 y el contraste lo da el text-shadow de abajo.
    [/border-radius:14px/g, 'border-radius:12px'],
    [/#98a1ac/g, T.texto3],
    [/#ffc65c/g, T.ambar],
    [/#ff6b6b/g, T.peligro],
    [/color:#fff/g, `color:${T.texto}`],
  ]
  const campos = {}
  for (const [k, v] of Object.entries(carta.custom_fields || {})) {
    campos[k] = typeof v === 'string'
      ? reemplazos.reduce((txt, [re, x]) => txt.replace(re, x), v)
      : v
  }

  const cardStyles = ((carta.styles && carta.styles.card) || []).map(r => {
    if ('border-radius' in r) return { 'border-radius': R.media + 'px' }
    if ('height' in r) return { height: alto }
    return r
  })

  return {
    ...carta,
    extra_styles: `
      * { box-sizing: border-box; }
      #temp, #hum, #info { text-shadow: 0 1px 6px rgba(0,0,0,.9); }
      #info { font-family: ${T.plex}; }
    `,
    custom_fields: campos,
    styles: { ...carta.styles, card: cardStyles },
  }
}

/** Camara: radio nuevo, nombre abajo-izquierda y chapita EN VIVO arriba. */
export function restilarCamara (carta) {
  return {
    ...carta,
    card_mod: {
      style: `
        ha-card {
          border-radius: ${R.media}px !important;
          border: 1px solid ${T.borde} !important;
          box-shadow: none !important;
          overflow: hidden;
          position: relative;
        }
        ha-card::before {
          content: "EN VIVO";
          position: absolute;
          top: 12px; left: 12px;
          z-index: 2;
          display: flex; align-items: center; gap: 7px;
          background: rgba(8,13,26,.72);
          border: 1px solid ${alfa(T.peligro, 0.4)};
          color: ${T.texto};
          font-family: ${T.plex};
          font-size: 11px; font-weight: 600; letter-spacing: 1.2px;
          padding: 5px 10px 5px 22px;
          border-radius: 99px;
        }
        ha-card::after {
          content: "";
          position: absolute;
          top: 19px; left: 22px;
          z-index: 3;
          width: 7px; height: 7px;
          border-radius: 50%;
          background: ${T.peligro};
          animation: p2-vivo 1.6s infinite;
        }
        @keyframes p2-vivo { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
        .footer, hui-image + div, .box {
          background: linear-gradient(0deg, rgba(8,13,26,.85), transparent) !important;
          font-family: ${T.plex} !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          color: ${T.texto} !important;
          text-align: left !important;
          padding: 18px 16px 12px !important;
        }
      `,
    },
  }
}
