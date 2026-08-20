import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import {
  SEGUNDOS_PARA_DESHACER,
  descartarDeshacer,
  deshacer,
  ofertaActual,
  suscribirseADeshacer,
} from '../lib/deshacer'

/**
 * La barra de «se ha borrado — deshacer». Va una sola vez, en el marco de la
 * aplicación, y la usan todas las pantallas.
 *
 * Lleva una barrita que se vacía sola. Sin ella, el botón desaparece de golpe
 * mientras alguien está decidiendo si pulsarlo, y eso da la sensación de que la
 * aplicación se lo ha quitado de las manos.
 */
export default function BarraDeshacer() {
  const oferta = useSyncExternalStore(suscribirseADeshacer, ofertaActual, ofertaActual)
  const { pathname } = useLocation()
  const [restante, setRestante] = useState(SEGUNDOS_PARA_DESHACER)

  // Al cambiar de pantalla se retira: lo que devolvería el elemento a su sitio
  // escribe en el estado de la pantalla que ya no está montada.
  useEffect(() => {
    descartarDeshacer()
  }, [pathname])

  useEffect(() => {
    if (!oferta) return
    setRestante(SEGUNDOS_PARA_DESHACER)
    const t = setInterval(() => setRestante((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [oferta])

  // A PROPÓSITO sin atajo de teclado. Ctrl+Z ya está cogido en las pantallas
  // que llevan su propio historial —el editor de la web tiene deshacer y
  // rehacer completos— y también dentro de cualquier caja de texto. Poner otro
  // oyente en la ventana haría que una sola pulsación disparase los dos.
  // El botón se ve y se pulsa; el atajo aquí solo traería sorpresas.

  if (!oferta) return null

  const proporcion = Math.max(0, Math.min(1, restante / SEGUNDOS_PARA_DESHACER))
  return (
    // `role="status"` y no `alert`: es un aviso, no una urgencia que deba
    // interrumpir lo que esté leyendo un lector de pantalla.
    <div className="deshacer" role="status" aria-live="polite">
      <span className="deshacer__texto">{oferta.texto}</span>
      <button type="button" className="deshacer__btn" onClick={deshacer}>
        Deshacer
      </button>
      <button
        type="button"
        className="deshacer__cerrar"
        onClick={descartarDeshacer}
        aria-label="Cerrar el aviso"
        title="Cerrar"
      >
        ✕
      </button>
      <span className="deshacer__tiempo" style={{ transform: `scaleX(${proporcion})` }} aria-hidden="true" />
    </div>
  )
}
