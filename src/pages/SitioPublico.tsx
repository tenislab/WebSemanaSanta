import { useEffect, useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  PAREJAS_TIPOGRAFICAS,
  getWebPublica,
  noticiasPublicadas,
  slugNoticia,
  type Noticia,
  type WebPublica,
} from '../lib/webPublica'
import { useHermandadSettings, type HermandadSettings } from '../lib/hermandadSettings'
import { getSuscripcion, tieneCapacidad } from '../lib/suscripcion'
import { haySesionAbierta } from '../lib/sesion'
import { LogoMark } from '../components/Logo'
import SitioContenido, { PieSitio, TarjetaNoticia } from '../components/SitioContenido'
import { cultosDelCalendario } from '../lib/cultosDelCalendario'

/**
 * Web pública de la hermandad (/w/:slug). Con ?preview=1 se muestra aunque no
 * esté publicada (para la vista previa del panel). El render vive en
 * SitioContenido, compartido con la vista previa.
 */
export default function SitioPublico() {
  const { slug, noticia: slugNot } = useParams()
  const [params] = useSearchParams()
  // La vista previa solo vale desde el panel (misma pestaña/origen): se exige
  // sesión abierta. Si no, cualquiera podía ver con ?preview=1 una web sin
  // publicar o de una hermandad que no tiene contratado el pack Web.
  const preview = params.get('preview') === '1' && haySesionAbierta()
  const web = getWebPublica()
  const hermandad = useHermandadSettings()
  // Los próximos cultos salen del módulo de Eventos, para no copiarlos a mano.
  const cultosCalendario = useMemo(() => cultosDelCalendario(), [])
  // La web pública solo se sirve si la hermandad tiene un pack que incluya la
  // capacidad «web». La vista previa del panel (?preview=1) no se filtra: quien
  // llega ahí ya está dentro del módulo Web, que su propio pack le habilita.
  const conWeb = tieneCapacidad(getSuscripcion(), 'web')

  if (!preview && !conWeb) {
    return (
      <div className="sitio-noweb">
        <LogoMark size={40} />
        <h1>Esta web no está disponible</h1>
        <p>La hermandad no tiene contratada la web pública en su suscripción.</p>
        <Link to="/hermano" className="sitio-btn">Área del hermano</Link>
      </div>
    )
  }

  if (!preview && (!web.publicada || web.slug !== slug)) {
    return (
      <div className="sitio-noweb">
        <LogoMark size={40} />
        <h1>Esta web no está disponible</h1>
        <p>La hermandad todavía no ha publicado su web, o el enlace no es correcto.</p>
        <Link to="/hermano" className="sitio-btn">Área del hermano</Link>
      </div>
    )
  }

  // Una noticia suelta, con su enlace propio.
  if (slugNot) {
    const n = noticiasPublicadas(web.noticias).find((x) => slugNoticia(x) === slugNot)
    if (!n) {
      return (
        <div className="sitio-noweb">
          <LogoMark size={40} />
          <h1>Esa noticia ya no está</h1>
          <p>Puede que se haya quitado de la web.</p>
          <Link to={`/w/${web.slug}`} className="sitio-btn">Ir a la web</Link>
        </div>
      )
    }
    return (
      <>
        <MetaWeb web={web} hermandad={hermandad} noticia={n} />
        <PaginaNoticia web={web} hermandad={hermandad} noticia={n} />
      </>
    )
  }

  // El listado completo de noticias.
  if (window.location.pathname.endsWith('/noticias')) {
    return (
      <>
        <MetaWeb web={web} hermandad={hermandad} />
        <ListadoNoticias web={web} hermandad={hermandad} />
      </>
    )
  }

  return (
    <>
      <MetaWeb web={web} hermandad={hermandad} />
      <SitioContenido web={web} hermandad={hermandad} cultosDelCalendario={cultosCalendario} />
    </>
  )
}

/** Marco común de las páginas sueltas: la marca arriba y la vuelta a la web. */
function MarcoSuelto({
  web,
  hermandad,
  children,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  children: React.ReactNode
}) {
  const titulo = web.titulo || hermandad.nombreLegal || 'Nuestra Hermandad'
  const logo = web.logoDataUrl || hermandad.logoDataUrl
  return (
    <SitioMarco web={web}>
      {/* `sitio__nav--suelta` la deja siempre en una fila: la plantilla
          «Clásica» apila la marca sobre el menú, y aquí no hay menú. */}
      <header className="sitio__nav sitio__nav--suelta">
        <Link to={`/w/${web.slug}`} className="sitio__brand">
          {logo ? <img src={logo} alt="" className="sitio__logo" /> : <LogoMark size={30} />}
          <span className="sitio__brand-texto"><span>{titulo}</span></span>
        </Link>
        <Link to={`/w/${web.slug}`} className="sitio-btn sitio-btn--sm">Volver a la web</Link>
      </header>
      <main className="sitio__main">{children}</main>
      {/* El mismo pie que la web: si no, la página se quedaba colgando. */}
      <PieSitio web={web} hermandad={hermandad} titulo={titulo} interactivo />
    </SitioMarco>
  )
}

/**
 * Los tokens de estilo de la web (colores, fuentes, esquinas) para las páginas
 * que no pasan por SitioContenido. Se leen del mismo sitio, así una noticia se
 * ve con el estilo que la hermandad haya elegido.
 */
function SitioMarco({ web, children }: { web: WebPublica; children: React.ReactNode }) {
  const pareja = PAREJAS_TIPOGRAFICAS.find((p) => p.id === web.pareja)
  return (
    <div
      className="sitio"
      data-plantilla={web.plantilla}
      data-tema={web.tema}
      style={{
        ['--sitio-color' as string]: web.colorPrimario,
        ['--sitio-color2' as string]: web.colorSecundario,
        ['--sitio-fuente' as string]: pareja?.texto ?? '',
        ['--sitio-fuente-titulos' as string]: pareja?.titulos ?? '',
        ['--sitio-radio' as string]: { recto: '0px', suave: '10px', redondo: '20px' }[web.redondeo] ?? '10px',
        ['--sitio-aire' as string]: { compacta: '0.72', normal: '1', amplia: '1.35' }[web.densidad] ?? '1',
      }}
    >
      {children}
    </div>
  )
}

function PaginaNoticia({
  web,
  hermandad,
  noticia,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  noticia: Noticia
}) {
  return (
    <MarcoSuelto web={web} hermandad={hermandad}>
      <article className="sitio__noticia-pagina">
        <p className="sitio__noticia-fecha">{fechaLegible(noticia.fecha)}</p>
        <h1>{noticia.titulo}</h1>
        {noticia.resumen && <p className="sitio__entradilla">{noticia.resumen}</p>}
        {noticia.fotoDataUrl && <img src={noticia.fotoDataUrl} alt="" className="sitio__noticia-foto" />}
        {(noticia.parrafos ?? []).map((p) => (
          <div key={p.id}>
            {p.subtitulo && <h2>{p.subtitulo}</h2>}
            <p className="sitio__texto">{p.texto}</p>
          </div>
        ))}
      </article>
    </MarcoSuelto>
  )
}

function ListadoNoticias({ web, hermandad }: { web: WebPublica; hermandad: HermandadSettings }) {
  const noticias = noticiasPublicadas(web.noticias)
  return (
    <MarcoSuelto web={web} hermandad={hermandad}>
      <h1>Actualidad</h1>
      {noticias.length === 0 && <p>Todavía no hay noticias publicadas.</p>}
      <div className="sitio__noticias">
        {noticias.map((n) => (
          <TarjetaNoticia key={n.id} noticia={n} interactivo slugWeb={web.slug} />
        ))}
      </div>
    </MarcoSuelto>
  )
}

/** «2 de febrero de 2026» a partir de una fecha ISO. */
function fechaLegible(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Título y etiquetas de la página: lo que se ve en la pestaña del navegador, en
 * los resultados de Google y al pegar el enlace en WhatsApp. Se escriben en el
 * documento al montar y se dejan como estaban al salir, para no contaminar el
 * resto de la aplicación.
 */
function MetaWeb({
  web,
  hermandad,
  noticia,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  /** En la página de una noticia mandan SU titular y SU foto. */
  noticia?: Noticia
}) {
  useEffect(() => {
    const anterior = document.title
    // Mismo orden de respaldo que el render del sitio, para que la pestaña y
    // la tarjeta al compartir digan lo mismo que la web.
    const nombreWeb = web.seo.titulo.trim() || web.titulo || hermandad.nombreLegal || 'Nuestra Hermandad'
    // En la página de una noticia manda la noticia: es lo que se comparte.
    const titulo = noticia ? `${noticia.titulo} · ${nombreWeb}` : nombreWeb
    const descripcion = noticia
      ? noticia.resumen.trim() || web.seo.descripcion.trim()
      : web.seo.descripcion.trim() || web.lema || ''
    const imagen =
      noticia?.fotoDataUrl
      ?? web.seo.imagenDataUrl
      ?? web.heroFotos[0]
      ?? web.logoDataUrl
      ?? hermandad.logoDataUrl
      ?? ''
    document.title = titulo

    const puestas: HTMLMetaElement[] = []
    // Las que ya existen (las de la aplicación, en index.html) se REEMPLAZAN y
    // se restauran al salir: si solo se añadieran, seguiría mandando la
    // descripción genérica de Cabildo y no la de la hermandad.
    const restaurar: { el: HTMLMetaElement; antes: string }[] = []
    function meta(clave: 'name' | 'property', valor: string, contenido: string) {
      if (!contenido) return
      const existente = document.head.querySelector<HTMLMetaElement>(`meta[${clave}="${valor}"]`)
      if (existente) {
        restaurar.push({ el: existente, antes: existente.getAttribute('content') ?? '' })
        existente.setAttribute('content', contenido)
        return
      }
      const el = document.createElement('meta')
      el.setAttribute(clave, valor)
      el.setAttribute('content', contenido)
      document.head.appendChild(el)
      puestas.push(el)
    }
    meta('name', 'description', descripcion)
    meta('property', 'og:title', titulo)
    meta('property', 'og:description', descripcion)
    meta('property', 'og:type', 'website')
    meta('property', 'og:image', imagen)
    meta('name', 'twitter:card', imagen ? 'summary_large_image' : 'summary')

    return () => {
      document.title = anterior
      puestas.forEach((el) => el.remove())
      restaurar.forEach(({ el, antes }) => el.setAttribute('content', antes))
    }
  }, [web, hermandad, noticia])

  return null
}
