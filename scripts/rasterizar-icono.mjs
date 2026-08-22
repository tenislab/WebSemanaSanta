/**
 * LOS PNG DEL ICONO, sacados del mismo SVG.
 *
 * A mano serían dos archivos que se quedan con el logo viejo el día que
 * cambie el logo —y nadie se da cuenta, porque un icono equivocado se ve pero
 * no molesta—. Rasterizándolos desde `public/favicon.svg` no pueden divergir.
 *
 * Va aparte de `generar-favicon.mjs` a propósito: esto necesita un navegador,
 * y la prueba que comprueba que el `index.html` está al día tiene que poder
 * correr sin abrir ninguno.
 *
 *   node scripts/rasterizar-icono.mjs
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = `${dirname(dirname(fileURLToPath(import.meta.url)))}/`
const svg = readFileSync(`${RAIZ}public/favicon.svg`, 'utf8')

const MEDIDAS = [
  // El de la pestaña. 32 y no 16: en pantallas de mucha densidad, el de 16 se
  // ve como si estuviera mal enfocado.
  // El de la pestaña. 32 y no 16: en pantallas de mucha densidad, el de 16 se
  // ve como si estuviera mal enfocado.
  { archivo: 'public/favicon-32.png', lado: 32 },
  /*
   * El de iOS, para la pantalla de inicio. Sin fondo aparte: la baldosa color
   * hueso ya va dentro del propio SVG, así que los tres iconos —el SVG y los
   * dos PNG— salen idénticos y no pueden separarse.
   */
  { archivo: 'public/apple-touch-icon.png', lado: 180 },
]

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
})
for (const { archivo, lado } of MEDIDAS) {
  const pg = await nav.newPage({ viewport: { width: lado, height: lado } })
  // A sangre: la baldosa del SVG ocupa el icono entero, como cualquier icono
  // de aplicación. Dejarle margen lo haría parecer más pequeño que los demás.
  await pg.setContent(
    `<body style="margin:0;width:${lado}px;height:${lado}px;background:transparent">`
    + `${svg.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ')}</body>`,
  )
  await pg.screenshot({ path: `${RAIZ}${archivo}`, omitBackground: true })
  console.log(`${archivo} — ${lado}×${lado}`)
  await pg.close()
}
await nav.close()
