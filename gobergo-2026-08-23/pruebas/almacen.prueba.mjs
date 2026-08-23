/**
 * EL ALMACÉN DE IMÁGENES.
 *
 * Lo que se comprueba aquí es lo que no se ve al probar a mano, porque cuando
 * falla la web sigue funcionando: simplemente las fotos se quedan dentro del
 * contenido, la página pesa quince megas y el enlace se comparte sin foto. No
 * hay error rojo en ningún sitio.
 *
 *   1. Que no se salte ninguna. El recorrido va a ciegas por el objeto de la
 *      web precisamente para que un campo nuevo con foto —una sección que
 *      alguien añada el año que viene— entre solo.
 *   2. Que no suba dos veces la misma. La foto de portada suele ser también
 *      la de WhatsApp: sin esto se guardaban dos copias y quedaban dos
 *      direcciones distintas para el mismo archivo.
 *   3. Que sin Supabase NO pase nada. Es el modo demostración, y ahí lo malo
 *      no sería que no suba: sería que se pierda una foto.
 */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/almacenImagenes.ts')

  const FOTO = 'data:image/webp;base64,AAAA'
  const OTRA = 'data:image/jpeg;base64,BBBB'
  const PDF = 'data:application/pdf;base64,CCCC'

  // --- Qué cuenta como imagen escrita dentro del contenido ---
  caso('una imagen en data: se reconoce', true, m.esDataUrl(FOTO))
  caso('un PDF también', true, m.esDataUrl(PDF))
  caso('una dirección de verdad no', false, m.esDataUrl('https://ejemplo.org/foto.webp'))
  // El caso que importa: después de mudar, el contenido está lleno de
  // direcciones. Si estas contaran como pendientes, cada apertura del editor
  // volvería a subirlo todo.
  caso('una ruta relativa tampoco', false, m.esDataUrl('/fotos/portada.webp'))
  caso('lo vacío tampoco', false, m.esDataUrl(''))
  caso('lo que no es texto tampoco', false, m.esDataUrl(null))
  caso('ni un número', false, m.esDataUrl(42))

  // --- Sin Supabase no se toca nada ---
  // En las pruebas no hay Supabase configurado, así que esto es el modo
  // demostración de verdad, no una imitación.
  caso('sin almacén no hay a dónde subir', false, m.hayAlmacen())
  caso('y la foto vuelve tal cual', FOTO, await m.guardarImagen(FOTO))
  const intacta = await m.mudarImagenes({ logoDataUrl: FOTO })
  caso('la mudanza no sube nada', 0, intacta.subidas)
  caso('y no toca la foto', FOTO, intacta.valor.logoDataUrl)

  await elRecorrido({ caso, m, FOTO, OTRA, PDF })
}

/**
 * EL RECORRIDO, con un subidor de mentira: aquí se prueba que encuentra todas
 * las fotos de una web de verdad, estén donde estén.
 */
async function elRecorrido({ caso, m, FOTO, OTRA, PDF }) {
  let veces = 0
  const subir = async (d) => {
    veces += 1
    return `https://almacen.example/${veces}${d.includes('pdf') ? '.pdf' : '.webp'}`
  }

  /*
   * Una web como las de verdad: la foto aparece en la raíz, dentro de una
   * lista, dentro de un objeto de una lista, y anidada dos niveles. Es el
   * mapa de sitios donde una implementación a base de «campos conocidos» se
   * deja alguno.
   */
  const web = {
    titulo: 'Hermandad de ejemplo',
    logoDataUrl: FOTO,
    heroFotos: [OTRA, 'https://ya-estaba.example/vieja.webp'],
    titulares: [
      { nombre: 'El Señor', fotoDataUrl: OTRA, fotos: [{ url: PDF, alt: 'ficha' }] },
      { nombre: 'La Virgen', fotoDataUrl: null },
    ],
    albumes: [{ fotos: [{ fotoDataUrl: FOTO, miniDataUrl: FOTO }] }],
    seo: { imagenDataUrl: FOTO },
    publicada: true,
    cuantas: 3,
  }
  const { valor, subidas } = await m.recorrerImagenes(web, subir)

  // Tres imágenes DISTINTAS, aunque aparezcan seis veces entre todas.
  caso('sube cada imagen una sola vez', 3, veces)
  caso('y cuenta las que ha subido', 3, subidas)

  caso('la de la raíz sube', true, valor.logoDataUrl.startsWith('https://almacen.example/'))
  caso('la de dentro de una lista sube', true, valor.heroFotos[0].startsWith('https://almacen.example/'))
  caso('la de dos niveles abajo sube', true,
    valor.albumes[0].fotos[0].fotoDataUrl.startsWith('https://almacen.example/'))
  caso('la de la ficha de un titular sube', true,
    valor.titulares[0].fotos[0].url.startsWith('https://almacen.example/'))
  caso('el PDF va con extensión de PDF', true, valor.titulares[0].fotos[0].url.endsWith('.pdf'))

  // La misma foto en dos sitios acaba en la MISMA dirección. Si no, cada
  // copia se descarga aparte y se pierde la mitad de la caché.
  caso('la misma foto da la misma dirección', valor.logoDataUrl, valor.seo.imagenDataUrl)
  caso('y la miniatura repetida también', valor.albumes[0].fotos[0].fotoDataUrl,
    valor.albumes[0].fotos[0].miniDataUrl)

  // Lo que ya era una dirección se queda como estaba.
  caso('lo que ya estaba subido no se toca', 'https://ya-estaba.example/vieja.webp', valor.heroFotos[1])

  // Y la forma del objeto, intacta: es la web entera, no solo las fotos.
  caso('el texto no se toca', 'Hermandad de ejemplo', valor.titulo)
  caso('los booleanos tampoco', true, valor.publicada)
  caso('los números tampoco', 3, valor.cuantas)
  caso('los nulos siguen siendo nulos', null, valor.titulares[1].fotoDataUrl)
  caso('las listas siguen siendo listas', true, Array.isArray(valor.heroFotos))

  // --- Y la segunda pasada no hace nada ---
  // Es lo que permite llamarlo en cada apertura del editor sin pensarlo.
  veces = 0
  const segunda = await m.recorrerImagenes(valor, subir)
  caso('la segunda vuelta no sube nada', 0, veces)
  caso('y lo dice', 0, segunda.subidas)

  /*
   * --- EL MAPA, Y POR QUÉ NO BASTA CON LO QUE DEVUELVE LA MUDANZA ---
   *
   * Subir veinte fotos tarda segundos, y en esos segundos la hermandad está
   * escribiendo en el editor. Guardando el resultado de la mudanza tal cual se
   * guardaría una FOTOCOPIA de la web de hace cinco segundos: lo escrito
   * mientras tanto desaparece delante de sus ojos, sin aviso y sin forma de
   * recuperarlo.
   *
   * Por eso la mudanza devuelve además el mapa de «lo que era» → «dónde está
   * ahora», para poder aplicarlo sobre lo que hay AHORA.
   */
  const conMapa = await m.recorrerImagenes({ logoDataUrl: FOTO, seo: { imagenDataUrl: OTRA } },
    async (d) => `https://almacen.example/${d.length}.webp`)
  caso('la mudanza devuelve el mapa', 2, conMapa.mapa.size)
  caso('con lo que era de clave', true, conMapa.mapa.has(FOTO))

  // Y aplicado sobre lo que hay ahora: la foto cambia, lo escrito entretanto
  // se queda.
  const mientrasTanto = { logoDataUrl: FOTO, seo: { imagenDataUrl: OTRA }, titulo: 'Escrito mientras subía' }
  const aplicado = m.sustituirImagenes(mientrasTanto, conMapa.mapa)
  caso('la foto se cambia por su dirección', conMapa.valor.logoDataUrl, aplicado.logoDataUrl)
  caso('y lo escrito entretanto NO se pierde', 'Escrito mientras subía', aplicado.titulo)

  // Con el mapa vacío no se toca nada — y se devuelve el MISMO objeto, para
  // que el editor no repinte ni guarde por nada.
  const intocado = { a: 1 }
  caso('con el mapa vacío no se toca nada', true, m.sustituirImagenes(intocado, new Map()) === intocado)

  // Las que no llegaron a subir no entran en el mapa: dejarlas apuntándose a
  // sí mismas no cambia nada, pero convierte el mapa en algo que no significa
  // lo que dice.
  const ninguna = await m.recorrerImagenes({ logoDataUrl: FOTO }, async (d) => d)
  caso('lo que no subió no entra en el mapa', 0, ninguna.mapa.size)

  // --- Si la subida falla, la foto se queda donde estaba ---
  // El caso de la hermandad que no ha ejecutado el SQL: mejor una web pesada
  // que una web sin fotos.
  const falla = await m.recorrerImagenes({ logoDataUrl: FOTO }, async (d) => d)
  caso('si no se puede subir, la foto no se pierde', FOTO, falla.valor.logoDataUrl)
  caso('y no se cuenta como subida', 0, falla.subidas)
}
