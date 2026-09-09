-- =============================================================================
--   VER LO QUE VE ESA HERMANDAD, PARA PODER AYUDARLA
-- =============================================================================
--
-- Una incidencia de soporte hoy son tres correos: «no me deja imprimir» →
-- «¿me mandas una captura?» → una foto de una pantalla hecha con el móvil →
-- «¿y qué pone si le das a Ajustes?». Con tres hermandades se aguanta. Con
-- cincuenta es la jornada entera.
--
-- Esto deja entrar a UNA cuenta de soporte en la hermandad que pida ayuda, ver
-- exactamente lo que ella ve, y salir.
--
-- -----------------------------------------------------------------------------
-- LO PRIMERO: ESTO NO HACE NADA HASTA QUE TÚ LO ENCIENDES
-- -----------------------------------------------------------------------------
--
-- La tabla `soporte_cuentas` nace VACÍA y se queda vacía. Mientras no metas a
-- mano una fila en el SQL Editor, `hermandad_actual()` se comporta EXACTAMENTE
-- como antes para todo el mundo: mismos tres caminos, mismo resultado.
--
-- No hay pantalla para darse de alta como soporte. No hay botón. La única
-- manera de que exista una cuenta de soporte es que alguien con la contraseña
-- del proyecto de Supabase escriba la fila.
--
-- -----------------------------------------------------------------------------
-- CÓMO SE USA (todo desde el SQL Editor de Supabase)
-- -----------------------------------------------------------------------------
--
--   1. UNA VEZ EN LA VIDA, date de alta a ti mismo. Regístrate en Gobergo con
--      un correo tuyo QUE NO SEA HERMANO NI PERSONAL DE NINGUNA HERMANDAD, y
--      luego:
--
--        insert into soporte_cuentas (auth_user_id, nota)
--        select id, 'soporte de Gobergo' from auth.users where email = 'tucorreo@ejemplo.com';
--
--   2. CUANDO ALGUIEN PIDA AYUDA:
--
--        select soporte_entrar('el-uuid-de-la-hermandad');
--
--      Recarga Gobergo y estarás dentro, viendo lo suyo. Arriba sale una banda
--      roja que lo dice; ver `src/components/AppShell.tsx`.
--
--   3. AL TERMINAR:
--
--        select soporte_salir();
--
-- -----------------------------------------------------------------------------
-- LAS CUATRO COSAS QUE LO HACEN SEGURO
-- -----------------------------------------------------------------------------
--
--   · CADUCA SOLA. La entrada dura dos horas. Un soporte que se te olvida
--     cerrado un viernes no es acceso permanente al censo de una hermandad.
--
--   · SOLO LEE… no, MIENTE: escribe igual que la hermandad, porque para
--     reproducir un fallo de guardado hay que guardar. Por eso las otras tres.
--
--   · QUEDA ESCRITO EN SU REGISTRO. Entrar deja una línea en
--     `registro_actividad` de ESA hermandad, con tu nombre. Ellos lo ven en su
--     pantalla de actividad. Un acceso que el dueño de los datos no puede ver
--     no es soporte, es otra cosa.
--
--   · SE VE EN PANTALLA. Mientras estás dentro, la aplicación pinta una banda
--     que no se puede quitar. Es para ti: para que no te creas que estás en tu
--     propia hermandad y borres algo.
--
-- Ejecútalo después de `multi-hermandad.sql` y de `registro-actividad.sql`.
-- Volver a ejecutarlo no hace nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. QUIÉN ES SOPORTE
-- -----------------------------------------------------------------------------

create table if not exists soporte_cuentas (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  nota text not null default '',
  creado_el timestamptz not null default now()
);

alter table soporte_cuentas enable row level security;
/*
 * Sin ninguna política: RLS deniega todo desde la aplicación. Ni leerla.
 *
 * Que no se pueda LEER importa tanto como que no se pueda escribir: una tabla
 * legible sería una lista de «qué cuentas pueden entrar en cualquier
 * hermandad», que es justo el objetivo que se le pone a quien quiera entrar.
 * Las funciones de abajo la consultan porque van con `security definer`.
 */

/** ¿La cuenta que está pidiendo es una cuenta de soporte? */
create or replace function es_soporte() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from soporte_cuentas s where s.auth_user_id = auth.uid())
$$;
grant execute on function es_soporte() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. DÓNDE ESTÁ METIDO AHORA MISMO
-- -----------------------------------------------------------------------------

create table if not exists soporte_sesion (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  /* Cuándo deja de valer. Ver arriba: no hay accesos que duren para siempre. */
  hasta timestamptz not null,
  entrado_el timestamptz not null default now(),
  motivo text not null default ''
);

alter table soporte_sesion enable row level security;
-- Tampoco tiene políticas: solo la tocan las funciones de abajo.

-- -----------------------------------------------------------------------------
-- 3. `hermandad_actual()` — EL ÚNICO SITIO QUE SE TOCA DE VERDAD
-- -----------------------------------------------------------------------------
--
-- ¡OJO SI VIENES A CAMBIAR ESTO! Esta función es la frontera entre hermandades:
-- la usan las políticas de RLS de TODAS las tablas. Un fallo aquí no da error,
-- enseña el censo de otra hermandad.
--
-- Se redefine entera, con los TRES CAMINOS DE SIEMPRE INTACTOS y en el mismo
-- orden, y un cuarto AL FINAL. Es importante que el cuarto vaya el último:
--
--   · `coalesce` en SQL evalúa perezoso: en cuanto uno de los tres primeros
--     devuelve algo, el cuarto NI SE MIRA. Para el 100 % de las personas
--     reales esta función cuesta exactamente lo que costaba antes.
--   · Y si alguna vez una cuenta de soporte fuera además hermana de alguna
--     hermandad, mandaría SU hermandad, no la suplantada. Que es lo correcto:
--     nadie debe poder salirse de su propia casa por tener una llave maestra.
--
-- La definición original está en `multi-hermandad.sql`, sección 3. Si cambias
-- una, cambia la otra.
--
create or replace function hermandad_actual() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select t.hermandad_id from titulares t where t.auth_user_id = auth.uid()),
    (select p.hermandad_id from personal  p where p.auth_user_id = auth.uid() and p.activo),
    (select h.hermandad_id from hermanos  h where h.auth_user_id = auth.uid()),
    -- Y solo si no es ninguna de las tres cosas: la suplantación de soporte,
    -- mientras no haya caducado.
    (select s.hermandad_id from soporte_sesion s
      where s.auth_user_id = auth.uid() and s.hasta > now())
  )
$$;
grant execute on function hermandad_actual() to authenticated, anon;

-- -----------------------------------------------------------------------------
-- 4. ENTRAR Y SALIR
-- -----------------------------------------------------------------------------

/**
 * Entra en una hermandad. Devuelve su nombre, para que veas en el acto que has
 * acertado con el identificador.
 *
 * Deja constancia en el registro de actividad DE ESA HERMANDAD antes de dejar
 * entrar, no después: si el insert de la sesión fallara, ya está escrito que se
 * intentó.
 */
create or replace function soporte_entrar(cual uuid, por_que text default '')
returns text
language plpgsql security definer set search_path = public as $$
declare
  quien text;
  como_se_llama text;
begin
  if not es_soporte() then
    raise exception 'Esta cuenta no es de soporte.';
  end if;

  select nombre into como_se_llama from hermandades where id = cual;
  if como_se_llama is null then
    raise exception 'No hay ninguna hermandad con ese identificador.';
  end if;

  select coalesce(email, 'soporte') into quien from auth.users where id = auth.uid();

  insert into registro_actividad (hermandad_id, autor_id, autor_nombre, accion, sobre_tipo, detalle)
  values (cual, auth.uid(), quien, 'soporte_entra', 'hermandad',
          'Soporte de Gobergo ha entrado para ayudar' ||
          case when por_que = '' then '.' else ': ' || por_que end);

  insert into soporte_sesion (auth_user_id, hermandad_id, hasta, entrado_el, motivo)
  values (auth.uid(), cual, now() + interval '2 hours', now(), por_que)
  on conflict (auth_user_id) do update
    set hermandad_id = excluded.hermandad_id,
        hasta = excluded.hasta,
        entrado_el = excluded.entrado_el,
        motivo = excluded.motivo;

  return como_se_llama;
end $$;
grant execute on function soporte_entrar(uuid, text) to authenticated;

/** Sale. Se puede llamar aunque no estuvieras dentro. */
create or replace function soporte_salir() returns void
language plpgsql security definer set search_path = public as $$
declare donde uuid; quien text;
begin
  select hermandad_id into donde from soporte_sesion where auth_user_id = auth.uid();
  if donde is null then return; end if;

  select coalesce(email, 'soporte') into quien from auth.users where id = auth.uid();
  insert into registro_actividad (hermandad_id, autor_id, autor_nombre, accion, sobre_tipo, detalle)
  values (donde, auth.uid(), quien, 'soporte_sale', 'hermandad',
          'Soporte de Gobergo ha terminado.');

  delete from soporte_sesion where auth_user_id = auth.uid();
end $$;
grant execute on function soporte_salir() to authenticated;

/**
 * ¿Estoy suplantando a alguien ahora mismo, y a quién?
 *
 * La llama la aplicación al arrancar para pintar la banda de aviso. Devuelve
 * el nombre de la hermandad, o `null` si no. Para una cuenta normal —o sea,
 * para todo el mundo— devuelve `null` sin tocar nada.
 */
create or replace function soporte_donde_estoy() returns text
language sql stable security definer set search_path = public as $$
  select h.nombre from soporte_sesion s
    join hermandades h on h.id = s.hermandad_id
   where s.auth_user_id = auth.uid() and s.hasta > now()
$$;
grant execute on function soporte_donde_estoy() to authenticated;

/**
 * Y la lista, para saber a dónde entrar. Solo la contesta si eres soporte.
 *
 *   select * from soporte_hermandades();
 */
/*
 * DROP ANTES DEL CREATE: «create or replace» NO PUEDE CAMBIAR EL TIPO QUE
 * DEVUELVE. El día que a esta función se le añada una columna al `returns
 * table`, Postgres corta con «cannot change return type of existing function»
 * — y no aquí, donde se instala desde cero y no existe todavía, sino en la
 * base de una hermandad que ya tiene la versión vieja. O sea, en producción y
 * a mitad de ACTUALIZAR.sql. Ha pasado dos veces.
 */
drop function if exists soporte_hermandades();
create or replace function soporte_hermandades()
returns table (id uuid, nombre text, creada_en timestamptz, hermanos bigint)
language sql stable security definer set search_path = public as $$
  select h.id, h.nombre, h.creada_en,
         (select count(*) from hermanos x where x.hermandad_id = h.id)
    from hermandades h
   where es_soporte()
   order by h.nombre
$$;
grant execute on function soporte_hermandades() to authenticated;
