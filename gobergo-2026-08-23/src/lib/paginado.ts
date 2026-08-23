/**
 * TRAER UNA TABLA ENTERA, Y NO LAS PRIMERAS MIL FILAS.
 *
 * `select('*')` NO devuelve toda la tabla. PostgREST —el servidor que hay
 * detrás de Supabase— trae como mucho las filas que diga su ajuste «Max rows»,
 * que en un proyecto de Supabase viene puesto en **1.000**. Y no avisa de
 * nada: la respuesta llega correcta, sin error, con mil filas.
 *
 * Con doce hermanos da igual. Con los de una hermandad de verdad, no:
 *
 *   · El censo de mil doscientos se enseñaba con mil. Doscientas fichas que
 *     están en la base y no aparecen en la pantalla, sin ningún aviso.
 *   · Tres ejercicios de recibos son tres mil largos: se veía el último y
 *     poco más, y los totales de Cuotas salían cortos.
 *   · Y LO PEOR, LA COPIA DE SEGURIDAD. `crearCopia` apunta en `fallos` lo que
 *     no ha podido traer, y la copia automática se niega a subir una copia con
 *     fallos. Pero aquí no hay fallo: la consulta ha ido bien. Así que se
 *     subía, cada semana, una copia con el censo cortado a mil y con la marca
 *     de estar completa. Es exactamente la copia que miente, que es la única
 *     que hace daño de verdad — se descubre el día que hay que restaurarla.
 *
 * Se arregla pidiendo por páginas hasta que una venga corta. Una tabla que
 * cabe en una página cuesta lo mismo que antes: una sola petición.
 */

/**
 * Cuántas filas por página. Mil es el tope que trae Supabase de fábrica: pedir
 * más no sirve de nada, porque el servidor recorta igual.
 */
export const FILAS_POR_PAGINA = 1000

/**
 * Un tope de seguridad, para que un fallo del servidor no deje al navegador
 * pidiendo páginas para siempre. Doscientas mil filas por tabla es mucho más
 * de lo que tiene ninguna hermandad, y si alguna llega ahí, esto no es lo que
 * hay que arreglar.
 */
const PAGINAS_COMO_MUCHO = 200

export interface RespuestaDeTabla<T> {
  data: T[] | null
  error: { message: string; code?: string } | null
}

/**
 * Pide una consulta por páginas y devuelve todas las filas juntas.
 *
 * `hazLaConsulta` recibe el rango y tiene que construir la consulta ENTERA
 * cada vez: un constructor de consultas de Supabase no se puede reutilizar
 * después de ejecutarlo.
 *
 *     const { data, error } = await traerTodasLasFilas((desde, hasta) =>
 *       supabase.from('hermanos').select('*').order('numero').range(desde, hasta))
 *
 * El orden lo pone quien llama, y conviene que lo ponga: sin `order`, dos
 * páginas de la misma consulta pueden traer filas repetidas y saltarse otras,
 * porque Postgres no promete ningún orden si no se le pide.
 */
export async function traerTodasLasFilas<T>(
  hazLaConsulta: (desde: number, hasta: number) => PromiseLike<RespuestaDeTabla<T>>,
): Promise<RespuestaDeTabla<T>> {
  const todas: T[] = []
  for (let pagina = 0; pagina < PAGINAS_COMO_MUCHO; pagina += 1) {
    const desde = pagina * FILAS_POR_PAGINA
    const { data, error } = await hazLaConsulta(desde, desde + FILAS_POR_PAGINA - 1)
    // Un error a media tabla se devuelve tal cual: media tabla es peor que
    // nada, porque quien la recibe la trata como si estuviera entera.
    if (error) return { data: null, error }
    const trozo = data ?? []
    todas.push(...trozo)
    // Página corta: ya no hay más. Es la única señal fiable — el total que
    // devuelve `count` cuesta otra consulta y puede cambiar entre páginas.
    if (trozo.length < FILAS_POR_PAGINA) return { data: todas, error: null }
  }
  return {
    data: null,
    error: {
      message: `la tabla tiene más de ${PAGINAS_COMO_MUCHO * FILAS_POR_PAGINA} filas y no se ha podido traer entera`,
    },
  }
}
