# Auditoría de agosto de 2026 — los 67 fallos confirmados

Esto NO es una lista de sospechas. Se auditaron las 70 funciones de la
aplicación una por una y después **cada hallazgo se verificó por separado**
contra el código, con el encargo de tumbarlo. Tres se cayeron en esa segunda
vuelta y no están aquí. Los 67 que quedan están confirmados leyendo el código,
con el camino exacto por el que falla cada uno.

Se escribe entero, sin suavizar. Una lista de fallos que se lee bien no sirve
para nada.

| Gravedad | Cuántos |
|---|---|
| CRÍTICO | 4 |
| ALTO | 54 |
| MEDIO | 7 |
| BAJO | 2 |

## Cómo leer esto

**Casi todos son el mismo fallo repetido.** No son 67 problemas distintos: son
unas pocas costumbres equivocadas que aparecen en muchos sitios. La más común,
con diferencia:

> Una pantalla lee sus datos de la copia del navegador (`getX()`, `leerDatos`)
> en vez de la tabla de Supabase. Cuando el navegador está limpio —otro
> ordenador, otra cuenta, un cambio de hermandad— se cae en los datos de
> EJEMPLO y la pantalla trabaja con la hermandad de mentira, sin decirlo.

Eso solo explica trece de los hallazgos, incluidos dos de los cuatro críticos.

---

## CRÍTICO (4)

### Con la base de datos conectada, «Restaurar copia» dice que restaura y no restaura nada

**Dónde:** `src/lib/backup.ts:143` · *Configuracion, copias, archivo y RGPD*

**Cómo falla:** 1) Hermandad con Supabase configurado (isSupabaseConfigured = true). 2) Configuración → Copias y datos → «Restaurar copia» y se elige el JSON. 3) Sale el confirm («sustituirá TODOS los datos actuales»), se acepta, aparece «Copia restaurada. Recargando…» y la página se recarga. 4) Tras la recarga los datos son EXACTAMENTE los de antes: restaurarCopia() solo escribe en localStorage (líneas 149-162) y no manda nada a Supabase; al recargar, useSupabaseTable (src/lib/supabaseSync.ts:73-84) lee de Supabase y sobreescribe el espejo local con espejarEnLocal(). Peor aún: la copia incluye la clave 'cabildo-hermandad-espejada' (EXCLUIR solo excluye 'cabildo-demo-user', línea 16), así que si la copia se hizo en otro equipo/hermandad, al siguiente inicio de sesión ajustarEspejoALaHermandad (src/lib/multiHermandad.ts:187) ve que el espejo no coincide y borra todas las claves cabildo-. Y si la copia venía de un navegador en modo demostración, restaura también 'cabildo-demo-modo', con lo que la aplicación deja de hablar con Supabase sin avisar.

**Por qué importa:** Es la red de seguridad de la hermandad. Si alguien borra el censo o las cuotas por error y tiran de la copia de seguridad, verán el mensaje «Copia restaurada», se quedarán tranquilos y no habrán recuperado ni un hermano. El daño se descubre tarde, cuando ya no hay a quién reclamar.

**Arreglo:** Que restaurarCopia() sepa en qué modo está: con Supabase conectado, volcar cada colección del JSON a su tabla (borrado + insert por tabla, dentro de la hermandad actual) en vez de a localStorage, y solo entonces recargar. Mientras eso no exista, ocultar o deshabilitar el botón «Restaurar copia» cuando isSupabaseConfigured sea true, con un texto que lo explique. En cualquier caso, añadir 'cabildo-hermandad-espejada' y 'cabildo-demo-modo' a EXCLUIR para que ni se exporten ni se restauren.

---

### El área del hermano usa los tramos de ejemplo, no los de su hermandad: pantalla en blanco al ir a renovar y «Sin sitio» aunque tenga sitio

**Dónde:** `src/pages/HermanoPortal.tsx:197` · *El area del hermano*

**Cómo falla:** `const tramos = useMemo(() => getTramos(), [])` lee SOLO localStorage (src/lib/tramos.ts:78) y, si no hay nada, devuelve `TRAMOS_POR_DEFECTO` con ids 't1'…'t8'. `useTramos()`, que sí consulta Supabase, únicamente se usa en Configuración (el panel). En el móvil del hermano nunca se ha abierto Configuración, así que en su navegador no hay ningún `cabildo-tramos`. Pasos: 1) La hermandad configura sus tramos reales (ids uuid) y le asigna a Manuel el «Virgen — Cirio 2º tramo» del año pasado. 2) Manuel entra desde su móvil en el área del hermano. 3) Como su papeleta de este año aún no existe, `renovacionDeHermano` devuelve estado «Por renovar». 4) Se renderiza la línea 1430: `etiquetaTramo(tramos.find((t) => t.id === renovacion.sitioAnterior!.tramoId)!)`. El `find` devuelve `undefined` porque el uuid de su tramo no está entre 't1'…'t8', y `etiquetaTramo` hace `tramo.cuerpo` → TypeError y toda el área se queda en blanco. 5) Si en cambio ya tiene papeleta asignada, no se cae, pero `repartoCompleto` no encuentra su tramo y `asignacion` queda `undefined`: la tarjeta dice «Sin sitio», no sale «Mi sitio en el cortejo» y la papeleta que imprime va sin tramo ni puesto. 6) El desplegable «Cuerpo o tramo preferido» le ofrece «Cristo / Virgen / Único» de ejemplo, que pueden no ser los de su hermandad.

**Por qué importa:** Es la pantalla que la hermandad manda a todos sus hermanos por correo. En plena campaña de renovación, cada hermano que tenía sitio el año pasado abre el enlace y ve una página en blanco: la secretaría recibe cien llamadas y acaba haciendo las renovaciones a mano. Y a quien no se le cae, se le dice que no tiene sitio cuando sí lo tiene, o imprime una papeleta sin tramo con la que se presenta el día de la salida.

**Arreglo:** Sustituir `getTramos()` por `useTramos()` en HermanoPortal (y usar `precioBase` de la misma fuente), de forma que el área traiga los tramos reales de Supabase — la política `tramos_hermano_select` ya se lo permite. Además, blindar la línea 1430: guardar el tramo en una variable y no renderizar ese bloque (o enseñar el nombre guardado en la papeleta) cuando el `find` no encuentre nada, en vez de usar `!`.

---

### Al importar un CSV para actualizar, a todos los hermanos que ya estaban se les borra la antigüedad (pasa a ser el año en curso) y el estado se cambia a «Nuevo»

**Dónde:** `src/lib/importar.ts:354` · *El censo de hermanos*

**Cómo falla:** 1) La hermandad tiene su censo en Gobergo (Ana Sánchez, nº 89, antigüedad 1991, Activo). 2) Secretaría exporta de otro sitio una hoja sencilla con solo dos columnas, «Nombre;DNI», para actualizar correos o repasar nombres. 3) Hermanos → Exportar → «Traer vuestro censo (CSV)», sube la hoja, deja la opción «Actualizar sus datos con los del archivo» (que viene por defecto) y confirma. 4) Comprobado ejecutando ensayar()+aplicar(): Ana queda con antiguedad 2026 y estado «Nuevo». El motivo: en `ensayar` la línea 354 pone `antiguedad = anioEnCurso` cuando el archivo no trae esa columna, y la 359 deduce entonces estado «Nuevo»; luego `aplicar` (línea 467) escribe todo lo que no sea cadena vacía, así que esos valores inventados pisan los reales. No hay ningún mensaje: el resumen solo dice «X actualizados».

**Por qué importa:** La antigüedad es el año de entrada y es el dato más sagrado del censo después del número: de él dependen el escalafón, la reactivación por antigüedad, la ficha («Hermano/a desde 1991») y los reconocimientos por años de hermandad. Una importación rutinaria convierte a mil hermanos de toda la vida en altas de este año, y no hay forma de recuperar el dato salvo restaurando una copia. Además el contador «Altas nuevas · este ejercicio» del censo se dispara a todo el censo.

**Arreglo:** Que `ensayar` no rellene con valores inventados los campos que el archivo no trae: dejar `antiguedad` y `estado` fuera de `datos` cuando la columna no está emparejada (o marcarlos como «solo para altas»), y en `aplicar`, en la rama de actualización, escribir únicamente los campos cuya columna existe de verdad en el emparejado.

---

### Ningún visitante de fuera puede ver la web: siempre sale «Esta web no está disponible»

**Dónde:** `src/pages/SitioPublico.tsx:93` · *La web publica*

**Cómo falla:** 1) La hermandad monta su web, la pone en «Publicada» y copia el enlace https://…/w/su-slug. 2) En su navegador la ve perfecta (tiene sesión y su suscripción guardada). 3) Cualquier otra persona abre ese mismo enlace (ventana de incógnito, el móvil de un hermano, WhatsApp): la página muestra «Esta web no está disponible. La hermandad no tiene contratada la web pública en su suscripción». Motivo: la línea 93 hace `tieneCapacidad(getSuscripcion(), 'web')` y `getSuscripcion()` lee la clave `cabildo-suscripcion` de localStorage (src/lib/suscripcion.ts:119). Un visitante nunca tiene esa clave, así que devuelve SUSCRIPCION_INICIAL (activa: false) y la comprobación de la línea 95 corta la página antes incluso de esperar a los datos. No hay ninguna tabla ni consulta que traiga la suscripción de la hermandad: solo vive en el navegador de quien la contrató.

**Por qué importa:** Es el fallo que anula el módulo entero: la web pública no la puede ver nadie más que quien la edita. La hermandad paga el pack Web, comparte el enlace en su grupo de WhatsApp y todo el mundo recibe un mensaje diciendo que no han pagado. Además es invisible desde dentro, porque el que revisa siempre la ve bien.

**Arreglo:** La capacidad de la hermandad tiene que venir del servidor, no del navegador del visitante: guardar el pack contratado en la fila de la hermandad (o directamente en `web_publica`) y devolverlo junto con la web en `cargarWebPorSlug` / `cargarWebPorDominio`. Mientras eso no exista, el filtro debe aplicarse solo cuando hay sesión abierta (o sustituirse por el flag `publicada`, que sí llega de la base de datos), nunca a un visitante anónimo.

---

## ALTO (54)

### «Descargar copia» genera un archivo incompleto: solo lleva los módulos que se hayan abierto desde que se entró

**Dónde:** `src/lib/backup.ts:77` · *Configuracion, copias, archivo y RGPD*

**Cómo falla:** 1) Con Supabase conectado, iniciar sesión (AuthContext llama a ajustarEspejoALaHermandad, que deja localStorage limpio; al cerrar sesión lo borra entero, src/lib/multiHermandad.ts:187-202). 2) Ir directamente a Configuración → Copias y datos → «Descargar copia». 3) El JSON descargado se genera con leerDatosLocales() (línea 42), que solo lee localStorage; como no se ha abierto Hermanos, Cuotas, Papeletas ni Tesorería, esas claves no existen todavía y el archivo sale prácticamente vacío (bloques: 1 ó 2). Sin ningún aviso: el mensaje es «Copia descargada.» y el texto de la pantalla promete «un solo archivo, con hermanos, cuotas, papeletas, tesorería, documentos y sus adjuntos».

**Por qué importa:** La hermandad guarda ese archivo creyendo que tiene a salvo todo el censo y toda la contabilidad. El día que lo necesite descubrirá que dentro no hay hermanos, ni cuotas, ni papeletas. Y como el tamaño del JSON depende de por dónde haya navegado quien lo descargó, dos copias del mismo día pueden traer cosas distintas.

**Arreglo:** Con Supabase conectado, crearCopia() debe leer las tablas de la base de datos (un select por colección) en lugar de localStorage. Además, mostrar en el propio botón/resumen cuántos hermanos, cuotas y papeletas lleva la copia antes de descargarla, para que un archivo vacío se vea a simple vista.

---

### La copia de seguridad se lleva como mucho 100 adjuntos: el resto se pierde sin decir nada

**Dónde:** `src/lib/filestore.ts:125` · *Configuracion, copias, archivo y RGPD*

**Cómo falla:** 1) Archivo documental con 130 documentos con PDF adjunto (actas, contratos, expedientes) y Supabase conectado. 2) Configuración → «Descargar copia». 3) todosLosArchivos() hace storage.from('documentos').list(dir) sin opciones, y supabase-js aplica por defecto limit: 100 y orden alfabético por nombre: solo se leen y se meten en el JSON los 100 primeros. El resumen que se enseña al restaurar dirá «100 archivos adjuntos» como si fueran todos. 4) Si esa copia se restaura, borrarTodosLosArchivos() (línea 157) tiene el mismo tope de 100: borra 100 de los 130 y vuelve a subir 100, quedando una mezcla de adjuntos viejos y nuevos.

**Por qué importa:** Los adjuntos del Archivo son las actas de cabildo, los contratos y los expedientes: papel que la hermandad tiene obligación de conservar. Una hermandad con algo de recorrido pasa de 100 documentos enseguida, y perderá los que alfabéticamente vayan después sin que nada lo indique.

**Arreglo:** Paginar el list(): bucle con { limit: 1000, offset } hasta que devuelva menos de 1000, tanto en todosLosArchivos() como en borrarTodosLosArchivos(). Y comparar el número de adjuntos leídos con el de documentos que dicen tener archivo, avisando si no cuadra.

---

### Los documentos «Restringidos» del Archivo no están restringidos: basta cambiar el desplegable de la pantalla

**Dónde:** `src/pages/app/Archivo.tsx:81` · *Configuracion, copias, archivo y RGPD*

**Cómo falla:** 1) El Hermano Mayor sube un expediente disciplinario y marca «Restringido a cargos concretos» → solo «Hermano Mayor». La ficha lo enseña con el candado «Restringido» y el contador «Restringidos — Contienen datos sensibles». 2) Entra cualquier otra persona del personal cuyo cargo tenga permitido el módulo «archivo» (de fábrica: Secretario/a y Fiscal). 3) En el banner de arriba cambia «Ver el archivo como» a «Hermano Mayor» —que además es el valor por defecto del componente, useState<Cargo>('Hermano Mayor')— y el documento aparece en la lista. 4) Abre la ficha y pulsa «Ver / descargar»: leerArchivo() baja el PDF, porque la política de Storage (supabase/multi-hermandad.sql:358) solo comprueba la carpeta de la hermandad, y la política de select de la tabla documentos (supabase/rls-cargos.sql) deja leerla a todo el personal. El cargo real de quien ha entrado (user.user_metadata.cargo, que AuthContext.tsx:276 ya rellena) no se consulta en ningún momento.

**Por qué importa:** En el Archivo acaban los expedientes disciplinarios, los informes de secretaría y los contratos con importes. La hermandad marca un documento como reservado a la Junta de Gobierno y cree que ha quedado reservado; en realidad lo ve y se lo descarga cualquiera con acceso al módulo, y no queda rastro de quién lo abrió.

**Arreglo:** Fijar viewAsCargo al cargo real de la sesión (user.user_metadata.cargo) y dejar el desplegable como simulador solo para el titular/Hermano Mayor. Y sobre todo llevar la regla a la base de datos: guardar cargos_con_acceso en la tabla documentos y añadir una política de select que lo compruebe contra el cargo del personal, además de mover los adjuntos restringidos a una subcarpeta con su propia política.

---

### El borrado RGPD deja atrás la solicitud de alta con el DNI y la contraseña en claro del hermano

**Dónde:** `src/lib/rgpd.ts:279` · *Configuracion, copias, archivo y RGPD*

**Cómo falla:** 1) Un hermano pide el alta desde la web pública: se crea una fila en solicitudes_alta con nombre, dni, email, telefono y clave_propuesta (contraseña en claro, supabase/TODO-EN-UNO.sql:357-366). 2) Secretaría la aprueba: Hermanos.tsx:247 solo cambia el estado a 'Aprobada', la fila se queda. 3) Años después el hermano ejerce el derecho de supresión y en Hermanos se pulsa «Borrar datos (RGPD)», que avisa de que se borrará «y todos sus datos». 4) borrarDatosHermano() borra la fila de hermanos (cuotas, papeletas e incidencias caen por cascada) y nada más: la solicitud de alta sigue en la base de datos con su DNI, su correo, su teléfono y su contraseña; en modo local siguen también sus avisos ('cabildo-avisos-hermano') y sus solicitudes de papeleta ('cabildo-solicitudes-papeleta'). La cuenta de Supabase Auth del hermano tampoco se borra (hermanos.auth_user_id es on delete set null), así que su correo queda en auth.users.

**Por qué importa:** Es exactamente lo que el RGPD obliga a borrar, y la aplicación asegura por escrito que lo ha borrado. Si ese hermano reclama ante la AEPD y se comprueba que su DNI y su contraseña siguen guardados, la sancionada es la hermandad. Y el mismo hueco hace que la exportación del derecho de acceso salga incompleta.

**Arreglo:** En borrarDatosHermano(): borrar también las filas de solicitudes_alta que coincidan por DNI o email (y por hermano_id si se añade la columna), los avisos y las solicitudes de papeleta de ese hermano, y desactivar/borrar su cuenta de Auth mediante una función RPC security definer. Incluir esas mismas fuentes en recopilarDatosHermano() para que el export sea completo. Y de paso, dejar de guardar clave_propuesta en claro.

---

### Un comunicado a más de 50 hermanos no le llega a nadie, y ademas queda marcado como «Enviado» sin poder reintentarlo

**Dónde:** `supabase/functions/enviar-correo/index.ts:148` · *Correo y avisos*

**Cómo falla:** Hermandad con 612 hermanos y el correo conectado y activo. Comunicados → abrir un comunicado en Borrador con destinatarios «Todos los hermanos» → «Enviar ahora». `enviarAhora` (Comunicados.tsx:213) junta las 612 direcciones en UNA sola llamada; la función del servidor corta en `para.length > MAXIMO_DESTINATARIOS` (50) y devuelve 400 «Como mucho 50 direcciones por envío». Pero antes de llamar al correo, la línea 199-201 ya ha guardado el comunicado con estado 'Enviado' y fecha de envío, y el botón «Enviar ahora» solo se pinta si `selected.estado !== 'Enviado'` (línea 551): al volver a abrir la ficha el botón ya no está. Resultado: cero correos enviados, comunicado en verde como «Enviado», y ninguna forma de reintentar salvo crear otro comunicado nuevo. Lo mismo pasa con cualquier otro fallo del proveedor (dominio sin verificar, red caída), que es justo lo que ocurre en el primer envío de verdad.

**Por qué importa:** Es el uso principal del módulo: la convocatoria de cabildo, el aviso de cultos o el recordatorio de cuotas a todo el censo. Ninguna hermandad de tamaño real (más de 50 hermanos) puede mandar un comunicado por correo, y la aplicación le dice que sí lo ha mandado. La junta se entera el día del cabildo, cuando no aparece nadie.

**Arreglo:** Trocear en `enviarCorreo` (o en `enviarAhora`) en tandas de 50 y sumar los enviados de cada tanda, informando de cuántas salieron y cuáles no. Y no marcar 'Enviado' hasta saber el resultado: dejar el estado anterior (o un 'Enviado a medias') si el correo falla, y permitir reintentar el envío de un comunicado ya enviado en vez de esconder el botón.

---

### Los comunicados por segmento (todos menos «Todos los hermanos») no avisan a nadie, ni al buzón ni por correo, y encima guardan un alcance falso

**Dónde:** `src/pages/app/Comunicados.tsx:104` · *Correo y avisos*

**Cómo falla:** Nuevo comunicado → marcar «Segmentación avanzada» → criterios «Activos · con cuota pendiente»; el editor muestra debajo «84 hermanos» (`cuantos={segmentoHermanos.length}`) → estado «Enviar ahora» → Guardar. El destinatario se guarda como el texto que devuelve `etiquetaSegmento`, p. ej. «Activos · con cuota pendiente» (handleCreate:244). Luego `hermanosAAvisar` solo sabe resolver dos formas: cadenas que empiezan por «Etiqueta: » y cadenas que contienen «todos» (líneas 102-105). Ese texto no cumple ninguna de las dos, así que devuelve lista vacía: `agregarAvisoAVarios([])` no hace nada y `enviarCorreo` no se llega a llamar. Aun así, la línea 260-261 guarda `alcance = 84`. Pasa igual con 3 de los 5 segmentos de fábrica del desplegable («Hermanos con cuota al día», «Hermanos con cuota pendiente», «Nazarenos con papeleta de sitio», «Junta de Gobierno»): estado «Enviado», ficha diciendo «Alcance: 84 personas», y ni un aviso en el buzón de nadie ni un correo. Sin ningún mensaje de error, porque `envioCorreo` ni se toca.

**Por qué importa:** La segmentación es lo que se usa para lo delicado: avisar solo a los morosos, solo a los costaleros, solo a la junta. La hermandad cree que ha avisado a 84 hermanos con cuota pendiente y no se ha enterado ninguno; el módulo además guarda ese 84 como alcance, así que el histórico de comunicados miente para siempre.

**Arreglo:** Guardar en el comunicado los criterios del segmento (o la lista de ids de destinatarios) además de la etiqueta legible, y que `hermanosAAvisar` resuelva con `filtrarSegmento` en vez de adivinar por el texto. Mientras eso no exista, no dejar guardar como 'Enviado' un comunicado cuyo segmento no se sabe resolver, y no escribir un alcance que no corresponde a nadie avisado.

---

### Crear un comunicado eligiendo «Enviar ahora» en el formulario no manda ningún correo, solo llena el buzón

**Dónde:** `src/pages/app/Comunicados.tsx:279` · *Correo y avisos*

**Cómo falla:** Configuración → Correo activo y «Comunicados» encendido. Comunicados → + Nuevo comunicado → título y mensaje → canal Email → destinatarios «Todos los hermanos» → en Estado elegir «Enviar ahora» → Guardar. `handleCreate` solo llama a `agregarAvisoAVarios` (línea 280); nunca llama a `enviarCorreo`. El comunicado queda en la tabla como «Enviado», con su fecha, y no sale un solo correo. Si en cambio se guarda como Borrador y luego se pulsa el botón «Enviar ahora» de la ficha, sí sale. Las dos opciones se llaman igual en pantalla («Enviar ahora», línea 692) y hacen cosas distintas.

**Por qué importa:** Es el camino más natural: escribo el comunicado y elijo enviar. La hermandad da por hecho que el correo ha salido —lo dice el estado y lo dice la etiqueta del propio desplegable— y en realidad el aviso solo está en el buzón del área, que casi nadie abre. Se descubre cuando alguien pregunta por qué no le llegó nada.

**Arreglo:** Que `handleCreate`, cuando el estado sea 'Enviado', llame a la misma rutina que el botón de la ficha (`enviarAhora`) en lugar de duplicar media lógica, y que muestre el mismo aviso de resultado o error del correo.

---

### Lo que el hermano apaga en su área no lo ve quien manda el correo: se le escribe igual

**Dónde:** `src/lib/avisosHermano.ts:45` · *Correo y avisos*

**Cómo falla:** Un hermano entra en su área desde su móvil y apaga «Mis cuotas» en las preferencias de avisos. `savePreferenciasAvisos` lo guarda en `localStorage` del móvil del hermano, con la clave 'cabildo-avisos-preferencias' (líneas 49-52); no se manda a Supabase en ningún sitio (no existe tabla ni columna para esto). Después, la tesorera marca su recibo como pagado desde el ordenador de la casa hermandad: `avisarPorCorreo` → `destinatariosDe` → `quiereAviso(getPreferenciasAvisos(h.id), 'cuota')` (avisosCorreo.ts:67) lee el localStorage DEL ORDENADOR DE LA TESORERA, donde ese hermano no tiene ninguna preferencia guardada, y `quiereAviso` devuelve true por defecto (avisosHermano.ts:56). El correo sale. Además, al cerrar sesión, `ajustarEspejoALaHermandad(null)` (AuthContext.tsx:153) borra todas las claves 'cabildo-*' que no estén en la lista de conservadas, y 'cabildo-avisos-preferencias' no está: al hermano se le borran sus propias preferencias en su propio móvil.

**Por qué importa:** El código, los comentarios y la propia pantalla de Configuración prometen que «lo que cada hermano haya apagado en su área se respeta siempre». No se respeta nunca: la baja voluntaria de avisos no funciona en ningún caso real. En comunicaciones a hermanos eso es exactamente lo que reclaman los que no quieren correos, y con datos de pertenencia religiosa es un incumplimiento de consentimiento con consecuencias serias.

**Arreglo:** Guardar las preferencias de avisos en la base de datos junto a la ficha del hermano (columna en `hermanos` o tabla propia con su `hermandad_id` y RLS), leerlas de ahí en `destinatariosDe`, y añadir la clave a la lista de las que no se borran mientras no esté migrada.

---

### La configuración de correo vive solo en el navegador de quien la activó: desde otro ordenador no sale ningún aviso y nadie se entera

**Dónde:** `src/lib/correo.ts:43` · *Correo y avisos*

**Cómo falla:** El secretario activa Configuración → Correo en su portátil: `saveAjustesCorreo` solo hace `localStorage.setItem('cabildo-correo', …)` (línea 43); no hay ninguna escritura a Supabase. Al día siguiente la tesorera, desde el ordenador de la casa hermandad, marca cuotas como pagadas: `avisarPorCorreo` → `destinatariosDe` lee `getAjustesCorreo()`, que en ESE navegador devuelve `CORREO_INICIAL` con `activo:false`, y devuelve lista vacía → `avisarPorCorreo` retorna `{enviados:0}` sin error (avisosCorreo.ts:117). Ni correo ni mensaje. En su pantalla de Configuración además no aparece el distintivo «Activo», así que parece que el correo nunca se contrató. Lo mismo pasa con «A dónde contestan los hermanos»: si lo rellenó el secretario, los envíos hechos desde otro equipo van sin reply-to o con el que traiga la ficha de la hermandad.

**Por qué importa:** En una hermandad trabajan varias personas y varios equipos (secretaría, mayordomía, tesorería, el ordenador de la casa hermandad). Que el correo salga o no según quién esté sentado en qué máquina hace que los avisos se pierdan a medias, en silencio, y que nadie pueda diagnosticar por qué unos hermanos reciben y otros no.

**Arreglo:** Guardar `activo`, `responderA` y `avisaDe` en `hermandad_settings` (o tabla equivalente con `hermandad_id` y RLS), como ya se hace con el resto de la ficha de la hermandad, y usar el localStorage solo como caché de primer render. Y que `avisarPorCorreo` distinga «nadie quería recibirlo» de «el correo está apagado en esta máquina» para poder avisarlo.

---

### Los dos avisos que el propio código llama imprescindibles —la baja y el cambio de cuenta bancaria— no salen nunca con la configuración de fábrica

**Dónde:** `src/lib/correo.ts:34` · *Correo y avisos*

**Cómo falla:** Hermandad recién configurada: activa el correo y deja los interruptores como vienen (`CORREO_INICIAL.avisaDe.ficha: false`, línea 34). Secretaría → Hermanos → abrir un hermano → «Dar de baja». `darDeBaja` (Hermanos.tsx:598) llama a `avisarPorCorreo(..., 'ficha', 'Tu baja en la hermandad', ...)`; `destinatariosDe` corta en `if (!ajustes.avisaDe['ficha']) return []` (avisosCorreo.ts:65) y no sale nada. El aviso queda solo en el buzón de un área a la que ese hermano ya no puede entrar, justo lo contrario de lo que dice el comentario de esa función («es el único caso en el que el correo no es un extra, es la única forma de enterarse»). Idéntico con el cambio de IBAN (Hermanos.tsx:542), cuyo comentario dice «conviene que salga por correo: un cambio de cuenta que el hermano no ha pedido es lo primero que hay que poder detectar».

**Por qué importa:** Son los dos avisos de seguridad del sistema: si alguien cambia la cuenta bancaria de un hermano o le tramita una baja que no ha pedido, el hermano no se entera por ningún canal. Y la hermandad tampoco sabe que no ha salido, porque nadie devuelve error. El interruptor de Configuración se llama «Cambios en sus datos» y se entiende como avisos menores, no como esto.

**Arreglo:** Sacar la baja y el cambio de IBAN del interruptor 'ficha' —tratarlos como avisos que salen siempre que el correo esté activo, o darles su propio tipo de aviso— y que la pantalla de Configuración diga que ese tipo no se puede apagar.

---

### La convocatoria de papeletas no avisa a nadie (ni buzón ni correo) y su registro en Comunicados desaparece al recargar

**Dónde:** `src/lib/convocatoria.ts:69` · *Correo y avisos*

**Cómo falla:** Con Supabase conectado: Papeletas → «Convocar papeletas». `enviarConvocatoria` crea el comunicado y lo escribe directamente con `localStorage.setItem(CLAVES_DATOS.comunicados, …)` (línea 69), sin pasar por `useSupabaseTable`, que es el único sitio donde se sincroniza con la base. Al abrir Comunicados, el hook carga la tabla desde Supabase y espeja el resultado sobre el localStorage (supabaseSync.ts:82-83): el comunicado de la convocatoria se pierde, pese a que el aviso dice «Queda registrada en Comunicados». Además, `leerPersistido(CLAVES_DATOS.comunicados, COMUNICADOS_INICIALES)` (línea 53) usa como recambio los comunicados de EJEMPLO, así que en una hermandad nueva el clic mete diez comunicados ficticios en el navegador y numera el nuevo a partir de ellos. Y a los hermanos no les llega nada: la función no toca `agregarAvisoAVarios` ni `avisarPorCorreo`, aunque el interruptor «Papeletas» esté encendido y el correo activo. La marca de «ya convocado» también es solo de ese navegador, así que otro miembro de la junta ve el botón como si no se hubiera convocado y puede volver a convocar.

**Por qué importa:** La apertura del plazo de papeletas es el aviso del año con más consecuencias: quien no se entera se queda sin sitio en la estación de penitencia. La secretaría ve «Convocatoria enviada a 612 hermanos», pero no hay ni correo, ni aviso en el área del hermano, ni registro que consultar después.

**Arreglo:** Que la convocatoria use el mismo circuito que el resto: crear el comunicado a través del hook que sincroniza con Supabase, dejar el aviso en el buzón con `agregarAvisoAVarios` y mandarlo con `avisarPorCorreo(..., 'papeleta', ...)`, respetando interruptor y preferencias. Guardar la marca de convocatoria en la base (campaña del año) y no en localStorage, y usar `leerDatos` en vez de `leerPersistido` para no arrastrar los comunicados de ejemplo.

---

### El hermano avisa de que ha pagado su cuota y ese aviso no llega nunca a tesorería

**Dónde:** `src/pages/HermanoPortal.tsx:799` · *El area del hermano*

**Cómo falla:** 1) El hermano entra en su área con DNI y contraseña (sesión real de Supabase). 2) Baja a «Mi vida en la hermandad» → «Mis cuotas», abre un recibo pendiente y pulsa «Pagar». 3) Pulsa «Ya he enviado el Bizum». 4) La pantalla cambia a «Pago avisado por Bizum» con la fecha. 5) `comunicarPagoCuota` llama a `setCuotas`, que en `useSupabaseTable` lanza `update` sobre la tabla `cuotas`. Pero en las políticas RLS (supabase/hermano-auth.sql:77-83 y TODO-EN-UNO.sql:1029-1035) el hermano SOLO tiene `cuotas_propio_select`: no existe ninguna política de UPDATE que se cumpla cuando `auth_es_hermano()` es cierto. Postgres no da error: simplemente actualiza 0 filas y supabase-js devuelve `error: null`, así que `sincronizar()` no detecta ningún fallo y no salta el aviso de «no se pudo sincronizar». 6) El hermano cierra y vuelve a entrar: al recargar de Supabase, el recibo aparece otra vez sin ningún aviso de pago. En el panel de Cuotas nunca apareció nada.

**Por qué importa:** La hermandad le ha dicho al hermano «avisa desde tu área y no hace falta que llames», y el aviso se pierde en silencio. El hermano ha hecho el Bizum de verdad, cree que está avisado, y a los dos meses le llega el recibo como impagado o entra en mora. Tesorería recibe ingresos sueltos en la cuenta que no puede casar con nadie. Es exactamente el problema que esta función venía a resolver, y falla sin dejar rastro ni en pantalla ni en la consola.

**Arreglo:** Añadir en el SQL una política de UPDATE para el hermano sobre `cuotas`, limitada a su propia fila y a las dos columnas del aviso: `create policy "cuotas_propio_aviso_pago" on cuotas for update to authenticated using (auth_es_hermano() and hermano_id = hermano_propio_id()) with check (auth_es_hermano() and hermano_id = hermano_propio_id());` — y, para que no vuelva a pasar en silencio, comprobar en `sincronizar()` que el update ha devuelto filas (`.select()` tras el update) y disparar el evento `cabildo-sync-error` cuando vuelvan cero.

---

### Al renovar el sitio desde su área, el hermano genera papeletas con números ya usados por otros hermanos

**Dónde:** `src/pages/HermanoPortal.tsx:709` · *El area del hermano*

**Cómo falla:** `nextNumeroPapeleta()` hace `Math.max(0, ...papeletas.map(p => p.numero)) + 1`, pero con Supabase el array `papeletas` del área del hermano contiene ÚNICAMENTE sus propias papeletas (política `papeletas_propio_select`: `hermano_id = hermano_propio_id()`). Pasos: 1) La hermandad lleva emitidas las papeletas 1 a 350 de la campaña. 2) Manuel, que el año pasado tuvo la papeleta nº 137, entra en su área y pulsa «Renovar mi sitio». 3) `nextNumeroPapeleta()` calcula 137 + 1 = 138 y se inserta una papeleta nº 138. La tabla `papeletas` no tiene ningún índice único sobre `numero` (supabase/schema.sql:144-164), así que el insert entra sin protestar. 4) Ya hay dos papeletas con el nº 138. 5) Peor aún con un hermano nuevo sin papeletas previas: `Math.max(0, ...[])` es 0, así que su papeleta sale con el nº 1, que ya tiene otro.

**Por qué importa:** El número de papeleta es lo que identifica el cobro: el propio código pone en el concepto del Bizum «Papeleta 138 - Manuel García». Con dos papeletas 138, tesorería no sabe de quién es cada ingreso, el listado de cortejo sale con números repetidos y el arqueo de la papeleta no cuadra. Y cuanto más se usa la renovación online, más duplicados se acumulan.

**Arreglo:** No calcular el número en el cliente cuando hay Supabase: pedirlo al servidor (una secuencia por hermandad y año, o una función `siguiente_numero_papeleta()` con `security definer`) y añadir un índice único `(hermandad_id, anio, numero)` para que un duplicado dé error visible en vez de colarse.

---

### Renovar desde el área del hermano cobra el precio del año pasado, no el de esta campaña

**Dónde:** `src/pages/HermanoPortal.tsx:717` · *El area del hermano*

**Cómo falla:** `const importe = renovacion.sitioAnterior.importe || precioDeTramo(tramoAnterior, precioBase)`: se coge el importe de la papeleta del año ANTERIOR y solo se recurre al precio actual si aquel era 0. El panel hace justo lo contrario (src/pages/app/Papeletas.tsx:842 renueva con `precioDeTramo(tramoAnterior, precioBase)`, el precio vigente). Pasos: 1) El cabildo sube la papeleta de cirio de 22 € a 28 € y se cambia en Configuración. 2) Manuel, que pagó 22 € el año pasado, entra en su área y pulsa «Renovar mi sitio». 3) Se crea su papeleta en estado «Asignada» con importe 22 €. 4) La pantalla de pago le dice «Pagar mi papeleta · 22,00 €» y él hace el Bizum de 22 €. 5) Si en cambio hubiera pasado por secretaría, o si el diputado hubiera renovado por él desde el panel, se le habrían cobrado 28 €.

**Por qué importa:** Dos hermanos con el mismo sitio pagan cantidades distintas según por dónde hayan renovado, y la hermandad deja de ingresar la subida que aprobó el cabildo justo en los hermanos más fieles (los que renuevan). Cuando alguien lo detecte, habrá que reclamar la diferencia hermano por hermano. Además, al sumarse a lo anterior (los tramos de ejemplo), `precioDeTramo` tampoco tendría el precio real como red de seguridad.

**Arreglo:** Usar siempre el precio vigente al renovar, igual que el panel: `const importe = precioDeTramo(tramoAnterior, precioBase)`. Si se quiere respetar el precio anterior en algún caso concreto (p. ej. una tarifa congelada), que sea una decisión explícita de la hermandad en Configuración, no un efecto lateral de por dónde se renueva.

---

### El buzón del hermano solo existe en el navegador de secretaría: en su móvil siempre está vacío

**Dónde:** `src/lib/avisosHermano.ts:63` · *El area del hermano*

**Cómo falla:** `getAvisosHermano()` y `agregarAvisoHermano()` trabajan contra la clave de localStorage `cabildo-avisos-hermano`, y no hay ninguna tabla ni sincronización con Supabase (no aparece en ningún .sql ni en ninguna llamada a supabase). Pasos: 1) La secretaría, desde su ordenador, manda una convocatoria de cabildo por Comunicados (src/pages/app/Comunicados.tsx:206 llama a `agregarAvisoAVarios`). 2) El aviso se escribe en el localStorage DE ESE ordenador. 3) Manuel abre su área del hermano en su móvil. 4) `useAvisosHermano` lee el localStorage del móvil, que está vacío, y «Mi buzón» dice «No tienes ningún aviso. Aquí te llegará lo que te mande la hermandad». 5) Lo mismo con «Cuota pagada» (Cuotas.tsx:242) y «Tu papeleta de sitio» (Papeletas.tsx:369): ninguno le llega. 6) En el sentido contrario ocurre lo mismo con `savePreferenciasAvisos`: si Manuel apaga «Comunicados» en su móvil, esa preferencia se guarda en SU navegador, y `destinatariosDe` (src/lib/avisosCorreo.ts:67) la consulta con `getPreferenciasAvisos(h.id)` en el navegador de secretaría, donde no existe, así que se le sigue enviando.

**Por qué importa:** Toda la sección «Mi buzón» —y la promesa «avisos y comunicados de la hermandad» que aparece en la pantalla de acceso— no funciona en cuanto el hermano y la secretaría no comparten el mismo navegador, que es siempre. La hermandad da por avisados a hermanos que no han visto nada: convocatorias de cabildo, cambios de sitio, cuotas dadas por pagadas. Y el interruptor «qué quiero recibir» dice literalmente «es lo que la hermandad respetará cuando envíe correos» y no se respeta nunca: un hermano que se da de baja de los comunicados los sigue recibiendo, que es un problema de consentimiento, no solo de comodidad.

**Arreglo:** Llevar avisos y preferencias a dos tablas de Supabase (`avisos_hermano` y `preferencias_avisos`) con `hermandad_id`, RLS de lectura/escritura para el propio hermano y de escritura para el personal, y sustituir `getAvisosHermano`/`savePreferenciasAvisos` por lectura y escritura contra esas tablas, dejando localStorage solo como copia local. Mientras no exista, no enseñar el buzón como si funcionase.

---

### El hijo a cargo se pierde al aprobar el alta: «Mi familia» sale siempre vacía y la solicitud se queda pendiente para siempre

**Dónde:** `src/pages/HermanoPortal.tsx:893` · *El area del hermano*

**Cómo falla:** `aCargo` filtra `hermanos.filter(h => h.tutorId === hermanoPrincipal.id)`, pero `tutorId` no se guarda en ningún sitio: `hermanoToRow` (src/lib/db/hermanos.ts:4-31) no escribe `tutor_id`, `rowToHermano` no lo lee, y la tabla `hermanos` no tiene esa columna en ningún .sql. Pasos: 1) Manuel pide desde su área el alta de su hija menor (`solicitarAltaFamilia`, línea 908, que sí manda `tutorId` en la solicitud). 2) La secretaría la aprueba en Hermanos (src/pages/app/Hermanos.tsx:230 crea el hermano con `tutorId`). 3) Al guardarse en Supabase el `tutorId` se descarta silenciosamente. 4) Manuel vuelve a su área: «Mi familia» no lista a su hija, y no puede gestionarle la papeleta como se le prometió. 5) Y como `solicitudesFamilia` se calcula sobre `getSolicitudes()`, que lee localStorage y no se refresca desde Supabase salvo por el evento `storage` de otra pestaña del mismo navegador, en su móvil la solicitud sigue apareciendo como «alta pendiente» indefinidamente, aunque ya esté aprobada.

**Por qué importa:** El vínculo tutor-menor es la razón de ser de esta sección: un padre saca la papeleta de sus hijos, y es lo que evita que la familia entera tenga que pasar por secretaría. Tal como está, el padre pide el alta, la hermandad la aprueba, y él ve para siempre «pendiente» y ningún hijo: acaba llamando por teléfono, que es justo lo que se quería evitar. Y la hermandad pierde el dato de quién responde por cada menor.

**Arreglo:** Añadir `tutor_id uuid references hermanos(id) on delete set null` a la tabla `hermanos`, incluirlo en `hermanoToRow`/`rowToHermano`, y ampliar la RLS del hermano para que pueda ver (y solicitar papeleta de) las fichas cuyo `tutor_id` sea el suyo. Y refrescar `solicitudesAlta` desde Supabase al montar el área, no solo desde localStorage.

---

### Guardar «Mis datos de contacto» reescribe la ficha entera y borra lo que secretaría acaba de cambiar, incluso una baja

**Dónde:** `src/pages/HermanoPortal.tsx:590` · *El area del hermano*

**Cómo falla:** `guardarDatos` hace `setHermanos(prev => prev.map(...))` y `useSupabaseTable.sincronizar` manda `update(hermanoToRow(item))`, que escribe TODAS las columnas (numero, estado, cuota_al_dia, iban, clave_acceso, etiquetas, baja_solicitada…) con los valores que el navegador del hermano cargó al iniciar sesión. En su móvil esa copia no se refresca nunca (solo se refresca por el evento `storage` de otra pestaña del mismo navegador o al cambiar la sesión). Pasos: 1) Manuel entra en su área a las 10:00. 2) A las 10:05 la secretaría le corrige el IBAN, le pone la etiqueta «Diputado de tramo» y le marca la cuota al día. 3) A las 10:10 Manuel, sin recargar, cambia su teléfono y pulsa «Guardar mis datos». 4) El update reescribe su fila con la foto de las 10:00: vuelve el IBAN antiguo, desaparece la etiqueta y la cuota vuelve a figurar pendiente. No aparece ningún error. 5) Variante peor: si a las 10:05 la secretaría tramitó su baja (estado «Baja», numero 0), al guardar sus datos Manuel vuelve a quedar «Activo» con su número anterior.

**Por qué importa:** La secretaría corrige un dato, ve que se ha guardado, y horas después vuelve a estar mal sin que nadie haya hecho nada aparente: acaban desconfiando de la aplicación y volviendo al Excel. El caso de la baja es peor: deja alcanzable un estado que la propia aplicación prohíbe, un hermano dado de baja que se reactiva a sí mismo sin pasar por secretaría, con su número recuperado.

**Arreglo:** Que el área del hermano mande solo los campos que él puede tocar (un `update({ email, telefono, direccion }).eq('id', …)` propio, en vez de reutilizar `hermanoToRow` entero), y restringir en la RLS las columnas que un hermano puede actualizar. Como refuerzo, recargar su ficha desde Supabase antes de guardar y avisar si ha cambiado.

---

### Esa misma importación borra el IBAN de todos los hermanos que ya estaban, aunque la hoja no traiga columna de cuenta bancaria

**Dónde:** `src/lib/importar.ts:370` · *El censo de hermanos*

**Cómo falla:** Mismos pasos que el hallazgo anterior (subir un CSV «Nombre;DNI» con la opción «Actualizar sus datos»). Ejecutado de verdad: Ana entra con iban «ES47 2100 0813 6102 0012 3456» y sale con `iban: null`. La causa está en la línea 370, `iban: dato(fila, 'iban') || null`: si no hay columna de IBAN el valor es `null`, y el filtro de la línea 467 (`v !== '' && v !== undefined`) deja pasar `null` como si fuera un dato nuevo. Justo debajo del selector, la pantalla promete lo contrario: «Al actualizar solo se pisa lo que trae el archivo: si vuestra hoja no tiene columna de teléfono, el teléfono que ya tengan en Gobergo no se borra» (ImportarCenso.tsx, paso «ensayo»).

**Por qué importa:** Es dinero. Sin IBAN no se pueden domiciliar las cuotas: la siguiente remesa SEPA se queda sin la mitad del censo y la hermandad se entera cuando no entra el cobro del ejercicio. Recuperar mil cuentas bancarias significa volver a pedírselas una a una a los hermanos. Y ocurre en silencio, mientras la interfaz asegura que eso no puede pasar.

**Arreglo:** En `ensayar`, poner `iban` en `datos` solo si la columna está emparejada (nada de `|| null`); y en `aplicar`, tratar `null` igual que la cadena vacía a la hora de decidir si se pisa un valor existente.

---

### Importar deja estados imposibles: un hermano de baja que conserva su número y un hermano activo con el número 0

**Dónde:** `src/lib/importar.ts:471` · *El censo de hermanos*

**Cómo falla:** 1) Censo: Ana (nº 1, Activo), Luis (nº 0, Baja), Pepe (nº 2, Activo). 2) Se importa una hoja con columna «Situación» donde Ana figura como «Baja» y Luis como «Activo», con la opción «Actualizar sus datos». 3) Resultado real tras aplicar(): Ana queda «Baja» pero conservando el nº 1, y Luis queda «Activo» con el nº 0. La línea 471 (`delete cambios.numero`) protege el número, pero el estado sí se escribe, así que estado y número dejan de cuadrar; nadie renumera el censo y `numeracionSana()` devuelve false sin que la aplicación lo compruebe en ningún sitio. 4) Efecto dominó: si después secretaría da de baja a cualquiera, `darDeBajaEnCenso` (censo.ts:37) baja un puesto a todos los de número mayor que 0, y el hermano que tenía el nº 1 se queda con el 0, es decir, activo y sin número, mostrado como «—».

**Por qué importa:** El número de hermano es la posición en el cortejo. Un hermano de baja ocupando un número deja un puesto fantasma en el escalafón y descuadra el reparto de tramos; un hermano activo con número 0 aparece como «—» en el listado, se va al final de la ordenación y desaparece del cortejo aunque esté al día de todo. Es el tipo de fallo que no se ve hasta el reparto de papeletas o el día de la salida, y para entonces ya nadie sabe de dónde salió.

**Arreglo:** En `aplicar`, al actualizar a alguien que ya está: si el archivo lo pasa a «Baja», tramitarlo con `darDeBajaEnCenso` (número a 0 y recolocación del resto); si lo saca de baja, reincorporarlo con `reactivarEnCenso` en vez de escribir el estado a pelo. Y llamar a `numeracionSana()` al terminar la importación para avisar si la numeración quedó rota.

---

### «Recupera su antigüedad» coloca al reactivado por delante de hermanos más antiguos cuando la numeración tiene huecos

**Dónde:** `src/lib/censo.ts:71` · *El censo de hermanos*

**Cómo falla:** 1) El censo tiene huecos en la numeración, que es lo normal después de importar el Excel de la hermandad (números que nunca se reutilizaron, o hermanos que entraron ya como «Baja» y se quedaron con el 0). Ejemplo probado: activos con los números 1, 2, 4, 5, 6 y 7, y un hermano de baja con antigüedad 2015. 2) Ficha del hermano de baja → Administración → «Recupera su antigüedad (2015)». 3) Resultado real: se le asigna el nº 7, y el hermano que tenía el 7 (antigüedad 2010) es empujado al 8. Como nadie es más moderno que él, la línea 71 usa `activos.length + 1` en vez del último número ocupado, y `activos.length` no coincide con el número mayor cuando hay huecos.

**Por qué importa:** Es exactamente lo contrario de lo que promete el botón: quien vuelve se pone por delante de hermanos que no han faltado nunca, y en un censo grande con cien bajas eso significa colarse por delante de cien personas. En una hermandad el orden del escalafón se revisa en el cabildo y se nota en la fila del cortejo; un adelantamiento así genera una reclamación segura y nadie sabrá explicar de dónde salió.

**Arreglo:** Cuando no hay nadie más moderno, ponerlo al final de verdad: `Math.max(0, ...activos.map(h => h.numero)) + 1` en lugar de `activos.length + 1`.

---

### Un DNI escrito con puntos o guiones esquiva el control de duplicados del alta y luego impide entrar al hermano

**Dónde:** `src/pages/app/Hermanos.tsx:469` · *El censo de hermanos*

**Cómo falla:** 1) La hermandad importa su censo: `limpiarDni` guarda los DNI sin puntos ni guiones («12345678A»). 2) Meses después, secretaría da de alta a esa misma persona desde «+ Nuevo hermano» y teclea «12.345.678-A», como viene en el documento. 3) La comprobación de duplicados (líneas 469 y 508, y la de solicitudes en 207/238) solo hace `trim().toUpperCase()`, así que no ve que ya existe: se crea una segunda ficha, con otro número de hermano y otro id. 4) Además, ese hermano nunca podrá entrar en su área: el acceso compara con `normaliza()` (HermanoPortal.tsx:110), que tampoco quita puntos, así que si escribe su DNI sin puntos recibe «DNI o contraseña incorrectos».

**Por qué importa:** Duplicar a un hermano en el censo es el fallo más caro de deshacer: se le emiten dos cuotas, puede sacar dos papeletas, cuenta dos veces en el total del censo y ocupa dos números del escalafón. Y el hermano llama a secretaría diciendo que no puede entrar en su área, sin que nadie entienda por qué si su DNI está bien.

**Arreglo:** Normalizar el DNI en un solo sitio y usarlo en todas partes: guardar siempre la forma limpia (como hace `limpiarDni` de importar.ts) al dar de alta y al aprobar solicitudes, comparar duplicados sobre esa forma limpia, y limpiar también el DNI tecleado en el acceso del hermano.

---

### La fecha de nacimiento se importa tal cual viene: si el Excel la trae como dd/mm/aaaa queda inservible y la segmentación por edad no encuentra a nadie

**Dónde:** `src/lib/importar.ts:373` · *El censo de hermanos*

**Cómo falla:** 1) Se importa el censo con la columna «Fecha de nacimiento» tal y como la suelta Excel en España: «12/03/1985», «05/07/2012». 2) El ensayo no pone ninguna pega (comprobado: `problemas: []`) y las fichas se crean con `fechaNacimiento: '12/03/1985'`, porque la línea 373 la guarda sin validar ni convertir a ISO. 3) A partir de ahí: la ficha no muestra el cumpleaños (`diaYMes` devuelve cadena vacía), el filtro «🎂 Cumplen en marzo» no los cuenta, y al sesgar el censo o mandar un comunicado a «mayores de edad» o a «menores de edad» salen 0 destinatarios (probado con filtrarSegmento: 0 y 0).

**Por qué importa:** La hermandad cree que tiene las fechas de nacimiento —las ha subido y nadie le ha dicho nada— y descubre que no cuando manda un comunicado a los menores para la cita del cortejo infantil y no lo recibe ninguno, o cuando el listado de cumpleaños del mes sale vacío en un censo de mil. El dato está guardado, pero como texto que ningún cálculo entiende, y no hay ni un aviso.

**Arreglo:** Convertir la fecha en `ensayar` (aceptar dd/mm/aaaa, dd-mm-aaaa y aaaa-mm-dd, guardando siempre ISO) y añadir un problema en la fila cuando la fecha no se entienda, igual que ya se hace con el correo y con el año de antigüedad.

---

### Una columna «Baja» con Sí/No importa a los que se fueron como hermanos activos y rechaza a los que siguen

**Dónde:** `src/lib/importar.ts:266` · *El censo de hermanos*

**Cómo falla:** 1) La hoja de la hermandad tiene las columnas «Nombre;DNI;Baja», con «Sí» en quien causó baja y «No» en quien sigue —una forma habitual de llevarlo en un Excel antiguo. 2) `proponerEmparejado` asigna esa columna al campo «Situación» (es sinónimo exacto de `estado`, línea 139) y en el paso 2 se ve la etiqueta «Situación (Activo, Nuevo, Baja)» junto a la columna «Baja», que parece correcto. 3) Resultado comprobado: la fila con «Sí» se importa como **Activo** (la línea 266 interpreta «si» como activo) y la fila con «No» se rechaza con «No se entiende la situación «No»». Es decir, justo al revés: entran los que se fueron y se quedan fuera los que están.

**Por qué importa:** Los hermanos que causaron baja hace años entran en el censo como activos, con número de hermano y con cuota del ejercicio emitida a su nombre; y los hermanos de verdad aparecen como filas con error, así que hay que rescatarlos a mano. Lo primero no da ningún aviso: la vista previa solo dice «Se da de alta».

**Arreglo:** No dar por hecho el significado de «sí»/«no» en la columna de situación: cuando la cabecera emparejada sea «baja» (afirmativa), invertir la lectura, o pedir en el paso de columnas qué significa cada valor. Como mínimo, mostrar en la tabla del ensayo la situación con la que va a entrar cada fila (Activo/Nuevo/Baja) para que se vea el error antes de confirmar.

---

### El Estado de Cuentas anual se calcula sobre la copia del navegador, no sobre la base de datos: sale en cero

**Dónde:** `src/pages/app/Informes.tsx:216` · *El circuito del dinero*

**Cómo falla:** 1) La hermandad trabaja con Supabase conectado y tiene un año entero de movimientos en Tesorería. 2) El tesorero entra desde otro ordenador (o desde el mismo después de que otra hermandad haya usado ese navegador, porque `ajustarEspejoALaHermandad` borra todas las claves `cabildo-*` al cambiar de cuenta). 3) Va directo a Informes y pulsa «Descargar Estado de Cuentas». `movimientosEstado` sale de `leerDatos(CLAVES_DATOS.movimientos, ...)`, que con Supabase configurado devuelve [] si no hay copia local. 4) El PDF se imprime con las 4 partidas de ingresos y las 12 de gastos a 0,00 €, TOTAL INGRESOS 0,00 €, TOTAL GASTOS 0,00 €, SALDO 1 de enero 0,00 € y SALDO 31 de diciembre 0,00 €. Ningún aviso, ningún error en pantalla. Variante igual de mala: si sí visitó Tesorería hace un mes en ese navegador, el informe se imprime con la foto de hace un mes y le faltan los movimientos posteriores, también en silencio. Lo mismo afecta a los cuatro indicadores de cabecera y a los seis informes de la página, que usan `leerDatos` en vez de la tabla remota.

**Por qué importa:** El Estado de Cuentas es el documento que se lleva al cabildo general y se entrega a la diócesis. Un informe firmado con todo a cero, o con la mitad del ejercicio, no es un fallo de pantalla: es una cuenta rendida mal. Y como el total cuadra consigo mismo (0 = 0), nada delata el error hasta que alguien compara con el extracto.

**Arreglo:** Que Informes lea los movimientos con el mismo `useSupabaseTable('movimientos', ...)` que usa Tesorería, en vez de `leerDatos`, y que no deje imprimir mientras la carga no haya terminado (o avise «no se han podido traer los movimientos») en lugar de imprimir ceros. Mientras la tabla no esté cargada, el botón «Descargar Estado de Cuentas» debe estar deshabilitado.

---

### Cuotas usa el catálogo de conceptos de demostración cuando el navegador está limpio: emite el ejercicio con importes y nombres inventados

**Dónde:** `src/pages/app/Cuotas.tsx:142` · *El circuito del dinero*

**Cómo falla:** Cuotas hace `getConceptosCuota()`, que solo mira localStorage y cae en `CONCEPTOS_CUOTA_INICIALES` («Cuota anual 60 €», «Cuota trimestral 18 €», «Cuota extraordinaria 25 €»). Configuración, en cambio, usa `useConceptosCuota()`, que sí trae la tabla `conceptos_cuota` de Supabase. Reproducción: 1) La hermandad configura su concepto real, «Cuota ordinaria», 45 €, y emite con él los recibos de 2026. 2) El tesorero entra desde otro ordenador (o el navegador se ha limpiado al cambiar de cuenta) y pasa por Hermanos, con lo que el censo sí queda en la copia local. 3) Abre Cuotas: el desplegable ofrece «Cuota anual — 60 €», que no es suya. 4) Como ningún recibo se llama «Cuota anual», `hermanosSinCuota` devuelve el censo entero y salta el aviso «Nuevo ejercicio 2026: hay N hermanos sin la cuota anual de este año. Emítela a todo el censo de una vez». 5) Pulsa «Emitir cuotas de 2026» y se emiten recibos duplicados a todos los hermanos, a 60 € en vez de 45 €.

**Por qué importa:** Se duplica el censo entero en recibos y con el importe equivocado. Si esos recibos se domicilian, el banco carga 60 € a cada hermano que ya había pagado 45 €: cientos de cargos indebidos, devoluciones, comisiones y llamadas. Y el aviso de la propia aplicación es el que empuja al tesorero a hacerlo.

**Arreglo:** Cambiar `getConceptosCuota()` por `useConceptosCuota()` en Cuotas.tsx, y no ofrecer emisión ni prerrellenar importes hasta que el catálogo remoto haya llegado. Tesorería tiene el mismo patrón en sus líneas 39-41 (`getLista` en vez de `useLista`) para categorías y cuentas: conviene arreglarlo a la vez.

---

### Descargar el XML SEPA no deja rastro en los recibos: la siguiente remesa vuelve a cobrarlos

**Dónde:** `src/pages/app/Cuotas.tsx:410` · *El circuito del dinero*

**Cómo falla:** 1) El tesorero abre «Preparar remesa», elige fecha de cobro y pulsa «Descargar XML SEPA». `descargarSepaXml` genera el fichero, lo descarga y cierra el panel: no toca ni una cuota. 2) Sube el fichero a la banca online. 3) Los recibos siguen en estado «Pendiente» y siguen cumpliendo el filtro de `recibosRemesables` (pendiente + domiciliada + IBAN + fecha de cobro vencida). 4) Dos días después vuelve a entrar, ve los mismos recibos listados como pendientes de remesar y genera otra remesa. 5) El banco recibe los mismos adeudos otra vez y los cobra otra vez. No hay ningún estado «Presentada al banco», ni fecha de presentación, ni aviso: he buscado «remesa/presentada» en todo el código fuente y no existe.

**Por qué importa:** Doble cargo en la cuenta de cada hermano domiciliado. En una hermandad de 400 hermanos son 400 cargos duplicados, con sus devoluciones, sus comisiones de devolución y la desconfianza de un censo al que se le ha cobrado dos veces la cuota. Además, el tesorero no tiene forma de saber qué recibos ya presentó.

**Arreglo:** Al descargar el XML, marcar los recibos incluidos con un estado o una marca de «Presentada el <fecha>, remesa <id>», excluirlos de `recibosRemesables` mientras esa marca esté puesta, y ofrecer deshacer la presentación si el banco rechaza el fichero. El propio `MsgId` del XML sirve de identificador de remesa.

---

### «Simular cobro» está en la pantalla de producción: da por pagada la remesa sin apuntar un euro en Tesorería y devuelve recibos reales

**Dónde:** `src/pages/app/Cuotas.tsx:343` · *El circuito del dinero*

**Cómo falla:** El botón «Simular cobro» vive en el pie del panel de remesa, entre «Solo CSV» y «Descargar XML SEPA», sin ninguna comprobación de modo demostración. El texto de ayuda dice «marca la remesa como pagada», así que el tesorero lo usará para cerrar la remesa cuando el banco le confirme el cobro. Al pulsarlo: 1) `simularCobroRemesa` pone «Pagada» a todos los recibos de la remesa, pero `simularCobro` NO llama a `conApunteDeCobro` (a diferencia de `marcarPagada`, que sí lo hace): ni un solo apunte llega al libro de Tesorería. Marcar los recibos uno a uno sí apunta; hacerlo en bloque no. 2) Además, `simularCobroRemesa` marca como «Devuelta» todo recibo cuyo número sea múltiplo de 12: en una remesa de 240 recibos, 20 hermanos que han pagado quedan registrados como devueltos.

**Por qué importa:** Es exactamente el descuadre que el módulo de apuntes dice evitar: la remesa entera de cuotas —el ingreso más grande del año— aparece cobrada en Cuotas y no existe en Tesorería, así que el saldo, el balance y el Estado de Cuentas se quedan cortos por miles de euros. Y encima 1 de cada 12 hermanos al corriente figura como devuelto y acabará recibiendo una reclamación que no le corresponde.

**Arreglo:** O se esconde el botón fuera del modo demostración, o se convierte en un «Dar la remesa por cobrada» de verdad: que genere el apunte de ingreso de cada recibo con `conApunteDeCobro` y que no invente devoluciones (las devoluciones se marcan una a una cuando llega el fichero de devueltos del banco).

---

### Los recibos «En mora» no cuentan en ninguna cifra del informe de recaudación: la deuda sale más baja de lo que es

**Dónde:** `src/pages/app/Informes.tsx:51` · *El circuito del dinero*

**Cómo falla:** El informe «Recaudación de cuotas» resume con cuatro cifras: cobrado (estado Pagada), pendiente (estado Pendiente), devuelto (estado Devuelta) y domiciliadas. El estado «En mora» no entra en ninguna. 1) El tesorero pone en mora a 15 hermanos que deben 60 € cada uno (900 €). 2) Abre Informes → Recaudación de cuotas. 3) «Pendiente» baja 900 € respecto a lo que decía antes de ponerlos en mora, y esos 900 € no aparecen en «Cobrado» ni en «Devuelto»: se han evaporado del resumen. La página de Cuotas, en cambio, sí los cuenta en su indicador «Pendiente de cobro» (incluye Pendiente, Devuelta y En mora), así que las dos pantallas dan cifras distintas de la misma deuda.

**Por qué importa:** Poner a un hermano en mora hace que su deuda desaparezca del informe que se lleva al cabildo, justo cuando es la deuda que más importa reclamar. El tesorero presenta una morosidad menor que la real y las dos pantallas de la aplicación se contradicen sin que nada lo explique.

**Arreglo:** Añadir «En mora» al desglose del informe, como cifra propia («En mora: X €») y sumada a la deuda viva, con el mismo criterio que usa el indicador de la página de Cuotas, para que las dos pantallas digan lo mismo.

---

### La repetición de un evento nunca llega a la base de datos: se pierde al recargar

**Dónde:** `src/lib/db/eventos.ts:4` · *Eventos, inventario, comunicados e impresos*

**Cómo falla:** 1) Con Supabase conectado, entra en Eventos y crea «Misa de hermandad» el 06/09/2026 con «¿Se repite? · Cada mes». 2) El calendario la pinta en octubre, noviembre, diciembre: parece que ha funcionado. 3) Pulsa F5 (o entra desde otro ordenador). 4) La misa aparece SOLO el 06/09/2026 y en su ficha el desplegable vuelve a decir «No se repite». No sale ningún mensaje de error. Motivo: `eventoToRow` manda id, titulo, tipo, fecha, hora, lugar, descripcion y tareas, pero NO `repeticion`, y la tabla `eventos` de supabase/schema.sql (línea 588) ni siquiera tiene esa columna; al recargar, `rowToEvento` devuelve el evento sin repetición y esa copia pisa también el espejo de localStorage.

**Por qué importa:** La repetición es justamente lo que vende la pantalla («la misa de cada mes, el ensayo de cada semana, sin crearlos uno a uno»). La hermandad configura el ensayo semanal de costaleros y el triduo, cierra el navegador y al día siguiente el calendario está vacío de todo eso. Peor: cree que está puesto, así que nadie lo vuelve a apuntar y los avisos y la web pública se quedan sin esos cultos.

**Arreglo:** Añadir una columna `repeticion jsonb` a la tabla `eventos` (migración incluida) y mandarla/leerla en `eventoToRow` (`repeticion: e.repeticion ?? null`) y `rowToEvento` (`repeticion: (r.repeticion as Repeticion | null) ?? undefined`). Mientras no exista la columna, el `update` de supabaseSync fallaría con «column does not exist» y sí avisaría; hoy falla en silencio porque el campo ni se envía.

---

### La web pública enseña los cultos de EJEMPLO de la aplicación como si fueran los de la hermandad

**Dónde:** `src/lib/cultosDelCalendario.ts:22` · *Eventos, inventario, comunicados e impresos*

**Cómo falla:** 1) Una hermandad publica su web (el interruptor «Publicar solos los próximos actos de Eventos y tareas» viene activado por defecto, webPublica.ts:1104). 2) Un vecino cualquiera abre esa web desde su móvil. 3) En la sección Cultos le salen «Misa de hermandad · domingo 23 de agosto · 20:00», «Reparto de alimentos (bolsa de caridad)», «Igualá de costaleros», «Estación de penitencia · 28 de marzo de 2027»… que son los eventos de demostración de src/data/eventos.ts, no los de esa hermandad. Motivo: `cultosDelCalendario()` se ejecuta en el navegador DEL VISITANTE (SitioPublico.tsx:89) y lee `leerPersistido(CLAVES_DATOS.eventos, EVENTOS_INICIALES)`: como el visitante no tiene nada guardado, recibe los datos de ejemplo. Variante de fuga entre hermandades: si quien mira es un secretario que ya usó el panel de SU hermandad en ese navegador, en la web de la hermandad de al lado ve los cultos de la suya.

**Por qué importa:** La web pública es la cara de la hermandad. Está anunciando a todo el que entra una función principal, un reparto de caridad y una estación de penitencia con fecha y hora que nadie ha convocado, y la gente puede presentarse en la puerta. Además publica actividad de otra hermandad en el sitio equivocado.

**Arreglo:** Los cultos publicados tienen que venir con la web que se descarga de Supabase (`cargarWebPorSlug`), no del localStorage de quien mira. Como mínimo inmediato, cambiar `leerPersistido(..., EVENTOS_INICIALES)` por `leerDatos(CLAVES_DATOS.eventos, EVENTOS_INICIALES)`, que con base de datos configurada devuelve vacío en vez de los ejemplos (es exactamente el caso para el que se escribió `leerDatos` en persistencia.ts).

---

### Un acto que se repite desaparece de «Próximos eventos» y de la web en cuanto pasa su primera fecha

**Dónde:** `src/lib/cultosDelCalendario.ts:25` · *Eventos, inventario, comunicados e impresos*

**Cómo falla:** 1) Crea «Ensayo de costaleros» el 05/09/2026 con «Cada semana» hasta marzo. 2) El calendario mensual lo pinta bien todos los sábados (usa `calendarioEntre`, que sí despliega repeticiones). 3) El 06/09/2026 abre la pantalla de Eventos: el panel «Próximos eventos» ya no lo lista y el contador «Próximos eventos» lo ha descontado (Eventos.tsx:90 y :97 filtran `e.fecha >= hoyIso` sobre la fecha ORIGINAL). 4) En la web pública tampoco vuelve a salir nunca (cultosDelCalendario.ts:25 hace el mismo filtro). Un culto mensual creado hace un año no sale en la web ni una sola vez más, aunque el calendario lo siga pintando.

**Por qué importa:** La misma pantalla dice dos cosas distintas del mismo acto: el calendario lo tiene y la lista de próximos no. La secretaría se guía por «Próximos eventos» y por lo que ve el hermano en la web; los cultos que de verdad se repiten (la misa de hermandad, los ensayos) son precisamente los que dejan de anunciarse, que es lo contrario de lo que promete el módulo.

**Arreglo:** Calcular las próximas fechas con `aparicionesEntre`/`calendarioEntre` (data/eventos.ts) sobre una ventana desde hoy hasta, por ejemplo, un año vista, y ordenar por la fecha de la APARICIÓN, tanto en `proximos`/`stats.proximosN` de Eventos.tsx como en `cultosDelCalendario`.

---

### El modelo de papeleta, el de recibo y la asistencia se borran solos al cerrar sesión

**Dónde:** `src/lib/modeloPapeleta.ts:77` · *Eventos, inventario, comunicados e impresos*

**Cómo falla:** 1) Con Supabase conectado, en Papeletas sube la imagen del modelo propio de la hermandad y coloca a mano los 10-15 campos (nombre, nº de hermano, tramo, importe, QR…). Imprime una tanda: sale perfecto. 2) Cierra sesión (o simplemente caduca la sesión). En ese momento AuthContext.tsx:153 llama a `ajustarEspejoALaHermandad(null)`, que borra TODAS las claves `cabildo-*` que no estén en la lista blanca de multiHermandad.ts:160. 3) Vuelve a entrar: el modelo ya no está y las papeletas se imprimen con el diseño genérico. Lo mismo con `cabildo-modelo-recibo` y con `cabildo-asistencia` (asistencia.ts:24): las marcas de asiste/no asiste del año, con sus motivos y quién las puso, desaparecen. Ninguna de esas tres claves viaja a Supabase, así que no hay de dónde recuperarlas, y no se avisa de nada.

**Por qué importa:** Colocar el modelo sobre el escaneo de la papeleta de la hermandad es media tarde de trabajo, y la asistencia del día de salida la van marcando los diputados de tramo durante semanas. Se pierde entero por cerrar sesión, que es lo que hace cualquiera al terminar en el ordenador de la casa hermandad.

**Arreglo:** Guardar el modelo de papeleta, el de recibo y la asistencia en Supabase (tabla propia con `hermandad_id`), como ya se hace con eventos o enseres. Mientras tanto, meter esas claves en `NO_ES_DE_LA_HERMANDAD` no vale (son datos de la hermandad y se filtrarían a la siguiente): lo correcto es persistirlas o, como mínimo, avisar antes de borrarlas y ofrecer descargarlas.

---

### Un comunicado puede enviarse a los hermanos de ejemplo y no llegar a ninguno de verdad

**Dónde:** `src/pages/app/Comunicados.tsx:84` · *Eventos, inventario, comunicados e impresos*

**Cómo falla:** 1) Con Supabase conectado, cierra sesión (eso vacía la copia local del censo) y vuelve a entrar. 2) Sin pasar por la pantalla Hermanos, ve directamente a Comunicados. 3) Redacta «Convocatoria de cabildo general», destinatarios «Todos los hermanos», estado Enviado. 4) La ficha dice que ha llegado a 14 hermanos y, si el correo está conectado, se manda a ana.sanchez@example.com, maria.reyes@example.com… los del censo de demostración. Los hermanos reales no reciben ni el correo ni el aviso en su buzón, porque `agregarAvisoAVarios` se ha escrito contra los ids h1…h14, que no existen en esa hermandad. Motivo: la línea 84 usa `leerPersistido(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)` en vez de `leerDatos`, que es lo que sí se usa dos líneas más abajo para las papeletas (línea 127).

**Por qué importa:** Una convocatoria de cabildo o el aviso del cambio de hora de la salida se da por enviado y no lo ha recibido nadie. La hermandad no tiene forma de enterarse: la pantalla dice «Enviado» con su alcance y su fecha. Y el alcance que queda registrado en el histórico es inventado.

**Arreglo:** Cambiar la línea 84 a `leerDatos(CLAVES_DATOS.hermanos, HERMANOS_INICIALES)` y, además, no dejar enviar (ni contar alcance) cuando el censo venga vacío: mejor un aviso «todavía no se ha cargado el censo, vuelve a intentarlo» que un envío al vacío.

---

### La web pública enseña los cultos de ejemplo de Gobergo como si fueran de la hermandad

**Dónde:** `src/lib/cultosDelCalendario.ts:22` · *La web publica*

**Cómo falla:** 1) La hermandad deja activada la opción «cultos del calendario» (viene activada de fábrica: `cultosDelCalendario: true`, webPublica.ts:1104). 2) Un visitante abre la web. 3) `SitioPublico.tsx:89` llama a `cultosDelCalendario()`, que hace `leerPersistido(CLAVES_DATOS.eventos, EVENTOS_INICIALES)`: como el navegador del visitante no tiene la clave `cabildo-eventos`, devuelve los EVENTOS DE DEMOSTRACIÓN de la aplicación. 4) La sección «Próximos cultos», la cuenta atrás y el bloque de «próximo culto» de la portada muestran «Misa de hermandad» (23 de agosto), «Reparto de alimentos», «Triduo a Ntra. Sra.», «Igualá de costaleros», «Estación de penitencia»… cultos que esa hermandad no ha convocado nunca. Encima entran en los datos estructurados (seoWeb.ts:91) y se le mandan a Google con fecha y hora.

**Por qué importa:** La hermandad publica en su web oficial convocatorias falsas. Alguien puede presentarse en la iglesia un domingo a una misa que no existe, y Google puede llegar a mostrar esos cultos inventados en el buscador. La hermandad no lo ve nunca desde su ordenador, porque ahí sí están sus eventos reales.

**Arreglo:** Los cultos del calendario tienen que viajar con la web (guardarlos en `datos` al subir la web al servidor, o traerlos de Supabase por hermandad). Como mínimo inmediato, usar `leerDatos` en vez de `leerPersistido` para que con Supabase configurado devuelva lista vacía en lugar de los ejemplos, igual que hace el resto de la aplicación.

---

### El robots.txt prohíbe a Google indexar todas las webs que no tienen dominio propio

**Dónde:** `api/seo.ts:39` · *La web publica*

**Cómo falla:** 1) Una hermandad con el pack «Web» (el dominio propio exige el pack «Todo») publica su web en https://app-gobergo/w/su-slug. 2) Google pide https://app-gobergo/robots.txt. 3) `webPublicada(host)` busca una web cuyo campo `datos->>dominio` sea el host pedido; como ninguna hermandad tiene puesto el dominio de la propia aplicación, devuelve null. 4) El handler entra en el `if (!web)` de la línea 65 y responde «User-agent: *  Disallow: /». El sitemap.xml de ese host sale vacío por el mismo camino. Mientras tanto, el panel de la hermandad le enseña y le deja descargar un robots.txt con «Allow: /» y su sitemap (WebPublica.tsx:3363).

**Por qué importa:** Toda hermandad sin dominio propio queda deliberadamente fuera de Google, que es justo lo que el módulo promete arreglar («que se encuentre»). Nadie encontrará la hermandad buscando su nombre, y el panel les dice lo contrario. Como efecto secundario, la propia página de venta de Gobergo tampoco se indexa.

**Arreglo:** Cuando el host es el de la aplicación, el robots.txt debe permitir la indexación (`Allow: /`) en vez de bloquearla, y el sitemap de ese host debe listar las webs publicadas o al menos no contradecir lo que se le enseña a la hermandad. Ajustar también el `Sitemap:` que se genera en el editor, que hoy apunta a /w/slug/sitemap.xml, una ruta que devuelve HTML.

---

### Dos hermandades no pueden repetir enlace: la segunda deja de subir su web sin enterarse

**Dónde:** `src/lib/webPublica.ts:1328` · *La web publica*

**Cómo falla:** En la base de datos `web_publica.slug` es único para TODAS las hermandades (supabase/web-publica.sql:16) y el valor de fábrica es el mismo para todas: 'mi-hermandad' (webPublica.ts:957). 1) La hermandad A guarda su web (se queda con el slug). 2) La hermandad B edita la suya y, al guardar, `subirWebAlServidor` hace el upsert de la línea 1330 resolviendo por `hermandad_id`; Postgres rechaza la fila por el índice único de `slug`. 3) El error se captura en el `catch` de la línea 1337, se escribe UN `console.warn` (y solo el primero, por `avisadoDeSubida`) y `saveWebPublica` ni siquiera mira el resultado. La pantalla no dice nada. 4) B pone «Publicada», copia su enlace y lo reparte: quien lo abre ve la web de la hermandad A (que es la dueña de ese slug) o el aviso de «no disponible». Lo mismo pasa cuando B cambia su slug por uno ya ocupado: a partir de ahí ningún cambio suyo vuelve a subir, y su web pública se queda congelada en la última versión que sí subió.

**Por qué importa:** La hermandad trabaja semanas en su web, la ve perfecta en su pantalla y en internet no hay nada suyo, o hay otra hermandad. Nadie recibe ningún aviso: ni al guardar, ni al publicar, ni al copiar el enlace.

**Arreglo:** Comprobar la disponibilidad del slug al escribirlo (consulta a la tabla) y, sobre todo, devolver el fallo a la pantalla: `saveWebPublica` debe esperar el resultado de `subirWebAlServidor` y avisar en rojo cuando el enlace ya está cogido o la subida falla, en vez de tragarse el error en la consola.

---

### Dirección, teléfono, correo y datos de cobro desaparecen para el visitante

**Dónde:** `src/components/SitioContenido.tsx:1368` · *La web publica*

**Cómo falla:** La web usa como respaldo los datos de Configuración de la hermandad: `web.direccion || hermandad.direccion` (líneas 515-517 y 1466-1468) y, en donativos, `d.bizum.trim() || hermandad.bizumTelefono` y `d.iban.trim() || hermandad.iban` (1368-1369). Esos datos vienen de `useHermandadSettings()`, que los lee de localStorage y de `hermandad_settings`, tabla que un visitante sin sesión no puede leer. 1) La hermandad rellena dirección, teléfono, correo, Bizum e IBAN en Configuración y los deja en blanco en el editor de la web, tal y como documenta el propio tipo («vacíos = los de la hermandad»). 2) En la vista previa lo ve todo correcto. 3) Un visitante abre la web: la sección de Contacto sale sin dirección, sin teléfono, sin correo y sin mapa (el mapa se construye con la dirección), y la sección de Donativos NO SE PINTA (línea 1370: `if (!bizum && !iban && !pasarela) return null`).

**Por qué importa:** La hermandad publica una web sin forma de localizarla y, peor, sin la sección de donativos: se pierde dinero sin que nadie sepa por qué. La comprobación desde el panel siempre sale bien, así que el fallo puede durar años.

**Arreglo:** Resolver los respaldos en el momento de guardar/servir la web (volcarlos dentro de `datos`) o traerlos con la función pública `hermandad_de_la_web`, que ya devuelve exactamente esos campos para el servidor (api/w.ts:111) y que la página del navegador no llega a usar.

---

### El área del hermano machaca la copia local del censo con su única ficha, y el panel abierto en otra pestaña se queda con un censo de una sola persona

**Dónde:** `src/lib/supabaseSync.ts:83` · *Multi-hermandad y aislamiento*

**Cómo falla:** 1) En el ordenador de la casa de hermandad, la secretaria tiene el panel abierto en Hermanos (usa useSupabaseTable('hermanos', CLAVES_DATOS.hermanos, ...), src/pages/app/Hermanos.tsx:90). 2) En otra pestaña del MISMO navegador un hermano entra en /hermano. HermanoPortal.tsx:156 monta el mismo hook, con la misma tabla y la misma clave local. 3) Las políticas de Supabase solo le dejan ver SU fila, así que la consulta devuelve 1 hermano, y espejarEnLocal(claveLocal, traidos) (línea 83) sobrescribe 'cabildo-hermanos' con esa única fila. 4) useEscuchaOtrasPestanas (línea 112) dispara el evento 'storage' en la pestaña del panel y setItemsState reemplaza el censo en pantalla: la secretaria ve cómo sus 400 hermanos se convierten en 1 sin tocar nada. Lo mismo pasa con 'cabildo-cuotas' y 'cabildo-papeletas'. 5) Aunque cierre la pestaña del hermano, la copia local queda con 1 fila y las pantallas que la leen sin ir a Supabase la creen: Cortejo (src/pages/app/Cortejo.tsx:110), la paleta Ctrl+K (PaletaComandos.tsx:113), los informes de RGPD (src/lib/rgpd.ts:28-31) y el cruce de papeletas de Hermanos.tsx:149.

**Por qué importa:** El cortejo se monta con un hermano, los informes y las exportaciones de RGPD salen con un censo de una persona, y si la secretaria hace un reemplazo masivo (importar censo) el diff de sincronizar() calcula los 'eliminados' contra esa lista de 1 fila. Además la sensación es de pérdida de datos: la hermandad cree que se le ha borrado el censo.

**Arreglo:** La copia local no puede ser común entre el panel y el área del hermano: que useSupabaseTable reciba un sufijo de ámbito en la clave (p. ej. 'cabildo-hermanos' para el panel y 'cabildo-hermanos-mio' en HermanoPortal), o que el área del hermano no espeje nada (pasar una opción soloLectura que salte espejarEnLocal y useEscuchaOtrasPestanas). Además, incluir el hermandad_id en la clave local ata cada copia a su hermandad.

---

### La web pública de una hermandad enseña el IBAN, el Bizum, el nombre y el logo de OTRA hermandad si el navegador los tiene guardados

**Dónde:** `src/lib/hermandadSettings.ts:125` · *Multi-hermandad y aislamiento*

**Cómo falla:** 1) En un ordenador, alguien de la hermandad A entra en el panel: useHermandadSettings() trae su fila de Supabase y la guarda en localStorage bajo 'cabildo-hermandad-settings' (con IBAN, Bizum, CIF, dirección, logo). 2) En ese mismo navegador se abre la web pública de la hermandad B: /w/hermandad-b. 3) SitioPublico.tsx:83 llama a useHermandadSettings() otra vez. El estado inicial sale de localStorage (getHermandadSettings, línea 96) = los datos de A. La consulta a Supabase se hace sin sesión, las políticas devuelven cero filas y la línea 125 hace 'if (cancelado || error || !data) return', o sea: se queda con lo de A. 4) SitioContenido.tsx:1368-1369 pinta 'const bizum = d.bizum.trim() || hermandad.bizumTelefono' y 'const iban = d.iban.trim() || hermandad.iban'. Si B no rellenó esos campos en su editor, la sección de donativos de B muestra el IBAN y el Bizum de A. Lo mismo con el pie (SitioContenido.tsx:515-517: dirección, teléfono y correo de A) y con la marca de agua de las fotos (líneas 1107 y 1268, con el nombre legal de A). 5) Igual de grave: cultosDelCalendario() (src/lib/cultosDelCalendario.ts:21) lee 'cabildo-eventos' de localStorage, así que los 'próximos cultos' de la web de B son los del calendario de A (o los eventos de ejemplo si no hay nada).

**Por qué importa:** Un devoto que quiere hacer un donativo a la hermandad B copia un IBAN que es de la hermandad A: el dinero se va a la cuenta equivocada y nadie se entera hasta que cuadran la tesorería. Y es una fuga de datos entre hermandades en el sitio más visible que hay, la web pública.

**Arreglo:** La web pública no puede leer nunca la copia local: ya existe la función hermandad_de_la_web(slug) en supabase/multi-hermandad.sql:521, que devuelve solo los campos publicables (y a propósito NO el IBAN ni el CIF). Que cargarWebPorSlug/cargarWebPorDominio devuelvan también esos ajustes y SitioPublico los use, en vez de useHermandadSettings(). Lo mismo con los cultos: que vengan de la fila de web_publica traída por slug, no de 'cabildo-eventos'.

---

### Cualquier cuenta puede llamar a adoptar_datos_sin_hermandad() y adjudicarse todas las filas sin dueño de la base entera

**Dónde:** `supabase/multi-hermandad.sql:390` · *Multi-hermandad y aislamiento*

**Cómo falla:** 1) adoptar_datos_sin_hermandad(p_hermandad_id uuid) se declara SECURITY DEFINER y recorre hermanos, cuotas, papeletas, movimientos, documentos, personal, hermandad_settings, web_publica y mensajes_web haciendo 'update ... set hermandad_id = $1 where hermandad_id is null'. 2) No lleva ningún 'revoke execute'. Postgres concede EXECUTE a PUBLIC por defecto, y crear_hermandad_manual sí tiene sus dos revoke (líneas 531-532), lo que confirma que aquí se olvidaron. 3) Como está en el esquema public, PostgREST la publica: desde la consola del navegador, con la sesión de cualquier hermandad, basta con supabase.rpc('adoptar_datos_sin_hermandad', { p_hermandad_id: '<mi-id>' }). 4) Al ser SECURITY DEFINER se salta las políticas: todas las filas huérfanas de la base pasan a ser suyas y las ve en su panel.

**Por qué importa:** Una hermandad que está en plena mudanza desde el proyecto antiguo tiene su censo entero con hermandad_id nulo hasta que su titular entra por primera vez. En esa ventana, otra hermandad cualquiera le puede robar el censo completo (nombres, DNI, IBAN, teléfonos), y encima la víctima se queda sin datos: cuando por fin entre, no verá nada. Un censo de hermandad revela convicciones religiosas, categoría especial del RGPD.

**Arreglo:** Añadir junto a la función: revoke execute on function adoptar_datos_sin_hermandad(uuid) from public; revoke execute on function adoptar_datos_sin_hermandad(uuid) from anon, authenticated; Solo la debe poder llamar crear_hermandad()/crear_hermandad_manual(), que ya son SECURITY DEFINER y la invocan internamente.

---

### Un titular dado de alta a mano acaba dentro de una hermandad elegida al azar, y arrastra con él las filas sin dueño

**Dónde:** `supabase/multi-hermandad.sql:440` · *Multi-hermandad y aislamiento*

**Cómo falla:** 1) El procedimiento para nombrar titular que sigue documentado en supabase/rls-endurecer.sql:81 es «insert into titulares (auth_user_id) values ('<uuid>')», sin hermandad_id. 2) Esa cuenta entra por primera vez. La app llama a crear_hermandad(). hermandad_actual() devuelve NULL (la fila de titulares tiene hermandad_id nulo y el coalesce sigue de largo), así que no sale por el atajo de la línea 424. 3) 'select true into ya_era_titular from titulares where auth_user_id = auth.uid()' da cierto, y entonces se ejecuta la línea 440: 'select t.hermandad_id into nueva from titulares t where t.hermandad_id is not null limit 1'. Ese SELECT no filtra por nada ni ordena: devuelve la hermandad de UN titular cualquiera de toda la tabla, normalmente la más antigua. 4) La línea 449 lo inserta como titular de esa hermandad, y la 455 llama a adoptar_datos_sin_hermandad() sobre ella. 5) La misma línea está repetida en crear_hermandad_manual (línea 509).

**Por qué importa:** El nuevo miembro de junta de una hermandad entra y se encuentra dentro del panel de OTRA hermandad, con permiso de titular: ve y edita su censo, sus cuotas, su tesorería y su archivo. Además el adoptar_datos_sin_hermandad se lleva a esa hermandad ajena cualquier fila huérfana que hubiera. Es exactamente el fallo que este fichero dice estar evitando.

**Arreglo:** Esa rama solo tiene sentido para la mudanza de un proyecto de UNA sola hermandad, y hay que acotarla: ejecutarla únicamente si (select count(*) from hermandades) <= 1, y en cualquier otro caso crear una hermandad nueva. Y actualizar rls-endurecer.sql:81 para que el insert manual incluya siempre el hermandad_id, o sustituirlo por crear_hermandad_manual(correo, nombre).

---

### Cuando falla la consulta a Supabase, el panel de una hermandad real se llena con los hermanos y las cuotas de ejemplo, y lo que se edita ahí no se guarda en ningún sitio sin avisar

**Dónde:** `src/lib/supabaseSync.ts:79` · *Multi-hermandad y aislamiento*

**Cómo falla:** 1) En useSupabaseTable, si la consulta devuelve error (línea 79) o si el fetch se rechaza (línea 90), se hace setItemsState(leerPersistido(claveLocal, inicial)). Ojo: leerPersistido, no leerDatos. Si en ese navegador no hay copia (recién montada la hermandad, o justo después de que ajustarEspejoALaHermandad la haya borrado al entrar), leerPersistido devuelve 'inicial', que es HERMANOS_INICIALES / CUOTAS_INICIALES: los 12 hermanos y las cuotas de demostración. 2) Pasos: se crea la hermandad, se entra por primera vez (la copia local se acaba de borrar), y la primera consulta a hermanos falla —token caducado, o el proyecto de Supabase despertando de la pausa—. El panel enseña 12 hermanos con nombre y apellidos que no existen. 3) La misma rama pone cargado.current = true (líneas 85 y 91). 4) La tesorera, creyendo que es su censo, corrige la ficha de uno. setItems llama a sincronizar(), que hace update(...).eq('id', <id de ejemplo>). PostgREST devuelve 200 y cero filas afectadas: no hay 'error', así que no se lanza el evento 'cabildo-sync-error' ni sale ningún aviso. La pantalla dice que se ha guardado y en la base de datos no hay nada.

**Por qué importa:** Contradice la regla que el propio proyecto escribió en persistencia.ts:58 («mejor enseñar cero que enseñar mentiras») justo donde más duele: una hermandad recién dada de alta abre el panel y ve doce hermanos, cuatro cuotas pendientes y un recibo cobrado que no son suyos, y los informes le cuadran sobre datos inventados. Y una tarde de trabajo encima de esas fichas se pierde entera, en silencio.

**Arreglo:** En las dos ramas de error usar la misma regla que leerDatos: con Supabase configurado, leerPersistido(claveLocal, []) —nunca los ejemplos—, y además NO poner cargado.current = true cuando la carga ha fallado, para que un fallo de red no habilite una sincronización por diferencias contra una lista que no vino de la base. Conviene también avisar en pantalla de que los datos no se han podido cargar.

---

### Cualquiera sin sesión puede averiguar si un DNI pertenece a una hermandad concreta y obtener su correo

**Dónde:** `supabase/multi-hermandad.sql:553` · *Multi-hermandad y aislamiento*

**Cómo falla:** 1) hermandades_publicas() está concedida a anon (línea 601): devuelve el id y el nombre de todas las hermandades dadas de alta. 2) resolver_email_hermano(p_hermandad_id, p_dni) es SECURITY DEFINER y también está concedida a anon (línea 553). 3) Desde cualquier navegador, sin iniciar sesión: const { data: hs } = await supabase.rpc('hermandades_publicas'); y luego await supabase.rpc('resolver_email_hermano', { p_hermandad_id: hs[0].id, p_dni: '12345678Z' }). 4) Si devuelve un correo, esa persona es hermana de esa hermandad y además se conoce su dirección de correo. Si devuelve null, no lo es. No hay límite de intentos ni captcha en ninguna parte del flujo.

**Por qué importa:** Pertenecer a una hermandad es un dato que revela convicciones religiosas: categoría especial del artículo 9 del RGPD, que es exactamente lo que la cabecera de este fichero dice que hay que proteger. Con el DNI de una persona —que aparece en mil sitios— cualquiera puede confirmar a qué hermandad pertenece y sacarle el correo, y la lista de hermandades para probar se la da la propia aplicación.

**Arreglo:** No devolver el correo: que la función acepte hermandad + DNI y dispare ella el envío del enlace de acceso (o devuelva solo un booleano de 'seguimos'), sin exponer nunca la dirección. Y limitar los intentos por IP/hermandad, con una tabla de intentos o el rate limit del Edge Function, para que no se pueda barrer a lo bruto.

---

### Cortejo y Papeletas enseñan los tramos de DEMOSTRACIÓN como si fueran los de la hermandad

**Dónde:** `src/lib/tramos.ts:78` · *Papeletas de sitio y cortejo*

**Cómo falla:** 1) Hermandad real con Supabase conectado. 2) Inicia sesión la secretaría en un ordenador nuevo, o simplemente vuelve a entrar tras haber cambiado de cuenta (AuthContext llama a ajustarEspejoALaHermandad, que borra TODAS las claves 'cabildo-*' del navegador, incluida 'cabildo-tramos'). 3) Entra directamente en Cortejo o en Papeletas. Aparecen ocho tramos que no son suyos: «Cortejo de Cristo — Cruz de guía 0/3, Insignias 0/8, Cirio 1º 0/40, Cirio 2º 0/40», «Cortejo de la Virgen…», «Música 0/25», con precios 22 €/18 €. Son los TRAMOS_POR_DEFECTO de la demo (tramos.ts:67). El motivo: getTramos() devuelve los datos de ejemplo cuando localStorage está vacío, sin mirar isSupabaseConfigured (leerDatos, en persistencia.ts:58, sí lo mira y devuelve vacío precisamente para esto). 4) Papeletas.tsx:82 y Cortejo.tsx:76 llaman a getTramos() dentro de un useMemo con dependencias [], nunca a useTramos(), así que ninguna de las dos páginas vuelve a pedir los tramos reales a Supabase: el error dura toda la sesión. 5) Si además emites una papeleta en uno de esos tramos, se guarda con tramo_id 't1' y la tabla papeletas espera un uuid (TODO-EN-UNO.sql:200): el insert es rechazado y salta el aviso de sincronización.

**Por qué importa:** La secretaría abre el cortejo el día antes de la salida y ve un cortejo inventado, con cuerpos y aforos que no son los suyos, y con hueco donde no lo hay. Si actúa sobre él (emitir papeletas, imprimir el orden) trabaja sobre datos falsos, y las papeletas que emita no llegan a la base de datos.

**Arreglo:** Que getTramos() devuelva [] cuando isSupabaseConfigured, igual que hace leerDatos(); y que Papeletas.tsx y Cortejo.tsx usen useTramos() en lugar de getTramos(), de modo que la lista real entre en cuanto llegue de Supabase. Mientras la lista esté vacía, mostrar el aviso de «falta configurar los tramos» en vez de un cortejo.

---

### Al borrar un tramo, los hermanos que ya tenían su papeleta en él desaparecen del cortejo sin ningún aviso

**Dónde:** `src/lib/cortejo.ts:66` · *Papeletas de sitio y cortejo*

**Cómo falla:** 1) Hay papeletas de la campaña activa en el tramo «Insignias» (por ejemplo 8 hermanos, ya cobradas). 2) Configuración › Cuerpos y tramos › se quita ese tramo con la papelera (Configuracion.tsx:336, removeTramo, que no comprueba si hay papeletas dentro) › «Guardar tramos». No sale ninguna advertencia. 3) Vuelve a Cortejo: esos ocho hermanos no están en ninguna parte. repartoDeCuerpo solo reparte sobre los tramos que existen, así que su papeleta no entra en ningún reparto; tampoco entra en la lista «Pendientes» de Cortejo.tsx:134, que solo recoge las papeletas en estado 'Solicitada' y SIN tramo; ni en la lista de anuladas. 4) En Papeletas la fila del hermano sigue diciendo «Renovada» pero la columna «Sitio 2027» dice «—». 5) El «Orden del cortejo» impreso sale sin ellos. Con Supabase pasa lo mismo por otra vía: la columna tramo_id es 'on delete set null', así que la papeleta se queda sin tramo pero conservando su estado 'Asignada'/'Pagada'.

**Por qué importa:** Ocho hermanos que han pagado su papeleta se quedan fuera del listado del diputado de tramo y del orden del cortejo, y nadie se entera hasta la mañana de la estación de penitencia. Además los números dejan de cuadrar: «papeletas emitidas» las sigue contando y «puestos cubiertos» no.

**Arreglo:** Dos cosas. En Configuración, antes de borrar un tramo, contar las papeletas de la campaña activa que apuntan a él y exigir confirmación explícita (o impedirlo hasta recolocarlas). Y en Cortejo, recoger las papeletas activas cuyo tramoId no corresponde a ningún tramo existente y sacarlas en un bloque visible tipo «Sin tramo — hay que recolocar», igual que se hace con las 'Solicitada'.

---

### Aceptar una solicitud pendiente devuelve a «Asignada» una papeleta que ya estaba cobrada

**Dónde:** `src/pages/app/Papeletas.tsx:485` · *Papeletas de sitio y cortejo*

**Cómo falla:** 1) Un hermano sin papeleta pide su sitio desde su área: queda una solicitud «Pendiente». 2) Antes de que la secretaría la revise, ese mismo hermano pasa por el mostrador y la secretaría le emite la papeleta desde Papeletas y le registra el cobro (estado «Pagada», método Efectivo, con su apunte en el libro de cuentas). 3) Días después la secretaría abre el buzón «Solicitudes (1)» —la solicitud sigue ahí, nadie la cerró— y pulsa «Aceptar y emitir». 4) aceptarSolicitud busca la papeleta del año con `p.estado !== 'Anulada'`, encuentra la que ya está PAGADA y la sobrescribe con `{ ...p, opcion, tramoId, estado: 'Asignada', importe }`. La papeleta vuelve a figurar sin cobrar, con el tramo y el importe que decida tramoParaSolicitud (que puede no ser el que se le vendió), mientras metodoPago y fechaPago se quedan dentro apuntando a un cobro que la pantalla ya no reconoce.

**Por qué importa:** El dinero ya está en caja y con su apunte en Tesorería, pero la papeleta aparece «pendiente de pago» y el contador «Recaudado» baja. La secretaría vuelve a reclamarle el pago a un hermano que ya pagó, y el arqueo no cuadra con el módulo de papeletas.

**Arreglo:** En aceptarSolicitud, si ya existe una papeleta activa del año, no pisarla: marcar la solicitud como «Aceptada» (o «Rechazada · ya tenía papeleta») y avisar en pantalla de que ese hermano ya tiene su sitio. Como mínimo, no tocar `estado`, `importe`, `metodoPago` ni `fechaPago` cuando la papeleta está en 'Pagada' o 'Entregada'.

---

### Cobrar una papeleta como «Exento» apunta un ingreso que nadie ha pagado

**Dónde:** `src/pages/app/Papeletas.tsx:389` · *Papeletas de sitio y cortejo*

**Cómo falla:** 1) Papeletas › ficha de un hermano con papeleta «Asignada» de 18 €. 2) En «Registrar cobro» se elige el método «Exento» (está en la lista, data/papeletas.ts:9) y se pulsa «Registrar pago». 3) registrarPago marca la papeleta como 'Pagada' sin tocar el importe y llama a conApunteDeCobro con `importe: p.importe` = 18 €. Como 18 > 0, se crea un movimiento de Ingreso de 18 € en «Otros ingresos», cuenta bancaria (apuntes.ts:88 manda a «Cuenta bancaria» todo lo que no sea efectivo). 4) El contador «Recaudado» de la campaña también lo suma, porque cuenta el importe de todas las 'Pagada'/'Entregada'. En todo el código, 'Exento' no se trata de forma especial en ningún sitio.

**Por qué importa:** Exento significa justamente que ese hermano no paga (hermano exento por antigüedad, un menor, una situación económica). La hermandad acaba con un ingreso ficticio en el libro de cuentas y con una recaudación de campaña inflada; a fin de ejercicio ese dinero no aparece en el banco y no hay forma de saber de dónde salió el descuadre.

**Arreglo:** En registrarPago, si el método es 'Exento', poner el importe de la papeleta a 0 (o guardar el importe original en otro campo) y no llamar a conApunteDeCobro. Y excluir las exentas del cálculo de `recaudado` en stats.

---

### Cambiar a un hermano de tramo desde Cortejo no recalcula el precio ni borra la papeleta personalizada

**Dónde:** `src/pages/app/Cortejo.tsx:285` · *Papeletas de sitio y cortejo*

**Cómo falla:** Caso A (precio): un hermano tiene papeleta en «Cirio 1º tramo» (18 €). Cortejo › «+ Asignar hermano» › lo eliges › cuerpo Cristo › tramo «Cruz de guía» (22 €) › Asignar. handleAsignarHermano encuentra la papeleta existente y solo cambia `tramoId`: el importe se queda en 18 €. La papeleta impresa y el cobro dicen 18 € por un puesto que la hermandad ha puesto a 22 €. (Al revés pasa igual: se le cobran 22 € por un cirio de 18 €.) Caso B (opción personalizada): un hermano tiene papeleta personalizada «Mantilla» (tramoId null, opcion 'Mantilla', 15 €). Se le asigna desde Cortejo el tramo «Presidencia». La papeleta queda con tramoId Y opcion 'Mantilla' a la vez: sale en el cortejo en Presidencia, sigue costando 15 €, y en rolesPapeleta.ts (indiceRoles, líneas 79-90) se le suman las DOS etiquetas automáticas —la del tramo y la de la opción—, así que en Hermanos y en Comunicados figura como mantilla y como lo que sea Presidencia al mismo tiempo. Compárese con sacarEnTramo en Papeletas.tsx:571, que sí hace `opcion: null` y recalcula el importe.

**Por qué importa:** La hermandad cobra de menos o de más sin darse cuenta, y el censo dice que un hermano es dos cosas a la vez. Al segmentar un comunicado «a las mantillas» le llega a alguien que va en presidencia.

**Arreglo:** En handleAsignarHermano, al reutilizar una papeleta existente escribir también `opcion: null` e `importe: precioDeTramo(tramo, precioBase)` — exactamente lo que ya hace sacarEnTramo. Si la papeleta ya estaba pagada por otro importe, avisar del ajuste en vez de cambiarlo en silencio.

---

### Renovar desde el área del hermano cobra el precio del año pasado; renovar desde secretaría cobra el de este año

**Dónde:** `src/pages/HermanoPortal.tsx:717` · *Papeletas de sitio y cortejo*

**Cómo falla:** 1) La hermandad sube el precio del «Cirio 1º tramo» de 18 € a 20 € en Configuración. 2) El hermano A entra en su área y pulsa «Renovar mi sitio»: renovarSitio calcula `const importe = renovacion.sitioAnterior.importe || precioDeTramo(tramoAnterior, precioBase)`, es decir, coge el importe de la papeleta del AÑO PASADO (18 €) y solo usa el precio actual si aquel era 0. Su papeleta queda a 18 €. 3) El hermano B llama a secretaría y se la renuevan desde Papeletas: allí el botón llama a `renovar(h.id, tramoId, precioDeTramo(tramoAnterior, precioBase))` (Papeletas.tsx:840) y su papeleta queda a 20 €. 4) Los dos van en el mismo tramo y pagan cantidades distintas. El comentario de Papeletas.tsx dice literalmente que esto se arregló ahí «si la hermandad sube el precio del tramo, quien renovaba seguía pagando el viejo y dos hermanos del mismo tramo pagaban cantidades distintas»; en el área del hermano se quedó sin arreglar.

**Por qué importa:** Dos hermanos del mismo tramo pagan precios distintos por el mismo puesto según por dónde renovaran, y la campaña recauda menos de lo presupuestado. Es la clase de agravio comparativo que acaba en una reclamación en cabildo.

**Arreglo:** En renovarSitio (HermanoPortal.tsx:717) usar `precioDeTramo(tramoAnterior, precioBase)` sin el `sitioAnterior.importe ||` delante, igual que hace Papeletas. Mejor aún: extraer la renovación a una sola función compartida en lib/ para que las dos vías no puedan volver a separarse.

---

### Todo el personal con cuenta real entra como titular y ve el panel entero, incluido el censo

**Dónde:** `src/lib/permisos.ts:134` · *Permisos, cargos y suscripcion*

**Cómo falla:** 1) Con Supabase conectado, el Hermano Mayor entra en Personal y permisos y crea el acceso del tesorero (Personal.tsx:82-89 hace el signUp con metadata { hermandad, nombre, cargo }: NO guarda personalId). 2) El tesorero entra por /login con ese correo y contrasena: es un signInWithPassword real, asi que su user_metadata no tiene personalId (ese campo solo se escribe en el login de demostracion, AuthContext.tsx:277). 3) AppShell.tsx:178 lee user_metadata.personalId -> undefined -> cargoDeCuenta(undefined, ...) devuelve null (permisos.ts:134). 4) null significa 'titular de la hermandad': permisosDeCargo devuelve null y puedeVerModulo da true para todo. Resultado: el tesorero ve Hermanos, Cortejo, Papeletas, Archivo, Comunicados, Web, Configuracion y hasta Personal y permisos. La RLS tampoco lo tapa: las politicas de lectura de hermanos/cuotas/papeletas solo exigen 'no ser hermano' (rls-cargos.sql:137), asi que ve los datos de verdad, no una pantalla vacia.

**Por qué importa:** La promesa central del producto ('cada cargo ve solo los modulos que le permitas', escrito en la propia pantalla de Personal) no se cumple con ninguna cuenta real: solo funciona en el modo demostracion. Cualquier vocal o mayordomo se descarga el censo completo con DNI, direcciones y telefonos, y puede abrir Personal y permisos. Para una hermandad esto es un incidente de proteccion de datos con todos sus hermanos dentro, y ocurre sin ningun aviso.

**Arreglo:** Guardar el id de personal en la cuenta al crearla (options.data: { ..., personalId: nuevo.id }) y, mejor aun, no depender del metadata: resolver el cargo por auth_user_id contra la tabla personal (que ya se guarda en authUserId). Y cambiar el fallo por defecto en cargoDeCuenta: si hay sesion y no se puede identificar la fila de personal, tratarla como '__desconocido__' (sin permisos) y reservar el null/titular para quien este en la tabla titulares, igual que ya hace es_titular() en la base de datos.

---

### Se paga la suscripcion en Stripe y la cuenta sigue bloqueada: nadie recoge la vuelta del pago

**Dónde:** `src/lib/pagoSuscripcion.ts:91` · *Permisos, cargos y suscripcion*

**Cómo falla:** 1) Se configuran las claves y los precios de Stripe, con lo que stripeConfigurado() pasa a true. 2) La hermandad pulsa 'Suscribirse a Web + Gestion' en la pantalla de suscripcion, va a Stripe, mete la tarjeta y paga. 3) Stripe la devuelve a /app?suscripcion=ok (pagoSuscripcion.ts:91). 4) Nadie lee ese parametro: no hay ningun useSearchParams en AppShell ni en ninguna pantalla del panel que mire 'suscripcion', no hay funcion de webhook (en supabase/functions solo estan crear-suscripcion y enviar-correo) y no existe ninguna tabla de suscripciones. 5) AppShell vuelve a llamar a getSuscripcion(), que lee el localStorage (vacio), ve activa=false y muestra otra vez el muro de pago. 6) Si vuelve a pulsar el boton, se abre otra sesion de Stripe y puede pagar por segunda vez.

**Por qué importa:** La hermandad paga y no recibe el servicio, y la pantalla la invita a pagar de nuevo. Es dinero cobrado sin contrapartida, con doble cargo posible y sin ningun mensaje que explique nada; ademas Gobergo no tiene forma de saber quien esta al corriente de pago, porque el estado de la suscripcion no existe en el servidor.

**Arreglo:** Guardar la suscripcion en la base de datos (tabla suscripciones con hermandad_id, pack, periodo, estado, vigencia) escrita por un webhook de Stripe (checkout.session.completed / customer.subscription.updated / deleted) usando el client_reference_id que ya se manda. La aplicacion debe leer la suscripcion de ahi, y al volver con ?suscripcion=ok mostrar 'confirmando el pago' y refrescar hasta que el webhook la marque activa.

---

### La suscripcion vive en el localStorage de cada navegador: cualquiera se activa el pack que quiera

**Dónde:** `src/lib/suscripcion.ts:120` · *Permisos, cargos y suscripcion*

**Cómo falla:** 1) La hermandad contrata el pack 'Web' (9 EUR) desde el ordenador del Hermano Mayor: saveSuscripcion escribe { activa: true, pack: 'web' } en el localStorage de ESE navegador. 2) La secretaria entra con su cuenta desde su portatil: su localStorage no tiene la clave cabildo-suscripcion, getSuscripcion devuelve SUSCRIPCION_INICIAL y AppShell.tsx:235 le planta el muro de pago aunque la hermandad este al corriente. 3) Como stripeConfigurado() es false mientras no haya precios (que es el estado actual), pulsa 'Suscribirse' con el pack 'Todo' seleccionado y se activa sola, gratis, con gestion, web y premium. 4) Aunque Stripe estuviera conectado, basta con abrir la consola y escribir localStorage.setItem('cabildo-suscripcion', JSON.stringify({activa:true,pack:'todo'})) para abrir todo el panel: no hay ninguna comprobacion en servidor.

**Por qué importa:** El muro de suscripcion, que es el unico control de cobro del producto, se salta con un clic o con una linea en la consola, y a la vez castiga a quien si ha pagado (cada persona de la junta y cada dispositivo se encuentra el muro por separado, y borrar los datos del navegador 'cancela' la suscripcion). Un pack de solo web acaba abriendo la gestion completa sin pagarla.

**Arreglo:** Que el estado de la suscripcion venga del servidor (tabla suscripciones por hermandad, leida con RLS y escrita solo por el webhook de Stripe) y usar el localStorage unicamente como cache. Las capacidades del pack tienen que comprobarse tambien en la base de datos (por ejemplo, exigir capacidad 'gestion' en las politicas de escritura de las tablas de gestion), no solo en el menu de React.

---

### Los permisos por cargo no se guardan nunca en la base de datos y vuelven a los de fabrica en otro navegador

**Dónde:** `src/lib/db/permisos.ts:30` · *Permisos, cargos y suscripcion*

**Cómo falla:** 1) El Hermano Mayor abre Personal y permisos y desmarca 'Hermanos' y 'Cuotas' en la fila de Tesorero/a; pulsa 'Guardar permisos' y sale el mensaje verde 'Permisos guardados'. 2) savePermisosPorCargo escribe el localStorage y llama a guardarPermisosPorCargoRemoto, que hace delete + insert sobre permisos_cargo. La tabla tiene 'primary key (cargo, modulo_id)' sin hermandad_id (schema.sql:281) y multi-hermandad.sql le anade la columna pero NO cambia esa clave, mientras que las filas de fabrica sembradas por el propio schema se quedan con hermandad_id null: el insert choca con ellas por clave duplicada. 3) supabase-js devuelve el error en el objeto de respuesta en vez de lanzarlo, y db/permisos.ts:29-30 no comprueba ningun 'error', asi que el try/catch no salta y nadie se entera. 4) El tesorero entra desde su propio ordenador: fetchPermisosPorCargoRemoto no encuentra filas de su hermandad, devuelve null por el 'data.length === 0' (db/permisos.ts:10) y la aplicacion cae en PERMISOS_POR_DEFECTO del codigo, con Cuotas y Tesoreria concedidas. Lo mismo pasa si la hermandad deja a todos los cargos sin ningun modulo: filas.length es 0, la tabla queda vacia y reaparecen los permisos de fabrica. 5) En la base, modulo_permitido() (rls-endurecer.sql:55) une personal con permisos_cargo sin filtrar por hermandad y, al ser security definer, ve tambien las filas de las demas hermandades: los permisos de escritura los decide una tabla compartida, no lo que cada hermandad configuro.

**Por qué importa:** La hermandad configura sus permisos, ve un mensaje de exito y no se aplica nada fuera del navegador donde los toco: el tesorero al que le quitaron el censo lo sigue viendo desde su equipo. Y con varias hermandades en el mismo Gobergo, lo que una junta decide sobre un cargo afecta a las demas, que es justo lo que el trabajo de aislamiento multi-hermandad pretendia evitar.

**Arreglo:** Cambiar la clave primaria de permisos_cargo a (hermandad_id, cargo, modulo_id), sembrar los permisos de fabrica dentro de crear_hermandad() y anadir el filtro por hermandad en el join de modulo_permitido(). En el cliente, comprobar el 'error' de delete e insert y propagarlo para que 'Permisos guardados' solo aparezca si de verdad se guardo; y distinguir 'la hermandad no tiene fila ninguna' (usar defaults) de 'la hermandad guardo una configuracion vacia' (respetarla), en vez de tratar cero filas como 'no hay datos'.

---

### Si falla la creacion de la cuenta, el nuevo acceso aparece como Activo aunque nadie pueda entrar con el

**Dónde:** `src/pages/app/Personal.tsx:90` · *Permisos, cargos y suscripcion*

**Cómo falla:** 1) Se da de alta a un miembro del personal con un correo que ya existe en Supabase Auth (tipico: se le elimino el acceso hace meses y la cuenta de Auth quedo viva, ver el hallazgo de la baja) o el proyecto tiene la confirmacion de correo con limite de envios y el signUp devuelve error. 2) Personal.tsx:90-91 solo hace console.error: no se muestra ningun mensaje en pantalla. 3) El flujo sigue: setPersonal anade el miembro con authUserId a null y el panel lo lista como 'Activo · Pueden entrar ahora'. 4) La persona intenta entrar con la contrasena que le han dado y no puede (o entra con su contrasena ANTIGUA, la de la cuenta que ya existia, que nadie ha cambiado). 5) Ademas, con authUserId a null, modulo_permitido() no lo reconoce como personal y cualquier escritura suya la rechaza la base de datos.

**Por qué importa:** La hermandad cree que ya tiene dado de alta al nuevo secretario, le pasa unas credenciales que no funcionan, y el contador de 'Activos' de la propia pantalla cuenta accesos que no existen. El unico rastro del fallo esta en la consola del navegador, que nadie mira.

**Arreglo:** Tratar el error del signUp como error del formulario: mostrarlo en el banner que ya existe (setError) con texto claro ('ya hay una cuenta con ese correo'), y no anadir el miembro a la lista si no se pudo crear su cuenta; o marcarlo visiblemente como 'sin acceso creado' con un boton para reintentarlo.

---

## MEDIO (7)

### Cuando el hermano descarga «mis datos» desde su área, las incidencias salen siempre vacías

**Dónde:** `src/lib/rgpd.ts:228` · *Configuracion, copias, archivo y RGPD*

**Cómo falla:** 1) Con Supabase conectado, un hermano entra en su área (sesión de Supabase Auth con user_metadata.tipo = 'hermano') y pulsa «Descargar mis datos». 2) HermanoPortal.tsx:956 llama a recopilarDatosHermano(); sus cuotas y papeletas llegan (hay políticas cuotas_propio_select y papeletas_propio_select), pero la consulta a incidencias choca con la política de supabase/hermano-auth.sql, que en esa tabla exige not auth_es_hermano(). 3) Supabase no devuelve error de permisos, devuelve cero filas: el JSON entregado al hermano lleva siempre "incidencias": []. 4) El mismo hermano, si pide el listado a secretaría, sí lo recibe con sus incidencias, porque desde el panel la consulta la hace personal.

**Por qué importa:** Ese JSON es la respuesta al derecho de acceso, y va incompleto justo en lo que más le puede interesar al hermano (las anotaciones sobre su comportamiento en el cortejo). Además el comentario del propio módulo dice que se consulta la base de datos precisamente «para que el export incluya SIEMPRE los datos reales, sobre todo las incidencias»: la aplicación promete lo contrario de lo que hace, y falla en silencio.

**Arreglo:** O añadir una política que deje a cada hermano leer las incidencias de sus propias papeletas (select usando auth_es_hermano() and papeleta_id in (select id from papeletas where hermano_id = hermano_propio_id())), o servir el export completo desde una función RPC security definer. Y mirar el error de cada consulta: si alguna falla, decírselo al hermano en vez de entregarle un JSON a medias.

---

### Tocar el formulario de Configuración antes de que llegue la ficha de la hermandad borra el IBAN, el logo y la dirección al guardar

**Dónde:** `src/pages/app/Configuracion.tsx:114` · *Configuracion, copias, archivo y RGPD*

**Cómo falla:** 1) Alguien de la junta entra en Gobergo desde un ordenador nuevo (o después de cerrar sesión: ajustarEspejoALaHermandad deja localStorage vacío). 2) Va a Configuración → Datos de la hermandad. El formulario se pinta con la caché local, que está vacía: todos los campos en blanco. 3) Antes de que llegue la respuesta de Supabase escribe algo en cualquier campo, por ejemplo el teléfono. Eso pone tocado = true, y el useEffect de la línea 113-115 deja de aplicar settingsRemotas: cuando la fila real llega (con CIF, dirección, IBAN, Bizum, logo y colores) se descarta y el formulario sigue en blanco. 4) Pulsa «Guardar»: saveHermandadSettings hace un upsert con TODAS las columnas (src/lib/hermandadSettings.ts:483-485), así que la fila de hermandad_settings se queda con nombre_legal, cif, direccion, iban, bizum_telefono, logo_data_url… vacíos. Sale «Guardado correctamente».

**Por qué importa:** De golpe la hermandad pierde su membrete: los recibos y los justificantes salen sin CIF ni dirección, el área del hermano se queda sin logo y sin colores, y —lo más grave— desaparecen el IBAN y el Bizum, con lo que a quien quiera pagar una cuota o una papeleta ya no se le puede decir dónde ingresarla. Nadie recibe ningún aviso: el mensaje que ve quien lo provoca es que se ha guardado bien.

**Arreglo:** No bloquear la llegada de datos con una bandera global: aplicar settingsRemotas campo a campo sobre los que el usuario no haya tocado, o bien no dejar editar (mostrar «cargando…») hasta que la primera respuesta de Supabase haya llegado. Y que useHermandadSettings distinga «todavía no ha llegado» de «llegó vacío», para que nunca se guarde un formulario que en realidad no se ha cargado.

---

### La fecha de cobro de la remesa hace también de filtro: una fecha lejana mete los doce meses del fraccionamiento en un solo cargo

**Dónde:** `src/pages/app/Cuotas.tsx:357` · *El circuito del dinero*

**Cómo falla:** `limiteRemesa` es la propia `fechaRemesa` que el usuario elige como fecha de cobro, y `recibosRemesables` incluye todo recibo con fecha de cobro anterior o igual a ese límite. 1) Se da de alta una cuota mensual a un hermano (periodicidad «Mensual (12 recibos)», 10 €/mes): se crean 12 recibos con cobro en enero, febrero… diciembre. 2) En «Preparar remesa» el tesorero pone como fecha de cobro el 20 de diciembre, porque quiere que el banco lo pase entonces. 3) El listado del panel muestra los 12 recibos del mismo hermano y el XML sale con 12 adeudos de 10 € y `ReqdColltnDt` 2026-12-20. 4) El banco carga los 120 € del año entero de golpe ese día. El mismo efecto, más discreto, aparece cada vez que se adelanta la fecha para dar margen al banco: barre todo lo que venza hasta esa fecha.

**Por qué importa:** Es justo lo contrario de lo que se le prometió al hermano cuando pidió fraccionar. Un cargo de 120 € en la cuenta de quien pidió pagar 10 al mes acaba devuelto por falta de saldo, con su comisión, y el hermano llamando a la casa hermandad. Un campo que el usuario entiende como «cuándo cobra el banco» está decidiendo además «qué recibos entran», y nada en la pantalla lo dice.

**Arreglo:** Separar las dos cosas: un campo «fecha de cobro» (lo que va al XML) y otro «incluir recibos con vencimiento hasta», por defecto hoy o el fin del mes en curso. Y avisar en el panel cuando un mismo hermano aparezca más de una vez en la remesa, que es la señal de que se están juntando mensualidades.

---

### El Estado de Cuentas ignora las categorías propias de la hermandad y las amontona todas en «categoría sin reconocer»

**Dónde:** `src/components/EstadoCuentas.tsx:50` · *El circuito del dinero*

**Cómo falla:** `sumaPorCategoria` reparte contra las constantes fijas `CATEGORIAS_INGRESO` y `CATEGORIAS_GASTO`, pero Tesorería deja elegir la categoría del catálogo configurable de la hermandad (`CLAVES_CATALOGOS.categoriasIngreso/categoriasGasto`, editables en Configuración). 1) La hermandad añade en Configuración las categorías «Banda de música» y «Lotería de Navidad» y quita las que no usa. 2) Registra en Tesorería 3.000 € de gasto en «Banda de música» y 4.500 € de ingreso en «Lotería de Navidad». 3) Genera el Estado de Cuentas del ejercicio. 4) Las 4 partidas de ingresos y las 12 de gastos salen a 0,00 €, y todo el dinero del año aparece en dos únicas líneas tituladas «Movimientos con categoría sin reconocer».

**Por qué importa:** El total cuadra, así que nadie ve un error, pero el desglose por partidas —que es exactamente lo que pide la diócesis y lo único que aporta el documento— desaparece. Y el nombre de la línea, «categoría sin reconocer», en un papel que se entrega firmado, hace pensar que la contabilidad está sin clasificar.

**Arreglo:** Pasarle al componente las listas de categorías de la hermandad (`useLista(CLAVES_CATALOGOS.categoriasIngreso, CATEGORIAS_INGRESO)` y su equivalente de gastos) en vez de usar las constantes, e imprimir una línea por cada categoría real con movimientos. Dejar «sin reconocer» solo para categorías huérfanas de movimientos antiguos.

---

### El recibo de una cuota ya pagada sigue invitando a transferir el dinero

**Dónde:** `src/components/Recibo.tsx:99` · *Eventos, inventario, comunicados e impresos*

**Cómo falla:** 1) Una cuota NO domiciliada (pago en mano o transferencia) se marca como «Pagada» con su fecha de pago. 2) Se imprime el recibo desde Cuotas, o el hermano lo abre en su área (HistorialHermano). 3) En el pie salen a la vez la etiqueta verde «Pagada · 05 feb 2026» y, justo debajo, «Pago manual · puedes transferir a ES47 **** 3456». La condición de la línea 97-101 solo mira `cuota.domiciliada` y `hermandad.iban`, nunca el estado de la cuota.

**Por qué importa:** El recibo es el documento que se entrega en mano como justificante de haber pagado, y está diciendo al hermano dónde ingresar lo que ya ha ingresado. Genera pagos duplicados que luego hay que devolver, y llamadas a tesorería preguntando si el pago llegó o no.

**Arreglo:** Enseñar el bloque de «cómo pagar» solo cuando la cuota no esté cobrada (`cuota.estado !== 'Pagada'`) y, cuando lo esté, sustituirlo por el justificante: «Recibí de {hermano} el importe de {importe} el {fechaPago}».

---

### Si la sesión cambia de usuario sin pasar por «cerrar sesión», no se borra la copia local: el nuevo entra viendo los datos del anterior

**Dónde:** `src/context/AuthContext.tsx:148` · *Multi-hermandad y aislamiento*

**Cómo falla:** 1) hermandadActualId() (src/lib/multiHermandad.ts:39) guarda el id en una variable de módulo y solo se olvida cuando alguien llama a olvidarHermandad(). 2) En AuthContext, olvidarHermandad() solo se llama en dos sitios: dentro de signOut() (línea 335) y en la rama 'if (!session)' de sincronizarSesion (línea 152). Cuando llega una sesión NUEVA de OTRO usuario sin haber pasado por una sesión nula, no se llama. 3) Ocurre así: la secretaria de la hermandad A está dentro del panel en el ordenador de la casa de hermandad. El presidente de la hermandad B abre en ese mismo navegador el enlace de «confirma tu correo» o de «restablecer contraseña» que le ha llegado. Con detectSessionInUrl: true (src/lib/supabase.ts:48) supabase-js canjea el token y dispara onAuthStateChange con la sesión de B, sin emitir antes un SIGNED_OUT. 4) sincronizarSesion llama a enlazarHermandad (línea 192), que hace hermandadActualId(): devuelve la CACHÉ, o sea el id de A. 5) ajustarEspejoALaHermandad(idDeA) ve que localStorage['cabildo-hermandad-espejada'] ya vale el id de A y sale sin borrar nada (src/lib/multiHermandad.ts:174).

**Por qué importa:** El presidente de B entra y la copia local del navegador sigue siendo la de A: los ajustes de A (nombre legal, CIF, IBAN, logo) en pantalla, y el censo, las cuotas y los eventos de A en todas las pantallas que leen la copia local antes de que llegue la consulta. Además filestore.ts:35 sigue devolviendo la carpeta de A, así que sus adjuntos se intentan subir a documentos/<id-de-A>/ y Storage los rechaza con un error que no se entiende. Es justo el escenario del ordenador compartido que este código dice estar cubriendo.

**Arreglo:** En sincronizarSesion, guardar el id de usuario de la sesión anterior y, si cambia (o si session.user.id !== realUser?.id), llamar a olvidarHermandad() ANTES de enlazarHermandad(). Alternativa más robusta: que ajustarEspejoALaHermandad guarde también el auth uid junto al hermandad_id en la marca del espejo, y borre en cuanto uno de los dos no coincida.

---

### Quien anuló su papeleta el año pasado sale al año siguiente como «Por renovar», con sitio guardado y prioridad

**Dónde:** `src/lib/campana.ts:109` · *Papeletas de sitio y cortejo*

**Cómo falla:** 1) Campaña 2026: un hermano tiene papeleta en «Cirio 1º tramo». 2) La secretaría la anula (Papeletas › Anular papeleta, motivo «no llegó a pagar»). anularPapeleta solo cambia el estado a 'Anulada' y CONSERVA el tramoId. 3) Se abre la campaña 2027. 4) En Papeletas ese hermano aparece con estado «Por renovar», la columna «Sitio 2026» dice «Cristo — Cirio 1º tramo» y la ficha ofrece el botón «Renovar Cristo — Cirio 1º tramo». El motivo: renovacionDeHermano busca `sitioAnterior` con `p.anio === campana.anio - 1 && p.tramoId !== null` y no filtra por estado, así que una papeleta anulada cuenta como sitio guardado. 5) Para más lío, participoEnCampana (campana.ts:78) SÍ excluye las anuladas, así que ventanaAbiertaPara le aplica la fecha de apertura de «los que no participaron»: la app le dice a la vez que tiene sitio que renovar y que aún no le toca solicitar.

**Por qué importa:** Un hermano al que se le anuló la papeleta (impago, devolución, cambio de decisión ya cerrado) mantiene la reserva de su puesto y renueva con preferencia sobre hermanos más antiguos que sí lo pidieron en plazo. En una cruz de guía de tres sitios eso es exactamente el conflicto que la hermandad no quiere tener.

**Arreglo:** En renovacionDeHermano, filtrar sitioAnterior igual que participoEnCampana: `p.estado !== 'Anulada' && p.estado !== 'Renuncia'` (y valorar exigir además que llegara a 'Asignada'/'Pagada'/'Entregada'). Así las dos funciones dan la misma respuesta sobre si participó.

---

## BAJO (2)

### Dos altas de enseres a la vez reciben el mismo número de inventario

**Dónde:** `src/pages/app/Inventario.tsx:99` · *Eventos, inventario, comunicados e impresos*

**Cómo falla:** 1) El inventario tiene 10 piezas. 2) El mayordomo abre Inventario en su ordenador y la secretaria en el suyo (los dos ven 10). 3) Él da de alta «Ciriales de plata» → nº 11. 4) Ella, sin recargar (la tabla no se refresca sola: useSupabaseTable solo consulta al montar), da de alta «Faroles del paso» → también nº 11. 5) Las dos filas se guardan en Supabase: la tabla `enseres` (schema.sql:201) no tiene ninguna restricción única sobre `numero`. En la lista aparecen dos piezas distintas con el nº 11 y nadie avisa. El mismo choque ocurre si se dan de alta piezas antes de que termine la carga inicial.

**Por qué importa:** El número de inventario es el que se pega físicamente en la pieza, el que va en la ficha del seguro y el que se usa para localizar un enser en el almacén. Dos piezas con el mismo número obligan a renumerar y reetiquetar a mano, y una reclamación al seguro puede señalar la pieza equivocada.

**Arreglo:** Calcular el número en la base de datos (secuencia por hermandad o `max(numero)+1` dentro del insert) y añadir un índice único `(hermandad_id, numero)`; si el insert choca, reintentar con el siguiente número en vez de guardar el duplicado.

---

### El mensaje que manda un visitante se cuela en el buzón de quien lo envía

**Dónde:** `src/lib/mensajesWeb.ts:169` · *La web publica*

**Cómo falla:** `enviarMensajeWeb`, después de insertar bien el mensaje en Supabase, lo añade además al localStorage del VISITANTE bajo `cabildo-mensajes-web`, que es exactamente la clave del buzón del panel. 1) Alguien del personal de la hermandad A tiene el panel abierto en una pestaña. 2) En otra pestaña abre la web de la hermandad B (o la suya propia) y manda un contacto, un aviso de donativo o una reserva de lotería. 3) `useEscuchaOtrasPestanas` (línea 111) recoge el cambio de localStorage y ese mensaje aparece en el buzón del panel de A como no leído, sumando en el contador de `sinLeer`. Con Supabase configurado desaparece al recargar (la consulta pisa la copia local), pero mientras tanto está ahí y se puede marcar como leído o atendido.

**Por qué importa:** El buzón de la hermandad enseña mensajes que no son suyos y el contador de pendientes miente; alguien puede dar por atendido un aviso de donativo que en realidad era de otra hermandad. Además deja los datos personales del visitante (nombre, correo, teléfono, importe) escritos en su propio navegador sin ninguna necesidad.

**Arreglo:** Guardar la copia local solo cuando NO hay Supabase (modo local, que es el único caso en que el buzón vive en el navegador): mover el `localStorage.setItem` de la línea 169 dentro de la rama `if (!isSupabaseConfigured)`.

---
