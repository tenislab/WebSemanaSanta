import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getWebPublica } from '../lib/webPublica'
import { useHermandadSettings } from '../lib/hermandadSettings'
import { getSuscripcion, tieneCapacidad } from '../lib/suscripcion'
import { haySesionAbierta } from '../lib/sesion'
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
  // La vista previa solo vale desde el panel (misma pestaña/origen): se exige
  // sesión abierta. Si no, cualquiera podía ver con ?preview=1 una web sin
  // publicar o de una hermandad que no tiene contratado el pack Web.
  const preview = params.get('preview') === '1' && haySesionAbierta()
  const web = getWebPublica()
  const hermandad = useHermandadSettings()
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

  return <SitioContenido web={web} hermandad={hermandad} />
}
