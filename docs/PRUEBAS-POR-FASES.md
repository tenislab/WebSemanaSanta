# Probar Gobergo por fases

Dos recorridos: uno como **hermandad** (el panel de gestión) y otro como
**hermano** (su área). Van en el orden en que una hermandad de verdad lo haría,
porque cada fase se apoya en la anterior: sin censo no hay cuotas, sin tramos no
hay papeletas, sin papeletas no hay cortejo.

Cada punto dice **qué hacer** y **qué tienes que ver**. Eso segundo es lo
importante: hacer clic y que no salte un error no prueba nada. Lo que prueba
algo es recargar la página y que siga estando.

---

## Antes de empezar

**1. El SQL.** `supabase/TODO-EN-UNO.sql` entero en Supabase → SQL Editor → RUN.
Va antes de subir la web, siempre.

**2. Comprueba que la base está al día.** Pega `supabase/DIAGNOSTICO.sql`. Si
dice «No rows returned», no falta nada.

**3. Aprende a leer un fallo.** Si algo no se guarda, sale una banda roja arriba
con **«Ver el motivo exacto»**. Ábrela y cópiala: ahí está la causa de verdad, no
en la barra. Sin ese texto, un fallo cuesta tres conversaciones; con él, una.

**LA REGLA DE ORO: recarga.** Casi todo lo que ha fallado este mes fallaba así —
la pantalla decía «guardado», y al recargar no estaba. Después de cada punto
importante, recarga con F5 y mira si sigue.

---

# PARTE A · La hermandad

## Fase 1 — Poner la casa en pie

Sin esto lo demás no tiene dónde agarrarse.

1. **Date de alta** con tu correo. La aplicación crea tu hermandad y te deja de
   titular, sola. No hay que tocar nada en Supabase.
2. **Configuración → Identidad y datos**: nombre legal, CIF, dirección, teléfono,
   correo, logo. *Comprueba:* recarga y sigue todo. El logo tiene que salir
   arriba a la izquierda.
3. **Datos de cobro**: IBAN y teléfono del Bizum. *Comprueba:* que desaparezca el
   aviso rojo de «no se puede pagar».
4. **Configuración → Correo**: pon el remitente. *Comprueba:* que el aviso rojo
   del correo se apague.
5. **Colores de la hermandad**. *Comprueba:* el área del hermano y la web pública
   cambian de color.

## Fase 2 — El censo

1. **Un hermano a mano**: nombre, DNI, fecha de nacimiento, correo, teléfono,
   dirección, IBAN. *Comprueba:* recarga y está.
2. **Su ficha completa**: foto, antigüedad, etiquetas, campos propios. *Comprueba:*
   la foto sobrevive a la recarga.
3. **Importar un censo** desde Excel/CSV (Hermanos → Importar). Prueba a propósito
   con un fichero con una fila mal: tiene que decirte cuál y por qué, no tragarla.
4. **Dar de baja** a uno y **reactivarlo** — con y sin recuperar antigüedad.
   *Comprueba:* un hermano de baja NO sale en el cortejo.
5. **Una solicitud de alta** desde la web pública. *Comprueba:* llega a
   Hermanos → Solicitudes. **Aquí falló todo un mes**: si no llega, mira el motivo
   exacto.
6. **Aprobar la solicitud.** *Comprueba:* se convierte en hermano, con número, y
   le llega el correo de bienvenida con su clave de un solo uso.

## Fase 3 — Quién puede hacer qué

1. **Personal y permisos**: dale un cargo a alguien (Secretaría, Tesorería…).
2. *Comprueba:* entra con esa cuenta y **solo ve lo suyo**. Un tesorero no ve el
   censo entero.
3. **Quítale el cargo.** *Comprueba:* deja de ver el módulo al momento.
4. Intenta **quitarte el cargo a ti mismo** siendo el único titular: tiene que
   avisarte, no dejarte fuera de tu propia hermandad.

## Fase 4 — Montar el cortejo

Esta es la fase que más se lía, así que ve despacio.

1. **Configuración → Cuerpos y tramos**. Crea tus cuerpos (Cristo, Virgen…).
2. **Añade un tramo.** Cada uno es una ficha: qué es (cuerpo, qué se lleva), cómo
   se llena (reparto, cuántos caben, precio), y el día de la salida (hora de
   citación, rol).
3. **Precio general de la papeleta.** *Comprueba:* ábrelo en otro ordenador o en
   otro navegador y tiene que salir el mismo. **Antes no**: cada uno veía el suyo.
4. **Ordena los tramos** con las flechas. El número del círculo es el orden real
   de desfile.
5. **Un tramo por número y otro por solicitud.** *Comprueba:* el de número reparte
   solo en cascada; el de solicitud se lo queda el hermano más antiguo.
6. *Comprueba:* recarga. **Los tramos tienen que seguir ahí.** Esto estuvo roto
   semanas con el visto bueno verde saliendo igual.

## Fase 5 — Papeletas

1. **Emite una en un tramo.** *Comprueba:* aparece en Cortejo ocupando plaza, al
   momento.
2. **Emite una simbólica** (la de quien tiene sitio y no sale). *Comprueba:* NO
   ocupa plaza en el cortejo, y el listado dice «no sale en el cortejo».
3. **Renueva** la del año pasado. *Comprueba:* cobra el precio de ESTE año.
4. **No renovar**: el sitio queda libre para otro.
5. **Anula una.** *Comprueba:* el sitio se libera y, si el tramo daba un rol, el
   rol desaparece del hermano solo.
6. **Cobra una** (Bizum o transferencia). *Comprueba:* el apunte llega solo a
   Tesorería.
7. **Imprime la papeleta** y **escanea su QR** con el móvil: tiene que decir que
   es válida.
8. **Llena un tramo hasta pasarte de aforo.** *Comprueba:* avisa de «excede
   aforo», no lo mete callando.

## Fase 6 — El dinero

1. **Catálogos y cuotas**: conceptos y precios.
2. **Emite las cuotas del año.** *Comprueba:* salen en la ficha de cada hermano.
3. **Cobra una a mano** y **otra desde el área del hermano**.
4. **Genera una remesa SEPA** (está en **Cuotas**, con los recibos domiciliados).
   *Comprueba:* se descarga un `remesa-sepa-….xml`. Ojo: hoy el identificador de
   mandato se sintetiza, así que sirve para probar, **no para presentarlo al
   banco**.
5. **Tesorería**: mete un ingreso y un gasto a mano, concilia.
6. **Informes**: saca el cuadre y compáralo con lo que has metido. Tienen que
   cuadrar; si no, es un fallo de verdad.

## Fase 7 — Vida de hermandad

1. **Eventos y tareas**: crea un culto, uno que se repita, y reparte una tarea.
   *Comprueba:* el que se repite sigue apareciendo el mes siguiente.
2. **Comunicados**: manda uno a todos, y otro **solo a un rol** (los costaleros de
   este año). *Comprueba:* llega solo a quien toca, y queda guardado a quién iba.
3. **Convocatoria de papeletas.** *Comprueba:* llega el correo de verdad. Si no
   llega, el botón NO debe quedarse marcado como enviado.
4. **Archivo documental**: sube un documento y descárgalo.
5. **Inventario**: da de alta un enser con foto.
6. **Deshacer**: borra un tramo, un concepto de cuota o una papeleta y usa el
   **«Deshacer»** que sale abajo. *Comprueba:* vuelve a su sitio, y en el mismo
   orden en que estaba.

## Fase 8 — La web pública

1. **Web pública**: secciones, noticias, titulares, cultos, galería.
2. **Publícala.** *Comprueba:* se ve en `gobergo.com/w/tu-slug` desde el móvil y
   sin sesión.
3. **Comparte el enlace por WhatsApp.** *Comprueba:* la vista previa lleva el
   nombre y el escudo de la hermandad, no el de Gobergo.
4. **Comparte una noticia suelta.** *Comprueba:* sale su titular y su fecha.
5. **Formulario de contacto** desde fuera. *Comprueba:* llega al buzón del panel.
6. **Dominio propio**, si lo tienes.

---

# PARTE B · El hermano

Hazlo **desde el móvil y en otro navegador** (o en incógnito), no en la misma
pestaña donde tienes el panel. Si no, no estás probando lo que ve él.

## Fase 1 — Entrar por primera vez

1. **Abre el correo de bienvenida.** *Comprueba:* trae su clave de un solo uso,
   tipo `KRTM-4829-PXQD`. **No** puede decir que su contraseña es su DNI.
2. **Entra con esa clave.**
3. **Cámbiala.** *Comprueba:* la vieja ya no vale.
4. **Prueba «he olvidado mi contraseña».** *Comprueba:* llega el correo y puedes
   entrar con la nueva.

## Fase 2 — Sus datos

1. **Cambia su teléfono y su dirección.** *Comprueba:* en el panel, la ficha ya lo
   tiene.
2. **Sube su foto.** *Comprueba:* sale en su carné y en su ficha del panel.
3. **Intenta cambiar su número de hermano o su estado.** *Comprueba:* **no puede.**
   Eso es de secretaría, y la base lo revierte aunque se intente por las malas.
4. **Mis datos y privacidad (RGPD)**: descarga sus datos.

## Fase 3 — Su dinero

1. **Ve sus cuotas.** *Comprueba:* coinciden con las del panel.
2. **Paga una.** *Comprueba:* le da su **código de hermano** (tipo `JRR-0001`)
   para el concepto, no una frase larga.
3. **Comunica el pago.** *Comprueba:* en el panel sale como «pago comunicado»,
   pendiente de que tesorería lo confirme.
4. *Comprueba:* tesorería lo confirma y el hermano lo ve al día siguiente.

## Fase 4 — Su papeleta

1. **Solicita su sitio.** *Comprueba:* llega al panel.
2. **Secretaría se la asigna.** *Comprueba:* le llega el aviso de que ya tiene
   sitio.
3. **Paga la papeleta** desde su área.
4. **Su carné**: ábrelo a pantalla completa. *Comprueba:* lleva su código de pago
   y el QR.
5. **Escanea el QR desde otro móvil.** *Comprueba:* dice que es hermano de la casa.

## Fase 5 — Su sitio y su día

1. **Mi tramo**: *comprueba* que sale su tramo y **su hora de citación**. Es la
   pregunta de la semana antes.
2. **Calendario de la hermandad**: los cultos que has creado en el panel.
3. **Avisos**: los comunicados que le has mandado.

## Fase 6 — Su familia

1. **Da de alta a un hijo o hija** desde su área.
2. *Comprueba:* llega a Solicitudes en el panel, **con el padre marcado como
   tutor**. Aquí falló durante semanas.
3. **Apruébala** desde el panel.
4. *Comprueba:* el hijo aparece en «Mi familia», y el padre ve **sus cuotas y su
   papeleta** sin pasar por secretaría.

---

# PARTE C · Lo que solo se ve con dos a la vez

Estas son las que no se pueden probar solo, y son las que más caro salen.

1. **Dos ordenadores, la misma hermandad.** Cambia el precio de la papeleta en uno
   y ábrelo en el otro. Tiene que ser el mismo. *(Esto estuvo mal hasta ayer: el
   precio vivía en el navegador de quien lo escribía.)*
2. **Dos hermandades distintas.** Crea una segunda con otro correo. *Comprueba:*
   desde una **no se ve absolutamente nada** de la otra — ni un hermano, ni una
   cuota, ni una foto.
3. **Una hermandad recién creada, sin nada.** Recorre las quince pantallas.
   *Comprueba:* ninguna se queda en blanco ni dice algo falso como «no hay
   resultados para tu búsqueda» cuando lo que pasa es que no hay nada.
4. **El hermano y el panel abiertos a la vez.** Cambia algo en el panel y
   *comprueba* que el hermano lo ve al recargar.

---

## Cuando algo falle

Apunta tres cosas y con eso basta:

1. **Qué pantalla** y qué estabas haciendo.
2. **Qué esperabas** y qué pasó.
3. **El «Ver el motivo exacto»** de la banda roja, copiado tal cual. Si no hay
   banda roja, abre la consola del navegador (F12) y copia lo que salga en rojo.
