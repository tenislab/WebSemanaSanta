/* El día de salida y la asistencia, pintados: qué pone el rótulo, cuántos ✓ hay
   en la misma ficha y si los chips de asistencia se van al papel. */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
const espera=(ms)=>new Promise(r=>setTimeout(r,ms))
const DONDE='/tmp/claude-0/fotos-cortejo'; mkdirSync(DONDE,{recursive:true})
const port=11700+Math.floor(Math.random()*90)
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
await send('Emulation.setDeviceMetricsOverride',{width:1420,height:1400,deviceScaleFactor:1,mobile:false})
const BASE='http://127.0.0.1:4173'
await send('Page.navigate',{url:`${BASE}/mirar.html?ir=/app`})
for(let i=0;i<80;i++){await espera(250);if(await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')"))break}
await espera(1200)

console.log('sembrado:', await ev(`(() => {
  const ANIO=(JSON.parse(localStorage.getItem('cabildo-campana')||'{}').anio)||2027
  const hs=[]
  for(let i=0;i<40;i++)hs.push({id:'H'+i,numero:i+1,nombre:['Rafael Ortiz Cabrera','Carmen Ruiz Nieto','Manuel Vega Mora','Rocío Luna Prado'][i%4]+' '+(i+1),estado:'Activo',antiguedad:1990+i,email:'h'+i+'@e.es',telefono:'600000000',direccion:'Calle x',cuotaAlDia:true,iban:null,dni:String(10000000+i)+'Z',claveAcceso:'x',authUserId:null,cargo:'',etiquetas:[]})
  localStorage.setItem('cabildo-hermanos',JSON.stringify(hs))
  const tramos=JSON.parse(localStorage.getItem('cabildo-tramos')||'null')
  const t = (tramos && tramos.length) ? tramos : [{id:'t3',nombre:'Cirio 1º tramo',capacidad:40}]
  const ps=[]
  if(t){ const uno=t.find(x=>x.id==='t3')||t[0]
    hs.forEach((h,i)=>ps.push({id:'P'+i,numero:i+1,hermanoId:h.id,anio:ANIO,tramoId:uno.id,importe:18,estado:i%4===0?'Reservada':'Pagada',fechaSolicitud:'2026-01-10'}))
    localStorage.setItem('cabildo-papeletas',JSON.stringify(ps))
    return hs.length+' hermanos · '+ps.length+' papeletas de '+ANIO+' en «'+uno.nombre+'» (aforo '+uno.capacidad+')'
  }
  return 'NO HAY TRAMOS en localStorage: '+Object.keys(localStorage).filter(k=>k.includes('tramo')).join(',')
})()`))

await send('Page.navigate',{url:`${BASE}/app/cortejo`}); await espera(3500)
errs=[]
// Encender el día de salida.
console.log('día de salida:', await ev(`(() => { const c=document.getElementById('diaDeSalida'); if(!c) return '(no hay interruptor)'; if(!c.checked) c.click(); return c.checked ? 'encendido' : 'NO se enciende' })()`))
await espera(1200)
// Abrir el primer tramo.
console.log('abrir tramo:', await ev(`(() => {
  const cards=[...document.querySelectorAll('article.tramo-card')]
  const c=cards.find(x=>x.textContent.indexOf('40/40')>=0)||cards[0]
  if(!c) return '(no hay tarjetas de tramo)'
  c.click()
  return 'pulsada la tarjeta «'+c.textContent.replace(/\\s+/g,' ').slice(0,40)+'» de '+cards.length
})()`))
await espera(2000)
const ficha = await ev(`(() => {
  const f=document.querySelector('.ficha'); if(!f) return {no:'no hay .ficha abierta'}
  const filas=[...f.querySelectorAll('.cortejo-roster li')]
  const nombres=[...f.querySelectorAll('.cortejo-roster .row-person__name, .asistencia__quien b')].map(x=>x.textContent.trim())
  const repes=nombres.filter((n,i)=>nombres.indexOf(n)!==i)
  return {
    dt: [...f.querySelectorAll('dt')].map(d=>d.textContent.trim()),
    parrafos: [...f.querySelectorAll('dd > .form-hint')].map(p=>p.textContent.replace(/\\s+/g,' ').trim().slice(0,120)),
    resumen: [...f.querySelectorAll('.asistencia__resumen .pill')].map(p=>p.textContent.trim()),
    filas: filas.length,
    nombresRepetidos: repes.length,
    primeraFila: filas[0] ? filas[0].textContent.replace(/\\s+/g,' ').trim() : null,
    botonesDeLaPrimera: filas[0] ? [...filas[0].querySelectorAll('button')].map(b=>b.getAttribute('title')||b.textContent.trim()) : [],
    plegable: (()=>{ const d=f.querySelector('details.asistencia-plegada'); return d? {sumario:d.querySelector('summary').textContent.replace(/\\s+/g,' ').trim(), abierto:d.open} : null })(),
    cajaAsistenciaAparte: !!f.querySelector('.assign-box:not(details)'),
    alto: Math.round(f.getBoundingClientRect().height),
    nodos: f.querySelectorAll('*').length,
  }
})()`)
console.log('\n=== LA FICHA DEL TRAMO, CON EL DÍA DE SALIDA ENCENDIDO ===')
console.log(JSON.stringify(ficha,null,1))
if(errs.length) console.log('\nERRORES:', errs.slice(0,3))
const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
writeFileSync(`${DONDE}/tramo-dia-de-salida.png`, Buffer.from(s.result.data,'base64'))
// Y la caja sola, recortada.
const caja = await ev(`(() => { const a=document.querySelector('.assign-box'); if(!a) return null; const r=a.getBoundingClientRect(); a.scrollIntoView({block:'center'}); const r2=a.getBoundingClientRect(); return {x:Math.max(0,r2.x-16),y:Math.max(0,r2.y-60),w:r2.width+32,h:r2.height+120} })()`)
if(caja){ await espera(400)
  const s2=await send('Page.captureScreenshot',{format:'png',clip:{...caja,scale:1}})
  if(!s2.result?.data){console.log('(no pude recortar la caja)')}else
  writeFileSync(`${DONDE}/caja-asistencia.png`, Buffer.from(s2.result.data,'base64'))
}
// El mismo tramo con el día de salida APAGADO.
await send('Page.navigate',{url:`${BASE}/app/cortejo`}); await espera(3200)
await ev(`(() => { const cards=[...document.querySelectorAll('article.tramo-card')]; const c=cards.find(x=>x.textContent.indexOf('40/40')>=0)||cards[0]; c&&c.click(); return 1 })()`)
await espera(1800)
console.log('\n=== EL MISMO TRAMO, DÍA DE SALIDA APAGADO ===')
console.log(JSON.stringify(await ev(`(() => {
  const f=document.querySelector('.ficha'); if(!f) return {no:'no hay ficha'}
  const d=f.querySelector('details.asistencia-plegada')
  return {
    dt: [...f.querySelectorAll('dt')].map(x=>x.textContent.trim()),
    filas: f.querySelectorAll('.cortejo-roster li').length,
    plegable: d? {sumario:d.querySelector('summary').textContent.replace(/\\s+/g,' ').trim(), abierto:d.open, chipsDentro:d.querySelectorAll('button.chip').length} : null,
    alto: Math.round(f.getBoundingClientRect().height),
  }
})()`),null,1))
const sApagado=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
writeFileSync(`${DONDE}/tramo-sin-dia-de-salida.png`, Buffer.from(sApagado.result.data,'base64'))
// Y que el plegable se abra.
console.log('al abrir el plegable:', await ev(`(() => { const d=document.querySelector('details.asistencia-plegada'); if(!d) return '(no hay)'; d.scrollIntoView({block:'center'}); d.querySelector('summary').click(); d.scrollIntoView({block:'start'}); return 'abierto' })()`))
await espera(900)
console.log(await ev(`(() => { const d=document.querySelector('details.asistencia-plegada'); return d? d.open+' · chips visibles: '+[...d.querySelectorAll('button.chip')].filter(b=>b.offsetParent).length : '—' })()`))
const sAbierto=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
writeFileSync(`${DONDE}/plegable-abierto.png`, Buffer.from(sAbierto.result.data,'base64'))

// Y ahora el papel.
await send('Emulation.setEmulatedMedia',{media:'print'}); await espera(600)
const s3=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
writeFileSync(`${DONDE}/tramo-en-papel.png`, Buffer.from(s3.result.data,'base64'))
console.log('\nen papel:', await ev(`(() => {
  const visible=(el)=>{ let n=el; while(n&&n!==document.documentElement){ if(getComputedStyle(n).display==='none') return 'no se imprime (display:none en '+(n.className||n.tagName)+')'; n=n.parentElement }
    return getComputedStyle(el).visibility==='hidden' ? 'no se imprime (visibility)' : 'SE IMPRIME' }
  const a=document.querySelector('.assign-box')
  const chip=document.querySelector('.assign-box button')
  const doc=document.querySelector('.cortejo-orden.print-doc')
  return {cajaAsistencia: a?visible(a):'no existe', unChip: chip?visible(chip):'no hay chips', docImprimible: doc?visible(doc):'no existe'}
})()`))
console.log('fotos en', DONDE)
ws.close();chrome.kill()
