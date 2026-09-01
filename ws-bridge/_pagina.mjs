// La página del panel: HTML, estilo y guion, todo en un archivo y sin dependencias.
//
// POR QUE SIN NINGUNA LIBRERIA, ni siquiera por CDN
//
// Este panel corre en el NAS, en la red de casa, y su trabajo es decir si la estación está
// subiendo datos. Si para dibujarse necesita bajar Tailwind de internet, entonces el día que
// se corte internet —justo el día en que uno quiere saber si los datos están saliendo— el
// panel aparece en blanco. Una herramienta de diagnóstico no puede depender de lo que está
// diagnosticando.
//
// Eso también decidió la tipografía: no hay Google Fonts, así que la voz del panel sale de
// **Arial Narrow**, que está instalada en cualquier Windows y cualquier Mac, usada en
// versalitas espaciadas como las anotaciones de una carta del tiempo. Una restricción que
// terminó dando más carácter que una fuente traída de afuera.
//
// LA DECISION DE DISEÑO, en una línea: esto no es un tablero, es una **carta sinóptica**.
//
// El dibujo central es el modelo de estación que se usa en las cartas del tiempo desde hace
// un siglo: un círculo, la barba de viento apuntando de dónde sopla, y los números en
// posiciones fijas alrededor. La posición ES el dato. Se eligió porque es notación real del
// oficio y porque se dibuja con SVG plano, sin una sola dependencia.
//
// Y de ahí sale la regla de color: **el color se reserva para las excepciones.** Un destino
// que anda bien va en tinta, sin color, igual que todo lo demás. Sólo se pintan la falla
// (rojo de frente cálido) y la espera (ámbar de sodio). Un panel donde todo lo normal está en
// verde es un panel donde no se ve nada.
//
// OJO AL EDITAR: todo esto vive dentro de una plantilla de JavaScript. **No se puede escribir
// un acento grave acá adentro**, ni un dólar seguido de llave: cierran la plantilla y el error
// de sintaxis aparece cuarenta líneas más abajo, en un lugar que no tiene nada que ver. Ya
// pasó. El guion de la página usa concatenación con + por eso mismo.

export const PAGINA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Weather Station Bridge</title>
<style>
  /* --- Paleta: carta sinóptica sobre papel. El color sólo marca excepciones. --- */
  :root {
    --papel:      #e6eae9;
    --papel-alto: #f3f6f5;
    --tinta:      #16262c;
    --tinta-media:#3d565f;
    --tinta-suave:#6d838b;
    --isobara:    #c2cbca;
    --isobara-fina: #d5dcdb;
    --frio:       #1d5f8a;
    --calor:      #a83236;
    --sodio:      #b3701a;
    --sombra:     0 1px 0 rgba(22,38,44,.04);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --papel:      #0e181d;
      --papel-alto: #14222a;
      --tinta:      #d8e3e5;
      --tinta-media:#9fb2b8;
      --tinta-suave:#75898f;
      --isobara:    #24383f;
      --isobara-fina: #1b2c33;
      --frio:       #5aa5d6;
      --calor:      #e0666a;
      --sodio:      #e0a44e;
      --sombra:     none;
    }
  }

  * { box-sizing: border-box; }

  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: var(--papel);
    color: var(--tinta);
    font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
  }

  /* Los tres roles tipográficos. */
  .anot {
    font-family: "Arial Narrow", "Helvetica Neue", "Liberation Sans Narrow", system-ui, sans-serif;
    font-stretch: condensed;
    text-transform: uppercase;
    letter-spacing: .16em;
    font-weight: 700;
  }
  .dato {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }

  /* --- Encabezado --------------------------------------------------------- */
  .barra {
    display: flex; align-items: baseline; gap: 26px; flex-wrap: wrap;
    padding: 15px 26px 12px;
    border-bottom: 1px solid var(--isobara);
    background: var(--papel-alto);
  }
  .marca { font-size: 19px; letter-spacing: .2em; margin: 0; }
  .marca span { color: var(--tinta-suave); }

  /* La leyenda, como la de una carta: glifo + qué significa. Reemplaza a las pastillas. */
  .leyenda { display: flex; gap: 22px; flex-wrap: wrap; font-size: 11.5px; }
  .leyenda b { font-weight: 700; letter-spacing: .1em; }
  .leyenda i { font-style: normal; color: var(--tinta-suave); margin-left: 7px; letter-spacing: .04em; }
  .leyenda .mal i { color: var(--calor); }

  .pestanas { margin-left: auto; display: flex; }
  .pestanas button {
    background: none; border: 0; border-bottom: 2px solid transparent;
    color: var(--tinta-suave); padding: 5px 15px 7px; cursor: pointer;
    font-size: 12px; letter-spacing: .16em; text-transform: uppercase; font-weight: 700;
    font-family: "Arial Narrow", "Helvetica Neue", system-ui, sans-serif;
  }
  .pestanas button:hover { color: var(--tinta); }
  .pestanas button.sel { color: var(--tinta); border-bottom-color: var(--frio); }

  /* La regla de vencimiento: se llena mientras pasa el tiempo desde el último envío.
     No es adorno — es el reloj que dice cuánto falta para dar la estación por muda. */
  .vence { height: 2px; background: var(--isobara-fina); }
  .vence div { height: 100%; width: 0; background: var(--frio); transition: width 1s linear, background-color .4s; }

  main { padding: 22px 26px 60px; max-width: 1180px; margin: 0 auto; }
  section { display: none; }
  section.sel { display: block; }

  /* --- Bloques ------------------------------------------------------------ */
  .bloque {
    border: 1px solid var(--isobara); background: var(--papel-alto);
    box-shadow: var(--sombra); margin-bottom: 20px;
  }
  .ceja {
    display: flex; align-items: baseline; gap: 14px;
    padding: 9px 16px; border-bottom: 1px solid var(--isobara-fina);
    font-size: 11px; color: var(--tinta-media);
  }
  .ceja .der { margin-left: auto; letter-spacing: .06em; color: var(--tinta-suave); font-weight: 400; }
  .cuerpo { padding: 18px 16px; }

  /* --- Observación: el plot y la rejilla de lecturas ---------------------- */
  .observacion { display: grid; grid-template-columns: 250px 1fr; gap: 26px; align-items: start; }

  .plot { text-align: center; }
  .plot svg { width: 100%; max-width: 230px; height: auto; color: var(--tinta); }
  .plot .anillo { fill: none; stroke: currentColor; stroke-width: 2.2; }
  .plot .lluvia { fill: currentColor; }
  .plot .barba { stroke: currentColor; stroke-width: 2.2; fill: currentColor; stroke-linecap: butt; }
  .plot .cifra { font-size: 21px; fill: currentColor; }
  .plot .rotulo { font-size: 8px; fill: var(--tinta-suave); letter-spacing: .14em; }
  .plot.vacio svg { color: var(--isobara); }
  .plot .barba { transition: transform .9s cubic-bezier(.4,0,.2,1); transform-origin: 0px 0px; transform-box: view-box; }
  .pie-plot { font-size: 12.5px; color: var(--tinta-media); margin-top: 6px; letter-spacing: .02em; }
  .pie-plot b { font-weight: 700; color: var(--tinta); }

  .lecturas { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 1px; background: var(--isobara-fina); border: 1px solid var(--isobara-fina); }
  .celda { background: var(--papel-alto); padding: 10px 12px 11px; }
  .celda .r { font-size: 9.5px; color: var(--tinta-suave); letter-spacing: .13em; display: block; }
  .celda .v { font-size: 19px; margin-top: 3px; display: block; }
  .celda .u { font-size: 11px; color: var(--tinta-suave); margin-left: 2px; }

  /* --- Traza --------------------------------------------------------------- */
  .traza { position: relative; }
  .traza canvas { width: 100%; height: 120px; display: block; }

  /* --- Manifiesto de destinos --------------------------------------------- */
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th {
    text-align: left; padding: 0 12px 8px; border-bottom: 1px solid var(--isobara-fina);
    font-size: 10px; color: var(--tinta-suave); letter-spacing: .14em; text-transform: uppercase;
    font-weight: 700; font-family: "Arial Narrow", "Helvetica Neue", system-ui, sans-serif;
  }
  td { padding: 11px 12px; border-bottom: 1px solid var(--isobara-fina); vertical-align: middle; }
  tr:last-child td { border-bottom: 0; }
  .num { text-align: right; }

  /* El glifo lleva la mitad del mensaje: la forma distingue estado aunque no se vea el color. */
  .glifo { display: inline-block; width: 15px; margin-right: 9px; text-align: center; font-size: 13px; }
  .g-ok   { color: var(--tinta-media); }
  .g-mal  { color: var(--calor); font-weight: 700; }
  .g-esp  { color: var(--sodio); }
  .g-off  { color: var(--isobara); }
  .txt-mal { color: var(--calor); }
  .txt-esp { color: var(--sodio); }
  .sin-ver { color: var(--sodio); font-size: 11px; letter-spacing: .04em; }

  /* --- Botones y campos ---------------------------------------------------- */
  button.acc {
    background: transparent; border: 1px solid var(--isobara); color: var(--tinta-media);
    padding: 5px 12px; cursor: pointer; font-size: 12px; margin-right: 5px;
    font-family: "Arial Narrow", "Helvetica Neue", system-ui, sans-serif;
    text-transform: uppercase; letter-spacing: .1em; font-weight: 700;
  }
  button.acc:hover { border-color: var(--frio); color: var(--frio); }
  button.acc:focus-visible, .pestanas button:focus-visible, input:focus-visible, select:focus-visible {
    outline: 2px solid var(--frio); outline-offset: 2px;
  }
  button.pri { background: var(--frio); border-color: var(--frio); color: #fff; }
  button.pri:hover { color: #fff; opacity: .88; }
  button.peli:hover { border-color: var(--calor); color: var(--calor); }

  label { display: block; font-size: 10.5px; color: var(--tinta-suave); margin: 14px 0 5px; letter-spacing: .13em; text-transform: uppercase; font-weight: 700; font-family: "Arial Narrow", "Helvetica Neue", system-ui, sans-serif; }
  label.plano { text-transform: none; letter-spacing: 0; font-size: 13.5px; color: var(--tinta); font-family: inherit; font-weight: 400; display: flex; align-items: center; gap: 9px; }
  input, select {
    width: 100%; background: var(--papel); border: 1px solid var(--isobara); color: var(--tinta);
    padding: 8px 10px; font: inherit; font-size: 14px;
  }
  input[type=checkbox] { width: auto; }
  .fila { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

  .nota { font-size: 12.5px; color: var(--tinta-suave); margin: 8px 0 0; max-width: 68ch; }
  .nota a { color: var(--frio); }
  .aviso { color: var(--sodio); }

  /* --- Registro ------------------------------------------------------------ */
  .registro { max-height: 320px; overflow-y: auto; font-size: 12.5px; }
  .registro div { padding: 4px 0; border-bottom: 1px solid var(--isobara-fina); display: flex; gap: 12px; }
  .registro div:last-child { border-bottom: 0; }
  .registro .h { color: var(--tinta-suave); flex: none; }
  .registro .error { color: var(--calor); }
  .registro .aviso { color: var(--sodio); }
  .registro .ok, .registro .info { color: var(--tinta-media); }

  .vacio { color: var(--tinta-suave); padding: 26px 4px; font-size: 13.5px; max-width: 60ch; }

  @media (prefers-reduced-motion: reduce) {
    .plot .barba, .vence div { transition: none; }
  }
  @media (max-width: 780px) {
    .observacion { grid-template-columns: 1fr; }
    .fila { grid-template-columns: 1fr; }
    main { padding: 16px 14px 40px; }
    .barra { padding: 12px 14px 10px; gap: 14px; }
    .pestanas { margin-left: 0; width: 100%; }
  }

  /* --- Compuertas: instalar y entrar ------------------------------------- */
  .compuerta { max-width: 380px; margin: 12vh auto; padding: 0 22px; }
  .compuerta h2 { font-size: 20px; margin: 0 0 6px; letter-spacing: .12em; }
  .compuerta .nota { margin-bottom: 20px; }
  .compuerta .caja { padding: 22px 22px 24px; }
  .compuerta button { width: 100%; margin: 18px 0 0; padding: 9px; }
  .error-caja { color: var(--calor); font-size: 13px; margin: 12px 0 0; min-height: 1em; }

  /* --- Tira de estaciones ------------------------------------------------ */
  .tira { display: flex; gap: 1px; background: var(--isobara-fina); border: 1px solid var(--isobara); margin-bottom: 20px; overflow-x: auto; }
  .tira button {
    flex: 1 1 0; min-width: 150px; background: var(--papel-alto); border: 0;
    border-bottom: 2px solid transparent; padding: 11px 14px; cursor: pointer;
    text-align: left; color: var(--tinta-media); font: inherit;
  }
  .tira button:hover { color: var(--tinta); }
  .tira button.sel { border-bottom-color: var(--frio); color: var(--tinta); }
  .tira .n { display: block; font-size: 14px; font-weight: 600; }
  .tira .e { display: block; font-size: 11px; color: var(--tinta-suave); margin-top: 2px; letter-spacing: .04em; }
  .tira .mal .e { color: var(--calor); }
  .tira .off .n { color: var(--tinta-suave); }

  .quien { font-size: 11.5px; color: var(--tinta-suave); display: flex; align-items: center; gap: 10px; }
  .quien b { color: var(--tinta-media); font-weight: 700; letter-spacing: .08em; }
</style>
</head>
<body>

<!-- Compuerta 1: todavía no hay ningún usuario. No se ve nada más hasta que exista un dueño. -->
<div class="compuerta" id="c-instalar" style="display:none">
  <div class="bloque">
    <div class="ceja anot">Primer arranque</div>
    <div class="cuerpo">
      <h2 class="anot">Creá el administrador</h2>
      <p class="nota">Este puente todavía no tiene dueño. El primero que entre lo crea, y desde
        ahí decide quién más puede mirar. No hay contraseña de fábrica: una contraseña de
        fábrica es una puerta abierta en todas las instalaciones del mundo.</p>
      <label for="i-usuario">Usuario</label>
      <input id="i-usuario" autocomplete="username" placeholder="tu nombre">
      <label for="i-clave">Contraseña</label>
      <input id="i-clave" type="password" autocomplete="new-password" placeholder="al menos 8 caracteres">
      <button class="acc pri" id="b-instalar">Crear administrador</button>
      <p class="error-caja" id="i-error"></p>
    </div>
  </div>
</div>

<!-- Compuerta 2: hay usuarios, falta la sesión. -->
<div class="compuerta" id="c-entrar" style="display:none">
  <div class="bloque">
    <div class="ceja anot">Weather Station Bridge</div>
    <div class="cuerpo">
      <h2 class="anot">Entrar</h2>
      <p class="nota">El puente sigue recibiendo y archivando aunque nadie esté mirando.</p>
      <label for="e-usuario">Usuario</label>
      <input id="e-usuario" autocomplete="username">
      <label for="e-clave">Contraseña</label>
      <input id="e-clave" type="password" autocomplete="current-password">
      <button class="acc pri" id="b-entrar">Entrar</button>
      <p class="error-caja" id="e-error"></p>
    </div>
  </div>
</div>

<!-- El panel -->
<div id="panel" style="display:none">

<header class="barra">
  <h1 class="marca anot">Weather Station <span>Bridge</span></h1>
  <div class="leyenda anot" id="leyenda"></div>
  <nav class="pestanas">
    <button data-v="monitor" class="sel">Observación</button>
    <button data-v="estaciones">Estaciones</button>
    <button data-v="destinos">Destinos</button>
    <button data-v="ajustes">Ajustes</button>
  </nav>
  <div class="quien"><span id="quien-soy"></span><button class="acc" id="b-salir">Salir</button></div>
</header>
<div class="vence"><div id="vence"></div></div>

<main>

<section id="v-monitor" class="sel">
  <div class="tira" id="tira" style="display:none"></div>

  <div class="bloque">
    <div class="ceja anot">Observación<span class="der anot" id="cuando"></span></div>
    <div class="cuerpo">
      <div class="observacion">
        <div>
          <div class="plot vacio" id="plot"></div>
          <div class="pie-plot" id="pie-plot"></div>
        </div>
        <div id="lecturas"></div>
      </div>
    </div>
  </div>

  <div class="bloque">
    <div class="ceja anot">Traza · temperatura exterior<span class="der anot" id="traza-nota"></span></div>
    <div class="cuerpo traza"><canvas id="grafico"></canvas></div>
  </div>

  <div class="bloque">
    <div class="ceja anot">Destinos<span class="der anot" id="resumen-destinos"></span></div>
    <div class="cuerpo">
      <table><thead><tr>
        <th>Destino</th><th>Estación</th><th>Servicio</th><th>Último intento</th><th>Resultado</th>
        <th class="num">Latencia</th><th class="num">Enviados / fallos</th><th></th>
      </tr></thead><tbody id="tabla-destinos"></tbody></table>
    </div>
  </div>

  <div class="bloque">
    <div class="ceja anot">Registro<span class="der anot">últimos eventos</span></div>
    <div class="cuerpo"><div class="registro dato" id="log"></div></div>
  </div>
</section>

<section id="v-estaciones">
  <div class="bloque">
    <div class="ceja anot">Estaciones<span class="der anot" id="cuenta-estaciones"></span></div>
    <div class="cuerpo">
      <p class="nota">Las estaciones aparecen solas: apuntá el gateway a este servidor y en el
        próximo envío está acá. Nace apagada, y mientras esté apagada el puente
        <b>archiva sus datos pero no los manda a ningún lado</b>. Ponele nombre y encendela.</p>
      <table><thead><tr>
        <th>Estación</th><th>Modelo</th><th>Identificador</th><th>Envíos</th><th>Último</th><th></th>
      </tr></thead><tbody id="tabla-estaciones"></tbody></table>
    </div>
  </div>
</section>

<section id="v-destinos">
  <div class="bloque">
    <div class="ceja anot" id="titulo-form">Destino nuevo</div>
    <div class="cuerpo">
      <div class="fila">
        <div>
          <label for="f-nombre">Nombre</label>
          <input id="f-nombre" placeholder="Windy del patio">
        </div>
        <div>
          <label for="f-estacion">De qué estación manda</label>
          <select id="f-estacion"></select>
        </div>
      </div>
      <label for="f-receta">Servicio</label>
      <select id="f-receta"></select>
      <p class="nota" id="f-notas"></p>
      <div id="f-credenciales"></div>
      <div class="fila">
        <div>
          <label for="f-intervalo">Esperar entre envíos (segundos · 0 manda todos)</label>
          <input id="f-intervalo" type="number" min="0" step="10" value="0">
        </div>
        <div>
          <label for="f-reintentos">Reintentos ante un fallo pasajero</label>
          <input id="f-reintentos" type="number" min="0" max="5" value="2">
        </div>
      </div>
      <label class="plano" style="margin-top:16px">
        <input type="checkbox" id="f-activo"> Enviar a este destino
      </label>
      <p class="nota">Un destino nuevo se guarda apagado. Probalo primero: el botón le manda la
        última lectura real y te dice qué contestó. Uno que arranca prendido puede estar
        mandando mal durante días sin que nadie lo mire.</p>
      <div style="margin-top:18px">
        <button class="acc pri" id="b-guardar">Guardar destino</button>
        <button class="acc" id="b-cancelar" style="display:none">Cancelar</button>
      </div>
    </div>
  </div>

  <div class="bloque">
    <div class="ceja anot">Configurados<span class="der anot" id="cuenta-config"></span></div>
    <div class="cuerpo">
      <table><thead><tr>
        <th>Destino</th><th>Estación</th><th>Servicio</th><th>Frecuencia</th><th>Estado</th><th></th>
      </tr></thead><tbody id="tabla-config"></tbody></table>
    </div>
  </div>
</section>

<section id="v-ajustes">
  <div class="bloque" id="bloque-usuarios">
    <div class="ceja anot">Usuarios</div>
    <div class="cuerpo">
      <table><thead><tr><th>Usuario</th><th>Puede</th><th></th></tr></thead>
      <tbody id="tabla-usuarios"></tbody></table>
      <div class="fila" style="margin-top:16px">
        <div><label for="u-nombre">Usuario nuevo</label><input id="u-nombre"></div>
        <div><label for="u-clave">Contraseña</label><input id="u-clave" type="password" autocomplete="new-password"></div>
      </div>
      <label for="u-rol">Puede</label>
      <select id="u-rol">
        <option value="mirar">Mirar: ve el estado y los datos</option>
        <option value="admin">Administrar: además cambia todo</option>
      </select>
      <div style="margin-top:16px"><button class="acc" id="b-usuario">Agregar usuario</button></div>
      <p class="error-caja" id="u-error"></p>
    </div>
  </div>

  <div class="bloque">
    <div class="ceja anot">Home Assistant · MQTT</div>
    <div class="cuerpo">
      <div class="fila">
        <div><label for="m-host">Host del broker</label><input id="m-host" placeholder="dejalo vacío para usar el del contenedor"></div>
        <div><label for="m-puerto">Puerto</label><input id="m-puerto" type="number" value="1883"></div>
      </div>
      <div class="fila">
        <div><label for="m-usuario">Usuario</label><input id="m-usuario"></div>
        <div><label for="m-clave">Contraseña</label><input id="m-clave" type="password" placeholder="sin cambios"></div>
      </div>
      <label for="m-prefijo">Prefijo de auto-descubrimiento</label><input id="m-prefijo" value="homeassistant">
      <p class="nota">Vacío = se usan las variables del contenedor (MQTT_HOST, MQTT_USUARIO,
        MQTT_CLAVE). Lo que cargues acá tiene prioridad. Los cambios de MQTT se aplican cuando
        reinicies el contenedor.</p>
    </div>
  </div>

  <div class="bloque">
    <div class="ceja anot">Este nodo</div>
    <div class="cuerpo">
      <div class="fila">
        <div><label for="a-nombre">Nombre del puente</label><input id="a-nombre"></div>
        <div><label for="a-raiz">Raíz de los temas MQTT</label><input id="a-raiz"></div>
      </div>
      <p class="nota">Cada estación cuelga de esa raíz con su propio identificador. Cambiarla
        crea entidades nuevas en Home Assistant y deja huérfanas las viejas: se elige una vez,
        al principio. Sólo hace falta tocarla si corrés dos puentes contra el mismo Home
        Assistant.</p>
      <div style="margin-top:18px"><button class="acc pri" id="b-ajustes">Guardar ajustes</button></div>
    </div>
  </div>
</section>

</main>
</div>

<script>
// SIN UNA SOLA BARRA INVERTIDA EN TODO ESTE GUION, y es a propósito: este texto se pega dentro
// de una plantilla de JavaScript, donde una barra invertida se consume al armar la página y
// llega al navegador convertida en otra cosa. Por eso los manejadores de los botones no van en
// atributos onclick —que obligarían a escapar comillas— sino por delegación de eventos.

var ESTADO = null, LISTA = null, DETALLE = null, CONFIG = null, RECETAS = [], EDITANDO = null, SESION = null;
var ELEGIDA = null;   // qué estación se está mirando

function pedir (ruta, opciones) {
  opciones = opciones || {};
  opciones.credentials = 'same-origin';
  return fetch(ruta, opciones).then(function (r) {
    return r.json().then(function (j) { return { codigo: r.status, cuerpo: j }; })
      .catch(function () { return { codigo: r.status, cuerpo: {} }; });
  });
}
function mandar (ruta, cuerpo, metodo) {
  return pedir(ruta, {
    method: metodo || 'POST', headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
}

function esc (t) {
  return String(t === null || t === undefined ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function hhmm (iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
function hace (iso) {
  if (!iso) return 'nunca';
  var s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(s)) return '';
  if (s < 60) return 'hace ' + s + ' s';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
  return 'hace ' + Math.round(s / 86400) + ' d';
}
function ver (id, si) { document.getElementById(id).style.display = si ? '' : 'none'; }

// ---------------------------------------------------------------- las tres compuertas
function compuertas () {
  return pedir('/api/sesion').then(function (r) {
    SESION = r.cuerpo;
    ver('c-instalar', !SESION.instalado);
    ver('c-entrar', SESION.instalado && !SESION.usuario);
    ver('panel', !!SESION.usuario);
    if (SESION.usuario) {
      document.getElementById('quien-soy').innerHTML =
        '<b>' + esc(SESION.usuario) + '</b>' + (SESION.rol === 'admin' ? '' : ' · sólo mira');
      ver('bloque-usuarios', SESION.rol === 'admin');
      arrancarPanel();
    }
    return SESION;
  });
}

document.getElementById('b-instalar').onclick = function () {
  mandar('/api/instalar', {
    usuario: document.getElementById('i-usuario').value.trim(),
    clave: document.getElementById('i-clave').value
  }).then(function (r) {
    if (r.cuerpo.error) { document.getElementById('i-error').textContent = r.cuerpo.error; return; }
    compuertas();
  });
};

document.getElementById('b-entrar').onclick = function () {
  mandar('/api/entrar', {
    usuario: document.getElementById('e-usuario').value.trim(),
    clave: document.getElementById('e-clave').value
  }).then(function (r) {
    if (r.cuerpo.error) { document.getElementById('e-error').textContent = r.cuerpo.error; return; }
    document.getElementById('e-clave').value = '';
    compuertas();
  });
};
document.getElementById('e-clave').addEventListener('keydown', function (ev) {
  if (ev.key === 'Enter') document.getElementById('b-entrar').click();
});

document.getElementById('b-salir').onclick = function () {
  mandar('/api/salir').then(function () { location.reload(); });
};

// ---------------------------------------------------------------- pestañas
var botones = document.querySelectorAll('.pestanas button');
for (var i = 0; i < botones.length; i++) {
  botones[i].onclick = function () {
    var v = this.dataset.v;
    for (var j = 0; j < botones.length; j++) botones[j].classList.toggle('sel', botones[j].dataset.v === v);
    var secs = document.querySelectorAll('section');
    for (var k = 0; k < secs.length; k++) secs[k].classList.toggle('sel', secs[k].id === 'v-' + v);
    if (v !== 'monitor') cargarConfig();
  };
}

// ---------------------------------------------------------------- el plot sinóptico
//
// Notación real: la barba sale del círculo hacia DE DONDE viene el viento. Cada barba entera
// vale 10 nudos, la media 5, el banderín 50. Círculo doble = calma. Los números van en las
// posiciones canónicas, con su rótulo debajo para que nadie tenga que saberse la convención.

var RUMBOS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
function rumbo (g) { return RUMBOS[Math.round((g % 360) / 22.5) % 16]; }

function barbas (nudos) {
  var p = [], y = -78, n = Math.round(nudos / 5) * 5;
  while (n >= 50) { p.push('<path d="M0 ' + y + ' L20 ' + (y + 7) + ' L0 ' + (y + 14) + ' Z"/>'); n -= 50; y += 17; }
  while (n >= 10) { p.push('<line x1="0" y1="' + y + '" x2="21" y2="' + (y + 8) + '"/>'); n -= 10; y += 9; }
  if (n >= 5) { p.push('<line x1="0" y1="' + y + '" x2="11" y2="' + (y + 4) + '"/>'); }
  return p.join('');
}

function cifra (x, y, valor, unidad, rotulo, ancla) {
  if (valor === undefined || valor === null) return '';
  return '<text class="cifra dato" x="' + x + '" y="' + y + '" text-anchor="' + ancla + '">' +
    esc(valor) + (unidad ? '<tspan font-size="11">' + unidad + '</tspan>' : '') + '</text>' +
    '<text class="rotulo anot" x="' + x + '" y="' + (y + 13) + '" text-anchor="' + ancla + '">' + rotulo + '</text>';
}

function dibujarPlot (d) {
  var caja = document.getElementById('plot');
  var pie = document.getElementById('pie-plot');
  var hay = d && d.temp_ext !== undefined;
  caja.classList.toggle('vacio', !hay);

  var s = '<svg viewBox="-105 -105 210 210" role="img" aria-label="Modelo de estación">';
  var lluvia = hay && d.lluvia_tasa > 0;
  s += '<circle class="anillo' + (lluvia ? ' lluvia' : '') + '" cx="0" cy="0" r="17"/>';

  if (hay && d.viento === 0) {
    s += '<circle class="anillo" cx="0" cy="0" r="26"/>';
  } else if (hay && d.viento !== undefined) {
    var dir = d.viento_dir === undefined ? 0 : d.viento_dir;
    s += '<g class="barba" style="transform: rotate(' + dir + 'deg)">' +
      '<line x1="0" y1="-17" x2="0" y2="-80"/>' + barbas(d.viento / 1.852) + '</g>';
  }

  if (hay) {
    s += cifra(-30, -12, d.temp_ext, '°', 'Temp', 'end');
    s += cifra(-30, 26, d.rocio, '°', 'Rocío', 'end');
    s += cifra(30, -12, d.presion_rel, '', 'hPa', 'start');
    s += cifra(30, 26, d.hum_ext, '%', 'Humedad', 'start');
  }
  caja.innerHTML = s + '</svg>';

  if (!hay) { pie.textContent = ''; return; }
  var t = [];
  if (d.viento !== undefined) {
    t.push(d.viento === 0 ? '<b>Calma</b>' : '<b>' + rumbo(d.viento_dir || 0) + ' ' + d.viento + '</b> km/h');
  }
  if (d.rafaga !== undefined) t.push('ráfaga ' + d.rafaga);
  if (lluvia) t.push('lloviendo ' + d.lluvia_tasa + ' mm/h');
  pie.innerHTML = t.join(' · ');
}

// ---------------------------------------------------------------- lecturas
var CELDAS = [
  ['rafaga', 'Ráfaga', 'km/h'], ['rafaga_max_dia', 'Ráfaga máx.', 'km/h'],
  ['lluvia_dia', 'Lluvia hoy', 'mm'], ['lluvia_tasa', 'Intensidad', 'mm/h'],
  ['uv', 'Índice UV', ''], ['solar', 'Solar', 'W/m²'],
  ['temp_int', 'Interior', '°C'], ['hum_int', 'Humedad int.', '%'],
  ['pm25', 'PM2.5', 'µg/m³'], ['co2', 'CO2', 'ppm'],
  ['presion_abs', 'Presión abs.', 'hPa'], ['sensacion', 'Sensación', '°C']
];

function pintarLecturas (d, est) {
  var h = '';
  for (var i = 0; i < CELDAS.length; i++) {
    var k = CELDAS[i][0];
    if (d[k] === undefined || d[k] === null) continue;
    h += '<div class="celda"><span class="r anot">' + CELDAS[i][1] + '</span>' +
      '<span class="v dato">' + esc(d[k]) +
      (CELDAS[i][2] ? '<span class="u">' + CELDAS[i][2] + '</span>' : '') + '</span></div>';
  }
  var vacio = est
    ? 'Esta estación todavía no reportó nada.'
    : 'Ninguna estación reportó todavía. Apuntá el gateway a este servidor, puerto ' +
      location.port + ', ruta /data/report, y aparece sola en el próximo envío.';
  document.getElementById('lecturas').innerHTML = h
    ? '<div class="lecturas">' + h + '</div>'
    : '<div class="vacio">' + vacio + '</div>';
}

// ---------------------------------------------------------------- la tira de estaciones
var COMO = { en_linea: '', demorada: 'esp', sin_senal: 'mal', apagada: 'off', sin_datos: 'off' };
var DICE = { en_linea: '', demorada: 'demorada', sin_senal: 'sin senal',
  apagada: 'apagada', sin_datos: 'sin datos' };

function pintarTira (e) {
  var t = '';
  for (var i = 0; i < e.estaciones.length; i++) {
    var s = e.estaciones[i];
    var clase = (s.id === ELEGIDA ? 'sel ' : '') + (COMO[s.situacion] || '');
    var estado = DICE[s.situacion] || hace(s.ultimo);
    if (s.situacion === 'en_linea') estado = hace(s.ultimo);
    t += '<button class="' + clase + '" data-accion="elegir" data-id="' + esc(s.id) + '">' +
      '<span class="n">' + esc(s.nombre || s.id) + '</span>' +
      '<span class="e anot">' + estado + '</span></button>';
  }
  document.getElementById('tira').innerHTML = t;
  // Con una sola estacion la tira no aporta nada: es un boton que no lleva a ningun lado.
  ver('tira', e.estaciones.length > 1);
}

// ---------------------------------------------------------------- el nodo (agregados)
function pintarNodo (e) {
  var n = e.nodo, s = n.situaciones || {};
  var glifo = function (mal, txt, val) {
    return '<span class="' + (mal ? 'mal' : '') + '"><b>' + txt + '</b><i>' + val + '</i></span>';
  };
  var caidos = 0, activos = 0;
  for (var i = 0; i < e.destinos.length; i++) {
    if (!e.destinos[i].activo) continue;
    activos++;
    if (e.destinos[i].problema) caidos++;
  }
  document.getElementById('leyenda').innerHTML =
    glifo(s.sin_senal > 0, 'Estaciones', n.activas + ' activas' +
      (s.sin_senal ? ' . ' + s.sin_senal + ' sin senal' : '') +
      (s.demorada ? ' . ' + s.demorada + ' demoradas' : '')) +
    glifo(!e.mqtt.conectado, 'MQTT', e.mqtt.conectado ? 'conectado' : (e.mqtt.motivo || 'sin conectar')) +
    glifo(caidos > 0, 'Destinos', caidos ? caidos + ' con problemas' : activos + ' al dia') +
    glifo(false, 'Hoy', (n.paquetes_hoy || 0) + ' paquetes');

  document.getElementById('resumen-destinos').textContent =
    e.destinos.length ? e.destinos.length + ' servicios' : '';

  // UN RENGLON POR SERVICIO, no por par destino x estacion. Con 200 estaciones y un comodin
  // serian 200 filas identicas; lo que interesa aca es si al servicio le esta llegando.
  var t = '';
  for (var m = 0; m < e.destinos.length; m++) {
    var d = e.destinos[m];
    var g = '<span class="glifo g-off">.</span>', clase = '';
    if (d.activo && d.problema) { g = '<span class="glifo g-mal">x</span>'; clase = 'txt-mal'; }
    else if (d.activo && d.esperando === d.estaciones) { g = '<span class="glifo g-esp">o</span>'; clase = 'txt-esp'; }
    else if (d.activo && d.ultimo_ok) { g = '<span class="glifo g-ok">*</span>'; }
    else if (d.activo) { g = '<span class="glifo g-ok">o</span>'; }
    t += '<tr><td>' + g + esc(d.nombre) + '</td>' +
      '<td>' + (d.comodin ? 'todas' : '') + ' ' + d.estaciones + '</td>' +
      '<td>' + esc(d.servicio) +
        (d.verificado === false ? ' <span class="sin-ver anot">sin verificar</span>' : '') + '</td>' +
      '<td class="dato">' + (d.ultimo_ok ? hace(d.ultimo_ok) : '--') + '</td>' +
      '<td class="' + clase + '">' + (d.problema ? d.problema + ' con problemas' : 'al dia') + '</td>' +
      '<td class="num dato">' + (d.latencia_media !== null ? d.latencia_media + ' ms' : '--') + '</td>' +
      '<td class="num dato">' + (d.tasa24h !== null ? d.tasa24h + ' %' : '--') + '</td>' +
      '<td class="num"><button class="acc" data-accion="probar" data-nombre="' + esc(d.nombre) +
        '" data-estacion="' + esc(ELEGIDA || '') + '">Probar</button></td></tr>';
  }
  document.getElementById('tabla-destinos').innerHTML = t ||
    '<tr><td colspan="8"><div class="vacio">Ningun destino configurado. El puente archiva igual: ' +
    'cada envio se guarda en disco antes de repartirse.</div></td></tr>';

  var l = '';
  for (var k = 0; k < e.log.length; k++) {
    l += '<div><span class="h">' + hhmm(e.log[k].t) + '</span><span class="' + e.log[k].nivel + '">' +
      esc(e.log[k].texto) + '</span></div>';
  }
  document.getElementById('log').innerHTML = l || '<div class="vacio">Sin eventos.</div>';
}

// ---------------------------------------------------------------- la estacion elegida
function pintarDetalle (d) {
  var barra = document.getElementById('vence');
  if (!d) {
    document.getElementById('cuando').textContent = 'sin ninguna estacion';
    dibujarPlot({});
    pintarLecturas({}, null);
    dibujar([]);
    barra.style.width = '0';
    return;
  }
  document.getElementById('cuando').textContent =
    (d.nombre || d.id) + (d.ultimo
      ? ' . ' + hhmm(d.ultimo) + ' . ' + hace(d.ultimo) + ' . ' + d.recibidos + ' envios . ' +
        d.paquetes_hoy + ' hoy'
      : ' . sin observacion');

  if (d.ultimo) {
    var pasado = (Date.now() - new Date(d.ultimo).getTime()) / 1000;
    var umbral = Math.max(3 * ((d.datos.intervalo || 60)), 600);
    var p = Math.min(1, pasado / umbral);
    barra.style.width = (p * 100).toFixed(1) + '%';
    barra.style.background = p > 0.99 ? 'var(--calor)' : (p > 0.66 ? 'var(--sodio)' : 'var(--frio)');
  } else { barra.style.width = '0'; }

  dibujarPlot(d.datos);
  pintarLecturas(d.datos, d);
  dibujar(d.historial || []);
}

function pintarEstaciones (e) {
  document.getElementById('cuenta-estaciones').textContent = e.total
    ? e.total + ' descubiertas' + (e.paginas > 1 ? ' . mostrando ' + e.estaciones.length : '')
    : '';
  var t = '';
  for (var i = 0; i < e.estaciones.length; i++) {
    var s = e.estaciones[i];
    t += '<tr><td>' +
      (s.activa ? '<span class="glifo g-ok">●</span>' : '<span class="glifo g-off">·</span>') +
      '<input data-accion="nombre" data-id="' + esc(s.id) + '" value="' + esc(s.nombre) +
      '" placeholder="sin nombre" style="width:auto;display:inline-block"></td>' +
      '<td>' + esc(s.modelo || '—') + '</td>' +
      '<td class="dato">' + esc(s.id) + '</td>' +
      '<td class="num dato">' + s.recibidos + '</td>' +
      '<td>' + (s.ultimo ? hace(s.ultimo) : 'nunca') +
        (s.situacion !== 'en_linea' && DICE[s.situacion] ? ' . ' + DICE[s.situacion] : '') + '</td>' +
      '<td class="num">' +
      '<button class="acc" data-accion="est-alternar" data-id="' + esc(s.id) + '" data-activa="' +
        (s.activa ? '1' : '0') + '">' + (s.activa ? 'Apagar' : 'Encender') + '</button>' +
      '<button class="acc peli" data-accion="est-borrar" data-id="' + esc(s.id) + '">Borrar</button>' +
      '</td></tr>';
  }
  document.getElementById('tabla-estaciones').innerHTML = t ||
    '<tr><td colspan="6"><div class="vacio">Todavía no llegó ninguna. En el gateway: Weather ' +
    'Services, Customized, protocolo Ecowitt, este servidor, puerto ' + location.port +
    ', ruta /data/report, intervalo 60 s.</div></td></tr>';
}

// ---------------------------------------------------------------- la traza
function dibujar (h) {
  var c = document.getElementById('grafico');
  var ctx = c.getContext('2d');
  var an = c.clientWidth, al = 120, r = window.devicePixelRatio || 1;
  c.width = an * r; c.height = al * r;
  ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.clearRect(0, 0, an, al);

  var est = getComputedStyle(document.body);
  var isobara = est.getPropertyValue('--isobara-fina').trim() || '#ddd';
  var tinta = est.getPropertyValue('--frio').trim() || '#1d5f8a';
  var suave = est.getPropertyValue('--tinta-suave').trim() || '#888';

  var pts = [];
  for (var i = 0; i < h.length; i++) if (h[i].temp !== null) pts.push(h[i].temp);

  ctx.strokeStyle = isobara; ctx.lineWidth = 1;
  for (var g = 0; g <= 4; g++) {
    var y = 8 + (al - 30) * (g / 4);
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(an, y + 0.5); ctx.stroke();
  }

  var nota = document.getElementById('traza-nota');
  if (pts.length < 2) {
    nota.textContent = pts.length + ' de 2 lecturas';
    ctx.fillStyle = suave;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('La traza empieza con la segunda lectura.', 4, al / 2);
    return;
  }

  var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
  if (max - min < 1) { max += 0.5; min -= 0.5; }
  ctx.strokeStyle = tinta; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.beginPath();
  for (var j = 0; j < pts.length; j++) {
    var x = (j / (pts.length - 1)) * (an - 2) + 1;
    var yy = (al - 22) - ((pts[j] - min) / (max - min)) * (al - 42);
    if (j) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
  }
  ctx.stroke();

  ctx.fillStyle = suave;
  ctx.font = '11px ui-monospace, Consolas, monospace';
  ctx.fillText(max.toFixed(1) + ' °C', 2, 20);
  ctx.fillText(min.toFixed(1) + ' °C', 2, al - 4);
  nota.textContent = pts.length + ' lecturas · el historial del panel se borra al reiniciar';
}

// ---------------------------------------------------------------- acciones, por delegación
document.addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-accion]');
  if (!b) return;
  var a = b.dataset.accion;

  if (a === 'elegir') { ELEGIDA = b.dataset.id; refrescar(); return; }

  if (a === 'probar') {
    mandar('/api/probar', { nombre: b.dataset.nombre, estacion: b.dataset.estacion }).then(function (r) {
      alert(r.cuerpo.ok ? 'Llegó bien. ' + (r.cuerpo.detalle || '') : 'No llegó. ' + (r.cuerpo.detalle || ''));
      refrescar();
    });
    return;
  }
  if (a === 'est-alternar') {
    mandar('/api/estacion', { id: b.dataset.id, activa: b.dataset.activa !== '1' }).then(refrescar);
    return;
  }
  if (a === 'est-borrar') {
    if (!confirm('Borrar la estación "' + b.dataset.id + '". Se van también sus destinos y sus ' +
      'entidades de Home Assistant. El archivo crudo en disco NO se borra.')) return;
    mandar('/api/estacion?id=' + encodeURIComponent(b.dataset.id), null, 'DELETE').then(function (r) {
      if (r.cuerpo.error) alert(r.cuerpo.error);
      refrescar(); cargarConfig();
    });
    return;
  }
  if (a === 'editar') { editar(b.dataset.nombre); return; }
  if (a === 'alternar') {
    var d = buscar(b.dataset.nombre);
    if (d) mandar('/api/destino', { anterior: d.nombre, destino: { nombre: d.nombre, activo: !d.activo } }).then(cargarConfig);
    return;
  }
  if (a === 'borrar') {
    if (!confirm('Borrar "' + b.dataset.nombre + '". Se quitan también sus entidades de Home Assistant.')) return;
    mandar('/api/destino?nombre=' + encodeURIComponent(b.dataset.nombre), null, 'DELETE').then(cargarConfig);
    return;
  }
  if (a === 'borrar-usuario') {
    if (!confirm('Borrar al usuario "' + b.dataset.nombre + '".')) return;
    mandar('/api/usuarios?nombre=' + encodeURIComponent(b.dataset.nombre), null, 'DELETE').then(function (r) {
      if (r.cuerpo.error) document.getElementById('u-error').textContent = r.cuerpo.error;
      cargarConfig();
    });
  }
});

// El nombre de una estación se guarda al salir del campo, no en cada tecla.
document.addEventListener('change', function (ev) {
  var t = ev.target;
  if (t.dataset && t.dataset.accion === 'nombre') {
    mandar('/api/estacion', { id: t.dataset.id, nombre: t.value.trim() }).then(refrescar);
  }
});

// TRES PEDIDOS, NO UNO, y ese es todo el punto de haber partido la API.
//
//   /api/estado      agregados. No crece con la cantidad de estaciones.
//   /api/estaciones  una pagina del listado, sin los 67 campos ni el historial.
//   /api/estacion    los 67 campos y el historial, SOLO de la que se esta mirando.
//
// Antes esto era un solo pedido que traia todo: con 200 estaciones eran 4,6 MB cada 5 segundos.
function refrescar () {
  return pedir('/api/estado').then(function (r) {
    if (r.codigo === 401) { location.reload(); return; }
    ESTADO = r.cuerpo;
    pintarNodo(ESTADO);
    return pedir('/api/estaciones?por=60&orden=ultimo');
  }).then(function (r) {
    if (!r || !r.cuerpo || !r.cuerpo.estaciones) return;
    LISTA = r.cuerpo;
    pintarTira(LISTA);
    pintarEstaciones(LISTA);
    if (!ELEGIDA && LISTA.estaciones.length) ELEGIDA = LISTA.estaciones[0].id;
    return ELEGIDA ? pedir('/api/estacion?id=' + encodeURIComponent(ELEGIDA)) : null;
  }).then(function (r) {
    DETALLE = (r && r.cuerpo && !r.cuerpo.error) ? r.cuerpo : null;
    pintarDetalle(DETALLE);
  }).catch(function () {});
}

// ---------------------------------------------------------------- configuración
function cargarRecetas () {
  return pedir('/api/recetas').then(function (r) {
    RECETAS = r.cuerpo;
    var s = document.getElementById('f-receta'), h = '';
    for (var i = 0; i < RECETAS.length; i++) {
      h += '<option value="' + RECETAS[i].id + '">' + esc(RECETAS[i].nombre) +
        (RECETAS[i].verificado ? '' : ' · sin verificar') + '</option>';
    }
    s.innerHTML = h;
    s.onchange = function () { pintarCampos(); };
    pintarCampos();
  });
}

function recetaSel () {
  var id = document.getElementById('f-receta').value;
  for (var i = 0; i < RECETAS.length; i++) if (RECETAS[i].id === id) return RECETAS[i];
  return null;
}

function pintarCampos (valores) {
  var r = recetaSel();
  if (!r) return;
  document.getElementById('f-notas').innerHTML =
    (r.verificado ? '' : '<b class="aviso">Receta sin probar contra el servicio real.</b> ') +
    esc(r.notas) + (r.doc ? ' <a href="' + esc(r.doc) + '" target="_blank" rel="noopener">Documentación</a>' : '');
  var h = '';
  for (var i = 0; i < r.campos.length; i++) {
    var c = r.campos[i];
    var v = valores && valores[c.clave] ? valores[c.clave] : '';
    h += '<label for="c-' + esc(c.clave) + '">' + esc(c.etiqueta) + (c.obligatorio ? '' : ' · opcional') + '</label>' +
      '<input id="c-' + esc(c.clave) + '" data-cred="' + esc(c.clave) + '"' +
      (c.secreto ? ' type="password" placeholder="sin cambios"' : '') +
      ' value="' + esc(c.secreto ? '' : v) + '">';
  }
  document.getElementById('f-credenciales').innerHTML = h;
  if (!valores) document.getElementById('f-intervalo').value = r.intervalo_sug || 0;
}

function opcionesEstacion (elegida) {
  var h = '<option value="*">Todas las estaciones</option>';
  var e = CONFIG ? CONFIG.estaciones : {};
  for (var id in e) {
    h += '<option value="' + esc(id) + '"' + (elegida === id ? ' selected' : '') + '>' +
      esc(e[id].nombre || id) + '</option>';
  }
  document.getElementById('f-estacion').innerHTML = h;
  if (elegida === '*') document.getElementById('f-estacion').value = '*';
}

function cargarConfig () {
  return pedir('/api/config').then(function (r) {
    if (r.codigo === 401) { location.reload(); return; }
    var c = r.cuerpo;
    CONFIG = c;
    document.getElementById('m-host').value = c.mqtt.host || '';
    document.getElementById('m-puerto').value = c.mqtt.puerto || 1883;
    document.getElementById('m-usuario').value = c.mqtt.usuario || '';
    document.getElementById('m-prefijo').value = c.mqtt.prefijo || 'homeassistant';
    document.getElementById('a-nombre').value = (c.nodo && c.nodo.nombre) || '';
    document.getElementById('a-raiz').value = (c.nodo && c.nodo.raiz) || '';
    opcionesEstacion(document.getElementById('f-estacion').value);
    document.getElementById('cuenta-config').textContent =
      c.destinos.length ? c.destinos.length + ' destinos' : '';

    var h = '';
    for (var i = 0; i < c.destinos.length; i++) {
      var d = c.destinos[i];
      var donde = d.estacion === '*' ? 'todas' :
        ((c.estaciones[d.estacion] || {}).nombre || d.estacion);
      h += '<tr><td>' + esc(d.nombre) + '</td><td>' + esc(donde) + '</td>' +
        '<td>' + esc(d.receta || d.tipo) + '</td>' +
        '<td>' + (d.intervalo_min ? 'cada ' + d.intervalo_min + ' s' : 'todos los envíos') + '</td>' +
        '<td>' + (d.activo ? '<span class="glifo g-ok">●</span>enviando'
                           : '<span class="glifo g-off">·</span>apagado') + '</td>' +
        '<td class="num">' +
        '<button class="acc" data-accion="editar" data-nombre="' + esc(d.nombre) + '">Editar</button>' +
        '<button class="acc" data-accion="alternar" data-nombre="' + esc(d.nombre) + '">' +
          (d.activo ? 'Apagar' : 'Encender') + '</button>' +
        '<button class="acc peli" data-accion="borrar" data-nombre="' + esc(d.nombre) + '">Borrar</button>' +
        '</td></tr>';
    }
    document.getElementById('tabla-config').innerHTML = h ||
      '<tr><td colspan="6"><div class="vacio">Ninguno todavía. Cargá el primero arriba: ' +
      'empezá por Home Assistant.</div></td></tr>';

    if (c.usuarios) {
      var u = '';
      for (var k = 0; k < c.usuarios.length; k++) {
        u += '<tr><td>' + esc(c.usuarios[k].nombre) + '</td>' +
          '<td>' + (c.usuarios[k].rol === 'admin' ? 'administrar todo' : 'mirar') + '</td>' +
          '<td class="num"><button class="acc peli" data-accion="borrar-usuario" data-nombre="' +
          esc(c.usuarios[k].nombre) + '">Borrar</button></td></tr>';
      }
      document.getElementById('tabla-usuarios').innerHTML = u;
    }
  });
}

function buscar (nombre) {
  if (!CONFIG) return null;
  for (var i = 0; i < CONFIG.destinos.length; i++) if (CONFIG.destinos[i].nombre === nombre) return CONFIG.destinos[i];
  return null;
}

function editar (nombre) {
  var d = buscar(nombre);
  if (!d) return;
  EDITANDO = nombre;
  document.getElementById('titulo-form').textContent = 'Editando ' + nombre;
  document.getElementById('f-nombre').value = d.nombre;
  document.getElementById('f-receta').value = d.receta || 'webhook';
  opcionesEstacion(d.estacion);
  pintarCampos(d.credenciales || {});
  document.getElementById('f-intervalo').value = d.intervalo_min || 0;
  document.getElementById('f-reintentos').value = d.reintentos === undefined ? 2 : d.reintentos;
  document.getElementById('f-activo').checked = !!d.activo;
  document.getElementById('b-cancelar').style.display = '';
  window.scrollTo(0, 0);
}

document.getElementById('b-cancelar').onclick = function () {
  EDITANDO = null;
  document.getElementById('titulo-form').textContent = 'Destino nuevo';
  document.getElementById('f-nombre').value = '';
  document.getElementById('f-activo').checked = false;
  document.getElementById('b-cancelar').style.display = 'none';
  pintarCampos();
};

document.getElementById('b-guardar').onclick = function () {
  var cred = {}, ins = document.querySelectorAll('#f-credenciales input');
  for (var i = 0; i < ins.length; i++) cred[ins[i].dataset.cred] = ins[i].value;
  var d = {
    nombre: document.getElementById('f-nombre').value.trim(),
    tipo: 'receta',
    receta: document.getElementById('f-receta').value,
    estacion: document.getElementById('f-estacion').value,
    credenciales: cred,
    intervalo_min: Number(document.getElementById('f-intervalo').value) || 0,
    reintentos: Number(document.getElementById('f-reintentos').value) || 0,
    activo: document.getElementById('f-activo').checked
  };
  if (!d.nombre) { alert('Ponele un nombre al destino.'); return; }
  mandar('/api/destino', { anterior: EDITANDO, destino: d }).then(function (r) {
    if (r.cuerpo.error) { alert(r.cuerpo.error); return; }
    if (r.cuerpo.faltan && r.cuerpo.faltan.length) alert('Guardado. Le faltan: ' + r.cuerpo.faltan.join(', '));
    document.getElementById('b-cancelar').onclick();
    cargarConfig();
  });
};

document.getElementById('b-usuario').onclick = function () {
  document.getElementById('u-error').textContent = '';
  mandar('/api/usuarios', {
    usuario: document.getElementById('u-nombre').value.trim(),
    clave: document.getElementById('u-clave').value,
    rol: document.getElementById('u-rol').value
  }).then(function (r) {
    if (r.cuerpo.error) { document.getElementById('u-error').textContent = r.cuerpo.error; return; }
    document.getElementById('u-nombre').value = '';
    document.getElementById('u-clave').value = '';
    cargarConfig();
  });
};

document.getElementById('b-ajustes').onclick = function () {
  mandar('/api/config', {
    mqtt: {
      host: document.getElementById('m-host').value.trim(),
      puerto: Number(document.getElementById('m-puerto').value) || 1883,
      usuario: document.getElementById('m-usuario').value.trim(),
      clave: document.getElementById('m-clave').value,
      prefijo: document.getElementById('m-prefijo').value.trim() || 'homeassistant'
    },
    nodo: {
      nombre: document.getElementById('a-nombre').value.trim(),
      raiz: document.getElementById('a-raiz').value.trim() || 'estacion'
    }
  }).then(function (r) {
    document.getElementById('m-clave').value = '';
    alert(r.cuerpo.error ? r.cuerpo.error : 'Guardado. Los cambios de MQTT se aplican al reiniciar el contenedor.');
    cargarConfig();
  });
};

var redibujo = null;
window.addEventListener('resize', function () {
  clearTimeout(redibujo);
  redibujo = setTimeout(function () {
    if (DETALLE) dibujar(DETALLE.historial || []);
  }, 150);
});

function arrancarPanel () {
  if (arrancarPanel.hecho) return;
  arrancarPanel.hecho = true;
  cargarRecetas().then(cargarConfig);
  refrescar();
  setInterval(refrescar, 5000);
}

compuertas();
</script>
</body>
</html>`
