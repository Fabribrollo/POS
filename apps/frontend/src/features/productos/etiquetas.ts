import JsBarcode from "jsbarcode";
import { formatearMoneda } from "@/lib/utils";

export interface DatosEtiqueta {
  nombreProducto: string;
  nombreVariante: string;
  codigoBarras: string;
  precioVenta: number;
}

function escapeHtml(texto: string): string {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// El código de barras se renderiza acá (en la ventana principal, con la
// librería ya empaquetada por Vite) como imagen, y a la ventana de
// impresión solo le llega el <img> con el data URL: así la ventana de
// impresión es HTML estático puro, sin depender de que un script termine de
// cargar/ejecutar ahí adentro, y sin pegarle a ningún CDN (esto tiene que
// poder imprimir sin internet).
function generarImagenBarcode(codigo: string): string {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, codigo, {
    format: "EAN13",
    displayValue: true,
    fontSize: 14,
    height: 45,
    margin: 4,
  });
  return canvas.toDataURL("image/png");
}

// Abre una ventana con una etiqueta por variante (nombre, código de barras y
// precio) y dispara el diálogo de impresión del navegador. Cada etiqueta usa
// page-break-after para que cada una salga en su propia página/sticker.
export function imprimirEtiquetas(etiquetas: DatosEtiqueta[]): void {
  const conCodigo = etiquetas.filter((e) => e.codigoBarras);
  if (conCodigo.length === 0) {
    throw new Error("No hay etiquetas para imprimir");
  }

  const ventana = window.open("", "_blank", "width=420,height=600");
  if (!ventana) {
    throw new Error("El navegador bloqueó la ventana de impresión. Habilitá los pop-ups e intentá de nuevo.");
  }

  const html = conCodigo
    .map((e) => {
      const imagen = generarImagenBarcode(e.codigoBarras);
      return `
        <div class="etiqueta">
          <div class="nombre">${escapeHtml(e.nombreProducto)}</div>
          <div class="variante">${escapeHtml(e.nombreVariante)}</div>
          <img src="${imagen}" alt="" />
          <div class="precio">$${formatearMoneda(e.precioVenta)}</div>
        </div>
      `;
    })
    .join("");

  ventana.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Etiquetas</title>
<style>
  @page { size: 50mm 30mm; margin: 2mm; }
  * { box-sizing: border-box; }
  body { font-family: sans-serif; margin: 0; }
  .etiqueta { width: 46mm; padding: 2mm; text-align: center; page-break-after: always; }
  .etiqueta:last-child { page-break-after: auto; }
  .nombre { font-size: 11px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .variante { font-size: 10px; color: #444; }
  img { width: 100%; max-height: 18mm; }
  .precio { font-size: 13px; font-weight: bold; }
</style>
</head>
<body>${html}</body>
</html>`);
  ventana.document.close();
  ventana.onload = () => {
    ventana.focus();
    ventana.print();
  };
}
