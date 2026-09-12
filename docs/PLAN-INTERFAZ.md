# Plan de fases: arreglos de interfaz y mejoras

Salen de mirar la aplicación de verdad, no de una revisión de diseño en
abstracto. Cada uno está medido contra la pantalla y contra el código, y cada
arreglo se dará por bueno **pintándolo en los dos temas y en móvil** —es la
disciplina de la fase 3 del plan de bugs: el fallo que solo se ve en un contexto
de tres se cuela si miras uno.

Las primeras (**A–D**) son de presentación —colocación, tamaño, cuánto texto se
enseña de golpe— y no tocan lo que la aplicación hace. Las siguientes (**E–I**)
salieron después, mirando más pantallas, y algunas sí cambian comportamiento:
dos esperan una decisión tuya (marcadas), y una (**I**, la web publica tu
dirección personal) es la que antes conviene hacer.

## Estado

Se están haciendo **de la más fácil a la más difícil**, cada una mirada en los
dos temas y en móvil, con su prueba, y rompiendo la prueba a propósito para ver
que salta. Lo hecho:

| Fase | Estado | Dónde |
|---|---|---|
| D — rejilla de campañas | **Hecha** (`04f0430`) | `.objetivos` en `global.css`: columnas de 320–420 px, alineadas a la izquierda; una tarjeta sola ya no queda huérfana. |
| C — cabecera de papeletas | **Hecha** (`b2c2b65`) | Sin campaña, un solo aviso con el botón «Ajustes de campaña»; el bloque de convocatoria solo sale con campaña creada. |
| G — «no me deja emitir» | **Hecha** (`3b8815a`) | No era un fallo: faltaba definir la cuota. Ahora la tabla vacía manda a Configuración → Catálogos y cuotas, y el botón apagado dice por qué. |
| H — precio de línea en la tienda | **Hecha** (`f9ed53d`) | El total ya se calculaba; lo que confundía eran los rótulos. Ahora «Precio/ud.» y «Total» por línea. |
| E — buscar hermano en la aportación | **Hecha** | `HermanoPicker` en el cajón de aportación (busca por nombre o número); texto libre solo si no se elige a nadie, para donantes de fuera. |
| F — pasarse del objetivo | **Hecha, opción B** | Según se escribe la cifra, si se pasa de lo que falta, avisa («le faltan X: con esto se pasa en Y. Se apunta igual»). No rechaza nunca. Aritmética en `loQueSobra`. |
| A — primeros pasos en Inicio | **Hecha** | Plegada es ahora una franja de una línea (67 px en portátil, antes 200): barra fina, «Primeros pasos · 5 de 10», lo siguiente con su botón, y retraer/apartar como enlaces discretos. Las cuatro cifras del día se ven sin bajar, así que **no hace falta bajarla debajo** —sigue arriba, que es lo que quiere una hermandad recién creada, con todo a cero. |
| J — el «tic» del cortejo | **Hecha** | No estaba roto ni repetido: el ✓ entrega la papeleta y cobra en mano al que llega sin pagar. Ahora *Entregada* se pinta aparte de *Confirmada* (pill dorado), el ✓ desaparece de la fila ya entregada, y cada bloque dice lo que hace: arriba la entrega, abajo la asistencia. El cobro en mano sigue intacto y tiene prueba propia. |
| I — el contacto personal en la web | **Hecha** | La web ya **no hereda** dirección, teléfono ni correo de Configuración: publica solo lo escrito en su pestaña de Contacto, y vacío no publica nada. Lo mismo en el pie, en la página de un culto y en los datos que se le dan a Google (donde además ya no se mandan la ciudad ni el código postal de Configuración). El editor ofrece copiar el dato de Configuración de un clic, y entonces queda escrito a la vista —y si parece personal, avisa. Comprobado levantando la web de verdad con datos personales en Configuración: no sale ni uno. |
| B — la ficha del hermano | **Hecha** | Los datos (DNI, cumpleaños, acceso, familia) suben al principio, justo bajo la cabecera; la prosa del certificado y el «¿y si no recuerda la contraseña?» se pliegan en un «¿qué es esto?»; y el formulario de expedir —con el aviso de que nadie figura como Hermano Mayor— aparece al pulsar «Expedir certificado…», que es cuando hace falta. No se ha borrado ninguna explicación. |

**Las diez están hechas.** Cada una mirada en los dos temas y en móvil, con
prueba propia, y rompiendo la prueba a propósito para ver que salta.

---

## Fase A — «¿Por dónde ibais?» ocupa demasiado y tapa lo demás

**Qué se ve.** En Inicio, la tarjeta de primeros pasos ocupa media pantalla, así
que las cuatro tarjetas de datos (Hermanos activos, Cuotas pendientes, Papeletas,
Saldo) y los accesos rápidos quedan por debajo del pliegue. Lo que uno abre
Inicio para ver —los números de hoy— hay que bajar a buscarlo.

**Por qué pasa.** La tarjeta ya tiene un estado «plegada» (`GuiaPrimerosPasos`,
`CLAVE_PLEGADA`), pero incluso plegada enseña el epígrafe, el título grande, «Lleváis
8 de 10», la barra, «Lo siguiente: …» con su botón, y encima «Ver los pasos» y
«Seguir luego». Es un bloque alto para ser un «resumen». Y va **encima** de los
datos, no debajo.

**La idea.**

1. Hacer el estado plegado **de verdad compacto**: una sola franja —barra de
   progreso, «8 de 10» y «Lo siguiente: …» con su botón— en una línea o dos, sin
   el título grande ni el epígrafe.
2. Y valorar **bajarla debajo de las tarjetas de datos**. Los primeros pasos son
   de las primeras semanas; los números son de todos los días. Lo de todos los
   días va primero.

Sin quitar nada: «Ver los pasos» la vuelve a desplegar entera, y «Seguir luego»
sigue apartándola. Solo cambia cuánto ocupa cuando está plegada y dónde se
coloca.

**Hecho cuando.** Con la guía plegada, las cuatro tarjetas de datos se ven sin
bajar, en portátil y en móvil, y la guía sigue pudiéndose desplegar y apartar.

---

## Fase B — La ficha del hermano es un muro de texto

> Esta es la que preguntas: **sí, se puede mejorar, y bastante.**

**Qué se ve.** El cajón de la ficha (HERMANO Nº 33) mezcla los datos con
explicaciones largas metidas en medio: «Participación en la estación de
penitencia» con su párrafo, «Certificado de antigüedad» con dos párrafos de qué
es y a quién acredita, un aviso de que «nadie figura como Hermano Mayor ni
Secretario…», el campo «Para qué lo pide» con otra explicación debajo, y luego
«Entra a su área con su DNI y su contraseña…» con su propio párrafo. Para ver un
dato —el DNI, el cumpleaños— hay que leer por encima medio manual.

**Por qué pasa.** El cajón hace dos trabajos a la vez: es la **ficha** (datos que
se consultan de un vistazo) y es el **manual** (prosa que explica qué es cada
cosa). La prosa está bien escrita, pero puesta ahí fija, siempre, convierte una
ficha en una parrafada.

**La idea.**

1. **Los datos, arriba y compactos.** Nombre, número, DNI, cumpleaños, contacto,
   estado — en rejilla, escaneables. Es lo que se abre la ficha para ver.
2. **Las acciones, agrupadas y con una sola línea de ayuda cada una.** Certificado
   de antigüedad y carné como acciones con su botón y un renglón de qué hacen —no
   dos párrafos. Lo que hoy son párrafos pasa a ser: o una frase de ayuda, o algo
   que se despliega si de verdad hace falta («¿qué es esto?»).
3. **Lo condicional, solo cuando toca.** El aviso de «nadie figura como Hermano
   Mayor…» solo hace falta en el momento de expedir, no siempre.

No se borra ni una explicación: se guarda como ayuda breve o se pliega. La ficha
pasa de leerse a escanearse.

**Hecho cuando.** Al abrir una ficha, los datos del hermano se ven de un vistazo
sin leer prosa, y el certificado y el carné siguen expidiéndose igual. Mirado en
los dos temas y en móvil (el cajón es estrecho en móvil, donde el muro de texto
es peor).

---

## Fase C — Papeletas empieza con demasiado texto

**Qué se ve.** Cuando no hay campaña creada, la cabecera de Papeletas apila: el
párrafo de entrada, un banner amarillo largo («Todavía no hay campaña creada. Las
fechas que se ven abajo son de ejemplo: ponlas en Ajustes de campaña…»), otro
banner de convocatoria («Primero hay que crear la campaña» + «Convocar
papeletas» apagado), y una pastilla de «2 papeletas pendientes de pago». Son tres
o cuatro bloques de texto antes de llegar a los números. Queda recargado.

**Por qué pasa.** Cada aviso es correcto por separado —el código ya tuvo cuidado
de no repetir el mismo mensaje dos veces— pero **juntos** son demasiada
explicación para un estado que se resume en una frase: «aún no habéis creado la
campaña; hacedlo aquí».

**La idea.**

1. Cuando no hay campaña, **un solo aviso** que lo diga y lleve a Ajustes de
   campaña, en vez de dos banners con la misma raíz.
2. Acortar el texto: lo largo («las fechas de abajo son de ejemplo…») puede ser
   media frase.
3. El resto de la pantalla (tarjetas, listado) ya avisa a su modo de que son
   datos de ejemplo, así que la cabecera no tiene que cargar con todo.

Sin cambiar la regla: fuera de plazo no se puede convocar, y eso se sigue
diciendo. Solo se dice **una vez y más corto**.

**Hecho cuando.** Con y sin campaña, la cabecera de Papeletas cabe de un vistazo
y no hay dos banners seguidos diciendo lo mismo. En los dos temas y en móvil.

---

## Fase D — La rejilla de Campañas/Proyectos se ve rara con pocas tarjetas

**Qué se ve.** Con una sola campaña, la tarjeta sale estrecha y pegada a la
izquierda, con un hueco grande a la derecha. Parece que falta algo o que está mal
colocada.

**Por qué pasa.** La rejilla es
`grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))`. Con `auto-fill`,
la rejilla crea todas las columnas que caben (cuatro en un portátil) y deja
**vacías** las que sobran: una tarjeta sola ocupa un cuarto del ancho, arriba a
la izquierda, y el resto es hueco.

**La idea.** Que pocas tarjetas no se vean huérfanas. Opciones a decidir mirándolo:

- `auto-fit` en vez de `auto-fill` colapsa las columnas vacías, pero entonces una
  tarjeta sola se estira a todo el ancho, que es el otro extremo.
- Lo más probable: **un ancho de tarjeta cómodo y fijo**, alineadas a la
  izquierda, de modo que una, dos o tres se vean bien sin estirarse ni quedarse
  enanas.

Es solo CSS de la rejilla `.objetivos` (la comparten campañas y proyectos, así
que se arreglan las dos de una).

**Hecho cuando.** Con una, dos, tres y muchas tarjetas la rejilla se ve
equilibrada, en portátil y en móvil.

---

## Fase E — En una aportación, buscar al hermano

**Qué se pide.** En «Aportación a «juan»», el campo «De quién» es texto libre. Que
se pueda **buscar un hermano** del censo, como en cobrar una cuota o sacar una
papeleta (ya existe `HermanoPicker`).

**La idea.** Sustituir el campo libre por el buscador de hermanos, dejando la
opción de escribir un nombre suelto para quien no es del censo (un donante de
fuera). Enlaza la aportación al hermano, no solo escribe su nombre en el
concepto.

**Hecho cuando.** Al apuntar una aportación se puede elegir un hermano
buscándolo, y también dejar un nombre libre. En los dos temas y en móvil.

---

## Fase F — Tope de la aportación al objetivo — **decisión, no la doy por hecha**

**Qué se pide.** Que no se pueda apuntar más dinero del que falta para el
objetivo; y si se pudiera, que el sobrante vaya a otros proyectos.

**El reparo, y por eso lo dejo en decisión.** Hoy la pantalla trata **pasar del
objetivo como la mejor noticia que puede dar** —está escrito así en el código, y
la barra se para en 100 % pero el número sigue subiendo—. En la vida real no se
le dice a nadie «tu donativo es demasiado generoso, no lo acepto». Topar por «lo
que falta» va en contra de las dos cosas.

Y «el sobrante a otros proyectos» no es un tope: es **repartir un donativo entre
varias campañas**, que es una función nueva y bastante más grande (¿a cuál va el
resto?, ¿lo decide quien apunta?).

**Lo que propongo, para que lo decidas:**

- **Opción A —** dejarlo como está: se puede superar el objetivo, y está bien.
- **Opción B —** al pasarse, **avisar** («esto supera el objetivo en X»), pero
  dejar apuntarlo.
- **Opción C —** el reparto entre proyectos, que es un proyecto aparte.

Mi recomendación es la **B**: se cubre tu preocupación (que no se pase sin querer)
sin rechazar dinero ni construir el reparto. Pero es tuya la decisión.

---

## Fase G — Cuotas: «no me deja emitir el ejercicio entero» — **probablemente no es un fallo**

**Qué pasa.** El botón de emitir la cuota anual a todo el censo está
deshabilitado cuando **no hay un concepto de cuota definido** (nombre e importe).
Y en tu Inicio pone «Lo siguiente: **Decir cuánto se paga de cuota**»: ese paso es
justo definir ese concepto. Hasta que lo hagas, no hay importe que emitir, y por
eso no deja. También se bloquea si ya se emitió este ejercicio o si nadie queda
sin ella.

O sea: casi seguro **no está roto** —falta el paso previo—. Compruébalo tú
primero: **Configuración → Catálogos y cuotas**, pon «Cuota anual» con su
importe, y vuelve a Cuotas.

**Lo que sí falta, y es lo del plan.** Un botón deshabilitado sin decir por qué es
mala interfaz. La idea: que al lado del botón se diga el **motivo** —«falta
definir la cuota anual en Configuración», «ya emitida este ejercicio»— en vez de
dejarlo apagado y mudo. Y de paso confirmar, ejecutándolo, que con el concepto
puesto emite de verdad.

**Hecho cuando.** Con la cuota anual definida, se emite al censo entero; y cuando
no se puede, el botón dice por qué.

---

## Fase H — Tienda: el precio de la línea al cambiar las unidades

**Qué se pide.** Que al poner las unidades, el precio de la línea se calcule con
el precio unitario ya puesto.

**Qué hay hoy.** En la cesta, cada línea tiene UDS y PRECIO. El PRECIO es el
precio **por unidad** (con el descuento aplicado, o el que se ponga a mano), y el
total de la línea ya es unidades × precio. En tu captura: 2 uds × 12 € = 24 €, que
está bien calculado.

**Lo que hay que aclarar contigo.** No tengo claro qué falla exactamente: puede
ser que el rótulo «PRECIO» confunda (parece que podría ser el total y es el
unitario), o que esperes ver el total de la línea recalcularse al teclear las
unidades. Dímelo con un ejemplo —«pongo 3 unidades y espero ver X»— y lo dejo
clavado. La idea probable: dejar clarísimo cuál es unitario y cuál total, y que el
total salte al cambiar las unidades.

**Hecho cuando.** Al cambiar las unidades, el total de la línea se actualiza solo
y se ve sin dudar qué es cada cifra.

---

## Fase I — La web publica tu dirección personal por defecto — **lo primero**

**Qué se ve.** En la web pública, en Contacto, salen **tu** dirección, **tu** móvil
y **tu** gmail. No es un fallo nuevo: es que esos datos están en
**Configuración → Identidad y datos** (fueron ahí al dar de alta la hermandad), y
la web, si no le pones otros, **hereda los de Configuración**. Por eso «sigue
apareciendo»: el aviso que añadimos te lo dice, pero no lo quita.

**Por qué es delicado.** Configuración es interno —sale en los recibos para
identificar legalmente a la hermandad— y puede ser personal. La web es **pública**.
Que una cosa pública herede un dato interno sin que nadie lo elija a propósito es
justo lo que hace que acabe publicado un móvil personal.

**Arreglo inmediato para ti (ahora mismo):** en **Configuración → Identidad y
datos**, pon la dirección, el teléfono y el correo **de la hermandad** (los de la
casa de hermandad, no los tuyos). Eso arregla la web **y** los recibos a la vez.
Si la hermandad no tiene otros, en el editor de la web → Contacto puedes escribir
lo que quieras que salga, y eso manda sobre lo de Configuración.

**El arreglo de fondo (lo del plan):** que la web **no publique por defecto** el
contacto de Configuración. Que Contacto en la web salga solo con lo que se escriba
**a propósito** en su pestaña; vacío, no se publica nada. Así un dato personal no
llega nunca a la web sin que alguien lo haya decidido. Cambia el comportamiento
—una hermandad que quería reusar sus datos tendría que escribirlos— pero es el
lado seguro para una página pública.

**Hecho cuando.** Con los campos de Contacto de la web vacíos, en la web pública
no aparece ningún dato de Configuración; solo sale lo que se escriba a propósito.
Comprobado levantando la web de verdad.

---

## Fase J — Cortejo: el «tic» de arriba parece roto y parece repetido (ni una cosa ni la otra)

**Qué se ve.** En el cajón de un tramo, en modo día de salida, cada hermano del
roster tiene un tic (✓) arriba, y más abajo está «Asistencia · día de salida»
con Asiste / No asiste. Pulsas el tic de arriba y no pasa nada; el de abajo sí.
Parece un control roto y duplicado.

**Qué pasa de verdad —y son dos cosas.**

1. **No son lo mismo.** El tic de arriba es **«marcar la papeleta como entregada»**
   (el pase de lista): al pulsarlo, la papeleta pasa a *Entregada* y, si el
   hermano no había pagado, **le cobra en mano y lo apunta en el libro** —el
   dinero que entra en la puerta el día de la salida. El de abajo es la
   **asistencia** (asiste / no asiste), que es otra cosa. No se pueden borrar sin
   más: el de arriba es el que cobra en la puerta.

2. **El de arriba parece que no funciona porque no se ve que funcione.** El
   distintivo de la fila (el «pill») sale de `estadoDe`, que mete *Pagada* y
   *Entregada* en el mismo saco: las dos se pintan **«Confirmada»**. Así que al
   pulsar el tic, la papeleta pasa de Pagada a Entregada… y el pill sigue
   diciendo «Confirmada». Cero señal de que haya pasado algo. Y en los datos de
   ejemplo ya están pagadas, así que tampoco cobra nada: el clic queda mudo.

**La idea.**

- **Que el tic se note.** Cuando una papeleta queda *Entregada* (pase de lista
  hecho), que la fila lo diga —un pill «Entregada», o el tic marcado— para que
  pulsar tenga respuesta.
- **Que no parezcan lo mismo.** Dejar claro que arriba es **entrega y cobro en la
  puerta** y abajo es **asistencia**: dos rótulos, dos propósitos. Hoy los dos
  son un ✓ verde bajo «día de salida», y por eso se leen como uno repetido.
- Si al mirarlo resulta que la hermandad no distingue «entregada» de «asiste»,
  se puede valorar juntarlas, pero **sin perder el cobro en mano**, que es lo que
  de verdad hace el de arriba.

**Hecho cuando.** Pulsar el tic de arriba cambia algo visible en la fila, y
queda claro —sin explicártelo— que ese tic y el Asiste/No asiste hacen cosas
distintas. En los dos temas y en móvil.

---

## El orden, y por qué

1. **Fase A** (primeros pasos) — es la que tapa lo que más se mira, Inicio.
2. **Fase B** (ficha del hermano) — la que más texto sobra y la que abres más
   veces al día.
3. **Fase C** (cabecera de papeletas) — recargada solo mientras no hay campaña;
   se arregla sola en cuanto se crea, pero el primer día es cuando más se ve.
4. **Fase D** (rejilla) — la más pequeña y la más barata; puro CSS.

Las cuatro primeras (A–D) son de presentación: no cambian lo que la aplicación
hace, solo cuánto enseña de golpe y dónde.

De las nuevas, el orden que recomiendo:

1. **Fase I** (la web publica tu dirección personal) — **la primera**: es un dato
   personal en una página pública. Además tiene arreglo inmediato tuyo mientras
   tanto (poner los datos de la hermandad en Configuración).
2. **Fase E** (buscar hermano en la aportación) — mejora clara y barata.
3. **Fase G** (el motivo del botón de emitir cuotas) — pequeña, y te desbloquea
   ya en cuanto definas la cuota.
4. **Fase J** (el tic del cortejo) — es un «no funciona» de verdad, aunque sea
   de falta de señal, no de lógica rota. Cuando lleguemos al cortejo.
5. **Fase H** (tienda) y **Fase F** (tope del objetivo) — **esperan tu decisión**:
   la H, a que me digas qué esperas ver; la F, a que elijas A, B o C.

Ninguna se da por buena sin verla pintada en los dos temas y en móvil.
