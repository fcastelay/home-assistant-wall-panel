// Cliente MQTT mínimo: sólo CONNECT y PUBLISH, que es todo lo que hace falta para publicar
// entidades a Home Assistant por auto-descubrimiento.
//
// POR QUE ESCRITO A MANO Y NO `npm i mqtt`: este proyecto no tiene `package.json` ni
// `node_modules`, y los clientes de MikroTik, QNAP y Synology tampoco usan dependencias.
// Agregar una sola obliga a instalar y mantener el arbol entero. Publicar por MQTT es
// armar dos paquetes binarios; no justifica romper esa regla.
//
// LO QUE NO HACE, a proposito: no se suscribe, no maneja QoS 1 ni 2, no reconecta con
// backoff exponencial. Publica en QoS 0 con `retain`, que es exactamente lo que necesita el
// descubrimiento de HA: el broker guarda el ultimo valor y HA lo lee cuando arranca.

import net from 'node:net'
import fs from 'node:fs'

/**
 * Lee las credenciales del broker de la propia configuracion de Home Assistant.
 *
 * POR QUE ASI Y NO UN ARCHIVO PROPIO: la clave del MQTT ya existe en HA. Copiarla a otro
 * lado crea un segundo lugar donde rotarla, y el dia que se cambie una y no la otra esto
 * deja de andar sin decir por que. Se lee de la fuente.
 */
export const credenciales = () => {
  // 1) VARIABLES DE ENTORNO. Es el camino cuando esto corre en un contenedor del NAS: ahi
  //    no hay Samba al /config de HA, y montarlo solo para leer una clave seria acoplar el
  //    servicio a que ese recurso este disponible al arrancar.
  if (process.env.MQTT_USUARIO && process.env.MQTT_CLAVE) {
    return {
      host: process.env.MQTT_HOST || 'TU_HOST_HA',
      puerto: Number(process.env.MQTT_PUERTO || 1883),
      usuario: process.env.MQTT_USUARIO,
      clave: process.env.MQTT_CLAVE,
    }
  }

  // 2) LA CONFIGURACION DE HA POR SAMBA. Es el camino cuando corre en la PC: evita tener la
  //    clave escrita en dos lugares, que es como se termina rotando una y olvidando la otra.
  const ruta = '//TU_HOST_HA/config/.storage/core.config_entries'
  if (!fs.existsSync(ruta)) {
    console.error('No hay credenciales de MQTT.')
    console.error('  - en contenedor: definir MQTT_USUARIO y MQTT_CLAVE')
    console.error('  - en la PC: hace falta el acceso Samba a ' + ruta)
    process.exit(1)
  }
  const d = JSON.parse(fs.readFileSync(ruta, 'utf8'))
  const e = d.data.entries.find(x => x.domain === 'mqtt')
  if (!e) { console.error('No hay integracion MQTT configurada en HA.'); process.exit(1) }
  return {
    // `core-mosquitto` es el nombre interno del add-on: sólo resuelve DENTRO de HA.
    // Desde afuera hay que hablarle a la IP.
    host: 'TU_HOST_HA',
    puerto: e.data.port || 1883,
    usuario: e.data.username,
    clave: e.data.password,
  }
}

// ---------------------------------------------------------------- armado de paquetes

/** Largo variable de MQTT: 7 bits por byte, el octavo indica continuacion. */
const largoVariable = (n) => {
  const b = []
  do {
    let x = n % 128
    n = Math.floor(n / 128)
    if (n > 0) x |= 0x80
    b.push(x)
  } while (n > 0)
  return Buffer.from(b)
}

/** Cadena MQTT: dos bytes de largo por delante. */
const cadena = (s) => {
  const b = Buffer.from(String(s), 'utf8')
  const l = Buffer.alloc(2)
  l.writeUInt16BE(b.length)
  return Buffer.concat([l, b])
}

/**
 * CONNECT, con testamento opcional.
 *
 * EL TESTAMENTO (`will`, LWT) es lo que hace que Home Assistant se entere de que el puente se
 * murio. Se lo declara al conectar: "si pierdo la conexion sin despedirme, publica ESTO en
 * ESTE tema". Lo publica el broker, no el proceso caido — que es justo la gracia: un proceso
 * que se cuelga no puede avisar de nada por su cuenta.
 *
 * Sin esto, un puente muerto deja sus ultimos valores retenidos en el broker y las entidades
 * se quedan mostrando la temperatura de hace tres dias como si fuera de ahora. Es la misma
 * forma en que fallo la WS2900 el 15/08 y nadie se entero.
 */
const paqueteConnect = (idCliente, usuario, clave, will) => {
  let banderas = 0xc2   // usuario + clave + sesion limpia
  const partes = [cadena(idCliente)]
  if (will) {
    banderas |= 0x04    // hay testamento
    banderas |= 0x20    // y se retiene, para que el estado sobreviva al reinicio de HA
    partes.push(cadena(will.tema), cadena(will.contenido))
  }
  partes.push(cadena(usuario), cadena(clave))
  const variable = Buffer.concat([
    cadena('MQTT'),
    Buffer.from([
      0x04,       // protocolo 3.1.1
      banderas,
      0x00, 0x3c, // keep alive 60 s
    ]),
  ])
  const cuerpo = Buffer.concat([variable, Buffer.concat(partes)])
  return Buffer.concat([Buffer.from([0x10]), largoVariable(cuerpo.length), cuerpo])
}

const paquetePublish = (tema, contenido, retener) => {
  const cuerpo = Buffer.concat([cadena(tema), Buffer.from(String(contenido), 'utf8')])
  // 0x30 = PUBLISH QoS 0. El bit 0 es `retain`.
  return Buffer.concat([Buffer.from([retener ? 0x31 : 0x30]), largoVariable(cuerpo.length), cuerpo])
}

// ---------------------------------------------------------------- conexion

/**
 * Se conecta al broker. Devuelve { publicar, cerrar } o lanza si no pudo.
 * `alCaerse` se llama si la conexion se corta despues de establecida.
 *
 * `opciones.id`   prefijo del identificador de cliente (por defecto 'garnet-puente')
 * `opciones.will` testamento: { tema, contenido }. Ver `paqueteConnect`.
 * `opciones.credenciales` { host, puerto, usuario, clave } para saltear `credenciales()`.
 *                  Lo usa el puente Ecowitt, donde el broker se carga desde su panel web y
 *                  no desde el entorno ni desde la configuracion de HA.
 */
export const conectar = (alCaerse = () => {}, opciones = {}) => new Promise((ok, mal) => {
  const c = opciones.credenciales || credenciales()
  const s = new net.Socket()
  let conectado = false

  s.setTimeout(15000)
  s.once('timeout', () => { s.destroy(); if (!conectado) mal(new Error('sin respuesta del broker')) })
  s.once('error', (e) => { if (!conectado) mal(e); else alCaerse(e) })
  s.once('close', () => { if (conectado) alCaerse(new Error('el broker cerro la conexion')) })

  s.connect(c.puerto, c.host, () => {
    s.write(paqueteConnect((opciones.id || 'garnet-puente') + '-' + process.pid, c.usuario, c.clave, opciones.will))
  })

  s.once('data', (d) => {
    // CONNACK: 0x20, largo 2, flags, codigo de retorno. 0 = aceptado.
    if (d[0] !== 0x20 || d[3] !== 0x00) {
      const motivos = { 1: 'version de protocolo', 2: 'id de cliente', 3: 'broker no disponible',
                        4: 'usuario o clave incorrectos', 5: 'no autorizado' }
      s.destroy()
      return mal(new Error('el broker rechazo la conexion: ' + (motivos[d[3]] || 'codigo ' + d[3])))
    }
    conectado = true
    s.setTimeout(0)
    // Latido: sin esto el broker corta a los 60 s de silencio.
    const latido = setInterval(() => { try { s.write(Buffer.from([0xc0, 0x00])) } catch {} }, 30000)
    s.on('close', () => clearInterval(latido))
    // Las respuestas del broker (PINGRESP) se descartan: no nos suscribimos a nada.
    s.on('data', () => {})
    ok({
      publicar: (tema, contenido, retener = false) => {
        try { s.write(paquetePublish(tema, contenido, retener)); return true }
        catch { return false }
      },
      cerrar: () => { clearInterval(latido); try { s.end(Buffer.from([0xe0, 0x00])) } catch {} },
    })
  })
})
