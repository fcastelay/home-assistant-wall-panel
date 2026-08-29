// Media, Aparatos, Camioneta y Sausalito.
//
// Estas cuatro son sobre todo listas. Las tarjetas `entities` se CONSERVAN
// nativas y se restilan con card_mod: adentro hay toggles, selects y botones
// que se perderian si se rehicieran como HTML plano.

import { T, R, alfa, js, tarjeta, aire, cuadro, fondoOlas } from '../diseno.mjs'
import { navbar } from '../navbar.mjs'
import { rotulo, marco, restilarCamara } from '../restilar.mjs'
import { sonandoAhora } from '../sonando.mjs'
import { bloquePlex, estrenosPeliculas, estrenosSeries } from '../plex.mjs'

const base = (title, path, icon) => ({
  title, path, icon,
  type: 'sections',
  max_columns: 2,
  theme: 'Vidrio Animado',
  background: fondoOlas(),
})

// Estilo comun para las tarjetas nativas de lista.
const ESTILO_LISTA = `
  ha-card {
    background: ${T.tarjeta} !important;
    border: 1px solid ${T.borde} !important;
    border-radius: ${R.grande}px !important;
    box-shadow: none !important;
    backdrop-filter: blur(6px);
  }
  .card-header {
    font-family: ${T.plex} !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    letter-spacing: 2px !important;
    text-transform: uppercase;
    color: ${T.texto3} !important;
    padding: 20px 22px 8px !important;
  }
  #states { padding: 0 22px 18px !important; }
  #states > * { --mdc-icon-size: 20px; }
  .name { font-family: ${T.plex} !important; font-size: 15px !important; color: ${T.texto} !important; }
  state-badge { color: ${T.texto2} !important; }
`

export const lista = (carta) => ({ ...carta, card_mod: { style: ESTILO_LISTA } })

// ================================================================== Media

const ESTILO_REPRODUCTOR = `
  ha-card {
    background: ${T.tarjeta} !important;
    border: 1px solid ${T.borde} !important;
    border-radius: ${R.media}px !important;
    box-shadow: none !important;
    backdrop-filter: blur(6px);
    padding: 14px 16px !important;
  }
  .mmp-player__adds { padding-top: 6px !important; }
  .entity__info__name { font-family: ${T.plex} !important; font-size: 16.5px !important; font-weight: 600 !important; color: ${T.texto} !important; }
  .entity__info__media { font-family: ${T.plex} !important; font-size: 13.5px !important; color: ${T.texto2} !important; }
  .entity__icon, .entity__artwork { border-radius: 14px !important; width: 58px !important; height: 58px !important; }
  ha-icon-button { --mdc-icon-button-size: 42px; color: ${T.texto} !important; }
`

/**
 * Como se llama y con que icono se dibuja cada equipo.
 *
 * POR QUE UNA TABLA A MANO. Los `friendly_name` que llegan de las integraciones son los
 * que puso el fabricante, no los que usa la casa:
 *
 *     "LG webOS TV OLED65B5PSA"          ->  TV Living
 *     "Samsung 6 Series (50) (UN50MU6100)" ->  TV Invitados
 *
 * Nadie llama "OLED65B5PSA" al televisor del living. Renombrar la entidad en Home
 * Assistant tambien serviria, pero rompe las automatizaciones y los tableros viejos que
 * la buscan por nombre. La tabla vive aca, al lado de donde se dibuja, y no toca nada.
 */
const EQUIPOS = {
  'media_player.apple_tv_living': ['Apple TV Living', 'mdi:apple'],
  'media_player.living': ['Apple TV 4K', 'mdi:apple'],
  'media_player.flowbox_living': ['FlowBox Living', 'mdi:set-top-box'],
  'media_player.lg_webos_tv_oled65b5psa': ['TV Living', 'mdi:television'],
  'media_player.tv_oficina': ['TV Oficina', 'mdi:television'],
  'media_player.tv_dormitorio_2': ['TV Dormitorio', 'mdi:television'],
  'media_player.samsung_6_series_50_un50mu6100': ['TV Invitados', 'mdi:television'],
  'media_player.homepods_oficina': ['HomePods Oficina', 'mdi:speaker'],
  'media_player.habitacion': ['HomePod Habitación', 'mdi:speaker'],
  'media_player.quincho': ['HomePod Quincho', 'mdi:speaker'],
}

/**
 * Un equipo, en una fila compacta de 72 px: caja de icono, nombre y que esta haciendo.
 *
 * POR QUE COMPACTO Y NO UN REPRODUCTOR ENTERO POR EQUIPO. La version anterior dibujaba un
 * `mini-media-player` completo por cada aparato. Con el Apple TV del living sonando, **la
 * misma cancion aparecia dos veces en la pantalla**: en el hero de arriba y otra vez en su
 * grupo. Ademas diez reproductores completos empujaban las caratulas de Plex fuera de la
 * vista. Ahora manda uno solo: el hero. Estos son para ver de un vistazo y entrar.
 *
 * CAJA DE ICONO Y NO PUNTITO DE COLOR. El punto de 7 px obligaba a acordarse de que
 * significaba cada color. La caja teñida al 12 % del color de estado dice lo mismo y ademas
 * identifica el TIPO de aparato de un vistazo.
 *
 * LOS APAGADOS SE MUESTRAN, al 55 % de opacidad. Se penso esconder los que no responden:
 * **saber que la caja del living no responde ES informacion**, y esconderla haria pensar
 * que no existe.
 */
const equipoFila = (carta) => {
  const [nombre, icono] = EQUIPOS[carta.entity] || [null, 'mdi:cast']
  // Se arma afuera del template: anidar backticks dentro de `js(...)` rompe el parseo.
  const expresionNombre = nombre
    ? JSON.stringify(nombre)
    : "(a.friendly_name || " + JSON.stringify(carta.entity) + ")"
  return tarjeta({
    entidad: carta.entity,
    tap: { action: 'more-info' },
    radio: R.media,
    relleno: '14px 18px',
    alto: '72px',
    html: js(`
      const s = states['${carta.entity}'];
      const st = s ? s.state : 'unavailable';
      const suena = st === 'playing';
      const pausa = st === 'paused';
      const vivo = s && st !== 'unavailable' && st !== 'unknown';
      const prendido = vivo && st !== 'off' && st !== 'standby';

      // Colores semanticos: verde suena, celeste prendido, gris quieto, rojo no responde.
      const col = !vivo ? '${T.peligro}'
        : (suena ? '${T.okTexto}' : (prendido ? '${T.info}' : '${T.texto3}'));

      const a = s ? s.attributes : {};
      const nombre = ${expresionNombre};

      const NOM = { playing: 'Reproduciendo', paused: 'En pausa', idle: 'Inactivo',
                    off: 'Apagado', standby: 'En espera', unavailable: 'No responde',
                    unknown: 'Sin datos', on: 'Encendido' };
      let abajo = NOM[st] || st;
      if (suena || pausa) {
        // OJO: app_name a veces trae el identificador interno de Apple en vez del
        // nombre de la app: "com.apple.tvairplayd". Eso no se muestra nunca.
        // (Y ningun comentario de aca adentro puede llevar acento grave: cierra
        //  el template de js() a la mitad. Paso el 29/08 y el error apunta a
        //  una linea que no tiene nada que ver.)
        let app = a.app_name || '';
        if (/^com\\./.test(app)) app = /airplay/i.test(app) ? 'AirPlay' : '';
        const t = [a.media_title, a.media_artist || app].filter(Boolean).join(' · ');
        if (t) abajo = t;
      }

      return '<div style="display:flex;align-items:center;gap:13px;width:100%;opacity:'
        + (prendido ? '1' : '.55') + '">'
        + '<span style="width:40px;height:40px;border-radius:12px;flex:none;display:grid;'
        +   'place-items:center;background:' + col + '1f">'
        +   '<ha-icon icon="${icono}" style="color:' + col + ';--mdc-icon-size:21px"></ha-icon>'
        + '</span>'
        + '<span style="flex:1;min-width:0">'
        +   '<span style="display:block;font-size:16.5px;font-weight:600;color:${T.texto};'
        +     'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.2">' + nombre + '</span>'
        +   '<span style="display:block;font-size:13.5px;color:' + col + ';margin-top:3px;'
        +     'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + abajo + '</span>'
        + '</span>'
        + '</div>';
    `),
  })
}

export function vistaMedia (vieja) {
  // Los grupos y sus equipos salen del panel viejo: ahi esta la curaduria de que aparato
  // va en cada grupo, que no se puede deducir de la entidad.
  const grupos = []
  for (const s of vieja.sections || []) {
    const titulo = (s.cards || []).find(c => c.type === 'heading')
    const players = (s.cards || []).filter(c => c.type === 'custom:mini-media-player')
    if (players.length) grupos.push({ titulo: titulo ? titulo.heading : '', players })
  }

  return {
    ...base('Media', 'media', 'mdi:multimedia'),
    sections: [
      // 1. Lo que suena AHORA, grande y con caratula. Si no suena nada, no se dibuja.
      { type: 'grid', column_span: 2, cards: [sonandoAhora()] },

      // 2. Los equipos, en filas compactas de a dos, agrupados como en el panel viejo.
      ...grupos.map(g => ({
        type: 'grid',
        column_span: 2,
        cards: [
          rotulo(g.titulo, g.players.length + (g.players.length === 1 ? ' equipo' : ' equipos')),
          {
            type: 'grid',
            columns: 2,
            square: false,
            grid_options: { columns: 'full' },
            cards: g.players.map(equipoFila),
          },
        ],
      })),

      // 3. Plex. El servidor y las bibliotecas van a lo ancho; los estrenos se parten en
      //    DOS COLUMNAS —peliculas a la izquierda, series a la derecha— porque a lo ancho
      //    eran doce filas seguidas y el scroll se hacia eterno. Al lado, entran seis y
      //    seis en el alto de seis.
      { type: 'grid', column_span: 2, cards: [rotulo('Plex'), ...bloquePlex()] },
      { type: 'grid', cards: [estrenosPeliculas()] },
      { type: 'grid', cards: [estrenosSeries()] },

      { type: 'grid', column_span: 2, cards: [cuadro(), aire(120), navbar()] },
    ],
  }
}

// =============================================================== Aparatos

const PEDRO = 'vacuum.ijai_v3_8cae_robot_cleaner'

const cabezalPedro = () => tarjeta({
  entidad: PEDRO,
  tap: { action: 'more-info' },
  relleno: '24px',
  html: js(`
    const v = states['${PEDRO}'];
    const st = v ? v.state : 'unknown';
    const NOM = {cleaning:'Limpiando', docked:'En la base', returning:'Volviendo', paused:'En pausa',
                 idle:'Esperando', error:'Con problema', unavailable:'Sin conexión'};
    const activo = st === 'cleaning' || st === 'returning';
    const col = st === 'error' ? '${T.peligro}' : (activo ? '${T.info}' : '${T.okTexto}');
    const bat = states['sensor.ijai_v3_8cae_battery_level'];
    const b = bat && !isNaN(parseFloat(bat.state)) ? Math.round(parseFloat(bat.state)) : null;
    return '<div style="display:flex;align-items:center;gap:16px;width:100%">'
      + '<span style="width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:' + col + '22;flex:none">'
      +   '<ha-icon icon="mdi:robot-vacuum" style="color:' + col + ';--mdc-icon-size:32px"></ha-icon></span>'
      + '<span style="flex:1;min-width:0">'
      +   '<span style="display:block;font-family:${T.sora};font-size:24px;font-weight:700;color:${T.texto}">Pedro</span>'
      +   '<span style="display:block;font-size:15px;color:' + col + ';margin-top:3px">' + (NOM[st] || st) + '</span>'
      + '</span>'
      + (b == null ? '' : '<span style="text-align:right;flex:none">'
      +   '<span style="display:block;font-family:${T.sora};font-size:26px;font-weight:700;color:${T.texto}">' + b + '%</span>'
      +   '<span style="display:block;font-size:12.5px;color:${T.texto3}">batería</span></span>')
      + '</div>';
  `),
})

// Los 5 botones de accion, con Barrer y trapear en celeste y A la base en verde.
// Las mismas cinco entidades que tenia la lista "Arrancar" del panel viejo.
const ACCIONES_PEDRO = [
  ['button.ijai_v3_8cae_start_sweep_mop', 'Barrer y trapear', 'mdi:broom', T.info],
  ['button.ijai_v3_8cae_start_only_sweep', 'Solo barrer', 'mdi:robot-vacuum', T.texto2],
  ['button.ijai_v3_8cae_start_mop', 'Solo trapear', 'mdi:water', T.texto2],
  ['button.ijai_v3_8cae_stop_sweeping', 'Detener', 'mdi:stop', T.alerta],
  ['button.ijai_v3_8cae_start_charge', 'A la base', 'mdi:home-import-outline', T.okTexto],
]

const botonPedro = ([entidad, nombre, icono, color]) => tarjeta({
  entidad,
  tap: { action: 'call-service', service: 'button.press', target: { entity_id: entidad } },
  hold: { action: 'more-info' },
  radio: R.media,
  relleno: '14px',
  alto: '92px',
  fondo: color === T.texto2 ? T.tarjeta : alfa(color, 0.10),
  borde: color === T.texto2 ? T.borde : alfa(color, 0.35),
  html: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:100%;text-align:center">
    <ha-icon icon="${icono}" style="color:${color};--mdc-icon-size:24px"></ha-icon>
    <span style="font-size:13.5px;font-weight:600;color:${T.texto};line-height:1.2">${nombre}</span>
  </div>`,
})

export function vistaAparatos (vieja) {
  const cartas = (vieja.sections || []).flatMap(s => s.cards || [])
  const porTitulo = (re) => cartas.find(c => c.type === 'entities' && re.test(c.title || ''))
  const aviso = cartas.find(c => c.type === 'conditional')
  const bateria = cartas.find(c => c.type === 'history-graph')

  return {
    ...base('Aparatos', 'aparatos', 'mdi:robot-vacuum'),
    sections: [
      {
        type: 'grid',
        cards: [
          cabezalPedro(),
          { type: 'grid', columns: 3, square: false, grid_options: { columns: 'full' }, cards: ACCIONES_PEDRO.map(botonPedro) },
          ...[porTitulo(/cómo va|como va/i), bateria, porTitulo(/ajustes/i)].filter(Boolean).map(lista),
          cuadro(),
        ],
      },
      {
        type: 'grid',
        cards: [
          rotulo('Freidora'),
          // El aviso de "sin conexión" conserva su condicion tal cual.
          ...(aviso ? [{ ...aviso, card: marco(aviso.card) }] : []),
          ...[porTitulo(/cocinar/i), porTitulo(/botones/i)].filter(Boolean).map(lista),
        ],
      },
      { type: 'grid', column_span: 2, cards: [aire(120), navbar()] },
    ],
  }
}

// ============================================================== Camioneta

const RANGER = '8afbr01bxrj409587'

const cabezalRanger = () => tarjeta({
  entidad: `sensor.fordpass_${RANGER}_gearleverposition`,
  tap: { action: 'more-info' },
  relleno: '24px',
  grid: { columns: 'full' },
  html: js(`
    const g = states['sensor.fordpass_${RANGER}_gearleverposition'];
    const palanca = g ? g.state : '--';
    const lock = states['lock.fordpass_${RANGER}_doorlock'];
    const trabada = lock && lock.state === 'locked';
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;width:100%">'
      + '<div>'
      +   '<div style="font-family:${T.sora};font-size:28px;font-weight:700;color:${T.texto}">Ranger XLT</div>'
      +   '<div style="font-size:14.5px;color:${T.texto2};margin-top:4px">Palanca en <b style="color:${T.texto}">' + palanca + '</b>'
      +     ' · <span style="color:' + (trabada ? '${T.okTexto}' : '${T.peligro}') + '">' + (trabada ? 'Trabada' : 'Sin trabar') + '</span></div>'
      + '</div>'
      + '</div>';
  `),
})

const STATS_RANGER = [
  { label: 'Combustible', icono: 'mdi:gas-station', color: T.alerta, entidad: `sensor.fordpass_${RANGER}_fuel`, unidad: '%', dec: 0, rango: true },
  { label: 'Sin reportar', icono: 'mdi:calendar-clock', color: T.info, entidad: 'sensor.ranger_sin_reportar', unidad: null, dec: 1 },
  { label: 'Odómetro', icono: 'mdi:counter', color: T.acento, entidad: `sensor.fordpass_${RANGER}_odometer`, unidad: 'km', dec: 0 },
  { label: 'Batería 12V', icono: 'mdi:car-battery', color: T.okTexto, entidad: `sensor.fordpass_${RANGER}_battery`, unidad: '', dec: 0 },
]

const statRanger = (s) => tarjeta({
  entidad: s.entidad,
  tap: { action: 'more-info' },
  radio: R.media,
  relleno: '18px',
  alto: '124px',
  html: js(`
    const e = states['${s.entidad}'];
    const crudo = e ? e.state : null;
    const num = crudo != null && !isNaN(parseFloat(crudo)) ? parseFloat(crudo) : null;
    const txt = num != null
      ? num.toLocaleString('es-AR', { minimumFractionDigits: ${s.dec}, maximumFractionDigits: ${s.dec} })
      : (crudo == null || crudo === 'unavailable' ? '--' : crudo);
    const rango = ${s.rango ? 'true' : 'false'} && e && e.attributes ? e.attributes.fuelRange : null;
    const unidad = ${JSON.stringify(s.unidad)} != null
      ? ${JSON.stringify(s.unidad)}
      : (e && e.attributes && e.attributes.unit_of_measurement ? e.attributes.unit_of_measurement : '');
    return '<div style="display:flex;flex-direction:column;justify-content:center;height:100%;gap:8px">'
      + '<span style="display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:${T.texto3}">'
      +   '<ha-icon icon="${s.icono}" style="color:${s.color};--mdc-icon-size:18px"></ha-icon>${s.label}</span>'
      + '<span style="font-family:${T.sora};font-size:30px;font-weight:700;color:${T.texto};line-height:1">' + txt
      +   '<span style="font-size:15px;font-weight:600;color:${T.texto2}"> ' + unidad + '</span></span>'
      + (rango != null ? '<span style="font-size:12.5px;color:${T.texto3}">autonomía ' + Math.round(rango) + ' km</span>' : '')
      + '</div>';
  `),
})

export function vistaCamioneta (vieja) {
  const cartas = (vieja.sections || []).flatMap(s => s.cards || [])
  const stack = cartas.find(c => c.type === 'vertical-stack')
  // Del stack viejo se descartan la cabecera (indice 0) y la primera grilla de
  // stats: ambas quedaron duplicadas arriba. Se conservan Ubicacion, la foto,
  // Trabar/Destrabar y el arranque.
  let grillaVista = false
  const foto = stack && {
    ...stack,
    cards: stack.cards.filter((c, i) => {
      if (i === 0) return false
      if (c.type === 'grid' && !grillaVista) { grillaVista = true; return false }
      return true
    }),
  }
  /* La foto de la camioneta viene rescatada del panel viejo, con el `<img>` escrito a
   * mano adentro. Se reescribe aca en vez de tocar el panel viejo, que es la fuente.
   *
   * RangerXLT.jpg es una foto mejor pero es JPEG **con fondo blanco**: la anterior era
   * PNG con transparencia (tipo 6, comprobado) y por eso flotaba sobre la tarjeta azul.
   * Puesta tal cual, sobre el fondo #080d1a quedaria un rectangulo blanco.
   *
   * En vez de recortarla —que habria que hacer fuera de aca— se le pone una tarjeta
   * clara con esquinas redondeadas: el blanco pasa a leerse como parte del diseno, al
   * modo de una ficha de producto, y no como un error. */
  const FOTO = '/local/RangerXLT.jpg'
  const reponerFoto = (nodo) => {
    if (typeof nodo === 'string') {
      return nodo.includes('ranger_foto.png')
        ? '<div style="background:linear-gradient(160deg,#f4f6fa,#dfe4ec);border-radius:18px;'
          + 'padding:10px 8px;box-shadow:inset 0 1px 0 rgba(255,255,255,.7)">'
          + '<img src="' + FOTO + '?v=20260828" style="width:100%;display:block;'
          + 'filter:drop-shadow(0 10px 14px rgba(0,0,0,.28))"></div>'
        : nodo
    }
    if (Array.isArray(nodo)) return nodo.map(reponerFoto)
    if (nodo && typeof nodo === 'object') {
      const salida = {}
      for (const [k, val] of Object.entries(nodo)) salida[k] = reponerFoto(val)
      return salida
    }
    return nodo
  }

  const mapa = cartas.find(c => c.type === 'map')
  const listas = cartas.filter(c => c.type === 'entities')
  const historia = cartas.filter(c => c.type === 'history-graph')

  return {
    ...base('Camioneta', 'camioneta', 'mdi:truck'),
    sections: [
      { type: 'grid', column_span: 2, cards: [cabezalRanger(), cuadro()] },
      { type: 'grid', column_span: 2, cards: [{ type: 'grid', columns: 4, square: false, grid_options: { columns: 'full' }, cards: STATS_RANGER.map(statRanger) }] },
      { type: 'grid', cards: [...(foto ? [marco(reponerFoto(foto))] : []), ...listas.slice(0, 3).map(lista)] },
      { type: 'grid', cards: [...(mapa ? [marco(mapa)] : []), ...listas.slice(3).map(lista), ...historia.map(h => marco(h))] },
      { type: 'grid', column_span: 2, cards: [aire(120), navbar()] },
    ],
  }
}

// ============================================================== Sausalito

/**
 * Los aparatos Tuya de Sausalito: bomba de la pileta, luces de la pileta y luces de los
 * arboles. Son MANDOS, no un cartel de estado: se tocan.
 *
 * POR QUE APARECEN `unavailable` Y NO ES UNA FALLA. El 28/08/2026 los tres estaban
 * `unavailable`, con cero momentos disponibles en 30 dias, y estuve por escribir que la
 * integracion Tuya estaba rota. No lo esta: Persona 1 aviso que **estan sin energia y los
 * tres funcionan**. Cuando vuelve la luz se reconectan solos.
 *
 * Y no es que Sausalito entero este a oscuras: el Sonoff de la heladera responde (`off`,
 * no `unavailable`) y las camaras tambien. Hay luz e internet. **Lo que esta cortado es
 * el circuito de la pileta y el parque**, que es donde cuelgan estos tres.
 *
 * La diferencia importa para lo que dice la tarjeta. "Sin conexion" manda a revisar la
 * nube de Tuya, que es el lugar equivocado. Dice "sin energia", que es el dato cierto.
 *
 * LA HELADERA ES LA CUARTA, y ademas es el testigo: su sensor de tension dice si en
 * Sausalito hay luz. Por eso las cuatro van juntas y el consumo queda debajo.
 *
 * LOS TRES NO SON IGUALES:
 *   - Bomba y luces de arboles: interruptores secos, prendido/apagado.
 *   - Luces de la pileta: RGB (`hs` + `color_temp`). Se dibuja del color que tiene
 *     puesto, no de un color fijo, y con mantener apretado se abre la rueda de color.
 */
const mando = ({
  entidad, icono, nombre, color, rgb = false,
  subOn = 'Encendida', subOff = 'Apagada',
}) => tarjeta({
  entidad,
  tap: { action: 'toggle' },
  hold: { action: 'more-info' },
  radio: R.media,
  relleno: '14px 16px',
  alto: '92px',
  html: js(`
    const s = states['${entidad}'];
    const hay = !!s && s.state !== 'unavailable' && s.state !== 'unknown';
    const on = hay && s.state === 'on';

    // Una luz de color se muestra del color que tiene puesto. Si no lo informa, cae al
    // color fijo de la tarjeta.
    const propio = ${rgb} && on && s.attributes && s.attributes.rgb_color
      ? 'rgb(' + s.attributes.rgb_color.join(',') + ')'
      : '${color}';
    const col = !hay ? '${T.texto3}' : (on ? propio : '${T.texto3}');
    const dice = !hay ? 'Sin energía' : (on ? '${subOn}' : '${subOff}');

    const mitad = (activa, arriba) =>
      '<span style="display:block;height:17px;border-radius:' + (arriba ? '6px 6px 2px 2px' : '2px 2px 6px 6px') + ';'
      + 'background:' + (activa ? (hay ? propio : '${T.texto3}') : '${T.fill}') + ';'
      + (activa ? '' : 'box-shadow:inset 0 1px 3px rgba(0,0,0,.45);') + '"></span>';

    return '<div style="display:flex;align-items:center;gap:12px;width:100%;opacity:' + (hay ? '1' : '.55') + '">'
      + '<span style="width:38px;height:38px;border-radius:12px;flex:none;display:grid;place-items:center;'
      +   'background:' + (on ? 'rgba(255,255,255,.10)' : '${T.fill}') + '">'
      +   '<ha-icon icon="${icono}" style="color:' + col + ';--mdc-icon-size:21px"></ha-icon>'
      + '</span>'
      + '<span style="flex:1;min-width:0">'
      +   '<span style="display:block;font-size:15px;font-weight:600;color:${T.texto};line-height:1.2">${nombre}</span>'
      +   '<span style="display:block;font-size:12.5px;color:' + (hay ? col : '${T.texto3}') + ';margin-top:2px">' + dice + '</span>'
      + '</span>'
      + '<span style="width:30px;flex:none;display:flex;flex-direction:column;gap:2px;padding:3px;'
      +   'border-radius:9px;border:1px solid ${T.borde};background:rgba(0,0,0,.22)">'
      +   mitad(on, true) + mitad(!on, false)
      + '</span>'
      + '</div>';
  `),
})

const tuyaSausalito = () => ({
  type: 'grid',
  columns: 4,
  square: false,
  grid_options: { columns: 'full' },
  cards: [
    mando({
      entidad: 'switch.pileta_sausalito_bomba_interruptor_1',
      icono: 'mdi:pump', nombre: 'Bomba pileta', color: T.okTexto,
    }),
    mando({
      entidad: 'light.5_in_1_controller_wifi_2_4g',
      icono: 'mdi:pool', nombre: 'Luces pileta', color: T.ambar, rgb: true,
    }),
    mando({
      entidad: 'switch.luces_arboles_interruptor_1',
      icono: 'mdi:pine-tree', nombre: 'Luces árboles', color: T.ambar,
    }),
    // La cuarta. Es un Sonoff, no un Tuya, y esta en otro circuito: por eso responde
    // cuando los otros tres no. Va con la etiqueta que la distingue.
    mando({
      entidad: 'switch.sonoff_100142a118',
      icono: 'mdi:fridge', nombre: 'Heladera', color: T.acento,
      subOn: 'Enchufe encendido', subOff: 'Enchufe apagado',
    }),
  ],
})

/**
 * Consumo y tension de la heladera, en una tira fina debajo de los mandos.
 *
 * Antes esto era una tarjeta grande con su propio interruptor, y con la heladera ya
 * puesta como cuarto mando quedaban DOS controles del mismo enchufe. Se saco el control
 * duplicado y se dejaron los numeros, que son lo que la tarjeta grande aportaba de mas.
 *
 * La tension no es un adorno: es el unico testigo de si en Sausalito hay luz.
 */
const consumoSausalito = () => tarjeta({
  entidad: 'sensor.sonoff_100142a118_voltage',
  tap: { action: 'none' },
  radio: R.media,
  relleno: '14px 18px',
  grid: { columns: 'full' },
  html: js(`
    const cifra = (e, nombre, unidad, dec) => {
      const x = states[e];
      const hay = x && !isNaN(parseFloat(x.state));
      const v = hay ? parseFloat(x.state).toFixed(dec) : '--';
      return '<span style="display:flex;align-items:baseline;gap:6px">'
        + '<span style="font-size:12.5px;color:${T.texto3}">' + nombre + '</span>'
        + '<span style="font-family:${T.sora};font-size:18px;font-weight:700;color:'
        +   (hay ? '${T.texto}' : '${T.texto3}') + '">' + v + '</span>'
        + '<span style="font-size:12.5px;font-weight:600;color:${T.texto2}">' + unidad + '</span>'
        + '</span>';
    };
    const v = states['sensor.sonoff_100142a118_voltage'];
    const luz = v && parseFloat(v.state) > 150;
    return '<div style="display:flex;align-items:center;gap:18px;width:100%">'
      + '<span style="width:7px;height:7px;border-radius:50%;flex:none;background:'
      +   (luz ? '${T.ok}' : '${T.texto3}') + '"></span>'
      + '<span style="font-size:12.5px;color:${T.texto3};flex:none">HELADERA</span>'
      + '<span style="flex:1"></span>'
      + cifra('sensor.sonoff_100142a118_power', 'Consumo', 'W', 0)
      + cifra('sensor.sonoff_100142a118_voltage', 'Tensión', 'V', 0)
      + '</div>';
  `),
})

export function vistaSausalito (vieja) {
  const cartas = (vieja.sections || []).flatMap(s => s.cards || [])
  const porTitulo = (re) => cartas.find(c => c.type === 'entities' && re.test(c.title || ''))
  const camaras = cartas.filter(c => c.type === 'picture-entity')

  return {
    ...base('Sausalito', 'sausalito', 'mdi:home-city'),
    sections: [
      {
        type: 'grid',
        cards: [
          rotulo('Sausalito'),
          ...[porTitulo(/alarma/i), porTitulo(/ambiente/i)].filter(Boolean).map(lista),
          tuyaSausalito(),
          consumoSausalito(),
          cuadro(),
        ],
      },
      {
        type: 'grid',
        cards: [
          ...camaras.map(c => restilarCamara({ ...c, aspect_ratio: '4:3' })),
          ...[porTitulo(/sirena/i)].filter(Boolean).map(lista),
        ],
      },
      { type: 'grid', column_span: 2, cards: [aire(120), navbar()] },
    ],
  }
}
