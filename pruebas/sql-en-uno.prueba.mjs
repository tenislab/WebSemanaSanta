/**
 * Que `TODO-EN-UNO.sql` sea de verdad todo el SQL.
 *
 * EL PROBLEMA. Ese fichero es el que se pega de una vez en el editor de
 * Supabase, y estaba escrito a mano. Se quedó atrás sin que nadie lo notara:
 * los arreglos de seguridad de `multi-hermandad.sql` —cerrar
 * `adoptar_datos_sin_hermandad`, no meter a un titular en la hermandad de
 * otros— no estaban dentro. Quien montara su base con el pegote se llevaba la
 * versión con el agujero, y el fichero suelto, arreglado, no lo miraba nadie.
 *
 * Ahora se genera, y esto comprueba que está al día.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const { generar, PIEZAS } = await import('../scripts/generar-todo-en-uno.mjs')

  const enDisco = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  const recienHecho = await generar()
  caso('TODO-EN-UNO.sql está al día', true, enDisco === recienHecho)
  if (enDisco !== recienHecho) {
    console.log('    → ejecuta: node scripts/generar-todo-en-uno.mjs')
  }

  // El orden no es un detalle: `multi-hermandad.sql` crea la columna
  // `hermandad_id`, y todo lo que va detrás la usa. Al revés, no arranca.
  const nombres = PIEZAS.map(([f]) => f)
  const multi = nombres.indexOf('multi-hermandad.sql')
  caso('multi-hermandad va antes de lo que lo necesita', true,
    multi < nombres.indexOf('remesas.sql') &&
    multi < nombres.indexOf('registro-actividad.sql') &&
    multi < nombres.indexOf('apuntes-automaticos.sql') &&
    multi < nombres.indexOf('acceso-hermano.sql'))
  // Y después de las tablas, que es lo que separa.
  caso('y después de crear las tablas', true, nombres.indexOf('schema.sql') < multi)

  // Que no se quede ningún fichero fuera por olvido. Los de prueba, los de
  // datos de ejemplo y los de reparación puntual no entran a propósito.
  const { readdir } = await import('node:fs/promises')
  const FUERA = new Set([
    'TODO-EN-UNO.sql',
    'PRUEBA-AISLAMIENTO.sql', 'PRUEBA-MUDANZA.sql', 'BORRAR-PRUEBAS.sql',
    'DATOS-DE-PRUEBA.sql', 'seed-hermanos-prueba.sql', 'seed-usuarios-ejemplo.sql',
    'reset-antes-de-actualizar.sql', 'migracion-2026-08.sql',
  ])
  const todos = (await readdir('supabase')).filter((f) => f.endsWith('.sql') && !FUERA.has(f))
  const olvidados = todos.filter((f) => !nombres.includes(f))
  caso('no se queda ningún .sql fuera', '', olvidados.join(', '))

  /**
   * PODER EJECUTARLO DOS VECES, que es la promesa que hace la cabecera.
   *
   * `schema.sql` creaba `hermanos_numero_activo_uniq` sobre (numero) a secas,
   * de cuando había UNA hermandad. `multi-hermandad.sql` lo borra después y
   * pone el bueno, (hermandad_id, numero). Pero al volver a ejecutar el
   * fichero entero, `schema.sql` se encontraba con que ese nombre ya no existe
   * —lo borró multi-hermandad— e intentaba crearlo otra vez... con dos
   * hermandades dentro, cada una con su nº 1:
   *
   *     ERROR: could not create unique index "hermanos_numero_activo_uniq"
   *     DETAIL: Key (numero)=(1) is duplicated.
   *
   * Y el «is duplicated» era lo NORMAL, no un dato corrupto.
   */
  caso('el índice de un solo hermandad va protegido', true,
    /if not exists \(\s*select 1 from information_schema\.columns[\s\S]*?column_name = 'hermandad_id'\s*\) then\s*create unique index if not exists hermanos_numero_activo_uniq/.test(enDisco))
  // Y que exista el bueno, el de por hermandad.
  caso('y existe el índice por hermandad', true,
    /create unique index if not exists hermanos_numero_por_hermandad\s*\n\s*on hermanos \(hermandad_id, numero\)/.test(enDisco))

  // Y lo que de verdad importa: que los arreglos de seguridad estén DENTRO.
  caso('lleva el cierre de adoptar_datos_sin_hermandad', true,
    /revoke execute on function adoptar_datos_sin_hermandad\(uuid\) from anon, authenticated;/.test(enDisco))
  caso('lleva el tope del acceso por DNI', true, /if v_recientes >= 25 then/.test(enDisco))
  caso('lleva la columna del rastro de remesas', true, /add column if not exists remesada_el/.test(enDisco))
}
