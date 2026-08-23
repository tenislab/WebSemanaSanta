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
