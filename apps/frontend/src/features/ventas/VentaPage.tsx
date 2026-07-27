import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatearMoneda } from "@/lib/utils";
import { extraerMensajeError } from "@/shared/api/client";
import { useCarritoStore } from "@/shared/stores/carrito.store";
import type { Producto } from "../productos/productos.api";
import { CobroModal, type PagoVenta } from "./CobroModal";
import { imprimirTicket } from "./ticket";
import { escanearCodigo, useCajaAbierta, useCrearVenta, useNegocio } from "./ventas.api";

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

// Monto de descuento de la línea, a partir del % cargado en el carrito.
function descuentoLinea(item: { cantidad: number; precioUnitario: number; descuentoPorcentaje: number }): number {
  return redondear((item.cantidad * item.precioUnitario * item.descuentoPorcentaje) / 100);
}

export function VentaPage() {
  const { data: caja, isLoading: cargandoCaja } = useCajaAbierta();
  const { items, agregar, quitar, setCantidad, setDescuentoPorcentaje, limpiar } = useCarritoStore();
  const [codigo, setCodigo] = useState("");
  const [cobroAbierto, setCobroAbierto] = useState(false);
  const [productoParaElegir, setProductoParaElegir] = useState<Producto | null>(null);
  const crearVenta = useCrearVenta();
  const { data: negocio } = useNegocio();

  const subtotal = items.reduce(
    (acc, i) => acc + i.cantidad * i.precioUnitario - descuentoLinea(i),
    0,
  );
  const total = subtotal;

  function abrirCobro() {
    if (items.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    setCobroAbierto(true);
  }

  // Dos Enter seguidos (con el campo de escaneo vacío) abren el cobro: el
  // flujo natural es escanear todo y apretar Enter-Enter sin tocar el mouse.
  // El Enter que confirma un escaneo no cuenta porque el campo tiene texto.
  const entersSeguidos = useRef(0);
  const codigoRef = useRef(codigo);
  codigoRef.current = codigo;
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (cobroAbierto || productoParaElegir != null) {
        entersSeguidos.current = 0;
        return;
      }
      if (e.key === "Enter" && codigoRef.current.trim() === "") {
        entersSeguidos.current += 1;
        if (entersSeguidos.current >= 2) {
          entersSeguidos.current = 0;
          abrirCobro();
        }
      } else {
        entersSeguidos.current = 0;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // abrirCobro solo depende de items.length, cubierto acá.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobroAbierto, productoParaElegir, items.length]);

  function agregarAlCarrito(
    producto: Producto,
    varianteId?: number,
    nombreVariante?: string,
    stockDisponible: number = producto.stockTotal,
  ) {
    const existente = items.find((i) => i.productoId === producto.id && i.varianteId === varianteId);
    if ((existente?.cantidad ?? 0) >= stockDisponible) {
      toast.error("No hay más stock disponible de esta variante");
      return;
    }
    agregar({
      productoId: producto.id,
      varianteId,
      nombre: nombreVariante ? `${producto.nombre} (${nombreVariante})` : producto.nombre,
      precioUnitario: Number(producto.precioVenta),
      stockDisponible,
    });
  }

  async function buscarYAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    try {
      const resultado = await escanearCodigo(codigo.trim());
      if (resultado.tipo === "elegir_variante") {
        setProductoParaElegir(resultado.producto);
      } else if (resultado.tipo === "variante") {
        agregarAlCarrito(
          resultado.producto,
          resultado.variante.id,
          resultado.variante.nombre,
          resultado.variante.stock,
        );
      } else {
        agregarAlCarrito(resultado.producto);
      }
      setCodigo("");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  function elegirVariante(varianteId: number, nombreVariante: string, stockDisponible: number) {
    if (!productoParaElegir) return;
    agregarAlCarrito(productoParaElegir, varianteId, nombreVariante, stockDisponible);
    setProductoParaElegir(null);
  }

  async function confirmarVenta(pagos: PagoVenta[]) {
    try {
      const venta = await crearVenta.mutateAsync({
        items: items.map((i) => ({
          productoId: i.productoId,
          varianteId: i.varianteId,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          descuento: descuentoLinea(i),
        })),
        descuentoTotal: 0,
        pagos: pagos.map((p) => ({ medioPago: p.medioPago, monto: p.monto, recargo: 0 })),
      });
      toast.success("Venta registrada");
      limpiar();
      setCobroAbierto(false);
      try {
        imprimirTicket(venta, negocio ?? { nombre: "Comprobante de venta", direccion: "", cuit: "" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo imprimir el ticket");
      }
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
        <h1 className="text-2xl font-semibold">Punto de venta</h1>
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
              <TableHead className="w-24 text-right">Descuento %</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.productoId}-${item.varianteId ?? "sin-variante"}`}>
                <TableCell>
                  {item.nombre}
                  <span className="block text-xs text-muted-foreground">
                    Stock disponible: {item.stockDisponible}
                  </span>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    max={item.stockDisponible}
                    value={item.cantidad}
                    onChange={(e) =>
                      setCantidad(item.productoId, item.varianteId, Number(e.target.value))
                    }
                    className="w-20"
                  />
                </TableCell>
                <TableCell className="text-right">${formatearMoneda(item.precioUnitario)}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={item.descuentoPorcentaje}
                    onChange={(e) =>
                      setDescuentoPorcentaje(
                        item.productoId,
                        item.varianteId,
                        Number(e.target.value),
                      )
                    }
                    className="w-20 text-right"
                  />
                </TableCell>
                <TableCell className="text-right">
                  ${formatearMoneda(item.cantidad * item.precioUnitario - descuentoLinea(item))}
                </TableCell>
                <TableCell>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => quitar(item.productoId, item.varianteId)}
                  >
                    Quitar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
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
              <span>${formatearMoneda(subtotal)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>${formatearMoneda(total)}</span>
            </div>
          </div>

          <Button className="w-full" onClick={abrirCobro}>
            Cobrar
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Enter dos veces para cobrar
          </p>
        </CardContent>
      </Card>

      <CobroModal
        abierto={cobroAbierto}
        total={total}
        pendiente={crearVenta.isPending}
        onCerrar={() => setCobroAbierto(false)}
        onConfirmar={confirmarVenta}
      />

      <Dialog
        open={productoParaElegir != null}
        onOpenChange={(v) => !v && setProductoParaElegir(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elegí la variante de "{productoParaElegir?.nombre}"</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {productoParaElegir?.variantes?.map((v) => (
              <Button
                key={v.id}
                variant="outline"
                className="justify-between"
                disabled={v.stock <= 0}
                onClick={() => elegirVariante(v.id, v.nombre, v.stock)}
              >
                <span>{v.nombre}</span>
                <span className="text-xs text-muted-foreground">Stock: {v.stock}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
