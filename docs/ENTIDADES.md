# Todas las entidades que usa el panel

**Este archivo se genera solo.** Sale de leer el código, no de escribirlo a mano: una lista
escrita a mano nace vieja, porque se agrega una tarjeta y nadie la actualiza.

```
node scripts/publicar/inventario.mjs
```

---

## Para qué sirve

**Si vas a copiar el panel:** esta es la lista de lo que hay que cambiar por lo tuyo. No
hace falta tenerlas todas — una vista sin sus entidades muestra huecos, pero no rompe el
resto. Se puede ir de a una.

**Si el panel es tuyo:** es el inventario de qué depende cada vista. Si mañana desaparece
una entidad, acá está qué se rompe.

---

## Resumen

**184 entidades** en 29 archivos.

| Dominio | Cuántas | Qué son |
|---|---|---|
| `sensor` | 103 | Mediciones: consumo, temperatura, estado de la red, bibliotecas |
| `media_player` | 14 | Reproductores |
| `light` | 14 | Luces |
| `scene` | 10 | Escenas |
| `switch` | 9 | Enchufes y relés |
| `button` | 7 | Botones |
| `binary_sensor` | 5 | Estados de sí/no: movimiento, aberturas, presencia |
| `alarm_control_panel` | 4 | Paneles de alarma |
| `lock` | 4 | Cerraduras |
| `weather` | 3 | Clima |
| `input_number` | 2 | Números configurables |
| `person` | 2 | Personas |
| `select` | 2 | Selectores de dispositivo |
| `update` | 1 | Actualizaciones disponibles |
| `zone` | 1 | Zonas geográficas |
| `input_boolean` | 1 | Interruptores lógicos: modos como vacaciones o simulador |
| `sun` | 1 | Posición del sol |
| `vacuum` | 1 | Aspiradora |

---

## El detalle

Al lado de cada una, dónde se usa.


### `sensor` — 103

| Entidad | Se usa en |
|---|---|
| `sensor.altura_rio_corrientes` | `inicio.mjs` |
| `sensor.altura_rio_esquina_cr` | `inicio.mjs` |
| `sensor.altura_rio_la_paz_er` | `inicio.mjs` |
| `sensor.altura_rio_reconquista` | `inicio.mjs` |
| `sensor.altura_rio_san_javier` | `inicio.mjs` |
| `sensor.arbol_de_expansion` | `red_fisica.yaml`, `redes.mjs` |
| `sensor.backup_proxima_copia_de_seguridad_automatica_programada` | `respaldos.yaml` |
| `sensor.backup_ultima_copia_de_seguridad_automatica_realizada_correctamente` | `respaldos.yaml` |
| `sensor.cf_amenazas_detalle` | `redes_seguridad.yaml` |
| `sensor.cf_amenazas_hoy` | `redes.mjs` |
| `sensor.cf_diagnostico` | `redes_seguridad.yaml` |
| `sensor.cf_peticiones_hoy` | `redes.mjs` |
| `sensor.datos_bajados_hoy` | `redes.mjs` |
| `sensor.datos_del_mes` | `redes.mjs` |
| `sensor.datos_subidos_hoy` | `redes.mjs` |
| `sensor.dispositivos_conectados` | `redes.mjs` |
| `sensor.dns_al_dia` | `redes_seguridad.yaml` |
| `sensor.dns_del_dominio` | `redes_seguridad.yaml` |
| `sensor.epe_costo_estimado_bimestre` | `energia.mjs`, `inicio.mjs` |
| `sensor.epe_proyeccion_bimestre` | `inicio.mjs` |
| `sensor.estado_de_la_red` | `redes.mjs` |
| `sensor.fordpass_` | `varias.mjs` |
| `sensor.fordpass_8afbr01bxrj409587_alarm` | `ranger_es.yaml` |
| `sensor.fordpass_8afbr01bxrj409587_deviceconnectivity` | `ranger_es.yaml` |
| `sensor.fordpass_8afbr01bxrj409587_dieselsystemstatus` | `ranger_es.yaml` |
| `sensor.fordpass_8afbr01bxrj409587_doorstatus` | `ranger_es.yaml` |
| `sensor.fordpass_8afbr01bxrj409587_gearleverposition` | `ranger_es.yaml` |
| `sensor.fordpass_8afbr01bxrj409587_ignitionstatus` | `ranger_es.yaml` |
| `sensor.fordpass_8afbr01bxrj409587_lastrefresh` | `ranger_es.yaml` |
| `sensor.fordpass_8afbr01bxrj409587_parkingbrakestatus` | `ranger_es.yaml` |
| `sensor.fordpass_8afbr01bxrj409587_remotestartstatus` | `ranger_es.yaml` |
| `sensor.fordpass_8afbr01bxrj409587_seatbelt` | `ranger_es.yaml` |
| `sensor.fordpass_8afbr01bxrj409587_windowposition` | `ranger_es.yaml` |
| `sensor.hue_motion_sensor_1_temperatura` | `auditoria.yaml`, `diseno.mjs`, `luces.mjs` |
| `sensor.hue_motion_sensor_2_temperatura` | `auditoria.yaml`, `luces.mjs` |
| `sensor.hue_motion_sensor_3_temperatura` | `auditoria.yaml`, `luces.mjs` |
| `sensor.hue_motion_sensor_4_temperatura` | `auditoria.yaml`, `luces.mjs` |
| `sensor.hue_motion_sensor_5_temperatura` | `auditoria.yaml` |
| `sensor.hue_motion_sensor_6_temperatura` | `auditoria.yaml` |
| `sensor.hue_outdoor_motion_sensor_1_iluminancia` | `luces.mjs` |
| `sensor.hue_outdoor_motion_sensor_1_temperatura` | `luces.mjs` |
| `sensor.ijai_v3_8cae_battery_level` | `varias.mjs` |
| `sensor.ijai_v3_8cae_door_state` | `pedro_es.yaml` |
| `sensor.ip_publica` | `redes_seguridad.yaml`, `redes.mjs` |
| `sensor.latencia_internet` | `redes.mjs` |
| `sensor.lavadero_consumo_general_consumo_bimestre_epe` | `energia.mjs`, `inicio.mjs` |
| `sensor.lavadero_consumo_general_consumo_hoy` | `energia.mjs`, `inicio.mjs` |
| `sensor.mikrotik_cpu` | `redes.mjs` |
| `sensor.minipc_tucasa` | `plex.mjs` |
| `sensor.minipc_tucasa_library_fotos` | `plex.mjs` |
| `sensor.minipc_tucasa_library_peliculas` | `plex.mjs` |
| `sensor.minipc_tucasa_library_series` | `plex.mjs` |
| `sensor.nas_home_volume_1_espacio_usado` | `respaldos.yaml` |
| `sensor.nas_home_volume_1_volumen_utilizado` | `respaldos.yaml` |
| `sensor.nodos_caidos` | `redes_seguridad.yaml` |
| `sensor.nodos_de_la_malla` | `redes_seguridad.yaml`, `redes.mjs` |
| `sensor.plex_plex_recently_added_movie` | `plex.mjs` |
| `sensor.plex_plex_recently_added_show` | `plex.mjs` |
| `sensor.porton_ingreso_power` | `inicio.mjs` |
| `sensor.ranger_sin_reportar` | `varias.mjs` |
| `sensor.router_costo_al_raiz` | `red_fisica.yaml` |
| `sensor.router_encendido_desde` | `redes.mjs` |
| `sensor.router_segundos_encendido` | `red_fisica.yaml` |
| `sensor.router_temperatura` | `redes.mjs` |
| `sensor.shelly_3em_consumo_actual_amperius` | `energia.mjs` |
| `sensor.shelly_3em_consumo_actual_general` | `navbar.mjs`, `energia.mjs`, `inicio.mjs` |
| `sensor.shelly_3em_consumo_actual_oficina` | `energia.mjs`, `inicio.mjs` |
| `sensor.shelly_3em_consumo_actual_quincho` | `energia.mjs`, `inicio.mjs` |
| `sensor.shelly_3em_factor_potencia_general` | `energia.mjs` |
| `sensor.shelly_3em_total_consumo` | `energia.mjs`, `inicio.mjs` |
| `sensor.shelly_3em_total_consumo_cost_3` | `energia.mjs` |
| `sensor.shelly_3em_voltaje_general` | `energia.mjs` |
| `sensor.sonoff_100142a118_power` | `varias.mjs` |
| `sensor.sonoff_100142a118_voltage` | `varias.mjs` |
| `sensor.switch_costo_al_raiz` | `red_fisica.yaml` |
| `sensor.switch_cpu` | `redes.mjs` |
| `sensor.switch_encendido_desde` | `redes.mjs` |
| `sensor.switch_ether1_velocidad` | `redes.mjs` |
| `sensor.switch_ether2_velocidad` | `redes.mjs` |
| `sensor.switch_ether3_velocidad` | `redes.mjs` |
| `sensor.switch_ether4_velocidad` | `redes.mjs` |
| `sensor.switch_ether5_velocidad` | `redes.mjs` |
| `sensor.switch_ether6_velocidad` | `red_fisica.yaml`, `redes.mjs` |
| `sensor.switch_ether7_velocidad` | `red_fisica.yaml`, `redes.mjs` |
| `sensor.switch_ether8_velocidad` | `red_fisica.yaml`, `redes.mjs` |
| `sensor.switch_segundos_encendido` | `red_fisica.yaml` |
| `sensor.switch_sfp1_velocidad` | `red_fisica.yaml`, `redes.mjs` |
| `sensor.switch_temperatura` | `redes.mjs` |
| `sensor.switch_tension` | `redes.mjs` |
| `sensor.time` | `automatizaciones.mjs`, `inicio.mjs` |
| `sensor.tunel_cloudflare_codigo` | `redes_seguridad.yaml` |
| `sensor.ups_datos_de_estado` | `sentinel.yaml` |
| `sensor.vigilante_de_entidades` | `sentinel.yaml` |
| `sensor.wan_bajada` | `redes.mjs` |
| `sensor.wan_bajada_bps` | `redes_seguridad.yaml` |
| `sensor.wan_bajada_del_mes` | `redes_seguridad.yaml` |
| `sensor.wan_bajada_hoy` | `redes_seguridad.yaml` |
| `sensor.wan_bytes_bajada` | `redes_seguridad.yaml` |
| `sensor.wan_bytes_subida` | `redes_seguridad.yaml` |
| `sensor.wan_subida` | `redes.mjs` |
| `sensor.wan_subida_bps` | `redes_seguridad.yaml` |
| `sensor.wan_subida_del_mes` | `redes_seguridad.yaml` |
| `sensor.wan_subida_hoy` | `redes_seguridad.yaml` |

### `media_player` — 14

| Entidad | Se usa en |
|---|---|
| `media_player.apple_tv_living` | `media.yaml`, `varias.mjs` |
| `media_player.dormitorio_2_2` | `media.yaml` |
| `media_player.flowbox_living` | `varias.mjs` |
| `media_player.habitacion` | `media.yaml`, `varias.mjs` |
| `media_player.homepods_oficina` | `varias.mjs` |
| `media_player.lg_webos_tv_oled65b5psa` | `varias.mjs` |
| `media_player.living` | `media.yaml`, `varias.mjs` |
| `media_player.panel_samsung_qbc_series` | `sonando.mjs` |
| `media_player.plex_` | `sonando.mjs` |
| `media_player.quincho` | `media.yaml`, `varias.mjs` |
| `media_player.samsung_6_series_50_un50mu6100` | `varias.mjs` |
| `media_player.samsung_qbc_series` | `sonando.mjs` |
| `media_player.tv_dormitorio_2` | `varias.mjs` |
| `media_player.tv_oficina` | `varias.mjs` |

### `light` — 14

| Entidad | Se usa en |
|---|---|
| `light.5_in_1_controller_wifi_2_4g` | `varias.mjs` |
| `light.cocina_cocina` | `luces.mjs` |
| `light.comedor_comedor` | `luces.mjs` |
| `light.dormitorio_invitados_dormitorio_invitados` | `luces.mjs` |
| `light.dormitorio_principal_dormitorio_principal` | `luces.mjs` |
| `light.luces_afuera` | `luces.mjs` |
| `light.luz_garage` | `inicio.mjs`, `luces.mjs` |
| `light.luz_ingreso` | `inicio.mjs`, `luces.mjs` |
| `light.pasillo_pasillo` | `luces.mjs` |
| `light.reflectores` | `luces.mjs` |
| `light.rgb_pileta` | `luces.mjs` |
| `light.todas_las_luces_de_casa` | `inicio.mjs`, `luces.mjs` |
| `light.turn_off` | `inicio.mjs`, `luces.mjs` |
| `light.tv_living_govee` | `luces.mjs` |

### `scene` — 10

| Entidad | Se usa en |
|---|---|
| `scene.cocina_brillante_2` | `luces.mjs` |
| `scene.concentracion` | `inicio.mjs` |
| `scene.dormitorio_luz_nocturna` | `luces.mjs` |
| `scene.escritorio_apagado` | `inicio.mjs` |
| `scene.modo_cine` | `luces.mjs` |
| `scene.noche_suave` | `inicio.mjs` |
| `scene.pasillo_relax_2` | `luces.mjs` |
| `scene.pelicula` | `inicio.mjs` |
| `scene.relax` | `inicio.mjs` |
| `scene.turn_on` | `inicio.mjs` |

### `switch` — 9

| Entidad | Se usa en |
|---|---|
| `switch.luces_arboles_interruptor_1` | `varias.mjs` |
| `switch.panel_pasillo_pantalla` | `panel_pasillo.yaml` |
| `switch.pileta_sausalito_bomba_interruptor_1` | `varias.mjs` |
| `switch.shelly_luz_garage` | `inicio.mjs` |
| `switch.shelly_porton_automatico` | `inicio.mjs` |
| `switch.simulador_presencia_con_luces` | `inicio.mjs` |
| `switch.sonoff_100142a118` | `varias.mjs` |
| `switch.turn_off` | `panel_pasillo.yaml` |
| `switch.turn_on` | `inicio.mjs` |

### `button` — 7

| Entidad | Se usa en |
|---|---|
| `button.despertar_pc_oficina` | `inicio.mjs`, `redes.mjs` |
| `button.ijai_v3_8cae_start_charge` | `varias.mjs` |
| `button.ijai_v3_8cae_start_mop` | `varias.mjs` |
| `button.ijai_v3_8cae_start_only_sweep` | `varias.mjs` |
| `button.ijai_v3_8cae_start_sweep_mop` | `varias.mjs` |
| `button.ijai_v3_8cae_stop_sweeping` | `varias.mjs` |
| `button.press` | `inicio.mjs`, `varias.mjs` |

### `binary_sensor` — 5

| Entidad | Se usa en |
|---|---|
| `binary_sensor.enlace_wan` | `redes_seguridad.yaml`, `redes.mjs` |
| `binary_sensor.internet` | `redes_seguridad.yaml`, `redes.mjs` |
| `binary_sensor.pc_oficina` | `redes_seguridad.yaml`, `inicio.mjs`, `redes.mjs` |
| `binary_sensor.router_mikrotik` | `redes.mjs` |
| `binary_sensor.tunel_cloudflare` | `redes_seguridad.yaml`, `redes.mjs` |

### `alarm_control_panel` — 4

| Entidad | Se usa en |
|---|---|
| `alarm_control_panel.alarm_disarm` | `alarma.mjs` |
| `alarm_control_panel.alarmo` | `navbar.mjs`, `alarma.mjs`, `inicio.mjs` |
| `alarm_control_panel.ezviz_alarm` | `inicio.mjs` |
| `alarm_control_panel.sausalito` | `inicio.mjs` |

### `lock` — 4

| Entidad | Se usa en |
|---|---|
| `lock.fordpass_` | `varias.mjs` |
| `lock.lock` | `inicio.mjs` |
| `lock.puerta_galeria` | `inicio.mjs` |
| `lock.state` | `varias.mjs` |

### `weather` — 3

| Entidad | Se usa en |
|---|---|
| `weather.forecast_casa` | `inicio.mjs` |
| `weather.forecast_sausalito` | `clima.mjs` |
| `weather.pirateweather` | `clima.mjs` |

### `input_number` — 2

| Entidad | Se usa en |
|---|---|
| `input_number.epe_kwh_por_dia_de_referencia` | `inicio.mjs` |
| `input_number.epe_kwh_ultimo_bimestre` | `energia.mjs` |

### `person` — 2

| Entidad | Se usa en |
|---|---|
| `person.persona1` | `inicio.mjs` |
| `person.persona2` | `inicio.mjs` |

### `select` — 2

| Entidad | Se usa en |
|---|---|
| `select.ijai_v3_8cae_suction_state` | `pedro_es.yaml` |
| `select.ijai_v3_8cae_water_state` | `pedro_es.yaml` |

### `update` — 1

| Entidad | Se usa en |
|---|---|
| `update.plex_media_server_minipc_tucasa` | `plex.mjs` |

### `zone` — 1

| Entidad | Se usa en |
|---|---|
| `zone.home` | `inicio.mjs`, `luces.mjs` |

### `input_boolean` — 1

| Entidad | Se usa en |
|---|---|
| `input_boolean.vacaciones` | `inicio.mjs` |

### `sun` — 1

| Entidad | Se usa en |
|---|---|
| `sun.sun` | `luces.mjs` |

### `vacuum` — 1

| Entidad | Se usa en |
|---|---|
| `vacuum.ijai_v3_8cae_robot_cleaner` | `varias.mjs` |

---

## Cómo adaptarlas sin volverse loco

**No las cambies todas de entrada.** El panel se arma por vistas y cada una es
independiente:

1. Empezá por `panel2/vistas/inicio.mjs`. Es la que se mira todos los días.
2. Corré `node panel2/construir.mjs` y mirá qué quedó vacío.
3. Seguí con las vistas que uses.
4. Las que no te sirvan, sacalas de `RUTAS` en `panel2/navbar.mjs` y listo.

**Una entidad que no existe no rompe nada**: la tarjeta muestra `--` o queda apagada. Eso
es a propósito — un panel a medio adaptar tiene que seguir siendo usable.
