// Tokens y piezas base del Panel Vertical 2.
// Spec: Panel 2v/design_handoff_panel_ha/DISENO.md
//
// El fondo animado (/local/olas/actual.svg) se conserva, asi que las tarjetas
// van TRANSLUCIDAS (rgba) en vez del #0f1730 plano del prototipo.

export const T = {
  // Superficies
  pagina:      '#080d1a',
  tarjeta:     'rgba(15,23,48,.85)',
  tarjetaAlta: 'rgba(15,23,48,.94)',   // cuando arriba hay texto chico
  borde:       'rgba(139,147,255,.14)',
  bordeFuerte: 'rgba(139,147,255,.28)',
  fill:        'rgba(139,147,255,.07)',
  fillAlto:    'rgba(139,147,255,.12)',

  // Texto
  texto:  '#e8ecf7',
  texto2: '#8b93b8',
  texto3: '#6b74a0',

  // Roles
  acento:   '#8b93ff',
  acentoFg: '#0a0f22',
  ok:       '#34c77b',
  okTexto:  '#5fe0a0',
  okFill:   'rgba(52,199,123,.12)',
  okBorde:  'rgba(52,199,123,.30)',
  alerta:   '#ffc14f',
  peligro:  '#ff4d6d',
  info:     '#57c7ff',

  // Extras graficos
  rosa:  '#ff6b81',
  lila:  '#c58bff',
  lima:  '#e8f06e',
  ambar: '#e0a856',

  // Tipografia
  // Sin comillas: estos strings se incrustan dentro de atributos style="..."
  // de HTML que a su vez viven dentro de strings JS con comillas simples.
  // CSS acepta nombres de familia sin comillas aunque tengan espacios.
  sora: 'Sora,system-ui,sans-serif',
  plex: 'IBM Plex Sans,system-ui,sans-serif',
}

// Radios y espaciados
export const R = { grande: 24, media: 20, chica: 14, pill: 99 }

/** rgba() a partir de un hex y un alfa. */
export function alfa (hex, a) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/**
 * Envuelve codigo JS como plantilla de button-card.
 *
 * DOS TRAMPAS QUE YA COSTARON TIEMPO TRES VECES. Las dos dan un error de sintaxis que
 * **apunta a una linea que no tiene nada que ver**, asi que se pierde el rato buscando
 * donde no es:
 *
 *   1. NINGUN COMENTARIO DE ADENTRO PUEDE LLEVAR ACENTO GRAVE. Un `asi` en un comentario
 *      cierra el template a la mitad. Escribir los nombres de codigo sin comillas.
 *
 *   2. PARA INTERPOLAR UNA CONSTANTE DEL BUILD va ${LA_CONSTANTE} a secas. Envolverla en
 *      comillas —${'...'}— emite el texto literal y el JSON sale con el marcador puesto.
 */
export const js = (codigo) => `[[[ ${codigo.trim()} ]]]`

/**
 * Tarjeta cruda: un button-card que solo dibuja el HTML que le pasamos.
 * Es la pieza con la que se construye casi todo el panel.
 */
export function tarjeta ({
  html,                 // string HTML fijo, o js(...) para contenido dinamico
  entidad,              // entity: dispara el re-render cuando cambia
  tap = { action: 'none' },
  hold,
  doble,
  grid,                 // grid_options
  alto,                 // height fijo de la tarjeta
  relleno = '22px 24px',
  radio = R.grande,
  fondo = T.tarjeta,
  borde = T.borde,
  bordeIzq,             // '4px solid #xxx' para las stat-cards
  extraCard = [],
} = {}) {
  const card = [
    { padding: '0' },
    { 'border-radius': radio + 'px' },
    { background: fondo },
    { border: `1px solid ${borde}` },
    { 'backdrop-filter': 'blur(6px)' },
    { overflow: 'hidden' },
    ...(alto ? [{ height: alto }] : []),
    ...(bordeIzq ? [{ 'border-left': bordeIzq }] : []),
    ...extraCard,
  ]
  const c = {
    type: 'custom:button-card',
    show_icon: false,
    show_name: false,
    show_state: false,
    // Sin esto, un hijo con width:100% + padding se desborda de la tarjeta.
    extra_styles: '* { box-sizing: border-box; }',
    tap_action: tap,
    custom_fields: { c: html },
    styles: {
      card,
      grid: [
        { 'grid-template-areas': '"c"' },
        { 'grid-template-columns': 'minmax(0, 1fr)' },   // sin minmax, un texto largo ensancha el track y se recorta
        { 'justify-items': 'start' },
        { padding: relleno },
      ],
      custom_fields: {
        c: [
          { 'justify-self': 'stretch' },
          { 'align-self': 'stretch' },
          { width: '100%' },
          { 'text-align': 'left' },   // button-card centra por defecto
          { 'min-width': '0' },
          { 'font-family': T.plex },
        ],
      },
    },
  }
  if (entidad) c.entity = entidad
  if (hold) c.hold_action = hold
  if (doble) c.double_tap_action = doble
  if (grid) c.grid_options = grid
  return c
}

/** Etiqueta de seccion: 14px, 600, MAYUSCULAS, tracking 2px. */
export const etiqueta = (texto, derecha = '') => `
<div style="display:flex;justify-content:space-between;align-items:baseline;margin:0 0 12px">
  <span style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">${texto}</span>
  ${derecha ? `<span style="font-size:14px;color:${T.texto3}">${derecha}</span>` : ''}
</div>`

/** Encabezado de tarjeta: label chico arriba + valor grande Sora. */
export const encabezado = (label, valor, unidad = '', color = T.texto) => `
<div>
  <div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">${label}</div>
  <div style="font-family:${T.sora};font-size:52px;font-weight:700;margin-top:8px;line-height:1;color:${color}">${valor}${
    unidad ? `<span style="font-size:22px;font-weight:600;color:${T.texto2}"> ${unidad}</span>` : ''}</div>
</div>`

/** Caja de icono tintada (48px) como la del prototipo. */
export const cajaIcono = (icono, color, medida = 48) => `
<span style="width:${medida}px;height:${medida}px;border-radius:14px;background:${alfa(color, 0.15)};display:grid;place-items:center;flex:none">
  <ha-icon icon="${icono}" style="color:${color};--mdc-icon-size:${Math.round(medida * 0.5)}px"></ha-icon>
</span>`

/** Sub-tarjeta clave/valor de las grillas internas. */
export const subTarjeta = (nombre, valor) => `
<div style="background:${T.fill};border-radius:14px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:10px">
  <span style="font-size:15px;color:${T.texto2}">${nombre}</span><b style="font-size:17px;color:${T.texto}">${valor}</b>
</div>`

/** Pill on/off del prototipo (42x24, knob 20px). */
export const toggle = (encendido) => `
<span style="width:42px;height:24px;border-radius:99px;background:${encendido ? T.acento : 'rgba(139,147,255,.18)'};position:relative;flex:none;transition:background .2s">
  <span style="position:absolute;top:2px;left:${encendido ? '20px' : '2px'};width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s"></span>
</span>`

/** Separador invisible para dejar aire sobre la navbar flotante. */
export const aire = (px = 120) => ({
  type: 'markdown',
  content: ' ',
  grid_options: { columns: 'full' },
  card_mod: { style: `ha-card{background:none!important;border:none!important;box-shadow:none!important;min-height:${px}px;}` },
})

/**
 * El protector de pantalla. Va en TODAS las vistas.
 * Los mismos tiempos que el panel viejo: se cambian en los dos con
 * `node scripts/ha/cuadro-tiempos.mjs`.
 */
export const CUADRO_INACTIVIDAD = 100   // segundos sin tocar antes de aparecer
export const CUADRO_DURACION = 60       // segundos que dura cada obra

export const cuadro = () => ({
  type: 'custom:cuadro-card',
  inactividad: CUADRO_INACTIVIDAD,
  solo_vertical: true,
  entidad_temp: 'sensor.hue_motion_sensor_1_temperatura',
  duracion_obra: CUADRO_DURACION,
  carpeta: '/local/cuadros',
})

/** El fondo con movimiento, igual que en el panel actual. */
export const fondoOlas = () => ({
  image: '/local/olas/actual.svg?v=20260817c',
  size: 'cover',
  position: 'center center',
  repeat: 'no-repeat',
  attachment: 'fixed',
})
