-- Añade el campo Provincia a los datos de la hermandad, para el Estado de
-- Cuentas anual. Seguro de ejecutar sobre una base ya en uso.
alter table hermandad_settings add column if not exists provincia text not null default '';
