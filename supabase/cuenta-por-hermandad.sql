-- =============================================================================
--   CUENTA-POR-HERMANDAD.SQL — Ser hermano de dos hermandades a la vez
-- =============================================================================
--
-- EN ANDALUCÍA SER HERMANO DE DOS O TRES HERMANDADES ES LO NORMAL. Y hasta
-- ahora, cuando las dos estaban en Gobergo, esa persona solo podía entrar en el
-- área de UNA.
--
-- El censo ya lo contemplaba: el DNI se hizo único POR HERMANDAD en su día, con
-- el comentario «la misma persona puede ser hermana de dos». Su ficha está dos
-- veces, una en cada hermandad, y eso está bien. Lo que faltaba era la cuenta.
--
-- POR QUÉ FALLABA. Un hermano entra así:
--
--     elige hermandad → escribe su DNI → escribe su contraseña
--
-- El correo NO LO TECLEA NUNCA: la aplicación lo busca a partir del DNI y con
-- él inicia la sesión. Pero las cuentas de Supabase se identifican POR CORREO, y
-- el correo es único en todo el sistema. Así que al aprobar el alta en la
-- segunda hermandad, la creación de la cuenta se estrellaba con «el correo ya lo
-- usa otra cuenta»: esa persona quedaba en el censo de la segunda y sin poder
-- entrar en su área.
--
-- LO QUE SE SEPARA AQUÍ son dos cosas que estaban pegadas sin necesidad:
--
--   · `email`         — el correo de la persona, donde recibe los avisos. Es el
--                       MISMO en las dos hermandades, y no se toca.
--   · `correo_acceso` — cómo se llama su cuenta por dentro. Uno por hermandad.
--                       No lo ve ni lo teclea nadie.
--
-- Con eso, hermandad + DNI ES la cuenta, que es exactamente como se entra. Dos
-- hermandades, dos cuentas, dos contraseñas —independientes, porque son dos
-- accesos distintos— y un solo correo para los avisos.
--
-- NADIE QUE YA TENGA CUENTA SE ENTERA DE ESTO. Su `correo_acceso` está a null, y
-- `resolver_email_hermano` devuelve entonces el correo de siempre: entran igual
-- que ayer. El identificador derivado solo lo usan las cuentas que se crean a
-- partir de ahora.
--
-- Se puede ejecutar sobre una base ya en uso: no toca ninguna fila.

/*
 * `gen_random_bytes` y `digest` vienen con `pgcrypto`, no con Postgres a secas.
 * En Supabase está encendida de fábrica, pero se declara igualmente: este
 * archivo se puede ejecutar solo, y sin ella se pararía a la mitad con un error
 * que habla de una función y no de una extensión — que fue exactamente lo que
 * pasó con `suscriptores-web.sql`.
 */
create extension if not exists pgcrypto;

alter table hermanos add column if not exists correo_acceso text;

/*
 * Único, porque es el nombre de una cuenta. Parcial —solo donde no es nulo—
 * para no chocar con todas las fichas viejas, que lo tienen vacío.
 */
create unique index if not exists hermanos_correo_acceso_uniq
  on hermanos (lower(correo_acceso)) where correo_acceso is not null;

comment on column hermanos.correo_acceso is
  'Cómo se llama su cuenta POR DENTRO, una por hermandad. No es su correo: ese es '
  '«email» y sirve para los avisos, es el mismo en todas sus hermandades y no se '
  'toca. Nulo en las fichas anteriores a este cambio, que siguen entrando con su '
  'correo de siempre.';

/**
 * El identificador interno de una cuenta: hermandad + DNI.
 *
 * NO ES UN CORREO DE VERDAD y no tiene por qué serlo: no recibe nada, y quien
 * escribe a esa persona usa el `email` de su ficha. Tiene forma de correo porque
 * es lo que Supabase pide para nombrar una cuenta.
 *
 * Lleva un trozo del id de la hermandad para que el mismo DNI dé dos cuentas
 * distintas, que es de lo que va todo esto. Y el DNI va limpio —sin puntos ni
 * guiones— porque en el censo importado está escrito de las dos maneras y son la
 * misma persona.
 *
 * Se GUARDA en la ficha en cuanto se crea la cuenta, no se recalcula cada vez.
 * Si mañana la secretaría corrige un DNI mal tecleado —que en un censo importado
 * de un Excel pasa— la cuenta tiene que seguir siendo la suya; recalculándolo se
 * quedaría sin poder entrar y sin que nadie entendiera por qué.
 */
create or replace function correo_de_acceso(p_hermandad_id uuid, p_dni text)
returns text
language sql immutable as $$
  select upper(regexp_replace(coalesce(p_dni, ''), '[^A-Za-z0-9]', '', 'g'))
      || '.' || left(replace(p_hermandad_id::text, '-', ''), 12)
      || '@acceso.gobergo.com'
$$;

/**
 * Y el que busca la aplicación para iniciar sesión: el interno si lo tiene, y
 * si no el de siempre.
 *
 * Ese `coalesce` es lo que hace que este cambio no se note: las fichas de antes
 * no tienen identificador interno y siguen entrando con su correo, exactamente
 * igual que ayer.
 *
 * Y DE PASO SE CIERRA UNA FUGA. Esta función se la puede llamar cualquiera sin
 * identificarse —es como entra un hermano— y devolvía EL CORREO REAL de esa
 * persona. Un DNI no es ningún secreto: sabiendo el de alguien se obtenía su
 * dirección. Hay freno (25 DNI distintos por media hora), pero contra una
 * persona concreta funciona a la primera. Para las cuentas nuevas ya no
 * devuelve nada que diga nada de nadie.
 */
create or replace function resolver_email_hermano(p_hermandad_id uuid, p_dni text)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_dni text;
  v_huella text;
  v_recientes int;
  v_email text;
begin
  v_dni := upper(regexp_replace(coalesce(p_dni, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_dni = '' or p_hermandad_id is null then
    return null;
  end if;

  v_huella := md5(v_dni || ':' || p_hermandad_id::text);

  select count(distinct huella_dni) into v_recientes
    from intentos_acceso
   where hermandad_id = p_hermandad_id
     and cuando > now() - interval '30 minutes';

  if v_recientes >= 25 then
    raise exception 'Demasiados intentos de acceso en esta hermandad. Espera unos minutos y vuelve a probar.'
      using errcode = 'P0001';
  end if;

  insert into intentos_acceso (hermandad_id, huella_dni) values (p_hermandad_id, v_huella);
  delete from intentos_acceso where cuando < now() - interval '1 day';

  select coalesce(nullif(correo_acceso, ''), nullif(email, '')) into v_email
    from hermanos
   where hermandad_id = p_hermandad_id
     and upper(regexp_replace(dni, '[^A-Za-z0-9]', '', 'g')) = v_dni
     and estado <> 'Baja'
   limit 1;

  return v_email;
end $$;

grant execute on function resolver_email_hermano(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- La columna tiene que estar, y vacía en todas las fichas de hoy:
--
--   select count(*) as fichas, count(correo_acceso) as con_cuenta_propia from hermanos;
--
-- «con_cuenta_propia» en 0 al principio es lo correcto: se va llenando según se
-- creen cuentas nuevas.


-- =============================================================================
--   Y LA RECUPERACIÓN DE CONTRASEÑA, NUESTRA
-- =============================================================================
--
-- POR QUÉ HACE FALTA: «he olvidado mi contraseña» hacía que Supabase mandara un
-- correo a la dirección de la cuenta. Con el identificador interno de arriba,
-- esa dirección NO RECIBE NADA — así que el enlace no llegaría nunca y cada
-- hermano nuevo se quedaría sin poder recuperar su acceso. Eso es meter un
-- fallo, no quitarlo, y por eso esto entra en el mismo archivo.
--
-- CÓMO FUNCIONA, y es igual que el correo de confirmar una suscripción: el
-- navegador solo dice «este DNI de esta hermandad quiere recuperar». Ni el
-- token ni el correo de la persona pasan por él. La función `enviar-correo` los
-- lee aquí con la clave de servicio y manda el enlace al correo DE VERDAD de su
-- ficha.

create table if not exists recuperaciones_hermano (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  hermano_id uuid not null references hermanos(id) on delete cascade,
  /*
   * LA HUELLA DEL TOKEN, NO EL TOKEN. Quien pudiera leer esta tabla tendría si
   * no la llave para entrar en la cuenta de cualquiera que haya pedido
   * recuperarla. Guardando el resumen, la tabla no sirve de nada por sí sola.
   */
  huella text not null unique,
  caduca_en timestamptz not null,
  usada_en timestamptz,
  creada_en timestamptz not null default now()
);
create index if not exists recuperaciones_hermano_idx on recuperaciones_hermano (hermano_id, creada_en desc);

alter table recuperaciones_hermano enable row level security;
-- Nadie la toca desde fuera. Las dos funciones de abajo son SECURITY DEFINER y
-- se saltan las políticas a propósito; sin ninguna política, una tabla con RLS
-- encendido está cerrada del todo, que es lo que se quiere.
revoke all on recuperaciones_hermano from anon, authenticated;

/**
 * Paso 1: se pide. Devuelve el token, el correo DE VERDAD y el nombre, para que
 * quien manda el correo sepa a dónde y cómo escribir.
 *
 * SOLO PARA `service_role`. Si esto se le diera a `anon`, sería regalar la
 * llave de la cuenta de cualquiera con solo saber su DNI, que es justo lo
 * contrario de lo que viene a hacer.
 *
 * Devuelve null —y no se manda nada— si ese DNI no está en esa hermandad, si
 * está de baja, si no tiene correo donde escribirle, o si ya pidió una hace
 * menos de cinco minutos. Lo último es el freno: sin él, pedir la recuperación
 * mil veces con el DNI de otro le llena la bandeja, firmado por la hermandad.
 */
create or replace function pedir_recuperacion_hermano(p_hermandad_id uuid, p_dni text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_dni text;
  v_hermano record;
  v_token text;
begin
  if p_hermandad_id is null then return null; end if;
  v_dni := upper(regexp_replace(coalesce(p_dni, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_dni = '' then return null; end if;

  select id, nombre, email into v_hermano from hermanos
   where hermandad_id = p_hermandad_id
     and upper(regexp_replace(dni, '[^A-Za-z0-9]', '', 'g')) = v_dni
     and estado <> 'Baja'
     and coalesce(email, '') <> ''
     -- Sin cuenta no hay contraseña que recuperar.
     and auth_user_id is not null
   limit 1;
  if v_hermano.id is null then return null; end if;

  if exists (select 1 from recuperaciones_hermano
              where hermano_id = v_hermano.id and creada_en > now() - interval '5 minutes') then
    return null;
  end if;

  -- Largo y al azar: es lo único que hace falta saber para ponerle otra
  -- contraseña a esa cuenta, así que no puede haber nada que adivinar.
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Las anteriores de esta persona dejan de valer: pedir una nueva tiene que
  -- invalidar la de antes, o un enlace viejo reenviado sigue abriendo.
  update recuperaciones_hermano set usada_en = now()
   where hermano_id = v_hermano.id and usada_en is null;

  insert into recuperaciones_hermano (hermandad_id, hermano_id, huella, caduca_en)
  values (p_hermandad_id, v_hermano.id, encode(digest(v_token, 'sha256'), 'hex'),
          now() + interval '2 hours');

  -- Y se limpia lo viejo aprovechando el viaje, para no tener que programar nada.
  delete from recuperaciones_hermano where creada_en < now() - interval '7 days';

  return jsonb_build_object('token', v_token, 'email', v_hermano.email, 'nombre', v_hermano.nombre);
end $$;
revoke all on function pedir_recuperacion_hermano(uuid, text) from public, anon, authenticated;
grant execute on function pedir_recuperacion_hermano(uuid, text) to service_role;

/**
 * Paso 2: se canjea. Devuelve de qué cuenta es, para poder ponerle la
 * contraseña nueva.
 *
 * También solo para `service_role`: la contraseña se cambia con la clave de
 * servicio desde la función `enviar-correo`, porque eso no se puede hacer desde
 * SQL ni desde el navegador.
 *
 * SE MARCA COMO USADA EN LA MISMA CONSULTA. Un token de un solo uso que se
 * comprueba y se marca en dos pasos se puede canjear dos veces si llegan a la
 * vez, y aquí eso es dos cambios de contraseña.
 */
create or replace function canjear_recuperacion_hermano(p_token text)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare v_auth uuid;
begin
  if coalesce(p_token, '') = '' then return null; end if;

  update recuperaciones_hermano r
     set usada_en = now()
    from hermanos h
   where h.id = r.hermano_id
     and r.huella = encode(digest(p_token, 'sha256'), 'hex')
     and r.usada_en is null
     and r.caduca_en > now()
     and h.estado <> 'Baja'
  returning h.auth_user_id into v_auth;

  return v_auth;
end $$;
revoke all on function canjear_recuperacion_hermano(text) from public, anon, authenticated;
grant execute on function canjear_recuperacion_hermano(text) to service_role;
