// Vista Automatizaciones del Panel Vertical 2.
//
// LA IDEA, y es lo que la separa de una lista de interruptores:
//
// El dato util de una automatizacion NO es si esta encendida: es si esta HACIENDO algo.
// La auditoria del 28/08 encontro ocho calladas porque la casa anda bien (rio en alza,
// respaldo fallido, consumo anomalo) y una callada porque apuntaba a sensores que no
// existen. **Con un interruptor las dos se ven identicas.**
//
// Por eso esta vista clasifica por SALUD y no por estado:
//
//   verde     disparo en las ultimas 24 h            -> trabajando
//   celeste   es un vigia y nunca/casi nunca dispara -> callada porque todo anda bien
//   ambar     lleva mas de 30 dias sin disparar      -> dormida, mirar
//   rojo      encendida y NUNCA disparo, y no es vigia -> probablemente rota
//   gris      apagada
//
// Los grupos salen del nombre, no de una lista escrita a mano: la casa nombra sus
// automatizaciones con prefijo ("Luz ...", "Panel - ...", "Aviso - ..."), asi que agregar
// una la ubica sola.

import { T, R, alfa, js, tarjeta, aire, cuadro, fondoOlas } from '../diseno.mjs'
import { navbar } from '../navbar.mjs'
import { rotulo } from '../restilar.mjs'

/* Los vigias: automatizaciones cuyo silencio es una buena noticia. Se reconocen por el
 * prefijo del nombre. Si se agrega una familia nueva de alarmas, va aca. */
const VIGIAS = "/^(Aviso|Respaldo|Consumo|Vigilante|Vigia|Enviar mensaje|Notificacion)/i"

/* Calcula la salud de cada automatizacion mirando `states`. Se comparte entre las
 * tarjetas para no repetir la logica. */
const SALUD = `
  const DIA = 86400000;
  const esVigia = (n) => ${VIGIAS}.test(n);
  const autos = Object.keys(states)
    .filter(e => e.indexOf('automation.') === 0)
    .map(function (e) {
      const s = states[e];
      const n = s.attributes.friendly_name || e.replace('automation.', '');
      const u = s.attributes.last_triggered ? Date.parse(s.attributes.last_triggered) : null;
      const dias = u ? (Date.now() - u) / DIA : null;
      let salud, texto;
      if (s.state !== 'on') { salud = 'apagada'; texto = 'apagada'; }
      else if (dias !== null && dias < 1) { salud = 'bien'; texto = 'activa hoy'; }
      else if (u === null && esVigia(n)) { salud = 'vigia'; texto = 'vigilando'; }
      else if (u === null) { salud = 'rota'; texto = 'nunca disparo'; }
      else if (dias > 30 && esVigia(n)) { salud = 'vigia'; texto = 'vigilando'; }
      else if (dias > 30) { salud = 'dormida'; texto = 'hace ' + Math.round(dias) + ' dias'; }
      else { salud = 'bien'; texto = 'hace ' + Math.round(dias) + (Math.round(dias) === 1 ? ' dia' : ' dias'); }
      return { e: e, n: n, u: u, dias: dias, salud: salud, texto: texto };
    });
  const COLOR = {
    bien: '${T.okTexto}', vigia: '${T.info}', dormida: '${T.alerta}',
    rota: '${T.peligro}', apagada: '${T.texto3}'
  };
`

// ------------------------------------------------------------------ cabecera

const resumen = () => tarjeta({
  entidad: 'sensor.time',
  tap: { action: 'none' },
  radio: R.grande,
  relleno: '22px 24px',
  grid: { columns: 'full' },
  html: js(`
    ${SALUD}
    const c = { bien: 0, vigia: 0, dormida: 0, rota: 0, apagada: 0 };
    autos.forEach(function (a) { c[a.salud]++; });

    const pastilla = (n, txt, col) => n
      ? '<div style="display:inline-flex;align-items:center;gap:7px;background:' + col + '1f;'
        + 'border:1px solid ' + col + '44;border-radius:99px;padding:6px 13px;font-size:14px;color:' + col + '">'
        + '<b style="font-size:16px">' + n + '</b> ' + txt + '</div>'
      : '';

    return '<div style="width:100%">'
      + '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3}">AUTOMATIZACIONES</div>'
      + '<div style="display:flex;align-items:baseline;gap:10px;margin:6px 0 12px">'
      +   '<span style="font-family:${T.sora};font-size:44px;font-weight:800;line-height:1;color:${T.texto}">' + autos.length + '</span>'
      +   '<span style="font-size:15px;color:${T.texto2}">en la casa</span>'
      + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px">'
      +   pastilla(c.bien, 'trabajando', COLOR.bien)
      +   pastilla(c.vigia, 'vigilando', COLOR.vigia)
      +   pastilla(c.dormida, 'dormidas', COLOR.dormida)
      +   pastilla(c.rota, 'sin disparar nunca', COLOR.rota)
      +   pastilla(c.apagada, 'apagadas', COLOR.apagada)
      + '</div></div>';
  `),
})

// -------------------------------------------------------- las que hay que mirar

/**
 * Solo aparece cuando hay algo que mirar. Es la tarjeta que hubiera encontrado sola la
 * `Luz acompana - Dormitorio` que apuntaba a sensores inexistentes: encendida, prolija,
 * y sin disparar jamas.
 */
const revisar = () => tarjeta({
  entidad: 'sensor.time',
  tap: { action: 'none' },
  radio: R.media,
  relleno: '16px 18px',
  grid: { columns: 'full' },
  fondo: alfa(T.peligro, 0.07),
  borde: alfa(T.peligro, 0.22),
  html: js(`
    ${SALUD}
    const malas = autos.filter(function (a) { return a.salud === 'rota' || a.salud === 'dormida'; })
                       .sort(function (a, b) { return (b.dias || 1e9) - (a.dias || 1e9); });
    if (!malas.length) {
      return '<div style="display:flex;align-items:center;gap:10px;width:100%">'
        + '<ha-icon icon="mdi:check-circle-outline" style="color:${T.okTexto};--mdc-icon-size:20px"></ha-icon>'
        + '<span style="font-size:14.5px;color:${T.texto2}">Ninguna encendida sin trabajar. Los vigias en silencio son buena senal.</span>'
        + '</div>';
    }
    const filas = malas.slice(0, 8).map(function (a) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid ${T.borde}">'
        + '<span style="width:7px;height:7px;border-radius:50%;background:' + COLOR[a.salud] + ';flex:none"></span>'
        + '<span style="flex:1;min-width:0;font-size:14px;color:${T.texto};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + a.n + '</span>'
        + '<span style="font-size:12.5px;color:' + COLOR[a.salud] + ';flex:none">' + a.texto + '</span>'
        + '</div>';
    }).join('');
    return '<div style="width:100%">'
      + '<div style="display:flex;align-items:center;gap:9px;margin-bottom:4px">'
      +   '<ha-icon icon="mdi:alert-circle-outline" style="color:${T.peligro};--mdc-icon-size:19px"></ha-icon>'
      +   '<span style="font-size:14.5px;font-weight:600;color:${T.texto}">' + malas.length + ' encendida' + (malas.length === 1 ? '' : 's') + ' que no trabaja' + (malas.length === 1 ? '' : 'n') + '</span>'
      + '</div>' + filas
      + (malas.length > 8 ? '<div style="font-size:12px;color:${T.texto3};padding-top:7px">y ' + (malas.length - 8) + ' mas</div>' : '')
      + '</div>';
  `),
})

// ------------------------------------------------------------- actividad de hoy

/** La casa respirando: que se disparo en las ultimas 12 horas, de lo mas nuevo a lo mas viejo. */
const actividad = () => tarjeta({
  entidad: 'sensor.time',
  tap: { action: 'none' },
  radio: R.media,
  relleno: '16px 18px',
  grid: { columns: 'full' },
  html: js(`
    ${SALUD}
    const corte = Date.now() - 12 * 3600000;
    const hoy = autos.filter(function (a) { return a.u && a.u > corte; })
                     .sort(function (a, b) { return b.u - a.u; });
    if (!hoy.length) return '<span style="font-size:14px;color:${T.texto3}">Sin actividad en 12 horas</span>';
    const hh = function (t) {
      const d = new Date(t);
      return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    };
    const filas = hoy.slice(0, 12).map(function (a, i) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0' + (i ? ';border-top:1px solid ${T.borde}' : '') + '">'
        + '<span style="font-family:${T.mono || 'ui-monospace,monospace'};font-size:13px;color:${T.texto3};flex:none;width:42px">' + hh(a.u) + '</span>'
        + '<span style="flex:1;min-width:0;font-size:14px;color:${T.texto};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + a.n + '</span>'
        + '</div>';
    }).join('');
    return '<div style="width:100%">'
      + '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${T.texto3};margin-bottom:4px">ULTIMAS 12 HORAS · ' + hoy.length + '</div>'
      + filas + '</div>';
  `),
})

// ------------------------------------------------------------------- los grupos

/**
 * Grupos por funcion. Cada uno usa `auto-entities`, que ya esta instalada: la lista se
 * arma sola en el navegador con un filtro sobre el nombre, asi que **una automatizacion
 * nueva aparece sin tocar nada**.
 *
 * `secondary_info: last-triggered` es la mitad del valor: al lado del interruptor se ve
 * cuando trabajo por ultima vez.
 */
const GRUPOS = [
  ['Luces', 'mdi:lightbulb-group', '^(Luz|Reflectores|Retroiluminacion|Apagar [Ll]uces|Todos Salimos|Movimiento Fuera|Apagado Inteligente|Fuera de Casa)'],
  ['Panel y reloj', 'mdi:monitor-dashboard', '^(Panel|Reloj)'],
  ['Red', 'mdi:lan', '^Red'],
  ['Seguridad y accesos', 'mdi:shield-home', '^(Cerradura|Porton|Portón|Puerta|Melita|Llegada|Salida|Simulador|Gestionar Modo|Camara|Timbre|Movimiento portero)'],
  ['Avisos y vigias', 'mdi:bell-alert', '^(Aviso|Consumo|Respaldo|Vigilante|Enviar mensaje|Notificacion)'],
  ['Casa y aparatos', 'mdi:home-automation', '^(Pedro|Freidora|Heladera|Riego|Apagar bomba|SMARTi|Apple|Aprender|Buenos dias)'],
]

const grupo = ([titulo, icono, patron]) => ({
  type: 'custom:auto-entities',
  card: {
    type: 'entities',
    title: titulo,
    icon: icono,
    state_color: true,
  },
  filter: {
    include: [{
      domain: 'automation',
      attributes: { friendly_name: '/' + patron + '/' },
      options: { secondary_info: 'last-triggered' },
    }],
  },
  sort: { method: 'friendly_name' },
  show_empty: false,
})

// ---------------------------------------------------------------------- vista

export function vistaAutomatizaciones () {
  return {
    title: 'Automatizaciones',
    path: 'automatizaciones',
    icon: 'mdi:robot',
    type: 'sections',
    max_columns: 2,
    theme: 'Vidrio Animado',
    background: fondoOlas(),
    // TODO A ANCHO COMPLETO, EN UNA SOLA COLUMNA.
    //
    // La primera version repartia los seis grupos en secciones de media columna. Cada
    // grupo tiene entre 2 y 12 filas, asi que al emparejarse quedaban huecos enormes: en
    // una disposicion de dos columnas, la seccion mas corta de cada fila deja el vacio
    // hasta la altura de la mas larga.
    //
    // Con una sola columna no hay nada que emparejar y no queda ni un hueco. En una
    // pantalla vertical de 1080 px una lista a ancho completo ademas se lee mejor: los
    // nombres largos no se cortan.
    sections: [
      { type: 'grid', column_span: 2, cards: [resumen(), cuadro()] },
      { type: 'grid', column_span: 2, cards: [revisar()] },
      { type: 'grid', column_span: 2, cards: [actividad()] },
      { type: 'grid', column_span: 2, cards: GRUPOS.map(grupo) },
      { type: 'grid', column_span: 2, cards: [aire(120), navbar()] },
    ],
  }
}
