import { create } from "zustand";

export interface ItemCarrito {
  productoId: number;
  // Un mismo producto puede estar en el carrito varias veces, una por cada
  // variante distinta que se vendió; varianteId (junto con productoId)
  // identifica la línea, no productoId solo.
  varianteId?: number;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  // Descuento por línea, en porcentaje (0-100). El monto absoluto que
  // consume el backend se calcula a partir de esto recién al confirmar la
  // venta (ver VentaPage.confirmarVenta).
  descuentoPorcentaje: number;
  // Capturado al agregar la línea (stock de la variante, o del producto si
  // no tiene variante); nunca se deja superar este límite en `cantidad`.
  stockDisponible: number;
}

function esMismaLinea(item: ItemCarrito, productoId: number, varianteId?: number): boolean {
  return item.productoId === productoId && item.varianteId === varianteId;
}

function clamp(valor: number, min: number, max: number): number {
  return Math.min(Math.max(valor, min), max);
}

interface CarritoState {
  items: ItemCarrito[];
  agregar: (item: Omit<ItemCarrito, "cantidad" | "descuentoPorcentaje">) => void;
  quitar: (productoId: number, varianteId?: number) => void;
  setCantidad: (productoId: number, varianteId: number | undefined, cantidad: number) => void;
  setDescuentoPorcentaje: (
    productoId: number,
    varianteId: number | undefined,
    porcentaje: number,
  ) => void;
  limpiar: () => void;
}

export const useCarritoStore = create<CarritoState>((set) => ({
  items: [],
  agregar: (item) =>
    set((state) => {
      const existente = state.items.find((i) => esMismaLinea(i, item.productoId, item.varianteId));
      if (existente) {
        return {
          items: state.items.map((i) =>
            esMismaLinea(i, item.productoId, item.varianteId)
              ? { ...i, cantidad: clamp(i.cantidad + 1, 0, i.stockDisponible) }
              : i,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          { ...item, cantidad: clamp(1, 0, item.stockDisponible), descuentoPorcentaje: 0 },
        ],
      };
    }),
  quitar: (productoId, varianteId) =>
    set((state) => ({
      items: state.items.filter((i) => !esMismaLinea(i, productoId, varianteId)),
    })),
  setCantidad: (productoId, varianteId, cantidad) =>
    set((state) => ({
      items: state.items.map((i) =>
        esMismaLinea(i, productoId, varianteId)
          ? { ...i, cantidad: clamp(cantidad, 1, i.stockDisponible) }
          : i,
      ),
    })),
  setDescuentoPorcentaje: (productoId, varianteId, porcentaje) =>
    set((state) => ({
      items: state.items.map((i) =>
        esMismaLinea(i, productoId, varianteId)
          ? { ...i, descuentoPorcentaje: clamp(porcentaje, 0, 100) }
          : i,
      ),
    })),
  limpiar: () => set({ items: [] }),
}));
