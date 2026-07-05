import { Link } from 'react-router-dom'

interface LogoProps {
  /** Tamaño de la marca en píxeles. El texto escala en proporción. */
  size?: number
  /** Muestra el nombre junto a la marca. */
  withText?: boolean
  /** Usa tonos claros (para fondos oscuros). */
  light?: boolean
  /** Si es true, envuelve el logo en un enlace a la portada. */
  asLink?: boolean
}

/**
 * Marca de Cabildo: una hornacina / arco de capilla con un punto de luz
 * en su interior (la imagen sacra, el cirio). Evoca el mundo cofrade sin
 * atarse a una hermandad concreta.
 */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 20.5V11a8 8 0 0 1 16 0v9.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path d="M2.8 20.5h18.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="12" cy="10.2" r="1.7" fill="currentColor" />
        <path
          d="M12 6.4c1 .8 1 1.9 0 2.7-1-.8-1-1.9 0-2.7Z"
          fill="currentColor"
          opacity="0.55"
        />
      </svg>
    </span>
  )
}

export default function Logo({
  size = 34,
  withText = true,
  light = false,
  asLink = true,
}: LogoProps) {
  const content = (
    <span className={`brand${light ? ' brand--light' : ''}`}>
      <LogoMark size={size} />
      {withText && (
        <span className="brand-name" style={{ fontSize: size * 0.42 }}>
          Cabildo
        </span>
      )}
    </span>
  )

  if (asLink) {
    return (
      <Link to="/" className="brand-link" aria-label="Cabildo — inicio">
        {content}
      </Link>
    )
  }
  return content
}
