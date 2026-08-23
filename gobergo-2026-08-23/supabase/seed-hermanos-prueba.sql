-- 400 hermanos de prueba (censo ficticio) para probar el rendimiento y el
-- aspecto de la app con volumen real: Hermanos, Informes, listados, etc.
-- Ejecuta esto en el SQL Editor de Supabase. Es seguro de ejecutar varias
-- veces (los DNI son únicos: si ya existen, dará error de duplicado en vez
-- de crear repetidos — vuelve a borrarlos primero con la consulta del final
-- si quieres regenerarlos).
--
-- No crean cuenta real de Supabase Auth (auth_user_id queda a null): son
-- solo para ver cómo se comporta el censo con muchos hermanos, no para
-- entrar con ellos en /hermano. Si necesitas eso, usa el script
-- scripts/crear-personal-prueba.mjs (para personal) o da de alta un hermano
-- normal desde Hermanos.

insert into hermanos (numero, nombre, estado, antiguedad, email, telefono, direccion, cuota_al_dia, iban, dni, clave_acceso)
select
  9000 + s,
  (array['Ana','María','Juan','Pedro','Lucía','Carmen','Rafael','Isabel','Manuel','Diego',
         'Rocío','Beatriz','Antonio','Francisco','José','Elena','Miguel','Cristina','Alejandro','Marta',
         'David','Laura','Sergio','Paula','Álvaro','Sara','Javier','Nuria','Pablo','Silvia'])[1 + mod(s, 30)]
    || ' ' ||
  (array['García','Pérez','Sánchez','Ruiz','Gómez','Fernández','López','Martín','Jiménez','Ortiz',
         'Cabrera','Domínguez','Reina','Vega','Muñoz','Romero','Alonso','Gil','Serrano','Blanco',
         'Suárez','Molina','Ortega','Delgado','Castro','Vidal','Cortés','Ramos','Iglesias','Cano'])[1 + mod(s * 7, 30)],
  (array['Activo','Activo','Activo','Activo','Nuevo','Baja'])[1 + mod(s, 6)],
  1975 + mod(s, 51),
  'prueba' || s || '@pruebas.cabildo.app',
  '6' || lpad((10000000 + mod(s * 137, 89999999))::text, 8, '0'),
  'Calle de prueba, ' || s,
  mod(s, 3) != 0,
  case when mod(s, 3) = 0 then null
       else 'ES' || lpad(mod(s * 991, 99)::text, 2, '0') || ' 0000 0000 0000 0000 ' || lpad(s::text, 4, '0') end,
  'TEST' || lpad(s::text, 8, '0'),
  'hermano123'
from generate_series(1, 400) s;

-- Para borrarlos todos luego (arrastra por cascada sus cuotas/papeletas si
-- llegas a generarles alguna):
-- delete from hermanos where dni like 'TEST%';
