# Instalación, de cero

Cuarenta minutos si Home Assistant ya está andando. Se puede parar en el paso 5 y tener
algo usable; el resto suma.

---

## 0. Lo que hace falta

| | |
|---|---|
| Home Assistant | con el tablero en modo *storage* (el normal) |
| Node | 22 o superior — usa `WebSocket` nativo, sin dependencias |
| Acceso a `/config` | por Samba, SSH o el complemento de archivos |
| Una pantalla vertical | pensado para 1080 × 1920; en el celular también entra |

Comprobá Node antes de empezar:

```bash
node --version     # v22 o mas
```

---

## 1. Las tarjetas de HACS

Seis, todas por HACS → Frontend:

| Tarjeta | Para qué |
|---|---|
| `button-card` | **La imprescindible.** Casi todo el panel es esto |
| `card-mod` | Estilar las tarjetas nativas de HA |
| `auto-entities` | La tarjeta de "qué está sonando" |
| `mini-media-player` | El reproductor grande |
| `liquid-lens-navbar-card` | La barra inferior |
| `mini-graph-card` | Los gráficos chicos |

Después de instalarlas, **reiniciá Home Assistant**. Las tarjetas nuevas no aparecen con
una recarga.

---

## 2. El token para subir el tablero

Los scripts hablan con Home Assistant por su API, así que necesitan un token.

**Perfil → abajo de todo → Tokens de acceso de larga duración → Crear**

Guardalo **fuera del repositorio**. Nunca en un archivo que vaya a git:

```bash
export HA_TOKEN="el-token"        # Linux/macOS
$env:HA_TOKEN = "el-token"        # PowerShell
```

> Si alguna vez ves un token en la salida de un comando, en un log o en un mensaje,
> **rotalo**. No sirve de nada haberlo guardado bien si después se imprime.

---

## 3. El tablero vacío

**Ajustes → Tableros → Agregar tablero → Nuevo desde cero**

| | |
|---|---|
| Título | el que quieras |
| URL | `panel-vertical-2` |
| Mostrar en la barra lateral | como prefieras |

La URL tiene que ser esa, o hay que cambiarla en `panel2/navbar.mjs` (la constante `base`)
y en el comando de subida.

---

## 4. Los paquetes

Copiá `packages/` a `/config/packages/` y agregá esto al `configuration.yaml`:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

**Empezá por uno solo.** Cada paquete espera entidades que quizá no tengas, y HA no arranca
si un paquete está mal. Si es tu primera vez, dejá sólo `panel_pasillo.yaml` y sumá el
resto cuando el panel ande.

Los que usan `!secret` necesitan las claves en `/config/secrets.yaml`:

```yaml
snmp_community: la-comunidad-de-tu-router
cf_auth: Bearer tu-token-de-cloudflare
```

Comprobá antes de reiniciar: **Herramientas para desarrolladores → YAML → Comprobar
configuración**.

> **Que `check_config` diga "válida" no prueba que algo se cree.** Una plataforma YAML
> nueva pasa la validación y no crea ninguna entidad hasta que reiniciás. Y algunas no
> existen: se declaró un `binary_sensor` de SNMP, la configuración fue válida, el reinicio
> salió limpio, **no hubo una sola línea de error**, y las cinco entidades no existieron
> nunca. Home Assistant no tiene esa plataforma. Lo comprueba la entidad, no el validador.

---

## 5. El protector de pantalla

```
cp www/cuadro.js  /config/www/cuadro.js
mkdir /config/www/cuadros
```

Poné tus imágenes en `/config/www/cuadros/` y un `lista.json` al lado:

```json
["Obra 1.jpg", "Obra 2.jpg", "Obra 3.jpg"]
```

Registralo en **Ajustes → Tableros → (tres puntos) → Recursos**:

```
URL:  /local/cuadro.js
Tipo: Módulo de JavaScript
```

Detalle: el `lista.json` es necesario porque **un navegador no puede listar un directorio**.
Y el orden manda: las transiciones quedan mejor entre imágenes parecidas, así que conviene
agrupar por paleta en vez de ordenar por nombre.

---

## 6. Los íconos a color

```bash
node panel2/bajar-iconos.mjs --bajar
```

Baja 43 PNG de [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (MIT) a
`/config/www/iconos/color/` y **comprueba que Home Assistant los sirva**, no sólo que el
archivo esté escrito.

Antes hay que crear la carpeta a mano — el script no la crea porque `mkdir` sobre una ruta
de red se cuelga:

```powershell
New-Item -ItemType Directory "\\TU_HOST_HA\config\www\iconos\color"
```

> Se llama `iconos` y no `icons` porque **el complemento Samba de Home Assistant no deja
> crear una carpeta con ese nombre** en `/config/www`. Devuelve "no se pudo encontrar el
> archivo" y cualquier otro nombre funciona. Está comprobado, no es capricho.

---

## 7. Adaptar las entidades

Acá está el trabajo de verdad. En [`ENTIDADES.md`](ENTIDADES.md) está la lista completa de
las 184 que usa el panel, con dónde se usa cada una.

**No las cambies todas de entrada.** Empezá por `panel2/vistas/inicio.mjs`, generá, mirá
qué quedó vacío, y seguí. Una entidad que no existe muestra `--` o queda apagada: el panel
a medio adaptar sigue siendo usable.

---

## 8. Generar y subir

```bash
node panel2/construir.mjs
```

Escribe `panel-vertical-2.json`. Miralo antes de subirlo si querés.

Para subirlo hace falta un cliente de la API de Home Assistant. El del proyecto original no
está acá porque tiene la dirección de esa casa; con esto alcanza:

```js
// subir.mjs
import fs from 'node:fs'
const HOST = 'TU_HOST_HA:8123'
const ws = new WebSocket(`ws://${HOST}/api/websocket`)
let id = 0
ws.onmessage = async (ev) => {
  const m = JSON.parse(ev.data)
  if (m.type === 'auth_required') return ws.send(JSON.stringify({ type: 'auth', access_token: process.env.HA_TOKEN }))
  if (m.type === 'auth_ok') {
    ws.send(JSON.stringify({
      id: ++id, type: 'lovelace/config/save',
      url_path: 'panel-vertical-2',
      config: JSON.parse(fs.readFileSync('panel-vertical-2.json', 'utf8')),
    }))
  }
  if (m.type === 'result') { console.log(m.success ? 'subido' : JSON.stringify(m.error)); ws.close() }
}
```

```bash
node subir.mjs
```

---

## 9. Comprobar

**Abrí el panel y miralo.** No alcanza con que el comando haya devuelto éxito:

| Qué | Cómo se ve si está mal |
|---|---|
| Las tarjetas se dibujan | "Error de configuración" o un hueco |
| Los íconos cargan | cuadraditos rotos |
| La barra entra sin scroll | los últimos ítems cortados |
| Los datos aparecen | `--` o `No disponible` por todos lados |

> **Un `200` no es una comprobación.** El JSON puede subir perfecto y la tarjeta no
> dibujarse: pasó con `auto-entities` envolviendo una `grid`, que necesita
> `card_param: cards` y sin eso da "Error de configuración" — con el JSON válido y la subida
> exitosa. Lo dice la pantalla.

---

## Si algo sale mal

**El tablero quedó vacío.** `construir.mjs` lee el tablero actual: si la URL no coincide, no
encuentra nada que transformar. Revisá el `url_path`.

**"Custom element doesn't exist".** Falta una tarjeta de HACS, o se instaló y no se
reinició. Ctrl+F5 primero; si sigue, reiniciá.

**Todo dice `--`.** Las entidades no coinciden con las tuyas. Ver [`ENTIDADES.md`](ENTIDADES.md).

**Los íconos son cuadrados rotos.** Los PNG no se bajaron o no se sirven. Probá abrir
`http://TU_HOST_HA:8123/local/iconos/color/casa.png` en el navegador.

**Perdí un cambio que hice desde la interfaz.** Es esperable: `construir.mjs` reescribe las
vistas. El código es la fuente; lo que se edita en la interfaz se pisa.
