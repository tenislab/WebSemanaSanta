/**
 * QUE LA APLICACIÓN NO ESCRIBA COLUMNAS QUE LA BASE NO TIENE.
 *
 * EL DESTROZO. `tramoToRow` llevaba escribiendo `hora_citacion` en cada
 * guardado de tramo, y esa columna NO EXISTÍA en ningún `.sql`. Postgres
 * rechaza la sentencia ENTERA cuando una columna no existe:
 *
 *     column "hora_citacion" of relation "tramos" does not exist
 *
 * Así que NINGÚN TRAMO SE GUARDABA NUNCA. Ni al crear ni al editar.
 *
 * Y esto es lo peor: no se veía. La pantalla pintaba el tramo recién creado
 * —el estado de React ya lo tenía— y todo parecía correcto. Solo al recargar
 * aparecía Cortejo con «0/0 puestos cubiertos» y «No hay tramos que coincidan
 * con la búsqueda». Sin tramos no hay cortejo, y sin cortejo las papeletas no
 * se pueden asignar a ningún sitio. De una palabra colgaba la mitad de la
 * Semana Santa de la hermandad.
 *
 * No lo cazaba nada: los tipos de TypeScript son correctos (el objeto es un
 * `Record<string, unknown>`, ahí cabe cualquier cosa), el `build` no mira el
 * SQL, y en modo demostración no hay base de datos que se queje — se guarda en
 * el navegador y funciona. Solo fallaba con Supabase conectado, en producción.
 *
 * Esta prueba compara, columna a columna, lo que cada `xxxToRow` escribe con
 * lo que TODO-EN-UNO.sql crea de verdad.
 */
export default async function ({ caso }) {
  const { readFile, readdir } = await import('node:fs/promises')

  /* 1. Lo que la base TIENE. Se lee de TODO-EN-UNO.sql y no de los ficheros
        sueltos porque es el que se pega en Supabase: si una columna solo está
        en un fichero que se quedó fuera del generador, en la base no está. */
  const sql = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  const tablas = new Map()
  const TIPOS = 'uuid|text|int|integer|boolean|numeric|jsonb|timestamptz|date|bigint|serial'
  for (const m of sql.matchAll(/create table if not exists (\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const cols = new Set()
    for (const linea of m[2].split('\n')) {
      const c = linea.trim().match(new RegExp(`^([a-z_][a-z0-9_]*)\\s+(?:${TIPOS})`, 'i'))
      if (c && !['primary', 'unique', 'check', 'constraint', 'foreign'].includes(c[1])) cols.add(c[1])
    }
    tablas.set(m[1], cols)
  }
  // Las columnas que se añaden después, que son muchas: el esquema ha crecido
  // por `alter table` para no romper las bases que ya existían.
  for (const m of sql.matchAll(/alter table (?:only )?(\w+)\s+add column if not exists\s+([a-z_][a-z0-9_]*)/gi)) {
    if (!tablas.has(m[1])) tablas.set(m[1], new Set())
    tablas.get(m[1]).add(m[2].toLowerCase())
  }
  // `hermandad_id` se la pone multi-hermandad.sql a todas en un bucle.
  for (const s of tablas.values()) s.add('hermandad_id')

  caso('se han leído las tablas del SQL', true, tablas.size >= 15)
  caso('y sus columnas', true, (tablas.get('hermanos')?.size ?? 0) >= 20)

  /* 2. Lo que la aplicación ESCRIBE.
   *
   * OJO CON EL ALCANCE. Esto miraba solo `src/lib/db/` y solo funciones con
   * `export`, y por esas dos rendijas se coló el fallo que dejó sin funcionar
   * las solicitudes de alta durante días: `solicitudToRow` vive en
   * `src/lib/solicitudes.ts` y no se exporta, así que era invisible por
   * partida doble. Escribía `tutor_id` y `fecha_nacimiento`, columnas que la
   * tabla no tenía, y Postgres rechazaba el INSERT entero.
   *
   * Se mira TODO `src/lib`, exportadas o no. Un mapeo no vigilado no es un
   * mapeo más seguro: es el sitio donde se esconde el siguiente. */
  const ficheros = [
    ...(await readdir('src/lib/db')).filter((f) => f.endsWith('.ts')).map((f) => `src/lib/db/${f}`),
    ...(await readdir('src/lib')).filter((f) => f.endsWith('.ts')).map((f) => `src/lib/${f}`),
  ]
  caso('hay mapeos que comprobar', true, ficheros.length >= 10)

  let comprobadas = 0
  const vistas = []
  for (const f of ficheros) {
    const src = await readFile(f, 'utf8')
    for (const m of src.matchAll(/(?:export )?function (\w*[Tt]oRow)\s*\([^)]*\)[^{]*\{\s*return\s*\{([\s\S]*?)\n  \}/g)) {
      const cuerpo = m[2].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      const escritas = [...cuerpo.matchAll(/^\s{4}([a-z_][a-z0-9_]*)\s*:/gm)].map((x) => x[1])
      if (!escritas.length) continue
      const base = f.split('/').pop().replace('.ts', '')
      // Los que no se llaman como su tabla. El resto se adivina por el nombre
      // del fichero, que es la costumbre en `src/lib/db`.
      const ALIAS = {
        solicitudToRow: 'solicitudes_alta',
        mensajeToRow: 'mensajes_web',
        settingsToRow: 'hermandad_settings',
      }
      const tabla = ALIAS[m[1]] ?? [...tablas.keys()]
        .filter((t) => t === base || t === `${base}s` || base.startsWith(t))
        .sort((a, b) => b.length - a.length)[0]
      vistas.push(m[1])
      caso(`${m[1]} apunta a una tabla conocida`, true, Boolean(tabla))
      if (!tabla) continue
      const tiene = tablas.get(tabla)
      const faltan = escritas.filter((c) => !tiene.has(c))
      // El texto del fallo dice QUÉ columna falta y en qué tabla: sin eso, el
      // aviso obliga a buscar a mano entre veinte ficheros.
      caso(`${m[1]} → la tabla "${tabla}" tiene todas sus columnas`, '', faltan.join(', '))
      comprobadas++
    }
  }
  caso('se ha comprobado cada mapeo', true, comprobadas >= 10)

  /*
   * Y QUE NO SE SALTE NINGUNA EN SILENCIO.
   *
   * Esto es la lección de verdad. La prueba no fallaba: es que ni miraba.
   * `solicitudToRow` no entraba porque estaba fuera de la carpeta, y
   * `cuentaToRow` no entra porque no devuelve un objeto literal —lo va
   * montando campo a campo— y el patrón no sabe leerlo.
   *
   * Saltarse una en silencio es peor que no tener la prueba, porque el verde
   * dice «mirado» cuando quiere decir «no he sabido». Así que se cuentan las
   * que hay y las que se han leído: si no cuadra, salta.
   *
   * `cuentaToRow` se apunta aparte, con su motivo. Escribe dos columnas fijas
   * (`conectada`, `usuario`) sobre `cuentas_sociales`, comprobadas a mano. Si
   * alguien la cambia para devolver un literal, entrará sola y esta lista se
   * queda corta — que también salta.
   */
  const NO_LEGIBLES = ['cuentaToRow']
  let declaradas = 0
  for (const f of ficheros) {
    const src = await readFile(f, 'utf8')
    for (const m of src.matchAll(/(?:export )?function (\w*[Tt]oRow)\s*\(/g)) {
      declaradas++
      const conocida = vistas.includes(m[1]) || NO_LEGIBLES.includes(m[1])
      caso(`${m[1]} no se cuela sin mirar`, true, conocida)
    }
  }
  caso('se han visto todas las que hay', declaradas, vistas.length + NO_LEGIBLES.length)
  // Los tres que viven fuera de `src/lib/db` y antes no se miraban. Si alguien
  // los mueve o los renombra, que salte aquí y no en producción.
  for (const n of ['solicitudToRow', 'mensajeToRow', 'settingsToRow']) {
    caso(`se vigila ${n}`, true, vistas.includes(n))
  }

  await guardadoDeLaHermandad({ caso })
  await guardadosQueSeVen({ caso })
}

/**
 * Y LO QUE SE GUARDA SOLO EN EL NAVEGADOR, cuando no debería.
 *
 * Es la misma familia de fallo que la columna que faltaba, vista del otro
 * lado: la pantalla dice que ha guardado, y ha guardado — pero en un sitio
 * que solo existe en ese ordenador.
 *
 * Los tres casos que ya costaron caro: el modelo de papeleta y la hoja de
 * asistencia (se borraban al cerrar sesión), los ajustes de cuotas y el
 * catálogo de etiquetas. Los dos últimos eran los peores, porque no se perdían
 * — simplemente no valían desde otro ordenador, y nadie tiene por qué
 * sospecharlo.
 */
async function guardadoDeLaHermandad({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')

  // Cada ajuste de la hermandad tiene su columna.
  for (const col of ['modelo_papeleta', 'modelo_recibo', 'asistencia', 'ajustes_cuotas', 'etiquetas']) {
    caso(`hermandad_settings.${col} existe`, true,
      new RegExp(`alter table hermandad_settings add column if not exists ${col} jsonb`).test(sql))
  }

  // Y la aplicación los manda ahí, no solo al navegador.
  const ajustes = await readFile('src/lib/ajustesCuotas.ts', 'utf8')
  caso('los ajustes de cuotas van a la base', true, /guardarPlantilla\('ajustes_cuotas'/.test(ajustes))
  caso('y se traen al abrir', true, /traerPlantilla<AjustesCuotas>\('ajustes_cuotas'\)/.test(ajustes))

  const etiq = await readFile('src/lib/etiquetas.ts', 'utf8')
  caso('las etiquetas van a la base', true, /guardarPlantilla\('etiquetas'/.test(etiq))
  caso('y se traen al abrir', true, /traerPlantilla<string\[\]>\('etiquetas'\)/.test(etiq))

  // El tipo que las gobierna las conoce a todas: si alguien añade una columna
  // y se olvida de aquí, no compila.
  const plant = await readFile('src/lib/plantillasHermandad.ts', 'utf8')
  for (const col of ['modelo_papeleta', 'modelo_recibo', 'asistencia', 'ajustes_cuotas', 'etiquetas']) {
    caso(`PlantillaGuardable incluye ${col}`, true, plant.includes(`'${col}'`))
  }
}

/**
 * QUE UN GUARDADO QUE FALLA SE VEA.
 *
 * `supabase-js` NO lanza excepción cuando la base rechaza la operación: la
 * columna que no existe, la política que no deja escribir, la restricción
 * incumplida… todo eso vuelve como `{ error }` dentro de la respuesta, no
 * como una excepción. Un `try/catch` alrededor no se entera de nada.
 *
 * Ahí estuvo el fallo de los tramos: llevaban sin guardarse desde siempre y en
 * pantalla salía el visto bueno verde de «Tramos guardados».
 */
async function guardadosQueSeVen({ caso }) {
  const { readFile } = await import('node:fs/promises')

  // Los cuatro sitios que escriben en Supabase por su cuenta, fuera del
  // espejo genérico. Todos tienen que mirar el error y avisar por la banda.
  const sitios = [
    ['src/lib/tramos.ts', 'tramos'],
    ['src/lib/solicitudes.ts', 'solicitudes de alta'],
    ['src/lib/db/catalogos.ts', 'catálogos'],
    ['src/lib/supabaseSync.ts', 'el espejo de las tablas'],
  ]
  for (const [f, que] of sitios) {
    const src = await readFile(f, 'utf8')
    caso(`${que}: se mira el error al escribir`, true, /const \{ error(?::| )/.test(src))
    caso(`${que}: y se avisa a quien está delante`, true, /cabildo-sync-error/.test(src))
  }

  // El visto bueno verde SOLO si de verdad se ha guardado. Un visto bueno que
  // sale pase lo que pase no informa: engaña.
  const conf = await readFile('src/pages/app/Configuracion.tsx', 'utf8')
  caso('el verde de los tramos depende del resultado', true,
    /if \(!r\.ok\) \{[\s\S]{0,260}setTramosSaved\(false\)/.test(conf))
  caso('y el fallo se pinta', true, /tramosError && <span/.test(conf))

  /*
   * Y QUE EL AVISO DIGA POR QUÉ.
   *
   * El aviso rojo decía «no se ha podido guardar (papeletas)» y se quedaba
   * ahí. El mensaje de Postgres —el que dice qué columna falta o qué
   * referencia no existe— se iba a la consola, donde no mira nadie. Costó tres
   * rondas de preguntas averiguar algo que la propia pantalla ya sabía.
   */
  const shell = await readFile('src/components/AppShell.tsx', 'utf8')
  caso('el aviso recoge el motivo, no solo la tabla', true, /fallos\?: string\[\]/.test(shell))
  caso('y lo guarda para enseñarlo', true, /setDetalleSync/.test(shell))
  caso('y lo pinta donde se pueda copiar', true, /<pre>\{detalleSync\}<\/pre>/.test(shell))
  // Plegado: quien lleva la hermandad no tiene por qué leer un error de
  // Postgres, pero tiene que poder abrirlo y copiarlo si le piden ayuda.
  caso('plegado, no en la cara', true, /<details className="sync-error-detalle">/.test(shell))

  /*
   * LOS QUE BORRAN ANTES DE INSERTAR son los peores de todos: si el alta falla
   * y nadie mira, no es que no se guarde lo nuevo — es que además desaparece
   * lo que había. Y por ahí pasa la LISTA DE PRECIOS de la hermandad: los
   * conceptos de cuota con su importe y los tipos de papeleta con el suyo.
   */
  const cat = await readFile('src/lib/db/catalogos.ts', 'utf8')
  for (const fn of ['reemplazarCatalogo', 'reemplazarTablaCompleta']) {
    const trozo = cat.slice(cat.indexOf(`export async function ${fn}`)).slice(0, 1400)
    caso(`${fn} comprueba el borrado antes de seguir`, true,
      /const \{ error: borrando \}[\s\S]{0,220}return \{ ok: false/.test(trozo))
    caso(`${fn} comprueba el alta`, true, /const \{ error \}[\s\S]{0,220}return \{ ok: false/.test(trozo))
  }

  // Y quien los llama se entera: nada de visto bueno verde por defecto.
  for (const [f, quien] of [
    ['src/lib/conceptosCuota.ts', 'los conceptos de cuota'],
    ['src/lib/opcionesPapeleta.ts', 'los tipos de papeleta'],
    ['src/lib/catalogos.ts', 'los catálogos'],
  ]) {
    const src = await readFile(f, 'utf8')
    caso(`${quien}: se devuelve si ha ido bien`, true, /Promise<\{ ok: boolean; error\?: string \}>/.test(src))
  }
  caso('el verde de los catálogos depende del resultado', true,
    /if \(fallos\.length > 0\) \{[\s\S]{0,200}setCatalogosSaved\(false\)/.test(conf))
  caso('y el de los tipos de papeleta', true,
    /if \(!r\.ok\) \{[\s\S]{0,220}setOpcionesSaved\(false\)/.test(conf))
}
