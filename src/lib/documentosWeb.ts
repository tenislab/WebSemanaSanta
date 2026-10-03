import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from './supabase'
import { avisarDeFallo } from './supabaseSync'
import { CLAVES_DATOS, leerPersistido } from './persistencia'
import { DOCUMENTOS_INICIALES, type Documento } from '../data/documentos'

/**
 * UN DOCUMENTO DEL ARCHIVO, COMO LO VE QUIEN PASA POR LA WEB.
 *
 * Es a propósito más pobre que `Documento`: aquí no están `archivadoPor` —que
 * es el nombre de una persona—, ni los cargos con acceso, ni el proveedor de
 * un contrato, ni el estado de un expediente. Nada de eso hace falta para
 * descargar un PDF, y lo que no se pide no se filtra.
 */
export interface DocumentoWeb {
  id: string
  nombre: string
  categoria: string
  fecha: string
  descripcion: string
  archivoNombre: string | null
  archivoTipo: string | null
  archivoTamano: number | null
}

function filaADocumentoWeb(r: Record<string, unknown>): DocumentoWeb {
  return {
    id: String(r.id),
    nombre: String(r.nombre ?? ''),
    categoria: String(r.categoria ?? ''),
    fecha: String(r.fecha ?? ''),
    descripcion: String(r.descripcion ?? ''),
    archivoNombre: (r.archivo_nombre as string | null) ?? null,
    archivoTipo: (r.archivo_tipo as string | null) ?? null,
    archivoTamano: (r.archivo_tamano as number | null) ?? null,
  }
}

/**
 * LOS DOCUMENTOS QUE LA HERMANDAD HA PUESTO EN SU WEB.
 *
 * Mismo molde que `useCatalogoWeb`, y por los mismos motivos:
 *
 *  · VA POR SLUG, que es lo que hay en la barra de direcciones.
 *  · NO LEE LA TABLA. Llama a `documentos_de_la_web()`, que devuelve uno a uno
 *    los campos que salen en la página. Leer `documentos` desde aquí traería
 *    dentro quién lo archivó y los cargos con acceso, y eso no es asunto de
 *    quien pasa por la web. Y si mañana la tabla recibe una columna con algo
 *    delicado, no se cuela sola.
 *  · SIN BASE DE DATOS sale del navegador, para que la vista previa del panel
 *    enseñe la sección de verdad antes de conectar nada. Ahí se filtra a mano
 *    por `publicacion === 'web'`, que es lo mismo que hace la función.
 */
export function useDocumentosWeb(slug: string): { documentos: DocumentoWeb[]; cargando: boolean } {
  const [documentos, setDocumentos] = useState<DocumentoWeb[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setDocumentos(
        leerPersistido<Documento[]>(CLAVES_DATOS.documentos, DOCUMENTOS_INICIALES)
          .filter((d) => d.publicacion === 'web')
          /*
           * Y NUNCA LO RESTRINGIDO A CARGOS, aquí también. No puede estar
           * marcado para la web —lo frena un `check` de la tabla—, pero el
           * espejo del navegador puede traer una fila de antes de esa
           * restricción, y este camino no pasa por la base: es el único sitio
           * donde el `check` no protege nada.
           */
          .filter((d) => !d.cargosConAcceso || d.cargosConAcceso.length === 0)
          .sort((a, b) => b.fecha.localeCompare(a.fecha))
          .map((d) => ({
            id: d.id,
            nombre: d.nombre,
            categoria: d.categoria,
            fecha: d.fecha,
            descripcion: d.descripcion,
            archivoNombre: d.archivoNombre,
            archivoTipo: d.archivoTipo,
            archivoTamano: d.archivoTamano,
          })),
      )
      setCargando(false)
      return
    }
    if (!slug) { setCargando(false); return }
    let cancelado = false
    setCargando(true)
    void supabase.rpc('documentos_de_la_web', { p_slug: slug }).then(({ data, error }) => {
      if (cancelado) return
      if (error) avisarDeFallo('documentos de la web', error.message)
      setDocumentos(error || !data ? [] : (data as Record<string, unknown>[]).map(filaADocumentoWeb))
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [slug])

  return { documentos, cargando }
}

/**
 * LA DIRECCIÓN DESDE LA QUE SE DESCARGA EL PDF, sin cuenta de ninguna clase.
 *
 * El cubo `documentos` NO es público, así que no vale `getPublicUrl`: devuelve
 * una dirección con buena pinta que contesta «not found» al pulsarla, y eso es
 * peor que no ofrecer el enlace. Se baja por el cliente, que es lo que hace
 * que la política de `anon` tenga algo que autorizar.
 *
 * El fichero vive en `<hermandad_id>/<documento_id>`, y aquí no se conoce el
 * id de la hermandad: quien pasa por la web solo tiene el slug. Así que la
 * carpeta la dice la propia función de la base, que ya sabe de quién es el
 * documento — por eso `documentos_de_la_web` devuelve el `id` y se pide por
 * `ruta_del_documento`.
 */
export async function descargarDocumentoWeb(slug: string, id: string): Promise<Blob | null> {
  if (!isSupabaseConfigured || !supabase) {
    // En modo local el fichero está en IndexedDB, igual que en el panel.
    const { leerArchivo } = await import('./filestore')
    const guardado = await leerArchivo(id)
    return guardado instanceof Blob ? guardado : null
  }
  const { data: ruta, error: falloRuta } = await supabase.rpc('ruta_del_documento', {
    p_slug: slug,
    p_documento: id,
  })
  if (falloRuta || !ruta) {
    avisarDeFallo('ruta del documento público', falloRuta?.message ?? 'sin ruta')
    return null
  }
  const { data, error } = await supabase.storage.from('documentos').download(String(ruta))
  if (error || !data) {
    avisarDeFallo('descarga de un documento público', error?.message ?? 'sin datos')
    return null
  }
  return data
}
