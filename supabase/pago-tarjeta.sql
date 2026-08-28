-- ============================================================================
--   C4 · QUE EL HERMANO PAGUE SU CUOTA O SU PAPELETA CON TARJETA
-- ============================================================================
--
-- Hoy el hermano solo puede pagar por domiciliación, por transferencia o
-- pasándose por la casa de hermandad. Con tarjeta lo hace desde el sofá, y la
-- hermandad se ahorra el «avísame cuando lo hagas» y el cotejo a mano.
--
-- ----------------------------------------------------------------------------
-- EL DINERO NO PASA POR GOBERGO. NUNCA.
-- ----------------------------------------------------------------------------
--
-- Esta es la decisión que manda sobre todo lo demás, y ya estaba escrita en
-- `lib/pagoSuscripcion.ts`: lo que los hermanos le pagan a su hermandad va
-- DIRECTO a la cuenta de la hermandad.
--
-- Se hace con una cuenta conectada de Stripe (Connect): la hermandad enlaza su
-- cuenta, el cobro se crea contra ELLA, y el dinero cae en su saldo y se paga
-- a su IBAN. Gobergo no lo toca ni un segundo.
--
-- Y AQUÍ NO SE GUARDA NINGUNA CLAVE SECRETA. Lo que se guarda es el
-- identificador de la cuenta conectada (`acct_…`), que no es un secreto: no
-- sirve para cobrar nada por su cuenta. La clave con la que se habla con
-- Stripe vive en la función del servidor, como la del webhook.
--
-- Guardar la clave secreta de cada hermandad en esta tabla habría sido más
-- fácil y es exactamente lo que no se puede hacer: una fuga de esta tabla
-- serían cobros y devoluciones en la cuenta de veinte hermandades.
--
-- ----------------------------------------------------------------------------
-- LO QUE DA POR PAGADO ES EL WEBHOOK, NO EL NAVEGADOR
-- ----------------------------------------------------------------------------
--
-- Cuando Stripe termina, devuelve al hermano a una página nuestra. Esa vuelta
-- NO vale como prueba de pago: se puede escribir esa dirección a mano, y una
-- conexión que se corta deja al hermano pagado y a la aplicación sin enterarse.
--
-- Es la misma lección que costó `webhook-stripe.sql` con las suscripciones
-- («sin él se cobra y no nos enteramos»). Así que la cuota se marca pagada
-- AQUÍ, desde una función que solo puede llamar la clave de servicio, y solo
-- cuando Stripe confirma que el dinero está.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run. Es seguro repetirlo.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. La cuenta de Stripe de la hermandad
-- ----------------------------------------------------------------------------
--
-- `acct_…`. No es un secreto —es el destinatario del cobro, no la llave— pero
-- solo lo puede tocar quien lleva Configuración.

alter table hermandad_settings add column if not exists stripe_cuenta text;

comment on column hermandad_settings.stripe_cuenta is
  'Cuenta conectada de Stripe (acct_…) a la que va el dinero de cuotas y papeletas. '
  'NO es una clave secreta: la clave vive en la función del servidor.';


-- ----------------------------------------------------------------------------
-- 2. Los intentos de pago
-- ----------------------------------------------------------------------------
--
-- Una fila por intento, no por cobro conseguido. Los que se quedan a medias
-- —el hermano abre la pasarela y cierra la pestaña— también se guardan, y eso
-- es a propósito: cuando alguien dice «yo pagué» hace falta poder mirar si
-- llegó a intentarlo y qué pasó.

create table if not exists pagos_tarjeta (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  -- Qué se está pagando. Se guarda el tipo aparte del id porque un id de cuota
  -- y uno de papeleta se parecen demasiado para distinguirlos por la forma.
  tipo text not null check (tipo in ('cuota', 'papeleta')),
  referencia_id uuid not null,
  hermano_id uuid references hermanos(id) on delete set null,
  -- En céntimos y entero, como el resto del dinero de la aplicación: es lo que
  -- se le manda a Stripe, que también los pide así.
  importe_cent bigint not null check (importe_cent > 0),
  estado text not null default 'abierto' check (estado in ('abierto', 'pagado', 'fallido', 'caducado')),
  -- La sesión de Stripe. Es lo que une este intento con lo que cuenta el
  -- webhook, y por eso es única.
  stripe_session text unique,
  creado_en timestamptz not null default now(),
  pagado_en timestamptz
);

alter table pagos_tarjeta enable row level security;

create index if not exists pagos_tarjeta_referencia_idx on pagos_tarjeta (referencia_id);
-- Lo que se pregunta al pintar el área del hermano: «¿tengo algo a medias?».
create index if not exists pagos_tarjeta_mios_idx on pagos_tarjeta (hermano_id, estado);


-- ----------------------------------------------------------------------------
-- 3. Quién ve qué
-- ----------------------------------------------------------------------------

drop policy if exists "solo_mi_hermandad" on pagos_tarjeta;
create policy "solo_mi_hermandad" on pagos_tarjeta as restrictive for all to authenticated
  using (hermandad_id = hermandad_actual())
  with check (hermandad_id = hermandad_actual());

-- Quien lleva las cuotas o el dinero, para poder mirar qué pasó con un cobro.
drop policy if exists "tesoreria_ve_los_pagos" on pagos_tarjeta;
create policy "tesoreria_ve_los_pagos" on pagos_tarjeta for select to authenticated
  using (modulo_permitido('cuotas') or modulo_permitido('tesoreria') or modulo_permitido('papeletas'));

-- Y el hermano ve LOS SUYOS, que es como sabe si su pago llegó.
drop policy if exists "el hermano ve sus pagos" on pagos_tarjeta;
create policy "el hermano ve sus pagos" on pagos_tarjeta for select to authenticated
  using (hermano_id = hermano_propio_id());

/*
 * NADIE ESCRIBE AQUÍ DESDE EL NAVEGADOR. Ni el hermano ni la junta.
 *
 * Las filas las crea `crear-pago` y las cierra el webhook, las dos con la
 * clave de servicio. Si se pudiera escribir desde el navegador, cualquiera
 * marcaría su pago como «pagado» desde la consola y su cuota quedaría cobrada
 * sin que hubiera entrado un euro — que es exactamente el agujero que ya se
 * cerró con las cuotas en `lo-que-toca-el-hermano.sql`.
 */
grant select on pagos_tarjeta to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Dar por cobrado un pago: SOLO desde el webhook
-- ----------------------------------------------------------------------------
--
-- Marca el intento como pagado, marca la cuota o la papeleta, y deja el asiento
-- en Tesorería. Las tres cosas en la misma orden: si se hicieran por separado,
-- un corte por el medio dejaría la cuota cobrada y el libro sin enterarse, que
-- es la avería que se lleva arreglando todo el proyecto.

create or replace function cobrar_pago_tarjeta(p_session text)
returns boolean
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_pago pagos_tarjeta;
  v_num int;
  v_nombre text;
  v_concepto text;
begin
  select * into v_pago from pagos_tarjeta where stripe_session = p_session;
  if v_pago.id is null then
    raise warning 'cobrar_pago_tarjeta: no hay ningún intento con la sesión %', p_session;
    return false;
  end if;

  /*
   * DOS VECES NO. Stripe reintenta un webhook que no contestó a la primera, y
   * puede mandar `completed` y `async_payment_succeeded` por el mismo cobro.
   * Sin esto, el segundo aviso metería un segundo asiento en el libro por un
   * dinero que entró una vez.
   */
  if v_pago.estado = 'pagado' then
    return true;
  end if;

  update pagos_tarjeta set estado = 'pagado', pagado_en = now() where id = v_pago.id;

  select nombre into v_nombre from hermanos where id = v_pago.hermano_id;

  if v_pago.tipo = 'cuota' then
    select concepto into v_concepto from cuotas where id = v_pago.referencia_id;
    update cuotas
       set estado = 'Pagada',
           fecha_pago = to_char(now(), 'YYYY-MM-DD'),
           metodo_cobro = 'Tarjeta'
     where id = v_pago.referencia_id
       and hermandad_id = v_pago.hermandad_id;
  else
    v_concepto := 'Papeleta de sitio';
    /*
     * La papeleta usa `estado`, no una columna de pago aparte, y sus valores
     * son los del cortejo ('Solicitada', 'Asignada', 'Pagada'…). Se pone
     * 'Pagada' y se apunta el método en `metodo_pago`, que es la columna que
     * usa la secretaría para registrar el cobro — `pago_metodo` es otra cosa:
     * ahí el HERMANO avisa de que ha pagado, y solo admite Bizum o
     * transferencia.
     */
    update papeletas
       set estado = 'Pagada',
           metodo_pago = 'Tarjeta',
           fecha_pago = to_char(now(), 'YYYY-MM-DD')
     where id = v_pago.referencia_id
       and hermandad_id = v_pago.hermandad_id;
  end if;

  -- El asiento. Nace PENDIENTE como todos: conciliar es cotejarlo con el
  -- extracto, y eso lo hace el tesorero. Ver `lib/apuntes.ts`.
  select coalesce(max(numero), 0) + 1 into v_num
    from movimientos where hermandad_id = v_pago.hermandad_id;

  insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
  values (
    v_pago.hermandad_id, v_num, to_char(now(), 'YYYY-MM-DD'),
    format('%s con tarjeta — %s', coalesce(v_concepto, 'Cobro'), coalesce(v_nombre, 'hermano/a')),
    case when v_pago.tipo = 'cuota' then 'Cuotas Hermanos/as' else 'Papeletas de sitio' end,
    'Ingreso',
    v_pago.importe_cent / 100.0,
    -- Una tarjeta nunca es efectivo: entra en el banco.
    'Cuenta bancaria', 'Pendiente',
    format('%s:%s', v_pago.tipo, v_pago.referencia_id)
  )
  -- Si ya estaba apuntado por otra vía —el hermano avisó y secretaría lo dio
  -- por bueno antes de que llegara el webhook— no se duplica.
  on conflict do nothing;

  return true;
end $$;

revoke all on function cobrar_pago_tarjeta(text) from public, anon, authenticated;

comment on function cobrar_pago_tarjeta(text) is
  'La llama el webhook de Stripe con la clave de servicio. Desde el navegador NO: '
  'sería marcarse la cuota como pagada sin pagar.';


-- ----------------------------------------------------------------------------
-- 5. Abrir un intento: también solo desde el servidor
-- ----------------------------------------------------------------------------
--
-- La abre `crear-pago` con la clave de servicio, después de comprobar quién
-- pide el cobro y por cuánto. El IMPORTE NO LO PONE EL NAVEGADOR: se lee aquí
-- de la cuota o de la papeleta. Si lo mandara el navegador, cualquiera pagaría
-- su cuota de 60 € por un céntimo.

create or replace function abrir_pago_tarjeta(
  p_hermandad_id uuid, p_tipo text, p_referencia uuid, p_hermano_id uuid
) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_importe numeric;
  v_estado text;
  v_id uuid;
begin
  if p_tipo not in ('cuota', 'papeleta') then return null; end if;

  if p_tipo = 'cuota' then
    select importe, estado into v_importe, v_estado
      from cuotas where id = p_referencia and hermandad_id = p_hermandad_id;
    -- Una cuota ya cobrada no se vuelve a cobrar.
    if v_estado = 'Pagada' then return null; end if;
  else
    select importe, estado into v_importe, v_estado
      from papeletas where id = p_referencia and hermandad_id = p_hermandad_id;
    -- Ni una ya cobrada, ni una anulada o renunciada: cobrar eso sería cobrar
    -- por un sitio que ya no existe.
    if v_estado in ('Pagada', 'Entregada', 'Anulada', 'Renuncia') then return null; end if;
  end if;

  if v_importe is null or v_importe <= 0 then return null; end if;

  insert into pagos_tarjeta (hermandad_id, tipo, referencia_id, hermano_id, importe_cent)
  values (p_hermandad_id, p_tipo, p_referencia, p_hermano_id, round(v_importe * 100))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'importe_cent', round(v_importe * 100));
end $$;

revoke all on function abrir_pago_tarjeta(uuid, text, uuid, uuid) from public, anon, authenticated;

/** Anota la sesión de Stripe en el intento recién abierto. */
create or replace function fijar_sesion_pago(p_id uuid, p_session text)
returns boolean
language sql volatile security definer set search_path = public, extensions as $$
  update pagos_tarjeta set stripe_session = p_session where id = p_id returning true
$$;

revoke all on function fijar_sesion_pago(uuid, text) from public, anon, authenticated;
