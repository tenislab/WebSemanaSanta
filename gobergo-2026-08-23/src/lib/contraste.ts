/**
 * Contraste entre dos colores, según el cálculo de las pautas de
 * accesibilidad (WCAG). Se usa para avisar en el editor cuando los colores
 * elegidos a mano dejan la web ilegible: el texto pequeño necesita 4,5 y los
 * títulos grandes, 3.
 */

/** #rgb o #rrggbb → [r, g, b] en 0..255. Null si no se entiende. */
export function aRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace('#', '')
  if (h.length === 3) {
    const [r, g, b] = h.split('')
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)]
  }
  if (h.length === 6) {
    const n = parseInt(h, 16)
    if (Number.isNaN(n)) return null
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  return null
}

function luminancia([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/** Relación de contraste entre dos colores (de 1 a 21). */
export function contraste(hexA: string, hexB: string): number {
  const a = aRgb(hexA)
  const b = aRgb(hexB)
  if (!a || !b) return 21
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Mezcla un color con blanco o negro, igual que hace el CSS del sitio. */
export function mezclar(hex: string, hacia: '#fff' | '#000', porcentaje: number): string {
  const c = aRgb(hex)
  if (!c) return hex
  const destino = hacia === '#fff' ? 255 : 0
  const m = c.map((v) => Math.round(v * porcentaje + destino * (1 - porcentaje)))
  return `#${m.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Los fondos reales del sitio, para comprobar el contraste contra ellos. */
export const FONDO_CLARO = '#ffffff'
export const FONDO_OSCURO = '#16110f'

/**
 * ¿Se leerán los títulos con estos colores? Reproduce lo que hace el CSS:
 * en tema oscuro el color se aclara un 58 % hacia el blanco, y el secundario
 * se oscurece un 38 % hacia el negro en claro.
 */
export function avisosDeContraste(primario: string, secundario: string, tema: 'claro' | 'oscuro'): string[] {
  const fondo = tema === 'claro' ? FONDO_CLARO : FONDO_OSCURO
  const primarioTexto = tema === 'claro' ? primario : mezclar(primario, '#fff', 0.42)
  const secundarioTexto = tema === 'claro' ? mezclar(secundario, '#000', 0.62) : mezclar(secundario, '#fff', 0.9)

  const avisos: string[] = []
  // Los títulos son texto grande: con 3 basta.
  if (contraste(primarioTexto, fondo) < 3) {
    avisos.push('El color principal apenas se distingue del fondo: los títulos se leerán mal.')
  }
  // Las fechas y antetítulos van en letra pequeña: hacen falta 4,5.
  if (contraste(secundarioTexto, fondo) < 4.5) {
    avisos.push('El color secundario se lee mal en letra pequeña (fechas y antetítulos).')
  }
  // El botón lleva texto blanco encima del color principal.
  if (contraste(primario, '#ffffff') < 4.5) {
    avisos.push('Los botones llevan texto blanco encima del color principal, y ahí no se lee.')
  }
  return avisos
}
