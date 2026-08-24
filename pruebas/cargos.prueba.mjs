/**
 * UNA PERSONA, UNA FICHA — el cargo vive en la ficha del hermano.
 *
 * EL PROBLEMA QUE RESUELVE. El secretario de una hermandad existía dos veces:
 * hermano nº 47 en el censo, con sus cuotas y su papeleta, y fila en `personal`
 * con su correo y su cargo. Dos fichas, dos claves, dos maneras de entrar, y
 * nada que las uniera salvo que se llamaban igual. De ahí salía el fallo que se
 * veía en pantalla: se entraba con el correo, la aplicación encontraba su ficha
 * de hermano y le mandaba a su área, sin forma de llegar al panel.
 *
 * Lo que se comprueba aquí es sobre todo lo que NO se ve: que nadie pueda darse
 * un cargo a sí mismo, que quitarlo no deje la hermandad sin nadie que pueda
 * repartirlos, y que el hermano civil no acabe siendo un moroso permanente.
 */
export default async function ({ caso, cargar }) {
  const { readFile } = await import('node:fs/promises')

  // ---------------------------------------------------------------------
  // 1. El cargo VIAJA. Sin esto, todo lo demás es pintura.
  // ---------------------------------------------------------------------
  const mapeo = await readFile('src/lib/db/hermanos.ts', 'utf8')
  caso('el cargo se guarda', true, /cargo: h\.cargo \?\? null/.test(mapeo))
  caso('y se lee', true, /cargo: \(r\.cargo as Cargo \| null\) \?\? null/.test(mapeo))
  caso('lo de civil, igual', true, /civil: h\.civil \?\? false/.test(mapeo) && /civil: Boolean\(r\.civil\)/.test(mapeo))

  const sql = await readFile('supabase/hermano-con-cargo.sql', 'utf8')
  caso('las columnas existen en la base', true,
    /add column if not exists cargo text/.test(sql) && /add column if not exists civil boolean/.test(sql))
  // Y va en el pegote que se ejecuta de una vez, o la hermandad no lo aplica.
  const todo = await readFile('supabase/TODO-EN-UNO.sql', 'utf8')
  caso('y entra en TODO-EN-UNO.sql', true, todo.includes('add column if not exists cargo text'))

  // ---------------------------------------------------------------------
  // 2. LA ESCALADA DE PRIVILEGIOS. Lo primero de todo.
  // ---------------------------------------------------------------------
  /*
   * `hermanos_propio_update` deja a cada hermano reescribir SU PROPIA FILA. Era
   * inofensivo mientras en esa fila no hubiera nada que diera poder. Desde que
   * existe `cargo`, un hermano cualquiera puede abrir la consola del navegador
   * y escribir:
   *
   *     supabase.from('hermanos').update({ cargo: 'Hermano Mayor' }).eq(...)
   *
   * Postgres NO permite limitar columnas dentro de una política RLS, así que la
   * única forma de proteger dos columnas de una fila que su dueño sí puede
   * editar es un disparador.
   */
  caso('hay un disparador que vigila el cargo', true,
    /create trigger hermanos_solo_personal_toca_el_cargo/.test(sql))
  caso('y salta antes de escribir', true, /before insert or update on hermanos/.test(sql))
  caso('solo pasa quien reparte cargos', true,
    /if modulo_permitido\('hermanos'\) or modulo_permitido\('personal'\) then return new/.test(sql))

  /*
   * Y es LISTA BLANCA, no lista negra, que es lo que arregla el segundo
   * agujero: congelar solo `cargo` y `civil` no bastaba, porque la única forma
   * que tiene la base de revocar un cargo es el `estado` — y `estado` era una
   * columna más de su propia fila. Al tesorero destituido le bastaba con
   * `update({ estado: 'Activo' })` para recuperar Tesorería.
   */
  for (const columna of ['estado', 'numero', 'cuota_al_dia', 'antiguedad', 'iban', 'dni']) {
    caso(`un hermano no se cambia su ${columna}`, true,
      new RegExp(`new\\.${columna} := old\\.${columna}`).test(sql))
  }
  // Y la baja quita el cargo, para no depender de que el estado siga en pie.
  const censo = await readFile('src/lib/censo.ts', 'utf8')
  caso('la baja quita el cargo', true, /estado: 'Baja' as const, numero: 0, bajaSolicitada: false, cargo: null/.test(censo))

  // ---------------------------------------------------------------------
  // 3. QUIÉN GESTIONA: las tres vías, sumadas, nunca sustituidas.
  // ---------------------------------------------------------------------
  /*
   * Si alguien reemplaza la rama de `personal` por la de `hermanos`, toda la
   * junta que hoy entra por /login con su correo se queda fuera de golpe.
   */
  caso('modulo_permitido suma personal Y hermanos', true,
    /from personal p[\s\S]{0,400}from hermanos h/.test(sql))
  caso('y los permisos son de cada hermandad', true,
    /pc\.cargo = h\.cargo[\s\S]{0,80}pc\.hermandad_id = h\.hermandad_id/.test(sql))
  caso('un hermano de baja no sigue gestionando', true, /h\.estado <> 'Baja'/.test(sql))
  caso('auth_es_hermano mira el cargo de la ficha', true,
    /and cargo is not null[\s\S]{0,120}and estado <> 'Baja'/.test(sql))

  // ---------------------------------------------------------------------
  // 4. LEER EL CENSO YA NO ES GRATIS.
  // ---------------------------------------------------------------------
  /*
   * `hermanos_staff_select` era `not auth_es_hermano()` y nada más: quien
   * entrara al panel se llevaba el censo entero. Con los cargos en la ficha,
   * «entrar al panel» deja de ser cosa de seis personas nombradas a dedo: un
   * Vocal podía bajarse ochocientas filas con DNI, IBAN y notas de salud desde
   * la consola. Salud y convicciones religiosas: categoría especial del RGPD.
   */
  const politicaCenso = sql.slice(sql.indexOf('create policy "hermanos_staff_select"'))
    .slice(0, 600)
  caso('leer el censo exige módulo', true, /modulo_permitido\('hermanos'\)/.test(politicaCenso))
  caso('y los que de verdad lo necesitan también', true,
    ['cuotas', 'papeletas', 'cortejo', 'informes'].every((m) => politicaCenso.includes(`modulo_permitido('${m}')`)))

  // Las otras dos tablas que guardan lo que una hermandad no enseña.
  caso('el libro de tesorería exige módulo', true,
    /create policy "movimientos_staff_select"[\s\S]{0,220}modulo_permitido\('tesoreria'\)/.test(sql))
  caso('el archivo documental también', true,
    /create policy "documentos_staff_select"[\s\S]{0,200}modulo_permitido\('archivo'\)/.test(sql))

  /*
   * El civil no sale en el cortejo ni recibe la convocatoria de papeletas.
   *
   * Lo del cortejo se comprueba EJECUTÁNDOLO, no buscando un trozo de texto
   * en el fichero. Antes esto era `/!x\.hermano!\.civil/.test(cortejo)`, y esa
   * prueba se pone roja el día que la regla se saca a una función con nombre
   * —que es una mejora— y se pondría verde con la regla escrita y nunca
   * llamada. Ninguna de las dos cosas es lo que se quiere saber.
   */
  const { puedeSalirEnElCortejo } = await cargar('src/lib/cortejo.ts')
  caso('el civil no sale en el cortejo', false,
    puedeSalirEnElCortejo({ estado: 'Activo', civil: true }))
  caso('y el hermano de siempre sí', true, puedeSalirEnElCortejo({ estado: 'Activo' }))
  const conv = await readFile('src/lib/convocatoria.ts', 'utf8')
  caso('ni recibe la convocatoria', true, /h\.estado !== 'Baja' && !h\.civil/.test(conv))


  // Y las políticas que anulaban el filtro por módulo, borradas.
  caso('se borra authenticated_all', true, /drop policy if exists "authenticated_all"/.test(sql))
  caso('y sus tres hermanas', true,
    ['hermanos_personal_all', 'cuotas_personal_all', 'papeletas_personal_all']
      .every((p) => sql.includes(`drop policy if exists "${p}"`)))

  // ---------------------------------------------------------------------
  // 5. LO QUE PIERDE quien empieza a gestionar, y no se puede perder.
  // ---------------------------------------------------------------------
  /*
   * Al volverse `auth_es_hermano()` falso para el hermano con cargo, dejaban de
   * aplicarle las políticas «propio». Casi todas quedan cubiertas por las de
   * gestión, que abren más. Pero DOS no: un Tesorero/a no tiene de fábrica el
   * módulo «papeletas», así que se quedaba sin poder sacar SU PROPIA papeleta.
   * Y como es un insert bloqueado por RLS, Postgres no da error: actualiza cero
   * filas y la pantalla dice que todo ha ido bien.
   */
  for (const p of ['papeletas_propio_insert', 'cuotas_propio_aviso_pago', 'papeletas_propio_select']) {
    const trozo = sql.slice(sql.indexOf(`create policy "${p}"`)).slice(0, 260)
    caso(`${p} ya no exige ser SOLO hermano`, false, /auth_es_hermano\(\) and/.test(trozo))
    caso(`${p} sigue siendo solo lo suyo`, true, /hermano_propio_id\(\)/.test(trozo))
  }

  // ---------------------------------------------------------------------
  // 6. LA RESOLUCIÓN DEL CARGO en la aplicación.
  // ---------------------------------------------------------------------
  const permisos = await readFile('src/lib/permisos.ts', 'utf8')
  /*
   * La trampa número uno: en esta casa `null` significa TITULAR (acceso a
   * todo), y en la ficha de un hermano `cargo: null` significa lo contrario —
   * hermano de a pie, sin panel. El mismo valor queriendo decir cosas opuestas.
   */
  caso('el cargo de una ficha no se pasa crudo', true, /function cargoDeSuFicha/.test(permisos))
  caso('sin cargo devuelve nada, no titular', true, /if \(!h \|\| !h\.cargo\) return undefined/.test(permisos))
  caso('de baja se queda sin permisos', true,
    /if \(h\.estado === 'Baja'\) return '__desconocido__'/.test(permisos))
  /*
   * Y el orden. Antes se devolvía «sin permisos» en cuanto se encontraba una
   * fila de personal desactivada, sin llegar a mirar la ficha. Y esa es
   * exactamente la migración natural: «le pongo el cargo en su ficha y
   * desactivo su acceso viejo». La secretaria acababa con el cargo escrito, la
   * base dejándola escribir, y un panel sin un solo módulo.
   */
  const orden = permisos.slice(permisos.indexOf('export function cargoDeCuenta'))
  caso('personal desactivado NO corta antes de mirar la ficha', true,
    orden.indexOf('cargoDeSuFicha') < orden.indexOf("if (miembro) return '__desconocido__'"))
  caso('y no reconocer a alguien nunca es ser titular', false,
    /if \(miembro\) return null/.test(orden))

  // La ficha se pregunta A LA BASE, no al espejo del navegador: el espejo está
  // vacío la primera vez que se abre la aplicación en un ordenador nuevo.
  const multi = await readFile('src/lib/multiHermandad.ts', 'utf8')
  caso('la ficha propia se pregunta a la base', true, /export async function miFichaDeHermano/.test(multi))
  caso('y si falla no es titular', true, /if \(error \|\| !fila\) return null/.test(multi))
  caso('papelesDeLaCuenta trae el cargo', true, /select\('id, cargo, estado'\)/.test(multi))
  caso('y lo suma a «gestiona»', true, /\|\| gestionaPorCargo/.test(multi))
  caso('si esa consulta falla, no se sabe', true, /&& !hermano\.error/.test(multi))

  // ---------------------------------------------------------------------
  // 7. LA PANTALLA: que no se cierre la puerta por dentro.
  // ---------------------------------------------------------------------
  const pantalla = await readFile('src/pages/app/Personal.tsx', 'utf8')
  /*
   * De fábrica el único cargo que abre «Personal y permisos» es el de Hermano
   * Mayor. Si se lo quita a sí mismo —o se lo cambia a Vocal creyendo que edita
   * otra fila— nadie más puede volver a repartir cargos salvo el titular. Y no
   * se nota al momento: la sesión abierta sigue funcionando, porque el cargo se
   * resuelve una sola vez al entrar. El menú vacío aparece al día siguiente.
   */
  caso('se cuenta quién quedaría repartiendo cargos', true, /function cuantosRepartenCargos/.test(pantalla))
  caso('y no se deja llegar a cero', true, /cuantosRepartenCargos\(id\) === 0/.test(pantalla))
  caso('quitárselo a uno mismo se pregunta', true, /quien\.authUserId === miUid/.test(pantalla))

  // El cargo NO viene puesto: venía con «Secretario/a» de fábrica, y quien daba
  // de alta a un contratado no bajaba la vista hasta el desplegable. Ese señor
  // quedaba con el censo entero.
  caso('el cargo hay que elegirlo', true, /Elige el cargo/.test(pantalla))
  caso('no viene ninguno puesto', false, /defaultValue=\{CARGOS_DE_JUNTA\[/.test(pantalla))
  // Y se dice en cristiano qué abre ese cargo ANTES de dárselo a nadie.
  caso('se dice qué verá', true, /function modulosEnCristiano/.test(pantalla))

  // «Hermano de a pie» no se reparte: no tiene módulos, así que sería una
  // cuenta de panel vacío que además sale de las políticas de hermano.
  caso('«Hermano de a pie» no se ofrece', true,
    /CARGOS_DE_JUNTA = CARGOS\.filter\(\(c\) => c !== 'Hermano de a pie'\)/.test(pantalla))

  // El guardado se COMPRUEBA: el disparador revierte en silencio, así que un
  // cargo que no se ha guardado sería indistinguible de uno que sí.
  const db = await readFile('src/lib/db/hermanos.ts', 'utf8')
  caso('el cargo se guarda comprobando', true, /export async function guardarCargoDeHermano/.test(db))
  caso('y se compara con lo que devuelve la base', true,
    /\(data\.cargo \?\? null\) !== cargo/.test(db))

  // La misma persona en las dos listas: manda la de personal, y el desplegable
  // de arriba no hace nada. Hay que decirlo, no esconderlo.
  caso('se cruzan las dos listas', true, /const dobleFicha = useMemo/.test(pantalla))
  caso('y se ofrece la salida', true, /async function unificar/.test(pantalla))

  // ---------------------------------------------------------------------
  // 8. EL HERMANO CIVIL: en el censo, con su área, sin cuotas.
  // ---------------------------------------------------------------------
  /*
   * Nunca se le emite un recibo, así que sin tratarlo aparte se quedaría
   * «pendiente» para siempre: al administrativo contratado le llegarían todos
   * los avisos de morosidad de la hermandad, por una deuda que no existe.
   *
   * Antes había que excluirlo A MANO en cada sitio y era un fallo seguro si
   * alguien se olvidaba en uno. Ahora su situación de cuota es `noAplica` —lo
   * dice `leTocaPagar`, un solo sitio— y queda fuera solo.
   */
  const emision = await readFile('src/lib/cuotasEmision.ts', 'utf8')
  caso('no se le emiten cuotas', true, /h\.estado !== 'Baja' && !h\.civil/.test(emision))
  const estado = await readFile('src/lib/estadoCuotaHermano.ts', 'utf8')
  caso('su situación de cuota es «no le toca»', true,
    /h\.estado !== 'Baja' && !h\.civil/.test(estado))
  const seg = await readFile('src/lib/segmentacion.ts', 'utf8')
  caso('ni le llegan avisos de impago', true,
    /c\.cuota === 'Pendiente' && situaciones\.get\(h\.id\) !== 'debe'/.test(seg))
  const ficha = await readFile('src/lib/hermanoFicha.ts', 'utf8')
  caso('no cuenta como hermano en las cifras', true, /h\.estado !== 'Baja' && !h\.civil/.test(ficha))
  // Pero SÍ sigue en el listado del censo, para que secretaría lo gestione.
  const hermanos = await readFile('src/pages/app/Hermanos.tsx', 'utf8')
  caso('en el censo se le distingue', true, /'No paga cuota'/.test(estado) && /cuotaEnPalabras\(situacionDe/.test(hermanos))
  caso('y no sale como «de baja» por no tener número', true,
    /Hermano civil · no ocupa número ni paga cuota/.test(hermanos))
  // Fuera del escalafón: si ocupara puesto, todos los de detrás bajarían uno.
  caso('fuera de la numeración', true, /function enElEscalafon/.test(censo))
  caso('y un censo con civiles sigue sano', true,
    /h\.estado !== 'Baja' && !h\.civil\)\.map\(\(h\) => h\.numero\)/.test(censo))

  // ---------------------------------------------------------------------
  // 9. EL ÁREA DEL HERMANO: la otra puerta de la misma persona.
  // ---------------------------------------------------------------------
  const portal = await readFile('src/pages/HermanoPortal.tsx', 'utf8')
  /*
   * No había NINGÚN enlace al panel dentro del área: el único estaba en la
   * pantalla de identificación, o sea antes de entrar. Quien llevaba cargo y
   * entraba a ver su papeleta tenía que cerrar sesión y volver a empezar.
   */
  caso('desde su área se llega al panel', true, /alPanel={llevaCargo}/.test(portal))
  caso('solo si lleva cargo', true, /const llevaCargo = Boolean\(/.test(portal))
  caso('y el civil no lee «cuota pendiente» para siempre', true, /No se te emiten cuotas/.test(portal))

  // ---------------------------------------------------------------------
  // 10. LA DEMOSTRACIÓN tiene que enseñar lo mismo, no lo contrario.
  // ---------------------------------------------------------------------
  /*
   * Sin Supabase, `soyTitular()` contesta que sí para no bloquear la demo. Si
   * el camino de demostración no conociera a los hermanos con cargo, un
   * Tesorero/a entraría con el panel ENTERO abierto: justo lo contrario de lo
   * que se está enseñando.
   */
  caso('la demostración conoce a los hermanos con cargo', true, /hermanoId/.test(permisos))
  caso('y sin ninguna marca sí es el titular', true, /if \(!idPersonal && !idHermano\) return null/.test(permisos))
  caso('una marca que ya no existe no abre nada', true,
    /if \(!miembro\) return '__desconocido__'/.test(permisos))
  const auth = await readFile('src/context/AuthContext.tsx', 'utf8')
  caso('se puede entrar como hermano con cargo', true, /u\.user_metadata\.hermanoId = conCargo\.id/.test(auth))

  // ---------------------------------------------------------------------
  // 11. Que la aplicación y la base digan LO MISMO sobre los permisos.
  // ---------------------------------------------------------------------
  /*
   * Llevaban sin coincidir desde que se añadió el módulo de eventos: al Hermano
   * Mayor le faltaban «eventos» y «web» en la base. El menú los enseñaba, se
   * creaba un culto, se guardaba, y no se guardaba nada sin ningún mensaje.
   */
  /*
   * Se lee del código fuente y no con un `import`: estas pruebas corren en
   * Node y `src/lib/permisos.ts` es TypeScript. Importarlo falla en silencio y
   * la comprobación se saltaría sin que nadie lo notara — que es justo lo que
   * pasaba la primera vez que se escribió esto.
   */
  const tabla = permisos.slice(
    permisos.indexOf('export const PERMISOS_POR_DEFECTO'),
    permisos.indexOf("const STORAGE_KEY"),
  )
  const siembra = sql.slice(sql.indexOf('create or replace function sembrar_permisos_de_fabrica')).slice(0, 2400)
  const TODOS = [...permisos.matchAll(/\{ id: '([a-z]+)', label:/g)].map((m) => m[1])
  const faltan = []
  for (const linea of tabla.split('\n')) {
    const m = linea.match(/^\s*'?([^':]+?)'?:\s*(TODOS|\[[^\]]*\]),?\s*$/)
    if (!m) continue
    const cargo = m[1].trim()
    if (cargo === 'Hermano de a pie') continue // sin módulos a propósito
    const modulos = m[2] === 'TODOS' ? TODOS : [...m[2].matchAll(/'([a-z]+)'/g)].map((x) => x[1])
    for (const mod of modulos) {
      if (!siembra.includes(`('${cargo}','${mod}')`)) faltan.push(`${cargo}/${mod}`)
    }
  }
  // Que la comprobación de arriba haya mirado algo de verdad.
  caso('se ha podido leer la tabla de permisos', true, TODOS.length >= 10 && tabla.includes('Hermano Mayor'))
  caso('la base siembra lo mismo que la aplicación', '', faltan.join(', '))

  /*
   * Y QUE NINGÚN CARGO DE FÁBRICA SE QUEDE FUERA.
   *
   * Cerrar la lectura del censo por módulo es lo correcto, pero es el cambio
   * con más capacidad de romper algo que ya funciona: si un cargo pierde el
   * censo, su pantalla de Hermanos se queda vacía y las cifras de Inicio en
   * blanco, sin ningún error que lo explique.
   *
   * Los siete cargos de la junta tienen que seguir leyéndolo, y todos entran
   * por algún sitio: el Fiscal y el Vocal por «informes», el Tesorero/a por
   * «cuotas», el Mayordomo/Prioste por «cortejo». «Hermano de a pie» no, y es
   * lo correcto: no tiene módulos, no reparte nada y no se ofrece.
   */
  const ABRE_EL_CENSO = ['hermanos', 'cuotas', 'papeletas', 'cortejo', 'informes', 'comunicados', 'personal']
  const sinCenso = []
  for (const linea of tabla.split('\n')) {
    const m = linea.match(/^\s*'?([^':]+?)'?:\s*(TODOS|\[[^\]]*\]),?\s*$/)
    if (!m) continue
    const cargo = m[1].trim()
    if (cargo === 'Hermano de a pie') continue
    const mods = m[2] === 'TODOS' ? TODOS : [...m[2].matchAll(/'([a-z]+)'/g)].map((x) => x[1])
    if (!mods.some((x) => ABRE_EL_CENSO.includes(x))) sinCenso.push(cargo)
  }
  caso('ningún cargo de fábrica se queda sin censo', '', sinCenso.join(', '))

  /*
   * EL AISLAMIENTO ENTRE HERMANDADES, que es lo que no se puede romper nunca.
   *
   * `solo_mi_hermandad` es la única política que dice DE QUIÉN son las filas, y
   * está declarada `as restrictive`. Eso importa más que ninguna otra línea de
   * todo el SQL: una política restrictiva se combina con Y, así que por muchas
   * políticas permisivas que se añadan encima —las de esta tanda, sin ir más
   * lejos— ninguna puede sacar una fila de otra hermandad.
   *
   * Si alguien la cambiara a permisiva, se sumaría con O y CADA HERMANDAD
   * VERÍA LAS DEMÁS: los censos, las cuentas y los datos de salud de todas.
   * Sin ningún error y sin que se note.
   */
  const aislamiento = await readFile('supabase/multi-hermandad.sql', 'utf8')
  caso('el aislamiento es restrictivo', true,
    /create policy "solo_mi_hermandad" on %I as restrictive/.test(aislamiento))
  caso('y también en la tabla de hermandades', true,
    /create policy "solo_mi_hermandad" on hermandades as restrictive/.test(aislamiento))
  // Y en el pegote que se ejecuta de verdad.
  caso('en TODO-EN-UNO.sql también', true, /as restrictive for all to public/.test(todo))
  // Nada de lo nuevo puede declararse restrictivo por error: eso cerraría
  // puertas en vez de abrirlas, y de forma difícil de diagnosticar.
  caso('lo nuevo no añade políticas restrictivas', false, /as restrictive/.test(sql))

  // Y volver a ejecutar el SQL no puede devolver permisos que la junta quitó.
  caso('no se resiembra encima de lo ya tocado', true,
    /if not exists \(select 1 from permisos_cargo where hermandad_id = h\)/.test(sql))

  await permisosQueSeRestablecian({ caso })
}

/**
 * EL BUG: cambias los permisos, le das a Guardar, sale el visto bueno verde…
 * y las casillas vuelven solas a como estaban.
 *
 * En la base se guardaban BIEN. Era la pantalla la que se pisaba a sí misma:
 *
 *  1. `usePermisosPorCargo` lee los permisos al abrir la pantalla y se los
 *     queda.
 *  2. Al guardar, Personal marca el formulario como «ya no tocado».
 *  3. Su efecto de sincronizar salta —porque esa marca ha cambiado— y vuelve a
 *     poner encima lo que el hook tiene guardado… que es de ANTES de guardar.
 *
 * El hook no se había enterado porque el evento `storage` del navegador solo
 * lo reciben las OTRAS pestañas: la que escribe nunca oye su propio cambio.
 */
async function permisosQueSeRestablecian({ caso }) {
  const { readFile } = await import('node:fs/promises')
  const permisos = await readFile('src/lib/permisos.ts', 'utf8')

  caso('al guardar se avisa a esta misma pestaña', true, /avisarDeQueCambiaron\(\)/.test(permisos))
  caso('y el aviso se manda de verdad', true,
    /window\.dispatchEvent\(new CustomEvent\(AVISO_CAMBIO\)\)/.test(permisos))
  caso('y el hook lo escucha', true,
    /window\.addEventListener\(AVISO_CAMBIO, alGuardar\)/.test(permisos))
  caso('y al oírlo relee lo guardado', true,
    /function alGuardar\(\) \{\s*setPermisos\(getPermisosPorCargo\(\)\)/.test(permisos))
  // Y se desengancha al salir: si no, cada visita a la pantalla deja un oyente
  // más y acaban actualizándose todos a la vez.
  caso('y se quita el oyente al salir', true,
    /removeEventListener\(AVISO_CAMBIO, alGuardar\)/.test(permisos))

  // La otra mitad, que ya estaba: lo que cambie en OTRA pestaña también entra.
  caso('lo de otras pestañas sigue entrando', true, /useEscuchaOtrasPestanas\(STORAGE_KEY/.test(permisos))

  // Y el efecto de Personal que causaba el pisotón sigue ahí, que es correcto:
  // lo que estaba mal no era sincronizar, era sincronizar con datos viejos.
  const pantalla = await readFile('src/pages/app/Personal.tsx', 'utf8')
  caso('Personal sigue sincronizando con lo remoto', true,
    /if \(!permisosTocado\) setPermisos\(permisosRemotos\)/.test(pantalla))
}
