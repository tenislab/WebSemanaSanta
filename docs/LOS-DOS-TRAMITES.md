# Los dos trámites que solo puede hacer la hermandad

Y que son los que más tardan. **Empezarlos es lo primero**, porque casi todo lo
demás espera a uno de los dos: sin identificador de acreedor no se puede cobrar
una cuota domiciliada, y sin dominio con correo verificado no sale un comunicado
a los hermanos.

Los dos son baratos —uno es gratis— y los dos se hacen una sola vez.

---

## 1 · El Identificador de Acreedor SEPA

### Qué es

Un código de dieciséis caracteres que identifica a la hermandad **como quien
cobra**. Va dentro de cada remesa y en cada mandato que firma el hermano. Sin
él, el fichero que se presenta al banco no existe.

Tiene esta forma, y no es casual:

```
ES 11 000 B12345674
├┘ ├┘ ├─┘ ├───────┘
│  │  │   └─ el NIF de la hermandad
│  │  └───── código de negocio: lo pone la hermandad, casi siempre «000»
│  └──────── dos dígitos de control, calculados sobre el NIF
└─────────── el país
```

**Ya sabes cómo empieza y cómo acaba el vuestro.** Los dos dígitos de control
salen del NIF, así que con el NIF puesto en Configuración la aplicación os
enseña el que os tocará y lo pone de un clic mientras llega el del banco. Lo
único que puede cambiar es el «000» del medio, si el banco os da otro código de
negocio — y esos tres caracteres **no** entran en el control.

### Qué cuesta y cuánto tarda

**Es gratis.** El código en sí no se paga. Lo que se firma es el contrato de
adeudos directos, y ahí sí puede haber comisiones — pregúntalas, abajo está
cómo.

Tarda lo que tarde el banco en tramitar el contrato: **de unos días a unas
semanas**, y depende más de la oficina que del banco. Por eso va primero.

### Qué pedir, con estas palabras

En la oficina donde la hermandad tiene la cuenta, a quien lleve empresas:

> Queremos **presentar nosotros las remesas de adeudos directos SEPA CORE por
> fichero**, en formato XML `pain.008.001.02`. Necesitamos el **identificador de
> acreedor** y el acceso para subir los ficheros por la banca electrónica.

Las tres cosas que hay que decir sí o sí: **CORE** (no B2B: el B2B es entre
empresas y el hermano no puede firmarlo), **por fichero** (que lo presentáis
vosotros, no que el banco os teclee los recibos) y **`pain.008.001.02`**, que es
el esquema que genera Gobergo.

### Qué van a pedirte

Llévalo de una vez y te ahorras una segunda visita:

- **CIF de la hermandad.**
- **Estatutos** o escritura, y la **inscripción en el registro de entidades
  religiosas** si la tenéis.
- **Acta de nombramiento de la junta** en vigor, que es lo que demuestra quién
  puede firmar.
- **DNI del firmante** (hermano mayor o tesorero, según los estatutos).
- El **IBAN** de la cuenta donde entra el dinero.

### Las cuatro preguntas que hay que hacer, y apuntar la respuesta

Ninguna es opcional: las cuatro cambian cómo se usa la aplicación.

1. **¿Con cuántos días de antelación hay que presentar la remesa?** Es el dato
   que más se olvida y el que hace que rechacen un fichero entero. Cada banco
   pone el suyo. Gobergo propone la fecha de cobro de la remesa a **cinco
   días** y, al emitir las cuotas, un primer cobro a **quince** —eso último no
   es plazo del banco, es el margen para avisar al hermano antes de cobrarle—.
   Las dos fechas se pueden cambiar a mano; si tu banco pide más, ponlo.
2. **¿Qué se cobra por remesa, por recibo y por devolución?** La devolución es
   la que duele: si son 3 € y se devuelven cuarenta recibos, son 120 € que no
   estaban en ningún presupuesto.
3. **¿Cómo llegan las devoluciones?** Gobergo lee el fichero de devueltos. Que
   te digan **qué formato** dan y **dónde** se descarga.
4. **¿Nos dais otro código de negocio distinto del «000»?** Si sí, apúntalo:
   son los tres caracteres del medio.

### Cuando llegue: dónde se pone y cómo sabes que está bien

**Configuración → La hermandad → Identificador de acreedor SEPA.**

Escríbelo y la aplicación lo comprueba en el momento: las cifras de control
contra el NIF, la longitud, y que el NIF de dentro sea **el de tu hermandad** y
no el del gestor o el de la hermandad de al lado —copiarlo es el error clásico,
está bien formado y el banco lo acepta: cobrarías en nombre de otro—.

Si algo no cuadra, el aviso dice **qué** falla y **cuál** tendría que ser. No
hace falta esperar al banco para descubrirlo.

---

## 2 · El dominio con correo verificado

### Qué es y para qué

Un dominio propio (`gobergo.es`, por ejemplo) y, colgado de él, un remitente
verificado para los correos que manda la máquina. Sin esto:

- los comunicados a los hermanos salen desde una dirección prestada y **caen en
  spam**, que es peor que no mandarlos: nadie se enteraría de que no llegan;
- el «he olvidado mi contraseña» del área del hermano llega con remitente de
  Supabase;
- y la web de cada hermandad no puede apuntar a su propio dominio.

### Qué cuesta

Un `.es` ronda los **12 € al año**. El remitente de los automáticos (Resend)
tiene plan gratuito de sobra para empezar. El correo de personas (Google
Workspace) se paga por buzón, y con uno basta.

### El paso a paso, entero

Está escrito y comprobado en **[`CUANDO-TENGA-DOMINIO.md`](CUANDO-TENGA-DOMINIO.md)**:
las nueve secciones, con la trampa de los DNS explicada —hay que meter registros
de tres sitios distintos en el mismo panel— y una comprobación final para saber
que ha salido bien.

Aquí solo el orden, para empezar hoy:

1. **Comprar el dominio.** Donde quieras; apunta dónde está el panel de DNS.
2. **Separar los dos remitentes** antes de tocar nada: las personas por Workspace,
   la máquina por Resend. Mezclarlos es lo que arrastra tu correo personal a spam
   el día que un envío masivo caiga mal.
3. **Los DNS**, que es la única parte con trampa.
4. **Vercel y Supabase**, que es cambiar direcciones en dos paneles.
5. **La comprobación final** de la sección 9.

### Cómo sabes que está hecho

Cuando el «he olvidado mi contraseña» llegue **desde tu dominio** y un
comunicado de prueba a tu propio correo **entre en la bandeja de entrada, no en
spam**. Mándate uno antes de mandar el primero de verdad.

---

## En qué orden, y por qué

| | Trámite | Depende de ti | Lo desbloquea |
|---|---|---|---|
| **Hoy** | Pedir el identificador de acreedor | una visita al banco | cobrar cuotas domiciliadas |
| **Hoy** | Comprar el dominio | doce euros | los correos y las webs propias |
| Después | Los DNS y los dos paneles | una tarde | — |

**Los dos el mismo día.** El del banco se pide y se espera, así que mientras
tramitan el contrato ya puedes tener el dominio andando. Al revés se pierden
semanas esperando a que empiece la espera.
