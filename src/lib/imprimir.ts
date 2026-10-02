import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

/**
 * MONTAR EL DOCUMENTO DE PAPEL SOLO CUANDO SE VA A IMPRIMIR.
 *
 * El censo llevaba SIEMPRE en el documento un padrón completo, escondido con
 * `screen-hidden` y visible solo en el papel. Con ochocientos hermanos eran
 * 4.836 nodos —el 20 % del DOM de esa pantalla— que nadie mira hasta que se
 * pulsa Imprimir. El comentario que tenía al lado decía «solo existe al
 * imprimir», y no era verdad: existía siempre.
 *
 * ============================================================================
 * POR QUÉ SE ENGANCHA A `beforeprint` Y NO AL BOTÓN
 * ============================================================================
 *
 * Porque hay DOS caminos para imprimir y solo uno pasa por el botón:
 *
 *   · «Imprimir el listado», que llama a `window.print()`.
 *   · El Ctrl+P del navegador, que no pasa por ninguna pantalla nuestra.
 *
 * Montándolo al pulsar el botón, el Ctrl+P imprimiría la pantalla sin el
 * padrón: un censo en blanco, sin ningún aviso, y quien lo hiciera pensaría que
 * la aplicación no sabe imprimir. Cambiar un problema por otro peor.
 *
 * `window.print()` dispara `beforeprint` ella también, así que escuchando ese
 * evento se cubren los dos caminos con una sola pieza y el botón no cambia.
 *
 * COMPROBADO EN EL NAVEGADOR, no supuesto: `beforeprint` llega por los tres
 * caminos —el botón, el Ctrl+P y `Page.printToPDF`— y lo que se añade al DOM
 * dentro del manejador se queda. Ver `scripts/caza/probar-beforeprint.mjs`.
 *
 * ============================================================================
 * Y POR QUÉ `flushSync`
 * ============================================================================
 *
 * Porque el navegador prepara el papel EN CUANTO vuelve el manejador. Un
 * `setState` normal es asíncrono: React lo agruparía para después, y para
 * cuando pintara, el diálogo ya tendría su foto hecha —sin el padrón—. Con
 * `flushSync` el pintado ocurre dentro del manejador, antes de volver.
 *
 * Es uno de los pocos sitios donde `flushSync` es lo correcto y no un atajo:
 * hay un plazo de verdad impuesto desde fuera de React.
 */
export function useImprimiendo(): boolean {
  const [imprimiendo, setImprimiendo] = useState(false)

  useEffect(() => {
    const antes = () => flushSync(() => setImprimiendo(true))
    /*
     * Y AL ACABAR SE DESMONTA, que si no el arreglo dura una impresión: la
     * primera vez que alguien imprimiera, el padrón se quedaría montado para
     * siempre y volveríamos al punto de partida sin enterarnos.
     */
    const despues = () => setImprimiendo(false)
    window.addEventListener('beforeprint', antes)
    window.addEventListener('afterprint', despues)
    return () => {
      window.removeEventListener('beforeprint', antes)
      window.removeEventListener('afterprint', despues)
    }
  }, [])

  return imprimiendo
}

/**
 * ¿EL VISITANTE HA PEDIDO QUE NADA SE MUEVA?
 *
 * `prefers-reduced-motion` no se pone por capricho: lo lleva puesto quien se
 * marea con lo que se mueve en pantalla, y una foto que cambia sola detrás de
 * un texto es de los casos de libro. En el CSS esto se respeta en veinte
 * sitios con una media query, pero un carrusel no se puede apagar desde el
 * CSS: hay que no arrancar el temporizador.
 *
 * Vive aquí, con `useImprimiendo`, porque es lo mismo: una pregunta al
 * navegador sobre cómo quiere ver las cosas quien está delante.
 *
 * SE SUSCRIBE AL CAMBIO. El ajuste se toca mientras la página está abierta
 * —en el móvil está en el mismo sitio que el modo de ahorro de batería—, y
 * leerlo una vez al montar dejaría el carrusel girando para quien acaba de
 * pedir que se pare.
 */
export function useQuieto(): boolean {
  const [quieto, setQuieto] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      // Sin `matchMedia` —un navegador antiguo, o una prueba— se mueve, que es
      // lo que hacía antes de existir esto.
      return false
    }
  })
  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    } catch {
      return
    }
    const alCambiar = () => setQuieto(mq.matches)
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])
  return quieto
}
