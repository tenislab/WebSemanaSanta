import { useEffect, useMemo, useState } from 'react'

/**
 * CIEN FILAS POR PÁGINA.
 *
 * El número no es redondo por casualidad: está elegido para que una hermandad
 * NORMAL no note absolutamente nada. Con menos de cien filas no aparece ni el
 * paginador, así que el censo de una hermandad de ochenta hermanos se ve
 * exactamente igual que antes de existir esto. Lo que se está arreglando es lo
 * que le pasa a una grande, y no se le cambia la pantalla a la pequeña para
 * arreglarlo.
 *
 * Medido con `scripts/caza/cronometro.mjs` en el build de producción, con 800
 * hermanos y tres ejercicios emitidos: la pantalla de Cuotas montaba 107.834
 * nodos y tardaba ~1,7 s en abrirse con 4.512 recibos. Con 9.000 —una
 * hermandad de 800 con cuatro conceptos al año— sería el doble de las dos
 * cosas.
 */
export const POR_PAGINA = 100

export interface Paginado<T> {
  /** Lo que va a la tabla: solo la página que se está viendo. */
  pagina: T[]
  /** En qué página se está (empezando en 1). */
  numero: number
  /** Cuántas páginas hay. Uno si cabe todo. */
  paginas: number
  /** Cuántas filas hay EN TOTAL, no en la página. */
  total: number
  /** El primer y el último número de fila de esta página (para «101–200 de 4.512»). */
  desde: number
  hasta: number
  /** Si se están viendo todas de golpe porque alguien lo ha pedido. */
  todas: boolean
  ir: (n: number) => void
  verTodas: () => void
  verPorPaginas: () => void
}

/**
 * LA CUENTA, APARTE Y SIN REACT.
 *
 * Todo lo que se puede equivocar aquí son números: cuántas páginas hay, qué
 * trozo toca, qué dice «101–200 de 4.512» y qué pasa con una lista vacía o con
 * un número de página que se ha quedado fuera. Sacado del hook se puede
 * ejecutar con datos en una prueba, en vez de leerlo y confiar. Ver
 * `pruebas/tablasgrandes.prueba.mjs`.
 */
export function cuentaDePaginas(total: number, numero: number, porPagina: number, todas: boolean) {
  const paginas = todas ? 1 : Math.max(1, Math.ceil(total / porPagina))
  // Recortado: un número de página que no existe enseñaría una tabla vacía
  // teniendo datos —pasa si la lista se acorta desde otra pestaña—.
  const actual = Math.min(Math.max(1, numero), paginas)
  return {
    paginas,
    actual,
    desde: total === 0 ? 0 : (todas ? 1 : (actual - 1) * porPagina + 1),
    hasta: todas ? total : Math.min(actual * porPagina, total),
  }
}

/**
 * PARTIR UNA LISTA EN PÁGINAS, SIN TOCAR LA LISTA.
 *
 * Devuelve una rodaja para la tabla y deja la lista entera en manos de quien
 * llama, que es lo importante: en el censo, esa misma lista alimenta el CSV,
 * el padrón que sale por la impresora, «marcar todos» y el contador de la
 * cabecera. Paginar esas cuatro cosas sería un fallo peor que el lento que se
 * viene a arreglar —un padrón de 800 que imprime 100 y no lo dice—, así que
 * este hook no las ve.
 *
 * VUELVE A LA PRIMERA CUANDO LA LISTA CAMBIA DE TAMAÑO. Es lo que pasa al
 * teclear en el buscador o al tocar un filtro, y sin esto te quedas en la
 * página 7 de un resultado que ahora tiene una fila. Cambiar de tamaño y no de
 * orden es justo la señal que hay que escuchar: marcar una fila o editarla no
 * mueve el tamaño, y ahí quedarse donde estabas es lo correcto.
 *
 * Y ADEMÁS SE RECORTA. Si la lista se queda corta por otro camino —se borran
 * filas desde otra pestaña—, el número de página podría apuntar a una página
 * que ya no existe y la tabla saldría vacía teniendo datos.
 */
export function usePaginado<T>(lista: T[], porPagina: number = POR_PAGINA): Paginado<T> {
  const [numero, setNumero] = useState(1)
  const [todas, setTodas] = useState(false)

  const total = lista.length
  const { paginas, actual, desde, hasta } = cuentaDePaginas(total, numero, porPagina, todas)

  // A la primera cuando cambia el tamaño (buscar, filtrar, dar de alta).
  useEffect(() => { setNumero(1) }, [total])

  const pagina = useMemo(
    () => (todas ? lista : lista.slice((actual - 1) * porPagina, actual * porPagina)),
    [lista, actual, porPagina, todas],
  )

  return {
    pagina,
    numero: actual,
    paginas,
    total,
    desde,
    hasta,
    todas,
    ir: (n: number) => setNumero(Math.min(Math.max(1, n), paginas)),
    verTodas: () => { setTodas(true); setNumero(1) },
    verPorPaginas: () => { setTodas(false); setNumero(1) },
  }
}
