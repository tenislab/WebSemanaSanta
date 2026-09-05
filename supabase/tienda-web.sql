-- ============================================================================
--   LA TIENDA EN LA WEB: RESERVAR Y RECOGER
-- ============================================================================
--
-- La hermandad publica su género en la web y la gente lo APARTA desde casa;
-- luego pasa por la casa hermandad, paga y se lo lleva.
--
-- SIN PAGO ONLINE, Y ES UNA DECISIÓN, no una simplificación por pereza:
--
--   · El dinero de la tienda va a la hermandad, no a Gobergo. Cobrar por ella
--     convertiría a Gobergo en intermediario de pagos, con lo que eso trae.
--   · Y una tienda que cobra por internet arrastra obligaciones de comercio
--     electrónico —desistimiento de catorce días, condiciones de venta,
--     resolución de litigios— que una hermandad que vende ochenta camisetas al
--     año no tiene por qué asumir.
--
-- Reservar no es comprar: es apartar. Por eso aquí no hay factura ni asiento
-- en el libro. Los dos nacen cuando se recoge y se paga, y entonces la venta
-- pasa por `registrar_venta()` como cualquier otra, con `canal = 'online'`
-- para saber de dónde vino.
--
-- EL STOCK NO SE DESCUENTA AL RESERVAR. `stock` significa «lo que hay en el
-- almacén», y mientras la camiseta no se la lleve nadie, ahí sigue. Lo que se
-- calcula es lo DISPONIBLE = stock − reservado, que es lo que se puede
-- prometer. Descontarlo al reservar haría que el recuento del almacén no
-- cuadrara nunca con las estanterías.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada. Necesita `tienda.sql` ejecutado antes.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Las reservas
-- ----------------------------------------------------------------------------
create table if not exists reservas_tienda (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  /*
   * LA REFERENCIA, para decirla por teléfono y para que la busque quien está
   * en el mostrador: «R-2027-14». Correlativa por hermandad y año, con
   * cerrojo, por lo mismo que el número de factura: calculada con un `max()+1`
   * desde dos navegadores a la vez salen dos reservas con la misma.
   */
  referencia text not null,
  nombre text not null,
  email text not null default '',
  telefono text not null default '',
  notas text not null default '',
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'entregada', 'anulada', 'caducada')),
  -- Hasta cuándo se le guarda. Pasada la fecha, la hermandad puede soltarla y
  -- el género vuelve a estar disponible.
  recoger_antes_de date,
  total numeric(10, 2) not null default 0,
  -- La venta que salió de ella al recogerla. Vacío mientras no se entregue.
  venta_id uuid references ventas(id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (hermandad_id, referencia)
);
create index if not exists reservas_tienda_pendientes_idx
  on reservas_tienda (hermandad_id, estado, creado_en desc);

/*
 * QUIÉN APARTÓ, SI RESULTÓ SER HERMANO.
 *
 * Va como `alter table` para las bases que ya existen. Y NO ES UN CAMPO QUE
 * MANDE EL NAVEGADOR: lo resuelve `crear_reserva_web` contra la sesión, porque
 * un `hermano_id` que llegara de fuera sería el 50 % de costaleros para
 * cualquiera con la consola abierta.
 *
 * De saberlo salen dos cosas: el precio de hermano en la web —que hasta ahora
 * solo existía en el mostrador, así que el hermano que compraba por internet
 * pagaba tarifa— y poder avisarle cuando lo suyo está listo.
 */
alter table reservas_tienda add column if not exists hermano_id uuid references hermanos(id) on delete set null;
alter table reservas_tienda add column if not exists descuento_id uuid references descuentos(id) on delete set null;
alter table reservas_tienda add column if not exists descuento_pct numeric(5, 2) not null default 0;

create table if not exists lineas_reserva (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  reserva_id uuid not null references reservas_tienda(id) on delete cascade,
  producto_id uuid references productos(id) on delete set null,
  -- Copiados, igual que en las líneas de venta: lo que se le prometió a quien
  -- reservó no puede cambiar porque mañana suba el precio.
  codigo text not null,
  nombre text not null,
  cantidad int not null check (cantidad > 0),
  precio_unitario numeric(10, 2) not null default 0
);
-- Lo que costaba de tarifa, para poder enseñar en el resguardo lo que NO se le
-- cobró. `precio_unitario` ya viene rebajado si a quien apartó le tocaba.
alter table lineas_reserva add column if not exists precio_tarifa numeric(10, 2);
create index if not exists lineas_reserva_reserva_idx on lineas_reserva (reserva_id);
create index if not exists lineas_reserva_producto_idx on lineas_reserva (producto_id);


-- ----------------------------------------------------------------------------
-- 2. Lo que de verdad se puede prometer
-- ----------------------------------------------------------------------------
--
-- `stock` es lo que hay en la estantería. `disponible` es lo que se puede
-- vender o reservar sin dejar a nadie colgado: lo de la estantería menos lo
-- que ya está apartado y sin recoger.
--
-- Separarlos importa el día del besamanos: si el mostrador vende las tres
-- últimas camisetas que estaban apartadas para alguien que viene por la tarde,
-- esa persona se encuentra con que su reserva no vale nada.
--
-- Y eso es exactamente lo que pasaba, porque esta vista estaba escrita desde el
-- primer día y NO LA MIRABA NADIE: ni el mostrador, ni el almacén, ni el
-- navegador. La web sí descontaba lo apartado, así que el circuito estaba
-- partido por la mitad — internet contaba una cosa y el mostrador otra, sobre
-- el mismo estante—. Ahora la cuenta vive en una sola función y la usan los
-- dos lados.

/*
 * PUEDE SALIR NEGATIVO, y sale a propósito. Un −2 significa que se ha vendido
 * género que ya estaba comprometido con alguien: es justo el aviso que hay que
 * ver, y taparlo con un `greatest(0, …)` sería esconder el descuadre donde más
 * falta hace mirarlo. En la web sí se enseña topado a cero —a quien compra no
 * le sirve de nada un número negativo—, pero eso lo hace `catalogo_web`.
 *
 * `security definer` porque la llaman tanto la web pública (sin sesión) como el
 * panel; devuelve UN NÚMERO de un artículo que quien pregunta ya está viendo,
 * así que no descubre nada que no supiera.
 */
create or replace function disponible_de(p_producto_id uuid)
returns int
language sql stable security definer set search_path = public as $$
  select p.stock - coalesce((
           select sum(l.cantidad)::int
             from lineas_reserva l
             join reservas_tienda r on r.id = l.reserva_id
            where l.producto_id = p.id and r.estado = 'pendiente'
         ), 0)
    from productos p
   where p.id = p_producto_id
$$;

comment on function disponible_de(uuid) is
  'Lo que queda sin comprometer de un artículo: el stock de la estantería menos lo apartado por '
  'reservas de la web todavía sin recoger. Puede ser negativo, y entonces significa que se ha '
  'vendido en el mostrador algo que ya estaba prometido.';

grant execute on function disponible_de(uuid) to authenticated, anon;

create or replace view existencias_tienda
with (security_invoker = true) as
  select
    p.id,
    p.hermandad_id,
    p.codigo,
    p.nombre,
    p.stock,
    p.stock - disponible_de(p.id) as reservado,
    disponible_de(p.id) as disponible
  from productos p;

grant select on existencias_tienda to authenticated, anon;

comment on view existencias_tienda is
  '`stock` es lo que hay en la estantería; `disponible` es lo que se puede prometer, '
  'descontando lo apartado y sin recoger. `security_invoker` para que aplique la RLS de `productos`.';


-- ----------------------------------------------------------------------------
-- 3. RESERVAR DESDE LA WEB, sin sesión
-- ----------------------------------------------------------------------------
--
-- Quien reserva es un visitante: no ha entrado en ningún sitio y la única
-- llave que trae es la pública que viaja en el JavaScript de la web. Así que
-- esto NO puede ser un `insert` con una política abierta: sería dejar que el
-- navegador dijera qué cuesta cada cosa.
--
-- LO QUE SE COMPRUEBA AQUÍ, y ninguna de las cinco sobra:
--
--   1. Que el artículo sea de ESA hermandad, esté activo y publicado en la web.
--      Sin esto se puede reservar el género de otra hermandad, o uno retirado.
--   2. Que haya de verdad. Contra `disponible`, no contra `stock`.
--   3. EL PRECIO LO PONE LA BASE. Si viniera del navegador, cualquiera reserva
--      la medalla de cuarenta euros por cero.
--   4. Un tope por hora, como el resto de formularios públicos: sin él, un
--      barrido deja mil reservas y el género entero apartado para nadie.
--   5. Y se recorta todo lo que llega, para que no entre con megas dentro.
create or replace function crear_reserva_web(
  p_hermandad_id uuid,
  p_lineas jsonb,            -- [{producto_id, cantidad}]
  p_nombre text,
  p_email text default '',
  p_telefono text default '',
  p_notas text default '',
  p_dias_para_recoger int default 14
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_reserva uuid;
  v_ref text;
  v_anio int := extract(year from now())::int;
  v_n int;
  v_linea jsonb;
  v_prod productos%rowtype;
  v_disp int;
  v_cant int;
  v_total numeric(10, 2) := 0;
  v_recientes int;
  v_nombre text;
  v_hermano uuid;
  v_desc uuid;
  v_pct numeric(5, 2) := 0;
  v_precio numeric(10, 2);
begin
  if p_hermandad_id is null or not exists (select 1 from hermandades where id = p_hermandad_id) then
    raise exception 'No se sabe de qué hermandad es esta reserva.';
  end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'No has apartado nada.';
  end if;
  -- Un carrito con doscientas líneas no es una reserva, es un barrido.
  if jsonb_array_length(p_lineas) > 30 then
    raise exception 'Demasiados artículos en una sola reserva.';
  end if;

  v_nombre := left(trim(coalesce(p_nombre, '')), 120);
  if v_nombre = '' then
    raise exception 'Hace falta un nombre para poder llamarte.';
  end if;

  /*
   * ¿ESTÁ APARTANDO UN HERMANO?
   *
   * Se resuelve CONTRA LA SESIÓN y NUNCA desde un parámetro. Esta función está
   * concedida a `anon` —quien reserva desde la web no ha entrado en ningún
   * sitio—, así que un `p_hermano_id` sería el 50 % de costaleros para
   * cualquiera que abra la consola del navegador y escriba un uuid.
   *
   * `hermano_propio_id()` sale de `auth.uid()`, que aquí es de verdad quien
   * llama: `security definer` cambia con qué permisos se ejecuta esto, no quién
   * ha iniciado sesión. Si el hermano entró en su área y desde esa misma pestaña
   * abre la web de su hermandad, lleva el mismo cliente y el mismo JWT.
   *
   * Y se comprueba que sea de ESTA hermandad y no esté de baja: un hermano de
   * otra hermandad no tiene por qué llevarse el descuento de esta.
   */
  select h.id into v_hermano
    from hermanos h
   where h.id = hermano_propio_id()
     and h.hermandad_id = p_hermandad_id
     and h.estado <> 'Baja';

  if v_hermano is not null then
    select m.id, m.porcentaje into v_desc, v_pct
      from mejor_descuento_para(p_hermandad_id, v_hermano) m;
    v_pct := coalesce(v_pct, 0);
  end if;

  /*
   * EL TOPE POR HORA. La hora la pone la base (`creado_en` tiene `default
   * now()` y aquí no se toca), por lo mismo que en `mensajes_web_con_freno`:
   * si esa columna llegara de fuera, bastaría con ponerla tres días atrás para
   * que el contador no viera ninguna y el freno no existiera.
   */
  select count(*) into v_recientes from reservas_tienda
   where hermandad_id = p_hermandad_id and creado_en > now() - interval '1 hour';
  if v_recientes >= 40 then
    raise exception 'Ahora mismo no se pueden recoger más reservas. Inténtalo dentro de un rato.'
      using errcode = 'P0001';
  end if;

  -- La referencia, con cerrojo: dos navegadores a la vez sacarían la misma.
  perform pg_advisory_xact_lock(hashtext(p_hermandad_id::text || '|reserva|' || v_anio));
  select coalesce(max(substring(referencia from '[0-9]+$')::int), 0) + 1 into v_n
    from reservas_tienda
   where hermandad_id = p_hermandad_id and referencia like 'R-' || v_anio || '-%';
  v_ref := format('R-%s-%s', v_anio, v_n);

  insert into reservas_tienda (
    hermandad_id, referencia, nombre, email, telefono, notas, recoger_antes_de
  ) values (
    p_hermandad_id, v_ref, v_nombre,
    left(trim(coalesce(p_email, '')), 160),
    left(trim(coalesce(p_telefono, '')), 40),
    left(trim(coalesce(p_notas, '')), 1000),
    current_date + greatest(1, least(90, coalesce(p_dias_para_recoger, 14)))
  ) returning id into v_reserva;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cant := coalesce((v_linea ->> 'cantidad')::int, 0);
    if v_cant <= 0 then
      raise exception 'Una línea sin cantidad no se puede apartar.';
    end if;
    -- Un tope por línea: nadie aparta doscientas camisetas desde la web.
    if v_cant > 50 then
      raise exception 'Para tantas unidades, llama a la hermandad.';
    end if;

    -- `for update` sobre el producto: es lo que impide que dos visitantes
    -- aparten a la vez la última unidad.
    select * into v_prod from productos p
     where p.id = (v_linea ->> 'producto_id')::uuid
       and p.hermandad_id = p_hermandad_id
       and p.activo and p.visible_en_web
     for update;
    if not found then
      raise exception 'Ese artículo ya no está a la venta.';
    end if;

    select disponible into v_disp from existencias_tienda where id = v_prod.id;
    if coalesce(v_disp, 0) < v_cant then
      raise exception 'De «%» ya solo quedan % sin apartar.', v_prod.nombre, greatest(0, coalesce(v_disp, 0));
    end if;

    /*
     * EL PRECIO, CON LA MISMA FÓRMULA QUE COBRA EL MOSTRADOR.
     *
     * `round(precio * (1 - pct/100), 2)`, letra por letra igual que en
     * `registrar_venta`. No es celo: si la web dijera 0,57 y la caja cobrara
     * 0,58, el problema no sería el céntimo — sería que la web mintió, y con un
     * resguardo por escrito de por medio.
     */
    v_precio := round(v_prod.precio * (1 - v_pct / 100), 2);

    insert into lineas_reserva (
      hermandad_id, reserva_id, producto_id, codigo, nombre, cantidad, precio_unitario, precio_tarifa
    ) values (
      p_hermandad_id, v_reserva, v_prod.id, v_prod.codigo, v_prod.nombre, v_cant, v_precio, v_prod.precio
    );
    v_total := v_total + round(v_precio * v_cant, 2);
  end loop;

  update reservas_tienda
     set total = v_total, hermano_id = v_hermano, descuento_id = v_desc, descuento_pct = v_pct
   where id = v_reserva;

  /*
   * Y SE AVISA A QUIEN LLEVA EL INVENTARIO. Una reserva que nadie mira es
   * alguien que se planta en la casa hermandad a por algo que no le han
   * apartado. Mismo criterio que el aviso de «queda poco»: a quien lleva el
   * módulo, por las dos vías por las que se gestiona.
   */
  insert into avisos_hermano (hermandad_id, hermano_id, texto, tipo, titulo)
  select distinct p_hermandad_id, h.id,
         format('%s ha apartado %s€ desde la web (%s). Pasará a recogerlo.',
                v_nombre, to_char(v_total, 'FM999999990.00'), v_ref),
         'existencias', 'Nueva reserva en la tienda'
    from hermanos h
   where h.hermandad_id = p_hermandad_id
     and h.estado <> 'Baja'
     and (
       exists (select 1 from permisos_cargo pc
                where pc.hermandad_id = h.hermandad_id and pc.cargo = h.cargo
                  and pc.modulo_id = 'inventario')
       or exists (select 1 from personal p
                    join permisos_cargo pc2 on pc2.cargo = p.cargo and pc2.hermandad_id = p.hermandad_id
                   where p.hermandad_id = h.hermandad_id and p.auth_user_id = h.auth_user_id
                     and p.activo and pc2.modulo_id = 'inventario')
     );

  return jsonb_build_object('referencia', v_ref, 'total', v_total,
                            'recoger_antes_de', current_date + greatest(1, least(90, coalesce(p_dias_para_recoger, 14))));
end $$;

revoke all on function crear_reserva_web(uuid, jsonb, text, text, text, text, int) from public;
-- A `anon` a propósito: quien reserva desde la web no ha entrado en ningún
-- sitio. Todo lo que puede hacer está acotado ahí arriba.
grant execute on function crear_reserva_web(uuid, jsonb, text, text, text, text, int) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 4. Entregar una reserva: se cobra y se convierte en venta
-- ----------------------------------------------------------------------------
--
-- Aquí es donde nace la factura y donde entran los dos asientos, no antes.
-- Se reutiliza `registrar_venta()` entera para que una venta de la web y una
-- del mostrador se apunten EXACTAMENTE igual: el día que cambie la forma de
-- contabilizar, cambia en un sitio.
create or replace function entregar_reserva(
  p_reserva_id uuid,
  p_forma_pago text default 'Efectivo'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_res reservas_tienda%rowtype;
  v_lineas jsonb;
  v_venta jsonb;
  v_huerfanas int;
begin
  if not modulo_permitido('inventario') then
    raise exception 'Solo quien lleva el inventario puede entregar una reserva.';
  end if;

  select * into v_res from reservas_tienda r
   where r.id = p_reserva_id and r.hermandad_id = v_hermandad for update;
  if not found then
    raise exception 'Esa reserva no es de esta hermandad.';
  end if;
  if v_res.estado <> 'pendiente' then
    raise exception 'Esa reserva ya está %.', v_res.estado;
  end if;

  /*
   * SI ALGÚN ARTÍCULO DE LA RESERVA YA NO EXISTE, SE PARA.
   *
   * El `producto_id is not null` de abajo descartaba en silencio las líneas
   * huérfanas —las de un artículo borrado del catálogo después de reservarlo—.
   * Con tres artículos apartados y uno borrado, se facturaban dos y el tercero
   * desaparecía sin que nadie lo dijera: ni quien cobra ni quien recoge se
   * enteraban de que la reserva no era la que se firmó.
   *
   * Se cuenta primero y se avisa, que es lo que ya hacía la rama de la
   * demostración. Rehacer la reserva es trabajo de un minuto; descubrir dentro
   * de un mes que faltó un artículo en una factura, no.
   */
  select count(*) into v_huerfanas
    from lineas_reserva l
   where l.reserva_id = p_reserva_id and l.producto_id is null;
  if v_huerfanas > 0 then
    raise exception 'Esta reserva tiene % % que ya no está% en el catálogo. Suéltala y hazla de nuevo con lo que sí hay.',
      v_huerfanas,
      case when v_huerfanas = 1 then 'artículo' else 'artículos' end,
      case when v_huerfanas = 1 then '' else 'n' end;
  end if;

  -- Las líneas, con el precio que se le prometió a quien reservó. Si la
  -- hermandad ha subido el precio entretanto, se respeta el de la reserva: se
  -- lo apartaron a ese precio.
  select jsonb_agg(jsonb_build_object(
           'producto_id', l.producto_id,
           'cantidad', l.cantidad,
           'precio_unitario', l.precio_unitario))
    into v_lineas
    from lineas_reserva l
   where l.reserva_id = p_reserva_id and l.producto_id is not null;

  if v_lineas is null then
    raise exception 'Esa reserva se ha quedado sin artículos: ya no existen en el catálogo.';
  end if;

  /*
   * LA RESERVA SE MARCA ENTREGADA **ANTES** DE FACTURARLA, y el orden no es un
   * capricho: es la trampa entera de este arreglo.
   *
   * Desde que `registrar_venta` mira lo disponible y no el stock, las líneas de
   * esta misma reserva cuentan como apartadas mientras siga «pendiente». Con el
   * `update` detrás, la reserva se bloqueaba a sí misma: entregar una reserva
   * perfectamente válida contestaba «de "Camiseta" solo quedan 0 sin apartar».
   *
   * Es la misma transacción, así que no se abre ningún hueco: si `registrar_venta`
   * levanta una excepción, se deshace también este `update` y la reserva sigue
   * pendiente, igual que antes.
   */
  update reservas_tienda set estado = 'entregada' where id = p_reserva_id;

  /*
   * SE FACTURA A NOMBRE DEL HERMANO Y CON SU DESCUENTO, si lo hubo.
   *
   * Las líneas siguen llevando el precio PROMETIDO, y no hay doble descuento:
   * la regla «precio a mano manda» de `registrar_venta` lo garantiza, y ese
   * precio ya viene rebajado de cuando se apartó. El `descuento_id` va para que
   * la factura y los informes puedan decir POR QUÉ costó eso; sin él, una
   * factura de la web con precios rebajados no tiene explicación en ninguna
   * parte.
   *
   * El `case when` no sobra: si entre la reserva y la entrega alguien apaga ese
   * descuento —o el hermano pierde la etiqueta—, `registrar_venta` levantaría
   * excepción y la reserva no se podría entregar. Lo que se le prometió se le
   * cobra igual; lo único que se pierde es la nota de por qué.
   */
  v_venta := registrar_venta(
    v_lineas, 'online', p_forma_pago,
    v_res.hermano_id,
    case when pct_de_descuento(v_hermandad, v_res.descuento_id, v_res.hermano_id) is not null
         then v_res.descuento_id end,
    v_res.nombre, '', '',
    format('Reserva %s', v_res.referencia)
  );

  update reservas_tienda
     set venta_id = (v_venta ->> 'id')::uuid
   where id = p_reserva_id;

  return v_venta;
end $$;

revoke all on function entregar_reserva(uuid, text) from public, anon;
grant execute on function entregar_reserva(uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Soltar una reserva
-- ----------------------------------------------------------------------------
--
-- No se borra, se marca. Una reserva borrada es una llamada de teléfono que
-- nadie puede explicar: «yo aparté una camiseta la semana pasada» y no hay
-- rastro de nada. Al dejar de estar «pendiente», el género vuelve a contar
-- como disponible solo (`existencias_tienda` mira el estado).
/*
 * DEVUELVE SI DE VERDAD HA SOLTADO ALGO, y esto no es un detalle.
 *
 * Empezó devolviendo `void`, con las tres condiciones metidas en el `where` del
 * `update`. Y ahí un `update` que no encuentra fila NO ES UN ERROR: afecta a
 * cero filas y Postgres dice que todo ha ido bien. Así que soltar una reserva
 * que ya estaba entregada —o de otra hermandad, o que otro acababa de anular
 * desde el ordenador de al lado— no hacía nada y la pantalla contestaba
 * «anulada, el género vuelve a estar disponible». Una pantalla que da por
 * hecho lo que no ha pasado es peor que un error: nadie vuelve a mirarlo.
 *
 * `drop` antes de `create`: cambia el tipo devuelto y `create or replace` no
 * lo permite. Sin esto, volver a ejecutar el fichero fallaba aquí.
 */
drop function if exists soltar_reserva(uuid, text, text);
create or replace function soltar_reserva(
  p_reserva_id uuid,
  p_motivo text default '',
  p_estado text default 'anulada'
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_cuantas int;
begin
  if not modulo_permitido('inventario') then
    raise exception 'Solo quien lleva el inventario puede soltar una reserva.';
  end if;
  if p_estado not in ('anulada', 'caducada') then
    raise exception 'Una reserva solo se puede soltar como anulada o caducada.';
  end if;
  update reservas_tienda
     set estado = p_estado,
         notas = trim(both ' ' from coalesce(notas, '') || ' · ' || coalesce(p_motivo, ''))
   where id = p_reserva_id and hermandad_id = v_hermandad and estado = 'pendiente';
  get diagnostics v_cuantas = row_count;
  return v_cuantas > 0;
end $$;

revoke all on function soltar_reserva(uuid, text, text) from public, anon;
grant execute on function soltar_reserva(uuid, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Quién ve qué
-- ----------------------------------------------------------------------------
alter table reservas_tienda enable row level security;
alter table lineas_reserva enable row level security;

do $$
declare t text;
begin
  foreach t in array array['reservas_tienda', 'lineas_reserva'] loop
    execute format('drop policy if exists "solo_mi_hermandad" on %I', t);
    execute format(
      'create policy "solo_mi_hermandad" on %I as restrictive for all to authenticated '
      'using (hermandad_id = hermandad_actual()) with check (hermandad_id = hermandad_actual())', t);
    execute format('drop policy if exists "tienda_gestiona" on %I', t);
    execute format(
      'create policy "tienda_gestiona" on %I for all to authenticated '
      'using (modulo_permitido(''inventario'')) with check (modulo_permitido(''inventario''))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

/*
 * QUIEN RESERVA NO PUEDE LEER NADA, ni siquiera lo suyo.
 *
 * No hay política para `anon`, y es a propósito: con una lectura abierta,
 * cualquiera se baja los nombres, correos y teléfonos de todo el que ha
 * reservado. El resguardo se le enseña en pantalla al terminar y se le manda
 * por correo; para lo demás está el teléfono de la hermandad.
 */


-- ----------------------------------------------------------------------------
-- 7. EL CATÁLOGO QUE VE EL VISITANTE
-- ----------------------------------------------------------------------------
--
-- `catalogo_tienda` y `existencias_tienda` NO le sirven a quien entra en la
-- web sin cuenta, y conviene entender por qué antes de tocar nada.
--
-- Las dos son vistas `security_invoker`: se ejecutan con los permisos de quien
-- las mira. La política que abre `productos` está escrita `to authenticated`,
-- así que un visitante anónimo las lee vacías —o directamente le rebota, si
-- por debajo hay una tabla sobre la que no tiene ni el `grant`—. Es exactamente
-- lo que debe pasar: quitar ese `to authenticated` para que la web funcione
-- sería abrir la tabla entera, con el `coste` dentro.
--
-- Y en `existencias_tienda` sería peor: para calcular lo reservado mira
-- `lineas_reserva`, que cuelga de `reservas_tienda`, donde están los nombres,
-- los correos y los teléfonos de todo el que ha apartado algo.
--
-- Así que la web pública lee por AQUÍ, que es como leen todo lo demás las
-- páginas públicas de Gobergo (`hermandad_de_la_web`, `hermandades_publicas`):
-- una función que devuelve UNO A UNO los campos que ya salen impresos en la
-- página. Si mañana `productos` gana una columna con algo delicado, no se cuela
-- sola por aquí.
--
-- Va por SLUG, no por identificador: es lo que el navegador tiene en la barra
-- de direcciones. Y solo responde si la web está publicada — una hermandad que
-- está preparando la suya no enseña su género todavía.
/*
 * EL PRECIO DE HERMANO, TAMBIÉN AQUÍ.
 *
 * Hasta ahora el descuento de hermano solo existía en el mostrador: el hermano
 * que compraba por internet pagaba tarifa, y no había nada en pantalla que le
 * dijera que entrando en su área le habría costado menos. Un descuento que solo
 * conoce quien ya lo tenía no es un descuento, es un secreto.
 *
 * EL NAVEGADOR NO DICE QUIÉN ES Y NO SE LE CREE NADA. La página se limita a
 * llamar aquí; quién está navegando lo resuelve la base con `hermano_propio_id()`
 * a partir de la sesión, y el precio lo calcula ella. Sin sesión, `precio_hermano`
 * viene `null` —no igual al precio— para que la página pueda distinguir «no le
 * toca ninguno» de «no ha entrado», que se dicen de forma muy distinta.
 *
 * Y NO SE DEVUELVE NI EL NOMBRE NI EL ID DEL HERMANO: solo números. Esta función
 * la puede llamar cualquiera, y lo que contesta no puede servir para averiguar
 * quién es nadie.
 *
 * `drop` antes de `create`: cambia el tipo devuelto y `create or replace` no lo
 * permite. Sin esto, volver a ejecutar el fichero falla aquí — es exactamente
 * lo que ya le pasó a `soltar_reserva`.
 */
drop function if exists catalogo_web(text);
create or replace function catalogo_web(p_slug text)
returns table (
  id uuid,
  codigo text,
  nombre text,
  descripcion text,
  precio numeric,
  precio_hermano numeric,
  descuento_pct numeric,
  iva numeric,
  foto_url text,
  disponible int
)
language sql stable security definer set search_path = public as $$
  with sitio as (
    select w.hermandad_id
      from web_publica w
     where w.slug = p_slug
       -- Publicada, o de la gente de esa misma hermandad: es lo que hace que la
       -- vista previa del panel enseñe el género antes de publicar la web. La
       -- excepción NO se la cree a nadie por decirlo —no hay ningún parámetro de
       -- «soy de la casa»—: se comprueba contra la sesión, aquí y en el servidor.
       and (w.publicada or w.hermandad_id = hermandad_actual())
  ),
  -- Quien esté navegando, SI ha entrado en su área y SI es hermano de esta
  -- hermandad. Para todos los demás esto está vacío y no pasa nada más.
  quien as (
    select h.id
      from hermanos h, sitio s
     where h.id = hermano_propio_id()
       and h.hermandad_id = s.hermandad_id
       and h.estado <> 'Baja'
  ),
  suyo as (
    select m.porcentaje
      from sitio s, quien q, mejor_descuento_para(s.hermandad_id, q.id) m
  )
  select
    p.id, p.codigo, p.nombre, p.descripcion, p.precio,
    -- La misma fórmula, letra por letra, que aplica `registrar_venta` al cobrar.
    (select round(p.precio * (1 - porcentaje / 100), 2) from suyo) as precio_hermano,
    (select porcentaje from suyo) as descuento_pct,
    p.iva, p.foto_url,
    -- Topado a cero: a quien compra no le sirve de nada un número negativo. En
    -- el panel sí se enseña tal cual, porque allí es la alarma.
    greatest(0, disponible_de(p.id))::int as disponible
  from sitio s
  join productos p on p.hermandad_id = s.hermandad_id
  where p.activo and p.visible_en_web
  order by p.nombre
$$;

revoke all on function catalogo_web(text) from public;
grant execute on function catalogo_web(text) to anon, authenticated;

comment on function catalogo_web(text) is
  'El género publicado de una hermandad, para su web pública. Sin `coste` y sin '
  '`stock` real: solo lo que se puede prometer.';


-- ----------------------------------------------------------------------------
-- 8. Y DE QUÉ HERMANDAD ES ESA WEB
-- ----------------------------------------------------------------------------
--
-- `crear_reserva_web` necesita el identificador de la hermandad, y el
-- navegador solo tiene el slug. Esto lo traduce, y únicamente si la web está
-- publicada: sin esa condición, el slug sería una forma de averiguar el
-- identificador de una hermandad que todavía no ha salido.
create or replace function hermandad_de_la_tienda(p_slug text) returns uuid
language sql stable security definer set search_path = public as $$
  select w.hermandad_id from web_publica w where w.slug = p_slug and w.publicada limit 1
$$;

revoke all on function hermandad_de_la_tienda(text) from public;
grant execute on function hermandad_de_la_tienda(text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 9. EL RESGUARDO POR CORREO
-- ----------------------------------------------------------------------------
--
-- Quien reserva no tiene cuenta y no puede volver a consultar nada: lo único
-- que se lleva es la referencia que sale en pantalla. Si cierra la pestaña sin
-- apuntarla, se planta en la casa de hermandad sin saber qué dijo, y quien
-- está en el mostrador tiene que buscarla por el nombre.
--
-- Así que se le manda por correo. Y lo manda EL SERVIDOR, no el navegador, por
-- lo mismo que la confirmación de la lista de avisos: el navegador diría a qué
-- dirección, y entonces esta función sería una forma de mandarle un correo con
-- membrete de la hermandad a quien uno quiera. Aquí el destinatario se LEE de
-- la reserva que se acaba de crear.
--
-- LOS TRES CIERRES, y ninguno sobra:
--
--   · Solo si está pendiente. Una reserva entregada o anulada no manda nada.
--   · Solo en la media hora siguiente a crearla. Pasado eso, probar
--     referencias una detrás de otra —R-2027-1, R-2027-2…— no sirve de nada.
--   · Solo UNA VEZ. Se marca al devolverla, así que repetir la llamada con la
--     misma referencia no le llena el buzón a nadie.
alter table reservas_tienda add column if not exists resguardo_enviado_en timestamptz;

create or replace function resguardo_de_reserva(p_hermandad_id uuid, p_referencia text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res reservas_tienda%rowtype;
  v_lineas jsonb;
  v_hermandad text;
begin
  select * into v_res from reservas_tienda r
   where r.hermandad_id = p_hermandad_id
     and r.referencia = p_referencia
     and r.estado = 'pendiente'
     and r.resguardo_enviado_en is null
     and r.creado_en > now() - interval '30 minutes'
   for update;
  -- Sin fila se devuelve NADA, sin decir por qué: distinguir «no existe» de
  -- «ya se mandó» desde fuera sería una forma de preguntar quién ha reservado.
  if not found then return null; end if;
  if v_res.email = '' then return null; end if;

  select jsonb_agg(jsonb_build_object(
           'nombre', l.nombre, 'cantidad', l.cantidad, 'importe', l.precio_unitario * l.cantidad)
         order by l.nombre)
    into v_lineas
    from lineas_reserva l where l.reserva_id = v_res.id;

  select h.nombre into v_hermandad from hermandades h where h.id = p_hermandad_id;

  update reservas_tienda set resguardo_enviado_en = now() where id = v_res.id;

  return jsonb_build_object(
    'email', v_res.email,
    'nombre', v_res.nombre,
    'referencia', v_res.referencia,
    'total', v_res.total,
    'recoger_antes_de', v_res.recoger_antes_de,
    'hermandad', coalesce(v_hermandad, ''),
    'lineas', coalesce(v_lineas, '[]'::jsonb)
  );
end $$;

-- Solo la clave de servicio, que es la que usa `enviar-correo`. Desde el
-- navegador NO: devuelve el correo y el teléfono de quien reservó.
revoke all on function resguardo_de_reserva(uuid, text) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 10. «TU RESERVA ESTÁ LISTA»
-- ----------------------------------------------------------------------------
--
-- Lo que faltaba del circuito y lo que más se nota: quien aparta algo por la
-- web recibe su resguardo y luego NO VUELVE A SABER NADA. Se le dice «pásate
-- cuando puedas» y ahí acaba. Si el género hay que pedirlo, o hay que grabar la
-- medalla, la persona se planta un martes por la tarde a por algo que todavía
-- no está — o no se planta nunca, y el plazo se cumple con la reserva viva y el
-- género apartado para nadie.
--
-- LO DISPARA UNA PERSONA DESDE EL PANEL, no un reloj. Y no por comodidad:
-- mandar un correo desde la base exigiría guardar dentro de ella la clave del
-- proveedor de envío, y eso está descartado por escrito en
-- `tareas-programadas.sql`. Quien prepara la reserva es quien sabe que está
-- lista, así que es quien lo dice.
--
-- LLEGA POR DOS SITIOS, Y LOS DOS HACEN FALTA:
--
--   · Un aviso en su área del hermano, si resultó ser hermano de la casa. Ahí
--     se queda escrito y no depende de que el correo llegue.
--   · Y un correo, si dejó dirección. Es lo único que llega a quien no es
--     hermano y a quien no entra nunca en su área.

alter table reservas_tienda add column if not exists lista_en   timestamptz;
alter table reservas_tienda add column if not exists avisada_en timestamptz;

/*
 * MARCARLA COMO LISTA. La llama el panel, con sesión y con permiso.
 *
 * Devuelve `hermandad_id` y `referencia` porque es lo que el navegador necesita
 * para pedir el correo después, y no tiene por qué adivinarlo; y `hay_correo`
 * para poder decir en pantalla si de verdad se va a mandar algo o si a esa
 * persona hay que llamarla por teléfono.
 */
create or replace function avisar_reserva_lista(p_reserva_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_res reservas_tienda%rowtype;
  v_repetida boolean;
begin
  if not modulo_permitido('inventario') then
    raise exception 'Solo quien lleva el inventario puede avisar de una reserva.';
  end if;

  select * into v_res from reservas_tienda r
   where r.id = p_reserva_id and r.hermandad_id = v_hermandad
   for update;
  if not found then
    raise exception 'Esa reserva no es de esta hermandad.';
  end if;
  if v_res.estado <> 'pendiente' then
    raise exception 'Esa reserva ya está %, así que no hay nada que avisar.', v_res.estado;
  end if;

  -- Avisar dos veces el mismo día no es insistir, es molestar. Se dice que ya
  -- estaba avisada en vez de callarse: la pantalla tiene que poder contarlo.
  v_repetida := v_res.avisada_en is not null and v_res.avisada_en > now() - interval '1 day';

  update reservas_tienda set lista_en = coalesce(lista_en, now()) where id = p_reserva_id;

  /*
   * EL AVISO EN SU ÁREA, si es hermano. Va aquí y no en el correo porque es lo
   * único que no se pierde: un correo puede acabar en la carpeta de spam, y
   * entonces no queda rastro de que se le avisó.
   */
  if v_res.hermano_id is not null and not v_repetida then
    insert into avisos_hermano (hermandad_id, hermano_id, texto, tipo, titulo)
    values (
      v_hermandad, v_res.hermano_id,
      format('Ya puedes pasar a recoger lo que apartaste (%s). Son %s€, que se pagan al recogerlo%s.',
             v_res.referencia,
             to_char(v_res.total, 'FM999999990.00'),
             case when v_res.recoger_antes_de is null then ''
                  else format(', y te lo guardamos hasta el %s',
                              to_char(v_res.recoger_antes_de, 'DD/MM/YYYY')) end),
      'tienda', 'Tu reserva está lista'
    );
  end if;

  return jsonb_build_object(
    'hermandad_id', v_hermandad,
    'referencia', v_res.referencia,
    'hay_correo', v_res.email <> '',
    'es_hermano', v_res.hermano_id is not null,
    'ya_avisada', v_repetida
  );
end $$;

revoke all on function avisar_reserva_lista(uuid) from public, anon;
grant execute on function avisar_reserva_lista(uuid) to authenticated;

/*
 * Y LO QUE LEE `enviar-correo` PARA MANDARLO, con los mismos cierres que el
 * resguardo. Calcada de `resguardo_de_reserva` a propósito: es la misma clase
 * de función —devuelve un correo y un nombre— y los mismos cierres tienen que
 * seguir puestos.
 *
 *   · Solo si alguien la ha marcado lista. Sin eso, esto sería una forma de
 *     sacar el correo de cualquiera que haya reservado, probando referencias.
 *   · Solo una vez al día. Sin ese freno, el botón del panel sería una manera
 *     de mandarle veinte correos a alguien.
 *   · Y sin fila, NADA, sin decir por qué: distinguir «no existe» de «ya se
 *     mandó» desde fuera vuelve a ser una forma de preguntar quién ha
 *     reservado.
 */
create or replace function datos_para_avisar_reserva(p_hermandad_id uuid, p_referencia text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res reservas_tienda%rowtype;
  v_lineas jsonb;
  v_hermandad text;
begin
  select * into v_res from reservas_tienda r
   where r.hermandad_id = p_hermandad_id
     and r.referencia = p_referencia
     and r.estado = 'pendiente'
     and r.lista_en is not null
     and (r.avisada_en is null or r.avisada_en < now() - interval '1 day')
   for update;
  if not found then return null; end if;
  if v_res.email = '' then return null; end if;

  select jsonb_agg(jsonb_build_object(
           'nombre', l.nombre, 'cantidad', l.cantidad, 'importe', l.precio_unitario * l.cantidad)
         order by l.nombre)
    into v_lineas
    from lineas_reserva l where l.reserva_id = v_res.id;

  select h.nombre into v_hermandad from hermandades h where h.id = p_hermandad_id;

  update reservas_tienda set avisada_en = now() where id = v_res.id;

  return jsonb_build_object(
    'email', v_res.email,
    'nombre', v_res.nombre,
    'referencia', v_res.referencia,
    'total', v_res.total,
    'recoger_antes_de', v_res.recoger_antes_de,
    'hermandad', coalesce(v_hermandad, ''),
    'lineas', coalesce(v_lineas, '[]'::jsonb)
  );
end $$;

-- Solo la clave de servicio, igual que el resguardo: desde el navegador NO,
-- porque devuelve el correo de quien reservó.
revoke all on function datos_para_avisar_reserva(uuid, text) from public, anon, authenticated;
