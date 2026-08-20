/**
 * Qué se enseña cuando en el navegador todavía no hay nada.
 *
 * El caso real que motiva esto: una hermandad recién creada abrió el panel y
 * se encontró «4 cuotas pendientes» y «un hermano pagó su cuota anual»
 * teniendo CERO hermanos. Eran los datos de ejemplo que vienen con la
 * aplicación, colándose como si fueran suyos. Números inventados en la primera
 * pantalla que ve un cliente, y encima contradiciéndose entre ellos.
 *
 * La regla: con base de datos conectada, «no hay nada en este navegador»
 * significa «todavía no se ha traído nada», nunca «usa los ejemplos».
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/persistencia.ts')
  const EJEMPLOS = [{ id: '1', nombre: 'Hermano de ejemplo' }, { id: '2', nombre: 'Otro' }]

  // En estas pruebas no hay variables de Supabase, así que es el modo local:
  // ahí los ejemplos SÍ tienen que salir, que es lo que permite enseñar la
  // aplicación funcionando sin base de datos.
  localStorage.removeItem('cabildo-hermanos')
  caso('sin base de datos, salen los ejemplos', 2, m.leerDatos('cabildo-hermanos', EJEMPLOS).length)

  // Lo guardado manda por encima de los ejemplos, haya o no base de datos.
  localStorage.setItem('cabildo-hermanos', JSON.stringify([{ id: '9', nombre: 'Real' }]))
  caso('lo guardado gana a los ejemplos', 'Real', m.leerDatos('cabildo-hermanos', EJEMPLOS)[0].nombre)

  // Una lista vacía guardada es una respuesta: «no hay nadie». No puede
  // confundirse con «no hay nada guardado» y devolver los ejemplos.
  localStorage.setItem('cabildo-hermanos', JSON.stringify([]))
  caso('una lista vacía guardada se respeta', 0, m.leerDatos('cabildo-hermanos', EJEMPLOS).length)

  localStorage.removeItem('cabildo-hermanos')

  // Y la diferencia con `leerPersistido`, que es de propósito general y sigue
  // devolviendo lo que se le diga: la distinción vive solo en `leerDatos`.
  caso('leerPersistido no cambia', 2, m.leerPersistido('cabildo-hermanos', EJEMPLOS).length)
  caso('leerPersistido admite cualquier cosa, no solo listas', 'x', m.leerPersistido('sin-nada', 'x'))
}
