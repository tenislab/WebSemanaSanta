import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

interface AuthLayoutProps {
  eyebrow: string
  title: string
  subtitle: string
  children: ReactNode
  /** Enlace de cambio al pie del formulario (login ⇄ registro). */
  footer: ReactNode
}

/**
 * Estructura premium de pantalla partida para acceso y registro:
 * panel de marca a la izquierda, formulario a la derecha.
 */
export default function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="auth-shell">
      {/* Panel de marca */}
      <aside className="auth-aside">
        <div className="auth-aside__top">
          <Logo light size={36} />
          <Link to="/" className="auth-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Volver a la web
          </Link>
        </div>

        <div className="auth-aside__body">
          <p className="auth-aside__eyebrow">Gestión de hermandades y cofradías</p>
          <blockquote className="auth-aside__quote">
            “Desde que llevamos el censo, las cuotas y las papeletas con Cabildo,
            la secretaría ha dejado de vivir entre papeles.”
          </blockquote>
          <cite className="auth-aside__cite">
            Secretaría — Hermandad de la Vera-Cruz
          </cite>
        </div>

        <ul className="auth-aside__feats">
          <li>Hermanos, cuotas y papeletas en un solo lugar</li>
          <li>Portal propio para cada hermano</li>
          <li>Datos cifrados y copias de seguridad</li>
        </ul>
      </aside>

      {/* Panel de formulario */}
      <main className="auth-main">
        <div className="auth-main__bar">
          <Link to="/" className="auth-main__brand">
            <Logo size={30} />
          </Link>
          <ThemeToggle />
        </div>

        <div className="auth-main__center">
          <div className="auth-card">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="auth-title">{title}</h1>
            <p className="auth-subtitle">{subtitle}</p>

            {children}

            <div className="auth-switch">{footer}</div>
          </div>
        </div>

        <footer className="auth-main__foot">
          <span>© {2026} Cabildo</span>
          <span className="auth-main__foot-links">
            <a href="#">Privacidad</a>
            <a href="#">Condiciones</a>
            <a href="#">Soporte</a>
          </span>
        </footer>
      </main>
    </div>
  )
}
