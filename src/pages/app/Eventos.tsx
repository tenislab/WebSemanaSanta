import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Drawer from '../../components/Drawer'
import { EVENTOS_INICIALES, TIPOS_EVENTO, type Evento, type TareaEvento, type TipoEvento } from '../../data/eventos'
import { HERMANOS_INICIALES, type Hermano } from '../../data/hermanos'
import { CLAVES_DATOS, leerPersistido } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { eventoToRow, rowToEvento } from '../../lib/db/eventos'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function claseTipo(tipo: TipoEvento): string {
  if (tipo === 'Culto') return 'evento-tipo--culto'
  if (tipo === 'Salida') return 'evento-tipo--salida'
  if (tipo === 'Cabildo') return 'evento-tipo--cabildo'
  if (tipo === 'Caridad') return 'evento-tipo--caridad'
  return 'evento-tipo--otro'
}

function fechaLarga(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Días del mes en una rejilla de semanas que empieza en lunes (null = hueco). */
function rejillaDelMes(anio: number, mes: number): (number | null)[] {
  const primero = new Date(anio, mes, 1)
  // getDay(): 0=domingo … 6=sábado → lo pasamos a 0=lunes … 6=domingo
  const offset = (primero.getDay() + 6) % 7
  const dias = new Date(anio, mes + 1, 0).getDate()
  const celdas: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= dias; d++) celdas.push(d)
  return celdas
}

function iso(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export default function Eventos() {
  const [eventos, setEventos] = useSupabaseTable<Evento>(
    'eventos',
    CLAVES_DATOS.eventos,
    EVENTOS_INICIALES,
    eventoToRow,
    rowToEvento,
  )
  const hermanos = useMemo(() => leerPersistido(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])
  const hermanosActivos = useMemo(() => hermanos.filter((h) => h.estado !== 'Baja'), [hermanos])
  const hermanoDe = useMemo(() => {
    const map = new Map(hermanos.map((h) => [h.id, h]))
    return (id: string | null) => (id ? map.get(id) : undefined)
  }, [hermanos])

  const ahora = new Date()
  const [mesVista, setMesVista] = useState({ anio: ahora.getFullYear(), mes: ahora.getMonth() })
  const [seleccionado, setSeleccionado] = useState<Evento | null>(null)
  /** Día abierto en el calendario, cuando tiene más de un evento. */
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [nuevaTarea, setNuevaTarea] = useState('')

  const hoyIso = iso(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, Evento[]>()
    eventos.forEach((e) => {
      const lista = map.get(e.fecha) ?? []
      lista.push(e)
      map.set(e.fecha, lista)
    })
    return map
  }, [eventos])

  const proximos = useMemo(
    () =>
      [...eventos]
        .filter((e) => e.fecha >= hoyIso)
        .sort((a, b) => (a.fecha === b.fecha ? (a.hora ?? '').localeCompare(b.hora ?? '') : a.fecha.localeCompare(b.fecha)))
        .slice(0, 8),
    [eventos, hoyIso],
  )

  const stats = useMemo(() => {
    const proximosN = eventos.filter((e) => e.fecha >= hoyIso).length
    const tareas = eventos.flatMap((e) => e.tareas)
    const pendientes = tareas.filter((t) => !t.hecha).length
    const sinAsignar = tareas.filter((t) => !t.hecha && !t.trabajadorId).length
    return { proximosN, pendientes, sinAsignar }
  }, [eventos, hoyIso])

  /** Tareas pendientes agrupadas por trabajador (los sin asignar, al final). */
  const tareasPorTrabajador = useMemo(() => {
    const grupos = new Map<string, { id: string; nombre: string; tareas: { evento: Evento; tarea: TareaEvento }[] }>()
    const sinAsignar: { evento: Evento; tarea: TareaEvento }[] = []
    const ordenados = [...eventos].sort((a, b) => a.fecha.localeCompare(b.fecha))
    ordenados.forEach((e) => {
      e.tareas.forEach((t) => {
        if (t.hecha) return
        if (!t.trabajadorId) {
          sinAsignar.push({ evento: e, tarea: t })
          return
        }
        const nombre = hermanoDe(t.trabajadorId)?.nombre ?? t.trabajadorNombre ?? 'Trabajador'
        const g = grupos.get(t.trabajadorId) ?? { id: t.trabajadorId, nombre, tareas: [] }
        g.tareas.push({ evento: e, tarea: t })
        grupos.set(t.trabajadorId, g)
      })
    })
    return { grupos: [...grupos.values()].sort((a, b) => b.tareas.length - a.tareas.length), sinAsignar }
  }, [eventos, hermanoDe])

  function aplicarEvento(id: string, cambios: Partial<Evento>) {
    setEventos((prev) => prev.map((e) => (e.id === id ? { ...e, ...cambios } : e)))
    setSeleccionado((prev) => (prev && prev.id === id ? { ...prev, ...cambios } : prev))
  }

  function toggleTarea(eventoId: string, tareaId: string) {
    const evento = eventos.find((e) => e.id === eventoId)
    if (!evento) return
    aplicarEvento(eventoId, {
      tareas: evento.tareas.map((t) => (t.id === tareaId ? { ...t, hecha: !t.hecha } : t)),
    })
  }

  function asignarTarea(eventoId: string, tareaId: string, trabajador: Hermano | null) {
    const evento = eventos.find((e) => e.id === eventoId)
    if (!evento) return
    aplicarEvento(eventoId, {
      tareas: evento.tareas.map((t) =>
        t.id === tareaId
          ? { ...t, trabajadorId: trabajador?.id ?? null, trabajadorNombre: trabajador?.nombre }
          : t,
      ),
    })
  }

  function anadirTarea(eventoId: string) {
    const titulo = nuevaTarea.trim()
    if (!titulo) return
    const evento = eventos.find((e) => e.id === eventoId)
    if (!evento) return
    const tarea: TareaEvento = { id: nuevoId(), titulo, hecha: false, trabajadorId: null }
    aplicarEvento(eventoId, { tareas: [...evento.tareas, tarea] })
    setNuevaTarea('')
  }

  function borrarTarea(eventoId: string, tareaId: string) {
    const evento = eventos.find((e) => e.id === eventoId)
    if (!evento) return
    aplicarEvento(eventoId, { tareas: evento.tareas.filter((t) => t.id !== tareaId) })
  }

  function borrarEvento(id: string) {
    if (!window.confirm('¿Borrar este evento y sus tareas?')) return
    setEventos((prev) => prev.filter((e) => e.id !== id))
    setSeleccionado(null)
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const titulo = String(data.get('titulo') ?? '').trim()
    const tipo = String(data.get('tipo') ?? 'Otro') as TipoEvento
    const fecha = String(data.get('fecha') ?? '')
    const hora = String(data.get('hora') ?? '')
    const lugar = String(data.get('lugar') ?? '').trim()
    const descripcion = String(data.get('descripcion') ?? '').trim()
    if (!titulo || !fecha) return
    const nuevo: Evento = {
      id: nuevoId(),
      titulo,
      tipo,
      fecha,
      hora: hora || undefined,
      lugar: lugar || undefined,
      descripcion: descripcion || undefined,
      tareas: [],
    }
    setEventos((prev) => [...prev, nuevo])
    setFormOpen(false)
    // Abrimos el mes del evento recién creado y su ficha, para seguir con las tareas.
    const d = new Date(`${fecha}T00:00:00`)
    if (!Number.isNaN(d.getTime())) setMesVista({ anio: d.getFullYear(), mes: d.getMonth() })
    setSeleccionado(nuevo)
  }

  function moverMes(delta: number) {
    setMesVista((v) => {
      const d = new Date(v.anio, v.mes + delta, 1)
      return { anio: d.getFullYear(), mes: d.getMonth() }
    })
  }

  const celdas = rejillaDelMes(mesVista.anio, mesVista.mes)

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Eventos</p>
          <h1>Eventos y tareas</h1>
          <p className="dash-head__lead">
            Agenda de cultos, cabildos y salidas, con las tareas repartidas entre los que echan una
            mano. La asistencia del día de salida se gestiona en{' '}
            <Link to="/app/cortejo" className="dash-head__link">Cortejo</Link>.
          </p>
        </div>
        <div className="dash-head__actions">
          <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
            + Nuevo evento
          </button>
        </div>
      </div>

      <section className="stat-grid stat-grid--3">
        <div className="stat-tile">
          <span className="stat-tile__label">Próximos eventos</span>
          <span className="stat-tile__value">{stats.proximosN}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">En agenda</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Tareas pendientes</span>
          <span className="stat-tile__value">{stats.pendientes}</span>
          <span className={`stat-tile__trend ${stats.pendientes > 0 ? 'stat-tile__trend--warn' : 'stat-tile__trend--ok'}`}>
            {stats.pendientes > 0 ? 'Por hacer' : 'Todo al día'}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Sin asignar</span>
          <span className="stat-tile__value">{stats.sinAsignar}</span>
          <span className={`stat-tile__trend ${stats.sinAsignar > 0 ? 'stat-tile__trend--warn' : 'stat-tile__trend--ok'}`}>
            {stats.sinAsignar > 0 ? 'Buscan voluntario' : 'Todas repartidas'}
          </span>
        </div>
      </section>

      <div className="eventos-layout">
        {/* -------- Calendario mensual -------- */}
        <div className="panel eventos-cal">
          <div className="eventos-cal__head">
            <button className="icon-btn" aria-label="Mes anterior" onClick={() => moverMes(-1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <h2>
              {MESES[mesVista.mes]} {mesVista.anio}
            </h2>
            <button className="icon-btn" aria-label="Mes siguiente" onClick={() => moverMes(1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div className="eventos-cal__grid" role="grid">
            {DIAS_SEMANA.map((d) => (
              <span key={d} className="eventos-cal__dow">{d}</span>
            ))}
            {celdas.map((dia, i) => {
              if (dia === null) return <span key={`x${i}`} className="eventos-cal__celda eventos-cal__celda--vacia" />
              const fecha = iso(mesVista.anio, mesVista.mes, dia)
              const delDia = eventosPorDia.get(fecha) ?? []
              const esHoy = fecha === hoyIso
              return (
                <button
                  type="button"
                  key={fecha}
                  className={`eventos-cal__celda${esHoy ? ' eventos-cal__celda--hoy' : ''}${delDia.length ? ' eventos-cal__celda--con' : ''}`}
                  onClick={() => {
                    if (delDia.length === 1) setSeleccionado(delDia[0])
                    else if (delDia.length > 1) setDiaAbierto(fecha)
                  }}
                  title={delDia.map((e) => e.titulo).join(' · ') || undefined}
                >
                  <span className="eventos-cal__dia">{dia}</span>
                  {delDia.length > 0 && (
                    <span className="eventos-cal__puntos">
                      {delDia.slice(0, 3).map((e) => (
                        <i key={e.id} className={`eventos-cal__punto ${claseTipo(e.tipo)}`} />
                      ))}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="eventos-cal__leyenda">
            <span><i className="eventos-cal__punto evento-tipo--culto" /> Culto</span>
            <span><i className="eventos-cal__punto evento-tipo--salida" /> Salida</span>
            <span><i className="eventos-cal__punto evento-tipo--cabildo" /> Cabildo</span>
            <span><i className="eventos-cal__punto evento-tipo--caridad" /> Caridad</span>
            <span><i className="eventos-cal__punto evento-tipo--otro" /> Otros</span>
          </div>
        </div>

        {/* -------- Tareas pendientes por trabajador -------- */}
        <div className="panel">
          <div className="panel__head">
            <h2>Tareas pendientes</h2>
          </div>
          {tareasPorTrabajador.grupos.length === 0 && tareasPorTrabajador.sinAsignar.length === 0 ? (
            <p className="form-hint">No hay tareas pendientes. Crea tareas dentro de cada evento.</p>
          ) : (
            <div className="eventos-trabajadores">
              {tareasPorTrabajador.grupos.map((g) => (
                <div className="eventos-trabajador" key={g.id}>
                  <p className="eventos-trabajador__nombre">
                    {g.nombre} <span className="pill pill--info">{g.tareas.length}</span>
                  </p>
                  <ul>
                    {g.tareas.map(({ evento, tarea }) => (
                      <li key={tarea.id}>
                        <button type="button" className="eventos-tarea-link" onClick={() => setSeleccionado(evento)}>
                          {tarea.titulo}
                        </button>
                        <small>{evento.titulo} · {fechaLarga(evento.fecha)}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {tareasPorTrabajador.sinAsignar.length > 0 && (
                <div className="eventos-trabajador eventos-trabajador--libre">
                  <p className="eventos-trabajador__nombre">
                    Sin asignar <span className="pill pill--warn">{tareasPorTrabajador.sinAsignar.length}</span>
                  </p>
                  <ul>
                    {tareasPorTrabajador.sinAsignar.map(({ evento, tarea }) => (
                      <li key={tarea.id}>
                        <button type="button" className="eventos-tarea-link" onClick={() => setSeleccionado(evento)}>
                          {tarea.titulo}
                        </button>
                        <small>{evento.titulo} · {fechaLarga(evento.fecha)}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* -------- Próximos eventos -------- */}
      <div className="panel" style={{ marginTop: '1.2rem' }}>
        <div className="panel__head">
          <h2>Próximos eventos</h2>
        </div>
        {proximos.length === 0 ? (
          <p className="form-hint">No hay eventos en el futuro. Crea el primero con «+ Nuevo evento».</p>
        ) : (
          <ul className="eventos-lista">
            {proximos.map((e) => {
              const pendientes = e.tareas.filter((t) => !t.hecha).length
              return (
                <li key={e.id}>
                  <button type="button" className="eventos-item" onClick={() => setSeleccionado(e)}>
                    <span className={`eventos-item__tipo ${claseTipo(e.tipo)}`}>{e.tipo}</span>
                    <span className="eventos-item__cuerpo">
                      <b>{e.titulo}</b>
                      <small>
                        {fechaLarga(e.fecha)}
                        {e.hora ? ` · ${e.hora}` : ''}
                        {e.lugar ? ` · ${e.lugar}` : ''}
                      </small>
                    </span>
                    {pendientes > 0 ? (
                      <span className="pill pill--warn">{pendientes} tarea{pendientes === 1 ? '' : 's'}</span>
                    ) : (
                      <span className="pill pill--ok">Listo</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* -------- Varios eventos el mismo día: elegir cuál abrir -------- */}
      <Drawer
        open={!!diaAbierto}
        onClose={() => setDiaAbierto(null)}
        title={diaAbierto ? fechaLarga(diaAbierto) : ''}
        subtitle={`${diaAbierto ? (eventosPorDia.get(diaAbierto) ?? []).length : 0} eventos ese día`}
      >
        <ul className="eventos-lista">
          {(diaAbierto ? eventosPorDia.get(diaAbierto) ?? [] : []).map((e) => {
            const pend = e.tareas.filter((t) => !t.hecha).length
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className="eventos-item"
                  onClick={() => {
                    setDiaAbierto(null)
                    setSeleccionado(e)
                  }}
                >
                  <span className={`eventos-item__tipo ${claseTipo(e.tipo)}`}>{e.tipo}</span>
                  <span className="eventos-item__cuerpo">
                    <b>{e.titulo}</b>
                    <small>{e.hora ?? ''}{e.lugar ? ` · ${e.lugar}` : ''}</small>
                  </span>
                  {pend > 0 ? <span className="pill pill--warn">{pend}</span> : <span className="pill pill--ok">Listo</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </Drawer>

      {/* -------- Ficha del evento -------- */}
      <Drawer
        open={!!seleccionado}
        onClose={() => setSeleccionado(null)}
        title={seleccionado?.titulo ?? ''}
        subtitle={seleccionado ? `${seleccionado.tipo} · ${fechaLarga(seleccionado.fecha)}${seleccionado.hora ? ` · ${seleccionado.hora}` : ''}` : undefined}
      >
        {seleccionado && (
          <div className="ficha">
            {seleccionado.lugar && (
              <p className="form-hint">📍 {seleccionado.lugar}</p>
            )}
            {seleccionado.descripcion && <p className="portal__lead">{seleccionado.descripcion}</p>}

            <div className="assign-box">
              <label>Tareas del evento</label>
              <p className="form-hint">
                Marca lo hecho y asigna cada tarea a un trabajador (cualquier hermano del censo).
              </p>
              {seleccionado.tareas.length === 0 && (
                <p className="form-hint">Sin tareas todavía. Añade la primera abajo.</p>
              )}
              <ul className="eventos-tareas">
                {seleccionado.tareas.map((t) => (
                  <li key={t.id} className={t.hecha ? 'eventos-tarea--hecha' : ''}>
                    <label className="eventos-tarea__check">
                      <input
                        type="checkbox"
                        checked={t.hecha}
                        onChange={() => toggleTarea(seleccionado.id, t.id)}
                      />
                      <span>{t.titulo}</span>
                    </label>
                    <div className="eventos-tarea__meta">
                      <select
                        value={t.trabajadorId ?? ''}
                        onChange={(ev) => {
                          const h = hermanos.find((x) => x.id === ev.target.value) ?? null
                          asignarTarea(seleccionado.id, t.id, h)
                        }}
                      >
                        <option value="">Sin asignar</option>
                        {/* Si el asignado ya no está activo (baja o borrado), se
                            mantiene visible para no perder la asignación en silencio. */}
                        {t.trabajadorId && !hermanosActivos.some((h) => h.id === t.trabajadorId) && (
                          <option value={t.trabajadorId}>
                            {hermanoDe(t.trabajadorId)?.nombre ?? t.trabajadorNombre ?? 'Trabajador'} (ya no activo)
                          </option>
                        )}
                        {hermanosActivos.map((h) => (
                          <option key={h.id} value={h.id}>{h.nombre}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Quitar tarea"
                        onClick={() => borrarTarea(seleccionado.id, t.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="assign-box__row" style={{ marginTop: '0.6rem' }}>
                <input
                  type="text"
                  placeholder="Nueva tarea (p. ej. montar el altar)…"
                  value={nuevaTarea}
                  onChange={(e) => setNuevaTarea(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      anadirTarea(seleccionado.id)
                    }
                  }}
                />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => anadirTarea(seleccionado.id)}>
                  Añadir
                </button>
              </div>
            </div>

            <button type="button" className="ticket-cancel" onClick={() => borrarEvento(seleccionado.id)}>
              Borrar evento
            </button>
          </div>
        )}
      </Drawer>

      {/* -------- Nuevo evento -------- */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo evento"
        subtitle="Agenda de la hermandad"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="evento-form" type="submit">
              Guardar evento
            </button>
          </>
        }
      >
        <form id="evento-form" className="app-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label htmlFor="tituloEvento">Título</label>
            <input id="tituloEvento" name="titulo" type="text" required placeholder="Función principal, cabildo, ensayo…" />
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="tipoEvento">Tipo</label>
              <select id="tipoEvento" name="tipo" defaultValue="Culto">
                {TIPOS_EVENTO.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="fechaEvento">Fecha</label>
              <input id="fechaEvento" name="fecha" type="date" required />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="horaEvento">Hora (opcional)</label>
              <input id="horaEvento" name="hora" type="time" />
            </div>
            <div className="form-row">
              <label htmlFor="lugarEvento">Lugar (opcional)</label>
              <input id="lugarEvento" name="lugar" type="text" placeholder="Parroquia, casa de hermandad…" />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="descEvento">Descripción (opcional)</label>
            <textarea id="descEvento" name="descripcion" rows={3} placeholder="Detalles, horarios, avisos…" />
          </div>
          <p className="form-hint">Las tareas se añaden después, desde la ficha del evento.</p>
        </form>
      </Drawer>
    </div>
  )
}
