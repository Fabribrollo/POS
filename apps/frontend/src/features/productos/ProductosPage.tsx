import { useState } from "react";
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
import {
  useCategorias,
  useCrearCategoria,
  useCrearMarca,
  useCrearProducto,
  useMarcas,
  useProductos,
} from "./productos.api";

export function ProductosPage() {
  const { data: productos, isLoading } = useProductos();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Productos</h1>
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
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">Venta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos?.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.nombre}</TableCell>
                <TableCell>{p.codigoInterno}</TableCell>
                <TableCell>{p.categoria?.nombre ?? "-"}</TableCell>
                <TableCell>{p.marca?.nombre ?? "-"}</TableCell>
                <TableCell className="text-right">${p.precioCosto}</TableCell>
                <TableCell className="text-right">${p.precioVenta}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function FormularioProducto({ onDone }: { onDone: () => void }) {
  const { data: categorias } = useCategorias();
  const { data: marcas } = useMarcas();
  const crearProducto = useCrearProducto();
  const crearCategoria = useCrearCategoria();
  const crearMarca = useCrearMarca();

  const [form, setForm] = useState({
    nombre: "",
    codigoInterno: "",
    codigoBarras: "",
    precioCosto: "",
    precioVenta: "",
    stockMinimo: "0",
    categoriaId: "",
    marcaId: "",
  });
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [nuevaMarca, setNuevaMarca] = useState("");

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await crearProducto.mutateAsync({
        nombre: form.nombre,
        codigoInterno: form.codigoInterno,
        codigoBarras: form.codigoBarras || undefined,
        precioCosto: Number(form.precioCosto),
        precioVenta: Number(form.precioVenta),
        stockMinimo: Number(form.stockMinimo),
        categoriaId: form.categoriaId ? Number(form.categoriaId) : undefined,
        marcaId: form.marcaId ? Number(form.marcaId) : undefined,
      });
      toast.success("Producto creado");
      onDone();
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  async function handleNuevaCategoria() {
    if (!nuevaCategoria.trim()) return;
    const categoria = await crearCategoria.mutateAsync(nuevaCategoria.trim());
    set("categoriaId", String(categoria.id));
    setNuevaCategoria("");
  }

  async function handleNuevaMarca() {
    if (!nuevaMarca.trim()) return;
    const marca = await crearMarca.mutateAsync(nuevaMarca.trim());
    set("marcaId", String(marca.id));
    setNuevaMarca("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nombre</Label>
        <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Código interno</Label>
          <Input
            value={form.codigoInterno}
            onChange={(e) => set("codigoInterno", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Código de barras</Label>
          <Input
            value={form.codigoBarras}
            onChange={(e) => set("codigoBarras", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Precio costo</Label>
          <Input
            type="number"
            step="0.01"
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
            value={form.precioVenta}
            onChange={(e) => set("precioVenta", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Stock mínimo</Label>
          <Input
            type="number"
            value={form.stockMinimo}
            onChange={(e) => set("stockMinimo", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoría</Label>
          <Select value={form.categoriaId} onValueChange={(v) => set("categoriaId", v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent>
              {categorias?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              placeholder="Nueva categoría"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={handleNuevaCategoria}>
              +
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Marca</Label>
          <Select value={form.marcaId} onValueChange={(v) => set("marcaId", v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Sin marca" />
            </SelectTrigger>
            <SelectContent>
              {marcas?.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              placeholder="Nueva marca"
              value={nuevaMarca}
              onChange={(e) => setNuevaMarca(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={handleNuevaMarca}>
              +
            </Button>
          </div>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={crearProducto.isPending}>
        Guardar
      </Button>
    </form>
  );
}
