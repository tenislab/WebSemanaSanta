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
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = `${dirname(dirname(fileURLToPath(import.meta.url)))}/`

/** De dónde sale todo. */
export const RUTA_MARCA_REDUCIDA = 'src/assets/gobergo-marca-reducida.webp'
export const RUTA_MARCA_COMPLETA = 'src/assets/gobergo-marca.webp'

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

/** Redibuja los PNG del icono desde la marca reducida. Necesita navegador. */
async function rasterizar() {
  const { chromium } = await import('playwright')
  const fuente = `data:image/webp;base64,${readFileSync(`${RAIZ}${RUTA_MARCA_REDUCIDA}`).toString('base64')}`
  const nav = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  })
  const pg = await nav.newPage()
  const salida = await pg.evaluate(async ([src, medidas, hueso]) => {
    const img = new Image()
    img.src = src
    await img.decode()
    return medidas.map(({ lado }) => {
      const c = document.createElement('canvas')
      c.width = lado
      c.height = lado
      const g = c.getContext('2d')
      g.fillStyle = hueso
      g.beginPath()
      g.roundRect(0, 0, lado, lado, lado * 0.19)
      g.fill()
      // Margen para que el dibujo no toque el borde de la baldosa.
      const m = Math.round(lado * 0.09)
      g.imageSmoothingEnabled = true
      g.imageSmoothingQuality = 'high'
      g.drawImage(img, m, m, lado - m * 2, lado - m * 2)
      return c.toDataURL('image/png')
    })
  }, [fuente, ICONOS, HUESO])
  await nav.close()
  ICONOS.forEach(({ ruta }, i) => {
    writeFileSync(`${RAIZ}${ruta}`, Buffer.from(salida[i].split(',')[1], 'base64'))
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await rasterizar()
  writeFileSync(`${RAIZ}index.html`, generar())
  console.log(`Iconos redibujados desde ${RUTA_MARCA_REDUCIDA}:`)
  for (const { ruta, lado } of ICONOS) console.log(`  ${ruta} (${lado}px)`)
  console.log('Y las etiquetas de index.html, al día.')
}
