import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Drawer from '../../components/Drawer'
import { CLAVE_DEMO_HERMANOS, HERMANOS_INICIALES, initials, type EstadoHermano, type Hermano } from '../../data/hermanos'
import { PAPELETAS_INICIALES } from '../../data/papeletas'
import { isPlausibleIban, maskIban } from '../../lib/format'
import { getTramos, etiquetaTramo } from '../../lib/tramos'
import { repartoCompleto } from '../../lib/cortejo'
import { CLAVES_DATOS, leerPersistido } from '../../lib/persistencia'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { hermanoToRow, rowToHermano } from '../../lib/db/hermanos'
import { getCampana } from '../../lib/campana'
import { borrarDatosHermano, exportarDatosHermano, recopilarDatosHermano } from '../../lib/rgpd'
import { descargarArchivo } from '../../lib/csv'
import { useSolicitudes, saveSolicitudes, type SolicitudAlta } from '../../lib/solicitudes'

/**
 * Con Supabase conectado, crea además una cuenta real de acceso (mismo
 * correo y contraseña) para que el hermano pueda entrar en su área; sin él,
 * solo entra por el modo demostración. Devuelve el id de esa cuenta, o
 * `null` si no hay Supabase o si algo falla (el hermano se guarda igual,
 * solo que sin poder entrar hasta que se resuelva).
 */
async function crearAccesoHermano(
  email: string,
  password: string,
  dni: string,
  nombre: string,
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { tipo: 'hermano', dni, nombre },
      emailRedirectTo: `${window.location.origin}/hermano`,
    },
  })
  if (error) {
    console.error('No se pudo crear el acceso real del hermano en Supabase:', error.message)
    return null
  }
  return data.user?.id ?? null
}

function estadoClass(estado: EstadoHermano) {
  if (estado === 'Activo') return 'pill--ok'
  if (estado === 'Nuevo') return 'pill--info'
  return 'pill--off'
}

export default function Hermanos() {
  const [hermanos, setHermanos] = useSupabaseTable<Hermano>(
    'hermanos',
    CLAVES_DATOS.hermanos,
    HERMANOS_INICIALES,
    hermanoToRow,
    rowToHermano,
    'numero',
  )
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'Todos' | EstadoHermano>('Todos')
  const [selected, setSelected] = useState<Hermano | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [dniError, setDniError] = useState<string | null>(null)

  const [ibanDraft, setIbanDraft] = useState('')
  const [ibanError, setIbanError] = useState<string | null>(null)
  const [ibanSaved, setIbanSaved] = useState(false)

  const solicitudesRemotas = useSolicitudes()
  const [solicitudes, setSolicitudesState] = useState<SolicitudAlta[]>(solicitudesRemotas)
  useEffect(() => setSolicitudesState(solicitudesRemotas), [solicitudesRemotas])
  const [solicitudesOpen, setSolicitudesOpen] = useState(false)
  const pendientes = useMemo(() => solicitudes.filter((s) => s.estado === 'Pendiente'), [solicitudes])

  function actualizarSolicitudes(next: SolicitudAlta[]) {
    setSolicitudesState(next)
    saveSolicitudes(next)
  }

  async function aprobarSolicitud(sol: SolicitudAlta) {
    if (hermanos.some((h) => h.dni.toUpperCase() === sol.dni.toUpperCase())) {
      actualizarSolicitudes(solicitudes.map((s) => (s.id === sol.id ? { ...s, estado: 'Rechazada' } : s)))
      return
    }
    const nextNumero = Math.max(0, ...hermanos.map((h) => h.numero)) + 1
    const nuevo: Hermano = {
      id: nuevoId(),
      numero: nextNumero,
      nombre: sol.nombre,
      estado: 'Nuevo',
      antiguedad: new Date().getFullYear(),
      email: sol.email,
      telefono: sol.telefono || 'Sin datos',
      direccion: 'Sin datos',
      cuotaAlDia: false,
      iban: null,
      dni: sol.dni,
      claveAcceso: sol.clavePropuesta,
      authUserId: null,
    }
    nuevo.authUserId = await crearAccesoHermano(sol.email, sol.clavePropuesta, sol.dni, sol.nombre)
    setHermanos((prev) => [...prev, nuevo])
    actualizarSolicitudes(solicitudes.map((s) => (s.id === sol.id ? { ...s, estado: 'Aprobada' } : s)))
    setJustAddedId(nuevo.id)
    setTimeout(() => setJustAddedId(null), 3000)
  }

  function rechazarSolicitud(sol: SolicitudAlta) {
    actualizarSolicitudes(solicitudes.map((s) => (s.id === sol.id ? { ...s, estado: 'Rechazada' } : s)))
  }

  useEffect(() => {
    setIbanDraft(selected?.iban ?? '')
    setIbanError(null)
    setIbanSaved(false)
  }, [selected?.id])

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

  // El tramo de cada hermano no se guarda: se calcula solo a partir de su
  // número de hermano y del aforo de los tramos configurados (ver Cortejo).
  const tramos = useMemo(() => getTramos(), [])
  const hermanoDe = useMemo(() => {
    const map = new Map(hermanos.map((h) => [h.id, h]))
    return (id: string) => map.get(id)
  }, [hermanos])
  const tramoPorHermano = useMemo(() => {
    const anio = getCampana().anio
    const papeletas = leerPersistido(CLAVES_DATOS.papeletas, PAPELETAS_INICIALES).filter((p) => p.anio === anio)
    const map = new Map<string, string>()
    repartoCompleto(tramos, papeletas, hermanoDe, new Set()).forEach((a) => {
      if (!a.tramo) return
      map.set(a.hermano.id, a.estado === 'Excede aforo' ? `${etiquetaTramo(a.tramo)} (excede aforo)` : etiquetaTramo(a.tramo))
    })
    return map
  }, [tramos, hermanoDe])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const nombre = String(data.get('nombre') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    const dni = String(data.get('dni') ?? '').trim().toUpperCase()
    if (!nombre || !email || !dni) return

    if (hermanos.some((h) => h.dni.toUpperCase() === dni)) {
      setDniError(`Ya hay un hermano registrado con el DNI ${dni}.`)
      return
    }
    setDniError(null)

    const ibanRaw = String(data.get('iban') ?? '').trim()
    const iban = ibanRaw && isPlausibleIban(ibanRaw) ? ibanRaw : null

    const nextNumero = Math.max(0, ...hermanos.map((h) => h.numero)) + 1
    const nuevo: Hermano = {
      id: nuevoId(),
      numero: nextNumero,
      nombre,
      estado: 'Nuevo',
      antiguedad: new Date().getFullYear(),
      email,
      telefono: String(data.get('telefono') ?? '') || 'Sin datos',
      direccion: String(data.get('direccion') ?? '') || 'Sin datos',
      cuotaAlDia: false,
      iban,
      dni,
      claveAcceso: CLAVE_DEMO_HERMANOS,
      authUserId: null,
    }
    nuevo.authUserId = await crearAccesoHermano(email, CLAVE_DEMO_HERMANOS, dni, nombre)
    setHermanos((prev) => [...prev, nuevo])
    setJustAddedId(nuevo.id)
    setFormOpen(false)
    setFilter('Todos')
    setQuery('')
    form.reset()
    setTimeout(() => setJustAddedId(null), 3000)
  }

  function guardarIban() {
    if (!selected) return
    const trimmed = ibanDraft.trim()
    if (trimmed && !isPlausibleIban(trimmed)) {
      setIbanError('Ese IBAN no parece válido. Revísalo (ej. ES91 2100 0418 4502 0005 1332).')
      return
    }
    const nuevoIban = trimmed || null
    setHermanos((prev) => prev.map((h) => (h.id === selected.id ? { ...h, iban: nuevoIban } : h)))
    setSelected((prev) => (prev ? { ...prev, iban: nuevoIban } : prev))
    setIbanError(null)
    setIbanSaved(true)
    setTimeout(() => setIbanSaved(false), 2500)
  }

  function descargarDatosRgpd(hermano: Hermano) {
    const datos = recopilarDatosHermano(hermano.id)
    if (!datos) return
    const slug = hermano.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    descargarArchivo(`datos-${slug}.json`, exportarDatosHermano(datos), 'application/json;charset=utf-8;')
  }

  async function borrarHermanoRgpd(hermano: Hermano) {
    const ok = window.confirm(
      `Vas a borrar a ${hermano.nombre} y todos sus datos (cuotas, papeletas e incidencias). ` +
        'Esta acción ejerce el derecho de supresión (RGPD) y no se puede deshacer. ¿Continuar?',
    )
    if (!ok) return
    setHermanos(await borrarDatosHermano(hermano.id))
    setSelected(null)
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
        <div className="dash-head__actions">
          {pendientes.length > 0 && (
            <button className="btn btn-outline" onClick={() => setSolicitudesOpen(true)}>
              Solicitudes de alta ({pendientes.length})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setDniError(null); setFormOpen(true) }}>
            + Nuevo hermano
          </button>
        </div>
      </div>

      {pendientes.length > 0 && (
        <div className="banner-inline banner-inline--accent">
          {pendientes.length} persona{pendientes.length > 1 ? 's' : ''} {pendientes.length > 1 ? 'han' : 'ha'} pedido el
          alta como hermano/a desde el área del hermano.{' '}
          <button type="button" className="portal__link-btn" onClick={() => setSolicitudesOpen(true)}>
            Revisar solicitudes
          </button>
        </div>
      )}

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
                <td>
                  {tramoPorHermano.get(h.id) ?? <span className="table-muted">Sin papeleta</span>}
                </td>
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
              <div><dt>DNI / NIE</dt><dd>{selected.dni}</dd></div>
              <div><dt>Correo electrónico</dt><dd>{selected.email}</dd></div>
              <div><dt>Teléfono</dt><dd>{selected.telefono}</dd></div>
              <div><dt>Dirección</dt><dd>{selected.direccion}</dd></div>
              <div><dt>Hermano desde</dt><dd>{selected.antiguedad}</dd></div>
              <div><dt>Tramo en el cortejo</dt><dd>{tramoPorHermano.get(selected.id) ?? 'Sin papeleta este año'}</dd></div>
            </dl>
            <p className="form-hint">
              Accede a su área del hermano con este DNI y la contraseña <code>hermano123</code> (modo demostración).
            </p>

            <div className="assign-box">
              <label htmlFor="ibanHermano">
                Cuenta bancaria (para domiciliar sus cuotas)
              </label>
              <div className="assign-box__row">
                <input
                  id="ibanHermano"
                  type="text"
                  placeholder="ES00 0000 0000 0000 0000 0000"
                  value={ibanDraft}
                  onChange={(e) => {
                    setIbanDraft(e.target.value)
                    setIbanError(null)
                  }}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={guardarIban}>
                  Guardar
                </button>
              </div>
              {ibanError && <p className="form-hint form-hint--error">{ibanError}</p>}
              {ibanSaved && !ibanError && <p className="form-hint form-hint--ok">Cuenta guardada.</p>}
              {!selected.iban && !ibanDraft && !ibanError && (
                <p className="form-hint">
                  Sin cuenta registrada, sus cuotas no se pueden domiciliar todavía.
                </p>
              )}
              {selected.iban && !ibanError && ibanDraft === selected.iban && (
                <p className="form-hint">Cuenta actual: {maskIban(selected.iban)}</p>
              )}
            </div>

            <div className="assign-box">
              <label>Protección de datos (RGPD)</label>
              <p className="form-hint">
                {selected.nombre.split(' ')[0]} puede ejercer sus derechos sobre sus datos: descargar
                todo lo que la hermandad guarda de él/ella, o pedir que se supriman.
              </p>
              <div className="assign-box__row">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => descargarDatosRgpd(selected)}>
                  Descargar sus datos
                </button>
                <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => borrarHermanoRgpd(selected)}>
                  Borrar sus datos
                </button>
              </div>
              <p className="form-hint">
                La supresión borra al hermano y sus cuotas, papeletas e incidencias. Ten en cuenta que
                la normativa contable puede obligar a conservar ciertos registros; esa decisión es de
                la hermandad.
              </p>
            </div>
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
            <label htmlFor="dni">DNI / NIE</label>
            <input id="dni" name="dni" type="text" placeholder="12345678A" required />
            {dniError && <p className="form-hint form-hint--error">{dniError}</p>}
          </div>
          <div className="form-row">
            <label htmlFor="telefono">Teléfono</label>
            <input id="telefono" name="telefono" type="tel" placeholder="600 000 000" />
          </div>
          <div className="form-row">
            <label htmlFor="direccion">Dirección</label>
            <input id="direccion" name="direccion" type="text" placeholder="Calle y número" />
          </div>
          <div className="form-row">
            <label htmlFor="iban">Cuenta bancaria (opcional)</label>
            <input id="iban" name="iban" type="text" placeholder="ES00 0000 0000 0000 0000 0000" />
          </div>
          <p className="form-hint">
            Se le asignará automáticamente el siguiente número de hermano disponible y quedará en
            estado «Nuevo». Con el DNI y la contraseña provisional <code>hermano123</code> podrá
            entrar en su área del hermano. Sin cuenta bancaria, sus cuotas no podrán domiciliarse
            hasta que la añada.
          </p>
        </form>
      </Drawer>

      {/* Solicitudes de alta pedidas desde el área del hermano */}
      <Drawer
        open={solicitudesOpen}
        onClose={() => setSolicitudesOpen(false)}
        title="Solicitudes de alta"
        subtitle={`${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}`}
      >
        <div className="ficha">
          {pendientes.length === 0 ? (
            <p className="form-hint">No hay solicitudes pendientes.</p>
          ) : (
            pendientes.map((sol) => (
              <div className="assign-box" key={sol.id}>
                <div className="ficha__row">
                  <span className="pill pill--warn">Pendiente</span>
                  <span className="pill pill--off">{sol.fecha}</span>
                </div>
                <dl className="ficha__list">
                  <div><dt>Nombre</dt><dd>{sol.nombre}</dd></div>
                  <div><dt>DNI / NIE</dt><dd>{sol.dni}</dd></div>
                  <div><dt>Correo</dt><dd>{sol.email}</dd></div>
                  <div><dt>Teléfono</dt><dd>{sol.telefono || 'Sin datos'}</dd></div>
                </dl>
                <div className="assign-box__row">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => aprobarSolicitud(sol)}>
                    Aprobar y dar de alta
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => rechazarSolicitud(sol)}>
                    Rechazar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>
    </div>
  )
}
