/**
 * «AVISADME DE LOS CULTOS».
 *
 * Una lista de correos de gente que no es hermano. Casi todo lo que hay que
 * probar aquí no es técnico: es lo que exige el RGPD y lo que separa una lista
 * legítima de una lista que acaba en spam o en multa.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/suscriptoresWeb.ts')

  /*
   * --- LA PRUEBA DEL CONSENTIMIENTO ---
   *
   * Se guarda el TEXTO que aceptó, no un «sí». Un «marcó la casilla» sin el
   * texto no demuestra nada, porque el texto puede haber cambiado veinte veces
   * desde entonces. Y lleva el nombre de la hermandad: aceptar que «una
   * hermandad» guarde tu correo no es aceptar nada.
   */
  const texto = m.textoDelConsentimiento('Hdad. de la Vera-Cruz')
  caso('el consentimiento nombra a la hermandad', true, texto.includes('Hdad. de la Vera-Cruz'))
  caso('dice para qué se usa', true, /cultos/i.test(texto))
  // Y que se puede uno ir. Es obligatorio decirlo AL PEDIRLO, no después.
  caso('y que puede darse de baja', true, /baja/i.test(texto))
  // Sin nombre no se queda en blanco: diría «Acepto que  guarde mi correo».
  caso('sin nombre no queda un hueco', true, m.textoDelConsentimiento('').includes('la hermandad'))

  /*
   * --- LOS CORREOS ---
   *
   * Una comprobación mínima, no una validación completa: la de verdad la hace
   * el correo de confirmación. Aquí solo se paran los despistes evidentes, que
   * son la mayoría.
   */
  caso('un correo normal vale', true, m.pareceUnCorreo('manuel@ejemplo.com'))
  caso('con subdominio también', true, m.pareceUnCorreo('m@correo.hdad-veracruz.es'))
  caso('sin arroba no', false, m.pareceUnCorreo('manuel.ejemplo.com'))
  caso('sin punto detrás tampoco', false, m.pareceUnCorreo('manuel@ejemplo'))
  caso('con un espacio en medio, no', false, m.pareceUnCorreo('ma nuel@ejemplo.com'))
  caso('vacío no', false, m.pareceUnCorreo(''))
  // Los espacios de los lados los mete todo el mundo al copiar y pegar: no
  // pueden tirar un alta.
  caso('los espacios de los lados no estorban', true, m.pareceUnCorreo('  manuel@ejemplo.com  '))

  /*
   * --- A QUIÉN SE LE PUEDE ESCRIBIR ---
   *
   * SOLO A LOS CONFIRMADOS, y esto es lo más importante del fichero. Escribir a
   * quien no ha confirmado es lo que hace que los envíos de la hermandad acaben
   * marcados como spam — y en el peor caso, escribirle a alguien que nunca
   * pidió nada porque otro apuntó su correo.
   */
  const lista = [
    { id: '1', email: 'a@x.es', nombre: '', confirmado: true, altaEn: '', origen: 'web' },
    { id: '2', email: 'b@x.es', nombre: '', confirmado: false, altaEn: '', origen: 'web' },
    { id: '3', email: 'c@x.es', nombre: '', confirmado: true, altaEn: '', origen: 'web' },
  ]
  caso('solo se avisa a los confirmados', 2, m.losQueSePuedenAvisar(lista).length)
  caso('y el sin confirmar se queda fuera', false,
    m.losQueSePuedenAvisar(lista).some((s) => s.email === 'b@x.es'))
  caso('con la lista vacía, nadie', 0, m.losQueSePuedenAvisar([]).length)

  /*
   * --- LOS ENLACES DE LOS CORREOS ---
   *
   * El de baja va en TODOS los avisos: es obligatorio y es lo que evita que
   * quien ya no quiere recibirlos marque el correo como spam, que le hace más
   * daño a la hermandad que perder un suscriptor.
   */
  const llave = 'a1b2c3'
  caso('el enlace de confirmar lleva la llave', 'https://hdad.es/avisos?c=a1b2c3',
    m.enlaceDeConfirmacion('https://hdad.es', llave))
  caso('el de baja también', 'https://hdad.es/avisos?baja=a1b2c3',
    m.enlaceDeBaja('https://hdad.es', llave))
  // Y la llave va escapada: si algún día lleva un carácter raro, no puede
  // partir la dirección por la mitad.
  caso('la llave va escapada', true, m.enlaceDeBaja('https://hdad.es', 'a b&c').includes('a%20b%26c'))

  /*
   * --- SIN SUPABASE ---
   *
   * Modo demostración. Lo que importa es que se DIGA que no se ha podido, y no
   * que se conteste que sí: alguien que cree que está apuntado no vuelve a
   * intentarlo, y se queda fuera sin saberlo.
   */
  const r = await m.suscribirse('manuel@ejemplo.com', 'Manuel', 'Vera-Cruz')
  caso('sin base de datos no se apunta', false, r.ok)
  caso('y se dice, no se calla', true, r.error.length > 0)
  caso('confirmar sin base devuelve que no', false, await m.confirmar('loquesea'))
  caso('darse de baja tampoco miente', false, await m.darseDeBaja('loquesea'))
  caso('y la lista sale vacía, no inventada', 0, (await m.getSuscriptores()).length)

  // Un correo mal escrito se para ANTES de llamar a nadie.
  const malo = await m.suscribirse('no-es-un-correo', '', 'Vera-Cruz')
  caso('un correo mal escrito no llega ni a intentarse', false, malo.ok)
  caso('y se dice qué pasa', true, /correo/i.test(malo.error))
}
