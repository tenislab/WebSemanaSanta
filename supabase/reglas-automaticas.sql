-- =============================================================================
--   LAS REGLAS QUE SE DISPARAN SOLAS (felicitar el cumpleaños y compañía)
-- =============================================================================
--
-- Una REGLA es tres cosas juntas: un sesgo (a quién), una plantilla (qué se
-- dice) y un cuándo (todos los días, todos los meses…). Cuando le toca, crea un
-- comunicado programado para hoy — y a partir de ahí sigue el mismo camino que
-- cualquier otro comunicado programado, que ya está hecho y probado
-- (`envio-programado.sql`).
--
-- ESO ES LO IMPORTANTE DE ESTE FICHERO: no manda correo. Solo escribe el
-- comunicado. Todo lo delicado —el candado para que no salga dos veces, los
-- tres intentos, la personalización, el freno de las marcas mal escritas— ya
-- está resuelto una vez y no se vuelve a resolver aquí.
--
-- -----------------------------------------------------------------------------
-- POR QUÉ LAS REGLAS NACEN APAGADAS
-- -----------------------------------------------------------------------------
--
-- Porque una regla encendida manda correos EN NOMBRE DE LA HERMANDAD sin que
-- nadie los lea antes. Eso está bien para «feliz cumpleaños» y está mal para
-- casi todo lo demás.
--
-- Así que se crean apagadas, se ve qué habría hecho hoy, y se enciende cuando
-- se ha visto funcionar. Encender es un clic; deshacer ochocientos correos no
-- es nada.
--
-- -----------------------------------------------------------------------------
-- Y POR QUÉ NO SE MANDA DOS VECES EL MISMO DÍA
-- -----------------------------------------------------------------------------
--
-- `ultima_vez` guarda el día en que la regla se disparó por última vez, y no se
-- vuelve a disparar hasta que cambie. Es el mismo problema que el envío
-- programado —tres personas entran por la mañana— y se resuelve igual: la
-- condición va DENTRO del `update`, no en una pregunta previa.
--
-- Sin eso, felicitar el cumpleaños significaría felicitarlo una vez por cada
-- miembro de la junta que abra el panel esa mañana.
--
-- Ejecútalo después de `envio-programado.sql`. Volver a ejecutarlo no hace nada.
-- =============================================================================

create table if not exists reglas_automaticas (
  id uuid primary key default gen_random_uuid(),
  /*
   * `default hermandad_actual()` — Y ESTO SE ME OLVIDÓ, Y ROMPIÓ LA TABLA.
   *
   * El navegador NO manda `hermandad_id` al insertar, y es a propósito: lo pone
   * la base a partir de quién está pidiendo, no el contenido de lo que llega.
   * Todas las tablas de la hermandad se declaran así.
   *
   * Sin el `default`, la fila llegaba con `hermandad_id` vacío y RLS la
   * rechazaba: «new row violates row-level security policy». Y el mensaje que
   * salía en pantalla mandaba a mirar los permisos del cargo, que estaban
   * perfectamente — el fallo estaba aquí.
   */
  hermandad_id uuid not null default hermandad_actual() references hermandades(id) on delete cascade,
  /* Cómo la llama la hermandad: «Felicitar el cumpleaños». */
  nombre text not null,
  /*
   * CADA CUÁNTO SE MIRA.
   *
   *   'diaria'   — todos los días. Es la de los cumpleaños.
   *   'mensual'  — el día 1. Para «los que cumplen este mes».
   *
   * No hay más a propósito. Un calendario completo de repeticiones ya existe
   * para los eventos y es la parte más difícil de mantener que tiene la
   * aplicación; aquí no hace falta y no se copia.
   */
  cada text not null default 'diaria' check (cada in ('diaria', 'mensual')),
  /* El sesgo, tal cual lo guarda la aplicación (`CriteriosSegmento`). */
  criterios jsonb not null default '{}'::jsonb,
  /* Cómo se llama el segmento en cristiano, para el propio comunicado. */
  destinatarios text not null default '',
  asunto text not null default '',
  cuerpo text not null default '',
  /*
   * APAGADA AL NACER. Ver arriba: es la decisión que separa esto de una
   * máquina de mandar correos sin supervisión.
   */
  activa boolean not null default false,
  /* El último día en que se disparó. Es lo que impide repetirla. */
  ultima_vez date,
  creada_en timestamptz not null default now()
);

/*
 * Y PARA LAS BASES QUE YA EJECUTARON LA VERSIÓN SIN `default`.
 *
 * `create table if not exists` no toca una tabla que ya existe, así que a quien
 * pegó el SQL antes de este arreglo no le llegaría la corrección de arriba: se
 * quedaría con la tabla creada y sin poder escribir en ella nunca. Esta línea
 * es la que se lo arregla, y en una base nueva no hace nada.
 */
alter table reglas_automaticas alter column hermandad_id set default hermandad_actual();

alter table reglas_automaticas enable row level security;

/*
 * LAS VE Y LAS TOCA QUIEN LLEVA COMUNICADOS, y nadie más. Una regla es un
 * botón que escribe a los ochocientos hermanos: no puede tocarla cualquiera con
 * una cuenta.
 */
drop policy if exists reglas_de_mi_hermandad on reglas_automaticas;
create policy reglas_de_mi_hermandad on reglas_automaticas
  for all to authenticated
  using (hermandad_id = hermandad_actual() and modulo_permitido('comunicados'))
  with check (hermandad_id = hermandad_actual() and modulo_permitido('comunicados'));

create index if not exists reglas_activas_idx
  on reglas_automaticas (hermandad_id) where activa;

/**
 * ¿QUÉ REGLA TOCA HOY? Devuelve una y la marca como disparada.
 *
 * ===========================================================================
 * ES EL MISMO «COMPARE AND SWAP» QUE EL ENVÍO PROGRAMADO
 * ===========================================================================
 *
 * La condición de que no se haya disparado hoy va DENTRO del `update`. De tres
 * personas que abran el panel la misma mañana, la primera se la lleva y las
 * otras dos se van con las manos vacías.
 *
 * Preguntar antes y actualizar después NO valdría, y aquí se ve muy claro lo
 * que costaría: felicitar el cumpleaños una vez por cada miembro de la junta
 * que abra el panel.
 */
create or replace function reclamar_regla_de_hoy()
returns table (id uuid, nombre text, criterios jsonb, destinatarios text, asunto text, cuerpo text)
language sql volatile security definer set search_path = public as $$
  update reglas_automaticas r
     set ultima_vez = current_date
   where r.id = (
     select x.id from reglas_automaticas x
      where x.hermandad_id = hermandad_actual()
        and x.activa
        -- No se ha disparado hoy. `is null` es la primera vez de todas.
        and (x.ultima_vez is null or x.ultima_vez < current_date)
        -- Y si es mensual, solo el día 1.
        and (x.cada = 'diaria' or extract(day from current_date) = 1)
      order by x.creada_en
      limit 1
      for update skip locked
   )
  returning r.id, r.nombre, r.criterios, r.destinatarios, r.asunto, r.cuerpo
$$;

grant execute on function reclamar_regla_de_hoy() to authenticated;

/**
 * SI LA REGLA NO LLEGÓ A CREAR SU COMUNICADO, SE DESMARCA.
 *
 * Que se la lleve alguien y luego falle —sin red, un sesgo que no se resuelve—
 * no puede dejarla marcada como hecha: se perdería la felicitación de ese día
 * y no habría forma de saberlo.
 *
 * Se devuelve al día anterior en vez de a vacío: dejarla en `null` la haría
 * parecer recién creada, y se perdería el dato de cuándo funcionó por última
 * vez, que es lo que dice si una regla lleva un mes sin hacer nada.
 */
create or replace function devolver_regla(p_id uuid)
returns void
language sql volatile security definer set search_path = public as $$
  update reglas_automaticas
     set ultima_vez = current_date - 1
   where id = p_id and hermandad_id = hermandad_actual()
$$;

grant execute on function devolver_regla(uuid) to authenticated;
