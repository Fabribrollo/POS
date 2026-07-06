import { formatearMoneda } from "@/lib/utils";
import type { Negocio, VentaCompleta } from "./ventas.api";

// Los precios ya muestran el IVA incluido (como en cualquier vidriera
// argentina): el ticket lo discrimina restando el neto, no lo suma aparte.
const IVA_PORCENTAJE = 21;

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

function escapeHtml(texto: string): string {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function nombreItem(item: VentaCompleta["items"][number]): string {
  return item.variante ? `${item.producto.nombre} (${item.variante.nombre})` : item.producto.nombre;
}

// Abre una ventana angosta (pensada para impresoras térmicas de 80mm, que en
// general se instalan como una impresora más del sistema operativo) con el
// comprobante y dispara el diálogo de impresión del navegador. No es una
// factura electrónica: no hay integración con AFIP/CAE en este sistema
// todavía, así que el ticket lo aclara explícitamente.
export function imprimirTicket(venta: VentaCompleta, negocio: Negocio): void {
  const ventana = window.open("", "_blank", "width=380,height=600");
  if (!ventana) {
    throw new Error("El navegador bloqueó la ventana de impresión. Habilitá los pop-ups e intentá de nuevo.");
  }

  const total = Number(venta.total);
  const neto = redondear(total / (1 + IVA_PORCENTAJE / 100));
  const iva = redondear(total - neto);
  const descuentoTotal = Number(venta.descuentoTotal);

  const filasItems = venta.items
    .map((item) => {
      const cantidad = item.cantidad;
      const precioUnitario = Number(item.precioUnitario);
      const subtotal = Number(item.subtotal);
      return `
        <div class="item">
          <div class="item-nombre">${escapeHtml(nombreItem(item))}</div>
          <div class="item-detalle">
            <span>${cantidad} x $${formatearMoneda(precioUnitario)}</span>
            <span>$${formatearMoneda(subtotal)}</span>
          </div>
        </div>
      `;
    })
    .join("");

  const filasPagos = venta.pagos
    .map((pago) => {
      const monto = Number(pago.monto);
      const recargo = pago.recargo ? Number(pago.recargo) : 0;
      const detalle = [
        pago.cuotas && pago.cuotas > 1 ? `${pago.cuotas} cuotas` : null,
        recargo > 0 ? `+$${formatearMoneda(recargo)} recargo` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `
        <div class="fila">
          <span>${escapeHtml(pago.medioPago.nombre)}${detalle ? ` (${detalle})` : ""}</span>
          <span>$${formatearMoneda(monto)}</span>
        </div>
      `;
    })
    .join("");

  ventana.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Ticket ${escapeHtml(venta.numero)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { font-family: monospace; font-size: 12px; margin: 0; width: 74mm; }
  .centro { text-align: center; }
  .negocio-nombre { font-size: 15px; font-weight: bold; }
  .chico { font-size: 10px; color: #444; }
  .separador { border-top: 1px dashed #000; margin: 6px 0; }
  .fila { display: flex; justify-content: space-between; gap: 8px; }
  .item { margin-bottom: 4px; }
  .item-nombre { font-weight: bold; }
  .item-detalle { display: flex; justify-content: space-between; }
  .total-fila { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; }
  .disclaimer { font-size: 9px; color: #444; text-align: center; margin-top: 8px; }
</style>
</head>
<body>
  <div class="centro">
    <div class="negocio-nombre">${escapeHtml(negocio.nombre)}</div>
    ${negocio.direccion ? `<div class="chico">${escapeHtml(negocio.direccion)}</div>` : ""}
    ${negocio.cuit ? `<div class="chico">CUIT: ${escapeHtml(negocio.cuit)}</div>` : ""}
  </div>

  <div class="separador"></div>

  <div class="fila"><span>Ticket N°</span><span>${escapeHtml(venta.numero)}</span></div>
  <div class="fila"><span>Fecha</span><span>${new Date(venta.createdAt).toLocaleString("es-AR")}</span></div>
  <div class="fila"><span>Cajero</span><span>${escapeHtml(venta.usuario.nombre)}</span></div>
  <div class="fila"><span>Cliente</span><span>${escapeHtml(venta.cliente?.nombre ?? "Consumidor Final")}</span></div>

  <div class="separador"></div>

  ${filasItems}

  <div class="separador"></div>

  <div class="fila"><span>Subtotal</span><span>$${formatearMoneda(Number(venta.subtotal))}</span></div>
  ${descuentoTotal > 0 ? `<div class="fila"><span>Descuento</span><span>-$${formatearMoneda(descuentoTotal)}</span></div>` : ""}
  <div class="total-fila"><span>TOTAL</span><span>$${formatearMoneda(total)}</span></div>
  <div class="fila chico"><span>Importe neto</span><span>$${formatearMoneda(neto)}</span></div>
  <div class="fila chico"><span>IVA (${IVA_PORCENTAJE}%)</span><span>$${formatearMoneda(iva)}</span></div>

  <div class="separador"></div>

  ${filasPagos}

  <div class="separador"></div>

  <div class="centro">¡Gracias por su compra!</div>
  <div class="disclaimer">Comprobante no válido como factura</div>
</body>
</html>`);
  ventana.document.close();
  ventana.onload = () => {
    ventana.focus();
    ventana.print();
  };
}
