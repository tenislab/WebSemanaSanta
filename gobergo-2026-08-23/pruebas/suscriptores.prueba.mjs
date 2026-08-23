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
  /*
   * EL DE CONFIRMAR YA NO SE CONSTRUYE AQUÍ, y es a propósito: lo arma el
   * servidor, porque lleva la llave dentro y la llave no puede pasar por el
   * navegador. Se comprueba abajo, contra la función de envío.
   */
  caso('el de baja lleva la llave', 'https://hdad.es/avisos?baja=a1b2c3',
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

  await laLlaveNoSaleDeLaBase({ caso })
}

/**
 * LA LLAVE NO PUEDE SALIR DE LA BASE, Y EL CORREO DE CONFIRMAR TIENE QUE SALIR.
 *
 * Dos fallos que iban de la mano, y los dos en el mismo sitio: el alta desde la
 * web pública, que la puede pedir cualquiera sin identificarse.
 *
 * EL PRIMERO. `suscribirse_a_la_web` DEVOLVÍA LA LLAVE. La llave es lo único
 * que hace falta para confirmar un alta y para darla de baja, y encima, por el
 * «on conflict … returning», cuando el correo YA ESTABA no devolvía una nueva:
 * devolvía LA DE ESA PERSONA. Comprobado contra un Postgres de verdad: se pide
 * el alta de un correo que ya está en la lista y vuelve su misma llave. Con la
 * dirección de alguien —que no es ningún secreto— se podía:
 *
 *   · Confirmar su alta sin que llegara a ver el correo. Y entonces la
 *     hermandad tiene guardado «esta persona confirmó tal día», que es LA
 *     PRUEBA del consentimiento, y es falsa: se pone a escribirle a alguien que
 *     nunca pidió nada, con un papel que dice que sí.
 *   · O darla de baja. Una dirección detrás de otra, y la lista se vacía sin
 *     que se entere nadie.
 *
 * EL SEGUNDO, y por eso no saltaba a la vista: EL CORREO DE CONFIRMAR NO SE
 * MANDABA NUNCA. Nadie llamaba a quien armaba el enlace. Quien se apunta desde
 * la web no tiene sesión, y la función de envío la exigía — así que no había
 * ninguna forma de mandarlo. El formulario decía «te hemos mandado un correo» y
 * no salía ninguno; y como a los sin confirmar no se les escribe, la lista se
 * llenaba de gente a la que la hermandad no podía avisar de nada y el
 * comunicado «a los suscriptores» llegaba a cero personas.
 *
 * Se arregla en tres sitios a la vez, y esta prueba mira los tres.
 */
async function laLlaveNoSaleDeLaBase({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile('supabase/suscriptores-web.sql', 'utf8')
  const edge = await readFile('supabase/functions/enviar-correo/index.ts', 'utf8')
  const lib = await readFile('src/lib/suscriptoresWeb.ts', 'utf8')

  // --- 1. La función de apuntarse no devuelve la llave. Devuelve sí o no.
  const apuntarse = sql.match(/create or replace function suscribirse_a_la_web\(([\s\S]*?)\nend \$\$;/)
  caso('la función de apuntarse existe', true, apuntarse !== null)
  caso('devuelve sí o no, no la llave', true, /\) returns boolean/.test(apuntarse[1]))
  caso('y no hay ningún «returning llave» ahí', false, /returning\s+llave/.test(apuntarse[1]))
  // Se recrea con `drop` delante: cambiar lo que devuelve no lo hace `replace`
  // solo, y sin esto la base de quien ya lo tenía instalado se queda igual.
  caso('se borra la versión vieja antes', true,
    /drop function if exists suscribirse_a_la_web\(uuid, text, text, text\);/.test(sql))

  // --- 2. La llave sale por una puerta, y solo para el servidor.
  caso('hay una función aparte para la llave', true, /function llave_para_confirmar\(/.test(sql))
  caso('y no se le da a nadie de fuera', true,
    /revoke all on function llave_para_confirmar\(uuid, text\) from public, anon, authenticated;/.test(sql))
  caso('solo al servidor', true,
    /grant execute on function llave_para_confirmar\(uuid, text\) to service_role;/.test(sql))
  const dados = [...sql.matchAll(/grant execute on function llave_para_confirmar[^;]*;/g)].join(' ')
  caso('nunca a anon', false, /llave_para_confirmar[\s\S]*?to[^;]*\banon\b/.test(dados))

  /*
   * Y NO SIRVE PARA PREGUNTAR QUIÉN ESTÁ EN LA LISTA: solo devuelve algo si ese
   * correo está apuntado Y sin confirmar Y no se le mandó nada hace poco. Ese
   * «hace poco» es el freno de verdad: sin él, pedir mil veces la confirmación
   * con el correo de otra persona le llena la bandeja, firmado por la hermandad.
   */
  const puerta = sql.match(/create or replace function llave_para_confirmar\(([\s\S]*?)\nend \$\$;/)[1]
  caso('no da la llave de uno ya confirmado', true, /and not confirmado/.test(puerta))
  caso('ni dos veces seguidas', true, /confirmacion_enviada_en < now\(\) - interval '10 minutes'/.test(puerta))
  caso('y deja apuntado el envío en la misma consulta', true,
    /set confirmacion_enviada_en = now\(\)/.test(puerta))
  caso('la columna del envío se crea', true,
    /add column if not exists confirmacion_enviada_en timestamptz/.test(sql))

  // --- El freno de las altas. Esto lo llama cualquiera desde fuera.
  caso('hay un tope de altas por hora', true, /v_recientes >= 60/.test(apuntarse[1]))
  caso('y se cuenta por hermandad', true,
    /from suscriptores_web\s*\n\s*where hermandad_id = p_hermandad_id and alta_en > now\(\) - interval '1 hour'/.test(apuntarse[1]))

  // --- 3. El correo lo manda el servidor, y ahora sí sale.
  caso('la función de envío sabe confirmar suscripciones', true, /async function mandarConfirmacion/.test(edge))
  caso('y esa rama va antes de pedir sesión', true,
    edge.indexOf('if (suscripcion) return await mandarConfirmacion') < edge.indexOf('const permiso = await quienLlama(req)'))
  caso('lee la llave con la clave de servicio', true,
    /rpc\/llave_para_confirmar[\s\S]{0,400}?Bearer \$\{SERVICE_KEY\}/.test(edge))
  /*
   * EL ENLACE TIENE QUE CUADRAR CON LA PÁGINA QUE LO LEE. `AvisosWeb.tsx` lee
   * el parámetro «c»; si aquí se escribiera otro, el enlace del correo abriría
   * la página y no confirmaría nada — y no lo notaría nadie hasta que alguien
   * se quejara de que no le llegan los avisos.
   */
  const avisos = await readFile('src/pages/AvisosWeb.tsx', 'utf8')
  caso('el enlace del correo lleva «?c=»', true, /\/avisos\?c=\$\{encodeURIComponent/.test(edge))
  caso('y la página lee ese mismo parámetro', true, /params\.get\('c'\)/.test(avisos))

  /*
   * Y NO SE FÍA DE LA DIRECCIÓN QUE LE DIGA EL NAVEGADOR. Si la aceptara tal
   * cual, cualquiera podría hacer que la hermandad mandara —con su nombre y
   * desde su dominio verificado— un correo con un enlace a otro sitio. Eso es
   * la materia prima de una suplantación creíble.
   */
  caso('el destino del enlace se comprueba', true, /function origenDeConfianza/.test(edge))
  caso('solo su dominio o un subdominio suyo', true,
    /hostname === base\.hostname \|\| suyo\.hostname\.endsWith\(`\.\$\{base\.hostname\}`\)/.test(edge))
  caso('y solo por https', true, /suyo\.protocol !== 'https:'/.test(edge))

  // --- 4. El cliente ya no recibe ninguna llave, y dice la verdad.
  caso('el alta no devuelve llave', false, /ok: true; llave/.test(lib))
  caso('devuelve si el correo ha salido', true, /ok: true; correoEnviado: boolean/.test(lib))
  caso('y el alta pide que se mande', true, /correoEnviado: await pedirConfirmacion\(/.test(lib))

  /*
   * Y EL FORMULARIO NO DICE «MIRA TU BANDEJA» SI NO HA SALIDO NADA. Quien lee
   * eso espera un correo que no va a llegar; y como sin confirmar no se le
   * escribe nunca, se queda fuera para siempre creyendo que está dentro.
   */
  const form = await readFile('src/components/FormulariosWeb.tsx', 'utf8')
  caso('el acuse depende de si salió el correo', true,
    /setHecho\(r\.correoEnviado \? 'concorreo' : 'sincorreo'\)/.test(form))
  caso('y hay un acuse distinto para cuando no salió', true, /hecho === 'sincorreo'/.test(form))

  /*
   * --- Y LOS QUE YA ESTÁN APUNTADOS SIN CONFIRMAR ---
   *
   * Son todos: durante todo este tiempo ese correo no se mandó nunca. Sin una
   * forma de reenviárselo se quedarían ahí para siempre, guardados y sin poder
   * recibir un solo aviso.
   */
  caso('se pueden reenviar las confirmaciones', true, /export async function reenviarConfirmaciones/.test(lib))
  caso('de cinco en cinco, como el resto de envíos', true,
    /const DE_UNA_VEZ = 5[\s\S]{0,400}?pedirConfirmacion\(hermandadId, s\.email\)/.test(lib))
  const panel = await readFile('src/pages/app/Comunicados.tsx', 'utf8')
  caso('y el panel lo ofrece donde se nota la falta', true,
    /destinatarioNuevo === SEGMENTO_SUSCRIPTORES && pendientes\.length > 0/.test(panel))
  caso('diciendo cuántos han salido y cuántos no', true, /y \$\{fallidos\} sin salir/.test(panel))

  /*
   * Y TAMBIÉN DONDE SE VE EL ESTADO. En el editor de la web está la lista de
   * suscriptores con su «Sin confirmar»: es ahí donde alguien se da cuenta de
   * que están todos, así que ahí tiene que estar la salida. Estar solo en
   * Comunicados obliga a empezar a escribir un comunicado para arreglarlo.
   */
  const editor = await readFile('src/pages/app/WebPublica.tsx', 'utf8')
  caso('la lista de suscriptores también lo ofrece', true,
    /pendientes\.length > 0 && \(/.test(editor))
  caso('con la misma función, no con otra copia', true,
    /reenviarConfirmaciones\(hermandadId, pendientes\)/.test(editor))
}
