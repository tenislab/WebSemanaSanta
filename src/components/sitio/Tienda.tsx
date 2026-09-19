import { FormularioTienda } from '../FormulariosWeb'
import { cabenTodavia, precioParaMi, seAgoto, seRebajoParaMi, totalDeLaCesta, type ArticuloWeb, type LineaReservaWeb } from '../../data/tienda'
import { formatCurrency } from '../../lib/format'
import { type WebPublica } from '../../lib/webPublica'
import { useCatalogoWeb } from '../../lib/tienda'
import { useState } from 'react'

/**
 * LA TIENDA EN LA WEB.
 *
 * El catálogo que la hermandad ha decidido publicar, con lo que se puede
 * apartar y lo que no. Apartar compromete unidades del almacén: por eso la
 * sección nace apagada y esto tiene su propio fichero.
 */

/**
 * LA TIENDA DE LA WEB.
 *
 * Es la única sección que no se pinta con lo que la hermandad escribió en el
 * editor: el género sale del INVENTARIO, en vivo, porque lo que aquí importa
 * no es el texto sino cuánto queda. Una tienda que enseña una camiseta agotada
 * porque nadie actualizó la página es alguien que se planta en la casa de
 * hermandad a por algo que no existe.
 *
 * Y no se paga por internet: se aparta y se paga al recogerlo. El porqué —que
 * el dinero es de la hermandad y no de Gobergo, y que cobrar por la web
 * arrastra obligaciones de comercio electrónico que una hermandad de ochenta
 * camisetas al año no tiene por qué asumir— está entero en
 * `supabase/tienda-web.sql`.
 */
export function Tienda({ web, interactivo }: { web: WebPublica; interactivo: boolean }) {
  const { articulos, cargando, recargar } = useCatalogoWeb(web.slug)
  const [cesta, setCesta] = useState<LineaReservaWeb[]>([])
  const total = totalDeLaCesta(cesta)

  /*
   * QUE NO SE PUEDA PEDIR MÁS DE LO QUE QUEDA, aquí y no solo al enviar. La
   * base lo rechaza igualmente —es ella quien manda—, pero enterarse al final,
   * después de haber escrito el nombre y el teléfono, es la peor forma de
   * enterarse.
   */
  const anadir = (a: ArticuloWeb) => setCesta((c) => {
    if (cabenTodavia(a, c) <= 0) return c
    const puesto = c.find((l) => l.articulo.id === a.id)
    if (!puesto) return [...c, { articulo: a, cantidad: 1 }]
    return c.map((l) => (l.articulo.id === a.id ? { ...l, cantidad: l.cantidad + 1 } : l))
  })
  const quitar = (id: string) => setCesta((c) => c
    .map((l) => (l.articulo.id === id ? { ...l, cantidad: l.cantidad - 1 } : l))
    .filter((l) => l.cantidad > 0))

  if (cargando) return <p className="sitio__parrafo">Cargando la tienda…</p>
  if (articulos.length === 0) {
    return (
      <p className="sitio__parrafo">
        Ahora mismo no hay nada publicado en la tienda. Puedes preguntar en la casa de hermandad.
      </p>
    )
  }

  /*
   * EL PRECIO DE HERMANO SE DICE, TAMBIÉN A QUIEN NO LO TIENE.
   *
   * Hasta ahora el descuento solo existía en el mostrador: el hermano que
   * compraba por internet pagaba tarifa y nada en pantalla le decía que
   * entrando en su área le habría costado menos. Un descuento que solo conoce
   * quien ya lo tenía no es un descuento, es un secreto.
   *
   * Quién está mirando lo resuelve la base, no esta página: aquí solo llega el
   * precio ya calculado, o nada.
   */
  const conDescuento = articulos.find((a) => seRebajoParaMi(a))
  const volverAqui = `/hermano?volver=${encodeURIComponent(`/w/${web.slug}#tienda`)}`

  return (
    <div className="sitio__tienda">
      {conDescuento ? (
        <p className="sitio__tienda-aviso">
          Estás dentro como hermano: estos precios ya llevan tu descuento
          {conDescuento.descuentoPct ? ` del ${conDescuento.descuentoPct} %` : ''}.
        </p>
      ) : (
        <p className="sitio__tienda-aviso">
          ¿Eres hermano? <a href={volverAqui}>Entra en tu área</a> y verás aquí tu precio, si te
          corresponde alguno.
        </p>
      )}
      <ul className="sitio__tienda-lista">
        {articulos.map((a) => {
          const enCesta = cesta.find((l) => l.articulo.id === a.id)?.cantidad ?? 0
          const agotado = seAgoto(a)
          return (
            <li key={a.id} className={`sitio__articulo${agotado ? ' sitio__articulo--agotado' : ''}`}>
              {a.fotoUrl && <img src={a.fotoUrl} alt="" loading="lazy" />}
              <div className="sitio__articulo-datos">
                <h3>{a.nombre}</h3>
                {a.descripcion && <p>{a.descripcion}</p>}
                {/* El precio de hermano se entiende de una forma y solo de
                    una: viendo AL LADO el que no se le cobra. Tachado y en
                    gris, no en una nota debajo. */}
                {seRebajoParaMi(a) ? (
                  <p className="sitio__articulo-precio">
                    {formatCurrency(precioParaMi(a))}
                    <span className="sitio__articulo-tarifa">{formatCurrency(a.precio)}</span>
                    <span className="sitio__articulo-hermano">
                      precio de hermano{a.descuentoPct ? ` (−${a.descuentoPct} %)` : ''}
                    </span>
                  </p>
                ) : (
                  <p className="sitio__articulo-precio">{formatCurrency(a.precio)}</p>
                )}
                {/* Se dice cuánto queda solo cuando queda poco: «quedan 47» no
                    le importa a nadie, «queda 1» decide la visita de hoy. */}
                {!agotado && a.disponible <= 5 && (
                  <p className="sitio__articulo-quedan">
                    {a.disponible === 1 ? 'Queda 1' : `Quedan ${a.disponible}`}
                  </p>
                )}
              </div>
              {agotado ? (
                <span className="sitio__articulo-fin">Agotado</span>
              ) : (
                <button
                  type="button"
                  className="sitio-btn sitio-btn--sm"
                  onClick={() => anadir(a)}
                  disabled={cabenTodavia(a, cesta) <= 0}
                >
                  {enCesta > 0 ? `Añadir (llevas ${enCesta})` : 'Apartar'}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {cesta.length > 0 && (
        <div className="sitio__cesta">
          <h3>Lo que vas a apartar</h3>
          <ul>
            {cesta.map((l) => (
              <li key={l.articulo.id}>
                <span className="sitio__cesta-nombre">{l.articulo.nombre}</span>
                <span className="sitio__cesta-cant">× {l.cantidad}</span>
                <span className="sitio__cesta-importe">
                  {formatCurrency(precioParaMi(l.articulo) * l.cantidad)}
                </span>
                <button
                  type="button"
                  className="sitio__cesta-quitar"
                  onClick={() => quitar(l.articulo.id)}
                  aria-label={`Quitar un ${l.articulo.nombre}`}
                >
                  −
                </button>
              </li>
            ))}
          </ul>
          <p className="sitio__cesta-total"><b>Total</b> <b>{formatCurrency(total)}</b></p>
          <FormularioTienda
            interactivo={interactivo}
            textoProteccionDatos={web.textoProteccionDatos}
            slug={web.slug}
            lineas={cesta}
            total={total}
            /*
             * Al apartar se vacía la cesta y SE VUELVE A PREGUNTAR el
             * catálogo: las unidades que esta persona acaba de comprometer ya
             * no se le pueden prometer a nadie más, y dejar el número viejo en
             * pantalla es prometer dos veces lo mismo.
             */
            onReservado={() => { setCesta([]); recargar() }}
          />
        </div>
      )}
    </div>
  )
}
