/**
 * Lo que se descarga, y CUÁNDO.
 *
 * EL PROBLEMA: `App.tsx` tenía veintisiete `import` en la cabecera, así que el
 * navegador se los bajaba todos antes de pintar nada. Un hermano que abre su
 * área para ver a qué hora tiene que estar en la casa de hermandad se
 * descargaba enterito el panel de gestión —tesorería, remesas SEPA, el editor
 * de la web, la matriz de permisos— que no va a ver nunca.
 *
 * Medido en un navegador, con la caché vacía, sobre la versión construida:
 *
 *              antes        después
 *   portada    1.361 kB   →   625 kB
 *   hermano    1.361 kB   →   813 kB
 *   panel      1.361 kB   →   673 kB
 *
 * Y no es un lujo: el Domingo de Ramos por la mañana hay ochocientas personas
 * mirando su papeleta a la vez, desde la calle, con la cobertura que haya.
 *
 * Esto se rompe sin querer con mucha facilidad —basta con que alguien añada un
 * `import Cuotas from './pages/app/Cuotas'` arriba para «arreglar» un tipo— y
 * no se nota nunca en local, porque en local todo va a la velocidad del disco.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const app = await readFile('src/App.tsx', 'utf8')

  // Las cuatro puertas de entrada se quedan arriba: son las que abre alguien
  // que llega de fuera, y ahí un salto de más se nota.
  for (const puerta of ['./pages/Raiz', './pages/EntradaUnificada', './components/ProtectedRoute']) {
    caso(`${puerta} entra directo`, true, app.includes(`import Raiz from '${puerta}'`) || app.includes(`from '${puerta}'`))
  }

  // Y las quince páginas del panel, una a una: quien entra a Cuotas no
  // necesita el editor de la web, que es el módulo más pesado de todos.
  const panel = ['DashboardHome', 'Hermanos', 'Cuotas', 'Papeletas', 'Cortejo', 'Tesoreria',
    'Inventario', 'Archivo', 'Eventos', 'Comunicados', 'Informes', 'Personal', 'WebPublica',
    'Configuracion', 'Seguridad']
  for (const pagina of panel) {
    caso(`${pagina} se pide al pisarla`, true, app.includes(`const ${pagina} = lazy(() => import('./pages/app/${pagina}'))`))
    // Lo que de verdad se rompe: que vuelva a colarse un import de arriba.
    caso(`${pagina} no vuelve arriba`, false, new RegExp(`^import ${pagina} from`, 'm').test(app))
  }
  caso('el marco del panel también', true, app.includes("const AppShell = lazy(() => import('./components/AppShell'))"))
  // El área del hermano y la web pública son destinos, no sitios de paso.
  caso('el área del hermano se pide aparte', true, app.includes("const HermanoPortal = lazy(() => import('./pages/HermanoPortal'))"))
  caso('la web pública también', true, app.includes("const SitioPublico = lazy(() => import('./pages/SitioPublico'))"))

  // Sin Suspense, React revienta en cuanto una ruta perezosa se monta.
  caso('hay red debajo (Suspense)', true, /<Suspense fallback=\{<Cargando \/>\}>/.test(app))
  // El cargador no lleva texto (medio segundo de «Cargando…» se lee como un
  // parpadeo raro) pero sí lo dice a quien usa lector de pantalla.
  caso('el cargador se anuncia', true, app.includes('aria-live="polite"') && app.includes('sr-only'))

  // En la portada de Gobergo, el motor que pinta las webs de las hermandades
  // no se toca nunca: solo hace falta si el dominio es de una hermandad, y en
  // ese caso ya se está esperando a la consulta que dice de quién es.
  const raiz = await readFile('src/pages/Raiz.tsx', 'utf8')
  caso('la web de la hermandad se pide solo si toca', true, raiz.includes("lazy(() => import('./SitioPublico'))"))
  caso('y no está también arriba', false, /^import SitioPublico from/m.test(raiz))

  // Las bibliotecas, en su trozo: no cambian entre despliegues, así que la
  // secretaria no tiene que volver a bajárselas cada vez que se corrige una
  // coma. En marzo se despliega varias veces al día.
  const vite = await readFile('vite.config.ts', 'utf8')
  caso('hay trozos manuales', true, vite.includes('manualChunks'))
  caso('react va aparte', true, /return 'react'/.test(vite))
  caso('supabase va aparte', true, /return 'supabase'/.test(vite))
}
