# Hoja de ruta

Estado del proyecto y lo que queda para cerrarlo. Actualizado en agosto de 2026.

La app está **completa como producto de gestión en modo local**: se puede enseñar
entera, con datos de ejemplo, y todos los flujos funcionan de principio a fin.
Casi todo lo que falta necesita la base de datos conectada.

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
| **Auditorías** | Dos rondas (unas 60 incidencias). Corregidos, entre otros: el QR no se podía escanear, la impresión en tema oscuro salía ilegible, un token de CSS inexistente borraba bordes en media interfaz, doble cobro en fraccionamientos mensuales y un día de desfase en todas las fechas de cobro. |

---

## F8 — Rematar lo suelto *(se puede hacer ya, sin depender de nada)*

Fase corta, todo en modo local:

- **Refrescar el censo sin recargar.** Cuotas y Eventos lo leen una sola vez al
  abrir la página; si se da de baja a alguien en otra pestaña, no se enteran.
- **Tablets estrechas** (560–700 px): el editor de tramos se sale de la pantalla
  y el botón flotante puede tapar el pie de la portada.
- **Plantilla web «sobria»**: su color secundario no llega a aplicarse.
- **Hermandades de muestra**: la baja solicitada ahí no se guarda.

---

## F9 — Que los packs signifiquen algo *(local)*

Hoy la única diferencia real entre packs es el dominio propio. El pack «Todo»
promete comunicados multicanal e informes avanzados, pero esos módulos no
distinguen el pack.

- Decidir qué entra exactamente en cada pack.
- Aplicarlo en el código (`CAPACIDAD_DE_MODULO` en `src/lib/suscripcion.ts`).
- **Poner los precios definitivos**: los actuales son inventados.

---

## F10 — Conectar la base de datos *(necesita Supabase)*

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

## F11 — Correos de verdad *(necesita Supabase + dominio)*

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

## F12 — Cobrar de verdad *(necesita Supabase)*

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

## F13 — La web, terminada *(necesita Supabase + dominio)*

- Dominio propio funcionando de verdad (DNS y certificado).
- Galería por álbumes.
- Formulario de contacto que llegue a secretaría.
- Calendario público de cultos enlazado con el módulo de Eventos.

---

## F14 — El acabado

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
