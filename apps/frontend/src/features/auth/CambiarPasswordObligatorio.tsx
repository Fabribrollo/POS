import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extraerMensajeError } from "@/shared/api/client";
import { useCambiarPassword } from "./auth.api";

// Gate de pantalla completa: se muestra en vez de <Outlet/> cuando el
// usuario tiene debeCambiarPassword=true (el admin recién sembrado, o
// cualquiera al que un administrador le reseteó la contraseña). No hay forma
// de saltearlo — es justamente para no dejar credenciales por defecto sin
// cambiar en una instalación real.
export function CambiarPasswordObligatorio() {
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const cambiarPassword = useCambiarPassword();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (passwordNueva !== passwordConfirmar) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }
    try {
      await cambiarPassword.mutateAsync({ passwordActual, passwordNueva });
      toast.success("Contraseña actualizada");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Cambiá tu contraseña</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Por seguridad, antes de seguir tenés que cambiar la contraseña por defecto por una propia.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passwordActual">Contraseña actual</Label>
              <Input
                id="passwordActual"
                type="password"
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordNueva">Contraseña nueva</Label>
              <Input
                id="passwordNueva"
                type="password"
                minLength={6}
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirmar">Repetir contraseña nueva</Label>
              <Input
                id="passwordConfirmar"
                type="password"
                minLength={6}
                value={passwordConfirmar}
                onChange={(e) => setPasswordConfirmar(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={cambiarPassword.isPending}>
              {cambiarPassword.isPending ? "Guardando..." : "Cambiar contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
