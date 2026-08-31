// Vista Alarma del Panel Vertical 2.
//
// `alarm_control_panel.alarmo` tiene code_format null y code_arm_required false,
// asi que se puede armar y desarmar con botones directos, sin teclado.

import { T, R, alfa, js, tarjeta, aire, cuadro, fondoOlas } from '../diseno.mjs'
import { navbar } from '../navbar.mjs'
import { rotulo, marco, restilarCamara } from '../restilar.mjs'

const ALARMA = 'alarm_control_panel.alarmo'

// La alarma FISICA de la casa, leida por SIA desde el 30/08/2026 (D-38). Es la que tiene las
// zonas cableadas, bateria propia y sirena de verdad; Alarmo la espeja.
const G = {
  armada: 'binary_sensor.alarma_garnet_alarma_armada',
  disparada: 'binary_sensor.alarma_garnet_alarma_disparada',
  sin220: 'binary_sensor.alarma_garnet_alarma_sin_220v',
  bateria: 'binary_sensor.alarma_garnet_alarma_bateria_baja',
  evento: 'sensor.alarma_garnet_alarma_ultimo_evento',
  quien: 'sensor.alarma_garnet_alarma_quien_armo',
  senal: 'sensor.alarma_garnet_alarma_ultima_senal',
}

// Cinco minutos sin latido = cinco latidos perdidos seguidos. Mismo umbral que la
// automatizacion `garnet_sin_senal`, y tiene que seguir siendo el mismo: si el panel dijera
// "en linea" mientras el aviso salta, el panel estaria mintiendo.
const LATIDO_MAX_MIN = 5

const MODOS = [
  ['armed_home',  'alarm_arm_home',  'En casa', 'mdi:home'],
  ['armed_away',  'alarm_arm_away',  'Ausente', 'mdi:exit-run'],
  ['armed_night', 'alarm_arm_night', 'Noche',   'mdi:weather-night'],
]

const NOMBRES = {
  disarmed: 'Desarmada',
  armed_home: 'Armada · En casa',
  armed_away: 'Armada · Ausente',
  armed_night: 'Armada · Noche',
  armed_vacation: 'Armada · Vacaciones',
  arming: 'Armando…',
  pending: 'Entrando…',
  triggered: 'DISPARADA',
}

// ------------------------------------------------- la Garnet, la alarma de verdad

/**
 * Estado de la alarma fisica. Va ARRIBA de todo y antes que Alarmo, porque es la que
 * protege la casa.
 *
 * LO QUE ESTA TARJETA NO MUESTRA, Y ES DELIBERADO: **no hay lista de zonas.** Contact ID
 * reporta alarmas, no aperturas: con la casa desarmada, abrir una puerta no genera evento.
 * Una lista de 8 zonas en "Cerrada" permanente pareceria vigilancia en vivo y no lo es —
 * seria la clase de tarjeta que tranquiliza sin informar. Se muestra solo lo que el panel
 * dice de verdad.
 *
 * Se cuelga de `senal` y no de `armada`: el sensor de ultima señal cambia cada minuto, asi
 * que el punto del latido se repinta solo. Colgada de `armada`, el latido quedaria
 * congelado en el valor que tenia la ultima vez que alguien armo.
 */
const garnet = () => tarjeta({
  entidad: G.senal,
  tap: { action: 'more-info', entity: G.evento },
  relleno: '24px',
  grid: { columns: 'full' },
  html: js(`
    const g = function (id) { const s = states[id]; return s ? s.state : 'unknown'; };
    const armada = g('${G.armada}') === 'on';
    const disparada = g('${G.disparada}') === 'on';

    // Minutos desde el ultimo latido. null = todavia no llego ninguno.
    const cruda = g('${G.senal}');
    const t = Date.parse(cruda);
    const min = isNaN(t) ? null : Math.floor((Date.now() - t) / 60000);
    const viva = min !== null && min <= ${LATIDO_MAX_MIN};

    const col = disparada ? '${T.peligro}' : (armada ? '${T.okTexto}' : '${T.alerta}');
    const ico = disparada ? 'mdi:shield-alert' : (armada ? 'mdi:shield-lock' : 'mdi:shield-outline');
    const titulo = disparada ? 'DISPARADA' : (armada ? 'Armada' : 'Desarmada');

    // EL LATIDO MANDA SOBRE TODO LO DEMAS. Si la receptora no recibe, lo de arriba es el
    // ultimo estado conocido y puede tener horas. Decir "Desarmada" en verde cuando en
    // realidad no sabemos nada seria peor que no mostrar nada.
    const pulso = viva
      ? '<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:${T.texto3}">'
        + '<span style="width:7px;height:7px;border-radius:50%;background:${T.ok}"></span>en línea</span>'
      : '<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:${T.peligro};font-weight:700">'
        + '<span style="width:7px;height:7px;border-radius:50%;background:${T.peligro}"></span>'
        + (min === null ? 'sin señal' : 'muda hace ' + min + ' min') + '</span>';

    const chip = function (on, textoOn, textoOff, icono) {
      const c = on ? '${T.peligro}' : '${T.texto3}';
      return '<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:${R.pill}px;'
        + 'background:' + (on ? 'rgba(255,77,109,.12)' : '${T.fill}') + ';border:1px solid ' + (on ? 'rgba(255,77,109,.35)' : '${T.borde}') + '">'
        + '<ha-icon icon="' + icono + '" style="color:' + c + ';--mdc-icon-size:16px"></ha-icon>'
        + '<span style="font-size:13px;color:' + c + ';font-weight:' + (on ? '700' : '500') + '">'
        + (on ? textoOn : textoOff) + '</span></span>';
    };

    return '<div style="width:100%">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      +   '<span style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">Alarma Garnet</span>'
      +   pulso
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:16px">'
      +   '<span style="width:64px;height:64px;flex:0 0 64px;border-radius:50%;display:grid;place-items:center;background:' + col + '22">'
      +     '<ha-icon icon="' + ico + '" style="color:' + col + ';--mdc-icon-size:32px"></ha-icon></span>'
      +   '<div style="min-width:0">'
      +     '<div style="font-family:${T.sora};font-size:24px;font-weight:700;color:' + col + '">' + titulo + '</div>'
      +     '<div style="font-size:13.5px;color:${T.texto2};margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
      +       'por ' + g('${G.quien}') + '</div>'
      +   '</div>'
      + '</div>'
      + '<div style="margin-top:16px;padding-top:14px;border-top:1px solid ${T.borde}">'
      +   '<div style="font-size:12.5px;color:${T.texto3};letter-spacing:1px;text-transform:uppercase">Último evento</div>'
      +   '<div style="font-size:15px;color:${T.texto};margin-top:5px">' + g('${G.evento}') + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:15px">'
      +   chip(g('${G.sin220}') === 'on', 'Sin 220 V', '220 V ok', 'mdi:power-plug')
      +   chip(g('${G.bateria}') === 'on', 'Batería baja', 'Batería ok', 'mdi:battery')
      + '</div>'
      + '</div>';
  `),
})

// ------------------------------------------------------------ armado

const escudo = () => tarjeta({
  entidad: ALARMA,
  tap: { action: 'more-info' },
  relleno: '26px 24px',
  html: js(`
    const s = states['${ALARMA}'];
    const st = s ? s.state : 'unknown';
    const NOM = ${JSON.stringify(NOMBRES)};
    const disparada = st === 'triggered';
    const armada = st.indexOf('armed') === 0;
    const col = disparada ? '${T.peligro}' : (armada ? '${T.okTexto}' : '${T.alerta}');
    const ico = disparada ? 'mdi:shield-alert' : (armada ? 'mdi:shield-check' : 'mdi:shield-home');
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:14px;width:100%">'
      + '<span style="width:88px;height:88px;border-radius:50%;display:grid;place-items:center;background:' + col + '22">'
      +   '<ha-icon icon="' + ico + '" style="color:' + col + ';--mdc-icon-size:44px"></ha-icon></span>'
      + '<div style="text-align:center">'
      +   '<div style="font-family:${T.sora};font-size:26px;font-weight:700;color:' + col + '">' + (NOM[st] || st) + '</div>'
      +   '<div style="font-size:13.5px;color:${T.texto3};margin-top:4px">Alarmo · espeja la Garnet</div>'
      + '</div></div>';
  `),
})

const botonModo = ([estado, servicio, nombre, icono]) => tarjeta({
  entidad: ALARMA,
  tap: { action: 'call-service', service: 'alarm_control_panel.' + servicio, target: { entity_id: ALARMA } },
  radio: R.media,
  relleno: '14px',
  alto: '92px',
  html: js(`
    const activo = states['${ALARMA}'] && states['${ALARMA}'].state === '${estado}';
    const col = activo ? '${T.acentoFg}' : '${T.texto2}';
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;height:100%;'
      + (activo ? 'background:${T.acento};margin:-14px;border-radius:${R.media}px;' : '') + '">'
      + '<ha-icon icon="${icono}" style="color:' + col + ';--mdc-icon-size:24px"></ha-icon>'
      + '<span style="font-size:15px;font-weight:600;color:' + col + '">${nombre}</span></div>';
  `),
})

const desarmar = () => tarjeta({
  entidad: ALARMA,
  tap: { action: 'call-service', service: 'alarm_control_panel.alarm_disarm', target: { entity_id: ALARMA } },
  radio: R.media,
  relleno: '16px',
  alto: '68px',
  grid: { columns: 'full' },
  fondo: alfa(T.peligro, 0.10),
  borde: alfa(T.peligro, 0.35),
  html: `<div style="display:flex;align-items:center;justify-content:center;gap:10px;height:100%;color:#ff8095;font-size:17px;font-weight:700">
    <ha-icon icon="mdi:shield-off" style="--mdc-icon-size:22px"></ha-icon>Desarmar</div>`,
})

// -------------------------------------------------------------- pilas

/** Lista de pilas con barra: roja por debajo del 50%. */
const pilas = (entidades) => tarjeta({
  entidad: entidades.length ? entidades[0].entity : undefined,
  relleno: '22px 24px',
  html: js(`
    const L = ${JSON.stringify(entidades.map(e => [e.entity, e.name || e.entity]))};
    const filas = L.map(function (x) {
      const s = states[x[0]];
      const v = s && !isNaN(parseFloat(s.state)) ? Math.round(parseFloat(s.state)) : null;
      const col = v == null ? '${T.texto3}' : (v < 50 ? '${T.peligro}' : (v < 80 ? '${T.alerta}' : '${T.okTexto}'));
      return '<div style="margin-top:14px">'
        + '<div style="display:flex;justify-content:space-between;font-size:14.5px;color:${T.texto2}">'
        +   '<span>' + x[1] + '</span><b style="color:' + col + '">' + (v == null ? '--' : v + '%') + '</b></div>'
        + '<div style="height:6px;border-radius:3px;background:${T.fill};margin-top:7px;overflow:hidden">'
        +   '<div style="height:100%;width:' + (v == null ? 0 : v) + '%;background:' + col + ';border-radius:3px"></div></div>'
        + '</div>';
    }).join('');
    return '<div style="width:100%">'
      + '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">Pilas de los sensores</div>'
      + filas + '</div>';
  `),
})

// --------------------------------------------------------------- lista

/** Lista de entidades con el estado a la derecha, en color. */
const lista = (titulo, entidades, mapa) => tarjeta({
  entidad: entidades.length ? entidades[0].entity : undefined,
  relleno: '22px 24px',
  html: js(`
    const L = ${JSON.stringify(entidades.map(e => [e.entity, e.name || e.entity]))};
    const MAP = ${JSON.stringify(mapa)};
    const filas = L.map(function (x) {
      const s = states[x[0]];
      const st = s ? s.state : 'unknown';
      const m = MAP[st] || [st, '${T.texto2}'];
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-top:1px solid ${T.borde}">'
        + '<span style="font-size:15px;color:${T.texto}">' + x[1] + '</span>'
        + '<b style="font-size:14.5px;color:' + m[1] + '">' + m[0] + '</b></div>';
    }).join('');
    return '<div style="width:100%">'
      + '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3};margin-bottom:6px">${titulo}</div>'
      + filas + '</div>';
  `),
})

const MAPA_ALARMA = {
  disarmed: ['Desarmada', T.alerta],
  armed_home: ['En casa', T.okTexto],
  armed_away: ['Ausente', T.okTexto],
  armed_night: ['Noche', T.okTexto],
  triggered: ['DISPARADA', T.peligro],
  arming: ['Armando…', T.alerta],
  pending: ['Entrando…', T.alerta],
  unavailable: ['Sin conexión', T.texto3],
}

// La lista de aberturas mezcla binary_sensor con la cerradura de la galeria.
const MAPA_ABERTURA = {
  on: ['Abierta', T.peligro],
  off: ['Cerrada', T.okTexto],
  open: ['Abierta', T.peligro],
  unlocked: ['Sin trabar', T.peligro],
  locked: ['Trabada', T.okTexto],
  closed: ['Cerrada', T.okTexto],
  unavailable: ['Sin conexión', T.texto3],
  unknown: ['Sin dato', T.texto3],
}

const MAPA_MOVIMIENTO = {
  on: ['Hay alguien', T.alerta],
  off: ['Sin movimiento', T.texto3],
  unavailable: ['Sin conexión', T.texto3],
}

const MAPA_SIRENA = {
  on: ['SONANDO', T.peligro],
  off: ['En silencio', T.texto3],
  unavailable: ['Sin conexión', T.texto3],
}

// --------------------------------------------------------------- vista

export function vistaAlarma (vieja) {
  const cartas = (vieja.sections || []).flatMap(s => s.cards || [])
  const porTitulo = (re) => cartas.find(c => c.type === 'entities' && re.test(c.title || ''))
  const ents = (c) => (c ? c.entities : []).map(e => (typeof e === 'string' ? { entity: e } : e))

  const paneles = ents(porTitulo(/panel/i))
  const aberturas = ents(porTitulo(/abertura/i))
  const baterias = ents(porTitulo(/pila/i))
  const sirenas = ents(porTitulo(/sirena/i))
  const movimiento = ents(porTitulo(/movimiento/i))
  const historial = cartas.find(c => c.type === 'history-graph')
  const camaras = cartas.filter(c => c.type === 'picture-entity')

  return {
    title: 'Alarma',
    path: 'alarma',
    icon: 'mdi:shield-home',
    type: 'sections',
    max_columns: 2,
    theme: 'Vidrio Animado',
    background: fondoOlas(),
    sections: [
      {
        type: 'grid',
        cards: [
          garnet(),
          escudo(),
          { type: 'grid', columns: 3, square: false, grid_options: { columns: 'full' }, cards: MODOS.map(botonModo) },
          desarmar(),
          lista('Paneles', paneles, MAPA_ALARMA),
          lista('Aberturas', aberturas, MAPA_ABERTURA),
          pilas(baterias),
          lista('Sirenas', sirenas, MAPA_SIRENA),
          cuadro(),
        ],
      },
      {
        type: 'grid',
        cards: [
          lista('Movimiento ahora', movimiento, MAPA_MOVIMIENTO),
          ...(historial ? [marco({ ...historial, title: undefined, grid_options: { columns: 'full' } })] : []),
          rotulo('Cámaras'),
          {
            type: 'grid',
            columns: 2,
            square: false,
            grid_options: { columns: 'full' },
            cards: camaras.map(c => restilarCamara({ ...c, aspect_ratio: '4:3' })),
          },
        ],
      },
      { type: 'grid', column_span: 2, cards: [aire(120), navbar()] },
    ],
  }
}
