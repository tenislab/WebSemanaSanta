/**
 * LO QUE EL HERMANO TIENE APARTADO EN LA TIENDA, en su área.
 *
 * Es la otra mitad del aviso de «tu reserva está lista»: un aviso que dice
 * «pasa a recoger lo que apartaste» tiene que llevar a un sitio donde se vea
 * QUÉ apartó, cuánto es y hasta cuándo se lo guardan. Sin esto, el hermano
 * tenía que buscar el correo del resguardo o fiarse de memoria.
 *
 * NO SALE SI NO HAY NADA. Una hermandad sin tienda —la mayoría— no tiene por
 * qué enseñarle a cada hermano un bloque vacío que diga «no has apartado
 * nada»; el área ya es larga.
 */
import { formatCurrency } from '../lib/format'
import { fechaEs } from '../lib/leerTabla'
import { useMisReservas } from '../lib/tienda'
import type { EstadoReserva } from '../data/tienda'

const ESTADO: Record<EstadoReserva, { texto: string; pill: string }> = {
  pendiente: { texto: 'Pendiente de recoger', pill: 'pill--warn' },
  entregada: { texto: 'Recogida', pill: 'pill--ok' },
  anulada: { texto: 'Anulada', pill: 'pill--off' },
  caducada: { texto: 'Caducada', pill: 'pill--off' },
}

export default function MisReservasTienda({ hermanoId }: { hermanoId: string | null }) {
  const { reservas, cargando } = useMisReservas(hermanoId)
  if (cargando || reservas.length === 0) return null

  return (
    <section className="portal__section">
      <h2>Mis reservas de la tienda</h2>
      <p className="portal__lead">
        Lo que has apartado por la web. Se paga al recogerlo en la casa de hermandad.
      </p>
      <ul className="lista-limpia">
        {reservas.map((r) => {
          // «Lista» manda sobre «pendiente»: es lo que el hermano necesita
          // saber, y es el estado que dispara el aviso.
          const lista = r.estado === 'pendiente' && Boolean(r.listaEn)
          return (
            <li key={r.id} className="assign-box mis-reservas__item">
              <div>
                <div className="ficha__row">
                  <code>{r.referencia}</code>
                  {lista
                    ? <span className="pill pill--ok">Lista para recoger</span>
                    : <span className={`pill ${ESTADO[r.estado].pill}`}>{ESTADO[r.estado].texto}</span>}
                </div>
                <ul className="mis-reservas__lineas">
                  {r.lineas.map((l) => (
                    <li key={l.id}>
                      {l.cantidad} × {l.nombre}
                      <span>{formatCurrency(l.precioUnitario * l.cantidad)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mis-reservas__total">
                  <b>Total {formatCurrency(r.total)}</b>
                  {r.descuentoPct > 0 && (
                    <small> · con tu descuento de hermano del {r.descuentoPct} %</small>
                  )}
                </p>
                {r.estado === 'pendiente' && r.recogerAntesDe && (
                  <p className="form-hint">
                    {lista ? 'Ya puedes pasar a recogerlo. ' : ''}
                    Te lo guardamos hasta el {fechaEs(r.recogerAntesDe)}.
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
