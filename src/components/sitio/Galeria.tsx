import { AvisoFotos, FotoConMarca } from './piezas'
import { useTrampaDeFoco } from './foco'


import { type AlbumGaleria } from '../../lib/webPublicaDatos'
import { useEffect, useRef, useState } from 'react'

/**
 * LA GALERÍA DE FOTOS.
 *
 * La rejilla y la foto a pantalla completa, con su trampa de foco: abierta, el
 * tabulador no se escapa por detrás. Es la pieza más grande de las
 * compartidas, y por eso va sola.
 */

/**
 * La galería, por álbumes, con visor a pantalla completa. Antes era un montón
 * único de fotos sin contexto: con doce salidas seguidas no había forma de
 * saber qué era cada cosa.
 */
export function Galeria({
  albumes,
  interactivo,
  marca,
  aviso,
}: {
  albumes: AlbumGaleria[]
  interactivo: boolean
  /** Texto de la marca de agua; vacío = sin marca. */
  marca: string
  /** Aviso de derechos bajo la galería. */
  aviso: string
}) {
  // Todas las fotos en una sola lista para poder pasar de una a la siguiente
  // aunque estén en álbumes distintos.
  const todas = albumes.flatMap((a) => a.fotos.map((f) => ({ ...f, album: a.titulo })))
  const [abierta, setAbierta] = useState<number | null>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const visorRef = useRef<HTMLDivElement>(null)

  const hayVisor = interactivo && abierta !== null
  // Con el visor abierto, el foco no se sale de él.
  useTrampaDeFoco(hayVisor, visorRef)
  useEffect(() => {
    if (!hayVisor) return
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierta(null)
      if (e.key === 'ArrowRight') setAbierta((i) => (i === null ? null : (i + 1) % todas.length))
      if (e.key === 'ArrowLeft') setAbierta((i) => (i === null ? null : (i - 1 + todas.length) % todas.length))
    }
    window.addEventListener('keydown', tecla)
    // El foco entra en el visor: si no, al abrirlo con el teclado seguías
    // tabulando por la página de detrás sin ver dónde estabas.
    cerrarRef.current?.focus()
    // Con el visor abierto, el fondo no debe desplazarse detrás.
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = previo
    }
  }, [hayVisor, todas.length])

  const foto = abierta === null ? null : todas[abierta]

  return (
    <>
      {albumes.map((a) => (
        <div className="sitio__album" key={a.id}>
          {(a.titulo.trim() || a.fecha.trim() || a.descripcion.trim()) && (
            <div className="sitio__album-head">
              {a.titulo.trim() && <h3>{a.titulo}</h3>}
              {a.fecha.trim() && <span className="sitio__album-fecha">{a.fecha}</span>}
              {a.descripcion.trim() && <p>{a.descripcion}</p>}
            </div>
          )}
          <div className="sitio__galeria">
            {a.fotos.map((f) => {
              const i = todas.findIndex((t) => t.id === f.id)
              return (
                <figure className="sitio__foto" key={f.id}>
                  {interactivo ? (
                    <button type="button" className="sitio__foto-boton" onClick={() => setAbierta(i)}>
                      <FotoConMarca src={f.miniDataUrl || f.fotoDataUrl} alt={f.pie || a.titulo} marca={marca} />
                      <span className="sitio__foto-lupa" aria-hidden="true">⤢</span>
                    </button>
                  ) : (
                    <FotoConMarca src={f.miniDataUrl || f.fotoDataUrl} alt={f.pie || a.titulo} marca={marca} />
                  )}
                  {(f.pie.trim() || f.autor?.trim()) && (
                    <figcaption>
                      {f.pie}
                      {f.autor?.trim() && <span className="sitio__credito">Foto: {f.autor}</span>}
                    </figcaption>
                  )}
                </figure>
              )
            })}
          </div>
        </div>
      ))}
      <AvisoFotos texto={aviso} />

      {foto && (
        <div ref={visorRef} className="sitio__visor" role="dialog" aria-modal="true" aria-label="Foto ampliada">
          {/* El fondo cierra: es lo que todo el mundo intenta primero. */}
          <button type="button" className="sitio__visor-fondo" aria-label="Cerrar" onClick={() => setAbierta(null)} />
          <button ref={cerrarRef} type="button" className="sitio__visor-cerrar" aria-label="Cerrar" onClick={() => setAbierta(null)}>✕</button>
          {todas.length > 1 && (
            <button
              type="button"
              className="sitio__visor-flecha sitio__visor-flecha--izq"
              aria-label="Foto anterior"
              onClick={() => setAbierta((i) => (i === null ? null : (i - 1 + todas.length) % todas.length))}
            >
              ‹
            </button>
          )}
          <figure className="sitio__visor-figura">
            {/* La marca va sobre todo aquí: es la foto grande, la que se guarda. */}
            <FotoConMarca src={foto.fotoDataUrl} alt={foto.pie || foto.album} marca={marca} />
            <figcaption>
              {foto.pie || foto.album}
              {foto.autor?.trim() && <span className="sitio__credito">Foto: {foto.autor}</span>}
              {todas.length > 1 && <span className="sitio__visor-n">{(abierta ?? 0) + 1} / {todas.length}</span>}
            </figcaption>
          </figure>
          {todas.length > 1 && (
            <button
              type="button"
              className="sitio__visor-flecha sitio__visor-flecha--der"
              aria-label="Foto siguiente"
              onClick={() => setAbierta((i) => (i === null ? null : (i + 1) % todas.length))}
            >
              ›
            </button>
          )}
        </div>
      )}
    </>
  )
}
