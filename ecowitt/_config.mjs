// La configuración: dónde vive, cómo se lee, cómo se escribe sin romperla.
//
// UN SOLO ARCHIVO, `config.json`, Y EN EL VOLUMEN DE DATOS. No al lado del código.
//
// La razón es del contenedor: el código se monta de sólo lectura —el proceso no tiene por qué
// poder reescribir su propio programa— pero la configuración la edita el panel web. Si vivieran
// en la misma carpeta habría que dar permiso de escritura al código entero para poder cambiar
// una credencial.
//
// SE ESCRIBE ATOMICO: a un temporal y después `rename`. Un corte de luz a mitad de una
// escritura directa deja un JSON truncado, y un JSON truncado es un puente **sin ningún
// destino** que sólo se descubre leyendo el log. El `rename` es atómico en el sistema de
// archivos: o está el archivo viejo o está el nuevo, nunca medio archivo.
//
// Y SE RESPALDA ANTES DE CADA CAMBIO, con fecha en el nombre. Un respaldo que se pisa a sí
// mismo deja de servir justo cuando hace falta.

import fs from 'node:fs'
import path from 'node:path'

/** Estructura vacía. Es también la documentación del formato. */
export const VACIA = {
  destinos: [],
  mqtt: {
    // Vacío = usar las variables de entorno (MQTT_HOST, MQTT_USUARIO, MQTT_CLAVE...).
    // Lo que se cargue acá desde el panel tiene prioridad sobre el entorno.
    host: '', puerto: 1883, usuario: '', clave: '', prefijo: 'homeassistant',
  },
  ajustes: {
    // Nombre del aparato en Home Assistant y raíz de los temas MQTT.
    estacion: 'Estación meteorológica',
    base: 'estacion',
    // Cuántos envíos se guardan en memoria para el visor del panel.
    historial: 200,
  },
}

let RUTA = null
let CACHE = null
let HEREDADOS = []

/**
 * @param carpetaDatos  el volumen persistente; ahi vive `config.json`
 * @param heredar       rutas de `destinos.json` de la version anterior, para migrar
 */
export function iniciar (carpetaDatos, heredar = []) {
  RUTA = path.join(carpetaDatos, 'config.json')
  HEREDADOS = heredar
  fs.mkdirSync(carpetaDatos, { recursive: true })
  return RUTA
}

/**
 * Lee la configuración de disco. Si no existe, la crea; si existía el viejo `destinos.json`,
 * se lo trae.
 *
 * LA MIGRACION NO ES CORTESIA: sin ella, la primera vez que arranque esta versión el puente
 * se quedaría sin los destinos que ya estaban andando, y lo haría en silencio.
 */
export function cargar () {
  if (CACHE) return CACHE
  if (fs.existsSync(RUTA)) {
    try {
      CACHE = completar(JSON.parse(fs.readFileSync(RUTA, 'utf8')))
      return CACHE
    } catch (e) {
      // NO se pisa un archivo ilegible: podría ser el único lugar donde están las
      // credenciales, y sobrescribirlo con la plantilla vacía las borraría para siempre.
      // Se lo aparta con otro nombre y se sigue con la vacía, dejándolo dicho.
      const roto = RUTA + '.roto-' + Date.now()
      try { fs.renameSync(RUTA, roto) } catch {}
      console.error('config.json ilegible (' + e.message + '). Apartado en ' + path.basename(roto))
    }
  }
  CACHE = completar(migrarViejo())
  try {
    escribir(CACHE)
  } catch (e) {
    // NO SE DEJA SALIR EL ERROR CRUDO. El 01/09/2026 esto fue un EACCES sin atrapar: el
    // contenedor moría en 0,6 segundos, en bucle, y como además el registro estaba anulado en
    // el compose, la pestaña Registro del Container Manager aparecía vacía. Dos horas de
    // adivinar algo que el propio programa sabía.
    //
    // Se sigue muriendo —un puente que no puede escribir tampoco puede archivar, y archivar es
    // la mitad de su valor— pero ahora dice qué pasa y qué hacer.
    console.error('')
    console.error('=== NO SE PUEDE ESCRIBIR EN EL VOLUMEN DE DATOS')
    console.error('    ' + RUTA)
    console.error('    ' + e.code + ': ' + e.message)
    console.error('')
    console.error('    Este proceso corre como uid ' + (process.getuid ? process.getuid() : '?') +
      ' y la carpeta no le pertenece.')
    console.error('    En Docker lo resuelve entrada.sh, que acomoda el dueño antes de arrancar.')
    console.error('    Si estás viendo esto DENTRO del contenedor, el volumen es de sólo lectura.')
    console.error('')
    process.exit(1)
  }
  return CACHE
}

/** Trae los destinos del `destinos.json` de la versión anterior, si está. */
function migrarViejo () {
  for (const p of [...HEREDADOS, path.join(path.dirname(RUTA), 'destinos.json')]) {
    try {
      if (!fs.existsSync(p)) continue
      const l = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (Array.isArray(l) && l.length) {
        console.log('config.json creado desde ' + p + ' (' + l.length + ' destinos)')
        return { ...VACIA, destinos: l }
      }
    } catch {}
  }
  return { ...VACIA }
}

/** Rellena lo que falte, para que una configuración vieja no rompa una versión nueva. */
function completar (c) {
  return {
    ...VACIA, ...c,
    mqtt: { ...VACIA.mqtt, ...(c.mqtt || {}) },
    ajustes: { ...VACIA.ajustes, ...(c.ajustes || {}) },
    destinos: Array.isArray(c.destinos) ? c.destinos : [],
  }
}

function escribir (c) {
  const tmp = RUTA + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(c, null, 2) + '\n')
  fs.renameSync(tmp, RUTA)
}

/** Guarda, con respaldo fechado del anterior. Devuelve la configuración ya normalizada. */
export function guardar (nueva) {
  const c = completar(nueva)
  if (fs.existsSync(RUTA)) {
    const dir = path.join(path.dirname(RUTA), 'respaldos')
    fs.mkdirSync(dir, { recursive: true })
    const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    fs.copyFileSync(RUTA, path.join(dir, 'config_' + sello + '.json'))
    // Se conservan los 30 últimos: suficiente para volver atrás, poco para llenar el disco.
    const viejos = fs.readdirSync(dir).filter(f => f.startsWith('config_')).sort()
    for (const f of viejos.slice(0, -30)) { try { fs.unlinkSync(path.join(dir, f)) } catch {} }
  }
  escribir(c)
  CACHE = c
  return c
}

/** Vuelve a leer de disco en la próxima llamada. Para cuando alguien edita el JSON a mano. */
export function olvidar () { CACHE = null }

// ---------------------------------------------------------------- secretos
//
// EL PANEL NUNCA DEVUELVE UNA CREDENCIAL. Manda `null` en su lugar y muestra un campo vacío
// con la marca de que ya hay una cargada. Al guardar, un campo vacío significa "dejá la que
// estaba", no "borrala".
//
// Sin esto, cualquiera que abra el panel —o cualquier captura de pantalla, o el registro de un
// navegador— se lleva la clave de Wunderground y el webhook de Home Assistant.

export const SECRETO = /^(clave|password|pass|api_key|apikey|token|key|salt|webhook|secreto)$/i

/** Una copia sin credenciales, para mandar al navegador. */
export function sinSecretos (c) {
  const limpiar = (o) => {
    const s = {}
    for (const [k, v] of Object.entries(o || {})) s[k] = SECRETO.test(k) ? (v ? '••••••' : '') : v
    return s
  }
  return {
    ...c,
    mqtt: limpiar(c.mqtt),
    destinos: c.destinos.map(d => ({
      ...d,
      url: ocultarEnUrl(d.url),
      credenciales: limpiar(d.credenciales),
    })),
  }
}

/** Tapa lo que parezca credencial dentro de una URL suelta. */
export function ocultarEnUrl (url) {
  if (!url) return url
  return String(url)
    .replace(/([?&](?:key|password|pass|token|apikey|api_key|id|pw|salt)=)[^&]*/gi, '$1••••••')
    .replace(/(\/api\/webhook\/)[^/?#]+/g, '$1••••••')
    .replace(/(\/pws\/update\/)[^/?#]+/g, '$1••••••')
    // Weathercloud pone la credencial en la RUTA, no en los parámetros: /key/LACLAVE/temp/165
    .replace(/(\/key\/)[^/?#]+/g, '$1••••••')
}

/**
 * Mezcla lo que llegó del panel con lo que ya había: un secreto que viene vacío o con los
 * puntitos conserva su valor anterior.
 */
export function fundirSecretos (nuevo, anterior) {
  const r = { ...nuevo }
  for (const [k, v] of Object.entries(nuevo || {})) {
    if (!SECRETO.test(k)) continue
    if (v === '' || v === null || v === undefined || /^[•*]+$/.test(String(v))) {
      if (anterior && anterior[k] !== undefined) r[k] = anterior[k]
      else delete r[k]
    }
  }
  return r
}
