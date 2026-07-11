import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import HermanoPortal from './pages/HermanoPortal'
import AppShell from './components/AppShell'
import DashboardHome from './pages/app/DashboardHome'
import Hermanos from './pages/app/Hermanos'
import Cuotas from './pages/app/Cuotas'
import Papeletas from './pages/app/Papeletas'
import Cortejo from './pages/app/Cortejo'
import Tesoreria from './pages/app/Tesoreria'
import Inventario from './pages/app/Inventario'
import Archivo from './pages/app/Archivo'
import Comunicados from './pages/app/Comunicados'
import Informes from './pages/app/Informes'
import Configuracion from './pages/app/Configuracion'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Signup />} />
      <Route path="/recuperar" element={<ForgotPassword />} />
      <Route path="/hermano" element={<HermanoPortal />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="hermanos" element={<Hermanos />} />
        <Route path="cortejo" element={<Cortejo />} />
        <Route path="cuotas" element={<Cuotas />} />
        <Route path="papeletas" element={<Papeletas />} />
        <Route path="tesoreria" element={<Tesoreria />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="archivo" element={<Archivo />} />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="informes" element={<Informes />} />
        <Route path="configuracion" element={<Configuracion />} />
      </Route>

      {/* Cualquier ruta desconocida vuelve a la portada */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
