/**
 * LAS DOS SALIDAS DEL ARCHIVO: EL ÁREA DEL HERMANO Y LA WEB.
 *
 * La frontera —quién puede leer qué— se prueba contra Postgres en
 * `basedatos.prueba.mjs`, que es donde tiene que probarse. Aquí se vigila lo
 * de este lado: que las dos pantallas pidan lo que deben, que filtren también
 * por su cuenta y que el botón de descargar sirva para algo.
 *
 * EL FILTRO VA DOS VECES A PROPÓSITO. La base ya solo manda lo que se puede
 * ver, pero el espejo del navegador —el `localStorage` que hace que la
 * pantalla pinte antes de que llegue la red— puede traer filas de cuando esa
 * sesión era de secretaría. Fiarse solo del servidor es correcto en la base y
 * temerario en la pantalla.
 */
import { fuenteDe, sinComentarios, fuenteLlana } from './fuentes.mjs'

export default async function ({ caso }) {
  // ---------------------------------------------------------------------
  // 1. EL ÁREA DEL HERMANO.
  // ---------------------------------------------------------------------
  const delHermano = sinComentarios(await fuenteDe('src/components/DocumentosDelHermano.tsx'))
  const llanoHermano = fuenteLlana(await fuenteDe('src/components/DocumentosDelHermano.tsx'))

  caso('el hermano ve lo marcado para hermanos y para la web', true,
    /d\.publicacion === 'hermanos' \|\| d\.publicacion === 'web'/.test(delHermano))
  /*
   * LO DE LA WEB TAMBIÉN, y no es un descuido: lo que está colgado en internet
   * lo puede ver cualquiera, así que esconderlo al hermano —que es quien más
   * derecho tiene— sería absurdo.
   */
  caso('y no se le esconde lo que ya es público', false,
    /publicacion === 'hermanos'\s*\)/.test(delHermano))
  // Lo de la junta NO sale por ningún camino.
  caso('lo de la junta no sale', false, /'junta'/.test(delHermano))
  /*
   * NI LO RESTRINGIDO A CARGOS. No puede estar marcado para salir —lo frena un
   * `check` de la tabla—, así que este filtro no debería hacer nada. Está
   * porque es la clase de cosa que deja de ser verdad por una migración a
   * medias, y el precio de equivocarse es un acta reservada en la pantalla de
   * un hermano.
   */
  caso('ni lo restringido a cargos', true,
    /!d\.cargosConAcceso \|\| d\.cargosConAcceso\.length === 0/.test(delHermano))

  // Y se dice si lo que lee es público o es de casa: a un hermano le importa.
  caso('se dice si está también en la web', true, /también en la web/.test(llanoHermano))
  caso('y si es solo para hermanos', true, /solo para hermanos/.test(llanoHermano))

  /*
   * SIN DOCUMENTOS NO SE PINTA EL APARTADO. Un «Documentos de la hermandad»
   * vacío en el área de alguien es una promesa de que algún día habrá algo, y
   * no la hay: o la hermandad marca documentos o no los marca.
   */
  caso('sin documentos no hay apartado', true, /if \(mios\.length === 0\) return null/.test(delHermano))

  /*
   * Y SI EL FICHERO NO ESTÁ, SE DICE. La ficha del documento y el fichero
   * viven en sitios distintos —una fila y un cubo—, así que puede haber ficha
   * sin fichero: un adjunto borrado, una copia restaurada a medias. El panel
   * se quedaba callado y parecía que el botón no funcionaba.
   */
  caso('si falta el fichero se dice', true, /no tiene archivo guardado/.test(llanoHermano))
  // Y sin adjunto no se ofrece un botón que no va a hacer nada.
  caso('sin adjunto no hay botón', true, /d\.archivoNombre \?/.test(delHermano))

  // ---------------------------------------------------------------------
  // 2. LA WEB PÚBLICA.
  // ---------------------------------------------------------------------
  const cargador = sinComentarios(await fuenteDe('src/lib/documentosWeb.ts'))

  /*
   * NO LEE LA TABLA. Va por `documentos_de_la_web`, que devuelve las columnas
   * una a una. Leer `documentos` desde aquí traería dentro quién lo archivó y
   * los cargos con acceso, y si mañana la tabla recibe una columna con algo
   * delicado se colaría sola.
   */
  caso('la web pide por la función, no por la tabla', true,
    /rpc\('documentos_de_la_web', \{ p_slug: slug \}\)/.test(cargador))
  /*
   * LA TABLA, NO EL CUBO. La primera versión de esta guarda buscaba
   * `from('documentos')` a secas y se puso roja contra el código correcto:
   * `supabase.storage.from('documentos')` es el CUBO de ficheros y hace falta
   * para bajar el PDF. Los dos se llaman igual porque guardan lo mismo por
   * dos caminos, y una guarda que no los distingue acusa de lo contrario de
   * lo que vigila.
   */
  caso('y no lee la tabla de documentos', false, /(?<!storage)\.from\('documentos'\)/.test(cargador))
  // Y el cubo sí se usa, que es lo que la guarda de arriba no puede confundir
  // con la tabla sin dejar de servir para algo.
  caso('el cubo de ficheros sí se usa', true, /storage\.from\('documentos'\)/.test(cargador))

  /*
   * EL TIPO DE LA WEB ES MÁS POBRE QUE `Documento`, y es la mitad del
   * mecanismo: lo que no se pide no se filtra. Si alguien le añade
   * `archivadoPor` «por comodidad», el nombre de una persona empieza a viajar
   * a la web pública sin que nada lo note.
   */
  caso('el documento de la web no lleva quién lo archivó', false, /archivadoPor/.test(cargador))
  caso('ni los cargos con acceso', false, /cargosConAcceso: /.test(cargador))

  /*
   * SIN BASE DE DATOS sale del navegador, para que la vista previa del panel
   * enseñe la sección antes de conectar nada — y ahí se filtra A MANO por lo
   * mismo que filtra la función, porque ese camino no pasa por la base: es el
   * único sitio donde el `check` de la tabla no protege nada.
   */
  caso('en local se filtra por la web', true, /d\.publicacion === 'web'/.test(cargador))
  caso('y también se quita lo restringido', true,
    /!d\.cargosConAcceso \|\| d\.cargosConAcceso\.length === 0/.test(cargador))

  /*
   * EL PDF SE BAJA POR EL CLIENTE, NO SE ENLAZA. El cubo `documentos` no es
   * público, así que `getPublicUrl` devolvería una dirección con buena pinta
   * que contesta «not found» al pulsarla — peor que no ofrecer el enlace.
   * Bajarlo por el cliente es lo que le da algo que autorizar a la política
   * del visitante.
   */
  caso('el PDF se descarga por el cliente', true, /storage\.from\('documentos'\)\.download\(/.test(cargador))
  caso('y no por una dirección pública', false, /getPublicUrl/.test(cargador))
  /*
   * Y LA CARPETA LA DICE LA BASE. El fichero vive en
   * `<hermandad_id>/<documento_id>` y quien pasa por la web solo tiene el
   * slug: no conoce el id de la hermandad, ni tiene por qué.
   */
  caso('la carpeta la dice la base', true,
    /rpc\('ruta_del_documento', \{\s*p_slug: slug,\s*p_documento: id,\s*\}\)/.test(cargador))

  // ---------------------------------------------------------------------
  // 3. LA SECCIÓN, ENCHUFADA A LA MAQUINARIA DE SECCIONES.
  // ---------------------------------------------------------------------
  const datos = sinComentarios(await fuenteDe('src/lib/webPublicaDatos.ts'))
  caso('hay un tipo de sección para los documentos', true, /\| 'documentos'/.test(datos))
  caso('con su nombre', true, /documentos: \{ nombre: 'Reglas y documentos'/.test(datos))
  /*
   * APAGADA DE FÁBRICA. Hasta que la hermandad marque un documento para la web
   * no hay nada que enseñar, y una sección vacía queda peor que no tenerla. Es
   * el mismo criterio que el cartel, la caridad y la tienda.
   */
  caso('y apagada de fábrica', true, /\{ tipo: 'documentos', visible: false \}/.test(datos))

  const contenido = sinComentarios(await fuenteDe('src/components/SitioContenido.tsx'))
  caso('la sección se pinta', true, /if \(tipo === 'documentos'\) return pintarDocumentos/.test(contenido))
  /*
   * Y SE PORTA COMO LA TIENDA en lo de «¿hay algo que enseñar?»: lo que enseña
   * no vive en `web`, llega por su cuenta, así que desde ahí no se puede saber
   * y se dice que sí. Es la propia sección la que se calla si no hay nada.
   */
  caso('desde el índice no se adivina si hay algo', true,
    /if \(tipo === 'documentos'\) return true/.test(contenido))

  const seccion = sinComentarios(await fuenteDe('src/components/sitio/Documentos.tsx'))
  /*
   * EL SENTIDO DE `interactivo`, QUE ME SALIÓ AL REVÉS.
   *
   * Es `true` en la web DE VERDAD —donde los enlaces navegan— y `false` en la
   * vista previa del panel. La primera versión puso
   * `disabled={interactivo || …}`, o sea un botón «Descargar» apagado para
   * todos los visitantes y encendido solo en la vista previa, donde no hay
   * nada que descargar. Esta guarda es contra esa recaída exacta.
   */
  caso('el botón de descargar funciona en la web', true, /disabled=\{!interactivo \|\| bajando === d\.id\}/.test(seccion))
  caso('y no al revés', false, /disabled=\{interactivo \|\|/.test(seccion))
  /*
   * EN LA VISTA PREVIA SE DICE QUÉ FALTA; en la web no se pinta nada. Una
   * hermandad que enciende la sección y no ve nada no tiene forma de saber si
   * está mal la sección o es que no ha marcado ningún documento — y es siempre
   * lo segundo.
   */
  caso('la vista previa dice qué falta', true, /return interactivo \? null : \(/.test(seccion))
  caso('y dice dónde se arregla', true,
    /Hasta dónde sale → La web pública/.test(fuenteLlana(await fuenteDe('src/components/sitio/Documentos.tsx'))))
  /*
   * Y SE DESCARGA CON SU NOMBRE. Un PDF llamado `44444444-0000-…` en la
   * carpeta de descargas de alguien no se vuelve a abrir nunca.
   */
  caso('el fichero baja con su nombre', true, /a\.download = comoSeLlama/.test(seccion))

  // ---------------------------------------------------------------------
  // 4. EL AVISO DE FALLO, UNO SOLO.
  // ---------------------------------------------------------------------
  /*
   * `avisarDeFallo` estaba DOS VECES, palabra por palabra: en `supabaseSync.ts`
   * y otra copia local en `tienda.ts` con su propio comentario. Al necesitar lo
   * mismo para los documentos de la web iban a ser tres. Una sola, donde vive
   * la señal que el marco de la aplicación escucha.
   */
  const sync = sinComentarios(await fuenteDe('src/lib/supabaseSync.ts'))
  const tienda = sinComentarios(await fuenteDe('src/lib/tienda.ts'))
  caso('el aviso de fallo se exporta', true, /export function avisarDeFallo\(/.test(sync))
  caso('y la tienda ya no tiene su copia', false, /function avisarDeFallo\(/.test(tienda))
  caso('la tienda lo trae de donde vive', true, /avisarDeFallo \} from '\.\/supabaseSync'/.test(tienda))
  caso('y los documentos de la web también', true,
    /import \{ avisarDeFallo \} from '\.\/supabaseSync'/.test(cargador))
}
