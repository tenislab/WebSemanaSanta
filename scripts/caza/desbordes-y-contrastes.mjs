/*
 * DESBORDES Y CONTRASTES, PANTALLA A PANTALLA.
 *
 * Mide tres cosas que no se ven leyendo el CSS:
 *   · si la página se puede arrastrar de lado (scrollWidth > clientWidth), que
 *     en un móvil es el fallo de maquetación más visible que hay;
 *   · qué elemento concreto es el que sobresale, para no salir con «algo se
 *     desborda»;
 *   · y si algún texto queda con contraste por debajo de 3:1 contra el fondo
 *     que tiene detrás de verdad, resuelto por el navegador.
 */
import { spawn } from 'node:child_process'
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 9700 + Math.floor(Math.random() * 90)
const chrome = spawn('/opt/pw-browsers/chromium-1194/chrome-linux/chrome', ['--headless=new','--disable-gpu','--no-sandbox','--disable-background-networking','--disable-component-update',`--remote-debugging-port=${port}`,'about:blank'], { stdio: 'ignore' })
let wsUrl
for (let i = 0; i < 60 && !wsUrl; i++) { await espera(200); try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t)=>t.type==='page')?.webSocketDebuggerUrl } catch {} }
const ws = new WebSocket(wsUrl); await new Promise((r)=>(ws.onopen=r))
let id=0; const pend=new Map(); let errores=[]
ws.onmessage=(m)=>{const g=JSON.parse(m.data); if(g.id&&pend.has(g.id)){pend.get(g.id)(g);pend.delete(g.id)}
  if(g.method==='Runtime.exceptionThrown') errores.push('EXC: '+String(g.params.exceptionDetails.exception?.description??g.params.exceptionDetails.text).slice(0,140))}
const send=(m,p={})=>new Promise((r)=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))})
const ev=async(e)=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true}); if(r.result?.exceptionDetails) return 'EXC: '+JSON.stringify(r.result.exceptionDetails).slice(0,200); return r.result?.result?.value}
await send('Page.enable'); await send('Runtime.enable')
const BASE='http://127.0.0.1:4173'
await send('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false})
await send('Page.navigate',{url:`${BASE}/mirar.html?ir=/app`})
for(let i=0;i<80;i++){await espera(250); if(await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')"))break}
await espera(1200)

const MEDIDA = `(() => {
  const de = document.documentElement
  const out = { ancho: de.clientWidth, scroll: de.scrollWidth, culpables: [], flojos: [] }
  if (de.scrollWidth > de.clientWidth + 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0) continue
      if (r.right > de.clientWidth + 1 || r.left < -1) {
        const cs = getComputedStyle(el)
        if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') continue
        // solo el que sobresale y cuyo padre NO sobresale: la raíz del problema
        const p = el.parentElement
        const pr = p ? p.getBoundingClientRect() : null
        if (pr && pr.right > de.clientWidth + 1) continue
        out.culpables.push((el.tagName.toLowerCase()) + '.' + String(el.className || '').split(' ').slice(0,2).join('.') + ' [' + Math.round(r.left) + '→' + Math.round(r.right) + ']')
        if (out.culpables.length >= 4) break
      }
    }
  }
  // Contraste: solo textos visibles y cortos, para no ahogarse
  /*
   * EL NAVEGADOR DEVUELVE DOS NOTACIONES, y la segunda me engañó.
   *
   * \`getComputedStyle\` da unos colores como \`rgb(95, 57, 81)\` —0 a 255— y
   * otros como \`color(srgb 0.371 0.224 0.319)\` —0 a 1—, según de dónde salga
   * el token. Dividiendo por 255 los segundos, todo salía casi negro y el
   * contraste daba 1.00:1 contra cualquier fondo: cinco avisos falsos y, lo
   * que importa, cualquier texto flojo DE VERDAD enterrado entre ellos.
   */
  const lum = (c) => {
    const nums = (c.match(/[\\d.]+/g) || []).slice(0, 3).map(Number)
    if (nums.length < 3) return 1
    const esc = /^color\\(/.test(c) || nums.every((v) => v <= 1)
    const [r,g,b] = nums.map((v) => {
      let x = esc ? v : v / 255
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
    })
    return 0.2126*r + 0.7152*g + 0.0722*b
  }
  /*
   * Y si por detrás hay una FOTO, no se juzga: el contraste depende del píxel
   * concreto y esto no puede saberlo. Devuelve null y el caso se salta, en vez
   * de inventarse un fondo blanco y dar un aviso que no significa nada (era el
   * caso del lema sobre la portada de la web).
   */
  const fondoDe = (el) => {
    let n = el
    while (n) {
      const c = getComputedStyle(n)
      if (c.backgroundImage && c.backgroundImage !== 'none') return null
      const b = c.backgroundColor
      if (b && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(b)) return b
      n = n.parentElement
    }
    return 'rgb(255,255,255)'
  }
  const vistos = new Set()
  for (const el of document.querySelectorAll('p,span,small,td,th,li,label,h1,h2,h3,h4,a,button,div')) {
    if (el.children.length) continue
    const t = (el.textContent||'').trim()
    if (!t || t.length > 60) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.1) continue
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue
    try {
      const fondo = fondoDe(el)
      if (fondo === null) continue
      const l1 = lum(cs.color), l2 = lum(fondo)
      const ratio = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)
      if (ratio < 3) {
        const k = el.className + '|' + Math.round(ratio*10)
        if (vistos.has(k)) continue
        vistos.add(k)
        out.flojos.push(ratio.toFixed(2) + ':1  ' + el.tagName.toLowerCase() + '.' + String(el.className||'').split(' ')[0] + '  «' + t.slice(0,34) + '»')
      }
    } catch {}
    if (out.flojos.length >= 5) break
  }
  return out
})()`

const RUTAS = [
  ['Inicio','/app'], ['Hermanos','/app/hermanos'], ['Cuotas','/app/cuotas'],
  ['Papeletas','/app/papeletas'], ['Cortejo','/app/cortejo'], ['Tesorería','/app/tesoreria'],
  ['Informes','/app/informes'], ['Comunicados','/app/comunicados'], ['Configuración','/app/configuracion'],
  ['Web pública','/app/web'], ['Eventos','/app/eventos'], ['Personal','/app/personal'],
  ['Tienda','/app/tienda'], ['Notificaciones','/app/notificaciones'], ['Campañas','/app/campanas'],
]
for (const [vista, ancho, tema] of [['MÓVIL 390 claro', 390, 'light'], ['MÓVIL 390 oscuro', 390, 'dark'], ['ESCRITORIO 1400 oscuro', 1400, 'dark']]) {
  console.log(`\n================== ${vista}`)
  await send('Emulation.setDeviceMetricsOverride',{width:ancho,height:844,deviceScaleFactor:1,mobile:ancho<500})
  for (const [n, ruta] of RUTAS) {
    errores = []
    await send('Page.navigate',{url:BASE+ruta})
    await espera(1800)
    await ev(`document.documentElement.setAttribute('data-theme','${tema}')`)
    await espera(400)
    const r = await ev(MEDIDA)
    if (typeof r === 'string') { console.log(`  ${n}: ${r}`); continue }
    const desborde = r.scroll > r.ancho + 1
    const err = errores.filter((e)=>!/favicon|Failed to load|net::ERR/.test(e))
    if (!desborde && !r.flojos.length && !err.length) { console.log(`  ok    ${n}`); continue }
    console.log(`  ${desborde ? 'DESBORDA' : '  ·   '} ${n}${desborde ? `  (${r.ancho}px de hueco, ${r.scroll}px de contenido)` : ''}`)
    for (const c of r.culpables) console.log(`          culpable: ${c}`)
    for (const f of r.flojos) console.log(`          contraste ${f}`)
    for (const e of err) console.log(`          ${e}`)
  }
}
ws.close(); chrome.kill()
