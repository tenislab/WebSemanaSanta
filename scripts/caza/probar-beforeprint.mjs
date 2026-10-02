/*
 * ¿LLEGA `beforeprint`, Y SE PUEDE MONTAR ALGO DENTRO?
 *
 * De esto depende el diseño del arreglo. Si `beforeprint` llega y el navegador
 * recoge lo que se añada al DOM dentro del manejador, entonces el padrón se
 * puede montar SOLO al imprimir y cubre los dos caminos a la vez: el botón
 * —que llama a window.print()— y el Ctrl+P del navegador. Si no llega, montarlo
 * al pulsar el botón dejaría el Ctrl+P imprimiendo un censo vacío.
 */
import { spawn } from 'node:child_process'
const espera=(ms)=>new Promise(r=>setTimeout(r,ms))
const port=11900+Math.floor(Math.random()*90)
const chrome=spawn('/opt/pw-browsers/chromium-1194/chrome-linux/chrome',['--headless=new','--disable-gpu','--no-sandbox','--disable-background-networking','--disable-component-update',`--remote-debugging-port=${port}`,'about:blank'],{stdio:'ignore'})
let wsUrl
for(let i=0;i<60&&!wsUrl;i++){await espera(200);try{wsUrl=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page')?.webSocketDebuggerUrl}catch{}}
const ws=new WebSocket(wsUrl);await new Promise(r=>(ws.onopen=r))
let id=0;const pend=new Map()
ws.onmessage=(m)=>{const g=JSON.parse(m.data);if(g.id&&pend.has(g.id)){pend.get(g.id)(g);pend.delete(g.id)}}
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))})
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value
await send('Page.enable');await send('Runtime.enable')
await send('Page.navigate',{url:'data:text/html,<body><p id=x>hola</p></body>'})
await espera(700)
// Un manejador que apunta que ha pasado y añade un párrafo.
await ev(`(() => {
  window.__marcas = []
  window.addEventListener('beforeprint', () => {
    window.__marcas.push('beforeprint')
    const d = document.createElement('p'); d.id = 'puesto-al-imprimir'; d.textContent = 'PADRON DE 800'
    document.body.appendChild(d)
  })
  window.addEventListener('afterprint', () => window.__marcas.push('afterprint'))
  return 1
})()`)

console.log('--- 1) con Page.printToPDF (que es como lo mediría una prueba) ---')
const pdf = await send('Page.printToPDF', { printBackground: false })
const datos = pdf.result?.data ?? ''
const texto = Buffer.from(datos, 'base64').toString('latin1')
console.log('   marcas:', JSON.stringify(await ev('window.__marcas')))
console.log('   ¿el PDF lleva el párrafo añadido?', /PADRON|puesto-al-imprimir/.test(texto) ? 'SÍ' : 'no (el PDF está comprimido, no es concluyente)')
console.log('   ¿el nodo está en el DOM ahora?', await ev("!!document.getElementById('puesto-al-imprimir')"))

console.log('\n--- 2) con window.print() desde la página ---')
await ev("window.__marcas = []; document.getElementById('puesto-al-imprimir')?.remove(); 1")
await ev('window.print()')
await espera(500)
console.log('   marcas:', JSON.stringify(await ev('window.__marcas')))
console.log('   ¿el nodo está en el DOM?', await ev("!!document.getElementById('puesto-al-imprimir')"))

console.log('\n--- 3) y con el evento lanzado a mano (lo que sí puede probar una prueba) ---')
await ev("window.__marcas = []; document.getElementById('puesto-al-imprimir')?.remove(); 1")
await ev("window.dispatchEvent(new Event('beforeprint'))")
await espera(300)
console.log('   marcas:', JSON.stringify(await ev('window.__marcas')))
console.log('   ¿el nodo está en el DOM?', await ev("!!document.getElementById('puesto-al-imprimir')"))
ws.close();chrome.kill()
