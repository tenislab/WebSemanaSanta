import type { CampoPropio } from '../lib/camposPropios'

/**
 * Los campos a medida de la hermandad, rellenables en la ficha del hermano.
 * Se usa igual en el alta y en la edición; quien lo llama decide qué campos
 * pasarle (todos, o solo los marcados para el alta).
 */
export default function CamposPropiosForm({
  campos,
  valores,
  onChange,
  idPrefijo = 'cp',
}: {
  campos: CampoPropio[]
  valores: Record<string, string>
  onChange: (siguientes: Record<string, string>) => void
  /** Para no repetir ids de <input> cuando hay dos formularios en pantalla. */
  idPrefijo?: string
}) {
  if (campos.length === 0) return null

  function editar(id: string, valor: string) {
    onChange({ ...valores, [id]: valor })
  }

  return (
    <>
      {campos.map((c) => {
        const id = `${idPrefijo}-${c.id}`
        const valor = valores[c.id] ?? ''
        return (
          <div className="form-row" key={c.id}>
            <label htmlFor={id}>{c.nombre}</label>
            {c.tipo === 'texto' && (
              <textarea id={id} rows={2} value={valor} onChange={(e) => editar(c.id, e.target.value)} />
            )}
            {c.tipo === 'numero' && (
              <input id={id} type="number" value={valor} onChange={(e) => editar(c.id, e.target.value)} />
            )}
            {c.tipo === 'fecha' && (
              <input id={id} type="date" value={valor} onChange={(e) => editar(c.id, e.target.value)} />
            )}
            {c.tipo === 'siNo' && (
              <select id={id} value={valor} onChange={(e) => editar(c.id, e.target.value)}>
                <option value="">Sin contestar</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            )}
            {c.tipo === 'lista' && (
              <select id={id} value={valor} onChange={(e) => editar(c.id, e.target.value)}>
                <option value="">Sin elegir</option>
                {c.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                {/* Si el valor guardado ya no está en la lista, se conserva a la
                    vista en vez de borrarse en silencio al abrir la ficha. */}
                {valor && !c.opciones.includes(valor) && <option value={valor}>{valor} (ya no está en la lista)</option>}
              </select>
            )}
            {c.ayuda && <p className="form-hint">{c.ayuda}</p>}
          </div>
        )
      })}
    </>
  )
}
