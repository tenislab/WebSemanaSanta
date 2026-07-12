import { useMemo, useState, type FormEvent } from 'react'
import Drawer from '../../components/Drawer'
import { CLAVES_CATALOGOS, getLista } from '../../lib/catalogos'
import {
  CANALES,
  COMUNICADOS_INICIALES,
  REDES_SOCIALES,
  SEGMENTOS,
  type Canal,
  type Comunicado,
  type EstadoComunicado,
  type RedSocial,
} from '../../data/comunicados'
import { formatDate } from '../../lib/format'
import { CLAVES_DATOS } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { comunicadoToRow, rowToComunicado, useCuentasSociales } from '../../lib/db/comunicados'

function fmt(iso: string | null) {
  if (!iso) return '—'
  return formatDate(new Date(`${iso}T00:00:00`))
}

function claseEstado(estado: EstadoComunicado) {
  if (estado === 'Enviado') return 'pill--ok'
  if (estado === 'Programado') return 'pill--warn'
  return 'pill--off'
}

const COLOR_RED: Record<RedSocial, string> = {
  Facebook: '#3b5998',
  Instagram: '#c1387c',
  X: '#14171a',
  YouTube: '#c4302b',
  TikTok: '#25b0a4',
}

const INICIAL_RED: Record<RedSocial, string> = {
  Facebook: 'f',
  Instagram: 'IG',
  X: 'X',
  YouTube: '▶',
  TikTok: '♪',
}

export default function Comunicados() {
  const [comunicados, setComunicados] = useSupabaseTable<Comunicado>(
    'comunicados',
    CLAVES_DATOS.comunicados,
    COMUNICADOS_INICIALES,
    comunicadoToRow,
    rowToComunicado,
  )
  const [cuentas, setCuentas] = useCuentasSociales()
  const canales = useMemo(() => getLista(CLAVES_CATALOGOS.canalesComunicado, CANALES), [])
  const segmentos = useMemo(() => getLista(CLAVES_CATALOGOS.segmentosComunicado, SEGMENTOS), [])
  const [query, setQuery] = useState('')
  const [filtroCanal, setFiltroCanal] = useState<'Todos' | Canal>('Todos')
  const [selected, setSelected] = useState<Comunicado | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  const [canalNuevo, setCanalNuevo] = useState<Canal>(() => canales[0] ?? 'Email')
  const [estadoNuevo, setEstadoNuevo] = useState<EstadoComunicado>('Borrador')

  const [conectando, setConectando] = useState<RedSocial | null>(null)
  const [usuarioInput, setUsuarioInput] = useState('')

  const cuentasConectadas = useMemo(() => cuentas.filter((c) => c.conectada), [cuentas])

  const filtered = useMemo(() => {
    return comunicados
      .filter((c) => (filtroCanal === 'Todos' ? true : c.canal === filtroCanal))
      .filter((c) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return (
          String(c.numero).includes(q) ||
          c.titulo.toLowerCase().includes(q) ||
          c.cuerpo.toLowerCase().includes(q) ||
          c.destinatarios.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))
  }, [comunicados, query, filtroCanal])

  const stats = useMemo(() => {
    const total = comunicados.length
    const programados = comunicados.filter((c) => c.estado === 'Programado').length
    const ahora = new Date()
    const enviadosEsteMes = comunicados.filter((c) => {
      if (c.estado !== 'Enviado' || !c.fechaEnvio) return false
      const f = new Date(`${c.fechaEnvio}T00:00:00`)
      return f.getFullYear() === ahora.getFullYear() && f.getMonth() === ahora.getMonth()
    }).length
    return { total, programados, enviadosEsteMes, redesConectadas: cuentasConectadas.length }
  }, [comunicados, cuentasConectadas])

  function abrirNuevo() {
    setCanalNuevo(canales[0] ?? 'Email')
    setEstadoNuevo('Borrador')
    setFormOpen(true)
  }

  function conectar(red: RedSocial) {
    const usuario = usuarioInput.trim() || '@hermandaddemo'
    setCuentas((prev) => prev.map((c) => (c.red === red ? { ...c, conectada: true, usuario } : c)))
    setConectando(null)
    setUsuarioInput('')
  }

  function desconectar(red: RedSocial) {
    setCuentas((prev) => prev.map((c) => (c.red === red ? { ...c, conectada: false, usuario: null } : c)))
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const titulo = String(data.get('titulo') ?? '').trim()
    const cuerpo = String(data.get('cuerpo') ?? '').trim()
    const canal = String(data.get('canal') ?? '') as Canal
    const destinatarios = String(data.get('destinatarios') ?? segmentos[0])
    const estado = String(data.get('estado') ?? 'Borrador') as EstadoComunicado
    if (!titulo || !cuerpo || !canal) return

    const redes = canal === 'Redes sociales' ? (data.getAll('redes').map((v) => String(v)) as RedSocial[]) : null
    if (canal === 'Redes sociales' && (!redes || redes.length === 0)) return

    const fechaProgramada = estado === 'Programado' ? String(data.get('fechaProgramada') ?? '') || null : null
    if (estado === 'Programado' && !fechaProgramada) return

    const hoy = new Date().toISOString().slice(0, 10)
    const nextNumero = Math.max(0, ...comunicados.map((c) => c.numero)) + 1
    const nuevo: Comunicado = {
      id: nuevoId(),
      numero: nextNumero,
      titulo,
      cuerpo,
      canal,
      redes,
      destinatarios,
      estado,
      fechaCreacion: hoy,
      fechaProgramada,
      fechaEnvio: estado === 'Enviado' ? hoy : null,
      autor: 'Tú',
      alcance: null,
    }
    setComunicados((prev) => [nuevo, ...prev])
    setJustAddedId(nuevo.id)
    setFormOpen(false)
    setFiltroCanal('Todos')
    setQuery('')
    form.reset()
    setTimeout(() => setJustAddedId(null), 3000)
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Comunicados</p>
          <h1>Avisos y difusión</h1>
          <p className="dash-head__lead">
            {stats.total} comunicados · datos de ejemplo mientras conectamos la base de datos.
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo comunicado
        </button>
      </div>

      <section className="redes-card">
        <div className="redes-card__head">
          <h2>Redes sociales conectadas</h2>
          <p className="table-subtle">
            Conexión simulada — la publicación real llegará cuando enlacemos las cuentas oficiales de la hermandad.
          </p>
        </div>
        <div className="redes-grid">
          {cuentas.map((c) => (
            <div className="red-card" key={c.red}>
              <div className="red-card__top">
                <span className="red-card__badge" style={{ background: COLOR_RED[c.red] }}>
                  {INICIAL_RED[c.red]}
                </span>
                <div className="red-card__name">
                  <b>{c.red}</b>
                  {c.conectada && <span className="table-subtle">{c.usuario}</span>}
                </div>
              </div>
              <div className="red-card__foot">
                <span className={`pill ${c.conectada ? 'pill--ok' : 'pill--off'}`}>
                  {c.conectada ? 'Conectada' : 'No conectada'}
                </span>
                {c.conectada ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => desconectar(c.red)}>
                    Desconectar
                  </button>
                ) : conectando === c.red ? (
                  <div className="red-card__connect-row">
                    <input
                      type="text"
                      placeholder="@usuario"
                      value={usuarioInput}
                      onChange={(e) => setUsuarioInput(e.target.value)}
                      autoFocus
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => conectar(c.red)}>
                      Guardar
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setConectando(c.red)
                      setUsuarioInput('')
                    }}
                  >
                    Conectar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Total comunicados</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Todos los canales</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Programados</span>
          <span className="stat-tile__value">{stats.programados}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Pendientes de enviar</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Enviados este mes</span>
          <span className="stat-tile__value">{stats.enviadosEsteMes}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">Difusión activa</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Redes conectadas</span>
          <span className="stat-tile__value">{stats.redesConectadas}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">de {cuentas.length}</span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por título, texto o destinatarios"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {['Todos', ...canales].map((f) => (
            <button
              key={f}
              className={`chip${filtroCanal === f ? ' chip--active' : ''}`}
              onClick={() => setFiltroCanal(f)}
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
              <th>Comunicado</th>
              <th>Destinatarios</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className={c.id === justAddedId ? 'row--flash' : undefined}
                onClick={() => setSelected(c)}
                style={{ cursor: 'pointer' }}
              >
                <td className="num">{c.numero}</td>
                <td>
                  <span className="row-person__name">{c.titulo}</span>
                  <br />
                  <span className="table-subtle">
                    {c.canal}
                    {c.redes && c.redes.length > 0 ? ` · ${c.redes.join(', ')}` : ''}
                  </span>
                </td>
                <td>{c.destinatarios}</td>
                <td>
                  <span className={`pill ${claseEstado(c.estado)}`}>{c.estado}</span>
                </td>
                <td className="num">{fmt(c.fechaEnvio ?? c.fechaProgramada ?? c.fechaCreacion)}</td>
                <td>
                  <button className="icon-btn" title="Ver comunicado" onClick={(e) => { e.stopPropagation(); setSelected(c) }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  No hay comunicados que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ficha del comunicado */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.titulo ?? ''}
        subtitle={selected ? `Comunicado nº ${selected.numero}` : undefined}
      >
        {selected && (
          <div className="ficha">
            <div className="ficha__row">
              <span className="pill pill--info">{selected.canal}</span>
              <span className={`pill ${claseEstado(selected.estado)}`}>{selected.estado}</span>
            </div>
            <dl className="ficha__list">
              <div>
                <dt>Mensaje</dt>
                <dd>{selected.cuerpo}</dd>
              </div>
              <div>
                <dt>Destinatarios</dt>
                <dd>{selected.destinatarios}</dd>
              </div>
              {selected.redes && selected.redes.length > 0 && (
                <div>
                  <dt>Redes sociales</dt>
                  <dd>{selected.redes.join(', ')}</dd>
                </div>
              )}
              <div>
                <dt>Creado</dt>
                <dd>{fmt(selected.fechaCreacion)} · {selected.autor}</dd>
              </div>
              {selected.fechaProgramada && (
                <div>
                  <dt>Programado para</dt>
                  <dd>{fmt(selected.fechaProgramada)}</dd>
                </div>
              )}
              {selected.fechaEnvio && (
                <div>
                  <dt>Enviado</dt>
                  <dd>{fmt(selected.fechaEnvio)}</dd>
                </div>
              )}
              {selected.alcance !== null && (
                <div>
                  <dt>Alcance</dt>
                  <dd>{selected.alcance.toLocaleString('es-ES')} personas</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </Drawer>

      {/* Nuevo comunicado */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo comunicado"
        subtitle="Comunicados"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="comunicado-form" type="submit">
              Guardar
            </button>
          </>
        }
      >
        <form id="comunicado-form" className="app-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label htmlFor="titulo">Título</label>
            <input id="titulo" name="titulo" type="text" placeholder="Ej. Convocatoria de Cabildo" required />
          </div>
          <div className="form-row">
            <label htmlFor="cuerpo">Mensaje</label>
            <textarea id="cuerpo" name="cuerpo" rows={4} placeholder="Texto del comunicado" required />
          </div>

          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="canal">Canal</label>
              <select id="canal" name="canal" value={canalNuevo} onChange={(e) => setCanalNuevo(e.target.value as Canal)}>
                {canales.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="destinatarios">Destinatarios</label>
              <select id="destinatarios" name="destinatarios" defaultValue={segmentos[0]}>
                {segmentos.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {canalNuevo === 'Redes sociales' && (
            <div className="form-row">
              <label>Publicar en</label>
              {cuentasConectadas.length === 0 ? (
                <p className="form-hint">
                  Ninguna red conectada todavía. Conecta al menos una cuenta arriba para poder publicar aquí.
                </p>
              ) : (
                <div className="archivo-cargos">
                  {REDES_SOCIALES.filter((r) => cuentasConectadas.some((c) => c.red === r)).map((r) => (
                    <label key={r} className="checkbox-row">
                      <input type="checkbox" name="redes" value={r} />
                      {r}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="form-row">
            <label htmlFor="estado">Estado</label>
            <select id="estado" name="estado" value={estadoNuevo} onChange={(e) => setEstadoNuevo(e.target.value as EstadoComunicado)}>
              <option value="Borrador">Guardar como borrador</option>
              <option value="Programado">Programar envío</option>
              <option value="Enviado">Enviar ahora</option>
            </select>
          </div>

          {estadoNuevo === 'Programado' && (
            <div className="form-row">
              <label htmlFor="fechaProgramada">Fecha de envío</label>
              <input id="fechaProgramada" name="fechaProgramada" type="date" required />
            </div>
          )}
        </form>
      </Drawer>
    </div>
  )
}
