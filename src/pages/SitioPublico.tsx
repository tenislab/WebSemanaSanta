import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  PAREJAS_TIPOGRAFICAS,
  cargarWebPorSlug,
  getWebPublica,
  marcaDeAgua,
  noticiasPublicadas,
  slugNoticia,
  slugTitular,
  type CultoWeb,
  type Noticia,
  type Titular,
  type WebPublica,
} from '../lib/webPublica'
import { useHermandadSettings, type HermandadSettings } from '../lib/hermandadSettings'
import { getSuscripcion, tieneCapacidad } from '../lib/suscripcion'
import { haySesionAbierta } from '../lib/sesion'
import { LogoMark } from '../components/Logo'
import SitioContenido, { AvisoFotos, FotoConMarca, Galeria, Parrafos, PieSitio, TarjetaNoticia } from '../components/SitioContenido'
import { cultosDelCalendario } from '../lib/cultosDelCalendario'
import { fijarHermandadDeLaPagina } from '../lib/multiHermandad'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  baseDeLaWeb,
  baseDeRutas,
  datosEstructurados,
  descripcionWeb,
  tituloWeb,
  urlAbsoluta,
} from '../lib/seoWeb'

/**
 * Web pública de la hermandad (/w/:slug). Con ?preview=1 se muestra aunque no
 * esté publicada (para la vista previa del panel). El render vive en
 * SitioContenido, compartido con la vista previa.
 */
export default function SitioPublico({ webPorDominio }: { webPorDominio?: WebPublica } = {}) {
  const { slug: slugRuta, noticia: slugNot, titular: slugTit } = useParams()
  // Cuando se llega por el dominio propio de la hermandad no hay slug en la
  // dirección —se ha entrado por la raíz— así que se toma el de su web.
  const slug = slugRuta ?? webPorDominio?.slug
  const [params] = useSearchParams()
  // La vista previa solo vale desde el panel (misma pestaña/origen): se exige
  // sesión abierta. Si no, cualquiera podía ver con ?preview=1 una web sin
  // publicar o de una hermandad que no tiene contratado el pack Web.
  const preview = params.get('preview') === '1' && haySesionAbierta()
  const [traida, setTraida] = useState<WebPublica | null>(webPorDominio ?? null)
  // Con la base de datos conectada hay que esperar a que llegue: si no, se
  // pintaría «esta web no está disponible» un instante antes de recibirla, y
  // eso es justo lo que ve un rastreador que no espera.
  // Si la web ya viene dada (se ha entrado por el dominio de la hermandad), no
  // hay nada que esperar: ya está buscada.
  const [esperando, setEsperando] = useState(isSupabaseConfigured && !webPorDominio)

  // La web de ESTA hermandad, buscada por el slug de la dirección.
  //
  // Lo guardado en el navegador (`getWebPublica`) es lo que está montando
  // quien la edita, así que solo sirve para él. Cualquier otra persona ve lo
  // que venga de la base de datos, que es lo que hace que la web pública sea
  // pública de verdad. Se sigue usando lo del navegador cuando no hay base de
  // datos (modo local) y como red de seguridad si la consulta falla.
  useEffect(() => {
    if (webPorDominio || !isSupabaseConfigured || !slug) {
      setEsperando(false)
      return
    }
    let cancelado = false
    setEsperando(true)
    cargarWebPorSlug(slug).then((r) => {
      if (cancelado) return
      if (r) setTraida(r.web)
      // De qué hermandad es esta página: lo necesitan sus formularios para
      // saber a qué buzón va lo que escriba el visitante. Se pone SIEMPRE,
      // también a nulo cuando no se encuentra la web: si solo se pusiera al
      // encontrarla, alguien que pasa de la web de una hermandad a la de otra
      // y falla la segunda seguiría escribiendo al buzón de la primera.
      fijarHermandadDeLaPagina(r?.hermandadId ?? null)
      setEsperando(false)
    })
    return () => {
      cancelado = true
    }
  }, [slug, webPorDominio])

  const guardadaAqui = getWebPublica()
  const web = traida ?? guardadaAqui
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

  if (esperando) {
    return (
      <div className="sitio-noweb" aria-busy="true">
        <LogoMark size={40} />
        <p>Cargando…</p>
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
          <Link to={baseDeRutas(web) || '/'} className="sitio-btn">Ir a la web</Link>
        </div>
      )
    }
    return (
      <>
        <MetaWeb
          web={web}
          hermandad={hermandad}
          cultos={cultosCalendario}
          pieza={{ titulo: n.titulo, descripcion: n.resumen, imagen: n.fotoDataUrl, ruta: `/n/${slugNoticia(n)}` }}
        />
        <PaginaNoticia web={web} hermandad={hermandad} noticia={n} />
      </>
    )
  }

  // La ficha de un titular, con su enlace propio.
  if (slugTit) {
    const t = web.titulares.find((x) => slugTitular(x) === slugTit)
    if (!t) {
      return (
        <div className="sitio-noweb">
          <LogoMark size={40} />
          <h1>Esa ficha ya no está</h1>
          <p>Puede que se haya quitado de la web.</p>
          <Link to={baseDeRutas(web) || '/'} className="sitio-btn">Ir a la web</Link>
        </div>
      )
    }
    return (
      <>
        <MetaWeb
          web={web}
          hermandad={hermandad}
          cultos={cultosCalendario}
          pieza={{
            titulo: t.nombre,
            descripcion: t.descripcion.trim() || t.autoria.trim(),
            imagen: t.fotoDataUrl,
            ruta: `/t/${slugTitular(t)}`,
          }}
        />
        <PaginaTitular web={web} hermandad={hermandad} titular={t} />
      </>
    )
  }

  // El listado completo de noticias.
  if (window.location.pathname.endsWith('/noticias')) {
    return (
      <>
        <MetaWeb web={web} hermandad={hermandad} cultos={cultosCalendario} pieza={{ titulo: 'Actualidad', descripcion: '', imagen: null, ruta: '/noticias' }} />
        <ListadoNoticias web={web} hermandad={hermandad} />
      </>
    )
  }

  return (
    <>
      <MetaWeb web={web} hermandad={hermandad} cultos={cultosCalendario} />
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
        <Link to={baseDeRutas(web) || '/'} className="sitio__brand">
          {logo ? <img src={logo} alt="" className="sitio__logo" decoding="async" /> : <LogoMark size={30} />}
          <span className="sitio__brand-texto"><span>{titulo}</span></span>
        </Link>
        <Link to={baseDeRutas(web) || '/'} className="sitio-btn sitio-btn--sm">Volver a la web</Link>
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
      lang={web.idioma || 'es'}
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
        {noticia.fotoDataUrl && (
          <img src={noticia.fotoDataUrl} alt={noticia.altFoto ?? ''} className="sitio__noticia-foto" decoding="async" />
        )}
        <Parrafos parrafos={noticia.parrafos ?? []} />
      </article>
    </MarcoSuelto>
  )
}

/**
 * La ficha de un titular: su foto grande, su autoría, su historia entera y las
 * fotos que la hermandad haya subido de él. En la portada solo se asoma; aquí
 * está todo, y este es el enlace que se pega en redes.
 */
function PaginaTitular({
  web,
  hermandad,
  titular: t,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  titular: Titular
}) {
  const marca = marcaDeAgua(web, hermandad.nombreLegal ?? '')
  const parrafos = (t.parrafos ?? []).filter((p) => p.texto.trim() || p.subtitulo.trim())
  const fotos = t.fotos ?? []
  const otros = web.titulares.filter((x) => x.id !== t.id)
  return (
    <MarcoSuelto web={web} hermandad={hermandad}>
      <article className="sitio__ficha">
        <header className="sitio__ficha-cabeza">
          {t.fotoDataUrl && (
            <figure className="sitio__ficha-foto">
              <FotoConMarca src={t.fotoDataUrl} alt={t.alt?.trim() || t.nombre} marca={marca} />
              {t.credito?.trim() && <figcaption>Foto: {t.credito}</figcaption>}
            </figure>
          )}
          <div className="sitio__ficha-titulo">
            <h1>{t.nombre}</h1>
            {t.autoria.trim() && <p className="sitio__autoria">{t.autoria}</p>}
            {t.descripcion.trim() && <p className="sitio__entradilla">{t.descripcion}</p>}
          </div>
        </header>

        <Parrafos parrafos={parrafos} />

        {fotos.length > 0 && (
          <div className="sitio__ficha-fotos">
            {/* La misma galería que la sección: se abren a pantalla completa y
                se pasa de una a otra con las flechas. El aviso de derechos lo
                pone la ficha una sola vez, más abajo. */}
            <Galeria
              albumes={[{ id: 'ficha', titulo: '', descripcion: '', fecha: '', fotos: fotos.map((f, i) => ({ id: `ficha-${i}`, fotoDataUrl: f.url, pie: f.alt })) }]}
              interactivo
              marca={marca}
              aviso=""
            />
          </div>
        )}

        <AvisoFotos texto={web.avisoFotos} />
      </article>

      {otros.length > 0 && (
        <nav className="sitio__otros" aria-label="Los demás titulares">
          <h2>Los demás titulares</h2>
          <ul>
            {otros.map((o) => (
              <li key={o.id}>
                <Link to={`${baseDeRutas(web)}/t/${slugTitular(o)}`}>
                  {o.fotoDataUrl && <img src={o.fotoDataUrl} alt="" loading="lazy" decoding="async" />}
                  <span>{o.nombre}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
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
          <TarjetaNoticia key={n.id} noticia={n} interactivo baseWeb={baseDeRutas(web)} />
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
  cultos,
  pieza,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  /** Los próximos cultos, para los datos estructurados de Google. */
  cultos: CultoWeb[]
  /**
   * En una página suelta (una noticia, la ficha de un titular) mandan SU
   * título, SU descripción y SU foto: es lo que se pega en WhatsApp.
   */
  pieza?: { titulo: string; descripcion: string; imagen: string | null; ruta: string }
}) {
  // Se sacan los campos sueltos a propósito: `pieza` es un objeto nuevo en cada
  // render, y como dependencia del efecto lo dispararía una y otra vez.
  const hayPieza = Boolean(pieza)
  const piezaTitulo = pieza?.titulo ?? ''
  const piezaDescripcion = pieza?.descripcion ?? ''
  const piezaImagen = pieza?.imagen ?? null
  const piezaRuta = pieza?.ruta ?? '/'
  useEffect(() => {
    const anterior = document.title
    const base = baseDeLaWeb(web, window.location.origin)
    const nombreWeb = tituloWeb(web, hermandad)
    // En una página suelta manda la pieza: es lo que se comparte.
    const titulo = hayPieza ? `${piezaTitulo} · ${nombreWeb}` : nombreWeb
    const descripcion = hayPieza ? piezaDescripcion.trim() || descripcionWeb(web) : descripcionWeb(web)
    const imagen =
      piezaImagen
      ?? web.seo.imagenDataUrl
      ?? web.heroFotos[0]
      ?? web.logoDataUrl
      ?? hermandad.logoDataUrl
      ?? ''
    const url = urlAbsoluta(base, piezaRuta)
    document.title = titulo

    const puestas: Element[] = []
    // Las que ya existen (las de la aplicación, en index.html) se REEMPLAZAN y
    // se restauran al salir: si solo se añadieran, seguiría mandando la
    // descripción genérica de Gobergo y no la de la hermandad.
    const restaurar: { el: Element; attr: string; antes: string | null }[] = []
    function meta(clave: 'name' | 'property', valor: string, contenido: string) {
      if (!contenido) return
      const existente = document.head.querySelector(`meta[${clave}="${valor}"]`)
      if (existente) {
        restaurar.push({ el: existente, attr: 'content', antes: existente.getAttribute('content') })
        existente.setAttribute('content', contenido)
        return
      }
      const el = document.createElement('meta')
      el.setAttribute(clave, valor)
      el.setAttribute('content', contenido)
      document.head.appendChild(el)
      puestas.push(el)
    }
    /** Un <link> (canonical, icono) que se pone o se cambia y se deja como estaba. */
    function enlace(rel: string, href: string, tipo?: string) {
      if (!href) return
      const existente = document.head.querySelector(`link[rel="${rel}"]`)
      if (existente) {
        restaurar.push({ el: existente, attr: 'href', antes: existente.getAttribute('href') })
        existente.setAttribute('href', href)
        return
      }
      const el = document.createElement('link')
      el.setAttribute('rel', rel)
      el.setAttribute('href', href)
      if (tipo) el.setAttribute('type', tipo)
      document.head.appendChild(el)
      puestas.push(el)
    }

    meta('name', 'description', descripcion)
    meta('property', 'og:title', titulo)
    meta('property', 'og:description', descripcion)
    meta('property', 'og:type', 'website')
    meta('property', 'og:url', url)
    meta('property', 'og:image', imagen)
    meta('property', 'og:site_name', nombreWeb)
    meta('name', 'twitter:card', imagen ? 'summary_large_image' : 'summary')
    // El color de la barra del navegador en el móvil: con el de la hermandad,
    // la web deja de parecer prestada.
    meta('name', 'theme-color', web.colorPrimario)
    // Cuál es la dirección buena de esta página. Con dominio propio configurado
    // apunta al dominio, no al enlace largo, para que Google no cuente dos.
    enlace('canonical', url)
    // El escudo de la hermandad en la pestaña, en vez del de Gobergo.
    const escudo = web.logoDataUrl ?? hermandad.logoDataUrl
    if (escudo) enlace('icon', escudo)

    // Datos estructurados: la hermandad, su sede y cada culto con su fecha.
    // Google sí ejecuta JavaScript al indexar, así que esto le llega; WhatsApp
    // no, y por eso hace falta además la función de servidor (ver docs/SEO.md).
    const ld = document.createElement('script')
    ld.type = 'application/ld+json'
    ld.textContent = JSON.stringify(datosEstructurados(web, hermandad, cultos, base))
    document.head.appendChild(ld)
    puestas.push(ld)

    return () => {
      document.title = anterior
      puestas.forEach((el) => el.remove())
      restaurar.forEach(({ el, attr, antes }) => {
        if (antes === null) el.removeAttribute(attr)
        else el.setAttribute(attr, antes)
      })
    }
  }, [web, hermandad, cultos, hayPieza, piezaTitulo, piezaDescripcion, piezaImagen, piezaRuta])

  return null
}
