import { Link } from 'react-router-dom'
import marcaCompleta from '../assets/gobergo-marca.webp'
import marcaReducida from '../assets/gobergo-marca-reducida.webp'

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

/* Los colores de la marca viven en `lib/marca.ts`: los necesitan también el
   icono de la pestaña y los documentos impresos, y el generador del icono es
   un script que no puede importar un componente. */

/**
 * DOS VERSIONES DE LA MISMA MARCA, y la elección es automática.
 *
 * El logotipo es una orla de filigrana con la G, el farol encendido y la cruz
 * de remate. A 96 píxeles es una preciosidad; a 32 —la pestaña del navegador,
 * la cabecera del panel, el membrete de un recibo— se convierte en una mancha
 * dorada donde no se distingue nada. Eso no es un defecto del dibujo: es lo que
 * le pasa a cualquier marca ceremonial, y por eso las casas serias tienen una
 * versión reducida.
 *
 * La reducida es la MISMA marca sin la orla: la G con su farol. Se lee a 24
 * píxeles y sigue siendo reconocible a 16.
 *
 * El corte está en 56 px porque es donde, mirándolas juntas, la orla deja de
 * ser legible. Se puede forzar una u otra con `variante` para los casos raros.
 */
const CORTE = 56

export function LogoMark({
  size = 34,
  claro = false,
  variante,
}: {
  size?: number
  /** Sobre fondo oscuro. Hoy no cambia el dibujo: el oro aguanta los dos fondos. */
  claro?: boolean
  variante?: 'completa' | 'reducida'
}) {
  const cual = variante ?? (size >= CORTE ? 'completa' : 'reducida')
  return (
    <span className={`logo-mark${claro ? ' logo-mark--claro' : ''}`} style={{ width: size, height: size }}>
      <img
        src={cual === 'completa' ? marcaCompleta : marcaReducida}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        decoding="async"
        draggable={false}
      />
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
