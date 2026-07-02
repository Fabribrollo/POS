import { tienePermiso } from "@pos/shared";
import { LogOut, LayoutGrid, Package, ShoppingCart, Wallet } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/shared/stores/auth.store";

const links = [
  { to: "/ventas", label: "Punto de venta", icon: ShoppingCart, permiso: "VENTAS_CREAR" as const },
  { to: "/productos", label: "Productos", icon: Package, permiso: "PRODUCTOS_LEER" as const },
  { to: "/caja", label: "Caja", icon: Wallet, permiso: "CAJA_ABRIR_CERRAR" as const },
  { to: "/reportes", label: "Reportes", icon: LayoutGrid, permiso: "REPORTES_VER" as const },
];

export function AppShell() {
  const usuario = useAuthStore((s) => s.usuario);
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);

  if (!usuario) return null;

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar p-4">
        <div className="mb-6 px-2">
          <p className="text-sm font-semibold text-sidebar-foreground">POS Indumentaria</p>
          <p className="text-xs text-muted-foreground">
            {usuario.nombre} · {usuario.rol}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {links
            .filter((link) => tienePermiso(usuario.rol, link.permiso))
            .map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`
                }
              >
                <link.icon className="size-4" />
                {link.label}
              </NavLink>
            ))}
        </nav>
        <Button variant="ghost" className="justify-start gap-2" onClick={cerrarSesion}>
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
