/**
 * QUE EL NUMERITO DEL MENÚ CUENTE LO QUE ENSEÑA LA PANTALLA.
 *
 * ============================================================================
 * EL PROBLEMA QUE ESTO VIGILA
 * ============================================================================
 *
 * Hay DOS sitios que saben qué cosas esperan respuesta:
 *
 *   · `avisosPendientes()` en `src/lib/notificaciones.ts`, que hace la lista de
 *     la pantalla.
 *   · `avisos_que_esperan()` en `supabase/contador-de-avisos.sql`, que hace el
 *     número del menú.
 *
 * Dos implementaciones de la misma idea, y eso siempre acaba igual: alguien
 * añade un tipo de aviso nuevo, lo pone en la pantalla, y el numerito no lo
 * cuenta. El resultado es peor que no tener numerito, porque el numerito dice
 * «0» y la gente se fía: deja de entrar a mirar y la cosa se queda esperando.
 *
 * No se puede evitar teniendo una sola implementación —el número TIENE que
 * salir de la base, o habría que cargar cinco tablas en todas las pantallas—
 * así que se evita mecánicamente: cada tipo de aviso está contado en el SQL o
 * está en la lista de excepciones, con su motivo escrito. No hay tercera
 * opción, y añadir un tipo obliga a elegir.
 */
export default async function ({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')
  const m = await cargar('src/lib/notificaciones.ts')
  const sql = await readFile('supabase/contador-de-avisos.sql', 'utf8')

  /*
   * LOS TIPOS QUE EXISTEN, sacados del código y no escritos aquí a mano: una
   * lista a mano se queda vieja el día que se añade un tipo, o sea el día en
   * que esta prueba tendría que saltar.
   */
  const src = await readFile('src/lib/notificaciones.ts', 'utf8')
  const nombres = (src.match(/const NOMBRES: Record<TipoAviso, string> = \{([\s\S]*?)\n  \}/) ?? ['', ''])[1]
  const tipos = [...nombres.matchAll(/^\s{4}(\w+):/gm)].map((x) => x[1])
  caso('se leen los tipos de aviso del código', true, tipos.length >= 7)

  /*
   * DE QUÉ TABLA SALE CADA UNO. Es lo único escrito a mano aquí, y no se puede
   * evitar: es precisamente la correspondencia que hay que comprobar.
   */
  const DE_DONDE = {
    altaHermano: 'solicitudes_alta',
    bajaPedida: 'hermanos',
    mensajeWeb: 'mensajes_web',
    pagoCuota: 'cuotas',
    pagoPapeleta: 'papeletas',
    peticionPapeleta: 'solicitudes_papeleta',
  }

  const sinDecidir = tipos.filter((t) => {
    if (m.NO_CUENTAN_EN_EL_MENU[t]) return false          // decidido: fuera, con motivo
    const tabla = DE_DONDE[t]
    if (!tabla) return true                               // tipo nuevo que nadie ha situado
    return !new RegExp(`from ${tabla}\\b`).test(sql)      // decidido: dentro, y contado
  })
  caso('cada tipo de aviso está contado en el menú o excluido a propósito', [], sinDecidir)
  if (sinDecidir.length > 0) {
    console.log('    → añádelo a `avisos_que_esperan()` o a NO_CUENTAN_EN_EL_MENU con su motivo')
  }

  /*
   * Y LAS EXCEPCIONES LLEVAN MOTIVO. Una lista de excepciones sin motivos es
   * una forma educada de apagar la prueba: al siguiente que le estorbe, mete
   * otro tipo y ya está.
   */
  caso('y las excepciones dicen por qué', [],
    Object.entries(m.NO_CUENTAN_EN_EL_MENU)
      .filter(([, motivo]) => !motivo || motivo.length < 20)
      .map(([t]) => t))

  /*
   * «Hermanos sin cuota» es la única excepción de hoy, y es la correcta: no es
   * algo que HAYA LLEGADO, es un estado de la hermandad. No hay nadie
   * esperando, no se resuelve contestando, y estaría en el contador todo el año
   * hasta emitir las cuotas. Un numerito que no baja nunca se deja de mirar, y
   * con él se dejan de mirar los que sí importaban.
   */
  caso('los hermanos sin cuota no cuentan en el menú', true,
    !!m.NO_CUENTAN_EN_EL_MENU.sinCuota)

  // --- TODAS LAS CUENTAS VAN ACOTADAS A LA HERMANDAD ---
  /*
   * `avisos_que_esperan()` es `security definer`, o sea que SE SALTA RLS. Si
   * una de las cuentas se dejara el `hermandad_id`, el numerito sumaría lo de
   * todas las hermandades del proyecto. No daría error: daría un número más
   * grande, que es la clase de fallo que nadie mira dos veces.
   */
  /*
   * Se trocea por «select count(*) from», no con una expresión que intente
   * casar el paréntesis de cierre: el primer `)` que aparece después es el de
   * `hermandad_actual()`, así que una expresión perezosa corta el trozo justo
   * antes de lo que hay que comprobar y da que TODAS están mal. Me pasó.
   */
  const trozos = sql.split('select count(*) from').slice(1)
  /*
   * SIETE. Eran seis; la séptima son los comunicados programados a los que ya
   * les tocaba salir, y es distinta de las otras: no hay nadie esperando
   * respuesta. Cuenta porque un comunicado programado NO sale hasta que alguien
   * abre Comunicados —para saber a quién va hace falta el censo, que solo está
   * cargado allí— así que el numerito es lo que hace que alguien entre.
   *
   * El número está escrito a mano a propósito: cambiarlo obliga a venir aquí y
   * a decidir si la cuenta nueva de verdad tiene que estar en el menú, en vez
   * de que se cuele una que no baja nunca.
   */
  caso('cuenta siete cosas', 7, trozos.length)
  caso('y las siete van acotadas a la hermandad', [],
    trozos.filter((t) => !/hermandad_id = hermandad_actual\(\)/.test(t))
      .map((t) => t.trim().split(/\s/)[0]))

  /*
   * Y LA SÉPTIMA BAJA SOLA EN CUANTO SALE. Es la condición de todo contador:
   * el que no baja se deja de mirar, y con él se dejan de mirar los que sí
   * importaban. Al mandarse, el comunicado pasa a «Enviado» y deja de contar.
   */
  caso('el comunicado programado deja de contar al salir', true,
    /from comunicados[\s\S]{0,200}?estado = 'Programado'/.test(sql))
  // Y solo cuentan los VENCIDOS: uno programado para dentro de un mes no es
  // nada pendiente, es un plan.
  caso('y solo cuentan los que ya tocaban', true,
    /fecha_programada <= to_char\(current_date/.test(sql))

  /*
   * LA BAJA MIRA LAS DOS COLUMNAS. `baja_solicitada` es «lo ha pedido» y
   * `estado = 'Baja'` es «se ha tramitado»: sin la segunda, el número no
   * bajaría nunca al tramitarla y el menú se quedaría con un aviso fijo.
   */
  caso('la baja deja de contar al tramitarla', true,
    /baja_solicitada and estado <> 'Baja'/.test(sql))

  // --- Y NO LANZA NUNCA ---
  /*
   * Una base atrasada no tiene esta función, y la llamada da 404. Si eso
   * lanzara, un adorno del menú dejaría a la hermandad sin poder entrar.
   */
  caso('sin base de datos el contador es cero', 0, await m.contarAvisosQueEsperan())

  // --- Y EL NUMERITO ESTÁ EN EL MENÚ, no solo contado ---
  const shell = await readFile('src/components/AppShell.tsx', 'utf8')
  caso('el menú lo pinta', true, /app-nav__cuantos/.test(shell))
  caso('solo en Notificaciones', true, /item\.to === '\/app\/notificaciones' && avisosEsperando > 0/.test(shell))
  // Con cero no se pinta nada: un «0» permanente es ruido, no información.
  caso('y con cero no sale nada', true, /avisosEsperando > 0 &&/.test(shell))
  /*
   * Se vuelve a preguntar al entrar y al salir de Notificaciones, que es donde
   * se resuelven: si no, el número se quedaría clavado después de atenderlos.
   */
  caso('se actualiza al pasar por Notificaciones', true,
    /\}, \[enNotificaciones\]\)/.test(shell))
  // Un «3» suelto no dice nada a quien navega con lector de pantalla.
  caso('y se dice en palabras para quien no lo ve', true, /cosas esperan/.test(shell))

  const css = await readFile('src/styles/global.css', 'utf8')
  caso('y tiene estilo', true, /\.app-nav__cuantos \{/.test(css))
}
