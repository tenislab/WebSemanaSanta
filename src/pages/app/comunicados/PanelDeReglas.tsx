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
import { useState } from 'react'

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
  /*
   * QUÉ AVISOS ESTÁN ABIERTOS, EN ESTADO Y NO EN UNA PROP CALCULADA.
   *
   * La primera versión puso `open={!r.activa && reglas.length <= 2}`, y eso es
   * el fallo que ya me comí hoy en el cobro en mano de Cuotas: el `summary`
   * abre y cierra el `details` por su cuenta, y React solo reescribe `open`
   * cuando el VALOR de la prop cambia. Con esa expresión, encender un aviso
   * cambia `r.activa` y por tanto el valor, así que el aviso se cerraba de
   * golpe justo al encenderlo. En el código no se ve; se ve pulsándolo.
   *
   * Uno recién añadido nace ABIERTO, que es cuando hay que leerlo: lo añade
   * `abrir()` al crearlo, no una cuenta sobre el array.
   */
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const abrir = (id: string, si: boolean) => setAbiertos((prev) => {
    const s = new Set(prev)
    if (si) s.add(id); else s.delete(id)
    return s
  })

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
    {/*
      EL NOMBRE. «Que se manden solos» describe el MECANISMO —y de paso suena a
      que la aplicación hace cosas por su cuenta, que es lo contrario de lo que
      hace esto: nacen apagadas—. «Avisos automáticos» es lo que son desde el
      lado del hermano: un aviso que le llega sin que nadie lo mande a mano.
    */}
    <section className="settings-card avisos-auto">
      <div className="settings-card__head">
        <h2 className="settings-card__title">Avisos automáticos</h2>
        {reglas.length > 0 && (
          <span className="table-subtle">
            {reglas.filter((r) => r.activa).length} de {reglas.length} encendido
            {reglas.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Un aviso automático escribe el comunicado por ti el día que toca — el cumpleaños de cada
        hermano, por ejemplo. Sale con su nombre puesto, y se manda cuando alguien entre aquí.
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
                onClick={() => {
                  const id = nuevoId()
                  setReglas((prev) => [
                    { ...f, id, activa: false, ultimaVez: null } as ReglaAutomatica,
                    ...prev,
                  ])
                  // Nace abierto: es el momento en que se lee lo que va a mandar.
                  abrir(id, true)
                }}
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
              /*
               * ENCENDER NO SE PUEDE A CIEGAS, APAGAR SÍ.
               *
               * Esto estaba TODO abierto a la vez: dos reglas eran 1.969 px de
               * formulario desplegado —dos asuntos, dos mensajes, dos juegos de
               * cinco marcas, dos vistas previas y dos filas de redes—, y con
               * cuatro reglas serían cuatro mil. Era una pila de formularios,
               * no un panel. Y la acción que importa, encender un envío a
               * ochocientas personas, era una casilla de trece píxeles arriba a
               * la derecha, con menos presencia que el botón rojo de «Quitar».
               *
               * Pero aquí había una decisión razonada que no se tira: «el texto
               * se ve y se edita aquí mismo, sin abrir nada; esconderlo detrás
               * de un botón editar es cómo se encienden reglas sin haber leído
               * lo que dicen». Es verdad, y plegar por plegar la rompería.
               *
               * Así que el plegado es ASIMÉTRICO: el interruptor de ENCENDER
               * vive dentro, al lado del texto, así que para encender hay que
               * haber abierto —el motivo de antes, reforzado—. APAGAR se puede
               * desde fuera, porque apagar sí puede ser urgente: una regla que
               * está mandando algo mal no se apaga con dos clics.
               *
               * Y una regla recién añadida nace ABIERTA, que es cuando se lee.
               */
              const puedeEncenderse = sePuedePersonalizar(`${r.asunto}\n${r.cuerpo}`).puede
                && !llevaMarcas(r.textoRedes)
              return (
              <li key={r.id}>
                <details
                  className={`regla${r.activa ? ' regla--encendida' : ''}`}
                  open={abiertos.has(r.id)}
                  onToggle={(e) => abrir(r.id, (e.target as HTMLDetailsElement).open)}
                >
                  <summary className="regla__cabeza">
                    <span className="regla__que">
                      <b>{r.nombre}</b>
                      <span className="regla__cuando">
                        {r.cada === 'diaria' ? 'Todos los días' : 'El día 1 de cada mes'}
                        {' · '}{r.destinatarios}
                        {r.ultimaVez && ` · última vez el ${r.ultimaVez}`}
                      </span>
                    </span>
                    {/*
                      EL DATO QUE HACE FALTA PARA ATREVERSE, en una pastilla y
                      no en letra pequeña gris detrás de tres puntos medios. Es
                      el que evita la sorpresa: se elige «los que cumplen hoy»,
                      sale a tres de ochocientos, y sin el número no hay forma
                      de saber si es que solo cumplen tres o es que al resto le
                      falta la fecha en la ficha.
                    */}
                    <span className={`pill ${alcanza === 0 ? 'pill--info' : 'pill--ok'}`}>
                      {alcanza === 0 ? 'hoy, a nadie' : `hoy, a ${alcanza}`}
                    </span>
                    <span className={`pill ${r.activa ? 'pill--ok' : 'pill--off'}`}>
                      {r.activa ? 'Encendido' : 'Apagado'}
                    </span>
                  </summary>
                  {/* Apagar, desde fuera del plegable: es lo único urgente. */}
                  {r.activa && (
                    <div className="regla__apagar">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setReglas((prev) => prev.map((x) => (
                          x.id === r.id ? { ...x, activa: false } : x
                        )))}
                      >
                        Apagar
                      </button>
                    </div>
                  )}
                {/*
                  EL TEXTO SE VE Y SE EDITA AQUÍ MISMO, sin abrir nada más.

                  Es lo que se le va a mandar a ochocientas personas, y el
                  interruptor de encender está justo debajo: hay que pasar por
                  encima del texto para llegar a él. Y una felicitación que no
                  se puede cambiar no sirve: cada hermandad escribe a los suyos
                  a su manera, y el texto de fábrica es un punto de partida.
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
                {/*
                  EL INTERRUPTOR DE ENCENDER, AQUÍ ABAJO Y NO ARRIBA.

                  Debajo del texto y de su vista previa a propósito: para
                  llegar hasta él hay que haber pasado por encima de lo que se
                  va a mandar. Y es un interruptor de verdad —el mismo que el
                  modo día de salida del cortejo—, no una casilla de trece
                  píxeles: enciende un envío a ochocientas personas y tiene que
                  pesar lo que pesa.

                  NO SE PUEDE ENCENDER CON UNA MARCA QUE NO EXISTE, ni con una
                  marca en el texto del post —ahí no se sustituye nada, así que
                  se publicaría literalmente «Hola {nombre}» en Instagram—. Y
                  cuando no se puede, se dice POR QUÉ: un interruptor apagado y
                  gris sin explicación es lo que hace pensar que está roto.
                */}
                <div className="regla__encender">
                  <label className={`interruptor${r.activa ? ' interruptor--on' : ''}${!r.activa && !puedeEncenderse ? ' interruptor--no' : ''}`} htmlFor={`activa-${r.id}`}>
                    <input
                      id={`activa-${r.id}`}
                      type="checkbox"
                      checked={r.activa}
                      disabled={!r.activa && !puedeEncenderse}
                      onChange={(e) => setReglas((prev) => prev.map((x) => (
                        x.id === r.id ? { ...x, activa: e.target.checked } : x
                      )))}
                    />
                    {/* La palanca y el texto van en el marcado, como en el modo
                        día de salida del cortejo: el `input` de verdad está
                        oculto y la palanca es lo que se ve. Sin ella el
                        interruptor no se pinta y queda una casilla pelada, que
                        es justo lo que había antes. */}
                    <span className="interruptor__palanca" aria-hidden="true" />
                    <span className="interruptor__texto">
                      <b>{r.activa ? 'Encendido: se manda solo' : 'Apagado: no se manda'}</b>
                      <small>
                        {r.activa
                          ? 'Cada vez que toque, sin que nadie lo revise. Se puede apagar en cualquier momento.'
                          : !puedeEncenderse
                            ? 'No se puede encender todavía: arregla el aviso de arriba.'
                            : 'Lee el texto de arriba antes de encenderlo: a partir de ahí se manda sin que nadie lo lea.'}
                      </small>
                    </span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm rgpd-borrar"
                    onClick={() => {
                      if (!window.confirm(`¿Quitar el aviso automático «${r.nombre}»?`)) return
                      setReglas((prev) => prev.filter((x) => x.id !== r.id))
                    }}
                  >
                    Quitar
                  </button>
                </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </section>
    </>
  )
}
