-- -----------------------------------------------------------------------------
-- W10 · Lo que la web pública RECIBE
--
-- Mensajes del formulario de contacto, avisos de donativo y reservas de
-- lotería. Quien los manda NO ha iniciado sesión (es un visitante), así que
-- necesita poder INSERTAR sin más; leer el buzón, solo el personal.
--
-- Ejecutar en el editor SQL de Supabase después de `web-publica.sql`.
-- -----------------------------------------------------------------------------

create table if not exists mensajes_web (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'contacto' check (tipo in ('contacto', 'donativo', 'loteria')),
  fecha text not null default '',
  nombre text not null default '',
  email text not null default '',
  telefono text not null default '',
  asunto text not null default '',
  mensaje text not null default '',
  leido boolean not null default false,
  atendido boolean not null default false,
  -- Donativo
  importe numeric(10, 2),
  causa text,
  metodo text,
  -- Lotería
  participaciones int,
  creado_en timestamptz not null default now()
);

create index if not exists mensajes_web_creado_idx on mensajes_web (creado_en desc);

alter table mensajes_web enable row level security;

-- Cualquiera puede dejar algo en el buzón: es un formulario público. No puede
-- leerlo, ni cambiarlo, ni borrarlo — solo meter.
drop policy if exists "el visitante deja mensajes" on mensajes_web;
create policy "el visitante deja mensajes"
  on mensajes_web for insert
  to anon, authenticated
  with check (true);

-- El buzón lo lee y lo gestiona el personal de la hermandad. Los hermanos con
-- cuenta NO: sus cosas van por su área, no por aquí.
drop policy if exists "el personal lee el buzon" on mensajes_web;
create policy "el personal lee el buzon"
  on mensajes_web for select
  to authenticated
  using (not auth_es_hermano());

drop policy if exists "el personal gestiona el buzon" on mensajes_web;
create policy "el personal gestiona el buzon"
  on mensajes_web for update
  to authenticated
  using (not auth_es_hermano())
  with check (not auth_es_hermano());

drop policy if exists "el personal borra del buzon" on mensajes_web;
create policy "el personal borra del buzon"
  on mensajes_web for delete
  to authenticated
  using (not auth_es_hermano());
