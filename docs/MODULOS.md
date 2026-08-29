# Los módulos, uno por uno

Referencia de qué hace cada archivo y qué hay que tocar para adaptarlo.

---

## `panel2/diseno.mjs` — los tokens y las piezas base

**Lo que hay que leer primero.** Todo lo demás depende de esto.

| Exporta | Qué es |
|---|---|
| `T` | colores, tipografías |
| `R` | radios: `grande` 24, `media` 20, `chica` 14, `pill` 99 |
| `alfa(hex, a)` | convierte `#8b93ff` + `.16` en `rgba(...)` |
| `js(codigo)` | envuelve JS como plantilla de `button-card` |
| `tarjeta({...})` | **la pieza con la que se construye casi todo** |
| `etiqueta`, `aire`, `cuadro`, `fondoOlas` | rótulos, espaciadores, protector, fondo |

### `tarjeta()`

Un `button-card` que sólo dibuja el HTML que se le pasa:

```js
tarjeta({
  html,          // string fijo, o js(...) para contenido que reacciona
  entidad,       // hace que se redibuje cuando esa entidad cambia
  tap, hold, doble,
  grid,          // grid_options
  alto, relleno, radio, fondo, borde,
})
```

Dos detalles que no son obvios y están puestos por algo:

```js
extra_styles: '* { box-sizing: border-box; }'
```
Sin eso, un hijo con `width:100%` más padding se desborda de la tarjeta.

```js
'grid-template-columns': 'minmax(0, 1fr)'
```
Sin `minmax`, un texto largo ensancha la columna y el contenido se recorta.

---

## `panel2/construir.mjs` — el orquestador

Lee el tablero que está en Home Assistant, transforma las vistas que tienen rediseño,
conserva las que no, agrega las nuevas, y escribe el JSON.

```js
const conRedes = views.filter(v => v.path !== 'redes').concat([vistaRedes()])
const conMas   = conAutos.filter(v => v.path !== 'mas').concat([vistaMas()])
return { ...base, views: normalizarNavbar(normalizarCuadros(conMas)) }
```

`normalizarNavbar()` y `normalizarCuadros()` recorren **todas** las vistas y reemplazan la
barra y el protector. Sin eso, las vistas que no se rediseñaron se quedan con la barra
vieja: pasó, y el síntoma fue una ruta nueva que aparecía en 14 vistas y en 15 no.

---

## `panel2/navbar.mjs` — la barra inferior

Nueve rutas. Cada una: ícono MDI, etiqueta, ruta, color base y un PNG a color.

Tres llevan color dinámico, y son las únicas que **informan** en vez de adornar:

| Ruta | Cuándo cambia |
|---|---|
| Luces | ámbar pleno si hay alguna prendida |
| Alarma | verde armada, rojo disparada (late), ámbar desarmada |
| Media | verde si algo está reproduciendo |

El resto del estilo va por `card_mod`. Lo importante: el ítem activo se marca con el fondo
de acento, **no** con el color del ícono — por eso los íconos pueden tener color propio sin
que se confunda dónde estás parado.

---

## `panel2/restilar.mjs` — envolver lo nativo

Algunas tarjetas de Home Assistant se conservan tal cual y se les cambia el aspecto con
`card_mod`. Es a propósito: adentro tienen toggles, selectores y botones que se perderían
al rehacerlas como HTML plano.

```js
export const marco = (carta, extra = '') => ({ ...carta, card_mod: { style: `...${extra}` } })
export const rotulo = (texto, derecha = '') => tarjeta({ ... })
```

---

## `panel2/sonando.mjs` — qué está sonando

Un `auto-entities` que busca cualquier `media_player` en `playing` y lo dibuja grande, con
la carátula de fondo. **Si no suena nada, no se dibuja**: `show_empty: false`.

Dos cosas que costaron una pasada por el panel:

```js
card_param: 'cards',
```
`auto-entities` mete lo que encuentra en `entities` de la tarjeta que envuelve. Una `grid`
**no tiene `entities`**: recibe tarjetas en `cards`. Sin esta línea, "Error de
configuración".

```js
artwork: 'cover',   // y no 'full-cover'
```
No todos los reproductores publican imagen —YouTube en Apple TV no— y `full-cover` deja un
rectángulo negro.

---

## `panel2/plex.mjs` — el servidor de medios

Tres bloques: una línea con el estado del servidor, tres cifras de biblioteca, y dos
paredes de estrenos con carátula.

Los estrenos **no** usan `upcoming-media-card`, aunque esté instalada: su modo `fanart` pone
el texto encima de la imagen y sobre un fotograma claro no se lee. Se dibujan a mano, con
el texto sobre fondo sólido a la izquierda y la carátula a la derecha.

**La carátula conserva su proporción 2:3.** Meterla en una caja apaisada recorta la franja
del medio y se ve una boca, un puño, una oreja: no era mala carátula, era mal recorte.

---

## `panel2/bajar-iconos.mjs` — los íconos a color

Descarga 43 PNG de Fluent Emoji a `/config/www/iconos/color/` y **comprueba que Home
Assistant los sirva** por `/local/`, no sólo que el archivo esté escrito.

Los nombres de carpeta del repositorio usan el nombre CLDR del emoji: `Light bulb`,
`Sun behind rain cloud`. Algunos cuelgan de `<Carpeta>/3D/` y otros de
`<Carpeta>/Default/3D/`, así que se prueban las dos.

---

## Las vistas

| Archivo | Vistas | Nota |
|---|---|---|
| `vistas/inicio.mjs` | Inicio | La más grande. Acciones rápidas, personas, modos, escenas, clima, energía |
| `vistas/luces.mjs` | Luces | Sliders por ambiente |
| `vistas/habitaciones.mjs` | Ambientes | |
| `vistas/camaras.mjs` | Cámaras | |
| `vistas/alarma.mjs` | Alarma | |
| `vistas/clima.mjs` | Clima | |
| `vistas/energia.mjs` | Energía, Factura | Consumo medido |
| `vistas/varias.mjs` | Media, Aparatos, Camioneta, y una casa secundaria | |
| `vistas/redes.mjs` | Redes | Estado de la red física: temperatura de los routers, puertos, árbol de expansión |
| `vistas/automatizaciones.mjs` | Rutinas | Clasifica por **salud**, no por si están encendidas |
| `vistas/mas.mjs` | Más | El cajón de las secundarias |
| `vistas/simples.mjs` | varias | Las que sólo se restilan |

### Una idea que quizá te sirva: la vista de automatizaciones

No lista las automatizaciones por si están en `on`. Las clasifica por si **están haciendo
algo**:

```
verde     disparó en las últimas 24 h            trabajando
celeste   es un vigía y no dispara               callada porque todo anda bien
ámbar     más de 30 días sin disparar            dormida, mirar
rojo      encendida, NUNCA disparó, y no es vigía  probablemente rota
gris      apagada
```

La diferencia importa: una automatización callada porque la casa anda bien y una callada
porque apunta a un sensor que no existe **se ven idénticas con un interruptor**.
