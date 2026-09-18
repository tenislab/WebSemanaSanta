/**
 * EL PANEL DE LOS ENCARGOS DE REDES.
 *
 * El formulario de encargar un post arriba y, debajo, lo que está a medias con
 * quién lo lleva y cómo va. Los terminados no se pintan: lo que esta pantalla
 * tiene que contestar es «qué falta», no «qué se hizo».
 *
 * Dos props: `encargos` es lo que devuelve `useEncargosDeRedes()` de una
 * pieza, y `hermanos` hace falta para poner el nombre de quien lleva cada
 * tarea —el encargo guarda el id, no el nombre—.
 */
import type { Hermano } from '../../../data/hermanos'
import { REDES_SOCIALES } from '../../../data/comunicados'
import { comoVa, loQueHayQueHacer } from '../../../lib/tareasRedes'
import type { LosEncargos } from './encargosDeRedes'

export default function PanelDeEncargos({ encargos, hermanos }: {
  encargos: LosEncargos
  hermanos: Hermano[]
}) {
  const {
    laJunta, otrosHermanos, hayAQuienEncargar,
    encargosAbiertos, crearEncargo, encargoHecho, encargoError,
  } = encargos
  return (
    <>
    {/*
      ENCARGAR UN POST Y QUE SE REPARTA SOLO.
      Va justo debajo de las redes porque es lo que se hace CON ellas, y
      encima de los comunicados porque un encargo es trabajo pendiente y un
      comunicado es algo ya enviado.
    */}
    <section className="redes-panel" aria-labelledby="encargos-titulo">
      <header className="redes-panel__head">
        <div className="redes-panel__que">
          <h2 id="encargos-titulo">
            Encargar un post
            {encargosAbiertos.length > 0 && (
              <span className="redes-panel__marcador">
                <b>{encargosAbiertos.length}</b> sin terminar
              </span>
            )}
          </h2>
          <p className="table-subtle">
            Se escribe una vez y salen solas las tareas: escribirlo y subirlo a cada red. Cada
            responsable lo ve en su área de hermano, sin entrar aquí.
          </p>
        </div>
      </header>

      <form className="app-form" onSubmit={crearEncargo}>
        <div className="form-row">
          <label htmlFor="encargoTitulo">De qué es el post</label>
          <input id="encargoTitulo" name="titulo" type="text" required
            placeholder="Besamanos de la Virgen, sábado 12" />
        </div>
        <div className="form-row">
          <label htmlFor="encargoTexto">Texto (opcional)</label>
          <textarea id="encargoTexto" name="texto" rows={3}
            placeholder="Lo que quieres que se publique. Si lo dejas vacío, lo escribe quien se encargue." />
        </div>
        <div className="assign-box">
          <label id="encargoRedesLabel">En qué redes</label>
          <div role="group" aria-labelledby="encargoRedesLabel" className="assign-box__row">
            {REDES_SOCIALES.map((r) => (
              <label key={r} className="checkbox-row" htmlFor={`encargoRed-${r}`}>
                <input id={`encargoRed-${r}`} type="checkbox" name="redes" value={r} />
                {r}
              </label>
            ))}
          </div>
        </div>
        {/*
          LA JUNTA PRIMERO, PERO NO SOLO LA JUNTA. La tarea le llega a la
          persona en SU ÁREA, sin pisar el panel, así que no hace falta que
          lleve ningún cargo para poder hacerla — y quien lleva el Instagram
          de una hermandad muchas veces no lo lleva.
        */}
        <div className="form-grid-2">
          <div className="form-row">
            <label htmlFor="encargoQuienCrea">Quién lo escribe</label>
            <select id="encargoQuienCrea" name="quienCrea" defaultValue="">
              <option value="">Sin repartir todavía</option>
              {laJunta.length > 0 && (
                <optgroup label="Junta de gobierno">
                  {laJunta.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
                </optgroup>
              )}
              {otrosHermanos.length > 0 && (
                <optgroup label="Otros hermanos">
                  {otrosHermanos.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="encargoQuienSube">Quién lo sube a las redes</label>
            <select id="encargoQuienSube" name="quienSube" defaultValue="">
              <option value="">Sin repartir todavía</option>
              {laJunta.length > 0 && (
                <optgroup label="Junta de gobierno">
                  {laJunta.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
                </optgroup>
              )}
              {otrosHermanos.length > 0 && (
                <optgroup label="Otros hermanos">
                  {otrosHermanos.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        </div>
        {!hayAQuienEncargar && (
          <p className="form-hint form-hint--error">
            Todavía no hay a quién encargárselo: no hay ningún hermano activo en el censo. El
            post se puede dejar escrito y repartirlo después.
          </p>
        )}
        <div className="assign-box__row">
          <button type="submit" className="btn btn-primary">Encargar y repartir</button>
          {encargoHecho && <span className="alert-item alert-item--ok">{encargoHecho}</span>}
          {encargoError && <span className="alert-item alert-item--alerta">{encargoError}</span>}
        </div>
      </form>

      {encargosAbiertos.length > 0 && (
        <ul className="lista-limpia" style={{ marginTop: '1rem' }}>
          {encargosAbiertos.map((g) => {
            const va = comoVa(g.tareas)
            return (
              <li key={g.encargoId} className="assign-box" style={{ marginBottom: '0.6rem' }}>
                <div>
                  <strong>{g.titulo}</strong>
                  <span className="table-subtle"> · {va.hechas} de {va.total} hechas</span>
                  <ul className="lista-limpia">
                    {g.tareas.map((t) => (
                      <li key={t.id}>
                        {t.estado === 'hecha' ? '✅' : '⬜'} {loQueHayQueHacer(t)}
                        {' — '}
                        {/* Sin responsable no es «de nadie»: es un encargo a medio
                            repartir, y hay que poder verlo de un vistazo. */}
                        {t.hermanoId
                          ? (hermanos.find((h) => h.id === t.hermanoId)?.nombre ?? 'alguien que ya no está en el censo')
                          : <b>sin repartir</b>}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
    </>
  )
}
