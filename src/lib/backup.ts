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
    version: VERSION_COPIA,
    exportadoEl: new Date().toISOString(),
    datos: leerDatosLocales(),
    archivos: archivosB64,
  }
}

/** Valida que un JSON tenga forma de copia de Cabildo. */
export const VERSION_COPIA = 1

/**
 * Lo que se le enseña a la hermandad ANTES de dejarle sustituir todos sus
 * datos: de cuándo es la copia, cuánto trae y si la hizo una versión más nueva
 * de Cabildo.
 *
 * Hasta ahora la copia guardaba su versión y su fecha y **nadie las leía**: se
 * confirmaba a ciegas, antes siquiera de abrir el archivo, y una copia de hace
 * dos años se restauraba igual que la de ayer sin que nadie se enterara.
 */
export interface ResumenCopia {
  fecha: string | null
  /** Cuántas claves de datos trae (hermanos, cuotas, papeletas…). */
  bloques: number
  archivos: number
  /** La hizo una versión de Cabildo posterior a esta. */
  masNueva: boolean
}

export function resumirCopia(copia: CopiaSeguridad): ResumenCopia {
  const iso = copia.exportadoEl
  const d = iso ? new Date(iso) : null
  return {
    fecha: d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
      : null,
    bloques: Object.keys(copia.datos ?? {}).length,
    archivos: (copia.archivos ?? []).length,
    masNueva: typeof copia.version === 'number' && copia.version > VERSION_COPIA,
  }
}

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
  // Primero se prepara TODO en memoria y se guarda una copia de lo que hay.
  // Antes se borraba el almacenamiento y luego se escribía: si a mitad no
  // cabía (las copias llevan fotos y PDF en base64), quedaban los datos viejos
  // borrados y los nuevos a medias, con un mensaje que decía «no se pudo leer
  // el archivo», como si no hubiera pasado nada.
  const entradas = Object.entries(copia.datos)
    .filter(([k]) => k.startsWith(PREFIJO) && !EXCLUIR.has(k))
    .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)] as const)

  const anterior = clavesCabildo().map((k) => [k, localStorage.getItem(k)] as const)
  clavesCabildo().forEach((k) => localStorage.removeItem(k))
  try {
    entradas.forEach(([k, v]) => localStorage.setItem(k, v))
  } catch {
    // Marcha atrás: se deja el navegador como estaba y se avisa de verdad.
    clavesCabildo().forEach((k) => localStorage.removeItem(k))
    anterior.forEach(([k, v]) => { if (v !== null) localStorage.setItem(k, v) })
    throw new Error('La copia no cabe en este navegador (suele ser por las fotos y los PDF). No se ha cambiado nada.')
  }
  // Solo se vacía el almacén de adjuntos si la copia trae adjuntos: si no,
  // una copia antigua (sin esa sección) borraba todos los archivos guardados.
  if (copia.archivos && copia.archivos.length > 0) {
    await borrarTodosLosArchivos()
  }
  for (const a of copia.archivos ?? []) {
    try {
      await guardarArchivo(a.id, base64AFile(a))
    } catch {
      // Un adjunto que no se pueda restaurar no debe frenar el resto.
    }
  }
}
