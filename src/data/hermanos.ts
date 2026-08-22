import type { Cargo } from './documentos'
export type EstadoHermano = 'Activo' | 'Nuevo' | 'Baja'

export interface Hermano {
  id: string
  numero: number
  nombre: string
  estado: EstadoHermano
  antiguedad: number
  email: string
  telefono: string
  direccion: string
  cuotaAlDia: boolean
  /** Cuenta bancaria del hermano, de donde se carga la domiciliación de sus cuotas. */
  iban: string | null
  /** DNI/NIE con el que el hermano se identifica en su área personal. */
  dni: string
  /** Contraseña de acceso al área del hermano (en claro solo mientras no hay backend real; en modo demostración). */
  claveAcceso: string
  /** Id de su cuenta real de Supabase Auth, una vez creada (null en modo demostración o hasta que se cree). */
  authUserId: string | null
  /**
   * El cargo que lleva en la junta, si lleva alguno. Vacío = hermano de a pie.
   *
   * VA AQUÍ, EN SU FICHA, Y NO EN UNA SEGUNDA CUENTA. En una hermandad nadie
   * se ve como «un usuario del sistema»: se ve como hermano nº 214 que este
   * año lleva la secretaría. El cargo es temporal —cambia con cada junta— y
   * ser hermano es para siempre. Teniéndolo aquí, cuando cambia la junta no
   * hay que borrar cuentas ni crear otras: se mueve el cargo de una ficha a
   * otra.
   *
   * Y quita de en medio el lío de tener dos identidades: la secretaria entraba
   * con DNI y clave a su área, y con correo y contraseña al panel. Dos formas
   * de ser la misma persona, y de ahí salían la mitad de los desconciertos.
   *
   * PARA LLEVAR CARGO HACE FALTA CORREO. No es un capricho: con cargo se entra
   * al panel, y el panel lo protegen las políticas de la base de datos, que
   * preguntan «¿quién eres?» a una cuenta de verdad. Sin correo no hay cuenta,
   * y sin cuenta no hay protección en el servidor. La pantalla lo dice al
   * intentar ponerlo.
   */
  cargo?: Cargo | null
  /**
   * Hermano civil: está en el censo y tiene su área, pero NO paga cuotas.
   *
   * Para quien trabaja en la hermandad sin ser hermano —un administrativo
   * contratado, un asesor— y necesita entrar. Antes había que darle de alta
   * como «personal», que era una segunda forma de existir en el sistema con
   * sus propias reglas. Así es una persona más del censo, con su ficha y su
   * área, y lo único distinto es que no se le emiten cuotas.
   */
  civil?: boolean
  /** Etiquetas del hermano (costalero, acólito, banda…), para segmentar avisos y listados. */
  etiquetas?: string[]
  /**
   * Su foto, ya recortada en cuadrado. Sale en su ficha, en su carné y —lo que
   * de verdad importa— en el listado del cortejo: el diputado de tramo busca
   * caras, no números.
   */
  fotoDataUrl?: string | null
  /**
   * Ha dado permiso para que la hermandad guarde y use su foto. Va aparte del
   * resto de datos a propósito: una foto es un dato personal de los que hay que
   * poder demostrar que se consintieron.
   */
  consienteFoto?: boolean
  /** Parroquia donde fue bautizado/a y fecha. Hace falta para el expediente. */
  parroquiaBautismo?: string
  fechaBautismo?: string
  /** Talla de túnica, que secretaría acaba apuntando en un papel aparte. */
  tallaTunica?: string
  /**
   * Lo que hay que saber el día de la salida: una alergia, que no puede andar
   * mucho, que se marea. No es curiosidad: son ocho horas de pie.
   */
  notasSalud?: string
  /** El hermano ha pedido la baja desde su área y la secretaría aún no la ha tramitado. */
  bajaSolicitada?: boolean
  /** Cuándo la pidió. Sin la fecha, la secretaría no sabe cuánto lleva esperando. */
  bajaSolicitadaEl?: string
  /**
   * Por qué se va, si ha querido decirlo. Es opcional a propósito: obligar a
   * justificarse para poder darse de baja está feo. Pero cuando lo dicen, es
   * lo único que le permite a la hermandad reaccionar (una cuota que no puede
   * pagar se resuelve hablando; enterarse un año después, no).
   */
  motivoBaja?: string
  /** Fecha de nacimiento (ISO yyyy-mm-dd), para segmentar por edad (mayores/menores). Opcional. */
  fechaNacimiento?: string
  /**
   * Quién lo lleva: el id del hermano que gestiona su papeleta y sus cuotas
   * desde su propia cuenta. Es lo normal con los menores, que no tienen ni
   * correo ni forma de entrar solos, y hasta ahora obligaba a los padres a
   * pasar por secretaría para todo.
   */
  tutorId?: string
  /**
   * Campos a medida de la hermandad (talla de túnica, nº de llave…),
   * indexados por el id del campo. Ver `lib/camposPropios.ts`. El valor va
   * siempre como texto: si mañana cambia el tipo del campo, lo escrito no se
   * pierde.
   */
  campos?: Record<string, string>
}

/**
 * Censo de ejemplo. Lo comparten los módulos de Hermanos, Cuotas, Papeletas
 * y Cortejo (cada recibo o puesto se emite a nombre de uno de estos
 * hermanos), para que los datos no diverjan entre pantallas mientras no hay
 * base de datos real. El tramo de cada hermano en el cortejo no se guarda
 * aquí: se calcula solo a partir de su número de hermano — ver
 * lib/cortejo.ts. Algunos hermanos (h6, h7, h11, h14) se dejan sin IBAN a
 * propósito, para poder mostrar qué pasa cuando no se puede domiciliar una
 * cuota.
 */
/**
 * Clave de acceso al área del hermano que comparten todos los hermanos de
 * ejemplo, para que la demo se pueda probar con cualquier DNI de la lista
 * sin tener que recordar contraseñas distintas.
 */
export const CLAVE_DEMO_HERMANOS = 'hermano123'

/**
 * Censo ampliado para que la demo se vea poblada (papeletas, cuotas, informes…)
 * sin escribir a mano decenas de fichas. Es DETERMINISTA (mismos datos en cada
 * carga) para que la demostración no cambie sola. Se define ANTES de
 * HERMANOS_INICIALES porque este lo usa al inicializarse.
 */
const NOMBRES_DEMO = [
  'Álvaro Núñez Prieto', 'Marta Gil Herrera', 'Sergio Ramos León', 'Elena Cano Ruiz',
  'Pablo Ferrer Segura', 'Nuria Blanco Pino', 'Iván Torres Gala', 'Sara Méndez Rey',
  'Hugo Vidal Marín', 'Claudia Ripoll Serna', 'Adrián Lozano Vera', 'Paula Sáez Roldán',
  'Óscar Bravo Cid', 'Irene Nadal Costa', 'Marcos Peña Duarte', 'Lucas Arias Gallardo',
  'Alba Suárez Rivas', 'Daniel Prados Mora', 'Sofía Carmona Gil', 'Jorge Aranda Rubio',
  'Natalia Vargas Soto', 'Rubén Castaño Lara', 'Andrea Mora Quintero', 'Víctor Salas Beltrán',
  'Cristina Vera Alonso', 'Gonzalo Ibáñez Rico', 'Miriam Pardo Nieto', 'Alberto Rojas Vela',
  'Laura Campos Bueno', 'Diego Santos Robles', 'Ángela Herrero Gil', 'Raúl Montes Vega',
  'Patricia León Casas', 'Emilio Nieto Bravo', 'Silvia Ortega Peña',
]
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

function generarHermanosDemo(): Hermano[] {
  return NOMBRES_DEMO.map((nombre, i): Hermano => {
    const antiguedad = 1980 + ((i * 7) % 45)
    const dniNum = 10000000 + i * 137
    // Fecha de nacimiento determinista: la mayoría adultos; ~1 de cada 8, menor
    // de edad (nacido 2009-2012), para poder probar la segmentación por edad.
    const anioNac = i % 8 === 3 ? 2009 + (i % 4) : 1955 + ((i * 13) % 50)
    const fechaNacimiento = `${anioNac}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 27)).padStart(2, '0')}`
    const estado: EstadoHermano = antiguedad >= 2025 ? 'Nuevo' : i % 17 === 0 ? 'Baja' : 'Activo'
    return {
      id: `hd${i + 1}`,
      // Los de baja quedan fuera de la numeración activa (0 = «sin número»),
      // igual que hace la propia app al tramitar una baja.
      numero: estado === 'Baja' ? 0 : 800 + i,
      nombre,
      estado,
      antiguedad,
      fechaNacimiento,
      email: `${nombre.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}${i}@example.com`,
      telefono: `6${String(10000000 + i * 91).slice(0, 8)}`,
      direccion: `C/ Ejemplo, ${10 + i}`,
      cuotaAlDia: i % 3 !== 0,
      iban: i % 5 === 0 ? null : `ES${String(70 + (i % 29)).padStart(2, '0')} 2100 ${String(1000 + i).padStart(4, '0')} ${String(20 + i).padStart(2, '0')} ${String(10000000 + i * 131).slice(0, 8)}`,
      dni: `${dniNum}${LETRAS_DNI[dniNum % 23]}`,
      claveAcceso: CLAVE_DEMO_HERMANOS,
      authUserId: null,
    }
  })
}

export const HERMANOS_INICIALES: Hermano[] = [
  { id: 'h1', numero: 89, nombre: 'Ana Sánchez del Río', estado: 'Activo', antiguedad: 1991, fechaNacimiento: '1960-06-09', email: 'ana.sanchez@example.com', telefono: '622 104 558', direccion: 'C/ Alfarería, 12', cuotaAlDia: true, iban: 'ES47 2100 0813 6102 0012 3456', dni: '12345678A', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h2', numero: 214, nombre: 'María Reyes Ortega', estado: 'Activo', antiguedad: 1998, fechaNacimiento: '1972-11-26', email: 'maria.reyes@example.com', telefono: '655 302 119', direccion: 'C/ Feria, 44', cuotaAlDia: true, iban: 'ES12 0049 1500 0512 3456 7892', dni: '23456789B', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h3', numero: 340, nombre: 'Juan Luis Cabrera', estado: 'Activo', antiguedad: 2004, fechaNacimiento: '1982-05-17', email: 'juanluis.cabrera@example.com', telefono: '611 887 220', direccion: 'Avda. de la Palmera, 8', cuotaAlDia: false, iban: 'ES60 0182 0304 4102 0158 9001', dni: '34567890C', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h4', numero: 501, nombre: 'Francisco Gómez Nieto', estado: 'Activo', antiguedad: 2012, fechaNacimiento: '1985-10-16', email: 'fran.gomez@example.com', telefono: '699 445 011', direccion: 'C/ Betis, 21', cuotaAlDia: false, iban: 'ES03 2038 5788 6360 0056 8237', dni: '45678901D', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null, etiquetas: ['Diputado de tramo'] },
  { id: 'h5', numero: 612, nombre: 'Carmen Pérez Luna', estado: 'Activo', antiguedad: 2016, fechaNacimiento: '1982-01-19', email: 'carmen.perez@example.com', telefono: '633 210 774', direccion: 'C/ Sierpes, 3', cuotaAlDia: true, iban: 'ES91 2100 0418 4502 0005 1332', dni: '56789012E', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h6', numero: 0, nombre: 'Antonio Vega Morales', estado: 'Baja', antiguedad: 1985, fechaNacimiento: '1965-01-01', email: 'antonio.vega@example.com', telefono: '600 112 334', direccion: 'C/ San Jacinto, 15', cuotaAlDia: false, iban: null, dni: '67890123F', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h7', numero: 733, nombre: 'Isabel Ramírez Cortés', estado: 'Nuevo', antiguedad: 2026, fechaNacimiento: '2001-02-05', email: 'isabel.ramirez@example.com', telefono: '644 908 213', direccion: 'C/ Pureza, 30', cuotaAlDia: true, iban: null, dni: '78901234G', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h8', numero: 178, nombre: 'Manuel Jiménez Ruiz', estado: 'Activo', antiguedad: 1996, fechaNacimiento: '1954-11-17', email: 'manuel.jimenez@example.com', telefono: '677 554 902', direccion: 'C/ Castilla, 61', cuotaAlDia: true, iban: 'ES71 0075 1234 5606 0012 3457', dni: '89012345H', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h9', numero: 425, nombre: 'Lucía Fernández Soto', estado: 'Activo', antiguedad: 2007, fechaNacimiento: '1978-06-21', email: 'lucia.fernandez@example.com', telefono: '688 337 145', direccion: 'C/ Rodrigo de Triana, 9', cuotaAlDia: true, iban: 'ES27 2085 8720 2103 0012 3458', dni: '90123456J', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h10', numero: 690, nombre: 'Pedro Molina Aguilar', estado: 'Activo', antiguedad: 2014, fechaNacimiento: '1980-07-16', email: 'pedro.molina@example.com', telefono: '612 776 480', direccion: 'C/ Evangelista, 18', cuotaAlDia: false, iban: 'ES38 2038 6109 9930 0012 3459', dni: '01234567K', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h11', numero: 731, nombre: 'Rocío Domínguez Vargas', estado: 'Nuevo', antiguedad: 2026, fechaNacimiento: '2003-12-03', email: 'rocio.dominguez@example.com', telefono: '691 220 667', direccion: 'C/ Pagés del Corro, 55', cuotaAlDia: true, iban: null, dni: '11223344L', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h12', numero: 302, nombre: 'José Antonio Reina', estado: 'Activo', antiguedad: 2001, fechaNacimiento: '1965-03-06', email: 'joseantonio.reina@example.com', telefono: '666 803 512', direccion: 'C/ Dos de Mayo, 7', cuotaAlDia: true, iban: 'ES55 0081 0345 6100 0123 4560', dni: '22334455M', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h13', numero: 45, nombre: 'Rafael Ortiz Bermejo', estado: 'Activo', antiguedad: 1988, fechaNacimiento: '1949-10-19', email: 'rafael.ortiz@example.com', telefono: '655 019 442', direccion: 'C/ Águilas, 6', cuotaAlDia: true, iban: 'ES19 0128 0257 3801 0012 3461', dni: '33445566N', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h14', numero: 610, nombre: 'Diego Fernández Ríos', estado: 'Activo', antiguedad: 2020, fechaNacimiento: '1988-11-17', email: 'diego.fernandez@example.com', telefono: '622 887 015', direccion: 'C/ Bailén, 14', cuotaAlDia: true, iban: null, dni: '44556677P', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  { id: 'h15', numero: 520, nombre: 'Beatriz Muñoz Casas', estado: 'Activo', antiguedad: 2021, fechaNacimiento: '2001-05-08', email: 'beatriz.munoz@example.com', telefono: '611 340 928', direccion: 'C/ Pureza, 55', cuotaAlDia: false, iban: 'ES40 2100 5731 1502 0012 3462', dni: '55667788Q', claveAcceso: CLAVE_DEMO_HERMANOS, authUserId: null },
  ...generarHermanosDemo(),
]

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}
