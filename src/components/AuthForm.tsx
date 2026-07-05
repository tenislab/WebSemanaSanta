import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'signup'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AuthForm({ mode }: { mode: Mode }) {
  const { signIn, signUp, configured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/app'

  const [hermandad, setHermandad] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isSignup = mode === 'signup'

  function validate(): string | null {
    if (isSignup && hermandad.trim().length < 3)
      return 'Escribe el nombre de tu hermandad.'
    if (!EMAIL_RE.test(email)) return 'Introduce un correo electrónico válido.'
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      if (isSignup) {
        const { error, needsConfirmation } = await signUp(email, password, hermandad.trim())
        if (error) {
          setError(error)
          return
        }
        if (needsConfirmation) {
          setNotice(
            'Te hemos enviado un correo para confirmar tu cuenta. Ábrelo para activar el acceso.',
          )
          return
        }
        navigate('/app', { replace: true })
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error)
          return
        }
        navigate(redirectTo, { replace: true })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {!configured && (
        <div className="banner banner--info" role="status">
          <strong>Modo demostración.</strong> Conecta Supabase (archivo <code>.env</code>) para
          activar el acceso real.
        </div>
      )}

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="banner banner--success" role="status">
          {notice}
        </div>
      )}

      {isSignup && (
        <div className="field">
          <label htmlFor="hermandad">Nombre de la hermandad</label>
          <input
            id="hermandad"
            type="text"
            autoComplete="organization"
            placeholder="Hermandad de la Vera-Cruz"
            value={hermandad}
            onChange={(e) => setHermandad(e.target.value)}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="secretaria@tuhermandad.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field">
        <div className="field-row">
          <label htmlFor="password">Contraseña</label>
          {!isSignup && (
            <Link to="/recuperar" className="field-link">
              ¿La olvidaste?
            </Link>
          )}
        </div>
        <div className="input-wrap">
          <input
            id="password"
            type={showPass ? 'text' : 'password'}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder={isSignup ? 'Crea una contraseña (mín. 6)' : '••••••••••'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="input-affix"
            onClick={() => setShowPass((v) => !v)}
            aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPass ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      {!isSignup && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Mantener la sesión iniciada</span>
        </label>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? (
          <span className="spinner" aria-hidden="true" />
        ) : isSignup ? (
          'Crear hermandad'
        ) : (
          'Iniciar sesión'
        )}
      </button>

      {isSignup && (
        <p className="fineprint">
          Al crear la cuenta aceptas las condiciones del servicio y la política de privacidad.
        </p>
      )}
    </form>
  )
}
