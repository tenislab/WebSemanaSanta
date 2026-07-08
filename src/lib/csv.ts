function celda(valor: string | number) {
  const texto = String(valor)
  return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function toCsv(columnas: string[], filas: (string | number)[][]) {
  const lineas = [columnas, ...filas].map((fila) => fila.map(celda).join(';'))
  return lineas.join('\n')
}

export function descargarArchivo(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['﻿' + contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
