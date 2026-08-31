// Vista Redes del Panel Vertical 2.
//
// Arquitectura completa en docs/NETWORK_SECURITY_MONITORING.md
//
// SOLO se dibuja lo que tiene entidad detras y fue verificado. Falta a proposito el
// grafico de ancho de banda, las amenazas de Cloudflare y la CPU del router: **no existen
// todavia**. Dibujarlos ahora seria llenar la vista de `unavailable`, que es justo lo que
// advierte CLAUDE.md. Se agregan cuando esten las fases 2 y 3.
//
// Entidades que usa, todas comprobadas el 28/08/2026:
//   binary_sensor.internet · enlace_wan · router_mikrotik · tunel_cloudflare · pc_oficina
//   sensor.ip_publica · latencia_internet · dispositivos_conectados · estado_de_la_red
//   button.despertar_pc_oficina
//   sensor.fast_com_descarga   (integracion fastdotcom, agregada el 31/08/2026)

import { T, R, alfa, js, tarjeta, aire, cuadro, fondoOlas } from '../diseno.mjs'
import { navbar } from '../navbar.mjs'
import { rotulo } from '../restilar.mjs'

// ------------------------------------------------------------------ cabecera

const cabecera = () => tarjeta({
  entidad: 'sensor.estado_de_la_red',
  tap: { action: 'none' },
  radio: R.grande,
  relleno: '24px 26px',
  grid: { columns: 'full' },
  html: js(`
    const est = states['sensor.estado_de_la_red'];
    const txt = est ? est.state : 'sin datos';
    const bien = txt === 'Todo en orden';
    const col   = bien ? '${T.okTexto}' : '${T.alerta}';
    const punto = bien ? '${T.ok}'      : '${T.alerta}';
    const fondo = bien ? '${T.okFill}'  : '${alfa(T.alerta, 0.12)}';
    const bord  = bien ? '${T.okBorde}' : '${alfa(T.alerta, 0.30)}';

    const ip  = states['sensor.ip_publica'];
    const lat = states['sensor.latencia_internet'];
    const eq  = states['sensor.dispositivos_conectados'];
    const ms  = lat && !isNaN(parseFloat(lat.state)) ? parseFloat(lat.state).toFixed(0) : '--';

    return '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;width:100%">'
      + '<div>'
      +   '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">RED</div>'
      +   '<div style="display:flex;align-items:baseline;gap:12px;margin-top:6px">'
      +     '<span style="font-family:${T.sora};font-size:46px;font-weight:800;line-height:1;color:${T.texto};font-variant-numeric:tabular-nums">' + ms + '</span>'
      +     '<span style="font-size:17px;color:${T.texto2}">ms a internet</span>'
      +   '</div>'
      +   '<div style="font-size:14px;color:${T.texto3};margin-top:6px">'
      +     'IP publica ' + (ip ? ip.state : '--') + '  ·  ' + (eq ? eq.state : '--') + ' equipos en casa'
      +   '</div>'
      + '</div>'
      + '<div style="display:inline-flex;align-items:center;gap:10px;flex:none;background:' + fondo
      +   ';border:1px solid ' + bord + ';color:' + col + ';font-size:16px;font-weight:600;padding:9px 16px;border-radius:99px">'
      +   '<span style="width:9px;height:9px;border-radius:50%;background:' + punto + ';animation:p2-pulso 2.4s infinite"></span>' + txt
      + '</div>'
      + '</div>'
      + '<style>@keyframes p2-pulso{0%,100%{opacity:1}50%{opacity:.45}}</style>';
  `),
})

// -------------------------------------------------------------------- sondas

// Cada sonda: un punto de color, el icono y que significa. El subtitulo dice el
// PORQUE importa, no solo el estado: "on/off" ya lo dice el punto.
const SONDAS = [
  ['binary_sensor.internet',         'mdi:web',            'Internet',  'Salida a 1.1.1.1',      T.okTexto],
  ['binary_sensor.enlace_wan',       'mdi:router-network', 'Modem',     'Gateway TU_IP_LAN',   T.info],
  ['binary_sensor.router_mikrotik',  'mdi:router',         'MikroTik',  'TU_IP_LAN',           T.acento],
  ['binary_sensor.tunel_cloudflare', 'mdi:cloud-check',    'Tunel',     'tu-dominio.ejemplo',   T.ambar],
  ['binary_sensor.pc_oficina',       'mdi:desktop-tower',  'PC Oficina','TU_IP_LAN',         T.lima],
]

const sonda = ([ent, ico, nombre, sub, color]) => tarjeta({
  entidad: ent,
  tap: { action: 'more-info' },
  radio: R.media,
  relleno: '14px 16px',
  alto: '92px',
  html: js(`
    const s = states['${ent}'];
    const on = !!s && s.state === 'on';
    const col   = on ? '${color}'   : '${T.peligro}';
    const punto = on ? '${T.ok}'    : '${T.peligro}';
    return '<div style="display:flex;align-items:center;gap:12px;width:100%">'
      + '<span style="width:38px;height:38px;border-radius:12px;background:' + (on ? '${alfa(color, 0.18)}' : '${alfa(T.peligro, 0.16)}') + ';display:grid;place-items:center;flex:none">'
      +   '<ha-icon icon="${ico}" style="color:' + col + ';--mdc-icon-size:21px"></ha-icon>'
      + '</span>'
      + '<span style="flex:1;min-width:0">'
      +   '<span style="display:block;font-size:15px;font-weight:600;color:${T.texto};line-height:1.2">${nombre}</span>'
      +   '<span style="display:block;font-size:12.5px;color:${T.texto3};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub}</span>'
      + '</span>'
      + '<span style="width:9px;height:9px;border-radius:50%;background:' + punto + ';flex:none"></span>'
      + '</div>';
  `),
})

const sondas = () => ({
  type: 'grid',
  columns: 2,
  square: false,
  grid_options: { columns: 'full' },
  cards: SONDAS.map(sonda),
})

// ------------------------------------------------------------------ graficos

const estiloGrafico = `
  ha-card { background: none !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
  .info { padding: 0 20px 8px !important; }
  .info__item__value { font-size: 14px !important; font-weight: 600 !important; color: ${T.texto} !important; }
  .info__item__type, .info__item__time { font-size: 11.5px !important; color: ${T.texto3} !important; }
`

/**
 * Latencia a internet, 24 h.
 *
 * Los umbrales NO son inventados: 60 ms es lo normal de una fibra argentina a
 * Cloudflare (medido NN ms el 28/08, con margen), y arriba de 150 ms ya se nota
 * en una videollamada. Se revisan cuando haya una semana de historia.
 */
const latencia = () => ({
  type: 'custom:mini-graph-card',
  name: 'Latencia a internet · 3 h',
  icon: 'mdi:speedometer',
  grid_options: { columns: 'full' },
  entities: [{ entity: 'sensor.latencia_internet', name: 'Latencia' }],
  // 3 h por lo mismo que los de trafico: los sensores son del 28/08 y pedir mas
  // historia de la que existe hace que mini-graph-card rellene con el primer valor
  // y dibuje una recta que parece un sensor congelado. Subir a medida que se acumule.
  hours_to_show: 3,
  points_per_hour: 20,
  line_width: 2,
  decimals: 0,
  height: 70,
  show: { labels: true, points: false, icon: true, state: true, extrema: true, average: true },
  color_thresholds: [
    { value: 0, color: T.okTexto },
    { value: 60, color: T.alerta },
    { value: 150, color: T.peligro },
  ],
  card_mod: { style: estiloGrafico },
})

const equipos = () => ({
  type: 'custom:mini-graph-card',
  name: 'Equipos conectados · 12 h',
  icon: 'mdi:lan-connect',
  grid_options: { columns: 'full' },
  entities: [{ entity: 'sensor.dispositivos_conectados', name: 'Equipos', color: T.info }],
  hours_to_show: 12,
  points_per_hour: 6,
  line_width: 2,
  decimals: 0,
  height: 70,
  show: { labels: true, points: false, icon: true, state: true, extrema: true },
  card_mod: { style: estiloGrafico },
})

// -------------------------------------------------------- capacidad de la linea

// Integracion `fastdotcom`, instalada el 31/08/2026.
//
// QUE MIDE Y QUE NO, porque la diferencia decide como se dibuja:
//
//   - **Solo bajada.** No da subida ni ping. Los graficos de `sensor.wan_bajada` y
//     `sensor.wan_subida` que ya estan mas abajo miden **lo que se esta usando**; esto mide
//     **lo que la linea puede dar**. Son cosas distintas y por eso va en su propia seccion.
//   - **Se mide DESDE HA**, que corre en una VM de VirtualBox sobre la mini PC del panel.
//     El 28/08 Persona 1 midio **1,1 Gbps con fast.com desde la PC de la oficina**; HA marca
//     ~750. La diferencia puede ser la VM, el momento del dia, o el servidor que le toco a
//     cada uno. **No esta medido cual de las tres.**
//
// Por eso la tarjeta NO dice "tu internet anda a X". Dice de donde salio el numero. Un panel
// que afirma mas de lo que sabe es peor que uno que no muestra nada.
//
// PARA QUE SIRVE IGUAL, y no es poco: como linea de base. Si esto vive en ~750 y un dia
// marca 80, hay un problema real — sin importar cual sea el techo verdadero de la linea.

const FAST = 'sensor.fast_com_descarga'

// Referencia para el color. 750 es lo que midio HA el 31/08; no es el plan contratado, que
// **no esta confirmado** (ver MIKROTIK_HARDENING_AND_OPTIMIZATION.md §2.3: la WAN esta en un
// puerto de 1 Gbps y sobra un puerto de 2,5 sin usar).
const FAST_REF = 750

const velocidad = () => tarjeta({
  entidad: FAST,
  tap: { action: 'more-info' },
  radio: R.grande,
  relleno: '24px 26px',
  grid: { columns: 'full' },
  html: js(`
    const s = states['${FAST}'];
    const v = s && !isNaN(parseFloat(s.state)) ? parseFloat(s.state) : null;
    const pct = v === null ? 0 : Math.min(100, v / ${FAST_REF} * 100);

    // Los cortes salen de la referencia medida, no de un numero redondo: la mitad de lo
    // habitual ya es raro, y un quinto es una falla.
    const col = v === null ? '${T.texto3}'
      : (v >= ${FAST_REF} * 0.6 ? '${T.okTexto}'
      : (v >= ${FAST_REF} * 0.2 ? '${T.alerta}' : '${T.peligro}'));

    // Cuanto hace que se midio. Si tiene mas de 3 h el numero es viejo y hay que decirlo:
    // la integracion consulta sola cada una hora.
    let cuando = 'sin medir';
    if (s) {
      const min = Math.floor((Date.now() - Date.parse(s.last_changed)) / 60000);
      cuando = min < 1 ? 'recien' : (min < 60 ? 'hace ' + min + ' min' : 'hace ' + Math.floor(min / 60) + ' h');
    }

    return '<div style="width:100%">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline">'
      +   '<span style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">Capacidad de bajada</span>'
      +   '<span style="font-size:13px;color:${T.texto3}">' + cuando + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:baseline;gap:12px;margin-top:8px">'
      +   '<span style="font-family:${T.sora};font-size:46px;font-weight:800;line-height:1;color:' + col + ';font-variant-numeric:tabular-nums">'
      +     (v === null ? '--' : v.toFixed(0)) + '</span>'
      +   '<span style="font-size:17px;color:${T.texto2}">Mbit/s</span>'
      + '</div>'
      + '<div style="height:6px;border-radius:3px;background:${T.fill};margin-top:14px;overflow:hidden">'
      +   '<div style="height:100%;width:' + pct.toFixed(0) + '%;background:' + col + ';border-radius:3px"></div></div>'
      // La letra chica no es decorativa: sin ella el numero se lee como "la velocidad de
      // internet de la casa", y no es eso.
      + '<div style="font-size:12.5px;color:${T.texto3};margin-top:10px;line-height:1.45">'
      +   'fast.com medido <b style="color:${T.texto2}">desde Home Assistant</b>, que corre en una máquina virtual. '
      +   'Sirve como referencia contra sí misma: lo habitual son ~${FAST_REF}. No mide subida ni ping.'
      + '</div>'
      + '</div>';
  `),
})

// Botón aparte y no un toque en la tarjeta grande: medir descarga cientos de MB, y este
// panel está en la pared de un pasillo donde se lo roza sin querer.
const medirAhora = () => tarjeta({
  entidad: FAST,
  tap: { action: 'call-service', service: 'homeassistant.update_entity', service_data: { entity_id: FAST } },
  radio: R.media,
  relleno: '14px 18px',
  alto: '62px',
  grid: { columns: 'full' },
  fondo: alfa(T.acento, 0.10),
  borde: alfa(T.acento, 0.32),
  html: `<div style="display:flex;align-items:center;justify-content:center;gap:10px;height:100%;color:${T.acento};font-size:15px;font-weight:600">
    <ha-icon icon="mdi:speedometer" style="--mdc-icon-size:20px"></ha-icon>Medir ahora</div>`,
})

const velocidadHistoria = () => ({
  type: 'custom:mini-graph-card',
  name: 'Capacidad · 24 h',
  icon: 'mdi:download-network',
  grid_options: { columns: 'full' },
  entities: [{ entity: FAST, name: 'Bajada' }],
  // Un punto por hora porque la integracion mide una vez por hora: pedir mas resolucion
  // dibujaria escalones planos entre medicion y medicion, que se leen como un sensor trabado.
  // Y 24 h y no una semana porque el sensor es del 31/08: mini-graph-card rellena lo que no
  // existe con el primer valor y pinta una recta que parece un sensor congelado.
  hours_to_show: 24,
  points_per_hour: 1,
  line_width: 2,
  decimals: 0,
  height: 70,
  show: { labels: true, points: true, icon: true, state: true, extrema: true, average: true },
  color_thresholds: [
    { value: 0, color: T.peligro },
    { value: FAST_REF * 0.2, color: T.alerta },
    { value: FAST_REF * 0.6, color: T.okTexto },
  ],
  card_mod: { style: estiloGrafico },
})

// ------------------------------------------------------------------- trafico

const cifra = ([ent, ico, nombre, color]) => tarjeta({
  entidad: ent,
  tap: { action: 'more-info' },
  radio: R.media,
  relleno: '14px 16px',
  alto: '92px',
  html: js(`
    const s = states['${ent}'];
    const v = s && !isNaN(parseFloat(s.state)) ? parseFloat(s.state) : null;
    const u = s ? (s.attributes.unit_of_measurement || '') : '';
    return '<div style="display:flex;flex-direction:column;justify-content:space-between;height:100%;width:100%">'
      + '<div style="display:flex;align-items:center;gap:8px">'
      +   '<ha-icon icon="${ico}" style="color:${color};--mdc-icon-size:18px"></ha-icon>'
      +   '<span style="font-size:12.5px;color:${T.texto3}">${nombre}</span>'
      + '</div>'
      + '<div style="display:flex;align-items:baseline;gap:5px">'
      +   '<span style="font-size:26px;font-weight:700;color:${T.texto};line-height:1;font-variant-numeric:tabular-nums">'
      +     (v === null ? '--' : v) + '</span>'
      +   '<span style="font-size:13px;color:${T.texto2}">' + u + '</span>'
      + '</div>'
      + '</div>';
  `),
})

/**
 * Bajada y subida en Mbit/s, sobre `ether2` (ifIndex 20 por SNMP).
 *
 * DOS GRAFICOS SEPARADOS, NO UNO CON LAS DOS LINEAS. Al principio iban juntos y no se
 * entendia nada: la subida ronda los 6 Mbit/s y la bajada los 0,2, asi que en un eje
 * compartido la bajada quedaba aplastada contra el piso, plana.
 *
 * 3 HORAS, NO 24. Con `hours_to_show: 24` y solo dos horas de historia, mini-graph-card
 * **repite el primer valor conocido hacia atras** para llenar el hueco: 22 horas de linea
 * recta que no son datos. Se ve como si el valor nunca cambiara. Cuando haya dias de
 * historia se puede subir, pero nunca por encima de lo que existe.
 *
 * `smoothing: false` a proposito: la curva bezier inventa valores entre puntos y aca
 * interesa el escalon real.
 */
const grafico = (ent, nombre, color, umbrales) => ({
  type: 'custom:mini-graph-card',
  name: nombre,
  grid_options: { columns: 'full' },
  entities: [{ entity: ent, name: nombre }],
  hours_to_show: 3,
  points_per_hour: 60,
  line_width: 2,
  decimals: 2,
  height: 62,
  smoothing: false,
  show: { labels: true, points: false, icon: false, state: true, extrema: true, average: true },
  color_thresholds: umbrales,
  card_mod: { style: estiloGrafico },
})

const traficoBajada = () => grafico('sensor.wan_bajada', 'Bajada · 3 h', T.info, [
  { value: 0, color: T.info },
  { value: 20, color: T.okTexto },
  { value: 80, color: T.alerta },
])

const traficoSubida = () => grafico('sensor.wan_subida', 'Subida · 3 h', T.rosa, [
  { value: 0, color: T.rosa },
  { value: 10, color: T.alerta },
  { value: 25, color: T.peligro },
])

// Los dos numeros grandes de ahora mismo. El grafico cuenta la historia; esto contesta
// "que esta pasando en este segundo", que es lo que se mira al pasar.
const AHORA = [
  ['sensor.wan_bajada', 'mdi:download-network', 'Bajando ahora', T.info],
  ['sensor.wan_subida', 'mdi:upload-network', 'Subiendo ahora', T.rosa],
]

const ahora = () => ({
  type: 'grid',
  columns: 2,
  square: false,
  grid_options: { columns: 'full' },
  cards: AHORA.map(cifra),
})

// Consumo del dia y del mes, mas la CPU del router. Tres numeros de un vistazo.
const CONSUMO = [
  ['sensor.datos_bajados_hoy', 'mdi:download', 'Bajado hoy', T.info],
  ['sensor.datos_subidos_hoy', 'mdi:upload', 'Subido hoy', T.rosa],
  ['sensor.datos_del_mes', 'mdi:calendar-month', 'Este mes', T.acento],
  ['sensor.mikrotik_cpu', 'mdi:cpu-64-bit', 'CPU router', T.lima],
]

const consumo = () => ({
  type: 'grid',
  columns: 4,
  square: false,
  grid_options: { columns: 'full' },
  cards: CONSUMO.map(cifra),
})

// ----------------------------------------------------------------- malla wifi

/**
 * Estado de la malla Deco.
 *
 * Los nodos se descubren solos: son los `device_tracker` que TERMINAN en `_deco` (los
 * clientes llevan el nodo como prefijo). Asi agregar o sacar un nodo no obliga a tocar
 * esta tarjeta.
 *
 * Un nodo caido es una zona de la casa sin WiFi y no avisa nada: el 28/08 se descubrio
 * de casualidad que el BE25 del living llevaba tiempo apagado. Por eso ademas de la
 * tarjeta hay una automatizacion.
 */
const malla = () => tarjeta({
  entidad: 'sensor.nodos_de_la_malla',
  tap: { action: 'none' },
  radio: R.media,
  relleno: '16px 18px',
  grid: { columns: 'full' },
  html: js(`
    const nodos = Object.keys(states)
      .filter(e => e.indexOf('device_tracker.') === 0 && /_deco$/.test(e))
      .sort();
    if (!nodos.length) return '<span style="color:${T.texto3};font-size:14px">Sin nodos Deco</span>';

    const fila = nodos.map(function (e) {
      const on = states[e].state === 'home';
      const nom = (states[e].attributes.friendly_name || e).replace(/ Deco$/i, '');
      // Clientes de ese nodo: los device_tracker que lo llevan de prefijo.
      const pref = e + '_';
      const cli = Object.keys(states).filter(function (c) {
        return c.indexOf(pref) === 0 && states[c].state === 'home';
      }).length;
      const col = on ? '${T.okTexto}' : '${T.peligro}';
      const punto = on ? '${T.ok}' : '${T.peligro}';
      return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid ${T.borde}">'
        + '<span style="width:8px;height:8px;border-radius:50%;background:' + punto + ';flex:none"></span>'
        + '<span style="flex:1;min-width:0;font-size:14.5px;color:${T.texto};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + nom + '</span>'
        + '<span style="font-size:13px;color:${T.texto3};flex:none">' + (on ? cli + ' equipos' : 'sin conexion') + '</span>'
        + '<span style="font-size:13px;color:' + col + ';flex:none;width:58px;text-align:right">' + (on ? 'en linea' : 'caido') + '</span>'
        + '</div>';
    }).join('');

    const caidos = nodos.filter(function (e) { return states[e].state !== 'home'; }).length;
    const col = caidos ? '${T.peligro}' : '${T.okTexto}';
    return '<div style="width:100%">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">'
      +   '<span style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">MALLA WIFI</span>'
      +   '<span style="font-size:13px;color:' + col + '">' + (nodos.length - caidos) + ' de ' + nodos.length + ' en pie</span>'
      + '</div>' + fila
      + '</div>';
  `),
})

// ------------------------------------------------------ la red fisica de la casa

/**
 * Los dos MikroTik: temperatura, carga, desde cuando estan encendidos, y **quien gobierna
 * el arbol de expansion**.
 *
 * POR QUE ESTA TARJETA EXISTE. Toda la vista Redes miraba hacia afuera —internet, latencia,
 * Cloudflare, la malla Deco— y no habia una sola linea sobre el cableado de la casa. Los
 * dos MikroTik son los unicos equipos que informan temperatura, tension de fuente y estado
 * de la capa 2.
 *
 * EL DATO QUE MAS IMPORTA ES EL DEL ARBOL, y no es obvio. El 29/08/2026 se descubrio que el
 * puente raiz de la casa era el switch virtual del QNAP: los tres puentes habian quedado con
 * la prioridad de fabrica y RSTP desempato por la MAC mas baja. **Nadie se entero nunca**,
 * porque no hay ningun evento que avise: el arbol se reorganiza y la red sigue andando,
 * hasta que el equipo que quedo de raiz reinicia y se lleva la red por delante. Un numero en
 * la pantalla lo habria delatado el primer dia.
 *
 * Sensores en packages/red_fisica.yaml. Los OID se probaron uno por uno y **no son los
 * mismos en los dos equipos**: el router informa temperatura de CPU y el switch temperatura
 * de placa y tension.
 */
const equipo = (nombre, modelo, sTemp, sCpu, sDesde, sExtra) => `
  (function () {
    const n = function (e) { const s = states[e]; return s && !isNaN(parseFloat(s.state)) ? parseFloat(s.state) : null; };
    const t = n('${sTemp}');
    const c = n('${sCpu}');
    ${sExtra ? `const v = n('${sExtra}');` : 'const v = null;'}
    // Temperatura: por encima de 60 el equipo esta pidiendo aire.
    const colT = t == null ? '${T.texto3}' : (t >= 60 ? '${T.peligro}' : (t >= 50 ? '${T.alerta}' : '${T.okTexto}'));

    const d = states['${sDesde}'];
    let desde = '--';
    if (d && d.state && d.state.indexOf('20') === 0) {
      const h = (Date.now() - new Date(d.state).getTime()) / 3600000;
      desde = h < 1 ? Math.round(h * 60) + ' min'
            : (h < 48 ? Math.round(h) + ' h' : Math.round(h / 24) + ' dias');
    }
    return '<div style="flex:1;min-width:0">'
      + '<div style="font-size:13px;color:${T.texto3};letter-spacing:1px">' + '${nombre}'.toUpperCase() + '</div>'
      + '<div style="font-size:11.5px;color:${T.texto3};margin-bottom:6px">${modelo}</div>'
      + '<div style="display:flex;align-items:baseline;gap:5px">'
      +   '<span style="font-family:${T.sora};font-size:26px;font-weight:700;color:' + colT + '">' + (t == null ? '--' : t.toFixed(0)) + '</span>'
      +   '<span style="font-size:13px;color:${T.texto2}">°C</span>'
      +   (v == null ? '' : '<span style="font-size:12.5px;color:${T.texto3};margin-left:8px">' + v.toFixed(1) + ' V</span>')
      + '</div>'
      + '<div style="font-size:12.5px;color:${T.texto3};margin-top:5px">'
      +   'CPU ' + (c == null ? '--' : c.toFixed(0) + ' %') + ' · hace ' + desde
      + '</div>'
      + '</div>';
  })()`

const columnaVertebral = () => tarjeta({
  entidad: 'sensor.arbol_de_expansion',
  tap: { action: 'none' },
  radio: R.media,
  relleno: '16px 18px',
  grid: { columns: 'full' },
  html: js(`
    const a = states['sensor.arbol_de_expansion'];
    const quien = a ? a.state : 'sin dato';
    // Verde solo si manda el router. Cualquier otra cosa es un aviso, no un error: la red
    // funciona igual, pero la topologia quedo colgando de un equipo que no corresponde.
    const bien = quien === 'el router';
    const colA = bien ? '${T.okTexto}' : (quien === 'sin dato' ? '${T.texto3}' : '${T.alerta}');

    return '<div style="width:100%">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px">'
      +   '<span style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">COLUMNA VERTEBRAL</span>'
      +   '<span style="font-size:12.5px;color:' + colA + '">árbol: ' + quien + (bien ? ' ✓' : '') + '</span>'
      + '</div>'
      + '<div style="display:flex;gap:14px;width:100%">'
      +   ${equipo('Router', 'RB5009', 'sensor.router_temperatura', 'sensor.mikrotik_cpu', 'sensor.router_encendido_desde', null)}
      +   '<span style="width:1px;background:${T.borde};flex:none"></span>'
      +   ${equipo('Switch', 'CRS109', 'sensor.switch_temperatura', 'sensor.switch_cpu', 'sensor.switch_encendido_desde', 'sensor.switch_tension')}
      + '</div>'
      + '</div>';
  `),
})

/**
 * Las nueve bocas del switch, con la velocidad que negocio cada una.
 *
 * NO HAY SENSOR DE ENLACE Y ES A PROPOSITO: Home Assistant **no tiene** plataforma
 * `binary_sensor` para SNMP —se probo, no da error y no crea nada— asi que el estado sale
 * de la velocidad, que devuelve 0 cuando la boca esta libre.
 *
 * Ambar cuando una boca gigabit negocia por debajo de 1000: casi siempre es cable dañado o
 * conector flojo, y se ve semanas antes de que el enlace se caiga del todo. El 29/08
 * `ether5` estaba en 100 Mb.
 */
const PUERTOS = [
  ['sensor.switch_ether1_velocidad', 'e1', ''],
  ['sensor.switch_ether2_velocidad', 'e2', ''],
  ['sensor.switch_ether3_velocidad', 'e3', ''],
  ['sensor.switch_ether4_velocidad', 'e4', 'Dormitorio'],
  ['sensor.switch_ether5_velocidad', 'e5', ''],
  ['sensor.switch_ether6_velocidad', 'e6', ''],
  ['sensor.switch_ether7_velocidad', 'e7', 'Living'],
  ['sensor.switch_ether8_velocidad', 'e8', 'Deco'],
  ['sensor.switch_sfp1_velocidad', 'sfp', 'al router'],
]

const puertosSwitch = () => tarjeta({
  entidad: 'sensor.switch_sfp1_velocidad',
  tap: { action: 'none' },
  radio: R.media,
  relleno: '16px 18px',
  grid: { columns: 'full' },
  html: js(`
    const L = ${JSON.stringify(PUERTOS)};
    let arriba = 0, lentos = 0;

    const cajas = L.map(function (p) {
      const s = states[p[0]];
      const v = s && !isNaN(parseFloat(s.state)) ? parseFloat(s.state) : null;
      const on = v != null && v > 0;
      const lento = on && v < 1000;
      if (on) arriba++;
      if (lento) lentos++;

      const col = !on ? '${T.texto3}' : (lento ? '${T.alerta}' : '${T.okTexto}');
      const fondo = !on ? '${T.fill}' : (lento ? '${alfa(T.alerta, 0.16)}' : '${alfa(T.ok, 0.14)}');
      const dice = !on ? 'libre' : (v >= 1000 ? '1 Gb' : v + ' Mb');

      return '<div style="flex:1;min-width:0;background:' + fondo + ';border-radius:10px;'
        + 'padding:8px 4px;text-align:center;border:1px solid ' + (lento ? '${alfa(T.alerta, 0.45)}' : 'transparent') + '">'
        + '<div style="font-size:12px;font-weight:600;color:${T.texto}">' + p[1] + '</div>'
        + '<div style="font-size:10.5px;color:' + col + ';margin-top:2px">' + dice + '</div>'
        + (p[2] ? '<div style="font-size:9.5px;color:${T.texto3};margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + p[2] + '</div>' : '')
        + '</div>';
    }).join('');

    const col = lentos ? '${T.alerta}' : '${T.texto3}';
    const resumen = arriba + ' de ' + L.length + ' en uso' + (lentos ? ' · ' + lentos + ' lento' + (lentos > 1 ? 's' : '') : '');

    return '<div style="width:100%">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">'
      +   '<span style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">BOCAS DEL SWITCH</span>'
      +   '<span style="font-size:12.5px;color:' + col + '">' + resumen + '</span>'
      + '</div>'
      + '<div style="display:flex;gap:5px;width:100%">' + cajas + '</div>'
      + '</div>';
  `),
})

// ------------------------------------------------------------------ cloudflare

/**
 * Amenazas bloqueadas por Cloudflare. `threats` es lo que su WAF corto antes de que
 * llegara a casa.
 *
 * El grafico arranca vacio y se va llenando: la serie por dia que devuelve la API no es
 * historia de Home Assistant, asi que la curva se construye desde que existe el sensor.
 */
const CLOUDFLARE = [
  ['sensor.cf_amenazas_hoy', 'mdi:shield-alert', 'Amenazas hoy', T.peligro],
  ['sensor.cf_peticiones_hoy', 'mdi:web', 'Peticiones hoy', T.info],
]

const cloudflare = () => ({
  type: 'grid',
  columns: 2,
  square: false,
  grid_options: { columns: 'full' },
  cards: CLOUDFLARE.map(cifra),
})

const amenazas = () => ({
  type: 'custom:mini-graph-card',
  name: 'Amenazas bloqueadas · 24 h',
  icon: 'mdi:shield-alert',
  grid_options: { columns: 'full' },
  entities: [{ entity: 'sensor.cf_amenazas_hoy', name: 'Amenazas' }],
  hours_to_show: 24,
  points_per_hour: 4,
  line_width: 2,
  decimals: 0,
  height: 62,
  smoothing: false,
  show: { labels: true, points: false, icon: false, state: true, extrema: true },
  color_thresholds: [
    { value: 0, color: T.okTexto },
    { value: 10, color: T.alerta },
    { value: 50, color: T.peligro },
  ],
  card_mod: { style: estiloGrafico },
})

// ---------------------------------------------------------------------- vista

export function vistaRedes () {
  return {
    title: 'Redes',
    path: 'redes',
    icon: 'mdi:lan',
    type: 'sections',
    max_columns: 2,
    theme: 'Vidrio Animado',
    background: fondoOlas(),
    sections: [
      { type: 'grid', column_span: 2, cards: [cabecera(), cuadro()] },
      { type: 'grid', column_span: 2, cards: [rotulo('Sondas'), sondas()] },
      { type: 'grid', column_span: 2, cards: [rotulo('Internet'), ahora()] },
      // La capacidad va DESPUES del trafico en vivo y antes de los graficos de uso: primero
      // que se ve cuanto se esta usando, y despues cuanto se podria.
      { type: 'grid', column_span: 2, cards: [rotulo('Capacidad de la linea'), velocidad(), medirAhora(), velocidadHistoria()] },
      { type: 'grid', cards: [traficoBajada()] },
      { type: 'grid', cards: [traficoSubida()] },
      { type: 'grid', column_span: 2, cards: [consumo()] },
      { type: 'grid', cards: [latencia()] },
      { type: 'grid', cards: [equipos()] },
      { type: 'grid', column_span: 2, cards: [malla()] },
      { type: 'grid', column_span: 2, cards: [rotulo('La red de la casa'), columnaVertebral(), puertosSwitch()] },
      { type: 'grid', column_span: 2, cards: [rotulo('Cloudflare'), cloudflare(), amenazas()] },
      { type: 'grid', column_span: 2, cards: [aire(120), navbar()] },
    ],
  }
}
