/** P4: cuándo sale el asistente de alta de la hermandad. */
export default async function ({ cargar, caso }) {
  const m = await cargar('src/lib/altaHermandad.ts')
  const vacia = { cif: '', direccion: '', iban: '' }

  // Recién creada: no tiene nada, hay que preguntárselo.
  caso('una hermandad vacía tiene el alta pendiente', true, m.altaPendiente(vacia))
  // Con CUALQUIERA de los tres puestos ya no es nueva: alguien pasó por
  // Configuración y el asistente sería un estorbo.
  caso('con CIF, ya no', false, m.altaPendiente({ ...vacia, cif: 'G41000000' }))
  caso('con dirección, ya no', false, m.altaPendiente({ ...vacia, direccion: 'C/ Pureza 53' }))
  caso('con IBAN, ya no', false, m.altaPendiente({ ...vacia, iban: 'ES47 2100' }))
  // Espacios en blanco no son un dato.
  caso('espacios en blanco no cuentan', true, m.altaPendiente({ cif: '  ', direccion: ' ', iban: '   ' }))

  // Una vez hecho (o saltado), no vuelve a salir: si no, se cerraría sin leer
  // en cada entrada.
  localStorage.setItem(m.CLAVE_ALTA_HECHA, 'si')
  caso('hecho una vez, no vuelve a salir', false, m.altaPendiente(vacia))
  localStorage.removeItem(m.CLAVE_ALTA_HECHA)
  caso('y al limpiar la marca vuelve a estar pendiente', true, m.altaPendiente(vacia))
}
