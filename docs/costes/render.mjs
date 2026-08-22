/**
 * Regenera el PDF de costes desde `costes.html`.
 *
 *     node docs/costes/render.mjs
 *
 * Existe porque las tarifas de Vercel, Supabase, Resend y Stripe cambian, y un
 * PDF que no se puede volver a generar es un documento muerto: se edita el
 * HTML, se vuelve a lanzar esto, y ya está.
 *
 * `executablePath` solo hace falta donde el navegador no está en su sitio de
 * siempre; si Playwright ya lo encuentra, se puede quitar.
 */
import { chromium } from 'playwright'
const navegador = process.env.PLAYWRIGHT_CHROMIUM
const b = await chromium.launch(navegador ? { executablePath: navegador } : {})
const p = await b.newPage()
const S = process.cwd() + '/docs/costes'
await p.goto('file://' + S + '/costes.html', { waitUntil: 'networkidle' })
await p.pdf({
  path: process.cwd() + '/GOBERGO-costes.pdf',
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="width:100%;font:8pt Helvetica,Arial,sans-serif;color:#9c8d84;padding:0 15mm;display:flex;justify-content:space-between;"><span>Gobergo · Qué cuesta tener esto en pie</span><span class="pageNumber"></span></div>',
  margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' },
})
await b.close()
console.log('pdf hecho')
