import { useState } from "react";
import { ROLES, type RolNombre } from "@pos/shared";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { extraerMensajeError } from "@/shared/api/client";
import { useAuthStore } from "@/shared/stores/auth.store";
import {
  useActualizarUsuario,
  useCrearUsuario,
  useDesactivarUsuario,
  useUsuarios,
  type Usuario,
} from "./usuarios.api";

const ROLES_LISTA = Object.values(ROLES);

export function UsuariosPage() {
  const { data: usuarios, isLoading } = useUsuarios();
  const usuarioActual = useAuthStore((s) => s.usuario);
  const desactivarUsuario = useDesactivarUsuario();
  const [openNuevo, setOpenNuevo] = useState(false);
  const [usuarioEditar, setUsuarioEditar] = useState<Usuario | null>(null);

  async function handleDesactivar(usuario: Usuario) {
    if (!confirm(`¿Desactivar a "${usuario.nombre}"? No va a poder iniciar sesión.`)) return;
    try {
      await desactivarUsuario.mutateAsync(usuario.id);
      toast.success("Usuario desactivado");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <Dialog open={openNuevo} onOpenChange={setOpenNuevo}>
          <DialogTrigger render={<Button />}>Nuevo usuario</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo usuario</DialogTitle>
            </DialogHeader>
            <FormularioUsuario onDone={() => setOpenNuevo(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último ingreso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Sin usuarios
                </TableCell>
              </TableRow>
            )}
            {usuarios?.map((u) => {
              const esUnoMismo = u.id === usuarioActual?.id;
              return (
                <TableRow
                  key={u.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setUsuarioEditar(u)}
                >
                  <TableCell>{u.nombre}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.rol.nombre}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={u.activo ? "outline" : "destructive"}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </Badge>
                      {u.debeCambiarPassword && (
                        <Badge variant="secondary">Debe cambiar contraseña</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleString("es-AR") : "Nunca"}
                  </TableCell>
                  <TableCell className="text-right">
                    {u.activo && (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={esUnoMismo}
                        title={esUnoMismo ? "No podés desactivar tu propia cuenta" : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDesactivar(u);
                        }}
                      >
                        Desactivar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={usuarioEditar != null} onOpenChange={(v) => !v && setUsuarioEditar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          {usuarioEditar && (
            <FormularioUsuario
              usuario={usuarioEditar}
              esUnoMismo={usuarioEditar.id === usuarioActual?.id}
              onDone={() => setUsuarioEditar(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormularioUsuario({
  usuario,
  esUnoMismo,
  onDone,
}: {
  usuario?: Usuario;
  esUnoMismo?: boolean;
  onDone: () => void;
}) {
  const crearUsuario = useCrearUsuario();
  const actualizarUsuario = useActualizarUsuario();

  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [rol, setRol] = useState<RolNombre>(usuario?.rol.nombre ?? "VENDEDOR");
  const [password, setPassword] = useState("");
  const [activo, setActivo] = useState(usuario?.activo ?? true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (usuario) {
        await actualizarUsuario.mutateAsync({
          id: usuario.id,
          input: {
            nombre,
            rol,
            activo,
            password: password || undefined,
          },
        });
        toast.success(password ? "Usuario actualizado y contraseña reseteada" : "Usuario actualizado");
      } else {
        if (password.length < 6) {
          toast.error("La contraseña debe tener al menos 6 caracteres");
          return;
        }
        await crearUsuario.mutateAsync({ nombre, email, password, rol });
        toast.success("Usuario creado");
      }
      onDone();
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  const guardando = crearUsuario.isPending || actualizarUsuario.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nombre</Label>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!!usuario}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Rol</Label>
        <Select
          value={rol}
          onValueChange={(v) => v && setRol(v as RolNombre)}
        >
          <SelectTrigger disabled={esUnoMismo} title={esUnoMismo ? "No podés cambiar tu propio rol" : undefined}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES_LISTA.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {usuario && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activo}
            disabled={esUnoMismo}
            onChange={(e) => setActivo(e.target.checked)}
          />
          Activo
          {esUnoMismo && <span className="text-muted-foreground">(no podés desactivarte)</span>}
        </label>
      )}
      <div className="space-y-2">
        <Label>{usuario ? "Restablecer contraseña (opcional)" : "Contraseña"}</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={usuario ? "Dejar vacío para no cambiarla" : undefined}
          minLength={6}
          required={!usuario}
        />
        {usuario && password && (
          <p className="text-xs text-muted-foreground">
            Al guardar, se le va a pedir a este usuario que cambie la contraseña en su próximo ingreso.
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={guardando}>
          {usuario ? "Guardar cambios" : "Crear usuario"}
        </Button>
      </div>
    </form>
  );
}
