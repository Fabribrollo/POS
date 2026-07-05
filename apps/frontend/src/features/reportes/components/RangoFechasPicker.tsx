import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RangoFechasValor {
  desde: string;
  hasta: string;
}

function formatoFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangoUltimosDias(dias: number): RangoFechasValor {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  return { desde: formatoFecha(desde), hasta: formatoFecha(hasta) };
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
