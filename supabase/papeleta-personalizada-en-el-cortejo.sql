-- =============================================================================
--   QUE UNA PAPELETA PROPIA DE LA HERMANDAD PUEDA IR EN EL CORTEJO
-- =============================================================================
--
-- EL PROBLEMA. Las papeletas personalizadas nacieron para lo que NO sale en el
-- cortejo: la papeleta simbólica de quien no procesiona, un recuerdo, un
-- donativo. Por eso no llevaban tramo.
--
-- Pero en cuanto una hermandad las usa de verdad, les pone nombres como
-- «nazareno cirio» o «mantilla», que sí son puestos: gente que camina, ocupa
-- sitio y tiene que salir en la lista del diputado de tramo. Y no salía. Se
-- emitía la papeleta, se cobraba, y el cortejo seguía diciendo 0/40 sin que
-- nada avisara de por qué.
--
-- LA SOLUCIÓN. La papeleta personalizada puede apuntar a un tramo. Si apunta,
-- quien la saca ocupa su puesto como cualquier otro. Si no, se queda como
-- estaba, que para la simbólica es lo correcto.
--
-- `on delete set null` y no `cascade`: si se borra el tramo, la hermandad no
-- puede perder de golpe su lista de precios. Se queda sin puesto y ya está.
alter table opciones_papeleta
  add column if not exists tramo_id uuid references tramos(id) on delete set null;

comment on column opciones_papeleta.tramo_id is
  'Puesto del cortejo que ocupa quien saca esta papeleta. Nulo = no sale en el '
  'cortejo (la papeleta simbólica, un recuerdo, un donativo).';
