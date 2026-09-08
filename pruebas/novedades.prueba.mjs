/**
 * EL DESPLIEGUE POR FASES: QUE LO QUE NO SE SABE ESTÉ APAGADO.
 *
 * Toda la utilidad de las banderas depende de una sola cosa: que el estado por
 * defecto sea «apagado». Antes de que llegue la lista, mientras llega, si la
 * consulta falla, si la base está atrasada y no tiene la tabla — en los cuatro
 * casos tiene que ganar el camino que lleva años funcionando.
 *
 * Al revés, una bandera que se enciende sola cuando la consulta falla es una
 * función nueva que se activa en cincuenta hermandades a la vez el día que hay
 * un problema de red. Que es el peor día posible.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/novedades.ts')

  // --- APAGADO ES EL ESTADO DE PARTIDA ---
  caso('sin haber preguntado nada, todo apagado', false, m.esNovedad(m.NOVEDADES.cuotasVentana))

  /*
   * Y traer la lista sin base de datos no la enciende. En las pruebas no hay
   * Supabase, así que esta llamada recorre exactamente el camino del fallo.
   */
  await m.traerNovedades()
  caso('y si no hay a quién preguntar, sigue apagado', false, m.esNovedad(m.NOVEDADES.cuotasVentana))

  // --- ENCENDIDA, RESPONDE QUE SÍ ---
  m.ponerNovedadesParaPruebas([m.NOVEDADES.cuotasVentana])
  caso('encendida, se nota', true, m.esNovedad(m.NOVEDADES.cuotasVentana))
  caso('y una que no está en la lista sigue apagada', false, m.esNovedad('otra-cosa'))
  m.ponerNovedadesParaPruebas([])
  caso('y se puede apagar otra vez', false, m.esNovedad(m.NOVEDADES.cuotasVentana))

  // --- LA CONSULTA ES SÍNCRONA ---
  /*
   * Tiene que serlo: se consulta dentro de un `render`. Una bandera que hubiera
   * que esperar no se podría preguntar donde hace falta preguntarla.
   */
  caso('preguntar no devuelve una promesa', false, m.esNovedad('lo-que-sea') instanceof Promise)

  const { readFile } = await import('node:fs/promises')
  const src = await readFile('src/lib/novedades.ts', 'utf8')
  /*
   * Y no lanza NUNCA. Si `traerNovedades` pudiera lanzar, un fallo de red al
   * arrancar dejaría la aplicación sin montar por culpa de una lista de
   * funciones en pruebas.
   */
  caso('traer la lista no puede lanzar', true, /catch \{/.test(src))
  caso('ni en la demostración', true, /if \(modoDemoActivo\(\)\) return/.test(src))

  // --- EL LADO DE LA BASE ---
  const sql = await readFile('supabase/canal-de-actualizacion.sql', 'utf8')
  /*
   * LA ESCALERA: apagado → piloto → estable. Y hacia atrás, que es para lo que
   * de verdad sirve: apagar tarda diez segundos y no depende de reconstruir
   * ningún paquete.
   */
  caso('los tres estados están', true,
    /check \(desde_canal in \('apagado', 'piloto', 'estable'\)\)/.test(sql))
  caso('y una novedad nace apagada', true, /desde_canal text not null default 'apagado'/.test(sql))
  // Ser piloto se pide: una hermandad que no sabe que prueba cosas las sufre.
  caso('y una hermandad nace estable', true, /canal text not null default 'estable'/.test(sql))

  /*
   * LA HERMANDAD NO PUEDE ENCENDERSE SUS PROPIAS BANDERAS. Sin política de
   * insert ni de update, RLS deniega. Una bandera que se enciende la hermandad
   * no es un despliegue por fases, es un menú de opciones a medio hacer.
   */
  caso('la lista se puede leer', true, /create policy "novedades_leer" on novedades/.test(sql))
  caso('pero no escribir', false, /create policy[^;]*on novedades\s*\n\s*for (insert|update)/.test(sql))

  /*
   * Y LA CUENTA LA HACE LA BASE, no el navegador: el día que se añada un tercer
   * canal o una fecha de caducidad, se cambia ahí y las hermandades que no
   * hayan recargado siguen funcionando.
   */
  caso('quién ve qué lo decide la base', true, /create or replace function mis_novedades\(\)/.test(sql))
  caso('estable lo ve todo el mundo', true, /n\.desde_canal = 'estable'/.test(sql))
  caso('y piloto solo las hermandades piloto', true, /h\.canal = 'piloto'/.test(sql))
}
