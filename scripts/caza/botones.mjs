/*
 * PULSAR TODO, BIEN ESTA VEZ.
 *
 * La primera versión guardaba los botones en `window.__B` y pulsaba por
 * índice. En cuanto un botón repintaba la pantalla —cambiar de pestaña, por
 * ejemplo— los nodos guardados quedaban DESPRENDIDOS del documento, y pulsar
 * un nodo desprendido no hace nada: daba «no hace nada» en nueve botones que
 * funcionan perfectamente. Un detector que se autoengaña es peor que no tener
 * detector.
 *
 * Ahora: se recarga la pantalla ANTES de cada pulsación y el botón se busca
 * de nuevo en el documento vivo, por posición dentro de la lista recién hecha.
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const espera=(ms)=>new Promise(r=>setTimeout(r,ms))
const port=10300+Math.floor(Math.random()*90)
const chrome=spawn('/opt/pw-browsers/chromium-1194/chrome-linux/chrome',['--headless=new','--disable-gpu','--no-sandbox','--disable-background-networking','--disable-component-update',`--remote-debugging-port=${port}`,'about:blank'],{stdio:'ignore'})
let wsUrl
for(let i=0;i<60&&!wsUrl;i++){await espera(200);try{wsUrl=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page')?.webSocketDebuggerUrl}catch{}}
const ws=new WebSocket(wsUrl);await new Promise(r=>(ws.onopen=r))
let id=0;const pend=new Map();let errores=[]
ws.onmessage=(m)=>{const g=JSON.parse(m.data);if(g.id&&pend.has(g.id)){pend.get(g.id)(g);pend.delete(g.id)}
 if(g.method==='Runtime.exceptionThrown')errores.push('EXC: '+String(g.params.exceptionDetails.exception?.description??g.params.exceptionDetails.text).replace(/\s+/g,' ').slice(0,160))
 if(g.method==='Runtime.consoleAPICalled'&&g.params.type==='error')errores.push('ERR: '+g.params.args.map(a=>a.value??a.description).join(' ').replace(/\s+/g,' ').slice(0,160))}
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))})
const ev=async(e)=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)return {__exc:JSON.stringify(r.result.exceptionDetails).slice(0,200)};return r.result?.result?.value}
await send('Page.enable');await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride',{width:1500,height:1100,deviceScaleFactor:1,mobile:false})
const BASE='http://127.0.0.1:4173'
await send('Page.navigate',{url:`${BASE}/mirar.html?ir=/app`})
for(let i=0;i<80;i++){await espera(250);if(await ev("location.pathname==='/app' && !!localStorage.getItem('cabildo-suscripcion')"))break}
await espera(1500)

const PROHIBIDO = String.raw`/borrar|eliminar|quitar|vaciar|restaurar|descargar|imprimir|exportar|copia|cerrar sesión|salir|suprimir|dar de baja|anular|cancelar suscri|pagar|emitir|convocar|enviar|mandar|generar|subir|guardar/i`
const LISTA = `(() => [...document.querySelectorAll('button:not([disabled])')].filter((b) => {
  const r = b.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && !${PROHIBIDO}.test(b.textContent || '') && (b.textContent||'').trim().length > 0
}))()`
const HUELLA = `const huella=(s)=>{let h=0;for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))|0}return h};`
const ESTADO = `(() => { ${HUELLA} return {
  t: huella(document.body.innerText),
  c: document.querySelectorAll('input,textarea,select,button').length,
  ruta: location.pathname,
  cajon: document.querySelector('.drawer__head') ? document.querySelector('.drawer__head').innerText.slice(0,30) : '',
  rail: (document.querySelector('.cms-rail__item[aria-current], .cms-rail__item.is-activo') || {}).textContent || '',
  roto: document.body.innerText.includes('Algo se ha roto'),
} })()`

const RUTAS = [
  ['Inicio','/app'], ['Hermanos','/app/hermanos'], ['Cuotas','/app/cuotas'],
  ['Papeletas','/app/papeletas'], ['Cortejo','/app/cortejo'], ['Tesorería','/app/tesoreria'],
  ['Informes','/app/informes'], ['Comunicados','/app/comunicados'], ['Configuración','/app/configuracion'],
  ['Web pública','/app/web'], ['Eventos','/app/eventos'], ['Personal','/app/personal'],
  ['Tienda','/app/tienda'], ['Notificaciones','/app/notificaciones'], ['Campañas','/app/campanas'],
  ['Inventario','/app/inventario'], ['Documentos','/app/documentos'],
]
const hallazgos = []
for (const [n, ruta] of RUTAS) {
  await send('Page.navigate',{url:BASE+ruta}); await espera(2000)
  const cuantos = await ev(`${LISTA}.length`)
  if (typeof cuantos !== 'number') { console.log(`### ${n}: ${JSON.stringify(cuantos)}`); continue }
  const tope = Math.min(cuantos, 20)
  console.log(`\n### ${n}  (${cuantos} botones, se prueban ${tope})`)
  for (let i = 0; i < tope; i++) {
    // RECARGA antes de cada pulsación: ni estado arrastrado ni nodos viejos.
    await send('Page.navigate',{url:BASE+ruta}); await espera(1700)
    errores = []
    const antes = await ev(ESTADO)
    if (!antes || antes.__exc) continue
    const nombre = await ev(`(() => { const b = ${LISTA}[${i}]; if (!b) return null; const t = (b.textContent||'').replace(/\\s+/g,' ').trim().slice(0,38); b.click(); return t })()`)
    if (!nombre || typeof nombre !== 'string') continue
    await espera(900)
    const d = await ev(ESTADO)
    const err = errores.filter((e)=>!/favicon|Failed to load resource|net::ERR|React DevTools/.test(e))
    const cambio = d.roto || antes.t !== d.t || antes.c !== d.c || antes.ruta !== d.ruta || antes.cajon !== d.cajon || antes.rail !== d.rail
    if (d.roto) { console.log(`   SE CAE   «${nombre}»`); hallazgos.push({pantalla:n, boton:nombre, que:'SE CAE'}) }
    else if (err.length) { console.log(`   error    «${nombre}»  ${err[0]}`); hallazgos.push({pantalla:n, boton:nombre, que:err[0]}) }
    else if (!cambio) { console.log(`   NO HACE  «${nombre}»`); hallazgos.push({pantalla:n, boton:nombre, que:'no cambia nada'}) }
  }
}
writeFileSync('/tmp/claude-0/caza/func2.json', JSON.stringify(hallazgos, null, 2))
console.log(`\n\nTOTAL anotado: ${hallazgos.length}`)
ws.close();chrome.kill()
