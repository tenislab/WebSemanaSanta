import { chromium } from 'playwright'
const B = 'http://localhost:5200'
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } })
const pag = await ctx.newPage()

const errores = []
pag.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' && !/ERR_CONNECTION_RESET|unique "key"/.test(t)) errores.push(t)
})
pag.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message))
pag.on('dialog', (d) => d.accept())

await pag.goto(B)
await pag.evaluate(() => {
  localStorage.setItem('cabildo-demo-modo', 'llena')
  localStorage.setItem('cabildo-suscripcion', JSON.stringify({ activa: true, pack: 'todo', periodo: 'mensual', desde: null }))
  localStorage.setItem('cabildo-alta-hermandad-hecha', 'si')
  localStorage.setItem('cabildo-demo-user', JSON.stringify({ email: 'demo@demo.es', nombre: 'Demo' }))
})

const rutas = [
  ['/', 'Portada'],
  ['/app', 'Inicio del panel'],
  ['/app/hermanos', 'Hermanos'],
  ['/app/cortejo', 'Cortejo'],
  ['/app/cuotas', 'Cuotas'],
  ['/app/papeletas', 'Papeletas'],
  ['/app/tesoreria', 'Tesorería'],
  ['/app/inventario', 'Inventario'],
  ['/app/archivo', 'Archivo'],
  ['/app/eventos', 'Eventos'],
  ['/app/comunicados', 'Comunicados'],
  ['/app/informes', 'Informes'],
  ['/app/personal', 'Personal'],
  ['/app/web', 'Web pública'],
  ['/app/configuracion', 'Configuración'],
  ['/app/seguridad', 'Seguridad'],
  ['/hermano', 'Área del hermano'],
  ['/entrar', 'Entrar'],
  ['/login', 'Login'],
  ['/registro', 'Registro'],
  ['/recuperar', 'Recuperar'],
  ['/verificar', 'Verificar papeleta'],
]

let malas = 0
for (const [ruta, nombre] of rutas) {
  const antes = errores.length
  await pag.goto(`${B}${ruta}`, { waitUntil: 'networkidle' }).catch(() => {})
  await pag.waitForTimeout(500)
  const texto = await pag.locator('body').textContent().catch(() => '')
  const vacia = !texto || texto.trim().length < 40
  const nuevos = errores.length - antes
  const roto = vacia || nuevos > 0
  if (roto) malas++
  console.log(`${roto ? '✗' : '✓'} ${nombre.padEnd(20)} ${vacia ? 'PANTALLA VACÍA' : ''} ${nuevos > 0 ? `${nuevos} error(es)` : ''}`)
}

console.log(`\n--- ${rutas.length - malas}/${rutas.length} pantallas abren limpias ---`)
if (errores.length) {
  console.log('\nERRORES:')
  ;[...new Set(errores)].slice(0, 12).forEach((e) => console.log('  •', e.slice(0, 180)))
}
await nav.close()
