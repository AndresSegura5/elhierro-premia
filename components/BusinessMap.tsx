"use client";

import { useCallback, useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import type { Business } from "@/lib/types";
import { IslandMap } from "@/components/IslandMap";
import { StyledSelect } from "@/components/StyledSelect";

type Props = {
  businesses: Business[];
  selectedId?: string;
  onSelect?: (id: string | null) => void;
  hideToolbar?: boolean;
  zoomEnabled?: boolean;
};

export function BusinessMap({ businesses, selectedId, onSelect, hideToolbar = false, zoomEnabled = true }: Props) {
  const [localActiveId, setLocalActiveId] = useState<string | undefined>(selectedId);
  const [query, setQuery] = useState("");
  const [municipality, setMunicipality] = useState("");
  const activeId = onSelect ? selectedId : localActiveId;
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const filtered = useMemo(
    () =>
      businesses.filter(
        (business) =>
          (!municipality || business.municipality === municipality) &&
          normalize(
            business.name + " " + business.category + " " + business.area,
          ).includes(normalize(query)),
      ),
    [businesses, municipality, query],
  );
  const handleSelect = useCallback(
    (id: string | null) => {
      if (onSelect) onSelect(id);
      else setLocalActiveId(id ?? undefined);
    },
    [onSelect],
  );
  const active =
    filtered.find((business) => business.id === activeId) ?? filtered[0];

  return (
    <div>
      {!hideToolbar && <div className="map-toolbar">
        <label className="map-search">
          <Search size={17} />
          <input
            aria-label="Buscar comercio"
            placeholder="Buscar comercio, producto o zona"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <StyledSelect
          ariaLabel="Municipio"
          menuLabel="Filtrar por municipio"
          value={municipality}
          options={[{ value: "", label: "Todos los municipios" }, ...Array.from(new Set(businesses.map((business) => business.municipality))).map((name) => ({ value: name, label: name }))]}
          onValueChange={setMunicipality}
          className="map-toolbar-select"
        />
        <span className="map-count">
          {filtered.length} comercios · Datos de ejemplo
        </span>
      </div>}
      {active ? (
        <section className="map-shell" aria-label="Mapa de comercios">
          <IslandMap
            businesses={filtered}
            activeId={activeId}
            onSelect={handleSelect}
            markerStyle="dot"
            zoomEnabled={zoomEnabled}
          />
          <div className="map-overlay">
            <div className="business-list">
              {filtered.map((business, index) => (
                <button
                  key={business.id}
                  className={
                    business.id === active.id
                      ? "business-row active"
                      : "business-row"
                  }
                  onClick={() => handleSelect(business.id)}
                  type="button"
                  aria-pressed={business.id === active.id}
                >
                  <span className="business-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{business.name}</strong>
                    <small>
                      {business.category} · {business.municipality}
                    </small>
                  </span>
                  <MapPin size={18} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <p className="map-empty" role="status">
          No hay comercios que coincidan con tu búsqueda.
        </p>
      )}
    </div>
  );
}
