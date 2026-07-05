import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  valor,
  variacion,
  icon: Icon,
}: {
  label: string;
  valor: string;
  variacion?: number | null;
  icon?: LucideIcon;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{valor}</p>
          {variacion != null && (
            <p className={cn("text-xs", variacion >= 0 ? "text-green-600" : "text-destructive")}>
              {variacion >= 0 ? "▲" : "▼"} {Math.abs(variacion).toFixed(1)}% vs período anterior
            </p>
          )}
        </div>
        {Icon && <Icon className="size-8 shrink-0 text-muted-foreground/50" />}
      </CardContent>
    </Card>
  );
}
