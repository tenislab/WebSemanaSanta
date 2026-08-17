import { Link, useParams } from 'react-router-dom'
import { getWebPublica } from '../lib/webPublica'
import { useHermandadSettings } from '../lib/hermandadSettings'
import { LogoMark } from '../components/Logo'

/**
 * Web pública de la hermandad, en la ruta /w/:slug. Pinta la plantilla elegida
 * con el contenido editado en el panel. El botón «Entrar» lleva al portal del
 * hermano de la app (/hermano). Si la web no está publicada o el enlace no
 * coincide, se muestra un aviso.
 */
export default function SitioPublico() {
  const { slug } = useParams()
  const web = getWebPublica()
  const hermandad = useHermandadSettings()

  if (!web.publicada || web.slug !== slug) {
    return (
      <div className="sitio-noweb">
        <LogoMark size={40} />
        <h1>Esta web no está disponible</h1>
        <p>La hermandad todavía no ha publicado su web, o el enlace no es correcto.</p>
        <Link to="/hermano" className="sitio-btn">Área del hermano</Link>
      </div>
    )
  }

  const titulo = web.titulo || hermandad.nombreLegal || 'Nuestra Hermandad'
  const color = web.colorPrimario || hermandad.colorPrimario || '#6A1A23'
  const logo = hermandad.logoDataUrl

  return (
    <div className="sitio" data-plantilla={web.plantilla} style={{ ['--sitio-color' as string]: color }}>
      <header className="sitio__nav">
        <div className="sitio__brand">
          {logo ? <img src={logo} alt="" className="sitio__logo" /> : <LogoMark size={30} />}
          <span>{titulo}</span>
        </div>
        <nav className="sitio__menu">
          <a href="#historia">Historia</a>
          <a href="#cultos">Cultos</a>
          <a href="#contacto">Contacto</a>
          <Link to="/hermano" className="sitio-btn sitio-btn--entrar">Entrar</Link>
        </nav>
      </header>

      <section
        className="sitio__hero"
        style={web.fotoPortadaDataUrl ? { backgroundImage: `url(${web.fotoPortadaDataUrl})` } : undefined}
      >
        <div className="sitio__hero-inner">
          <h1>{titulo}</h1>
          {web.lema && <p className="sitio__lema">{web.lema}</p>}
          <Link to="/hermano" className="sitio-btn sitio-btn--hero">Portal del hermano →</Link>
        </div>
      </section>

      <main className="sitio__main">
        <section id="historia" className="sitio__seccion">
          <h2>Historia</h2>
          <p className="sitio__texto">{web.historia}</p>
        </section>

        {web.cultos.length > 0 && (
          <section id="cultos" className="sitio__seccion">
            <h2>Cultos y actos</h2>
            <div className="sitio__cultos">
              {web.cultos.map((c) => (
                <article key={c.id} className="sitio__culto">
                  <h3>{c.titulo}</h3>
                  <p>{c.detalle}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section id="contacto" className="sitio__seccion">
          <h2>Contacto</h2>
          <ul className="sitio__contacto">
            {(web.direccion || hermandad.direccion) && <li>{web.direccion || hermandad.direccion}</li>}
            {(web.telefono || hermandad.telefono) && <li>Tel. {web.telefono || hermandad.telefono}</li>}
            {(web.email || hermandad.email) && <li>{web.email || hermandad.email}</li>}
          </ul>
        </section>
      </main>

      <footer className="sitio__foot">
        <span>© {titulo}</span>
        <Link to="/hermano" className="sitio-btn sitio-btn--sm">Área del hermano</Link>
      </footer>
    </div>
  )
}
