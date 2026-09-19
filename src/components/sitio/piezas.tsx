import { Link } from 'react-router-dom'
import { type ContenidoRico, type FotoSangre, type ParrafoPagina, type WebPublica } from '../../lib/webPublica'
import { type ReactNode, useEffect, useState } from 'react'

/**
 * LAS PIEZAS PEQUEÑAS DE LA WEB PÚBLICA.
 *
 * Lo que usan varias secciones a la vez: el botón de entrar, el de volver
 * arriba, los párrafos con su cita destacada, el bloque de contenido rico y
 * los recortes de texto. Nada de esto es de una sección en concreto, y por eso
 * estaba repartido por el fichero grande sin un sitio claro.
 */

/**
 * Botón que lleva al área del hermano. Vive en el módulo, NO dentro de
 * SitioContenido: definido allí se recreaba en cada render y React desmontaba
 * y volvía a montar el botón entero en cada tecla del editor.
 */
export function BotonEntrar({ interactivo, clase, children }: { interactivo: boolean; clase: string; children: ReactNode }) {
  return interactivo
    ? <Link to="/hermano" className={clase}>{children}</Link>
    : <span className={clase}>{children}</span>
}

/**
 * Botón para volver arriba. Aparece al bajar un par de pantallas: una web de
 * hermandad con historia, titulares, cultos y galería es larguísima en el
 * móvil, y había que arrastrar hasta arriba para llegar al menú.
 */
export function VolverArriba() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    function alDesplazar() { setVisible(window.scrollY > 900) }
    alDesplazar()
    window.addEventListener('scroll', alDesplazar, { passive: true })
    return () => window.removeEventListener('scroll', alDesplazar)
  }, [])
  return (
    <button
      type="button"
      className={`sitio__arriba${visible ? ' sitio__arriba--visible' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Volver arriba"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    >
      ↑
    </button>
  )
}



/** El aviso de derechos bajo las fotos, si la hermandad lo ha escrito. */
export function AvisoFotos({ texto }: { texto: string }) {
  if (!texto.trim()) return null
  return <p className="sitio__derechos">{texto}</p>
}

/**
 * Una foto con la marca de agua encima, si la hermandad la ha pedido. Va en un
 * `span` y no en un `div` porque también se usa dentro de botones.
 */
export function FotoConMarca({
  src,
  alt,
  marca,
  clase,
}: {
  src: string
  alt: string
  marca: string
  clase?: string
}) {
  return (
    <span className="sitio__conmarca">
      <img src={src} alt={alt} loading="lazy" decoding="async" className={clase} />
      {marca && <span className="sitio__marca-agua" aria-hidden="true">{marca}</span>}
    </span>
  )
}

/** Un párrafo marcado como destacado: cita grande que rompe el texto largo. */
export function Cita({ parrafo }: { parrafo: ParrafoPagina }) {
  return (
    <blockquote className="sitio__cita">
      <p>{parrafo.texto}</p>
      {parrafo.subtitulo.trim() && <cite>{parrafo.subtitulo}</cite>}
    </blockquote>
  )
}

/**
 * Los párrafos de una página suelta (una noticia, la ficha de un titular).
 * Aquí no hay fotos que repartir, pero sí citas destacadas.
 */
export function Parrafos({ parrafos }: { parrafos: ParrafoPagina[] }) {
  return (
    <>
      {parrafos
        .filter((p) => p.texto.trim() || p.subtitulo.trim())
        .map((p) =>
          p.destacado ? (
            <Cita key={p.id} parrafo={p} />
          ) : (
            <div className="sitio__parrafo" key={p.id}>
              {p.subtitulo.trim() && <h2>{p.subtitulo}</h2>}
              {p.texto.trim() && <p className="sitio__texto">{p.texto}</p>}
            </div>
          ),
        )}
    </>
  )
}

/**
 * Bloque de contenido con formato. Antes era una entradilla, una rejilla con
 * todas las fotos amontonadas arriba y los párrafos debajo, uno tras otro y
 * centrados. Ahora las fotos se reparten entre los párrafos, alternando el
 * lado, y los párrafos marcados salen como cita destacada.
 */
export function Contenido({ c }: { c: ContenidoRico }) {
  const parrafos = c.parrafos.filter((p) => p.texto.trim() || p.subtitulo.trim())
  // Cada párrafo normal se lleva una foto; las citas no gastan ninguna.
  let conFoto = 0
  const usadas = parrafos.filter((p) => !p.destacado).length
  return (
    <>
      {c.entradilla.trim() && <p className="sitio__entradilla">{c.entradilla}</p>}
      <div className="sitio__editorial">
        {parrafos.map((p) => {
          if (p.destacado) return <Cita key={p.id} parrafo={p} />
          const i = conFoto++
          const foto = c.fotos[i]
          return (
            <div
              key={p.id}
              className={`sitio__bloque${foto ? ' sitio__bloque--confoto' : ''}${i % 2 === 1 ? ' sitio__bloque--vuelto' : ''}`}
            >
              {foto && (
                <figure className="sitio__bloque-foto">
                  <img src={foto.url} alt={foto.alt} loading="lazy" decoding="async" />
                </figure>
              )}
              <div className="sitio__parrafo sitio__bloque-texto">
                {p.subtitulo.trim() && <h3>{p.subtitulo}</h3>}
                {p.texto.trim() && <p className="sitio__texto">{p.texto}</p>}
              </div>
            </div>
          )
        })}
      </div>
      {/* Las fotos que sobran (más fotos que párrafos) siguen en rejilla. */}
      {c.fotos.length > usadas && (
        <div className="sitio__galeria">
          {c.fotos.slice(usadas).map((f, i) => (
            <figure className="sitio__foto" key={i}>
              <img src={f.url} alt={f.alt} loading="lazy" decoding="async" />
            </figure>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * Foto a sangre: de borde a borde, con una frase encima si la hermandad la
 * pone. Es lo que corta el pergamino de secciones y da respiro a la página.
 */
export function FotoASangre({ sangre }: { sangre: FotoSangre }) {
  if (!sangre.fotoDataUrl) return null
  return (
    <div className="sitio__sangre">
      <img src={sangre.fotoDataUrl} alt="" loading="lazy" />
      {sangre.texto.trim() && <p className="sitio__sangre-texto">{sangre.texto}</p>}
    </div>
  )
}

/**
 * Unas líneas en otra lengua bajo la portada, marcadas con SU idioma para que
 * un lector de pantalla las lea con la voz que toca. Traducir la web entera no
 * es realista para una hermandad; cuatro líneas en inglés, sí.
 */
export function ResumenOtroIdioma({ resumen }: { resumen: WebPublica['resumenOtroIdioma'] }) {
  if (!resumen.texto.trim()) return null
  return (
    <aside className="sitio__otroidioma" lang={resumen.idioma || 'en'}>
      {resumen.titulo.trim() && <h2>{resumen.titulo}</h2>}
      <p>{resumen.texto}</p>
    </aside>
  )
}
