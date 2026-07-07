interface ComingSoonProps {
  title: string
  description: string
  phase: string
}

/**
 * Marcador para secciones del panel aún no construidas. Se sustituirá
 * módulo a módulo según el plan de acción (Hermanos, Papeletas, Cuotas…).
 */
export default function ComingSoon({ title, description, phase }: ComingSoonProps) {
  return (
    <div className="soon">
      <span className="soon__ic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="eyebrow">{phase}</p>
      <h1>{title}</h1>
      <p className="soon__desc">{description}</p>
      <p className="soon__note">Este módulo llega en una próxima fase del plan de acción.</p>
    </div>
  )
}
