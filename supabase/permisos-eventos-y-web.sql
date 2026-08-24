-- ============================================================================
--   LOS DOS MÓDULOS QUE NUNCA SE SEMBRARON: «eventos» y «web»
-- ============================================================================
--
-- La lista de permisos de fábrica se quedó corta desde el principio. Faltaba
-- «eventos» en cinco cargos y «web» en dos, así que en cualquier hermandad ya
-- creada el Hermano Mayor —que lo puede todo por definición— no podía guardar
-- un evento ni publicar la web: la pantalla se lo ofrecía, la política lo
-- rechazaba.
--
-- POR QUÉ ESTÁ EN SU PROPIO FICHERO Y NO DENTRO DE
-- `permisos-por-hermandad.sql`, QUE ES DONDE ESTABA.
--
-- Porque ese fichero no se puede ejecutar suelto sobre una base al día, y este
-- sí. `permisos-por-hermandad.sql` redefine `modulo_permitido()`, y esa función
-- la vuelve a redefinir después `hermano-con-cargo.sql` añadiéndole una tercera
-- vía: el hermano que lleva un cargo en su ficha. De todas las definiciones
-- manda la última que se ejecuta, así que ejecutar el fichero viejo por su
-- cuenta DEJA SIN ACCESO a todo hermano con cargo en la ficha — que es como
-- están hoy los tesoreros y secretarios que además son hermanos.
--
-- Este arreglo, en cambio, no toca ninguna función: solo añade filas que
-- faltan. Por eso se puede ejecutar solo, y por eso vive aparte.
--
-- Y SE AÑADEN SOLO ESTOS DOS, no se resiembra la lista entera. Volver a
-- sembrarla devolvería permisos que una hermandad haya quitado a propósito
-- —«al Secretario no le dejo tocar el censo»— y eso es peor que el fallo que
-- se viene a arreglar. Nadie ha podido quitar a mano algo que nunca estuvo.
--
-- CÓMO SE EJECUTA
--   Supabase → SQL Editor → pegar esto entero → Run.
--   Es seguro repetirlo.
-- ============================================================================

insert into permisos_cargo (hermandad_id, cargo, modulo_id)
select h.id, f.cargo, f.modulo_id
from hermandades h
cross join (values
  ('Hermano Mayor','eventos'),('Hermano Mayor','web'),
  ('Secretario/a','eventos'),('Secretario/a','web'),
  ('Mayordomo/Prioste','eventos'),
  ('Diputado/a Mayor de Gobierno','eventos'),
  ('Vocal','eventos')
) as f(cargo, modulo_id)
-- Solo a los cargos que esta hermandad ya reconoce: si nunca se le sembró
-- «Vocal», no se le inventa uno ahora.
where exists (
  select 1 from permisos_cargo pc
  where pc.hermandad_id = h.id and pc.cargo = f.cargo
)
on conflict do nothing;



-- ============================================================================
--   Y QUE EL MÓDULO «WEB» SIRVA PARA ALGO
-- ============================================================================
--
-- El módulo existía y la pantalla lo respetaba —quien no lo tiene no ve la
-- sección de la web—, pero LA BASE DE DATOS NO LO PEDÍA. La política decía
-- solo «no es un hermano»:
--
--     using (not auth_es_hermano()) with check (not auth_es_hermano())
--
-- O sea que cualquiera del personal, con el cargo que fuera, podía reescribir
-- la web pública de la hermandad desde la consola del navegador sin pasar por
-- ninguna pantalla. El diputado de tramo, el fiscal, el mayordomo: todos.
--
-- Es el mismo error que en la ficha del hermano y en las cuotas: LO QUE ESCONDE
-- LA PANTALLA NO PROTEGE NADA. Quien tiene sesión habla con la base
-- directamente, y ahí solo manda lo que digan las políticas.
--
-- Y aquí duele más de lo que parece, porque la web pública es lo que ve el
-- barrio entero: una portada cambiada la ve más gente en una tarde que
-- cualquier otra cosa de la aplicación.
--
-- Va DETRÁS de la siembra de arriba a propósito: primero el módulo existe para
-- los cargos que lo tienen que tener, y solo después se exige. Al revés, la
-- hermandad se quedaría un rato sin poder editar su web. Y `es_titular()`
-- entra siempre dentro de `modulo_permitido`, así que quien la lleva no se
-- queda fuera pase lo que pase.
drop policy if exists "el personal edita la web" on web_publica;
create policy "el personal edita la web" on web_publica for all to authenticated
  using (not auth_es_hermano() and modulo_permitido('web'))
  with check (not auth_es_hermano() and modulo_permitido('web'));
