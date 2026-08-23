# Hoja de ruta

Estado del proyecto y lo que queda para cerrarlo. Actualizado en agosto de 2026.

La app está **completa como producto de gestión en modo local**: se puede enseñar
entera, con datos de ejemplo, y todos los flujos funcionan de principio a fin.
**Todo lo que se podía hacer sin depender de servicios de fuera está cerrado**
(F1–F13, el constructor de webs y el acabado). Lo que queda —F14 a F17— necesita
Supabase, el banco o el dominio: son trámites que solo puede hacer la hermandad.

---

## Fases cerradas

| Fase | Qué entró |
|------|-----------|
| **F1–F2** | Censo, cuotas, papeletas, cortejo, tesorería, inventario, archivo, comunicados, informes, web pública, configuración. Permisos por cargo. |
| **F3** | El hermano pide su papeleta desde su área y secretaría la acepta (y entra sola en el cortejo). QR de verificación, modelo de papeleta con datos reales, avisos al hermano, segmentación de destinatarios, páginas propias en el menú de la web. |
| **F4** | Sección de precios en la portada. |
| **F5** | Papeleta de móvil (QR), física (sin QR) o las dos. Bajas con renumeración del censo. Cuatro packs de suscripción con control de acceso real. Asistencia del día de salida por el diputado de tramo. |
| **F6** | Cuotas por ejercicio: salto de año con emisión anual a todo el censo, y «simular cobro» de la remesa. |
| **F7** | Eventos y tareas: calendario, tareas por evento y trabajadores asignados. |
| **F8** | Contenidos de la web editables de verdad: Historia y páginas con entradilla, párrafos con subtítulo y fotos reordenables; titulares con autoría y texto largo; cultos con cuándo, dónde y foto; secciones renombrables; la vista previa salta a lo que se está editando. Buscador de hermano en vez de lista desplegable. |
| **F9** | Cabecera y pie configurables, mapa incrustado y la pestaña «Contacto» sacada a la luz. Ver abajo. |
| **F10** | Galería por álbumes con visor a pantalla completa; portada con varias fotos reordenables; boletines con PDF de verdad (subido o enlazado), portada y fecha. |
| **F11** | Los ocho documentos imprimibles, depurados de verdad: el orden del cortejo salía en media hoja y repetido, sin márgenes de la segunda página en adelante y con las tablas partidas. |
| **F12** | Campos propios en la ficha del hermano (texto, número, sí/no, lista, fecha), sesgos guardados con nombre y el mismo editor de sesgos en el censo y en los comunicados. |
| **F13** | Tareas asignables a las cuentas del personal, «mis tareas» al entrar, y la sección de Cultos de la web sacando sola los próximos actos del calendario. |
| **Web premium** | Paletas y parejas tipográficas ya combinadas, esquinas y aire, cinco plantillas, vista previa en móvil/tableta/escritorio a tamaño real, deshacer y rehacer, tarjeta de «al compartir» con etiquetas Open Graph de verdad, y aviso de legibilidad de los colores. |
| **Acabado** | Veinte detalles: título de pestaña por módulo, saltar al contenido, foco visible, «reducir movimiento», ordenar el censo, exportar e imprimir con el sesgo aplicado, atajos de teclado, arrastrar y pegar fotos, estados vacíos que explican qué pasa… |
| **Eventos que se repiten** | Un acto puede repetirse a diario, semanal, mensual o anualmente, con fecha de fin o «siempre». Las repeticiones se calculan al vuelo (no se guardan copias), así un ensayo semanal para siempre no ocupa nada. El hermano ve el calendario de la hermandad en su área, con el detalle del día al lado. Las tareas se pueden asignar a un **cargo** o a una **etiqueta**, no solo a una persona. |
| **Web en un clic** | Ocho estilos completos (plantilla, colores, letra, esquinas y aire ya combinados) con miniatura de verdad: se pulsa uno y la web queda hecha, con una sola entrada en el historial. Todo lo demás se pliega en «Afinar a mano». Los avisos pasan de lista de reproches a barra de progreso. |
| **Interfaz limpia** | Un solo calendario en toda la app, con los nombres de los actos dentro de las casillas. Paleta de comandos (Ctrl+K). Menús de acciones secundarias en las cabeceras. Interruptores con explicación en vez de casillas sueltas. Acciones sobre muchos hermanos a la vez en el censo. Casillas y radios con el color de la casa, cabeceras de tabla consistentes, áreas pulsables cómodas con el dedo. |
| **Editor de la web** | Raíl de secciones agrupadas (Aspecto, Contenido, Datos) con un punto en las que están vacías, vista previa grande sobre su propio lienzo con el alto ligado a la ventana, y el progreso de la web en una línea que se despliega. |
| **Hermanos** | Ficha con cabecera de persona: avatar sobre un tono estable sacado del nombre, años en la hermandad, tramo del cortejo y etiquetas; cumpleaños con la edad; baja y RGPD plegados en «Administración»; panel ancho. En el censo, filtro de cumpleaños del mes y antigüedad con los años. |
| **Ajustes** | Las nueve secciones de Configuración, repartidas en el mismo raíl, con la sección abierta recordada y «Restablecer datos» marcado como zona de peligro. |
| **Pruebas** | `npm test`: 81 casos sobre las funciones puras que mueven dinero, fechas y sitios del cortejo (repeticiones, emisión de cuotas, reparto, remesa SEPA, sesgos y contraste). Sin dependencias nuevas. |
| **Auditorías** | Cuatro rondas (unas 90 incidencias). Corregidos, entre otros: el QR no se podía escanear, la impresión en tema oscuro salía ilegible, un token de CSS inexistente borraba bordes en media interfaz, doble cobro en fraccionamientos mensuales, un día de desfase en todas las fechas de cobro, la fecha del fichero SEPA siempre un día antes, permisos que se abrían solos ante un cargo desconocido, la verificación en dos pasos inalcanzable y los campos propios de la ficha inusables. En la cuarta ronda: un ensayo semanal creado hace años desaparecía del calendario, un evento mensual el día 31 se iba corrido desde febrero, uno anual el 29 de febrero se quedaba en el 1 de marzo para siempre, cambiar «Cuota Anual» por «Cuota anual» volvía a cobrar a todo el censo, los datos de la hermandad se perdían si fallaba la red al guardar, y el alta con DNI repetido dejaba el botón bloqueado. |

### Qué entró en F9

- **Cabecera**: se elige si se ve el logo, el nombre y el lema, el texto del
  botón de la derecha (vacío = sin botón) y si la barra se queda arriba al bajar.
- **Pie**: columnas de enlaces a medida (a una sección propia con `#cultos`, a
  una página o a una dirección de fuera), datos de contacto, redes y aviso legal.
  Antes era **una sola línea de texto**.
- **Mapa incrustado** en la sección de contacto, dibujado a partir de la
  dirección (sin clave de Google). Solo se incrustan enlaces de Google Maps: un
  iframe a cualquier dirección escrita en el editor sería un agujero en la web
  pública (`esDeGoogleMaps` en `src/lib/webPublica.ts`).
- **Avisos en el editor** de lo que falta («tu web no dice dónde estáis»,
  «el pie no tiene aviso legal», «hay enlaces que no llevan a ninguna parte»),
  con un botón que lleva a la pestaña donde se arregla.
- **Pestañas reordenadas**: primero lo que da forma a toda la web (diseño,
  cabecera y pie, contacto) y después el contenido. «Contacto» estaba la última
  y casi nadie llegaba a ella.

---

## Lo que queda

Ya **no queda nada que se pueda hacer sin configurar servicios de fuera**. Lo
que sigue depende de Supabase, del banco o del dominio.

| Fase | Qué entra |
|------|-----------|
| **F14** | Conectar Supabase. |
| **F15** | Correos de verdad. |
| **F16** | Cobros y domiciliaciones. |
| **F17** | Dominio propio y remate. |

Además, **cada 20 subidas** toca limpieza total: aviso y zip del proyecto
completo y limpio, para que no se solapen entregas.

---

## F14 — Conectar la base de datos *(necesita Supabase)*

La fase bisagra: todo lo demás depende de ella.

**Qué hay preparado ya:**
- `supabase/schema.sql` — para crear la base desde cero.
- `supabase/rls-endurecer.sql` — **obligatorio**: cierra los dos «permitir por
  defecto» de la seguridad (quien se registra por su cuenta no es el titular, y
  el tipo de cuenta se saca de las tablas y no del token, que el usuario puede
  reescribir). Al final del archivo se explica cómo dar de alta al titular.
- `supabase/migracion-2026-08.sql` — para una base ya creada antes.
- Todos los módulos usan `useSupabaseTable`, que ya sabe hablar con Supabase.

**Qué falta:**
- Crear el proyecto y pegar las claves en `.env` (ver `.env.example`).
- **Cerrar la ventana de arranque**: si se guarda algo en el primer segundo,
  mientras la tabla aún está cargando, ese cambio se pierde
  (`src/lib/supabaseSync.ts`, la bandera `cargado`).
- Repasar las políticas RLS por cargo.
- Copias de seguridad automáticas.

---

## F15 — Correos de verdad *(necesita Supabase + dominio)*

Hoy **todo el envío es simulado**.

### Lo que hace que lleguen y no caigan en spam

Tres registros DNS en el dominio de la hermandad:

- **SPF** — qué servidores pueden enviar en su nombre.
- **DKIM** — firma criptográfica de cada correo.
- **DMARC** — qué hacer si algo no cuadra, con informes.

Sin los tres, Gmail y Outlook mandan a spam o rechazan. Además:

- **Enviar desde un subdominio** (`avisos.hermandad.es`), no desde el principal:
  si un boletín se marca como spam, no arrastra el correo normal.
- **Calentar el dominio**: los primeros envíos, poco a poco. Mandar 1.200
  correos de golpe con un dominio nuevo es la mejor forma de que lo bloqueen.

### Proveedor

Para el volumen típico (unos 20.000 correos al año con 1.200 hermanos) vale
cualquiera por unos 20 €/mes: **Resend** (el más limpio de integrar), **Brevo**
(bueno si se quieren boletines con editor) o **Amazon SES** (el más barato, más
trabajo de configuración). Confirmar tarifas vigentes al contratar.

### Arquitectura

Los correos **no se pueden enviar desde el navegador** (la clave del proveedor
quedaría a la vista). Van en una **Edge Function de Supabase**.

### Qué se envía

Papeleta de móvil con su QR, avisos de secretaría, comunicados, recordatorios de
cuota. Con registro de envíos y **baja de la lista** (obligatorio por RGPD).

---

## F16 — Cobrar de verdad *(necesita Supabase)*

### Domiciliaciones (cuotas) — por el banco

Es lo que hacen las hermandades y sale mucho más barato.

**Trámites (los hace la hermandad):**
1. Pedir al banco el **Identificador de Acreedor SEPA**. Es gratis.
2. Firmar el contrato de adeudos directos CORE.
3. Recoger el **mandato** de cada hermano (los ya domiciliados valen).

**Coste:** del orden de 0,20–0,60 € por recibo, negociable. Con 1.200 hermanos,
unos 300–500 €/año. Las devoluciones se cobran aparte (2–4 € cada una).

**Lo que falta en el código** — hoy el XML `pain.008` se genera bien, pero:
- Los **mandatos son inventados**: el identificador y la fecha de firma se
  sintetizan. Hace falta gestión real (referencia única por hermano, fecha de
  firma, estado).
- Todo va marcado como **`RCUR`**; el primer adeudo de cada hermano debe ir como
  **`FRST`**.
- **No se leen las devoluciones**: el banco devuelve un fichero (`pain.002` o
  `camt.054`) que hoy nadie procesa.

Ver `src/lib/sepa.ts`.

### Pasarela (pagos puntuales)

Para papeletas, donativos y lotería: **Redsys** (lo da el propio banco) o
**Stripe**. Para cuotas recurrentes **no compensa**: una pasarela se va a
900–1.200 €/año frente a los ~400 € del banco.

---

## F17 — La web, terminada — **hecha** (ver `docs/FASES-WEB.md`, W1–W10)

- Formulario de contacto, solicitud de alta, donativos y lotería: **hechos**.
  Caen en el buzón de la web, dentro del panel.
- Calendario público de cultos enlazado con Eventos: **hecho**.
- Dominio propio: se configura y se comprueba desde el editor; lo que queda es
  que la hermandad compre el dominio y apunte el DNS
  (ver [`CONECTAR.md`](CONECTAR.md)).

---

## Y de propina, cuando todo lo anterior esté

- Histórico completo en el área del hermano: **hecho** (fase H1).
- Repaso a fondo de móvil y accesibilidad: **hecho** (fase P10). Las 19
  pantallas comprobadas a 390 px, sin desbordes, con el foco del teclado
  visible y sin texto ilegible.
- Memoria anual y exportación a Excel: pendiente.
- Verificación en dos pasos: la pantalla está; falta Supabase.
- Manual de uso: pendiente.

## Lo que vino después: las fases P

Cuando F, W y H estuvieron hechas quedaba lo que hace falta para que una
hermandad **empiece a usar Gobergo de verdad**: importar su censo, que las
solicitudes lleguen a alguien, la foto del hermano, el alta en condiciones…
Está todo en [`FASES-PUESTA-EN-MARCHA.md`](FASES-PUESTA-EN-MARCHA.md), y lo que
queda por conectar (correo, cobros, dominio) en [`CONECTAR.md`](CONECTAR.md).

---

## Traspaso: no solo el censo

Una hermandad que cambia de programa no trae solo la lista de hermanos. Trae el
**historial de cuotas** (la memoria de su tesorería: sin ella no se puede
reclamar un impago de hace dos años), el **libro de caja** del ejercicio y el
**inventario** con sus valores de seguro. Las tres se importan igual que el
censo —mismo asistente, misma vista previa fila a fila, mismo deshacer— desde
Cuotas, Tesorería e Inventario.

Por dentro es un motor con descriptores: `lib/leerTabla.ts` lee el archivo,
`lib/importarTabla.ts` hace el ensayo y `lib/tablasImportables.ts` dice qué es
una cuota, un apunte o un enser. **Añadir una cuarta tabla es escribir un
descriptor**, no otro importador.

Hojas de ensayo con los líos de siempre, y lo que tiene que salir exactamente,
en [`tablas-de-prueba/LEEME.md`](tablas-de-prueba/LEEME.md).

---

## Cobros: lo que falta para cobrar de verdad

Las domiciliaciones SEPA y la suscripción de Stripe están a medias, y lo que
falta de cada una está escrito en [`COBROS-LO-QUE-FALTA.md`](COBROS-LO-QUE-FALTA.md).
En corto: el fichero SEPA se genera entero pero los mandatos firmados se
sintetizan (bloqueante legal antes de la primera remesa real), y de Stripe está
la parte que cobra pero **no el webhook**, así que la aplicación no se entera de
que ha cobrado. No corre prisa; conviene leerlo antes de prometerle cobros a una
hermandad.

---

## Lo que hace falta del titular

- **Precios reales** de cada pack.
- **Qué entra en cada pack**, para que «Todo» valga la pena.
- **Cuándo activar Supabase**: es la puerta a correos, cobros y multidispositivo.
- **Textos legales** revisados (hay plantillas en `src/data/legal.ts`, con los
  huecos marcados entre corchetes).
- Identificador de Acreedor SEPA y dominio: son trámites que solo puede hacer la
  hermandad, y son los que más tardan. Conviene empezarlos pronto.
