# Gobergo para un ingeniero que llega hoy

Este documento es el mapa. No cuenta lo que hay que hacer (eso es
[`HOJA-DE-RUTA.md`](HOJA-DE-RUTA.md)) ni cómo se trabaja aquí (eso es
[`COMO-TRABAJAR.md`](COMO-TRABAJAR.md)): cuenta **cómo está construido esto y
por qué está construido así**, para que puedas abrir cualquier fichero y
entender qué estás mirando.

Está escrito de arriba abajo en el orden en que hacen falta las cosas. Si solo
vas a leer dos secciones, lee **§2 (el vocabulario)** y **§5 (los dos modos)**:
sin la primera el código no se entiende, y sin la segunda parece que hay dos
aplicaciones donde hay una.

**Tamaño, para que sepas a qué te enfrentas:** 373 ficheros TypeScript, 86.570
líneas en `src/`; 85 ficheros SQL; 152 ficheros de prueba con 6.075
comprobaciones. No es un proyecto de juguete y no se abarca en una tarde.

---

## 1. Qué es el producto

Software de gestión para **hermandades y cofradías** (las corporaciones
religiosas que organizan las procesiones de Semana Santa en España). Una
hermandad es, en términos de software, una pequeña organización con socios de
cuota: tiene un censo de miembros, les cobra una cuota anual, organiza un
desfile una vez al año asignando a cada miembro un sitio concreto, lleva su
contabilidad, su inventario, su archivo documental y su web.

Son **tres audiencias distintas sobre los mismos datos**, y esa es la primera
cosa estructural que hay que tener en la cabeza:

| Quién | Dónde entra | Qué ve |
|---|---|---|
| **La junta de gobierno** (secretaría, tesorería…) | `/app` — el panel | Todo lo de su hermandad, recortado por su cargo |
| **El hermano** (el socio) | `/hermano` — su área | Su ficha, sus cuotas, su papeleta, y lo que la hermandad le publique |
| **Cualquiera** | `/w/:slug` — la web pública | Lo que la hermandad decide publicar, sin cuenta |

Casi todo el diseño de permisos de este proyecto es la frontera entre esas tres
columnas. Cuando veas una decisión que parece paranoica, suele ser porque el
dato de en medio es un dato personal de una persona real.

---

## 2. El vocabulario del dominio

**Esto no es opcional.** El código está escrito en español, con los nombres que
usa una hermandad, y sin estas ocho palabras no se puede leer.

- **Hermano / hermana** — el socio. `src/data/hermanos.ts`. Tiene un **número**
  de orden (el escalafón: cuanto más bajo, más antiguo) y un año de
  **antigüedad**. El número 0 significa «no ocupa escalafón».
- **Cuota** — el recibo anual de ese socio. `src/data/cuotas.ts`. Se **emiten**
  en bloque para un **ejercicio** (un año) y luego se cobran, en mano o por
  **remesa SEPA** (un fichero XML que se lleva al banco).
- **Papeleta de sitio** — el documento que un hermano saca cada año para
  participar en la procesión. Es a la vez un recibo y una entrada: dice qué
  sitio le toca.
- **Cortejo** — la procesión en sí, vista como una estructura: va dividida en
  **tramos**, y cada tramo tiene puestos (cirio, insignia, costalero…). Asignar
  el cortejo es repartir mil personas entre esos puestos, y es lo que una
  hermandad discute durante todo el año.
- **Cabildo** — la asamblea de hermanos. Aparece como prefijo en **todas** las
  claves de `localStorage` (`cabildo-hermanos`, `cabildo-cuotas`…) porque era
  el nombre anterior del producto. No lo cambies: hay datos guardados en
  navegadores con esas claves.
- **Cargo** — el puesto en la junta (Hermano Mayor, Secretario/a, Tesorero/a,
  Fiscal, Mayordomo/Prioste…). `src/data/documentos.ts` → `CARGOS`. Es lo que
  decide qué módulos del panel ve cada persona.
- **Titular** — ambiguo a propósito en el dominio, y aquí significa dos cosas
  distintas según el contexto: la **imagen** que procesiona (un Cristo, una
  Virgen), y la cuenta que es dueña de la hermandad en la plataforma. En el
  código la segunda es siempre `soyTitular()` / `es_titular`.
- **Estación de penitencia** — la salida anual. «El día de la salida» es *el*
  día del año para una hermandad, y varias decisiones de rendimiento de este
  repositorio existen solo por lo que pasa ese día (ver §12).

---

## 3. La pila

- **Vite** + **React 18** + **TypeScript** en modo estricto. Sin framework de
  servidor: es una SPA que se sirve estática.
- **React Router** para las rutas.
- **Supabase** (Postgres + Auth + Storage) como todo el backend. No hay
  servidor propio: el navegador habla con Postgres a través de PostgREST, y
  **quien decide qué filas puede ver cada uno es la base de datos**, con RLS
  (ver §7).
- **CSS propio** con tokens y modo claro/oscuro. Sin Tailwind, sin librería de
  componentes.
- **Vercel** para el despliegue. `api/` son dos funciones serverless (`seo.ts`
  y `w.ts`) que sirven las etiquetas Open Graph y el `sitemap.xml` de las webs
  de las hermandades, porque eso un bot de Twitter no lo ejecuta en JavaScript.
- **Supabase Edge Functions** en `supabase/functions/`: enviar correo, crear
  pagos y suscripciones de Stripe, y el webhook de Stripe. Son lo único que
  corre con claves de servicio, y están ahí justamente para que esas claves no
  bajen al navegador.

```bash
npm install
cp .env.example .env     # sin rellenar nada, arranca en modo local (§5)
npm run dev              # http://localhost:5173

npm run typecheck        # tsc estricto
npm run lint             # ESLint — está en CERO avisos, y se entrega así
npm run build
npm test                 # las 6.075 comprobaciones (§10)
```

---

## 4. El mapa de carpetas

```
src/
  App.tsx          Las rutas y la estrategia de carga por trozos (§11)
  main.tsx         El arranque
  context/         AuthContext: quién ha entrado y en qué modo
  pages/           Una por pantalla. Las de `pages/app/` son el panel.
  components/      Lo reutilizable (59 ficheros) + los componentes de pantalla
  lib/             136 módulos: TODA la lógica que no es pintar
  lib/db/          Los traductores camelCase ⇄ snake_case, uno por tabla
  data/            Los tipos del dominio y los datos de ejemplo
  styles/          CSS
supabase/          85 ficheros SQL: el esquema, las políticas y las funciones
pruebas/           152 ficheros `*.prueba.mjs` + el corredor
scripts/           Generadores y herramientas; `scripts/caza/` son las sondas
api/               Las dos funciones serverless de Vercel
docs/              Esto
```

**La regla de oro del reparto:** si una función se puede probar sin un
navegador, va en `src/lib/`. Las pantallas pintan y ordenan; no calculan. Por
eso `lib/` tiene 136 ficheros y por eso las pruebas pueden ser 6.000
comprobaciones sin montar React ni una sola vez.

### Las pantallas grandes están partidas, y hay un criterio

Siete pantallas pasaban de las 1.700 líneas y se han partido. El criterio **no
es el número de líneas**: es cuántos props costaría sacar cada trozo, medido
antes de mover nada, y contando con llevarse su estado dentro. Un componente
con 31 props es peor que el fichero gordo — no se lee, se descifra.

Cuando una pantalla se parte, sus trozos van a una subcarpeta con su nombre
(`pages/app/censo/` para Hermanos, `pages/app/comunicados/`, `pages/app/web/`…)
y **la fuente de la pantalla pasa a ser la carpeta entera**. Eso importa para
las pruebas: ver §10.

---

## 5. Los dos modos, que es la decisión que explica media aplicación

La aplicación funciona **entera** con y sin base de datos.

```
¿Hay VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY?
  NO  → MODO LOCAL: todo vive en localStorage. Se pueden dar altas, cobrar,
        emitir papeletas, publicar la web. Las cuentas se crean y entran.
        Es como se enseña el producto y como se desarrolla.
  SÍ  → MODO REAL: los datos viven en Postgres, el login es Supabase Auth.
```

`src/lib/supabase.ts` → `isSupabaseConfigured`.

**Por qué existe el modo local:** se puede desarrollar y demostrar el producto
completo sin levantar nada. Casi todas las pruebas se apoyan en él.

**La trampa que tiene, y cómo está cerrada.** Si Supabase está configurado pero
no responde (el plan gratuito **pausa** el proyecto tras unos días de
inactividad), caerse al modo local es un desastre callado: la secretaria entra,
ve un censo **que no es el suyo** —los hermanos de ejemplo, con nombres
inventados— y pasa la tarde dando altas y cobrando recibos que no existen en
ningún sitio. Nada avisa, porque desde dentro se ve una aplicación que
funciona.

Así que **la caída al modo local está desactivada por defecto** y lo que se pide
a mano es quitar el seguro (`VITE_MODO_LOCAL=1`, solo para desarrollo). Estuvo
al revés, esperando que alguien se acordara de activar la protección el día de
abrir al público: un seguro que hay que acordarse de activar no es un seguro.

**Consecuencia práctica para ti:** cada función que toca datos tiene dos
caminos. Verás este patrón por todas partes, y no es duplicación por descuido:

```ts
if (!isSupabaseConfigured || !supabase) {
  /* … el camino del navegador … */
  return
}
/* … el camino de la base … */
```

Lo que **sí** hay que vigilar es que los dos digan lo mismo. Varias pruebas
existen solo para comparar las dos mitades.

---

## 6. Cómo viaja un dato

El corazón es `src/lib/supabaseSync.ts` → **`useSupabaseTable`**. Lo monta cada
pantalla para su colección:

```ts
const [hermanos, setHermanos] = useSupabaseTable<Hermano>(
  'hermanos',                    // la tabla en Postgres
  CLAVES_DATOS.hermanos,         // la clave de localStorage
  HERMANOS_INICIALES,            // los datos de ejemplo
  hermanoToRow, rowToHermano,    // los traductores (lib/db/hermanos.ts)
  'numero',                      // el orden
)
```

Devuelve algo que **se usa igual que un `useState`**, y por dentro:

1. Pinta al instante con lo que haya en `localStorage` (o los datos de ejemplo).
2. Pide la tabla a Supabase y repinta.
3. Cada `setX` escribe en la base **y** deja copia en `localStorage`.
4. Escucha los cambios de otras pestañas.

### Por qué hay un espejo en `localStorage` incluso con base de datos

Porque las pantallas se leen entre ellas. Hermanos necesita saber el tramo de
cada hermano (que está en las papeletas); Comunicados necesita saber quién debe
dinero (que está en las cuotas). Esas lecturas cruzadas se hacen con
`leerDatos()` contra el espejo, sin montar la pantalla dueña del dato. Sin
espejo, verían los datos de ejemplo para siempre.

### El hueco del arranque

Entre montar la pantalla y recibir la tabla pasan unos cientos de milisegundos.
En ese rato `cargado` es falso y un guardado **no se sincroniza** — eso está
bien y no se toca: comparar contra una lista que nunca vino de la base es
pedirle a `sincronizar` que borre en Supabase todo lo que no aparece, o sea el
censo entero.

Lo que estaba mal era el final de la carga: machacaba ese cambio sin decir nada,
en la pantalla y en el espejo. Ahora se apunta la **diferencia** del hueco y se
reaplica encima de lo que trae la base (`conLoDelHueco`), y entonces sí se
sincroniza. Va por diferencia y no repitiendo la orden de guardado porque a
`setItems` se le puede dar una lista ya hecha, y esa lista se construyó sobre un
hueco casi siempre vacío: reaplicarla tal cual borraría lo que acaba de llegar.

### Las dos trampas del espejo, las dos ya pagadas

**`sinEspejo`.** El panel y el área del hermano montan el mismo hook con la
misma clave local, pero ven cosas muy distintas: a un hermano, RLS solo le deja
ver **su** ficha. En el ordenador de la casa de hermandad, con el panel abierto
en una pestaña y un hermano entrando en otra, la consulta del hermano devolvía
1 fila, espejaba `cabildo-hermanos` con esa única fila, y la secretaria veía
cómo sus 400 hermanos se convertían en 1 delante de sus ojos. Por eso el área
del hermano pasa `sinEspejo: true`.

**La ventana.** Cuotas enseña un ejercicio y se traía diez: eso deja de caber en
el navegador solo con que pase el tiempo. La ventana (`lib/ventanaHistorico.ts`)
son **dos mitades que tienen que decir exactamente lo mismo**: `filtroOr` va a
la base, `dentro()` responde a la misma pregunta en memoria. No las construyas a
mano — dos mitades que discrepan no dan error, dan totales que no cuadran.
Y el espejo entonces **mezcla** en vez de sustituir, para no borrarle a las
otras pantallas la historia que caía fuera.

### Lo que NO pasa por aquí

Cuando una operación son varias cosas que tienen que pasar juntas, **no se hace
desde el navegador**: se llama a una función de Postgres. Una venta de la tienda
son seis escrituras (la factura, sus líneas, el stock, el apunte de tesorería…),
así que la escribe `registrar_venta`. Lo mismo con las remesas, los
certificados, el registro de actividad y los cobros.

Y hay cosas que **a propósito no se guardan en dos sitios**: lo recaudado por
una campaña se cuenta desde los apuntes de Tesorería cada vez, para que no haya
dos verdades sobre el mismo dinero.

### Cuando no hay red

`lib/colaEscritura.ts`: si una escritura falla por red, se encola y se reintenta.
Existe por un día concreto del año — ver §12.

---

## 7. El multi-inquilino: todas las hermandades en una sola base

Todas las hermandades comparten un proyecto de Supabase. Cada tabla lleva
`hermandad_id`, y unas políticas RLS que solo dejan pasar las filas de la
hermandad de quien pregunta. La frontera está en `supabase/multi-hermandad.sql`.

**En el navegador NO se filtra nada, y es a propósito.** Si el filtro viviera
aquí, bastaría abrir las herramientas de desarrollo para saltárselo. Lee el
docblock de `src/lib/multiHermandad.ts`: explica que el id se conoce en el
cliente solo para tres cosas que la base no puede adivinar (la carpeta de los
adjuntos, los formularios de la web que rellena alguien sin sesión, y la
entrada del hermano, que pregunta por su hermandad antes del DNI).

Las tres piezas que verás una y otra vez en el SQL:

- **`hermandad_actual()`** — la hermandad de quien pregunta. Es el `where` de
  casi todas las políticas.
- **`auth_es_hermano()`** — si quien pregunta es un socio y no junta.
- **`modulo_permitido('cuotas')`** — si su cargo le deja entrar ahí.

Y el patrón para la web pública, que es distinto y deliberado: **no se abre
ninguna tabla a `anon` con una política; se expone una función `security
definer` que devuelve las columnas una a una**, y solo si la web está
publicada. Abrir la tabla sería una puerta más ancha: el día que esa tabla
reciba una columna con algo delicado, se colaría sola. Así hay que volver al
SQL a mano para que salga. Ejemplos: `hermandad_de_la_web`,
`documentos_de_la_web`, `ruta_del_documento`.

**Los permisos del panel se comprueban dos veces**, y las dos hacen falta:
`lib/permisos.ts` esconde del menú lo que tu cargo no ve (para que la pantalla
tenga sentido) y `modulo_permitido()` lo impide de verdad (para que esconderlo
no sea la única defensa).

---

## 8. Autenticación, que tiene más casos de los que parece

`src/context/AuthContext.tsx`. Los estados que hay que conocer:

- **Modo local**: hay un usuario de demostración (`demo@cabildo.app`) y las
  cuentas creadas en la propia aplicación entran de verdad, todo en el
  navegador.
- **Modo real**: Supabase Auth con correo y contraseña, y **MFA (TOTP)**
  opcional. Ojo con el estado intermedio: contraseña correcta pero segundo paso
  pendiente. El contexto lo distingue de «todavía no sé si hace falta» —
  mientras no se sabe, **no se deja pasar**.
- **El hermano entra con su DNI**, no con un correo: elige su hermandad, teclea
  su DNI y la base le resuelve el correo (`resolver_email_hermano`). El DNI
  viaja **limpio**, sin puntos: en la base están guardados así, y uno puntuado
  no encuentra a nadie y la pantalla diría que los datos no son correctos.
- **`supabaseAlta`** es un segundo cliente que no persiste sesión, para que dar
  de alta la cuenta de otra persona no expulse de la suya a quien la está
  creando.
- Una persona puede ser **hermano y junta a la vez**, y las dos cosas con la
  misma cuenta (`supabase/hermano-con-cargo.sql`, `hermano-y-gestion.sql`). Es
  el caso normal, no el raro: el tesorero es hermano de la hermandad.

---

## 9. El SQL: 85 ficheros y cómo no romper una base en producción

El esquema **no es un fichero**: son 85, uno por cambio, en orden histórico. De
ahí salen tres ficheros generados que **no se editan a mano**:

| Generado | Para qué | Se regenera con |
|---|---|---|
| `TODO-EN-UNO.sql` | Montar una base nueva de cero | `node scripts/generar-todo-en-uno.mjs` |
| `ACTUALIZAR.sql` | Poner al día una base que ya existe | `node scripts/generar-actualizar.mjs` |
| `DIAGNOSTICO.sql` | Decirle a una hermandad qué le falta | `node scripts/generar-diagnostico.mjs` |

**Añadir una pieza SQL son cuatro pasos y ninguno es opcional:**

1. Escribe el fichero en `supabase/`, **idempotente** (se va a ejecutar más de
   una vez: `if not exists`, `drop policy if exists`, `create or replace`).
2. Regístralo en `PIEZAS`, en `scripts/generar-todo-en-uno.mjs`.
3. Regenera los tres.
4. Sube la versión en `supabase/VERSION.json` y nómbrala en
   `docs/LA-TARDE-DE-SUPABASE.md` (van a **74**). Una prueba comprueba que las
   dos coinciden.

**El orden de `PIEZAS` no es alfabético y no se toca a la ligera.**
`multi-hermandad.sql` va al final porque crea la frontera sobre tablas que han
creado los anteriores. `hermano-con-cargo.sql` va después porque **redefine**
`auth_es_hermano()` y `modulo_permitido()`: de todas las definiciones de una
función, manda la última que se ejecuta.

**`drop function` antes de `create or replace`** cuando la función devuelve una
tabla: `create or replace` no puede cambiar el tipo de retorno, y el día que se
le añada una columna cortaría a mitad de `ACTUALIZAR.sql` en la base de una
hermandad de verdad. Ha pasado dos veces.

---

## 10. Las pruebas: cuatro clases distintas

`npm test` son **6.075 comprobaciones** en 152 ficheros, con un corredor propio
de cien líneas (`pruebas/correr.mjs`) que compila cada módulo con el esbuild que
ya trae Vite. No hay Jest ni Vitest, y no hace falta.

```bash
npm test
PGHOST=/tmp PGPORT=5433 GOBERGO_PG_OBLIGATORIO=1 node pruebas/correr.mjs  # con Postgres
```

**1. Funciones puras.** Lo que mueve dinero, fechas y sitios en el cortejo. Se
importa el módulo y se le dan datos. Es la mayoría.

**2. Guardas que leen la fuente.** Comprueban que el código sigue escrito de
cierta manera: que el teléfono pasa por su validador, que el DNI no se compara
a mano, que una contraseña no viaja a la base. Son raras en otros proyectos y
aquí son la mitad del valor, porque vigilan **decisiones**, no resultados.

> **La trampa que tienen, y hay que entenderla antes de escribir una.** Al
> partir una pantalla en varios ficheros, estas guardas se dividen en dos
> clases y **una de las dos es silenciosa**: `caso('…', true, /lo bueno/)` se
> pone **roja** —molesta, se ve, se arregla—, pero `caso('…', false, /lo
> malo/)` se queda **verde**, porque el patrón malo ya no está en ese fichero
> por la sencilla razón de que no está nada. Pasa a no vigilar absolutamente
> nada sin decirlo.
>
> Por eso la fuente de una pantalla partida se pide **entera y por su nombre**:
> `fuenteDelCenso()`, `fuenteDeLosComunicados()`… o `fuenteDe(ruta)`, que
> resuelve el nombre de la pantalla a todos sus ficheros. Ver
> `pruebas/fuentes.mjs`, que lo explica largo.
>
> Y usa **`sinComentarios()`** / **`fuenteLlana()`** de ese mismo módulo: cuatro
> guardas de este repositorio se han puesto rojas leyendo su propio comentario
> explicativo. El `replace` a ojo tiene además su propia trampa —`accept="image/*"`
> abre un comentario que no existe y se come media pantalla—.

**3. Contra Postgres de verdad.** `pruebas/basedatos.prueba.mjs` levanta el
esquema en un Postgres local y comprueba las políticas **con el rol de verdad**:
que un hermano no pueda leer un acta, que un visitante no vea los datos de otra
hermandad. Con `GOBERGO_PG_OBLIGATORIO=1` la ausencia de Postgres es un fallo,
no un salto silencioso.

> Dos cosas que costaron un rato: `set local request.jwt.claim.sub` **rechaza**
> el `::uuid` (va al insert, no al ajuste); y `raise notice` va a **stderr**, así
> que tres pruebas de restricciones estaban verdes sin comprobar nada — hay que
> **capturar la excepción**.

**4. Sondas de navegador.** `scripts/caza/*.mjs`: Chromium por CDP contra la
build servida. Miran lo que el compilador no puede: que un botón responda, que
el papel no salga en blanco en tema oscuro, que una fila no se desborde a 440px.
Leer el código y leer la pantalla son dos actos distintos. `scripts/caza/LEEME.md`
las lista.

### `scripts/romper.sh` — y esto no es opcional

> Una prueba que no ha fallado nunca no es una prueba: es un comentario con
> sintaxis.

Ha pasado dos veces aquí: una guarda escrita, en verde, que **no saltaba** al
romper justo lo que vigilaba. Así que antes de dar por buena una comprobación
nueva:

```bash
scripts/romper.sh "lo que voy a romper" <orden que lo rompe>
#   0 → salta: la prueba sirve
#   1 → NO SALTA: está escrita pero no vigila nada
#   2 → no puede responder
```

**Tres reglas al usarlo:**

- **No edites nada mientras corre.** Restaura el árbol **completo** al salir. Se
  perdió entera la lista de documentos de Informes por no respetar esto.
- **No lo lances en segundo plano.** Un huérfano restaura el árbol *cuando le
  toque* —puede ser a mitad de la pasada siguiente— y entonces la segunda
  contesta «NO SALTA» sobre un árbol sin la rotura. Antes de creerte un «NO
  SALTA»: `pgrep -af romper.sh`.
- **`git add -A` los ficheros nuevos** antes, o no los respalda.

---

## 11. Convenciones, para que lo que escribas parezca de aquí

**El idioma es el español**, en los identificadores y en los comentarios. No es
pintoresquismo: los nombres del dominio no tienen traducción buena
(`papeleta`, `cortejo`, `tramo`, `antigüedad`) y media traducción es peor que
ninguna. La frontera está en `lib/db/`: **camelCase en la aplicación,
`snake_case` en la tabla**, y un traductor por tabla que hace la conversión en
un solo sitio.

**Los comentarios cuentan el POR QUÉ, no el qué.** Verás docblocks largos, a
veces de treinta líneas sobre una función de cinco. Casi todos son la autopsia
de un fallo real, y están ahí porque la decisión que explican parece arbitraria
hasta que sabes qué pasó. Si tocas uno de esos sitios, **lee el comentario
primero**: suele decirte exactamente por qué la solución obvia no funciona.
Y si arreglas algo no obvio, escribe el tuyo.

**`interactivo`** — en los componentes de la web pública, `true` es la web **de
verdad** (los enlaces navegan) y `false` es la **vista previa** del panel. Es
fácil de invertir y ya se invirtió una vez: el botón «Descargar» salió apagado
para todos los visitantes y encendido solo en la vista previa, donde no hay nada
que descargar.

**Las secciones de la web vienen apagadas de fábrica.** Si lo que enseña una
sección no vive en `web` sino que llega por su cuenta, el índice **no puede
saber** si hay algo y dice que sí; es la propia sección la que se calla si está
vacía — y en la **vista previa** dice qué falta, para que la hermandad no crea
que la sección está rota cuando lo que pasa es que no ha marcado nada.

**La carga por trozos** (`App.tsx`) tiene tres capas y conviene no deshacerlas:
arriba solo las cuatro puertas de entrada; cada pantalla del panel se pide
aparte; y `precargarPanel()` trae el resto en los huecos de inactividad, de una
en una, respetando `saveData` y las conexiones lentas. Más `conReintento()`, que
recarga **una vez** cuando un despliegue a mitad de sesión deja los nombres de
los ficheros viejos sin servidor — la pantalla en blanco que se lee como «va a
rachas».

**El `<details>` controlado**, que ha mordido dos veces: el clic en el `summary`
cambia `open` de forma nativa, y React solo reescribe el atributo cuando el
**valor de la prop** cambia. Así que `open` tiene que venir **solo del estado**;
`open={algo || otraCosa}` no mantiene el panel abierto.

---

## 12. Las trampas que este repositorio ya ha pagado

Están aquí para que no las vuelvas a pagar. Cada una tiene su comentario largo
en el código.

**El Domingo de Ramos por la mañana** hay ochocientas personas mirando su
papeleta a la vez, desde la calle, con la cobertura que haya. Es el motivo de la
carga por trozos, de la cola de escrituras y de que el área del hermano no se
descargue el panel de gestión. Cuando dudes si una optimización merece la pena,
piensa en ese momento: es el único del año en que esto tiene carga de verdad, y
es el que no se puede fallar.

**Los datos son de personas reales.** Un censo importado de un Excel de hace
quince años trae erratas, así que **se valida lo que se teclea hoy, no lo que
vino de antes**: comprobar el DNI siempre dejaba la ficha bloqueada entera y no
se podía corregir ni el nombre. El precio de equivocarse en el otro sentido es
un acta reservada en la pantalla de quien no debe verla.

**Que compile no significa que funcione.** Bugs que compilaban perfectamente en
esta misma aplicación: el QR se generaba bien pero al escanearlo daba «código no
válido»; la impresión funcionaba pero en tema oscuro salía el papel en blanco;
un token de CSS inexistente dejaba media interfaz sin bordes. Ninguno lo habría
cazado el compilador, y los tres estaban a un `npm run dev` de verse.

**Y medir, no suponer.** El medidor de props de la primera versión casaba los
nombres contra la fuente en crudo, así que un texto de pantalla —«siguen siendo
hermanos de pleno derecho»— contaba como la prop `hermanos`: un cajón de 46
líneas salía a 9 props teniendo 7, y con esos números el reparto habría sido
otro. La comprobación de una sonda salía verde comparando dos valores que eran
los dos `null`. Cuando una medida te da la razón muy fácilmente, mírala otra vez.

---

## 13. Por dónde empezar a leer

En este orden, y con el depurador abierto:

1. `src/lib/supabase.ts` — los dos modos, en 120 líneas.
2. `src/App.tsx` — las rutas y la carga por trozos.
3. `src/lib/supabaseSync.ts` — cómo viaja un dato. El fichero más importante
   del proyecto.
4. `src/lib/multiHermandad.ts` + `supabase/multi-hermandad.sql` — la frontera
   entre hermandades.
5. `src/pages/app/Hermanos.tsx` y su carpeta `censo/` — la pantalla más mirada
   del repositorio (23 ficheros de prueba la vigilan) y el ejemplo de cómo se
   parte una pantalla aquí.
6. `pruebas/fuentes.mjs` — por qué las pruebas leen la fuente y cómo no
   romperlas.

Y para lo operativo: [`COMO-TRABAJAR.md`](COMO-TRABAJAR.md) (las normas),
[`LA-TARDE-DE-SUPABASE.md`](LA-TARDE-DE-SUPABASE.md) (qué ejecutar en la base y
en qué orden) y [`HOJA-DE-RUTA.md`](HOJA-DE-RUTA.md) (qué falta).
