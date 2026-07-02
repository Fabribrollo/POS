import { useState } from "react";
import { Link } from "react-router-dom";
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
import { useCarritoStore } from "@/shared/stores/carrito.store";
import { buscarProductoPorCodigo, useCajaAbierta, useCrearVenta } from "./ventas.api";

const MEDIOS_PAGO = ["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA", "MERCADO_PAGO", "QR"] as const;

interface PagoForm {
  medioPago: (typeof MEDIOS_PAGO)[number];
  monto: string;
}

export function VentaPage() {
  const { data: caja, isLoading: cargandoCaja } = useCajaAbierta();
  const { items, agregar, quitar, setCantidad, limpiar } = useCarritoStore();
  const [codigo, setCodigo] = useState("");
  const [descuentoTotal, setDescuentoTotal] = useState("0");
  const [pagos, setPagos] = useState<PagoForm[]>([{ medioPago: "EFECTIVO", monto: "" }]);
  const crearVenta = useCrearVenta();

  const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario - i.descuento, 0);
  const total = Math.max(0, subtotal - Number(descuentoTotal || 0));
  const totalPagos = pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0);

  async function buscarYAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    try {
      const producto = await buscarProductoPorCodigo(codigo.trim());
      agregar({
        productoId: producto.id,
        nombre: producto.nombre,
        precioUnitario: Number(producto.precioVenta),
      });
      setCodigo("");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  function actualizarPago(index: number, cambios: Partial<PagoForm>) {
    setPagos((prev) => prev.map((p, i) => (i === index ? { ...p, ...cambios } : p)));
  }

  async function confirmarVenta() {
    if (items.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    try {
      await crearVenta.mutateAsync({
        items: items.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          descuento: i.descuento,
        })),
        descuentoTotal: Number(descuentoTotal || 0),
        pagos: pagos
          .filter((p) => Number(p.monto) > 0)
          .map((p) => ({ medioPago: p.medioPago, monto: Number(p.monto), recargo: 0 })),
      });
      toast.success("Venta registrada");
      limpiar();
      setDescuentoTotal("0");
      setPagos([{ medioPago: "EFECTIVO", monto: "" }]);
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  if (cargandoCaja) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  if (!caja) {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>No hay una caja abierta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Para vender primero hay que abrir la caja del turno.
          </p>
          <Button render={<Link to="/caja" />}>Ir a caja</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <form onSubmit={buscarYAgregar} className="flex gap-2">
          <Input
            placeholder="Código de barras / SKU / código interno"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoFocus
          />
          <Button type="submit">Agregar</Button>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="w-24">Cantidad</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.productoId}>
                <TableCell>{item.nombre}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    value={item.cantidad}
                    onChange={(e) => setCantidad(item.productoId, Number(e.target.value))}
                    className="w-20"
                  />
                </TableCell>
                <TableCell className="text-right">${item.precioUnitario}</TableCell>
                <TableCell className="text-right">
                  ${(item.cantidad * item.precioUnitario - item.descuento).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => quitar(item.productoId)}>
                    Quitar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  El carrito está vacío
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Cobro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Descuento</span>
              <Input
                type="number"
                className="w-24 text-right"
                value={descuentoTotal}
                onChange={(e) => setDescuentoTotal(e.target.value)}
              />
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pagos</Label>
            {pagos.map((pago, index) => (
              <div key={index} className="flex gap-2">
                <Select
                  value={pago.medioPago}
                  onValueChange={(v) => actualizarPago(index, { medioPago: v as PagoForm["medioPago"] })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIOS_PAGO.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Monto"
                  value={pago.monto}
                  onChange={(e) => actualizarPago(index, { monto: e.target.value })}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPagos((prev) => [...prev, { medioPago: "EFECTIVO", monto: "" }])}
            >
              + Agregar medio de pago
            </Button>
            <p className="text-xs text-muted-foreground">
              Pagado: ${totalPagos.toFixed(2)} / ${total.toFixed(2)}
            </p>
          </div>

          <Button className="w-full" onClick={confirmarVenta} disabled={crearVenta.isPending}>
            Confirmar venta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
