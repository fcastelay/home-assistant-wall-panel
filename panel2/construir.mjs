// Arma el JSON del dashboard "Panel Vertical 2".
//
//   node scripts/panel2/construir.mjs            -> escribe Panel 2v/panel-vertical-2.json
//
// Estrategia: se parte del panel actual (respaldo) para no perder ninguna
// funcionalidad, y se van REEMPLAZANDO vistas por las rediseñadas. Lo que
// todavia no se rediseño queda funcionando igual que antes, con las rutas de
// navegacion apuntando al dashboard nuevo.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { cuadro } from './diseno.mjs'
import { navbar } from './navbar.mjs'
import { vistaInicio } from './vistas/inicio.mjs'
import { vistaLuces } from './vistas/luces.mjs'
import { vistaAmbientes, vistaCamaras, vistaEscenas } from './vistas/simples.mjs'
import { vistaEnergia, vistaFactura } from './vistas/energia.mjs'
import { vistaAlarma } from './vistas/alarma.mjs'
import { vistaClima } from './vistas/clima.mjs'
import { vistaRedes } from './vistas/redes.mjs'
import { vistaSalud } from './vistas/salud.mjs'
import { vistaTendencias } from './vistas/tendencias.mjs'
import { vistaAutomatizaciones } from './vistas/automatizaciones.mjs'
import { vistaMas } from './vistas/mas.mjs'
import { vistaMedia, vistaAparatos, vistaCamioneta, vistaSausalito } from './vistas/varias.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const RESPALDO = path.join(RAIZ, 'Panel 2v', 'respaldo', 'panel-vertical-ANTES.json')
const SALIDA = path.join(RAIZ, 'Panel 2v', 'panel-vertical-2.json')

export const BASE_VIEJA = '/panel-vertical/'
export const BASE_NUEVA = '/panel-vertical-2/'

/** Junta todas las tarjetas de una vista vieja que cumplan un filtro. */
function rescatar (vista, filtro) {
  const salida = []
  for (const s of vista.sections || []) for (const c of s.cards || []) if (filtro(c)) salida.push(c)
  return salida
}

// Vistas rediseñadas. Cada una recibe la vista vieja para poder rescatar de ahi
// las tarjetas que se conservan tal cual (pop-ups, graficos, markdowns).
const REDISENADAS = {
  inicio: () => vistaInicio(),
  luces: (vieja) => vistaLuces(
    rescatar(vieja, c => c.type === 'custom:bubble-card'),
    rescatar(vieja, c => c.type === 'history-graph')[0] || null,
  ),
  habitaciones: (vieja) => vistaAmbientes(vieja),
  camaras: (vieja) => vistaCamaras(vieja),
  escenas: (vieja) => vistaEscenas(vieja),
  energia: (vieja) => vistaEnergia(vieja),
  'factura-epe': (vieja) => vistaFactura(vieja),
  alarma: (vieja) => vistaAlarma(vieja),
  clima: (vieja) => vistaClima(vieja),
  media: (vieja) => vistaMedia(vieja),
  aparatos: (vieja) => vistaAparatos(vieja),
  camioneta: (vieja) => vistaCamioneta(vieja),
  sausalito: (vieja) => vistaSausalito(vieja),
}

// Vistas del panel viejo que no van al nuevo.
const DESCARTADAS = new Set(['inicio-v2'])

/**
 * Deja TODOS los cuadro-card con la misma config, incluso los que vienen
 * heredados de las vistas viejas. Si no, los `hab-*` se quedan con los tiempos
 * del panel anterior y el protector se comporta distinto segun la vista.
 */
function normalizarCuadros (nodo) {
  if (Array.isArray(nodo)) return nodo.map(normalizarCuadros)
  if (nodo && typeof nodo === 'object') {
    if (nodo.type === 'custom:cuadro-card') return cuadro()
    const salida = {}
    for (const [k, v] of Object.entries(nodo)) salida[k] = normalizarCuadros(v)
    return salida
  }
  return nodo
}

/**
 * Deja TODAS las barras con las mismas rutas, incluso las de las vistas que no se
 * redisenan (`casa` y las catorce `hab-*`).
 *
 * Sin esto, agregar una ruta la deja invisible desde 15 de las 29 vistas: la barra se
 * genera por vista y esas pasan de largo. Paso el 28/08 al agregar Redes.
 */
function normalizarNavbar (nodo) {
  if (Array.isArray(nodo)) return nodo.map(normalizarNavbar)
  if (nodo && typeof nodo === 'object') {
    if (nodo.type === 'custom:liquid-lens-navbar-card') return navbar()
    const salida = {}
    for (const [k, v] of Object.entries(nodo)) salida[k] = normalizarNavbar(v)
    return salida
  }
  return nodo
}

/** Reescribe las rutas de navegacion al dashboard nuevo, a cualquier profundidad. */
function reapuntar (nodo) {
  if (typeof nodo === 'string') return nodo.split(BASE_VIEJA).join(BASE_NUEVA)
  if (Array.isArray(nodo)) return nodo.map(reapuntar)
  if (nodo && typeof nodo === 'object') {
    const salida = {}
    for (const [k, v] of Object.entries(nodo)) salida[k] = reapuntar(v)
    return salida
  }
  return nodo
}

export function construir (base) {
  const views = base.views
    .filter(v => !DESCARTADAS.has(v.path))
    .map(v => {
      const hacer = REDISENADAS[v.path]
      // Las tarjetas rescatadas ya vienen con las rutas reapuntadas.
      return hacer ? hacer(reapuntar(v)) : reapuntar(v)
    })

  // Redes es una vista NUEVA: no existe en el panel viejo, asi que no alcanza con
  // el mapa REDISENADAS —que reemplaza por `path`— y hay que agregarla al final.
  // Si ya estuviera de una corrida anterior, se reemplaza en vez de duplicarse.
  const conRedes = views.filter(v => v.path !== 'redes').concat([vistaRedes()])
  const conAutos = conRedes.filter(v => v.path !== 'automatizaciones').concat([vistaAutomatizaciones()])
  // "Mas": el cajon de las seis vistas que salieron de la barra el 29/08.
  const conMas = conAutos.filter(v => v.path !== 'mas').concat([vistaMas()])
  // Salud tambien es nueva (31/08/2026) y va por el mismo camino que Redes: no existe en el
  // panel viejo, asi que se agrega al final reemplazando la de la corrida anterior.
  const conSalud = conMas.filter(v => v.path !== 'salud').concat([vistaSalud()])
  // Tendencias no va en la barra: se llega desde la vista Salud. Es para mirar sentado,
  // no de paso por el pasillo.
  const conTend = conSalud.filter(v => v.path !== 'tendencias').concat([vistaTendencias()])

  return { ...base, views: normalizarNavbar(normalizarCuadros(conTend)) }
}

function principal () {
  if (!fs.existsSync(RESPALDO)) {
    console.error('Falta el respaldo del panel actual en:\n  ' + RESPALDO +
      '\nBajalo con:  node scripts/ha/ha.mjs bajar panel-vertical "' + RESPALDO + '"')
    process.exit(1)
  }
  const base = JSON.parse(fs.readFileSync(RESPALDO, 'utf8').replace(/^\uFEFF/, ''))
  const cfg = construir(base)
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true })
  fs.writeFileSync(SALIDA, JSON.stringify(cfg, null, 2))
  console.log('OK  ' + cfg.views.length + ' vistas -> ' + SALIDA)
  console.log('    rediseñadas: ' + Object.keys(REDISENADAS).join(', '))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal()
