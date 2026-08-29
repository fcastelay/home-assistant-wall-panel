// Navbar liquid-lens del Panel Vertical 2.
// La tarjeta no expone colores por config: el restyle va por card_mod sobre su
// shadow root (.lln-scroll es la barra visible, .lln-btn-active usa --primary-color).

import { T, alfa } from './diseno.mjs'

// PALETA DE LA BARRA. Tres tonos que no estan en los tokens generales porque solo se usan
// aca, y estan calibrados para que los nueve iconos convivan sin que ninguno grite:
//
//   apagado   el ambar de Luces cuando no hay ninguna prendida. NO es gris: el item
//             conserva su identidad de color aunque este en reposo.
//   cielo     el azul de Clima. Mas frio que el celeste de Camaras para que no se
//             confundan, que estan a dos lugares de distancia.
//   rosa      el de Media en reposo.
const N = {
  apagado: '#c0a36a',
  cielo:   '#7ba9ff',
  rosa:    '#ff9dc4',
  label:   '#aab3d0',
}

// Icono, etiqueta, ruta y COLOR. El prototipo del handoff usa emoji, que se ven
// en color; DISENO.md manda reemplazarlos por MDI, que son monocromos. El color
// por ruta recupera eso sin salirse del set de iconos.
// Ningun color se repite entre vecinos.
export const RUTAS = [
  ['mdi:home-variant',        'Inicio',    'inicio',       T.acento,   'casa.png'],
  ['mdi:lightbulb-group',     'Luces',     'luces',        N.apagado,  'lampara.png'],
  ['mdi:shield-home',         'Alarma',    'alarma',       T.alerta,   'escudo.png'],
  ['mdi:cctv',                'Cámaras',   'camaras',      T.info,     'camara.png'],
  ['mdi:floor-plan',          'Ambientes', 'habitaciones', T.lila,     'ambientes.png'],
  ['mdi:weather-partly-rainy','Clima',     'clima',        N.cielo,    'clima.png'],
  ['mdi:multimedia',          'Media',     'media',        N.rosa,     'musica.png'],
  ['mdi:lightning-bolt',      'Energía',   'energia',      T.alerta,   'rayo.png'],
  ['mdi:dots-horizontal',     'Más',       'mas',          T.texto2,   'mas.png'],

  // DE CATORCE A NUEVE, el 29/08/2026.
  //
  // La barra tenia catorce iconos de 26 px apretados en una fila de pantalla vertical:
  // nadie apunta bien, y las que se usan todos los dias quedaban al mismo nivel que la
  // factura de la EPE, que se mira una vez cada dos meses.
  //
  // Las seis que salieron viven en la vista "Mas" (scripts/panel2/vistas/mas.mjs):
  //
  //     Redes · Aparatos · Camioneta · Factura EPE · Sausalito · Automatizaciones
  //
  // **Las vistas NO se tocaron**: siguen existiendo con su ruta y se llega escribiendo la
  // URL. Lo unico que cambio es que dejaron de tener lugar fijo en la barra.
  //
  // Escenas salio antes, el 28/08, a pedido de Persona 1. La vista sigue en
  // /panel-vertical-2/escenas.
]

// CADA ICONO CON SU COLOR, y esto va y viene: el 29/08 se unificaron todos en gris para
// matar el arcoiris de catorce tonos, y Persona 1 lo vio y pidio devolverles el color con
// una paleta calibrada. Tenia razon y la diferencia no es el color: es CUANTOS.
//
// Catorce colores sin criterio son ruido. Nueve elegidos para no repetirse entre vecinos
// dejan la barra viva y **siguen dejando leer donde estas parado**, porque el item activo
// se marca con el fondo de acento y no con el tono del icono.
//
// Los iconos llevan su color SIEMPRE, este o no en la vista activa. Nada de bajarles la
// opacidad: la saturacion ya esta calibrada y atenuar los apaga a todos por igual, que es
// volver al problema anterior por otro camino.
const colorIcono = (ruta, base, dinamico = null) =>
  `[[[ ${dinamico || ''}
       return '${base}'; ]]]`

// Adornos que ya tenia el panel actual y se conservan.
const EXTRA = {
  luces: {
    // Con luces prendidas, ambar pleno. Sin ninguna, el mismo ambar apagado: el item no
    // pierde su identidad de color cuando esta en reposo.
    dinamico: `const n = Object.keys(states).filter(e => e.startsWith('light.') && states[e].state === 'on'
      && !/_segment_|awtrix|todas_las_luces|grupo_luces|luces_afuera|hue_color_lamp/.test(e)).length;
      if (n > 0) return '${T.alerta}';`,
  },
  // Verde si algo esta sonando, rosa si no. Se excluyen los mismos fantasmas que en la
  // tarjeta "Sonando ahora": los clientes viejos de Plex y el panel del pasillo, que se
  // reporta como reproductor cada vez que la pantalla esta encendida.
  media: {
    dinamico: `const suena = Object.keys(states).some(e => e.startsWith('media_player.')
      && states[e].state === 'playing'
      && !/^media_player\\.plex_|panel_samsung_qbc|^media_player\\.samsung_qbc/.test(e));
      if (suena) return '${T.okTexto}';`,
  },
  alarma: {
    // ARMADA ES VERDE, NO ROJA, y el cambio importa mas de lo que parece.
    //
    // Antes armada salia en rojo. Pero armada es el estado que uno QUIERE: la casa
    // cuidada. Pintarlo de rojo hace que la barra parezca en alerta permanente cada noche,
    // y cuando todo grita, nada grita. El rojo queda para lo unico que es una emergencia
    // de verdad: `triggered`, que ademas late.
    dinamico: `const a = states['alarm_control_panel.alarmo'];
      if (a && a.state === 'triggered') return '${T.peligro}';
      if (a && a.state.startsWith('armed')) return '${T.okTexto}';
      if (a && a.state === 'disarmed') return '${T.alerta}';`,
    pulse: "[[[ const a=states['alarm_control_panel.alarmo']; return !!a && a.state === 'triggered'; ]]]",
  },
  energia: {
    value_entity: 'sensor.shelly_3em_consumo_actual_general',
    value_color: T.alerta,
  },
}

/**
 * @param base   prefijo de las rutas de navegacion
 * @param rutas  subconjunto de RUTAS. Por defecto van las 13; el tablero del celular
 *               pasa 5, que es lo que entra en una fila sin scrollear.
 */
export function navbar (base = '/panel-vertical-2', rutas = RUTAS) {
  return {
    type: 'custom:liquid-lens-navbar-card',
    hide_labels: false,
    icon_size: 26,
    button_size: 64,
    item_gap: 4,
    routes: rutas.map(([icon, label, path, color, imagen]) => {
      const { dinamico, ...resto } = EXTRA[path] || {}
      return {
        icon,
        label,
        ...resto,
        icon_color: colorIcono(path, color, dinamico),
        tap_action: { action: 'navigate', navigation_path: `${base}/${path}` },
      }
    }),
    card_mod: {
      // LOS ICONOS A COLOR SE PINTAN POR CSS, y no por configuracion, porque
      // `liquid-lens-navbar-card` NO acepta una imagen por ruta. Sus propiedades son
      // `icon`, `icon_color`, `pulse`, `dots`, `value_entity` y `value_color`: ninguna
      // toma una URL. Se comprobo leyendo la tarjeta, no suponiendo.
      //
      // Entonces se deja el `ha-icon` en su lugar —para no romper el layout ni el
      // comportamiento del item activo— y se le pone el PNG de fondo, con el glifo en
      // transparente. El selector va por `data-index`, que es lo que la tarjeta escribe
      // en cada boton: es estable y no depende de nombres de clase internos.
      //
      // EL MDI SIGUE DECLARADO A PROPOSITO: si un PNG faltara, el CSS no pinta nada y
      // queda el icono monocromo. Un icono feo es mejor que un hueco.
      style: `
        ${rutas.map(([, , , , img], i) => img ? `
        .lln-btn[data-index="${i}"] ha-icon {
          background: url('/local/iconos/color/${img}') center / 26px 26px no-repeat;
          color: transparent !important;
        }` : '').join('')}
        .lln-scroll {
          border-radius: 28px !important;
          background: rgba(15,23,48,.92) !important;
          border: 1px solid rgba(139,147,255,.18) !important;
          box-shadow: 0 12px 34px rgba(0,0,0,.45) !important;
        }
        .lln-bar { padding: 10px 14px !important; }
        /* La tarjeta trae border-radius:999px, o sea que el item activo queda
           como un circulo con el icono y la etiqueta apretados adentro. El
           prototipo usa un rectangulo redondeado de 18px. */
        .lln-btn {
          --primary-color: ${T.acento};
          border-radius: 18px !important;
        }
        /* El item activo va con el acento MACIZO y el icono oscuro encima, como el
           resto del rediseno.
           Antes esto se habia descartado porque el acento macizo convertia al item en un
           bloque de 64x64 que se comia la barra: eso pasaba con el border-radius:999px que
           trae la tarjeta. Con los 18px de arriba el bloque ya no es un circulo y el
           problema no se repite. */
        .lln-btn.lln-btn-active {
          background: ${T.acento} !important;
          box-shadow: none !important;
        }
        /* En el item activo NO se toca el icono: la especificacion pide que la imagen
           quede igual y que el cambio lo marque el pill de acento y el label oscuro.
           (La regla que ponia el glifo en oscuro se saco: sobre un PNG de fondo no hacia
           nada y solo confundia al leer el CSS.) */
        .lln-label {
          font-size: 10.5px !important;
          opacity: 1 !important;
          margin-top: 3px !important;
          font-family: ${T.plex};
          letter-spacing: .01em;
          /* Mas claro que texto3: con el fondo de olas, el gris oscuro se perdia. */
          color: ${N.label};
        }
        .lln-btn.lln-btn-active .lln-label { color: ${T.acentoFg} !important; font-weight: 700; }
        /* El lens es el circulo que sigue al dedo mientras arrastras. En reposo
           queda estacionado sobre el PRIMER boton, asi que parecen dos items
           seleccionados a la vez: el lens en Inicio y el tinte en el activo.
           En un panel de pared se toca, no se arrastra: va oculto. */
        .lln-lens { opacity: 0 !important; }
      `,
    },
  }
}
