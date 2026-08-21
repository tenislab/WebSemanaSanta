import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFocoDeDialogo } from '../lib/foco'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  /** «ancho» para fichas con mucho que enseñar (la del hermano). */
  ancho?: 'normal' | 'ancho'
}

/**
 * Panel deslizante lateral reutilizable: ficha de hermano, alta de
 * hermano, y en próximas fases también papeletas y cuotas.
 */
export default function Drawer({ open, onClose, title, subtitle, children, footer, ancho = 'normal' }: DrawerProps) {
  const panel = useRef<HTMLElement>(null)
  // El foco entra al abrir, no se escapa mientras está abierto y vuelve a la
  // fila desde la que se abrió al cerrar (ver el comentario largo de foco.ts).
  useFocoDeDialogo(open, panel)
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="drawer-layer">
      {/* El velo cierra al pulsarlo, pero NO es una parada del tabulador: la
          cruz de arriba y la tecla Escape ya hacen lo mismo, y una parada
          llamada «Cerrar» sin nada que ver era desconcertante. */}
      <button className="drawer-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <aside
        ref={panel}
        tabIndex={-1}
        className={`drawer${ancho === 'ancho' ? ' drawer--ancho' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="drawer__head">
          <div>
            {subtitle && <p className="eyebrow">{subtitle}</p>}
            <h2>{title}</h2>
          </div>
          <button className="drawer__close" onClick={onClose} aria-label="Cerrar panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <div className="drawer__body">{children}</div>
        {footer && <footer className="drawer__foot">{footer}</footer>}
      </aside>
    </div>
  )
}
