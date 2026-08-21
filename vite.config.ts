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
  build: {
    rollupOptions: {
      output: {
        /*
         * Las bibliotecas van en un trozo aparte de la aplicación.
         *
         * No es por hacer el primer arranque más ligero —la suma es la misma—,
         * es por lo que pasa DESPUÉS. React, el enrutador y el cliente de
         * Supabase no cambian de un despliegue a otro; el código de la
         * hermandad, sí. Juntos en un archivo, cada corrección de una coma
         * obligaba a la secretaria a volver a bajarse los 200 kB de las
         * bibliotecas. Separados, el navegador se queda con los suyos y solo
         * pide lo que ha cambiado de verdad.
         *
         * Y en marzo eso importa: se despliega varias veces al día y hay
         * ochocientas personas entrando desde la calle.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) {
            return 'react'
          }
          if (id.includes('@supabase')) return 'supabase'
          return undefined
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
