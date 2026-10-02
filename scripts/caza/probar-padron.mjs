/*
 * ¿SALE EL PADRÓN EN EL PAPEL, Y CUÁNTO PESA EN PANTALLA?
 *
 * Las dos preguntas del punto 4, y las dos medidas:
 *   · en pantalla, cuántos nodos hay antes y durante la impresión;
 *   · en el papel, si el padrón completo llega de verdad — por los DOS
 *     caminos, el botón y el Ctrl+P del navegador.
 */
import { spawn } from 'node:child_process'
const espera=(ms)=>new Promise(r=>setTimeout(r,ms))
const port=12100+Math.floor(Math.random()*90)
const chrome=spawn('/opt/pw-browsers/chromium-1194/chrome-linux/chrome',['--headless=new','--disable-gpu','--no-sandbox','--disable-background-networking','--disable-component-update',`--remote-debugging-port=${port}`,'about:blank'],{stdio:'ignore'})
let wsUrl
for(let i=0;i<60&&!wsUrl;i++){await espera(200);try{wsUrl=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page')?.webSocketDebuggerUrl}catch{}}
const ws=new WebSocket(wsUrl);await new Promise(r=>(ws.onopen=r))
let id=0;const pend=new Map();let errs=[]
ws.onmessage=(m)=>{const g=JSON.parse(m.data);if(g.id&&pend.has(g.id)){pend.get(g.id)(g);pend.delete(g.id)}
 if(g.method==='Runtime.exceptionThrown')errs.push('EXC: '+String(g.params.exceptionDetails.exception?.description??g.params.exceptionDetails.text).slice(0,180))}
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))})
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value
await send('Page.enable');await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride',{width:1500,height:1100,deviceScaleFactor:1,mobile:false})
const BASE='http://127.0.0.1:4173'
await send('Page.navigate',{url:`${BASE}/mirar.html?ir=/app`})
for(let i=0;i<80;i++){await espera(250);if(await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')"))break}
await espera(1200)
console.log('sembrado:', await ev(`(() => { const hs=[]
  for(let i=0;i<800;i++)hs.push({id:'H'+i,numero:i+1,nombre:'Hermano '+String(i).padStart(3,'0')+' Apellido',estado:'Activo',antiguedad:1990,email:'h'+i+'@e.es',telefono:'600',direccion:'x',cuotaAlDia:false,iban:null,dni:String(10000000+i)+'Z',claveAcceso:'x',authUserId:null,cargo:'',etiquetas:[]})
  localStorage.setItem('cabildo-hermanos',JSON.stringify(hs)); return hs.length+' hermanos' })()`))
await send('Page.navigate',{url:`${BASE}/app/hermanos`}); await espera(4000)

const medir = `(() => ({
  nodos: document.querySelectorAll('*').length,
  filasVista: document.querySelectorAll('.table-card tbody tr').length,
  padron: document.querySelectorAll('.informe-doc__table tbody tr').length,
  hayPadron: !!document.querySelector('.informe-doc__table'),
}))()`
console.log('\nEN PANTALLA, sin imprimir:', JSON.stringify(await ev(medir)))

// El Ctrl+P del navegador: `beforeprint` a secas.
console.log('\n--- camino 1: el Ctrl+P del navegador (beforeprint) ---')
await ev("window.dispatchEvent(new Event('beforeprint'))")
await espera(400)
console.log('   durante la impresión:', JSON.stringify(await ev(medir)))
await ev("window.dispatchEvent(new Event('afterprint'))")
await espera(400)
console.log('   al acabar:            ', JSON.stringify(await ev(medir)))

// Y el camino de verdad: Page.printToPDF, que dispara beforeprint él mismo.
console.log('\n--- camino 2: imprimir de verdad (Page.printToPDF) ---')
errs = []
const pdf = await send('Page.printToPDF', { printBackground: false, preferCSSPageSize: false })
const bytes = Buffer.from(pdf.result?.data ?? '', 'base64')
console.log('   PDF de', (bytes.length/1024).toFixed(0), 'kB')
console.log('   al acabar, en pantalla:', JSON.stringify(await ev(medir)))
if (errs.length) console.log('   ' + errs[0])
// Cuántas páginas tiene el PDF: un padrón de 800 no cabe en una.
const paginas = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
console.log('   páginas del PDF:', paginas, paginas > 5 ? '→ el padrón ha salido' : '→ SOSPECHOSO: muy pocas')
// Y el botón, que llama a window.print()
console.log('\n--- camino 3: el botón «Imprimir el listado» ---')
// El botón vive DENTRO del menú «Exportar», que está cerrado: hay que abrirlo.
console.log('   abriendo el menú:', await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/^Exportar/.test(x.textContent.trim())); if(!b) return '(no hay menú)'; b.click(); return 'abierto' })()`))
await espera(500)
console.log('   el botón:', await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Imprimir el listado/.test(x.textContent)); return b ? (b.disabled?'APAGADO':'está y se puede pulsar') : '(no hay botón)' })()`))
// Y se pulsa: llama a window.print(), que dispara beforeprint él mismo.
await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Imprimir el listado/.test(x.textContent)); if(b) b.click() })()`)
await espera(800)
console.log('   tras pulsarlo:', JSON.stringify(await ev(medir)))
ws.close();chrome.kill()
