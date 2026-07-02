import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/LoginPage";
import { CajaPage } from "@/features/caja/CajaPage";
import { ProductosPage } from "@/features/productos/ProductosPage";
import { VentaPage } from "@/features/ventas/VentaPage";
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
