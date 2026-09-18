/**
 * LA SESIÓN DEL ÁREA DEL HERMANO.
 *
 * Vivía dentro de `HermanoPortal.tsx` —2.909 líneas— y por eso no tenía ni una
 * prueba: no se podía importar sin arrastrar la pantalla entera. Al partirla se
 * quedó sola en `pages/portal/sesion.ts` y ya se puede ejecutar con datos.
 *
 * ============================================================================
 * LO QUE MÁS IMPORTA DE AQUÍ: `aDondeVolver`
 * ============================================================================
 *
 * Es un guardia contra una redirección abierta, y su propio comentario cuenta
 * el ataque: la tienda de la web pública manda al hermano a identificarse con
 * `?volver=/w/mi-hermandad#tienda` para devolverlo al escaparate con sus
 * precios. Si ese destino no se comprobara, bastaría con mandarle a alguien
 * `…/hermano?volver=//parecido-a-gobergo.com` para que, DESPUÉS DE TECLEAR SU
 * DNI Y SU CONTRASEÑA, acabara en una página ajena clavada a esta.
 *
 * Una función de cuatro líneas de las que decide si una contraseña se entrega a
 * un tercero. Sin prueba hasta hoy.
 */
export default async function ({ cargar, caso }) {
  const s = await cargar('src/pages/portal/sesion.ts')

  // --- A dónde se puede volver: solo caminos de esta misma web.
  caso('sin destino, no se va a ninguna parte', null, s.aDondeVolver(null))
  caso('ni con la cadena vacía', null, s.aDondeVolver(''))
  caso('un camino de aquí vale', '/w/mi-hermandad', s.aDondeVolver('/w/mi-hermandad'))
  caso('con ancla, también', '/w/mi-hermandad#tienda', s.aDondeVolver('/w/mi-hermandad#tienda'))
  caso('y con parámetros', '/hermano?x=1', s.aDondeVolver('/hermano?x=1'))

  /*
   * LO QUE HAY QUE RECHAZAR. `//otrositio.com` es una dirección ABSOLUTA con el
   * esquema heredado: el navegador la lee como `https://otrositio.com`, no como
   * una carpeta de esta web. Es el caso que el comentario de la función nombra.
   */
  caso('dos barras es otro sitio, no una carpeta', null, s.aDondeVolver('//parecido-a-gobergo.com'))
  caso('y con camino detrás, igual', null, s.aDondeVolver('//malo.example/hermano'))
  caso('una dirección con esquema, fuera', null, s.aDondeVolver('https://malo.example'))
  caso('y las de esquemas raros, también', null, s.aDondeVolver('javascript:alert(1)'))
  caso('lo que no empieza por barra, fuera', null, s.aDondeVolver('malo.example'))
  caso('ni un camino relativo', null, s.aDondeVolver('../otro'))

  // --- La sesión: quién está dentro.
  sessionStorage.clear()
  caso('sin nada guardado no hay sesión', null, s.leerSesion())

  s.guardarSesion({ hermandadId: 'h-1', hermanoId: 'x-9' })
  caso('lo guardado se vuelve a leer', { hermandadId: 'h-1', hermanoId: 'x-9' }, s.leerSesion())

  /*
   * Y VA EN `sessionStorage`, NO EN `localStorage`, que es una decisión y no un
   * descuido: cerrar la pestaña cierra la sesión del hermano. En el ordenador
   * de la casa de hermandad pasa gente distinta por la misma pantalla.
   */
  caso('se guarda en la de sesión, no en la local', true,
    sessionStorage.getItem(s.SESION_KEY) !== null && localStorage.getItem(s.SESION_KEY) === null)

  // Una sesión a medias o de un formato anterior no se acepta: se ignora, que
  // es lo que deja entrar a la pantalla de identificarse en vez de reventar.
  sessionStorage.setItem(s.SESION_KEY, JSON.stringify({ hermandadId: 'h-1' }))
  caso('una sesión a medias no vale', null, s.leerSesion())
  sessionStorage.setItem(s.SESION_KEY, JSON.stringify({ hermandadId: 1, hermanoId: 2 }))
  caso('ni una con números donde van textos', null, s.leerSesion())
  sessionStorage.setItem(s.SESION_KEY, 'esto no es json')
  caso('ni una corrupta —y no lanza', null, s.leerSesion())
  sessionStorage.clear()

  // --- «Sin datos» no se escribe dentro de un campo para rellenar.
  caso('el hueco de la ficha se queda vacío', '', s.siNoEsElHueco('Sin datos'))
  caso('y un teléfono de verdad pasa', '600 123 456', s.siNoEsElHueco('600 123 456'))
  caso('y lo vacío sigue vacío', '', s.siNoEsElHueco(''))

  // --- Lo que se le enseña al hermano de la agenda de la hermandad.
  caso('el hermano ve los cultos', true, s.TIPOS_PARA_HERMANOS.has('Culto'))
  caso('y las salidas', true, s.TIPOS_PARA_HERMANOS.has('Salida'))
  /*
   * PERO NO LOS CABILDOS. Es de las cosas que no se pueden deducir leyendo:
   * un cabildo de oficiales es una reunión de la junta, y sale en el mismo
   * calendario que el triduo. Enseñárselo al hermano sería publicar la agenda
   * interna de gobierno de la hermandad.
   */
  caso('los cabildos NO se le enseñan', false, s.TIPOS_PARA_HERMANOS.has('Cabildo'))
  caso('y «Otro» tampoco', false, s.TIPOS_PARA_HERMANOS.has('Otro'))

  /*
   * --- EL MENSAJE DE QUIEN FIGURA DE BAJA.
   *
   * No es el aviso de «lo que pierdes si te das de baja» —eso está en la
   * pantalla—: es lo que ve quien YA está de baja e intenta entrar en su área.
   * Y lo que no puede faltarle es la salida: decirle que no puede entrar y
   * dejarlo ahí es dejar a un hermano en un callejón sin nadie a quien
   * preguntar, y puede ser un error de la propia ficha.
   */
  caso('dice que figura de baja', true, /de baja/i.test(s.MENSAJE_BAJA))
  caso('y que por eso no puede entrar', true, /no está disponible/i.test(s.MENSAJE_BAJA))
  caso('y a quién preguntar si es un error', true, /secretar/i.test(s.MENSAJE_BAJA))
}
