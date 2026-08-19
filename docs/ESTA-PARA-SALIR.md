# ¿Está Cabildo para salir al público?

Sin adornos, porque no sirven de nada.

**Respuesta corta: para una hermandad piloto, sí. Para vender a diez, todavía
no.** Y lo que falta no es programar más pantallas: es una temporada de uso
real y tres cosas que no dependen del código.

---

## Lo que está de verdad

No es una maqueta. Son 143 archivos, ~19.700 líneas, 470 pruebas automáticas y
una regresión en navegador de verdad que se pasa entera antes de cada entrega.
Funciona:

- **El censo**: alta, baja con recolocación del escalafón, reactivación
  recuperando la antigüedad, etiquetas, sesgos guardados, campos a medida,
  importación desde el Excel que ya tienen.
- **El dinero**: cuotas por ejercicio, emisión anual, mora con doble
  confirmación, remesas SEPA, tesorería con conciliación.
- **El cortejo y las papeletas**: reparto por número o por solicitud, aforos,
  cascada entre tramos, papeleta con QR verificable, modo día de salida.
- **La web pública**: diez fases de trabajo, ocho estilos de un clic, SEO,
  formularios que llegan a un buzón dentro del panel.
- **El área del hermano**: su historial, su sitio en el cortejo, su carné con
  QR, sus avisos, su familia a cargo, avisar de que ha pagado.

Y está cuidado en cosas que casi nadie mira: contraste comprobado en los dos
temas, 390 px sin desbordes en las 19 pantallas, foco de teclado visible,
textos alternativos, `lang` correcto, impresión decente.

---

## Lo que le falta para salir, y no es código

### 1. Nadie la ha usado todavía con hermanos de verdad

Esto es lo más importante y no se arregla programando. Toda la aplicación se ha
probado con datos de ejemplo y con pruebas automáticas. Eso caza los fallos de
lógica, no los de **realidad**: que una hermandad numere los tramos al revés,
que tengan tres pasos y no dos, que la cuota se cobre en dos plazos, que el
Excel del censo tenga una columna que no habíamos previsto.

Una temporada completa —de la emisión de cuotas a la salida— con **una**
hermandad que avise de lo que falla vale más que otras diez fases.

### 2. Tres cosas hay que contratarlas, y no las contratamos nosotros

- **La base de datos.** Sin ella todo vive en un navegador. Es gratis y es una
  tarde de trabajo, pero hay que hacerla.
- **El correo.** Hoy los avisos son un buzón dentro de la aplicación: si el
  hermano no entra, no se entera. Para que salga un correo hace falta un
  proveedor y verificar el dominio (SPF, DKIM, DMARC).
- **La pasarela de cobro**, si la quieren. Sin ella se paga por Bizum y alguien
  mira el extracto, que es lo que hacen hoy.

Está todo explicado en [`CONECTAR.md`](CONECTAR.md), y la propia aplicación lo
avisa en rojo donde se nota. Pero mientras no se haga, **Cabildo es una
demostración muy buena, no un sistema en producción**.

### 3. Falta el manual

Una junta de hermandad no es un equipo técnico. La aplicación se explica sola
bastante bien —cada aviso dice qué falta y quién lo arregla—, pero no hay un
manual, ni un vídeo, ni a quién llamar cuando algo no se entiende. Para una
piloto acompañada no hace falta; para vender a diez, sí.

---

## Los agujeros concretos que conozco

Están dichos también dentro de la aplicación, no solo aquí.

| Qué | Cuánto pesa |
|---|---|
| **Las fotos se guardan dentro del contenido** (`data:`) en vez de en un almacén. La web pesa más de lo que debería y la tarjeta al compartir sale sin imagen | Medio. Es lo primero que hay que hacer |
| **La importación no crea las cuentas de acceso** de los hermanos. Entran al censo y la hermandad trabaja con ellos, pero para entrar en *su* área hay que darles acceso desde su ficha. Y quien no tiene correo no puede tener cuenta | Medio, y en parte no tiene arreglo: una cuenta necesita un correo |
| **Sin correo saliente**, los avisos al hermano solo se ven si entra | Alto mientras no se conecte |
| **La numeración del escalafón no se ha validado con una hermandad real.** La lógica está probada (30 casos) pero cada casa tiene sus costumbres | Alto: es lo que más duele si sale mal |
| **Memoria anual y exportación completa a Excel**: no están | Bajo |
| **Verificación en dos pasos**: la pantalla está, falta conectarla | Bajo |

---

## Lo que NO es un problema, aunque lo parezca

- **Que funcione sin base de datos.** No es un apaño: es lo que permite
  enseñarla a una junta en dos minutos sin instalar nada. Está claramente
  avisado.
- **Que no se pague con tarjeta.** No es que falte por hacer: es que el dinero
  tiene que ir a una cuenta de la hermandad y eso lo contratan ellos. Lo que
  hay —Bizum con aviso y confirmación— es exactamente lo que hacen hoy por
  teléfono, pero sin la llamada.
- **El JavaScript de 1,1 MB** (318 kB comprimido). No es bonito, pero para un
  panel de gestión que se abre una vez y se usa una hora, no es un problema
  real. Se arregla partiendo el paquete el día que moleste.

---

## Entonces, ¿qué haría yo?

1. **Buscar una hermandad piloto** y acompañarla una temporada entera, gratis,
   a cambio de que cuente todo lo que falla. Es el paso que falta, y ningún
   otro lo sustituye.
2. Conectar Supabase y el correo **antes** de esa piloto. Sin base de datos no
   es un sistema, y sin correo la mitad de las funciones no llegan a nadie.
3. Mover las fotos a un almacén de verdad.
4. Escribir el manual mientras se acompaña a la piloto: sale solo, de las
   preguntas que hagan.
5. **Después** de eso, y solo después, enseñarla a la segunda y a la tercera.

Sacarla a diez hermandades hoy, sin base de datos conectada, sin correo y sin
que nadie la haya usado una temporada, saldría mal. No por el código: porque
todavía no sabemos qué es lo que de verdad falla.
