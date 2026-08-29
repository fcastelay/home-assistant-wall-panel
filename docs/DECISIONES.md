# Decisiones, y lo que costó aprenderlas

Lo que hay en el código se entiende leyéndolo. Esto es lo otro: **por qué está así y qué se
probó antes**. Varias son ideas que se aplicaron, se vieron en la pantalla, y se
deshicieron.

Si vas a copiar el panel, esto te ahorra repetir los errores. Si el panel es tuyo, esto es
lo que evita que dentro de tres meses "mejores" algo que ya se probó.

---

## Sobre lo que se muestra

### Los apagados se muestran, no se esconden

Se pensó ocultar los equipos que no responden, para que la lista quedara limpia. **Es un
error**: saber que la caja del living no responde *es* información, y esconderla hace pensar
que no existe. Se dibujan al 55 % de opacidad, con el punto en rojo.

### Un color tiene que significar algo

La barra tuvo catorce ítems, cada uno con su color. Era un arcoíris: catorce colores
compitiendo no jerarquizan nada.

Se unificaron todos en gris. **También estaba mal**: la barra quedó muerta y costaba
encontrar las cosas.

Lo que funciona es nueve, elegidos para no repetirse entre vecinos. **Lo que sobraba era la
cantidad, no la idea.** Y los dos dinámicos —ámbar cuando hay luces prendidas, rojo cuando
la alarma se disparó— se ven justamente porque el resto está quieto.

### La alarma armada es verde, no roja

Armada es el estado que uno **quiere**: la casa cuidada. Pintarlo de rojo deja la barra en
alerta permanente cada noche, y cuando todo grita, nada grita. El rojo queda para
`triggered`, que además late.

### Mirar un número, no esperar un evento

La lección más cara del proyecto, y aparece tres veces:

**El árbol de expansión.** El puente raíz de la red se había mudado solo a un NAS. Nada
falla a la vista: la red sigue andando. El síntoma aparece cuando ese equipo reinicia y se
lleva la red por delante unos segundos. **No hay evento que avise.** Hoy hay un número en la
pantalla.

**Las copias de seguridad.** Los avisos de "salió bien" y "falló" dependen de que el sistema
esté lo bastante vivo como para darse cuenta. Si el sistema de copias muere del todo, no se
dispara nada y **el silencio se confunde con normalidad**. Lo que salva es un sensor que
cuenta las horas desde la última copia correcta.

**Las integraciones colgadas.** Cinco Apple TV informaban datos de dos horas antes, con la
integración en estado `loaded`. Se descubrió mirando `last_updated`, no un error.

### Las automatizaciones se clasifican por salud, no por interruptor

La vista de rutinas no lista por `on`/`off`. Clasifica por si **están haciendo algo**:

```
verde     disparó en las últimas 24 h              trabajando
celeste   es un vigía y no dispara                 callada porque todo anda bien
ámbar     más de 30 días sin disparar              dormida, mirar
rojo      encendida, NUNCA disparó, y no es vigía  probablemente rota
gris      apagada
```

**Una automatización callada porque la casa anda bien y una callada porque apunta a un
sensor que no existe se ven idénticas con un interruptor.** En esta instalación había ocho
del primer tipo y una del segundo.

---

## Sobre cómo se ve

### Nada de "casi entra"

Tres rondas de "quedaron huecos" enseñaron que en una grilla de dos columnas con tarjetas de
distinta altura, emparejar por gusto no funciona. O van a lo ancho, o son de la misma
altura. La tarjeta de "qué está sonando" se probó en Inicio y se sacó el mismo día: ocupaba
las dos columnas y llenaba una.

### Las carátulas van en su proporción

Los pósters de Plex son verticales (2:3). Meterlos en una caja apaisada con `object-fit:
cover` recorta la franja del medio: se ve una boca, un puño, una oreja. **No es mala
carátula, es mal recorte.**

### El texto no va encima de la imagen

Se probó `upcoming-media-card` en modo `fanart`, que pone el título sobre el fotograma.
Sobre una imagen clara no se lee nada. Se reemplazó por texto sobre fondo sólido a la
izquierda y la imagen limpia a la derecha.

### Un ícono feo es mejor que un hueco

Los íconos a color se pintan por CSS sobre el `ha-icon`, y **el ícono MDI se deja
declarado**. Si un PNG falta, el CSS no pinta nada y queda el glifo monocromo.

### Los nombres del fabricante no son los de la casa

```
"LG webOS TV OLED65B5PSA"            ->  TV Living
"Samsung 6 Series (50) (UN50MU6100)" ->  TV Invitados
"com.apple.tvairplayd"               ->  no se muestra: es el id de una app
```

Se resuelve con una tabla al lado de donde se dibuja, **no renombrando las entidades**:
renombrar rompe las automatizaciones y los tableros viejos que las buscan por nombre.

---

## Trampas técnicas

### `js()` y los acentos graves

Ningún comentario dentro de una plantilla de `button-card` puede llevar acento grave: cierra
el template a la mitad. **Y el error de sintaxis apunta a una línea que no tiene nada que
ver**, así que se pierde el rato buscando donde no es. Pasó tres veces.

### `auto-entities` sobre una `grid`

```yaml
card_param: cards
```

`auto-entities` mete lo que encuentra en `entities` de la tarjeta que envuelve. Una `grid`
no tiene `entities`: recibe tarjetas en `cards`. Sin esa línea, "Error de configuración" —
con el JSON válido y la subida exitosa.

### `reload_all` no crea plataformas YAML nuevas

Agregar un `platform:` nuevo a `sensor:` y recargar no crea nada. Hay que reiniciar. El
síntoma es cruel: `check_config` dice válida, la recarga devuelve 200, cero errores en el
log, y ninguna entidad.

### `timestamp_utc` no sirve para `device_class: timestamp`

Devuelve la fecha **sin huso horario** y la entidad queda en `unknown` sin quejarse. Va
`as_datetime | as_local`.

### `box-sizing` dentro del shadow DOM

```js
extra_styles: '* { box-sizing: border-box; }'
```

Sin eso, un hijo con `width:100%` más padding se desborda de la tarjeta. Las reglas globales
del tema no entran al shadow DOM de `button-card`.

### `minmax(0, 1fr)` en las grillas

Sin el `minmax`, un texto largo ensancha la columna y el contenido se recorta.

### El protector y los eventos que faltaban

Dejaba de aparecer al minimizar y restaurar el navegador: el temporizador se reiniciaba con
teclado y mouse, pero **no con `resize` ni `visibilitychange`**. Al volver de minimizado el
contador quedaba colgado.

```js
window.addEventListener('resize', this._revisar, { passive: true })
document.addEventListener('visibilitychange', this._revisar, { passive: true })
```

---

## Sobre trabajar así

### Que algo figure en una lista no prueba que funcione

Se repitió tanto que merece nombre propio:

- Una automatización en `on`, con descripción prolija, que **nunca se disparó** porque su
  sensor no existe. Ocho casos.
- Una tarea de respaldo programada y habilitada que **no corría desde hacía cinco años**.
- Un sensor que `check_config` acepta y que **no se crea nunca**.
- Una tarjeta en la vista, con la entidad correcta, que **no se dibuja**.

Lo delata `last_triggered`, `last_updated`, la entidad, o la pantalla. Nunca la lista.

### Después de un build fallido, no le creas a la verificación

Pasó dos veces: el build falla, la comprobación siguiente lee el archivo generado, y ese
archivo es del build **anterior**. Parece que el cambio no se aplicó cuando en realidad no
se generó nada. Mirar primero si el build terminó bien.

### Una revisión que uno hace sobre lo que uno mismo escribió no vale

Para publicar esto había que sacar los datos de la casa de 4.500 líneas. El sanitizador hace
dos cosas y la segunda es la que importa: **relee todo lo que acaba de escribir buscando lo
privado, y falla si encuentra algo.**

Y sirvió. Encontró dos rastros que las expresiones de censura no cubrían: el nombre de la
casa metido dentro de un `entity_id` y un nombre propio en minúscula pegado a guiones bajos.
Buscaba el dominio y el nombre con mayúscula; **las formas que se cuelan adentro de un
`entity_id` son otras**.
