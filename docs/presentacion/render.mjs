/**
 * Regenera el PDF de presentación desde `gobergo.html`.
 *
 *     node docs/presentacion/render.mjs
 *
 * Es el documento que se le enseña a una junta de gobierno. Se genera y no se
 * edita a mano el PDF: así se puede corregir una frase y volver a sacarlo, en
 * vez de quedarse con un archivo que nadie sabe rehacer.
 *
 * `PLAYWRIGHT_CHROMIUM` solo hace falta donde el navegador no está en su sitio
 * de siempre; si Playwright ya lo encuentra, se puede quitar.
 */
import { chromium } from 'playwright'

const navegador = process.env.PLAYWRIGHT_CHROMIUM
const b = await chromium.launch(navegador ? { executablePath: navegador } : {})
const p = await b.newPage()
const S = `${process.cwd()}/docs/presentacion`
await p.goto(`file://${S}/gobergo.html`, { waitUntil: 'networkidle' })
await p.pdf({
  path: `${process.cwd()}/GOBERGO-que-es.pdf`,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  // La primera página es la portada a sangre: el pie ahí sobraría, así que se
  // esconde con la propia numeración (Chromium no deja saltarse una página).
  footerTemplate:
    '<div style="width:100%;font:8pt Helvetica,Arial,sans-serif;color:#93857c;'
    + 'padding:0 15mm;display:flex;justify-content:space-between;">'
    + '<span>Gobergo · La hermandad, en orden</span>'
    + '<span class="pageNumber"></span></div>',
  margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' },
})
await b.close()
console.log('pdf hecho: GOBERGO-que-es.pdf')
