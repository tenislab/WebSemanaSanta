/**
 * «HE OLVIDADO MI CONTRASEÑA». El formulario está en `components/AuthForm.tsx`.
 *
 * Aquí solo se pide el correo; el enlace que llega vuelve a `/login`, y es ESA
 * pantalla la que detecta que viene de una recuperación y pide la contraseña
 * nueva. El porqué —Supabase ABRE SESIÓN al procesar el enlace— está contado en
 * `pages/Login.tsx` y en `lib/recuperacionClave.ts`.
 */
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import AuthForm from '../components/AuthForm'

export default function ForgotPassword() {
  return (
    <AuthLayout
      eyebrow="Recuperar acceso"
      title="¿Olvidaste tu contraseña?"
      subtitle="Escribe tu correo y te enviaremos un enlace para crear una nueva."
      footer={
        <>
          ¿Ya la recuerdas? <Link to="/login">Volver a iniciar sesión</Link>
        </>
      }
    >
      <AuthForm mode="reset" />
    </AuthLayout>
  )
}
