import type { MarcaDeSeccion, PropsDeSeccion, Titulo } from './comun'
import { AvisoFotos, Contenido } from './piezas'
import { BloqueTitular, TarjetaNoticia } from './portada'
import { Galeria } from './Galeria'
import { SECCIONES_INFO, marcaDeAgua, noticiasPublicadas, urlSegura } from '../../lib/webPublica'
import { baseDeRutas } from '../../lib/seoWeb'

/**
 * LO QUE SE PUBLICA Y SE VA ACTUALIZANDO.
 *
 * Titulares, galería, noticias, páginas del menú y boletines. Es lo que la
 * hermandad toca durante el año, frente a lo que se escribe una vez.
 *
 * No son componentes: son funciones que devuelven JSX y que llama `Seccion`.
 * Ver el porqué en `comun.ts`.
 */

export function pintarTitulares(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  if (sec.web.titulares.length === 0) return null
  return (
    <section id="titulares" {...marca}>
      <h2>{titulo(SECCIONES_INFO.titulares.publico)}</h2>
      <div className="sitio__titulares">
        {sec.web.titulares.map((t, i) => (
          <BloqueTitular
            key={t.id}
            titular={t}
            // Alternos: la foto salta de un lado al otro en cada titular,
            // que es lo que rompe la columna centrada de siempre.
            vuelto={i % 2 === 1}
            baseWeb={baseDeRutas(sec.web)}
            marca={marcaDeAgua(sec.web, sec.hermandad.nombreLegal ?? '')}
            interactivo={sec.interactivo}
          />
        ))}
      </div>
      <AvisoFotos texto={sec.web.avisoFotos} />
    </section>
  )
}

export function pintarGaleria(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  const albumes = sec.web.albumes.filter((a) => a.fotos.length > 0)
  if (albumes.length === 0) return null
  return (
    <section id="galeria" {...marca}>
      <h2>{titulo(SECCIONES_INFO.galeria.publico)}</h2>
      <Galeria
        albumes={albumes}
        interactivo={sec.interactivo}
        marca={marcaDeAgua(sec.web, sec.hermandad.nombreLegal ?? '')}
        aviso={sec.web.avisoFotos}
      />
    </section>
  )
}

export function pintarActualidad(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  const todas = noticiasPublicadas(sec.web.noticias)
  if (todas.length === 0) return null
  // En la portada solo van las tres últimas: con quince noticias, la sección
  // se comía la web entera y había que bajar media pantalla para pasar de ella.
  const enPortada = todas.slice(0, 3)
  const [primera, ...resto] = enPortada
  const hayMas = todas.length > enPortada.length
  return (
    <section id="actualidad" {...marca}>
      {/* En la sec.web pública, sin la coletilla "(noticias)" del editor. */}
      <h2>{titulo('Actualidad')}</h2>
      <TarjetaNoticia noticia={primera} interactivo={sec.interactivo} baseWeb={baseDeRutas(sec.web)} grande />
      {resto.length > 0 && (
        <div className="sitio__noticias">
          {resto.map((n) => (
            <TarjetaNoticia key={n.id} noticia={n} interactivo={sec.interactivo} baseWeb={baseDeRutas(sec.web)} />
          ))}
        </div>
      )}
      {hayMas && (
        <p className="sitio__cta">
          <a
            href={sec.interactivo ? `${baseDeRutas(sec.web)}/noticias` : undefined}
            className="sitio-btn sitio-btn--sm"
          >
            Ver todas las noticias ({todas.length})
          </a>
        </p>
      )}
    </section>
  )
}

export function pintarPaginas(sec: PropsDeSeccion, marca: MarcaDeSeccion) {
  // Cada página del menú es su propia sección anclable (#pagina-<id>).
  const pags = sec.web.paginas.filter((p) => p.enMenu !== false)
  if (pags.length === 0) return null
  return (
    <>
      {pags.map((p) => (
        <section id={`pagina-${p.id}`} key={p.id} {...marca}>
          {/* El icono es una ayuda del editor del panel: en la web pública el título va limpio. */}
          {p.antetitulo && <span className="sitio__pagina-ante">{p.antetitulo}</span>}
          <h2>{p.titulo}</h2>
          {/* Mismo render que la Historia: un solo sitio que mantener. */}
          <Contenido c={{ entradilla: p.entradilla, parrafos: p.parrafos, fotos: p.fotos }} />
        </section>
      ))}
    </>
  )
}

export function pintarBoletines(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  if (sec.web.boletines.length === 0) return null
  return (
    <section id="boletines" {...marca}>
      <h2>{titulo(SECCIONES_INFO.boletines.publico)}</h2>
      <div className="sitio__boletines">
        {sec.web.boletines.map((bo) => {
          // Se puede haber subido el archivo o dado la dirección donde está.
          const destino = bo.pdfDataUrl || urlSegura(bo.pdfUrl)
          return (
            <article key={bo.id} className="sitio__boletin">
              <div className="sitio__boletin-portada">
                {bo.portadaDataUrl
                  ? <img src={bo.portadaDataUrl} alt="" loading="lazy" decoding="async" />
                  : <span className="sitio__boletin-sinportada" aria-hidden="true">PDF</span>}
              </div>
              <div className="sitio__boletin-datos">
                {bo.fecha.trim() && <span className="sitio__boletin-fecha">{bo.fecha}</span>}
                <h3>{bo.titulo}</h3>
                {bo.subtitulo.trim() && <p>{bo.subtitulo}</p>}
                {destino ? (
                  <a
                    href={sec.interactivo ? destino : undefined}
                    {...(sec.interactivo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    {...(sec.interactivo && bo.pdfDataUrl ? { download: bo.pdfNombre ?? 'boletin.pdf' } : {})}
                    className="sitio-btn sitio-btn--sm"
                  >
                    Descargar PDF
                  </a>
                ) : (
                  // Sin archivo ni dirección no se promete una descarga que no existe.
                  <span className="sitio__boletin-pendiente">Próximamente</span>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

