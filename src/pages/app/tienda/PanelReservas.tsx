/**
 * LO QUE HA APARTADO LA GENTE DESDE LA WEB.
 *
 * Aquí llega lo que se reserva en la tienda de la web pública. No es una
 * pestaña de consulta: es la que hay que abrir cuando alguien se planta en la
 * casa de hermandad diciendo «vengo a por lo mío», y de ella salen las dos
 * únicas cosas que se le pueden hacer a una reserva —cobrarla y entregarla, o
 * soltarla—.
 *
 * COBRAR Y ENTREGAR ES LO QUE CREA LA VENTA. Hasta ese momento no hay factura,
 * no hay asiento en Tesorería y el género sigue en el almacén: lo único que hay
 * es un compromiso. Por eso el botón dice «Cobrar y entregar» y pide la forma de
 * pago: lo que se está haciendo es exactamente lo mismo que en el mostrador, con
 * la cesta ya escrita.
 *
 * Y SOLTAR NO BORRA. La reserva se queda, marcada como anulada o caducada, y el
 * género vuelve a poder prometerse. Una reserva borrada es una llamada de
 * teléfono que nadie puede explicar: «yo aparté una medalla la semana pasada» y
 * no hay rastro de nada.
 */
import { useEffect, useState } from 'react'
import Drawer from '../../../components/Drawer'
import ToolbarTienda from '../../../components/tienda/ToolbarTienda'
import { formatCurrency } from '../../../lib/format'
import { fechaEs } from '../../../lib/leerTabla'
import { hoyIso } from '../../../lib/hoy'
import { llano } from '../../../lib/buscar'
import { avisarReservaLista, entregarReserva, lineasDeReserva, soltarReserva } from '../../../lib/tienda'
import { useTienda } from '../../../context/TiendaContext'
import {
  FORMAS_PAGO, sePuedeEntregar, seLePasoElPlazo,
  type EstadoReserva, type LineaReserva, type Reserva,
} from '../../../data/tienda'

/** Cómo se lee cada estado y con qué color. */
const ESTADO: Record<EstadoReserva, { texto: string; pill: string }> = {
  pendiente: { texto: 'Pendiente de recoger', pill: 'pill--warn' },
  entregada: { texto: 'Entregada', pill: 'pill--ok' },
  anulada: { texto: 'Anulada', pill: 'pill--off' },
  caducada: { texto: 'Caducada', pill: 'pill--off' },
}

type FiltroReservas = 'pendientes' | 'vencidas' | 'todas'

const FILTROS = [
  ['pendientes', 'Pendientes'],
  ['vencidas', 'Se les pasó el plazo'],
  ['todas', 'Todas'],
] as const

export default function PanelReservas({ avisar, reservas, cargando, recargar }: {
  avisar: (t: string) => void
  reservas: Reserva[]
  cargando: boolean
  recargar: () => void
}) {
  const { recargarExistencias } = useTienda()
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState<FiltroReservas>('pendientes')
  const [abierta, setAbierta] = useState<Reserva | null>(null)
  const [lineas, setLineas] = useState<LineaReserva[] | null | undefined>(undefined)
  const [formaPago, setFormaPago] = useState<string>(FORMAS_PAGO[0])
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  /*
   * Soltar una reserva PIDE CONFIRMACIÓN, y no por ceremonia: el aviso de la
   * lista de bugs decía «mejorar el botón de anular», y tenía razón. Anular
   * estaba al lado de «Cobrar y entregar», del mismo tamaño, y al pulsarlo no
   * pasaba nada visible salvo que la reserva de alguien desaparecía. Ahora hay
   * que decir por qué, y lo que se va a hacer está escrito.
   */
  const [soltando, setSoltando] = useState<'anulada' | 'caducada' | null>(null)
  const [motivo, setMotivo] = useState('')

  const hoy = hoyIso()

  useEffect(() => {
    if (!abierta) { setLineas(undefined); return }
    setLineas(undefined)
    let cancelado = false
    void lineasDeReserva(abierta.id).then((ls) => { if (!cancelado) setLineas(ls) })
    return () => { cancelado = true }
  }, [abierta])

  const q = llano(query.trim())
  const visibles = reservas.filter((r) => {
    if (filtro === 'pendientes' && r.estado !== 'pendiente') return false
    if (filtro === 'vencidas' && !seLePasoElPlazo(r, hoy)) return false
    if (!q) return true
    return llano(r.nombre).includes(q) || llano(r.referencia).includes(q)
      || llano(r.telefono).includes(q) || llano(r.email).includes(q)
  })

  function cerrar() {
    setAbierta(null)
    setSoltando(null)
    setMotivo('')
    setError('')
  }

  async function cobrar() {
    if (!abierta || trabajando) return
    setTrabajando(true)
    setError('')
    const r = await entregarReserva(abierta.id, formaPago)
    setTrabajando(false)
    if (!r.ok) {
      // El mensaje de la base va TAL CUAL: los suyos están escritos para leerlos
      // con la persona delante del mostrador.
      setError(r.error)
      return
    }
    cerrar()
    recargar()
    recargarExistencias()
    avisar(`Cobrado y entregado. Factura ${r.venta.serie}-${r.venta.numero}, ${formatCurrency(r.venta.total)}.`)
  }

  /*
   * «YA PUEDES PASARTE A RECOGERLO».
   *
   * Faltaba la otra punta del circuito: quien aparta algo recibe su resguardo y
   * luego no vuelve a saber nada. Si el género hay que pedirlo, o hay que grabar
   * la medalla, esa persona se planta un martes por la tarde a por algo que
   * todavía no está.
   *
   * Se dice EXACTAMENTE lo que ha pasado, que no es lo mismo en los tres casos:
   * a quien dejó correo se le manda uno, a quien además es hermano le sale
   * también en su área, y a quien no dejó ninguna de las dos cosas hay que
   * llamarle por teléfono — y eso hay que decirlo, no dar por hecho que se ha
   * avisado.
   */
  async function avisarQueEstaLista(r: Reserva) {
    if (trabajando) return
    setTrabajando(true)
    setError('')
    const hecho = await avisarReservaLista(r.id)
    setTrabajando(false)
    if (!hecho.ok) { setError(hecho.error); return }
    recargar()
    /*
     * SE DICE LO QUE HA PASADO DE VERDAD, y son dos preguntas distintas: si esa
     * persona dejó una dirección (`r.email`) y si de verdad ha salido un correo
     * (`hecho.hayCorreo`). En la demostración no sale ninguno aunque la haya
     * dejado, y decir «le va un correo» ahí sería mentir sobre lo único que
     * quien está probando la aplicación no puede comprobar.
     */
    const partes: string[] = []
    if (hecho.esHermano) partes.push('le sale en su área del hermano')
    if (hecho.hayCorreo) partes.push(`le va un correo a ${r.email}`)
    else if (r.email) partes.push('el correo no sale de aquí: sin base de datos no se manda ninguno')
    else partes.push('no dejó correo, así que hay que llamarle por teléfono')

    if (hecho.yaAvisada) {
      avisar(`A ${r.nombre} ya se le avisó hace menos de un día. No se ha vuelto a escribir.`)
    } else {
      avisar(`Avisado ${r.nombre}: ${partes.join(' y ')}.`)
    }
  }

  async function soltar() {
    if (!abierta || !soltando || trabajando) return
    setTrabajando(true)
    setError('')
    const porDefecto = soltando === 'caducada' ? 'Se pasó el plazo de recogida' : 'Anulada desde el panel'
    const r = await soltarReserva(abierta.id, motivo.trim() || porDefecto, soltando)
    setTrabajando(false)
    if (!r.ok) { setError(r.error ?? 'No se ha podido soltar.'); return }
    const era = soltando
    cerrar()
    recargar()
    recargarExistencias()
    avisar(`Reserva ${era}. El género vuelve a estar disponible para vender.`)
  }

  return (
    <>
      <ToolbarTienda
        busca="Buscar por nombre, referencia o teléfono"
        valor={query}
        onBuscar={setQuery}
        filtros={FILTROS}
        activo={filtro}
        onFiltrar={setFiltro}
      />

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Referencia</th>
              <th>Quién</th>
              <th>Cómo avisarle</th>
              <th>Recoger antes de</th>
              <th className="num">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr key={r.id} className={r.estado === 'pendiente' ? undefined : 'fila--apagada'}>
                <td><code>{r.referencia}</code></td>
                <td>
                  <b>{r.nombre}</b>
                  <span className={`pill ${ESTADO[r.estado].pill}`}>{ESTADO[r.estado].texto}</span>
                </td>
                <td>
                  {r.telefono && <div>{r.telefono}</div>}
                  {r.email && <div className="portal__card-mini__sub">{r.email}</div>}
                  {!r.telefono && !r.email && <span className="form-hint">No dejó forma de contacto</span>}
                </td>
                <td>
                  {r.recogerAntesDe ? fechaEs(r.recogerAntesDe) : '—'}
                  {seLePasoElPlazo(r, hoy) && <span className="pill pill--warn">Vencida</span>}
                </td>
                <td className="num">{formatCurrency(r.total)}</td>
                <td className="num">
                  {/* El aviso va en la fila y no solo en el cajón: cuando llega
                      el pedido de la imprenta hay quince reservas que avisar
                      seguidas, y abrir y cerrar quince cajones para eso es
                      justo lo que hace que nadie avise a nadie. */}
                  {r.estado === 'pendiente' && (
                    r.avisadaEn ? (
                      <span className="pill pill--ok">Avisada</span>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={trabajando}
                        onClick={() => void avisarQueEstaLista(r)}
                      >
                        Avisar de que está lista
                      </button>
                    )
                  )}
                  <button className="btn btn-outline btn-sm" onClick={() => { setAbierta(r); setError('') }}>
                    Ver
                  </button>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={6} className="form-hint">
                  {cargando
                    ? 'Buscando reservas…'
                    : reservas.length === 0
                      ? 'Todavía no ha reservado nadie. La tienda de la web se enciende en Web pública → Diseño.'
                      : 'Nada con ese filtro.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        open={Boolean(abierta)}
        onClose={cerrar}
        title={abierta ? `Reserva ${abierta.referencia}` : 'Reserva'}
        subtitle={abierta ? ESTADO[abierta.estado].texto : ''}
        footer={<button className="btn btn-ghost" onClick={cerrar}>Cerrar</button>}
      >
        {abierta && (
          <div className="app-form">
            <p className="form-hint">
              <b>{abierta.nombre}</b>
              {abierta.telefono && ` · ${abierta.telefono}`}
              {abierta.email && ` · ${abierta.email}`}
            </p>
            {abierta.notas && <p className="form-hint">«{abierta.notas}»</p>}

            <div className="table-card table-card--in-drawer">
              <table>
                <thead>
                  <tr><th>Artículo</th><th className="num">Uds.</th><th className="num">Precio</th></tr>
                </thead>
                <tbody>
                  {(lineas ?? []).map((l) => (
                    <tr key={l.id}>
                      <td><code>{l.codigo}</code> {l.nombre}</td>
                      <td className="num">{l.cantidad}</td>
                      {/* El precio que se le PROMETIÓ, no el de hoy: si la
                          hermandad ha subido la tarifa desde entonces, se
                          respeta el de la reserva. */}
                      <td className="num">{formatCurrency(l.precioUnitario * l.cantidad)}</td>
                    </tr>
                  ))}
                  {lineas === undefined && (
                    <tr><td colSpan={3} className="form-hint">Cargando lo que apartó…</td></tr>
                  )}
                  {lineas === null && (
                    <tr>
                      <td colSpan={3} className="form-hint">
                        No se ha podido traer lo que apartó. Vuelve a intentarlo antes de cobrar:
                        sin esto no se puede comprobar que le estás dando lo suyo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="reserva__total"><b>Total</b> <b>{formatCurrency(abierta.total)}</b></p>

            {error && <div className="banner-inline banner-inline--warn" role="alert">{error}</div>}

            {sePuedeEntregar(abierta) ? (
              soltando ? (
                /*
                  LA CONFIRMACIÓN DE SOLTAR. Dice a quién se le está quitando lo
                  suyo y con qué nombre, porque es una reserva de una persona
                  concreta y no una fila de una tabla.
                */
                <div className="banner-inline banner-inline--warn banner-inline--alerta">
                  <div>
                    <p>
                      Se va a {soltando === 'caducada' ? 'dar por caducada' : 'anular'} la reserva{' '}
                      <b>{abierta.referencia}</b> de <b>{abierta.nombre}</b>, por{' '}
                      <b>{formatCurrency(abierta.total)}</b>. La reserva NO se borra —queda con su
                      referencia—, pero el género vuelve a poder venderse en el mostrador.
                      {abierta.email && ' A esta persona no se le avisa: si hace falta, llámala.'}
                    </p>
                    <div className="form-row">
                      <label htmlFor="motivo-soltar">Por qué se suelta</label>
                      <input
                        id="motivo-soltar"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder={soltando === 'caducada' ? 'No vino a recogerlo' : 'Se arrepintió, ya no lo quiere…'}
                      />
                    </div>
                    <div className="fila-botones">
                      <button className="btn btn-primary rgpd-borrar" onClick={() => void soltar()} disabled={trabajando}>
                        {trabajando ? 'Soltando…' : soltando === 'caducada' ? 'Sí, darla por caducada' : 'Sí, anularla'}
                      </button>
                      <button className="btn btn-ghost" onClick={() => setSoltando(null)} disabled={trabajando}>
                        Dejarlo
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-row">
                    <label htmlFor="forma-pago-reserva">Cómo paga</label>
                    <select
                      id="forma-pago-reserva"
                      value={formaPago}
                      onChange={(e) => setFormaPago(e.target.value)}
                    >
                      {FORMAS_PAGO.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="fila-botones">
                    <button className="btn btn-primary" onClick={() => void cobrar()} disabled={trabajando}>
                      {trabajando ? 'Cobrando…' : `Cobrar y entregar ${formatCurrency(abierta.total)}`}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setSoltando('caducada')} disabled={trabajando}>
                      No vino: soltar
                    </button>
                    <button className="btn btn-ghost" onClick={() => setSoltando('anulada')} disabled={trabajando}>
                      Anular
                    </button>
                  </div>
                  <p className="form-hint">
                    Al cobrar sale la factura, baja el almacén y entran los apuntes en Tesorería.
                    Hasta entonces solo está apartado.
                  </p>
                  <div className="fila-botones">
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={trabajando}
                      onClick={() => void avisarQueEstaLista(abierta)}
                    >
                      {abierta.avisadaEn ? 'Volver a avisar' : 'Avisar de que está lista'}
                    </button>
                  </div>
                  <p className="form-hint">
                    {abierta.email
                      ? `Le va un correo a ${abierta.email}`
                      : 'No dejó correo, así que no se le puede escribir'}
                    {abierta.hermanoId && ', y le sale además en su área del hermano'}
                    . No se avisa dos veces el mismo día.
                  </p>
                </>
              )
            ) : (
              <p className="form-hint">
                Esta reserva está {ESTADO[abierta.estado].texto.toLowerCase()}.
                {abierta.estado === 'entregada'
                  ? ' Su factura está en «Ventas y facturas»; si hay que deshacerla, se anula desde la venta para que el número no quede en el aire.'
                  : ' El género que llevaba vuelve a estar disponible.'}
              </p>
            )}
          </div>
        )}
      </Drawer>
    </>
  )
}
