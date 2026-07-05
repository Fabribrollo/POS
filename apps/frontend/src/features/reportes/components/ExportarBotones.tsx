import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportarBotones({
  onExportarExcel,
  onExportarPdf,
  exportando,
}: {
  onExportarExcel: () => void;
  onExportarPdf: () => void;
  exportando?: boolean;
}) {
  return (
    <div className="flex gap-2 no-imprimir">
      <Button type="button" variant="outline" size="sm" onClick={onExportarExcel} disabled={exportando}>
        <FileSpreadsheet className="size-4" />
        Excel
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onExportarPdf} disabled={exportando}>
        <FileText className="size-4" />
        PDF
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" />
        Imprimir
      </Button>
    </div>
  );
}
