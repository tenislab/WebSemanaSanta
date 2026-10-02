/* El campo de imagen, en las dos pantallas donde se ha puesto: se sube un PNG
   de verdad y se mira si queda guardado en el registro. */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
const espera=(ms)=>new Promise(r=>setTimeout(r,ms))
const DONDE='/tmp/claude-0/fotos-imagen'; mkdirSync(DONDE,{recursive:true})
const IMG='/tmp/claude-0/cartel.png'
const port=12500+Math.floor(Math.random()*90)
const chrome=spawn('/opt/pw-browsers/chromium-1194/chrome-linux/chrome',['--headless=new','--disable-gpu','--no-sandbox','--disable-background-networking','--disable-component-update',`--remote-debugging-port=${port}`,'about:blank'],{stdio:'ignore'})
let wsUrl
for(let i=0;i<60&&!wsUrl;i++){await espera(200);try{wsUrl=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page')?.webSocketDebuggerUrl}catch{}}
const ws=new WebSocket(wsUrl);await new Promise(r=>(ws.onopen=r))
let id=0;const pend=new Map();let errs=[]
ws.onmessage=(m)=>{const g=JSON.parse(m.data);if(g.id&&pend.has(g.id)){pend.get(g.id)(g);pend.delete(g.id)}
 if(g.method==='Runtime.exceptionThrown')errs.push('EXC: '+String(g.params.exceptionDetails.exception?.description??g.params.exceptionDetails.text).slice(0,200))}
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))})
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value
const poner=async(sel)=>{ const d=await send('DOM.getDocument',{depth:-1})
  const n=await send('DOM.querySelector',{nodeId:d.result.root.nodeId, selector:sel})
  if(!n.result?.nodeId) return '(no está '+sel+')'
  const r=await send('DOM.setFileInputFiles',{nodeId:n.result.nodeId, files:[IMG]})
  return r.error ? JSON.stringify(r.error) : 'puesto' }
const escribir=(sel,v)=>ev(`(() => { const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return ${JSON.stringify(sel)}+' NO ESTÁ'
  const proto = el.tagName==='SELECT'? window.HTMLSelectElement : el.tagName==='TEXTAREA'? window.HTMLTextAreaElement : window.HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(el,${JSON.stringify(v)})
  el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return 'ok' })()`)
await send('Page.enable');await send('Runtime.enable');await send('DOM.enable')
await send('Emulation.setDeviceMetricsOverride',{width:1420,height:1100,deviceScaleFactor:1,mobile:false})
const BASE='http://127.0.0.1:4173'
await send('Page.navigate',{url:`${BASE}/mirar.html?ir=/app`})
for(let i=0;i<80;i++){await espera(250);if(await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')"))break}
await espera(1200)

console.log('═══ EVENTOS ═══')
await send('Page.navigate',{url:`${BASE}/app/eventos`}); await espera(3500); errs=[]
console.log('abrir el alta:', await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Nuevo acto|Nuevo evento|\\+ /i.test(x.textContent)); if(!b) return '(no hay) '+[...document.querySelectorAll('button')].map(x=>x.textContent.trim()).slice(0,8).join(' | '); b.click(); return b.textContent.trim() })()`))
await espera(1000)
console.log('hay campo de imagen:', await ev(`!!document.querySelector('.drawer .campo-imagen')`))
console.log('rótulo:', await ev(`document.querySelector('.drawer .campo-imagen label')?.textContent`))
console.log('ayuda:', await ev(`document.querySelector('.drawer .campo-imagen .form-hint')?.textContent`))
console.log('titulo:', await escribir('#tituloEvento, .drawer input[name=titulo]','Triduo al Nazareno'))
console.log('fecha:', await escribir('.drawer input[name=fecha]','2027-02-10'))
console.log('subir:', await poner('.drawer .campo-imagen__input'))
await espera(1500)
console.log('vista previa:', await ev(`(() => { const i=document.querySelector('.drawer .campo-imagen__vista img'); return i? 'sí · '+i.src.slice(0,40)+'…' : 'NO SALE' })()`))
console.log('peso que dice:', await ev(`document.querySelector('.drawer .campo-imagen__datos .table-subtle')?.textContent`))
let s=await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`${DONDE}/evento-con-cartel.png`, Buffer.from(s.result.data,'base64'))
console.log('guardar:', await ev(`(() => { const b=[...document.querySelectorAll('.drawer button')].find(x=>/Crear|Guardar|A.adir/i.test(x.textContent)); if(!b) return '(no hay) '+[...document.querySelectorAll('.drawer button')].map(x=>x.textContent.trim()).join(' | '); b.click(); return b.textContent.trim() })()`))
await espera(2000)
console.log('¿guardado con cartel?', JSON.stringify(await ev(`(() => {
  const l=JSON.parse(localStorage.getItem('cabildo-eventos')||'[]')
  const m=l.find(e=>e.titulo==='Triduo al Nazareno')
  return m? {titulo:m.titulo, imagen: m.imagen? m.imagen.slice(0,30)+'…' : null} : '(no está)'
})()`)))
console.log('y en la ficha se puede cambiar:', await ev(`!!document.querySelector('.drawer .campo-imagen')`))
// Cerrar la ficha y mirar la lista de próximos.
await ev(`(() => { const b=[...document.querySelectorAll('.drawer button, .drawer__close')].find(x=>/Cerrar|Volver/i.test(x.textContent)||x.className.includes('drawer__close')); b&&b.click(); return 1 })()`)
await espera(1200)
console.log('miniatura en la lista:', await ev(`(() => {
  const li=[...document.querySelectorAll('.eventos-lista li')].find(x=>/Triduo al Nazareno/.test(x.textContent))
  if(!li) return '(el acto no sale en la lista)'
  const img=li.querySelector('.eventos-item__cartel')
  if(!img) return 'NO HAY MINIATURA'
  const r=img.getBoundingClientRect()
  return Math.round(r.width)+'×'+Math.round(r.height)+' px · pintada: '+(img.complete && img.naturalWidth>0)
})()`))
console.log('y los actos SIN cartel no dejan hueco:', await ev(`(() => {
  const sin=[...document.querySelectorAll('.eventos-lista li')].filter(x=>!x.querySelector('.eventos-item__cartel'))
  return sin.length+' de '+document.querySelectorAll('.eventos-lista li').length+' sin miniatura'
})()`))
s=await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`${DONDE}/ficha-del-evento.png`, Buffer.from(s.result.data,'base64'))
if(errs.length) console.log('ERRORES:', errs.slice(0,2))

console.log('\n═══ TIENDA ═══')
errs=[]
await send('Page.navigate',{url:`${BASE}/app/tienda/articulos`}); await espera(3500)
console.log('ruta:', await ev('location.pathname'))
console.log('pestaña Artículos:', await ev(`(() => { const b=[...document.querySelectorAll('button,a')].find(x=>/^Art.culos/.test(x.textContent.trim())); if(!b) return '(no hay pestaña)'; b.click(); return 'pulsada' })()`))
await espera(1800)
console.log('abrir ficha:', await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Nuevo art.culo|\\+ Nuevo/i.test(x.textContent)); if(!b) return '(no hay) '+[...document.querySelectorAll('button')].map(x=>x.textContent.trim()).slice(0,10).join(' | '); b.click(); return b.textContent.trim() })()`))
await espera(1000)
console.log('hay campo de imagen:', await ev(`!!document.querySelector('.drawer .campo-imagen')`))
console.log('rótulo:', await ev(`document.querySelector('.drawer .campo-imagen label')?.textContent`))
console.log('campo oculto fotoUrl:', await ev(`!!document.querySelector('.drawer input[name=fotoUrl][type=hidden]')`))
console.log('subir:', await poner('.drawer .campo-imagen__input'))
await espera(1500)
console.log('vista previa:', await ev(`(() => { const i=document.querySelector('.drawer .campo-imagen__vista img'); return i? 'sí' : 'NO SALE' })()`))
console.log('lo que viaja en el formulario:', await ev(`document.querySelector('.drawer input[name=fotoUrl]')?.value.slice(0,30)+'…'`))
s=await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`${DONDE}/articulo-con-foto.png`, Buffer.from(s.result.data,'base64'))
if(errs.length) console.log('ERRORES:', errs.slice(0,2))
console.log('\nfotos en', DONDE)
ws.close();chrome.kill()
