import { useEffect, useState, type FormEvent } from 'react'
import { useAuth, type FactorMfa } from '../../context/AuthContext'

export default function Seguridad() {
  const { configured, listarFactoresMfa, activarMfa, confirmarMfa, desactivarMfa } = useAuth()
  const [factores, setFactores] = useState<FactorMfa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [alta, setAlta] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null)
  const [codigo, setCodigo] = useState('')

  async function cargarFactores() {
    const lista = await listarFactoresMfa()
    setFactores(lista.filter((f) => f.status === 'verified'))
    setCargando(false)
  }

  useEffect(() => {
    if (configured) {
      cargarFactores()
    } else {
      setCargando(false)
    }
    // Solo al montar: no hace falta recargar salvo tras las propias acciones de esta página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured])

  async function empezarAlta() {
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      const { error, factorId, qrCode, secret } = await activarMfa()
      if (error || !factorId || !qrCode || !secret) {
        setError(error ?? 'No se pudo empezar el alta. Inténtalo de nuevo.')
        return
      }
      setAlta({ factorId, qrCode, secret })
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmarAlta(e: FormEvent) {
    e.preventDefault()
    if (!alta) return
    setError(null)
    setSubmitting(true)
    try {
      const { error } = await confirmarMfa(alta.factorId, codigo.trim())
      if (error) {
        setError(error)
        return
      }
      setAlta(null)
      setCodigo('')
      setNotice('Verificación en dos pasos activada. La próxima vez que inicies sesión te pedirá el código.')
      await cargarFactores()
    } finally {
      setSubmitting(false)
    }
  }

  function cancelarAlta() {
    setAlta(null)
    setCodigo('')
    setError(null)
  }

  async function desactivar(factorId: string) {
    const ok = window.confirm(
      '¿Seguro que quieres desactivar la verificación en dos pasos? A partir de ahora tu cuenta quedará protegida solo con la contraseña.',
    )
    if (!ok) return
    setError(null)
    setNotice(null)
    const { error } = await desactivarMfa(factorId)
    if (error) {
      setError(error)
      return
    }
    setNotice('Verificación en dos pasos desactivada.')
    await cargarFactores()
  }

  const activa = factores.length > 0

  return (
    <div className="dash">
      <div className="dash-head">
        <p className="eyebrow">Seguridad</p>
        <h1>Verificación en dos pasos</h1>
        <p className="dash-head__lead">
          Añade una segunda comprobación a tu propio acceso, con una app de autenticación
          (Google Authenticator, Authy, 1Password…). Es solo para tu cuenta: no afecta a cómo
          entra el resto del personal.
        </p>
      </div>

      {!configured && (
        <div className="banner banner--info" role="status">
          <strong>Modo demostración.</strong> La verificación en dos pasos necesita Supabase
          conectado; en este modo no hay contraseñas reales que proteger.
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

      {configured && !cargando && (
        <section className="settings-card">
          <h2 className="settings-card__title">Estado de tu cuenta</h2>

          {activa && !alta && (
            <>
              <p className="form-hint">
                Verificación en dos pasos <b>activada</b>. Cada vez que inicies sesión, después
                de tu contraseña te pedirá un código de 6 dígitos.
              </p>
              <button
                type="button"
                className="btn btn-outline btn-sm rgpd-borrar"
                onClick={() => desactivar(factores[0].id)}
              >
                Desactivar
              </button>
            </>
          )}

          {!activa && !alta && (
            <>
              <p className="form-hint">
                Todavía no está activada: solo hace falta tu contraseña para entrar.
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={empezarAlta} disabled={submitting}>
                {submitting ? <span className="spinner" aria-hidden="true" /> : 'Activar verificación en dos pasos'}
              </button>
            </>
          )}

          {alta && (
            <form className="app-form" onSubmit={confirmarAlta}>
              <p className="form-hint">
                Escanea este código con tu app de autenticación. Si no puedes escanearlo, escribe
                esta clave a mano:
              </p>
              <img
                src={alta.qrCode}
                alt="Código QR para activar la verificación en dos pasos"
                width={180}
                height={180}
              />
              <p className="form-hint">
                <code>{alta.secret}</code>
              </p>
              <div className="form-row">
                <label htmlFor="codigoAlta">Código de la app (6 dígitos)</label>
                <input
                  id="codigoAlta"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
              <div className="assign-box__row">
                <button type="submit" className="btn btn-primary" disabled={submitting || codigo.length < 6}>
                  {submitting ? <span className="spinner" aria-hidden="true" /> : 'Confirmar'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelarAlta}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  )
}
