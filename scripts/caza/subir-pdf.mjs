/* ¿Se puede subir un PDF al archivo documental y vuelve? Se sube de verdad,
   con DOM.setFileInputFiles, y se mira si el documento queda con su adjunto. */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
const espera=(ms)=>new Promise(r=>setTimeout(r,ms))
const DONDE='/tmp/claude-0/fotos-archivo'; mkdirSync(DONDE,{recursive:true})
const PDF = process.env.PDF || '/tmp/claude-0/reglas-de-la-hermandad.pdf'
const port=12300+Math.floor(Math.random()*90)
const chrome=spawn('/opt/pw-browsers/chromium-1194/chrome-linux/chrome',['--headless=new','--disable-gpu','--no-sandbox','--disable-background-networking','--disable-component-update',`--remote-debugging-port=${port}`,'about:blank'],{stdio:'ignore'})
let wsUrl
for(let i=0;i<60&&!wsUrl;i++){await espera(200);try{wsUrl=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page')?.webSocketDebuggerUrl}catch{}}
const ws=new WebSocket(wsUrl);await new Promise(r=>(ws.onopen=r))
let id=0;const pend=new Map();let errs=[]
ws.onmessage=(m)=>{const g=JSON.parse(m.data);if(g.id&&pend.has(g.id)){pend.get(g.id)(g);pend.delete(g.id)}
 if(g.method==='Runtime.exceptionThrown')errs.push('EXC: '+String(g.params.exceptionDetails.exception?.description??g.params.exceptionDetails.text).slice(0,200))}
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))})
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value
await send('Page.enable');await send('Runtime.enable');await send('DOM.enable')
await send('Emulation.setDeviceMetricsOverride',{width:1420,height:1100,deviceScaleFactor:1,mobile:false})
const BASE='http://127.0.0.1:4173'
await send('Page.navigate',{url:`${BASE}/mirar.html?ir=/app`})
for(let i=0;i<80;i++){await espera(250);if(await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')"))break}
await espera(1200)
await send('Page.navigate',{url:`${BASE}/app/archivo`}); await espera(3500)
errs=[]
console.log('abrir el alta:', await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Nuevo documento|Subir documento|A.adir/i.test(x.textContent)); if(!b) return '(no hay botón) '+[...document.querySelectorAll('button')].map(x=>x.textContent.trim()).slice(0,10).join(' | '); b.click(); return b.textContent.trim() })()`))
await espera(1200)
console.log('campos del alta:', await ev(`(() => { const f=document.querySelector('.drawer form'); if(!f) return '(no hay formulario)'; return [...f.querySelectorAll('input,select,textarea')].map(x=>x.id||x.name||x.type).join(', ') })()`))
console.log('categorías:', await ev(`(() => { const s=document.querySelector('#categoria, .drawer select'); return s? [...s.options].map(o=>o.value).join(' | ') : '(no hay)' })()`))
// Rellenar y adjuntar el PDF de verdad.
console.log('rellenar:', await ev(`(() => {
  const f=document.querySelector('.drawer form'); if(!f) return '(no hay form)'
  const set=(sel,v)=>{ const el=f.querySelector(sel); if(!el) return sel+' NO ESTÁ'
    const proto = el.tagName==='SELECT'? window.HTMLSelectElement : el.tagName==='TEXTAREA'? window.HTMLTextAreaElement : window.HTMLInputElement
    Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(el,v)
    el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return 'ok' }
  const r=[]
  r.push('categoria:'+set('#categoria','Regla'))
  r.push('nombre:'+set('#nombre','Reglas de la hermandad'))
  r.push('fecha:'+set('#fecha','2026-01-15'))
  return r.join(' · ')
})()`))
await espera(600)
const doc = await send('DOM.getDocument',{depth:-1})
const nodo = await send('DOM.querySelector',{nodeId:doc.result.root.nodeId, selector:'#archivo'})
console.log('input de archivo:', nodo.result?.nodeId ? 'encontrado' : JSON.stringify(nodo))
if(nodo.result?.nodeId){
  const r = await send('DOM.setFileInputFiles',{nodeId:nodo.result.nodeId, files:[PDF]})
  console.log('adjuntar el PDF:', r.error ? JSON.stringify(r.error) : 'puesto')
  console.log('lo que ve el formulario:', await ev(`(() => { const i=document.querySelector('#archivo'); const f=i.files[0]; return f? f.name+' · '+f.type+' · '+f.size+' bytes' : '(sin fichero)' })()`))
}
let s=await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`${DONDE}/alta-con-pdf.png`, Buffer.from(s.result.data,'base64'))
console.log('guardar:', await ev(`(() => { const b=[...document.querySelectorAll('.drawer button, .drawer__foot button')].find(x=>/Guardar|Archivar|A.adir/i.test(x.textContent)); if(!b) return '(no hay botón de guardar) '+[...document.querySelectorAll('.drawer button')].map(x=>x.textContent.trim()).join(' | '); b.click(); return b.textContent.trim() })()`))
await espera(2500)
console.log('\n¿ha quedado guardado?', JSON.stringify(await ev(`(() => {
  const guardados = JSON.parse(localStorage.getItem('cabildo-documentos')||'[]')
  const mio = guardados.find(d=>d.nombre==='Reglas de la hermandad')
  const filas = [...document.querySelectorAll('tbody tr')].map(t=>t.innerText.replace(/\\s+/g,' ').trim()).filter(t=>/Reglas de la hermandad/.test(t))
  return {enLaLista: filas, enElAlmacen: mio? {categoria:mio.categoria, archivoNombre:mio.archivoNombre, archivoTipo:mio.archivoTipo, archivoTamano:mio.archivoTamano} : null}
})()`),null,1))
if(errs.length) console.log('ERRORES:', errs.slice(0,3))
s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); writeFileSync(`${DONDE}/archivo-con-la-regla.png`, Buffer.from(s.result.data,'base64'))
console.log('fotos en', DONDE)
ws.close();chrome.kill()
