import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import SiAlgoPetardea from './components/SiAlgoPetardea'
import { AuthProvider } from './context/AuthContext'
import './styles/global.css'

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
