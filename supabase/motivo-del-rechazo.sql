-- =============================================================================
--
--   POR QUÉ SE RECHAZÓ UNA SOLICITUD DE ALTA
--
-- =============================================================================
--
-- Llegó dicho así: «que si se acepta se quede guardado en el portal del
-- hermano como familiar en el apartado mi familia, que se ponga aprobado o
-- rechazado; si es rechazado, un porqué».
--
-- La tabla guardaba el estado —Pendiente, Aprobada, Rechazada— y nada más. Un
-- «Rechazada» a secas no se le puede enseñar a nadie: la persona sabe que le
-- han dicho que no y no sabe si es un error suyo que puede corregir (un DNI
-- mal escrito) o una decisión de la hermandad. Así que llamaba a preguntar,
-- que es justo la llamada que el área del hermano venía a ahorrar.
--
-- Dos columnas:
--   · `motivo_rechazo`  lo que escribe secretaría al rechazar;
--   · `resuelta_el`     cuándo se resolvió, para poder decir «el 4 de marzo».
--
-- Es seguro volver a ejecutarlo.
-- =============================================================================

alter table solicitudes_alta add column if not exists motivo_rechazo text;
alter table solicitudes_alta add column if not exists resuelta_el date;

-- Y QUE EL TUTOR PUEDA SEGUIR VIÉNDOLA DESPUÉS DE RESUELTA.
--
-- Esto es lo que de verdad estaba roto, y no se ve mirando la tabla. La
-- política de lectura del área del hermano ya dejaba ver las solicitudes que
-- él ha mandado, así que la parte del permiso estaba bien; lo que fallaba es
-- que la aplicación solo pintaba las PENDIENTES. Se arregla en la pantalla,
-- pero se deja escrita aquí la política —sin cambios— para que quede claro que
-- el hermano tiene derecho a leer también las suyas ya resueltas: si algún día
-- alguien la endurece, que sepa que la de «Mi familia» depende de ella.
drop policy if exists "solicitudes_de_mi_familia_select" on solicitudes_alta;
create policy "solicitudes_de_mi_familia_select" on solicitudes_alta for select to authenticated
  using (auth_es_hermano() and tutor_id = hermano_propio_id());
