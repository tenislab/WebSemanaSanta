import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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
const HermanoPortal = lazy(() => import('./pages/HermanoPortal'))
const SitioPublico = lazy(() => import('./pages/SitioPublico'))

const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const PaginaLegal = lazy(() => import('./pages/PaginaLegal'))
const VerificarPapeleta = lazy(() => import('./pages/VerificarPapeleta'))

const AppShell = lazy(() => import('./components/AppShell'))
const DashboardHome = lazy(() => import('./pages/app/DashboardHome'))
const Hermanos = lazy(() => import('./pages/app/Hermanos'))
const Cuotas = lazy(() => import('./pages/app/Cuotas'))
const Papeletas = lazy(() => import('./pages/app/Papeletas'))
const Cortejo = lazy(() => import('./pages/app/Cortejo'))
const Tesoreria = lazy(() => import('./pages/app/Tesoreria'))
const Inventario = lazy(() => import('./pages/app/Inventario'))
const Archivo = lazy(() => import('./pages/app/Archivo'))
const Eventos = lazy(() => import('./pages/app/Eventos'))
const Comunicados = lazy(() => import('./pages/app/Comunicados'))
const Informes = lazy(() => import('./pages/app/Informes'))
const Personal = lazy(() => import('./pages/app/Personal'))
const WebPublica = lazy(() => import('./pages/app/WebPublica'))
const Configuracion = lazy(() => import('./pages/app/Configuracion'))
const Seguridad = lazy(() => import('./pages/app/Seguridad'))

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

      {/*
        Las mismas páginas, colgando de la raíz, para la hermandad que ha
        conectado su dominio: ahí su web vive en `/` y una noticia es
        `hermandaddetriana.es/n/cartel-2027`, no `/w/hermandad-de-triana/n/…`.

        Sin estas cuatro líneas caían en el `*` de abajo y volvían a la
        portada. Y no es un caso raro: son EXACTAMENTE las direcciones que la
        propia aplicación mete en el `sitemap.xml` y en el enlace que se pega
        en el grupo de WhatsApp en cuanto hay dominio propio. Todas ellas
        llevaban a la portada.
      */}
      <Route path="/noticias" element={<Raiz soloWeb />} />
      <Route path="/n/:noticia" element={<Raiz soloWeb />} />
      <Route path="/t/:titular" element={<Raiz soloWeb />} />

      <Route path="/legal/:slug" element={<PaginaLegal />} />
      <Route path="/verificar" element={<VerificarPapeleta />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
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
