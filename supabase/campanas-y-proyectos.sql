-- ============================================================================
--   CAMPAÑAS DE RECAUDACIÓN Y PROYECTOS
-- ============================================================================
--
-- Lo que se pidió, tal cual: «hay que crear una parte de campañas y proyectos,
-- en la que las campañas sean recolecciones de dinero con una barra hasta que
-- se llegue al objetivo, y los proyectos que sean como tareas pero a largo
-- plazo».
--
-- ----------------------------------------------------------------------------
-- LA DECISIÓN QUE EXPLICA TODO LO DEMÁS: LO RECAUDADO NO SE GUARDA AQUÍ
-- ----------------------------------------------------------------------------
--
-- En esta tabla no hay ninguna columna «recaudado». Lo que lleva reunido una
-- campaña se cuenta sumando los APUNTES DE TESORERÍA que llevan su marca en
-- `origen` — `campana:<id>:<aportacion>` — igual que las cuotas y las
-- papeletas (ver `lib/apuntes.ts`).
--
-- Un contador propio sería más rápido de leer y estaría mal a las dos semanas:
--
--   · En cuanto alguien corrige un apunte en Tesorería —una cifra mal
--     tecleada, un donativo que se anula—, el contador se queda con el número
--     viejo. Y entonces hay DOS VERDADES sobre el mismo dinero: la que enseña
--     la barra y la que dice el libro. La que se publica en la web es siempre
--     la equivocada, porque nadie republica una barra.
--
--   · Es exactamente la queja que trajo esto: «el concepto de cuota no se pasa
--     a tesorería». Dinero que entra y del que el libro no se entera. Contando
--     desde el libro eso no puede pasar: un donativo que no está en Tesorería
--     no mueve la barra, así que si la barra sube, el tesorero lo tiene.
--
-- Cuesta una consulta más. Merece la pena.
--
-- ----------------------------------------------------------------------------
-- QUIÉN PUEDE QUÉ
-- ----------------------------------------------------------------------------
--
-- Módulo nuevo, `campanas`. Se siembra a los cargos que tienen sentido: el
-- Hermano Mayor, el Secretario, el Tesorero (una campaña es dinero) y el
-- Mayordomo (los proyectos suelen ser suyos: el paso, el manto, la casa).
--
-- Tesorería e Informes pueden LEER sin poder tocar: el tesorero necesita saber
-- a qué campaña corresponde un apunte que está conciliando, y el Estado de
-- Cuentas anual quiere poder decir cuánto se recaudó para qué.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Es seguro repetirlo: no borra ni sobrescribe nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Las campañas
-- ----------------------------------------------------------------------------

create table if not exists campanas_recaudacion (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  nombre text not null,
  descripcion text not null default '',
  /*
   * EL OBJETIVO, EN CÉNTIMOS Y ENTERO.
   *
   * En `numeric` con dos decimales habría que decidir qué pasa con el tercer
   * decimal, y JavaScript y Postgres no redondean igual los empates: una
   * campaña de 12.345,675 € se guardaría como una cosa y se leería como otra.
   * En céntimos no hay nada que redondear. Es lo mismo que se hace en la
   * tienda con los precios, y por lo mismo.
   *
   * CERO SIGNIFICA «SIN OBJETIVO» y es un caso de verdad, no un hueco: el
   * cepillo de caridad se abre sin cifra. Esas no tienen barra —no hay nada
   * que llenar—, solo total. Por eso `>= 0` y no `> 0`.
   */
  objetivo_cent bigint not null default 0 check (objetivo_cent >= 0),
  fecha_inicio date not null default current_date,
  fecha_fin date,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  -- Si sale en la web pública con su barra, para que done gente de fuera.
  en_la_web boolean not null default false,
  creada_en timestamptz not null default now(),
  -- Una campaña que acaba antes de empezar es una errata, no una campaña.
  constraint campanas_fechas_con_sentido check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

alter table campanas_recaudacion enable row level security;

-- Lo que se pregunta al pintar la web pública: las abiertas que salen fuera.
create index if not exists campanas_en_la_web_idx
  on campanas_recaudacion (hermandad_id) where en_la_web and estado = 'abierta';


-- ----------------------------------------------------------------------------
-- 2. Los proyectos
-- ----------------------------------------------------------------------------

create table if not exists proyectos (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  nombre text not null,
  descripcion text not null default '',
  /*
   * «idea» existe a propósito y es el estado más útil de los cuatro: lo que se
   * habló en un cabildo y quedó ahí. Sin un sitio donde ponerlo se pierde
   * entre un acta y la siguiente, y a los dos años alguien lo vuelve a
   * proponer como nuevo.
   */
  estado text not null default 'idea' check (estado in ('idea', 'en marcha', 'parado', 'hecho')),
  responsable_id uuid references hermanos(id) on delete set null,
  /*
   * EL NOMBRE DEL RESPONSABLE SE GUARDA ADEMÁS DEL IDENTIFICADOR.
   *
   * No es duplicar por duplicar: un proyecto dura años y el hermano que lo
   * llevaba puede darse de baja. Con solo el identificador, `on delete set
   * null` lo deja a nulo y el proyecto se queda sin nombre —«responsable:
   * nadie»— justo cuando hace falta saber quién sabía de esto. Guardando el
   * nombre queda el rastro aunque la ficha ya no esté.
   */
  responsable_nombre text,
  -- La fecha es un OBJETIVO, no una cita, y puede no estar: «cuando se pueda»
  -- es una respuesta válida y no puede obligar a inventarse un día.
  fecha_objetivo date,
  presupuesto_cent bigint not null default 0 check (presupuesto_cent >= 0),
  -- La campaña que lo paga, si tiene una. Lo recaudado se cuenta desde
  -- Tesorería, no se copia aquí.
  recaudacion_id uuid references campanas_recaudacion(id) on delete set null,
  creado_en timestamptz not null default now()
);

alter table proyectos enable row level security;

create table if not exists tareas_proyecto (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  titulo text not null,
  hecha boolean not null default false,
  hermano_id uuid references hermanos(id) on delete set null,
  hermano_nombre text,
  fecha_limite date,
  creada_en timestamptz not null default now()
);

alter table tareas_proyecto enable row level security;

create index if not exists tareas_proyecto_del_proyecto_idx on tareas_proyecto (proyecto_id);


-- ----------------------------------------------------------------------------
-- 3. Cada hermandad, la suya
-- ----------------------------------------------------------------------------
--
-- El mismo patrón que el resto: una política RESTRICTIVA que encierra la fila
-- en su hermandad —esa se cumple SIEMPRE, se sume a las demás o no— y encima
-- las permisivas, que dicen quién puede tocar qué.
--
-- Y el disparador que vuelve a fijar `hermandad_id`: el `default` solo actúa
-- cuando no se manda la columna, y quien manda desde el navegador puede
-- mandarla. Sin esto, un `insert` con la hermandad de otro se cuela.

do $$
declare t text;
begin
  foreach t in array array['campanas_recaudacion', 'proyectos', 'tareas_proyecto'] loop
    execute format('drop policy if exists "solo_mi_hermandad" on %I', t);
    execute format(
      'create policy "solo_mi_hermandad" on %I as restrictive for all to authenticated '
      'using (hermandad_id = hermandad_actual()) with check (hermandad_id = hermandad_actual())', t);

    execute format('drop policy if exists "campanas_gestiona" on %I', t);
    execute format(
      'create policy "campanas_gestiona" on %I for all to authenticated '
      'using (modulo_permitido(''campanas'')) with check (modulo_permitido(''campanas''))', t);

    /*
     * TESORERÍA E INFORMES LEEN, SIN PODER TOCAR.
     *
     * El tesorero necesita saber a qué campaña corresponde un apunte que está
     * conciliando: en el libro solo ve `campana:<id>`, y sin poder leer esta
     * tabla eso es un identificador y nada más. Y el Estado de Cuentas anual
     * quiere poder decir cuánto se recaudó y para qué.
     *
     * Solo `select`: quien lleva el dinero no decide qué campañas hay.
     */
    execute format('drop policy if exists "tesoreria_lee_campanas" on %I', t);
    execute format(
      'create policy "tesoreria_lee_campanas" on %I for select to authenticated '
      'using (modulo_permitido(''tesoreria'') or modulo_permitido(''informes''))', t);

    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

create or replace function campanas_fija_hermandad() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.hermandad_id := hermandad_actual();
  else
    -- Una fila no se muda de hermandad. Ni por error ni a mano.
    new.hermandad_id := old.hermandad_id;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['campanas_recaudacion', 'proyectos', 'tareas_proyecto'] loop
    execute format('drop trigger if exists %I on %I', t || '_fija_hermandad', t);
    execute format(
      'create trigger %I before insert or update on %I '
      'for each row execute function campanas_fija_hermandad()', t || '_fija_hermandad', t);
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 4. El módulo nuevo, sembrado en las hermandades que ya existen
-- ----------------------------------------------------------------------------
--
-- Sin esto, `modulo_permitido('campanas')` da falso para TODO el mundo en
-- cualquier hermandad ya creada, incluido el Hermano Mayor: la pantalla se lo
-- ofrecería y la política lo rechazaría, que es justo el fallo que ya pasó una
-- vez con «eventos» y «web» (ver `permisos-eventos-y-web.sql`).
--
-- Y SE AÑADE SOLO A LOS CARGOS QUE ESA HERMANDAD YA RECONOCE. Si nunca se le
-- sembró «Vocal», no se le inventa uno ahora.

insert into permisos_cargo (hermandad_id, cargo, modulo_id)
select h.id, f.cargo, 'campanas'
from hermandades h
cross join (values
  ('Hermano Mayor'),
  ('Secretario/a'),
  ('Tesorero/a'),
  ('Mayordomo/Prioste')
) as f(cargo)
where exists (
  select 1 from permisos_cargo pc
  where pc.hermandad_id = h.id and pc.cargo = f.cargo
)
on conflict do nothing;


-- ----------------------------------------------------------------------------
-- 5. Las campañas que salen en la web pública
-- ----------------------------------------------------------------------------
--
-- Quien visita la web NO ha entrado en ningún sitio: es `anon`, y las
-- políticas de arriba son todas `to authenticated`. Así que la web no vería ni
-- una campaña — el mismo tropiezo que ya está contado en `tienda-web.sql`.
--
-- Se resuelve igual: una función SECURITY DEFINER que devuelve SOLO lo
-- publicable, con columnas con nombre. No se abre la tabla a `anon`, porque
-- entonces se vería también la campaña que la hermandad tiene preparada y
-- todavía no ha anunciado.
--
-- LO RECAUDADO SE CALCULA AQUÍ DENTRO, desde los apuntes, por lo mismo que en
-- todas partes. Y se devuelve solo el TOTAL: quién ha donado y cuánto no sale
-- de la hermandad.

create or replace function campanas_de_la_web(p_slug text)
returns table (
  id uuid,
  nombre text,
  descripcion text,
  objetivo_cent bigint,
  recaudado_cent bigint,
  aportaciones integer,
  fecha_fin date
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.nombre,
    c.descripcion,
    c.objetivo_cent,
    -- Los gastos de la campaña se RESTAN: enseñar lo bruto como si fuera lo
    -- disponible es mentir sobre cuánto falta.
    coalesce((
      select sum(case when m.tipo = 'Ingreso' then round(m.importe * 100)
                      else -round(m.importe * 100) end)::bigint
      from movimientos m
      where m.hermandad_id = c.hermandad_id
        and m.origen like 'campana:' || c.id::text || ':%'
    ), 0),
    coalesce((
      select count(*)::integer
      from movimientos m
      where m.hermandad_id = c.hermandad_id
        and m.tipo = 'Ingreso'
        and m.origen like 'campana:' || c.id::text || ':%'
    ), 0),
    c.fecha_fin
  from campanas_recaudacion c
  join web_publica w on w.hermandad_id = c.hermandad_id
  where w.slug = p_slug
    -- Una web sin publicar se puede ver desde su propia hermandad, para poder
    -- comprobar cómo va a quedar antes de anunciarla.
    and (w.publicada or w.hermandad_id = hermandad_actual())
    and c.en_la_web
    and c.estado = 'abierta'
  order by c.creada_en;
$$;

grant execute on function campanas_de_la_web(text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 6. ¿Ha quedado puesto?
-- ----------------------------------------------------------------------------
--
-- AQUÍ NO SE DEVUELVE NADA A PROPÓSITO. La comprobación de este fichero vive
-- en el informe único del final de `ACTUALIZAR.sql`, junto a la de todos los
-- demás.
--
-- Tenía su propio `select` al final y estaba mal: `ACTUALIZAR.sql` promete en
-- su cabecera que «al terminar sale una tabla» y que «es lo único que
-- devuelve». Con un `select` suelto por el medio salen dos, y quien lo ejecuta
-- —que no es informático— se queda mirando una tabla de tres números sin
-- título preguntándose si eso es un error.
