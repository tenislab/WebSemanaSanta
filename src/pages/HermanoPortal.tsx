import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LogoMark } from '../components/Logo'
import { HERMANOS_INICIALES, type Hermano } from '../data/hermanos'
import { CUOTAS_INICIALES, type Cuota } from '../data/cuotas'
import { IMPORTE_PAPELETA, PAPELETAS_INICIALES, type Papeleta } from '../data/papeletas'
import { getHermandadSettings } from '../lib/hermandadSettings'
import { getTramos, tramosDeCuerpo, etiquetaTramo, esCirio, type Cuerpo } from '../lib/tramos'
import { repartoCompleto, asignacionPorPapeleta as mapAsignaciones } from '../lib/cortejo'
import { getCampana, renovacionDeHermano, ventanaAbierta } from '../lib/campana'
import { CLAVES_DATOS, usePersistentState } from '../lib/persistencia'
import { formatCurrency, formatDate } from '../lib/format'
import { exportarDatosHermano, recopilarDatosHermano } from '../lib/rgpd'
import { descargarArchivo } from '../lib/csv'

const SESION_KEY = 'cabildo-hermano-portal'
const CONSENT_KEY = 'cabildo-hermano-consent'
const CUERPOS: Cuerpo[] = ['Cristo', 'Virgen', 'Único']

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function claseCuota(estado: Cuota['estado']) {
  if (estado === 'Pagada') return 'pill--ok'
  if (estado === 'Pendiente') return 'pill--warn'
  return 'pill--err'
}

export default function HermanoPortal() {
  const hermandad = useMemo(() => getHermandadSettings(), [])
  const nombreHermandad = hermandad.nombreLegal || 'tu hermandad'
  const tramos = useMemo(() => getTramos(), [])
  const campana = useMemo(() => getCampana(), [])

  const [hermanos, setHermanos] = usePersistentState<Hermano[]>(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
  const [papeletas, setPapeletas] = usePersistentState<Papeleta[]>(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES)
  const [cuotas] = usePersistentState<Cuota[]>(CLAVES_DATOS.cuotas, CUOTAS_INICIALES)

  const [hermanoId, setHermanoId] = useState<string | null>(() => sessionStorage.getItem(SESION_KEY))
  const [numeroInput, setNumeroInput] = useState('')
  const [errorLogin, setErrorLogin] = useState<string | null>(null)
  const [pendingCuerpo, setPendingCuerpo] = useState<Cuerpo | ''>('')
  const [datosGuardados, setDatosGuardados] = useState(false)
  const [consent, setConsent] = useState<boolean>(() => localStorage.getItem(CONSENT_KEY) === 'si')

  const hermano = useMemo(() => hermanos.find((h) => h.id === hermanoId) ?? null, [hermanos, hermanoId])

  function identificar(e: FormEvent) {
    e.preventDefault()
    const num = Number(numeroInput.trim())
    const encontrado = hermanos.find((h) => h.numero === num)
    if (!encontrado) {
      setErrorLogin(`No encontramos ningún hermano con el número ${numeroInput} en ${nombreHermandad}.`)
      return
    }
    sessionStorage.setItem(SESION_KEY, encontrado.id)
    setHermanoId(encontrado.id)
    setErrorLogin(null)
    setNumeroInput('')
  }

  function salir() {
    sessionStorage.removeItem(SESION_KEY)
    setHermanoId(null)
  }

  function aceptarConsentimiento() {
    localStorage.setItem(CONSENT_KEY, 'si')
    setConsent(true)
  }

  // ---- Datos personales editables ----
  function guardarDatos(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!hermano) return
    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const telefono = String(data.get('telefono') ?? '').trim()
    const direccion = String(data.get('direccion') ?? '').trim()
    setHermanos((prev) => prev.map((h) => (h.id === hermano.id ? { ...h, email, telefono, direccion } : h)))
    setDatosGuardados(true)
    setTimeout(() => setDatosGuardados(false), 2500)
  }

  // ---- Papeleta de sitio (renovación / sacar) ----
  const renovacion = useMemo(
    () => (hermano ? renovacionDeHermano(hermano.id, papeletas, campana) : null),
    [hermano, papeletas, campana],
  )
  const asignacion = useMemo(() => {
    const activas = papeletas.filter((p) => p.anio === campana.anio)
    return renovacion?.papeletaActual
      ? mapAsignaciones(repartoCompleto(tramos, activas, (id) => hermanos.find((h) => h.id === id), new Set())).get(
          renovacion.papeletaActual.id,
        )
      : undefined
  }, [papeletas, campana.anio, tramos, hermanos, renovacion])

  const cuerposDisponibles = useMemo(() => CUERPOS.filter((c) => tramos.some((t) => t.cuerpo === c)), [tramos])
  const tramosDelCuerpo = useMemo(
    () => (pendingCuerpo ? tramosDeCuerpo(pendingCuerpo, tramos) : []),
    [pendingCuerpo, tramos],
  )

  function nextNumeroPapeleta() {
    return Math.max(0, ...papeletas.map((p) => p.numero)) + 1
  }

  function renovarSitio() {
    if (!hermano || !renovacion?.sitioAnterior?.tramoId) return
    const nueva: Papeleta = {
      id: `p-${Date.now()}`,
      numero: nextNumeroPapeleta(),
      hermanoId: hermano.id,
      anio: campana.anio,
      tramoId: renovacion.sitioAnterior.tramoId,
      importe: renovacion.sitioAnterior.importe || IMPORTE_PAPELETA,
      estado: 'Asignada',
      fechaSolicitud: hoy(),
    }
    setPapeletas((prev) => [nueva, ...prev])
  }

  function noRenovar() {
    if (!hermano) return
    const renuncia: Papeleta = {
      id: `p-${Date.now()}`,
      numero: nextNumeroPapeleta(),
      hermanoId: hermano.id,
      anio: campana.anio,
      tramoId: null,
      importe: 0,
      estado: 'Renuncia',
      fechaSolicitud: hoy(),
    }
    setPapeletas((prev) => [renuncia, ...prev])
  }

  function sacarEnTramo(tramoId: string) {
    if (!hermano) return
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermano.id && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) => (p.id === actual.id ? { ...p, tramoId, estado: 'Asignada', importe: IMPORTE_PAPELETA } : p))
      }
      const nueva: Papeleta = {
        id: `p-${Date.now()}`,
        numero: nextNumeroPapeleta(),
        hermanoId: hermano.id,
        anio: campana.anio,
        tramoId,
        importe: IMPORTE_PAPELETA,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
    setPendingCuerpo('')
  }

  // ---- RGPD ----
  function descargarMisDatos() {
    if (!hermano) return
    const datos = recopilarDatosHermano(hermano.id)
    if (!datos) return
    const slug = hermano.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    descargarArchivo(`mis-datos-${slug}.json`, exportarDatosHermano(datos), 'application/json;charset=utf-8;')
  }

  function solicitarBaja() {
    if (!hermano) return
    if (!window.confirm('¿Seguro que quieres solicitar la baja como hermano/a? La secretaría tramitará tu solicitud.')) return
    setHermanos((prev) => prev.map((h) => (h.id === hermano.id ? { ...h, estado: 'Baja' } : h)))
  }

  const misCuotas = useMemo(
    () => (hermano ? cuotas.filter((c) => c.hermanoId === hermano.id) : []),
    [cuotas, hermano],
  )

  // ===================== Pantalla de identificación =====================
  if (!hermano) {
    return (
      <div className="portal">
        <PortalHead hermandad={nombreHermandad} logo={hermandad.logoDataUrl} />
        <main className="portal__stage">
          <div className="portal__card">
            <p className="eyebrow">Área del hermano</p>
            <h1>Entra en tu área</h1>
            <p className="portal__lead">
              Introduce tu número de hermano/a de {nombreHermandad} para ver tus cuotas y tu papeleta de sitio.
            </p>
            <form className="app-form" onSubmit={identificar}>
              <div className="form-row">
                <label htmlFor="numeroHermano">Número de hermano/a</label>
                <input
                  id="numeroHermano"
                  type="number"
                  inputMode="numeric"
                  value={numeroInput}
                  onChange={(e) => setNumeroInput(e.target.value)}
                  placeholder="Ej. 214"
                  autoFocus
                  required
                />
              </div>
              {errorLogin && <p className="form-hint form-hint--error">{errorLogin}</p>}
              <button type="submit" className="btn btn-primary btn-block">
                Entrar
              </button>
            </form>
            <p className="portal__note">
              En modo demostración basta con el número. El acceso con contraseña propia de cada hermano llegará con la
              autenticación real. <Link to="/">Volver a la portada</Link>
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ===================== Portal del hermano =====================
  return (
    <div className="portal">
      <PortalHead hermandad={nombreHermandad} logo={hermandad.logoDataUrl} onSalir={salir} />
      <main className="portal__main">
        <div className="dash-head">
          <p className="eyebrow">Área del hermano · {nombreHermandad}</p>
          <h1>Hola, {hermano.nombre.split(' ')[0]}</h1>
          <p className="dash-head__lead">
            Hermano/a nº {hermano.numero} · {hermano.estado} · {hermano.cuotaAlDia ? 'cuota al día' : 'con cuota pendiente'}
          </p>
        </div>

        {!consent && (
          <div className="banner-inline banner-inline--accent portal__consent">
            <span>
              {nombreHermandad} trata tus datos personales para gestionar tu condición de hermano/a (cuotas, papeletas y
              comunicaciones), conforme al RGPD. Puedes descargar o solicitar la supresión de tus datos abajo.
            </span>
            <button className="btn btn-primary btn-sm" onClick={aceptarConsentimiento}>
              Entendido
            </button>
          </div>
        )}

        {/* Mi papeleta de sitio */}
        <section className="portal__section">
          <h2>Mi papeleta de sitio · Campaña {campana.anio}</h2>
          {renovacion && (
            <div className="portal__papeleta">
              <div className="ficha__row">
                <span className={`pill ${renovacion.estado === 'Renovada' || renovacion.estado === 'Nueva' ? 'pill--ok' : renovacion.estado === 'Por renovar' ? 'pill--warn' : renovacion.estado === 'No renovada' ? 'pill--err' : 'pill--off'}`}>
                  {renovacion.estado}
                </span>
                {asignacion?.tramo && <span className="pill pill--info">{etiquetaTramo(asignacion.tramo)}</span>}
              </div>

              {renovacion.estado === 'Por renovar' && renovacion.sitioAnterior?.tramoId && (
                <>
                  <p className="portal__lead">
                    El año pasado saliste en{' '}
                    <b>{etiquetaTramo(tramos.find((t) => t.id === renovacion.sitioAnterior!.tramoId)!)}</b>. La renovación
                    está {ventanaAbierta(campana) ? 'abierta' : 'cerrada'}
                    {ventanaAbierta(campana) ? ` hasta el ${formatDate(new Date(`${campana.fechaLimiteRenovacion}T00:00:00`))}` : ''}.
                  </p>
                  {ventanaAbierta(campana) ? (
                    <div className="assign-box__row">
                      <button className="btn btn-primary" onClick={renovarSitio}>
                        Renovar mi sitio
                      </button>
                      <button className="btn btn-ghost" onClick={noRenovar}>
                        Este año no salgo
                      </button>
                    </div>
                  ) : (
                    <p className="form-hint">El plazo de renovación ha terminado. Contacta con la secretaría.</p>
                  )}
                </>
              )}

              {(renovacion.estado === 'Sin papeleta' || renovacion.estado === 'No renovada') && ventanaAbierta(campana) && (
                <div className="assign-box">
                  <label htmlFor="cuerpoPortal">Sacar mi papeleta</label>
                  <div className="form-grid-2">
                    <select id="cuerpoPortal" value={pendingCuerpo} onChange={(e) => setPendingCuerpo(e.target.value as Cuerpo)}>
                      <option value="">Cristo / Virgen</option>
                      {cuerposDisponibles.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      defaultValue=""
                      disabled={!pendingCuerpo}
                      key={pendingCuerpo}
                      onChange={(e) => e.target.value && sacarEnTramo(e.target.value)}
                    >
                      <option value="" disabled>
                        {pendingCuerpo ? 'Cirio, vara, cruz de guía…' : 'Elige antes un cuerpo'}
                      </option>
                      {(() => {
                        const cirios = tramosDelCuerpo.filter((t) => esCirio(t))
                        const designados = tramosDelCuerpo.filter((t) => !esCirio(t))
                        return (
                          <>
                            {cirios.length > 0 && <option value={cirios[0].id}>Cirio (te coloca la hermandad por número)</option>}
                            {designados.map((t) => (
                              <option key={t.id} value={t.id}>{t.nombre}{t.tipo ? ` (${t.tipo})` : ''}</option>
                            ))}
                          </>
                        )
                      })()}
                    </select>
                  </div>
                  <p className="form-hint">El puesto exacto lo asigna la hermandad; en los cirios, por tu número de hermano.</p>
                </div>
              )}

              {(renovacion.estado === 'Renovada' || renovacion.estado === 'Nueva') && renovacion.papeletaActual && (
                <p className="portal__lead">
                  Tienes tu sitio para este año{asignacion?.tramo ? ` en ${etiquetaTramo(asignacion.tramo)}` : ''}. Estado
                  del pago: <b>{renovacion.papeletaActual.estado}</b>. La secretaría te avisará para recoger la papeleta.
                </p>
              )}

              {renovacion.estado === 'No renovada' && !ventanaAbierta(campana) && (
                <p className="form-hint">No renovaste tu sitio este año y el plazo ha terminado.</p>
              )}
            </div>
          )}
        </section>

        {/* Mis cuotas */}
        <section className="portal__section">
          <h2>Mis cuotas</h2>
          {misCuotas.length === 0 ? (
            <p className="form-hint">No tienes recibos registrados.</p>
          ) : (
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Concepto</th>
                    <th>Importe</th>
                    <th>Estado</th>
                    <th>Cobro</th>
                  </tr>
                </thead>
                <tbody>
                  {misCuotas.map((c) => (
                    <tr key={c.id}>
                      <td className="num">{c.numero}</td>
                      <td>{c.concepto}</td>
                      <td className="num">{formatCurrency(c.importe)}</td>
                      <td><span className={`pill ${claseCuota(c.estado)}`}>{c.estado}</span></td>
                      <td className="num">{c.fechaCobro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="form-hint">El pago online de cuotas y papeletas llegará con la pasarela de pago.</p>
        </section>

        {/* Mis datos */}
        <section className="portal__section">
          <h2>Mis datos de contacto</h2>
          <form className="app-form" onSubmit={guardarDatos}>
            <div className="form-row">
              <label htmlFor="miEmail">Correo electrónico</label>
              <input id="miEmail" name="email" type="email" defaultValue={hermano.email} />
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="miTelefono">Teléfono</label>
                <input id="miTelefono" name="telefono" type="tel" defaultValue={hermano.telefono} />
              </div>
              <div className="form-row">
                <label htmlFor="miDireccion">Dirección</label>
                <input id="miDireccion" name="direccion" type="text" defaultValue={hermano.direccion} />
              </div>
            </div>
            <div className="assign-box__row">
              <button type="submit" className="btn btn-primary">Guardar mis datos</button>
              {datosGuardados && <span className="alert-item alert-item--ok">Datos actualizados.</span>}
            </div>
          </form>
        </section>

        {/* RGPD */}
        <section className="portal__section">
          <h2>Mis datos y privacidad (RGPD)</h2>
          <p className="form-hint">
            Tienes derecho a acceder a tus datos y a solicitar su supresión. La baja la tramita la secretaría de {nombreHermandad}.
          </p>
          <div className="assign-box__row">
            <button className="btn btn-outline" onClick={descargarMisDatos}>Descargar mis datos</button>
            <button className="btn btn-ghost rgpd-borrar" onClick={solicitarBaja}>Solicitar la baja</button>
          </div>
        </section>
      </main>
    </div>
  )
}

function PortalHead({ hermandad, logo, onSalir }: { hermandad: string; logo: string | null; onSalir?: () => void }) {
  return (
    <header className="portal__head">
      <div className="portal__brand">
        <span className="portal__logo">{logo ? <img src={logo} alt="" /> : <LogoMark size={28} />}</span>
        <span>
          <b>{hermandad}</b>
          <small>Área del hermano</small>
        </span>
      </div>
      {onSalir && (
        <button className="btn btn-ghost btn-sm" onClick={onSalir}>
          Salir
        </button>
      )}
    </header>
  )
}
