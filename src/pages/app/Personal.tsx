import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Drawer from '../../components/Drawer'
import { CARGOS, type Cargo } from '../../data/documentos'
import { CLAVE_PERSONAL, getPersonal, type MiembroPersonal } from '../../lib/personal'
import { MODULOS, usePermisosPorCargo, savePermisosPorCargo } from '../../lib/permisos'
import { nuevoId, useSupabaseTable } from '../../lib/supabaseSync'
import { personalToRow, rowToPersonal } from '../../lib/db/personal'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function Personal() {
  const { user } = useAuth()
  const nombreHermandad = (user?.user_metadata?.hermandad as string | undefined) ?? 'Tu hermandad'

  const [personal, setPersonal] = useSupabaseTable<MiembroPersonal>(
    'personal',
    CLAVE_PERSONAL,
    getPersonal(),
    personalToRow,
    rowToPersonal,
  )
  const [selected, setSelected] = useState<MiembroPersonal | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const permisosRemotos = usePermisosPorCargo()
  const [permisos, setPermisos] = useState<Record<Cargo, string[]>>(permisosRemotos)
  const [permisosTocado, setPermisosTocado] = useState(false)
  useEffect(() => {
    if (!permisosTocado) setPermisos(permisosRemotos)
  }, [permisosRemotos, permisosTocado])
  const [permisosSaved, setPermisosSaved] = useState(false)

  const stats = useMemo(() => {
    const total = personal.length
    const activos = personal.filter((p) => p.activo).length
    const cargosEnUso = new Set(personal.map((p) => p.cargo)).size
    return { total, activos, cargosEnUso }
  }, [personal])

  function abrirNuevo() {
    setError(null)
    setFormOpen(true)
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const nombre = String(data.get('nombre') ?? '').trim()
    const email = String(data.get('email') ?? '').trim().toLowerCase()
    const clave = String(data.get('clave') ?? '').trim()
    const cargo = String(data.get('cargo') ?? '') as Cargo

    if (!nombre || !email || !cargo) return
    if (clave.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (personal.some((p) => p.email.toLowerCase() === email)) {
      setError('Ya hay un acceso de personal con ese correo.')
      return
    }

    const nuevo: MiembroPersonal = {
      id: nuevoId(),
      nombre,
      email,
      clave,
      cargo,
      activo: true,
      fechaAlta: new Date().toISOString().slice(0, 10),
      authUserId: null,
    }
    // Con Supabase conectado, esto le crea además una cuenta real de acceso
    // (mismo correo y contraseña); sin él, solo entra por el modo demostración.
    // El id de esa cuenta se guarda en authUserId: sin él, las políticas de
    // seguridad por cargo no saben qué módulos le corresponden.
    if (isSupabaseConfigured && supabase) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: clave,
        options: {
          data: { hermandad: nombreHermandad, nombre, cargo },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (signUpError) {
        console.error('No se pudo crear el acceso real en Supabase:', signUpError.message)
      } else {
        nuevo.authUserId = signUpData.user?.id ?? null
      }
    }
    setPersonal([nuevo, ...personal])
    setFormOpen(false)
    setError(null)
    form.reset()
  }

  function toggleActivo(id: string) {
    setPersonal(personal.map((p) => (p.id === id ? { ...p, activo: !p.activo } : p)))
    setSelected((s) => (s && s.id === id ? { ...s, activo: !s.activo } : s))
  }

  function eliminar(id: string) {
    setPersonal(personal.filter((p) => p.id !== id))
    setSelected(null)
  }

  function togglePermiso(cargo: Cargo, moduloId: string) {
    setPermisos((prev) => {
      const actuales = prev[cargo] ?? []
      const siguiente = actuales.includes(moduloId)
        ? actuales.filter((m) => m !== moduloId)
        : [...actuales, moduloId]
      return { ...prev, [cargo]: siguiente }
    })
    setPermisosTocado(true)
    setPermisosSaved(false)
  }

  async function handleSavePermisos() {
    await savePermisosPorCargo(permisos)
    setPermisosTocado(false)
    setPermisosSaved(true)
    setTimeout(() => setPermisosSaved(false), 3000)
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Personal</p>
          <h1>Personal y permisos</h1>
          <p className="dash-head__lead">
            {stats.total} acceso{stats.total === 1 ? '' : 's'} además del titular · cada cargo ve
            solo los módulos que le permitas.
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo acceso
        </button>
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Accesos totales</span>
          <span className="stat-tile__value">{stats.total}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Además del titular</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Activos</span>
          <span className="stat-tile__value">{stats.activos}</span>
          <span className="stat-tile__trend stat-tile__trend--ok">Pueden entrar ahora</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Cargos en uso</span>
          <span className="stat-tile__value">{stats.cargosEnUso}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">de {CARGOS.length} posibles</span>
        </div>
      </section>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Cargo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {personal.map((p) => (
              <tr key={p.id} onClick={() => setSelected(p)} style={{ cursor: 'pointer' }}>
                <td className="row-person__name">{p.nombre}</td>
                <td className="table-subtle">{p.email}</td>
                <td>
                  <span className="pill pill--info">{p.cargo}</span>
                </td>
                <td>
                  <span className={`pill ${p.activo ? 'pill--ok' : 'pill--off'}`}>
                    {p.activo ? 'Activo' : 'Desactivado'}
                  </span>
                </td>
                <td>
                  <button
                    className="icon-btn"
                    title={p.activo ? 'Desactivar acceso' : 'Activar acceso'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleActivo(p.id)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {personal.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  Todavía no has dado de alta a nadie del personal. El titular de la hermandad
                  siempre tiene acceso completo, sin necesidad de estar en esta lista.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="settings-card" style={{ marginTop: '1.6rem' }}>
        <div className="settings-card__head">
          <h2 className="settings-card__title">Permisos por cargo</h2>
        </div>
        <p className="form-hint">
          Marca los módulos que cada cargo puede ver al iniciar sesión. El titular de la
          hermandad (quien creó la cuenta) siempre tiene acceso completo, tenga o no un cargo
          asignado.
        </p>
        <div className="table-card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Cargo</th>
                {MODULOS.map((m) => (
                  <th key={m.id} style={{ textAlign: 'center' }}>
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CARGOS.map((cargo) => (
                <tr key={cargo}>
                  <td>
                    <b>{cargo}</b>
                  </td>
                  {MODULOS.map((m) => (
                    <td key={m.id} style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={(permisos[cargo] ?? []).includes(m.id)}
                        onChange={() => togglePermiso(cargo, m.id)}
                        aria-label={`${cargo} · ${m.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="settings-actions">
          {permisosSaved && <span className="alert-item alert-item--ok">Permisos guardados</span>}
          <button type="button" className="btn btn-primary" onClick={handleSavePermisos}>
            Guardar permisos
          </button>
        </div>
      </section>

      {/* Ficha de un acceso de personal */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.nombre ?? ''}
        subtitle={selected?.cargo}
      >
        {selected && (
          <div className="ficha">
            <div className="ficha__row">
              <span className={`pill ${selected.activo ? 'pill--ok' : 'pill--off'}`}>
                {selected.activo ? 'Activo' : 'Desactivado'}
              </span>
            </div>
            <dl className="ficha__list">
              <div>
                <dt>Correo electrónico</dt>
                <dd>{selected.email}</dd>
              </div>
              <div>
                <dt>Cargo</dt>
                <dd>{selected.cargo}</dd>
              </div>
              <div>
                <dt>Alta</dt>
                <dd>{selected.fechaAlta}</dd>
              </div>
            </dl>
            <p className="form-hint">
              Entra desde <code>/login</code> con este correo y su contraseña. Verá solo los
              módulos marcados para {selected.cargo} en la tabla de permisos.
            </p>
            <div className="assign-box__row">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => toggleActivo(selected.id)}>
                {selected.activo ? 'Desactivar acceso' : 'Activar acceso'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm rgpd-borrar" onClick={() => eliminar(selected.id)}>
                Eliminar acceso
              </button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Nuevo acceso de personal */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo acceso de personal"
        subtitle="Personal"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="personal-form" type="submit">
              Guardar
            </button>
          </>
        }
      >
        <form id="personal-form" className="app-form" onSubmit={handleCreate}>
          {error && (
            <div className="banner banner--error" role="alert">
              {error}
            </div>
          )}
          <div className="form-row">
            <label htmlFor="nombre">Nombre y apellidos</label>
            <input id="nombre" name="nombre" type="text" placeholder="Ej. María López" required />
          </div>
          <div className="form-row">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" placeholder="tesorero@tuhermandad.org" required />
          </div>
          <div className="form-row">
            <label htmlFor="clave">Contraseña de acceso</label>
            <input id="clave" name="clave" type="text" placeholder="Mín. 6 caracteres" required />
          </div>
          <div className="form-row">
            <label htmlFor="cargo">Cargo</label>
            <select id="cargo" name="cargo" defaultValue={CARGOS[2]}>
              {CARGOS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <p className="form-hint">
            Los módulos que verá se deciden en la tabla de permisos por cargo, más abajo en esta
            misma página.
          </p>
        </form>
      </Drawer>
    </div>
  )
}
