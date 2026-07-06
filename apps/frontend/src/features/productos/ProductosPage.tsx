import { useMemo, useRef, useState } from "react";
import { Layers, type LucideIcon, Package, Plus, Printer, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { formatearMoneda } from "@/lib/utils";
import { extraerMensajeError } from "@/shared/api/client";
import { ComboboxCreatable } from "./ComboboxCreatable";
import { imprimirEtiquetas } from "./etiquetas";
import {
  descargarPlantillaProductos,
  useActualizarProducto,
  useActualizarVariante,
  useCategorias,
  useCrearCategoria,
  useCrearMarca,
  useCrearProducto,
  useCrearVariante,
  useDesactivarProducto,
  useDesactivarVariante,
  useImportarProductos,
  useMarcas,
  useProductos,
  useReactivarProducto,
  useVariantes,
  type EstadoProducto,
  type Producto,
  type Variante,
} from "./productos.api";

type ColumnaOrden = "nombre" | "codigoInterno" | "categoria" | "marca" | "stockTotal" | "precioCosto" | "precioVenta";

function EncabezadoOrdenable({
  columna,
  orden,
  onClick,
  className,
  children,
}: {
  columna: ColumnaOrden;
  orden: { columna: ColumnaOrden; direccion: "asc" | "desc" } | null;
  onClick: (columna: ColumnaOrden) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const activa = orden?.columna === columna;
  return (
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground ${className ?? ""}`}
      onClick={() => onClick(columna)}
    >
      {children}
      {activa && <span className="ml-1">{orden.direccion === "asc" ? "▲" : "▼"}</span>}
    </TableHead>
  );
}

function valorOrden(p: Producto, columna: ColumnaOrden): string | number {
  switch (columna) {
    case "nombre":
      return p.nombre;
    case "codigoInterno":
      return p.codigoInterno;
    case "categoria":
      return p.categoria?.nombre ?? "";
    case "marca":
      return p.marca?.nombre ?? "";
    case "stockTotal":
      return p.stockTotal;
    case "precioCosto":
      return Number(p.precioCosto);
    case "precioVenta":
      return Number(p.precioVenta);
  }
}

// Cada bloque del modal de producto (datos / variantes) se envuelve igual:
// ícono + título a la izquierda, acción principal a la derecha si hay una.
function SeccionModal({
  icono: Icono,
  titulo,
  acciones,
  children,
}: {
  icono: LucideIcon;
  titulo: string;
  acciones?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icono className="size-4 text-muted-foreground" />
          {titulo}
        </div>
        {acciones}
      </div>
      {children}
    </section>
  );
}

export function ProductosPage() {
  const [estado, setEstado] = useState<EstadoProducto>("activos");
  const { data: productos, isLoading } = useProductos(estado);
  const { data: categorias } = useCategorias();
  const { data: marcas } = useMarcas();
  const [open, setOpen] = useState(false);
  const [productoEditar, setProductoEditar] = useState<Producto | null>(null);
  const [orden, setOrden] = useState<{ columna: ColumnaOrden; direccion: "asc" | "desc" } | null>(
    null,
  );
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoriaId, setFiltroCategoriaId] = useState("");
  const [filtroMarcaId, setFiltroMarcaId] = useState("");
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const desactivarProducto = useDesactivarProducto();
  const reactivarProducto = useReactivarProducto();
  const importarProductos = useImportarProductos();
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  function ordenarPor(columna: ColumnaOrden) {
    setOrden((actual) => {
      if (actual?.columna !== columna) return { columna, direccion: "asc" };
      return { columna, direccion: actual.direccion === "asc" ? "desc" : "asc" };
    });
  }

  // Búsqueda y filtros son client-side (la lista completa ya está en
  // memoria); solo el estado activo/inactivo requiere volver a pedirle al
  // backend, porque por defecto ni siquiera trae los inactivos.
  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (productos ?? []).filter((p) => {
      if (filtroCategoriaId && String(p.categoria?.id ?? "") !== filtroCategoriaId) return false;
      if (filtroMarcaId && String(p.marca?.id ?? "") !== filtroMarcaId) return false;
      if (soloStockBajo && p.stockTotal > p.stockMinimo) return false;
      if (q) {
        const coincide =
          p.nombre.toLowerCase().includes(q) ||
          (p.marca?.nombre.toLowerCase().includes(q) ?? false) ||
          (p.categoria?.nombre.toLowerCase().includes(q) ?? false);
        if (!coincide) return false;
      }
      return true;
    });
  }, [productos, busqueda, filtroCategoriaId, filtroMarcaId, soloStockBajo]);

  const productosOrdenados = orden
    ? [...productosFiltrados].sort((a, b) => {
        const va = valorOrden(a, orden.columna);
        const vb = valorOrden(b, orden.columna);
        const comparacion =
          typeof va === "number" && typeof vb === "number"
            ? va - vb
            : String(va).localeCompare(String(vb), "es", { sensitivity: "base" });
        return orden.direccion === "asc" ? comparacion : -comparacion;
      })
    : productosFiltrados;

  async function handleEliminar(producto: Producto) {
    if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return;
    try {
      await desactivarProducto.mutateAsync(producto.id);
      toast.success("Producto eliminado");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  async function handleReactivar(producto: Producto) {
    try {
      await reactivarProducto.mutateAsync(producto.id);
      toast.success("Producto reactivado");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    try {
      const resultado = await importarProductos.mutateAsync(archivo);
      if (!resultado.importado) {
        toast.error(`No se importó nada: ${resultado.errores.length} error(es) encontrados`);
      } else {
        toast.success(
          `Importación completa: ${resultado.productosNuevos} productos, ${resultado.variantesNuevas} variantes`,
        );
      }
      resultado.errores
        .slice(0, 5)
        .forEach((err) => toast.error(`${err.hoja} · fila ${err.fila}: ${err.motivo}`));
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
            accept=".xlsx"
            className="hidden"
            onChange={handleImportar}
          />
          <Button variant="outline" onClick={() => inputArchivoRef.current?.click()}>
            Importar Excel
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Buscar</Label>
          <Input
            placeholder="Nombre, marca o categoría"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Categoría</Label>
          <Select
            value={filtroCategoriaId || "todas"}
            onValueChange={(v) => setFiltroCategoriaId(v === "todas" || !v ? "" : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {categorias?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Marca</Label>
          <Select
            value={filtroMarcaId || "todas"}
            onValueChange={(v) => setFiltroMarcaId(v === "todas" || !v ? "" : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {marcas?.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Select value={estado} onValueChange={(v) => setEstado(v as EstadoProducto)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activos">Activos</SelectItem>
              <SelectItem value="inactivos">Inactivos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={soloStockBajo}
            onChange={(e) => setSoloStockBajo(e.target.checked)}
          />
          Solo stock bajo
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <EncabezadoOrdenable columna="nombre" orden={orden} onClick={ordenarPor}>
                Nombre
              </EncabezadoOrdenable>
              <EncabezadoOrdenable columna="codigoInterno" orden={orden} onClick={ordenarPor}>
                Código interno
              </EncabezadoOrdenable>
              <EncabezadoOrdenable columna="categoria" orden={orden} onClick={ordenarPor}>
                Categoría
              </EncabezadoOrdenable>
              <EncabezadoOrdenable columna="marca" orden={orden} onClick={ordenarPor}>
                Marca
              </EncabezadoOrdenable>
              <EncabezadoOrdenable
                columna="stockTotal"
                orden={orden}
                onClick={ordenarPor}
                className="text-right"
              >
                Stock
              </EncabezadoOrdenable>
              <EncabezadoOrdenable
                columna="precioCosto"
                orden={orden}
                onClick={ordenarPor}
                className="text-right"
              >
                Costo
              </EncabezadoOrdenable>
              <EncabezadoOrdenable
                columna="precioVenta"
                orden={orden}
                onClick={ordenarPor}
                className="text-right"
              >
                Venta
              </EncabezadoOrdenable>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productosOrdenados.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                  Sin productos para estos filtros
                </TableCell>
              </TableRow>
            )}
            {productosOrdenados.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setProductoEditar(p)}
              >
                <TableCell>{p.nombre}</TableCell>
                <TableCell>{p.codigoInterno}</TableCell>
                <TableCell>{p.categoria?.nombre ?? "-"}</TableCell>
                <TableCell>{p.marca?.nombre ?? "-"}</TableCell>
                <TableCell className="text-right">{p.stockTotal}</TableCell>
                <TableCell className="text-right">${formatearMoneda(p.precioCosto)}</TableCell>
                <TableCell className="text-right">${formatearMoneda(p.precioVenta)}</TableCell>
                <TableCell>
                  <Badge variant={p.activo ? "outline" : "destructive"}>
                    {p.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {p.activo ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEliminar(p);
                      }}
                    >
                      Eliminar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReactivar(p);
                      }}
                    >
                      Reactivar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={productoEditar != null} onOpenChange={(v) => !v && setProductoEditar(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>{productoEditar?.nombre}</DialogTitle>
              {productoEditar && (
                <Badge variant={productoEditar.activo ? "outline" : "destructive"}>
                  {productoEditar.activo ? "Activo" : "Inactivo"}
                </Badge>
              )}
            </div>
            {productoEditar && (
              <DialogDescription>
                Código interno {productoEditar.codigoInterno}
                {productoEditar.categoria ? ` · ${productoEditar.categoria.nombre}` : ""}
                {productoEditar.marca ? ` · ${productoEditar.marca.nombre}` : ""}
              </DialogDescription>
            )}
          </DialogHeader>
          {productoEditar && (
            <div className="space-y-4">
              <SeccionModal icono={Package} titulo="Datos del producto">
                <FormularioProducto producto={productoEditar} onDone={() => {}} />
              </SeccionModal>
              <VariantesManager producto={productoEditar} />
            </div>
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
      categoriaId: form.categoriaId ? Number(form.categoriaId) : undefined,
      marcaId: form.marcaId ? Number(form.marcaId) : undefined,
    };
    try {
      if (producto) {
        await actualizarProducto.mutateAsync({ id: producto.id, input: datos });
        toast.success("Producto actualizado");
      } else {
        // El stock ya no se carga acá: vive en las variantes (ver VariantesManager).
        await crearProducto.mutateAsync({ ...datos, stockMinimo: 0 });
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
      <div className={`grid gap-4 ${producto ? "grid-cols-3" : "grid-cols-2"}`}>
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
        {producto && (
          <div className="space-y-2">
            <Label className="text-muted-foreground">Stock total</Label>
            <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
              {producto.stockTotal} unidades
            </div>
          </div>
        )}
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
      <div className="flex justify-end">
        <Button type="submit" disabled={guardando}>
          {producto ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}

function VariantesManager({ producto }: { producto: Producto }) {
  const productoId = producto.id;
  const { data: variantes, isLoading } = useVariantes(productoId);
  const crearVariante = useCrearVariante(productoId);
  const actualizarVariante = useActualizarVariante(productoId);
  const desactivarVariante = useDesactivarVariante(productoId);

  const [nuevaVariante, setNuevaVariante] = useState({ color: "", talle: "", stock: "0" });

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    try {
      await crearVariante.mutateAsync({
        color: nuevaVariante.color || undefined,
        talle: nuevaVariante.talle || undefined,
        stock: Number(nuevaVariante.stock),
      });
      setNuevaVariante({ color: "", talle: "", stock: "0" });
      toast.success("Variante creada");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  async function handleEliminar(variante: Variante) {
    if (!confirm(`¿Eliminar la variante "${variante.nombre}"?`)) return;
    try {
      await desactivarVariante.mutateAsync(variante.id);
      toast.success("Variante eliminada");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  function handleImprimirVariante(variante: Variante) {
    try {
      imprimirEtiquetas([
        {
          nombreProducto: producto.nombre,
          nombreVariante: variante.nombre,
          codigoBarras: variante.codigoBarras ?? "",
          precioVenta: Number(producto.precioVenta),
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo imprimir la etiqueta");
    }
  }

  function handleImprimirConStock() {
    const conStock = (variantes ?? []).filter((v) => v.stock > 0);
    if (conStock.length === 0) {
      toast.error("Ninguna variante tiene stock disponible para imprimir");
      return;
    }
    try {
      imprimirEtiquetas(
        conStock.map((v) => ({
          nombreProducto: producto.nombre,
          nombreVariante: v.nombre,
          codigoBarras: v.codigoBarras ?? "",
          precioVenta: Number(producto.precioVenta),
        })),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron imprimir las etiquetas");
    }
  }

  return (
    <SeccionModal
      icono={Layers}
      titulo={`Variantes${variantes ? ` (${variantes.length})` : ""}`}
      acciones={
        <Button type="button" variant="outline" size="sm" onClick={handleImprimirConStock}>
          <Printer className="size-3.5" />
          Imprimir con stock
        </Button>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Talle</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variantes?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Todavía no hay variantes. Agregá la primera abajo.
                  </TableCell>
                </TableRow>
              )}
              {variantes?.map((v) => (
                <FilaVariante
                  key={v.id}
                  variante={v}
                  onGuardar={(input) => actualizarVariante.mutateAsync({ id: v.id, input })}
                  onEliminar={() => handleEliminar(v)}
                  onImprimir={() => handleImprimirVariante(v)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <form
        onSubmit={handleCrear}
        className="grid grid-cols-4 items-end gap-2 rounded-lg border border-dashed p-3"
      >
        <div className="space-y-1">
          <Label className="text-xs">Color</Label>
          <Input
            className="h-8"
            value={nuevaVariante.color}
            onChange={(e) => setNuevaVariante((v) => ({ ...v, color: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Talle</Label>
          <Input
            className="h-8"
            value={nuevaVariante.talle}
            onChange={(e) => setNuevaVariante((v) => ({ ...v, talle: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Stock</Label>
          <Input
            className="h-8"
            type="number"
            min={0}
            value={nuevaVariante.stock}
            onChange={(e) => setNuevaVariante((v) => ({ ...v, stock: e.target.value }))}
            required
          />
        </div>
        <Button type="submit" size="sm" disabled={crearVariante.isPending}>
          <Plus className="size-3.5" />
          Agregar variante
        </Button>
      </form>
    </SeccionModal>
  );
}

function FilaVariante({
  variante,
  onGuardar,
  onEliminar,
  onImprimir,
}: {
  variante: Variante;
  onGuardar: (input: { color?: string; talle?: string; stock?: number }) => Promise<unknown>;
  onEliminar: () => void;
  onImprimir: () => void;
}) {
  const [form, setForm] = useState({
    color: variante.color ?? "",
    talle: variante.talle ?? "",
    stock: String(variante.stock),
  });
  const [guardando, setGuardando] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar({
        color: form.color || undefined,
        talle: form.talle || undefined,
        stock: Number(form.stock),
      });
      toast.success("Variante actualizada");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="text-sm">{variante.nombre}</TableCell>
      <TableCell>
        <Input className="h-8" value={form.color} onChange={(e) => set("color", e.target.value)} />
      </TableCell>
      <TableCell>
        <Input className="h-8" value={form.talle} onChange={(e) => set("talle", e.target.value)} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{variante.sku ?? "-"}</TableCell>
      <TableCell className="text-right">
        <Input
          className="h-8 text-right"
          type="number"
          min={0}
          value={form.stock}
          onChange={(e) => set("stock", e.target.value)}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleGuardar}
            disabled={guardando}
            title="Guardar cambios"
            aria-label="Guardar cambios de la variante"
          >
            <Save />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onImprimir}
            title="Imprimir etiqueta"
            aria-label="Imprimir etiqueta de la variante"
          >
            <Printer />
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={onEliminar}
            title="Eliminar variante"
            aria-label="Eliminar variante"
          >
            <Trash2 />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
