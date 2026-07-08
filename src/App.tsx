import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import AppShell from './components/AppShell'
import DashboardHome from './pages/app/DashboardHome'
import Hermanos from './pages/app/Hermanos'
import Cuotas from './pages/app/Cuotas'
import Papeletas from './pages/app/Papeletas'
import Cortejo from './pages/app/Cortejo'
import Tesoreria from './pages/app/Tesoreria'
import Inventario from './pages/app/Inventario'
import Configuracion from './pages/app/Configuracion'
import ComingSoon from './pages/app/ComingSoon'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Signup />} />
      <Route path="/recuperar" element={<ForgotPassword />} />

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
        <Route
          path="archivo"
          element={
            <ComingSoon
              title="Archivo documental"
              phase="Próxima fase"
              description="Actas, reglas, contratos, boletines, expedientes y archivo histórico, con permisos por cargo."
            />
          }
        />
        <Route
          path="comunicados"
          element={
            <ComingSoon
              title="Comunicados"
              phase="Próxima fase"
              description="Email, SMS, WhatsApp y push segmentados, con plantillas, programación y confirmación de lectura."
            />
          }
        />
        <Route
          path="informes"
          element={
            <ComingSoon
              title="Informes"
              phase="Próxima fase"
              description="Informes de hermanos, cuotas, cortejo, papeletas, tesorería e inventario, exportables a PDF o Excel."
            />
          }
        />
        <Route path="configuracion" element={<Configuracion />} />
      </Route>

      {/* Cualquier ruta desconocida vuelve a la portada */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
