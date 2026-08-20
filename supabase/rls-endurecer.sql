-- ============================================================================
--  Endurecer la seguridad: quitar los dos «permitir por defecto»
-- ============================================================================
--  Seguro de ejecutar sobre una base ya en uso: crea una tabla, sustituye dos
--  funciones y no borra ni una fila. Ejecútalo DESPUÉS de schema.sql,
--  hermano-auth.sql y rls-cargos.sql.
--
--  Corrige dos agujeros que dejaban la base abierta:
--
--  1) `modulo_permitido()` decía «quien no está en la tabla personal es el
--     titular» y le daba TODO. Pero cualquiera que se registrara en /registro
--     creaba una cuenta `authenticated` sin fila en `personal`: con la clave
--     anónima (que va en el propio JavaScript de la web) podía leer y escribir
--     el censo entero, las cuotas, la tesorería y el personal.
--
--  2) `auth_es_hermano()` se fiaba de `user_metadata`, que el propio usuario
--     puede reescribir con `auth.updateUser({ data: { tipo: 'personal' } })`.
--     Un hermano con cuenta legítima se quitaba la etiqueta de hermano desde
--     la consola del navegador y pasaba a que le aplicaran las políticas de
--     personal.
--
--  Regla general: quién eres se saca de las TABLAS, nunca de lo que diga el
--  token que el usuario controla, y ante la duda NO se concede nada.
-- ============================================================================

-- Titulares de la hermandad: acceso sin restricción de módulo. Es explícito a
-- propósito; antes «titular» era simplemente «no aparece en personal».
create table if not exists titulares (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now()
);
alter table titulares enable row level security;

-- Solo se puede consultar a través de las funciones security definer de abajo;
-- nadie escribe aquí desde el cliente (se siembra con service_role al crear la
-- hermandad).
drop policy if exists titulares_nadie on titulares;
create policy titulares_nadie on titulares for all to authenticated using (false) with check (false);

-- ¿Es la sesión actual el titular? Por tabla, no por ausencia de datos.
create or replace function es_titular() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (select 1 from titulares where auth_user_id = auth.uid())
  $$;
grant execute on function es_titular() to authenticated;

-- ¿Puede el personal actual ESCRIBIR en este módulo?
-- Falla CERRADO: una cuenta que no es titular ni personal activo no puede nada.
create or replace function modulo_permitido(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select
      es_titular()
      or exists (
        select 1 from personal p
        join permisos_cargo pc on pc.cargo = p.cargo
        where p.auth_user_id = auth.uid() and p.activo and pc.modulo_id = p_modulo
      )
  $$;
grant execute on function modulo_permitido(text) to authenticated;

-- ¿Es una sesión de hermano? Por la tabla `hermanos`, no por el metadata.
create or replace function auth_es_hermano() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (select 1 from hermanos where auth_user_id = auth.uid())
  $$;
grant execute on function auth_es_hermano() to anon, authenticated;

-- Y el personal, por la tabla `personal`.
create or replace function auth_es_personal() returns boolean
  language sql stable security definer set search_path = public as $$
    select es_titular() or exists (
      select 1 from personal where auth_user_id = auth.uid() and activo
    )
  $$;
grant execute on function auth_es_personal() to authenticated;

-- ============================================================================
--  Después de ejecutar esto, HAY QUE dar de alta al titular.
--
--  Se hace con esto, poniendo el correo con el que se registró y el nombre de
--  la hermandad:
--
--      select crear_hermandad_manual('titular@sudominio.es', 'Hdad. de Triana');
--
--  NO uses «insert into titulares (auth_user_id) values ('<uuid>')», que es lo
--  que ponía aquí antes. Esa fila entra SIN hermandad, y una fila de titular
--  sin hermandad hacía que al entrar se le metiera en la hermandad de otra
--  gente —la primera que hubiera en la tabla— con su censo delante. Con una
--  sola hermandad en la base no se notaba; con varias, es una fuga.
--
--  Sin este paso, ni siquiera el titular podrá escribir: es a propósito.
--  Vale más quedarse fuera un minuto que dejar la puerta abierta.
-- ============================================================================
