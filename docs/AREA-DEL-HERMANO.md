# El área del hermano (fases H1–H10)

La otra mitad de Cabildo. El panel es para los cinco o seis que llevan la
hermandad; **esta parte es para los mil que son hermanos**, y es la que decide
si la hermandad deja de recibir las mismas cuatro llamadas todas las semanas:
«¿os ha entrado ya mi cuota?», «¿en qué tramo voy?», «¿cuándo se saca la
papeleta?», «¿podéis apuntar a mi hijo?».

Todo lo de aquí funciona **hoy**, en modo local y con Supabase. Lo único que
espera a un tercero es cobrar con tarjeta (ver H3).

| Fase | Qué entra | Estado |
|------|-----------|--------|
| **H1** | Su vida en la hermandad | Hecha |
| **H2** | Su sitio en el cortejo, de verdad | Hecha |
| **H3** | Pagar desde el área del hermano | Hecha (sin pasarela) |
| **H4** | Avisos y notificaciones | Hecha |
| **H5** | Su familia | Hecha |
| **H6** | El carné digital con QR | Hecha |

---

## H1 — Su vida en la hermandad

Antes, el hermano entraba y veía cuatro datos sueltos. Ahora ve **su historia**:
los recibos año por año, las papeletas año por año, y cuántas veces ha salido
de verdad (que no es lo mismo que cuántas papeletas ha sacado: las renuncias y
las anuladas no cuentan).

- Agrupado por ejercicio, de lo nuevo a lo viejo.
- Lo que no tiene año no se pierde: va al final, como «Sin ejercicio».
- Cada recibo y cada papeleta se abren en su documento imprimible.

## H2 — Su sitio en el cortejo, de verdad

No «Cirio, 3.er tramo» en un texto suelto, sino **dónde va** dentro del
cortejo: su cuerpo, su tramo, cuántos van delante y cuántos detrás, y con quién
comparte tramo si la hermandad lo publica.

## H3 — Pagar desde el área del hermano

Lo que hoy se hace por teléfono, sin llamar.

- Botón **«Pagar»** en cada recibo que se deba, con el Bizum y el IBAN de la
  hermandad y el concepto ya escrito (`Recibo 1045 - Nombre`), que es lo que
  permite a la tesorería identificar el ingreso.
- Se puede pagar lo no domiciliado **y también lo domiciliado que el banco
  devolvió o está en mora**: ahí la domiciliación no ha servido y el recibo
  sigue debiéndose.
- El hermano avisa de que ha pagado; **no se da por pagado solo**. La tesorería
  lo ve en el Inicio y en Cuotas (banner, filtro propio y marca en la fila),
  comprueba el ingreso y lo confirma en un clic. Al confirmarlo, al hermano le
  llega a su buzón.
- **«Me he equivocado, quitar el aviso»**: quien se confunde de recibo
  rectifica sin llamar a nadie.
- Si la hermandad no ha publicado datos de cobro, se dice; no se deja al
  hermano ante un botón que no lleva a ninguna parte.

**Sin pasarela.** Cabildo no cobra por la hermandad: el dinero tiene que ir a
una cuenta suya, y eso exige contratar una pasarela a su nombre. Cuando la
tengan, se pega el enlace en Web pública → Donativos y el botón lleva a ella
(ver W10). Mientras tanto, esto es exactamente lo que ya hacen, pero sin la
llamada.

## H4 — Avisos y notificaciones

Un buzón de verdad, con el aviso de cada cosa que le pasa: cambios en su ficha,
comunicados de la hermandad, cuotas y papeletas. Cada hermano elige **qué tipos
quiere recibir**; lo que apaga no se borra, se deja de enseñar, así que si
vuelve a encenderlo recupera lo que le mandaron en vez de encontrarse el hueco.

## H5 — Su familia

Los menores a su cargo, con lo que de verdad hace falta:

- Pedir el alta de un hijo o hija desde su propia cuenta. La solicitud llega a
  secretaría diciendo **de quién es hijo** y con la fecha de nacimiento, para
  que se vea que es menor.
- Una vez dado de alta, el tutor le gestiona la papeleta desde su cuenta.
- El estado de lo pedido se refleja sin recargar: cuando secretaría aprueba, el
  «Alta pendiente» desaparece solo.

## H6 — El carné digital con QR

El carné en el móvil, con su QR. Como en la papeleta de sitio, los datos viajan
**dentro del propio enlace**: al escanearlo con cualquier teléfono se abre una
tarjeta con quién es, sin necesidad de base de datos ni de tener el censo en
ese aparato.

Un QR de papeleta impreso el año pasado **sigue valiendo**: las papeletas
antiguas no llevan la marca que distingue un carné, y el lector lo tiene en
cuenta.

---

## Cómo está conectado con el panel

Todo va en los dos sentidos, y **sin recargar**: el panel y el área del hermano
abiertos a la vez en dos pestañas se enteran el uno del otro.

| El hermano hace… | …y en el panel |
|---|---|
| Pide la baja | Secretaría la ve pendiente en Hermanos |
| Avisa de que ha pagado | Inicio y Cuotas lo avisan; se confirma en un clic |
| Solicita o renueva papeleta | Entra en el reparto de Papeletas |
| Pide el alta de un hijo | Hermanos → Solicitudes de alta, con el tutor |
| Cambia sus datos | Queda registrado en su ficha |

| La hermandad hace… | …y el hermano |
|---|---|
| Le cambia la ficha | Recibe el aviso diciendo qué se cambió |
| Da por pagada su cuota | Lo ve al momento y le llega al buzón |
| Le asigna sitio | Ve su tramo y su puesto en el cortejo |
| Manda un comunicado | Le llega a su buzón, si quiere ese tipo de aviso |
| Apunta un culto en Eventos | Le sale en su calendario y en la web |

## Lo que queda

- **Cobrar con tarjeta** (H3 y W10): espera a que la hermandad contrate su
  pasarela. El hueco está hecho.
- **Correo de verdad**: los avisos son un buzón dentro de la aplicación. Salir
  al correo electrónico o al SMS necesita contratar un proveedor de envío.
