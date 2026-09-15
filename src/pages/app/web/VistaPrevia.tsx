/** La web de la hermandad pintada al lado, en móvil, tableta o escritorio. */
import SitioContenido, { type FocoPreview } from '../../../components/SitioContenido'
import { type HermandadSettings } from '../../../lib/hermandadSettings'
import { type CultoWeb, type WebPublica } from '../../../lib/webPublica'
import { useEffect, useRef, useState } from 'react'
import { DISPOSITIVOS, type Dispositivo } from './pestanas'

export function VistaPrevia({
  web,
  hermandad,
  cultosDelCalendario: cultosCal,
  seccionActiva,
  dispositivo,
  setDispositivo,
  enlace,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  cultosDelCalendario: CultoWeb[]
  seccionActiva?: FocoPreview
  dispositivo: Dispositivo
  setDispositivo: (d: Dispositivo) => void
  enlace: string
}) {
  const marco = useRef<HTMLDivElement>(null)
  const escenario = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  const ancho = DISPOSITIVOS.find((d) => d.id === dispositivo)?.ancho ?? 390

  useEffect(() => {
    const el = marco.current
    if (!el) return
    // Se mide el marco de verdad: la columna cambia de ancho con la ventana.
    const observador = new ResizeObserver(() => {
      const disponible = el.clientWidth
      setEscala(disponible > 0 ? Math.min(1, disponible / ancho) : 1)
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [ancho])

  /*
   * La vista previa es una FOTO de la web, no la web.
   *
   * Dentro hay once cosas que se pueden enfocar: el botón «Quiero hacerme
   * hermano», los campos del formulario de contacto, los enlaces del menú…
   * Con el tabulador se caía dentro de todas ellas y no hacía nada ninguna:
   * once paradas seguidas en un señuelo, en medio del editor. Y para un lector
   * de pantalla era peor: el editor pasaba a tener dos títulos de nivel 1 —«Tu
   * web» y «Nuestra Hermandad»— y el índice de la página mezclaba los
   * apartados del editor con los de la web que se está editando.
   *
   * `inert` es exactamente eso: «esto está aquí para mirarlo». Saca todo lo de
   * dentro del tabulador Y del árbol de accesibilidad de una vez.
   *
   * Se pone a mano y no como propiedad porque React 18 todavía no la conoce y
   * la tira por el camino sin decir nada.
   */
  useEffect(() => {
    escenario.current?.setAttribute('inert', '')
  }, [])

  return (
    <aside className="cms-preview">
      <div className="cms-preview__head">
        {/* Ver la web como se ve de verdad en un móvil es lo que más se echaba
            en falta: casi todo el mundo la va a mirar ahí. */}
        <div className="cms-preview__dispositivos" role="group" aria-label="Tamaño de la vista previa">
          {DISPOSITIVOS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`cms-preview__dispositivo${dispositivo === d.id ? ' cms-preview__dispositivo--on' : ''}`}
              onClick={() => setDispositivo(d.id)}
              title={`${d.nombre} · ${d.ancho} px`}
              aria-pressed={dispositivo === d.id}
            >
              <span aria-hidden="true" className="cms-preview__icono">{d.icono}</span>
              <span className="sr-only">{d.nombre}</span>
            </button>
          ))}
        </div>
        <a href={enlace} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Abrir</a>
      </div>
      <div ref={marco} className={`cms-preview__frame cms-preview__frame--${dispositivo}`}>
        <div
          ref={escenario}
          className="cms-preview__stage"
          style={{
            width: ancho,
            transform: escala < 1 ? `scale(${escala})` : undefined,
            transformOrigin: 'top left',
            // El alto del contenedor tiene que contar con la escala, o el
            // marco se queda con un hueco muerto debajo.
            marginBottom: escala < 1 ? `calc((${escala} - 1) * 100%)` : undefined,
          }}
        >
          <SitioContenido
            web={web}
            hermandad={hermandad}
            cultosDelCalendario={cultosCal}
            interactivo={false}
            seccionActiva={seccionActiva}
          />
        </div>
      </div>
      <p className="cms-preview__pie">
        {DISPOSITIVOS.find((d) => d.id === dispositivo)?.nombre} · {ancho} px
        {escala < 1 && ` · al ${Math.round(escala * 100)} %`}
      </p>
    </aside>
  )
}

/**
 * Cambia un campo de la web. El valor puede ser una FUNCIÓN del valor actual:
 * hace falta para todo lo que llega tarde (leer y comprimir una foto tarda
 * cientos de ms), porque con el valor del render se pisaba lo escrito
 * entretanto en cualquier otro campo de la misma lista.
 */
