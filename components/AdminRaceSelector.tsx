"use client";

import { useRouter } from "next/navigation";
import type { Race } from "@/lib/types";
import { StyledSelect } from "@/components/StyledSelect";

export function AdminRaceSelector({
  races,
  selectedId,
  pathname = "/admin/carreras",
}: {
  races: Race[];
  selectedId?: string;
  pathname?: "/admin/carreras";
}) {
  const router = useRouter();

  return (
    <div className="admin-race-selector">
      <span>Carrera</span>
      <StyledSelect
        ariaLabel="Carrera"
        menuLabel="Selecciona una carrera"
        value={selectedId ?? ""}
        options={[{ value: "", label: "Selecciona una carrera" }, ...races.map((race) => ({ value: race.id, label: race.name }))]}
        onValueChange={(id) => router.push(id ? `${pathname}?carrera=${encodeURIComponent(id)}` : pathname)}
      />
    </div>
  );
}
