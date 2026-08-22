import { useState, type FormEvent } from 'react'
import { etiquetaTramo, type Tramo } from '../lib/tramos'
import { formatCurrency } from '../lib/format'
import { edadDe } from '../lib/hermanoFicha'
import type { Hermano } from '../data/hermanos'
import type { Papeleta } from '../data/papeletas'
import type { Cuota } from '../data/cuotas'
import type { SolicitudAlta } from '../lib/solicitudes'

/**
 * La familia a cargo de este hermano: los menores que lleva él.
 *
 * Es lo que más se pide del área del hermano. Un niño de ocho años no tiene
 * correo ni forma de entrar, así que hasta ahora sus padres tenían que pasar
 * por secretaría para cada papeleta y para cada recibo. Aquí lo ven y lo
 * gestionan desde su propia cuenta.
 */
export default function MiFamilia({
  aCargo,
  papeletas,
  cuotas,
  tramos,
  anioCampana,
  solicitudesPendientes,
  onSolicitarAlta,
  bloqueado,
}: {
  /** Los hermanos que este hermano tiene a su cargo. */
  aCargo: Hermano[]
  /** Todas las papeletas (se filtran aquí por cada hijo). */
  papeletas: Papeleta[]
  cuotas: Cuota[]
  tramos: Tramo[]
  anioCampana: number
  /** Altas que ya ha pedido y siguen sin tramitar. */
  solicitudesPendientes: SolicitudAlta[]
  /**
   * Manda la solicitud de alta de un menor a secretaría.
   *
   * DEVUELVE SI HA SALIDO. Antes no devolvía nada y esta pantalla ponía
   * «solicitud enviada» pase lo que pase: si la base la rechazaba, el hermano
   * se quedaba convencido de haber pedido el alta de su hijo y en secretaría
   * no había entrado nada. Nadie se enteraba hasta que preguntaba, semanas
   * después, por qué su hijo no salía en el cortejo.
   */
  onSolicitarAlta: (datos: { nombre: string; dni: string; fechaNacimiento: string })
    => Promise<{ ok: boolean; error?: string }>
  /** Motivo por el que no puede pedir nada ahora mismo (baja, deuda…). */
  bloqueado?: string | null
}) {
  const [abriendo, setAbriendo] = useState(false)
  const [enviada, setEnviada] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const d = new FormData(form)
    const nombre = String(d.get('nombre') ?? '').trim()
    const dni = String(d.get('dni') ?? '').trim()
    const fechaNacimiento = String(d.get('nacimiento') ?? '')
    if (!nombre || enviando) return
    setEnviando(true)
    try {
      const r = await onSolicitarAlta({ nombre, dni, fechaNacimiento })
      // El «solicitud enviada» SOLO si de verdad ha salido: ver `onSolicitarAlta`.
      if (!r.ok) {
        setError(r.error ?? 'No se ha podido enviar la solicitud. Inténtalo otra vez en un momento.')
        return
      }
      setError(null)
      setAbriendo(false)
      setEnviada(true)
      form.reset()
    } finally {
      setEnviando(false)
    }
  }

  const tramoDe = (id: string | null) => (id ? tramos.find((t) => t.id === id) ?? null : null)

  return (
    <section className="portal__section" id="mi-familia">
      <h2>Mi familia</h2>
      <p className="portal__lead">
        Los hermanos que llevas tú. Aquí ves su papeleta y sus cuotas sin pasar por secretaría.
      </p>

      {aCargo.length === 0 && solicitudesPendientes.length === 0 && (
        <p className="form-hint">Todavía no tienes a nadie a tu cargo.</p>
      )}

      {aCargo.map((h) => {
        const suya = papeletas.find((p) => p.hermanoId === h.id && p.anio === anioCampana && p.estado !== 'Anulada')
        const tramo = tramoDe(suya?.tramoId ?? null)
        const debe = cuotas
          .filter((c) => c.hermanoId === h.id)
          .filter((c) => c.estado === 'Pendiente' || c.estado === 'En mora' || c.estado === 'Devuelta')
          .reduce((n, c) => n + c.importe, 0)
        const edad = edadDe(h.fechaNacimiento)
        return (
          <div className="familia-ficha" key={h.id}>
            <div className="familia-ficha__cabeza">
              <span className="familia-ficha__nombre">{h.nombre}</span>
              <span className="pill pill--off">nº {h.numero > 0 ? h.numero : '—'}</span>
              {edad !== null && <span className="pill pill--info">{edad} años</span>}
              <span className={`pill ${h.estado === 'Activo' ? 'pill--ok' : h.estado === 'Nuevo' ? 'pill--info' : 'pill--off'}`}>
                {h.estado}
              </span>
            </div>
            <dl className="familia-ficha__datos">
              <div>
                <dt>Papeleta {anioCampana}</dt>
                <dd>
                  {suya
                    ? `${suya.estado}${tramo ? ` · ${etiquetaTramo(tramo)}` : suya.opcion ? ` · ${suya.opcion}` : ''}`
                    : 'Sin papeleta todavía'}
                </dd>
              </div>
              <div>
                <dt>Cuotas</dt>
                <dd>{debe > 0 ? `${formatCurrency(debe)} pendiente` : 'Al día'}</dd>
              </div>
            </dl>
            <p className="form-hint">
              Para sacarle la papeleta o cambiarle el sitio, habla con la secretaría: desde aquí
              todavía no se puede pedir por otro.
            </p>
          </div>
        )
      })}

      {solicitudesPendientes.map((s) => (
        <div className="familia-ficha familia-ficha--espera" key={s.id}>
          <div className="familia-ficha__cabeza">
            <span className="familia-ficha__nombre">{s.nombre}</span>
            <span className="pill pill--warn">Alta pendiente</span>
          </div>
          <p className="form-hint">Enviada el {s.fecha}. La secretaría la revisará y te avisará.</p>
        </div>
      ))}

      {enviada && (
        <div className="banner-inline banner-inline--ok">
          <span>Solicitud enviada. La secretaría la revisará y te avisará.</span>
        </div>
      )}

      {bloqueado ? (
        <p className="form-hint form-hint--error">{bloqueado}</p>
      ) : abriendo ? (
        <form className="assign-box" onSubmit={enviar}>
          <label>Dar de alta a un hijo o hija</label>
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="famNombre">Nombre y apellidos</label>
              <input id="famNombre" name="nombre" type="text" required autoFocus />
            </div>
            <div className="form-row">
              <label htmlFor="famNacimiento">Fecha de nacimiento</label>
              <input id="famNacimiento" name="nacimiento" type="date" />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="famDni">DNI (si ya tiene)</label>
            <input id="famDni" name="dni" type="text" placeholder="Puede ir vacío si aún no tiene" />
          </div>
          <p className="form-hint">
            La secretaría lo revisará antes de darlo de alta. Quedará a tu cargo, y sus cuotas y su
            papeleta las verás aquí.
          </p>
          {error && (
            <div className="banner banner--error" role="alert">
              {error}
            </div>
          )}
          <div className="assign-box__row">
            <button type="submit" className="btn btn-primary" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar la solicitud'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setAbriendo(false)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-outline" onClick={() => { setAbriendo(true); setEnviada(false); setError(null) }}>
          + Dar de alta a un hijo o hija
        </button>
      )}
    </section>
  )
}
