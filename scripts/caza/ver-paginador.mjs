/* El paginador con una hermandad grande de verdad: cómo queda y qué dice. */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
const espera=(ms)=>new Promise(r=>setTimeout(r,ms))
const DONDE='/tmp/claude-0/fotos-paginador'; mkdirSync(DONDE,{recursive:true})
const port=11500+Math.floor(Math.random()*90)
const chrome=spawn('/opt/pw-browsers/chromium-1194/chrome-linux/chrome',['--headless=new','--disable-gpu','--no-sandbox','--disable-background-networking','--disable-component-update',`--remote-debugging-port=${port}`,'about:blank'],{stdio:'ignore'})
let wsUrl
for(let i=0;i<60&&!wsUrl;i++){await espera(200);try{wsUrl=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page')?.webSocketDebuggerUrl}catch{}}
const ws=new WebSocket(wsUrl);await new Promise(r=>(ws.onopen=r))
let id=0;const pend=new Map();let errs=[]
ws.onmessage=(m)=>{const g=JSON.parse(m.data);if(g.id&&pend.has(g.id)){pend.get(g.id)(g);pend.delete(g.id)}
 if(g.method==='Runtime.exceptionThrown')errs.push('EXC: '+String(g.params.exceptionDetails.exception?.description??g.params.exceptionDetails.text).slice(0,160))}
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))})
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value
await send('Page.enable');await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride',{width:1500,height:1100,deviceScaleFactor:1,mobile:false})
const BASE='http://127.0.0.1:4173'
await send('Page.navigate',{url:`${BASE}/mirar.html?ir=/app`})
for(let i=0;i<80;i++){await espera(250);if(await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')"))break}
await espera(1200)
console.log('sembrado:', await ev(`(() => {
  const hs=[],cs=[],ms=[]
  for(let i=0;i<800;i++)hs.push({id:'H'+i,numero:i+1,nombre:['Rafael','Carmen','Manuel','Rocío'][i%4]+' '+['Ortiz','Ruiz','Vega','Luna'][(i*3)%4]+' '+['Cabrera','Nieto','Mora'][(i*5)%3],estado:i%17===0?'Baja':'Activo',antiguedad:1990+(i%30),email:'h'+i+'@e.es',telefono:'600000000',direccion:'Calle x',cuotaAlDia:false,iban:null,dni:String(10000000+i)+'Z',claveAcceso:'x',authUserId:null,cargo:'',etiquetas:[]})
  let n=0
  for(const ej of [2024,2025,2026])for(const h of hs){if(h.estado==='Baja')continue;for(let k=0;k<2;k++){n++;cs.push({id:'C'+n,numero:n,hermanoId:h.id,concepto:'Cuota anual',importe:30,estado:n%5===0?'Pendiente':'Pagada',ejercicio:ej,fechaEmision:ej+'-01-15',fechaCobro:ej+'-02-01',domiciliada:n%3!==0,fechaPago:n%5===0?undefined:ej+'-02-05'})}}
  for(let i=0;i<3000;i++)ms.push({id:'M'+i,fecha:'2026-'+String((i%12)+1).padStart(2,'0')+'-'+String((i%27)+1).padStart(2,'0'),concepto:'Apunte '+i,categoria:['Cuotas','Papeletas','Donativos'][i%3],importe:(i%7)*10-20,tipo:i%3===0?'Gasto':'Ingreso',estado:i%9===0?'Pendiente':'Conciliado',origen:null})
  localStorage.setItem('cabildo-hermanos',JSON.stringify(hs))
  localStorage.setItem('cabildo-cuotas',JSON.stringify(cs))
  localStorage.setItem('cabildo-movimientos',JSON.stringify(ms))
  return hs.length+' hermanos · '+cs.length+' recibos · '+ms.length+' apuntes'
})()`))

const mirar = async (nombre, ruta) => {
  errs = []
  await send('Page.navigate',{url:BASE+ruta}); await espera(3500)
  const info = await ev(`(() => {
    const p = document.querySelector('.paginador')
    if (!p) return '(NO HAY PAGINADOR)'
    const nums = [...p.querySelectorAll('.paginador__num')].map(b=>b.textContent.trim()+(b.getAttribute('aria-current')?'*':'')).join(' ')
    return 'cuenta: «' + p.querySelector('.paginador__cuenta').textContent.trim() + '»  ·  páginas: ' + nums +
      '  ·  filas en el DOM: ' + document.querySelectorAll('tbody tr').length +
      '  ·  nodos: ' + document.querySelectorAll('*').length
  })()`)
  console.log(`${nombre.padEnd(12)} ${info}${errs.length ? '  <<< ' + errs[0] : ''}`)
  const s = await send('Page.captureScreenshot',{format:'png'})
  writeFileSync(`${DONDE}/${nombre}.png`, Buffer.from(s.result.data,'base64'))
}
await mirar('cuotas', '/app/cuotas')
await mirar('hermanos', '/app/hermanos')
await mirar('tesoreria', '/app/tesoreria')
await mirar('papeletas', '/app/papeletas')

// Y que el paginador haga algo: ir a la página 3 y a «ver todas».
await send('Page.navigate',{url:`${BASE}/app/cuotas`}); await espera(3000)
console.log('\n--- pulsando la página 3 ---')
console.log(await ev(`(() => { const b=[...document.querySelectorAll('.paginador__num')].find(x=>x.textContent.trim()==='3'); if(!b) return '(no hay página 3)'; b.click(); return 'pulsada' })()`))
await espera(1200)
console.log(await ev(`(() => { const p=document.querySelector('.paginador'); return 'cuenta: «'+p.querySelector('.paginador__cuenta').textContent.trim()+'»  ·  filas: '+document.querySelectorAll('tbody tr').length+'  ·  primera: '+(document.querySelector('tbody tr')?.innerText.replace(/\\s+/g,' ').slice(0,40)) })()`))
const s3 = await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`${DONDE}/cuotas-pagina-3.png`, Buffer.from(s3.result.data,'base64'))
console.log('\n--- y «Ver todas» ---')
console.log(await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Ver todas/.test(x.textContent)); if(!b) return '(no hay)'; b.click(); return 'pulsado' })()`))
await espera(3500)
console.log(await ev(`(() => { const p=document.querySelector('.paginador'); return 'cuenta: «'+(p?p.querySelector('.paginador__cuenta').textContent.trim():'—')+'»  ·  filas: '+document.querySelectorAll('tbody tr').length+'  ·  nodos: '+document.querySelectorAll('*').length })()`))
const s4 = await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`${DONDE}/cuotas-ver-todas.png`, Buffer.from(s4.result.data,'base64'))
// Y que se pueda volver.
console.log('\n--- volver a páginas ---')
console.log(await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Volver a verlos por p/.test(x.textContent)); if(!b) return '(no hay)'; b.click(); return 'pulsado' })()`))
await espera(1500)
console.log(await ev(`(() => { const p=document.querySelector('.paginador'); return 'cuenta: «'+p.querySelector('.paginador__cuenta').textContent.trim()+'»  ·  filas: '+document.querySelectorAll('tbody tr').length })()`))
ws.close();chrome.kill()
