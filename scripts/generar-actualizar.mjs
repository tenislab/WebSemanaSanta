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
import { PIEZAS as PIEZAS_DEL_INSTALADOR, selloDeVersion } from './generar-todo-en-uno.mjs'
import { versionDeHoy } from './version-del-esquema.mjs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * LO QUE SE AÑADIÓ DESPUÉS DE LA INSTALACIÓN, en orden de ejecución.
 *
 * Todos cumplen lo mismo: crean lo suyo, no tocan lo de nadie, y se pueden
 * volver a ejecutar sin que pase nada.
 */
/**
 * ============================================================================
 * ACTUALIZAR LLEVA TODAS LAS PIEZAS DEL INSTALADOR. TODAS.
 * ============================================================================
 *
 * Aquí había una lista propia, más corta: «lo nuevo desde que las primeras
 * hermandades instalaron». Y tenía un agujero que se midió el día que se
 * cerró: las piezas de base también SE EDITAN —se le añadió a
 * `multi-hermandad.sql` el `default hermandad_actual()` de `mensajes_web`, que
 * es lo que arregla «deshacer el borrado de un mensaje falla siempre»— y esas
 * ediciones no viajaban. Una hermandad que instaló el 29 de agosto y pegó
 * `ACTUALIZAR.sql` después seguía con el fallo, con el informe en verde.
 *
 * Así que ahora la lista ES la del instalador, en su mismo orden. Está medido
 * en un Postgres de verdad (`pruebas/actualizardesdevieja.prueba.mjs`): sobre
 * una base nueva, ejecutado dos veces, y sobre dos instaladores antiguos
 * reales, el catálogo que queda es IDÉNTICO al de instalar hoy desde cero —
 * tablas, columnas, valores por defecto, políticas, índices, funciones y sus
 * permisos— y no se toca una fila de datos.
 *
 * Y las dos razones por las que antes se dejaba algo fuera ya no valen:
 *
 *   · `permisos-por-hermandad.sql` redefine `modulo_permitido()` y
 *     `hermano-con-cargo.sql` la vuelve a definir después. Con las dos en la
 *     lista y en el orden del instalador, manda la última, igual que al
 *     instalar. Es justo lo que comprueba `sql-actualizar.prueba.mjs`.
 *   · `tareas-programadas.sql` necesita `pg_cron` y no está en el instalador
 *     tampoco: va suelto, y así sigue.
 *
 * Se exporta con el nombre de siempre para que quien lo importa no cambie.
 */
export const PIEZAS_ACTUALIZACION = PIEZAS_DEL_INSTALADOR

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
-- QUÉ LLEVA, EN ORDEN
-- -----------------------------------------------------------------------------
--
${PIEZAS_ACTUALIZACION.map(([f, q], i) => `--   ${i + 1}. ${f.padEnd(30)} ${q}`).join('\n')}
--
-- -----------------------------------------------------------------------------
-- POR QUÉ ES TAN LARGO: LLEVA TODAS LAS PIEZAS
-- -----------------------------------------------------------------------------
--
-- Lleva las mismas piezas que \`TODO-EN-UNO.sql\`, en el mismo orden. No es un
-- descuido: una versión más corta —«solo lo nuevo»— dejaba fuera los arreglos
-- que se hacen DENTRO de piezas antiguas, y una base actualizada así quedaba
-- distinta de una recién instalada sin que nadie lo supiera. Está comprobado
-- en un Postgres de verdad que, sobre una base antigua, esto la deja IGUAL que
-- instalar hoy desde cero, y que no toca ni una fila de datos.
--
-- Lo único que no lleva es \`tareas-programadas.sql\`, que tampoco está en el
-- instalador: necesita la extensión \`pg_cron\` activada a mano, en
-- Database → Extensions → pg_cron, y se ejecuta aparte. Sin él todo funciona;
-- lo único que no pasa solo es la limpieza de visitas viejas y de
-- suscriptores sin confirmar.
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
   (select to_regclass('public.mandatos_sepa') is not null)),
  ('Encargos de redes repartidos a la junta',
   (select to_regclass('public.tareas_redes') is not null)),
  ('La tienda (productos, ventas y stock)',
   (select to_regclass('public.ventas') is not null)),
  ('La venta registra sola sus asientos',
   (select count(*) > 0 from pg_proc where proname = 'registrar_venta')),
  ('Reservas de la tienda por internet',
   (select to_regclass('public.reservas_tienda') is not null)),
  ('Reservar sin cuenta, desde la web pública',
   (select count(*) > 0 from pg_proc where proname = 'crear_reserva_web')),
  ('Campañas de recaudación y proyectos',
   (select to_regclass('public.campanas_recaudacion') is not null)),
  /*
   * El módulo nuevo, mirando SOLO las hermandades que tienen permisos
   * sembrados, por lo mismo que se explica arriba con «eventos» y «web»: a una
   * hermandad sin ninguna fila en «permisos_cargo» no se le inventan cargos, y
   * meterla en esta cuenta haría que el informe dijera «no» después de haber
   * hecho su trabajo bien.
   */
  ('Permiso de «campañas» al Hermano Mayor',
   (select count(*) = 0 from hermandades h
     where exists (select 1 from permisos_cargo pc where pc.hermandad_id = h.id)
       and not exists (
      select 1 from permisos_cargo pc
       where pc.hermandad_id = h.id and pc.cargo = 'Hermano Mayor' and pc.modulo_id = 'campanas'))),
  ('Gastos porcentuales para pérdidas y ganancias',
   (select to_regclass('public.reglas_reparto') is not null)),
  ('Pago con tarjeta del hermano',
   (select to_regclass('public.pagos_tarjeta') is not null)),
  -- Las cinco de crecer sin romper nada. Ver el bloque de piezas del generador.
  ('Los fallos se apuntan solos (vigilancia)',
   (select to_regclass('public.errores_cliente') is not null)),
  ('Novedades por canal (despliegue por fases)',
   (select to_regclass('public.novedades') is not null)),
  ('Se puede volcar una copia en la base',
   (select count(*) > 0 from pg_proc where proname = 'vaciar_hermandad_para_restaurar')),
  ('Acceso de soporte (nace apagado: sin cuentas dadas de alta)',
   (select count(*) > 0 from pg_proc where proname = 'soporte_entrar')),
  ('La base dice por qué versión va',
   (select to_regclass('public.esquema_gobergo') is not null))
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
  /*
   * EL SELLO ANTES DEL INFORME, y no al revés: el informe tiene que ser la
   * ÚLTIMA consulta del archivo porque en el editor de Supabase solo se ve el
   * resultado de la última, y ese informe es lo único que distingue «se ha
   * hecho todo» de «se ha hecho la mitad». Hay una prueba que lo exige.
   *
   * Se sella con LA MISMA versión que el instalador —la de `VERSION.json`—:
   * una base que acaba de pasar por aquí queda igual de completa que una recién
   * instalada, y por tanto tiene que decir el mismo número. Si dijera otro, la
   * aplicación avisaría para siempre de que la base va atrasada justo después
   * de actualizarla.
   */
  const { version } = await versionDeHoy(PIEZAS_DEL_INSTALADOR, { escribir: false })
  trozos.push(selloDeVersion(version))
  trozos.push(INFORME)
  return trozos.join('')
}

const destino = join(raiz, 'supabase', 'ACTUALIZAR.sql')

// Solo escribe si se llama a mano; `npm test` importa `generar` y compara.
if (process.argv[1] && process.argv[1].endsWith('generar-actualizar.mjs')) {
  // Primero la versión (y escribirla si ha subido), y después el fichero con ella.
  await versionDeHoy(PIEZAS_DEL_INSTALADOR)
  const texto = await generar()
  await writeFile(destino, texto)
  console.log(`ACTUALIZAR.sql regenerado: ${PIEZAS_ACTUALIZACION.length} ficheros, ${texto.split('\n').length} líneas.`)
}
