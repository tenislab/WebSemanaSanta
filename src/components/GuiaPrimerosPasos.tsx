import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { leerPersistido } from '../lib/persistencia'
import {
  estaTodoHecho,
  pasosPuestaEnMarcha,
  resumirPasos,
  type EstadoDeLaHermandad,
} from '../lib/primerosPasos'

/**
 * EL GUIADO DE LA PRIMERA VEZ.
 *
 * Quien acaba de crear su hermandad se encuentra un panel con trece secciones
 * y todas vacías. El problema no es que falte información: es que hay
 * demasiada y ninguna dice por dónde se empieza. Se abre Cuotas antes de tener
 * censo, no sale nada, y se cierra la pestaña.
 *
 * Esto es lo que sale en su lugar la primera vez: el camino, en orden, con el
 * paso que toca ahora señalado y un botón que lleva justo ahí.
 *
 * TRES DECISIONES, y las tres son a propósito:
 *
 *   · **Se tacha solo.** No hay nada que marcar a mano. Una lista que hay que
 *     ir marcando se queda a medias el primer día, y a partir de ahí miente:
 *     dice que falta el censo cuando ya están los ochocientos metidos.
 *
 *   · **Se va cuando ya no hace falta.** Con todos los pasos hechos
 *     desaparece. Un guion de primeros pasos que se queda ahí para siempre se
 *     convierte en parte del decorado, y entonces ya no lo lee nadie el día
 *     que vuelve a hacer falta.
 *
 *   · **Se puede apartar, pero vuelve si queda algo.** «Seguir luego» lo
 *     esconde hasta la próxima vez que se entre. Lo que NO hace es esconderlo
 *     para siempre a la primera: la puesta en marcha se hace en varios días y
 *     entre medias se cierra la sesión.
 */

const CLAVE_APARTADO = 'cabildo-guia-apartada'

export default function GuiaPrimerosPasos({ estado }: { estado: EstadoDeLaHermandad }) {
  // Apartar es para esta sesión, no para siempre: la puesta en marcha se hace
  // en varios días, y quien lo aparta un martes agradece verlo el miércoles.
  const [apartada, setApartada] = useState(
    () => leerPersistido<string>(CLAVE_APARTADO, '') === new Date().toDateString(),
  )

  const pasos = useMemo(() => pasosPuestaEnMarcha(estado), [estado])
  const resumen = useMemo(() => resumirPasos(pasos), [pasos])

  // Terminado = fuera. Y apartado hoy, tampoco.
  if (estaTodoHecho(pasos) || apartada) return null

  function apartar() {
    setApartada(true)
    try {
      localStorage.setItem(CLAVE_APARTADO, JSON.stringify(new Date().toDateString()))
    } catch {
      // Sin espacio o sin localStorage: se aparta solo en esta pantalla.
    }
  }

  const empezando = resumen.hechos === 0

  return (
    <section className="guia" aria-labelledby="guia-titulo">
      <div className="guia__cabecera">
        <div>
          <p className="eyebrow">Primeros pasos</p>
          <h2 id="guia-titulo">
            {empezando ? 'Vamos a poner en marcha vuestra hermandad' : '¿Por dónde ibais?'}
          </h2>
          <p className="guia__lead">
            {empezando
              ? 'Son diez pasos y se hacen en cualquier orden, aunque este es el que menos vueltas da. '
                + 'No hace falta terminarlo hoy: cada paso se tacha solo en cuanto está hecho.'
              : `Lleváis ${resumen.hechos} de ${resumen.total}.`}
            {resumen.faltanImprescindibles > 0 && (
              <>
                {' '}
                <b>
                  {resumen.faltanImprescindibles === 1
                    ? 'Queda 1 imprescindible'
                    : `Quedan ${resumen.faltanImprescindibles} imprescindibles`}
                </b>{' '}
                para poder trabajar de verdad.
              </>
            )}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={apartar}>
          Seguir luego
        </button>
      </div>

      {/* La barra dice cuánto queda de un vistazo, que es lo que se mira al volver. */}
      <div className="guia__barra" role="img" aria-label={`${resumen.hechos} de ${resumen.total} pasos hechos`}>
        <span style={{ width: `${resumen.porcentaje}%` }} />
      </div>

      <ol className="guia__pasos">
        {pasos.map((p, i) => {
          const esElQueToca = !p.hecho && resumen.siguiente?.id === p.id
          return (
            <li
              key={p.id}
              className={`guia__paso${p.hecho ? ' guia__paso--hecho' : ''}${esElQueToca ? ' guia__paso--toca' : ''}`}
            >
              <span className="guia__marca" aria-hidden="true">{p.hecho ? '✓' : i + 1}</span>
              <div className="guia__texto">
                <h3>
                  {p.titulo}
                  {p.imprescindible && !p.hecho && <span className="pill pill--warn">Imprescindible</span>}
                  {p.hecho && <span className="sr-only"> (hecho)</span>}
                </h3>
                {/* Lo hecho no necesita explicación: ya lo saben, lo han hecho ellos. */}
                {!p.hecho && <p>{p.porQue}</p>}
              </div>
              {!p.hecho && (
                <Link className={`btn btn-sm ${esElQueToca ? 'btn-primary' : 'btn-ghost'}`} to={p.donde}>
                  {esElQueToca ? 'Empezar aquí' : 'Ir'}
                  <span className="sr-only"> — {p.comoLlegar}</span>
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
