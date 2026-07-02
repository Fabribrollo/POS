import { EventEmitter } from "node:events";

// Eventos de dominio disparados por los services (ej. VentaService) y
// escuchados por módulos independientes (stock, caja, y a futuro
// facturación AFIP / sync a la nube). Mantiene a VentaService enfocado solo
// en la regla de negocio de "crear una venta", no en sus efectos laterales.
export interface DomainEvents {
  "venta.completada": { ventaId: number };
  "venta.anulada": { ventaId: number; motivo: string };
  "stock.bajo": { productoId: number; cantidad: number; stockMinimo: number };
}

class TypedEventBus extends EventEmitter {
  emitEvent<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
    this.emit(event, payload);
  }

  onEvent<K extends keyof DomainEvents>(
    event: K,
    listener: (payload: DomainEvents[K]) => void,
  ): void {
    this.on(event, listener);
  }
}

export const eventBus = new TypedEventBus();
