import { TIPOS_CAMPO, type CampoPropio, useCamposPropios } from '../../../lib/camposPropios'
import { nuevoId } from '../../../lib/supabaseSync'
import { ofrecerDeshacer, reinsertar } from '../../../lib/deshacer'

/* -------------------- Campos propios de la ficha del hermano -------------------- */
/**
 * Cada hermandad apunta cosas distintas —la talla de la túnica, el número de
 * llave de la casa hermandad— y no tiene sentido inventar un campo fijo para
 * cada una. Aquí define los suyos, y aparecen en la ficha del hermano y en los
 * sesgos.
 */
export default function CamposPropiosCard() {
  const [campos, setCampos] = useCamposPropios()

  function editar(id: string, cambios: Partial<CampoPropio>) {
    setCampos(campos.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
  }
  function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= campos.length) return
    const arr = [...campos]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setCampos(arr)
  }
  /**
   * Quitar un campo propio es lo más caro de esta pantalla, aunque no lo
   * parezca. Lo que cada hermano tenga apuntado ahí (su talla de túnica, su
   * número de llave) se guarda contra el IDENTIFICADOR del campo. Volver a
   * crearlo a mano da un identificador nuevo, así que aparece vacío y lo
   * anterior se queda dentro de la ficha sin que nadie pueda verlo.
   *
   * Deshaciendo vuelve el mismo campo, con su mismo identificador, y los
   * valores reaparecen.
   */
  function quitarCampo(id: string) {
    const posicion = campos.findIndex((x) => x.id === id)
    const campo = campos[posicion]
    setCampos(campos.filter((x) => x.id !== id))
    if (campo) {
      ofrecerDeshacer(`Campo «${campo.nombre.trim() || 'sin nombre'}» quitado de la ficha`, () => {
        setCampos(reinsertar(campos.filter((x) => x.id !== id), campo, posicion))
      })
    }
  }

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Campos propios de la ficha</h2>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setCampos([...campos, { id: nuevoId(), nombre: '', tipo: 'texto', opciones: [], ayuda: '', enAlta: false }])}
        >
          + Añadir campo
        </button>
      </div>
      <p className="form-hint">
        Lo que apuntáis a mano en una hoja aparte: talla de túnica, número de llave, si tiene el
        carné de costalero… Aparecen en la ficha de cada hermano y se puede sesgar por ellos
        («todos los de talla L»).
      </p>
      {campos.length === 0 && <p className="form-hint">Todavía no hay ningún campo propio.</p>}

      {campos.map((c, i) => (
        <div className="assign-box" key={c.id}>
          <div className="assign-box__row">
            <input
              type="text"
              value={c.nombre}
              onChange={(e) => editar(c.id, { nombre: e.target.value })}
              placeholder="Nombre del campo"
              aria-label="Nombre del campo"
            />
            <select value={c.tipo} onChange={(e) => editar(c.id, { tipo: e.target.value as CampoPropio['tipo'] })} aria-label="Tipo de campo">
              {TIPOS_CAMPO.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <button type="button" className="icon-btn" title="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
            <button type="button" className="icon-btn" title="Bajar" disabled={i === campos.length - 1} onClick={() => mover(i, 1)}>▼</button>
            <button
              type="button"
              className="btn btn-ghost btn-sm rgpd-borrar"
              onClick={() => quitarCampo(c.id)}
            >
              Quitar
            </button>
          </div>
          {!c.nombre.trim() && <p className="form-hint form-hint--alerta">Ponle nombre o no se verá en la ficha.</p>}
          {c.tipo === 'lista' && (
            <div className="form-row">
              <label>Opciones (una por línea)</label>
              <textarea
                rows={3}
                value={c.opciones.join('\n')}
                onChange={(e) => editar(c.id, { opciones: e.target.value.split('\n').map((o) => o.trim()).filter(Boolean) })}
                placeholder={'S\nM\nL\nXL'}
              />
              {c.opciones.length === 0 && <p className="form-hint form-hint--alerta">Una lista sin opciones no deja elegir nada.</p>}
            </div>
          )}
          <div className="form-row">
            <label>Ayuda (opcional)</label>
            <input
              type="text"
              value={c.ayuda}
              onChange={(e) => editar(c.id, { ayuda: e.target.value })}
              placeholder={TIPOS_CAMPO.find((t) => t.id === c.tipo)?.ejemplo ?? ''}
            />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={c.enAlta} onChange={(e) => editar(c.id, { enAlta: e.target.checked })} />
            <span>Pedirlo también al dar de alta a un hermano nuevo</span>
          </label>
        </div>
      ))}

      {/* Nada de un botón «Guardar» que no guarda: se guardan al escribir. */}
      <p className="form-hint">Los cambios se guardan solos.</p>
    </section>
  )
}
