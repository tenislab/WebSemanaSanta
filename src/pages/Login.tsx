import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import AuthForm from '../components/AuthForm'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session } = useAuth()
  const navigate = useNavigate()

  // Si ya hay sesión, no tiene sentido mostrar el login.
  useEffect(() => {
    if (session) navigate('/app', { replace: true })
  }, [session, navigate])

  return (
    <AuthLayout
      eyebrow="Acceso"
      title="Entra en tu hermandad"
      subtitle="Introduce tus credenciales para acceder al área de gestión."
      footer={
        <>
          ¿Tu hermandad aún no está en Cabildo?{' '}
          <Link to="/registro">Créala gratis</Link>
        </>
      }
    >
      <AuthForm mode="login" />
    </AuthLayout>
  )
}
