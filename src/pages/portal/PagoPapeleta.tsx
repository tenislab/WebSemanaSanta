/**
 * PAGAR LA PAPELETA: con tarjeta, o avisando de que ya se pagó.
 *
 * Su propio componente porque tiene su propio estado —el intento de pago, lo
 * que contesta la pasarela— y porque es la parte donde se toca dinero: cuanto
 * menos cerca esté del resto, mejor se lee lo que hace.
 */
import AvisoFalta from '../../components/AvisoFalta'
import { type MetodoPago, type Papeleta } from '../../data/papeletas'
import { codigoDeHermano } from '../../lib/codigoHermano'
import { formatCurrency } from '../../lib/format'
import {
  pagarConTarjeta,
  pagoConTarjetaDisponible,
  pagoEnMarcha,
  type IntentoDePago,
} from '../../lib/pagoTarjeta'
import { requisito, requisitoActual } from '../../lib/requisitos'
import { useState } from 'react'

export function PagoPapeleta({
  papeleta,
  bizum,
  iban,
  nombreHermandad,
  hermano,
  onComunicar,
  cuentaStripe,
  intentos,
}: {
  papeleta: Papeleta
  bizum: string
  iban: string
  nombreHermandad: string
  hermano: { nombre: string; numero: number }
  onComunicar: (metodo: MetodoPago) => void
  /** La cuenta conectada de la hermandad. Sin ella no hay pago con tarjeta. */
  cuentaStripe?: string | null
  /** Sus intentos de pago con tarjeta. `null` = no se ha podido mirar. */
  intentos?: IntentoDePago[] | null
}) {
  const [pagando, setPagando] = useState(false)
  const [falloPago, setFalloPago] = useState('')
  /*
   * ¿TIENE ESTA MISMA PAPELETA UN PAGO A MEDIO HACER?
   *
   * El recibo tarda en ponerse en «Pagada» lo que tarde el aviso de Stripe en
   * llegar, y ese hueco es exactamente cuando el hermano vuelve, lo ve
   * pendiente y paga otra vez. Devolver dos cobros es media mañana de
   * tesorería, así que se le dice.
   */
  const enMarcha = pagoEnMarcha(intentos ?? null, 'papeleta', papeleta.id)
  const hayTarjeta = pagoConTarjetaDisponible(cuentaStripe)

  /*
   * El concepto del pago: un código corto, no una frase.
   *
   * Antes decía «Papeleta 1 - Jaime Rivas». Eso no lo escribe nadie entero
   * desde un móvil, de pie y con el pulgar: se acorta, se come el apellido, y
   * a la tesorería le llega un ingreso que no sabe de quién es. Y si en la
   * hermandad hay dos que se llaman igual, el nombre tampoco distingue.
   */
  const concepto = codigoDeHermano(hermano)

  if (papeleta.pagoComunicado) {
    return (
      <div className="pago-box pago-box--ok">
        <b>Pago comunicado por {papeleta.pagoComunicado.metodo}</b>
        <p className="form-hint">
          Avisaste el {papeleta.pagoComunicado.fecha} de que ya has pagado {formatCurrency(papeleta.importe)}. La
          secretaría de {nombreHermandad} confirmará el pago en cuanto vea el ingreso en su cuenta.
        </p>
      </div>
    )
  }

  // Con tarjeta se puede pagar aunque la hermandad no haya publicado ni su
  // Bizum ni su cuenta: el cobro no necesita que nadie los teclee.
  if (!bizum && !iban && !hayTarjeta) {
    return <AvisoFalta compacto requisito={requisito('datosCobro', { hermandad: { iban, bizumTelefono: bizum } })} />
  }

  return (
    <div className="pago-box">
      <b>Pagar mi papeleta · {formatCurrency(papeleta.importe)}</b>
      {/* El error de la pasarela se enseña tal cual: dice cosas que hacen falta
          —«tu hermandad no ha enlazado su cuenta»— y un «no se ha podido»
          genérico dejaría al hermano sin saber si el problema es suyo. */}
      {falloPago && <p className="form-hint form-hint--error">{falloPago}</p>}
      {enMarcha && (
        <p className="form-hint form-hint--warn">
          <b>Ya has empezado a pagar esta papeleta con tarjeta.</b> Si acabas de hacerlo, espera un
          momento y recarga: el recibo se pone al día solo cuando el banco lo confirma. Vuelve a
          pagar solo si el pago no llegó a completarse.
        </p>
      )}
      {(bizum || iban) && (
        <p className="form-hint">
          El pago llega directamente a {nombreHermandad}. Pon en el concepto tu código
          de hermano, <code>{concepto}</code>, y la secretaría sabrá que es tuyo. Es el
          mismo todo el año: te lo puedes aprender.
        </p>
      )}
      <div className="pago-metodos">
        {/*
          LA TARJETA VA LA PRIMERA a propósito: es el único que no obliga a
          nadie a avisar ni a cotejar el extracto. Los otros dos siguen ahí
          porque hay hermanos que no pagan con tarjeta, y quitárselos sería
          cambiar una opción por otra en vez de sumar.
        */}
        {hayTarjeta && (
          <div className="pago-metodo">
            <span className="pago-metodo__titulo">Tarjeta</span>
            <span className="pago-metodo__dato">Se confirma solo</span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={pagando}
              onClick={async () => {
                setPagando(true)
                setFalloPago('')
                const r = await pagarConTarjeta('papeleta', papeleta.id)
                if (r.ok) { window.location.href = r.url; return }
                setPagando(false)
                setFalloPago(r.error)
              }}
            >
              {pagando ? 'Abriendo la pasarela…' : `Pagar ${formatCurrency(papeleta.importe)}`}
            </button>
          </div>
        )}
        {bizum && (
          <div className="pago-metodo">
            <span className="pago-metodo__titulo">Bizum</span>
            <span className="pago-metodo__dato">{bizum}</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onComunicar('Bizum')}>
              Ya he enviado el Bizum
            </button>
          </div>
        )}
        {iban && (
          <div className="pago-metodo">
            <span className="pago-metodo__titulo">Transferencia</span>
            <span className="pago-metodo__dato">{iban}</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onComunicar('Transferencia')}>
              Ya he hecho la transferencia
            </button>
          </div>
        )}
      </div>
      {/* Si la hermandad ya cobra con tarjeta, este aviso mentiría: diría «no
          se puede pagar con tarjeta» justo debajo del botón de pagar con
          tarjeta. */}
      {!hayTarjeta && <AvisoFalta compacto requisito={requisitoActual('pasarela')} />}
    </div>
  )
}
