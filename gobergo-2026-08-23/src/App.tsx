import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Raiz from './pages/Raiz'
import EntradaUnificada from './pages/EntradaUnificada'
import ProtectedRoute from './components/ProtectedRoute'

/*
 * Lo que se descarga y CUÁNDO.
 * -------------------------------------------------------------------------
 * Antes esto eran veintisiete `import` de arriba, y el navegador se los
 * bajaba todos antes de pintar nada. O sea: un hermano que abre su área para
 * ver a qué hora tiene que estar en la casa de hermandad se descargaba
 * enterito el panel de gestión —tesorería, remesas SEPA, el editor de la web,
 * la matriz de permisos— que no va a ver nunca. 1,2 MB por una hora de cita.
 *
 * Y no es un detalle de los que solo se notan con el cronómetro: el Domingo de
 * Ramos por la mañana hay ochocientas personas mirando su papeleta a la vez,
 * desde la calle, con la cobertura que haya. Ahí un megabyte de más son
 * segundos de pantalla en blanco.
 *
 * Así que arriba se quedan SOLO las cuatro puertas de entrada —la portada, el
 * acceso, el área del hermano y la web pública de la hermandad—, que son las
 * que abre alguien que llega de fuera. Todo lo demás se pide cuando se pisa.
 *
 * Las páginas del panel van una a una, no en un paquete común: quien entra a
 * Cuotas no necesita el editor de la web, que es con diferencia el módulo más
 * pesado de todos.
 */
/* El área del hermano y la web pública de la hermandad son destinos: se llega
   a ellos a propósito, no de paso. Cada uno pesa lo suyo (el área del hermano
   son 2.200 líneas; la web, su motor entero) y ninguno de los dos le hace
   falta a quien va al otro. */
const HermanoPortal = lazy(conReintento(() => import('./pages/HermanoPortal')))
const SitioPublico = lazy(conReintento(() => import('./pages/SitioPublico')))

const Login = lazy(conReintento(() => import('./pages/Login')))
const Signup = lazy(conReintento(() => import('./pages/Signup')))
const ForgotPassword = lazy(conReintento(() => import('./pages/ForgotPassword')))
const PaginaLegal = lazy(conReintento(() => import('./pages/PaginaLegal')))
const VerificarPapeleta = lazy(conReintento(() => import('./pages/VerificarPapeleta')))
const AvisosWeb = lazy(conReintento(() => import('./pages/AvisosWeb')))

/*
 * Las páginas del panel, con el «pídelo» separado del componente.
 *
 * Partir el paquete arregló la primera visita pero estropeó las siguientes:
 * cada vez que se cambiaba de pestaña dentro del panel había un parpadeo,
 * porque el trozo de esa pestaña no se había pedido todavía. Se notaba poco en
 * el despacho de la hermandad, con fibra, y bastante en un móvil.
 *
 * La solución no es volver a juntarlo todo: es pedirlo ANTES de que haga
 * falta. Por eso cada página tiene aquí su función de carga con nombre, y no
 * un `import()` anónimo metido dentro del `lazy()`. La misma función que usa
 * React para cargar la página bajo demanda la usa `prefetch` de abajo para
 * traérsela en los ratos muertos. Y como `import()` guarda lo que ya trajo,
 * llamarla dos veces no descarga nada dos veces: la segunda es instantánea.
 */
/**
 * QUE UN TROZO QUE NO CARGA NO ROMPA LA PANTALLA.
 *
 * Cada página se descarga aparte, y su nombre de archivo lleva dentro un
 * número que cambia en cada despliegue. Cuando se sube una versión nueva, el
 * `index.html` que tiene el navegador en memoria sigue apuntando a los
 * nombres VIEJOS — que en el servidor ya no existen.
 *
 * A partir de ahí, la primera pestaña que se abra intenta descargar un archivo
 * que da 404, `lazy()` lanza el error y la pantalla se queda en blanco. Se
 * arregla recargando, y por eso se lee como «va a rachas»: falla la primera
 * vez, funciona a la segunda, y no hay forma de reproducirlo después.
 *
 * Le pasa a cualquiera que tuviera la aplicación abierta cuando se despliega,
 * que en una hermandad es la secretaría entera un lunes por la mañana.
 *
 * Así que se recarga sola. UNA VEZ, y con la marca en `sessionStorage`: si el
 * trozo tampoco carga después de recargar el problema es otro —sin conexión,
 * un archivo que de verdad falta— y entonces hay que dejar que el error salga
 * en vez de recargar en bucle, que es mucho peor que una pantalla en blanco.
 */
const MARCA_RECARGA = 'cabildo-recargado-por-trozo'

function conReintento<T>(cargar: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      const modulo = await cargar()
      /*
       * Ha cargado: se borra la marca. Sin esto, la recarga solo se podría
       * usar una vez por pestaña — y el siguiente despliegue del mismo día
       * dejaría la pantalla en blanco otra vez.
       */
      try { sessionStorage.removeItem(MARCA_RECARGA) } catch { /* sin sessionStorage */ }
      return modulo
    } catch (e) {
      let yaSeIntento = true
      try {
        yaSeIntento = sessionStorage.getItem(MARCA_RECARGA) === '1'
        if (!yaSeIntento) sessionStorage.setItem(MARCA_RECARGA, '1')
      } catch {
        // Sin sessionStorage no se puede saber si ya se recargó, y recargar a
        // ciegas puede entrar en bucle: mejor dejar el error.
      }
      if (yaSeIntento) throw e
      window.location.reload()
      // La página se está yendo: se devuelve una promesa que no resuelve nunca
      // para que React no pinte nada mientras tanto.
      return new Promise<T>(() => {})
    }
  }
}

const cargarAppShell = conReintento(() => import('./components/AppShell'))
const cargarDashboard = conReintento(() => import('./pages/app/DashboardHome'))
const cargarHermanos = conReintento(() => import('./pages/app/Hermanos'))
const cargarNotificaciones = conReintento(() => import('./pages/app/Notificaciones'))
const cargarCuotas = conReintento(() => import('./pages/app/Cuotas'))
const cargarPapeletas = conReintento(() => import('./pages/app/Papeletas'))
const cargarCortejo = conReintento(() => import('./pages/app/Cortejo'))
const cargarTesoreria = conReintento(() => import('./pages/app/Tesoreria'))
const cargarInventario = conReintento(() => import('./pages/app/Inventario'))
const cargarArchivo = conReintento(() => import('./pages/app/Archivo'))
const cargarEventos = conReintento(() => import('./pages/app/Eventos'))
const cargarComunicados = conReintento(() => import('./pages/app/Comunicados'))
const cargarInformes = conReintento(() => import('./pages/app/Informes'))
const cargarPersonal = conReintento(() => import('./pages/app/Personal'))
const cargarWebPublica = conReintento(() => import('./pages/app/WebPublica'))
const cargarConfiguracion = conReintento(() => import('./pages/app/Configuracion'))
const cargarSeguridad = conReintento(() => import('./pages/app/Seguridad'))

const AppShell = lazy(cargarAppShell)
const DashboardHome = lazy(cargarDashboard)
const Hermanos = lazy(cargarHermanos)
const Notificaciones = lazy(cargarNotificaciones)
const Cuotas = lazy(cargarCuotas)
const Papeletas = lazy(cargarPapeletas)
const Cortejo = lazy(cargarCortejo)
const Tesoreria = lazy(cargarTesoreria)
const Inventario = lazy(cargarInventario)
const Archivo = lazy(cargarArchivo)
const Eventos = lazy(cargarEventos)
const Comunicados = lazy(cargarComunicados)
const Informes = lazy(cargarInformes)
const Personal = lazy(cargarPersonal)
const WebPublica = lazy(cargarWebPublica)
const Configuracion = lazy(cargarConfiguracion)
const Seguridad = lazy(cargarSeguridad)

/*
 * El orden en que se traen las pestañas del panel cuando no se está haciendo
 * nada. No es alfabético ni caprichoso: es el orden en que la gente las abre.
 *
 * Quien entra al panel casi siempre va a Hermanos —a buscar a alguien—, y de
 * ahí a Cuotas. En febrero y marzo, a Papeletas. El editor de la web y la
 * matriz de permisos se abren una vez al trimestre, así que van los últimos:
 * si al usuario le da tiempo a pulsarlos antes de que lleguen, se cargan como
 * siempre y no ha pasado nada.
 */
const PRECARGA = [
  cargarHermanos,
  cargarCuotas,
  cargarPapeletas,
  cargarCortejo,
  cargarTesoreria,
  cargarComunicados,
  cargarEventos,
  cargarInformes,
  cargarInventario,
  cargarArchivo,
  cargarPersonal,
  cargarConfiguracion,
  cargarSeguridad,
  cargarWebPublica,
]

/*
 * Trae las pestañas de una en una, y solo cuando el navegador no tiene nada
 * mejor que hacer.
 *
 * Las tres cautelas importantes:
 *
 * - De una en una, encadenadas. Catorce descargas a la vez le quitarían el
 *   ancho de banda a lo que el usuario está mirando AHORA, que es justo lo
 *   contrario de lo que se busca.
 * - `requestIdleCallback`, no un `setTimeout`. Si el usuario está escribiendo
 *   en un buscador o desplegando una lista larga, no se descarga nada hasta
 *   que pare.
 * - `saveData` y las conexiones lentas quedan fuera. A quien tiene el móvil en
 *   ahorro de datos o va con 2G no se le gastan megas en pantallas que a lo
 *   mejor no abre; para esa persona el parpadeo es el mal menor.
 */
function precargarPanel(): () => void {
  let cancelado = false
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }
  const conexion = (navigator as unknown as {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection
  if (conexion?.saveData) return () => {}
  if (conexion?.effectiveType && /^(slow-)?2g$/.test(conexion.effectiveType)) return () => {}

  let idle = 0
  let timer = 0
  const enHueco = (fn: () => void) => {
    if (w.requestIdleCallback) idle = w.requestIdleCallback(fn, { timeout: 3000 })
    else timer = window.setTimeout(fn, 300)
  }

  let i = 0
  const siguiente = () => {
    if (cancelado || i >= PRECARGA.length) return
    const traer = PRECARGA[i++]
    /* Si una falla (un despliegue a mitad de sesión deja los nombres de los
       ficheros viejos sin servidor) no se cae nada: esa pestaña se pedirá otra
       vez al pulsarla, y entonces sí se verá el error donde toca. */
    traer().catch(() => {}).then(() => enHueco(siguiente))
  }
  enHueco(siguiente)

  return () => {
    cancelado = true
    if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle)
    if (timer) clearTimeout(timer)
  }
}

/**
 * Lo que se ve mientras llega el trozo que falta.
 *
 * Es medio segundo en una conexión normal, así que NO lleva texto: un
 * «Cargando…» que aparece y desaparece en 400 ms se lee como un parpadeo raro.
 * Lleva `aria-live` para que quien navega con lector de pantalla sí se entere
 * de que hay algo en camino, y `min-height` para que el pie no dé un salto
 * hacia arriba y vuelva a bajar.
 */
function Cargando() {
  return (
    <div className="ruta-cargando" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">Cargando la sección</span>
    </div>
  )
}

export default function App() {
  const { pathname } = useLocation()
  /* Solo se precarga el panel a quien está DENTRO del panel. Quien está
     mirando la web pública de una hermandad, o su área de hermano, no tiene
     por qué descargarse tesorería ni el editor de la web: para esa persona
     serían megas tirados. */
  const enElPanel = pathname === '/app' || pathname.startsWith('/app/')
  useEffect(() => {
    if (!enElPanel) return
    return precargarPanel()
  }, [enElPanel])

  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
      <Route path="/" element={<Raiz />} />
      <Route path="/entrar" element={<EntradaUnificada />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Signup />} />
      <Route path="/recuperar" element={<ForgotPassword />} />
      <Route path="/hermano" element={<HermanoPortal />} />
      <Route path="/w/:slug" element={<SitioPublico />} />
      {/* Una noticia con su enlace propio, y el listado completo. */}
      <Route path="/w/:slug/n/:noticia" element={<SitioPublico />} />
      <Route path="/w/:slug/noticias" element={<SitioPublico />} />
      {/* La ficha de un titular, con su enlace propio. */}
      <Route path="/w/:slug/t/:titular" element={<SitioPublico />} />
      {/* Y cada culto. Es el enlace que se pega en el grupo cuando se
          anuncia un quinario: lleva a la página del culto, con su hora, su
          sitio y el botón de añadirlo al calendario. */}
      <Route path="/w/:slug/c/:culto" element={<SitioPublico />} />

      {/*
        Las mismas páginas, colgando de la raíz, para la hermandad que ha
        conectado su dominio: ahí su web vive en `/` y una noticia es
        `hermandaddetriana.es/n/cartel-2027`, no `/w/hermandad-de-triana/n/…`.

        Sin estas líneas caían en el `*` de abajo y volvían a la
        portada. Y no es un caso raro: son EXACTAMENTE las direcciones que la
        propia aplicación mete en el `sitemap.xml` y en el enlace que se pega
        en el grupo de WhatsApp en cuanto hay dominio propio. Todas ellas
        llevaban a la portada.
      */}
      <Route path="/noticias" element={<Raiz soloWeb />} />
      <Route path="/n/:noticia" element={<Raiz soloWeb />} />
      <Route path="/t/:titular" element={<Raiz soloWeb />} />
      <Route path="/c/:culto" element={<Raiz soloWeb />} />

      <Route path="/legal/:slug" element={<PaginaLegal />} />
      <Route path="/verificar" element={<VerificarPapeleta />} />
      {/* Confirmar el correo y darse de baja de los avisos de la hermandad.
          Son los dos enlaces que salen en cada correo que se manda. */}
      <Route path="/avisos" element={<AvisosWeb />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="notificaciones" element={<Notificaciones />} />
        <Route path="hermanos" element={<Hermanos />} />
        <Route path="cortejo" element={<Cortejo />} />
        <Route path="cuotas" element={<Cuotas />} />
        <Route path="papeletas" element={<Papeletas />} />
        <Route path="tesoreria" element={<Tesoreria />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="archivo" element={<Archivo />} />
        <Route path="eventos" element={<Eventos />} />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="informes" element={<Informes />} />
        <Route path="personal" element={<Personal />} />
        <Route path="web" element={<WebPublica />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="seguridad" element={<Seguridad />} />
      </Route>

      {/* Cualquier ruta desconocida vuelve a la portada */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
