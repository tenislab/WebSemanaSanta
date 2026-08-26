/**
 * LO QUE HA APARTADO LA GENTE DESDE LA WEB.
 *
 * Aquí llega lo que se reserva en la tienda de la web pública. No es una
 * pantalla de consulta: es la que hay que abrir cuando alguien se planta en la
 * casa de hermandad diciendo «vengo a por lo mío», y de ella salen las dos
 * únicas cosas que se le pueden hacer a una reserva —cobrarla y entregarla, o
 * soltarla—.
 *
 * COBRAR Y ENTREGAR ES LO QUE CREA LA VENTA. Hasta ese momento no hay factura,
 * no hay asiento en Tesorería y el género sigue contando en el almacén: lo
 * único que hay es un compromiso. Por eso el botón dice «Cobrar y entregar» y
 * pide la forma de pago: lo que se está haciendo es exactamente lo mismo que
 * en la caja, con la cesta ya escrita.
 *
 * Y SOLTAR NO BORRA. La reserva se queda, marcada como anulada o caducada, y
 * el género vuelve a poder prometerse. Una reserva borrada es una llamada de
 * teléfono que nadie puede explicar: «yo aparté una medalla la semana pasada»
 * y no hay rastro de nada.
 */
import { useEffect, useMemo, useState } from 'react'
import Drawer from '../../components/Drawer'
import AvisoFalta from '../../components/AvisoFalta'
import { requisito } from '../../lib/requisitos'
import { formatCurrency } from '../../lib/format'
import { fechaEs } from '../../lib/leerTabla'
import { hoyIso } from '../../lib/hoy'
import { llano } from '../../lib/buscar'
import { entregarReserva, lineasDeReserva, soltarReserva, useReservas } from '../../lib/tienda'
import {
  FORMAS_PAGO, sePuedeEntregar, seLePasoElPlazo,
  type EstadoReserva, type LineaReserva, type Reserva,
} from '../../data/tienda'

/** Cómo se lee cada estado y con qué color. */
const ESTADO: Record<EstadoReserva, { texto: string; pill: string }> = {
  pendiente: { texto: 'Pendiente de recoger', pill: 'pill--warn' },
  entregada: { texto: 'Entregada', pill: 'pill--ok' },
  anulada: { texto: 'Anulada', pill: 'pill--off' },
  caducada: { texto: 'Caducada', pill: 'pill--off' },
}

type Filtro = 'pendientes' | 'vencidas' | 'todas'

export default function TiendaReservas() {
  const { reservas, cargando, recargar } = useReservas()
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('pendientes')
  const [abierta, setAbierta] = useState<Reserva | null>(null)
  const [lineas, setLineas] = useState<LineaReserva[] | null | undefined>(undefined)
  const [formaPago, setFormaPago] = useState<string>(FORMAS_PAGO[0])
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState('')

  const reqBase = requisito('supabase')
  const hoy = hoyIso()

  useEffect(() => {
    if (!abierta) { setLineas(undefined); return }
    setLineas(undefined)
    let cancelado = false
    void lineasDeReserva(abierta.id).then((ls) => { if (!cancelado) setLineas(ls) })
    return () => { cancelado = true }
  }, [abierta])

  const visibles = useMemo(() => {
    const q = llano(query.trim())
    return reservas.filter((r) => {
      if (filtro === 'pendientes' && r.estado !== 'pendiente') return false
      if (filtro === 'vencidas' && !seLePasoElPlazo(r, hoy)) return false
      if (!q) return true
      return llano(r.nombre).includes(q) || llano(r.referencia).includes(q)
        || llano(r.telefono).includes(q) || llano(r.email).includes(q)
    })
  }, [reservas, query, filtro, hoy])

  const resumen = useMemo(() => {
    const pend = reservas.filter((r) => r.estado === 'pendiente')
    return {
      pendientes: pend.length,
      comprometido: pend.reduce((n, r) => n + r.total, 0),
      vencidas: reservas.filter((r) => seLePasoElPlazo(r, hoy)).length,
    }
  }, [reservas, hoy])

  function aviso(texto: string) {
    setHecho(texto)
    setTimeout(() => setHecho(''), 5000)
  }

  async function cobrar() {
    if (!abierta || trabajando) return
    setTrabajando(true)
    setError('')
    const r = await entregarReserva(abierta.id, formaPago)
    setTrabajando(false)
    if (!r.ok) {
      // El mensaje de la base va TAL CUAL: los suyos están escritos para
      // leerlos con la persona delante del mostrador.
      setError(r.error)
      return
    }
    setAbierta(null)
    recargar()
    aviso(`Cobrado y entregado. Factura ${r.venta.serie}-${r.venta.numero}, ${formatCurrency(r.venta.total)}.`)
  }

  async function soltar(estado: 'anulada' | 'caducada') {
    if (!abierta || trabajando) return
    setTrabajando(true)
    setError('')
    const motivo = estado === 'caducada' ? 'Se pasó el plazo de recogida' : 'Anulada desde el panel'
    const r = await soltarReserva(abierta.id, motivo, estado)
    setTrabajando(false)
    if (!r.ok) { setError(r.error ?? 'No se ha podido soltar.'); return }
    setAbierta(null)
    recargar()
    aviso(`Reserva ${estado}. El género vuelve a estar disponible.`)
  }

  return (
    <div className="dash">
      <div className="dash-head dash-head--row">
        <div>
          <p className="eyebrow">Tienda</p>
          <h1>Reservas de la web</h1>
          <p className="dash-head__lead">
            Lo que la gente ha apartado por internet. Se paga al recogerlo aquí.
          </p>
        </div>
      </div>

      {!reqBase.listo && <AvisoFalta requisito={reqBase} />}
      {hecho && <div className="banner banner--ok" role="status">{hecho}</div>}

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-tile__label">Sin recoger</span>
          <span className="stat-tile__value">{resumen.pendientes}</span>
          <span className="stat-tile__trend stat-tile__trend--neutral">Reservas pendientes</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Comprometido</span>
          <span className="stat-tile__value">{formatCurrency(resumen.comprometido)}</span>
          {/* NO es dinero cobrado: es lo que se cobrará si vienen todos. Se
              dice aquí para que nadie lo lea como caja. */}
          <span className="stat-tile__trend stat-tile__trend--neutral">Todavía sin cobrar</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Se les pasó el plazo</span>
          <span className="stat-tile__value">{resumen.vencidas}</span>
          <span className={`stat-tile__trend stat-tile__trend--${resumen.vencidas > 0 ? 'warn' : 'ok'}`}>
            {resumen.vencidas > 0 ? 'Género apartado para nadie' : 'Ninguna vencida'}
          </span>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Buscar por nombre, referencia o teléfono"
          aria-label="Buscar reservas por nombre, referencia o teléfono"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filters">
          {([
            ['pendientes', 'Pendientes'],
            ['vencidas', 'Se les pasó el plazo'],
            ['todas', 'Todas'],
          ] as [Filtro, string][]).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              className={`chip${filtro === id ? ' chip--active' : ''}`}
              onClick={() => setFiltro(id)}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

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
                      ? 'Todavía no ha reservado nadie. La tienda se enciende en Web pública → Diseño.'
                      : 'Nada con ese filtro.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        open={Boolean(abierta)}
        onClose={() => setAbierta(null)}
        title={abierta ? `Reserva ${abierta.referencia}` : 'Reserva'}
        subtitle={abierta ? ESTADO[abierta.estado].texto : ''}
        footer={<button className="btn btn-ghost" onClick={() => setAbierta(null)}>Cerrar</button>}
      >
        {abierta && (
          <div className="app-form">
            <p className="form-hint">
              <b>{abierta.nombre}</b>
              {abierta.telefono && ` · ${abierta.telefono}`}
              {abierta.email && ` · ${abierta.email}`}
            </p>
            {abierta.notas && <p className="form-hint">«{abierta.notas}»</p>}

            <div className="table-card">
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

            {error && <div className="banner banner--error" role="alert">{error}</div>}

            {sePuedeEntregar(abierta) ? (
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
                  <button className="btn btn-ghost" onClick={() => void soltar('caducada')} disabled={trabajando}>
                    No vino: soltar
                  </button>
                  <button className="btn btn-ghost" onClick={() => void soltar('anulada')} disabled={trabajando}>
                    Anular
                  </button>
                </div>
                <p className="form-hint">
                  Al cobrar sale la factura, baja el almacén y entran los apuntes en Tesorería.
                  Hasta entonces solo está apartado.
                </p>
              </>
            ) : (
              <p className="form-hint">
                Esta reserva está {ESTADO[abierta.estado].texto.toLowerCase()}.
                {abierta.estado === 'entregada'
                  ? ' Su factura está en la tienda; si hay que deshacerla, se anula desde la venta para que el número no quede en el aire.'
                  : ' El género que llevaba vuelve a estar disponible.'}
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
