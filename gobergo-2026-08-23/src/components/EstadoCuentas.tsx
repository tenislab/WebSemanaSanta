import { LogoMark } from './Logo'
import type { HermandadSettings } from '../lib/hermandadSettings'
import type { Movimiento } from '../data/movimientos'
import { CATEGORIAS_INGRESO, CATEGORIAS_GASTO } from '../data/movimientos'
import { sumaEuros, formatCurrency } from '../lib/format'

/** Año de un movimiento a partir de su fecha ya formateada ("5 ene. 2026" → "2026"). */
function anioDe(fecha: string): string {
  return fecha.trim().slice(-4)
}

/**
 * Reparte los movimientos por partida y suma cada una.
 *
 * Cada subtotal se imprime al lado del total en el papel que se lleva al
 * cabildo, así que se suman con `sumaEuros`: si un importe roto dejara una
 * partida en «NaN €», el documento saldría con un hueco donde va una cifra —y
 * es un documento que se firma—.
 */
function sumaPorCategoria(movimientos: Movimiento[], categorias: readonly string[]) {
  const porCategoria = new Map<string, number>()
  for (const cat of categorias) {
    const suyos = movimientos.filter((m) => m.categoria === cat)
    if (suyos.length > 0) porCategoria.set(cat, sumaEuros(suyos.map((m) => m.importe)))
  }
  // Lo que no encaja en ninguna partida no se pierde: va a «otros».
  const otros = movimientos.filter((m) => !categorias.includes(m.categoria))
  return { porCategoria, otros: sumaEuros(otros.map((m) => m.importe)) }
}

/**
 * Estado de cuentas anual con el formato clásico que piden las diócesis:
 * ingresos y gastos por partida, y el resumen de beneficio/pérdida y saldo.
 * Las partidas coinciden con CATEGORIAS_INGRESO/CATEGORIAS_GASTO (ver
 * data/movimientos.ts); lo que no encaje en ninguna cae en "Otros".
 */
export default function EstadoCuentas({
  hermandad,
  anio,
  movimientos,
  saldoInicial,
  generadoEl,
  className = '',
}: {
  hermandad: HermandadSettings
  anio: number
  movimientos: Movimiento[]
  saldoInicial: number
  generadoEl: string
  className?: string
}) {
  const delEjercicio = movimientos.filter((m) => anioDe(m.fecha) === String(anio))
  const ingresos = delEjercicio.filter((m) => m.tipo === 'Ingreso')
  const gastos = delEjercicio.filter((m) => m.tipo === 'Gasto')

  const { porCategoria: ingresosPorCategoria, otros: otrosIngresos } = sumaPorCategoria(ingresos, CATEGORIAS_INGRESO)
  const { porCategoria: gastosPorCategoria, otros: otrosGastos } = sumaPorCategoria(gastos, CATEGORIAS_GASTO)

  const totalIngresos = sumaEuros(ingresos.map((m) => m.importe))
  const totalGastos = sumaEuros(gastos.map((m) => m.importe))
  const beneficio = totalIngresos - totalGastos
  const saldoFinal = saldoInicial + beneficio

  const direccionHermandad = [hermandad.direccion, hermandad.codigoPostal, hermandad.ciudad, hermandad.provincia]
    .filter(Boolean)
    .join(', ')

  return (
    <div className={`recibo-doc print-doc estado-cuentas ${className}`.trim()}>
      {/* Se repite en cada hoja impresa (ver .print-hoja). */}
      <div className="print-hoja">
        {hermandad.nombreLegal || 'Tu hermandad'} · Estado de cuentas
      </div>
      <div className="recibo-doc__head">
        <div className="recibo-doc__brand">
          <span className="recibo-doc__logo">
            {hermandad.logoDataUrl ? <img src={hermandad.logoDataUrl} alt="" /> : <LogoMark size={30} />}
          </span>
          <div className="recibo-doc__brand-text">
            <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
            {hermandad.cif && <span>CIF {hermandad.cif}</span>}
            {direccionHermandad && <span>{direccionHermandad}</span>}
            {hermandad.telefono && <span>Tel. {hermandad.telefono}</span>}
            {hermandad.email && <span>{hermandad.email}</span>}
          </div>
        </div>
        <div className="recibo-doc__meta">
          <p className="eyebrow">Estado de cuentas</p>
          <span className="recibo-doc__num">Del 1 de enero al 31 de diciembre de {anio}</span>
          <span className="recibo-doc__date">Generado el {generadoEl}</span>
        </div>
      </div>

      <h3 className="estado-cuentas__seccion">I N G R E S O S</h3>
      <table className="recibo-doc__table estado-cuentas__table">
        <tbody>
          {CATEGORIAS_INGRESO.map((cat) => (
            <tr key={cat}>
              <td>{cat}</td>
              <td className="estado-cuentas__importe">{formatCurrency(ingresosPorCategoria.get(cat) ?? 0)}</td>
            </tr>
          ))}
          {otrosIngresos > 0 && (
            <tr>
              <td>Movimientos con categoría sin reconocer</td>
              <td className="estado-cuentas__importe">{formatCurrency(otrosIngresos)}</td>
            </tr>
          )}
          <tr className="estado-cuentas__total">
            <td>TOTAL INGRESOS</td>
            <td className="estado-cuentas__importe">{formatCurrency(totalIngresos)}</td>
          </tr>
        </tbody>
        {/* Reserva la banda del pie repetido en cada hoja (ver el comentario
            de InformeImpreso: `.print-hoja` va fijo y no le quita sitio a
            nada, así que sin esto pisa la última línea). */}
        <tfoot className="print-pie-hueco">
          <tr>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>

      <h3 className="estado-cuentas__seccion">G A S T O S</h3>
      <table className="recibo-doc__table estado-cuentas__table">
        <tbody>
          {CATEGORIAS_GASTO.map((cat) => (
            <tr key={cat}>
              <td>{cat}</td>
              <td className="estado-cuentas__importe">{formatCurrency(gastosPorCategoria.get(cat) ?? 0)}</td>
            </tr>
          ))}
          {otrosGastos > 0 && (
            <tr>
              <td>Movimientos con categoría sin reconocer</td>
              <td className="estado-cuentas__importe">{formatCurrency(otrosGastos)}</td>
            </tr>
          )}
          <tr className="estado-cuentas__total">
            <td>TOTAL GASTOS</td>
            <td className="estado-cuentas__importe">{formatCurrency(totalGastos)}</td>
          </tr>
        </tbody>
        {/* Reserva la banda del pie repetido en cada hoja (ver el comentario
            de InformeImpreso: `.print-hoja` va fijo y no le quita sitio a
            nada, así que sin esto pisa la última línea). */}
        <tfoot className="print-pie-hueco">
          <tr>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>

      <h3 className="estado-cuentas__seccion">R E S U M E N</h3>
      <table className="recibo-doc__table estado-cuentas__table">
        <tbody>
          <tr>
            <td>Ingresos del presente ejercicio</td>
            <td className="estado-cuentas__importe">{formatCurrency(totalIngresos)}</td>
          </tr>
          <tr>
            <td>Gastos del presente ejercicio</td>
            <td className="estado-cuentas__importe">{formatCurrency(totalGastos)}</td>
          </tr>
          <tr className="estado-cuentas__total">
            <td>{beneficio >= 0 ? 'BENEFICIO' : 'PÉRDIDA'} del presente ejercicio</td>
            <td className="estado-cuentas__importe">{formatCurrency(Math.abs(beneficio))}</td>
          </tr>
          <tr>
            <td>SALDO 1 de enero de {anio}</td>
            <td className="estado-cuentas__importe">{formatCurrency(saldoInicial)}</td>
          </tr>
          <tr className="estado-cuentas__total">
            <td>SALDO 31 de diciembre de {anio}</td>
            <td className="estado-cuentas__importe">{formatCurrency(saldoFinal)}</td>
          </tr>
        </tbody>
        {/* Reserva la banda del pie repetido en cada hoja (ver el comentario
            de InformeImpreso: `.print-hoja` va fijo y no le quita sitio a
            nada, así que sin esto pisa la última línea). */}
        <tfoot className="print-pie-hueco">
          <tr>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>

      <p className="recibo-doc__note">
        Documento generado por Gobergo a partir de los movimientos de tesorería registrados en la
        app · sin validez oficial hasta su firma
      </p>
    </div>
  )
}
