-- =============================================================================
--   LA RENOVACIÓN Y LA TARJETA QUE FALLA
-- =============================================================================
--
-- El circuito de la suscripción atendía el alta (`checkout.session.completed`)
-- y la baja (`customer.subscription.deleted`). Le faltaban las dos cosas que
-- pasan EN MEDIO, que es donde vive una suscripción de verdad: que se renueve
-- cada mes y que un día la tarjeta falle.
--
-- -----------------------------------------------------------------------------
-- 1. LA TARJETA QUE FALLA — EL AGUJERO QUE HABÍA
-- -----------------------------------------------------------------------------
--
-- Cuando a una hermandad le falla la tarjeta, Stripe lo reintenta durante unas
-- semanas y, si al final no cobra, cancela la suscripción y manda
-- `customer.subscription.deleted` — que sí se atendía. Así que el agujero
-- estaba ACOTADO: no era acceso gratis para siempre.
--
-- Lo malo no eran esas semanas de más. Era que NADIE SE LO DECÍA A LA
-- HERMANDAD. Se enteraba el día que se quedaba fuera de golpe, sin haber
-- recibido un solo aviso, y encima en la peor semana del año si tocaba en
-- marzo.
--
-- Ahora se apunta el día que falla, y la aplicación lo enseña arriba mientras
-- siga fallando. NO SE LE CORTA EL ACCESO: una tarjeta caducada no es un
-- impago, es una tarjeta caducada. Cortar el día uno sería tratar a una
-- hermandad que lleva pagando dos años como a un moroso.
--
-- -----------------------------------------------------------------------------
-- 2. `hasta` ERA UNA COLUMNA MUERTA
-- -----------------------------------------------------------------------------
--
-- La columna existía y decía «hasta cuándo está pagada». Comprobado:
-- `activar_suscripcion` la recibía como parámetro y el webhook SIEMPRE le
-- pasaba `null`, así que estaba vacía en todas las filas; y la aplicación no la
-- leía nunca —el muro de pago es `activa` y punto—.
--
-- Un dato que parece significar algo y no significa nada es peor que no
-- tenerlo: el día que alguien lo mire para decidir, decidirá sobre vacío.
--
-- Se rellena en vez de quitarla, y por un motivo concreto: es lo que permite
-- decir «te caduca en una semana» antes de que caduque, en vez de después.
--
-- Ejecútalo después de `webhook-stripe.sql`. Volver a ejecutarlo no hace nada.
-- =============================================================================

/*
 * CUÁNDO FALLÓ EL ÚLTIMO COBRO. Vacío = todo bien, que es el caso de siempre.
 *
 * Es una fecha y no un booleano a propósito: «lleva fallando desde el 3» dice
 * si esto acaba de pasar o lleva tres semanas, y eso cambia lo que se hace.
 */
alter table suscripciones add column if not exists pago_fallido_el date;

comment on column suscripciones.pago_fallido_el is
  'Día en que Stripe no pudo cobrar. Vacío = al corriente. NO corta el acceso: '
  'lo usa la aplicación para avisar a la hermandad antes de que Stripe se rinda '
  'y cancele. Se limpia sola en cuanto un cobro entra.';

/**
 * SE HA COBRADO EL MES (o el año): se renueva.
 *
 * Hace tres cosas y las tres importan:
 *   · Deja `hasta` con la fecha real hasta la que está pagada — que es lo que
 *     convierte esa columna en un dato y no en un adorno.
 *   · LIMPIA `pago_fallido_el`. Si la tarjeta falló y al tercer intento entró,
 *     el aviso tiene que desaparecer solo: un aviso que hay que quitar a mano
 *     se queda puesto para siempre.
 *   · Y vuelve a poner `activa`, por si venía de una cancelación.
 *
 * Se busca por `stripe_subscription_id` y no por hermandad: es el único dato
 * que Stripe manda en la factura, y es el que ata las dos partes.
 */
create or replace function renovar_suscripcion_por_stripe(
  p_stripe_subscription text,
  p_hasta date default null
) returns void
language sql security definer set search_path = public as $$
  update suscripciones
     set activa = true,
         hasta = coalesce(p_hasta, hasta),
         pago_fallido_el = null,
         actualizada_en = now()
   where stripe_subscription_id = p_stripe_subscription
$$;

/**
 * NO SE HA PODIDO COBRAR: se apunta el día.
 *
 * NO TOCA `activa`, y es la decisión de todo este archivo. Stripe reintenta
 * durante semanas y la mayoría de las veces acaba cobrando —una tarjeta
 * renovada, un banco que rechazó una vez—. Cortarle el acceso a la hermandad
 * en el primer fallo sería dejar sin papeletas a cuatrocientas personas por
 * una tarjeta caducada.
 *
 * Y si de verdad no se cobra nunca, Stripe cancela la suscripción y manda
 * `customer.subscription.deleted`, que sí corta. El cierre llega por ahí, no
 * por aquí.
 *
 * `coalesce` en la fecha: si ya estaba fallando, se conserva el PRIMER día. Es
 * el que dice cuánto lleva así.
 */
create or replace function marcar_pago_fallido_por_stripe(p_stripe_subscription text)
returns void
language sql security definer set search_path = public as $$
  update suscripciones
     set pago_fallido_el = coalesce(pago_fallido_el, current_date),
         actualizada_en = now()
   where stripe_subscription_id = p_stripe_subscription
$$;

/*
 * QUE NO LAS PUEDA LLAMAR EL NAVEGADOR. Y HAY QUE QUITÁRSELO EXPRESAMENTE.
 *
 * Esto estaba MAL ESCRITO aquí, y merece quedar contado porque es una trampa
 * con la que se tropieza cualquiera. El comentario que había decía «no se
 * conceden a `authenticated`», dando por hecho que no poner un `grant` bastaba.
 * No basta: Postgres concede EXECUTE a `public` en cuanto se crea la función.
 * O sea que sin estas dos líneas estaban concedidas, y el comentario afirmaba
 * exactamente lo contrario de lo que pasaba.
 *
 * Lo que quedaba abierto eran dos botones para cualquiera con una sesión
 * iniciada: «renuévame la suscripción» y «bórrame el aviso de que no he
 * pagado». Lo cazó una prueba que le pregunta al propio Postgres
 * (`has_function_privilege`) en vez de leer el SQL — leyéndolo no se ve, que
 * es justo por lo que el comentario parecía razonable.
 *
 * Las llama el webhook con la clave de servicio, que va como `service_role` y
 * es la única que las necesita. Es la misma regla que siguen las otras tres
 * funciones de este circuito en `webhook-stripe.sql`.
 */
revoke all on function renovar_suscripcion_por_stripe(text, date) from public, anon, authenticated;
grant execute on function renovar_suscripcion_por_stripe(text, date) to service_role;

revoke all on function marcar_pago_fallido_por_stripe(text) from public, anon, authenticated;
grant execute on function marcar_pago_fallido_por_stripe(text) to service_role;

/**
 * Y QUE LA APLICACIÓN PUEDA VERLO.
 *
 * `mi_suscripcion()` ya devolvía `hasta` —vacío en todas las filas, porque
 * nadie lo rellenaba— y ahora devuelve además `pago_fallido_el`. Sin esto la
 * columna se quedaría en la base sin que nadie la leyera, que es exactamente
 * la enfermedad que este archivo viene a curar.
 *
 * HAY QUE BORRARLA ANTES, y no es un descuido: `create or replace` NO puede
 * cambiar el tipo que devuelve una función. Con una columna más en el
 * `returns table` Postgres contesta «cannot change return type of existing
 * function» y se para la instalación entera. `drop ... if exists` primero, y
 * así volver a ejecutar el fichero sigue sin hacer daño.
 *
 * No hay ventana de riesgo: entre el `drop` y el `create` va todo dentro de la
 * misma ejecución del editor SQL, y una llamada que caiga justo ahí ya está
 * cubierta —`cargarSuscripcionDeLaBase()` devuelve `null` ante cualquier
 * error y la pantalla se queda con la copia local.
 */
drop function if exists mi_suscripcion();

create function mi_suscripcion()
returns table (
  activa boolean,
  pack text,
  periodo text,
  desde date,
  hasta date,
  pago_fallido_el date
)
language sql stable security definer set search_path = public as $$
  select
    coalesce(s.activa, false),
    s.pack,
    s.periodo,
    s.desde,
    s.hasta,
    s.pago_fallido_el
  from (select 1) x
  left join suscripciones s on s.hermandad_id = hermandad_actual()
$$;
grant execute on function mi_suscripcion() to authenticated;
