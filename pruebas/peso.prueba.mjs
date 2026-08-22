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
    // Cada página tiene su función de carga con nombre —`cargarCuotas`— y el
    // `lazy` la usa. Ese rodeo NO es un capricho de estilo: es lo que permite
    // que la precarga de abajo llame exactamente a la misma función, y por
    // tanto que React encuentre el trozo ya en memoria cuando se pulsa.
    caso(`${pagina} se pide al pisarla`, true,
      new RegExp(`const cargar\\w+ = \\(\\) => import\\('\\./pages/app/${pagina}'\\)`).test(app))
    caso(`${pagina} usa esa misma función`, true,
      new RegExp(`const ${pagina} = lazy\\(cargar\\w+\\)`).test(app))
    // Lo que de verdad se rompe: que vuelva a colarse un import de arriba.
    caso(`${pagina} no vuelve arriba`, false, new RegExp(`^import ${pagina} from`, 'm').test(app))
  }
  caso('el marco del panel también', true, app.includes("const AppShell = lazy(cargarAppShell)"))
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

  /*
   * Partir el paquete arregló la primera visita y estropeó las siguientes: al
   * cambiar de pestaña dentro del panel había un parpadeo, porque el trozo de
   * esa pestaña no se había pedido todavía. Se ve poco con fibra y bastante en
   * un móvil, que es donde está media junta.
   *
   * El arreglo no es volver a juntarlo: es pedirlo antes de que haga falta, en
   * los huecos. Lo que se comprueba aquí es que se pide BIEN, porque una
   * precarga mal hecha es peor que ninguna.
   */
  caso('las pestañas se traen en los huecos', true, app.includes('requestIdleCallback'))
  caso('y se pueden cancelar al salir', true, app.includes('cancelIdleCallback'))
  // De una en una y encadenadas: catorce descargas a la vez le quitarían el
  // ancho de banda a lo que el usuario está mirando ahora mismo.
  caso('de una en una, no todas a la vez', false, /PRECARGA\.(map|forEach)\s*\(/.test(app))
  caso('encadenadas', true, /\.then\(\(\) => enHueco\(siguiente\)\)/.test(app))
  // Si una falla —un despliegue a mitad de sesión deja los nombres viejos sin
  // servidor— no se puede caer nada: esa pestaña se pedirá otra vez al pulsarla.
  caso('un fallo de precarga no tumba la sesión', true, /traer\(\)\.catch\(\(\) => \{\}\)/.test(app))
  // A quien va en ahorro de datos o con 2G no se le gastan megas en pantallas
  // que a lo mejor no abre: para esa persona el parpadeo es el mal menor.
  caso('se respeta el ahorro de datos', true, app.includes('saveData'))
  caso('y las conexiones lentas', true, /2g/.test(app))
  // Y sobre todo: solo se precarga a quien está DENTRO del panel. Quien mira
  // la web pública de una hermandad no tiene por qué bajarse tesorería.
  caso('solo se precarga dentro del panel', true, app.includes("pathname.startsWith('/app/')"))
  caso('la precarga está atada al sitio donde se está', true,
    /useEffect\(\(\) => \{[\s\S]{0,120}if \(!enElPanel\) return/.test(app))

  // La precarga solo sirve si los trozos siguen siendo trozos: si alguien
  // junta el panel en un paquete común, precargar Hermanos se traería también
  // el editor de la web, que es el módulo más pesado con diferencia.
  const { readdir } = await import('node:fs/promises')
  let construido = []
  try { construido = await readdir('dist/assets') } catch { /* sin construir */ }
  if (construido.length) {
    for (const pagina of ['Hermanos', 'Cuotas', 'WebPublica', 'Tesoreria']) {
      caso(`${pagina} sigue teniendo trozo propio`, true,
        construido.some((f) => f.startsWith(`${pagina}-`) && f.endsWith('.js')))
    }
  }
}
