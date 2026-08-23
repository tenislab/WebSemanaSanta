-- ============================================================================
-- Gobergo — guardar a quién iba dirigido un comunicado
-- ============================================================================
--
-- QUÉ ARREGLA (auditoría de agosto de 2026)
--
-- Un comunicado con segmentación avanzada («Activos · con cuota pendiente»)
-- guardaba solo esa etiqueta legible. A la hora de avisar, la aplicación
-- intentaba adivinar a quién se refería LEYENDO ESE TEXTO: reconocía las que
-- empiezan por «Etiqueta: » y cualquiera que dijera «todos», y nada más.
--
-- «Activos · con cuota pendiente» no encaja en ninguna de las dos, así que la
-- lista de destinatarios salía VACÍA. Ni buzón, ni correo, ni nada. Y el
-- comunicado quedaba guardado como «Enviado», con su fecha y con un alcance de
-- 84 personas que no habían recibido absolutamente nada.
--
-- Con esta columna se guardan los criterios de verdad y se vuelven a resolver.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede ejecutar más de una vez sin que pase nada.
-- ============================================================================

alter table comunicados add column if not exists criterios jsonb;

comment on column comunicados.criterios is
  'Criterios del segmento con el que se compuso el comunicado (estado, cuota, edad, '
  'etiqueta, campos propios). Vacío = destinatario simple, resuelto por su etiqueta. '
  'Sin esto no hay forma de saber a quién iba dirigido.';
