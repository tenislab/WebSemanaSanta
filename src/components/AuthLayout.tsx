import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import Logo from './Logo'

interface AuthLayoutProps {
  eyebrow: string
  title: string
  subtitle: string
  children: ReactNode
  /** Enlace de cambio al pie del formulario (login ⇄ registro ⇄ recuperar). */
  footer: ReactNode
}

/**
 * Escenario "liquid glass" para acceso, registro y recuperación:
 * fondo ambiental con orbes de luz y una tarjeta de cristal esmerilado
 * flotando en el centro. Es un mundo visual propio (oscuro) elegido a
 * propósito, independiente del tema claro/oscuro del resto de la app.
 */
export default function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="auth-scene">
      <div className="auth-bg" aria-hidden="true">
        <span className="orb orb--gold" />
        <span className="orb orb--violet" />
        <span className="orb orb--plum" />
        <span className="auth-grain" />
      </div>

      <div className="auth-topbar">
        <Logo light size={34} />
        <Link to="/" className="auth-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Volver a la web
        </Link>
      </div>

      <main className="auth-stage">
        <section className="glass-panel">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>

          {children}

          <div className="auth-switch">{footer}</div>
        </section>

        <p className="auth-legal">Conexión cifrada · © 2026 Cabildo</p>
      </main>
    </div>
  )
}
