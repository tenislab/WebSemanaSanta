/**
 * «NO ME LLEGAN LOS MAILS», SIN UN SOLO ERROR.
 *
 * De un aviso de la hermandad piloto, y de los peores que hay: no traía nada
 * que investigar. Ni fallo, ni pantalla roja, ni nada en la consola. La
 * aplicación decía «enviado» y no llegaba ningún correo.
 *
 * LA CAUSA ES UNA TRAMPA DE CONFIGURACIÓN. Si no se pone el secreto
 * `CORREO_REMITENTE`, se envía desde `onboarding@resend.dev`, que es el
 * remitente de pruebas de Resend. Y Resend SOLO entrega desde él a la
 * dirección con la que te registraste: a cualquier otra la acepta, contesta
 * 200, y no la entrega jamás.
 *
 * Todo dice que sí y no llega nada. Es la peor forma posible de fallar, porque
 * no deja nada que mirar — y mandar otro correo de prueba tampoco sirve, que
 * es lo único que se podía hacer antes.
 *
 * Lo que se comprueba aquí: que la función lo DELATE, y que la pantalla sepa
 * decir qué falta y en qué orden.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const fn = await readFile('supabase/functions/enviar-correo/index.ts', 'utf8')

  /*
   * 1. LA FUNCIÓN DELATA EL REMITENTE DE PRUEBAS, y en TODAS sus respuestas.
   * El aviso se pone en `respuesta()` a propósito y no rama por rama: son ocho
   * ramas distintas y la novena se olvidaría — y la novena sería justo la que
   * alguien esté depurando.
   */
  caso('la función reconoce el remitente de pruebas', true, /REMITENTE_DE_PRUEBA/.test(fn))
  caso('y avisa en todas sus respuestas', true,
    /function respuesta\([\s\S]{0,400}avisoDelRemitente\(\)/.test(fn))
  caso('sin bloquear el envío, que para probar sirve', false,
    /if \(conElRemitenteDePrueba\(\)\) return respuesta\(\{ error/.test(fn))

  /*
   * 2. Y CONTESTA QUÉ LE FALTA, sin sesión: si lo que está roto es la
   * configuración, exigir una sesión para poder mirarla es cerrar la puerta
   * justo cuando hace falta abrirla.
   */
  caso('hay una rama de diagnóstico', true, /cuerpoCrudo\.diagnostico === true/.test(fn))
  caso('y va antes del control de sesión', true,
    fn.indexOf('cuerpoCrudo.diagnostico === true') < fn.indexOf('const permiso = await quienLlama'))

  /*
   * 3. NO DEVUELVE NI UN SECRETO. Esto se mira con lupa: una rama pública que
   * lee variables de entorno es exactamente por donde se filtra una clave.
   * Solo pueden salir booleanos y el dominio, que es público —va en cada
   * correo que sale—.
   */
  const rama = fn.match(/if \(cuerpoCrudo\.diagnostico === true\)[\s\S]*?\n  \}/)?.[0] ?? ''
  caso('la rama de diagnóstico existe', true, rama.length > 0)
  for (const secreto of ['RESEND_API_KEY', 'SERVICE_KEY', 'ANON_KEY']) {
    // Vale `Boolean(SECRETO)` —eso es un sí o un no— pero nunca el valor.
    const suelto = new RegExp(`[^(]\\b${secreto}\\b(?!\\))`)
    caso(`no se devuelve ${secreto}`, false, suelto.test(rama.replace(/Boolean\([^)]*\)/g, 'X')))
  }
  caso('del remitente solo sale el dominio', true, /remitente\.split\('@'\)\[1\]/.test(rama))
  caso('y no la dirección entera', false, /dominioRemitente: remitente,/.test(rama))

  /*
   * 4. LAS FRASES, Y SU ORDEN. Primero lo que impide que salga nada, después
   * lo que hace que salga y no llegue, y al final lo que solo afecta a dos
   * correos concretos. Un diagnóstico desordenado se lee de arriba abajo y se
   * arregla lo que menos importa.
   */
  const m = await cargar('src/lib/correo.ts')
  const todo = {
    claveDeResend: true, remitentePropio: true, dominioRemitente: 'gobergo.es',
    claveDeServicio: true, urlDeSupabase: true, listoParaEnviar: true, listoParaContrasenas: true,
  }
  caso('con todo puesto, no falta nada', 0, m.loQueLeFaltaAlCorreo(todo).length)

  {
    const sinNada = m.loQueLeFaltaAlCorreo({
      ...todo, claveDeResend: false, remitentePropio: false, claveDeServicio: false,
    })
    caso('sin nada puesto, tres cosas', 3, sinNada.length)
    caso('primero la clave, que impide que salga nada', true, /RESEND_API_KEY/.test(sinNada[0]))
    caso('después el remitente', true, /onboarding@resend\.dev/.test(sinNada[1]))
    caso('y al final la clave de servicio', true, /SUPABASE_SERVICE_ROLE_KEY/.test(sinNada[2]))
  }

  /*
   * 5. EL CASO QUE MOTIVÓ TODO ESTO: la clave está, el envío contesta que sí,
   * y no llega nada. Tiene que salir UNA sola cosa, y tiene que decir con
   * todas las letras que no da ningún error — que es lo que hace que nadie
   * sospeche de ella.
   */
  {
    const soloElRemitente = m.loQueLeFaltaAlCorreo({ ...todo, remitentePropio: false })
    caso('con solo el remitente mal, una cosa', 1, soloElRemitente.length)
    caso('y dice que no da ningún error', true, /sin dar ningún error/.test(soloElRemitente[0]))
    caso('y qué hay que hacer', true, /CORREO_REMITENTE/.test(soloElRemitente[0]))
  }

  /*
   * 6. Y LA CLAVE DE SERVICIO NO IMPIDE LOS CORREOS NORMALES, solo dos: el de
   * cambiar la contraseña y el resguardo de una reserva. Decir «no funciona el
   * correo» cuando el 95 % funciona manda a arreglar lo que no está roto.
   */
  {
    const soloServicio = m.loQueLeFaltaAlCorreo({ ...todo, claveDeServicio: false })
    caso('sin clave de servicio, una cosa', 1, soloServicio.length)
    caso('y aclara que los normales salen igual', true, /salen igual/.test(soloServicio[0]))
    caso('y cuáles no', true, /contraseña/.test(soloServicio[0]))
  }

  // 7. Y la pantalla tiene el botón, que es de donde sale todo esto.
  const cfg = await readFile('src/pages/app/Configuracion.tsx', 'utf8')
  caso('Configuración pregunta qué falta', true, /diagnosticarCorreo/.test(cfg))
  caso('con su botón', true, /No me llegan: ¿qué falta\?/.test(cfg))
  // Y al mandar la prueba también se mira: es el único caso en que «enviado» y
  // «no llega» conviven, y hay que decirlo antes de que alguien se pase la
  // tarde mirando la carpeta de spam.
  caso('y también al mandar la prueba', true, /if \(r\.ok\) void mirarQueFalta\(\)/.test(cfg))

  await elResponderAMalEscrito({ caso })
}

/**
 * Y LA SEGUNDA FORMA DE NO MANDAR NADA: EL «RESPONDER A» MAL ESCRITO.
 *
 * De la misma hermandad, semanas después, y con la misma pinta desde fuera:
 * no sale ningún correo. Pero esta vez SÍ había error, y encima uno que
 * apuntaba al sitio equivocado:
 *
 *     422 validation_error · Invalid `reply_to` field.
 *
 * A `reply_to` iba, sin comprobarlo, lo que hubiera en «Configuración →
 * Correo → A dónde contestan los hermanos»; y si estaba vacío, el correo de
 * la ficha de la hermandad. Ninguno de los dos se miraba nunca.
 *
 * Y Resend no acepta ese campo a medias: si no tiene forma de dirección
 * RECHAZA EL ENVÍO ENTERO. No manda el correo sin «responder a» — no manda
 * nada. Así que un «secretaria» sin dominio, o el nombre de la hermandad
 * escrito ahí por confusión, dejaba a la hermandad sin poder mandar una
 * convocatoria de papeletas, con un error que hablaba del proveedor.
 *
 * La regla: el correo SALE SIEMPRE. Perder el «responder a» es un incordio
 * pequeño; perder la convocatoria, no.
 */
async function elResponderAMalEscrito({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const fn = await readFile('supabase/functions/enviar-correo/index.ts', 'utf8')

  /*
   * Se ejecuta la función de verdad, no se mira si el texto está: una prueba
   * que solo busca el nombre se queda verde el día que alguien invierta la
   * condición. Se le quitan los tipos para poder correrla en Node; si eso
   * dejara de funcionar, esta prueba se cae, que es lo correcto — significa
   * que la función ha cambiado de forma y hay que volver a mirarla.
   */
  const trozo = fn.slice(fn.indexOf('const ES_CORREO'), fn.indexOf('function replyToValido'))
    + fn.slice(fn.indexOf('function replyToValido'), fn.indexOf('/** El aviso que acompaña'))
  const enJs = trozo
    .replace(/: \(string \| undefined\)\[\]/g, '')
    .replace(/: string \| null/g, '')
    .replace(/: string/g, '')
    .replace(/: boolean/g, '')
  const replyToValido = new Function(`${enJs}; return replyToValido`)()

  caso('una dirección buena pasa', 'secretaria@hermandad.es',
    replyToValido('secretaria@hermandad.es'))
  caso('con espacios alrededor, se limpia', 'secretaria@hermandad.es',
    replyToValido('  secretaria@hermandad.es  '))

  // El fallo que tumbaba el envío entero, en sus tres formas habituales.
  caso('sin dominio, fuera', null, replyToValido('secretaria'))
  caso('un nombre escrito por confusión, fuera', null, replyToValido('Hermandad de la Vera-Cruz'))
  caso('sin punto en el dominio, fuera', null, replyToValido('secretaria@hermandad'))
  caso('dos direcciones juntas, fuera', null,
    replyToValido('secretaria@hermandad.es, tesoreria@hermandad.es'))

  // Vacío no es un error: es «no pongas reply_to», que es perfectamente válido.
  caso('vacío no pone nada', null, replyToValido(''))
  caso('sin nada configurado, nada', null, replyToValido(undefined, undefined))

  /*
   * Y SI LA HERMANDAD CONFIGURÓ UNA MALA, NO SE CAE A LA SIGUIENTE.
   *
   * Sería peor: mandaría las respuestas de los hermanos a una dirección que
   * nadie ha elegido, y sin decirlo. Mejor sin «responder a» y con el aviso
   * en el registro.
   */
  caso('una mala no cae a la de reserva', null,
    replyToValido('secretaria', 'ficha@hermandad.es'))
  caso('pero vacía sí deja pasar la de reserva', 'ficha@hermandad.es',
    replyToValido('', 'ficha@hermandad.es'))

  // Y que el envío no dependa de esto: `reply_to` solo se pone si vale.
  caso('reply_to va comprobado', true,
    /\.\.\.\(responderA \? \{ reply_to: responderA \} : \{\}\)/.test(fn))
  caso('y si no valía, queda apuntado', true,
    /console\.error\([\s\S]{0,120}responder a/.test(fn))

  // La pantalla lo dice donde se arregla, que es el campo mismo.
  const cfg = await readFile('src/pages/app/Configuracion.tsx', 'utf8')
  caso('Configuración avisa del formato', true,
    /no tiene forma de dirección de correo/.test(cfg))
}
