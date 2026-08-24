-- =============================================================================
--
--   GOBERGO — ¿QUÉ LE FALTA A ESTA BASE DE DATOS?
--
-- =============================================================================
--
--   GENERADO. No lo edites a mano: se regenera con
--       node scripts/generar-diagnostico.mjs
--
-- -----------------------------------------------------------------------------
-- PARA QUÉ SIRVE
-- -----------------------------------------------------------------------------
--
-- Cuando algo «se guarda» pero al recargar no está, casi siempre es lo mismo:
-- la aplicación escribe una columna que esta base no tiene. Postgres no ignora
-- la columna que le sobra —rechaza la operación entera—, así que no se pierde
-- un campo: no se guarda NADA.
--
-- Esto no cambia nada. Solo mira y responde.
--
--   1. Supabase → SQL Editor → New query
--   2. Pega esto entero y dale a RUN
--   3. Si dice «No rows returned», no falta nada: el problema es otro
--      Si salen filas, ejecuta `TODO-EN-UNO.sql` y vuelve a pasar esto
--
-- Va TODO en una sola consulta a propósito. Con dos, el editor de Supabase
-- enseña solo el resultado de la última, y un «no falta nada» podía estar
-- escondiendo la lista de columnas que sí faltaban.
--
-- =============================================================================

with esperado (tabla, columna) as (
  values
    ('comunicados', 'alcance'),
    ('comunicados', 'autor'),
    ('comunicados', 'canal'),
    ('comunicados', 'criterios'),
    ('comunicados', 'cuerpo'),
    ('comunicados', 'destinatarios'),
    ('comunicados', 'estado'),
    ('comunicados', 'fecha_creacion'),
    ('comunicados', 'fecha_envio'),
    ('comunicados', 'fecha_programada'),
    ('comunicados', 'hermandad_id'),
    ('comunicados', 'id'),
    ('comunicados', 'numero'),
    ('comunicados', 'redes'),
    ('comunicados', 'titulo'),
    ('cuotas', 'concepto'),
    ('cuotas', 'domiciliada'),
    ('cuotas', 'ejercicio'),
    ('cuotas', 'estado'),
    ('cuotas', 'fecha_cobro'),
    ('cuotas', 'fecha_emision'),
    ('cuotas', 'fecha_pago'),
    ('cuotas', 'hermandad_id'),
    ('cuotas', 'hermano_id'),
    ('cuotas', 'id'),
    ('cuotas', 'importe'),
    ('cuotas', 'metodo_cobro'),
    ('cuotas', 'mora_propuesta_nombre'),
    ('cuotas', 'mora_propuesta_por'),
    ('cuotas', 'numero'),
    ('cuotas', 'pago_comunicado'),
    ('cuotas', 'remesada_el'),
    ('documentos', 'archivado_por'),
    ('documentos', 'archivo_nombre'),
    ('documentos', 'archivo_tamano'),
    ('documentos', 'archivo_tipo'),
    ('documentos', 'cargos_con_acceso'),
    ('documentos', 'categoria'),
    ('documentos', 'descripcion'),
    ('documentos', 'estado_expediente'),
    ('documentos', 'fecha'),
    ('documentos', 'fecha_alta'),
    ('documentos', 'hermandad_id'),
    ('documentos', 'id'),
    ('documentos', 'nombre'),
    ('documentos', 'numero'),
    ('documentos', 'proveedor'),
    ('documentos', 'tipo_cabildo'),
    ('documentos', 'vigencia_hasta'),
    ('enseres', 'categoria'),
    ('enseres', 'estado_conservacion'),
    ('enseres', 'fecha_alta'),
    ('enseres', 'hermandad_id'),
    ('enseres', 'id'),
    ('enseres', 'nombre'),
    ('enseres', 'notas'),
    ('enseres', 'numero'),
    ('enseres', 'prestado_a'),
    ('enseres', 'ubicacion'),
    ('enseres', 'valor_asegurado'),
    ('eventos', 'descripcion'),
    ('eventos', 'fecha'),
    ('eventos', 'hermandad_id'),
    ('eventos', 'hora'),
    ('eventos', 'id'),
    ('eventos', 'lugar'),
    ('eventos', 'repeticion'),
    ('eventos', 'tareas'),
    ('eventos', 'tipo'),
    ('eventos', 'titulo'),
    ('hermandad_settings', 'bizum_telefono'),
    ('hermandad_settings', 'cif'),
    ('hermandad_settings', 'ciudad'),
    ('hermandad_settings', 'codigo_postal'),
    ('hermandad_settings', 'color_primario'),
    ('hermandad_settings', 'color_secundario'),
    ('hermandad_settings', 'direccion'),
    ('hermandad_settings', 'email'),
    ('hermandad_settings', 'hermandad_id'),
    ('hermandad_settings', 'iban'),
    ('hermandad_settings', 'identificador_acreedor'),
    ('hermandad_settings', 'logo_data_url'),
    ('hermandad_settings', 'nombre_legal'),
    ('hermandad_settings', 'precio_papeleta'),
    ('hermandad_settings', 'precio_simbolica'),
    ('hermandad_settings', 'provincia'),
    ('hermandad_settings', 'telefono'),
    ('hermandad_settings', 'texto_pie_documentos'),
    ('hermanos', 'antiguedad'),
    ('hermanos', 'auth_user_id'),
    ('hermanos', 'baja_solicitada'),
    ('hermanos', 'baja_solicitada_el'),
    ('hermanos', 'cargo'),
    ('hermanos', 'civil'),
    ('hermanos', 'clave_acceso'),
    ('hermanos', 'consiente_foto'),
    ('hermanos', 'correo_acceso'),
    ('hermanos', 'cuota_al_dia'),
    ('hermanos', 'direccion'),
    ('hermanos', 'dni'),
    ('hermanos', 'email'),
    ('hermanos', 'estado'),
    ('hermanos', 'etiquetas'),
    ('hermanos', 'fecha_bautismo'),
    ('hermanos', 'fecha_nacimiento'),
    ('hermanos', 'foto_data_url'),
    ('hermanos', 'hermandad_id'),
    ('hermanos', 'iban'),
    ('hermanos', 'id'),
    ('hermanos', 'motivo_baja'),
    ('hermanos', 'nombre'),
    ('hermanos', 'notas_salud'),
    ('hermanos', 'numero'),
    ('hermanos', 'parroquia_bautismo'),
    ('hermanos', 'talla_tunica'),
    ('hermanos', 'telefono'),
    ('incidencias', 'descripcion'),
    ('incidencias', 'hermandad_id'),
    ('incidencias', 'hora'),
    ('incidencias', 'id'),
    ('incidencias', 'papeleta_id'),
    ('incidencias', 'registrado_por'),
    ('incidencias', 'resuelta'),
    ('incidencias', 'tipo'),
    ('mensajes_web', 'asunto'),
    ('mensajes_web', 'atendido'),
    ('mensajes_web', 'causa'),
    ('mensajes_web', 'email'),
    ('mensajes_web', 'fecha'),
    ('mensajes_web', 'hermandad_id'),
    ('mensajes_web', 'id'),
    ('mensajes_web', 'importe'),
    ('mensajes_web', 'leido'),
    ('mensajes_web', 'mensaje'),
    ('mensajes_web', 'metodo'),
    ('mensajes_web', 'nombre'),
    ('mensajes_web', 'participaciones'),
    ('mensajes_web', 'telefono'),
    ('mensajes_web', 'tipo'),
    ('movimientos', 'categoria'),
    ('movimientos', 'concepto'),
    ('movimientos', 'cuenta'),
    ('movimientos', 'estado'),
    ('movimientos', 'fecha'),
    ('movimientos', 'hermandad_id'),
    ('movimientos', 'id'),
    ('movimientos', 'importe'),
    ('movimientos', 'numero'),
    ('movimientos', 'origen'),
    ('movimientos', 'tipo'),
    ('papeletas', 'anio'),
    ('papeletas', 'estado'),
    ('papeletas', 'fecha_entrega'),
    ('papeletas', 'fecha_pago'),
    ('papeletas', 'fecha_solicitud'),
    ('papeletas', 'hermandad_id'),
    ('papeletas', 'hermano_id'),
    ('papeletas', 'id'),
    ('papeletas', 'importe'),
    ('papeletas', 'metodo_pago'),
    ('papeletas', 'motivo_anulacion'),
    ('papeletas', 'numero'),
    ('papeletas', 'opcion'),
    ('papeletas', 'pago_fecha'),
    ('papeletas', 'pago_metodo'),
    ('papeletas', 'tramo_id'),
    ('personal', 'activo'),
    ('personal', 'auth_user_id'),
    ('personal', 'cargo'),
    ('personal', 'clave'),
    ('personal', 'email'),
    ('personal', 'fecha_alta'),
    ('personal', 'hermandad_id'),
    ('personal', 'id'),
    ('personal', 'nombre'),
    ('solicitudes_alta', 'clave_propuesta'),
    ('solicitudes_alta', 'dni'),
    ('solicitudes_alta', 'email'),
    ('solicitudes_alta', 'estado'),
    ('solicitudes_alta', 'fecha'),
    ('solicitudes_alta', 'fecha_nacimiento'),
    ('solicitudes_alta', 'hermandad_id'),
    ('solicitudes_alta', 'id'),
    ('solicitudes_alta', 'motivo_rechazo'),
    ('solicitudes_alta', 'nombre'),
    ('solicitudes_alta', 'resuelta_el'),
    ('solicitudes_alta', 'telefono'),
    ('solicitudes_alta', 'tutor_id'),
    ('tramos', 'capacidad'),
    ('tramos', 'cuerpo'),
    ('tramos', 'etiqueta'),
    ('tramos', 'hermandad_id'),
    ('tramos', 'hora_citacion'),
    ('tramos', 'id'),
    ('tramos', 'nombre'),
    ('tramos', 'precio'),
    ('tramos', 'reparto'),
    ('tramos', 'tipo')
), tablas_que_hay as (
  select table_name from information_schema.tables where table_schema = 'public'
), columnas_que_hay as (
  select table_name, column_name from information_schema.columns where table_schema = 'public'
)
select * from (
  -- Las tablas que no existen. Van primero porque si falta la tabla entera, lo
  -- de las columnas es ruido: lo que pasa es que no se ha ejecutado el SQL.
  select
    'FALTA LA TABLA ENTERA' as "Qué pasa",
    e.tabla                 as "Tabla",
    ''                      as "Columna"
  from (select distinct tabla from esperado) e
  where e.tabla not in (select table_name from tablas_que_hay)

  union all

  select
    'falta una columna' as "Qué pasa",
    e.tabla             as "Tabla",
    e.columna           as "Columna"
  from esperado e
  where e.tabla in (select table_name from tablas_que_hay)
    and (e.tabla, e.columna) not in (select table_name, column_name from columnas_que_hay)
) todo
order by "Qué pasa", "Tabla", "Columna";
