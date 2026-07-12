import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'

/**
 * Punto de entrada dividido en dos caminos claros — nada de adivinar qué
 * escribió la persona: cada quien elige quién es y la app lo lleva a su
 * sitio. El hermano/a busca su hermandad y entra o pide el alta; quien
 * gestiona la hermandad (titular o personal con cargo) va a su acceso de
 * siempre.
 */
export default function EntradaUnificada() {
  return (
    <AuthLayout
      eyebrow="Acceso"
      title="¿Quién eres?"
      subtitle="Elige tu camino para entrar en Cabildo."
      footer={<>¿Tu hermandad aún no está en Cabildo? Empieza gratis desde la portada.</>}
    >
      <div className="entrada-opciones">
        <Link to="/hermano" className="entrada-opcion">
          <span className="entrada-opcion__ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>
          </span>
          <span>
            <b>Soy hermano/a</b>
            <small>Busca tu hermandad, entra con tu DNI o pide el alta</small>
          </span>
        </Link>
        <Link to="/login" className="entrada-opcion">
          <span className="entrada-opcion__ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /></svg>
          </span>
          <span>
            <b>Gestiono la hermandad</b>
            <small>Secretaría, junta de gobierno o personal con cargo</small>
          </span>
        </Link>
      </div>
    </AuthLayout>
  )
}
