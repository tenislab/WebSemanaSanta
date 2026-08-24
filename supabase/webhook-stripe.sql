-- ============================================================================
--   EL WEBHOOK DE STRIPE — que el cobro se sepa cuando el dinero entra, no antes
-- ============================================================================
--
-- Hoy la suscripción se activa cuando el navegador VUELVE de Stripe a
-- `/app?suscripcion=ok`. Eso no es lo mismo que haber cobrado: si alguien
-- cierra la pestaña a mitad, si la tarjeta se rechaza después de esa pantalla,
-- o si alguien pega esa URL sin haber pagado nada, la cuenta se activa igual.
--
-- Lo correcto es que Stripe avise DIRECTAMENTE al servidor cuando el cobro se
-- confirma de verdad — eso es un webhook— y que sea esa llamada, y no la vuelta
-- del navegador, la que active la suscripción.
--
-- `activar_suscripcion(...)` ya existía para esto («se ejecuta desde el editor
-- SQL, que es lo único que corre con permisos de administrador» decía el
-- comentario), pero estaba revocada de todo el mundo — ni siquiera
-- `service_role`, que es con la que habla la función del servidor, la podía
-- llamar. Aquí se le da el permiso que le faltaba y se le añaden dos columnas
-- que la tabla `suscripciones` ya tenía preparadas (`stripe_customer_id`,
-- `stripe_subscription_id`) y que nadie rellenaba todavía.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

/**
 * Activa la suscripción, ahora también con la referencia de Stripe.
 *
 * Los dos parámetros nuevos van AL FINAL y con valor por defecto: quien ya
 * llamaba a esta función a mano desde el editor SQL —para dar de alta a una
 * hermandad sin pasar por Stripe— sigue pudiendo hacerlo exactamente igual.
 *
 * SE BORRA LA VERSIÓN VIEJA PRIMERO. `create or replace` no vale aquí porque
 * cambia la lista de parámetros: sin el `drop`, Postgres se queda con DOS
 * funciones — la de cuatro parámetros y esta, de seis— y la de cuatro se
 * queda ahí, revocada de todo el mundo, como una puerta trasera que no lleva
 * a ningún sitio pero que confunde a quien lea el esquema.
 */
drop function if exists activar_suscripcion(uuid, text, text, date);
create or replace function activar_suscripcion(
  p_hermandad_id uuid,
  p_pack text default 'todo',
  p_periodo text default 'mensual',
  p_hasta date default null,
  p_stripe_customer text default null,
  p_stripe_subscription text default null
) returns void
language sql security definer set search_path = public as $$
  insert into suscripciones
    (hermandad_id, activa, pack, periodo, desde, hasta, stripe_customer_id, stripe_subscription_id, actualizada_en)
  values
    (p_hermandad_id, true, p_pack, p_periodo, current_date, p_hasta, p_stripe_customer, p_stripe_subscription, now())
  on conflict (hermandad_id) do update set
    activa = true, pack = excluded.pack, periodo = excluded.periodo, hasta = excluded.hasta,
    -- Sin pisar con NULL: si esta llamada no trae referencia de Stripe (el
    -- alta a mano desde el editor), no se borra la que ya hubiera.
    stripe_customer_id = coalesce(excluded.stripe_customer_id, suscripciones.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, suscripciones.stripe_subscription_id),
    actualizada_en = now()
$$;
revoke execute on function activar_suscripcion(uuid, text, text, date, text, text) from public;
revoke execute on function activar_suscripcion(uuid, text, text, date, text, text) from anon, authenticated;
-- Y AQUÍ ESTABA EL AGUJERO AL REVÉS: nunca se le dio el permiso a
-- `service_role`, que es la clave con la que habla el webhook. Sin esta línea,
-- la función existía, estaba bien escrita, y NADIE la podía llamar salvo quien
-- la ejecutara a mano en el editor SQL.
grant execute on function activar_suscripcion(uuid, text, text, date, text, text) to service_role;

/**
 * Resuelve la hermandad a partir de quién pagó, y activa.
 *
 * Stripe no sabe qué es una «hermandad»: sabe qué usuario abrió la sesión de
 * pago, porque `crear-suscripcion` se lo manda como `client_reference_id`
 * (ver ese archivo). Aquí se traduce ese id de usuario a su hermandad —por la
 * tabla `titulares`, que es quien puede contratar— y se activa la suya.
 *
 * Solo `service_role`: es el webhook quien la llama, nunca el navegador.
 */
create or replace function activar_suscripcion_por_usuario(
  p_usuario uuid,
  p_pack text,
  p_periodo text,
  p_stripe_customer text,
  p_stripe_subscription text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_hermandad uuid;
begin
  select hermandad_id into v_hermandad from titulares where auth_user_id = p_usuario;
  if v_hermandad is null then
    -- No se calla: si esto pasa es que Stripe ha confirmado un cobro que no
    -- se sabe a qué hermandad corresponde, y eso hay que poder verlo en los
    -- registros de la función en vez de perderlo en silencio.
    raise exception 'No se ha encontrado ninguna hermandad para el usuario %', p_usuario;
  end if;
  perform activar_suscripcion(v_hermandad, p_pack, p_periodo, null, p_stripe_customer, p_stripe_subscription);
end $$;
revoke all on function activar_suscripcion_por_usuario(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function activar_suscripcion_por_usuario(uuid, text, text, text, text) to service_role;

/**
 * Cancela por el id de suscripción de Stripe, para cuando Stripe avisa de que
 * se ha dado de baja o ha dejado de cobrarse (`customer.subscription.deleted`).
 *
 * Si no encuentra la fila no hace nada: puede ser una suscripción de prueba
 * en el panel de Stripe, o un evento repetido, y no hay nada que romper.
 */
create or replace function cancelar_suscripcion_por_stripe(p_stripe_subscription text) returns void
language sql security definer set search_path = public as $$
  update suscripciones set activa = false, actualizada_en = now()
   where stripe_subscription_id = p_stripe_subscription
$$;
revoke all on function cancelar_suscripcion_por_stripe(text) from public, anon, authenticated;
grant execute on function cancelar_suscripcion_por_stripe(text) to service_role;

comment on column suscripciones.stripe_customer_id is
  'El cliente de Stripe que pagó. La columna ya existía; nada la rellenaba hasta el webhook.';
comment on column suscripciones.stripe_subscription_id is
  'La suscripción de Stripe. Con ella se encuentra la fila cuando Stripe avisa de un '
  'impago o una baja, sin tener que volver a preguntar por el usuario.';
