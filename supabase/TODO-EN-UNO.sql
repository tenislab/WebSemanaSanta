-- =============================================================================
--
--   GOBERGO — TODO EL SQL, EN UN SOLO ARCHIVO
--
-- =============================================================================
--
--   GENERADO. No lo edites a mano: se sobrescribe.
--   Se toca el fichero suelto y se vuelve a generar con
--       node scripts/generar-todo-en-uno.mjs
--
-- -----------------------------------------------------------------------------
-- CÓMO SE USA
-- -----------------------------------------------------------------------------
--
--   1. Abre tu proyecto en supabase.com
--   2. Menú izquierdo → SQL Editor → New query
--   3. Copia ESTE ARCHIVO ENTERO, pégalo y dale a RUN
--
-- Tarda unos segundos. Es seguro volver a ejecutarlo: todo está escrito para
-- no romperse si ya existía.
--
-- -----------------------------------------------------------------------------
-- QUÉ CREA, POR ORDEN
-- -----------------------------------------------------------------------------
--
--    1. schema.sql                 Todas las tablas
--    2. rls-cargos.sql             Permisos por cargo de la junta
--    3. rls-endurecer.sql          EL IMPORTANTE: cierra la escritura a quien se registre
--    4. hermano-auth.sql           Acceso del hermano a su propia ficha
--    5. web-publica.sql            La web pública
--    6. mensajes-web.sql           Buzón de los formularios de la web
--    7. storage-archivo.sql        Adjuntos del archivo documental
--    8. add-provincia.sql          La provincia en la ficha de la hermandad
--    9. multi-hermandad.sql        TODAS las hermandades en una base, sin verse entre ellas
--   10. apuntes-automaticos.sql    Que los cobros lleguen solos a Tesorería
--   11. registro-actividad.sql     Quién hizo qué (RGPD, artículo 32)
--   12. remesas.sql                Que una remesa SEPA no se cobre dos veces
--   13. comunicados-segmento.sql   Guardar a quién iba dirigido un comunicado
--   14. acceso-hermano.sql         Cerrar el barrido de DNI en el acceso del hermano
--   15. area-hermano.sql           Que el área del hermano funcione de verdad
--   16. correo-hermandad.sql       Que la configuración de correo sea de la hermandad
--   17. hermano-y-gestion.sql      Ser hermano Y llevar la hermandad a la vez
--   18. permisos-por-hermandad.sql Que los permisos por cargo sean de cada hermandad
--   19. colores-hermandad.sql      Que el área del hermano lleve los colores de su hermandad
--   20. eventos-repeticion.sql     Que un culto que se repite siga repitiéndose
--   21. suscripcion.sql            Que la suscripción sea de la hermandad, no del navegador
--   22. plantillas-hermandad.sql   Que los modelos y la asistencia no se pierdan al cerrar sesión
--   23. ajustes-de-la-hermandad.sql Ajustes de cuotas y etiquetas: de la hermandad, no del navegador
--   24. hermano-con-cargo.sql      Una persona, una ficha: el cargo va en la ficha del hermano
--   25. seguridad-claves-y-registro.sql Fuera las contraseñas en claro; el registro lo escribe la base
--   26. papeletas-simbolica-y-precio.sql El precio de la papeleta y la simbólica: de la hermandad, no del navegador
--
-- -----------------------------------------------------------------------------
-- LO ÚNICO QUE HAY QUE LEER ANTES
-- -----------------------------------------------------------------------------
--
-- `rls-endurecer.sql` es el que impide que cualquiera que se registre en
-- /registro obtenga permiso de escritura sobre TODA la base de datos.
--
-- `multi-hermandad.sql` es el que hace que en esta misma base quepan TODAS
-- las hermandades sin que ninguna vea nada de las demás. Va después de las
-- tablas, porque separa lo que ellas han creado, y antes de todo lo que
-- necesita la columna `hermandad_id` que él añade.
--
-- NO HAY QUE DARSE DE ALTA A MANO COMO TITULAR. La primera vez que entras, la
-- aplicación crea tu hermandad y te deja como titular sola. Tú solo tienes que
-- registrarte con tu correo.
--
-- =============================================================================


-- =============================================================================
--   SCHEMA.SQL — Todas las tablas
-- =============================================================================

-- =============================================================================
-- Gobergo — esquema de base de datos (Supabase / Postgres)
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
-- El número de hermano es único... MIENTRAS HAYA UNA SOLA HERMANDAD.
--
-- Con varias, cada una tiene su nº 1, y el índice bueno es
-- (hermandad_id, numero): lo crea `multi-hermandad.sql`, que además borra este.
--
-- Por eso va dentro de una comprobación. `create unique index if not exists`
-- solo se salta la creación si ya existe un índice CON ESE NOMBRE, y en una
-- base que ya es multi-hermandad ese nombre no existe (lo borró
-- multi-hermandad). Así que al volver a ejecutar el SQL entero —cosa que se
-- supone que se puede hacer sin miedo— intentaba crearlo de nuevo y se
-- estrellaba con «Key (numero)=(1) is duplicated», que es justo lo NORMAL
-- cuando hay dos hermandades dentro.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hermanos' and column_name = 'hermandad_id'
  ) then
    create unique index if not exists hermanos_numero_activo_uniq on hermanos (numero) where numero > 0;
  end if;
end $$;

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
/*
 * La hora de citación del tramo — «a las 17:30 en la casa de hermandad».
 *
 * Va como `alter table` y no dentro del `create table` de arriba para las
 * bases que ya existen: el `create table if not exists` no toca una tabla que
 * ya está, así que a ellas la columna solo les llega por aquí.
 *
 * EL DESTROZO QUE ARREGLA: la aplicación llevaba escribiendo `hora_citacion`
 * en cada guardado de tramo, y la columna NO EXISTÍA en ninguna parte.
 * Postgres rechaza la sentencia entera cuando una columna no existe, así que
 * NINGÚN TRAMO SE GUARDABA NUNCA. Ni al crear ni al editar.
 *
 * Y no se veía: la pantalla pintaba el tramo recién creado —el estado de React
 * ya lo tenía— y solo al recargar aparecía Cortejo con «0/0 puestos cubiertos»
 * y «No hay tramos». Sin tramos no hay cortejo, y sin cortejo las papeletas no
 * se pueden asignar a ningún sitio: de un fallo de una palabra colgaba la
 * mitad de la Semana Santa de la hermandad.
 */
alter table tramos add column if not exists hora_citacion text;

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
-- Los permisos de fábrica YA NO SE SIEMBRAN AQUÍ.
--
-- Antes se metían sin dueño, con la clave (cargo, modulo_id). Eso hacía dos
-- destrozos: los permisos de una hermandad mandaban sobre las demás, y la
-- segunda que intentara guardar los suyos chocaba con esa clave.
--
-- Ahora los siembra `sembrar_permisos_de_fabrica()` para CADA hermandad al
-- crearla (ver permisos-por-hermandad.sql), que además es lo que permite que
-- cada una decida los suyos sin tocar los de nadie.

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
--   RLS-CARGOS.SQL — Permisos por cargo de la junta
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
--   RLS-ENDURECER.SQL — EL IMPORTANTE: cierra la escritura a quien se registre
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
--  Después de ejecutar esto, HAY QUE dar de alta al titular.
--
--  Se hace con esto, poniendo el correo con el que se registró y el nombre de
--  la hermandad:
--
--      select crear_hermandad_manual('titular@sudominio.es', 'Hdad. de Triana');
--
--  NO uses «insert into titulares (auth_user_id) values ('<uuid>')», que es lo
--  que ponía aquí antes. Esa fila entra SIN hermandad, y una fila de titular
--  sin hermandad hacía que al entrar se le metiera en la hermandad de otra
--  gente —la primera que hubiera en la tabla— con su censo delante. Con una
--  sola hermandad en la base no se notaba; con varias, es una fuga.
--
--  Sin este paso, ni siquiera el titular podrá escribir: es a propósito.
--  Vale más quedarse fuera un minuto que dejar la puerta abierta.
-- ============================================================================

-- =============================================================================
--   HERMANO-AUTH.SQL — Acceso del hermano a su propia ficha
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
--   WEB-PUBLICA.SQL — La web pública
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
--   MENSAJES-WEB.SQL — Buzón de los formularios de la web
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
--   STORAGE-ARCHIVO.SQL — Adjuntos del archivo documental
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
--   ADD-PROVINCIA.SQL — La provincia en la ficha de la hermandad
-- =============================================================================

-- Añade el campo Provincia a los datos de la hermandad, para el Estado de
-- Cuentas anual. Seguro de ejecutar sobre una base ya en uso.
alter table hermandad_settings add column if not exists provincia text not null default '';

-- =============================================================================
--   MULTI-HERMANDAD.SQL — TODAS las hermandades en una base, sin verse entre ellas
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

-- --- La mudanza desde el proyecto de UNA sola hermandad --------------------
-- Quien ya usaba Gobergo antes de esto tiene datos —hermanos, cuotas, recibos,
-- su web— guardados sin decir de quién son, porque entonces no hacía falta:
-- todo lo que había dentro era suyo. Al repartir por hermandades, esas filas
-- se quedan sin dueño, y una fila sin dueño no la ve nadie nunca más.
--
-- Esto se las asigna. Es seguro precisamente porque el proyecto de antes era
-- de una sola hermandad: no hay forma de que esas filas fueran de otra.
--
-- Solo toca lo que está sin asignar (`hermandad_id is null`). Lo que ya tiene
-- dueño no se mueve, así que llamarla dos veces no hace daño.
create or replace function adoptar_datos_sin_hermandad(p_hermandad_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  foreach t in array array[
    'hermanos', 'tramos', 'cuotas', 'papeletas', 'movimientos', 'incidencias',
    'enseres', 'documentos', 'comunicados', 'cuentas_sociales', 'permisos_cargo',
    'solicitudes_alta', 'conceptos_cuota', 'opciones_papeleta', 'catalogos',
    'eventos', 'personal', 'hermandad_settings', 'web_publica', 'mensajes_web'
  ]
  loop
    execute format('update %I set hermandad_id = $1 where hermandad_id is null', t)
      using p_hermandad_id;
  end loop;
end $$;

create or replace function crear_hermandad_base(p_nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nueva uuid;
  ya_era_titular boolean := false;
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

  -- ¿Venía del proyecto de UNA sola hermandad? Entonces ya tiene fila en
  -- `titulares` —la que había que escribir a mano— pero sin hermandad, porque
  -- entonces no hacía falta decir de cuál. Su caso no es «alta nueva», es
  -- «mudanza», y se trata distinto: hay datos suyos esperando.
  select true into ya_era_titular from titulares where auth_user_id = auth.uid();

  if ya_era_titular then
    -- Si un compañero de la misma junta ha entrado antes que él, la hermandad
    -- ya está creada y se une a ELLA. Sin esto, cada miembro de la junta se
    -- fabricaría una hermandad distinta al entrar y se perderían de vista unos
    -- a otros, cada uno con un trozo de lo que era una sola casa.
    --
    -- OJO CON EL `limit 1`: ese select no filtra por nada. Cuando la base
    -- tenía UNA sola hermandad —la mudanza, que es para lo que se escribió—
    -- devolvía la única que había y era correcto. Con varias hermandades
    -- dentro devuelve UNA CUALQUIERA, normalmente la más antigua: un titular
    -- dado de alta a mano acababa metido en la hermandad de otra gente, viendo
    -- su censo, y encima arrastraba hacia allí las filas sin dueño.
    --
    -- Por eso ahora solo se hace si de verdad estamos en el caso de la
    -- mudanza. Con dos o más hermandades, se le crea la suya.
    if (select count(*) from hermandades) <= 1 then
      select t.hermandad_id into nueva
        from titulares t where t.hermandad_id is not null limit 1;
    end if;
  end if;

  if nueva is null then
    insert into hermandades (nombre) values (coalesce(nullif(trim(p_nombre), ''), 'Mi hermandad'))
      returning id into nueva;
  end if;

  -- `on conflict` porque la fila puede existir ya, del alta a mano de antes.
  insert into titulares (auth_user_id, hermandad_id) values (auth.uid(), nueva)
    on conflict (auth_user_id) do update set hermandad_id = excluded.hermandad_id;

  -- La mudanza: todo lo que había en el proyecto de una sola hermandad pasa a
  -- ser de esta. Va ANTES de crear los ajustes, porque si ya había una fila de
  -- ajustes hay que adoptarla en vez de crear otra que chocaría.
  if ya_era_titular then
    perform adoptar_datos_sin_hermandad(nueva);
  end if;

  -- Los ajustes, ya creados: si no, la aplicación arranca sin fila y el primer
  -- guardado tiene que adivinar si insertar o actualizar.
  insert into hermandad_settings (hermandad_id, nombre_legal) values (nueva, p_nombre)
    on conflict (hermandad_id) do nothing;

  return nueva;
end $$;
grant execute on function crear_hermandad_base(text) to authenticated;


-- --- Y esta NO la puede llamar nadie desde fuera ----------------------------
--
-- `adoptar_datos_sin_hermandad` es SECURITY DEFINER: se salta las políticas a
-- propósito, porque tiene que tocar filas que todavía no son de nadie. Sin
-- estos `revoke`, Postgres se la concede a PUBLIC por defecto y PostgREST la
-- publica como cualquier otra: desde la consola del navegador, con la sesión
-- de CUALQUIER hermandad, bastaba con
--
--     supabase.rpc('adoptar_datos_sin_hermandad', { p_hermandad_id: '<el mío>' })
--
-- para adjudicarse todas las filas sin dueño de la base entera y verlas en su
-- propio panel. `crear_hermandad_manual` ya llevaba sus revoke; aquí se
-- olvidaron.
--
-- Las funciones que la necesitan (`crear_hermandad`, `crear_hermandad_manual`)
-- también son SECURITY DEFINER y la llaman por dentro, así que les da igual.
revoke execute on function adoptar_datos_sin_hermandad(uuid) from public;
revoke execute on function adoptar_datos_sin_hermandad(uuid) from anon, authenticated;


-- --- La misma alta, pero desde el editor SQL --------------------------------
-- `crear_hermandad()` se apoya en quién ha iniciado sesión, así que desde el
-- editor SQL de Supabase no sirve: allí no hay sesión de nadie y se queda en
-- «hay que haber iniciado sesión».
--
-- Esta hace lo mismo diciendo el correo a mano. Hace falta cuando la aplicación
-- que está publicada todavía es la de antes y no llama a la otra, o
-- simplemente para dejar una hermandad montada antes de entrar por primera vez.
--
--     select crear_hermandad_manual('tucorreo@ejemplo.com', 'Hdad. de la X');
--
-- NO se puede llamar desde el navegador, y eso es a propósito: crea una
-- hermandad para el correo que se le diga, así que en manos de cualquiera
-- sería una forma de colarse. El editor SQL de Supabase funciona porque va con
-- permisos de administrador, no con los del navegador.
create or replace function crear_hermandad_manual_base(p_email text, p_nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  nueva uuid;
  ya_era_titular boolean := false;
begin
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'No hay ninguna cuenta registrada con el correo %. Regístrate primero en la aplicación.', p_email;
  end if;

  -- Si ya pertenece a una, se devuelve esa. Igual que la otra: pulsar dos
  -- veces no puede dejar dos hermandades.
  select coalesce(
    (select t.hermandad_id from titulares t where t.auth_user_id = uid),
    (select pe.hermandad_id from personal pe where pe.auth_user_id = uid and pe.activo),
    (select h.hermandad_id from hermanos h where h.auth_user_id = uid)
  ) into nueva;
  if nueva is not null then
    return nueva;
  end if;

  select true into ya_era_titular from titulares where auth_user_id = uid;
  if ya_era_titular then
    -- Igual que en `crear_hermandad`: ese `limit 1` solo vale para la mudanza
    -- de un proyecto de UNA hermandad. Con varias dentro, metía al recién
    -- nombrado en la hermandad de otra gente.
    if (select count(*) from hermandades) <= 1 then
      select t.hermandad_id into nueva from titulares t where t.hermandad_id is not null limit 1;
    end if;
  end if;

  if nueva is null then
    insert into hermandades (nombre) values (coalesce(nullif(trim(p_nombre), ''), 'Mi hermandad'))
      returning id into nueva;
  end if;

  insert into titulares (auth_user_id, hermandad_id) values (uid, nueva)
    on conflict (auth_user_id) do update set hermandad_id = excluded.hermandad_id;

  if ya_era_titular then
    perform adoptar_datos_sin_hermandad(nueva);
  end if;

  insert into hermandad_settings (hermandad_id, nombre_legal) values (nueva, p_nombre)
    on conflict (hermandad_id) do nothing;

  return nueva;
end $$;

-- Postgres da permiso de ejecución a todo el mundo por defecto. Aquí NO.
revoke execute on function crear_hermandad_manual_base(text, text) from public;
revoke execute on function crear_hermandad_manual_base(text, text) from anon, authenticated;


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
-- `drop` antes de `create`: más adelante (colores-hermandad.sql) esta función
-- pasa a devolver también los colores de marca, y Postgres no deja cambiar el
-- tipo devuelto con un simple `create or replace`. Sin este drop, volver a
-- ejecutar el SQL entero fallaba aquí.
drop function if exists hermandades_publicas();
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

-- =============================================================================
--   APUNTES-AUTOMATICOS.SQL — Que los cobros lleguen solos a Tesorería
-- =============================================================================

-- =============================================================================
--   EL COBRO QUE SE APUNTA SOLO EN TESORERÍA
-- =============================================================================
--
-- Hasta ahora, marcar una cuota o una papeleta como pagada no dejaba rastro en
-- Tesorería: el dinero entraba en la hermandad y el libro de cuentas no se
-- enteraba. El saldo y el Estado de Cuentas solo reflejaban lo que alguien
-- hubiera escrito a mano, así que nunca cuadraban.
--
-- `origen` dice de dónde salió cada movimiento:
--
--     cuota:<id>      el cobro de un recibo
--     papeleta:<id>   el cobro de una papeleta de sitio
--     (vacío)         lo escribió alguien a mano en Tesorería
--
-- Sirve para tres cosas, y las tres importan:
--
--   1. No apuntar dos veces lo mismo si se marca pagada otra vez.
--   2. Poder retirar el apunte si el cobro se deshace (un recibo devuelto).
--   3. Saber, de un vistazo, qué línea del libro corresponde a qué recibo.
--
-- Ejecutar DESPUÉS de TODO-EN-UNO.sql. Es seguro repetirlo.
-- =============================================================================

alter table movimientos add column if not exists origen text;

-- Único POR HERMANDAD: dos hermandades pueden tener cada una su cuota con el
-- mismo identificador de origen sin pisarse. Y solo donde hay origen: los
-- movimientos escritos a mano no tienen, y son la mayoría.
create unique index if not exists movimientos_origen_por_hermandad
  on movimientos (hermandad_id, origen) where origen is not null;

-- =============================================================================
--   REGISTRO-ACTIVIDAD.SQL — Quién hizo qué (RGPD, artículo 32)
-- =============================================================================

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

-- =============================================================================
--   REMESAS.SQL — Que una remesa SEPA no se cobre dos veces
-- =============================================================================

-- ============================================================================
-- Gobergo — el rastro de las remesas SEPA
-- ============================================================================
--
-- QUÉ ARREGLA (auditoría de agosto de 2026)
--
-- Descargar el fichero XML de la remesa no dejaba NINGÚN rastro en los
-- recibos. Seguían «Pendiente» y domiciliados, así que la semana siguiente el
-- tesorero abría «Preparar remesa» y ahí estaban otra vez, los mismos.
--
-- Dos ficheros al banco con los mismos recibos son DOS CARGOS al mismo
-- hermano. El segundo vuelve devuelto, con su comisión, y con la llamada del
-- hermano preguntando por qué se le ha cobrado dos veces la cuota.
--
-- Con esta columna, al descargar el fichero cada recibo queda marcado con la
-- fecha, y no vuelve a entrar en una remesa por su cuenta. Si el fichero no se
-- llegó a mandar, la propia pantalla ofrece devolverlos.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table cuotas add column if not exists remesada_el date;

comment on column cuotas.remesada_el is
  'Fecha en la que este recibo salió dentro de un fichero de remesa SEPA descargado. '
  'Vacío = todavía no ha ido en ninguna. Sirve para que no se cobre dos veces.';

-- Para poder listar rápido «los que ya van en una remesa» sin leer la tabla
-- entera. Parcial: los que no se han remesado (la mayoría) no ocupan índice.
create index if not exists cuotas_remesada_el_idx
  on cuotas (hermandad_id, remesada_el)
  where remesada_el is not null;

-- =============================================================================
--   COMUNICADOS-SEGMENTO.SQL — Guardar a quién iba dirigido un comunicado
-- =============================================================================

-- ============================================================================
-- Gobergo — guardar a quién iba dirigido un comunicado
-- ============================================================================
--
-- QUÉ ARREGLA (auditoría de agosto de 2026)
--
-- Un comunicado con segmentación avanzada («Activos · con cuota pendiente»)
-- guardaba solo esa etiqueta legible. A la hora de avisar, la aplicación
-- intentaba adivinar a quién se refería LEYENDO ESE TEXTO: reconocía las que
-- empiezan por «Etiqueta: » y cualquiera que dijera «todos», y nada más.
--
-- «Activos · con cuota pendiente» no encaja en ninguna de las dos, así que la
-- lista de destinatarios salía VACÍA. Ni buzón, ni correo, ni nada. Y el
-- comunicado quedaba guardado como «Enviado», con su fecha y con un alcance de
-- 84 personas que no habían recibido absolutamente nada.
--
-- Con esta columna se guardan los criterios de verdad y se vuelven a resolver.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table comunicados add column if not exists criterios jsonb;

comment on column comunicados.criterios is
  'Criterios del segmento con el que se compuso el comunicado (estado, cuota, edad, '
  'etiqueta, campos propios). Vacío = destinatario simple, resuelto por su etiqueta. '
  'Sin esto no hay forma de saber a quién iba dirigido.';

-- =============================================================================
--   ACCESO-HERMANO.SQL — Cerrar el barrido de DNI en el acceso del hermano
-- =============================================================================

-- ============================================================================
-- Gobergo — cerrar el barrido de DNI en el acceso del hermano
-- ============================================================================
--
-- QUÉ ARREGLA (auditoría de agosto de 2026)
--
-- `resolver_email_hermano(hermandad, dni)` está concedida a `anon`, y tiene
-- que estarlo: el hermano escribe su DNI ANTES de tener sesión, y hace falta
-- traducirlo a un correo para poder abrirle sesión.
--
-- El problema no es que exista, es que no tenía freno. Desde cualquier
-- navegador, sin identificarse:
--
--     const { data: hs } = await supabase.rpc('hermandades_publicas')
--     await supabase.rpc('resolver_email_hermano',
--                        { p_hermandad_id: hs[0].id, p_dni: '12345678Z' })
--
-- Si devuelve un correo, esa persona es hermana de esa hermandad. Si devuelve
-- null, no lo es. En bucle, eso es un padrón.
--
-- Y NO es un dato cualquiera: pertenecer a una hermandad revela convicciones
-- religiosas, que el RGPD trata como CATEGORÍA ESPECIAL (artículo 9), el nivel
-- más alto de protección que existe. Publicar quién pertenece a cuál, aunque
-- sea de uno en uno, es exactamente lo que ese artículo prohíbe.
--
-- CÓMO SE CIERRA
--
-- Con un tope por hermandad y ventana de tiempo. Un hermano de verdad prueba
-- una o dos veces; quien barre necesita miles. El límite se nota enseguida
-- para el segundo y no molesta al primero.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

-- --- El registro de intentos -------------------------------------------------
--
-- No se guarda el DNI en claro: no hace falta para contar, y una tabla con
-- DNI de gente que ni siquiera es hermana no debería existir. Se guarda su
-- huella, que sirve para no contar diez veces el mismo dedazo.
create table if not exists intentos_acceso (
  id bigserial primary key,
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  huella_dni text not null,
  cuando timestamptz not null default now()
);

create index if not exists intentos_acceso_ventana_idx
  on intentos_acceso (hermandad_id, cuando desc);

alter table intentos_acceso enable row level security;

-- Nadie la lee ni la escribe desde fuera. La escribe la función, que es
-- SECURITY DEFINER y se salta las políticas a propósito. Sin ninguna política,
-- una tabla con RLS activo está cerrada a cal y canto, que es lo que se quiere.
revoke all on intentos_acceso from anon, authenticated;

-- --- La función, ahora con freno --------------------------------------------
create or replace function resolver_email_hermano(p_hermandad_id uuid, p_dni text)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_dni text;
  v_huella text;
  v_recientes int;
  v_email text;
begin
  -- Se quitan también los PUNTOS. La versión anterior solo quitaba espacios y
  -- guiones, así que quien escribía su DNI como lo lleva la tarjeta —
  -- «12.345.678-A», que es como lo escribe medio mundo— no entraba: se
  -- comparaba «12.345.678A» contra «12345678A» y no casaba. Y el mensaje que
  -- veía era «DNI o contraseña incorrectos».
  v_dni := upper(regexp_replace(coalesce(p_dni, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_dni = '' or p_hermandad_id is null then
    return null;
  end if;
  -- `md5` es de Postgres de serie: no hace falta ninguna extensión, y aquí no
  -- está guardando un secreto. Solo sirve para contar sin dejar escritos los
  -- DNI de gente que ni siquiera es hermana. Lleva dentro el id de la
  -- hermandad para que la misma huella no valga en dos sitios.
  v_huella := md5(v_dni || ':' || p_hermandad_id::text);

  -- Cuántos DNI DISTINTOS se han probado contra esta hermandad en la última
  -- media hora. Se cuentan distintos a propósito: quien se equivoca al teclear
  -- el suyo y lo repite cinco veces no es el que preocupa.
  select count(distinct huella_dni) into v_recientes
    from intentos_acceso
   where hermandad_id = p_hermandad_id
     and cuando > now() - interval '30 minutes';

  if v_recientes >= 25 then
    -- Se avisa en vez de devolver null: un hermano legítimo que llega justo
    -- después de un barrido tiene derecho a saber por qué no le funciona.
    raise exception 'Demasiados intentos de acceso en esta hermandad. Espera unos minutos y vuelve a probar.'
      using errcode = 'P0001';
  end if;

  insert into intentos_acceso (hermandad_id, huella_dni) values (p_hermandad_id, v_huella);

  -- La limpieza va aquí, aprovechando el viaje: sin esto la tabla crece para
  -- siempre y haría falta una tarea programada, que es una pieza más que
  -- mantener. Se borra lo de hace más de un día, no lo de hace media hora,
  -- para poder mirar un barrido después de que haya pasado.
  delete from intentos_acceso where cuando < now() - interval '1 day';

  select email into v_email from hermanos
   where hermandad_id = p_hermandad_id
     -- Y lo mismo del lado guardado: en el censo importado hay DNI escritos
     -- de las dos maneras, y los dos son el mismo señor.
     and upper(regexp_replace(dni, '[^A-Za-z0-9]', '', 'g')) = v_dni
     and estado <> 'Baja'
     and email <> ''
   limit 1;

  return v_email;
end $$;

grant execute on function resolver_email_hermano(uuid, text) to anon, authenticated;

-- =============================================================================
--   AREA-HERMANO.SQL — Que el área del hermano funcione de verdad
-- =============================================================================

-- ============================================================================
-- Gobergo — que el área del hermano funcione de verdad
-- ============================================================================
--
-- Cuatro hallazgos de la auditoría de agosto de 2026. Todos tienen la misma
-- pinta desde fuera: el hermano hace algo, la pantalla le dice que ha salido
-- bien, y no ha pasado nada.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Antes de nada: que `hermano_propio_id()` no se muerda la cola
-- ----------------------------------------------------------------------------
--
-- Esa función hace `select id from hermanos where auth_user_id = auth.uid()`.
-- Usada desde una política sobre OTRA tabla (cuotas, papeletas) va perfecta.
-- Usada desde una política sobre `hermanos` —que es lo que hace falta abajo
-- para que un tutor vea la ficha de su hijo— Postgres tiene que evaluar la
-- política de `hermanos` para resolver ese select, y para eso vuelve a llamar
-- a la función… y así hasta `stack depth limit exceeded`.
--
-- No es un error teórico: la primera versión de este fichero lo hacía, y lo
-- que reventaba no era solo la consulta del tutor, era CUALQUIER lectura de
-- `hermanos` hecha por un hermano. El área entera dejaba de cargar.
--
-- Con SECURITY DEFINER la función se salta las políticas al mirar su propia
-- fila, que es exactamente lo que necesita, y deja de haber ciclo. No abre
-- nada: sigue devolviendo solo el id de quien pregunta.
create or replace function hermano_propio_id() returns uuid
  language sql stable security definer set search_path = public as $$
    select id from hermanos where auth_user_id = auth.uid()
  $$;
grant execute on function hermano_propio_id() to authenticated;


-- ----------------------------------------------------------------------------
-- 1. «Ya he hecho el Bizum» no llegaba a tesorería
-- ----------------------------------------------------------------------------
--
-- El hermano abre un recibo pendiente, pulsa «Ya he enviado el Bizum», y la
-- pantalla cambia a «Pago avisado por Bizum» con la fecha. Pero de las
-- políticas de `cuotas` el hermano solo tenía SELECT: no había ninguna de
-- UPDATE que se cumpliera para él.
--
-- Y Postgres NO da error en ese caso: actualiza cero filas y contesta que todo
-- ha ido bien. Así que el aviso se veía en su móvil, no llegaba a la base de
-- datos, y en Tesorería no aparecía nadie esperando confirmación. El hermano
-- creía haber avisado; la hermandad, que no había pagado.
--
-- Se le deja actualizar SU propia fila. No hace falta acotar más por columnas:
-- lo único que la aplicación le deja tocar ahí es el aviso de pago, y el
-- importe o el estado los sigue decidiendo la tesorería al confirmarlo.
drop policy if exists "cuotas_propio_aviso_pago" on cuotas;
create policy "cuotas_propio_aviso_pago" on cuotas for update to authenticated
  using (auth_es_hermano() and hermano_id = hermano_propio_id())
  with check (auth_es_hermano() and hermano_id = hermano_propio_id());


-- ----------------------------------------------------------------------------
-- 2. Papeletas con números ya usados por otro hermano
-- ----------------------------------------------------------------------------
--
-- Al renovar desde su área, el número de la papeleta se calculaba en el móvil
-- del hermano como «el mayor que veo + 1». Pero él SOLO VE LAS SUYAS. Con 350
-- papeletas emitidas, Manuel —que el año pasado tuvo la 137— generaba la 138,
-- que ya era de otro. Dos papeletas con el mismo número, dos personas en el
-- mismo puesto y ningún aviso: la tabla no tenía nada que lo impidiera.
--
-- Se arregla por los dos lados: una función que da el número de verdad
-- (mirando TODAS las papeletas de la hermandad, saltándose las políticas a
-- propósito) y un índice único que impide el duplicado aunque algo falle.

create or replace function siguiente_numero_papeleta(p_anio int)
returns int
language sql volatile security definer set search_path = public as $$
  select coalesce(max(numero), 0) + 1
  from papeletas
  where hermandad_id = hermandad_actual() and anio = p_anio
$$;
-- Solo con sesión: `hermandad_actual()` no significa nada sin ella.
revoke execute on function siguiente_numero_papeleta(int) from public, anon;
grant execute on function siguiente_numero_papeleta(int) to authenticated;

-- La red de debajo. Si dos personas piden a la vez, una de las dos se lleva un
-- error visible en vez de colarse en silencio.
--
-- Se limpian antes los duplicados que ya hubiera, si no el índice no se puede
-- crear: al repetido más nuevo se le da un número libre al final.
do $$
declare r record;
begin
  for r in
    select id, hermandad_id, anio from (
      select id, hermandad_id, anio,
             row_number() over (partition by hermandad_id, anio, numero order by fecha_solicitud, id) as n
      from papeletas where hermandad_id is not null
    ) t where t.n > 1
  loop
    update papeletas set numero = (
      select coalesce(max(numero), 0) + 1 from papeletas
      where hermandad_id = r.hermandad_id and anio = r.anio
    ) where id = r.id;
    raise notice 'Papeleta % tenía un número repetido; se le ha dado uno libre.', r.id;
  end loop;
end $$;

create unique index if not exists papeletas_numero_unico
  on papeletas (hermandad_id, anio, numero)
  where hermandad_id is not null;


-- ----------------------------------------------------------------------------
-- 3. El buzón del hermano solo existía en el navegador de secretaría
-- ----------------------------------------------------------------------------
--
-- «Mi buzón» leía una clave del navegador. La secretaría mandaba la
-- convocatoria de cabildo desde su ordenador y el aviso se escribía ALLÍ; el
-- hermano abría su área en el móvil y leía «No tienes ningún aviso. Aquí te
-- llegará lo que te mande la hermandad». Siempre vacío, para todos.
create table if not exists avisos_hermano (
  id uuid primary key default gen_random_uuid(),
  -- `default hermandad_actual()` NO SOBRA. Sin él, la aplicación inserta sin
  -- hermandad, la fila entra con nulo, y la política —que exige que coincida
  -- con la hermandad de quien escribe— la rechaza. O sea: la secretaría no
  -- podía dejar ni un aviso. Las tablas del resto lo llevan porque se lo pone
  -- el bucle de `multi-hermandad.sql`; esta es nueva y hay que ponérselo aquí.
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  hermano_id uuid not null references hermanos(id) on delete cascade,
  fecha timestamptz not null default now(),
  titulo text,
  texto text not null,
  tipo text not null default 'ficha',
  leido boolean not null default false
);
create index if not exists avisos_hermano_suyos_idx on avisos_hermano (hermano_id, fecha desc);

alter table avisos_hermano enable row level security;

-- El personal escribe y lee los de su hermandad.
drop policy if exists "avisos_personal_all" on avisos_hermano;
create policy "avisos_personal_all" on avisos_hermano for all to authenticated
  using (not auth_es_hermano() and hermandad_id = hermandad_actual())
  with check (not auth_es_hermano() and hermandad_id = hermandad_actual());

-- El hermano lee los suyos…
drop policy if exists "avisos_propio_select" on avisos_hermano;
create policy "avisos_propio_select" on avisos_hermano for select to authenticated
  using (auth_es_hermano() and hermano_id = hermano_propio_id());
-- …y los marca como leídos. Nada más: no puede escribirse avisos a sí mismo.
drop policy if exists "avisos_propio_leido" on avisos_hermano;
create policy "avisos_propio_leido" on avisos_hermano for update to authenticated
  using (auth_es_hermano() and hermano_id = hermano_propio_id())
  with check (auth_es_hermano() and hermano_id = hermano_propio_id());


-- ----------------------------------------------------------------------------
-- 4. Lo que el hermano apaga en su móvil no lo veía quien manda el correo
-- ----------------------------------------------------------------------------
--
-- Las preferencias de avisos se guardaban en el navegador DEL HERMANO. Cuando
-- la tesorera marcaba un recibo como pagado desde el ordenador de la casa de
-- hermandad, se leían las preferencias DE ESE ordenador, donde ese hermano no
-- tiene ninguna. Resultado: se le escribía igual, después de haberle ofrecido
-- un interruptor para no recibirlo. Eso no es un detalle: es haberle prometido
-- algo y no cumplirlo.
--
-- Van en la propia ficha, que es de donde se leen los destinatarios.
alter table hermanos add column if not exists avisos_preferencias jsonb;

comment on column hermanos.avisos_preferencias is
  'Qué avisos quiere recibir por correo este hermano: {"cuota":true,"papeleta":false,...}. '
  'Vacío = los quiere todos. Los de tipo "importante" (baja, cambio de cuenta bancaria) '
  'no se pueden apagar y no se guardan aquí.';


-- ----------------------------------------------------------------------------
-- 5. El hijo a cargo se perdía al aprobar el alta
-- ----------------------------------------------------------------------------
--
-- Un hermano pedía desde su área el alta de su hija menor, la secretaría la
-- aprobaba, y el vínculo se descartaba en silencio al guardar: la columna no
-- existía. «Mi familia» salía siempre vacía y la solicitud se quedaba pendiente
-- para siempre.
alter table hermanos add column if not exists tutor_id uuid references hermanos(id) on delete set null;
create index if not exists hermanos_tutor_idx on hermanos (tutor_id) where tutor_id is not null;

-- Y LO MISMO EN LA SOLICITUD, que es donde el vínculo se apunta PRIMERO.
--
-- Esto se quedó a medias y costó caro. Arriba se arregló `hermanos.tutor_id`,
-- que es donde el vínculo ACABA; pero el hermano no escribe en `hermanos`,
-- escribe una solicitud, y `solicitudes_alta` no tenía ni `tutor_id` ni
-- `fecha_nacimiento`. Postgres no descarta la columna que le sobra: rechaza el
-- INSERT ENTERO. Así que no es que el hijo se quedara sin tutor —es que NINGUNA
-- solicitud llegaba, ni la del hijo ni la de un adulto desde la web pública—.
-- En pantalla se veía «No se pudo enviar la solicitud», sin más pistas.
alter table solicitudes_alta add column if not exists tutor_id uuid references hermanos(id) on delete set null;
alter table solicitudes_alta add column if not exists fecha_nacimiento date;

-- Y que el tutor pueda ver la ficha de quien tiene a cargo.
drop policy if exists "hermanos_a_mi_cargo_select" on hermanos;
create policy "hermanos_a_mi_cargo_select" on hermanos for select to authenticated
  using (auth_es_hermano() and tutor_id = hermano_propio_id());

-- =============================================================================
--   CORREO-HERMANDAD.SQL — Que la configuración de correo sea de la hermandad
-- =============================================================================

-- ============================================================================
-- Gobergo — que la configuración de correo sea de la HERMANDAD, no del portátil
-- ============================================================================
--
-- QUÉ ARREGLA (auditoría de agosto de 2026)
--
-- «Configuración → Correo» (si está activo, a dónde se responde, y de qué
-- avisar) se guardaba SOLO en el navegador de quien lo activó.
--
--   El secretario lo activa en su portátil. Al día siguiente la tesorera,
--   desde el ordenador de la casa de hermandad, marca cuotas como pagadas. En
--   ESE navegador la configuración no existe, así que se lee la de fábrica
--   —correo apagado— y no sale ningún aviso. Sin error, sin mensaje: la lista
--   de destinatarios sale vacía y todo parece haber ido bien.
--
--   Y en su pantalla de Configuración tampoco aparece activado, así que ni
--   siquiera puede sospechar que lo está en otro sitio.
--
-- Va donde va el resto de la ficha de la hermandad, que es lo que ya se
-- comparte entre todos los que entran.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table hermandad_settings add column if not exists correo jsonb;

comment on column hermandad_settings.correo is
  'Configuración de envío de correo de la hermandad: '
  '{"activo":true,"responderA":"secretaria@...","avisaDe":{"comunicados":true,...}}. '
  'Vacío = sin configurar. Antes vivía en el navegador de quien la activó, así que '
  'desde cualquier otro ordenador no salía ningún aviso y nadie se enteraba.';

-- =============================================================================
--   HERMANO-Y-GESTION.SQL — Ser hermano Y llevar la hermandad a la vez
-- =============================================================================

-- ============================================================================
-- Gobergo — ser hermano Y llevar la hermandad a la vez
-- ============================================================================
--
-- EL PROBLEMA
--
-- `auth_es_hermano()` decía «esta cuenta tiene ficha en el censo». Y con eso
-- se cerraba el acceso a TODAS las tablas de gestión, porque las políticas del
-- personal empiezan por `not auth_es_hermano()`.
--
-- Pero es que en una hermandad **casi todo el que gestiona es además hermano**.
-- El Hermano Mayor es hermano. La secretaria es hermana. El tesorero paga su
-- cuota y saca su papeleta como cualquiera.
--
-- Lo que pasaba el día que uno de ellos vinculaba su propia ficha al censo:
--
--   1. `auth_es_hermano()` pasaba a ser cierto para él.
--   2. Las políticas de gestión (`not auth_es_hermano()`) dejaban de aplicarle.
--   3. Le quedaban solo las del hermano: su ficha, sus cuotas, sus papeletas.
--   4. Entraba al panel y lo veía TODO VACÍO. Cero hermanos, cero cuotas, cero
--      movimientos. Sin un solo error: las consultas funcionaban, simplemente
--      no devolvían nada.
--
-- Y no hay forma de deducirlo mirando la pantalla. Parece que se han borrado
-- los datos.
--
-- LA CORRECCIÓN
--
-- «Es hermano» tiene que significar «es SOLO hermano»: tiene ficha en el censo
-- y no lleva la hermandad ni tiene cargo. Quien es las dos cosas es personal, y
-- entra por la puerta de personal — que es la que abre más, así que no se
-- pierde nada: su propia ficha también la ve por ahí.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

create or replace function auth_es_hermano() returns boolean
  language sql stable security definer set search_path = public as $$
    select
      exists (select 1 from hermanos where auth_user_id = auth.uid())
      -- Y NO lleva la hermandad ni tiene cargo. Este es el arreglo entero.
      and not exists (select 1 from titulares where auth_user_id = auth.uid())
      and not exists (select 1 from personal where auth_user_id = auth.uid() and activo)
  $$;
grant execute on function auth_es_hermano() to anon, authenticated;

-- `hermano_propio_id()` NO se toca a propósito.
--
-- Sigue devolviendo la ficha de quien pregunta, sea lo que sea. Hace falta así:
-- el Hermano Mayor que además es hermano tiene que poder ver SU papeleta y SUS
-- cuotas en su área, aunque para las políticas de gestión cuente como personal.
-- Son dos preguntas distintas: «¿qué puede tocar?» y «¿cuál es su ficha?».

comment on function auth_es_hermano() is
  'Cierto solo si la cuenta es EXCLUSIVAMENTE de hermano: tiene ficha en el censo y '
  'no está en titulares ni es personal activo. Quien es hermano Y gestiona entra como '
  'personal, que abre más. Antes bastaba con tener ficha, y eso dejaba al Hermano Mayor '
  'con el panel vacío el día que vinculaba la suya.';

-- =============================================================================
--   PERMISOS-POR-HERMANDAD.SQL — Que los permisos por cargo sean de cada hermandad
-- =============================================================================

-- ============================================================================
-- Gobergo — que los permisos por cargo sean de CADA hermandad
-- ============================================================================
--
-- TRES FALLOS EN LA MISMA TABLA, y el primero es el gordo.
--
-- 1) LOS PERMISOS DE UNA HERMANDAD MANDABAN SOBRE LAS DEMÁS
--
--    `modulo_permitido()` unía `personal` con `permisos_cargo` SOLO por el
--    nombre del cargo, sin mirar de quién eran esas filas:
--
--        join permisos_cargo pc on pc.cargo = p.cargo
--
--    Así que si una hermandad decidía que su Tesorero/a no entrara en
--    «hermanos», se lo quitaba también al tesorero de TODAS las demás. Y al
--    revés: dárselo a uno era dárselo a todos.
--
-- 2) Y NO SE PODÍAN GUARDAR
--
--    La clave primaria era `(cargo, modulo_id)`, sin la hermandad. Las filas
--    de fábrica que siembra el propio esquema entran sin dueño, así que la
--    segunda hermandad que intentara guardar chocaba con esa clave. En
--    pantalla salía «Permisos guardados» en verde y no se guardaba nada.
--
-- 3) Y AL ENTRAR NO HABÍA NINGUNO
--
--    Una hermandad nueva no tenía filas propias, así que su junta se quedaba
--    sin acceso a nada hasta que alguien pasara por Configuración.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

-- --- 1. La columna, y la clave primaria de verdad ---------------------------

alter table permisos_cargo add column if not exists hermandad_id uuid
  references hermandades(id) on delete cascade;

do $$
begin
  -- Las filas de fábrica, sembradas por schema.sql sin dueño, ya no valen:
  -- cada hermandad tiene ahora las suyas. Se van para no chocar con la clave
  -- nueva ni colarse en el permiso de nadie.
  delete from permisos_cargo where hermandad_id is null;

  if exists (
    select 1 from pg_constraint
     where conname = 'permisos_cargo_pkey'
       and conrelid = 'permisos_cargo'::regclass
       and array_length(conkey, 1) = 2
  ) then
    alter table permisos_cargo drop constraint permisos_cargo_pkey;
    alter table permisos_cargo add primary key (hermandad_id, cargo, modulo_id);
  end if;
end $$;

alter table permisos_cargo alter column hermandad_id set default hermandad_actual();
create index if not exists permisos_cargo_hermandad_idx on permisos_cargo (hermandad_id);

-- --- 2. La comprobación, mirando de quién son los permisos -------------------

create or replace function modulo_permitido(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select
      es_titular()
      or exists (
        select 1 from personal p
        join permisos_cargo pc
          on pc.cargo = p.cargo
         -- ESTA LÍNEA es el arreglo: los permisos de una hermandad solo valen
         -- dentro de ella.
         and pc.hermandad_id = p.hermandad_id
        where p.auth_user_id = auth.uid() and p.activo and pc.modulo_id = p_modulo
      )
  $$;
grant execute on function modulo_permitido(text) to authenticated;

-- --- 3. Los de fábrica, para cada hermandad ---------------------------------

/**
 * Siembra los permisos de fábrica de UNA hermandad.
 *
 * Se llama al crearla y también se puede llamar a mano para las que ya
 * existían. `on conflict do nothing`: lo que la hermandad haya cambiado se
 * respeta, esto solo rellena lo que falte.
 */
create or replace function sembrar_permisos_de_fabrica(p_hermandad_id uuid) returns void
  language sql security definer set search_path = public as $$
    insert into permisos_cargo (hermandad_id, cargo, modulo_id)
    select p_hermandad_id, cargo, modulo_id from (values
      ('Hermano Mayor','hermanos'),('Hermano Mayor','cortejo'),('Hermano Mayor','cuotas'),
      ('Hermano Mayor','papeletas'),('Hermano Mayor','tesoreria'),('Hermano Mayor','inventario'),
      ('Hermano Mayor','archivo'),('Hermano Mayor','comunicados'),('Hermano Mayor','informes'),
      ('Hermano Mayor','personal'),('Hermano Mayor','configuracion'),
      ('Secretario/a','hermanos'),('Secretario/a','cortejo'),('Secretario/a','papeletas'),
      ('Secretario/a','archivo'),('Secretario/a','comunicados'),('Secretario/a','informes'),
      ('Tesorero/a','tesoreria'),('Tesorero/a','cuotas'),('Tesorero/a','inventario'),('Tesorero/a','informes'),
      ('Fiscal','archivo'),('Fiscal','informes'),
      ('Mayordomo/Prioste','cortejo'),('Mayordomo/Prioste','inventario'),('Mayordomo/Prioste','informes'),
      ('Diputado/a Mayor de Gobierno','hermanos'),('Diputado/a Mayor de Gobierno','cortejo'),
      ('Diputado/a Mayor de Gobierno','papeletas'),('Diputado/a Mayor de Gobierno','informes'),
      ('Vocal','comunicados'),('Vocal','informes')
    ) as f(cargo, modulo_id)
    on conflict do nothing
  $$;
revoke execute on function sembrar_permisos_de_fabrica(uuid) from public;
revoke execute on function sembrar_permisos_de_fabrica(uuid) from anon, authenticated;

-- Las hermandades que ya existen se quedaron sin permisos al borrar los de
-- fábrica ahí arriba. Se les siembran los suyos.
do $$
declare h uuid;
begin
  for h in select id from hermandades loop
    perform sembrar_permisos_de_fabrica(h);
  end loop;
end $$;

-- --- 4. Y que toda hermandad nueva nazca con los suyos ----------------------
--
-- Se envuelve `crear_hermandad` en vez de reescribirla: así este fichero se
-- puede ejecutar suelto sin arrastrar la definición entera de la otra, que
-- vive en multi-hermandad.sql y cambia por su cuenta.
create or replace function crear_hermandad(p_nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare nueva uuid;
begin
  nueva := crear_hermandad_base(p_nombre);
  perform sembrar_permisos_de_fabrica(nueva);
  return nueva;
end $$;
grant execute on function crear_hermandad(text) to authenticated;

-- Y la de dar de alta a mano desde el editor SQL, igual.
create or replace function crear_hermandad_manual(p_email text, p_nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare nueva uuid;
begin
  nueva := crear_hermandad_manual_base(p_email, p_nombre);
  perform sembrar_permisos_de_fabrica(nueva);
  return nueva;
end $$;
revoke execute on function crear_hermandad_manual(text, text) from public;
revoke execute on function crear_hermandad_manual(text, text) from anon, authenticated;

-- =============================================================================
--   COLORES-HERMANDAD.SQL — Que el área del hermano lleve los colores de su hermandad
-- =============================================================================

-- ============================================================================
-- Gobergo — que el área del hermano se vista con los colores de SU hermandad
-- ============================================================================
--
-- El área del hermano salía siempre con el mismo dorado, hubiera elegido la
-- hermandad que hubiera elegido. Y cada hermandad tiene sus colores: son los
-- de su escudo, los de su túnica, los que su gente reconoce.
--
-- Los colores de marca no son un dato reservado —están en su web pública, en
-- su cartel y en su escudo— así que se pueden dar sin sesión, igual que el
-- nombre. Lo que NO sale de aquí es nada más: ni correo, ni IBAN, ni CIF.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

-- `drop` antes de `create`: cambia el tipo de la tabla que devuelve, y Postgres
-- no deja hacer eso con un simple `create or replace`.
drop function if exists hermandades_publicas();

create or replace function hermandades_publicas()
returns table (id uuid, nombre text, color_primario text, color_secundario text, logo_data_url text)
language sql stable security definer set search_path = public as $$
  select
    h.id,
    h.nombre,
    -- Los de fábrica si esa hermandad todavía no ha puesto los suyos, para que
    -- el área nunca se quede sin color.
    coalesce(nullif(s.color_primario, ''), '#6A1A23'),
    coalesce(nullif(s.color_secundario, ''), '#C5A059'),
    s.logo_data_url
  from hermandades h
  left join hermandad_settings s on s.hermandad_id = h.id
  where h.activa
  order by h.nombre
$$;
grant execute on function hermandades_publicas() to anon, authenticated;

-- =============================================================================
--   EVENTOS-REPETICION.SQL — Que un culto que se repite siga repitiéndose
-- =============================================================================

-- ============================================================================
-- Gobergo — que un culto que se repite siga repitiéndose
-- ============================================================================
--
-- La repetición de un evento («todos los primeros viernes», «cada 8 de
-- septiembre») se guardaba solo en el navegador: la columna no existía y
-- `eventoToRow` ni la mandaba.
--
-- Así que al recargar volvía a ser una fecha suelta. Y en cuanto pasaba esa
-- primera fecha, el culto DESAPARECÍA del calendario y de la web pública. Una
-- hermandad que hubiera puesto sus cultos de todo el año se quedaba, semana a
-- semana, sin ninguno.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table eventos add column if not exists repeticion jsonb;

comment on column eventos.repeticion is
  'Cada cuánto se repite el acto: {"cada":"mes","dia":"primer viernes"} o similar. '
  'Vacío = una sola fecha. Antes vivía solo en el navegador y el culto se perdía al recargar.';

-- =============================================================================
--   SUSCRIPCION.SQL — Que la suscripción sea de la hermandad, no del navegador
-- =============================================================================

-- ============================================================================
-- Gobergo — que la suscripción sea de la hermandad, no del navegador
-- ============================================================================
--
-- LO QUE PASA HOY
--
-- La suscripción vive en `localStorage`, en la clave `cabildo-suscripcion`.
-- Eso tiene dos caras y las dos son malas:
--
--   · La secretaria entra desde el ordenador de la casa de hermandad y se
--     encuentra el muro de pago, aunque la hermandad esté al corriente. En SU
--     navegador esa clave no existe. Llama al Hermano Mayor a preguntar qué
--     pasa.
--
--   · Y al revés: desde la consola del navegador, dos líneas bastan para
--     ponerse el pack «Todo» sin pagar. No hace falta ser nadie: la clave la
--     escribe el propio navegador.
--
-- Con esta tabla la suscripción pasa a ser un dato de la hermandad, que se lee
-- desde cualquier sitio y que NADIE puede escribir desde el navegador: solo la
-- puede tocar el `service_role`, o sea el webhook de Stripe cuando lo haya.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

create table if not exists suscripciones (
  hermandad_id uuid primary key references hermandades(id) on delete cascade,
  activa boolean not null default false,
  -- 'gestion' | 'web' | 'completo' | 'todo'
  pack text,
  -- 'mensual' | 'anual'
  periodo text,
  desde date,
  -- Hasta cuándo está pagada. Vacío = sin caducidad conocida.
  hasta date,
  -- Para atar la fila con lo que diga Stripe el día que se conecte.
  stripe_customer_id text,
  stripe_subscription_id text,
  actualizada_en timestamptz not null default now()
);

alter table suscripciones enable row level security;

-- LEER, sí: cada hermandad la suya. Es lo que quita el muro de pago desde
-- cualquier ordenador de la junta.
drop policy if exists suscripcion_propia_select on suscripciones;
create policy suscripcion_propia_select on suscripciones
  for select to authenticated
  using (hermandad_id = hermandad_actual());

-- ESCRIBIR, NO. Ni el titular. Quien paga es Stripe y quien lo confirma es su
-- webhook, con el `service_role`, que se salta las políticas por definición.
-- Sin ninguna política de escritura, la tabla queda cerrada a cal y canto para
-- todo el mundo que entre por el navegador — que es justo el agujero de ahora.
revoke insert, update, delete on suscripciones from anon, authenticated;

/**
 * La suscripción de la hermandad actual, o una vacía si no tiene fila.
 *
 * Devolver algo siempre evita que la aplicación tenga que distinguir «no hay
 * fila» de «no está activa»: para lo que le importa, es lo mismo.
 */
create or replace function mi_suscripcion()
returns table (activa boolean, pack text, periodo text, desde date, hasta date)
language sql stable security definer set search_path = public as $$
  select
    coalesce(s.activa, false),
    s.pack,
    s.periodo,
    s.desde,
    s.hasta
  from (select 1) x
  left join suscripciones s on s.hermandad_id = hermandad_actual()
$$;
grant execute on function mi_suscripcion() to authenticated;

-- Para dar de alta o renovar a mano mientras no hay Stripe. Se ejecuta desde
-- el editor SQL, que es lo único que corre con permisos de administrador.
create or replace function activar_suscripcion(
  p_hermandad_id uuid,
  p_pack text default 'todo',
  p_periodo text default 'mensual',
  p_hasta date default null
) returns void
language sql security definer set search_path = public as $$
  insert into suscripciones (hermandad_id, activa, pack, periodo, desde, hasta, actualizada_en)
  values (p_hermandad_id, true, p_pack, p_periodo, current_date, p_hasta, now())
  on conflict (hermandad_id) do update set
    activa = true, pack = excluded.pack, periodo = excluded.periodo,
    hasta = excluded.hasta, actualizada_en = now()
$$;
revoke execute on function activar_suscripcion(uuid, text, text, date) from public;
revoke execute on function activar_suscripcion(uuid, text, text, date) from anon, authenticated;

-- =============================================================================
--   PLANTILLAS-HERMANDAD.SQL — Que los modelos y la asistencia no se pierdan al cerrar sesión
-- =============================================================================

-- ============================================================================
-- Gobergo — que los modelos y la asistencia no se borren al cerrar sesión
-- ============================================================================
--
-- LO QUE PASABA
--
-- El modelo de papeleta de sitio, el de recibo y la hoja de asistencia del
-- cortejo vivían SOLO en `localStorage`. Y al cerrar sesión —o al cambiar de
-- hermandad— se limpia todo lo que empieza por `cabildo-`, que es lo correcto:
-- si no, la siguiente persona que entrara en ese ordenador vería datos de otra.
--
-- Pero como estas tres cosas no estaban en ninguna otra parte, esa limpieza no
-- era limpieza: era una PÉRDIDA. La hermandad dedicaba una tarde a dejar su
-- papeleta con su escudo, sus textos y su disposición, cerraba sesión, y al
-- día siguiente estaba la de fábrica otra vez. Sin explicación posible.
--
-- Y la asistencia es peor todavía: se marca la MADRUGADA del Viernes Santo,
-- tramo por tramo, desde el móvil del diputado. Perderla no se puede rehacer.
--
-- Van en `hermandad_settings`, que es donde ya vive el resto de la ficha que
-- comparte toda la junta.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table hermandad_settings add column if not exists modelo_papeleta jsonb;
alter table hermandad_settings add column if not exists modelo_recibo jsonb;
alter table hermandad_settings add column if not exists asistencia jsonb;

comment on column hermandad_settings.modelo_papeleta is
  'Diseño de la papeleta de sitio de esta hermandad. Antes vivía solo en el navegador y se perdía al cerrar sesión.';
comment on column hermandad_settings.modelo_recibo is
  'Diseño del recibo de cuota de esta hermandad.';
comment on column hermandad_settings.asistencia is
  'Quién asistió al cortejo, marcado por los diputados de tramo. Se registra la madrugada y no se puede rehacer.';

-- =============================================================================
--   AJUSTES-DE-LA-HERMANDAD.SQL — Ajustes de cuotas y etiquetas: de la hermandad, no del navegador
-- =============================================================================

-- ============================================================================
--   DOS AJUSTES QUE VIVÍAN EN UN SOLO NAVEGADOR
-- ============================================================================
--
-- Mismo problema que tenían el modelo de papeleta y la hoja de asistencia
-- —arreglado en `plantillas-hermandad.sql`— en otros dos sitios que se
-- quedaron atrás. Los dos son decisiones DE LA HERMANDAD, no preferencias de
-- quien está delante del ordenador, y los dos vivían en `localStorage`.
--
-- 1. LOS AJUSTES DE CUOTAS, y este es de dinero.
--
--    `bloquearPapeletaConDeuda` — «a quien deba cuotas no se le saca papeleta».
--    La hermandad lo decide en cabildo, la secretaria lo activa en SU
--    ordenador, y quien atiende el sábado por la mañana desde el otro no tiene
--    el bloqueo: le saca la papeleta a un moroso y nadie se entera hasta que
--    se cuadran las cuentas.
--
--    `moraRequiereDosCargos` — poner a alguien en mora exige que lo proponga
--    un cargo y lo confirme otro distinto. Es un control de cuatro ojos, y un
--    control de cuatro ojos que se salta abriendo otro navegador no es un
--    control.
--
-- 2. EL CATÁLOGO DE ETIQUETAS (costalero, acólito, banda, diputado de tramo…).
--
--    Con él se segmentan los comunicados y se filtra el censo. Cada ordenador
--    tenía el suyo: el mayordomo creaba «Costalero de repuesto» en el suyo y
--    desde el de secretaría esa etiqueta no existía, así que el comunicado a
--    los costaleros de repuesto no se podía mandar. Y al cerrar sesión se
--    borra todo lo que empieza por `cabildo-`, así que el catálogo entero
--    desaparecía.
--
-- Las dos van como `jsonb` en `hermandad_settings`, igual que las plantillas.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table hermandad_settings add column if not exists ajustes_cuotas jsonb;
alter table hermandad_settings add column if not exists etiquetas jsonb;

comment on column hermandad_settings.ajustes_cuotas is
  'Decisiones de la hermandad sobre cuotas: si bloquear la papeleta a quien debe, '
  'y si la mora exige la confirmación de dos cargos. Vivían en localStorage, así que '
  'no valían desde otro ordenador — incluido el control de cuatro ojos de la mora.';

comment on column hermandad_settings.etiquetas is
  'Catálogo de etiquetas de la hermandad (costalero, acólito, banda…). Con ellas se '
  'segmentan los comunicados. Vivían en localStorage: cada ordenador tenía el suyo y '
  'se borraban al cerrar sesión.';

-- =============================================================================
--   HERMANO-CON-CARGO.SQL — Una persona, una ficha: el cargo va en la ficha del hermano
-- =============================================================================

-- ============================================================================
--   UNA PERSONA, UNA FICHA — el cargo vive en la ficha del hermano
-- ============================================================================
--
-- EL PROBLEMA
--
--   Hasta ahora, el secretario de una hermandad existía DOS VECES: una como
--   hermano nº 47 en el censo, con sus cuotas y su papeleta, y otra como fila
--   en `personal` con su correo y su cargo. Dos fichas, dos claves, dos
--   maneras de entrar, y nada que las uniera salvo que se llamaban igual.
--
--   Eso no es una molestia de diseño: es la causa del fallo que se veía. Se
--   entraba con el correo, la aplicación miraba en `hermanos`, encontraba la
--   ficha y mandaba al área del hermano. Se entraba por el área del hermano y
--   no había forma de llegar al panel. La persona era la misma y el sistema no
--   lo sabía.
--
-- LO QUE HACE ESTE ARCHIVO
--
--   Pone el cargo EN LA FICHA DEL HERMANO. Una persona, una ficha, un número
--   de hermano, una clave. Si lleva cargo, además entra al panel y ve los
--   módulos de su cargo. Si no lo lleva, tiene su área y ya está.
--
--   La tabla `personal` NO se toca y NO se vacía: sigue existiendo para quien
--   trabaja en la hermandad sin ser hermano y ya estaba dado de alta ahí. Las
--   dos vías conviven. Todo lo que hay aquí SUMA con `or`; no sustituye nada.
--
-- LAS CUATRO COSAS QUE IMPORTAN, POR ORDEN
--
--   1. El trigger `hermanos_solo_personal_toca_el_cargo`. Sin él, esto abre la
--      base entera: cualquier hermano puede reescribir su propia ficha, así
--      que en cuanto `cargo` existe como columna, dos líneas en la consola del
--      navegador le convierten en Hermano Mayor. Es lo primero que se lee.
--   2. `auth_es_hermano()` cambia de significado, y con él las ~60 políticas
--      que empiezan por `not auth_es_hermano()`. Por eso hay que reescribir
--      las políticas «propio»: si no, un tesorero pierde su propia papeleta.
--   3. Las políticas `authenticated_all` se borran. Anulaban el filtro por
--      módulo en catorce tablas — el cargo era interfaz, no seguridad.
--   4. Los permisos de fábrica se ponen al día: la aplicación y la base decían
--      cosas distintas, y se notaba en «guardo y no se guarda».
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
--
--   Va EL ÚLTIMO de todos los archivos: redefine funciones que crean los
--   anteriores, y el que manda es el último que se ejecuta.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Las dos columnas nuevas
-- ----------------------------------------------------------------------------

-- `cargo` es text y no un enum a propósito: `personal.cargo` y
-- `permisos_cargo.cargo` ya son text, y el cruce que decide los permisos es
-- text contra text. Un enum obligaría a convertir en todas partes.
alter table hermanos add column if not exists cargo text;
alter table hermanos add column if not exists civil boolean not null default false;

comment on column hermanos.cargo is
  'Cargo en la junta, si lo lleva. NULL = hermano de a pie, que es lo normal. '
  'Cruza con permisos_cargo.cargo para decidir qué módulos toca. Solo lo puede '
  'cambiar quien tenga el módulo personal: lo vigila el trigger de más abajo.';

comment on column hermanos.civil is
  'Hermano civil: está en el censo y tiene su área, pero NO se le emiten cuotas. '
  'Para quien trabaja en la hermandad sin ser hermano. OJO: en el SQL esta columna '
  'no hace nada — no hay nada en la base que emita cuotas, las emite la aplicación. '
  'Si buscas aquí el filtro, no está: está en src/lib/cuotasEmision.ts (la emisión anual) '
  'y en el cajón de cuota suelta de src/pages/app/Cuotas.tsx.';

-- Para llevar cargo hace falta correo. No es burocracia: con cargo se entra al
-- panel, y el panel lo protegen las políticas, que preguntan por `auth.uid()`.
-- Sin correo no hay cuenta de Supabase, sin cuenta no hay `auth.uid()`, y sin
-- eso no hay ninguna protección del lado del servidor.
do $$
begin
  alter table hermanos add constraint hermanos_cargo_con_correo
    check (cargo is null or email <> '');
exception when duplicate_object then null;
end $$;

-- `modulo_permitido()` va a leer esto en CADA fila de CADA consulta.
create index if not exists hermanos_cargo_idx
  on hermanos (hermandad_id, cargo) where cargo is not null;

-- NO se pone un índice único sobre el correo, y conviene saber por qué para que
-- nadie lo «arregle»: en una hermandad es normalísimo que un padre apunte a sus
-- dos hijos menores con su propio correo, o que un matrimonio comparta el suyo.
-- Un único los dejaría fuera del censo.
--
-- Donde el correo sí tiene que ser único es en las CUENTAS, y de eso ya se
-- encarga Supabase: el segundo alta con el mismo correo falla, y la aplicación
-- lo explica en cristiano (src/lib/accesos.ts). Es decir: dos hermanos pueden
-- compartir correo mientras solo uno de ellos tenga cuenta.
create index if not exists hermanos_email_idx
  on hermanos (hermandad_id, lower(email)) where email <> '';


-- ----------------------------------------------------------------------------
-- 2. EL TRIGGER. Que nadie se ponga un cargo a sí mismo
-- ----------------------------------------------------------------------------
--
-- Esto es lo más importante del archivo.
--
-- `hermanos_propio_update` deja a cada hermano reescribir SU PROPIA FILA. Era
-- inofensivo mientras en esa fila no hubiera nada que diera poder: cambiarse
-- el teléfono no hace daño a nadie. Desde el momento en que existe `cargo`, un
-- hermano cualquiera puede abrir la consola del navegador y escribir:
--
--     supabase.from('hermanos').update({ cargo: 'Hermano Mayor' })
--             .eq('auth_user_id', <el suyo>)
--
-- y a partir de ahí ve el censo entero, la tesorería y los permisos de todos.
--
-- Postgres NO permite limitar columnas dentro de una política RLS: una política
-- deja pasar la fila entera o ninguna. Así que la única forma de proteger DOS
-- columnas de una fila que su dueño sí puede editar es un trigger.
--
-- POR QUÉ REVIERTE EN SILENCIO Y NO DA ERROR. Porque la aplicación manda
-- siempre la fila completa al guardar (supabaseSync.ts), así que un hermano que
-- cambia su teléfono manda también su `cargo` — el mismo que ya tenía. Si esto
-- lanzara una excepción, ese guardado normal fallaría y nadie entendería por
-- qué. Revirtiendo, el valor vuelve a ser el que era y no pasa nada. Quien SÍ
-- tiene derecho a cambiarlo no pasa por aquí.
create or replace function hermanos_solo_personal_toca_el_cargo() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- Sin sesión no es el navegador: es el editor SQL o una función interna, que
  -- ya han pasado por RLS (estas tablas solo abren a `authenticated`). Ahí no
  -- hay nada que proteger y estorbaría para arreglar datos a mano.
  if auth.uid() is null then return new; end if;

  -- Quien gestiona el censo o los cargos escribe la ficha entera. Son dos
  -- módulos y hacen falta los dos: «hermanos» es quien corrige una dirección,
  -- «personal» es quien reparte cargos. Si solo se pidiera «personal», la
  -- secretaria no podría ni cambiar un teléfono.
  if modulo_permitido('hermanos') or modulo_permitido('personal') then return new; end if;

  /*
   * A partir de aquí es el propio hermano escribiendo SU ficha, y solo puede
   * tocar lo suyo. LISTA BLANCA, no lista negra, y la diferencia es todo:
   *
   * Congelar solo `cargo` y `civil` no bastaba, y el agujero era de libro. La
   * única forma que tiene la base de quitarle el cargo a alguien es su
   * `estado`: tanto `auth_es_hermano()` como `modulo_permitido()` preguntan
   * por `estado <> 'Baja'`. Pero `estado` es una columna más de su fila, y RLS
   * no sabe de columnas. Así que al tesorero destituido le bastaba con una
   * línea desde la consola del navegador, con la sesión que ya tenía abierta:
   *
   *     supabase.from('hermanos').update({ estado: 'Activo' }).eq(...)
   *
   * El disparador miraba `cargo`, veía que no cambiaba, y dejaba pasar. En ese
   * instante recuperaba Tesorería, Cuotas, Inventario e Informes.
   *
   * Y de paso se cerraba lo mismo con `numero` (subirse en el escalafón),
   * `cuota_al_dia` (darse la cuota por pagada), `antiguedad` (ganar prioridad
   * al pedir papeleta) e `iban`.
   *
   * Lo que un hermano SÍ puede cambiar de su ficha es lo que ya declara
   * `contactoDelHermanoToRow` en la aplicación —sus datos de contacto—, su
   * foto y sus preferencias de aviso, más pedir la baja. Todo lo demás vuelve
   * a como estaba.
   */
  if tg_op = 'INSERT' then
    -- Un hermano no se da de alta a sí mismo: eso lo hace secretaría o el
    -- formulario público, que pasa por `solicitudes_alta`. Si aun así llegara
    -- aquí, entra sin nada que dé poder.
    new.cargo := null;
    new.civil := false;
    new.estado := 'Nuevo';
    new.numero := 0;
    new.cuota_al_dia := false;
    return new;
  end if;

  new.cargo := old.cargo;
  new.civil := old.civil;
  new.estado := old.estado;
  new.numero := old.numero;
  new.cuota_al_dia := old.cuota_al_dia;
  new.antiguedad := old.antiguedad;
  new.iban := old.iban;
  new.etiquetas := old.etiquetas;
  new.tutor_id := old.tutor_id;
  new.dni := old.dni;
  new.hermandad_id := old.hermandad_id;
  new.auth_user_id := old.auth_user_id;
  return new;
end $$;

drop trigger if exists hermanos_solo_personal_toca_el_cargo on hermanos;
create trigger hermanos_solo_personal_toca_el_cargo
  before insert or update on hermanos
  for each row execute function hermanos_solo_personal_toca_el_cargo();

comment on function hermanos_solo_personal_toca_el_cargo() is
  'Lista blanca de lo que un hermano puede cambiar de SU PROPIA ficha: contacto, foto, '
  'preferencias de aviso y pedir la baja. Todo lo que da poder o posición —cargo, civil, '
  'estado, numero, cuota_al_dia, antiguedad, iban, etiquetas, dni— vuelve a su valor '
  'anterior. Quien lleva el módulo hermanos o el de personal escribe la ficha entera. '
  'Revierte en vez de fallar porque la aplicación manda la fila completa en cada guardado.';


-- ----------------------------------------------------------------------------
-- 3. Quién gestiona: las tres funciones que lo deciden
-- ----------------------------------------------------------------------------

-- `auth_es_hermano()` significa «esta cuenta es SOLO de hermano», y es la que
-- abre y cierra todas las políticas de gestión (todas empiezan por
-- `not auth_es_hermano()`). Añadirle la cuarta condición es lo que hace que un
-- hermano con cargo entre al panel: se vuelve falso para él, y las ~60
-- políticas se adaptan solas sin tocar ni una.
--
-- 'Hermano de a pie' se excluye a propósito. Ese cargo no tiene módulos, así
-- que quien lo llevara se quedaría en tierra de nadie: fuera de las políticas
-- de hermano por tener cargo, y sin ningún módulo por no tener permisos. Sin
-- acceso a nada. La aplicación no lo ofrece al poner un cargo, pero si algún
-- día se cuela, aquí no hace daño.
create or replace function auth_es_hermano() returns boolean
  language sql stable security definer set search_path = public as $$
    select
      exists (select 1 from hermanos where auth_user_id = auth.uid())
      and not exists (select 1 from titulares where auth_user_id = auth.uid())
      and not exists (select 1 from personal where auth_user_id = auth.uid() and activo)
      and not exists (
        select 1 from hermanos
        where auth_user_id = auth.uid()
          and cargo is not null
          and cargo <> 'Hermano de a pie'
          and estado <> 'Baja'
      )
  $$;
grant execute on function auth_es_hermano() to anon, authenticated;

comment on function auth_es_hermano() is
  'Cierto solo si la cuenta es EXCLUSIVAMENTE de hermano: tiene ficha en el censo y '
  'no está en titulares, ni es personal activo, ni lleva cargo en su propia ficha. '
  'Hay TRES formas de gestionar: ser el titular, estar en personal, o llevar cargo '
  'en la ficha. Esta última es la nueva y la que se recomienda.';

-- `modulo_permitido()` es la que decide, módulo a módulo, quién escribe. Tercera
-- rama con `or`: las otras dos NO se tocan, porque la junta que hoy entra por
-- `personal` tiene que seguir entrando.
create or replace function modulo_permitido(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select
      es_titular()
      or exists (
        select 1 from personal p
        join permisos_cargo pc
          on pc.cargo = p.cargo and pc.hermandad_id = p.hermandad_id
        where p.auth_user_id = auth.uid() and p.activo and pc.modulo_id = p_modulo
      )
      -- NUEVO: el cargo en la ficha del hermano.
      or exists (
        select 1 from hermanos h
        join permisos_cargo pc
          -- `pc.hermandad_id = h.hermandad_id` no es opcional: los permisos de
          -- una hermandad no valen dentro de otra.
          on pc.cargo = h.cargo and pc.hermandad_id = h.hermandad_id
        where h.auth_user_id = auth.uid()
          and h.cargo is not null
          -- Un hermano de baja no sigue llevando la tesorería.
          and h.estado <> 'Baja'
          and pc.modulo_id = p_modulo
      )
  $$;
grant execute on function modulo_permitido(text) to authenticated;

comment on function modulo_permitido(text) is
  'Tres vías, sumadas con OR: el titular lo puede todo; el personal activo, lo de su '
  'cargo; y el hermano con cargo en su ficha, lo de su cargo. Hay CUATRO definiciones '
  'de esta función en el repositorio (schema.sql, rls-cargos.sql, rls-endurecer.sql y '
  'permisos-por-hermandad.sql) y la que manda es ESTA, que es la última que se ejecuta.';

-- `auth_es_personal()` responde «¿esta cuenta gestiona?». No la usa ninguna
-- política, pero la aplicación puede preguntarla por RPC y quedaría siendo el
-- único sitio del SQL que dice que un hermano con cargo no gestiona.
create or replace function auth_es_personal() returns boolean
  language sql stable security definer set search_path = public as $$
    select
      es_titular()
      or exists (select 1 from personal where auth_user_id = auth.uid() and activo)
      or exists (
        select 1 from hermanos
        where auth_user_id = auth.uid()
          and cargo is not null and cargo <> 'Hermano de a pie'
          and estado <> 'Baja'
      )
  $$;
grant execute on function auth_es_personal() to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Las políticas «propio»: que quien gestiona no pierda lo suyo
-- ----------------------------------------------------------------------------
--
-- Este es el efecto de segundo orden más caro del cambio, y el que no se ve
-- venir.
--
-- Al volverse `auth_es_hermano()` falso para el hermano con cargo, dejan de
-- aplicarle todas las políticas escritas como `auth_es_hermano() and lo mío`.
-- Casi todas quedan cubiertas por las de gestión, que abren más. Pero DOS no:
--
--   · `papeletas_propio_insert` — un Tesorero/a no tiene de fábrica el módulo
--     «papeletas», así que se quedaría sin poder sacar SU PROPIA papeleta.
--   · `cuotas_propio_aviso_pago` — ni podría avisar de que ha pagado la suya.
--
-- Y lo peor no es que falle: es que NO falla. Un insert bloqueado por RLS no
-- da error en Postgres, actualiza cero filas. La pantalla diría que todo ha ido
-- bien y la papeleta no existiría. Eso se descubre en la puerta de la iglesia
-- el Domingo de Ramos.
--
-- El arreglo es quitar el `auth_es_hermano()` de todas ellas y dejar solo la
-- comprobación de que la fila es suya. No abre nada de más: `hermano_propio_id()`
-- devuelve NULL para quien no tiene ficha, y `columna = NULL` no es cierto para
-- ninguna fila.

-- Su ficha del censo.
drop policy if exists "hermanos_propio_select" on hermanos;
create policy "hermanos_propio_select" on hermanos for select to authenticated
  using (auth_user_id = auth.uid());
-- El `cargo` y el `civil` de esta fila los protege el trigger de arriba, no
-- esta política: RLS no sabe de columnas.
drop policy if exists "hermanos_propio_update" on hermanos;
create policy "hermanos_propio_update" on hermanos for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Sus cuotas: verlas, y avisar de que ha pagado.
drop policy if exists "cuotas_propio_select" on cuotas;
create policy "cuotas_propio_select" on cuotas for select to authenticated
  using (hermano_id = hermano_propio_id());
drop policy if exists "cuotas_propio_aviso_pago" on cuotas;
create policy "cuotas_propio_aviso_pago" on cuotas for update to authenticated
  using (hermano_id = hermano_propio_id())
  with check (hermano_id = hermano_propio_id());

-- Su papeleta: verla, pedirla y renunciar a ella.
drop policy if exists "papeletas_propio_select" on papeletas;
create policy "papeletas_propio_select" on papeletas for select to authenticated
  using (hermano_id = hermano_propio_id());
drop policy if exists "papeletas_propio_insert" on papeletas;
create policy "papeletas_propio_insert" on papeletas for insert to authenticated
  with check (hermano_id = hermano_propio_id());
drop policy if exists "papeletas_propio_update" on papeletas;
create policy "papeletas_propio_update" on papeletas for update to authenticated
  using (hermano_id = hermano_propio_id())
  with check (hermano_id = hermano_propio_id());

-- Sus avisos.
drop policy if exists "avisos_propio_select" on avisos_hermano;
create policy "avisos_propio_select" on avisos_hermano for select to authenticated
  using (hermano_id = hermano_propio_id());
drop policy if exists "avisos_propio_leido" on avisos_hermano;
create policy "avisos_propio_leido" on avisos_hermano for update to authenticated
  using (hermano_id = hermano_propio_id())
  with check (hermano_id = hermano_propio_id());

-- Los suyos: los hijos menores de los que es tutor.
drop policy if exists "hermanos_a_mi_cargo_select" on hermanos;
create policy "hermanos_a_mi_cargo_select" on hermanos for select to authenticated
  using (tutor_id = hermano_propio_id());

-- Los tramos y la agenda: los ve cualquiera que haya entrado, con cargo o sin
-- él. `solo_mi_hermandad` ya se encarga de que sean los de su hermandad.
drop policy if exists "tramos_hermano_select" on tramos;
create policy "tramos_hermano_select" on tramos for select to authenticated
  using (true);
drop policy if exists "eventos_hermano_select" on eventos;
create policy "eventos_hermano_select" on eventos for select to authenticated
  using (true);


-- ----------------------------------------------------------------------------
-- 5. Borrar `authenticated_all`: el filtro por módulo estaba anulado
-- ----------------------------------------------------------------------------
--
-- Esto es un agujero que YA ESTABA, y que este cambio convierte en grave.
--
-- `hermano-auth.sql` crea sobre catorce tablas una política llamada
-- `authenticated_all` que dice solo `not auth_es_hermano()`: sin módulo, sin
-- nada. Y nadie la borra después. Las políticas PERMISSIVE de Postgres se
-- suman con O, así que basta con que una abra para que la fila pase.
--
-- Consecuencia: hasta hoy, cualquier cuenta de gestión escribía en las catorce
-- tablas por mucho que su cargo no tuviera el módulo. «El cargo decide qué
-- módulos ve» era cierto en el menú y falso en la base de datos. Con hermanos
-- llevando cargo, por ahí va a pasar mucha más gente.
--
-- Se borran. Lo que queda son las políticas `_staff_*` de `schema.sql`, que sí
-- exigen `modulo_permitido`.
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'hermandad_settings', 'tramos', 'movimientos', 'incidencias', 'enseres',
      'documentos', 'comunicados', 'cuentas_sociales', 'personal',
      'permisos_cargo', 'solicitudes_alta', 'conceptos_cuota',
      'opciones_papeleta', 'catalogos', 'hermanos', 'cuotas', 'papeletas'
    ])
  loop
    execute format('drop policy if exists "authenticated_all" on %I', t);
  end loop;
end $$;

-- Las tres hermanas de `authenticated_all`, del mismo archivo y con el mismo
-- problema: abren las tres tablas grandes sin mirar el módulo.
drop policy if exists "hermanos_personal_all" on hermanos;
drop policy if exists "cuotas_personal_all" on cuotas;
drop policy if exists "papeletas_personal_all" on papeletas;

-- Y las de gestión que sí miran el módulo, por si esta base se montó con una
-- versión antigua que no llegó a crearlas.
/*
 * LEER EL CENSO YA NO ES GRATIS, y esto es lo que más cambia de todo el
 * archivo para las hermandades que ya están funcionando.
 *
 * Hasta ahora, `hermanos_staff_select` era `not auth_es_hermano()` y nada más:
 * quien entrara al panel se llevaba el censo entero. El insert, el update y el
 * delete de al lado sí exigen el módulo; la lectura, no. Se quedó así de
 * cuando el panel lo abrían seis personas nombradas a dedo.
 *
 * Con los cargos en la ficha, «entrar al panel» deja de ser cosa de seis
 * personas nombradas a dedo: pasa a serlo de cualquiera a quien se le ponga un
 * cargo. Y a cualquiera de ellos le bastaba con escribir esto en la consola
 * del navegador, con la clave pública que viaja en el JavaScript de la web:
 *
 *     await supabase.from('hermanos').select('*')
 *
 * y bajarse las ochocientas filas con DNI, dirección, teléfono, IBAN, notas de
 * salud, fecha de nacimiento y parroquia de bautismo. Salud y convicciones
 * religiosas: categoría especial del RGPD por partida doble. El menú no le
 * enseñaba «Hermanos» y la aplicación le rebotaba a Inicio si tecleaba la
 * dirección, pero eso era pintura: la puerta de la base estaba abierta.
 *
 * Ahora hace falta uno de los módulos que de verdad necesitan el censo. No
 * solo «hermanos»: Cuotas necesita saber a quién es el recibo, Cortejo a quién
 * es el sitio, Papeletas a quién es la papeleta, e Informes imprime el padrón.
 *
 * LO QUE ESTO CAMBIA EN PANTALLA: nada, si la hermandad usa los cargos de
 * fábrica. Los SIETE de la junta llevan al menos uno de esos módulos —el
 * Fiscal y el Vocal entran por «informes», el Tesorero/a por «cuotas», el
 * Mayordomo/Prioste por «cortejo»— así que ninguno pierde nada.
 *
 * Solo cambia para un cargo al que se le hayan quitado a mano TODOS ellos y se
 * le hayan dejado únicamente módulos que no necesitan el censo (tesorería,
 * inventario, archivo, eventos, web o configuración). Ese caso es raro, y es
 * justo el que había que cerrar: no hay razón para que quien lleva el
 * inventario pueda descargarse ochocientos DNI.
 *
 * Hay una prueba (pruebas/cargos.prueba.mjs) que comprueba que ningún cargo de
 * fábrica se queda fuera, para que ampliar la lista de módulos de un cargo no
 * le corte el censo sin querer.
 */
drop policy if exists "hermanos_staff_select" on hermanos;
create policy "hermanos_staff_select" on hermanos for select to authenticated
  using (
    not auth_es_hermano()
    and (
      modulo_permitido('hermanos')
      or modulo_permitido('cuotas')
      or modulo_permitido('papeletas')
      or modulo_permitido('cortejo')
      or modulo_permitido('informes')
      or modulo_permitido('comunicados')
      -- «Personal y permisos» también: es la pantalla que enseña qué hermanos
      -- llevan cargo, y sin leer el censo saldría vacía.
      or modulo_permitido('personal')
    )
  );
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


-- ----------------------------------------------------------------------------
-- 5 bis. Las otras dos tablas que cualquiera podía leer
-- ----------------------------------------------------------------------------
--
-- Mismo problema que el censo, misma causa: las políticas de LECTURA de todas
-- las tablas de gestión son `not auth_es_hermano()` a secas. Solo la escritura
-- mira el módulo.
--
-- En la mayoría de las tablas eso es discutible pero no grave: un Vocal
-- leyendo la lista de enseres o los tramos del cortejo no rompe nada. En dos
-- sí lo es, y son justo las dos que guardan lo que una hermandad no enseña:
--
--   · `movimientos` — el libro de tesorería entero, ingresos y gastos con sus
--     conceptos. Lo que se cobra, lo que se paga y a quién.
--   · `documentos` — el archivo: actas de cabildo, contratos, expedientes.
--
-- Las escrituras ya pedían su módulo. Ahora la lectura también.
drop policy if exists "movimientos_staff_select" on movimientos;
create policy "movimientos_staff_select" on movimientos for select to authenticated
  using (not auth_es_hermano() and (modulo_permitido('tesoreria') or modulo_permitido('informes')));

drop policy if exists "documentos_staff_select" on documentos;
create policy "documentos_staff_select" on documentos for select to authenticated
  using (not auth_es_hermano() and modulo_permitido('archivo'));


-- ----------------------------------------------------------------------------
-- 6. Los permisos de fábrica, al día
-- ----------------------------------------------------------------------------
--
-- La aplicación y la base decían cosas distintas, y llevaban así desde que se
-- añadió el módulo de eventos. `PERMISOS_POR_DEFECTO` (src/lib/permisos.ts) da
-- al Hermano Mayor los TRECE módulos; la siembra de la base le daba once: le
-- faltaban «eventos» y «web».
--
-- El síntoma era de los peores: el menú enseña «Eventos y tareas», se entra, se
-- crea un culto, se le da a guardar, no se guarda y no hay ningún mensaje. La
-- política dice que no y la pantalla no se entera.
--
-- Esta siembra es ahora la copia exacta de PERMISOS_POR_DEFECTO. Si se cambia
-- una, hay que cambiar la otra; hay una prueba que lo comprueba
-- (pruebas/roles.prueba.mjs) para que no vuelva a separarse.
create or replace function sembrar_permisos_de_fabrica(p_hermandad_id uuid) returns void
  language sql security definer set search_path = public as $$
    insert into permisos_cargo (hermandad_id, cargo, modulo_id)
    select p_hermandad_id, cargo, modulo_id from (values
      ('Hermano Mayor','hermanos'),('Hermano Mayor','cortejo'),('Hermano Mayor','cuotas'),
      ('Hermano Mayor','papeletas'),('Hermano Mayor','tesoreria'),('Hermano Mayor','inventario'),
      ('Hermano Mayor','archivo'),('Hermano Mayor','eventos'),('Hermano Mayor','comunicados'),
      ('Hermano Mayor','informes'),('Hermano Mayor','web'),('Hermano Mayor','personal'),
      ('Hermano Mayor','configuracion'),
      ('Secretario/a','hermanos'),('Secretario/a','cortejo'),('Secretario/a','papeletas'),
      ('Secretario/a','archivo'),('Secretario/a','eventos'),('Secretario/a','comunicados'),
      ('Secretario/a','informes'),('Secretario/a','web'),
      ('Tesorero/a','tesoreria'),('Tesorero/a','cuotas'),('Tesorero/a','inventario'),
      ('Tesorero/a','informes'),
      ('Fiscal','archivo'),('Fiscal','informes'),
      ('Mayordomo/Prioste','cortejo'),('Mayordomo/Prioste','inventario'),
      ('Mayordomo/Prioste','eventos'),('Mayordomo/Prioste','informes'),
      ('Diputado/a Mayor de Gobierno','hermanos'),('Diputado/a Mayor de Gobierno','cortejo'),
      ('Diputado/a Mayor de Gobierno','papeletas'),('Diputado/a Mayor de Gobierno','eventos'),
      ('Diputado/a Mayor de Gobierno','informes'),
      ('Vocal','eventos'),('Vocal','comunicados'),('Vocal','informes')
    ) as f(cargo, modulo_id)
    on conflict do nothing
  $$;
revoke execute on function sembrar_permisos_de_fabrica(uuid) from public;
revoke execute on function sembrar_permisos_de_fabrica(uuid) from anon, authenticated;

-- 'Hermano de a pie' no se siembra a propósito: no tiene módulos. Ponérselo a
-- alguien sería darle una cuenta de panel que no ve nada.

-- Y se rellena lo que falte en las hermandades que ya existen. `on conflict do
-- nothing` dentro de la función: lo que cada hermandad haya cambiado a mano se
-- respeta, esto solo añade lo que nunca estuvo.
/*
 * Y se rellena SOLO en las hermandades que no han tocado nunca sus permisos.
 *
 * El `on conflict do nothing` de dentro no basta, y esto es importante:
 * `guardarPermisosPorCargoRemoto` guarda borrando las filas y reinsertando
 * solo lo marcado, así que un módulo DESMARCADO es una fila ausente —
 * exactamente igual que un módulo que nunca estuvo. La siembra no puede
 * distinguirlos.
 *
 * Sin esta comprobación, una hermandad que le hubiera quitado «cuotas» al
 * Tesorero/a a propósito se lo encontraría puesto otra vez cada vez que
 * alguien vuelve a ejecutar el SQL — y la cabecera promete que ejecutarlo dos
 * veces es seguro. Nadie recibiría ningún aviso.
 */
do $$
declare h uuid;
begin
  for h in select id from hermandades loop
    if not exists (select 1 from permisos_cargo where hermandad_id = h) then
      perform sembrar_permisos_de_fabrica(h);
    end if;
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 7. Aviso para quien venga después
-- ----------------------------------------------------------------------------
--
-- SECURITY DEFINER no se salta las políticas por sí solo. Funciona porque el
-- dueño de estas funciones (`postgres`) es también el dueño de las tablas, y el
-- dueño de una tabla está exento de sus políticas MIENTRAS no se active
-- `force row level security`.
--
-- Varias guías de endurecimiento de Supabase recomiendan activarlo. Si alguien
-- ejecuta `alter table hermanos force row level security`, TODAS estas
-- funciones entran en recursión infinita de golpe: `auth_es_hermano()` lee
-- `hermanos`, cuya política llama a `auth_es_hermano()`. Lo mismo con
-- `hermandad_actual()`, `hermano_propio_id()` y el `modulo_permitido()` de
-- aquí arriba.
--
-- Si hace falta activarlo algún día, hay que crear antes un rol propio para
-- estas funciones y darle `bypassrls`.

-- =============================================================================
--   SEGURIDAD-CLAVES-Y-REGISTRO.SQL — Fuera las contraseñas en claro; el registro lo escribe la base
-- =============================================================================

-- ============================================================================
--   LA DEUDA DE SEGURIDAD: contraseñas y registro de actividad
-- ============================================================================
--
-- Tres cosas que llevaban ahí desde antes de los cargos y que había que
-- cerrar antes de que entren datos de una hermandad de verdad. Ochocientos DNI
-- con IBAN y notas de salud es categoría especial del RGPD por partida doble.
--
-- ----------------------------------------------------------------------------
-- 1. LA CONTRASEÑA EN CLARO
-- ----------------------------------------------------------------------------
--
-- `hermanos.clave_acceso` guardaba la contraseña del hermano TAL CUAL, en
-- texto, dentro de la tabla. Y encima la ficha la imprimía en pantalla.
--
-- Eso no hacía falta para nada: la contraseña de verdad vive en Supabase Auth,
-- cifrada, y es la que comprueba `signInWithPassword`. Esta columna era una
-- copia en claro que solo servía para el modo demostración —donde no hay base
-- de datos— y que en producción era un regalo para cualquiera que pudiera leer
-- el censo.
--
-- Agravante: la contraseña inicial de un hermano ERA SU PROPIO DNI, y el DNI
-- está en su ficha. O sea que quien pudiera leer el censo podía entrar como
-- cualquier hermano que no la hubiera cambiado — y nadie le obligaba.
--
-- QUÉ SE HACE AQUÍ. La columna NO se borra: se vacía y se deja opcional.
--
-- Borrarla parece más limpio y es peor. Si se borra y alguien todavía tiene
-- abierta la versión anterior de la web, cada guardado de una ficha fallaría
-- con «column clave_acceso does not exist». Y al revés: si se dejara `not
-- null` sin valor por defecto, la versión NUEVA —que ya no la manda— fallaría
-- con «null value violates not-null constraint».
--
-- Dejándola vacía, opcional y con valor por defecto, funcionan LAS DOS
-- versiones mientras dure el cambio, y las contraseñas desaparecen igual.
-- Cuando esté todo actualizado se puede borrar de verdad, y hay una línea
-- preparada al final para eso.
alter table hermanos alter column clave_acceso drop not null;
alter table hermanos alter column clave_acceso set default '';
update hermanos set clave_acceso = '' where clave_acceso <> '';

comment on column hermanos.clave_acceso is
  'SIN USO. Guardaba la contraseña en claro; se vació por seguridad. La contraseña '
  'de verdad vive en Supabase Auth y no la lee nadie. Esta columna solo sigue aquí '
  'para que la versión anterior de la aplicación no falle al guardar mientras dure '
  'el cambio; se puede borrar con `alter table hermanos drop column clave_acceso`.';

-- Lo mismo en `personal`, que tenía la suya.
alter table personal alter column clave drop not null;
alter table personal alter column clave set default '';
update personal set clave = '' where clave <> '';

comment on column personal.clave is
  'SIN USO, igual que hermanos.clave_acceso: guardaba la contraseña en claro y se '
  'vació. La de verdad vive en Supabase Auth.';


-- ----------------------------------------------------------------------------
-- 2. EL REGISTRO DE ACTIVIDAD LO ESCRIBÍA EL NAVEGADOR
-- ----------------------------------------------------------------------------
--
-- `registro_actividad` es lo que contesta «¿quién dio de baja a este hermano y
-- cuándo?» en un cabildo. Y lo escribía la APLICACIÓN, mandando el nombre del
-- autor y la frase como texto libre.
--
-- Dos agujeros:
--
--   · Un cambio hecho por fuera de la aplicación —desde la consola del
--     navegador, o con la clave pública que viaja en el JavaScript— no dejaba
--     ningún rastro. El registro decía la verdad solo mientras todo el mundo
--     usara la puerta.
--   · Y como la fila la componía el cliente, quien tuviera cargo podía meter
--     lo que quisiera: un apunte con el nombre de otro. Y el propio fichero
--     presume de que no se puede modificar ni borrar, así que esa mentira se
--     quedaba para siempre.
--
-- QUÉ SE HACE. Un disparador en las tablas que importan, que apunta el cambio
-- DESDE DENTRO de la base con `auth.uid()`. Ese identificador lo pone el
-- servidor al validar el token: no se puede falsificar desde el navegador.
--
-- Los apuntes automáticos se marcan con `origen = 'base'` para distinguirlos
-- de los que sigue escribiendo la aplicación, que son más explicativos («le
-- cambió el IBAN») y siguen valiendo.
alter table registro_actividad add column if not exists origen text not null default 'app';

comment on column registro_actividad.origen is
  '«base» si lo escribió un disparador de Postgres (no se puede falsificar: el autor '
  'sale de auth.uid()); «app» si lo escribió la aplicación, que es más explicativa '
  'pero se fía de lo que le mande el navegador.';

/**
 * Quién está haciendo esto, con el nombre que tenga ahora.
 *
 * SECURITY DEFINER porque tiene que mirar `titulares`, `personal` y `hermanos`
 * saltándose las políticas: si no, un hermano no podría ni saber su propio
 * nombre para el apunte.
 */
create or replace function quien_soy_ahora() returns text
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select 'Titular' from titulares where auth_user_id = auth.uid() limit 1),
    (select p.nombre from personal p where p.auth_user_id = auth.uid() limit 1),
    (select h.nombre from hermanos h where h.auth_user_id = auth.uid() limit 1),
    'Sistema'
  )
$$;
grant execute on function quien_soy_ahora() to authenticated;

create or replace function apuntar_cambio() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  que text;
  sobre text;
  quien uuid;
  -- La fila, en JSON. Es la clave de que esto funcione en las cuatro tablas.
  --
  -- Escrito como `new.nombre`, PL/pgSQL revienta en las tablas que no tienen
  -- esa columna —papeletas, cuotas, movimientos— con «record "new" has no
  -- field "nombre"». Y no revienta al crear el disparador, sino al guardar la
  -- primera fila: el SQL se instala sin una queja y lo que deja de funcionar
  -- es emitir papeletas, cobrar cuotas y apuntar en tesorería.
  --
  -- Con `->>` no hay tal cosa: la columna que no existe vale NULL y ya está.
  fila jsonb;
begin
  quien := auth.uid();
  -- Sin sesión es el editor SQL o una función interna. Se apunta igual, pero
  -- sin autor: es información, no una acusación.
  que := lower(tg_argv[0]) || '_' || lower(tg_op);
  fila := to_jsonb(case tg_op when 'DELETE' then old else new end);
  -- Cómo se llama la fila, según lo que tenga cada tabla: el censo tiene
  -- `nombre`; una cuota o un apunte, `concepto`; una papeleta, su número.
  sobre := coalesce(
    fila->>'nombre',
    fila->>'concepto',
    fila->>'titulo',
    nullif(fila->>'numero', ''),
    ''
  );

  insert into registro_actividad
    (hermandad_id, autor_id, autor_nombre, accion, sobre_tipo, sobre_id, sobre_nombre, detalle, origen)
  values (
    coalesce((fila->>'hermandad_id')::uuid, hermandad_actual()),
    quien,
    quien_soy_ahora(),
    que,
    tg_argv[0],
    fila->>'id',
    sobre,
    case tg_op
      when 'INSERT' then 'Creado desde la base de datos'
      when 'DELETE' then 'Borrado'
      else 'Modificado'
    end,
    'base'
  );
  return case tg_op when 'DELETE' then old else new end;
end $$;

comment on function apuntar_cambio() is
  'Apunta en registro_actividad quién ha tocado una fila, con auth.uid() como autor. '
  'Lo pone el servidor al validar el token, así que no se puede falsificar desde el '
  'navegador — que es justo lo que sí se podía con los apuntes que manda la aplicación.';

/*
 * Se pone SOLO en las tablas que se preguntan en un cabildo: el censo, el
 * dinero y las papeletas. Ponerlo en todas llenaría la tabla de ruido —cada
 * tecla del editor de la web sería un apunte— y el registro dejaría de servir
 * para lo que sirve, que es encontrar una cosa concreta.
 */
do $$
declare t text;
begin
  foreach t in array array['hermanos', 'cuotas', 'papeletas', 'movimientos'] loop
    execute format('drop trigger if exists apuntar_%s on %I', t, t);
    execute format(
      'create trigger apuntar_%s after insert or update or delete on %I
         for each row execute function apuntar_cambio(%L)', t, t, t
    );
  end loop;
end $$;

-- Y que nadie pueda borrar ni cambiar lo apuntado. Ya no había políticas de
-- update ni de delete —lo que en Postgres significa que no se puede— pero
-- conviene dejarlo escrito para quien venga después.
comment on table registro_actividad is
  'Solo se AÑADE. No hay política de update ni de delete a propósito: en Postgres, '
  'sin política no se puede. Ni el titular puede reescribir la historia.';


-- ----------------------------------------------------------------------------
-- 3. PARA CUANDO TODO ESTÉ ACTUALIZADO
-- ----------------------------------------------------------------------------
--
-- Cuando lleve unos días funcionando y nadie tenga abierta la versión
-- anterior, se pueden borrar del todo las dos columnas. NO va descomentado: se
-- ejecuta a mano y a conciencia, porque no tiene vuelta atrás.
--
--   alter table hermanos drop column if exists clave_acceso;
--   alter table personal drop column if exists clave;

-- =============================================================================
--   PAPELETAS-SIMBOLICA-Y-PRECIO.SQL — El precio de la papeleta y la simbólica: de la hermandad, no del navegador
-- =============================================================================

-- =============================================================================
--   LA PAPELETA SIMBÓLICA, Y EL PRECIO DE LA PAPELETA
-- =============================================================================
--
-- DOS COSAS, Y LAS DOS SON DE LA HERMANDAD, NO DEL NAVEGADOR.
--
-- 1. EL PRECIO GENERAL DE LA PAPELETA se guardaba SOLO en el navegador de quien
--    lo escribía (`localStorage`). El tesorero ponía 18 € en su ordenador y la
--    secretaria, desde el suyo, seguía viendo el que trae la aplicación de
--    fábrica — y emitía las papeletas de todo el año a ese precio. No fallaba
--    nada, no avisaba nada: simplemente cada uno cobraba una cosa.
--
-- 2. LA PAPELETA SIMBÓLICA es la de quien TIENE derecho a su sitio y ese año no
--    quiere salir. Es una sola y se llama así: si alguien quiere salir, sitio
--    hay. Todo lo que camina —una mantilla, un nazareno de cirio— es un TRAMO
--    del cortejo, con su aforo, su precio y su hora de citación, y no tiene
--    nada que hacer en otra lista.
--
-- QUÉ SE VA. La tabla `opciones_papeleta` (la lista de «papeletas
-- personalizadas») deja de usarse: era un tramo pobre, con su propio nombre y
-- su propio precio, y hacía que dos hermanos del mismo tramo pudieran pagar
-- distinto según por qué puerta hubieran entrado.
--
-- No se borra aquí. Borrarla dejaría fuera de servicio a la versión de la
-- aplicación que esté subida en ese momento, que sí la lee. Cuando lleves unos
-- días con la versión nueva, se puede quitar con:
--
--     drop table if exists opciones_papeleta;
--
-- Las papeletas ya emitidas no se tocan: `papeletas.opcion` guarda el nombre
-- con el que se emitieron y sigue siendo historia válida.

alter table hermandad_settings
  add column if not exists precio_papeleta numeric(10, 2) not null default 18;

alter table hermandad_settings
  add column if not exists precio_simbolica numeric(10, 2) not null default 5;

comment on column hermandad_settings.precio_papeleta is
  'Precio de la papeleta cuando el tramo no fija el suyo propio. Antes vivía en '
  'el localStorage de un navegador, así que cada persona emitía a un precio.';

comment on column hermandad_settings.precio_simbolica is
  'Precio de la papeleta simbólica: la de quien tiene derecho a su sitio y ese '
  'año no sale. No ocupa puesto en el cortejo.';
