// Sirve los archivos de `recursos/`: la tipografía, los iconos y las fotos de fondo.
//
// POR QUE NO VAN INCRUSTADOS EN EL HTML
//
// Se podrían meter como `data:` dentro de la página y ahorrarse este archivo. Pero entonces
// **cada carga del panel se baja los 2 MB de fondos otra vez**, y este panel se refresca solo
// cada 5 segundos en una tablet colgada en la pared. Servidos aparte, el navegador los guarda
// una vez y no los vuelve a pedir.
//
// SE SIRVEN SIN SESION, a propósito: la pantalla de entrar también necesita la tipografía y el
// fondo. No hay nada privado acá — son una fuente de Google, iconos de código abierto y fotos
// de Unsplash.
//
// EL RIESGO ES EL RECORRIDO DE RUTAS, y es el único. Un servidor que arma una ruta pegando lo
// que pidió el navegador es un servidor que entrega `../../datos/config.json` con todas las
// credenciales adentro. Acá se resuelve la ruta y **se comprueba que siga estando dentro de la
// carpeta**; no se confía en filtrar `..` a mano, porque hay diez maneras de escribirlo.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const CARPETA = path.resolve(AQUI, 'recursos')

const TIPOS = {
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

/**
 * Atiende `/recursos/...`. Devuelve true si la manejó.
 *
 * LA CACHE ES DE UN AÑO E `immutable`, y se puede porque los nombres llevan la variante adentro
 * (`sourceserif-600-normal-latin.woff2`, `fondo-1015-ancho.webp`). Si mañana cambia la fuente,
 * cambia el nombre; nunca se reemplaza un archivo dejando el mismo nombre.
 */
export function servir (req, res) {
  const url = new URL(req.url, 'http://x')
  if (!url.pathname.startsWith('/recursos/')) return false
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); res.end(); return true
  }

  const pedido = decodeURIComponent(url.pathname.slice('/recursos/'.length))
  const destino = path.resolve(CARPETA, pedido)

  // La comprobación que importa: después de resolver, ¿sigue adentro? Con el separador al final
  // para que `/recursos-secretos` no pase por empezar igual que `/recursos`.
  if (destino !== CARPETA && !destino.startsWith(CARPETA + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('fuera de la carpeta\n')
    return true
  }

  let datos
  try {
    const st = fs.statSync(destino)
    if (!st.isFile()) throw new Error('no es un archivo')
    datos = fs.readFileSync(destino)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('no está\n')
    return true
  }

  res.writeHead(200, {
    'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
    'Content-Length': datos.length,
    'Cache-Control': 'public, max-age=31536000, immutable',
  })
  res.end(req.method === 'HEAD' ? undefined : datos)
  return true
}

/** Qué hay bajado. Lo usa el arranque para avisar si falta correr los bajadores. */
export function inventario () {
  const contar = (sub) => {
    try { return fs.readdirSync(path.join(CARPETA, sub)).filter(f => !f.startsWith('.')).length }
    catch { return 0 }
  }
  let fuentes = 0, iconos = 0
  try {
    const raiz = fs.readdirSync(CARPETA)
    fuentes = raiz.filter(f => f.endsWith('.woff2')).length
    iconos = raiz.includes('iconos.json')
      ? Object.keys(JSON.parse(fs.readFileSync(path.join(CARPETA, 'iconos.json'), 'utf8'))).length
      : 0
  } catch {}
  return { fuentes, iconos, fondos: contar('fondos') }
}
