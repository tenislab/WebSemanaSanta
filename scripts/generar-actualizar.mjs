/**
 * Genera `supabase/ACTUALIZAR.sql`: lo que le falta a una base que YA ESTÁ
 * MONTADA, y nada más.
 *
 * POR QUÉ NO VALE `TODO-EN-UNO.sql` PARA ESTO. Vale, y es seguro, pero son
 * 4.500 líneas y 34 ficheros para añadir cuatro cosas: nadie lo lee, y lo que
 * no se lee no se revisa. Este trae solo lo nuevo.
 *
 * POR QUÉ NO VALE EJECUTAR LOS FICHEROS SUELTOS UNO A UNO, que es lo que se
 * venía diciendo. Porque varios de ellos NO se pueden ejecutar solos sobre una
 * base al día, y no lo avisan:
 *
 *   `permisos-por-hermandad.sql` redefine `modulo_permitido()`. Esa función la
 *   vuelve a redefinir después `hermano-con-cargo.sql`, añadiéndole una
 *   tercera vía —el hermano que lleva un cargo en su ficha—. De todas las
 *   definiciones manda la última que se ejecuta, así que ejecutar el fichero
 *   viejo por su cuenta deja sin acceso a TODO hermano con cargo en la ficha:
 *   el tesorero que además es hermano se queda fuera de Tesorería, y la única
 *   pista es un «no tienes permiso» donde antes no lo había.
 *
 * Aquí solo entran ficheros que se pueden ejecutar sueltos: los que no
 * redefinen nada que otro fichero posterior vuelva a definir. `npm test` lo
 * comprueba, para que no se cuele uno por descuido.
 *
 * Se regenera con:  node scripts/generar-actualizar.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * LO QUE SE AÑADIÓ DESPUÉS DE LA INSTALACIÓN, en orden de ejecución.
 *
 * Todos cumplen lo mismo: crean lo suyo, no tocan lo de nadie, y se pueden
 * volver a ejecutar sin que pase nada.
 */
export const PIEZAS_ACTUALIZACION = [
  ['ajustes-de-la-hermandad.sql', 'Los ajustes de cuotas y las etiquetas, guardados en la hermandad'],
  ['clave-de-catalogos.sql', 'Que cada hermandad tenga sus propios catálogos (la clave era global)'],
  ['imagenes.sql', 'El almacén de fotos: que la web no lleve las imágenes dentro'],
  ['visitas-web.sql', 'El contador de visitas de la web, sin cookies ni Google Analytics'],
  ['suscriptores-web.sql', 'Avisos por correo para quien sigue a la hermandad sin ser hermano'],
  ['copias.sql', 'Las copias de seguridad, guardadas solas cada semana'],
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
]

const CABECERA = `-- =============================================================================
--
--   GOBERGO — ACTUALIZAR UNA BASE QUE YA FUNCIONA
--
-- =============================================================================
--
--   GENERADO. No lo edites a mano: se sobrescribe.
--   Se toca el fichero suelto y se vuelve a generar con
--       node scripts/generar-actualizar.mjs
--
-- -----------------------------------------------------------------------------
-- PARA QUIÉN ES ESTE ARCHIVO
-- -----------------------------------------------------------------------------
--
-- Para una base que YA está montada y a la que le faltan las últimas piezas.
--
-- Si estás empezando de cero, este no: usa \`TODO-EN-UNO.sql\`, que lo crea
-- todo. Ejecutar los dos tampoco rompe nada, solo sobra.
--
-- -----------------------------------------------------------------------------
-- CÓMO SE USA
-- -----------------------------------------------------------------------------
--
--   1. Abre tu proyecto en supabase.com
--   2. Menú izquierdo → SQL Editor → New query
--   3. Copia ESTE ARCHIVO ENTERO, pégalo y dale a RUN
--
-- Al terminar sale una tabla diciendo qué hay puesto y qué no. Es lo único que
-- devuelve: si sale todo en «puesto», ya está.
--
-- Es seguro volver a ejecutarlo. Todo está escrito para no romperse si ya
-- existía, y nada de lo que hay aquí borra ni sobrescribe datos.
--
-- -----------------------------------------------------------------------------
-- QUÉ AÑADE
-- -----------------------------------------------------------------------------
--
${PIEZAS_ACTUALIZACION.map(([f, q], i) => `--   ${i + 1}. ${f.padEnd(30)} ${q}`).join('\n')}
--
-- -----------------------------------------------------------------------------
-- LO QUE ESTE ARCHIVO NO LLEVA, Y POR QUÉ
-- -----------------------------------------------------------------------------
--
-- 1. \`permisos-por-hermandad.sql\` NO ESTÁ, y no se debe ejecutar suelto sobre
--    una base al día. Redefine \`modulo_permitido()\`, que \`hermano-con-cargo.sql\`
--    vuelve a definir después con una vía más: el hermano que lleva un cargo en
--    su ficha. Manda la última definición que se ejecuta, así que el fichero
--    viejo por su cuenta deja fuera al tesorero que además es hermano. De ahí
--    solo hacía falta el relleno de «eventos» y «web», y ese va arriba, en su
--    propio fichero, sin tocar ninguna función.
--
-- 2. \`tareas-programadas.sql\` NO ESTÁ porque necesita la extensión \`pg_cron\`
--    activada antes, y eso se hace a mano: Database → Extensions → pg_cron.
--    Puesta la extensión, ese fichero se ejecuta aparte. Sin él todo funciona;
--    lo único que no pasa solo es la limpieza de visitas viejas y de
--    suscriptores sin confirmar.
--
-- =============================================================================

`

/**
 * EL INFORME DEL FINAL.
 *
 * En el editor de Supabase solo se ve el resultado de la última consulta, así
 * que va aquí abajo. Y va porque «Success. No rows returned» no distingue
 * entre «se ha hecho todo» y «se ha hecho la mitad»: enseñar qué quedó puesto
 * es la diferencia entre creer que está y saber que está.
 */
const INFORME = `

-- =============================================================================
--   QUÉ HA QUEDADO PUESTO
-- =============================================================================

select * from (values
  ('Ajustes de cuotas de la hermandad',
   (select count(*) > 0 from information_schema.columns
     where table_name = 'hermandad_settings' and column_name = 'ajustes_cuotas')),
  ('Catálogo de etiquetas',
   (select count(*) > 0 from information_schema.columns
     where table_name = 'hermandad_settings' and column_name = 'etiquetas')),
  /*
   * Los dos módulos que faltaban, mirando SOLO las hermandades que tienen
   * permisos sembrados.
   *
   * Una hermandad sin NINGUNA fila en «permisos_cargo» es otra avería
   * distinta —nadie con cargo puede hacer nada allí— y el relleno no la toca a
   * propósito: no se le inventan cargos que nunca tuvo. Metiéndola en esta
   * cuenta, el informe decía «no» después de haber hecho su trabajo bien, que
   * es la peor manera de informar: parece que el fichero ha fallado. Va en su
   * propia línea, abajo.
   */
  ('Permiso de «eventos» al Hermano Mayor',
   (select count(*) = 0 from hermandades h
     where exists (select 1 from permisos_cargo pc where pc.hermandad_id = h.id)
       and not exists (
      select 1 from permisos_cargo pc
       where pc.hermandad_id = h.id and pc.cargo = 'Hermano Mayor' and pc.modulo_id = 'eventos'))),
  ('Permiso de «web» al Hermano Mayor',
   (select count(*) = 0 from hermandades h
     where exists (select 1 from permisos_cargo pc where pc.hermandad_id = h.id)
       and not exists (
      select 1 from permisos_cargo pc
       where pc.hermandad_id = h.id and pc.cargo = 'Hermano Mayor' and pc.modulo_id = 'web'))),
  /*
   * Y si alguna hermandad se quedó SIN PERMISOS DE NINGÚN TIPO, se dice. Pasa
   * con las creadas antes de que existiera la siembra: la junta entra, no
   * puede tocar nada y no hay forma de saber por qué. Se arregla ejecutando
   * «permisos-por-hermandad.sql», que sí siembra desde cero.
   */
  ('Ninguna hermandad se ha quedado sin permisos',
   (select count(*) = 0 from hermandades h
     where not exists (select 1 from permisos_cargo pc where pc.hermandad_id = h.id))),
  ('Almacén de imágenes de la web',
   (select count(*) > 0 from storage.buckets where id = 'imagenes')),
  ('Contador de visitas',
   (select to_regclass('public.visitas_web') is not null)),
  ('Suscriptores de la web',
   (select to_regclass('public.suscriptores_web') is not null)),
  ('Copias de seguridad',
   (select count(*) > 0 from storage.buckets where id = 'copias')),
  ('Limpieza automática (pg_cron, se activa a mano)',
   (select count(*) > 0 from pg_extension where extname = 'pg_cron')),
  ('Webhook de Stripe (activar_suscripcion_por_usuario)',
   (select count(*) > 0 from pg_proc where proname = 'activar_suscripcion_por_usuario')),
  ('Mandatos SEPA firmados por el hermano',
   (select to_regclass('public.mandatos_sepa') is not null))
) as t(que, esta)
order by esta, que;
`

export async function generar() {
  const trozos = [CABECERA]
  for (const [fichero, queHace] of PIEZAS_ACTUALIZACION) {
    const cuerpo = await readFile(join(raiz, 'supabase', fichero), 'utf8')
    trozos.push(
      `\n-- =============================================================================\n` +
      `--   ${fichero.toUpperCase()} — ${queHace}\n` +
      `-- =============================================================================\n\n` +
      cuerpo.trimEnd() + '\n',
    )
  }
  trozos.push(INFORME)
  return trozos.join('')
}

const destino = join(raiz, 'supabase', 'ACTUALIZAR.sql')

// Solo escribe si se llama a mano; `npm test` importa `generar` y compara.
if (process.argv[1] && process.argv[1].endsWith('generar-actualizar.mjs')) {
  const texto = await generar()
  await writeFile(destino, texto)
  console.log(`ACTUALIZAR.sql regenerado: ${PIEZAS_ACTUALIZACION.length} ficheros, ${texto.split('\n').length} líneas.`)
}
