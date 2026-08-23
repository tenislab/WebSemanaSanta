-- =============================================================================
--
--   ⚠️  BORRA TODAS LAS HERMANDADES Y TODAS LAS CUENTAS  ⚠️
--
--   Para dejar el proyecto como recién instalado mientras se hacen pruebas.
--   NO ejecutar nunca en un proyecto con hermandades de verdad: no hay
--   deshacer, y aquí dentro va el censo de gente real.
--
--   El esquema (tablas, políticas, funciones) NO se toca. Solo los datos.
--
-- =============================================================================

begin;

-- 1. Las hermandades. Todo lo demás —hermanos, cuotas, papeletas, tramos,
--    tesorería, adjuntos, ajustes, la web— cuelga de aquí con «on delete
--    cascade», así que se va con ellas de una sola vez.
delete from hermandades;

-- 2. Lo que pudiera haber quedado sin hermandad: filas de antes del
--    multi-hermandad, o mensajes de un formulario público. No las arrastra el
--    borrado de arriba porque no apuntan a ninguna.
delete from mensajes_web    where hermandad_id is null;
delete from solicitudes_alta where hermandad_id is null;
delete from cuotas          where hermandad_id is null;
delete from papeletas       where hermandad_id is null;
delete from incidencias     where hermandad_id is null;
delete from hermanos        where hermandad_id is null;
delete from tramos          where hermandad_id is null;
delete from movimientos     where hermandad_id is null;
delete from enseres         where hermandad_id is null;
delete from documentos      where hermandad_id is null;
delete from comunicados     where hermandad_id is null;
delete from cuentas_sociales where hermandad_id is null;
delete from eventos         where hermandad_id is null;
delete from catalogos       where hermandad_id is null;
delete from conceptos_cuota where hermandad_id is null;
delete from opciones_papeleta where hermandad_id is null;
delete from permisos_cargo  where hermandad_id is null;
delete from personal        where hermandad_id is null;
delete from titulares       where hermandad_id is null;
delete from hermandad_settings where hermandad_id is null;
delete from web_publica     where hermandad_id is null;

-- 3. Los adjuntos del Archivo, si Supabase deja.
--
--    Supabase protege sus tablas de Storage con un disparador que impide
--    borrar filas a mano: el archivo de verdad vive en su almacén, no en la
--    tabla, y borrar solo la fila dejaría el fichero suelto ocupando sitio
--    para siempre. Es una protección razonable, así que no se fuerza.
--
--    Si el borrado se rechaza, el resto sigue igual. Para vaciar los adjuntos
--    hay que ir a Storage → documentos y borrarlos desde ahí, o dejarlos: sin
--    hermandad a la que pertenecer, ya no los ve nadie.
do $$
begin
  delete from storage.objects where bucket_id = 'documentos';
  raise notice 'Adjuntos del Archivo borrados.';
exception when others then
  raise notice 'Los adjuntos NO se han borrado (%). Vacía el cubo «documentos» desde Storage si quieres quitarlos; sin hermandad, ya no los ve nadie.', sqlerrm;
end $$;

-- 4. Las cuentas. Va lo último: mientras existan, `titulares` las referencia.
delete from auth.users;

commit;

-- Comprobación. Las tres cifras tienen que ser 0.
select
  (select count(*) from hermandades) as hermandades,
  (select count(*) from hermanos)    as hermanos,
  (select count(*) from auth.users)  as cuentas;
