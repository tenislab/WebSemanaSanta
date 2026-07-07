function hashCode(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

interface QrPreviewProps {
  /** Texto que "codifica" el código (el número de papeleta, por ejemplo). */
  seed: string
  size?: number
}

/**
 * Vista previa ilustrativa de un código QR: un patrón determinista (mismo
 * seed → mismo dibujo) con los tres cuadros de posición típicos de un QR
 * real, pero sin codificar datos escaneables. El QR verificable llegará
 * cuando cada papeleta tenga una URL real que consultar (con Supabase).
 */
export default function QrPreview({ seed, size = 96 }: QrPreviewProps) {
  const cells = 9
  const cell = size / cells

  function isFinder(r: number, c: number) {
    return (r < 3 && c < 3) || (r < 3 && c >= cells - 3) || (r >= cells - 3 && c < 3)
  }
  function isFilled(r: number, c: number) {
    if (isFinder(r, c)) return true
    return hashCode(`${seed}-${r}-${c}`) % 3 === 0
  }

  const rects = []
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (isFilled(r, c)) {
        rects.push(<rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} />)
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="qr-preview"
      role="img"
      aria-label={`Código de la papeleta ${seed}`}
    >
      <rect x="0" y="0" width={size} height={size} fill="var(--bg-raised)" />
      <g fill="var(--text)">{rects}</g>
    </svg>
  )
}
