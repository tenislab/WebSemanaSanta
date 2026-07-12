import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'

/**
 * Punto de entrada único: antes había que elegir entre "Área del hermano" e
 * "Iniciar sesión" sin saber cuál te tocaba. Aquí basta con escribir tu DNI
 * (hermano/a) o tu correo (secretaría) y la app te lleva directa al sitio
 * correcto — el propio dato dice qué camino es.
 */
export default function EntradaUnificada() {
  const navigate = useNavigate()
  const [valor, setValor] = useState('')

  function continuar(e: FormEvent) {
    e.preventDefault()
    const dato = valor.trim()
    if (!dato) return
    if (dato.includes('@')) {
      navigate(`/login?correo=${encodeURIComponent(dato)}`)
    } else {
      navigate(`/hermano?dni=${encodeURIComponent(dato)}`)
    }
  }

  return (
    <AuthLayout
      eyebrow="Acceso"
      title="Entra en Cabildo"
      subtitle="Escribe tu DNI si eres hermano/a, o tu correo si gestionas la hermandad."
      footer={<>¿Tu hermandad aún no está en Cabildo? Empieza gratis desde la portada.</>}
    >
      <form className="app-form" onSubmit={continuar}>
        <div className="field">
          <label htmlFor="entradaValor">DNI o correo electrónico</label>
          <input
            id="entradaValor"
            type="text"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="12345678A o secretaria@tuhermandad.org"
            autoFocus
            autoComplete="username"
            required
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block">
          Continuar
        </button>
        <p className="portal__note">
          Con DNI vas a tu área de hermano/a; con correo, a la gestión de tu hermandad.
        </p>
      </form>
    </AuthLayout>
  )
}
