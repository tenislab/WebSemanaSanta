import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SECCIONES_INFO, TIPOGRAFIAS, type TipoSeccion, type WebPublica } from '../lib/webPublica'
import type { HermandadSettings } from '../lib/hermandadSettings'
import { LogoMark } from './Logo'
import { formatDate } from '../lib/format'

/**
 * Render de la web pública a partir de un objeto WebPublica. Lo usan tanto la
 * página pública (/w/:slug) como la vista previa del panel (en vivo, sin
 * iframe). Con `interactivo=false` los botones no navegan (para la preview).
 */
export default function SitioContenido({
  web,
  hermandad,
  interactivo = true,
}: {
  web: WebPublica
  hermandad: HermandadSettings
  interactivo?: boolean
}) {
  const titulo = web.titulo || hermandad.nombreLegal || 'Nuestra Hermandad'
  const color = web.colorPrimario || hermandad.colorPrimario || '#6A1A23'
  const color2 = web.colorSecundario || '#C5A059'
  const fuente = TIPOGRAFIAS.find((t) => t.id === web.tipografia)?.css ?? TIPOGRAFIAS[0].css
  const logo = web.logoDataUrl || hermandad.logoDataUrl
  const seccionesVisibles = web.secciones.filter((s) => s.visible)

  const anclaLabel: Record<TipoSeccion, string> = {
    historia: 'Historia', titulares: 'Titulares', cultos: 'Cultos', galeria: 'Galería',
    actualidad: 'Actualidad', paginas: 'La Hermandad', boletines: 'Boletines', contacto: 'Contacto',
  }

  const Boton = ({ children, clase }: { children: ReactNode; clase: string }) =>
    interactivo ? (
      <Link to="/hermano" className={clase}>{children}</Link>
    ) : (
      <span className={clase}>{children}</span>
    )

  return (
    <div
      className="sitio"
      data-plantilla={web.plantilla}
      data-tema={web.tema}
      style={{
        ['--sitio-color' as string]: color,
        ['--sitio-color2' as string]: color2,
        ['--sitio-fuente' as string]: fuente,
      }}
    >
      <header className="sitio__nav">
        <div className="sitio__brand">
          {logo ? <img src={logo} alt="" className="sitio__logo" /> : <LogoMark size={30} />}
          <span>{titulo}</span>
        </div>
        <nav className="sitio__menu">
          {seccionesVisibles.map((s) => <a key={s.tipo} href={interactivo ? `#${s.tipo}` : undefined}>{anclaLabel[s.tipo]}</a>)}
          <Boton clase="sitio-btn sitio-btn--entrar">Entrar</Boton>
        </nav>
      </header>

      <HeroFondo web={web} titulo={titulo} Boton={Boton} />

      <main className="sitio__main">
        {seccionesVisibles.map((s) => <Seccion key={s.tipo} tipo={s.tipo} web={web} hermandad={hermandad} />)}
      </main>

      <footer className="sitio__foot">
        <span>{web.textoPie || `© ${titulo}`}</span>
        <div className="sitio__foot-right">
          <Redes web={web} />
          <Boton clase="sitio-btn sitio-btn--sm">Área del hermano</Boton>
        </div>
      </footer>
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

function Redes({ web }: { web: WebPublica }) {
  if (web.redes.length === 0) return null
  return (
    <div className="sitio__redes">
      {web.redes.map((r) => <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="sitio__red">{r.tipo}</a>)}
    </div>
  )
}

function fechaBonita(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : formatDate(d)
}

function Seccion({ tipo, web, hermandad }: { tipo: TipoSeccion; web: WebPublica; hermandad: HermandadSettings }) {
  if (tipo === 'historia') {
    return <section id="historia" className="sitio__seccion"><h2>{SECCIONES_INFO.historia.nombre}</h2><p className="sitio__texto">{web.historia}</p></section>
  }
  if (tipo === 'titulares') {
    if (web.titulares.length === 0) return null
    return (
      <section id="titulares" className="sitio__seccion">
        <h2>{SECCIONES_INFO.titulares.nombre}</h2>
        <div className="sitio__titulares">
          {web.titulares.map((t) => (
            <article key={t.id} className="sitio__titular">
              {t.fotoDataUrl && <img src={t.fotoDataUrl} alt={t.nombre} />}
              <h3>{t.nombre}</h3>{t.descripcion && <p>{t.descripcion}</p>}
            </article>
          ))}
        </div>
      </section>
    )
  }
  if (tipo === 'cultos') {
    if (web.cultos.length === 0) return null
    return (
      <section id="cultos" className="sitio__seccion">
        <h2>{SECCIONES_INFO.cultos.nombre}</h2>
        <div className="sitio__cultos">{web.cultos.map((c) => <article key={c.id} className="sitio__culto"><h3>{c.titulo}</h3><p>{c.detalle}</p></article>)}</div>
      </section>
    )
  }
  if (tipo === 'galeria') {
    if (web.galeria.length === 0) return null
    return (
      <section id="galeria" className="sitio__seccion">
        <h2>{SECCIONES_INFO.galeria.nombre}</h2>
        <div className="sitio__galeria">{web.galeria.map((g) => <figure key={g.id} className="sitio__foto"><img src={g.fotoDataUrl} alt={g.pie} />{g.pie && <figcaption>{g.pie}</figcaption>}</figure>)}</div>
      </section>
    )
  }
  if (tipo === 'actualidad') {
    const noticias = web.noticias.filter((n) => n.publicada)
    if (noticias.length === 0) return null
    return (
      <section id="actualidad" className="sitio__seccion">
        <h2>{SECCIONES_INFO.actualidad.nombre}</h2>
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
    if (web.paginas.length === 0) return null
    return (
      <section id="paginas" className="sitio__seccion">
        <h2>{SECCIONES_INFO.paginas.nombre}</h2>
        {web.paginas.map((p) => (
          <article key={p.id} className="sitio__pagina">
            {p.antetitulo && <span className="sitio__pagina-ante">{p.antetitulo}</span>}
            <h3>{p.icono} {p.titulo}</h3>
            {p.entradilla && <p className="sitio__pagina-entradilla">{p.entradilla}</p>}
            {p.fotos.length > 0 && <div className="sitio__galeria">{p.fotos.map((f, idx) => <figure key={idx} className="sitio__foto"><img src={f} alt="" /></figure>)}</div>}
            {p.parrafos.map((par) => <div key={par.id} className="sitio__parrafo">{par.subtitulo && <h4>{par.subtitulo}</h4>}<p className="sitio__texto">{par.texto}</p></div>)}
          </article>
        ))}
      </section>
    )
  }
  if (tipo === 'boletines') {
    if (web.boletines.length === 0) return null
    return (
      <section id="boletines" className="sitio__seccion">
        <h2>{SECCIONES_INFO.boletines.nombre}</h2>
        <div className="sitio__cultos">{web.boletines.map((bo) => <article key={bo.id} className="sitio__culto"><h3>{bo.titulo}</h3><p>{bo.subtitulo}{bo.pdfNombre ? ` · ${bo.pdfNombre}` : ''}</p></article>)}</div>
      </section>
    )
  }
  if (tipo === 'contacto') {
    const dir = web.direccion || hermandad.direccion
    const tel = web.telefono || hermandad.telefono
    const email = web.email || hermandad.email
    return (
      <section id="contacto" className="sitio__seccion">
        <h2>{SECCIONES_INFO.contacto.nombre}</h2>
        <ul className="sitio__contacto">{dir && <li>{dir}</li>}{tel && <li>Tel. {tel}</li>}{email && <li>{email}</li>}</ul>
        {web.mapaUrl && <a href={web.mapaUrl} target="_blank" rel="noopener noreferrer" className="sitio-btn sitio-btn--sm">Ver en el mapa</a>}
      </section>
    )
  }
  return null
}
