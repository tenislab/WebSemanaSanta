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
  'Otros gastos extraordinarios',
] as const

/** Movimientos de ejemplo de caja: ingresos y gastos del ejercicio, mientras conectamos la base de datos. */
export const MOVIMIENTOS_INICIALES: Movimiento[] = [
  { id: 'm1', numero: 101, fecha: '05 ene 2026', concepto: 'Cuotas de enero', categoria: 'Cuotas', tipo: 'Ingreso', importe: 1240, cuenta: 'Cuenta bancaria', estado: 'Conciliado' },
  { id: 'm2', numero: 102, fecha: '08 ene 2026', concepto: 'Donativo de un hermano', categoria: 'Donativos', tipo: 'Ingreso', importe: 300, cuenta: 'Cuenta bancaria', estado: 'Conciliado' },
  { id: 'm3', numero: 103, fecha: '12 ene 2026', concepto: 'Recibo de la luz de la casa hermandad', categoria: 'Suministros', tipo: 'Gasto', importe: 186.4, cuenta: 'Cuenta bancaria', estado: 'Conciliado' },
  { id: 'm4', numero: 104, fecha: '15 ene 2026', concepto: 'Flores para el altar de cultos', categoria: 'Culto', tipo: 'Gasto', importe: 420, cuenta: 'Caja', estado: 'Conciliado' },
  { id: 'm5', numero: 105, fecha: '20 ene 2026', concepto: 'Restauración de un candelabro', categoria: 'Enseres', tipo: 'Gasto', importe: 950, cuenta: 'Cuenta bancaria', estado: 'Pendiente' },
  { id: 'm6', numero: 106, fecha: '22 ene 2026', concepto: 'Subvención del ayuntamiento', categoria: 'Subvenciones', tipo: 'Ingreso', importe: 800, cuenta: 'Cuenta bancaria', estado: 'Pendiente' },
  { id: 'm7', numero: 107, fecha: '28 ene 2026', concepto: 'Seguro de responsabilidad civil', categoria: 'Seguros', tipo: 'Gasto', importe: 275, cuenta: 'Cuenta bancaria', estado: 'Conciliado' },
  { id: 'm8', numero: 108, fecha: '02 feb 2026', concepto: 'Cuotas de febrero', categoria: 'Cuotas', tipo: 'Ingreso', importe: 1180, cuenta: 'Cuenta bancaria', estado: 'Pendiente' },
  { id: 'm9', numero: 109, fecha: '04 feb 2026', concepto: 'Reparto de caridad a familias necesitadas', categoria: 'Caridad', tipo: 'Gasto', importe: 500, cuenta: 'Caja', estado: 'Conciliado' },
  { id: 'm10', numero: 110, fecha: '06 feb 2026', concepto: 'Cera para los cultos de Cuaresma', categoria: 'Culto', tipo: 'Gasto', importe: 310.5, cuenta: 'Cuenta bancaria', estado: 'Pendiente' },
]
