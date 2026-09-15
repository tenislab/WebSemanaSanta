/**
 * «QUÉ LE FALTA A TU WEB»: las doce comprobaciones.
 *
 * Mira una web y devuelve lo que le falta para estar publicable —sin título,
 * sin foto de portada, sin contacto, fotos sin describir, colores que no se
 * leen…— con a qué pestaña hay que ir para arreglar cada cosa.
 *
 * Es lógica pura sobre un objeto, sin pantalla ni navegador, y por eso está en
 * su fichero: se puede ejecutar con datos en una prueba.
 */
import {
  avisoDePeso,
  contenidoVacio,
  diasHasta,
  fotosSinDescribir,
  pesoWeb,
  urlSegura,
  type WebPublica,
} from '../../../lib/webPublica'
import { type Pestana } from './pestanas'

export interface AvisoWeb {
  id: string
  texto: string
  /** A dónde lleva el botón «Arreglar». */
  pestana: Pestana
  /** Los graves salen marcados: la web se ve mal o coja sin esto. */
  grave?: boolean
}

/**
 * Lo que le falta a la web para estar presentable. Se enseña arriba del todo
 * porque el problema real no era no saber configurarlo, sino no enterarse de
 * que faltaba: se publicaban webs sin dirección, sin portada y sin un solo
 * culto.
 */
/**
 * CUÁNTAS COMPROBACIONES HACE `avisosDeLaWeb`. De aquí sale el porcentaje de
 * «lo que llevas hecho de la web», y por eso tiene que ser EXACTO.
 *
 * Decía 12 y son 16. No es un detalle de redondeo: el panel calcula
 * `hechos = COMPROBACIONES_WEB - avisos.length`, así que con más de doce avisos
 * a la vez el número se va a NEGATIVO. Medido, construyendo la web a medias que
 * lo consigue: dieciséis avisos, «-4 hechos» y **-33 %** en pantalla, con la
 * barra de progreso pintada a un `width` negativo y un `aria-valuenow` de -33
 * dentro de un rango declarado de 0 a 100. Y es la pantalla que ve una
 * hermandad el primer día, cuando su web está justo así: sin nada puesto.
 *
 * Son 16 y no 17 aunque haya diecisiete `push`: `titulares` y `titulares-foto`
 * son un `if/else`, así que nunca saltan las dos. Y son SIEMPRE 16, porque
 * todos los `if` se evalúan en cada llamada — de ahí que la cuenta salga
 * exacta y `avisos.length` no pueda pasarse.
 *
 * NO SE MANTIENE A MANO. El comentario de antes decía «si se añade o se quita
 * una comprobación, hay que tocarlo», y eso es justo lo que no se hace: se
 * añadieron cuatro y nadie lo tocó. Ahora lo vigila
 * `pruebas/avisosdelaweb.prueba.mjs`, que las cuenta en esta misma función y
 * compara.
 */
export const COMPROBACIONES_WEB = 16

export function avisosDeLaWeb(web: WebPublica): AvisoWeb[] {
  const avisos: AvisoWeb[] = []
  // Lo que se publica es lo escrito en la pestaña de Contacto, sin heredar
  // nada de Configuración (ver `contactoPublico.ts`). Por eso lo que se avisa
  // aquí es que FALTA, no que está heredado: antes una web sin contacto propio
  // no avisaba de nada porque contaba el dato interno como puesto.
  const dir = web.direccion
  const tel = web.telefono
  const email = web.email

  if (!dir) avisos.push({ id: 'dir', texto: 'Tu web no dice dónde estáis: falta la dirección de la sede.', pestana: 'contacto', grave: true })
  if (!tel && !email) avisos.push({ id: 'contacto', texto: 'No hay forma de contactar: pon al menos un teléfono o un correo.', pestana: 'contacto', grave: true })
  if (web.heroFotos.length === 0) avisos.push({ id: 'portada', texto: 'La portada no tiene ninguna foto (se ve un degradado de color).', pestana: 'portada' })
  if (contenidoVacio(web.historia)) avisos.push({ id: 'historia', texto: 'La sección «Historia» está vacía y no se publica.', pestana: 'diseno' })
  // La cuenta atrás desaparece sola cuando la fecha pasa, y la hermandad no se
  // entera de que hay un dato viejo en su web.
  if (web.estacion.fechaSalida && diasHasta(web.estacion.fechaSalida) !== null && diasHasta(web.estacion.fechaSalida)! < 0) {
    avisos.push({ id: 'salida-pasada', texto: 'La fecha de la salida ya pasó: pon la del año que viene.', pestana: 'estacion' })
  }
  // El peso: las fotos van dentro del propio contenido, así que esto ES lo que
  // se descarga en cada visita.
  const peso = avisoDePeso(pesoWeb(web))
  if (peso.nivel !== 'ok') {
    avisos.push({
      id: 'peso',
      texto: `Tu web pesa ${peso.peso}: unos ${peso.segundos} segundos en un móvil con mala cobertura.`,
      pestana: 'galeria',
    })
  }
  const sinDescribir = fotosSinDescribir(web)
  if (sinDescribir.length > 0) {
    avisos.push({
      id: 'alt',
      texto: `Hay fotos sin describir (${sinDescribir.map((f) => f.donde).filter((v, i, xs) => xs.indexOf(v) === i).join(', ')}): quien no las ve no sabe qué hay.`,
      pestana: sinDescribir[0].donde === 'Galería' ? 'galeria' : sinDescribir[0].donde === 'Actualidad' ? 'actualidad' : 'titulares',
    })
  }
  const enBorrador = web.secciones.filter((s) => s.visible && s.borrador)
  if (enBorrador.length > 0) {
    avisos.push({
      id: 'borrador',
      texto: `${enBorrador.length} ${enBorrador.length === 1 ? 'sección está' : 'secciones están'} en borrador: se ven aquí, pero no en tu web.`,
      pestana: 'diseno',
    })
  }
  if (web.titulares.length === 0) avisos.push({ id: 'titulares', texto: 'No has puesto ningún titular.', pestana: 'diseno' })
  // La sección con más devoción detrás es la que peor sale sin fotos: ahora se
  // publican a lo ancho, y sin imagen se quedan en un párrafo suelto.
  else if (web.titulares.every((t) => !t.fotoDataUrl)) avisos.push({ id: 'titulares-foto', texto: 'Tus titulares no tienen foto.', pestana: 'titulares' })
  if (web.cultos.length === 0) avisos.push({ id: 'cultos', texto: 'No hay cultos publicados: es lo que más se busca en una web de hermandad.', pestana: 'cultos' })
  if (!web.albumes.some((a) => a.fotos.length > 0)) avisos.push({ id: 'galeria', texto: 'La galería está vacía: sin fotos, la web se queda muy sosa.', pestana: 'galeria' })
  if (web.redes.length === 0) avisos.push({ id: 'redes', texto: 'No has enlazado ninguna red social.', pestana: 'contacto' })
  const enlacesRotos = web.pie.columnas.flatMap((c) => c.enlaces).filter((e) => (e.texto.trim() || e.url.trim()) && !urlSegura(e.url)).length
  if (enlacesRotos > 0) {
    avisos.push({
      id: 'enlaces',
      texto: `${enlacesRotos === 1 ? 'Un enlace del pie no lleva' : `${enlacesRotos} enlaces del pie no llevan`} a ninguna parte: no se publican.`,
      pestana: 'marco',
      // Grave: no es que falte algo, es que hay algo MAL puesto. Si no, se
      // quedaba escondido bajo «ver más» y nadie lo arreglaba.
      grave: true,
    })
  }
  if (!web.seo.descripcion.trim()) avisos.push({ id: 'seo', texto: 'Al compartir el enlace no sale ninguna descripción: en WhatsApp y en Google aparece vacío.', pestana: 'compartir' })
  if (!web.pie.textoLegal.trim()) avisos.push({ id: 'legal', texto: 'El pie no tiene aviso legal ni política de privacidad (es obligatorio si recoges datos).', pestana: 'marco' })
  if (!web.publicada) avisos.push({ id: 'publicada', texto: 'La web está oculta: solo la ves tú.', pestana: 'diseno' })

  return avisos
}
