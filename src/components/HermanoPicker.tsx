import { useEffect, useMemo, useRef, useState } from 'react'
import type { Hermano } from '../data/hermanos'

interface HermanoPickerProps {
  hermanos: Hermano[]
  name: string
  id?: string
  placeholder?: string
  /** Se llama con el hermano elegido, o null si se borra/cambia la búsqueda. */
  onSelect?: (hermano: Hermano | null) => void
}

/**
 * Selector de hermano con búsqueda por nombre o número, para usar dentro de
 * un <form> nativo: expone el id elegido en un input oculto con `name`,
 * igual que haría un <select>, pero permite escribir para filtrar en vez de
 * desplazarse por una lista larga.
 */
export default function HermanoPicker({ hermanos, name, id, placeholder, onSelect }: HermanoPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q
      ? hermanos.filter((h) => h.nombre.toLowerCase().includes(q) || String(h.numero).includes(q))
      : hermanos
    return pool.slice(0, 8)
  }, [hermanos, query])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function select(h: Hermano) {
    setSelectedId(h.id)
    setQuery(`${h.numero} — ${h.nombre}`)
    setOpen(false)
    onSelect?.(h)
  }

  function handleQueryChange(v: string) {
    setQuery(v)
    setSelectedId('')
    setOpen(true)
    onSelect?.(null)
  }

  return (
    <div className="hermano-picker" ref={boxRef}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder ?? 'Busca por nombre o número de hermano'}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      <input type="hidden" name={name} value={selectedId} />

      {open && results.length > 0 && (
        <ul className="hermano-picker__list" role="listbox">
          {results.map((h) => (
            <li key={h.id}>
              <button type="button" className="hermano-picker__opt" onClick={() => select(h)}>
                <span className="hermano-picker__num">Nº {h.numero}</span>
                <span>{h.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="hermano-picker__empty">Sin coincidencias</div>
      )}
    </div>
  )
}
