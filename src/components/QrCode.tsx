import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeProps {
  /** Texto real que codifica el QR (legible al escanearlo con cualquier lector). */
  value: string
  size?: number
}

/**
 * Código QR real y escaneable (librería `qrcode`, generado en el navegador,
 * sin llamadas de red). Codifica los datos de la papeleta como texto plano:
 * cualquier lector de QR los mostrará. La verificación automática por URL
 * (abrir la papeleta directamente al escanear) llegará con la base de datos.
 */
export default function QrCode({ value, size = 96 }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelado) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelado) setDataUrl(null)
      })
    return () => {
      cancelado = true
    }
  }, [value, size])

  if (!dataUrl) {
    return <div className="qr-preview" style={{ width: size, height: size }} aria-hidden="true" />
  }

  return <img src={dataUrl} alt={`Código QR: ${value}`} width={size} height={size} className="qr-preview" />
}
