# Cómo viaja un correo, de la hermandad a sus costaleros

Un recorrido completo, con el ejemplo de convocar a los costaleros a un ensayo.

---

## El ejemplo

> La Hermandad de la Amargura quiere avisar a **los costaleros del paso de
> misterio** de que el ensayo se adelanta al viernes.

Son 42 personas de un censo de 800. Nadie quiere buscarlas a mano.

---

## Paso 1 · ¿Quién es costalero?

Aquí está lo que hace que esto funcione: **nadie marca a nadie como costalero**.
Se deduce de la papeleta que sacó.

```
Configuración → Cortejo
  Tramo «Costaleros paso de misterio»  ·  etiqueta: Costalero
                                              ▲
                              se pone UNA vez, al crear el tramo
```

Y a partir de ahí:

```
Papeleta de Manuel Ruiz  →  tramo «Costaleros paso de misterio»
                         →  etiqueta automática: Costalero
```

**No se guarda en su ficha, se calcula.** Si escribiéramos la etiqueta al
asignar la papeleta habría que acordarse en los diez sitios donde una papeleta
cambia (asignar, reasignar, anular, renunciar, cambiar de opción…), y en cuanto
se escapara uno el censo diría que alguien es costalero de un año en el que no
salió. Derivándola, no puede descuadrarse nunca.

> **Ojo con lo que NO es.** Ser costalero no da permisos en el panel. Los
> permisos van por cargo, en Personal. Si se mezclaran, un costalero acabaría
> viendo la tesorería por haber sacado su papeleta.

---

## Paso 2 · Elegir a quién se le manda

```
Comunicados → Nuevo → Destinatarios
```

| Criterio | Valor |
|---|---|
| Estado | Activo |
| Etiqueta | **Costalero** |
| Cuota | Todos |
| Edad | Todos |
| Solo con correo | Sí |

```
800 hermanos
  └─ Activos ................... 761
       └─ etiqueta «Costalero» .. 42
            └─ con correo ....... 39     ← estos reciben el correo
```

Los 3 sin correo **no se pierden**: el aviso les llega igual a su área de
hermano. El correo es un extra, no la única vía.

También se puede filtrar por **campos propios** de la hermandad («talla de
costal = 3», «carné en regla = sí») si los tienen definidos.

---

## Paso 3 · Publicar

Al darle a publicar pasan dos cosas, y en este orden:

```
1. El aviso entra en el área de cada hermano  ←  SIEMPRE
2. Sale el correo                             ←  si está configurado
```

El orden importa: si el correo falla, el hermano se entera igual la próxima vez
que entre. Al revés —mandar el correo y que fallara el guardado— sería avisar de
algo que no ha pasado.

---

## Paso 4 · Quién recibe de verdad

De los 39, todavía se filtra una vez más:

```
39 con correo
  └─ ¿la hermandad tiene el correo encendido? .......... sí
       └─ ¿tiene encendidos los comunicados? ........... sí
            └─ ¿este hermano no lo ha apagado? ......... 37 sí, 2 no
                 └─ ¿su correo parece un correo? ....... 37
```

**Los 2 que lo apagaron no reciben el correo**, pero sí el aviso dentro de la
app. Que la hermandad encienda los avisos no le quita a nadie su decisión: cada
hermano lo controla desde su área.

---

## Paso 5 · El envío

```
Navegador  ──►  Función del servidor  ──►  Resend  ──►  37 buzones
```

**Por qué pasa por el servidor y no va directo.** La clave del proveedor de
correo no puede estar en el navegador: quien la tenga puede mandar correo en
nombre de la hermandad desde cualquier sitio. Vive como secreto en Supabase y
no sale de ahí.

Antes de mandar nada, la función comprueba **quién llama**:

- ¿Tiene sesión abierta? Si no, fuera.
- ¿Es un hermano? Fuera también: los hermanos entran en su área, no mandan
  correos a los demás.

---

## Paso 6 · Lo que le llega a Manuel

```
De:          Hdad. de la Amargura <no-responder@gobergo.es>
Responder a: secretaria@hermandaddelaamargura.es
Para:        no-responder@gobergo.es
CCO:         (los 37, ocultos)
Asunto:      El ensayo se adelanta al viernes
```

Tres detalles, y ninguno es cosmético:

**El nombre es el de su hermandad**, no el de Gobergo. Lo lee el servidor de la
ficha de la hermandad; no se acepta del navegador, porque si viniera de fuera
cualquiera con una sesión podría firmar como «Banco Santander» desde un dominio
verificado.

**Todos van en copia oculta.** Mandar un comunicado con 37 direcciones a la
vista es repartir el censo entre 37 personas. En una hermandad esos datos
revelan convicciones religiosas: categoría especial del RGPD, el nivel más alto
de protección que hay.

**Si Manuel responde, contesta a su secretaría**, no a nosotros.

---

## Los otros correos que salen solos

El mismo camino, disparados por lo que va pasando:

| Cuándo | Qué le llega | Interruptor |
|---|---|---|
| Se publica un comunicado | El comunicado | Comunicados |
| Se marca su cuota pagada | «Tu recibo queda pagado» | Cuotas |
| Se le asigna sitio | «Ya tienes sitio: Palio» | Papeletas |
| Cambian datos de su ficha | Qué se ha cambiado | Ficha |
| Le cambian la cuenta bancaria | Aviso aparte | Ficha |
| **Se tramita su baja** | La baja | Ficha |

> La baja es el único donde el correo **no es un extra**: a partir de ahí pierde
> el acceso a su área, así que el aviso de dentro no lo va a leer nunca.

---

## Y el otro correo, el de las cuentas

No tiene nada que ver con lo anterior y por eso se configura aparte. Es la
confusión más habitual:

| | Confirmar cuenta, recuperar contraseña | Comunicados y avisos |
|---|---|---|
| Lo manda | **Supabase** | **Gobergo** (la función) |
| Se configura en | Authentication → SMTP | Edge Functions → Secrets |
| ¿Va hoy sin dominio? | Sí, con Gmail (a spam) | **No** |

Los comunicados necesitan dominio propio: van por Resend, y Resend sin dominio
verificado solo escribe a tu propia dirección.
