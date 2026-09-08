import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import SiAlgoPetardea from './components/SiAlgoPetardea'
import { AuthProvider } from './context/AuthContext'
import { vigilar } from './lib/vigilancia'
import './styles/global.css'

/*
 * LA VIGILANCIA SE ENGANCHA ANTES DE PINTAR NADA.
 *
 * Aquí y no dentro de un componente, y antes del `render`: un error AL MONTAR
 * la primera pantalla —que es la clase de error que deja la página en blanco—
 * también tiene que contarse. Enganchado desde dentro de React llegaría tarde
 * justo en el único caso en el que nadie va a poder contarlo a mano.
 *
 * No hace absolutamente nada hasta que algo se rompe, y en modo demostración ni
 * eso. Ver `lib/vigilancia.ts`.
 */
vigilar()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/*
      LA RED VA POR FUERA DE TODO, incluido el proveedor de sesión: si lo que
      revienta es leer la sesión guardada —que es justo uno de los datos que
      pueden estar viejos—, un envoltorio por dentro no llegaría a montarse y
      la pantalla se quedaría en blanco igual.
    */}
    <SiAlgoPetardea>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </SiAlgoPetardea>
  </React.StrictMode>,
)
