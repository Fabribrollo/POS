import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  useAbrirCaja,
  useCajaAbierta,
  useCerrarCaja,
  useMovimientosCaja,
  useRegistrarMovimiento,
} from "./caja.api";

export function CajaPage() {
  const { data: caja, isLoading } = useCajaAbierta();

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Caja</h1>
      {caja ? <CajaAbierta cajaId={caja.id} montoApertura={caja.montoApertura} /> : <AbrirCajaForm />}
    </div>
  );
}

function AbrirCajaForm() {
  const [monto, setMonto] = useState("");
  const abrirCaja = useAbrirCaja();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await abrirCaja.mutateAsync({ montoApertura: Number(monto) });
      toast.success("Caja abierta");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Abrir caja</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label>Monto de apertura</Label>
            <Input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={abrirCaja.isPending}>
            Abrir
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CajaAbierta({ cajaId, montoApertura }: { cajaId: number; montoApertura: string }) {
  const { data: movimientos } = useMovimientosCaja(cajaId);
  const registrarMovimiento = useRegistrarMovimiento();
  const cerrarCaja = useCerrarCaja();

  const [tipo, setTipo] = useState<"INGRESO" | "EGRESO">("INGRESO");
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [montoCierre, setMontoCierre] = useState("");
  const [cierreResultado, setCierreResultado] = useState<{
    montoCierreSistema: string;
    diferencia: string;
  } | null>(null);

  async function handleMovimiento(e: React.FormEvent) {
    e.preventDefault();
    try {
      await registrarMovimiento.mutateAsync({
        tipo,
        monto: Number(monto),
        concepto,
      });
      toast.success("Movimiento registrado");
      setMonto("");
      setConcepto("");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  async function handleCerrar(e: React.FormEvent) {
    e.preventDefault();
    try {
      const resultado = await cerrarCaja.mutateAsync({ montoCierreDeclarado: Number(montoCierre) });
      setCierreResultado(resultado);
      toast.success("Caja cerrada");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  if (cierreResultado) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Caja cerrada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Monto según sistema: ${cierreResultado.montoCierreSistema}</p>
          <p>Diferencia: ${cierreResultado.diferencia}</p>
          <p className="text-muted-foreground">Podés abrir una nueva caja cuando quieras.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Caja abierta — apertura ${montoApertura}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos?.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.tipo}</TableCell>
                  <TableCell>{m.concepto}</TableCell>
                  <TableCell className="text-right">${m.monto}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrar movimiento manual</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleMovimiento} className="flex items-end gap-2">
            <Select value={tipo} onValueChange={(v) => setTipo(v as "INGRESO" | "EGRESO")}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INGRESO">Ingreso</SelectItem>
                <SelectItem value="EGRESO">Egreso</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              required
            />
            <Input
              type="number"
              placeholder="Monto"
              className="w-28"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
            <Button type="submit" disabled={registrarMovimiento.isPending}>
              Registrar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cerrar caja (arqueo)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCerrar} className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label>Monto contado físicamente</Label>
              <Input
                type="number"
                value={montoCierre}
                onChange={(e) => setMontoCierre(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="destructive" disabled={cerrarCaja.isPending}>
              Cerrar caja
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
