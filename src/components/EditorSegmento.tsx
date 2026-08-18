import { useState } from 'react'
import { nuevoId } from '../lib/supabaseSync'
import { useEtiquetas } from '../lib/etiquetas'
import { useCamposPropios } from '../lib/camposPropios'
import {
  etiquetaSegmento,
  limpiarCriterios,
  mismosCriterios,
  useSesgos,
  type CriteriosSegmento,
} from '../lib/segmentacion'

/**
 * Editor de sesgos: los criterios de siempre (estado, edad, cuota, etiqueta)
 * más los campos a medida de la hermandad, y la posibilidad de **guardar el
 * sesgo con nombre** para no volver a montarlo cada año.
 *
 * Lo comparten Comunicados (a quién le llega) y Hermanos (qué se ve en la
 * lista), para que un sesgo guardado sirva en los dos sitios.
 */
export default function EditorSegmento({
  criterios,
  onChange,
  cuantos,
  /** En el censo no tiene sentido exigir correo; en un envío por email sí. */
  conFiltroEmail = true,
  onLimpiar,
}: {
  criterios: CriteriosSegmento
  onChange: (c: CriteriosSegmento) => void
  /** A cuántos hermanos alcanza ahora mismo, para enseñarlo. */
  cuantos: number
  conFiltroEmail?: boolean
  /** Vuelve al estado «sin sesgo». Cada pantalla sabe cuál es el suyo. */
  onLimpiar?: () => void
}) {
  const [etiquetas] = useEtiquetas()
  const [campos] = useCamposPropios()
  const [sesgos, setSesgos] = useSesgos()
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Se compara ignorando `soloConEmail`, que no forma parte del sesgo.
  const activo = sesgos.find((s) => mismosCriterios(
    { ...s.criterios, soloConEmail: criterios.soloConEmail },
    criterios,
  ))

  function editar(cambio: Partial<CriteriosSegmento>) {
    onChange({ ...criterios, ...cambio })
  }
  function editarCampo(campoId: string, valor: string) {
    const otros = (criterios.campos ?? []).filter((x) => x.campoId !== campoId)
    editar({ campos: valor ? [...otros, { campoId, valor }] : otros })
  }
  function valorCampo(campoId: string) {
    return (criterios.campos ?? []).find((x) => x.campoId === campoId)?.valor ?? ''
  }
  function guardar() {
    const nombre = nombreNuevo.trim()
    if (!nombre) return
    // Mismo nombre = se pisa, en vez de acumular diez «Costaleros».
    const resto = sesgos.filter((s) => s.nombre.toLowerCase() !== nombre.toLowerCase())
    // `soloConEmail` no se guarda: es cosa del canal por el que se envía, no de
    // a quién se quiere alcanzar. Si se guardara, aplicar en Comunicados un
    // sesgo hecho en el censo apagaría el filtro de correo sin avisar.
    setSesgos([...resto, { id: nuevoId(), nombre, criterios: { ...criterios, soloConEmail: false } }])
    setNombreNuevo('')
    setGuardando(false)
  }

  return (
    <div className="assign-box">
      {sesgos.length > 0 && (
        <div className="sesgos-barra">
          <span className="table-subtle">Sesgos guardados</span>
          {sesgos.map((s) => (
            <span key={s.id} className={`chip chip--toggle${activo?.id === s.id ? ' chip--on' : ''}`}>
              <button
                type="button"
                onClick={() => onChange({ ...limpiarCriterios(s.criterios), soloConEmail: criterios.soloConEmail })}
              >
                {s.nombre}
              </button>
              <button
                type="button"
                className="sesgos-barra__quitar"
                title={`Borrar «${s.nombre}»`}
                aria-label={`Borrar el sesgo ${s.nombre}`}
                onClick={() => setSesgos(sesgos.filter((x) => x.id !== s.id))}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="form-grid-2">
        <div className="form-row">
          <label>Estado</label>
          <select value={criterios.estado} onChange={(e) => editar({ estado: e.target.value as CriteriosSegmento['estado'] })}>
            <option value="Activo">Activos</option>
            <option value="Todos">Todos menos las bajas</option>
            <option value="Cualquiera">Todo el censo (bajas incluidas)</option>
            <option value="Nuevo">Nuevos</option>
            <option value="Baja">Bajas</option>
          </select>
        </div>
        <div className="form-row">
          <label>Edad</label>
          <select value={criterios.edad} onChange={(e) => editar({ edad: e.target.value as CriteriosSegmento['edad'] })}>
            <option value="Todos">Cualquier edad</option>
            <option value="Mayores">Solo mayores de edad</option>
            <option value="Menores">Solo menores de edad</option>
          </select>
        </div>
      </div>
      <div className="form-grid-2">
        <div className="form-row">
          <label>Cuota</label>
          <select value={criterios.cuota} onChange={(e) => editar({ cuota: e.target.value as CriteriosSegmento['cuota'] })}>
            <option value="Todos">Cualquiera</option>
            <option value="AlDia">Al día</option>
            <option value="Pendiente">Pendiente</option>
          </select>
        </div>
        <div className="form-row">
          <label>Etiqueta</label>
          <select value={criterios.etiqueta} onChange={(e) => editar({ etiqueta: e.target.value })}>
            <option value="">Cualquiera</option>
            {etiquetas.map((et) => <option key={et} value={et}>{et}</option>)}
          </select>
        </div>
      </div>

      {/* Los campos a medida de la hermandad también sirven para sesgar: es lo
          que los hace útiles de verdad («todos los de talla L»). */}
      {campos.length > 0 && (
        <div className="form-grid-2">
          {campos.map((c) => (
            <div className="form-row" key={c.id}>
              <label>{c.nombre}</label>
              {c.tipo === 'lista' ? (
                <select value={valorCampo(c.id)} onChange={(e) => editarCampo(c.id, e.target.value)}>
                  <option value="">Cualquiera</option>
                  {c.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : c.tipo === 'siNo' ? (
                <select value={valorCampo(c.id)} onChange={(e) => editarCampo(c.id, e.target.value)}>
                  <option value="">Cualquiera</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <input
                  type={c.tipo === 'fecha' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'}
                  value={valorCampo(c.id)}
                  onChange={(e) => editarCampo(c.id, e.target.value)}
                  placeholder="Cualquiera"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {conFiltroEmail && (
        <label className="checkbox">
          <input type="checkbox" checked={criterios.soloConEmail} onChange={(e) => editar({ soloConEmail: e.target.checked })} />
          <span>Solo hermanos con correo (para envíos por email)</span>
        </label>
      )}

      <p className="form-hint">
        Ahora mismo: <b>{cuantos}</b> hermano{cuantos === 1 ? '' : 's'} — {etiquetaSegmento(criterios, campos)}.
      </p>

      <div className="assign-box__row">
        {guardando ? (
          <>
            <input
              type="text"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardar() } }}
              placeholder="Nombre del sesgo (p. ej. «Costaleros al día»)"
              aria-label="Nombre del sesgo"
              autoFocus
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={guardar} disabled={!nombreNuevo.trim()}>Guardar</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setGuardando(false); setNombreNuevo('') }}>Cancelar</button>
          </>
        ) : activo ? (
          <span className="table-subtle">Estás usando el sesgo «{activo.nombre}».</span>
        ) : (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setGuardando(true)}>
            Guardar este sesgo
          </button>
        )}
        {/* Deshacer el sesgo a mano, campo por campo, era un suplicio. */}
        {onLimpiar && !guardando && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onLimpiar}>
            Quitar el sesgo
          </button>
        )}
      </div>
    </div>
  )
}
