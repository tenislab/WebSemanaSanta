-- =============================================================================
--   LA VERSIÓN DEL ESQUEMA: PODER ACTUALIZAR SIN ROMPER NADA
-- =============================================================================
--
-- SI ERES UN PROGRAMADOR Y ACABAS DE LLEGAR, EMPIEZA POR AQUÍ.
--
-- -----------------------------------------------------------------------------
-- EL PROBLEMA QUE RESUELVE
-- -----------------------------------------------------------------------------
--
-- Gobergo tiene una aplicación (el navegador) y una base de datos (Supabase), y
-- se actualizan POR SEPARADO:
--
--   · La aplicación se despliega y a los cinco minutos todo el mundo tiene la
--     versión nueva, quiera o no.
--   · La base de datos la actualiza cada hermandad a mano, pegando
--     `ACTUALIZAR.sql` en el SQL Editor de su proyecto de Supabase. Cuando se
--     acuerda. Si se acuerda.
--
-- O sea que existe, siempre, una ventana en la que la aplicación es más nueva
-- que la base. Y lo que pasaba en esa ventana era lo peor que puede pasar:
--
--   La aplicación escribe en una columna que todavía no existe. Postgres NO
--   ignora la columna de más: RECHAZA LA SENTENCIA ENTERA. No se pierde ese
--   dato — no se guarda la fila. El tramo entero. El cobro entero. Y en
--   pantalla no pasa nada raro: se rellena el formulario, se le da a guardar,
--   dice que se ha guardado, y al recargar está en blanco.
--
-- Eso llegó reportado como «pongo la hora de citación y al recargar está en
-- blanco», y hasta que se localizó no había forma de saber que la causa era
-- una base sin actualizar. La aplicación no tenía manera de saberlo tampoco.
--
-- -----------------------------------------------------------------------------
-- LA SOLUCIÓN: QUE LA BASE DIGA POR QUÉ VERSIÓN VA
-- -----------------------------------------------------------------------------
--
-- Una tabla con un número. `ACTUALIZAR.sql` y `TODO-EN-UNO.sql` lo sellan al
-- final, cuando ya han pasado todas las piezas. La aplicación lo lee al
-- arrancar y lo compara con el que ella necesita (`src/lib/versionEsquema.ts`).
--
--   · Si coinciden, no pasa nada y no se ve nada.
--   · Si la base va por detrás, sale una banda arriba que lo dice con todas
--     las letras y explica qué hay que pegar en Supabase.
--
-- No es un arreglo: es convertir un fallo MUDO en un aviso. Que es todo lo que
-- se puede hacer desde el lado del navegador, y es muchísimo.
--
-- -----------------------------------------------------------------------------
-- CÓMO SE SUBE LA VERSIÓN CUANDO AÑADES UNA PIEZA
-- -----------------------------------------------------------------------------
--
-- No se sube a mano, y ese es el punto. LA VERSIÓN ES EL NÚMERO DE PIEZAS del
-- instalador (`scripts/generar-todo-en-uno.mjs`, la lista `PIEZAS`). Añadir un
-- fichero .sql a esa lista sube la versión sola.
--
-- Lo único que tienes que hacer tú es poner el mismo número en
-- `src/lib/versionEsquema.ts`. Y si se te olvida, `npm test` te lo dice por su
-- nombre: hay una prueba que compara los dos.
--
-- POR QUÉ ASÍ Y NO CON UN NÚMERO INVENTADO. Porque un número que hay que
-- acordarse de subir es un número que se olvida, y el día que se olvida el
-- aviso deja de salir justo cuando hacía falta. Derivarlo de la lista de
-- piezas lo hace imposible de olvidar.
--
-- Ejecutar esto dos veces no hace nada. Como todo lo demás.
-- =============================================================================

/*
 * UNA TABLA DE CLAVE Y VALOR, no una columna suelta en otro sitio.
 *
 * Hoy solo guarda `version`, y podría ser una fila y ya está. Se deja abierta
 * a propósito: el día que haga falta apuntar «cuándo se actualizó por última
 * vez» o «qué pieza falló», va aquí sin migrar nada.
 */
create table if not exists esquema_gobergo (
  clave text primary key,
  valor integer not null,
  sellado_el timestamptz not null default now()
);

/*
 * NO LLEVA `hermandad_id`, Y ES A PROPÓSITO.
 *
 * Todas las hermandades comparten la misma base de datos y por tanto el mismo
 * esquema: la versión es UNA para todas. Meterle `hermandad_id` daría a
 * entender que cada hermandad puede ir por su versión, y no es verdad — no se
 * puede tener la columna `fecha_baja` para unas sí y otras no.
 */
alter table esquema_gobergo enable row level security;

/*
 * LO LEE CUALQUIERA QUE HAYA ENTRADO, y también quien no.
 *
 * `anon` incluido, y hace falta: la web pública de la hermandad se pinta sin
 * sesión, y si la base está atrasada quien la mantiene tiene que poder verlo
 * desde ahí también. No hay nada que proteger: es un número entero que no
 * dice absolutamente nada de nadie.
 */
drop policy if exists "esquema_leer" on esquema_gobergo;
create policy "esquema_leer" on esquema_gobergo
  for select to authenticated, anon using (true);

/*
 * ESCRIBIRLO NO PUEDE NADIE DESDE LA APLICACIÓN.
 *
 * No hay política de insert ni de update: con RLS encendida y sin política,
 * Postgres deniega. El único que sella es el propio `ACTUALIZAR.sql`, que se
 * ejecuta en el SQL Editor con permisos de dueño y se salta RLS.
 *
 * Si la aplicación pudiera sellar, el número dejaría de significar «lo que hay
 * puesto en la base» para significar «lo que la aplicación cree», que es
 * exactamente el dato que no sirve.
 */

/**
 * Sella la versión. La llama el final de `ACTUALIZAR.sql` y de
 * `TODO-EN-UNO.sql`, generada por los scripts; no la llames a mano.
 */
create or replace function sellar_esquema(n integer) returns void
language sql security definer set search_path = public as $$
  insert into esquema_gobergo (clave, valor, sellado_el)
  values ('version', n, now())
  on conflict (clave) do update
    set valor = excluded.valor, sellado_el = excluded.sellado_el
$$;

/**
 * Por qué versión va la base. Devuelve 0 si nunca se ha sellado, que es lo que
 * le pasa a toda hermandad que montó su base antes de que esto existiera: no
 * es un error, es «no lo sé todavía», y la aplicación lo trata como tal.
 */
create or replace function version_del_esquema() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select valor from esquema_gobergo where clave = 'version'), 0)
$$;

grant execute on function version_del_esquema() to authenticated, anon;
