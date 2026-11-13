// Escribe assets/*.svg (claro y oscuro) y README.md desde un solo registro.
// `node scripts/gen.mjs` los reescribe; `--check` falla si alguno quedó viejo.
//
// GitHub muestra los SVG como <img>: no cargan fuentes externas, así que cada
// texto se contornea con harfbuzz (Spline Sans variable, OFL, en scripts/fonts).
// Los valores son los de Punto (design/punto/tokens.json en hc-monorepo).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import hbInit from "harfbuzzjs";

const hb = await hbInit;
const raiz = new URL("../", import.meta.url);
const comprobar = process.argv.includes("--check");

const temas = {
  light: { texto: "#141516", texto2: "#5C5F64", linea: "rgba(20,21,22,0.12)", linea2: "rgba(20,21,22,0.38)", acento: "#1F8A4C", hoja: "#FFFFFF" },
  dark: { texto: "#ECECEA", texto2: "#A3A5A8", linea: "rgba(236,236,234,0.14)", linea2: "rgba(236,236,234,0.42)", acento: "#7BE495", hoja: "#17181B" },
};
const curva = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const ANCHO = 1200;

function cargar(archivo) {
  const face = hb.createFace(hb.createBlob(readFileSync(new URL(`fonts/${archivo}`, import.meta.url))), 0);
  return { face, upem: face.upem };
}
const sans = cargar("SplineSans.ttf");
const mono = cargar("SplineSansMono.ttf");

const display = { fuente: sans, peso: 640, tracking: -0.02 };
const marca = { fuente: sans, peso: 650, tracking: -0.02 };
const datos = { fuente: mono, peso: 400, tracking: 0.01 };

/** Compone una línea y devuelve sus glifos en px, con el avance de cada uno. */
function componer(texto, tamano, { fuente, peso, tracking }) {
  const font = hb.createFont(fuente.face);
  font.setVariations({ wght: peso });
  const buffer = hb.createBuffer();
  buffer.addText(texto);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);
  const escala = tamano / fuente.upem;
  const paso = tracking * tamano;
  let x = 0;
  const glifos = buffer.json().map((g) => {
    const glifo = { d: font.glyphToPath(g.g), x: x + g.dx * escala, escala };
    x += g.ax * escala + paso;
    return glifo;
  });
  return { glifos, ancho: x - paso };
}

const n = (v) => +v.toFixed(2);

/** Los glifos como <path>, con la línea base en (x, y). */
function trazar(glifos, x, y, atributos = () => "") {
  return glifos
    .map((g, i) => (g.d ? `<path${atributos(i)} transform="translate(${n(x + g.x)} ${n(y)}) scale(${n(g.escala * 1e4) / 1e4} ${-n(g.escala * 1e4) / 1e4})" d="${g.d}"/>` : ""))
    .join("");
}

/** Un título de Punto: el texto en `texto` y el punto final en `acento`. */
function titulo(texto, tamano, x, y, t, { clase = "", estilo = display } = {}) {
  const linea = componer(`${texto}.`, tamano, estilo);
  const punto = linea.glifos.length - 1;
  const cuerpo = trazar(linea.glifos.slice(0, punto), x, y, (i) => ` style="--i:${i}"`);
  const final = trazar(linea.glifos.slice(punto), x, y);
  return { svg: `<g fill="${t.texto}" class="${clase}">${cuerpo}</g><g class="punto" fill="${t.acento}">${final}</g>`, ancho: linea.ancho };
}

const quieto = "@media (prefers-reduced-motion: reduce) { *, *::before { animation: none !important; } }";

function svg(ancho, alto, etiqueta, estilo, cuerpo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${etiqueta}"><style>${estilo} ${quieto}</style>${cuerpo}</svg>\n`;
}

// El campo del hero: el glifo de la mano en puntos (la máscara `web` de @hc/og)
// sobre una retícula tenue que se apaga hacia el título.
const mano = [
  "....####.....................",
  "...####......................",
  "..####...##..................",
  "..###..####..................",
  ".###..####...................",
  "###..####....................",
  "###..###.....................",
  "....###......###.............",
  "....###.....########.........",
  "....##.....#############.....",
  ".........#####.###.######....",
  "........######.###.###.###...",
  "........###.##..##..##.###...",
  "........###.##..##..##..##...",
  "........###.###.###.###.##...",
  ".........##..##.###.###.###..",
  ".........##..##.........###..",
  ".........###.##..........##..",
  ".........###.............##..",
  ".......#####.............##..",
  ".......######............##..",
  "......###.###...........###..",
  "......###...#...........##...",
  ".......####............###...",
  "........####..........###....",
  ".........#####....######.....",
  "...........############......",
  ".............#######.........",
  ".............................",
];

function campo({ alto, lado, desde, t }) {
  const puntos = mano.length;
  const paso = lado / (puntos - 1);
  const x0 = ANCHO - 12 - lado;
  const y0 = (alto - lado) / 2;
  const esquina = puntos - 1;
  let rejilla = "";
  let glifo = "";
  for (let f = -3; f < puntos + 3; f++) {
    for (let k = -Math.ceil(x0 / paso); k < puntos + 4; k++) {
      const x = x0 + k * paso;
      const y = y0 + f * paso;
      if (x < -5 || x > ANCHO + 5 || y < -5 || y > alto + 5) continue;
      if (Math.hypot(k - esquina, f - esquina) < 1.8) continue;
      if (f >= 0 && f < puntos && k >= 0 && k < puntos && mano[f][k] === "#") {
        glifo += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(paso * 0.36)}"/>`;
        continue;
      }
      const borde = Math.min(1, Math.max(0, (x - desde) / 160));
      if (borde < 0.05) continue;
      rejilla += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(paso * 0.1 * (0.4 + 0.6 * borde))}"/>`;
    }
  }
  return {
    svg: `<g fill="${t.linea2}" class="rejilla">${rejilla}</g><g fill="${t.texto}" class="mano">${glifo}</g><circle class="estalla" cx="${n(x0 + esquina * paso)}" cy="${n(y0 + esquina * paso)}" r="${n(paso * 0.75)}" fill="${t.acento}"/>`,
  };
}

// Entrar en tres pasos (movimiento.md): el nombre letra a letra cada 40 ms,
// los datos en mono a los 700 ms y el punto del campo a los 900 ms. Después
// la mano saluda una vez.
function hero(t, contenido) {
  const alto = 400;
  const x = 0;
  const saludo = componer(contenido.saludo, 28, datos);
  const nombre = titulo(contenido.nombre, 112, x, 258, t, { clase: "nombre" });
  const dato = componer(contenido.dato, 28, datos);
  const estilo = `
    .nombre path, .punto path { animation: subir 600ms ${curva} both; animation-delay: calc(var(--i, 11) * 40ms); }
    .datos { animation: subir 600ms ${curva} 700ms both; }
    .rejilla { animation: aparecer 900ms ${curva} both; }
    .estalla { transform-box: fill-box; transform-origin: center; animation: estallar 600ms ${curva} 900ms both; }
    .mano { transform-box: fill-box; transform-origin: 40% 100%; animation: saludar 1600ms ${curva} 1300ms both; }
    @keyframes subir { from { opacity: 0; transform: translateY(18px); } }
    @keyframes aparecer { from { opacity: 0; } }
    @keyframes estallar { from { opacity: 0; transform: scale(0.2); } 60% { transform: scale(1.12); } }
    @keyframes saludar { 20% { transform: rotate(-9deg); } 45% { transform: rotate(7deg); } 70% { transform: rotate(-4deg); } }`;
  const cuerpo =
    campo({ alto, lado: 352, desde: x + nombre.ancho + 32, t }).svg +
    `<g fill="${t.texto2}" class="datos">${trazar(saludo.glifos, x, 128)}</g>` +
    nombre.svg +
    `<g fill="${t.texto2}" class="datos">${trazar(dato.glifos, x, 330)}</g>`;
  return svg(ANCHO, alto, `${contenido.saludo} ${contenido.nombre}.`, estilo, cuerpo);
}

function seccion(texto, { late = false } = {}) {
  return (t) => {
    const { svg: cuerpo, ancho } = titulo(texto, 56, 2, 64, t);
    const estilo = late
      ? `.punto { transform-box: fill-box; transform-origin: center; animation: latir 5s ${curva} infinite; } @keyframes latir { 50% { transform: scale(1.12); opacity: 0.85; } }`
      : "";
    return svg(Math.ceil(ancho + 6), 88, `${texto}.`, estilo, cuerpo);
  };
}

// Una lámina de proyecto: el dibujo de trazo del portafolio (scripts/arte.json,
// exportado de apps/web/src/components/arte) que se traza al cargar, y abajo el
// wordmark de la app con su punto.
const arte = JSON.parse(readFileSync(new URL("arte.json", import.meta.url), "utf8"));

function lamina(app) {
  return (t) => {
    const nombre = titulo(app.marca, 40, 2, 376, t, { estilo: marca });
    const dibujo = arte[app.arte].replace('stroke="currentColor"', `stroke="${t.texto}"`);
    const orden = Array.from({ length: 8 }, (_, i) => `.dibujo > g > :nth-child(${i === 7 ? "n + 8" : i + 1}) { --i: ${i}; }`).join(" ");
    const estilo = `
      ${orden}
      .dibujo :is(path, rect, ellipse, circle) { stroke-dasharray: 1; animation: trazar 1200ms ${curva} both; animation-delay: calc(var(--i, 0) * 80ms + 200ms); }
      .dibujo .pt-arte-acento, .dibujo .pt-arte-acento * { stroke-dasharray: none; animation: none; }
      .dibujo .pt-arte-acento { fill: ${t.acento}; stroke: ${t.acento}; transform-box: fill-box; transform-origin: center; animation: acento 600ms ${curva} 1400ms both; }
      @keyframes trazar { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
      @keyframes acento { from { opacity: 0; transform: translateY(8px); } }`;
    const cuerpo =
      `<rect x="0.5" y="0.5" width="479" height="319" rx="12" fill="${t.hoja}" stroke="${t.linea}"/>` +
      `<g class="dibujo">${dibujo}</g>` +
      nombre.svg;
    return svg(480, 392, `${app.marca}. ${app.texto}`, estilo, cuerpo);
  };
}

// La Firma: «hugocastro.» pasa a «hugocastro.dev» y vuelve con la transición
// «caer». «dev» queda 6 s y hay 12 s de pausa; el punto late en cada cambio y
// el ancho no cambia. Con movimiento reducido queda «hugocastro.dev» fija.
function firma(t) {
  const tamano = 44;
  const linea = componer("hugocastro.dev", tamano, marca);
  const y = 50;
  const alto = 68;
  const ancho = Math.ceil(linea.ancho + 4);
  const ciclo = 12 + 0.6 + 6 + 0.45;
  const p = (s) => `${n((s / ciclo) * 100)}%`;
  const estilo = `
    .dev { animation: caer ${ciclo}s linear -10s infinite; }
    .punto { transform-box: fill-box; transform-origin: center; animation: latir ${ciclo}s linear -10s infinite; }
    @keyframes caer {
      0%, ${p(12)} { opacity: 0; transform: translateY(-0.9em); animation-timing-function: cubic-bezier(0.34, 1.4, 0.64, 1); }
      ${p(12.6)}, ${p(18.6)} { opacity: 1; transform: none; animation-timing-function: ${curva}; }
      100% { opacity: 0; transform: translateY(0.9em); }
    }
    @keyframes latir {
      0%, ${p(11.8)}, ${p(12.6)}, ${p(18.4)}, ${p(19)}, 100% { transform: none; opacity: 1; animation-timing-function: ${curva}; }
      ${p(12.2)}, ${p(18.75)} { transform: scale(1.12); opacity: 0.85; }
    }
    @media (prefers-reduced-motion: reduce) { .dev { opacity: 1; transform: none; } }`;
  const g = linea.glifos;
  const cuerpo =
    `<defs><clipPath id="marco"><rect x="0" y="0" width="${ancho}" height="${alto}"/></clipPath></defs>` +
    `<g fill="${t.texto}">${trazar(g.slice(0, 10), 2, y)}</g>` +
    `<g class="punto" fill="${t.acento}">${trazar(g.slice(10, 11), 2, y)}</g>` +
    `<g clip-path="url(#marco)"><g class="dev" fill="${t.texto}" style="font-size:${tamano}px">${trazar(g.slice(11), 2, y)}</g></g>`;
  return svg(ancho, alto, "hugocastro.dev", estilo, cuerpo);
}

// El contenido del README. El copy sale del portafolio (apps/web/content/en).
const contenido = {
  saludo: "Hey! I'm",
  nombre: "Hugo Castro",
  dato: "Software Engineer at Buk · Talca, Chile",
  bio: "I build web apps with Next.js, Convex and TypeScript.",
  apps: [
    { marca: "go", arte: "lets-go", url: "https://go.hugocastro.dev", texto: "A URL shortener and public link pages." },
    { marca: "postal", arte: "postal", url: "https://postal.hugocastro.dev", texto: "Files encrypted in the browser, with links that expire." },
    { marca: "gather", arte: "gather", url: "https://gather.hugocastro.dev", texto: "Video calls with rooms and guests who need no account." },
    { marca: "interact", arte: "interact", url: "https://interact.hugocastro.dev", texto: "Live questions and surveys for presentations, with a join code." },
    { marca: "agenda", arte: "agenda", url: "https://agenda.hugocastro.dev", texto: "My own Calendly: meetings booked into a free slot." },
    { marca: "me", arte: "me", url: "https://me.hugocastro.dev", texto: "My resume as data, in Spanish and English, exported to PDF." },
  ],
  repos: [
    { nombre: "round-robin-rmpe", texto: "round-robin pull request reviewer assignment for teams, with availability tracking and Google Chat notifications.", enlace: ["Demo", "https://round-robin-rmpe-demo.vercel.app/"] },
    { nombre: "que-maldito-modelo-uso", texto: "which AI model to use for coding, in three answers, from public benchmarks and real cost per task.", enlace: ["qmmu.hugocastro.dev", "https://qmmu.hugocastro.dev"] },
    { nombre: "mlh-code-check", texto: "AI code review for GitHub repositories, driven by rubrics you define." },
    { nombre: "mlh-fellowship-toolbox", texto: "operations cockpit for MLH Fellowship pod leaders." },
    { nombre: "directorio-alumni-icc", texto: "private directory connecting verified students and alumni." },
    { nombre: "two-truths-one-lie", texto: "real-time multiplayer Two Truths and a Lie party game." },
  ],
};

/** Cada pieza del README: su archivo en assets/ y cómo se dibuja en un tema. */
const piezas = {
  hero: (t) => hero(t, contenido),
  "things-i-build": seccion("Things I build"),
  "open-source": seccion("Open source"),
  "lets-talk": seccion("Let's talk", { late: true }),
  firma,
  ...Object.fromEntries(contenido.apps.map((app) => [`app-${app.marca}`, lamina(app)])),
};

const imagen = (pieza, alt, atributos = 'width="100%"') =>
  `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/${pieza}.dark.svg"><img src="assets/${pieza}.light.svg" alt="${alt}" ${atributos}></picture>`;

const alto = 'height="60"';

const readme = `<!-- Generado por scripts/gen.mjs: edita el contenido ahí y corre \`pnpm gen\`. -->

${imagen("hero", `${contenido.saludo} ${contenido.nombre}. ${contenido.dato}.`)}

${contenido.bio}

<br>

${imagen("things-i-build", "Things I build.", alto)}

<p>
${contenido.apps.map((app) => `<a href="${app.url}">${imagen(`app-${app.marca}`, `${app.marca}. ${app.texto}`, 'width="49%"')}</a>`).join("\n")}
</p>

<br>

${imagen("open-source", "Open source.", alto)}

${contenido.repos
  .map((r) => `- **[${r.nombre}](https://github.com/HugoCL/${r.nombre})**: ${r.texto}${r.enlace ? ` [${r.enlace[0]}](${r.enlace[1]})` : ""}`)
  .join("\n")}

<br>

${imagen("lets-talk", "Let's talk.", alto)}

[hugocastro.dev](https://hugocastro.dev) · [LinkedIn](https://www.linkedin.com/in/hugocastrocl)

<br>

<a href="https://hugocastro.dev">${imagen("firma", "hugocastro.dev", 'height="48"')}</a>
`;

const archivos = { "README.md": readme };
for (const [pieza, dibujar] of Object.entries(piezas)) {
  for (const [tema, t] of Object.entries(temas)) archivos[`assets/${pieza}.${tema}.svg`] = dibujar(t);
}

const viejos = [];
mkdirSync(new URL("assets/", raiz), { recursive: true });
for (const [ruta, texto] of Object.entries(archivos)) {
  const url = new URL(ruta, raiz);
  let actual = null;
  try {
    actual = readFileSync(url, "utf8");
  } catch {}
  if (actual === texto) continue;
  if (comprobar) viejos.push(ruta);
  else writeFileSync(url, texto);
}
if (viejos.length) {
  console.error(`Quedaron viejos; corre \`pnpm gen\`:\n${viejos.join("\n")}`);
  process.exit(1);
}
console.log(comprobar ? "Todo al día." : `${Object.keys(archivos).length} archivos al día.`);
