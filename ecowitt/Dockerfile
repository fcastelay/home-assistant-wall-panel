# Imagen del puente Ecowitt.
#
# NO ES MULTI-ETAPA, y es a propósito: no hay nada que compilar ni dependencias que instalar.
# Este proyecto no usa npm —el cliente MQTT está escrito a mano, ver _mqtt.mjs— así que la
# imagen es Node más siete archivos .mjs. Una segunda etapa no ahorraría un solo byte y
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
RUN apk add --no-cache tini wget

WORKDIR /app
COPY *.mjs ./

# NO CORRE COMO ROOT. El único lugar donde escribe es /app/datos, que es el volumen.
RUN mkdir -p /app/datos && chown -R node:node /app
USER node

ENV PUERTO=8088 \
    ARCHIVO=/app/datos \
    NODE_ENV=production

EXPOSE 8088

# La sonda mira /salud, que contesta 503 si la estación dejó de reportar. Es deliberado que el
# contenedor figure enfermo en ese caso: el puente puede estar vivo y ser inútil, y esa es
# justo la falla que nadie nota. Ver /salud en _panel.mjs.
HEALTHCHECK --interval=60s --timeout=5s --start-period=120s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8088/salud || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "receptora.mjs"]
