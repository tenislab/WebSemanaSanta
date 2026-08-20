import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CalendarioMes from '../../components/CalendarioMes'
import Drawer from '../../components/Drawer'
import HermanoPicker from '../../components/HermanoPicker'
import { esRol, hermanosAsignables, personalAsignable, rolesAsignables, type PersonaAsignable } from '../../lib/asignables'
import { useEtiquetas } from '../../lib/etiquetas'
import { CARGOS } from '../../data/documentos'
import { getPersonal } from '../../lib/personal'
import { useAuth } from '../../context/AuthContext'
import {
  EVENTOS_INICIALES,
  REPETICIONES,
  SIN_REPETICION,
  TIPOS_EVENTO,
  textoRepeticion,
  type Aparicion,
  type Evento,
  type Repeticion,
  type TareaEvento,
  type TipoEvento,
} from '../../data/eventos'
import { HERMANOS_INICIALES } from '../../data/hermanos'
import { CLAVES_DATOS, leerDatos } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { eventoToRow, rowToEvento } from '../../lib/db/eventos'
import { claseTipo, fechaLarga, iso } from '../../lib/calendario'

export default function Eventos() {
  const [eventos, setEventos] = useSupabaseTable<Evento>(
    'eventos',
    CLAVES_DATOS.eventos,
    EVENTOS_INICIALES,
    eventoToRow,
    rowToEvento,
  )
  const { user } = useAuth()
  const hermanos = useMemo(() => leerDatos(CLAVES_DATOS.hermanos, HERMANOS_INICIALES), [])
  const hermanosActivos = useMemo(() => hermanos.filter((h) => h.estado !== 'Baja'), [hermanos])
  const hermanoDe = useMemo(() => {
    const map = new Map(hermanos.map((h) => [h.id, h]))
    return (id: string | null) => (id ? map.get(id) : undefined)
  }, [hermanos])
  // Una tarea puede recaer en un hermano del censo o en alguien del personal
  // con acceso al panel (secretaría, tesorería…), que no tiene número.
  const personal = useMemo(() => getPersonal(), [])
  const [etiquetas] = useEtiquetas()
  // Primero los cargos y los grupos: muchas tareas son «de secretaría» o «de
  // los costaleros», y buscar un nombre concreto para eso sobra.
  const asignables = useMemo(
    () => [
      ...rolesAsignables(CARGOS, etiquetas),
      ...personalAsignable(personal),
      ...hermanosAsignables(hermanosActivos),
    ],
    [personal, hermanosActivos, etiquetas],
  )
  /** Cómo se llama el asignado de una tarea, esté donde esté. */
  const nombreDeTrabajador = useCallback(
    (t: TareaEvento) =>
      hermanoDe(t.trabajadorId)?.nombre
      ?? personal.find((m) => m.id === t.trabajadorId)?.nombre
      ?? t.trabajadorNombre,
    [hermanoDe, personal],
  )

  const ahora = new Date()
  const [seleccionado, setSeleccionado] = useState<Evento | null>(null)
  /** Día abierto en el calendario, cuando tiene más de un evento. */
  const [diaAbierto, setDiaAbierto] = useState<{ fecha: string; lista: Aparicion[] } | null>(null)
  /** Mes al que salta el calendario tras crear un evento. */
  const [saltarA, setSaltarA] = useState<string | undefined>(undefined)
  const [formOpen, setFormOpen] = useState(false)
  // La paleta de comandos (Ctrl+K) manda aquí con ?nuevo=1 para crear un
  // evento sin tener que buscar el botón.
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    if (params.get('nuevo') === null) return
    setFormOpen(true)
    setParams({}, { replace: true })
  }, [params, setParams])
  const [nuevaTarea, setNuevaTarea] = useState('')
  const [repNueva, setRepNueva] = useState<Repeticion>(SIN_REPETICION)

  const hoyIso = iso(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())

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

  /**
   * Las tareas de quien está usando la aplicación. Se busca por su cuenta de
   * personal y, si además es hermano, por su correo en el censo: el mismo
   * secretario puede tener tareas asignadas de las dos formas.
   */
  const misTareas = useMemo(() => {
    const personalId = String(user?.user_metadata?.personalId ?? '')
    const correo = (user?.email ?? '').trim().toLowerCase()
    const yoHermano = correo ? hermanos.find((h) => h.email.trim().toLowerCase() === correo) : undefined
    // También lo que le toca por su CARGO o por sus grupos: una tarea «de
    // secretaría» es de quien sea secretario, sin poner su nombre.
    const miCargo = personal.find((m) => m.id === personalId)?.cargo
    const misEtiquetas = yoHermano?.etiquetas ?? []
    const mios = new Set([
      personalId,
      yoHermano?.id,
      miCargo && `rol:cargo:${miCargo}`,
      ...misEtiquetas.map((e) => `rol:etiqueta:${e}`),
    ].filter(Boolean) as string[])
    if (mios.size === 0) return []
    return [...eventos]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .flatMap((e) => e.tareas.filter((t) => !t.hecha && t.trabajadorId && mios.has(t.trabajadorId)).map((t) => ({ evento: e, tarea: t })))
  }, [eventos, hermanos, personal, user])
  const nombreUsuario = String(user?.user_metadata?.nombre ?? '').split(' ')[0] || 'compañero'

  /** Tareas pendientes agrupadas por trabajador (los sin asignar, al final). */
  const tareasPorTrabajador = useMemo(() => {
    const grupos = new Map<string, { id: string; nombre: string; tareas: { evento: Evento; tarea: TareaEvento }[] }>()
    const sinAsignar: { evento: Evento; tarea: TareaEvento }[] = []
    // (el tipo explícito de arriba hace falta: sin él TS lo infiere como never[])
    const ordenados = [...eventos].sort((a, b) => a.fecha.localeCompare(b.fecha))
    ordenados.forEach((e) => {
      e.tareas.forEach((t) => {
        if (t.hecha) return
        if (!t.trabajadorId) {
          sinAsignar.push({ evento: e, tarea: t })
          return
        }
        const nombre = nombreDeTrabajador(t) ?? 'Trabajador'
        const g = grupos.get(t.trabajadorId) ?? { id: t.trabajadorId, nombre, tareas: [] }
        g.tareas.push({ evento: e, tarea: t })
        grupos.set(t.trabajadorId, g)
      })
    })
    return { grupos: [...grupos.values()].sort((a, b) => b.tareas.length - a.tareas.length), sinAsignar }
  }, [eventos, nombreDeTrabajador])

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

  function asignarTarea(eventoId: string, tareaId: string, trabajador: PersonaAsignable | null) {
    const evento = eventos.find((e) => e.id === eventoId)
    if (!evento) return
    aplicarEvento(eventoId, {
      tareas: evento.tareas.map((t) =>
        t.id === tareaId
          ? {
              ...t,
              trabajadorId: trabajador?.id ?? null,
              trabajadorNombre: trabajador?.nombre,
              // Se guarda el nombre y el tipo porque el asignado puede no estar
              // en el censo: el secretario o el tesorero entran con su cuenta
              // del panel y no tienen número de hermano.
              trabajadorTipo: !trabajador
                ? undefined
                : esRol(trabajador.id) ? 'rol'
                  : personal.some((m) => m.id === trabajador.id) ? 'personal' : 'hermano',
            }
          : t,
      ),
    })
  }

  /** Abre la ficha de un evento dejando limpio el campo de tarea nueva. */
  function abrirEvento(e: Evento | null) {
    setSeleccionado(e)
    // Si no, lo escrito y no añadido en un evento aparecía en el siguiente y se
    // creaba la tarea donde no era.
    setNuevaTarea('')
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
      repeticion: repNueva.tipo === 'no' ? undefined : repNueva,
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
    setSaltarA(fecha)
    abrirEvento(nuevo)
  }

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
        <div className="panel">
          <CalendarioMes
            eventos={eventos}
            titulos
            leyenda
            saltarA={saltarA}
            onAbrirDia={(fecha, delDia) => {
              if (delDia.length === 1) abrirEvento(delDia[0].evento)
              else setDiaAbierto({ fecha, lista: delDia })
            }}
          />
        </div>

        {/* -------- Mis tareas -------- */}
        {misTareas.length > 0 && (
          <div className="panel panel--mias">
            <div className="panel__head">
              <h2>Mis tareas</h2>
              <span className="pill pill--warn">{misTareas.length}</span>
            </div>
            <p className="form-hint">
              Lo que te toca a ti, {nombreUsuario}. Marca la casilla cuando esté hecho.
            </p>
            <ul className="eventos-mias">
              {misTareas.map(({ evento, tarea }) => (
                <li key={tarea.id}>
                  <label className="checkbox">
                    <input type="checkbox" checked={tarea.hecha} onChange={() => toggleTarea(evento.id, tarea.id)} />
                    <span>{tarea.titulo}</span>
                  </label>
                  <button type="button" className="eventos-tarea-link" onClick={() => abrirEvento(evento)}>
                    {evento.titulo} · {fechaLarga(evento.fecha)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

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
                        <button type="button" className="eventos-tarea-link" onClick={() => abrirEvento(evento)}>
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
                        <button type="button" className="eventos-tarea-link" onClick={() => abrirEvento(evento)}>
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
                  <button type="button" className="eventos-item" onClick={() => abrirEvento(e)}>
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
        title={diaAbierto ? fechaLarga(diaAbierto.fecha) : ''}
        subtitle={`${diaAbierto?.lista.length ?? 0} eventos ese día`}
      >
        <ul className="eventos-lista">
          {(diaAbierto?.lista ?? []).map(({ evento: e, vuelta }) => {
            const pend = e.tareas.filter((t) => !t.hecha).length
            return (
              <li key={`${e.id}-${vuelta}`}>
                <button
                  type="button"
                  className="eventos-item"
                  onClick={() => {
                    setDiaAbierto(null)
                    abrirEvento(e)
                  }}
                >
                  <span className={`eventos-item__tipo ${claseTipo(e.tipo)}`}>{e.tipo}</span>
                  <span className="eventos-item__cuerpo">
                    <b>{e.titulo}</b>
                    <small>
                      {e.hora ?? ''}{e.lugar ? ` · ${e.lugar}` : ''}
                      {vuelta > 0 && ' · se repite'}
                    </small>
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
        onClose={() => abrirEvento(null)}
        title={seleccionado?.titulo ?? ''}
        subtitle={seleccionado ? `${seleccionado.tipo} · ${fechaLarga(seleccionado.fecha)}${seleccionado.hora ? ` · ${seleccionado.hora}` : ''}` : undefined}
      >
        {seleccionado && (
          <div className="ficha">
            {seleccionado.lugar && (
              <p className="form-hint">📍 {seleccionado.lugar}</p>
            )}
            {seleccionado.descripcion && <p className="portal__lead">{seleccionado.descripcion}</p>}

            {/* Repetición: se ve y se cambia desde la propia ficha. */}
            <div className="assign-box">
              <label htmlFor="repFicha">Repetición</label>
              <select
                id="repFicha"
                value={(seleccionado.repeticion ?? SIN_REPETICION).tipo}
                onChange={(e) => {
                  const tipo = e.target.value as Repeticion['tipo']
                  const base = seleccionado.repeticion ?? SIN_REPETICION
                  aplicarEvento(seleccionado.id, { repeticion: tipo === 'no' ? undefined : { ...base, tipo } })
                }}
              >
                {REPETICIONES.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              {seleccionado.repeticion && seleccionado.repeticion.tipo !== 'no' && (
                <>
                  <div className="form-grid-2" style={{ marginTop: '0.6rem' }}>
                    <div className="form-row">
                      <label htmlFor="repFichaCada">Cada</label>
                      <input
                        id="repFichaCada"
                        type="number"
                        min={1}
                        max={99}
                        value={seleccionado.repeticion.cada}
                        onChange={(e) => aplicarEvento(seleccionado.id, {
                          repeticion: { ...seleccionado.repeticion!, cada: Math.max(1, Number(e.target.value) || 1) },
                        })}
                      />
                    </div>
                    <div className="form-row">
                      <label htmlFor="repFichaHasta">Hasta (vacío = siempre)</label>
                      <input
                        id="repFichaHasta"
                        type="date"
                        value={seleccionado.repeticion.hasta}
                        onChange={(e) => aplicarEvento(seleccionado.id, {
                          repeticion: { ...seleccionado.repeticion!, hasta: e.target.value },
                        })}
                      />
                    </div>
                  </div>
                  <p className="form-hint">{textoRepeticion(seleccionado.repeticion)}.</p>
                </>
              )}
            </div>

            <div className="assign-box">
              <label>Tareas del evento</label>
              <p className="form-hint">
                Marca lo hecho y asigna cada tarea a quien la lleve: un hermano del censo, alguien
                del personal con acceso al panel, o un cargo entero.
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
                      {/* Buscador, no lista: con un censo de verdad son cientos de
                          nombres y un desplegable no hay quien lo use. */}
                      <HermanoPicker
                        hermanos={asignables}
                        valorId={t.trabajadorId}
                        onSelect={(h) => asignarTarea(seleccionado.id, t.id, h)}
                        placeholder="Buscar persona…"
                        textoVacio="Sin asignar"
                        nombreFueraDeLista={nombreDeTrabajador(t)}
                      />
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

          {/* Repetición: la mayoría de los actos de una hermandad vuelven. */}
          <div className="assign-box">
            <label htmlFor="repEvento">¿Se repite?</label>
            <select
              id="repEvento"
              value={repNueva.tipo}
              onChange={(e) => setRepNueva((r) => ({ ...r, tipo: e.target.value as Repeticion['tipo'] }))}
            >
              {REPETICIONES.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
            <p className="form-hint">{REPETICIONES.find((r) => r.id === repNueva.tipo)?.nota}</p>
            {repNueva.tipo !== 'no' && (
              <div className="form-grid-2" style={{ marginTop: '0.6rem' }}>
                <div className="form-row">
                  <label htmlFor="repCada">Cada</label>
                  <div className="assign-box__row">
                    <input
                      id="repCada"
                      type="number"
                      min={1}
                      max={99}
                      value={repNueva.cada}
                      onChange={(e) => setRepNueva((r) => ({ ...r, cada: Math.max(1, Number(e.target.value) || 1) }))}
                      style={{ maxWidth: '5rem' }}
                    />
                    <span className="table-subtle">
                      {{ diaria: 'días', semanal: 'semanas', mensual: 'meses', anual: 'años' }[repNueva.tipo]}
                    </span>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="repHasta">Hasta (vacío = siempre)</label>
                  <input
                    id="repHasta"
                    type="date"
                    value={repNueva.hasta}
                    onChange={(e) => setRepNueva((r) => ({ ...r, hasta: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <p className="form-hint">Las tareas se añaden después, desde la ficha del evento.</p>
        </form>
      </Drawer>
    </div>
  )
}
