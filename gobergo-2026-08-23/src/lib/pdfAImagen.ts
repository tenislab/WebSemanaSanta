import * as pdfjsLib from 'pdfjs-dist'
// El worker se empaqueta con Vite y se referencia por URL.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Convierte la PRIMERA página de un PDF en una imagen (data URL JPEG), para
 * poder usar un PDF como modelo de papeleta o de recibo: se rasteriza la página
 * y luego se colocan los datos encima igual que con una imagen normal.
 */
export async function pdfPrimeraPaginaAImagen(file: File, maxAncho = 1400): Promise<string> {
  const datos = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: datos }).promise
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const escala = Math.min(2, maxAncho / base.width)
  const viewport = page.getViewport({ scale: escala })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el lienzo para el PDF')

  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.85)
}
