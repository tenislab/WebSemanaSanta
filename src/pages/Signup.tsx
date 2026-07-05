import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import AuthForm from '../components/AuthForm'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (session) navigate('/app', { replace: true })
  }, [session, navigate])

  return (
    <AuthLayout
      eyebrow="Nueva hermandad"
      title="Crea tu hermandad en Cabildo"
      subtitle="En unos minutos tendrás tu espacio listo para empezar a trabajar."
      footer={
        <>
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </>
      }
    >
      <AuthForm mode="signup" />
    </AuthLayout>
  )
}
