import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'

/**
 * Marcador de posición del área privada. La gestión interna (hermanos,
 * cuotas, papeletas, cortejo, tesorería…) se construirá sobre esta base.
 */
export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const hermandad = (user?.user_metadata?.hermandad as string | undefined) ?? 'tu hermandad'

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Logo size={30} />
        <div className="app-topbar__right">
          <ThemeToggle />
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="app-body">
        <div className="app-welcome">
          <p className="eyebrow">Área privada</p>
          <h1>Bienvenido a Cabildo</h1>
          <p className="app-welcome__lead">
            Has accedido como <strong>{user?.email}</strong>
            {user?.user_metadata?.hermandad ? (
              <>
                {' '}
                — <strong>{hermandad}</strong>
              </>
            ) : null}
            .
          </p>
          <p className="app-welcome__note">
            Aquí vivirá la gestión interna: hermanos, cuotas, papeletas de sitio, cortejo,
            tesorería y comunicaciones. De momento, la parte pública y el acceso ya están en
            marcha.
          </p>
        </div>
      </main>
    </div>
  )
}
