/**
 * LA ANTIGÜEDAD Y LO QUE SE RECONOCE POR ELLA.
 *
 * En una hermandad los años cuentan: a los veinticinco bodas de plata, a los
 * cincuenta de oro, a los setenta y cinco de diamante. Es lo primero que dice
 * un hermano mayor al presentar a alguien.
 *
 * Lo que se prueba aquí es lo que se enseña a una persona en un documento con
 * su nombre, y equivocarse tiene consecuencias sociales, no técnicas: darle
 * las bodas de plata a quien lleva veinticuatro años se nota, y quitárselas a
 * quien lleva veintiséis, más.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/distincionHermano.ts')

  // --- Los cortes, uno a uno ---
  caso('recién entrado', 'nuevo', m.distincionDe(0).modelo)
  caso('un año', 'hermano', m.distincionDe(1).modelo)
  caso('nueve años, todavía no', 'hermano', m.distincionDe(9).modelo)
  caso('diez, veterano', 'veterano', m.distincionDe(10).modelo)
  caso('veinticuatro, todavía no hay plata', 'veterano', m.distincionDe(24).modelo)
  caso('veinticinco, bodas de plata', 'plata', m.distincionDe(25).modelo)
  caso('cuarenta y nueve sigue siendo plata', 'plata', m.distincionDe(49).modelo)
  caso('cincuenta, bodas de oro', 'oro', m.distincionDe(50).modelo)
  caso('setenta y cuatro sigue siendo oro', 'oro', m.distincionDe(74).modelo)
  caso('setenta y cinco, bodas de diamante', 'diamante', m.distincionDe(75).modelo)
  // Nadie llega, pero si llega no se cae en un hueco.
  caso('y más allá, también', 'diamante', m.distincionDe(120).modelo)

  /*
   * SIN ANTIGÜEDAD REGISTRADA NO SE INVENTA NADA.
   *
   * Es el caso de verdad, no el raro: un censo importado de un Excel viejo
   * viene lleno de fichas sin año de alta. Poniéndole «de nuevo ingreso» a
   * alguien que lleva cuarenta años en la casa, el carné le llega insultando.
   */
  caso('sin antigüedad, ni nuevo ni condecorado', 'hermano', m.distincionDe(null).modelo)
  caso('y sin detalle que se pueda desmentir', '', m.distincionDe(null).detalle)
  caso('tampoco se dice que sea de este año', false, m.distincionDe(null).esteAnio)

  // --- Lo que se lee en la cinta ---
  caso('la plata se llama por su nombre', 'Bodas de plata', m.distincionDe(30).titulo)
  caso('el oro también', 'Bodas de oro', m.distincionDe(60).titulo)
  caso('y el detalle cuenta los años', '30 años en la hermandad', m.distincionDe(30).detalle)
  // Singular, que es donde se cuelan los «1 años».
  caso('un año va en singular', '1 año en la hermandad', m.distincionDe(1).detalle)
  caso('al recién entrado se le da la bienvenida', 'Bienvenido/a a la casa', m.distincionDe(0).detalle)

  // --- El año en que toca ---
  // Es lo que la hermandad necesita saber para el cabildo: a quién le tocan
  // las bodas de plata ESTE año.
  caso('el año justo de la plata se marca', true, m.distincionDe(25).esteAnio)
  caso('el siguiente ya no', false, m.distincionDe(26).esteAnio)
  caso('el del oro también', true, m.distincionDe(50).esteAnio)

  // --- Lo que viene ---
  /*
   * Solo las distinciones de CABILDO. Decirle a alguien que le faltan dos años
   * para ser «veterano» no significa nada: eso no se entrega en ningún sitio.
   */
  caso('a los 22, faltan 3 para la plata', 3, m.siguienteDistincion(22).faltan)
  caso('y se dice cuál es', 'Bodas de plata', m.siguienteDistincion(22).titulo)
  caso('a los 5 no se anuncia «veterano»', 'Bodas de plata', m.siguienteDistincion(5).titulo)
  caso('a los 25 lo siguiente es el oro', 'Bodas de oro', m.siguienteDistincion(25).titulo)
  caso('a los 48, faltan 2 para el oro', 2, m.siguienteDistincion(48).faltan)
  caso('con la de diamante ya no queda nada', null, m.siguienteDistincion(80))
  caso('y sin antigüedad tampoco se promete nada', null, m.siguienteDistincion(null))
}
