import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/LoginPage";
import { CajaPage } from "@/features/caja/CajaPage";
import { CajaReportePage } from "@/features/caja/CajaReportePage";
import { ProductosPage } from "@/features/productos/ProductosPage";
import { CajerosReportePage } from "@/features/reportes/CajerosReportePage";
import { ClientesReportePage } from "@/features/reportes/ClientesReportePage";
import { DashboardPage } from "@/features/reportes/DashboardPage";
import { DevolucionesReportePage } from "@/features/reportes/DevolucionesReportePage";
import { GananciasReportePage } from "@/features/reportes/GananciasReportePage";
import { InventarioReportePage } from "@/features/reportes/InventarioReportePage";
import { MediosPagoReportePage } from "@/features/reportes/MediosPagoReportePage";
import { ProductosReportePage } from "@/features/reportes/ProductosReportePage";
import { ReportesPage } from "@/features/reportes/ReportesPage";
import { VentaPage } from "@/features/ventas/VentaPage";
import { VentasReportePage } from "@/features/ventas/VentasReportePage";
import { AppShell } from "@/shared/layout/AppShell";
import { useAuthStore } from "@/shared/stores/auth.store";

function RutaProtegida({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RutaLogin() {
  const token = useAuthStore((s) => s.token);
  if (token) return <Navigate to="/" replace />;
  return <LoginPage />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<RutaLogin />} />
      <Route
        element={
          <RutaProtegida>
            <AppShell />
          </RutaProtegida>
        }
      >
        <Route index element={<Navigate to="/ventas" replace />} />
        <Route path="/ventas" element={<VentaPage />} />
        <Route path="/productos" element={<ProductosPage />} />
        <Route path="/caja" element={<CajaPage />} />
        <Route path="/reportes" element={<ReportesPage />}>
          <Route index element={<DashboardPage />} />
          <Route path="ventas" element={<VentasReportePage />} />
          <Route path="productos" element={<ProductosReportePage />} />
          <Route path="inventario" element={<InventarioReportePage />} />
          <Route path="clientes" element={<ClientesReportePage />} />
          <Route path="cajeros" element={<CajerosReportePage />} />
          <Route path="caja" element={<CajaReportePage />} />
          <Route path="medios-pago" element={<MediosPagoReportePage />} />
          <Route path="ganancias" element={<GananciasReportePage />} />
          <Route path="devoluciones" element={<DevolucionesReportePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
