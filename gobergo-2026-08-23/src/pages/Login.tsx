import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import AuthForm from '../components/AuthForm'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { hayRecuperacionEnMarcha } from '../lib/recuperacionClave'
import PonerClaveNueva from '../components/PonerClaveNueva'

export default function Login() {
  const { session, mfaPendiente } = useAuth()
  const navigate = useNavigate()

  /**
   * ¿Venimos del enlace de «he olvidado mi contraseña»?
   *
   * Hay que mirarlo ANTES de empujar a nadie a `/app`. Al procesar ese enlace
   * Supabase abre sesión, así que sin esta comprobación el efecto de abajo se
   * llevaba a la persona al panel y nunca llegaba a cambiar la contraseña: la
   * siguiente vez volvía a no poder entrar y a pedir otro correo, en bucle.
   */
  const [recuperando, setRecuperando] = useState(() => hayRecuperacionEnMarcha())
  // El aviso de Supabase puede llegar después del primer pintado.
  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Si ya hay sesión, no tiene sentido mostrar el login… salvo que falte el
  // segundo factor: entonces hay que quedarse AQUÍ para pedir el código. Sin
  // esa condición, /login empujaba a /app, ProtectedRoute devolvía a /login y
  // quien activaba la verificación en dos pasos no podía volver a entrar.
  useEffect(() => {
    if (recuperando) return
    if (session && !mfaPendiente) navigate('/app', { replace: true })
  }, [session, mfaPendiente, navigate, recuperando])

  if (recuperando) {
    return (
      <AuthLayout
        eyebrow="Acceso"
        title="Elige una contraseña nueva"
        subtitle="Es el último paso para volver a entrar."
        footer={<Link to="/login">Volver a entrar</Link>}
      >
        <PonerClaveNueva alTerminar={() => navigate('/app', { replace: true })} />
      </AuthLayout>
    )
  }

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
