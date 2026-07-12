-- =============================================================================
-- Cabildo — esquema de base de datos (Supabase / Postgres)
-- =============================================================================
-- Pensado para UNA hermandad por proyecto de Supabase (el titular y su
-- personal comparten este proyecto). RLS: cualquier usuario autenticado
-- puede leer/escribir — la restricción por cargo (tesorero solo ve
-- tesorería, etc.) se aplica hoy en la interfaz; se puede reforzar a nivel
-- de fila más adelante uniendo con la tabla `personal` por auth_user_id.
--
-- Cómo aplicarlo: pega este archivo entero en Supabase → SQL Editor → Run.
-- Es seguro volver a ejecutarlo (usa "if not exists" / "or replace" donde procede).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Datos de la hermandad (fila única de configuración)
-- -----------------------------------------------------------------------------
create table if not exists hermandad_settings (
  id smallint primary key default 1 check (id = 1), -- fuerza una sola fila
  nombre_legal text not null default '',
  cif text not null default '',
  direccion text not null default '',
  codigo_postal text not null default '',
  ciudad text not null default '',
  telefono text not null default '',
  email text not null default '',
  iban text not null default '',
  bizum_telefono text not null default '',
  identificador_acreedor text not null default '',
  logo_data_url text,
  color_primario text not null default '#caa24a',
  texto_pie_documentos text not null default '',
  updated_at timestamptz not null default now()
);
insert into hermandad_settings (id) values (1) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Censo de hermanos
-- -----------------------------------------------------------------------------
create table if not exists hermanos (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique,
  nombre text not null,
  estado text not null default 'Nuevo' check (estado in ('Activo', 'Nuevo', 'Baja')),
  antiguedad int not null default extract(year from now()),
  email text not null default '',
  telefono text not null default '',
  direccion text not null default '',
  cuota_al_dia boolean not null default false,
  iban text,
  dni text not null unique,
  clave_acceso text not null, -- TODO: pasar a hash cuando el login del hermano se resuelva server-side
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Cortejo: cuerpos/tramos
-- -----------------------------------------------------------------------------
create table if not exists tramos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cuerpo text not null default 'Único',
  capacidad int not null default 0,
  tipo text,
  reparto text check (reparto in ('numero', 'solicitud')),
  precio numeric(10, 2),
  orden int not null default 0
);

-- -----------------------------------------------------------------------------
-- Cuotas
-- -----------------------------------------------------------------------------
-- Las fechas de cuotas, papeletas, tesorería, etc. se guardan como texto
-- (p. ej. "12 jul 2026"), no como `date`: la app las genera ya formateadas
-- para mostrarlas tal cual, así que un tipo `date` real solo daría
-- problemas al insertar. Es una simplificación consciente: no se pueden
-- hacer consultas por rango de fechas directamente en la base de datos.
create table if not exists cuotas (
  id uuid primary key default gen_random_uuid(),
  numero int not null,
  hermano_id uuid not null references hermanos(id) on delete cascade,
  concepto text not null,
  importe numeric(10, 2) not null default 0,
  estado text not null default 'Pendiente' check (estado in ('Pagada', 'Pendiente', 'Devuelta')),
  fecha_emision text not null default '',
  fecha_cobro text not null default '',
  domiciliada boolean not null default false,
  fecha_pago text
);
create index if not exists cuotas_hermano_id_idx on cuotas(hermano_id);

-- -----------------------------------------------------------------------------
-- Papeletas de sitio
-- -----------------------------------------------------------------------------
create table if not exists papeletas (
  id uuid primary key default gen_random_uuid(),
  numero int not null,
  hermano_id uuid not null references hermanos(id) on delete cascade,
  anio int not null,
  tramo_id uuid references tramos(id) on delete set null,
  opcion text,
  importe numeric(10, 2) not null default 0,
  estado text not null default 'Solicitada'
    check (estado in ('Solicitada', 'Asignada', 'Pagada', 'Entregada', 'Anulada', 'Renuncia')),
  fecha_solicitud text not null default '',
  fecha_entrega text,
  pago_metodo text check (pago_metodo in ('Bizum', 'Transferencia')),
  pago_fecha text
);
create index if not exists papeletas_hermano_id_idx on papeletas(hermano_id);
create index if not exists papeletas_anio_idx on papeletas(anio);

-- -----------------------------------------------------------------------------
-- Tesorería
-- -----------------------------------------------------------------------------
create table if not exists movimientos (
  id uuid primary key default gen_random_uuid(),
  numero int not null,
  fecha text not null default '',
  concepto text not null,
  categoria text not null,
  tipo text not null check (tipo in ('Ingreso', 'Gasto')),
  importe numeric(10, 2) not null default 0,
  cuenta text not null default 'Cuenta bancaria',
  estado text not null default 'Pendiente' check (estado in ('Conciliado', 'Pendiente'))
);

-- -----------------------------------------------------------------------------
-- Incidencias del cortejo
-- -----------------------------------------------------------------------------
create table if not exists incidencias (
  id uuid primary key default gen_random_uuid(),
  papeleta_id uuid not null references papeletas(id) on delete cascade,
  tipo text not null default 'Otra',
  descripcion text not null default '',
  hora text not null default '',
  registrado_por text not null default '',
  hermano_sustituto_id uuid references hermanos(id) on delete set null,
  resuelta boolean not null default false
);

-- -----------------------------------------------------------------------------
-- Inventario (enseres)
-- -----------------------------------------------------------------------------
create table if not exists enseres (
  id uuid primary key default gen_random_uuid(),
  numero int not null,
  nombre text not null,
  categoria text not null default 'Otro',
  ubicacion text not null default '',
  estado_conservacion text not null default 'Bueno'
    check (estado_conservacion in ('Bueno', 'Regular', 'Necesita restauración')),
  valor_asegurado numeric(10, 2),
  prestado_a text,
  fecha_alta text not null default '',
  notas text not null default ''
);

-- -----------------------------------------------------------------------------
-- Archivo documental
-- -----------------------------------------------------------------------------
create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  numero int not null,
  nombre text not null,
  categoria text not null
    check (categoria in ('Acta', 'Regla', 'Contrato', 'Boletín', 'Expediente', 'Archivo histórico')),
  fecha text not null default '',
  fecha_alta text not null default '',
  descripcion text not null default '',
  archivado_por text,
  tipo_cabildo text check (tipo_cabildo in ('General', 'Extraordinario', 'De Oficiales')),
  proveedor text,
  vigencia_hasta text,
  estado_expediente text check (estado_expediente in ('Abierto', 'Cerrado')),
  archivo_nombre text,
  archivo_tipo text,
  archivo_tamano bigint,
  -- Cargos con acceso a un documento restringido; null = visible para cualquiera autenticado.
  cargos_con_acceso text[]
);

-- -----------------------------------------------------------------------------
-- Comunicados
-- -----------------------------------------------------------------------------
create table if not exists comunicados (
  id uuid primary key default gen_random_uuid(),
  numero int not null,
  titulo text not null,
  cuerpo text not null default '',
  canal text not null default 'Email',
  destinatarios text not null default 'Todos los hermanos',
  estado text not null default 'Borrador' check (estado in ('Borrador', 'Programado', 'Enviado')),
  fecha_creacion text not null default '',
  fecha_programada text,
  fecha_envio text,
  autor text not null default '',
  alcance int,
  -- Redes sociales en las que se publica (solo si canal = 'Redes sociales'); null si no aplica.
  redes text[]
);

create table if not exists cuentas_sociales (
  red text primary key check (red in ('Facebook', 'Instagram', 'X', 'YouTube', 'TikTok')),
  conectada boolean not null default false,
  usuario text
);
insert into cuentas_sociales (red) values ('Facebook'), ('Instagram'), ('X'), ('YouTube'), ('TikTok')
  on conflict (red) do nothing;

-- -----------------------------------------------------------------------------
-- Personal con cargo (tesorero/a, secretaría…) y permisos por cargo
-- -----------------------------------------------------------------------------
create table if not exists personal (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  clave text not null, -- TODO: en cuanto el login de personal pase por Supabase Auth, esta columna deja de hacer falta
  cargo text not null,
  activo boolean not null default true,
  fecha_alta text not null default '',
  auth_user_id uuid references auth.users(id) on delete set null
);

create table if not exists permisos_cargo (
  cargo text not null,
  modulo_id text not null,
  primary key (cargo, modulo_id)
);

-- Permisos de fábrica (los mismos que trae la app por defecto; se pueden editar desde /app/personal)
insert into permisos_cargo (cargo, modulo_id) values
  ('Hermano Mayor', 'hermanos'), ('Hermano Mayor', 'cortejo'), ('Hermano Mayor', 'cuotas'),
  ('Hermano Mayor', 'papeletas'), ('Hermano Mayor', 'tesoreria'), ('Hermano Mayor', 'inventario'),
  ('Hermano Mayor', 'archivo'), ('Hermano Mayor', 'comunicados'), ('Hermano Mayor', 'informes'),
  ('Hermano Mayor', 'personal'), ('Hermano Mayor', 'configuracion'),
  ('Secretario/a', 'hermanos'), ('Secretario/a', 'cortejo'), ('Secretario/a', 'papeletas'),
  ('Secretario/a', 'archivo'), ('Secretario/a', 'comunicados'), ('Secretario/a', 'informes'),
  ('Tesorero/a', 'tesoreria'), ('Tesorero/a', 'cuotas'), ('Tesorero/a', 'inventario'), ('Tesorero/a', 'informes'),
  ('Fiscal', 'archivo'), ('Fiscal', 'informes'),
  ('Mayordomo/Prioste', 'cortejo'), ('Mayordomo/Prioste', 'inventario'), ('Mayordomo/Prioste', 'informes'),
  ('Diputado/a Mayor de Gobierno', 'hermanos'), ('Diputado/a Mayor de Gobierno', 'cortejo'),
  ('Diputado/a Mayor de Gobierno', 'papeletas'), ('Diputado/a Mayor de Gobierno', 'informes'),
  ('Vocal', 'comunicados'), ('Vocal', 'informes')
on conflict (cargo, modulo_id) do nothing;

-- -----------------------------------------------------------------------------
-- Solicitudes de alta como hermano/a (desde el área del hermano)
-- -----------------------------------------------------------------------------
create table if not exists solicitudes_alta (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  dni text not null,
  email text not null default '',
  telefono text not null default '',
  clave_propuesta text not null,
  fecha text not null default '',
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Aprobada', 'Rechazada'))
);

-- -----------------------------------------------------------------------------
-- Catálogos configurables (conceptos de cuota, papeletas, listas simples)
-- -----------------------------------------------------------------------------
create table if not exists conceptos_cuota (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  importe numeric(10, 2) not null default 0,
  orden int not null default 0
);

create table if not exists opciones_papeleta (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  importe numeric(10, 2) not null default 0,
  orden int not null default 0
);

-- Listas genéricas (canales de comunicado, categorías de enser, tipos de incidencia…)
create table if not exists catalogos (
  clave text not null,
  valor text not null,
  orden int not null default 0,
  primary key (clave, valor)
);

-- =============================================================================
-- Seguridad a nivel de fila (RLS): cualquier persona con sesión iniciada en
-- este proyecto (titular o personal) puede leer y escribir. El cargo filtra
-- lo que se ve en la interfaz; esto es la base mínima de seguridad de datos.
-- =============================================================================
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'hermandad_settings', 'hermanos', 'tramos', 'cuotas', 'papeletas', 'movimientos',
      'incidencias', 'enseres', 'documentos', 'comunicados',
      'cuentas_sociales', 'personal', 'permisos_cargo',
      'solicitudes_alta', 'conceptos_cuota', 'opciones_papeleta', 'catalogos'
    ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated_all" on %I', t);
    execute format(
      'create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- La tabla de solicitudes de alta también debe poder rellenarse desde el área
-- del hermano SIN sesión iniciada (todavía no es hermano/a): se permite
-- insertar de forma anónima, pero no leer ni modificar sin sesión.
drop policy if exists "anon_insert_solicitudes" on solicitudes_alta;
create policy "anon_insert_solicitudes" on solicitudes_alta for insert to anon with check (true);
