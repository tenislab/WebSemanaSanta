-- ============================================================================
-- Gobergo — el rastro de las remesas SEPA
-- ============================================================================
--
-- QUÉ ARREGLA (auditoría de agosto de 2026)
--
-- Descargar el fichero XML de la remesa no dejaba NINGÚN rastro en los
-- recibos. Seguían «Pendiente» y domiciliados, así que la semana siguiente el
-- tesorero abría «Preparar remesa» y ahí estaban otra vez, los mismos.
--
-- Dos ficheros al banco con los mismos recibos son DOS CARGOS al mismo
-- hermano. El segundo vuelve devuelto, con su comisión, y con la llamada del
-- hermano preguntando por qué se le ha cobrado dos veces la cuota.
--
-- Con esta columna, al descargar el fichero cada recibo queda marcado con la
-- fecha, y no vuelve a entrar en una remesa por su cuenta. Si el fichero no se
-- llegó a mandar, la propia pantalla ofrece devolverlos.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table cuotas add column if not exists remesada_el date;

comment on column cuotas.remesada_el is
  'Fecha en la que este recibo salió dentro de un fichero de remesa SEPA descargado. '
  'Vacío = todavía no ha ido en ninguna. Sirve para que no se cobre dos veces.';

-- Para poder listar rápido «los que ya van en una remesa» sin leer la tabla
-- entera. Parcial: los que no se han remesado (la mayoría) no ocupan índice.
create index if not exists cuotas_remesada_el_idx
  on cuotas (hermandad_id, remesada_el)
  where remesada_el is not null;
