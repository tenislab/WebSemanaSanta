/** El buzón: los mensajes que la gente escribe desde la web. */
import Drawer from '../../../components/Drawer'
import { MOVIMIENTOS_INICIALES, type Movimiento } from '../../../data/movimientos'
import { conApunteDeCobro, origenDeMensajeWeb, yaApuntado } from '../../../lib/apuntes'
import { movimientoToRow, rowToMovimiento } from '../../../lib/db/movimientos'
import { ofrecerDeshacer, reinsertar } from '../../../lib/deshacer'
import { formatCurrency } from '../../../lib/format'
import {
  TIPOS_MENSAJE,
  actualizarMensajeWeb,
  borrarMensajeWeb,
  devolverMensajeWeb,
  getMensajesWeb,
  resumenMensaje,
  sinLeer,
  useMensajesWeb,
  type MensajeWeb,
} from '../../../lib/mensajesWeb'
import { CLAVES_DATOS } from '../../../lib/persistencia'
import { useSupabaseTable } from '../../../lib/supabaseSync'
import { useEffect, useRef, useState } from 'react'

export function BuzonWebTab({ abrirId }: { abrirId?: string | null }) {
  const [mensajes, guardar] = useMensajesWeb()
  const [filtro, setFiltro] = useState<'todos' | 'sinleer' | 'pendientes'>('todos')
  const [abierto, setAbierto] = useState<MensajeWeb | null>(null)
  // El libro de cuentas: un donativo que entra por la web puede apuntarse aquí
  // sin salir del buzón y sin teclear el importe otra vez.
  const [movimientos, setMovimientos] = useSupabaseTable<Movimiento>(
    'movimientos', CLAVES_DATOS.movimientos, MOVIMIENTOS_INICIALES, movimientoToRow, rowToMovimiento,
  )

  /**
   * Apunta en tesorería un donativo o una reserva de lotería.
   *
   * Va con BOTÓN y no solo, al marcar el mensaje como atendido, a propósito.
   * Un donativo por el formulario es alguien diciendo que QUIERE dar 300 €:
   * el dinero puede tardar días o no llegar nunca. Apuntarlo solo metería en
   * el libro ingresos que no han entrado, y ese descuadre es peor que no tener
   * el apunte. Lo pulsa el tesorero cuando ve el ingreso.
   */
  function apuntarEnTesoreria(m: MensajeWeb) {
    const origen = origenDeMensajeWeb(m.id)
    setMovimientos((prev) =>
      conApunteDeCobro(prev, {
        origen,
        concepto:
          m.tipo === 'loteria'
            ? `Lotería — ${m.nombre}${m.participaciones ? ` (${m.participaciones} participaciones)` : ''}`
            : `Donativo — ${m.nombre}`,
        categoria: m.tipo === 'loteria' ? 'Otros ingresos' : 'Donativos, Ofrendas y Cepillos',
        importe: m.importe ?? 0,
        fecha: m.fecha,
        metodo: m.metodo,
      }),
    )
    if (!m.atendido) cambiar(m.id, { atendido: true })
  }

  const yaEnTesoreria = (m: MensajeWeb) => yaApuntado(movimientos, origenDeMensajeWeb(m.id))

  const lista = mensajes.filter((m) =>
    filtro === 'sinleer' ? !m.leido : filtro === 'pendientes' ? !m.atendido : true,
  )

  async function cambiar(id: string, c: Partial<MensajeWeb>) {
    guardar(mensajes.map((m) => (m.id === id ? { ...m, ...c } : m)))
    setAbierto((prev) => (prev && prev.id === id ? { ...prev, ...c } : prev))
    await actualizarMensajeWeb(id, c)
  }

  async function borrar(id: string) {
    const posicion = mensajes.findIndex((m) => m.id === id)
    const mensaje = mensajes[posicion]
    guardar(mensajes.filter((m) => m.id !== id))
    setAbierto((prev) => (prev && prev.id === id ? null : prev))
    await borrarMensajeWeb(id)
    // Detrás de cada uno de estos hay alguien de fuera que ha escrito y ha
    // dejado su teléfono. Borrado por error no da ningún aviso: ese contacto
    // simplemente deja de existir y nadie sabe que existió.
    if (mensaje) {
      ofrecerDeshacer(`Mensaje de ${mensaje.nombre || 'la web'} borrado`, () => {
        guardar(reinsertar(getMensajesWeb().filter((m) => m.id !== id), mensaje, posicion))
        void devolverMensajeWeb(mensaje, posicion)
      })
    }
  }

  /*
   * «Leerlo» viene de Notificaciones con el mensaje puesto en la URL: se abre
   * ese, sin buscarlo en la lista. Espera a que los mensajes estén cargados
   * —la primera vuelta la lista viene vacía— y solo lo hace una vez, para que
   * cerrar la ficha no la vuelva a abrir.
   */
  const yaAbierto = useRef(false)
  useEffect(() => {
    if (!abrirId || yaAbierto.current) return
    const m = mensajes.find((x) => x.id === abrirId)
    if (!m) return
    yaAbierto.current = true
    abrir(m)
    // `abrir` cambia en cada pintado; lo que manda es el identificador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId, mensajes])

  function abrir(m: MensajeWeb) {
    setAbierto(m)
    // Se marca leído al abrirlo, no al recibirlo: la marca del raíl tiene que
    // significar «no lo ha visto nadie».
    if (!m.leido) cambiar(m.id, { leido: true })
  }

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Buzón de la web</h2>
        {sinLeer(mensajes) > 0 && <span className="pill pill--warn">{sinLeer(mensajes)} sin leer</span>}
      </div>
      <p className="form-hint">
        Lo que llega desde la web: mensajes del formulario de contacto, avisos de donativo y reservas
        de lotería. Las solicitudes de alta no salen aquí: van a <b>Hermanos → Solicitudes de alta</b>,
        con el resto.
      </p>
      {mensajes.length === 0 ? (
        <p className="form-hint">
          Todavía no ha llegado nada. Se llena solo en cuanto alguien use un formulario de la web.
        </p>
      ) : (
        <>
          <div className="filters">
            {([
              ['todos', `Todo (${mensajes.length})`],
              ['sinleer', `Sin leer (${sinLeer(mensajes)})`],
              ['pendientes', `Por atender (${mensajes.filter((m) => !m.atendido).length})`],
            ] as const).map(([id, txt]) => (
              <button
                key={id} type="button"
                className={`chip${filtro === id ? ' chip--active' : ''}`}
                onClick={() => setFiltro(id)}
              >
                {txt}
              </button>
            ))}
          </div>
          <ul className="buzonweb">
            {lista.map((m) => (
              <li key={m.id} className={m.leido ? undefined : 'buzonweb__nuevo'}>
                <button type="button" className="buzonweb__fila" onClick={() => abrir(m)}>
                  <span className="buzonweb__ic" aria-hidden="true">{TIPOS_MENSAJE[m.tipo].icono}</span>
                  <span className="buzonweb__texto">
                    <span className="buzonweb__quien">{m.nombre}</span>
                    <span className="buzonweb__resumen">{resumenMensaje(m)}</span>
                  </span>
                  <span className="buzonweb__meta">
                    <span className="buzonweb__fecha">{m.fecha}</span>
                    {!m.atendido && <span className="buzonweb__pendiente">Por atender</span>}
                  </span>
                </button>
              </li>
            ))}
            {lista.length === 0 && <li className="form-hint">Nada con ese filtro.</li>}
          </ul>
        </>
      )}

      <Drawer
        open={!!abierto}
        onClose={() => setAbierto(null)}
        title={abierto ? TIPOS_MENSAJE[abierto.tipo].nombre : ''}
        subtitle={abierto ? `${abierto.nombre} · ${abierto.fecha}` : undefined}
        footer={
          abierto && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => cambiar(abierto.id, { atendido: !abierto.atendido })}
              >
                {abierto.atendido ? 'Marcar como pendiente' : 'Dar por atendido'}
              </button>
              {/* Solo cuando hay dinero de por medio y todavía no se ha
                  apuntado. Un donativo que se queda fuera del libro descuadra
                  el balance del año sin que nadie sepa por qué. */}
              {(abierto.tipo === 'donativo' || abierto.tipo === 'loteria') &&
                (abierto.importe ?? 0) > 0 &&
                (yaEnTesoreria(abierto) ? (
                  <span className="form-hint form-hint--ok" style={{ alignSelf: 'center' }}>
                    ✓ Apuntado en tesorería
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => apuntarEnTesoreria(abierto)}
                  >
                    Apuntar {formatCurrency(abierto.importe ?? 0)} en tesorería
                  </button>
                ))}
              <a className="btn btn-outline" href={`mailto:${abierto.email}?subject=${encodeURIComponent(abierto.asunto || 'Tu mensaje')}`}>
                Contestar por correo
              </a>
              <button className="btn btn-ghost rgpd-borrar" onClick={() => borrar(abierto.id)}>
                Borrar
              </button>
            </>
          )
        }
      >
        {abierto && (
          <>
            <dl className="familia-ficha__datos">
              <div><dt>Correo</dt><dd><a href={`mailto:${abierto.email}`}>{abierto.email}</a></dd></div>
              {abierto.telefono && <div><dt>Teléfono</dt><dd><a href={`tel:${abierto.telefono.replace(/\s+/g, '')}`}>{abierto.telefono}</a></dd></div>}
              {abierto.importe != null && <div><dt>Importe</dt><dd>{abierto.importe} €</dd></div>}
              {abierto.causa && <div><dt>Lo destina a</dt><dd>{abierto.causa}</dd></div>}
              {abierto.metodo && <div><dt>Por</dt><dd>{abierto.metodo}</dd></div>}
              {abierto.participaciones != null && (
                <div><dt>Participaciones</dt><dd>{abierto.participaciones}</dd></div>
              )}
            </dl>
            {abierto.mensaje.trim() && (
              <>
                <h3 className="buzonweb__asunto">{abierto.asunto || 'Mensaje'}</h3>
                <p className="buzonweb__cuerpo">{abierto.mensaje}</p>
              </>
            )}
          </>
        )}
      </Drawer>
    </section>
  )
}

/* -------------------------- Estación de penitencia -------------------------- */
