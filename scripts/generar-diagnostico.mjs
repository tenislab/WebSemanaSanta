/**
 * Genera `supabase/DIAGNOSTICO.sql`: una consulta que dice qué le falta a una
 * base de datos de verdad.
 *
 * POR QUÉ EXISTE. Cuando algo no se guarda, la pregunta siempre es la misma:
 * ¿le falta una columna a esta base? Desde aquí no se puede abrir la base de
 * nadie, así que sin esto toca adivinar — y adivinar costó primero el cortejo
 * entero (`hora_citacion`) y después todas las solicitudes de alta
 * (`tutor_id`). Dos veces el mismo fallo, y las dos a ciegas.
 *
 * La lista de columnas NO se escribe a mano: se saca de las funciones `toRow`,
 * que son las que de verdad escriben. Una lista a mano se queda vieja el día
 * que alguien añade un campo, que es justo el día en que hace falta.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'

const ALIAS = {
  solicitudToRow: 'solicitudes_alta',
  // `reglasAutomaticas.ts` no se llama como su tabla: la heurística mira el
  // nombre del fichero y no puede adivinar el guión bajo.
  reglaToRow: 'reglas_automaticas',
  mensajeToRow: 'mensajes_web',
  settingsToRow: 'hermandad_settings',
  /*
   * ESTOS SIETE HACÍAN QUE EL GENERADOR NI ARRANCARA.
   *
   * Lanza a propósito cuando no sabe a qué tabla escribe un `toRow` —mejor
   * romper que generar un diagnóstico que pregunta por una tabla inventada—, y
   * eso está bien. Lo que no estaba bien es que nadie lo volviera a ejecutar:
   * desde que se añadieron los mandatos SEPA, la tienda, las campañas y los
   * demás, este script se caía en la primera línea y `DIAGNOSTICO.sql` se
   * quedó congelado con las tablas de antes.
   *
   * O sea que el diagnóstico decía «no falta nada» sin haber mirado siquiera
   * siete tablas. Un diagnóstico que se calla lo que no sabe mirar es peor que
   * no tenerlo, porque manda a buscar el problema a otra parte.
   *
   * Ahora `npm test` lo regenera y lo compara, como ya hace con los dos
   * instaladores, así que no se puede volver a quedar atrás.
   */
  mandatoSepaToRow: 'mandatos_sepa',
  // El fichero se llama `recaudaciones` y la tabla `campanas_recaudacion`.
  recaudacionToRow: 'campanas_recaudacion',
  repartoToRow: 'reglas_reparto',
  solicitudPapeletaToRow: 'solicitudes_papeleta',
  tareaRedToRow: 'tareas_redes',
  // `tienda.ts` escribe en DOS tablas distintas, por eso no se puede adivinar.
  productoToRow: 'productos',
  descuentoToRow: 'descuentos',
  // Igual que la tienda: `proyectos.ts` escribe en `proyectos` y en
  // `tareas_proyecto`. Sin esta línea, las columnas de las tareas se
  // comprobaban contra la tabla de los proyectos y el diagnóstico decía que
  // faltaban SEIS columnas en una base que estaba perfecta.
  proyectoToRow: 'proyectos',
  tareaProyectoToRow: 'tareas_proyecto',
  // `comunicados.ts` escribe en `comunicados` y en `cuentas_sociales`.
  comunicadoToRow: 'comunicados',
  cuentaToRow: 'cuentas_sociales',
  /*
   * Y el segundo de `hermanos.ts` NO es otra tabla: es la MISMA, recortada.
   * `contactoDelHermanoToRow` manda solo los tres campos que un hermano puede
   * cambiar de su propia ficha, para que lo que él no puede tocar no viaje
   * siquiera. Sus columnas son un subconjunto de las del otro.
   */
  hermanoToRow: 'hermanos',
  contactoDelHermanoToRow: 'hermanos',
}

// Los nombres de tabla de verdad, sacados del SQL. Adivinarlos a partir del
// nombre del fichero no vale: `personal.ts` no es `personals`.
const sqlTodo = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
const TABLAS = new Set(
  [...sqlTodo.matchAll(/create table if not exists (\w+)/g)].map((m) => m[1]),
)

const ficheros = [
  ...(await readdir('src/lib/db')).filter((f) => f.endsWith('.ts')).map((f) => `src/lib/db/${f}`),
  ...(await readdir('src/lib')).filter((f) => f.endsWith('.ts')).map((f) => `src/lib/${f}`),
]

const pares = new Set()
for (const f of ficheros) {
  const src = await readFile(f, 'utf8')
  for (const m of src.matchAll(/(?:export )?function (\w*[Tt]oRow)\s*\([^)]*\)[^{]*\{\s*return\s*\{([\s\S]*?)\n  \}/g)) {
    const cuerpo = m[2].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const cols = [...cuerpo.matchAll(/^\s{4}([a-z_][a-z0-9_]*)\s*:/gm)].map((x) => x[1])
    if (!cols.length) continue
    const base = f.split('/').pop().replace('.ts', '')
    /*
     * ADIVINAR LA TABLA POR EL NOMBRE DEL FICHERO SOLO VALE SI EL FICHERO
     * ESCRIBE EN UNA.
     *
     * Aquí estaba el fallo silencioso: `proyectos.ts` tiene dos funciones
     * —`proyectoToRow` y `tareaProyectoToRow`— y la heurística mira el nombre
     * del FICHERO, así que le daba `proyectos` a las dos. Resultado: las seis
     * columnas de las tareas se comprobaban contra la tabla de los proyectos y
     * el diagnóstico decía que faltaban seis columnas EN UNA BASE PERFECTA.
     *
     * Eso es lo peor que puede hacer un diagnóstico: mandar a alguien a buscar
     * un problema que no existe. Así que con dos o más funciones en el mismo
     * fichero no se adivina — se exige que estén en ALIAS, y si no, se rompe.
     */
    const cuantas = [...src.matchAll(/function \w*[Tt]oRow\s*\(/g)].length
    const tabla = ALIAS[m[1]] ?? (cuantas > 1 ? undefined : [...TABLAS]
      .filter((t) => t === base || t === `${base}s` || base.startsWith(t))
      .sort((a, b) => b.length - a.length)[0])
    if (!tabla) {
      // Mejor romper que generar un diagnóstico que pregunta por una tabla
      // inventada: eso daría un «falta esto» falso y mandaría a nadie a
      // ninguna parte.
      throw new Error(
        `No sé a qué tabla escribe ${m[1]} (${f}). Añádela a ALIAS.`
        + (cuantas > 1 ? ` Ese fichero tiene ${cuantas} funciones «toRow», así que no se adivina.` : ''),
      )
    }
    for (const c of cols) pares.add(`${tabla}|${c}`)
  }
}

// Las que no salen de un `toRow` pero sin las cuales no funciona nada.
for (const t of ['hermanos', 'cuotas', 'papeletas', 'tramos', 'movimientos', 'eventos',
  'comunicados', 'documentos', 'enseres', 'incidencias', 'personal',
  'solicitudes_alta', 'mensajes_web', 'hermandad_settings']) {
  pares.add(`${t}|hermandad_id`)
}
pares.add('tramos|hora_citacion')
pares.add('solicitudes_alta|tutor_id')
pares.add('solicitudes_alta|fecha_nacimiento')
// Los precios de la papeleta viven en los ajustes de la hermandad, no en el
// navegador de quien los escribe. Sin estas columnas, cada persona emite a un
// precio distinto y nadie se entera.
pares.add('hermandad_settings|precio_papeleta')
pares.add('hermandad_settings|precio_simbolica')

const filas = [...pares].sort().map((p) => {
  const [t, c] = p.split('|')
  return `    ('${t}', '${c}')`
}).join(',\n')

/*
 * ============================================================================
 * Y LO QUE NO SON COLUMNAS, QUE FALLA IGUAL DE CALLADO
 * ============================================================================
 *
 * Las columnas eran la mitad del problema. La otra mitad son las FUNCIONES.
 *
 * Cuando la aplicación llama a una función que la base no tiene, PostgREST
 * contesta un 404 — y la aplicación, que está escrita para no reventar cuando
 * la base no responde, se lo traga y sigue. O sea que el resultado no es un
 * error en pantalla: es que la pantalla se queda como si no hubiera nada.
 * «Mi familia» vacía. Ninguna novedad encendida. La versión, sin comprobar.
 *
 * Igual que con las columnas, la lista NO se escribe a mano: se saca de las
 * llamadas `.rpc('…')` que hay en el código. Una lista a mano se queda vieja
 * el día que alguien añade una función, que es justo el día en que hace falta.
 */
const fuentesRpc = [
  ...ficheros,
  ...(await readdir('src/pages')).filter((f) => f.endsWith('.tsx')).map((f) => `src/pages/${f}`),
  ...(await readdir('src/pages/app')).filter((f) => f.endsWith('.tsx')).map((f) => `src/pages/app/${f}`),
  ...(await readdir('src/components')).filter((f) => f.endsWith('.tsx')).map((f) => `src/components/${f}`),
]
const funciones = new Set()
for (const f of fuentesRpc) {
  const src = await readFile(f, 'utf8')
  for (const m of src.matchAll(/\.rpc\(\s*'([a-z_0-9]+)'/g)) funciones.add(m[1])
}

/*
 * ----------------------------------------------------------------------------
 * Y LAS QUE LLAMA EL SERVIDOR, QUE ERAN UN PUNTO CIEGO
 * ----------------------------------------------------------------------------
 *
 * Lo de arriba mira `src`, o sea el navegador. Pero las funciones del dinero
 * NO las llama el navegador a propósito: las llama una función de Supabase con
 * la clave de servicio, porque desde el navegador nadie puede activarse una
 * suscripción ni darse por pagado.
 *
 * O sea que las cinco funciones de las que depende el cobro entero
 * —`activar_suscripcion_por_usuario`, `cancelar_suscripcion_por_stripe`,
 * `cobrar_pago_tarjeta` y las dos de la renovación— no estaban en esta lista.
 * Si faltaran en una base, el webhook contestaría 502, Stripe reintentaría
 * unas horas y se rendiría, y la hermandad se quedaría sin activar habiendo
 * pagado. Aquí no salía nada.
 *
 * Es el mismo fallo que ya tuvo este fichero con siete tablas: lo que no se
 * mira no está roto hasta el día que lo está.
 *
 * Se buscan de dos formas porque hay dos maneras de llamarlas en esos
 * ficheros: por la ruta REST (`rpc/loquesea`) y por el ayudante `llamarRpc`.
 * La llamada genérica —`rpc/${nombre}`— no cuela por el filtro, que solo
 * admite letras minúsculas, números y guión bajo.
 */
for (const dir of await readdir('supabase/functions', { withFileTypes: true })) {
  if (!dir.isDirectory()) continue
  let src
  try {
    src = await readFile(`supabase/functions/${dir.name}/index.ts`, 'utf8')
  } catch {
    continue
  }
  for (const m of src.matchAll(/rpc\/([a-z_0-9]+)/g)) funciones.add(m[1])
  for (const m of src.matchAll(/llamarRpc\(\s*'([a-z_0-9]+)'/g)) funciones.add(m[1])
}
/*
 * `hermandad_actual()` no se llama nunca desde el navegador —es la frontera de
 * RLS, la llaman las políticas— pero si falta ELLA no funciona absolutamente
 * nada, así que entra en la lista igual.
 */
funciones.add('hermandad_actual')
funciones.add('modulo_permitido')
const filasFunciones = [...funciones].sort().map((x) => `    ('${x}')`).join(',\n')

/*
 * LOS CUBOS DE ALMACENAMIENTO. Se sacan de las constantes del código para que
 * no se queden atrás. Sin el cubo, subir una foto o guardar la copia semanal
 * falla — y la copia semanal falla EN SILENCIO, que es lo peligroso.
 */
const cubos = new Set()
for (const f of ficheros) {
  const src = await readFile(f, 'utf8')
  for (const m of src.matchAll(/^const (?:CUBO|BUCKET) = '([a-z_0-9]+)'/gm)) cubos.add(m[1])
}
const filasCubos = [...cubos].sort().map((x) => `    ('${x}')`).join(',\n')

/*
 * ============================================================================
 * TODAS LAS TABLAS QUE LA APLICACIÓN TOCA, NO SOLO LAS QUE TIENEN UN `toRow`
 * ============================================================================
 *
 * La lista de columnas sale de las funciones `toRow`, y eso deja fuera un
 * montón de tablas que la aplicación usa por otros caminos: la tienda escribe
 * sus ventas por función del servidor, los catálogos y los permisos se
 * escriben a mano, la web pública tiene lo suyo…
 *
 * De esas no se pueden comprobar las columnas —no hay de dónde sacarlas— pero
 * sí las dos cosas que más duelen:
 *
 *   · QUE LA TABLA EXISTA. Si falta, ese trozo de la aplicación no va, y el
 *     fallo que se ve es «no se guarda» o una pantalla vacía.
 *   · QUE TENGA SEGURIDAD POR FILAS. Sin ella, esa tabla la ve CUALQUIER
 *     hermandad. Y eso no se nota nunca hasta que se nota del todo.
 *
 * Se sacan de las llamadas `.from('…')` del código, igual que lo demás: a mano
 * se quedaría vieja.
 */
const tablasUsadas = new Set()
for (const f of fuentesRpc) {
  const src = await readFile(f, 'utf8')
  for (const m of src.matchAll(/supabase!?\s*\.\s*from\(\s*'([a-z_0-9]+)'/g)) tablasUsadas.add(m[1])
  for (const m of src.matchAll(/useSupabaseTable<[^>]*>\(\s*\n?\s*'([a-z_0-9]+)'/g)) tablasUsadas.add(m[1])
}
/*
 * Y las de la copia de seguridad, que es la lista de «lo que ES la hermandad».
 * Si a esta base le falta una de ellas, la copia semanal se lleva menos de lo
 * que dice llevarse — y eso solo se descubre el día que hay que restaurarla.
 */
const backup = await readFile('src/lib/backup.ts', 'utf8')
const bloqueCopia = (backup.match(/export const TABLAS_COPIA = \[([\s\S]*?)\] as const/) ?? ['', ''])[1]
for (const m of bloqueCopia.matchAll(/'([a-z_0-9]+)'/g)) tablasUsadas.add(m[1])

// Las que ya se vigilan columna a columna no hacen falta aquí otra vez.
for (const par of pares) tablasUsadas.delete(par.split('|')[0])
// Y lo que no sea una tabla de verdad, fuera: `storage.from('imagenes')` y
// demás se cuelan por el mismo patrón y no son tablas de `public`.
for (const t of [...tablasUsadas]) if (!TABLAS.has(t)) tablasUsadas.delete(t)

const filasTablas = [...tablasUsadas].sort().map((x) => `    ('${x}')`).join(',\n')

/* Por qué versión debería ir esta base: el número de piezas del instalador. */
const { PIEZAS } = await import('./generar-todo-en-uno.mjs')
const VERSION = PIEZAS.length

const sql = `-- =============================================================================
--
--   GOBERGO — ¿QUÉ LE FALTA A ESTA BASE DE DATOS?
--
-- =============================================================================
--
--   GENERADO. No lo edites a mano: se regenera con
--       node scripts/generar-diagnostico.mjs
--
-- -----------------------------------------------------------------------------
-- PARA QUÉ SIRVE
-- -----------------------------------------------------------------------------
--
-- Cuando algo «se guarda» pero al recargar no está, casi siempre es lo mismo:
-- la aplicación escribe una columna que esta base no tiene. Postgres no ignora
-- la columna que le sobra —rechaza la operación entera—, así que no se pierde
-- un campo: no se guarda NADA.
--
-- COMPRUEBA CINCO COSAS, y las cinco fallan sin dar la cara:
--
--   1. LAS TABLAS. Si falta una entera, es que ese SQL no se ha ejecutado.
--   2. LAS COLUMNAS que la aplicación escribe. La lista sale de las funciones
--      \`toRow\` del código, no de una lista a mano: una lista a mano se queda
--      vieja el día que alguien añade un campo, o sea el día que hace falta.
--   3. LAS FUNCIONES que la aplicación llama. Cuando falta una, PostgREST
--      contesta 404 y la aplicación —escrita para aguantar que la base no
--      responda— se lo traga. No sale un error: sale la pantalla vacía.
--   4. LOS CUBOS de archivos. Sin ellos no se sube una foto… y la copia de
--      seguridad semanal falla en silencio, que es lo que de verdad duele.
--   5. LA SEGURIDAD POR FILAS (RLS). Una tabla sin ella la ve CUALQUIER
--      hermandad. No es que algo no funcione: es que funciona de más.
--
-- Y de propina dice por qué versión va la base y por cuál debería ir.
--
-- Esto no cambia nada. Solo mira y responde.
--
--   1. Supabase → SQL Editor → New query
--   2. Pega esto entero y dale a RUN
--   3. Si dice «No rows returned», no falta nada: el problema es otro
--      Si salen filas, ejecuta \`TODO-EN-UNO.sql\` y vuelve a pasar esto
--
-- Va TODO en una sola consulta a propósito. Con dos, el editor de Supabase
-- enseña solo el resultado de la última, y un «no falta nada» podía estar
-- escondiendo la lista de columnas que sí faltaban.
--
-- =============================================================================

with esperado (tabla, columna) as (
  values
${filas}
), funciones_esperadas (nombre) as (
  values
${filasFunciones}
), cubos_esperados (nombre) as (
  values
${filasCubos}
), tablas_usadas (nombre) as (
  values
${filasTablas}
), tablas_que_hay as (
  select table_name from information_schema.tables where table_schema = 'public'
), columnas_que_hay as (
  select table_name, column_name from information_schema.columns where table_schema = 'public'
)
select * from (
  -- Las tablas que no existen. Van primero porque si falta la tabla entera, lo
  -- de las columnas es ruido: lo que pasa es que no se ha ejecutado el SQL.
  select
    'FALTA LA TABLA ENTERA' as "Qué pasa",
    e.tabla                 as "Tabla",
    ''                      as "Columna"
  from (select distinct tabla from esperado) e
  where e.tabla not in (select table_name from tablas_que_hay)

  union all

  select
    'falta una columna' as "Qué pasa",
    e.tabla             as "Tabla",
    e.columna           as "Columna"
  from esperado e
  where e.tabla in (select table_name from tablas_que_hay)
    and (e.tabla, e.columna) not in (select table_name, column_name from columnas_que_hay)

  union all

  -- Las funciones que la aplicación llama y aquí no están. Se mira el catálogo
  -- por NOMBRE y no con \`to_regprocedure\`, porque varias están sobrecargadas
  -- (la misma con y sin argumentos) y ahí hay que acertar la firma entera.
  select
    'FALTA UNA FUNCIÓN' as "Qué pasa",
    f.nombre            as "Tabla",
    'la aplicación la llama y no está' as "Columna"
  from funciones_esperadas f
  where not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = f.nombre)

  union all

  -- Los cubos de archivos. El de \`copias\` es el que más duele: sin él la copia
  -- semanal falla y no lo dice nadie.
  select
    'FALTA UN CUBO DE ARCHIVOS' as "Qué pasa",
    c.nombre                    as "Tabla",
    'sin él no se pueden guardar archivos' as "Columna"
  from cubos_esperados c
  where not exists (select 1 from storage.buckets b where b.id = c.nombre)

  union all

  /*
   * TABLAS SIN SEGURIDAD POR FILAS.
   *
   * Esta es la única línea de todo el diagnóstico que no habla de algo roto,
   * sino de algo ABIERTO. Sin RLS, esa tabla la lee y la escribe cualquier
   * cuenta de cualquier hermandad: no es que falle, es que funciona de más, y
   * eso no se nota nunca hasta que se nota del todo.
   *
   * Se miran solo las tablas que la aplicación usa —las que salen en la lista
   * de columnas de arriba—, no todo lo que haya en \`public\`: una tabla auxiliar
   * de alguien no es asunto de este diagnóstico.
   */
  select
    'TABLA SIN SEGURIDAD POR FILAS' as "Qué pasa",
    t.tabla                         as "Tabla",
    'la puede ver otra hermandad'   as "Columna"
  from (
    select tabla from esperado
    union select nombre from tablas_usadas
  ) t
  join pg_class c on c.relname = t.tabla
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where not c.relrowsecurity

  union all

  -- Y las tablas de las que no se pueden comprobar columnas —porque la
  -- aplicación no las escribe con un \`toRow\`— pero que sin ellas hay trozos
  -- enteros que no funcionan: la tienda, los catálogos, la web pública.
  select
    'FALTA LA TABLA ENTERA' as "Qué pasa",
    u.nombre                as "Tabla",
    'la aplicación la usa'  as "Columna"
  from tablas_usadas u
  where u.nombre not in (select table_name from tablas_que_hay)

  union all

  /*
   * Y POR QUÉ VERSIÓN VA ESTA BASE.
   *
   * El \`case\` no es adorno: si \`esquema_gobergo\` no existe —una base que no ha
   * pasado nunca por \`ACTUALIZAR.sql\`, que es justo cuando más falta hace este
   * diagnóstico— nombrarla dentro de un \`select\` normal revienta la consulta
   * ENTERA al planificarla, y no saldría ni lo de arriba. \`query_to_xml\` se
   * resuelve al ejecutar, así que el \`case\` puede saltársela.
   */
  select
    case
      when to_regclass('public.esquema_gobergo') is null
        then 'TU BASE NO SE HA ACTUALIZADO NUNCA'
      when coalesce((xpath('/row/valor/text()', query_to_xml(
             'select valor from esquema_gobergo where clave = ''version''',
             false, true, '')))[1]::text::int, 0) < ${VERSION}
        then 'TU BASE VA POR DETRÁS'
      else 'al día'
    end as "Qué pasa",
    'versión del esquema' as "Tabla",
    case
      when to_regclass('public.esquema_gobergo') is null
        then 'debería ir por la ${VERSION}: pega ACTUALIZAR.sql'
      else 'va por la ' || coalesce((xpath('/row/valor/text()', query_to_xml(
             'select valor from esquema_gobergo where clave = ''version''',
             false, true, '')))[1]::text, '?') || ' y debería ir por la ${VERSION}'
    end as "Columna"
) todo
-- Lo que está al día se calla: si sale una sola fila, es que hay algo que ver.
where "Qué pasa" <> 'al día'
order by "Qué pasa", "Tabla", "Columna";
`
await writeFile('supabase/DIAGNOSTICO.sql', sql)
console.log(
  `DIAGNOSTICO.sql generado: ${pares.size} columnas, ${funciones.size} funciones, `
  + `${cubos.size} cubos, ${tablasUsadas.size} tablas más solo por existencia y RLS, `
  + `y la versión ${VERSION}.`,
)
