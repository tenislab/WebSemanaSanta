/**
 * EL CALENDARIO DE LA SEMANA SANTA, calculado.
 *
 * La Semana Santa no cae el mismo día cada año: se cuenta desde el Domingo de
 * Resurrección, que es el primer domingo tras la primera luna llena de la
 * primavera. Eso significa que puede moverse más de un mes —del 22 de marzo al
 * 25 de abril— y que ninguna fecha del año cofrade se puede escribir a mano en
 * el código sin que caduque el año siguiente.
 *
 * Por eso está calculado y no en una tabla: una lista de fechas apuntadas a
 * mano funciona hasta que se acaba, y entonces la portada de Gobergo enseña una
 * cuenta atrás en negativo hacia una Semana Santa que ya pasó. Y eso, en una
 * página que vende software cofrade, es lo peor que puede salir.
 *
 * Se usa el cómputo gregoriano (el de Meeus/Jones/Butcher), que es el que rige
 * de verdad en la Iglesia latina desde 1583.
 *
 * Todo son funciones puras: se les da un año y devuelven fechas en ISO
 * (aaaa-mm-dd). No leen nada, no guardan nada.
 */

/** El Domingo de Resurrección de ese año, en ISO. */
export function domingoDePascua(anio: number): string {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * Suma (o resta) días a una fecha ISO y devuelve otra ISO.
 *
 * Todo en UTC de punta a punta —se construye en UTC y se lee en UTC— y se
 * escribe a mano en vez de con `toISOString().slice(0, 10)`. Aquí las dos
 * cosas darían igual, porque no interviene la hora local en ningún momento,
 * pero esa expresión es la que produce el fallo de «a las 00:30 la fecha es la
 * de ayer» y hay una prueba que la persigue por todo el código. Mejor no
 * enseñarla ni donde es inofensiva: se copia de un sitio a otro sola.
 */
function masDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mes}-${dia}`
}

export interface FechasCofrades {
  anio: number
  /** Miércoles de Ceniza: empieza la Cuaresma, y con ella el reparto de papeletas. */
  ceniza: string
  /** Domingo de Ramos: el primer día de estación de penitencia. */
  ramos: string
  juevesSanto: string
  viernesSanto: string
  sabadoSanto: string
  pascua: string
}

/** Las fechas del año cofrade de un año concreto. */
export function fechasDeSemanaSanta(anio: number): FechasCofrades {
  const pascua = domingoDePascua(anio)
  return {
    anio,
    // La Cuaresma dura cuarenta días sin contar los domingos: son 46 atrás.
    ceniza: masDias(pascua, -46),
    ramos: masDias(pascua, -7),
    juevesSanto: masDias(pascua, -3),
    viernesSanto: masDias(pascua, -2),
    sabadoSanto: masDias(pascua, -1),
    pascua,
  }
}

/** Días que faltan hasta una fecha ISO. Negativo si ya pasó. */
export function diasHasta(iso: string, hoy = new Date()): number {
  const desde = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const hasta = new Date(`${iso}T00:00:00Z`).getTime()
  return Math.round((hasta - desde) / 86_400_000)
}

/**
 * LA SEMANA SANTA QUE VIENE.
 *
 * Ojo con el corte: mientras la de este año no haya TERMINADO (hasta el
 * Domingo de Resurrección incluido) sigue siendo la que viene. Cortando por el
 * Domingo de Ramos, la portada saltaría al año siguiente en plena Semana
 * Santa: el Jueves Santo por la mañana diría «faltan 361 días», con las
 * cofradías en la calle. Justo el día del año en que más gente entra.
 */
export function proximaSemanaSanta(hoy = new Date()): FechasCofrades & { faltan: number } {
  const deEsteAnio = fechasDeSemanaSanta(hoy.getFullYear())
  const fechas = diasHasta(deEsteAnio.pascua, hoy) >= 0
    ? deEsteAnio
    : fechasDeSemanaSanta(hoy.getFullYear() + 1)
  return { ...fechas, faltan: diasHasta(fechas.ramos, hoy) }
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** «21 de marzo», para escribirla en la página. */
export function enPalabras(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]}`
}

/** «21 mar», para las listas apretadas. */
export function enCorto(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1].slice(0, 3)}`
}
