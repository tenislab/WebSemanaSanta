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
