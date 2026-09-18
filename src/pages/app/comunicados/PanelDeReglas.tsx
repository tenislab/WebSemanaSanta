/**
 * LAS REGLAS QUE SE DISPARAN SOLAS.
 *
 * Una regla es un sesgo + un texto + un cuándo. Cuando le toca, escribe un
 * comunicado programado para hoy y ahí acaba su trabajo: lo manda el camino de
 * siempre, con su candado y su «Hola {nombre}».
 *
 * NACEN APAGADAS, y es la decisión que separa esto de una máquina de mandar
 * correos sin supervisión: una regla encendida escribe a ochocientas personas
 * en nombre de la hermandad sin que nadie lea el texto antes. Se ve a cuánta
 * gente alcanzaría HOY, y se enciende cuando se ha visto. Encender es un clic;
 * deshacer ochocientos correos no es nada.
 *
 * CINCO PROPS, Y NO ONCE. La cuenta a pelo salían once, y cuatro de ellas eran
 * el censo con sus cargos, sus roles y sus cuotas resueltas — que este panel no
 * tiene por qué conocer. Aparecían en DOS sitios y para lo mismo: saber a
 * quién alcanza una regla. Así que se le pasan las dos capacidades
 * (`aCuantosAlcanzaHoy`, `unoDeLosQueRecibirian`) y no las cuatro estructuras.
 * Es una reducción de verdad, no un objeto que esconda las once detrás de un
 * nombre: el panel depende de menos cosas, no de las mismas con otra cara.
 */
import { vistaPrevia, sePuedePersonalizar, llevaMarcas, MARCAS } from '../../../lib/personalizar'
import { REDES_SOCIALES } from '../../../data/comunicados'
import type { Hermano } from '../../../data/hermanos'
import { REGLAS_DE_FABRICA, type ReglaAutomatica } from '../../../lib/reglasAutomaticas'
import { nuevoId } from '../../../lib/supabaseSync'

export default function PanelDeReglas({
  reglas, setReglas, ctxPersonalizacion, aCuantosAlcanzaHoy, unoDeLosQueRecibirian,
}: {
  reglas: ReglaAutomatica[]
  setReglas: React.Dispatch<React.SetStateAction<ReglaAutomatica[]>>
  ctxPersonalizacion: { hermandad: string; ejercicio: number }
  /** A cuánta gente le llegaría esta regla si se disparara hoy. */
  aCuantosAlcanzaHoy: (r: Pick<ReglaAutomatica, 'destinatarios' | 'criterios'>) => number
  /** Uno de los que la recibirían, para la vista previa. `null` si hoy no toca a nadie. */
  unoDeLosQueRecibirian: (r: Pick<ReglaAutomatica, 'criterios'>) => Hermano | null
}) {
  return (
    <>
    {/*
      ====================================================================
      LAS REGLAS QUE SE DISPARAN SOLAS
      ====================================================================

      Una regla es un sesgo + un texto + un cuándo. Cuando le toca, escribe
      un comunicado programado para hoy y ahí acaba su trabajo: lo manda el
      camino de siempre, con su candado y su «Hola {nombre}».

      NACEN APAGADAS, y es la decisión que separa esto de una máquina de
      mandar correos sin supervisión: una regla encendida escribe a
      ochocientas personas en nombre de la hermandad sin que nadie lea el
      texto antes. Se ve a cuánta gente alcanzaría HOY, y se enciende cuando
      se ha visto. Encender es un clic; deshacer ochocientos correos no es
      nada.
    */}
    <section className="settings-card">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Que se manden solos</h2>
      </div>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Una regla escribe el comunicado por ti el día que toca — el cumpleaños de cada hermano,
        por ejemplo. Sale con su nombre puesto, y se manda cuando alguien entre aquí.
      </p>

      {reglas.length === 0 ? (
        <div className="assign-box">
          <p className="form-hint" style={{ marginTop: 0 }}>
            No tienes ninguna. Estas dos vienen escritas y las puedes cambiar después:
          </p>
          <div className="settings-actions">
            {REGLAS_DE_FABRICA.map((f) => (
              <button
                key={f.nombre}
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setReglas((prev) => [
                  { ...f, id: nuevoId(), activa: false, ultimaVez: null } as ReglaAutomatica,
                  ...prev,
                ])}
              >
                {f.nombre}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="lista-limpia">
          {reglas.map((r) => {
            /*
             * A CUÁNTA GENTE ALCANZA HOY. Es el dato que hace falta para
             * atreverse a encenderla, y el que evita la sorpresa: se elige
             * «los que cumplen hoy», sale a tres de ochocientos, y sin este
             * número no hay forma de saber si es que solo cumplen tres o es
             * que el resto no tiene la fecha puesta en su ficha.
             */
            /*
             * SE CUENTA CON EL MISMO CAMINO QUE SE MANDA.
             *
             * Aquí se contaba solo con `filtrarSegmento`, y al enviar se usa
             * `resolverDestinatario`, que además añade `personalDelSegmento`:
             * la junta que tiene cuenta de acceso pero no ficha en el censo.
             *
             * O sea que el número que se enseñaba antes de encender la regla
             * era MÁS BAJO que la gente a la que le iba a llegar. Justo el
             * dato que se mira para atreverse a encenderla.
             */
            const alcanza = aCuantosAlcanzaHoy(r)
            return (
              <li key={r.id} className="assign-box" style={{ marginBottom: '0.6rem' }}>
                <div className="assign-box__row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <b>{r.nombre}</b>
                    <p className="table-subtle" style={{ margin: '0.2rem 0 0' }}>
                      {r.cada === 'diaria' ? 'Todos los días' : 'El día 1 de cada mes'}
                      {' · '}{r.destinatarios}
                      {' · '}
                      <b>{alcanza === 0 ? 'hoy no toca a nadie' : `hoy alcanzaría a ${alcanza}`}</b>
                      {r.ultimaVez && ` · última vez el ${r.ultimaVez}`}
                    </p>
                  </div>
                  <label className="checkbox-row">
                    {/*
                      Y NO SE PUEDE ENCENDER CON UNA MARCA QUE NO EXISTE.
                      Aquí hace más falta que en un comunicado a mano: una
                      regla encendida se manda sola, sin que nadie vuelva a
                      leer el texto. Un `{nombe}` puesto hoy saldría en cada
                      cumpleaños durante años.
                    */}
                    <input
                      type="checkbox"
                      checked={r.activa}
                      /*
                       * Ni con una marca en el texto del post: ahí no se
                       * sustituye nada, así que se publicaría literalmente
                       * «Hola {nombre}» en Instagram.
                       */
                      disabled={!r.activa && (
                        !sePuedePersonalizar(`${r.asunto}\n${r.cuerpo}`).puede
                        || llevaMarcas(r.textoRedes)
                      )}
                      onChange={(e) => setReglas((prev) => prev.map((x) => (
                        x.id === r.id ? { ...x, activa: e.target.checked } : x
                      )))}
                    />
                    <span>{r.activa ? 'Encendida' : 'Apagada'}</span>
                  </label>
                </div>
                {/*
                  EL TEXTO SE VE Y SE EDITA AQUÍ MISMO, sin abrir nada.

                  Es lo que se le va a mandar a ochocientas personas:
                  esconderlo detrás de un botón «editar» es cómo se encienden
                  reglas sin haber leído lo que dicen. Y una felicitación que
                  no se puede cambiar no sirve: cada hermandad escribe a los
                  suyos a su manera, y el texto de fábrica es un punto de
                  partida, no una imposición.
                */}
                <div className="form-row" style={{ marginTop: '0.6rem' }}>
                  <label htmlFor={`asunto-${r.id}`}>Asunto</label>
                  <input
                    id={`asunto-${r.id}`}
                    type="text"
                    value={r.asunto}
                    onChange={(e) => setReglas((prev) => prev.map((x) => (
                      x.id === r.id ? { ...x, asunto: e.target.value } : x
                    )))}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`cuerpo-${r.id}`}>Mensaje</label>
                  <textarea
                    id={`cuerpo-${r.id}`}
                    rows={5}
                    value={r.cuerpo}
                    onChange={(e) => setReglas((prev) => prev.map((x) => (
                      x.id === r.id ? { ...x, cuerpo: e.target.value } : x
                    )))}
                  />
                  {/* Las mismas marcas y el mismo botón que en un comunicado a mano. */}
                  <div className="chips" style={{ marginTop: '0.5rem' }}>
                    <span className="form-hint" style={{ marginRight: '0.3rem' }}>Personalizar:</span>
                    {MARCAS.map((mk) => (
                      <button
                        key={mk.marca}
                        type="button"
                        className="chip"
                        title={`${mk.que} — p. ej. «${mk.ejemplo}»`}
                        onClick={() => setReglas((prev) => prev.map((x) => (
                          x.id === r.id ? { ...x, cuerpo: `${x.cuerpo}{${mk.marca}}` } : x
                        )))}
                      >
                        {`{${mk.marca}}`}
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  /*
                    EL MISMO FRENO QUE EN UN COMUNICADO A MANO, y aquí hace
                    MÁS falta: una regla encendida se manda sola, sin que
                    nadie vuelva a leer el texto. Un `{nombe}` puesto hoy
                    saldría cada cumpleaños durante años.
                  */
                  const rev = sePuedePersonalizar(`${r.asunto}\n${r.cuerpo}`)
                  if (!rev.puede) {
                    return (
                      <p className="form-hint" style={{ color: 'var(--peligro, #b91c1c)' }}>
                        ⚠ {rev.motivo}
                      </p>
                    )
                  }
                  // Y cómo le llegará a alguien de los que la van a recibir.
                  const aQuien = unoDeLosQueRecibirian(r)
                  return (
                    <div className="assign-box" style={{ marginTop: '0.2rem' }}>
                      <p className="form-hint" style={{ margin: '0 0 0.35rem' }}>
                        {aQuien ? `Así le llegará a ${aQuien.nombre}:` : 'Así llegará (hoy no toca a nadie, se usa un ejemplo):'}
                      </p>
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        {vistaPrevia(r.asunto, aQuien, ctxPersonalizacion)}
                      </p>
                      <p style={{ margin: '0.3rem 0 0', whiteSpace: 'pre-wrap' }}>
                        {vistaPrevia(r.cuerpo, aQuien, ctxPersonalizacion)}
                      </p>
                    </div>
                  )
                })()}
                {/*
                  ====================================================
                  Y EL ENCARGO DE REDES, SI SE QUIERE
                  ====================================================

                  Lo pedía el plan y faltaba: «llega el día del cumpleaños
                  del titular, y a quien lleva Instagram le aparece la tarea
                  con el texto ya escrito». La regla escribía el correo y ahí
                  se acababa, así que el post había que acordarse de hacerlo.

                  ESTO NO PUBLICA NADA SOLO. Deja el encargo —escribir el
                  post, subirlo a cada red— y lo hace una persona. Publicar
                  de verdad en Facebook o Instagram pide la API de Meta:
                  cuenta de empresa, aplicación revisada por ellos y permisos
                  que caducan solos, con lo que la hermandad se queda sin
                  publicar y sin enterarse.

                  Y EL TEXTO ES OTRO, no el del correo: el correo va
                  personalizado («Hola Manuel») y un post lo lee cualquiera.
                  Con el mismo texto se publicaría el nombre de un hermano en
                  Instagram, que es lo último que se quiere.
                */}
                <div className="assign-box" style={{ marginTop: '0.5rem' }}>
                  <label>Y además, dejar el encargo de redes</label>
                  <div className="chips">
                    {REDES_SOCIALES.map((red) => {
                      const puesta = r.redes.includes(red)
                      return (
                        <button
                          key={red}
                          type="button"
                          className={`chip${puesta ? ' chip--active' : ''}`}
                          aria-pressed={puesta}
                          onClick={() => setReglas((prev) => prev.map((x) => (
                            x.id === r.id
                              ? { ...x, redes: puesta ? x.redes.filter((y) => y !== red) : [...x.redes, red] }
                              : x
                          )))}
                        >
                          {red}
                        </button>
                      )
                    })}
                  </div>
                  {r.redes.length === 0 ? (
                    <p className="form-hint" style={{ marginBottom: 0 }}>
                      Sin ninguna red, la regla solo escribe el correo. Es lo normal.
                    </p>
                  ) : (
                    <>
                      <div className="form-row" style={{ marginTop: '0.6rem' }}>
                        <label htmlFor={`redes-${r.id}`}>Lo que se publica</label>
                        <textarea
                          id={`redes-${r.id}`}
                          rows={3}
                          value={r.textoRedes}
                          placeholder="Hoy es la festividad de nuestro titular…"
                          onChange={(e) => setReglas((prev) => prev.map((x) => (
                            x.id === r.id ? { ...x, textoRedes: e.target.value } : x
                          )))}
                        />
                        {llevaMarcas(r.textoRedes) ? (
                          <p className="form-hint" style={{ color: 'var(--peligro, #b91c1c)' }}>
                            ⚠ Un post lo lee cualquiera, así que aquí no van marcas como
                            «{'{nombre}'}»: publicarían el nombre de un hermano. Quita la marca y
                            escribe el texto tal cual saldrá.
                          </p>
                        ) : (
                          <p className="form-hint">
                            Un texto para todos, sin marcas. El encargo queda <b>sin repartir</b> en
                            «Encargos de redes», aquí abajo, y desde ahí se le asigna a quien las lleva.
                          </p>
                        )}
                      </div>
                      {!r.textoRedes.trim() && (
                        <p className="form-hint" style={{ marginBottom: 0 }}>
                          Sin texto no se deja ningún encargo: el correo sí saldrá.
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="settings-actions" style={{ marginTop: '0.5rem' }}>
                  {/*
                    NO SE PUEDE ENCENDER CON UNA MARCA MAL ESCRITA. El
                    interruptor de arriba se apaga solo en ese caso: ver el
                    `disabled` de la casilla.
                  */}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm rgpd-borrar"
                    onClick={() => {
                      if (!window.confirm(`¿Quitar la regla «${r.nombre}»?`)) return
                      setReglas((prev) => prev.filter((x) => x.id !== r.id))
                    }}
                  >
                    Quitar
                  </button>
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
