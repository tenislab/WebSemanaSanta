-- =============================================================================
-- Cabildo — migración de agosto de 2026
-- =============================================================================
-- Para bases de datos YA creadas con una versión anterior de schema.sql.
-- Si vas a crear la base desde cero, no hace falta: schema.sql ya lo incluye.
--
-- Cómo aplicarlo: pega este archivo entero en Supabase → SQL Editor → Run.
-- Es seguro volver a ejecutarlo.
-- =============================================================================

-- 1) Censo: campos nuevos ------------------------------------------------------
-- etiquetas: grupos del hermano (costalero, acólito…), para segmentar avisos.
-- fecha_nacimiento: necesaria para segmentar por edad (mayores/menores).
-- baja_solicitada: el hermano ha pedido la baja y la secretaría aún no la tramita.
alter table hermanos add column if not exists etiquetas text[] not null default '{}';
alter table hermanos add column if not exists fecha_nacimiento date;
alter table hermanos add column if not exists baja_solicitada boolean not null default false;

-- 2) Censo: la numeración deja de ser única a secas ---------------------------
-- Al dar de baja, el hermano sale de la numeración con numero = 0, y puede
-- haber varios a la vez. La unicidad se exige solo entre los que tienen número.
alter table hermanos drop constraint if exists hermanos_numero_key;
create unique index if not exists hermanos_numero_activo_uniq on hermanos (numero) where numero > 0;

-- 3) Cuotas: ejercicio ---------------------------------------------------------
alter table cuotas add column if not exists ejercicio int;
-- Las cuotas antiguas se atribuyen al año que aparece en su fecha de emisión.
update cuotas
   set ejercicio = nullif(substring(fecha_emision from '\d{4}'), '')::int
 where ejercicio is null;

-- 4) Eventos y tareas ----------------------------------------------------------
create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null default 'Otro',
  fecha date not null,
  hora text,
  lugar text,
  descripcion text,
  tareas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table eventos enable row level security;
drop policy if exists "eventos_staff_all" on eventos;
create policy "eventos_staff_all" on eventos for all to authenticated
  using (not auth_es_hermano() and modulo_permitido('eventos'))
  with check (not auth_es_hermano() and modulo_permitido('eventos'));
drop policy if exists "eventos_hermano_select" on eventos;
create policy "eventos_hermano_select" on eventos for select to authenticated using (true);

-- =============================================================================
-- H3 · El hermano avisa de que ya ha pagado
-- =============================================================================
-- Cuando el hermano paga un recibo por Bizum o transferencia desde su área,
-- deja constancia aquí (método y fecha). La tesorería lo confirma al ver el
-- ingreso, y entonces el aviso se limpia junto con el cambio a «Pagada».
alter table cuotas add column if not exists pago_comunicado jsonb;

-- =============================================================================
-- W10 · Lo que la web pública recibe
-- =============================================================================
-- La tabla y sus permisos están en `mensajes-web.sql`, que hay que ejecutar
-- aparte porque también hace falta al crear la base desde cero.

-- =============================================================================
-- P2 · Que las bajas se vean
-- =============================================================================
-- Cuándo pidió la baja y por qué, si quiso decirlo. Sin la fecha, la secretaría
-- no sabe cuánto lleva esperando; sin el motivo, no puede reaccionar.
alter table hermanos add column if not exists baja_solicitada_el text;
alter table hermanos add column if not exists motivo_baja text;

-- =============================================================================
-- P3 · La ficha del hermano completa
-- =============================================================================
-- La foto va con su consentimiento aparte: es un dato personal de los que hay
-- que poder demostrar que se consintieron.
alter table hermanos add column if not exists foto_data_url text;
alter table hermanos add column if not exists consiente_foto boolean not null default false;
alter table hermanos add column if not exists parroquia_bautismo text;
alter table hermanos add column if not exists fecha_bautismo text;
alter table hermanos add column if not exists talla_tunica text;
alter table hermanos add column if not exists notas_salud text;

-- =============================================================================
-- P6 · Roles automáticos según la papeleta
-- =============================================================================
-- Qué rol da cada tramo u opción a quien saca allí su papeleta («Costalero»,
-- «Acólito», «Mantilla»). La etiqueta NO se guarda en el hermano: se deriva de
-- sus papeletas del año, así que no puede quedar descuadrada.
alter table tramos add column if not exists etiqueta text;
alter table opciones_papeleta add column if not exists etiqueta text;
