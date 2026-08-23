-- =============================================================================
--   AVISADME DE LOS CULTOS — quien sigue a la hermandad sin ser hermano
-- =============================================================================
--
-- Alrededor de una hermandad hay mucha más gente que hermanos: vecinos del
-- barrio, devotos, gente que se crió allí y vive fuera, quien va todos los años
-- a ver la salida. Toda esa gente se entera de los cultos por casualidad —o no
-- se entera— porque los avisos van al censo y ellos no están en el censo.
--
-- Y NO SE LES PUEDE METER EN EL CENSO. Un censo es la lista de hermanos y de
-- ahí cuelgan las cuotas, las papeletas y la antigüedad. Meter a un vecino ahí
-- para poder avisarle rompe el censo y le da una condición que no tiene.
--
-- Esto es una lista aparte: un correo y poco más.
--
-- LO QUE EXIGE EL RGPD, y por qué está cada cosa:
--
--   · CONSENTIMIENTO EXPRESO. Una casilla que hay que marcar a mano —nunca
--     premarcada— y se guarda QUÉ texto aceptó y CUÁNDO. Sin eso, si algún día
--     alguien reclama, la hermandad no puede demostrar nada.
--   · CONFIRMAR EL CORREO. Sin confirmar, cualquiera apunta el correo de otro:
--     se le manda un enlace y hasta que no lo abre no se le escribe. Además es
--     lo que evita que los envíos de la hermandad acaben en spam.
--   · DARSE DE BAJA DE UN CLIC. Cada suscriptor lleva su propia llave, y con
--     ella se borra solo, sin escribir a nadie ni dar explicaciones.
--
-- Ejecútalo una vez en el SQL Editor, después de `multi-hermandad.sql`.
-- =============================================================================

/*
 * LA LLAVE DE BAJA SALE DE `gen_random_bytes`, QUE NO ES DE POSTGRES A SECAS.
 *
 * Viene con la extensión `pgcrypto`. En Supabase está encendida de fábrica, así
 * que aquí funcionaba y nadie lo miró; pero es una dependencia que este fichero
 * no declaraba. En un Postgres sin ella, la instalación se para EN ESTA LÍNEA y
 * todo lo que viene detrás —las políticas, las funciones de suscripción, las
 * copias— no llega a crearse. Y como el error habla de una función y no de una
 * extensión, no se entiende.
 *
 * Se declara. Si ya está, no hace nada.
 */
create extension if not exists pgcrypto;

create table if not exists suscriptores_web (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  email text not null,
  nombre text not null default '',

  /*
   * LA LLAVE. Sirve para dos cosas —confirmar y darse de baja— y es lo único
   * que hace falta saber para las dos: por eso va en la dirección del correo
   * que se le manda y por eso es larga y al azar.
   *
   * Con un id normal, cualquiera que probara identificadores podría dar de baja
   * a otro. Con esto, no hay nada que probar.
   */
  llave text not null default encode(gen_random_bytes(24), 'hex'),

  -- Hasta que no abre el enlace del correo, no se le escribe.
  confirmado boolean not null default false,
  confirmado_en timestamptz,

  -- Qué aceptó exactamente y cuándo. Es la prueba del consentimiento.
  texto_aceptado text not null default '',
  alta_en timestamptz not null default now(),

  -- De dónde salió: «web», «formulario de contacto»… Para saber qué funciona.
  origen text not null default 'web'
);

-- Un correo, una vez por hermandad. Sin esto, quien pulsa dos veces el botón
-- acaba recibiendo cada aviso por duplicado.
/*
 * CUÁNDO SE LE MANDÓ EL CORREO DE CONFIRMAR.
 *
 * No es informativo: es el freno. Sin él, pedir «mándame la confirmación» mil
 * veces con el correo de otro le llena la bandeja a esa persona, firmado por la
 * hermandad. Con él, del segundo intento en diez minutos no sale nada.
 */
alter table suscriptores_web
  add column if not exists confirmacion_enviada_en timestamptz;

create unique index if not exists suscriptores_web_email_uniq
  on suscriptores_web (hermandad_id, lower(email));
create index if not exists suscriptores_web_hermandad_idx on suscriptores_web (hermandad_id);

alter table suscriptores_web enable row level security;

/*
 * NADIE ESCRIBE AQUÍ DIRECTAMENTE, ni siquiera para apuntarse.
 *
 * Con un INSERT abierto —como el del buzón de mensajes— la lista sería una
 * puerta para meter mil correos de golpe, y sobre todo se podría LEER lo que
 * otro acaba de escribir si alguien afina la consulta. Una lista de correos es
 * exactamente lo que busca quien manda spam.
 *
 * Se entra por las tres funciones de abajo, que hacen una cosa cada una.
 */
drop policy if exists "la hermandad ve sus suscriptores" on suscriptores_web;
create policy "la hermandad ve sus suscriptores"
  on suscriptores_web for select
  to authenticated
  using (hermandad_id = hermandad_actual() and not auth_es_hermano());

drop policy if exists "la hermandad borra sus suscriptores" on suscriptores_web;
create policy "la hermandad borra sus suscriptores"
  on suscriptores_web for delete
  to authenticated
  using (hermandad_id = hermandad_actual() and not auth_es_hermano());

/**
 * Apuntarse. DEVUELVE SÍ O NO, y nunca la llave.
 *
 * ANTES DEVOLVÍA LA LLAVE, y ese era el agujero. La llave es lo único que hace
 * falta para confirmar un alta (`confirmar_suscripcion`) y para darla de baja
 * (`baja_de_la_web`), y esta función la puede llamar cualquiera desde fuera sin
 * identificarse. Pero es que además, por el `on conflict … returning`, cuando
 * el correo YA ESTABA no devolvía una llave nueva: devolvía LA DE ESA PERSONA.
 *
 * O sea, que con la dirección de alguien de la lista —que no es ningún
 * secreto— se podía:
 *
 *   · CONFIRMAR SU ALTA sin que llegara a ver el correo. Y entonces la
 *     hermandad tiene apuntado «esta persona confirmó tal día», que es la
 *     prueba del consentimiento, y es falsa. La hermandad se pone a escribirle
 *     a alguien que nunca pidió nada, con un papel que dice que sí.
 *   · O DARLE DE BAJA. Una dirección detrás de otra, y la lista se vacía sin
 *     que nadie se entere: los suscriptores dejan de recibir los cultos y la
 *     hermandad no ve más que una lista que mengua.
 *
 * La llave se queda dentro de la base. Sale por dos sitios y solo por dos: el
 * correo que se le manda a esa persona, y el panel de la hermandad.
 *
 * SIGUE SIN DECIR SI EL CORREO YA ESTABA. Contestar «ese correo ya está
 * apuntado» le diría a cualquiera quién está en la lista, y eso es filtrar los
 * datos de otro. Devuelve `true` en los dos casos.
 */
drop function if exists suscribirse_a_la_web(uuid, text, text, text);
create or replace function suscribirse_a_la_web(
  p_hermandad_id uuid,
  p_email text,
  p_nombre text default '',
  p_texto text default ''
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_recientes int;
begin
  if p_hermandad_id is null then return false; end if;
  if not exists (select 1 from hermandades where id = p_hermandad_id) then return false; end if;

  v_email := lower(trim(coalesce(p_email, '')));
  -- Una comprobación mínima, del lado de acá. La de verdad la hace el correo de
  -- confirmación: si la dirección no existe, nunca se confirma.
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then return false; end if;

  /*
   * EL FRENO. Esto lo llama cualquiera sin identificarse, así que sin un tope
   * se le pueden meter cien mil correos a una hermandad en una tarde: la lista
   * queda inservible y hay que borrarla entera a mano.
   *
   * Sesenta altas nuevas por hora es mucho más de lo que da de sí el
   * formulario de una hermandad, incluso el día siguiente a la salida. Se
   * cuentan solo las NUEVAS: quien vuelve a apuntarse con un correo que ya
   * estaba no crea fila y no gasta cupo.
   */
  select count(*) into v_recientes from suscriptores_web
   where hermandad_id = p_hermandad_id and alta_en > now() - interval '1 hour';
  if v_recientes >= 60 then
    raise exception 'Ahora mismo no se pueden recoger más altas. Inténtalo dentro de un rato.'
      using errcode = 'P0001';
  end if;

  insert into suscriptores_web (hermandad_id, email, nombre, texto_aceptado)
  values (p_hermandad_id, v_email, left(trim(coalesce(p_nombre, '')), 120), left(coalesce(p_texto, ''), 1000))
  on conflict (hermandad_id, lower(email))
  -- Sin cambiar nada de lo que ya había: ni el consentimiento, ni la fecha de
  -- alta, ni si estaba confirmado. Volver a apuntarse no puede borrar la prueba
  -- de cuándo aceptó.
  do update set email = suscriptores_web.email;

  return true;
end $$;
grant execute on function suscribirse_a_la_web(uuid, text, text, text) to anon, authenticated;

/**
 * LA LLAVE PARA EL CORREO DE CONFIRMAR — y solo para el servidor.
 *
 * Esta es la única puerta por la que la llave sale de la base hacia quien
 * manda el correo, y NO SE LE DA A `anon` NI A `authenticated`: solo a
 * `service_role`, que es la clave que vive dentro de la función `enviar-correo`
 * y nunca pisa un navegador. Si algún día alguien le da el permiso a `anon`,
 * vuelve el agujero entero.
 *
 * Devuelve null —y no manda nada— en tres casos:
 *
 *   · Ese correo no está apuntado en esa hermandad. Sin esto, sería una forma
 *     de preguntar «¿está fulano en vuestra lista?».
 *   · Ya está confirmado. No hay nada que confirmar y mandarlo otra vez es
 *     spam.
 *   · Se le mandó hace menos de diez minutos. Es el freno de verdad: sin él,
 *     pedir la confirmación mil veces con el correo de otra persona le llena la
 *     bandeja, y firmado por la hermandad.
 *
 * Deja apuntado el envío en la misma consulta, así que dos peticiones a la vez
 * no consiguen dos correos.
 */
create or replace function llave_para_confirmar(p_hermandad_id uuid, p_email text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_llave text;
  v_nombre text;
begin
  if p_hermandad_id is null then return null; end if;
  update suscriptores_web
     set confirmacion_enviada_en = now()
   where hermandad_id = p_hermandad_id
     and lower(email) = lower(trim(coalesce(p_email, '')))
     and not confirmado
     and (confirmacion_enviada_en is null or confirmacion_enviada_en < now() - interval '10 minutes')
  returning llave into v_llave;
  if v_llave is null then return null; end if;

  -- El nombre va en el mismo viaje. Quien manda el correo lo necesita para
  -- firmarlo, y una segunda consulta para leer un nombre es una pieza más que
  -- se puede caer justo entre las dos.
  select nombre into v_nombre from hermandades where id = p_hermandad_id;
  return jsonb_build_object('llave', v_llave, 'hermandad', coalesce(v_nombre, ''));
end $$;
revoke all on function llave_para_confirmar(uuid, text) from public, anon, authenticated;
grant execute on function llave_para_confirmar(uuid, text) to service_role;

/** Confirmar, con la llave del enlace. Decir si ha valido o no. */
create or replace function confirmar_suscripcion(p_llave text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hay boolean;
begin
  update suscriptores_web
     set confirmado = true,
         -- Solo la primera vez: si vuelve a abrir el enlace del correo dentro
         -- de un año, la fecha buena sigue siendo la de entonces.
         confirmado_en = coalesce(confirmado_en, now())
   where llave = p_llave
  returning true into v_hay;
  return coalesce(v_hay, false);
end $$;
grant execute on function confirmar_suscripcion(text) to anon, authenticated;

/**
 * Darse de baja. Se BORRA la fila, no se marca.
 *
 * Guardar «este pidió la baja» obliga a seguir teniendo su correo para
 * acordarse de no escribirle, que es justo lo contrario de lo que ha pedido. Si
 * algún día vuelve, se apunta otra vez.
 */
create or replace function baja_de_la_web(p_llave text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hay boolean;
begin
  delete from suscriptores_web where llave = p_llave returning true into v_hay;
  return coalesce(v_hay, false);
end $$;
grant execute on function baja_de_la_web(text) to anon, authenticated;
