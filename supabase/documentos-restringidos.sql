-- ============================================================================
--   EL DOCUMENTO «RESTRINGIDO» LO ENTREGABA LA BASE A CUALQUIERA
-- ============================================================================
--
-- El Archivo deja marcar un documento como restringido y elegir a qué cargos:
-- «Expediente disciplinario — visible solo para Hermano Mayor y Fiscal». La
-- pantalla lo respeta, pinta el candado, y a quien no está en la lista le
-- enseña «Documento restringido» en vez del contenido.
--
-- La base de datos no pedía nada de eso. Su política de lectura decía:
--
--     using (not auth_es_hermano() and modulo_permitido('archivo'))
--
-- O sea: cualquiera con el módulo de archivo —Hermano Mayor, Secretario/a y
-- Fiscal— se llevaba TODOS los documentos, con su nombre, su categoría y su
-- descripción. Comprobado: la Secretaria, que no figura en ninguna de las dos
-- listas, recibe los dos expedientes con el título completo.
--
-- Y no hace falta ni abrir la consola. El panel carga la tabla entera para
-- pintarla, así que los documentos restringidos ya están dentro de la página y
-- en la copia del navegador: se ven abriendo el almacenamiento local, que es
-- dos clics.
--
-- ES EL MISMO FALLO DE SIEMPRE, otra vez: lo que esconde la pantalla no
-- protege nada. Ya pasó con la ficha del hermano, con las cuotas y con la web
-- pública. Aquí duele especialmente porque lo que se restringe es justo lo que
-- no puede salir: un expediente, un informe reservado, una carta del obispado.
--
-- CÓMO QUEDA
--
-- Se añade la condición que faltaba, con el mismo criterio EXACTO que la
-- pantalla: se ve si el documento no está restringido, o si tu cargo está en
-- su lista. Sin excepciones, tampoco para el cargo más alto — es lo que dice
-- el comentario de `canView` en `Archivo.tsx` y lo que promete el aviso que lee
-- la persona: «Visible solo para: …».
--
-- SI ALGUIEN SE DEJA FUERA A SÍ MISMO —restringe un documento a un cargo que
-- luego cambia de manos— deja de verlo y ya no puede editar la lista, porque
-- para editarla hay que verlo. Se sale desde aquí, desde el editor SQL:
--
--     update documentos set cargos_con_acceso = null where numero = 412;
--
-- Es a propósito que la salida esté fuera de la aplicación: si estuviera
-- dentro, no sería una restricción.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Se puede repetir sin que pase nada.
-- ============================================================================

/**
 * El cargo de quien está preguntando.
 *
 * Por los dos sitios donde puede llevarlo, y en este orden, que es el mismo que
 * usa la aplicación (`cargosEfectivos` en `lib/personal.ts`):
 *
 *   1. su fila de `personal`, que es la cuenta con la que entra al panel;
 *   2. el cargo escrito en su ficha del censo.
 *
 * Manda la de personal cuando están las dos: es la que decide qué ve al entrar.
 * Y las filas desactivadas no cuentan — a quien se le ha quitado el acceso ya
 * no lleva ese cargo.
 */
create or replace function mi_cargo() returns text
  language sql stable security definer set search_path = public as $$
    select coalesce(
      (select p.cargo from personal p
        where p.auth_user_id = auth.uid() and p.activo limit 1),
      (select h.cargo from hermanos h
        where h.auth_user_id = auth.uid() and h.cargo is not null and h.estado <> 'Baja' limit 1)
    )
  $$;
grant execute on function mi_cargo() to authenticated;

comment on function mi_cargo() is
  'El cargo de quien pregunta: primero su fila de personal (la cuenta con la que entra), '
  'y si no, el cargo de su ficha del censo. Mismo orden que cargosEfectivos() en la '
  'aplicación, para que la base y la pantalla no puedan contestar cosas distintas.';

/**
 * ¿Puedo ver este documento?
 *
 * `cargos_con_acceso` a NULL es un documento institucional: lo ve todo el que
 * tenga el módulo de archivo. Con lista, hay que estar en ella.
 *
 * Va como función y no escrita dentro de la política porque la usan las cuatro
 * —leer, crear, cambiar y borrar—, y tenerla cuatro veces es tenerla arreglada
 * en unas y rota en otras.
 */
create or replace function puedo_ver_documento(p_cargos text[]) returns boolean
  language sql stable security definer set search_path = public as $$
    select p_cargos is null
        or array_length(p_cargos, 1) is null
        or mi_cargo() = any(p_cargos)
  $$;
grant execute on function puedo_ver_documento(text[]) to authenticated;

-- LEER. Es la que de verdad estaba abierta.
drop policy if exists "documentos_staff_select" on documentos;
create policy "documentos_staff_select" on documentos for select to authenticated
  using (
    not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_ver_documento(cargos_con_acceso)
  );

/*
 * Y CAMBIARLO Y BORRARLO TAMBIÉN, que si no la restricción es de mentira: sin
 * esto, quien no puede leer el expediente sí puede borrarlo, o quitarle la
 * restricción y leerlo después. `with check` mira la fila COMO QUEDA, para que
 * nadie se saque a sí mismo de la lista de un documento que sí ve y luego se
 * quede sin poder devolverlo — y sobre todo para que nadie meta un documento
 * restringido a un cargo del que no forma parte.
 */
drop policy if exists "documentos_staff_update" on documentos;
create policy "documentos_staff_update" on documentos for update to authenticated
  using (
    not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_ver_documento(cargos_con_acceso)
  )
  with check (
    not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_ver_documento(cargos_con_acceso)
  );

drop policy if exists "documentos_staff_delete" on documentos;
create policy "documentos_staff_delete" on documentos for delete to authenticated
  using (
    not auth_es_hermano()
    and modulo_permitido('archivo')
    and puedo_ver_documento(cargos_con_acceso)
  );

comment on column documentos.cargos_con_acceso is
  'Cargos que pueden ver este documento. NULL = institucional, lo ve quien tenga el '
  'módulo de archivo. Con lista, la base lo comprueba de verdad: antes solo lo hacía la '
  'pantalla, y el panel se descargaba todos los documentos igualmente.';
