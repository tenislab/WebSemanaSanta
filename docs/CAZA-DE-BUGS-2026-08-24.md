# Lo que se ha encontrado esta noche

Catorce fallos de lógica. Cada uno está reproducido antes de tocarlo y comprobado
después, y cada uno lleva su prueba para que no vuelva.

---

## ANTES DE NADA: hay que volver a pasar `ACTUALIZAR.sql`

Tres de los arreglos necesitan tocar la base de datos:

1. Supabase → **SQL Editor** → **New query**
2. Pegar `supabase/ACTUALIZAR.sql` **entero**
3. **Run**

Se puede repetir sin miedo. Comprobado sobre una base montada exactamente como
la vuestra —el instalador y el `ACTUALIZAR` que ejecutaste anoche, con 800
hermanos, 800 cuotas y 400 papeletas dentro—: entra **sin un solo error ni
aviso**, dos veces seguidas, y los datos no se mueven ni una fila.

**Mira si sale algún aviso amarillo.** Solo puede salir uno, y dice esto:

> NO se ha puesto el índice: ya hay números de recibo repetidos. nº 412 (2 recibos)

Si sale, es que ya tenéis dos recibos con el mismo número. No los toca nadie:
decide en Cuotas cuál se queda con el número, corrige el otro, y vuelve a pasar
el archivo.

---

## Los catorce

### 1. Dar de baja al administrativo corría el escalafón entero

El hermano civil —un contratado, un asesor— lleva número 0 a propósito: no ocupa
puesto. Al tramitarle la baja se recolocaba «a todos los de número mayor que el
suyo», y su número es CERO: o sea, **a todo el censo**. El hermano nº 1 se iba al
0, que es como quedan los de baja, y los demás bajaban un puesto cada uno.

No se ve el día que pasa. Se ve el día de la salida, con el escalafón corrido y
el hermano más antiguo desaparecido de la lista.

### 2. La campaña de papeletas vivía en un navegador, y el hermano veía otra

De todo lo que se guardaba solo en el ordenador de quien lo escribía, esto era lo
peor, porque **lo lee el área del hermano**. La secretaría abría la campaña de
2026 desde Papeletas › Ajustes de campaña; el hermano, desde el móvil, leía la de
fábrica —año 2027, otro plazo, otra fecha de salida— y pedía sitio para una
Semana Santa que no tocaba. Ninguno de los dos veía nada raro.

Van con ella los **campos propios de la ficha**, con una versión rara del mismo
fallo: el valor sí viajaba —va dentro de la ficha, que se guarda— y la definición
no. Se creaba «Talla de túnica», se rellenaban cuatrocientas, y desde otro
ordenador el dato estaba guardado y no había forma de verlo.

### 3. La solicitud de papeleta se quedaba en el móvil del hermano

El hermano rellena el formulario de su área, envía, y la pantalla le dice que su
solicitud queda registrada. Y quedaba registrada **en su teléfono**. La secretaría
abría Papeletas › Solicitudes y no veía ninguna.

Los dos lados de la misma función leyendo cajones distintos. Al cerrar el plazo,
las que no se atendieron no es que se perdieran: es que nunca salieron del móvil.

Ahora tiene tabla, con sus reglas: el hermano solo crea la suya, el estado lo
pone el servidor, una pendiente por hermano y año, y un hermano de baja no pide
sitio.

### 4. El modo local de reserva venía abierto

Si Supabase no responde —el proyecto en pausa, un corte de red— la aplicación
seguía funcionando con los datos del navegador. Con una hermandad de verdad eso
es un desastre callado: la secretaria entra, ve **un censo que no es el suyo**
—los doce de ejemplo, con nombres inventados— y pasa la tarde dando altas que no
existen en ningún sitio. Nada avisa.

Había un seguro y estaba al revés: había que acordarse de activarlo «el día que
se abra al público». Ahora viene puesto.

### 5. Al administrativo se le podía cobrar una papeleta que no salía en ningún sitio

Cortejo › Asignar hermano ofrecía a todo el censo menos las bajas. Pero el
reparto descarta a **dos** grupos: las bajas y los civiles. Se le asignaba tramo,
se le cobraba la papeleta, y el día del cortejo no aparecía ni en el tramo ni en
el orden impreso.

### 6. En Papeletas se podía sacar papeleta a una baja o al administrativo

La lista de Papeletas es el censo entero, y las bajas salen ahí con su botón de
«Sacar papeleta» al lado. Tres caminos emiten desde esa pantalla —renovar, sacar
en tramo y la simbólica— y ninguno lo miraba.

### 7. Un importe roto dejaba el informe del cabildo diciendo «NaN €»

Diez sitios sumaban dinero a pelo. Entre ellos las cuatro cifras del informe de
recaudación, los dos saldos del estado de cuentas y el historial de cada hermano.

Un solo importe malo se lleva la suma entera: vacío la deja en `NaN`, y si llega
como **texto** —Postgres devuelve los `numeric` como cadena— el `+` concatena y
salen cosas como «12060,1060 €».

### 8. Un Excel con líneas en blanco por medio se leía como lleno de errores

El listado de una hermandad trae líneas en blanco separando bloques. En CSV se
filtran; en `.xlsx` no. Cada hueco salía como fila roja «Falta el nombre; Falta el
DNI»: quince bloques, quince errores que no hay forma de corregir, delante de
quien está importando su censo por primera vez.

### 9. El extracto del banco no se podía importar

Un movimiento exportado de la banca electrónica viene «14/03/1985 12:30», y Excel
escribe «01/01/2026 0:00» en cuanto la celda es de tipo fecha-hora. Ninguno de los
patrones lo reconocía. Como la fecha es obligatoria en el libro de caja, **el
archivo entero se quedaba fuera**: ni un apunte.

### 10. El buzón del hermano estaba en el ordenador de la secretaría

La tabla `avisos_hermano` existe desde el principio, con sus políticas. Nadie la
usaba. Todos los avisos se escribían en localStorage: la campana con el punto
rojo, los avisos de cuota, los de papeleta, el de la baja, los comunicados —todo
vacío para siempre en el móvil del hermano, sin un error por medio.

### 11. El botón de activar la suscripción no llegaba a la base

Sin suscripción activa el panel entero está bloqueado. Y el botón escribía en
localStorage:

1. El Hermano Mayor activa desde su ordenador. Entra. Funciona.
2. La secretaria abre el panel desde el suyo: muro de pago.
3. Y al Hermano Mayor, **al recargar, le vuelve el muro**: se pregunta a la base,
   la base dice «no hay suscripción», y esa respuesta pisa la copia local.

La única forma de activar era ejecutar SQL a mano en Supabase. Ahora el botón
funciona, y si no puede guardar **lo dice**.

### 12. Se podían crear dos recibos con el mismo número

El número de recibo va impreso en el justificante del hermano y es por lo que
pregunta la tesorería al cuadrar el banco: «el 412 no me aparece». Que haya dos
412 significa que esa conversación deja de tener respuesta.

`hermanos` y `papeletas` tenían el número protegido; `cuotas` no. Y no hace falta
mala suerte: dos personas emitiendo desde dos ordenadores el día del cabildo
bastan.

### 13. Una hermandad no se podía borrar

`delete from hermandades` fallaba entero y no borraba nada. La cascada va
bajando el censo, las cuotas y las papeletas; cada baja dispara el registro de
«quién hizo qué», y ese disparador intentaba escribir una fila **con el id de la
hermandad que acababa de desaparecer**. La clave ajena lo rechazaba y se caía el
borrado completo.

Muerde justo donde más molesta: `BORRAR-PRUEBAS.sql` es el archivo que se
ejecuta para quitar las hermandades de prueba **cuando entra la primera de
verdad**. Se lanzaba, daba un error de clave ajena que no dice nada de esto, y
las de prueba seguían ahí.

Salió solo, al escribir una de las pruebas nuevas: cuando esa prueba fue a
limpiar su propia hermandad, se estrelló.

### 14. El documento «restringido» lo entregaba la base a cualquiera

El Archivo deja marcar un documento como restringido y elegir a qué cargos:
«Expediente disciplinario — visible solo para Hermano Mayor y Fiscal». La
pantalla lo respeta, pinta el candado, y a quien no está en la lista le enseña
«Documento restringido» en vez del contenido.

La base no pedía nada de eso: **cualquiera con el módulo de archivo se
descargaba todos**, con su nombre y su descripción. Comprobado: la Secretaria,
que no figura en ninguna de las dos listas, recibía los dos expedientes con el
título completo.

Y no hace falta ni abrir la consola. El panel carga la tabla entera para
pintarla, así que los restringidos ya están en la página y en la copia del
navegador.

Ahora la base lo comprueba con el mismo criterio exacto que la pantalla, y
también al modificar y al borrar: sin eso, quien no puede leer el expediente sí
podía borrarlo, o quitarle la restricción y leerlo después.

---

## Tres redes nuevas, para que no vuelva a pasar

**«Toda tabla que se crea, alguien la usa.»** El fallo más callado de esta
aplicación es que el SQL cree la tabla, le ponga sus políticas, y nadie la toque:
no hay error, no hay permiso denegado, la función simplemente no existe. Ha
pasado tres veces (los números 3, 10 y 11) y las tres se descubrieron barriendo
esto. Ahora hay una prueba que lo barre sola.

**«Nadie suma dinero a pelo.»** Barre `src` entera buscando la forma cruda y dice
el fichero y la línea. Comprobado que se pone roja al reintroducir una.

**«Cada cargo escribe en lo suyo, y en nada más.»** Ejecutada, no leída: monta la
junta completa —Hermano Mayor, Secretario/a, Tesorero/a, Mayordomo, Diputado,
Fiscal y Vocal—, se hace pasar por cada uno y escribe en las ocho tablas. Un
«no» donde debería haber un «sí» es la secretaria viendo el visto bueno verde
mientras la base rechaza; un «sí» donde debería haber un «no» es alguien tocando
lo que no le toca.

El resultado, y esto es una buena noticia: **cuadra exactamente**, cargo por
cargo, con lo que dice la tabla de permisos. Nada de lo que se probó estaba mal.
Esta prueba no arregló nada — está para el día que alguien toque una política y
no se dé cuenta, que ya pasó una vez con la web pública.

---

## Uno que he encontrado y NO he arreglado, a propósito

### La web pública entrega también lo que está sin publicar

El constructor de webs tiene tres formas de dejar algo fuera de la web:

- una **sección oculta** (`visible: false`),
- una **sección en borrador** — «se ve en la vista previa del panel, con su
  marca, pero NO en la web; sirve para ir escribiendo una sección sin publicar a
  medias», dice el propio código,
- una **noticia sin publicar**.

Las tres se respetan **en el navegador**. Y la consulta que sirve la web trae el
`datos` entero, con todo dentro:

```
supabase.from('web_publica').select('datos, publicada, hermandad_id')
```

Así que el texto de la sección que estáis escribiendo, y las noticias que
todavía no queréis anunciar, viajan a **todo el que abra la web de la
hermandad**. No se ven en la página, pero están en la respuesta: se leen
abriendo las herramientas del navegador, pestaña Red.

Es de la misma familia que los números 5, 6 y 14 —lo que esconde la pantalla no
protege nada— y el arreglo está claro: una función en la base que devuelva la
web YA filtrada, y quitarle a los visitantes el acceso directo a la tabla.

**Por qué no lo he tocado.** Eso cambia el camino por el que se sirve la web
pública entera. Hacerlo mal no da un error: deja la web de la hermandad en
blanco, o a medias, delante del barrio. Es un cambio para hacer con calma y
mirándolo en pantalla, no de madrugada y a ciegas.

**No corre prisa para mañana** —la hermandad viene a meter su censo, no a
publicar su web— pero **sí antes de que su web esté abierta al público**.
Dímelo y lo hago con la web delante.

---

## Lo que sigue pendiente, y no es de esta noche

- **Activar `pg_cron`** (Database → Extensions) y ejecutar `tareas-programadas.sql`.
- **«Verify JWT with legacy secret» apagado** en la Edge Function `enviar-correo`.
- Probar una vez el **«¿Has olvidado tu contraseña?»** del área del hermano.
- C1 (webhook de Stripe), C2 (mandatos SEPA firmados), C3 (devoluciones del
  banco), C4 (pago con tarjeta).

## Estado

`typecheck`, `lint` y `build` limpios. **3.033 de 3.033 pruebas pasan** con la
base de datos conectada. El libro de prueba sigue importando lo mismo que
siempre: 1.188 hermanos, 1.068 cuotas, 1.500 apuntes de caja, 400 enseres.
