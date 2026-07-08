import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import HermanoPicker from '../../components/HermanoPicker'
import { LogoMark } from '../../components/Logo'
import { HERMANOS_INICIALES, initials, type Hermano } from '../../data/hermanos'
import { IMPORTE_PAPELETA, PAPELETAS_INICIALES, type Papeleta } from '../../data/papeletas'
import { INCIDENCIAS_INICIALES, type Incidencia, type TipoIncidencia } from '../../data/incidencias'
import { aforoDeCuerpo, etiquetaTramo, getTramos, rangoDeTramo, tramosDeCuerpo, type Cuerpo, type Tramo } from '../../lib/tramos'
import { repartoDeCuerpo, type Asignacion, type EstadoAsignacion } from '../../lib/cortejo'
import { useAuth } from '../../context/AuthContext'
import { getHermandadSettings, type HermandadSettings } from '../../lib/hermandadSettings'

/** Año de la edición activa: un hermano dado de alta este mismo año aún no cumple el mínimo de antigüedad para salir. */
const EDICION_ACTUAL = 2026

const TIPOS_INCIDENCIA: TipoIncidencia[] = ['Ausencia', 'Indisposición', 'Retraso', 'Sustitución', 'Otra']
const CUERPOS: Cuerpo[] = ['Cristo', 'Virgen', 'Único']

type FilaEstado = EstadoAsignacion | 'Pendiente' | 'Excede aforo' | 'Baja'

interface Fila {
  papeleta: Papeleta
  hermano: Hermano
  tramo: Tramo | null
  cuerpo: Cuerpo | null
  puesto: number | null
  estado: FilaEstado
}

function hoy() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function tituloCuerpo(cuerpo: Cuerpo): string {
  if (cuerpo === 'Cristo') return 'Cortejo de Cristo'
  if (cuerpo === 'Virgen') return 'Cortejo de la Virgen'
  return 'Tramos'
}

function estadoPillClass(estado: FilaEstado) {
  if (estado === 'Confirmada') return 'pill--ok'
  if (estado === 'Con incidencia' || estado === 'Excede aforo') return 'pill--err'
  if (estado === 'Baja') return 'pill--off'
  return 'pill--warn' // Reservada, Pendiente
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
)
const WarnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
)
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
)

export default function Cortejo() {
  const { user } = useAuth()
  const fallbackNombre = (user?.user_metadata?.hermandad as string | undefined) ?? ''
  const registrador = (user?.user_metadata?.nombre as string | undefined) ?? user?.email ?? 'Secretaría'
  const hermandad = useMemo(() => getHermandadSettings(fallbackNombre), [fallbackNombre])
  const tramos = useMemo(() => getTramos(), [])

  const [papeletas, setPapeletas] = useState<Papeleta[]>(PAPELETAS_INICIALES)
  const [incidencias, setIncidencias] = useState<Incidencia[]>(INCIDENCIAS_INICIALES)

  const [query, setQuery] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'Todos' | 'Con hueco' | 'Completo' | 'Con incidencia' | 'Excede aforo'>('Todos')
  const [cuerpoFiltro, setCuerpoFiltro] = useState<'Todos' | Cuerpo>('Todos')
  const [vista, setVista] = useState<'tarjetas' | 'tabla'>('tarjetas')
  const [diaDeSalida, setDiaDeSalida] = useState(false)

  const [tramoAbiertoId, setTramoAbiertoId] = useState<string | null>(null)
  const [asignarOpen, setAsignarOpen] = useState(false)
  const [asignarError, setAsignarError] = useState<string | null>(null)
  const [ordenOpen, setOrdenOpen] = useState(false)
  const [incidenciaPara, setIncidenciaPara] = useState<string | null>(null)

  const hermanoDe = useMemo(() => {
    const map = new Map(HERMANOS_INICIALES.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [])

  const incidenciasAbiertas = useMemo(
    () => new Set(incidencias.filter((i) => !i.resuelta).map((i) => i.papeletaId)),
    [incidencias],
  )

  // Reparto derivado por cuerpo: cada hermano con papeleta activa se ordena
  // por su número de hermano y se reparte por los tramos de su cuerpo según
  // el aforo de cada uno. tramo === null si supera el aforo total del cuerpo.
  const repartosPorCuerpo = useMemo(() => {
    const map = new Map<Cuerpo, Asignacion[]>()
    CUERPOS.forEach((c) => {
      map.set(c, repartoDeCuerpo(c, papeletas, hermanoDe, tramosDeCuerpo(c, tramos), incidenciasAbiertas))
    })
    return map
  }, [tramos, papeletas, hermanoDe, incidenciasAbiertas])

  const repartos = useMemo(() => {
    const map = new Map<string, Asignacion[]>()
    tramos.forEach((t) => map.set(t.id, []))
    repartosPorCuerpo.forEach((asigs) => {
      asigs.forEach((a) => {
        if (a.tramo) map.get(a.tramo.id)?.push(a)
      })
    })
    return map
  }, [tramos, repartosPorCuerpo])

  const excedeAforo = useMemo(() => {
    const out: Asignacion[] = []
    repartosPorCuerpo.forEach((asigs) => asigs.forEach((a) => { if (!a.tramo) out.push(a) }))
    return out
  }, [repartosPorCuerpo])

  const pendientes = useMemo(
    () => papeletas.filter((p) => p.estado === 'Solicitada' && !p.cuerpo),
    [papeletas],
  )

  const cuerposPresentes = useMemo(() => {
    const set = new Set(tramos.map((t) => t.cuerpo))
    return CUERPOS.filter((c) => set.has(c))
  }, [tramos])

  const stats = useMemo(() => {
    let cubiertos = 0
    let total = 0
    let completos = 0
    tramos.forEach((t) => {
      const reparto = repartos.get(t.id) ?? []
      cubiertos += reparto.length
      total += t.capacidad
      if (reparto.length >= t.capacidad) completos += 1
    })
    return {
      cubiertos,
      total,
      completos,
      tramosTotal: tramos.length,
      excedeAforo: excedeAforo.length,
      incidenciasAbiertas: incidenciasAbiertas.size,
    }
  }, [tramos, repartos, excedeAforo, incidenciasAbiertas])

  // ---------- filas combinadas (para la vista tabla y para filtrar tarjetas) ----------
  const filas = useMemo(() => {
    const out: Fila[] = []
    CUERPOS.forEach((c) => {
      ;(repartosPorCuerpo.get(c) ?? []).forEach((a) => {
        out.push({
          papeleta: a.papeleta,
          hermano: a.hermano,
          tramo: a.tramo,
          cuerpo: c,
          puesto: a.puesto,
          estado: a.tramo ? a.estado : 'Excede aforo',
        })
      })
    })
    pendientes.forEach((p) => {
      const h = hermanoDe(p.hermanoId)
      if (h) out.push({ papeleta: p, hermano: h, tramo: null, cuerpo: null, puesto: null, estado: 'Pendiente' })
    })
    papeletas
      .filter((p) => p.estado === 'Anulada')
      .forEach((p) => {
        const h = hermanoDe(p.hermanoId)
        if (h) out.push({ papeleta: p, hermano: h, tramo: null, cuerpo: null, puesto: null, estado: 'Baja' })
      })
    return out
  }, [repartosPorCuerpo, pendientes, papeletas, hermanoDe])

  function pasaFiltros(cuerpo: Cuerpo | null, tramo: Tramo | null, filaEstado: FilaEstado, textoBusqueda: string) {
    if (cuerpoFiltro !== 'Todos' && cuerpo !== cuerpoFiltro) return false
    if (estadoFiltro === 'Con incidencia' && filaEstado !== 'Con incidencia') return false
    if (estadoFiltro === 'Excede aforo' && filaEstado !== 'Excede aforo') return false
    if (estadoFiltro === 'Con hueco' || estadoFiltro === 'Completo') {
      if (!tramo) return false
      const reparto = repartos.get(tramo.id) ?? []
      const estado = reparto.length >= tramo.capacidad ? 'Completo' : 'Con hueco'
      if (estado !== estadoFiltro) return false
    }
    const q = query.trim().toLowerCase()
    if (q && !textoBusqueda.toLowerCase().includes(q)) return false
    return true
  }

  const tramosFiltrados = useMemo(() => {
    return tramos.filter((t) => {
      const reparto = repartos.get(t.id) ?? []
      const texto = `${etiquetaTramo(t)} ${reparto.map((a) => `${a.hermano.nombre} ${a.hermano.numero}`).join(' ')}`
      const filaEstado: FilaEstado = reparto.some((a) => a.estado === 'Con incidencia') ? 'Con incidencia' : 'Reservada'
      return pasaFiltros(t.cuerpo, t, filaEstado, texto)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tramos, repartos, cuerpoFiltro, estadoFiltro, query])

  const filasFiltradas = useMemo(() => {
    return filas.filter((f) =>
      pasaFiltros(f.cuerpo, f.tramo, f.estado, `${f.hermano.nombre} ${f.hermano.numero} ${f.tramo ? etiquetaTramo(f.tramo) : ''}`),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, cuerpoFiltro, estadoFiltro, query])

  const tramoAbierto = tramos.find((t) => t.id === tramoAbiertoId) ?? null
  const repartoAbierto = tramoAbierto ? (repartos.get(tramoAbierto.id) ?? []) : []
  const rangoAbierto = useMemo(
    () => (tramoAbierto ? rangoDeTramo(tramoAbierto, tramosDeCuerpo(tramoAbierto.cuerpo, tramos)) : null),
    [tramoAbierto, tramos],
  )

  // ---------- acciones ----------
  function marcarPagada(papeletaId: string) {
    setPapeletas((prev) => prev.map((p) => (p.id === papeletaId ? { ...p, estado: 'Pagada' } : p)))
  }

  function marcarPresente(papeletaId: string) {
    // "Pase de lista" del día de salida: si aún no estaba pagada, se confirma también el pago en mano.
    setPapeletas((prev) => prev.map((p) => (p.id === papeletaId ? { ...p, estado: 'Entregada' } : p)))
  }

  function registrarIncidencia(papeletaId: string, tipo: TipoIncidencia, descripcion: string) {
    const nueva: Incidencia = {
      id: `inc-${Date.now()}`,
      papeletaId,
      tipo,
      descripcion,
      hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      registradoPor: registrador,
      resuelta: false,
    }
    setIncidencias((prev) => [nueva, ...prev])
    setIncidenciaPara(null)
  }

  function resolverIncidenciaDePapeleta(papeletaId: string, comoBaja: boolean) {
    setIncidencias((prev) =>
      prev.map((i) => (i.papeletaId === papeletaId && !i.resuelta ? { ...i, resuelta: true } : i)),
    )
    if (comoBaja) {
      setPapeletas((prev) => prev.map((p) => (p.id === papeletaId ? { ...p, estado: 'Anulada' } : p)))
    }
  }

  function handleAsignarHermano(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const hermanoId = String(data.get('hermanoId') ?? '')
    const cuerpo = String(data.get('cuerpo') ?? '') as Cuerpo | ''
    const hermano = HERMANOS_INICIALES.find((h) => h.id === hermanoId)
    if (!hermano) {
      setAsignarError('Elige un hermano de la lista.')
      return
    }
    if (!cuerpo) {
      setAsignarError('Elige un cuerpo.')
      return
    }
    if (hermano.antiguedad === EDICION_ACTUAL) {
      setAsignarError(
        `${hermano.nombre.split(' ')[0]} es nuevo/a esta edición: hace falta al menos un año de antigüedad para salir en el cortejo.`,
      )
      return
    }

    setPapeletas((prev) => {
      const existente = prev.find((p) => p.hermanoId === hermanoId && p.estado !== 'Anulada')
      if (existente) {
        return prev.map((p) =>
          p.id === existente.id
            ? { ...p, cuerpo, estado: p.estado === 'Solicitada' ? 'Asignada' : p.estado }
            : p,
        )
      }
      const nextNumero = Math.max(0, ...prev.map((p) => p.numero)) + 1
      const nueva: Papeleta = {
        id: `p-${Date.now()}`,
        numero: nextNumero,
        hermanoId,
        cuerpo,
        importe: IMPORTE_PAPELETA,
        estado: 'Asignada',
        fechaSolicitud: hoy(),
      }
      return [nueva, ...prev]
    })
    setAsignarError(null)
    setAsignarOpen(false)
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Cortejo</p>
          <h1>Reparto y organización del cortejo</h1>
          <p className="dash-head__lead">
            {stats.cubiertos}/{stats.total} puestos cubiertos · Edición {EDICION_ACTUAL} ·{' '}
            <Link to="/app/configuracion" className="dash-head__link">
              Editar tramos
            </Link>
          </p>
        </div>
        <div className="dash-head__actions">
          <button className="btn btn-outline" onClick={() => setOrdenOpen(true)}>
            Imprimir orden del cortejo
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setAsignarError(null)
              setAsignarOpen(true)
            }}
          >
            + Asignar hermano
          </button>
        </div>
      </div>

      {excedeAforo.length > 0 && (
        <div className="banner-inline banner-inline--warn">
          {excedeAforo.length} hermano{excedeAforo.length > 1 ? 's' : ''} no caben en ningún tramo
          configurado de {[...new Set(excedeAforo.map((a) => a.papeleta.cuerpo))].join(', ')}.{' '}
          <Link to="/app/configuracion">Amplía el aforo en Configuración</Link>.
        </div>
      )}

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Puestos cubiertos</span>
          <span className="stat-tile__value">
            {stats.cubiertos}/{stats.total}
          </span>
          <span className="stat-tile__trend stat-tile__trend--ok">
            {stats.total ? Math.round((stats.cubiertos / stats.total) * 100) : 0}%
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Tramos completos</span>
          <span className="stat-tile__value">
            {stats.completos}/{stats.tramosTotal}
          </span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Al aforo máximo</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Exceden el aforo</span>
          <span className="stat-tile__value">{stats.excedeAforo}</span>
          <span className={`stat-tile__trend stat-tile__trend--${stats.excedeAforo > 0 ? 'warn' : 'ok'}`}>
            {stats.excedeAforo > 0 ? 'Amplía tramos' : 'Todo cabe'}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Incidencias abiertas</span>
          <span className="stat-tile__value">{stats.incidenciasAbiertas}</span>
          <span className={`stat-tile__trend stat-tile__trend--${stats.incidenciasAbiertas > 0 ? 'warn' : 'ok'}`}>
            {stats.incidenciasAbiertas > 0 ? 'Requieren atención' : 'Todo en orden'}
          </span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar hermano, número o tramo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {(['Todos', 'Con hueco', 'Completo', 'Con incidencia', 'Excede aforo'] as const).map((f) => (
            <button
              key={f}
              className={`chip${estadoFiltro === f ? ' chip--active' : ''}`}
              onClick={() => setEstadoFiltro(f)}
              type="button"
            >
              {f}
            </button>
          ))}
          {cuerposPresentes.length > 1 && (
            <>
              {(['Todos', ...cuerposPresentes] as Array<'Todos' | Cuerpo>).map((c) => (
                <button
                  key={c}
                  className={`chip${cuerpoFiltro === c ? ' chip--active' : ''}`}
                  onClick={() => setCuerpoFiltro(c)}
                  type="button"
                >
                  {c}
                </button>
              ))}
            </>
          )}
          <button
            className={`chip${vista === 'tabla' ? ' chip--active' : ''}`}
            onClick={() => setVista((v) => (v === 'tarjetas' ? 'tabla' : 'tarjetas'))}
            type="button"
          >
            {vista === 'tarjetas' ? 'Ver como tabla' : 'Ver como tarjetas'}
          </button>
        </div>
      </div>

      <label className="checkbox-row cortejo-daymode-toggle" htmlFor="diaDeSalida">
        <input
          id="diaDeSalida"
          type="checkbox"
          checked={diaDeSalida}
          onChange={(e) => setDiaDeSalida(e.target.checked)}
        />
        Modo día de salida
      </label>
      {diaDeSalida && (
        <div className="banner-inline banner-inline--accent">
          Modo día de salida activo · marca presentes y registra incidencias directamente desde
          cada tramo.
        </div>
      )}

      {vista === 'tarjetas' ? (
        <>
          {cuerposPresentes.map((c) => (
            <CuerpoSeccion
              key={c}
              titulo={tituloCuerpo(c)}
              tramos={tramosFiltrados.filter((t) => t.cuerpo === c)}
              repartos={repartos}
              diaDeSalida={diaDeSalida}
              onAbrir={setTramoAbiertoId}
            />
          ))}
          {tramosFiltrados.length === 0 && (
            <p className="table-empty">No hay tramos que coincidan con la búsqueda.</p>
          )}
        </>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Puesto</th>
                <th>Hermano</th>
                {cuerposPresentes.length > 1 && <th>Cuerpo</th>}
                <th>Tramo</th>
                <th>Papeleta</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map((f) => (
                <tr key={f.papeleta.id}>
                  <td className="num">{f.puesto ?? '—'}</td>
                  <td>
                    <div className="row-person">
                      <span className="row-avatar">{initials(f.hermano.nombre)}</span>
                      <span>
                        <span className="row-person__name">{f.hermano.nombre}</span>
                        <span className="row-person__sub">Nº {f.hermano.numero}</span>
                      </span>
                    </div>
                  </td>
                  {cuerposPresentes.length > 1 && <td>{f.cuerpo ?? '—'}</td>}
                  <td>{f.tramo ? etiquetaTramo(f.tramo) : <span className="table-muted">Sin asignar</span>}</td>
                  <td className="num">{String(f.papeleta.numero).padStart(4, '0')}</td>
                  <td>
                    <span className={`pill ${estadoPillClass(f.estado)}`}>{f.estado}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {diaDeSalida && f.estado !== 'Pendiente' && f.estado !== 'Baja' && f.estado !== 'Excede aforo' ? (
                        <>
                          <button className="icon-btn" title="Marcar presente" onClick={() => marcarPresente(f.papeleta.id)}>
                            <CheckIcon />
                          </button>
                          <button className="icon-btn" title="Registrar incidencia" onClick={() => setIncidenciaPara(f.papeleta.id)}>
                            <WarnIcon />
                          </button>
                        </>
                      ) : (
                        f.tramo && (
                          <button className="icon-btn" title="Ver tramo" onClick={() => setTramoAbiertoId(f.tramo!.id)}>
                            <EyeIcon />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No hay hermanos que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- Drawer: ficha de tramo ---------------- */}
      <Drawer
        open={!!tramoAbierto}
        onClose={() => setTramoAbiertoId(null)}
        title={tramoAbierto ? etiquetaTramo(tramoAbierto) : ''}
        subtitle={tramoAbierto && rangoAbierto ? `Puestos ${rangoAbierto[0]}–${rangoAbierto[1]}` : undefined}
        footer={
          tramoAbierto && (
            <>
              <button className="btn btn-outline" onClick={() => window.print()}>
                Imprimir listado de tramo
              </button>
              <button className="btn btn-ghost" onClick={() => setTramoAbiertoId(null)}>
                Cerrar
              </button>
            </>
          )
        }
      >
        {tramoAbierto && rangoAbierto && (
          <TramoFicha
            tramo={tramoAbierto}
            rango={rangoAbierto}
            reparto={repartoAbierto}
            hermandad={hermandad}
            diaDeSalida={diaDeSalida}
            onPresente={marcarPresente}
            onIncidencia={setIncidenciaPara}
            onResolver={resolverIncidenciaDePapeleta}
            onPagada={marcarPagada}
          />
        )}
      </Drawer>

      {/* ---------------- Drawer: asignar hermano ---------------- */}
      <Drawer
        open={asignarOpen}
        onClose={() => setAsignarOpen(false)}
        title="Asignar hermano"
        subtitle="Cortejo"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAsignarOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="asignar-hermano-form" type="submit">
              Asignar
            </button>
          </>
        }
      >
        <form id="asignar-hermano-form" className="app-form" onSubmit={handleAsignarHermano}>
          {asignarError && <div className="form-hint form-hint--error">{asignarError}</div>}
          <div className="form-row">
            <label htmlFor="hermanoId">Hermano</label>
            <HermanoPicker hermanos={HERMANOS_INICIALES} name="hermanoId" id="hermanoId" />
          </div>
          <div className="form-row">
            <label htmlFor="cuerpo">Cuerpo</label>
            <select id="cuerpo" name="cuerpo" defaultValue="">
              <option value="" disabled>
                Elige un cuerpo
              </option>
              {cuerposPresentes.map((c) => {
                const ocupados = (repartosPorCuerpo.get(c) ?? []).filter((a) => a.tramo).length
                return (
                  <option key={c} value={c}>
                    {c} ({ocupados}/{aforoDeCuerpo(c, tramos)})
                  </option>
                )
              })}
            </select>
          </div>
          <p className="form-hint">
            El tramo y el puesto se calculan solos a partir de su número de hermano: cuanto más
            bajo, más cerca de la cruz de guía.
          </p>
        </form>
      </Drawer>

      {/* ---------------- Drawer: orden completo del cortejo (impresión) ---------------- */}
      <Drawer
        open={ordenOpen}
        onClose={() => setOrdenOpen(false)}
        title="Orden del cortejo"
        subtitle={`Documento maestro · Edición ${EDICION_ACTUAL}`}
        footer={
          <>
            <button className="btn btn-primary" onClick={() => window.print()}>
              Imprimir / Descargar
            </button>
            <button className="btn btn-ghost" onClick={() => setOrdenOpen(false)}>
              Cerrar
            </button>
          </>
        }
      >
        <div className="cortejo-orden print-doc">
          <div className="cortejo-orden__head">
            <span className="ticket-doc__logo">
              {hermandad.logoDataUrl ? <img src={hermandad.logoDataUrl} alt="" /> : <LogoMark size={26} />}
            </span>
            <div>
              <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
              <p className="eyebrow">Orden del cortejo · Edición {EDICION_ACTUAL}</p>
            </div>
          </div>
          {tramos.map((t) => {
            const reparto = repartos.get(t.id) ?? []
            return (
              <div className="cortejo-orden__tramo" key={t.id}>
                <h3>
                  {etiquetaTramo(t)}
                  {t.tipo && <span className="table-subtle"> · {t.tipo}</span>}{' '}
                  <span className="table-subtle">· {reparto.length}/{t.capacidad}</span>
                </h3>
                {reparto.length === 0 ? (
                  <p className="form-hint">Sin hermanos asignados todavía.</p>
                ) : (
                  <ol>
                    {reparto.map((a) => (
                      <li key={a.papeleta.id}>
                        Puesto {a.puesto} · {a.hermano.nombre}{' '}
                        <span className="table-subtle">· nº {a.hermano.numero}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
          <p className="recibo-doc__note">Documento generado por Cabildo · datos de ejemplo</p>
        </div>
      </Drawer>

      {/* ---------------- Mini-formulario: registrar incidencia ---------------- */}
      {incidenciaPara && (
        <IncidenciaForm
          papeleta={papeletas.find((p) => p.id === incidenciaPara) ?? null}
          hermano={(() => {
            const p = papeletas.find((pp) => pp.id === incidenciaPara)
            return p ? hermanoDe(p.hermanoId) : undefined
          })()}
          onCancel={() => setIncidenciaPara(null)}
          onConfirm={(tipo, descripcion) => registrarIncidencia(incidenciaPara, tipo, descripcion)}
        />
      )}
    </div>
  )
}

// =============================================================================
// Subcomponentes
// =============================================================================

function CuerpoSeccion({
  titulo,
  tramos,
  repartos,
  diaDeSalida,
  onAbrir,
}: {
  titulo: string
  tramos: Tramo[]
  repartos: Map<string, Asignacion[]>
  diaDeSalida: boolean
  onAbrir: (id: string) => void
}) {
  if (tramos.length === 0) return null
  return (
    <section className="cortejo-cuerpo">
      <h2 className="cortejo-cuerpo__title">{titulo}</h2>
      <div className="tramos-grid">
        {tramos.map((t, i) => (
          <TramoCard
            key={t.id}
            tramo={t}
            indice={i + 1}
            reparto={repartos.get(t.id) ?? []}
            diaDeSalida={diaDeSalida}
            onAbrir={() => onAbrir(t.id)}
          />
        ))}
      </div>
    </section>
  )
}

function TramoCard({
  tramo,
  indice,
  reparto,
  diaDeSalida,
  onAbrir,
}: {
  tramo: Tramo
  indice: number
  reparto: Asignacion[]
  diaDeSalida: boolean
  onAbrir: () => void
}) {
  const ocupados = reparto.length
  const capacidad = tramo.capacidad
  const conIncidencia = reparto.filter((a) => a.estado === 'Con incidencia').length
  const pct = capacidad > 0 ? Math.min(100, Math.round((ocupados / capacidad) * 100)) : 0
  const lleno = ocupados >= capacidad
  const visibles = reparto.slice(0, 5)
  const resto = ocupados - visibles.length

  return (
    <article className={`tramo-card${lleno ? ' tramo-card--full' : ''}`} onClick={onAbrir}>
      <span className="tramo-card__index">{String(indice).padStart(2, '0')}</span>
      <h3 className="tramo-card__title">{tramo.nombre}</h3>
      {tramo.tipo && <span className="tramo-card__tipo">{tramo.tipo}</span>}

      <div className="meter" aria-hidden="true">
        <span
          className={`meter__fill meter__fill--${pct >= 100 ? 'full' : pct >= 75 ? 'warn' : 'ok'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tramo-card__count">
        {ocupados}/{capacidad} puestos
      </span>

      <div className="avatar-stack">
        {visibles.map((a) => (
          <span key={a.papeleta.id} className="row-avatar avatar-stack__item" title={a.hermano.nombre}>
            {initials(a.hermano.nombre)}
          </span>
        ))}
        {resto > 0 && <span className="row-avatar avatar-stack__item avatar-stack__more">+{resto}</span>}
        {ocupados === 0 && <span className="table-muted">Sin hermanos asignados</span>}
      </div>

      {conIncidencia > 0 && (
        <div className="tramo-card__badges">
          <span className="pill pill--err">{conIncidencia} incidencia{conIncidencia > 1 ? 's' : ''}</span>
        </div>
      )}

      {diaDeSalida && (
        <button
          type="button"
          className="btn btn-outline btn-sm tramo-card__pase"
          onClick={(e) => {
            e.stopPropagation()
            onAbrir()
          }}
        >
          Pase de lista
        </button>
      )}
    </article>
  )
}

function TramoFicha({
  tramo,
  rango,
  reparto,
  hermandad,
  diaDeSalida,
  onPresente,
  onIncidencia,
  onResolver,
  onPagada,
}: {
  tramo: Tramo
  rango: [number, number]
  reparto: Asignacion[]
  hermandad: HermandadSettings
  diaDeSalida: boolean
  onPresente: (papeletaId: string) => void
  onIncidencia: (papeletaId: string) => void
  onResolver: (papeletaId: string, comoBaja: boolean) => void
  onPagada: (papeletaId: string) => void
}) {
  const ocupados = reparto.length
  const capacidad = tramo.capacidad
  const pct = capacidad > 0 ? Math.min(100, Math.round((ocupados / capacidad) * 100)) : 0

  return (
    <div className="ficha">
      <div className="meter meter--lg" aria-hidden="true">
        <span className={`meter__fill meter__fill--${pct >= 100 ? 'full' : pct >= 75 ? 'warn' : 'ok'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="dash-head__lead">
        {ocupados}/{capacidad} puestos ocupados · orden de desfile {rango[0]}–{rango[1]}
        {tramo.tipo && ` · ${tramo.tipo}`}
      </p>

      <dl className="ficha__list">
        <div>
          <dt>Roster, por número de hermano</dt>
          <dd>
            {reparto.length === 0 && <span className="table-muted">Nadie asignado todavía.</span>}
            <ul className="cortejo-roster">
              {reparto.map((a) => (
                <li key={a.papeleta.id}>
                  <span className="row-person">
                    <span className="row-avatar">{initials(a.hermano.nombre)}</span>
                    <span>
                      <span className="row-person__name">{a.hermano.nombre}</span>
                      <span className="row-person__sub">
                        Nº {a.hermano.numero} · puesto {a.puesto}
                      </span>
                    </span>
                  </span>
                  <span className={`pill ${estadoPillClass(a.estado)}`}>{a.estado}</span>
                  {diaDeSalida && a.estado === 'Con incidencia' && (
                    <span className="row-actions">
                      <button className="icon-btn" title="Resuelta, sigue en el cortejo" onClick={() => onResolver(a.papeleta.id, false)}>
                        <CheckIcon />
                      </button>
                      <button className="icon-btn" title="Fue baja definitiva" onClick={() => onResolver(a.papeleta.id, true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                      </button>
                    </span>
                  )}
                  {diaDeSalida && a.estado !== 'Con incidencia' && (
                    <span className="row-actions">
                      <button className="icon-btn" title="Marcar presente" onClick={() => onPresente(a.papeleta.id)}>
                        <CheckIcon />
                      </button>
                      <button className="icon-btn" title="Registrar incidencia" onClick={() => onIncidencia(a.papeleta.id)}>
                        <WarnIcon />
                      </button>
                    </span>
                  )}
                  {!diaDeSalida && a.estado === 'Reservada' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => onPagada(a.papeleta.id)}>
                      Marcar pagada
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      <p className="recibo-doc__note">{hermandad.nombreLegal || 'Tu hermandad'} · listado generado por Cabildo</p>

      {/* Documento imprimible: solo aparece en el papel, no en la ficha en pantalla (ver .screen-hidden). */}
      <div className="cortejo-orden screen-hidden print-doc">
        <div className="cortejo-orden__head">
          <span className="ticket-doc__logo">
            {hermandad.logoDataUrl ? <img src={hermandad.logoDataUrl} alt="" /> : <LogoMark size={26} />}
          </span>
          <div>
            <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
            <p className="eyebrow">Listado de tramo · Edición {EDICION_ACTUAL}</p>
          </div>
        </div>
        <div className="cortejo-orden__tramo">
          <h3>
            {etiquetaTramo(tramo)}
            {tramo.tipo && <span className="table-subtle"> · {tramo.tipo}</span>}{' '}
            <span className="table-subtle">· {ocupados}/{capacidad}</span>
          </h3>
          {reparto.length === 0 ? (
            <p className="form-hint">Sin hermanos asignados todavía.</p>
          ) : (
            <ol>
              {reparto.map((a) => (
                <li key={a.papeleta.id}>
                  Puesto {a.puesto} · {a.hermano.nombre}{' '}
                  <span className="table-subtle">· nº {a.hermano.numero}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <p className="recibo-doc__note">{hermandad.nombreLegal || 'Tu hermandad'} · listado generado por Cabildo</p>
      </div>
    </div>
  )
}

function IncidenciaForm({
  papeleta,
  hermano,
  onCancel,
  onConfirm,
}: {
  papeleta: Papeleta | null
  hermano: Hermano | undefined
  onCancel: () => void
  onConfirm: (tipo: TipoIncidencia, descripcion: string) => void
}) {
  const [tipo, setTipo] = useState<TipoIncidencia>('Ausencia')
  const [descripcion, setDescripcion] = useState('')

  if (!papeleta || !hermano) return null

  return (
    <div className="drawer-layer">
      <button className="drawer-scrim" aria-label="Cerrar" onClick={onCancel} />
      <aside className="drawer drawer--sm" role="dialog" aria-modal="true" aria-label="Registrar incidencia">
        <header className="drawer__head">
          <div>
            <p className="eyebrow">Modo día de salida</p>
            <h2>Registrar incidencia</h2>
          </div>
          <button className="drawer__close" onClick={onCancel} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <div className="drawer__body">
          <p className="dash-head__lead">
            {hermano.nombre} · nº {hermano.numero}
          </p>
          <div className="form-row">
            <label htmlFor="tipoIncidencia">Tipo</label>
            <select id="tipoIncidencia" value={tipo} onChange={(e) => setTipo(e.target.value as TipoIncidencia)}>
              {TIPOS_INCIDENCIA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="descripcionIncidencia">Descripción</label>
            <textarea
              id="descripcionIncidencia"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Qué ha pasado y qué se ha hecho"
            />
          </div>
        </div>
        <footer className="drawer__foot">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            disabled={!descripcion.trim()}
            onClick={() => onConfirm(tipo, descripcion.trim())}
          >
            Registrar
          </button>
        </footer>
      </aside>
    </div>
  )
}
