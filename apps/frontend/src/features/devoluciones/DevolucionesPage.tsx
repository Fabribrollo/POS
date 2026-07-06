import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { formatearMoneda } from "@/lib/utils";
import { extraerMensajeError } from "@/shared/api/client";
import { useCrearCliente } from "../clientes/clientes.api";
import type { Producto } from "../productos/productos.api";
import { escanearCodigo, useCrearVenta, useNegocio } from "../ventas/ventas.api";
import { imprimirTicket } from "../ventas/ticket";
import { buscarVentaParaDevolucion, useCrearDevolucion, type VentaParaDevolucion } from "./devoluciones.api";

const MEDIOS_PAGO_DIFERENCIA = ["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA", "MERCADO_PAGO", "QR"] as const;

interface ItemCarritoNuevo {
  productoId: number;
  varianteId?: number;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  stockDisponible: number;
}

export function DevolucionesPage() {
  const [searchParams] = useSearchParams();
  const [numero, setNumero] = useState(searchParams.get("numero") ?? "");
  const [venta, setVenta] = useState<VentaParaDevolucion | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [clienteNuevoNombre, setClienteNuevoNombre] = useState("");
  const [clienteNuevoDocumento, setClienteNuevoDocumento] = useState("");
  const [creditoGenerado, setCreditoGenerado] = useState<number | null>(null);
  const [clienteIdUsado, setClienteIdUsado] = useState<number | null>(null);
  const [codigoCanje, setCodigoCanje] = useState("");
  const [carritoNuevo, setCarritoNuevo] = useState<ItemCarritoNuevo[]>([]);
  const [productoParaElegir, setProductoParaElegir] = useState<Producto | null>(null);
  const [medioPagoDiferencia, setMedioPagoDiferencia] =
    useState<(typeof MEDIOS_PAGO_DIFERENCIA)[number]>("EFECTIVO");

  const crearCliente = useCrearCliente();
  const crearDevolucion = useCrearDevolucion();
  const crearVenta = useCrearVenta();
  const { data: negocio } = useNegocio();

  async function ejecutarBusqueda(num: string) {
    if (!num.trim()) return;
    setBuscando(true);
    try {
      const resultado = await buscarVentaParaDevolucion(num.trim());
      setVenta(resultado);
      setCantidades({});
      setCreditoGenerado(null);
      setClienteIdUsado(null);
      setCarritoNuevo([]);
      setClienteNuevoNombre("");
      setClienteNuevoDocumento("");
    } catch (err) {
      toast.error(extraerMensajeError(err));
      setVenta(null);
    } finally {
      setBuscando(false);
    }
  }

  function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    void ejecutarBusqueda(numero);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const numeroInicial = searchParams.get("numero");
    if (numeroInicial) void ejecutarBusqueda(numeroInicial);
  }, []);

  function toggleItem(itemVentaId: number, cantidadDisponible: number) {
    setCantidades((prev) => ({
      ...prev,
      [itemVentaId]: prev[itemVentaId] > 0 ? 0 : cantidadDisponible,
    }));
  }

  function cambiarCantidad(itemVentaId: number, valor: number, cantidadDisponible: number) {
    const clamp = Math.max(0, Math.min(cantidadDisponible, valor));
    setCantidades((prev) => ({ ...prev, [itemVentaId]: clamp }));
  }

  async function generarCredito() {
    if (!venta) return;
    const items = Object.entries(cantidades)
      .map(([itemVentaId, cantidad]) => ({ itemVentaId: Number(itemVentaId), cantidad }))
      .filter((i) => i.cantidad > 0);
    if (items.length === 0) {
      toast.error("Elegí al menos un producto para devolver");
      return;
    }

    try {
      let clienteId = venta.clienteId ?? undefined;
      if (!clienteId) {
        if (!clienteNuevoNombre.trim()) {
          toast.error("Esta venta no tiene cliente: ingresá un nombre para crearlo");
          return;
        }
        const cliente = await crearCliente.mutateAsync({
          nombre: clienteNuevoNombre.trim(),
          documento: clienteNuevoDocumento.trim() || undefined,
        });
        clienteId = cliente.id;
      }

      const devolucion = await crearDevolucion.mutateAsync({
        ventaOriginalId: venta.id,
        tipo: "NOTA_CREDITO",
        montoReintegro: 0, // se recalcula server-side a partir del precio real de los ítems
        clienteId,
        items,
      });

      const monto = Number(devolucion.montoReintegro);
      setCreditoGenerado(monto);
      setClienteIdUsado(clienteId);
      toast.success(`Se generó un crédito de $${formatearMoneda(monto)}`);
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  function agregarAlCarrito(producto: Producto, varianteId?: number, nombreVariante?: string, stockDisponible: number = producto.stockTotal) {
    setCarritoNuevo((prev) => {
      const existente = prev.find((i) => i.productoId === producto.id && i.varianteId === varianteId);
      if (existente) {
        if (existente.cantidad >= stockDisponible) {
          toast.error("No hay más stock disponible de esta variante");
          return prev;
        }
        return prev.map((i) =>
          i === existente ? { ...i, cantidad: i.cantidad + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          productoId: producto.id,
          varianteId,
          nombre: nombreVariante ? `${producto.nombre} (${nombreVariante})` : producto.nombre,
          precioUnitario: Number(producto.precioVenta),
          cantidad: 1,
          stockDisponible,
        },
      ];
    });
  }

  async function buscarYAgregarCanje(e: React.FormEvent) {
    e.preventDefault();
    if (!codigoCanje.trim()) return;
    try {
      const resultado = await escanearCodigo(codigoCanje.trim());
      if (resultado.tipo === "elegir_variante") {
        setProductoParaElegir(resultado.producto);
      } else if (resultado.tipo === "variante") {
        agregarAlCarrito(resultado.producto, resultado.variante.id, resultado.variante.nombre, resultado.variante.stock);
      } else {
        agregarAlCarrito(resultado.producto);
      }
      setCodigoCanje("");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  function elegirVariante(varianteId: number, nombreVariante: string, stockDisponible: number) {
    if (!productoParaElegir) return;
    agregarAlCarrito(productoParaElegir, varianteId, nombreVariante, stockDisponible);
    setProductoParaElegir(null);
  }

  function quitarDelCarrito(productoId: number, varianteId?: number) {
    setCarritoNuevo((prev) => prev.filter((i) => !(i.productoId === productoId && i.varianteId === varianteId)));
  }

  const totalCarritoNuevo = carritoNuevo.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);
  const montoSaldoAplicado = Math.min(creditoGenerado ?? 0, totalCarritoNuevo);
  const diferencia = Math.max(0, totalCarritoNuevo - (creditoGenerado ?? 0));
  const sobrante = Math.max(0, (creditoGenerado ?? 0) - totalCarritoNuevo);

  async function confirmarCanje() {
    if (!clienteIdUsado || carritoNuevo.length === 0) return;
    try {
      const pagos = [
        ...(montoSaldoAplicado > 0
          ? [{ medioPago: "SALDO_A_FAVOR" as const, monto: montoSaldoAplicado, recargo: 0 }]
          : []),
        ...(diferencia > 0 ? [{ medioPago: medioPagoDiferencia, monto: diferencia, recargo: 0 }] : []),
      ];
      const ventaNueva = await crearVenta.mutateAsync({
        clienteId: clienteIdUsado,
        items: carritoNuevo.map((i) => ({
          productoId: i.productoId,
          varianteId: i.varianteId,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          descuento: 0,
        })),
        descuentoTotal: 0,
        pagos,
      });
      toast.success(`Venta ${ventaNueva.numero} generada con el canje`);
      try {
        imprimirTicket(ventaNueva, negocio ?? { nombre: "Comprobante de venta", direccion: "", cuit: "" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo imprimir el ticket");
      }
      reiniciar();
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  function reiniciar() {
    setNumero("");
    setVenta(null);
    setCantidades({});
    setCreditoGenerado(null);
    setClienteIdUsado(null);
    setCarritoNuevo([]);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Devoluciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={buscar} className="flex gap-2">
            <Input
              placeholder="Número de venta (ej: 00000123)"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              autoFocus
            />
            <Button type="submit" disabled={buscando}>
              Buscar
            </Button>
          </form>

          {venta && creditoGenerado === null && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Venta <span className="font-medium text-foreground">{venta.numero}</span> · Total $
                {formatearMoneda(venta.total)} ·{" "}
                {venta.cliente ? `Cliente: ${venta.cliente.nombre}` : "Sin cliente asociado"}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Comprado</TableHead>
                    <TableHead className="text-right">Ya devuelto</TableHead>
                    <TableHead className="w-28 text-right">Cantidad a devolver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venta.items.map((item) => (
                    <TableRow key={item.itemVentaId}>
                      <TableCell>
                        <input
                          type="checkbox"
                          disabled={item.cantidadDisponible === 0}
                          checked={(cantidades[item.itemVentaId] ?? 0) > 0}
                          onChange={() => toggleItem(item.itemVentaId, item.cantidadDisponible)}
                        />
                      </TableCell>
                      <TableCell>
                        {item.nombre}
                        {item.cantidadDisponible === 0 && (
                          <Badge variant="outline" className="ml-2">
                            Totalmente devuelto
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{item.cantidad}</TableCell>
                      <TableCell className="text-right">{item.cantidadDevuelta}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={item.cantidadDisponible}
                          disabled={item.cantidadDisponible === 0}
                          value={cantidades[item.itemVentaId] ?? 0}
                          onChange={(e) =>
                            cambiarCantidad(item.itemVentaId, Number(e.target.value), item.cantidadDisponible)
                          }
                          className="w-20 text-right"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!venta.cliente && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">
                    Esta venta no tiene un cliente asociado. Para generar el crédito hay que crear uno.
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label>Nombre</Label>
                      <Input value={clienteNuevoNombre} onChange={(e) => setClienteNuevoNombre(e.target.value)} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label>Documento (opcional)</Label>
                      <Input value={clienteNuevoDocumento} onChange={(e) => setClienteNuevoDocumento(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={generarCredito} disabled={crearDevolucion.isPending || crearCliente.isPending}>
                Generar crédito
              </Button>
            </div>
          )}

          {creditoGenerado !== null && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                Crédito a favor del cliente: <span className="font-semibold">${formatearMoneda(creditoGenerado)}</span>
              </div>

              <form onSubmit={buscarYAgregarCanje} className="flex gap-2">
                <Input
                  placeholder="Código de barras / SKU del producto que se lleva"
                  value={codigoCanje}
                  onChange={(e) => setCodigoCanje(e.target.value)}
                />
                <Button type="submit">Agregar</Button>
              </form>

              {carritoNuevo.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carritoNuevo.map((item) => (
                      <TableRow key={`${item.productoId}-${item.varianteId ?? "sin-variante"}`}>
                        <TableCell>{item.nombre}</TableCell>
                        <TableCell className="text-right">{item.cantidad}</TableCell>
                        <TableCell className="text-right">${formatearMoneda(item.precioUnitario)}</TableCell>
                        <TableCell className="text-right">
                          ${formatearMoneda(item.cantidad * item.precioUnitario)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => quitarDelCarrito(item.productoId, item.varianteId)}>
                            Quitar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total del canje</span>
                  <span>${formatearMoneda(totalCarritoNuevo)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cubierto con saldo a favor</span>
                  <span>${formatearMoneda(montoSaldoAplicado)}</span>
                </div>
                {diferencia > 0 && (
                  <div className="flex items-center justify-between gap-2 font-semibold">
                    <span>Diferencia a pagar</span>
                    <div className="flex items-center gap-2">
                      <Select value={medioPagoDiferencia} onValueChange={(v) => v && setMedioPagoDiferencia(v as (typeof MEDIOS_PAGO_DIFERENCIA)[number])}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEDIOS_PAGO_DIFERENCIA.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span>${formatearMoneda(diferencia)}</span>
                    </div>
                  </div>
                )}
                {diferencia === 0 && sobrante > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Queda como saldo a favor para otra compra</span>
                    <span>${formatearMoneda(sobrante)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {carritoNuevo.length > 0 && (
                  <Button onClick={confirmarCanje} disabled={crearVenta.isPending}>
                    Confirmar canje
                  </Button>
                )}
                <Button variant="outline" onClick={reiniciar}>
                  {carritoNuevo.length > 0 ? "Cancelar" : "Listo, sin llevar productos ahora"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={productoParaElegir != null} onOpenChange={(v) => !v && setProductoParaElegir(null)}>
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
