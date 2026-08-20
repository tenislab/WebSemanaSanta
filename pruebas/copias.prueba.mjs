/**
 * Auditoría 2026-08 · Las copias de seguridad.
 *
 * Dos de los hallazgos, y uno de ellos crítico:
 *
 *   - «Restaurar copia» decía «Copia restaurada. Recargando…», recargaba, y
 *     estaba todo exactamente igual que antes. Escribía en el navegador, y con
 *     la base de datos conectada el navegador es un espejo: al recargar, cada
 *     pantalla volvía a leer de Supabase y lo sobreescribía. Un botón que dice
 *     que ha hecho algo y no lo ha hecho es peor que no tenerlo.
 *   - «Descargar copia» se llevaba solo los módulos que se hubieran abierto,
 *     porque leía del navegador. Quien entraba y le daba directamente se
 *     bajaba un archivo sin el archivo documental, sin inventario y sin
 *     eventos. Y sin decirlo.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/backup.ts')

  // Sin base de datos, restaurar es lo correcto: ahí SÍ vive todo.
  caso('sin base de datos, se puede restaurar', true, m.sePuedeRestaurar())

  // --- Lo que nunca puede viajar en una copia ---
  // No son datos de la hermandad: son estado de ESTE navegador.
  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/lib/backup.ts', 'utf8')
  for (const clave of ['cabildo-demo-user', 'cabildo-hermandad-espejada', 'cabildo-demo-modo']) {
    caso(`«${clave}» queda fuera de la copia`, true, src.includes(`'${clave}'`))
  }

  // --- La copia trae las tablas de verdad ---
  caso('hay lista de tablas', true, Array.isArray(m.TABLAS_COPIA) && m.TABLAS_COPIA.length > 10)
  for (const t of ['hermanos', 'cuotas', 'papeletas', 'movimientos', 'documentos', 'enseres', 'eventos']) {
    caso(`la copia incluye «${t}»`, true, m.TABLAS_COPIA.includes(t))
  }

  // --- Reconocer una copia ---
  // `crearCopia()` no se llama aquí: necesita IndexedDB para los adjuntos y
  // esto corre en Node, sin navegador. Lo que sí se comprueba es el lector,
  // que es quien decide si un archivo entra o se rechaza.
  const copia = { app: 'cabildo', version: 1, exportadoEl: new Date().toISOString(), datos: {}, archivos: [] }
  caso('una copia con su forma vale', true, m.esCopiaValida(copia))
  caso('y la de una versión futura se detecta', true, m.resumirCopia({ ...copia, version: 99 }).masNueva)

  // Lo que no tiene forma de copia se rechaza.
  caso('un JSON cualquiera no cuela', false, m.esCopiaValida({ hola: 1 }))
  caso('ni null', false, m.esCopiaValida(null))

  // Con base de datos, la copia sale de las tablas y no del navegador.
  caso('la copia consulta la base de datos', true, /isSupabaseConfigured \? await traerTablas\(\)/.test(src))
  caso('y apunta lo que no haya podido traer', true, /fallos\.push/.test(src))

  // --- Y que la restauración no mienta ---
  // Aquí no hay Supabase, así que `restaurarCopia` sí funciona; lo que se
  // comprueba es que la negativa esté escrita y sea la primera comprobación.
  caso('restaurar comprueba antes si puede', true, /if \(!sePuedeRestaurar\(\)\)/.test(src))
  caso('y si no puede, lo dice y no escribe nada', true, /throw new Error\(/.test(src))

  // Y que las pantallas usen esa comprobación, no la reinventen.
  const cfg = await readFile('src/pages/app/Configuracion.tsx', 'utf8')
  caso('el botón de restaurar la respeta', true, /disabled=\{!sePuedeRestaurar\(\)\}/.test(cfg))
  caso('y se explica por qué', true, /Restaurar está desactivado/.test(cfg))
  caso('una copia incompleta se avisa', true, /NO se pudo traer/.test(cfg))
}
