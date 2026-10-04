/* CUÁNTAS HOJAS OCUPA UNA PAPELETA, Y DE QUÉ TAMAÑO SALE.
 *
 * Se reportó así: «a la hora de imprimir papeletas sale enorme, que sea solo
 * una página». En la captura, el diálogo de Chrome decía «3 páginas», «Tamaño
 * del papel: A1» y «Diseño: Horizontal».
 *
 * Y mirar el CSS no basta para saber si está arreglado: esto imprime DE VERDAD
 * a PDF por CDP —que es el mismo motor que el diálogo— y cuenta las hojas y mide
 * la caja del documento. Tres escenarios:
 *
 *   1. A1 FORZADO (lo que le pasaba). Aunque el CSS pida A4, el diálogo recuerda
 *      el último papel, y hay impresoras que lo imponen. Lo que no puede pasar es
 *      que la papeleta crezca con el papel: a 59 cm de ancho se vuelve un cartel
 *      y se parte en tres.
 *   2. LO QUE PIDA EL CSS (`preferCSSPageSize`), que es lo que de verdad se
 *      lleva el diálogo: tiene que salir A4 vertical.
 *   3. A4, UNA HOJA.
 *
 * Se mide el modelo personalizado Y el genérico, porque son dos caminos
 * distintos y el que se reparte a los hermanos es el primero.
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import zlib from 'node:zlib'
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const DONDE = '/tmp/claude-0/papeleta-impresa'; mkdirSync(DONDE, { recursive: true })
const port = 11900 + Math.floor(Math.random() * 90)
const chrome = spawn('/opt/pw-browsers/chromium-1194/chrome-linux/chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-background-networking', '--disable-component-update', `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' })
let wsUrl
for (let i = 0; i < 60 && !wsUrl; i++) { await espera(200); try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl } catch {} }
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map(); let errs = []
ws.onmessage = (m) => {
  const g = JSON.parse(m.data)
  if (g.id && pend.has(g.id)) { pend.get(g.id)(g); pend.delete(g.id) }
  if (g.method === 'Runtime.exceptionThrown') errs.push('EXC: ' + String(g.params.exceptionDetails.exception?.description ?? g.params.exceptionDetails.text).slice(0, 200))
}
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1420, height: 1000, deviceScaleFactor: 1, mobile: false })
const BASE = 'http://127.0.0.1:4173'
await send('Page.navigate', { url: `${BASE}/mirar.html?ir=/app` })
for (let i = 0; i < 80; i++) { await espera(250); if (await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')")) break }
await espera(1200)
/*
 * SE SIEMBRA UN MODELO SUBIDO, que es el camino que se reportó: la captura
 * enseña una plantilla con escudo y normas, no el diseño de fábrica. La imagen
 * es un PNG liso con la proporción de un A4 vertical (210×297), que es la de
 * una papeleta escaneada.
 */
const MODELO = `(() => {
  const png = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMTAiIGhlaWdodD0iMjk3IiB2aWV3Qm94PSIwIDAgMjEwIDI5NyI+PHJlY3Qgd2lkdGg9IjIxMCIgaGVpZ2h0PSIyOTciIGZpbGw9IiNmYWY2ZWMiLz48cmVjdCB4PSI4IiB5PSI4IiB3aWR0aD0iMTk0IiBoZWlnaHQ9IjI4MSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOGExYzJiIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSIxMDUiIHk9IjQwIiBmb250LXNpemU9IjEyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOGExYzJiIj5QQVBFTEVUQSBERSBTSVRJTzwvdGV4dD48L3N2Zz4="
  const campos = [
    { id: 'c1', clave: 'nombre',        xPct: 28, yPct: 40, tamanoPct: 3.6, negrita: true,  color: '#1a1a1a', align: 'left' },
    { id: 'c2', clave: 'numeroHermano', xPct: 28, yPct: 48, tamanoPct: 3,   negrita: false, color: '#1a1a1a', align: 'left' },
    { id: 'c3', clave: 'tramo',         xPct: 28, yPct: 56, tamanoPct: 3,   negrita: false, color: '#1a1a1a', align: 'left' },
    { id: 'c4', clave: 'qr',            xPct: 82, yPct: 76, tamanoPct: 6,   negrita: false, color: '#1a1a1a', align: 'left' },
  ]
  localStorage.setItem('cabildo-modelo-papeleta', JSON.stringify({ imagenDataUrl: png, campos }))
  return 'modelo sembrado'
})()`
console.log('modelo:', await ev(MODELO))
await send('Page.navigate', { url: `${BASE}/app/papeletas` }); await espera(3500)
errs = []

/*
 * CUÁNTAS HOJAS TRAE UN PDF, Y EL PRIMER CONTADOR MENTÍA.
 *
 * Contaba apariciones de «/Type /Page» en el fichero en crudo, y eso da números
 * inventados: Chrome mete los objetos en flujos comprimidos, así que la misma
 * tanda de 28 papeletas salía «28» en un papel y «1» en otro. Un contador que
 * depende de cómo le dé por comprimir no sirve para decir si hay una hoja o
 * tres, que es justo la pregunta.
 *
 * Lo que se cuenta ahora es el `/Count` del árbol de páginas, descomprimiendo
 * los flujos. Con árboles anidados el mayor es el total.
 */
const hojas = (base64) => {
  const d = Buffer.from(base64, 'base64')
  const cuentas = [...d.toString('latin1').matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]))
  for (const m of d.toString('latin1').matchAll(/stream\r?\n/g)) {
    try {
      const desde = m.index + m[0].length
      const hasta = d.toString('latin1').indexOf('endstream', desde)
      const texto = zlib.inflateSync(d.subarray(desde, hasta)).toString('latin1')
      cuentas.push(...[...texto.matchAll(/\/Count\s+(\d+)/g)].map((x) => Number(x[1])))
    } catch { /* ese flujo no es zlib: no pasa nada */ }
  }
  return cuentas.length ? Math.max(...cuentas) : 0
}

/*
 * Y EL PESO, que delata la hoja en blanco. Una tanda de 28 papeletas pesa
 * cientos de kilobytes; un PDF de 1 KB es una hoja vacía, y eso pasaba al pedir
 * dos impresiones seguidas sin dejar respirar a la página.
 */
const kb = (base64) => Math.round(Buffer.from(base64, 'base64').length / 1024)

/*
 * Y DE QUÉ TAMAÑO ES LA HOJA. El `MediaBox` del PDF viene en puntos (72 por
 * pulgada), así que se pasa a milímetros. Es lo que de verdad comprueba que el
 * `@page { size: A4 portrait }` manda: un A4 son 210 × 297 mm.
 */
const medidaDeLaHoja = (base64) => {
  const crudo = Buffer.from(base64, 'base64').toString('latin1')
  const m = crudo.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
  if (!m) return 'sin MediaBox'
  const mm = (pt) => Math.round((Number(pt) / 72) * 25.4)
  return `${mm(m[3]) - mm(m[1])}×${mm(m[4]) - mm(m[2])} mm`
}

/* Los papeles, en pulgadas. */
const PAPELES = {
  A4: { paperWidth: 8.27, paperHeight: 11.69 },
  A1: { paperWidth: 23.39, paperHeight: 33.11 },
}

async function imprimir(nombre, opciones) {
  /* Un respiro entre impresiones: pidiendo dos seguidas, la segunda salía en
     blanco (1 KB) mientras la primera todavía se estaba componiendo. */
  await espera(1200)
  const r = await send('Page.printToPDF', { printBackground: true, ...opciones })
  if (!r.result?.data) return { nombre, error: JSON.stringify(r).slice(0, 200) }
  writeFileSync(`${DONDE}/${nombre}.pdf`, Buffer.from(r.result.data, 'base64'))
  return { nombre, hojas: hojas(r.result.data), hoja: medidaDeLaHoja(r.result.data), kb: kb(r.result.data) }
}

/* Lo que mide la caja del documento al aplicar el CSS de impresión. */
const MIDE = `(() => {
  const d = document.querySelector('.impresion-masiva .print-doc') ?? document.querySelector('.print-doc')
  if (!d) return { no: 'no hay documento de impresión montado' }
  const r = d.getBoundingClientRect()
  const render = d.querySelector('.modelo-render') ?? d.closest('.modelo-render')
  return {
    anchoDoc: Math.round(r.width), altoDoc: Math.round(r.height),
    anchoModelo: render ? Math.round(render.getBoundingClientRect().width) : null,
    /*
     * LIENZO E IMAGEN TIENEN QUE MEDIR LO MISMO. Las posiciones de los campos
     * son porcentajes del lienzo y su tamaño va en «cqw» del lienzo: si el
     * lienzo es más ancho que la imagen, el nombre y el QR se van de su sitio.
     */
    anchoLienzo: render ? Math.round((render.querySelector('.modelo-render__lienzo') ?? render).getBoundingClientRect().width) : null,
    anchoImagen: render ? Math.round((render.querySelector('.modelo-render__img') ?? render).getBoundingClientRect().width) : null,
    altoImagen: render ? Math.round((render.querySelector('.modelo-render__img') ?? render).getBoundingClientRect().height) : null,
    clases: d.className,
  }
})()`

/* ------------------------------------------------------------------ */
/* 1. UNA PAPELETA, LA DE LA FICHA DE UN HERMANO.                      */
/* ------------------------------------------------------------------ */
console.log('abrir una papeleta:', await ev(`(() => {
  const filas = [...document.querySelectorAll('tbody tr')].filter((f) => !f.closest('.drawer'))
  const con = filas.find((f) => !/sin papeleta/i.test(f.textContent))
  if (!con) return 'no hay ninguna fila con papeleta'
  ;(con.querySelector('button') ?? con).click()
  return (con.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 55)
})()`))
await espera(1500)

/*
 * Se enciende el CSS de impresión a mano en vez de pulsar «Imprimir»: ese botón
 * llama a `window.print()`, que en un navegador sin cabeza abre un diálogo que
 * no existe y se queda esperando. `Emulation.setEmulatedMedia` aplica las mismas
 * reglas `@media print` sin diálogo.
 */
await send('Emulation.setEmulatedMedia', { media: 'print' })
/* Que la imagen del modelo haya cargado: midiendo antes, el alto sale en 16 px
   y la medida no dice nada. */
await ev(`(async () => {
  const img = document.querySelector('.modelo-render__img')
  if (img && !img.complete) await new Promise((r) => { img.onload = r; img.onerror = r })
  return 'cargada'
})()`)
await espera(800)
console.log('CAJA (una papeleta):', JSON.stringify(await ev(MIDE)))
await send('Emulation.setEmulatedMedia', { media: '' })

console.log('\n── UNA PAPELETA, IMPRESA ──')
for (const [papel, medidas] of Object.entries(PAPELES)) {
  console.log(`  ${papel.padEnd(3)} forzado      :`, JSON.stringify(await imprimir(`una-${papel}`, medidas)))
}
console.log('  lo que pide el CSS:', JSON.stringify(await imprimir('una-css', { preferCSSPageSize: true })))

/*
 * LA PRUEBA DE QUE ESTÁ TOPADO: medir con la ventana a otro tamaño. Antes del
 * arreglo el documento medía lo que midiera la ventana —1.420 px— así que esto
 * daba dos números distintos. Ahora tiene que dar el mismo las dos veces.
 */
console.log('\n── ¿CRECE CON LA VENTANA? ──')
await send('Emulation.setEmulatedMedia', { media: 'print' })
for (const ancho of [900, 2400]) {
  await send('Emulation.setDeviceMetricsOverride', { width: ancho, height: 1000, deviceScaleFactor: 1, mobile: false })
  await espera(500)
  const m = await ev(MIDE)
  console.log(`  ventana de ${ancho} px → documento de ${m.anchoDoc} px (${(m.anchoDoc / 96 * 2.54).toFixed(1)} cm)`)
}
await send('Emulation.setEmulatedMedia', { media: '' })
await send('Emulation.setDeviceMetricsOverride', { width: 1420, height: 1000, deviceScaleFactor: 1, mobile: false })

/* ------------------------------------------------------------------ */
/* 2. LA TANDA (impresión masiva), que es la que se reparte.           */
/* ------------------------------------------------------------------ */
console.log('\ncerrar la ficha:', await ev(`(() => {
  const d = document.querySelector('.drawer')
  const b = d && [...d.querySelectorAll('button')].find((b)=>/cerrar|×|✕/i.test(b.getAttribute('aria-label')||b.textContent))
  if (b) { b.click(); return 'cerrada' }
  return d ? 'no encontré su botón' : 'no había ficha abierta'
})()`))
await espera(900)

/*
 * La zona de impresión en masa se monta al pedir la tanda, y luego se marca el
 * cuerpo con `print-masivo`. Se busca el botón por su texto.
 */
/*
 * LA TANDA. Son dos pasos: «Imprimir papeletas» abre el cajón y «Generar PDF»
 * monta la zona y marca el cuerpo con `print-masivo`.
 *
 * Y SE REGENERA ANTES DE CADA PAPEL, que es lo que costó entender: la primera
 * impresión salía bien (469 KB) y las siguientes en blanco (1 KB). No es una
 * carrera: `printToPDF` dispara `afterprint`, y el manejador de `impresion.ts`
 * desmonta la zona y suelta la lista —que es exactamente lo que tiene que hacer
 * cuando alguien imprime de verdad—. Así que la sonda la vuelve a pedir cada
 * vez, en vez de culpar a la aplicación de algo que hace bien.
 */
async function montarLaTanda() {
  await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Imprimir papeletas')
    if (b) b.click()
    return !!b
  })()`)
  await espera(1000)
  const r = await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find((b) => /^Generar PDF/.test(b.textContent.trim()))
    if (!b) return 'no está «Generar PDF»'
    if (b.disabled) return 'apagado: no hay papeletas que imprimir'
    b.click(); return b.textContent.trim()
  })()`)
  await espera(2000)
  await ev(`(async () => {
    await Promise.all([...document.querySelectorAll('.impresion-masiva img')]
      .filter((i) => !i.complete)
      .map((i) => new Promise((x) => { i.onload = x; i.onerror = x })))
    return 'ok'
  })()`)
  return r
}

console.log('\n── LA TANDA ──')
console.log('  pedirla:', await montarLaTanda())
await send('Emulation.setEmulatedMedia', { media: 'print' })
await espera(700)
console.log('  cuántas papeletas:', await ev(`document.querySelectorAll('.impresion-masiva__pagina').length`))
console.log('  CAJA de la primera:', JSON.stringify(await ev(MIDE)))
/* Y una foto con el CSS de impresión puesto: que los datos estén DENTRO de la
   papeleta y no desplazados, que es lo que se rompería si el lienzo y la imagen
   dejaran de medir lo mismo. */
const foto = await send('Page.captureScreenshot', { format: 'png' })
if (foto.result?.data) writeFileSync(`${DONDE}/tanda-en-papel.png`, Buffer.from(foto.result.data, 'base64'))
await send('Emulation.setEmulatedMedia', { media: '' })

for (const [papel, medidas] of Object.entries(PAPELES)) {
  console.log(`  ${papel.padEnd(3)} forzado      :`, JSON.stringify(await imprimir(`tanda-${papel}`, medidas)))
  await montarLaTanda()
}
console.log('  lo que pide el CSS:', JSON.stringify(await imprimir('tanda-css', { preferCSSPageSize: true })))

console.log('\nERRORES:', errs.length ? errs : 'ninguno')
ws.close(); chrome.kill()
