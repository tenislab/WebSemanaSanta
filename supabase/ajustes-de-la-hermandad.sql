-- ============================================================================
--   DOS AJUSTES QUE VIVÍAN EN UN SOLO NAVEGADOR
-- ============================================================================
--
-- Mismo problema que tenían el modelo de papeleta y la hoja de asistencia
-- —arreglado en `plantillas-hermandad.sql`— en otros dos sitios que se
-- quedaron atrás. Los dos son decisiones DE LA HERMANDAD, no preferencias de
-- quien está delante del ordenador, y los dos vivían en `localStorage`.
--
-- 1. LOS AJUSTES DE CUOTAS, y este es de dinero.
--
--    `bloquearPapeletaConDeuda` — «a quien deba cuotas no se le saca papeleta».
--    La hermandad lo decide en cabildo, la secretaria lo activa en SU
--    ordenador, y quien atiende el sábado por la mañana desde el otro no tiene
--    el bloqueo: le saca la papeleta a un moroso y nadie se entera hasta que
--    se cuadran las cuentas.
--
--    `moraRequiereDosCargos` — poner a alguien en mora exige que lo proponga
--    un cargo y lo confirme otro distinto. Es un control de cuatro ojos, y un
--    control de cuatro ojos que se salta abriendo otro navegador no es un
--    control.
--
-- 2. EL CATÁLOGO DE ETIQUETAS (costalero, acólito, banda, diputado de tramo…).
--
--    Con él se segmentan los comunicados y se filtra el censo. Cada ordenador
--    tenía el suyo: el mayordomo creaba «Costalero de repuesto» en el suyo y
--    desde el de secretaría esa etiqueta no existía, así que el comunicado a
--    los costaleros de repuesto no se podía mandar. Y al cerrar sesión se
--    borra todo lo que empieza por `cabildo-`, así que el catálogo entero
--    desaparecía.
--
-- Las dos van como `jsonb` en `hermandad_settings`, igual que las plantillas.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table hermandad_settings add column if not exists ajustes_cuotas jsonb;
alter table hermandad_settings add column if not exists etiquetas jsonb;

comment on column hermandad_settings.ajustes_cuotas is
  'Decisiones de la hermandad sobre cuotas: si bloquear la papeleta a quien debe, '
  'y si la mora exige la confirmación de dos cargos. Vivían en localStorage, así que '
  'no valían desde otro ordenador — incluido el control de cuatro ojos de la mora.';

comment on column hermandad_settings.etiquetas is
  'Catálogo de etiquetas de la hermandad (costalero, acólito, banda…). Con ellas se '
  'segmentan los comunicados. Vivían en localStorage: cada ordenador tenía el suyo y '
  'se borraban al cerrar sesión.';
