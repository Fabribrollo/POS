import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";

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

export function ReportesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reportes</h1>
      <div className="flex gap-1 overflow-x-auto border-b no-imprimir">
        {TABS.map((tab) => (
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
