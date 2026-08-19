import type { Hermano } from '../data/hermanos'

/**
 * Datos «humanos» del hermano para su ficha: no cambian nada en la base, pero
 * son los que hacen que la ficha se lea como la de una persona y no como una
 * fila de tabla.
 */

/** Años que lleva en la hermandad, contados hasta hoy. */
export function aniosDeHermandad(antiguedad: number, hoy = new Date()): number {
  return Math.max(0, hoy.getFullYear() - antiguedad)
}

const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** «16 de octubre» a partir de una fecha ISO. Vacío si no hay fecha o no vale. */
export function diaYMes(iso: string | undefined): string {
  if (!iso) return ''
  const [, mes, dia] = iso.split('-').map(Number)
  if (!mes || !dia || mes < 1 || mes > 12) return ''
  return `${dia} de ${MESES_LARGOS[mes - 1]}`
}

/** Edad a día de hoy. Null si no hay fecha de nacimiento. */
export function edadDe(iso: string | undefined, hoy = new Date()): number | null {
  if (!iso) return null
  const n = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(n.getTime())) return null
  let edad = hoy.getFullYear() - n.getFullYear()
  const cumplioYa =
    hoy.getMonth() > n.getMonth() || (hoy.getMonth() === n.getMonth() && hoy.getDate() >= n.getDate())
  if (!cumplioYa) edad -= 1
  return edad >= 0 && edad < 130 ? edad : null
}

/**
 * Un tono estable por hermano, sacado de su nombre. Da color a la ficha sin
 * inventarse datos: el mismo hermano siempre sale del mismo color. Se queda en
 * la gama cálida de la casa (burdeos, oro, tierra, verde y azul apagados).
 */
// Los tonos están medidos: con su tinta, TODOS pasan de 4,5:1 (AA) también en
// las pastillas, que van sobre el mismo tono aclarado un 12 %.
const TONOS = [
  { fondo: '#6A1A23', tinta: '#fff6ee' },
  { fondo: '#74501c', tinta: '#fff7ea' },
  { fondo: '#425332', tinta: '#f4f7ee' },
  { fondo: '#384c66', tinta: '#eef3f9' },
  { fondo: '#6d3d5c', tinta: '#faeff6' },
  { fondo: '#7a3b2a', tinta: '#fdf0ea' },
]
export function tonoDe(nombre: string): { fondo: string; tinta: string } {
  let suma = 0
  for (let i = 0; i < nombre.length; i += 1) suma = (suma + nombre.charCodeAt(i)) % 997
  return TONOS[suma % TONOS.length]
}

/** Cuántos años cumple este año quien nació en esa fecha (para felicitar). */
export function esSuCumpleHoy(iso: string | undefined, hoy = new Date()): boolean {
  if (!iso) return false
  const [, mes, dia] = iso.split('-').map(Number)
  return mes === hoy.getMonth() + 1 && dia === hoy.getDate()
}

/** Frase corta con la antigüedad, para la cabecera de la ficha. */
export function fraseAntiguedad(h: Hermano, hoy = new Date()): string {
  const anios = aniosDeHermandad(h.antiguedad, hoy)
  if (anios === 0) return `Hermano/a desde este año`
  return `Hermano/a desde ${h.antiguedad} · ${anios} ${anios === 1 ? 'año' : 'años'}`
}

/** ¿Cumple años este mes? Para el detalle de «los que cumplen» en el censo. */
export function cumpleEsteMes(iso: string | undefined, hoy = new Date()): boolean {
  if (!iso) return false
  const mes = Number(iso.split('-')[1])
  return mes === hoy.getMonth() + 1
}

/** Nombre del mes en curso, en minúscula, para los textos del censo. */
export function mesEnCurso(hoy = new Date()): string {
  return MESES_LARGOS[hoy.getMonth()]
}

/* ---------------------------------------------------------------------------
   H1 · Su vida en la hermandad: agrupar el histórico por años.
   --------------------------------------------------------------------------- */

/**
 * Estados en los que el hermano tiene sitio de verdad en el cortejo. No basta
 * con «no anulada»: una solicitud pendiente todavía no es un sitio, y una
 * renuncia es justo lo contrario. Y tampoco vale exigir tramo: hay hermandades
 * que reparten por opciones, sin tramos.
 */
export const ESTADOS_CON_SITIO = new Set(['Asignada', 'Pagada', 'Entregada'])

/** Cuántas estaciones de penitencia ha hecho de verdad. */
export function salidasDe(papeletas: { estado: string }[]): number {
  return papeletas.filter((p) => ESTADOS_CON_SITIO.has(p.estado)).length
}

/**
 * Agrupa por año, del más reciente al más antiguo. `anio(x)` puede devolver
 * null (una cuota sin ejercicio ni fecha de emisión): esas van juntas al 0, y
 * se pintan como «Sin ejercicio» en vez de desaparecer.
 */
export function porAnio<T>(lista: T[], anio: (x: T) => number | null): [number, T[]][] {
  const mapa = new Map<number, T[]>()
  lista.forEach((x) => {
    const a = anio(x) ?? 0
    mapa.set(a, [...(mapa.get(a) ?? []), x])
  })
  return [...mapa.entries()].sort((a, b) => b[0] - a[0])
}
