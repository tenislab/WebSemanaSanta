-- ============================================================================
--  W9 · La web pública en la base de datos
--
--  Hasta ahora la web vivía solo en el navegador de quien la edita. Para que
--  el enlace se comparta bien (WhatsApp y Facebook NO ejecutan JavaScript: lo
--  que ponga el navegador después de cargar, ellos no lo ven) hace falta que
--  un servidor devuelva el HTML con el título, la descripción y la imagen de
--  ESA hermandad. Y para eso el servidor tiene que poder leerla.
--
--  Se guarda como un único JSON: es exactamente el objeto `WebPublica` que ya
--  maneja la aplicación, así que no hay dos modelos que mantener a la vez.
-- ============================================================================

create table if not exists web_publica (
  -- Una sola web por hermandad. Con multi-hermandad, esta es la clave.
  id integer primary key default 1,
  slug text not null unique,
  publicada boolean not null default false,
  -- El objeto entero, tal cual lo guarda la aplicación.
  datos jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

alter table web_publica enable row level security;

-- Cualquiera puede LEER una web publicada: es pública, ese es el sentido.
-- Una sin publicar no la ve nadie de fuera.
drop policy if exists "web publicada, lectura para todos" on web_publica;
create policy "web publicada, lectura para todos"
  on web_publica for select
  using (publicada = true);

-- Y el personal de la hermandad la ve y la edita, publicada o no.
drop policy if exists "el personal edita la web" on web_publica;
create policy "el personal edita la web"
  on web_publica for all
  to authenticated
  using (true)
  with check (true);

-- Se toca sola cada vez que se guarda, para el `lastmod` del sitemap.
create or replace function web_publica_touch() returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists web_publica_touch on web_publica;
create trigger web_publica_touch before update on web_publica
  for each row execute function web_publica_touch();
