import { useEffect, useState, type RefObject } from 'react'

/** Lo que se puede enfocar con el tabulador dentro de un panel. */
const ENFOCABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function enfocables(raiz: HTMLElement): HTMLElement[] {
  return [...raiz.querySelectorAll<HTMLElement>(ENFOCABLE)].filter((el) => {
    // `tabindex="-1"` significa «se puede enfocar con código, pero el
    // tabulador no para aquí». Sin esta línea, el primer sitio donde entraba
    // el foco al abrir la paleta de comandos era el VELO de fondo —un botón
    // invisible que solo sirve para cerrar al pulsar fuera— en vez del
    // buscador. Se abría la paleta y no se podía escribir.
    if (el.getAttribute('tabindex') === '-1') return false
    if (el.closest('[inert]')) return false
    const caja = el.getBoundingClientRect()
    return caja.width > 0 && caja.height > 0
  })
}

/**
 * Las tres cosas que un panel modal tiene que hacer con el foco.
 *
 * Los paneles de la aplicación ya decían `role="dialog" aria-modal="true"`,
 * que es una PROMESA: «lo de detrás no existe mientras yo esté abierto». Pero
 * no cumplían ninguna de las tres partes, y eso se nota mucho con el teclado:
 *
 *   1. AL ABRIR, EL FOCO ENTRA. Antes se quedaba fuera, en la fila de la
 *      tabla. Quien abre la ficha de un hermano con Intro tenía que tabular
 *      por toda la página de detrás —el menú entero, los filtros, las
 *      cincuenta filas del censo— hasta llegar al panel que acababa de abrir.
 *      Y con lector de pantalla era peor: no se anunciaba nada, porque para el
 *      lector no había pasado nada.
 *
 *   2. MIENTRAS ESTÁ ABIERTO, NO SE SALE. Antes el tabulador se escapaba a la
 *      página de atrás, que está tapada por el panel: el foco desaparecía de
 *      la vista y había que adivinar dónde estaba.
 *
 *   3. AL CERRAR, EL FOCO VUELVE. A la fila desde la que se abrió, no al
 *      principio de la página. Si no, cerrar la ficha del hermano nº 45 te
 *      devolvía arriba del todo y había que volver a bajar.
 *
 * Escape ya cerraba, y eso se queda como estaba.
 */
export function useFocoDeDialogo(abierto: boolean, panel: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!abierto) return
    const raiz = panel.current
    if (!raiz) return

    // Quién lo abrió, para devolverle el foco al cerrar.
    const quienAbrio = document.activeElement as HTMLElement | null

    // 1. El foco entra: al primer campo o botón, y si no hay ninguno, al
    //    propio panel (por eso lleva tabIndex -1 en el marcado).
    const primeros = enfocables(raiz)
    ;(primeros[0] ?? raiz).focus({ preventScroll: true })

    // 2. El tabulador da la vuelta dentro del panel.
    function alTabular(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const lista = enfocables(raiz!)
      if (lista.length === 0) {
        e.preventDefault()
        raiz!.focus({ preventScroll: true })
        return
      }
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      const activo = document.activeElement as HTMLElement | null
      // Si el foco se ha ido fuera (o está en el propio panel), se recoge.
      if (!activo || !raiz!.contains(activo)) {
        e.preventDefault()
        ;(e.shiftKey ? ultimo : primero).focus({ preventScroll: true })
        return
      }
      if (e.shiftKey && activo === primero) {
        e.preventDefault()
        ultimo.focus({ preventScroll: true })
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault()
        primero.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', alTabular, true)

    return () => {
      document.removeEventListener('keydown', alTabular, true)
      // 3. Y el foco vuelve a quien abrió, si sigue en la página (puede que la
      //    fila ya no exista: se abrió la ficha para borrar al hermano).
      if (quienAbrio && document.contains(quienAbrio)) {
        quienAbrio.focus({ preventScroll: true })
      }
    }
  }, [abierto, panel])
}


/**
 * Una fila de tabla que abre una ficha, también con el teclado.
 *
 * EL FALLO: las filas del censo, de los recibos, de las papeletas, de
 * tesorería, del inventario, del archivo, de los comunicados y de los informes
 * abrían su ficha con `onClick` y un cursor de manita, y nada más. Ni
 * `tabIndex`, ni tecla. Es decir: **no había forma de abrir una sola ficha de
 * la aplicación sin ratón**. Ocho módulos, todo el trabajo del día a día.
 *
 * No es un caso de laboratorio: la secretaria que da de alta cincuenta
 * hermanos seguidos trabaja con las dos manos en el teclado, y quien no puede
 * usar un ratón —o navega con lector de pantalla— sencillamente no entraba.
 *
 * La fila SIGUE SIENDO UNA FILA. Se le podría poner `role="button"` y quedaría
 * «bien» en una herramienta automática, pero un lector de pantalla dejaría de
 * decir «fila 12 de 50» y de leer los encabezados de columna con cada dato,
 * que es lo que hace que una tabla se entienda. Una fila enfocable que
 * responde a Intro conserva las dos cosas.
 *
 * `e.target === e.currentTarget` es lo que evita el estropicio: dentro de la
 * fila hay casillas de marcar y botones de acción. Sin esa comprobación,
 * marcar una casilla con la barra espaciadora abriría además la ficha.
 */
export function filaQueAbre(abrir: () => void) {
  return {
    tabIndex: 0,
    onClick: abrir,
    onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (e.target !== e.currentTarget) return
      if (e.key !== 'Enter' && e.key !== ' ') return
      // La barra espaciadora, sin esto, hace bajar la página.
      e.preventDefault()
      abrir()
    },
    style: { cursor: 'pointer' },
  }
}


/**
 * SUBIR Y BAJAR FILAS DE UNA LISTA SIN QUE SE MUEVA EL BOTÓN.
 *
 * Llegó dicho así: «se mueve muy raro el menú de editar la web». Y es literal.
 *
 * Al intercambiar dos filas, el botón que acabas de pulsar SE VA con su fila a
 * la posición nueva. El cursor se queda quieto, así que la segunda pulsación
 * cae sobre el botón de OTRA fila y mueves la que no era. Con quince secciones,
 * subir una desde el final son catorce pulsaciones: no hay manera de acertar.
 *
 * Y a teclado es peor: al llegar al extremo, ese botón se desactiva, y un botón
 * desactivado PIERDE EL FOCO — te devuelve al principio de la página.
 *
 * Se arregla recordando QUÉ fila se ha movido, nunca en qué posición estaba: la
 * posición cambia, la fila no. Después de repintar se le devuelve el foco a su
 * botón, así que pulsar cinco veces sube cinco puestos la misma fila, como
 * espera cualquiera.
 *
 * Se usa así, con una clave que identifique la fila (su id, su tipo… algo que
 * NO sea el índice):
 *
 *     const mover = useMoverConElFoco('titulares')
 *     …
 *     <button {...mover.boton(t.id, -1)} onClick={() => { intercambiar(i, -1); mover.movida(t.id, -1) }}>▲</button>
 */
export function useMoverConElFoco(lista: string) {
  const [movida, setMovida] = useState<{ clave: string; dir: -1 | 1 } | null>(null)

  useEffect(() => {
    if (!movida) return
    /*
     * La clave va DENTRO de unas comillas en el selector, así que solo hay que
     * escapar la comilla y la barra invertida. `CSS.escape` no vale aquí: está
     * pensado para identificadores sueltos y convierte un id que empieza por
     * cifra —la mitad de los UUID— en algo como `\\33 f2a…`, que dentro de
     * comillas ya no encuentra nada.
     */
    const entrecomillar = (t: string) => t.replace(/[\\"]/g, '\\$&')
    const buscar = (dir: -1 | 1) => document.querySelector<HTMLButtonElement>(
      `[data-mover="${lista}:${entrecomillar(movida.clave)}:${dir}"]`,
    )
    const suyo = buscar(movida.dir)
    // Si ha llegado al extremo, su botón está desactivado y no puede recibir el
    // foco: se le da al del sentido contrario, que sigue ahí.
    const alterno = buscar(movida.dir === -1 ? 1 : -1)
    if (suyo && !suyo.disabled) suyo.focus()
    else if (alterno && !alterno.disabled) alterno.focus()
    // Y se suelta la marca, que además sirve para señalar un momento la fila
    // movida: en una lista de filas iguales, un intercambio no se distingue de
    // que no haya pasado nada.
    const t = setTimeout(() => setMovida(null), 900)
    return () => clearTimeout(t)
  }, [movida, lista])

  return {
    /** Lo que hay que poner en el botón para que se le pueda devolver el foco. */
    boton: (clave: string, dir: -1 | 1) => ({ 'data-mover': `${lista}:${clave}:${dir}` }),
    /** Se llama justo después de reordenar, con la clave de la fila movida. */
    movida: (clave: string, dir: -1 | 1) => setMovida({ clave, dir }),
    /** ¿Es esta la que se acaba de mover? Para marcarla un momento. */
    esLaMovida: (clave: string) => movida?.clave === clave,
  }
}
