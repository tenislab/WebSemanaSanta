/**
 * QUE NINGÚN DATO DE LA FICHA SE QUEDE EN UN SOLO NAVEGADOR.
 *
 * ============================================================================
 * EL FALLO QUE CAZA, QUE HA APARECIDO YA TRES VECES
 * ============================================================================
 *
 * Un campo se añade al tipo `Hermano`, se rellena en la pantalla, se guarda, se
 * ve. Y no se manda a la base, porque `hermanoToRow` es una lista escrita a
 * mano y añadir el campo ahí es un paso aparte que se olvida.
 *
 * NADA LO DELATA. La pantalla funciona entera: se escribe, se guarda, se
 * recarga y sigue ahí — porque `localStorage` guarda el objeto completo,
 * `campos` incluido. El dato solo desaparece EN OTRO DISPOSITIVO, que es justo
 * el que no se prueba.
 *
 * Las tres veces:
 *
 *   · `tutorId` — quién lleva a un menor. La secretaria aprobaba al niño y lo
 *     veía colgando de su padre; el padre, desde su móvil, no tenía a nadie a
 *     su cargo. Se reportó como «lo de añadir hermanos como familia no
 *     funciona».
 *   · `campos` — la talla de túnica y demás campos a medida. Peor: ni siquiera
 *     había columna en la tabla. Y como la DEFINICIÓN del campo sí viajaba, se
 *     veía el campo dibujado, en su sitio, y vacío para el censo entero.
 *   · `fecha_baja`, en su día, por el otro lado (la columna no llegaba a las
 *     bases ya montadas).
 *
 * Escrito a mano no se caza. Mecánicamente, sí: son tres listas que tienen que
 * cuadrar —el tipo, el mapeo y la base— y compararlas es esto.
 */
export default async function ({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const tipo = await readFile('src/data/hermanos.ts', 'utf8')
  const db = await readFile('src/lib/db/hermanos.ts', 'utf8')
  const enUno = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')

  const bloque = (tipo.match(/export interface Hermano \{([\s\S]*?)\n\}/) ?? ['', ''])[1]
  const campos = [...bloque.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\??\s*:/gm)].map((m) => m[1])
  caso('se leen los campos del tipo Hermano', true, campos.length >= 25)

  const toRow = (db.match(/export function hermanoToRow[\s\S]*?\n\}/) ?? [''])[0]
  const fromRow = (db.match(/export function rowToHermano[\s\S]*?\n\}/) ?? [''])[0]

  /*
   * LO QUE SE PERDONA, Y POR QUÉ CADA UNO.
   *
   * Una lista de excepciones con el motivo escrito al lado es lo que separa una
   * prueba que sirve de una que se silencia. Si añades uno aquí sin motivo,
   * estás apagando la prueba.
   */
  const NO_VIAJAN = {
    /*
     * La contraseña en claro. Se manda SIEMPRE VACÍA a propósito: la de verdad
     * vive cifrada en Supabase Auth. Ver el comentario en `hermanoToRow`.
     */
    claveAcceso: 'no debe viajar nunca: la contraseña de verdad vive cifrada en Auth',
  }

  const sinSubir = campos.filter((c) => !NO_VIAJAN[c] && !new RegExp(`h\\.${c}\\b`).test(toRow))
  caso('todo lo de la ficha se manda a la base', [], sinSubir)

  const sinBajar = campos.filter((c) => !NO_VIAJAN[c] && !new RegExp(`\\b${c}:`).test(fromRow))
  caso('y todo lo que se manda se vuelve a leer', [], sinBajar)

  /*
   * --- Y LA TERCERA LISTA: QUE LA COLUMNA EXISTA DE VERDAD ---
   *
   * Mandar una columna que la base no tiene es PEOR que no mandarla: Postgres
   * no ignora la columna de más, RECHAZA LA FILA ENTERA. O sea que el fallo
   * pasa de «la talla de túnica no se guarda» a «no se guarda NADA de ningún
   * hermano», que fue exactamente lo que pasó con `hora_citacion` en tramos.
   *
   * Se leen las columnas del instalador, que es lo que va a tener una base al
   * día. `hermanos_lista` y demás vistas no cuentan: se busca la tabla.
   */
  const nombresDeColumna = [...toRow.matchAll(/^\s{4}([a-z_]+):/gm)].map((m) => m[1])
  caso('se leen las columnas que manda la aplicación', true, nombresDeColumna.length >= 25)

  const creacion = (enUno.match(/create table if not exists hermanos \(([\s\S]*?)\n\);/) ?? ['', ''])[1]
  const anadidas = [...enUno.matchAll(/alter table hermanos add column if not exists (\w+)/g)].map((m) => m[1])
  const enLaBase = new Set([
    ...[...creacion.matchAll(/^\s{2}([a-z_]+)\s/gm)].map((m) => m[1]),
    ...anadidas,
  ])
  caso('y las que tiene la tabla', true, enLaBase.size >= 25)

  const inventadas = nombresDeColumna.filter((c) => !enLaBase.has(c))
  caso('la aplicación no escribe en ninguna columna que no exista', [], inventadas)
  if (inventadas.length > 0) {
    console.log('    → una columna que no existe hace que Postgres rechace la FILA ENTERA')
  }

  /*
   * --- Y LOS DOS QUE SE PERDIERON, POR SU NOMBRE ---
   *
   * La comprobación general de arriba ya los cubre. Se repiten aquí a propósito
   * para que, el día que alguien los quite «porque no se usan», la prueba diga
   * QUÉ se ha roto y no solo que falta un campo.
   */
  caso('quién lleva a un menor llega a la base', true, /tutor_id: h\.tutorId/.test(toRow))
  caso('y vuelve', true, /tutorId: \(r\.tutor_id/.test(fromRow))
  caso('los campos a medida de la hermandad llegan a la base', true, /campos: h\.campos/.test(toRow))
  caso('y vuelven', true, /campos: \(r\.campos/.test(fromRow))
}
