/**
 * EL HUECO DEL ARRANQUE: LO QUE SE GUARDA MIENTRAS LA TABLA VIENE DE CAMINO.
 *
 * ----------------------------------------------------------------------------
 * QUÉ SE PERDÍA
 * ----------------------------------------------------------------------------
 *
 * Entre montar una pantalla y recibir su tabla pasan unos cientos de
 * milisegundos. En ese rato `useSupabaseTable` tiene `cargado` en falso, y un
 * guardado se pintaba y se espejaba pero NO se sincronizaba.
 *
 * Eso último está bien y no se toca: comparar una lista que nunca vino de la
 * base con otra es pedirle a `sincronizar` que BORRE en Supabase todo lo que no
 * aparece, o sea el censo entero.
 *
 * Lo que estaba mal era el final de la carga: `setItemsState(traidos)` machacaba
 * el cambio sin decir nada, y `espejar(traidos)` lo borraba también del
 * navegador. No quedaba ni rastro — quien había dado un alta veía la lista sin
 * ella y no podía saber si se guardó.
 *
 * ----------------------------------------------------------------------------
 * LO QUE SE PRUEBA AQUÍ
 * ----------------------------------------------------------------------------
 *
 * `conLoDelHueco` es la función pura que decide qué sobrevive, así que se
 * ejecuta con listas a mano. Y es lo único de este arreglo que se puede medir
 * sin un navegador: el hueco dura milisegundos y provocarlo a propósito en una
 * sonda es una carrera que unas veces se gana y otras no — una prueba que a
 * veces pasa es peor que ninguna.
 *
 * Lo demás —que el hueco se apunte y que al final se sincronice— se vigila
 * leyendo la fuente, al final del fichero.
 */
import { fuente, sinComentarios } from './fuentes.mjs'

const h = (id, nombre, extra = {}) => ({ id, nombre, ...extra })

export default async function ({ cargar, caso }) {
  const { conLoDelHueco } = await cargar('src/lib/supabaseSync.ts')

  // ---------------------------------------------------------------------
  // 1. EL CASO DE VERDAD: ALTA EN EL HUECO.
  // ---------------------------------------------------------------------
  /*
   * Es el que se reportó. La pantalla arranca vacía (con base de datos, `items`
   * empieza en `[]`), alguien da un alta, y entonces llega el censo. El alta
   * tiene que quedarse.
   */
  caso('un alta hecha en el hueco sobrevive a la carga',
    ['Uno de la base', 'Dos de la base', 'La recién dada de alta'],
    conLoDelHueco(
      [h('b1', 'Uno de la base'), h('b2', 'Dos de la base')],
      [],
      [h('nueva', 'La recién dada de alta')],
    ).map((x) => x.nombre))

  /* Y dos altas seguidas, que es lo que pasa si alguien va rápido. */
  caso('y dos altas también', 4,
    conLoDelHueco(
      [h('b1', 'Uno'), h('b2', 'Dos')],
      [],
      [h('n1', 'Alta una'), h('n2', 'Alta dos')],
    ).length)

  /*
   * LO QUE NO PUEDE PASAR: QUE LO DE LA BASE DESAPAREZCA. Es el desastre que
   * evita el `cargado`, y la razón de que esto vaya por diferencia y no
   * repitiendo la orden de guardado. Si alguien cambia esta función para que
   * «lo del hueco manda», esta comprobación se pone roja.
   */
  const conservados = conLoDelHueco(
    [h('b1', 'Uno'), h('b2', 'Dos'), h('b3', 'Tres')],
    [],
    [h('nueva', 'Alta')],
  )
  caso('y no se pierde nada de lo que trajo la base', ['b1', 'b2', 'b3'],
    conservados.filter((x) => x.id.startsWith('b')).map((x) => x.id))

  // ---------------------------------------------------------------------
  // 2. SIN NADA EN EL HUECO, NO SE TOCA NADA.
  // ---------------------------------------------------------------------
  /*
   * Es el 99 % de las cargas, y tiene que ser idéntico a como era antes: la
   * misma lista que trae la base, en el mismo orden.
   */
  const deLaBase = [h('b1', 'Uno'), h('b2', 'Dos')]
  caso('sin tocar nada, la lista es la de la base', JSON.stringify(deLaBase),
    JSON.stringify(conLoDelHueco(deLaBase, [], [])))

  // ---------------------------------------------------------------------
  // 3. UN CAMBIO EN EL HUECO SOBRE UNA FILA QUE SÍ LLEGA.
  // ---------------------------------------------------------------------
  /*
   * Pasa al abrir una ficha desde el espejo y corregir algo antes de que llegue
   * la tabla. Manda lo del hueco: es más reciente y es lo único que no está
   * guardado en ningún sitio todavía.
   */
  caso('un cambio del hueco manda sobre lo que trae la base', 'Corregido',
    conLoDelHueco(
      [h('b1', 'Como estaba en la base')],
      [h('b1', 'Como estaba en la base')],
      [h('b1', 'Corregido')],
    )[0].nombre)

  /*
   * Y SI NO SE TOCÓ, NO SE PISA. Una fila que estaba en el hueco igual que
   * antes no puede pisar a la de la base: la de la base puede venir con algo
   * que cambió otra persona desde otro ordenador mientras esto cargaba.
   */
  caso('pero una fila del hueco sin tocar no pisa a la de la base', 'La de la base, más nueva',
    conLoDelHueco(
      [h('b1', 'La de la base, más nueva')],
      [h('b1', 'La vieja del espejo')],
      [h('b1', 'La vieja del espejo')],
    )[0].nombre)

  // ---------------------------------------------------------------------
  // 4. UN BORRADO EN EL HUECO.
  // ---------------------------------------------------------------------
  caso('un borrado del hueco se respeta', ['b2'],
    conLoDelHueco(
      [h('b1', 'La que se borró'), h('b2', 'La que se queda')],
      [h('b1', 'La que se borró'), h('b2', 'La que se queda')],
      [h('b2', 'La que se queda')],
    ).map((x) => x.id))

  /*
   * Y EL CASO QUE NO PUEDE DAR UN BORRADO MASIVO: el hueco empieza vacío —que es
   * lo que pasa de verdad— así que por mucho que la base traiga cuatrocientas
   * filas, de la diferencia no sale ni un borrado.
   */
  caso('con el hueco vacío no sale ningún borrado', 400,
    conLoDelHueco(
      Array.from({ length: 400 }, (_, i) => h(`b${i}`, `Hermano ${i}`)),
      [],
      [],
    ).length)

  // ---------------------------------------------------------------------
  // 5. UN ALTA QUE ADEMÁS LLEGA DE LA BASE (la misma fila por dos caminos).
  // ---------------------------------------------------------------------
  /*
   * Puede pasar con dos pestañas abiertas: se da el alta en una, la otra estaba
   * cargando y la trae ya. No se puede duplicar.
   */
  const sinRepetir = conLoDelHueco(
    [h('n1', 'La misma, desde la base')],
    [],
    [h('n1', 'La misma, desde el hueco')],
  )
  caso('la misma fila por los dos caminos no se duplica', 1, sinRepetir.length)

  // ---------------------------------------------------------------------
  // 6. Y QUE EL HOOK LO USE DE VERDAD.
  // ---------------------------------------------------------------------
  /*
   * La función de arriba puede estar perfecta y no estar enchufada. Estas tres
   * líneas son lo que hace que sirva, y las tres se pueden leer en la fuente.
   */
  const sync = sinComentarios(await fuente('src/lib/supabaseSync.ts'))
  caso('el hueco se apunta cuando la tabla no ha llegado', true,
    /elHueco\.current = \{ antes: elHueco\.current\?\.antes \?\? prev, despues: next \}/.test(sync))
  caso('y al cargar se reaplica encima de lo que trae la base', true,
    /conLoDelHueco\(traidos, hueco\.antes, hueco\.despues\)/.test(sync))
  /*
   * Y LO QUE DE VERDAD CIERRA EL AGUJERO: que eso se mande a la base. Sin esta
   * línea el alta se vería en la pantalla y no estaría guardada, que es la
   * versión peor del mismo fallo — porque entonces parece que sí está.
   */
  caso('y se manda a la base, que es lo que no pudo hacerse antes', true,
    /if \(hueco\) sincronizar\(tabla, traidos, definitivo, toRowRef\.current\)/.test(sync))
  /*
   * Y QUE NO SE HAYA «ARREGLADO» QUITANDO EL FRENO. Sincronizar con `cargado`
   * en falso es lo que borra el censo entero, y es la tentación obvia al leer
   * este código: la condición tiene que seguir ahí.
   */
  caso('el freno de no sincronizar sin haber cargado sigue puesto', true,
    /if \(cargado\.current\) sincronizar\(tabla, prev, next, toRowRef\.current\)/.test(sync))
}
