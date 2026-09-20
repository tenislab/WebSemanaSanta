# Lo que se ha encontrado hoy

Barrido de toda la aplicación por cuatro frentes: **interfaz, lógica,
funcionamiento y rendimiento**. Nada de lo que hay aquí está escrito por
sospecha: cada punto lleva **cómo se ha medido** y con qué números, y los
frentes que han salido limpios se dicen también — un informe que solo enseña
los hallazgos no deja saber qué se ha mirado.

Está ordenado por lo que le hace daño a una hermandad de verdad. **Los dos
primeros ya están arreglados** —van tachados, con su medición de antes y de
después—; del 3 al 7 siguen abiertos.

---

## Resumen

| | Qué es | Gravedad | Medido con |
|---|---|---|---|
| ~~**1**~~ | ~~La supresión del art. 17 certifica un borrado incompleto~~ **ARREGLADO** | **alta** | ejecutando la función con la consulta caída |
| ~~**2**~~ | ~~Cuatro tokens CSS que no existen se comen 16 declaraciones~~ **ARREGLADO** | **alta** | estilo calculado en el navegador |
| **3** | Tres tablas pintan todas sus filas: 245 ms por tecla | **media** | cronómetro con 800 hermanos |
| **4** | El censo lleva un padrón oculto que es el 20 % del DOM | media | conteo de nodos |
| **5** | La memoria del ejercicio publica «hermano nº 0» | baja | ejecutando `construirMemoria` |
| **6** | 34 de 39 filtros solo dicen cuál está puesto con el color | baja | recuento sobre el código |
| **7** | Un apunte de dinero calculado con el estado del render | latente | lectura; **no reproducido** |

**Frentes que han salido limpios, y se ha mirado:** no hay ni un desborde
horizontal en móvil (390 px) en quince pantallas; ningún botón revienta la
aplicación ni deja un error en la consola; no hay ni un caso real de «estado
obsoleto» después de un `await`; el dinero se redondea a céntimos de forma
consistente; y el contraste en tema **claro** está bien en todas las pantallas.

---

## ~~1. La supresión del artículo 17 certifica un borrado que no ha sido completo~~ — ARREGLADO

> **Hecho.** Ahora se recoge el error y, si esa consulta falla, **no se borra
> nada** y se devuelve `{ ok: false }` con qué ha pasado y qué hacer —la
> pantalla ya lo enseña en su banda—. Una supresión que no se puede completar es
> mejor no empezarla: dejarla a medias es lo único que no se puede deshacer,
> porque la ficha ya no está y el DNI con el que encontrar el resto se ha ido con
> ella.
>
> Y **diez guardias nuevos** en `pruebas/rgpdfamilia.prueba.mjs`, que recorren
> por primera vez la rama de Supabase con un cliente de mentira guionizable
> (`pruebas/stub-supabase-guion.mjs`). Miran dos cosas: qué devuelve la función
> y **qué llegó a pedirle a la base** —que el `delete hermanos` no aparezca es
> lo que dice que no se ha borrado nada—. Deshaciendo el arreglo, cuatro
> fallan.

**Dónde:** `src/lib/rgpd.ts:148`

Borrar a un hermano tiene que llevarse también su **solicitud de alta**, que
lleva su nombre, su DNI, su correo y su teléfono. Como la solicitud es anterior
a su ficha, no hay nada que las una: hay que sacar el DNI y el correo de la
ficha primero y buscar por ahí. Eso es lo que hace la primera consulta:

```ts
const { data: ficha } = await supabase
  .from('hermanos').select('dni, email').eq('id', hermanoId).maybeSingle()
```

**Es la única de las cinco consultas de esa función cuyo error no se mira.** Las
otras cuatro sí: una devuelve `{ ok: false }`, tres escriben en la consola.

Si esa falla —red, RLS, tiempo de espera—, `ficha` viene `null`, el DNI y el
correo quedan `undefined`, el filtro de búsqueda queda vacío, **el bloque que
borra las solicitudes no llega a entrar**, y la ficha se borra igual. La función
devuelve `{ ok: true }`.

**Comprobado ejecutándolo** con un Supabase de mentira en el que solo falla esa
consulta:

```
### todo va bien
   devuelve: {"ok":true,"censo":[]}
   consultas: select:uno hermanos → select solicitudes_alta → delete hermanos
              → delete solicitudes_alta → select hermanos
   ¿borra la ficha? SÍ   ¿borra la solicitud de alta? SÍ

### la consulta del DNI y el correo FALLA
   devuelve: {"ok":true,"censo":[]}
   consultas: select:uno hermanos → delete hermanos → select hermanos
   ¿borra la ficha? SÍ   ¿borra la solicitud de alta? NO
   >>> CERTIFICA UNA SUPRESIÓN QUE NO HA SIDO COMPLETA
```

Lo que queda en la base es exactamente el agujero que el comentario de esa
misma función dice que se cerró, reabierto por un error que nadie mira. Y no
son datos cualesquiera: los de un censo de hermandad revelan convicciones
religiosas, categoría especial del artículo 9.

**El arreglo son dos líneas**: recoger el error y, si falla, **no borrar** y
devolver `{ ok: false }` con qué ha pasado. Sin el DNI y el correo la supresión
no se puede completar, así que empezarla es peor que no empezarla.

**Y por qué no lo vio nadie:** `pruebas/rgpdfamilia.prueba.mjs` cubre bien esta
función, pero solo por el camino de `localStorage`. La rama de Supabase —donde
está el fallo— no se prueba.

---

## ~~2. Cuatro tokens CSS que no existen, y cada uno se come la declaración entera~~ — ARREGLADO

> **Hecho**, y con dos sorpresas que se cuentan más abajo. Medido antes y
> después en el navegador:
>
> | | antes | después |
> |---|---|---|
> | `.guia` sombra | `none` | aplica |
> | `.guia__marca` claro | 4,12:1 | **4,50:1** |
> | `.guia__marca` oscuro | **1,84:1** | **10,07:1** |
> | `.ficha-acceso` borde | `0px none` | `1px dashed` |
> | `.row-avatar` oscuro | 3,47:1 (y 2,67:1 en otros nombres) | **5,17:1** |
> | `.estilo-card` fondo | transparente | aplica |
> | `.estilo-card__pie small` oscuro | **1,32:1** | **8,70:1** |
> | `.tramo-ficha` borde y fondo | `0px none` / transparente | `1px solid` / aplica |
>
> `--linea` → `--line`, `--surface` → `--bg-sunken` (el idioma de la casa para
> una caja dentro de una tarjeta, como `.assign-box`), `--text-soft` →
> `--text-muted`, `--shadow-sm` → `--glass-shadow` (el de `.settings-card`, que
> es la tarjeta gemela de `.guia`). Y fuera el CSS muerto de
> `.opcion-row--papeleta`.
>
> **Guardias nuevos, y uno cierra la clase entera:** ningún `var()` sobre un
> token inexistente **sin valor de reserva**. Con reserva sí vale, y hay tres
> así a propósito (`var(--err, #b3261e)`, `var(--radio-sm, 8px)`,
> `var(--sans-fallback, inherit)`), así que la regla que se exige es la de
> verdad. Más el del oro y el del avatar, los dos calculando y no leyendo la
> línea del arreglo.

`var(--noExiste)` no deja un valor por defecto: **invalida la declaración
completa**. Es una trampa que este repositorio ya tiene escrita en
`docs/COMO-TRABAJAR.md`, y hay cuatro sueltas:

| Se escribe | Existe | Debería ser |
|---|---|---|
| `--linea` | **no** | `--line` |
| `--surface` | **no** | `--bg-sunken` |
| `--text-soft` | **no** | `--text-muted` |
| `--shadow-sm` | **no** | `--glass-shadow` |

Son los mismos nombres en inglés y en español, y el otro en singular: se
escribieron a mano y nadie avisa, porque el CSS no falla, solo deja de aplicar.

> **Cuál es el token bueno no se ha elegido a ojo.** `--surface` son cuatro
> cajas DENTRO de una tarjeta, y para eso la casa ya tiene idioma:
> `.assign-box` usa `--bg-sunken`. Y `.guia`, que es la que pedía
> `--shadow-sm`, es una tarjeta idéntica a `.settings-card` —mismo fondo, mismo
> borde, mismo radio—, y esa usa `--glass-shadow`, no `--shadow`, que es la
> sombra grande de un menú flotante. Mi primera lista decía `--bg-raised` y
> `--shadow`: los dos habrían aplicado, y los dos habrían quedado mal.

**Dieciséis declaraciones en seis pantallas**: Configuración → cuerpos y tramos
(`.tramo-ficha` y sus campos), la ficha del hermano (`.ficha-acceso`), el editor
de la web (`.estilo-card`, `.afinar`), Cortejo (`.interruptor__texto`) y la guía
de primeros pasos (`.guia`).

**Medido en el navegador**, preguntándole el estilo calculado:

```
.guia           boxShadow=none
.tramo-ficha    borderTopWidth=0px  borderTopStyle=none  backgroundColor=rgba(0, 0, 0, 0)
.ficha-acceso   borderTopWidth=0px  borderTopStyle=none
.estilo-card    backgroundColor=rgba(0, 0, 0, 0)
.afinar         backgroundColor=rgba(0, 0, 0, 0)

TOKENS: --line=[rgba(61, 15, 22, .13)]  --linea=[]  --surface=[]
        --bg-raised=[#ffffff]  --text-muted=[#6d6357]  --text-soft=[]
        --shadow=[0 22px 50px…]  --shadow-sm=[]
```

O sea: **sin borde, sin fondo y sin sombra**, no «con otro borde».

### Y en tema oscuro no es cosmético: hay texto invisible

`.estilo-card__pie small` —la descripción de cada estilo de la web— pide
`color: var(--text-soft)`. Al caerse la declaración, **hereda negro**, y en tema
oscuro el fondo es casi negro. Medido, y medido otra vez dándole valor al token
en caliente:

```
CON EL TOKEN ROTO (como está hoy):
  color=rgb(0, 0, 0)        fondo=rgb(35, 34, 33)   contraste=1.32:1
DÁNDOLE VALOR (--text-soft := --text-muted):
  color=rgb(184, 175, 162)  fondo=rgb(35, 34, 33)   contraste=7.33:1

CON --surface Y --linea ROTOS:
  estilo-card fondo=rgba(0, 0, 0, 0)   tramo-ficha borde=0px none
DÁNDOLES VALOR:
  estilo-card fondo=rgb(35, 34, 33)    tramo-ficha borde=1px solid
```

**1,32:1 es texto que no se lee.** Y el arreglo es una línea por token.

### Y dos cosas que solo se supieron al romper a propósito

**a) Nada vigilaba el blanco sobre oro.** Puesto el arreglo, se deshizo con
`scripts/romper.sh` y las 5.696 pruebas **siguieron en verde**: el número
invisible del paso en curso podía volver mañana sin que nadie se enterara. De
ahí el guardia nuevo, que no lee la línea del arreglo: resuelve los dos oros y
**calcula** el contraste de todo lo que se escribe encima de un fondo de oro,
sacando las reglas del propio CSS para que entre sola la próxima que alguien
escriba.

**b) Mi primer arreglo era peor que el fallo.** Copié la tinta de la pieza de al
lado, `#2a1b14`, que es bien oscura y parecía segura. **El guardia nuevo la
tumbó**: da 4,03:1 sobre el oro claro, o sea **por debajo del 4,12:1 del blanco
al que sustituía**. Los tres candidatos, medidos:

```
#ffffff  (lo que estaba)      claro 4,12:1   oscuro  1,84:1   no vale
#2a1b14  (el de al lado)      claro 4,03:1   oscuro  9,02:1   no vale
#1a1207  (la elegida)         claro 4,50:1   oscuro 10,07:1   vale
```

`#1a1207` no es un color inventado: es el que ya usa `.alta__paso--ahora span`,
que es una chapa numerada igual que esta. Y al medirlas todas apareció que
**`.tramo-ficha__orden` arrastraba el mismo 4,03:1 desde antes**, sin que
tuviera nada que ver con este arreglo. También cambiada.

De paso: `.opcion-row--papeleta` usa dos de esos tokens y **no existe en
ninguna pantalla**. Es CSS muerto y se puede borrar.

### Los otros dos contrastes flojos, los dos solo en tema oscuro

| Dónde | Contraste | Qué pasa |
|---|---|---|
| `.guia__marca` — el número del paso en la guía de Inicio | **1,84:1** | el fondo de la chapa se aclara en oscuro y el número sigue blanco |
| `.row-avatar` — las iniciales del hermano en las tablas | **de 2,67:1 a 3,47:1, según el nombre** | el tono sale del nombre, así que a unos hermanos les baja de 3:1 y a otros no |

> **Dos correcciones a lo que escribí primero**, las dos salidas de volver a
> medir con más cuidado:
>
> · De `.row-avatar` dije «2,67:1» a secas. **No es un número fijo**: el tono se
>   saca del nombre, así que va de 2,67:1 a 3,47:1 y el fallo le pasa a unos
>   hermanos y no a otros. Un fallo que solo le toca a algunos nombres es
>   justamente el que nadie reproduce, y por eso el guardia nuevo recorre **los
>   seis tonos**, no uno de muestra.
>
> · Metí `.afinar__nota` y `.interruptor__texto small` en el mismo saco que el
>   texto invisible. **No lo eran**: medidos daban 13,97:1 y 16,19:1 —heredaban
>   la tinta de la página, que contrasta de sobra—, así que ahí el token roto
>   costaba **jerarquía visual**, no legibilidad: la nota secundaria pesaba lo
>   mismo que el título. El único ilegible era `.estilo-card__pie small`, y
>   porque cuelga de un `<button>`, que hereda negro.

En tema claro los dos están bien: es el tema oscuro el que no se repasó.

> **Nota sobre cómo se ha medido esto**, porque la primera pasada dio cinco
> avisos falsos. `getComputedStyle` devuelve unos colores como `rgb(95, 57, 81)`
> —de 0 a 255— y otros como `color(srgb 0.371 0.224 0.319)` —de 0 a 1—, según de
> dónde salga el token. Dividiendo por 255 los segundos, todo salía casi negro y
> el contraste daba 1,00:1 contra cualquier fondo. Y un texto sobre una **foto**
> no se puede juzgar así: ahora se salta en vez de inventarse un fondo blanco.
> Con las dos cosas arregladas quedaron los tres de arriba, y son los de verdad.

---

## 3. Tres tablas pintan todas sus filas, y se nota en cada tecla

No hay paginación ni virtualización en ninguna tabla de la aplicación
(comprobado: cero coincidencias de página, límite o ventana en las cuatro
pantallas de tabla).

**Medido con una hermandad grande de verdad** —800 hermanos, tres ejercicios de
recibos, 3.000 apuntes—, cronometrando lo que tarda en pintarse y **lo que
tarda en responder a una tecla del buscador**, que es lo que de verdad se nota:

```
 pintar  tecla   nodos  filas  pantalla
   327 ms      -        446      0  Inicio
  1259 ms     55 ms   24380   1600  Hermanos (censo)
  3835 ms    245 ms  107834   4512  Cuotas
   711 ms     92 ms   17931    800  Papeletas
   408 ms      -        403      0  Cortejo
  1717 ms    192 ms   52324   3000  Tesorería
   450 ms      -        453      6  Informes
   466 ms      -       2084     10  Comunicados
   410 ms      -        284      0  Notificaciones
   330 ms      -        431      0  Configuración
```

**Cuotas: 3,8 segundos en abrir y un cuarto de segundo por letra.** Y esos
4.512 recibos son pocos: una hermandad de 800 que emita cuatro conceptos al año
y tenga tres ejercicios en la ventana de histórico junta unos 9.000, o sea el
doble de todo.

**La causa está medida y tiene nombre.** Las cuatro pantallas usan ya
`useDeferredValue`, que es lo que mantiene el cursor suelto mientras la tabla
se repinta. Pero **solo Hermanos memoriza el cuerpo de su tabla**
(`src/pages/app/censo/FilasDelCenso.tsx`, con un comentario que explica por
qué), y se ve en la columna de la tecla:

| pantalla | filas | cuerpo memorizado | ms por tecla |
|---|---|---|---|
| Hermanos | 1.600 | **sí** | 55 |
| Papeletas | 800 | no | 92 |
| Tesorería | 3.000 | no | 192 |
| Cuotas | 4.512 | no | **245** |

Papeletas, con **la mitad de filas** que Hermanos, cuesta casi el doble por
tecla. El arreglo ya está escrito en el propio repositorio: hacerle a Cuotas,
Tesorería y Papeletas lo que se le hizo al censo.

---

## 4. El censo lleva un padrón oculto que es el 20 % de su DOM

**Dónde:** `src/pages/app/Hermanos.tsx:1199`

El comentario dice «solo existe al imprimir». **No es verdad**: está siempre en
el documento, escondido con `screen-hidden`. Medido:

```
Hermanos   nodos=24380  ·  en papel oculto=4836 (20 %)
           tablas: a la vista 800 filas | OCULTA 800 filas
Cuotas     nodos=107834 ·  en papel oculto=0
Tesorería  nodos=52324  ·  en papel oculto=0
```

Son **800 filas y unas 4.000 celdas** que nadie mira hasta que se pulsa
Imprimir. El `useMemo` que se le puso evita reconstruirlo en cada tecla —y eso
funciona—, pero no evita montarlo ni mantenerlo.

Al lado hay ya la solución hecha: `papeletas/ZonaDeImpresion.tsx` **no existe
hasta que se pulsa** (`if (!listaImpresion) return null`). Es el mismo problema
resuelto bien a cuatro ficheros de distancia.

---

## 5. La memoria del ejercicio publica «hermano nº 0»

**Dónde:** `src/lib/memoria.ts:147`

Las altas del año se ordenan con `a.numero - b.numero` y se imprimen con
`numero: h.numero`. Los hermanos de baja llevan **número 0**, no un número real
—lo dice `COMO-TRABAJAR.md`—, así que quien entra en enero y se da de baja en
octubre **del mismo año** sale como hermano nº 0, y además de primero.

**Comprobado ejecutando `construirMemoria`** con tres altas de 2026, una de
ellas dada de baja en octubre:

```
LAS ALTAS DE 2026, EN EL ORDEN EN QUE SALEN EN LA MEMORIA:
   nº   0 · Bruno Salas Gil · Baja
   nº  12 · Ana Ruiz Mora · Activo
   nº  13 · Carmen Vega Nieto · Activo
```

La memoria del ejercicio es un papel que se lleva a cabildo. El idioma correcto
ya está en la casa: `Hermanos.tsx:579` ordena con `(a.numero || Infinity)` y
escribe `h.numero > 0 ? h.numero : '—'`. Aquí no se usa.

---

## 6. Treinta y cuatro filtros dicen cuál está puesto solo con el color

De los 39 botones que se pintan con `chip--active`, **34 no llevan
`aria-pressed` ni `aria-current`**. Quien use un lector de pantalla no puede
saber qué filtro está aplicado, y quien no distinga bien los colores tampoco:
el estado no está en ninguna parte más que en el tono del fondo.

Están repartidos por Cuotas (4), Hermanos (4), Cortejo (2), Campañas (2),
Comunicados (2), Archivo, Errores de producción, Asistencia por tramo (2) y
dieciséis más. Cinco sí lo llevan, así que el patrón bueno también está escrito.

---

## 7. Un apunte de dinero calculado con el estado del render

**Dónde:** `src/pages/app/Campanas.tsx:219`

```tsx
onApuntar={(datos) => {
  setMovimientos(conApunteDeCobro(movimientos, datos))
```

`movimientos` sale del cierre del render, no del actualizador. Es la trampa que
`COMO-TRABAJAR.md` nombra literalmente («va **dentro** del updater:
`setX(prev => …)`»), y aquí toca el libro de Tesorería: dos apuntes seguidos
podrían dejar solo el último.

**Honestamente: no lo he conseguido reproducir.** El formulario se cierra en la
misma pulsación, así que para apuntar dos veces hay que volver a abrirlo y
entonces el estado ya está fresco. Lo dejo escrito porque es dinero, porque el
arreglo es cambiar una línea a `setMovimientos((prev) => …)`, y porque el mismo
patrón está en otros seis sitios de esa pantalla y de Personal — hoy inocuos,
mañana quién sabe.

---

## Lo que se ha mirado y está bien

Merece decirse, porque es la mitad del trabajo:

- **Maquetación en móvil.** Quince pantallas a 390 px, en claro y en oscuro:
  **ni un desborde horizontal**. Se midió `scrollWidth > clientWidth` y, cuando
  saltara, qué elemento concreto sobresale. No saltó ninguna vez.
- **Botones.** Se pulsaron los botones visibles de diecisiete pantallas,
  recargando antes de cada pulsación: **ninguno rompe la aplicación y ninguno
  deja un error en la consola**. Los que parecían no hacer nada eran filtros ya
  activos, o un `submit` con un campo obligatorio vacío —el navegador enseña su
  globo y esa parte no se puede medir desde fuera—.
- **Estado obsoleto tras un `await`.** Se buscó el patrón exacto en todo
  `src/`: **ni un caso real**. Los dos que salieron eran homónimos
  (`r.resguardo`, `r.certificado`).
- **Dinero.** `Math.round(n * 100) / 100` se usa de forma consistente, y
  `sepa.ts` lleva escrito el razonamiento de por qué se redondea línea a línea
  y no al final.
- **Errores de Supabase.** De 247 llamadas, doce no recogen el error; once
  están cubiertas por un `if (!data)` que dice algo sensato. La que no, es la
  del punto 1.
- **Fechas.** Las 30 apariciones de `toISOString()` se revisaron una a una: las
  que dan un día son todas `hoyIso`, y `tienda.ts:604` —medianoche local
  convertida a UTC para comparar con un `timestamptz`— es correcta, no un
  descuido.
- **Contraste en tema claro.** Limpio en las quince pantallas.

---

## Lo que queda

Los puntos **1 y 2 están hechos**. Después de ellos, el barrido de las quince
pantallas × tres vistas (móvil claro, móvil oscuro, escritorio oscuro) sale
**limpio en las cuarenta y cinco**: ni un desborde, ni un contraste por debajo
de 3:1, ni un error de consola. Antes salían tres avisos.

Por orden de lo que yo haría:

1. **El punto 3**, que es el que más se nota usándolo, y el patrón ya está
   escrito en `FilasDelCenso.tsx`.
2. Los puntos **4, 5, 6 y 7** son cada uno de un rato corto.

Y de todos ellos, el que más dice de cómo está montado esto es **el 3**: la
solución existe, está a cuatro ficheros, y solo se aplicó donde alguien se
molestó en medir.
