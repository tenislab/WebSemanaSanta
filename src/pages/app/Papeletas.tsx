import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import PapeletaTicket from '../../components/PapeletaTicket'
import { HERMANOS_INICIALES, initials } from '../../data/hermanos'
import { PAPELETAS_INICIALES, type Papeleta } from '../../data/papeletas'
import { useAuth } from '../../context/AuthContext'
import { getHermandadSettings } from '../../lib/hermandadSettings'
import { formatDate } from '../../lib/format'
import {
  getTramos,
  tramosDeCuerpo,
  etiquetaTramo,
  esAutomatico,
  gruposAutomaticos,
  cuerposPresentes,
  getPrecioBase,
  precioDeTramo,
} from '../../lib/tramos'
import { getOpcionesPapeleta, type OpcionPapeleta } from '../../lib/opcionesPapeleta'
import { repartoCompleto, asignacionPorPapeleta as mapAsignaciones } from '../../lib/cortejo'
import {
  getCampana,
  saveCampana,
  ventanaAbierta,
  diasHasta,
  renovacionDeHermano,
  type Campana,
  type EstadoRenovacion,
} from '../../lib/campana'
import { CLAVES_DATOS, leerPersistido, usePersistentState } from '../../lib/persistencia'

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtIso(iso: string | null) {
  if (!iso) return '—'
  return formatDate(new Date(`${iso}T00:00:00`))
}

function claseEstado(estado: EstadoRenovacion) {
  if (estado === 'Renovada' || estado === 'Nueva') return 'pill--ok'
  if (estado === 'Por renovar') return 'pill--warn'
  if (estado === 'No renovada') return 'pill--err'
  return 'pill--off'
}

const FILTROS = ['Todos', 'Por renovar', 'Renovadas', 'Nuevas', 'No renovadas', 'Sin papeleta'] as const

/** Valor centinela del selector para «papeleta personalizada» (no puede chocar con un nombre de cuerpo). */
const PERSONALIZADA = '__personalizada'

export default function Papeletas() {
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const hermandad = useMemo(() => getHermandadSettings(fallbackNombre), [fallbackNombre])
  const tramos = useMemo(() => getTramos(), [])
  const hermanos = useMemo(() => leerPersistido(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])
  const opcionesPersonalizadas = useMemo(() => getOpcionesPapeleta(), [])
  const precioBase = useMemo(() => getPrecioBase(), [])

  const [papeletas, setPapeletas] = usePersistentState<Papeleta[]>(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES)
  const [campana, setCampanaState] = useState<Campana>(() => getCampana())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTROS)[number]>('Todos')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingCuerpo, setPendingCuerpo] = useState<string>('')
  const [ajustesOpen, setAjustesOpen] = useState(false)

  function guardarCampana(next: Campana) {
    setCampanaState(next)
    saveCampana(next)
  }

  const hermanoDe = useMemo(() => {
    const map = new Map(hermanos.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [hermanos])

  const tramoDe = (tramoId: string | null) => (tramoId ? (tramos.find((t) => t.id === tramoId) ?? null) : null)

  const cuerposDisponibles = useMemo(() => cuerposPresentes(tramos), [tramos])
  const tramosDelCuerpoElegido = useMemo(
    () => (pendingCuerpo && pendingCuerpo !== PERSONALIZADA ? tramosDeCuerpo(pendingCuerpo, tramos) : []),
    [pendingCuerpo, tramos],
  )

  const papeletasActivas = useMemo(() => papeletas.filter((p) => p.anio === campana.anio), [papeletas, campana.anio])

  // El tramo y el puesto de cada papeleta se calculan a partir del reparto del
  // cortejo (cirios en cascada por número; designados por menor número), no
  // del tramo que se pidió: por eso puede colocarse en otro tramo del cuerpo.
  const asignacionPorPapeleta = useMemo(
    () => mapAsignaciones(repartoCompleto(tramos, papeletasActivas, hermanoDe, new Set())),
    [papeletasActivas, hermanoDe, tramos],
  )

  // Ocupación de cada tramo (colocación real) y de cada cuerpo, para el selector.
  const ocupadosPorTramo = useMemo(() => {
    const map = new Map<string, number>()
    asignacionPorPapeleta.forEach((a) => {
      if (a.estado === 'Excede aforo' || !a.tramo) return
      map.set(a.tramo.id, (map.get(a.tramo.id) ?? 0) + 1)
    })
    return map
  }, [asignacionPorPapeleta])

  // Ficha del censo: cada hermano con su estado de renovación en la campaña.
  const filas = useMemo(() => {
    return hermanos
      .map((h) => ({ hermano: h, renovacion: renovacionDeHermano(h.id, papeletas, campana) }))
      .filter((f) => {
        if (filter === 'Todos') return true
        if (filter === 'Renovadas') return f.renovacion.estado === 'Renovada'
        if (filter === 'Nuevas') return f.renovacion.estado === 'Nueva'
        if (filter === 'Por renovar') return f.renovacion.estado === 'Por renovar'
        if (filter === 'No renovadas') return f.renovacion.estado === 'No renovada'
        if (filter === 'Sin papeleta') return f.renovacion.estado === 'Sin papeleta'
        return true
      })
      .filter((f) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return f.hermano.nombre.toLowerCase().includes(q) || String(f.hermano.numero).includes(q)
      })
      .sort((a, b) => a.hermano.numero - b.hermano.numero)
  }, [hermanos, papeletas, campana, filter, query])

  const stats = useMemo(() => {
    const cuenta = { conSitio: 0, porRenovar: 0, noRenovadas: 0, nuevas: 0 }
    hermanos.forEach((h) => {
      const e = renovacionDeHermano(h.id, papeletas, campana).estado
      if (e === 'Renovada' || e === 'Nueva') cuenta.conSitio += 1
      if (e === 'Por renovar') cuenta.porRenovar += 1
      if (e === 'No renovada') cuenta.noRenovadas += 1
      if (e === 'Nueva') cuenta.nuevas += 1
    })
    return cuenta
  }, [hermanos, papeletas, campana])

  const abierta = ventanaAbierta(campana)
  const diasRestantes = diasHasta(campana.fechaLimiteRenovacion)

  function nextNumero() {
    return Math.max(0, ...papeletas.map((p) => p.numero)) + 1
  }

  function abrirDetalle(id: string) {
    setSelectedId(id)
    setPendingCuerpo('')
  }

  /** Renueva el sitio del año anterior: crea la papeleta de la campaña con el mismo tramo. */
  function renovar(hermanoId: string, tramoId: string, importe: number) {
    const nueva: Papeleta = {
      id: `p-${Date.now()}`,
      numero: nextNumero(),
      hermanoId,
      anio: campana.anio,
      tramoId,
      importe,
      estado: 'Asignada',
      fechaSolicitud: hoy(),
    }
    setPapeletas((prev) => [nueva, ...prev])
  }

  /** El hermano renuncia a salir este año: pierde su sitio, que queda libre. */
  function noRenovar(hermanoId: string) {
    const renuncia: Papeleta = {
      id: `p-${Date.now()}`,
      numero: nextNumero(),
      hermanoId,
      anio: campana.anio,
      tramoId: null,
      importe: 0,
      estado: 'Renuncia',
      fechaSolicitud: hoy(),
    }
    setPapeletas((prev) => [renuncia, ...prev])
  }

  /**
   * Saca (o rectifica) la papeleta de un hermano en un tramo concreto. Si ya
   * tenía una papeleta este año (una renuncia o una solicitud sin tramo), la
   * reutiliza; si no, crea una nueva.
   */
  function sacarEnTramo(hermanoId: string, tramoId: string) {
    const importe = precioDeTramo(tramos.find((t) => t.id === tramoId), precioBase)
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id
            ? { ...p, tramoId, opcion: null, estado: 'Asignada', importe, pagoComunicado: null }
            : p,
        )
      }
      const nueva: Papeleta = {
        id: `p-${Date.now()}`,
        numero: nextNumero(),
        hermanoId,
        anio: campana.anio,
        tramoId,
        importe,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
    setPendingCuerpo('')
  }

  /** Emite una papeleta personalizada de la hermandad (mantilla, simbólica…), sin tramo en el cortejo. */
  function sacarConOpcion(hermanoId: string, opcion: OpcionPapeleta) {
    setPapeletas((prev) => {
      const actual = prev.find((p) => p.hermanoId === hermanoId && p.anio === campana.anio && p.estado !== 'Anulada')
      if (actual) {
        return prev.map((p) =>
          p.id === actual.id
            ? { ...p, tramoId: null, opcion: opcion.nombre, estado: 'Asignada', importe: opcion.importe, pagoComunicado: null }
            : p,
        )
      }
      const nueva: Papeleta = {
        id: `p-${Date.now()}`,
        numero: nextNumero(),
        hermanoId,
        anio: campana.anio,
        tramoId: null,
        opcion: opcion.nombre,
        importe: opcion.importe,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
    setPendingCuerpo('')
  }

  function actualizarPapeleta(id: string, cambios: Partial<Papeleta>) {
    setPapeletas((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)))
  }

  /** Cierra la campaña actual y abre la del año siguiente (los sitios de este año pasan a renovables). */
  function abrirNuevoAno() {
    const anio = campana.anio + 1
    guardarCampana({
      anio,
      fechaLimiteRenovacion: `${anio}-02-28`,
      fechaSalida: null,
    })
    setFilter('Todos')
    setSelectedId(null)
  }

  const seleccion = selectedId ? { hermano: hermanoDe(selectedId), renovacion: renovacionDeHermano(selectedId, papeletas, campana) } : null

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Papeletas de sitio</p>
          <h1>Renovación de papeletas</h1>
          <p className="dash-head__lead">
            Campaña {campana.anio} · el censo entero, con quién ha renovado su sitio y quién no.{' '}
            <Link to="/app/configuracion" className="dash-head__link">
              Personalizar datos de la hermandad
            </Link>
          </p>
        </div>
        <div className="dash-head__actions">
          <button className="btn btn-outline" onClick={() => setAjustesOpen(true)}>
            Ajustes de campaña
          </button>
        </div>
      </div>

      <div className={`banner-inline ${abierta ? 'banner-inline--accent' : 'banner-inline--warn'}`}>
        {abierta ? (
          <>
            Renovación <b>abierta</b> hasta el {fmtIso(campana.fechaLimiteRenovacion)}
            {diasRestantes >= 0 && ` · quedan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`}. Quien no renueve
            antes pierde su sitio del año anterior.
          </>
        ) : (
          <>
            Renovación <b>cerrada</b> el {fmtIso(campana.fechaLimiteRenovacion)}. Los hermanos que no renovaron han
            perdido su sitio y quedan como «No renovada».
          </>
        )}
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Con sitio este año</span>
          <span className="stat-tile__value">{stats.conSitio}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">Renovadas y nuevas</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Por renovar</span>
          <span className="stat-tile__value">{stats.porRenovar}</span>
          <span className={`stat-tile__trend stat-tile__trend--${stats.porRenovar > 0 ? 'warn' : 'ok'}`}>
            {abierta ? 'Antes de la fecha límite' : 'Ventana cerrada'}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">No renovadas</span>
          <span className="stat-tile__value">{stats.noRenovadas}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Sitios liberados</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Nuevas</span>
          <span className="stat-tile__value">{stats.nuevas}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Primera vez</span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por hermano o nº de hermano"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {FILTROS.map((f) => (
            <button
              key={f}
              className={`chip${filter === f ? ' chip--active' : ''}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Hermano</th>
              <th>Sitio {campana.anio - 1}</th>
              <th>Estado {campana.anio}</th>
              <th>Sitio {campana.anio}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ hermano: h, renovacion: r }) => {
              const tramoAnterior = tramoDe(r.sitioAnterior?.tramoId ?? null)
              const asigActual = r.papeletaActual ? asignacionPorPapeleta.get(r.papeletaActual.id) : undefined
              const tramoActual = asigActual?.tramo ?? null
              return (
                <tr key={h.id} onClick={() => abrirDetalle(h.id)} style={{ cursor: 'pointer' }}>
                  <td className="num">{h.numero}</td>
                  <td>
                    <div className="row-person">
                      <span className="row-avatar">{initials(h.nombre)}</span>
                      <span>
                        <span className="row-person__name">{h.nombre}</span>
                        <span className="row-person__sub">{h.estado}</span>
                      </span>
                    </div>
                  </td>
                  <td>{tramoAnterior ? etiquetaTramo(tramoAnterior) : <span className="table-muted">—</span>}</td>
                  <td>
                    <span className={`pill ${claseEstado(r.estado)}`}>{r.estado}</span>
                  </td>
                  <td>
                    {tramoActual ? (
                      <>
                        {etiquetaTramo(tramoActual)}
                        {asigActual?.estado === 'Excede aforo' && (
                          <span className="table-subtle"> · excede aforo</span>
                        )}
                      </>
                    ) : r.papeletaActual?.opcion && r.papeletaActual.estado !== 'Renuncia' ? (
                      <>
                        {r.papeletaActual.opcion}
                        <span className="table-subtle"> · personalizada</span>
                      </>
                    ) : (
                      <span className="table-muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      title="Ver ficha"
                      onClick={(e) => {
                        e.stopPropagation()
                        abrirDetalle(h.id)
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                    </button>
                  </td>
                </tr>
              )
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  No hay hermanos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ficha del hermano en la campaña */}
      <Drawer
        open={!!seleccion?.hermano}
        onClose={() => setSelectedId(null)}
        title={seleccion?.hermano?.nombre ?? ''}
        subtitle={seleccion?.hermano ? `Hermano nº ${seleccion.hermano.numero}` : undefined}
      >
        {seleccion?.hermano &&
          (() => {
            const h = seleccion.hermano
            const r = seleccion.renovacion
            const tramoAnterior = tramoDe(r.sitioAnterior?.tramoId ?? null)
            const actual = r.papeletaActual
            const asig = actual ? asignacionPorPapeleta.get(actual.id) : undefined
            const tramoActual = asig?.tramo ?? null
            const puedeSacar = r.estado === 'Sin papeleta' || r.estado === 'No renovada'
            return (
              <div className="ficha">
                <div className="ficha__row">
                  <span className={`pill ${claseEstado(r.estado)}`}>{r.estado}</span>
                  {tramoAnterior && (
                    <span className="pill pill--info">Sitio {campana.anio - 1}: {etiquetaTramo(tramoAnterior)}</span>
                  )}
                </div>

                {/* Por renovar: renovar o renunciar */}
                {r.estado === 'Por renovar' && r.sitioAnterior && tramoAnterior && (
                  <div className="assign-box">
                    <label>Renovación del sitio del año anterior</label>
                    <p className="form-hint">
                      {h.nombre} salió en <b>{etiquetaTramo(tramoAnterior)}</b> el año pasado. Puede mantener ese sitio o
                      renunciar a él.
                    </p>
                    <div className="assign-box__row">
                      <button
                        className="btn btn-primary"
                        onClick={() => renovar(h.id, r.sitioAnterior!.tramoId!, r.sitioAnterior!.importe || precioDeTramo(tramoAnterior, precioBase))}
                      >
                        Renovar {etiquetaTramo(tramoAnterior)}
                      </button>
                      <button className="btn btn-ghost" onClick={() => noRenovar(h.id)}>
                        No renovar
                      </button>
                    </div>
                  </div>
                )}

                {/* Sin papeleta o No renovada: sacar papeleta eligiendo tramo */}
                {puedeSacar && (
                  <div className="assign-box">
                    <label htmlFor="cuerpoSacar">
                      {r.estado === 'No renovada' ? 'Volver a sacar papeleta' : 'Sacar papeleta'}
                    </label>
                    <div className="form-grid-2">
                      <select
                        id="cuerpoSacar"
                        value={pendingCuerpo}
                        onChange={(e) => setPendingCuerpo(e.target.value)}
                      >
                        <option value="">Elige un cuerpo</option>
                        {cuerposDisponibles.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        {opcionesPersonalizadas.length > 0 && (
                          <option value={PERSONALIZADA}>Papeleta personalizada</option>
                        )}
                      </select>
                      <select
                        id="tramoSacar"
                        defaultValue=""
                        disabled={!pendingCuerpo}
                        key={pendingCuerpo}
                        onChange={(e) => {
                          if (!e.target.value) return
                          if (pendingCuerpo === PERSONALIZADA) {
                            const op = opcionesPersonalizadas.find((o) => o.id === e.target.value)
                            if (op) sacarConOpcion(h.id, op)
                          } else {
                            sacarEnTramo(h.id, e.target.value)
                          }
                        }}
                      >
                        <option value="" disabled>
                          {pendingCuerpo === PERSONALIZADA
                            ? 'Mantilla, simbólica…'
                            : pendingCuerpo
                              ? 'Elige el puesto…'
                              : 'Elige antes un cuerpo'}
                        </option>
                        {pendingCuerpo === PERSONALIZADA
                          ? opcionesPersonalizadas.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.nombre} — {o.importe} €
                              </option>
                            ))
                          : (() => {
                              const grupos = gruposAutomaticos(tramosDelCuerpoElegido)
                              const designados = tramosDelCuerpoElegido.filter((t) => !esAutomatico(t))
                              return (
                                <>
                                  {grupos.map((g) => {
                                    const ocupados = g.tramos.reduce((s, t) => s + (ocupadosPorTramo.get(t.id) ?? 0), 0)
                                    const aforo = g.tramos.reduce((s, t) => s + t.capacidad, 0)
                                    return (
                                      <option key={g.tramos[0].id} value={g.tramos[0].id}>
                                        {g.etiqueta} (por número) — {ocupados}/{aforo}
                                        {ocupados >= aforo ? ' · completo' : ''}
                                      </option>
                                    )
                                  })}
                                  {designados.map((t) => {
                                    const ocupados = ocupadosPorTramo.get(t.id) ?? 0
                                    return (
                                      <option key={t.id} value={t.id}>
                                        {t.nombre}
                                        {t.tipo ? ` (${t.tipo})` : ''} — {ocupados}/{t.capacidad} · {precioDeTramo(t, precioBase)} €
                                        {ocupados >= t.capacidad ? ' · completo' : ''}
                                      </option>
                                    )
                                  })}
                                </>
                              )
                            })()}
                      </select>
                    </div>
                    <p className="form-hint">
                      Los tramos «por número» se colocan solos por número de hermano; los «por solicitud» (vara, cruz
                      de guía…) se dan al solicitante de menor número. Las papeletas personalizadas (mantilla,
                      simbólica…) no ocupan sitio en el cortejo.{' '}
                      <Link to="/app/configuracion">Configura cuerpos, tramos, precios y papeletas</Link>.
                    </p>
                  </div>
                )}

                {/* Tiene papeleta este año: mostrar el ticket y sus acciones */}
                {actual && actual.estado !== 'Renuncia' && (
                  <>
                    <PapeletaTicket
                      papeleta={actual}
                      hermano={h}
                      hermandad={hermandad}
                      tramo={tramoActual}
                      puesto={asig?.puesto ?? null}
                      excedeAforo={asig?.estado === 'Excede aforo'}
                      opcion={actual.opcion}
                    />
                    {actual.estado === 'Asignada' && actual.pagoComunicado && (
                      <div className="banner-inline banner-inline--accent" style={{ marginTop: '1rem' }}>
                        {h.nombre.split(' ')[0]} avisó desde su área de que pagó por{' '}
                        <b>{actual.pagoComunicado.metodo}</b> el {actual.pagoComunicado.fecha}. Comprueba el ingreso en
                        la cuenta de la hermandad y confírmalo abajo.
                      </div>
                    )}
                    <div className="assign-box__row" style={{ marginTop: '1rem' }}>
                      {actual.estado === 'Asignada' && (
                        <button className="btn btn-primary" onClick={() => actualizarPapeleta(actual.id, { estado: 'Pagada' })}>
                          {actual.pagoComunicado ? 'Confirmar pago recibido' : 'Marcar como pagada'}
                        </button>
                      )}
                      {actual.estado === 'Pagada' && (
                        <button
                          className="btn btn-primary"
                          onClick={() => actualizarPapeleta(actual.id, { estado: 'Entregada', fechaEntrega: hoy() })}
                        >
                          Marcar como entregada
                        </button>
                      )}
                      <button className="btn btn-outline" onClick={() => window.print()}>
                        Imprimir / Descargar
                      </button>
                    </div>
                    {(actual.estado === 'Solicitada' || actual.estado === 'Asignada') && (
                      <button type="button" className="ticket-cancel" onClick={() => actualizarPapeleta(actual.id, { estado: 'Anulada' })}>
                        Anular papeleta
                      </button>
                    )}
                  </>
                )}

                {r.estado === 'No renovada' && actual?.estado === 'Renuncia' && (
                  <p className="form-hint">
                    {h.nombre} renunció a su sitio este año. Si cambia de idea, puede volver a sacar papeleta arriba.
                  </p>
                )}
              </div>
            )
          })()}
      </Drawer>

      {/* Ajustes de la campaña */}
      <Drawer
        open={ajustesOpen}
        onClose={() => setAjustesOpen(false)}
        title="Ajustes de campaña"
        subtitle={`Edición ${campana.anio}`}
      >
        <div className="app-form">
          <div className="form-row">
            <label htmlFor="fechaLimite">Fecha límite de renovación</label>
            <input
              id="fechaLimite"
              type="date"
              value={campana.fechaLimiteRenovacion}
              onChange={(e) => guardarCampana({ ...campana, fechaLimiteRenovacion: e.target.value })}
            />
            <p className="form-hint">Pasada esta fecha, quien no haya renovado pierde su sitio del año anterior.</p>
          </div>
          <div className="form-row">
            <label htmlFor="fechaSalida">Día de la estación de penitencia</label>
            <input
              id="fechaSalida"
              type="date"
              value={campana.fechaSalida ?? ''}
              onChange={(e) => guardarCampana({ ...campana, fechaSalida: e.target.value || null })}
            />
          </div>

          <div className="assign-box">
            <label>Cerrar campaña {campana.anio}</label>
            <p className="form-hint">
              Abre la campaña de {campana.anio + 1}: los sitios entregados este año pasan a ser renovables, y todos los
              hermanos vuelven a empezar en «Por renovar» o «Sin papeleta». No se borra nada: el historial queda
              guardado.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (window.confirm(`¿Abrir la campaña ${campana.anio + 1}? Los sitios de ${campana.anio} pasan a renovables.`)) {
                  abrirNuevoAno()
                  setAjustesOpen(false)
                }
              }}
            >
              Abrir campaña {campana.anio + 1}
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
