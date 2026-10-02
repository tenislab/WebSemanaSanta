/**
 * LOS FILTROS DICEN CUÁL ESTÁ PUESTO, Y NO SOLO CON EL COLOR.
 *
 * De los treinta y nueve botones que se pintan con `chip--active`, treinta y
 * cuatro no llevaban `aria-pressed` ni `aria-current`: el único sitio donde
 * constaba qué filtro estaba aplicado era el tono del fondo. Quien use un
 * lector de pantalla no se enteraba, y quien no distinga bien los colores
 * tampoco.
 *
 * Cinco sí lo llevaban, así que el patrón bueno también estaba escrito en casa.
 *
 * `aria-pressed` y no `aria-current`: un chip es un botón de dos estados
 * —puesto o no puesto—, mientras que `aria-current` es para «el sitio en el que
 * estás» de una navegación. El paginador sí usa `aria-current`, que ahí es lo
 * correcto.
 */
export default async function ({ caso }) {
  const { readFile, readdir } = await import('node:fs/promises')

  const ficheros = []
  const pilas = ['src']
  while (pilas.length) {
    const d = pilas.pop()
    for (const e of await readdir(d, { withFileTypes: true })) {
      const ruta = `${d}/${e.name}`
      if (e.isDirectory()) pilas.push(ruta)
      else if (/\.tsx$/.test(e.name)) ficheros.push(ruta)
    }
  }

  const mudos = []
  let total = 0
  for (const ruta of ficheros.sort()) {
    const txt = await readFile(ruta, 'utf8')
    let i = 0
    while (true) {
      const j = txt.indexOf('<button', i)
      if (j < 0) break
      // El elemento hasta su `>`, contando llaves: un `className={`…`}` lleva
      // dentro llaves y un `>` puede caer en medio de una expresión.
      let fin = txt.indexOf('>', j)
      while (fin > 0 && (txt.slice(j, fin).split('{').length !== txt.slice(j, fin).split('}').length)) {
        fin = txt.indexOf('>', fin + 1)
      }
      if (fin < 0) break
      const el = txt.slice(j, fin + 1)
      i = fin + 1
      if (!el.includes('chip--active')) continue
      total += 1
      if (/aria-pressed|aria-current/.test(el)) continue
      mudos.push(`${ruta}:${txt.slice(0, j).split('\n').length}`)
    }
  }

  // Que se hayan encontrado: con cero chips, la lista vacía de abajo saldría
  // verde sin haber mirado nada.
  caso('se encuentran los chips de filtro', true, total >= 35)
  caso('ninguno dice su estado solo con el color', [], mudos)
}
