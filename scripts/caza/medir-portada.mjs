/* Cuánto se estira una foto de fondo en la cabecera, de verdad, a varios
   anchos de pantalla y con las tres alturas. De aquí sale el número del aviso:
   no se escribe «puede perder calidad» sin saber por cuánto. */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
const espera=(ms)=>new Promise(r=>setTimeout(r,ms))
const DONDE='/tmp/claude-0/fotos-portada'; mkdirSync(DONDE,{recursive:true})
const port=12700+Math.floor(Math.random()*90)
const chrome=spawn('/opt/pw-browsers/chromium-1194/chrome-linux/chrome',['--headless=new','--disable-gpu','--no-sandbox','--disable-background-networking','--disable-component-update',`--remote-debugging-port=${port}`,'about:blank'],{stdio:'ignore'})
let wsUrl
for(let i=0;i<60&&!wsUrl;i++){await espera(200);try{wsUrl=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page')?.webSocketDebuggerUrl}catch{}}
const ws=new WebSocket(wsUrl);await new Promise(r=>(ws.onopen=r))
let id=0;const pend=new Map();let errs=[]
ws.onmessage=(m)=>{const g=JSON.parse(m.data);if(g.id&&pend.has(g.id)){pend.get(g.id)(g);pend.delete(g.id)}
 if(g.method==='Runtime.exceptionThrown')errs.push('EXC: '+String(g.params.exceptionDetails.exception?.description??g.params.exceptionDetails.text).slice(0,200))}
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))})
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value
await send('Page.enable');await send('Runtime.enable')
const BASE='http://127.0.0.1:4173'
await send('Emulation.setDeviceMetricsOverride',{width:1420,height:900,deviceScaleFactor:1,mobile:false})
await send('Page.navigate',{url:`${BASE}/mirar.html?ir=/app`})
for(let i=0;i<80;i++){await espera(250);if(await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')"))break}
await espera(1200)

console.log('── CUÁNTO MIDE LA CABECERA, por ancho de pantalla y altura elegida ──')
for (const ancho of [390, 768, 1366, 1920, 2560]) {
  await send('Emulation.setDeviceMetricsOverride',{width:ancho,height:Math.round(ancho*0.62),deviceScaleFactor:1,mobile:ancho<700})
  await send('Page.navigate',{url:`${BASE}/app/web`}); await espera(3200)
  // La vista previa del editor trae el mismo marcado que la web de verdad.
  // Se pone a ancho completo para que la medida sea la del visitante y no la
  // del hueco del editor.
  await ev(`(() => { const p=document.querySelector('.sitio'); if(!p) return 0
    const caja=p.closest('[class*=previa], [class*=preview], [class*=marco]')||p.parentElement
    if(caja){ caja.style.width='100%'; caja.style.maxWidth='none' }
    p.style.width='100%'; p.style.maxWidth='none'; return 1 })()`)
  await espera(600)
  const r = await ev(`(() => {
    const h=document.querySelector('.sitio__hero'); if(!h) return null
    const dentro = h.closest('[style*="container"]') || h.parentElement
    const b=h.getBoundingClientRect()
    const cs=getComputedStyle(h)
    return { hero: Math.round(b.width)+'×'+Math.round(b.height),
      anchoDelContenedor: Math.round((h.closest('.sitio')||h).getBoundingClientRect().width),
      altura: [...h.classList].find(c=>c.startsWith('sitio__hero--'))||'(ninguna)',
      recorte: cs.backgroundSize, dpr: devicePixelRatio, ventana: innerWidth }
  })()`)
  if (!r) { console.log(`${ancho} px → (no hay cabecera; ¿la ruta es otra?)`); continue }
  const [w,h] = r.hero.split('×').map(Number)
  // Lo que de verdad hay que cubrir en píxeles de pantalla.
  const pxReales = Math.round(w * r.dpr)
  const estira = (desde) => (pxReales/desde).toFixed(2)
  console.log(`${String(ancho).padStart(4)} px → cabecera ${r.hero} · el sitio mide ${r.anchoDelContenedor} px · ${w===r.anchoDelContenedor?'LA CABECERA OCUPA TODO EL ANCHO':'NO lo ocupa'}`)
}

// ─────────────────────────────────────────────────────────────────────────
// Y AHORA EL PASO: que haya una capa por foto, que se cruce y que pase.
// ─────────────────────────────────────────────────────────────────────────
await send('Emulation.setDeviceMetricsOverride',{width:1420,height:1000,deviceScaleFactor:1,mobile:false})
const sembrar = async () => ev(`(() => {
  const k='cabildo-web-publica'
  const w=JSON.parse(localStorage.getItem(k)||'{}')
  const foto=(c)=>'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250"><rect width="400" height="250" fill="'+c+'"/></svg>')
  w.heroFotos=[foto('#8b1a2b'),foto('#1a4d2e'),foto('#2b2b6b')]
  localStorage.setItem(k, JSON.stringify(w))
  return w.heroFotos.length+' fotos sembradas'
})()`)
await send('Page.navigate',{url:`${BASE}/app/web`}); await espera(2600)
console.log('\n──', await sembrar())
await send('Page.navigate',{url:`${BASE}/app/web`}); await espera(3400)
const estado = `(() => {
  const capas=[...document.querySelectorAll('.sitio__hero-foto')]
  const h=document.querySelector('.sitio__hero')
  return {
    capas: capas.length,
    opacidades: capas.map(c=>Number(getComputedStyle(c).opacity).toFixed(2)),
    transicion: capas[0] ? getComputedStyle(capas[0]).transitionDuration : null,
    fondoEnLaSeccion: h ? getComputedStyle(h).backgroundImage.slice(0,20) : null,
    puesta: capas.findIndex(c=>c.classList.contains('sitio__hero-foto--puesta')),
  }
})()`
console.log('al entrar: ', JSON.stringify(await ev(estado)))
await espera(5600)
console.log('a los 5 s: ', JSON.stringify(await ev(estado)))
await espera(5600)
console.log('a los 11 s:', JSON.stringify(await ev(estado)))
const s1=await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`${DONDE}/portada-con-fondos.png`, Buffer.from(s1.result.data,'base64'))

// Con «que nada se mueva» pedido.
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
await send('Page.navigate',{url:`${BASE}/app/web`}); await espera(3400)
console.log('\nquieto, al entrar:', JSON.stringify(await ev(estado)))
await espera(6000)
console.log('quieto, a los 6 s:', JSON.stringify(await ev(estado)))

// Y el aviso de las medidas, donde se sube.
console.log('\npestaña Portada:', await ev(`(() => { const b=[...document.querySelectorAll('button,a')].find(x=>/^Portada$/.test(x.textContent.trim())); if(!b) return '(no hay) '+[...document.querySelectorAll('button')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,14).join(' | '); b.click(); return 'pulsada' })()`))
await espera(1800)
console.log('aviso de medidas:', await ev(`(() => {
  const p=[...document.querySelectorAll('.form-hint--aviso')].find(x=>/1\\.920/.test(x.textContent))
  return p? p.textContent.replace(/\\s+/g,' ').trim() : 'NO SALE'
})()`))
if(errs.length) console.log('ERRORES:', errs.slice(0,2))
ws.close();chrome.kill()
