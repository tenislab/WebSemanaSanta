/**
 * TRAER UNA TABLA ENTERA, Y NO LAS PRIMERAS MIL FILAS.
 *
 * `select('*')` NO devuelve toda la tabla. PostgREST —el servidor de Supabase—
 * trae como mucho las que diga su ajuste «Max rows», que viene puesto en 1.000.
 * Y no avisa: la respuesta llega correcta, sin error, con mil filas.
 *
 * Con doce hermanos da igual. Con los de una hermandad de verdad:
 *
 *   · el censo de mil doscientos se enseñaba con mil, sin nada que lo delatara;
 *   · tres ejercicios de recibos son tres mil largos, y los totales de Cuotas
 *     salían cortos;
 *   · y LA COPIA DE SEGURIDAD se subía cada semana con el censo cortado a mil
 *     y con la marca de estar completa. `crearCopia` apunta en `fallos` lo que
 *     no ha podido traer y la copia automática se niega a subir una copia con
 *     fallos — pero aquí no hay fallo, la consulta ha ido bien. Es la copia que
 *     miente, que es la única que hace daño: se descubre el día que hay que
 *     restaurarla.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/paginado.ts')
  caso('la página es de mil, que es el tope de Supabase', 1000, m.FILAS_POR_PAGINA)

  /** Una tabla de mentira que se comporta como PostgREST: recorta y no avisa. */
  const tabla = (cuantas) => {
    const filas = Array.from({ length: cuantas }, (_, i) => ({ id: i }))
    const peticiones = []
    return {
      peticiones,
      consulta: (desde, hasta) => {
        peticiones.push([desde, hasta])
        // El tope del servidor manda aunque se pida un rango mayor.
        const tope = Math.min(hasta - desde + 1, m.FILAS_POR_PAGINA)
        return Promise.resolve({ data: filas.slice(desde, desde + tope), error: null })
      },
    }
  }

  // --- Lo que cabe en una página cuesta lo mismo que antes: una petición.
  const corta = tabla(12)
  const r1 = await m.traerTodasLasFilas(corta.consulta)
  caso('una tabla corta viene entera', 12, r1.data.length)
  caso('y en una sola petición', 1, corta.peticiones.length)

  // --- El caso de la captura: mil doscientos hermanos.
  const censo = tabla(1200)
  const r2 = await m.traerTodasLasFilas(censo.consulta)
  caso('mil doscientos vienen los mil doscientos', 1200, r2.data.length)
  caso('en dos peticiones', 2, censo.peticiones.length)
  caso('sin repetir ninguno', 1200, new Set(r2.data.map((x) => x.id)).size)
  caso('y sin saltarse ninguno', true, r2.data.every((x, i) => x.id === i))

  // --- Justo mil: la página viene llena y hay que pedir la siguiente para
  // saber que no hay más. Es el caso que se olvida siempre.
  const justas = tabla(1000)
  const r3 = await m.traerTodasLasFilas(justas.consulta)
  caso('con mil justas no se pierde ninguna', 1000, r3.data.length)
  caso('y se comprueba que no hay más', 2, justas.peticiones.length)

  // --- Tres ejercicios de recibos.
  const recibos = tabla(3600)
  const r4 = await m.traerTodasLasFilas(recibos.consulta)
  caso('tres mil seiscientos recibos vienen enteros', 3600, r4.data.length)
  caso('en cuatro peticiones', 4, recibos.peticiones.length)

  // --- Vacía.
  const nada = tabla(0)
  const r5 = await m.traerTodasLasFilas(nada.consulta)
  caso('una tabla vacía no rompe', 0, r5.data.length)

  /*
   * --- UN ERROR A MEDIA TABLA NO DEVUELVE MEDIA TABLA ---
   * Media tabla es peor que nada: quien la recibe la trata como si estuviera
   * entera. En la copia de seguridad, eso es exactamente la copia que miente.
   */
  let vueltas = 0
  const rota = await m.traerTodasLasFilas((desde) => {
    vueltas += 1
    if (vueltas === 2) return Promise.resolve({ data: null, error: { message: 'se cayó' } })
    return Promise.resolve({ data: Array.from({ length: 1000 }, (_, i) => ({ id: desde + i })), error: null })
  })
  caso('si falla una página no se devuelven las otras', null, rota.data)
  caso('y se dice el motivo', 'se cayó', rota.error.message)

  await dondeSePide({ caso })
}

/**
 * Y que se pida por páginas EN LOS TRES SITIOS que traen tablas enteras.
 *
 * Basta con que uno se quede sin paginar para que vuelva el fallo, y solo en
 * ese sitio: el censo bien en Hermanos y cortado en la copia, o al revés.
 */
async function dondeSePide({ caso }) {
  const { readFile } = await import('node:fs/promises')

  for (const [fichero, quien] of [
    ['src/lib/supabaseSync.ts', 'los módulos (censo, cuotas, tesorería…)'],
    ['src/lib/db/catalogos.ts', 'los catálogos'],
    ['src/lib/backup.ts', 'la copia de seguridad'],
  ]) {
    const src = await readFile(fichero, 'utf8')
    caso(`${quien} pide por páginas`, true, /traerTodasLasFilas/.test(src))
    // Ni un `select('*')` suelto, que es el que trae mil y calla.
    const sueltos = [...src.matchAll(/\.select\('\*'\)(?![\s\S]{0,160}?\.range\()/g)]
    caso(`${quien} no deja ningún select suelto`, 0, sueltos.length)
  }

  /*
   * --- Y LAS DEMÁS LECTURAS QUE PUEDEN PASARSE DE MIL ---
   *
   * No son solo las tablas de los módulos. Estas cinco leen listas que crecen
   * solas, y cada una se rompía a su manera:
   */
  for (const [fichero, quien] of [
    ['src/lib/rgpd.ts', 'el censo que se relee tras un borrado RGPD'],
    ['src/lib/avisosHermano.ts', 'las preferencias de avisos (una por hermano)'],
    ['src/lib/suscriptoresWeb.ts', 'los suscriptores, de donde sale el boletín'],
    ['src/lib/visitas.ts', 'las visitas (una fila por día y ruta)'],
    ['src/lib/mensajesWeb.ts', 'el buzón de la web'],
    ['src/lib/solicitudes.ts', 'las solicitudes de alta'],
  ]) {
    const src = await readFile(fichero, 'utf8')
    caso(`${quien}, por páginas`, true, /traerTodasLasFilas/.test(src))
  }

  /*
   * Y CON ORDEN ESTABLE donde la columna puede empatar. Dos altas del mismo
   * instante, o dos rutas del mismo día, empatan; y un empate hace que dos
   * páginas traigan la misma fila y se salten otra, que es peor que cortar,
   * porque el total cuadra y los datos no.
   */
  const susc = await readFile('src/lib/suscriptoresWeb.ts', 'utf8')
  caso('los suscriptores desempatan por id', true, /\.order\('alta_en'[\s\S]{0,40}\.order\('id'\)/.test(susc))
  const vis = await readFile('src/lib/visitas.ts', 'utf8')
  caso('las visitas desempatan por ruta', true, /\.order\('dia'\)\s*\n\s*\.order\('ruta'\)/.test(vis))

  /*
   * --- Y LA TRAMPA DEL ARREGLO ---
   *
   * Ordenar hace falta: sin `order`, dos páginas pueden traer filas repetidas
   * y saltarse otras. Pero DOS TABLAS DE LA COPIA NO TIENEN COLUMNA `id`:
   * `permisos_cargo` va por (hermandad_id, cargo, modulo_id) y `catalogos` por
   * (clave, valor). Pedirles `order('id')` da error, y en la copia un error se
   * apunta como fallo — y la copia automática se niega a subir una copia con
   * fallos. Ordenar por `id` a ciegas dejaría a la hermandad SIN NINGUNA
   * COPIA, cada semana y en silencio, por arreglar lo de las mil filas.
   */
  const backup = await readFile('src/lib/backup.ts', 'utf8')
  const sql = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  const tablas = [...backup.matchAll(/'([a-z_]+)',/g)].map((x) => x[1])
  const enLaCopia = tablas.filter((t) => new RegExp(`create table if not exists ${t} \\(`).test(sql))
  caso('se han encontrado las tablas de la copia', true, enLaCopia.length >= 15)

  const sinId = enLaCopia.filter((t) => {
    const def = sql.match(new RegExp(`create table if not exists ${t} \\(([\\s\\S]*?)\\n\\);`))
    return def ? !/^\s*id\s/m.test(def[1]) : false
  })
  /*
   * Son TRES, y la tercera la encontró esta misma prueba: `cuentas_sociales`
   * va por la red («Facebook», «Instagram»…). Se me había pasado, y sin esto
   * la copia habría fallado en esa tabla todas las semanas.
   */
  caso('hay tablas sin columna id, y son las conocidas',
    'catalogos, cuentas_sociales, permisos_cargo', sinId.sort().join(', '))
  // Y cada una tiene dicho por qué columna se ordena.
  for (const t of sinId) {
    caso(`«${t}» tiene su columna de orden`, true, new RegExp(`${t}: '`).test(backup))
  }

  /*
   * --- Y EL OTRO SITIO DONDE SE ORDENA POR `id` A CIEGAS ---
   *
   * `useSupabaseTable` pagina ordenando por `id` cuando quien llama no pide
   * otro orden. Vale para las diez tablas de hoy, pero si mañana se monta el
   * hook sobre una que no tenga `id` —como `permisos_cargo` o `catalogos`— ese
   * módulo entero dejaría de cargar, con la pantalla en blanco y tirando de la
   * copia del navegador.
   */
  const pantallas = await Promise.all(
    ['Hermanos', 'Cuotas', 'Papeletas', 'Tesoreria', 'Inventario', 'Archivo', 'Comunicados', 'Eventos', 'Personal', 'Cortejo']
      .map((n) => readFile(`src/pages/app/${n}.tsx`, 'utf8').catch(() => '')),
  )
  const conElHook = new Set()
  for (const src of pantallas) {
    for (const m of src.matchAll(/useSupabaseTable<[^>]+>\(\s*\n?\s*'([a-z_]+)'/g)) conElHook.add(m[1])
  }
  caso('se han encontrado las tablas del hook', true, conElHook.size >= 8)
  const sinIdEnElHook = [...conElHook].filter((t) => {
    const def = sql.match(new RegExp(`create table if not exists ${t} \\(([\\s\\S]*?)\\n\\);`))
    return def ? !/^\s*id\s/m.test(def[1]) : false
  })
  caso('todas las tablas del hook tienen columna id', '', sinIdEnElHook.sort().join(', '))
}
