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
create or replace view existencias_tienda
with (security_invoker = true) as
  select
    p.id,
    p.hermandad_id,
    p.codigo,
    p.nombre,
    p.stock,
    coalesce((
      select sum(l.cantidad)::int
        from lineas_reserva l
        join reservas_tienda r on r.id = l.reserva_id
       where l.producto_id = p.id and r.estado = 'pendiente'
    ), 0) as reservado,
    p.stock - coalesce((
      select sum(l.cantidad)::int
        from lineas_reserva l
        join reservas_tienda r on r.id = l.reserva_id
       where l.producto_id = p.id and r.estado = 'pendiente'
    ), 0) as disponible
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

    insert into lineas_reserva (hermandad_id, reserva_id, producto_id, codigo, nombre, cantidad, precio_unitario)
      values (p_hermandad_id, v_reserva, v_prod.id, v_prod.codigo, v_prod.nombre, v_cant, v_prod.precio);
    v_total := v_total + round(v_prod.precio * v_cant, 2);
  end loop;

  update reservas_tienda set total = v_total where id = v_reserva;

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

  v_venta := registrar_venta(
    v_lineas, 'online', p_forma_pago, null, null,
    v_res.nombre, '', '',
    format('Reserva %s', v_res.referencia)
  );

  update reservas_tienda
     set estado = 'entregada', venta_id = (v_venta ->> 'id')::uuid
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
create or replace function catalogo_web(p_slug text)
returns table (
  id uuid,
  codigo text,
  nombre text,
  descripcion text,
  precio numeric,
  iva numeric,
  foto_url text,
  disponible int
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.codigo, p.nombre, p.descripcion, p.precio, p.iva, p.foto_url,
    greatest(0, p.stock - coalesce((
      select sum(l.cantidad)::int
        from lineas_reserva l
        join reservas_tienda r on r.id = l.reserva_id
       where l.producto_id = p.id and r.estado = 'pendiente'
    ), 0))::int as disponible
  from web_publica w
  join productos p on p.hermandad_id = w.hermandad_id
  where w.slug = p_slug
    -- Publicada, o de la gente de esa misma hermandad: es lo que hace que la
    -- vista previa del panel enseñe el género antes de publicar la web. La
    -- excepción NO se la cree a nadie por decirlo —no hay ningún parámetro de
    -- «soy de la casa»—: se comprueba contra la sesión, aquí y en el servidor.
    and (w.publicada or w.hermandad_id = hermandad_actual())
    and p.activo and p.visible_en_web
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
