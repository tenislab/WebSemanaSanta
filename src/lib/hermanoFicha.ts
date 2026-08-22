import type { EstadoHermano, Hermano } from '../data/hermanos'

/**
 * Datos «humanos» del hermano para su ficha: no cambian nada en la base, pero
 * son los que hacen que la ficha se lea como la de una persona y no como una
 * fila de tabla.
 */

/**
 * ¿Cuenta este hermano como miembro de la hermandad?
 *
 * Sí salvo que se haya ido. «Nuevo» ES miembro: ese estado se pone al ACEPTAR
 * a alguien —tanto desde una solicitud como al darlo de alta a mano— y quiere
 * decir «entró este año», no «está pendiente de algo».
 *
 * EL FALLO QUE ARREGLA: se contaban los activos como `estado === 'Activo'`, en
 * tres sitios distintos, dejando fuera a los nuevos. O sea que todo hermano
 * dado de alta hoy no contaba. Una hermandad que importa su censo entero —con
 * todos marcados como nuevos, porque acaban de entrar en la aplicación— veía
 * «Hermanos activos: 0» encima de sus ochocientas fichas. Y uno de esos tres
 * sitios era el informe que se imprime y se lleva al cabildo de cuentas.
 *
 * Está aquí, en una sola función, para que las tres pantallas no puedan volver
 * a contar cada una a su manera.
 */
export function esMiembro(h: { estado: EstadoHermano; civil?: boolean }): boolean {
  /*
   * El hermano civil NO cuenta como hermano en las cifras, y esa decisión
   * importa: el «Padrón de hermanos» de Informes es el documento que se lleva
   * al cabildo de cuentas y a la diócesis. El administrativo contratado no es
   * hermano de la hermandad, aunque tenga su ficha y su acceso.
   *
   * Sí sigue apareciendo en el LISTADO del censo, para que secretaría pueda
   * encontrarlo y gestionarlo. Fuera de las cifras, dentro de la lista.
   */
  return h.estado !== 'Baja' && !h.civil
}

/**
 * Años que lleva en la hermandad, contados hasta hoy. `null` si no se sabe.
 *
 * Devuelve `null` y no un número porque «no lo sé» y «cero años» son cosas
 * distintas, y confundirlas se veía en pantalla: sin año de antigüedad la
 * resta daba NaN y el censo ponía «NaN años» debajo del nombre de cada
 * hermano. Con la antigüedad a cero era peor todavía, porque no cantaba:
 * ponía «2026 años de hermano/a» tan tranquilo.
 *
 * No es rebuscado. Es EXACTAMENTE lo que pasa el día que una hermandad
 * importa su censo de un Excel donde esa columna no existe, o viene vacía en
 * la mitad de las filas. Ese día hay ochocientos «NaN años» en pantalla.
 *
 * El tope de 1500 descarta erratas al teclear (un «19» suelto, un «205») sin
 * dejar fuera a ninguna hermandad de verdad: la más antigua de Sevilla es de
 * 1340 y pico.
 */
export function aniosDeHermandad(
  antiguedad: number | null | undefined,
  /** Hasta cuándo se cuenta: una fecha, o directamente un año (el de la campaña). */
  hasta: Date | number = new Date(),
): number | null {
  const anioFinal = typeof hasta === 'number' ? hasta : hasta.getFullYear()
  if (typeof antiguedad !== 'number' || !Number.isFinite(antiguedad)) return null
  if (antiguedad < 1000 || antiguedad > anioFinal + 1) return null
  return Math.max(0, anioFinal - antiguedad)
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
  // Sin año de antigüedad no se inventa nada: se dice que no consta.
  if (anios === null) return 'Antigüedad sin registrar'
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
