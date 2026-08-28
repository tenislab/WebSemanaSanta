/**
 * LA CUENTA DE PÉRDIDAS Y GANANCIAS, PARA IMPRIMIR.
 *
 * El papel que se lleva al cabildo de cuentas. La aritmética entera está en
 * `lib/perdidasYGanancias.ts` —aparte y sin React, porque es dinero que acaba
 * en un documento que se firma y hay que poder comprobarlo cifra a cifra—;
 * aquí solo se pinta.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAS DOS CIFRAS DEL FINAL, Y POR QUÉ SALEN LAS DOS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   RESULTADO DEL EJERCICIO      lo que dice el libro. Cuadra con el banco.
 *   RESULTADO DESPUÉS DE REGLAS  lo mismo, restando lo comprometido.
 *
 * No se puede enseñar solo la segunda por muy útil que sea: un compromiso es
 * dinero que SIGUE EN LA CUENTA. Quien lleva ese número a un cabildo y le
 * preguntan «¿y cuánto hay en el banco?» tiene que poder señalar la otra
 * columna. Y el papel lo dice con todas las letras, porque el papel sobrevive
 * a la conversación en la que se explicó.
 */
import { LogoMark } from './Logo'
import type { HermandadSettings } from '../lib/hermandadSettings'
import { formatCurrency } from '../lib/format'
import { comoSeLeeElResultado, variacion, type CuentaPyG, type LineaPyG } from '../lib/perdidasYGanancias'
import { comoSeLeeElReparto } from '../lib/repartos'

/**
 * La variación respecto al año pasado, ya escrita.
 *
 * Cuando el año anterior fue cero devuelve una raya y NO «∞ %»: no hay ningún
 * porcentaje que describa pasar de nada a algo, y en un documento que se firma
 * un símbolo de infinito parece una avería.
 */
function variacionEscrita(actual: number, anterior: number): string {
  const v = variacion(actual, anterior)
  if (v === null) return anterior === 0 && actual === 0 ? '—' : 'nuevo'
  const signo = v > 0 ? '+' : ''
  return `${signo}${v.toFixed(1).replace('.', ',')} %`
}

function Filas({ lineas, hayAjustes }: { lineas: LineaPyG[], hayAjustes: boolean }) {
  return (
    <>
      {lineas.map((l) => (
        <tr key={l.categoria}>
          <td>{l.categoria}</td>
          <td className="pyg__num">{formatCurrency(l.importe)}</td>
          <td className="pyg__num pyg__suave">{l.peso.toFixed(1).replace('.', ',')} %</td>
          <td className="pyg__num pyg__suave">{formatCurrency(l.importeAnterior)}</td>
          <td className="pyg__num pyg__suave">{variacionEscrita(l.importe, l.importeAnterior)}</td>
          {hayAjustes && (
            <td className="pyg__num">
              {l.ajuste === 0
                ? '—'
                : `${l.ajuste > 0 ? '+' : ''}${formatCurrency(l.ajuste)}`}
            </td>
          )}
        </tr>
      ))}
    </>
  )
}

export default function CuentaResultados({
  hermandad,
  cuenta,
  generadoEl,
  className = '',
}: {
  hermandad: HermandadSettings
  cuenta: CuentaPyG
  generadoEl: string
  className?: string
}) {
  // La columna de ajustes solo sale si hay alguna regla que haya movido algo.
  // Una columna de rayas ocupa un quinto del ancho y no dice nada.
  const hayAjustes = cuenta.reglasAplicadas.length > 0
  const cols = hayAjustes ? 6 : 5

  const direccion = [hermandad.direccion, hermandad.codigoPostal, hermandad.ciudad, hermandad.provincia]
    .filter(Boolean).join(', ')

  return (
    <div className={`recibo-doc print-doc estado-cuentas pyg ${className}`.trim()}>
      <div className="print-hoja">
        {hermandad.nombreLegal || 'Tu hermandad'} · Pérdidas y ganancias {cuenta.anio}
      </div>

      <div className="recibo-doc__head">
        <div className="recibo-doc__brand">
          <span className="recibo-doc__logo">
            {hermandad.logoDataUrl ? <img src={hermandad.logoDataUrl} alt="" /> : <LogoMark size={30} />}
          </span>
          <div className="recibo-doc__brand-text">
            <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
            {hermandad.cif && <span>CIF {hermandad.cif}</span>}
            {direccion && <span>{direccion}</span>}
          </div>
        </div>
        <div className="recibo-doc__meta">
          <p className="eyebrow">Cuenta de pérdidas y ganancias</p>
          <span className="recibo-doc__num">Ejercicio {cuenta.anio}</span>
          <span className="recibo-doc__date">Generado el {generadoEl}</span>
        </div>
      </div>

      <h3 className="estado-cuentas__seccion">I N G R E S O S</h3>
      <table className="recibo-doc__table estado-cuentas__table pyg__table">
        <thead>
          <tr>
            <th>Partida</th>
            <th className="pyg__num">{cuenta.anio}</th>
            <th className="pyg__num">Peso</th>
            <th className="pyg__num">{cuenta.anio - 1}</th>
            <th className="pyg__num">Var.</th>
            {hayAjustes && <th className="pyg__num">Reglas</th>}
          </tr>
        </thead>
        <tbody>
          <Filas lineas={cuenta.ingresos} hayAjustes={hayAjustes} />
          <tr className="estado-cuentas__total">
            <td>TOTAL INGRESOS</td>
            <td className="pyg__num">{formatCurrency(cuenta.totalIngresos)}</td>
            <td className="pyg__num pyg__suave">100,0 %</td>
            <td className="pyg__num pyg__suave">{formatCurrency(cuenta.totalIngresosAnterior)}</td>
            <td className="pyg__num pyg__suave">
              {variacionEscrita(cuenta.totalIngresos, cuenta.totalIngresosAnterior)}
            </td>
            {hayAjustes && <td className="pyg__num">—</td>}
          </tr>
        </tbody>
        <tfoot className="print-pie-hueco"><tr><td colSpan={cols} /></tr></tfoot>
      </table>

      <h3 className="estado-cuentas__seccion">G A S T O S</h3>
      <table className="recibo-doc__table estado-cuentas__table pyg__table">
        <thead>
          <tr>
            <th>Partida</th>
            <th className="pyg__num">{cuenta.anio}</th>
            <th className="pyg__num">Peso</th>
            <th className="pyg__num">{cuenta.anio - 1}</th>
            <th className="pyg__num">Var.</th>
            {hayAjustes && <th className="pyg__num">Reglas</th>}
          </tr>
        </thead>
        <tbody>
          <Filas lineas={cuenta.gastos} hayAjustes={hayAjustes} />
          <tr className="estado-cuentas__total">
            <td>TOTAL GASTOS</td>
            <td className="pyg__num">{formatCurrency(cuenta.totalGastos)}</td>
            <td className="pyg__num pyg__suave">100,0 %</td>
            <td className="pyg__num pyg__suave">{formatCurrency(cuenta.totalGastosAnterior)}</td>
            <td className="pyg__num pyg__suave">
              {variacionEscrita(cuenta.totalGastos, cuenta.totalGastosAnterior)}
            </td>
            {hayAjustes && <td className="pyg__num">—</td>}
          </tr>
        </tbody>
        <tfoot className="print-pie-hueco"><tr><td colSpan={cols} /></tr></tfoot>
      </table>

      <h3 className="estado-cuentas__seccion">R E S U L T A D O</h3>
      <table className="recibo-doc__table estado-cuentas__table">
        <tbody>
          <tr>
            <td>Ingresos del ejercicio</td>
            <td className="pyg__num">{formatCurrency(cuenta.totalIngresos)}</td>
          </tr>
          <tr>
            <td>Gastos del ejercicio</td>
            <td className="pyg__num">− {formatCurrency(cuenta.totalGastos)}</td>
          </tr>
          <tr className="estado-cuentas__total">
            <td>RESULTADO DEL EJERCICIO</td>
            <td className="pyg__num">{formatCurrency(cuenta.resultado)}</td>
          </tr>
          <tr>
            <td className="pyg__suave">El mismo resultado el año anterior</td>
            <td className="pyg__num pyg__suave">{formatCurrency(cuenta.resultadoAnterior)}</td>
          </tr>
        </tbody>
      </table>

      <p className="pyg__lectura">{comoSeLeeElResultado(cuenta)}</p>

      {/*
        * LAS REGLAS, ESCRITAS EN EL PAPEL. No basta con que los números salgan
        * ajustados: quien lea esto dentro de dos años tiene que poder saber
        * POR QUÉ una partida no coincide con el libro, sin preguntarle a nadie
        * y sin abrir la aplicación.
        */}
      {hayAjustes && (
        <>
          <h3 className="estado-cuentas__seccion">R E G L A S   A P L I C A D A S</h3>
          <table className="recibo-doc__table estado-cuentas__table">
            <tbody>
              {cuenta.reglasAplicadas.map(({ regla, importe }) => (
                <tr key={regla.id}>
                  <td>
                    <b>{regla.nombre}</b>
                    <br />
                    <span className="pyg__suave">{comoSeLeeElReparto(regla)}</span>
                    {regla.nota && <><br /><span className="pyg__suave">{regla.nota}</span></>}
                  </td>
                  <td className="pyg__num">{formatCurrency(importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {cuenta.comprometido > 0 && (
            <table className="recibo-doc__table estado-cuentas__table pyg__cierre">
              <tbody>
                <tr>
                  <td>Resultado del ejercicio</td>
                  <td className="pyg__num">{formatCurrency(cuenta.resultado)}</td>
                </tr>
                <tr>
                  <td>Comprometido y todavía sin pagar</td>
                  <td className="pyg__num">− {formatCurrency(cuenta.comprometido)}</td>
                </tr>
                <tr className="estado-cuentas__total">
                  <td>RESULTADO DESPUÉS DE COMPROMISOS</td>
                  <td className="pyg__num">{formatCurrency(cuenta.resultadoAjustado)}</td>
                </tr>
              </tbody>
            </table>
          )}

          <p className="pyg__aviso">
            <b>Los compromisos no son gastos todavía.</b> Es dinero que sigue en la cuenta y que la
            junta ha decidido destinar a algo. Por eso el saldo del banco cuadra con el{' '}
            <b>resultado del ejercicio</b>, no con el de después de compromisos. Y los repartos no
            cambian ningún total: solo dicen a qué partida corresponde cada trozo de un gasto que
            ya estaba pagado.
          </p>
        </>
      )}
    </div>
  )
}
