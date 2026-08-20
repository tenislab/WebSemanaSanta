-- =============================================================================
--
--   CABILDO — TODO EL SQL, EN UN SOLO ARCHIVO
--
-- =============================================================================
--
-- CÓMO SE USA:
--
--   1. Abre tu proyecto en supabase.com
--   2. Menú izquierdo → SQL Editor → New query
--   3. Copia ESTE ARCHIVO ENTERO, pégalo y dale a RUN
--
-- Tarda unos segundos. Es seguro volver a ejecutarlo: todo está escrito para
-- no romperse si ya existía (usa "if not exists" y "drop policy if exists").
--
-- -----------------------------------------------------------------------------
-- QUÉ CREA, POR ORDEN
-- -----------------------------------------------------------------------------
--
--   1. schema.sql           Todas las tablas
--   2. rls-cargos.sql       Permisos por cargo de la junta
--   3. rls-endurecer.sql    ⚠️  EL IMPORTANTE (ver abajo)
--   4. hermano-auth.sql     Acceso del hermano a su propia ficha
--   5. web-publica.sql      La web pública
--   6. mensajes-web.sql     Buzón de los formularios de la web
--   7. storage-archivo.sql  Adjuntos del archivo documental
--
-- -----------------------------------------------------------------------------
-- ⚠️  LO ÚNICO QUE HAY QUE LEER ANTES
-- -----------------------------------------------------------------------------
--
-- El bloque 3 (rls-endurecer) es el que impide que cualquiera que se registre
-- en /registro obtenga permiso de escritura sobre TODA la base de datos.
--
-- El bloque 8 (multi-hermandad) es el que hace que en esta misma base de datos
-- quepan TODAS las hermandades sin que ninguna vea nada de las demás. Es el
-- más importante de todos y tiene que ir el último.
--
-- YA NO HAY QUE DARSE DE ALTA A MANO COMO TITULAR. Antes había que copiar el
-- identificador de la cuenta y escribir un `insert` a mano; ahora, la primera
-- vez que entras, la aplicación crea tu hermandad y te deja como titular sola.
-- Tú solo tienes que registrarte en la aplicación con tu correo.
--
-- =============================================================================



-- =============================================================================
--   BLOQUE 1 de 8  ·  schema.sql
-- =============================================================================

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
  provincia text not null default '',
  telefono text not null default '',
  email text not null default '',
  iban text not null default '',
  bizum_telefono text not null default '',
  identificador_acreedor text not null default '',
  logo_data_url text,
  color_primario text not null default '#caa24a',
  color_secundario text not null default '#C5A059',
  texto_pie_documentos text not null default '',
  updated_at timestamptz not null default now()
);
insert into hermandad_settings (id) values (1) on conflict (id) do nothing;
-- Instalaciones anteriores: añade el segundo color si falta (idempotente).
alter table hermandad_settings add column if not exists color_secundario text not null default '#C5A059';

-- -----------------------------------------------------------------------------
-- Censo de hermanos
-- -----------------------------------------------------------------------------
create table if not exists hermanos (
  id uuid primary key default gen_random_uuid(),
  -- OJO: sin "unique" a secas. Los hermanos dados de baja quedan fuera de la
  -- numeración con numero = 0, y puede haber varios; la unicidad se exige solo
  -- entre los que SÍ tienen número (índice parcial, más abajo).
  numero int not null,
  nombre text not null,
  estado text not null default 'Nuevo' check (estado in ('Activo', 'Nuevo', 'Baja')),
  antiguedad int not null default extract(year from now()),
  email text not null default '',
  telefono text not null default '',
  direccion text not null default '',
  cuota_al_dia boolean not null default false,
  iban text,
  dni text not null unique,
  clave_acceso text not null, -- ya no se usa para entrar (ver auth_user_id); queda por compatibilidad con el modo demostración
  auth_user_id uuid unique references auth.users(id) on delete set null,
  etiquetas text[] not null default '{}',
  fecha_nacimiento date,
  -- Foto del hermano (P3), con su consentimiento aparte: es un dato personal
  -- de los que hay que poder demostrar que se consintieron.
  foto_data_url text,
  consiente_foto boolean not null default false,
  parroquia_bautismo text,
  fecha_bautismo text,
  talla_tunica text,
  notas_salud text,
  baja_solicitada boolean not null default false,
  -- Cuándo la pidió y por qué, si quiso decirlo (P2).
  baja_solicitada_el text,
  motivo_baja text,
  created_at timestamptz not null default now()
);
create unique index if not exists hermanos_numero_activo_uniq on hermanos (numero) where numero > 0;

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
  -- Qué rol da este tramo a quien va en él (P6): «Costalero», «Acólito»…
  etiqueta text,
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
  estado text not null default 'Pendiente' check (estado in ('Pagada', 'Pendiente', 'Devuelta', 'En mora')),
  fecha_emision text not null default '',
  fecha_cobro text not null default '',
  domiciliada boolean not null default false,
  -- Método de cobro (Domiciliación/Transferencia/Efectivo/Bizum) y datos de la
  -- mora manual (quién la propone cuando hace falta confirmación de dos cargos).
  metodo_cobro text,
  mora_propuesta_por text,
  mora_propuesta_nombre text,
  fecha_pago text,
  -- Ejercicio (año) al que pertenece la cuota; si falta, se deduce del año de
  -- la fecha de emisión.
  ejercicio int,
  -- El hermano ha avisado desde su área de que ya lo ha pagado (por dónde y
  -- cuándo). La tesorería lo confirma al ver el ingreso.
  pago_comunicado jsonb
);
create index if not exists cuotas_hermano_id_idx on cuotas(hermano_id);

-- Si la tabla cuotas ya existía de una instalación anterior, añade las columnas
-- nuevas y amplía el check del estado (ejecutar es idempotente).
alter table cuotas add column if not exists metodo_cobro text;
alter table cuotas add column if not exists mora_propuesta_por text;
alter table cuotas add column if not exists mora_propuesta_nombre text;
alter table cuotas add column if not exists pago_comunicado jsonb;
do $$
begin
  alter table cuotas drop constraint if exists cuotas_estado_check;
  alter table cuotas add constraint cuotas_estado_check
    check (estado in ('Pagada', 'Pendiente', 'Devuelta', 'En mora'));
exception when others then null;
end $$;

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
  pago_fecha text,
  -- Cobro registrado por la secretaría (método, fecha) y motivo si se anula.
  metodo_pago text,
  fecha_pago text,
  motivo_anulacion text
);
create index if not exists papeletas_hermano_id_idx on papeletas(hermano_id);
create index if not exists papeletas_anio_idx on papeletas(anio);
-- Instalaciones anteriores: añade las columnas nuevas si faltan (idempotente).
alter table papeletas add column if not exists metodo_pago text;
alter table papeletas add column if not exists fecha_pago text;
alter table papeletas add column if not exists motivo_anulacion text;

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
  -- Qué rol da esta opción a quien la saca (P6).
  etiqueta text,
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
-- Seguridad a nivel de fila (RLS)
-- =============================================================================
-- El personal (titular, tesorero/a, secretaría…) puede leer y escribir en
-- todo; el cargo filtra lo que ve en la interfaz. Los hermanos entran con su
-- propia cuenta real de Supabase Auth (ver auth_user_id en `hermanos`) y solo
-- pueden ver/tocar su propia ficha, sus propias cuotas y sus propias
-- papeletas — nada del resto de tablas de gestión.

-- Distingue una sesión de hermano de una de personal: se marca en el
-- user_metadata al crear la cuenta (ver signUp en la app).
create or replace function auth_es_hermano() returns boolean
  language sql stable as $$
    select coalesce((auth.jwt() -> 'user_metadata' ->> 'tipo') = 'hermano', false)
  $$;
grant execute on function auth_es_hermano() to anon, authenticated;

-- Id de hermano correspondiente a la sesión activa (null si no es un hermano
-- o no tiene cuenta vinculada todavía).
create or replace function hermano_propio_id() returns uuid
  language sql stable as $$
    select id from hermanos where auth_user_id = auth.uid()
  $$;
grant execute on function hermano_propio_id() to authenticated;

-- Resuelve el correo de un hermano a partir de su DNI, para poder iniciar
-- sesión con Supabase Auth (que pide correo) desde un formulario de DNI +
-- contraseña. No expone nada más: ni la contraseña ni el resto de la ficha.
create or replace function resolver_email_hermano(p_dni text) returns text
  language sql stable security definer set search_path = public as $$
    select email from hermanos where upper(dni) = upper(p_dni) limit 1
  $$;
grant execute on function resolver_email_hermano(text) to anon, authenticated;

-- Habilita RLS en todas las tablas de gestión (las políticas concretas se
-- crean más abajo, por bloques).
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
  end loop;
end $$;

-- ¿Puede el personal actual ESCRIBIR en este módulo? El titular (la cuenta
-- con la que se creó la hermandad, sin fila en `personal`) siempre puede.
-- El personal con cargo, solo si su cargo tiene el módulo permitido en
-- Personal y permisos y sigue activo. security definer: sin esto, la propia
-- consulta a `personal` quedaría bloqueada por las políticas que usan esta
-- función (personal y solicitudes_alta también restringen la LECTURA).
create or replace function modulo_permitido(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select
      not exists (select 1 from personal where auth_user_id = auth.uid())
      or exists (
        select 1 from personal p
        join permisos_cargo pc on pc.cargo = p.cargo
        where p.auth_user_id = auth.uid() and p.activo and pc.modulo_id = p_modulo
      )
  $$;
grant execute on function modulo_permitido(text) to authenticated;

-- Tablas de gestión "normales": la LECTURA queda abierta a todo el personal
-- (casi toda pantalla necesita nombres/datos de otros módulos, p. ej. Cuotas
-- muestra el nombre del hermano); ESCRIBIR (crear/editar/borrar) exige el
-- módulo correspondiente.
do $$
declare
  reg record;
begin
  for reg in
    select * from (values
      ('hermandad_settings', 'configuracion'),
      ('tramos', 'configuracion'),
      ('movimientos', 'tesoreria'),
      ('incidencias', 'cortejo'),
      ('enseres', 'inventario'),
      ('documentos', 'archivo'),
      ('comunicados', 'comunicados'),
      ('cuentas_sociales', 'comunicados'),
      ('permisos_cargo', 'personal'),
      ('conceptos_cuota', 'configuracion'),
      ('opciones_papeleta', 'configuracion'),
      ('catalogos', 'configuracion')
    ) as t(tabla, modulo)
  loop
    execute format('drop policy if exists "authenticated_all" on %I', reg.tabla);
    execute format('drop policy if exists "%s_staff_select" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_select" on %I for select to authenticated using (not auth_es_hermano())',
      reg.tabla, reg.tabla
    );
    execute format('drop policy if exists "%s_staff_insert" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_insert" on %I for insert to authenticated with check (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_update" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_update" on %I for update to authenticated using (not auth_es_hermano() and modulo_permitido(%L)) with check (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_delete" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_delete" on %I for delete to authenticated using (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
  end loop;
end $$;

-- Tablas con un dato sensible propio (contraseñas en claro): también se
-- restringe la LECTURA al módulo correspondiente, no solo la escritura.
do $$
declare
  reg record;
begin
  for reg in
    select * from (values
      ('personal', 'personal'),
      ('solicitudes_alta', 'hermanos')
    ) as t(tabla, modulo)
  loop
    execute format('drop policy if exists "authenticated_all" on %I', reg.tabla);
    execute format('drop policy if exists "%s_staff_select" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_select" on %I for select to authenticated using (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_insert" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_insert" on %I for insert to authenticated with check (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_update" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_update" on %I for update to authenticated using (not auth_es_hermano() and modulo_permitido(%L)) with check (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_delete" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_delete" on %I for delete to authenticated using (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
  end loop;
end $$;

-- La tabla de solicitudes de alta también debe poder rellenarse desde el área
-- del hermano SIN sesión iniciada (todavía no es hermano/a): se permite
-- insertar de forma anónima, pero no leer ni modificar sin sesión.
drop policy if exists "anon_insert_solicitudes" on solicitudes_alta;
create policy "anon_insert_solicitudes" on solicitudes_alta for insert to anon with check (true);

-- Hermanos: el personal ve a todos (según su módulo puede además crear,
-- editar o borrar); cada hermano solo ve y edita su propia ficha (no puede
-- darse de alta ni borrarse a sí mismo).
drop policy if exists "authenticated_all" on hermanos;
drop policy if exists "hermanos_personal_all" on hermanos;
drop policy if exists "hermanos_staff_select" on hermanos;
create policy "hermanos_staff_select" on hermanos for select to authenticated
  using (not auth_es_hermano());
drop policy if exists "hermanos_staff_insert" on hermanos;
create policy "hermanos_staff_insert" on hermanos for insert to authenticated
  with check (not auth_es_hermano() and modulo_permitido('hermanos'));
drop policy if exists "hermanos_staff_update" on hermanos;
create policy "hermanos_staff_update" on hermanos for update to authenticated
  using (not auth_es_hermano() and modulo_permitido('hermanos'))
  with check (not auth_es_hermano() and modulo_permitido('hermanos'));
drop policy if exists "hermanos_staff_delete" on hermanos;
create policy "hermanos_staff_delete" on hermanos for delete to authenticated
  using (not auth_es_hermano() and modulo_permitido('hermanos'));
drop policy if exists "hermanos_propio_select" on hermanos;
create policy "hermanos_propio_select" on hermanos for select to authenticated
  using (auth_es_hermano() and auth_user_id = auth.uid());
drop policy if exists "hermanos_propio_update" on hermanos;
create policy "hermanos_propio_update" on hermanos for update to authenticated
  using (auth_es_hermano() and auth_user_id = auth.uid())
  with check (auth_es_hermano() and auth_user_id = auth.uid());

-- Cuotas: el personal ve todas (el módulo "cuotas" hace falta para
-- crear/editar/borrar); cada hermano solo ve las suyas (no las puede crear
-- ni modificar: eso es cosa de tesorería).
drop policy if exists "authenticated_all" on cuotas;
drop policy if exists "cuotas_personal_all" on cuotas;
drop policy if exists "cuotas_staff_select" on cuotas;
create policy "cuotas_staff_select" on cuotas for select to authenticated
  using (not auth_es_hermano());
drop policy if exists "cuotas_staff_insert" on cuotas;
create policy "cuotas_staff_insert" on cuotas for insert to authenticated
  with check (not auth_es_hermano() and modulo_permitido('cuotas'));
drop policy if exists "cuotas_staff_update" on cuotas;
create policy "cuotas_staff_update" on cuotas for update to authenticated
  using (not auth_es_hermano() and modulo_permitido('cuotas'))
  with check (not auth_es_hermano() and modulo_permitido('cuotas'));
drop policy if exists "cuotas_staff_delete" on cuotas;
create policy "cuotas_staff_delete" on cuotas for delete to authenticated
  using (not auth_es_hermano() and modulo_permitido('cuotas'));
drop policy if exists "cuotas_propio_select" on cuotas;
create policy "cuotas_propio_select" on cuotas for select to authenticated
  using (auth_es_hermano() and hermano_id = hermano_propio_id());

-- Papeletas: tanto Papeletas de sitio como Cortejo escriben en esta tabla
-- (asignar tramo, marcar pago, etc.), así que cualquiera de los dos módulos
-- vale para crear/editar/borrar. Cada hermano ve, solicita y renuncia solo a
-- las suyas.
drop policy if exists "authenticated_all" on papeletas;
drop policy if exists "papeletas_personal_all" on papeletas;
drop policy if exists "papeletas_staff_select" on papeletas;
create policy "papeletas_staff_select" on papeletas for select to authenticated
  using (not auth_es_hermano());
drop policy if exists "papeletas_staff_insert" on papeletas;
create policy "papeletas_staff_insert" on papeletas for insert to authenticated
  with check (not auth_es_hermano() and (modulo_permitido('papeletas') or modulo_permitido('cortejo')));
drop policy if exists "papeletas_staff_update" on papeletas;
create policy "papeletas_staff_update" on papeletas for update to authenticated
  using (not auth_es_hermano() and (modulo_permitido('papeletas') or modulo_permitido('cortejo')))
  with check (not auth_es_hermano() and (modulo_permitido('papeletas') or modulo_permitido('cortejo')));
drop policy if exists "papeletas_staff_delete" on papeletas;
create policy "papeletas_staff_delete" on papeletas for delete to authenticated
  using (not auth_es_hermano() and (modulo_permitido('papeletas') or modulo_permitido('cortejo')));
drop policy if exists "papeletas_propio_select" on papeletas;
create policy "papeletas_propio_select" on papeletas for select to authenticated
  using (auth_es_hermano() and hermano_id = hermano_propio_id());
drop policy if exists "papeletas_propio_insert" on papeletas;
create policy "papeletas_propio_insert" on papeletas for insert to authenticated
  with check (auth_es_hermano() and hermano_id = hermano_propio_id());
drop policy if exists "papeletas_propio_update" on papeletas;
create policy "papeletas_propio_update" on papeletas for update to authenticated
  using (auth_es_hermano() and hermano_id = hermano_propio_id())
  with check (auth_es_hermano() and hermano_id = hermano_propio_id());


-- -----------------------------------------------------------------------------
-- Eventos y tareas (agenda de la hermandad)
-- -----------------------------------------------------------------------------
-- Las tareas de cada evento van embebidas como JSON: siempre se leen y se
-- guardan junto al evento, y así no hace falta una tabla aparte.
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
-- Los hermanos pueden consultar la agenda (sin editarla).
drop policy if exists "eventos_hermano_select" on eventos;
create policy "eventos_hermano_select" on eventos for select to authenticated using (true);


-- =============================================================================
--   BLOQUE 2 de 8  ·  rls-cargos.sql
-- =============================================================================

-- Refuerza la RLS por cargo del personal. Seguro de ejecutar sobre una base
-- de datos ya en uso: no borra tablas ni filas, solo cambia políticas y crea
-- una función. Ejecuta esto después de schema.sql y hermano-auth.sql.
--
-- Hasta ahora, cualquier miembro del personal con sesión iniciada podía leer
-- Y escribir en TODAS las tablas de gestión, aunque su cargo solo tuviera
-- permiso para un módulo (la interfaz ocultaba el resto, pero la base de
-- datos no lo impedía). A partir de aquí:
--  - LEER sigue abierto a todo el personal en la mayoría de tablas: casi
--    todas las pantallas necesitan mostrar nombres/datos de otros módulos
--    (p. ej. Cuotas necesita el nombre del hermano). Restringir la lectura
--    por módulo en esas tablas rompería esas referencias cruzadas.
--  - ESCRIBIR (crear/editar/borrar) sí queda limitado al módulo que el cargo
--    tenga permitido en Personal y permisos. El titular (la cuenta con la
--    que se creó la hermandad, sin cargo asignado) sigue sin restricciones.
--  - Dos tablas con un dato sensible propio (personal: contraseñas de otros
--    miembros; solicitudes_alta: contraseña elegida por quien pide el alta)
--    quedan también restringidas en LECTURA al módulo "personal"/"hermanos".

-- ATENCIÓN: esta versión de `modulo_permitido` da acceso total a cualquier
-- cuenta que no esté en `personal`, y eso incluye a quien se registre por su
-- cuenta en /registro. La sustituye `rls-endurecer.sql`, que hay que ejecutar
-- justo después de este archivo. Se deja aquí solo para no romper el orden de
-- las migraciones ya aplicadas.
--
-- ¿Puede el personal actual ESCRIBIR en este módulo? El titular (sin fila en
-- `personal`) siempre puede. El personal con cargo, solo si su cargo tiene
-- el módulo permitido en `permisos_cargo` y sigue activo. security definer:
-- sin esto, la propia consulta a `personal` quedaría bloqueada por las
-- políticas que usan esta función (personal y solicitudes_alta también
-- restringen la lectura).
create or replace function modulo_permitido(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select
      not exists (select 1 from personal where auth_user_id = auth.uid())
      or exists (
        select 1 from personal p
        join permisos_cargo pc on pc.cargo = p.cargo
        where p.auth_user_id = auth.uid() and p.activo and pc.modulo_id = p_modulo
      )
  $$;
grant execute on function modulo_permitido(text) to authenticated;

-- Tablas de gestión "normales": la LECTURA queda abierta a todo el personal;
-- ESCRIBIR (crear/editar/borrar) exige el módulo correspondiente.
do $$
declare
  reg record;
begin
  for reg in
    select * from (values
      ('hermandad_settings', 'configuracion'),
      ('tramos', 'configuracion'),
      ('movimientos', 'tesoreria'),
      ('incidencias', 'cortejo'),
      ('enseres', 'inventario'),
      ('documentos', 'archivo'),
      ('comunicados', 'comunicados'),
      ('cuentas_sociales', 'comunicados'),
      ('permisos_cargo', 'personal'),
      ('conceptos_cuota', 'configuracion'),
      ('opciones_papeleta', 'configuracion'),
      ('catalogos', 'configuracion')
    ) as t(tabla, modulo)
  loop
    execute format('drop policy if exists "authenticated_all" on %I', reg.tabla);
    execute format('drop policy if exists "%s_staff_select" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_select" on %I for select to authenticated using (not auth_es_hermano())',
      reg.tabla, reg.tabla
    );
    execute format('drop policy if exists "%s_staff_insert" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_insert" on %I for insert to authenticated with check (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_update" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_update" on %I for update to authenticated using (not auth_es_hermano() and modulo_permitido(%L)) with check (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_delete" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_delete" on %I for delete to authenticated using (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
  end loop;
end $$;

-- Tablas con un dato sensible propio (contraseñas en claro): también se
-- restringe la LECTURA al módulo correspondiente, no solo la escritura.
do $$
declare
  reg record;
begin
  for reg in
    select * from (values
      ('personal', 'personal'),
      ('solicitudes_alta', 'hermanos')
    ) as t(tabla, modulo)
  loop
    execute format('drop policy if exists "authenticated_all" on %I', reg.tabla);
    execute format('drop policy if exists "%s_staff_select" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_select" on %I for select to authenticated using (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_insert" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_insert" on %I for insert to authenticated with check (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_update" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_update" on %I for update to authenticated using (not auth_es_hermano() and modulo_permitido(%L)) with check (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_delete" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_delete" on %I for delete to authenticated using (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
  end loop;
end $$;

-- La tabla de solicitudes de alta también debe poder rellenarse desde el área
-- del hermano SIN sesión iniciada (todavía no es hermano/a): se permite
-- insertar de forma anónima, pero no leer ni modificar sin sesión.
drop policy if exists "anon_insert_solicitudes" on solicitudes_alta;
create policy "anon_insert_solicitudes" on solicitudes_alta for insert to anon with check (true);

-- Hermanos: el personal ve a todos (según su módulo puede además crear,
-- editar o borrar); cada hermano solo ve y edita su propia ficha.
drop policy if exists "authenticated_all" on hermanos;
drop policy if exists "hermanos_personal_all" on hermanos;
drop policy if exists "hermanos_staff_select" on hermanos;
create policy "hermanos_staff_select" on hermanos for select to authenticated
  using (not auth_es_hermano());
drop policy if exists "hermanos_staff_insert" on hermanos;
create policy "hermanos_staff_insert" on hermanos for insert to authenticated
  with check (not auth_es_hermano() and modulo_permitido('hermanos'));
drop policy if exists "hermanos_staff_update" on hermanos;
create policy "hermanos_staff_update" on hermanos for update to authenticated
  using (not auth_es_hermano() and modulo_permitido('hermanos'))
  with check (not auth_es_hermano() and modulo_permitido('hermanos'));
drop policy if exists "hermanos_staff_delete" on hermanos;
create policy "hermanos_staff_delete" on hermanos for delete to authenticated
  using (not auth_es_hermano() and modulo_permitido('hermanos'));

-- Cuotas: el personal ve todas (el módulo "cuotas" hace falta para
-- crear/editar/borrar); cada hermano solo ve las suyas.
drop policy if exists "authenticated_all" on cuotas;
drop policy if exists "cuotas_personal_all" on cuotas;
drop policy if exists "cuotas_staff_select" on cuotas;
create policy "cuotas_staff_select" on cuotas for select to authenticated
  using (not auth_es_hermano());
drop policy if exists "cuotas_staff_insert" on cuotas;
create policy "cuotas_staff_insert" on cuotas for insert to authenticated
  with check (not auth_es_hermano() and modulo_permitido('cuotas'));
drop policy if exists "cuotas_staff_update" on cuotas;
create policy "cuotas_staff_update" on cuotas for update to authenticated
  using (not auth_es_hermano() and modulo_permitido('cuotas'))
  with check (not auth_es_hermano() and modulo_permitido('cuotas'));
drop policy if exists "cuotas_staff_delete" on cuotas;
create policy "cuotas_staff_delete" on cuotas for delete to authenticated
  using (not auth_es_hermano() and modulo_permitido('cuotas'));

-- Papeletas: tanto Papeletas de sitio como Cortejo escriben en esta tabla
-- (asignar tramo, marcar pago, etc.), así que cualquiera de los dos módulos
-- vale para crear/editar/borrar. Cada hermano ve, solicita y renuncia solo a
-- las suyas (política ya creada en hermano-auth.sql, no se toca aquí).
drop policy if exists "authenticated_all" on papeletas;
drop policy if exists "papeletas_personal_all" on papeletas;
drop policy if exists "papeletas_staff_select" on papeletas;
create policy "papeletas_staff_select" on papeletas for select to authenticated
  using (not auth_es_hermano());
drop policy if exists "papeletas_staff_insert" on papeletas;
create policy "papeletas_staff_insert" on papeletas for insert to authenticated
  with check (not auth_es_hermano() and (modulo_permitido('papeletas') or modulo_permitido('cortejo')));
drop policy if exists "papeletas_staff_update" on papeletas;
create policy "papeletas_staff_update" on papeletas for update to authenticated
  using (not auth_es_hermano() and (modulo_permitido('papeletas') or modulo_permitido('cortejo')))
  with check (not auth_es_hermano() and (modulo_permitido('papeletas') or modulo_permitido('cortejo')));
drop policy if exists "papeletas_staff_delete" on papeletas;
create policy "papeletas_staff_delete" on papeletas for delete to authenticated
  using (not auth_es_hermano() and (modulo_permitido('papeletas') or modulo_permitido('cortejo')));


-- =============================================================================
--   BLOQUE 3 de 8  ·  rls-endurecer.sql
-- =============================================================================

-- ============================================================================
--  Endurecer la seguridad: quitar los dos «permitir por defecto»
-- ============================================================================
--  Seguro de ejecutar sobre una base ya en uso: crea una tabla, sustituye dos
--  funciones y no borra ni una fila. Ejecútalo DESPUÉS de schema.sql,
--  hermano-auth.sql y rls-cargos.sql.
--
--  Corrige dos agujeros que dejaban la base abierta:
--
--  1) `modulo_permitido()` decía «quien no está en la tabla personal es el
--     titular» y le daba TODO. Pero cualquiera que se registrara en /registro
--     creaba una cuenta `authenticated` sin fila en `personal`: con la clave
--     anónima (que va en el propio JavaScript de la web) podía leer y escribir
--     el censo entero, las cuotas, la tesorería y el personal.
--
--  2) `auth_es_hermano()` se fiaba de `user_metadata`, que el propio usuario
--     puede reescribir con `auth.updateUser({ data: { tipo: 'personal' } })`.
--     Un hermano con cuenta legítima se quitaba la etiqueta de hermano desde
--     la consola del navegador y pasaba a que le aplicaran las políticas de
--     personal.
--
--  Regla general: quién eres se saca de las TABLAS, nunca de lo que diga el
--  token que el usuario controla, y ante la duda NO se concede nada.
-- ============================================================================

-- Titulares de la hermandad: acceso sin restricción de módulo. Es explícito a
-- propósito; antes «titular» era simplemente «no aparece en personal».
create table if not exists titulares (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now()
);
alter table titulares enable row level security;

-- Solo se puede consultar a través de las funciones security definer de abajo;
-- nadie escribe aquí desde el cliente (se siembra con service_role al crear la
-- hermandad).
drop policy if exists titulares_nadie on titulares;
create policy titulares_nadie on titulares for all to authenticated using (false) with check (false);

-- ¿Es la sesión actual el titular? Por tabla, no por ausencia de datos.
create or replace function es_titular() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (select 1 from titulares where auth_user_id = auth.uid())
  $$;
grant execute on function es_titular() to authenticated;

-- ¿Puede el personal actual ESCRIBIR en este módulo?
-- Falla CERRADO: una cuenta que no es titular ni personal activo no puede nada.
create or replace function modulo_permitido(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select
      es_titular()
      or exists (
        select 1 from personal p
        join permisos_cargo pc on pc.cargo = p.cargo
        where p.auth_user_id = auth.uid() and p.activo and pc.modulo_id = p_modulo
      )
  $$;
grant execute on function modulo_permitido(text) to authenticated;

-- ¿Es una sesión de hermano? Por la tabla `hermanos`, no por el metadata.
create or replace function auth_es_hermano() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (select 1 from hermanos where auth_user_id = auth.uid())
  $$;
grant execute on function auth_es_hermano() to anon, authenticated;

-- Y el personal, por la tabla `personal`.
create or replace function auth_es_personal() returns boolean
  language sql stable security definer set search_path = public as $$
    select es_titular() or exists (
      select 1 from personal where auth_user_id = auth.uid() and activo
    )
  $$;
grant execute on function auth_es_personal() to authenticated;

-- ============================================================================
--  >>> PASO-TITULAR <<<  —  YA NO HACE FALTA HACER NADA AQUÍ
--
--  Aquí antes había que dar de alta al titular a mano, copiando de Supabase el
--  identificador de la cuenta y escribiendo un `insert`. Era fácil equivocarse
--  (pegar el nombre de usuario en vez del identificador, por ejemplo) y
--  mientras tanto no se podía entrar al panel.
--
--  El bloque 8 trae `crear_hermandad()`, y la aplicación la llama la primera
--  vez que entras: te crea tu hermandad, te deja como titular y prepara su
--  ficha de ajustes, todo de una vez. No hay nada que copiar.
--
--  Si te registras y no ves nada, no es esto: mira que hayas ejecutado el
--  archivo ENTERO, hasta el bloque 8.
-- ============================================================================


-- =============================================================================
--   BLOQUE 4 de 8  ·  hermano-auth.sql
-- =============================================================================

-- Login real del hermano con Supabase Auth + RLS por hermano/personal.
-- Seguro de ejecutar sobre una base de datos ya en uso: no borra tablas ni
-- filas, solo añade una columna, cambia funciones/políticas y crea un RPC.
-- Ejecuta esto una vez en el SQL Editor de tu proyecto, después de
-- schema.sql (o de una base ya creada con una versión anterior de schema.sql).

alter table hermanos add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists hermanos_auth_user_id_idx on hermanos(auth_user_id) where auth_user_id is not null;

-- ATENCIÓN: esta versión se fía de `user_metadata`, que el propio usuario
-- puede reescribir con `auth.updateUser`. La sustituye `rls-endurecer.sql`
-- (mira la tabla `hermanos`), que hay que ejecutar después.
--
-- Distingue una sesión de hermano de una de personal: se marca en el
-- user_metadata al crear la cuenta (ver signUp en la app).
create or replace function auth_es_hermano() returns boolean
  language sql stable as $$
    select coalesce((auth.jwt() -> 'user_metadata' ->> 'tipo') = 'hermano', false)
  $$;
grant execute on function auth_es_hermano() to anon, authenticated;

-- Id de hermano correspondiente a la sesión activa (null si no es un hermano
-- o no tiene cuenta vinculada todavía).
create or replace function hermano_propio_id() returns uuid
  language sql stable as $$
    select id from hermanos where auth_user_id = auth.uid()
  $$;
grant execute on function hermano_propio_id() to authenticated;

-- Resuelve el correo de un hermano a partir de su DNI, para poder iniciar
-- sesión con Supabase Auth (que pide correo) desde un formulario de DNI +
-- contraseña. No expone nada más: ni la contraseña ni el resto de la ficha.
create or replace function resolver_email_hermano(p_dni text) returns text
  language sql stable security definer set search_path = public as $$
    select email from hermanos where upper(dni) = upper(p_dni) limit 1
  $$;
grant execute on function resolver_email_hermano(text) to anon, authenticated;

-- Tablas de gestión: se quita el acceso a sesiones de hermano (antes
-- cualquier persona autenticada, incluido un futuro hermano con cuenta real,
-- podía leer y escribir en todas ellas).
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'hermandad_settings', 'tramos', 'movimientos',
      'incidencias', 'enseres', 'documentos', 'comunicados',
      'cuentas_sociales', 'personal', 'permisos_cargo',
      'solicitudes_alta', 'conceptos_cuota', 'opciones_papeleta', 'catalogos'
    ])
  loop
    execute format('drop policy if exists "authenticated_all" on %I', t);
    execute format(
      'create policy "authenticated_all" on %I for all to authenticated using (not auth_es_hermano()) with check (not auth_es_hermano())',
      t
    );
  end loop;
end $$;

-- Hermanos: el personal ve y gestiona a todos; cada hermano solo ve y edita
-- su propia ficha (no puede darse de alta ni borrarse a sí mismo).
drop policy if exists "authenticated_all" on hermanos;
drop policy if exists "hermanos_personal_all" on hermanos;
create policy "hermanos_personal_all" on hermanos for all to authenticated
  using (not auth_es_hermano()) with check (not auth_es_hermano());
drop policy if exists "hermanos_propio_select" on hermanos;
create policy "hermanos_propio_select" on hermanos for select to authenticated
  using (auth_es_hermano() and auth_user_id = auth.uid());
drop policy if exists "hermanos_propio_update" on hermanos;
create policy "hermanos_propio_update" on hermanos for update to authenticated
  using (auth_es_hermano() and auth_user_id = auth.uid())
  with check (auth_es_hermano() and auth_user_id = auth.uid());

-- Cuotas: el personal gestiona todas; cada hermano solo ve las suyas.
drop policy if exists "authenticated_all" on cuotas;
drop policy if exists "cuotas_personal_all" on cuotas;
create policy "cuotas_personal_all" on cuotas for all to authenticated
  using (not auth_es_hermano()) with check (not auth_es_hermano());
drop policy if exists "cuotas_propio_select" on cuotas;
create policy "cuotas_propio_select" on cuotas for select to authenticated
  using (auth_es_hermano() and hermano_id = hermano_propio_id());

-- Papeletas: el personal gestiona todas; cada hermano ve, solicita y
-- renuncia solo a las suyas.
drop policy if exists "authenticated_all" on papeletas;
drop policy if exists "papeletas_personal_all" on papeletas;
create policy "papeletas_personal_all" on papeletas for all to authenticated
  using (not auth_es_hermano()) with check (not auth_es_hermano());
drop policy if exists "papeletas_propio_select" on papeletas;
create policy "papeletas_propio_select" on papeletas for select to authenticated
  using (auth_es_hermano() and hermano_id = hermano_propio_id());
drop policy if exists "papeletas_propio_insert" on papeletas;
create policy "papeletas_propio_insert" on papeletas for insert to authenticated
  with check (auth_es_hermano() and hermano_id = hermano_propio_id());
drop policy if exists "papeletas_propio_update" on papeletas;
create policy "papeletas_propio_update" on papeletas for update to authenticated
  using (auth_es_hermano() and hermano_id = hermano_propio_id())
  with check (auth_es_hermano() and hermano_id = hermano_propio_id());

-- Nota: los hermanos que ya tuvieras en la tabla ANTES de ejecutar esto no
-- tienen auth_user_id ni cuenta real todavía, así que no podrán entrar hasta
-- que se les cree una cuenta. Para los que se den de alta o apruebes a
-- partir de ahora, la app ya lo hace sola. Para los que ya estaban, puedes
-- editarlos y guardarlos de nuevo desde Hermanos, o pedirles que soliciten
-- el alta otra vez con su DNI (verá que ya existe y te lo indicará; en ese
-- caso, bórralos primero desde Hermanos y que vuelvan a solicitarla).
--
-- Recomendación: en tu proyecto de Supabase, ve a Authentication → Sign In /
-- Providers → Email y desactiva "Confirm email". Sin esto, cada hermano
-- nuevo se queda sin poder entrar hasta confirmar un correo que hoy no se
-- envía (falta configurar un SMTP propio, pendiente en el plan de mejoras).


-- =============================================================================
--   BLOQUE 5 de 8  ·  web-publica.sql
-- =============================================================================

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


-- =============================================================================
--   BLOQUE 6 de 8  ·  mensajes-web.sql
-- =============================================================================

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


-- =============================================================================
--   BLOQUE 7 de 8  ·  storage-archivo.sql
-- =============================================================================

-- Bucket de Supabase Storage para los adjuntos del Archivo documental
-- (actas, contratos, expedientes...). Ejecuta esto una vez en el SQL Editor
-- de tu proyecto, después de schema.sql.

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Cualquier persona con sesión iniciada (personal de la hermandad) puede
-- subir, ver, actualizar y borrar adjuntos. Igual que el resto de tablas de
-- la app: la app ya filtra por cargo antes de dejar llegar aquí.
drop policy if exists "documentos_authenticated_all" on storage.objects;
create policy "documentos_authenticated_all" on storage.objects
  for all
  to authenticated
  using (bucket_id = 'documentos')
  with check (bucket_id = 'documentos');


-- =============================================================================
--
--   FIN. Si ha salido "Success" sin errores, la base de datos está lista.
--
-- =============================================================================
--
-- LO SIGUIENTE:
--
--   1. Project Settings → API → copia "Project URL" y "anon public"
--   2. Pégalas en el archivo .env del proyecto:
--
--        VITE_SUPABASE_URL=https://xxxxx.supabase.co
--        VITE_SUPABASE_ANON_KEY=eyJhbGci...
--
--   3. npm run dev
--   4. Regístrate en la aplicación con tu correo. Al entrar por primera vez
--      se crea tu hermandad sola y quedas como titular.
--   5. En la app: Configuración → Puesta en marcha.
--      El aviso "Los datos solo están en este navegador" debe haber
--      desaparecido.
--
-- 🚫 La clave "service_role" NO se usa nunca en esta aplicación.
--
-- =============================================================================



-- =============================================================================
--   BLOQUE 8 de 8  ·  multi-hermandad.sql
--
--   El que hace que en esta base de datos quepan TODAS las hermandades sin que
--   ninguna vea nada de las demás. Va el último porque cambia cosas que los
--   bloques anteriores acaban de crear.
-- =============================================================================

-- =============================================================================
--
--   CABILDO — UN SOLO SUPABASE PARA TODAS LAS HERMANDADES
--
-- =============================================================================
--
-- Hasta ahora: un proyecto de Supabase por hermandad. Ninguna tabla sabía de
-- quién era cada fila, porque no hacía falta: todo lo que había dentro era de
-- la única hermandad del proyecto.
--
-- A partir de aquí, todas caben en el mismo proyecto y **ninguna ve nada de
-- las demás**. Con datos de un censo de hermandad —que revelan convicciones
-- religiosas, categoría especial del RGPD— eso no es un detalle: es la
-- diferencia entre poder venderlo y no poder.
--
-- CÓMO FUNCIONA, EN CORTO:
--
--   · Cada tabla lleva `hermandad_id`.
--   · `hermandad_actual()` dice a qué hermandad pertenece quien está pidiendo
--     los datos, mirando su cuenta (titular, personal o hermano).
--   · Las políticas dejan ver y tocar SOLO las filas de esa hermandad.
--   · El `hermandad_id` se rellena SOLO al insertar (valor por defecto), así
--     que la aplicación no tiene que acordarse de ponerlo en cada llamada.
--     Eso es lo que impide el fallo clásico: olvidarlo una vez y filtrar.
--
-- ORDEN: ejecutar DESPUÉS de TODO-EN-UNO.sql.
-- Es seguro volver a ejecutarlo.
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. LAS HERMANDADES
-- -----------------------------------------------------------------------------

create table if not exists hermandades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  -- `activa` en falso la retira de la lista donde un hermano elige su
  -- hermandad para entrar, sin borrar nada. Es lo que hace falta cuando una
  -- deja el servicio: sus datos siguen ahí mientras se los descarga.
  activa boolean not null default true,
  creada_en timestamptz not null default now()
);
-- La dirección de su web pública NO va aquí: vive en `web_publica.slug`, que
-- es donde la edita quien la lleva. Tenerla en dos sitios acaba en dos slugs
-- distintos y en una web que no abre.
alter table hermandades drop column if exists slug;
alter table hermandades enable row level security;


-- -----------------------------------------------------------------------------
-- 2. QUIÉN PERTENECE A QUÉ HERMANDAD
-- -----------------------------------------------------------------------------
-- Hay tres formas de pertenecer a una hermandad: llevarla (`titulares`),
-- trabajar en ella (`personal`) o ser hermano (`hermanos`). Las tres tablas
-- ganan `hermandad_id` aquí, antes que nada, porque `hermandad_actual()` —que
-- viene justo después— las consulta para saber de quién es cada petición.
--
-- Un mismo correo NO puede ser titular de dos hermandades: si alguien lleva
-- dos, usa dos cuentas. Es más simple de entender y de auditar, que es lo que
-- importa aquí.

alter table titulares add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table personal  add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table hermanos  add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;


-- El correo del personal era único en TODA la tabla: con varias hermandades,
-- dos pueden tener un tesorero llamado igual. Pasa a ser único por hermandad.
alter table personal drop constraint if exists personal_email_key;
create unique index if not exists personal_email_por_hermandad on personal (hermandad_id, email);

-- `hermandad_actual()` consulta estas tres columnas en CADA petición que llega.
-- `titulares` y `hermanos` ya venían indexadas; `personal` no, y sin esto cada
-- consulta de un miembro del personal recorría la tabla entera.
create index if not exists personal_auth_user_id_idx on personal (auth_user_id);


-- -----------------------------------------------------------------------------
-- 3. `hermandad_actual()` — LA PIEZA CENTRAL
-- -----------------------------------------------------------------------------
-- Devuelve la hermandad de quien está haciendo la petición, mirando su cuenta.
-- Es SECURITY DEFINER porque tiene que consultar tablas que están protegidas
-- justamente por ella: sin eso, la comprobación se muerde la cola.
--
-- Si la cuenta no pertenece a ninguna hermandad, devuelve NULL, y entonces
-- ninguna política deja pasar nada. Cerrado por defecto, que es como tiene que
-- estar: un fallo aquí no puede acabar en «lo ve todo».

create or replace function hermandad_actual() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select t.hermandad_id from titulares t where t.auth_user_id = auth.uid()),
    (select p.hermandad_id from personal  p where p.auth_user_id = auth.uid() and p.activo),
    (select h.hermandad_id from hermanos  h where h.auth_user_id = auth.uid())
  )
$$;
grant execute on function hermandad_actual() to authenticated, anon;


-- -----------------------------------------------------------------------------
-- 4. `hermandad_id` EN TODAS LAS TABLAS DE DATOS
-- -----------------------------------------------------------------------------
-- Con valor por defecto `hermandad_actual()`: la aplicación inserta como
-- siempre y la columna se rellena sola. Es lo que evita el fallo de olvidarse
-- de ponerlo en una llamada de cincuenta y filtrar datos sin enterarse.

do $$
declare t text;
begin
  foreach t in array array[
    'hermanos', 'tramos', 'cuotas', 'papeletas', 'movimientos', 'incidencias',
    'enseres', 'documentos', 'comunicados', 'cuentas_sociales', 'permisos_cargo',
    'solicitudes_alta', 'conceptos_cuota', 'opciones_papeleta', 'catalogos',
    'eventos',
    -- `personal` también: sin valor por defecto, cuando un titular da de alta
    -- a su tesorero la fila entra sin hermandad y la frontera la rechaza. O
    -- sea, no podría añadir a nadie a su junta.
    'personal'
  ]
  loop
    execute format(
      'alter table %I add column if not exists hermandad_id uuid references hermandades(id) on delete cascade',
      t
    );
    execute format('alter table %I alter column hermandad_id set default hermandad_actual()', t);
    execute format('create index if not exists %I on %I (hermandad_id)', t || '_hermandad_idx', t);
  end loop;
end $$;

-- El DNI del hermano era único en toda la tabla. Con varias hermandades, la
-- misma persona puede ser hermana de dos: pasa a ser único POR hermandad.
alter table hermanos drop constraint if exists hermanos_dni_key;
create unique index if not exists hermanos_dni_por_hermandad on hermanos (hermandad_id, dni);

-- Lo mismo con el número de hermano: cada hermandad tiene su nº 1.
drop index if exists hermanos_numero_activo_uniq;
create unique index if not exists hermanos_numero_por_hermandad
  on hermanos (hermandad_id, numero) where numero > 0;


-- -----------------------------------------------------------------------------
-- 5. LOS AJUSTES Y LA WEB, UNA FILA POR HERMANDAD
-- -----------------------------------------------------------------------------
-- Las dos estaban forzadas a UNA sola fila: `id` era la clave primaria con
-- valor fijo 1 (y `hermandad_settings` además lo comprobaba). Con varias
-- hermandades hacen falta varias filas, así que `id` deja de valer siempre 1 y
-- pasa a contar solo (1, 2, 3...). Quien manda ahora es `hermandad_id`, con un
-- índice único: **una fila de ajustes y una web por hermandad, ni más ni una
-- menos**. La fila que ya existiera se queda con su id 1 y no se toca.

create sequence if not exists hermandad_settings_id_seq as smallint owned by hermandad_settings.id;
alter table hermandad_settings add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table hermandad_settings alter column hermandad_id set default hermandad_actual();
alter table hermandad_settings drop constraint if exists hermandad_settings_id_check;
alter table hermandad_settings alter column id set default nextval('hermandad_settings_id_seq');
create unique index if not exists hermandad_settings_por_hermandad on hermandad_settings (hermandad_id);

create sequence if not exists web_publica_id_seq as integer owned by web_publica.id;
alter table web_publica add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table web_publica alter column hermandad_id set default hermandad_actual();
alter table web_publica alter column id set default nextval('web_publica_id_seq');
create unique index if not exists web_publica_por_hermandad on web_publica (hermandad_id);

-- Si ya había filas de antes (la hermandad única del proyecto viejo), el
-- contador tiene que arrancar por encima de ellas o el siguiente insert choca.
do $$
begin
  perform setval('hermandad_settings_id_seq', greatest(coalesce((select max(id) from hermandad_settings), 0), 1));
  perform setval('web_publica_id_seq',        greatest(coalesce((select max(id) from web_publica), 0), 1));
end $$;

alter table mensajes_web add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
create index if not exists mensajes_web_hermandad_idx on mensajes_web (hermandad_id);


-- -----------------------------------------------------------------------------
-- 6. LA FRONTERA ENTRE HERMANDADES
-- -----------------------------------------------------------------------------
-- Aquí está TODO el aislamiento, y está en un solo sitio a propósito.
--
-- El esquema base ya trae sus políticas y son buenas: dicen quién puede tocar
-- qué según su cargo (`modulo_permitido`) y qué puede ver un hermano de lo
-- suyo. Lo único que no sabían es que ahora hay más de una hermandad.
--
-- La tentación es añadir otra política que diga «y además, de tu hermandad».
-- **No funcionaría, y es el error clásico**: las políticas normales de
-- Postgres (PERMISSIVE) se suman con O. Añadir una nunca quita permisos; solo
-- abre otra puerta. Con una política de más, cualquiera seguiría viéndolo todo.
--
-- Lo que sí funciona es una política RESTRICTIVE: esas se suman con Y. Se
-- aplican SIEMPRE, encima de todas las demás, y ninguna política nueva —ni una
-- que se añada dentro de un año sin acordarse de esto— puede saltársela.
--
-- Queda así, y es fácil de auditar:
--
--   · Las políticas del esquema base dicen QUÉ CLASE de acceso tiene cada uno.
--   · `solo_mi_hermandad` dice DE QUIÉN son las filas. Una por tabla.
--
-- Si `hermandad_actual()` devuelve NULL —una cuenta recién registrada que
-- todavía no tiene hermandad—, la comparación no es cierta y no pasa nada.
-- Cerrado por defecto.

do $$
declare t text;
begin
  foreach t in array array[
    'hermanos', 'tramos', 'cuotas', 'papeletas', 'movimientos', 'incidencias',
    'enseres', 'documentos', 'comunicados', 'cuentas_sociales', 'permisos_cargo',
    'conceptos_cuota', 'opciones_papeleta', 'catalogos', 'eventos',
    'hermandad_settings', 'personal', 'titulares'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "solo_mi_hermandad" on %I', t);
    execute format(
      'create policy "solo_mi_hermandad" on %I as restrictive for all to public
         using (hermandad_id = hermandad_actual())
         with check (hermandad_id = hermandad_actual())',
      t
    );
  end loop;
end $$;

-- La tabla de hermandades: cada cual, la suya. La lista completa no la ve
-- nadie desde el navegador; saber qué hermandades hay dadas de alta no es
-- asunto de sus hermanos.
alter table hermandades enable row level security;
drop policy if exists "solo_mi_hermandad" on hermandades;
create policy "solo_mi_hermandad" on hermandades as restrictive for all to public
  using (id = hermandad_actual()) with check (id = hermandad_actual());
drop policy if exists "mi_hermandad_select" on hermandades;
create policy "mi_hermandad_select" on hermandades for select to authenticated
  using (id = hermandad_actual());

-- --- Las tres tablas que tienen trato con la calle -------------------------
-- Estas no pueden llevar la regla tal cual, porque parte de su sentido es que
-- alguien SIN sesión las use. Se les pone la misma frontera, pero abriendo lo
-- justo por donde tiene que entrar el visitante.

-- La web publicada la lee cualquiera: para eso está publicada. Lo demás
-- (crearla, editarla, borrarla) solo su hermandad.
drop policy if exists "solo_mi_hermandad" on web_publica;
create policy "solo_mi_hermandad" on web_publica as restrictive for select to public
  using (publicada = true or hermandad_id = hermandad_actual());
drop policy if exists "solo_mi_hermandad_cambios" on web_publica;
create policy "solo_mi_hermandad_cambios" on web_publica as restrictive for update to public
  using (hermandad_id = hermandad_actual()) with check (hermandad_id = hermandad_actual());
drop policy if exists "solo_mi_hermandad_borrado" on web_publica;
create policy "solo_mi_hermandad_borrado" on web_publica as restrictive for delete to public
  using (hermandad_id = hermandad_actual());
drop policy if exists "solo_mi_hermandad_alta" on web_publica;
create policy "solo_mi_hermandad_alta" on web_publica as restrictive for insert to public
  with check (hermandad_id = hermandad_actual());
drop policy if exists "el personal edita la web" on web_publica;
create policy "el personal edita la web" on web_publica for all to authenticated
  using (not auth_es_hermano()) with check (not auth_es_hermano());

-- El buzón de los formularios y las solicitudes de alta: el visitante DEJA
-- algo desde la web pública sin haber iniciado sesión, así que al entrar solo
-- se le exige decir de qué hermandad es. Leerlo, esa hermandad y nadie más.
do $$
declare t text;
begin
  foreach t in array array['mensajes_web', 'solicitudes_alta']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "solo_mi_hermandad" on %I', t);
    execute format('create policy "solo_mi_hermandad" on %I as restrictive for select to public
        using (hermandad_id = hermandad_actual())', t);
    execute format('drop policy if exists "solo_mi_hermandad_cambios" on %I', t);
    execute format('create policy "solo_mi_hermandad_cambios" on %I as restrictive for update to public
        using (hermandad_id = hermandad_actual()) with check (hermandad_id = hermandad_actual())', t);
    execute format('drop policy if exists "solo_mi_hermandad_borrado" on %I', t);
    execute format('create policy "solo_mi_hermandad_borrado" on %I as restrictive for delete to public
        using (hermandad_id = hermandad_actual())', t);
    -- Al entrar: hay que decir de quién es. Sin esto, un formulario público
    -- dejaría filas huérfanas que no vería ni gestionaría nunca nadie.
    execute format('drop policy if exists "con_hermandad_al_entrar" on %I', t);
    execute format('create policy "con_hermandad_al_entrar" on %I as restrictive for insert to public
        with check (hermandad_id is not null)', t);
  end loop;
end $$;

drop policy if exists "el visitante deja mensajes" on mensajes_web;
create policy "el visitante deja mensajes" on mensajes_web for insert to anon, authenticated
  with check (true);
drop policy if exists "alta anonima" on solicitudes_alta;
create policy "alta anonima" on solicitudes_alta for insert to anon, authenticated
  with check (true);


-- -----------------------------------------------------------------------------
-- 7. LO QUE UN HERMANO NECESITA DE LO COMÚN
-- -----------------------------------------------------------------------------
-- El esquema base ya le da su ficha, sus cuotas y sus papeletas. Le faltaban
-- dos cosas que no son de nadie en particular y sin las cuales su área se ve a
-- medias: los tramos (para saber dónde va en el cortejo) y los eventos (su
-- calendario). No son datos personales de otros hermanos.
--
-- Ojo: aquí NO hace falta repetir «y de mi hermandad». De eso ya se encarga
-- `solo_mi_hermandad`, y ponerlo en dos sitios haría creer que la frontera
-- vive en las políticas normales, que es justo lo que no queremos.

drop policy if exists "tramos_hermano_select" on tramos;
create policy "tramos_hermano_select" on tramos for select to authenticated
  using (auth_es_hermano());
drop policy if exists "eventos_hermano_select" on eventos;
create policy "eventos_hermano_select" on eventos for select to authenticated
  using (auth_es_hermano());

-- Restos de una versión anterior de este archivo, por si se ejecutó: repetían
-- lo que ya hace el esquema base y confunden al leer las políticas.
do $$
declare t text;
begin
  foreach t in array array[
    'hermanos', 'tramos', 'cuotas', 'papeletas', 'movimientos', 'incidencias',
    'enseres', 'documentos', 'comunicados', 'cuentas_sociales', 'permisos_cargo',
    'solicitudes_alta', 'conceptos_cuota', 'opciones_papeleta', 'catalogos',
    'eventos', 'hermandad_settings'
  ]
  loop
    execute format('drop policy if exists "mi_hermandad" on %I', t);
  end loop;
end $$;
drop policy if exists "cuotas_propias" on cuotas;
drop policy if exists "papeletas_propias" on papeletas;
drop policy if exists "personal_mi_hermandad" on personal;
drop policy if exists "titulares_propio" on titulares;


-- -----------------------------------------------------------------------------
-- 8. LOS ARCHIVOS ADJUNTOS
-- -----------------------------------------------------------------------------
-- Esto no está en `public` y es fácil que se quede fuera, pero es donde viven
-- las actas, los contratos y los expedientes. La política que había decía
-- «cualquiera con sesión puede con el cubo `documentos`»: con una sola
-- hermandad no pasaba nada, con todas juntas significa que el tesorero de una
-- se descarga las actas de las demás.
--
-- El aislamiento aquí va por la ruta del archivo: **todo se guarda dentro de
-- una carpeta que se llama como el id de la hermandad**.
--
--   documentos/6f3a…-e21b/acta-cabildo-2026.pdf
--   └ cubo    └ hermandad             └ el archivo
--
-- Se usa `split_part` en vez de `storage.foldername()` a propósito: hace lo
-- mismo y no depende de una función de Supabase, así que esto también se puede
-- probar en un Postgres normal (que es como se ha comprobado).

insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
  on conflict (id) do nothing;

drop policy if exists "documentos_authenticated_all" on storage.objects;
drop policy if exists "documentos_mi_hermandad" on storage.objects;
create policy "documentos_mi_hermandad" on storage.objects for all to authenticated
  using (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) = hermandad_actual()::text
    and not auth_es_hermano()
  )
  with check (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) = hermandad_actual()::text
    and not auth_es_hermano()
  );


-- -----------------------------------------------------------------------------
-- 9. CREAR UNA HERMANDAD
-- -----------------------------------------------------------------------------
-- Quien se registra crea la suya y queda como titular, en una sola operación.
-- Va como función para que no se pueda hacer a medias: sin esto, alguien
-- podría crear la hermandad y no quedar como titular, y ya no podría entrar en
-- ella ni él ni nadie.

create or replace function crear_hermandad(p_nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare nueva uuid;
begin
  if auth.uid() is null then
    raise exception 'Hay que haber iniciado sesión para crear una hermandad.';
  end if;
  -- Una cuenta, una hermandad. Si ya pertenece a alguna —como titular, como
  -- personal o como hermana— se le devuelve esa en vez de crearle otra.
  --
  -- Mirar solo `titulares` aquí sería un fallo gordo: la aplicación llama a
  -- esto al iniciar sesión para que la hermandad exista, y un tesorero (que
  -- está en `personal`, no en `titulares`) se habría creado una hermandad
  -- nueva y vacía cada vez que entra, quedándose fuera de la suya.
  nueva := hermandad_actual();
  if nueva is not null then
    return nueva;
  end if;

  insert into hermandades (nombre) values (coalesce(nullif(trim(p_nombre), ''), 'Mi hermandad'))
    returning id into nueva;
  insert into titulares (auth_user_id, hermandad_id) values (auth.uid(), nueva);
  -- Los ajustes, ya creados: si no, la aplicación arranca sin fila y el primer
  -- guardado tiene que adivinar si insertar o actualizar.
  insert into hermandad_settings (hermandad_id, nombre_legal) values (nueva, p_nombre);
  return nueva;
end $$;
grant execute on function crear_hermandad(text) to authenticated;


-- -----------------------------------------------------------------------------
-- 10. EL LOGIN DEL HERMANO, DENTRO DE SU HERMANDAD
-- -----------------------------------------------------------------------------
-- El DNI ya no es único en toda la tabla, así que resolver el correo solo con
-- el DNI podría devolver el de otra persona de otra hermandad. Ahora hay que
-- decir en qué hermandad se busca — que es lo que el área del hermano ya
-- pregunta antes de pedir el DNI.

drop function if exists resolver_email_hermano(text);
create or replace function resolver_email_hermano(p_hermandad_id uuid, p_dni text) returns text
language sql stable security definer set search_path = public as $$
  select email from hermanos
  where hermandad_id = p_hermandad_id
    and upper(replace(replace(dni, ' ', ''), '-', '')) = upper(replace(replace(p_dni, ' ', ''), '-', ''))
    and estado <> 'Baja'
    and email <> ''
  limit 1
$$;
grant execute on function resolver_email_hermano(uuid, text) to anon, authenticated;

-- Los pocos datos de la hermandad que la web pública enseña de verdad, para
-- que el servidor pueda escribir la ficha de la página (la que lee WhatsApp o
-- Google al compartir el enlace) sin sesión de nadie.
--
-- Se devuelven UNO A UNO los campos que ya salen impresos en esa página: el
-- nombre, la dirección, el teléfono y el correo de contacto, el logo. Lo que
-- NO sale nunca es el IBAN, el CIF ni el identificador de acreedor, que están
-- en la misma tabla y no pintan nada en una web pública. Por eso esto no
-- devuelve la fila entera: si mañana se añade una columna con algo delicado,
-- no se cuela sola por aquí.
--
-- Solo responde si la web está publicada: una hermandad que está preparando
-- la suya no tiene por qué aparecer todavía.
create or replace function hermandad_de_la_web(p_slug text)
returns table (
  nombre_legal text, direccion text, codigo_postal text, ciudad text,
  provincia text, telefono text, email text, logo_data_url text
)
language sql stable security definer set search_path = public as $$
  select s.nombre_legal, s.direccion, s.codigo_postal, s.ciudad,
         s.provincia, s.telefono, s.email, s.logo_data_url
  from web_publica w
  join hermandad_settings s on s.hermandad_id = w.hermandad_id
  where w.slug = p_slug and w.publicada
  limit 1
$$;
grant execute on function hermandad_de_la_web(text) to anon, authenticated;

-- Para que el área del hermano pueda ofrecer «elige tu hermandad» antes de
-- pedir el DNI. Solo el nombre y el id: nada de datos de nadie.
create or replace function hermandades_publicas() returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select id, nombre from hermandades where activa order by nombre
$$;
grant execute on function hermandades_publicas() to anon, authenticated;


-- =============================================================================
--   FIN
-- =============================================================================
--
-- COMPROBACIÓN RÁPIDA (opcional): esto tiene que devolver 0 filas. Si devuelve
-- alguna, es una tabla de datos a la que se le olvidó el hermandad_id.
--
--   select table_name from information_schema.tables t
--   where table_schema = 'public'
--     and table_name in ('hermanos','tramos','cuotas','papeletas','movimientos',
--                        'incidencias','enseres','documentos','comunicados',
--                        'cuentas_sociales','solicitudes_alta','conceptos_cuota',
--                        'opciones_papeleta','catalogos','eventos')
--     and not exists (select 1 from information_schema.columns c
--                     where c.table_name = t.table_name and c.column_name = 'hermandad_id');
--
-- =============================================================================

