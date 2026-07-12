import { useMemo, useState, type FormEvent } from 'react'
import Drawer from '../../components/Drawer'
import { CLAVES_CATALOGOS, getLista } from '../../lib/catalogos'
import {
  CATEGORIAS_ENSER,
  ENSERES_INICIALES,
  type CategoriaEnser,
  type Enser,
  type EstadoConservacion,
} from '../../data/enseres'
import { formatCurrency } from '../../lib/format'
import { CLAVES_DATOS } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { enserToRow, rowToEnser } from '../../lib/db/enseres'

function hoy() {
  return new Date().toLocaleDateString('es-ES', { year: 'numeric' })
}

function estadoClass(estado: EstadoConservacion) {
  if (estado === 'Bueno') return 'pill--ok'
  if (estado === 'Regular') return 'pill--warn'
  return 'pill--err'
}

const ESTADOS_CONSERVACION: EstadoConservacion[] = ['Bueno', 'Regular', 'Necesita restauración']

export default function Inventario() {
  const [enseres, setEnseres] = useSupabaseTable<Enser>(
    'enseres',
    CLAVES_DATOS.enseres,
    ENSERES_INICIALES,
    enserToRow,
    rowToEnser,
  )
  const [query, setQuery] = useState('')
  const categorias = useMemo(() => getLista(CLAVES_CATALOGOS.categoriasEnser, CATEGORIAS_ENSER), [])
  const [filter, setFilter] = useState<'Todos' | CategoriaEnser>('Todos')
  const [selected, setSelected] = useState<Enser | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  const [prestadoDraft, setPrestadoDraft] = useState('')

  function openDetail(e: Enser) {
    setSelected(e)
    setPrestadoDraft(e.prestadoA ?? '')
  }

  const filtered = useMemo(() => {
    return enseres
      .filter((e) => (filter === 'Todos' ? true : e.categoria === filter))
      .filter((e) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return (
          e.nombre.toLowerCase().includes(q) ||
          e.ubicacion.toLowerCase().includes(q) ||
          String(e.numero).includes(q)
        )
      })
      .sort((a, b) => a.numero - b.numero)
  }, [enseres, query, filter])

  const stats = useMemo(() => {
    const total = enseres.length
    const restaurar = enseres.filter((e) => e.estadoConservacion === 'Necesita restauración').length
    const prestados = enseres.filter((e) => e.prestadoA).length
    const valorAsegurado = enseres.reduce((s, e) => s + (e.valorAsegurado ?? 0), 0)
    return { total, restaurar, prestados, valorAsegurado }
  }, [enseres])

  function guardarPrestamo() {
    if (!selected) return
    const valor = prestadoDraft.trim() || null
    setEnseres((prev) => prev.map((e) => (e.id === selected.id ? { ...e, prestadoA: valor } : e)))
    setSelected((prev) => (prev ? { ...prev, prestadoA: valor } : prev))
  }

  function actualizarConservacion(estado: EstadoConservacion) {
    if (!selected) return
    setEnseres((prev) => prev.map((e) => (e.id === selected.id ? { ...e, estadoConservacion: estado } : e)))
    setSelected((prev) => (prev ? { ...prev, estadoConservacion: estado } : prev))
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const nombre = String(data.get('nombre') ?? '').trim()
    const categoria = String(data.get('categoria') ?? '') as CategoriaEnser
    const ubicacion = String(data.get('ubicacion') ?? '').trim()
    const estadoConservacion = String(data.get('estadoConservacion') ?? 'Bueno') as EstadoConservacion
    const valorRaw = String(data.get('valorAsegurado') ?? '').trim()
    const valorAsegurado = valorRaw ? Number(valorRaw.replace(',', '.')) : null
    const notas = String(data.get('notas') ?? '').trim()
    if (!nombre || !categoria) return

    const nextNumero = Math.max(0, ...enseres.map((x) => x.numero)) + 1
    const nuevo: Enser = {
      id: nuevoId(),
      numero: nextNumero,
      nombre,
      categoria,
      ubicacion: ubicacion || 'Sin ubicar',
      estadoConservacion,
      valorAsegurado: valorAsegurado && Number.isFinite(valorAsegurado) ? valorAsegurado : null,
      prestadoA: null,
      fechaAlta: hoy(),
      notas,
    }
    setEnseres((prev) => [nuevo, ...prev])
    setJustAddedId(nuevo.id)
    setFormOpen(false)
    setFilter('Todos')
    setQuery('')
    form.reset()
    setTimeout(() => setJustAddedId(null), 3000)
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>Enseres y patrimonio</h1>
          <p className="dash-head__lead">
            {stats.total} piezas registradas · datos de ejemplo mientras conectamos la base de datos.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
          + Nueva pieza
        </button>
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Piezas registradas</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Inventario completo</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Necesitan restauración</span>
          <span className="stat-tile__value">{stats.restaurar}</span>
          <span className={`stat-tile__trend stat-tile__trend--${stats.restaurar > 0 ? 'warn' : 'ok'}`}>
            {stats.restaurar > 0 ? 'Revisar' : 'Todo en orden'}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">En préstamo</span>
          <span className="stat-tile__value">{stats.prestados}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Fuera de la casa hermandad</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Valor asegurado</span>
          <span className="stat-tile__value">{formatCurrency(stats.valorAsegurado)}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Suma de pólizas</span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por nombre, ubicación o nº"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {['Todos', ...categorias].map((f) => (
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
              <th>Pieza</th>
              <th>Ubicación</th>
              <th>Conservación</th>
              <th>Valor asegurado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr
                key={e.id}
                className={e.id === justAddedId ? 'row--flash' : undefined}
                onClick={() => openDetail(e)}
                style={{ cursor: 'pointer' }}
              >
                <td className="num">{e.numero}</td>
                <td>
                  <span className="row-person__name">{e.nombre}</span>
                  <br />
                  <span className="table-subtle">
                    {e.categoria}
                    {e.prestadoA && ' · en préstamo'}
                  </span>
                </td>
                <td>{e.ubicacion}</td>
                <td>
                  <span className={`pill ${estadoClass(e.estadoConservacion)}`}>{e.estadoConservacion}</span>
                </td>
                <td className="num">{e.valorAsegurado != null ? formatCurrency(e.valorAsegurado) : <span className="table-muted">Sin asegurar</span>}</td>
                <td>
                  <button
                    className="icon-btn"
                    title="Ver ficha"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      openDetail(e)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  No hay piezas que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ficha de la pieza */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.nombre ?? ''}
        subtitle={selected ? `Pieza nº ${selected.numero}` : undefined}
      >
        {selected && (
          <div className="ficha">
            <div className="ficha__row">
              <span className={`pill ${estadoClass(selected.estadoConservacion)}`}>{selected.estadoConservacion}</span>
              {selected.prestadoA && <span className="pill pill--warn">En préstamo</span>}
            </div>

            <dl className="ficha__list">
              <div><dt>Categoría</dt><dd>{selected.categoria}</dd></div>
              <div><dt>Ubicación</dt><dd>{selected.ubicacion}</dd></div>
              <div><dt>Dado de alta</dt><dd>{selected.fechaAlta}</dd></div>
              <div><dt>Valor asegurado</dt><dd>{selected.valorAsegurado != null ? formatCurrency(selected.valorAsegurado) : 'Sin asegurar'}</dd></div>
              {selected.notas && <div><dt>Notas</dt><dd>{selected.notas}</dd></div>}
            </dl>

            <div className="assign-box">
              <label htmlFor="conservacionSelect">Estado de conservación</label>
              <div className="assign-box__row">
                <select
                  id="conservacionSelect"
                  value={selected.estadoConservacion}
                  onChange={(e) => actualizarConservacion(e.target.value as EstadoConservacion)}
                >
                  {ESTADOS_CONSERVACION.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="assign-box">
              <label htmlFor="prestadoInput">Préstamo o cesión</label>
              <div className="assign-box__row">
                <input
                  id="prestadoInput"
                  type="text"
                  placeholder="Ej. Museo de Bellas Artes (exposición)"
                  value={prestadoDraft}
                  onChange={(e) => setPrestadoDraft(e.target.value)}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={guardarPrestamo}>
                  Guardar
                </button>
              </div>
              <p className="form-hint">
                {selected.prestadoA
                  ? 'Deja el campo vacío y guarda para registrar la devolución.'
                  : 'Sin préstamo activo: la pieza está en la casa hermandad.'}
              </p>
            </div>
          </div>
        )}
      </Drawer>

      {/* Nueva pieza */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nueva pieza"
        subtitle="Alta en el inventario"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="enser-form" type="submit">
              Guardar pieza
            </button>
          </>
        }
      >
        <form id="enser-form" className="app-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label htmlFor="nombre">Nombre de la pieza</label>
            <input id="nombre" name="nombre" type="text" placeholder="Ej. Ciriales de plata" required />
          </div>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="categoria">Categoría</label>
              <select id="categoria" name="categoria" defaultValue={categorias[0]}>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="estadoConservacion">Conservación</label>
              <select id="estadoConservacion" name="estadoConservacion" defaultValue="Bueno">
                {ESTADOS_CONSERVACION.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="ubicacion">Ubicación</label>
            <input id="ubicacion" name="ubicacion" type="text" placeholder="Ej. Casa hermandad — Almacén" />
          </div>
          <div className="form-row">
            <label htmlFor="valorAsegurado">Valor asegurado (€, opcional)</label>
            <input id="valorAsegurado" name="valorAsegurado" type="number" min="0" step="0.01" placeholder="Déjalo en blanco si no está asegurada" />
          </div>
          <div className="form-row">
            <label htmlFor="notas">Notas</label>
            <textarea id="notas" name="notas" rows={3} placeholder="Estado, procedencia, restauraciones…" />
          </div>
        </form>
      </Drawer>
    </div>
  )
}
