/**
 * Genera `supabase/TODO-EN-UNO.sql` pegando los ficheros sueltos en orden.
 *
 * POR QUÉ EXISTE. Ese fichero es el que se pega en el editor de Supabase de
 * una vez, y estaba hecho a mano. Se quedó atrás: los arreglos de seguridad de
 * `multi-hermandad.sql` —cerrar `adoptar_datos_sin_hermandad`, no meter a un
 * titular en la hermandad de otros— no estaban dentro, así que quien montara
 * su base con el pegote se llevaba la versión con el agujero.
 *
 * Con esto se regenera:  node scripts/generar-todo-en-uno.mjs
 * Y `npm test` comprueba que está al día.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * EL ORDEN IMPORTA y no es alfabético.
 *
 * `multi-hermandad.sql` va el último a propósito: crea la frontera entre
 * hermandades sobre las tablas que han creado los anteriores. Si fuera antes,
 * no habría nada que separar.
 */
export const PIEZAS = [
  ['schema.sql', 'Todas las tablas'],
  ['rls-cargos.sql', 'Permisos por cargo de la junta'],
  ['rls-endurecer.sql', 'EL IMPORTANTE: cierra la escritura a quien se registre'],
  ['hermano-auth.sql', 'Acceso del hermano a su propia ficha'],
  ['web-publica.sql', 'La web pública'],
  ['mensajes-web.sql', 'Buzón de los formularios de la web'],
  ['storage-archivo.sql', 'Adjuntos del archivo documental'],
  ['add-provincia.sql', 'La provincia en la ficha de la hermandad'],
  // A partir de aquí, todo lo que necesita que exista `hermandad_id`.
  ['multi-hermandad.sql', 'TODAS las hermandades en una base, sin verse entre ellas'],
  ['apuntes-automaticos.sql', 'Que los cobros lleguen solos a Tesorería'],
  ['registro-actividad.sql', 'Quién hizo qué (RGPD, artículo 32)'],
  ['remesas.sql', 'Que una remesa SEPA no se cobre dos veces'],
  ['comunicados-segmento.sql', 'Guardar a quién iba dirigido un comunicado'],
  ['acceso-hermano.sql', 'Cerrar el barrido de DNI en el acceso del hermano'],
  ['area-hermano.sql', 'Que el área del hermano funcione de verdad'],
  ['correo-hermandad.sql', 'Que la configuración de correo sea de la hermandad'],
  ['hermano-y-gestion.sql', 'Ser hermano Y llevar la hermandad a la vez'],
  ['permisos-por-hermandad.sql', 'Que los permisos por cargo sean de cada hermandad'],
  ['colores-hermandad.sql', 'Que el área del hermano lleve los colores de su hermandad'],
]

const CABECERA = `-- =============================================================================
--
--   GOBERGO — TODO EL SQL, EN UN SOLO ARCHIVO
--
-- =============================================================================
--
--   GENERADO. No lo edites a mano: se sobrescribe.
--   Se toca el fichero suelto y se vuelve a generar con
--       node scripts/generar-todo-en-uno.mjs
--
-- -----------------------------------------------------------------------------
-- CÓMO SE USA
-- -----------------------------------------------------------------------------
--
--   1. Abre tu proyecto en supabase.com
--   2. Menú izquierdo → SQL Editor → New query
--   3. Copia ESTE ARCHIVO ENTERO, pégalo y dale a RUN
--
-- Tarda unos segundos. Es seguro volver a ejecutarlo: todo está escrito para
-- no romperse si ya existía.
--
-- -----------------------------------------------------------------------------
-- QUÉ CREA, POR ORDEN
-- -----------------------------------------------------------------------------
--
${PIEZAS.map(([f, q], i) => `--   ${String(i + 1).padStart(2, ' ')}. ${f.padEnd(26)} ${q}`).join('\n')}
--
-- -----------------------------------------------------------------------------
-- LO ÚNICO QUE HAY QUE LEER ANTES
-- -----------------------------------------------------------------------------
--
-- \`rls-endurecer.sql\` es el que impide que cualquiera que se registre en
-- /registro obtenga permiso de escritura sobre TODA la base de datos.
--
-- \`multi-hermandad.sql\` es el que hace que en esta misma base quepan TODAS
-- las hermandades sin que ninguna vea nada de las demás. Va después de las
-- tablas, porque separa lo que ellas han creado, y antes de todo lo que
-- necesita la columna \`hermandad_id\` que él añade.
--
-- NO HAY QUE DARSE DE ALTA A MANO COMO TITULAR. La primera vez que entras, la
-- aplicación crea tu hermandad y te deja como titular sola. Tú solo tienes que
-- registrarte con tu correo.
--
-- =============================================================================

`

export async function generar() {
  const trozos = [CABECERA]
  for (const [fichero, queHace] of PIEZAS) {
    const cuerpo = await readFile(join(raiz, 'supabase', fichero), 'utf8')
    trozos.push(
      `\n-- =============================================================================\n` +
      `--   ${fichero.toUpperCase()} — ${queHace}\n` +
      `-- =============================================================================\n\n` +
      cuerpo.trimEnd() + '\n',
    )
  }
  return trozos.join('')
}

// Solo escribe si se ejecuta a mano; importarlo (desde las pruebas) no toca nada.
if (process.argv[1] && process.argv[1].endsWith('generar-todo-en-uno.mjs')) {
  const salida = await generar()
  await writeFile(join(raiz, 'supabase', 'TODO-EN-UNO.sql'), salida, 'utf8')
  console.log(`TODO-EN-UNO.sql regenerado: ${PIEZAS.length} ficheros, ${salida.split('\n').length} líneas.`)
}
