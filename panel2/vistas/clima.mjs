// Vista Clima del Panel Vertical 2: dos columnas, Casa y Sausalito.

import { T, R, alfa, js, tarjeta, aire, cuadro, fondoOlas } from '../diseno.mjs'
import { navbar } from '../navbar.mjs'
import { rotulo, marco } from '../restilar.mjs'

const CONDICION = {
  'clear-night': 'Despejado', cloudy: 'Nublado', fog: 'Niebla', hail: 'Granizo',
  lightning: 'Tormenta', 'lightning-rainy': 'Tormenta', partlycloudy: 'Parcialmente nublado',
  pouring: 'Lluvia fuerte', rainy: 'Lluvioso', snowy: 'Nieve', 'snowy-rainy': 'Aguanieve',
  sunny: 'Soleado', windy: 'Ventoso', exceptional: 'Excepcional',
}

/** Cabecera de clima: temperatura grande + condicion + tres datos en linea. */
const ahora = (entidad, lugar) => tarjeta({
  entidad,
  tap: { action: 'more-info' },
  relleno: '24px',
  html: js(`
    const w = states['${entidad}'];
    const a = w ? w.attributes : {};
    const MAP = ${JSON.stringify(CONDICION)};
    const t = a.temperature != null ? Math.round(a.temperature) : '--';
    const dato = (ico, val) => '<span style="display:inline-flex;align-items:center;gap:5px">'
      + '<ha-icon icon="' + ico + '" style="--mdc-icon-size:17px;color:${T.texto3}"></ha-icon>'
      + '<b style="color:${T.texto};font-weight:600">' + val + '</b></span>';
    return '<div style="width:100%">'
      + '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">${lugar}</div>'
      + '<div style="display:flex;align-items:baseline;gap:14px;margin-top:10px">'
      +   '<span style="font-family:${T.sora};font-size:56px;font-weight:700;line-height:1;color:${T.texto}">' + t + '°</span>'
      +   '<span style="font-size:17px;color:${T.texto2}">' + (MAP[w ? w.state : ''] || (w ? w.state : '--')) + '</span>'
      + '</div>'
      + '<div style="display:flex;gap:18px;font-size:14px;color:${T.texto2};margin-top:14px;flex-wrap:wrap">'
      +   dato('mdi:water-percent', (a.humidity != null ? Math.round(a.humidity) + '%' : '--'))
      +   dato('mdi:weather-windy', (a.wind_speed != null ? Math.round(a.wind_speed) + ' km/h' : '--'))
      +   dato('mdi:gauge', (a.pressure != null ? Math.round(a.pressure) + ' hPa' : '--'))
      + '</div></div>';
  `),
})

const estiloPronostico = `
  ha-card { background: ${T.tarjeta} !important; border: 1px solid ${T.borde} !important; border-radius: ${R.grande}px !important; box-shadow: none !important; backdrop-filter: blur(6px); }
  .forecast > div { background: ${T.fill} !important; border-radius: 12px !important; padding: 10px 4px !important; }
  .forecast { gap: 8px !important; }
  .forecast .templow { color: ${T.texto3} !important; }
`

const estiloGrafico = `
  ha-card { background: ${T.tarjeta} !important; border: 1px solid ${T.borde} !important; border-radius: ${R.grande}px !important; box-shadow: none !important; backdrop-filter: blur(6px); }
  .header .name { font-family: ${T.plex} !important; font-size: 14px !important; letter-spacing: 1.6px; text-transform: uppercase; color: ${T.texto3} !important; }
`

const estiloAviso = `
  ha-card { background: ${alfa(T.alerta, 0.10)} !important; border: 1px solid ${alfa(T.alerta, 0.30)} !important; border-radius: ${R.grande}px !important; box-shadow: none !important; }
  ha-markdown { font-family: ${T.plex} !important; font-size: 14px !important; color: ${T.texto2} !important; }
  ha-markdown h3 { color: ${T.alerta} !important; font-size: 16px !important; }
`

/** Arma una columna a partir de las tarjetas de la seccion vieja. */
function columna (seccion, entidadClima, lugar) {
  const cards = seccion ? (seccion.cards || []) : []
  const salida = [ahora(entidadClima, lugar)]

  for (const c of cards) {
    if (c.type === 'weather-forecast') {
      // 8 franjas horarias no entran en los ~500 px de la columna.
      const slots = c.forecast_type === 'hourly' ? 6 : c.forecast_slots
      salida.push({ ...c, show_current: false, forecast_slots: slots, card_mod: { style: estiloPronostico } })
    } else if (c.type === 'custom:mini-graph-card') {
      salida.push({ ...c, card_mod: { style: estiloGrafico } })
    } else if (c.type === 'conditional') {
      // El aviso de "la estación está caída" mantiene su condicion tal cual.
      salida.push({ ...c, card: { ...c.card, card_mod: { style: estiloAviso } } })
    } else if (c.type === 'custom:weather-radar-card') {
      salida.push(marco(c))
    }
  }
  return salida
}

export function vistaClima (vieja) {
  const secs = vieja.sections || []
  const casa = secs[0]
  const saus = secs[1]

  return {
    title: 'Clima',
    path: 'clima',
    icon: 'mdi:weather-partly-rainy',
    type: 'sections',
    max_columns: 2,
    theme: 'Vidrio Animado',
    background: fondoOlas(),
    sections: [
      { type: 'grid', cards: [...columna(casa, 'weather.pirateweather', 'Casa · San Justo'), cuadro()] },
      { type: 'grid', cards: columna(saus, 'weather.forecast_sausalito', 'Sausalito') },
      { type: 'grid', column_span: 2, cards: [aire(120), navbar()] },
    ],
  }
}
