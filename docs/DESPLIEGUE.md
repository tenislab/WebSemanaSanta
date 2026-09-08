# Desplegar sin romper nada

Guía para quien mantiene Gobergo. Lo que hay que saber antes de subir una
versión, y lo que hay que hacer cuando algo sale mal.

---

## El problema de fondo

Gobergo tiene **dos mitades que se actualizan por separado**:

| | Cómo se actualiza | Cuándo llega |
|---|---|---|
| La aplicación | Se despliega el paquete | A todas las hermandades, en 5 minutos |
| La base de datos | Cada hermandad pega `ACTUALIZAR.sql` a mano | Cuando se acuerda. Si se acuerda |

De ahí salen los dos problemas que hay que tener presentes siempre:

1. **Siempre hay hermandades con la aplicación nueva y la base vieja.** No es
   un caso raro: es lo normal durante días o semanas.
2. **Un despliegue malo las rompe a todas a la vez.** En octubre es un mal
   día. En Semana Santa es una catástrofe: es la semana en que se imprimen
   las papeletas y se monta el cortejo.

Todo lo que hay debajo existe por uno de esos dos.

---

## 1. Si tu cambio toca la base de datos

**Lo que pasa si no haces nada:** la aplicación escribe en una columna que la
base todavía no tiene. Postgres **no ignora la columna de más: rechaza la
sentencia entera.** No se pierde ese dato — se pierde la fila. El tramo
entero. El cobro entero. Y en pantalla no pasa nada raro: se rellena, se
guarda, dice que se ha guardado, y al recargar está en blanco.

### Los pasos

1. Escribe tu `.sql` nuevo en `supabase/`, con `if not exists` en todo. Tiene
   que poder ejecutarse dos veces sin que pase nada.
2. Añádelo a **las dos listas**: `PIEZAS` en `scripts/generar-todo-en-uno.mjs`
   y `PIEZAS_ACTUALIZACION` en `scripts/generar-actualizar.mjs`, **en la misma
   posición relativa**.
3. Sube `VERSION_ESQUEMA` en `src/lib/versionEsquema.ts` al nuevo número de
   piezas.
4. Regenera:
   ```
   node scripts/generar-todo-en-uno.mjs
   node scripts/generar-actualizar.mjs
   ```
5. `npm test`.

Si te saltas el paso 3, `npm test` te lo dice y te da el número exacto. Si te
saltas el 2 o el 4, también.

### Y avisa a las hermandades

Mientras no peguen `ACTUALIZAR.sql`, la aplicación les enseña una banda arriba
que lo dice y explica qué hacer. Eso no sustituye a mandarles un correo: solo
evita que el fallo sea mudo mientras tanto.

---

## 2. Si tu cambio es arriesgado: sácalo por fases

**Cuándo aplica:** cuando el cambio afecta a lo que se ve en pantalla, a lo que
se guarda, o a dinero. No hace falta para arreglar un color.

En vez de desplegarlo encendido para todos:

1. Escribe el camino nuevo **detrás de una bandera**, y **deja el viejo
   entero**:
   ```ts
   import { esNovedad, NOVEDADES } from '../lib/novedades'

   if (esNovedad(NOVEDADES.loQueSea)) {
     // el camino nuevo
   } else {
     // EL DE SIEMPRE, que sigue aquí y sigue funcionando
   }
   ```
2. Despliega. Todo el mundo tiene el código; **nadie lo ve** (una bandera que
   no está en la tabla está apagada).
3. Enciéndela para los pilotos:
   ```sql
   insert into novedades (clave, descripcion, desde_canal)
   values ('lo-que-sea', 'Qué hace', 'piloto');
   ```
4. Espera una semana. Mira `errores_cliente` (ver abajo).
5. Para todas:
   ```sql
   update novedades set desde_canal = 'estable' where clave = 'lo-que-sea';
   ```

**Y si sale mal:**
```sql
update novedades set desde_canal = 'apagado' where clave = 'lo-que-sea';
```
Diez segundos, sin desplegar nada, sin esperar a que se reconstruya el
paquete, sin llevarte por delante lo demás que hubiera entrado en medio.

Para poner a una hermandad de piloto:
```sql
update hermandades set canal = 'piloto' where nombre ilike '%Nazareno%';
```
Ser piloto **se pide**: una hermandad que no sabe que está probando cosas no
está probando, las está sufriendo.

### La regla que ninguna prueba puede comprobar por ti

**La bandera envuelve código nuevo; nunca sustituye al viejo.** Si borras el
camino viejo «porque ya está el nuevo», la bandera deja de ser una marcha
atrás y pasa a ser un interruptor entre «funciona» y «no funciona».

Cuando la novedad lleve meses en `estable` y ya no pienses volver atrás: borra
la bandera **y** el camino viejo, en el mismo commit.

---

## 3. Después de desplegar: mira qué se ha roto

No esperes a que te lo cuenten. Con tres hermandades te enteras por WhatsApp;
con cincuenta el primer aviso es que alguien se da de baja.

En el **SQL Editor** de Supabase:

```sql
-- Lo que más se ha roto esta semana:
select mensaje, count(*), max(ocurrido_el)
  from errores_cliente
 where ocurrido_el > now() - interval '7 days'
 group by mensaje order by count(*) desc;

-- Y a quién le pasa:
select h.nombre, e.mensaje, e.ruta, e.version_app, e.ocurrido_el
  from errores_cliente e left join hermandades h on h.id = e.hermandad_id
 order by e.ocurrido_el desc limit 50;
```

`version_app` es la fecha de compilación. Sirve para lo que de verdad hace
falta: saber si quien sufre el fallo tiene ya el arreglo.

Los mensajes vienen **sin identificadores, sin direcciones y sin correos**
(ver `src/lib/vigilancia.ts`): sirven para agrupar y no llevan datos de nadie.

---

## 4. Cuando una hermandad pida ayuda

En vez de tres correos pidiendo capturas:

```sql
-- ¿Cuál era?
select * from soporte_hermandades();

-- Entrar:
select soporte_entrar('el-uuid', 'no le imprime las papeletas');
```

Recarga Gobergo: estás dentro, viendo exactamente lo suyo, con una banda roja
arriba que no se puede cerrar. Al terminar:

```sql
select soporte_salir();
```

Caduca sola a las dos horas y **queda escrito en el registro de actividad de
esa hermandad** — ellos lo ven. Requiere estar dado de alta una vez en
`soporte_cuentas`; las instrucciones están en `supabase/soporte.sql`.

---

## 5. Si una hermandad borra algo por error

Ahora se puede restaurar de verdad contra la base de datos, cosa que antes no.
Va desde **Configuración → Copia de seguridad → Restaurar copia**, y solo lo
puede hacer quien figura como **titular**.

Lo que hace, en orden:

1. **Descarga al disco una copia de lo que hay ahora.** Si eso falla, no
   sigue.
2. Vacía las tablas de esa hermandad — y solo de esa.
3. Mete las filas del archivo.

Entre el 2 y el 3 hay unos segundos sin datos. Por eso el paso 1 no es
opcional.

**Una copia con fallos no se vuelca nunca.** `crearCopia` apunta lo que no
pudo traer; volcarla borraría el censo para meter una parte, que es el
escenario que convierte la red de seguridad en la causa de la pérdida.

---

## Lo que sigue sin estar, y conviene saberlo

- **No hay despliegue gradual del paquete.** Las banderas cubren el 90 % de
  los casos, pero un fallo en el arranque de la aplicación —antes de que se
  lea ninguna bandera— sigue llegando a todos a la vez. Eso se arregla en el
  alojamiento, no aquí.
- **La restauración no es atómica.** Ver arriba.
- **`errores_cliente` no avisa por correo.** Hay que ir a mirarla. Un cron que
  mande un resumen semanal sería media hora de trabajo y está sin hacer.
- **La web pública no reporta errores.** Se pinta sin sesión, y dejar la tabla
  abierta a escrituras anónimas sería un problema mayor que el que resuelve.
