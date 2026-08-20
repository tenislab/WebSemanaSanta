-- =============================================================================
--   QUIÉN HIZO QUÉ
-- =============================================================================
--
-- Una junta de hermandad se renueva cada pocos años y hereda un censo que no
-- ha montado. Cuando algo no cuadra —un hermano de baja que no debería
-- estarlo, un IBAN cambiado, una papeleta anulada— la primera pregunta es
-- siempre la misma: quién lo hizo y cuándo. Hasta ahora no había forma de
-- saberlo.
--
-- Y no es solo comodidad. Un censo de hermandad es categoría especial del
-- RGPD, y el artículo 32 pide poder demostrar quién accede y modifica.
--
-- QUÉ SE GUARDA: quién, qué, sobre quién, y cuándo. NO se guarda el contenido
-- del cambio. Apuntar «el IBAN pasó de X a Y» duplicaría datos bancarios en
-- una segunda tabla que nadie vigila, y para responder a la pregunta que se
-- hace de verdad basta con saber quién lo tocó y cuándo.
--
-- Ejecutar DESPUÉS de TODO-EN-UNO.sql.
-- =============================================================================

create table if not exists registro_actividad (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid references hermandades(id) on delete cascade,
  -- Quién: la cuenta, y su nombre tal como era ENTONCES. Se guarda el nombre
  -- copiado a propósito: si esa persona deja la junta y se borra su ficha, el
  -- registro tiene que seguir diciendo quién fue.
  autor_id uuid,
  autor_nombre text not null default '',
  -- Qué pasó, en una palabra: 'baja', 'alta', 'iban', 'papeleta_anulada'…
  accion text not null,
  -- Sobre qué o quién. El nombre también copiado, por lo mismo de arriba.
  sobre_tipo text not null default '',
  sobre_id text,
  sobre_nombre text not null default '',
  -- Una frase para leerlo sin tener que interpretar nada.
  detalle text not null default '',
  cuando timestamptz not null default now()
);

alter table registro_actividad enable row level security;
alter table registro_actividad alter column hermandad_id set default hermandad_actual();
create index if not exists registro_actividad_hermandad_idx on registro_actividad (hermandad_id, cuando desc);

-- La frontera, igual que el resto: nadie ve el registro de otra hermandad.
drop policy if exists "solo_mi_hermandad" on registro_actividad;
create policy "solo_mi_hermandad" on registro_actividad as restrictive for all to public
  using (hermandad_id = hermandad_actual())
  with check (hermandad_id = hermandad_actual());

-- Lo lee y lo escribe el personal. Los hermanos no: su área es lo suyo, no
-- quién ha tocado el censo.
drop policy if exists "registro_personal" on registro_actividad;
create policy "registro_personal" on registro_actividad for select to authenticated
  using (not auth_es_hermano());
drop policy if exists "registro_apuntar" on registro_actividad;
create policy "registro_apuntar" on registro_actividad for insert to authenticated
  with check (not auth_es_hermano());

-- NO se puede modificar ni borrar. Nadie, ni el titular.
--
-- Es lo que hace que sirva para algo: un registro que puede reescribir quien
-- tiene algo que ocultar no prueba nada. No se crea política de update ni de
-- delete, así que la restrictiva de arriba deja las dos cerradas.
