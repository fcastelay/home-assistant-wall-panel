# Weather Station Bridge

Un nodo que recibe **una o varias** estaciones meteorológicas, **archiva todo crudo en disco**
y lo reparte a los servicios que quieras — cada estación a los suyos.

Entiende tres protocolos de entrada, así que le habla casi cualquier estación doméstica: las
Ecowitt y compatibles, las que usan el formato de Weather Underground —que son casi todas las
demás— y cualquier cosa que sepa mandar un JSON.

Con panel web, usuarios, y auto-descubrimiento de Home Assistant.

Node sin una sola dependencia. La imagen es Node más diez archivos.

---

## Por qué existe

Casi todas las estaciones domésticas suben a las nubes que trae su marca de fábrica **y a un
único servidor personalizado**. Uno solo.

Una pasarela Ecowitt, por ejemplo, sube a ecowitt.net, Wunderground, Weathercloud y WOW — y le
queda **un** lugar libre. Si ese lugar se usa para Home Assistant, no queda ninguno para Windy,
para Windguru, ni para una base propia.

El puente se queda con ese único lugar y lo reparte.

> **Lo que NO conviene mandar por acá:** las nubes que tu gateway ya soporta de fábrica.
> Pasarlas por el puente agrega un punto de falla sin ganar nada. Las recetas de Wunderground y
> WOW están para el caso de una segunda cuenta o un ID distinto, y lo dicen en sus notas.

---

## Instalarlo

```bash
git clone <este-repo> && cd ecowitt
cp .env.ejemplo .env          # opcional: se puede levantar sin tocar nada
docker compose up -d
```

Abrí `http://tu-servidor:8088/`. La primera vez te pide crear el administrador — o ya entrás
directo si pusiste `ADMIN_USUARIO` y `ADMIN_CLAVE` en el `.env`.

**En un Synology:** Container Manager → Proyecto → Crear, apuntando a la carpeta.

**Sin Docker, para probar:**

```bash
node receptora.mjs --puerto 8088 --sin-mqtt
node probar.mjs                 # la prueba de punta a punta, 70 comprobaciones
```

`--sin-mqtt` no es un detalle: sin esa bandera, una prueba se conecta a tu broker de verdad y
crea entidades que después hay que borrar a mano. Ya pasó.

### Todo se configura por variables

Nada tiene un puerto, una IP ni una ruta escritos a mano. El [`.env.ejemplo`](.env.ejemplo)
tiene las 20 variables explicadas una por una; lo esencial:

| | |
|---|---|
| `PUERTO_HOST` | Por dónde lo abrís y a dónde apuntás los gateways. Default 8088 |
| `RUTA_DATOS` | Dónde se guarda todo. Default `./datos` |
| `ADMIN_USUARIO` / `ADMIN_CLAVE` | El administrador inicial. Vacío = te lo pide el panel |
| `MQTT_*` | Home Assistant. Vacío = el puente funciona igual, sin publicar |
| `UID_DATOS` / `GID_DATOS` | Si tu sistema no deja hacer `chown` en el volumen |
| `TZ` | La hora del registro |
| `RAIZ_MQTT` · `PREFIJO_HA` · `NOMBRE_NODO` | Cómo aparece en Home Assistant |
| `SECO=1` | Recibe y archiva, no manda a ningún lado. Para el primer arranque |

**La regla:** el `.env` decide cómo **nace** la instalación; el panel decide cómo sigue. Las
variables se aplican la primera vez, cuando todavía no hay `config.json`. Después manda lo que
esté cargado en el panel, y un reinicio no te revierte un cambio.

Con dos excepciones a propósito: las credenciales del broker se leen en vivo cuando los campos
del panel están vacíos —así se rota la clave del MQTT sin entrar al panel— y `ADMIN_RESET=1`
vuelve a aplicar el usuario y la contraseña aunque ya existan.

---

## Qué estaciones entran

El puente entiende **tres protocolos de entrada**. No hay que elegirlo en ningún lado: reconoce
cuál es por lo que llega.

| Protocolo | Cómo llega | Qué marcas |
|---|---|---|
| **Ecowitt** | POST con los datos en el cuerpo | Ecowitt, Froggit, Ambient con firmware Ecowitt |
| **Weather Underground** | GET con los datos en la URL | **Casi todas las demás**: Ambient, Acurite, Meteobridge, WeeWX, Cumulus MX, Weather Display, Davis por WeatherLink |
| **JSON genérico** | POST con `application/json` | Lo que no habla ninguno de los otros: un script propio, un ESP32 casero, otro puente |

El de Wunderground es el que más marcas soportan como "servidor personalizado", así que si tu
estación no es Ecowitt, **casi seguro habla ese**. Se configura igual: apuntás el servidor y el
puerto, y el resto lo resuelve el puente.

El JSON acepta los mismos nombres de campo que los otros dos (`tempf`, `humidity`) **y también
los ya normalizados** (`temp_ext`, `viento`). Eso último permite encadenar dos puentes: lo que
sale por el webhook genérico de uno entra por el JSON del otro sin traducir nada.

La estación se identifica con `PASSKEY` (Ecowitt), `ID` (Wunderground) o `estacion` (JSON).

### Lo que todavía no entra, y qué haría falta

| | Por qué no |
|---|---|
| **WeatherFlow Tempest** | Emite por UDP en la red local, no por HTTP. Hace falta un escucha UDP en el puerto 50222 — y en Docker, red en modo `host`, que este compose evita a propósito |
| **Davis WeatherLink Live** (directo) | Su API local se **consulta**, no empuja. Haría falta un consultador periódico en vez de un receptor. Igual entra por Wunderground si se configura el envío |
| **Netatmo** | Sólo por su nube, con OAuth. Es un consultador, no un receptor |

Los tres son sumables: el reconocimiento de protocolos vive en una tabla
([`_protocolos.mjs`](_protocolos.mjs)) y agregar uno es una entrada más. Lo que cambia en esos
casos no es el formato sino **el transporte**, y eso sí toca el servidor.

---

## Apuntar una estación

En la app **WSView Plus**, o en la interfaz web del gateway:

**Weather Services → Customized → Enable**

```
Protocol Type Same As :  Ecowitt
Server IP / Hostname  :  la IP de tu servidor
Path                  :  /data/report
Port                  :  8088
Upload Interval       :  60
```

Y ya está. **No hay que darla de alta en ningún lado:** cada envío trae un `PASSKEY` que
identifica al gateway, y la primera vez que llega uno desconocido el puente crea la estación
solo y la muestra en el panel. Ponele nombre y encendela.

La ruta da igual, el puente acepta cualquiera. `Protocol Type Same As: Wunderground` también
funciona, pero manda menos campos: con **Ecowitt** llegan los sensores extra —humedad de
tierra, calidad de aire, rayos, baterías—.

---

## Varias estaciones

Apuntá todos los gateways que quieras al mismo puerto. Cada uno aparece por separado.

- **Cada estación tiene su propia carpeta de archivo**, `datos/<id>/AAAAMMDD.txt`. No se
  mezclan.
- **Cada estación es un aparato distinto en Home Assistant**, con sus sensores.
- **Un destino pertenece a una estación, o a todas.** Un destino comodín —"todas las
  estaciones"— sirve para un archivo central o un webhook que guarda todo; sin él, agregar una
  estación obligaría a duplicar cada destino genérico.
- **Un comodín lleva un reloj por estación**, no uno compartido. Si tiene un intervalo mínimo de
  10 minutos y hay tres estaciones, cada una manda cada 10 minutos — no una de cada tres.

**Una estación nueva nace apagada**, y mientras esté apagada el puente **archiva sus datos pero
no los manda a ningún lado**. Es lo único seguro para algo que apareció solo: no se pierde el
dato, y no se publica sin permiso.

Si dos estaciones llegaran sin PASSKEY —sólo pasa con el protocolo Wunderground— hay que darles
rutas distintas en el gateway (`/data/report/patio` y `/data/report/quinta`) para poder
distinguirlas.

---

## Quién puede entrar

**No hay contraseña de fábrica.** Mientras no exista ningún usuario, el panel sólo muestra la
pantalla de crear el administrador: no hay nada que ver hasta que haya un dueño. Una contraseña
de fábrica es una puerta abierta en todas las instalaciones del mundo, y el que la instaló cree
que la cerró.

Dos roles:

| | |
|---|---|
| **admin** | Ve todo y cambia todo: estaciones, destinos, credenciales, usuarios |
| **mirar** | Ve el estado y los datos. No cambia nada ni ve la lista de usuarios |

El administrador crea los demás usuarios desde **Ajustes → Usuarios**.

**Si perdés la contraseña:** poné `ADMIN_RESET=1` en el `.env` con `ADMIN_USUARIO` y
`ADMIN_CLAVE`, reiniciá el contenedor, y sacalo después. Queda anotado en el registro, porque un
reseteo silencioso es indistinguible de alguien entrando por la ventana.

**Lo que no protege:** la recepción de datos no pide nada, y no puede — un gateway Ecowitt no
sabe iniciar sesión. **Esto va en una red local, nunca expuesto a internet.** El PASSKEY viaja
en claro y cualquiera que llegue al puerto puede inyectar una lectura.

---

## El panel

**Observación** — la última lectura de la estación elegida, con un gráfico de las últimas horas,
la tabla de destinos con latencia y resultado, y el registro de eventos en vivo.

**Estaciones** — bautizarlas, encenderlas, apagarlas, borrarlas.

**Destinos** — alta, edición y borrado. Se elige el servicio de una lista y **el formulario se
arma solo** con las credenciales que ese servicio pide, más a qué estación pertenece.

**Ajustes** — usuarios, broker MQTT y nombre del nodo.

Dos cosas que hace a propósito:

- **Un destino nuevo se guarda apagado.** Primero se lo prueba con **Probar** y recién después
  se lo enciende. Uno que arranca prendido puede estar mandando mal durante días.
- **El panel nunca devuelve una credencial.** Los campos de contraseña llegan vacíos y guardar
  con uno en blanco significa *dejá la que estaba*, no *borrala*.

### El archivo crudo es la mitad del valor

Cada envío se escribe **antes** de reenviarlo a ningún lado. Ese archivo no depende de que Home
Assistant esté vivo, ni del grabador —que purga a los 30 días— ni de que las estadísticas de
largo plazo existan.

El orden importa: si un destino cuelga o el proceso se cae a mitad del reparto, el dato ya está
en disco.

---

## Servicios que sabe hablar

| Receta | Unidades | Credenciales | Estado |
|---|---|---|---|
| `homeassistant` | reenvía el cuerpo tal cual | URL de HA + ID del webhook | verificada |
| `windy` | °C, m/s, pascales, mm | API key | sin verificar |
| `windguru` | °C, nudos, hPa | UID + contraseña (md5 con sal) | sin verificar |
| `wunderground` | °F, mph, inHg | Station ID + key | sin verificar |
| `pwsweather` | °F, mph, inHg | Station ID + API key | sin verificar |
| `wow` | °F, mph, inHg | Site ID + clave de 6 dígitos | sin verificar |
| `weathercloud` | todo ×10, en la ruta | Weathercloud ID + key | sin verificar |
| `webhook` | JSON con todos los campos | URL + bearer opcional | verificada |

**"Sin verificar" quiere decir que la receta se escribió leyendo la documentación del servicio
pero no se probó contra el servicio real.** El panel lo marca en amarillo. Es preferible a que
parezca que anda.

**Ambient Weather no tiene receta propia**, y no es un olvido: su red no publica un punto de
entrada para estaciones de terceros. Va por `webhook` el día que haya una URL real.

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
  "estacion": "patio",
  "url": "https://ejemplo.com/api?t={temp_ext}&v={viento}&clave=XXXX",
  "metodo": "GET",
  "intervalo_min": 300
}
```

---

## Home Assistant

Los sensores aparecen solos: **un aparato por estación**, más uno del nodo.

**Se anuncia sólo lo que llegó.** Un sensor de tierra que no está no genera una entidad vacía;
si mañana se conecta uno, aparece en el envío siguiente.

Además de los sensores, publica el diagnóstico:

| Entidad | Para qué |
|---|---|
| `<estación> · Sin reportar` | **la que más falta hace.** ON si esa estación dejó de mandar |
| `Algo no está funcionando` | del nodo: ON si cualquier estación o destino está mal |
| `<destino> · problema` | por destino **y por estación**: si el último envío falló |
| `<destino> · estado` | qué contestó: `ok`, `HTTP 401 · invalid password`, `sin respuesta` |
| `<destino> · latencia` | cuánto tardó, en ms |
| `<destino> · último envío OK` | cuándo fue la última vez que le entró bien |

Todo cuelga de un tema de disponibilidad con **testamento MQTT**: si el puente se muere, el
broker publica `offline` por él y las entidades quedan *no disponibles* en vez de congeladas en
su último valor.

Eso es exactamente lo que falta cuando una estación se cae y nadie se entera: los sensores no
dicen "no sé", se quedan quietos.

---

## La API

Todo lo que hace el panel pasa por acá. Las lecturas piden sesión; las escrituras, rol admin.

| | |
|---|---|
| `GET /salud` | Sonda para Docker. Sin sesión. 503 si alguna estación dejó de reportar |
| `GET /api/sesion` | Si está instalado, quién sos y qué podés |
| `POST /api/instalar` | Crea el administrador. Sólo mientras no haya ningún usuario |
| `POST /api/entrar` · `/api/salir` | Sesión |
| `GET /api/estado` | Nodo, estaciones con su última lectura, destinos y registro |
| `GET /api/recetas` | Catálogo de servicios y qué credenciales pide cada uno |
| `GET /api/config` | Configuración **sin credenciales** |
| `POST /api/config` | MQTT y ajustes del nodo |
| `POST /api/estacion` | Renombrar o encender. `DELETE ?id=` para borrar |
| `POST /api/destino` | Alta o edición. `DELETE ?nombre=` para borrar |
| `POST /api/usuarios` | Alta y cambio de rol. `DELETE ?nombre=` |
| `POST /api/probar` | Manda la última lectura real a un destino |

`POST /api/probar` **nunca inventa un dato**: si todavía no llegó ningún envío, lo dice y no
manda nada. Un dato falso publicado en Windy o en Home Assistant queda ahí.

---

## Qué hay en cada archivo

| | |
|---|---|
| `receptora.mjs` | el servidor: recibe, identifica la estación, archiva, reparte, publica |
| `_normalizar.mjs` | el envío crudo a campos con nombre y unidad. **Se parsea una vez** |
| `_recetas.mjs` | una receta por servicio: URL, unidades y credenciales |
| `_destinos.mjs` | cómo se manda a cada uno: intervalos, reintentos, timeouts |
| `_sensores.mjs` | qué entidad crea cada campo en Home Assistant |
| `_config.mjs` | `config.json`: escritura atómica, respaldos, migración, secretos |
| `_usuarios.mjs` | contraseñas (scrypt), sesiones (cookie firmada), roles |
| `_panel.mjs` | las rutas del panel, y quién puede qué |
| `_pagina.mjs` | el HTML, el estilo y el guion. Sin librerías, ni por CDN |
| `_registro.mjs` | el registro en memoria, con techo |
| `probar.mjs` | la prueba de punta a punta contra servicios falsos |
| `entrada.sh` | acomoda el dueño del volumen y baja de privilegios |
| `desplegar-nas.mjs` | arma la carpeta y la copia (o `--armar` en local) |

---

## Si no levanta

| Síntoma | Causa |
|---|---|
| Muere en menos de 1 s, en bucle | El volumen no es escribible por el usuario del contenedor. Lo resuelve `entrada.sh`; si tu sistema no deja hacer `chown`, poné `UID_DATOS` y `GID_DATOS` en el `.env` |
| La pestaña Registro aparece vacía | Algún `logging:` en el compose. Este no lo anula justamente por eso |
| "Not found" al arrancar | `entrada.sh` con fin de línea CRLF. El Dockerfile le pasa un `sed`, y el `.gitattributes` lo evita en origen |

---

## Lo que no hace

- **No tiene autenticación en la recepción.** El protocolo Ecowitt no la tiene. Red local, nunca
  internet.
- **No reintenta un envío perdido más tarde.** Se reintenta un rato y se abandona ese envío: la
  estación manda otro en un minuto, y una cola sin techo termina comiéndose la memoria del
  contenedor. Lo que no se puede perder ya está en el archivo crudo.
- **No sirve el historial completo.** El gráfico del panel son las últimas horas en memoria y se
  borra al reiniciar. El histórico serio va en Home Assistant, o se lee del archivo crudo.
