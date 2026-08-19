-- =============================================================================
--
--   CABILDO — DATOS DE PRUEBA
--
-- =============================================================================
--
-- Crea una hermandad de mentira con 12 hermanos, sus tramos, sus cuotas y sus
-- papeletas, para comprobar que la base de datos y la aplicación se entienden.
--
-- CÓMO SE USA:
--   Supabase → SQL Editor → New query → pega esto entero → Run
--
-- Es seguro volver a ejecutarlo: primero borra lo que hubiera creado antes.
--
-- ⚠️  PARA BORRARLO TODO CUANDO TERMINES DE PROBAR, ejecuta solo el bloque de
--     LIMPIEZA de aquí abajo (está marcado, son 6 líneas).
--
-- ⚠️  NO EJECUTES ESTO SOBRE LA BASE DE UNA HERMANDAD DE VERDAD: el bloque de
--     limpieza borra hermanos por DNI, y los DNI de prueba son inventados,
--     pero la hermandad (nombre, CIF, IBAN) SÍ se sobrescribe.
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- LIMPIEZA — borra los datos de prueba anteriores
-- -----------------------------------------------------------------------------
-- Las cuotas y papeletas se van solas al borrar el hermano (on delete cascade).

delete from hermanos where dni like 'X%TEST';
delete from tramos where nombre like '[PRUEBA]%';


-- -----------------------------------------------------------------------------
-- 1. LA HERMANDAD
-- -----------------------------------------------------------------------------
-- Es una fila única (id = 1), así que se actualiza en vez de insertarse.

insert into hermandad_settings (
  id, nombre_legal, cif, direccion, codigo_postal, ciudad, provincia,
  telefono, email, iban, bizum_telefono, identificador_acreedor,
  color_primario, color_secundario
) values (
  1,
  'Real e Ilustre Hermandad de Prueba',
  'G41000000',
  'C/ Pureza, 53',
  '41010',
  'Sevilla',
  'Sevilla',
  '954 000 000',
  'secretaria@hermandaddeprueba.example',
  'ES47 2100 0813 6102 0012 3456',
  '655 123 456',
  'ES23000G41000000',
  '#6A1A23',
  '#C5A059'
)
on conflict (id) do update set
  nombre_legal = excluded.nombre_legal,
  cif = excluded.cif,
  direccion = excluded.direccion,
  codigo_postal = excluded.codigo_postal,
  ciudad = excluded.ciudad,
  provincia = excluded.provincia,
  telefono = excluded.telefono,
  email = excluded.email,
  iban = excluded.iban,
  bizum_telefono = excluded.bizum_telefono,
  identificador_acreedor = excluded.identificador_acreedor;


-- -----------------------------------------------------------------------------
-- 2. LOS TRAMOS DEL CORTEJO
-- -----------------------------------------------------------------------------
-- Dos cuerpos (Cristo y Virgen). El de costaleros lleva etiqueta, para
-- comprobar que los roles automáticos funcionan.

insert into tramos (nombre, cuerpo, capacidad, tipo, reparto, precio, etiqueta, orden) values
  ('[PRUEBA] Cruz de guía',      'Cristo', 4,  'Insignia', 'solicitud', 20, null,        1),
  ('[PRUEBA] 1er tramo de cirio','Cristo', 30, 'Cirio',    'numero',    18, null,        2),
  ('[PRUEBA] Costaleros Cristo', 'Cristo', 35, 'Costal',   'solicitud', 15, 'Costalero', 3),
  ('[PRUEBA] Palio',             'Virgen', 30, 'Cirio',    'numero',    18, null,        4);


-- -----------------------------------------------------------------------------
-- 3. LOS HERMANOS
-- -----------------------------------------------------------------------------
-- Doce, con casos que conviene ver funcionar:
--   · números del 1 al 11 en orden de antigüedad
--   · uno DE BAJA (número 0, fuera de la numeración)
--   · uno que PIDIÓ LA BAJA y sigue esperando
--   · un menor con fecha de nacimiento
--   · uno sin correo (que los hay, y muchos)
--
-- La contraseña de todos es «prueba1234» — solo sirve en modo local; con
-- Supabase el acceso va por cuenta de Auth.

insert into hermanos (numero, nombre, estado, antiguedad, email, telefono, direccion, cuota_al_dia, iban, dni, clave_acceso, fecha_nacimiento, etiquetas, baja_solicitada, baja_solicitada_el, motivo_baja) values
  (1,  'Antonio Ruiz Delgado',      'Activo', 1968, 'antonio.ruiz@example.com',   '600 100 001', 'C/ Betis, 3',       true,  'ES47 2100 0813 6102 0012 0001', 'X0000001TEST', 'prueba1234', '1950-03-14', '{"Junta de gobierno"}', false, null, null),
  (2,  'María Fernández Lobo',      'Activo', 1975, 'maria.fernandez@example.com','600 100 002', 'C/ Pureza, 21',     true,  'ES47 2100 0813 6102 0012 0002', 'X0000002TEST', 'prueba1234', '1958-07-02', '{}',                    false, null, null),
  (3,  'José Luis Cabrera Pino',    'Activo', 1982, 'jl.cabrera@example.com',     '600 100 003', 'C/ Castilla, 44',   false, 'ES47 2100 0813 6102 0012 0003', 'X0000003TEST', 'prueba1234', '1962-11-20', '{"Costalero"}',         false, null, null),
  (4,  'Carmen Ortiz Bermejo',      'Activo', 1990, 'carmen.ortiz@example.com',   '600 100 004', 'C/ Alfarería, 12',  true,  'ES47 2100 0813 6102 0012 0004', 'X0000004TEST', 'prueba1234', '1971-01-30', '{}',                    false, null, null),
  (5,  'Francisco Gómez Nieto',     'Activo', 1998, 'fran.gomez@example.com',     '600 100 005', 'C/ San Jacinto, 8', false, 'ES47 2100 0813 6102 0012 0005', 'X0000005TEST', 'prueba1234', '1980-05-16', '{"Costalero"}',         false, null, null),
  -- Este ha pedido la baja: tiene que salir avisado en el Inicio y en Hermanos.
  (6,  'Rocío Delgado Pérez',       'Activo', 2004, 'rocio.delgado@example.com',  '600 100 006', 'C/ Trajano, 5',     true,  null,                            'X0000006TEST', 'prueba1234', '1986-09-09', '{}',                    true,  '19 ago 2026', 'Me mudo a Madrid por trabajo.'),
  (7,  'Manuel Vega Santos',        'Activo', 2010, 'manuel.vega@example.com',    '600 100 007', 'C/ Feria, 60',      true,  'ES47 2100 0813 6102 0012 0007', 'X0000007TEST', 'prueba1234', '1992-02-11', '{"Acólito"}',           false, null, null),
  -- Sin correo: existen, y muchos. Sirve para ver qué pasa al mandar avisos.
  (8,  'Dolores Cano Rivas',        'Activo', 2014, '',                            '600 100 008', 'C/ Amparo, 2',      false, null,                            'X0000008TEST', 'prueba1234', '1948-12-01', '{}',                    false, null, null),
  (9,  'Álvaro Núñez Peña',         'Activo', 2019, 'alvaro.nunez@example.com',   '600 100 009', 'C/ Relator, 17',    true,  'ES47 2100 0813 6102 0012 0009', 'X0000009TEST', 'prueba1234', '1995-06-23', '{"Banda / Música"}',    false, null, null),
  (10, 'Inmaculada Ramos Gil',      'Nuevo',  2026, 'inma.ramos@example.com',     '600 100 010', 'C/ Parras, 9',      false, null,                            'X0000010TEST', 'prueba1234', '2000-04-04', '{}',                    false, null, null),
  -- Un menor: para probar el alta a cargo de un tutor.
  (11, 'Lucía Gómez Ruiz',          'Nuevo',  2026, '',                            '',            'C/ San Jacinto, 8', false, null,                            'X0000011TEST', 'prueba1234', '2016-04-12', '{}',                    false, null, null),
  -- De baja: número 0, fuera de la numeración, con su historial intacto.
  (0,  'Rafael Moreno Ariza',       'Baja',   1988, 'rafael.moreno@example.com',  '600 100 012', 'C/ Torrijos, 1',    false, null,                            'X0000012TEST', 'prueba1234', '1965-08-19', '{}',                    false, null, null);


-- -----------------------------------------------------------------------------
-- 4. LAS CUOTAS DEL EJERCICIO
-- -----------------------------------------------------------------------------
-- Una por hermano activo, con los cuatro estados posibles para ver que la
-- pantalla de Cuotas los distingue. Una lleva aviso de pago del hermano.

insert into cuotas (numero, hermano_id, concepto, importe, estado, fecha_emision, fecha_cobro, domiciliada, metodo_cobro, fecha_pago, ejercicio, pago_comunicado)
select
  2000 + h.numero,
  h.id,
  'Cuota anual',
  60,
  case
    when h.cuota_al_dia then 'Pagada'
    when h.numero = 3 then 'Devuelta'
    when h.numero = 5 then 'En mora'
    else 'Pendiente'
  end,
  '02 feb 2026',
  '17 feb 2026',
  h.iban is not null,
  case when h.iban is not null then 'Domiciliación' else 'Transferencia' end,
  case when h.cuota_al_dia then '05 feb 2026' else null end,
  2026,
  -- El nº 8 dice que ya ha pagado por Bizum: tiene que saltarle a tesorería.
  case when h.numero = 8 then '{"metodo":"Bizum","fecha":"19 ago 2026"}'::jsonb else null end
from hermanos h
where h.dni like 'X%TEST' and h.estado <> 'Baja';


-- -----------------------------------------------------------------------------
-- 5. LAS PAPELETAS DE SITIO
-- -----------------------------------------------------------------------------
-- A los seis primeros activos, repartidos entre los tramos de prueba.

insert into papeletas (numero, hermano_id, anio, tramo_id, importe, estado, fecha_solicitud, metodo_pago, fecha_pago)
select
  3000 + h.numero,
  h.id,
  2026,
  t.id,
  coalesce(t.precio, 18),
  case when h.numero <= 3 then 'Pagada' else 'Asignada' end,
  '10 ene 2026',
  case when h.numero <= 3 then 'Bizum' else null end,
  case when h.numero <= 3 then '10 ene 2026' else null end
from hermanos h
join lateral (
  select id, precio from tramos
  where nombre like '[PRUEBA]%'
  order by orden
  offset (h.numero - 1) % 4 limit 1
) t on true
where h.dni like 'X%TEST' and h.estado = 'Activo' and h.numero between 1 and 6;


-- =============================================================================
--   COMPROBACIÓN — qué ha quedado
-- =============================================================================

select 'Hermandad'      as que, count(*)::text as cuantos, max(nombre_legal) as detalle from hermandad_settings where nombre_legal like '%Prueba%'
union all
select 'Tramos',        count(*)::text, string_agg(distinct cuerpo, ', ') from tramos where nombre like '[PRUEBA]%'
union all
select 'Hermanos',      count(*)::text, 'del nº 1 al 11, uno de baja' from hermanos where dni like 'X%TEST'
union all
select 'Cuotas',        count(*)::text, string_agg(distinct c.estado, ', ') from cuotas c join hermanos h on h.id = c.hermano_id where h.dni like 'X%TEST'
union all
select 'Papeletas',     count(*)::text, string_agg(distinct p.estado, ', ') from papeletas p join hermanos h on h.id = p.hermano_id where h.dni like 'X%TEST'
union all
select 'Piden la baja', count(*)::text, string_agg(nombre, ', ') from hermanos where dni like 'X%TEST' and baja_solicitada
union all
select 'Avisan de pago',count(*)::text, 'debe saltar en Cuotas' from cuotas c join hermanos h on h.id = c.hermano_id where h.dni like 'X%TEST' and c.pago_comunicado is not null;


-- =============================================================================
--   PARA BORRARLO TODO CUANDO TERMINES
-- =============================================================================
--
--   delete from hermanos where dni like 'X%TEST';
--   delete from tramos where nombre like '[PRUEBA]%';
--
-- Las cuotas y las papeletas se van solas con el hermano.
-- La fila de hermandad_settings NO se borra (es única): se sobrescribe con los
-- datos de verdad desde Configuración.
--
-- =============================================================================
