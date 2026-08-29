// Revisa el JSON generado antes de subirlo.
//
//   node scripts/panel2/verificar.mjs [vista]
//
// Chequea lo que rompio de verdad durante el rediseño:
//   1. Plantillas JS de button-card que no compilan (una comilla suelta en un
//      token de diseño tumba la tarjeta entera y solo se ve en el navegador).
//   2. Vistas sin protector de pantalla o sin navbar.
//   3. Rutas de navegacion que todavia apuntan al panel viejo.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ARCHIVO = path.join(RAIZ, 'Panel 2v', 'panel-vertical-2.json')

const cfg = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8').replace(/^﻿/, ''))
const soloVista = process.argv[2]

let plantillas = 0
const fallos = []

function recorrer (nodo, ruta, visita) {
  if (Array.isArray(nodo)) return nodo.forEach((x, i) => recorrer(x, `${ruta}[${i}]`, visita))
  if (nodo && typeof nodo === 'object') {
    visita(nodo, ruta)
    for (const k of Object.keys(nodo)) recorrer(nodo[k], `${ruta}.${k}`, visita)
  }
}

for (const v of cfg.views) {
  if (soloVista && v.path !== soloVista) continue
  const marca = `[${v.path}]`
  let tieneCuadro = false
  let tieneNavbar = false

  recorrer(v.sections || v.cards || [], marca, (nodo, ruta) => {
    if (nodo.type === 'custom:cuadro-card') tieneCuadro = true
    if (nodo.type === 'custom:liquid-lens-navbar-card') tieneNavbar = true

    const c = nodo.custom_fields && nodo.custom_fields.c
    if (typeof c === 'string' && c.startsWith('[[[')) {
      plantillas++
      try {
        // eslint-disable-next-line no-new-func
        new Function('states', 'entity', 'user', 'hass', 'variables', c.slice(3, -3))
      } catch (e) {
        fallos.push(`plantilla rota  ${ruta}: ${e.message}`)
      }
    }
  })

  if (!tieneCuadro) fallos.push(`${marca} sin cuadro-card (protector de pantalla)`)
  if (!tieneNavbar) fallos.push(`${marca} sin navbar`)
  if (!v.background || !String(v.background.image || '').includes('olas')) {
    fallos.push(`${marca} sin el fondo con movimiento`)
  }
}

const viejas = JSON.stringify(cfg).split('/panel-vertical/').length - 1
if (viejas) fallos.push(`${viejas} rutas todavia apuntan a /panel-vertical/`)

console.log(`${cfg.views.length} vistas · ${plantillas} plantillas JS revisadas`)
if (!fallos.length) {
  console.log('OK, sin problemas')
} else {
  for (const f of fallos) console.log('  ✗ ' + f)
  process.exit(1)
}
