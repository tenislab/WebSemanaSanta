/**
 * LA PÁGINA DE REGISTRARSE. El formulario está en `components/AuthForm.tsx`.
 *
 * Quien se registra aquí es quien va a DAR DE ALTA SU HERMANDAD, no un hermano:
 * el hermano entra por `/entrar` con su DNI, y lo da de alta la secretaría. Al
 * resolverse la sesión, `AuthContext` llama a `asegurarHermandad()`
 * (`lib/multiHermandad.ts`), que le crea la hermandad SOLO si la cuenta no
 * pertenece ya a ninguna — es seguro llamarlo siempre.
 *
 * Y OJO con una cosa que no se ve: la escritura en la base NO se abre por
 * registrarse. `supabase/rls-endurecer.sql` es obligatorio precisamente por
 * esto — sin él, cualquiera que se registre aquí obtiene acceso de escritura a
 * toda la base de datos.
 */
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
      title="Crea tu hermandad en Gobergo"
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
