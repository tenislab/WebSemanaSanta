/**
 * LO QUE COMPARTEN LAS DIECISÉIS SECCIONES DE LA WEB PÚBLICA.
 *
 * Cada sección de la web se pinta o no según lo que la hermandad haya
 * rellenado, y todas reciben lo mismo: el tipo, el título a medida si lo hay,
 * si se está editando, el contenido y los cultos ya mezclados.
 *
 * Los bloques viven en ficheros aparte pero NO son componentes: son funciones
 * que devuelven JSX y que llama `Seccion`. Es a propósito —convertirlos en
 * componentes habría metido dieciséis niveles nuevos en el árbol de React, y
 * lo que se está haciendo aquí es mover código, no cambiar cómo se pinta—.
 */
import type { CultoWeb, TipoSeccion, WebPublica } from '../../lib/webPublicaDatos'
import type { HermandadSettings } from '../../lib/hermandadSettings'

export interface PropsDeSeccion {
  tipo: TipoSeccion
  /** Título a medida de la hermandad; si está vacío, el de fábrica. */
  nombre?: string
  /** Se está editando esta sección: se marca en la vista previa. */
  activa?: boolean
  /** En borrador: solo se ve aquí, con su marca, no en la web. */
  borrador?: boolean
  /** En la vista previa del panel los enlaces no navegan. */
  interactivo: boolean
  /** Los del calendario ya mezclados con los escritos a mano. */
  cultos: CultoWeb[]
  web: WebPublica
  hermandad: HermandadSettings
}

/** El título de la sección: el que haya puesto la hermandad, o el de fábrica. */
export type Titulo = (deFabrica: string) => string

/**
 * La marca que lleva toda sección por igual: el `data-seccion` para poder
 * saltar a ella desde el editor, y el resaltado de «estás editando esto».
 */
export interface MarcaDeSeccion {
  'data-seccion': string
  className: string
}

export function marcaDeSeccion({ tipo, activa, borrador }: Pick<PropsDeSeccion, 'tipo' | 'activa' | 'borrador'>): MarcaDeSeccion {
  return {
    'data-seccion': tipo,
    className:
      `sitio__seccion${activa ? ' sitio__seccion--activa' : ''}${borrador ? ' sitio__seccion--borrador' : ''}`,
  }
}
