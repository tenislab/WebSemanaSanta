# Hoja de ruta

Estado del proyecto y lo que queda para cerrarlo. Actualizado en agosto de 2026.

La app está **completa como producto de gestión en modo local**: se puede enseñar
entera, con datos de ejemplo, y todos los flujos funcionan de principio a fin.
Lo que queda va en dos bloques: **F10–F13 se pueden hacer ya** (no dependen de
nada de fuera) y **F14–F17 necesitan Supabase, el banco o el dominio**.

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
| **Auditorías** | Dos rondas (unas 60 incidencias). Corregidos, entre otros: el QR no se podía escanear, la impresión en tema oscuro salía ilegible, un token de CSS inexistente borraba bordes en media interfaz, doble cobro en fraccionamientos mensuales y un día de desfase en todas las fechas de cobro. |

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

El orden es el acordado: primero todo lo que se puede dejar terminado **sin
configurar nada fuera**, y al final lo que depende de Supabase, del banco y del
dominio.

| Fase | Qué entra |
|------|-----------|
| **F10** | Galería por álbumes, portada y boletines. |
| **F11** | Los documentos imprimibles, uno a uno, empezando por el orden del cortejo. |
| **F12** | Campos propios en la ficha del hermano y sesgos guardados con nombre. |
| **F13** | Calendario y tareas asignadas a cuentas del personal («mis tareas»). |
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

## F17 — La web, terminada *(necesita Supabase + dominio)*

- Dominio propio funcionando de verdad (DNS y certificado).
- Formulario de contacto que llegue a secretaría (hoy la web da el correo y el
  teléfono, pero no hay formulario: enviarlo necesita servidor).
- Calendario público de cultos enlazado con el módulo de Eventos.

---

## Y de propina, cuando todo lo anterior esté

- Histórico completo en el área del hermano (papeletas y cuotas de años
  anteriores, descarga de recibos).
- Memoria anual y exportación a Excel.
- Verificación en dos pasos (la pantalla ya está; falta Supabase).
- Repaso a fondo de móvil y accesibilidad.
- Manual de uso.

---

## Lo que hace falta del titular

- **Precios reales** de cada pack.
- **Qué entra en cada pack**, para que «Todo» valga la pena.
- **Cuándo activar Supabase**: es la puerta a correos, cobros y multidispositivo.
- **Textos legales** revisados (hay plantillas en `src/data/legal.ts`, con los
  huecos marcados entre corchetes).
- Identificador de Acreedor SEPA y dominio: son trámites que solo puede hacer la
  hermandad, y son los que más tardan. Conviene empezarlos pronto.
