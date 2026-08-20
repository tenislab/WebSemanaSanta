/**
 * Almacén de archivos adjuntos del Archivo documental: el PDF/imagen de cada
 * documento. En modo demostración vive en IndexedDB (solo en este
 * navegador). Con Supabase conectado, vive en Supabase Storage (bucket
 * `documentos`), compartido por toda la hermandad. Los componentes usan
 * siempre las mismas funciones; el modo se decide aquí según
 * `isSupabaseConfigured`.
 *
 * Como todas las hermandades comparten el mismo cubo, cada una guarda lo suyo
 * dentro de una carpeta que se llama como su id:
 *
 *     documentos/6f3a…-e21b/acta-cabildo-2026.pdf
 *
 * No es un adorno: la política de Supabase mira esa primera carpeta para
 * decidir quién puede descargar el archivo. Un adjunto guardado fuera de ella
 * lo rechaza el propio Storage. Aquí dentro los documentos siguen
 * identificándose por su id de siempre; la carpeta se pone y se quita al
 * entrar y salir, y el resto de la aplicación no se entera.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { hermandadActualId } from './multiHermandad'

const DB_NAME = 'cabildo-files'
const STORE_NAME = 'documentos'
const DB_VERSION = 1
const BUCKET = 'documentos'

/**
 * La carpeta de esta hermandad dentro del cubo. Si no se puede saber cuál es
 * —sesión caducada, por ejemplo— se para aquí con un mensaje que se entienda,
 * en vez de intentar la subida y recibir un «no autorizado» de Supabase que
 * no dice nada.
 */
async function carpeta(): Promise<string> {
  const id = await hermandadActualId()
  if (!id) {
    throw new Error(
      'No se ha podido saber a qué hermandad pertenece esta sesión, así que ' +
        'el archivo no se ha guardado. Vuelve a iniciar sesión e inténtalo otra vez.',
    )
  }
  return id
}

/** La ruta completa de un adjunto dentro del cubo. */
async function ruta(id: string): Promise<string> {
  return `${await carpeta()}/${id}`
}

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function guardarArchivo(id: string, file: File): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(await ruta(id), file, { upsert: true, contentType: file.type || undefined })
    if (error) throw error
    return
  }

  const db = await abrirDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(file, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function leerArchivo(id: string): Promise<File | Blob | undefined> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.storage.from(BUCKET).download(await ruta(id))
    if (error || !data) return undefined
    return data
  }

  const db = await abrirDb()
  const resultado = await new Promise<File | Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve(req.result as File | Blob | undefined)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return resultado
}

export async function borrarArchivo(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.storage.from(BUCKET).remove([await ruta(id)])
    if (error) throw error
    return
  }

  const db = await abrirDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/** Todos los archivos guardados, con su id, para copias de seguridad. */
export async function todosLosArchivos(): Promise<{ id: string; blob: File | Blob }[]> {
  if (isSupabaseConfigured && supabase) {
    const cliente = supabase
    const dir = await carpeta()
    // `list(dir)` devuelve los nombres SIN la carpeta delante, así que el id
    // que sale de aquí es el mismo de siempre y las copias de seguridad
    // hechas antes de repartir por carpetas se siguen restaurando igual.
    const { data: lista, error } = await cliente.storage.from(BUCKET).list(dir)
    if (error || !lista) return []
    const resultados = await Promise.all(
      lista.map(async (obj) => {
        const { data } = await cliente.storage.from(BUCKET).download(`${dir}/${obj.name}`)
        return data ? { id: obj.name, blob: data } : null
      }),
    )
    return resultados.filter((r): r is { id: string; blob: Blob } => r !== null)
  }

  const db = await abrirDb()
  const resultado = await new Promise<{ id: string; blob: File | Blob }[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const keysReq = store.getAllKeys()
    keysReq.onsuccess = () => {
      const claves = keysReq.result as string[]
      const valsReq = store.getAll()
      valsReq.onsuccess = () => {
        const vals = valsReq.result as (File | Blob)[]
        resolve(claves.map((id, i) => ({ id, blob: vals[i] })))
      }
      valsReq.onerror = () => reject(valsReq.error)
    }
    keysReq.onerror = () => reject(keysReq.error)
  })
  db.close()
  return resultado
}

/** Borra todos los archivos guardados (al restaurar una copia). */
export async function borrarTodosLosArchivos(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const dir = await carpeta()
    const { data: lista, error } = await supabase.storage.from(BUCKET).list(dir)
    if (error || !lista || lista.length === 0) return
    await supabase.storage.from(BUCKET).remove(lista.map((o) => `${dir}/${o.name}`))
    return
  }

  const db = await abrirDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/** Tamaño legible (KB/MB) para mostrar junto al nombre del archivo. */
export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
