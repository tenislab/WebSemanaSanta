import { useMemo, useState } from 'react'
import Drawer from './Drawer'
import Recibo from './Recibo'
import ReciboModeloRender from './ReciboModeloRender'
import PapeletaTicket from './PapeletaTicket'
import { getModeloRecibo } from '../lib/modeloRecibo'
import { ejercicioDe } from '../lib/cuotasEmision'
import { etiquetaTramo, type Tramo } from '../lib/tramos'
import { formatCurrency } from '../lib/format'
import { aniosDeHermandad, porAnio, salidasDe } from '../lib/hermanoFicha'
import type { Cuota } from '../data/cuotas'
import type { MetodoPago, Papeleta } from '../data/papeletas'
import type { Hermano } from '../data/hermanos'
import type { HermandadSettings } from '../lib/hermandadSettings'

function claseCuota(estado: Cuota['estado']) {
  if (estado === 'Pagada') return 'pill--ok'
  if (estado === 'Pendiente') return 'pill--warn'
  return 'pill--err'
}

function clasePapeleta(estado: Papeleta['estado']) {
  if (estado === 'Pagada' || estado === 'Entregada') return 'pill--ok'
  if (estado === 'Asignada') return 'pill--warn'
  if (estado === 'Anulada' || estado === 'Renuncia') return 'pill--off'
  return 'pill--info'
}

/**
 * Todo lo que este hermano ha hecho en la hermandad, año por año: sus
 * papeletas de sitio y sus cuotas, con el recibo de cada una para descargarlo.
 *
 * Hasta ahora el área solo enseñaba el año en curso. Y lo que un hermano pide
 * a secretaría no es lo de este año —eso ya lo sabe—, sino el recibo de hace
 * tres para la declaración, o cuántos años seguidos ha salido.
 */
/**
 * ¿Puede el hermano pagar este recibo por su cuenta? Lo domiciliado se cobra
 * solo y no hay nada que hacer… salvo que el banco lo haya devuelto o esté en
 * mora: entonces el recibo sigue debiéndose y el hermano necesita otra vía.
 */
function sePuedePagar(c: Cuota): boolean {
  if (c.estado === 'Pagada') return false
  return !c.domiciliada || c.estado === 'Devuelta' || c.estado === 'En mora'
}

export default function HistorialHermano({
  hermano,
  cuotas,
  papeletas,
  tramos,
  hermandad,
  onPagar,
  onAnularAviso,
}: {
  hermano: Hermano
  /** Todas las cuotas del hermano, de cualquier ejercicio. */
  cuotas: Cuota[]
  /** Todas sus papeletas, de cualquier año. */
  papeletas: Papeleta[]
  tramos: Tramo[]
  hermandad: HermandadSettings
  /** Avisa a tesorería de que ya ha pagado ese recibo. Sin esto, no se ofrece pagar. */
  onPagar?: (cuotaId: string, metodo: MetodoPago) => void
  /** Deshace el aviso de pago: quien se equivoca de recibo puede rectificar sin llamar a nadie. */
  onAnularAviso?: (cuotaId: string) => void
}) {
  const modeloRecibo = useMemo(() => getModeloRecibo(), [])
  const [recibo, setRecibo] = useState<Cuota | null>(null)
  const [papeleta, setPapeleta] = useState<Papeleta | null>(null)
  const [pagando, setPagando] = useState<Cuota | null>(null)

  /** Las cuotas por ejercicio y las papeletas por año, de lo nuevo a lo viejo. */
  const ejercicios = useMemo(() => porAnio(cuotas, ejercicioDe), [cuotas])
  const anios = useMemo(() => porAnio(papeletas, (p) => p.anio), [papeletas])

  const pagado = cuotas.filter((c) => c.estado === 'Pagada').reduce((n, c) => n + c.importe, 0)
  const debe = cuotas
    .filter((c) => c.estado === 'Pendiente' || c.estado === 'En mora' || c.estado === 'Devuelta')
    .reduce((n, c) => n + c.importe, 0)
  const salidas = salidasDe(papeletas)
  // El ejercicio en curso ya se ve arriba: aquí se abre lo demás, no lo de hoy.
  const [abiertos, setAbiertos] = useState<Set<number>>(() => new Set(ejercicios[0] ? [ejercicios[0][0]] : []))
  function alternar(anio: number) {
    setAbiertos((prev) => {
      const s = new Set(prev)
      if (s.has(anio)) s.delete(anio)
      else s.add(anio)
      return s
    })
  }

  const tramoDe = (id: string | null) => (id ? tramos.find((t) => t.id === id) ?? null : null)

  return (
    <section className="portal__section" id="mi-historial">
      <h2>Mi vida en la hermandad</h2>

      <div className="vida-cifras">
        <div>
          <strong>{aniosDeHermandad(hermano.antiguedad)}</strong>
          <span>{aniosDeHermandad(hermano.antiguedad) === 1 ? 'año' : 'años'} de hermano/a</span>
        </div>
        <div>
          <strong>{salidas}</strong>
          <span>{salidas === 1 ? 'estación de penitencia' : 'estaciones de penitencia'}</span>
        </div>
        <div>
          <strong>{formatCurrency(pagado)}</strong>
          <span>aportados</span>
        </div>
        {debe > 0 && (
          <div className="vida-cifras__debe">
            <strong>{formatCurrency(debe)}</strong>
            <span>pendiente</span>
          </div>
        )}
      </div>

      {/* ---- Papeletas de sitio, año por año ---- */}
      <h3 className="vida-h3">Mis papeletas de sitio</h3>
      {anios.length === 0 ? (
        <p className="form-hint">Todavía no has sacado ninguna papeleta de sitio.</p>
      ) : (
        <ul className="vida-lista">
          {anios.map(([anio, lista]) => (
            <li key={anio}>
              <span className="vida-lista__anio">{anio}</span>
              <span className="vida-lista__que">
                {lista.map((p) => {
                  const t = tramoDe(p.tramoId)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="vida-chip"
                      onClick={() => setPapeleta(p)}
                      title="Ver la papeleta"
                    >
                      <span className={`pill ${clasePapeleta(p.estado)}`}>{p.estado}</span>
                      {t ? etiquetaTramo(t) : p.opcion || 'Sin sitio'}
                      {p.importe > 0 && <b>{formatCurrency(p.importe)}</b>}
                    </button>
                  )
                })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* ---- Cuotas, ejercicio por ejercicio ---- */}
      <h3 className="vida-h3">Mis cuotas</h3>
      {ejercicios.length === 0 ? (
        <p className="form-hint">No tienes recibos registrados.</p>
      ) : (
        ejercicios.map(([anio, lista]) => {
          const abierto = abiertos.has(anio)
          const suma = lista.reduce((n, c) => n + c.importe, 0)
          const sinPagar = lista.filter((c) => c.estado !== 'Pagada').length
          return (
            <div className="vida-anio" key={anio}>
              <button
                type="button"
                className="vida-anio__cabeza"
                onClick={() => alternar(anio)}
                aria-expanded={abierto}
              >
                <span className="vida-anio__titulo">{anio === 0 ? 'Sin ejercicio' : anio}</span>
                <span className="vida-anio__resumen">
                  {lista.length} {lista.length === 1 ? 'recibo' : 'recibos'} · {formatCurrency(suma)}
                  {sinPagar > 0 && <span className="pill pill--warn">{sinPagar} sin pagar</span>}
                </span>
                <span className="vida-anio__flecha" aria-hidden="true">{abierto ? '▾' : '▸'}</span>
              </button>
              {abierto && (
                <ul className="vida-recibos">
                  {lista.map((c) => (
                    <li key={c.id}>
                      <span className="vida-recibos__concepto">
                        {c.concepto}
                        <small>{c.fechaCobro}</small>
                      </span>
                      <span className={`pill ${claseCuota(c.estado)}`}>{c.estado}</span>
                      <span className="vida-recibos__importe">{formatCurrency(c.importe)}</span>
                      {/* Pagar lo que se deba, sin llamar a secretaría. */}
                      {onPagar && sePuedePagar(c) && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setPagando(c)}>
                          {c.pagoComunicado ? 'Pago avisado' : 'Pagar'}
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRecibo(c)}>
                        Ver recibo
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })
      )}

      {/* Un recibo cada vez: al imprimir solo se ve el documento abierto. */}
      <Drawer
        open={!!recibo}
        onClose={() => setRecibo(null)}
        title="Recibo de cuota"
        subtitle={recibo ? `Nº ${String(recibo.numero).padStart(4, '0')}` : undefined}
        footer={
          <button className="btn btn-primary" onClick={() => window.print()}>
            Imprimir / Descargar
          </button>
        }
      >
        {recibo && (modeloRecibo ? (
          <ReciboModeloRender
            modelo={modeloRecibo}
            datos={{ cuota: recibo, hermano, hermandadNombre: hermandad.nombreLegal }}
          />
        ) : (
          <Recibo cuota={recibo} hermano={hermano} hermandad={hermandad} />
        ))}
      </Drawer>

      {/* Pagar un recibo: los datos de cobro de la hermandad y el aviso a
          tesorería. La tarjeta llegará con la pasarela. */}
      <Drawer
        open={!!pagando}
        onClose={() => setPagando(null)}
        title="Pagar mi cuota"
        subtitle={pagando ? `${pagando.concepto} · ${formatCurrency(pagando.importe)}` : undefined}
      >
        {pagando && (
          pagando.pagoComunicado ? (
            <div className="pago-box pago-box--ok">
              <b>Pago avisado por {pagando.pagoComunicado.metodo}</b>
              <p className="form-hint">
                Avisaste el {pagando.pagoComunicado.fecha} de que ya has pagado{' '}
                {formatCurrency(pagando.importe)}. La tesorería lo confirmará en cuanto vea el
                ingreso en su cuenta.
              </p>
              {onAnularAviso && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { onAnularAviso(pagando.id); setPagando(null) }}
                >
                  Me he equivocado, quitar el aviso
                </button>
              )}
            </div>
          ) : !hermandad.bizumTelefono && !hermandad.iban ? (
            <p className="form-hint">
              La hermandad todavía no ha publicado sus datos de cobro. Pregunta en secretaría cómo
              pagar este recibo.
            </p>
          ) : (
            <div className="pago-box">
              <b>{formatCurrency(pagando.importe)}</b>
              <p className="form-hint">
                Pon en el concepto <code>{`Recibo ${pagando.numero} - ${hermano.nombre}`}</code> para
                que la tesorería lo identifique.
              </p>
              <div className="pago-metodos">
                {hermandad.bizumTelefono && (
                  <div className="pago-metodo">
                    <span className="pago-metodo__titulo">Bizum</span>
                    <span className="pago-metodo__dato">{hermandad.bizumTelefono}</span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => { onPagar?.(pagando.id, 'Bizum'); setPagando(null) }}
                    >
                      Ya he enviado el Bizum
                    </button>
                  </div>
                )}
                {hermandad.iban && (
                  <div className="pago-metodo">
                    <span className="pago-metodo__titulo">Transferencia</span>
                    <span className="pago-metodo__dato">{hermandad.iban}</span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => { onPagar?.(pagando.id, 'Transferencia'); setPagando(null) }}
                    >
                      Ya he hecho la transferencia
                    </button>
                  </div>
                )}
              </div>
              <p className="form-hint">
                Pagar con tarjeta desde aquí llegará cuando la hermandad conecte una pasarela.
              </p>
            </div>
          )
        )}
      </Drawer>

      <Drawer
        open={!!papeleta}
        onClose={() => setPapeleta(null)}
        title={`Papeleta de ${papeleta?.anio ?? ''}`}
        footer={
          <button className="btn btn-primary" onClick={() => window.print()}>
            Imprimir / Descargar
          </button>
        }
      >
        {papeleta && (
          <PapeletaTicket
            papeleta={papeleta}
            hermano={hermano}
            hermandad={hermandad}
            tramo={tramoDe(papeleta.tramoId) ?? undefined}
            puesto={null}
            opcion={papeleta.opcion}
          />
        )}
      </Drawer>
    </section>
  )
}
