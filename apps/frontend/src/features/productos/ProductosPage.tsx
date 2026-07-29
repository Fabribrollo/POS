import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, Layers, type LucideIcon, Package, Printer, Trash2, X } from "lucide-react";
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
  type Categoria,
  type EstadoProducto,
  type Marca,
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
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());

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

  function toggleModoSeleccion() {
    setModoSeleccion((v) => !v);
    setSeleccionados(new Set());
  }

  function toggleSeleccionado(id: number) {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) {
        nuevo.delete(id);
      } else {
        nuevo.add(id);
      }
      return nuevo;
    });
  }

  function toggleSeleccionarTodos() {
    setSeleccionados((actual) =>
      actual.size === productosOrdenados.length
        ? new Set()
        : new Set(productosOrdenados.map((p) => p.id)),
    );
  }

  async function handleEliminarSeleccionados() {
    const cantidad = seleccionados.size;
    if (cantidad === 0) return;
    if (!confirm(`¿Eliminar ${cantidad} producto(s) seleccionado(s)?`)) return;

    const resultados = await Promise.allSettled(
      Array.from(seleccionados).map((id) => desactivarProducto.mutateAsync(id)),
    );
    const fallidos = resultados.filter((r) => r.status === "rejected").length;
    const exitosos = cantidad - fallidos;

    if (exitosos > 0) toast.success(`${exitosos} producto(s) eliminado(s)`);
    if (fallidos > 0) toast.error(`${fallidos} producto(s) no se pudieron eliminar`);

    setSeleccionados(new Set());
    setModoSeleccion(false);
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
          {modoSeleccion && seleccionados.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleEliminarSeleccionados}
              disabled={desactivarProducto.isPending}
            >
              <Trash2 className="size-4" />
              Eliminar seleccionados ({seleccionados.size})
            </Button>
          )}
          <Button variant={modoSeleccion ? "secondary" : "outline"} onClick={toggleModoSeleccion}>
            {modoSeleccion ? (
              <>
                <X className="size-4" />
                Cancelar
              </>
            ) : (
              <>
                <CheckSquare className="size-4" />
                Seleccionar
              </>
            )}
          </Button>
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
              <SelectItem value="activos">activos</SelectItem>
              <SelectItem value="inactivos">inactivos</SelectItem>
              <SelectItem value="todos">todos</SelectItem>
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
              {modoSeleccion && (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={
                      productosOrdenados.length > 0 && seleccionados.size === productosOrdenados.length
                    }
                    onChange={toggleSeleccionarTodos}
                    aria-label="Seleccionar todos los productos"
                  />
                </TableHead>
              )}
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
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productosOrdenados.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={modoSeleccion ? 9 : 8}
                  className="text-center text-sm text-muted-foreground"
                >
                  Sin productos para estos filtros
                </TableCell>
              </TableRow>
            )}
            {productosOrdenados.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => (modoSeleccion ? toggleSeleccionado(p.id) : setProductoEditar(p))}
              >
                {modoSeleccion && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={seleccionados.has(p.id)}
                      onChange={() => toggleSeleccionado(p.id)}
                      aria-label={`Seleccionar ${p.nombre}`}
                    />
                  </TableCell>
                )}
                <TableCell>{p.nombre}</TableCell>
                <TableCell>{p.codigoInterno}</TableCell>
                <TableCell>{p.categoria?.nombre ?? "-"}</TableCell>
                <TableCell>{p.marca?.nombre ?? "-"}</TableCell>
                <TableCell className="text-right">{p.stockTotal}</TableCell>
                <TableCell className="text-right">${formatearMoneda(p.precioCosto)}</TableCell>
                <TableCell className="text-right">${formatearMoneda(p.precioVenta)}</TableCell>
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
              {productoEditar && !productoEditar.activo && (
                <Badge variant="destructive">Inactivo</Badge>
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
          {productoEditar && <FormularioEdicionProducto producto={productoEditar} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type FormProducto = {
  nombre: string;
  precioCosto: string;
  precioVenta: string;
  categoriaId: string;
  marcaId: string;
};

// Campos compartidos por el alta (FormularioProducto, en su propio <form>) y
// la edición (FormularioEdicionProducto, embebidos en el <form> combinado de
// producto + variantes): mismo shape de datos en los dos casos, solo cambia
// si se muestra el stock total (solo tiene sentido si el producto ya existe).
function CamposProducto({
  form,
  set,
  categorias,
  marcas,
  onCrearCategoria,
  onCrearMarca,
  stockTotal,
}: {
  form: FormProducto;
  set: <K extends keyof FormProducto>(key: K, value: string) => void;
  categorias: Categoria[] | undefined;
  marcas: Marca[] | undefined;
  onCrearCategoria: (nombre: string) => Promise<Categoria>;
  onCrearMarca: (nombre: string) => Promise<Marca>;
  stockTotal?: number;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label>Nombre</Label>
        <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required />
      </div>
      <div className={`grid gap-4 ${stockTotal != null ? "grid-cols-3" : "grid-cols-2"}`}>
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
        {stockTotal != null && (
          <div className="space-y-2">
            <Label className="text-muted-foreground">Stock total</Label>
            <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
              {stockTotal} unidades
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
            onCrear={onCrearCategoria}
            placeholder="Escribí o creá una categoría"
          />
        </div>
        <div className="space-y-2">
          <Label>Marca</Label>
          <ComboboxCreatable
            value={form.marcaId}
            onChange={(id) => set("marcaId", id)}
            opciones={marcas ?? []}
            onCrear={onCrearMarca}
            placeholder="Escribí o creá una marca"
          />
        </div>
      </div>
    </>
  );
}

// Solo alta: la edición vive en FormularioEdicionProducto, que además maneja
// las variantes en el mismo submit.
function FormularioProducto({ onDone }: { onDone: () => void }) {
  const { data: categorias } = useCategorias();
  const { data: marcas } = useMarcas();
  const crearProducto = useCrearProducto();
  const crearCategoria = useCrearCategoria();
  const crearMarca = useCrearMarca();

  const [form, setForm] = useState<FormProducto>({
    nombre: "",
    precioCosto: "",
    precioVenta: "",
    categoriaId: "",
    marcaId: "",
  });

  function set<K extends keyof FormProducto>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      // El stock no se carga acá: vive en las variantes, que solo se pueden
      // crear una vez que el producto ya existe (ver FormularioEdicionProducto).
      await crearProducto.mutateAsync({
        nombre: form.nombre,
        precioCosto: Number(form.precioCosto),
        precioVenta: Number(form.precioVenta),
        categoriaId: form.categoriaId ? Number(form.categoriaId) : undefined,
        marcaId: form.marcaId ? Number(form.marcaId) : undefined,
        stockMinimo: 0,
      });
      toast.success("Producto creado");
      onDone();
    } catch (err) {
      toast.error(extraerMensajeError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CamposProducto
        form={form}
        set={set}
        categorias={categorias}
        marcas={marcas}
        onCrearCategoria={(nombre) => crearCategoria.mutateAsync(nombre)}
        onCrearMarca={(nombre) => crearMarca.mutateAsync(nombre)}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={crearProducto.isPending}>
          Crear producto
        </Button>
      </div>
    </form>
  );
}

type EdicionVariante = { color: string; talle: string; stock: string };

// Edición de un producto existente: datos del producto + variantes ya
// creadas (editables acá mismo, sin acción propia) + una fila para cargar
// una variante nueva, todo bajo un único <form>/"Guardar cambios" al final.
function FormularioEdicionProducto({ producto }: { producto: Producto }) {
  const { data: categorias } = useCategorias();
  const { data: marcas } = useMarcas();
  const actualizarProducto = useActualizarProducto();
  const crearCategoria = useCrearCategoria();
  const crearMarca = useCrearMarca();

  const { data: variantes, isLoading: cargandoVariantes } = useVariantes(producto.id);
  const crearVariante = useCrearVariante(producto.id);
  const actualizarVariante = useActualizarVariante(producto.id);
  const desactivarVariante = useDesactivarVariante(producto.id);

  const [form, setForm] = useState<FormProducto>({
    nombre: producto.nombre,
    precioCosto: producto.precioCosto,
    precioVenta: producto.precioVenta,
    categoriaId: producto.categoria ? String(producto.categoria.id) : "",
    marcaId: producto.marca ? String(producto.marca.id) : "",
  });

  function set<K extends keyof FormProducto>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Ediciones de variantes existentes, por id. Se completa cuando llegan los
  // datos del servidor y no se vuelve a pisar mientras el usuario edita
  // (evita que un refetch de fondo borre lo que todavía no se guardó).
  const [edicionesVariantes, setEdicionesVariantes] = useState<Record<number, EdicionVariante>>(
    {},
  );

  useEffect(() => {
    if (!variantes) return;
    setEdicionesVariantes((actual) => {
      const siguiente = { ...actual };
      let cambio = false;
      for (const v of variantes) {
        if (!siguiente[v.id]) {
          siguiente[v.id] = { color: v.color ?? "", talle: v.talle ?? "", stock: String(v.stock) };
          cambio = true;
        }
      }
      return cambio ? siguiente : actual;
    });
  }, [variantes]);

  function setCampoVariante(id: number, campo: keyof EdicionVariante, value: string) {
    setEdicionesVariantes((actual) => ({
      ...actual,
      [id]: { ...actual[id], [campo]: value },
    }));
  }

  const [nuevaVariante, setNuevaVariante] = useState<EdicionVariante>({
    color: "",
    talle: "",
    stock: "0",
  });

  async function handleEliminarVariante(variante: Variante) {
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

  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nuevaVarianteActiva =
      nuevaVariante.color.trim() !== "" ||
      nuevaVariante.talle.trim() !== "" ||
      nuevaVariante.stock.trim() !== "0";
    if (nuevaVarianteActiva && !nuevaVariante.color.trim() && !nuevaVariante.talle.trim()) {
      toast.error("La variante nueva necesita color o talle");
      return;
    }

    setGuardando(true);
    try {
      await actualizarProducto.mutateAsync({
        id: producto.id,
        input: {
          nombre: form.nombre,
          precioCosto: Number(form.precioCosto),
          precioVenta: Number(form.precioVenta),
          categoriaId: form.categoriaId ? Number(form.categoriaId) : undefined,
          marcaId: form.marcaId ? Number(form.marcaId) : undefined,
        },
      });

      for (const v of variantes ?? []) {
        const edicion = edicionesVariantes[v.id];
        if (!edicion) continue;
        const cambioColor = edicion.color !== (v.color ?? "");
        const cambioTalle = edicion.talle !== (v.talle ?? "");
        const cambioStock = Number(edicion.stock) !== v.stock;
        if (!cambioColor && !cambioTalle && !cambioStock) continue;
        await actualizarVariante.mutateAsync({
          id: v.id,
          input: {
            color: edicion.color || undefined,
            talle: edicion.talle || undefined,
            stock: Number(edicion.stock),
          },
        });
      }

      if (nuevaVarianteActiva) {
        await crearVariante.mutateAsync({
          color: nuevaVariante.color || undefined,
          talle: nuevaVariante.talle || undefined,
          stock: Number(nuevaVariante.stock),
        });
        setNuevaVariante({ color: "", talle: "", stock: "0" });
      }

      toast.success("Producto actualizado");
    } catch (err) {
      toast.error(extraerMensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SeccionModal icono={Package} titulo="Datos del producto">
        <CamposProducto
          form={form}
          set={set}
          categorias={categorias}
          marcas={marcas}
          onCrearCategoria={(nombre) => crearCategoria.mutateAsync(nombre)}
          onCrearMarca={(nombre) => crearMarca.mutateAsync(nombre)}
          stockTotal={producto.stockTotal}
        />
      </SeccionModal>

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
        {cargandoVariantes ? (
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
                    valor={edicionesVariantes[v.id] ?? { color: "", talle: "", stock: "0" }}
                    onCambiar={(campo, value) => setCampoVariante(v.id, campo, value)}
                    onEliminar={() => handleEliminarVariante(v)}
                    onImprimir={() => handleImprimirVariante(v)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="grid grid-cols-3 items-end gap-2 rounded-lg border border-dashed p-3">
          <div className="space-y-1">
            <Label className="text-xs">Color (variante nueva)</Label>
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
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Completá color y/o talle para agregar esta variante al guardar los cambios.
        </p>
      </SeccionModal>

      <div className="flex justify-end">
        <Button type="submit" disabled={guardando}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

function FilaVariante({
  variante,
  valor,
  onCambiar,
  onEliminar,
  onImprimir,
}: {
  variante: Variante;
  valor: EdicionVariante;
  onCambiar: (campo: keyof EdicionVariante, value: string) => void;
  onEliminar: () => void;
  onImprimir: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="text-sm">{variante.nombre}</TableCell>
      <TableCell>
        <Input
          className="h-8"
          value={valor.color}
          onChange={(e) => onCambiar("color", e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Input
          className="h-8"
          value={valor.talle}
          onChange={(e) => onCambiar("talle", e.target.value)}
        />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{variante.sku ?? "-"}</TableCell>
      <TableCell className="text-right">
        <Input
          className="h-8 text-right"
          type="number"
          min={0}
          value={valor.stock}
          onChange={(e) => onCambiar("stock", e.target.value)}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onImprimir}
            title="Imprimir etiqueta"
            aria-label="Imprimir etiqueta de la variante"
          >
            <Printer />
          </Button>
          <Button
            type="button"
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
