/**
 * QUE TODA IMAGEN QUE ENTRA PASE POR EL ALMACÉN.
 *
 * Esta prueba no mira lo que hace una función: mira el CÓDIGO FUENTE de la
 * aplicación. Y es de las pocas que se justifican así, porque el fallo que
 * caza no se puede ver de ninguna otra manera.
 *
 * Lo que pasó, y es exactamente lo que va a volver a pasar:
 *
 *   · El asistente de alta subía el escudo bien: lo encogía y lo mandaba al
 *     almacén.
 *   · CONFIGURACIÓN —la pantalla donde se cambia después— lo guardaba tal cual
 *     salió del móvil, en base64, dentro de `hermandad_settings`.
 *   · El editor del modelo de papeleta lo encogía, con su propia copia del
 *     compresor, pero no lo subía.
 *
 * Tres sitios, tres comportamientos, para la misma acción. Y NADA LO DELATA:
 * no hay error, la imagen se ve perfectamente, la pantalla se guarda. Lo único
 * que ocurre es que esa fila —que se lee entera en cada carga del panel y de
 * la web pública— pesa cientos de kilos para siempre, y que WhatsApp no puede
 * leer una imagen escrita en `data:`, así que el enlace de la hermandad se
 * comparte sin foto.
 *
 * Un fallo que no se ve al probar a mano y que solo se nota en la factura de
 * datos de quien visita la web hay que cazarlo mecánicamente o no se caza.
 *
 * LA REGLA: quien lee un archivo del disco para guardarlo como imagen tiene
 * que pasar por `almacenImagenes`. Si un fichero nuevo hace `readAsDataURL` o
 * `leerArchivo` y no importa nada de ahí, esta prueba lo dice por su nombre.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Todos los .ts y .tsx de `src`, con su ruta relativa. */
function fuentes(dir, base = dir) {
  const salida = []
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) salida.push(...fuentes(ruta, base))
    else if (/\.tsx?$/.test(nombre)) salida.push({ ruta: ruta.slice(base.length + 1), texto: readFileSync(ruta, 'utf8') })
  }
  return salida
}

export default async function ({ caso }) {
  const archivos = fuentes('src')

  /*
   * LOS QUE LEEN UN ARCHIVO DE IMAGEN.
   *
   * `backup.ts` e `ImportarTabla`/`ImportarCenso`/`TraerDatos` también leen
   * archivos, pero no son imágenes: son copias de seguridad y hojas de
   * cálculo, que no tienen nada que hacer en un almacén de imágenes.
   */
  const EXENTOS = new Set([
    // Lee el JSON de una copia de seguridad.
    'lib/backup.ts',
    // Es la propia biblioteca de tratamiento de imágenes: aquí VIVE `leerArchivo`.
    'lib/imagen.ts',
    // Y este es el almacén.
    'lib/almacenImagenes.ts',
    /*
     * EL ARCHIVO DOCUMENTAL TIENE SU PROPIO ALMACÉN, y está bien que lo
     * tenga: `filestore.ts` sube al cubo `documentos`, que NO es público —un
     * acta de cabildo no se comparte por WhatsApp— mientras que el de
     * imágenes lo es a propósito, para que la foto se vea al pegar el enlace.
     * Dos cubos con dos permisos distintos porque guardan dos cosas
     * distintas. Lo que importa —que el adjunto no acabe en base64 dentro de
     * una fila— también lo cumple.
     */
    'lib/filestore.ts',
    'pages/app/Archivo.tsx',
  ])

  const leenImagenes = archivos.filter((a) => {
    if (EXENTOS.has(a.ruta)) return false
    if (!/readAsDataURL|leerArchivo\s*\(/.test(a.texto)) return false
    // Los importadores de datos leen texto, no fotos.
    return !/leerArchivo\s*\(\s*\)/.test(a.texto)
  })

  caso(
    'hay sitios que leen imágenes del disco (si no, esta prueba no vigila nada)',
    true,
    leenImagenes.length > 0,
  )

  /*
   * Y TODOS TIENEN QUE IMPORTAR EL ALMACÉN.
   *
   * Basta con mirar el import: quien lo trae es porque va a subir. Es una
   * comprobación tosca a propósito —no analiza el flujo— y por eso no puede
   * dar un falso positivo que obligue a nadie a pelearse con ella: si de
   * verdad no hace falta subir, se añade a EXENTOS con el motivo escrito.
   */
  caso(
    'todo el que lee una imagen del disco pasa por el almacén',
    [],
    leenImagenes
      .filter((a) => !/from '.*almacenImagenes'/.test(a.texto))
      .map((a) => a.ruta),
  )

  /*
   * Y NADIE SE HACE SU PROPIO COMPRESOR.
   *
   * El editor del modelo de papeleta tenía una copia entera de `comprimirImagen`,
   * con otro tamaño máximo y otra calidad que la de `lib/imagen.ts`. Dos copias
   * del mismo código son dos comportamientos distintos para lo mismo, y la
   * segunda es justo la que se olvida de subir.
   */
  caso(
    'el compresor de imágenes vive en un solo sitio',
    ['lib/imagen.ts'],
    archivos
      .filter((a) => /function comprimirImagen|const comprimirImagen\s*=/.test(a.texto))
      .map((a) => a.ruta),
  )

  /*
   * EL ESCUDO, EN CONCRETO.
   *
   * Es el que se rompió, y el que más duele: sale en todos los documentos que
   * se imprimen y en la cabecera de la web. Se comprueba por su nombre para
   * que quede dicho, no solo por la regla general de arriba.
   */
  const config = archivos.find((a) => a.ruta === 'pages/app/Configuracion.tsx')
  caso('Configuración existe', true, !!config)
  caso(
    'y el escudo se encoge y se sube, no se guarda tal cual',
    true,
    /recibirImagen\(/.test(config.texto),
  )
  caso(
    'sin FileReader suelto guardando el escudo',
    false,
    /readAsDataURL/.test(config.texto),
  )

  /*
   * Y LO QUE YA ESTÁ GUARDADO PESADO SE MUDA.
   *
   * Arreglar la subida solo arregla lo de mañana. La hermandad que lleva meses
   * con su escudo dentro de los ajustes lo arrastraría para siempre.
   */
  caso(
    'los ajustes que ya tienen imágenes dentro se mudan al abrir Configuración',
    true,
    /mudarImagenes\(/.test(config.texto) && /sustituirImagenes\(/.test(config.texto),
  )
}
