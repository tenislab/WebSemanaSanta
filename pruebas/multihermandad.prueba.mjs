/**
 * M3: la aplicación con todas las hermandades en un mismo Supabase.
 *
 * Lo que de verdad aísla una hermandad de otra está en la base de datos y se
 * comprueba con `supabase/PRUEBA-AISLAMIENTO.sql`, que levanta dos hermandades
 * en un Postgres y mira que ninguna vea, toque ni borre nada de la otra. Aquí
 * solo se prueban las decisiones que toma el navegador: a qué hermandad manda
 * un formulario y qué lista de hermandades se le enseña al hermano.
 */
export default async function ({ cargar, caso }) {
  const mh = await cargar('src/lib/multiHermandad.ts')
  const dir = await cargar('src/lib/hermandades.ts')

  // --- La hermandad de la página pública ------------------------------------
  caso('al arrancar no hay hermandad de página', null, mh.getHermandadDeLaPagina())

  mh.fijarHermandadDeLaPagina('11111111-1111-1111-1111-111111111111')
  caso(
    'al abrir la web de una hermandad, queda fijada',
    '11111111-1111-1111-1111-111111111111',
    mh.getHermandadDeLaPagina(),
  )

  // A dónde va lo que se envía desde un formulario. Sin sesión (aquí no hay
  // Supabase) tiene que salir la de la página y no un nulo: si saliera nulo,
  // el mensaje se quedaría sin dueño y no lo leería nadie.
  caso(
    'un formulario manda a la hermandad de la página',
    '11111111-1111-1111-1111-111111111111',
    await mh.hermandadDestino(),
  )

  // Al cambiar de hermandad —el hermano vuelve atrás y elige otra— el destino
  // cambia con ella. Antes de tener esto, la solicitud se habría ido a la
  // primera que hubiera mirado.
  mh.fijarHermandadDeLaPagina('22222222-2222-2222-2222-222222222222')
  caso(
    'al elegir otra hermandad, el destino cambia',
    '22222222-2222-2222-2222-222222222222',
    await mh.hermandadDestino(),
  )

  mh.fijarHermandadDeLaPagina(null)
  caso('y se puede dejar sin fijar', null, await mh.hermandadDestino())

  // Sin Supabase (modo local) no se pregunta nada a la red.
  caso('en modo local no hay hermandad de sesión', null, await mh.hermandadActualId())
  caso('en modo local la lista de hermandades viene vacía', 0, (await mh.hermandadesPublicas()).length)

  // --- La lista que ve el hermano para elegir la suya ------------------------
  const principal = { nombre: 'Hdad. de prueba', ciudad: 'Sevilla', color: '#caa24a', telefono: '', email: '' }

  // Sin Supabase: la principal más las de muestra, que son el escaparate del
  // modo demostración y NO se tocan.
  const local = dir.directorioCompleto(principal)
  caso('en modo local sale la hermandad principal', true, local[0].id === dir.ID_HERMANDAD_PRINCIPAL)
  caso('y también las de muestra', true, local.length > 1)

  // Con hermandades reales, la lista son ellas: cada hermano tiene que poder
  // encontrar la suya entre todas las que hay dadas de alta.
  const reales = [
    { id: 'aaaa-1', nombre: 'Hermandad de la Amargura' },
    { id: 'bbbb-2', nombre: 'Hermandad de la Esperanza' },
  ]
  const conReales = dir.directorioCompleto(principal, reales)
  // En estas pruebas no hay variables de entorno de Supabase, así que la
  // lista real no se aplica: se comprueba que al menos no rompe nada y que la
  // búsqueda sigue filtrando por nombre.
  caso('con lista real, el directorio sigue devolviendo algo', true, conReales.length > 0)

  const buscadas = dir.buscarHermandades('esperanza', principal)
  caso('buscar por nombre encuentra', true, buscadas.every((h) => /esperanza/i.test(h.nombre + h.ciudad)))
  caso('buscar algo que no existe no devuelve nada', 0, dir.buscarHermandades('zzzz', principal).length)

  /*
   * EL BUSCADOR, COMO SE TECLEA DE VERDAD.
   *
   * La pantalla dice «escribe el nombre o la ciudad». Antes exigía que el texto
   * apareciera tal cual, entero y seguido, y con sus tildes. O sea: nadie que
   * escribiera «soledad» desde un móvil encontraba «Hermandad de Ntra. Sra. de
   * la Soledad», y «ecija» no encontraba «Écija».
   */
  // Sobre el directorio de muestra, que trae «Hermandad de la Soledad» (Écija)
  // y varias de Sevilla: justo los casos que hacían falta.
  const busca = (q) => dir.buscarHermandades(q, principal).map((h) => h.nombre)

  caso('una palabra suelta del nombre encuentra', true,
    busca('soledad').some((n) => /Soledad/.test(n)))
  caso('sin tildes también', true, busca('ecija').some((n) => /Soledad/.test(n)))
  caso('en mayúsculas igual', true, busca('SOLEDAD').some((n) => /Soledad/.test(n)))
  caso('por la ciudad', true, busca('sevilla').length > 0)
  // Dos palabras: tienen que aparecer LAS DOS, para distinguir dos hermandades
  // parecidas en ciudades distintas.
  caso('dos palabras afinan', true, busca('soledad ecija').some((n) => /Soledad/.test(n)))
  caso('y descartan lo que no cuadra', 0, busca('soledad seviIla').length)
  caso('lo que no existe sigue sin salir', 0, busca('zzzz').length)

  // Y la ciudad tiene que LLEGAR desde la base. Venía siempre vacía, así que la
  // mitad del buscador que la pantalla ofrece no encontraba nunca nada.
  const conCiudad = dir.directorioCompleto(principal, [
    { id: '1', nombre: 'Real Hermandad del Nazareno', ciudad: 'Sevilla' },
  ])
  caso('la ciudad viaja hasta el directorio', true,
    conCiudad.every((h) => typeof h.ciudad === 'string'))

  /*
   * EL ESCUDO DE LA HERMANDAD, NO UNO GENÉRICO.
   *
   * El logo llegaba de la base y la pantalla lo tiraba: pintaba siempre el
   * glifo dibujado. A una hermandad que ha subido su escudo, enseñarle una
   * cruz de plantilla es decirle que su escudo da igual — y en el buscador es
   * justo lo que hace que un hermano reconozca la suya sin leer.
   */
  const { readFile } = await import('node:fs/promises')
  const escudo = await readFile('src/components/EscudoHermandad.tsx', 'utf8')
  caso('el escudo acepta el logo de la hermandad', true, /logoDataUrl\?: string \| null/.test(escudo))
  caso('y si lo hay, lo enseña en vez del dibujo', true, /if \(logoDataUrl\)/.test(escudo))
  // Sin logo sigue habiendo escudo: una hermandad recién creada no puede
  // quedarse con un hueco en blanco.
  caso('sin logo sigue dibujando el suyo', true, /const uid = /.test(escudo))

  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  const conLogo = (portal.match(/<EscudoHermandad[\s\S]{0,220}?logoDataUrl=/g) ?? []).length
  const total = (portal.match(/<EscudoHermandad/g) ?? []).length
  caso('y en el buscador se le pasa siempre', total, conLogo)

  await aislamientoAuditoria({ cargar, caso })

  await areaHermanoAuditoria({ cargar, caso })
}

/**
 * Auditoría 2026-08 · Que una hermandad no vea nada de otra.
 *
 * Seis hallazgos con la misma raíz: el navegador guarda cosas que son de UNA
 * hermandad y luego las enseña en el sitio de otra.
 */
async function aislamientoAuditoria({ caso }) {
  const { readFile } = await import('node:fs/promises')

  // --- El área del hermano no puede pisar el censo del panel ---
  // La secretaria con Hermanos abierto y un hermano entrando en otra pestaña:
  // la consulta del hermano devuelve 1 fila (solo ve la suya), espejaba la
  // clave común, y el panel se quedaba con un censo de una persona.
  const sync = await readFile('src/lib/supabaseSync.ts', 'utf8')
  caso('el hook admite no dejar copia', true, /sinEspejo\?: boolean/.test(sync))
  caso('y sin copia no escucha a otras pestañas', true, /if \(sinEspejo\) return/.test(sync))
  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  caso('el área del hermano no deja copia', true, /const sinEspejo = \{ sinEspejo: true \}/.test(portal))
  // Las cuatro tablas que monta, no solo una.
  caso('en las cuatro tablas', 4, (portal.match(/\n\s+sinEspejo,\n/g) ?? []).length)

  // --- Un fallo de red no puede llenar el panel de datos de ejemplo ---
  caso('la reserva nunca son los ejemplos', true, /isSupabaseConfigured \? \[\] : inicial/.test(sync))
  // Y lo más importante: no marcarlo como cargado, o el primer cambio
  // dispararía `sincronizar`, que borra en Supabase lo que no aparece en la
  // lista. Comparar contra una lista que nunca vino de la base es borrar todo.
  caso('un fallo no marca la tabla como cargada', true,
    /cargado\.current = true\n\s+\}\n\s+\}, \(err\)/.test(sync))
  caso('y se avisa de que no se pudo cargar', true, /function avisarDeFallo/.test(sync))

  // --- La web pública no puede enseñar el IBAN de otra hermandad ---
  const sitio = await readFile('src/pages/SitioPublico.tsx', 'utf8')
  caso('los datos vienen del servidor por slug', true, /ajustesDeLaWeb\(web\.slug\)/.test(sitio))
  const web = await readFile('src/lib/webPublica.ts', 'utf8')
  caso('y la función pregunta por el slug', true, /rpc\('hermandad_de_la_web'/.test(web))
  // Que NO devuelva IBAN ni Bizum es parte del arreglo: si no llegan, no se
  // pueden enseñar por equivocación.
  caso('sin IBAN', true, /iban: '',/.test(web))
  caso('sin Bizum', true, /bizumTelefono: '',/.test(web))

  // --- Cambiar de usuario sin cerrar sesión ---
  const auth = await readFile('src/context/AuthContext.tsx', 'utf8')
  caso('se olvida al cambiar de persona', true,
    /usuarioAhora !== ultimoUsuario && ultimoUsuario !== null/.test(auth))

  // --- Y el SQL ---
  const sql = await readFile('supabase/multi-hermandad.sql', 'utf8')
  // Cualquiera podía adjudicarse todas las filas sin dueño de la base entera.
  caso('adoptar_datos_sin_hermandad está cerrada', true,
    /revoke execute on function adoptar_datos_sin_hermandad\(uuid\) from public;/.test(sql))
  caso('también a anon y authenticated', true,
    /revoke execute on function adoptar_datos_sin_hermandad\(uuid\) from anon, authenticated;/.test(sql))
  // El `limit 1` sin filtro metía a un titular nuevo en la hermandad de otros.
  caso('la mudanza solo con una hermandad', 2, (sql.match(/count\(\*\) from hermandades\) <= 1/g) ?? []).length)

  // El barrido de DNI: pertenecer a una hermandad revela convicciones
  // religiosas, que el RGPD trata como categoría especial (artículo 9).
  const acceso = await readFile('supabase/acceso-hermano.sql', 'utf8')
  caso('el acceso por DNI tiene tope', true, /if v_recientes >= 25 then/.test(acceso))
  caso('cuenta DNI distintos, no repeticiones', true, /count\(distinct huella_dni\)/.test(acceso))
  caso('y no guarda ningún DNI en claro', true, /md5\(v_dni/.test(acceso))
  caso('la tabla de intentos está cerrada', true, /revoke all on intentos_acceso from anon, authenticated;/.test(acceso))

  // Y la guía ya no manda hacer el insert que causaba el problema.
  const endurecer = await readFile('supabase/rls-endurecer.sql', 'utf8')
  caso('la guía usa crear_hermandad_manual', true, /select crear_hermandad_manual\(/.test(endurecer))
}

/**
 * Auditoría 2026-08 · El área del hermano.
 *
 * Todos tienen la misma pinta desde fuera: el hermano hace algo, la pantalla
 * le dice que ha salido bien, y no ha pasado nada.
 */
async function areaHermanoAuditoria({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile('supabase/area-hermano.sql', 'utf8')

  // La recursión: `hermano_propio_id()` lee de `hermanos`, así que usada desde
  // una política SOBRE `hermanos` se llamaba a sí misma hasta reventar. Y no
  // reventaba solo la consulta del tutor: CUALQUIER lectura del área.
  caso('hermano_propio_id no se muerde la cola', true,
    /create or replace function hermano_propio_id\(\) returns uuid\n\s+language sql stable security definer/.test(sql))

  // El aviso de «ya he pagado» no llegaba: no había política de UPDATE, y
  // Postgres no da error, actualiza cero filas y dice que todo bien.
  caso('el hermano puede avisar de su pago', true, /create policy "cuotas_propio_aviso_pago" on cuotas for update/.test(sql))

  // El número de papeleta se calculaba en su móvil, donde solo ve las suyas.
  caso('el número de papeleta lo da el servidor', true, /function siguiente_numero_papeleta\(p_anio int\)/.test(sql))
  caso('mirando todas las de la hermandad', true, /where hermandad_id = hermandad_actual\(\) and anio = p_anio/.test(sql))
  caso('y hay índice único que impide el duplicado', true, /create unique index if not exists papeletas_numero_unico/.test(sql))
  // Con duplicados ya dentro, el índice no se puede crear: hay que limpiarlos.
  caso('se limpian los duplicados que ya hubiera', true, /row_number\(\) over \(partition by hermandad_id, anio, numero/.test(sql))

  // El buzón vivía en el navegador de secretaría: en el móvil siempre vacío.
  caso('el buzón es una tabla de verdad', true, /create table if not exists avisos_hermano/.test(sql))
  // Sin el default, la fila entra sin hermandad y su propia política la
  // rechaza: la secretaría no podía dejar ni un aviso.
  caso('con hermandad por defecto', true, /hermandad_id uuid not null default hermandad_actual\(\)/.test(sql))
  caso('el hermano lee los suyos', true, /create policy "avisos_propio_select"/.test(sql))
  caso('y no puede escribirse avisos', false, /create policy "avisos_propio_insert"/.test(sql))

  // Las preferencias de avisos vivían en el móvil del hermano, así que quien
  // mandaba el correo desde otro ordenador no las veía y le escribía igual.
  caso('las preferencias van en su ficha', true, /add column if not exists avisos_preferencias jsonb/.test(sql))

  // El hijo a cargo se descartaba al guardar: la columna no existía.
  caso('el tutor se guarda', true, /add column if not exists tutor_id uuid references hermanos\(id\)/.test(sql))
  caso('y el tutor ve a quien tiene a cargo', true, /create policy "hermanos_a_mi_cargo_select"/.test(sql))

  // Y en la aplicación: el hermano solo escribe SUS tres campos.
  const db = await readFile('src/lib/db/hermanos.ts', 'utf8')
  caso('hay un mapeo de solo contacto', true, /export function contactoDelHermanoToRow/.test(db))
  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  caso('el área lo usa para guardar', true, /\.update\(contactoDelHermanoToRow\(/.test(portal))
  caso('y si falla, lo dice', true, /No se han podido guardar tus datos/.test(portal))
}
