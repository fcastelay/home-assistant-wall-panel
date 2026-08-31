// Vista "Tendencias" — la salud a largo plazo.
//
// POR QUE ES UNA VISTA APARTE Y NO UNA SECCION DE `salud`
//
// `salud` tiene que entrar sin scroll en 1080x1920: es un panel de pared que se mira de paso.
// Las tendencias son lo contrario — se miran sentado, con tiempo, y piden alto. Meterlas
// abajo de Salud rompia el requisito de la especificacion.
//
// POR QUE `statistics-graph` Y NO `mini-graph-card`
//
// Son dos memorias distintas de Home Assistant:
//
//     el grabador       guarda todo con detalle, y PURGA A LOS 30 DIAS (recorder.yaml)
//     las estadisticas  promedio/minimo/maximo por hora y por dia, PARA SIEMPRE
//
// `mini-graph-card` lee el grabador: a los 31 dias no hay con que dibujar. `statistics-graph`
// lee las estadisticas, que no vencen. Para "como vengo durmiendo" la unica opcion correcta
// es la segunda.
//
// Y hay una segunda razon, de honestidad: **`mini-graph-card` rellena lo que no existe con el
// primer valor**, y dibuja una recta que parece un sensor trabado. `statistics-graph` con
// pocos puntos dibuja pocos puntos. Hoy estos graficos estan casi vacios porque las
// estadisticas arrancaron el 31/08/2026; se llenan solos, un punto por dia.
//
// QUE SE GRAFICA Y QUE NO: solo lo que sirve para ver un cambio. Un dato que no cambia
// —la altura, el objetivo de peso— no es una tendencia, es una constante.

import { T, R, alfa, js, tarjeta, aire, cuadro, fondoOlas } from '../diseno.mjs'
import { navbar } from '../navbar.mjs'
import { rotulo } from '../restilar.mjs'

// Estilo comun de las tarjetas de estadistica: el mismo vidrio oscuro del resto del panel.
const ESTILO = `
  ha-card {
    background: ${T.tarjeta} !important;
    border: 1px solid ${T.borde} !important;
    border-radius: ${R.grande}px !important;
    box-shadow: none !important;
    backdrop-filter: blur(6px);
  }
  .card-header {
    font-family: ${T.plex} !important;
    font-size: 15px !important;
    font-weight: 600 !important;
    color: ${T.texto} !important;
    padding: 18px 20px 4px !important;
  }
`

/**
 * Un grafico de estadisticas.
 *
 * @param titulo   lo que se lee arriba
 * @param series   [[entidad, nombre, color], ...]
 * @param dias     ventana
 * @param tipo     'line' o 'bar'
 * @param stats    que estadistica: ['mean'] para medidas, ['sum'] para contadores diarios
 */
const grafico = (titulo, series, dias = 30, tipo = 'line', stats = ['mean']) => ({
  type: 'statistics-graph',
  title: titulo,
  // `period: day` y no `hour`: un peso o una presion se miden una vez por dia como mucho.
  // Pedir por hora dibujaria 24 puntos iguales por dia y aplanaria la curva real.
  period: 'day',
  days_to_show: dias,
  chart_type: tipo,
  stat_types: stats,
  grid_options: { columns: 'full' },
  entities: series.map(([entity, name, color]) => ({ entity, name, color })),
  card_mod: { style: ESTILO },
})

// --------------------------------------------------------------------- vista

export function vistaTendencias () {
  return {
    title: 'Tendencias',
    path: 'tendencias',
    icon: 'mdi:chart-line',
    type: 'sections',
    max_columns: 2,
    theme: 'Vidrio Animado',
    background: fondoOlas(),
    sections: [
      {
        type: 'grid',
        column_span: 2,
        cards: [tarjeta({
          relleno: '22px 26px',
          grid: { columns: 'full' },
          html: `<div style="width:100%">
            <div style="font-family:${T.sora};font-size:34px;font-weight:800;line-height:1;color:${T.texto}">Tendencias</div>
            <div style="font-size:13.5px;color:${T.texto2};margin-top:8px;line-height:1.5">
              Estadísticas de largo plazo: un punto por día, y <b style="color:${T.texto}">no se borran nunca</b>.
              Arrancaron el 31/08/2026, así que los gráficos se van llenando solos.
            </div></div>`,
        })],
      },

      // DESCANSO PRIMERO. Es lo que mas explica todo lo demas —el pulso en reposo, la
      // variabilidad, el animo— y es el dato que hasta hoy no se guardaba.
      {
        type: 'grid',
        column_span: 2,
        cards: [
          rotulo('Descanso'),
          grafico('Horas de sueño · 30 días', [['sensor.sueno', 'Sueño', T.lila]], 30, 'bar'),
        ],
      },

      // Pulso en reposo y HRV juntos NO es capricho: se leen enfrentados. El pulso en reposo
      // subiendo mientras la variabilidad baja es la señal clasica de que algo se acumula
      // —mal dormir, entrenar de mas, una infeccion—. Por separado dicen la mitad.
      {
        type: 'grid',
        cards: [grafico('Pulso en reposo · 60 días',
          [['sensor.iphone_de_persona1_resting_heart_rate', 'Reposo', T.rosa]], 60)],
      },
      {
        type: 'grid',
        cards: [grafico('Variabilidad del pulso · 60 días',
          [['sensor.iphone_de_persona1_heart_rate_variability', 'HRV', T.lila]], 60)],
      },

      {
        type: 'grid',
        column_span: 2,
        cards: [
          rotulo('Cuerpo'),
          grafico('Peso · 90 días', [['sensor.withings_peso', 'Peso', T.acento]], 90),
        ],
      },
      {
        type: 'grid',
        cards: [grafico('Proporción de grasa · 90 días',
          [['sensor.withings_proporcion_de_grasa', 'Grasa', T.alerta]], 90)],
      },
      {
        type: 'grid',
        cards: [grafico('Masa muscular · 90 días',
          [['sensor.withings_masa_muscular', 'Muscular', T.info]], 90)],
      },

      // Las dos presiones en el MISMO grafico: separadas no se puede ver si se mueven juntas
      // o si se abre la diferencia entre ellas, que es justamente lo que se mira.
      {
        type: 'grid',
        column_span: 2,
        cards: [
          rotulo('Presión arterial'),
          grafico('Sistólica y diastólica · 90 días', [
            ['sensor.dormitorio_withings_systolic_blood_pressure', 'Sistólica', T.alerta],
            ['sensor.dormitorio_withings_diastolic_blood_pressure', 'Diastólica', T.info],
          ], 90),
        ],
      },

      // Pasos y calorias van por `sum`: son contadores que se reinician cada dia
      // (`total_increasing`). Pedirles el promedio daria el valor a mitad del dia, no el total.
      {
        type: 'grid',
        column_span: 2,
        cards: [
          rotulo('Actividad'),
          grafico('Pasos por día · 30 días',
            [['sensor.iphone_de_persona1_health_steps', 'Pasos', T.okTexto]], 30, 'bar', ['sum']),
        ],
      },
      {
        type: 'grid',
        cards: [grafico('Minutos de ejercicio · 30 días',
          [['sensor.iphone_de_persona1_exercise_time', 'Ejercicio', T.lima]], 30, 'bar', ['sum'])],
      },
      {
        type: 'grid',
        cards: [grafico('Calorías activas · 30 días',
          [['sensor.iphone_de_persona1_active_energy', 'Activas', '#ff9d5c']], 30, 'bar', ['sum'])],
      },

      // ENTRENAMIENTO: OJO CON COMO SE LEE ESTO.
      //
      // `last_activity` de Garmin guarda **la ultima salida**, no un historial. Estos sensores
      // sostienen los valores de esa salida hasta que llegue otra, asi que el grafico es una
      // escalera: **cada escalon es una salida nueva**, no un dia de entrenamiento.
      //
      // Ninguna salida se pierde —cada una deja su escalon para siempre— pero no es una serie
      // continua. Por eso al lado va "dias desde la ultima": sin ese numero, una salida de
      // hace dos meses se lee como si fuera de esta semana.
      {
        type: 'grid',
        column_span: 2,
        cards: [
          rotulo('Entrenamiento · cada escalón es una salida'),
          grafico('Carga de entrenamiento · 180 días',
            [['sensor.salida_carga', 'Carga', T.peligro]], 180),
        ],
      },
      {
        type: 'grid',
        cards: [grafico('Distancia de la salida · 180 días',
          [['sensor.salida_distancia', 'Distancia', T.info]], 180)],
      },
      {
        type: 'grid',
        cards: [grafico('Días desde la última salida · 180 días',
          [['sensor.salida_dias_desde', 'Días', T.texto2]], 180)],
      },

      // VO2 max va solo y a un año: es la medida que mas lento se mueve de todas. En 30 dias
      // no cambia nada y el grafico pareceria roto.
      {
        type: 'grid',
        column_span: 2,
        cards: [
          rotulo('Estado físico'),
          grafico('VO2 máximo · 1 año', [['sensor.iphone_de_persona1_vo2_max', 'VO2 máx', T.info]], 365),
        ],
      },

      { type: 'grid', column_span: 2, cards: [cuadro(), aire(110), navbar()] },
    ],
  }
}
