/**
 * LA CUENTA DE PÉRDIDAS Y GANANCIAS.
 *
 * Lo que se pidió: «al crear informe, crear cuenta de pérdidas y ganancias».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO ES EL ESTADO DE CUENTAS QUE YA HABÍA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * El Estado de Cuentas (`components/EstadoCuentas.tsx`) es el papel que piden
 * las diócesis: qué entró, qué salió y con cuánto se acaba el año. Cuenta el
 * DINERO, y lo que le importa es que el saldo final cuadre con el banco.
 *
 * La cuenta de pérdidas y ganancias contesta otra pregunta: ¿la hermandad se
 * sostiene? Por eso trae tres cosas que el otro no tiene:
 *
 *   · EL AÑO ANTERIOR AL LADO. Un resultado suelto no dice nada. «12.000 €» no
 *     es bueno ni malo hasta que se sabe que el año pasado fueron 19.000.
 *   · EL PESO DE CADA PARTIDA sobre el total. Es lo que enseña de un vistazo
 *     que la mitad de los ingresos son de una sola cosa, que es el dato que
 *     hace falta antes de que esa cosa falle.
 *   · LOS GASTOS PORCENTUALES enganchados a las partidas (`lib/repartos.ts`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAS DOS COLUMNAS, Y POR QUÉ SON DOS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * El informe enseña SIEMPRE las dos cifras:
 *
 *   RESULTADO DEL EJERCICIO      lo que dice el libro. Cuadra con el banco.
 *   RESULTADO DESPUÉS DE REGLAS  lo mismo, aplicando los repartos y restando
 *                                los compromisos.
 *
 * Y no se puede enseñar solo la segunda por muy útil que sea, porque no cuadra
 * con la cuenta corriente: un compromiso es dinero que sigue estando. Quien
 * lleva ese número a un cabildo y le preguntan «¿y cuánto hay en el banco?»
 * tiene que poder señalar la otra columna. Las dos, siempre, y dicho cuál es
 * cuál.
 *
 * Todo en CÉNTIMOS por dentro y dividido al final. Sumando euros con decimales,
 * cuarenta apuntes dan 12.399,999999999998 y eso sale impreso tal cual.
 */
import type { Movimiento } from '../data/movimientos'
import { CATEGORIAS_INGRESO, CATEGORIAS_GASTO } from '../data/movimientos'
import { trozo, type Reparto } from './repartos'

/**
 * EL AÑO DE UN MOVIMIENTO, Y `movimientos.fecha` GUARDA DOS FORMATOS A LA VEZ.
 *
 * Cuando lo escribe a mano la secretaría desde Tesorería, es el que se lee:
 * «05 ene 2026». Pero cuando lo escribe una función del servidor —cobrar una
 * venta de la tienda, un pago con tarjeta— es `to_char(now(), 'YYYY-MM-DD')`,
 * o sea «2026-01-05». La columna es texto libre y las dos conviven en la
 * misma tabla, así que esto tiene que saber leer las dos.
 *
 * Se probó con los últimos 4 caracteres nada más, que es lo que vale para el
 * primer formato. Para el segundo saca el mes y el día, no el año: en
 * «2026-08-29» los últimos 4 son «8-29», y `Number('8-29')` es `NaN`. Cada
 * venta de la tienda y cada cuota cobrada con tarjeta desaparecía de la cuenta
 * de pérdidas y ganancias, del Estado de Cuentas y del selector de años de
 * Informes, sin un solo error: los tres leían 0 € donde había dinero de
 * verdad. Se pilló al probar una venta de la tienda en el navegador y ver
 * cómo el total de ingresos del año se iba a cero de golpe.
 */
export function anioDelMovimiento(fecha: string): number {
  const f = (fecha ?? '').trim()
  const iso = /^(\d{4})-\d{2}-\d{2}/.exec(f)
  if (iso) return Number(iso[1])
  return Number(f.slice(-4)) || 0
}

const cent = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) : 0)
/** `-0` se imprime «-0,00 €» y asusta a quien lo ve. Y `-0 === 0`. */
const sinCeroNegativo = (n: number) => (n === 0 ? 0 : n)

export interface LineaPyG {
  categoria: string
  /** Lo que dice el libro, en euros. */
  importe: number
  /** Lo mismo del año anterior, para poder comparar. */
  importeAnterior: number
  /** Qué parte del total representa, de 0 a 100. */
  peso: number
  /**
   * Lo que le suman o le quitan las reglas porcentuales, en euros.
   * Cero cuando no hay ninguna regla que la toque.
   */
  ajuste: number
}

export interface CuentaPyG {
  anio: number
  ingresos: LineaPyG[]
  gastos: LineaPyG[]
  totalIngresos: number
  totalGastos: number
  /** Lo que dice el libro. Cuadra con el banco. */
  resultado: number
  totalIngresosAnterior: number
  totalGastosAnterior: number
  resultadoAnterior: number
  /** Lo apartado por compromisos: dinero que sigue en la cuenta pero ya tiene dueño. */
  comprometido: number
  /** El resultado una vez aplicadas las reglas. NO cuadra con el banco, y se dice. */
  resultadoAjustado: number
  /** Las reglas que de verdad han movido algo, para poder listarlas en el papel. */
  reglasAplicadas: { regla: Reparto, importe: number }[]
}

/**
 * Suma por partida, en céntimos.
 *
 * Lo que no encaja en ninguna categoría conocida NO se pierde: va a «Otros».
 * Perder una línea en un informe de cuentas es la peor manera de fallar,
 * porque el papel sigue cuadrando consigo mismo y nadie lo nota.
 */
function porPartida(movs: readonly Movimiento[], categorias: readonly string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const mov of movs) {
    const cat = categorias.includes(mov.categoria) ? mov.categoria : 'Otros'
    m.set(cat, (m.get(cat) ?? 0) + cent(mov.importe))
  }
  return m
}

/**
 * LA CUENTA ENTERA.
 *
 * Función pura y sin React a propósito: es aritmética de dinero que acaba en
 * un papel firmado, y así se puede comprobar cifra a cifra sin montar nada.
 */
export function cuentaDeResultados(
  movimientos: readonly Movimiento[],
  anio: number,
  reglas: readonly Reparto[] = [],
): CuentaPyG {
  const delAnio = movimientos.filter((m) => anioDelMovimiento(m.fecha) === anio)
  const delAnterior = movimientos.filter((m) => anioDelMovimiento(m.fecha) === anio - 1)

  const ingresosCent = porPartida(delAnio.filter((m) => m.tipo === 'Ingreso'), CATEGORIAS_INGRESO)
  const gastosCent = porPartida(delAnio.filter((m) => m.tipo === 'Gasto'), CATEGORIAS_GASTO)
  const ingresosAnteriorCent = porPartida(delAnterior.filter((m) => m.tipo === 'Ingreso'), CATEGORIAS_INGRESO)
  const gastosAnteriorCent = porPartida(delAnterior.filter((m) => m.tipo === 'Gasto'), CATEGORIAS_GASTO)

  const suma = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0)
  const totalIngresosCent = suma(ingresosCent)
  const totalGastosCent = suma(gastosCent)

  /*
   * LAS REGLAS, PARTIDA A PARTIDA.
   *
   * `ajustes` guarda lo que cada partida gana o pierde, en céntimos:
   *   · Un REPARTO quita de la base y pone en el destino. La suma de los dos
   *     movimientos es cero, así que el total de gastos NO cambia — que es lo
   *     que tiene que pasar: el dinero ya salió y por ese importe.
   *   · Un COMPROMISO no quita de ningún sitio: aparta. Suma en el destino y
   *     se acumula en `comprometido`, que se resta del resultado al final.
   */
  const ajustes = new Map<string, number>()
  const suelta = (cat: string, n: number) => ajustes.set(cat, (ajustes.get(cat) ?? 0) + n)
  const reglasAplicadas: { regla: Reparto, importe: number }[] = []
  let comprometidoCent = 0

  for (const regla of reglas) {
    if (!regla.activo) continue
    // La base puede ser una partida de ingreso o de gasto: «a los ingresos,
    // gastos, etc.». Se busca en las dos.
    const baseCent = ingresosCent.get(regla.categoriaBase) ?? gastosCent.get(regla.categoriaBase) ?? 0
    if (baseCent === 0) continue
    const importeCent = trozo(baseCent, regla.porcentajeCent)
    if (importeCent === 0) continue

    if (regla.tipo === 'reparto') {
      suelta(regla.categoriaBase, -importeCent)
      suelta(regla.categoriaDestino, importeCent)
    } else {
      suelta(regla.categoriaDestino, importeCent)
      comprometidoCent += importeCent
    }
    reglasAplicadas.push({ regla, importe: importeCent / 100 })
  }

  /*
   * Las partidas se ordenan DE MAYOR A MENOR, no alfabéticamente.
   *
   * Un informe de cuentas se lee por arriba: lo que se quiere saber es de
   * dónde sale la mayor parte del dinero y en qué se va. Por orden alfabético
   * eso queda repartido por toda la hoja y hay que leerla entera.
   */
  function lineas(
    actual: Map<string, number>,
    anterior: Map<string, number>,
    totalCent: number,
    categorias: readonly string[],
  ): LineaPyG[] {
    /*
     * Las partidas que solo existen en las reglas también salen: si un
     * compromiso manda dinero a «Obras Benéficas» y este año no hubo ningún
     * gasto ahí, la línea tiene que aparecer igual o el ajuste no se ve.
     *
     * PERO SOLO EN SU TABLA. Sin el filtro por `categorias`, una partida
     * ajustada se colaba en LAS DOS: la tabla de INGRESOS salía con tres
     * líneas de gasto —«Mantenimiento», «Obras Benéficas»— a cero euros y con
     * su ajuste al lado. No cambiaba ningún total, así que el papel seguía
     * cuadrando consigo mismo; solo estaba diciendo que la hermandad ingresa
     * por Mantenimiento. Se vio abriendo el informe, no en una prueba.
     */
    const todas = new Set([...actual.keys(), ...anterior.keys()])
    for (const [cat] of ajustes) if (categorias.includes(cat)) todas.add(cat)
    return [...todas]
      .map((categoria) => {
        const importeCent = actual.get(categoria) ?? 0
        return {
          categoria,
          importe: sinCeroNegativo(importeCent / 100),
          importeAnterior: sinCeroNegativo((anterior.get(categoria) ?? 0) / 100),
          peso: totalCent > 0 ? (importeCent / totalCent) * 100 : 0,
          ajuste: sinCeroNegativo((ajustes.get(categoria) ?? 0) / 100),
        }
      })
      // Fuera las que no tienen nada de nada: ni este año, ni el pasado, ni ajuste.
      .filter((l) => l.importe !== 0 || l.importeAnterior !== 0 || l.ajuste !== 0)
      .sort((a, b) => (b.importe - a.importe) || a.categoria.localeCompare(b.categoria, 'es'))
  }

  const totalIngresosAnteriorCent = suma(ingresosAnteriorCent)
  const totalGastosAnteriorCent = suma(gastosAnteriorCent)

  return {
    anio,
    ingresos: lineas(ingresosCent, ingresosAnteriorCent, totalIngresosCent, CATEGORIAS_INGRESO),
    gastos: lineas(gastosCent, gastosAnteriorCent, totalGastosCent, CATEGORIAS_GASTO),
    totalIngresos: sinCeroNegativo(totalIngresosCent / 100),
    totalGastos: sinCeroNegativo(totalGastosCent / 100),
    resultado: sinCeroNegativo((totalIngresosCent - totalGastosCent) / 100),
    totalIngresosAnterior: sinCeroNegativo(totalIngresosAnteriorCent / 100),
    totalGastosAnterior: sinCeroNegativo(totalGastosAnteriorCent / 100),
    resultadoAnterior: sinCeroNegativo((totalIngresosAnteriorCent - totalGastosAnteriorCent) / 100),
    comprometido: sinCeroNegativo(comprometidoCent / 100),
    resultadoAjustado: sinCeroNegativo((totalIngresosCent - totalGastosCent - comprometidoCent) / 100),
    reglasAplicadas,
  }
}

/**
 * CUÁNTO HA CAMBIADO RESPECTO AL AÑO PASADO, en porcentaje.
 *
 * `null` cuando el año anterior fue cero, y ese caso importa: dividir entre
 * cero da `Infinity`, que se imprime «∞ %» en un documento que se firma. Y no
 * hay ningún porcentaje que describa pasar de nada a algo — eso se dice con
 * palabras, no con una cifra.
 */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return ((actual - anterior) / Math.abs(anterior)) * 100
}

/**
 * Cómo se lee el resultado, en una frase.
 *
 * Se separa de la pantalla para poder comprobarlo: cambia según el signo y
 * según si hay compromisos, y eso metido entre el JSX no hay quien lo lea.
 */
export function comoSeLeeElResultado(c: CuentaPyG): string {
  const hayCompromisos = c.comprometido > 0
  if (c.resultado > 0) {
    return hayCompromisos && c.resultadoAjustado <= 0
      ? 'El ejercicio cierra en positivo, pero una vez apartados los compromisos no queda margen.'
      : 'El ejercicio cierra en positivo: ha entrado más de lo que ha salido.'
  }
  if (c.resultado < 0) return 'El ejercicio cierra en negativo: se ha gastado más de lo que ha entrado.'
  return 'El ejercicio cierra en equilibrio: ha entrado exactamente lo que ha salido.'
}
