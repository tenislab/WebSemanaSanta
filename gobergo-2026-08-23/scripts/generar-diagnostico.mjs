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
  mensajeToRow: 'mensajes_web',
  settingsToRow: 'hermandad_settings',
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
    const tabla = ALIAS[m[1]] ?? [...TABLAS]
      .filter((t) => t === base || t === `${base}s` || base.startsWith(t))
      .sort((a, b) => b.length - a.length)[0]
    if (!tabla) {
      // Mejor romper que generar un diagnóstico que pregunta por una tabla
      // inventada: eso daría un «falta esto» falso y mandaría a nadie a
      // ninguna parte.
      throw new Error(`No sé a qué tabla escribe ${m[1]} (${f}). Añádela a ALIAS.`)
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
) todo
order by "Qué pasa", "Tabla", "Columna";
`
await writeFile('supabase/DIAGNOSTICO.sql', sql)
console.log(`DIAGNOSTICO.sql generado: ${pares.size} columnas vigiladas.`)
