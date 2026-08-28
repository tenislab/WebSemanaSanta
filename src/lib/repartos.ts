/**
 * GASTOS PORCENTUALES ENLAZADOS A UNA PARTIDA.
 *
 * Lo que se pidió, tal cual: «opción de añadir gastos porcentuales a los
 * ingresos, gastos, etc. que se pueda enlazar».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SON DOS COSAS DISTINTAS, Y ESTÁN LAS DOS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La frase admite dos lecturas, las dos normales en una hermandad, y el «a los
 * ingresos, GASTOS, etc.» dice que la regla se engancha a cualquiera de los
 * dos. Así que se hacen las dos y se elige al crearla:
 *
 *   · REPARTO — trocear un gasto REAL entre partidas.
 *     «La luz de la casa hermandad: 60 % a la casa, 40 % al almacén.»
 *     El dinero ya ha salido y la cifra total NO cambia: solo se dice a qué
 *     corresponde cada trozo. Un reparto que sumara distinto al gasto que
 *     trocea estaría inventando dinero.
 *
 *   · COMPROMISO — apartar un % de lo que entre por una partida.
 *     «El 10 % de lo que saque la lotería va a caridad.»
 *     Aquí NO ha salido dinero todavía: es una decisión de la junta sobre
 *     dinero que ha entrado. Suma un gasto que en el libro no está.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NINGUNA DE LAS DOS ESCRIBE EN TESORERÍA. NUNCA.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Esta es la decisión que hay que entender antes de tocar nada aquí.
 *
 * Un compromiso NO es un gasto: es dinero que sigue en la cuenta. Si se
 * apuntara en el libro, pasarían las dos cosas malas a la vez:
 *
 *   1. EL SALDO DEJARÍA DE CUADRAR CON EL BANCO. El libro diría que hay 1.000 €
 *      menos de los que hay. Y el tesorero, conciliando, buscaría en el
 *      extracto un pago que no existe.
 *
 *   2. SE CONTARÍA DOS VECES. El día que de verdad se le dé el dinero a
 *      caridad, ESE sí es un apunte real. Con el compromiso ya apuntado, la
 *      caridad saldría por el doble de lo que se dio.
 *
 * Un reparto tampoco: el gasto ya está en el libro entero y por su importe
 * bueno. Trocearlo ahí sería sustituir una línea que cuadra con la factura por
 * tres que no cuadran con nada.
 *
 * Así que esto vive SOLO en el informe. La cuenta de pérdidas y ganancias
 * enseña las dos cifras —la real y la de después de aplicar las reglas— y dice
 * en el papel cuál es cuál. Ver `lib/perdidasYGanancias.ts`.
 */
import { useSupabaseTable } from './supabaseSync'
import { CLAVES_DATOS } from './persistencia'
import { repartoToRow, rowToReparto } from './db/repartos'
import { REPARTOS_INICIALES } from '../data/repartos'

export type TipoReparto = 'reparto' | 'compromiso'

export interface Reparto {
  id: string
  nombre: string
  tipo: TipoReparto
  /**
   * La partida a la que se ENGANCHA: una categoría de `data/movimientos.ts`.
   * Es «lo que se pueda enlazar» de la petición.
   */
  categoriaBase: string
  /**
   * Qué porcentaje. Se guarda en CENTÉSIMAS DE PUNTO (12,5 % → 1250) por lo
   * mismo que el dinero va en céntimos: en decimales, 33,33 % de tres partidas
   * no suma 100 y la diferencia sale en el papel.
   */
  porcentajeCent: number
  /** A qué partida va el trozo. En un reparto es otra partida de gasto; en un compromiso, la de destino. */
  categoriaDestino: string
  activo: boolean
  /** Para qué es, dicho por quien la creó. Sale en el informe. */
  nota: string
  creadoEn: string
}

/** El porcentaje como número normal, para enseñarlo y para escribirlo. */
export function porcentajeDe(r: Pick<Reparto, 'porcentajeCent'>): number {
  return r.porcentajeCent / 100
}

/**
 * Aplicar un porcentaje a un importe, en enteros.
 *
 * Todo son enteros —céntimos por centésimas de punto— y el empate se decide a
 * mano, hacia arriba, que es el mismo criterio que `round(numeric, 2)` en
 * Postgres. Comprobado contra la base de verdad: los mismos casos dan lo mismo
 * en los dos sitios.
 *
 * Y ES IMPORTANTE QUE COINCIDA, aunque el redondeo ingenuo también acierte en
 * los importes que maneja una hermandad —se midió, y no hay ni una diferencia
 * en 27.000 combinaciones—. El motivo no es que falle hoy: es que el día que
 * alguien saque el mismo informe con una consulta a la base, las dos cifras
 * tienen que ser la misma, o habrá dos papeles del mismo año que no cuadran y
 * los dos parecerán correctos. Aquí no se ahorra nada escribiéndolo con float.
 */
export function trozo(importeCent: number, porcentajeCent: number): number {
  const num = importeCent * porcentajeCent
  const resto = num % 10000
  const cociente = (num - resto) / 10000
  return resto * 2 >= 10000 ? cociente + 1 : cociente
}

/**
 * ¿QUÉ LE PASA A ESTA REGLA?
 *
 * Devuelve `null` si está bien. Los mensajes dicen qué hacer, no «datos
 * inválidos»: quien las escribe es el tesorero, no un informático.
 */
export function problemaDeReparto(r: Partial<Reparto>): string | null {
  if (!(r.nombre ?? '').trim()) return 'Ponle un nombre: es lo que sale en el informe.'
  if (!(r.categoriaBase ?? '').trim()) return 'Elige de qué partida sale.'
  if (!(r.categoriaDestino ?? '').trim()) return 'Elige a qué partida va.'
  /*
   * ENGANCHARLA A SÍ MISMA no da error en ninguna parte y deja un informe
   * absurdo: «el 40 % de Mantenimiento va a Mantenimiento». Se caza aquí
   * porque es un despiste de un clic —las dos listas son idénticas— y después
   * nadie entiende por qué los números no cambian.
   */
  if (r.categoriaBase === r.categoriaDestino) {
    return 'La partida de origen y la de destino son la misma, así que no repartiría nada.'
  }
  const pct = r.porcentajeCent ?? 0
  if (!(pct > 0)) return 'El porcentaje tiene que ser mayor que cero.'
  if (pct > 10000) return 'No se puede repartir más del 100 %.'
  return null
}

/**
 * ¿SE ESTÁ REPARTIENDO MÁS DEL 100 % DE UNA PARTIDA?
 *
 * Cada regla por su cuenta puede ser perfectamente razonable —60 % aquí, 60 %
 * allá— y entre las dos sacar de una partida más dinero del que tiene. Eso no
 * lo puede ver quien escribe la segunda: solo se ve sumando todas las que
 * cuelgan de la misma partida, que es lo que hace esto.
 *
 * Se avisa pero NO se bloquea, y a propósito: solo pasa de verdad con los
 * repartos —un gasto real no se puede trocear en más de lo que es—, mientras
 * que con los compromisos es una decisión legítima aunque rara. Quien manda es
 * el tesorero; lo que no puede es no enterarse.
 */
export function seRepartenDeMas(reglas: readonly Reparto[]): string[] {
  const suma = new Map<string, number>()
  for (const r of reglas) {
    if (!r.activo || r.tipo !== 'reparto') continue
    suma.set(r.categoriaBase, (suma.get(r.categoriaBase) ?? 0) + r.porcentajeCent)
  }
  return [...suma.entries()]
    .filter(([, pct]) => pct > 10000)
    .map(([cat, pct]) => `«${cat}»: entre todas las reglas se reparte el ${pct / 100} %, que es más de lo que hay.`)
    .sort()
}

/** Las que están encendidas, que son las que entran en el informe. */
export function lasQueCuentan(reglas: readonly Reparto[]): Reparto[] {
  return reglas.filter((r) => r.activo)
}

/** Cómo se lee una regla en una línea, para el informe y para la lista. */
export function comoSeLeeElReparto(r: Reparto): string {
  const pct = porcentajeDe(r)
  return r.tipo === 'reparto'
    ? `${pct} % de «${r.categoriaBase}» se imputa a «${r.categoriaDestino}»`
    : `${pct} % de «${r.categoriaBase}» se aparta para «${r.categoriaDestino}»`
}

export function useRepartos() {
  return useSupabaseTable<Reparto>(
    'reglas_reparto',
    CLAVES_DATOS.repartos,
    REPARTOS_INICIALES,
    repartoToRow,
    rowToReparto,
    'creado_en',
  )
}
