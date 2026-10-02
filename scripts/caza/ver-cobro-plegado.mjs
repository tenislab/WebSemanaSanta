/* El cobro en mano, plegado: cuánto ocupa cerrado, que se abra, y que no se
   cierre solo en mitad de un cobro. */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
const espera=(ms)=>new Promise(r=>setTimeout(r,ms))
const DONDE='/tmp/claude-0/fotos-cuotas'; mkdirSync(DONDE,{recursive:true})
const port=11900+Math.floor(Math.random()*90)
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
await send('Emulation.setDeviceMetricsOverride',{width:1420,height:1000,deviceScaleFactor:1,mobile:false})
const BASE='http://127.0.0.1:4173'
await send('Page.navigate',{url:`${BASE}/mirar.html?ir=/app`})
for(let i=0;i<80;i++){await espera(250);if(await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')"))break}
await espera(1200)
await send('Page.navigate',{url:`${BASE}/app/cuotas`}); await espera(3500)
errs=[]
const mide=`(() => {
  const d=document.querySelector('details.cobro-en-mano')
  if(!d) return {no:'no hay plegable de cobro'}
  const r=d.getBoundingClientRect()
  const hasta=document.querySelector('.stat-grid')?.getBoundingClientRect().top
  return {abierto:d.open, alto:Math.round(r.height), sumario:d.querySelector('summary').textContent.replace(/\\s+/g,' ').trim(),
    buscadorMontado: !!d.querySelector('#cobro-en-mano'), selectMontado: !!d.querySelector('#metodo-en-mano'),
    hastaLasCifras: hasta!=null ? Math.round(hasta) : null}
})()`
console.log('CERRADO:', JSON.stringify(await ev(mide)))
let s=await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`${DONDE}/cobro-cerrado.png`, Buffer.from(s.result.data,'base64'))
console.log('abrir:', await ev(`(() => { const d=document.querySelector('details.cobro-en-mano'); d.querySelector('summary').click(); return 'pulsado' })()`))
await espera(900)
console.log('ABIERTO:', JSON.stringify(await ev(mide)))
s=await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`${DONDE}/cobro-abierto.png`, Buffer.from(s.result.data,'base64'))
// Elegir un hermano y comprobar que no se cierra solo.
console.log('elegir hermano:', await ev(`(() => {
  const i=document.querySelector('input#cobro-en-mano')||document.querySelector('#cobro-en-mano input'); if(!i) return '(no hay buscador)'
  const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
  set.call(i,'Rafael'); i.dispatchEvent(new Event('input',{bubbles:true}))
  return 'escrito'
})()`))
await espera(900)
console.log('opción:', await ev(`(() => { const o=document.querySelector('.hermano-picker__opt:not(.hermano-picker__opt--vacio)'); if(!o) return '(sin opciones)'; const t=o.textContent.trim(); o.click(); return t })()`))
await espera(900)
console.log('con hermano elegido:', JSON.stringify(await ev(mide)))
const quien = () => ev(`(() => { const i=document.querySelector('input#cobro-en-mano'); return i? i.value : null })()`)
console.log('hermano en el campo:', await quien())
console.log('se cierra con un cobro a medias:', await ev(`(() => { const d=document.querySelector('details.cobro-en-mano'); d.querySelector('summary').click(); return 'pulsado' })()`))
await espera(900)
console.log('→', JSON.stringify(await ev(mide)))
console.log('y al volver a abrirlo:', await ev(`(() => { const d=document.querySelector('details.cobro-en-mano'); d.querySelector('summary').click(); return 'pulsado' })()`))
await espera(900)
console.log('→', JSON.stringify(await ev(mide)), '· sigue elegido:', await quien())
s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); writeFileSync(`${DONDE}/cobro-con-hermano.png`, Buffer.from(s.result.data,'base64'))
if(errs.length) console.log('ERRORES:', errs.slice(0,3))
console.log('fotos en', DONDE)
ws.close();chrome.kill()
