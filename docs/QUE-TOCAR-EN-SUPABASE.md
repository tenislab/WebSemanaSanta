# Qué hay que tocar en Supabase

Con lo que se ha hecho hasta hoy. Ordenado por cuándo hace falta.

---

## AHORA — un solo SQL

**SQL Editor → New query → pegar `supabase/ACTUALIZAR.sql` entero → Run.**

Lleva dentro todo lo que le falta a una base ya instalada, en orden y sin tocar
ningún dato: los ajustes de cuotas, el almacén de imágenes de la web, el
contador de visitas, los suscriptores, las copias de seguridad y los permisos de
«eventos» y «web» del Hermano Mayor.

Es seguro repetirlo. Al terminar imprime una tabla de diez filas diciendo qué ha
quedado puesto y qué no. De las que pueden salir en `f`, dos no son un fallo del
SQL y hay que mirarlas aparte:

- **«Limpieza automática (pg_cron…)»** sale en `f` hasta que enciendas la
  extensión a mano: *Database → Extensions → `pg_cron`*, y después pegar
  `supabase/tareas-programadas.sql`. Sin ella, el registro de actividad y la
  tabla de intentos crecen para siempre.
- **«Ninguna hermandad se ha quedado sin permisos»** en `f` significa que hay
  alguna hermandad creada antes de que existiera la siembra: su junta entra y no
  puede tocar nada, sin ningún aviso que lo explique. Se arregla ejecutando
  `supabase/permisos-por-hermandad.sql`.

### Y le pone freno a lo que se puede meter desde la web

Hay tres puertas que empuja cualquiera sin identificarse —el buzón, las
solicitudes de alta y el contador de visitas— y ninguna tenía tope. El campo
trampa para robots que llevan los formularios solo lo pisa quien pasa por el
formulario; quien habla con la base directamente, no.

Sin tope pasan dos cosas: se **ahoga el buzón** (diez mil mensajes de relleno y
los tres de verdad no hay quien los encuentre) y se **llena la base** — y en el
plan gratuito de Supabase ahí no se cae solo el buzón, se cae la hermandad
entera con su censo y sus cuotas dentro.

Los topes son holgados: 60 mensajes por hora, 300 solicitudes pendientes a la
vez, 300 rutas distintas por día en el contador. Ninguna hermandad se acerca. Y
la propia hermandad, con sesión, no se frena a sí misma.

### Y borra las contraseñas que había guardadas en claro

`solicitudes_alta.clave_propuesta` guardaba, en claro, la contraseña que
tecleaba quien pedía el alta desde la web. La ve cualquiera del personal con el
módulo «hermanos», y se quedaba ahí mientras la solicitud estuviera pendiente.
La gente repite contraseñas: la que veía la secretaría es probablemente la de su
correo.

Ya no se pide ninguna — la clave se genera al aprobar y se manda por correo, que
es lo que ya se hacía con el alta de un menor. Este SQL **borra las que hubiera
guardadas** y pone un disparador para que no entren más, ni siquiera desde un
navegador que tenga abierta la versión anterior de la aplicación.

Después de ejecutarlo, esto tiene que devolver 0:

```sql
select count(*) from solicitudes_alta where coalesce(clave_propuesta, '') <> '';
```

### Y el agujero que cierra: el hermano que se pone la cuota pagada

El hermano puede escribir en su recibo —es como avisa de que ha pagado por
Bizum— y esa política se dejó **sin acotar por columnas**, con el razonamiento
de que «la aplicación solo le deja tocar el aviso de pago». Pero él tiene una
sesión de verdad, y desde la consola del navegador habla con la base
directamente, sin pasar por ninguna pantalla:

```js
supabase.from('cuotas').update({ estado: 'Pagada', importe: 0 }).eq('hermano_id', …)
```

En ese momento su recibo queda pagado y a cero, sale al corriente, se lleva su
papeleta de sitio, y las cuentas dicen que ese dinero entró. La tesorería no
tiene forma de notarlo. Comprobado contra Postgres.

Después de ejecutar el SQL, esto tiene que devolver cuatro filas:

```sql
select tgname from pg_trigger
where tgrelid in ('cuotas'::regclass, 'papeletas'::regclass) and not tgisinternal;
```

`cuotas_el_hermano_solo_avisa` y `papeletas_lo_que_toca_el_hermano`, además de
los dos `apuntar_*` del registro de actividad.

### Y lo que desbloquea: la hermandad número dos

`catalogos` —donde viven las categorías de ingreso y de gasto, las cuentas de
tesorería, los tipos de incidencia y las categorías del inventario— tenía la
clave sin la hermandad. Como esas listas son las menos distintivas que hay
(«Cera», «Flores», «Limosnas», «Caja», «Bueno»), **la segunda hermandad que
entrara no podía guardar casi ninguna de las suyas**: la fila ya existía, de
otra gente, y el guardado se estrellaba contra una clave duplicada. Y no se veía
venir, porque esa fila es de otra hermandad y por tanto invisible.

Después de ejecutarlo, esto tiene que decir `hermandad_id, clave, valor`:

```sql
select pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'catalogos'::regclass and contype = 'p';
```

### Y el aviso de seguridad que arregla

Hasta este SQL, apuntarse a los avisos de la web **devolvía la llave** de esa
suscripción a quien lo pidiera, sin identificarse. Y si el correo ya estaba
apuntado, devolvía **la llave de esa persona**. Con la dirección de cualquiera
de la lista se podía confirmar su alta por ella —falsificando la prueba del
consentimiento que exige el RGPD— o darla de baja, una detrás de otra.

Después de ejecutarlo, la llave no sale de la base. Se comprueba así:

```sql
select pg_get_function_result(oid) from pg_proc where proname = 'suscribirse_a_la_web';
```

Tiene que decir **`boolean`**. Si dice `text`, el SQL no ha entrado.

---

### Y con esto ya se puede ser hermano de dos hermandades

En Andalucía es lo normal, y hasta ahora esa persona solo podía entrar en el
área de una: las cuentas de Supabase se identifican por correo, y el correo es
único, así que la segunda hermandad se estrellaba con «ese correo ya lo usa otra
cuenta».

Se separan dos cosas que estaban pegadas sin necesidad: **su correo** (el de los
avisos, el mismo en las dos hermandades, no se toca) y **cómo se llama su cuenta
por dentro** (una por hermandad + DNI, que no ve ni teclea nadie). Sigue
entrando igual: elige hermandad, su DNI y su contraseña.

Las contraseñas son **independientes**: son dos cuentas.

**Nadie que ya tenga cuenta se entera de nada.** Su columna nueva está vacía y
entonces se usa su correo de siempre. Compruébalo después de ejecutar:

```sql
select count(*) as fichas, count(correo_acceso) as con_cuenta_propia from hermanos;
```

`con_cuenta_propia` en 0 al principio es lo correcto: se va llenando según se
creen cuentas nuevas.

---

## AHORA — volver a desplegar la función de correo

**Edge Functions → `enviar-correo` → Deploy a new version**, con el contenido de
`supabase/functions/enviar-correo/index.ts`.

**Por qué, y no es opcional:** dos motivos. El primero, que el correo de
confirmar una suscripción **no se mandaba nunca**. No había forma — quien se apunta desde la web pública no tiene
sesión, y el envío la exigía. Así que el formulario decía «te hemos mandado un
correo» y no salía ninguno; y como a quien no confirma no se le escribe, la
lista de suscriptores se llenaba de gente a la que la hermandad no podía avisar
de nada, y un comunicado «a los suscriptores» llegaba a **cero personas**.

La versión nueva lo manda ella, con la clave de servicio y sin que la llave pase
por el navegador de nadie.

**No hace falta ningún secreto nuevo**: `SUPABASE_SERVICE_ROLE_KEY` la pone
Supabase sola en todas sus funciones. Solo si algún día la aplicación deja de
vivir en `gobergo.com`, hay que añadir el secreto `GOBERGO_WEB` con la dirección
nueva — es a donde apunta el enlace de confirmar.

Y el segundo: **«he olvidado mi contraseña» del hermano ahora sale por aquí**.
Antes lo mandaba Supabase a la dirección de la cuenta; con la cuenta llamándose
por hermandad + DNI, esa dirección no recibe nada. La función busca el correo de
verdad en la ficha y manda ahí el enlace. Sin desplegarla, los hermanos con
cuenta nueva no podrían recuperar su acceso.

### A los que ya estaban apuntados

Están todos sin confirmar, esperando un enlace que nunca salió. Se recuperan de
una vez desde **Comunicados → escribir uno → destinatario «Suscriptores de la
web»**: ahí sale cuántos faltan y un botón para mandarles el enlace.

---

## AHORA — una casilla, si quieres el «he olvidado mi contraseña»

**Authentication → Sign In / Providers → Email**

Ahí abajo, en *Password recovery*, tiene que estar habilitado (viene de serie).

Y en **URL Configuration → Redirect URLs**, comprueba que está:

```
https://web-semana-santa.vercel.app/hermano
```

Es a donde vuelve el hermano desde el enlace del correo. Si no está, el correo
le llega, pulsa, y Supabase le rechaza la vuelta sin decirle por qué.

> Con «Confirm email» desactivada, la recuperación **sigue funcionando**. Son
> dos cosas distintas: una es confirmar que el correo es suyo al registrarse,
> la otra es recuperar el acceso. Puedes tener la segunda sin la primera.

---

## NADA MÁS, POR AHORA

El resto de lo hecho estos días es aplicación, no base de datos:

| Qué | ¿Toca Supabase? |
|---|---|
| El cambio de nombre a Gobergo | No |
| Los huecos legales | No |
| El correo por hermandad | Sí: hay que volver a desplegar `enviar-correo` (arriba) |
| La web en su dominio propio | No |
| La copia local entre hermandades | No |
| La vista previa de importar | No |
| El «he olvidado mi contraseña» | Solo la Redirect URL de arriba |

---

## CUANDO COMPRES EL DOMINIO

Todo junto en `CUANDO-TENGA-DOMINIO.md`. En Supabase concretamente:

1. **URL Configuration** → Site URL y Redirect URLs con el dominio nuevo
2. **Authentication → Emails → SMTP** → cambiar de Gmail a Resend
3. **Edge Functions → Secrets** → `RESEND_API_KEY` y `CORREO_REMITENTE`
4. **Edge Functions → Deploy** → la función `enviar-correo`

> `CORREO_REMITENTE` ahora es **solo la dirección**, sin nombre delante:
> `no-responder@gobergo.es`. El nombre lo pone cada hermandad, sacado de su
> ficha, y al hermano le llega «Hdad. de la Amargura <no-responder@gobergo.es>».

---

## CUANDO PAGUES EL PLAN

**Database → Backups.** En el gratuito no hay copias automáticas.

Es el riesgo que más me preocupa de todos: la hermandad mete su censo durante
una semana, algo se pierde, y no hay vuelta atrás. Eso no lo perdona nadie y te
cierra esa puerta para siempre.

---

## Si algo falla

**Logs → Auth** para todo lo de cuentas y correos. Ahí sale el motivo de
verdad, no el «error» que enseña el navegador. Es donde se vio que el 500 del
registro era el correo saliente y no la aplicación.
