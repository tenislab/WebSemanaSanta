import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LogoMark } from '../components/Logo'
import PapeletaTicket from '../components/PapeletaTicket'
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
import { estiloTema, inicialesHermandad } from '../lib/color'
import {
  ID_HERMANDAD_PRINCIPAL,
  HERMANDADES_MUESTRA,
  HERMANOS_MUESTRA,
  buscarHermandades,
  type HermandadDirectorio,
  type HermanoDirectorio,
} from '../lib/hermandades'

const SESION_KEY = 'cabildo-hermano-portal'
const CONSENT_KEY = 'cabildo-hermano-consent'
const CUERPOS: Cuerpo[] = ['Cristo', 'Virgen', 'Único']
const DNI_DEMO = 'h4' // Francisco Gómez Nieto, nº 501 · usado por el botón "hermano de prueba"

interface Sesion {
  hermandadId: string
  hermanoId: string
}

function leerSesion(): Sesion | null {
  try {
    const raw = sessionStorage.getItem(SESION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Sesion>
    if (parsed && typeof parsed.hermandadId === 'string' && typeof parsed.hermanoId === 'string') {
      return { hermandadId: parsed.hermandadId, hermanoId: parsed.hermanoId }
    }
  } catch {
    // sesión corrupta o de un formato anterior: se ignora
  }
  return null
}

function guardarSesion(sesion: Sesion) {
  sessionStorage.setItem(SESION_KEY, JSON.stringify(sesion))
}

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function claseCuota(estado: Cuota['estado']) {
  if (estado === 'Pagada') return 'pill--ok'
  if (estado === 'Pendiente') return 'pill--warn'
  return 'pill--err'
}

function normaliza(texto: string) {
  return texto.trim().toUpperCase()
}

export default function HermanoPortal() {
  const hermandadPrincipal = useMemo(() => getHermandadSettings(), [])
  const nombrePrincipal = hermandadPrincipal.nombreLegal || 'Tu hermandad (modo demo)'

  const [hermanos, setHermanos] = usePersistentState<Hermano[]>(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)
  const [papeletas, setPapeletas] = usePersistentState<Papeleta[]>(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES)
  const [cuotas] = usePersistentState<Cuota[]>(CLAVES_DATOS.cuotas, CUOTAS_INICIALES)
  const [hermanosEsperanza, setHermanosEsperanza] = usePersistentState<HermanoDirectorio[]>(
    'cabildo-directorio-esperanza',
    HERMANOS_MUESTRA.esperanza,
  )
  const [hermanosSoledad, setHermanosSoledad] = usePersistentState<HermanoDirectorio[]>(
    'cabildo-directorio-soledad',
    HERMANOS_MUESTRA.soledad,
  )
  const censosMuestra: Record<string, [HermanoDirectorio[], (updater: (prev: HermanoDirectorio[]) => HermanoDirectorio[]) => void]> = {
    esperanza: [hermanosEsperanza, setHermanosEsperanza],
    soledad: [hermanosSoledad, setHermanosSoledad],
  }

  const tramos = useMemo(() => getTramos(), [])
  const campana = useMemo(() => getCampana(), [])

  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion())
  const [paso, setPaso] = useState<'buscar' | 'clave'>('buscar')
  const [queryHermandad, setQueryHermandad] = useState('')
  const [hermandadElegida, setHermandadElegida] = useState<HermandadDirectorio | null>(null)
  const [dniInput, setDniInput] = useState('')
  const [claveInput, setClaveInput] = useState('')
  const [errorLogin, setErrorLogin] = useState<string | null>(null)
  const [pendingCuerpo, setPendingCuerpo] = useState<Cuerpo | ''>('')
  const [datosGuardados, setDatosGuardados] = useState(false)
  const [bajaMuestraSolicitada, setBajaMuestraSolicitada] = useState(false)
  const [consent, setConsent] = useState<boolean>(() => localStorage.getItem(CONSENT_KEY) === 'si')
  const [claveError, setClaveError] = useState<string | null>(null)
  const [claveGuardada, setClaveGuardada] = useState(false)

  const datosPrincipalDirectorio = useMemo(
    () => ({
      nombre: nombrePrincipal,
      ciudad: hermandadPrincipal.ciudad,
      color: hermandadPrincipal.colorPrimario,
      telefono: hermandadPrincipal.telefono,
      email: hermandadPrincipal.email,
    }),
    [nombrePrincipal, hermandadPrincipal],
  )
  const opcionesHermandad = useMemo(
    () => buscarHermandades(queryHermandad, datosPrincipalDirectorio),
    [queryHermandad, datosPrincipalDirectorio],
  )

  const esPrincipal = sesion?.hermandadId === ID_HERMANDAD_PRINCIPAL
  const hermanoPrincipal = useMemo(
    () => (esPrincipal && sesion ? hermanos.find((h) => h.id === sesion.hermanoId) ?? null : null),
    [esPrincipal, sesion, hermanos],
  )
  const hermanoMuestra = useMemo(() => {
    if (esPrincipal || !sesion) return null
    const censo = censosMuestra[sesion.hermandadId]?.[0] ?? []
    return censo.find((h) => h.id === sesion.hermanoId) ?? null
  }, [esPrincipal, sesion, hermanosEsperanza, hermanosSoledad]) // eslint-disable-line react-hooks/exhaustive-deps
  const hermandadMuestra = useMemo(
    () => (sesion ? HERMANDADES_MUESTRA.find((h) => h.id === sesion.hermandadId) ?? null : null),
    [sesion],
  )

  const hermanoActivo = hermanoPrincipal ?? hermanoMuestra
  const nombreHermandadActiva = esPrincipal ? nombrePrincipal : hermandadMuestra?.nombre ?? 'tu hermandad'
  const colorActivo = esPrincipal ? hermandadPrincipal.colorPrimario : hermandadMuestra?.color ?? '#caa24a'
  const contactoActivo = esPrincipal
    ? { telefono: hermandadPrincipal.telefono, email: hermandadPrincipal.email }
    : { telefono: hermandadMuestra?.telefono ?? '', email: hermandadMuestra?.email ?? '' }
  const colorPreview = paso === 'clave' && hermandadElegida ? hermandadElegida.color : undefined

  function elegirHermandad(h: HermandadDirectorio) {
    setHermandadElegida(h)
    setPaso('clave')
    setErrorLogin(null)
    setDniInput('')
    setClaveInput('')
  }

  function volverABuscar() {
    setPaso('buscar')
    setHermandadElegida(null)
    setErrorLogin(null)
  }

  function identificar(e: FormEvent) {
    e.preventDefault()
    if (!hermandadElegida) return
    const dni = normaliza(dniInput)

    if (hermandadElegida.id === ID_HERMANDAD_PRINCIPAL) {
      const encontrado = hermanos.find((h) => normaliza(h.dni) === dni && h.claveAcceso === claveInput)
      if (!encontrado) {
        setErrorLogin('DNI o contraseña incorrectos.')
        return
      }
      const nueva = { hermandadId: ID_HERMANDAD_PRINCIPAL, hermanoId: encontrado.id }
      guardarSesion(nueva)
      setSesion(nueva)
    } else {
      const censo = censosMuestra[hermandadElegida.id]?.[0] ?? []
      const encontrado = censo.find((h) => normaliza(h.dni) === dni && h.claveAcceso === claveInput)
      if (!encontrado) {
        setErrorLogin('DNI o contraseña incorrectos.')
        return
      }
      const nueva = { hermandadId: hermandadElegida.id, hermanoId: encontrado.id }
      guardarSesion(nueva)
      setSesion(nueva)
    }
    setErrorLogin(null)
  }

  function entrarComoDemo() {
    if (!hermanos.some((h) => h.id === DNI_DEMO)) {
      setErrorLogin('El hermano de prueba no está disponible ahora mismo. Elige tu hermandad y entra con un DNI y contraseña del censo.')
      return
    }
    const nueva = { hermandadId: ID_HERMANDAD_PRINCIPAL, hermanoId: DNI_DEMO }
    guardarSesion(nueva)
    setSesion(nueva)
  }

  function salir() {
    sessionStorage.removeItem(SESION_KEY)
    setSesion(null)
    setPaso('buscar')
    setHermandadElegida(null)
    setQueryHermandad('')
    setPendingCuerpo('')
    setDatosGuardados(false)
    setBajaMuestraSolicitada(false)
    setErrorLogin(null)
    setClaveError(null)
    setClaveGuardada(false)
  }

  function aceptarConsentimiento() {
    localStorage.setItem(CONSENT_KEY, 'si')
    setConsent(true)
  }

  // ---- Datos personales editables ----
  function guardarDatos(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!sesion) return
    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const telefono = String(data.get('telefono') ?? '').trim()

    if (esPrincipal && hermanoPrincipal) {
      const direccion = String(data.get('direccion') ?? '').trim()
      setHermanos((prev) => prev.map((h) => (h.id === hermanoPrincipal.id ? { ...h, email, telefono, direccion } : h)))
    } else if (hermanoMuestra) {
      const [, setCenso] = censosMuestra[sesion.hermandadId]
      setCenso((prev) => prev.map((h) => (h.id === hermanoMuestra.id ? { ...h, email, telefono } : h)))
    }
    setDatosGuardados(true)
    setTimeout(() => setDatosGuardados(false), 2500)
  }

  function cambiarClave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!sesion || !hermanoActivo) return
    const data = new FormData(e.currentTarget)
    const actual = String(data.get('claveActual') ?? '')
    const nueva = String(data.get('claveNueva') ?? '')
    const confirmar = String(data.get('claveConfirmar') ?? '')

    if (actual !== hermanoActivo.claveAcceso) {
      setClaveError('La contraseña actual no es correcta.')
      return
    }
    if (nueva.length < 6) {
      setClaveError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (nueva !== confirmar) {
      setClaveError('Las dos contraseñas nuevas no coinciden.')
      return
    }

    if (esPrincipal && hermanoPrincipal) {
      setHermanos((prev) => prev.map((h) => (h.id === hermanoPrincipal.id ? { ...h, claveAcceso: nueva } : h)))
    } else if (hermanoMuestra) {
      const [, setCenso] = censosMuestra[sesion.hermandadId]
      setCenso((prev) => prev.map((h) => (h.id === hermanoMuestra.id ? { ...h, claveAcceso: nueva } : h)))
    }
    setClaveError(null)
    setClaveGuardada(true)
    e.currentTarget.reset()
    setTimeout(() => setClaveGuardada(false), 2500)
  }

  // ---- Papeleta de sitio (renovación / sacar) — solo hermandad principal ----
  const renovacion = useMemo(
    () => (hermanoPrincipal ? renovacionDeHermano(hermanoPrincipal.id, papeletas, campana) : null),
    [hermanoPrincipal, papeletas, campana],
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
    if (!hermanoPrincipal || !renovacion?.sitioAnterior?.tramoId) return
    const nueva: Papeleta = {
      id: `p-${Date.now()}`,
      numero: nextNumeroPapeleta(),
      hermanoId: hermanoPrincipal.id,
      anio: campana.anio,
      tramoId: renovacion.sitioAnterior.tramoId,
      importe: renovacion.sitioAnterior.importe || IMPORTE_PAPELETA,
      estado: 'Asignada',
      fechaSolicitud: hoy(),
    }
    setPapeletas((prev) => [nueva, ...prev])
  }

  function noRenovar() {
    if (!hermanoPrincipal) return
    const renuncia: Papeleta = {
      id: `p-${Date.now()}`,
      numero: nextNumeroPapeleta(),
      hermanoId: hermanoPrincipal.id,
      anio: campana.anio,
      tramoId: null,
      importe: 0,
      estado: 'Renuncia',
      fechaSolicitud: hoy(),
    }
    setPapeletas((prev) => [renuncia, ...prev])
  }

  function sacarEnTramo(tramoId: string) {
    if (!hermanoPrincipal) return
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoPrincipal.id && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) => (p.id === actual.id ? { ...p, tramoId, estado: 'Asignada', importe: IMPORTE_PAPELETA } : p))
      }
      const nueva: Papeleta = {
        id: `p-${Date.now()}`,
        numero: nextNumeroPapeleta(),
        hermanoId: hermanoPrincipal.id,
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
    if (esPrincipal && hermanoPrincipal) {
      const datos = recopilarDatosHermano(hermanoPrincipal.id)
      if (!datos) return
      const slug = hermanoPrincipal.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      descargarArchivo(`mis-datos-${slug}.json`, exportarDatosHermano(datos), 'application/json;charset=utf-8;')
      return
    }
    if (hermanoMuestra) {
      const slug = hermanoMuestra.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      descargarArchivo(
        `mis-datos-${slug}.json`,
        JSON.stringify({ hermandad: nombreHermandadActiva, hermano: hermanoMuestra }, null, 2),
        'application/json;charset=utf-8;',
      )
    }
  }

  function solicitarBaja() {
    if (!window.confirm('¿Seguro que quieres solicitar la baja como hermano/a? La secretaría tramitará tu solicitud.')) return
    if (esPrincipal && hermanoPrincipal) {
      setHermanos((prev) => prev.map((h) => (h.id === hermanoPrincipal.id ? { ...h, estado: 'Baja' } : h)))
    } else {
      setBajaMuestraSolicitada(true)
    }
  }

  const misCuotas = useMemo(
    () => (hermanoPrincipal ? cuotas.filter((c) => c.hermanoId === hermanoPrincipal.id) : []),
    [cuotas, hermanoPrincipal],
  )

  // ===================== Pantalla de identificación =====================
  if (!hermanoActivo) {
    return (
      <div className="portal" style={colorPreview ? estiloTema(colorPreview) : undefined}>
        <PortalHead hermandad={hermandadElegida?.nombre ?? 'Cabildo'} logo={null} color={colorPreview} />
        <main className="portal__stage">
          <div className="portal__card">
            <p className="eyebrow">Área del hermano</p>
            <h1>Entra en tu área</h1>

            {paso === 'buscar' && (
              <>
                <div className="banner banner--info banner--demo portal__demo-banner" role="status">
                  <div>
                    <strong>Modo demostración.</strong> Prueba el área del hermano sin buscar tu hermandad.
                  </div>
                  <button type="button" className="btn btn-outline btn-sm banner--demo__btn" onClick={entrarComoDemo}>
                    Entrar con hermano de prueba
                  </button>
                </div>
                {errorLogin && <p className="form-hint form-hint--error">{errorLogin}</p>}

                <p className="portal__lead">Busca tu hermandad para entrar con tu DNI y contraseña.</p>
                <div className="form-row">
                  <label htmlFor="buscarHermandad">Tu hermandad</label>
                  <input
                    id="buscarHermandad"
                    type="text"
                    placeholder="Escribe el nombre o la ciudad…"
                    value={queryHermandad}
                    onChange={(e) => setQueryHermandad(e.target.value)}
                    autoFocus
                  />
                </div>
                <ul className="portal__picker">
                  {opcionesHermandad.map((h) => (
                    <li key={h.id}>
                      <button type="button" className="portal__picker-item" onClick={() => elegirHermandad(h)}>
                        <span className="portal__picker-dot" style={{ background: h.color }} aria-hidden="true" />
                        <span>
                          <b>{h.nombre}</b>
                          {h.ciudad && <small>{h.ciudad}</small>}
                        </span>
                      </button>
                    </li>
                  ))}
                  {opcionesHermandad.length === 0 && (
                    <li className="portal__picker-empty">No encontramos ninguna hermandad con ese nombre.</li>
                  )}
                </ul>
              </>
            )}

            {paso === 'clave' && hermandadElegida && (
              <>
                <button type="button" className="portal__back" onClick={volverABuscar}>
                  ← Cambiar de hermandad
                </button>
                <div className="portal__chosen" style={{ borderColor: hermandadElegida.color }}>
                  <span className="portal__picker-dot" style={{ background: hermandadElegida.color }} aria-hidden="true" />
                  <span>
                    <b>{hermandadElegida.nombre}</b>
                    {hermandadElegida.ciudad && <small>{hermandadElegida.ciudad}</small>}
                  </span>
                </div>
                <form className="app-form" onSubmit={identificar}>
                  <div className="form-row">
                    <label htmlFor="dniHermano">DNI / NIE</label>
                    <input
                      id="dniHermano"
                      type="text"
                      value={dniInput}
                      onChange={(e) => setDniInput(e.target.value)}
                      placeholder="12345678A"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="claveHermano">Contraseña</label>
                    <input
                      id="claveHermano"
                      type="password"
                      value={claveInput}
                      onChange={(e) => setClaveInput(e.target.value)}
                      placeholder="••••••••••"
                      required
                    />
                  </div>
                  {errorLogin && <p className="form-hint form-hint--error">{errorLogin}</p>}
                  <button type="submit" className="btn btn-primary btn-block">
                    Entrar
                  </button>
                </form>
              </>
            )}

            <p className="portal__note">
              En modo demostración, la contraseña de cualquier hermano es <code>hermano123</code>. <Link to="/">Volver a la portada</Link>
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ===================== Portal del hermano =====================
  const numeroActivo = hermanoActivo.numero
  const primerNombre = hermanoActivo.nombre.split(' ')[0]

  return (
    <div className="portal" style={estiloTema(colorActivo)}>
      <PortalHead
        hermandad={nombreHermandadActiva}
        logo={esPrincipal ? hermandadPrincipal.logoDataUrl : null}
        color={colorActivo}
        onSalir={salir}
      />
      <main className="portal__main">
        <div className="dash-head">
          <p className="eyebrow">Área del hermano · {nombreHermandadActiva}</p>
          <h1>Hola, {primerNombre}</h1>
          <div className="portal__resumen">
            <span className="pill pill--info">Nº {numeroActivo}</span>
            {hermanoPrincipal && (
              <>
                <span className={`pill ${hermanoPrincipal.estado === 'Activo' ? 'pill--ok' : hermanoPrincipal.estado === 'Nuevo' ? 'pill--info' : 'pill--off'}`}>
                  {hermanoPrincipal.estado}
                </span>
                <span className={`pill ${hermanoPrincipal.cuotaAlDia ? 'pill--ok' : 'pill--warn'}`}>
                  {hermanoPrincipal.cuotaAlDia ? 'Cuota al día' : 'Cuota pendiente'}
                </span>
                <span className="pill pill--off">Hermano/a desde {hermanoPrincipal.antiguedad}</span>
              </>
            )}
          </div>
        </div>

        {!consent && (
          <div className="banner-inline banner-inline--accent portal__consent">
            <span>
              {nombreHermandadActiva} trata tus datos personales para gestionar tu condición de hermano/a (cuotas, papeletas y
              comunicaciones), conforme al RGPD. Puedes descargar o solicitar la supresión de tus datos abajo.
            </span>
            <button className="btn btn-primary btn-sm" onClick={aceptarConsentimiento}>
              Entendido
            </button>
          </div>
        )}

        {!esPrincipal && (
          <div className="banner-inline">
            <span>
              {nombreHermandadActiva} es una hermandad de muestra: aún no ha activado papeletas de sitio ni cobro de cuotas
              online en Cabildo. Cada hermandad ve solo su propio censo y sus propios datos.
            </span>
          </div>
        )}

        {/* Mi papeleta de sitio — solo si la hermandad tiene el módulo activo */}
        {esPrincipal && (
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

                {(renovacion.estado === 'Renovada' || renovacion.estado === 'Nueva') && renovacion.papeletaActual && hermanoPrincipal && (
                  <>
                    <p className="portal__lead">
                      Tienes tu sitio para este año{asignacion?.tramo ? ` en ${etiquetaTramo(asignacion.tramo)}` : ''}. La
                      secretaría te avisará para recoger la papeleta física.
                    </p>
                    <PapeletaTicket
                      papeleta={renovacion.papeletaActual}
                      hermano={hermanoPrincipal}
                      hermandad={hermandadPrincipal}
                      tramo={asignacion?.tramo}
                      puesto={asignacion?.puesto ?? null}
                      excedeAforo={asignacion?.estado === 'Excede aforo'}
                    />
                    <div className="assign-box__row" style={{ marginTop: '1rem' }}>
                      <button type="button" className="btn btn-outline" onClick={() => window.print()}>
                        Imprimir / descargar mi papeleta
                      </button>
                    </div>
                  </>
                )}

                {renovacion.estado === 'No renovada' && !ventanaAbierta(campana) && (
                  <p className="form-hint">No renovaste tu sitio este año y el plazo ha terminado.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Mis cuotas — solo si la hermandad tiene el módulo activo */}
        {esPrincipal && (
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
        )}

        {/* Mis datos */}
        <section className="portal__section">
          <h2>Mis datos de contacto</h2>
          <form className="app-form" onSubmit={guardarDatos}>
            <div className="form-row">
              <label htmlFor="miEmail">Correo electrónico</label>
              <input id="miEmail" name="email" type="email" defaultValue={hermanoActivo.email} />
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="miTelefono">Teléfono</label>
                <input id="miTelefono" name="telefono" type="tel" defaultValue={hermanoActivo.telefono} />
              </div>
              {hermanoPrincipal && (
                <div className="form-row">
                  <label htmlFor="miDireccion">Dirección</label>
                  <input id="miDireccion" name="direccion" type="text" defaultValue={hermanoPrincipal.direccion} />
                </div>
              )}
            </div>
            <div className="assign-box__row">
              <button type="submit" className="btn btn-primary">Guardar mis datos</button>
              {datosGuardados && <span className="alert-item alert-item--ok">Datos actualizados.</span>}
            </div>
          </form>
        </section>

        {/* Cambiar contraseña */}
        <section className="portal__section">
          <h2>Cambiar mi contraseña</h2>
          <form className="app-form" onSubmit={cambiarClave}>
            <div className="form-row">
              <label htmlFor="claveActual">Contraseña actual</label>
              <input id="claveActual" name="claveActual" type="password" autoComplete="current-password" required />
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="claveNueva">Nueva contraseña</label>
                <input id="claveNueva" name="claveNueva" type="password" autoComplete="new-password" required minLength={6} />
              </div>
              <div className="form-row">
                <label htmlFor="claveConfirmar">Repite la nueva contraseña</label>
                <input id="claveConfirmar" name="claveConfirmar" type="password" autoComplete="new-password" required minLength={6} />
              </div>
            </div>
            {claveError && <p className="form-hint form-hint--error">{claveError}</p>}
            <div className="assign-box__row">
              <button type="submit" className="btn btn-primary">Cambiar contraseña</button>
              {claveGuardada && <span className="alert-item alert-item--ok">Contraseña actualizada.</span>}
            </div>
          </form>
        </section>

        {/* RGPD */}
        <section className="portal__section">
          <h2>Mis datos y privacidad (RGPD)</h2>
          <p className="form-hint">
            Tienes derecho a acceder a tus datos y a solicitar su supresión. La baja la tramita la secretaría de {nombreHermandadActiva}.
          </p>
          <div className="assign-box__row">
            <button className="btn btn-outline" onClick={descargarMisDatos}>Descargar mis datos</button>
            <button className="btn btn-ghost rgpd-borrar" onClick={solicitarBaja} disabled={bajaMuestraSolicitada}>
              {bajaMuestraSolicitada ? 'Baja solicitada' : 'Solicitar la baja'}
            </button>
          </div>
        </section>

        {(contactoActivo.telefono || contactoActivo.email) && (
          <p className="portal__contact">
            ¿Dudas? Contacta con la secretaría de {nombreHermandadActiva}
            {contactoActivo.telefono && <> · {contactoActivo.telefono}</>}
            {contactoActivo.email && (
              <>
                {' · '}
                <a href={`mailto:${contactoActivo.email}`}>{contactoActivo.email}</a>
              </>
            )}
          </p>
        )}
      </main>
    </div>
  )
}

function PortalHead({
  hermandad,
  logo,
  color,
  onSalir,
}: {
  hermandad: string
  logo: string | null
  color?: string
  onSalir?: () => void
}) {
  return (
    <header className="portal__head">
      <div className="portal__brand">
        <span className="portal__logo">
          {logo ? (
            <img src={logo} alt="" />
          ) : color ? (
            <span className="portal__logo-badge" style={{ background: color }} aria-hidden="true">
              {inicialesHermandad(hermandad)}
            </span>
          ) : (
            <LogoMark size={28} />
          )}
        </span>
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
