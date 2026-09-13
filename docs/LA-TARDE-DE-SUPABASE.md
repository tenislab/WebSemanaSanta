# La tarde de Supabase y Vercel

Seis cosas que no son código: se hacen en dos paneles, con el ratón, en una
tarde. Están aquí porque no se pueden probar desde el repositorio y por eso se
posponen indefinidamente.

**Cada paso trae cómo saber que ha salido bien.** Sin eso es media tarde de
clics con la sensación de no estar seguro de nada, que es como se queda una
tarea a medias sin darse cuenta.

El orden importa solo en los dos primeros: el SQL antes de desplegar, y
`pg_cron` después del SQL.

---

## 1 · Pegar el SQL nuevo

**Supabase → SQL Editor.** Se pega `supabase/ACTUALIZAR.sql` entero, de una vez.

Va después de todo lo demás por una razón: lleva **todas** las piezas del
instalador, en su orden, así que deja la base igual que una recién instalada.
Eso ya se mide con instaladores antiguos de verdad en
`pruebas/actualizardesdevieja.prueba.mjs`, así que aquí no hay que comprobar
nada a mano — solo que no dé error.

**Cómo sabes que ha salido bien:**

```sql
select version_del_esquema();
```

Tiene que decir **70**, que es lo que pone `supabase/VERSION.json` hoy. Si dice
menos, el SQL no ha entrado (o ha entrado a medias y lo habría dicho: es una
sola transacción).

Y de paso, pegar `supabase/DIAGNOSTICO.sql`: enseña lo que falta o sobra en la
base. Lo bueno es que **no diga nada**.

En la aplicación, la banda de arriba de «tu base va atrasada» tiene que
desaparecer.

---

## 2 · Desplegar `api/w.ts` y `api/seo.ts`

**Vercel → el proyecto → Deployments → Redeploy** del último commit, o un push.
Son dos funciones de servidor: la que sirve el HTML de las webs de hermandad con
su cabecera para WhatsApp y Google, y la del sitemap.

No hay nada que configurar. Lo único que hay que mirar es que estén **vivas**,
porque cuando una de estas se cae no se cae la aplicación: se cae **la puerta
principal del dominio**, y en silencio.

**Cómo sabes que ha salido bien:**

- Entra en `gobergo.com/w/<slug-de-una-hermandad>` y que **se vea su web**.
- Pega esa misma dirección en un chat de WhatsApp y mira la vista previa: tiene
  que salir el **nombre de la hermandad**, no «Gobergo — Software para gestionar
  tu hermandad». Si sale lo segundo, la cabecera no se está generando; es el
  fallo silencioso de estas funciones y no hay error en ningún registro.
- `gobergo.com/sitemap.xml` tiene que devolver XML, no la página de venta.

---

## 3 · Encender `pg_cron`

**Supabase → Database → Extensions → buscar «pg_cron» → activar.** Está también
en el plan gratuito. Y luego pegar `supabase/tareas-programadas.sql`.

Si la extensión no está encendida, ese fichero **falla en la primera línea** y
no hace nada a medias, así que no hay riesgo de dejarlo por la mitad.

Son cuatro tareas, todas de madrugada:

| Tarea | Cuándo | Qué hace |
|---|---|---|
| `gobergo-limpiar-visitas` | domingos 4:10 | tira las visitas de más de dos años |
| `gobergo-suscriptores-sin-confirmar` | a diario 4:25 | borra los que nunca confirmaron |
| `gobergo-limpiar-registro` | domingos 4:40 | limpia el registro de accesos |
| `gobergo-caducar-reservas` | a diario 5:20 | caduca las reservas de la tienda |

Hasta que esto esté encendido, esas cuatro cosas **no pasan nunca**, o pasan
cuando alguien entra en el panel — y en agosto no entra nadie en un mes.

**Cómo sabes que ha salido bien:**

```sql
select jobname, schedule, active from cron.job order by jobname;
```

Cuatro filas, las cuatro `active = true`. Y al día siguiente:

```sql
select jobname, status, start_time from cron.job_run_details
order by start_time desc limit 10;
```

Los `status` tienen que decir `succeeded`. Esta segunda consulta es la que de
verdad cierra el paso: una tarea puede estar creada y fallar todas las noches.

---

## 4 · Las copias automáticas

**Supabase → Database → Backups.** En el plan gratuito **no hay**, así que este
paso es «pagar el plan» y comprobar que se ha activado.

Es el riesgo que más pesa de los seis: una hermandad mete su censo durante una
semana, algo se pierde, y no hay vuelta atrás. Eso no lo perdona nadie.

**Cómo sabes que ha salido bien:** en esa misma pantalla tiene que aparecer al
menos **una copia con fecha**. Que la opción esté activada no es lo mismo que
tener una copia hecha; hay que ver la fecha.

Mientras no esté: la hermandad puede bajarse su copia a mano desde
**Configuración → Copias y datos**, y esa copia ya se comprueba antes de
restaurar —no vacía las tablas hasta saber que encaja—. No sustituye a las
automáticas, pero no deja a nadie sin red.

---

## 5 · Borrar la hermandad de prueba «ijwbchijec»

Id `aad5d9ec-…`. Les sale a los hermanos en la lista de elegir hermandad, y no
existe.

**Antes de borrarla**, confirmar que la hermandad buena funciona: entrar, ver su
censo y sus cuotas. Borrar primero y comprobar después es como se pierde lo que
no se quería perder.

**Cómo sabes que ha salido bien:** entrar en `/entrar` como un hermano y que en
la lista de hermandades **no aparezca**.

> Y de paso, una que está apuntada al lado y es de un minuto: en la tabla
> `hermandades` esa hermandad se llama «particular» —que es lo que ven los
> hermanos al elegir— y firma los correos como «Real Hermandad del Nazareno».
> Un hermano buscaría «Nazareno» y no lo encontraría. Es cambiar un nombre.

---

## 6 · Las dos plantillas de correo

**Supabase → Authentication → Emails.** *Confirm signup* y *Reset password*
vienen en inglés de fábrica y son los dos correos que ve **todo** el que se
registra o pierde su contraseña.

**El texto en español ya está escrito**, no hay que redactar nada: está en
[`PLANTILLAS-CORREO.md`](PLANTILLAS-CORREO.md), con las cuatro plantillas
(también *Magic Link* y *Change Email Address*, que se pegan igual y ya que
estás).

**Cómo sabes que ha salido bien:** regístrate con una dirección tuya que no esté
en la base y pide un «he olvidado mi contraseña». Los dos correos tienen que
llegar **en español** y con el remitente de tu dominio. Si llegan en inglés, la
plantilla no se guardó; si llegan de `supabase.io`, lo que falta es el SMTP de
la sección 5 de [`CUANDO-TENGA-DOMINIO.md`](CUANDO-TENGA-DOMINIO.md).

---

## Al terminar: las seis, de un vistazo

| | Paso | Está hecho cuando |
|---|---|---|
| 1 | El SQL nuevo | `version_del_esquema()` dice 70 y `DIAGNOSTICO.sql` no dice nada |
| 2 | `api/w.ts` y `api/seo.ts` | WhatsApp enseña el nombre de la hermandad al pegar su enlace |
| 3 | `pg_cron` | cuatro filas en `cron.job` y, al día siguiente, `succeeded` en `cron.job_run_details` |
| 4 | Copias automáticas | hay una copia **con fecha** en Database → Backups |
| 5 | La hermandad de prueba | no sale en la lista de `/entrar` |
| 6 | Las dos plantillas | el correo de registro llega en español y desde tu dominio |

**Lo que se tacha, se tacha en este documento el mismo día.** Un documento que
da por pendiente algo hecho hace meses genera trabajo que no existe; ya pasó
aquí con `COBROS-LO-QUE-FALTA.md`, que pedía cuatro cosas que llevaban meses
resueltas.
