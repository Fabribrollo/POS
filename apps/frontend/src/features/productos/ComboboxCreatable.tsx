import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";

interface Opcion {
  id: number;
  nombre: string;
}

// Select con texto libre: el usuario escribe, ve coincidencias filtradas, y si
// no existe ninguna puede crear la opción nueva sin salir del campo.
export function ComboboxCreatable({
  value,
  onChange,
  opciones,
  onCrear,
  placeholder,
}: {
  value: string;
  onChange: (id: string) => void;
  opciones: Opcion[];
  onCrear: (nombre: string) => Promise<Opcion>;
  placeholder: string;
}) {
  const [query, setQuery] = React.useState("");
  const seleccionada = opciones.find((o) => String(o.id) === value) ?? null;

  async function handleCrear() {
    const texto = query.trim();
    if (!texto) return;
    const creada = await onCrear(texto);
    onChange(String(creada.id));
  }

  return (
    <Combobox.Root<Opcion>
      items={opciones}
      value={seleccionada}
      onValueChange={(opcion) => onChange(opcion ? String(opcion.id) : "")}
      onInputValueChange={setQuery}
      itemToStringLabel={(o) => o.nombre}
      itemToStringValue={(o) => String(o.id)}
      isItemEqualToValue={(a, b) => a.id === b.id}
    >
      <Combobox.Input
        placeholder={placeholder}
        className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Combobox.Portal>
        <Combobox.Positioner className="isolate z-50" sideOffset={4}>
          <Combobox.Popup className="max-h-64 w-(--anchor-width) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <Combobox.Empty className="px-1.5 py-1 text-sm text-muted-foreground">
              {query.trim() ? (
                <button
                  type="button"
                  className="w-full rounded-md px-1.5 py-1 text-left hover:bg-accent hover:text-accent-foreground"
                  onClick={handleCrear}
                >
                  Crear “{query.trim()}”
                </button>
              ) : (
                "Sin resultados"
              )}
            </Combobox.Empty>
            <Combobox.List>
              {(opcion: Opcion) => (
                <Combobox.Item
                  key={opcion.id}
                  value={opcion}
                  className="relative flex w-full cursor-default items-center rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  {opcion.nombre}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
