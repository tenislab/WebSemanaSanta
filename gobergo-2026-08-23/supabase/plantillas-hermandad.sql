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
