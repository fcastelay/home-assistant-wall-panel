#!/bin/sh
# Arregla el dueño del volumen y baja de privilegios. Se ejecuta antes que el programa.
#
# POR QUE HACE FALTA, medido el 01/09/2026
#
# El contenedor moría 0,6 segundos después de arrancar, en bucle, con ExitCode 1 y el
# registro vacío. La causa:
#
#     /volume1/docker/ws-bridge/datos   dueño uid 1026 (el usuario del NAS)
#     el contenedor corría como       uid 1000 (el usuario 'node' de la imagen)
#
# 1000 no es 1026, no está en su grupo, y "otros" no tiene permiso de escritura. Lo primero
# que hace el puente al arrancar es escribir `datos/config.json`, así que se llevaba un EACCES
# sin atrapar y se moría. La carpeta la crea el despliegue por Samba, con el usuario de la
# casa: no hay forma de que coincida con el uid de la imagen.
#
# POR QUE `chown` Y NO `user:` EN EL COMPOSE. Fijar `user: "1026:100"` también funcionaría,
# **en este NAS**. Pero ese número es de esta instalación: cualquiera que copie el proyecto
# tendría que averiguar el suyo, y hasta que lo hiciera vería exactamente este bucle sin
# ninguna pista. Acá el contenedor se acomoda solo al dueño que encuentre.
#
# POR QUE NO CORRER COMO ROOT Y LISTO. Es lo que hace la receptora de la Garnet, y por eso a
# ella nunca le pasó. Pero este proceso **escucha un puerto y atiende un panel web con
# credenciales adentro**: si algún día tiene un agujero, la diferencia entre root y un usuario
# sin privilegios es la diferencia entre un susto y un problema. El arranque necesita root un
# instante; el programa, no.

set -e

if [ "$(id -u)" = "0" ]; then
  if ! chown -R node:node /app/datos 2>/dev/null; then
    echo "AVISO: no se pudo cambiar el dueño de /app/datos."
    echo "       Si el puente no arranca, es esto: el volumen no es escribible."
  fi
  # su-exec reemplaza el proceso, no lo envuelve: el PID sigue siendo uno solo y las señales
  # de Docker llegan derecho al programa. Con `su` quedarían dos procesos y un SIGTERM no
  # llegaría, así que el puente no alcanzaría a publicar su "offline" en MQTT al apagarse.
  exec su-exec node "$@"
fi

# Si alguien ya lo arrancó con otro usuario, se respeta y no se toca nada.
exec "$@"
