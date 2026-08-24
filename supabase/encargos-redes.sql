-- ============================================================================
--   ENCARGAR UN POST Y QUE SE REPARTA SOLO
-- ============================================================================
--
-- Lo que se pedía, tal cual: el Hermano Mayor —o quien lleve redes— encarga un
-- post, y de ese encargo salen SOLAS las tareas que hacen falta: escribirlo,
-- subirlo a Facebook, subirlo a Instagram. Cada una con su responsable, y cada
-- responsable lo ve en SU área, sin tener que entrar al panel.
--
-- POR QUÉ UNA FILA POR TAREA Y NO UNA POR ENCARGO. Porque lo que se asigna, se
-- hace y se marca no es «el post»: es «subirlo a Instagram». Con una fila por
-- encargo habría que meter dentro una lista de tareas, y entonces dos personas
-- marcando la suya a la vez se pisarían — la última en guardar borraría lo que
-- acababa de marcar la otra. Con una fila por tarea, cada una es suya y no hay
-- forma de pisarse.
--
-- `encargo_id` es lo que las mantiene juntas: todas las tareas que salieron del
-- mismo encargo lo llevan igual, así se pueden enseñar agrupadas.
--
--   · LA ASIGNA QUIEN LLEVA REDES. Un hermano no puede repartirse trabajo a sí
--     mismo ni cambiarle la tarea a otro.
--   · Y EL RESPONSABLE SOLO PUEDE DECIR «HECHO». No puede reasignarla, ni
--     cambiar el texto, ni borrarla: si algo no cuadra, se habla con quien la
--     encargó. Lo que se apunta es quién la hizo y cuándo.
--   · SIN BORRADO PARA NADIE, igual que el registro de actividad: un encargo
--     hecho es lo que demuestra que se hizo.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

create table if not exists tareas_redes (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  -- Lo que agrupa las tareas que salieron del mismo encargo.
  encargo_id uuid not null,
  titulo text not null,
  -- El texto del post, para que quien lo suba no tenga que pedirlo por WhatsApp.
  texto text not null default '',
  /*
   * QUÉ HAY QUE HACER. «crear» es escribirlo y preparar la foto; «publicar» es
   * subirlo a una red concreta. Se guarda separado del nombre de la red porque
   * la tarea de crear no tiene red: es una sola para todo el encargo.
   */
  que text not null check (que in ('crear', 'publicar')),
  red text,
  -- A quién le toca. Puede ir vacía: un encargo se puede dejar preparado y
  -- repartir después.
  hermano_id uuid references hermanos(id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecha')),
  creado_en timestamptz not null default now(),
  hecha_en timestamptz,
  -- Quién la dio por hecha. No es lo mismo que `hermano_id`: quien lleva redes
  -- puede cerrarla él si la tarea se hizo por otra vía.
  hecha_por uuid references hermanos(id) on delete set null,
  notas text not null default ''
);

alter table tareas_redes enable row level security;

-- Por responsable y estado: es lo que se pregunta al pintar el área del
-- hermano —«¿qué tengo pendiente?»— y se hace en cada visita suya.
create index if not exists tareas_redes_mias_idx
  on tareas_redes (hermano_id, estado) where estado = 'pendiente';
create index if not exists tareas_redes_encargo_idx on tareas_redes (encargo_id);

/**
 * LO QUE PONE EL SERVIDOR, PASE LO QUE PASE.
 *
 * Lista BLANCA otra vez, como en `mandatos_sepa`: al crear, todo lo que no sea
 * el contenido del encargo lo pone la base; al modificar, se mira QUIÉN es y
 * solo se le deja tocar lo suyo.
 */
create or replace function tareas_redes_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid;
  v_lleva_redes boolean;
begin
  v_yo := hermano_propio_id();
  /*
   * QUIÉN LLEVA REDES. Se pregunta por el módulo, no por el cargo: así una
   * hermandad que le da «comunicados» a su vocal de juventud no tiene que
   * pedirle permiso a nadie para que pueda repartir posts.
   *
   * `hermano_propio_id()` y no `auth_es_hermano()`, y esto ya costó un fallo
   * en los mandatos SEPA: `auth_es_hermano()` da FALSO en cuanto el hermano
   * lleva cargo, y aquí los responsables son justo esos — la junta. Sirve para
   * saber si alguien gestiona, no para saber de quién es una ficha.
   */
  v_lleva_redes := modulo_permitido('comunicados') or modulo_permitido('web');

  if tg_op = 'INSERT' then
    if not v_lleva_redes then
      raise exception 'Solo quien lleva comunicados o la web puede encargar un post.';
    end if;
    new.hermandad_id := hermandad_actual();
    new.estado := 'pendiente';
    new.creado_en := now();
    new.hecha_en := null;
    new.hecha_por := null;
    -- Una tarea de crear no es de ninguna red, y una de publicar necesita
    -- saber a cuál. Sin esto se cuelan tareas que no dicen qué hacer.
    if new.que = 'crear' then new.red := null;
    elsif coalesce(trim(new.red), '') = '' then
      raise exception 'Una tarea de publicar tiene que decir en qué red.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    /*
     * Salvo cuando se va la hermandad entera: `hermandad_id` es `on delete
     * cascade`, y esa cascada pasa por aquí.
     *
     * Sin esto, una hermandad con un solo encargo no se puede borrar, y el
     * error que sale —«Un encargo no se borra»— manda a mirar al sitio
     * equivocado. Muerde justo en `BORRAR-PRUEBAS.sql`, que es el archivo que
     * se ejecuta para quitar las hermandades de prueba cuando entra la primera
     * de verdad. Es exactamente el mismo tropiezo que ya cuenta
     * `borrar-una-hermandad.sql`, con otra tabla.
     *
     * Se reconoce porque la hermandad YA NO ESTÁ: la fila se acaba de borrar
     * en esta misma orden. Nadie puede colarse por aquí para borrar un
     * encargo suelto sin llevarse la hermandad por delante.
     */
    if not exists (select 1 from hermandades where id = old.hermandad_id) then
      return old;
    end if;
    raise exception 'Un encargo no se borra. Si ya no hace falta, márcalo como hecho con una nota.';
  end if;

  /*
   * PRIMERO: ¿ES LA PROPIA BASE LIMPIANDO TRAS UN BORRADO?
   *
   * `hermano_id` y `hecha_por` llevan `on delete set null`. Cuando se da de
   * baja a un hermano, Postgres lanza UN UPDATE sobre esta tabla para dejarlos
   * a nulo — y ese UPDATE pasa por aquí, con el permiso de quien esté
   * borrando.
   *
   * Y quien borra hermanos es quien lleva el módulo «hermanos»: el Diputado
   * Mayor de Gobierno, por ejemplo, que NO lleva redes. Así que caía en la
   * rama de abajo y se llevaba un «Esta tarea no es tuya», que además no
   * explica nada. Resultado: no se podía dar de baja a un hermano que tuviera
   * un encargo abierto, y el mensaje mandaba a mirar al sitio equivocado.
   *
   * Se reconoce por su forma exacta: el hermano al que apuntaba YA NO EXISTE
   * (la fila se acaba de borrar en esta misma orden) y lo único que cambia es
   * ese campo. Un responsable no puede colarse por aquí para quitarse la
   * tarea de encima: tendría que borrarse a sí mismo del censo primero.
   */
  if (old.hermano_id is not null and new.hermano_id is null
      and not exists (select 1 from hermanos where id = old.hermano_id))
     or (old.hecha_por is not null and new.hecha_por is null
      and not exists (select 1 from hermanos where id = old.hecha_por)) then
    if new.hermandad_id is not distinct from old.hermandad_id
       and new.encargo_id is not distinct from old.encargo_id
       and new.titulo is not distinct from old.titulo
       and new.texto is not distinct from old.texto
       and new.que is not distinct from old.que
       and new.red is not distinct from old.red
       and new.estado is not distinct from old.estado
       and new.creado_en is not distinct from old.creado_en
       and new.notas is not distinct from old.notas then
      return new;
    end if;
  end if;

  -- UPDATE. Dos permisos distintos y muy desiguales.
  if v_lleva_redes then
    -- Quien lleva redes puede reasignar y corregir el texto. Lo único que no
    -- puede es cambiar de hermandad ni inventarse cuándo se creó.
    new.hermandad_id := old.hermandad_id;
    new.creado_en := old.creado_en;
    new.encargo_id := old.encargo_id;
  else
    /*
     * EL RESPONSABLE SOLO PUEDE DECIR «HECHO».
     *
     * Ni reasignarla, ni cambiarle el texto, ni quitársela de encima
     * dejándola sin dueño. Todo vuelve a como estaba menos el estado.
     */
    if v_yo is null or old.hermano_id is distinct from v_yo then
      raise exception 'Esta tarea no es tuya.';
    end if;
    new.hermandad_id := old.hermandad_id;
    new.encargo_id := old.encargo_id;
    new.titulo := old.titulo;
    new.texto := old.texto;
    new.que := old.que;
    new.red := old.red;
    new.hermano_id := old.hermano_id;
    new.creado_en := old.creado_en;
    new.notas := old.notas;
  end if;

  -- La fecha y el autor de «hecho» los pone la base, los toque quien los toque.
  if new.estado = 'hecha' and old.estado <> 'hecha' then
    new.hecha_en := now();
    new.hecha_por := coalesce(v_yo, old.hecha_por);
  elsif new.estado = 'pendiente' then
    -- Se puede reabrir —el post salió mal y hay que rehacerlo— y entonces se
    -- limpia el rastro anterior en vez de dejar una fecha que ya no es de nada.
    new.hecha_en := null;
    new.hecha_por := null;
  else
    new.hecha_en := old.hecha_en;
    new.hecha_por := old.hecha_por;
  end if;
  return new;
end $$;

drop trigger if exists tareas_redes_guardia on tareas_redes;
create trigger tareas_redes_guardia
  before insert or update or delete on tareas_redes
  for each row execute function tareas_redes_guardia();

-- ---------------------------------------------------------------------------
-- Quién ve y quién toca
-- ---------------------------------------------------------------------------

drop policy if exists "solo_mi_hermandad" on tareas_redes;
create policy "solo_mi_hermandad" on tareas_redes as restrictive for all to authenticated
  using (hermandad_id = hermandad_actual())
  with check (hermandad_id = hermandad_actual());

-- Quien lleva redes: lo ve todo y lo reparte.
drop policy if exists "redes_lee" on tareas_redes;
create policy "redes_lee" on tareas_redes for select to authenticated
  using (modulo_permitido('comunicados') or modulo_permitido('web'));

drop policy if exists "redes_encarga" on tareas_redes;
create policy "redes_encarga" on tareas_redes for insert to authenticated
  with check (modulo_permitido('comunicados') or modulo_permitido('web'));

drop policy if exists "redes_reparte" on tareas_redes;
create policy "redes_reparte" on tareas_redes for update to authenticated
  using (modulo_permitido('comunicados') or modulo_permitido('web'));

/*
 * Y EL RESPONSABLE VE LA SUYA Y LA CIERRA. Sin `auth_es_hermano()` a
 * propósito: los responsables de esto son la junta, y esa función da falso en
 * cuanto alguien lleva cargo. Lo que hace falta saber aquí es de quién es la
 * tarea, y eso lo contesta `hermano_propio_id()`.
 */
drop policy if exists "el responsable ve la suya" on tareas_redes;
create policy "el responsable ve la suya" on tareas_redes for select to authenticated
  using (hermano_id = hermano_propio_id());

drop policy if exists "el responsable la cierra" on tareas_redes;
create policy "el responsable la cierra" on tareas_redes for update to authenticated
  using (hermano_id = hermano_propio_id());

-- Sin política de DELETE, a propósito: lo dice también el disparador.
grant select, insert, update on tareas_redes to authenticated;

comment on table tareas_redes is
  'Las tareas que salen de encargar un post: escribirlo y subirlo a cada red. Una fila '
  'por tarea y no por encargo, para que dos responsables marcando la suya a la vez no '
  'se pisen. `encargo_id` las mantiene juntas.';
