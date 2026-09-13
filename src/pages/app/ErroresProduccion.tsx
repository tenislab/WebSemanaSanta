import { useCallback, useEffect, useState } from 'react'
import {
  DIAS_POR_DEFECTO, comoVaLaCosa, erroresDeProduccion, esDeTodos, type ErrorAgrupado,
} from '../../lib/erroresProduccion'

/**
 * LO QUE SE ESTÁ ROMPIENDO EN PRODUCCIÓN.
 *
 * `lib/vigilancia.ts` lleva semanas recogiendo todo lo que revienta en el
 * navegador de una hermandad, y no había NINGUNA pantalla que lo leyera: se
 * guardaba en la base y no lo miraba nadie ni una vez. Esta es esa pantalla, y
 * es lo que pedía la fase 6 del plan de bugs —«un sitio en la aplicación que
 * lo enseñe, y la costumbre de abrirlo»—.
 *
 * SOLO LA VE UNA CUENTA DE SOPORTE, y el candado está en la base: la función
 * `errores_de_produccion` lleva `where es_soporte()` dentro, así que a
 * cualquier otra cuenta que se invente esta dirección le llega una lista
 * vacía. El porqué está en `vigilancia.sql` y no se cambia: los fallos son
 * para quien los puede arreglar.
 *
 * AGRUPADO Y CON DOS NÚMEROS, que es lo único que hace falta para ordenar el
 * trabajo: cuántas veces ha pasado y EN CUÁNTAS HERMANDADES. Un fallo en tres
 * hermandades es del código; el mismo en una puede ser su navegador.
 */
export default function ErroresProduccion() {
  const [dias, setDias] = useState(DIAS_POR_DEFECTO)
  const [errores, setErrores] = useState<ErrorAgrupado[]>([])
  /*
   * TRES ESTADOS Y NO DOS. «Cargando» no es lo mismo que «no hay nada»: sin
   * distinguirlos, esta pantalla diría «ni un fallo» durante el segundo que
   * tarda la consulta — y eso es exactamente la mentira tranquilizadora que
   * esta pantalla existe para no contar.
   */
  const [estado, setEstado] = useState<'cargando' | 'listo'>('cargando')
  const [abierto, setAbierto] = useState<string | null>(null)

  const traer = useCallback((d: number) => {
    setEstado('cargando')
    void erroresDeProduccion(d).then((r) => {
      setErrores(r)
      setEstado('listo')
    })
  }, [])

  useEffect(() => traer(dias), [dias, traer])

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <p className="eyebrow">Soporte</p>
          <h1>Lo que se rompe en producción</h1>
          <p className="dash-head__lead">
            Lo que ha reventado en el navegador de una hermandad de verdad, agrupado por fallo.
            Solo lo ve una cuenta de soporte.
          </p>
        </div>
      </div>

      <div className="chips" style={{ marginBottom: '1rem' }}>
        <span className="form-hint" style={{ marginRight: '0.3rem' }}>Últimos:</span>
        {[1, 7, 30, 60].map((d) => (
          <button
            key={d}
            type="button"
            className={`chip${dias === d ? ' chip--active' : ''}`}
            onClick={() => setDias(d)}
          >
            {d === 1 ? 'Hoy' : `${d} días`}
          </button>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => traer(dias)}>
          Volver a mirar
        </button>
      </div>

      {estado === 'cargando' ? (
        <p className="table-muted">Mirando…</p>
      ) : (
        <>
          <p className="dash-head__lead" style={{ marginTop: 0 }}>
            <b>{comoVaLaCosa(errores, dias)}</b>
            {errores.length === 0 && (
              <>
                {' '}Y si esto sale vacío siempre, comprueba que la cuenta es de soporte y que la
                base tiene <code>soporte.sql</code> al día: una lista vacía por no poder mirar se
                lee igual que una lista vacía porque todo va bien.
              </>
            )}
          </p>

          {errores.length > 0 && (
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Qué falla</th>
                    <th>Veces</th>
                    <th>Hermandades</th>
                    <th>Última vez</th>
                    <th>Dónde</th>
                    <th>Versión</th>
                  </tr>
                </thead>
                <tbody>
                  {errores.map((e) => (
                    <tr key={`${e.clase}·${e.mensaje}`}>
                      <td className="errores-mensaje">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ textAlign: 'left', whiteSpace: 'normal', padding: '0.3rem 0' }}
                          onClick={() => setAbierto(abierto === e.mensaje ? null : e.mensaje)}
                          aria-expanded={abierto === e.mensaje}
                        >
                          {e.mensaje}
                        </button>
                        {/* La pila solo al pedirla: son veinte líneas por fallo. */}
                        {abierto === e.mensaje && (
                          <pre className="pila-error">{e.pila || 'Sin pila: el navegador no la dio.'}</pre>
                        )}
                      </td>
                      <td><b>{e.veces}</b></td>
                      <td>
                        {/*
                          EL DATO QUE ORDENA EL TRABAJO. En más de una hermandad
                          es el código, y eso va primero; en una sola puede ser
                          su navegador, su red o su móvil.
                        */}
                        <span className={`pill ${esDeTodos(e) ? 'pill--err' : 'pill--warn'}`}>
                          {e.hermandades}
                        </span>
                      </td>
                      <td>{e.ultima ? new Date(e.ultima).toLocaleString('es-ES') : '—'}</td>
                      <td><code>{e.ruta || '—'}</code></td>
                      <td>
                        <span className="table-subtle">{e.versionApp || '—'}</span>
                        {' '}
                        <span className="pill pill--off">{e.clase}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <p className="form-hint">
        Se guardan 60 días y se borran solos. Los recoge <code>lib/vigilancia.ts</code> y los
        limpia <code>limpiar_errores_cliente()</code>. Nada de esto sale de la base de la
        hermandad: no hay ningún servicio de fuera en medio.
      </p>
    </div>
  )
}
