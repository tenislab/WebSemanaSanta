/* Los documentos en sus tres sitios: el panel, el área del hermano y la web. */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
const espera=(ms)=>new Promise(r=>setTimeout(r,ms))
const DONDE='/tmp/claude-0/fotos-docs'; mkdirSync(DONDE,{recursive:true})
const port=13100+Math.floor(Math.random()*90)
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
await send('Emulation.setDeviceMetricsOverride',{width:1420,height:1100,deviceScaleFactor:1,mobile:false})
const BASE='http://127.0.0.1:4173'
await send('Page.navigate',{url:`${BASE}/mirar.html?ir=/app`})
for(let i=0;i<80;i++){await espera(250);if(await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')"))break}
await espera(1200)

console.log('═══ EL PANEL ═══')
await send('Page.navigate',{url:`${BASE}/app/archivo`}); await espera(3400); errs=[]
console.log('la columna de la lista:', JSON.stringify(await ev(`(() => {
  const filas=[...document.querySelectorAll('tbody tr')]
  return filas.slice(0,6).map(f => { const c=[...f.querySelectorAll('td')]
    return (c[1]?.innerText.split('\\n')[0]||'').slice(0,34)+' → '+(c[3]?.innerText.trim()||'?') })
})()`),null,1))
console.log('abrir el alta:', await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Nuevo documento/.test(x.textContent)); b&&b.click(); return !!b })()`))
await espera(1100)
console.log('las dos preguntas:', JSON.stringify(await ev(`(() => {
  const f=document.querySelector('.drawer form'); if(!f) return 'no hay form'
  return {
    rotulos: [...f.querySelectorAll('.assign-box > label')].map(l=>l.textContent.trim()),
    opcionesDeSalida: [...(f.querySelector('#publicacion')?.options ?? [])].map(o=>o.textContent.trim()),
    notaDeSalida: f.querySelector('#publicacion')?.closest('.assign-box')?.querySelector('.form-hint')?.textContent.trim(),
  }
})()`),null,1))
// Al poner «La web pública» con un acta, tiene que avisar.
console.log('acta a la web:', await ev(`(() => {
  const f=document.querySelector('.drawer form')
  const set=(sel,v)=>{ const el=f.querySelector(sel); const proto= el.tagName==='SELECT'?window.HTMLSelectElement:window.HTMLInputElement
    Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(el,v)
    el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('input',{bubbles:true})) }
  set('#categoria','Acta'); set('#publicacion','web')
  return 'puesto'
})()`))
await espera(900)
console.log('¿avisa?:', await ev(`(() => { const a=[...document.querySelectorAll('.drawer .form-hint--aviso')].find(x=>/acta/i.test(x.textContent)); return a? a.textContent.replace(/\\s+/g,' ').trim() : 'NO AVISA' })()`))
// Y con restringido, el desplegable se apaga.
console.log('restringido:', await ev(`(() => { const r=document.querySelector('#visibilidadRestringido'); r&&r.click(); return !!r })()`))
await espera(800)
console.log('→ el desplegable queda:', await ev(`(() => { const s=document.querySelector('#publicacion'); return s? (s.disabled? 'apagado · '+s.value : 'ENCENDIDO') : 'no hay' })()`))
console.log('→ y dice:', await ev(`(() => document.querySelector('#publicacion')?.closest('.assign-box')?.querySelector('.form-hint')?.textContent.trim())()`))
let s=await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`${DONDE}/panel-hasta-donde-sale.png`, Buffer.from(s.result.data,'base64'))
if(errs.length) console.log('ERRORES:', errs.slice(0,2))

console.log('\n═══ LA WEB PÚBLICA (vista previa del editor) ═══')
errs=[]
await send('Page.navigate',{url:`${BASE}/app/web`}); await espera(3400)
// Y a dos documentos se les pone adjunto: los de ejemplo no tienen ninguno,
// así que sin esto no se llega a ver el botón de descarga por ningún lado.
console.log('poner adjuntos:', await ev(`(() => {
  const k='cabildo-documentos'
  // Los de ejemplo viven en el código, así que la clave está vacía: se escribe
  // una lista a mano con adjunto para poder ver el botón de descarga.
  let l=JSON.parse(localStorage.getItem(k)||'[]')
  if(l.length===0){
    l=[{id:'w1', numero:1, nombre:'Reglas y Estatutos', categoria:'Regla', fecha:'2019-05-10',
        fechaAlta:'2025-09-01', descripcion:'Texto refundido aprobado por el Arzobispado.',
        archivadoPor:'Secretaría', cargosConAcceso:null, publicacion:'web', tipoCabildo:null,
        proveedor:null, vigenciaHasta:null, estadoExpediente:null,
        archivoNombre:'reglas-y-estatutos.pdf', archivoTipo:'application/pdf', archivoTamano:184320},
       {id:'w2', numero:2, nombre:'Acta de Cabildo General', categoria:'Acta', fecha:'2026-01-18',
        fechaAlta:'2026-01-20', descripcion:'Cuentas del ejercicio.', archivadoPor:'Secretaría',
        cargosConAcceso:null, publicacion:'junta', tipoCabildo:'General', proveedor:null,
        vigenciaHasta:null, estadoExpediente:null, archivoNombre:'acta.pdf',
        archivoTipo:'application/pdf', archivoTamano:92160}]
    localStorage.setItem(k, JSON.stringify(l))
    return 'sembrados 2: unas reglas con adjunto (web) y un acta (junta)'
  }
  let n=0
  for(const d of l){ if(d.publicacion==='web' && !d.archivoNombre){
    d.archivoNombre=d.nombre.slice(0,20).replace(/[^a-zA-Z0-9]+/g,'-')+'.pdf'
    d.archivoTipo='application/pdf'; d.archivoTamano=184320; n++ } }
  localStorage.setItem(k, JSON.stringify(l))
  return n+' documentos con adjunto'
})()`))
console.log('encender la sección:', await ev(`(() => {
  const k='cabildo-web-publica'
  const w=JSON.parse(localStorage.getItem(k)||'{}')
  w.secciones=(w.secciones||[]).map(s=>s.tipo==='documentos'?{...s,visible:true}:s)
  if(!(w.secciones||[]).some(s=>s.tipo==='documentos')) (w.secciones=w.secciones||[]).push({tipo:'documentos',visible:true})
  localStorage.setItem(k, JSON.stringify(w))
  return 'encendida'
})()`))
await send('Page.navigate',{url:`${BASE}/app/web`}); await espera(3800)
console.log(JSON.stringify(await ev(`(() => {
  const sec=document.querySelector('#documentos')
  if(!sec) return {no:'la sección no sale'}
  return {
    titulo: sec.querySelector('h2')?.textContent.trim(),
    documentos: [...sec.querySelectorAll('.sitio-documentos__item')].map(li=>li.innerText.replace(/\\s+/g,' ').trim().slice(0,70)),
    botones: [...sec.querySelectorAll('button')].map(b=>b.textContent.trim()+(b.disabled?' · APAGADO':' · encendido')),
    siVacio: sec.querySelector('.sitio__entradilla')?.textContent.trim(),
  }
})()`),null,1))
if(errs.length) console.log('ERRORES:', errs.slice(0,2))
s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); writeFileSync(`${DONDE}/web-documentos.png`, Buffer.from(s.result.data,'base64'))

console.log('\n═══ EL ÁREA DEL HERMANO ═══')
errs=[]
// Una sesión de hermano de muestra: el portal pide identificarse y sin esto
// solo se ve la pantalla de entrar.
await send('Page.navigate',{url:`${BASE}/hermano`}); await espera(2500)
console.log('sembrar sesión:', await ev(`(() => {
  sessionStorage.setItem('cabildo-hermano-portal', JSON.stringify({hermandadId:'esperanza', hermanoId:'e1'}))
  return 'puesta'
})()`))
await send('Page.navigate',{url:`${BASE}/hermano`}); await espera(4000)
console.log('ruta:', await ev('location.pathname'))
console.log(JSON.stringify(await ev(`(() => {
  const sec=[...document.querySelectorAll('.portal__section')].find(s=>/Documentos de la hermandad/.test(s.textContent))
  if(!sec) return {no:'el apartado no sale', apartados:[...document.querySelectorAll('.portal__section h2')].map(h=>h.textContent.trim()).slice(0,12)}
  return {
    titulo: sec.querySelector('h2')?.textContent.trim(),
    documentos: [...sec.querySelectorAll('.documentos__fila')].map(li=>li.innerText.replace(/\\s+/g,' ').trim().slice(0,80)),
    botones: [...sec.querySelectorAll('button')].map(b=>b.textContent.trim()),
    alto: Math.round(sec.getBoundingClientRect().height),
  }
})()`),null,1))
if(errs.length) console.log('ERRORES:', errs.slice(0,2))
const s3=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); writeFileSync(`${DONDE}/area-del-hermano.png`, Buffer.from(s3.result.data,'base64'))
console.log('\nfotos en', DONDE)
ws.close();chrome.kill()
