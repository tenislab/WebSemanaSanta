/**
 * EL AVISO VERDE QUE SALE Y SE VA SOLO.
 *
 * Estaba escrito cinco veces —una por pantalla de la tienda— con tres tiempos
 * distintos: 4.000, 5.000 y 6.000 milisegundos, sin ninguna razón detrás de la
 * diferencia. Y las cinco con el mismo fallo: `setTimeout` sin guardar el
 * identificador, así que dos avisos seguidos dejaban dos relojes en marcha y el
 * primero en cumplirse borraba el segundo mensaje, que llevaba medio segundo en
 * pantalla.
 *
 * Cinco segundos: lo que se tarda en leer «Cobrado 24,00 €. Factura A-14» sin
 * prisa, y poco para que estorbe a lo siguiente.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

const SE_VA_EN = 5000

export function useAviso(): [string, (texto: string) => void] {
  const [hecho, setHecho] = useState('')
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)

  const avisar = useCallback((texto: string) => {
    if (reloj.current) clearTimeout(reloj.current)
    setHecho(texto)
    // Un aviso vacío es «quítalo ya»: sirve para cerrarlo a mano sin dejar el
    // reloj anterior corriendo.
    if (!texto) return
    reloj.current = setTimeout(() => setHecho(''), SE_VA_EN)
  }, [])

  // Y si la pantalla se va antes de que se cumpla el plazo, el reloj se para:
  // llamar a `setHecho` sobre algo desmontado no rompe nada, pero deja el
  // temporizador vivo sin motivo.
  useEffect(() => () => { if (reloj.current) clearTimeout(reloj.current) }, [])

  return [hecho, avisar]
}
