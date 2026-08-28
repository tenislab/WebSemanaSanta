-- ============================================================================
--   UNA PERSONA, UNA FICHA — el cargo vive en la ficha del hermano
-- ============================================================================
--
-- EL PROBLEMA
--
--   Hasta ahora, el secretario de una hermandad existía DOS VECES: una como
--   hermano nº 47 en el censo, con sus cuotas y su papeleta, y otra como fila
--   en `personal` con su correo y su cargo. Dos fichas, dos claves, dos
--   maneras de entrar, y nada que las uniera salvo que se llamaban igual.
--
--   Eso no es una molestia de diseño: es la causa del fallo que se veía. Se
--   entraba con el correo, la aplicación miraba en `hermanos`, encontraba la
--   ficha y mandaba al área del hermano. Se entraba por el área del hermano y
--   no había forma de llegar al panel. La persona era la misma y el sistema no
--   lo sabía.
--
-- LO QUE HACE ESTE ARCHIVO
--
--   Pone el cargo EN LA FICHA DEL HERMANO. Una persona, una ficha, un número
--   de hermano, una clave. Si lleva cargo, además entra al panel y ve los
--   módulos de su cargo. Si no lo lleva, tiene su área y ya está.
--
--   La tabla `personal` NO se toca y NO se vacía: sigue existiendo para quien
--   trabaja en la hermandad sin ser hermano y ya estaba dado de alta ahí. Las
--   dos vías conviven. Todo lo que hay aquí SUMA con `or`; no sustituye nada.
--
-- LAS CUATRO COSAS QUE IMPORTAN, POR ORDEN
--
--   1. El trigger `hermanos_solo_personal_toca_el_cargo`. Sin él, esto abre la
--      base entera: cualquier hermano puede reescribir su propia ficha, así
--      que en cuanto `cargo` existe como columna, dos líneas en la consola del
--      navegador le convierten en Hermano Mayor. Es lo primero que se lee.
--   2. `auth_es_hermano()` cambia de significado, y con él las ~60 políticas
--      que empiezan por `not auth_es_hermano()`. Por eso hay que reescribir
--      las políticas «propio»: si no, un tesorero pierde su propia papeleta.
--   3. Las políticas `authenticated_all` se borran. Anulaban el filtro por
--      módulo en catorce tablas — el cargo era interfaz, no seguridad.
--   4. Los permisos de fábrica se ponen al día: la aplicación y la base decían
--      cosas distintas, y se notaba en «guardo y no se guarda».
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
--
--   Va EL ÚLTIMO de todos los archivos: redefine funciones que crean los
--   anteriores, y el que manda es el último que se ejecuta.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Las dos columnas nuevas
-- ----------------------------------------------------------------------------

-- `cargo` es text y no un enum a propósito: `personal.cargo` y
-- `permisos_cargo.cargo` ya son text, y el cruce que decide los permisos es
-- text contra text. Un enum obligaría a convertir en todas partes.
alter table hermanos add column if not exists cargo text;
alter table hermanos add column if not exists civil boolean not null default false;

comment on column hermanos.cargo is
  'Cargo en la junta, si lo lleva. NULL = hermano de a pie, que es lo normal. '
  'Cruza con permisos_cargo.cargo para decidir qué módulos toca. Solo lo puede '
  'cambiar quien tenga el módulo personal: lo vigila el trigger de más abajo.';

comment on column hermanos.civil is
  'Hermano civil: está en el censo y tiene su área, pero NO se le emiten cuotas. '
  'Para quien trabaja en la hermandad sin ser hermano. OJO: en el SQL esta columna '
  'no hace nada — no hay nada en la base que emita cuotas, las emite la aplicación. '
  'Si buscas aquí el filtro, no está: está en src/lib/cuotasEmision.ts (la emisión anual) '
  'y en el cajón de cuota suelta de src/pages/app/Cuotas.tsx.';

-- Para llevar cargo hace falta correo. No es burocracia: con cargo se entra al
-- panel, y el panel lo protegen las políticas, que preguntan por `auth.uid()`.
-- Sin correo no hay cuenta de Supabase, sin cuenta no hay `auth.uid()`, y sin
-- eso no hay ninguna protección del lado del servidor.
do $$
begin
  alter table hermanos add constraint hermanos_cargo_con_correo
    check (cargo is null or email <> '');
exception when duplicate_object then null;
end $$;

-- `modulo_permitido()` va a leer esto en CADA fila de CADA consulta.
create index if not exists hermanos_cargo_idx
  on hermanos (hermandad_id, cargo) where cargo is not null;

-- NO se pone un índice único sobre el correo, y conviene saber por qué para que
-- nadie lo «arregle»: en una hermandad es normalísimo que un padre apunte a sus
-- dos hijos menores con su propio correo, o que un matrimonio comparta el suyo.
-- Un único los dejaría fuera del censo.
--
-- Donde el correo sí tiene que ser único es en las CUENTAS, y de eso ya se
-- encarga Supabase: el segundo alta con el mismo correo falla, y la aplicación
-- lo explica en cristiano (src/lib/accesos.ts). Es decir: dos hermanos pueden
-- compartir correo mientras solo uno de ellos tenga cuenta.
create index if not exists hermanos_email_idx
  on hermanos (hermandad_id, lower(email)) where email <> '';


-- ----------------------------------------------------------------------------
-- 2. EL TRIGGER. Que nadie se ponga un cargo a sí mismo
-- ----------------------------------------------------------------------------
--
-- Esto es lo más importante del archivo.
--
-- `hermanos_propio_update` deja a cada hermano reescribir SU PROPIA FILA. Era
-- inofensivo mientras en esa fila no hubiera nada que diera poder: cambiarse
-- el teléfono no hace daño a nadie. Desde el momento en que existe `cargo`, un
-- hermano cualquiera puede abrir la consola del navegador y escribir:
--
--     supabase.from('hermanos').update({ cargo: 'Hermano Mayor' })
--             .eq('auth_user_id', <el suyo>)
--
-- y a partir de ahí ve el censo entero, la tesorería y los permisos de todos.
--
-- Postgres NO permite limitar columnas dentro de una política RLS: una política
-- deja pasar la fila entera o ninguna. Así que la única forma de proteger DOS
-- columnas de una fila que su dueño sí puede editar es un trigger.
--
-- POR QUÉ REVIERTE EN SILENCIO Y NO DA ERROR. Porque la aplicación manda
-- siempre la fila completa al guardar (supabaseSync.ts), así que un hermano que
-- cambia su teléfono manda también su `cargo` — el mismo que ya tenía. Si esto
-- lanzara una excepción, ese guardado normal fallaría y nadie entendería por
-- qué. Revirtiendo, el valor vuelve a ser el que era y no pasa nada. Quien SÍ
-- tiene derecho a cambiarlo no pasa por aquí.
create or replace function hermanos_solo_personal_toca_el_cargo() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- Sin sesión no es el navegador: es el editor SQL o una función interna, que
  -- ya han pasado por RLS (estas tablas solo abren a `authenticated`). Ahí no
  -- hay nada que proteger y estorbaría para arreglar datos a mano.
  if auth.uid() is null then return new; end if;

  -- Quien gestiona el censo o los cargos escribe la ficha entera. Son dos
  -- módulos y hacen falta los dos: «hermanos» es quien corrige una dirección,
  -- «personal» es quien reparte cargos. Si solo se pidiera «personal», la
  -- secretaria no podría ni cambiar un teléfono.
  if modulo_permitido('hermanos') or modulo_permitido('personal') then return new; end if;

  /*
   * A partir de aquí es el propio hermano escribiendo SU ficha, y solo puede
   * tocar lo suyo. LISTA BLANCA, no lista negra, y la diferencia es todo:
   *
   * Congelar solo `cargo` y `civil` no bastaba, y el agujero era de libro. La
   * única forma que tiene la base de quitarle el cargo a alguien es su
   * `estado`: tanto `auth_es_hermano()` como `modulo_permitido()` preguntan
   * por `estado <> 'Baja'`. Pero `estado` es una columna más de su fila, y RLS
   * no sabe de columnas. Así que al tesorero destituido le bastaba con una
   * línea desde la consola del navegador, con la sesión que ya tenía abierta:
   *
   *     supabase.from('hermanos').update({ estado: 'Activo' }).eq(...)
   *
   * El disparador miraba `cargo`, veía que no cambiaba, y dejaba pasar. En ese
   * instante recuperaba Tesorería, Cuotas, Inventario e Informes.
   *
   * Y de paso se cerraba lo mismo con `numero` (subirse en el escalafón),
   * `cuota_al_dia` (darse la cuota por pagada), `antiguedad` (ganar prioridad
   * al pedir papeleta) e `iban`.
   *
   * Lo que un hermano SÍ puede cambiar de su ficha es lo que ya declara
   * `contactoDelHermanoToRow` en la aplicación —sus datos de contacto—, su
   * foto y sus preferencias de aviso, más pedir la baja. Todo lo demás vuelve
   * a como estaba.
   */
  if tg_op = 'INSERT' then
    -- Un hermano no se da de alta a sí mismo: eso lo hace secretaría o el
    -- formulario público, que pasa por `solicitudes_alta`. Si aun así llegara
    -- aquí, entra sin nada que dé poder.
    new.cargo := null;
    new.civil := false;
    new.estado := 'Nuevo';
    new.numero := 0;
    new.cuota_al_dia := false;
    return new;
  end if;

  new.cargo := old.cargo;
  new.civil := old.civil;
  new.estado := old.estado;
  new.numero := old.numero;
  new.cuota_al_dia := old.cuota_al_dia;
  new.antiguedad := old.antiguedad;
  new.iban := old.iban;
  new.etiquetas := old.etiquetas;
  new.tutor_id := old.tutor_id;
  new.dni := old.dni;
  new.hermandad_id := old.hermandad_id;
  new.auth_user_id := old.auth_user_id;
  return new;
end $$;

drop trigger if exists hermanos_solo_personal_toca_el_cargo on hermanos;
create trigger hermanos_solo_personal_toca_el_cargo
  before insert or update on hermanos
  for each row execute function hermanos_solo_personal_toca_el_cargo();

comment on function hermanos_solo_personal_toca_el_cargo() is
  'Lista blanca de lo que un hermano puede cambiar de SU PROPIA ficha: contacto, foto, '
  'preferencias de aviso y pedir la baja. Todo lo que da poder o posición —cargo, civil, '
  'estado, numero, cuota_al_dia, antiguedad, iban, etiquetas, dni— vuelve a su valor '
  'anterior. Quien lleva el módulo hermanos o el de personal escribe la ficha entera. '
  'Revierte en vez de fallar porque la aplicación manda la fila completa en cada guardado.';


-- ----------------------------------------------------------------------------
-- 3. Quién gestiona: las tres funciones que lo deciden
-- ----------------------------------------------------------------------------

-- `auth_es_hermano()` significa «esta cuenta es SOLO de hermano», y es la que
-- abre y cierra todas las políticas de gestión (todas empiezan por
-- `not auth_es_hermano()`). Añadirle la cuarta condición es lo que hace que un
-- hermano con cargo entre al panel: se vuelve falso para él, y las ~60
-- políticas se adaptan solas sin tocar ni una.
--
-- 'Hermano de a pie' se excluye a propósito. Ese cargo no tiene módulos, así
-- que quien lo llevara se quedaría en tierra de nadie: fuera de las políticas
-- de hermano por tener cargo, y sin ningún módulo por no tener permisos. Sin
-- acceso a nada. La aplicación no lo ofrece al poner un cargo, pero si algún
-- día se cuela, aquí no hace daño.
create or replace function auth_es_hermano() returns boolean
  language sql stable security definer set search_path = public as $$
    select
      exists (select 1 from hermanos where auth_user_id = auth.uid())
      and not exists (select 1 from titulares where auth_user_id = auth.uid())
      and not exists (select 1 from personal where auth_user_id = auth.uid() and activo)
      and not exists (
        select 1 from hermanos
        where auth_user_id = auth.uid()
          and cargo is not null
          and cargo <> 'Hermano de a pie'
          and estado <> 'Baja'
      )
  $$;
grant execute on function auth_es_hermano() to anon, authenticated;

comment on function auth_es_hermano() is
  'Cierto solo si la cuenta es EXCLUSIVAMENTE de hermano: tiene ficha en el censo y '
  'no está en titulares, ni es personal activo, ni lleva cargo en su propia ficha. '
  'Hay TRES formas de gestionar: ser el titular, estar en personal, o llevar cargo '
  'en la ficha. Esta última es la nueva y la que se recomienda.';

-- `modulo_permitido()` es la que decide, módulo a módulo, quién escribe. Tercera
-- rama con `or`: las otras dos NO se tocan, porque la junta que hoy entra por
-- `personal` tiene que seguir entrando.
create or replace function modulo_permitido(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select
      es_titular()
      or exists (
        select 1 from personal p
        join permisos_cargo pc
          on pc.cargo = p.cargo and pc.hermandad_id = p.hermandad_id
        where p.auth_user_id = auth.uid() and p.activo and pc.modulo_id = p_modulo
      )
      -- NUEVO: el cargo en la ficha del hermano.
      or exists (
        select 1 from hermanos h
        join permisos_cargo pc
          -- `pc.hermandad_id = h.hermandad_id` no es opcional: los permisos de
          -- una hermandad no valen dentro de otra.
          on pc.cargo = h.cargo and pc.hermandad_id = h.hermandad_id
        where h.auth_user_id = auth.uid()
          and h.cargo is not null
          -- Un hermano de baja no sigue llevando la tesorería.
          and h.estado <> 'Baja'
          and pc.modulo_id = p_modulo
      )
  $$;
grant execute on function modulo_permitido(text) to authenticated;

comment on function modulo_permitido(text) is
  'Tres vías, sumadas con OR: el titular lo puede todo; el personal activo, lo de su '
  'cargo; y el hermano con cargo en su ficha, lo de su cargo. Hay CUATRO definiciones '
  'de esta función en el repositorio (schema.sql, rls-cargos.sql, rls-endurecer.sql y '
  'permisos-por-hermandad.sql) y la que manda es ESTA, que es la última que se ejecuta.';

-- `auth_es_personal()` responde «¿esta cuenta gestiona?». No la usa ninguna
-- política, pero la aplicación puede preguntarla por RPC y quedaría siendo el
-- único sitio del SQL que dice que un hermano con cargo no gestiona.
create or replace function auth_es_personal() returns boolean
  language sql stable security definer set search_path = public as $$
    select
      es_titular()
      or exists (select 1 from personal where auth_user_id = auth.uid() and activo)
      or exists (
        select 1 from hermanos
        where auth_user_id = auth.uid()
          and cargo is not null and cargo <> 'Hermano de a pie'
          and estado <> 'Baja'
      )
  $$;
grant execute on function auth_es_personal() to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Las políticas «propio»: que quien gestiona no pierda lo suyo
-- ----------------------------------------------------------------------------
--
-- Este es el efecto de segundo orden más caro del cambio, y el que no se ve
-- venir.
--
-- Al volverse `auth_es_hermano()` falso para el hermano con cargo, dejan de
-- aplicarle todas las políticas escritas como `auth_es_hermano() and lo mío`.
-- Casi todas quedan cubiertas por las de gestión, que abren más. Pero DOS no:
--
--   · `papeletas_propio_insert` — un Tesorero/a no tiene de fábrica el módulo
--     «papeletas», así que se quedaría sin poder sacar SU PROPIA papeleta.
--   · `cuotas_propio_aviso_pago` — ni podría avisar de que ha pagado la suya.
--
-- Y lo peor no es que falle: es que NO falla. Un insert bloqueado por RLS no
-- da error en Postgres, actualiza cero filas. La pantalla diría que todo ha ido
-- bien y la papeleta no existiría. Eso se descubre en la puerta de la iglesia
-- el Domingo de Ramos.
--
-- El arreglo es quitar el `auth_es_hermano()` de todas ellas y dejar solo la
-- comprobación de que la fila es suya. No abre nada de más: `hermano_propio_id()`
-- devuelve NULL para quien no tiene ficha, y `columna = NULL` no es cierto para
-- ninguna fila.

-- Su ficha del censo.
drop policy if exists "hermanos_propio_select" on hermanos;
create policy "hermanos_propio_select" on hermanos for select to authenticated
  using (auth_user_id = auth.uid());
-- El `cargo` y el `civil` de esta fila los protege el trigger de arriba, no
-- esta política: RLS no sabe de columnas.
drop policy if exists "hermanos_propio_update" on hermanos;
create policy "hermanos_propio_update" on hermanos for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Sus cuotas: verlas, y avisar de que ha pagado.
drop policy if exists "cuotas_propio_select" on cuotas;
create policy "cuotas_propio_select" on cuotas for select to authenticated
  using (hermano_id = hermano_propio_id());
drop policy if exists "cuotas_propio_aviso_pago" on cuotas;
create policy "cuotas_propio_aviso_pago" on cuotas for update to authenticated
  using (hermano_id = hermano_propio_id())
  with check (hermano_id = hermano_propio_id());

-- Su papeleta: verla, pedirla y renunciar a ella.
drop policy if exists "papeletas_propio_select" on papeletas;
create policy "papeletas_propio_select" on papeletas for select to authenticated
  using (hermano_id = hermano_propio_id());
drop policy if exists "papeletas_propio_insert" on papeletas;
create policy "papeletas_propio_insert" on papeletas for insert to authenticated
  with check (hermano_id = hermano_propio_id());
drop policy if exists "papeletas_propio_update" on papeletas;
create policy "papeletas_propio_update" on papeletas for update to authenticated
  using (hermano_id = hermano_propio_id())
  with check (hermano_id = hermano_propio_id());

-- Sus avisos.
drop policy if exists "avisos_propio_select" on avisos_hermano;
create policy "avisos_propio_select" on avisos_hermano for select to authenticated
  using (hermano_id = hermano_propio_id());
drop policy if exists "avisos_propio_leido" on avisos_hermano;
create policy "avisos_propio_leido" on avisos_hermano for update to authenticated
  using (hermano_id = hermano_propio_id())
  with check (hermano_id = hermano_propio_id());

-- Los suyos: los hijos menores de los que es tutor.
drop policy if exists "hermanos_a_mi_cargo_select" on hermanos;
create policy "hermanos_a_mi_cargo_select" on hermanos for select to authenticated
  using (tutor_id = hermano_propio_id());

-- Los tramos y la agenda: los ve cualquiera que haya entrado, con cargo o sin
-- él. `solo_mi_hermandad` ya se encarga de que sean los de su hermandad.
drop policy if exists "tramos_hermano_select" on tramos;
create policy "tramos_hermano_select" on tramos for select to authenticated
  using (true);
drop policy if exists "eventos_hermano_select" on eventos;
create policy "eventos_hermano_select" on eventos for select to authenticated
  using (true);


-- ----------------------------------------------------------------------------
-- 5. Borrar `authenticated_all`: el filtro por módulo estaba anulado
-- ----------------------------------------------------------------------------
--
-- Esto es un agujero que YA ESTABA, y que este cambio convierte en grave.
--
-- `hermano-auth.sql` crea sobre catorce tablas una política llamada
-- `authenticated_all` que dice solo `not auth_es_hermano()`: sin módulo, sin
-- nada. Y nadie la borra después. Las políticas PERMISSIVE de Postgres se
-- suman con O, así que basta con que una abra para que la fila pase.
--
-- Consecuencia: hasta hoy, cualquier cuenta de gestión escribía en las catorce
-- tablas por mucho que su cargo no tuviera el módulo. «El cargo decide qué
-- módulos ve» era cierto en el menú y falso en la base de datos. Con hermanos
-- llevando cargo, por ahí va a pasar mucha más gente.
--
-- Se borran. Lo que queda son las políticas `_staff_*` de `schema.sql`, que sí
-- exigen `modulo_permitido`.
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'hermandad_settings', 'tramos', 'movimientos', 'incidencias', 'enseres',
      'documentos', 'comunicados', 'cuentas_sociales', 'personal',
      'permisos_cargo', 'solicitudes_alta', 'conceptos_cuota',
      'opciones_papeleta', 'catalogos', 'hermanos', 'cuotas', 'papeletas'
    ])
  loop
    execute format('drop policy if exists "authenticated_all" on %I', t);
  end loop;
end $$;

-- Las tres hermanas de `authenticated_all`, del mismo archivo y con el mismo
-- problema: abren las tres tablas grandes sin mirar el módulo.
drop policy if exists "hermanos_personal_all" on hermanos;
drop policy if exists "cuotas_personal_all" on cuotas;
drop policy if exists "papeletas_personal_all" on papeletas;

-- Y las de gestión que sí miran el módulo, por si esta base se montó con una
-- versión antigua que no llegó a crearlas.
/*
 * LEER EL CENSO YA NO ES GRATIS, y esto es lo que más cambia de todo el
 * archivo para las hermandades que ya están funcionando.
 *
 * Hasta ahora, `hermanos_staff_select` era `not auth_es_hermano()` y nada más:
 * quien entrara al panel se llevaba el censo entero. El insert, el update y el
 * delete de al lado sí exigen el módulo; la lectura, no. Se quedó así de
 * cuando el panel lo abrían seis personas nombradas a dedo.
 *
 * Con los cargos en la ficha, «entrar al panel» deja de ser cosa de seis
 * personas nombradas a dedo: pasa a serlo de cualquiera a quien se le ponga un
 * cargo. Y a cualquiera de ellos le bastaba con escribir esto en la consola
 * del navegador, con la clave pública que viaja en el JavaScript de la web:
 *
 *     await supabase.from('hermanos').select('*')
 *
 * y bajarse las ochocientas filas con DNI, dirección, teléfono, IBAN, notas de
 * salud, fecha de nacimiento y parroquia de bautismo. Salud y convicciones
 * religiosas: categoría especial del RGPD por partida doble. El menú no le
 * enseñaba «Hermanos» y la aplicación le rebotaba a Inicio si tecleaba la
 * dirección, pero eso era pintura: la puerta de la base estaba abierta.
 *
 * Ahora hace falta uno de los módulos que de verdad necesitan el censo. No
 * solo «hermanos»: Cuotas necesita saber a quién es el recibo, Cortejo a quién
 * es el sitio, Papeletas a quién es la papeleta, e Informes imprime el padrón.
 *
 * LO QUE ESTO CAMBIA EN PANTALLA: nada, si la hermandad usa los cargos de
 * fábrica. Los SIETE de la junta llevan al menos uno de esos módulos —el
 * Fiscal y el Vocal entran por «informes», el Tesorero/a por «cuotas», el
 * Mayordomo/Prioste por «cortejo»— así que ninguno pierde nada.
 *
 * Solo cambia para un cargo al que se le hayan quitado a mano TODOS ellos y se
 * le hayan dejado únicamente módulos que no necesitan el censo (tesorería,
 * inventario, archivo, eventos, web o configuración). Ese caso es raro, y es
 * justo el que había que cerrar: no hay razón para que quien lleva el
 * inventario pueda descargarse ochocientos DNI.
 *
 * Hay una prueba (pruebas/cargos.prueba.mjs) que comprueba que ningún cargo de
 * fábrica se queda fuera, para que ampliar la lista de módulos de un cargo no
 * le corte el censo sin querer.
 */
drop policy if exists "hermanos_staff_select" on hermanos;
create policy "hermanos_staff_select" on hermanos for select to authenticated
  using (
    not auth_es_hermano()
    and (
      modulo_permitido('hermanos')
      or modulo_permitido('cuotas')
      or modulo_permitido('papeletas')
      or modulo_permitido('cortejo')
      or modulo_permitido('informes')
      or modulo_permitido('comunicados')
      -- «Personal y permisos» también: es la pantalla que enseña qué hermanos
      -- llevan cargo, y sin leer el censo saldría vacía.
      or modulo_permitido('personal')
    )
  );
drop policy if exists "hermanos_staff_insert" on hermanos;
create policy "hermanos_staff_insert" on hermanos for insert to authenticated
  with check (not auth_es_hermano() and modulo_permitido('hermanos'));
drop policy if exists "hermanos_staff_update" on hermanos;
create policy "hermanos_staff_update" on hermanos for update to authenticated
  using (not auth_es_hermano() and modulo_permitido('hermanos'))
  with check (not auth_es_hermano() and modulo_permitido('hermanos'));
drop policy if exists "hermanos_staff_delete" on hermanos;
create policy "hermanos_staff_delete" on hermanos for delete to authenticated
  using (not auth_es_hermano() and modulo_permitido('hermanos'));


-- ----------------------------------------------------------------------------
-- 5 bis. Las otras dos tablas que cualquiera podía leer
-- ----------------------------------------------------------------------------
--
-- Mismo problema que el censo, misma causa: las políticas de LECTURA de todas
-- las tablas de gestión son `not auth_es_hermano()` a secas. Solo la escritura
-- mira el módulo.
--
-- En la mayoría de las tablas eso es discutible pero no grave: un Vocal
-- leyendo la lista de enseres o los tramos del cortejo no rompe nada. En dos
-- sí lo es, y son justo las dos que guardan lo que una hermandad no enseña:
--
--   · `movimientos` — el libro de tesorería entero, ingresos y gastos con sus
--     conceptos. Lo que se cobra, lo que se paga y a quién.
--   · `documentos` — el archivo: actas de cabildo, contratos, expedientes.
--
-- Las escrituras ya pedían su módulo. Ahora la lectura también.
drop policy if exists "movimientos_staff_select" on movimientos;
create policy "movimientos_staff_select" on movimientos for select to authenticated
  using (not auth_es_hermano() and (modulo_permitido('tesoreria') or modulo_permitido('informes')));

drop policy if exists "documentos_staff_select" on documentos;
create policy "documentos_staff_select" on documentos for select to authenticated
  using (not auth_es_hermano() and modulo_permitido('archivo'));


-- ----------------------------------------------------------------------------
-- 6. Los permisos de fábrica, al día
-- ----------------------------------------------------------------------------
--
-- La aplicación y la base decían cosas distintas, y llevaban así desde que se
-- añadió el módulo de eventos. `PERMISOS_POR_DEFECTO` (src/lib/permisos.ts) da
-- al Hermano Mayor los TRECE módulos; la siembra de la base le daba once: le
-- faltaban «eventos» y «web».
--
-- El síntoma era de los peores: el menú enseña «Eventos y tareas», se entra, se
-- crea un culto, se le da a guardar, no se guarda y no hay ningún mensaje. La
-- política dice que no y la pantalla no se entera.
--
-- Esta siembra es ahora la copia exacta de PERMISOS_POR_DEFECTO. Si se cambia
-- una, hay que cambiar la otra; hay una prueba que lo comprueba
-- (pruebas/roles.prueba.mjs) para que no vuelva a separarse.
create or replace function sembrar_permisos_de_fabrica(p_hermandad_id uuid) returns void
  language sql security definer set search_path = public as $$
    insert into permisos_cargo (hermandad_id, cargo, modulo_id)
    select p_hermandad_id, cargo, modulo_id from (values
      ('Hermano Mayor','hermanos'),('Hermano Mayor','cortejo'),('Hermano Mayor','cuotas'),
      ('Hermano Mayor','papeletas'),('Hermano Mayor','tesoreria'),('Hermano Mayor','inventario'),
      ('Hermano Mayor','archivo'),('Hermano Mayor','eventos'),('Hermano Mayor','comunicados'),
      ('Hermano Mayor','informes'),('Hermano Mayor','web'),('Hermano Mayor','personal'),
      ('Hermano Mayor','configuracion'),('Hermano Mayor','campanas'),
      ('Secretario/a','hermanos'),('Secretario/a','cortejo'),('Secretario/a','papeletas'),
      ('Secretario/a','archivo'),('Secretario/a','eventos'),('Secretario/a','comunicados'),
      ('Secretario/a','informes'),('Secretario/a','web'),('Secretario/a','campanas'),
      ('Tesorero/a','tesoreria'),('Tesorero/a','cuotas'),('Tesorero/a','inventario'),
      ('Tesorero/a','informes'),('Tesorero/a','campanas'),
      ('Fiscal','archivo'),('Fiscal','informes'),
      ('Mayordomo/Prioste','cortejo'),('Mayordomo/Prioste','inventario'),
      ('Mayordomo/Prioste','eventos'),('Mayordomo/Prioste','informes'),
      ('Mayordomo/Prioste','campanas'),
      ('Diputado/a Mayor de Gobierno','hermanos'),('Diputado/a Mayor de Gobierno','cortejo'),
      ('Diputado/a Mayor de Gobierno','papeletas'),('Diputado/a Mayor de Gobierno','eventos'),
      ('Diputado/a Mayor de Gobierno','informes'),
      ('Vocal','eventos'),('Vocal','comunicados'),('Vocal','informes')
    ) as f(cargo, modulo_id)
    on conflict do nothing
  $$;
revoke execute on function sembrar_permisos_de_fabrica(uuid) from public;
revoke execute on function sembrar_permisos_de_fabrica(uuid) from anon, authenticated;

-- 'Hermano de a pie' no se siembra a propósito: no tiene módulos. Ponérselo a
-- alguien sería darle una cuenta de panel que no ve nada.

-- Y se rellena lo que falte en las hermandades que ya existen. `on conflict do
-- nothing` dentro de la función: lo que cada hermandad haya cambiado a mano se
-- respeta, esto solo añade lo que nunca estuvo.
/*
 * Y se rellena SOLO en las hermandades que no han tocado nunca sus permisos.
 *
 * El `on conflict do nothing` de dentro no basta, y esto es importante:
 * `guardarPermisosPorCargoRemoto` guarda borrando las filas y reinsertando
 * solo lo marcado, así que un módulo DESMARCADO es una fila ausente —
 * exactamente igual que un módulo que nunca estuvo. La siembra no puede
 * distinguirlos.
 *
 * Sin esta comprobación, una hermandad que le hubiera quitado «cuotas» al
 * Tesorero/a a propósito se lo encontraría puesto otra vez cada vez que
 * alguien vuelve a ejecutar el SQL — y la cabecera promete que ejecutarlo dos
 * veces es seguro. Nadie recibiría ningún aviso.
 */
do $$
declare h uuid;
begin
  for h in select id from hermandades loop
    if not exists (select 1 from permisos_cargo where hermandad_id = h) then
      perform sembrar_permisos_de_fabrica(h);
    end if;
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 7. Aviso para quien venga después
-- ----------------------------------------------------------------------------
--
-- SECURITY DEFINER no se salta las políticas por sí solo. Funciona porque el
-- dueño de estas funciones (`postgres`) es también el dueño de las tablas, y el
-- dueño de una tabla está exento de sus políticas MIENTRAS no se active
-- `force row level security`.
--
-- Varias guías de endurecimiento de Supabase recomiendan activarlo. Si alguien
-- ejecuta `alter table hermanos force row level security`, TODAS estas
-- funciones entran en recursión infinita de golpe: `auth_es_hermano()` lee
-- `hermanos`, cuya política llama a `auth_es_hermano()`. Lo mismo con
-- `hermandad_actual()`, `hermano_propio_id()` y el `modulo_permitido()` de
-- aquí arriba.
--
-- Si hace falta activarlo algún día, hay que crear antes un rol propio para
-- estas funciones y darle `bypassrls`.
