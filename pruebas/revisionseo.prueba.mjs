/**
 * LA REVISIÓN DE SEO: DECIR LO QUE ROMPE, Y NADA MÁS.
 *
 * ============================================================================
 * QUÉ HABÍA Y QUÉ FALTABA
 * ============================================================================
 *
 * Había bastante más de lo que parecía: editor de título, descripción e imagen,
 * tarjeta de vista previa, `sitemap.xml`, `robots.txt` y datos estructurados
 * con cada culto como `Event`.
 *
 * Lo que faltaba era saber SI ESTÁ BIEN PUESTO. Se rellenaba a ciegas y no
 * había forma de enterarse hasta que alguien pegaba el enlace en un grupo de
 * WhatsApp y salía en gris.
 *
 * ----------------------------------------------------------------------------
 * LA REGLA DE ESTA LISTA, Y ES LA MITAD DEL TRABAJO
 * ----------------------------------------------------------------------------
 *
 * POCOS AVISOS. Una lista larga de reproches no la lee nadie: ya pasó en esta
 * misma pantalla, donde los avisos de la web eran una retahíla y hubo que
 * convertirlos en una barra de progreso para que se miraran.
 *
 * Así que aquí solo entra lo que CAMBIA ALGO de verdad para quien busca la
 * hermandad en Google o comparte el enlace. Nada de densidad de palabras clave
 * ni de consejos de manual — eso es ruido que entierra lo que sí importa.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const m = await cargar('src/lib/seoWeb.ts')

  const HDAD = { nombreLegal: 'Hermandad de la Vera-Cruz' }
  /** Una web bien puesta, para ir estropeándola por partes. */
  const buena = {
    publicada: true,
    titulo: 'Hermandad de la Vera-Cruz',
    dominio: 'veracruz.es',
    heroFotos: ['data:image/png;base64,xx'],
    seo: {
      titulo: 'Hermandad de la Vera-Cruz · Sevilla',
      descripcion: 'Hermandad de la Vera-Cruz de Sevilla. Cultos, historia y estación de penitencia el Viernes Santo.',
      imagenDataUrl: 'data:image/png;base64,xx',
    },
  }
  const ids = (w) => m.revisarSeo(w, HDAD).map((a) => a.id).sort()

  // --- UNA WEB BIEN PUESTA NO DICE NADA ---
  /*
   * Y esto importa tanto como lo demás: una revisión que SIEMPRE encuentra algo
   * es una revisión que se deja de mirar. Tiene que poder quedarse callada.
   */
  caso('una web bien puesta no tiene avisos', [], ids(buena))

  // --- LA WEB SIN PUBLICAR, QUE ES LO PRIMERO ---
  /*
   * Va la primera porque mientras esté oculta todo lo demás da igual: se puede
   * escribir la mejor descripción del mundo y no la lee nadie. Es el aviso que
   * evita pasarse una tarde afinando textos que no está viendo Google.
   */
  const oculta = m.revisarSeo({ ...buena, publicada: false }, HDAD)
  caso('la web oculta se avisa', 'sin-publicar', oculta[0].id)
  caso('y es grave', true, oculta[0].grave)
  caso('y va la primera de todas', 0, oculta.findIndex((a) => a.id === 'sin-publicar'))
  caso('diciendo que lo demás no cambia nada mientras tanto', true,
    /no cambia nada/.test(oculta[0].queHacer))

  // --- LA DESCRIPCIÓN ---
  const sinDesc = m.revisarSeo({ ...buena, seo: { ...buena.seo, descripcion: '' } }, HDAD)
  caso('sin descripción se avisa', true, sinDesc.some((a) => a.id === 'sin-descripcion'))
  caso('y es grave', true, sinDesc.find((a) => a.id === 'sin-descripcion').grave)
  caso('diciendo qué se ve en WhatsApp', true, /WhatsApp/.test(sinDesc[0].texto))

  const larga = { ...buena, seo: { ...buena.seo, descripcion: 'x'.repeat(200) } }
  caso('una descripción larga se avisa', true, ids(larga).includes('descripcion-larga'))
  caso('pero no es grave: se lee igual, solo se corta', false,
    m.revisarSeo(larga, HDAD).find((a) => a.id === 'descripcion-larga').grave)
  caso('y se dice que lo que se corta es el final', true,
    /al principio/.test(m.revisarSeo(larga, HDAD).find((a) => a.id === 'descripcion-larga').queHacer))

  /*
   * Y DEMASIADO CORTA TAMBIÉN, que no es un capricho de manual: con quince
   * caracteres Google se inventa la descripción sacando texto de la página, y
   * lo que suele coger es el menú.
   */
  const corta = { ...buena, seo: { ...buena.seo, descripcion: 'Hermandad de Sevilla' } }
  caso('una descripción muy corta se avisa', true, ids(corta).includes('descripcion-corta'))
  caso('explicando qué pasa entonces', true,
    /se la inventa/.test(m.revisarSeo(corta, HDAD).find((a) => a.id === 'descripcion-corta').queHacer))
  // Y no se avisa de las dos cosas a la vez: una descripción no puede ser
  // larga y corta, y dos avisos contradictorios rompen la confianza en todos.
  caso('nunca se avisa de larga y corta a la vez', false,
    ids(larga).includes('descripcion-corta') || ids(corta).includes('descripcion-larga'))

  // --- EL TÍTULO ---
  const tituloLargo = {
    ...buena,
    seo: { ...buena.seo, titulo: 'Pontificia, Real e Ilustre Hermandad y Cofradía de Nazarenos de la Santa Vera-Cruz de Sevilla' },
  }
  caso('un título largo se avisa', true, ids(tituloLargo).includes('titulo-largo'))
  /*
   * Y SE DICE LO ÚNICO ÚTIL: que el nombre vaya delante. Los títulos de
   * hermandad son larguísimos por su nombre completo, y lo que se corta es el
   * final — o sea, si el nombre va detrás, se corta el nombre.
   */
  caso('diciendo que el nombre vaya delante', true,
    /delante/.test(m.revisarSeo(tituloLargo, HDAD).find((a) => a.id === 'titulo-largo').queHacer))
  caso('el largo del título es 60', 60, m.LARGO_TITULO)
  caso('y el de la descripción, 160', 160, m.LARGO_DESCRIPCION)

  // --- LA IMAGEN ---
  /*
   * Es, con diferencia, lo que más cambia de toda la lista: sin ella el enlace
   * en WhatsApp sale como una línea de texto gris; con ella ocupa media
   * pantalla y se pincha.
   */
  const sinImagen = { ...buena, heroFotos: [], seo: { ...buena.seo, imagenDataUrl: null } }
  caso('sin imagen se avisa', true, ids(sinImagen).includes('sin-imagen'))
  /*
   * PERO SI HAY FOTOS EN LA PORTADA, NO. Se usa la primera, así que avisar
   * sería avisar de un problema que no existe — y un aviso falso enseña a
   * ignorar los verdaderos.
   */
  caso('con fotos en la portada no se avisa', false,
    ids({ ...buena, seo: { ...buena.seo, imagenDataUrl: null } }).includes('sin-imagen'))

  // --- EL DOMINIO ---
  caso('sin dominio propio se dice', true, ids({ ...buena, dominio: null }).includes('sin-dominio'))
  caso('pero no es grave', false,
    m.revisarSeo({ ...buena, dominio: null }, HDAD).find((a) => a.id === 'sin-dominio').grave)
  // Y se dice lo que de verdad hay que saber: que el trámite tarda.
  caso('avisando de que el trámite tarda', true,
    /tarda/.test(m.revisarSeo({ ...buena, dominio: null }, HDAD).find((a) => a.id === 'sin-dominio').queHacer))

  /*
   * --- TODOS LOS AVISOS DICEN QUÉ HACER ---
   *
   * Es la regla del fichero entero. Un aviso que solo dice qué está mal es un
   * reproche: quien lo lee no sabe si le toca a él ni por dónde empezar.
   * Se comprueba sobre la web MÁS rota posible, para que salgan todos.
   */
  const rota = { publicada: false, titulo: '', dominio: null, heroFotos: [], seo: { titulo: '', descripcion: '', imagenDataUrl: null } }
  const todos = m.revisarSeo(rota, HDAD)
  caso('con la web entera sin poner salen varios', true, todos.length >= 4)
  caso('y todos dicen qué hacer', [], todos.filter((a) => !a.queHacer || a.queHacer.length < 20).map((a) => a.id))
  caso('y todos dicen qué pasa', [], todos.filter((a) => !a.texto || a.texto.length < 20).map((a) => a.id))
  caso('sin ids repetidos', todos.length, new Set(todos.map((a) => a.id)).size)
  /*
   * Y NO SON CIEN. El tope está escrito a mano: el día que alguien añada el
   * séptimo, esta prueba le obliga a preguntarse si de verdad cambia algo para
   * quien busca la hermandad, o si es un consejo de manual que entierra a los
   * demás.
   */
  caso('y no son una retahíla', true, todos.length <= 6)

  // --- Y LA PANTALLA LO ENSEÑA ---
  const web = await readFile('src/pages/app/WebPublica.tsx', 'utf8')
  caso('la pantalla lo usa', true, /revisarSeo\(web, hermandad\)/.test(web))
  caso('lo grave primero', true, /Number\(b\.grave\) - Number\(a\.grave\)/.test(web))
  caso('y dice qué hacer en cada uno', true, /\{a\.queHacer\}/.test(web))
  /*
   * Y CUANDO NO HAY NADA, SE DICE — sin prometer nada que no sea verdad.
   * Ningún editor hace salir el primero en Google; decir lo contrario es
   * exactamente lo que hace que la hermandad deje de fiarse del resto.
   */
  caso('cuando está todo bien se dice', true, /Todo lo que depende de vosotros está puesto/.test(web))
  caso('sin prometer salir el primero en Google', true, /no lo decide esto/.test(web))

  /*
   * --- EL CONTADOR DEL TÍTULO ---
   *
   * La descripción tenía contador y el título no, así que se escribía a ciegas
   * justo en el campo que más se corta.
   */
  caso('el título tiene contador', true, /de \{LARGO_TITULO\} caracteres/.test(web))
  caso('y avisa cuando se pasa', true, /titulo\.length > LARGO_TITULO && ' — Google cortará el resto\.'/.test(web))
  // Y el de la descripción sigue ahí: esto se añadió, no se sustituyó.
  caso('la descripción sigue teniendo el suyo', true, /de 160 caracteres/.test(web))
}
