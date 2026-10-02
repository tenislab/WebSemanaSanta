/* Los envíos automáticos de Comunicados, como se ven: cuánto ocupan, qué
   jerarquía tienen y qué se lee antes de encender una regla. */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
const espera=(ms)=>new Promise(r=>setTimeout(r,ms))
const DONDE='/tmp/claude-0/fotos-reglas'; mkdirSync(DONDE,{recursive:true})
const port=12900+Math.floor(Math.random()*90)
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
await send('Page.navigate',{url:`${BASE}/app/comunicados`}); await espera(3600)
errs=[]
console.log('pestañas:', await ev(`[...document.querySelectorAll('button,a')].map(x=>x.textContent.trim()).filter(t=>t&&t.length<30).slice(0,16).join(' | ')`))
console.log('ir a las reglas:', await ev(`(() => { const b=[...document.querySelectorAll('button,a')].find(x=>/manden solos|autom/i.test(x.textContent)); if(!b) return '(no hay pestaña)'; b.click(); return b.textContent.trim() })()`))
await espera(2000)
const mirar = `(() => {
  const t=[...document.querySelectorAll('section.settings-card')].find(x=>/manden solos|Avisos autom/i.test(x.textContent))
  if(!t) return {no:'no sale el apartado'}
  const r=t.getBoundingClientRect()
  return {
    titulo: t.querySelector('.settings-card__title')?.textContent.trim(),
    alto: Math.round(r.height),
    ancho: Math.round(r.width),
    reglas: t.querySelectorAll('details.regla').length,
    abiertas: [...t.querySelectorAll('details.regla')].filter(d=>d.open).length,
    cabezas: [...t.querySelectorAll('.regla__cabeza')].map(c=>c.textContent.replace(/\\s+/g,' ').trim()),
    encendidasConFilete: [...t.querySelectorAll('details.regla')].map(d=>({encendida:d.classList.contains('regla--encendida'), filete:getComputedStyle(d).borderLeftColor})),
    interruptores_de_verdad: t.querySelectorAll('.regla__encender .interruptor').length,
    textareas: t.querySelectorAll('textarea').length,
    inputsTexto: t.querySelectorAll('input[type=text]').length,
    chips: t.querySelectorAll('.chip').length,
    botones: [...t.querySelectorAll('button')].map(b=>b.textContent.trim()).slice(0,8),
    interruptores: [...t.querySelectorAll('.checkbox-row span')].map(s=>s.textContent.trim()),
    primeraLinea: t.querySelector('.form-hint')?.textContent.replace(/\\s+/g,' ').trim().slice(0,120),
    nodos: t.querySelectorAll('*').length,
    viñetaDeLista: (() => { const ul=t.querySelector('ul.lista-limpia'); if(!ul) return 'no hay ul'
      const cs=getComputedStyle(ul); return cs.listStyleType+' · sangría '+cs.paddingLeft })(),
  }
})()`
console.log('\n=== EL APARTADO, COMO ESTÁ ===')
console.log(JSON.stringify(await ev(mirar),null,1))
// Con las dos reglas de fábrica puestas, que es el caso real.
console.log('\nañadir las de fábrica:', await ev(`(() => {
  const t=[...document.querySelectorAll('section.settings-card')].find(x=>/manden solos|Avisos autom/i.test(x.textContent))
  if(!t) return '(no hay apartado)'
  const bs=[...t.querySelectorAll('.settings-actions button')]
  if(!bs.length) return 'ya tiene reglas'
  bs.forEach(b=>b.click()); return bs.length+' reglas añadidas'
})()`))
await espera(1800)
console.log(JSON.stringify(await ev(mirar),null,1))
if(errs.length) console.log('ERRORES:', errs.slice(0,2))
const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
writeFileSync(`${DONDE}/reglas-antes.png`, Buffer.from(s.result.data,'base64'))

// ¿Se puede encender desde fuera? No debe poderse: eso es lo asimétrico.
console.log('\n--- encender desde la cabeza cerrada ---')
console.log(await ev(`(() => {
  const d=[...document.querySelectorAll('details.regla')][0]
  if(!d) return '(no hay reglas)'
  d.open=false
  const dentro=d.querySelector('.regla__encender input[type=checkbox]')
  if(!dentro) return 'NO hay interruptor dentro'
  const r=dentro.getBoundingClientRect()
  return 'con la regla cerrada, el interruptor de encender mide '+Math.round(r.width)+'×'+Math.round(r.height)+' px (0 = no se puede pulsar)'
})()`))
console.log('--- ENCENDER NO CIERRA EL AVISO (el fallo del `open` calculado) ---')
console.log(await ev(`(() => {
  const d=[...document.querySelectorAll('details.regla')][0]
  d.open=true; d.dispatchEvent(new Event('toggle'))
  return 'abierto a mano: '+d.open
})()`))
await espera(700)
console.log(await ev(`(() => {
  const d=[...document.querySelectorAll('details.regla')][0]
  const i=d.querySelector('.regla__encender input[type=checkbox]')
  if(!i || i.disabled) return '(no se puede encender este)'
  i.click(); return 'pulsado el interruptor'
})()`))
await espera(1000)
console.log(await ev(`(() => {
  const d=[...document.querySelectorAll('details.regla')][0]
  return 'después de encender sigue abierto: '+d.open+' · encendido: '+d.classList.contains('regla--encendida')
})()`))
console.log('--- y apagar sí se ofrece desde fuera cuando está encendida ---')
console.log(await ev(`(() => {
  const d=[...document.querySelectorAll('details.regla')][0]
  d.open=true
  const i=d.querySelector('.regla__encender input[type=checkbox]')
  if(i.disabled) return 'esta regla no se puede encender (marca mal escrita): '+d.querySelector('.portal__pref-explica')?.textContent.trim()
  i.click()
  return 'encendida'
})()`))
await espera(1200)
console.log(await ev(`(() => {
  const d=[...document.querySelectorAll('details.regla')][0]
  d.open=false
  return { filete:getComputedStyle(d).borderLeftColor, tieneBotonApagar: !!d.querySelector('.regla__apagar button'), cabeza:d.querySelector('.regla__cabeza').textContent.replace(/\\s+/g,' ').trim() }
})()`))
console.log('\n=== DESPUÉS, CERRADAS ===')
console.log(JSON.stringify(await ev(`(() => { const t=[...document.querySelectorAll('section.settings-card')].find(x=>/Avisos autom/.test(x.textContent)); [...t.querySelectorAll('details.regla')].forEach(d=>d.open=false); return null })()`)))
await espera(600)
console.log(JSON.stringify(await ev(mirar),null,1))
const s2=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
writeFileSync(`${DONDE}/reglas-despues.png`, Buffer.from(s2.result.data,'base64'))
console.log('\nfoto en', DONDE)
ws.close();chrome.kill()
