-- =============================================================================
--   LA PAPELETA SIMBÓLICA, Y EL PRECIO DE LA PAPELETA
-- =============================================================================
--
-- DOS COSAS, Y LAS DOS SON DE LA HERMANDAD, NO DEL NAVEGADOR.
--
-- 1. EL PRECIO GENERAL DE LA PAPELETA se guardaba SOLO en el navegador de quien
--    lo escribía (`localStorage`). El tesorero ponía 18 € en su ordenador y la
--    secretaria, desde el suyo, seguía viendo el que trae la aplicación de
--    fábrica — y emitía las papeletas de todo el año a ese precio. No fallaba
--    nada, no avisaba nada: simplemente cada uno cobraba una cosa.
--
-- 2. LA PAPELETA SIMBÓLICA es la de quien TIENE derecho a su sitio y ese año no
--    quiere salir. Es una sola y se llama así: si alguien quiere salir, sitio
--    hay. Todo lo que camina —una mantilla, un nazareno de cirio— es un TRAMO
--    del cortejo, con su aforo, su precio y su hora de citación, y no tiene
--    nada que hacer en otra lista.
--
-- QUÉ SE VA. La tabla `opciones_papeleta` (la lista de «papeletas
-- personalizadas») deja de usarse: era un tramo pobre, con su propio nombre y
-- su propio precio, y hacía que dos hermanos del mismo tramo pudieran pagar
-- distinto según por qué puerta hubieran entrado.
--
-- No se borra aquí. Borrarla dejaría fuera de servicio a la versión de la
-- aplicación que esté subida en ese momento, que sí la lee. Cuando lleves unos
-- días con la versión nueva, se puede quitar con:
--
--     drop table if exists opciones_papeleta;
--
-- Las papeletas ya emitidas no se tocan: `papeletas.opcion` guarda el nombre
-- con el que se emitieron y sigue siendo historia válida.

alter table hermandad_settings
  add column if not exists precio_papeleta numeric(10, 2) not null default 18;

alter table hermandad_settings
  add column if not exists precio_simbolica numeric(10, 2) not null default 5;

comment on column hermandad_settings.precio_papeleta is
  'Precio de la papeleta cuando el tramo no fija el suyo propio. Antes vivía en '
  'el localStorage de un navegador, así que cada persona emitía a un precio.';

comment on column hermandad_settings.precio_simbolica is
  'Precio de la papeleta simbólica: la de quien tiene derecho a su sitio y ese '
  'año no sale. No ocupa puesto en el cortejo.';
