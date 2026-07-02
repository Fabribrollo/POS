import { create } from "zustand";

export interface ItemCarrito {
  productoId: number;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  descuento: number;
}

interface CarritoState {
  items: ItemCarrito[];
  agregar: (item: Omit<ItemCarrito, "cantidad" | "descuento">) => void;
  quitar: (productoId: number) => void;
  setCantidad: (productoId: number, cantidad: number) => void;
  limpiar: () => void;
}

export const useCarritoStore = create<CarritoState>((set) => ({
  items: [],
  agregar: (item) =>
    set((state) => {
      const existente = state.items.find((i) => i.productoId === item.productoId);
      if (existente) {
        return {
          items: state.items.map((i) =>
            i.productoId === item.productoId ? { ...i, cantidad: i.cantidad + 1 } : i,
          ),
        };
      }
      return { items: [...state.items, { ...item, cantidad: 1, descuento: 0 }] };
    }),
  quitar: (productoId) =>
    set((state) => ({ items: state.items.filter((i) => i.productoId !== productoId) })),
  setCantidad: (productoId, cantidad) =>
    set((state) => ({
      items: state.items.map((i) => (i.productoId === productoId ? { ...i, cantidad } : i)),
    })),
  limpiar: () => set({ items: [] }),
}));
