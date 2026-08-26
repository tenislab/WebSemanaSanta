/**
 * LA FACTURA DE UNA VENTA DE LA TIENDA.
 *
 * Reutiliza el mismo esqueleto que el recibo de cuota —`recibo-doc`, que ya
 * está peleado con la impresión en A4— pero no es lo mismo, y por dos cosas:
 *
 *   · LLEVA DESGLOSE DE IVA POR TIPO. Una venta puede juntar una camiseta al
 *     21 % y un libro al 4 %, y el artículo 6 del Reglamento de Facturación
 *     pide que en ese caso se separen la base y la cuota de cada tipo. Un
 *     «IVA: 8,40 €» a secas no le sirve a quien la recibe ni a quien la emite.
 *   · Y TIENE VARIAS LÍNEAS. El recibo de cuota es siempre una.
 *
 * QUÉ HACE CUANDO NO CUADRA. Los números de la cabecera —base, cuota, total—
 * los calculó `registrar_venta()` y están guardados en la fila de la venta;
 * el desglose se recalcula aquí desde las líneas. Deberían coincidir siempre,
 * y si no coinciden ESTA FACTURA LO DICE en vez de enseñar dos cifras
 * distintas sin comentarios. Es la clase de fallo que solo aparece al cuadrar
 * el ejercicio, meses después, con las facturas ya entregadas.
 */
import { LogoMark } from './Logo'
import type { HermandadSettings } from '../lib/hermandadSettings'
import { formatCurrency } from '../lib/format'
import { hayDatosDeEjemplo } from '../lib/demo'
import { fechaEs } from '../lib/leerTabla'
import { hoyIso } from '../lib/hoy'
import {
  desgloseIvaPorTipo, referenciaFactura, seRebajo, sumaDelDesglose,
  type LineaVenta, type Venta,
} from '../data/tienda'

/**
 * LA FECHA DE LA VENTA, EN HORA DE AQUÍ.
 *
 * Escrito primero como `fecha.slice(0, 10)`, que parece inofensivo y es el
 * mismo fallo que `toISOString()`: `ventas.fecha` es un `timestamptz` y llega
 * por la red en UTC —«2026-08-26T22:30:00+00:00»—, así que cortar los diez
 * primeros caracteres da EL DÍA UTC. Una venta cobrada a las 00:30 del 27 de
 * agosto en España se imprimía con fecha de emisión del 26.
 *
 * No es un caso raro en una hermandad, que es lo que hizo nacer `lib/hoy.ts`:
 * aquí se cobra de madrugada —besamanos que acaban tarde, la Madrugá— y la
 * ventana de error va de las 00:00 a las 01:00 en invierno y a las 02:00 en
 * verano. Y aquí acaba impreso como fecha de emisión de un documento fiscal.
 */
function soloElDia(fecha: string): string {
  const d = new Date(fecha ?? '')
  return Number.isNaN(d.getTime()) ? '' : fechaEs(hoyIso(d))
}

export default function FacturaTienda({
  venta, lineas, hermandad,
}: {
  venta: Venta
  /**
   * `undefined` = todavía se están trayendo. `null` = no se han podido traer.
   * Los tres casos se pintan distinto a propósito: sin líneas no hay desglose
   * de IVA, y una factura sin desglose con aspecto de buena es peor que no
   * enseñar nada.
   */
  lineas: LineaVenta[] | null | undefined
  hermandad: HermandadSettings
}) {
  const direccion = [hermandad.direccion, hermandad.codigoPostal, hermandad.ciudad]
    .filter(Boolean).join(', ')
  const tramos = desgloseIvaPorTipo(lineas ?? [])
  const suma = sumaDelDesglose(tramos)
  const cent = (n: number) => Math.round(n * 100)
  /*
   * SE COMPARAN LAS TRES CIFRAS, no solo el total.
   *
   * Empecé mirando únicamente el total, y al probarlo con una venta cuya
   * cabecera decía 55,19 € de base cuando las líneas daban 55,02 € el aviso NO
   * saltó: los totales coincidían. Y ese es justo el descuadre que importa,
   * porque la base y la cuota son las que van al modelo 303 — un total bueno
   * con una base mala se declara mal y no lo delata nadie.
   *
   * Solo se avisa si hay líneas que comparar: mientras se traen de la base,
   * `lineas` está vacío y el desglose suma cero, así que sin esta condición la
   * factura gritaría «no cuadra» durante el medio segundo de la consulta.
   */
  const descuadra = (lineas?.length ?? 0) > 0 && (
    cent(suma.total) !== cent(venta.total)
    || cent(suma.base) !== cent(venta.base)
    || cent(suma.cuota) !== cent(venta.ivaTotal)
  )

  return (
    <div className="recibo-doc print-doc factura-doc">
      <div className="recibo-doc__head">
        <div className="recibo-doc__brand">
          <span className="recibo-doc__logo">
            {hermandad.logoDataUrl ? <img src={hermandad.logoDataUrl} alt="" /> : <LogoMark size={30} />}
          </span>
          <div className="recibo-doc__brand-text">
            <b>{hermandad.nombreLegal || 'Tu hermandad'}</b>
            {hermandad.cif && <span>CIF {hermandad.cif}</span>}
            {direccion && <span>{direccion}</span>}
            {hermandad.email && <span>{hermandad.email}</span>}
          </div>
        </div>
        <div className="recibo-doc__meta">
          <p className="eyebrow">{venta.estado === 'Anulada' ? 'Factura anulada' : 'Factura'}</p>
          <span className="recibo-doc__num">Nº {referenciaFactura(venta)}</span>
          {/* Sin fecha se decía «Emitida el » y ahí se acababa la frase, igual
              que pasaba en el recibo de cuota. */}
          <span className="recibo-doc__date">
            {soloElDia(venta.fecha) ? `Emitida el ${soloElDia(venta.fecha)}` : 'Sin fecha de emisión'}
          </span>
          <span className="recibo-doc__date">
            {venta.canal === 'online' ? 'Reserva por internet' : 'Venta en mostrador'}
          </span>
        </div>
      </div>

      {/*
        UNA FACTURA ANULADA SIGUE SIENDO UN DOCUMENTO, y por eso se puede
        imprimir: su número está ocupado y una numeración con huecos es lo
        primero que mira una inspección. Pero tiene que decirlo bien grande,
        porque si no es indistinguible de una buena.
      */}
      {venta.estado === 'Anulada' && (
        <p className="factura-doc__anulada">
          ANULADA · Esta factura no tiene efecto. Su número se conserva para que la numeración
          no quede con huecos.
        </p>
      )}

      <div className="recibo-doc__to">
        <span className="recibo-doc__label">Emitida a</span>
        <b>{venta.compradorNombre || 'Cliente de mostrador'}</b>
        {venta.compradorNif && <span>NIF {venta.compradorNif}</span>}
        {venta.compradorDireccion && <span>{venta.compradorDireccion}</span>}
        {/*
          SIN NIF NO ES FACTURA COMPLETA, y conviene que lo sepa quien la
          entrega y no quien recibe la carta de Hacienda. Una factura
          simplificada vale hasta 400 € (3.000 € en ventas al por menor), pero
          quien quiera deducírsela necesita su NIF, y a la vuelta ya no hay
          forma de emitirla con otro número.
        */}
        {!venta.compradorNif && (
          <span className="factura-doc__aviso">
            Sin NIF: es una factura simplificada. Si quien compra necesita deducírsela, hace falta
            su NIF y su dirección.
          </span>
        )}
      </div>

      <table className="recibo-doc__table factura-doc__table">
        <thead>
          <tr>
            <th>Artículo</th>
            <th className="num">Uds.</th>
            <th className="num">Precio</th>
            <th className="num">IVA</th>
            <th className="num">Importe</th>
          </tr>
        </thead>
        <tbody>
          {(lineas ?? []).map((l) => (
            <tr key={l.id}>
              <td>
                <b>{l.nombre}</b>
                {l.codigo && <small className="factura-doc__cod"> · {l.codigo}</small>}
              </td>
              <td className="num">{l.cantidad}</td>
              <td className="num">
                {formatCurrency(l.precioUnitario)}
                {/* La tarifa tachada al lado: es lo que explica por qué se
                    paga menos que lo que pone en la etiqueta. */}
                {seRebajo(l) && <s className="factura-doc__tarifa">{formatCurrency(l.precioTarifa)}</s>}
              </td>
              <td className="num">{l.iva} %</td>
              <td className="num">{formatCurrency(l.precioUnitario * l.cantidad)}</td>
            </tr>
          ))}
          {/*
            Y aquí se dice CUÁL de los tres casos es. Antes ponía siempre
            «Trayendo las líneas…», así que una consulta que fallaba dejaba esa
            frase para siempre y el resto de la factura —membrete, número, NIF
            y total— con toda la pinta de estar bien.
          */}
          {lineas === undefined && (
            <tr><td colSpan={5}>Trayendo las líneas de la factura…</td></tr>
          )}
          {lineas === null && (
            <tr>
              <td colSpan={5} className="factura-doc__descuadre">
                No se han podido traer los artículos de esta factura. NO la imprimas así: saldría
                sin artículos y sin desglose de IVA, con aspecto de estar completa. Vuelve a
                intentarlo.
              </td>
            </tr>
          )}
          {lineas !== undefined && lineas !== null && lineas.length === 0 && (
            <tr>
              <td colSpan={5} className="factura-doc__descuadre">
                Esta factura no tiene artículos. Es un descuadre: avisa antes de entregarla.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* EL DESGLOSE POR TIPO. Con uno solo también se pinta: una factura sin
          línea de IVA no dice si es que la hermandad está exenta o si se
          olvidó de ponerlo. */}
      {tramos.length > 0 && (
        <table className="recibo-doc__table factura-doc__iva">
          <thead>
            <tr>
              <th>Tipo</th>
              <th className="num">Base imponible</th>
              <th className="num">Cuota</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {tramos.map((t) => (
              <tr key={t.tipo}>
                <td>IVA {t.tipo} %{t.tipo === 0 ? ' (exento)' : ''}</td>
                <td className="num">{formatCurrency(t.base)}</td>
                <td className="num">{formatCurrency(t.cuota)}</td>
                <td className="num">{formatCurrency(t.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {venta.descuentoPct > 0 && (
        <p className="factura-doc__aviso">
          Aplicado un descuento del {venta.descuentoPct} % sobre la tarifa.
        </p>
      )}

      {descuadra && (
        <p className="factura-doc__descuadre" role="alert">
          Ojo: el desglose de estas líneas suma {formatCurrency(suma.base)} de base +{' '}
          {formatCurrency(suma.cuota)} de IVA = {formatCurrency(suma.total)}, y la venta está
          registrada por {formatCurrency(venta.base)} + {formatCurrency(venta.ivaTotal)} ={' '}
          {formatCurrency(venta.total)}. No entregues esta factura: avisa del descuadre antes de nada.
        </p>
      )}

      <div className="recibo-doc__total">
        <span>Total{venta.formaPago ? ` · ${venta.formaPago}` : ''}</span>
        <b>{formatCurrency(venta.total)}</b>
      </div>

      <div className="recibo-doc__foot">
        <span className="recibo-doc__iban recibo-doc__iban--ok">
          Recibí de {venta.compradorNombre || 'quien compra'} el importe de esta factura
          {soloElDia(venta.fecha) ? `, el ${soloElDia(venta.fecha)}` : ''}.
        </span>
      </div>

      {venta.notas && <p className="factura-doc__aviso">{venta.notas}</p>}

      <p className="recibo-doc__note">
        {hermandad.textoPieDocumentos || (hayDatosDeEjemplo()
          ? 'Documento generado por Gobergo · datos de ejemplo, sin validez fiscal'
          : 'Documento generado por Gobergo')}
      </p>
    </div>
  )
}
