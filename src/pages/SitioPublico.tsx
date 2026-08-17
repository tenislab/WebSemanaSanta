import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getWebPublica } from '../lib/webPublica'
import { useHermandadSettings } from '../lib/hermandadSettings'
import { LogoMark } from '../components/Logo'
import SitioContenido from '../components/SitioContenido'

/**
 * Web pública de la hermandad (/w/:slug). Con ?preview=1 se muestra aunque no
 * esté publicada (para la vista previa del panel). El render vive en
 * SitioContenido, compartido con la vista previa.
 */
export default function SitioPublico() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const preview = params.get('preview') === '1'
  const web = getWebPublica()
  const hermandad = useHermandadSettings()

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

  return <SitioContenido web={web} hermandad={hermandad} />
}
