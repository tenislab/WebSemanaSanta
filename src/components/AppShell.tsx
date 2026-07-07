import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Logo, { LogoMark } from './Logo'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../context/AuthContext'

interface NavItem {
  to: string
  label: string
  icon: JSX.Element
}
interface NavGroup {
  label?: string
  items: NavItem[]
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
  comunicados: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h16v11H8l-4 4z" /><path d="M8 9h8M8 12h5" /></svg>
  ),
  informes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 21V9M12 21V4M19 21v-6" /></svg>
  ),
  configuracion: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V19a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.55V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10c.14.42.42.78 1.55 1H20a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></svg>
  ),
}

const NAV: NavGroup[] = [
  {
    items: [
      { to: '/app', label: 'Inicio', icon: ic.inicio },
      { to: '/app/hermanos', label: 'Hermanos', icon: ic.hermanos },
      { to: '/app/cortejo', label: 'Cortejo', icon: ic.cortejo },
      { to: '/app/cuotas', label: 'Cuotas', icon: ic.cuotas },
      { to: '/app/papeletas', label: 'Papeletas de sitio', icon: ic.papeletas },
    ],
  },
  {
    label: 'Economía',
    items: [
      { to: '/app/tesoreria', label: 'Tesorería', icon: ic.tesoreria },
      { to: '/app/inventario', label: 'Inventario', icon: ic.inventario },
    ],
  },
  {
    label: 'Comunicación',
    items: [
      { to: '/app/archivo', label: 'Archivo documental', icon: ic.archivo },
      { to: '/app/comunicados', label: 'Comunicados', icon: ic.comunicados },
      { to: '/app/informes', label: 'Informes', icon: ic.informes },
    ],
  },
  {
    label: 'Sistema',
    items: [{ to: '/app/configuracion', label: 'Configuración', icon: ic.configuracion }],
  },
]

function initialsOf(input: string | undefined): string {
  if (!input) return '?'
  const parts = input.trim().split(/\s+/)
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '')
  return letters.join('') || input[0]?.toUpperCase() || '?'
}

export default function AppShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const hermandad = (user?.user_metadata?.hermandad as string | undefined) ?? 'Tu hermandad'
  const nombre = (user?.user_metadata?.nombre as string | undefined) ?? user?.email ?? 'Hermano/a'

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className={`app-side${drawerOpen ? ' app-side--open' : ''}`}>
        <div className="app-side__brand">
          <LogoMark size={30} />
          <span>
            <b>{hermandad}</b>
            <small>Panel de gestión</small>
          </span>
        </div>

        <nav className="app-nav">
          {NAV.map((group, gi) => (
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
            <small>{user?.email}</small>
          </span>
        </div>
      </aside>

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
          <div className="app-topbar__right">
            <ThemeToggle />
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
