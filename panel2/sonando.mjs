// "Reproduciendo ahora": el hero de la vista Media.
//
// POR QUE EXISTE, y es un pedido del 29/08/2026:
//
// Persona 1 estaba reproduciendo YouTube en el Apple TV del living y dijo "no se ve en
// ningun lugar". El sintoma tenia dos causas: la integracion del Apple TV estaba congelada
// (ver la bitacora) y **la vista Media no distinguia lo que suena de lo que existe**:
// dibujaba un reproductor completo por cada uno de los diez aparatos de la casa.
//
// Ahora manda uno solo, grande, con la caratula de fondo.
//
// POR QUE `auto-entities` Y NO UNA `conditional`
//
// Hace falta que la tarjeta **desaparezca cuando no suena nada**, sin dejar el hueco. Una
// `conditional` sirve para UNA entidad conocida; aca hay que preguntar "cual de los 72
// reproductores esta sonando", que cambia solo. `auto-entities` con `show_empty: false`
// resuelve las dos cosas: elige el que suena y no dibuja nada si no hay ninguno.
//
// LA CARATULA NO SIEMPRE ESTA. YouTube en el Apple TV no publica imagen —comprobado el
// 29/08 con la reproduccion en curso— asi que el fondo cae al color de tarjeta y el texto
// se sigue leyendo. Por eso el velo va sobre la imagen y no reemplaza al fondo.
//
// LOS FANTASMAS DE PLEX: la casa tiene 72 `media_player` y mas de 50 son clientes de Plex
// de sesiones viejas. Estan `unavailable`, asi que el filtro por `state: playing` ya los
// deja afuera; el `exclude` es por si alguno revive.

import { T, R, alfa } from './diseno.mjs'

// El hero. Todo el estilo va por card_mod porque `mini-media-player` no expone estas
// medidas por configuracion.
//
// LA DOBLE BARRA DE PROGRESO que se veia era esto: la tarjeta dibuja su propia barra
// (`.mmp-progress`) y ademas el contenedor mostraba el borde inferior del grid. Se fuerza
// una sola, del color de acento y no del celeste por defecto.
const ESTILO_HERO = `
  ha-card {
    background: ${T.tarjeta} !important;
    border: 1px solid ${T.borde} !important;
    border-radius: ${R.grande}px !important;
    box-shadow: none !important;
    overflow: hidden !important;
    padding: 22px 24px !important;
    min-height: 132px;
  }
  /* La caratula de fondo, con el velo encima para que el texto se lea siempre. */
  .mmp__bg, .mmp-bg {
    filter: none !important;
    opacity: 1 !important;
  }
  .mmp__bg::after, .mmp-bg::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(8,13,26,.75);
  }
  .entity__info__name {
    font-family: ${T.sora} !important;
    font-size: 24px !important;
    font-weight: 700 !important;
    color: ${T.texto} !important;
    line-height: 1.15 !important;
  }
  .entity__info__media {
    font-family: ${T.plex} !important;
    font-size: 16px !important;
    color: ${T.texto2} !important;
    margin-top: 4px !important;
  }
  /* Sin la miniatura de 58px: la caratula ya es el fondo. */
  .entity__icon, .entity__artwork { display: none !important; }

  ha-icon-button {
    --mdc-icon-button-size: 48px;
    --mdc-icon-size: 26px;
    color: ${T.texto} !important;
  }
  .mmp-player__adds { padding-top: 10px !important; }

  /* UNA sola barra, en acento. */
  .mmp-progress {
    --mmp-progress-height: 4px;
    --mmp-accent-color: ${T.acento} !important;
    margin-top: 12px !important;
  }
  .mmp-progress__duration { color: ${T.texto3} !important; font-size: 12px !important; }
`

/**
 * Devuelve la tarjeta lista para meter en una seccion.
 * No lleva rotulo propio: se dibuja sola o no se dibuja.
 */
export const sonandoAhora = () => ({
  type: 'custom:auto-entities',
  show_empty: false,
  card: {
    type: 'grid',
    columns: 1,
    square: false,
  },
  // SIN ESTO LA TARJETA DA "Error de configuracion", y costo una pasada por el panel:
  // `auto-entities` mete lo que encuentra en el parametro `entities` de la tarjeta que
  // envuelve. Una `grid` **no tiene `entities`**: recibe tarjetas enteras en `cards`.
  //
  // La leccion: `auto-entities` sirve para envolver cualquier tarjeta, pero solo adivina
  // sola con las que llevan una lista de entidades (`entities`, `glance`). Para las que
  // llevan tarjetas —grid, vertical-stack, horizontal-stack— hay que declararlo.
  card_param: 'cards',
  filter: {
    include: [{
      domain: 'media_player',
      state: 'playing',
      options: {
        type: 'custom:mini-media-player',
        artwork: 'cover',
        // `power` y `source` afuera: el hero es para MIRAR que suena, no para apagar el
        // equipo. Apagarlo se hace desde su fila, mas abajo.
        hide: { power: true, source: true, runtime: false, progress: false, icon: true },
        card_mod: { style: ESTILO_HERO },
      },
    }],
    exclude: [
      // Los clientes de Plex que quedaron de sesiones viejas.
      { entity_id: 'media_player.plex_*' },
      // El panel del pasillo se reporta como reproductor y no es musica: mostrarlo aca
      // seria decir "esta sonando el panel" cada vez que la pantalla esta encendida.
      { entity_id: 'media_player.panel_samsung_qbc_series' },
      { entity_id: 'media_player.samsung_qbc_series' },
    ],
  },
  sort: { method: 'friendly_name' },
})
