# Las plantillas de correo, en español

Supabase manda los correos de cuenta con unas plantillas de fábrica **en
inglés**: «Reset your password», «Confirm your signup»… Un hermano de una
hermandad de Sevilla recibiendo eso no solo se queda extrañado: le suena a
timo y lo borra. Y encima con razón, porque un correo en un idioma que no es
el tuyo es exactamente lo que hace un correo fraudulento.

Aquí están las cuatro que se usan, listas para pegar.

## Dónde se pegan

**Supabase → Authentication → Emails → Templates**

Hay una pestaña por cada tipo. En cada una se cambian **dos cosas**: el
*Subject heading* (el asunto) y el cuerpo (el HTML).

> **NO toques `{{ .ConfirmationURL }}`.** Es donde Supabase mete el enlace de
> verdad. Si se borra o se escribe mal, el correo llega precioso y el botón no
> lleva a ninguna parte.

---

## 1 · Confirm signup

**Subject:** `Confirma tu correo · Gobergo`

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2c2c2c">
  <div style="background:#6a1a23;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
    <strong style="font-size:17px;letter-spacing:.3px">Gobergo</strong>
  </div>
  <div style="border:1px solid #e7e0d5;border-top:0;border-radius:0 0 10px 10px;padding:26px 22px;background:#fff">
    <h1 style="margin:0 0 14px;font-size:19px">Confirma tu correo</h1>
    <p style="margin:0 0 18px;line-height:1.6">
      Se ha creado una cuenta con esta dirección. Pulsa el botón para confirmarla
      y poder entrar.
    </p>
    <p style="margin:0 0 22px">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:#6a1a23;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">
        Confirmar mi correo
      </a>
    </p>
    <p style="margin:0;color:#6d6357;font-size:13px;line-height:1.6">
      Si no has sido tú, no hagas nada: sin confirmar, esa cuenta no se activa.
    </p>
  </div>
</div>
```

---

## 2 · Reset Password

**Subject:** `Cambiar tu contraseña · Gobergo`

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2c2c2c">
  <div style="background:#6a1a23;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
    <strong style="font-size:17px;letter-spacing:.3px">Gobergo</strong>
  </div>
  <div style="border:1px solid #e7e0d5;border-top:0;border-radius:0 0 10px 10px;padding:26px 22px;background:#fff">
    <h1 style="margin:0 0 14px;font-size:19px">Cambiar tu contraseña</h1>
    <p style="margin:0 0 18px;line-height:1.6">
      Has pedido cambiar la contraseña de tu cuenta. Pulsa el botón y elige una
      nueva. El enlace caduca en una hora.
    </p>
    <p style="margin:0 0 22px">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:#6a1a23;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">
        Elegir una contraseña nueva
      </a>
    </p>
    <p style="margin:0;color:#6d6357;font-size:13px;line-height:1.6">
      Si no lo has pedido tú, puedes ignorar este correo: tu contraseña actual
      sigue funcionando y nadie la ha cambiado.
    </p>
  </div>
</div>
```

---

## 3 · Magic Link

**Subject:** `Tu enlace de acceso · Gobergo`

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2c2c2c">
  <div style="background:#6a1a23;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
    <strong style="font-size:17px;letter-spacing:.3px">Gobergo</strong>
  </div>
  <div style="border:1px solid #e7e0d5;border-top:0;border-radius:0 0 10px 10px;padding:26px 22px;background:#fff">
    <h1 style="margin:0 0 14px;font-size:19px">Tu enlace para entrar</h1>
    <p style="margin:0 0 18px;line-height:1.6">
      Pulsa el botón y entrarás directamente, sin escribir contraseña.
    </p>
    <p style="margin:0 0 22px">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:#6a1a23;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">
        Entrar
      </a>
    </p>
    <p style="margin:0;color:#6d6357;font-size:13px;line-height:1.6">
      No compartas este enlace con nadie: quien lo tenga puede entrar en tu cuenta.
    </p>
  </div>
</div>
```

---

## 4 · Change Email Address

**Subject:** `Confirma tu nueva dirección · Gobergo`

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2c2c2c">
  <div style="background:#6a1a23;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
    <strong style="font-size:17px;letter-spacing:.3px">Gobergo</strong>
  </div>
  <div style="border:1px solid #e7e0d5;border-top:0;border-radius:0 0 10px 10px;padding:26px 22px;background:#fff">
    <h1 style="margin:0 0 14px;font-size:19px">Confirma tu nueva dirección</h1>
    <p style="margin:0 0 18px;line-height:1.6">
      Has pedido cambiar el correo de tu cuenta a <strong>{{ .Email }}</strong>.
      Pulsa el botón para confirmarlo.
    </p>
    <p style="margin:0 0 22px">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:#6a1a23;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">
        Confirmar el cambio
      </a>
    </p>
    <p style="margin:0;color:#6d6357;font-size:13px;line-height:1.6">
      Si no has pedido este cambio, avisa cuanto antes: alguien podría estar
      intentando quedarse con tu cuenta.
    </p>
  </div>
</div>
```

---

## Un par de detalles

**El color.** El `#6a1a23` es el granate de Gobergo. Si algún día cambia la
marca, es lo único que hay que buscar y reemplazar.

**Nada de imágenes.** Ni logo en PNG ni fondos. Media gente tiene las imágenes
bloqueadas por defecto en el correo, y un correo que se ve roto genera más
desconfianza que uno sencillo que se ve bien siempre. El membrete es una banda
de color, que se ve en todas partes.

**Por qué el texto de abajo importa.** «Si no lo has pedido tú…» no es relleno:
es lo que distingue un correo legítimo de uno fraudulento a ojos de quien lo
recibe. Y es lo que evita la llamada a secretaría preguntando qué es esto.
