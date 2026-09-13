# Plan de fases para encontrar y arreglar fallos

Escrito el 9 de septiembre de 2026, después de una semana en la que **seis
fallos llegaron a producción con las pruebas en verde**.

Ese es el dato del que sale todo lo demás. No hacen falta más pruebas: hay
5.081 y pasan todas. Lo que hace falta es que prueben **donde el programa se
rompe**, y no donde ya se sabe que funciona.

---

## Lo que enseñó cada fallo

Ninguno de los seis fue un despiste. Cada uno tuvo una **ceguera concreta**, y
las cegueras se repiten. Ordenados por lo que no se estaba mirando:

| Fallo | Lo que se probó | Lo que no |
|---|---|---|
| `reglas_automaticas` rechazaba las filas (RLS) | La tabla, como superusuario | Insertar **como `authenticated`**, que es lo que hace un navegador |
| `cannot change return type` (dos veces) | Instalar desde cero | **Actualizar** una base que ya tenía la versión vieja |
| Las reglas de cumpleaños no cogían a nadie | Que el segmento existiera | **Ejecutarlo** contra un censo |
| Los `select` en zigzag | El CSS, leyéndolo | **Pintarlo** en un navegador |
| Las reglas se marcaban lanzadas sin guardar nada | La función | Que la escritura **llegara a la base** |
| El correo de contacto personal en la web | — | **Abrir la pantalla** y mirarla |

Las cinco cegueras, dichas en corto:

1. **Probar como superusuario.** El superusuario se salta RLS. Todo pasa.
2. **Instalar siempre desde cero.** Lo que rompe es *actualizar*, y eso solo
   existe en la base de una hermandad que lleva meses funcionando.
3. **Leer el código en vez de ejecutarlo.** Una prueba que comprueba que una
   línea *está escrita* no comprueba que *hace algo*.
4. **No pintar nunca la pantalla.** 72 de los 265 ficheros de `src/` no
   aparecen nombrados en ninguna prueba.
5. **No mirar los permisos por defecto.** Postgres da `execute` a PUBLIC al
   crear una función: no poner `grant` **no** restringe nada.

---

## Lo ya medido (números, no impresiones)

Todo esto está comprobado ejecutándolo, no leyéndolo:

- **5.081** comprobaciones; **72 de 265** ficheros de `src/` sin una sola
  prueba que los nombre.
- **12 de 40** funciones de base que llama el navegador nunca se ejecutan
  contra una base de verdad en las pruebas.
- **9** funciones que devuelven tablas se creaban sin `drop` delante — la
  familia exacta del error de esta semana. *(Fase 1: arregladas y con guardia.)*
- **10** tablas con `hermandad_id` sin `default hermandad_actual()`. De ellas,
  el navegador escribe directamente en **una**: `mensajes_web`. Estaba rota.
  *(Fase 1: arreglada y con guardia.)*
- **44** funciones `security definer` que puede ejecutar un visitante sin
  sesión. Dos hacían daño de verdad. *(Fase 1: cerradas y con guardia.)*

---

## Fase 1 — Lo que ya está hecho ✅

Se hizo antes de escribir este plan, porque estaba verificado y era corto.

- **`mensajes_web` sin `default hermandad_actual()`.** Deshacer el borrado de
  un mensaje del buzón fallaba **siempre**: la fila volvía sin hermandad y la
  política de entrada la rechazaba. Detrás de cada mensaje hay alguien de fuera
  que escribió dejando su teléfono.
  *Guardia:* prueba que inserta **como `authenticated`** y comprueba los tres
  caminos de la tabla (deshacer, visitante con hermandad, visitante sin ella).
- **Nueve funciones sin `drop` delante.** `create or replace` no puede cambiar
  el tipo que devuelve; el día que a cualquiera se le añada una columna,
  `ACTUALIZAR.sql` corta en producción.
  *Guardia:* prueba que recorre las piezas de SQL y exige el `drop` en todas.
  Encontró una más de las que yo había contado (`mis_novedades`).
- **`sellar_esquema` y `limpiar_errores_cliente` abiertas a cualquiera.**
  Con `sellar_esquema(1)` la versión pasaba de 69 a 1 y la aplicación pedía
  para siempre una actualización ya hecha.
  *Guardia:* prueba por los dos lados — el visitante no puede, el dueño de la
  base sí.
- **«Leerlo», en Notificaciones, no abría el mensaje.** Iba a `/app/web` a
  secas y caías en la última pestaña que hubieras tocado.
- **El contacto de la web publicaba datos personales.** Los campos se ven
  vacíos y lo que se publica es el *placeholder*.

---

## Fase 2 — Que las pruebas prueben lo que pasa, no lo que pone

**El problema.** Hay comprobaciones que hacen `fuente.includes('...')`. Son
útiles para cablear dos sitios que tienen que decir lo mismo, pero **no prueban
comportamiento**: pasan igual si la línea está escrita y no hace nada. Es
exactamente lo que pasó con las reglas de cumpleaños.

**Qué hacer, por orden de lo que más duele:**

1. Sacar la lista de comprobaciones que solo miran texto y, para cada una,
   decidir: o se convierte en una que **ejecuta**, o se deja con un comentario
   que diga por qué no puede ejecutarse (cablear dos ficheros, sobre todo).
2. Donde el módulo sea puro (`segmentacion`, `campana`, `cuotas`, `papeletas`,
   `personalizar`), la prueba tiene que **llamar a la función con datos y mirar
   lo que devuelve**. Nunca leer su código.
3. **Romper a propósito cada guardia nueva** antes de darla por buena. Ya ha
   pasado dos veces que un guardia mío no saltaba al romper lo que vigilaba.
   El script `romper.sh` hace exactamente eso.

**La herramienta ya está en el repositorio: `scripts/romper.sh`.** Antes se
nombraba aquí como si existiera y vivía en un directorio temporal fuera del
proyecto, así que en otras manos no estaba. Se usa así:

```
scripts/romper.sh "lo que voy a romper" <orden que lo rompe>

# si la rotura toca el SQL, con la base delante (si no, esas ~550 pruebas
# se saltan EN VERDE y la respuesta sería «no salta» sin mirar nada):
PGHOST=/tmp PGPORT=5433 GOBERGO_PG_OBLIGATORIO=1 scripts/romper.sh "…" …
```

Devuelve **al revés** que un programa normal: `0` si algo falla (el guardia
salta, la prueba sirve) y `1` si todo sigue verde (**el guardia no vigila
nada**). Respalda todo lo que lleva git y restaura desde un `trap`, así que
deja el árbol como estaba aunque la rotura falle o se corte con Ctrl-C. Tiene
su prueba, que lo ejecuta de verdad sobre un repositorio de mentira
(`pruebas/romper.prueba.mjs`).

**Y cazó algo el primer día**, que es el mejor argumento para tenerlo: la
comprobación de que la tabla `intentos_acceso` está cerrada buscaba la línea
`revoke all on intentos_acceso…` en el fichero **a secas**. Comentar esa línea
con `--` la dejaba en verde: el texto sigue ahí, comentado. Ahora se quitan los
comentarios antes de buscar, y el candado de debajo —el RLS sin ninguna
política— **se ejecuta** contra Postgres, con una fila dentro y contando lo que
ve cada rol.

**Cómo se sabe que está hecho:** ninguna comprobación nueva mira texto salvo
las de cableado, y cada una lleva escrito por qué.

---

## Fase 3 — Levantar la aplicación y mirarla ✅

**El problema.** 72 ficheros de `src/` no salen en ninguna prueba. Los tres
fallos de estética de esta semana —el zigzag, el escudo huérfano, los carteles
que se contradecían— salieron todos de **abrir la aplicación**, ninguno de
leer el código.

**Qué hacer:**

1. Dejar hecho el arranque: `vite preview` + una página que siembra el
   `localStorage` y entra. Hoy hay que rehacerla **después de cada `npm run
   build`**, porque el build vacía `dist/`. Eso se arregla poniéndola en
   `public/` — y entonces cuesta cero volver a mirar.
2. Recorrer las pantallas que nadie ha visto nunca pintadas, empezando por las
   que salen en papel y no se pueden corregir después: `CertificadoAntiguedad`,
   `PapeletaModeloRender`, `CarneHermano`, `FacturaTienda`, `AsistenciaTramo`.
3. Cada una, en **los dos temas** (claro y oscuro) y en **móvil**. El zigzag
   solo se veía en un contexto de los tres.

**Cómo se sabe que está hecho:** cada uno de esos ficheros se ha visto pintado
al menos una vez, y lo que se encontró está arreglado o apuntado.

### Lo que salió al hacerla

**3.1 — La puerta.** `public/mirar.html`, que Vite copia tal cual y sobrevive al
build. Siembra ejecutando `sembrarDemoLlena()` —la función del botón «Entrar en
la demo»— con un `localStorage` de mentira, así no se queda vieja. Se le pide la
pantalla con `?ir=` y el tema con `?tema=`.

**3.2 — Los papeles.** Tres fallos en los ocho documentos que la hermandad
imprime y entrega: el **escudo era un cuadrado morado macizo** (el trazo salía
del color exacto del fondo en tema claro), el **separador de miles faltaba en
los importes de cuatro cifras** (`2420,00 €` encima de `10.431,55 €` en el
estado de cuentas), y la **misma hermandad tenía dos direcciones** según qué
papel imprimía (tres con provincia, cinco sin ella; y repetía «Sevilla,
Sevilla» en las capitales). Los tres solo se veían mirando el documento, no
leyendo el código.

**3.3 — Las pantallas.** Un hallazgo: en **Campañas el botón de crear estaba
enterrado en el panel** en vez de en la cabecera, la única pantalla donde la
acción principal no estaba donde en todas las demás.

Y una **falsa alarma que enseñó más que el hallazgo**: las capturas a ancho de
móvil salían con el contenido cortado, como si desbordara. Medido dentro de un
iframe de 390 y 420 px reales, **cabía** (`scrollW` 375 y 405). El corte era de
mi manera de fotografiar —`--window-size` en Chrome headless no fija el viewport
de maquetación—, no de la aplicación. Medir antes de tocar evitó «arreglar» una
maquetación que estaba bien.

---

## Fase 4 — Probar como el navegador, no como el dueño de la base ✅

**El problema.** El superusuario se salta RLS, así que una prueba de SQL hecha
así **dice que sí a todo**. Así se coló lo de `reglas_automaticas` y así se
coló lo de `mensajes_web`.

**Qué hacer:**

1. Las **12 funciones** que el navegador llama y que nunca se ejecutan contra
   una base: `activar_suscripcion_propia`, `baja_de_la_web`,
   `cancelar_suscripcion_propia`, `confirmar_suscripcion`, `es_titular`,
   `hermandad_de_la_tienda`, `hermandad_de_la_web`, `hermandades_publicas`,
   `mi_hermandad_id`, `mis_novedades`, `soporte_donde_estoy`,
   `suscribirse_a_la_web`. Una prueba por cada una, **con el rol que la llama
   de verdad** (`anon` si la llama la web pública, `authenticated` si el panel).
2. Repasar las **44 funciones `security definer` que puede ejecutar un
   visitante** y decidir una por una: o la necesita la web pública, o lleva
   `revoke`. Lo que ya se sabe: las de disparador y las que usan las políticas
   (`auth_es_hermano`, `modulo_permitido`, `puedo_ver_documento`…) **tienen**
   que estar abiertas, porque una política se evalúa con el rol de quien
   pregunta.
3. Escribir en las **9 tablas restantes sin `default hermandad_actual()`** con
   el rol de verdad, para confirmar que ninguna se escribe desde el navegador
   sin pasar por una función que ponga la hermandad.

**Cómo se sabe que está hecho:** ninguna función que llame el navegador queda
sin ejecutarse en las pruebas, y cada `security definer` abierta tiene escrito
por qué lo está.

### Lo que salió al hacerla

**4.1 — Las doce, ejecutadas con el rol de verdad.** Nada estaba roto, pero
ahora está comprobado lo que importa de cada una: que `hermandad_de_la_web` y
`hermandad_de_la_tienda` llevan `where publicada` —una web a medio hacer no
suelta el nombre legal, la dirección, el teléfono y el correo a quien acierte
el enlace—, que `hermandades_publicas` solo devuelve cosas de cartel
*mirando lo que devuelve y no lo que se recuerda*, que activar y cancelar la
suscripción es cosa del titular y no de cualquier hermano, y que apuntarse al
boletín no da permiso para leerlo.

**4.2 — Las cuarenta y dos, clasificadas una por una.** El recuento bueno son
42, no 44: mi primera medición no distinguía `security definer` de las normales,
y la distinción es la que importa — una función normal corre con los permisos de
quien llama, así que a un visitante lo paran las políticas igual que si
consultara a pelo.

Y salió algo que no estaba buscando. La lista la saqué primero de la base de las
pruebas, que la comparten todas y arrastra lo que alguien haya ejecutado a mano:
me dijo que `limpiar_registro_viejo` estaba abierta cuando en el fichero lleva su
`revoke`. Leyendo por qué, apareció el fallo de verdad: **el `revoke` existe
desde el día que se escribió, y una hermandad que ejecutó el fichero antes se
quedó con la función abierta**. Si el fichero va en `ACTUALIZAR.sql` se arregla
al actualizar; `tareas-programadas.sql` no va, porque necesita `pg_cron` y se
pega a mano, así que a esas bases el arreglo no les llega nunca.

O sea: aquí puede estar todo bien y en la base de una hermandad estar mal. De
eso avisa ahora `DIAGNOSTICO.sql`, que es lo único que se ejecuta allí.

**4.3 — Las nueve tablas sin defecto están bien, y por qué.** `titulares` se
escribe al crear una hermandad, cuando quien la crea no pertenece a ninguna;
`soporte_sesion` se escribe para una hermandad que no es la de quien pregunta.
La regla no es «todas con defecto», es que **una tabla sin defecto no la puede
escribir el navegador** — y eso es justo lo que habría cazado el fallo de
`mensajes_web`.

**Y dos guardias míos no vigilaban nada.** El del diagnóstico: romperlo no
rompía ninguna prueba. Y el de las escrituras del navegador: había escapado de
más y la expresión buscaba una barra en vez de un paréntesis. Los dos se
arreglaron y los dos saltan. Es la tercera y la cuarta vez esta semana, y la
conclusión es siempre la misma: **un guardia sin romper no es un guardia, es un
comentario.**

---

## Fase 5 — Probar la actualización, no la instalación ✅

**El problema.** Todas las pruebas montan la base desde cero. En una base nueva
**no existe la versión vieja**, que es lo único que puede chocar. Por eso
`cannot change return type` llegó dos veces a producción: aquí no puede pasar
ni queriendo.

**Lo que se hizo, y lo que se encontró al hacerlo:**

1. **Dos instaladores antiguos reales, guardados** en
   `pruebas/esquemas-anteriores/`: el del 29 de agosto (sin sello, como toda
   base montada antes de que el sello existiera) y el del 8 de septiembre (el
   primero sellado, versión 62). `actualizardesdevieja.prueba.mjs` instala cada
   uno en un Postgres de verdad, mete datos, pasa `ACTUALIZAR.sql` por encima
   —dos veces— y exige **cuatro cosas**: sin error; los datos intactos; el
   diagnóstico a cero; y **que el catálogo quede IDÉNTICO al de instalar hoy
   desde cero** (tablas, columnas, valores por defecto, políticas, índices,
   disparadores, funciones y sus permisos). Esa última es la promesa de
   `ACTUALIZAR.sql`, y nadie la había medido.

2. **Y no se cumplía.** A una base del 29 de agosto actualizada le faltaba el
   `default hermandad_actual()` de `mensajes_web`: el arreglo de la fase 1
   («deshacer el borrado de un mensaje falla siempre») estaba en
   `multi-hermandad.sql`, que **no viajaba** en `ACTUALIZAR.sql`. Las piezas de
   base también se editan, y esas ediciones no llegaban a nadie. La solución de
   fondo, medida antes de decidirla: **`ACTUALIZAR.sql` lleva ahora todas las
   piezas del instalador, en su orden.** Sobre una base al día ejecutado dos
   veces, y sobre las dos antiguas, el catálogo queda idéntico y no se toca una
   fila. Las dos razones históricas para dejar algo fuera ya no valen (las
   explica el generador). Al romperlo a propósito —quitando `multi-hermandad`
   de la lista— saltan ocho comprobaciones, entre ellas tres de permisos de
   ficheros que nadie había relacionado con esto.

3. **El punto ciego de la versión, cerrado.** La versión era el número de
   piezas, así que editar una no la subía y la aplicación no avisaba. Mordió el
   mismo día: dos columnas nuevas en `reglas_automaticas`, versión sin subir.
   Ahora vive en `supabase/VERSION.json` junto a una **huella** del contenido
   de todas las piezas; los generadores suben la versión cuando la huella
   cambia (`scripts/version-del-esquema.mjs`). Editar cuenta igual que añadir.
   `npm test` comprueba que la huella guardada es la de las piezas: tocar el
   SQL sin pasar el generador se nota, por su nombre. El aviso ya no dice «te
   faltan N actualizaciones» —esa cuenta ya no significa nada— sino «tu base
   va por la 69 y la aplicación necesita la 70».

**Lo que esta prueba NO ve, para que nadie se lo crea:** compara «viejo +
actualizar» con «instalar hoy». Si un arreglo se quita de una pieza, falta en
los dos lados y aquí no salta; de eso se ocupan las guardias de cada arreglo.
Y las hermandades de verdad pueden tener instaladores que no son estos dos: si
aparece otro, se guarda en la carpeta y la prueba lo recorre sola.

---

## Fase 6 — Enterarse de lo que se rompe fuera

Todo lo anterior busca fallos aquí. Esto los busca **donde están**: en la base
de una hermandad, un martes, con alguien delante.

- `errores_cliente` ya recoge lo que revienta en producción. **Ya se puede
  mirar:** `/app/errores` («Errores (soporte)» en el menú de Sistema) los enseña
  agrupados por mensaje, con cuántas veces han pasado y **en cuántas hermandades
  distintas** —que es el dato que separa un fallo del código del navegador de
  alguien—, la ruta y la versión del último, y la pila al pedirla. La ventana se
  elige: hoy, 7, 30 o 60 días.

  El candado está en la base, no en esconder el enlace: la función
  `errores_de_produccion()` lleva `where es_soporte()` dentro, así que a
  cualquier otra cuenta le llega una lista vacía aunque se invente la dirección.
  Y la tabla sigue sin política de lectura, como decidió `vigilancia.sql`: los
  fallos son para quien los puede arreglar.

  Lo que queda de esto es **la costumbre de abrirlo**, que no la arregla el
  código. Avisar por correo depende de F15 (dominio verificado).
- El canal piloto: desplegar primero a una hermandad, esperar, y luego al
  resto.
- **Nada de despliegues entre el 1 de marzo y el Domingo de Resurrección.**

---

## Fase 7 — La revisión grande de septiembre de 2026

Un barrido de los fallos que no dan error hasta que le pasan a una hermandad de
verdad. La receta fue siempre la misma: **sembrar el dato que llega en
producción y mirar la pantalla**, no leer el código.

### Lo que se barrió, con qué y qué salió

| Barrido | Cómo se midió | Resultado |
| --- | --- | --- |
| La web pública con listas a medias | `conDefectos({paginas:[{id}]})` + /w/demo en el navegador | **2 fallos.** La web entera en blanco para el visitante; y `api/w.ts` perdía el SEO en silencio |
| Las 24 colecciones × 18 pantallas, con un registro mínimo | barrido con Chrome, una pasada | 5 pantallas se caían |
| Y otra vez con datos REALES menos un campo, campo a campo | los ejemplos de `src/data/` sin una clave cada vez | **2 fallos de verdad:** eventos sin `tareas`, documentos sin `cargosConAcceso`. Los otros tres eran columnas `not null` |
| El cortejo: quién paga y no sale | papeleta 'Pagada' con `tramoId: null` sembrada en /app/cortejo | **1 fallo.** No salía en ningún sitio y la pantalla decía «22/204 cubiertos» |
| Los dos resolutores de modelo (papeleta y recibo) | ejecutados con las 29 claves que ofrece la interfaz | limpios |
| El importador de cuotas | una hoja de 9 filas con basura real (importes negativos, «Cobrado el 3/2», DNI que no existe, año que falta) | limpio: cada caso con su problema o su aviso |

### La lección, que es una y sirve para el futuro

**Los mapeos defienden un camino y el espejo del navegador no pasa por él.**
`rowToEvento` hace `Array.isArray(r.tareas) ? … : []` y `rowToDocumento` hace
`?? null`: quien las escribió ya contaba con que el campo faltara. Pero
`localStorage` se lee con `JSON.parse` y se usa tal cual, y lo que hay ahí lo
escribió la versión que estuviera puesta el día que se guardó. **Cada defensa
escrita en un `rowTo…` es un aviso de que el mismo dato llega sin defender por
el otro lado.**

### Lo visto y NO arreglado, a propósito

Cuatro pantallas se caen al ordenar si falta `fecha`, `fechaAlta`, `nombre` o
`fechaCreacion` (`localeCompare` de `undefined`). No se toca: son columnas `not
null` desde el primer día, y ponerle una defensa a lo que no puede pasar es
esconder el día que pase de verdad.

---

## El orden, y por qué

1. **Fase 1** — hecha.
2. **Fase 4** (probar como el navegador) — hecha.
3. **Fase 3** (levantar y mirar) — hecha.
4. **Fase 5** (actualizaciones) — la que más daño hace cuando falla, porque
   falla en producción y a mitad. **La siguiente.**
5. **Fase 2** (pruebas que ejecuten) — la más larga; se hace poco a poco, y
   sobre todo cada vez que se toque algo.
6. **Fase 6** (producción) — continua, no tiene final.
7. **Fase 7** (la revisión grande) — hecha. Tres fallos arreglados, cada uno
   con su guardia roto a propósito.

---

## La regla, si hay que quedarse con una

**Medir, no opinar.** Cada vez esta semana que abrí la aplicación, ejecuté el
segmento, pinté el CSS o inserté con el rol de verdad, encontré algo. Cada vez
que leí el código, no. Y dos veces me equivoqué al contar leyendo, y lo vi al
ejecutarlo.
