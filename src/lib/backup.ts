import { borrarTodosLosArchivos, guardarArchivo, todosLosArchivos } from './filestore'

/**
 * Copia de seguridad completa de una hermandad: mientras no hay base de datos
 * en la nube, todo vive en este navegador (localStorage + IndexedDB). Esta
 * copia permite descargar un único archivo JSON con TODO (hermanos, cuotas,
 * papeletas, tesorería, documentos y sus archivos adjuntos…) para no perderlo
 * al cambiar de ordenador o limpiar el navegador, y restaurarlo en otro
 * equipo. Cuando se conecte Supabase, los datos vivirán en la nube y esto
 * pasará a ser una exportación puntual, no la única red de seguridad.
 */

const PREFIJO = 'cabildo-'
// La sesión de demostración no se incluye: la copia son datos de la hermandad,
// no de quién está conectado.
const EXCLUIR = new Set(['cabildo-demo-user'])

export interface ArchivoCopia {
  id: string
  nombre: string
  tipo: string
  base64: string
}

export interface CopiaSeguridad {
  app: 'cabildo'
  version: number
  exportadoEl: string
  datos: Record<string, unknown>
  archivos: ArchivoCopia[]
}

function clavesCabildo(): string[] {
  const claves: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIJO) && !EXCLUIR.has(k)) claves.push(k)
  }
  return claves
}

function leerDatosLocales(): Record<string, unknown> {
  const datos: Record<string, unknown> = {}
  clavesCabildo().forEach((k) => {
    const raw = localStorage.getItem(k)
    if (raw === null) return
    try {
      datos[k] = JSON.parse(raw)
    } catch {
      datos[k] = raw
    }
  })
  return datos
}

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = String(reader.result)
      // "data:...;base64,XXXX" → nos quedamos solo con la parte base64.
      resolve(res.slice(res.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function base64AFile(a: ArchivoCopia): File {
  const binario = atob(a.base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return new File([bytes], a.nombre || a.id, { type: a.tipo || 'application/octet-stream' })
}

/** Construye el objeto de copia (datos + archivos adjuntos en base64). */
export async function crearCopia(): Promise<CopiaSeguridad> {
  const archivos = await todosLosArchivos()
  const archivosB64 = await Promise.all(
    archivos.map(async ({ id, blob }) => ({
      id,
      nombre: blob instanceof File ? blob.name : id,
      tipo: blob.type || '',
      base64: await blobABase64(blob),
    })),
  )
  return {
    app: 'cabildo',
    version: 1,
    exportadoEl: new Date().toISOString(),
    datos: leerDatosLocales(),
    archivos: archivosB64,
  }
}

/** Valida que un JSON tenga forma de copia de Cabildo. */
export function esCopiaValida(obj: unknown): obj is CopiaSeguridad {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as CopiaSeguridad).app === 'cabildo' &&
    typeof (obj as CopiaSeguridad).datos === 'object'
  )
}

/**
 * Restaura una copia: borra los datos actuales de la hermandad y los sustituye
 * por los de la copia (localStorage + archivos adjuntos). No toca la sesión.
 */
export async function restaurarCopia(copia: CopiaSeguridad): Promise<void> {
  clavesCabildo().forEach((k) => localStorage.removeItem(k))
  Object.entries(copia.datos).forEach(([k, v]) => {
    if (!k.startsWith(PREFIJO) || EXCLUIR.has(k)) return
    localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
  })
  await borrarTodosLosArchivos()
  for (const a of copia.archivos ?? []) {
    try {
      await guardarArchivo(a.id, base64AFile(a))
    } catch {
      // Un adjunto que no se pueda restaurar no debe frenar el resto.
    }
  }
}
