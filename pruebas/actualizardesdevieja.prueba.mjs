/**
 * ACTUALIZAR DESDE UNA VERSIÓN ANTIGUA DE VERDAD, QUE ES LO QUE HACE TODO EL MUNDO.
 *
 * ============================================================================
 * POR QUÉ EXISTE
 * ============================================================================
 *
 * Todas las demás pruebas montan la base DESDE CERO. En una base nueva no
 * existe la versión vieja, que es lo único que puede chocar — y por eso
 * «cannot change return type of existing function» llegó dos veces a
 * producción con las pruebas en verde. Es la fase 5 del plan de bugs: «la que
 * más daño hace cuando falla, porque falla en producción y a mitad».
 *
 * Aquí se hace lo que hace una hermandad: se instala UN INSTALADOR ANTIGUO
 * REAL —guardado tal cual en `pruebas/esquemas-anteriores/`—, se meten datos,
 * y se pasa por encima el `ACTUALIZAR.sql` de hoy. Dos veces, porque la
 * cabecera promete que se puede.
 *
 * ============================================================================
 * LO QUE SE COMPRUEBA, Y ES MÁS QUE «NO DA ERROR»
 * ============================================================================
 *
 * «Sin error» no es «bien». Lo que de verdad se exige es que la base que
 * resulta de instalar lo viejo y actualizar sea IDÉNTICA a la que resulta de
 * instalar hoy desde cero: mismas tablas, columnas, valores por defecto,
 * políticas, índices, disparadores, funciones y permisos. Es la promesa de
 * `ACTUALIZAR.sql` y nadie la había medido. El día que se midió, no se
 * cumplía: a una base del 29 de agosto le faltaba el `default
 * hermandad_actual()` de `mensajes_web` —el arreglo de «deshacer el borrado
 * de un mensaje falla siempre» solo había llegado a las instalaciones nuevas.
 *
 * Y que los datos siguen ahí. Y que el diagnóstico no tiene nada que decir.
 * Y que la base queda sellada con la versión de hoy.
 *
 * Sin un Postgres a mano, esto se salta y lo dice. No se calla.
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  PUERTO, hayPostgres, sql, baseLimpia, fotoDelCatalogo, diferenciaDeFotos, loQueDijoPostgres,
} from './postgres.mjs'

const CARPETA = 'pruebas/esquemas-anteriores'
const HDAD = 'aaaaaaaa-0000-0000-0000-00000000000a'
const HNO = 'aaaaaaaa-0000-0000-0000-0000000000f1'

/*
 * DATOS DE UNA HERMANDAD QUE FUNCIONA: una hermandad, un hermano, una cuota,
 * un ajuste. Lo mínimo que tiene cualquiera, para ver que actualizar no los
 * toca. Solo columnas que existen en TODOS los instaladores guardados.
 */
const SIEMBRA = `
  insert into hermandades (id, nombre) values ('${HDAD}', 'Hermandad que ya funcionaba') on conflict do nothing;
  insert into hermanos (id, hermandad_id, nombre, dni, numero, estado, email)
  values ('${HNO}', '${HDAD}', 'Fulano de Tal', '79000001A', 12, 'Activo', 'fulano@ejemplo.es') on conflict do nothing;
  insert into cuotas (id, hermano_id, concepto, importe, estado, numero, hermandad_id)
  values (gen_random_uuid(), '${HNO}', 'Cuota anual', 30, 'Pendiente', 1, '${HDAD}');
  insert into hermandad_settings (hermandad_id, nombre_legal) values ('${HDAD}', 'Real Hermandad de Prueba')
  on conflict (hermandad_id) do update set nombre_legal = excluded.nombre_legal;
`
const LO_QUE_HAY = `
  select (select count(*) from hermanos where hermandad_id = '${HDAD}') || '/'
      || (select count(*) from cuotas where hermandad_id = '${HDAD}') || '/'
      || (select nombre_legal from hermandad_settings where hermandad_id = '${HDAD}')
`

export default async function ({ caso }) {
  if (!(await hayPostgres())) {
    const obligatorio = process.env.GOBERGO_PG_OBLIGATORIO === '1'
    caso(
      obligatorio
        ? `NO HAY POSTGRES en el puerto ${PUERTO} y aquí es obligatorio: la actualización se ha quedado sin probar`
        : `SIN POSTGRES: esta prueba NO se ha ejecutado (arranca uno en el puerto ${PUERTO})`,
      true,
      !obligatorio,
    )
    return
  }

  const actualizar = await readFile('supabase/ACTUALIZAR.sql', 'utf8')
  const instaladorDeHoy = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  const diagnostico = await readFile('supabase/DIAGNOSTICO.sql', 'utf8')
  const { version } = JSON.parse(await readFile('supabase/VERSION.json', 'utf8'))

  /*
   * LA FOTO DE REFERENCIA: instalar hoy desde cero. Es contra lo que se
   * compara todo lo demás, y se saca una vez.
   */
  await baseLimpia()
  await sql(instaladorDeHoy)
  const fotoNueva = await fotoDelCatalogo()
  caso('la instalación nueva tiene un catálogo que comparar', true, fotoNueva.split('\n').length > 500)

  /*
   * Y PRIMERO SOBRE ELLA MISMA: actualizar una base que YA está al día no
   * puede cambiarle nada. Es el caso de quien pega ACTUALIZAR.sql dos veces
   * por si acaso, y lo hace todo el mundo.
   */
  await sql(SIEMBRA)
  const antesAlDia = await sql(LO_QUE_HAY)
  await sql(actualizar)
  await sql(actualizar)
  caso('actualizar una base al día no le cambia el catálogo', { soloEnA: [], soloEnB: [] },
    diferenciaDeFotos(await fotoDelCatalogo(), fotoNueva))
  caso('ni le toca los datos', antesAlDia, await sql(LO_QUE_HAY))

  /* --- Y AHORA LOS INSTALADORES ANTIGUOS, UNO POR UNO --- */
  const antiguos = (await readdir(CARPETA)).filter((f) => f.endsWith('.sql')).sort()
  caso('hay instaladores antiguos guardados con los que probar', true, antiguos.length >= 2)

  for (const fichero of antiguos) {
    const nombre = fichero.replace('.sql', '')
    const viejo = await readFile(join(CARPETA, fichero), 'utf8')

    await baseLimpia()
    let paso = 'instalar'
    let fallo = ''
    try {
      await sql(viejo)
      paso = 'sembrar'
      await sql(SIEMBRA)
      paso = 'actualizar'
      await sql(actualizar)
      paso = 'actualizar otra vez'
      await sql(actualizar)
      paso = 'ok'
    } catch (e) {
      fallo = loQueDijoPostgres(e).slice(0, 300)
    }
    caso(`${nombre}: se instala, se actualiza y se vuelve a actualizar sin error`, 'ok',
      paso === 'ok' ? 'ok' : `falla en «${paso}»: ${fallo}`)
    if (paso !== 'ok') continue

    /*
     * LA COMPROBACIÓN QUE IMPORTA: el catálogo es el mismo que instalando hoy.
     * Se enseñan las diferencias línea a línea, porque «distinto» sin decir en
     * qué no se puede arreglar.
     */
    const d = diferenciaDeFotos(await fotoDelCatalogo(), fotoNueva)
    caso(`${nombre}: actualizada queda IGUAL que una instalación nueva`, '',
      [...d.soloEnA.map((l) => `sobra: ${l}`), ...d.soloEnB.map((l) => `falta: ${l}`)].join('\n'))

    // Los datos de antes siguen ahí, tal cual.
    caso(`${nombre}: los datos de la hermandad siguen ahí`, `1/1/Real Hermandad de Prueba`, await sql(LO_QUE_HAY))

    // Y la base queda sellada con la versión de hoy: la aplicación no avisará.
    caso(`${nombre}: queda sellada con la versión de hoy`, String(version),
      await sql("select coalesce((select valor from esquema_gobergo where clave = 'version'), 0)"))

    /*
     * Y EL DIAGNÓSTICO NO TIENE NADA QUE DECIR. Es lo que la hermandad ejecuta
     * cuando algo va mal; si después de actualizar le sale una fila, es que
     * actualizar ha dejado algo a medias.
     */
    caso(`${nombre}: el diagnóstico sale a cero`, '', await sql(diagnostico))
  }
}
