/**
 * EL DNI Y EL NIE, COMPROBADOS.
 *
 * Pedido por la hermandad piloto: «hay que revisar la introducción de datos y
 * caparlo, por ejemplo que en el DNI solo se puedan poner nueve números y una
 * letra».
 *
 * Son OCHO números y una letra (12345678Z), no nueve — nueve es lo que ocupa
 * el documento entero contando la letra. Y hace falta contemplar también el
 * NIE, que es otra cosa: una letra, siete números y otra letra (X1234567L). En
 * una hermandad hay NIE: costaleros, hermanos que vinieron de fuera, hijos de
 * familias extranjeras.
 *
 * Y NO SE VALIDA CONTANDO CARACTERES, que es lo que se pidió, sino
 * COMPROBANDO LA LETRA: sale de dividir el número entre 23, así que una errata
 * de un solo dígito se caza casi siempre. Contando caracteres, «12345679Z»
 * pasaría — y ese es justo el error que se comete al copiar de un papel.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/dni.ts')

  /*
   * 1. LA LETRA, QUE ES LO QUE DE VERDAD VALIDA. Los ejemplos están
   * calculados con la regla oficial: la letra número (n mod 23) de
   * «TRWAGMYFPDXBNJZSQVHLCKE».
   */
  {
    caso('00000000 lleva T', 'T', m.letraQueLeToca('00000000'))
    caso('12345678 lleva Z', 'Z', m.letraQueLeToca('12345678'))
    caso('00000023 vuelve a la T', 'T', m.letraQueLeToca('00000023'))
    caso('11111111 lleva H', 'H', m.letraQueLeToca('11111111'))
    caso('y se calcula igual con la letra ya puesta', 'Z', m.letraQueLeToca('12345678Z'))
  }

  /*
   * 2. EL NIE: la X, la Y y la Z valen 0, 1 y 2 y van DELANTE del número. Es
   * el detalle que se olvida siempre, y sin él TODOS los NIE que empiezan por
   * Y o por Z se darían por malos.
   */
  {
    caso('X0000000 se calcula como 00000000', 'T', m.letraQueLeToca('X0000000'))
    caso('Y0000000 se calcula como 10000000', m.letraQueLeToca('10000000'), m.letraQueLeToca('Y0000000'))
    caso('Z0000000 se calcula como 20000000', m.letraQueLeToca('20000000'), m.letraQueLeToca('Z0000000'))
    // Uno de verdad, para que no sea todo ceros.
    caso('X1234567 lleva L', 'L', m.letraQueLeToca('X1234567'))
  }

  // 3. Qué clase de documento es.
  {
    caso('un DNI se reconoce', 'dni', m.formaDeDocumento('12345678Z'))
    caso('un NIE también', 'nie', m.formaDeDocumento('X1234567L'))
    caso('escrito con puntos y guion, igual', 'dni', m.formaDeDocumento('12.345.678-Z'))
    caso('en minúsculas, igual', 'dni', m.formaDeDocumento('12345678z'))
    caso('un pasaporte no es ninguno de los dos', 'nada', m.formaDeDocumento('AB123456'))
    caso('ni nueve números y una letra', 'nada', m.formaDeDocumento('123456789Z'))
    caso('ni vacío', 'nada', m.formaDeDocumento(''))
  }

  /*
   * 4. VÁLIDO O NO. Y aquí está lo que no haría contar caracteres: cambiar un
   * dígito da un documento con la forma perfecta y la letra mala.
   */
  {
    caso('12345678Z vale', true, m.documentoValido('12345678Z'))
    caso('X1234567L vale', true, m.documentoValido('X1234567L'))
    caso('12345678A NO vale, aunque lo parezca', false, m.documentoValido('12345678A'))
    caso('un dígito cambiado se caza', false, m.documentoValido('12345679Z'))
    caso('con puntos y guion sigue valiendo', true, m.documentoValido('12.345.678-Z'))
    caso('vacío no vale', false, m.documentoValido(''))
  }

  /*
   * 5. LOS MENSAJES. Dicen QUÉ HACER y no «formato inválido»: quien está en
   * secretaría con el hermano delante necesita saber si le falta la letra, si
   * sobra un número o si se ha equivocado al copiar, que son tres arreglos
   * distintos.
   */
  {
    caso('lo válido no se queja', null, m.problemaDeDocumento('12345678Z'))
    caso('un NIE válido tampoco', null, m.problemaDeDocumento('X1234567L'))
    // Vacío NO es un error: es un campo sin rellenar, y de exigirlo se encarga
    // el formulario. Marcarlo en rojo mientras se teclea sería insufrible.
    caso('vacío no es un error', null, m.problemaDeDocumento(''))

    const sinLetra = m.problemaDeDocumento('12345678')
    caso('sin letra lo dice', true, /Falta la letra/.test(sinLetra))
    const cortas = m.problemaDeDocumento('1234')
    caso('con pocas cifras dice cuántas hay', true, /aquí hay 4/.test(cortas))
    const largas = m.problemaDeDocumento('1234567890')
    caso('con demasiadas, también', true, /Sobran cifras/.test(largas))
    // El caso más útil de todos: la letra mala. Dice cuál toca Y dónde mirar.
    const letraMala = m.problemaDeDocumento('12345678A')
    caso('la letra mala dice cuál toca', true, /le toca la «Z»/.test(letraMala))
    caso('y avisa de que suele ser el número', true, /número mal copiado/.test(letraMala))
    // Y algo que no es ninguna de las dos cosas explica las dos formas.
    const raro = m.problemaDeDocumento('AB123456')
    caso('un pasaporte explica las dos formas', true, /12345678Z/.test(raro) && /X1234567L/.test(raro))
  }

  /*
   * 6. Y QUE ESTÉ ENCHUFADO DONDE SE TECLEA. De nada sirve la comprobación si
   * las tres pantallas que piden un DNI a mano siguen aceptando cualquier cosa.
   */
  {
    const { readFile } = await import('node:fs/promises')
    for (const [donde, ruta] of [
      ['el alta de un hermano', 'src/pages/app/Hermanos.tsx'],
      ['el alta de un cargo', 'src/pages/app/Personal.tsx'],
      ['el alta desde la web', 'src/components/FormulariosWeb.tsx'],
    ]) {
      const src = await readFile(ruta, 'utf8')
      caso(`${donde} comprueba el documento`, true, /problemaDeDocumento/.test(src))
    }
    // Y el de la web ya NO valida contando caracteres, que dejaba pasar la
    // errata de un dígito.
    const web = await readFile('src/components/FormulariosWeb.tsx', 'utf8')
    caso('y el de la web ya no cuenta caracteres', false, /datos\.dni\.trim\(\)\.length < 8/.test(web))
  }

  /*
   * 7. Y LO QUE NO SE TOCA: `limpiarDni` sigue sin validar nada. Los censos
   * antiguos vienen con erratas, y una hermandad que no puede importar su
   * censo no puede empezar a usar la aplicación. La validación es para lo que
   * se teclea hoy, no para lo que viene de un Excel de hace quince años.
   */
  {
    caso('limpiar sigue aceptando lo que sea', '99', m.limpiarDni('9-9'))
    caso('y no lo juzga', '12345678A', m.limpiarDni('12.345.678-a'))
    const { readFile } = await import('node:fs/promises')
    const importar = await readFile('src/lib/importar.ts', 'utf8')
    caso('el importador NO rechaza por la letra', false, /documentoValido|problemaDeDocumento/.test(importar))
  }
}
