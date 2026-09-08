-- =============================================================================
--   VIGILANCIA: ENTERARSE DE LOS FALLOS SIN QUE NADIE LOS CUENTE
-- =============================================================================
--
-- Con tres hermandades, de los fallos te enteras por WhatsApp. Con cincuenta no
-- te enteras: el primer aviso es que alguien se da de baja, y para entonces
-- llevaba tres meses sin poder imprimir las papeletas.
--
-- Esto es una tabla donde el navegador deja lo que se ha roto. Nada más.
--
-- -----------------------------------------------------------------------------
-- POR QUÉ AQUÍ Y NO EN SENTRY (O SIMILAR)
-- -----------------------------------------------------------------------------
--
-- Porque un fallo de Gobergo lleva dentro el nombre de la hermandad, la
-- pantalla donde estaba y, a veces, trozos de mensajes de la base con datos
-- reales. Mandar eso a un tercero es una cesión de datos que habría que poner
-- en el registro de tratamientos, contarle al hermano y firmar con el
-- proveedor. Por un contador de errores.
--
-- La base ya la tienes, ya es la que guarda el censo, y ya está en el registro.
-- Guardar los fallos aquí no añade ni un solo tratamiento nuevo.
--
-- Lo que se pierde es lo que hace bien un Sentry —agrupar, avisar por correo,
-- enseñar el fallo con el código al lado—. Lo que se gana es que puedes mirar
-- esta tabla en el panel de Supabase, ordenada por fecha, y ver lo que se está
-- rompiendo hoy en todas las hermandades a la vez. Que es el 90 % del valor.
--
-- -----------------------------------------------------------------------------
-- QUÉ MIRAR, EN EL SQL EDITOR
-- -----------------------------------------------------------------------------
--
--   -- Lo que más se rompe esta semana, agrupado:
--   select mensaje, count(*), max(ocurrido_el)
--     from errores_cliente
--    where ocurrido_el > now() - interval '7 days'
--    group by mensaje order by count(*) desc;
--
--   -- Y a qué hermandades les pasa:
--   select h.nombre, e.mensaje, e.ruta, e.ocurrido_el
--     from errores_cliente e left join hermandades h on h.id = e.hermandad_id
--    order by e.ocurrido_el desc limit 50;
--
-- Ejecútalo después de `multi-hermandad.sql`. Volver a ejecutarlo no hace nada.
-- =============================================================================

create table if not exists errores_cliente (
  id uuid primary key default gen_random_uuid(),
  hermandad_id uuid references hermandades(id) on delete cascade,
  ocurrido_el timestamptz not null default now(),
  /*
   * DÓNDE ESTABA. Es el primer dato que se pregunta siempre y el que menos se
   * acuerda quien lo sufre. `/app/papeletas`, `/app/cuotas`…
   */
  ruta text not null default '',
  /*
   * QUÉ FALLÓ, en una línea. Es la clave por la que se agrupa, así que se
   * guarda tal cual llega, sin fecha ni números dentro (eso lo limpia el
   * navegador antes de mandarlo, ver `src/lib/vigilancia.ts`): si cada fallo
   * trae un identificador distinto, agrupar no sirve de nada.
   */
  mensaje text not null,
  /*
   * LA PILA. Es lo único que dice EN QUÉ LÍNEA, y en producción viene con los
   * nombres del paquete comprimido, así que hace falta el mapa de fuentes para
   * leerla. Aun así, comparar dos pilas distingue dos fallos que traen el
   * mismo mensaje.
   */
  pila text not null default '',
  /*
   * DE QUÉ TIPO. 'js' (algo se rompió en el navegador), 'promesa' (un `await`
   * que nadie recogió) o 'base' (la base de datos rechazó una escritura).
   * Los tres se cuentan igual pero no se arreglan igual.
   */
  clase text not null default 'js',
  navegador text not null default '',
  /*
   * QUÉ VERSIÓN DE LA APLICACIÓN. Sin esto no se puede decir «esto se arregló
   * el martes» ni saber si quien lo sufre tiene el arreglo. Es la fecha de
   * compilación, que la pone Vite.
   */
  version_app text not null default '',
  /* Su cargo. Casi todo lo que falla depende de los permisos. */
  cargo text not null default ''
);

alter table errores_cliente enable row level security;
alter table errores_cliente alter column hermandad_id set default hermandad_actual();

create index if not exists errores_cliente_cuando_idx on errores_cliente (ocurrido_el desc);
create index if not exists errores_cliente_hermandad_idx on errores_cliente (hermandad_id);

/*
 * ESCRIBE CUALQUIERA QUE HAYA ENTRADO, EN SU HERMANDAD Y SOLO EN LA SUYA.
 *
 * El hermano incluido, y hace falta: la mitad de lo que se rompe se rompe en
 * el área del hermano, desde un móvil, y esa persona no va a escribir un
 * reporte.
 *
 * NO ENTRA `anon`. La web pública se pinta sin sesión, así que sus fallos no
 * se recogen — es una pérdida real y se acepta a cambio de no dejar una tabla
 * de la base abierta a que cualquiera de internet la llene. Un formulario
 * anónimo que escribe sin límite es un problema mayor que el que resuelve.
 */
drop policy if exists "errores_escribir" on errores_cliente;
create policy "errores_escribir" on errores_cliente
  for insert to authenticated
  with check (hermandad_id = hermandad_actual());

/*
 * Y NO LO LEE NADIE DESDE LA APLICACIÓN.
 *
 * Sin política de select, RLS deniega. Se mira desde el panel de Supabase, que
 * entra con la clave de servicio y se salta RLS.
 *
 * POR QUÉ NO DEJAR QUE LA HERMANDAD VEA LOS SUYOS. Porque no le sirve de nada
 * —«TypeError: Cannot read properties of undefined» no es información para una
 * secretaria— y porque sí le sirve para preocuparse. Los fallos son para quien
 * los puede arreglar.
 */

/**
 * Tirar lo viejo. Sesenta días es más que de sobra: un fallo que lleva dos
 * meses sin repetirse o está arreglado o no le importa a nadie.
 *
 * Se llama sola si tienes `pg_cron` activado (Database → Extensions), y si no,
 * a mano de vez en cuando. No pasa nada por no llamarla: son filas de texto,
 * no fotos.
 *
 *   select cron.schedule('limpiar-errores', '0 4 * * 0', 'select limpiar_errores_cliente()');
 */
create or replace function limpiar_errores_cliente() returns integer
language plpgsql security definer set search_path = public as $$
declare borradas integer;
begin
  delete from errores_cliente where ocurrido_el < now() - interval '60 days';
  get diagnostics borradas = row_count;
  return borradas;
end $$;
