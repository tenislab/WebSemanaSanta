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

## Cómo va, a 4 de octubre de 2026

Hecho en una sesión guiada, comprobando cada paso:

| | Paso | Cómo quedó |
|---|---|---|
| 1 | El SQL nuevo | **hecho** · `version_del_esquema()` dice 74 y la comprobación corta sale limpia |
| 1 bis | El PDF público en incógnito | **hecho** · baja sin sesión de ninguna clase |
| 1 bis | El hermano, en su área | **hecho** · ve las reglas y **no** ve las actas |
| 2 | `api/w.ts` y `api/seo.ts` | **pendiente** · hay que desplegar |
| 3 | `pg_cron` | **hecho** · las cinco tareas activas |
| 4 | Copias automáticas | **pendiente** · es pagar el plan |
| 5 | La hermandad de prueba | **pendiente** |
| 6 | Las plantillas de correo | **hechas** las dos que importan (registro y contraseña) |

**Lo que de verdad se cerró con esto** es la única parte de los documentos que no
se podía probar desde el repositorio. Las políticas están medidas contra un
Postgres montado igual que el de Supabase, pero *cómo sirve Storage un fichero a
alguien sin cuenta* ya no es Postgres: eso solo se sabe pulsándolo, y se pulsó.

**Dos cosas que aprendió el documento esa tarde**, y están puestas donde tocan:

- `DIAGNOSTICO.sql` se quedó a medias al pegarlo —626 líneas— y el error no lo
  dice: `syntax error at or near ")"`. De ahí sale `COMPROBACION-CORTA.sql`.
- `pg_cron` ya estaba encendido y había **dos** tareas de una versión vieja del
  fichero. Pegarlo otra vez las dejó las cinco al día sin duplicar ninguna,
  que es para lo que cada tarea hace `unschedule` de sí misma antes de crearse.

Y una que no es de esta lista pero se vio aquí: **el paso 2 es el que menos
parece y más calla.** Cuando `api/seo.ts` no está desplegada, no se cae la
aplicación: se cae la vista previa del enlace que la hermandad pega en su grupo
de WhatsApp, y no sale ningún error en ningún registro.

---

## 1 · Pegar el SQL nuevo

**Supabase → SQL Editor.** Se pega `supabase/ACTUALIZAR.sql` entero, de una vez.

Va después de todo lo demás por una razón: lleva **todas** las piezas del
instalador, en su orden, así que deja la base igual que una recién instalada.
Aquí no hay que comprobar nada a mano — solo que no dé error.

**Y eso está ensayado, no supuesto.** Dos medidas distintas:

- `pruebas/actualizardesdevieja.prueba.mjs` instala **dos instaladores antiguos
  de verdad** —guardados tal cual en `pruebas/esquemas-anteriores/`— les mete
  datos y les pasa el `ACTUALIZAR.sql` de hoy por encima, dos veces. Corre en
  cada `npm test`.
- `scripts/ensayar-la-actualizacion.mjs` hace lo mismo desde **todos los
  estados intermedios**: genera la base «como estaba en la versión N» pegando
  solo las N primeras piezas, y actualiza. La última pasada completa:
  **61 de 61 estados buenos**, del 10 al 70.

En los dos casos lo que se exige no es «sin error», que no es lo mismo que
«bien»: se compara el catálogo entero —tablas, columnas, valores por defecto,
políticas, índices, disparadores, funciones y permisos— con el de instalar hoy
desde cero, y tiene que ser **idéntico**. Más que los datos sembrados sigan ahí.

Antes de una tarde como esta conviene volver a pasarlo, que es para lo que está:

```bash
PGHOST=/tmp PGPORT=5433 node scripts/ensayar-la-actualizacion.mjs
PGHOST=/tmp PGPORT=5433 node scripts/ensayar-la-actualizacion.mjs 8   # rápido
```

**Cómo sabes que ha salido bien:**

```sql
select version_del_esquema();
```

Tiene que decir **74**, que es lo que pone `supabase/VERSION.json` hoy. Si dice
menos, el SQL no ha entrado (o ha entrado a medias y lo habría dicho: es una
sola transacción).

Y de paso, pegar `supabase/DIAGNOSTICO.sql`: enseña lo que falta o sobra en la
base. Lo bueno es que **no diga nada** («No rows returned»).

> **OJO AL PEGARLO: son 626 líneas y se queda a medias con facilidad.** Pasó en
> la primera tarde de verdad, y el error no ayuda nada —`syntax error at or
> near ")"`, señalando una línea que en el fichero completo está en otro sitio—:
> en ningún momento dice que lo que ha llegado es un quinto del fichero.
>
> Para saber que ha entrado entero, la última línea tiene que ser
> `order by "Qué pasa", "Tabla", "Columna";`.
>
> Y si pelearse con el pegado estorba, **`supabase/COMPROBACION-CORTA.sql`** son
> seis `select` que cuentan lo que debería haber —versión, tablas, tablas sin
> RLS, funciones, cubos y tareas de `pg_cron`— y responden «bien» o «falta».
> Cuenta en vez de listar: dice SI falta algo, no QUÉ. Si alguna línea sale mal,
> entonces sí hay que pegar el grande, que es el que nombra la columna o la
> función concreta.

En la aplicación, la banda de arriba de «tu base va atrasada» tiene que
desaparecer.

---

### Y una cosa que hay que comprobar a mano: el PDF de un documento público

Las políticas de los documentos están probadas contra un Postgres montado
igual que el de Supabase, y eso cubre la lógica: quién ve qué fila, quién
puede pedir la ruta de qué fichero. Lo que **no** cubre es cómo sirve Supabase
Storage ese fichero a alguien **sin sesión de ninguna clase**, porque eso ya no
es Postgres.

Así que después de pegar el SQL, con dos minutos:

1. En el panel, **Archivo documental** → abre un documento que tenga PDF
   (o súbele uno) y pon «Hasta dónde sale → **La web pública**».
2. En **Web pública** → enciende la sección «Reglas y documentos» y publica.
3. Abre tu web **en una ventana de incógnito** —sin sesión— y pulsa
   «Descargar».

Si el PDF baja, está. Si da un error de permisos, lo que falta es la política
`documentos_archivo_publico` del cubo: compruébala en
Storage → Policies → `objects`.

Lo mismo con el área del hermano: entra con el DNI y la clave de un hermano y
mira que «Documentos de la hermandad» le ofrezca las reglas y **no** las actas.

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

Son cinco tareas, todas de madrugada:

| Tarea | Cuándo | Qué hace |
|---|---|---|
| `gobergo-limpiar-visitas` | domingos 4:10 | tira las visitas de más de dos años |
| `gobergo-suscriptores-sin-confirmar` | a diario 4:25 | borra los que nunca confirmaron |
| `gobergo-limpiar-registro` | domingos 4:40 | limpia el registro de accesos |
| `gobergo-limpiar-errores` | domingos 4:55 | tira los fallos de producción de más de 60 días |
| `gobergo-caducar-reservas` | a diario 5:20 | caduca las reservas de la tienda |

Hasta que esto esté encendido, esas cinco cosas **no pasan nunca**, o pasan
cuando alguien entra en el panel — y en agosto no entra nadie en un mes.

> **La de los fallos se había quedado sin programar.** `vigilancia.sql` crea la
> función y su propio comentario decía «la llama el trabajo semanal de cron», y
> ese trabajo no existía. Y la función está revocada a todo el mundo —a
> propósito: lo que guarda esa tabla es lo único que cuenta qué se rompe en las
> bases de verdad, y un visitante no puede borrarlo—, así que no la llamaba
> **nadie** y la tabla era eterna. Ahora es la quinta tarea de este fichero.

**Cómo sabes que ha salido bien:**

```sql
select * from tareas_programadas();
```

Cinco filas, las cinco `activa = true`. Esta función la trae el propio
`tareas-programadas.sql` y enseña de una vez el nombre, la hora, si está activa
y **cómo acabó la última ejecución** — que es lo que de verdad cierra el paso:
una tarea puede estar creada y fallar todas las noches, y lo hace en silencio y
de madrugada.

El día que se pega, la columna `ultima` sale vacía porque todavía no han
corrido. Al día siguiente tiene que decir `succeeded` en las cinco.

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
| 1 | El SQL nuevo | `version_del_esquema()` dice 74 y `DIAGNOSTICO.sql` no dice nada |
| 2 | `api/w.ts` y `api/seo.ts` | WhatsApp enseña el nombre de la hermandad al pegar su enlace |
| 3 | `pg_cron` | `select * from tareas_programadas()` da cinco filas activas y, al día siguiente, `succeeded` en todas |
| 4 | Copias automáticas | hay una copia **con fecha** en Database → Backups |
| 5 | La hermandad de prueba | no sale en la lista de `/entrar` |
| 6 | Las dos plantillas | el correo de registro llega en español y desde tu dominio |

**Lo que se tacha, se tacha en este documento el mismo día.** Un documento que
da por pendiente algo hecho hace meses genera trabajo que no existe; ya pasó
aquí con `COBROS-LO-QUE-FALTA.md`, que pedía cuatro cosas que llevaban meses
resueltas.
