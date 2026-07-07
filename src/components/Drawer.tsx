import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

/**
 * Panel deslizante lateral reutilizable: ficha de hermano, alta de
 * hermano, y en próximas fases también papeletas y cuotas.
 */
export default function Drawer({ open, onClose, title, subtitle, children, footer }: DrawerProps) {
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
      <button className="drawer-scrim" aria-label="Cerrar" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
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
