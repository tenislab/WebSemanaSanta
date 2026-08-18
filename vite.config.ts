import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Sello de la fecha/hora en que se construyó esta versión (se fija al desplegar
  // en Vercel). Se muestra en el pie de la portada para poder verificar, incluso
  // en incógnito, si lo que se ve en línea es la última versión desplegada.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  server: {
    host: true,
    port: 5173,
  },
})
