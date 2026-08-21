/**
 * Lo que pasa cuando los datos no son los de la demostración.
 *
 * Se probó la aplicación entera con cuatro juegos de datos distintos, en un
 * navegador de verdad: una hermandad recién creada sin un solo hermano, una de
 * 3.000, una con nombres raros (comillas, emoji, noventa letras) e importes
 * imposibles (cero, negativo, 999.999,99 €), y dos pestañas abiertas a la vez.
 *
 * Lo que salió mal:
 *
 *  1. «NaN AÑOS» EN EL CENSO. Sin año de antigüedad, la resta daba NaN y
 *     aparecía «NaN años» debajo del nombre de cada hermano —y en el carné, y
 *     en la lista de renovación de papeletas, donde la antigüedad es lo que
 *     decide el sitio en el cortejo. Es exactamente lo que pasa el día que una
 *     hermandad importa su censo de un Excel donde esa columna no existe.
 *
 *  2. «EMITIDO EL » Y AHÍ SE ACABABA LA FRASE. Un recibo sin fecha dejaba la
 *     frase a medias. Ese papel se le da a un hermano en mano.
 *
 *  3. EL ASISTENTE DE ALTA, OTRA VEZ Y OTRA VEZ. Ver más abajo.
 */
export default async function ({ caso, cargar }) {
  const { aniosDeHermandad, fraseAntiguedad } = await cargar('src/lib/hermanoFicha.ts')
  const HOY = new Date('2026-08-21T12:00:00')

  // --- 1. La antigüedad ---
  caso('un año normal', 36, aniosDeHermandad(1990, HOY))
  caso('este mismo año', 0, aniosDeHermandad(2026, HOY))
  // «No lo sé» y «cero años» son cosas distintas: por eso null y no 0.
  caso('sin antigüedad', null, aniosDeHermandad(undefined, HOY))
  caso('con null', null, aniosDeHermandad(null, HOY))
  caso('con texto', null, aniosDeHermandad('mil novecientos', HOY))
  // El cero es el caso traicionero: no cantaba, salía «2026 años de hermano/a».
  caso('con cero', null, aniosDeHermandad(0, HOY))
  caso('con una errata («205»)', null, aniosDeHermandad(205, HOY))
  caso('con un año imposible', null, aniosDeHermandad(2200, HOY))
  // Y el tope de arriba deja pasar a las hermandades de verdad: la más antigua
  // de Sevilla es del siglo XIV.
  caso('una hermandad del XIV', 686, aniosDeHermandad(1340, HOY))
  // El año que viene sí se acepta: una hermandad puede dar de alta en
  // diciembre a quien entra en enero.
  caso('el año que viene se acepta', 0, aniosDeHermandad(2027, HOY))

  // Contando hasta el año de la campaña, no hasta hoy: el reparto del cortejo
  // de 2027 se hace con la antigüedad a 2027.
  caso('hasta el año de la campaña', 37, aniosDeHermandad(1990, 2027))

  const hermano = (antiguedad) => ({ antiguedad })
  caso('la frase, con antigüedad', 'Hermano/a desde 1990 · 36 años', fraseAntiguedad(hermano(1990), HOY))
  caso('la frase, sin antigüedad', 'Antigüedad sin registrar', fraseAntiguedad(hermano(undefined), HOY))
  caso('la frase, este año', 'Hermano/a desde este año', fraseAntiguedad(hermano(2026), HOY))

  // --- 2. Los documentos con fechas que faltan ---
  const { readFile } = await import('node:fs/promises')
  const recibo = await readFile('src/components/Recibo.tsx', 'utf8')
  caso('el recibo no deja «Emitido el » a medias', true,
    recibo.includes("cuota.fechaEmision ? `Emitido el ${cuota.fechaEmision}` : 'Sin fecha de emisión'"))
  caso('ni «previsto el » sin fecha', false, /previsto el \{cuota\.fechaCobro\}/.test(recibo))
  const papeleta = await readFile('src/components/PapeletaTicket.tsx', 'utf8')
  caso('la papeleta tampoco', true, papeleta.includes("papeleta.fechaSolicitud ? `Solicitada el"))

  // --- 3. El asistente de alta ---
  // Se decidía al montar el panel, mirando lo que hubiera en ESTE navegador. Y
  // en uno nuevo —el ordenador de la casa de hermandad, el móvil, una ventana
  // de incógnito— todavía no hay nada, porque la fila de la base tarda unas
  // décimas. Así que al Hermano Mayor que ya había rellenado el CIF, la
  // dirección y la cuenta se los volvía a pedir desde el principio cada vez
  // que entraba desde otro sitio, con sus datos guardados por debajo.
  const ajustes = await readFile('src/lib/hermandadSettings.ts', 'utf8')
  caso('los ajustes dicen si ya se saben', true, ajustes.includes('export function useHermandadSettingsConEstado'))
  caso('sin Supabase se saben desde el principio', true, ajustes.includes('useState(!isSupabaseConfigured)'))
  caso('y con Supabase, cuando llega la respuesta', true, /if \(cancelado\) return\n\s*\/\/[\s\S]{0,180}setResuelto\(true\)/.test(ajustes))

  const shell = await readFile('src/components/AppShell.tsx', 'utf8')
  caso('el panel espera a saberlo', true, shell.includes('if (!ajustesResueltos || yaSeDecidio.current) return'))
  // Y se decide UNA sola vez: si se recalculara, al guardar el primer dato del
  // asistente dejaría de cumplirse la condición y se cerraría solo a mitad.
  caso('y lo decide una sola vez', true, shell.includes('yaSeDecidio.current = true'))
  caso('ya no mira solo este navegador', false, /altaPendiente\(getHermandadSettings\(\)\)/.test(shell))
}
