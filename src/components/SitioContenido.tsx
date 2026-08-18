import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SECCIONES_INFO, TIPOGRAFIAS, contenidoVacio, nombreSeccion, urlMapaIncrustado, urlSegura, type ContenidoRico, type TipoSeccion, type WebPublica } from '../lib/webPublica'
import type { HermandadSettings } from '../lib/hermandadSettings'
import { LogoMark } from './Logo'
import { formatDate } from '../lib/format'

/**
 * A dónde puede saltar la vista previa: una sección del cuerpo, o el marco de
 * la web (la barra de arriba y el pie), que no son secciones pero también se
 * editan.
 */
export type FocoPreview = TipoSeccion | 'cabecera' | 'pie'

/**
 * Render de la web pública a partir de un objeto WebPublica. Lo usan tanto la
 * página pública (/w/:slug) como la vista previa del panel (en vivo, sin
 * iframe). Con `interactivo=false` los botones no navegan (para la preview).
 */
export default function SitioContenido({
  web,
  hermandad,
  interactivo = true,
  seccionActiva,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  interactivo?: boolean
  /** Sección que se está editando: se resalta y se trae a la vista (solo en la vista previa). */
  seccionActiva?: FocoPreview
}) {
  const raiz = useRef<HTMLDivElement>(null)

  // En la vista previa, al cambiar de pestaña en el editor se salta a esa
  // sección: si no, editabas «Cultos» y la vista previa seguía en la Historia.
  useEffect(() => {
    if (interactivo || !seccionActiva || !raiz.current) return
    const destino = raiz.current.querySelector(`[data-seccion="${seccionActiva}"]`)
    destino?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [seccionActiva, interactivo])

  const titulo = web.titulo || hermandad.nombreLegal || 'Nuestra Hermandad'
  const color = web.colorPrimario || hermandad.colorPrimario || '#6A1A23'
  const color2 = web.colorSecundario || '#C5A059'
  const fuente = TIPOGRAFIAS.find((t) => t.id === web.tipografia)?.css ?? TIPOGRAFIAS[0].css
  const logo = web.logoDataUrl || hermandad.logoDataUrl
  const seccionesVisibles = web.secciones.filter((s) => s.visible)

  /**
   * ¿Tiene esta sección algo que enseñar? El menú solo enlaza secciones con
   * contenido real: una visible pero vacía (galería sin fotos, contacto sin
   * datos…) no pinta ancla muerta ni título huérfano.
   */
  function tieneContenido(tipo: TipoSeccion): boolean {
    if (tipo === 'historia') return !contenidoVacio(web.historia)
    if (tipo === 'titulares') return web.titulares.length > 0
    if (tipo === 'cultos') return web.cultos.length > 0
    if (tipo === 'galeria') return web.galeria.length > 0
    if (tipo === 'actualidad') return web.noticias.some((n) => n.publicada)
    if (tipo === 'paginas') return web.paginas.filter((p) => p.enMenu !== false).length > 0
    if (tipo === 'boletines') return web.boletines.length > 0
    if (tipo === 'contacto')
      return Boolean(web.direccion || hermandad.direccion || web.telefono || hermandad.telefono || web.email || hermandad.email || web.mapaUrl)
    return true
  }

  const Boton = ({ children, clase }: { children: ReactNode; clase: string }) =>
    interactivo ? (
      <Link to="/hermano" className={clase}>{children}</Link>
    ) : (
      <span className={clase}>{children}</span>
    )

  return (
    <div
      ref={raiz}
      className={`sitio${web.cabecera.fija ? ' sitio--navfija' : ''}`}
      data-plantilla={web.plantilla}
      data-tema={web.tema}
      style={{
        ['--sitio-color' as string]: color,
        ['--sitio-color2' as string]: color2,
        ['--sitio-fuente' as string]: fuente,
      }}
    >
      <header
        data-seccion="cabecera"
        className={`sitio__nav${web.cabecera.fija ? ' sitio__nav--fija' : ''}${seccionActiva === 'cabecera' ? ' sitio__marco--activo' : ''}`}
      >
        <div className="sitio__brand">
          {web.cabecera.mostrarLogo && (logo ? <img src={logo} alt="" className="sitio__logo" /> : <LogoMark size={30} />)}
          {(web.cabecera.mostrarNombre || web.cabecera.mostrarLema) && (
            <span className="sitio__brand-texto">
              {web.cabecera.mostrarNombre && <span>{titulo}</span>}
              {web.cabecera.mostrarLema && web.lema && <small>{web.lema}</small>}
            </span>
          )}
        </div>
        <nav className="sitio__menu">
          {seccionesVisibles.filter((s) => tieneContenido(s.tipo)).map((s) => {
            // La sección "paginas" no da un enlace, sino uno por cada página del menú.
            if (s.tipo === 'paginas') {
              return web.paginas
                .filter((p) => p.enMenu !== false)
                .map((p) => (
                  <a key={p.id} href={interactivo ? `#pagina-${p.id}` : undefined}>{p.titulo || 'Página'}</a>
                ))
            }
            return (
              <a key={s.tipo} href={interactivo ? `#${s.tipo}` : undefined}>{nombreSeccion(s)}</a>
            )
          })}
          {web.cabecera.textoBoton.trim() && (
            <Boton clase="sitio-btn sitio-btn--entrar">{web.cabecera.textoBoton}</Boton>
          )}
        </nav>
      </header>

      <HeroFondo web={web} titulo={titulo} Boton={Boton} />

      <main className="sitio__main">
        {seccionesVisibles.map((s) => (
          <Seccion
            key={s.tipo}
            tipo={s.tipo}
            nombre={s.nombre}
            activa={s.tipo === seccionActiva}
            interactivo={interactivo}
            web={web}
            hermandad={hermandad}
          />
        ))}
      </main>

      <PieSitio
        web={web}
        hermandad={hermandad}
        titulo={titulo}
        Boton={Boton}
        interactivo={interactivo}
        activo={seccionActiva === 'pie'}
      />
    </div>
  )
}

function HeroFondo({ web, titulo, Boton }: { web: WebPublica; titulo: string; Boton: (p: { children: ReactNode; clase: string }) => ReactNode }) {
  const fotos = web.heroFotos
  const [i, setI] = useState(0)
  useEffect(() => {
    if (fotos.length < 2) return
    const t = setInterval(() => setI((n) => (n + 1) % fotos.length), 5000)
    return () => clearInterval(t)
  }, [fotos.length])
  const fondo = fotos[i] ?? fotos[0]

  return (
    <section
      className={`sitio__hero sitio__hero--${web.heroAltura}${fondo ? '' : ' sitio__hero--sinfoto'}`}
      style={fondo ? { backgroundImage: `url(${fondo})` } : undefined}
    >
      <div className="sitio__hero-overlay" style={fondo ? { background: `rgba(15,8,10,${web.heroOverlay / 100})` } : undefined} />
      <div className="sitio__hero-inner">
        <h1>{titulo}</h1>
        {web.lema && <p className="sitio__lema">{web.lema}</p>}
        <Boton clase="sitio-btn sitio-btn--hero">{web.heroTextoBoton || 'Portal del hermano'} →</Boton>
      </div>
    </section>
  )
}

/**
 * Pie de la web: columnas de enlaces a medida, datos de contacto, redes y el
 * aviso legal. Antes era una sola línea de texto; ahora cada hermandad monta el
 * suyo. Todo lo que quede vacío no se pinta: un pie con títulos huérfanos da
 * peor impresión que un pie escueto.
 */
function PieSitio({
  web,
  hermandad,
  titulo,
  Boton,
  interactivo,
  activo,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  titulo: string
  Boton: (p: { children: ReactNode; clase: string }) => ReactNode
  /** En la vista previa del panel los enlaces no navegan. */
  interactivo: boolean
  /** Se está editando el pie en el panel: se marca en la vista previa. */
  activo?: boolean
}) {
  const dir = web.direccion || hermandad.direccion
  const tel = web.telefono || hermandad.telefono
  const email = web.email || hermandad.email

  // Los enlaces pasan por el mismo filtro que el resto de la web: sin URL
  // válida no se pintan, y una columna que se queda sin enlaces desaparece.
  const columnas = web.pie.columnas
    .map((c) => ({
      ...c,
      enlaces: c.enlaces
        .map((e) => ({ ...e, href: urlSegura(e.url) }))
        .filter((e) => e.href && e.texto.trim()),
    }))
    .filter((c) => c.enlaces.length > 0)

  const hayContacto = web.pie.mostrarContacto && Boolean(dir || tel || email)

  return (
    <footer data-seccion="pie" className={`sitio__foot${activo ? ' sitio__marco--activo' : ''}`}>
      {(columnas.length > 0 || hayContacto) && (
        <div className="sitio__foot-cols">
          {columnas.map((c) => (
            <div className="sitio__foot-col" key={c.id}>
              {c.titulo.trim() && <h4>{c.titulo}</h4>}
              {c.enlaces.map((e) => (
                <a
                  key={e.id}
                  href={interactivo ? e.href : undefined}
                  {...(interactivo && /^https?:/i.test(e.href ?? '') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {e.texto}
                </a>
              ))}
            </div>
          ))}
          {hayContacto && (
            <div className="sitio__foot-col">
              <h4>Contacto</h4>
              {dir && <span>{dir}</span>}
              {tel && <a href={interactivo ? `tel:${tel.replace(/\s+/g, '')}` : undefined}>{tel}</a>}
              {email && <a href={interactivo ? `mailto:${email}` : undefined}>{email}</a>}
            </div>
          )}
        </div>
      )}
      <div className="sitio__foot-barra">
        <span>{web.textoPie || `© ${titulo}`}</span>
        <div className="sitio__foot-right">
          {web.pie.mostrarRedes && <Redes web={web} interactivo={interactivo} />}
          <Boton clase="sitio-btn sitio-btn--sm">Área del hermano</Boton>
        </div>
      </div>
      {web.pie.textoLegal.trim() && <p className="sitio__foot-legal">{web.pie.textoLegal}</p>}
    </footer>
  )
}

function Redes({ web, interactivo }: { web: WebPublica; interactivo: boolean }) {
  if (web.redes.length === 0) return null
  return (
    <div className="sitio__redes">
      {web.redes
        .map((r) => ({ ...r, href: urlSegura(r.url) }))
        .filter((r) => r.href)
        .map((r) => (
          // En la vista previa no navegan: pulsar una red desde el panel se
          // llevaba al secretario fuera de la aplicación.
          <a
            key={r.id}
            href={interactivo ? r.href : undefined}
            {...(interactivo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="sitio__red"
          >
            {r.tipo}
          </a>
        ))}
    </div>
  )
}

function fechaBonita(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : formatDate(d)
}

/** Bloque de contenido con formato (entradilla, párrafos con subtítulo y fotos). */
function Contenido({ c }: { c: ContenidoRico }) {
  return (
    <>
      {c.entradilla.trim() && <p className="sitio__entradilla">{c.entradilla}</p>}
      {c.fotos.length > 0 && (
        <div className="sitio__galeria">
          {c.fotos.map((f, i) => (
            <figure className="sitio__foto" key={i}><img src={f} alt="" /></figure>
          ))}
        </div>
      )}
      {c.parrafos
        .filter((p) => p.texto.trim() || p.subtitulo.trim())
        .map((p) => (
          <div className="sitio__parrafo" key={p.id}>
            {p.subtitulo.trim() && <h4>{p.subtitulo}</h4>}
            {p.texto.trim() && <p className="sitio__texto">{p.texto}</p>}
          </div>
        ))}
    </>
  )
}

function Seccion({
  tipo,
  nombre,
  activa,
  interactivo,
  web,
  hermandad,
}: {
  tipo: TipoSeccion
  /** Título a medida de la hermandad; si está vacío, el de fábrica. */
  nombre?: string
  /** Se está editando esta sección: se marca en la vista previa. */
  activa?: boolean
  /** En la vista previa del panel los enlaces no navegan. */
  interactivo: boolean
  web: WebPublica
  hermandad: HermandadSettings
}) {
  const titulo = (t: string) => nombre?.trim() || t
  // Se aplican a todas las secciones por igual: la marca para poder saltar a
  // ella desde el editor y el resaltado de «estás editando esto».
  const props = {
    'data-seccion': tipo,
    className: `sitio__seccion${activa ? ' sitio__seccion--activa' : ''}`,
  }

  if (tipo === 'historia') {
    if (contenidoVacio(web.historia)) return null
    return (
      <section id="historia" {...props}>
        <h2>{titulo(SECCIONES_INFO.historia.publico)}</h2>
        <Contenido c={web.historia} />
      </section>
    )
  }
  if (tipo === 'titulares') {
    if (web.titulares.length === 0) return null
    return (
      <section id="titulares" {...props}>
        <h2>{titulo(SECCIONES_INFO.titulares.publico)}</h2>
        <div className="sitio__titulares">
          {web.titulares.map((t) => (
            <article key={t.id} className="sitio__titular">
              {t.fotoDataUrl && <img src={t.fotoDataUrl} alt={t.nombre} />}
              <h3>{t.nombre}</h3>
              {t.autoria?.trim() && <p className="sitio__autoria">{t.autoria}</p>}
              {t.descripcion && <p>{t.descripcion}</p>}
              {(t.parrafos ?? [])
                .filter((p) => p.texto.trim() || p.subtitulo.trim())
                .map((p) => (
                  <div className="sitio__parrafo" key={p.id}>
                    {p.subtitulo.trim() && <h4>{p.subtitulo}</h4>}
                    {p.texto.trim() && <p className="sitio__texto">{p.texto}</p>}
                  </div>
                ))}
            </article>
          ))}
        </div>
      </section>
    )
  }
  if (tipo === 'cultos') {
    if (web.cultos.length === 0) return null
    return (
      <section id="cultos" {...props}>
        <h2>{titulo(SECCIONES_INFO.cultos.publico)}</h2>
        <div className="sitio__cultos">
          {web.cultos.map((c) => (
            <article key={c.id} className="sitio__culto">
              {c.fotoDataUrl && <img className="sitio__culto-foto" src={c.fotoDataUrl} alt="" />}
              <h3>{c.titulo}</h3>
              {(c.fecha?.trim() || c.lugar?.trim()) && (
                <p className="sitio__culto-cuando">
                  {[c.fecha, c.lugar].filter((x) => x?.trim()).join(' · ')}
                </p>
              )}
              {c.detalle && <p>{c.detalle}</p>}
            </article>
          ))}
        </div>
      </section>
    )
  }
  if (tipo === 'galeria') {
    if (web.galeria.length === 0) return null
    return (
      <section id="galeria" {...props}>
        <h2>{titulo(SECCIONES_INFO.galeria.publico)}</h2>
        <div className="sitio__galeria">{web.galeria.map((g) => <figure key={g.id} className="sitio__foto"><img src={g.fotoDataUrl} alt={g.pie} />{g.pie && <figcaption>{g.pie}</figcaption>}</figure>)}</div>
      </section>
    )
  }
  if (tipo === 'actualidad') {
    const noticias = web.noticias.filter((n) => n.publicada)
    if (noticias.length === 0) return null
    return (
      <section id="actualidad" {...props}>
        {/* En la web pública, sin la coletilla "(noticias)" del editor. */}
        <h2>{titulo('Actualidad')}</h2>
        <div className="sitio__noticias">
          {noticias.map((n) => (
            <article key={n.id} className="sitio__noticia">
              {n.fotoDataUrl && <img src={n.fotoDataUrl} alt="" />}
              <div><span className="sitio__noticia-fecha">{fechaBonita(n.fecha)}</span><h3>{n.titulo}</h3><p>{n.resumen}</p></div>
            </article>
          ))}
        </div>
      </section>
    )
  }
  if (tipo === 'paginas') {
    // Cada página del menú es su propia sección anclable (#pagina-<id>).
    const pags = web.paginas.filter((p) => p.enMenu !== false)
    if (pags.length === 0) return null
    return (
      <>
        {pags.map((p) => (
          <section id={`pagina-${p.id}`} key={p.id} {...props}>
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
  if (tipo === 'boletines') {
    if (web.boletines.length === 0) return null
    return (
      <section id="boletines" {...props}>
        <h2>{titulo(SECCIONES_INFO.boletines.publico)}</h2>
        <div className="sitio__cultos">{web.boletines.map((bo) => <article key={bo.id} className="sitio__culto"><h3>{bo.titulo}</h3><p>{bo.subtitulo}{bo.pdfNombre ? ` · ${bo.pdfNombre}` : ''}</p></article>)}</div>
      </section>
    )
  }
  if (tipo === 'contacto') {
    const dir = web.direccion || hermandad.direccion
    const tel = web.telefono || hermandad.telefono
    const email = web.email || hermandad.email
    // Sin ningún dato de contacto, la sección no se pinta (nada de títulos vacíos).
    if (!dir && !tel && !email && !web.mapaUrl) return null
    const mapa = web.mapaIncrustado ? urlMapaIncrustado(web.mapaUrl, dir) : null
    const enlaceMapa = urlSegura(web.mapaUrl)
    return (
      <section id="contacto" {...props}>
        <h2>{titulo(SECCIONES_INFO.contacto.publico)}</h2>
        {/* Sin mapa no se monta la rejilla: los datos ocupaban media columna
            y dejaban un hueco enorme al lado. */}
        <div className={mapa ? 'sitio__contacto-grid' : undefined}>
          <div>
            <ul className="sitio__contacto">
              {dir && <li>{dir}</li>}
              {tel && <li>Tel. <a href={interactivo ? `tel:${tel.replace(/\s+/g, '')}` : undefined}>{tel}</a></li>}
              {email && <li><a href={interactivo ? `mailto:${email}` : undefined}>{email}</a></li>}
            </ul>
            {enlaceMapa && (
              <a
                href={interactivo ? enlaceMapa : undefined}
                {...(interactivo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="sitio-btn sitio-btn--sm"
              >
                Cómo llegar
              </a>
            )}
          </div>
          {mapa && (
            <div className="sitio__mapa">
              {/* Sin clave de Google: el mapa se pide con la dirección tal cual. */}
              <iframe
                src={mapa}
                title="Dónde estamos"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </section>
    )
  }
  return null
}
