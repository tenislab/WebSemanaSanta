/**
 * LA ANTIGÜEDAD DE UN HERMANO, Y LO QUE SE LE RECONOCE POR ELLA.
 *
 * En una hermandad los años cuentan. Se cuentan para el sitio en el cortejo,
 * para el orden de la nómina y para las distinciones que se entregan en el
 * cabildo: a los veinticinco años bodas de plata, a los cincuenta bodas de oro,
 * a los setenta y cinco bodas de diamante. No es un adorno inventado aquí — es
 * lo que hacen las hermandades desde siempre, y lo primero que dice un hermano
 * mayor al presentar a alguien.
 *
 * La aplicación lo tenía guardado y no lo enseñaba en ninguna parte: el carné
 * de un hermano de cincuenta y dos años en la casa era exactamente igual que el
 * de uno que entró en marzo. Aquí se decide qué distinción le corresponde a
 * cada uno, y de aquí lo leen el carné y la tarjeta que sale al escanear su QR.
 *
 * SE DECIDE UNA VEZ Y EN UN SITIO. Repartido por las dos pantallas, el día que
 * una hermandad pida cambiar el corte de los veinticinco años habría que
 * acordarse de los dos — y el carné y el QR dirían cosas distintas del mismo
 * hermano, que es lo peor que puede pasar en un documento que se enseña para
 * acreditarse.
 */

export type ModeloDeCarne = 'nuevo' | 'hermano' | 'veterano' | 'plata' | 'oro' | 'diamante'

export interface Distincion {
  modelo: ModeloDeCarne
  /** Lo que se lee en la cinta del carné. */
  titulo: string
  /** La línea de debajo. Vacía cuando no hay nada que añadir. */
  detalle: string
  /**
   * Si esta distinción se estrena ESTE año. Es el dato que convierte el carné
   * en un aviso: la hermandad tiene que saber a quién le tocan las bodas de
   * plata en el cabildo de este año.
   */
  esteAnio: boolean
}

/**
 * Los escalones, del más alto al más bajo. En este orden a propósito: se coge
 * el primero que se cumpla, así que añadir uno nuevo en medio no obliga a
 * tocar los demás.
 *
 * Los cortes son los de siempre: 75 diamante, 50 oro, 25 plata. Los de 10 y 0
 * no son distinciones de cabildo — son para que el carné de alguien que lleva
 * doce años no sea idéntico al de quien entró la semana pasada.
 */
const ESCALONES: { desde: number; modelo: ModeloDeCarne; titulo: string }[] = [
  { desde: 75, modelo: 'diamante', titulo: 'Bodas de diamante' },
  { desde: 50, modelo: 'oro', titulo: 'Bodas de oro' },
  { desde: 25, modelo: 'plata', titulo: 'Bodas de plata' },
  { desde: 10, modelo: 'veterano', titulo: 'Hermano/a veterano/a' },
  { desde: 1, modelo: 'hermano', titulo: 'Hermano/a de la casa' },
]

/**
 * Qué le corresponde a quien lleva `anios` años.
 *
 * `anios` es null cuando la antigüedad no consta: entonces no se inventa nada
 * —ni «0 años» ni una distinción— y el carné sale en su forma normal. Poner
 * «de nuevo ingreso» a alguien de cuarenta años en la casa porque su ficha vino
 * de un Excel sin fecha sería peor que no poner nada.
 */
export function distincionDe(anios: number | null): Distincion {
  if (anios === null) {
    return { modelo: 'hermano', titulo: 'Hermano/a de la casa', detalle: '', esteAnio: false }
  }
  if (anios <= 0) {
    return {
      modelo: 'nuevo',
      titulo: 'De nuevo ingreso',
      detalle: 'Bienvenido/a a la casa',
      esteAnio: true,
    }
  }
  const escalon = ESCALONES.find((e) => anios >= e.desde) ?? ESCALONES[ESCALONES.length - 1]
  return {
    modelo: escalon.modelo,
    titulo: escalon.titulo,
    detalle: `${anios} ${anios === 1 ? 'año' : 'años'} en la hermandad`,
    // El año en que se cruza el escalón. En «hermano» y «veterano» también
    // vale: son los años en que se cumplen diez, o el primero.
    esteAnio: anios === escalon.desde,
  }
}

/**
 * Cuántos años faltan para la siguiente distinción de cabildo, y cuál es.
 *
 * Solo cuenta las de verdad —plata, oro, diamante—: decirle a alguien que le
 * faltan dos años para ser «veterano» no significa nada, porque eso no se
 * entrega en ningún sitio.
 *
 * Devuelve null cuando no queda ninguna por delante (ya tiene la de diamante)
 * o cuando la antigüedad no consta.
 */
export function siguienteDistincion(anios: number | null): { titulo: string; faltan: number } | null {
  if (anios === null) return null
  const deCabildo = ESCALONES.filter((e) => e.desde >= 25).sort((a, b) => a.desde - b.desde)
  const proxima = deCabildo.find((e) => e.desde > anios)
  if (!proxima) return null
  return { titulo: proxima.titulo, faltan: proxima.desde - anios }
}
