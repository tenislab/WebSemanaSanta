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
