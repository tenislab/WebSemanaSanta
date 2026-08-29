# Qué lleva esta entrega

Trece bloques, todos probados: `tsc`, `lint`, `build` y **4.100 pruebas** que
pasan con y sin zona horaria de Madrid. El SQL se instala sobre un Postgres de
verdad, no solo se lee.

**El bloque 12 es urgente** — es un fallo que ya está pasando ahora mismo en
una hermandad real. Hay que ejecutar `ACTUALIZAR.sql` en cuanto se pueda.

---

## 1. La introducción de datos, capada

Lo que pediste: «hay que revisar la introducción de datos y caparlo, por
ejemplo que en el DNI solo se puedan poner 9 números y una letra».

**El DNI son 8 números y una letra** (`12345678Z`), no 9 — nueve es lo que
ocupa el documento entero contando la letra. Y hacía falta contemplar también
el **NIE** (`X1234567L`), que en una hermandad los hay.

**No se valida contando caracteres, sino comprobando la letra**, que sale de
dividir el número entre 23. Contando caracteres, `12345679Z` pasaría — y ese
es justo el error que se comete al copiar de un papel.

Además, con la misma regla en todas las pantallas:

- **Teléfono**, y el del **Bizum** aparte: Bizum solo funciona con móviles
  españoles, así que un fijo perfectamente válido ahí no funciona jamás.
- **NIF de la hermandad**, que va en todas las facturas de la tienda.
- **Identificador de acreedor SEPA**: si está mal, el banco no devuelve unos
  recibos, **tumba la remesa entera**.
- **Código postal**, con el cero de delante.
- **IBAN** en los tres sitios donde se tecleaba sin comprobarlo: Configuración,
  el alta de hermandad, y la cuenta de donativos de la web.

Tres cosas que aparecieron por el camino:

- **Los datos de la demo no pasaban sus propias comprobaciones.** El CIF, el
  IBAN y el identificador estaban inventados a ojo y los tres eran inválidos.
  Quien abriera la demo se habría encontrado tres avisos rojos nada más entrar.
- **«Sin datos» se pintaba dentro del campo del teléfono** en el área del
  hermano. Había que borrarlo para escribir el suyo, y muchos escribían detrás.
- **La web pública tenía su propia regla de teléfono**, más floja. Dos reglas
  para el mismo dato significa que la web acepta lo que la ficha rechaza.

Se valida **al teclear, nunca al importar**: un censo de hace quince años trae
erratas, y rechazar la importación dejaría fuera a gente de verdad.

---

## 2. Campañas y proyectos

Lo de Víctor: «que las campañas sean recolecciones de dinero con una barra
hasta que se llegue al objetivo, y los proyectos que sean como tareas pero a
largo plazo».

**Lo recaudado no se guarda: se cuenta desde Tesorería.** No hay ninguna
columna «recaudado». La barra suma los apuntes del libro que llevan la marca de
la campaña.

Es la respuesta directa a la otra queja del mismo mensaje —«el concepto de
cuota no se pasa a tesorería»—: **si la barra sube, el tesorero lo tiene**,
porque son el mismo dato. Un contador aparte se descuadra en cuanto alguien
corrige un apunte, y entonces hay dos verdades sobre el mismo dinero: la que
enseña la barra y la que dice el libro.

Los gastos de la campaña se restan: enseñar lo bruto como si fuera lo
disponible es mentir sobre cuánto falta.

**Los proyectos no son eventos.** Un evento es un día con cosas que preparar;
un proyecto tiene un final, un responsable, y pasada la fecha **no se archiva
solo** — se queda, y en rojo. Hay un estado «idea» para lo que se habló en un
cabildo y quedó ahí, que si no se pierde entre un acta y la siguiente.

---

## 3. Cuenta de pérdidas y ganancias, con gastos porcentuales

«Al crear informe crear cuenta de pérdidas y ganancias y opción de añadir
gastos porcentuales a los ingresos, gastos, etc. que se pueda enlazar.»

**No sustituye al Estado de Cuentas**: contesta otra pregunta. El Estado de
Cuentas es el papel de la diócesis y cuenta el dinero. Este contesta si la
hermandad se sostiene, y por eso trae el año anterior al lado, el peso de cada
partida sobre el total, y las partidas de mayor a menor en vez de por orden
alfabético — un informe de cuentas se lee por arriba.

**Los gastos porcentuales son dos cosas y están las dos.** La frase admite dos
lecturas y el «a los ingresos, **gastos**, etc.» dice que la regla se engancha a
cualquiera de los dos, así que se elige al crearla:

- **Reparto** — trocear un gasto **real** entre partidas. «La luz: 60 % a la
  casa hermandad, 40 % al almacén.» El dinero ya salió y el total **no cambia**.
- **Compromiso** — apartar un % de lo que entre por una partida. «El 10 % de la
  lotería va a caridad.» Ahí no ha salido dinero todavía.

**Ninguna de las dos escribe un apunte en Tesorería.** Un compromiso no es un
gasto: es dinero que sigue en la cuenta. Apuntarlo rompería dos cosas a la vez —
el saldo dejaría de cuadrar con el banco, y el día que se pague de verdad se
contaría dos veces.

Por eso el informe enseña **siempre las dos cifras** —el resultado del ejercicio
y el de después de compromisos— y el papel dice cuál cuadra con el banco.

---

## 4. La pantalla en blanco del navegador principal

Estaba pasando que en el navegador de siempre se quedaba en blanco y en
privado no. Era un dato guardado con una forma que la aplicación ya no
esperaba: se leía, se le llamaba `.filter` a algo que no era una lista, y la
pantalla entera se caía sin decir nada — en privado no pasaba porque no había
nada guardado.

Ahora se comprueba la forma antes de usarlo, y si algo revienta hay una
pantalla que lo cuenta con el error entero para copiar, en vez de un folio en
blanco. El botón de vaciar borra **solo** lo de la aplicación, nunca el resto.

---

## 5. La tanda de fallos del 28

Seis cosas, y varias resultaron ser **el mismo tipo de fallo**: leer de donde
no era.

**«Registro una papeleta y se borran todos los datos»** — el grave.

RLS **no da error cuando deniega**: devuelve cero filas con `error` a nulo,
indistinguible de una tabla vacía. La aplicación recarga en cada cambio de
sesión, y al refrescarse el token hay un instante en que todas las políticas
deniegan a la vez. El código trataba eso como «no hay nada»: vaciaba la pantalla
**y machacaba la copia local de respaldo**. Eso último es lo peor — destruye la
red de seguridad justo antes de necesitarla, y explica el «se ha solventado pero
faltan datos» de después.

Ahora un cero donde había datos se reintenta antes de darlo por bueno. Si el
segundo intento también viene vacío, se acepta: si alguien borra el censo desde
otro ordenador, este se tiene que enterar.

**«Cerrar sesión no cierra bien»** — había **dos sesiones** en el mismo
navegador y cada «cerrar sesión» limpiaba solo la suya. El panel dejaba puesta
la del área del hermano. Por eso al volver a entrar se iba al área del hermano
en vez de a la de gestión.

En la casa de hermandad es además un problema de verdad: el ordenador lo usan
varios, y el siguiente veía el nombre, las cuotas y la papeleta del anterior.

**«La notificación de papeleta no llega a Notificaciones»** — leía la copia de
*ese* navegador. La solicitud la manda el hermano desde su móvil.

**Y buscando más de lo mismo apareció otro que nadie había reportado**: la
portada del panel contaba **cero altas pendientes** habiendo gente esperando,
por la misma razón. Es la pantalla que se abre por la mañana y su trabajo entero
es que no haga falta ir módulo por módulo.

Como ya iban tres, hay una prueba que vigila **la clase entera**: ninguna
pantalla del panel puede leer de la copia local una colección que llega de
fuera.

**«Asigno tarea a hermano y no llega notificación»** — Eventos no avisaba a
nadie. Ni una llamada en toda la pantalla.

**«No deja asignar hermanos en tareas de redes»** — solo se ofrecía a quien
tuviera cargo, y la razón escrita en el código era falsa: decía que un hermano
sin cargo «no podría verlo porque no entra al panel», cuando la tarea le sale en
su propia área — que es para lo que se hizo el módulo.

**«No deja imprimir factura»** — el botón se quedaba apagado diciendo «Trayendo
los artículos…» para siempre cuando la consulta fallaba. Un fallo se veía igual
que una carga lenta. Ahora se distinguen los tres estados y se puede reintentar.

---

## 6. El correo de contraseña del hermano: `gen_random_bytes`

`pgcrypto` **sí** está instalada en Supabase, pero en el esquema `extensions`.
Nuestras funciones estaban declaradas con `search_path = public`, así que no la
encontraban. El error habla de una función que no existe cuando lo que pasa es
que está en otro sitio.

Arreglado en el SQL. **Las pruebas no lo cazaron porque montaban pgcrypto en
`public`** — o sea, probaban contra una base que no existe en ninguna parte.
Ahora la montan como Supabase, y el fallo se reproduce aquí antes de salir.

---

## 7. Segunda revisión: «no lo sé» no es «no hay nada»

Buscando una clase de fallo distinta apareció otra, y una de las dos hace daño
de verdad.

**El boletín se mandaba a nadie.** La lista de suscriptores devolvía **lista
vacía cuando la consulta fallaba**. De esa lista sale el envío, así que el
boletín se mandaba, no escribía a nadie, y la pantalla remataba con «Enviado por
correo a 0 suscriptores». La hermandad se quedaba convencida de que había
salido.

Ahora, si no se pudo leer la lista, **el envío se para** y dice por qué. Un
envío a cero no es un envío.

**«Tu hermandad no está en Gobergo».** Lo mismo con el buscador de hermandades
del área del hermano: si la consulta tropieza, no salía ninguna y el mensaje era
«no encontramos ninguna hermandad con ese nombre». De ahí se sale concluyendo
que tu hermandad no usa esto, y no se vuelve. Ahora dice que recargue.

Con esto van **dos clases enteras vigiladas por prueba** —esta y la de leer de
la copia local del navegador— en vez de ir arreglando los casos sueltos según se
reportan.

---

## 8. Las devoluciones del banco (fichero 19-44 / pain.002)

Se manda la remesa, el banco cobra, y unos días después **devuelve una parte**:
cuentas canceladas, saldos sin fondos, gente que reclama el cargo. Ese fichero
no se podía abrir en ninguna parte, y sin leerlo **todos los recibos se quedan
«Pagada»**:

- La hermandad cree tener un dinero que no tiene, y el saldo del libro no cuadra
  con el banco sin que nadie sepa por qué.
- Al hermano devuelto no se le vuelve a pasar el recibo —ya consta pagado— así
  que se le acumula el año entero.
- Y a la remesa siguiente entra otra vez la cuenta cancelada, que se vuelve a
  devolver, con su comisión otra vez.

Ahora se sube en **Cuotas**, se ve qué recibo es de quién y por qué motivo, y se
aplica cuando alguien lo ha mirado. **El motivo se traduce a cristiano** porque
no se hace lo mismo con cada uno: «sin fondos» se reintenta el mes que viene,
«cuenta cancelada» hay que llamar al hermano, y «lo ha rechazado el titular» lo
arregla secretaría hablando. Con el código a secas —`AC04`— los tres se tratan
igual.

**El fichero de ancho fijo del cuaderno 19-44 se reconoce y se rechaza con
instrucciones**, en vez de adivinarlo: adivinar posiciones de columnas en un
fichero de dinero es como se apunta una devolución en el hermano equivocado.

---

## 9. El hermano paga con tarjeta

Cuota y papeleta, desde su área.

**El dinero no pasa por Gobergo.** El cobro se crea contra la cuenta de la
hermandad, entra en su saldo y se paga a su IBAN. No hay comisión de Gobergo por
medio. Y en la base **no se guarda ninguna clave secreta**: solo el
identificador de la cuenta, que no sirve para cobrar nada.

**El importe no lo manda el navegador.** Lo lee el servidor del propio recibo.
Si viniera de fuera, cualquiera pagaría su cuota de 60 € por un céntimo
cambiando un número. Y de quién es el recibo tampoco se cree: se comprueba
contra la ficha de quien ha iniciado sesión.

**Quien da por cobrado es el aviso de Stripe, no la vuelta del navegador.** Esa
dirección se puede escribir a mano. Por eso la pantalla dice «en un momento
verás el recibo actualizado» y no da nada por pagado: la cuota la marca el
servidor cuando el dinero está de verdad, y de paso **deja el asiento en
Tesorería**, pendiente de conciliar como todos.

Dos detalles que se ven poco y evitan disgustos:

- **No se puede pagar dos veces el mismo recibo sin querer.** Entre que Stripe
  cobra y el recibo se pone al día pasan segundos; en ese hueco el hermano ve su
  cuota en «Pendiente» y la vuelve a pagar. Ahora se le avisa de que ya lo tiene
  empezado. Devolver un cobro duplicado es media mañana de tesorería.
- **Nadie puede escribir en la tabla de pagos desde el navegador.** Solo leerla,
  y solo los suyos. Poder escribirla sería marcarse la cuota como pagada sin
  pagar.

Para encenderlo hace falta que la hermandad enlace su cuenta de Stripe en
**Configuración**. Mientras no lo haga, todo sigue exactamente igual que hoy:
Bizum, transferencia y domiciliación.

---

## 10. La tienda, que no se podía probar

Llegó dicho así: «no aparecen bien los artículos, no se puede hacer facturas».
Y era verdad. **La tienda era el único módulo que no funcionaba sin base de
datos**, y eso no se lee como «falta conectar algo», se lee como que está roto:

- **El catálogo salía vacío.** Todos los demás módulos traen ejemplo —treinta y
  cuatro hermanos, sus cuotas, sus papeletas, el libro entero— y la tienda no
  traía ni un artículo.
- **Si dabas uno de alta, nacía con cero existencias**, en la caja aparecía
  «agotado» y no se podía ni pulsar. Nada decía que faltaba meterle género.
- **Meterle género llamaba a la base**, así que tampoco se podía.
- **Y el botón de cobrar estaba apagado.** Fin del recorrido: ni cesta, ni
  factura, ni apunte en el libro.

Ahora la tienda se puede usar entera sin conectar nada: un catálogo de ejemplo
**con existencias** (seis artículos, con IVA del 21 %, del 4 % y del 0 %, y uno
agotado a propósito para que se vea cómo queda), cobrar con su factura, el
almacén que baja con su movimiento, los tres asientos en Tesorería —el ingreso
por la base, el IVA en su propia partida y el coste del género—, anular
devolviendo el género, apartar desde la web pública y cobrarlo al recogerlo.

**Con base de datos no cambia nada.** Sigue mandando `registrar_venta`, porque
una venta son seis cosas que tienen que pasar juntas o no pasar. Lo de arriba
es solo para la demostración, y hace lo mismo a propósito: los importes no se
calculan dos veces, se piden a las mismas funciones que la pantalla usa para
enseñar el total antes de cobrar.

Dos cosas que **también le pasan a una hermandad con la base conectada**:

- Al dar de alta un artículo **se abre solo su almacén**, con la entrada
  preparada. Antes había que adivinar que esa pantalla existía, y hasta pasar
  por ella el artículo no se podía vender.
- **La tienda de la web pública** leía el catálogo con «ninguno» por defecto:
  salía vacía aunque el panel enseñara seis artículos.

Y una fila de Ajustes → Conexiones que se había quedado mintiendo: **«Pago con
tarjeta — todavía no está enchufado»**, cuando ya lo está desde el bloque 9.

---

## 11. Los informes de dinero ignoraban toda venta y todo pago con tarjeta

Este es grave, y se encontró probando la app: al vender algo en la tienda, el
total de ingresos de **Informes** se iba a **0,00 €** de golpe. No solo dejaba
de sumar la venta — borraba lo que ya había. Dos fallos distintos.

**El primero: `movimientos.fecha` guarda dos formatos de fecha a la vez, y
nadie lo sabía.** Cuando la secretaría escribe un apunte a mano en Tesorería,
se guarda «05 ene 2026». Cuando lo escribe una función del servidor —cobrar
una venta de la tienda, un pago con tarjeta— se guarda «2026-01-05». La
**Cuenta de Pérdidas y Ganancias**, el **Estado de Cuentas** y el selector de
años sacaban el año cogiendo los cuatro últimos caracteres de la fecha, que
vale para el primer formato y no para el segundo. Cada venta y cada pago con
tarjeta se volvía invisible para los dos documentos de cuentas, **sin un solo
error**.

**El segundo, y el que hizo que desapareciera todo y no solo la venta:** en
una demostración recién elegida, los apuntes de ejemplo del libro de
Tesorería viven solo en la memoria del navegador hasta que se visita esa
pantalla por primera vez. Si lo primero que se hacía era irse directo a la
Tienda y cobrar algo, la función que cierra la venta escribía sus tres
apuntes **encima de un libro que creía vacío**, y los dieciocho apuntes de
ejemplo desaparecían para siempre de ese navegador.

Comprobado en el peor caso —demostración recién abierta, directa a la
Tienda—: antes vender una medalla dejaba el libro con tres apuntes y los
ingresos del año en 0,00 €; ahora conserva los de ejemplo, numera a
continuación, y los ingresos suben justo lo cobrado, en los dos documentos.

---

## 12. Urgente: al secretario o al tesorero que además es hermano no le llegaba nada

Reportado el mismo día por dos vías que parecían no tener relación: **«las
notificaciones me siguen sin llegar»** —se le asigna una tarea a un hermano,
tanto de Eventos como de redes, y en su propia cuenta no aparece nada
pendiente— y **«el tesorero no ve bien la base de datos»**. Son el mismo
fallo.

La causa: `auth_es_hermano()` es la función que decide, entre otras muchas
cosas, si una cuenta es «de gestión» o «de hermano a secas». Desde que existe
«una persona, una ficha» —el cargo va en la ficha del hermano, no en una
tabla aparte—, esa función sabe que un hermano puede llevar cargo. Pero el
fichero que se lo enseña, `hermano-con-cargo.sql`, **no estaba en la lista de
`ACTUALIZAR.sql`**. Cualquier hermandad que montó su base antes de que
existiera esa pieza, y desde entonces solo ha ido pegando `ACTUALIZAR.sql`,
se ha quedado para siempre con la versión vieja de esa función — sin ninguna
forma de ponerse al día, porque el fichero que la arregla nunca se le ofrecía.

Con la versión vieja, cualquiera que sea las dos cosas a la vez —hermano y
cargo— pierde en silencio, sin un solo error, todo lo que dependa de «esta
cuenta es de gestión»:

- **Encargar una tarea a un hermano, o un post de redes, no le llega**: la
  política que deja escribir el aviso exige «esta cuenta no es de hermano», y
  quien reparte tareas suele ser precisamente eso, un hermano con cargo.
- **El tesorero que es hermano no ve bien Tesorería**: se le trata como
  hermano a secas y se le enseña la vista recortada, no la de gestión.
- Y por el mismo motivo, no se le mandan los correos que solo ve quien
  gestiona.

Se ha añadido `hermano-con-cargo.sql` a `ACTUALIZAR.sql`, en el sitio que le
corresponde. Y se ha escrito una prueba que reproduce el fallo de verdad —con
la sesión del propio secretario, no con el superusuario— antes de arreglarlo
y después: antes, el secretario no podía avisar a un hermano; con
`ACTUALIZAR.sql` puesto, el aviso le llega.

---

## 13. El botón «enviar» de la papeleta solo imprimía

Reportado probando la pantalla en vivo: se abre la ficha de un hermano en
**Papeletas de sitio**, se pulsa «Descargar / enviar (con QR)», y no llega
ningún correo. El texto de ayuda de al lado ya lo avisaba, sin que nadie se
fijara: *«envío real al conectar la base de datos»* — es decir, el botón
nunca mandó un correo de verdad, ni en local ni conectado. Solo abre el
diálogo de imprimir del navegador.

La papeleta sí manda un correo automático, pero solo una vez: al asignarle
sitio por primera vez. Si el hermano dice que no le llegó, o hay que
reenviárselo, no había manera desde esta pantalla.

Se separan las dos cosas: un botón para **descargar/imprimir** (lo de
siempre) y otro para **enviar por correo**, que ahora sí manda el aviso de
verdad —el mismo que se manda al asignar el sitio, con la hora de citación y
la fecha de salida— y dice claramente si ha salido o por qué no.

---

# Lo que tienes que hacer tú

1. **Ejecutar `ACTUALIZAR.sql`, cuanto antes** — trae el arreglo urgente del
   bloque 12. Está explicado paso a paso en `supabase/LEEME-ACTUALIZAR.md`.
2. **Volver a desplegar la función de correo**, para que funcione el
   diagnóstico nuevo:
   ```
   supabase functions deploy enviar-correo
   ```
3. **Solo si quieres el pago con tarjeta** (si no, no hace falta tocar nada y
   todo sigue funcionando igual):
   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase functions deploy crear-pago
   ```
   Y pegar el identificador de la cuenta de Stripe de la hermandad
   (`acct_…`) en **Configuración**. Sin eso, el botón de tarjeta no sale.

---

# Lo que sigue pendiente

- **Los informes de cuentas están mal** — Víctor dijo «eso me encargo yo de
  mandártelo para que la máquina sepa qué tiene que coger de cada lugar».
  Sigo esperando eso: no quiero adivinarlo.
- **La pantalla en blanco de gobergo.com** se resolvió sola. Puede ser el
  proyecto de Supabase despertando de la pausa (plan gratuito). Si vuelve a
  pasar, hay que mirarlo con el navegador abierto.

Las dos que quedaban de la lista —**leer el fichero de devoluciones** y **el
pago con tarjeta**— van en esta entrega, en los bloques 8 y 9.
