# Imagen del puente Ecowitt.
#
# NO ES MULTI-ETAPA, y es a propósito: no hay nada que compilar ni dependencias que instalar.
# Este proyecto no usa npm —el cliente MQTT está escrito a mano, ver _mqtt.mjs— así que la
# imagen es Node más nueve archivos .mjs. Una segunda etapa no ahorraría un solo byte y
# agregaría una parte más que puede fallar en una actualización.
#
# EL CONTEXTO DE CONSTRUCCION es la carpeta armada, no el repositorio: los archivos del puente
# viven en scripts/ecowitt/ pero _mqtt.mjs viene de scripts/garnet/, porque es el mismo cliente
# que usa la alarma y no tiene sentido tener dos copias. Se arma con:
#
#     node scripts/ecowitt/desplegar-nas.mjs --armar ./build
#
# y ahí adentro se construye. El despliegue al NAS hace exactamente eso.

FROM node:22-alpine

# tini: sin él, Node corre como PID 1 y **no recibe SIGTERM**. Eso importa acá porque al
# apagarse el puente publica "offline" en MQTT: sin esa señal, la salida ordenada no ocurre y
# Home Assistant se entera de la baja recién por el testamento, veinte segundos después.
#
# su-exec: para bajar de root a `node` en el arranque, después de acomodar el dueño del
# volumen. Ver entrada.sh — el 01/09/2026 el contenedor no levantaba justamente por esto.
RUN apk add --no-cache tini su-exec wget

WORKDIR /app
COPY *.mjs ./
COPY entrada.sh /usr/local/bin/entrada.sh

# Tres cosas que parecen paranoia y no lo son. El archivo viene por Samba desde Windows:
#
#   sed   por si alguna edición le deja fin de línea CRLF. Con un retorno de carro al final
#         del "#!", el contenedor no dice "sobra un carácter": dice **"not found"**, y uno se
#         pasa media hora buscando un archivo que está ahí. De los errores más caros por lo
#         poco que dicen.
#   chmod porque Windows no tiene bit de ejecución, y sin él es "permission denied".
#   chown para que el código sea del usuario que lo va a correr.
RUN sed -i 's/\r$//' /usr/local/bin/entrada.sh \
 && chmod +x /usr/local/bin/entrada.sh \
 && mkdir -p /app/datos && chown -R node:node /app

# NO SE PONE `USER node` ACA. El arranque necesita root un instante para acomodar el dueño del
# volumen —que lo crea el despliegue con el usuario del NAS, no con el de la imagen— y recién
# después baja a `node`. Lo hace entrada.sh, y ahí está explicado por qué.

ENV PUERTO=8088 \
    ARCHIVO=/app/datos \
    NODE_ENV=production

EXPOSE 8088

# La sonda mira /salud, que contesta 503 si la estación dejó de reportar. Es deliberado que el
# contenedor figure enfermo en ese caso: el puente puede estar vivo y ser inútil, y esa es
# justo la falla que nadie nota. Ver /salud en _panel.mjs.
HEALTHCHECK --interval=60s --timeout=5s --start-period=120s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8088/salud || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrada.sh"]
CMD ["node", "receptora.mjs"]
