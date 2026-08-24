-- =============================================================================
--   LO-QUE-TOCA-EL-HERMANO.SQL — El hermano no se pone la cuota como pagada
-- =============================================================================
--
-- EL AGUJERO, y es el mismo que ya se cerró en la ficha del hermano con
-- `hermanos_solo_personal_toca_el_cargo`. Aquí quedó abierto.
--
-- El hermano necesita poder escribir en SU recibo: es como avisa de que ya ha
-- pagado por Bizum o por transferencia. Para eso hay una política de UPDATE
-- sobre `cuotas`. Y el razonamiento con el que se dejó sin acotar por columnas
-- está escrito en `area-hermano.sql`:
--
--     «No hace falta acotar más por columnas: lo único que la aplicación le
--      deja tocar ahí es el aviso de pago.»
--
-- Y AHÍ ESTÁ EL FALLO. Lo que le deje tocar la aplicación no protege nada: el
-- hermano tiene una sesión de verdad, y desde la consola del navegador —la que
-- se abre con F12— puede hablar con la base de datos directamente, sin pasar
-- por ninguna pantalla:
--
--     supabase.from('cuotas').update({ estado: 'Pagada', importe: 0 })
--             .eq('hermano_id', ...)
--
-- Comprobado contra un Postgres de verdad: la fila cambia. En ese momento su
-- recibo queda pagado y a cero, él sale como al corriente, se lleva su papeleta
-- de sitio, y las cuentas de la hermandad dicen que ese dinero entró. La
-- tesorería no tiene forma de notarlo: en su pantalla el recibo está pagado.
--
-- Y NO ES UN CASO DE LABORATORIO. Es una línea, con la sesión que ya tiene
-- abierta, sin herramientas y sin saber nada de bases de datos: se busca en
-- cualquier sitio. En una hermandad de seiscientos hermanos basta con que a uno
-- se le ocurra y se lo cuente al de al lado.
--
-- LO MISMO EN LAS PAPELETAS. Ahí el hermano sí hace cosas de verdad —renovar
-- su sitio, renunciar, avisar de que ha pagado—, pero no puede ponerse la
-- papeleta como «Pagada» ni como «Entregada», ni cambiarse el número, ni
-- ponerse fecha de entrega.
--
-- Se arregla como se arregló en la ficha: LISTA BLANCA. Se dice qué puede
-- cambiar y todo lo demás vuelve a como estaba. Lista blanca y no lista negra,
-- porque una lista negra se queda corta el día que alguien añade una columna.
--
-- Se puede ejecutar sobre una base ya en uso: no toca ninguna fila.

/**
 * Lo único que un hermano puede cambiar de SU recibo: el aviso de pago.
 *
 * Ni el estado, ni el importe, ni la fecha de cobro, ni si está domiciliado, ni
 * si ya viajó en una remesa. Todo eso lo decide la tesorería al confirmar.
 */
create or replace function cuotas_el_hermano_solo_avisa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Sin sesión no es el navegador: es el editor SQL o una función interna, que
  -- ya han pasado por RLS. Ahí no hay nada que proteger y estorbaría para
  -- arreglar datos a mano.
  if auth.uid() is null then return new; end if;

  -- Quien lleva las cuotas escribe la fila entera, que es su trabajo.
  if modulo_permitido('cuotas') or modulo_permitido('tesoreria') then return new; end if;

  -- Un hermano no se emite recibos a sí mismo.
  if tg_op = 'INSERT' then
    raise exception 'Un hermano no puede crearse recibos.' using errcode = 'P0001';
  end if;

  new.numero := old.numero;
  new.hermano_id := old.hermano_id;
  new.concepto := old.concepto;
  new.importe := old.importe;
  new.estado := old.estado;
  new.fecha_emision := old.fecha_emision;
  new.fecha_cobro := old.fecha_cobro;
  new.domiciliada := old.domiciliada;
  new.metodo_cobro := old.metodo_cobro;
  new.fecha_pago := old.fecha_pago;
  new.ejercicio := old.ejercicio;
  new.hermandad_id := old.hermandad_id;
  new.remesada_el := old.remesada_el;
  -- La mora la propone quien lleva las cuotas, no el que la debe.
  new.mora_propuesta_por := old.mora_propuesta_por;
  new.mora_propuesta_nombre := old.mora_propuesta_nombre;
  -- Y `pago_comunicado` es lo que sí se le deja: es el aviso.
  return new;
end $$;

drop trigger if exists cuotas_el_hermano_solo_avisa on cuotas;
create trigger cuotas_el_hermano_solo_avisa
  before insert or update on cuotas
  for each row execute function cuotas_el_hermano_solo_avisa();

comment on function cuotas_el_hermano_solo_avisa() is
  'Lista blanca de lo que un hermano puede cambiar de SU recibo: solo el aviso de pago. '
  'Sin esto, con su propia sesión y una línea desde la consola del navegador se ponía el '
  'recibo como pagado y a cero, salía al corriente y se llevaba su papeleta.';


/**
 * Y en su papeleta: puede renovar, renunciar y avisar de que ha pagado.
 *
 * No puede ponerse la papeleta como pagada ni como entregada —eso lo dice quien
 * la cobra y quien la entrega—, ni cambiarse el número, que es el sitio en el
 * cortejo y va por antigüedad.
 */
create or replace function papeletas_lo_que_toca_el_hermano() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if modulo_permitido('papeletas') or modulo_permitido('cortejo') then return new; end if;

  if tg_op = 'INSERT' then
    -- Pedirla sí puede; nace sin cobrar y sin entregar.
    new.estado := 'Asignada';
    new.fecha_entrega := null;
    new.pago_fecha := null;
    new.fecha_pago := null;
    new.motivo_anulacion := null;
    return new;
  end if;

  new.numero := old.numero;
  new.hermano_id := old.hermano_id;
  new.anio := old.anio;
  new.hermandad_id := old.hermandad_id;
  new.fecha_solicitud := old.fecha_solicitud;
  -- Lo que dice que está cobrada o entregada no lo pone él.
  new.fecha_entrega := old.fecha_entrega;
  new.pago_metodo := old.pago_metodo;
  new.pago_fecha := old.pago_fecha;
  new.metodo_pago := old.metodo_pago;
  new.fecha_pago := old.fecha_pago;
  new.motivo_anulacion := old.motivo_anulacion;

  /*
   * EL ESTADO, solo a los dos sitios a los que él puede llevarlo: pedir su
   * sitio y renunciar. «Pagada» y «Entregada» las dice quien cobra y quien
   * entrega; «Anulada» la dice la hermandad.
   */
  if new.estado is distinct from old.estado
     and new.estado not in ('Asignada', 'Renuncia') then
    new.estado := old.estado;
  end if;

  return new;
end $$;

drop trigger if exists papeletas_lo_que_toca_el_hermano on papeletas;
create trigger papeletas_lo_que_toca_el_hermano
  before insert or update on papeletas
  for each row execute function papeletas_lo_que_toca_el_hermano();

comment on function papeletas_lo_que_toca_el_hermano() is
  'Lista blanca de lo que un hermano puede cambiar de SU papeleta: pedir sitio, renunciar '
  'y avisar del pago. Ni cobrarla, ni entregarla, ni cambiarse el número.';

-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Los dos disparadores tienen que estar:
--
--   select tgname from pg_trigger
--    where tgrelid in ('cuotas'::regclass, 'papeletas'::regclass) and not tgisinternal;
--
-- Tiene que salir `cuotas_el_hermano_solo_avisa` y `papeletas_lo_que_toca_el_hermano`,
-- además de los `apuntar_*` del registro de actividad.
