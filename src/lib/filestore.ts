/**
 * Almacén de archivos adjuntos del Archivo documental: el PDF/imagen de cada
 * documento. En modo demostración vive en IndexedDB (solo en este
 * navegador). Con Supabase conectado, vive en Supabase Storage (bucket
 * `documentos`), compartido por toda la hermandad. Los componentes usan
 * siempre las mismas funciones; el modo se decide aquí según
 * `isSupabaseConfigured`.
 */
import { isSupabaseConfigured, supabase } from './supabase'

const DB_NAME = 'cabildo-files'
const STORE_NAME = 'documentos'
const DB_VERSION = 1
const BUCKET = 'documentos'

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
      .upload(id, file, { upsert: true, contentType: file.type || undefined })
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
    const { data, error } = await supabase.storage.from(BUCKET).download(id)
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
    const { error } = await supabase.storage.from(BUCKET).remove([id])
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
    const { data: lista, error } = await cliente.storage.from(BUCKET).list()
    if (error || !lista) return []
    const resultados = await Promise.all(
      lista.map(async (obj) => {
        const { data } = await cliente.storage.from(BUCKET).download(obj.name)
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
    const { data: lista, error } = await supabase.storage.from(BUCKET).list()
    if (error || !lista || lista.length === 0) return
    await supabase.storage.from(BUCKET).remove(lista.map((o) => o.name))
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
