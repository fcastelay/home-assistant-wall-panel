// Vista Salud del Panel Vertical 2. Especificación: IMPLEMENTAR-SALUD.md (31/08/2026).
//
// DE DONDE SALE CADA DATO, que es la regla que evita el error mas caro de esta vista:
//
//     cuerpo y presion   Withings          balanza Body+ y tensiometro BPM Connect
//     corazon y hoy      HealthKit         sensor.iphone_de_persona1_*, incluye el Apple Watch
//     sueno              input_number      un Atajo del iPhone, la unica fuente que hay
//     bici               Garmin            last_activity + last_activity_route
//
// Hay TRES pesos distintos en Home Assistant (Withings NN · HealthKit NN · el Atajo
// NN) y dos grasas corporales que no coinciden. Se usa siempre el aparato que mide de
// verdad. La lista de lo prohibido esta en NO_USAR, mas abajo, con el motivo de cada una.
//
// DOS COSAS DE LA ESPECIFICACION NO SE PUDIERON HACER, y no se disimularon:
//
// 1. **El grafico de velocidad de la salida.** Pedia `apexcharts-card`, que **no esta
//    instalado** en esta casa — hay `mini-graph-card` y `card-mod`, nada mas. Y aunque
//    estuviera, no habria que dibujarlo: la actividad de Garmin expone `averageSpeed` y
//    `maxSpeed`, dos numeros sueltos. **No hay serie temporal de velocidad.** Un area chart
//    con dos puntos es una linea recta inventada.
//
// 2. **La caminata del Apple Watch.** La app Companion no expone ningun sensor de
//    entrenamientos: se revisaron los 54 que manda el telefono. El unico que existia venia
//    de Health Bridge, que se dio de baja. Se deja la fila con el estado vacio, que es lo
//    que la propia especificacion manda hacer cuando el dato no existe.
//
// EL MAPA NO ES LA TARJETA `map` DE HA, y tampoco es un capricho: la tarjeta nativa dibuja
// entidades con latitud y longitud, una por una. **No sabe trazar una polilinea de 255
// puntos guardada en un atributo.** Se dibuja un SVG a mano desde `polyline`, que ademas no
// agrega ninguna dependencia y se ve mejor sobre el fondo oscuro.

import { T, R, alfa, js, tarjeta, aire, cuadro, fondoOlas } from '../diseno.mjs'
import { navbar } from '../navbar.mjs'

// ------------------------------------------------------------------ entidades

const E = {
  // Withings
  peso: 'sensor.withings_peso',
  pesoObj: 'sensor.withings_objetivo_de_peso',
  muscular: 'sensor.withings_masa_muscular',
  grasaKg: 'sensor.withings_grasa_corporal',
  grasaPct: 'sensor.withings_proporcion_de_grasa',
  osea: 'sensor.withings_masa_osea',
  libreGrasa: 'sensor.withings_masa_libre_de_grasa',
  sis: 'sensor.dormitorio_withings_systolic_blood_pressure',
  dia: 'sensor.dormitorio_withings_diastolic_blood_pressure',
  pulsoMed: 'sensor.dormitorio_withings_heart_pulse',
  metaPasos: 'sensor.withings_objetivo_de_paso',
  batBalanza: 'sensor.body_bateria',
  batTensio: 'sensor.bpm_connect_battery',
  // HealthKit
  fc: 'sensor.iphone_de_persona1_heart_rate',
  fcReposo: 'sensor.iphone_de_persona1_resting_heart_rate',
  fcCamina: 'sensor.iphone_de_persona1_walking_heart_rate_average',
  hrv: 'sensor.iphone_de_persona1_heart_rate_variability',
  vo2: 'sensor.iphone_de_persona1_vo2_max',
  spo2: 'sensor.iphone_de_persona1_blood_oxygen',
  resp: 'sensor.iphone_de_persona1_respiratory_rate',
  altura: 'sensor.iphone_de_persona1_height',
  pasos: 'sensor.iphone_de_persona1_health_steps',
  distancia: 'sensor.iphone_de_persona1_walking_running_distance',
  pisos: 'sensor.iphone_de_persona1_flights_climbed',
  ejercicio: 'sensor.iphone_de_persona1_exercise_time',
  kcalAct: 'sensor.iphone_de_persona1_active_energy',
  kcalRep: 'sensor.iphone_de_persona1_resting_energy',
  batWatch: 'sensor.iphone_de_persona1_watch_battery_level',
  // Otros
  // El nombre sale de HA y no escrito a mano: si algun dia se renombra la persona, el
  // titulo acompana. Es lo mismo que ya se hace con la edad y la altura.
  persona: 'person.persona1',
  sueno: 'input_number.sueno_apple_salud',
  edad: 'sensor.garmin_connect_chronological_age',
  salida: 'sensor.garmin_connect_last_activity',
  ruta: 'sensor.garmin_connect_last_activity_route',
}

// Prohibidas, con el motivo. Esta lista es documentacion ejecutable: si alguien la agrega
// por descuido, aca esta escrito por que no va.
export const NO_USAR = {
  'sensor.iphone_de_persona1_weight': 'desfasado (NN kg) — la balanza mide NN',
  'sensor.iphone_de_persona1_body_fat_percentage': 'estimado (NN %) — la balanza mide NN por bioimpedancia',
  'sensor.iphone_de_persona1_steps': 'podometro del telefono: NO cuenta lo que camina el Apple Watch',
  'sensor.iphone_de_persona1_distance': 'idem, solo el telefono',
  'input_number.peso_apple_salud': 'del Atajo, desfasado (NN kg)',
  'input_number.pulso_reposo_apple_salud': 'del Atajo, desfasado (NN bpm)',
}

// EL UNICO UMBRAL CLINICO PERMITIDO. La especificacion es explicita: sin diagnosticos, sin
// rangos, sin semaforos de tres colores. Solo pintar de ambar 140/90 para arriba, que es el
// corte que usa la propia app de Withings para marcar una lectura.
const SIS_ALTA = 140
const DIA_ALTA = 90

// ------------------------------------------------------------------ utilidades JS

/** Trozo de JS, comun a varias tarjetas: helpers de lectura y de tiempo relativo. */
const HELPERS = `
  const g = function (id) { const s = states[id]; return s ? s.state : null; };
  const num = function (id, d) { const v = parseFloat(g(id)); return isNaN(v) ? null : v; };
  const fmt = function (v, d) { return v === null ? '--' : v.toFixed(d === undefined ? 0 : d).replace('.', ','); };
  // "hace X" en castellano. Se corta en dias: para algo de hace meses interesa la fecha,
  // no cuantas horas van.
  const hace = function (id) {
    const s = states[id]; if (!s) return '--';
    const m = Math.floor((Date.now() - Date.parse(s.last_changed)) / 60000);
    if (m < 1) return 'recien';
    if (m < 60) return 'hace ' + m + ' min';
    if (m < 1440) return 'hace ' + Math.floor(m / 60) + ' h';
    const d = Math.floor(m / 1440);
    return 'hace ' + d + (d === 1 ? ' dia' : ' dias');
  };
  const dias = function (id) {
    const s = states[id]; if (!s) return 0;
    return (Date.now() - Date.parse(s.last_changed)) / 86400000;
  };
  const fecha = function (id) {
    const s = states[id]; if (!s) return '--';
    const f = new Date(s.last_changed);
    const dd = String(f.getDate()).padStart(2, '0'), mm = String(f.getMonth() + 1).padStart(2, '0');
    return dd + '/' + mm + ' · ' + String(f.getHours()).padStart(2, '0') + ':' + String(f.getMinutes()).padStart(2, '0');
  };
`

const ROTULO = (texto, color = T.texto3) =>
  `<span style="font-size:12.5px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${color}">${texto}</span>`

// ------------------------------------------------------------------ 1. cabecera

const cabecera = () => tarjeta({
  entidad: E.batWatch,
  // Tendencias no esta en la barra —es para mirar sentado, no de paso— asi que la unica
  // puerta es esta. Sin el toque, la vista existiria y nadie llegaria.
  tap: { action: 'navigate', navigation_path: 'tendencias' },
  relleno: '22px 26px',
  grid: { columns: 'full' },
  html: js(`${HELPERS}
    // "high" es lo que devuelve Withings para sus baterias: no es un porcentaje.
    const bat = function (id) { const v = g(id); return v === null ? '--' : (v === 'high' ? 'OK' : (v === 'medium' ? 'media' : (v === 'low' ? 'BAJA' : v))); };
    // El nombre visible de la persona. Si la entidad no estuviera —o quedara sin nombre
    // amigable— cae en 'Persona 1': un titulo vacio se veria roto, y esto es solo una etiqueta.
    const per = states['${E.persona}'];
    const nombre = (per && per.attributes && per.attributes.friendly_name) || 'Persona 1';
    const w = num('${E.batWatch}');
    return '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:18px;width:100%">'
      + '<div>'
      +   '<div style="font-family:${T.sora};font-size:40px;font-weight:800;line-height:1;color:${T.texto}">Mi Salud</div>'
      +   '<div style="font-size:15px;color:${T.texto2};margin-top:7px">' + nombre + ' · ' + fmt(num('${E.edad}')) + ' años · ' + fmt(num('${E.altura}')) + ' cm</div>'
      + '</div>'
      + '<div style="text-align:right;font-size:13px;color:${T.texto3};line-height:1.7;flex:none">'
      +   '<div>Watch ' + (w === null ? '--' : fmt(w) + ' %') + '</div>'
      +   '<div>balanza ' + bat('${E.batBalanza}') + ' · tensiómetro ' + bat('${E.batTensio}') + '</div>'
      +   '<div style="margin-top:8px;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;'
      +     'border-radius:${R.pill}px;background:${alfa(T.acento, 0.12)};border:1px solid ${alfa(T.acento, 0.32)};color:${T.acento};font-weight:600">'
      +     '<ha-icon icon="mdi:chart-line" style="--mdc-icon-size:15px"></ha-icon>Tendencias</div>'
      + '</div>'
      + '</div>';
  `),
})

// ------------------------------------------------------------- 2. presión arterial

const presion = () => tarjeta({
  entidad: E.sis,
  tap: { action: 'more-info' },
  relleno: '22px 24px',
  // EL FONDO Y EL BORDE SON DINAMICOS. `button-card` acepta plantillas dentro de `styles`,
  // asi que la tarjeta cambia de piel sola cuando la lectura pasa 140/90 — sin duplicar la
  // tarjeta ni dejar un marco de alerta permanente, que es lo que la volveria invisible.
  extraCard: [
    { background: js(`const s = parseFloat(states['${E.sis}'] && states['${E.sis}'].state);
        const d = parseFloat(states['${E.dia}'] && states['${E.dia}'].state);
        return (s >= ${SIS_ALTA} || d >= ${DIA_ALTA}) ? 'rgba(255,193,79,.08)' : '${T.tarjeta}';`) },
    { border: js(`const s = parseFloat(states['${E.sis}'] && states['${E.sis}'].state);
        const d = parseFloat(states['${E.dia}'] && states['${E.dia}'].state);
        return (s >= ${SIS_ALTA} || d >= ${DIA_ALTA}) ? '1px solid rgba(255,193,79,.35)' : '1px solid ${T.borde}';`) },
  ],
  html: js(`${HELPERS}
    const s = num('${E.sis}'), d = num('${E.dia}');
    const alta = (s !== null && s >= ${SIS_ALTA}) || (d !== null && d >= ${DIA_ALTA});
    // Una lectura de presion envejece distinto que el pulso: se toma a mano, cada varios
    // dias. El ambar entra recien a las 48 h, no a las 2 como en Corazon.
    const vieja = dias('${E.sis}') > 2;
    const bat = function (id) { const v = g(id); return v === null ? '--' : (v === 'high' ? 'OK' : (v === 'medium' ? 'media' : (v === 'low' ? 'BAJA' : v))); };
    const tile = function (etq, val, uni, color) {
      return '<div style="background:rgba(139,147,255,.07);border-radius:12px;padding:10px 11px">'
        + '<div style="font-size:11.5px;color:${T.texto3};letter-spacing:.5px">' + etq + '</div>'
        + '<div style="font-family:${T.sora};font-size:20px;font-weight:600;color:' + color + ';margin-top:3px">'
        + val + (uni ? '<span style="font-size:11.5px;color:${T.texto2};font-weight:400"> ' + uni + '</span>' : '') + '</div></div>';
    };
    const col = alta ? '${T.alerta}' : '${T.texto}';
    const punto = alta
      ? '<span style="width:8px;height:8px;border-radius:50%;background:${T.alerta};display:inline-block;margin-right:7px;animation:p2-lat 2s infinite"></span>'
      : '';
    return '<div style="width:100%">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline">'
      +   '<span>' + punto + ${JSON.stringify(ROTULO('Presión arterial'))}.replace('${T.texto3}', alta ? '${T.alerta}' : '${T.texto3}') + '</span>'
      +   '<span style="font-size:12.5px;color:${T.texto3};flex:none">' + fecha('${E.sis}') + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:baseline;gap:4px;margin-top:10px">'
      +   '<span style="font-family:${T.sora};font-size:56px;font-weight:700;line-height:1;color:' + col + ';font-variant-numeric:tabular-nums">' + fmt(s) + '</span>'
      +   '<span style="font-family:${T.sora};font-size:34px;font-weight:400;color:${T.texto2}">/</span>'
      +   '<span style="font-family:${T.sora};font-size:56px;font-weight:700;line-height:1;color:' + col + ';font-variant-numeric:tabular-nums">' + fmt(d) + '</span>'
      + '</div>'
      + '<div style="font-size:13px;color:${T.texto2};margin-top:9px">mmHg'
      +   (alta ? ' · <b style="color:${T.alerta}">valor alto</b>' : '')
      +   '</div>'
      // TRES FICHAS, y no es relleno decorativo: la tarjeta de Corazon crecio al sacarle el
      // sparkline y esta columna quedaba con un hueco. Se llena con lo que la propia
      // medicion trae —el pulso—, con el estado del aparato que la tomo, y con cuanto hace.
      // Nada calculado ni interpretado: los tres son datos que ya existen.
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:14px">'
      +   tile('Pulso al medir', fmt(num('${E.pulsoMed}')), 'bpm', '${T.rosa}')
      +   tile('Tensiómetro', bat('${E.batTensio}'), '', '${T.texto}')
      +   tile('Medida', hace('${E.sis}').replace('hace ', ''), '', vieja ? '${T.alerta}' : '${T.texto}')
      + '</div>'
      + '</div>'
      + '<style>@keyframes p2-lat{0%,100%{opacity:1}50%{opacity:.35}}</style>';
  `),
})

// ------------------------------------------------------------------ 3. corazón

// EL PULSO NO ES EN VIVO, Y LA TARJETA NO PUEDE FINGIR QUE LO ES.
//
// Medido el 31/08/2026 sobre el historial de `sensor.iphone_de_persona1_heart_rate`:
//
//     ultimas  1 h    2 mediciones
//     ultimas 24 h    3 mediciones      15:51 · 16:07 · 16:38
//
// **Tres puntos en todo el dia.** El Apple Watch toma muestras cada tanto y las deja en
// Salud; la app Companion las empuja en su propio horario. No es configuracion: asi entrega
// iOS los datos de HealthKit en segundo plano.
//
// QUE SE SACO Y POR QUE:
//
//   - **El sparkline de la ultima hora.** Con dos puntos dibuja una recta con un escalon.
//     Parece un sensor trabado, que es justo lo que `mini-graph-card` hace cuando se le pide
//     mas historia de la que existe — la misma nota que ya estaba escrita en redes.mjs.
//     Ademas iba como tarjeta aparte, colgando fuera del marco.
//   - **El punto que latia.** Un punto pulsante promete tiempo real. Aca el numero puede
//     tener media hora.
//
// LO QUE SE PUSO EN SU LUGAR: la antiguedad de la lectura como dato de primera linea —en
// ambar si pasa de dos horas— y los tres valores de contexto como fichas legibles en vez de
// una linea apretada. Un numero viejo bien fechado es util; un numero viejo disfrazado de
// vivo, no.

const corazon = () => tarjeta({
  entidad: E.fc,
  tap: { action: 'more-info' },
  relleno: '22px 24px',
  html: js(`${HELPERS}
    const m = Math.floor((Date.now() - Date.parse((states['${E.fc}'] || {}).last_changed || 0)) / 60000);
    const viejo = m > 120;

    const tile = function (etq, val, uni, color) {
      return '<div style="background:rgba(139,147,255,.07);border-radius:12px;padding:10px 11px">'
        + '<div style="font-size:11.5px;color:${T.texto3};letter-spacing:.5px">' + etq + '</div>'
        + '<div style="font-family:${T.sora};font-size:20px;font-weight:600;color:' + color + ';margin-top:3px">'
        + val + '<span style="font-size:11.5px;color:${T.texto2};font-weight:400"> ' + uni + '</span></div></div>';
    };

    return '<div style="width:100%">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline">'
      +   ${JSON.stringify(ROTULO('Corazón'))}
      +   '<span style="font-size:12.5px;color:' + (viejo ? '${T.alerta}' : '${T.texto3}') + ';flex:none">' + hace('${E.fc}') + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:baseline;gap:10px;margin-top:10px">'
      +   '<span style="font-family:${T.sora};font-size:56px;font-weight:700;line-height:1;color:${T.rosa};font-variant-numeric:tabular-nums">' + fmt(num('${E.fc}')) + '</span>'
      +   '<span style="font-size:16px;color:${T.texto2}">bpm</span>'
      + '</div>'
      // La aclaracion no es decorativa: sin ella el numero grande se lee como el pulso de
      // ahora, y puede tener horas. El Watch manda unas pocas muestras por dia.
      + '<div style="font-size:12px;color:${T.texto3};margin-top:8px">última lectura del Apple Watch · no es en vivo</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:14px">'
      +   tile('Reposo', fmt(num('${E.fcReposo}')), 'bpm', '${T.rosa}')
      +   tile('Caminando', fmt(num('${E.fcCamina}')), 'bpm', '#ff9dc4')
      +   tile('HRV', fmt(num('${E.hrv}'), 1), 'ms', '${T.lila}')
      + '</div>'
      + '</div>';
  `),
})

// ------------------------------------------------------------------- 4. cuerpo

const cuerpo = () => tarjeta({
  entidad: E.peso,
  tap: { action: 'more-info' },
  relleno: '22px 26px',
  grid: { columns: 'full' },
  html: js(`${HELPERS}
    const p = num('${E.peso}', 1), obj = num('${E.pesoObj}', 1);
    const mus = num('${E.muscular}'), gra = num('${E.grasaKg}'), os = num('${E.osea}');
    // El progreso al objetivo se mide desde una referencia de arranque, no desde cero: una
    // barra de 0 a NN kg estaria siempre llena y no diria nada. Se toma el peso mas alto
    // conocido —el actual, si es el mayor— como punto de partida.
    const inicio = Math.max(p === null ? 0 : p, obj === null ? 0 : obj + 15);
    const avance = (p === null || obj === null) ? 0
      : Math.max(0, Math.min(100, (inicio - p) / Math.max(1, inicio - obj) * 100));
    const faltan = (p === null || obj === null) ? null : p - obj;

    // Barra apilada de composicion: los anchos son proporcionales a los kg reales sobre el
    // peso total, asi que el hueco que queda a la derecha es agua y organos. No se rellena
    // ni se normaliza a 100: seria dibujar algo que la balanza no midio.
    const total = p || 1;
    const seg = function (kg, color, etq) {
      if (kg === null) return '';
      const w = Math.max(0, kg / total * 100);
      return '<div style="width:' + w.toFixed(1) + '%;background:' + color + ';height:100%;display:flex;'
        + 'align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:#0a0f22;'
        + 'overflow:hidden;white-space:nowrap">' + (etq && w > 12 ? etq : '') + '</div>';
    };

    return '<div style="width:100%">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline">'
      +   ${JSON.stringify(ROTULO('Cuerpo · Withings'))}
      +   '<span style="font-size:12.5px;color:${T.texto3}">' + fecha('${E.peso}') + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:baseline;gap:10px;margin-top:10px">'
      +   '<span style="font-family:${T.sora};font-size:52px;font-weight:700;line-height:1;color:${T.texto};font-variant-numeric:tabular-nums">' + fmt(p, 1) + '</span>'
      +   '<span style="font-size:17px;color:${T.texto2}">kg</span>'
      + '</div>'
      + '<div style="height:11px;border-radius:6px;background:rgba(139,147,255,.12);margin-top:14px;overflow:hidden">'
      +   '<div style="height:100%;width:' + avance.toFixed(0) + '%;border-radius:6px;background:linear-gradient(90deg,${T.acento},${T.info})"></div></div>'
      + '<div style="font-size:13px;color:${T.texto2};margin-top:8px">Objetivo ' + fmt(obj, 1) + ' kg'
      +   (faltan === null ? '' : ' · faltan ' + fmt(faltan, 1) + ' kg') + '</div>'
      + '<div style="display:flex;gap:2px;height:26px;border-radius:8px;overflow:hidden;margin-top:16px;background:rgba(139,147,255,.10)">'
      +   seg(mus, 'rgba(139,147,255,.55)', 'Muscular ' + fmt(mus, 1))
      +   seg(gra, '${T.alerta}', 'Grasa ' + fmt(gra, 1))
      +   seg(os, '${T.info}', '')
      + '</div>'
      + '<div style="font-size:12.5px;color:${T.texto3};margin-top:9px">'
      +   'Composición: muscular · grasa ' + fmt(num('${E.grasaPct}'), 1) + ' % · ósea ' + fmt(os, 1)
      +   '  |  Libre de grasa ' + fmt(num('${E.libreGrasa}'), 1) + ' kg</div>'
      + '</div>';
  `),
})

// -------------------------------------------------------------------- 5. hoy

const hoy = () => tarjeta({
  entidad: E.pasos,
  tap: { action: 'more-info' },
  relleno: '22px 24px',
  html: js(`${HELPERS}
    const pa = num('${E.pasos}'), meta = num('${E.metaPasos}');
    const pct = (pa === null || !meta) ? 0 : Math.min(100, pa / meta * 100);
    const act = num('${E.kcalAct}'), rep = num('${E.kcalRep}');
    const tot = (act || 0) + (rep || 0);

    const tile = function (etq, val, uni) {
      return '<div style="background:rgba(139,147,255,.07);border-radius:12px;padding:10px 11px">'
        + '<div style="font-size:11.5px;color:${T.texto3};letter-spacing:.5px">' + etq + '</div>'
        + '<div style="font-family:${T.sora};font-size:19px;font-weight:600;color:${T.texto};margin-top:3px">'
        + val + '<span style="font-size:12px;color:${T.texto2};font-weight:400"> ' + uni + '</span></div></div>';
    };

    return '<div style="width:100%">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline">'
      +   ${JSON.stringify(ROTULO('Hoy · Apple Watch'))}
      +   '<span style="font-size:12.5px;color:${T.texto3}">' + hace('${E.pasos}') + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:baseline;gap:10px;margin-top:10px">'
      +   '<span style="font-family:${T.sora};font-size:42px;font-weight:700;line-height:1;color:${T.texto};font-variant-numeric:tabular-nums">' + fmt(pa) + '</span>'
      +   '<span style="font-size:13.5px;color:${T.texto2}">' + pct.toFixed(0) + ' % de ' + fmt(meta) + '</span>'
      + '</div>'
      + '<div style="height:11px;border-radius:6px;background:rgba(139,147,255,.12);margin-top:12px;overflow:hidden">'
      +   '<div style="height:100%;width:' + pct.toFixed(0) + '%;border-radius:6px;background:${T.okTexto}"></div></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">'
      +   tile('Distancia', fmt(num('${E.distancia}'), 2), 'km')
      +   tile('Pisos', fmt(num('${E.pisos}')), '')
      +   tile('Cal. activas', fmt(act), 'kcal')
      +   tile('Respiración', fmt(num('${E.resp}')), 'r/min')
      + '</div>'
      + '<div style="display:flex;height:22px;border-radius:7px;overflow:hidden;margin-top:14px;background:rgba(139,147,255,.10)">'
      +   '<div style="width:' + (tot ? (act || 0) / tot * 100 : 0).toFixed(1) + '%;background:#ff9d5c"></div>'
      +   '<div style="flex:1;background:rgba(139,147,255,.25)"></div>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;font-size:12px;color:${T.texto3};margin-top:6px">'
      +   '<span><b style="color:#ff9d5c">' + fmt(act) + '</b> activas · ' + fmt(rep) + ' en reposo</span>'
      +   '<span>' + fmt(tot) + ' kcal</span></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">'
      +   tile('🌙 Sueño', fmt(num('${E.sueno}'), 1), 'h')
      +   tile('Ejercicio', fmt(num('${E.ejercicio}')), 'min')
      + '</div>'
      + '</div>';
  `),
})

// ----------------------------------------------------------------- 6. vitales

// Cada vital con su barra chica. EL MAXIMO DE CADA BARRA NO ES UN RANGO CLINICO: es solo la
// escala del dibujo, elegida para que el valor habitual caiga a media altura y se vea el
// movimiento. Nada aca dice si un numero es bueno o malo.
const VITALES = [
  [E.spo2, 'Oxígeno', '%', T.okTexto, 100, 0],
  [E.fcReposo, 'Pulso reposo', 'bpm', T.rosa, 100, 0],
  [E.fcCamina, 'Pulso caminando', 'bpm', '#ff9dc4', 140, 0],
  [E.hrv, 'HRV', 'ms', T.lila, 60, 1],
  [E.vo2, 'VO2 máx', '', T.info, 60, 1],
]

const vitales = () => tarjeta({
  entidad: E.spo2,
  relleno: '22px 24px',
  html: js(`${HELPERS}
    const V = ${JSON.stringify(VITALES)};
    const filas = V.map(function (x) {
      const v = num(x[0], x[5]);
      const w = v === null ? 0 : Math.max(3, Math.min(100, v / x[4] * 100));
      return '<div style="display:flex;align-items:center;gap:11px;padding:9px 0;border-top:1px solid ${T.borde}">'
        + '<span style="flex:1;min-width:0;font-size:13.5px;color:${T.texto2};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + x[1] + '</span>'
        + '<span style="width:70px;height:6px;border-radius:3px;background:rgba(139,147,255,.12);flex:none;overflow:hidden">'
        +   '<span style="display:block;height:100%;width:' + w.toFixed(0) + '%;background:' + x[3] + ';border-radius:3px"></span></span>'
        + '<span style="font-family:${T.sora};font-size:21px;font-weight:600;color:' + x[3] + ';flex:none;min-width:58px;text-align:right;font-variant-numeric:tabular-nums">'
        +   fmt(v, x[5]) + '</span>'
        + '<span style="font-size:11.5px;color:${T.texto3};flex:none;width:34px">' + x[2] + '</span>'
        + '</div>';
    }).join('');
    return '<div style="width:100%">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">'
      +   ${JSON.stringify(ROTULO('Vitales'))}
      +   '<span style="font-size:12.5px;color:${T.texto3}">' + hace('${E.spo2}') + '</span>'
      + '</div>' + filas + '</div>';
  `),
})

// -------------------------------------------------------- 7. última salida en bici

// Nombre y color de cada zona de pulso. Son las etiquetas de entrenamiento estandar, no una
// valoracion de salud.
const ZONAS = [
  ['Z1', 'suave', T.info],
  ['Z2', 'base', T.okTexto],
  ['Z3', 'tempo', T.lima],
  ['Z4', 'umbral', T.alerta],
  ['Z5', 'máximo', T.peligro],
]

const salida = () => tarjeta({
  entidad: E.salida,
  tap: { action: 'more-info' },
  relleno: '22px 26px',
  grid: { columns: 'full' },
  html: js(`${HELPERS}
    const s = states['${E.salida}'];
    const a = s ? s.attributes : {};
    const hay = !!a.activityId;
    const Z = ${JSON.stringify(ZONAS)};

    if (!hay) {
      return '<div style="width:100%">' + ${JSON.stringify(ROTULO('Últimas actividades'))}
        + '<div style="font-size:14px;color:${T.texto3};margin-top:14px">Sin actividades registradas.</div></div>';
    }

    const km = a.distance ? a.distance / 1000 : null;
    const seg = a.duration || 0;
    const dur = Math.floor(seg / 3600) + ' h ' + Math.floor(seg % 3600 / 60) + ' min';
    const kmh = function (ms) { return ms ? (ms * 3.6).toFixed(1).replace('.', ',') : '--'; };
    const f = a.startTime ? new Date(a.startTime) : null;
    const cuando = f ? String(f.getDate()).padStart(2,'0') + '/' + String(f.getMonth()+1).padStart(2,'0') + '/' + f.getFullYear() : '--';
    const d = f ? (Date.now() - f.getTime()) / 86400000 : 0;
    // AMBAR SI PASO MAS DE UNA SEMANA. El dato de la bici depende de que la Edge sincronice;
    // sin esta marca, una salida de hace dos meses se lee como si fuera de hoy.
    const viejo = d > 7;
    const rel = d < 1 ? 'hoy' : (d < 30 ? 'hace ' + Math.floor(d) + ' días' : 'hace ' + Math.floor(d / 30) + ' meses');

    const tile = function (etq, val, uni) {
      return '<div style="background:rgba(139,147,255,.07);border-radius:12px;padding:9px 10px">'
        + '<div style="font-size:11px;color:${T.texto3}">' + etq + '</div>'
        + '<div style="font-family:${T.sora};font-size:22px;font-weight:600;color:${T.texto};margin-top:2px">'
        + val + '<span style="font-size:11.5px;color:${T.texto2};font-weight:400"> ' + uni + '</span></div></div>';
    };

    // --- zonas de pulso, en columnas
    const mins = [1,2,3,4,5].map(function (z) { return Math.round((a['hrTimeInZone_' + z] || 0) / 60); });
    const maxZ = Math.max.apply(null, mins.concat([1]));
    const cols = mins.map(function (m, i) {
      const vacia = m === 0;
      const col = vacia ? '#4a5375' : Z[i][2];
      const h = vacia ? 3 : Math.max(6, m / maxZ * 96);
      // El glow solo en las zonas donde de verdad se estuvo: destacar todo es no destacar nada.
      const glow = (!vacia && m >= 24) ? ';box-shadow:0 0 14px ' + col + '40' : '';
      return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:130px">'
        + '<span style="font-family:${T.sora};font-size:13px;color:' + col + ';margin-bottom:5px">' + m + '</span>'
        + '<span style="width:100%;height:' + h.toFixed(0) + 'px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,' + col + ',' + col + '55)' + glow + '"></span>'
        + '<span style="font-size:11px;color:' + col + ';margin-top:7px;font-weight:600">' + Z[i][0] + '</span>'
        + '<span style="font-size:10px;color:' + (vacia ? '#4a5375' : '${T.texto3}') + '">' + Z[i][1] + '</span>'
        + '</div>';
    }).join('');

    // --- el recorrido, dibujado a mano desde la polilinea
    // La tarjeta map de HA dibuja entidades con posicion, no polilineas guardadas en un
    // atributo. Con 255 puntos, un SVG sale mejor y no agrega dependencias.
    // (Sin comillas invertidas: adentro de esta plantilla cerrarian el literal.)
    const r = states['${E.ruta}'];
    const pts = (r && r.attributes && r.attributes.polyline) || [];
    let mapa = '<div style="display:grid;place-items:center;height:100%;color:${T.texto3};font-size:13px">sin recorrido</div>';
    if (pts.length > 2) {
      let laMin = 90, laMax = -90, loMin = 180, loMax = -180;
      for (const p of pts) { if (p.lat < laMin) laMin = p.lat; if (p.lat > laMax) laMax = p.lat;
                             if (p.lon < loMin) loMin = p.lon; if (p.lon > loMax) loMax = p.lon; }
      // A esta latitud un grado de longitud mide menos que uno de latitud: sin corregirlo el
      // recorrido sale estirado a lo ancho y no se parece al mapa real.
      const kx = Math.cos((laMin + laMax) / 2 * Math.PI / 180);
      const anchoG = Math.max(1e-6, (loMax - loMin) * kx), altoG = Math.max(1e-6, laMax - laMin);
      const esc = Math.min(276 / anchoG, 250 / altoG);
      const dx = (300 - anchoG * esc) / 2, dy = (274 - altoG * esc) / 2;
      const d2 = pts.map(function (p, i) {
        const x = dx + (p.lon - loMin) * kx * esc;
        const y = dy + (laMax - p.lat) * esc;
        return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join(' ');
      const ini = pts[0], fin = pts[pts.length - 1];
      const px = function (p) { return [dx + (p.lon - loMin) * kx * esc, dy + (laMax - p.lat) * esc]; };
      const a0 = px(ini), a1 = px(fin);
      mapa = '<svg viewBox="0 0 300 274" style="width:100%;height:100%;display:block">'
        + '<path d="' + d2 + '" fill="none" stroke="${T.info}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" opacity=".95"/>'
        + '<circle cx="' + a0[0].toFixed(1) + '" cy="' + a0[1].toFixed(1) + '" r="5" fill="${T.okTexto}"/>'
        + '<circle cx="' + a1[0].toFixed(1) + '" cy="' + a1[1].toFixed(1) + '" r="5" fill="${T.peligro}"/>'
        + '</svg>';
    }

    return '<div style="width:100%">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:14px">'
      +   ${JSON.stringify(ROTULO('Últimas actividades'))}
      +   '<span style="font-size:12.5px;color:${T.texto3};text-align:right">🚴 En bici · '
      +     '<b style="color:' + (viejo ? '${T.alerta}' : '${T.texto2}') + '">' + rel + '</b>'
      +     ' · ' + cuando + ' · ' + (a.locationName || '--') + '</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 300px;gap:22px;margin-top:14px">'
      +   '<div style="min-width:0">'
      +     '<div style="display:flex;align-items:baseline;gap:10px">'
      +       '<span style="font-family:${T.sora};font-size:50px;font-weight:700;line-height:1;color:${T.texto};font-variant-numeric:tabular-nums">' + fmt(km, 2) + '</span>'
      +       '<span style="font-size:16px;color:${T.texto2}">km</span>'
      +     '</div>'
      +     '<div style="font-size:13.5px;color:${T.texto2};margin-top:7px">' + dur + ' · ' + kmh(a.averageSpeed) + ' media · ' + kmh(a.maxSpeed) + ' máx km/h</div>'
      +     '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px">'
      +       tile('Calorías', a.calories || '--', 'kcal')
      +       tile('FC media', a.averageHR || '--', 'bpm')
      +       tile('FC máx', a.maxHR || '--', 'bpm')
      +       tile('Desnivel +', a.elevationGain || '--', 'm')
      +       tile('Desnivel −', a.elevationLoss || '--', 'm')
      +       tile('Tiempo', Math.round(seg / 60), 'min')
      +     '</div>'
      +     '<div style="margin-top:16px">'
      +       '<div style="font-size:11.5px;color:${T.texto3};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Zonas de pulso · minutos</div>'
      +       '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">' + cols + '</div>'
      +     '</div>'
      +     '<div style="font-size:12.5px;color:${T.texto3};margin-top:12px">Carga ' + Math.round(a.activityTrainingLoad || 0)
      +       ' · Aeróbico ' + fmt(a.aerobicTrainingEffect, 1) + ' · Anaeróbico ' + fmt(a.anaerobicTrainingEffect, 1) + '</div>'
      +   '</div>'
      +   '<div style="position:relative;height:274px;border-radius:16px;background:rgba(139,147,255,.06);border:1px solid ${T.borde};overflow:hidden">'
      +     mapa
      +     '<span style="position:absolute;top:10px;left:12px;font-size:10.5px;letter-spacing:1.5px;color:${T.texto3};text-transform:uppercase">Recorrido · ' + pts.length + ' puntos</span>'
      +     '<span style="position:absolute;bottom:10px;right:12px;font-size:11px;color:${T.texto2}">' + (a.locationName || '') + ', Santa Fe</span>'
      +   '</div>'
      + '</div>'
      + '</div>';
  `),
})

// --------------------------------------------------------------- 8. caminata

/**
 * La ultima caminata.
 *
 * LA FUENTE ES WITHINGS, NO EL APPLE WATCH, y el cambio se hizo el 31/08/2026 despues de
 * medir. La especificacion pedia "el ultimo workout tipo walking de HealthKit": **la app
 * Companion no expone ningun sensor de entrenamientos** —se revisaron sus 54— asi que la fila
 * quedaba vacia. Pero Withings **si** detecta las caminatas y ya las tenia en HA:
 *
 *     calendar.withings_entrenamientos    4 caminatas en 30 dias (6/8, 7/8, 26/8, 28/8)
 *     sensor.withings_..._ultimo_entrenamiento    distancia, duracion, calorias, intensidad
 *
 * POR QUE DICE "ACTUALIZADO" Y NO "CAMINATA DEL <fecha>": Withings expone los numeros de la
 * ultima caminata pero **no su fecha**. La fecha vive en el calendario, y una tarjeta no puede
 * consultar eventos pasados de un calendario. Poner el `last_changed` como si fuera la fecha
 * de la caminata seria mentir: ese sello dice cuando HA se entero, no cuando se camino —y
 * salta tambien al recargar la integracion.
 *
 * ASI QUE EL DATO LLEGA TARDE, y hay que decirlo: Withings sincroniza cuando abris su app.
 */
const caminata = () => tarjeta({
  entidad: 'sensor.caminata_distancia',
  tap: { action: 'more-info' },
  relleno: '16px 20px',
  grid: { columns: 'full' },
  html: js(`${HELPERS}
    const km = num('sensor.caminata_distancia', 2);
    const min = num('sensor.caminata_duracion', 0);
    const kcal = num('sensor.caminata_calorias', 0);
    const tipo = g('sensor.withings_ultimo_tipo_de_entrenamiento');

    if (km === null) {
      return '<div style="display:flex;align-items:center;gap:11px;height:100%">'
        + '<img src="/local/iconos/color/caminante.png" width="22" height="22" style="display:block;opacity:.5">'
        + '<span style="font-size:14px;color:${T.texto2}">Caminata</span><span style="flex:1"></span>'
        + '<span style="font-size:13px;color:${T.texto3}">sin caminatas registradas</span></div>';
    }

    // El ritmo es el dato que una caminata pide y que ninguna fuente da hecho: minutos por
    // kilometro. Se calcula aca porque es una division, no una interpretacion.
    const ritmo = (km > 0 && min) ? (min / km) : null;
    const rTxt = ritmo === null ? '--'
      : Math.floor(ritmo) + ':' + String(Math.round((ritmo % 1) * 60)).padStart(2, '0');

    const NOM = { walk: 'Caminata', run: 'Corrida', hiking: 'Trekking', bicycling: 'Bici',
                  indoor_walk: 'Caminata bajo techo', swimming: 'Natación' };

    return '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">'
      + '<img src="/local/iconos/color/caminante.png" width="24" height="24" style="display:block">'
      + '<span style="font-size:14.5px;font-weight:600;color:${T.texto}">' + (NOM[tipo] || 'Actividad') + '</span>'
      + '<span style="font-size:12.5px;color:${T.texto3}">Withings · actualizado ' + hace('sensor.caminata_distancia') + '</span>'
      + '<span style="flex:1"></span>'
      + '<span style="font-size:13.5px;color:${T.texto2};font-variant-numeric:tabular-nums">'
      +   '<b style="color:${T.texto};font-family:${T.sora};font-size:17px">' + fmt(km, 2) + '</b> km'
      +   '  ·  <b style="color:${T.texto}">' + fmt(min, 0) + '</b> min'
      +   '  ·  ritmo <b style="color:${T.texto}">' + rTxt + '</b> /km'
      +   '  ·  <b style="color:${T.texto}">' + fmt(kcal, 0) + '</b> kcal'
      + '</span>'
      + '</div>';
  `),
})

// ---------------------------------------------------------------------- vista

export function vistaSalud () {
  return {
    title: 'Salud',
    path: 'salud',
    icon: 'mdi:heart-pulse',
    type: 'sections',
    max_columns: 2,
    theme: 'Vidrio Animado',
    background: fondoOlas(),
    sections: [
      { type: 'grid', column_span: 2, cards: [cabecera()] },
      { type: 'grid', cards: [presion()] },
      { type: 'grid', cards: [corazon()] },
      { type: 'grid', column_span: 2, cards: [cuerpo()] },
      { type: 'grid', cards: [hoy()] },
      { type: 'grid', cards: [vitales()] },
      { type: 'grid', column_span: 2, cards: [salida(), caminata()] },
      { type: 'grid', column_span: 2, cards: [cuadro(), aire(110), navbar()] },
    ],
  }
}
