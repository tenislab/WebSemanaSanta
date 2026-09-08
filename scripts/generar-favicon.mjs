#!/usr/bin/env node
/**
 * Los iconos de la pestaña y de la pantalla de inicio, sacados de la marca.
 *
 *     node scripts/generar-favicon.mjs
 *
 * POR QUÉ SE GENERAN Y NO SE HACEN A MANO. El icono es lo que más se ve de una
 * marca —está en la pestaña todo el rato— y a la vez lo que nadie mira al
 * cambiar el logotipo. Hecho a mano, se queda con el dibujo viejo durante
 * meses y nadie se da cuenta, porque un icono equivocado se ve pero no molesta.
 * Saliendo de la misma ilustración, no se pueden despegar.
 *
 * DE QUÉ MARCA SALEN. De la REDUCIDA (`src/assets/gobergo-marca-reducida.webp`):
 * la G con su farol, sin la orla. La orla completa a 32 píxeles es una mancha
 * dorada donde no se distingue nada — ver el comentario largo de `Logo.tsx`.
 *
 * Y VAN SOBRE UNA BALDOSA color hueso. La marca es oro y granate: sobre la
 * pestaña oscura de Chrome el oro aguanta, pero el farol se pierde. Con la
 * baldosa detrás se lee igual en pestaña clara y en oscura, que es lo único
 * que importa en 16 píxeles. Las esquinas van redondeadas porque Android y la
 * pantalla de inicio recortan el icono en círculo, y así muerden menos.
 *
 * Esto necesita un navegador (redimensiona con canvas). La prueba que
 * comprueba que `index.html` está al día NO lo necesita: solo mira las
 * etiquetas y que los archivos existan.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = `${dirname(dirname(fileURLToPath(import.meta.url)))}/`

/**
 * DE DÓNDE SALE EL ICONO: del mismo dibujo que la marca.
 *
 * Antes salía de `gobergo-marca-reducida.webp`, que era la marca vieja sin la
 * orla. Ahora la marca es el nazareno y el icono también, para que no haya dos
 * dibujos distintos según dónde mires.
 *
 * Se rasteriza desde el SVG y no desde un PNG: así el de 180 (el de iOS) sale
 * nítido en vez de escalado de uno pequeño.
 */
export const RUTA_MARCA = 'src/assets/nazareno.svg'

/**
 * Los iconos que se escriben. Tres tamaños:
 *
 *   · 32 para la pestaña — y no 16, que en pantallas de mucha densidad se ve
 *     como si estuviera mal enfocado;
 *   · 48 para el escritorio y los accesos directos;
 *   · 180 para la pantalla de inicio de iOS.
 */
export const ICONOS = [
  { ruta: 'public/favicon-32.png', lado: 32 },
  { ruta: 'public/favicon-48.png', lado: 48 },
  { ruta: 'public/apple-touch-icon.png', lado: 180 },
]

/**
 * El hueso de la baldosa, leído de `src/lib/marca.ts`. Copiado aquí se
 * despegaría del resto de la aplicación en cuanto alguien retocara el tono, y
 * el icono es justo lo que nadie vuelve a mirar.
 */
/** El granate del hábito, leído de `src/lib/marca.ts` por lo mismo que el hueso. */
export const GRANATE = (
  readFileSync(`${RAIZ}src/lib/marca.ts`, 'utf8').match(/export const GRANATE = '(#[0-9A-Fa-f]{3,8})'/) ?? []
)[1] ?? '#7B1520'

export const HUESO = (
  readFileSync(`${RAIZ}src/lib/marca.ts`, 'utf8').match(/export const HUESO = '(#[0-9A-Fa-f]{3,8})'/) ?? []
)[1] ?? '#F7F1E4'

/**
 * Las etiquetas del icono, en orden de respaldo: si una falla, la siguiente
 * cubre. Llevan `?v=` para que el navegador no siga enseñando el que tenía
 * guardado: la caché de iconos de Chrome no se va ni recargando con Ctrl+F5, y
 * sin esto un logo nuevo tarda días en verse.
 *
 * La versión sube CUANDO CAMBIA EL DIBUJO. Va en 3 desde que la marca es la
 * ilustración de la G con el farol.
 */
export const VERSION_ICONO = 3
export const ETIQUETAS_ICONO = [
  `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=${VERSION_ICONO}" />`,
  `<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png?v=${VERSION_ICONO}" />`,
  `<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${VERSION_ICONO}" />`,
].join('\n    ')

/** Deja `index.html` con las etiquetas al día. Devuelve el HTML resultante. */
export function generar() {
  const html = readFileSync(`${RAIZ}index.html`, 'utf8')
  /*
   * Se sustituyen TODAS las etiquetas de icono de una vez —desde la primera
   * hasta la última— en vez de una por una. Cambiándolas por separado, al
   * pasar de dos a tres se quedaba una vieja suelta y el navegador se
   * quedaba justo con la que ya no valía.
   */
  return html.replace(
    /<link[^>]*rel="(?:icon|apple-touch-icon)"[\s\S]*?rel="apple-touch-icon"[^>]*\/>/,
    ETIQUETAS_ICONO,
  )
}

/**
 * ============================================================================
 * REDIBUJA LOS PNG DEL ICONO. Necesita un navegador.
 * ============================================================================
 *
 * YA NO USA `playwright`, y no es un capricho: playwright NO ESTÁ en las
 * dependencias del proyecto. O sea que este script llevaba tiempo sin poder
 * ejecutarse — se caía en el `import` antes de hacer nada—. Se descubrió al ir
 * a cambiar el icono.
 *
 * Ahora se llama a Chromium directamente por línea de órdenes, que es lo mismo
 * que hace playwright por debajo y no añade ninguna dependencia. El binario se
 * busca en `CHROMIUM`, y si no, en los sitios de siempre.
 *
 * ----------------------------------------------------------------------------
 * POR QUÉ EL DIBUJO VA ENGORDADO
 * ----------------------------------------------------------------------------
 *
 * El nazareno es un dibujo de LÍNEA, y a 16 píxeles una línea fina desaparece:
 * queda una manchita donde no se distingue nada. Engordándolo, a 16 se sigue
 * leyendo un encapuchado, que es todo lo que se le puede pedir a un icono de
 * pestaña.
 *
 * Se engorda añadiéndole `stroke` DEL MISMO COLOR que el relleno: el dibujo ya
 * es el contorno relleno de la figura, así que el trazo la ensancha sin
 * cambiarle la forma. Está medido a 16, 32 y 48 comparándolo con el original.
 */
function engorde(lado) {
  /*
   * CUANTO MÁS PEQUEÑO, MÁS GORDO. Es la única forma de que el mismo dibujo
   * sirva para 16 y para 180:
   *
   *   · A 16 y 32 —la pestaña— una línea fina no existe: se convierte en una
   *     manchita gris. Ahí hay que engordar mucho.
   *   · A 180 —el icono del móvil, que se ve grande— engordarlo lo afea: la
   *     línea se vuelve tosca y pierde el trazo a mano que tiene el dibujo.
   *
   * Así que el de la pestaña va gordo y el del móvil va tal cual. No es
   * incoherente: es lo mismo que hace cualquier tipografía, que tiene un
   * dibujo distinto para el cuerpo pequeño y para el titular.
   */
  if (lado <= 32) return 30
  if (lado <= 48) return 18
  return 0
}

/** Y ajustado a la figura: el SVG trae aire de sobra arriba y abajo. */
const VENTANA = '47 67 425 952'

function chromium() {
  const candidatos = [
    process.env.CHROMIUM,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ].filter(Boolean)
  const cual = candidatos.find((c) => existsSync(c))
  if (!cual) {
    throw new Error(
      `No encuentro Chromium. Prueba con CHROMIUM=/ruta/al/navegador node ${'scripts/generar-favicon.mjs'}`,
    )
  }
  return cual
}

/** La baldosa con el nazareno dentro, como SVG, al tamaño que se pida. */
export function baldosa(lado) {
  const trazo = readFileSync(`${RAIZ}${RUTA_MARCA}`, 'utf8').match(/d="([^"]+)"/)[1]
  const r = Math.round(lado * 0.19)
  /* Un margen para que el dibujo no toque el borde de la baldosa. */
  const m = Math.round(lado * 0.1)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
  <rect width="${lado}" height="${lado}" rx="${r}" fill="${HUESO}"/>
  <svg x="${m}" y="${m}" width="${lado - m * 2}" height="${lado - m * 2}"
       viewBox="${VENTANA}" preserveAspectRatio="xMidYMid meet">
    <path d="${trazo}" fill="${GRANATE}" fill-rule="evenodd"
          stroke="${GRANATE}" stroke-width="${engorde(lado)}" stroke-linejoin="round"/>
  </svg>
</svg>`
}

/**
 * Y SE RASTERIZA CON UN LIENZO, no con una captura de pantalla.
 *
 * Capturar la pantalla parecía lo obvio y no vale: con una ventana de 180x180
 * Chromium no pinta los 180 de alto —recorta— y el icono sale cortado por la
 * mitad. Con ventana grande sale entero, pero entonces hay que recortarlo, y
 * para eso haría falta una herramienta de imágenes que este proyecto no tiene.
 *
 * Dibujándolo en un `<canvas>` del tamaño exacto y sacando el PNG con
 * `toDataURL`, el tamaño lo manda el lienzo y la ventana da igual. Es lo mismo
 * que hacía la versión de playwright; lo único que cambia es cómo se le pide al
 * navegador que lo haga.
 *
 * `--virtual-time-budget` es lo que hace que espere: sin él, `--dump-dom`
 * imprime la página antes de que la imagen haya terminado de decodificarse y
 * salen tres iconos vacíos.
 */
async function rasterizar() {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const correr = promisify(execFile)
  const nav = chromium()

  const dir = await mkdtemp(join(tmpdir(), 'gobergo-icono-'))
  try {
    for (const { ruta, lado } of ICONOS) {
      const fuente = `data:image/svg+xml;base64,${Buffer.from(baldosa(lado)).toString('base64')}`
      const html = join(dir, `${lado}.html`)
      await writeFile(html, `<body><img id="f" src="${fuente}"><div id="out"></div><script>
        (async () => {
          const img = document.getElementById('f')
          await img.decode()
          const c = document.createElement('canvas')
          c.width = ${lado}; c.height = ${lado}
          c.getContext('2d').drawImage(img, 0, 0, ${lado}, ${lado})
          document.getElementById('out').textContent = c.toDataURL('image/png')
        })()
      <\/script></body>`)

      const { stdout } = await correr(nav, [
        '--headless', '--disable-gpu', '--no-sandbox',
        '--virtual-time-budget=5000',
        '--dump-dom', `file://${html}`,
      ], { maxBuffer: 32 * 1024 * 1024 })

      const dato = (stdout.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/) ?? [])[1]
      if (!dato) throw new Error(`El navegador no ha devuelto el icono de ${lado}px.`)
      writeFileSync(`${RAIZ}${ruta}`, Buffer.from(dato, 'base64'))
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await rasterizar()
  writeFileSync(`${RAIZ}index.html`, generar())
  console.log(`Iconos redibujados desde ${RUTA_MARCA}:`)
  for (const { ruta, lado } of ICONOS) console.log(`  ${ruta} (${lado}px)`)
  console.log('Y las etiquetas de index.html, al día.')
}
