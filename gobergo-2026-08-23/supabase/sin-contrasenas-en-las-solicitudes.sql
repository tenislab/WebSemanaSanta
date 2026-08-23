-- =============================================================================
--   SIN-CONTRASEÑAS-EN-LAS-SOLICITUDES.SQL
-- =============================================================================
--
-- EL FALLO: `solicitudes_alta.clave_propuesta` guardaba EN CLARO la contraseña
-- que tecleaba quien pedía el alta desde la web pública.
--
-- Quién la ve: cualquiera del personal con el módulo «hermanos» —el Hermano
-- Mayor, la Secretaría, el Diputado Mayor—, y no en una pantalla escondida sino
-- en la propia fila de la solicitud. Y se queda ahí mientras la solicitud está
-- pendiente, que en una hermandad pueden ser semanas.
--
-- POR QUÉ IMPORTA MÁS DE LO QUE PARECE: la gente repite contraseñas. La que
-- veía la secretaria es, con mucha probabilidad, la del correo de esa persona.
-- Quien pide el alta no está dándole una contraseña a una empresa con un equipo
-- de seguridad: se la está dando a un vecino que lleva la secretaría los martes.
--
-- Y NO HACÍA FALTA NINGUNA. El camino de «se genera una clave de un solo uso al
-- aprobar y se manda por correo» ya existía —se usaba en el alta de un menor,
-- que llega sin contraseña—. Ahora se usa siempre, y el formulario pide un
-- campo menos.
--
-- Esto hace dos cosas, y las dos hacen falta:
--
--   1. BORRA LAS QUE YA ESTUVIERAN GUARDADAS. Mientras existan, el problema
--      sigue existiendo aunque el formulario ya no pida ninguna.
--   2. IMPIDE QUE ENTREN MÁS, con un disparador. Y esto tampoco sobra: la
--      hermandad puede tener el navegador con la versión anterior de la
--      aplicación abierta desde ayer, y esa sí manda la contraseña.
--
-- No se borra la columna: quitarla rompería a esa versión anterior en cuanto
-- alguien la use, y una solicitud perdida es peor que una columna vacía. Queda
-- ahí, siempre en blanco.
--
-- Se puede ejecutar sobre una base ya en uso.

-- 1. Fuera las que hay.
update solicitudes_alta set clave_propuesta = '' where coalesce(clave_propuesta, '') <> '';

-- 2. Y que no vuelvan a entrar.
create or replace function solicitudes_sin_clave() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- En blanco siempre, venga de donde venga. No se rechaza la solicitud: lo
  -- que importa es el alta, y quien la pide no tiene por qué quedarse fuera
  -- porque su navegador tenga la versión de ayer.
  new.clave_propuesta := '';
  return new;
end $$;

drop trigger if exists solicitudes_sin_clave on solicitudes_alta;
create trigger solicitudes_sin_clave
  before insert or update on solicitudes_alta
  for each row execute function solicitudes_sin_clave();

comment on column solicitudes_alta.clave_propuesta is
  'SIEMPRE VACÍA. Guardaba en claro la contraseña que proponía quien pedía el alta, '
  'a la vista de la secretaría durante semanas. La clave se genera al aprobar y se '
  'manda por correo. La columna se queda para no romper versiones anteriores de la '
  'aplicación; un disparador la deja en blanco.';

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Después de ejecutarlo, esto tiene que devolver 0:
--
--   select count(*) from solicitudes_alta where coalesce(clave_propuesta, '') <> '';
