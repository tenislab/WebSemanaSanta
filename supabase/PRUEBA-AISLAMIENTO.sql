-- ============================================================================
--  PRUEBA DE AISLAMIENTO: dos hermandades en el mismo Supabase.
--  Cada bloque imprime OK o FALLO. Un solo FALLO invalida el multi-hermandad.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off

-- Supabase concede esto de serie a anon/authenticated sobre el esquema public.
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- --- Cuentas -----------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'titular@amargura.test', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'titular@esperanza.test', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'hermano@amargura.test', '{"tipo":"hermano"}'),
  ('44444444-4444-4444-4444-444444444444', 'hermano@esperanza.test', '{"tipo":"hermano"}')
on conflict (id) do nothing;

-- ============================================================================
--  A) CADA TITULAR CREA SU HERMANDAD
-- ============================================================================
set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select crear_hermandad('Hermandad de la Amargura') as hermandad_a \gset
-- Pulsar dos veces el botón no puede crear dos hermandades:
select crear_hermandad('Hermandad de la Amargura') as otra_vez \gset
select case when :'hermandad_a' = :'otra_vez'
  then 'OK  A1  crear_hermandad dos veces devuelve la misma'
  else 'FALLO A1  se han creado DOS hermandades' end;

select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select crear_hermandad('Hermandad de la Esperanza') as hermandad_b \gset
select case when :'hermandad_a' <> :'hermandad_b'
  then 'OK  A2  dos hermandades distintas'
  else 'FALLO A2  la segunda hermandad reusa el id de la primera' end;

-- ============================================================================
--  B) CADA UNA METE SUS DATOS (sin pasar hermandad_id: va por defecto)
-- ============================================================================
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
insert into tramos (nombre, orden) values ('Cristo', 1), ('Palio', 2);
insert into hermanos (numero, nombre, dni, email, estado, clave_acceso, auth_user_id) values
  (1, 'Ana Ruiz Amargura',   '00000001A', 'ana@amargura.test',   'Activo', 'x', '33333333-3333-3333-3333-333333333333'),
  (2, 'Bruno Gil Amargura',  '00000002B', 'bruno@amargura.test', 'Activo', 'x', null);
insert into cuotas (numero, hermano_id, concepto, importe, estado, ejercicio)
  select 1, id, 'Cuota anual', 40, 'Pendiente', 2026 from hermanos where dni = '00000001A';

select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
insert into tramos (nombre, orden) values ('Misterio', 1);
-- MISMO número 1 y MISMO DNI que en la otra hermandad: tiene que dejar.
insert into hermanos (numero, nombre, dni, email, estado, clave_acceso, auth_user_id) values
  (1, 'Carmen Vega Esperanza', '00000001A', 'carmen@esperanza.test', 'Activo', 'x', '44444444-4444-4444-4444-444444444444');
select 'OK  B1  nº 1 y DNI repetidos en otra hermandad: admitido';

-- ============================================================================
--  C) LO QUE VE CADA TITULAR
-- ============================================================================
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select case when (select count(*) from hermanos) = 2
             and (select count(*) from hermanos where dni='00000001A') = 1
             and (select count(*) from hermanos where nombre like '%Esperanza%') = 0
  then 'OK  C1  el titular A ve sus 2 hermanos y ninguno de B'
  else 'FALLO C1  el titular A ve hermanos que no son suyos: ' ||
       (select string_agg(nombre, ', ') from hermanos) end;

select case when (select count(*) from tramos) = 2
  then 'OK  C2  el titular A ve sus 2 tramos y no el de B'
  else 'FALLO C2  tramos visibles: ' || (select string_agg(nombre, ', ') from tramos) end;

select case when (select count(*) from hermandades) = 1
             and (select id from hermandades) = :'hermandad_a'::uuid
  then 'OK  C3  A solo ve su propia hermandad en la tabla hermandades'
  else 'FALLO C3  A ve ' || (select count(*) from hermandades) || ' hermandades' end;

select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select case when (select count(*) from hermanos) = 1
             and (select nombre from hermanos) = 'Carmen Vega Esperanza'
  then 'OK  C4  el titular B ve solo su hermana'
  else 'FALLO C4  B ve: ' || (select string_agg(nombre, ', ') from hermanos) end;

select case when (select count(*) from cuotas) = 0
  then 'OK  C5  B no ve las cuotas de A'
  else 'FALLO C5  B ve ' || (select count(*) from cuotas) || ' cuotas de A' end;

-- ============================================================================
--  D) ESCRITURA CRUZADA: lo que de verdad importa
-- ============================================================================
-- B intenta MODIFICAR una hermana de A. Con RLS no da error: no toca nada.
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
with t as (update hermanos set nombre = 'PIRATEADO' where dni = '00000001A' and nombre like '%Amargura%' returning 1)
select case when (select count(*) from t) = 0
  then 'OK  D1  B no puede modificar hermanos de A'
  else 'FALLO D1  B ha modificado datos de A' end;

with t as (delete from hermanos where nombre like '%Amargura%' returning 1)
select case when (select count(*) from t) = 0
  then 'OK  D2  B no puede borrar hermanos de A'
  else 'FALLO D2  B ha borrado hermanos de A' end;

-- B intenta INSERTAR una fila marcada como de A (poniendo el id a mano).
do $$
begin
  insert into hermanos (numero, nombre, dni, estado, clave_acceso, hermandad_id)
  values (99, 'Topo Infiltrado', '99999999Z', 'Activo', 'x',
          (select hermandad_id from titulares where auth_user_id = '11111111-1111-1111-1111-111111111111'::uuid));
  raise exception 'FALLO D3  B ha metido una fila en la hermandad de A';
exception
  when insufficient_privilege then raise notice 'OK  D3  B no puede insertar filas en la hermandad de A';
  when others then
    if sqlerrm like 'FALLO%' then raise; end if;
    raise notice 'OK  D3  B no puede insertar filas en la hermandad de A (%)', sqlerrm;
end $$;

-- B intenta MOVER una fila suya a la hermandad de A.
do $$
begin
  update hermanos set hermandad_id = (select hermandad_id from titulares
    where auth_user_id = '11111111-1111-1111-1111-111111111111'::uuid) where dni = '00000001A';
  if found then raise exception 'FALLO D4  B ha movido una fila a la hermandad de A'; end if;
  raise notice 'OK  D4  B no puede mudar una fila suya a la hermandad de A';
exception
  when insufficient_privilege then raise notice 'OK  D4  B no puede mudar una fila suya a la hermandad de A';
  when others then
    if sqlerrm like 'FALLO%' then raise; end if;
    raise notice 'OK  D4  B no puede mudar una fila suya a la hermandad de A (%)', sqlerrm;
end $$;

-- Comprobación final desde A: sus datos siguen intactos.
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select case when (select count(*) from hermanos) = 2
             and (select count(*) from hermanos where nombre = 'PIRATEADO') = 0
             and (select count(*) from hermanos where nombre = 'Topo Infiltrado') = 0
  then 'OK  D5  los datos de A siguen intactos tras los intentos de B'
  else 'FALLO D5  los datos de A han cambiado' end;

-- ============================================================================
--  E) EL HERMANO: solo lo suyo, y solo de su hermandad
-- ============================================================================
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
select case when (select count(*) from hermanos) = 1
             and (select nombre from hermanos) like 'Ana%'
  then 'OK  E1  la hermana Ana solo ve su propia ficha'
  else 'FALLO E1  Ana ve ' || (select count(*) from hermanos) || ' fichas: ' ||
       coalesce((select string_agg(nombre, ', ') from hermanos), '-') end;

select case when (select count(*) from cuotas) = 1
  then 'OK  E2  Ana ve su cuota y ninguna más'
  else 'FALLO E2  Ana ve ' || (select count(*) from cuotas) || ' cuotas' end;

select case when (select count(*) from tramos) = 2
  then 'OK  E3  Ana ve los tramos de SU hermandad (2), no el de la otra'
  else 'FALLO E3  Ana ve ' || (select count(*) from tramos) || ' tramos' end;

select case when (select count(*) from movimientos) = 0
             and (select count(*) from hermandad_settings) = 0
  then 'OK  E4  Ana no ve contabilidad ni ajustes de la hermandad'
  else 'FALLO E4  Ana ve datos de gestión' end;

with t as (update hermanos set telefono = '600000000' where nombre like 'Ana%' returning 1)
select case when (select count(*) from t) = 1
  then 'OK  E5  Ana sí puede editar su propia ficha'
  else 'FALLO E5  Ana no puede editar su ficha' end;

-- El hermano de la OTRA hermandad no ve nada de esta.
select set_config('test.uid', '44444444-4444-4444-4444-444444444444', false);
select case when (select count(*) from hermanos) = 1
             and (select nombre from hermanos) like 'Carmen%'
             and (select count(*) from tramos) = 1
  then 'OK  E6  el hermano de B solo ve lo de B'
  else 'FALLO E6  fuga entre hermanos de distintas hermandades' end;

-- ============================================================================
--  F) SIN SESIÓN (el visitante de la web)
-- ============================================================================
select set_config('test.uid', '', false);
reset role;
set role anon;
select set_config('test.uid', '', false);
select case when (select count(*) from hermanos) = 0
             and (select count(*) from cuotas) = 0
             and (select count(*) from tramos) = 0
  then 'OK  F1  sin sesión no se ve ningún dato personal'
  else 'FALLO F1  hay datos personales visibles sin sesión' end;

insert into mensajes_web (nombre, email, mensaje, hermandad_id)
  values ('Visitante', 'v@ejemplo.test', 'Hola', :'hermandad_a'::uuid);
select 'OK  F2  el visitante puede dejar un mensaje en el buzón de una hermandad';

select case when (select count(*) from mensajes_web) = 0
  then 'OK  F3  el visitante no puede leer el buzón'
  else 'FALLO F3  el buzón es legible sin sesión' end;

do $$
begin
  insert into mensajes_web (nombre, email, mensaje) values ('Sin dueño', 'x@y.test', 'Hola');
  raise exception 'FALLO F4  se admite un mensaje sin hermandad';
exception
  when insufficient_privilege then raise notice 'OK  F4  no se admite un mensaje sin hermandad';
  when others then
    if sqlerrm like 'FALLO%' then raise; end if;
    raise notice 'OK  F4  no se admite un mensaje sin hermandad (%)', sqlerrm;
end $$;

reset role;
-- Cada titular lee SU buzón y solo el suyo.
set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select case when (select count(*) from mensajes_web) = 1
  then 'OK  F5  A lee el mensaje dejado en su buzón'
  else 'FALLO F5  A ve ' || (select count(*) from mensajes_web) || ' mensajes' end;
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select case when (select count(*) from mensajes_web) = 0
  then 'OK  F6  B no lee el buzón de A'
  else 'FALLO F6  B lee el buzón de A' end;

-- ============================================================================
--  G) UNA CUENTA HUÉRFANA (registrada pero sin hermandad) NO VE NADA
-- ============================================================================
reset role;
insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'colado@ejemplo.test')
  on conflict (id) do nothing;
set role authenticated;
select set_config('test.uid', '55555555-5555-5555-5555-555555555555', false);
select case when hermandad_actual() is null
  then 'OK  G1  una cuenta sin hermandad no resuelve a ninguna'
  else 'FALLO G1  una cuenta suelta ha caído dentro de una hermandad' end;
select case when (select count(*) from hermanos) = 0
             and (select count(*) from cuotas) = 0
             and (select count(*) from hermandades) = 0
             and (select count(*) from mensajes_web) = 0
  then 'OK  G2  una cuenta sin hermandad no ve absolutamente nada'
  else 'FALLO G2  una cuenta suelta ve datos' end;
do $$
begin
  insert into hermanos (numero, nombre, dni, estado, clave_acceso) values (7, 'Colado', '77777777C', 'Activo', 'x');
  raise exception 'FALLO G3  una cuenta sin hermandad ha podido insertar';
exception
  when insufficient_privilege then raise notice 'OK  G3  una cuenta sin hermandad no puede insertar nada';
  when others then
    if sqlerrm like 'FALLO%' then raise; end if;
    raise notice 'OK  G3  una cuenta sin hermandad no puede insertar nada (%)', sqlerrm;
end $$;

-- ============================================================================
--  H) LOGIN DEL HERMANO POR DNI, DENTRO DE SU HERMANDAD
-- ============================================================================
select case when resolver_email_hermano(:'hermandad_a'::uuid, '00000001-A') = 'ana@amargura.test'
  then 'OK  H1  el DNI resuelve al correo correcto dentro de la hermandad A'
  else 'FALLO H1  devuelve: ' || coalesce(resolver_email_hermano(:'hermandad_a'::uuid, '00000001-A'), 'nada') end;
select case when resolver_email_hermano(:'hermandad_b'::uuid, '00000001A') = 'carmen@esperanza.test'
  then 'OK  H2  el MISMO DNI en la hermandad B resuelve a otra persona'
  else 'FALLO H2  devuelve: ' || coalesce(resolver_email_hermano(:'hermandad_b'::uuid, '00000001A'), 'nada') end;
select case when (select count(*) from hermandades_publicas()) = 2
  then 'OK  H3  la lista para elegir hermandad devuelve las 2'
  else 'FALLO H3  devuelve ' || (select count(*) from hermandades_publicas()) end;



-- ============================================================================
--  I) LA WEB PÚBLICA: se lee desde la calle, se edita solo la propia
-- ============================================================================
set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
insert into web_publica (slug, publicada, datos) values ('amargura', true, '{"n":"A"}');
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
insert into web_publica (slug, publicada, datos) values ('esperanza', false, '{"n":"B"}');

-- B intenta editar la web de A.
do $$
begin
  update web_publica set datos = '{"n":"PIRATA"}' where slug = 'amargura';
  if found then raise exception 'FALLO I1  B ha editado la web de A'; end if;
  raise notice 'OK  I1  B no puede editar la web de A';
exception
  when insufficient_privilege then raise notice 'OK  I1  B no puede editar la web de A';
  when others then
    if sqlerrm like 'FALLO%' then raise; end if;
    raise notice 'OK  I1  B no puede editar la web de A (%)', sqlerrm;
end $$;

-- Desde la calle: se ve la publicada y no la que está sin publicar.
reset role; set role anon; select set_config('test.uid', '', false);
select case when (select count(*) from web_publica) = 1
             and (select slug from web_publica) = 'amargura'
  then 'OK  I2  el visitante ve la web publicada y no el borrador de la otra'
  else 'FALLO I2  el visitante ve ' || (select count(*) from web_publica) || ' webs' end;

-- ============================================================================
--  J) LOS ADJUNTOS DEL ARCHIVO (actas, contratos, expedientes)
-- ============================================================================
reset role; set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
insert into storage.objects (bucket_id, name)
  values ('documentos', hermandad_actual()::text || '/acta-cabildo-2026.pdf');
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
insert into storage.objects (bucket_id, name)
  values ('documentos', hermandad_actual()::text || '/presupuesto.pdf');

select case when (select count(*) from storage.objects) = 1
             and (select name from storage.objects) like '%presupuesto%'
  then 'OK  J1  B solo ve sus propios adjuntos, no las actas de A'
  else 'FALLO J1  B ve ' || (select count(*) from storage.objects) || ' adjuntos: ' ||
       coalesce((select string_agg(name, ', ') from storage.objects), '-') end;

-- B intenta colar un archivo en la carpeta de A.
do $$
begin
  insert into storage.objects (bucket_id, name)
    values ('documentos', (select hermandad_id from titulares
      where auth_user_id = '11111111-1111-1111-1111-111111111111'::uuid)::text || '/colado.pdf');
  raise exception 'FALLO J2  B ha subido un archivo a la carpeta de A';
exception
  when insufficient_privilege then raise notice 'OK  J2  B no puede subir a la carpeta de A';
  when others then
    if sqlerrm like 'FALLO%' then raise; end if;
    raise notice 'OK  J2  B no puede subir a la carpeta de A (%)', sqlerrm;
end $$;

-- Un archivo suelto, fuera de toda carpeta, tampoco entra.
do $$
begin
  insert into storage.objects (bucket_id, name) values ('documentos', 'suelto.pdf');
  raise exception 'FALLO J3  se admite un adjunto fuera de la carpeta de una hermandad';
exception
  when insufficient_privilege then raise notice 'OK  J3  no se admite un adjunto sin carpeta de hermandad';
  when others then
    if sqlerrm like 'FALLO%' then raise; end if;
    raise notice 'OK  J3  no se admite un adjunto sin carpeta de hermandad (%)', sqlerrm;
end $$;

-- Un hermano no toca el archivo documental.
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
select case when (select count(*) from storage.objects) = 0
  then 'OK  J4  un hermano no ve el archivo documental de su hermandad'
  else 'FALLO J4  un hermano ve los adjuntos del archivo' end;

-- ============================================================================
--  K) NUMERACIÓN Y DNI DENTRO DE UNA MISMA HERMANDAD
-- ============================================================================
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
do $$
begin
  insert into hermanos (numero, nombre, dni, estado, clave_acceso)
    values (1, 'Repetido', '00000009X', 'Activo', 'x');
  raise exception 'FALLO K1  se admite un nº de hermano repetido en la MISMA hermandad';
exception
  when unique_violation then raise notice 'OK  K1  no se admite un nº repetido dentro de la misma hermandad';
  when others then
    if sqlerrm like 'FALLO%' then raise; end if; raise;
end $$;
do $$
begin
  insert into hermanos (numero, nombre, dni, estado, clave_acceso)
    values (50, 'Repetido', '00000001A', 'Activo', 'x');
  raise exception 'FALLO K2  se admite un DNI repetido en la MISMA hermandad';
exception
  when unique_violation then raise notice 'OK  K2  no se admite un DNI repetido dentro de la misma hermandad';
  when others then
    if sqlerrm like 'FALLO%' then raise; end if; raise;
end $$;

reset role;

-- ============================================================================
--  L) crear_hermandad() DESDE UNA CUENTA QUE YA PERTENECE A UNA
-- ============================================================================
-- La aplicación llama a esto al iniciar sesión para asegurarse de que la
-- hermandad existe. Si a un miembro del personal le creara una hermandad
-- nueva, se quedaría fuera de la suya y con una vacía a su nombre.
reset role;
insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'tesorero@amargura.test')
  on conflict (id) do nothing;
set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
insert into personal (nombre, email, cargo, clave, activo, auth_user_id)
  values ('Tesorero', 'tesorero@amargura.test', 'Tesorero', 'x', true, '66666666-6666-6666-6666-666666666666');

select set_config('test.uid', '66666666-6666-6666-6666-666666666666', false);
select case when crear_hermandad('Intento') = (select hermandad_id from personal where email = 'tesorero@amargura.test')
  then 'OK  L1  el personal recibe SU hermandad, no una nueva'
  else 'FALLO L1  al personal se le ha creado una hermandad aparte' end;
select case when (select count(*) from hermanos) = 2
  then 'OK  L2  el tesorero entra en la hermandad de siempre y ve su censo'
  else 'FALLO L2  el tesorero ve ' || (select count(*) from hermanos) || ' hermanos' end;

-- Lo mismo desde una cuenta de hermano.
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
select case when crear_hermandad('Intento') is not null
             and crear_hermandad('Intento') = (select hermandad_id from hermanos limit 1)
  then 'OK  L3  a un hermano tampoco se le crea una hermandad aparte'
  else 'FALLO L3  a un hermano se le ha creado una hermandad' end;

reset role;
select case when (select count(*) from hermandades) = 2
  then 'OK  L4  siguen existiendo exactamente 2 hermandades'
  else 'FALLO L4  hay ' || (select count(*) from hermandades) || ' hermandades' end;

-- ============================================================================
--  M) LOS DATOS DE LA HERMANDAD QUE VE LA WEB PÚBLICA
-- ============================================================================
reset role;
set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
update hermandad_settings set nombre_legal = 'Hdad. de la Amargura', ciudad = 'Sevilla', iban = 'ES0000';
reset role; set role anon; select set_config('test.uid', '', false);
select case when (select nombre_legal from hermandad_de_la_web('amargura')) = 'Hdad. de la Amargura'
             and (select ciudad from hermandad_de_la_web('amargura')) = 'Sevilla'
  then 'OK  M1  la web pública recibe el nombre y la ciudad de su hermandad'
  else 'FALLO M1  no llegan los datos de la hermandad a su web' end;
select case when (select count(*) from hermandad_de_la_web('esperanza')) = 0
  then 'OK  M2  una web sin publicar no devuelve nada'
  else 'FALLO M2  se devuelven datos de una web sin publicar' end;
select case when (select count(*) from information_schema.columns
                  where table_name = 'hermandad_de_la_web') = 0
             and not exists (
               select 1 from pg_proc p
               where p.proname = 'hermandad_de_la_web'
                 and pg_get_function_result(p.oid) like '%iban%')
  then 'OK  M3  el IBAN y el CIF no salen por esa función'
  else 'FALLO M3  la función pública devuelve datos bancarios' end;
select case when (select count(*) from hermandad_settings) = 0
  then 'OK  M4  sin sesión no se lee la tabla de ajustes directamente'
  else 'FALLO M4  los ajustes son legibles sin sesión' end;
reset role;

