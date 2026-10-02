/* Informes: cuánto ocupa cada tarjeta de informe y qué hay dentro. */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
const espera=(ms)=>new Promise(r=>setTimeout(r,ms))
const DONDE='/tmp/claude-0/fotos-informes'; mkdirSync(DONDE,{recursive:true})
const port=12100+Math.floor(Math.random()*90)
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
const ANCHO = Number(process.env.ANCHO || 1420)
await send('Emulation.setDeviceMetricsOverride',{width:ANCHO,height:1000,deviceScaleFactor:1,mobile:ANCHO<700})
const BASE='http://127.0.0.1:4173'
await send('Page.navigate',{url:`${BASE}/mirar.html?ir=/app`})
for(let i=0;i<80;i++){await espera(250);if(await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')"))break}
await espera(1200)
await send('Page.navigate',{url:`${BASE}/app/informes`}); await espera(3800)
errs=[]
console.log(JSON.stringify(await ev(`(() => {
  const tarjetas=[...document.querySelectorAll('section.settings-card, details.settings-card')]
  return {
    anchoPantalla: innerWidth,
    altoDeLaPagina: Math.round(document.body.scrollHeight),
    tarjetas: tarjetas.map(t => ({
      titulo: (t.querySelector('.settings-card__title')||{}).textContent?.trim(),
      alto: Math.round(t.getBoundingClientRect().height),
      botones: [...t.querySelectorAll('button')].map(b=>b.textContent.trim()).slice(0,5),
      selects: t.querySelectorAll('select').length,
      lineasDeTexto: (t.querySelector('.form-hint')||{}).textContent?.trim().length ?? 0,
    })),
  }
})()`),null,1))
if(errs.length) console.log('ERRORES:', errs.slice(0,3))
const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
writeFileSync(`${DONDE}/informes-${ANCHO}.png`, Buffer.from(s.result.data,'base64'))
const caja = await ev(`(() => { const t=document.querySelector('section.settings-card'); if(!t) return null; const r=t.getBoundingClientRect(); return {x:Math.max(0,r.x-12),y:Math.max(0,r.y-12),w:r.width+24,h:r.height+24} })()`)
if(caja){ const s2=await send('Page.captureScreenshot',{format:'png',clip:{...caja,scale:2}})
  if(s2.result?.data) writeFileSync(`${DONDE}/documentos-${ANCHO}.png`, Buffer.from(s2.result.data,'base64')) }
console.log('foto en', `${DONDE}/informes-${ANCHO}.png`)
ws.close();chrome.kill()
