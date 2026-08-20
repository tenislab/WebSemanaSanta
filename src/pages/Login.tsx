import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import AuthForm from '../components/AuthForm'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, mfaPendiente } = useAuth()
  const navigate = useNavigate()

  // Si ya hay sesión, no tiene sentido mostrar el login… salvo que falte el
  // segundo factor: entonces hay que quedarse AQUÍ para pedir el código. Sin
  // esa condición, /login empujaba a /app, ProtectedRoute devolvía a /login y
  // quien activaba la verificación en dos pasos no podía volver a entrar.
  useEffect(() => {
    if (session && !mfaPendiente) navigate('/app', { replace: true })
  }, [session, mfaPendiente, navigate])

  return (
    <AuthLayout
      eyebrow="Acceso"
      title="Entra en tu hermandad"
      subtitle="Introduce tus credenciales para acceder al área de gestión."
      footer={
        <>
          ¿Tu hermandad aún no está en Gobergo?{' '}
          <Link to="/registro">Créala gratis</Link>
        </>
      }
    >
      <AuthForm mode="login" />
    </AuthLayout>
  )
}
