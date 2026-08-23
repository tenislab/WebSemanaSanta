/**
 * Deriva los tokens de color (botón, hover, tinta de contraste, anillo de foco)
 * a partir del color de marca de una hermandad, para que el área del hermano
 * se pinte con los colores propios de cada hermandad sin tener que duplicar
 * reglas CSS: los tokens se inyectan como variables CSS en la raíz del portal
 * y el resto de estilos ya los usa (var(--accent), var(--ring)…).
 */

function hexToRgb(hex: string): [number, number, number] {
  const limpio = hex.replace('#', '')
  const completo = limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio
  const num = parseInt(completo, 16)
  if (completo.length !== 6 || Number.isNaN(num)) return [202, 162, 74] // gris dorado por defecto si el valor no es válido
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

function mezclar(rgb: [number, number, number], hacia: [number, number, number], cantidad: number): [number, number, number] {
  return [
    rgb[0] + (hacia[0] - rgb[0]) * cantidad,
    rgb[1] + (hacia[1] - rgb[1]) * cantidad,
    rgb[2] + (hacia[2] - rgb[2]) * cantidad,
  ]
}

function luminanciaRelativa([r, g, b]: [number, number, number]): number {
  const canal = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

function contraste(l1: number, l2: number): number {
  const claro = Math.max(l1, l2)
  const oscuro = Math.min(l1, l2)
  return (claro + 0.05) / (oscuro + 0.05)
}

const INK_OSCURO = '#1a1310'
const INK_CLARO = '#fbf5e9'
const LUM_INK_OSCURO = luminanciaRelativa(hexToRgb(INK_OSCURO))
const LUM_INK_CLARO = luminanciaRelativa(hexToRgb(INK_CLARO))

export interface TemaHermandad {
  accent: string
  accentHover: string
  accentInk: string
  ring: string
}

/** Calcula un juego de colores accesible (botón, hover, tinta, anillo) a partir de un color de marca. */
export function temaDeColor(hex: string): TemaHermandad {
  const rgb = hexToRgb(hex || '#caa24a')
  const accent = rgbToHex(rgb)
  const accentHover = rgbToHex(mezclar(rgb, [0, 0, 0], 0.18))
  const luminancia = luminanciaRelativa(rgb)
  // Se elige la tinta (clara u oscura) que dé más contraste real contra el color de marca,
  // en vez de un punto de corte fijo: un simple ">0.5" deja textos casi ilegibles en tonos
  // intermedios como el dorado por defecto de la app.
  const accentInk = contraste(luminancia, LUM_INK_OSCURO) >= contraste(luminancia, LUM_INK_CLARO) ? INK_OSCURO : INK_CLARO
  const ring = `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, 0.5)`
  return { accent, accentHover, accentInk, ring }
}

/** Variables CSS listas para pasar como `style` en la raíz del área del hermano. */
export function estiloTema(hex: string): Record<string, string> {
  const t = temaDeColor(hex)
  const rgb = hexToRgb(hex || '#caa24a')
  return {
    '--accent': t.accent,
    '--accent-hover': t.accentHover,
    '--accent-ink': t.accentInk,
    '--ring': t.ring,
    // Tiñe el fondo y la cabecera de toda la pantalla del área del hermano
    // con el color de la hermandad, para que se note desde el primer vistazo.
    '--portal-bloom-1': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.5)`,
    '--portal-bloom-2': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.32)`,
    '--portal-wash': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.16)`,
    '--portal-head-bg': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.22)`,
    '--portal-head-border': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.5)`,
  }
}

/** Iniciales de una hermandad para la insignia de marca cuando no tiene logo (p. ej. "Hermandad de la Soledad" → "HS"). */
export function inicialesHermandad(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((p) => !['de', 'del', 'la', 'las', 'el', 'los', 'y'].includes(p.toLowerCase()))
  return ((palabras[0]?.[0] ?? '') + (palabras[1]?.[0] ?? '')).toUpperCase() || 'CB'
}
