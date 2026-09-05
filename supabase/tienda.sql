-- ============================================================================
--   LA TIENDA DE LA HERMANDAD
-- ============================================================================
--
-- Vender merchandising —camisetas, medallas, llaveros, el libro del centenario—
-- es una fuente de ingresos real y hasta ahora no estaba en ningún sitio: se
-- llevaba en una libreta y se metía en Tesorería a final de mes, a ojo. Con eso
-- no se sabe qué se vende, qué queda ni cuánto se gana.
--
-- LO QUE HAY AQUÍ. Cuatro tablas y una función:
--
--   · `productos`         la ficha de cada artículo: código, precio, coste,
--                         IVA, cuántos quedan y por debajo de cuántos avisar.
--   · `ventas`            una por operación, con su número de factura.
--   · `lineas_venta`      lo que llevaba cada venta, con FOTO del producto.
--   · `movimientos_stock` por qué subió o bajó el stock: venta, rotura, compra…
--   · `descuentos`        rebajas por colectivo (los costaleros, los del coro…).
--   · `registrar_venta()` la que lo hace TODO de una vez, y es el corazón.
--
-- POR QUÉ UNA FUNCIÓN Y NO ESCRIBIR DESDE LA APLICACIÓN. Una venta son seis
-- cosas que tienen que pasar juntas o no pasar: coger el número de factura,
-- guardar la venta, guardar sus líneas, bajar el stock, apuntar por qué bajó,
-- y dejar los dos asientos en Tesorería. Hechas desde el navegador, una
-- conexión que se corta a la mitad deja stock descontado sin venta, o una
-- factura con un número que otro ya usó.
--
-- Y hay dos cosas que NO se pueden hacer desde el navegador de ninguna manera:
--
--   1. EL NÚMERO DE FACTURA. Tiene que ser correlativo y sin huecos. Calculado
--      con un `max()+1` desde dos mostradores a la vez, salen dos facturas con
--      el mismo número. Aquí se coge con un cerrojo.
--   2. QUE NO SE VENDA LO QUE NO HAY. Dos personas cobrando la última camiseta
--      a la vez la venden las dos. Aquí el stock se descuenta con la fila
--      bloqueada.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Los productos
-- ----------------------------------------------------------------------------
--
-- OJO, ESTO NO ES `enseres`. Aquel es el patrimonio de la hermandad —la cruz de
-- guía, los faldones, los ciriales—: cosas que se inventarían, se aseguran y
-- se restauran, y que no se venden nunca. Esto es género para vender. Mezclar
-- las dos cosas en una tabla haría que un candelabro del siglo XVIII apareciera
-- en el listado de la tienda con un precio.
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  -- El código de artículo que la hermandad usa en su etiqueta. Único dentro de
  -- la hermandad, no en toda la base: dos hermandades pueden llamar «CAM-01» a
  -- su camiseta y las dos tienen razón.
  codigo text not null,
  nombre text not null,
  descripcion text not null default '',
  /*
   * EL PRECIO ES CON IVA INCLUIDO, que es lo que se dice en el mostrador y lo
   * que el hermano ve en la etiqueta. La base imponible y la cuota de IVA se
   * calculan a partir de él para la factura.
   *
   * Al revés —guardar la base y sumar el IVA— obliga a quien da de alta un
   * producto a hacer una división para poner «12,40» cuando lo que quiere es
   * vender a 15. Es la fuente de erratas más tonta que hay.
   */
  precio numeric(10, 2) not null default 0,
  -- Lo que le costó a la hermandad. De aquí sale el beneficio y el asiento de
  -- gasto cuando se vende.
  coste numeric(10, 2) not null default 0,
  -- El IVA que se repercute. Una hermandad exenta lo deja en 0 y la factura
  -- sale sin desglose.
  iva numeric(5, 2) not null default 21 check (iva >= 0 and iva <= 100),
  stock int not null default 0,
  -- Por debajo de esto se avisa a quien lleva el inventario. 0 = no avisar.
  stock_minimo int not null default 0,
  activo boolean not null default true,
  -- Si sale o no en la tienda de la web pública.
  visible_en_web boolean not null default false,
  foto_url text,
  creado_en timestamptz not null default now(),
  unique (hermandad_id, codigo)
);
create index if not exists productos_hermandad_idx on productos (hermandad_id, activo);

comment on column productos.precio is
  'PVP con IVA incluido: es lo que se dice en el mostrador. La base y la cuota se calculan a partir de él.';
comment on column productos.stock_minimo is
  'Por debajo de esta cantidad se avisa a quien lleva el módulo de inventario. 0 = no avisar.';


-- ----------------------------------------------------------------------------
-- 2. Los descuentos por colectivo
-- ----------------------------------------------------------------------------
--
-- «A los costaleros, la camiseta a mitad de precio.» Se resuelve por las
-- etiquetas que ya lleva la ficha del hermano, que es donde la hermandad tiene
-- escrito quién es costalero, quién va en el coro y quién es acólito. Sin
-- inventar una segunda lista que habría que mantener aparte y que se quedaría
-- vieja.
create table if not exists descuentos (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  nombre text not null,
  porcentaje numeric(5, 2) not null default 0 check (porcentaje >= 0 and porcentaje <= 100),
  -- La etiqueta de la ficha que da derecho a él. Vacío = cualquier hermano.
  etiqueta text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index if not exists descuentos_hermandad_idx on descuentos (hermandad_id, activo);

/*
 * A QUIÉN LE TOCA UN DESCUENTO: UNA SOLA DEFINICIÓN DEL CRITERIO.
 *
 * Estaba escrito dentro de `registrar_venta`, y con el descuento llegando
 * también a la web pública habría acabado escrito TRES VECES: aquí, en el
 * catálogo y en la reserva. Tres sitios donde decidir lo mismo son tres sitios
 * donde se puede decidir distinto, y entonces la web promete un precio y el
 * mostrador cobra otro.
 *
 * Devuelve el porcentaje, o `null` si no le toca. `null` y no cero a propósito:
 * son dos cosas distintas —«no le corresponde» y «le corresponde un 0 %»— y de
 * esa diferencia depende que `registrar_venta` rechace la venta o la deje pasar.
 */
create or replace function pct_de_descuento(
  p_hermandad_id uuid,
  p_descuento_id uuid,
  p_hermano_id uuid
) returns numeric
language sql stable security definer set search_path = public as $$
  select d.porcentaje
    from descuentos d
   where d.id = p_descuento_id
     and d.hermandad_id = p_hermandad_id
     and d.activo
     and (
       -- Sin etiqueta vale para cualquier hermano… pero hermano tiene que ser:
       -- los descuentos son de la hermandad para su gente.
       (d.etiqueta is null and p_hermano_id is not null)
       or (p_hermano_id is not null and exists (
            select 1 from hermanos h
             where h.id = p_hermano_id
               and h.hermandad_id = p_hermandad_id
               and h.estado <> 'Baja'
               and d.etiqueta = any (coalesce(h.etiquetas, array[]::text[]))
          ))
     )
$$;

comment on function pct_de_descuento(uuid, uuid, uuid) is
  'El porcentaje de un descuento SI le corresponde a ese hermano, y null si no. Es el único sitio '
  'donde se decide: lo usan el mostrador, el catálogo de la web y la reserva.';

/*
 * Y EL MEJOR QUE LE TOCA, cuando no lo elige nadie a mano.
 *
 * En el mostrador el descuento lo elige una persona de una lista. En la web no
 * hay nadie que elija, así que hay que decidirlo: SE APLICA UNO SOLO, EL MAYOR.
 *
 * No es una comodidad, es lo único que la factura puede representar: `ventas`
 * tiene una columna `descuento_id`, no una tabla puente. Prometer en la web una
 * suma de descuentos que la factura no puede explicar es prometer mal.
 *
 * A igualdad de porcentaje, el más antiguo: así el número no baila de un día
 * para otro por haber creado otro descuento igual.
 */
create or replace function mejor_descuento_para(p_hermandad_id uuid, p_hermano_id uuid)
returns table (id uuid, porcentaje numeric)
language sql stable security definer set search_path = public as $$
  select d.id, d.porcentaje
    from descuentos d
   where d.hermandad_id = p_hermandad_id
     and d.activo
     and pct_de_descuento(p_hermandad_id, d.id, p_hermano_id) is not null
   order by d.porcentaje desc, d.creado_en
   limit 1
$$;

comment on function mejor_descuento_para(uuid, uuid) is
  'El descuento activo de mayor porcentaje que le corresponde a un hermano. Uno solo: la factura '
  'guarda un descuento, no una lista.';

/*
 * Ninguna de las dos se le concede a `anon`. La web pública nunca las llama
 * directamente: las llaman `catalogo_web` y `crear_reserva_web`, que son
 * `security definer` y por tanto las ejecutan como su dueño. Concedérselas
 * sería dejar preguntar «¿qué descuento tiene el hermano tal?» desde la consola
 * del navegador.
 */
revoke all on function pct_de_descuento(uuid, uuid, uuid) from public, anon;
revoke all on function mejor_descuento_para(uuid, uuid) from public, anon;
grant execute on function pct_de_descuento(uuid, uuid, uuid) to authenticated;
grant execute on function mejor_descuento_para(uuid, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Las ventas
-- ----------------------------------------------------------------------------
create table if not exists ventas (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  /*
   * NÚMERO DE FACTURA, correlativo y sin huecos dentro de su serie.
   *
   * No es una manía: una numeración con saltos o repetida es lo primero que
   * mira una inspección. Lo asigna `registrar_venta()` con un cerrojo, nunca
   * la aplicación.
   */
  serie text not null default 'A',
  numero int not null,
  canal text not null default 'fisica' check (canal in ('fisica', 'online')),
  forma_pago text not null default 'Efectivo',
  -- A quién se le vendió, si es hermano. Vacío = una venta de mostrador a
  -- alguien de fuera.
  hermano_id uuid references hermanos(id) on delete set null,
  -- Los datos fiscales van COPIADOS, no enlazados: una factura no puede cambiar
  -- porque el comprador se mude o se corrija su NIF tres años después.
  comprador_nombre text not null default '',
  comprador_nif text not null default '',
  comprador_direccion text not null default '',
  descuento_id uuid references descuentos(id) on delete set null,
  descuento_pct numeric(5, 2) not null default 0,
  -- Los tres importes, cerrados en el momento de cobrar.
  base numeric(10, 2) not null default 0,
  iva_total numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  -- Lo que le costó a la hermandad lo vendido. De aquí sale el asiento de gasto
  -- y el beneficio de las gráficas.
  coste_total numeric(10, 2) not null default 0,
  estado text not null default 'Cobrada' check (estado in ('Cobrada', 'Anulada')),
  fecha timestamptz not null default now(),
  notas text not null default '',
  unique (hermandad_id, serie, numero)
);
create index if not exists ventas_hermandad_fecha_idx on ventas (hermandad_id, fecha desc);
create index if not exists ventas_hermano_idx on ventas (hermano_id) where hermano_id is not null;


-- ----------------------------------------------------------------------------
-- 4. Lo que llevaba cada venta
-- ----------------------------------------------------------------------------
--
-- CON FOTO DEL PRODUCTO, y esto es lo importante de esta tabla. El nombre, el
-- precio y el coste se copian aquí tal como estaban al vender. Si mañana sube
-- el precio de la camiseta, o se corrige su nombre, o se borra el producto
-- entero, la factura de hace dos años tiene que seguir diciendo exactamente lo
-- que decía. Una factura que cambia sola no es una factura.
create table if not exists lineas_venta (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  venta_id uuid not null references ventas(id) on delete cascade,
  -- Se conserva el enlace para poder mirar «qué se ha vendido de esto», pero la
  -- factura no depende de él: por eso `set null` y no `cascade`.
  producto_id uuid references productos(id) on delete set null,
  codigo text not null,
  nombre text not null,
  cantidad int not null check (cantidad > 0),
  -- Lo que se cobró de verdad por unidad, ya con el descuento o la rebaja.
  precio_unitario numeric(10, 2) not null,
  -- Y lo que ponía en la ficha, para poder ver qué se rebajó y cuánto.
  precio_tarifa numeric(10, 2) not null default 0,
  coste_unitario numeric(10, 2) not null default 0,
  iva numeric(5, 2) not null default 21
);
create index if not exists lineas_venta_venta_idx on lineas_venta (venta_id);
create index if not exists lineas_venta_producto_idx on lineas_venta (producto_id);


-- ----------------------------------------------------------------------------
-- 5. Por qué subió o bajó el stock
-- ----------------------------------------------------------------------------
--
-- El stock del producto es un número, y un número solo no explica nada. Cuando
-- al final de la temporada faltan nueve camisetas, la pregunta no es «cuántas
-- quedan» sino «dónde han ido»: vendidas, rotas, regaladas en el cabildo, o
-- nunca llegaron de la imprenta. Esta tabla es la respuesta.
create table if not exists movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  tipo text not null check (tipo in ('compra', 'venta', 'rotura', 'ajuste', 'devolucion')),
  -- Positivo entra, negativo sale. Guardar el signo aquí —en vez de deducirlo
  -- del tipo— deja hacer un ajuste en los dos sentidos sin inventar dos tipos.
  cantidad int not null check (cantidad <> 0),
  motivo text not null default '',
  venta_id uuid references ventas(id) on delete set null,
  quien uuid references hermanos(id) on delete set null,
  fecha timestamptz not null default now()
);
create index if not exists movimientos_stock_producto_idx on movimientos_stock (producto_id, fecha desc);


-- ----------------------------------------------------------------------------
-- 6. Quién puede tocar qué
-- ----------------------------------------------------------------------------
--
-- El módulo es `inventario`, el mismo que ya lleva los enseres: quien lleva el
-- inventario de la hermandad lleva también el género de la tienda. No se crea
-- un módulo nuevo para no obligar a cada hermandad a repartir permisos otra vez.
--
-- Y `tesoreria` puede LEER las ventas aunque no lleve inventario: de ellas
-- salen los asientos del libro, y quien cuadra las cuentas tiene que poder ver
-- de dónde vino cada uno.

alter table productos enable row level security;
alter table descuentos enable row level security;
alter table ventas enable row level security;
alter table lineas_venta enable row level security;
alter table movimientos_stock enable row level security;

do $$
declare t text;
begin
  foreach t in array array['productos', 'descuentos', 'ventas', 'lineas_venta', 'movimientos_stock'] loop
    execute format('drop policy if exists "solo_mi_hermandad" on %I', t);
    execute format(
      'create policy "solo_mi_hermandad" on %I as restrictive for all to authenticated '
      'using (hermandad_id = hermandad_actual()) with check (hermandad_id = hermandad_actual())', t);

    execute format('drop policy if exists "tienda_gestiona" on %I', t);
    execute format(
      'create policy "tienda_gestiona" on %I for all to authenticated '
      'using (modulo_permitido(''inventario'')) with check (modulo_permitido(''inventario''))', t);

    execute format('drop policy if exists "tesoreria_lee" on %I', t);
    execute format(
      'create policy "tesoreria_lee" on %I for select to authenticated '
      'using (modulo_permitido(''tesoreria'') or modulo_permitido(''informes''))', t);

    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

/*
 * Y EL HERMANO VE LO QUE HA COMPRADO ÉL, y solo eso.
 *
 * `hermano_propio_id()` y no `auth_es_hermano()`: esto ya costó un fallo en los
 * mandatos SEPA. `auth_es_hermano()` da FALSO en cuanto el hermano lleva un
 * cargo, y el Hermano Mayor también compra camisetas.
 */
drop policy if exists "el hermano ve lo suyo" on ventas;
create policy "el hermano ve lo suyo" on ventas for select to authenticated
  using (hermano_id = hermano_propio_id());

drop policy if exists "el hermano ve sus lineas" on lineas_venta;
create policy "el hermano ve sus lineas" on lineas_venta for select to authenticated
  using (exists (
    select 1 from ventas v where v.id = venta_id and v.hermano_id = hermano_propio_id()
  ));

-- El catálogo de la tienda lo puede ver cualquiera que haya entrado: hace falta
-- para la tienda de la web y para que el hermano vea qué hay. Solo lo visible y
-- lo activo; el coste NO se enseña aquí (ver la vista de abajo).
drop policy if exists "el catalogo se ve" on productos;
create policy "el catalogo se ve" on productos for select to authenticated
  using (activo and visible_en_web);


-- ----------------------------------------------------------------------------
-- 7. El catálogo público, SIN el coste
-- ----------------------------------------------------------------------------
--
-- La política de arriba abre la fila entera, y en la fila está `coste`. Que
-- cualquier hermano pueda ver lo que le cuesta a la hermandad cada camiseta no
-- es una fuga de datos personales, pero es información de negocio que no tiene
-- por qué salir de la junta —y en un pueblo, el margen de la hermandad es
-- conversación de barra—.
--
-- Esta vista es lo que lee la tienda: las mismas filas sin las columnas que no
-- le importan a quien compra.
create or replace view catalogo_tienda
with (security_invoker = true) as
  select id, hermandad_id, codigo, nombre, descripcion, precio, iva, stock,
         (stock > 0) as hay_existencias, foto_url
    from productos
   where activo and visible_en_web;

grant select on catalogo_tienda to authenticated, anon;

comment on view catalogo_tienda is
  'El catálogo tal como lo ve quien compra: sin `coste` ni `stock_minimo`. '
  '`security_invoker` para que siga aplicando la RLS de `productos`.';


-- ----------------------------------------------------------------------------
-- 8. REGISTRAR UNA VENTA: todo o nada
-- ----------------------------------------------------------------------------
--
-- Una venta son seis cosas que tienen que pasar juntas o no pasar:
--
--   1. coger el número de factura,
--   2. guardar la venta,
--   3. guardar sus líneas con la foto del producto,
--   4. bajar el stock,
--   5. apuntar por qué bajó,
--   6. y dejar los DOS asientos en Tesorería.
--
-- LOS DOS ASIENTOS, y esto se habló y se decidió: ingreso por lo COBRADO y
-- gasto por lo que COSTÓ el género. Vendida una camiseta de 15 € que costó 6:
-- ingreso 15, gasto 6. La caja cuadra con el banco y el beneficio (9 €) sale
-- calculado en las gráficas de la tienda.
--
-- La otra forma —ingreso por el beneficio y gasto por el coste— deja la caja en
-- −2 € vendiendo algo por lo que han entrado 15, y el Estado de Cuentas del
-- cabildo diría que la hermandad tiene menos dinero del que tiene.
--
-- Y DOS COSAS QUE NO SE PUEDEN HACER DESDE EL NAVEGADOR:
--
--   · EL NÚMERO DE FACTURA tiene que ser correlativo y sin huecos. Con un
--     `max()+1` desde dos mostradores a la vez salen dos facturas con el mismo
--     número, y una numeración repetida es lo primero que mira una inspección.
--   · QUE NO SE VENDA LO QUE NO HAY. Dos personas cobrando la última camiseta
--     a la vez la venden las dos, y una de las dos se queda esperando un pedido
--     que no existe.
--
-- Las dos se resuelven aquí con cerrojos, dentro de una sola transacción.
create or replace function registrar_venta(
  p_lineas jsonb,                        -- [{producto_id, cantidad, precio_unitario?}]
  p_canal text default 'fisica',
  p_forma_pago text default 'Efectivo',
  p_hermano_id uuid default null,
  p_descuento_id uuid default null,
  p_comprador_nombre text default '',
  p_comprador_nif text default '',
  p_comprador_direccion text default '',
  p_notas text default '',
  p_serie text default 'A'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_yo uuid := hermano_propio_id();
  v_venta uuid;
  v_numero int;
  v_pct numeric(5, 2) := 0;
  v_linea jsonb;
  v_prod productos%rowtype;
  v_cant int;
  v_precio numeric(10, 2);
  v_bruto numeric(10, 2);
  v_base numeric(10, 2) := 0;
  v_iva numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_coste numeric(10, 2) := 0;
  v_base_linea numeric(10, 2);
  v_num_mov int;
  v_disp int;
begin
  if not modulo_permitido('inventario') then
    raise exception 'Solo quien lleva el inventario puede registrar ventas.';
  end if;
  if v_hermandad is null then
    raise exception 'No se sabe de qué hermandad es esta venta.';
  end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Una venta sin artículos no es una venta.';
  end if;

  /*
   * EL DESCUENTO SE COMPRUEBA AQUÍ, no se acepta el que mande el navegador.
   * Si no, cualquiera con la consola abierta se aplica el 50 % de costaleros
   * sin serlo. Tiene que estar activo, ser de esta hermandad, y —si va por
   * etiqueta— el comprador tiene que llevarla en su ficha.
   */
  if p_descuento_id is not null then
    v_pct := pct_de_descuento(v_hermandad, p_descuento_id, p_hermano_id);
    if v_pct is null then
      raise exception 'Ese descuento no se le puede aplicar a esta venta.';
    end if;
  end if;

  /*
   * EL NÚMERO DE FACTURA, con cerrojo de transacción.
   *
   * `pg_advisory_xact_lock` y no `for update` sobre las ventas: no hay ninguna
   * fila que bloquear cuando es la primera venta de la serie. El cerrojo se
   * suelta solo al terminar la transacción, salga bien o mal.
   */
  perform pg_advisory_xact_lock(hashtext(v_hermandad::text || '|' || p_serie));
  select coalesce(max(v.numero), 0) + 1 into v_numero
    from ventas v where v.hermandad_id = v_hermandad and v.serie = p_serie;

  insert into ventas (
    hermandad_id, serie, numero, canal, forma_pago, hermano_id,
    comprador_nombre, comprador_nif, comprador_direccion,
    descuento_id, descuento_pct, notas
  ) values (
    v_hermandad, p_serie, v_numero, p_canal, p_forma_pago, p_hermano_id,
    p_comprador_nombre, p_comprador_nif, p_comprador_direccion,
    p_descuento_id, v_pct, p_notas
  ) returning id into v_venta;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cant := coalesce((v_linea ->> 'cantidad')::int, 0);
    if v_cant <= 0 then
      raise exception 'Una línea sin cantidad no se puede vender.';
    end if;

    -- `for update`: se bloquea la fila del producto hasta el final. Es lo que
    -- impide que dos mostradores vendan la misma última unidad.
    select * into v_prod from productos p
     where p.id = (v_linea ->> 'producto_id')::uuid
       and p.hermandad_id = v_hermandad
     for update;
    if not found then
      raise exception 'Ese artículo no está en el catálogo de la hermandad.';
    end if;
    /*
     * SE MIRA LO DISPONIBLE, NO LO QUE HAY EN LA ESTANTERÍA.
     *
     * Aquí ponía `v_prod.stock < v_cant`, y con eso el mostrador vendía sin
     * pestañear las dos camisetas que alguien había apartado por la web para
     * pasar a recogerlas el sábado. `stock` sigue diciendo 2 hasta que la
     * reserva se entrega, así que la caja no veía nada raro.
     *
     * Pasaban las dos cosas malas a la vez: quien reservó venía el sábado y no
     * había nada —con su resguardo y su referencia en la mano—, y la reserva se
     * quedaba IMPOSIBLE DE ENTREGAR, porque al intentarlo esta misma línea
     * decía que no queda género. Pendiente para siempre, bloqueando existencias
     * que ya no existen.
     *
     * El `for update` de arriba ya serializa: la cuenta que se hace aquí ve lo
     * que el mostrador de al lado acabe de confirmar, no una foto vieja.
     */
    v_disp := disponible_de(v_prod.id);
    if v_disp < v_cant then
      raise exception 'De «%» solo quedan % sin apartar: hay % en la estantería y % comprometidas por la web.',
        v_prod.nombre, greatest(v_disp, 0), v_prod.stock, v_prod.stock - v_disp;
    end if;

    /*
     * EL PRECIO. Si viene uno a mano —«te lo dejo en diez»— manda ese y el
     * descuento por colectivo no se suma encima: rebajar dos veces sobre una
     * rebaja que ya se ha decidido a ojo no lo espera nadie. Si no viene, se
     * aplica el porcentaje del descuento sobre el de la ficha.
     */
    if (v_linea ? 'precio_unitario') and (v_linea ->> 'precio_unitario') is not null then
      v_precio := round((v_linea ->> 'precio_unitario')::numeric, 2);
      if v_precio < 0 then
        raise exception 'Un precio no puede ser negativo.';
      end if;
    else
      v_precio := round(v_prod.precio * (1 - v_pct / 100), 2);
    end if;

    insert into lineas_venta (
      hermandad_id, venta_id, producto_id, codigo, nombre, cantidad,
      precio_unitario, precio_tarifa, coste_unitario, iva
    ) values (
      v_hermandad, v_venta, v_prod.id, v_prod.codigo, v_prod.nombre, v_cant,
      v_precio, v_prod.precio, v_prod.coste, v_prod.iva
    );

    -- El precio lleva el IVA dentro (ver el comentario de `productos.precio`),
    -- así que la base se saca dividiendo y la cuota es la diferencia. Así los
    -- tres números suman exactamente el total, sin un céntimo de desfase.
    v_bruto := round(v_precio * v_cant, 2);
    v_base_linea := round(v_bruto / (1 + v_prod.iva / 100), 2);
    v_total := v_total + v_bruto;
    v_base := v_base + v_base_linea;
    v_iva := v_iva + (v_bruto - v_base_linea);
    v_coste := v_coste + round(v_prod.coste * v_cant, 2);

    update productos set stock = stock - v_cant where id = v_prod.id;
    insert into movimientos_stock (hermandad_id, producto_id, tipo, cantidad, motivo, venta_id, quien)
      values (v_hermandad, v_prod.id, 'venta', -v_cant,
              format('Venta %s-%s', p_serie, v_numero), v_venta, v_yo);
  end loop;

  update ventas set base = v_base, iva_total = v_iva, total = v_total, coste_total = v_coste
   where id = v_venta;

  /*
   * Y LOS DOS ASIENTOS EN EL LIBRO.
   *
   * Nacen PENDIENTES, no conciliados, igual que los de cuotas y papeletas
   * (ver `lib/apuntes.ts`): que se haya cobrado significa «me consta», no «lo
   * he visto en el extracto». Conciliar es lo segundo y lo hace el tesorero.
   *
   * `origen` los ata a esta venta: sirve para no apuntar dos veces y para
   * poder retirarlos si la venta se anula.
   */
  select coalesce(max(m.numero), 0) into v_num_mov from movimientos m where m.hermandad_id = v_hermandad;

  /*
   * EL IVA VA EN SU PROPIA LÍNEA, y no metido dentro del ingreso.
   *
   * De una camiseta de 15 €, 12,40 € son de la hermandad y 2,60 € se le están
   * cobrando a quien compra PARA HACIENDA. Entran en la misma caja, pero no
   * son lo mismo: sumados en una sola línea, el libro dice que la tienda
   * ingresa un 21 % más de lo que ingresa, y a la hora del modelo 303 no hay
   * de dónde sacar la cifra sin recorrer las facturas una a una.
   *
   * Las dos líneas suman EXACTAMENTE el total, así que la caja sigue
   * cuadrando: es la misma cantidad de dinero, contada por separado.
   *
   * Si la hermandad no repercute IVA —lo normal en la mayoría— `v_iva` es cero
   * y sale una sola línea por el total, como antes. Un asiento de cero euros
   * solo ensucia el libro.
   *
   * Los tres números se cuentan de uno en uno según se van poniendo, y no
   * `+1 / +2 / +3` de golpe: cuando el IVA es cero, el 2 no se lo lleva nadie y
   * el libro queda con un hueco que parece un apunte borrado.
   */
  v_num_mov := v_num_mov + 1;
  insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
  values (
    v_hermandad, v_num_mov, to_char(now(), 'YYYY-MM-DD'),
    format('Venta en tienda %s-%s', p_serie, v_numero),
    'Otros ingresos', 'Ingreso', v_total - v_iva,
    case when lower(p_forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
    'Pendiente', 'venta:' || v_venta
  );

  if v_iva > 0 then
    v_num_mov := v_num_mov + 1;
    insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
    values (
      v_hermandad, v_num_mov, to_char(now(), 'YYYY-MM-DD'),
      format('IVA repercutido en la venta %s-%s', p_serie, v_numero),
      'IVA repercutido', 'Ingreso', v_iva,
      case when lower(p_forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
      'Pendiente', 'iva-venta:' || v_venta
    );
  end if;

  -- El gasto solo si de verdad costó algo: un artículo donado tiene coste 0 y
  -- un asiento de cero euros solo ensucia el libro.
  if v_coste > 0 then
    v_num_mov := v_num_mov + 1;
    insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
    values (
      v_hermandad, v_num_mov, to_char(now(), 'YYYY-MM-DD'),
      format('Coste del género vendido %s-%s', p_serie, v_numero),
      'Gastos varios menores', 'Gasto', v_coste,
      case when lower(p_forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
      'Pendiente', 'coste-venta:' || v_venta
    );
  end if;

  return jsonb_build_object(
    'id', v_venta, 'serie', p_serie, 'numero', v_numero,
    'base', v_base, 'iva', v_iva, 'total', v_total, 'coste', v_coste,
    'descuento_pct', v_pct
  );
end $$;

revoke all on function registrar_venta(jsonb, text, text, uuid, uuid, text, text, text, text, text) from public, anon;
grant execute on function registrar_venta(jsonb, text, text, uuid, uuid, text, text, text, text, text) to authenticated;

comment on function registrar_venta(jsonb, text, text, uuid, uuid, text, text, text, text, text) is
  'Registra una venta entera en una sola transacción: número de factura con cerrojo, líneas con foto '
  'del producto, stock descontado con la fila bloqueada, y los dos asientos en Tesorería (ingreso por '
  'lo cobrado, gasto por el coste). Devuelve el id, el número y los importes.';


-- ----------------------------------------------------------------------------
-- 9. «Queda poco de esto»: el aviso a quien lleva el inventario
-- ----------------------------------------------------------------------------
--
-- Se avisa AL CRUZAR el mínimo, no cada vez que se vende algo por debajo de él.
-- La diferencia es todo: con veinte camisetas por debajo del mínimo y treinta
-- ventas en el besamanos, avisar en cada una son treinta avisos idénticos, y a
-- partir del tercero nadie los lee. Se avisa una vez, cuando pasa de estar por
-- encima a estar por debajo, y no se vuelve a avisar hasta que se repone y
-- vuelve a bajar.
--
-- Y va a quien LLEVA EL MÓDULO de inventario, por las dos vías por las que se
-- gestiona en esta aplicación: el hermano con cargo en su ficha, y el personal
-- activo. Igual que `modulo_permitido()`, para que no se quede fuera nadie que
-- sí tiene la pantalla.
create or replace function productos_avisar_si_queda_poco() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_texto text;
begin
  if new.stock_minimo <= 0 then return new; end if;
  -- Solo el cruce hacia abajo.
  if not (old.stock >= new.stock_minimo and new.stock < new.stock_minimo) then
    return new;
  end if;

  v_texto := format(
    'Quedan %s de «%s» (%s) y el mínimo está en %s. Conviene reponer.',
    new.stock, new.nombre, new.codigo, new.stock_minimo);

  insert into avisos_hermano (hermandad_id, hermano_id, texto, tipo, titulo)
  select distinct new.hermandad_id, h.id, v_texto, 'existencias', 'Queda poco género'
    from hermanos h
   where h.hermandad_id = new.hermandad_id
     and h.estado <> 'Baja'
     and (
       -- Por su cargo en la ficha…
       exists (
         select 1 from permisos_cargo pc
          where pc.hermandad_id = h.hermandad_id
            and pc.cargo = h.cargo
            and pc.modulo_id = 'inventario'
       )
       -- …o por estar en «personal» con un cargo que lo lleve.
       or exists (
         select 1 from personal p
           join permisos_cargo pc2
             on pc2.cargo = p.cargo and pc2.hermandad_id = p.hermandad_id
          where p.hermandad_id = h.hermandad_id
            and p.auth_user_id = h.auth_user_id
            and p.activo
            and pc2.modulo_id = 'inventario'
       )
     );
  return new;
end $$;

drop trigger if exists productos_avisar_si_queda_poco on productos;
create trigger productos_avisar_si_queda_poco
  after update of stock on productos
  for each row execute function productos_avisar_si_queda_poco();


-- ----------------------------------------------------------------------------
-- 10. Romper, reponer y ajustar
-- ----------------------------------------------------------------------------
--
-- Todo lo que mueve stock sin que haya una venta de por medio. Va por función y
-- no por escritura directa para que el stock y su explicación se muevan juntos:
-- un stock que baja sin una línea que diga por qué es exactamente el agujero
-- por el que se pierden nueve camisetas al año.
--
-- `drop` antes de `create`: el parámetro nuevo lleva valor por defecto, y un
-- `create or replace` con un parámetro más NO SUSTITUYE a la función vieja
-- —crea una segunda con otra firma—, y entonces toda llamada de cuatro
-- argumentos queda ambigua y falla. Sin este `drop`, volver a ejecutar el
-- fichero rompe la tienda entera.
drop function if exists mover_stock(uuid, text, int, text);
create or replace function mover_stock(
  p_producto_id uuid,
  p_tipo text,          -- 'compra' | 'rotura' | 'ajuste' | 'devolucion'
  p_cantidad int,       -- positivo entra, negativo sale
  p_motivo text default '',
  -- Una rotura es un hecho, no una petición: si se han roto tres, se han roto
  -- tres aunque hubiera dos apartadas. Lo que no puede pasar es que se apunten
  -- sin que nadie se entere de a quién deja colgado.
  p_aunque_este_apartado boolean default false
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_prod productos%rowtype;
  v_apartado int;
begin
  if not modulo_permitido('inventario') then
    raise exception 'Solo quien lleva el inventario puede mover existencias.';
  end if;
  if p_tipo not in ('compra', 'rotura', 'ajuste', 'devolucion') then
    raise exception 'Ese motivo de movimiento no existe: %', p_tipo;
  end if;
  if p_cantidad = 0 then
    raise exception 'Un movimiento de cero unidades no mueve nada.';
  end if;
  -- Una rotura resta, siempre, aunque venga con el signo cambiado por error.
  if p_tipo = 'rotura' and p_cantidad > 0 then
    p_cantidad := -p_cantidad;
  end if;

  select * into v_prod from productos p
   where p.id = p_producto_id and p.hermandad_id = v_hermandad for update;
  if not found then
    raise exception 'Ese artículo no está en el catálogo de la hermandad.';
  end if;
  -- El stock no puede quedar en negativo: un almacén con «−3 camisetas» no
  -- significa nada y arrastra el error a todas las cuentas de después.
  if v_prod.stock + p_cantidad < 0 then
    raise exception 'No se pueden quitar % de «%»: solo hay %.',
      abs(p_cantidad), v_prod.nombre, v_prod.stock;
  end if;

  /*
   * Y TAMPOCO POR DEBAJO DE LO QUE YA ESTÁ PROMETIDO.
   *
   * Bajar el stock a mano —una rotura, un ajuste de recuento— dejaba al
   * descubierto lo que la web tenía apartado sin decir una palabra, y el
   * descuadre no aparecía hasta que alguien venía a recoger su reserva. Ahora
   * se para y se dice con quién choca.
   *
   * Se puede hacer igualmente, porque a veces hay que hacerlo: se repite
   * marcando la casilla, y entonces queda apuntado que se hizo sabiéndolo.
   */
  v_apartado := v_prod.stock - disponible_de(v_prod.id);
  if p_cantidad < 0 and v_prod.stock + p_cantidad < v_apartado and not p_aunque_este_apartado then
    raise exception 'De «%» quedarían % y hay % apartadas por la web. Suelta esas reservas, o repite marcando que se hace igualmente.',
      v_prod.nombre, v_prod.stock + p_cantidad, v_apartado;
  end if;

  update productos set stock = stock + p_cantidad where id = v_prod.id;
  insert into movimientos_stock (hermandad_id, producto_id, tipo, cantidad, motivo, quien)
    values (v_hermandad, v_prod.id, p_tipo, p_cantidad, p_motivo, hermano_propio_id());

  return v_prod.stock + p_cantidad;
end $$;

revoke all on function mover_stock(uuid, text, int, text, boolean) from public, anon;
grant execute on function mover_stock(uuid, text, int, text, boolean) to authenticated;


-- ----------------------------------------------------------------------------
-- 11. Anular una venta
-- ----------------------------------------------------------------------------
--
-- LA FACTURA NO SE BORRA. Una factura emitida no se hace desaparecer: se anula,
-- y su número se queda ocupado. Borrarla dejaría un hueco en la numeración, que
-- es justo lo que no puede pasar.
--
-- Lo que sí se deshace: el género vuelve al almacén y los dos asientos del libro
-- se contra-apuntan. No se borran tampoco —un asiento borrado es un descuadre
-- que nadie puede rastrear—: se mete el contrario al lado, que es como se
-- corrige en contabilidad.
--
-- DEVUELVE SI LA HA ANULADO AHORA (`true`) o si ya lo estaba (`false`). No es
-- un adorno: la pantalla contesta «anulada, el género ha vuelto al almacén», y
-- eso solo es verdad la primera vez. Con `void`, anular dos veces —dos cargos
-- a la vez, o una pantalla que se quedó vieja— decía exactamente lo mismo las
-- dos, y la segunda era mentira.
--
-- `drop` antes de `create` porque cambia el tipo devuelto, y `create or
-- replace` no lo permite: sin esto, volver a ejecutar el fichero falla aquí.
drop function if exists anular_venta(uuid, text);
create or replace function anular_venta(p_venta_id uuid, p_motivo text default '')
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_venta ventas%rowtype;
  v_linea lineas_venta%rowtype;
  v_num int;
begin
  if not modulo_permitido('inventario') then
    raise exception 'Solo quien lleva el inventario puede anular una venta.';
  end if;

  select * into v_venta from ventas v
   where v.id = p_venta_id and v.hermandad_id = v_hermandad for update;
  if not found then
    raise exception 'Esa venta no es de esta hermandad.';
  end if;
  if v_venta.estado = 'Anulada' then
    -- Ya estaba: anular dos veces no puede devolver el género dos veces. Se
    -- dice que no se ha hecho nada en vez de callarse.
    return false;
  end if;

  for v_linea in select * from lineas_venta l where l.venta_id = p_venta_id loop
    if v_linea.producto_id is not null then
      update productos set stock = stock + v_linea.cantidad where id = v_linea.producto_id;
      insert into movimientos_stock (hermandad_id, producto_id, tipo, cantidad, motivo, venta_id, quien)
        values (v_hermandad, v_linea.producto_id, 'devolucion', v_linea.cantidad,
                format('Anulada la venta %s-%s. %s', v_venta.serie, v_venta.numero, p_motivo),
                p_venta_id, hermano_propio_id());
    end if;
  end loop;

  select coalesce(max(m.numero), 0) into v_num from movimientos m where m.hermandad_id = v_hermandad;

  /*
   * El contrario del ingreso: un gasto por lo que se devuelve. Y el del IVA
   * aparte, como se apuntó: si se contra-apuntara todo junto, el 303 saldría
   * con el IVA repercutido de una venta que ya no existe.
   *
   * `v_num := v_num + 1` DELANTE DE CADA APUNTE, y no `+1 / +2 / +3` escritos a
   * mano. Aquí ponía `+1`, `+4` y `+2`: los tres apuntes de una misma anulación
   * salían en el libro desordenados, con un hueco en el 3 que no era de nadie,
   * y el último —el género que vuelve al almacén— por delante del IVA. Contar
   * de verdad además cierra el otro agujero, el que tenía también el apunte de
   * la venta: cuando el IVA es cero, el número que le tocaba no se salta.
   */
  v_num := v_num + 1;
  insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
  values (v_hermandad, v_num, to_char(now(), 'YYYY-MM-DD'),
          format('Anulada la venta %s-%s', v_venta.serie, v_venta.numero),
          'Gastos varios menores', 'Gasto', v_venta.total - v_venta.iva_total,
          case when lower(v_venta.forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
          'Pendiente', 'anula-venta:' || p_venta_id);

  if v_venta.iva_total > 0 then
    v_num := v_num + 1;
    insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
    values (v_hermandad, v_num, to_char(now(), 'YYYY-MM-DD'),
            format('IVA de la venta anulada %s-%s', v_venta.serie, v_venta.numero),
            'IVA repercutido', 'Gasto', v_venta.iva_total,
            case when lower(v_venta.forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
            'Pendiente', 'anula-iva-venta:' || p_venta_id);
  end if;

  -- Y el contrario del coste, si lo hubo.
  if v_venta.coste_total > 0 then
    v_num := v_num + 1;
    insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
    values (v_hermandad, v_num, to_char(now(), 'YYYY-MM-DD'),
            format('Vuelve al almacén el género de %s-%s', v_venta.serie, v_venta.numero),
            'Otros ingresos', 'Ingreso', v_venta.coste_total,
            case when lower(v_venta.forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
            'Pendiente', 'anula-coste-venta:' || p_venta_id);
  end if;

  update ventas set estado = 'Anulada',
         notas = trim(both ' ' from coalesce(notas, '') || ' · Anulada: ' || coalesce(p_motivo, ''))
   where id = p_venta_id;
  return true;
end $$;

revoke all on function anular_venta(uuid, text) from public, anon;
grant execute on function anular_venta(uuid, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 12. LOS DATOS DE LA TIENDA, YA SUMADOS
-- ----------------------------------------------------------------------------
--
-- La pantalla de datos necesita tres cosas: cuánto se vendió cada mes, qué
-- artículos se venden más, y cómo paga la gente. Y las tres, separadas por
-- canal —mostrador e internet— porque esa es justamente la pregunta.
--
-- SE SUMA AQUÍ Y NO EN EL NAVEGADOR, y no es una optimización prematura. Para
-- saber qué artículo se vende más hay que recorrer TODAS las líneas de venta
-- del ejercicio: una hermandad que vende en el besamanos, en la cuaresma y en
-- la salida junta varios miles al año. Bajarlas por la red para sumarlas en
-- una tabla de doce filas es tirar los datos móviles de quien mira esto desde
-- el teléfono, y encima obligaría a abrir `lineas_venta` entera a una pantalla
-- que solo necesita totales.
--
-- LAS ANULADAS NO CUENTAN, en ninguno de los tres bloques. Una factura anulada
-- no ha entrado en caja, y su género ha vuelto al almacén: sumarla diría que
-- se vendió algo que se devolvió.
--
-- Devuelve un solo `jsonb` con todo dentro. Una llamada y no cuatro: son
-- cuatro consultas sobre las mismas dos tablas, y hacerlas por separado
-- multiplica por cuatro la espera con la conexión de una casa de hermandad.
create or replace function datos_tienda(p_anio int)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_desde timestamptz;
  v_hasta timestamptz;
begin
  /*
   * QUIÉN PUEDE MIRAR ESTO. El inventario porque es su tienda, y la tesorería
   * porque son sus ingresos. A nadie más: aquí está lo que gana la hermandad
   * con cada artículo, que es información de junta.
   */
  if not (modulo_permitido('inventario') or modulo_permitido('tesoreria')) then
    raise exception 'No tienes permiso para ver los datos de la tienda.';
  end if;
  if v_hermandad is null then
    raise exception 'No se sabe de qué hermandad son estos datos.';
  end if;

  /*
   * EL AÑO SE ACOTA POR FECHAS Y NO CON `extract(year from fecha)`.
   *
   * Con `extract` no se puede usar el índice de `ventas (hermandad_id, fecha)`
   * y hay que leer la tabla entera. Y hay algo peor: `extract` sacaría el año
   * en la zona horaria de la sesión, que en Supabase es UTC — así que una
   * venta del 1 de enero a las 00:30 en España caería en el ejercicio
   * anterior. Con `make_timestamptz(..., 'Europe/Madrid')` los límites son las
   * medianoches DE AQUÍ, que es lo que entiende quien cierra el ejercicio.
   */
  v_desde := make_timestamptz(p_anio, 1, 1, 0, 0, 0, 'Europe/Madrid');
  v_hasta := make_timestamptz(p_anio + 1, 1, 1, 0, 0, 0, 'Europe/Madrid');

  return jsonb_build_object(
    'anio', p_anio,

    -- Los años que tienen algo, para el selector. Sin esto la pantalla
    -- ofrecería años vacíos o se quedaría solo con el actual.
    'anios', coalesce((
      select jsonb_agg(distinct a order by a desc) from (
        select extract(year from (v.fecha at time zone 'Europe/Madrid'))::int as a
          from ventas v where v.hermandad_id = v_hermandad and v.estado <> 'Anulada'
      ) t
    ), '[]'::jsonb),

    -- Mes a mes, por canal. Solo los meses que tienen algo: la pantalla
    -- rellena los doce, que es donde se sabe cuántos hacen falta.
    'meses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'mes', m, 'canal', canal, 'total', total, 'base', base,
               'iva', iva, 'coste', coste, 'ventas', n) order by m, canal)
        from (
          select extract(month from (v.fecha at time zone 'Europe/Madrid'))::int as m,
                 v.canal,
                 sum(v.total)::numeric(12, 2) as total,
                 sum(v.base)::numeric(12, 2) as base,
                 sum(v.iva_total)::numeric(12, 2) as iva,
                 sum(v.coste_total)::numeric(12, 2) as coste,
                 count(*)::int as n
            from ventas v
           where v.hermandad_id = v_hermandad and v.estado <> 'Anulada'
             and v.fecha >= v_desde and v.fecha < v_hasta
           group by 1, 2
        ) t
    ), '[]'::jsonb),

    -- Lo que más se vende. Se agrupa por CÓDIGO y no por artículo, para que un
    -- artículo borrado del catálogo siga contando: su nombre quedó copiado en
    -- la línea, que es justo para lo que se copió.
    'articulos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'codigo', codigo, 'nombre', nombre, 'canal', canal,
               'unidades', unidades, 'importe', importe, 'coste', coste)
             order by importe desc)
        from (
          select l.codigo, min(l.nombre) as nombre, v.canal,
                 sum(l.cantidad)::int as unidades,
                 sum(round(l.precio_unitario * l.cantidad, 2))::numeric(12, 2) as importe,
                 sum(round(l.coste_unitario * l.cantidad, 2))::numeric(12, 2) as coste
            from lineas_venta l
            join ventas v on v.id = l.venta_id
           where v.hermandad_id = v_hermandad and v.estado <> 'Anulada'
             and v.fecha >= v_desde and v.fecha < v_hasta
           group by l.codigo, v.canal
        ) t
    ), '[]'::jsonb),

    -- Y cómo paga la gente, que es lo que decide si hace falta datáfono.
    'formas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'forma', forma, 'canal', canal, 'total', total, 'ventas', n)
             order by total desc)
        from (
          select coalesce(nullif(trim(v.forma_pago), ''), 'Sin indicar') as forma,
                 v.canal,
                 sum(v.total)::numeric(12, 2) as total,
                 count(*)::int as n
            from ventas v
           where v.hermandad_id = v_hermandad and v.estado <> 'Anulada'
             and v.fecha >= v_desde and v.fecha < v_hasta
           group by 1, 2
        ) t
    ), '[]'::jsonb)
  );
end $$;

revoke all on function datos_tienda(int) from public, anon;
grant execute on function datos_tienda(int) to authenticated;

comment on function datos_tienda(int) is
  'Lo vendido en un ejercicio, ya sumado: por mes, por artículo y por forma de pago, '
  'separado por canal. Sin las anuladas. El año se acota en hora de Madrid.';
