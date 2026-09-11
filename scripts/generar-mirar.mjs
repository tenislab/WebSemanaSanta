/**
 * GENERA `public/mirar.html`: LA PUERTA PARA VER LA APLICACIÓN PINTADA.
 *
 * Tres fallos de esta semana —los `select` en zigzag, el escudo huérfano en la
 * barra y los dos carteles de campaña que se contradecían— salieron todos de
 * ABRIR LA APLICACIÓN Y MIRARLA. Ninguno salió de leer el código, y setenta y
 * dos de los doscientos sesenta y cinco ficheros de `src/` no aparecen
 * nombrados en ninguna prueba.
 *
 * El problema era el coste. Para ver una pantalla había que escribir a mano una
 * página que sembrara el `localStorage`, y `npm run build` vacía `dist/`, así
 * que había que rehacerla después de cada build. Dos minutos cada vez es
 * bastante para no mirar.
 *
 * Esto lo deja hecho: `public/mirar.html` sobrevive al build —Vite copia
 * `public/` tal cual— y siembra los mismos datos que la demo de verdad.
 *
 * Y LOS DATOS NO SE COPIAN A MANO. Se ejecuta aquí `sembrarDemoLlena()`, que es
 * la función que usa el botón «Entrar en la demo», con un `localStorage` de
 * mentira, y se apunta lo que deja escrito. Una lista de claves copiada a mano
 * se queda vieja el día que alguien añade una, o sea el día que hace falta.
 *
 *   node scripts/generar-mirar.mjs
 *   npm run build
 *   npx vite preview --port 4173
 *   → http://localhost:4173/mirar.html?ir=/app/hermanos
 */
import { build } from 'esbuild'
import { writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Compila un módulo del proyecto y lo importa, igual que hacen las pruebas. */
async function cargar(ruta) {
  const dir = await mkdtemp(join(tmpdir(), 'gobergo-mirar-'))
  const destino = join(dir, 'modulo.mjs')
  const res = await build({
    entryPoints: [join(raiz, ruta)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    alias: { '@supabase/supabase-js': join(raiz, 'pruebas/stub-supabase.mjs') },
    define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }) },
  })
  await writeFile(destino, res.outputFiles[0].text)
  return import(destino)
}

// Un `localStorage` de mentira que se deja leer después: es el que va a
// recibir lo que siembre la demo.
const guardado = new Map()
globalThis.localStorage = {
  getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, String(v)),
  removeItem: (k) => guardado.delete(k),
  clear: () => guardado.clear(),
  key: (i) => [...guardado.keys()][i] ?? null,
  get length() { return guardado.size },
}

const demo = await cargar('src/lib/demo.ts')
demo.sembrarDemoLlena()

/*
 * Y LA SUSCRIPCIÓN ACTIVA.
 *
 * Sin esto la primera pantalla no es el panel: es «Activa tu hermandad», el
 * muro de pago. Le pasa también a la demo de verdad —quien pulsa «Entrar en la
 * demo» ve la lista de precios y tiene que suscribirse una vez—, pero aquí
 * estorba: esta página existe para ver pantallas, no para pasar por caja.
 *
 * La forma se coge de `SUSCRIPCION_INICIAL`, que es la del módulo: escribirla a
 * mano ya me costó una tarde: puse `{ estado: 'activa', plan: 'anual' }`, que
 * no se parece en nada a lo que lee la aplicación, y el muro seguía saliendo
 * sin decir por qué.
 */
const sus = await cargar('src/lib/suscripcion.ts')
localStorage.setItem(sus.CLAVE_SUSCRIPCION, JSON.stringify({
  ...sus.SUSCRIPCION_INICIAL,
  activa: true,
  pack: 'todo',
  periodo: 'anual',
  desde: '2026-01-01',
}))

/*
 * Y LA SESIÓN. El panel no se monta solo por tener datos: mira si hay una
 * cuenta dentro, y la de la demo vive en `sessionStorage`. La forma sale de
 * `buildDemoUser` en `AuthContext.tsx`, que es una línea y no se puede
 * importar sin arrastrar React entero.
 */
const CUENTA = {
  id: 'demo-demo@gobergo.com',
  email: 'demo@gobergo.com',
  user_metadata: { hermandad: 'Hermandad de prueba', nombre: 'Usuario Demo' },
}

const pares = [...guardado.entries()]

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Mirar la aplicación</title>
<meta name="robots" content="noindex">
<style>
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0; display: grid; place-items: center; min-height: 100vh;
         background: #F7F3EE; color: #3A2F2A; }
  main { max-width: 34rem; padding: 2rem; }
  h1 { font-size: 1.3rem; margin: 0 0 .5rem; }
  p { margin: .5rem 0; }
  code { background: #EDE5DC; padding: .1em .35em; border-radius: 3px; }
</style>
</head>
<body>
<main>
  <h1>Sembrando la hermandad de ejemplo…</h1>
  <p>Esta página es para <b>ver la aplicación pintada</b> sin base de datos.
     Se puede pedir una pantalla concreta con
     <code>?ir=/app/hermanos</code>.</p>
  <p id="aviso"></p>
</main>
<script>
/* GENERADO por scripts/generar-mirar.mjs — no lo edites a mano. */
(function () {
  var datos = ${JSON.stringify(pares)};
  try {
    localStorage.clear()
    for (var i = 0; i < datos.length; i += 1) localStorage.setItem(datos[i][0], datos[i][1])
    sessionStorage.setItem('cabildo-demo-user', ${JSON.stringify(JSON.stringify(CUENTA))})
  } catch (e) {
    document.getElementById('aviso').textContent =
      'Este navegador no deja guardar nada (¿ventana privada?), así que no se puede sembrar: ' + e
    return
  }
  var p = new URLSearchParams(location.search)
  /*
   * El tema se puede pedir también: el zigzag de los desplegables solo se veía
   * en uno de los dos, y mirar siempre el claro es mirar la mitad.
   */
  var tema = p.get('tema')
  /*
   * La clave es 'cabildo-theme' y los valores 'light' y 'dark': son los de
   * src/lib/tema.ts. La primera versión de esto escribía 'cabildo-tema' con
   * 'claro'/'oscuro' —ni la clave ni los valores existen— así que ?tema= no
   * hacía nada y se miraba siempre el tema claro creyendo ver los dos.
   */
  if (tema === 'dark' || tema === 'oscuro') tema = 'dark'
  else if (tema === 'light' || tema === 'claro') tema = 'light'
  else tema = null
  if (tema) {
    try { localStorage.setItem('cabildo-theme', tema) } catch (e) { /* da igual */ }
  }
  var ir = p.get('ir') || '/app'
  // Solo rutas de dentro: un \`?ir=https://otro-sitio\` desde aquí sería un
  // redirector abierto con el nombre de la hermandad delante.
  if (ir.charAt(0) !== '/' || ir.charAt(1) === '/') ir = '/app'
  location.replace(ir)
})()
</script>
</body>
</html>
`

await writeFile(join(raiz, 'public/mirar.html'), html)
console.log(`public/mirar.html generado: ${pares.length} claves sembradas.`)
