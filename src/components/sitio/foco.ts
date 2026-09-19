import { useEffect, type RefObject } from 'react'

/**
 * Deja el foco dentro de una caja mientras esté abierta (el menú de móvil, el
 * visor de fotos). Sin esto, tabulando desde el visor se salía a la página de
 * detrás —que el visitante no puede ver— y no había forma de volver.
 *
 * Al cerrarse devuelve el foco a donde estaba, que es lo que espera quien
 * navega con teclado.
 */
export function useTrampaDeFoco(activo: boolean, caja: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!activo) return
    const veniaDe = document.activeElement as HTMLElement | null
    // Se guarda el nodo aquí: en la limpieza, `caja.current` ya puede ser otro.
    const nodo = caja.current
    function enfocables(): HTMLElement[] {
      if (!nodo) return []
      return [...nodo.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.offsetParent !== null || el === document.activeElement)
    }
    function alTabular(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const lista = enfocables()
      if (lista.length === 0) return
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      const dentro = nodo?.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === primero || !dentro)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (document.activeElement === ultimo || !dentro)) {
        e.preventDefault()
        primero.focus()
      }
    }
    window.addEventListener('keydown', alTabular)
    return () => {
      window.removeEventListener('keydown', alTabular)
      // Se devuelve el foco si seguía dentro de lo que se cierra, o si se ha
      // quedado en el aire (al desaparecer la caja, el navegador lo suelta en
      // el `body` y quien navega con teclado vuelve al principio de la web).
      // Si el visitante ya se había ido a otro sitio, no se le mueve.
      const perdido = !document.activeElement || document.activeElement === document.body
      if (veniaDe && document.contains(veniaDe) && (perdido || nodo?.contains(document.activeElement))) {
        veniaDe.focus()
      }
    }
  }, [activo, caja])
}
