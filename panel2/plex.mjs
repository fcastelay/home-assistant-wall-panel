// El servidor Plex de la mini PC, para la vista Media.
//
// POR QUE ESTE BLOQUE EXISTE, y como se llego el 29/08/2026:
//
// Persona 1 pidio mostrar el Plex en el panel. Al mirar, la integracion estaba en
// `setup_in_progress` con las 46 entidades en `unavailable`. La causa no era HA:
//
//     TU_IP_LAN  ping          responde
//     puerto 445    SMB           ABIERTO
//     puerto 139    NetBIOS       ABIERTO
//     puerto 32400  Plex          cerrado
//
// Si fuera el cortafuegos, SMB tambien estaria cerrado. **El proceso no estaba
// corriendo**: Plex habia dejado de arrancar solo en la mini PC. Ver docs/minipc-plex.ps1.
//
// Y DESPUES, LOS SENSORES DE BIBLIOTECA NO EXISTIAN: figuraban en el registro pero
// **deshabilitados por la integracion**, que es como vienen de fabrica.
//
// LAS CARATULAS NO LLEVAN TOKEN, y eso importa. El sensor entrega el poster como una ruta
// que sirve el propio Home Assistant (`/plex_plex_recently_added?metadata=...`), no como
// una URL a Plex con `X-Plex-Token=` adentro. Si fuera lo segundo, el token terminaria
// escrito en el JSON del panel, que vive en el repositorio y se sincroniza a OneDrive.

import { T, R, alfa, js, tarjeta } from './diseno.mjs'

const SERVIDOR = 'sensor.minipc_tucasa'
const BIBLIOTECAS = [
  ['sensor.minipc_tucasa_library_peliculas', 'Películas', 'mdi:movie-open', T.acento],
  ['sensor.minipc_tucasa_library_series', 'Series', 'mdi:television-classic', T.info],
  ['sensor.minipc_tucasa_library_fotos', 'Fotos', 'mdi:image-multiple', T.lila],
]

/**
 * El servidor, en UNA linea de 56 px.
 *
 * Antes era una tarjeta de 90 px con icono grande, nombre, version y estado. **Todo eso es
 * metadato**: no se toca, no cambia, y estaba comiendo el alto que necesitan las caratulas.
 * Se comprimio a una tira.
 *
 * `sensor.minipc_tucasa` cuenta reproducciones en curso; cuando el servidor se cae, la
 * integracion lo deja en `unavailable`. Por eso se distingue "nadie viendo" de "sin
 * conexion": son cosas muy distintas y el 29/08 se confundieron un rato.
 */
const cabeceraPlex = () => tarjeta({
  entidad: SERVIDOR,
  tap: { action: 'more-info' },
  radio: R.media,
  relleno: '0 18px',
  alto: '56px',
  html: js(`
    const s = states['${SERVIDOR}'];
    const hay = s && s.state !== 'unavailable' && s.state !== 'unknown';
    const n = hay ? parseInt(s.state, 10) : null;
    const upd = states['update.plex_media_server_minipc_tucasa'];
    const version = upd && upd.attributes.installed_version
      ? String(upd.attributes.installed_version).split('-')[0] : null;

    const col = !hay ? '${T.peligro}' : (n > 0 ? '${T.okTexto}' : '${T.texto2}');
    const dice = !hay ? 'sin conexión' : (n === 0 ? 'nadie viendo' : n + ' viendo');

    return '<div style="display:flex;align-items:center;gap:11px;width:100%;height:100%">'
      + '<ha-icon icon="mdi:plex" style="color:' + (hay ? '${T.ambar}' : '${T.texto3}')
      +   ';--mdc-icon-size:20px;flex:none"></ha-icon>'
      + '<span style="font-size:15px;font-weight:600;color:${T.texto};flex:none">Plex</span>'
      + '<span style="font-size:12.5px;color:${T.texto3};flex:1;min-width:0;'
      +   'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">mini PC'
      +   (version ? ' · v' + version : '') + '</span>'
      + '<span style="font-size:13.5px;color:' + col + ';flex:none">' + dice + '</span>'
      + '</div>';
  `),
})

/**
 * Las tres bibliotecas, en cifras.
 *
 * ALTURA FIJA DE 120 px Y NADA DE SCROLL INTERNO. La version anterior tenia 104 px y el
 * segundo renglon —"57 series", "30 álbumes"— se cortaba abajo. El numero manda: 34 px en
 * Sora, que es lo que se lee desde lejos en una pared.
 */
const bibliotecas = () => ({
  type: 'grid',
  columns: 3,
  square: false,
  grid_options: { columns: 'full' },
  cards: BIBLIOTECAS.map(([ent, nombre, icono, color]) => tarjeta({
    entidad: ent,
    tap: { action: 'more-info' },
    radio: R.media,
    relleno: '12px 10px',
    alto: '120px',
    html: js(`
      const s = states['${ent}'];
      const hay = s && !isNaN(parseInt(s.state, 10));
      const n = hay ? parseInt(s.state, 10) : null;
      // Miles con punto, que es como se escribe aca: 11.106 y no 11,106.
      const mil = (x) => String(x).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');

      // El segundo renglon cambia segun la biblioteca: en series importa cuantas series
      // hay, no cuantos episodios sueltos; en fotos, cuantos albumes.
      const a = s ? s.attributes : {};
      let detalle = '';
      if (a.shows !== undefined) detalle = a.shows + ' series';
      else if (a.photoalbums !== undefined) detalle = a.photoalbums + ' álbumes';

      return '<div style="display:flex;flex-direction:column;align-items:center;'
        + 'justify-content:center;gap:6px;height:100%;text-align:center;overflow:hidden">'
        + '<ha-icon icon="${icono}" style="color:${color};--mdc-icon-size:22px;flex:none"></ha-icon>'
        + '<span style="font-family:${T.sora};font-size:34px;font-weight:700;color:${T.texto};'
        +   'line-height:1;flex:none">' + (hay ? mil(n) : '--') + '</span>'
        + '<span style="font-size:13px;color:${T.texto2};line-height:1.1;flex:none">${nombre}</span>'
        + (detalle
            ? '<span style="font-size:11.5px;color:${T.texto3};line-height:1.1;flex:none">' + detalle + '</span>'
            : '')
        + '</div>';
    `),
  })),
})

/**
 * Los estrenos: dos titulos por lista, con el poster a la derecha.
 *
 * POR QUE NO SE USA `upcoming-media-card`, que estaba instalada y se probo primero: su
 * modo `fanart` pone el texto ENCIMA de la imagen y sobre un fotograma claro no se lee
 * nada; su modo `poster` deja tiras verticales finisimas en una pantalla vertical.
 *
 * Esta version separa las dos cosas: el texto sobre fondo solido a la izquierda, la
 * caratula limpia a la derecha. Se lee siempre, sin importar la foto.
 *
 * LA CARATULA VA EN SU PROPORCION, Y ESTO COSTO UNA PASADA. El primer intento le dio a la
 * imagen el 40 % del ancho y el alto completo: una caja APAISADA. Pero el poster de Plex es
 * VERTICAL (2:3), asi que `object-fit: cover` recortaba la franja del medio y quedaba una
 * boca, un puño, una oreja. Persona 1 lo dijo exacto: **"asi no dicen nada las caratulas"**.
 *
 * Ahora la imagen conserva su relacion 2:3 (`aspect-ratio`) y el ancho sale del alto de la
 * fila. Se ve el poster entero, que es lo unico que se reconoce de un vistazo.
 *
 * CUANTOS TITULOS: seis por lista. Primero se pusieron dos, por miedo a que el panel
 * vertical quedara con demasiado scroll. Persona 1 lo vio y dijo que **prefería la version
 * anterior porque mostraba mas**. Tenia razon: el problema de aquella era que el texto iba
 * encima de la imagen y no se leia, no la cantidad. Arreglada la legibilidad, la cantidad
 * vuelve.
 *
 * Para que entren seis sin comerse la pantalla la fila quedo en 132 px, que da un poster
 * de 88 px de ancho: chico pero reconocible.
 */
const estrenos = (ent, titulo) => tarjeta({
  entidad: ent,
  tap: { action: 'none' },
  // Sin marco propio: cada titulo dibuja el suyo.
  fondo: 'transparent',
  borde: 'transparent',
  radio: 0,
  relleno: '0',
  grid: { columns: 'full' },
  html: js(`
    const s = states['${ent}'];
    const d = s && Array.isArray(s.attributes.data) ? s.attributes.data : [];
    // El primer elemento es la cabecera que usa upcoming-media-card, no un titulo.
    const items = d.filter(function (x) { return x && x.title; }).slice(0, 6);
    if (!items.length) return '';

    const filas = items.map(function (x) {
      const min = parseInt(x.runtime, 10);
      const dur = isNaN(min) ? '' : (min >= 60
        ? Math.floor(min / 60) + 'h ' + (min % 60 ? (min % 60) + 'm' : '') : min + 'm');
      // Linea de datos: puntuacion, duracion, generos. Se arma con lo que haya.
      const meta = [x.rating, dur, x.genres].filter(Boolean).join(' · ');
      const fecha = x.aired || '';
      const sub = [x.number, fecha].filter(Boolean).join(' · ');

      return '<div style="display:flex;background:${T.tarjeta};border:1px solid ${T.borde};'
        + 'border-radius:${R.media}px;overflow:hidden;height:132px;margin-bottom:8px">'
        + '<div style="flex:1;min-width:0;padding:14px 16px;display:flex;flex-direction:column;'
        +   'justify-content:center;gap:6px">'
        +   '<span style="font-family:${T.sora};font-size:17.5px;font-weight:600;color:${T.texto};'
        +     'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.2">'
        +     x.title + '</span>'
        +   (sub ? '<span style="font-size:13px;color:${T.texto3}">' + sub + '</span>' : '')
        +   (meta ? '<span style="font-size:13.5px;color:${T.texto2};overflow:hidden;'
        +     'text-overflow:ellipsis;white-space:nowrap">' + meta + '</span>' : '')
        + '</div>'
        + (x.poster
            ? '<img src="' + x.poster + '" style="height:100%;width:auto;aspect-ratio:2/3;'
              + 'object-fit:cover;flex:none;display:block">'
            : '')
        + '</div>';
    }).join('');

    return '<div style="width:100%">'
      + '<div style="font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;'
      +   'color:${T.texto3};margin:0 0 10px 6px">${titulo}</div>'
      + filas + '</div>';
  `),
})

/**
 * El servidor y las bibliotecas: van a lo ancho de la vista.
 *
 * Los estrenos NO estan aca. Se exportan aparte porque van en dos columnas, y una seccion
 * de Lovelace no puede tener parte de sus tarjetas a lo ancho y parte en media columna:
 * eso se decide por seccion, no por tarjeta.
 */
export const bloquePlex = () => [cabeceraPlex(), bibliotecas()]

/** Peliculas nuevas. Va en media columna. */
export const estrenosPeliculas = () =>
  estrenos('sensor.plex_plex_recently_added_movie', 'Películas nuevas')

/** Series nuevas. Va en la otra media. */
export const estrenosSeries = () =>
  estrenos('sensor.plex_plex_recently_added_show', 'Series nuevas')
