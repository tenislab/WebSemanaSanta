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
