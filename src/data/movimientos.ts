export type TipoMovimiento = 'Ingreso' | 'Gasto'
export type EstadoMovimiento = 'Conciliado' | 'Pendiente'
/** Cuenta de tesorería; la lista la define cada hermandad en Configuración. */
export type CuentaMovimiento = string

export const CUENTAS_POR_DEFECTO = ['Cuenta bancaria', 'Caja'] as const

export interface Movimiento {
  id: string
  numero: number
  fecha: string
  concepto: string
  categoria: string
  tipo: TipoMovimiento
  importe: number
  cuenta: CuentaMovimiento
  estado: EstadoMovimiento
  /**
   * De dónde salió este apunte: `cuota:<id>`, `papeleta:<id>`, o nada si lo
   * escribió alguien a mano en Tesorería. Ver `lib/apuntes.ts`.
   */
  origen?: string
}

/**
 * Coinciden a propósito con las partidas del Estado de Cuentas anual que
 * suelen pedir las diócesis (ver EstadoCuentas.tsx): así los movimientos que
 * se van registrando durante el año ya quedan listos para ese informe, sin
 * tener que reclasificarlos a mano en diciembre.
 */
export const CATEGORIAS_INGRESO = [
  'Cuotas Hermanos/as',
  'Donativos, Ofrendas y Cepillos',
  'Subvenciones',
  /*
   * EL IVA REPERCUTIDO NO ES DINERO DE LA HERMANDAD, y por eso tiene partida
   * propia en vez de ir metido dentro de «Otros ingresos».
   *
   * Cuando se vende una camiseta a 15 €, 12,40 € son de la hermandad y 5,21 €
   * (perdón, 2,60 €) se le están cobrando a quien compra PARA HACIENDA. Van a
   * la misma cuenta —entran en la misma caja— pero no son lo mismo: con los
   * dos sumados en una sola línea, el libro dice que la tienda ingresa un 21 %
   * más de lo que ingresa, y en el modelo 303 no hay de dónde sacar la cifra
   * sin volver a recorrer las facturas una a una.
   *
   * Está aquí como ingreso porque este libro es de CAJA —lo que entra y lo que
   * sale—, no de partida doble. En una contabilidad de verdad sería una
   * deuda con Hacienda, no un ingreso.
   */
  'IVA repercutido',
  'Otros ingresos',
] as const
export const CATEGORIAS_GASTO = [
  'Mantenimiento',
  'Secretaría',
  'Cultos Internos',
  'Cultos Externos',
  'Obras Benéficas y Sociales',
  '10% Fondo Diocesano de Solidaridad',
  '0,7% Ayuda al Tercer Mundo',
  'Restauraciones',
  'Nuevas Adquisiciones',
  'Compra y amortización de Inmuebles',
  'Gastos varios menores',
  // El IVA de las compras, que se puede descontar del repercutido, y lo que
  // al final se le ingresa a Hacienda. Dos partidas y no una: lo primero
  // entra en el 303 a favor y lo segundo es la salida de dinero de verdad.
  'IVA soportado',
  'Liquidación de IVA (modelo 303)',
  'Otros gastos extraordinarios',
] as const

/** Movimientos de ejemplo de caja: ingresos y gastos del ejercicio, mientras conectamos la base de datos. */
export const MOVIMIENTOS_INICIALES: Movimiento[] = [
  { id: 'm1', numero: 101, fecha: '05 ene 2026', concepto: 'Cuotas de enero', categoria: 'Cuotas Hermanos/as', tipo: 'Ingreso', importe: 1240, cuenta: 'Cuenta bancaria', estado: 'Conciliado' },
  { id: 'm2', numero: 102, fecha: '08 ene 2026', concepto: 'Donativo de un hermano', categoria: 'Donativos, Ofrendas y Cepillos', tipo: 'Ingreso', importe: 300, cuenta: 'Cuenta bancaria', estado: 'Conciliado' },
  { id: 'm3', numero: 103, fecha: '12 ene 2026', concepto: 'Recibo de la luz de la casa hermandad', categoria: 'Mantenimiento', tipo: 'Gasto', importe: 186.4, cuenta: 'Cuenta bancaria', estado: 'Conciliado' },
  { id: 'm4', numero: 104, fecha: '15 ene 2026', concepto: 'Flores para el altar de cultos', categoria: 'Cultos Internos', tipo: 'Gasto', importe: 420, cuenta: 'Caja', estado: 'Conciliado' },
  { id: 'm5', numero: 105, fecha: '20 ene 2026', concepto: 'Restauración de un candelabro', categoria: 'Nuevas Adquisiciones', tipo: 'Gasto', importe: 950, cuenta: 'Cuenta bancaria', estado: 'Pendiente' },
  { id: 'm6', numero: 106, fecha: '22 ene 2026', concepto: 'Subvención del ayuntamiento', categoria: 'Subvenciones', tipo: 'Ingreso', importe: 800, cuenta: 'Cuenta bancaria', estado: 'Pendiente' },
  { id: 'm7', numero: 107, fecha: '28 ene 2026', concepto: 'Seguro de responsabilidad civil', categoria: 'Gastos varios menores', tipo: 'Gasto', importe: 275, cuenta: 'Cuenta bancaria', estado: 'Conciliado' },
  { id: 'm8', numero: 108, fecha: '02 feb 2026', concepto: 'Cuotas de febrero', categoria: 'Cuotas Hermanos/as', tipo: 'Ingreso', importe: 1180, cuenta: 'Cuenta bancaria', estado: 'Pendiente' },
  { id: 'm9', numero: 109, fecha: '04 feb 2026', concepto: 'Reparto de caridad a familias necesitadas', categoria: 'Obras Benéficas y Sociales', tipo: 'Gasto', importe: 500, cuenta: 'Caja', estado: 'Conciliado' },
  { id: 'm10', numero: 110, fecha: '06 feb 2026', concepto: 'Cera para los cultos de Cuaresma', categoria: 'Cultos Internos', tipo: 'Gasto', importe: 310.5, cuenta: 'Cuenta bancaria', estado: 'Pendiente' },

  /*
   * LO QUE HA ENTRADO POR LAS CAMPAÑAS.
   *
   * Estos apuntes son lo ÚNICO que hace que las barras de «Campañas y
   * proyectos» enseñen algo: lo recaudado no se guarda en la campaña, se cuenta
   * desde aquí. Por eso el `origen` tiene que llevar exactamente el
   * identificador de `data/objetivos.ts` — hay una prueba que vigila que las
   * dos mitades no se separen.
   *
   * Y por eso están en el libro y no en una lista aparte: si estuvieran
   * aparte, este dinero no saldría en Tesorería ni en el Estado de Cuentas, que
   * es exactamente la avería que se vino a arreglar.
   *
   * El último es un GASTO de la campaña —la imprenta de las huchas— y se resta
   * de lo recaudado. Enseñar lo bruto como si fuera lo disponible es mentir
   * sobre cuánto falta: el palio se paga con lo que queda.
   */
  { id: 'mc1', numero: 111, fecha: '10 ene 2026', concepto: 'Restauración del palio — donativo de un matrimonio', categoria: 'Donativos, Ofrendas y Cepillos', tipo: 'Ingreso', importe: 5000, cuenta: 'Cuenta bancaria', estado: 'Conciliado', origen: 'campana:camp-palio:ap1' },
  { id: 'mc2', numero: 112, fecha: '18 ene 2026', concepto: 'Restauración del palio — hucha de la casa hermandad', categoria: 'Donativos, Ofrendas y Cepillos', tipo: 'Ingreso', importe: 1340.5, cuenta: 'Caja', estado: 'Conciliado', origen: 'campana:camp-palio:ap2' },
  { id: 'mc3', numero: 113, fecha: '03 feb 2026', concepto: 'Restauración del palio — rifa de Cuaresma', categoria: 'Donativos, Ofrendas y Cepillos', tipo: 'Ingreso', importe: 2870, cuenta: 'Caja', estado: 'Pendiente', origen: 'campana:camp-palio:ap3' },
  { id: 'mc4', numero: 114, fecha: '05 feb 2026', concepto: 'Restauración del palio — huchas para las casas', categoria: 'Gastos varios menores', tipo: 'Gasto', importe: 145, cuenta: 'Caja', estado: 'Conciliado', origen: 'campana:camp-palio:gasto1' },
  { id: 'mc5', numero: 115, fecha: '25 ene 2026', concepto: 'Cepillo de caridad — enero', categoria: 'Donativos, Ofrendas y Cepillos', tipo: 'Ingreso', importe: 418.25, cuenta: 'Caja', estado: 'Conciliado', origen: 'campana:camp-caridad:ap1' },
  { id: 'mc6', numero: 116, fecha: '24 feb 2026', concepto: 'Cepillo de caridad — febrero', categoria: 'Donativos, Ofrendas y Cepillos', tipo: 'Ingreso', importe: 502.8, cuenta: 'Caja', estado: 'Conciliado', origen: 'campana:camp-caridad:ap2' },
  // La campaña del tejado llegó a su objetivo y se cerró: es lo que se mira al
  // año siguiente para saber si una campaña de ese tamaño es realista.
  { id: 'mc7', numero: 117, fecha: '20 nov 2025', concepto: 'Tejado — colecta extraordinaria', categoria: 'Donativos, Ofrendas y Cepillos', tipo: 'Ingreso', importe: 9150, cuenta: 'Cuenta bancaria', estado: 'Conciliado', origen: 'campana:camp-tejado:ap1' },
]

// ----------------------------------------------------------------------------
//   EL IVA
// ----------------------------------------------------------------------------

/**
 * LAS PARTIDAS QUE SON IVA, no dinero de la hermandad.
 *
 * Se nombran aquí y no se reconocen «por si el nombre lleva IVA dentro»:
 * una hermandad puede llamar a una partida suya «Reforma del IVA de la casa»
 * y no por eso es IVA. Lo que cuenta es cuál de estas es.
 */
export const CATEGORIA_IVA_REPERCUTIDO = 'IVA repercutido'
export const CATEGORIA_IVA_SOPORTADO = 'IVA soportado'
export const CATEGORIA_IVA_LIQUIDACION = 'Liquidación de IVA (modelo 303)'

/** Lo que hay que saber para rellenar un 303. */
export interface PosicionIva {
  /** El que se ha cobrado a quien compra. Se le debe a Hacienda. */
  repercutido: number
  /** El de las compras. Se descuenta del anterior. */
  soportado: number
  /** Lo que ya se le ha ingresado a Hacienda en el periodo. */
  liquidado: number
  /**
   * Lo que queda por ingresar: repercutido − soportado − lo ya liquidado.
   *
   * PUEDE SALIR NEGATIVO, y no es un error: significa que se ha soportado más
   * IVA del que se ha repercutido, y entonces es Hacienda quien debe. Redondear
   * eso a cero —que es la tentación— sería esconder un dinero a favor.
   */
  aIngresar: number
}

/**
 * LA POSICIÓN DE IVA DE UN PERIODO.
 *
 * Existe porque separar el IVA en su propia partida no sirve de nada si luego
 * hay que sumarlo a mano: lo que se quiere saber es cuánto hay que ingresarle
 * a Hacienda este trimestre, y eso es una resta.
 *
 * SE CUENTAN LOS INGRESOS Y LOS GASTOS DE CADA PARTIDA, no solo los ingresos.
 * Una venta anulada mete un GASTO en «IVA repercutido» para deshacer el
 * ingreso: contando solo los ingresos, el 303 saldría con el IVA de una venta
 * que ya no existe.
 *
 * En céntimos enteros, como todo el dinero de esta casa.
 */
export function posicionDeIva(movimientos: readonly Movimiento[]): PosicionIva {
  const cent = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) : 0)
  // Un ingreso suma y un gasto resta, dentro de la misma partida.
  const neto = (categoria: string) => movimientos.reduce(
    (n, m) => (m.categoria !== categoria ? n : n + (m.tipo === 'Ingreso' ? cent(m.importe) : -cent(m.importe))),
    0,
  )
  /*
   * `-0` NO ES CERO CUANDO SE IMPRIME. En JavaScript, `-0 === 0` es cierto,
   * pero `formatCurrency(-0)` escribe «-0,00 €», y en una cifra de dinero eso
   * se lee como un error de la aplicación. Salió en pantalla a la primera:
   * una hermandad sin IVA soportado veía «Ya liquidado: -0,00 €».
   *
   * `n === 0 ? 0 : n` lo arregla justamente porque `-0 === 0`: cambia el cero
   * negativo por el positivo y deja lo demás como está.
   */
  const sinCeroNegativo = (n: number) => (n === 0 ? 0 : n)

  const repercutido = neto(CATEGORIA_IVA_REPERCUTIDO)
  // El soportado y el liquidado son gastos, así que su neto sale en negativo:
  // se le da la vuelta para que se lean como lo que son.
  const soportado = -neto(CATEGORIA_IVA_SOPORTADO)
  const liquidado = -neto(CATEGORIA_IVA_LIQUIDACION)
  return {
    repercutido: sinCeroNegativo(repercutido / 100),
    soportado: sinCeroNegativo(soportado / 100),
    liquidado: sinCeroNegativo(liquidado / 100),
    aIngresar: sinCeroNegativo((repercutido - soportado - liquidado) / 100),
  }
}
