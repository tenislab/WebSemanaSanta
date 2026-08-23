-- =============================================================================
-- Solo hace falta ejecutar esto SI ya habías corrido una versión anterior de
-- schema.sql (antes de que las fechas pasaran a texto y los "cargos con
-- acceso" / "redes" pasaran de tabla aparte a una columna). Como todavía no
-- hay datos reales en estas tablas, lo más simple es borrarlas y recrearlas.
--
-- Pasos:
--   1. Ejecuta este archivo entero en el SQL Editor.
--   2. Después, ejecuta schema.sql de nuevo (el actualizado).
--   3. Si ya habías creado los 3 usuarios de ejemplo en Authentication → Users,
--      no hace falta volver a crearlos: solo vuelve a ejecutar
--      seed-usuarios-ejemplo.sql para que la tabla `personal` se recree con
--      sus datos.
-- =============================================================================

drop table if exists documento_cargos cascade;
drop table if exists comunicado_redes cascade;
drop table if exists incidencias cascade;
drop table if exists documentos cascade;
drop table if exists comunicados cascade;
drop table if exists cuentas_sociales cascade;
drop table if exists papeletas cascade;
drop table if exists cuotas cascade;
drop table if exists tramos cascade;
drop table if exists enseres cascade;
drop table if exists personal cascade;
drop table if exists permisos_cargo cascade;
drop table if exists solicitudes_alta cascade;
drop table if exists conceptos_cuota cascade;
drop table if exists opciones_papeleta cascade;
drop table if exists catalogos cascade;
drop table if exists movimientos cascade;
drop table if exists hermanos cascade;
drop table if exists hermandad_settings cascade;
