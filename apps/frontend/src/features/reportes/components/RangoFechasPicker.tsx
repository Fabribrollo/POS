import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RangoFechasValor {
  desde: string;
  hasta: string;
}

// OJO con toISOString() acá: convierte a UTC, así que en cualquier huso
// horario detrás de UTC (como Argentina, UTC-3) la última franja de cada día
// local (21hs a medianoche) ya cae en el día siguiente en UTC — el preset
// "Hoy" mostraría mañana. Se arma la fecha a mano con los getters locales.
function formatoFecha(d: Date): string {
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function parsearFecha(fechaYMD: string): [number, number, number] {
  const [anio, mes, dia] = fechaYMD.split("-").map(Number);
  return [anio, mes - 1, dia];
}

export function rangoUltimosDias(dias: number): RangoFechasValor {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  return { desde: formatoFecha(desde), hasta: formatoFecha(hasta) };
}

// Los inputs date solo dan "2026-07-05" (sin hora). Si eso se manda tal cual
// al backend, `new Date("2026-07-05")` lo interpreta como medianoche UTC, no
// medianoche local — en un huso horario detrás de UTC como Argentina, las
// ventas del resto del día quedan afuera del filtro "hasta" hasta que el
// usuario pone como límite el día siguiente (el bug reportado). Por eso acá
// se arman los límites del día en hora LOCAL del navegador (que sí conoce el
// huso horario real del usuario) antes de mandarlos como query param.
export function rangoQueryParams(rango: RangoFechasValor): { desde: string; hasta: string } {
  const [anioDesde, mesDesde, diaDesde] = parsearFecha(rango.desde);
  const [anioHasta, mesHasta, diaHasta] = parsearFecha(rango.hasta);
  const inicio = new Date(anioDesde, mesDesde, diaDesde, 0, 0, 0, 0);
  const fin = new Date(anioHasta, mesHasta, diaHasta, 23, 59, 59, 999);
  return { desde: inicio.toISOString(), hasta: fin.toISOString() };
}

const PRESETS = [
  { label: "Hoy", dias: 0 },
  { label: "7 días", dias: 7 },
  { label: "30 días", dias: 30 },
  { label: "Este año", dias: 365 },
];

export function RangoFechasPicker({
  value,
  onChange,
}: {
  value: RangoFechasValor;
  onChange: (v: RangoFechasValor) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2 no-imprimir">
      <div className="space-y-1">
        <Label className="text-xs">Desde</Label>
        <Input
          type="date"
          value={value.desde}
          onChange={(e) => onChange({ ...value, desde: e.target.value })}
          className="h-9"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Hasta</Label>
        <Input
          type="date"
          value={value.hasta}
          onChange={(e) => onChange({ ...value, hasta: e.target.value })}
          className="h-9"
        />
      </div>
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(rangoUltimosDias(p.dias))}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
