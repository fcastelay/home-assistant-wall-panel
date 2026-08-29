// Vistas Energía y Factura EPE del Panel Vertical 2.

import { T, R, alfa, js, tarjeta, aire, cuadro, fondoOlas } from '../diseno.mjs'
import { navbar } from '../navbar.mjs'
import { rotulo, marco } from '../restilar.mjs'

const base = (title, path, icon) => ({
  title, path, icon,
  type: 'sections',
  max_columns: 2,
  theme: 'Vidrio Animado',
  background: fondoOlas(),
})

const desnuda = { fondo: 'transparent', borde: 'transparent', radio: 0 }
const marcoStack = `ha-card { background: ${T.tarjeta} !important; border: 1px solid ${T.borde} !important; border-radius: ${R.grande}px !important; backdrop-filter: blur(6px); box-shadow: none !important; }`

// ================================================================ Energía

/** Stat-card con borde izquierdo de 4px del color del rol. */
const stat = ({ entidad, label, color, unidad, decimales = 0, nota = "''" }) => tarjeta({
  entidad,
  tap: { action: 'more-info' },
  radio: R.media,
  relleno: '18px 20px',
  alto: '128px',
  bordeIzq: `4px solid ${color}`,
  html: js(`
    const s = states['${entidad}'];
    const v = s && !isNaN(parseFloat(s.state)) ? parseFloat(s.state) : null;
    const txt = v == null ? '--' : v.toLocaleString('es-AR', { minimumFractionDigits: ${decimales}, maximumFractionDigits: ${decimales} });
    const nota = ${nota};
    return '<div style="display:flex;flex-direction:column;justify-content:center;height:100%">'
      + '<div style="font-size:13px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${T.texto3}">${label}</div>'
      + '<div style="font-family:${T.sora};font-size:38px;font-weight:700;color:${T.texto};margin-top:6px;line-height:1">' + txt
      +   '<span style="font-size:17px;font-weight:600;color:${T.texto2}"> ${unidad}</span></div>'
      + (nota ? '<div style="font-size:12.5px;color:${T.texto3};margin-top:5px">' + nota + '</div>' : '')
      + '</div>';
  `),
})

const CIRCUITOS = [
  ['sensor.shelly_3em_consumo_actual_general', 'General', T.acento],
  ['sensor.shelly_3em_consumo_actual_oficina', 'Oficina', T.info],
  ['sensor.shelly_3em_consumo_actual_quincho', 'Quincho', T.okTexto],
]

const porCircuito = () => tarjeta({
  entidad: CIRCUITOS[0][0],
  relleno: '22px 24px',
  html: js(`
    const C = ${JSON.stringify(CIRCUITOS)};
    const val = (e) => states[e] && !isNaN(parseFloat(states[e].state)) ? parseFloat(states[e].state) : 0;
    const tope = Math.max(1, val(C[0][0]));
    const filas = C.map(function (c) {
      const v = val(c[0]);
      const pct = Math.min(100, Math.round(v / tope * 100));
      return '<div style="margin-top:16px">'
        + '<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:15px;color:${T.texto2}">'
        +   '<span>' + c[1] + '</span><b style="color:${T.texto};font-size:17px">' + Math.round(v).toLocaleString('es-AR') + ' W</b></div>'
        + '<div style="height:8px;border-radius:4px;background:${T.fill};margin-top:8px;overflow:hidden">'
        +   '<div style="height:100%;width:' + pct + '%;background:' + c[2] + ';border-radius:4px;transition:width .3s"></div></div>'
        + '</div>';
    }).join('');
    return '<div style="width:100%">'
      + '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">Por circuito</div>'
      + filas
      + '</div>';
  `),
})

const redElectrica = () => tarjeta({
  entidad: 'sensor.shelly_3em_voltaje_general',
  relleno: '22px 24px',
  html: js(`
    const dato = (e, nombre, unidad, dec) => {
      const s = states[e];
      const v = s && !isNaN(parseFloat(s.state)) ? parseFloat(s.state).toFixed(dec) : '--';
      return '<div style="background:${T.fill};border-radius:14px;padding:16px 18px;display:flex;justify-content:space-between;align-items:center">'
        + '<span style="font-size:15px;color:${T.texto2}">' + nombre + '</span>'
        + '<b style="font-family:${T.sora};font-size:22px;font-weight:700;color:${T.texto}">' + v
        + '<span style="font-size:14px;font-weight:600;color:${T.texto2}"> ' + unidad + '</span></b></div>';
    };
    return '<div style="width:100%">'
      + '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3};margin-bottom:14px">Red eléctrica</div>'
      + '<div style="display:flex;flex-direction:column;gap:12px">'
      +   dato('sensor.shelly_3em_voltaje_general', 'Voltaje', 'V', 1)
      +   dato('sensor.shelly_3em_consumo_actual_amperius', 'Corriente', 'A', 2)
      + '</div></div>';
  `),
})

const graficoGrande = () => ({
  type: 'custom:vertical-stack-in-card',
  grid_options: { columns: 'full' },
  card_mod: { style: marcoStack },
  cards: [
    tarjeta({
      ...desnuda,
      entidad: 'sensor.shelly_3em_consumo_actual_general',
      relleno: '22px 24px 8px',
      html: `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
        <span style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">Consumo · últimas 24 h</span>
        <span style="display:flex;gap:16px;font-size:13.5px;color:${T.texto2}">
          <span style="display:inline-flex;align-items:center;gap:7px"><span style="width:9px;height:9px;border-radius:3px;background:${T.okTexto}"></span>hasta 900 W</span>
          <span style="display:inline-flex;align-items:center;gap:7px"><span style="width:9px;height:9px;border-radius:3px;background:${T.alerta}"></span>900 – 2.200 W</span>
          <span style="display:inline-flex;align-items:center;gap:7px"><span style="width:9px;height:9px;border-radius:3px;background:${T.peligro}"></span>más de 2.200 W</span>
        </span>
      </div>`,
    }),
    {
      type: 'custom:mini-graph-card',
      entities: ['sensor.shelly_3em_consumo_actual_general'],
      hours_to_show: 24,
      points_per_hour: 1,
      aggregate_func: 'max',
      // Ojo: mini-graph escala con el ancho. A ancho completo, 130 ya da ~260 px.
      height: 130,
      hour24: true,
      show: { graph: 'bar', extrema: true, state: false, name: false, icon: false, labels: true },
      color_thresholds: [
        { value: 0, color: T.okTexto },
        { value: 900, color: T.alerta },
        { value: 2200, color: T.peligro },
      ],
      card_mod: {
        style: `
          ha-card { background: none !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
          .info { padding: 0 24px 8px !important; }
          .info__item__value { font-size: 14px !important; font-weight: 600 !important; color: ${T.texto} !important; }
          .info__item__type, .info__item__time { font-size: 11.5px !important; color: ${T.texto3} !important; }
        `,
      },
    },
  ],
})

export function vistaEnergia (vieja) {
  const porHora = (vieja.sections || [])
    .flatMap(s => s.cards || [])
    .find(c => c.type === 'custom:mini-graph-card' && (c.entities || []).some(e => (e.entity || e) === 'sensor.shelly_3em_consumo_actual_oficina'))

  return {
    ...base('Energía', 'energia', 'mdi:lightning-bolt'),
    sections: [
      {
        type: 'grid',
        column_span: 2,
        cards: [
          rotulo('Energía'),
          {
            type: 'grid',
            columns: 4,
            square: false,
            grid_options: { columns: 'full' },
            cards: [
              stat({ entidad: 'sensor.shelly_3em_consumo_actual_general', label: 'Consumo ahora', color: T.acento, unidad: 'W' }),
              stat({ entidad: 'sensor.shelly_3em_total_consumo_cost_3', label: 'Costo acumulado', color: T.alerta, unidad: '$', decimales: 0 }),
              stat({ entidad: 'sensor.shelly_3em_total_consumo', label: 'Consumo total', color: T.okTexto, unidad: 'kWh', decimales: 1 }),
              stat({ entidad: 'sensor.shelly_3em_factor_potencia_general', label: 'Factor de potencia', color: T.info, unidad: '', decimales: 2 }),
            ],
          },
          cuadro(),
        ],
      },
      { type: 'grid', column_span: 2, cards: [graficoGrande()] },
      { type: 'grid', cards: [porCircuito()] },
      { type: 'grid', cards: [redElectrica()] },
      {
        type: 'grid',
        column_span: 2,
        cards: porHora
          ? [marco({ ...porHora, height: 90, show: { ...(porHora.show || {}), state: false }, grid_options: { columns: 'full' } })]
          : [],
      },
      { type: 'grid', column_span: 2, cards: [aire(120), navbar()] },
    ],
  }
}

// ============================================================ Factura EPE

// La regla del bimestre, igual que en Inicio: los primeros 7 dias no proyecta.
const DIAS = `
  const be = states['sensor.lavadero_consumo_general_consumo_bimestre_epe'];
  const lr = be && be.attributes && be.attributes.last_reset ? new Date(be.attributes.last_reset) : null;
  const dias = lr ? Math.max((Date.now() - lr.getTime()) / 86400000, 1) : 1;
  const acum = be && !isNaN(parseFloat(be.state)) ? parseFloat(be.state) : 0;
  const proy = acum / dias * 61;
  const ref = states['input_number.epe_kwh_ultimo_bimestre'] ? parseFloat(states['input_number.epe_kwh_ultimo_bimestre'].state) : 1072;`

const proyeccion = () => tarjeta({
  entidad: 'sensor.lavadero_consumo_general_consumo_bimestre_epe',
  tap: { action: 'more-info' },
  relleno: '24px',
  alto: '176px',
  bordeIzq: `4px solid ${T.alerta}`,
  html: js(`
    ${DIAS}
    const d = (proy / ref - 1) * 100;
    const sub = dias < 3 ? 'Necesita unos días más de datos'
      : (d > 0 ? '▲ +' : '▼ ') + d.toFixed(0) + '% contra los ' + Math.round(ref).toLocaleString('es-AR') + ' kWh anteriores';
    return '<div style="display:flex;flex-direction:column;justify-content:center;height:100%">'
      + '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">Proyección del bimestre</div>'
      + '<div style="font-family:${T.sora};font-size:52px;font-weight:700;color:${T.texto};margin-top:8px;line-height:1">'
      +   Math.round(proy).toLocaleString('es-AR') + '<span style="font-size:22px;font-weight:600;color:${T.texto2}"> kWh</span></div>'
      + '<div style="font-size:14px;color:' + (dias < 3 ? '${T.texto3}' : (d > 0 ? '${T.peligro}' : '${T.okTexto}')) + ';margin-top:8px">' + sub + '</div>'
      + '</div>';
  `),
})

const costo = () => tarjeta({
  entidad: 'sensor.epe_costo_estimado_bimestre',
  tap: { action: 'more-info' },
  relleno: '24px',
  alto: '176px',
  bordeIzq: `4px solid ${T.rosa}`,
  html: js(`
    ${DIAS}
    const c = states['sensor.epe_costo_estimado_bimestre'];
    const v = c && !isNaN(parseFloat(c.state)) ? Math.round(parseFloat(c.state)) : null;
    const hoy = states['sensor.lavadero_consumo_general_consumo_hoy'];
    return '<div style="display:flex;flex-direction:column;justify-content:center;height:100%">'
      + '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">Costo estimado</div>'
      + '<div style="font-family:${T.sora};font-size:52px;font-weight:700;color:${T.texto};margin-top:8px;line-height:1">'
      +   (v == null ? '--' : '$' + v.toLocaleString('es-AR')) + '</div>'
      + '<div style="font-size:14px;color:${T.texto3};margin-top:8px">Día ' + dias.toFixed(0) + ' de 61 · '
      +   acum.toFixed(0) + ' kWh acumulados' + (hoy ? ' · hoy ' + parseFloat(hoy.state).toFixed(1) : '') + '</div>'
      + '</div>';
  `),
})

// Tramos reales de la boleta (los mismos numeros que el markdown del panel viejo).
const TRAMOS = [
  ['Primeros', 150, 221.10, 32, T.okTexto],
  ['Segundos', 150, 239.92, 32, T.info],
  ['Terceros', 300, 323.42, 64, T.alerta],
  ['Resto', 472, 394.82, 100, T.peligro],
]

const escalera = () => tarjeta({
  relleno: '22px 24px',
  html: `<div style="width:100%">
    <div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">La escalera tarifaria</div>
    ${TRAMOS.map(([nombre, kwh, precio, ancho, color]) => `
      <div style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:15px;color:${T.texto2}">
          <span>${nombre} · <b style="color:${T.texto}">${kwh} kWh</b></span>
          <b style="color:${color};font-size:16px">$${precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</b>
        </div>
        <div style="height:10px;border-radius:5px;background:${T.fill};margin-top:8px;overflow:hidden">
          <div style="height:100%;width:${ancho}%;background:${color};border-radius:5px"></div>
        </div>
      </div>`).join('')}
    <div style="font-size:13.5px;color:${T.texto3};margin-top:18px;line-height:1.5">
      Los últimos <b style="color:${T.texto}">472 kWh</b> costaron <b style="color:${T.texto}">$186.356</b>, más que
      los primeros 600 juntos ($166.180). Cada kWh que ahorres vale
      <b style="color:${T.peligro}">$507</b>, no $477: sale del tramo más caro.
    </div>
  </div>`,
})

const estiloMarkdown = `
  ha-card { background: ${T.tarjeta} !important; border: 1px solid ${T.borde} !important; border-radius: ${R.grande}px !important; box-shadow: none !important; backdrop-filter: blur(6px); }
  ha-markdown { font-family: ${T.plex} !important; font-size: 14.5px !important; color: ${T.texto2} !important; }
  ha-markdown table { width: 100%; border-collapse: collapse; }
  ha-markdown th { color: ${T.texto3} !important; font-size: 12.5px !important; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600 !important; padding: 6px 8px !important; }
  ha-markdown td { color: ${T.texto} !important; padding: 8px !important; border-top: 1px solid ${T.borde} !important; font-variant-numeric: tabular-nums; }
  ha-markdown strong { color: ${T.texto} !important; }
`

export function vistaFactura (vieja) {
  const cartas = (vieja.sections || []).flatMap(s => s.cards || [])
  const boletas = cartas.find(c => c.type === 'markdown' && /boleta/i.test(c.title || ''))
  const diario = cartas.find(c => c.type === 'statistics-graph' && /diario/i.test(c.title || ''))
  const circuitos = cartas.find(c => c.type === 'statistics-graph' && c !== diario)
  const ultima = cartas.find(c => c.type === 'entities')

  return {
    ...base('Factura EPE', 'factura-epe', 'mdi:receipt-text'),
    sections: [
      {
        type: 'grid',
        column_span: 2,
        cards: [
          rotulo('Factura EPE'),
          { type: 'grid', columns: 2, square: false, grid_options: { columns: 'full' }, cards: [proyeccion(), costo()] },
          cuadro(),
        ],
      },
      { type: 'grid', cards: boletas ? [{ ...boletas, card_mod: { style: estiloMarkdown } }] : [] },
      { type: 'grid', cards: [escalera()] },
      { type: 'grid', column_span: 2, cards: diario ? [marco({ ...diario, grid_options: { columns: 'full' } })] : [] },
      { type: 'grid', cards: circuitos ? [marco(circuitos)] : [] },
      { type: 'grid', cards: ultima ? [marco(ultima)] : [] },
      { type: 'grid', column_span: 2, cards: [aire(120), navbar()] },
    ],
  }
}
