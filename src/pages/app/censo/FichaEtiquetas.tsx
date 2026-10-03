import { useState } from 'react'
import type { Hermano } from '../../../data/hermanos'

/**
 * LAS ETIQUETAS DEL HERMANO, en su ficha.
 *
 * Sale de `Hermanos.tsx` con su caja de texto, su `crearEtiqueta` y el
 * `toggleEtiquetaHermano` dentro: medido, el bloque de pantalla a secas costaba
 * ocho props, de las que tres eran su propio formulario. Trayéndose las dos
 * funciones son cien líneas por CINCO props, y ninguna de las dos funciones se
 * usaba en ningún otro sitio de la pantalla del censo.
 *
 * EL CATÁLOGO SE RECIBE, NO SE PIDE AQUÍ. `useEtiquetas()` lee de la base al
 * montar, y esta pieza se monta cada vez que alguien abre una ficha: llamarlo
 * aquí sería una lectura de red por cada hermano que se mira. El catálogo lo
 * tiene ya la pantalla del censo —lo necesita para el etiquetado masivo— así
 * que baja como prop.
 *
 * LAS AUTOMÁTICAS NO SE TOCAN. Las que vienen de la papeleta de este año se
 * ponen solas mientras la tenga y se van si la anula, así que se enseñan
 * aparte y sin botón: si no, alguien las busca en la lista de abajo, no las
 * encuentra y las crea otra vez a mano.
 */
export default function FichaEtiquetas({ selected, roles, etiquetas, setEtiquetas, setHermanos }: {
  selected: Hermano
  /** Las etiquetas que cada hermano saca de su papeleta de este año. */
  roles: Map<string, string[]>
  /** El catálogo de la hermandad. */
  etiquetas: string[]
  setEtiquetas: (siguiente: string[]) => void
  setHermanos: React.Dispatch<React.SetStateAction<Hermano[]>>
}) {
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')

  function toggleEtiquetaHermano(hermanoId: string, etiqueta: string) {
    setHermanos((prev) =>
      prev.map((h) => {
        if (h.id !== hermanoId) return h
        const actuales = h.etiquetas ?? []
        const siguiente = actuales.includes(etiqueta)
          ? actuales.filter((e) => e !== etiqueta)
          : [...actuales, etiqueta]
        return { ...h, etiquetas: siguiente }
      }),
    )
  }

  /** Crea una etiqueta nueva en el catálogo y se la asigna al hermano abierto. */
  function crearEtiqueta() {
    const limpia = nuevaEtiqueta.trim()
    if (!limpia) return
    if (!etiquetas.includes(limpia)) setEtiquetas([...etiquetas, limpia])
    if (!(selected.etiquetas ?? []).includes(limpia)) {
      toggleEtiquetaHermano(selected.id, limpia)
    }
    setNuevaEtiqueta('')
  }

  const automaticas = roles.get(selected.id) ?? []

  return (
    <div className="assign-box">
      <label>Etiquetas</label>
      <p className="form-hint">
        Marca los grupos a los que pertenece. Sirven para mandarle avisos segmentados (p. ej. solo a
        los costaleros) y para filtrar el censo.
      </p>
      {/* Las que vienen de su papeleta no se marcan a mano: se ponen solas
          mientras la tenga y se van si la anula. Enseñarlas aquí evita que
          alguien las busque en la lista y no las encuentre. */}
      {automaticas.length > 0 && (
        <div className="etiquetas-auto">
          <span className="etiquetas-auto__ante">Por su papeleta de este año</span>
          <div className="etiquetas-chips">
            {automaticas.map((et) => (
              <span key={et} className="chip chip--auto" title="Se pone sola por el tramo u opción de su papeleta">
                {et}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="etiquetas-chips">
        {etiquetas.map((et) => {
          const activa = (selected.etiquetas ?? []).includes(et)
          return (
            <button
              type="button"
              key={et}
              className={`chip chip--toggle${activa ? ' chip--active' : ''}`}
              onClick={() => toggleEtiquetaHermano(selected.id, et)}
              aria-pressed={activa}
            >
              {activa ? '✓ ' : ''}{et}
            </button>
          )
        })}
      </div>
      <div className="assign-box__row" style={{ marginTop: '0.6rem' }}>
        <input
          type="text"
          placeholder="Crear etiqueta nueva…"
          value={nuevaEtiqueta}
          onChange={(e) => setNuevaEtiqueta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              crearEtiqueta()
            }
          }}
        />
        <button type="button" className="btn btn-outline btn-sm" onClick={crearEtiqueta}>
          Añadir
        </button>
      </div>
    </div>
  )
}
