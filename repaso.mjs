import { chromium } from 'playwright'
/*
 * El puerto se puede pasar por argumento: `node repaso.mjs 5201`. Hace falta
 * para poder levantar Vite en un modo SIN Supabase (`--mode sinbase`, con un
 * `.env.sinbase` vacío) y que la sesión de demostración funcione: con las
 * claves de Supabase puestas, la cuenta de demostración no existe y todo el
 * panel queda cerrado.
 */
const B = `http://localhost:${process.argv[2] ?? 5200}`
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } })
const pag = await ctx.newPage()

const errores = []
pag.on('console', (m) => {
  const t = m.text()
  /*
   * El ruido de red NO es un fallo de la aplicación. Este repaso se corre en
   * un entorno sin salida a internet: las tipografías de Google y cualquier
   * llamada a Supabase fallan a la primera y llenan la consola de
   * `ERR_TUNNEL_CONNECTION_FAILED`. Contándolo, TODAS las pantallas salían en
   * rojo con treinta «errores» que no lo son, y con eso el repaso deja de
   * servir para lo que se hizo: ver si alguna se rompe de verdad.
   */
  const ruidoDeRed = /ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|Failed to load resource/
  if (m.type() === 'error' && !ruidoDeRed.test(t) && !/unique "key"/.test(t)) errores.push(t)
})
pag.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message))
pag.on('dialog', (d) => d.accept())

await pag.goto(B)
await pag.evaluate(() => {
  localStorage.setItem('cabildo-demo-modo', 'llena')
  localStorage.setItem('cabildo-suscripcion', JSON.stringify({ activa: true, pack: 'todo', periodo: 'mensual', desde: null }))
  localStorage.setItem('cabildo-alta-hermandad-hecha', 'si')
  /*
   * LA SESIÓN VA EN sessionStorage, NO EN localStorage. Aquí estaba puesta en
   * el sitio equivocado, así que la cuenta no se leía nunca y el repaso entraba
   * como visitante: al pedir /app/cuotas el panel redirigía a /app, la página
   * tenía texto de sobra y el repaso lo daba por bueno. O sea que ninguna
   * pantalla de gestión se estaba comprobando de verdad, y los ✓ de Hermanos,
   * Cuotas, Cortejo y las demás eran todos la misma pantalla de Inicio.
   *
   * Y sin `personalId` ni `hermanoId` entra como TITULAR, que es quien las ve
   * todas (ver `cargoDeLaCuentaDemo` en src/lib/permisos.ts).
   */
  sessionStorage.setItem('cabildo-demo-user', JSON.stringify({
    id: 'demo-repaso', email: 'demo@cabildo.app',
    user_metadata: { hermandad: 'Demo', nombre: 'Demo' },
  }))
})

/*
 * Rutas que llevan a otro sitio A PROPÓSITO cuando ya hay sesión iniciada, con
 * su destino. No son fallos: entrar y registrarse, estando dentro, tienen que
 * llevar al panel. Sin apuntarlas, el repaso las daba por rotas y con dos
 * falsos rojos fijos se deja de mirar el resultado.
 */
const DESVIOS_ESPERADOS = { '/login': '/app', '/registro': '/app' }

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
  // Y que siga DONDE SE LE PIDIÓ: si el panel la echa a otra pantalla, la
  // página tiene texto de sobra y antes pasaba por buena. Ver arriba.
  const donde = new URL(pag.url()).pathname
  const desviada = donde !== ruta && donde !== DESVIOS_ESPERADOS[ruta]
  const roto = vacia || nuevos > 0 || desviada
  if (roto) malas++
  console.log(`${roto ? '✗' : '✓'} ${nombre.padEnd(20)} ${vacia ? 'PANTALLA VACÍA' : ''}${desviada ? `DESVIADA a ${donde}` : ''} ${nuevos > 0 ? `${nuevos} error(es)` : ''}`)
}

console.log(`\n--- ${rutas.length - malas}/${rutas.length} pantallas abren limpias ---`)
if (errores.length) {
  console.log('\nERRORES:')
  ;[...new Set(errores)].slice(0, 12).forEach((e) => console.log('  •', e.slice(0, 180)))
}
await nav.close()
