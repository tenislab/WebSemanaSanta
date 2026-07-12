import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import { useAuth, DEMO_EMAIL, DEMO_PASSWORD } from '../context/AuthContext'
import { getPersonal } from '../lib/personal'

type Mode = 'login' | 'signup' | 'reset'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function inicialesDe(nombre: string) {
  const partes = nombre.trim().split(/\s+/)
  return partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const { signIn, signUp, resetPassword, configured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/app'
  const [searchParams] = useSearchParams()

  const [hermandad, setHermandad] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState(() => searchParams.get('correo') ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(true)
  const [accept, setAccept] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isSignup = mode === 'signup'
  const isReset = mode === 'reset'

  function validate(): string | null {
    if (!EMAIL_RE.test(email)) return 'Introduce un correo electrónico válido.'
    if (isReset) return null
    if (isSignup) {
      if (hermandad.trim().length < 3) return 'Escribe el nombre de tu hermandad.'
      if (nombre.trim().length < 3) return 'Escribe tu nombre y apellidos.'
    }
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
    if (isSignup) {
      if (confirm !== password) return 'Las contraseñas no coinciden.'
      if (!accept) return 'Debes aceptar las condiciones y la política de privacidad.'
    }
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
      if (isReset) {
        const { error } = await resetPassword(email)
        if (error) {
          setError(error)
          return
        }
        setNotice('Si ese correo tiene cuenta, te hemos enviado un enlace para restablecer la contraseña.')
        return
      }

      if (isSignup) {
        const { error, needsConfirmation } = await signUp(email, password, {
          hermandad: hermandad.trim(),
          nombre: nombre.trim(),
        })
        if (error) {
          setError(error)
          return
        }
        if (needsConfirmation) {
          setNotice('Te hemos enviado un correo para confirmar tu cuenta. Ábrelo para activar el acceso.')
          return
        }
        navigate('/app', { replace: true })
        return
      }

      const { error } = await signIn(email, password)
      if (error) {
        setError(error)
        return
      }
      navigate(redirectTo, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  async function entrarComoDemo(correoDemo: string, claveDemo: string) {
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      const { error } = await signIn(correoDemo, claveDemo)
      if (error) {
        setError(error)
        return
      }
      navigate(redirectTo, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const cuentasDemo = useMemo(
    () => [
      { id: 'titular', nombre: 'Usuario Demo', cargo: 'Titular · acceso completo', email: DEMO_EMAIL, clave: DEMO_PASSWORD },
      ...getPersonal()
        .filter((p) => p.activo)
        .map((p) => ({ id: p.id, nombre: p.nombre, cargo: p.cargo, email: p.email, clave: p.clave })),
    ],
    [],
  )

  const submitLabel = isReset
    ? 'Enviar enlace'
    : isSignup
      ? 'Crear hermandad'
      : 'Iniciar sesión'

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {!configured && mode === 'login' && (
        <div className="banner banner--info banner--demo" role="status">
          <div>
            <strong>Modo demostración.</strong> Entra con un clic como cualquiera de estas
            personas y comprueba cómo cada cargo ve solo lo que le corresponde.
          </div>
          <div className="demo-accounts">
            {cuentasDemo.map((c) => (
              <button
                type="button"
                key={c.id}
                className="demo-account"
                onClick={() => entrarComoDemo(c.email, c.clave)}
                disabled={submitting}
              >
                <span className="demo-account__avatar">{inicialesDe(c.nombre)}</span>
                <span>
                  <b>{c.nombre}</b>
                  <small>{c.cargo}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!configured && isSignup && (
        <div className="banner banner--info" role="status">
          <strong>Modo demostración.</strong> Puedes rellenar cualquier dato: se creará una
          hermandad de prueba local (no se guarda) y entrarás directamente.
        </div>
      )}
      {!configured && isReset && (
        <div className="banner banner--info" role="status">
          <strong>Modo demostración.</strong> No se envían correos; usa el usuario de prueba en{' '}
          <Link to="/login">iniciar sesión</Link>.
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
        <>
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
          <div className="field">
            <label htmlFor="nombre">Tu nombre y apellidos</label>
            <input
              id="nombre"
              type="text"
              autoComplete="name"
              placeholder="Nombre del responsable"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
        </>
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

      {!isReset && (
        <div className="field">
          <div className="field-row">
            <label htmlFor="password">Contraseña</label>
            {mode === 'login' && (
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
              placeholder={isSignup ? 'Crea una contraseña (mín. 6)' : configured ? '••••••••••' : 'demo1234 · tesoro123'}
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
      )}

      {isSignup && (
        <div className="field">
          <label htmlFor="confirm">Repite la contraseña</label>
          <input
            id="confirm"
            type={showPass ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Vuelve a escribirla"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      )}

      {mode === 'login' && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Mantener la sesión iniciada</span>
        </label>
      )}

      {isSignup && (
        <label className="checkbox">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          <span>
            Acepto las{' '}
            <a href="/legal/condiciones" target="_blank" rel="noopener noreferrer">condiciones del servicio</a> y la{' '}
            <a href="/legal/privacidad" target="_blank" rel="noopener noreferrer">política de privacidad</a>.
          </span>
        </label>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? <span className="spinner" aria-hidden="true" /> : submitLabel}
      </button>

      {isReset && (
        <p className="fineprint">Recibirás un correo con un enlace para crear una contraseña nueva.</p>
      )}

      {mode === 'login' && (
        <>
          <div className="auth-sep"><span>¿eres hermano/a?</span></div>
          <Link to="/hermano" className="btn btn-outline btn-block">
            Entrar en el área del hermano
          </Link>
        </>
      )}
    </form>
  )
}
