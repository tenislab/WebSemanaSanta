-- =============================================================================
--   MIRAR SI LA COPIA ENCAJA **ANTES** DE VACIAR NADA
-- =============================================================================
--
-- EL PROBLEMA, QUE ES EL PEOR QUE TIENE LA APLICACIÓN
--
-- Restaurar va en este orden y no se puede cambiar:
--
--   1. Se descarga una copia de resguardo de lo que hay.
--   2. SE VACÍAN LAS TABLAS.
--   3. Se meten las filas del archivo, tabla por tabla.
--
-- Entre el 2 y el 3 la hermandad no tiene datos, y eso está asumido y contado
-- en `src/lib/restaurar.ts`. Lo que NO estaba resuelto es lo otro: si las filas
-- del archivo no encajan en la base —una columna que la copia trae y esta base
-- todavía no tiene— eso NO SE DESCUBRE HASTA EL PASO 3. O sea, después de
-- haber vaciado.
--
-- Y no es un caso rebuscado: es EL caso. La base de datos la actualiza cada
-- hermandad a mano pegando `ACTUALIZAR.sql`, así que «aplicación nueva, base
-- vieja» es el estado normal durante días o semanas —está contado entero en
-- `src/lib/versionEsquema.ts`—. Una copia hecha el martes, con la base ya al
-- día, volcada el jueves en un proyecto que se quedó atrás: las tablas se
-- vacían, los `insert` los rechaza Postgres uno a uno, y la hermandad se queda
-- con menos datos que antes de «restaurar».
--
-- Eso convierte la red de seguridad en la causa de la pérdida.
--
-- -----------------------------------------------------------------------------
-- LO QUE HACE ESTO
-- -----------------------------------------------------------------------------
--
-- Se le mandan SOLO LOS NOMBRES DE LAS COLUMNAS que trae la copia —unos cientos
-- de bytes, no el archivo, que pesa megas— y contesta cuáles no existen en esta
-- base. Si contesta algo, no se vacía nada y se dice qué falta.
--
-- POR QUÉ COMPARAR NOMBRES Y NO ENSAYAR UN `insert` DE VERDAD. Porque una
-- función no puede deshacer su propia transacción y devolver a la vez el
-- resultado: o revierte y se lleva la respuesta por delante, o responde y deja
-- las filas de ensayo metidas. Comparar contra el catálogo es exacto para el
-- fallo que de verdad pasa —la columna que no está— y no toca ni una fila.
--
-- Lo que NO caza: un tipo incompatible, o una restricción que rechace un valor
-- concreto. Son mucho más raros —las copias salen de la propia aplicación— y
-- para esos sigue estando el paso 1, la copia de resguardo.
--
-- Ejecútalo después de `restaurar-copia.sql`. Volver a ejecutarlo no hace nada.
-- =============================================================================

/**
 * ¿QUÉ COLUMNAS DE LA COPIA NO EXISTEN EN ESTA BASE?
 *
 * Se le pasa `{"hermanos": ["id","nombre",…], "cuotas": [...]}` y devuelve una
 * fila por cada columna que falta. Vacío = la copia encaja y se puede seguir.
 *
 * `security definer` para poder leer el catálogo, que un usuario normal no ve
 * entero. No hace falta acotar por hermandad: aquí no se lee ni se escribe ni
 * un dato de nadie, solo se miran nombres de columnas del esquema — que son los
 * mismos para todas las hermandades del proyecto.
 *
 * Se ignoran las tablas que no existen en absoluto: eso ya lo dice
 * `DIAGNOSTICO.sql` con mucho más detalle, y avisar aquí de una tabla entera
 * que falta sería mandar a arreglar el problema al sitio equivocado.
 */
create or replace function columnas_que_faltan_para_restaurar(p_columnas jsonb)
returns table (tabla text, columna text)
language sql stable security definer set search_path = public as $$
  select t.tabla, c.columna
    from jsonb_each(p_columnas) as t(tabla, cols)
    cross join lateral jsonb_array_elements_text(t.cols) as c(columna)
   where to_regclass('public.' || quote_ident(t.tabla)) is not null
     and not exists (
       select 1 from information_schema.columns ic
        where ic.table_schema = 'public'
          and ic.table_name = t.tabla
          and ic.column_name = c.columna
     )
$$;

grant execute on function columnas_que_faltan_para_restaurar(jsonb) to authenticated;
