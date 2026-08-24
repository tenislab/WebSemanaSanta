-- ============================================================================
--   DOS RECIBOS CON EL MISMO NÚMERO
-- ============================================================================
--
-- El número de recibo es lo que va impreso en el justificante que se le
-- entrega al hermano, y es por lo que pregunta la tesorería al cuadrar el
-- extracto del banco: «el 412 no me aparece». Que haya dos 412 no es un
-- detalle de listado: es que esa conversación deja de tener respuesta.
--
-- Y se podían crear. `hermanos` tiene su número protegido
-- (`hermanos_numero_por_hermandad`) y `papeletas` también
-- (`papeletas_numero_unico`); `cuotas` se quedó sin nada. Comprobado: dos
-- inserciones seguidas con el mismo número entran las dos y nadie protesta.
--
-- No hace falta mala suerte para que pase. El número lo calcula la aplicación
-- con «el mayor que veo, más uno», y lo que ve es la lista que tiene cargada:
--
--   · Dos personas emitiendo desde dos ordenadores a la vez —el día del
--     cabildo son dos, y a veces tres—.
--   · Emitir en una pestaña mientras la otra tiene la tabla a medio cargar.
--   · Importar el histórico de cuotas de otro programa, que trae sus propios
--     números y no sabe cuáles hay ya.
--
-- QUÉ HACE ESTE ARCHIVO, Y QUÉ NO HACE
--
-- Pone el índice único. Y ANTES MIRA si la base ya tiene repetidos, porque una
-- hermandad que lleve meses trabajando puede tenerlos:
--
--   · Si no hay ninguno, lo pone y ya está.
--   · Si los hay, NO LOS TOCA y NO PONE EL ÍNDICE: avisa diciendo cuáles son.
--
-- No se renumeran solos a propósito. Esos números están impresos en recibos
-- que ya se entregaron y anotados en la conciliación del banco: cambiarlos
-- desde un script, de madrugada y sin que nadie mire, es peor que el problema.
-- Que la tesorería decida cuál se queda con el número y cuál se corrige, y
-- después se vuelve a ejecutar esto.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada. Si avisa de repetidos, mira el aviso.
-- ============================================================================

do $$
declare
  v_repetidos int;
  v_detalle text;
begin
  -- Si ya está puesto, no hay nada que hacer.
  if exists (select 1 from pg_indexes where indexname = 'cuotas_numero_por_hermandad') then
    raise notice 'El número de recibo ya era único. Nada que hacer.';
    return;
  end if;

  select count(*), string_agg(t.detalle, ' · ')
    into v_repetidos, v_detalle
  from (
    select 'nº ' || numero || ' (' || count(*) || ' recibos)' as detalle
      from cuotas
     where hermandad_id is not null
     group by hermandad_id, numero
    having count(*) > 1
     order by numero
     limit 20
  ) t;

  if coalesce(v_repetidos, 0) > 0 then
    raise warning 'NO se ha puesto el índice: ya hay números de recibo repetidos. %', v_detalle;
    raise warning 'Míralos en Cuotas, decide cuál se queda con cada número, corrige el otro y vuelve a ejecutar esto.';
    return;
  end if;

  /*
   * Por HERMANDAD, no global: cada una lleva su propia numeración y el recibo
   * nº 1 de una no tiene nada que ver con el nº 1 de la otra.
   *
   * Y NO por ejercicio, aunque parezca lo natural: la aplicación numera
   * seguido, sin reiniciar cada año (`emitirCuotasAnuales` coge el mayor de
   * TODOS y suma uno). Poner el índice por ejercicio dejaría pasar dos recibos
   * con el mismo número en años distintos, que es exactamente lo que la
   * tesorería no puede distinguir cuando busca «el 412» en el extracto.
   */
  create unique index cuotas_numero_por_hermandad
    on cuotas (hermandad_id, numero)
    where hermandad_id is not null;
  raise notice 'Puesto: a partir de ahora no puede haber dos recibos con el mismo número.';
end $$;

comment on table cuotas is
  'Recibos de cuota. El número es único por hermandad: va impreso en el justificante '
  'del hermano y es por lo que pregunta la tesorería al cuadrar el banco. Se podían '
  'crear dos con el mismo número emitiendo desde dos ordenadores a la vez.';
