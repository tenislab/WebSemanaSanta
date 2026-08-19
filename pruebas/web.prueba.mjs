/** Enlaces propios y fichas de la web pública (noticias y titulares). */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/webPublica.ts')

  const titular = (x) => ({ id: 't1', nombre: '', fotoDataUrl: null, descripcion: '', autoria: '', parrafos: [], ...x })

  // --- El enlace de un titular ---
  caso('el enlace sale del nombre', 'ntro-padre-jesus', m.slugTitular(titular({ nombre: 'Ntro. Padre Jesús' })))
  caso('el enlace guardado manda sobre el nombre', 'el-senor', m.slugTitular(titular({ nombre: 'Otro nombre', slug: 'el-senor' })))
  caso('sin nombre se cae al id', 't1', m.slugTitular(titular({ nombre: '' })))
  caso('un nombre de solo signos se cae al id', 't1', m.slugTitular(titular({ nombre: '¿¡...!?' })))
  caso('un enlace en blanco no cuenta', 'maria', m.slugTitular(titular({ nombre: 'María', slug: '   ' })))

  // --- ¿Hay ficha que abrir? ---
  caso('sin texto ni fotos no hay ficha', false, m.titularConFicha(titular({})))
  caso('un párrafo vacío no es ficha', false, m.titularConFicha(titular({ parrafos: [{ id: 'p', subtitulo: '  ', texto: '' }] })))
  caso('con texto sí hay ficha', true, m.titularConFicha(titular({ parrafos: [{ id: 'p', subtitulo: '', texto: 'Su historia.' }] })))
  caso('solo con un subtítulo ya hay ficha', true, m.titularConFicha(titular({ parrafos: [{ id: 'p', subtitulo: 'Hechura', texto: '' }] })))
  caso('con fotos sueltas hay ficha', true, m.titularConFicha(titular({ fotos: ['data:x'] })))
  caso('un titular de una versión vieja no revienta', false, m.titularConFicha({ id: 't', nombre: 'X', fotoDataUrl: null, descripcion: '', autoria: '', parrafos: undefined }))

  // --- Marca de agua ---
  const web = (x) => ({ ...m.WEB_PUBLICA_INICIAL, ...x })
  caso('sin marca no se pinta nada', '', m.marcaDeAgua(web({ marcaAgua: false, titulo: 'Vera-Cruz' }), 'Hdad. de la Vera-Cruz'))
  caso('con marca manda el título de la web', 'Vera-Cruz', m.marcaDeAgua(web({ marcaAgua: true, titulo: 'Vera-Cruz' }), 'Hdad. de la Vera-Cruz'))
  caso('sin título se usa el nombre legal', 'Hdad. de la Vera-Cruz', m.marcaDeAgua(web({ marcaAgua: true, titulo: '' }), 'Hdad. de la Vera-Cruz'))
  caso('sin ninguno de los dos, vacío', '', m.marcaDeAgua(web({ marcaAgua: true, titulo: '  ' }), '  '))

  // --- Lo guardado por una versión anterior se completa ---
  const migrada = m.conDefectos({ titulares: [{ id: 'v', nombre: 'Antiguo' }] })
  caso('un titular viejo gana los campos nuevos', true, Array.isArray(migrada.titulares[0].fotos))
  caso('el aviso de derechos arranca vacío', '', migrada.avisoFotos)
  caso('la marca de agua arranca apagada', false, migrada.marcaAgua)

  // --- Noticias (W3), que comparten mecánica ---
  caso('el enlace de una noticia sale del titular', 'cabildo-general', m.slugNoticia({ id: 'n', titulo: 'Cabildo General', fecha: '', resumen: '', fotoDataUrl: null, publicada: true }))
}
