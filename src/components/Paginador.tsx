import { type Paginado } from '../lib/paginar'

/**
 * EL PIE DE UNA TABLA PAGINADA.
 *
 * NO SE PINTA SI TODO CABE EN UNA PÁGINA, y por eso una hermandad de ochenta
 * hermanos no ve aparecer nada nuevo en su censo. Es el mismo criterio que el
 * de `POR_PAGINA`: esto se ha puesto para una hermandad grande y no tiene por
 * qué cambiarle la pantalla a la pequeña.
 *
 * DICE CUÁNTAS HAY EN TOTAL, no solo en qué página estás. «101–200 de 4.512»
 * contesta a la vez las dos preguntas de quien mira una tabla recortada: qué
 * estoy viendo y cuánto falta. Un paginador que solo dice «página 2 de 46» deja
 * al lector calculando.
 *
 * Y LLEVA «VER TODAS». Cuesta lo que costaba antes —abrir 4.500 filas es lento
 * y por eso se ha paginado—, pero quitar la posibilidad sin decirlo es peor:
 * hay quien busca con el Ctrl-F del navegador sobre la tabla entera, y eso
 * dejaría de funcionar sin que nada lo explique. Aquí se ofrece, se avisa de
 * que va a tardar, y se decide.
 */
export function Paginador({ p, que }: {
  p: Paginado<unknown>
  /** En plural y en minúscula: «recibos», «hermanos», «apuntes». */
  que: string
}) {
  if (p.paginas <= 1 && !p.todas) return null

  /*
   * Los números que se pintan: la primera, la última, la actual y DOS a cada
   * lado. Con cuarenta y seis páginas, pintarlas todas es una tira inútil.
   *
   * Dos y no una: con una sola vecina, desde la página 1 los únicos saltos que
   * se ofrecen son «2» y «46», y para llegar a la 4 hay que pulsar «Siguiente»
   * tres veces. Con dos, salen 1 2 3 … 46 y se avanza a mano.
   */
  const VECINAS = 2
  const numeros: (number | '…')[] = []
  for (let n = 1; n <= p.paginas; n++) {
    if (n === 1 || n === p.paginas || Math.abs(n - p.numero) <= VECINAS) numeros.push(n)
    else if (numeros[numeros.length - 1] !== '…') numeros.push('…')
  }

  return (
    <nav className="paginador" aria-label={`Páginas de ${que}`}>
      <p className="paginador__cuenta">
        {p.total === 0
          ? `Sin ${que}`
          : p.todas
            ? `Viendo los ${p.total.toLocaleString('es-ES')} ${que}`
            : `${p.desde.toLocaleString('es-ES')}–${p.hasta.toLocaleString('es-ES')} de ${p.total.toLocaleString('es-ES')} ${que}`}
      </p>
      {p.todas ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={p.verPorPaginas}>
          Volver a verlos por páginas
        </button>
      ) : (
        <>
          <div className="paginador__paginas">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => p.ir(p.numero - 1)}
              disabled={p.numero === 1}
            >
              Anterior
            </button>
            {numeros.map((n, i) => (n === '…' ? (
              <span key={`hueco-${i}`} className="paginador__hueco" aria-hidden="true">…</span>
            ) : (
              <button
                key={n}
                type="button"
                className={`paginador__num${n === p.numero ? ' paginador__num--puesta' : ''}`}
                onClick={() => p.ir(n)}
                // El estado NO va solo en el color: quien use un lector de
                // pantalla o no distinga los tonos también tiene que saber en
                // qué página está.
                aria-current={n === p.numero ? 'page' : undefined}
                aria-label={`Página ${n}`}
              >
                {n}
              </button>
            )))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => p.ir(p.numero + 1)}
              disabled={p.numero === p.paginas}
            >
              Siguiente
            </button>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm paginador__todas"
            onClick={p.verTodas}
            title={`Se pintarán las ${p.total.toLocaleString('es-ES')} filas de golpe y la pantalla tardará en responder`}
          >
            Ver todas
          </button>
        </>
      )}
    </nav>
  )
}
