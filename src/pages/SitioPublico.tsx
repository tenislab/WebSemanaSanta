import { useEffect, useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getWebPublica, type WebPublica } from '../lib/webPublica'
import { useHermandadSettings, type HermandadSettings } from '../lib/hermandadSettings'
import { getSuscripcion, tieneCapacidad } from '../lib/suscripcion'
import { haySesionAbierta } from '../lib/sesion'
import { LogoMark } from '../components/Logo'
import SitioContenido from '../components/SitioContenido'
import { cultosDelCalendario } from '../lib/cultosDelCalendario'

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

  return (
    <>
      <MetaWeb web={web} hermandad={hermandad} />
      <SitioContenido web={web} hermandad={hermandad} cultosDelCalendario={cultosCalendario} />
    </>
  )
}

/**
 * Título y etiquetas de la página: lo que se ve en la pestaña del navegador, en
 * los resultados de Google y al pegar el enlace en WhatsApp. Se escriben en el
 * documento al montar y se dejan como estaban al salir, para no contaminar el
 * resto de la aplicación.
 */
function MetaWeb({ web, hermandad }: { web: WebPublica; hermandad: HermandadSettings }) {
  useEffect(() => {
    const anterior = document.title
    // Mismo orden de respaldo que el render del sitio, para que la pestaña y
    // la tarjeta al compartir digan lo mismo que la web.
    const titulo = web.seo.titulo.trim() || web.titulo || hermandad.nombreLegal || 'Nuestra Hermandad'
    const descripcion = web.seo.descripcion.trim() || web.lema || ''
    const imagen = web.seo.imagenDataUrl ?? web.heroFotos[0] ?? web.logoDataUrl ?? hermandad.logoDataUrl ?? ''
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
  }, [web, hermandad])

  return null
}
