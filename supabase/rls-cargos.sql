-- Refuerza la RLS por cargo del personal. Seguro de ejecutar sobre una base
-- de datos ya en uso: no borra tablas ni filas, solo cambia políticas y crea
-- una función. Ejecuta esto después de schema.sql y hermano-auth.sql.
--
-- Hasta ahora, cualquier miembro del personal con sesión iniciada podía leer
-- Y escribir en TODAS las tablas de gestión, aunque su cargo solo tuviera
-- permiso para un módulo (la interfaz ocultaba el resto, pero la base de
-- datos no lo impedía). A partir de aquí:
--  - LEER sigue abierto a todo el personal en la mayoría de tablas: casi
--    todas las pantallas necesitan mostrar nombres/datos de otros módulos
--    (p. ej. Cuotas necesita el nombre del hermano). Restringir la lectura
--    por módulo en esas tablas rompería esas referencias cruzadas.
--  - ESCRIBIR (crear/editar/borrar) sí queda limitado al módulo que el cargo
--    tenga permitido en Personal y permisos. El titular (la cuenta con la
--    que se creó la hermandad, sin cargo asignado) sigue sin restricciones.
--  - Dos tablas con un dato sensible propio (personal: contraseñas de otros
--    miembros; solicitudes_alta: contraseña elegida por quien pide el alta)
--    quedan también restringidas en LECTURA al módulo "personal"/"hermanos".

-- ¿Puede el personal actual ESCRIBIR en este módulo? El titular (sin fila en
-- `personal`) siempre puede. El personal con cargo, solo si su cargo tiene
-- el módulo permitido en `permisos_cargo` y sigue activo. security definer:
-- sin esto, la propia consulta a `personal` quedaría bloqueada por las
-- políticas que usan esta función (personal y solicitudes_alta también
-- restringen la lectura).
create or replace function modulo_permitido(p_modulo text) returns boolean
  language sql stable security definer set search_path = public as $$
    select
      not exists (select 1 from personal where auth_user_id = auth.uid())
      or exists (
        select 1 from personal p
        join permisos_cargo pc on pc.cargo = p.cargo
        where p.auth_user_id = auth.uid() and p.activo and pc.modulo_id = p_modulo
      )
  $$;
grant execute on function modulo_permitido(text) to authenticated;

-- Tablas de gestión "normales": la LECTURA queda abierta a todo el personal;
-- ESCRIBIR (crear/editar/borrar) exige el módulo correspondiente.
do $$
declare
  reg record;
begin
  for reg in
    select * from (values
      ('hermandad_settings', 'configuracion'),
      ('tramos', 'configuracion'),
      ('movimientos', 'tesoreria'),
      ('incidencias', 'cortejo'),
      ('enseres', 'inventario'),
      ('documentos', 'archivo'),
      ('comunicados', 'comunicados'),
      ('cuentas_sociales', 'comunicados'),
      ('permisos_cargo', 'personal'),
      ('conceptos_cuota', 'configuracion'),
      ('opciones_papeleta', 'configuracion'),
      ('catalogos', 'configuracion')
    ) as t(tabla, modulo)
  loop
    execute format('drop policy if exists "authenticated_all" on %I', reg.tabla);
    execute format('drop policy if exists "%s_staff_select" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_select" on %I for select to authenticated using (not auth_es_hermano())',
      reg.tabla, reg.tabla
    );
    execute format('drop policy if exists "%s_staff_insert" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_insert" on %I for insert to authenticated with check (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_update" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_update" on %I for update to authenticated using (not auth_es_hermano() and modulo_permitido(%L)) with check (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_delete" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_delete" on %I for delete to authenticated using (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
  end loop;
end $$;

-- Tablas con un dato sensible propio (contraseñas en claro): también se
-- restringe la LECTURA al módulo correspondiente, no solo la escritura.
do $$
declare
  reg record;
begin
  for reg in
    select * from (values
      ('personal', 'personal'),
      ('solicitudes_alta', 'hermanos')
    ) as t(tabla, modulo)
  loop
    execute format('drop policy if exists "authenticated_all" on %I', reg.tabla);
    execute format('drop policy if exists "%s_staff_select" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_select" on %I for select to authenticated using (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_insert" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_insert" on %I for insert to authenticated with check (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_update" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_update" on %I for update to authenticated using (not auth_es_hermano() and modulo_permitido(%L)) with check (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo, reg.modulo
    );
    execute format('drop policy if exists "%s_staff_delete" on %I', reg.tabla, reg.tabla);
    execute format(
      'create policy "%s_staff_delete" on %I for delete to authenticated using (not auth_es_hermano() and modulo_permitido(%L))',
      reg.tabla, reg.tabla, reg.modulo
    );
  end loop;
end $$;

-- La tabla de solicitudes de alta también debe poder rellenarse desde el área
-- del hermano SIN sesión iniciada (todavía no es hermano/a): se permite
-- insertar de forma anónima, pero no leer ni modificar sin sesión.
drop policy if exists "anon_insert_solicitudes" on solicitudes_alta;
create policy "anon_insert_solicitudes" on solicitudes_alta for insert to anon with check (true);

-- Hermanos: el personal ve a todos (según su módulo puede además crear,
-- editar o borrar); cada hermano solo ve y edita su propia ficha.
drop policy if exists "authenticated_all" on hermanos;
drop policy if exists "hermanos_personal_all" on hermanos;
drop policy if exists "hermanos_staff_select" on hermanos;
create policy "hermanos_staff_select" on hermanos for select to authenticated
  using (not auth_es_hermano());
drop policy if exists "hermanos_staff_insert" on hermanos;
create policy "hermanos_staff_insert" on hermanos for insert to authenticated
  with check (not auth_es_hermano() and modulo_permitido('hermanos'));
drop policy if exists "hermanos_staff_update" on hermanos;
create policy "hermanos_staff_update" on hermanos for update to authenticated
  using (not auth_es_hermano() and modulo_permitido('hermanos'))
  with check (not auth_es_hermano() and modulo_permitido('hermanos'));
drop policy if exists "hermanos_staff_delete" on hermanos;
create policy "hermanos_staff_delete" on hermanos for delete to authenticated
  using (not auth_es_hermano() and modulo_permitido('hermanos'));

-- Cuotas: el personal ve todas (el módulo "cuotas" hace falta para
-- crear/editar/borrar); cada hermano solo ve las suyas.
drop policy if exists "authenticated_all" on cuotas;
drop policy if exists "cuotas_personal_all" on cuotas;
drop policy if exists "cuotas_staff_select" on cuotas;
create policy "cuotas_staff_select" on cuotas for select to authenticated
  using (not auth_es_hermano());
drop policy if exists "cuotas_staff_insert" on cuotas;
create policy "cuotas_staff_insert" on cuotas for insert to authenticated
  with check (not auth_es_hermano() and modulo_permitido('cuotas'));
drop policy if exists "cuotas_staff_update" on cuotas;
create policy "cuotas_staff_update" on cuotas for update to authenticated
  using (not auth_es_hermano() and modulo_permitido('cuotas'))
  with check (not auth_es_hermano() and modulo_permitido('cuotas'));
drop policy if exists "cuotas_staff_delete" on cuotas;
create policy "cuotas_staff_delete" on cuotas for delete to authenticated
  using (not auth_es_hermano() and modulo_permitido('cuotas'));

-- Papeletas: tanto Papeletas de sitio como Cortejo escriben en esta tabla
-- (asignar tramo, marcar pago, etc.), así que cualquiera de los dos módulos
-- vale para crear/editar/borrar. Cada hermano ve, solicita y renuncia solo a
-- las suyas (política ya creada en hermano-auth.sql, no se toca aquí).
drop policy if exists "authenticated_all" on papeletas;
drop policy if exists "papeletas_personal_all" on papeletas;
drop policy if exists "papeletas_staff_select" on papeletas;
create policy "papeletas_staff_select" on papeletas for select to authenticated
  using (not auth_es_hermano());
drop policy if exists "papeletas_staff_insert" on papeletas;
create policy "papeletas_staff_insert" on papeletas for insert to authenticated
  with check (not auth_es_hermano() and (modulo_permitido('papeletas') or modulo_permitido('cortejo')));
drop policy if exists "papeletas_staff_update" on papeletas;
create policy "papeletas_staff_update" on papeletas for update to authenticated
  using (not auth_es_hermano() and (modulo_permitido('papeletas') or modulo_permitido('cortejo')))
  with check (not auth_es_hermano() and (modulo_permitido('papeletas') or modulo_permitido('cortejo')));
drop policy if exists "papeletas_staff_delete" on papeletas;
create policy "papeletas_staff_delete" on papeletas for delete to authenticated
  using (not auth_es_hermano() and (modulo_permitido('papeletas') or modulo_permitido('cortejo')));
