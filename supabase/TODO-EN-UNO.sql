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
--   27. buscar-hermandad-con-su-escudo.sql Que el hermano encuentre su hermandad por ciudad y la reconozca por su escudo
--   28. redes-sociales.sql         Que cada hermandad tenga sus propias redes (la clave era global)
--   29. clave-de-catalogos.sql     Que cada hermandad tenga sus propios catálogos (la clave era global)
--   30. motivo-del-rechazo.sql     Por qué se rechazó un alta, para poder decírselo a quien la pidió
--   31. imagenes.sql               El almacén de fotos: que la web no lleve las imágenes dentro
--   32. visitas-web.sql            El contador de visitas de la web, sin cookies ni Google Analytics
--   33. suscriptores-web.sql       Avisos por correo para quien sigue a la hermandad sin ser hermano
--   34. copias.sql                 Las copias de seguridad, guardadas solas cada semana
--   35. permisos-eventos-y-web.sql Los dos módulos que nunca se sembraron: «eventos» y «web»
--   36. lo-que-toca-el-hermano.sql Que el hermano no se ponga la cuota como pagada desde la consola
--   37. sin-contrasenas-en-las-solicitudes.sql Fuera la contraseña en claro que guardaba cada solicitud de alta
--   38. freno-de-los-formularios.sql Un tope a lo que cualquiera puede meter desde la web pública
--   39. cuenta-por-hermandad.sql   Ser hermano de dos hermandades: una cuenta por hermandad + DNI
--   40. solicitudes-de-papeleta.sql Que la solicitud de papeleta del hermano llegue a la hermandad
--   41. activar-la-suscripcion.sql Que el botón de activar la suscripción llegue a la base
--   42. numero-de-recibo-unico.sql Que no pueda haber dos recibos con el mismo número
--   43. borrar-una-hermandad.sql   Que una hermandad se pueda borrar (el registro lo impedía)
--   44. documentos-restringidos.sql Que el documento restringido lo sea también en la base
--   45. webhook-stripe.sql         Que la suscripción se active cuando Stripe confirma el cobro, no antes
--   46. mandatos-sepa.sql          El mandato SEPA firmado de verdad, por el propio hermano
--   47. encargos-redes.sql         Encargar un post y que se reparta solo entre la junta
--   48. tienda.sql                 La tienda: productos, ventas, stock y los asientos que generan
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
--
-- SIN SEMILLA, y esto es un arreglo, no un olvido.
--
-- Aquí había un `insert` con las cinco redes. Esas filas entran SIN
-- `hermandad_id`, y la frontera de seguridad dice `hermandad_id =
-- hermandad_actual()`: comparar con null nunca es cierto, así que esas cinco
-- filas no las veía NADIE. Estaban en la tabla, ocupaban la clave primaria que
-- las hermandades de verdad necesitaban, y eran invisibles. De ahí el «0 de 0»
-- de la pantalla de comunicados.
--
-- Las cinco redes salen del programa (`src/lib/redesSociales.ts`), que es donde
-- tienen que estar: Facebook existe aunque la hermandad no lo haya conectado.
-- La fila se crea sola la primera vez que se conecta una.
--
-- Ver `supabase/redes-sociales.sql`, que además cambia la clave a
-- (hermandad_id, red) — con la clave global de antes solo la primera hermandad
-- de toda la base podía tener su Facebook.

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
      -- ESTA LISTA TIENE QUE SER LA MISMA que `PERMISOS_POR_DEFECTO` de
      -- `src/lib/permisos.ts`. Son dos copias de lo mismo en dos idiomas, y una
      -- prueba las compara para que no se vuelvan a despegar.
      --
      -- Se despegaron: faltaban «eventos» en cinco cargos y «web» en dos, y el
      -- Hermano Mayor —que lo puede todo por definición— se quedaba sin poder
      -- guardar un evento ni tocar la web. La pantalla se lo ofrecía; la base
      -- lo rechazaba.
      ('Hermano Mayor','hermanos'),('Hermano Mayor','cortejo'),('Hermano Mayor','cuotas'),
      ('Hermano Mayor','papeletas'),('Hermano Mayor','tesoreria'),('Hermano Mayor','inventario'),
      ('Hermano Mayor','archivo'),('Hermano Mayor','eventos'),('Hermano Mayor','comunicados'),
      ('Hermano Mayor','informes'),('Hermano Mayor','web'),
      ('Hermano Mayor','personal'),('Hermano Mayor','configuracion'),
      ('Secretario/a','hermanos'),('Secretario/a','cortejo'),('Secretario/a','papeletas'),
      ('Secretario/a','archivo'),('Secretario/a','eventos'),('Secretario/a','comunicados'),
      ('Secretario/a','informes'),('Secretario/a','web'),
      ('Tesorero/a','tesoreria'),('Tesorero/a','cuotas'),('Tesorero/a','inventario'),('Tesorero/a','informes'),
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

-- Las hermandades que ya existen se quedaron sin permisos al borrar los de
-- fábrica ahí arriba. Se les siembran los suyos.
do $$
declare h uuid;
begin
  for h in select id from hermandades loop
    perform sembrar_permisos_de_fabrica(h);
  end loop;
end $$;

-- Los dos módulos que nunca se sembraron —«eventos» y «web»— se arreglan en
-- `permisos-eventos-y-web.sql`, que va aparte porque ese sí se puede ejecutar
-- suelto sobre una base al día: no redefine ninguna función.

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
-- 3. LA CAMPAÑA DE PAPELETAS: el año de la estación de penitencia y las tres
--    fechas del plazo (cuándo abren los que salieron el año pasado, cuándo los
--    demás, y cuándo se cierra).
--
--    Esta es la peor de las tres, porque no se queda en una pantalla: la lee
--    el ÁREA DEL HERMANO. La secretaría abría la campaña de 2026 en su
--    ordenador y el hermano, desde el móvil, veía la de fábrica —año 2027, con
--    su plazo y su fecha de salida— y pedía sitio para una Semana Santa que no
--    tocaba. Ninguno de los dos veía nada raro.
--
--    Y de aquí sale también qué papeletas cuentan como «del año», que es lo
--    que ordena el cortejo, los roles y los comunicados por tramo.
--
-- 4. LOS CAMPOS PROPIOS DE LA FICHA (talla de túnica, número de llave, si
--    tiene el carné de costalero al día…).
--
--    Los define cada hermandad, pero el VALOR de cada uno se guarda dentro de
--    la ficha del hermano, que sí va a la base. O sea que el dato viajaba y la
--    definición no: desde otro ordenador, la talla estaba guardada y no se
--    veía por ninguna parte, porque el campo «talla» no existía allí.
--
-- Las cuatro van como `jsonb` en `hermandad_settings`, igual que las plantillas.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table hermandad_settings add column if not exists ajustes_cuotas jsonb;
alter table hermandad_settings add column if not exists etiquetas jsonb;
alter table hermandad_settings add column if not exists campana jsonb;
alter table hermandad_settings add column if not exists campos_propios jsonb;

comment on column hermandad_settings.campana is
  'La campaña de papeletas: el año de la estación de penitencia y las fechas del '
  'plazo. Vivía en localStorage, así que el área del hermano enseñaba la campaña de '
  'fábrica —otro año y otro plazo— en vez de la que había abierto la secretaría.';

comment on column hermandad_settings.campos_propios is
  'Los campos a medida de la ficha del hermano (talla de túnica, número de llave…). '
  'El valor de cada uno ya iba dentro de la ficha; la definición se quedaba en el '
  'navegador, así que desde otro ordenador el dato estaba guardado y no se veía.';

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

-- =============================================================================
--   BUSCAR-HERMANDAD-CON-SU-ESCUDO.SQL — Que el hermano encuentre su hermandad por ciudad y la reconozca por su escudo
-- =============================================================================

-- =============================================================================
--   QUE EL HERMANO ENCUENTRE SU HERMANDAD, Y LA RECONOZCA
-- =============================================================================
--
-- Dos cosas que faltaban en la pantalla donde el hermano elige su hermandad:
--
-- 1. LA CIUDAD. La pantalla dice «escribe el nombre o la ciudad», y la ciudad
--    no viajaba: llegaba siempre vacía, así que buscar por ciudad NUNCA
--    encontraba nada. Pedirle a alguien que busque por un dato que no existe es
--    peor que no ofrecerlo.
--
-- 2. Ya viajaba el logo (lo añadió `colores-hermandad.sql`), pero conviene
--    dejarlo aquí junto a lo demás para que se lea de un tirón lo que esta
--    función enseña y lo que no.
--
-- QUÉ **NO** SALE, Y ES A PROPÓSITO. Esta función la puede llamar cualquiera
-- sin haber iniciado sesión —tiene que poder, es la pantalla de entrar—, así
-- que devuelve SOLO lo que es público: cómo se llama la hermandad, de dónde es,
-- sus colores y su escudo. Ni el IBAN, ni el CIF, ni el teléfono, ni el correo,
-- que están en la misma tabla y no son de nadie más.

drop function if exists hermandades_publicas();

create or replace function hermandades_publicas()
returns table (
  id uuid,
  nombre text,
  ciudad text,
  color_primario text,
  color_secundario text,
  logo_data_url text
)
language sql stable security definer set search_path = public as $$
  select
    h.id,
    h.nombre,
    coalesce(s.ciudad, ''),
    -- Los de fábrica si esa hermandad todavía no ha puesto los suyos, para que
    -- la pantalla nunca se quede sin color.
    coalesce(nullif(s.color_primario, ''), '#6A1A23'),
    coalesce(nullif(s.color_secundario, ''), '#C5A059'),
    s.logo_data_url
  from hermandades h
  left join hermandad_settings s on s.hermandad_id = h.id
  where h.activa
  order by h.nombre
$$;

grant execute on function hermandades_publicas() to anon, authenticated;

comment on function hermandades_publicas() is
  'La lista de hermandades para la pantalla de entrar. Solo datos públicos: '
  'nombre, ciudad, colores y escudo. Nunca IBAN, CIF, teléfono ni correo.';

-- =============================================================================
--   REDES-SOCIALES.SQL — Que cada hermandad tenga sus propias redes (la clave era global)
-- =============================================================================

-- =============================================================================
--   REDES-SOCIALES.SQL — Que cada hermandad tenga sus propias cuentas
-- =============================================================================
--
-- EL FALLO QUE ARREGLA, y era el módulo entero: la tarjeta «Redes sociales
-- conectadas» decía **0 de 0** y no salía ni una red. Ni conectadas ni sin
-- conectar: ninguna. Con datos de ejemplo salían las cinco, así que se leía
-- como «esto solo funciona en la demostración».
--
-- Son dos cosas, y las dos están aquí:
--
--   1) La tabla nació con `red text primary key`. Esa clave es GLOBAL. Al
--      pasar a varias hermandades se le añadió `hermandad_id` como a todas las
--      demás, pero la clave se quedó igual — a diferencia del DNI del hermano
--      o del número de hermano, que sí se arreglaron en su día.
--
--      O sea que en toda la base de datos solo puede haber UNA fila
--      «Facebook». La primera hermandad que la escribiera se la quedaba, y
--      todas las demás se estrellaban contra la clave primaria al intentar
--      guardar la suya. No es que fuera lento ni que fallara a veces: la
--      segunda hermandad no podía tener redes sociales.
--
--   2) La semilla de `schema.sql` mete las cinco filas SIN hermandad:
--
--          insert into cuentas_sociales (red) values ('Facebook'), ...
--
--      Esa fila tiene `hermandad_id` a null, y la frontera de seguridad dice
--      `hermandad_id = hermandad_actual()`. Comparar cualquier cosa con null
--      nunca es cierto, así que esas cinco filas no las ve NADIE. Están en la
--      tabla, ocupan la clave primaria que las demás necesitan, y son
--      invisibles.
--
--      Ahí está el «0 de 0» exacto: la consulta no falla, devuelve cero filas.
--
-- Se puede ejecutar sobre una base ya en uso. No borra ninguna cuenta de
-- ninguna hermandad: lo único que borra son las filas huérfanas de la semilla,
-- que por definición no son de nadie y nadie podía ver.

-- 1. La columna y su valor por defecto (por si esta base es anterior).
alter table cuentas_sociales add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table cuentas_sociales alter column hermandad_id set default hermandad_actual();

-- 2. Fuera las cinco filas huérfanas de la semilla. Son las que bloquean la
--    clave primaria, y no tienen dueño: nadie las ha visto nunca.
delete from cuentas_sociales where hermandad_id is null;

-- 3. La clave, por hermandad y no global. Cada una tiene su Facebook.
alter table cuentas_sociales drop constraint if exists cuentas_sociales_pkey;
create unique index if not exists cuentas_sociales_por_hermandad
  on cuentas_sociales (hermandad_id, red);

-- 4. El enlace público, que antes no se guardaba en ninguna parte.
--
--    Hacía falta para dos cosas distintas: para poner los iconos en el pie de
--    la web de la hermandad, y para que el botón de «abrir para publicar»
--    lleve a SU página y no a la portada de Facebook.
alter table cuentas_sociales add column if not exists enlace text;

comment on table cuentas_sociales is
  'Las redes de cada hermandad. La clave es (hermandad_id, red): con la clave '
  'global de antes, solo la primera hermandad podía guardar las suyas. Las filas '
  'sin hermandad_id no las ve nadie (la política las filtra) — no las vuelvas a '
  'sembrar sin hermandad.';

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Después de ejecutarlo, esto tiene que devolver una fila por cada red que
-- hayas conectado, y ninguna sin hermandad:
--
--   select red, conectada, usuario, enlace, hermandad_id is null as huerfana
--     from cuentas_sociales order by red;
--
-- Si sale vacío, es lo normal: las cinco redes salen igualmente en pantalla
-- (son un catálogo fijo de la aplicación, no datos), y la fila se crea sola la
-- primera vez que conectas una.

-- =============================================================================
--   CLAVE-DE-CATALOGOS.SQL — Que cada hermandad tenga sus propios catálogos (la clave era global)
-- =============================================================================

-- =============================================================================
--   CLAVE-DE-CATALOGOS.SQL — Que cada hermandad tenga sus propios catálogos
-- =============================================================================
--
-- EL MISMO FALLO QUE `redes-sociales.sql`, en la otra tabla que se quedó
-- fuera. Y aquí es peor, porque `catalogos` se toca mucho más.
--
-- La tabla nació con `primary key (clave, valor)`. Esa clave es GLOBAL. Al
-- pasar a varias hermandades se le añadió `hermandad_id` como a todas las
-- demás, pero la clave se quedó igual — a diferencia del DNI del hermano, del
-- número de hermano, de los ajustes, de la web y de las redes, que sí se
-- arreglaron en su día.
--
-- LO QUE HAY EN ESA TABLA son las listas que configura cada hermandad en
-- Configuración: las categorías de ingreso y de gasto, las cuentas de
-- tesorería, los tipos de incidencia, las categorías del inventario, los
-- canales y los segmentos de los comunicados.
--
-- Y son las MENOS DISTINTIVAS QUE HAY. «Cera», «Flores», «Limosnas»,
-- «Caja», «Bueno», «Restaurado»: las escribe igual todo el mundo, porque son
-- las palabras de siempre de una hermandad. O sea que la SEGUNDA hermandad que
-- entrara no podía guardar prácticamente ninguna de las suyas: la fila ya
-- existía, de otra gente, y el guardado se estrellaba contra una clave
-- duplicada.
--
-- No es un caso raro que aparezca con el tiempo. Aparece con la hermandad
-- número dos y con el primer valor obvio que escriba.
--
-- Y encima no se ve venir: por la frontera de seguridad
-- (`hermandad_id = hermandad_actual()`), la fila que estorba es de otra
-- hermandad y por tanto INVISIBLE. En pantalla no hay nada repetido, y aun así
-- no se puede guardar.
--
-- Se puede ejecutar sobre una base ya en uso. No borra ningún catálogo de
-- ninguna hermandad.

-- 1. La columna y su valor por defecto (por si esta base es anterior).
alter table catalogos add column if not exists hermandad_id uuid references hermandades(id) on delete cascade;
alter table catalogos alter column hermandad_id set default hermandad_actual();

-- 2. La clave, por hermandad y no global.
--
--    En dos pasos y con aviso en vez de romper: una clave primaria no admite
--    nulos, así que primero se le busca dueño a lo que hubiera suelto de antes
--    de multi-hermandad —se le da a la primera hermandad, que es de quien era—
--    y solo si no queda nada huérfano se cambia la clave. Si quedara algo, se
--    deja como estaba y se avisa: es preferible eso a que la instalación se
--    pare a la mitad y todo lo que va detrás no llegue a crearse.
do $$
declare v_huerfanos int;
begin
  update catalogos set hermandad_id = (select id from hermandades order by creada_en limit 1)
   where hermandad_id is null;

  select count(*) into v_huerfanos from catalogos where hermandad_id is null;
  if v_huerfanos > 0 then
    -- Pasa si la base no tiene ninguna hermandad todavía. Entonces tampoco hay
    -- catálogos de nadie que arreglar, y esto se vuelve a ejecutar solo con
    -- correr el archivo otra vez después de crear la primera.
    raise warning 'catalogos: quedan % filas sin hermandad; la clave primaria se deja como estaba', v_huerfanos;
    return;
  end if;

  alter table catalogos alter column hermandad_id set not null;
  alter table catalogos drop constraint if exists catalogos_pkey;
  alter table catalogos add constraint catalogos_pkey primary key (hermandad_id, clave, valor);
end $$;

comment on table catalogos is
  'Las listas que configura cada hermandad (categorías, cuentas, tipos…). La '
  'clave es (hermandad_id, clave, valor): con la clave global de antes, la '
  'segunda hermandad no podía guardar ni «Cera», porque la fila ya era de otra '
  'y encima no la veía.';

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Después de ejecutarlo, esto tiene que decir «hermandad_id, clave, valor»:
--
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'catalogos'::regclass and contype = 'p';
--
-- Si sigue diciendo solo «clave, valor», es que quedaban filas sin hermandad:
-- míralas con
--
--   select * from catalogos where hermandad_id is null;
--
-- y vuelve a ejecutar este archivo cuando estén asignadas.

-- =============================================================================
--   MOTIVO-DEL-RECHAZO.SQL — Por qué se rechazó un alta, para poder decírselo a quien la pidió
-- =============================================================================

-- =============================================================================
--
--   POR QUÉ SE RECHAZÓ UNA SOLICITUD DE ALTA
--
-- =============================================================================
--
-- Llegó dicho así: «que si se acepta se quede guardado en el portal del
-- hermano como familiar en el apartado mi familia, que se ponga aprobado o
-- rechazado; si es rechazado, un porqué».
--
-- La tabla guardaba el estado —Pendiente, Aprobada, Rechazada— y nada más. Un
-- «Rechazada» a secas no se le puede enseñar a nadie: la persona sabe que le
-- han dicho que no y no sabe si es un error suyo que puede corregir (un DNI
-- mal escrito) o una decisión de la hermandad. Así que llamaba a preguntar,
-- que es justo la llamada que el área del hermano venía a ahorrar.
--
-- Dos columnas:
--   · `motivo_rechazo`  lo que escribe secretaría al rechazar;
--   · `resuelta_el`     cuándo se resolvió, para poder decir «el 4 de marzo».
--
-- Es seguro volver a ejecutarlo.
-- =============================================================================

alter table solicitudes_alta add column if not exists motivo_rechazo text;
alter table solicitudes_alta add column if not exists resuelta_el date;

-- Y QUE EL TUTOR PUEDA SEGUIR VIÉNDOLA DESPUÉS DE RESUELTA.
--
-- Esto es lo que de verdad estaba roto, y no se ve mirando la tabla. La
-- política de lectura del área del hermano ya dejaba ver las solicitudes que
-- él ha mandado, así que la parte del permiso estaba bien; lo que fallaba es
-- que la aplicación solo pintaba las PENDIENTES. Se arregla en la pantalla,
-- pero se deja escrita aquí la política —sin cambios— para que quede claro que
-- el hermano tiene derecho a leer también las suyas ya resueltas: si algún día
-- alguien la endurece, que sepa que la de «Mi familia» depende de ella.
drop policy if exists "solicitudes_de_mi_familia_select" on solicitudes_alta;
create policy "solicitudes_de_mi_familia_select" on solicitudes_alta for select to authenticated
  using (auth_es_hermano() and tutor_id = hermano_propio_id());

-- =============================================================================
--   IMAGENES.SQL — El almacén de fotos: que la web no lleve las imágenes dentro
-- =============================================================================

-- ============================================================================
-- EL ALMACÉN DE IMÁGENES
--
-- Hasta ahora las fotos de la web viajaban DENTRO del contenido, escritas como
-- texto (`data:image/webp;base64,...`). Funciona, pero tiene tres techos:
--
--   1. La web entera es una sola fila de la tabla `web_publica`. Veinte fotos
--      de una salida y esa fila pesa quince megas: cada guardado los sube
--      enteros otra vez, y cada visita los descarga enteros aunque no cambie
--      ni una coma.
--   2. El navegador no puede guardar en caché una foto que va dentro del HTML.
--      La misma imagen se descarga en cada página.
--   3. Y lo que bloqueaba de verdad: WhatsApp, Facebook y X NO leen una
--      imagen en `data:`. Por eso al pegar el enlace de la hermandad salía la
--      tarjeta sin foto. Para que salga tiene que haber una dirección de
--      verdad, y para eso hace falta esto.
--
-- Ejecútalo UNA VEZ en el SQL Editor de tu proyecto, después de
-- `multi-hermandad.sql` (de ahí sale `hermandad_actual()`).
--
-- CADA HERMANDAD, EN SU CARPETA. Todas comparten el mismo cubo, así que lo
-- primero de la ruta es el id de la hermandad:
--
--     imagenes/6f3a…-e21b/web/9c1d…-4a7f.webp
--
-- No es orden: es la seguridad. Las políticas de abajo miran esa primera
-- carpeta para decidir quién puede escribir. Una foto subida fuera de ella la
-- rechaza el propio Storage.
--
-- POR QUÉ EL CUBO ES PÚBLICO. Lo que hay dentro son las fotos de la web de la
-- hermandad: están puestas para que las vea todo el mundo, y la tarjeta de
-- WhatsApp no funciona de otra manera. Las fotos del CENSO también viven aquí,
-- bajo `hermanos/`, con un nombre aleatorio de 128 bits que no aparece en
-- ninguna página pública. La alternativa —cubo privado y direcciones firmadas—
-- obligaría a resolver cada foto con una llamada al servidor antes de
-- pintarla, caduca a las horas y rompe el carné impreso. Si algún día una
-- hermandad necesita lo otro, el sitio donde se cambia es este archivo y
-- `src/lib/almacenImagenes.ts`, no las cincuenta pantallas que enseñan fotos.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('imagenes', 'imagenes', true)
on conflict (id) do update set public = true;

-- LEER: cualquiera. Es una web pública; el cubo lo sirve sin pasar por aquí,
-- pero la política se deja escrita para que no dependa de una casilla del
-- panel de Supabase que alguien puede desmarcar sin querer.
drop policy if exists "imagenes_leer" on storage.objects;
create policy "imagenes_leer" on storage.objects
  for select
  to public
  using (bucket_id = 'imagenes');

-- ESCRIBIR: solo con sesión iniciada, y solo dentro de la carpeta de tu
-- hermandad. Es lo que impide que una hermandad pise las fotos de otra.
drop policy if exists "imagenes_subir" on storage.objects;
create policy "imagenes_subir" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = hermandad_actual()::text
  );

drop policy if exists "imagenes_actualizar" on storage.objects;
create policy "imagenes_actualizar" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = hermandad_actual()::text
  )
  with check (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = hermandad_actual()::text
  );

drop policy if exists "imagenes_borrar" on storage.objects;
create policy "imagenes_borrar" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = hermandad_actual()::text
  );

-- =============================================================================
--   VISITAS-WEB.SQL — El contador de visitas de la web, sin cookies ni Google Analytics
-- =============================================================================

-- =============================================================================
--   EL CONTADOR DE VISITAS DE LA WEB
-- =============================================================================
--
-- «¿Entra alguien en la web?» es la primera pregunta que hace una hermandad
-- después de publicarla, y hasta ahora no había forma de contestarla.
--
-- POR QUÉ NO GOOGLE ANALYTICS. Porque obliga a poner el cartel de las cookies.
-- Una web de hermandad que recibe cien visitas al mes no necesita pagar ese
-- precio: el cartel molesta a todo el que entra, hay que mantenerlo al día, y
-- convierte una web sencilla en algo que pide permiso antes de enseñar nada.
--
-- Esto cuenta VISITAS A PÁGINAS y nada más:
--
--   · NO guarda la dirección IP.
--   · NO pone cookies ni nada parecido.
--   · NO sigue a nadie entre páginas ni entre días.
--   · NO se puede saber quién ha entrado, ni volver atrás y averiguarlo.
--
-- Lo que se guarda es un número por día y por página: «el 14 de marzo, la
-- portada tuvo 43 visitas». Eso no son datos personales, así que no hace falta
-- ni cartel ni consentimiento. Y es lo que de verdad se quiere saber.
--
-- LO QUE NO PUEDE DECIR, y conviene tenerlo claro antes de mirar los números:
-- no sabe cuántas PERSONAS distintas han entrado. Sin seguir a nadie no se
-- puede, y prefiero un número honesto a uno inventado. Cuenta visitas a
-- páginas: si la misma persona abre tres, son tres.
--
-- Ejecútalo una vez en el SQL Editor, después de `multi-hermandad.sql`.
-- =============================================================================

create table if not exists visitas_web (
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  -- El día, en hora de España. Lo pone el servidor: fiarse de la fecha que
  -- mande el navegador es dejar que cualquiera escriba en el día que quiera.
  dia date not null,
  /*
   * Qué página. Se guarda la RUTA, nunca la dirección entera: la dirección
   * puede traer pegado detrás lo que sea —el `?utm_...` de una campaña, el
   * texto que alguien buscó— y eso ya no es «qué página se vio».
   */
  ruta text not null,
  visitas integer not null default 0,
  primary key (hermandad_id, dia, ruta)
);

create index if not exists visitas_web_dia_idx on visitas_web (hermandad_id, dia desc);

alter table visitas_web enable row level security;

/*
 * NADIE ESCRIBE AQUÍ A MANO, ni siquiera para sumar uno.
 *
 * Con una política de INSERT abierta —como la del buzón de mensajes— cualquiera
 * con la clave pública podría meter cien mil filas y reventar la tabla, o
 * inflar el contador de una hermandad hasta que sus números no valgan nada.
 *
 * Se entra por la función de abajo, que solo sabe hacer una cosa: sumar uno.
 */
drop policy if exists "las visitas se leen desde el panel" on visitas_web;
create policy "las visitas se leen desde el panel"
  on visitas_web for select
  to authenticated
  using (hermandad_id = hermandad_actual() and not auth_es_hermano());

/**
 * Suma una visita. Es lo único que se puede hacer desde fuera.
 *
 * `security definer` para poder escribir en una tabla que no deja escribir a
 * nadie, y `search_path` fijado para que nadie pueda colar otra tabla con el
 * mismo nombre por delante.
 */
/*
 * Y QUE NO CREZCA PARA SIEMPRE. Una hermandad con veinte páginas genera unas
 * 7.000 filas al año; en diez años, setenta mil, para enseñar un gráfico de los
 * últimos treinta días. Se guardan DOS AÑOS, que es lo que hace falta para
 * comparar una Semana Santa con la anterior, y lo de antes se tira.
 *
 * La lanza `pg_cron` los domingos de madrugada — ver
 * `supabase/tareas-programadas.sql`, que hay que ejecutar aparte porque
 * primero hay que encender la extensión en el panel de Supabase.
 */
create or replace function limpiar_visitas_viejas() returns void
language sql security definer set search_path = public as $$
  delete from visitas_web where dia < current_date - interval '2 years'
$$;
revoke execute on function limpiar_visitas_viejas() from public, anon, authenticated;

create or replace function contar_visita(p_hermandad_id uuid, p_ruta text)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_ruta text;
  v_dia date;
  v_distintas int;
begin
  if p_hermandad_id is null then return; end if;
  if not exists (select 1 from hermandades where id = p_hermandad_id) then return; end if;

  v_ruta := split_part(split_part(coalesce(p_ruta, '/'), '?', 1), '#', 1);
  if v_ruta = '' or left(v_ruta, 1) <> '/' then v_ruta := '/'; end if;
  v_ruta := left(v_ruta, 200);

  -- La fecha, de este lado y en hora de España: con la del navegador, quien
  -- tenga el reloj mal —o quien quiera— escribe en el día que le apetezca.
  v_dia := (now() at time zone 'Europe/Madrid')::date;

  -- Si esta ruta ya se contó hoy no hay nada que mirar: la fila existe y solo
  -- se le suma uno. El tope solo importa cuando iría a crear una fila nueva.
  if not exists (select 1 from visitas_web
                  where hermandad_id = p_hermandad_id and dia = v_dia and ruta = v_ruta) then
    select count(*) into v_distintas from visitas_web
     where hermandad_id = p_hermandad_id and dia = v_dia;
    if v_distintas >= 300 then v_ruta := '/otras'; end if;
  end if;

  insert into visitas_web (hermandad_id, dia, ruta, visitas)
  values (p_hermandad_id, v_dia, v_ruta, 1)
  on conflict (hermandad_id, dia, ruta)
  do update set visitas = visitas_web.visitas + 1;
end $$;
grant execute on function contar_visita(uuid, text) to anon, authenticated;

comment on function contar_visita(uuid, text) is
  'Suma una visita a una página de la web pública. No guarda IP, ni cookies, ni '
  'nada que identifique a nadie: solo un número por día y por ruta.';

-- =============================================================================
--   SUSCRIPTORES-WEB.SQL — Avisos por correo para quien sigue a la hermandad sin ser hermano
-- =============================================================================

-- =============================================================================
--   AVISADME DE LOS CULTOS — quien sigue a la hermandad sin ser hermano
-- =============================================================================
--
-- Alrededor de una hermandad hay mucha más gente que hermanos: vecinos del
-- barrio, devotos, gente que se crió allí y vive fuera, quien va todos los años
-- a ver la salida. Toda esa gente se entera de los cultos por casualidad —o no
-- se entera— porque los avisos van al censo y ellos no están en el censo.
--
-- Y NO SE LES PUEDE METER EN EL CENSO. Un censo es la lista de hermanos y de
-- ahí cuelgan las cuotas, las papeletas y la antigüedad. Meter a un vecino ahí
-- para poder avisarle rompe el censo y le da una condición que no tiene.
--
-- Esto es una lista aparte: un correo y poco más.
--
-- LO QUE EXIGE EL RGPD, y por qué está cada cosa:
--
--   · CONSENTIMIENTO EXPRESO. Una casilla que hay que marcar a mano —nunca
--     premarcada— y se guarda QUÉ texto aceptó y CUÁNDO. Sin eso, si algún día
--     alguien reclama, la hermandad no puede demostrar nada.
--   · CONFIRMAR EL CORREO. Sin confirmar, cualquiera apunta el correo de otro:
--     se le manda un enlace y hasta que no lo abre no se le escribe. Además es
--     lo que evita que los envíos de la hermandad acaben en spam.
--   · DARSE DE BAJA DE UN CLIC. Cada suscriptor lleva su propia llave, y con
--     ella se borra solo, sin escribir a nadie ni dar explicaciones.
--
-- Ejecútalo una vez en el SQL Editor, después de `multi-hermandad.sql`.
-- =============================================================================

/*
 * LA LLAVE DE BAJA SALE DE `gen_random_bytes`, QUE NO ES DE POSTGRES A SECAS.
 *
 * Viene con la extensión `pgcrypto`. En Supabase está encendida de fábrica, así
 * que aquí funcionaba y nadie lo miró; pero es una dependencia que este fichero
 * no declaraba. En un Postgres sin ella, la instalación se para EN ESTA LÍNEA y
 * todo lo que viene detrás —las políticas, las funciones de suscripción, las
 * copias— no llega a crearse. Y como el error habla de una función y no de una
 * extensión, no se entiende.
 *
 * Se declara. Si ya está, no hace nada.
 */
create extension if not exists pgcrypto;

create table if not exists suscriptores_web (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  email text not null,
  nombre text not null default '',

  /*
   * LA LLAVE. Sirve para dos cosas —confirmar y darse de baja— y es lo único
   * que hace falta saber para las dos: por eso va en la dirección del correo
   * que se le manda y por eso es larga y al azar.
   *
   * Con un id normal, cualquiera que probara identificadores podría dar de baja
   * a otro. Con esto, no hay nada que probar.
   */
  llave text not null default encode(gen_random_bytes(24), 'hex'),

  -- Hasta que no abre el enlace del correo, no se le escribe.
  confirmado boolean not null default false,
  confirmado_en timestamptz,

  -- Qué aceptó exactamente y cuándo. Es la prueba del consentimiento.
  texto_aceptado text not null default '',
  alta_en timestamptz not null default now(),

  -- De dónde salió: «web», «formulario de contacto»… Para saber qué funciona.
  origen text not null default 'web'
);

-- Un correo, una vez por hermandad. Sin esto, quien pulsa dos veces el botón
-- acaba recibiendo cada aviso por duplicado.
/*
 * CUÁNDO SE LE MANDÓ EL CORREO DE CONFIRMAR.
 *
 * No es informativo: es el freno. Sin él, pedir «mándame la confirmación» mil
 * veces con el correo de otro le llena la bandeja a esa persona, firmado por la
 * hermandad. Con él, del segundo intento en diez minutos no sale nada.
 */
alter table suscriptores_web
  add column if not exists confirmacion_enviada_en timestamptz;

create unique index if not exists suscriptores_web_email_uniq
  on suscriptores_web (hermandad_id, lower(email));
create index if not exists suscriptores_web_hermandad_idx on suscriptores_web (hermandad_id);

alter table suscriptores_web enable row level security;

/*
 * NADIE ESCRIBE AQUÍ DIRECTAMENTE, ni siquiera para apuntarse.
 *
 * Con un INSERT abierto —como el del buzón de mensajes— la lista sería una
 * puerta para meter mil correos de golpe, y sobre todo se podría LEER lo que
 * otro acaba de escribir si alguien afina la consulta. Una lista de correos es
 * exactamente lo que busca quien manda spam.
 *
 * Se entra por las tres funciones de abajo, que hacen una cosa cada una.
 */
drop policy if exists "la hermandad ve sus suscriptores" on suscriptores_web;
create policy "la hermandad ve sus suscriptores"
  on suscriptores_web for select
  to authenticated
  using (hermandad_id = hermandad_actual() and not auth_es_hermano());

drop policy if exists "la hermandad borra sus suscriptores" on suscriptores_web;
create policy "la hermandad borra sus suscriptores"
  on suscriptores_web for delete
  to authenticated
  using (hermandad_id = hermandad_actual() and not auth_es_hermano());

/**
 * Apuntarse. DEVUELVE SÍ O NO, y nunca la llave.
 *
 * ANTES DEVOLVÍA LA LLAVE, y ese era el agujero. La llave es lo único que hace
 * falta para confirmar un alta (`confirmar_suscripcion`) y para darla de baja
 * (`baja_de_la_web`), y esta función la puede llamar cualquiera desde fuera sin
 * identificarse. Pero es que además, por el `on conflict … returning`, cuando
 * el correo YA ESTABA no devolvía una llave nueva: devolvía LA DE ESA PERSONA.
 *
 * O sea, que con la dirección de alguien de la lista —que no es ningún
 * secreto— se podía:
 *
 *   · CONFIRMAR SU ALTA sin que llegara a ver el correo. Y entonces la
 *     hermandad tiene apuntado «esta persona confirmó tal día», que es la
 *     prueba del consentimiento, y es falsa. La hermandad se pone a escribirle
 *     a alguien que nunca pidió nada, con un papel que dice que sí.
 *   · O DARLE DE BAJA. Una dirección detrás de otra, y la lista se vacía sin
 *     que nadie se entere: los suscriptores dejan de recibir los cultos y la
 *     hermandad no ve más que una lista que mengua.
 *
 * La llave se queda dentro de la base. Sale por dos sitios y solo por dos: el
 * correo que se le manda a esa persona, y el panel de la hermandad.
 *
 * SIGUE SIN DECIR SI EL CORREO YA ESTABA. Contestar «ese correo ya está
 * apuntado» le diría a cualquiera quién está en la lista, y eso es filtrar los
 * datos de otro. Devuelve `true` en los dos casos.
 */
drop function if exists suscribirse_a_la_web(uuid, text, text, text);
create or replace function suscribirse_a_la_web(
  p_hermandad_id uuid,
  p_email text,
  p_nombre text default '',
  p_texto text default ''
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_recientes int;
begin
  if p_hermandad_id is null then return false; end if;
  if not exists (select 1 from hermandades where id = p_hermandad_id) then return false; end if;

  v_email := lower(trim(coalesce(p_email, '')));
  -- Una comprobación mínima, del lado de acá. La de verdad la hace el correo de
  -- confirmación: si la dirección no existe, nunca se confirma.
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then return false; end if;

  /*
   * EL FRENO. Esto lo llama cualquiera sin identificarse, así que sin un tope
   * se le pueden meter cien mil correos a una hermandad en una tarde: la lista
   * queda inservible y hay que borrarla entera a mano.
   *
   * Sesenta altas nuevas por hora es mucho más de lo que da de sí el
   * formulario de una hermandad, incluso el día siguiente a la salida. Se
   * cuentan solo las NUEVAS: quien vuelve a apuntarse con un correo que ya
   * estaba no crea fila y no gasta cupo.
   */
  select count(*) into v_recientes from suscriptores_web
   where hermandad_id = p_hermandad_id and alta_en > now() - interval '1 hour';
  if v_recientes >= 60 then
    raise exception 'Ahora mismo no se pueden recoger más altas. Inténtalo dentro de un rato.'
      using errcode = 'P0001';
  end if;

  insert into suscriptores_web (hermandad_id, email, nombre, texto_aceptado)
  values (p_hermandad_id, v_email, left(trim(coalesce(p_nombre, '')), 120), left(coalesce(p_texto, ''), 1000))
  on conflict (hermandad_id, lower(email))
  -- Sin cambiar nada de lo que ya había: ni el consentimiento, ni la fecha de
  -- alta, ni si estaba confirmado. Volver a apuntarse no puede borrar la prueba
  -- de cuándo aceptó.
  do update set email = suscriptores_web.email;

  return true;
end $$;
grant execute on function suscribirse_a_la_web(uuid, text, text, text) to anon, authenticated;

/**
 * LA LLAVE PARA EL CORREO DE CONFIRMAR — y solo para el servidor.
 *
 * Esta es la única puerta por la que la llave sale de la base hacia quien
 * manda el correo, y NO SE LE DA A `anon` NI A `authenticated`: solo a
 * `service_role`, que es la clave que vive dentro de la función `enviar-correo`
 * y nunca pisa un navegador. Si algún día alguien le da el permiso a `anon`,
 * vuelve el agujero entero.
 *
 * Devuelve null —y no manda nada— en tres casos:
 *
 *   · Ese correo no está apuntado en esa hermandad. Sin esto, sería una forma
 *     de preguntar «¿está fulano en vuestra lista?».
 *   · Ya está confirmado. No hay nada que confirmar y mandarlo otra vez es
 *     spam.
 *   · Se le mandó hace menos de diez minutos. Es el freno de verdad: sin él,
 *     pedir la confirmación mil veces con el correo de otra persona le llena la
 *     bandeja, y firmado por la hermandad.
 *
 * Deja apuntado el envío en la misma consulta, así que dos peticiones a la vez
 * no consiguen dos correos.
 */
create or replace function llave_para_confirmar(p_hermandad_id uuid, p_email text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_llave text;
  v_nombre text;
begin
  if p_hermandad_id is null then return null; end if;
  update suscriptores_web
     set confirmacion_enviada_en = now()
   where hermandad_id = p_hermandad_id
     and lower(email) = lower(trim(coalesce(p_email, '')))
     and not confirmado
     and (confirmacion_enviada_en is null or confirmacion_enviada_en < now() - interval '10 minutes')
  returning llave into v_llave;
  if v_llave is null then return null; end if;

  -- El nombre va en el mismo viaje. Quien manda el correo lo necesita para
  -- firmarlo, y una segunda consulta para leer un nombre es una pieza más que
  -- se puede caer justo entre las dos.
  select nombre into v_nombre from hermandades where id = p_hermandad_id;
  return jsonb_build_object('llave', v_llave, 'hermandad', coalesce(v_nombre, ''));
end $$;
revoke all on function llave_para_confirmar(uuid, text) from public, anon, authenticated;
grant execute on function llave_para_confirmar(uuid, text) to service_role;

/** Confirmar, con la llave del enlace. Decir si ha valido o no. */
create or replace function confirmar_suscripcion(p_llave text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hay boolean;
begin
  update suscriptores_web
     set confirmado = true,
         -- Solo la primera vez: si vuelve a abrir el enlace del correo dentro
         -- de un año, la fecha buena sigue siendo la de entonces.
         confirmado_en = coalesce(confirmado_en, now())
   where llave = p_llave
  returning true into v_hay;
  return coalesce(v_hay, false);
end $$;
grant execute on function confirmar_suscripcion(text) to anon, authenticated;

/**
 * Darse de baja. Se BORRA la fila, no se marca.
 *
 * Guardar «este pidió la baja» obliga a seguir teniendo su correo para
 * acordarse de no escribirle, que es justo lo contrario de lo que ha pedido. Si
 * algún día vuelve, se apunta otra vez.
 */
create or replace function baja_de_la_web(p_llave text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hay boolean;
begin
  delete from suscriptores_web where llave = p_llave returning true into v_hay;
  return coalesce(v_hay, false);
end $$;
grant execute on function baja_de_la_web(text) to anon, authenticated;

-- =============================================================================
--   COPIAS.SQL — Las copias de seguridad, guardadas solas cada semana
-- =============================================================================

-- =============================================================================
--   LAS COPIAS DE SEGURIDAD, GUARDADAS SOLAS
-- =============================================================================
--
-- Hasta ahora la copia había que descargarla a mano. Funciona el día que
-- alguien se acuerda, y el problema es que nadie se acuerda: se pulsa el botón
-- la semana que se monta todo y no se vuelve a pulsar en dos años.
--
-- Y el censo de una hermandad es EL dato que no se puede volver a escribir.
-- Cuatrocientas fichas con su antigüedad, su cuota y su sitio en el cortejo no
-- se reconstruyen: o están, o se han perdido.
--
-- Esto es un cubo donde la aplicación deja una copia cada semana, sola.
--
-- POR QUÉ UN CUBO PRIVADO Y NO EL DE LAS IMÁGENES. Porque una copia lleva el
-- censo entero: nombres, DNI, teléfonos, direcciones, IBAN y datos de salud.
-- Es lo más sensible que hay en toda la aplicación. El cubo de las imágenes es
-- público —tiene que serlo, para que WhatsApp lea las fotos— y aquí eso sería
-- publicar el censo de la hermandad en internet.
--
-- Ejecútalo una vez en el SQL Editor, después de `multi-hermandad.sql`.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('copias', 'copias', false)
on conflict (id) do update set public = false;

/*
 * CADA HERMANDAD, EN SU CARPETA, y solo la suya.
 *
 * Es la misma regla que el archivo documental, pero aquí importa más: quien
 * pudiera leer la carpeta de otra hermandad se llevaría su censo completo de
 * una sola descarga.
 *
 * Y NO LO VE UN HERMANO. `auth_es_hermano()` fuera: el hermano entra en su área
 * a ver SU ficha, no el censo de los demás en un archivo.
 */
drop policy if exists "copias_leer" on storage.objects;
create policy "copias_leer" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'copias'
    and (storage.foldername(name))[1] = hermandad_actual()::text
    and not auth_es_hermano()
  );

drop policy if exists "copias_guardar" on storage.objects;
create policy "copias_guardar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'copias'
    and (storage.foldername(name))[1] = hermandad_actual()::text
    and not auth_es_hermano()
  );

/*
 * BORRAR SÍ, y hace falta: las copias viejas se van tirando para que el cubo no
 * crezca sin fin. Lo que NO se puede es sobrescribir una copia existente — no
 * hay política de update a propósito. Una copia que se puede pisar no es una
 * copia de seguridad.
 */
drop policy if exists "copias_borrar" on storage.objects;
create policy "copias_borrar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'copias'
    and (storage.foldername(name))[1] = hermandad_actual()::text
    and not auth_es_hermano()
  );

-- =============================================================================
--   PERMISOS-EVENTOS-Y-WEB.SQL — Los dos módulos que nunca se sembraron: «eventos» y «web»
-- =============================================================================

-- ============================================================================
--   LOS DOS MÓDULOS QUE NUNCA SE SEMBRARON: «eventos» y «web»
-- ============================================================================
--
-- La lista de permisos de fábrica se quedó corta desde el principio. Faltaba
-- «eventos» en cinco cargos y «web» en dos, así que en cualquier hermandad ya
-- creada el Hermano Mayor —que lo puede todo por definición— no podía guardar
-- un evento ni publicar la web: la pantalla se lo ofrecía, la política lo
-- rechazaba.
--
-- POR QUÉ ESTÁ EN SU PROPIO FICHERO Y NO DENTRO DE
-- `permisos-por-hermandad.sql`, QUE ES DONDE ESTABA.
--
-- Porque ese fichero no se puede ejecutar suelto sobre una base al día, y este
-- sí. `permisos-por-hermandad.sql` redefine `modulo_permitido()`, y esa función
-- la vuelve a redefinir después `hermano-con-cargo.sql` añadiéndole una tercera
-- vía: el hermano que lleva un cargo en su ficha. De todas las definiciones
-- manda la última que se ejecuta, así que ejecutar el fichero viejo por su
-- cuenta DEJA SIN ACCESO a todo hermano con cargo en la ficha — que es como
-- están hoy los tesoreros y secretarios que además son hermanos.
--
-- Este arreglo, en cambio, no toca ninguna función: solo añade filas que
-- faltan. Por eso se puede ejecutar solo, y por eso vive aparte.
--
-- Y SE AÑADEN SOLO ESTOS DOS, no se resiembra la lista entera. Volver a
-- sembrarla devolvería permisos que una hermandad haya quitado a propósito
-- —«al Secretario no le dejo tocar el censo»— y eso es peor que el fallo que
-- se viene a arreglar. Nadie ha podido quitar a mano algo que nunca estuvo.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Es seguro repetirlo.
-- ============================================================================

insert into permisos_cargo (hermandad_id, cargo, modulo_id)
select h.id, f.cargo, f.modulo_id
from hermandades h
cross join (values
  ('Hermano Mayor','eventos'),('Hermano Mayor','web'),
  ('Secretario/a','eventos'),('Secretario/a','web'),
  ('Mayordomo/Prioste','eventos'),
  ('Diputado/a Mayor de Gobierno','eventos'),
  ('Vocal','eventos')
) as f(cargo, modulo_id)
-- Solo a los cargos que esta hermandad ya reconoce: si nunca se le sembró
-- «Vocal», no se le inventa uno ahora.
where exists (
  select 1 from permisos_cargo pc
  where pc.hermandad_id = h.id and pc.cargo = f.cargo
)
on conflict do nothing;



-- ============================================================================
--   Y QUE EL MÓDULO «WEB» SIRVA PARA ALGO
-- ============================================================================
--
-- El módulo existía y la pantalla lo respetaba —quien no lo tiene no ve la
-- sección de la web—, pero LA BASE DE DATOS NO LO PEDÍA. La política decía
-- solo «no es un hermano»:
--
--     using (not auth_es_hermano()) with check (not auth_es_hermano())
--
-- O sea que cualquiera del personal, con el cargo que fuera, podía reescribir
-- la web pública de la hermandad desde la consola del navegador sin pasar por
-- ninguna pantalla. El diputado de tramo, el fiscal, el mayordomo: todos.
--
-- Es el mismo error que en la ficha del hermano y en las cuotas: LO QUE ESCONDE
-- LA PANTALLA NO PROTEGE NADA. Quien tiene sesión habla con la base
-- directamente, y ahí solo manda lo que digan las políticas.
--
-- Y aquí duele más de lo que parece, porque la web pública es lo que ve el
-- barrio entero: una portada cambiada la ve más gente en una tarde que
-- cualquier otra cosa de la aplicación.
--
-- Va DETRÁS de la siembra de arriba a propósito: primero el módulo existe para
-- los cargos que lo tienen que tener, y solo después se exige. Al revés, la
-- hermandad se quedaría un rato sin poder editar su web. Y `es_titular()`
-- entra siempre dentro de `modulo_permitido`, así que quien la lleva no se
-- queda fuera pase lo que pase.
drop policy if exists "el personal edita la web" on web_publica;
create policy "el personal edita la web" on web_publica for all to authenticated
  using (not auth_es_hermano() and modulo_permitido('web'))
  with check (not auth_es_hermano() and modulo_permitido('web'));

-- =============================================================================
--   LO-QUE-TOCA-EL-HERMANO.SQL — Que el hermano no se ponga la cuota como pagada desde la consola
-- =============================================================================

-- =============================================================================
--   LO-QUE-TOCA-EL-HERMANO.SQL — El hermano no se pone la cuota como pagada
-- =============================================================================
--
-- EL AGUJERO, y es el mismo que ya se cerró en la ficha del hermano con
-- `hermanos_solo_personal_toca_el_cargo`. Aquí quedó abierto.
--
-- El hermano necesita poder escribir en SU recibo: es como avisa de que ya ha
-- pagado por Bizum o por transferencia. Para eso hay una política de UPDATE
-- sobre `cuotas`. Y el razonamiento con el que se dejó sin acotar por columnas
-- está escrito en `area-hermano.sql`:
--
--     «No hace falta acotar más por columnas: lo único que la aplicación le
--      deja tocar ahí es el aviso de pago.»
--
-- Y AHÍ ESTÁ EL FALLO. Lo que le deje tocar la aplicación no protege nada: el
-- hermano tiene una sesión de verdad, y desde la consola del navegador —la que
-- se abre con F12— puede hablar con la base de datos directamente, sin pasar
-- por ninguna pantalla:
--
--     supabase.from('cuotas').update({ estado: 'Pagada', importe: 0 })
--             .eq('hermano_id', ...)
--
-- Comprobado contra un Postgres de verdad: la fila cambia. En ese momento su
-- recibo queda pagado y a cero, él sale como al corriente, se lleva su papeleta
-- de sitio, y las cuentas de la hermandad dicen que ese dinero entró. La
-- tesorería no tiene forma de notarlo: en su pantalla el recibo está pagado.
--
-- Y NO ES UN CASO DE LABORATORIO. Es una línea, con la sesión que ya tiene
-- abierta, sin herramientas y sin saber nada de bases de datos: se busca en
-- cualquier sitio. En una hermandad de seiscientos hermanos basta con que a uno
-- se le ocurra y se lo cuente al de al lado.
--
-- LO MISMO EN LAS PAPELETAS. Ahí el hermano sí hace cosas de verdad —renovar
-- su sitio, renunciar, avisar de que ha pagado—, pero no puede ponerse la
-- papeleta como «Pagada» ni como «Entregada», ni cambiarse el número, ni
-- ponerse fecha de entrega.
--
-- Se arregla como se arregló en la ficha: LISTA BLANCA. Se dice qué puede
-- cambiar y todo lo demás vuelve a como estaba. Lista blanca y no lista negra,
-- porque una lista negra se queda corta el día que alguien añade una columna.
--
-- Se puede ejecutar sobre una base ya en uso: no toca ninguna fila.

/**
 * Lo único que un hermano puede cambiar de SU recibo: el aviso de pago.
 *
 * Ni el estado, ni el importe, ni la fecha de cobro, ni si está domiciliado, ni
 * si ya viajó en una remesa. Todo eso lo decide la tesorería al confirmar.
 */
create or replace function cuotas_el_hermano_solo_avisa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Sin sesión no es el navegador: es el editor SQL o una función interna, que
  -- ya han pasado por RLS. Ahí no hay nada que proteger y estorbaría para
  -- arreglar datos a mano.
  if auth.uid() is null then return new; end if;

  -- Quien lleva las cuotas escribe la fila entera, que es su trabajo.
  if modulo_permitido('cuotas') or modulo_permitido('tesoreria') then return new; end if;

  -- Un hermano no se emite recibos a sí mismo.
  if tg_op = 'INSERT' then
    raise exception 'Un hermano no puede crearse recibos.' using errcode = 'P0001';
  end if;

  new.numero := old.numero;
  new.hermano_id := old.hermano_id;
  new.concepto := old.concepto;
  new.importe := old.importe;
  new.estado := old.estado;
  new.fecha_emision := old.fecha_emision;
  new.fecha_cobro := old.fecha_cobro;
  new.domiciliada := old.domiciliada;
  new.metodo_cobro := old.metodo_cobro;
  new.fecha_pago := old.fecha_pago;
  new.ejercicio := old.ejercicio;
  new.hermandad_id := old.hermandad_id;
  new.remesada_el := old.remesada_el;
  -- La mora la propone quien lleva las cuotas, no el que la debe.
  new.mora_propuesta_por := old.mora_propuesta_por;
  new.mora_propuesta_nombre := old.mora_propuesta_nombre;
  -- Y `pago_comunicado` es lo que sí se le deja: es el aviso.
  return new;
end $$;

drop trigger if exists cuotas_el_hermano_solo_avisa on cuotas;
create trigger cuotas_el_hermano_solo_avisa
  before insert or update on cuotas
  for each row execute function cuotas_el_hermano_solo_avisa();

comment on function cuotas_el_hermano_solo_avisa() is
  'Lista blanca de lo que un hermano puede cambiar de SU recibo: solo el aviso de pago. '
  'Sin esto, con su propia sesión y una línea desde la consola del navegador se ponía el '
  'recibo como pagado y a cero, salía al corriente y se llevaba su papeleta.';


/**
 * Y en su papeleta: puede renovar, renunciar y avisar de que ha pagado.
 *
 * No puede ponerse la papeleta como pagada ni como entregada —eso lo dice quien
 * la cobra y quien la entrega—, ni cambiarse el número, que es el sitio en el
 * cortejo y va por antigüedad.
 */
create or replace function papeletas_lo_que_toca_el_hermano() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if modulo_permitido('papeletas') or modulo_permitido('cortejo') then return new; end if;

  if tg_op = 'INSERT' then
    -- Pedirla sí puede; nace sin cobrar y sin entregar.
    new.estado := 'Asignada';
    new.fecha_entrega := null;
    new.pago_fecha := null;
    new.fecha_pago := null;
    new.motivo_anulacion := null;
    return new;
  end if;

  new.numero := old.numero;
  new.hermano_id := old.hermano_id;
  new.anio := old.anio;
  new.hermandad_id := old.hermandad_id;
  new.fecha_solicitud := old.fecha_solicitud;
  -- Lo que dice que está cobrada o entregada no lo pone él.
  new.fecha_entrega := old.fecha_entrega;
  new.pago_metodo := old.pago_metodo;
  new.pago_fecha := old.pago_fecha;
  new.metodo_pago := old.metodo_pago;
  new.fecha_pago := old.fecha_pago;
  new.motivo_anulacion := old.motivo_anulacion;

  /*
   * EL ESTADO, solo a los dos sitios a los que él puede llevarlo: pedir su
   * sitio y renunciar. «Pagada» y «Entregada» las dice quien cobra y quien
   * entrega; «Anulada» la dice la hermandad.
   */
  if new.estado is distinct from old.estado
     and new.estado not in ('Asignada', 'Renuncia') then
    new.estado := old.estado;
  end if;

  return new;
end $$;

drop trigger if exists papeletas_lo_que_toca_el_hermano on papeletas;
create trigger papeletas_lo_que_toca_el_hermano
  before insert or update on papeletas
  for each row execute function papeletas_lo_que_toca_el_hermano();

comment on function papeletas_lo_que_toca_el_hermano() is
  'Lista blanca de lo que un hermano puede cambiar de SU papeleta: pedir sitio, renunciar '
  'y avisar del pago. Ni cobrarla, ni entregarla, ni cambiarse el número.';

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Los dos disparadores tienen que estar:
--
--   select tgname from pg_trigger
--    where tgrelid in ('cuotas'::regclass, 'papeletas'::regclass) and not tgisinternal;
--
-- Tiene que salir `cuotas_el_hermano_solo_avisa` y `papeletas_lo_que_toca_el_hermano`,
-- además de los `apuntar_*` del registro de actividad.

-- =============================================================================
--   SIN-CONTRASENAS-EN-LAS-SOLICITUDES.SQL — Fuera la contraseña en claro que guardaba cada solicitud de alta
-- =============================================================================

-- =============================================================================
--   SIN-CONTRASEÑAS-EN-LAS-SOLICITUDES.SQL
-- =============================================================================
--
-- EL FALLO: `solicitudes_alta.clave_propuesta` guardaba EN CLARO la contraseña
-- que tecleaba quien pedía el alta desde la web pública.
--
-- Quién la ve: cualquiera del personal con el módulo «hermanos» —el Hermano
-- Mayor, la Secretaría, el Diputado Mayor—, y no en una pantalla escondida sino
-- en la propia fila de la solicitud. Y se queda ahí mientras la solicitud está
-- pendiente, que en una hermandad pueden ser semanas.
--
-- POR QUÉ IMPORTA MÁS DE LO QUE PARECE: la gente repite contraseñas. La que
-- veía la secretaria es, con mucha probabilidad, la del correo de esa persona.
-- Quien pide el alta no está dándole una contraseña a una empresa con un equipo
-- de seguridad: se la está dando a un vecino que lleva la secretaría los martes.
--
-- Y NO HACÍA FALTA NINGUNA. El camino de «se genera una clave de un solo uso al
-- aprobar y se manda por correo» ya existía —se usaba en el alta de un menor,
-- que llega sin contraseña—. Ahora se usa siempre, y el formulario pide un
-- campo menos.
--
-- Esto hace dos cosas, y las dos hacen falta:
--
--   1. BORRA LAS QUE YA ESTUVIERAN GUARDADAS. Mientras existan, el problema
--      sigue existiendo aunque el formulario ya no pida ninguna.
--   2. IMPIDE QUE ENTREN MÁS, con un disparador. Y esto tampoco sobra: la
--      hermandad puede tener el navegador con la versión anterior de la
--      aplicación abierta desde ayer, y esa sí manda la contraseña.
--
-- No se borra la columna: quitarla rompería a esa versión anterior en cuanto
-- alguien la use, y una solicitud perdida es peor que una columna vacía. Queda
-- ahí, siempre en blanco.
--
-- Se puede ejecutar sobre una base ya en uso.

-- 1. Fuera las que hay.
update solicitudes_alta set clave_propuesta = '' where coalesce(clave_propuesta, '') <> '';

-- 2. Y que no vuelvan a entrar.
create or replace function solicitudes_sin_clave() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- En blanco siempre, venga de donde venga. No se rechaza la solicitud: lo
  -- que importa es el alta, y quien la pide no tiene por qué quedarse fuera
  -- porque su navegador tenga la versión de ayer.
  new.clave_propuesta := '';
  return new;
end $$;

drop trigger if exists solicitudes_sin_clave on solicitudes_alta;
create trigger solicitudes_sin_clave
  before insert or update on solicitudes_alta
  for each row execute function solicitudes_sin_clave();

comment on column solicitudes_alta.clave_propuesta is
  'SIEMPRE VACÍA. Guardaba en claro la contraseña que proponía quien pedía el alta, '
  'a la vista de la secretaría durante semanas. La clave se genera al aprobar y se '
  'manda por correo. La columna se queda para no romper versiones anteriores de la '
  'aplicación; un disparador la deja en blanco.';

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Después de ejecutarlo, esto tiene que devolver 0:
--
--   select count(*) from solicitudes_alta where coalesce(clave_propuesta, '') <> '';

-- =============================================================================
--   FRENO-DE-LOS-FORMULARIOS.SQL — Un tope a lo que cualquiera puede meter desde la web pública
-- =============================================================================

-- =============================================================================
--   FRENO-DE-LOS-FORMULARIOS.SQL — Que nadie llene la base desde fuera
-- =============================================================================
--
-- HAY TRES PUERTAS QUE PUEDE EMPUJAR CUALQUIERA SIN IDENTIFICARSE, y ninguna
-- tenía tope:
--
--   · el buzón de la web (`mensajes_web`): contacto, donativos, lotería;
--   · las solicitudes de alta (`solicitudes_alta`);
--   · el contador de visitas, que tiene su freno en `visitas-web.sql`, donde
--     vive la función. Ponerlo aquí la redefiniría, y entonces ese fichero
--     dejaría de poder ejecutarse suelto sin deshacer el freno.
--
-- Las tres se abren a `anon` a propósito y así tiene que seguir siendo: es la
-- web pública y el visitante no tiene sesión ni la va a tener. Lo que faltaba
-- era el freno.
--
-- LO QUE HAY EN EL NAVEGADOR NO CUENTA. Los formularios llevan un campo trampa
-- para robots, y está bien, pero solo lo ve quien pasa por el formulario. Quien
-- habla con la base directamente —que es de lo que va esto— no lo pisa.
--
-- QUÉ PASA SIN FRENO, y son dos cosas distintas:
--
--   1. SE AHOGA EL BUZÓN. Diez mil mensajes de relleno y los tres de verdad
--      —un donativo, una consulta, alguien que quiere hacerse hermano— no hay
--      quien los encuentre. No hace falta tirar nada abajo para hacer daño.
--   2. SE LLENA LA BASE. Un proyecto de Supabase del plan gratuito tiene el
--      espacio contado, y ahí no se cae solo el buzón: se cae la hermandad
--      entera, con su censo y sus cuotas dentro.
--
-- Y AL TEXTO TAMPOCO SE LE PEDÍA MEDIDA: un solo mensaje podía traer megas.
-- Se recorta aquí, del lado de la base, porque lo que recorta el navegador se
-- quita quitando el navegador de en medio.
--
-- LOS TOPES SON HOLGADOS A PROPÓSITO. Sesenta mensajes por hora en una
-- hermandad es muchísimo —el día siguiente a la salida no llegan ni diez—, y
-- cuarenta altas por hora son casi mil al día. No se trata de acotar el uso de
-- verdad, sino de que el abuso no salga gratis.
--
-- Se puede ejecutar sobre una base ya en uso: no toca ninguna fila.

/**
 * El buzón: se recorta el texto y se cuentan los de la última hora.
 *
 * El personal de la hermandad no pasa por aquí (`auth.uid()` con sesión y sin
 * ser hermano): si algún día se importa un buzón entero, no se topa consigo
 * mismo.
 */
create or replace function mensajes_web_con_freno() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_recientes int;
begin
  -- Medida a todo lo que llega. Va antes del tope: aunque la fila entre, no
  -- puede entrar con megas dentro.
  new.nombre   := left(coalesce(new.nombre, ''), 120);
  new.email    := left(coalesce(new.email, ''), 160);
  new.telefono := left(coalesce(new.telefono, ''), 40);
  new.asunto   := left(coalesce(new.asunto, ''), 200);
  new.mensaje  := left(coalesce(new.mensaje, ''), 4000);
  new.causa    := left(coalesce(new.causa, ''), 200);
  new.metodo   := left(coalesce(new.metodo, ''), 60);

  if tg_op <> 'INSERT' then return new; end if;
  -- Quien tiene sesión y no es hermano es la propia hermandad: no se le frena.
  if auth.uid() is not null and not auth_es_hermano() then return new; end if;

  /*
   * LA HORA LA PONE LA BASE, Y ESTO NO ES UN DETALLE: ES EL FRENO.
   *
   * El tope de abajo cuenta los de la última hora por `creado_en`. Si esa
   * columna llega de fuera, basta con ponerla tres días atrás para que el
   * contador no vea ninguno y el freno no exista. Comprobado: entraban los
   * doscientos.
   *
   * Y de paso, `leido` y `atendido` tampoco los pone quien escribe: si no, se
   * puede dejar un mensaje ya marcado como leído y atendido, o sea, invisible
   * en el buzón de la hermandad.
   */
  new.creado_en := now();
  new.leido := false;
  new.atendido := false;

  select count(*) into v_recientes from mensajes_web
   where hermandad_id = new.hermandad_id and creado_en > now() - interval '1 hour';
  if v_recientes >= 60 then
    -- Se avisa en cristiano: quien llega justo detrás de un barrido tiene
    -- derecho a saber por qué no le funciona y a que le digan que vuelva.
    raise exception 'Ahora mismo no se pueden recoger más mensajes. Inténtalo dentro de un rato.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists mensajes_web_con_freno on mensajes_web;
create trigger mensajes_web_con_freno
  before insert or update on mensajes_web
  for each row execute function mensajes_web_con_freno();


/**
 * Las solicitudes de alta, igual.
 *
 * `fecha` es texto («23 ago 2026») y no sirve para contar por hora, así que se
 * cuentan las que no están resueltas: una avalancha las deja todas pendientes,
 * que es exactamente la señal.
 */
create or replace function solicitudes_con_freno() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pendientes int;
begin
  new.nombre   := left(coalesce(new.nombre, ''), 120);
  new.dni      := left(coalesce(new.dni, ''), 40);
  new.email    := left(coalesce(new.email, ''), 160);
  new.telefono := left(coalesce(new.telefono, ''), 40);

  if tg_op <> 'INSERT' then return new; end if;
  if auth.uid() is not null and not auth_es_hermano() then return new; end if;

  /*
   * Y EL ESTADO LO PONE LA BASE, por lo mismo y por algo peor.
   *
   * El tope de abajo cuenta las PENDIENTES, así que mandándolas con
   * `estado: 'Aprobada'` no cuentan y el freno no existe. Pero es que además,
   * una solicitud que llega ya aprobada desde fuera aparece en el panel de la
   * secretaría como si la hubiera aprobado alguien de la casa.
   */
  new.estado := 'Pendiente';
  new.resuelta_el := null;
  new.motivo_rechazo := null;

  select count(*) into v_pendientes from solicitudes_alta
   where hermandad_id = new.hermandad_id and estado = 'Pendiente';
  /*
   * Trescientas pendientes A LA VEZ no las tiene ninguna hermandad: son las que
   * caben en el panel de la secretaría antes de que deje de poder mirarlas. Y
   * el tope se suelta solo según las va resolviendo, que es lo que la hace
   * distinta de un tope por hora — aquí no hay que esperar a nada.
   */
  if v_pendientes >= 300 then
    raise exception 'Ahora mismo no se pueden recoger más solicitudes. Inténtalo dentro de unos días.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists solicitudes_con_freno on solicitudes_alta;
create trigger solicitudes_con_freno
  before insert or update on solicitudes_alta
  for each row execute function solicitudes_con_freno();



-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Los dos disparadores tienen que estar:
--
--   select tgname from pg_trigger
--    where tgrelid in ('mensajes_web'::regclass, 'solicitudes_alta'::regclass)
--      and not tgisinternal;

-- =============================================================================
--   CUENTA-POR-HERMANDAD.SQL — Ser hermano de dos hermandades: una cuenta por hermandad + DNI
-- =============================================================================

-- =============================================================================
--   CUENTA-POR-HERMANDAD.SQL — Ser hermano de dos hermandades a la vez
-- =============================================================================
--
-- EN ANDALUCÍA SER HERMANO DE DOS O TRES HERMANDADES ES LO NORMAL. Y hasta
-- ahora, cuando las dos estaban en Gobergo, esa persona solo podía entrar en el
-- área de UNA.
--
-- El censo ya lo contemplaba: el DNI se hizo único POR HERMANDAD en su día, con
-- el comentario «la misma persona puede ser hermana de dos». Su ficha está dos
-- veces, una en cada hermandad, y eso está bien. Lo que faltaba era la cuenta.
--
-- POR QUÉ FALLABA. Un hermano entra así:
--
--     elige hermandad → escribe su DNI → escribe su contraseña
--
-- El correo NO LO TECLEA NUNCA: la aplicación lo busca a partir del DNI y con
-- él inicia la sesión. Pero las cuentas de Supabase se identifican POR CORREO, y
-- el correo es único en todo el sistema. Así que al aprobar el alta en la
-- segunda hermandad, la creación de la cuenta se estrellaba con «el correo ya lo
-- usa otra cuenta»: esa persona quedaba en el censo de la segunda y sin poder
-- entrar en su área.
--
-- LO QUE SE SEPARA AQUÍ son dos cosas que estaban pegadas sin necesidad:
--
--   · `email`         — el correo de la persona, donde recibe los avisos. Es el
--                       MISMO en las dos hermandades, y no se toca.
--   · `correo_acceso` — cómo se llama su cuenta por dentro. Uno por hermandad.
--                       No lo ve ni lo teclea nadie.
--
-- Con eso, hermandad + DNI ES la cuenta, que es exactamente como se entra. Dos
-- hermandades, dos cuentas, dos contraseñas —independientes, porque son dos
-- accesos distintos— y un solo correo para los avisos.
--
-- NADIE QUE YA TENGA CUENTA SE ENTERA DE ESTO. Su `correo_acceso` está a null, y
-- `resolver_email_hermano` devuelve entonces el correo de siempre: entran igual
-- que ayer. El identificador derivado solo lo usan las cuentas que se crean a
-- partir de ahora.
--
-- Se puede ejecutar sobre una base ya en uso: no toca ninguna fila.

/*
 * `gen_random_bytes` y `digest` vienen con `pgcrypto`, no con Postgres a secas.
 * En Supabase está encendida de fábrica, pero se declara igualmente: este
 * archivo se puede ejecutar solo, y sin ella se pararía a la mitad con un error
 * que habla de una función y no de una extensión — que fue exactamente lo que
 * pasó con `suscriptores-web.sql`.
 */
create extension if not exists pgcrypto;

alter table hermanos add column if not exists correo_acceso text;

/*
 * Único, porque es el nombre de una cuenta. Parcial —solo donde no es nulo—
 * para no chocar con todas las fichas viejas, que lo tienen vacío.
 */
create unique index if not exists hermanos_correo_acceso_uniq
  on hermanos (lower(correo_acceso)) where correo_acceso is not null;

comment on column hermanos.correo_acceso is
  'Cómo se llama su cuenta POR DENTRO, una por hermandad. No es su correo: ese es '
  '«email» y sirve para los avisos, es el mismo en todas sus hermandades y no se '
  'toca. Nulo en las fichas anteriores a este cambio, que siguen entrando con su '
  'correo de siempre.';

/**
 * El identificador interno de una cuenta: hermandad + DNI.
 *
 * NO ES UN CORREO DE VERDAD y no tiene por qué serlo: no recibe nada, y quien
 * escribe a esa persona usa el `email` de su ficha. Tiene forma de correo porque
 * es lo que Supabase pide para nombrar una cuenta.
 *
 * Lleva un trozo del id de la hermandad para que el mismo DNI dé dos cuentas
 * distintas, que es de lo que va todo esto. Y el DNI va limpio —sin puntos ni
 * guiones— porque en el censo importado está escrito de las dos maneras y son la
 * misma persona.
 *
 * Se GUARDA en la ficha en cuanto se crea la cuenta, no se recalcula cada vez.
 * Si mañana la secretaría corrige un DNI mal tecleado —que en un censo importado
 * de un Excel pasa— la cuenta tiene que seguir siendo la suya; recalculándolo se
 * quedaría sin poder entrar y sin que nadie entendiera por qué.
 */
create or replace function correo_de_acceso(p_hermandad_id uuid, p_dni text)
returns text
language sql immutable as $$
  select upper(regexp_replace(coalesce(p_dni, ''), '[^A-Za-z0-9]', '', 'g'))
      || '.' || left(replace(p_hermandad_id::text, '-', ''), 12)
      || '@acceso.gobergo.com'
$$;

/**
 * Y el que busca la aplicación para iniciar sesión: el interno si lo tiene, y
 * si no el de siempre.
 *
 * Ese `coalesce` es lo que hace que este cambio no se note: las fichas de antes
 * no tienen identificador interno y siguen entrando con su correo, exactamente
 * igual que ayer.
 *
 * Y DE PASO SE CIERRA UNA FUGA. Esta función se la puede llamar cualquiera sin
 * identificarse —es como entra un hermano— y devolvía EL CORREO REAL de esa
 * persona. Un DNI no es ningún secreto: sabiendo el de alguien se obtenía su
 * dirección. Hay freno (25 DNI distintos por media hora), pero contra una
 * persona concreta funciona a la primera. Para las cuentas nuevas ya no
 * devuelve nada que diga nada de nadie.
 */
create or replace function resolver_email_hermano(p_hermandad_id uuid, p_dni text)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_dni text;
  v_huella text;
  v_recientes int;
  v_email text;
begin
  v_dni := upper(regexp_replace(coalesce(p_dni, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_dni = '' or p_hermandad_id is null then
    return null;
  end if;

  v_huella := md5(v_dni || ':' || p_hermandad_id::text);

  select count(distinct huella_dni) into v_recientes
    from intentos_acceso
   where hermandad_id = p_hermandad_id
     and cuando > now() - interval '30 minutes';

  if v_recientes >= 25 then
    raise exception 'Demasiados intentos de acceso en esta hermandad. Espera unos minutos y vuelve a probar.'
      using errcode = 'P0001';
  end if;

  insert into intentos_acceso (hermandad_id, huella_dni) values (p_hermandad_id, v_huella);
  delete from intentos_acceso where cuando < now() - interval '1 day';

  select coalesce(nullif(correo_acceso, ''), nullif(email, '')) into v_email
    from hermanos
   where hermandad_id = p_hermandad_id
     and upper(regexp_replace(dni, '[^A-Za-z0-9]', '', 'g')) = v_dni
     and estado <> 'Baja'
   limit 1;

  return v_email;
end $$;

grant execute on function resolver_email_hermano(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- La columna tiene que estar, y vacía en todas las fichas de hoy:
--
--   select count(*) as fichas, count(correo_acceso) as con_cuenta_propia from hermanos;
--
-- «con_cuenta_propia» en 0 al principio es lo correcto: se va llenando según se
-- creen cuentas nuevas.


-- =============================================================================
--   Y LA RECUPERACIÓN DE CONTRASEÑA, NUESTRA
-- =============================================================================
--
-- POR QUÉ HACE FALTA: «he olvidado mi contraseña» hacía que Supabase mandara un
-- correo a la dirección de la cuenta. Con el identificador interno de arriba,
-- esa dirección NO RECIBE NADA — así que el enlace no llegaría nunca y cada
-- hermano nuevo se quedaría sin poder recuperar su acceso. Eso es meter un
-- fallo, no quitarlo, y por eso esto entra en el mismo archivo.
--
-- CÓMO FUNCIONA, y es igual que el correo de confirmar una suscripción: el
-- navegador solo dice «este DNI de esta hermandad quiere recuperar». Ni el
-- token ni el correo de la persona pasan por él. La función `enviar-correo` los
-- lee aquí con la clave de servicio y manda el enlace al correo DE VERDAD de su
-- ficha.

create table if not exists recuperaciones_hermano (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null references hermandades(id) on delete cascade,
  hermano_id uuid not null references hermanos(id) on delete cascade,
  /*
   * LA HUELLA DEL TOKEN, NO EL TOKEN. Quien pudiera leer esta tabla tendría si
   * no la llave para entrar en la cuenta de cualquiera que haya pedido
   * recuperarla. Guardando el resumen, la tabla no sirve de nada por sí sola.
   */
  huella text not null unique,
  caduca_en timestamptz not null,
  usada_en timestamptz,
  creada_en timestamptz not null default now()
);
create index if not exists recuperaciones_hermano_idx on recuperaciones_hermano (hermano_id, creada_en desc);

alter table recuperaciones_hermano enable row level security;
-- Nadie la toca desde fuera. Las dos funciones de abajo son SECURITY DEFINER y
-- se saltan las políticas a propósito; sin ninguna política, una tabla con RLS
-- encendido está cerrada del todo, que es lo que se quiere.
revoke all on recuperaciones_hermano from anon, authenticated;

/**
 * Paso 1: se pide. Devuelve el token, el correo DE VERDAD y el nombre, para que
 * quien manda el correo sepa a dónde y cómo escribir.
 *
 * SOLO PARA `service_role`. Si esto se le diera a `anon`, sería regalar la
 * llave de la cuenta de cualquiera con solo saber su DNI, que es justo lo
 * contrario de lo que viene a hacer.
 *
 * Devuelve null —y no se manda nada— si ese DNI no está en esa hermandad, si
 * está de baja, si no tiene correo donde escribirle, o si ya pidió una hace
 * menos de cinco minutos. Lo último es el freno: sin él, pedir la recuperación
 * mil veces con el DNI de otro le llena la bandeja, firmado por la hermandad.
 */
create or replace function pedir_recuperacion_hermano(p_hermandad_id uuid, p_dni text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_dni text;
  v_hermano record;
  v_token text;
begin
  if p_hermandad_id is null then return null; end if;
  v_dni := upper(regexp_replace(coalesce(p_dni, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_dni = '' then return null; end if;

  select id, nombre, email into v_hermano from hermanos
   where hermandad_id = p_hermandad_id
     and upper(regexp_replace(dni, '[^A-Za-z0-9]', '', 'g')) = v_dni
     and estado <> 'Baja'
     and coalesce(email, '') <> ''
     -- Sin cuenta no hay contraseña que recuperar.
     and auth_user_id is not null
   limit 1;
  if v_hermano.id is null then return null; end if;

  if exists (select 1 from recuperaciones_hermano
              where hermano_id = v_hermano.id and creada_en > now() - interval '5 minutes') then
    return null;
  end if;

  -- Largo y al azar: es lo único que hace falta saber para ponerle otra
  -- contraseña a esa cuenta, así que no puede haber nada que adivinar.
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Las anteriores de esta persona dejan de valer: pedir una nueva tiene que
  -- invalidar la de antes, o un enlace viejo reenviado sigue abriendo.
  update recuperaciones_hermano set usada_en = now()
   where hermano_id = v_hermano.id and usada_en is null;

  insert into recuperaciones_hermano (hermandad_id, hermano_id, huella, caduca_en)
  values (p_hermandad_id, v_hermano.id, encode(digest(v_token, 'sha256'), 'hex'),
          now() + interval '2 hours');

  -- Y se limpia lo viejo aprovechando el viaje, para no tener que programar nada.
  delete from recuperaciones_hermano where creada_en < now() - interval '7 days';

  return jsonb_build_object('token', v_token, 'email', v_hermano.email, 'nombre', v_hermano.nombre);
end $$;
revoke all on function pedir_recuperacion_hermano(uuid, text) from public, anon, authenticated;
grant execute on function pedir_recuperacion_hermano(uuid, text) to service_role;

/**
 * Paso 2: se canjea. Devuelve de qué cuenta es, para poder ponerle la
 * contraseña nueva.
 *
 * También solo para `service_role`: la contraseña se cambia con la clave de
 * servicio desde la función `enviar-correo`, porque eso no se puede hacer desde
 * SQL ni desde el navegador.
 *
 * SE MARCA COMO USADA EN LA MISMA CONSULTA. Un token de un solo uso que se
 * comprueba y se marca en dos pasos se puede canjear dos veces si llegan a la
 * vez, y aquí eso es dos cambios de contraseña.
 */
create or replace function canjear_recuperacion_hermano(p_token text)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare v_auth uuid;
begin
  if coalesce(p_token, '') = '' then return null; end if;

  update recuperaciones_hermano r
     set usada_en = now()
    from hermanos h
   where h.id = r.hermano_id
     and r.huella = encode(digest(p_token, 'sha256'), 'hex')
     and r.usada_en is null
     and r.caduca_en > now()
     and h.estado <> 'Baja'
  returning h.auth_user_id into v_auth;

  return v_auth;
end $$;
revoke all on function canjear_recuperacion_hermano(text) from public, anon, authenticated;
grant execute on function canjear_recuperacion_hermano(text) to service_role;

-- =============================================================================
--   SOLICITUDES-DE-PAPELETA.SQL — Que la solicitud de papeleta del hermano llegue a la hermandad
-- =============================================================================

-- ============================================================================
--   LA SOLICITUD DE PAPELETA DEL HERMANO NO LLEGABA A NINGUNA PARTE
-- ============================================================================
--
-- El área del hermano tiene un formulario para pedir la papeleta de sitio:
-- modalidad, tramo, preferencia y un comentario. El hermano lo rellena, le da
-- a enviar, y la pantalla le dice que su solicitud ha quedado registrada.
--
-- Y se guardaba EN SU MÓVIL. En `localStorage`, con la clave
-- `cabildo-solicitudes-papeleta`, y en ningún otro sitio.
--
-- La secretaría abre Papeletas › Solicitudes desde el ordenador de la casa de
-- hermandad y lee `localStorage`… el suyo. Que está vacío. Los dos lados de la
-- misma función leyendo cajones distintos: el hermano ve la suya y cree que ya
-- está pedida, la hermandad no ve ninguna y cree que nadie ha pedido.
--
-- Nada avisa. No hay error, no hay banda roja, no hay una fila a medias: hay
-- dos pantallas contándose cosas distintas. Y el día que se cierra el plazo,
-- las solicitudes que no se atendieron no es que se perdieran — es que nunca
-- salieron del teléfono.
--
-- Aquí se le da la tabla que le faltaba, con las mismas reglas que el resto:
--
--   · El hermano SOLO puede crear la suya, y solo puede leer las suyas.
--   · El estado lo pone el servidor: nadie se acepta su propia papeleta.
--   · Una pendiente por hermano y año. Ni cero (se perdería) ni cincuenta.
--   · La secretaría las ve y las resuelve, si tiene el módulo de papeletas.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

create table if not exists solicitudes_papeleta (
  id uuid primary key default gen_random_uuid(),
  -- `default hermandad_actual()`, igual que papeletas, cuotas y hermanos: la
  -- hermandad la pone la base a partir de quién está preguntando, así que la
  -- aplicación no la manda y no la puede equivocar.
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  hermano_id uuid not null references hermanos(id) on delete cascade,
  -- El nombre y el número se copian al pedirla, y no es dato duplicado por
  -- descuido: es lo que la secretaría necesita leer en la lista sin cruzar el
  -- censo entero, y lo que hace que la solicitud siga contando quién la pidió
  -- aunque esa ficha cambie de número por una baja de otro.
  hermano_nombre text not null default '',
  hermano_numero int not null default 0,
  anio int not null,
  modalidad text not null default 'Nazareno',
  preferencia text not null default '',
  tramo_solicitado text not null default '',
  comentario text not null default '',
  fecha text not null default '',
  estado text not null default 'Pendiente'
    check (estado in ('Pendiente', 'Aceptada', 'Rechazada'))
);

alter table solicitudes_papeleta enable row level security;

create index if not exists solicitudes_papeleta_hermandad
  on solicitudes_papeleta (hermandad_id, anio);

/*
 * UNA PENDIENTE POR HERMANO Y AÑO.
 *
 * Es el freno y a la vez la regla del negocio. Sin él, el botón de enviar se
 * puede pulsar cuarenta veces —desde el móvil, con la conexión regular, se
 * pulsa dos o tres sin querer— y la secretaría se encuentra la misma petición
 * repetida sin saber cuál mirar.
 *
 * Parcial, solo sobre las pendientes: a quien se le rechazó una tiene que
 * poder volver a pedirla, que para eso se le explica el motivo.
 */
create unique index if not exists solicitudes_papeleta_una_pendiente
  on solicitudes_papeleta (hermano_id, anio)
  where estado = 'Pendiente';

/*
 * LO QUE PONE EL SERVIDOR, PASE LO QUE PASE.
 *
 * La política de abajo deja al hermano CREAR su solicitud, y una política no
 * sabe de columnas: puede escribir las que quiera. Sin este disparador, quien
 * supiera abrir la consola del navegador se mandaba su propia solicitud ya
 * «Aceptada» —que es lo que la secretaría convierte en papeleta—, o la creaba
 * a nombre de otro hermano para quitarle el sitio.
 *
 * Es lista BLANCA, no negra: se fija lo que tiene que valer y lo demás se
 * queda como venga. Una lista negra hay que ampliarla cada vez que se añade
 * una columna, y el día que se olvide no avisa nadie.
 *
 * `security definer` porque lee `hermanos`, que el propio hermano solo ve en
 * su fila.
 */
create or replace function solicitud_papeleta_del_hermano() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_hermano hermanos%rowtype;
begin
  -- Al personal no se le toca nada: es quien acepta y rechaza, y para eso
  -- tiene que poder escribir el estado.
  if not auth_es_hermano() then return new; end if;

  select * into v_hermano from hermanos where auth_user_id = auth.uid();
  if v_hermano.id is null then
    raise exception 'Esta cuenta no tiene ficha de hermano.';
  end if;

  if tg_op = 'INSERT' then
    -- Suya, de su hermandad, con sus datos y siempre pendiente.
    new.hermano_id := v_hermano.id;
    new.hermandad_id := v_hermano.hermandad_id;
    new.hermano_nombre := v_hermano.nombre;
    new.hermano_numero := v_hermano.numero;
    new.estado := 'Pendiente';
    -- Un hermano de baja no pide sitio en el cortejo.
    if v_hermano.estado = 'Baja' then
      raise exception 'Una persona de baja en la hermandad no puede pedir papeleta.';
    end if;
    return new;
  end if;

  -- Y modificar, no modifica: la resuelve la hermandad, no él.
  raise exception 'La solicitud la resuelve la hermandad.';
end $$;

drop trigger if exists solicitud_papeleta_del_hermano on solicitudes_papeleta;
create trigger solicitud_papeleta_del_hermano
  before insert or update on solicitudes_papeleta
  for each row execute function solicitud_papeleta_del_hermano();

-- ---------------------------------------------------------------------------
-- Quién ve y quién toca
-- ---------------------------------------------------------------------------

-- El corte por hermandad va aparte y RESTRICTIVO, igual que en el resto de
-- tablas: se suma a todo lo demás en vez de competir con ello.
drop policy if exists "solo_mi_hermandad" on solicitudes_papeleta;
create policy "solo_mi_hermandad" on solicitudes_papeleta as restrictive for all to authenticated
  using (hermandad_id = hermandad_actual())
  with check (hermandad_id = hermandad_actual());

drop policy if exists "el hermano pide la suya" on solicitudes_papeleta;
create policy "el hermano pide la suya" on solicitudes_papeleta for insert to authenticated
  with check (auth_es_hermano() and hermano_id = hermano_propio_id());

drop policy if exists "el hermano ve las suyas" on solicitudes_papeleta;
create policy "el hermano ve las suyas" on solicitudes_papeleta for select to authenticated
  using (auth_es_hermano() and hermano_id = hermano_propio_id());

drop policy if exists "la hermandad las lee" on solicitudes_papeleta;
create policy "la hermandad las lee" on solicitudes_papeleta for select to authenticated
  using (not auth_es_hermano());

drop policy if exists "la hermandad las resuelve" on solicitudes_papeleta;
create policy "la hermandad las resuelve" on solicitudes_papeleta for update to authenticated
  using (not auth_es_hermano() and modulo_permitido('papeletas'))
  with check (not auth_es_hermano() and modulo_permitido('papeletas'));

drop policy if exists "la hermandad las borra" on solicitudes_papeleta;
create policy "la hermandad las borra" on solicitudes_papeleta for delete to authenticated
  using (not auth_es_hermano() and modulo_permitido('papeletas'));

grant select, insert, update, delete on solicitudes_papeleta to authenticated;

comment on table solicitudes_papeleta is
  'Lo que el hermano pide desde su área para la estación de penitencia. Vivía en el '
  'localStorage de su móvil, así que la secretaría no la recibía nunca: el hermano '
  'la veía enviada y la hermandad no veía ninguna, sin un solo aviso por medio.';

-- =============================================================================
--   ACTIVAR-LA-SUSCRIPCION.SQL — Que el botón de activar la suscripción llegue a la base
-- =============================================================================

-- ============================================================================
--   EL BOTÓN DE ACTIVAR LA SUSCRIPCIÓN NO LLEGABA A LA BASE
-- ============================================================================
--
-- Sin suscripción activa, el panel entero está bloqueado: `AppShell` enseña la
-- pantalla de suscripción y no deja pasar a ningún módulo. Es lo primero que
-- se encuentra una hermandad al entrar.
--
-- La pantalla tiene su botón de activar, y ese botón escribía en
-- `localStorage`. En ningún otro sitio. Lo que pasaba entonces:
--
--   1. El Hermano Mayor activa desde su ordenador. Entra. Funciona.
--   2. La secretaria abre el panel desde el suyo y se encuentra el muro de
--      pago, con la hermandad supuestamente activada.
--   3. Y en el ordenador del Hermano Mayor, al recargar, el muro TAMBIÉN
--      vuelve: `cargarSuscripcionDeLaBase()` pregunta a la base, la base
--      contesta «no hay suscripción», y esa respuesta pisa la copia local.
--
-- O sea que el botón no servía para nada más que para el rato que durase esa
-- pestaña abierta. Y no había forma de saberlo desde dentro: no da error, no
-- avisa, simplemente vuelve a salir el muro.
--
-- LA ÚNICA MANERA DE ACTIVAR ERA `activar_suscripcion(...)` DESDE EL EDITOR
-- SQL DE SUPABASE, porque esa función está revocada para `authenticated` a
-- propósito: se pensó para que la llamara el webhook de Stripe con la clave de
-- servicio. Mientras no exista ese webhook, la aplicación se queda sin ninguna
-- forma de activar nada.
--
-- QUÉ AÑADE ESTE ARCHIVO
--
-- `activar_suscripcion_propia()`: la puede llamar el TITULAR de la hermandad,
-- y solo para SU hermandad. Es exactamente lo que la pantalla ya ofrece —hoy
-- la activación es gratuita mientras no haya precios de Stripe puestos, y así
-- lo dice— pero guardándolo donde tiene que estar.
--
-- OJO, Y ESTO HAY QUE LEERLO ANTES DE COBRAR: mientras esta función exista,
-- cualquier titular puede activarse el pack que quiera sin pagar. Hoy da
-- igual, porque el botón de la pantalla ya lo hace y no hay pasarela. EL DÍA
-- QUE SE CONECTE STRIPE hay que revocarla y dejar solo la de service_role, que
-- es la que llamará el webhook:
--
--     revoke execute on function activar_suscripcion_propia(text, text) from authenticated;
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

create or replace function activar_suscripcion_propia(
  p_pack text default 'todo',
  p_periodo text default 'mensual'
) returns void
language plpgsql security definer set search_path = public as $$
declare v_hermandad uuid;
begin
  -- SOLO EL TITULAR, y solo la suya. `hermandad_actual()` sale de quién está
  -- preguntando, así que no hay ningún identificador que se pueda cambiar
  -- desde el navegador para activarle la suscripción a otra hermandad.
  if not es_titular() then
    raise exception 'Solo quien lleva la hermandad puede activar la suscripción.';
  end if;
  v_hermandad := hermandad_actual();
  if v_hermandad is null then
    raise exception 'Esta cuenta no tiene ninguna hermandad.';
  end if;

  -- Los valores se acotan aquí y no se toman tal cual: son los que decide la
  -- pantalla, pero la pantalla se puede saltar.
  if coalesce(p_pack, '') not in ('todo', 'gestion', 'web') then p_pack := 'todo'; end if;
  if coalesce(p_periodo, '') not in ('mensual', 'anual') then p_periodo := 'mensual'; end if;

  insert into suscripciones (hermandad_id, activa, pack, periodo, desde, actualizada_en)
  values (v_hermandad, true, p_pack, p_periodo, current_date, now())
  on conflict (hermandad_id) do update set
    activa = true, pack = excluded.pack, periodo = excluded.periodo,
    desde = coalesce(suscripciones.desde, excluded.desde), actualizada_en = now();
end $$;

revoke all on function activar_suscripcion_propia(text, text) from public, anon;
grant execute on function activar_suscripcion_propia(text, text) to authenticated;

-- Y darla de baja, por lo mismo: cancelándola solo en el navegador, la
-- hermandad seguía entrando desde cualquier otro ordenador.
create or replace function cancelar_suscripcion_propia() returns void
language plpgsql security definer set search_path = public as $$
declare v_hermandad uuid;
begin
  if not es_titular() then
    raise exception 'Solo quien lleva la hermandad puede cancelar la suscripción.';
  end if;
  v_hermandad := hermandad_actual();
  if v_hermandad is null then return; end if;
  -- Se marca inactiva, NO se borra la fila: cuándo se dio de alta y cuándo se
  -- fue es justo lo que hay que poder mirar cuando alguien reclama.
  update suscripciones set activa = false, actualizada_en = now()
   where hermandad_id = v_hermandad;
end $$;

revoke all on function cancelar_suscripcion_propia() from public, anon;
grant execute on function cancelar_suscripcion_propia() to authenticated;

comment on function activar_suscripcion_propia(text, text) is
  'Activa la suscripción de SU hermandad, para el titular. Existe porque el botón de la '
  'pantalla de suscripción solo escribía en localStorage: al recargar volvía el muro de '
  'pago, y desde otro ordenador no había entrado nunca. Revocar para authenticated el día '
  'que se conecte Stripe: entonces activa el webhook con activar_suscripcion().';

-- =============================================================================
--   NUMERO-DE-RECIBO-UNICO.SQL — Que no pueda haber dos recibos con el mismo número
-- =============================================================================

-- ============================================================================
--   DOS RECIBOS CON EL MISMO NÚMERO
-- ============================================================================
--
-- El número de recibo es lo que va impreso en el justificante que se le
-- entrega al hermano, y es por lo que pregunta la tesorería al cuadrar el
-- extracto del banco: «el 412 no me aparece». Que haya dos 412 no es un
-- detalle de listado: es que esa conversación deja de tener respuesta.
--
-- Y se podían crear. `hermanos` tiene su número protegido
-- (`hermanos_numero_por_hermandad`) y `papeletas` también
-- (`papeletas_numero_unico`); `cuotas` se quedó sin nada. Comprobado: dos
-- inserciones seguidas con el mismo número entran las dos y nadie protesta.
--
-- No hace falta mala suerte para que pase. El número lo calcula la aplicación
-- con «el mayor que veo, más uno», y lo que ve es la lista que tiene cargada:
--
--   · Dos personas emitiendo desde dos ordenadores a la vez —el día del
--     cabildo son dos, y a veces tres—.
--   · Emitir en una pestaña mientras la otra tiene la tabla a medio cargar.
--   · Importar el histórico de cuotas de otro programa, que trae sus propios
--     números y no sabe cuáles hay ya.
--
-- QUÉ HACE ESTE ARCHIVO, Y QUÉ NO HACE
--
-- Pone el índice único. Y ANTES MIRA si la base ya tiene repetidos, porque una
-- hermandad que lleve meses trabajando puede tenerlos:
--
--   · Si no hay ninguno, lo pone y ya está.
--   · Si los hay, NO LOS TOCA y NO PONE EL ÍNDICE: avisa diciendo cuáles son.
--
-- No se renumeran solos a propósito. Esos números están impresos en recibos
-- que ya se entregaron y anotados en la conciliación del banco: cambiarlos
-- desde un script, de madrugada y sin que nadie mire, es peor que el problema.
-- Que la tesorería decida cuál se queda con el número y cuál se corrige, y
-- después se vuelve a ejecutar esto.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada. Si avisa de repetidos, mira el aviso.
-- ============================================================================

do $$
declare
  v_repetidos int;
  v_detalle text;
begin
  -- Si ya está puesto, no hay nada que hacer.
  if exists (select 1 from pg_indexes where indexname = 'cuotas_numero_por_hermandad') then
    raise notice 'El número de recibo ya era único. Nada que hacer.';
    return;
  end if;

  select count(*), string_agg(t.detalle, ' · ')
    into v_repetidos, v_detalle
  from (
    select 'nº ' || numero || ' (' || count(*) || ' recibos)' as detalle
      from cuotas
     where hermandad_id is not null
     group by hermandad_id, numero
    having count(*) > 1
     order by numero
     limit 20
  ) t;

  if coalesce(v_repetidos, 0) > 0 then
    raise warning 'NO se ha puesto el índice: ya hay números de recibo repetidos. %', v_detalle;
    raise warning 'Míralos en Cuotas, decide cuál se queda con cada número, corrige el otro y vuelve a ejecutar esto.';
    return;
  end if;

  /*
   * Por HERMANDAD, no global: cada una lleva su propia numeración y el recibo
   * nº 1 de una no tiene nada que ver con el nº 1 de la otra.
   *
   * Y NO por ejercicio, aunque parezca lo natural: la aplicación numera
   * seguido, sin reiniciar cada año (`emitirCuotasAnuales` coge el mayor de
   * TODOS y suma uno). Poner el índice por ejercicio dejaría pasar dos recibos
   * con el mismo número en años distintos, que es exactamente lo que la
   * tesorería no puede distinguir cuando busca «el 412» en el extracto.
   */
  create unique index cuotas_numero_por_hermandad
    on cuotas (hermandad_id, numero)
    where hermandad_id is not null;
  raise notice 'Puesto: a partir de ahora no puede haber dos recibos con el mismo número.';
end $$;

comment on table cuotas is
  'Recibos de cuota. El número es único por hermandad: va impreso en el justificante '
  'del hermano y es por lo que pregunta la tesorería al cuadrar el banco. Se podían '
  'crear dos con el mismo número emitiendo desde dos ordenadores a la vez.';

-- =============================================================================
--   BORRAR-UNA-HERMANDAD.SQL — Que una hermandad se pueda borrar (el registro lo impedía)
-- =============================================================================

-- ============================================================================
--   UNA HERMANDAD NO SE PODÍA BORRAR
-- ============================================================================
--
-- `delete from hermandades where id = ...` fallaba entero y no borraba nada:
--
--   ERROR:  insert or update on table "registro_actividad" violates foreign
--           key constraint "registro_actividad_hermandad_id_fkey"
--   DETAIL: Key (hermandad_id)=(…) is not present in table "hermandades".
--   CONTEXT: PL/pgSQL function apuntar_cambio() line 32
--
-- LA CADENA. Borrar la hermandad arrastra en cascada su censo, sus cuotas, sus
-- papeletas y sus apuntes. Cada una de esas bajas dispara `apuntar_cambio()`
-- —el registro de «quién hizo qué», que existe por el artículo 32 del RGPD—, y
-- ese disparador intenta escribir una fila de registro CON EL ID DE LA
-- HERMANDAD. Que ya no está. La clave ajena lo rechaza y se cae el borrado
-- completo.
--
-- DÓNDE MUERDE. En `BORRAR-PRUEBAS.sql`, que es justo el archivo que se ejecuta
-- para quitar las hermandades de prueba cuando entra la primera de verdad. Se
-- lanza, da un error largo de clave ajena que no dice nada de esto, y las
-- hermandades de prueba siguen ahí.
--
-- EL ARREGLO. Si la hermandad ya no existe, no se apunta nada y se sigue.
-- No es que se pierda el rastro: es que el rastro de una hermandad que se ha
-- ido no tiene dónde vivir —la propia tabla de registro se borra con ella— y
-- lo que hay que conservar de un borrado así es la copia de seguridad, no una
-- línea de registro huérfana.
--
-- Se toca SOLO el disparador. La cascada, las claves ajenas y el registro se
-- quedan como estaban.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

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
  v_hermandad uuid;
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

  v_hermandad := coalesce((fila->>'hermandad_id')::uuid, hermandad_actual());

  /*
   * SI LA HERMANDAD YA NO ESTÁ, NO SE APUNTA NADA.
   *
   * Es el caso de borrar una hermandad entera: la cascada va bajando sus
   * hermanos, cuotas y papeletas, cada baja dispara esto, y esto intentaba
   * escribir una fila de registro con el id de una hermandad que acaba de
   * desaparecer. La clave ajena lo rechazaba y se caía el borrado completo,
   * dejando la hermandad donde estaba y un error que no explicaba nada.
   *
   * No se pierde ningún rastro que hiciera falta: la tabla de registro también
   * se borra con la hermandad, así que esa fila no habría durado ni un
   * instante. Lo que conserva un borrado de estos es la copia de seguridad.
   *
   * Y el caso normal —una baja suelta, un recibo anulado— no cambia: ahí la
   * hermandad existe y se apunta igual que siempre.
   */
  if v_hermandad is null or not exists (select 1 from hermandades where id = v_hermandad) then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  insert into registro_actividad
    (hermandad_id, autor_id, autor_nombre, accion, sobre_tipo, sobre_id, sobre_nombre, detalle, origen)
  values (
    v_hermandad,
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
  'Escribe el registro de «quién hizo qué» (RGPD art. 32) al crear, cambiar o borrar '
  'una fila. Si la hermandad ya no existe —se está borrando entera— no apunta nada: '
  'antes intentaba escribir una fila huérfana y la clave ajena tiraba el borrado completo.';

-- =============================================================================
--   DOCUMENTOS-RESTRINGIDOS.SQL — Que el documento restringido lo sea también en la base
-- =============================================================================

-- ============================================================================
--   EL DOCUMENTO «RESTRINGIDO» LO ENTREGABA LA BASE A CUALQUIERA
-- ============================================================================
--
-- El Archivo deja marcar un documento como restringido y elegir a qué cargos:
-- «Expediente disciplinario — visible solo para Hermano Mayor y Fiscal». La
-- pantalla lo respeta, pinta el candado, y a quien no está en la lista le
-- enseña «Documento restringido» en vez del contenido.
--
-- La base de datos no pedía nada de eso. Su política de lectura decía:
--
--     using (not auth_es_hermano() and modulo_permitido('archivo'))
--
-- O sea: cualquiera con el módulo de archivo —Hermano Mayor, Secretario/a y
-- Fiscal— se llevaba TODOS los documentos, con su nombre, su categoría y su
-- descripción. Comprobado: la Secretaria, que no figura en ninguna de las dos
-- listas, recibe los dos expedientes con el título completo.
--
-- Y no hace falta ni abrir la consola. El panel carga la tabla entera para
-- pintarla, así que los documentos restringidos ya están dentro de la página y
-- en la copia del navegador: se ven abriendo el almacenamiento local, que es
-- dos clics.
--
-- ES EL MISMO FALLO DE SIEMPRE, otra vez: lo que esconde la pantalla no
-- protege nada. Ya pasó con la ficha del hermano, con las cuotas y con la web
-- pública. Aquí duele especialmente porque lo que se restringe es justo lo que
-- no puede salir: un expediente, un informe reservado, una carta del obispado.
--
-- CÓMO QUEDA
--
-- Se añade la condición que faltaba, con el mismo criterio EXACTO que la
-- pantalla: se ve si el documento no está restringido, o si tu cargo está en
-- su lista. Sin excepciones, tampoco para el cargo más alto — es lo que dice
-- el comentario de `canView` en `Archivo.tsx` y lo que promete el aviso que lee
-- la persona: «Visible solo para: …».
--
-- SI ALGUIEN SE DEJA FUERA A SÍ MISMO —restringe un documento a un cargo que
-- luego cambia de manos— deja de verlo y ya no puede editar la lista, porque
-- para editarla hay que verlo. Se sale desde aquí, desde el editor SQL:
--
--     update documentos set cargos_con_acceso = null where numero = 412;
--
-- Es a propósito que la salida esté fuera de la aplicación: si estuviera
-- dentro, no sería una restricción.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

/**
 * El cargo de quien está preguntando.
 *
 * Por los dos sitios donde puede llevarlo, y en este orden, que es el mismo que
 * usa la aplicación (`cargosEfectivos` en `lib/personal.ts`):
 *
 *   1. su fila de `personal`, que es la cuenta con la que entra al panel;
 *   2. el cargo escrito en su ficha del censo.
 *
 * Manda la de personal cuando están las dos: es la que decide qué ve al entrar.
 * Y las filas desactivadas no cuentan — a quien se le ha quitado el acceso ya
 * no lleva ese cargo.
 */
create or replace function mi_cargo() returns text
  language sql stable security definer set search_path = public as $$
    select coalesce(
      (select p.cargo from personal p
        where p.auth_user_id = auth.uid() and p.activo limit 1),
      (select h.cargo from hermanos h
        where h.auth_user_id = auth.uid() and h.cargo is not null and h.estado <> 'Baja' limit 1)
    )
  $$;
grant execute on function mi_cargo() to authenticated;

comment on function mi_cargo() is
  'El cargo de quien pregunta: primero su fila de personal (la cuenta con la que entra), '
  'y si no, el cargo de su ficha del censo. Mismo orden que cargosEfectivos() en la '
  'aplicación, para que la base y la pantalla no puedan contestar cosas distintas.';

/**
 * ¿Puedo ver este documento?
 *
 * `cargos_con_acceso` a NULL es un documento institucional: lo ve todo el que
 * tenga el módulo de archivo. Con lista, hay que estar en ella.
 *
 * Va como función y no escrita dentro de la política porque la usan las cuatro
 * —leer, crear, cambiar y borrar—, y tenerla cuatro veces es tenerla arreglada
 * en unas y rota en otras.
 */
create or replace function puedo_ver_documento(p_cargos text[]) returns boolean
  language sql stable security definer set search_path = public as $$
    select p_cargos is null
        or array_length(p_cargos, 1) is null
        or mi_cargo() = any(p_cargos)
  $$;
grant execute on function puedo_ver_documento(text[]) to authenticated;

-- LEER. Es la que de verdad estaba abierta.
drop policy if exists "documentos_staff_select" on documentos;
create policy "documentos_staff_select" on documentos for select to authenticated
  using (
    not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_ver_documento(cargos_con_acceso)
  );

/*
 * Y CAMBIARLO Y BORRARLO TAMBIÉN, que si no la restricción es de mentira: sin
 * esto, quien no puede leer el expediente sí puede borrarlo, o quitarle la
 * restricción y leerlo después. `with check` mira la fila COMO QUEDA, para que
 * nadie se saque a sí mismo de la lista de un documento que sí ve y luego se
 * quede sin poder devolverlo — y sobre todo para que nadie meta un documento
 * restringido a un cargo del que no forma parte.
 */
drop policy if exists "documentos_staff_update" on documentos;
create policy "documentos_staff_update" on documentos for update to authenticated
  using (
    not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_ver_documento(cargos_con_acceso)
  )
  with check (
    not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_ver_documento(cargos_con_acceso)
  );

drop policy if exists "documentos_staff_delete" on documentos;
create policy "documentos_staff_delete" on documentos for delete to authenticated
  using (
    not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_ver_documento(cargos_con_acceso)
  );

comment on column documentos.cargos_con_acceso is
  'Cargos que pueden ver este documento. NULL = institucional, lo ve quien tenga el '
  'módulo de archivo. Con lista, la base lo comprueba de verdad: antes solo lo hacía la '
  'pantalla, y el panel se descargaba todos los documentos igualmente.';

-- ============================================================================
--   Y EL PDF, QUE ES LO QUE DE VERDAD NO PUEDE SALIR
-- ============================================================================
--
-- Todo lo de arriba tapa LA FICHA del documento: su nombre, su categoría, su
-- descripción. Y estaba a medias, porque el expediente no es la ficha: es el
-- PDF escaneado que cuelga de ella, y ese vivía en el almacén con otra
-- política, puesta en `multi-hermandad.sql`, que solo miraba dos cosas:
--
--     bucket_id = 'documentos'
--     and split_part(name, '/', 1) = hermandad_actual()::text
--     and not auth_es_hermano()
--
-- O sea: separa una hermandad de otra —eso sí— y deja fuera al hermano de a
-- pie. Pero DENTRO de la hermandad no distingue: cualquiera de la junta se
-- descarga cualquier adjunto, incluido el del expediente que la pantalla le
-- esconde y que la política de arriba le acaba de negar.
--
-- COMPROBADO, con la Secretaria y un expediente restringido al Hermano Mayor:
--
--     la fila del expediente ..... no la ve      ✓ como debe ser
--     el PDF de ese expediente ... SÍ lo alcanza ✗
--     y al listar la carpeta ..... ve el fichero ✗ de ahí saca el id
--
-- Y ese último renglón es el que lo hace fácil: el nombre del fichero ES el id
-- del documento, así que listando la carpeta —una llamada, la misma que usa la
-- aplicación en `lib/filestore.ts`— se tiene la lista de todo lo que hay y se
-- descarga uno por uno. No hace falta adivinar nada.
--
-- Es EL MISMO FALLO DE SIEMPRE una vez más, y van unas cuantas: lo que esconde
-- la pantalla no protege nada. Aquí se había arreglado la mitad visible y se
-- había dejado abierta la que guarda el contenido.

/**
 * ¿Puedo abrir el adjunto que se llama así?
 *
 * El nombre dentro del cubo es `<hermandad>/<id del documento>`, así que del
 * propio nombre se saca a qué documento pertenece y se le pregunta lo mismo
 * que a la ficha.
 *
 * SI NO HAY FICHA, SE DEJA PASAR, y no es un descuido. El adjunto se sube
 * ANTES de crear la fila (`Archivo.tsx` sube el fichero y después guarda el
 * documento), así que en ese instante no hay ficha que consultar todavía; y si
 * el guardado se cae por el camino queda un fichero huérfano que, sin esta
 * salida, no podría borrar ni quien lo subió. No abre nada: para que un
 * adjunto restringido quedara huérfano habría que borrar su ficha, y para
 * borrarla hay que poder verla — o sea, poder abrirlo ya.
 */
create or replace function puedo_abrir_el_adjunto(p_nombre text) returns boolean
  language sql stable security definer set search_path = public as $$
    select not exists (
        select 1 from documentos d where d.id::text = split_part(p_nombre, '/', 2)
      )
      or exists (
        select 1 from documentos d
         where d.id::text = split_part(p_nombre, '/', 2)
           and puedo_ver_documento(d.cargos_con_acceso)
      )
  $$;
grant execute on function puedo_abrir_el_adjunto(text) to authenticated;

/*
 * LEER Y ESCRIBIR PIDEN COSAS DISTINTAS, y tiene que ser así.
 *
 * `using` (descargar, listar, reemplazar, borrar) sí puede preguntar por la
 * ficha: a esas alturas existe.
 *
 * `with check` (subir) NO puede, porque cuando se sube todavía no hay ficha
 * —es el orden que lleva `Archivo.tsx`—. Exigirlo ahí no cerraría ningún
 * agujero y rompería toda subida de adjuntos, que es peor que el problema.
 * Lo que sí se le añade es el módulo de archivo, que es lo que se pide en las
 * otras cuatro políticas y aquí faltaba.
 */
drop policy if exists "documentos_mi_hermandad" on storage.objects;
create policy "documentos_mi_hermandad" on storage.objects for all to authenticated
  using (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) = hermandad_actual()::text
    and not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_abrir_el_adjunto(name)
  )
  with check (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) = hermandad_actual()::text
    and not auth_es_hermano()
    and modulo_permitido('archivo')
  );

-- =============================================================================
--   WEBHOOK-STRIPE.SQL — Que la suscripción se active cuando Stripe confirma el cobro, no antes
-- =============================================================================

-- ============================================================================
--   EL WEBHOOK DE STRIPE — que el cobro se sepa cuando el dinero entra, no antes
-- ============================================================================
--
-- Hoy la suscripción se activa cuando el navegador VUELVE de Stripe a
-- `/app?suscripcion=ok`. Eso no es lo mismo que haber cobrado: si alguien
-- cierra la pestaña a mitad, si la tarjeta se rechaza después de esa pantalla,
-- o si alguien pega esa URL sin haber pagado nada, la cuenta se activa igual.
--
-- Lo correcto es que Stripe avise DIRECTAMENTE al servidor cuando el cobro se
-- confirma de verdad — eso es un webhook— y que sea esa llamada, y no la vuelta
-- del navegador, la que active la suscripción.
--
-- `activar_suscripcion(...)` ya existía para esto («se ejecuta desde el editor
-- SQL, que es lo único que corre con permisos de administrador» decía el
-- comentario), pero estaba revocada de todo el mundo — ni siquiera
-- `service_role`, que es con la que habla la función del servidor, la podía
-- llamar. Aquí se le da el permiso que le faltaba y se le añaden dos columnas
-- que la tabla `suscripciones` ya tenía preparadas (`stripe_customer_id`,
-- `stripe_subscription_id`) y que nadie rellenaba todavía.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

/**
 * Activa la suscripción, ahora también con la referencia de Stripe.
 *
 * Los dos parámetros nuevos van AL FINAL y con valor por defecto: quien ya
 * llamaba a esta función a mano desde el editor SQL —para dar de alta a una
 * hermandad sin pasar por Stripe— sigue pudiendo hacerlo exactamente igual.
 *
 * SE BORRA LA VERSIÓN VIEJA PRIMERO. `create or replace` no vale aquí porque
 * cambia la lista de parámetros: sin el `drop`, Postgres se queda con DOS
 * funciones — la de cuatro parámetros y esta, de seis— y la de cuatro se
 * queda ahí, revocada de todo el mundo, como una puerta trasera que no lleva
 * a ningún sitio pero que confunde a quien lea el esquema.
 */
drop function if exists activar_suscripcion(uuid, text, text, date);
create or replace function activar_suscripcion(
  p_hermandad_id uuid,
  p_pack text default 'todo',
  p_periodo text default 'mensual',
  p_hasta date default null,
  p_stripe_customer text default null,
  p_stripe_subscription text default null
) returns void
language sql security definer set search_path = public as $$
  insert into suscripciones
    (hermandad_id, activa, pack, periodo, desde, hasta, stripe_customer_id, stripe_subscription_id, actualizada_en)
  values
    (p_hermandad_id, true, p_pack, p_periodo, current_date, p_hasta, p_stripe_customer, p_stripe_subscription, now())
  on conflict (hermandad_id) do update set
    activa = true, pack = excluded.pack, periodo = excluded.periodo, hasta = excluded.hasta,
    -- Sin pisar con NULL: si esta llamada no trae referencia de Stripe (el
    -- alta a mano desde el editor), no se borra la que ya hubiera.
    stripe_customer_id = coalesce(excluded.stripe_customer_id, suscripciones.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, suscripciones.stripe_subscription_id),
    actualizada_en = now()
$$;
revoke execute on function activar_suscripcion(uuid, text, text, date, text, text) from public;
revoke execute on function activar_suscripcion(uuid, text, text, date, text, text) from anon, authenticated;
-- Y AQUÍ ESTABA EL AGUJERO AL REVÉS: nunca se le dio el permiso a
-- `service_role`, que es la clave con la que habla el webhook. Sin esta línea,
-- la función existía, estaba bien escrita, y NADIE la podía llamar salvo quien
-- la ejecutara a mano en el editor SQL.
grant execute on function activar_suscripcion(uuid, text, text, date, text, text) to service_role;

/**
 * Resuelve la hermandad a partir de quién pagó, y activa.
 *
 * Stripe no sabe qué es una «hermandad»: sabe qué usuario abrió la sesión de
 * pago, porque `crear-suscripcion` se lo manda como `client_reference_id`
 * (ver ese archivo). Aquí se traduce ese id de usuario a su hermandad —por la
 * tabla `titulares`, que es quien puede contratar— y se activa la suya.
 *
 * Solo `service_role`: es el webhook quien la llama, nunca el navegador.
 */
create or replace function activar_suscripcion_por_usuario(
  p_usuario uuid,
  p_pack text,
  p_periodo text,
  p_stripe_customer text,
  p_stripe_subscription text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_hermandad uuid;
begin
  select hermandad_id into v_hermandad from titulares where auth_user_id = p_usuario;
  if v_hermandad is null then
    -- No se calla: si esto pasa es que Stripe ha confirmado un cobro que no
    -- se sabe a qué hermandad corresponde, y eso hay que poder verlo en los
    -- registros de la función en vez de perderlo en silencio.
    raise exception 'No se ha encontrado ninguna hermandad para el usuario %', p_usuario;
  end if;
  perform activar_suscripcion(v_hermandad, p_pack, p_periodo, null, p_stripe_customer, p_stripe_subscription);
end $$;
revoke all on function activar_suscripcion_por_usuario(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function activar_suscripcion_por_usuario(uuid, text, text, text, text) to service_role;

/**
 * Cancela por el id de suscripción de Stripe, para cuando Stripe avisa de que
 * se ha dado de baja o ha dejado de cobrarse (`customer.subscription.deleted`).
 *
 * Si no encuentra la fila no hace nada: puede ser una suscripción de prueba
 * en el panel de Stripe, o un evento repetido, y no hay nada que romper.
 */
create or replace function cancelar_suscripcion_por_stripe(p_stripe_subscription text) returns void
language sql security definer set search_path = public as $$
  update suscripciones set activa = false, actualizada_en = now()
   where stripe_subscription_id = p_stripe_subscription
$$;
revoke all on function cancelar_suscripcion_por_stripe(text) from public, anon, authenticated;
grant execute on function cancelar_suscripcion_por_stripe(text) to service_role;

comment on column suscripciones.stripe_customer_id is
  'El cliente de Stripe que pagó. La columna ya existía; nada la rellenaba hasta el webhook.';
comment on column suscripciones.stripe_subscription_id is
  'La suscripción de Stripe. Con ella se encuentra la fila cuando Stripe avisa de un '
  'impago o una baja, sin tener que volver a preguntar por el usuario.';

-- =============================================================================
--   MANDATOS-SEPA.SQL — El mandato SEPA firmado de verdad, por el propio hermano
-- =============================================================================

-- ============================================================================
--   EL MANDATO SEPA FIRMADO DE VERDAD
-- ============================================================================
--
-- El fichero de remesa (`pain.008`) ya se generaba bien, pero el identificador
-- de mandato (`MndtId`) se INVENTABA a partir del número de hermano, y la
-- fecha de firma se ponía como el 1 de enero de su año de antigüedad — no
-- porque nadie hubiera firmado ese día, sino como valor de partida razonable
-- mientras no hubiera nada mejor. Está avisado en el propio código de
-- `lib/sepa.ts` desde el principio.
--
-- Y no es un detalle de formato. Un adeudo directo SEPA exige que exista una
-- orden firmada por el titular de la cuenta autorizando el cargo, con esa
-- referencia concreta. Sin eso, si un hermano reclama un cargo a su banco
-- —lo que en SEPA se puede hacer hasta ocho semanas después, sin dar
-- explicaciones—, la hermandad no tiene nada que enseñar.
--
-- CÓMO QUEDA: el hermano firma desde SU área, con un clic sobre el texto legal
-- del mandato, igual que ya se hace con el consentimiento del boletín. Se
-- guarda quién, cuándo, con qué IBAN y qué texto aceptó exactamente.
--
--   · SOLO EL PROPIO HERMANO FIRMA EL SUYO. Ni la secretaría, ni un
--     familiar, ni una importación pueden fabricar una firma a nombre de
--     otro: es la persona titular de la cuenta la que da la orden.
--   · Un mandato firmado NO SE REESCRIBE. Tesorería puede revocarlo —cuando
--     el hermano lo pide en persona o por teléfono—, pero no cambiarle la
--     fecha ni el texto: eso falsificaría cuándo y qué se aceptó.
--   · SIN FIRMA VIGENTE PARA SU IBAN ACTUAL, EL RECIBO NO ENTRA EN LA REMESA.
--     Igual que pasó con el IBAN sin validar (`S5`): se cae de la lista con
--     su motivo a la vista, no en silencio.
--
-- Y ES A PROPÓSITO QUE NO HAGA FALTA REVOCAR NADA CUANDO CAMBIA EL IBAN. La
-- firma queda ligada al IBAN que tenía en ese momento; si la secretaría
-- corrige la cuenta después, esa firma vieja deja de encajar con la cuenta
-- actual —y por tanto deja de contar como vigente— sin que nadie tenga que
-- acordarse de anular nada a mano. Y si el IBAN vuelve a ser el de antes, la
-- firma antigua sigue siendo válida: nunca se retiró, solo dejó de encajar un
-- tiempo.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

create table if not exists mandatos_sepa (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  hermano_id uuid not null references hermanos(id) on delete cascade,
  -- Foto del IBAN en el momento de firmar. No es el IBAN de la ficha —ese
  -- puede cambiar después—: es lo que este mandato concreto autoriza.
  iban text not null,
  -- El identificador del mandato (MndtId en el XML), único y de verdad: sale
  -- del propio id de esta fila, no de datos que puedan repetirse.
  referencia text not null,
  texto_aceptado text not null default '',
  firmado_en timestamptz not null default now(),
  -- Puesta, no NULL: «este mandato ya no vale», lo dice tesorería cuando el
  -- hermano lo pide en persona. Nunca se puede volver a NULL: si hace falta
  -- domiciliar otra vez, se firma uno nuevo.
  revocado_en timestamptz
);

alter table mandatos_sepa enable row level security;

create unique index if not exists mandatos_sepa_referencia_uniq on mandatos_sepa (referencia);
-- Por hermano y por IBAN: es exactamente lo que se pregunta al montar una
-- remesa — «¿tiene este hermano, con ESTE IBAN, un mandato vigente?».
create index if not exists mandatos_sepa_hermano_iban_idx
  on mandatos_sepa (hermano_id, iban) where revocado_en is null;

/**
 * LO QUE PONE EL SERVIDOR, PASE LO QUE PASE.
 *
 * Lista BLANCA: en un INSERT solo puede venir de un hermano firmando la suya,
 * y todo lo que trae la fila lo pone la base, no quien escribe. En un UPDATE
 * solo tesorería puede tocar algo, y solo `revocado_en`.
 */
create or replace function mandatos_sepa_firma() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_hermano hermanos%rowtype;
begin
  if tg_op = 'INSERT' then
    /*
     * LA IDENTIDAD SALE DE LA FICHA, NO DE `auth_es_hermano()`.
     *
     * `auth_es_hermano()` contesta «¿esta cuenta gestiona, o es solo un
     * hermano de a pie?» — desde `hermano-con-cargo.sql` da FALSO en cuanto
     * el hermano lleva cualquier cargo (Fiscal, Vocal, diputado de tramo...),
     * a propósito, para que esa cuenta entre por el panel y no por el área.
     * Usarla aquí como comprobación de identidad dejaba a todo hermano con
     * cargo SIN PODER FIRMAR SU PROPIA DOMICILIACIÓN: la firma exigía ser
     * «hermano de a pie», y ser fiscal, vocal o diputado no te lo quita.
     *
     * Lo que hace falta aquí no es esa pregunta, sino la otra: «¿de quién es
     * esta ficha?» — y esa la sigue contestando `hermano_propio_id()` (ver su
     * comentario en `hermano-con-cargo.sql`: «Son dos preguntas distintas:
     * ¿qué puede tocar? y ¿cuál es su ficha?»), da igual el cargo que lleve.
     * Que `v_hermano.id = new.hermano_id` sea justo lo que pide la fila ya
     * impide que nadie firme la de otro; no hace falta nada más encima.
     */
    select * into v_hermano from hermanos where auth_user_id = auth.uid();
    if v_hermano.id is null then
      raise exception 'Esta cuenta no tiene ficha de hermano.';
    end if;
    if v_hermano.id <> new.hermano_id then
      raise exception 'No puedes firmar la domiciliación de otro hermano.';
    end if;
    if coalesce(v_hermano.iban, '') = '' then
      raise exception 'Tu ficha no tiene ninguna cuenta bancaria apuntada. Pide a secretaría que la añada antes de firmar.';
    end if;

    new.hermandad_id := v_hermano.hermandad_id;
    new.hermano_id := v_hermano.id;
    new.iban := v_hermano.iban;
    new.texto_aceptado := left(coalesce(nullif(trim(new.texto_aceptado), ''),
      'Autorizo a mi hermandad a presentar adeudos SEPA en mi cuenta según la orden dada.'), 2000);
    new.firmado_en := now();
    new.revocado_en := null;
    /*
     * EL IDENTIFICADOR DEL MANDATO SALE DEL PROPIO ID DE LA FILA.
     *
     * `new.id` ya está resuelto aquí: el valor por defecto (`gen_random_uuid()`)
     * se calcula ANTES de que corra un disparador BEFORE, así que se puede leer
     * y no hay que generar nada aparte.
     *
     * Y por qué del id y no del hermano, que es lo que hacía el código viejo:
     * un hermano puede firmar más de un mandato en su vida —cambia de banco,
     * se le corrige un IBAN mal tecleado— y cada firma es un mandato DISTINTO
     * para SEPA. Reutilizar el mismo identificador para dos cuentas diferentes
     * es justo el error que tenía el código anterior.
     *
     * 'MND' (3) + el UUID sin guiones (32) = 35, que es el máximo que admite
     * `MndtId` en el estándar (`Max35Text`).
     */
    new.referencia := 'MND' || replace(new.id::text, '-', '');
    return new;
  end if;

  -- UPDATE: solo tesorería, y solo para revocar.
  if auth_es_hermano() or not (modulo_permitido('cuotas') or modulo_permitido('tesoreria')) then
    raise exception 'Un mandato firmado no se modifica. Puede revocarlo quien lleva cuotas o tesorería.';
  end if;
  new.hermandad_id := old.hermandad_id;
  new.hermano_id := old.hermano_id;
  new.iban := old.iban;
  new.referencia := old.referencia;
  new.texto_aceptado := old.texto_aceptado;
  new.firmado_en := old.firmado_en;
  -- No se puede «desrevocar»: si ya estaba puesto, se queda puesto.
  if old.revocado_en is not null then
    new.revocado_en := old.revocado_en;
  elsif new.revocado_en is null then
    new.revocado_en := old.revocado_en;
  end if;
  return new;
end $$;

drop trigger if exists mandatos_sepa_firma on mandatos_sepa;
create trigger mandatos_sepa_firma
  before insert or update on mandatos_sepa
  for each row execute function mandatos_sepa_firma();

-- ---------------------------------------------------------------------------
-- Quién ve y quién toca
-- ---------------------------------------------------------------------------

drop policy if exists "solo_mi_hermandad" on mandatos_sepa;
create policy "solo_mi_hermandad" on mandatos_sepa as restrictive for all to authenticated
  using (hermandad_id = hermandad_actual())
  with check (hermandad_id = hermandad_actual());

-- Sin `auth_es_hermano()`: esa función da falso en cuanto el hermano lleva
-- cargo, y firmar o ver la propia domiciliación no depende de si gestionas
-- algo — depende solo de que la ficha sea la tuya, que es lo que comprueba
-- `hermano_propio_id()`. Ver el comentario del disparador, arriba.
drop policy if exists "el hermano firma la suya" on mandatos_sepa;
create policy "el hermano firma la suya" on mandatos_sepa for insert to authenticated
  with check (hermano_id = hermano_propio_id());

drop policy if exists "el hermano ve las suyas" on mandatos_sepa;
create policy "el hermano ve las suyas" on mandatos_sepa for select to authenticated
  using (hermano_id = hermano_propio_id());

drop policy if exists "quien lleva cuotas los lee" on mandatos_sepa;
create policy "quien lleva cuotas los lee" on mandatos_sepa for select to authenticated
  using (not auth_es_hermano() and (modulo_permitido('cuotas') or modulo_permitido('tesoreria')));

drop policy if exists "quien lleva cuotas revoca" on mandatos_sepa;
create policy "quien lleva cuotas revoca" on mandatos_sepa for update to authenticated
  using (not auth_es_hermano() and (modulo_permitido('cuotas') or modulo_permitido('tesoreria')));

-- Sin política de DELETE, a propósito: un mandato —firmado o revocado— es un
-- registro de lo que se autorizó, y eso no se borra. Igual que el registro de
-- actividad y los avisos al hermano.
grant select, insert, update on mandatos_sepa to authenticated;

comment on table mandatos_sepa is
  'La orden SEPA que el hermano firma desde su área, ligada al IBAN que tenía en ese '
  'momento. Antes el identificador de mandato y su fecha se inventaban a partir del '
  'número de hermano; sin un mandato de verdad, un cargo reclamado al banco no tenía '
  'nada detrás que enseñar.';

-- =============================================================================
--   ENCARGOS-REDES.SQL — Encargar un post y que se reparta solo entre la junta
-- =============================================================================

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

-- =============================================================================
--   TIENDA.SQL — La tienda: productos, ventas, stock y los asientos que generan
-- =============================================================================

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
    select d.porcentaje into v_pct
      from descuentos d
     where d.id = p_descuento_id
       and d.hermandad_id = v_hermandad
       and d.activo
       and (
         d.etiqueta is null
         or (p_hermano_id is not null and exists (
              select 1 from hermanos h
               where h.id = p_hermano_id
                 and h.hermandad_id = v_hermandad
                 and d.etiqueta = any (coalesce(h.etiquetas, array[]::text[]))
            ))
       );
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
    if v_prod.stock < v_cant then
      raise exception 'No quedan suficientes «%»: hay % y se piden %.',
        v_prod.nombre, v_prod.stock, v_cant;
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

  insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
  values (
    v_hermandad, v_num_mov + 1, to_char(now(), 'YYYY-MM-DD'),
    format('Venta en tienda %s-%s', p_serie, v_numero),
    'Otros ingresos', 'Ingreso', v_total,
    case when lower(p_forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
    'Pendiente', 'venta:' || v_venta
  );

  -- El gasto solo si de verdad costó algo: un artículo donado tiene coste 0 y
  -- un asiento de cero euros solo ensucia el libro.
  if v_coste > 0 then
    insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
    values (
      v_hermandad, v_num_mov + 2, to_char(now(), 'YYYY-MM-DD'),
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
create or replace function mover_stock(
  p_producto_id uuid,
  p_tipo text,          -- 'compra' | 'rotura' | 'ajuste' | 'devolucion'
  p_cantidad int,       -- positivo entra, negativo sale
  p_motivo text default ''
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_hermandad uuid := hermandad_actual();
  v_prod productos%rowtype;
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

  update productos set stock = stock + p_cantidad where id = v_prod.id;
  insert into movimientos_stock (hermandad_id, producto_id, tipo, cantidad, motivo, quien)
    values (v_hermandad, v_prod.id, p_tipo, p_cantidad, p_motivo, hermano_propio_id());

  return v_prod.stock + p_cantidad;
end $$;

revoke all on function mover_stock(uuid, text, int, text) from public, anon;
grant execute on function mover_stock(uuid, text, int, text) to authenticated;


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
create or replace function anular_venta(p_venta_id uuid, p_motivo text default '')
returns void
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
    return;  -- Ya estaba: anular dos veces no puede devolver el género dos veces.
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

  -- El contrario del ingreso: un gasto por lo que se devuelve.
  insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
  values (v_hermandad, v_num + 1, to_char(now(), 'YYYY-MM-DD'),
          format('Anulada la venta %s-%s', v_venta.serie, v_venta.numero),
          'Gastos varios menores', 'Gasto', v_venta.total,
          case when lower(v_venta.forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
          'Pendiente', 'anula-venta:' || p_venta_id);

  -- Y el contrario del coste, si lo hubo.
  if v_venta.coste_total > 0 then
    insert into movimientos (hermandad_id, numero, fecha, concepto, categoria, tipo, importe, cuenta, estado, origen)
    values (v_hermandad, v_num + 2, to_char(now(), 'YYYY-MM-DD'),
            format('Vuelve al almacén el género de %s-%s', v_venta.serie, v_venta.numero),
            'Otros ingresos', 'Ingreso', v_venta.coste_total,
            case when lower(v_venta.forma_pago) like '%efectivo%' then 'Caja' else 'Cuenta bancaria' end,
            'Pendiente', 'anula-coste-venta:' || p_venta_id);
  end if;

  update ventas set estado = 'Anulada',
         notas = trim(both ' ' from coalesce(notas, '') || ' · Anulada: ' || coalesce(p_motivo, ''))
   where id = p_venta_id;
end $$;

revoke all on function anular_venta(uuid, text) from public, anon;
grant execute on function anular_venta(uuid, text) to authenticated;
