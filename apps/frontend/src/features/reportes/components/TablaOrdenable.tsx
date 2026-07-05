import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ColumnaTabla<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  ordenable?: boolean;
  render: (fila: T) => React.ReactNode;
}

interface TablaOrdenableProps<T> {
  columnas: ColumnaTabla<T>[];
  filas: T[];
  claveFila: (fila: T) => string | number;
  orden?: { columna?: string; direccion: "asc" | "desc" };
  onOrdenar?: (columna: string) => void;
  paginacion?: {
    pagina: number;
    totalPaginas: number;
    onCambiarPagina: (pagina: number) => void;
  };
  busqueda?: {
    valor: string;
    onCambiar: (valor: string) => void;
    placeholder?: string;
  };
}

// Tabla genérica pensada para reportes con orden y paginación resueltos en
// el servidor: no ordena ni pagina nada por su cuenta, solo dispara los
// callbacks — quien la usa mantiene el estado y vuelve a pedir los datos.
export function TablaOrdenable<T>({
  columnas,
  filas,
  claveFila,
  orden,
  onOrdenar,
  paginacion,
  busqueda,
}: TablaOrdenableProps<T>) {
  return (
    <div className="space-y-3">
      {busqueda && (
        <Input
          placeholder={busqueda.placeholder ?? "Buscar..."}
          value={busqueda.valor}
          onChange={(e) => busqueda.onCambiar(e.target.value)}
          className="max-w-xs"
        />
      )}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columnas.map((col) => {
                const esOrdenable = col.ordenable !== false && !!onOrdenar;
                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      col.align === "right" && "text-right",
                      esOrdenable && "cursor-pointer select-none hover:text-foreground",
                    )}
                    onClick={() => esOrdenable && onOrdenar?.(col.key)}
                  >
                    {col.header}
                    {orden?.columna === col.key && (
                      <span className="ml-1">{orden.direccion === "asc" ? "▲" : "▼"}</span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((fila) => (
              <TableRow key={claveFila(fila)}>
                {columnas.map((col) => (
                  <TableCell key={col.key} className={col.align === "right" ? "text-right" : undefined}>
                    {col.render(fila)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnas.length} className="text-center text-sm text-muted-foreground">
                  Sin resultados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {paginacion && paginacion.totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm no-imprimir">
          <span className="text-muted-foreground">
            Página {paginacion.pagina} de {paginacion.totalPaginas}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={paginacion.pagina <= 1}
              onClick={() => paginacion.onCambiarPagina(paginacion.pagina - 1)}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={paginacion.pagina >= paginacion.totalPaginas}
              onClick={() => paginacion.onCambiarPagina(paginacion.pagina + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
