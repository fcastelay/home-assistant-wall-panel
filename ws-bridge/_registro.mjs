// El registro en memoria: lo que muestra el visor del panel.
//
// EN MEMORIA Y CON TECHO, a propósito. Son dos cosas distintas y las dos importan:
//
// **En memoria**, porque esto es información de vigilancia, no el dato de la estación. Lo que
// no se puede perder ya está en datos/AAAAMMDD.txt antes de que este registro exista. Que se
// borre al reiniciar el contenedor es correcto.
//
// **Con techo**, porque un proceso que corre meses guardando una línea por minuto termina
// comiéndose la memoria del contenedor. Un anillo de tamaño fijo no crece nunca: cuando se
// llena, lo más viejo se cae solo.

const MAX_EVENTOS = 300
const MAX_LECTURAS = 720   // 12 horas a un envío por minuto, POR ESTACION

const eventos = []
// Un anillo por estación. Con varias estaciones un anillo compartido mezclaría las curvas de
// todas en un mismo gráfico, y la de la que reporta más seguido taparía a las otras.
const lecturas = new Map()

/**
 * Anota un evento. nivel: 'info' | 'ok' | 'aviso' | 'error'.
 *
 * SE ESCRIBE TAMBIEN EN LA CONSOLA, que es lo que queda en el log del contenedor y sobrevive
 * al reinicio. El panel es más cómodo de mirar; el log del contenedor es el que sigue estando
 * cuando hay que averiguar qué pasó anoche.
 */
export function anotar (nivel, texto) {
  const e = { t: new Date().toISOString(), nivel, texto: String(texto).slice(0, 300) }
  eventos.push(e)
  if (eventos.length > MAX_EVENTOS) eventos.shift()
  const hora = new Date().toLocaleTimeString('es-AR', { hour12: false })
  const marca = { error: 'ERROR', aviso: 'aviso', ok: '', info: '' }[nivel] || ''
  console.log('[' + hora + '] ' + (marca ? marca + ' ' : '') + texto)
  return e
}

/** Guarda unos pocos valores de cada lectura, para el gráfico del panel. */
export function anotarLectura (idEstacion, campos) {
  if (!lecturas.has(idEstacion)) lecturas.set(idEstacion, [])
  const l = lecturas.get(idEstacion)
  l.push({
    t: campos.fecha_iso || new Date().toISOString(),
    temp: campos.temp_ext ?? null,
    hum: campos.hum_ext ?? null,
    viento: campos.viento ?? null,
    presion: campos.presion_rel ?? null,
    lluvia: campos.lluvia_dia ?? null,
  })
  if (l.length > MAX_LECTURAS) l.shift()
}

/** Se olvida el historial de una estación borrada, para que no quede ocupando memoria. */
export function olvidarLecturas (idEstacion) { lecturas.delete(idEstacion) }

export const verEventos = (n = 80) => eventos.slice(-n).reverse()
export const verLecturas = (idEstacion) => lecturas.get(idEstacion) || []
