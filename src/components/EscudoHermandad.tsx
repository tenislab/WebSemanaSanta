import type { IconoHermandad } from '../lib/hermandades'

const GLIFOS: Record<IconoHermandad, JSX.Element> = {
  cruz: (
    <path d="M12 3v18M6 8h12" />
  ),
  corona: (
    <path d="M4 17h16l-1.5-8-3.5 3-3-5.5-3 5.5-3.5-3L4 17Z" />
  ),
  estrella: (
    <path d="m12 3 2.6 5.8 6.2.6-4.7 4.2 1.4 6.2L12 16.8 6.5 19.8l1.4-6.2-4.7-4.2 6.2-.6L12 3Z" />
  ),
  paloma: (
    <path d="M4 12c2-3 5-3 6.5-1 .6-2.4 3-4.5 6-4.5-1.4 1.2-2 2.6-2 4 2 .2 3.5 1.4 4.5 3-2-.6-3.4-.4-4.5.5-1.6 1.3-3.7 1.5-5.5.6.3 1.6-.2 3-1.5 3.7C6.6 19 4.8 16 4 12Z" />
  ),
  ancora: (
    <path d="M12 4v4m0 0a2 2 0 1 0 0 0Zm0 0v13m-6-7c0 3.5 2.7 6.4 6 6.8m6-6.8c0 3.5-2.7 6.4-6 6.8M7 10h10" />
  ),
  lirio: (
    <path d="M12 21V9m0 0c-1.5 0-3-1.4-3-4 1.7 0 3 1.2 3 3 0-1.8 1.3-3 3-3 0 2.6-1.5 4-3 4Zm-5 3c0-2.6 2.2-4 5-4s5 1.4 5 4" />
  ),
  corazon: (
    <path d="M12 20s-7-4.4-9-9c-1.3-3 .6-6.5 4-6.5 2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.4 0 5.3 3.5 4 6.5-2 4.6-9 9-9 9Z" />
  ),
  sol: (
    <path d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
  ),
  luna: (
    <path d="M17 4a8 8 0 1 0 0 16 8 8 0 0 1 0-16Z" />
  ),
  concha: (
    <path d="M12 20V11M4 13c0-5 3.6-9 8-9s8 4 8 9c-2 0-3.2-1.4-4-3-.8 1.6-2 3-4 3s-3.2-1.4-4-3c-.8 1.6-2 3-4 3Z" />
  ),
}

interface EscudoHermandadProps {
  color: string
  icono?: IconoHermandad
  size?: number
  className?: string
}

/**
 * Insignia con forma de escudo, en el color propio de cada hermandad y con
 * un glifo distinto dentro: no es un escudo heráldico real, pero da a cada
 * hermandad una identidad reconocible a simple vista en el buscador y en la
 * cabecera del área del hermano.
 */
export default function EscudoHermandad({ color, icono, size = 36, className }: EscudoHermandadProps) {
  const uid = `${color.replace('#', '')}-${icono ?? 'llano'}`
  return (
    <svg
      viewBox="0 0 24 28"
      width={size}
      height={(size * 28) / 24}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`esc-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="45%" stopColor={color} stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <path
        d="M12 1 22 4.5v7c0 6-4.4 11.4-10 14.5C6.4 22.9 2 17.5 2 11.5v-7Z"
        fill={color}
      />
      <path
        d="M12 1 22 4.5v7c0 6-4.4 11.4-10 14.5C6.4 22.9 2 17.5 2 11.5v-7Z"
        fill={`url(#esc-${uid})`}
      />
      <path
        d="M12 1 22 4.5v7c0 6-4.4 11.4-10 14.5C6.4 22.9 2 17.5 2 11.5v-7Z"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.6"
      />
      {icono && (
        <g transform="translate(4.2 5.2) scale(0.65)" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.92">
          {GLIFOS[icono]}
        </g>
      )}
    </svg>
  )
}
