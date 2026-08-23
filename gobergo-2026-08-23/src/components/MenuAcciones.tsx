import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Menú de acciones secundarias. Las cabeceras acumulaban cinco botones del
 * mismo peso y no se sabía cuál era el importante; aquí dentro va todo lo que
 * se usa de vez en cuando.
 */
export default function MenuAcciones({
  etiqueta = 'Más',
  children,
}: {
  etiqueta?: string
  children: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  return (
    <div className="menu-acciones" ref={caja}>
      <button
        type="button"
        className={`btn btn-outline${abierto ? ' btn-outline--activo' : ''}`}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
      >
        {etiqueta} <span className="menu-acciones__flecha" aria-hidden="true">▾</span>
      </button>
      {abierto && (
        // Se cierra al pulsar cualquier cosa de dentro: todas las opciones
        // abren un panel o lanzan una acción, así que quedarse abierto estorba.
        <div className="menu-acciones__lista" role="menu" onClick={() => setAbierto(false)}>
          {children}
        </div>
      )}
    </div>
  )
}
