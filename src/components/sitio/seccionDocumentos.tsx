import { Documentos } from './Documentos'
import { SECCIONES_INFO } from '../../lib/webPublica'
import type { MarcaDeSeccion, PropsDeSeccion, Titulo } from './comun'

/**
 * LA SECCIÓN DE REGLAS Y DOCUMENTOS.
 *
 * En su propio fichero y no junto a los boletines, aunque las dos reparten
 * PDF: los boletines son una lista del editor de la web y esto sale del
 * archivo documental, con su permiso y su «hasta dónde sale». Juntarlas en un
 * fichero haría pensar que comparten datos, y no comparten ninguno.
 */
export function pintarDocumentos(sec: PropsDeSeccion, titulo: Titulo, marca: MarcaDeSeccion) {
  return (
    <section id="documentos" {...marca}>
      <h2>{titulo(SECCIONES_INFO.documentos.publico)}</h2>
      <Documentos web={sec.web} interactivo={sec.interactivo} />
    </section>
  )
}
