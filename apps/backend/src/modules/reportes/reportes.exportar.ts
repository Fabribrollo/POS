import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";

export interface ColumnaExport {
  header: string;
  key: string;
}

export interface ResumenExport {
  label: string;
  valor: string;
}

export function generarExcel(
  nombreHoja: string,
  columnas: ColumnaExport[],
  filas: Record<string, unknown>[],
): Buffer {
  const encabezados = columnas.map((c) => c.header);
  const datos = filas.map((fila) => columnas.map((c) => fila[c.key] ?? ""));
  const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...datos]);
  hoja["!cols"] = columnas.map((c) => ({ wch: Math.max(c.header.length + 2, 14) }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// Tabla simple pero con manejo real de salto de página: no usa ninguna
// librería de tablas (pdfkit no trae una), dibuja encabezado + filas a mano y
// repite el encabezado en cada página nueva.
export function generarPdf(
  titulo: string,
  columnas: ColumnaExport[],
  filas: Record<string, unknown>[],
  resumen: ResumenExport[] = [],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).fillColor("#000").text(titulo);
    doc
      .fontSize(9)
      .fillColor("#666")
      .text(`Generado: ${new Date().toLocaleString("es-AR")}`);
    doc.moveDown(0.5);

    if (resumen.length) {
      doc.fontSize(10).fillColor("#000");
      for (const r of resumen) doc.text(`${r.label}: ${r.valor}`);
      doc.moveDown(0.5);
    }

    const anchoDisponible = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const anchoColumna = anchoDisponible / columnas.length;
    const alturaFila = 20;

    function dibujarFila(valores: string[], y: number, negrita: boolean) {
      doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor("#000");
      valores.forEach((valor, i) => {
        doc.text(valor, doc.page.margins.left + i * anchoColumna, y, {
          width: anchoColumna - 4,
          ellipsis: true,
        });
      });
    }

    function dibujarEncabezado(y: number): number {
      dibujarFila(columnas.map((c) => c.header), y, true);
      const yLinea = y + alturaFila - 4;
      doc
        .moveTo(doc.page.margins.left, yLinea)
        .lineTo(doc.page.width - doc.page.margins.right, yLinea)
        .strokeColor("#ccc")
        .stroke();
      return y + alturaFila;
    }

    let y = dibujarEncabezado(doc.y);

    for (const fila of filas) {
      if (y + alturaFila > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = dibujarEncabezado(doc.page.margins.top);
      }
      dibujarFila(
        columnas.map((c) => String(fila[c.key] ?? "")),
        y,
        false,
      );
      y += alturaFila;
    }

    if (filas.length === 0) {
      doc.fontSize(10).fillColor("#666").text("Sin resultados para el filtro aplicado.", doc.page.margins.left, y + 10);
    }

    doc.end();
  });
}
