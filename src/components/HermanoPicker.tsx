import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PersonaAsignable } from '../lib/asignables'

interface HermanoPickerProps {
  hermanos: PersonaAsignable[]
  /** Para usarlo dentro de un <form>: nombre del campo oculto con el id elegido. */
  name?: string
  id?: string
  placeholder?: string
  /** Se llama con quien se elija, o null si se borra/cambia la búsqueda. */
  onSelect?: (persona: PersonaAsignable | null) => void
  /** Id ya asignado (modo controlado): aparece escrito de partida y se puede cambiar. */
  valorId?: string | null
  /** Cómo llamar a «nadie»: se ofrece como opción para dejarlo sin asignar. */
  textoVacio?: string
  /** Nombre a mostrar si el asignado ya no está en la lista (p. ej. se dio de baja). */
  nombreFueraDeLista?: string
}

/**
 * Selector de hermano con búsqueda por nombre o número. Se escribe para
 * filtrar, en vez de desplazarse por una lista de cientos de nombres.
 *
 * Dos formas de usarlo:
 *  - Dentro de un <form>: se le pasa `name` y expone el id en un campo oculto,
 *    como haría un <select>.
 *  - Controlado: se le pasa `valorId` y se escucha `onSelect`, para editar una
 *    asignación que ya existe (por ejemplo, quién se encarga de una tarea).
 */
export default function HermanoPicker({
  hermanos,
  name,
  id,
  placeholder,
  onSelect,
  valorId,
  textoVacio,
  nombreFueraDeLista,
}: HermanoPickerProps) {
  const controlado = valorId !== undefined
  const asignado = valorId ? (hermanos.find((h) => h.id === valorId) ?? null) : null
  /** Cómo se escribe la persona elegida en la caja de búsqueda. */
  const etiqueta = (h: PersonaAsignable) => (h.marca && h.marca !== '—' ? `${h.marca} — ${h.nombre}` : h.nombre)
  const textoAsignado = asignado
    ? etiqueta(asignado)
    : valorId && nombreFueraDeLista
      ? `${nombreFueraDeLista} (ya no activo)`
      : ''

  const [query, setQuery] = useState(textoAsignado)
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(valorId ?? '')
  const boxRef = useRef<HTMLDivElement>(null)

  // En modo controlado, si la asignación cambia desde fuera (otra tarea, o se
  // borra), la caja se pone al día.
  useEffect(() => {
    if (!controlado) return
    setQuery(textoAsignado)
    setSelectedId(valorId ?? '')
  }, [controlado, valorId, textoAsignado])

  const MAX = 8
  const { results, deMas } = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Si lo escrito ES el nombre ya asignado, no se filtra por él: se enseña
    // la lista entera para poder cambiar de persona sin borrar antes.
    const filtrar = q && q !== textoAsignado.toLowerCase()
    const pool = filtrar
      ? hermanos.filter((h) => h.nombre.toLowerCase().includes(q) || h.marca.toLowerCase().includes(q))
      : hermanos
    return { results: pool.slice(0, MAX), deMas: Math.max(0, pool.length - MAX) }
  }, [hermanos, query, textoAsignado])

  // Opción resaltada, para poder elegir con el teclado (flechas + Enter).
  const [resaltado, setResaltado] = useState(0)
  useEffect(() => setResaltado(0), [query])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setResaltado((i) => {
        const n = results.length
        if (n === 0) return 0
        return e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n
      })
      return
    }
    if (e.key === 'Enter' && open && results[resaltado]) {
      e.preventDefault()
      select(results[resaltado])
      return
    }
    if (e.key === 'Escape') {
      cerrarSinElegir()
    }
  }

  /**
   * Cierra la lista dejando la caja como estaba. En modo controlado esto
   * importa: si se escribe algo y no se elige a nadie, la caja mostraría un
   * texto que NO corresponde con quien sigue asignado de verdad.
   */
  const cerrarSinElegir = useCallback(() => {
    setOpen(false)
    if (controlado) setQuery(textoAsignado)
  }, [controlado, textoAsignado])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) cerrarSinElegir()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [cerrarSinElegir])

  function select(h: PersonaAsignable) {
    setSelectedId(h.id)
    setQuery(etiqueta(h))
    setOpen(false)
    onSelect?.(h)
  }

  /** Deja el campo sin nadie asignado. */
  function limpiar() {
    setSelectedId('')
    setQuery('')
    setOpen(false)
    onSelect?.(null)
  }

  function handleQueryChange(v: string) {
    setQuery(v)
    setSelectedId('')
    setOpen(true)
    // En modo controlado no se avisa a cada tecla: solo al elegir o al limpiar.
    // Si no, escribir media palabra borraría la asignación que ya había.
    if (!controlado) onSelect?.(null)
  }

  return (
    <div className="hermano-picker" ref={boxRef}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={placeholder ?? 'Busca por nombre o número de hermano'}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {name && <input type="hidden" name={name} value={selectedId} />}
      {controlado && query.trim() && (
        <button type="button" className="hermano-picker__limpiar" onClick={limpiar} title="Dejar sin asignar">
          ✕
        </button>
      )}

      {open && (results.length > 0 || (controlado && textoVacio)) && (
        <ul className="hermano-picker__list" role="listbox">
          {controlado && textoVacio && (
            <li>
              <button type="button" className="hermano-picker__opt hermano-picker__opt--vacio" onClick={limpiar}>
                {textoVacio}
              </button>
            </li>
          )}
          {results.map((h, i) => (
            <li key={h.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === resaltado}
                className={`hermano-picker__opt${i === resaltado ? ' hermano-picker__opt--resaltada' : ''}`}
                onMouseEnter={() => setResaltado(i)}
                onClick={() => select(h)}
              >
                <span className="hermano-picker__num">{h.marca}</span>
                <span>{h.nombre}</span>
              </button>
            </li>
          ))}
          {/* Con un censo grande, decir cuántos quedan fuera evita pensar que
              «no está» cuando en realidad solo hay que afinar la búsqueda. */}
          {deMas > 0 && (
            <li className="hermano-picker__mas">
              y {deMas} más — sigue escribiendo para afinar
            </li>
          )}
        </ul>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="hermano-picker__empty">Sin coincidencias</div>
      )}
    </div>
  )
}
