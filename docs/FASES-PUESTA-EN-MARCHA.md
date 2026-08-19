# Fases P — De la demostración a la hermandad de verdad

Las fases **F** (gestión), **W** (web pública) y **H** (área del hermano) están
hechas. Lo que queda es distinto: no son funciones nuevas, es lo que hace falta
para que una hermandad real **empiece a usar Cabildo un lunes por la mañana**
con sus mil hermanos dentro, cobrando de verdad y mandando correos de verdad.

Este documento sale de una revisión del código, no de una idea: cada fase dice
**qué hay hoy exactamente** y **qué falta**.

---

## Principio transversal: nada se esconde, se avisa en rojo

Cuando algo no funciona porque falta configurarlo (no hay pasarela, no hay
proveedor de correo, no hay Supabase), **el botón se queda donde está** con una
advertencia roja que dice qué falta y quién lo arregla. No se oculta.

Esconder lo que no funciona tiene dos problemas: la hermandad no descubre nunca
que existe, y quien lo configura no sabe qué le falta. Un aviso rojo enseña las
dos cosas.

Hoy esto se hace **a medias**: hay avisos en el editor de la web y en el pago
del hermano, pero cada uno con su formato. La fase **P0** lo unifica.

| Fase | Qué entra | ¿Depende de un tercero? |
|------|-----------|--------------------------|
| **P0** | Aviso rojo unificado de «esto falta por configurar» | No |
| **P1** | Traer el censo que ya tienen (importar) | No |
| **P2** | Las bajas y las solicitudes se ven | No |
| **P3** | La ficha del hermano completa (foto incluida) | No |
| **P4** | Alta de hermandad en condiciones | No |
| **P5** | La papeleta en el móvil, no un documento enorme | No |
| **P6** | Roles automáticos según la papeleta | No |
| **P7** | Correo de verdad | **Sí** (proveedor de envío) |
| **P8** | Cobrar de verdad (Bizum y/o Stripe) | **Sí** (banco o Stripe) |
| **P9** | Dominio propio, guiado y comprobado | **Sí** (registrador + DNS) |
| **P10** | Repasar todo y terminar lo que se quedó a medias | No |

**P1–P6 se pueden hacer hoy, sin depender de nadie.** P7, P8 y P9 necesitan que
la hermandad contrate algo a su nombre; lo que sí se puede hacer sin ellos es
dejar el hueco listo y avisar en rojo de lo que falta.

---

## P0 — Aviso rojo unificado

**Hoy:** cada sitio avisa a su manera. En el editor de la web hay `cms-avisos`,
en el pago del hermano un párrafo, en Donativos un `banner-inline--warn`.

**Qué entra:**

- Un solo componente de aviso, en rojo, con tres partes fijas: **qué no
  funciona**, **por qué**, y **quién lo arregla y dónde**.
- Un registro único de «capacidades» (`correo`, `pasarela`, `dominio`,
  `supabase`) que dice si cada una está configurada. Cada botón que dependa de
  una consulta ese registro en vez de comprobarlo por su cuenta.
- El botón **no se desactiva**: se pulsa, y lo que sale es la explicación de qué
  hay que contratar o configurar.

---

## P1 — Traer el censo que ya tienen

**Hoy:** `src/lib/csv.ts` solo tiene `toCsv` y `descargarArchivo`. **Se exporta,
no se importa.** No hay ninguna forma de meter un censo existente.

Esto es, con diferencia, **lo más urgente de toda la lista**: sin ello, adoptar
Cabildo significa teclear mil fichas a mano, y ninguna hermandad va a hacer eso.

**Qué entra:**

- Subir **CSV o Excel** (la mayoría tienen un Excel, no una base de datos).
- **Emparejar columnas a mano**: la hermandad dice qué columna suya es el
  nombre, cuál el DNI, cuál la antigüedad. Nunca adivinar y quedarse tan ancho.
- **Ensayo antes de tocar nada**: se enseña qué se va a crear, qué se va a
  actualizar y qué filas están mal, y solo entonces se confirma. Importar mil
  hermanos mal y no poder deshacerlo es un desastre del que no se sale.
- **Duplicados por DNI**: se detectan y se decide si actualizar o saltar.
- **Informe al terminar**: cuántos entraron, cuántos se saltaron y por qué, con
  las filas problemáticas descargables para corregirlas y volver a subirlas.
- Lo mismo, después, para **cuotas históricas** y **papeletas de años
  anteriores**: sin histórico, la antigüedad en el cortejo no vale.

---

## P2 — Las bajas y las solicitudes se ven

**Hoy — y esto es un fallo de verdad:** cuando un hermano pide la baja desde su
área, se guarda bien (`bajaSolicitada`) y **el panel lo enseña**… pero solo
dentro de la ficha de ese hermano, y dentro de un desplegable «Administración»
que está cerrado. No hay lista de bajas pendientes, ni contador en la tabla, ni
aviso en el Inicio.

Es decir: **la solicitud llega y no se entera nadie**, salvo que alguien abra
por casualidad la ficha de ese hermano y despliegue esa sección.

**Qué entra:**

- Aviso en el **Inicio**: «N hermanos han pedido la baja», con enlace.
- **Filtro y marca en la tabla** de Hermanos, igual que se hizo con «avisan que
  han pagado» en Cuotas.
- **Panel de bajas pendientes**, como el de solicitudes de alta, con el motivo
  si lo escribieron y la fecha.
- Al tramitarla, **avisar al hermano** (ya se hace) y que quede la fecha.
- Repasar el resto del circuito con la misma lupa: cambio de datos pedido por el
  hermano, renuncia a la papeleta, solicitud de tramo. Todo lo que el hermano
  puede pedir tiene que **aparecer en el Inicio**, no solo guardarse.

---

## P3 — La ficha del hermano completa

**Hoy:** `Hermano` no tiene **foto**. Ni la hermandad puede ponerla ni el
hermano puede subirla.

**Qué entra:**

- **Foto del hermano**, subida por él desde su área o por secretaría. Con
  recorte cuadrado y compresión (el mismo camino que ya usan las fotos de la
  web), y con el aviso de peso si se pasan.
- Sale en su carné digital (H6), en su ficha y en el listado del cortejo, que es
  donde de verdad hace falta: el diputado de tramo busca caras, no números.
- **Consentimiento explícito** para la foto, separado del resto: es un dato
  personal y la hermandad tiene que poder demostrar que se dio permiso.
- Datos que hoy faltan y piden todas las hermandades: **fecha de bautismo y
  parroquia** (hace falta para el expediente), **profesión**, **si es costalero,
  acólito o música** (hoy son etiquetas sueltas), **talla de túnica**,
  **alergias o movilidad** para el día de la salida.

### Sobre la renumeración y la antigüedad

Preguntas si funciona solo. Lo he comprobado:

- **La numeración, sí.** Al dar de baja, el número queda libre y **todos los de
  número mayor descienden uno**. Está en `darDeBaja`, y se relee la lista dentro
  del `setState` para que no se pise con otra pestaña.
- **La antigüedad, no se toca — y está bien así.** La antigüedad es **el año en
  que entró**, no una posición: no cambia porque se dé de baja otro. Lo que
  cambia es el número, que es la posición en el escalafón.
- **Pero hay un fallo:** al **reactivar** a un hermano de baja, se le da el
  **último número libre**, o sea que pierde toda su antigüedad en el escalafón.
  En una hermandad, quien se reincorpora normalmente **recupera su sitio**. Hay
  que decidirlo con la hermandad y ofrecer las dos opciones al reactivar:
  «vuelve al final» o «recupera su antigüedad» (y entonces los demás bajan).
  Esto entra en P2.

---

## P4 — Alta de hermandad en condiciones

**Hoy:** al crear la hermandad solo se pide **nombre de la hermandad, tu nombre,
correo y contraseña**. Todo lo demás (CIF, dirección, IBAN, colores, escudo) hay
que ir a buscarlo a Configuración, y si no se hace, media aplicación sale con
huecos: los recibos sin CIF, los documentos sin escudo, la web sin dirección.

**Qué entra — un alta por pasos, no un formulario largo:**

1. **Quién eres**: nombre, correo, contraseña, y **tu cargo** en la hermandad.
2. **La hermandad**: nombre legal completo, CIF, dirección, población,
   provincia, teléfono y correo de secretaría.
3. **Lo canónico**: parroquia o sede, año de fundación, día de salida.
4. **Dinero**: IBAN, identificador de acreedor SEPA (hace falta para las
   remesas), Bizum si lo tienen.
5. **Imagen**: escudo y color.
6. **Y entonces**: «¿traes un censo?» → **directo a la importación de P1**.

Cada paso se puede **saltar**, y lo que se salta queda como tarea pendiente en
el Inicio con su aviso, no desaparece. Al final, una pantalla que dice qué está
listo y qué falta.

---

## P5 — La papeleta en el móvil, no un documento enorme

**Hoy — tienes razón:** en el área del hermano la papeleta se pinta con
`PapeletaModeloRender`, que es **el documento de imprimir a tamaño real**,
metido dentro de la página. En un móvil es un ladrillo que hay que ampliar para
leer.

**Qué entra:**

- En pantalla, una **tarjeta**: tramo, puesto, hora de salida, importe y el QR.
  Legible de un vistazo, sin ampliar.
- El **documento completo solo al imprimir o descargar**, que es cuando hace
  falta. Ya existe el sistema de impresión (`.print-doc`), es cuestión de
  aplicarlo aquí.
- **Añadir al monedero del móvil** (Apple Wallet / Google Wallet) como paso
  siguiente: es donde de verdad acaba una entrada hoy.

### Y el pago desde ahí

**Hoy ya existe** el aviso de pago de la papeleta por Bizum o transferencia
(`PagoPapeleta` en el portal), igual que se hizo con las cuotas en H3.

**Lo que pides y falta:**

- Que al pagar **se marque en pagado automáticamente**. Esto solo se puede hacer
  de verdad **con pasarela** (P8): con Bizum no hay forma de que la aplicación
  se entere sola de que el dinero entró, porque el banco no se lo cuenta a
  nadie. Con Bizum, lo honrado es lo que hay hoy: el hermano avisa y la
  tesorería confirma al ver el extracto — **y eso es exactamente «que salte a la
  hermandad para que revise las cuentas»**, que es lo que pides.
- Que **si da error se diga y se pueda reintentar**: eso sí se hace ya en el
  formulario, y con pasarela se hará con el error real que devuelva.

---

## P6 — Roles automáticos según la papeleta

**Hoy:** las etiquetas del hermano (costalero, acólito, diputado de tramo…)
existen y son un catálogo configurable, pero **se ponen a mano**. Nada las
relaciona con la papeleta que saca.

**Qué entra:**

- Cada **tramo u opción de papeleta** puede llevar asociada una etiqueta: el
  tramo «Costaleros paso de misterio» → etiqueta *Costalero*; la opción
  «Acólito ciriales» → *Acólito*.
- Al **asignar** la papeleta, la etiqueta se pone sola, con el año.
- Al **anular o renunciar**, se quita.
- Sirve para lo que de verdad se usa: mandar un comunicado solo a los costaleros
  de este año, sacar la lista de acólitos, contar cuántos nazarenos van por
  tramo. La segmentación de comunicados **ya lee etiquetas**, así que esto se
  enchufa a lo que hay.
- **Un rol de papeleta no da permisos en el panel.** Los permisos siguen siendo
  de `personal` por cargo. Mezclar las dos cosas sería un agujero: un costalero
  no puede acabar viendo la tesorería porque sacó una papeleta.

---

## P7 — Correo de verdad

**Hoy:** los avisos al hermano son un **buzón dentro de la aplicación**. No sale
ni un correo. Está así a propósito y documentado, pero significa que si el
hermano no entra, no se entera.

**Cómo se hace, en concreto:**

1. La hermandad contrata un **proveedor de envío transaccional** (Resend,
   SendGrid o Amazon SES). Son baratos y algunos tienen plan gratuito para el
   volumen de una hermandad.
2. Se **verifica el dominio** de la hermandad ante el proveedor: hay que añadir
   unos registros DNS (**SPF**, **DKIM** y **DMARC**) donde tengan el dominio.
   Sin esto, los correos van a spam o se rechazan directamente — no es opcional.
3. La clave del proveedor **no puede vivir en el navegador**: cualquiera la
   sacaría del código y mandaría correo en nombre de la hermandad. Va en una
   **función de servidor** (Edge Function de Supabase), y la aplicación le pide
   a esa función que envíe.
4. En Cabildo: **Configuración → Correo**, con el estado de verificación, un
   **correo de prueba**, y la lista de qué avisos salen por correo y cuáles solo
   al buzón (que el hermano ya elige en H4).
5. **Registro de envíos**: qué se mandó, a quién, si llegó y si rebotó. Sin eso,
   «no me llegó nada» no se puede resolver.

Mientras no esté: el buzón sigue funcionando y **el aviso rojo de P0** dice que
el correo no está configurado.

---

## P8 — Cobrar de verdad

Preguntas si será **Bizum o Stripe**. No son alternativas: **hacen cosas
distintas** y lo suyo es tener las dos.

### Bizum (lo que ya hay)

El hermano paga desde su aplicación del banco al teléfono de la hermandad. **La
aplicación no puede enterarse sola**: el banco no avisa a nadie. Por eso lo que
hay es lo correcto — el hermano avisa, y **le salta a la hermandad para que
revise las cuentas**, que es literalmente lo que pides. Ventaja: cero comisión y
todo el mundo lo tiene. Inconveniente: alguien tiene que mirar el extracto.

### Stripe (lo que falta)

Pago con tarjeta dentro de la web o del área del hermano. Ventajas: **se marca
en pagado solo**, con la fecha y el justificante, sin que nadie mire nada. Y
Stripe **también admite Bizum** como método en España, con lo cual se puede
tener el Bizum *automático*. Inconvenientes: **comisión por cobro** (en torno al
1,5 % + 0,25 € en tarjeta europea), y la hermandad tiene que **darse de alta
ella**, con su CIF y su cuenta: el dinero va a su cuenta, nunca a la nuestra.

### Decisión tomada: de momento, en rojo

**No se monta la pasarela todavía.** Lo que entra ahora es dejar el hueco
**marcado en rojo** en todos los sitios donde se cobra —cuota, papeleta,
donativo y lotería— diciendo que falta conectarla, con el aviso de P0: qué
falta, por qué, y que la contrata la hermandad a su nombre.

Mientras tanto sigue funcionando el circuito de Bizum, que es lo que ya usan:
el hermano avisa y a la tesorería le salta para revisar las cuentas.

**Qué entra cuando se conecte:**

- **Configuración → Cobros**: elegir Bizum manual, Stripe, o las dos.
- Con Stripe: pagar cuota, papeleta, donativo y lotería con tarjeta.
- **La marca de pagado la pone el servidor, no el navegador.** Esto es lo
  importante y es donde se cuelan los fraudes: si el navegador dice «ya he
  pagado» y la aplicación se lo cree, cualquiera se hace una papeleta gratis. Lo
  correcto es que **Stripe avise al servidor** (un *webhook*), el servidor
  compruebe la firma de ese aviso, y **entonces** marque la cuota o la papeleta
  como pagada. Va en una Edge Function.
- **Si falla**: se dice qué pasó (tarjeta rechazada, fondos, caducada), la
  cuota **se queda sin pagar**, y se puede reintentar. Nunca dejar un pago «a
  medias» sin decir en qué estado quedó.
- **Conciliación**: cada cobro entra en Tesorería con su referencia, para que
  cuadre con el extracto sin teclear nada.

---

## P9 — Dominio propio, guiado y comprobado

Preguntas cómo lo pondrán. El reparto de trabajo es este:

**Lo que hace la hermandad (fuera de Cabildo):**

1. **Compra el dominio** en un registrador — IONOS, GoDaddy, Namecheap,
   Dinahosting… Unos 10–15 € al año para un `.es` o un `.org`.
2. En el panel de despliegue (**Vercel → Settings → Domains**) añade el dominio.
3. Vercel le dice **qué registro DNS poner**: normalmente un **A** apuntando a
   su IP para el dominio pelado, y un **CNAME** para el `www`. Eso se pone en el
   panel del registrador donde compraron el dominio.
4. En unos minutos (a veces unas horas, por cómo se propaga el DNS) el dominio
   ya sirve la web, **con certificado HTTPS que Vercel emite solo**.

**Lo que hace Cabildo (ya hecho en W9/W10):** guardar el dominio, enseñar estas
instrucciones, y **usarlo** en el enlace que se comparte, en el `sitemap.xml` y
en el `robots.txt`.

**Lo que falta y entra en P9:**

- **Comprobar de verdad** que el dominio apunta aquí, en vez de fiarse de que lo
  escribieron bien: un botón «Comprobar» que consulte y diga **«resuelve
  correctamente»**, **«todavía no ha propagado»** o **«apunta a otro sitio»**.
- **Validar la forma** de lo que escriben (hoy se acepta cualquier cosa).
- Avisar de que sin `www` configurado, media España escribirá `www.` y no
  llegará.
- Y el mismo sitio para los **registros de correo** de P7, que se ponen en el
  mismo panel del registrador: tiene sentido explicarlo una vez y junto.

---

## P10 — Repasar todo y terminar lo que se quedó a medias

Después de F, W, H y las P, hay cosas que se dejaron a medias **a propósito**
(porque dependían de otra fase) y cosas que se quedaron a medias **sin querer**.
Las primeras están documentadas; las segundas son las que hay que encontrar.

Esta fase no añade funciones: **cierra**. Y no va solo al final — conviene
pasarla también al terminar cada bloque.

### Cómo se repasa (el método, no la corazonada)

1. **Peinar el código buscando promesas a medias**: los `TODO`, los «por
   ahora», los «llegará cuando», los `ComingSoon`, los botones sin `onClick`,
   los estados que se guardan y no se leen en ningún sitio.
2. **Seguir cada circuito de punta a punta**, no cada pantalla. Lo que se rompe
   no es una pantalla, es el trayecto: el hermano pide algo → ¿se guarda? →
   ¿lo ve la hermandad? → ¿puede resolverlo? → ¿se entera el hermano?
   Justo así apareció el fallo de las bajas: guardado sí, visible no.
3. **Comprobar que cada dato del modelo se usa**. Un campo que se escribe y no
   se lee en ninguna pantalla es una promesa rota esperando a que alguien la
   descubra.
4. **Recorrerlo todo en un móvil de 390 px** y con el teclado, sin ratón.
5. **Volver a leer cada `docs/*.md`** y comprobar que lo que dicen sigue siendo
   verdad. Una documentación que promete de más es peor que no tenerla.

### Lo que ya se sabe que está a medias

Esto no hay que buscarlo, ya está localizado:

- **Las fotos se guardan dentro del contenido** como `data:` en vez de en un
  almacén. Por eso la tarjeta al compartir la web sale sin imagen. Viene
  pendiente de W6 y W9.
- **El correo no sale de la aplicación**: los avisos son un buzón interno (P7).
- **No hay pasarela de cobro**: se paga fuera y alguien confirma (P8).
- **La reactivación de un hermano de baja** le da el último número y le hace
  perder el escalafón (P2).
- **`ComingSoon`**: hay que revisar qué sigue apuntando ahí y si aún tiene
  sentido.
- **Los avisos de «falta configurar»** están cada uno con su formato; los
  unifica P0.

### Cómo termina la fase

Con un **informe honrado**: qué se cerró, qué se decidió dejar y por qué. Lo que
se deje sin hacer se queda **marcado en rojo dentro de la aplicación**, no
escondido y no solo anotado en un documento que no lee nadie.

---

## Apéndice — ¿SQLite en local antes de Supabase?

**Respuesta corta: no hace falta, y además no encaja. Y ya tienes las dos cosas
que buscas.**

### Por qué SQLite no encaja aquí

Cabildo es una aplicación **que corre entera en el navegador**. SQLite es un
fichero en un disco: en el navegador no hay disco. Se puede meter SQLite
compilado a WebAssembly, sí, pero entonces hay que **reescribir toda la capa de
datos** para hablar SQL en vez de la API de Supabase, mantener dos capas en
paralelo, y al final tendrías una base de datos que **solo existe en ese
ordenador y en ese navegador**: no la comparten ni dos personas de la misma
junta. Mucho trabajo para algo que no resuelve el problema.

### Lo que ya tienes para probar en local

**El modo local, que es con lo que se ha desarrollado todo.** Sin claves en el
`.env`, la aplicación guarda en el navegador y funciona entera: censo, cuotas,
papeletas, web, área del hermano. Es el modo con el que se ha probado cada fase
de esta lista. Para enseñársela a una junta, para que la toquen sin miedo, o
para desarrollar, es **lo más cómodo que hay**: cero instalación.

Su límite: **son los datos de ese navegador**. No se comparten, y si se borran
los datos del navegador, se van.

### Si quieres una base de datos de verdad, en tu ordenador

Entonces lo correcto **no es SQLite, es Supabase en local**. La propia Supabase
tiene una herramienta que levanta **el stack entero en tu máquina** (Postgres,
la API y el panel) con Docker:

```
supabase start
```

Te da una URL local y una clave, y **las pones en el `.env` igual que las de la
nube**. A partir de ahí:

- **No se cambia ni una línea de código.** La aplicación no sabe si habla con tu
  ordenador o con la nube.
- **Los mismos ficheros SQL** de `supabase/` valen tal cual.
- Puedes romper, borrar y recrear la base sin miedo, porque no hay nadie más.
- Y el día que pases a la nube, ejecutas los mismos SQL y ya está.

### Entonces, ¿cuál usar?

| Para… | Usa |
|---|---|
| Desarrollar y probar deprisa | **Modo local** (sin claves). Ya funciona |
| Enseñarla a una junta sin instalar nada | **Modo local** |
| Probar de verdad los permisos, las remesas, los correos | **Supabase en local** (`supabase start`) |
| La hermandad usándola con sus hermanos | **Supabase en la nube** |

**Y para «conectar una base de datos que ya tengan»** —que es lo que preguntabas
en realidad— el camino no es SQLite: es **exportar lo que tengan a CSV o Excel**
(desde Access, desde un programa antiguo, desde su hoja de cálculo) **y meterlo
por la importación de P1**. Es lo que va a hacer una hermandad de verdad, porque
lo que tienen no es una base de datos: es un Excel.

---

## En qué orden, y por qué

1. **P1 (importar)** primero. Sin esto no hay adopción posible: nadie teclea mil
   fichas. Es lo que convierte «una demostración muy bonita» en «lo estamos
   usando».
2. **P2 (bajas y solicitudes)** justo después, porque es un **fallo**, no una
   función que falte: la hermandad ya puede recibir solicitudes que no ve nadie.
3. **P0 (avisos rojos)** en paralelo, es pequeño y lo aprovechan todas las demás.
4. **P4 (alta)** y **P3 (ficha con foto)**: lo que se nota el primer día.
5. **P5** y **P6**: mejoras del día a día una vez están dentro.
6. **P7 (correo)** y **P8 (cobros)** cuando la hermandad decida contratar. Son
   las dos que **no dependen de nosotros**, y las dos que más cambian su vida:
   el correo quita las llamadas, y la pasarela quita el mirar el extracto.
7. **P9 (dominio)** cuando vayan a publicar la web de cara al público.
8. **P10 (repasar)** al final de cada bloque, no solo al terminar todo. Es la
   que impide que se acumule lo que se quedó a medio hacer.

---

## Lo que sigue sin poder hacerse, y hay que decirlo

- **Cobrar nosotros por la hermandad.** El dinero tiene que ir a una cuenta
  suya. Nosotros ponemos el camino, no la caja.
- **Enterarse de un Bizum automáticamente.** No existe forma. O pasarela, o
  alguien mira el extracto.
- **Las fotos dentro del contenido.** Siguen guardándose como `data:` en vez de
  en un almacén, y por eso la tarjeta al compartir sale sin imagen. Viene
  pendiente de W6/W9 y **sigue pendiente después de P3**: P3 añadió la foto del
  hermano (comprimida y recortada, unos pocos kB), pero no cambió dónde viven.
  Es lo primero de la lista de lo que queda.
