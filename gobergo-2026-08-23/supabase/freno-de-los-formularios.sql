-- =============================================================================
--   FRENO-DE-LOS-FORMULARIOS.SQL — Que nadie llene la base desde fuera
-- =============================================================================
--
-- HAY TRES PUERTAS QUE PUEDE EMPUJAR CUALQUIERA SIN IDENTIFICARSE, y ninguna
-- tenía tope:
--
--   · el buzón de la web (`mensajes_web`): contacto, donativos, lotería;
--   · las solicitudes de alta (`solicitudes_alta`);
--   · el contador de visitas, que tiene su freno en `visitas-web.sql`, donde
--     vive la función. Ponerlo aquí la redefiniría, y entonces ese fichero
--     dejaría de poder ejecutarse suelto sin deshacer el freno.
--
-- Las tres se abren a `anon` a propósito y así tiene que seguir siendo: es la
-- web pública y el visitante no tiene sesión ni la va a tener. Lo que faltaba
-- era el freno.
--
-- LO QUE HAY EN EL NAVEGADOR NO CUENTA. Los formularios llevan un campo trampa
-- para robots, y está bien, pero solo lo ve quien pasa por el formulario. Quien
-- habla con la base directamente —que es de lo que va esto— no lo pisa.
--
-- QUÉ PASA SIN FRENO, y son dos cosas distintas:
--
--   1. SE AHOGA EL BUZÓN. Diez mil mensajes de relleno y los tres de verdad
--      —un donativo, una consulta, alguien que quiere hacerse hermano— no hay
--      quien los encuentre. No hace falta tirar nada abajo para hacer daño.
--   2. SE LLENA LA BASE. Un proyecto de Supabase del plan gratuito tiene el
--      espacio contado, y ahí no se cae solo el buzón: se cae la hermandad
--      entera, con su censo y sus cuotas dentro.
--
-- Y AL TEXTO TAMPOCO SE LE PEDÍA MEDIDA: un solo mensaje podía traer megas.
-- Se recorta aquí, del lado de la base, porque lo que recorta el navegador se
-- quita quitando el navegador de en medio.
--
-- LOS TOPES SON HOLGADOS A PROPÓSITO. Sesenta mensajes por hora en una
-- hermandad es muchísimo —el día siguiente a la salida no llegan ni diez—, y
-- cuarenta altas por hora son casi mil al día. No se trata de acotar el uso de
-- verdad, sino de que el abuso no salga gratis.
--
-- Se puede ejecutar sobre una base ya en uso: no toca ninguna fila.

/**
 * El buzón: se recorta el texto y se cuentan los de la última hora.
 *
 * El personal de la hermandad no pasa por aquí (`auth.uid()` con sesión y sin
 * ser hermano): si algún día se importa un buzón entero, no se topa consigo
 * mismo.
 */
create or replace function mensajes_web_con_freno() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_recientes int;
begin
  -- Medida a todo lo que llega. Va antes del tope: aunque la fila entre, no
  -- puede entrar con megas dentro.
  new.nombre   := left(coalesce(new.nombre, ''), 120);
  new.email    := left(coalesce(new.email, ''), 160);
  new.telefono := left(coalesce(new.telefono, ''), 40);
  new.asunto   := left(coalesce(new.asunto, ''), 200);
  new.mensaje  := left(coalesce(new.mensaje, ''), 4000);
  new.causa    := left(coalesce(new.causa, ''), 200);
  new.metodo   := left(coalesce(new.metodo, ''), 60);

  if tg_op <> 'INSERT' then return new; end if;
  -- Quien tiene sesión y no es hermano es la propia hermandad: no se le frena.
  if auth.uid() is not null and not auth_es_hermano() then return new; end if;

  /*
   * LA HORA LA PONE LA BASE, Y ESTO NO ES UN DETALLE: ES EL FRENO.
   *
   * El tope de abajo cuenta los de la última hora por `creado_en`. Si esa
   * columna llega de fuera, basta con ponerla tres días atrás para que el
   * contador no vea ninguno y el freno no exista. Comprobado: entraban los
   * doscientos.
   *
   * Y de paso, `leido` y `atendido` tampoco los pone quien escribe: si no, se
   * puede dejar un mensaje ya marcado como leído y atendido, o sea, invisible
   * en el buzón de la hermandad.
   */
  new.creado_en := now();
  new.leido := false;
  new.atendido := false;

  select count(*) into v_recientes from mensajes_web
   where hermandad_id = new.hermandad_id and creado_en > now() - interval '1 hour';
  if v_recientes >= 60 then
    -- Se avisa en cristiano: quien llega justo detrás de un barrido tiene
    -- derecho a saber por qué no le funciona y a que le digan que vuelva.
    raise exception 'Ahora mismo no se pueden recoger más mensajes. Inténtalo dentro de un rato.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists mensajes_web_con_freno on mensajes_web;
create trigger mensajes_web_con_freno
  before insert or update on mensajes_web
  for each row execute function mensajes_web_con_freno();


/**
 * Las solicitudes de alta, igual.
 *
 * `fecha` es texto («23 ago 2026») y no sirve para contar por hora, así que se
 * cuentan las que no están resueltas: una avalancha las deja todas pendientes,
 * que es exactamente la señal.
 */
create or replace function solicitudes_con_freno() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pendientes int;
begin
  new.nombre   := left(coalesce(new.nombre, ''), 120);
  new.dni      := left(coalesce(new.dni, ''), 40);
  new.email    := left(coalesce(new.email, ''), 160);
  new.telefono := left(coalesce(new.telefono, ''), 40);

  if tg_op <> 'INSERT' then return new; end if;
  if auth.uid() is not null and not auth_es_hermano() then return new; end if;

  /*
   * Y EL ESTADO LO PONE LA BASE, por lo mismo y por algo peor.
   *
   * El tope de abajo cuenta las PENDIENTES, así que mandándolas con
   * `estado: 'Aprobada'` no cuentan y el freno no existe. Pero es que además,
   * una solicitud que llega ya aprobada desde fuera aparece en el panel de la
   * secretaría como si la hubiera aprobado alguien de la casa.
   */
  new.estado := 'Pendiente';
  new.resuelta_el := null;
  new.motivo_rechazo := null;

  select count(*) into v_pendientes from solicitudes_alta
   where hermandad_id = new.hermandad_id and estado = 'Pendiente';
  /*
   * Trescientas pendientes A LA VEZ no las tiene ninguna hermandad: son las que
   * caben en el panel de la secretaría antes de que deje de poder mirarlas. Y
   * el tope se suelta solo según las va resolviendo, que es lo que la hace
   * distinta de un tope por hora — aquí no hay que esperar a nada.
   */
  if v_pendientes >= 300 then
    raise exception 'Ahora mismo no se pueden recoger más solicitudes. Inténtalo dentro de unos días.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists solicitudes_con_freno on solicitudes_alta;
create trigger solicitudes_con_freno
  before insert or update on solicitudes_alta
  for each row execute function solicitudes_con_freno();



-- -----------------------------------------------------------------------------
-- Comprobación
-- -----------------------------------------------------------------------------
-- Los dos disparadores tienen que estar:
--
--   select tgname from pg_trigger
--    where tgrelid in ('mensajes_web'::regclass, 'solicitudes_alta'::regclass)
--      and not tgisinternal;
