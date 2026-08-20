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

/** El granate y el oro de la marca, escritos una sola vez. */
const GRANATE = '#7B1520'
const ORO = '#C9A55C'

/**
 * La marca de Gobergo: un arco de medio punto en oro, rematado por una flor de
 * lis, con la G en granate dentro.
 *
 * POR QUÉ ESTÁ DIBUJADA Y NO ES UNA IMAGEN. Va en la barra de la aplicación, en
 * la portada, en el pie de los recibos que se imprimen y en el membrete de los
 * informes que se llevan al cabildo. Un PNG se ve borroso al imprimir y pesa en
 * cada carga; esto se dibuja nítido a cualquier tamaño y ocupa lo que ocupa un
 * párrafo de texto.
 *
 * Y NO USA `currentColor`. El granate y el oro son la marca: tienen que salir
 * iguales sobre fondo claro, sobre fondo oscuro y en un papel en blanco y
 * negro. Heredar el color del texto los perdería justo donde más se ven.
 */
export function LogoMark({ size = 34, claro = false }: { size?: number; claro?: boolean }) {
  /**
   * La G en marfil sobre fondos oscuros.
   *
   * En granate sobre el granate de la cabecera simplemente NO SE VE: queda un
   * arco dorado vacío. El oro del arco sí aguanta los dos fondos, pero el
   * granate sobre granate no hay nada que lo salve.
   */
  const tinta = claro ? '#FBF7EF' : GRANATE
  return (
    <span className="logo-mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
        {/* La flor de lis del remate */}
        <path
          d="M60 4c-2.6 3.4-3.9 6.4-3.9 9 0 2.3 1 4.3 2.9 6.1-2.5-.8-4.5-1.2-6-1.2-2.6 0-4.4 1-5.3 3 2.6.9 5.4 1.4 8.3 1.4 1.2 0 2.5-.1 3.9-.3v3.6h.2V26c1.4.2 2.7.3 3.9.3 2.9 0 5.7-.5 8.3-1.4-.9-2-2.7-3-5.3-3-1.5 0-3.5.4-6 1.2 1.9-1.8 2.9-3.8 2.9-6.1 0-2.6-1.3-5.6-3.9-9z"
          fill={ORO}
        />
        {/* El arco: dos trazos paralelos, como una arcada de iglesia */}
        <path d="M22 100V62a38 38 0 0 1 38-38 38 38 0 0 1 38 38v38" stroke={ORO} strokeWidth="3" strokeLinecap="round" />
        <path d="M31 100V62a29 29 0 0 1 29-29 29 29 0 0 1 29 29v38" stroke={ORO} strokeWidth="3" strokeLinecap="round" />
        {/* La línea de tierra, partida en dos para dejar sitio al adorno */}
        <path d="M14 104h26M80 104h26" stroke={ORO} strokeWidth="3" strokeLinecap="round" />
        {/* El adorno de abajo: dos hojas y una gota */}
        <path d="M48 102c4 0 6.9-1.5 8.6-4.4-4 0-6.9 1.5-8.6 4.4zM72 102c-4 0-6.9-1.5-8.6-4.4 4 0 6.9 1.5 8.6 4.4z" fill={ORO} />
        <circle cx="60" cy="97.6" r="2.1" fill={ORO} />
        <path d="M60 103c-1.5 2.1-2.3 3.8-2.3 5.3 0 1.4.8 2.3 2.3 2.3s2.3-.9 2.3-2.3c0-1.5-.8-3.2-2.3-5.3z" fill={ORO} />
        {/* La G, con el trazo horizontal recto del original */}
        <text
          x="60"
          y="90"
          textAnchor="middle"
          fill={tinta}
          fontFamily="'Cormorant Garamond', 'Playfair Display', Georgia, 'Times New Roman', serif"
          fontSize="74"
          fontWeight="600"
        >
          G
        </text>
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
      <LogoMark size={size} claro={light} />
      {withText && (
        <span className="brand-texto">
          <span className="brand-name" style={{ fontSize: size * 0.52 }}>
            Gobergo
          </span>
          {/* El lema solo cuando hay sitio: a tamaño pequeño se convierte en
              una línea gris ilegible y estorba más que aporta. */}
          {size >= 40 && (
            <span className="brand-lema" style={{ fontSize: Math.max(8, size * 0.15) }}>
              Gestión de hermandades
            </span>
          )}
        </span>
      )}
    </span>
  )

  if (asLink) {
    return (
      <Link to="/" className="brand-link" aria-label="Gobergo — inicio">
        {content}
      </Link>
    )
  }
  return content
}
