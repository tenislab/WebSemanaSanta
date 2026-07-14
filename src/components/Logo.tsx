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
 * Marca de Gobergo: el perfil de un nazareno en actitud de avance, de trazo
 * limpio y minimalista. Rompe con la sobrecarga visual tradicional del
 * entorno barroco cofrade, sin atarse a una hermandad concreta.
 */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 160" fill="none" aria-hidden="true">
        <path
          d="M58,4
            C69,9 73,20 67,28
            C71,31 69,35 64,33.5
            C70,42 76,56 75,76
            C74,98 71,116 66,132
            L67,134 L60,150 L55,136
            L48,150 L43,136
            L38,138 L33,132
            C28,116 26,98 27,78
            C28,58 36,42 46,33
            C41,24 44,13 58,4 Z"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="56" cy="24" r="3" fill="currentColor" />
        <path
          d="M40,66 C50,68 54,76 49,84 C46,88 47,92 51,94"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
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
