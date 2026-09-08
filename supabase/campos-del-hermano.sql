-- =============================================================================
--   LOS CAMPOS A MEDIDA DE LA HERMANDAD, GUARDADOS EN LA FICHA
-- =============================================================================
--
-- Cada hermandad puede inventarse sus propios campos —talla de túnica, número
-- de llave, si tiene el carné de la banda— desde Configuración. Eso ya
-- funcionaba: la DEFINICIÓN de los campos vive en `hermandad_settings.
-- campos_propios` y viaja bien.
--
-- Lo que no existía era dónde guardar el VALOR de cada hermano.
--
-- -----------------------------------------------------------------------------
-- POR QUÉ NO SE VEÍA
-- -----------------------------------------------------------------------------
--
-- Porque la mitad que viaja es la que se pinta. Desde cualquier ordenador se
-- veía el campo «Talla de túnica» dibujado en la ficha, en su sitio, con su
-- nombre correcto… y vacío. Para los cuatrocientos hermanos. Sin ningún error,
-- sin nada roto en pantalla: un campo vacío parece un campo sin rellenar.
--
-- El valor se escribía en `localStorage` del ordenador donde se rellenó, y ahí
-- se quedaba. La secretaria que tomó las tallas en su portátil las veía todas;
-- cualquier otra persona, ninguna.
--
-- -----------------------------------------------------------------------------
-- POR QUÉ `jsonb` Y NO UNA COLUMNA POR CAMPO
-- -----------------------------------------------------------------------------
--
-- Porque los campos los inventa cada hermandad, y son distintos en cada una.
-- Una columna por campo significaría que dar de alta un campo nuevo desde
-- Configuración tendría que ejecutar un `alter table` — o sea, que la
-- aplicación necesitaría permisos para cambiar el esquema. Eso no se le da a
-- la clave anónima ni debe dársele.
--
-- Se guarda como un objeto `{ "id-del-campo": "valor" }`, y el valor SIEMPRE
-- como texto: si mañana la hermandad cambia el tipo de un campo de «texto» a
-- «número», lo que ya estaba escrito no se pierde.
--
-- Ejecútalo después de `multi-hermandad.sql`. Volver a ejecutarlo no hace nada.
-- =============================================================================

alter table hermanos add column if not exists campos jsonb;

comment on column hermanos.campos is
  'Valores de los campos a medida de la hermandad, indexados por el id del campo '
  '({"id": "valor"}). La DEFINICIÓN de los campos está en '
  'hermandad_settings.campos_propios; aquí solo van los valores, siempre como texto.';

/*
 * NO HACE FALTA TOCAR NINGUNA POLÍTICA.
 *
 * `campos` es una columna más de `hermanos`, y RLS no distingue columnas: quien
 * puede leer y escribir la ficha puede leer y escribir esta. Es lo correcto —
 * la talla de túnica no es más secreta que el teléfono, y las dos están en la
 * misma fila.
 *
 * Y EL HERMANO NO SE LA PUEDE CAMBIAR desde su área, aunque el disparador
 * `hermanos_solo_personal_toca_el_cargo` no la nombre: lo que manda el área del
 * hermano lo decide `contactoDelHermanoToRow` en la aplicación, que envía tres
 * campos y ninguno es este. La lista blanca del disparador es el cinturón; el
 * tirante es que la columna ni siquiera viaja en esa dirección.
 */
