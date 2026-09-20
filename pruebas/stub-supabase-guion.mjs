/**
 * UN SUPABASE DE MENTIRA AL QUE SE LE ESCRIBE EL GUION.
 *
 * El otro —`stub-supabase.mjs`— SALTA si alguien intenta hablar con la base, y
 * esa garantía vale: las funciones puras no tienen que llamar a Supabase y si
 * lo hacen se quiere saber. Este es para lo contrario: para recorrer a
 * propósito la rama de Supabase de una función y **decidir qué consulta falla**.
 *
 * Hacía falta porque el agujero del artículo 17 estaba justo ahí. La prueba que
 * cubría `borrarDatosHermano` solo recorría el camino de `localStorage`, así
 * que la rama que de verdad usa una hermandad —la de la base— no se probaba, y
 * dentro de ella había una consulta cuyo error nadie miraba.
 *
 * CÓMO SE USA
 *
 *   globalThis.__GUION = {
 *     'select:uno hermanos': { data: null, error: { message: 'fetch failed' } },
 *     'delete hermanos': { data: null, error: null },
 *   }
 *   globalThis.__LLAMADAS = []      // se llena con lo que se le ha pedido
 *
 * La clave es `<verbo> <tabla>`, y `<verbo>:uno` cuando la consulta acaba en
 * `maybeSingle()` o `single()`. Lo que no esté en el guion devuelve
 * `{ data: [], error: null }`, que es «no hay nada y no ha fallado».
 *
 * `__LLAMADAS` es la mitad importante: comprobar qué devuelve la función no
 * basta, hay que poder afirmar **qué llegó a pedirle a la base**. Que el
 * `delete hermanos` NO aparezca es justo lo que dice que no se ha borrado nada.
 */
function respuesta(tabla, verbo) {
  const guion = globalThis.__GUION ?? {}
  if (Array.isArray(globalThis.__LLAMADAS)) globalThis.__LLAMADAS.push(`${verbo} ${tabla}`)
  return guion[`${verbo} ${tabla}`] ?? { data: [], error: null }
}

function consulta(tabla) {
  let verbo = 'select'
  const api = {
    select() { verbo = 'select'; return api },
    delete() { verbo = 'delete'; return api },
    insert() { verbo = 'insert'; return api },
    update() { verbo = 'update'; return api },
    upsert() { verbo = 'upsert'; return api },
    eq() { return api },
    neq() { return api },
    or() { return api },
    in() { return api },
    gte() { return api },
    lte() { return api },
    order() { return api },
    range() { return api },
    limit() { return api },
    maybeSingle() { return Promise.resolve(respuesta(tabla, `${verbo}:uno`)) },
    single() { return Promise.resolve(respuesta(tabla, `${verbo}:uno`)) },
    /*
     * `then` es lo que convierte esto en algo que se puede esperar con `await`
     * sin ser una promesa: es como se comporta el constructor de consultas de
     * supabase-js, que solo dispara la petición cuando alguien la espera.
     */
    then(resuelve, rechaza) { return Promise.resolve(respuesta(tabla, verbo)).then(resuelve, rechaza) },
  }
  return api
}

export function createClient() {
  return {
    from: (tabla) => consulta(tabla),
    rpc: (nombre) => Promise.resolve(respuesta(nombre, 'rpc')),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
  }
}
