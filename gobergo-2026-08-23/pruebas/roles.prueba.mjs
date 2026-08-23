/** P6: los roles que salen solos de la papeleta. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/rolesPapeleta.ts')

  const tramos = [
    { id: 't1', etiqueta: 'Costalero' },
    { id: 't2', etiqueta: 'Acólito' },
    { id: 't3' },                        // un tramo de cirio: no da rol
    { id: 't4', etiqueta: '   ' },       // espacios: tampoco
  ]
  /*
   * Los roles salen SOLO de los tramos.
   *
   * Hubo una lista de «papeletas personalizadas» que también daba roles, y ya
   * no existe: lo que camina es un tramo, y el rol se define ahí. La papeleta
   * simbólica no da ninguno, y es lo suyo — quien no sale no es costalero de
   * este año.
   */
  const p = (o) => ({ hermanoId: 'h1', anio: 2027, estado: 'Asignada', tramoId: null, opcion: null, ...o })
  const auto = (papeletas, id = 'h1', anio = 2027) => m.etiquetasAutomaticas(id, papeletas, tramos, anio)

  // --- Lo básico ---
  caso('sin papeletas, ningún rol', 0, auto([]).length)
  caso('el tramo da su rol', 'Costalero', auto([p({ tramoId: 't1' })])[0])
  caso('un tramo sin rol no da nada', 0, auto([p({ tramoId: 't3' })]).length)
  caso('un rol en blanco tampoco', 0, auto([p({ tramoId: 't4' })]).length)
  caso('la simbólica no da ningún rol', 0, auto([p({ opcion: 'Papeleta simbólica' })]).length)

  // --- Qué estados cuentan ---
  // Una solicitud todavía no es un sitio: no da rol hasta que se asigna.
  caso('«Solicitada» no da rol todavía', 0, auto([p({ tramoId: 't1', estado: 'Solicitada' })]).length)
  caso('«Asignada» sí', 1, auto([p({ tramoId: 't1', estado: 'Asignada' })]).length)
  caso('«Pagada» sí', 1, auto([p({ tramoId: 't1', estado: 'Pagada' })]).length)
  caso('«Entregada» sí', 1, auto([p({ tramoId: 't1', estado: 'Entregada' })]).length)
  // Y al anular o renunciar, el rol desaparece solo. Esto es lo que no se podía
  // garantizar guardando la etiqueta en el hermano.
  caso('«Anulada» quita el rol', 0, auto([p({ tramoId: 't1', estado: 'Anulada' })]).length)
  caso('«Renuncia» también', 0, auto([p({ tramoId: 't1', estado: 'Renuncia' })]).length)

  // --- El año importa ---
  // Ser costalero en 2024 no te hace costalero en 2027.
  caso('una papeleta de otro año no cuenta', 0, auto([p({ tramoId: 't1', anio: 2024 })]).length)
  caso('solo cuenta el año pedido', 1, auto([p({ tramoId: 't1', anio: 2024 })], 'h1', 2024).length)

  // --- De otro hermano, no ---
  caso('la papeleta de otro no da rol', 0, auto([p({ tramoId: 't1', hermanoId: 'h9' })]).length)

  // --- Varios roles y sin repetir ---
  const dos = auto([p({ tramoId: 't1' }), p({ tramoId: 't2' })])
  caso('dos papeletas, dos roles', 2, dos.length)
  caso('y en orden', 'Acólito,Costalero', dos.join(','))
  caso('el mismo rol dos veces no se repite', 1, auto([p({ tramoId: 't1' }), p({ tramoId: 't1' })]).length)
  // El nombre de la papeleta no aporta rol por su cuenta: solo el tramo.
  caso('el nombre de la papeleta no añade rol', 1, auto([p({ tramoId: 't1', opcion: 'Mantilla' })]).length)

  // --- Mezclar con las puestas a mano ---
  caso('se juntan sin repetir', 'Banda,Costalero',
    m.etiquetasDe({ etiquetas: ['Banda'] }, ['Costalero']).join(','))
  caso('sin duplicar la que está en las dos', 1,
    m.etiquetasDe({ etiquetas: ['Costalero'] }, ['Costalero']).length)
  caso('sin ninguna, lista vacía', 0, m.etiquetasDe({}, []).length)
  caso('solo las manuales', 'Banda', m.etiquetasDe({ etiquetas: ['Banda'] }, []).join(','))

  // --- El índice, que es lo que usan las tablas ---
  const idx = m.indiceRoles(
    [p({ tramoId: 't1' }), p({ tramoId: 't2', hermanoId: 'h2' }), p({ tramoId: 't3', hermanoId: 'h3' })],
    tramos, 2027,
  )
  caso('el índice trae a los que tienen rol', 2, idx.size)
  caso('con el suyo', 'Costalero', idx.get('h1').join(','))
  caso('y el del otro', 'Acólito', idx.get('h2').join(','))
  caso('quien no tiene rol no está', undefined, idx.get('h3'))
  // El índice y el cálculo uno a uno tienen que decir lo mismo.
  caso('el índice coincide con el cálculo suelto', auto([p({ tramoId: 't1' })]).join(','), idx.get('h1').join(','))

  // --- Qué roles existen, para la lista de filtrar ---
  const cuales = m.etiquetasQueSonAutomaticas(tramos)
  caso('los roles configurados', 'Acólito,Costalero', cuales.join(','))
  caso('sin tramos, ninguno', 0, m.etiquetasQueSonAutomaticas([]).length)

  await cargoPorCuenta({ cargar, caso })

  await unaCuentaDosPuertas({ cargar, caso })
}

/**
 * Auditoría 2026-08 · Todo el personal entraba como titular.
 *
 * El cargo se buscaba por `user_metadata.personalId`, un campo que SOLO se
 * escribe en el acceso de demostración. Con una cuenta de verdad venía vacío,
 * y vacío significaba «el que manda»: quien tenía acceso solo a Tesorería veía
 * el censo entero, con DNI, teléfonos, direcciones y notas de salud.
 */
async function cargoPorCuenta({ cargar, caso }) {
  const m = await cargar('src/lib/permisos.ts')
  const personal = [
    { cargo: 'Tesorero/a', activo: true, authUserId: 'uid-tesorero' },
    { cargo: 'Secretario/a', activo: false, authUserId: 'uid-exsecretaria' },
  ]

  caso('el tesorero entra como tesorero', 'Tesorero/a', m.cargoDeCuenta('uid-tesorero', personal, false))
  // Y no como titular, que es lo que pasaba antes.
  caso('y NO como titular', true, m.cargoDeCuenta('uid-tesorero', personal, false) !== null)

  // El titular sí: null significa «sin límites».
  caso('el titular manda', null, m.cargoDeCuenta('uid-titular', personal, true))

  // Desactivado no es titular: se queda fuera hasta que alguien lo arregle.
  caso('a quien le quitaron el acceso, sin permisos', '__desconocido__',
    m.cargoDeCuenta('uid-exsecretaria', personal, false))

  // ANTE LA DUDA, CERRAR. Una cuenta que no está en personal y no es titular
  // no puede acabar con el panel abierto.
  caso('una cuenta desconocida se queda fuera', '__desconocido__',
    m.cargoDeCuenta('uid-vete-a-saber', personal, false))
  caso('y sin identificar tampoco abre', '__desconocido__',
    m.cargoDeCuenta(undefined, personal, false))
  // Salvo que sea el titular, claro.
  caso('salvo que conste como titular', null, m.cargoDeCuenta(undefined, personal, true))

  // Y que las pantallas usen el hook, no el metadata.
  const { readFile } = await import('node:fs/promises')
  for (const f of ['src/components/AppShell.tsx', 'src/pages/app/Cuotas.tsx', 'src/pages/app/DashboardHome.tsx']) {
    const src = await readFile(f, 'utf8')
    caso(`${f.split('/').pop()} usa el hook`, true, /useCargoDeLaSesion(ConEstado)?\(\)/.test(src))
    caso(`${f.split('/').pop()} ya no mira el metadata`, false, /user_metadata\?\.personalId/.test(src))
  }
  // Mientras la respuesta no llega, sin permisos: si empezara abierto habría
  // un instante en cada carga en el que el tesorero ve el censo.
  const perm = await readFile('src/lib/permisos.ts', 'utf8')
  // Empieza cerrado: si empezara abierto habría un instante en cada carga en
  // el que el tesorero ve el censo entero.
  caso('empieza cerrado mientras se resuelve', true,
    /cargo: '__desconocido__' as Cargo,\s*\n\s*resuelto: false,/.test(perm))
  // Pero «todavía no lo sé» NO es «no tiene permisos»: confundirlos hacía que
  // pulsar cualquier sección devolviera a Inicio, porque el marco redirigía en
  // el primer pintado, antes de que llegara la respuesta.
  caso('y dice si ya se sabe', true, /resuelto: boolean/.test(perm))
  const shell = await readFile('src/components/AppShell.tsx', 'utf8')
  caso('el marco espera a saberlo antes de redirigir', true,
    /const accesoBloqueado =\s*\n\s*cargoResuelto &&/.test(shell))
}

/**
 * Ser hermano Y llevar la hermandad, con UNA sola cuenta.
 *
 * En una hermandad casi todo el que gestiona es además hermano. Antes había
 * que elegir: o entrabas al panel o entrabas a tu área. El aviso llegaba a
 * decir «sal de esta sesión y entra con la cuenta de secretaría», o sea, ten
 * dos cuentas. Eso no es una hermandad, es un apaño.
 */
async function unaCuentaDosPuertas({ cargar, caso }) {
  const { readFile } = await import('node:fs/promises')

  // Los dos papeles por separado, no un «es hermano» de sí o no: con un solo
  // dato hay que elegir uno y cerrarle el otro.
  const lib = await readFile('src/lib/multiHermandad.ts', 'utf8')
  caso('se distinguen los dos papeles', true, /esHermano: boolean/.test(lib) && /gestiona: boolean/.test(lib))
  caso('«solo hermano» es hermano Y no gestiona', true, /p\.esHermano && !p\.gestiona/.test(lib))
  // Ante un fallo de red no se echa a nadie del panel.
  caso('ante la duda no cierra el panel', true, /esHermano: false, gestiona: true/.test(lib))

  // Desde el panel, su área.
  const shell = await readFile('src/components/AppShell.tsx', 'utf8')
  caso('el panel ofrece «Mi área de hermano»', true, /Mi área de hermano/.test(shell))
  caso('y solo si tiene ficha', true, /papeles\.esHermano && \(/.test(shell))

  // Desde su área, el panel.
  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  caso('el área ofrece volver al panel', true, /Ir al panel de gestión/.test(portal))
  caso('y solo si gestiona', true, /papelesAqui\.gestiona && !poniendoClaveNueva/.test(portal))
  // Y ya no se le manda a tener dos cuentas.
  caso('ya no dice «entra con la cuenta de secretaría»', false, /entra con la cuenta\s*\n?\s*de secretaría/.test(portal))

  // Y en la base de datos, que es donde de verdad se decide.
  const sql = await readFile('supabase/hermano-y-gestion.sql', 'utf8')
  caso('la base sabe que gestionar manda sobre ser hermano', true,
    /not exists \(select 1 from titulares where auth_user_id = auth\.uid\(\)\)/.test(sql))
  caso('y cuenta el personal activo', true,
    /not exists \(select 1 from personal where auth_user_id = auth\.uid\(\) and activo\)/.test(sql))

  // ---------------------------------------------------------------------
  // No poder saberlo NO es lo mismo que saber que no
  // ---------------------------------------------------------------------
  /*
   * `papelesDeLaCuenta` preguntaba tres cosas a la base y no miraba si alguna
   * había fallado. Y `supabase.rpc()` no lanza excepción cuando va mal:
   * devuelve `{ data: null, error: {...} }`. Así que un `data: null` de una
   * consulta rota se colaba como un «no» perfectamente creíble.
   *
   * Bastaba con que la llamada a `es_titular()` fallara una vez —la función
   * todavía sin desplegar, un permiso, medio segundo sin red— para que al
   * Hermano Mayor le dijeran que él no lleva su hermandad y lo echaran al área
   * del hermano. Y desde allí no hay vuelta: vuelve a pulsar «gestiono la
   * hermandad» y vuelve a salir rebotado.
   *
   * Encima era incoherente: el `catch` de al lado sí daba `gestiona: true`.
   * El mismo fallo, resuelto de las dos maneras contrarias según por dónde
   * saliera.
   */
  const fuente = await (await import('node:fs/promises')).readFile('src/lib/multiHermandad.ts', 'utf8')
  caso('se mira si la consulta falló', true, fuente.includes('!titular.error && !personal.error'))
  caso('y se dice si la respuesta es de fiar', true, /seguro: sabemosSiGestiona/.test(fuente))
  // Sin saberlo, se da por hecho que SÍ gestiona: el daño de dejar entrar de
  // más lo paran las políticas de la base; el de echar de menos es dejar al
  // Hermano Mayor fuera de su hermandad.
  caso('sin saberlo, no se le cierra la puerta', true, /sabemosSiGestiona \? gestiona : true/.test(fuente))
  // Y lo que de verdad protege: echar a alguien exige estar seguro.
  caso('saber si es solo hermano exige estar seguro', true, /return p\.seguro && p\.esHermano && !p\.gestiona/.test(fuente))

  // Y del panel ya no se echa a nadie. Hubo dos versiones y las dos estaban
  // mal: redirigir en silencio —pulsas «gestiono la hermandad», parpadea y
  // apareces en otro sitio— y preguntar «¿a dónde quieres ir?», que es peor,
  // porque ya lo habías dicho al entrar. Si pide el panel, se le da el panel:
  // lo que vea dentro lo deciden las políticas de la base de datos, que son
  // las que mandan y no enseñan un solo dato que no toque.
  const guardia = await (await import('node:fs/promises'))
    .readFile('src/components/ProtectedRoute.tsx', 'utf8')
  caso('el panel ya no redirige al área del hermano', false, /Navigate to="\/hermano"/.test(guardia))
  caso('ni pregunta a dónde quieres ir', false, /A dónde quieres ir/.test(guardia))
  // Lo que sí sigue: sin sesión no se entra.
  caso('sin sesión, al login', true, /if \(!session && configured\)/.test(guardia))
  caso('y con el segundo paso pendiente, también', true, /mfaPendiente/.test(guardia))

  // ---------------------------------------------------------------------
  // «Entra como un cargo concreto y comprueba qué ve cada uno»
  // ---------------------------------------------------------------------
  /*
   * Eso es lo que ofrece la pantalla de acceso. Y no lo cumplía: se entraba
   * como Carmen Ruiz, Secretaria, y salía el panel ENTERO —Tesorería,
   * Inventario, Personal y permisos, Configuración— con un «Titular de la
   * hermandad» debajo de su nombre.
   *
   * El motivo: sin Supabase no hay tabla `titulares` a la que preguntar, así
   * que `soyTitular()` contesta que sí para no bloquear la demostración. Y
   * titular quiere decir acceso completo.
   *
   * Comprobado en un navegador, cargo por cargo, después del arreglo:
   *   Secretario/a  → Hermanos, Cortejo, Papeletas, Eventos, Archivo,
   *                   Comunicados, Web, Informes
   *   Tesorero/a    → Cuotas, Tesorería, Inventario, Informes
   *   Fiscal        → Archivo, Informes
   * Y escribiendo /app/tesoreria a mano, la secretaria vuelve a Inicio.
   */
  const permisos = await cargar('src/lib/permisos.ts')
  const fuentePermisos = await (await import('node:fs/promises'))
    .readFile('src/lib/permisos.ts', 'utf8')

  caso('el cargo sale de la cuenta de ejemplo', true, fuentePermisos.includes('function cargoDeLaCuentaDemo'))
  // La línea que lo hace seguro: SOLO con la base de datos apagada. Con
  // Supabase conectado, el metadata de la sesión no se mira nunca, porque lo
  // puede reescribir el propio usuario y por ahí se coló en su día que todo el
  // personal entrara como titular.
  caso('y solo con Supabase apagado', true, /if \(isSupabaseConfigured\) return undefined/.test(fuentePermisos))

  // Los permisos de fábrica de cada cargo, que es lo que se ve en el menú.
  const porDefecto = permisos.PERMISOS_POR_DEFECTO
  caso('la secretaria no ve tesorería', false, porDefecto['Secretario/a'].includes('tesoreria'))
  caso('ni cuotas', false, porDefecto['Secretario/a'].includes('cuotas'))
  caso('ni personal y permisos', false, porDefecto['Secretario/a'].includes('personal'))
  caso('pero sí el censo', true, porDefecto['Secretario/a'].includes('hermanos'))
  caso('el tesorero sí ve tesorería', true, porDefecto['Tesorero/a'].includes('tesoreria'))
  caso('y no ve el censo', false, porDefecto['Tesorero/a'].includes('hermanos'))
  // El titular no tiene lista: la ausencia de lista ES el acceso completo.
  caso('el titular no tiene restricción', null, permisos.permisosDeCargo(null))
  // Y un cargo que no se reconoce se queda SIN nada, nunca con todo.
  caso('un cargo desconocido no abre nada', 0, permisos.permisosDeCargo('__desconocido__').length)
  caso('y no puede ver tesorería', false, permisos.puedeVerModulo('__desconocido__', 'tesoreria'))
}
