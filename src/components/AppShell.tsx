import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Logo, { LogoMark } from './Logo'
import ThemeToggle from './ThemeToggle'
import PaletaComandos, { type DestinoPaleta } from './PaletaComandos'
import { useAuth } from '../context/AuthContext'
import { cargoDeCuenta, puedeVerModulo, usePermisosSincronizados } from '../lib/permisos'
import { getPersonal } from '../lib/personal'
import { useSuscripcion, moduloPermitidoPorPack } from '../lib/suscripcion'
import PantallaSuscripcion from './PantallaSuscripcion'

interface NavItem {
  to: string
  label: string
  icon: JSX.Element
  /** Módulo de lib/permisos.ts que gobierna este enlace; sin él, siempre visible (p. ej. Inicio). */
  modulo?: string
}
interface NavGroup {
  label?: string
  items: NavItem[]
}

/** De la ruta actual al módulo que la gobierna, para bloquear el acceso directo por URL. null = sin restricción (Inicio). */
function moduloIdDeRuta(pathname: string): string | null {
  const rutas: { prefix: string; modulo: string }[] = [
    { prefix: '/app/hermanos', modulo: 'hermanos' },
    { prefix: '/app/cortejo', modulo: 'cortejo' },
    { prefix: '/app/cuotas', modulo: 'cuotas' },
    { prefix: '/app/papeletas', modulo: 'papeletas' },
    { prefix: '/app/tesoreria', modulo: 'tesoreria' },
    { prefix: '/app/inventario', modulo: 'inventario' },
    { prefix: '/app/archivo', modulo: 'archivo' },
    { prefix: '/app/eventos', modulo: 'eventos' },
    { prefix: '/app/comunicados', modulo: 'comunicados' },
    { prefix: '/app/web', modulo: 'web' },
    { prefix: '/app/informes', modulo: 'informes' },
    { prefix: '/app/personal', modulo: 'personal' },
    { prefix: '/app/configuracion', modulo: 'configuracion' },
  ]
  return rutas.find((r) => pathname.startsWith(r.prefix))?.modulo ?? null
}

const ic = {
  inicio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9.5h12V10" /></svg>
  ),
  hermanos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="8" r="3" /><path d="M15 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M16 8a3 3 0 0 1 0 6M21 21v-2a4 4 0 0 0-3-3.8" /></svg>
  ),
  cortejo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v18M6 8v13M18 8v13M4 21h16" /><circle cx="12" cy="3" r="1.4" /></svg>
  ),
  cuotas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>
  ),
  papeletas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" /><path d="M10 6v12" strokeDasharray="2 2" /></svg>
  ),
  tesoreria: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 6h18v12H3z" /><path d="M3 10h18M7 15h4" /></svg>
  ),
  inventario: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>
  ),
  archivo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 4h10l6 6v10H4Z" /><path d="M14 4v6h6" /></svg>
  ),
  eventos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 15l2.2 2.2L15 12.5" /></svg>
  ),
  comunicados: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h16v11H8l-4 4z" /><path d="M8 9h8M8 12h5" /></svg>
  ),
  informes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 21V9M12 21V4M19 21v-6" /></svg>
  ),
  personal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M8 14h.01M12 14h4" /></svg>
  ),
  configuracion: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V19a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.55V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10c.14.42.42.78 1.55 1H20a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></svg>
  ),
  seguridad: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l8 3.5v5c0 5-3.4 8.4-8 9.5-4.6-1.1-8-4.5-8-9.5v-5L12 3Z" /><path d="M9 12l2 2 4-4" /></svg>
  ),
}

const NAV: NavGroup[] = [
  {
    items: [
      { to: '/app', label: 'Inicio', icon: ic.inicio },
      { to: '/app/hermanos', label: 'Hermanos', icon: ic.hermanos, modulo: 'hermanos' },
      { to: '/app/cortejo', label: 'Cortejo', icon: ic.cortejo, modulo: 'cortejo' },
      { to: '/app/cuotas', label: 'Cuotas', icon: ic.cuotas, modulo: 'cuotas' },
      { to: '/app/papeletas', label: 'Papeletas de sitio', icon: ic.papeletas, modulo: 'papeletas' },
    ],
  },
  {
    label: 'Economía',
    items: [
      { to: '/app/tesoreria', label: 'Tesorería', icon: ic.tesoreria, modulo: 'tesoreria' },
      { to: '/app/inventario', label: 'Inventario', icon: ic.inventario, modulo: 'inventario' },
    ],
  },
  {
    label: 'Vida de hermandad',
    items: [
      { to: '/app/eventos', label: 'Eventos y tareas', icon: ic.eventos, modulo: 'eventos' },
      { to: '/app/archivo', label: 'Archivo documental', icon: ic.archivo, modulo: 'archivo' },
      { to: '/app/comunicados', label: 'Comunicados', icon: ic.comunicados, modulo: 'comunicados' },
      { to: '/app/web', label: 'Web pública', icon: ic.comunicados, modulo: 'web' },
      { to: '/app/informes', label: 'Informes', icon: ic.informes, modulo: 'informes' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/app/personal', label: 'Personal y permisos', icon: ic.personal, modulo: 'personal' },
      { to: '/app/configuracion', label: 'Configuración', icon: ic.configuracion, modulo: 'configuracion' },
      // Sin `modulo`: es la seguridad de la propia cuenta, no un módulo de gestión de la
      // hermandad, así que se ve pase lo que pase tenga el cargo que tenga permitido.
      { to: '/app/seguridad', label: 'Seguridad', icon: ic.seguridad },
    ],
  },
]

/** Fecha de hoy en ISO con la hora local (toISOString daría el día anterior de madrugada). */
function fechaHoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function initialsOf(input: string | undefined): string {
  if (!input) return '?'
  const parts = input.trim().split(/\s+/)
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '')
  return letters.join('') || input[0]?.toUpperCase() || '?'
}

export default function AppShell() {
  const { user, signOut } = useAuth()
  // Aviso cuando un guardado no llega a la base de datos (ver supabaseSync).
  const [errorSync, setErrorSync] = useState<string | null>(null)
  useEffect(() => {
    function alFallar(e: Event) {
      const detalle = (e as CustomEvent<{ tabla: string }>).detail
      setErrorSync(detalle?.tabla ?? '')
    }
    window.addEventListener('cabildo-sync-error', alFallar)
    return () => window.removeEventListener('cabildo-sync-error', alFallar)
  }, [])
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { suscripcion, activar } = useSuscripcion()

  const hermandad = (user?.user_metadata?.hermandad as string | undefined) ?? 'Tu hermandad'
  const nombre = (user?.user_metadata?.nombre as string | undefined) ?? user?.email ?? 'Hermano/a'
  /**
   * El cargo se resuelve contra la lista REAL de personal, no contra el
   * metadata de la sesión: ese valor lo puede reescribir el propio usuario
   * (`auth.updateUser({ data: { cargo: null } })`) y borrarlo abría el panel
   * entero. El metadata solo se usa para saber QUÉ cuenta de personal es.
   */
  const cargo = useMemo(() => {
    const personalId = user?.user_metadata?.personalId as string | undefined
    return cargoDeCuenta(personalId, getPersonal())
    // `permisosVersion` no entra aquí: el cargo no cambia con los permisos.
  }, [user])
  // Trae los permisos reales de Supabase en cuanto cargan (no solo los que hubiera en este navegador).
  const permisosVersion = usePermisosSincronizados()

  const navFiltrado = useMemo(
    () =>
      NAV.map((group) => ({
        ...group,
        // Un enlace se ve si el cargo tiene permiso Y el pack contratado incluye
        // ese módulo (p. ej. la Web pública solo con un pack que traiga la web).
        items: group.items.filter(
          (item) =>
            (!item.modulo || puedeVerModulo(cargo, item.modulo)) &&
            moduloPermitidoPorPack(suscripcion, item.modulo),
        ),
      })).filter((group) => group.items.length > 0),
    // `permisosVersion` no se usa dentro a propósito: es un contador que sube
    // cuando llegan los permisos reales desde la base de datos, y está aquí
    // justamente para recalcular el menú en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cargo, permisosVersion, suscripcion],
  )

  /** Los destinos que ve este cargo, para la paleta de comandos (Ctrl+K). */
  const destinosPaleta = useMemo<DestinoPaleta[]>(
    () =>
      navFiltrado.flatMap((g) =>
        g.items.map((i) => ({ to: i.to, label: i.label, grupo: g.label ?? 'Ir a', icon: i.icon })),
      ),
    [navFiltrado],
  )

  const moduloActual = moduloIdDeRuta(location.pathname)

  useEffect(() => {
    // Con varias pestañas abiertas, todas ponían «Cabildo» y no se distinguían.
    // Se busca el enlace más largo que encaje: así «/app/hermanos/lo-que-sea»
    // sigue diciendo «Hermanos», y «/app» a secas cae en «Inicio».
    const enlace = NAV.flatMap((g) => g.items)
      .filter((i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`))
      .sort((a, b) => b.to.length - a.to.length)[0]
    const nombre = enlace?.label ?? 'Inicio'
    document.title = `${nombre} · ${hermandad} · Cabildo`
  }, [location.pathname, hermandad])
  const accesoBloqueado =
    moduloActual !== null &&
    (!puedeVerModulo(cargo, moduloActual) || !moduloPermitidoPorPack(suscripcion, moduloActual))

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  // Muro de suscripción: sin suscripción activa, el panel queda bloqueado.
  if (!suscripcion.activa) {
    return (
      <PantallaSuscripcion
        nombreHermandad={hermandad}
        onActivar={(pack, periodo) => activar(pack, periodo, fechaHoyLocal())}
        onSalir={handleSignOut}
      />
    )
  }

  return (
    <div className="app-shell">
      {/* Con teclado había que pasar por los quince enlaces del menú en cada
          página antes de llegar al contenido. */}
      <a className="saltar-al-contenido" href="#contenido">Saltar al contenido</a>
      <aside className={`app-side${drawerOpen ? ' app-side--open' : ''}`}>
        <div className="app-side__brand">
          <LogoMark size={30} />
          <span>
            <b>{hermandad}</b>
            <small>Panel de gestión</small>
          </span>
        </div>

        <nav className="app-nav">
          {navFiltrado.map((group, gi) => (
            <div className="app-nav__group" key={group.label ?? gi}>
              {group.label && <p className="app-nav__label">{group.label}</p>}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/app'}
                  className={({ isActive }) => `app-nav__link${isActive ? ' is-active' : ''}`}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="app-nav__ic">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="app-side__foot">
          <span className="app-avatar">{initialsOf(nombre)}</span>
          <span className="app-side__who">
            <b>{nombre}</b>
            <small>{cargo ?? user?.email}</small>
          </span>
        </div>
      </aside>

      <PaletaComandos destinos={destinosPaleta} onCerrarSesion={handleSignOut} />

      {drawerOpen && <button className="app-scrim" aria-label="Cerrar menú" onClick={() => setDrawerOpen(false)} />}

      <div className="app-main">
        <header className="app-topbar">
          <button
            className="app-menu-btn"
            aria-label="Abrir menú"
            onClick={() => setDrawerOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <Logo size={26} withText={false} />
          {/* Ir a cualquier módulo sin buscar el menú: el atajo se enseña aquí
              porque si no, nadie descubre que existe. */}
          <button
            type="button"
            className="app-buscar"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></svg>
            <span>Ir a…</span>
            <kbd>Ctrl</kbd><kbd>K</kbd>
          </button>
          <div className="app-topbar__right">
            <ThemeToggle />
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
              Cerrar sesión
            </button>
          </div>
        </header>

        {errorSync !== null && (
          <div className="banner-inline banner-inline--warn app-sync-error" role="alert">
            <span>
              <b>No se ha podido guardar en la base de datos</b>
              {errorSync ? ` (${errorSync})` : ''}. Lo que ves en pantalla puede no estar guardado:
              revisa tu conexión y vuelve a intentarlo.
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setErrorSync(null)}>
              Entendido
            </button>
          </div>
        )}

        <main className="app-content" id="contenido" tabIndex={-1}>
          {/* Sin acceso a este módulo por cargo: no se muestra "bloqueado", sino que
              se redirige a Inicio, de modo que la sección simplemente no aparece. */}
          {accesoBloqueado ? <Navigate to="/app" replace /> : <Outlet />}
        </main>
      </div>
    </div>
  )
}
