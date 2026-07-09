/**
 * Almacén de archivos reales en el navegador (IndexedDB), para adjuntar el
 * PDF/imagen de un documento del Archivo sin necesitar backend. Solo guarda
 * los bytes del archivo, indexados por el id del documento; el nombre, tipo
 * y tamaño se guardan junto al resto de metadatos (localStorage), igual que
 * ya se hace con el logo de la hermandad. Cuando conectemos Supabase Storage,
 * esto se sustituye sin que cambie cómo lo consumen los componentes.
 */

const DB_NAME = 'cabildo-files'
const STORE_NAME = 'documentos'
const DB_VERSION = 1

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
  const db = await abrirDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
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
