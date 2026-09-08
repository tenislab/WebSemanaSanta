/**
 * Genera `supabase/TODO-EN-UNO.sql` pegando los ficheros sueltos en orden.
 *
 * POR QUÉ EXISTE. Ese fichero es el que se pega en el editor de Supabase de
 * una vez, y estaba hecho a mano. Se quedó atrás: los arreglos de seguridad de
 * `multi-hermandad.sql` —cerrar `adoptar_datos_sin_hermandad`, no meter a un
 * titular en la hermandad de otros— no estaban dentro, así que quien montara
 * su base con el pegote se llevaba la versión con el agujero.
 *
 * Con esto se regenera:  node scripts/generar-todo-en-uno.mjs
 * Y `npm test` comprueba que está al día.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * EL ORDEN IMPORTA y no es alfabético.
 *
 * `multi-hermandad.sql` va el último a propósito: crea la frontera entre
 * hermandades sobre las tablas que han creado los anteriores. Si fuera antes,
 * no habría nada que separar.
 */
export const PIEZAS = [
  ['schema.sql', 'Todas las tablas'],
  ['columnas-que-faltan.sql', 'Columnas que solo llegaban a las bases nuevas (hora de citación, cobros…)'],
  ['rls-cargos.sql', 'Permisos por cargo de la junta'],
  ['rls-endurecer.sql', 'EL IMPORTANTE: cierra la escritura a quien se registre'],
  ['hermano-auth.sql', 'Acceso del hermano a su propia ficha'],
  ['web-publica.sql', 'La web pública'],
  ['mensajes-web.sql', 'Buzón de los formularios de la web'],
  ['storage-archivo.sql', 'Adjuntos del archivo documental'],
  ['add-provincia.sql', 'La provincia en la ficha de la hermandad'],
  // A partir de aquí, todo lo que necesita que exista `hermandad_id`.
  ['multi-hermandad.sql', 'TODAS las hermandades en una base, sin verse entre ellas'],
  ['apuntes-automaticos.sql', 'Que los cobros lleguen solos a Tesorería'],
  ['registro-actividad.sql', 'Quién hizo qué (RGPD, artículo 32)'],
  ['remesas.sql', 'Que una remesa SEPA no se cobre dos veces'],
  ['comunicados-segmento.sql', 'Guardar a quién iba dirigido un comunicado'],
  ['acceso-hermano.sql', 'Cerrar el barrido de DNI en el acceso del hermano'],
  ['area-hermano.sql', 'Que el área del hermano funcione de verdad'],
  ['correo-hermandad.sql', 'Que la configuración de correo sea de la hermandad'],
  ['hermano-y-gestion.sql', 'Ser hermano Y llevar la hermandad a la vez'],
  ['permisos-por-hermandad.sql', 'Que los permisos por cargo sean de cada hermandad'],
  ['colores-hermandad.sql', 'Que el área del hermano lleve los colores de su hermandad'],
  ['eventos-repeticion.sql', 'Que un culto que se repite siga repitiéndose'],
  ['suscripcion.sql', 'Que la suscripción sea de la hermandad, no del navegador'],
  ['plantillas-hermandad.sql', 'Que los modelos y la asistencia no se pierdan al cerrar sesión'],
  ['ajustes-de-la-hermandad.sql', 'Ajustes de cuotas y etiquetas: de la hermandad, no del navegador'],
  // EL ÚLTIMO, y tiene que seguir siéndolo: redefine `auth_es_hermano()`,
  // `modulo_permitido()` y varias políticas que crean los archivos de arriba.
  // De todas las definiciones de una función, manda la última que se ejecuta.
  ['hermano-con-cargo.sql', 'Una persona, una ficha: el cargo va en la ficha del hermano'],
  ['seguridad-claves-y-registro.sql', 'Fuera las contraseñas en claro; el registro lo escribe la base'],
  ['papeletas-simbolica-y-precio.sql', 'El precio de la papeleta y la simbólica: de la hermandad, no del navegador'],
  ['buscar-hermandad-con-su-escudo.sql', 'Que el hermano encuentre su hermandad por ciudad y la reconozca por su escudo'],
  ['redes-sociales.sql', 'Que cada hermandad tenga sus propias redes (la clave era global)'],
  ['clave-de-catalogos.sql', 'Que cada hermandad tenga sus propios catálogos (la clave era global)'],
  ['motivo-del-rechazo.sql', 'Por qué se rechazó un alta, para poder decírselo a quien la pidió'],
  ['imagenes.sql', 'El almacén de fotos: que la web no lleve las imágenes dentro'],
  ['visitas-web.sql', 'El contador de visitas de la web, sin cookies ni Google Analytics'],
  ['suscriptores-web.sql', 'Avisos por correo para quien sigue a la hermandad sin ser hermano'],
  ['copias.sql', 'Las copias de seguridad, guardadas solas cada semana'],
  // Va detrás de `hermano-con-cargo.sql` a propósito: siembra filas sobre los
  // cargos que esa siembra ya ha dejado puestos.
  ['permisos-eventos-y-web.sql', 'Los dos módulos que nunca se sembraron: «eventos» y «web»'],
  ['lo-que-toca-el-hermano.sql', 'Que el hermano no se ponga la cuota como pagada desde la consola'],
  ['sin-contrasenas-en-las-solicitudes.sql', 'Fuera la contraseña en claro que guardaba cada solicitud de alta'],
  ['freno-de-los-formularios.sql', 'Un tope a lo que cualquiera puede meter desde la web pública'],
  ['cuenta-por-hermandad.sql', 'Ser hermano de dos hermandades: una cuenta por hermandad + DNI'],
  ['solicitudes-de-papeleta.sql', 'Que la solicitud de papeleta del hermano llegue a la hermandad'],
  ['activar-la-suscripcion.sql', 'Que el botón de activar la suscripción llegue a la base'],
  ['numero-de-recibo-unico.sql', 'Que no pueda haber dos recibos con el mismo número'],
  ['borrar-una-hermandad.sql', 'Que una hermandad se pueda borrar (el registro lo impedía)'],
  ['documentos-restringidos.sql', 'Que el documento restringido lo sea también en la base'],
  ['webhook-stripe.sql', 'Que la suscripción se active cuando Stripe confirma el cobro, no antes'],
  ['mandatos-sepa.sql', 'El mandato SEPA firmado de verdad, por el propio hermano'],
  ['encargos-redes.sql', 'Encargar un post y que se reparta solo entre la junta'],
  ['tienda.sql', 'La tienda: productos, ventas, stock y los asientos que generan'],
  ['tienda-web.sql', 'La tienda en la web: reservar por internet y pagar al recoger'],
  ['campanas-y-proyectos.sql', 'Campañas de recaudación con su barra, y proyectos a largo plazo'],
  ['baja-de-hermano.sql', 'La baja de un hermano, entera y sin romper el escalafón'],
  ['campana-con-partida.sql', 'Enlazar una campaña a sus partidas: la barra se llena sola'],
  ['certificados.sql', 'El certificado de antigüedad que pide un hermano para acreditarlo fuera'],
  ['reglas-de-reparto.sql', 'Gastos porcentuales enlazados a una partida, para pérdidas y ganancias'],
  ['pago-tarjeta.sql', 'Que el hermano pague su cuota o su papeleta con tarjeta'],
  /*
   * ESTE FICHERO NO ESTABA EN NINGUNA DE LAS DOS LISTAS, Y ERA UN FALLO VIVO.
   *
   * Añade `opciones_papeleta.tramo_id`. Y `src/lib/opcionesPapeleta.ts` ESCRIBE
   * en esa columna al guardar las papeletas personalizadas de la hermandad.
   *
   * O sea que en TODAS las bases —nuevas incluidas, porque tampoco iba en el
   * instalador— guardar una papeleta personalizada fallaba entera: Postgres no
   * ignora la columna que no existe, rechaza la sentencia. No se perdía ese
   * dato, se perdía la fila. Y en pantalla no pasaba nada raro.
   *
   * Lo cazó la prueba que comprueba que ningún .sql se queda fuera de las
   * listas (`pruebas/sql-en-uno.prueba.mjs`), que llevaba tiempo en rojo. Es
   * exactamente la clase de fallo que el sello de versión existe para hacer
   * visible, y de hecho apareció montándolo.
   *
   * Va aquí, al final, porque necesita que existan `opciones_papeleta` y
   * `tramos`, y a estas alturas están las dos. Solo añade una columna con
   * `if not exists` y un comentario: no define ninguna función y se puede
   * repetir sin que pase nada.
   */
  ['papeleta-personalizada-en-el-cortejo.sql', 'Que una papeleta propia de la hermandad ocupe puesto en el cortejo'],
  /*
   * --- LO QUE HACE FALTA PARA CRECER SIN ROMPER NADA ---
   *
   * Las cinco piezas de abajo no añaden ninguna pantalla: son las que hacen
   * que se pueda seguir actualizando esto cuando haya cincuenta hermandades en
   * vez de tres. Cada fichero explica en su cabecera qué problema resuelve.
   *
   * EL ORDEN DE LAS CINCO NO ES CASUAL:
   *
   *   · `soporte.sql` REDEFINE `hermandad_actual()`, que es la frontera entre
   *     hermandades. Va después de `multi-hermandad.sql` (que la define) y
   *     nada de lo que viene detrás puede volver a tocarla. Hay una prueba que
   *     lo comprueba (`sql-actualizar.prueba.mjs`).
   *   · `version-del-esquema.sql` VA LA ÚLTIMA, siempre. El sello de la
   *     versión se pone después de ella, cuando ya ha pasado todo lo demás:
   *     sellar antes sería prometer que está puesto algo que igual no llegó.
   */
  ['vigilancia.sql', 'Que los fallos se apunten solos: con cincuenta hermandades no te los cuenta nadie'],
  ['canal-de-actualizacion.sql', 'Sacar una novedad a una hermandad piloto antes que a todas'],
  ['restaurar-copia.sql', 'Poder volcar la copia de UNA hermandad sin tocar a las demás'],
  ['soporte.sql', 'Ver lo que ve esa hermandad para poder ayudarla, y que quede escrito'],
  ['version-del-esquema.sql', 'Que la aplicación avise cuando la base se ha quedado atrás'],
]

const CABECERA = `-- =============================================================================
--
--   GOBERGO — TODO EL SQL, EN UN SOLO ARCHIVO
--
-- =============================================================================
--
--   GENERADO. No lo edites a mano: se sobrescribe.
--   Se toca el fichero suelto y se vuelve a generar con
--       node scripts/generar-todo-en-uno.mjs
--
-- -----------------------------------------------------------------------------
-- CÓMO SE USA
-- -----------------------------------------------------------------------------
--
--   1. Abre tu proyecto en supabase.com
--   2. Menú izquierdo → SQL Editor → New query
--   3. Copia ESTE ARCHIVO ENTERO, pégalo y dale a RUN
--
-- Tarda unos segundos. Es seguro volver a ejecutarlo: todo está escrito para
-- no romperse si ya existía.
--
-- -----------------------------------------------------------------------------
-- QUÉ CREA, POR ORDEN
-- -----------------------------------------------------------------------------
--
${PIEZAS.map(([f, q], i) => `--   ${String(i + 1).padStart(2, ' ')}. ${f.padEnd(26)} ${q}`).join('\n')}
--
-- -----------------------------------------------------------------------------
-- LO ÚNICO QUE HAY QUE LEER ANTES
-- -----------------------------------------------------------------------------
--
-- \`rls-endurecer.sql\` es el que impide que cualquiera que se registre en
-- /registro obtenga permiso de escritura sobre TODA la base de datos.
--
-- \`multi-hermandad.sql\` es el que hace que en esta misma base quepan TODAS
-- las hermandades sin que ninguna vea nada de las demás. Va después de las
-- tablas, porque separa lo que ellas han creado, y antes de todo lo que
-- necesita la columna \`hermandad_id\` que él añade.
--
-- NO HAY QUE DARSE DE ALTA A MANO COMO TITULAR. La primera vez que entras, la
-- aplicación crea tu hermandad y te deja como titular sola. Tú solo tienes que
-- registrarte con tu correo.
--
-- =============================================================================

`

/**
 * EL SELLO DE LA VERSIÓN.
 *
 * Va al FINAL, cuando ya han pasado todas las piezas: sellar antes sería
 * prometer que está puesto algo que igual no llegó a ejecutarse.
 *
 * LA VERSIÓN ES EL NÚMERO DE PIEZAS DEL INSTALADOR. No hay que acordarse de
 * subirla: sube sola al añadir un fichero a la lista, que es exactamente el
 * momento en que las bases existentes se quedan atrasadas. Lo único que hay
 * que hacer a mano es poner el mismo número en `src/lib/versionEsquema.ts`, y
 * si se olvida, `npm test` lo dice. Ver `supabase/version-del-esquema.sql`.
 */
export function selloDeVersion(cuantasPiezas) {
  return `
-- =============================================================================
--   SELLO DE LA VERSIÓN — que la aplicación sepa que esta base está al día
-- =============================================================================
--
-- Generado. Es el número de piezas de esta instalación. La aplicación lo lee al
-- arrancar y avisa si va por detrás; ver \`src/lib/versionEsquema.ts\`.

select sellar_esquema(${cuantasPiezas});
`
}

export async function generar() {
  const trozos = [CABECERA]
  for (const [fichero, queHace] of PIEZAS) {
    const cuerpo = await readFile(join(raiz, 'supabase', fichero), 'utf8')
    trozos.push(
      `\n-- =============================================================================\n` +
      `--   ${fichero.toUpperCase()} — ${queHace}\n` +
      `-- =============================================================================\n\n` +
      cuerpo.trimEnd() + '\n',
    )
  }
  trozos.push(selloDeVersion(PIEZAS.length))
  return trozos.join('')
}

// Solo escribe si se ejecuta a mano; importarlo (desde las pruebas) no toca nada.
if (process.argv[1] && process.argv[1].endsWith('generar-todo-en-uno.mjs')) {
  const salida = await generar()
  await writeFile(join(raiz, 'supabase', 'TODO-EN-UNO.sql'), salida, 'utf8')
  console.log(`TODO-EN-UNO.sql regenerado: ${PIEZAS.length} ficheros, ${salida.split('\n').length} líneas.`)
}
