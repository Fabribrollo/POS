import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const formateadorMoneda = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 })

// Puntos cada mil, coma para decimales (es-AR): 18000 -> "18.000".
export function formatearMoneda(valor: number | string): string {
  return formateadorMoneda.format(Number(valor))
}
