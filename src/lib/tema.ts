import { useEffect, useState } from 'react'

export type Tema = 'light' | 'dark'

const CLAVE = 'cabildo-theme'
const EVENTO = 'cabildo-tema'

export function temaGuardado(): Tema {
  const guardado = localStorage.getItem(CLAVE) as Tema | null
  if (guardado === 'light' || guardado === 'dark') return guardado
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Cambia el tema y avisa a quien esté escuchando. Hace falta el evento porque
 * el tema se puede cambiar desde dos sitios (el botón de la barra y la paleta
 * de comandos) y si no, uno de los dos se queda con el icono al revés.
 */
export function ponerTema(tema: Tema) {
  document.documentElement.setAttribute('data-theme', tema)
  localStorage.setItem(CLAVE, tema)
  window.dispatchEvent(new CustomEvent<Tema>(EVENTO, { detail: tema }))
}

export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setTema] = useState<Tema>(temaGuardado)

  useEffect(() => {
    // Al montar, deja el documento con el tema que toca (primera carga).
    document.documentElement.setAttribute('data-theme', tema)
    function alCambiar(e: Event) {
      setTema((e as CustomEvent<Tema>).detail)
    }
    window.addEventListener(EVENTO, alCambiar)
    return () => window.removeEventListener(EVENTO, alCambiar)
    // Solo al montar: los cambios posteriores llegan por el evento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [tema, ponerTema]
}
