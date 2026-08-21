/**
 * ¿Se va a tomar Excel esta celda como una FÓRMULA en vez de como texto?
 *
 * Los programas de hoja de cálculo ejecutan lo que empieza por `=`, `+`, `@`
 * o `-`. Y eso no es un problema teórico aquí: el censo no lo escribe solo la
 * secretaría. En la web de la hermandad hay un formulario de «hazte hermano»
 * donde escribe cualquiera desde fuera, y de ahí sale una solicitud de alta
 * con el nombre que esa persona haya puesto.
 *
 * O sea que alguien puede darse de alta llamándose
 *
 *     =HYPERLINK("http://sitio-malo.example","Pincha aquí")
 *
 * y esperar. El día que la secretaria exporte el censo y lo abra en Excel
 * —que es exactamente para lo que está el botón «Exportar»— ese texto deja de
 * ser un nombre y pasa a ser algo que el programa ejecuta en su ordenador,
 * con sus permisos y con el censo entero delante.
 *
 * Los números NO se tocan: un importe de -25 tiene que seguir siendo -25 y no
 * un texto, o la hoja no suma. Por eso se mira si lo que empieza por signo
 * menos es un número de verdad antes de decidir.
 */
function pareceFormula(valor: string | number): boolean {
  if (typeof valor === 'number') return false
  const texto = valor.trimStart()
  if (!/^[=+@\t\r-]/.test(texto)) return false
  // «-25», «-1.234,50»: eso es una cifra, no una fórmula.
  if (/^-\s*[\d.,]+$/.test(texto)) return false
  return true
}

function celda(valor: string | number) {
  // La comilla simple delante es lo que le dice a Excel y a LibreOffice
  // «esto es texto»: no se ve en la celda, y al copiar el valor no viaja.
  const texto = pareceFormula(valor) ? `'${String(valor)}` : String(valor)
  return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function toCsv(columnas: string[], filas: (string | number)[][]) {
  const lineas = [columnas, ...filas].map((fila) => fila.map(celda).join(';'))
  return lineas.join('\n')
}

export function descargarArchivo(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8;') {
  // El BOM ayuda a Excel a detectar UTF-8 en CSV, pero rompe la validación
  // de XML en muchos bancos: solo se antepone para contenido de tipo CSV/texto.
  const conBom = tipo.includes('csv') || tipo.includes('text/plain')
  const blob = new Blob([conBom ? '﻿' + contenido : contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
