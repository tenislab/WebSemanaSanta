import { useMemo, useState, type FormEvent } from 'react'
import Drawer from '../../components/Drawer'

type Estado = 'Activo' | 'Nuevo' | 'Baja'

interface Hermano {
  id: string
  numero: number
  nombre: string
  estado: Estado
  antiguedad: number
  email: string
  telefono: string
  direccion: string
  tramo: string
  cuotaAlDia: boolean
}

const HERMANOS_INICIALES: Hermano[] = [
  { id: 'h1', numero: 89, nombre: 'Ana Sánchez del Río', estado: 'Activo', antiguedad: 1991, email: 'ana.sanchez@example.com', telefono: '622 104 558', direccion: 'C/ Alfarería, 12', tramo: 'Cruz de guía', cuotaAlDia: true },
  { id: 'h2', numero: 214, nombre: 'María Reyes Ortega', estado: 'Activo', antiguedad: 1998, email: 'maria.reyes@example.com', telefono: '655 302 119', direccion: 'C/ Feria, 44', tramo: 'Cirio 3º tramo', cuotaAlDia: true },
  { id: 'h3', numero: 340, nombre: 'Juan Luis Cabrera', estado: 'Activo', antiguedad: 2004, email: 'juanluis.cabrera@example.com', telefono: '611 887 220', direccion: 'Avda. de la Palmera, 8', tramo: 'Insignias', cuotaAlDia: false },
  { id: 'h4', numero: 501, nombre: 'Francisco Gómez Nieto', estado: 'Activo', antiguedad: 2012, email: 'fran.gomez@example.com', telefono: '699 445 011', direccion: 'C/ Betis, 21', tramo: 'Cirio 7º tramo', cuotaAlDia: false },
  { id: 'h5', numero: 612, nombre: 'Carmen Pérez Luna', estado: 'Activo', antiguedad: 2016, email: 'carmen.perez@example.com', telefono: '633 210 774', direccion: 'C/ Sierpes, 3', tramo: 'Música', cuotaAlDia: true },
  { id: 'h6', numero: 58, nombre: 'Antonio Vega Morales', estado: 'Baja', antiguedad: 1985, email: 'antonio.vega@example.com', telefono: '600 112 334', direccion: 'C/ San Jacinto, 15', tramo: 'Sin asignar', cuotaAlDia: false },
  { id: 'h7', numero: 733, nombre: 'Isabel Ramírez Cortés', estado: 'Nuevo', antiguedad: 2026, email: 'isabel.ramirez@example.com', telefono: '644 908 213', direccion: 'C/ Pureza, 30', tramo: 'Sin asignar', cuotaAlDia: true },
  { id: 'h8', numero: 178, nombre: 'Manuel Jiménez Ruiz', estado: 'Activo', antiguedad: 1996, email: 'manuel.jimenez@example.com', telefono: '677 554 902', direccion: 'C/ Castilla, 61', tramo: 'Cruz de guía', cuotaAlDia: true },
  { id: 'h9', numero: 425, nombre: 'Lucía Fernández Soto', estado: 'Activo', antiguedad: 2007, email: 'lucia.fernandez@example.com', telefono: '688 337 145', direccion: 'C/ Rodrigo de Triana, 9', tramo: 'Cirio 3º tramo', cuotaAlDia: true },
  { id: 'h10', numero: 690, nombre: 'Pedro Molina Aguilar', estado: 'Activo', antiguedad: 2014, email: 'pedro.molina@example.com', telefono: '612 776 480', direccion: 'C/ Evangelista, 18', tramo: 'Insignias', cuotaAlDia: false },
  { id: 'h11', numero: 731, nombre: 'Rocío Domínguez Vargas', estado: 'Nuevo', antiguedad: 2026, email: 'rocio.dominguez@example.com', telefono: '691 220 667', direccion: 'C/ Pagés del Corro, 55', tramo: 'Sin asignar', cuotaAlDia: true },
  { id: 'h12', numero: 302, nombre: 'José Antonio Reina', estado: 'Activo', antiguedad: 2001, email: 'joseantonio.reina@example.com', telefono: '666 803 512', direccion: 'C/ Dos de Mayo, 7', tramo: 'Cirio 7º tramo', cuotaAlDia: true },
]

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

function estadoClass(estado: Estado) {
  if (estado === 'Activo') return 'pill--ok'
  if (estado === 'Nuevo') return 'pill--info'
  return 'pill--off'
}

export default function Hermanos() {
  const [hermanos, setHermanos] = useState<Hermano[]>(HERMANOS_INICIALES)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'Todos' | Estado>('Todos')
  const [selected, setSelected] = useState<Hermano | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return hermanos
      .filter((h) => (filter === 'Todos' ? true : h.estado === filter))
      .filter((h) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return h.nombre.toLowerCase().includes(q) || String(h.numero).includes(q)
      })
      .sort((a, b) => a.numero - b.numero)
  }, [hermanos, query, filter])

  const stats = useMemo(() => {
    const total = hermanos.length
    const activos = hermanos.filter((h) => h.estado === 'Activo').length
    const nuevos = hermanos.filter((h) => h.estado === 'Nuevo').length
    const pendientes = hermanos.filter((h) => !h.cuotaAlDia).length
    return { total, activos, nuevos, pendientes }
  }, [hermanos])

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const nombre = String(data.get('nombre') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    if (!nombre || !email) return

    const nextNumero = Math.max(0, ...hermanos.map((h) => h.numero)) + 1
    const nuevo: Hermano = {
      id: `h-${Date.now()}`,
      numero: nextNumero,
      nombre,
      estado: 'Nuevo',
      antiguedad: new Date().getFullYear(),
      email,
      telefono: String(data.get('telefono') ?? '') || 'Sin datos',
      direccion: String(data.get('direccion') ?? '') || 'Sin datos',
      tramo: 'Sin asignar',
      cuotaAlDia: false,
    }
    setHermanos((prev) => [...prev, nuevo])
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
          <p className="eyebrow">Hermanos</p>
          <h1>Censo de la hermandad</h1>
          <p className="dash-head__lead">
            {stats.total} hermanos registrados · datos de ejemplo mientras conectamos la base de
            datos.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
          + Nuevo hermano
        </button>
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Total hermanos</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Censo completo</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Activos</span>
          <span className="stat-tile__value">{stats.activos}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">Al corriente de baja</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Altas nuevas</span>
          <span className="stat-tile__value">{stats.nuevos}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Este ejercicio</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Cuota pendiente</span>
          <span className="stat-tile__value">{stats.pendientes}</span>
          <span className="stat-tile__trend stat-tile__trend--warn">Por regularizar</span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por nombre o número de hermano"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {(['Todos', 'Activo', 'Nuevo', 'Baja'] as const).map((f) => (
            <button
              key={f}
              className={`chip${filter === f ? ' chip--active' : ''}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === 'Todos' ? 'Todos' : f === 'Activo' ? 'Activos' : f === 'Nuevo' ? 'Nuevos' : 'Baja'}
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
              <th>Tramo</th>
              <th>Estado</th>
              <th>Cuota</th>
              <th>Antigüedad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h) => (
              <tr
                key={h.id}
                className={h.id === justAddedId ? 'row--flash' : undefined}
                onClick={() => setSelected(h)}
                style={{ cursor: 'pointer' }}
              >
                <td className="num">{h.numero}</td>
                <td>
                  <div className="row-person">
                    <span className="row-avatar">{initials(h.nombre)}</span>
                    <span>
                      <span className="row-person__name">{h.nombre}</span>
                      <span className="row-person__sub">{h.email}</span>
                    </span>
                  </div>
                </td>
                <td>{h.tramo}</td>
                <td>
                  <span className={`pill ${estadoClass(h.estado)}`}>{h.estado}</span>
                </td>
                <td>
                  <span className={`pill ${h.cuotaAlDia ? 'pill--ok' : 'pill--warn'}`}>
                    {h.cuotaAlDia ? 'Al día' : 'Pendiente'}
                  </span>
                </td>
                <td className="num">{h.antiguedad}</td>
                <td>
                  <button
                    className="icon-btn"
                    title="Ver ficha"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelected(h)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty">
                  No hay hermanos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ficha individual */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.nombre ?? ''}
        subtitle={selected ? `Hermano nº ${selected.numero}` : undefined}
      >
        {selected && (
          <div className="ficha">
            <div className="ficha__row">
              <span className={`pill ${estadoClass(selected.estado)}`}>{selected.estado}</span>
              <span className={`pill ${selected.cuotaAlDia ? 'pill--ok' : 'pill--warn'}`}>
                {selected.cuotaAlDia ? 'Cuota al día' : 'Cuota pendiente'}
              </span>
            </div>

            <dl className="ficha__list">
              <div><dt>Correo electrónico</dt><dd>{selected.email}</dd></div>
              <div><dt>Teléfono</dt><dd>{selected.telefono}</dd></div>
              <div><dt>Dirección</dt><dd>{selected.direccion}</dd></div>
              <div><dt>Hermano desde</dt><dd>{selected.antiguedad}</dd></div>
              <div><dt>Tramo en el cortejo</dt><dd>{selected.tramo}</dd></div>
            </dl>

            <p className="ficha__note">
              Este es un módulo de ejemplo: los documentos, el histórico de papeletas y el
              detalle de pagos de {selected.nombre.split(' ')[0]} se conectarán en próximas fases.
            </p>
          </div>
        )}
      </Drawer>

      {/* Alta de hermano */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo hermano"
        subtitle="Alta en el censo"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="hermano-form" type="submit">
              Guardar hermano
            </button>
          </>
        }
      >
        <form id="hermano-form" className="app-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label htmlFor="nombre">Nombre y apellidos</label>
            <input id="nombre" name="nombre" type="text" placeholder="Nombre completo" required />
          </div>
          <div className="form-row">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" placeholder="correo@ejemplo.com" required />
          </div>
          <div className="form-row">
            <label htmlFor="telefono">Teléfono</label>
            <input id="telefono" name="telefono" type="tel" placeholder="600 000 000" />
          </div>
          <div className="form-row">
            <label htmlFor="direccion">Dirección</label>
            <input id="direccion" name="direccion" type="text" placeholder="Calle y número" />
          </div>
          <p className="fineprint" style={{ textAlign: 'left' }}>
            Se le asignará automáticamente el siguiente número de hermano disponible y quedará en
            estado «Nuevo».
          </p>
        </form>
      </Drawer>
    </div>
  )
}
