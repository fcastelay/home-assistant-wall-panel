// Vista Inicio del Panel Vertical 2.
// Orden por frecuencia de uso (README §Reorden):
//   cabecera · acciones rapidas · personas+accesos · escenas · energia+clima · rios
// Entidades y acciones salen del panel actual: no se inventa nada.

import { T, R, alfa, js, tarjeta, aire, cuadro, fondoOlas } from '../diseno.mjs'
import { navbar } from '../navbar.mjs'
import { marco } from '../restilar.mjs'

const PIPELINE = '01m0b9pwpr3e893npdxm21dgya'

// Filtro de luces "reales" que ya usaba el panel (excluye segmentos y grupos).
const RUIDO = '_segment_|awtrix|todas_las_luces|grupo_luces|luces_afuera|hue_color_lamp'

// ---------------------------------------------------------------- cabecera

const cabecera = () => tarjeta({
  entidad: 'sensor.time',
  radio: R.grande,
  relleno: '26px 30px',
  grid: { columns: 'full' },
  html: js(`
    const n = new Date();
    const p = (x) => String(x).padStart(2,'0');
    const f = n.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
    const fecha = f.charAt(0).toUpperCase() + f.slice(1);

    const AL = ['alarm_control_panel.alarmo','alarm_control_panel.sausalito','alarm_control_panel.ezviz_alarm'];
    const LK = ['lock.puerta_galeria'];
    const armadas  = AL.filter(e => states[e] && states[e].state.startsWith('armed')).length;
    const abiertas = LK.filter(e => states[e] && states[e].state === 'unlocked').length;
    const luces = Object.keys(states).filter(e => e.startsWith('light.') && states[e].state === 'on' && !/${RUIDO}/.test(e)).length;
    const alerta = armadas === 0 || abiertas > 0;

    const col   = alerta ? '${T.alerta}' : '${T.okTexto}';
    const punto = alerta ? '${T.alerta}' : '${T.ok}';
    const fondo = alerta ? '${alfa(T.alerta, 0.12)}' : '${T.okFill}';
    const bord  = alerta ? '${alfa(T.alerta, 0.30)}' : '${T.okBorde}';
    const rotulo = alerta ? 'Necesita atención' : 'Todo en orden';
    const resumen = (armadas > 0 ? armadas + ' alarma' + (armadas > 1 ? 's armadas' : ' armada') : 'Alarmas desarmadas')
      + ' · ' + (abiertas > 0 ? abiertas + ' sin cerrar' : 'Cerrado')
      + ' · ' + luces + ' luces';

    return '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;width:100%">'
      + '<div style="display:flex;align-items:baseline;gap:20px">'
      +   '<span style="font-family:${T.sora};font-size:96px;font-weight:800;line-height:.9;letter-spacing:-2px;color:${T.texto};font-variant-numeric:tabular-nums">' + p(n.getHours()) + ':' + p(n.getMinutes()) + '</span>'
      +   '<span style="font-size:20px;color:${T.texto2}">' + fecha + '</span>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">'
      +   '<div style="display:inline-flex;align-items:center;gap:10px;background:' + fondo + ';border:1px solid ' + bord + ';color:' + col + ';font-size:17px;font-weight:600;padding:10px 18px;border-radius:99px">'
      +     '<span style="width:10px;height:10px;border-radius:50%;background:' + punto + ';animation:p2-pulso 2.4s infinite"></span>' + rotulo
      +   '</div>'
      +   '<div style="font-size:15px;color:${T.texto2}">' + resumen + '</div>'
      + '</div>'
      + '</div>'
      + '<style>@keyframes p2-pulso{0%,100%{opacity:1}50%{opacity:.45}}</style>';
  `),
})

// ------------------------------------------------------- acciones rapidas

// LA RUTA DE LOS ICONOS A COLOR. Son PNG 3D de Fluent Emoji (MIT) servidos por Home
// Assistant desde /config/www/iconos/color/. Ver scripts/panel2/bajar-iconos.mjs.
//
// La carpeta se llama `iconos` y no `icons` porque **el recurso Samba de HA no deja crear
// una carpeta con ese nombre**: devuelve "no se pudo encontrar el archivo" y cualquier
// otro nombre funciona. Esta comprobado, no es una preferencia.
const ICO = '/local/iconos/color/'

/**
 * Cuerpo HTML con IMAGEN a color: misma caja de 48 px que `cuerpoAccion`, con un PNG de
 * 30 px adentro en vez del glifo MDI.
 *
 * El tinte de la caja se conserva aunque el PNG ya traiga color propio: es lo que agrupa
 * la caja con el texto y lo que da el estado cuando el estado es un color.
 *
 * `imagen` llega como EXPRESION JS, no como texto: la puerta cambia de candado cerrado a
 * candado abierto segun el estado, y eso se decide en el navegador.
 */
const cuerpoAccionImg = (imagen, color, titulo, sub) => `
  return '<div style="display:flex;align-items:center;gap:14px;width:100%">'
    + '<span style="width:48px;height:48px;border-radius:14px;background:' + ${color} + '26;display:grid;place-items:center;flex:none">'
    +   '<img src="${ICO}' + ${imagen} + '" width="30" height="30" style="display:block">'
    + '</span>'
    + '<span style="min-width:0">'
    +   '<span style="display:block;font-size:17px;font-weight:600;color:${T.texto};line-height:1.2">' + ${titulo} + '</span>'
    +   '<span style="display:block;font-size:13.5px;color:${T.texto2};margin-top:3px">' + ${sub} + '</span>'
    + '</span>'
  + '</div>';`

/** Cuerpo HTML comun: caja de icono 48px + titulo + subtitulo. */
const cuerpoAccion = (icono, color, titulo, sub) => `
  return '<div style="display:flex;align-items:center;gap:14px;width:100%">'
    + '<span style="width:48px;height:48px;border-radius:14px;background:' + ${color} + '26;display:grid;place-items:center;flex:none">'
    +   '<ha-icon icon="' + ${icono} + '" style="color:' + ${color} + ';--mdc-icon-size:24px"></ha-icon>'
    + '</span>'
    + '<span style="min-width:0">'
    +   '<span style="display:block;font-size:17px;font-weight:600;color:${T.texto};line-height:1.2">' + ${titulo} + '</span>'
    +   '<span style="display:block;font-size:13.5px;color:${T.texto2};margin-top:3px">' + ${sub} + '</span>'
    + '</span>'
  + '</div>';`

const accion = ({ entidad, tap, hold, cuerpo }) => tarjeta({
  entidad, tap, hold, radio: R.media, relleno: '18px', alto: '88px', html: js(cuerpo),
})

const accionesRapidas = () => ({
  type: 'grid',
  columns: 4,
  square: false,
  grid_options: { columns: 'full' },
  cards: [
    // Puerta: SOLO more-info. Es un panel tactil en un pasillo, un roce no abre.
    accion({
      entidad: 'lock.puerta_galeria',
      tap: { action: 'more-info' },
      hold: { action: 'more-info' },
      // La puerta cambia de IMAGEN, no de color: candado cerrado o candado abierto. El
      // tinte de la caja sigue verde/rojo, asi que el estado se lee por partida doble.
      cuerpo: `
        const cerrada = states['lock.puerta_galeria'] && states['lock.puerta_galeria'].state === 'locked';
        const img = cerrada ? 'candado.png' : 'candado-abierto.png';
        const col = cerrada ? '${T.okTexto}' : '${T.peligro}';
        const sub = cerrada ? 'Bloqueada' : 'ABIERTA';
        ${cuerpoAccionImg('img', 'col', "'Puerta Galería'", 'sub')}`,
    }),
    accion({
      tap: { action: 'call-service', service: 'lock.lock', target: { entity_id: ['lock.puerta_galeria'] } },
      cuerpo: cuerpoAccionImg("'llave.png'", `'${T.okTexto}'`, "'Cerrar todo'", "'Cerraduras y luces'"),
    }),
    accion({
      tap: { action: 'call-service', service: 'light.turn_off', target: { entity_id: 'light.todas_las_luces_de_casa' } },
      cuerpo: `
        const n = Object.keys(states).filter(e => e.startsWith('light.') && states[e].state === 'on' && !/${RUIDO}/.test(e)).length;
        const sub = n + (n === 1 ? ' encendida' : ' encendidas');
        ${cuerpoAccionImg("'lampara.png'", `'${T.alerta}'`, "'Apagar luces'", 'sub')}`,
    }),
    accion({
      tap: { action: 'assist', pipeline_id: PIPELINE, start_listening: true },
      hold: { action: 'assist', pipeline_id: PIPELINE, start_listening: false },
      cuerpo: cuerpoAccionImg("'microfono.png'", `'${T.acento}'`, "'Hablar con la casa'", "'Asistente de voz'"),
    }),
  ],
})

// ---------------------------------------------------------------- personas

const GENTE = [
  {
    nombre: 'Persona 1', inicial: 'F', persona: 'person.persona1', movil: 'iphone_de_persona1',
    grad: 'linear-gradient(135deg,#57c7ff,#8b93ff)',
  },
  {
    nombre: 'Persona 2', inicial: 'P', persona: 'person.persona2', movil: 'iphone_de_persona2',
    grad: 'linear-gradient(135deg,#ff6b81,#c58bff)',
  },
]

/**
 * Tarjeta de persona: foto, donde esta, y los datos del telefono.
 *
 * ALTO 92px, igual que las tarjetas de `modo()`. NO cambiarlo: las personas y
 * los accesos son dos secciones lado a lado, y si una crece la otra queda corta
 * y se desencuadra todo lo que sigue. Por eso los chips van a la derecha en dos
 * filas en vez de abajo: es la unica forma de que entre todo en 92px.
 *
 * OJO con sensor.<movil>_distance: NO es la distancia a casa. Es el podometro
 * de iOS (unidad "m", icono mdi:hiking), o sea los metros caminados hoy. La
 * person-tracker-card del panel viejo lo mostraba como "105 km" y estaba mal.
 * Aca la distancia a casa se calcula con las coordenadas de la persona y las
 * de zone.home.
 */
const persona = (p) => tarjeta({
  entidad: p.persona,
  tap: { action: 'more-info' },
  radio: R.media,
  relleno: '12px 14px',
  alto: '92px',
  html: js(`
    const s = states['${p.persona}'];
    const a = s ? s.attributes : {};
    const encasa = s && s.state === 'home';
    const col = encasa ? '${T.okTexto}' : '${T.alerta}';
    const punto = encasa ? '${T.ok}' : '${T.alerta}';
    const foto = a.entity_picture || '';

    const num = (id) => {
      const e = states[id];
      const n = e ? parseFloat(e.state) : NaN;
      return isNaN(n) ? null : n;
    };
    const txt = (id) => {
      const e = states[id];
      return e && e.state !== 'unknown' && e.state !== 'unavailable' ? e.state : '';
    };

    const ms = s ? (Date.now() - new Date(s.last_changed).getTime()) : 0;
    const min = Math.round(ms / 60000);
    const desde = min < 60 ? ('hace ' + min + ' min')
      : (min < 1440 ? ('hace ' + Math.round(min / 60) + ' h') : ('hace ' + Math.round(min / 1440) + ' d'));

    // Distancia real a casa, por coordenadas. El sensor _distance es el
    // podometro del telefono, no sirve para esto.
    const casa = states['zone.home'] ? states['zone.home'].attributes : null;
    let km = null;
    if (!encasa && casa && a.latitude != null) {
      const rad = Math.PI / 180;
      const dLat = (a.latitude - casa.latitude) * rad;
      const dLon = (a.longitude - casa.longitude) * rad;
      const h = Math.pow(Math.sin(dLat / 2), 2) +
        Math.cos(casa.latitude * rad) * Math.cos(a.latitude * rad) * Math.pow(Math.sin(dLon / 2), 2);
      km = 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
    }
    const lejos = km == null ? '' : (km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km');

    const zona = !s ? '-'
      : (s.state === 'home' ? 'En casa' : (s.state === 'not_home' ? 'Fuera' : s.state));
    const donde = zona + (lejos ? ' - a ' + lejos : '');

    // El geocoded viene en varias lineas: calle, CP+ciudad, provincia, pais.
    // Solo entra la calle: la ciudad siempre es la misma y come el ancho.
    const calle = txt('sensor.${p.movil}_geocoded_location').split(String.fromCharCode(10))[0] || '';

    const chip = (ico, valor, color) =>
      '<span style="display:inline-flex;align-items:center;gap:4px;background:${T.fill};'
      + 'border:1px solid ${T.borde};border-radius:9px;padding:3px 7px;font-size:12px;'
      + 'line-height:1.4;white-space:nowrap;color:' + color + '">'
      + '<ha-icon icon="' + ico + '" style="--mdc-icon-size:14px"></ha-icon>' + valor + '</span>';

    const colBat = (n) => n <= 20 ? '${T.peligro}' : (n <= 40 ? '${T.alerta}' : '${T.okTexto}');
    const pila = (nivel, estado, tipo) => {
      if (nivel == null) return '';
      const carga = estado === 'Charging' || estado === 'Full';
      const ico = tipo === 'reloj' ? 'mdi:watch'
        : (carga ? 'mdi:battery-charging'
          : (nivel > 95 ? 'mdi:battery' : 'mdi:battery-' + Math.max(1, Math.round(nivel / 10)) + '0'));
      return chip(ico, Math.round(nivel) + '%' + (carga ? '+' : ''), colBat(nivel));
    };

    const red = txt('sensor.${p.movil}_connection_type');
    const ssid = txt('sensor.${p.movil}_ssid');
    const wifi = /wi-?fi/i.test(red);
    const corto = (t, n) => t.length > n ? t.slice(0, n - 1) + '...' : t;
    const chipRed = !red ? ''
      : chip(wifi ? 'mdi:wifi' : 'mdi:signal', wifi ? corto(ssid || 'Wi-Fi', 11) : 'Celular', '${T.info}');

    const ACT = {Stationary:'Quieto', Walking:'Caminando', Running:'Corriendo',
      Automotive:'En auto', Cycling:'En bici', Unknown:''};
    const ICO = {Stationary:'mdi:seat-passenger', Walking:'mdi:walk', Running:'mdi:run',
      Automotive:'mdi:car', Cycling:'mdi:bike'};
    const act = txt('sensor.${p.movil}_activity');
    const chipAct = ACT[act] ? chip(ICO[act] || 'mdi:radar', ACT[act], '${T.lila}') : '';

    const medallon = foto
      ? '<span style="display:block;width:100%;height:100%;border-radius:50%;background-color:#0a0f22;'
        + 'background-image:url(' + foto + ');background-size:cover;background-position:center"></span>'
      : '<span style="display:grid;place-items:center;width:100%;height:100%;border-radius:50%;'
        + 'background:${p.grad};font-family:${T.sora};font-weight:700;font-size:20px;color:#0a0f22">${p.inicial}</span>';

    const linea = (texto, estilo) =>
      '<span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + estilo + '">'
      + texto + '</span>';

    return '<div style="display:flex;align-items:center;gap:11px;width:100%">'
      + '<span style="width:56px;height:56px;border-radius:50%;flex:none;position:relative;'
      +   'padding:2px;background:${p.grad}">'
      +   medallon
      +   '<span style="position:absolute;right:0;bottom:0;width:13px;height:13px;border-radius:50%;'
      +     'border:2px solid #101836;background:' + punto + '"></span>'
      + '</span>'
      + '<span style="flex:1;min-width:0">'
      +   linea('${p.nombre}', 'font-size:16px;font-weight:600;line-height:1.2;color:${T.texto}')
      +   '<span style="display:flex;align-items:center;gap:5px;margin-top:2px;font-size:13px;color:' + col + '">'
      +     '<span style="width:6px;height:6px;border-radius:50%;background:' + punto + ';flex:none"></span>'
      +     linea(donde, 'min-width:0')
      +   '</span>'
      +   linea((calle ? calle + ' - ' : '') + desde,
              'font-size:12px;margin-top:1px;color:${T.texto3}')
      + '</span>'
      + '<span style="display:flex;flex-wrap:wrap;justify-content:flex-end;align-content:center;'
      +   'gap:5px;flex:none;max-width:190px">'
      +   pila(num('sensor.${p.movil}_battery_level'), txt('sensor.${p.movil}_battery_state'), 'tel')
      +   pila(num('sensor.${p.movil}_watch_battery_level'), txt('sensor.${p.movil}_watch_battery_state'), 'reloj')
      +   chipRed
      +   chipAct
      + '</span>'
      + '</div>';
  `),
})

// ------------------------------------------------------- accesos y modos

/** Tarjeta de modo con el toggle-pill del prototipo. */
// `icono` acepta un MDI o un PNG de /local/iconos/color/. Se decide por la extension.
//
// Aca el cambio de imagen NO pierde informacion de estado: la tarjeta tiene ademas la
// tecla de la derecha, que se mueve, y el subtitulo, que cambia de texto. El color del
// icono era la tercera señal, no la unica.
const modo = ({ entidad, icono, nombre, color, encendido, subOn, subOff }) => tarjeta({
  entidad,
  tap: { action: 'toggle' },
  hold: { action: 'more-info' },
  radio: R.media,
  relleno: '14px 16px',
  alto: '92px',
  html: js(`
    const on = ${encendido};
    const col = on ? '${color}' : '${T.texto3}';
    return '<div style="display:flex;align-items:center;gap:12px;width:100%">'
      + '<span style="width:38px;height:38px;border-radius:12px;background:' + (on ? '${alfa(color, 0.18)}' : '${T.fill}') + ';display:grid;place-items:center;flex:none">'
      +   ${icono.endsWith('.png')
              ? `'<img src="${ICO}${icono}" width="24" height="24" style="display:block">'`
              : `'<ha-icon icon="${icono}" style="color:' + col + ';--mdc-icon-size:21px"></ha-icon>'`}
      + '</span>'
      + '<span style="flex:1;min-width:0">'
      +   '<span style="display:block;font-size:15px;font-weight:600;color:${T.texto};line-height:1.2">${nombre}</span>'
      +   '<span style="display:block;font-size:12.5px;color:' + col + ';margin-top:2px">' + (on ? ${subOn} : ${subOff}) + '</span>'
      + '</span>'
      + '<span style="width:42px;height:24px;border-radius:99px;background:' + (on ? '${T.acento}' : 'rgba(139,147,255,.18)') + ';position:relative;flex:none;transition:background .2s">'
      +   '<span style="position:absolute;top:2px;left:' + (on ? '20px' : '2px') + ';width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s"></span>'
      + '</span>'
      + '</div>';
  `),
})

/**
 * PULSADOR. Para el porton, que NO es un interruptor: es un rele que da un pulso y
 * vuelve solo a off. Dibujarlo con el toggle-pill mentia — la perilla quedaba en una
 * posicion que no significaba nada, porque el porton no tiene estado abierto/cerrado
 * en HA (no hay entidad `cover`, se comprobo).
 *
 * Se dibuja como un boton redondo, que es lo que es. Mientras acciona se enciende el
 * anillo, usando la misma deteccion por consumo que ya tenia.
 */
const pulsador = ({ entidad, servicio, icono, nombre, color, accionando, subOn, subOff }) => tarjeta({
  entidad,
  // `turn_on`, no `toggle`: si se toca dos veces durante el ciclo, un toggle apagaria
  // el rele a mitad de camino. Un pulsador siempre pulsa.
  tap: { action: 'call-service', service: servicio, service_data: { entity_id: entidad } },
  hold: { action: 'more-info' },
  radio: R.media,
  relleno: '14px 16px',
  alto: '92px',
  html: js(`
    const act = ${accionando};
    const col = act ? '${color}' : '${T.texto2}';
    return '<div style="display:flex;align-items:center;gap:12px;width:100%">'
      + '<span style="width:38px;height:38px;border-radius:12px;background:' + (act ? '${alfa(color, 0.18)}' : '${T.fill}') + ';display:grid;place-items:center;flex:none">'
      +   '<ha-icon icon="${icono}" style="color:' + col + ';--mdc-icon-size:21px"></ha-icon>'
      + '</span>'
      + '<span style="flex:1;min-width:0">'
      +   '<span style="display:block;font-size:15px;font-weight:600;color:${T.texto};line-height:1.2">${nombre}</span>'
      +   '<span style="display:block;font-size:12.5px;color:' + col + ';margin-top:2px">' + (act ? ${subOn} : ${subOff}) + '</span>'
      + '</span>'
      // El boton: anillo + centro. Sin posicion, porque no hay estado que mostrar.
      + '<span style="width:40px;height:40px;border-radius:50%;flex:none;display:grid;place-items:center;'
      +   'border:2px solid ' + (act ? '${color}' : '${T.bordeFuerte}') + ';'
      +   'background:' + (act ? '${alfa(color, 0.18)}' : 'transparent') + ';transition:all .2s">'
      +   '<span style="width:20px;height:20px;border-radius:50%;background:' + (act ? '${color}' : '${T.texto3}') + ';transition:background .2s"></span>'
      + '</span>'
      + '</div>';
  `),
})

/**
 * TECLA. Para las luces: una tecla de pared, no el toggle de telefono. La mitad
 * encendida queda iluminada y la otra hundida, que es como se lee de un vistazo desde
 * el pasillo.
 */
const tecla = ({ entidad, icono, nombre, color, encendido, subOn, subOff }) => tarjeta({
  entidad,
  tap: { action: 'toggle' },
  hold: { action: 'more-info' },
  radio: R.media,
  relleno: '14px 16px',
  alto: '92px',
  html: js(`
    const on = ${encendido};
    const col = on ? '${color}' : '${T.texto3}';
    const mitad = (activa, arriba) =>
      '<span style="display:block;height:17px;border-radius:' + (arriba ? '6px 6px 2px 2px' : '2px 2px 6px 6px') + ';'
      + 'background:' + (activa ? '${color}' : '${T.fill}') + ';'
      + (activa ? '' : 'box-shadow:inset 0 1px 3px rgba(0,0,0,.45);') + '"></span>';
    return '<div style="display:flex;align-items:center;gap:12px;width:100%">'
      + '<span style="width:38px;height:38px;border-radius:12px;background:' + (on ? '${alfa(color, 0.18)}' : '${T.fill}') + ';display:grid;place-items:center;flex:none">'
      +   '<ha-icon icon="${icono}" style="color:' + col + ';--mdc-icon-size:21px"></ha-icon>'
      + '</span>'
      + '<span style="flex:1;min-width:0">'
      +   '<span style="display:block;font-size:15px;font-weight:600;color:${T.texto};line-height:1.2">${nombre}</span>'
      +   '<span style="display:block;font-size:12.5px;color:' + col + ';margin-top:2px">' + (on ? ${subOn} : ${subOff}) + '</span>'
      + '</span>'
      + '<span style="width:30px;flex:none;display:flex;flex-direction:column;gap:2px;padding:3px;'
      +   'border-radius:9px;border:1px solid ${T.borde};background:rgba(0,0,0,.22)">'
      +   mitad(on, true) + mitad(!on, false)
      + '</span>'
      + '</div>';
  `),
})

// Accesos: las tres cosas que se tocan al entrar y salir. Fila de 3.
// Vacaciones y Simulador NO estan aca: son modos que se dejan puestos, no accesos que
// se tocan al pasar. Van en su propia fila, abajo, y ahi el toggle si dice la verdad.
const accesos = () => ({
  type: 'grid',
  columns: 4,
  square: false,
  grid_options: { columns: 'full' },
  cards: [
    pulsador({
      entidad: 'switch.shelly_porton_automatico',
      servicio: 'switch.turn_on',
      icono: 'mdi:garage-variant', nombre: 'Portón Garage', color: T.alerta,
      // Se conserva la deteccion por consumo: el rele vuelve solo a off.
      accionando: `(function(){ const s = states['switch.shelly_porton_automatico']; const w = states['sensor.porton_ingreso_power'];
        return !!s && (s.state === 'on' || (w && parseFloat(w.state) > 5)); })()`,
      subOn: "'Accionando…'", subOff: "'Tocá para abrir'",
    }),
    // Se usa `light.luz_garage`, no `switch.shelly_luz_garage`: son el mismo rele, pero
    // es una luz y el dominio correcto es `light`. Solo soporta onoff, sin brillo.
    tecla({
      entidad: 'light.luz_garage',
      icono: 'mdi:garage-lock', nombre: 'Luz Garage', color: T.ambar,
      encendido: `states['light.luz_garage'] && states['light.luz_garage'].state === 'on'`,
      subOn: "'Encendida'", subOff: "'Apagada'",
    }),
    // Mismo criterio que la del garage: es una luz, va con el dominio `light`.
    tecla({
      entidad: 'light.luz_ingreso',
      icono: 'mdi:door-closed', nombre: 'Luz Ingreso', color: T.ambar,
      encendido: `states['light.luz_ingreso'] && states['light.luz_ingreso'].state === 'on'`,
      subOn: "'Encendida'", subOff: "'Apagada'",
    }),
    // Despertar la PC de la oficina por Wake-on-LAN. Reemplaza al script `WOL PC OFICINA`
    // del MikroTik, que habia que correr entrando por Winbox cada vez.
    //
    // Es un PULSADOR, no una tecla: despertar es un pulso. Apagarla no se puede desde
    // aca, asi que un interruptor mentiria — el mismo caso del porton.
    // El estado sale del ping (`binary_sensor.pc_oficina`), no del boton.
    pulsador({
      entidad: 'button.despertar_pc_oficina',
      servicio: 'button.press',
      icono: 'mdi:desktop-tower', nombre: 'PC Oficina', color: T.okTexto,
      accionando: `states['binary_sensor.pc_oficina'] && states['binary_sensor.pc_oficina'].state === 'on'`,
      subOn: "'Encendida'", subOff: "'Tocá para despertar'",
    }),
  ],
})

/**
 * ALARMA, version corta. Rellena el hueco que quedaba debajo de Modos: la columna de
 * personas mide ~235px y la de modos 92px, asi que sobraban ~130px.
 *
 * Es la unica cosa de la casa que no estaba en Inicio salvo por la pastilla del
 * encabezado. Muestra los tres paneles (casa, Sausalito, EZVIZ) y **no arma ni desarma**:
 * toca y lleva a la vista Alarma. Un desarmado por roce en el panel del pasillo es
 * justo lo que no queremos, con el mismo criterio que `lock.puerta_galeria`.
 */
const PANELES = [
  ['alarm_control_panel.alarmo', 'Casa'],
  ['alarm_control_panel.sausalito', 'Sausalito'],
  ['alarm_control_panel.ezviz_alarm', 'EZVIZ'],
]

const alarmaCorta = () => tarjeta({
  entidad: 'alarm_control_panel.alarmo',
  tap: { action: 'navigate', navigation_path: '/panel-vertical-2/alarma' },
  hold: { action: 'more-info' },
  radio: R.media,
  relleno: '14px 16px',
  alto: '104px',
  grid: { columns: 'full' },
  html: js(`
    const P = ${JSON.stringify(PANELES)};
    const vivos = P.filter(p => states[p[0]]);
    const armados = vivos.filter(p => states[p[0]].state.indexOf('armed') === 0);
    const disparado = vivos.some(p => states[p[0]].state === 'triggered');
    const col = disparado ? '${T.peligro}' : (armados.length ? '${T.okTexto}' : '${T.alerta}');
    const ico = disparado ? 'mdi:shield-alert' : (armados.length ? 'mdi:shield-check' : 'mdi:shield-off-outline');
    const dicho = disparado ? 'DISPARADA'
      : (armados.length ? armados.length + ' de ' + vivos.length + ' armada' + (armados.length === 1 ? '' : 's')
                        : 'Ninguna armada');
    const chips = vivos.map(function (p) {
      const st = states[p[0]].state;
      const c = st === 'triggered' ? '${T.peligro}' : (st.indexOf('armed') === 0 ? '${T.ok}' : '${T.texto3}');
      return '<span style="display:flex;align-items:center;gap:5px;font-size:12px;color:${T.texto3}">'
        + '<span style="width:7px;height:7px;border-radius:50%;background:' + c + '"></span>' + p[1] + '</span>';
    }).join('');
    return '<div style="display:flex;align-items:center;gap:12px;width:100%">'
      + '<span style="width:38px;height:38px;border-radius:12px;background:' + '${T.fill}' + ';display:grid;place-items:center;flex:none">'
      +   '<ha-icon icon="' + ico + '" style="color:' + col + ';--mdc-icon-size:21px"></ha-icon>'
      + '</span>'
      + '<span style="flex:1;min-width:0">'
      +   '<span style="display:block;font-size:15px;font-weight:600;color:${T.texto};line-height:1.2">Alarma</span>'
      +   '<span style="display:block;font-size:12.5px;color:' + col + ';margin-top:2px">' + dicho + '</span>'
      +   '<span style="display:flex;gap:12px;margin-top:6px">' + chips + '</span>'
      + '</span>'
      + '<ha-icon icon="mdi:chevron-right" style="color:${T.texto3};--mdc-icon-size:20px;flex:none"></ha-icon>'
      + '</div>';
  `),
})

/**
 * CONSUMO POR DIA. Rellena el hueco debajo de Clima, que quedaba corta contra Energia.
 *
 * Usa `statistics-graph` sobre **estadisticas de largo plazo**, no el historial: el
 * recorder no llega ni a 30 dias —se midio, pedirle 30 devuelve 1 punto— pero
 * `sensor.shelly_3em_total_consumo` tiene `state_class: total_increasing`, y las
 * estadisticas guardan **597 dias, desde el 31/12/2024**. Son los 13 meses del proyecto
 * solar.
 *
 * `sensor.lavadero_consumo_general_consumo_hoy` NO sirve para esto: sus estadisticas
 * arrancan el 16/08/2026, o sea 12 dias. Los dias que comparten dan lo mismo (20,4 /
 * 13,9 / 15,1 / 14,9 / NN / 15,1), asi que se valida uno contra el otro.
 *
 * `change` sobre periodo `day` es el consumo de cada dia: la diferencia del contador
 * acumulado. No es una media ni una interpolacion.
 */
const consumoDiario = () => marco({
  type: 'statistics-graph',
  title: 'Consumo por día · 30 d',
  entities: [{ entity: 'sensor.shelly_3em_total_consumo', name: 'kWh por día' }],
  stat_types: ['change'],
  period: 'day',
  chart_type: 'bar',
  days_to_show: 30,
  hide_legend: true,
  grid_options: { columns: 'full' },
})

// Modos: se dejan puestos y quedan asi. Aca el toggle-pill es honesto — hay un
// estado persistente que mostrar, que es justo lo que al porton le faltaba.
const modos = () => ({
  type: 'grid',
  columns: 2,
  square: false,
  grid_options: { columns: 'full' },
  cards: [
    modo({
      entidad: 'input_boolean.vacaciones',
      icono: 'playa.png', nombre: 'Vacaciones', color: T.acento,
      encendido: `states['input_boolean.vacaciones'] && states['input_boolean.vacaciones'].state === 'on'`,
      subOn: "'Simulando presencia'", subOff: "'Desactivado'",
    }),
    modo({
      entidad: 'switch.simulador_presencia_con_luces',
      icono: 'teatro.png', nombre: 'Simulador', color: T.okTexto,
      encendido: `states['switch.simulador_presencia_con_luces'] && states['switch.simulador_presencia_con_luces'].state === 'on'`,
      subOn: "'Encendiendo luces'", subOff: "'Apagado'",
    }),
  ],
})

// ---------------------------------------------------------------- escenas

// LAS LUCES DEL ESCRITORIO, PARA EL BOTON DE APAGAR. Son las mismas que tiene la escena
// `scene.escritorio_apagado`; se repiten aca porque el boton ya no usa la escena (ver abajo).
const ESCRITORIO = ['light.tira_monitor', 'light.h61c3']

const ESCENAS = [
  // El quinto queda en MDI a proposito: es la excepcion que marca ICONOS-PANEL-COMPLETO.md
  // ("no hay emoji bueno" para apagar). Un emoji forzado seria peor que el glifo.
  ['scene.noche_suave',        'luna.png',     'Noche suave',   'Ámbar tenue',        T.alerta],
  ['scene.concentracion',      'foco.png',     'Concentración', 'Luz fría',           T.info],
  ['scene.pelicula',           'claqueta.png', 'Película',      'Casi a oscuras',     T.lila],
  ['scene.relax',              'vela.png',     'Relax',         'Cálida baja',        T.rosa],

  // APAGAR NO VA POR ESCENA, Y ES UNA CORRECCION DEL 30/08/2026.
  //
  // Una escena **no le manda comando a una entidad que ya esta en el estado destino**: la
  // saltea. Si HA cree que una luz esta apagada y en realidad esta prendida —que pasa cuando
  // se desincroniza el estado, y con las tiras WiFi pasa— la escena no manda nada y la luz
  // se queda prendida. Medido: el 30/08 la escena apago `light.tira_monitor` (que HA tenia
  // como prendida) y no toco `light.h61c3` (que HA ya tenia como apagada).
  //
  // `light.turn_off` SIEMPRE manda la orden, mire el estado o no. Para apagar es lo correcto;
  // las escenas son para *componer* una luz, no para apagarla.
  ['light.turn_off',           'mdi:power',    'Apagar',        'Todo el escritorio', T.texto3,
    { action: 'call-service', service: 'light.turn_off', service_data: { entity_id: ESCRITORIO } }],
]

const escenas = () => ({
  type: 'grid',
  columns: 5,
  square: false,
  grid_options: { columns: 'full' },
  cards: ESCENAS.map(([ent, ico, nombre, sub, color, accion]) => tarjeta({
    // Sin `entity` en el boton de apagar: no hay una entidad de la que dependa su aspecto, y
    // ponerla haria que `more-info` abriera un servicio en vez de una luz.
    entidad: accion ? undefined : ent,
    tap: accion || { action: 'call-service', service: 'scene.turn_on', service_data: { entity_id: ent } },
    hold: accion ? { action: 'none' } : { action: 'more-info' },
    radio: R.media,
    relleno: '16px',
    alto: '104px',
    // `ico` puede ser un PNG o un icono MDI: las escenas son cuatro imagenes y una
    // excepcion. Se decide por la extension, no por una bandera aparte.
    html: `<div style="display:flex;flex-direction:column;justify-content:space-between;height:100%;gap:10px">
      ${ico.endsWith('.png')
        ? `<img src="/local/iconos/color/${ico}" width="28" height="28" style="display:block">`
        : `<ha-icon icon="${ico}" style="color:${color};--mdc-icon-size:24px"></ha-icon>`}
      <span>
        <span style="display:block;font-size:16px;font-weight:600;color:${T.texto};line-height:1.2">${nombre}</span>
        <span style="display:block;font-size:13px;color:${T.texto3};margin-top:3px">${sub}</span>
      </span>
    </div>`,
  })),
})

// ---------------------------------------------------------------- energia

// Regla del bimestre EPE, portada tal cual del Jinja del panel actual:
// menos de 7 dias desde el last_reset del sensor => todavia esta "Midiendo".
const BIMESTRE = `
  const be = states['sensor.lavadero_consumo_general_consumo_bimestre_epe'];
  const lr = be && be.attributes && be.attributes.last_reset ? new Date(be.attributes.last_reset) : null;
  const d = lr ? (Date.now() - lr.getTime()) / 86400000 : 0;
  const midiendo = d < 7;`

const marcoStack = `ha-card { background: ${T.tarjeta} !important; border: 1px solid ${T.borde} !important; border-radius: ${R.grande}px !important; backdrop-filter: blur(6px); box-shadow: none !important; }`

const desnuda = { fondo: 'transparent', borde: 'transparent', radio: 0 }

const energia = () => ({
  type: 'custom:vertical-stack-in-card',
  card_mod: { style: marcoStack },
  cards: [
    tarjeta({
      ...desnuda,
      entidad: 'sensor.shelly_3em_consumo_actual_general',
      tap: { action: 'navigate', navigation_path: '/panel-vertical-2/energia' },
      relleno: '24px 24px 12px',
      html: js(`
        const num = (e) => states[e] ? Math.round(parseFloat(states[e].state)) : null;
        const mil = (v) => v == null ? '--' : v.toLocaleString('es-AR');
        const hoy = states['sensor.lavadero_consumo_general_consumo_hoy'];
        const ref = states['input_number.epe_kwh_por_dia_de_referencia'];
        return '<div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;gap:12px">'
          + '<div>'
          +   '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">Energía ahora</div>'
          +   '<div style="font-family:${T.sora};font-size:52px;font-weight:700;margin-top:8px;line-height:1;color:${T.texto}">'
          +     mil(num('sensor.shelly_3em_consumo_actual_general'))
          +     '<span style="font-size:22px;font-weight:600;color:${T.texto2}"> W</span></div>'
          + '</div>'
          + '<div style="text-align:right;font-size:14px;color:${T.texto2};line-height:1.8">'
          +   '<div>Hoy <b style="color:${T.texto}">' + (hoy ? parseFloat(hoy.state).toFixed(1) : '--') + ' kWh</b>'
          +     (ref ? ' · ref ' + parseFloat(ref.state).toFixed(1) : '') + '</div>'
          +   '<div>Umbral ámbar 900 W · rojo 2.200 W</div>'
          + '</div>'
          + '</div>';
      `),
    }),
    {
      type: 'custom:mini-graph-card',
      entities: ['sensor.shelly_3em_consumo_actual_general'],
      hours_to_show: 24,
      points_per_hour: 1,
      aggregate_func: 'max',
      height: 150,
      hour24: true,
      // state:false porque el valor grande ya lo pone la cabecera de arriba.
      show: { graph: 'bar', extrema: true, state: false, name: false, icon: false, labels: false },
      color_thresholds: [
        { value: 0, color: T.okTexto },
        { value: 900, color: T.alerta },
        { value: 2200, color: T.peligro },
      ],
      card_mod: {
        style: `
          ha-card { background: none !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
          .info { padding: 0 24px 6px !important; }
          .info__item { font-size: 13px !important; }
          .info__item__value { font-size: 13px !important; font-weight: 600 !important; color: ${T.texto} !important; }
          .info__item__type, .info__item__time { font-size: 11px !important; color: ${T.texto3} !important; }
        `,
      },
    },
    tarjeta({
      ...desnuda,
      entidad: 'sensor.shelly_3em_consumo_actual_oficina',
      relleno: '6px 24px 14px',
      html: js(`
        const w = (e) => states[e] ? Math.round(parseFloat(states[e].state)).toLocaleString('es-AR') : '--';
        const sub = (n, v) => '<div style="background:${T.fill};border-radius:14px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">'
          + '<span style="font-size:15px;color:${T.texto2}">' + n + '</span><b style="font-size:17px;color:${T.texto}">' + v + ' W</b></div>';
        return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%">'
          + sub('Oficina', w('sensor.shelly_3em_consumo_actual_oficina'))
          + sub('Quincho', w('sensor.shelly_3em_consumo_actual_quincho'))
          + '</div>';
      `),
    }),
    tarjeta({
      ...desnuda,
      entidad: 'sensor.epe_proyeccion_bimestre',
      tap: { action: 'navigate', navigation_path: '/panel-vertical-2/factura-epe' },
      relleno: '0 24px 22px',
      html: js(`
        ${BIMESTRE}
        const val = (e) => states[e] ? parseFloat(states[e].state) : 0;
        const estado = midiendo ? 'Midiendo' : (Math.round(val('sensor.epe_proyeccion_bimestre')).toLocaleString('es-AR') + ' kWh proyectados');
        const detalle = midiendo
          ? ('Faltan ' + (7 - d).toFixed(1) + ' días · acumulado ' + val('sensor.lavadero_consumo_general_consumo_bimestre_epe').toFixed(1) + ' kWh')
          : ('Costo estimado $' + Math.round(val('sensor.epe_costo_estimado_bimestre')).toLocaleString('es-AR'));
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;background:${alfa(T.alerta, 0.08)};border:1px solid ${alfa(T.alerta, 0.20)};border-radius:14px;padding:12px 16px;width:100%">'
          + '<span style="font-size:14px;color:${T.texto2}">Bimestre EPE · <b style="color:${T.alerta}">' + estado + '</b></span>'
          + '<span style="font-size:13px;color:${T.texto3};text-align:right">' + detalle + '</span>'
          + '</div>';
      `),
    }),
  ],
})

// ------------------------------------------------------------------ clima

const clima = () => ({
  type: 'custom:vertical-stack-in-card',
  card_mod: { style: marcoStack },
  cards: [
    tarjeta({
      ...desnuda,
      entidad: 'weather.forecast_casa',
      tap: { action: 'navigate', navigation_path: '/panel-vertical-2/clima' },
      relleno: '24px 24px 8px',
      html: js(`
        const w = states['weather.forecast_casa'];
        const a = w ? w.attributes : {};
        const MAP = {'clear-night':'Despejado','cloudy':'Nublado','fog':'Niebla','hail':'Granizo','lightning':'Tormenta','lightning-rainy':'Tormenta','partlycloudy':'Parcialmente nublado','pouring':'Lluvia fuerte','rainy':'Lluvioso','snowy':'Nieve','snowy-rainy':'Aguanieve','sunny':'Soleado','windy':'Ventoso','exceptional':'Excepcional'};
        const t = a.temperature != null ? Math.round(a.temperature) : '--';
        // Humedad y viento pasan a PNG; la presion queda en MDI porque no esta en la
        // tabla y no hay emoji que signifique "hectopascales".
        //
        // OJO CON EL TAMAÑO: la regla general dice que los chips de menos de 20 px
        // conservan MDI, y estos median 17. Se subieron a 20 para que la tabla y la regla
        // no se contradigan. Si en la pantalla pesan demasiado en esta fila densa, la
        // vuelta atras es cambiar estas dos lineas por sus iconos mdi de antes.
        const dato = (ico, val) => '<span style="display:inline-flex;align-items:center;gap:5px">'
          + (ico.slice(-4) === '.png'
              ? '<img src="${ICO}' + ico + '" width="20" height="20" style="display:block">'
              : '<ha-icon icon="' + ico + '" style="--mdc-icon-size:20px;color:${T.texto3}"></ha-icon>')
          + '<b style="color:${T.texto};font-weight:600">' + val + '</b></span>';
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%">'
          + '<div style="display:flex;align-items:baseline;gap:14px">'
          +   '<span style="font-family:${T.sora};font-size:56px;font-weight:700;line-height:1;color:${T.texto}">' + t + '°</span>'
          +   '<span style="font-size:17px;color:${T.texto2}">' + (MAP[w ? w.state : ''] || (w ? w.state : '')) + '</span>'
          + '</div>'
          + '<div style="display:flex;gap:16px;font-size:14px;color:${T.texto2}">'
          +   dato('gota.png', (a.humidity != null ? Math.round(a.humidity) + '%' : '--'))
          +   dato('viento.png', (a.wind_speed != null ? Math.round(a.wind_speed) + ' km/h' : '--'))
          +   dato('mdi:gauge', (a.pressure != null ? Math.round(a.pressure) + ' hPa' : '--'))
          + '</div>'
          + '</div>';
      `),
    }),
    {
      type: 'custom:clock-weather-card',
      entity: 'weather.forecast_casa',
      locale: 'es',
      time_format: '24',
      date_pattern: "EEEE d 'de' MMMM",
      forecast_rows: 6,
      hide_today_section: true,
      hide_clock: true,
      hide_date: true,
      card_mod: {
        style: `
          ha-card { background: none !important; border: none !important; box-shadow: none !important; padding: 4px 20px 20px !important; }
          .forecast-item, .forecast-text { font-family: ${T.plex} !important; font-size: 16px !important; }
          .forecast-temperature-bar-background { background: ${T.fill} !important; }
        `,
      },
    },
  ],
})

// ------------------------------------------------------------------- rios

// Mismo marco que el grafico de Clima, para que los dos se lean igual.
const estiloGraficoRios = `
  ha-card { background: ${T.tarjeta} !important; border: 1px solid ${T.borde} !important;
            border-radius: ${R.grande}px !important; box-shadow: none !important; backdrop-filter: blur(6px); }
  .header .name { font-family: ${T.plex} !important; font-size: 14px !important;
                  letter-spacing: 1.6px; text-transform: uppercase; color: ${T.texto3} !important; }
  .header .icon { color: ${T.texto3} !important; }
  /* A lo ancho de la pantalla, los otros cuatro rios se apilaban en columna y
     dejaban un hueco de 90 px entre el valor grande y el Min/Max. En fila no. */
  .states { align-items: baseline !important; }
  .states--secondary { flex-direction: row !important; align-items: baseline !important;
                       flex-wrap: wrap; justify-content: flex-end; gap: 4px 24px !important; }
`
const RIOS = [
  ['sensor.altura_rio_san_javier',  'San Javier',  T.info],
  ['sensor.altura_rio_reconquista', 'Reconquista', T.rosa],
  ['sensor.altura_rio_la_paz_er',   'La Paz ER',   T.lila],
  ['sensor.altura_rio_esquina_cr',  'Esquina',     T.lima],
  ['sensor.altura_rio_corrientes',  'Corrientes',  T.okTexto],
]

/**
 * Alturas de rios, con la misma estructura que el grafico "Adentro" de Clima:
 * cabecera nativa de mini-graph-card en vez de una hecha a mano. Sale gratis y
 * muestra mucho mas: el valor grande del primer rio, los otros cuatro apilados a
 * la derecha con su color, minimo y maximo con la hora de cada uno, la leyenda y
 * las etiquetas del eje. Antes era una leyenda propia arriba y todo lo demas era
 * grafico, que quedaba enorme y decia menos.
 *
 * 30 DIAS: es TODO lo que existe. Medido el 20/08/2026 contra el recorder, la
 * historia de estos sensores arranca el 21/07 y pedir 50 o 182 dias devuelve
 * exactamente los mismos 24 puntos. Pedir mas no agrega datos: estira 30 dias
 * sobre un eje mas largo e interpola, y el grafico miente. Desde el 20/08 los
 * sensores tienen state_class, asi que de aca en adelante se acumulan
 * estadisticas de largo plazo y en unos meses conviene pasar a statistics-graph.
 */
const rios = () => ({
  type: 'custom:mini-graph-card',
  name: 'Alturas de ríos · 30 d',
  icon: 'mdi:waves',
  grid_options: { columns: 'full' },
  hours_to_show: 720,
  // ~1 punto por dia (29 sobre 720 h), que es el ritmo real al que reportan los
  // rios: 24 puntos en 30 dias. Ni inventa ni escalona.
  points_per_hour: 0.04,
  line_width: 2,
  decimals: 2,
  // OJO: `height` no son pixeles, escala con el ancho. A 1017 px de ancho esto
  // da ~205 px de grafico, la misma proporcion que el de temperatura a 500 px.
  height: 78,
  entities: RIOS.map(([entity, name, color]) => ({
    entity, name, color, show_state: true, state_adaptive_color: true,
  })),
  show: { labels: true, points: false, icon: true, state: true, extrema: true, legend: true },
  card_mod: { style: estiloGraficoRios },
})

// ------------------------------------------------------------------ vista

export function vistaInicio () {
  return {
    title: 'Inicio',
    path: 'inicio',
    icon: 'mdi:home-variant',
    type: 'sections',
    max_columns: 2,
    theme: 'Vidrio Animado',
    background: fondoOlas(),
    sections: [
      { type: 'grid', column_span: 2, cards: [cabecera(), cuadro()] },
      { type: 'grid', column_span: 2, cards: [accionesRapidas()] },
      // AQUI NO VA "Sonando ahora", y se probo: el 29/08 se puso y rompia el ritmo de la
      // vista. Ocupa las dos columnas pero solo llena una, y dejaba un hueco grande a la
      // derecha justo entre las acciones rapidas y las tarjetas de gente. Vive solo en
      // la vista Media. Ver scripts/panel2/sonando.mjs.
      { type: 'grid', cards: GENTE.map(persona) },
      // Modos ocupa la media columna que dejo accesos al pasar a 3 tarjetas.
      { type: 'grid', cards: [modos(), alarmaCorta()] },
      // Accesos va a lo ancho: a media pantalla (~500px) tres tarjetas quedan a 160px
      // cada una y no entra el icono + el texto + la tecla. A lo ancho son ~330px.
      { type: 'grid', column_span: 2, cards: [accesos()] },
      { type: 'grid', column_span: 2, cards: [escenas()] },
      { type: 'grid', cards: [energia()] },
      { type: 'grid', cards: [clima(), consumoDiario()] },
      { type: 'grid', column_span: 2, cards: [rios(), aire(120), navbar()] },
    ],
  }
}
