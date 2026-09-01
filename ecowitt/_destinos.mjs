// Los destinos: cómo se le manda a cada uno, cada cuánto, y qué hacer si falla.
//
// PENSADO PARA MUCHOS DESTINOS, que era el pedido. Cuatro decisiones sostienen eso:
//
// 1. **Recetas en vez de un traductor por servicio.** Agregar un servicio conocido es elegirlo
//    de una lista y cargar dos credenciales. Ver _recetas.mjs.
//
// 2. **Una plantilla libre para lo que no tiene receta.** Se describe la URL con marcadores
//    {campo} que se rellenan desde el objeto normalizado. Sirve para probar un servicio nuevo
//    sin tocar código, y para lo que nunca va a tener receta propia.
//
// 3. **Un intervalo mínimo por destino.** No todos aceptan la misma frecuencia: mandarle cada
//    minuto a uno que admite uno cada diez es la forma más rápida de que te bloqueen. Cada
//    destino declara su intervalo en segundos y acá se respeta.
//
// 4. **Reintentos acotados.** Un fallo pasajero con quince destinos pasa todos los días. Se
//    reintenta con espera creciente, un número fijo de veces, y después se abandona ESE envío
//    —nunca se encola indefinidamente—: la estación va a mandar otro en un minuto, y una cola
//    que crece sin techo termina comiéndose la memoria del contenedor.

import { RECETAS } from './_recetas.mjs'

// ---------------------------------------------------------------- plantillas

/**
 * Reemplaza {campo} por su valor. Si falta un campo, el marcador queda vacío.
 *
 * DEVUELVE TAMBIEN QUE FALTO, para poder avisarlo en vez de mandar una URL con huecos y que
 * el servicio conteste un error críptico tres semanas después.
 */
export function rellenar (plantilla, campos) {
  const faltan = []
  const texto = String(plantilla).replace(/\{([a-z0-9_.]+)\}/gi, (_, k) => {
    if (campos[k] === undefined || campos[k] === null) { faltan.push(k); return '' }
    return encodeURIComponent(campos[k])
  })
  return { texto, faltan }
}

// ---------------------------------------------------------------- armado del pedido

/**
 * Arma el pedido HTTP para un destino. No lo manda: sólo lo describe.
 *
 * Está separado del envío a propósito, para que el panel pueda MOSTRAR la URL que se va a usar
 * —con las credenciales tapadas— sin mandar nada. Ver una URL mal armada antes de activarla
 * ahorra el rato de mirar por qué un servicio contesta 401.
 *
 * Tipos:
 *   receta      un servicio conocido: Windy, Windguru, Wunderground... Ver _recetas.mjs.
 *   ecowitt     reenvía el cuerpo TAL CUAL. Es lo que entiende Home Assistant y cualquier otra
 *               receptora Ecowitt. Sin interpretar nada: no hay forma de estropear un dato al
 *               copiarlo.
 *   plantilla   arma la URL desde url con marcadores. metodo GET (por defecto) o POST; para
 *               POST, cuerpo es otra plantilla.
 */
export function armar (destino, crudo, campos) {
  const tipo = destino.tipo || 'ecowitt'

  if (tipo === 'receta') {
    const receta = RECETAS[destino.receta]
    if (!receta) return { error: 'receta desconocida: ' + destino.receta }
    let hecho
    try { hecho = receta.construir(destino.credenciales || {}, campos) }
    catch (e) { return { error: 'la receta ' + destino.receta + ' falló: ' + e.message } }

    // crudo:true = la receta pide reenviar el cuerpo original (es el caso de Home Assistant).
    if (hecho.crudo) return pedidoCrudo(hecho.url, crudo)
    return {
      url: hecho.url,
      opciones: {
        method: hecho.metodo || 'GET',
        headers: {
          ...(hecho.cabeceras || {}),
          ...(hecho.cuerpo ? { 'Content-Type': hecho.contenido || 'application/x-www-form-urlencoded' } : {}),
        },
        ...(hecho.cuerpo ? { body: hecho.cuerpo } : {}),
      },
      faltan: [],
    }
  }

  if (tipo === 'ecowitt') return pedidoCrudo(destino.url, crudo)

  if (tipo === 'plantilla') {
    const u = rellenar(destino.url, campos)
    const metodo = (destino.metodo || 'GET').toUpperCase()
    if (metodo === 'GET') return { url: u.texto, opciones: { method: 'GET' }, faltan: u.faltan }
    const b = destino.cuerpo ? rellenar(destino.cuerpo, campos) : { texto: '', faltan: [] }
    return {
      url: u.texto,
      opciones: {
        method: metodo,
        headers: { 'Content-Type': destino.contenido || 'application/x-www-form-urlencoded' },
        body: b.texto,
      },
      faltan: [...u.faltan, ...b.faltan],
    }
  }

  return { error: 'tipo "' + tipo + '" desconocido' }
}

const pedidoCrudo = (url, crudo) => ({
  url,
  opciones: {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: crudo,
  },
  faltan: [],
})

// ---------------------------------------------------------------- envío con reintentos

const dormir = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * Manda a un destino. NUNCA lanza: un destino roto no puede tirar el proceso ni frenar a los
 * demás. Devuelve { ok, detalle, saltado, codigo, latencia }.
 *
 * estado es el registro por destino que lleva el llamador: se usa para el intervalo mínimo y
 * para las cuentas que muestra el panel.
 */
export async function enviarA (destino, crudo, campos, estado) {
  const ahora = Date.now()

  // --- intervalo mínimo. Se mide desde el último INTENTO, no desde el último éxito: si el
  //     servicio está caído, reintentar cada minuto tampoco ayuda y sigue siendo tráfico.
  const minimo = Number(destino.intervalo_min || 0) * 1000
  if (minimo && estado.ultimoIntento && (ahora - estado.ultimoIntento) < minimo) {
    const faltan = Math.ceil((minimo - (ahora - estado.ultimoIntento)) / 1000)
    return { ok: true, saltado: true, detalle: 'espera ' + faltan + ' s' }
  }

  const pedido = armar(destino, crudo, campos)
  if (pedido.error) {
    estado.fallidos = (estado.fallidos || 0) + 1
    estado.ultimoDetalle = pedido.error
    return { ok: false, detalle: pedido.error }
  }
  // Se manda igual —quizá el servicio tolere el hueco— pero queda dicho cuál faltó. Callarlo
  // sería dejar que el servicio conteste un error incomprensible más adelante.
  estado.faltantes = pedido.faltan.length ? pedido.faltan : undefined

  estado.ultimoIntento = ahora
  const intentos = Math.max(1, Number(destino.reintentos ?? 2) + 1)
  const espera = Math.max(1000, Number(destino.timeout || 15) * 1000)
  let detalle = 'sin intentar'
  let codigo = null

  for (let i = 0; i < intentos; i++) {
    if (i) await dormir(2000 * i)   // espera creciente: 2 s, 4 s, 6 s
    const arranque = Date.now()
    try {
      const r = await fetch(pedido.url, { ...pedido.opciones, signal: AbortSignal.timeout(espera) })
      codigo = r.status
      const latencia = Date.now() - arranque
      // El cuerpo de la respuesta se lee y se DESCARTA salvo los primeros 200 caracteres. Hay
      // que leerlo igual —si no, la conexión queda abierta— y esos 200 son los que dicen
      // "invalid password" cuando el servicio contesta 200 con un error adentro.
      let texto = ''
      try { texto = (await r.text()).trim().slice(0, 200) } catch {}

      if (r.ok) {
        estado.ultimoOk = Date.now()
        estado.enviados = (estado.enviados || 0) + 1
        estado.latencia = latencia
        estado.codigo = codigo
        estado.ultimoDetalle = 'ok'
        return {
          ok: true, codigo, latencia,
          detalle: 'ok' + (pedido.faltan.length ? ' (faltan: ' + pedido.faltan.join(',') + ')' : ''),
          respuesta: texto,
        }
      }
      detalle = 'HTTP ' + r.status + (texto ? ' · ' + texto.replace(/\s+/g, ' ').slice(0, 80) : '')
      estado.latencia = latencia
      // Un 4xx no se reintenta: la URL o las credenciales están mal y no van a mejorar solas.
      // Reintentar sería golpear un servicio que ya dijo que no.
      if (r.status >= 400 && r.status < 500) break
    } catch (e) {
      detalle = e.name === 'TimeoutError' ? 'sin respuesta' : String(e.message).slice(0, 60)
    }
  }

  estado.fallidos = (estado.fallidos || 0) + 1
  estado.codigo = codigo
  estado.ultimoDetalle = detalle
  return { ok: false, detalle, codigo }
}
