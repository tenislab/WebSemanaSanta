/**
 * EL CORREO PERSONAL DEL SECRETARIO, PUBLICADO EN LA WEB DE LA HERMANDAD.
 *
 * Llegó dicho así: «el contacto de la web pone mis datos, no los de la
 * hermandad». Y era verdad: en la web salían su dirección, su móvil y su
 * gmail, a la vista de cualquiera.
 *
 * No había ningún fallo de código. El editor de la web tiene tres campos
 * —dirección, teléfono y correo—, y si se dejaban vacíos se publicaba lo que
 * hubiera en Configuración, que es donde fueron los datos al dar de alta la
 * hermandad. Eso estaba escrito en una línea encima de los campos, y el valor
 * heredado se enseñaba como PLACEHOLDER: texto gris que se lee como un ejemplo
 * de lo que podrías escribir, jamás como lo que ya está publicado.
 *
 * EL PRIMER ARREGLO FUE AVISAR: enseñar debajo de cada campo lo que se estaba
 * publicando y de dónde venía. Y no bastó — volvió el mismo mensaje: «sigue
 * apareciendo mi ubicación por defecto». Claro: el aviso lo cuenta, pero no lo
 * quita.
 *
 * ASÍ QUE YA NO SE HEREDA. Configuración es interno (identifica legalmente a la
 * hermandad en los recibos) y la web es pública; que lo público herede lo
 * interno sin que nadie lo elija es justo lo que publica un móvil personal. La
 * web publica solo lo que se escribe en su pestaña de Contacto, y vacío no
 * publica nada. Lo cómodo no se pierde: el editor ofrece copiar el dato de
 * Configuración de un clic, y entonces queda ESCRITO en el campo.
 *
 * Aquí se comprueba la regla, y que la cumplen los CUATRO sitios que publican:
 * el editor, la web pintada, el pie y los datos que se le dan a Google.
 */
import { readFileSync } from 'node:fs'

const leer = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/contactoPublico.ts')

  const HDAD = { direccion: 'C/ Pureza 53', telefono: '954 000 000', email: 'secretaria@hdad.es' }
  const VACIA = { direccion: '', telefono: '', email: '' }

  // --- LO QUE SE PUBLICA ES LO ESCRITO, Y NADA MÁS.
  const vacio = m.contactoQueSePublica(VACIA)
  caso('con la web vacía no se publica nada', '', vacio.direccion.valor)
  caso('y se dice que no hay nada', 'nada', vacio.direccion.origen)
  caso('tampoco el teléfono', 'nada', vacio.telefono.origen)
  caso('ni el correo', 'nada', vacio.email.origen)

  const propia = m.contactoQueSePublica({ ...VACIA, email: 'hola@hdad.es' })
  caso('lo escrito en la web se publica', 'hola@hdad.es', propia.email.valor)
  caso('y se sabe que es suyo', 'web', propia.email.origen)
  caso('y lo que no se escribió sigue sin publicarse', 'nada', propia.telefono.origen)

  // Los espacios no cuentan como haber escrito algo: un campo con un espacio
  // se ve vacío y tiene que comportarse como vacío.
  caso('un campo con solo espacios sigue siendo vacío', 'nada',
    m.contactoQueSePublica({ ...VACIA, telefono: '   ' }).telefono.origen)
  // Y lo escrito se publica limpio de espacios de los lados.
  caso('lo escrito se publica sin espacios sobrantes', '954 000 000',
    m.contactoQueSePublica({ ...VACIA, telefono: '  954 000 000  ' }).telefono.valor)

  /*
   * --- Y NO SE HEREDA NI PASÁNDOLE LOS DATOS DE LA HERMANDAD.
   *
   * `contactoQueSePublica` ya no recibe la hermandad. Esto es la prueba de que
   * el cambio de verdad está hecho y no solo el de los rótulos: si alguien
   * volviera a añadir el segundo argumento con la herencia dentro, aquí se
   * publicaría «C/ Pureza 53» y esto caería.
   */
  caso('la dirección de Configuración no se cuela', '', m.contactoQueSePublica(VACIA, HDAD).direccion.valor)
  caso('ni el teléfono', '', m.contactoQueSePublica(VACIA, HDAD).telefono.valor)
  caso('ni el correo', '', m.contactoQueSePublica(VACIA, HDAD).email.valor)

  /*
   * --- EL DATO DE CONFIGURACIÓN SE OFRECE, NO SE PUBLICA.
   *
   * Es el atajo para quien SÍ quiere publicar los de la hermandad: un botón
   * que lo copia al campo de la web. A partir de ahí se publica porque está
   * escrito y alguien lo ha decidido.
   */
  caso('se puede ofrecer la dirección de Configuración', 'C/ Pureza 53', m.loQueHayEnConfiguracion(HDAD, 'direccion'))
  caso('y el correo', 'secretaria@hdad.es', m.loQueHayEnConfiguracion(HDAD, 'email'))
  caso('sin nada que ofrecer, cadena vacía', '', m.loQueHayEnConfiguracion(VACIA, 'telefono'))
  caso('y un campo con espacios no es algo que ofrecer', '',
    m.loQueHayEnConfiguracion({ ...VACIA, telefono: '   ' }, 'telefono'))

  /*
   * --- EL AVISO DE DATO PERSONAL SIGUE HACIENDO FALTA.
   *
   * Ahora avisa de lo que SE VA A PUBLICAR, escrito a mano o copiado de un
   * clic. Antes solo avisaba de lo heredado —«si lo escribe, ya lo ha
   * decidido»—, pero desde que copiar es un botón, «decidido» puede ser un
   * clic despistado y el dato termina igual de público.
   */
  const gmail = m.contactoQueSePublica({ ...VACIA, email: 'jaimerivasgranada@gmail.com' })
  caso('avisa de que se está publicando un correo personal', true,
    (m.avisoDeDatoPersonal(gmail.email, 'email') ?? '').includes('personal'))

  const movil = m.contactoQueSePublica({ ...VACIA, telefono: '618648370' })
  caso('avisa de que se está publicando un móvil', true,
    (m.avisoDeDatoPersonal(movil.telefono, 'telefono') ?? '').includes('móvil'))
  caso('y también con el prefijo delante', true, m.telefonoDeMovil('+34 618 64 83 70'))
  caso('un fijo de hermandad no dispara el aviso', false, m.telefonoDeMovil('954 00 00 00'))

  // Un correo de la hermandad no avisa de nada: si avisara siempre, el aviso
  // dejaría de leerse y volveríamos al principio.
  const dePeña = m.contactoQueSePublica({ ...VACIA, email: 'secretaria@hdad.es' })
  caso('un correo de la hermandad no avisa', null, m.avisoDeDatoPersonal(dePeña.email, 'email'))
  // Y un campo vacío tampoco: no hay nada publicado de lo que avisar.
  caso('un campo vacío no avisa', null, m.avisoDeDatoPersonal(vacio.email, 'email'))

  // --- Y el texto de debajo del campo dice que vacío es vacío.
  caso('vacío se explica', true, m.comoSeExplica(vacio.direccion).includes('no aparece nada'))
  caso('y lo escrito no necesita explicación', '', m.comoSeExplica(propia.email))

  /*
   * --- LA MISMA REGLA EN TODOS LOS SITIOS QUE PUBLICAN.
   *
   * Quien PINTA la web, el PIE y los datos para GOOGLE lo hacían cada uno por
   * su cuenta con `web.x || hermandad.x`. Si a uno se le olvida el cambio, el
   * editor dice que no publica nada y la web publica el dato personal — que es
   * exactamente el fallo del que venimos, con otro disfraz.
   */
  const sitio = leer('src/components/SitioContenido.tsx')
  const seo = leer('src/lib/seoWeb.ts')
  const publico = leer('src/pages/SitioPublico.tsx')
  for (const campo of ['direccion', 'telefono', 'email']) {
    caso(`la web pintada no hereda ${campo}`, false, sitio.includes(`|| hermandad.${campo}`))
    caso(`los datos para Google no heredan ${campo}`, false, seo.includes(`|| hermandad.${campo}.trim()`))
    caso(`la página de un culto no hereda ${campo}`, false, publico.includes(`|| hermandad.${campo}`))
  }
  // Y a Google tampoco se le dan la ciudad ni el código postal de Configuración:
  // son los de la dirección interna, y con otra dirección en la web serían
  // además falsos.
  caso('ni la ciudad de Configuración', false, seo.includes('addressLocality: hermandad.ciudad'))
  caso('ni el código postal', false, seo.includes('postalCode: hermandad.codigoPostal'))

  /*
   * --- Y EL EDITOR: NI PLACEHOLDER NI HERENCIA.
   *
   * El placeholder con el dato de la hermandad es lo que empezó todo. Y el
   * aviso de «si lo dejas vacío se publica lo de Configuración» ya sería
   * mentira: lo que hay es un botón para copiarlo.
   */
  const editor = leer('src/pages/app/WebPublica.tsx')
  for (const campo of ['direccion', 'telefono', 'email']) {
    caso(`el campo ${campo} no usa el dato de la hermandad de placeholder`, false,
      editor.includes(`placeholder={hermandad.${campo}`))
  }
  caso('el editor ya no promete que se hereda', false,
    editor.includes('se publica lo que haya en <Link to="/app/configuracion">Configuración</Link>'))
  caso('dice que un campo vacío no publica nada', true, editor.includes('no publica nada'))
  caso('y ofrece copiar el de Configuración', true,
    editor.includes('hay «{deConfiguracion}»') && editor.includes('Usar ese'))
  caso('copiándolo al campo de la web', true, editor.includes("onCopiar={(v) => editar('direccion', v)}"))
}
