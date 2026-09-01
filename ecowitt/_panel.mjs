// El panel web: qué rutas atiende y qué contesta cada una.
//
// EL MISMO PUERTO QUE LA RECEPCION, y no por ahorrar. La estación manda POST a la ruta que uno
// le configure; el panel vive en GET / y en /api/*. Separarlos en dos puertos obligaría a
// publicar dos, a acordarse de los dos y a que el día que uno se cierre por accidente el otro
// siga andando y dé la impresión de que todo está bien.
//
// LA REGLA QUE LOS SEPARA: un POST cuyo cuerpo tiene pinta de envío de estación es un envío de
// estación, venga por la ruta que venga. Cualquier otra cosa es el panel. Ver pareceEnvio en
// _normalizar.mjs — hace falta porque confundirlos archivaría credenciales del formulario
// dentro del registro crudo de datos meteorológicos.
//
// LA CLAVE DEL PANEL ES OPCIONAL Y ESO ES UNA DECISION, no un olvido. Esto vive en la red de
// casa y su razón de ser es poder mirarlo rápido. Si se define PANEL_CLAVE, se pide; si no, no.
// **Lo que no es opcional es que el panel nunca devuelva una credencial**: eso se cumple
// siempre, con clave y sin clave. Ver sinSecretos en _config.mjs.

import { PAGINA } from './_pagina.mjs'
import { catalogo, faltantes, RECETAS } from './_recetas.mjs'
import { sinSecretos, fundirSecretos } from './_config.mjs'

const CLAVE = process.env.PANEL_CLAVE || ''

const json = (res, obj, codigo = 200) => {
  const t = JSON.stringify(obj)
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(t) })
  res.end(t)
}

const leerCuerpo = (req) => new Promise((ok) => {
  let b = ''
  req.on('data', c => { b += c; if (b.length > 256 * 1024) req.destroy() })
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}) } catch { ok(null) } })
  req.on('error', () => ok(null))
})

const autorizado = (req, url) =>
  !CLAVE || req.headers['x-clave'] === CLAVE || url.searchParams.get('clave') === CLAVE

/**
 * Atiende una petición del panel. Devuelve true si la manejó.
 *
 * @param ctx  lo que el panel necesita de la receptora, y nada más:
 *             { estado(), config(), guardar(nueva), destino(anterior, d), borrar(nombre), probar(nombre) }
 */
export async function atender (req, res, ctx) {
  const url = new URL(req.url, 'http://x')
  const ruta = url.pathname

  // Sonda de salud para Docker. Sin clave a propósito: no dice nada de nadie, y si pidiera
  // credenciales el contenedor figuraría enfermo para siempre.
  if (ruta === '/salud') {
    const e = ctx.estado()
    const vivo = !e.puente.muda || e.puente.muda === 'OFF'
    res.writeHead(vivo ? 200 : 503, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end((vivo ? 'ok' : 'la estación no reporta') + ' · envíos ' + e.puente.recibidos + '\n')
    return true
  }

  const esApi = ruta.startsWith('/api/')
  if (!esApi && !(req.method === 'GET' && (ruta === '/' || ruta === '/index.html'))) return false

  if (!autorizado(req, url)) {
    return json(res, { error: 'clave incorrecta' }, 401), true
  }

  if (!esApi) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(PAGINA)
    return true
  }

  // ---- lectura
  if (ruta === '/api/estado') return json(res, ctx.estado()), true
  if (ruta === '/api/recetas') return json(res, catalogo()), true
  if (ruta === '/api/config' && req.method === 'GET') return json(res, sinSecretos(ctx.config())), true

  // ---- escritura
  if (ruta === '/api/config' && req.method === 'POST') {
    const cuerpo = await leerCuerpo(req)
    if (!cuerpo) return json(res, { error: 'no es JSON válido' }, 400), true
    const actual = ctx.config()
    ctx.guardar({
      ...actual,
      // fundirSecretos es lo que hace que un campo de contraseña en blanco signifique "dejá la
      // que estaba" y no "borrala". Sin esto, guardar los ajustes sin retipear la clave del
      // broker dejaría al puente sin MQTT, y el motivo sería invisible.
      mqtt: fundirSecretos({ ...actual.mqtt, ...(cuerpo.mqtt || {}) }, actual.mqtt),
      ajustes: { ...actual.ajustes, ...(cuerpo.ajustes || {}) },
    })
    return json(res, { ok: true }), true
  }

  if (ruta === '/api/destino' && req.method === 'POST') {
    const cuerpo = await leerCuerpo(req)
    if (!cuerpo || !cuerpo.destino || !cuerpo.destino.nombre) {
      return json(res, { error: 'falta el destino o su nombre' }, 400), true
    }
    const r = ctx.destino(cuerpo.anterior || null, cuerpo.destino)
    return json(res, r, r.error ? 400 : 200), true
  }

  if (ruta === '/api/destino' && req.method === 'DELETE') {
    const nombre = url.searchParams.get('nombre')
    if (!nombre) return json(res, { error: 'falta el nombre' }, 400), true
    return json(res, ctx.borrar(nombre)), true
  }

  if (ruta === '/api/probar' && req.method === 'POST') {
    const cuerpo = await leerCuerpo(req)
    if (!cuerpo || !cuerpo.nombre) return json(res, { error: 'falta el nombre' }, 400), true
    return json(res, await ctx.probar(cuerpo.nombre)), true
  }

  return json(res, { error: 'no existe ' + ruta }, 404), true
}

/**
 * Revisa un destino antes de guardarlo. Devuelve { error } o { faltan: [...] }.
 *
 * SE GUARDA AUNQUE LE FALTEN CREDENCIALES —a veces uno carga la mitad y vuelve después— pero
 * se avisa cuáles, y un destino incompleto no se puede activar. Guardar en silencio algo que
 * no puede funcionar es la forma más común de que un servicio figure configurado durante
 * meses sin haber mandado nunca nada.
 */
export function revisar (d) {
  if (!d.nombre || !String(d.nombre).trim()) return { error: 'el destino necesita un nombre' }
  const tipo = d.tipo || 'receta'
  if (tipo === 'receta') {
    if (!RECETAS[d.receta]) return { error: 'no existe la receta "' + d.receta + '"' }
    const faltan = faltantes(d.receta, d.credenciales)
    if (faltan.length && d.activo) {
      return { error: 'no se puede activar sin: ' + faltan.join(', ') }
    }
    return { faltan }
  }
  if (tipo === 'ecowitt' || tipo === 'plantilla') {
    if (!/^https?:\/\//.test(String(d.url || ''))) {
      return { error: 'la URL tiene que empezar con http:// o https://' }
    }
    return { faltan: [] }
  }
  return { error: 'tipo desconocido: ' + tipo }
}
