import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { extraerMensajeError } from "@/shared/api/client";
import { ComboboxCreatable } from "./ComboboxCreatable";
import {
  descargarPlantillaProductos,
  useActualizarProducto,
  useCategorias,
  useCrearCategoria,
  useCrearMarca,
  useCrearProducto,
  useDesactivarProducto,
  useImportarProductos,
  useMarcas,
  useProductos,
  type Producto,
} from "./productos.api";

export function ProductosPage() {
  const { data: productos, isLoading } = useProductos();
  const [open, setOpen] = useState(false);
  const [productoEditar, setProductoEditar] = useState<Producto | null>(null);
  const desactivarProducto = useDesactivarProducto();
  const importarProductos = useImportarProductos();
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  async function handleEliminar(producto: Producto) {
    if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return;
    try {
      await desactivarProducto.mutateAsync(producto.id);
      toast.success("Producto eliminado");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    try {
      const contenido = await archivo.text();
      const resultado = await importarProductos.mutateAsync(contenido);
      toast.success(
        `Importación completa: ${resultado.productosCreados} productos, ${resultado.variantesCreadas} variantes` +
          (resultado.errores.length ? `, ${resultado.errores.length} filas con error` : ""),
      );
      if (resultado.errores.length) {
        resultado.errores
          .slice(0, 5)
          .forEach((err) => toast.error(`Fila ${err.fila}: ${err.motivo}`));
      }
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => descargarPlantillaProductos()}>
            Descargar plantilla
          </Button>
          <input
            ref={inputArchivoRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportar}
          />
          <Button variant="outline" onClick={() => inputArchivoRef.current?.click()}>
            Importar CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>Nuevo producto</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo producto</DialogTitle>
              </DialogHeader>
              <FormularioProducto onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Código interno</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">Venta</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos?.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.nombre}</TableCell>
                <TableCell>{p.codigoInterno}</TableCell>
                <TableCell>{p.categoria?.nombre ?? "-"}</TableCell>
                <TableCell>{p.marca?.nombre ?? "-"}</TableCell>
                <TableCell className="text-right">{p.stockMinimo}</TableCell>
                <TableCell className="text-right">${p.precioCosto}</TableCell>
                <TableCell className="text-right">${p.precioVenta}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setProductoEditar(p)}>
                      Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleEliminar(p)}>
                      Eliminar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={productoEditar != null} onOpenChange={(v) => !v && setProductoEditar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
          </DialogHeader>
          {productoEditar && (
            <FormularioProducto
              producto={productoEditar}
              onDone={() => setProductoEditar(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormularioProducto({
  producto,
  onDone,
}: {
  producto?: Producto;
  onDone: () => void;
}) {
  const { data: categorias } = useCategorias();
  const { data: marcas } = useMarcas();
  const crearProducto = useCrearProducto();
  const actualizarProducto = useActualizarProducto();
  const crearCategoria = useCrearCategoria();
  const crearMarca = useCrearMarca();

  const [form, setForm] = useState({
    nombre: producto?.nombre ?? "",
    precioCosto: producto?.precioCosto ?? "",
    precioVenta: producto?.precioVenta ?? "",
    stockMinimo: String(producto?.stockMinimo ?? 0),
    categoriaId: producto?.categoria ? String(producto.categoria.id) : "",
    marcaId: producto?.marca ? String(producto.marca.id) : "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const datos = {
      nombre: form.nombre,
      precioCosto: Number(form.precioCosto),
      precioVenta: Number(form.precioVenta),
      stockMinimo: Number(form.stockMinimo),
      categoriaId: form.categoriaId ? Number(form.categoriaId) : undefined,
      marcaId: form.marcaId ? Number(form.marcaId) : undefined,
    };
    try {
      if (producto) {
        await actualizarProducto.mutateAsync({ id: producto.id, input: datos });
        toast.success("Producto actualizado");
      } else {
        await crearProducto.mutateAsync(datos);
        toast.success("Producto creado");
      }
      onDone();
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  const guardando = crearProducto.isPending || actualizarProducto.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nombre</Label>
        <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Precio costo</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={form.precioCosto}
            onChange={(e) => set("precioCosto", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Precio venta</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={form.precioVenta}
            onChange={(e) => set("precioVenta", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Stock</Label>
          <Input
            type="number"
            min={0}
            value={form.stockMinimo}
            onChange={(e) => set("stockMinimo", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoría</Label>
          <ComboboxCreatable
            value={form.categoriaId}
            onChange={(id) => set("categoriaId", id)}
            opciones={categorias ?? []}
            onCrear={(nombre) => crearCategoria.mutateAsync(nombre)}
            placeholder="Escribí o creá una categoría"
          />
        </div>
        <div className="space-y-2">
          <Label>Marca</Label>
          <ComboboxCreatable
            value={form.marcaId}
            onChange={(id) => set("marcaId", id)}
            opciones={marcas ?? []}
            onCrear={(nombre) => crearMarca.mutateAsync(nombre)}
            placeholder="Escribí o creá una marca"
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={guardando}>
        Guardar
      </Button>
    </form>
  );
}
