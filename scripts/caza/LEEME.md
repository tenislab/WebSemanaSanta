# Las tres sondas del barrido

Tres guiones que **miden** lo que no se ve leyendo el código. Están aquí y no en
`/tmp` porque un hallazgo sin la forma de volver a medirlo no se puede
comprobar, y porque el mes que viene nadie se va a acordar de cómo se sacaron
los números de `docs/CAZA-DE-BUGS-2026-09-19.md`.

Los tres necesitan la aplicación **construida y servida**:

```bash
npm run build
npx vite preview --port 4173 --host 127.0.0.1 &
```

## `cronometro.mjs`

Siembra 800 hermanos, tres ejercicios de recibos y 3.000 apuntes —una hermandad
grande de verdad— y cronometra, pantalla a pantalla, lo que tarda en pintarse y
**lo que tarda en responder a una tecla del buscador**. Lo segundo es lo que se
nota: abrir en dos segundos se perdona, un cuarto de segundo por letra no.

```bash
node scripts/caza/cronometro.mjs
```

## `desbordes-y-contrastes.mjs`

Quince pantallas × móvil claro, móvil oscuro y escritorio oscuro. Mide si la
página se puede arrastrar de lado, **qué elemento concreto sobresale** —no
«algo se desborda»— y el contraste de cada texto contra el fondo que tiene
detrás de verdad, resuelto por el navegador.

Dos cosas que hay que saber de cómo mide, porque la primera versión se
autoengañó: `getComputedStyle` devuelve unos colores de 0 a 255 (`rgb(…)`) y
otros de 0 a 1 (`color(srgb …)`), y tratarlos igual da 1,00:1 contra cualquier
fondo; y un texto sobre una **foto** no se juzga, se salta.

```bash
node scripts/caza/desbordes-y-contrastes.mjs
```

## `ab.sh`

Mide un cambio de rendimiento **comparándolo contra el código sin el cambio**:
guarda lo que hay sin comprometer (`git stash -u`), construye, mide, lo
devuelve, construye, mide — y repite tres vueltas ALTERNANDO los lados.

Lo de alternar no es adorno. En esta máquina el `ms/tecla` oscila un ±40 %
entre pasadas de la misma versión: con una muestra por lado se puede
«demostrar» cualquier cosa, incluidas las dos contrarias. El primer «después»
que medí daba 304 → 153 ms y la mediana honesta era 179 → 60.

```bash
scripts/caza/ab.sh          # el resumen sale con medianas y muestras crudas
```

Deja el desglose en `/tmp/claude-0/ab.txt`. Al acabar hay que comprobar que el
árbol está como estaba: hace `stash` y `pop` seis veces.

## `ver-paginador.mjs`

Siembra una hermandad grande y enseña qué dice el paginador de cada tabla,
cuántas filas quedan en el DOM y cuántos nodos. Y lo prueba: salta a otra
página, pulsa «Ver todas» y vuelve.

```bash
node scripts/caza/ver-paginador.mjs     # deja las capturas en /tmp/claude-0/fotos-paginador
```

## `probar-padron.mjs` y `probar-beforeprint.mjs`

El primero mide cuánto pesa el padrón oculto del censo y **si sale en el papel**
por los tres caminos: el Ctrl+P, el botón y una impresión de verdad a PDF.

El segundo es el que decidió el diseño: contesta si `beforeprint` llega y si el
navegador recoge lo que se añada al DOM dentro del manejador. De eso dependía
poder montar el padrón solo al imprimir sin romper el Ctrl+P.

```bash
node scripts/caza/probar-beforeprint.mjs   # no necesita la app servida
node scripts/caza/probar-padron.mjs
```

## `botones.mjs`

Pulsa los botones visibles de diecisiete pantallas y anota si la pantalla se
cae, si salta un error en la consola o si el botón **no cambia nada**.

Deja fuera por su texto lo que destruye datos o abre un diálogo del sistema
(borrar, enviar, imprimir, descargar…) y **recarga antes de cada pulsación**.
Eso último no es por limpieza: la primera versión guardaba los botones en una
variable y pulsaba por índice, y en cuanto uno repintaba la pantalla los
guardados quedaban desprendidos del documento. Pulsar un nodo desprendido no
hace nada, así que daba «no hace nada» en nueve botones que funcionan
perfectamente.

```bash
node scripts/caza/botones.mjs
```

Y al leer lo que saca: un filtro **ya activo** no cambia nada al pulsarlo, y un
`submit` con un campo obligatorio vacío tampoco —el navegador enseña su globo, y
eso no se ve desde aquí—. Los dos son normales.

## `ver-ficha-partida.mjs`

La ficha del hermano, después de partirla en seis piezas. No comprueba que
compile —eso lo dice `tsc`— sino que los tres bloques que mudaron de fichero
**siguen funcionando con su estado dentro**, que es lo que se rompe al mudarlo:
abre una ficha, mira que los campos lleguen sembrados, **cambia de hermano**
para ver que se vuelven a sembrar, corrige el nombre y comprueba que el censo
cambia de verdad, marca una etiqueta, crea una nueva y escribe una talla.

```bash
node scripts/caza/ver-ficha-partida.mjs
```

Dos cosas que esta sonda se equivocó en decir, y por eso están escritas en ella:

* Buscar `/cerrar/i` entre **todos** los botones encuentra «Cerrar sesión» en el
  menú. La sonda cerraba la sesión y seguía midiendo una página vacía. El botón
  de cerrar se busca **dentro del cajón**.
* Y con la página vacía, la pregunta «¿han cambiado los campos al cambiar de
  hermano?» salía **verdadera**, porque los dos lados eran `null`. Comparar dos
  cosas que no están no es comparar: la comprobación exige ahora que las dos
  fichas tengan nombre.

---

## Y uno que no es una sonda: `scripts/ensayar-la-actualizacion.mjs`

No mira pantallas, mira la base. Ensaya `ACTUALIZAR.sql` desde **todos los
estados intermedios** del esquema —genera la base «como estaba en la versión N»
pegando solo las N primeras piezas— y comprueba que al actualizar queda
**idéntica** a una instalación nueva, con los datos intactos.

Está fuera de `npm test` porque son sesenta y una instalaciones completas. Se
pasa **antes de una tarde de Supabase**, que es cuando importa.

```bash
PGHOST=/tmp PGPORT=5433 node scripts/ensayar-la-actualizacion.mjs      # todas
PGHOST=/tmp PGPORT=5433 node scripts/ensayar-la-actualizacion.mjs 8    # una de cada 8
```

## `medir-papeleta-impresa.mjs`

Cuántas hojas ocupa una papeleta y de qué tamaño sale. Imprime **a PDF de
verdad** por CDP —el mismo motor que el diálogo— y mide tres cosas: cuántas
hojas trae el PDF, los milímetros de la hoja (`MediaBox`) y los centímetros de
la caja del documento. En tres escenarios: A4 forzado, A1 forzado y «lo que
pida el CSS».

```bash
node scripts/caza/medir-papeleta-impresa.mjs
```

Lo que destapó: el `@page` no declaraba tamaño —así que Chrome usaba el último
papel que tuviera, A1 en la captura que llegó— y el modelo subido por la
hermandad no tenía tope, así que **crecía con la hoja**: 1.420 px (37 cm) contra
los 15,5 cm del diseño genérico.

Tres cosas que esta sonda hizo mal antes de servir, y están escritas en ella:

* **El contador de páginas mentía.** Contaba «/Type /Page» en crudo, y Chrome
  mete los objetos en flujos comprimidos: la misma tanda de 28 papeletas salía
  «28» en un papel y «1» en otro. Ahora cuenta el `/Count` del árbol,
  descomprimiendo.
* **La tanda salía en blanco a partir de la segunda impresión** (1 KB), y la
  culpa no era de la aplicación: `printToPDF` dispara `afterprint`, y el
  manejador desmonta la zona de impresión — que es justo lo que debe hacer. La
  sonda la regenera antes de cada papel.
* **Topar la imagen y dejar que el lienzo la envolviera con `width: max-content`
  da cero.** El lienzo lleva `container-type: inline-size` y un contenedor de
  tamaño en línea no puede medirse por su contenido. Se vio midiendo: lienzo
  0 px, imagen 210 px, papeleta impresa a cinco centímetros.
