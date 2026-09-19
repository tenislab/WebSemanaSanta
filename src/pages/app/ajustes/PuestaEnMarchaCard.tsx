import AvisoFalta from '../../../components/AvisoFalta'
import { contextoActual, requisitos } from '../../../lib/requisitos'

/**
 * Puesta en marcha: un solo sitio que dice qué falta por conectar para que
 * Gobergo funcione del todo, y quién lo arregla.
 *
 * Existe porque lo que falta estaba repartido: la base de datos se veía en un
 * sitio, el correo en otro, la pasarela en un tercero, y nadie tenía la foto
 * entera. Al ir a poner la aplicación en marcha, la primera pregunta de una
 * junta es «¿qué me queda?», y hasta ahora no había dónde mirarlo.
 */
export default function PuestaEnMarchaCard() {
  const todos = Object.values(requisitos(contextoActual()))
  const pendientes = todos.filter((r) => !r.listo)
  const listos = todos.filter((r) => r.listo)

  return (
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Puesta en marcha</h2>
        {pendientes.length > 0 && <span className="pill pill--warn">{pendientes.length} por conectar</span>}
      </div>
      <p className="form-hint">
        Gobergo funciona entero sin nada de esto: se puede llevar el censo, cobrar las cuotas, repartir
        las papeletas y publicar la web. Lo de aquí abajo es lo que le falta para funcionar <b>del
        todo</b>, y casi todo lo contrata la hermandad a su nombre, no nosotros.
      </p>

      {pendientes.length === 0 ? (
        <p className="form-hint"><b>Está todo conectado.</b> No queda nada pendiente por aquí.</p>
      ) : (
        <div className="puesta-lista">
          {pendientes.map((r) => (
            <AvisoFalta key={r.id} requisito={r} />
          ))}
        </div>
      )}

      {listos.length > 0 && (
        <>
          <h3 className="puesta-hecho__titulo">Ya conectado</h3>
          <ul className="puesta-hecho">
            {listos.map((r) => (
              <li key={r.id}>{r.nombre}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
