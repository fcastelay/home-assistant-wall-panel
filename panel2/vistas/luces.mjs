// Vista Luces del Panel Vertical 2.
// Se conserva big-slider-card (es la unica que permite regular arrastrando) con
// los parametros nuevos del DISENO, y los hold_action a los pop-up #luz-...

import { T, R, alfa, js, tarjeta, aire, cuadro, fondoOlas } from '../diseno.mjs'
import { navbar } from '../navbar.mjs'

const RUIDO = '_segment_|awtrix|todas_las_luces|grupo_luces|luces_afuera|hue_color_lamp'

const INTERIOR = [
  ['light.tv_living_govee', 'TV Living', 'tv-living-govee'],
  ['light.comedor_comedor', 'Comedor', 'comedor-comedor'],
  ['light.cocina_cocina', 'Cocina', 'cocina-cocina'],
  ['light.pasillo_pasillo', 'Pasillo', 'pasillo-pasillo'],
  ['light.dormitorio_principal_dormitorio_principal', 'Dormitorio', 'dormitorio-principal-dormitorio-principal'],
  ['light.dormitorio_invitados_dormitorio_invitados', 'Invitados', 'dormitorio-invitados-dormitorio-invitados'],
]

const EXTERIOR = [
  ['light.luces_afuera', 'Exteriores', 'luces-afuera'],
  ['light.luz_ingreso', 'Ingreso', 'luz-ingreso'],
  ['light.luz_garage', 'Garage', 'luz-garage'],
  ['light.reflectores', 'Reflectores', 'reflectores'],
  ['light.rgb_pileta', 'Pileta', null],
]

const TEMPS = [
  ['sensor.hue_motion_sensor_4_temperatura', 'Living'],
  ['sensor.hue_motion_sensor_2_temperatura', 'Cocina'],
  ['sensor.hue_motion_sensor_1_temperatura', 'Pasillo'],
  ['sensor.hue_motion_sensor_3_temperatura', 'Galería'],
  ['sensor.hue_outdoor_motion_sensor_1_temperatura', 'Garage'],
]

/** Slider grande. Conserva tap=toggle y hold=pop-up de la luz. */
const slider = ([entity, name, popup]) => ({
  type: 'custom:big-slider-card',
  entity,
  name,
  icon: 'mdi:lightbulb',
  height: 190,
  border_radius: 22,
  border_width: 1,
  border_style: 'solid',
  border_color: T.borde,
  background_color: 'rgba(22,38,54,.55)',
  color: T.ambar,
  slider_opacity: 0.5,
  icon_box_size: 50,
  icon_size: 26,
  show_icon_halo: true,
  icon_color: '#1b1206',
  icon_off_color: T.texto,
  show_percentage: true,
  bold_text: true,
  text_size: 21,
  text_color: T.texto,
  tap_action: { action: 'toggle', haptic: 'light' },
  ...(popup ? { hold_action: { action: 'navigate', navigation_path: '#luz-' + popup } } : {}),
})

// ------------------------------------------------------------------ chips

const chips = () => tarjeta({
  entidad: 'sun.sun',
  grid: { columns: 'full' },
  relleno: '0',
  fondo: 'transparent',
  borde: 'transparent',
  radio: 0,
  html: js(`
    const encendidas = Object.keys(states).filter(e => e.startsWith('light.') && states[e].state === 'on' && !/${RUIDO}/.test(e)).length;
    const n = (e) => states[e] ? parseFloat(states[e].state) : 0;
    const temp = ((n('sensor.hue_motion_sensor_4_temperatura') + n('sensor.hue_motion_sensor_2_temperatura') + n('sensor.hue_motion_sensor_1_temperatura')) / 3).toFixed(1);
    const lx = states['sensor.hue_outdoor_motion_sensor_1_iluminancia'] ? Math.round(n('sensor.hue_outdoor_motion_sensor_1_iluminancia')) : '--';
    const dia = states['sun.sun'] && states['sun.sun'].state === 'above_horizon';
    const encasa = states['zone.home'] ? parseInt(states['zone.home'].state, 10) : 0;
    const movs = Object.keys(states).filter(e => e.startsWith('binary_sensor.')
      && states[e].attributes && states[e].attributes.device_class === 'motion' && states[e].state === 'on').length;

    const chip = (ico, col, texto) => '<span style="display:inline-flex;align-items:center;gap:8px;background:${T.tarjeta};border:1px solid ${T.borde};border-radius:99px;padding:10px 16px;font-size:14px;color:${T.texto2}">'
      + '<ha-icon icon="' + ico + '" style="--mdc-icon-size:18px;color:' + col + '"></ha-icon>'
      + '<b style="color:${T.texto};font-weight:600">' + texto + '</b></span>';

    return '<div style="display:flex;gap:10px;flex-wrap:wrap;width:100%">'
      + chip(encendidas > 0 ? 'mdi:lightbulb-group' : 'mdi:lightbulb-group-off', encendidas > 0 ? '${T.ambar}' : '${T.texto3}', encendidas + ' encendidas')
      + chip('mdi:thermometer', '${T.info}', temp + '°')
      + chip(dia ? 'mdi:white-balance-sunny' : 'mdi:weather-night', dia ? '${T.alerta}' : '${T.lila}', lx + ' lx')
      + chip('mdi:account-group', encasa > 0 ? '${T.okTexto}' : '${T.texto3}', encasa + ' en casa')
      + chip(movs > 0 ? 'mdi:motion-sensor' : 'mdi:motion-sensor-off', movs > 0 ? '${T.peligro}' : '${T.texto3}', movs > 0 ? (movs + ' con movimiento') : 'Sin movimiento')
      + '</div>';
  `),
})

// ------------------------------------------------------------- apagar todo

const apagarTodo = () => tarjeta({
  tap: { action: 'call-service', service: 'light.turn_off', target: { entity_id: 'light.todas_las_luces_de_casa' } },
  radio: 22,
  alto: '190px',
  relleno: '16px',
  fondo: alfa(T.peligro, 0.10),
  borde: alfa(T.peligro, 0.35),
  html: `<div style="display:flex;align-items:center;justify-content:center;gap:12px;height:100%;color:#ff8095;font-size:19px;font-weight:700">
    <ha-icon icon="mdi:power" style="--mdc-icon-size:24px"></ha-icon>Apagar todo</div>`,
})

// ---------------------------------------------------------------- rotulos

const rotulo = (texto) => tarjeta({
  grid: { columns: 'full' },
  relleno: '0 6px',
  fondo: 'transparent', borde: 'transparent', radio: 0,
  html: `<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">${texto}</div>`,
})

// -------------------------------------------------------- escenas al pie

const ESCENAS = [
  ['scene.modo_cine', 'Cine', 'mdi:movie-open', T.lila],
  ['scene.pasillo_relax_2', 'Relax', 'mdi:sofa', T.okTexto],
  ['scene.cocina_brillante_2', 'Brillante', 'mdi:white-balance-sunny', T.alerta],
  ['scene.dormitorio_luz_nocturna', 'Nocturna', 'mdi:weather-night', T.acento],
]

const escenas = () => ({
  type: 'grid',
  columns: 4,
  square: false,
  grid_options: { columns: 'full' },
  cards: ESCENAS.map(([ent, nombre, ico, color]) => tarjeta({
    entidad: ent,
    tap: { action: 'toggle' },
    hold: { action: 'more-info' },
    radio: R.media,
    relleno: '16px 18px',
    alto: '110px',
    html: `<div style="display:flex;align-items:center;gap:13px;height:100%">
      <span style="width:40px;height:40px;border-radius:12px;background:${alfa(color, 0.16)};display:grid;place-items:center;flex:none">
        <ha-icon icon="${ico}" style="color:${color};--mdc-icon-size:22px"></ha-icon></span>
      <span style="font-size:16.5px;font-weight:600;color:${T.texto}">${nombre}</span>
    </div>`,
  })),
})

// ---------------------------------------------------------- temperaturas

const temperaturas = () => tarjeta({
  entidad: TEMPS[0][0],
  grid: { columns: 'full' },
  relleno: '18px 22px',
  html: js(`
    const T2 = ${JSON.stringify(TEMPS)};
    const celdas = T2.map(function (t) {
      const s = states[t[0]];
      return '<div style="background:${T.fill};border-radius:14px;padding:12px 14px;text-align:center">'
        + '<div style="font-size:12.5px;color:${T.texto3}">' + t[1] + '</div>'
        + '<div style="font-family:${T.sora};font-size:22px;font-weight:700;color:${T.texto};margin-top:4px">'
        + (s ? parseFloat(s.state).toFixed(1) : '--') + '°</div></div>';
    }).join('');
    return '<div style="width:100%">'
      + '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3};margin-bottom:12px">Temperaturas</div>'
      + '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px">' + celdas + '</div></div>';
  `),
})

/** Le pone el marco nuevo a una tarjeta nativa que se conserva tal cual. */
const conMarco = (carta) => ({
  ...carta,
  grid_options: { columns: 'full' },
  card_mod: {
    style: `ha-card {
      background: ${T.tarjeta} !important;
      border: 1px solid ${T.borde} !important;
      border-radius: ${R.grande}px !important;
      box-shadow: none !important;
      backdrop-filter: blur(6px);
    }`,
  },
})

// ------------------------------------------------------------------ vista

/**
 * @param {object[]} burbujas  Los custom:bubble-card del panel viejo. Son los
 *   pop-up que abre el hold_action de cada slider: si no van, el hold no hace nada.
 * @param {object} historial   El history-graph de "Hoy", tal cual estaba.
 */
export function vistaLuces (burbujas = [], historial = null) {
  return {
    title: 'Luces',
    path: 'luces',
    icon: 'mdi:lightbulb-group',
    type: 'sections',
    max_columns: 2,
    theme: 'Vidrio Animado',
    background: fondoOlas(),
    sections: [
      { type: 'grid', column_span: 2, cards: [chips(), cuadro()] },
      {
        type: 'grid',
        column_span: 2,
        cards: [rotulo('Interior'), { type: 'grid', columns: 3, square: false, grid_options: { columns: 'full' }, cards: INTERIOR.map(slider) }],
      },
      {
        type: 'grid',
        column_span: 2,
        cards: [rotulo('Exterior'), { type: 'grid', columns: 3, square: false, grid_options: { columns: 'full' }, cards: [...EXTERIOR.map(slider), apagarTodo()] }],
      },
      { type: 'grid', column_span: 2, cards: [rotulo('Escenas'), escenas()] },
      { type: 'grid', column_span: 2, cards: [temperaturas()] },
      { type: 'grid', column_span: 2, cards: historial ? [conMarco(historial)] : [] },
      { type: 'grid', column_span: 2, cards: [...burbujas, aire(120), navbar()] },
    ],
  }
}
