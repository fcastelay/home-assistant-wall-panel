// El panel web: qué rutas atiende, quién puede entrar y quién puede cambiar.
//
// EL MISMO PUERTO QUE LA RECEPCION, y no por ahorrar. Las estaciones mandan POST a la ruta que
// uno les configure; el panel vive en GET / y en /api/*. Separarlos en dos puertos obligaría a
// publicar dos, a acordarse de los dos, y a que el día que uno se cierre por accidente el otro
// siga andando y dé la impresión de que todo está bien.
//
// LA REGLA QUE LOS SEPARA: un POST cuyo cuerpo tiene pinta de envío de estación es un envío de
// estación, venga por la ruta que venga. Cualquier otra cosa es el panel. Ver pareceEnvio en
// _normalizar.mjs — hace falta porque confundirlos archivaría credenciales del formulario
// dentro del registro crudo de datos meteorológicos.
//
// ---------------------------------------------------------------------------------------
// QUIEN PUEDE QUE
//
//   sin usuarios      el panel SOLO deja crear el administrador. Nada más se ve ni se toca.
//   sin sesión        sólo la pantalla de entrar.
//   rol "mirar"       lee el estado y los datos. No cambia nada.
//   rol "admin"       todo, incluidos los usuarios.
//
// LA RECEPCION DE DATOS NO PIDE NADA, y no puede pedirlo: un gateway Ecowitt no sabe iniciar
// sesión. Por eso esto va en una red local y nunca expuesto a internet — el PASSKEY viaja en
// claro y cualquiera que llegue al puerto puede inyectar una lectura.
//
// LA SONDA DE SALUD TAMPOCO PIDE NADA. Si pidiera, el contenedor figuraría enfermo para
// siempre. No dice nada de nadie: cuántos envíos entraron y si alguna estación dejó de
// reportar.

import { PAGINA } from './_pagina.mjs'
import { catalogo, faltantes, RECETAS } from './_recetas.mjs'
import { catalogo as catalogoProtocolos } from './_protocolos.mjs'
import { sinSecretos, fundirSecretos } from './_config.mjs'
import * as us from './_usuarios.mjs'
import { servir } from './_estaticos.mjs'

// La salida de emergencia para quien quiera el panel abierto en una red de confianza. Apagada
// por defecto: un panel abierto tiene que ser una decisión, no un descuido.
const ABIERTO = process.env.PANEL_ABIERTO === '1'

const json = (res, obj, codigo = 200, cabeceras = {}) => {
  const t = JSON.stringify(obj)
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(t),
    ...cabeceras,
  })
  res.end(t)
}

const leerCuerpo = (req) => new Promise((ok) => {
  let b = ''
  req.on('data', c => { b += c; if (b.length > 256 * 1024) req.destroy() })
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}) } catch { ok(null) } })
  req.on('error', () => ok(null))
})

/**
 * Rutas de lectura y de escritura, enumeradas.
 *
 * SE ENUMERA LO QUE SE PERMITE, no lo que se prohíbe. Una lista de prohibidos se olvida del
 * endpoint que se agrega el mes que viene, y ese endpoint queda abierto sin que nadie lo note.
 */
const LECTURA = new Set(['/api/estado', '/api/estaciones', '/api/estacion',
  '/api/recetas', '/api/protocolos', '/api/config', '/api/sesion'])
const ESCRITURA = new Set(['/api/destino', '/api/config', '/api/probar', '/api/estacion', '/api/usuarios'])

/**
 * Atiende una petición del panel. Devuelve true si la manejó.
 *
 * @param ctx  lo que el panel necesita de la receptora, y nada más:
 *             { estado(), config(), guardar(), destino(), borrar(), probar(),
 *               estacion(), borrarEstacion() }
 */
export async function atender (req, res, ctx) {
  const url = new URL(req.url, 'http://x')
  const ruta = url.pathname

  // --- los recursos (tipografia, iconos, fondos), antes que cualquier control de acceso:
  //     la pantalla de entrar tambien los necesita.
  if (servir(req, res)) return true

  // --- la sonda, antes que cualquier control de acceso
  if (ruta === '/salud') {
    const e = ctx.estado()
    const sinSenal = e.nodo.situaciones.sin_senal
    const vivo = sinSenal === 0
    res.writeHead(vivo ? 200 : 503, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end((vivo ? 'ok' : sinSenal + ' sin senal') +
      ' - estaciones ' + e.nodo.estaciones + ' - envios ' + e.nodo.recibidos + String.fromCharCode(10))
    return true
  }

  const esApi = ruta.startsWith('/api/')
  const esPagina = (req.method === 'GET' || req.method === 'HEAD') &&
    (ruta === '/' || ruta === '/index.html')
  if (!esApi && !esPagina) return false

  // La página se sirve siempre: adentro decide si muestra el panel, la pantalla de entrar o la
  // de instalar. Servir una página en blanco a quien no tiene sesión sería peor.
  if (!esApi) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      // NO SE CACHEA NUNCA, y esto costó una confusión el 01/09/2026: sin esta cabecera el
      // navegador guarda la página por su cuenta, y después de actualizar el contenedor uno
      // sigue viendo la versión anterior. Parece que el despliegue no funcionó cuando en
      // realidad funcionó perfecto.
      //
      // La página es chica y cambia en cada actualización; lo que sí conviene cachear son los
      // recursos, que llevan la variante en el nombre y tienen un año de cache.
      'Cache-Control': 'no-store',
    })
    res.end(req.method === 'HEAD' ? undefined : PAGINA)
    return true
  }

  const config = ctx.config()
  const instalado = us.hayUsuarios(config)
  const quien = ABIERTO
    ? { usuario: 'abierto', rol: 'admin' }
    : us.quienEs(config, req.headers.cookie)

  // --- estado de la sesión: es lo primero que pide la página, y no pide permiso
  if (ruta === '/api/sesion') {
    return json(res, {
      instalado,
      abierto: ABIERTO,
      usuario: quien ? quien.usuario : null,
      rol: quien ? quien.rol : null,
    }), true
  }

  // --- la instalación: sólo existe mientras no haya ningún usuario
  if (ruta === '/api/instalar' && req.method === 'POST') {
    if (instalado) return json(res, { error: 'Ya hay usuarios. Entrá con el tuyo.' }, 409), true
    const c = await leerCuerpo(req)
    if (!c) return json(res, { error: 'no es JSON válido' }, 400), true
    const r = us.ponerUsuario(config, String(c.usuario || '').trim(), c.clave, 'admin')
    if (r.error) return json(res, r, 400), true
    ctx.guardar({ ...config, usuarios: r.usuarios })
    return json(res, { ok: true }, 200, { 'Set-Cookie': us.galleta(us.abrirSesion(String(c.usuario).trim())) }), true
  }

  if (ruta === '/api/entrar' && req.method === 'POST') {
    const c = await leerCuerpo(req)
    if (!c) return json(res, { error: 'no es JSON válido' }, 400), true
    const nombre = String(c.usuario || '').trim()
    const u = (config.usuarios || {})[nombre]
    // MISMO MENSAJE PARA USUARIO INEXISTENTE Y CLAVE EQUIVOCADA. Distinguirlos le regala a
    // quien prueba la mitad del trabajo: le dice qué nombres existen.
    if (!u || !us.verificar(c.clave, u)) {
      return json(res, { error: 'Usuario o contraseña incorrectos.' }, 401), true
    }
    return json(res, { ok: true, rol: u.rol }, 200, { 'Set-Cookie': us.galleta(us.abrirSesion(nombre)) }), true
  }

  if (ruta === '/api/salir' && req.method === 'POST') {
    return json(res, { ok: true }, 200, { 'Set-Cookie': us.galleta('') }), true
  }

  // --- de acá para abajo hace falta sesión
  if (!instalado) return json(res, { error: 'Todavía no hay ningún usuario.', instalado: false }, 401), true
  if (!quien) return json(res, { error: 'Hace falta iniciar sesión.' }, 401), true

  const escribe = req.method !== 'GET'
  if (escribe && quien.rol !== 'admin') {
    return json(res, { error: 'Tu usuario puede mirar, no cambiar.' }, 403), true
  }
  if (!LECTURA.has(ruta) && !ESCRITURA.has(ruta)) {
    return json(res, { error: 'no existe ' + ruta }, 404), true
  }

  // ---- lectura
  if (ruta === '/api/estado') return json(res, ctx.estado()), true
  if (ruta === '/api/recetas') return json(res, catalogo()), true
  // Los protocolos de ENTRADA, para la pantalla que explica como apuntar un gateway.
  if (ruta === '/api/protocolos') return json(res, catalogoProtocolos()), true

  // El listado paginado. Sin esto, con 200 estaciones el panel pediria 4,6 MB cada 5 segundos.
  if (ruta === '/api/estaciones') {
    return json(res, ctx.estaciones({
      pagina: url.searchParams.get('pagina'),
      por: url.searchParams.get('por'),
      buscar: url.searchParams.get('buscar') || '',
      filtro: url.searchParams.get('filtro') || 'todas',
      orden: url.searchParams.get('orden') || 'nombre',
    })), true
  }

  // El detalle de UNA: aca si van los 67 campos y el historial.
  if (ruta === '/api/estacion' && req.method === 'GET') {
    const id = url.searchParams.get('id')
    if (!id) return json(res, { error: 'falta el id' }, 400), true
    const r = ctx.verEstacion(id)
    return json(res, r, r.error ? 404 : 200), true
  }
  if (ruta === '/api/config' && req.method === 'GET') {
    const vista = sinSecretos(config)
    // La lista de usuarios sólo la ve el administrador, y sin contraseñas ni cifradas.
    if (quien.rol === 'admin') vista.usuarios = us.listar(config)
    return json(res, vista), true
  }

  // ---- escritura
  if (ruta === '/api/usuarios') {
    const c = req.method === 'DELETE' ? {} : await leerCuerpo(req)
    if (req.method === 'DELETE') {
      const nombre = url.searchParams.get('nombre')
      if (nombre === quien.usuario) {
        return json(res, { error: 'No te podés borrar a vos mismo.' }, 400), true
      }
      const r = us.sacarUsuario(config, nombre)
      if (r.error) return json(res, r, 400), true
      ctx.guardar({ ...config, usuarios: r.usuarios })
      return json(res, { ok: true }), true
    }
    if (!c) return json(res, { error: 'no es JSON válido' }, 400), true
    const r = us.ponerUsuario(config, String(c.usuario || '').trim(), c.clave, c.rol || 'mirar')
    if (r.error) return json(res, r, 400), true
    ctx.guardar({ ...config, usuarios: r.usuarios })
    return json(res, { ok: true }), true
  }

  if (ruta === '/api/config' && req.method === 'POST') {
    const cuerpo = await leerCuerpo(req)
    if (!cuerpo) return json(res, { error: 'no es JSON válido' }, 400), true
    ctx.guardar({
      ...config,
      // fundirSecretos es lo que hace que un campo de contraseña en blanco signifique "dejá la
      // que estaba" y no "borrala". Sin esto, guardar los ajustes sin retipear la clave del
      // broker dejaría al puente sin MQTT, y el motivo sería invisible.
      mqtt: fundirSecretos({ ...config.mqtt, ...(cuerpo.mqtt || {}) }, config.mqtt),
      nodo: { ...config.nodo, ...(cuerpo.nodo || {}) },
      ajustes: { ...config.ajustes, ...(cuerpo.ajustes || {}) },
    })
    return json(res, { ok: true }), true
  }

  if (ruta === '/api/estacion') {
    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id')
      if (!id) return json(res, { error: 'falta el id' }, 400), true
      const r = ctx.borrarEstacion(id)
      return json(res, r, r.error ? 400 : 200), true
    }
    const c = await leerCuerpo(req)
    if (!c || !c.id) return json(res, { error: 'falta el id de la estación' }, 400), true
    const r = ctx.estacion(c.id, {
      ...(c.nombre !== undefined ? { nombre: String(c.nombre).trim() } : {}),
      ...(c.activa !== undefined ? { activa: !!c.activa } : {}),
    })
    return json(res, r, r.error ? 400 : 200), true
  }

  if (ruta === '/api/destino') {
    if (req.method === 'DELETE') {
      const nombre = url.searchParams.get('nombre')
      if (!nombre) return json(res, { error: 'falta el nombre' }, 400), true
      const r = ctx.borrar(nombre)
      return json(res, r, r.error ? 400 : 200), true
    }
    const cuerpo = await leerCuerpo(req)
    if (!cuerpo || !cuerpo.destino || !cuerpo.destino.nombre) {
      return json(res, { error: 'falta el destino o su nombre' }, 400), true
    }
    const r = ctx.destino(cuerpo.anterior || null, cuerpo.destino)
    return json(res, r, r.error ? 400 : 200), true
  }

  if (ruta === '/api/probar' && req.method === 'POST') {
    const cuerpo = await leerCuerpo(req)
    if (!cuerpo || !cuerpo.nombre) return json(res, { error: 'falta el nombre' }, 400), true
    return json(res, await ctx.probar(cuerpo.nombre, cuerpo.estacion)), true
  }

  return json(res, { error: 'no existe ' + ruta }, 404), true
}

/**
 * Revisa un destino antes de guardarlo. Devuelve { error } o { faltan: [...] }.
 *
 * SE GUARDA AUNQUE LE FALTEN CREDENCIALES —a veces uno carga la mitad y vuelve después— pero se
 * avisa cuáles, y un destino incompleto no se puede activar. Guardar en silencio algo que no
 * puede funcionar es la forma más común de que un servicio figure configurado durante meses sin
 * haber mandado nunca nada.
 */
export function revisar (d) {
  if (!d.nombre || !String(d.nombre).trim()) return { error: 'el destino necesita un nombre' }
  const tipo = d.tipo || 'receta'
  if (tipo === 'receta') {
    if (!RECETAS[d.receta]) return { error: 'no existe la receta "' + d.receta + '"' }
    const faltan = faltantes(d.receta, d.credenciales)
    if (faltan.length && d.activo) return { error: 'no se puede activar sin: ' + faltan.join(', ') }
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
