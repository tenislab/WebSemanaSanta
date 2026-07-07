import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import AppShell from './components/AppShell'
import DashboardHome from './pages/app/DashboardHome'
import Hermanos from './pages/app/Hermanos'
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
        <Route
          path="cortejo"
          element={
            <ComingSoon
              title="Cortejo"
              phase="Próxima fase"
              description="Tramos, puestos e insignias, asignación por antigüedad, túnicas y enseres, listados con QR."
            />
          }
        />
        <Route
          path="cuotas"
          element={
            <ComingSoon
              title="Cuotas"
              phase="Próxima fase"
              description="Tipos de cuota, generación de recibos, pagos, remesas SEPA, devueltos, fraccionamientos y recordatorios."
            />
          }
        />
        <Route
          path="papeletas"
          element={
            <ComingSoon
              title="Papeletas de sitio"
              phase="Próxima fase"
              description="Solicitud, asignación, pago, código QR, impresión, entrega e histórico de papeletas."
            />
          }
        />
        <Route
          path="tesoreria"
          element={
            <ComingSoon
              title="Tesorería"
              phase="Próxima fase"
              description="Caja e ingresos, gastos, cuentas bancarias, conciliación, presupuesto, facturas y balances."
            />
          }
        />
        <Route
          path="inventario"
          element={
            <ComingSoon
              title="Inventario"
              phase="Próxima fase"
              description="Enseres, orfebrería, textiles, túnicas, ubicación, conservación, préstamos y seguros."
            />
          }
        />
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
        <Route
          path="configuracion"
          element={
            <ComingSoon
              title="Configuración"
              phase="Próxima fase"
              description="Datos de la hermandad, usuarios y roles, personalización, integraciones y copias de seguridad."
            />
          }
        />
      </Route>

      {/* Cualquier ruta desconocida vuelve a la portada */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
