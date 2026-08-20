-- =============================================================================
--
--   CABILDO — UN SOLO SUPABASE PARA TODAS LAS HERMANDADES
--
-- =============================================================================
--
-- Hasta ahora: un proyecto de Supabase por hermandad. Ninguna tabla sabía de
-- quién era cada fila, porque no hacía falta: todo lo que había dentro era de
-- la única hermandad del proyecto.
--
-- A partir de aquí, todas caben en el mismo proyecto y **ninguna ve nada de
-- las demás**. Con datos de un censo de hermandad —que revelan convicciones
-- religiosas, categoría especial del RGPD— eso no es un detalle: es la
-- diferencia entre poder venderlo y no poder.
--
-- CÓMO FUNCIONA, EN CORTO:
--
--   · Cada tabla lleva `hermandad_id`.
--   · `hermandad_actual()` dice a qué hermandad pertenece quien está pidiendo
--     los datos, mirando su cuenta (titular, personal o hermano).
--   · Las políticas dejan ver y tocar SOLO las filas de esa hermandad.
--   · El `hermandad_id` se rellena SOLO al insertar (valor por defecto), así
--     que la aplicación no tiene que acordarse de ponerlo en cada llamada.
--     Eso es lo que impide el fallo clásico: olvidarlo una vez y filtrar.
--
-- ORDEN: ejecutar DESPUÉS de TODO-EN-UNO.sql.
-- Es seguro volver a ejecutarlo.
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. LAS HERMANDADES
-- -----------------------------------------------------------------------------

create table if not exists hermandades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  -- `activa` en falso la retira de la lista donde un hermano elige su
  -- hermandad para entrar, sin borrar nada. Es lo que hace falta cuando una
  -- deja el servicio: sus datos siguen ahí mientras se los descarga.
  activa boolean not null default true,
  creada_en timestamptz not null default now()
);
-- La dirección de su web pública NO va aquí: vive en `web_publica.slug`, que
-- es donde la edita quien la lleva. Tenerla en dos sitios acaba en dos slugs
-- distintos y en una web que no abre.
alter table hermandades drop column if exists slug;
alter table hermandades enable row level security;


-- -----------------------------------------------------------------------------
-- 2. QUIÉN PERTENECE A QUÉ HERMANDAD
-- -----------------------------------------------------------------------------
-- Hay tres formas de pertenecer a una hermandad: llevarla (`titulares`),
-- trabajar en ella (`personal`) o ser hermano (`hermanos`). Las tres tablas
-- ganan `hermandad_id` aquí, antes que nada, porque `hermandad_actual()` —que
-- viene justo después— las consulta para saber de quién es cada petición.
--
-- Un mismo correo NO puede ser titular de dos hermandades: si alguien lleva
-- dos, usa dos cuentas. Es más simple de entender y de auditar, que es lo que
-- importa aquí.

alter table titulares add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table personal  add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table hermanos  add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;


-- El correo del personal era único en TODA la tabla: con varias hermandades,
-- dos pueden tener un tesorero llamado igual. Pasa a ser único por hermandad.
alter table personal drop constraint if exists personal_email_key;
create unique index if not exists personal_email_por_hermandad on personal (hermandad_id, email);

-- `hermandad_actual()` consulta estas tres columnas en CADA petición que llega.
-- `titulares` y `hermanos` ya venían indexadas; `personal` no, y sin esto cada
-- consulta de un miembro del personal recorría la tabla entera.
create index if not exists personal_auth_user_id_idx on personal (auth_user_id);


-- -----------------------------------------------------------------------------
-- 3. `hermandad_actual()` — LA PIEZA CENTRAL
-- -----------------------------------------------------------------------------
-- Devuelve la hermandad de quien está haciendo la petición, mirando su cuenta.
-- Es SECURITY DEFINER porque tiene que consultar tablas que están protegidas
-- justamente por ella: sin eso, la comprobación se muerde la cola.
--
-- Si la cuenta no pertenece a ninguna hermandad, devuelve NULL, y entonces
-- ninguna política deja pasar nada. Cerrado por defecto, que es como tiene que
-- estar: un fallo aquí no puede acabar en «lo ve todo».

create or replace function hermandad_actual() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select t.hermandad_id from titulares t where t.auth_user_id = auth.uid()),
    (select p.hermandad_id from personal  p where p.auth_user_id = auth.uid() and p.activo),
    (select h.hermandad_id from hermanos  h where h.auth_user_id = auth.uid())
  )
$$;
grant execute on function hermandad_actual() to authenticated, anon;


-- -----------------------------------------------------------------------------
-- 4. `hermandad_id` EN TODAS LAS TABLAS DE DATOS
-- -----------------------------------------------------------------------------
-- Con valor por defecto `hermandad_actual()`: la aplicación inserta como
-- siempre y la columna se rellena sola. Es lo que evita el fallo de olvidarse
-- de ponerlo en una llamada de cincuenta y filtrar datos sin enterarse.

do $$
declare t text;
begin
  foreach t in array array[
    'hermanos', 'tramos', 'cuotas', 'papeletas', 'movimientos', 'incidencias',
    'enseres', 'documentos', 'comunicados', 'cuentas_sociales', 'permisos_cargo',
    'solicitudes_alta', 'conceptos_cuota', 'opciones_papeleta', 'catalogos',
    'eventos',
    -- `personal` también: sin valor por defecto, cuando un titular da de alta
    -- a su tesorero la fila entra sin hermandad y la frontera la rechaza. O
    -- sea, no podría añadir a nadie a su junta.
    'personal'
  ]
  loop
    execute format(
      'alter table %I add column if not exists hermandad_id uuid references hermandades(id) on delete cascade',
      t
    );
    execute format('alter table %I alter column hermandad_id set default hermandad_actual()', t);
    execute format('create index if not exists %I on %I (hermandad_id)', t || '_hermandad_idx', t);
  end loop;
end $$;

-- El DNI del hermano era único en toda la tabla. Con varias hermandades, la
-- misma persona puede ser hermana de dos: pasa a ser único POR hermandad.
alter table hermanos drop constraint if exists hermanos_dni_key;
create unique index if not exists hermanos_dni_por_hermandad on hermanos (hermandad_id, dni);

-- Lo mismo con el número de hermano: cada hermandad tiene su nº 1.
drop index if exists hermanos_numero_activo_uniq;
create unique index if not exists hermanos_numero_por_hermandad
  on hermanos (hermandad_id, numero) where numero > 0;


-- -----------------------------------------------------------------------------
-- 5. LOS AJUSTES Y LA WEB, UNA FILA POR HERMANDAD
-- -----------------------------------------------------------------------------
-- Las dos estaban forzadas a UNA sola fila: `id` era la clave primaria con
-- valor fijo 1 (y `hermandad_settings` además lo comprobaba). Con varias
-- hermandades hacen falta varias filas, así que `id` deja de valer siempre 1 y
-- pasa a contar solo (1, 2, 3...). Quien manda ahora es `hermandad_id`, con un
-- índice único: **una fila de ajustes y una web por hermandad, ni más ni una
-- menos**. La fila que ya existiera se queda con su id 1 y no se toca.

create sequence if not exists hermandad_settings_id_seq as smallint owned by hermandad_settings.id;
alter table hermandad_settings add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table hermandad_settings alter column hermandad_id set default hermandad_actual();
alter table hermandad_settings drop constraint if exists hermandad_settings_id_check;
alter table hermandad_settings alter column id set default nextval('hermandad_settings_id_seq');
create unique index if not exists hermandad_settings_por_hermandad on hermandad_settings (hermandad_id);

create sequence if not exists web_publica_id_seq as integer owned by web_publica.id;
alter table web_publica add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table web_publica alter column hermandad_id set default hermandad_actual();
alter table web_publica alter column id set default nextval('web_publica_id_seq');
create unique index if not exists web_publica_por_hermandad on web_publica (hermandad_id);

-- Si ya había filas de antes (la hermandad única del proyecto viejo), el
-- contador tiene que arrancar por encima de ellas o el siguiente insert choca.
do $$
begin
  perform setval('hermandad_settings_id_seq', greatest(coalesce((select max(id) from hermandad_settings), 0), 1));
  perform setval('web_publica_id_seq',        greatest(coalesce((select max(id) from web_publica), 0), 1));
end $$;

alter table mensajes_web add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
create index if not exists mensajes_web_hermandad_idx on mensajes_web (hermandad_id);


-- -----------------------------------------------------------------------------
-- 6. LA FRONTERA ENTRE HERMANDADES
-- -----------------------------------------------------------------------------
-- Aquí está TODO el aislamiento, y está en un solo sitio a propósito.
--
-- El esquema base ya trae sus políticas y son buenas: dicen quién puede tocar
-- qué según su cargo (`modulo_permitido`) y qué puede ver un hermano de lo
-- suyo. Lo único que no sabían es que ahora hay más de una hermandad.
--
-- La tentación es añadir otra política que diga «y además, de tu hermandad».
-- **No funcionaría, y es el error clásico**: las políticas normales de
-- Postgres (PERMISSIVE) se suman con O. Añadir una nunca quita permisos; solo
-- abre otra puerta. Con una política de más, cualquiera seguiría viéndolo todo.
--
-- Lo que sí funciona es una política RESTRICTIVE: esas se suman con Y. Se
-- aplican SIEMPRE, encima de todas las demás, y ninguna política nueva —ni una
-- que se añada dentro de un año sin acordarse de esto— puede saltársela.
--
-- Queda así, y es fácil de auditar:
--
--   · Las políticas del esquema base dicen QUÉ CLASE de acceso tiene cada uno.
--   · `solo_mi_hermandad` dice DE QUIÉN son las filas. Una por tabla.
--
-- Si `hermandad_actual()` devuelve NULL —una cuenta recién registrada que
-- todavía no tiene hermandad—, la comparación no es cierta y no pasa nada.
-- Cerrado por defecto.

do $$
declare t text;
begin
  foreach t in array array[
    'hermanos', 'tramos', 'cuotas', 'papeletas', 'movimientos', 'incidencias',
    'enseres', 'documentos', 'comunicados', 'cuentas_sociales', 'permisos_cargo',
    'conceptos_cuota', 'opciones_papeleta', 'catalogos', 'eventos',
    'hermandad_settings', 'personal', 'titulares'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "solo_mi_hermandad" on %I', t);
    execute format(
      'create policy "solo_mi_hermandad" on %I as restrictive for all to public
         using (hermandad_id = hermandad_actual())
         with check (hermandad_id = hermandad_actual())',
      t
    );
  end loop;
end $$;

-- La tabla de hermandades: cada cual, la suya. La lista completa no la ve
-- nadie desde el navegador; saber qué hermandades hay dadas de alta no es
-- asunto de sus hermanos.
alter table hermandades enable row level security;
drop policy if exists "solo_mi_hermandad" on hermandades;
create policy "solo_mi_hermandad" on hermandades as restrictive for all to public
  using (id = hermandad_actual()) with check (id = hermandad_actual());
drop policy if exists "mi_hermandad_select" on hermandades;
create policy "mi_hermandad_select" on hermandades for select to authenticated
  using (id = hermandad_actual());

-- --- Las tres tablas que tienen trato con la calle -------------------------
-- Estas no pueden llevar la regla tal cual, porque parte de su sentido es que
-- alguien SIN sesión las use. Se les pone la misma frontera, pero abriendo lo
-- justo por donde tiene que entrar el visitante.

-- La web publicada la lee cualquiera: para eso está publicada. Lo demás
-- (crearla, editarla, borrarla) solo su hermandad.
drop policy if exists "solo_mi_hermandad" on web_publica;
create policy "solo_mi_hermandad" on web_publica as restrictive for select to public
  using (publicada = true or hermandad_id = hermandad_actual());
drop policy if exists "solo_mi_hermandad_cambios" on web_publica;
create policy "solo_mi_hermandad_cambios" on web_publica as restrictive for update to public
  using (hermandad_id = hermandad_actual()) with check (hermandad_id = hermandad_actual());
drop policy if exists "solo_mi_hermandad_borrado" on web_publica;
create policy "solo_mi_hermandad_borrado" on web_publica as restrictive for delete to public
  using (hermandad_id = hermandad_actual());
drop policy if exists "solo_mi_hermandad_alta" on web_publica;
create policy "solo_mi_hermandad_alta" on web_publica as restrictive for insert to public
  with check (hermandad_id = hermandad_actual());
drop policy if exists "el personal edita la web" on web_publica;
create policy "el personal edita la web" on web_publica for all to authenticated
  using (not auth_es_hermano()) with check (not auth_es_hermano());

-- El buzón de los formularios y las solicitudes de alta: el visitante DEJA
-- algo desde la web pública sin haber iniciado sesión, así que al entrar solo
-- se le exige decir de qué hermandad es. Leerlo, esa hermandad y nadie más.
do $$
declare t text;
begin
  foreach t in array array['mensajes_web', 'solicitudes_alta']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "solo_mi_hermandad" on %I', t);
    execute format('create policy "solo_mi_hermandad" on %I as restrictive for select to public
        using (hermandad_id = hermandad_actual())', t);
    execute format('drop policy if exists "solo_mi_hermandad_cambios" on %I', t);
    execute format('create policy "solo_mi_hermandad_cambios" on %I as restrictive for update to public
        using (hermandad_id = hermandad_actual()) with check (hermandad_id = hermandad_actual())', t);
    execute format('drop policy if exists "solo_mi_hermandad_borrado" on %I', t);
    execute format('create policy "solo_mi_hermandad_borrado" on %I as restrictive for delete to public
        using (hermandad_id = hermandad_actual())', t);
    -- Al entrar: hay que decir de quién es. Sin esto, un formulario público
    -- dejaría filas huérfanas que no vería ni gestionaría nunca nadie.
    execute format('drop policy if exists "con_hermandad_al_entrar" on %I', t);
    execute format('create policy "con_hermandad_al_entrar" on %I as restrictive for insert to public
        with check (hermandad_id is not null)', t);
  end loop;
end $$;

drop policy if exists "el visitante deja mensajes" on mensajes_web;
create policy "el visitante deja mensajes" on mensajes_web for insert to anon, authenticated
  with check (true);
drop policy if exists "alta anonima" on solicitudes_alta;
create policy "alta anonima" on solicitudes_alta for insert to anon, authenticated
  with check (true);


-- -----------------------------------------------------------------------------
-- 7. LO QUE UN HERMANO NECESITA DE LO COMÚN
-- -----------------------------------------------------------------------------
-- El esquema base ya le da su ficha, sus cuotas y sus papeletas. Le faltaban
-- dos cosas que no son de nadie en particular y sin las cuales su área se ve a
-- medias: los tramos (para saber dónde va en el cortejo) y los eventos (su
-- calendario). No son datos personales de otros hermanos.
--
-- Ojo: aquí NO hace falta repetir «y de mi hermandad». De eso ya se encarga
-- `solo_mi_hermandad`, y ponerlo en dos sitios haría creer que la frontera
-- vive en las políticas normales, que es justo lo que no queremos.

drop policy if exists "tramos_hermano_select" on tramos;
create policy "tramos_hermano_select" on tramos for select to authenticated
  using (auth_es_hermano());
drop policy if exists "eventos_hermano_select" on eventos;
create policy "eventos_hermano_select" on eventos for select to authenticated
  using (auth_es_hermano());

-- Restos de una versión anterior de este archivo, por si se ejecutó: repetían
-- lo que ya hace el esquema base y confunden al leer las políticas.
do $$
declare t text;
begin
  foreach t in array array[
    'hermanos', 'tramos', 'cuotas', 'papeletas', 'movimientos', 'incidencias',
    'enseres', 'documentos', 'comunicados', 'cuentas_sociales', 'permisos_cargo',
    'solicitudes_alta', 'conceptos_cuota', 'opciones_papeleta', 'catalogos',
    'eventos', 'hermandad_settings'
  ]
  loop
    execute format('drop policy if exists "mi_hermandad" on %I', t);
  end loop;
end $$;
drop policy if exists "cuotas_propias" on cuotas;
drop policy if exists "papeletas_propias" on papeletas;
drop policy if exists "personal_mi_hermandad" on personal;
drop policy if exists "titulares_propio" on titulares;


-- -----------------------------------------------------------------------------
-- 8. LOS ARCHIVOS ADJUNTOS
-- -----------------------------------------------------------------------------
-- Esto no está en `public` y es fácil que se quede fuera, pero es donde viven
-- las actas, los contratos y los expedientes. La política que había decía
-- «cualquiera con sesión puede con el cubo `documentos`»: con una sola
-- hermandad no pasaba nada, con todas juntas significa que el tesorero de una
-- se descarga las actas de las demás.
--
-- El aislamiento aquí va por la ruta del archivo: **todo se guarda dentro de
-- una carpeta que se llama como el id de la hermandad**.
--
--   documentos/6f3a…-e21b/acta-cabildo-2026.pdf
--   └ cubo    └ hermandad             └ el archivo
--
-- Se usa `split_part` en vez de `storage.foldername()` a propósito: hace lo
-- mismo y no depende de una función de Supabase, así que esto también se puede
-- probar en un Postgres normal (que es como se ha comprobado).

insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
  on conflict (id) do nothing;

drop policy if exists "documentos_authenticated_all" on storage.objects;
drop policy if exists "documentos_mi_hermandad" on storage.objects;
create policy "documentos_mi_hermandad" on storage.objects for all to authenticated
  using (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) = hermandad_actual()::text
    and not auth_es_hermano()
  )
  with check (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) = hermandad_actual()::text
    and not auth_es_hermano()
  );


-- -----------------------------------------------------------------------------
-- 9. CREAR UNA HERMANDAD
-- -----------------------------------------------------------------------------
-- Quien se registra crea la suya y queda como titular, en una sola operación.
-- Va como función para que no se pueda hacer a medias: sin esto, alguien
-- podría crear la hermandad y no quedar como titular, y ya no podría entrar en
-- ella ni él ni nadie.

-- --- La mudanza desde el proyecto de UNA sola hermandad --------------------
-- Quien ya usaba Cabildo antes de esto tiene datos —hermanos, cuotas, recibos,
-- su web— guardados sin decir de quién son, porque entonces no hacía falta:
-- todo lo que había dentro era suyo. Al repartir por hermandades, esas filas
-- se quedan sin dueño, y una fila sin dueño no la ve nadie nunca más.
--
-- Esto se las asigna. Es seguro precisamente porque el proyecto de antes era
-- de una sola hermandad: no hay forma de que esas filas fueran de otra.
--
-- Solo toca lo que está sin asignar (`hermandad_id is null`). Lo que ya tiene
-- dueño no se mueve, así que llamarla dos veces no hace daño.
create or replace function adoptar_datos_sin_hermandad(p_hermandad_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  foreach t in array array[
    'hermanos', 'tramos', 'cuotas', 'papeletas', 'movimientos', 'incidencias',
    'enseres', 'documentos', 'comunicados', 'cuentas_sociales', 'permisos_cargo',
    'solicitudes_alta', 'conceptos_cuota', 'opciones_papeleta', 'catalogos',
    'eventos', 'personal', 'hermandad_settings', 'web_publica', 'mensajes_web'
  ]
  loop
    execute format('update %I set hermandad_id = $1 where hermandad_id is null', t)
      using p_hermandad_id;
  end loop;
end $$;

create or replace function crear_hermandad(p_nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nueva uuid;
  ya_era_titular boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Hay que haber iniciado sesión para crear una hermandad.';
  end if;

  -- Una cuenta, una hermandad. Si ya pertenece a alguna —como titular, como
  -- personal o como hermana— se le devuelve esa en vez de crearle otra.
  --
  -- Mirar solo `titulares` aquí sería un fallo gordo: la aplicación llama a
  -- esto al iniciar sesión para que la hermandad exista, y un tesorero (que
  -- está en `personal`, no en `titulares`) se habría creado una hermandad
  -- nueva y vacía cada vez que entra, quedándose fuera de la suya.
  nueva := hermandad_actual();
  if nueva is not null then
    return nueva;
  end if;

  -- ¿Venía del proyecto de UNA sola hermandad? Entonces ya tiene fila en
  -- `titulares` —la que había que escribir a mano— pero sin hermandad, porque
  -- entonces no hacía falta decir de cuál. Su caso no es «alta nueva», es
  -- «mudanza», y se trata distinto: hay datos suyos esperando.
  select true into ya_era_titular from titulares where auth_user_id = auth.uid();

  if ya_era_titular then
    -- Si un compañero de la misma junta ha entrado antes que él, la hermandad
    -- ya está creada y se une a ELLA. Sin esto, cada miembro de la junta se
    -- fabricaría una hermandad distinta al entrar y se perderían de vista unos
    -- a otros, cada uno con un trozo de lo que era una sola casa.
    select t.hermandad_id into nueva
      from titulares t where t.hermandad_id is not null limit 1;
  end if;

  if nueva is null then
    insert into hermandades (nombre) values (coalesce(nullif(trim(p_nombre), ''), 'Mi hermandad'))
      returning id into nueva;
  end if;

  -- `on conflict` porque la fila puede existir ya, del alta a mano de antes.
  insert into titulares (auth_user_id, hermandad_id) values (auth.uid(), nueva)
    on conflict (auth_user_id) do update set hermandad_id = excluded.hermandad_id;

  -- La mudanza: todo lo que había en el proyecto de una sola hermandad pasa a
  -- ser de esta. Va ANTES de crear los ajustes, porque si ya había una fila de
  -- ajustes hay que adoptarla en vez de crear otra que chocaría.
  if ya_era_titular then
    perform adoptar_datos_sin_hermandad(nueva);
  end if;

  -- Los ajustes, ya creados: si no, la aplicación arranca sin fila y el primer
  -- guardado tiene que adivinar si insertar o actualizar.
  insert into hermandad_settings (hermandad_id, nombre_legal) values (nueva, p_nombre)
    on conflict (hermandad_id) do nothing;

  return nueva;
end $$;
grant execute on function crear_hermandad(text) to authenticated;


-- --- La misma alta, pero desde el editor SQL --------------------------------
-- `crear_hermandad()` se apoya en quién ha iniciado sesión, así que desde el
-- editor SQL de Supabase no sirve: allí no hay sesión de nadie y se queda en
-- «hay que haber iniciado sesión».
--
-- Esta hace lo mismo diciendo el correo a mano. Hace falta cuando la aplicación
-- que está publicada todavía es la de antes y no llama a la otra, o
-- simplemente para dejar una hermandad montada antes de entrar por primera vez.
--
--     select crear_hermandad_manual('tucorreo@ejemplo.com', 'Hdad. de la X');
--
-- NO se puede llamar desde el navegador, y eso es a propósito: crea una
-- hermandad para el correo que se le diga, así que en manos de cualquiera
-- sería una forma de colarse. El editor SQL de Supabase funciona porque va con
-- permisos de administrador, no con los del navegador.
create or replace function crear_hermandad_manual(p_email text, p_nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  nueva uuid;
  ya_era_titular boolean := false;
begin
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'No hay ninguna cuenta registrada con el correo %. Regístrate primero en la aplicación.', p_email;
  end if;

  -- Si ya pertenece a una, se devuelve esa. Igual que la otra: pulsar dos
  -- veces no puede dejar dos hermandades.
  select coalesce(
    (select t.hermandad_id from titulares t where t.auth_user_id = uid),
    (select pe.hermandad_id from personal pe where pe.auth_user_id = uid and pe.activo),
    (select h.hermandad_id from hermanos h where h.auth_user_id = uid)
  ) into nueva;
  if nueva is not null then
    return nueva;
  end if;

  select true into ya_era_titular from titulares where auth_user_id = uid;
  if ya_era_titular then
    select t.hermandad_id into nueva from titulares t where t.hermandad_id is not null limit 1;
  end if;

  if nueva is null then
    insert into hermandades (nombre) values (coalesce(nullif(trim(p_nombre), ''), 'Mi hermandad'))
      returning id into nueva;
  end if;

  insert into titulares (auth_user_id, hermandad_id) values (uid, nueva)
    on conflict (auth_user_id) do update set hermandad_id = excluded.hermandad_id;

  if ya_era_titular then
    perform adoptar_datos_sin_hermandad(nueva);
  end if;

  insert into hermandad_settings (hermandad_id, nombre_legal) values (nueva, p_nombre)
    on conflict (hermandad_id) do nothing;

  return nueva;
end $$;

-- Postgres da permiso de ejecución a todo el mundo por defecto. Aquí NO.
revoke execute on function crear_hermandad_manual(text, text) from public;
revoke execute on function crear_hermandad_manual(text, text) from anon, authenticated;


-- -----------------------------------------------------------------------------
-- 10. EL LOGIN DEL HERMANO, DENTRO DE SU HERMANDAD
-- -----------------------------------------------------------------------------
-- El DNI ya no es único en toda la tabla, así que resolver el correo solo con
-- el DNI podría devolver el de otra persona de otra hermandad. Ahora hay que
-- decir en qué hermandad se busca — que es lo que el área del hermano ya
-- pregunta antes de pedir el DNI.

drop function if exists resolver_email_hermano(text);
create or replace function resolver_email_hermano(p_hermandad_id uuid, p_dni text) returns text
language sql stable security definer set search_path = public as $$
  select email from hermanos
  where hermandad_id = p_hermandad_id
    and upper(replace(replace(dni, ' ', ''), '-', '')) = upper(replace(replace(p_dni, ' ', ''), '-', ''))
    and estado <> 'Baja'
    and email <> ''
  limit 1
$$;
grant execute on function resolver_email_hermano(uuid, text) to anon, authenticated;

-- Los pocos datos de la hermandad que la web pública enseña de verdad, para
-- que el servidor pueda escribir la ficha de la página (la que lee WhatsApp o
-- Google al compartir el enlace) sin sesión de nadie.
--
-- Se devuelven UNO A UNO los campos que ya salen impresos en esa página: el
-- nombre, la dirección, el teléfono y el correo de contacto, el logo. Lo que
-- NO sale nunca es el IBAN, el CIF ni el identificador de acreedor, que están
-- en la misma tabla y no pintan nada en una web pública. Por eso esto no
-- devuelve la fila entera: si mañana se añade una columna con algo delicado,
-- no se cuela sola por aquí.
--
-- Solo responde si la web está publicada: una hermandad que está preparando
-- la suya no tiene por qué aparecer todavía.
create or replace function hermandad_de_la_web(p_slug text)
returns table (
  nombre_legal text, direccion text, codigo_postal text, ciudad text,
  provincia text, telefono text, email text, logo_data_url text
)
language sql stable security definer set search_path = public as $$
  select s.nombre_legal, s.direccion, s.codigo_postal, s.ciudad,
         s.provincia, s.telefono, s.email, s.logo_data_url
  from web_publica w
  join hermandad_settings s on s.hermandad_id = w.hermandad_id
  where w.slug = p_slug and w.publicada
  limit 1
$$;
grant execute on function hermandad_de_la_web(text) to anon, authenticated;

-- Para que el área del hermano pueda ofrecer «elige tu hermandad» antes de
-- pedir el DNI. Solo el nombre y el id: nada de datos de nadie.
create or replace function hermandades_publicas() returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select id, nombre from hermandades where activa order by nombre
$$;
grant execute on function hermandades_publicas() to anon, authenticated;


-- =============================================================================
--   FIN
-- =============================================================================
--
-- COMPROBACIÓN RÁPIDA (opcional): esto tiene que devolver 0 filas. Si devuelve
-- alguna, es una tabla de datos a la que se le olvidó el hermandad_id.
--
--   select table_name from information_schema.tables t
--   where table_schema = 'public'
--     and table_name in ('hermanos','tramos','cuotas','papeletas','movimientos',
--                        'incidencias','enseres','documentos','comunicados',
--                        'cuentas_sociales','solicitudes_alta','conceptos_cuota',
--                        'opciones_papeleta','catalogos','eventos')
--     and not exists (select 1 from information_schema.columns c
--                     where c.table_name = t.table_name and c.column_name = 'hermandad_id');
--
-- =============================================================================
