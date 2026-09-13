/**
 * EL POSTGRES DE LAS PRUEBAS, COMPARTIDO.
 *
 * Esto vivía dentro de `basedatos.prueba.mjs` y solo lo podía usar esa prueba.
 * La de actualizar desde una versión antigua necesita lo mismo —conectar,
 * ejecutar un fichero, montar lo que Supabase trae de fábrica—, y copiarlo
 * habría dejado dos arneses que se separan con el tiempo: el día que Supabase
 * cambie algo, se arregla en uno y el otro miente.
 *
 * No es una prueba: no acaba en `.prueba.mjs` y el corredor no lo ejecuta.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const correr = promisify(execFile)

/** El puerto donde las pruebas buscan su Postgres. Se puede cambiar por entorno. */
export const PUERTO = process.env.GOBERGO_PG_PUERTO ?? '5433'
export const USUARIO = process.env.GOBERGO_PG_USUARIO ?? 'postgres'

export async function hayPostgres() {
  try {
    await correr('psql', ['-p', PUERTO, '-U', USUARIO, '-tAc', 'select 1'], {
      env: { ...process.env, PGCONNECT_TIMEOUT: '3' },
    })
    return true
  } catch {
    return false
  }
}

/**
 * Ejecuta SQL contra la base y devuelve lo que imprime psql, sin adornos.
 * Con `ON_ERROR_STOP`: el primer error LANZA, con el texto de Postgres en
 * `e.stderr`. Es lo que hace que una pieza rota se note.
 */
export async function sql(texto) {
  const dir = await mkdtemp(join(tmpdir(), 'gobergo-sql-'))
  const f = join(dir, 'consulta.sql')
  await writeFile(f, texto)
  try {
    const { stdout } = await correr(
      'psql',
      ['-p', PUERTO, '-U', USUARIO, '-v', 'ON_ERROR_STOP=1', '-tA', '-f', f],
      { maxBuffer: 32 * 1024 * 1024 },
    )
    return stdout.trim()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Las líneas de error de un fallo de psql, en una sola, para leerlas en un `caso`. */
export function loQueDijoPostgres(e) {
  return String(e?.stderr ?? e?.message ?? e).split('\n').filter((l) => /ERROR/.test(l)).join(' · ') || String(e)
}

/**
 * LO QUE SUPABASE TRAE DE FÁBRICA, montado igual aquí.
 *
 * Los esquemas `auth` y `storage`, `pgcrypto` en `extensions` (no en `public`:
 * ver el comentario de dentro, costó una recuperación de contraseña rota en la
 * hermandad piloto), `auth.uid()` leyendo de un ajuste de sesión para que una
 * prueba pueda hacerse pasar por alguien, y los tres roles.
 */
export async function montarLoQuePoneSupabase() {
  await sql(`
    create schema if not exists auth;
    create schema if not exists storage;

    /*
     * PGCRYPTO VA EN «extensions», COMO EN SUPABASE. No es un detalle.
     *
     * Aquí no se instalaba, así que el «create extension if not exists
     * pgcrypto» de nuestro SQL la instalaba en «public» y todo funcionaba. En
     * Supabase viene ya instalada de fábrica EN EL ESQUEMA «extensions», así
     * que ese mismo «if not exists» no hace nada — y una función declarada con
     * «set search_path = public» no la ve.
     *
     * Resultado: «function gen_random_bytes(integer) does not exist» en la
     * hermandad piloto, con la recuperación de contraseña del hermano rota, y
     * las pruebas en verde. Montándolo como está allí, se cae aquí primero.
     */
    create schema if not exists extensions;
    create extension if not exists pgcrypto with schema extensions;

    -- Las columnas que usa NUESTRO SQL, con el mismo nombre que allí.
    -- «last_sign_in_at» la lee el diagnóstico para ordenar las cuentas por la
    -- última que entró, que casi siempre es la que dio el error.
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      last_sign_in_at timestamptz
    );
    alter table auth.users add column if not exists last_sign_in_at timestamptz;

    -- La cuenta que está haciendo la consulta. En Supabase sale del token; aquí,
    -- de un ajuste de sesión, para que una prueba pueda hacerse pasar por alguien.
    -- Mira los dos sitios: «request.jwt.claim.sub» es de donde lo saca
    -- Supabase, y «test.uid» es el que usa «supabase/PRUEBA-AISLAMIENTO.sql»,
    -- que se escribió antes y se ejecuta a mano contra esta misma base.
    create or replace function auth.uid() returns uuid
      language sql stable as $$
        select coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          nullif(current_setting('test.uid', true), '')
        )::uuid
      $$;

    create or replace function auth.jwt() returns jsonb
      language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
      $$;

    create table if not exists storage.buckets (
      id text primary key,
      name text,
      public boolean default false
    );
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text,
      owner uuid
    );
    alter table storage.objects enable row level security;

    -- «hermandad/2026/escaneo.pdf» → {hermandad, 2026}. La última parte es el
    -- fichero y no cuenta: las políticas miran la PRIMERA, que es la carpeta
    -- de la hermandad.
    create or replace function storage.foldername(name text) returns text[]
      language sql immutable as $$
        select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
      $$;

    -- Roles de Supabase: las concesiones del SQL los nombran.
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
    end $$;
    grant usage on schema public to anon, authenticated, service_role;
    grant usage on schema storage to anon, authenticated, service_role;
    -- Y sobre «auth», que Supabase también lo concede: sin esto, cualquier
    -- función que llame a auth.uid() sin ser SECURITY DEFINER falla aquí y no
    -- allí, que es la peor manera de que se rompa una prueba.
    grant usage on schema auth to anon, authenticated, service_role;
  `)
}

/**
 * Y los PERMISOS DE TABLA, que van después de crearlas.
 *
 * Supabase se los da de fábrica a `anon` y `authenticated` sobre todo lo que
 * hay en `public`; las políticas de seguridad son lo que acota después QUÉ
 * filas ve cada uno. Sin este paso, todo falla con «permission denied», que no
 * es lo que se quiere comprobar: se quiere comprobar qué dicen las políticas,
 * no si hay permiso de tabla.
 */
export async function darLosPermisosDeSupabase() {
  await sql(`
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    grant all on all tables in schema storage to anon, authenticated, service_role;
  `)
}

/** Una base limpia del todo, con lo de Supabase puesto y nada nuestro. */
export async function baseLimpia() {
  await sql('drop schema if exists public cascade; create schema public;')
  await montarLoQuePoneSupabase()
}

/**
 * LA FOTO DEL CATÁLOGO: todo lo que define el esquema, como texto ordenado.
 *
 * Para comparar dos bases sin mirar los datos: la que viene de instalar una
 * versión antigua y actualizar, y la que viene de instalar la de hoy desde
 * cero. Si el texto es el mismo, actualizar deja la base IGUAL que instalar —
 * que es la promesa de `ACTUALIZAR.sql` y lo que nadie había comprobado.
 *
 * Qué entra: tablas y columnas (tipo, nulabilidad, valor por defecto), si la
 * tabla tiene RLS, las políticas enteras, los índices, los disparadores, las
 * funciones con su firma, lo que devuelven y sus permisos para `anon` y
 * `authenticated`, y los cubos de ficheros. Qué NO entra: los datos, los
 * `oid` y todo lo que cambia entre dos bases iguales.
 */
export async function fotoDelCatalogo() {
  return sql(`
    select 'columna ' || c.table_name || '.' || c.column_name || ' ' || c.data_type
           || case when c.character_maximum_length is not null then '(' || c.character_maximum_length || ')' else '' end
           || ' ' || c.is_nullable || ' ' || coalesce(c.column_default, '-')
      from information_schema.columns c
     where c.table_schema = 'public'
    union all
    select 'tabla ' || t.tablename || ' rls=' || t.rowsecurity
      from pg_tables t where t.schemaname = 'public'
    union all
    select 'politica ' || p.tablename || '.' || p.policyname || ' ' || p.cmd || ' ' || array_to_string(p.roles, ',')
           || ' using=' || coalesce(p.qual, '-') || ' check=' || coalesce(p.with_check, '-')
      from pg_policies p where p.schemaname = 'public'
    union all
    select 'indice ' || i.indexdef from pg_indexes i where i.schemaname = 'public'
    union all
    select 'disparador ' || c.relname || '.' || t.tgname || ' ' || pg_get_triggerdef(t.oid)
      from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal
    union all
    select 'funcion ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') -> '
           || pg_get_function_result(p.oid)
           || ' definer=' || p.prosecdef::text || ' vol=' || p.provolatile::text
           || ' anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
           || ' auth=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
    union all
    select 'cubo ' || b.id || ' publico=' || coalesce(b.public::text, '-') from storage.buckets b
    order by 1
  `)
}

/** Las líneas que están en una foto y no en la otra, para leer la diferencia. */
export function diferenciaDeFotos(a, b) {
  const A = new Set(a.split('\n')), B = new Set(b.split('\n'))
  return {
    soloEnA: [...A].filter((l) => !B.has(l)),
    soloEnB: [...B].filter((l) => !A.has(l)),
  }
}
