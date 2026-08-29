/* Cuadro - protector de pantalla animado para el panel del pasillo.
 *
 * El panel es un Samsung QB24C-T usado como MONITOR de una mini PC con Windows 11.
 * El dashboard corre en Chrome en modo kiosko, NO en el Tizen del panel.
 *
 * Aparece tras N segundos sin que nadie toque la pantalla y se va al primer toque.
 * No usa browser_mod ni automatizaciones: vive entero en el navegador.
 *
 * Rota entre varias obras generativas con fundido entre una y otra. Todas estan
 * siempre en movimiento: un cuadro fijo en un panel que pasa horas encendido es
 * justo la receta para la retencion de imagen.
 *
 * Uso:
 *   type: custom:cuadro-card
 *   inactividad: 120        # segundos sin tocar antes de aparecer
 *   duracion_obra: 180      # segundos que dura cada obra antes de cambiar
 *   particulas: 260
 *   solo_vertical: true     # respaldo; el criterio real es ?cuadro=1
 *
 * Forzado por URL:  ?cuadro=1 lo activa y lo deja guardado  ·  ?cuadro=0 lo apaga
 *
 * OJO: al modificar este archivo hay que subirle la version al recurso de
 * Lovelace (/local/cuadro.js?v=N) o los navegadores siguen con el viejo.
 */

const PALETAS = {
  noche:     { fondo: '#05070f', colores: ['#1b2f6b', '#2b4a8f', '#4a6fb5', '#8aa9d6'] },
  madrugada: { fondo: '#0d0a12', colores: ['#7a3f5d', '#c06c7a', '#e0a08c', '#f2d0b0'] },
  dia:       { fondo: '#07100f', colores: ['#12564f', '#1f8f7a', '#5fbfa3', '#cfe3cf'] },
  tarde:     { fondo: '#100a08', colores: ['#8f3b1f', '#c8642c', '#e0a24c', '#f2cf8a'] },
};

function paletaDeAhora() {
  const h = new Date().getHours();
  if (h >= 22 || h < 6) return PALETAS.noche;
  if (h < 9) return PALETAS.madrugada;
  if (h < 18) return PALETAS.dia;
  return PALETAS.tarde;
}

/* Ruido de valor con interpolacion suave. Barato y suficiente: no hace falta
 * Perlin real para que el campo se vea organico. */
function hash(x, y, semilla) {
  const n = Math.sin(x * 127.1 + y * 311.7 + semilla * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
function suave(t) { return t * t * (3 - 2 * t); }

function ruido(x, y, semilla) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = suave(x - xi), v = suave(y - yi);
  const a = hash(xi, yi, semilla), b = hash(xi + 1, yi, semilla);
  const c = hash(xi, yi + 1, semilla), d = hash(xi + 1, yi + 1, semilla);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function mezclar(a, b, k) {
  const p = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const x = p(a), y = p(b);
  const h = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return '#' + h(x[0] + (y[0] - x[0]) * k) + h(x[1] + (y[1] - x[1]) * k) + h(x[2] + (y[2] - x[2]) * k);
}

function conAlfa(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

/* ------------------------------------------------------------------ obras --
 * Cada obra expone iniciar() -> estado, y paso(estado). Comparten el ctx y la
 * paleta del momento. La rotacion y el fundido los maneja la tarjeta.
 */

const OBRAS = [
  {
    nombre: 'flujo',
    /* Pinceladas largas que siguen un campo de ruido. El color NO se sortea por
     * particula: se toma de un ruido de baja frecuencia segun donde esta, asi se
     * forman zonas de un mismo tono y hay composicion en vez de confeti. */
    iniciar(ctx, W, H, pal, n) {
      const g = ctx.createLinearGradient(0, 0, W * 0.35, H);
      g.addColorStop(0, mezclar(pal.fondo, pal.colores[0], 0.22));
      g.addColorStop(0.55, pal.fondo);
      g.addColorStop(1, mezclar(pal.fondo, pal.colores[1], 0.14));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const nueva = () => ({
        x: Math.random() * W, y: Math.random() * H,
        ancho: 10 + Math.random() * Math.random() * 46,
        v: 0.8 + Math.random() * 2.2,
        alfa: 0.010 + Math.random() * 0.026,
        vida: 200 + Math.random() * 700,
      });
      const parts = [];
      const cuantas = Math.max(24, Math.round(n / 4));
      for (let i = 0; i < cuantas; i++) parts.push(nueva());
      return { parts, nueva, t: 0, sem: Math.random() * 1000, semColor: Math.random() * 1000 };
    },
    paso(ctx, e, W, H, pal) {
      e.t += 0.0009;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.013;
      ctx.fillStyle = pal.fondo;
      ctx.fillRect(0, 0, W, H);
      ctx.lineCap = 'round';

      for (let i = 0; i < e.parts.length; i++) {
        const p = e.parts[i];
        const ang = ruido(p.x * 0.0021, p.y * 0.0021 + e.t, e.sem) * Math.PI * 2.6;
        const nx = p.x + Math.cos(ang) * p.v, ny = p.y + Math.sin(ang) * p.v;
        const c = Math.pow(ruido(p.x * 0.0016, p.y * 0.0016, e.semColor), 1.5);
        ctx.globalAlpha = p.alfa;
        ctx.strokeStyle = pal.colores[Math.min(pal.colores.length - 1, (c * pal.colores.length) | 0)];
        ctx.lineWidth = p.ancho;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        p.x = nx; p.y = ny; p.vida--;
        if (p.vida <= 0 || nx < -20 || ny < -20 || nx > W + 20 || ny > H + 20) e.parts[i] = e.nueva();
      }
    },
  },

  {
    nombre: 'nebulosa',
    /* Manchas radiales grandes que se cruzan y respiran. Mezcla aditiva suave:
     * donde se superponen aparece un tercer color, como veladuras de pintura. */
    iniciar(ctx, W, H, pal) {
      ctx.fillStyle = pal.fondo;
      ctx.fillRect(0, 0, W, H);
      const manchas = [];
      for (let i = 0; i < 7; i++) {
        manchas.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.min(W, H) * (0.22 + Math.random() * 0.34),
          c: pal.colores[(Math.random() * pal.colores.length) | 0],
          vx: (Math.random() - 0.5) * 0.16, vy: (Math.random() - 0.5) * 0.16,
          fase: Math.random() * Math.PI * 2,
        });
      }
      return { manchas, t: 0 };
    },
    paso(ctx, e, W, H, pal) {
      e.t += 0.004;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.045;
      ctx.fillStyle = pal.fondo;
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = 'lighter';
      for (const m of e.manchas) {
        m.x += m.vx; m.y += m.vy;
        if (m.x < -m.r || m.x > W + m.r) m.vx *= -1;
        if (m.y < -m.r || m.y > H + m.r) m.vy *= -1;
        const r = m.r * (0.86 + 0.14 * Math.sin(e.t + m.fase));
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
        g.addColorStop(0, conAlfa(m.c, 0.055));
        g.addColorStop(0.5, conAlfa(m.c, 0.018));
        g.addColorStop(1, conAlfa(m.c, 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },

  {
    nombre: 'estratos',
    /* Bandas horizontales con el borde deformado por ruido, que se desplazan muy
     * despacio. Es la mas quieta de las tres: funciona bien de noche. */
    iniciar(ctx, W, H, pal) {
      ctx.fillStyle = pal.fondo;
      ctx.fillRect(0, 0, W, H);
      const bandas = [];
      const n = 9;
      for (let i = 0; i < n; i++) {
        bandas.push({
          y: (H / n) * i + Math.random() * 20,
          alto: H / n * (1.1 + Math.random() * 1.5),
          c: pal.colores[(Math.random() * pal.colores.length) | 0],
          amp: 12 + Math.random() * 46,
          vel: 0.00018 + Math.random() * 0.0004,
          sem: Math.random() * 1000,
          alfa: 0.10 + Math.random() * 0.16,
        });
      }
      return { bandas, t: 0 };
    },
    paso(ctx, e, W, H, pal) {
      e.t += 1;
      /* Repintado completo, NO velo acumulativo: con mezcla aditiva las bandas
       * se saturaban hasta quedar planas y con borde duro, como una bandera. */
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.fondo;
      ctx.fillRect(0, 0, W, H);

      const paso = 14;
      for (const b of e.bandas) {
        /* Degrade vertical por banda: el borde se disuelve en vez de cortar. */
        const g = ctx.createLinearGradient(0, b.y - b.amp, 0, b.y + b.alto + b.amp);
        g.addColorStop(0, conAlfa(b.c, 0));
        g.addColorStop(0.32, conAlfa(b.c, b.alfa));
        g.addColorStop(0.68, conAlfa(b.c, b.alfa));
        g.addColorStop(1, conAlfa(b.c, 0));
        ctx.fillStyle = g;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(0, b.y);
        for (let x = 0; x <= W; x += paso) {
          const d = ruido(x * 0.0026, e.t * b.vel + b.sem, b.sem) - 0.5;
          ctx.lineTo(x, b.y + d * b.amp);
        }
        for (let x = W; x >= 0; x -= paso) {
          const d = ruido(x * 0.0026, e.t * b.vel + b.sem + 33, b.sem) - 0.5;
          ctx.lineTo(x, b.y + b.alto + d * b.amp);
        }
        ctx.closePath();
        ctx.fill();
      }
    },
  },
];


/* --------------------------------------------------------------- shaders --
 * La transicion entre cuadros no es un fundido: las dos imagenes se desplazan
 * con ruido en direcciones opuestas y se disuelven con un borde organico. El
 * pico de deformacion cae en el medio (sin(p*PI)), asi arranca y termina con la
 * imagen limpia. El shader hace ademas el zoom lento via las uv, sin tocar el DOM.
 */
const VS = [
  'attribute vec2 pos;',
  'varying vec2 vUv;',
  'void main(){ vUv = pos * 0.5 + 0.5; gl_Position = vec4(pos, 0.0, 1.0); }',
].join('\n');

const FS = [
  'precision mediump float;',
  'uniform sampler2D uA, uB;',
  'uniform float uP, uT, uDef;',
  'uniform vec4 uKA, uKB;',
  'varying vec2 vUv;',
  'float hash(vec2 v){ return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }',
  'float ruido(vec2 v){',
  '  vec2 i = floor(v), f = fract(v);',
  '  vec2 u = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x),',
  '             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);',
  '}',
  'vec2 encuadrar(vec2 uv, vec4 k){',
  '  vec2 c = uv - 0.5;',
  '  if (k.w > 1.0) { c.x *= k.w; } else { c.y /= max(k.w, 0.0001); }',
  '  return c / k.z + 0.5 + k.xy;',
  '}',
  'void main(){',
  '  float w = sin(uP * 3.14159265) * uDef;',
  '  float n1 = ruido(vUv * 3.4 + uT * 0.05);',
  '  float n2 = ruido(vUv * 3.4 - uT * 0.04 + 17.0);',
  '  float n3 = ruido(vUv * 2.1 + 55.0);',
  '  vec2 d = (vec2(n1, n2) - 0.5) * w;',
  '  vec4 a = texture2D(uA, encuadrar(clamp(vUv + d, 0.0, 1.0), uKA));',
  '  vec4 b = texture2D(uB, encuadrar(clamp(vUv - d, 0.0, 1.0), uKB));',
  '  float m = smoothstep(0.0, 1.0, uP * 1.6 - 0.3 + (n3 - 0.5) * 0.55 * sin(uP * 3.14159265));',
  '  gl_FragColor = mix(a, b, clamp(m, 0.0, 1.0));',
  '}',
].join('\n');

function compilar(gl, tipo, src) {
  const sh = gl.createShader(tipo);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('cuadro: shader no compila -', gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

const EVENTOS = ['pointerdown', 'touchstart', 'keydown', 'wheel'];

class CuadroCard extends HTMLElement {
  setConfig(config) {
    this._cfg = {
      inactividad: config.inactividad != null ? config.inactividad : 120,
      duracion_obra: config.duracion_obra != null ? config.duracion_obra : 180,
      transicion: config.transicion != null ? config.transicion : 7,
      solo_vertical: config.solo_vertical !== false,
      particulas: config.particulas != null ? config.particulas : 260,
      entidad_temp: config.entidad_temp || 'sensor.hue_motion_sensor_1_temperatura',
      carpeta: config.carpeta || '/local/cuadros',
    };
    if (!this._montado) this._montar();
  }

  set hass(hass) { this._hass = hass; }
  getCardSize() { return 0; }

  _aplica() {
    /* El parametro ?cuadro=1 se guarda en localStorage la primera vez y despues
     * manda eso. Hace falta porque HA es una SPA: al navegar a otra vista la URL
     * pierde el query string, y el acceso directo del kiosko solo lo pone al
     * arrancar. Guardado queda pegado al navegador de la mini PC para siempre. */
    try {
      const q = new URLSearchParams(window.location.search);
      const v = q.get('cuadro');
      if (v === '1') { localStorage.setItem('cuadro_activo', '1'); return true; }
      if (v === '0') { localStorage.removeItem('cuadro_activo'); return false; }
      if (localStorage.getItem('cuadro_activo') === '1') return true;
    } catch (e) { /* sin localStorage: se sigue con la orientacion */ }
    if (!this._cfg.solo_vertical) return true;
    return window.innerHeight > window.innerWidth && window.innerWidth <= 1200;
  }

  _montar() {
    this._montado = true;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = [
      '<style>',
      ':host { display: contents; }',
      '.lienzo { position: fixed; inset: 0; z-index: 99999; opacity: 0;',
      '  pointer-events: none; transition: opacity 1.6s ease; background: #000; }',
      '.lienzo.visible { opacity: 1; pointer-events: auto; }',
      'canvas { display: block; width: 100%; height: 100%;',
      '  transition: opacity 2s ease; opacity: 1; }',
      '.reloj { position: absolute; left: 0; top: 0; will-change: transform;',
      '  transition: transform 1s linear; }',
      '.velo { position: absolute; left: -16vmin; top: -14vmin; width: 78vmin;',
      '  height: 46vmin; pointer-events: none; background: radial-gradient(',
      '  ellipse at 32% 58%, rgba(0,0,0,.74) 0%, rgba(0,0,0,.42) 42%,',
      '  rgba(0,0,0,0) 72%); }',
      '.datos { position: relative; line-height: 1;',
      '  color: rgba(255,255,255,.95); text-shadow: 0 1px 10px rgba(0,0,0,.55);',
      '  font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif; }',
      '.hora { font-size: 17vmin; font-weight: 200; letter-spacing: -.02em;',
      '  font-variant-numeric: tabular-nums; }',
      '.pie { margin-top: 2.2vmin; font-size: 3.9vmin; opacity: .78; letter-spacing: .04em; }',
      '</style>',
      '<div class="lienzo"><canvas></canvas>',
      '<div class="reloj"><div class="velo"></div>',
      '<div class="datos"><div class="hora">--:--</div><div class="pie"></div></div>',
      '</div></div>',
    ].join('');

    this._caja = this.shadowRoot.querySelector('.lienzo');
    this._canvas = this.shadowRoot.querySelector('canvas');
    this._hora = this.shadowRoot.querySelector('.hora');
    this._pie = this.shadowRoot.querySelector('.pie');
    this._bloque = this.shadowRoot.querySelector('.reloj');
    this._obra = (Math.random() * OBRAS.length) | 0;

    this._despertar = this._despertar.bind(this);
    for (const ev of EVENTOS) window.addEventListener(ev, this._despertar, { passive: true });

    /* 28/08/2026 - Al minimizar Chrome, innerWidth e innerHeight pasan a 0 y _aplica()
     * da falso. Si el temporizador pendiente dispara en ese momento, _dormir() sale por
     * su `return` y NADIE REPROGRAMA: al maximizar, el protector no vuelve nunca hasta
     * que alguien toque la pantalla, porque EVENTOS solo escucha pointerdown, touchstart,
     * keydown y wheel.
     *
     * Se agrega un revisor aparte: cuando la ventana cambia de tamano o vuelve a estar
     * visible, se reprograma la espera. NO usa _despertar porque eso ademas cerraria el
     * cuadro si estuviera arriba, y redimensionar no es interactuar con el panel. */
    this._revisar = () => { if (!this._activo) this._reiniciarEspera(); };
    window.addEventListener('resize', this._revisar, { passive: true });
    document.addEventListener('visibilitychange', this._revisar, { passive: true });
    this._reloj = setInterval(() => this._tic(), 1000);
    this._reiniciarEspera();
  }

  disconnectedCallback() {
    clearInterval(this._reloj);
    clearTimeout(this._espera);
    clearTimeout(this._cambio);
    clearInterval(this._deriva);
    cancelAnimationFrame(this._raf);
    this._scroll(false);
    for (const ev of EVENTOS) window.removeEventListener(ev, this._despertar);
    window.removeEventListener('resize', this._revisar);
    document.removeEventListener('visibilitychange', this._revisar);
  }

  /* Oculta las barras de desplazamiento del dashboard mientras el cuadro esta
   * arriba. Sin esto queda una barra clara al costado, encima de la obra. */
  _scroll(bloquear) {
    const ID = 'cuadro-sin-scroll';
    const previo = document.getElementById(ID);
    if (bloquear) {
      if (previo) return;
      const s = document.createElement('style');
      s.id = ID;
      s.textContent = 'html,body{overflow:hidden !important}' +
        '*::-webkit-scrollbar{width:0 !important;height:0 !important;display:none !important}' +
        '*{scrollbar-width:none !important}';
      document.head.appendChild(s);
    } else if (previo) {
      previo.remove();
    }
  }

  _reiniciarEspera() {
    clearTimeout(this._espera);
    if (!this._aplica()) return;
    this._espera = setTimeout(() => this._dormir(), this._cfg.inactividad * 1000);
  }

  _despertar() {
    if (this._activo) {
      this._activo = false;
      this._caja.classList.remove('visible');
      this._scroll(false);
      clearInterval(this._deriva);
      clearTimeout(this._cambio);
      cancelAnimationFrame(this._raf);
    }
    this._reiniciarEspera();
  }


  /* Deriva continua del reloj. Antes saltaba cada 90 s y entre salto y salto
   * quedaba quieto: texto claro sobre los mismos pixeles minuto y medio, que es
   * justo lo que marca un panel encendido horas.
   *
   * Son dos senos de periodo largo y distinto (no multiplos entre si), asi el
   * recorrido no se repite igual. Se mueve unos 4 px por segundo: no se nota
   * mirandolo, pero en un minuto ya recorrio un cuarto de pantalla. */
  _moverReloj() {
    if (!this._bloque) return;
    const an = window.innerWidth, al = window.innerHeight;
    const t = (Date.now() - (this._relojDesde || 0)) / 1000;
    const x = (0.30 + 0.22 * Math.sin(t / 340 + this._faseX)) * an;
    const y = (0.50 + 0.34 * Math.sin(t / 521 + this._faseY)) * al;
    this._bloque.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }

  _tic() {
    if (!this._activo) return;
    const a = new Date();
    const hh = String(a.getHours()).padStart(2, '0');
    const mm = String(a.getMinutes()).padStart(2, '0');
    this._hora.textContent = hh + ':' + mm;
    const dia = a.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    const st = this._hass && this._hass.states[this._cfg.entidad_temp];
    const t = st && !isNaN(st.state) ? Number(st.state).toFixed(1) + '°' : null;
    this._pie.textContent = t ? dia + '  ·  ' + t : dia;
  }

  _dormir() {
    if (this._activo || !this._aplica()) return;
    this._activo = true;
    this._caja.classList.add('visible');
    this._scroll(true);
    this._relojDesde = Date.now();
    this._faseX = Math.random() * Math.PI * 2;
    this._faseY = Math.random() * Math.PI * 2;
    this._bloque.style.transition = 'none';
    this._moverReloj();
    // Se devuelve la transicion en el proximo cuadro, si no el primer salto se anima
    requestAnimationFrame(() => { if (this._bloque) this._bloque.style.transition = 'transform 1s linear'; });
    this._tic();
    clearInterval(this._deriva);
    this._deriva = setInterval(() => { if (this._activo) this._moverReloj(); }, 1000);
    this._arrancar();
  }

  /* Si hay imagenes en la carpeta se muestran esas; si no, se cae a las obras
   * generativas. El manifiesto es necesario porque un navegador no puede listar
   * un directorio: lo genera scratchpad/lista_cuadros.mjs. */
  async _arrancar() {
    if (this._lista === undefined) {
      try {
        const r = await fetch(this._cfg.carpeta + '/lista.json', { cache: 'no-cache' });
        const j = await r.json();
        this._lista = Array.isArray(j) && j.length ? j : null;
      } catch (e) { this._lista = null; }
    }
    if (!this._activo) return;
    if (this._lista && this._iniciarGL()) { this._galeria(); return; }
    this._lista = null;
    this._pintar();
    this._programarCambio();
  }

  /* Prepara WebGL sobre el mismo canvas. Si el equipo no lo soporta devuelve
   * false y la tarjeta se queda con las obras generativas. */
  _iniciarGL() {
    if (this._gl) return true;
    const cv = this._canvas;
    cv.width = Math.round(window.innerWidth * 0.75);
    cv.height = Math.round(window.innerHeight * 0.75);
    const gl = cv.getContext('webgl', { alpha: false, antialias: false })
            || cv.getContext('experimental-webgl');
    if (!gl) { console.warn('cuadro: sin WebGL, se usan las obras generativas'); return false; }

    const vs = compilar(gl, gl.VERTEX_SHADER, VS);
    const fs = compilar(gl, gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('cuadro: programa no linkea -', gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const nuevaTex = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    };
    this._gl = gl;
    this._tex = [nuevaTex(), nuevaTex()];
    this._rel = [1, 1];
    this._u = {};
    for (const n of ['uA', 'uB', 'uP', 'uT', 'uDef', 'uKA', 'uKB']) {
      this._u[n] = gl.getUniformLocation(prog, n);
    }
    gl.uniform1i(this._u.uA, 0);
    gl.uniform1i(this._u.uB, 1);
    gl.viewport(0, 0, cv.width, cv.height);
    return true;
  }

  _cargar(ruta) {
    return new Promise((ok, err) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => ok(im);
      im.onerror = err;
      im.src = ruta;
    });
  }

  async _subirTextura(ranura, nombre) {
    const gl = this._gl;
    const im = await this._cargar(this._cfg.carpeta + '/' + encodeURIComponent(nombre));
    gl.activeTexture(ranura === 0 ? gl.TEXTURE0 : gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._tex[ranura]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
    // Aspecto de la imagen contra el de la pantalla, para el encuadre "cover".
    this._rel[ranura] = (im.width / im.height) / (this._canvas.width / this._canvas.height);
  }

  /* Bucle de la galeria: muestra A con zoom lento, precarga B, y al final del
   * tiempo hace la transicion deformando una hacia la otra. */
  async _galeria() {
    const gl = this._gl;
    const dur = Math.max(12, this._cfg.duracion_obra);
    const TRANS = Math.max(4, this._cfg.transicion);
    let i = (Math.random() * this._lista.length) | 0;

    try {
      await this._subirTextura(0, this._lista[i]);
    } catch (e) {
      this._lista = null;
      this._pintar();
      this._programarCambio();
      return;
    }

    let t0 = performance.now() / 1000;
    let edadA = t0;              // cuando entro en escena la imagen A
    let edadB = t0;              // idem B; al promoverse B a A se hereda
    let inicioTrans = null;
    let listaB = false;
    let cargando = false;

    const kb = (r, av) => [
      Math.sin(av * 0.11) * 0.03,
      Math.cos(av * 0.09) * 0.03,
      1.07 + Math.sin(av * 0.035) * 0.06,
      r,
    ];

    const bucle = () => {
      if (!this._activo) return;
      const ahora = performance.now() / 1000;
      const t = ahora - t0;

      if (t > dur - TRANS && !listaB && !cargando) {
        cargando = true;
        const j = (i + 1) % this._lista.length;
        this._subirTextura(1, this._lista[j]).then(() => {
          listaB = true;
          cargando = false;
          edadB = performance.now() / 1000;
          inicioTrans = edadB;
        }).catch(() => { cargando = false; });
      }

      const p = inicioTrans == null ? 0 : Math.min(1, (ahora - inicioTrans) / TRANS);

      gl.uniform1f(this._u.uP, p);
      gl.uniform1f(this._u.uT, t);
      gl.uniform1f(this._u.uDef, 0.20);
      gl.uniform4fv(this._u.uKA, kb(this._rel[0], ahora - edadA));
      gl.uniform4fv(this._u.uKB, kb(this._rel[1], ahora - edadB));
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (p >= 1 && !cargando) {
        i = (i + 1) % this._lista.length;
        cargando = true;
        this._subirTextura(0, this._lista[i]).then(() => {
          this._rel[0] = this._rel[1];
          edadA = edadB;           // <- clave: el zoom continua donde estaba
          inicioTrans = null;
          listaB = false;
          cargando = false;
          t0 = performance.now() / 1000;
        }).catch(() => { cargando = false; });
      }
      this._raf = requestAnimationFrame(bucle);
    };
    this._raf = requestAnimationFrame(bucle);
  }

  _pintar() {
    cancelAnimationFrame(this._raf);
    if (this._gl) {
      this._gl = null;
      const n = this._canvas.cloneNode();
      this._canvas.replaceWith(n);
      this._canvas = n;
    }
    this._canvas.style.display = 'block';
    const cv = this._canvas;
    /* Media resolucion escalada por CSS: la mini PC no da para 1080x1920 a
     * 60fps, y el suavizado ayuda al aspecto pictorico. */
    const esc = 0.5;
    cv.width = Math.round(window.innerWidth * esc);
    cv.height = Math.round(window.innerHeight * esc);
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const pal = paletaDeAhora();
    const obra = OBRAS[this._obra];

    const estado = obra.iniciar(ctx, W, H, pal, this._cfg.particulas);

    const paso = () => {
      if (!this._activo) return;
      obra.paso(ctx, estado, W, H, pal);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      this._raf = requestAnimationFrame(paso);
    };
    this._raf = requestAnimationFrame(paso);
  }
}

customElements.define('cuadro-card', CuadroCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'cuadro-card',
  name: 'Cuadro',
  description: 'Protector de pantalla animado con obras abstractas que rotan',
});
console.info('%c CUADRO %c cargado - obras: ' + OBRAS.map((o) => o.nombre).join(', ') + ' ',
  'background:#1f8f7a;color:#fff', 'background:#333;color:#fff');
