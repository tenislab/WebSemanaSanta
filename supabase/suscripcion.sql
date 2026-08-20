-- ============================================================================
-- Gobergo — que la suscripción sea de la hermandad, no del navegador
-- ============================================================================
--
-- LO QUE PASA HOY
--
-- La suscripción vive en `localStorage`, en la clave `cabildo-suscripcion`.
-- Eso tiene dos caras y las dos son malas:
--
--   · La secretaria entra desde el ordenador de la casa de hermandad y se
--     encuentra el muro de pago, aunque la hermandad esté al corriente. En SU
--     navegador esa clave no existe. Llama al Hermano Mayor a preguntar qué
--     pasa.
--
--   · Y al revés: desde la consola del navegador, dos líneas bastan para
--     ponerse el pack «Todo» sin pagar. No hace falta ser nadie: la clave la
--     escribe el propio navegador.
--
-- Con esta tabla la suscripción pasa a ser un dato de la hermandad, que se lee
-- desde cualquier sitio y que NADIE puede escribir desde el navegador: solo la
-- puede tocar el `service_role`, o sea el webhook de Stripe cuando lo haya.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

create table if not exists suscripciones (
  hermandad_id uuid primary key references hermandades(id) on delete cascade,
  activa boolean not null default false,
  -- 'gestion' | 'web' | 'completo' | 'todo'
  pack text,
  -- 'mensual' | 'anual'
  periodo text,
  desde date,
  -- Hasta cuándo está pagada. Vacío = sin caducidad conocida.
  hasta date,
  -- Para atar la fila con lo que diga Stripe el día que se conecte.
  stripe_customer_id text,
  stripe_subscription_id text,
  actualizada_en timestamptz not null default now()
);

alter table suscripciones enable row level security;

-- LEER, sí: cada hermandad la suya. Es lo que quita el muro de pago desde
-- cualquier ordenador de la junta.
drop policy if exists suscripcion_propia_select on suscripciones;
create policy suscripcion_propia_select on suscripciones
  for select to authenticated
  using (hermandad_id = hermandad_actual());

-- ESCRIBIR, NO. Ni el titular. Quien paga es Stripe y quien lo confirma es su
-- webhook, con el `service_role`, que se salta las políticas por definición.
-- Sin ninguna política de escritura, la tabla queda cerrada a cal y canto para
-- todo el mundo que entre por el navegador — que es justo el agujero de ahora.
revoke insert, update, delete on suscripciones from anon, authenticated;

/**
 * La suscripción de la hermandad actual, o una vacía si no tiene fila.
 *
 * Devolver algo siempre evita que la aplicación tenga que distinguir «no hay
 * fila» de «no está activa»: para lo que le importa, es lo mismo.
 */
create or replace function mi_suscripcion()
returns table (activa boolean, pack text, periodo text, desde date, hasta date)
language sql stable security definer set search_path = public as $$
  select
    coalesce(s.activa, false),
    s.pack,
    s.periodo,
    s.desde,
    s.hasta
  from (select 1) x
  left join suscripciones s on s.hermandad_id = hermandad_actual()
$$;
grant execute on function mi_suscripcion() to authenticated;

-- Para dar de alta o renovar a mano mientras no hay Stripe. Se ejecuta desde
-- el editor SQL, que es lo único que corre con permisos de administrador.
create or replace function activar_suscripcion(
  p_hermandad_id uuid,
  p_pack text default 'todo',
  p_periodo text default 'mensual',
  p_hasta date default null
) returns void
language sql security definer set search_path = public as $$
  insert into suscripciones (hermandad_id, activa, pack, periodo, desde, hasta, actualizada_en)
  values (p_hermandad_id, true, p_pack, p_periodo, current_date, p_hasta, now())
  on conflict (hermandad_id) do update set
    activa = true, pack = excluded.pack, periodo = excluded.periodo,
    hasta = excluded.hasta, actualizada_en = now()
$$;
revoke execute on function activar_suscripcion(uuid, text, text, date) from public;
revoke execute on function activar_suscripcion(uuid, text, text, date) from anon, authenticated;
