/**
 * «CANNOT CHANGE RETURN TYPE OF EXISTING FUNCTION».
 *
 * Este error ha llegado DOS VECES a la base de una hermandad de verdad, en
 * mitad de ACTUALIZAR.sql, con las pruebas en verde las dos veces.
 *
 * El motivo es siempre el mismo. `create or replace function` sabe cambiarle a
 * una función el cuerpo, los permisos y casi todo… menos lo que devuelve. Si
 * una función declara `returns table (a, b)` y un día se le añade una columna,
 * Postgres se planta.
 *
 * Y no se planta aquí. Aquí, y en cada prueba de este proyecto, la base se
 * monta DESDE CERO: la función no existía, así que se crea sin discutir y todo
 * pasa. Se planta en la base de una hermandad que lleva meses funcionando, que
 * es la única donde existe la versión vieja — o sea, en producción, con el
 * usuario delante y la actualización a medias.
 *
 * La vacuna es una línea: `drop function if exists x(...)` delante del create.
 * Cuesta nada y quita el problema para siempre. Esta prueba comprueba que esa
 * línea está en TODAS, para que la siguiente función que se escriba no vuelva
 * a abrir el mismo agujero.
 *
 * (Solo hace falta para `returns table` y `returns setof`: cambiar de `text` a
 * `int` también rompería, pero eso no pasa nunca; lo que se hace a diario es
 * añadirle una columna a lo que devuelve una consulta.)
 */
import { readdirSync, readFileSync } from 'node:fs'

export default async function ({ caso }) {
  const carpeta = new URL('../supabase/', import.meta.url)
  // Los tres generados no: son la suma de las piezas, y ahí las funciones ya
  // salen con su drop delante. Comprobarlos sería contar dos veces.
  const piezas = readdirSync(carpeta)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => !['TODO-EN-UNO.sql', 'ACTUALIZAR.sql', 'DIAGNOSTICO.sql'].includes(f))
    .filter((f) => !f.startsWith('PRUEBA-'))
    .sort()

  caso('hay piezas de SQL que revisar', true, piezas.length > 20)

  const sinVacuna = []
  let revisadas = 0
  for (const f of piezas) {
    const t = readFileSync(new URL(f, carpeta), 'utf8')
    const re = /create or replace function\s+(\w+)\s*\(/gi
    let m
    while ((m = re.exec(t))) {
      // ¿Qué devuelve? Se mira lo que viene justo detrás de los paréntesis.
      const cabecera = t.slice(m.index, m.index + 600)
      if (!/returns\s+(table|setof)/i.test(cabecera)) continue
      revisadas += 1
      const antes = t.slice(0, m.index)
      if (!new RegExp(`drop function if exists\\s+${m[1]}\\s*\\(`, 'i').test(antes)) {
        sinVacuna.push(`${f} :: ${m[1]}`)
      }
    }
  }

  // Si un día esto da cero, es que el buscador ha dejado de encontrarlas y la
  // prueba estaría diciendo que sí a todo.
  caso('se han encontrado funciones que devuelven tablas', true, revisadas >= 8)
  caso('todas llevan su «drop function if exists» delante', '', sinVacuna.join('\n'))
}
