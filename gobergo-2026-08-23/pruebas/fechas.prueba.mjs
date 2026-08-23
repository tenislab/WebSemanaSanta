/**
 * LA FECHA DE HOY, EN HORA DE AQUÍ.
 *
 * `new Date().toISOString().slice(0, 10)` es la forma corta de escribir la
 * fecha de hoy, y está MAL en España: convierte a UTC, y aquí vamos una hora
 * por delante en invierno y dos en verano. Entre las 00:00 y la 01:00 —o las
 * 02:00 en horario de verano— devuelve EL DÍA ANTERIOR.
 *
 * Parece una minucia hasta que se mira dónde caía:
 *
 * - En Tesorería era la fecha con la que venía rellenado un apunte nuevo. Un
 *   ingreso metido a las 00:30 del día 1 se fechaba el último día del mes
 *   anterior: se iba al balance de un mes ya cerrado. Y el 1 de enero, al
 *   ejercicio anterior.
 * - En Comunicados, un aviso mandado de madrugada figuraba enviado el día
 *   antes de existir.
 * - En el Archivo, un acta subida después de un cabildo que acabó tarde
 *   quedaba fechada el día del cabildo anterior.
 *
 * Y no es un caso raro: en una hermandad se trabaja de noche. Los cabildos
 * acaban tarde, la madrugada del Viernes Santo es literalmente de madrugada, y
 * en marzo se cierra la papeleta a las tantas.
 */
export default async function ({ caso }) {
  /*
   * Esta prueba se sitúa EN ESPAÑA, que es donde está la hermandad.
   *
   * `hoyIso` usa la hora local de quien tiene el ordenador delante, así que
   * para comprobar el desfase hay que ponerse en su huso. Sin esto, la prueba
   * corre en UTC —donde no hay desfase que valga— y no comprobaría nada.
   *
   * Se devuelve al final: cambiar el huso a medias afectaría a las pruebas que
   * vengan detrás.
   */
  const husoDeAntes = process.env.TZ
  process.env.TZ = 'Europe/Madrid'
  try {
    await comprobar({ caso })
  } finally {
    if (husoDeAntes === undefined) delete process.env.TZ
    else process.env.TZ = husoDeAntes
  }
}

async function comprobar({ caso }) {
  const { build } = await import('esbuild')
  const { tmpdir } = await import('node:os')
  const { mkdtempSync } = await import('node:fs')
  const { join } = await import('node:path')
  const destino = join(mkdtempSync(join(tmpdir(), 'gobergo-hoy-')), 'hoy.mjs')
  await build({
    entryPoints: ['src/lib/hoy.ts'],
    bundle: true, platform: 'node', format: 'esm', outfile: destino, logLevel: 'silent',
  })
  const { hoyIso } = await import(destino)

  // El formato que espera un <input type="date"> y el que guarda la base.
  caso('devuelve el formato de siempre', true, /^\d{4}-\d{2}-\d{2}$/.test(hoyIso()))

  /*
   * EL CASO QUE IMPORTA, con una fecha fija: la medianoche y media del 1 de
   * enero de 2027 en hora española. En UTC eso es todavía el 31 de diciembre
   * de 2026, o sea el año anterior.
   */
  const medianocheDeAquí = new Date('2027-01-01T00:30:00+01:00')
  caso('a las 00:30 del 1 de enero sigue siendo el 1 de enero', '2027-01-01',
    hoyIso(medianocheDeAquí))
  // Y para que se vea la diferencia con lo que hacía antes:
  caso('(así se fechaba antes, en el año anterior)', '2026-12-31',
    medianocheDeAquí.toISOString().slice(0, 10))

  // En horario de verano son dos horas, así que el desfase dura más.
  const veranoDeAquí = new Date('2027-07-01T01:30:00+02:00')
  caso('en verano, a la 01:30 del día 1 sigue siendo el día 1', '2027-07-01',
    hoyIso(veranoDeAquí))

  // Y a media tarde, cuando no hay desfase, da lo mismo que siempre.
  const tarde = new Date('2027-03-15T18:00:00+01:00')
  caso('a media tarde no cambia nada', '2027-03-15', hoyIso(tarde))

  /*
   * Y QUE NO VUELVA A COLARSE. Es una línea muy fácil de escribir de memoria,
   * y el fallo que produce no se ve nunca en pruebas: solo de madrugada.
   */
  const { readdir, readFile } = await import('node:fs/promises')
  const culpables = []
  async function mirar(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const ruta = `${dir}/${e.name}`
      if (e.isDirectory()) { await mirar(ruta); continue }
      if (!/\.(ts|tsx)$/.test(e.name)) continue
      const src = await readFile(ruta, 'utf8')
      // El fichero del ayudante sí la menciona: está explicando el fallo.
      if (ruta.endsWith('/hoy.ts')) continue
      const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      if (/toISOString\(\)\.slice\(0,\s*10\)|toISOString\(\)\.split\('T'\)\[0\]/.test(codigo)) {
        culpables.push(ruta.replace('src/', ''))
      }
    }
  }
  await mirar('src')
  caso('nadie escribe la fecha de hoy en UTC', '', culpables.join(', '))
}
