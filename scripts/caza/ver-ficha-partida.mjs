/* LA FICHA DEL HERMANO DESPUÉS DE PARTIRLA EN SEIS PIEZAS.
 *
 * Leer el código no dice si la ficha sigue funcionando: dice que compila. Esto
 * abre una ficha de verdad y USA los tres bloques que acaban de mudarse de
 * fichero —corregir la identidad, los datos sueltos y las etiquetas—, porque
 * cada uno se llevó su propio estado dentro y el estado es justo lo que se
 * rompe al mudarlo.
 *
 * Lo que vigila, en este orden:
 *   1. Que los tres bloques se pinten y los campos lleguen SEMBRADOS con los
 *      datos del hermano (el efecto que los siembra se mudó también).
 *   2. Que al cambiar de hermano los campos se vuelvan a sembrar y no se
 *      queden con los del anterior — que es el fallo clásico de mudar un
 *      `useEffect` con dependencia `[selected?.id]`.
 *   3. Que guardar la identidad escriba de verdad en el censo (la fila de la
 *      tabla cambia) y salga el «Guardado».
 *   4. Que una etiqueta se marque y se quede marcada.
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const DONDE = '/tmp/claude-0/fotos-ficha'; mkdirSync(DONDE, { recursive: true })
const port = 11900 + Math.floor(Math.random() * 90)
const chrome = spawn('/opt/pw-browsers/chromium-1194/chrome-linux/chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-background-networking', '--disable-component-update', `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' })
let wsUrl
for (let i = 0; i < 60 && !wsUrl; i++) { await espera(200); try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl } catch {} }
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map(); let errs = []
ws.onmessage = (m) => {
  const g = JSON.parse(m.data)
  if (g.id && pend.has(g.id)) { pend.get(g.id)(g); pend.delete(g.id) }
  if (g.method === 'Runtime.exceptionThrown') errs.push('EXC: ' + String(g.params.exceptionDetails.exception?.description ?? g.params.exceptionDetails.text).slice(0, 220))
  if (g.method === 'Runtime.consoleAPICalled' && g.params.type === 'error') errs.push('CONSOLA: ' + g.params.args.map((a) => String(a.value ?? a.description ?? '')).join(' ').slice(0, 220))
}
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1420, height: 1100, deviceScaleFactor: 1, mobile: false })
const BASE = 'http://127.0.0.1:4173'
await send('Page.navigate', { url: `${BASE}/mirar.html?ir=/app` })
for (let i = 0; i < 80; i++) { await espera(250); if (await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')")) break }
await espera(1200)
await send('Page.navigate', { url: `${BASE}/app/hermanos` }); await espera(3500)
errs = []

/* Abrir la ficha del primer hermano de la lista. */
const abrir = (n) => `(() => {
  /* Las filas se piden FUERA del cajón: dentro hay tablas (el historial de
     cuotas, la asistencia) y \`tbody tr\` las pescaba también. */
  const tabla = document.querySelector('.table-wrap, .panel, main')
  const filas = [...document.querySelectorAll('tbody tr')].filter((f) => !f.closest('.drawer'))
  const f = filas[${n}]
  if (!f) return 'no hay fila ' + ${n} + ' de ' + filas.length + (tabla ? '' : ' (ni tabla)')
  const b = f.querySelector('button') ?? f
  b.click()
  return (f.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60)
})()`
const cuantasFilas = `[...document.querySelectorAll('tbody tr')].filter(f=>!f.closest('.drawer')).length`
console.log('filas en la lista:', await ev(cuantasFilas))
console.log('fila 0:', await ev(abrir(0)))
await espera(1200)

const mide = `(() => {
  const v = (sel) => document.querySelector(sel)?.value ?? null
  const chips = [...document.querySelectorAll('.chip--toggle')]
  return {
    corregir: !!document.querySelector('#identNombre'),
    sueltos: !!document.querySelector('#tallaTunica'),
    etiquetas: chips.length,
    nombre: v('#identNombre'), dni: v('#identDni'), numero: v('#identNumero'),
    antiguedad: v('#identAnt'),
    email: v('#emailHermano'), telefono: v('#telHermano'),
    talla: v('#tallaTunica'),
    marcadas: chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.textContent.trim()),
    cajas: document.querySelectorAll('.assign-box').length,
  }
})()`
const uno = await ev(mide)
console.log('FICHA 1:', JSON.stringify(uno))
let s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${DONDE}/ficha-1.png`, Buffer.from(s.result.data, 'base64'))

/* ------------------------------------------------------------------------ */
/* 2. CAMBIAR DE HERMANO: los campos tienen que volver a sembrarse.          */
/* ------------------------------------------------------------------------ */
/* EL BOTÓN DE CERRAR SE BUSCA DENTRO DEL CAJÓN, no en la página: buscando
   /cerrar/i por todos los botones la sonda encontraba «Cerrar sesión» en el
   menú, cerraba la sesión y seguía midiendo una página vacía — y entonces
   «¿han cambiado los campos al cambiar de hermano?» salía verdadero porque
   los dos lados eran `null`. */
console.log('cerrar:', await ev(`(() => {
  const d = document.querySelector('.drawer')
  const b = d && [...d.querySelectorAll('button')].find(b=>/cerrar|×|✕/i.test(b.getAttribute('aria-label')||b.textContent))
  if (b) { b.click(); return 'cerrado por su botón' }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  return d ? 'cerrado con Escape' : 'no había cajón'
})()`))
await espera(700)
console.log('filas tras cerrar:', await ev(cuantasFilas))
console.log('fila 1:', await ev(abrir(1)))
await espera(1200)
const dos = await ev(mide)
console.log('FICHA 2:', JSON.stringify(dos))
/* Y se compara exigiendo que las DOS fichas tengan nombre: contra un `null`
   «han cambiado» sale verdadero y la guarda se pone verde sin haber mirado
   nada. Me pasó en la primera pasada de esta misma sonda. */
const resembrado = !!uno.nombre && !!dos.nombre && uno.nombre !== dos.nombre && uno.numero !== dos.numero
console.log('SE RESIEMBRA:', resembrado ? 'SÍ' : `NO — 1=${uno.nombre}/${uno.numero} 2=${dos.nombre}/${dos.numero}`)

/* ------------------------------------------------------------------------ */
/* 3. GUARDAR LA IDENTIDAD: que escriba de verdad en el censo.               */
/* ------------------------------------------------------------------------ */
const APELLIDO = ' Probado'
await ev(`(() => {
  const i = document.querySelector('#identNombre')
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(i, i.value + ${JSON.stringify(APELLIDO)})
  i.dispatchEvent(new Event('input', { bubbles: true }))
  return i.value
})()`)
await espera(300)
console.log('guardar:', await ev(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar la ficha'); if(!b) return 'no hay botón'; b.click(); return 'pulsado' })()`))
await espera(900)
console.log('TRAS GUARDAR:', JSON.stringify(await ev(`(() => ({
  aviso: [...document.querySelectorAll('.pill--ok')].map(p=>p.textContent.trim()),
  error: document.querySelector('.form-hint--error')?.textContent?.trim() ?? null,
  enElCenso: (() => {
    const h = JSON.parse(localStorage.getItem('cabildo-hermanos') || '[]')
    return h.filter(x => /Probado$/.test(x.nombre)).map(x => x.nombre + ' · nº' + x.numero)
  })(),
}))()`)))
s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${DONDE}/ficha-guardada.png`, Buffer.from(s.result.data, 'base64'))

/* ------------------------------------------------------------------------ */
/* 4. UNA ETIQUETA: que se marque y se quede.                                */
/* ------------------------------------------------------------------------ */
console.log('marcar etiqueta:', await ev(`(() => {
  const c = [...document.querySelectorAll('.chip--toggle')].find(c => c.getAttribute('aria-pressed') !== 'true')
  if (!c) return 'todas marcadas ya'
  const como = c.textContent.trim()
  c.click()
  return como
})()`))
await espera(800)
console.log('TRAS MARCAR:', JSON.stringify(await ev(`(() => {
  const chips = [...document.querySelectorAll('.chip--toggle')]
  const h = JSON.parse(localStorage.getItem('cabildo-hermanos') || '[]')
  const abierto = document.querySelector('#identNombre')?.value
  const fila = h.find(x => x.nombre === abierto)
  return { marcadas: chips.filter(c => c.getAttribute('aria-pressed')==='true').map(c=>c.textContent.trim()),
           enElCenso: fila?.etiquetas ?? null }
})()`)))

/* 5. Una etiqueta nueva, que es lo que `crearEtiqueta` se llevó dentro. */
await ev(`(() => {
  const i = [...document.querySelectorAll('input[placeholder="Crear etiqueta nueva…"]')][0]
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(i, 'Prueba de corte')
  i.dispatchEvent(new Event('input', { bubbles: true }))
  return i.value
})()`)
await espera(300)
await ev(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Añadir'); b?.click(); return !!b })()`)
await espera(900)
console.log('ETIQUETA NUEVA:', JSON.stringify(await ev(`(() => {
  const cat = JSON.parse(localStorage.getItem('cabildo-etiquetas') || '[]')
  const chips = [...document.querySelectorAll('.chip--toggle')]
  return { enElCatalogo: cat.includes('Prueba de corte'),
           pintada: chips.some(c => /Prueba de corte/.test(c.textContent)),
           marcadaSola: chips.filter(c=>/Prueba de corte/.test(c.textContent)).map(c=>c.getAttribute('aria-pressed')),
           cajaVaciada: document.querySelector('input[placeholder="Crear etiqueta nueva…"]')?.value }
})()`)))
s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${DONDE}/ficha-etiquetas.png`, Buffer.from(s.result.data, 'base64'))

/* 6. Un dato suelto: se guarda al escribir, sin botón. */
await ev(`(() => {
  const i = document.querySelector('#tallaTunica')
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(i, 'XL · 1,92 m')
  i.dispatchEvent(new Event('input', { bubbles: true }))
  return i.value
})()`)
await espera(900)
console.log('DATO SUELTO:', JSON.stringify(await ev(`(() => {
  const h = JSON.parse(localStorage.getItem('cabildo-hermanos') || '[]')
  return { enElCenso: h.filter(x => x.tallaTunica === 'XL · 1,92 m').map(x => x.nombre),
           enLaPantalla: document.querySelector('#tallaTunica')?.value }
})()`)))

console.log('ERRORES:', errs.length ? errs : 'ninguno')
ws.close(); chrome.kill()
