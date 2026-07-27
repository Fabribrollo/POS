import {
  Banknote,
  CreditCard,
  Landmark,
  QrCode,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { cn, formatearMoneda } from "@/lib/utils";

export const MEDIOS_PAGO_VENTA = [
  "EFECTIVO",
  "DEBITO",
  "CREDITO",
  "TRANSFERENCIA",
  "MERCADO_PAGO",
  "QR",
] as const;
export type MedioPagoVenta = (typeof MEDIOS_PAGO_VENTA)[number];

export interface PagoVenta {
  medioPago: MedioPagoVenta;
  monto: number;
}

// Billetes en circulación de pesos argentinos, para cargar rápido lo recibido.
const BILLETES = [100, 500, 1000, 2000, 10000, 20000] as const;

// Todas las cards son neutras: el ícono distingue el medio, el color de
// acento (único en toda la app) marca cuál está seleccionado. El color no se
// usa para decorar opciones que no tienen ningún estado distinto entre sí.
const MEDIOS: { valor: MedioPagoVenta; etiqueta: string; icono: LucideIcon }[] = [
  { valor: "EFECTIVO", etiqueta: "Efectivo", icono: Banknote },
  { valor: "DEBITO", etiqueta: "Débito", icono: CreditCard },
  { valor: "CREDITO", etiqueta: "Crédito", icono: CreditCard },
  { valor: "TRANSFERENCIA", etiqueta: "Transferencia", icono: Landmark },
  { valor: "MERCADO_PAGO", etiqueta: "Mercado Pago", icono: Smartphone },
  { valor: "QR", etiqueta: "QR", icono: QrCode },
];

interface PagoForm {
  medioPago: MedioPagoVenta;
  monto: string;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Props {
  abierto: boolean;
  total: number;
  pendiente: boolean;
  onCerrar: () => void;
  onConfirmar: (pagos: PagoVenta[]) => void;
}

export function CobroModal({ abierto, total, pendiente, onCerrar, onConfirmar }: Props) {
  const [medio, setMedio] = useState<MedioPagoVenta>("EFECTIVO");
  const [modoMixto, setModoMixto] = useState(false);
  const [pagos, setPagos] = useState<PagoForm[]>([{ medioPago: "EFECTIVO", monto: "" }]);
  const [recibido, setRecibido] = useState(0);

  // Estado limpio cada vez que se abre el modal: lo normal es un cobro nuevo.
  useEffect(() => {
    if (abierto) {
      setMedio("EFECTIVO");
      setModoMixto(false);
      setPagos([{ medioPago: "EFECTIVO", monto: "" }]);
      setRecibido(0);
    }
  }, [abierto]);

  const totalPagos = pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0);
  const vuelto = redondear(recibido - total);

  function manejarCambioAbierto(v: boolean) {
    // Esc, click afuera o la X no cierran sin preguntar: en medio de un cobro
    // un cierre accidental hace perder lo cargado.
    if (!v && window.confirm("¿Salir del cobro sin confirmar la venta?")) {
      onCerrar();
    }
  }

  function actualizarPago(index: number, cambios: Partial<PagoForm>) {
    setPagos((prev) => prev.map((p, i) => (i === index ? { ...p, ...cambios } : p)));
  }

  // Lo que falta pagar considerando los demás medios ya cargados; nunca
  // negativo, para no poder "rellenar" por encima del total.
  function restantePorPagar(index: number): number {
    const pagadoEnOtros = pagos.reduce(
      (acc, p, i) => (i === index ? acc : acc + Number(p.monto || 0)),
      0,
    );
    return Math.max(0, redondear(total - pagadoEnOtros));
  }

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (modoMixto) {
      onConfirmar(
        pagos
          .filter((p) => Number(p.monto) > 0)
          .map((p) => ({ medioPago: p.medioPago, monto: Number(p.monto) })),
      );
    } else {
      onConfirmar([{ medioPago: medio, monto: total }]);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={manejarCambioAbierto}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cobro</DialogTitle>
        </DialogHeader>

        <form onSubmit={confirmar} className="space-y-4">
          <p className="text-center text-3xl font-bold">${formatearMoneda(total)}</p>

          {!modoMixto && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {MEDIOS.map((m) => (
                  <button
                    key={m.valor}
                    type="button"
                    onClick={() => setMedio(m.valor)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50",
                      medio === m.valor &&
                        "border-primary bg-accent text-accent-foreground",
                    )}
                  >
                    <m.icono className="size-5" />
                    {m.etiqueta}
                  </button>
                ))}
              </div>

              {medio === "EFECTIVO" && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <Label>Billetes recibidos</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {BILLETES.map((b) => (
                      <Button
                        key={b}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRecibido((r) => r + b)}
                      >
                        ${formatearMoneda(b)}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={recibido || ""}
                      placeholder="Recibido"
                      onChange={(e) => setRecibido(Number(e.target.value))}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setRecibido(0)}>
                      Borrar
                    </Button>
                  </div>
                  {recibido > 0 && (
                    <p
                      className={cn(
                        "text-center text-lg font-semibold",
                        vuelto >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {vuelto >= 0
                        ? `Vuelto: $${formatearMoneda(vuelto)}`
                        : `Faltan $${formatearMoneda(-vuelto)}`}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {modoMixto && (
            <div className="space-y-2">
              <Label>Pagos</Label>
              {pagos.map((pago, index) => (
                <div key={index} className="flex gap-2">
                  <Select
                    value={pago.medioPago}
                    onValueChange={(v) =>
                      actualizarPago(index, { medioPago: v as MedioPagoVenta })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEDIOS.map((m) => (
                        <SelectItem key={m.valor} value={m.valor}>
                          {m.etiqueta}
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => actualizarPago(index, { monto: String(restantePorPagar(index)) })}
                  >
                    Resto
                  </Button>
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
                Pagado: ${formatearMoneda(totalPagos)} / ${formatearMoneda(total)}
              </p>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setModoMixto((v) => !v)}
            >
              {modoMixto ? "Volver a pago simple" : "Más de un pago"}
            </Button>
            <Button type="submit" disabled={pendiente}>
              Confirmar venta
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
