/**
 * PONER UNA IMAGEN: AL ACTO Y AL ARTÍCULO.
 *
 * «En eventos y tareas que se le pueda poner una imagen, y en tienda que se
 * pueda poner imagen del producto para que sea más sencillo.»
 *
 * Y «más sencillo» es la palabra exacta del problema. La tienda YA guardaba
 * `fotoUrl` y la web pública YA la pintaba; lo único que no se podía era
 * PONERLA: el campo era un cuadro de texto para escribir «https://…». Para
 * enseñar una medalla había que subir antes la foto a otro sitio —y tener ese
 * otro sitio—. Eso no es poder poner la foto del artículo, es poder enlazarla.
 * Los eventos no tenían imagen de ninguna manera.
 *
 * Comprobado en el navegador subiendo un PNG de 400×300 de verdad, con
 * `DOM.setFileInputFiles`, en las dos pantallas: entra, se comprime a WebP, se
 * ve la vista previa y queda guardado en el registro.
 */
import { fuenteDe } from './fuentes.mjs'

export default async function ({ cargar, caso }) {
  // ---------------------------------------------------------------------
  // 1. EL TAMAÑO DICHO: nunca «0 kB».
  // ---------------------------------------------------------------------
  /*
   * Primera versión: `Math.round(bytes / 1024) + ' kB'`. Con el PNG de prueba
   * —78 bytes— la vista previa ponía «Guardada aquí · 0 kB», que se lee como
   * que no ha entrado nada justo al lado de la imagen que sí ha entrado. Salió
   * mirando la pantalla; en el código era una división correcta.
   */
  const campo = await fuenteDe('src/components/CampoImagen.tsx')
  const cuerpoDelPeso = campo.slice(campo.indexOf('function peso('), campo.indexOf('export default function'))
  caso('el tamaño se dice en una función aparte', true, cuerpoDelPeso.length > 100)
  caso('por debajo de un kB se dicen los bytes', true, /bytes < 1024/.test(cuerpoDelPeso) && /bytes\} bytes/.test(cuerpoDelPeso))
  caso('y no se redondea a cero', false, /^[^]*Math\.round\(pesoDeDataUrl\([^)]*\) \/ 1024\)\} kB/.test(campo))

  // ---------------------------------------------------------------------
  // 2. LA IMAGEN SE COMPRIME ANTES DE GUARDARSE.
  // ---------------------------------------------------------------------
  /*
   * Con `recibirImagen`, que es el único sitio donde comprimir y subir van
   * juntos. Cuando estaban separados, tres pantallas subían la misma clase de
   * imagen de tres maneras distintas y una se dejaba 800 KB en base64 dentro
   * de una fila que se lee en cada carga del panel y de la web.
   */
  caso('la imagen pasa por recibirImagen', true, /recibirImagen\(dataUrl, \{ carpeta \}\)/.test(campo))
  caso('y no se guarda el fichero a pelo', false, /onCambiar\(dataUrl\)/.test(campo))
  // Cada pantalla guarda en su carpeta: el almacén no es un cajón único.
  caso('la carpeta es obligatoria', true, /carpeta: string/.test(campo))

  /*
   * SI LA IMAGEN NO ENTRA, SE DICE. Antes de esto, una imagen ilegible dejaba
   * el campo igual que estaba y quien la había elegido se iba convencido de
   * haberla puesto. Es el peor sitio para callarse: en la tienda la foto no se
   * vuelve a ver hasta que alguien abre la web.
   */
  caso('un fallo al leerla se cuenta', true, /setFallo\(/.test(campo) && /form-hint--error/.test(campo))

  /*
   * Y SIGUE CABIENDO UNA DIRECCIÓN. Quien ya tenga sus fotos en su web no
   * tiene por qué volver a subirlas: lo que se añade es el botón, no se quita
   * la otra puerta. Va plegada para que no haya dos caminos a la vista y se
   * dude de cuál es el propio.
   */
  caso('se puede pegar una dirección', true, /type="url"/.test(campo))
  caso('y va plegada', true, /<details className="campo-imagen__enlace">/.test(campo))

  /*
   * LA VISTA PREVIA. No es un adorno: es el único modo de saber que se ha
   * subido LA imagen que se quería, porque el nombre del fichero no lo dice.
   */
  caso('hay vista previa', true, /campo-imagen__vista[\s\S]{0,200}<img src=\{valor\}/.test(campo))
  caso('y se puede quitar', true, /onCambiar\(undefined\)/.test(campo))

  // ---------------------------------------------------------------------
  // 3. EL CARTEL DEL ACTO.
  // ---------------------------------------------------------------------
  const eventos = await fuenteDe('src/pages/app/Eventos.tsx')
  caso('el alta de un acto tiene cartel', true, /rotulo="Cartel o foto \(opcional\)"/.test(eventos))
  caso('y la ficha también', true, /rotulo="Cartel o foto"/.test(eventos))
  caso('los dos guardan en la carpeta de eventos', 2, (eventos.match(/carpeta="eventos"/g) ?? []).length)
  caso('el cartel viaja en el acto nuevo', true, /imagen: imagenNueva/.test(eventos))
  caso('y la ficha lo cambia en el acto que se mira', true,
    /aplicarEvento\(seleccionado\.id, \{ imagen: v \}\)/.test(eventos))

  /*
   * EL ALTA SE VACÍA AL GUARDAR. Si no, el cartel del acto anterior saldría
   * puesto en el siguiente, y se publicaría el cartel equivocado sin que nada
   * lo diga. Es el mismo fallo que la `key` evita en la ficha, por la otra
   * puerta: ahí el estado se queda del acto anterior, aquí del alta anterior.
   */
  caso('el alta se vacía al guardar', true, /setImagenNueva\(undefined\)/.test(eventos))
  caso('y la ficha arranca con el cartel del acto que se abre', true,
    /key=\{seleccionado\.id\}/.test(eventos))

  /*
   * SE VE EN LA LISTA, Y POR ESO SIRVE DE ALGO. En el calendario no cabe —la
   * casilla de un día da para «20:30 T…»— y una imagen que solo se ve abriendo
   * el acto no se la mira nadie. Medido: la miniatura sale a 64×44 px y los
   * tres actos sin cartel no dejan hueco.
   *
   * Y la ayuda del campo NO puede prometer la web pública: los eventos no se
   * publican ahí. La primera versión lo decía, y era mentira en una frase que
   * está justo para que te fíes de ella.
   */
  caso('la miniatura sale en la lista', true, /className="eventos-item__cartel"/.test(eventos))
  caso('solo si hay cartel', true, /\{e\.imagen && <img className="eventos-item__cartel"/.test(eventos))
  caso('la ayuda no promete la web pública', false,
    /ayuda="[^"]*web pública[^"]*"[\s\S]{0,400}carpeta="eventos"/.test(eventos)
    || /carpeta="eventos"[\s\S]{0,400}ayuda="[^"]*web pública[^"]*"/.test(eventos))

  /* Y el cartel llega a la base: el tipo, el mapeo de ida y el de vuelta. */
  const { eventoToRow, rowToEvento } = await cargar('src/lib/db/eventos.ts')
  const acto = {
    id: 'e1', titulo: 'Triduo', tipo: 'Culto', fecha: '2027-02-10',
    imagen: 'https://almacen/carteles/triduo.webp', tareas: [],
  }
  caso('el cartel viaja a la base', 'https://almacen/carteles/triduo.webp', eventoToRow(acto).imagen)
  caso('y vuelve', 'https://almacen/carteles/triduo.webp',
    rowToEvento(eventoToRow(acto)).imagen)
  // Sin cartel se manda `null`, no `undefined`: `undefined` desaparece al
  // serializar y la columna se quedaría con lo que hubiera antes en vez de
  // vaciarse. Es el mismo tropiezo que ya tuvieron `tareas` y `repeticion`.
  caso('quitar el cartel lo vacía de verdad', null, eventoToRow({ ...acto, imagen: undefined }).imagen)
  caso('y al volver es undefined, no null', undefined,
    rowToEvento({ ...eventoToRow(acto), imagen: null }).imagen)

  // ---------------------------------------------------------------------
  // 4. LA FOTO DEL ARTÍCULO, EN LAS DOS PANTALLAS QUE LA TIENEN.
  // ---------------------------------------------------------------------
  /*
   * La ficha del artículo está DUPLICADA: `tienda/PanelArticulos.tsx` (la
   * pestaña de la tienda) y `TiendaInventario.tsx`. Las dos tenían el campo de
   * la dirección, así que las dos tienen que tener el de subir: arreglar una y
   * dejar la otra es dejar media aplicación con el camino viejo y sin que nada
   * lo diga.
   */
  for (const ruta of ['src/pages/app/tienda/PanelArticulos.tsx', 'src/pages/app/TiendaInventario.tsx']) {
    const pantalla = await fuenteDe(ruta)
    const corta = ruta.split('/').pop()
    caso(`${corta}: se puede subir la foto`, true, /rotulo="Foto del artículo"/.test(pantalla))
    caso(`${corta}: en la carpeta de la tienda`, true, /carpeta="tienda"/.test(pantalla))
    /*
     * ESTOS FORMULARIOS SE LEEN CON `FormData` EN EL `submit`, y la foto se
     * sube ANTES —el fichero pasa por el almacén y lo que queda es su
     * dirección—, así que tiene que viajar en un campo oculto con el nombre
     * que el `submit` busca. Sin esto la foto se vería en la vista previa y no
     * se guardaría: el peor desenlace, porque parece que ha funcionado.
     */
    caso(`${corta}: la foto viaja en el campo que lee el submit`, true,
      /nombreCampo="fotoUrl"/.test(pantalla) && /d\.get\('fotoUrl'\)/.test(pantalla))
    /* Y la ficha arranca con la foto del artículo que se abre, no con la del
       anterior, que se guardaría en la ficha equivocada. */
    caso(`${corta}: arranca con la foto del artículo que se abre`, true,
      /setFoto\(p\?\.fotoUrl\)/.test(pantalla) && /key=\{editando\?\.id \?\? 'nuevo'\}/.test(pantalla))
    /* El cuadro de texto pelado ya no es el único camino. */
    caso(`${corta}: ya no hay un «Foto (dirección)» suelto`, false,
      /<label htmlFor="fotoUrl">Foto \(dirección\)<\/label>/.test(pantalla))
  }

  // ---------------------------------------------------------------------
  // 5. LA COLUMNA, PARA QUE EL CARTEL SOBREVIVA A RECARGAR.
  // ---------------------------------------------------------------------
  /*
   * La repetición de un evento ya se perdió así: la pantalla la guardaba, el
   * mapeo no la mandaba y la columna no existía, así que al recargar el culto
   * volvía a ser una fecha suelta. Aquí van las tres cosas, no una.
   */
  const pieza = await fuenteDe('supabase/imagen-del-evento.sql')
  caso('hay pieza de SQL para la columna', true,
    /alter table eventos add column if not exists imagen text/.test(pieza))
  caso('y se puede ejecutar dos veces', true, /if not exists/.test(pieza))
  const instalador = await fuenteDe('supabase/TODO-EN-UNO.sql')
  const actualizar = await fuenteDe('supabase/ACTUALIZAR.sql')
  caso('la pieza entra en el instalador', true, /add column if not exists imagen text/.test(instalador))
  caso('y en lo que actualiza una base ya montada', true,
    /add column if not exists imagen text/.test(actualizar))
  // Y una instalación nueva ya la trae en la tabla, sin depender del parche.
  const esquema = await fuenteDe('supabase/schema.sql')
  const tablaEventos = esquema.slice(
    esquema.indexOf('create table if not exists eventos ('),
    esquema.indexOf('alter table eventos enable row level security'),
  )
  caso('se acota la tabla de eventos', true, tablaEventos.length > 100)
  caso('una base nueva ya trae la columna', true, /\n  imagen text,/.test(tablaEventos))
}
