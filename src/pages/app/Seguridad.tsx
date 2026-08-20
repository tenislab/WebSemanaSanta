import { useEffect, useState, type FormEvent } from 'react'
import { useAuth, type FactorMfa } from '../../context/AuthContext'
import { NOMBRE_ACCION, cuandoEnCristiano, leerRegistro, type Apunte } from '../../lib/registroActividad'

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
        <>
          <div className="banner banner--info" role="status">
            <strong>Modo demostración.</strong> La verificación en dos pasos necesita la base de
            datos conectada; en este modo no hay contraseñas reales que proteger.
          </div>
          {/* En demo no hay nada que activar: se enseña qué hará esta página cuando conectemos. */}
          <section className="settings-card">
            <h2 className="settings-card__title">Así funcionará</h2>
            <ol className="seguridad-pasos">
              <li>Activas la verificación y la app te enseña un código QR.</li>
              <li>Lo escaneas con tu app de autenticación (Google Authenticator, Authy, 1Password…).</li>
              <li>Desde entonces, al iniciar sesión se pide tu contraseña y un código de 6 dígitos que cambia cada 30 segundos.</li>
            </ol>
            <p className="form-hint">
              Protege tu cuenta aunque alguien averigüe tu contraseña. Se activará aquí mismo en
              cuanto la hermandad esté conectada a la base de datos.
            </p>
            <button type="button" className="btn btn-primary btn-sm" disabled title="Disponible al conectar la base de datos">
              Activar verificación en dos pasos
            </button>
          </section>
        </>
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

      <RegistroDeActividad />
    </div>
  )
}

/**
 * Quién hizo qué en esta hermandad.
 *
 * Vive en Seguridad y no en un sitio propio a propósito: no es una pantalla
 * que se abra a diario, es donde se mira cuando hace falta comprobar algo.
 * Ponerlo en el menú principal le daría una importancia que no tiene el 99%
 * de los días y quitaría sitio a lo que sí se usa.
 */
function RegistroDeActividad() {
  const [apuntes, setApuntes] = useState<Apunte[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    leerRegistro(100).then((r) => {
      if (!cancelado) {
        setApuntes(r)
        setCargando(false)
      }
    })
    return () => {
      cancelado = true
    }
  }, [])

  return (
    <section className="cfg-bloque">
      <h2>Quién hizo qué</h2>
      <p className="form-hint">
        Las bajas, los cambios de cuenta bancaria, las papeletas anuladas y los recibos devueltos,
        con quién los hizo y cuándo. <b>No se puede borrar ni cambiar</b>, tampoco desde aquí: un
        registro que se puede reescribir no sirve para comprobar nada.
      </p>

      {cargando && <p className="form-hint">Cargando…</p>}

      {!cargando && apuntes.length === 0 && (
        <p className="form-hint">
          Todavía no hay nada apuntado. Aparecerá aquí en cuanto se den de baja hermanos, se
          cambien cuentas bancarias o se anulen papeletas.
        </p>
      )}

      {apuntes.length > 0 && (
        <ul className="registro-lista">
          {apuntes.map((a) => (
            <li key={a.id} className="registro-lista__item">
              <div>
                <b>{a.autorNombre}</b> · {a.detalle}
              </div>
              <small>
                {NOMBRE_ACCION[a.accion] ?? a.accion} · {cuandoEnCristiano(a.cuando)}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
