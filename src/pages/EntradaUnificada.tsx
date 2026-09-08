import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { IconoLibroDeReglas, IconoMedalla } from '../components/Iconos'

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
      subtitle="Elige tu camino para entrar en Gobergo."
      footer={<>¿Tu hermandad aún no está en Gobergo? Empieza gratis desde la portada.</>}
    >
      <div className="entrada-opciones">
        <Link to="/hermano" className="entrada-opcion">
          <span className="entrada-opcion__ic" aria-hidden="true">
            <IconoMedalla />
          </span>
          <span>
            <b>Soy hermano/a</b>
            <small>Busca tu hermandad, entra con tu DNI o pide el alta</small>
          </span>
        </Link>
        <Link to="/login" className="entrada-opcion">
          <span className="entrada-opcion__ic" aria-hidden="true">
            <IconoLibroDeReglas />
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
