# Plan de fases: F18 en adelante

> **Escrito el 8 de septiembre de 2026, mirando el código y no la memoria.**
> De las tres cosas que se piden aquí, **dos ya están hechas a medias** y una no
> existe. Saberlo cambia el plan entero: lo caro no es lo que falta, es
> descubrir a mitad de camino que lo que dabas por nuevo ya estaba, o al revés.
>
> La regla de `docs/COMO-TRABAJAR.md` sigue en pie: **al cerrar algo que aquí
> aparece como pendiente, se tacha en el mismo commit.**

Continúa la numeración de `docs/HOJA-DE-RUTA.md`, que llega hasta F17.

---

## Resumen, para decidir sin leerlo entero

| Fase | Qué es | Estado de partida | Depende de |
|---|---|---|---|
| **F18** | Comunicados que se mandan solos | **hecho, entero** — ver el apéndice | F15 (dominio) para el correo |
| **F19** | Editor de SEO | **casi**: falta el SEO por página y desplegar `api/w.ts` |  |
| **F20** | La copia, cifrada al descargar | **hecho** — ver el apéndice | nada |
| **F21** | Lo que quedaba de antes | trámites y F15 | el banco, el dominio |
| **F22** | Deuda técnica | — | nada |
| **F23** | Acabado visual | **hecho** — ver el apéndice | nada |

**Cerrado ya:** el freno de la convocatoria fuera de plazo, «Hola {nombre}», el
sesgo de cumpleaños y que lo Programado se mande de verdad. Todo en el apéndice
del final.

**El orden que recomiendo** no es el de la tabla. Está al final, con su motivo.

---

## F18 — Comunicados que se mandan solos

Es lo más grande de las tres y lo que más se nota desde fuera: «felicitar el
cumpleaños a los cuatrocientos hermanos sin que nadie se acuerde».

### Lo que YA hay, y es bastante

No se parte de cero ni de lejos:

| | Dónde |
|---|---|
| Mandar correo de verdad, en tandas de 50 | `supabase/functions/enviar-correo` + `src/lib/correo.ts` |
| Sesgos ricos: estado, cuota, edad, **etiqueta**, cargo, campos a medida | `src/lib/segmentacion.ts` |
| Sesgos guardados con nombre y reutilizables | `SesgoGuardado`, mismo editor en censo y comunicados |
| Buzón del hermano, para cuando el correo no está configurado | `src/lib/avisosCorreo.ts` |
| Saber quién cumple años | `cumpleEsteMes()`, `esSuCumpleHoy()` en `hermanoFicha.ts` |
| Tareas de verdad a su hora | `supabase/tareas-programadas.sql` (`pg_cron`) |

### Lo que falta, que son tres cosas y conviene no mezclarlas

#### F18.1 — «Hola (nombre)»

**No existe.** No hay ni un solo sitio en el código que sustituya nada dentro
del texto de un comunicado: se manda tal cual se escribió, igual para todos.

Lo que hace falta es un puñado de marcas que se reemplacen al enviar, una por
destinatario:

```
Hola {nombre},

Te recordamos que tu cuota de {ejercicio} sigue pendiente.
```

Las que valen la pena, y ninguna más de entrada: `{nombre}` (el de pila, no el
completo — «Hola José Antonio Rivas Delgado» no lo escribe una persona),
`{apellidos}`, `{numero}`, `{hermandad}`, `{ejercicio}`.

**Tres decisiones que hay que tomar antes de escribir una línea**, porque las
tres se pagan caras si se toman mal:

1. **Una marca mal escrita no se manda a medias.** Si alguien pone `{nombe}`,
   lo que NO puede pasar es que salgan cuatrocientos correos diciendo «Hola
   {nombe}». Se avisa al escribir, y se bloquea el envío. Es el mismo criterio
   que `acreedorIncompleto()` con el fichero SEPA: no dejar generar algo que va
   a salir mal, en vez de generarlo y que falle en casa de otro.
2. **Qué pasa cuando el dato no está.** Hay hermanos sin fecha de nacimiento y
   los habrá sin apellidos. «Hola ,» es peor que no personalizar. Hace falta un
   valor de reserva por marca, y que la vista previa lo enseñe.
3. **La vista previa se ve con UN hermano de verdad**, elegido del sesgo. Una
   vista previa con `{nombre}` en crudo no es una vista previa.

Es la pieza **más barata y la que más se nota**. Y no depende de nada: no
necesita `pg_cron`, ni dominio, ni tocar la base más que para guardar el texto,
que ya se guarda.

#### F18.2 — Que lo «Programado» se mande de verdad

**Esto es un fallo vivo, no una mejora.** Un comunicado se puede marcar como
`Programado`, se le pone fecha, la pantalla lo cuenta en su recuadro… **y no lo
manda nadie, nunca.** Se queda ahí para siempre.

Comprobado: el estado existe en `src/data/comunicados.ts`, la fecha se guarda
(`comunicados.fecha_programada`, que el diagnóstico ya vigila), la pantalla lo
enseña — y no hay una sola línea en el proyecto que lea esas filas para
enviarlas. La única mención en `supabase/tareas-programadas.sql` es la que
explica por qué **no** está ahí:

> «Para escribir un correo desde la base de datos hay que guardar en ella la
> clave del servicio de envío, y una clave dentro de la base es una clave que se
> lleva cualquiera que consiga leerla. […] Cuando haga falta programarlos, se
> hace con una Edge Function y su secreto, no con esto.»

O sea que la decisión ya está tomada y escrita. Lo que falta es hacerla:

- Una función de Supabase (`enviar-lo-programado`) que busque los comunicados
  vencidos y los mande. La clave del proveedor vive ahí, como en
  `enviar-correo`.
- `pg_cron` la llama cada hora. Nada más: la extensión ya se usa.
- **Y una marca de «ya enviado» que aguante que la llamen dos veces.** Es lo
  único delicado de toda la fase: si la tarea se solapa consigo misma, o si
  falla a mitad y se reintenta, cuatrocientas personas reciben el mismo correo
  dos veces. Se resuelve con el mismo truco que las remesas —`cuotas.remesada_el`
  marca lo que ya viajó para que no entre dos veces— y por el mismo motivo.

Es la pieza **más urgente de las tres**, porque hoy la aplicación promete algo
que no cumple y no lo dice.

#### F18.3 — Reglas que se repiten (cumpleaños y compañía)

Aquí es donde está la petición de verdad: «que felicite los cumpleaños solo».

Una **regla** es un sesgo + una plantilla + un cuándo:

| Regla | Sesgo | Cuándo |
|---|---|---|
| Felicitar el cumpleaños | quien cumple hoy | todos los días |
| Aniversario de hermano | quien entró un día como hoy | todos los días |
| Recordar el ensayo | etiqueta «costalero» | el día antes de cada ensayo |
| Convocar a la junta | cargo = cualquiera | antes de cada cabildo |

**Falta una cosa en el sesgo, y es concreta:** `CriteriosSegmento` NO sabe de
cumpleaños. Sabe de edad («mayores», «menores») pero no de «cumple hoy». Lo que
sí sabe es el censo, en su propia pantalla, con otro filtro aparte. Así que hoy
un comunicado **no se puede dirigir a quien cumple años**, ni a mano.

Es el primer paso de F18.3 y es pequeño: añadir `cumpleanos: 'Todos' | 'Hoy' |
'EsteMes'` a los criterios y enchufarlo a `cumpleEsteMes()`, que ya existe.
Con eso solo, una secretaria ya puede mandar la felicitación a mano el día que
quiera, aunque no haya llegado la automatización.

**Y una decisión que no es técnica:** una regla que se dispara sola manda
correos en nombre de la hermandad sin que nadie los lea antes. Eso está bien
para «feliz cumpleaños» y está mal para casi todo lo demás. Mi propuesta: las
reglas nacen **apagadas y con un aviso** en Notificaciones el primer día que
tocarían, para que alguien las vea funcionar antes de dejarlas sueltas.

#### Y las redes sociales: lo que se puede y lo que no

Conviene decirlo claro porque la petición mete «redes sociales» en la misma
frase que el correo, **y no se parecen en nada**.

Hoy hay algo, y está bien pensado: `encargos-redes.sql` reparte el trabajo —una
persona escribe el post, otra lo sube a Facebook, otra a Instagram— y cada una
lo ve en su área. **Lo publica una persona.**

Publicar **automáticamente** en Facebook o Instagram no es programar un envío:
es entrar en la API de Meta, que exige una cuenta de empresa, una aplicación
revisada por ellos y una verificación del negocio que tarda semanas y hay que
renovar. Y los permisos se caen solos cada cierto tiempo, con lo cual la
hermandad se queda sin publicar y sin enterarse.

**Recomendación: no entrar ahí ahora.** Lo que sí cabe en F18, y cuesta poco,
es que una regla que se dispara **cree el encargo de redes** en vez de publicar:
llega el día del cumpleaños del titular, y a quien lleva Instagram le aparece la
tarea con el texto ya escrito. Se gana casi todo el valor sin depender de Meta.

---

## F19 — El editor de SEO

**Aquí hay bastante más de lo que parece,** y por eso esta fase es la más barata
de las tres.

### Lo que ya hay

Desde el editor de la web, pestaña **«Al compartir»**, se edita ya el título, la
descripción y la imagen con que sale el enlace. Y sin tocar nada, a Google le
llega el título y la descripción de la hermandad, la dirección buena de cada
página, el escudo, el idioma, y **datos estructurados de verdad**: la hermandad
como `Organization`, su sede como `Place` y **cada culto como `Event`** con su
fecha y su hora. El `sitemap.xml` y el `robots.txt` se descargan hechos.

Está todo contado en `docs/SEO.md`.

### Lo que falta

1. **Encender la parte del servidor, que ya está escrita.** Es lo que hace que
   la vista previa de WhatsApp diga el nombre de la hermandad y no «Gobergo —
   Software para gestionar tu hermandad». `api/w.ts` y `api/seo.ts` existen y
   están probados; falta desplegarlos. **Es lo primero y es media tarde.**

2. **SEO por página.** Hoy la descripción es una, para toda la web. Una
   hermandad con página de Historia, de Cultos y de Hermandad quiere que cada
   una diga lo suyo — y es lo que hace que Google las enseñe por separado.

3. **Que el editor enseñe lo que va a pasar.** Un contador de caracteres con la
   línea donde Google corta (unos 60 el título, 155 la descripción), y la
   tarjeta tal como se verá en Google y en WhatsApp, con la imagen. Hoy se
   escribe a ciegas.

4. **Avisos de lo que de verdad rompe el posicionamiento**, y solo de eso: la
   web sin publicar, dos páginas con el mismo título, fotos sin texto
   alternativo, la descripción vacía. No una lista de cien reproches: eso ya
   pasó una vez con los avisos de la web y hubo que convertirlos en una barra
   de progreso.

> **Lo que no voy a prometer:** ningún editor «sube en Google». Lo que hace es
> que la web esté bien puesta y se comparta bien. Quien diga otra cosa está
> vendiendo humo.

---

## F20 — La copia de seguridad, cifrada

De las tres, **la única que no existe en absoluto**. No hay una sola línea de
cifrado en el proyecto.

### Por qué importa aquí más que en otros sitios

`src/lib/backup.ts` descarga **un archivo JSON con todo**: las cuatrocientas
fichas con su DNI, su dirección, su teléfono, su fecha de nacimiento, sus
cuotas y sus IBAN. En claro. Ese archivo acaba en el escritorio de la
secretaria, en un pendrive, en un adjunto de correo o en el WhatsApp de la
junta — que es exactamente lo que la gente hace con un archivo de copia.

Es el dato más sensible que maneja la aplicación y el único que sale de ella
sin ninguna protección.

### Cómo se hace

Con `crypto.subtle`, que ya trae el navegador: no hace falta ninguna
dependencia nueva (el webhook de Stripe ya lo usa para verificar firmas). La
hermandad pone una contraseña al descargar y la pide al restaurar.

### La decisión que hay que tomar con los ojos abiertos

**Una copia cifrada cuya contraseña se pierde es una copia que ya no existe.**
No hay «recuperar contraseña» que valga: si lo hubiera, el cifrado no serviría
de nada. Y el censo es justo el dato que no se puede volver a escribir.

O sea que esto **cambia una amenaza por otra**: hoy el riesgo es que la copia
acabe donde no debe; con cifrado obligatorio, el riesgo es quedarse fuera de la
propia copia. Las dos son reales y la segunda pasa más a menudo.

**Mi propuesta**, y aquí quiero que decidas tú:

- **Cifrar por defecto, con la opción de no hacerlo** marcada como lo que es.
- Al poner la contraseña, decirlo con todas las letras —«si la pierdes, esta
  copia no la abre nadie, tampoco nosotros»— y **obligar a escribirla dos
  veces**.
- **Comprobar que descifra ANTES de dar el archivo por bueno.** Cifrar, volver a
  abrir en memoria y comparar. Una copia que no se puede abrir es peor que
  ninguna, porque se cree que se tiene.
- **Y la copia automática semanal se queda sin cifrar**, a propósito. Esa vive
  en el cubo de Supabase de la propia hermandad, protegida por sus permisos, y
  la lanza sola la aplicación: no hay ninguna persona a quien pedirle una
  contraseña a las tres de la mañana. Cifrarla obligaría a guardar la clave al
  lado de los datos, que es no cifrar nada con pasos de más.

---

## F21 — Lo que ya venía de antes

Nada de esto es nuevo. Está aquí para que el plan sea el plan entero y no la
mitad bonita.

| | Estado | De quién depende |
|---|---|---|
| **Identificador de acreedor SEPA** | trámite | **de la hermandad y su banco**. Es gratis, tarda, y sin él no se presenta una remesa. Que lo pidan ya. |
| **F15 — correo de verdad** | falta el dominio verificado | de la hermandad. Hasta que exista, los avisos van dentro de la aplicación, que es lo fiable hoy. |
| **Canal piloto** | hecho, sin encender | nuestro. `canal-de-actualizacion.sql` está puesto; falta usarlo con una hermandad. |
| **Aviso por correo de `errores_cliente`** | falta | nuestro, y depende de F15. Hoy los fallos se recogen y nadie los mira. |
| **Manual de uso** | falta | nuestro. |

> **F15 es el cuello de botella de medio plan.** F18 entero, el aviso de errores
> y las reglas automáticas dependen de poder mandar un correo que no acabe en
> spam. Y eso no es código: es verificar un dominio.

---

## F22 — Deuda técnica

No se ve desde fuera y por eso no se hace nunca. Dos cosas concretas:

- **`WebPublica.tsx` tiene 4.573 líneas.** Es, con diferencia, el fichero más
  grande del proyecto, y es justo donde hay que meter F19. Partirlo **antes** de
  tocarlo sale más barato que después.
- ~~**Restaurar una copia no es atómico.**~~ **Mitigado.** Atómico del todo no
  puede ser sin mandarle megas al servidor, y eso no cambia. Lo que sí se ha
  cerrado es el agujero de verdad: **ahora se comprueba que la copia encaja
  ANTES de vaciar**. Antes, una copia hecha con la base al día y volcada en un
  proyecto atrasado —el estado normal durante semanas— vaciaba las tablas y
  luego Postgres rechazaba los `insert` uno a uno: la hermandad se quedaba con
  menos datos que antes de «restaurar», con la red de seguridad convertida en la
  causa de la pérdida. Ver el apéndice.
- **Cola de escritura sin conexión.** El caso real es el Viernes Santo: el
  diputado de tramo marca asistencia en la calle, sin cobertura. Hoy eso se
  pierde.

---

## F23 — Acabado visual: los desplegables sin vestir

Se ve en la tabla de Personal: la casilla del cargo es **el desplegable de
fábrica del navegador** —borde negro fino, flecha del sistema, esquinas
cuadradas— al lado de una tabla que no tiene ni un borde negro.

No es un despiste puntual, es cómo está montada la hoja de estilos. **No existe
una regla base para `select`**: el estilo se le pone por contextos —`.form-row
select`, `.assign-box select`, `.banner-inline select`, `.masiva select`…— así
que un desplegable que aparece en un sitio nuevo nace **sin vestir**, y solo se
nota cuando alguien se para a mirar esa pantalla.

Es el mismo patrón que ya costó caro dos veces en este proyecto: algo que se
resuelve caso por caso acaba teniendo un caso que nadie resolvió. La forma de
que no se repita no es arreglar este desplegable, es **darle un estilo base a
`select`** —el mismo alto, borde, radio y foco que los `input`— para que el
siguiente nazca bien puesto.

Lo que entra:

- Estilo base para `select`, `input` y `textarea`, con su estado de foco visible
  y su flecha propia. Los estilos por contexto que ya existen siguen mandando
  encima; esto solo pone el suelo.
- Repasar los sitios donde un control aparece **dentro de una tabla**, que son
  los que se han quedado fuera: es un sitio raro para un control y por eso nadie
  escribió su regla.
- Que funcione en tema claro y oscuro, y con el color de cada hermandad.

Es de las cosas más baratas del documento y de las que más cambian la sensación
de «esto está terminado».

---

## El orden que recomiendo, y por qué no es el de la tabla

1. ~~**F18.2 — que lo «Programado» se mande.**~~ **Hecho.**

2. ~~**F18.1 — «Hola (nombre)».**~~ **Hecho.**

3. **F19.1 — encender el SEO del servidor.** Es lo único que queda que no
   depende de escribir código: `api/w.ts` y `api/seo.ts` están escritos y
   probados, hay que **desplegarlos**. Media tarde, y arregla que la vista
   previa de WhatsApp diga «Gobergo — Software para gestionar tu hermandad».

4. ~~**F20 — la copia cifrada.**~~ **Hecho.**

5. ~~**F18.3 — las reglas que se repiten.**~~ **Hecho.**

6. ~~**F23 — los desplegables.**~~ **Hecho.**

7. **F19 — el resto del editor de SEO**, después de partir `WebPublica.tsx`.

Y una que no lleva número: **no se despliega nada entre el 1 de marzo y el
Domingo de Resurrección.** Es la semana en que la aplicación de verdad importa y
en la que un fallo no se puede arreglar con calma. Lo que no esté para el 28 de
febrero, espera a después.

---

## Apéndice: lo que se cerró el mismo día que se escribió esto

### No se puede convocar papeletas fuera de plazo — **hecho**

Era un fallo vivo, no una mejora. El botón **«Convocar papeletas»** —el que
manda a todos los hermanos con correo el aviso más importante del año— **no
miraba ni una fecha**. Se podía pulsar en agosto.

Y lo que sale es un correo que dice «ya está abierto el plazo» y «tienes de
plazo hasta el {fecha}». Fuera de temporada, eso son dos mentiras con dos
destrozos distintos:

- **Antes de abrir**: ochocientas personas entran a sacar su papeleta y el área
  del hermano —que sí mira las fechas, con `ventanaAbiertaPara()`— les dice que
  no pueden. Ochocientas personas convencidas de que esto está roto, y
  secretaría cogiendo el teléfono toda la semana.
- **Después de la fecha límite**: el correo anuncia como plazo un día que ya
  pasó. Quien lo lea deprisa cree que aún llega. Y ese hermano salió el año
  pasado: su sitio está a punto de repartirse.

Ahora `sePuedeConvocar()` (en `src/lib/campana.ts`) decide, y se comprueba en
los dos sitios: el botón se apaga **y** la función se planta si la llaman por
otro lado — un botón desactivado sobrevive a una pestaña abierta desde ayer,
un correo a ochocientas personas no sobrevive a nada.

Es un **bloqueo y no un aviso**, por el mismo criterio que `acreedorIncompleto()`
con el fichero SEPA: no dejar generar algo que va a salir mal en casa de otro.
Y no hay «convocar de todas formas»: si una hermandad necesita convocar hoy es
que sus fechas de campaña no son las que dice tener, y esas mismas fechas son
las que van a decidir quién pierde su sitio. Por eso el mensaje dice a dónde ir
a cambiarlas.

La apertura que cuenta es la de los **renovadores** (la primera de las dos): en
cuanto alguien puede sacar su papeleta, el correo dice verdad para ese alguien.
Con la otra se perderían diecinueve días de plazo justo para los que tienen
sitio que perder.

---

### «Hola {nombre}» — **hecho** (F18.1)

No existía nada. Ahora el texto puede llevar `{nombre}`, `{nombrecompleto}`,
`{numero}`, `{hermandad}` y `{ejercicio}`, se ponen pulsando un botón, y la
vista previa enseña cómo le llegará a una persona de verdad del propio
segmento — que es donde se ven las fichas sin datos.

Lo que gobierna el diseño: **un correo a ochocientas personas no se puede
deshacer.** De ahí:

- **El freno está en tres sitios**, y cada uno tapa un agujero distinto: al
  escribir, al guardar (ni como borrador — un borrador se manda más tarde y
  quizá desde otra pantalla) y **al mandar**, que es el que de verdad importa
  porque un comunicado guardado ayer llega hasta el envío sin pasar por los
  otros dos.
- **Un dato vacío usa su reserva.** «Hola ,» es peor que no personalizar. La de
  `{nombre}` es «hermano/a», sin suponerle el género a nadie.
- **El censo importado de un Excel.** «RIVAS DELGADO, JOSÉ ANTONIO» daría «Hola
  RIVAS»; en mayúsculas daría «Hola JOSÉ», que grita. Con coma el nombre va
  detrás, y las mayúsculas enteras se rebajan — pero lo bien escrito no se toca:
  normalizar a lo bruto convierte «McCarthy» en «Mccarthy».
- **Con marcas ya no hay un cuerpo, hay ochocientos.** Van en fila (en paralelo
  es la forma más rápida de que el proveedor te tome por spam), uno que falla no
  para a los demás pero se cuenta, y hay freno de emergencia: si fallan los diez
  primeros y no ha salido ninguno, es el proveedor y no las direcciones.

### El sesgo de cumpleaños — **hecho** (F18.3a)

Ya se puede dirigir un comunicado a quien cumple años **hoy** o **este mes**.
Antes no se podía ni a mano: la aplicación sabía quién cumple, pero solo en la
pantalla del censo.

Y de paso, **el 29 de febrero**: quien nació ese día no cumplía nunca. Con la
felicitación a mano pasaba desapercibido; con un correo automático sería la
única persona de la hermandad a la que no se felicita jamás. En los años que no
son bisiestos cumple el 28.

### Que lo «Programado» se mande — **hecho** (F18.2)

Era un fallo vivo: se podía programar, se guardaba la fecha, la pantalla lo
contaba en su recuadro, **y no lo mandaba nadie, nunca.**

**Lo manda el navegador, no un servidor, y es la decisión de fondo.** Lo obvio
sería `pg_cron` + una función de Supabase. El problema es quién son los
destinatarios: eso lo decide `filtrarSegmento()`, que sabe de estados, cuotas
sacadas de los recibos de verdad, edades, etiquetas, cargos efectivos, campos a
medida y cumpleaños. Reescribir todo eso en SQL serían **dos versiones de la
misma regla**, y la segunda siempre se queda atrás — es literalmente el fallo
que dejó a media junta sin recibir la convocatoria durante meses.

Hay precedente y funciona: la copia semanal se hace igual desde
`copiaAutomatica.ts`.

**Lo que se pierde, dicho claro:** sale al abrir **Comunicados** (que es donde
está cargado el censo), así que un comunicado programado para el martes a las
nueve puede salir el martes a las once. Por eso el numerito del menú se enciende
cuando hay uno vencido: para que alguien entre. Antes salía **nunca**.

**Y sale una sola vez.** Si la secretaria y el tesorero abren el panel a la vez,
sin candado los dos lo mandan y ochocientas personas reciben la convocatoria por
duplicado. Eso no se arregla en el navegador —dos navegadores no se ven— sino en
la base: `reclamar_comunicado_programado()` es un *compare and swap*, la
condición de estar libre va **dentro** del `update`. Preguntar primero y
actualizar después no valdría: entre la pregunta y la respuesta cabe el otro.

Con sus tres frenos: el candado caduca a la media hora (una pestaña cerrada a
mitad no puede bloquear la convocatoria para siempre), **tres intentos y para**
(un bucle que manda correo es peor que un comunicado sin mandar), y un tope de
diez por vuelta como cinturón.

**Lo que queda de F18.2**, si algún día se quiere puntualidad de reloj: llevar
la resolución del segmento a la base sin duplicarla, y entonces `pg_cron`. El
candado ya está puesto y no habría que tocarlo.

### Los controles sin vestir — **hecho** (F23)

**No existía una regla base para `select`, `input` ni `textarea`.** El estilo se
ponía por contextos, y eso funciona mientras todos los controles vivan en uno de
ellos: el día que aparece uno en un sitio nuevo —una celda de tabla— nace con el
borde negro y la flecha del sistema. Y no canta lo bastante como para que nadie
lo reporte: canta lo justo para que la pantalla parezca descuidada.

Ahora hay suelo: mismo borde, radio, alto y foco que el resto, con flecha propia
en los dos temas. **Va con selector de elemento y sin `!important`**, así que
todas las reglas de contexto siguen mandando encima — esto añade suelo, no
sustituye nada. Y las casillas, los radios, el selector de color y el deslizador
quedan fuera uno a uno: un `padding` puesto a un `checkbox` lo convierte en un
cuadrado gris sin marca.

Comprobado renderizando la tabla de Personal en Chromium, antes y después, en
claro y en oscuro.

### La copia cifrada — **hecho** (F20)

Se descarga cifrada con contraseña (AES-GCM 256, PBKDF2-SHA256 con 310.000
vueltas, `crypto.subtle` — ni una dependencia nueva), y al restaurar se
reconoce y se pide.

**La decisión, tal como se propuso y se ha hecho:**

- **Se recomienda, no se obliga.** Una copia cifrada cuya contraseña se pierde
  es una copia que ya no existe, y el censo es justo el dato que no se puede
  volver a escribir. Esto cambia una amenaza por otra y la segunda pasa más a
  menudo, así que la puerta de «descargar sin cifrar» sigue abierta y marcada
  como lo que es.
- **Se avisa antes de decidir, no en la letra pequeña:** «si se pierde, esta
  copia no la abre nadie — tampoco nosotros».
- **La contraseña se pide dos veces.** Es lo que más veces va a salvar a
  alguien: una errata no se descubre al descargar —el archivo sale igual de
  bien— sino el día que hace falta abrirlo.
- **Se comprueba que descifra antes de dar el archivo por bueno.** Cuesta medio
  segundo y descarta de golpe una familia entera de fallos sin haberlos
  previsto uno a uno. Misma idea que `copiaAutomatica.ts` negándose a subir una
  copia coja.
- **La copia automática semanal se queda sin cifrar**, a propósito y con una
  prueba que lo deja escrito: vive en el cubo de la propia hermandad y la lanza
  sola la aplicación a las tres de la mañana, cuando no hay nadie a quien
  pedirle una contraseña. Cifrarla obligaría a guardar la clave al lado de los
  datos.

Y dos detalles que importan más de lo que parecen: se reconoce **por su marca y
no por la extensión** (quien renombre el archivo se encontraría con «esto no es
una copia de Gobergo», que es mentira), y una contraseña equivocada se dice por
su nombre —«el archivo está bien, vuelve a intentarlo»— en vez de «archivo no
válido», que haría dar la copia por perdida cuando basta con volver a teclear.

### La revisión de SEO — **hecho** (F19.3 y F19.4)

Del editor había más de lo que este documento le reconocía: título,
descripción, imagen, tarjeta de vista previa, `sitemap.xml`, `robots.txt` y
datos estructurados con cada culto como `Event`. Lo que faltaba era saber **si
está bien puesto**: se rellenaba a ciegas y no había forma de enterarse hasta
que alguien pegaba el enlace en un grupo y salía en gris.

Ahora hay una **Revisión** que dice qué falla y **qué hacer** en cada caso, y un
contador en el título — lo tenía la descripción y no el título, que es
justamente el campo que más se corta.

**Son seis avisos y ni uno más, a propósito.** Una lista larga de reproches no
la lee nadie: ya pasó en esta misma pantalla, donde los avisos de la web eran
una retahíla y hubo que convertirlos en una barra de progreso. Solo entra lo que
cambia algo de verdad para quien busca la hermandad o comparte el enlace — nada
de densidad de palabras clave. Hay una prueba que sujeta ese tope, para que el
día que alguien añada el séptimo tenga que justificarlo.

Y **puede quedarse callada**: una revisión que siempre encuentra algo es una
revisión que se deja de mirar. Cuando está todo, lo dice — sin prometer salir el
primero en Google, que es lo que haría dejar de fiarse de todo lo demás.

**Lo que queda de F19:** el SEO por página (cada página con su descripción) es
un cambio del modelo de datos dentro de `WebPublica.tsx`, que tiene 4.573 líneas
— y este mismo documento dice que hay que partirlo antes de tocarlo (F22). Y
desplegar `api/w.ts`, que no es código.

### Las reglas que se disparan solas — **hecho** (F18.3)

Ya se felicita el cumpleaños sin que nadie se acuerde. Una **regla** es un sesgo
+ un texto + un cuándo (todos los días, o el día 1 de cada mes), y vienen dos
escritas: «Felicitar el cumpleaños» y «Felicitación del mes».

**Lo que una regla NO hace es mandar correo**, y es la decisión de todo el
diseño. Cuando le toca, escribe un comunicado programado para hoy y ahí acaba su
trabajo: lo manda el camino de siempre, que ya tiene el candado, los tres
intentos, el «Hola {nombre}» y el freno de las marcas mal escritas. Si mandara
por su cuenta habría dos caminos que hacen lo mismo, y el segundo se iría
quedando atrás — el fallo que este proyecto ha repetido más veces.

**Nacen apagadas**, tal como se propuso: una regla encendida escribe a
ochocientas personas en nombre de la hermandad sin que nadie lea el texto antes.
Se ve **a cuánta gente alcanzaría hoy** y el texto entero sin abrir nada, y se
enciende cuando se ha visto. Y las de fábrica se ofrecen, no se crean solas: una
hermandad que se encuentra dos reglas que no ha puesto se pregunta qué más hay
hecho a sus espaldas.

**Y no se felicita tres veces.** Si la secretaria, el tesorero y el hermano mayor
abren el panel la misma mañana, sin candado los tres crean su comunicado. Mismo
*compare and swap* que el envío programado, probado contra Postgres de verdad.

Los días que no cumple nadie —que son casi todos— no se crea nada: un comunicado
a cero personas por día llenaría la lista hasta enterrar los de verdad.

### Que la copia encaje antes de vaciar — **hecho** (parte de F22)

Restaurar vacía y luego llena, y eso no se puede evitar desde el navegador: para
que fuera atómico habría que mandarle el archivo entero al servidor, y pesa
megas.

Lo que sí se ha cerrado es el agujero que había dentro de esa ventana: **si las
filas no encajaban, se descubría después de haber vaciado.** Y no es un caso
rebuscado, es *el* caso — la base la actualiza cada hermandad a mano pegando
`ACTUALIZAR.sql`, así que «aplicación nueva, base vieja» es el estado normal
durante días o semanas. Una copia del martes volcada el jueves en un proyecto
atrasado: tablas vacías, `insert` rechazados uno a uno, y menos datos que antes
de empezar.

Ahora se pregunta primero, mandando **solo los nombres de las columnas** (unos
cientos de bytes, no el archivo), y si algo no encaja no se toca nada y se dice
qué falta y que hay que pegar `ACTUALIZAR.sql`.

Dos decisiones que cuesta pensar y quedan escritas: **si no se puede preguntar,
se deja pasar** —una base que no tiene ni esa función es exactamente una base
atrasada, y bloquear dejaría sin restaurar a quien más lo necesita; lo que
protege ahí es la copia de resguardo, que no es opcional— y **una tabla que
falta entera se ignora**, porque de eso ya avisa `DIAGNOSTICO.sql` con más
detalle y aquí solo enterraría el aviso que sirve.
