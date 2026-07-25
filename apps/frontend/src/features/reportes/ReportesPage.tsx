import { tienePermiso } from "@pos/shared";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/shared/stores/auth.store";

const TABS = [
  { to: "/reportes", label: "Dashboard", end: true },
  { to: "/reportes/ventas", label: "Ventas", end: false },
  { to: "/reportes/productos", label: "Productos", end: false },
  { to: "/reportes/inventario", label: "Inventario", end: false },
  { to: "/reportes/clientes", label: "Clientes", end: false },
  { to: "/reportes/cajeros", label: "Cajeros", end: false },
  { to: "/reportes/caja", label: "Caja", end: false },
  { to: "/reportes/medios-pago", label: "Métodos de pago", end: false },
  { to: "/reportes/ganancias", label: "Ganancias", end: false },
  { to: "/reportes/devoluciones", label: "Devoluciones", end: false },
];

// La auditoría es deliberadamente más restrictiva que el resto de Reportes:
// puede incluir acciones del propio Encargado, así que solo se muestra a
// quien tenga el permiso AUDITORIA_VER (exclusivo de ADMINISTRADOR).
const TAB_AUDITORIA = { to: "/reportes/auditoria", label: "Auditoría", end: false };

export function ReportesPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const tabs = usuario && tienePermiso(usuario.rol, "AUDITORIA_VER") ? [...TABS, TAB_AUDITORIA] : TABS;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reportes</h1>
      <div className="flex gap-1 overflow-x-auto border-b no-imprimir">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap",
                isActive
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
