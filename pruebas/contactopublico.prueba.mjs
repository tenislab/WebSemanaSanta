/**
 * EL CORREO PERSONAL DEL SECRETARIO, PUBLICADO EN LA WEB DE LA HERMANDAD.
 *
 * Llegó dicho así: «el contacto de la web pone mis datos, no los de la
 * hermandad». Y era verdad: en la web salían su dirección, su móvil y su
 * gmail, a la vista de cualquiera.
 *
 * No había ningún fallo de código. El editor de la web tiene tres campos
 * —dirección, teléfono y correo—, y si se dejan vacíos se publica lo que haya
 * en Configuración. Eso estaba escrito en una línea encima de los campos, y el
 * valor heredado se enseñaba como PLACEHOLDER.
 *
 * Ahí estaba el fallo. Un placeholder es texto gris: se lee como un ejemplo de
 * lo que podrías escribir, jamás como lo que ya está publicado. Los tres
 * campos parecían vacíos, y quien los miró entendió que no se publicaba nada.
 *
 * Así que ahora se calcula LO QUE SE VE en la web y se enseña escrito debajo
 * de cada campo, y se avisa cuando lo heredado tiene pinta de ser de una
 * persona y no de una hermandad.
 */
import { readFileSync } from 'node:fs'

const leer = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/contactoPublico.ts')

  const HDAD = { direccion: 'C/ Pureza 53', telefono: '954 000 000', email: 'secretaria@hdad.es' }
  const VACIA = { direccion: '', telefono: '', email: '' }

  // --- De dónde sale cada dato.
  const soloHermandad = m.contactoQueSePublica(VACIA, HDAD)
  caso('con la web vacía se publica lo de la hermandad', 'C/ Pureza 53', soloHermandad.direccion.valor)
  caso('y se sabe que viene heredado', 'hermandad', soloHermandad.direccion.origen)

  const propia = m.contactoQueSePublica({ ...VACIA, email: 'hola@hdad.es' }, HDAD)
  caso('lo escrito en la web manda', 'hola@hdad.es', propia.email.valor)
  caso('y se sabe que es suyo', 'web', propia.email.origen)

  // Los espacios no cuentan como haber escrito algo: un campo con un espacio
  // se ve vacío y tiene que comportarse como vacío.
  caso('un campo con solo espacios sigue siendo vacío', 'hermandad',
    m.contactoQueSePublica({ ...VACIA, telefono: '   ' }, HDAD).telefono.origen)

  caso('sin nada en ningún sitio, no se publica nada', 'nada',
    m.contactoQueSePublica(VACIA, VACIA).email.origen)

  /*
   * --- EL AVISO.
   *
   * Es el caso que llegó: gmail heredado de Configuración. Tiene que avisar.
   */
  const conGmail = m.contactoQueSePublica(VACIA, { ...HDAD, email: 'jaimerivasgranada@gmail.com' })
  caso('avisa de que se está publicando un correo personal', true,
    (m.avisoDeDatoPersonal(conGmail.email, 'email') ?? '').includes('personal'))

  const conMovil = m.contactoQueSePublica(VACIA, { ...HDAD, telefono: '618648370' })
  caso('avisa de que se está publicando un móvil', true,
    (m.avisoDeDatoPersonal(conMovil.telefono, 'telefono') ?? '').includes('móvil'))
  caso('y también con el prefijo delante', true,
    m.telefonoDeMovil('+34 618 64 83 70'))
  caso('un fijo de hermandad no dispara el aviso', false, m.telefonoDeMovil('954 00 00 00'))

  // Un correo de la hermandad no avisa de nada: si avisara siempre, el aviso
  // dejaría de leerse y volveríamos al principio.
  caso('un correo de la hermandad no avisa', null, m.avisoDeDatoPersonal(soloHermandad.email, 'email'))

  /*
   * Y NO AVISA DE LO ESCRITO A MANO. Si alguien pone su gmail en el campo de la
   * web es porque lo ha decidido; el aviso es para el dato que se publica sin
   * que nadie lo haya mirado.
   */
  const gmailAdrede = m.contactoQueSePublica({ ...VACIA, email: 'yo@gmail.com' }, HDAD)
  caso('lo escrito a propósito no se discute', null, m.avisoDeDatoPersonal(gmailAdrede.email, 'email'))

  /*
   * --- LA MISMA REGLA EN LOS DOS SITIOS.
   *
   * Quien PINTA la web hace `web.x || hermandad.x` por su cuenta. Si algún día
   * una de las dos reglas cambia, el editor enseñaría una cosa y la web
   * publicaría otra — que es exactamente el fallo del que venimos.
   */
  const sitio = leer('src/components/SitioContenido.tsx')
  for (const campo of ['direccion', 'telefono', 'email']) {
    const dice = campo === 'email'
      ? sitio.includes('const email = web.email || hermandad.email')
      : sitio.includes(`web.${campo} || hermandad.${campo}`)
    caso(`la web publica ${campo} con la misma regla que enseña el editor`, true, dice)
  }
  // Y con los mismos datos, las dos dan lo mismo.
  caso('editor y web coinciden en lo heredado', true,
    m.contactoQueSePublica(VACIA, HDAD).email.valor === (VACIA.email || HDAD.email))

  /*
   * --- Y EL PLACEHOLDER YA NO ES EL VALOR PUBLICADO.
   *
   * Esta es la que habría cazado el fallo: mientras el placeholder sea
   * `hermandad.algo`, el campo sigue mintiendo aunque haya avisos debajo.
   */
  const editor = leer('src/pages/app/WebPublica.tsx')
  for (const campo of ['direccion', 'telefono', 'email']) {
    caso(`el campo ${campo} no usa el dato de la hermandad de placeholder`, false,
      editor.includes(`placeholder={hermandad.${campo}`))
  }
}
