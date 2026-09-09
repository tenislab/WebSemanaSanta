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

**Cómo se sabe que está hecho:** ninguna comprobación nueva mira texto salvo
las de cableado, y cada una lleva escrito por qué.

---

## Fase 3 — Levantar la aplicación y mirarla

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

---

## Fase 4 — Probar como el navegador, no como el dueño de la base

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

---

## Fase 5 — Probar la actualización, no la instalación

**El problema.** Todas las pruebas montan la base desde cero. En una base nueva
**no existe la versión vieja**, que es lo único que puede chocar. Por eso
`cannot change return type` llegó dos veces a producción: aquí no puede pasar
ni queriendo.

Ya hay una prueba que crea a mano las firmas viejas y pasa `ACTUALIZAR.sql` por
encima. Falta convertirlo en costumbre.

**Qué hacer:**

1. Guardar el `TODO-EN-UNO.sql` de las versiones que hay en hermandades de
   verdad, y probar `ACTUALIZAR.sql` **encima de cada una**.
2. Que la prueba de actualización corra siempre: instalar viejo → actualizar →
   actualizar otra vez → `DIAGNOSTICO` a cero.
3. Arreglar el punto ciego conocido: **la versión es el número de piezas**, así
   que editar una pieza existente no la sube y la aplicación no avisa a nadie
   de que hay que volver a ejecutar `ACTUALIZAR.sql`. Hay que separar «cuántas
   piezas hay» de «qué versión es».

**Cómo se sabe que está hecho:** existe al menos una actualización probada
desde una versión antigua real, y editar una pieza sube la versión.

---

## Fase 6 — Enterarse de lo que se rompe fuera

Todo lo anterior busca fallos aquí. Esto los busca **donde están**: en la base
de una hermandad, un martes, con alguien delante.

- `errores_cliente` ya recoge lo que revienta en producción. Falta **mirarlo**:
  un sitio en la aplicación que lo enseñe, y la costumbre de abrirlo.
- El canal piloto: desplegar primero a una hermandad, esperar, y luego al
  resto.
- **Nada de despliegues entre el 1 de marzo y el Domingo de Resurrección.**

---

## El orden, y por qué

1. **Fase 1** — hecha.
2. **Fase 4** (probar como el navegador) — es de donde salieron dos de los seis
   fallos, y es la que da más por menos trabajo.
3. **Fase 3** (levantar y mirar) — la más barata de todas y la que más cosas
   encuentra por hora.
4. **Fase 5** (actualizaciones) — la que más daño hace cuando falla, porque
   falla en producción y a mitad.
5. **Fase 2** (pruebas que ejecuten) — la más larga; se hace poco a poco, y
   sobre todo cada vez que se toque algo.
6. **Fase 6** (producción) — continua, no tiene final.

---

## La regla, si hay que quedarse con una

**Medir, no opinar.** Cada vez esta semana que abrí la aplicación, ejecuté el
segmento, pinté el CSS o inserté con el rol de verdad, encontré algo. Cada vez
que leí el código, no. Y dos veces me equivoqué al contar leyendo, y lo vi al
ejecutarlo.
