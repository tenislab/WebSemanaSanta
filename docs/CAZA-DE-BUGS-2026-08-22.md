# Caza de bugs de la noche del 22 de agosto

Lo que salió mientras dormías. Cada uno está **verificado** antes de darlo por
bueno: o reproducido en el navegador, o demostrado con el propio código
ejecutándose. Los que no pude confirmar no están aquí.

---

## Lo gordo

### 1. La remesa SEPA podía salir con la suma de control mal

**El banco rechaza el fichero entero** si `CtrlSum` no es exactamente la suma
de los `InstdAmt`. Se calculaban por dos caminos distintos: cada línea
redondeaba a dos decimales, y la suma de control sumaba sin redondear y
redondeaba al final.

    tres recibos de 0,005 €  →  líneas 0,01 + 0,01 + 0,01 = 0,03
                                suma de control            = 0,02

Probado con el generador de verdad: **de seis escenarios, tres no cuadraban.**

Lo peor es cómo se descubre. No se ve al descargar —el XML parece correcto—:
se ve tres días después, cuando el banco devuelve la remesa entera y no ha
cobrado nadie.

Ahora todo el dinero del fichero pasa por céntimos enteros y las dos cifras
salen del mismo sitio. Y el dinero se redondea **al entrar** (cuota nueva,
apunte de Tesorería, catálogo de conceptos), que cierra la clase entera.

### 2. «NaN €» en toda la hermandad por un solo recibo roto

Salió tirándole datos hostiles al código: importes en NaN, negativos, de
999.999,99 €, cuotas sin ejercicio, nombres con comillas y emoji, mil recibos
del mismo hermano, censos vacíos. Nada reventaba, pero un resultado se veía en
pantalla y estaba mal.

Basta con **un** importe que no sea un número —la celda vacía de un Excel, un
valor nulo de la base— para que la suma diera NaN. Y entonces la deuda de
**toda** la hermandad se leía «NaN €»: en Cuotas, en la ficha de cada hermano,
en su propia área y en el estado de cuentas que se lleva al cabildo. Es el
mismo fallo que el «NaN AÑOS» del censo que ya salió en su día, pero con
dinero.

Estaba en **doce sumas distintas**: lo cobrado, la deuda viva, lo recaudado en
papeletas, ingresos y gastos de Tesorería, el saldo conciliado del panel de
inicio, el valor asegurado del inventario, los totales de Informes y las
partidas del estado de cuentas. Todas pasan ya por la misma función.

### 3. Un hermano podía no poder entrar nunca en su área

Un DNI se escribe de cuatro maneras y todas son la misma persona:
`12345678A`, `12.345.678-A`, `12345678-a`, `12 345 678 A`. Había **tres
normalizadores distintos** conviviendo, más varios `.trim().toUpperCase()`
sueltos.

- El alta desde «Personal y permisos» guardaba el DNI tal cual lo tecleaba la
  secretaria, puntos incluidos. Después esa persona escribía el suyo como se
  escribe normalmente y la aplicación no lo encontraba. Sin explicación: solo
  «no te encontramos».
- Y el DNI del acceso viajaba **sin limpiar** a `resolver_email_hermano`,
  donde están guardados sin puntos: tampoco resolvía por ahí.
- El alta a mano limpiaba lo tecleado pero comparaba contra el censo **sin**
  limpiar, así que la misma persona entraba dos veces, con dos números. Un
  hermano duplicado son dos cuotas, dos papeletas y dos sitios en el cortejo.

Comprobado en el navegador: **las tres formas de escribirlo entran.** Antes
solo la exacta.

### 4. El borrado RGPD no comprobaba si la base lo había hecho

`supabase-js` no lanza excepción cuando la base rechaza algo: devuelve
`{ error }` y sigue. Aquí no se miraba, así que un borrado bloqueado por
permisos —que es justo lo que pasa ahora mismo en la instalación de verdad—
pasaba inadvertido: se releía el censo con el hermano todavía dentro y la
pantalla lo repintaba dando por hecha la supresión.

No es un fallo cualquiera. Es el derecho de supresión del artículo 17 sobre un
censo de hermandad, que revela convicciones religiosas y es categoría especial
del artículo 9. **Certificar una supresión que no ha ocurrido** es lo peor que
puede hacer esa pantalla.

### 5. El hermano apagaba sus avisos y le seguían llegando

Mismo silencio, otra consecuencia. La promesa ni se esperaba: si la base
rechazaba el cambio, el interruptor se quedaba apagado en **su** navegador, la
copia de la hermandad seguía diciendo que sí, y le seguían llegando los correos
que acababa de apagar, convencido de haberlos apagado.

Un interruptor que falla así es peor que no tener interruptor: la persona cree
que está resuelto y no vuelve a intentarlo ni lo dice en secretaría. Ahora el
interruptor **vuelve a como estaba** si no se pudo guardar, y se explica.

---

## Lo que ya venía de la tarde

### 6. A cuarenta hermanos no les llegaba el comunicado, y nadie lo sabía

Al mandar un comunicado, las direcciones que no pasan el filtro se quitaban de
la lista **sin decírselo a nadie**. Una hermandad marca 612 destinatarios, y si
cuarenta tienen el correo mal escrito en el censo —que en uno importado de un
Excel es lo normal— la pantalla decía «Enviado por correo a 572 hermanos» y
nadie caía en la diferencia.

Esos cuarenta no se enteran de nada: ni de los cabildos, ni de los cultos, ni
de que se les ha emitido la cuota. Y como el comunicado queda guardado como
«Enviado», no vuelve a intentarse nunca. Se descubre cuando alguien se queja de
que no le avisan, meses después.

### 7. `cuotaAlDia`: un dato muerto del que bebían cuatro pantallas

Un booleano guardado en la ficha que nadie actualizaba al cobrar. El censo,
Informes, la segmentación de comunicados y el área del propio hermano decían
«Pendiente» de gente que había pagado hacía meses. El peor era el sesgo de
morosos: «mándaselo a los que deben» sacaba el censo entero.

### 8. Cinco pantallas hablaban de años distintos

La situación de cuota se pinta en cinco sitios y cada uno elegía el ejercicio
por su cuenta. Con la hermandad al día coinciden y no se nota; en enero, con la
cuota del año pasado emitida y la de este no, **Cuotas decía «al corriente» y
el censo «sin cuota emitida» del mismo hermano.**

### 9. La barra de arriba se salía 58 px en el móvil

En **todas** las pantallas, no solo en una. Los cuatro botones de la derecha no
caben a 390 px y empujaban la página entera de lado.

### 10. El repaso de pantallas estaba mintiendo

Guardaba la sesión de demostración en `localStorage` cuando vive en
`sessionStorage`. Entraba como visitante, el panel lo mandaba a Inicio, y daba
por buenas las dieciséis pantallas de gestión sin haber entrado en ninguna.

---

### 11. La portada se movía de lado en el móvil

El titular lleva `text-wrap: nowrap` y tiene su motivo —el salto de línea está
puesto a mano—, pero en 390 px «GESTIONA TU HERMANDAD» en versales no cabe y
con `nowrap` no se encoge: se salía, y arrastraba la **página entera** 39 px a
lo ancho. Es lo primero que ve una hermandad que entra desde el teléfono.

---

## Y una regla repetida siete veces

«Qué se debe» —pendiente, en mora o devuelta— estaba copiada en siete sitios.
Copiada funciona; el problema es el día que se añada un estado (condonada,
exenta, fraccionada). Ahora la contesta un `Record` de **todos** los estados,
así que al añadir uno TypeScript no compila hasta que se diga si está cobrado.
El compilador hace de recordatorio, que es más fiable que acordarse.

---

## Lo que se pasó y quedó limpio

- Las **22 pantallas** abren sin errores.
- Las **19 pantallas** caben en 390 px, sin desbordes.
- Los **16 módulos** paseados a fondo —abriendo cada desplegable, cada pestaña,
  cada filtro y la primera ficha de cada tabla—: **ningún fallo**.
- Emitir cuotas a todo el censo: 56 recibos, sin ids ni números repetidos, y no
  vuelve a ofrecer emitir cuando ya están todas.
- Cobrar un recibo llega a Tesorería como ingreso, con su importe y su hermano.
- Lo que se cambia sobrevive a recargar la página.

## Lo que NO he tocado

- El **RLS de Supabase**, que sigue siendo lo que bloquea la instalación de
  verdad. Necesito el resultado de `supabase/POR-QUE-NO-PUEDO.sql`.
- Las **domiciliaciones y Stripe**, apuntados en
  [`COBROS-LO-QUE-FALTA.md`](COBROS-LO-QUE-FALTA.md) como pediste.
