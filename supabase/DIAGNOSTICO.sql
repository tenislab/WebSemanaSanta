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
-- COMPRUEBA CINCO COSAS, y las cinco fallan sin dar la cara:
--
--   1. LAS TABLAS. Si falta una entera, es que ese SQL no se ha ejecutado.
--   2. LAS COLUMNAS que la aplicación escribe. La lista sale de las funciones
--      `toRow` del código, no de una lista a mano: una lista a mano se queda
--      vieja el día que alguien añade un campo, o sea el día que hace falta.
--   3. LAS FUNCIONES que la aplicación llama. Cuando falta una, PostgREST
--      contesta 404 y la aplicación —escrita para aguantar que la base no
--      responda— se lo traga. No sale un error: sale la pantalla vacía.
--   4. LOS CUBOS de archivos. Sin ellos no se sube una foto… y la copia de
--      seguridad semanal falla en silencio, que es lo que de verdad duele.
--   5. LA SEGURIDAD POR FILAS (RLS). Una tabla sin ella la ve CUALQUIER
--      hermandad. No es que algo no funcione: es que funciona de más.
--
-- Y de propina dice por qué versión va la base y por cuál debería ir.
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
    ('campanas_recaudacion', 'descripcion'),
    ('campanas_recaudacion', 'en_la_web'),
    ('campanas_recaudacion', 'estado'),
    ('campanas_recaudacion', 'fecha_fin'),
    ('campanas_recaudacion', 'fecha_inicio'),
    ('campanas_recaudacion', 'id'),
    ('campanas_recaudacion', 'nombre'),
    ('campanas_recaudacion', 'objetivo_cent'),
    ('campanas_recaudacion', 'partidas'),
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
    ('descuentos', 'activo'),
    ('descuentos', 'etiqueta'),
    ('descuentos', 'id'),
    ('descuentos', 'nombre'),
    ('descuentos', 'porcentaje'),
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
    ('hermandad_settings', 'stripe_cuenta'),
    ('hermandad_settings', 'telefono'),
    ('hermandad_settings', 'texto_pie_documentos'),
    ('hermanos', 'antiguedad'),
    ('hermanos', 'auth_user_id'),
    ('hermanos', 'baja_solicitada'),
    ('hermanos', 'baja_solicitada_el'),
    ('hermanos', 'campos'),
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
    ('hermanos', 'fecha_baja'),
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
    ('hermanos', 'tutor_id'),
    ('incidencias', 'descripcion'),
    ('incidencias', 'hermandad_id'),
    ('incidencias', 'hora'),
    ('incidencias', 'id'),
    ('incidencias', 'papeleta_id'),
    ('incidencias', 'registrado_por'),
    ('incidencias', 'resuelta'),
    ('incidencias', 'tipo'),
    ('mandatos_sepa', 'firmado_en'),
    ('mandatos_sepa', 'hermano_id'),
    ('mandatos_sepa', 'iban'),
    ('mandatos_sepa', 'id'),
    ('mandatos_sepa', 'referencia'),
    ('mandatos_sepa', 'revocado_en'),
    ('mandatos_sepa', 'texto_aceptado'),
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
    ('productos', 'activo'),
    ('productos', 'codigo'),
    ('productos', 'coste'),
    ('productos', 'descripcion'),
    ('productos', 'foto_url'),
    ('productos', 'id'),
    ('productos', 'iva'),
    ('productos', 'nombre'),
    ('productos', 'precio'),
    ('productos', 'stock_minimo'),
    ('productos', 'visible_en_web'),
    ('proyectos', 'descripcion'),
    ('proyectos', 'estado'),
    ('proyectos', 'fecha_objetivo'),
    ('proyectos', 'id'),
    ('proyectos', 'nombre'),
    ('proyectos', 'presupuesto_cent'),
    ('proyectos', 'recaudacion_id'),
    ('proyectos', 'responsable_id'),
    ('proyectos', 'responsable_nombre'),
    ('reglas_reparto', 'activo'),
    ('reglas_reparto', 'categoria_base'),
    ('reglas_reparto', 'categoria_destino'),
    ('reglas_reparto', 'id'),
    ('reglas_reparto', 'nombre'),
    ('reglas_reparto', 'nota'),
    ('reglas_reparto', 'porcentaje_cent'),
    ('reglas_reparto', 'tipo'),
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
    ('solicitudes_papeleta', 'anio'),
    ('solicitudes_papeleta', 'comentario'),
    ('solicitudes_papeleta', 'estado'),
    ('solicitudes_papeleta', 'fecha'),
    ('solicitudes_papeleta', 'hermano_id'),
    ('solicitudes_papeleta', 'hermano_nombre'),
    ('solicitudes_papeleta', 'hermano_numero'),
    ('solicitudes_papeleta', 'id'),
    ('solicitudes_papeleta', 'modalidad'),
    ('solicitudes_papeleta', 'preferencia'),
    ('solicitudes_papeleta', 'tramo_solicitado'),
    ('tareas_proyecto', 'fecha_limite'),
    ('tareas_proyecto', 'hecha'),
    ('tareas_proyecto', 'hermano_id'),
    ('tareas_proyecto', 'hermano_nombre'),
    ('tareas_proyecto', 'id'),
    ('tareas_proyecto', 'proyecto_id'),
    ('tareas_proyecto', 'titulo'),
    ('tareas_redes', 'encargo_id'),
    ('tareas_redes', 'estado'),
    ('tareas_redes', 'hermano_id'),
    ('tareas_redes', 'id'),
    ('tareas_redes', 'notas'),
    ('tareas_redes', 'que'),
    ('tareas_redes', 'red'),
    ('tareas_redes', 'texto'),
    ('tareas_redes', 'titulo'),
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
), funciones_esperadas (nombre) as (
  values
    ('activar_suscripcion_propia'),
    ('anular_venta'),
    ('avisar_reserva_lista'),
    ('avisos_que_esperan'),
    ('baja_de_la_web'),
    ('cancelar_suscripcion_propia'),
    ('catalogo_web'),
    ('confirmar_suscripcion'),
    ('contar_visita'),
    ('crear_hermandad'),
    ('crear_reserva_web'),
    ('dar_de_baja_hermano'),
    ('datos_tienda'),
    ('emitir_certificado'),
    ('entregar_reserva'),
    ('es_titular'),
    ('hermandad_actual'),
    ('hermandad_de_la_tienda'),
    ('hermandad_de_la_web'),
    ('hermandades_publicas'),
    ('mi_hermandad_id'),
    ('mi_suscripcion'),
    ('mi_tutor'),
    ('mis_novedades'),
    ('modulo_permitido'),
    ('mover_stock'),
    ('registrar_venta'),
    ('resolver_email_hermano'),
    ('soltar_reserva'),
    ('soporte_donde_estoy'),
    ('soporte_salir'),
    ('suscribirse_a_la_web'),
    ('vaciar_hermandad_para_restaurar'),
    ('version_del_esquema')
), cubos_esperados (nombre) as (
  values
    ('copias'),
    ('documentos'),
    ('imagenes')
), tablas_usadas (nombre) as (
  values
    ('avisos_hermano'),
    ('catalogos'),
    ('certificados'),
    ('conceptos_cuota'),
    ('cuentas_sociales'),
    ('errores_cliente'),
    ('lineas_reserva'),
    ('lineas_venta'),
    ('movimientos_stock'),
    ('opciones_papeleta'),
    ('permisos_cargo'),
    ('registro_actividad'),
    ('reservas_tienda'),
    ('ventas'),
    ('web_publica')
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

  union all

  -- Las funciones que la aplicación llama y aquí no están. Se mira el catálogo
  -- por NOMBRE y no con `to_regprocedure`, porque varias están sobrecargadas
  -- (la misma con y sin argumentos) y ahí hay que acertar la firma entera.
  select
    'FALTA UNA FUNCIÓN' as "Qué pasa",
    f.nombre            as "Tabla",
    'la aplicación la llama y no está' as "Columna"
  from funciones_esperadas f
  where not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = f.nombre)

  union all

  -- Los cubos de archivos. El de `copias` es el que más duele: sin él la copia
  -- semanal falla y no lo dice nadie.
  select
    'FALTA UN CUBO DE ARCHIVOS' as "Qué pasa",
    c.nombre                    as "Tabla",
    'sin él no se pueden guardar archivos' as "Columna"
  from cubos_esperados c
  where not exists (select 1 from storage.buckets b where b.id = c.nombre)

  union all

  /*
   * TABLAS SIN SEGURIDAD POR FILAS.
   *
   * Esta es la única línea de todo el diagnóstico que no habla de algo roto,
   * sino de algo ABIERTO. Sin RLS, esa tabla la lee y la escribe cualquier
   * cuenta de cualquier hermandad: no es que falle, es que funciona de más, y
   * eso no se nota nunca hasta que se nota del todo.
   *
   * Se miran solo las tablas que la aplicación usa —las que salen en la lista
   * de columnas de arriba—, no todo lo que haya en `public`: una tabla auxiliar
   * de alguien no es asunto de este diagnóstico.
   */
  select
    'TABLA SIN SEGURIDAD POR FILAS' as "Qué pasa",
    t.tabla                         as "Tabla",
    'la puede ver otra hermandad'   as "Columna"
  from (
    select tabla from esperado
    union select nombre from tablas_usadas
  ) t
  join pg_class c on c.relname = t.tabla
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where not c.relrowsecurity

  union all

  -- Y las tablas de las que no se pueden comprobar columnas —porque la
  -- aplicación no las escribe con un `toRow`— pero que sin ellas hay trozos
  -- enteros que no funcionan: la tienda, los catálogos, la web pública.
  select
    'FALTA LA TABLA ENTERA' as "Qué pasa",
    u.nombre                as "Tabla",
    'la aplicación la usa'  as "Columna"
  from tablas_usadas u
  where u.nombre not in (select table_name from tablas_que_hay)

  union all

  /*
   * Y POR QUÉ VERSIÓN VA ESTA BASE.
   *
   * El `case` no es adorno: si `esquema_gobergo` no existe —una base que no ha
   * pasado nunca por `ACTUALIZAR.sql`, que es justo cuando más falta hace este
   * diagnóstico— nombrarla dentro de un `select` normal revienta la consulta
   * ENTERA al planificarla, y no saldría ni lo de arriba. `query_to_xml` se
   * resuelve al ejecutar, así que el `case` puede saltársela.
   */
  select
    case
      when to_regclass('public.esquema_gobergo') is null
        then 'TU BASE NO SE HA ACTUALIZADO NUNCA'
      when coalesce((xpath('/row/valor/text()', query_to_xml(
             'select valor from esquema_gobergo where clave = ''version''',
             false, true, '')))[1]::text::int, 0) < 65
        then 'TU BASE VA POR DETRÁS'
      else 'al día'
    end as "Qué pasa",
    'versión del esquema' as "Tabla",
    case
      when to_regclass('public.esquema_gobergo') is null
        then 'debería ir por la 65: pega ACTUALIZAR.sql'
      else 'va por la ' || coalesce((xpath('/row/valor/text()', query_to_xml(
             'select valor from esquema_gobergo where clave = ''version''',
             false, true, '')))[1]::text, '?') || ' y debería ir por la 65'
    end as "Columna"
) todo
-- Lo que está al día se calla: si sale una sola fila, es que hay algo que ver.
where "Qué pasa" <> 'al día'
order by "Qué pasa", "Tabla", "Columna";
