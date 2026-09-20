/*
 * CRONÓMETRO CON UNA HERMANDAD GRANDE.
 *
 * Siembra 800 hermanos, tres ejercicios de recibos (9.600), 800 papeletas y
 * 3.000 apuntes —el tamaño de una hermandad grande de verdad— y mide CUÁNTO
 * TARDA cada pantalla en pintarse y cuánto tarda en responder a una tecla en
 * el buscador. Lo segundo es lo que se nota: una pantalla que tarda 2 s en
 * abrir se perdona; una que tarda 400 ms por letra es inusable.
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 9500 + Math.floor(Math.random() * 90)
const chrome = spawn('/opt/pw-browsers/chromium-1194/chrome-linux/chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-background-networking',
  '--disable-component-update', `--remote-debugging-port=${port}`, 'about:blank',
], { stdio: 'ignore' })
let wsUrl
for (let i = 0; i < 60 && !wsUrl; i++) {
  await espera(200)
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl } catch {}
}
if (!wsUrl) { chrome.kill(); throw new Error('Chrome no arranca') }
const ws = new WebSocket(wsUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pend = new Map()
let errores = []
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pend.has(msg.id)) { pend.get(msg.id)(msg); pend.delete(msg.id) }
  if (msg.method === 'Runtime.exceptionThrown') errores.push('EXC: ' + String(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).slice(0, 160))
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errores.push('ERR: ' + msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 160))
}
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) return 'EXC: ' + (r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text ?? '').slice(0, 300)
  return r.result?.result?.value
}
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1100, deviceScaleFactor: 1, mobile: false })
const BASE = 'http://127.0.0.1:4173'

// Entrar como en las demás sondas: mirar.html deja la sesión y la suscripción.
await send('Page.navigate', { url: `${BASE}/mirar.html?ir=/app` })
for (let i = 0; i < 80; i++) {
  await espera(250)
  if (await ev("location.pathname === '/app' && !!localStorage.getItem('cabildo-suscripcion')")) break
}
await espera(1200)

const N_HERMANOS = 800
const EJERCICIOS = [2024, 2025, 2026]
const sembrado = await ev(`(() => {
  const hermanos = []
  for (let i = 0; i < ${N_HERMANOS}; i++) {
    hermanos.push({
      id: 'H' + i, numero: i + 1,
      nombre: ['Rafael','Manuel','Carmen','Antonio','Rocío','José','Ana','Francisco'][i % 8] + ' ' +
              ['Ortiz','Bermejo','Ruiz','Moreno','Delgado','Vega','Pardo','Luna'][(i * 3) % 8] + ' ' +
              ['Cabrera','Nieto','Rosado','Gil','Mora','Salas'][(i * 5) % 6],
      estado: i % 17 === 0 ? 'Baja' : (i % 23 === 0 ? 'Nuevo' : 'Activo'),
      antiguedad: 1960 + (i % 60),
      email: 'h' + i + '@ejemplo.es', telefono: '6' + String(10000000 + i),
      direccion: 'Calle Ejemplo ' + i + ', Sevilla',
      cuotaAlDia: false,
      iban: 'ES' + String(1000000000000000000000 + i).slice(0, 22),
      dni: String(10000000 + i) + 'Z', claveAcceso: 'x', authUserId: null,
      cargo: '', etiquetas: [],
    })
  }
  const cuotas = []
  let n = 0
  for (const ej of ${JSON.stringify(EJERCICIOS)}) {
    for (const h of hermanos) {
      if (h.estado === 'Baja') continue
      for (const cc of ['Cuota anual', 'Cuota anual']) {
        n++
        cuotas.push({
          id: 'C' + n, numero: n, hermanoId: h.id, concepto: cc, importe: 30,
          estado: n % 5 === 0 ? 'Pendiente' : 'Pagada', ejercicio: ej,
          fechaEmision: ej + '-01-15', fechaCobro: ej + '-02-01',
          domiciliada: n % 3 !== 0, fechaPago: n % 5 === 0 ? undefined : ej + '-02-05',
        })
      }
    }
  }
  const papeletas = hermanos.filter((h) => h.estado !== 'Baja').map((h, i) => ({
    id: 'P' + i, numero: i + 1, hermanoId: h.id, anio: 2026,
    tramoId: null, opcion: 'Papeleta simbólica', importe: 18,
    estado: ['Asignada','Pagada','Entregada','Solicitada'][i % 4],
    fechaSolicitud: '2026-01-20',
  }))
  const movimientos = []
  for (let i = 0; i < 3000; i++) {
    movimientos.push({
      id: 'M' + i, fecha: EJ(i), concepto: 'Apunte ' + i,
      categoria: ['Cuotas','Papeletas','Donativos','Gastos generales','Culto'][i % 5],
      importe: (i % 7) * 10 - 20, tipo: i % 3 === 0 ? 'Gasto' : 'Ingreso',
      estado: i % 9 === 0 ? 'Pendiente' : 'Conciliado', origen: null,
    })
  }
  function EJ(i) { const ej = ${JSON.stringify(EJERCICIOS)}[i % 3]; return ej + '-' + String((i % 12) + 1).padStart(2,'0') + '-' + String((i % 27) + 1).padStart(2,'0') }
  const pon = (k, v) => localStorage.setItem(k, JSON.stringify(v))
  try {
    pon('cabildo-hermanos', hermanos); pon('cabildo-cuotas', cuotas)
    pon('cabildo-papeletas', papeletas); pon('cabildo-movimientos', movimientos)
  } catch (e) { return 'NO CABE: ' + e.message }
  const bytes = Object.keys(localStorage).reduce((s, k) => s + k.length + (localStorage.getItem(k) || '').length, 0)
  return hermanos.length + ' hermanos · ' + cuotas.length + ' recibos · ' + papeletas.length +
         ' papeletas · ' + movimientos.length + ' apuntes · espejo ' + (bytes / 1048576).toFixed(2) + ' MB'
})()`)
console.log('sembrado:', sembrado)

const filas = []
const medir = async (nombre, ruta, buscar) => {
  errores = []
  await send('Page.navigate', { url: BASE + ruta })
  const t0 = Date.now()
  let pintada = null
  for (let i = 0; i < 120; i++) {
    await espera(100)
    const listo = await ev("(() => { const b = document.body; if (!b) return false; const t = b.innerText || ''; return t.length > 200 && !/Cargando/.test(t.slice(0,80)) })()")
    if (listo === true) { pintada = Date.now() - t0; break }
  }
  await espera(600)
  const nodos = await ev('document.querySelectorAll("*").length')
  const filasTabla = await ev('document.querySelectorAll("tbody tr").length')
  // Y ahora una tecla en el buscador, medida DENTRO del navegador.
  let tecla = null
  if (buscar) {
    tecla = await ev(`(async () => {
      const i = document.querySelector('.search-box') || document.querySelector('input[type=search]')
      if (!i) return null
      const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
      const t = []
      for (const txt of ['O','Or','Ort','Orti','Ortiz']) {
        const a = performance.now()
        d.set.call(i, txt)
        i.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        t.push(performance.now() - a)
      }
      return Math.round(Math.max(...t))
    })()`)
  }
  const err = errores.filter((e) => !/favicon|Failed to load resource|net::ERR/.test(e))
  filas.push({ nombre, pintada, nodos, filasTabla, tecla, err })
  console.log(`${String(pintada ?? 'NO PINTA').padStart(6)} ms  ${String(tecla ?? '-').padStart(5)} ms/tecla  ${String(nodos).padStart(6)} nodos  ${String(filasTabla).padStart(5)} filas  ${nombre}${err.length ? '   <<< ' + err[0] : ''}`)
}

console.log('\n pintar  tecla   nodos  filas  pantalla')
console.log('-------------------------------------------------------------')
await medir('Inicio', '/app', false)
await medir('Hermanos (censo)', '/app/hermanos', true)
await medir('Cuotas', '/app/cuotas', true)
await medir('Papeletas', '/app/papeletas', true)
await medir('Cortejo', '/app/cortejo', false)
await medir('Tesorería', '/app/tesoreria', true)
await medir('Informes', '/app/informes', false)
await medir('Comunicados', '/app/comunicados', false)
await medir('Notificaciones', '/app/notificaciones', false)
await medir('Configuración', '/app/configuracion', false)

writeFileSync('/tmp/claude-0/caza/perf.json', JSON.stringify(filas, null, 2))
ws.close(); chrome.kill()
