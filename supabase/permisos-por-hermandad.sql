-- ============================================================================
-- Gobergo — que los permisos por cargo sean de CADA hermandad
-- ============================================================================
--
-- TRES FALLOS EN LA MISMA TABLA, y el primero es el gordo.
--
-- 1) LOS PERMISOS DE UNA HERMANDAD MANDABAN SOBRE LAS DEMÁS
--
--    `modulo_permitido()` unía `personal` con `permisos_cargo` SOLO por el
--    nombre del cargo, sin mirar de quién eran esas filas:
--
--        join permisos_cargo pc on pc.cargo = p.cargo
--
--    Así que si una hermandad decidía que su Tesorero/a no entrara en
--    «hermanos», se lo quitaba también al tesorero de TODAS las demás. Y al
--    revés: dárselo a uno era dárselo a todos.
--
-- 2) Y NO SE PODÍAN GUARDAR
--
--    La clave primaria era `(cargo, modulo_id)`, sin la hermandad. Las filas
--    de fábrica que siembra el propio esquema entran sin dueño, así que la
--    segunda hermandad que intentara guardar chocaba con esa clave. En
--    pantalla salía «Permisos guardados» en verde y no se guardaba nada.
--
-- 3) Y AL ENTRAR NO HABÍA NINGUNO
--
--    Una hermandad nueva no tenía filas propias, así que su junta se quedaba
--    sin acceso a nada hasta que alguien pasara por Configuración.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

-- --- 1. La columna, y la clave primaria de verdad ---------------------------

alter table permisos_cargo add column if not exists hermandad_id uuid
  references hermandades(id) on delete cascade;

do $$
begin
  -- Las filas de fábrica, sembradas por schema.sql sin dueño, ya no valen:
  -- cada hermandad tiene ahora las suyas. Se van para no chocar con la clave
  -- nueva ni colarse en el permiso de nadie.
  delete from permisos_cargo where hermandad_id is null;

  if exists (
    select 1 from pg_constraint
     where conname = 'permisos_cargo_pkey'
       and conrelid = 'permisos_cargo'::regclass
       and array_length(conkey, 1) = 2
  ) then
    alter table permisos_cargo drop constraint permisos_cargo_pkey;
    alter table permisos_cargo add primary key (hermandad_id, cargo, modulo_id);
  end if;
end $$;

alter table permisos_cargo alter column hermandad_id set default hermandad_actual();
create index if not exists permisos_cargo_hermandad_idx on permisos_cargo (hermandad_id);

-- --- 2. La comprobación, mirando de quién son los permisos -------------------

create or replace function modulo_permitido(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select
      es_titular()
      or exists (
        select 1 from personal p
        join permisos_cargo pc
          on pc.cargo = p.cargo
         -- ESTA LÍNEA es el arreglo: los permisos de una hermandad solo valen
         -- dentro de ella.
         and pc.hermandad_id = p.hermandad_id
        where p.auth_user_id = auth.uid() and p.activo and pc.modulo_id = p_modulo
      )
  $$;
grant execute on function modulo_permitido(text) to authenticated;

-- --- 3. Los de fábrica, para cada hermandad ---------------------------------

/**
 * Siembra los permisos de fábrica de UNA hermandad.
 *
 * Se llama al crearla y también se puede llamar a mano para las que ya
 * existían. `on conflict do nothing`: lo que la hermandad haya cambiado se
 * respeta, esto solo rellena lo que falte.
 */
create or replace function sembrar_permisos_de_fabrica(p_hermandad_id uuid) returns void
  language sql security definer set search_path = public as $$
    insert into permisos_cargo (hermandad_id, cargo, modulo_id)
    select p_hermandad_id, cargo, modulo_id from (values
      -- ESTA LISTA TIENE QUE SER LA MISMA que `PERMISOS_POR_DEFECTO` de
      -- `src/lib/permisos.ts`. Son dos copias de lo mismo en dos idiomas, y una
      -- prueba las compara para que no se vuelvan a despegar.
      --
      -- Se despegaron: faltaban «eventos» en cinco cargos y «web» en dos, y el
      -- Hermano Mayor —que lo puede todo por definición— se quedaba sin poder
      -- guardar un evento ni tocar la web. La pantalla se lo ofrecía; la base
      -- lo rechazaba.
      ('Hermano Mayor','hermanos'),('Hermano Mayor','cortejo'),('Hermano Mayor','cuotas'),
      ('Hermano Mayor','papeletas'),('Hermano Mayor','tesoreria'),('Hermano Mayor','inventario'),
      ('Hermano Mayor','archivo'),('Hermano Mayor','eventos'),('Hermano Mayor','comunicados'),
      ('Hermano Mayor','informes'),('Hermano Mayor','web'),('Hermano Mayor','campanas'),
      ('Hermano Mayor','personal'),('Hermano Mayor','configuracion'),
      ('Secretario/a','hermanos'),('Secretario/a','cortejo'),('Secretario/a','papeletas'),
      ('Secretario/a','archivo'),('Secretario/a','eventos'),('Secretario/a','comunicados'),
      ('Secretario/a','informes'),('Secretario/a','web'),('Secretario/a','campanas'),
      ('Tesorero/a','tesoreria'),('Tesorero/a','cuotas'),('Tesorero/a','inventario'),('Tesorero/a','informes'),
      ('Tesorero/a','campanas'),
      ('Fiscal','archivo'),('Fiscal','informes'),
      ('Mayordomo/Prioste','cortejo'),('Mayordomo/Prioste','inventario'),
      ('Mayordomo/Prioste','eventos'),('Mayordomo/Prioste','informes'),('Mayordomo/Prioste','campanas'),
      ('Diputado/a Mayor de Gobierno','hermanos'),('Diputado/a Mayor de Gobierno','cortejo'),
      ('Diputado/a Mayor de Gobierno','papeletas'),('Diputado/a Mayor de Gobierno','eventos'),
      ('Diputado/a Mayor de Gobierno','informes'),
      ('Vocal','eventos'),('Vocal','comunicados'),('Vocal','informes')
    ) as f(cargo, modulo_id)
    on conflict do nothing
  $$;
revoke execute on function sembrar_permisos_de_fabrica(uuid) from public;
revoke execute on function sembrar_permisos_de_fabrica(uuid) from anon, authenticated;

-- Las hermandades que ya existen se quedaron sin permisos al borrar los de
-- fábrica ahí arriba. Se les siembran los suyos.
do $$
declare h uuid;
begin
  for h in select id from hermandades loop
    perform sembrar_permisos_de_fabrica(h);
  end loop;
end $$;

-- Los dos módulos que nunca se sembraron —«eventos» y «web»— se arreglan en
-- `permisos-eventos-y-web.sql`, que va aparte porque ese sí se puede ejecutar
-- suelto sobre una base al día: no redefine ninguna función.

-- --- 4. Y que toda hermandad nueva nazca con los suyos ----------------------
--
-- Se envuelve `crear_hermandad` en vez de reescribirla: así este fichero se
-- puede ejecutar suelto sin arrastrar la definición entera de la otra, que
-- vive en multi-hermandad.sql y cambia por su cuenta.
create or replace function crear_hermandad(p_nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare nueva uuid;
begin
  nueva := crear_hermandad_base(p_nombre);
  perform sembrar_permisos_de_fabrica(nueva);
  return nueva;
end $$;
grant execute on function crear_hermandad(text) to authenticated;

-- Y la de dar de alta a mano desde el editor SQL, igual.
create or replace function crear_hermandad_manual(p_email text, p_nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare nueva uuid;
begin
  nueva := crear_hermandad_manual_base(p_email, p_nombre);
  perform sembrar_permisos_de_fabrica(nueva);
  return nueva;
end $$;
revoke execute on function crear_hermandad_manual(text, text) from public;
revoke execute on function crear_hermandad_manual(text, text) from anon, authenticated;
