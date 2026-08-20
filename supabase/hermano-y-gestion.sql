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
