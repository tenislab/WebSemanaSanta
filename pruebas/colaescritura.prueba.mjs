/**
 * LA COLA DE ESCRITURA SIN CONEXIÓN: el Viernes Santo.
 *
 * ============================================================================
 * QUÉ SE PERDÍA
 * ============================================================================
 *
 * La madrugada del Viernes Santo, el diputado de tramo pasa lista en la calle
 * sin cobertura: marca quién ha llegado, entrega papeletas y cobra en mano.
 * Tres horas que no se pueden rehacer. Y se perdían por los dos caminos:
 *
 *   · `guardarPlantilla` (la hoja de asistencia) hacía `catch { return false }`
 *     y quien la llama usa `void`: el valor devuelto se tiraba.
 *   · `sincronizar` (las papeletas) avisaba pero no reintentaba, y al recargar
 *     la lectura de la base pisaba el espejo con lo de antes de la madrugada.
 *
 * ============================================================================
 * POR QUÉ SE PRUEBA ASÍ
 * ============================================================================
 *
 * Con red de verdad no se puede provocar un corte cuando uno quiere, así que la
 * escritura se INYECTA: `reproducir(cola, escribir)` recibe de fuera la función
 * que escribe, y aquí se le dan las respuestas que da la vida —«Load failed» de
 * Safari, un rechazo de RLS, una clave duplicada—. Eso permite comprobar la
 * decisión que de verdad importa: QUÉ se reintenta y qué no.
 */
export default async function ({ cargar, caso }) {
  const c = await cargar('src/lib/colaEscritura.ts')

  const ahora = new Date(2027, 3, 2, 3, 40) // la madrugada, 3:40
  let n = 0
  const id = () => `e${(n += 1)}`
  const H1 = 'aaaa-1111'
  const H2 = 'bbbb-2222'
  const fila = (op, filaId, tabla = 'papeletas') => ({ clase: 'fila', tabla, op, filaId, fila: { id: filaId } })
  const bloque = (cual, valor) => ({ clase: 'bloque', cual, valor })

  // ---------------------------------------------------------------------
  // 1. LO QUE SE APUNTA, Y CÓMO
  // ---------------------------------------------------------------------
  const soloBloques = c.anadir([], [
    bloque('asistencia', { 'h1': 'asiste' }),
    bloque('asistencia', { 'h1': 'asiste', 'h2': 'asiste' }),
    bloque('asistencia', { 'h1': 'asiste', 'h2': 'asiste', 'h3': 'no_asiste' }),
  ], ahora, id, H1)
  caso('de un bloque se guarda UNO, el último', 1, soloBloques.cola.length)
  caso('y es el último de verdad, no el primero',
    3, Object.keys(soloBloques.cola[0].valor).length)

  const conFilas = c.anadir([], [fila('guardar', 'p1'), fila('guardar', 'p1'), fila('crear', 'm1', 'movimientos')], ahora, id, H1)
  caso('las filas NO se resumen: el orden importa', 3, conFilas.cola.length)
  caso('y van en fila india', ['guardar', 'guardar', 'crear'], conFilas.cola.map((p) => p.op))
  caso('cada entrada sabe cuándo se intentó', ahora.toISOString(), conFilas.cola[0].cuando)

  // Un bloque y filas conviven: el bloque se sustituye, las filas no se tocan.
  const mezcla = c.anadir(conFilas.cola, [bloque('asistencia', { h1: 'asiste' })], ahora, id, H1)
  const mezcla2 = c.anadir(mezcla.cola, [bloque('asistencia', { h1: 'asiste', h2: 'asiste' })], ahora, id, H1)
  caso('al sustituir el bloque, las filas se quedan', 3,
    mezcla2.cola.filter((p) => p.clase === 'fila').length)
  caso('y el bloque sigue siendo uno', 1, mezcla2.cola.filter((p) => p.clase === 'bloque').length)

  // ---------------------------------------------------------------------
  // 2. EL TOPE. `localStorage` son cinco megas para TODO, y una cola sin
  //    tope llena el sitio y se pierde más de lo que se salva.
  // ---------------------------------------------------------------------
  const muchas = Array.from({ length: c.TOPE_DE_FILAS + 20 }, (_, i) => fila('guardar', `p${i}`))
  const llena = c.anadir([], muchas, ahora, id, H1)
  caso('la cola tiene tope', c.TOPE_DE_FILAS, llena.cola.filter((p) => p.clase === 'fila').length)
  caso('y se tira lo MÁS ANTIGUO, no lo más nuevo', 'p20', llena.cola[0].filaId)
  caso('lo tirado se devuelve, para poder avisar', 20, llena.tiradas.length)
  // El bloque no cuenta para el tope: es uno y no crece.
  const llenaConBloque = c.anadir(llena.cola, [bloque('asistencia', { h1: 'asiste' })], ahora, id, H1)
  caso('el bloque no lo tira el tope de las filas', 1,
    llenaConBloque.cola.filter((p) => p.clase === 'bloque').length)

  // ---------------------------------------------------------------------
  // 3. LA DECISIÓN DELICADA: red contra rechazo.
  //    Una cola que reintenta cualquier fallo es un bucle.
  // ---------------------------------------------------------------------
  const deRed = [
    'TypeError: Failed to fetch',
    'Load failed',                                  // Safari, el del móvil del diputado
    'NetworkError when attempting to fetch resource.',
    'net::ERR_INTERNET_DISCONNECTED',
    'FetchError: request to https://x.supabase.co failed, reason: ETIMEDOUT',
    'sin conexión',
  ]
  for (const m of deRed) caso(`«${m.slice(0, 34)}» es falta de red`, true, c.esFalloDeRed(m))

  const rechazos = [
    'new row violates row-level security policy for table "papeletas"',
    'permission denied for table movimientos',
    'column "detalle" of relation "cultos" does not exist',
    'invalid input syntax for type uuid: "x"',
  ]
  for (const m of rechazos) {
    caso(`«${m.slice(0, 34)}» NO es falta de red`, false, c.esFalloDeRed(m))
    caso(`y es definitivo`, true, c.esRechazoDefinitivo(m))
  }
  caso('un fallo de red no es definitivo', false, c.esRechazoDefinitivo('Load failed'))
  caso('y un código de Postgres sí', true, c.esRechazoDefinitivo('lo que sea', '42501'))

  // La clave duplicada es el caso curioso: quiere decir que YA ENTRÓ.
  caso('la clave duplicada es «ya estaba»', true, c.yaEstaba('duplicate key value violates unique constraint', '23505'))
  caso('y no se cuenta como rechazo que tirar', true, c.yaEstaba('...', '23505'))

  // ---------------------------------------------------------------------
  // 4. REPRODUCIR: lo que pasa de verdad al volver (o no) la conexión
  // ---------------------------------------------------------------------
  const cola = c.anadir([], [
    bloque('asistencia', { h1: 'asiste', h2: 'asiste' }),
    fila('guardar', 'p1'),
    fila('crear', 'm1', 'movimientos'),
  ], ahora, id, H1).cola

  // a) Vuelve la conexión y todo entra.
  const intentadas = []
  const todoBien = await c.reproducir(cola, async (e) => { intentadas.push(e.id); return null })
  caso('con conexión entra todo', 3, todoBien.hechas.length)
  caso('y no queda nada esperando', 0, todoBien.sigue.length)
  // Y en el orden en que se apuntó, que es el de la cola. (La primera versión
  // de esto comparaba la inicial de cada id contra ['e','e','e'], o sea nada.)
  caso('en el orden en que se apuntó', cola.map((p) => p.id), intentadas)

  // b) SIGUE SIN HABER RED: se para en la primera y no machaca la batería
  //    mandando cien peticiones que van a fallar igual.
  let cuantasSeIntentaron = 0
  const sinRed = await c.reproducir(cola, async () => {
    cuantasSeIntentaron += 1
    return { message: 'Load failed' }
  })
  caso('sin red se intenta UNA, no las tres', 1, cuantasSeIntentaron)
  caso('y las tres siguen esperando', 3, sinRed.sigue.length)
  caso('sin perder ninguna', 0, sinRed.hechas.length)
  caso('y se apunta que se ha intentado', 1, sinRed.sigue[0].intentos)

  // c) La red vuelve a medias: entra la primera y la segunda se corta.
  let i = 0
  const aMedias = await c.reproducir(cola, async () => (i++ === 0 ? null : { message: 'Failed to fetch' }))
  caso('lo que entró, entró', 1, aMedias.hechas.length)
  caso('y lo que no, se queda en orden', ['p1', 'm1'], aMedias.sigue.map((p) => p.filaId))

  // d) UN RECHAZO DE LA BASE NO PARA LA COLA: se tira ese y sigue lo demás,
  //    que puede entrar perfectamente. Y se avisa, no se calla.
  const conRechazo = await c.reproducir(cola, async (e) => (
    e.clase === 'fila' && e.op === 'guardar'
      ? { message: 'new row violates row-level security policy for table "papeletas"', code: '42501' }
      : null
  ))
  caso('un rechazo no para la cola', 2, conRechazo.hechas.length)
  caso('el rechazado se tira', 1, conRechazo.tiradas.length)
  caso('con su motivo, para poder decirlo', true, /row-level security/.test(conRechazo.tiradas[0].motivo))
  caso('y no se queda dando vueltas para siempre', 0, conRechazo.sigue.length)

  // e) Reintentar un `crear` que ya había entrado no duplica nada.
  const yaEntro = await c.reproducir([cola[1]], async () => ({
    message: 'duplicate key value violates unique constraint "papeletas_pkey"', code: '23505',
  }))
  caso('reintentar algo que ya estaba cuenta como hecho', 1, yaEntro.hechas.length)
  caso('y no se queda en la cola', 0, yaEntro.sigue.length)
  caso('ni se cuenta como fallo', 0, yaEntro.tiradas.length)

  // ---------------------------------------------------------------------
  // 5. QUÉ SE LE DICE A LA PERSONA. Un bloque NO es «1 cambio»: la hoja de
  //    asistencia de una noche es una entrada y trescientas marcas.
  // ---------------------------------------------------------------------
  caso('sin nada pendiente no se dice nada', '', c.resumen([]))
  const texto = c.resumen(cola)
  caso('el aviso cuenta las filas', true, /2 cambios/.test(texto))
  caso('y nombra el bloque por lo que es', true, /pase de lista del cortejo/.test(texto))
  caso('y NO dice «3 cambios», que engañaría', false, /3 cambios/.test(texto))
  caso('y dice desde cuándo', true, /desde las 03:40/.test(texto))
  const soloUna = c.resumen([cola[1]])
  caso('en singular cuando es una', true, /^1 cambio sin guardar/.test(soloUna))

  // ---------------------------------------------------------------------
  // 6. EL CABLE. Todo lo de arriba puede estar perfecto y no servir de nada.
  // ---------------------------------------------------------------------
  const { readFile } = await import('node:fs/promises')

  const plantillas = await readFile('src/lib/plantillasHermandad.ts', 'utf8')
  caso('guardarPlantilla encola cuando no hay red', true,
    /encolarSiEsDeRed\([^)]*\[\{ clase: 'bloque', cual, valor \}\]\)/.test(plantillas))
  caso('y ya no se traga el fallo en silencio', false,
    /\} catch \{\n    return false\n  \}/.test(plantillas))
  /*
   * EL GUARDIA QUE SALVA LA MADRUGADA. Sin esto la cola no sirve de nada: al
   * arrancar, `cargarAsistenciaDeLaBase` baja la hoja de ANTES de la madrugada
   * y la escribe encima de la buena. La noche entera, borrada por su propia
   * copia de seguridad.
   */
  caso('traerPlantilla no pisa lo que está en la cola', true,
    /if \(bloquePendiente\(cual\)\) return null/.test(plantillas))

  const sync = await readFile('src/lib/supabaseSync.ts', 'utf8')
  caso('sincronizar encola los borrados que fallan por red', true,
    /paraLaCola\.push\(\{ clase: 'fila', tabla, op: 'borrar'/.test(sync))
  caso('los altas también', true, /paraLaCola\.push\(\{ clase: 'fila', tabla, op: 'crear'/.test(sync))
  caso('y las modificaciones', true, /paraLaCola\.push\(\{ clase: 'fila', tabla, op: 'guardar'/.test(sync))
  caso('y se manda a la cola de verdad', true, /if \(paraLaCola\.length > 0\) encolar\(paraLaCola\)/.test(sync))
  /*
   * Y EL CASO QUE MÁS IMPORTA: `fetch` LANZA cuando no hay red, así que el
   * `try` se rompe en la PRIMERA escritura y las de detrás no se intentan.
   * Encolar solo la que falló dejaría fuera todo lo demás del guardado.
   */
  caso('un corte de red encola TODO lo del guardado, no solo lo que falló', true,
    /sumar\('borrar', eliminados\)[\s\S]{0,120}sumar\('crear', nuevos\)[\s\S]{0,120}sumar\('guardar', posiblesCambios\)/.test(sync))
  caso('y solo si de verdad era de red', true, /if \(esFalloDeRed\(String\(err\)\)\) \{/.test(sync))

  const shell = await readFile('src/components/AppShell.tsx', 'utf8')
  caso('el marco engancha los reintentos', true, /montarLaCola\(\)/.test(shell))
  caso('y pinta lo que espera', true, /cola\.cuantas > 0 && \(/.test(shell))
  caso('con su aviso de no cerrar sesión', true, /No cierres la aplicación ni cierres sesión/.test(shell))
  // El aviso de la cola NO es el de error: son dos cosas distintas y meterlas
  // juntas haría creer que se ha perdido la noche justo cuando no.
  caso('la banda de la cola no es la de los fallos', true, /role="status"/.test(shell))

  const montar = await readFile('src/lib/montarLaCola.ts', 'utf8')
  caso('se intenta al volver la conexión', true, /addEventListener\('online', intentar\)/.test(montar))
  caso('y al volver a la pestaña, que es cuando online no salta', true,
    /visibilitychange/.test(montar))
  caso('y al arrancar', true, /setTimeout\(intentar/.test(montar))

  // ---------------------------------------------------------------------
  // 7. DOS HERMANDADES EN EL MISMO ORDENADOR
  //
  //    La cola SOBREVIVE al cierre de sesión a propósito: si no, cerrar sesión
  //    se llevaría la madrugada del Viernes Santo por la otra puerta —
  //    `ajustarEspejoALaHermandad` borra todo lo que empieza por `cabildo-`—,
  //    que es el mismo fallo entrando por otro lado.
  //
  //    Y eso solo es seguro si cada entrada sabe de quién es: en el ordenador
  //    de la casa de hermandad entra gente distinta, y una cuenta puede llevar
  //    dos hermandades. Soltar la cola bajo la sesión equivocada sería escribir
  //    los datos de una en la otra.
  // ---------------------------------------------------------------------
  const deLaUna = c.anadir([], [bloque('asistencia', { h1: 'asiste' }), fila('guardar', 'p1')], ahora, id, H1).cola
  const deLasDos = c.anadir(deLaUna, [bloque('asistencia', { z9: 'asiste' }), fila('guardar', 'z9')], ahora, id, H2).cola
  caso('cada entrada sabe de qué hermandad es', [H1, H1, H2, H2], deLasDos.map((p) => p.hermandadId))
  caso('la hoja de una NO sustituye a la de la otra', 2,
    deLasDos.filter((p) => p.clase === 'bloque').length)

  const reparto = c.loDeEstaHermandad(deLasDos, H1)
  caso('se manda solo lo de la hermandad de la sesión', [H1, H1], reparto.mias.map((p) => p.hermandadId))
  caso('y lo de la otra se queda, sin perderse', [H2, H2], reparto.deOtros.map((p) => p.hermandadId))
  const sinSesion = c.loDeEstaHermandad(deLasDos, null)
  caso('sin sesión no se manda nada de nadie', 0, sinSesion.mias.length)
  caso('y no se pierde nada', 4, sinSesion.deOtros.length)
  // Lo apuntado sin saber de quién era tampoco se manda solo.
  const huerfana = c.anadir([], [fila('guardar', 'x1')], ahora, id, null).cola
  caso('lo apuntado sin hermandad no se manda', 0, c.loDeEstaHermandad(huerfana, H1).mias.length)
  caso('pero se conserva', 1, c.loDeEstaHermandad(huerfana, H1).deOtros.length)

  /*
   * Y `soltarLaCola` DE VERDAD, no su fuente.
   *
   * Es la capa que toca `localStorage`, y aquí se puede ejecutar porque el
   * runner trae un `localStorage` de mentira (ver `correr.mjs`). Hace falta
   * probarla: con `loDeEstaHermandad` perfecta, `soltarLaCola` podía pasarle la
   * cola entera y la comprobación de arriba seguía en verde. Medido —se rompió
   * a propósito y no saltaba nada—.
   */
  const enLaCola = (cola) => localStorage.setItem(c.CLAVE_COLA, JSON.stringify(cola))
  enLaCola(deLasDos)
  const intentadasAhora = []
  const soltada = await c.soltarLaCola(async (e) => { intentadasAhora.push(e.hermandadId); return null }, H1)
  caso('soltarLaCola intenta SOLO lo de esa hermandad', [H1, H1], intentadasAhora)
  caso('y da por hechas las dos', 2, soltada.hechas.length)
  caso('lo de la otra sigue guardado', 2, c.leerCola().length)
  caso('y sigue siendo de la otra', [H2, H2], c.leerCola().map((p) => p.hermandadId))

  // Sin sesión no se intenta nada y no se pierde nada.
  enLaCola(deLasDos)
  let seIntentoAlgo = false
  await c.soltarLaCola(async () => { seIntentoAlgo = true; return null }, null)
  caso('sin sesión no se intenta nada', false, seIntentoAlgo)
  caso('y la cola se queda entera', 4, c.leerCola().length)

  // Lo que la base rechaza se tira de la cola, y lo de la otra hermandad no se
  // ve afectado.
  enLaCola(deLasDos)
  await c.soltarLaCola(async () => ({ message: 'permission denied for table papeletas', code: '42501' }), H1)
  caso('lo rechazado sale de la cola', 2, c.leerCola().length)
  caso('y lo que sale es lo rechazado, no lo de la otra', [H2, H2], c.leerCola().map((p) => p.hermandadId))
  localStorage.removeItem(c.CLAVE_COLA)
  caso('con la cola vacía no hay nada pendiente', false, c.hayPendientes())

  // Y EL CABLE de las dos mitades de esto.
  const multi = await readFile('src/lib/multiHermandad.ts', 'utf8')
  const lista = multi.slice(multi.indexOf('NO_ES_DE_LA_HERMANDAD = new Set('), multi.indexOf('])', multi.indexOf('NO_ES_DE_LA_HERMANDAD = new Set(')))
  caso('cerrar sesión NO se lleva la cola', true, /'cabildo-cola-escritura'/.test(lista))
  caso('y la clave es la misma que usa la cola', 'cabildo-cola-escritura', c.CLAVE_COLA)
  caso('soltar la cola filtra por hermandad', true,
    /soltarLaCola\(escribirEnLaBase, deQuien\)/.test(montar))
  caso('y sin sesión no se suelta', true, /if \(!deQuien\) return 0/.test(montar))
  caso('el bloque se escribe con la hermandad de la ENTRADA', true,
    /hermandad_id: entrada\.hermandadId/.test(montar))
}
