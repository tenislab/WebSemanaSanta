import { useState } from 'react'
import { TIPOS_AVISO, quiereAviso, type AvisoHermano, type PreferenciasAvisos, type TipoAviso } from '../lib/avisosHermano'
import AvisoFalta from './AvisoFalta'
import { requisito } from '../lib/requisitos'

const ICONO: Record<string, string> = Object.fromEntries(TIPOS_AVISO.map((t) => [t.id, t.icono]))

/**
 * El buzón del hermano: lo que le manda la hermandad, leído y sin leer, y qué
 * quiere recibir.
 *
 * Antes solo llegaban aquí los cambios que la secretaría hacía en su ficha, y
 * el único gesto posible era «marcar todos como leídos». Ahora entran también
 * los comunicados, las cuotas y la papeleta, cada uno se marca por separado, y
 * el hermano decide qué le interesa.
 */
export default function BuzonHermano({
  avisos,
  sinLeer,
  marcarLeidos,
  marcarLeido,
  borrar,
  preferencias,
  errorPreferencias,
  cambiarPreferencia,
}: {
  avisos: AvisoHermano[]
  sinLeer: number
  marcarLeidos: () => void
  marcarLeido: (id: string, leido: boolean) => void
  borrar: (id: string) => void
  preferencias: PreferenciasAvisos
  /**
   * Por qué no se pudo guardar el último cambio, si es que no se pudo.
   *
   * Hace falta decirlo: si la base rechaza el cambio, el interruptor vuelve
   * solo a como estaba, y sin explicación parece que la pantalla no responde
   * al clic. Y lo que está en juego es que le sigan llegando correos que
   * acaba de apagar.
   */
  errorPreferencias?: string | null
  cambiarPreferencia: (tipo: TipoAviso, quiere: boolean) => void
}) {
  const [soloSinLeer, setSoloSinLeer] = useState(false)
  const visibles = soloSinLeer ? avisos.filter((a) => !a.leido) : avisos
  const apagados = TIPOS_AVISO.filter((t) => !quiereAviso(preferencias, t.id))

  return (
    <section className="portal__section" id="mis-avisos">
      <div className="portal__avisos-head">
        <h2>
          Mis notificaciones
          {sinLeer > 0 && <span className="portal__avisos-badge">{sinLeer}</span>}
        </h2>
        <div className="assign-box__row">
          {avisos.some((a) => a.leido) && (
            <label className="checkbox">
              <input type="checkbox" checked={soloSinLeer} onChange={(e) => setSoloSinLeer(e.target.checked)} />
              <span>Solo sin leer</span>
            </label>
          )}
          {sinLeer > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={marcarLeidos}>Marcar todos como leídos</button>
          )}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="form-hint">
          {avisos.length === 0
            ? 'No tienes ninguna notificación. Aquí te llegará lo que te mande la hermandad: cuotas, papeletas, comunicados y lo que te encargue la junta.'
            : 'No te queda nada sin leer.'}
        </p>
      ) : (
        <ul className="portal__avisos">
          {visibles.map((a) => (
            <li key={a.id} className={`portal__aviso${a.leido ? '' : ' portal__aviso--nuevo'}`}>
              <span className="portal__aviso-icono" aria-hidden="true">{ICONO[a.tipo ?? 'ficha'] ?? '✉️'}</span>
              <div>
                {a.titulo && <strong className="portal__aviso-titulo">{a.titulo}</strong>}
                <p>{a.texto}</p>
                <small>{a.fecha}</small>
              </div>
              <div className="portal__aviso-acciones">
                <button
                  type="button"
                  className="icon-btn"
                  title={a.leido ? 'Marcar como sin leer' : 'Marcar como leído'}
                  aria-label={a.leido ? 'Marcar como sin leer' : 'Marcar como leído'}
                  onClick={() => marcarLeido(a.id, !a.leido)}
                >
                  {a.leido ? '↺' : '✓'}
                </button>
                <button
                  type="button"
                  className="icon-btn rgpd-borrar"
                  title="Quitar del buzón"
                  aria-label="Quitar del buzón"
                  onClick={() => borrar(a.id)}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="afinar afinar--suelto">
        <summary className="afinar__cabeza">
          <span className="afinar__titulo">Qué quiero recibir</span>
          <span className="afinar__nota">
            {apagados.length === 0 ? 'Todo' : `${apagados.length} apagado${apagados.length === 1 ? '' : 's'}`}
          </span>
        </summary>
        <div className="afinar__cuerpo">
          {TIPOS_AVISO.map((t) => (
            <label className="checkbox" key={t.id}>
              <input
                type="checkbox"
                checked={quiereAviso(preferencias, t.id)}
                onChange={(e) => cambiarPreferencia(t.id, e.target.checked)}
              />
              <span>
                {t.icono} {t.nombre}
                <small className="portal__pref-explica">{t.explica}</small>
              </span>
            </label>
          ))}
          {errorPreferencias && (
            <div className="banner banner--error" role="alert">
              <b>No se ha guardado el cambio.</b> {errorPreferencias}
            </div>
          )}
          <p className="form-hint">
            Esto vale para tu buzón, y es lo que la hermandad respetará cuando envíe correos. Lo que
            apagues no se borra: si vuelves a encenderlo, aparece otra vez.
          </p>
          {/* Lo honrado: aquí se está eligiendo qué correos recibir, y ahora
              mismo no sale ninguno. Decirlo evita que alguien se quede
              esperando un aviso que no va a llegar a su bandeja. */}
          <AvisoFalta compacto requisito={requisito('correo')} />
        </div>
      </details>
    </section>
  )
}
