-- ============================================================================
-- Gobergo — que la configuración de correo sea de la HERMANDAD, no del portátil
-- ============================================================================
--
-- QUÉ ARREGLA (auditoría de agosto de 2026)
--
-- «Configuración → Correo» (si está activo, a dónde se responde, y de qué
-- avisar) se guardaba SOLO en el navegador de quien lo activó.
--
--   El secretario lo activa en su portátil. Al día siguiente la tesorera,
--   desde el ordenador de la casa de hermandad, marca cuotas como pagadas. En
--   ESE navegador la configuración no existe, así que se lee la de fábrica
--   —correo apagado— y no sale ningún aviso. Sin error, sin mensaje: la lista
--   de destinatarios sale vacía y todo parece haber ido bien.
--
--   Y en su pantalla de Configuración tampoco aparece activado, así que ni
--   siquiera puede sospechar que lo está en otro sitio.
--
-- Va donde va el resto de la ficha de la hermandad, que es lo que ya se
-- comparte entre todos los que entran.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table hermandad_settings add column if not exists correo jsonb;

comment on column hermandad_settings.correo is
  'Configuración de envío de correo de la hermandad: '
  '{"activo":true,"responderA":"secretaria@...","avisaDe":{"comunicados":true,...}}. '
  'Vacío = sin configurar. Antes vivía en el navegador de quien la activó, así que '
  'desde cualquier otro ordenador no salía ningún aviso y nadie se enteraba.';
