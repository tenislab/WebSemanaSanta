# Caza de bugs del 23 de agosto

Lo que salió mientras no estabas. Cada uno está **reproducido antes de
arreglarlo** —contra un Postgres de verdad, o construyendo el archivo que lo
provoca— y comprobado después. Los que no pude confirmar no están aquí.

Diez, y ocho de ellos comparten el mismo aire de familia: **funcionaba con
nuestros datos y fallaba con los suyos**, o **la pantalla protegía algo que la
base de datos no protegía**. Son las dos formas de fallo que no se ven en una
demostración.

---

## Lo que hay que hacer en Supabase

Todo esto está en **`supabase/ACTUALIZAR.sql`**: SQL Editor → pegar entero →
Run. Y hay que **volver a desplegar la función `enviar-correo`**. Está contado
paso a paso en `docs/QUE-TOCAR-EN-SUPABASE.md`.

---

## Lo gordo

### 1. Un hermano se ponía la cuota como pagada desde la consola

El hermano puede escribir en su recibo: es como avisa de que ha pagado por
Bizum. Esa política se dejó **sin acotar por columnas**, con este razonamiento
escrito en el propio SQL:

> «No hace falta acotar más por columnas: lo único que la aplicación le deja
> tocar ahí es el aviso de pago.»

Y ahí está el fallo. Lo que le deje tocar la aplicación no protege nada: él
tiene una sesión de verdad, y con F12 habla con la base directamente:

```js
supabase.from('cuotas').update({ estado: 'Pagada', importe: 0 }).eq('hermano_id', …)
```

**Comprobado contra Postgres: la fila cambia.** En ese momento su recibo queda
pagado y a cero, sale al corriente, se lleva su papeleta de sitio, y las cuentas
dicen que ese dinero entró. La tesorería no tiene forma de notarlo.

No es un caso de laboratorio: es una línea, con la sesión que ya tiene abierta y
sin saber nada de bases de datos. En una hermandad de seiscientos basta con que
a uno se le ocurra.

Lo mismo en la papeleta: ponerse «Pagada» o «Entregada», o cambiarse el número
—que es el sitio en el cortejo y va por antigüedad—.

Se cierra como ya se cerró en la ficha del hermano: **lista blanca**. De su
recibo solo puede cambiar el aviso de pago. La prueba se ejecuta con su sesión
puesta y comprueba las dos mitades: que no puede cobrarse el recibo, y que
**sigue pudiendo avisar de que ha pagado**, que es lo que el arreglo no podía
romper.

### 2. El alta por la web entregaba la llave de otra persona

`suscribirse_a_la_web` devolvía la llave de la suscripción a cualquiera desde
fuera. Y por el `on conflict … returning`, si el correo **ya estaba**, devolvía
**la de esa persona**. Comprobado contra Postgres.

Con la dirección de alguien de la lista —que no es ningún secreto— se podía:

- **confirmar su alta** sin que llegara a ver el correo. Y entonces la hermandad
  tiene guardado «confirmó tal día», que es la prueba del consentimiento que
  exige el RGPD, y es falsa;
- o **darla de baja**, una detrás de otra, sin que se entere nadie.

Ahora devuelve sí o no. La llave se queda en la base y solo sale por dos sitios:
el correo que se le manda a esa persona y el panel de la hermandad.

### 3. El correo de confirmar no se mandaba nunca

Y esto es lo que tapaba el anterior. **Nadie llamaba a quien armaba el enlace.**
No había forma de mandarlo: quien se apunta desde la web no tiene sesión y el
envío la exigía.

Así que el formulario decía «te hemos mandado un correo» y no salía ninguno. Y
como a los sin confirmar no se les escribe, la lista se llenaba de gente a la
que la hermandad no podía avisar de nada: un comunicado «a los suscriptores»
llegaba a **cero personas**.

Lo manda ahora la función `enviar-correo`, con la clave de servicio y sin que la
llave pase por ningún navegador. Y hay **dos sitios** desde donde reenviárselo a
los que llevan tiempo esperando —que son todos—: el editor de la web, donde se
ve la lista en «Sin confirmar», y Comunicados, donde se nota que el alcance sale
bajo.

### 4. La remesa llevaba IBAN sin comprobar, y perdía a los que no tenían

Dos cosas, y las dos cuestan dinero:

- **No había ninguna comprobación del IBAN.** Y eso no falla en una línea: el
  banco valida la estructura del fichero antes de procesar nada, así que un IBAN
  con la longitud mal **hace que rechace la remesa entera**. Mil recibos sin
  cobrar por una errata de una fila. Y las erratas son lo normal: el IBAN sale
  del Excel de siempre, tecleado a mano hace años.
- **El domiciliado sin IBAN se caía de la remesa en silencio.** La tesorería
  descargaba el fichero creyendo que cobraba a todos, y a N no. Su recibo se
  quedaba «Pendiente» para siempre, volvía a caerse en la siguiente, y nada
  decía nunca por qué.

Ahora se comprueba con lo del propio estándar —la longitud de su país y los
dígitos de control— y se dice **cuántos** se quedan fuera, **cuánto dinero** es,
**quiénes**, **qué le pasa al IBAN de cada uno** y **dónde se arregla**.

---

## Lo que rompía la puesta en marcha

### 5. Las fechas de un Excel de verdad llegaban como «36512»

Excel no guarda fechas: guarda **números** con un formato de fecha encima. Al
teclear `18/12/1999` queda `<c r="B2" s="1"><v>36512</v></c>`, y lo que dice que
eso es una fecha está en `xl/styles.xml`, que el lector no abría.

Así que el censo entraba **sin fecha de alta, sin nacimiento y sin bautismo** —y
con ellas se van la antigüedad y la segmentación por edad—, y en Tesorería no
entraba bien ni un movimiento.

No saltaba porque los libros de prueba de este repositorio escriben todo como
texto, que es justo lo que Excel no hace nunca: **funcionaba con los archivos de
casa y fallaba con los de la hermandad**. Ahora hay un generador que escribe
como escribe Excel, y con él se prueba.

### 6. La cabecera casi nunca es la primera fila

La hoja que trae una hermandad empieza así, y no es raro:

```
A1:  HERMANDAD DE NUESTRO PADRE JESÚS NAZARENO
A2:  Listado de hermanos — 14 de febrero de 2026
A3:  (vacía)
A4:  Nº | Apellidos y nombre | D.N.I. | Teléfono | …
```

Se daba por hecho que la cabecera era la fila 1. Así que la pantalla decía
**«— no está en el archivo —» en todas las columnas**, con el archivo bueno
delante y sin ninguna forma de entenderlo.

Arrastraba dos más: en un CSV el separador se sacaba de esa primera línea —que
no tiene ninguno—, y con varias pestañas la que llevaba título encima sacaba
cero al puntuarla y perdía contra otra, así que se importaba el censo desde la
pestaña de las cuotas. Eso es de lo peor que puede pasar: hay datos, entran, y
están mal.

Ahora se busca la cabecera. Y se guarda cuántas filas se han saltado, para que
«la línea 47» siga siendo la 47 **de su archivo**.

### 7. La segunda hermandad no podía guardar ni un catálogo suyo

`catalogos` se quedó con la clave primaria en `(clave, valor)`, **sin la
hermandad**. Se convirtieron el DNI, el número de hermano, los ajustes, la web y
las redes sociales; esta se pasó por alto.

Y es la peor en la que pasarla por alto: ahí viven las categorías de ingreso y
gasto, las cuentas de tesorería, los tipos de incidencia. **«Cera», «Flores»,
«Limosnas», «Caja», «Bueno».** Las escribe igual todo el mundo.

Así que la hermandad número dos se estrellaba contra una clave duplicada con el
primer valor obvio que escribiera. Y no se ve venir: la fila que estorba es de
otra hermandad y por tanto **invisible**. En pantalla no hay nada repetido, y
aun así no se puede guardar.

### 8. Cualquiera del personal podía reescribir la web pública

El módulo «web» existía y la pantalla lo respetaba, pero la base de datos no lo
pedía: su política decía solo «no es un hermano». El diputado de tramo, el
fiscal, el mayordomo — todos podían reescribir la web desde la consola.

Duele más de lo que parece: la web pública la ve el barrio entero, y una portada
cambiada la ve más gente en una tarde que cualquier otra cosa de la aplicación.

### 9. La contraseña de quien pedía el alta se guardaba en claro

`solicitudes_alta.clave_propuesta` guardaba, **en claro**, la contraseña que
tecleaba quien pedía el alta desde la web. La ve cualquiera del personal con el
módulo «hermanos» —Hermano Mayor, Secretaría, Diputado Mayor—, en la propia fila
de la solicitud, y se quedaba ahí mientras estuviera pendiente: semanas.

La gente repite contraseñas. La que veía la secretaria es, con mucha
probabilidad, la de su correo. Y quien pide el alta no se la está dando a una
empresa con un equipo de seguridad: se la está dando a un vecino que lleva la
secretaría los martes.

Y no hacía falta ninguna: el camino de «se genera una clave de un solo uso al
aprobar y se manda por correo» **ya existía** —se usaba en el alta de un menor—.
Ahora se usa siempre, los dos formularios piden un campo menos, y el SQL **borra
las que hubiera guardadas**.

### 10. Las tres puertas abiertas desde fuera no tenían freno

El buzón de la web, las solicitudes de alta y el contador de visitas se abren a
quien no ha iniciado sesión, a propósito. Lo que faltaba era el tope — y el
campo trampa para robots de los formularios solo lo pisa quien pasa por el
formulario.

Sin tope pasan dos cosas: se **ahoga el buzón** (diez mil mensajes de relleno y
los tres de verdad no hay quien los encuentre) y se **llena la base** — y en el
plan gratuito ahí no se cae solo el buzón, se cae la hermandad entera.

Y el primer freno que puse **se saltaba con un campo más**: el del buzón cuenta
por `creado_en`, y esa columna llegaba de fuera, así que poniéndola tres días
atrás el contador no veía nada; el de las solicitudes cuenta las pendientes, así
que mandándolas «ya aprobadas» tampoco contaban — y encima aparecían en el panel
como aprobadas por alguien de la casa. La hora y el estado los pone ahora la
base.

---

## Un hallazgo que NO he tocado, porque es decisión tuya

**Un hermano de dos hermandades solo puede vincular su cuenta a una.**

El DNI sí se convirtió a único *por hermandad*, con el comentario explícito «la
misma persona puede ser hermana de dos». La cuenta, no: `auth_user_id` es único
en toda la tabla. En Andalucía ser hermano de dos o tres hermandades es lo
normal, así que cuando las dos estén en Gobergo esa persona solo podrá entrar en
el área de una.

Arreglarlo no es cambiar el índice: `hermano_propio_id()` busca la ficha *sin
filtrar por hermandad*, así que con dos devolvería una cualquiera —y con ella,
los datos de la hermandad equivocada—. Habría que hacer la sesión del hermano
consciente de la hermandad, de punta a punta.

O se asume la limitación (una cuenta por hermandad, con correos distintos), o se
hace el cambio de diseño. Es tuya la decisión.

---

## Cómo queda

- `npm run typecheck`, `npm run lint` y `npm run build`: limpios.
- **2.859 pruebas, todas pasan.** Casi cien son nuevas y varias se
  ejecutan contra un Postgres de verdad, con la sesión del hermano puesta: es lo
  único que demuestra un fallo de permisos, porque leer la política como texto
  no dice qué columnas deja pasar.
- `scripts/probar-importacion.mjs` da los mismos números que antes de tocar
  nada: censo 1.188, cuotas 1.068, caja 1.500, inventario 400.
