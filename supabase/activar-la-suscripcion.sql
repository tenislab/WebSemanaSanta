-- ============================================================================
--   EL BOTÓN DE ACTIVAR LA SUSCRIPCIÓN NO LLEGABA A LA BASE
-- ============================================================================
--
-- Sin suscripción activa, el panel entero está bloqueado: `AppShell` enseña la
-- pantalla de suscripción y no deja pasar a ningún módulo. Es lo primero que
-- se encuentra una hermandad al entrar.
--
-- La pantalla tiene su botón de activar, y ese botón escribía en
-- `localStorage`. En ningún otro sitio. Lo que pasaba entonces:
--
--   1. El Hermano Mayor activa desde su ordenador. Entra. Funciona.
--   2. La secretaria abre el panel desde el suyo y se encuentra el muro de
--      pago, con la hermandad supuestamente activada.
--   3. Y en el ordenador del Hermano Mayor, al recargar, el muro TAMBIÉN
--      vuelve: `cargarSuscripcionDeLaBase()` pregunta a la base, la base
--      contesta «no hay suscripción», y esa respuesta pisa la copia local.
--
-- O sea que el botón no servía para nada más que para el rato que durase esa
-- pestaña abierta. Y no había forma de saberlo desde dentro: no da error, no
-- avisa, simplemente vuelve a salir el muro.
--
-- LA ÚNICA MANERA DE ACTIVAR ERA `activar_suscripcion(...)` DESDE EL EDITOR
-- SQL DE SUPABASE, porque esa función está revocada para `authenticated` a
-- propósito: se pensó para que la llamara el webhook de Stripe con la clave de
-- servicio. Mientras no exista ese webhook, la aplicación se queda sin ninguna
-- forma de activar nada.
--
-- QUÉ AÑADE ESTE ARCHIVO
--
-- `activar_suscripcion_propia()`: la puede llamar el TITULAR de la hermandad,
-- y solo para SU hermandad. Es exactamente lo que la pantalla ya ofrece —hoy
-- la activación es gratuita mientras no haya precios de Stripe puestos, y así
-- lo dice— pero guardándolo donde tiene que estar.
--
-- OJO, Y ESTO HAY QUE LEERLO ANTES DE COBRAR: mientras esta función exista,
-- cualquier titular puede activarse el pack que quiera sin pagar. Hoy da
-- igual, porque el botón de la pantalla ya lo hace y no hay pasarela. EL DÍA
-- QUE SE CONECTE STRIPE hay que revocarla y dejar solo la de service_role, que
-- es la que llamará el webhook:
--
--     revoke execute on function activar_suscripcion_propia(text, text) from authenticated;
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

create or replace function activar_suscripcion_propia(
  p_pack text default 'todo',
  p_periodo text default 'mensual'
) returns void
language plpgsql security definer set search_path = public as $$
declare v_hermandad uuid;
begin
  -- SOLO EL TITULAR, y solo la suya. `hermandad_actual()` sale de quién está
  -- preguntando, así que no hay ningún identificador que se pueda cambiar
  -- desde el navegador para activarle la suscripción a otra hermandad.
  if not es_titular() then
    raise exception 'Solo quien lleva la hermandad puede activar la suscripción.';
  end if;
  v_hermandad := hermandad_actual();
  if v_hermandad is null then
    raise exception 'Esta cuenta no tiene ninguna hermandad.';
  end if;

  -- Los valores se acotan aquí y no se toman tal cual: son los que decide la
  -- pantalla, pero la pantalla se puede saltar.
  if coalesce(p_pack, '') not in ('todo', 'gestion', 'web') then p_pack := 'todo'; end if;
  if coalesce(p_periodo, '') not in ('mensual', 'anual') then p_periodo := 'mensual'; end if;

  insert into suscripciones (hermandad_id, activa, pack, periodo, desde, actualizada_en)
  values (v_hermandad, true, p_pack, p_periodo, current_date, now())
  on conflict (hermandad_id) do update set
    activa = true, pack = excluded.pack, periodo = excluded.periodo,
    desde = coalesce(suscripciones.desde, excluded.desde), actualizada_en = now();
end $$;

revoke all on function activar_suscripcion_propia(text, text) from public, anon;
grant execute on function activar_suscripcion_propia(text, text) to authenticated;

-- Y darla de baja, por lo mismo: cancelándola solo en el navegador, la
-- hermandad seguía entrando desde cualquier otro ordenador.
create or replace function cancelar_suscripcion_propia() returns void
language plpgsql security definer set search_path = public as $$
declare v_hermandad uuid;
begin
  if not es_titular() then
    raise exception 'Solo quien lleva la hermandad puede cancelar la suscripción.';
  end if;
  v_hermandad := hermandad_actual();
  if v_hermandad is null then return; end if;
  -- Se marca inactiva, NO se borra la fila: cuándo se dio de alta y cuándo se
  -- fue es justo lo que hay que poder mirar cuando alguien reclama.
  update suscripciones set activa = false, actualizada_en = now()
   where hermandad_id = v_hermandad;
end $$;

revoke all on function cancelar_suscripcion_propia() from public, anon;
grant execute on function cancelar_suscripcion_propia() to authenticated;

comment on function activar_suscripcion_propia(text, text) is
  'Activa la suscripción de SU hermandad, para el titular. Existe porque el botón de la '
  'pantalla de suscripción solo escribía en localStorage: al recargar volvía el muro de '
  'pago, y desde otro ordenador no había entrado nunca. Revocar para authenticated el día '
  'que se conecte Stripe: entonces activa el webhook con activar_suscripcion().';
