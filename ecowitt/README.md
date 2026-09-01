# Puente Ecowitt

Recibe los datos de una estación Ecowitt, **los archiva crudos** y los reparte a todos los
servicios que haga falta, con panel web y auto-descubrimiento de Home Assistant.

Node sin una sola dependencia. La imagen es Node más siete archivos.

---

## Por qué existe

El gateway Ecowitt sube a cuatro nubes que ya trae de fábrica —ecowitt.net, Wunderground,
Weathercloud y WOW— **y a un único servidor personalizado**. Uno solo.

Si ese slot va a Home Assistant, no queda ninguno para nada más: ni Windy, ni Windguru, ni una
base propia, ni el servicio que aparezca el año que viene. El puente se queda con ese slot y lo
reparte a todos los destinos que uno quiera.

> **Lo que NO conviene mandar por acá:** las cuatro nubes que el gateway ya soporta nativo.
> Pasarlas por el puente agrega un punto de falla sin ganar nada. Que las siga subiendo el
> gateway. Las recetas de Wunderground y WOW están para el caso de una segunda cuenta o un ID
> distinto, y lo dicen en sus notas.

---

## Qué hace

| | |
|---|---|
| **Recibe** | POST en formato Ecowitt (y también Wunderground), en cualquier ruta |
| **Archiva** | cada envío tal como llegó, en `datos/AAAAMMDD.txt`, **antes** de repartirlo |
| **Normaliza** | métrico e imperial, una sola vez, para que ninguna receta haga cuentas propias |
| **Reparte** | a todos los destinos en paralelo, con intervalo mínimo y reintentos por destino |
| **Publica** | los sensores a Home Assistant por MQTT con auto-descubrimiento y LWT |
| **Vigila** | una entidad por destino: si falla, qué contestó y cuánto tardó |
| **Se administra** | desde un panel web, o desde la línea de comandos contra su API |

### El archivo crudo es la mitad del valor

Cada envío se escribe **antes** de reenviarlo a ningún lado. Ese archivo no depende de que Home
Assistant esté vivo, ni del grabador —que purga a los 30 días— ni de que las estadísticas de
largo plazo existan.

El orden importa: si un destino cuelga o el proceso se cae a mitad del reparto, el dato ya está
en disco.

---

## Levantarlo

### En un Synology (Container Manager)

```
node scripts/ecowitt/desplegar-nas.mjs --ver     dice qué haría, sin escribir
node scripts/ecowitt/desplegar-nas.mjs           copia todo a //NAS/docker/ecowitt/
```

Después, en el NAS: **Container Manager → Proyecto → Crear**, ruta `docker/ecowitt`, fuente
`docker-compose.yml`.

### En cualquier otro lado

El contexto de construcción no es el repositorio: los archivos del puente están en
`scripts/ecowitt/` pero `_mqtt.mjs` viene de `scripts/garnet/`, porque es el mismo cliente que
usa la alarma y no tiene sentido mantener dos copias. Se arma con:

```
node scripts/ecowitt/desplegar-nas.mjs --armar ./build
cd build && docker compose up -d
```

### Sin Docker, para probar

```
node scripts/ecowitt/receptora.mjs --puerto 8088 --sin-mqtt
node scripts/ecowitt/probar.mjs                    la prueba de punta a punta
```

`--sin-mqtt` no es un detalle: sin esa bandera, una prueba se conecta al broker de verdad y
crea entidades falsas en Home Assistant que después hay que borrar a mano. Ya pasó.

---

## Apuntar la estación

En la app **WSView Plus**, o en la interfaz web del gateway:

**Weather Services → Customized → Enable**

```
Protocol Type Same As :  Ecowitt
Server IP / Hostname  :  la IP del NAS      (ej. TU_IP_LAN)
Path                  :  /data/report
Port                  :  8088
Upload Interval       :  60
```

La ruta da igual: el puente acepta cualquiera. `/data/report` es la que usa el gateway por
defecto y la que conviene dejar para que se parezca a lo que documenta Ecowitt.

`Protocol Type Same As: Wunderground` también funciona, pero manda menos campos. Con **Ecowitt**
llegan los sensores extra: humedad de tierra, calidad de aire, rayos, baterías.

---

## El panel

`http://IP-del-NAS:8088/`

**Monitor** — la última lectura, un gráfico de las últimas horas, la tabla de destinos con
último intento, resultado y latencia, y el registro de eventos en vivo.

**Destinos** — alta, edición, encendido y borrado. Se elige el servicio de una lista y se cargan
sus credenciales; el formulario se arma solo a partir de la receta.

**Ajustes** — broker MQTT y nombre de la estación.

Dos cosas que hace a propósito:

- **Un destino nuevo se guarda apagado.** Primero se lo prueba con **Probar** y recién después
  se lo enciende. Uno que arranca prendido puede estar mandando mal durante días.
- **El panel nunca devuelve una credencial.** Los campos de contraseña llegan vacíos y guardar
  con uno en blanco significa *dejá la que estaba*, no *borrala*.

### Clave del panel

Opcional, con `PANEL_CLAVE` en el `docker-compose.yml`. Sin ella el panel queda abierto a quien
esté en la red de casa, que es aceptable en una LAN. **Esto no va nunca expuesto a internet:**
el protocolo Ecowitt no tiene autenticación y el PASSKEY viaja en claro.

---

## Servicios que sabe hablar

| Receta | Unidades | Credenciales | Estado |
|---|---|---|---|
| `homeassistant` | reenvía el cuerpo tal cual | URL de HA + ID del webhook | verificado |
| `windy` | °C, m/s, pascales, mm | API key | sin verificar |
| `windguru` | °C, nudos, hPa | UID + contraseña (md5 con sal) | sin verificar |
| `wunderground` | °F, mph, inHg | Station ID + key | sin verificar |
| `pwsweather` | °F, mph, inHg | Station ID + API key | sin verificar |
| `wow` | °F, mph, inHg | Site ID + clave de 6 dígitos | sin verificar |
| `weathercloud` | todo ×10, en la ruta | Weathercloud ID + key | sin verificar |
| `webhook` | JSON con todos los campos | URL + bearer opcional | verificado |

**"Sin verificar" quiere decir que la receta se escribió leyendo la documentación del servicio
pero no se probó contra el servicio real.** El panel lo marca en amarillo. Es preferible a que
parezca que anda: en esta instalación ya pasó ocho veces que algo figurara prolijo en una lista
y nunca se hubiera disparado.

**Ambient Weather no tiene receta propia**, y no es un olvido: su red no publica un punto de
entrada para estaciones de terceros. Va por `webhook` el día que uno tenga una URL real.

### Agregar un servicio nuevo

Copiar la receta más parecida en [`_recetas.mjs`](_recetas.mjs), cambiar los nombres de los
campos y dejar el enlace a la documentación. No hay que tocar nada más: ni el puente, ni el
panel, ni el despliegue.

Para algo de una sola vez, el tipo `plantilla` arma una URL con marcadores `{campo}` sin
escribir código:

```json
{
  "nombre": "Servicio raro",
  "tipo": "plantilla",
  "url": "https://ejemplo.com/api?t={temp_ext}&v={viento}&clave=XXXX",
  "metodo": "GET",
  "intervalo_min": 300
}
```

---

## Home Assistant

El puente publica por MQTT con auto-descubrimiento: los sensores aparecen solos, agrupados en un
aparato llamado *Estación meteorológica*.

**Se anuncia sólo lo que llegó.** Un sensor de tierra que no está no genera una entidad vacía; si
mañana se conecta uno, su entidad aparece en el envío siguiente.

Además de los sensores meteorológicos, publica el diagnóstico:

| Entidad | Para qué |
|---|---|
| `Estación sin reportar` | **la que más falta hace.** ON si dejaron de llegar envíos |
| `Algún destino caído` | ON si cualquier destino activo está fallando |
| `<destino> · problema` | por destino: si el último envío falló |
| `<destino> · estado` | qué contestó: `ok`, `HTTP 401 · invalid password`, `sin respuesta` |
| `<destino> · latencia` | cuánto tardó, en ms |
| `<destino> · último envío OK` | cuándo fue la última vez que le entró bien |

Todo cuelga de un tema de disponibilidad con **testamento MQTT**: si el puente se muere, el
broker publica `offline` por él y las entidades quedan *no disponibles* en vez de congeladas en
su último valor.

Eso es exactamente lo que faltó cuando se cayó la WS2900 el 15/08: los sensores no dijeron "no
sé", se quedaron quietos, y nadie se enteró durante días.

### Configurar el broker

Tres maneras, gana la primera que esté completa:

1. **Desde el panel** (Ajustes → MQTT). Queda en `config.json`.
2. **Variables de entorno**: `MQTT_HOST`, `MQTT_PUERTO`, `MQTT_USUARIO`, `MQTT_CLAVE`. Es lo que
   genera el despliegue en `mqtt.env`, leyendo la clave de la configuración de HA sin
   imprimirla en ningún lado.
3. **La configuración de Home Assistant**, si se monta su `/config`.

Los cambios de MQTT se aplican al reiniciar el contenedor.

---

## Desde la línea de comandos

```
node scripts/ecowitt/destinos.mjs                          qué hay y cómo le va a cada uno
node scripts/ecowitt/destinos.mjs --recetas                servicios disponibles y su formato
node scripts/ecowitt/destinos.mjs --agregar windy.json     alta o edición
node scripts/ecowitt/destinos.mjs --probar "Windy"         le manda la última lectura real
node scripts/ecowitt/destinos.mjs --activar "Windy"
node scripts/ecowitt/destinos.mjs --borrar "Windy"
```

**Habla con la API del panel, no con el archivo.** Editar `config.json` por Samba también
funcionaría —el puente lo relee cada 60 segundos— pero serían dos programas escribiendo el mismo
JSON, y tarde o temprano uno pisa el cambio del otro. Por la API hay un solo escritor, se
validan las credenciales, y al borrar un destino se retiran también sus entidades de Home
Assistant.

El destino nuevo se pasa **en un archivo**, nunca por la línea de comandos: estas credenciales
llevan `&`, `?` y `$`, y el shell ya se comió parte de un texto tres veces en este proyecto.

---

## La API

| | |
|---|---|
| `GET /` | el panel |
| `GET /salud` | sonda para Docker. 503 si la estación dejó de reportar |
| `GET /api/estado` | última lectura, destinos, historial y registro |
| `GET /api/recetas` | catálogo de servicios y qué credenciales pide cada uno |
| `GET /api/config` | configuración **sin credenciales** |
| `POST /api/config` | ajustes y MQTT |
| `POST /api/destino` | alta o edición: `{ anterior, destino }` |
| `DELETE /api/destino?nombre=` | borra y retira sus entidades de HA |
| `POST /api/probar` | `{ nombre }` — manda la última lectura real a ese destino |

`POST /api/probar` **nunca inventa un dato**: si todavía no llegó ningún envío de la estación,
lo dice y no manda nada. Un dato falso publicado en Windy o en Home Assistant queda ahí.

---

## Qué hay en cada archivo

| | |
|---|---|
| `receptora.mjs` | el servidor: recibe, archiva, reparte, publica |
| `_normalizar.mjs` | el envío crudo a campos con nombre y unidad. **Se parsea una vez** |
| `_recetas.mjs` | una receta por servicio: URL, unidades y credenciales |
| `_destinos.mjs` | cómo se manda a cada uno: intervalos, reintentos, timeouts |
| `_sensores.mjs` | qué entidad crea cada campo en Home Assistant |
| `_config.mjs` | `config.json`: lectura, escritura atómica, respaldos, secretos |
| `_panel.mjs` | las rutas del panel y su API |
| `_pagina.mjs` | el HTML, el estilo y el guion. Sin librerías, ni por CDN |
| `_registro.mjs` | el registro en memoria, con techo |
| `probar.mjs` | la prueba de punta a punta contra servicios falsos |
| `destinos.mjs` | administración desde la terminal |
| `desplegar-nas.mjs` | arma la carpeta y la copia al NAS |

---

## Lo que no hace

- **No tiene autenticación en la recepción.** El protocolo Ecowitt no la tiene: el PASSKEY viaja
  en claro. Esto va sólo en la red de casa.
- **No reintenta un envío perdido más tarde.** Se reintenta un rato y se abandona ese envío: la
  estación va a mandar otro en un minuto, y una cola sin techo termina comiéndose la memoria del
  contenedor. Lo que no se puede perder ya está en el archivo crudo.
- **No sirve el historial completo.** El gráfico del panel son las últimas horas en memoria y se
  borra al reiniciar. El histórico serio va en Home Assistant, o se lee del archivo crudo.
