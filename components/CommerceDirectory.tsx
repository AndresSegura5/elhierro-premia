"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, MapPin, Maximize2, Minimize2, Search, X } from "lucide-react";
import { IslandMap, iconForBusiness } from "@/components/IslandMap";
import { BusinessPhoto } from "@/components/BusinessPhoto";
import { StyledSelect } from "@/components/StyledSelect";
import { PageTitleHero } from "@/components/PageTitleHero";
import { MunicipalitySilhouette } from "@/components/MunicipalitySilhouette";
import type { Business, Municipality } from "@/lib/types";

const municipalities: Municipality[] = ["Valverde", "La Frontera", "El Pinar"];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function CommerceDirectory({ businesses }: { businesses: Business[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [municipality, setMunicipality] = useState<Municipality | "">("");
  const [selectedId, setSelectedId] = useState<string | null>();
  const [highlightedId, setHighlightedId] = useState<string>();
  const [mapExpanded, setMapExpanded] = useState(false);
  const categories = useMemo(() => [...new Set(businesses.map((business) => business.category))], [businesses]);

  useEffect(() => {
    if (!mapExpanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mapExpanded]);

  const visibleBusinesses = useMemo(() => {
    const term = normalize(query.trim());
    return businesses.filter((business) =>
      (!municipality || business.municipality === municipality) &&
      (!category || business.category === category) &&
      normalize(`${business.name} ${business.category} ${business.area} ${business.municipality} ${business.address}`)
        .includes(term),
    );
  }, [businesses, category, municipality, query]);
  const visibleBusinessIds = useMemo(
    () => new Set(visibleBusinesses.map((business) => business.id)),
    [visibleBusinesses],
  );

  const grouped = municipalities.map((name) => ({
    name,
    businesses: visibleBusinesses.filter((business) => business.municipality === name),
  })).filter((group) => group.businesses.length > 0);
  const activeId = selectedId ?? undefined;

  return (
    <div className="directory-page" id="directorio">
      <PageTitleHero>
        Comercios de <em>El Hierro</em>
      </PageTitleHero>

      <div className="directory-content">
        <aside className="directory-panel" aria-label="Buscar y filtrar comercios">
          <div className="directory-controls">
            <label className="directory-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedId(undefined);
                }}
                placeholder="Comercio o zona"
                aria-label="Buscar comercio o zona"
              />
              {query && (
                <button type="button" aria-label="Limpiar búsqueda" onClick={() => { setQuery(""); setSelectedId(undefined); }}>
                  <X size={17} aria-hidden="true" />
                </button>
              )}
            </label>
            <div className="directory-filter-grid">
              <div className="directory-filter-field">
                <span>Categoría</span>
                <StyledSelect ariaLabel="Categoría" menuLabel="Filtrar por categoría" value={category} options={[{ value: "", label: "Todas las categorías" }, ...categories.map((name) => ({ value: name, label: name }))]} onValueChange={(next) => { setCategory(next); setSelectedId(undefined); }} />
              </div>
              <div className="directory-filter-field">
                <span>Municipio</span>
                <StyledSelect ariaLabel="Municipio" menuLabel="Filtrar por municipio" value={municipality} options={[{ value: "", label: "Toda la isla" }, ...municipalities.map((name) => ({ value: name, label: name }))]} onValueChange={(next) => { setMunicipality(next as Municipality | ""); setSelectedId(undefined); }} />
              </div>
            </div>
            <div className="directory-list-heading">
              <h2>Comercios participantes</h2>
            </div>
          </div>

          <div className="directory-list" aria-label="Listado de comercios por municipio">
            {grouped.length ? grouped.map((group) => (
              <section className="directory-group" key={group.name} aria-label={`Comercios en ${group.name}`}>
                <h3><MunicipalitySilhouette municipality={group.name} className="directory-municipality-shape" />{group.name}<span aria-label={`${group.businesses.length} ${group.businesses.length === 1 ? "comercio" : "comercios"}`}>{group.businesses.length}</span></h3>
                <ul>
                  {group.businesses.map((business) => {
                    const selected = activeId === business.id;
                    const Icon = iconForBusiness(business.category);
                    return (
                      <li
                        className={selected ? "selected" : undefined}
                        key={business.id}
                        onMouseEnter={() => setHighlightedId(business.id)}
                        onMouseLeave={() => setHighlightedId(undefined)}
                      >
                        <button type="button" aria-expanded={selected} onClick={() => setSelectedId(selected ? null : business.id)}>
                          <BusinessPhoto
                            src={business.image}
                            category={business.category}
                            className="directory-business-thumb"
                            fallback={<Icon size={30} strokeWidth={1.7} aria-hidden="true" />}
                          />
                          <span className="directory-business-copy">
                            <strong>{business.name}</strong>
                            <small><MapPin size={15} aria-hidden="true" /><span>{business.address}</span></small>
                            <span className="directory-business-hours"><Clock3 size={15} aria-hidden="true" /><span>{business.openingHours}</span></span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )) : <p className="directory-empty" role="status">No hay comercios que coincidan con la búsqueda.</p>}
          </div>
        </aside>

        <section className={`directory-map${mapExpanded ? " directory-map--expanded" : ""}`} aria-label="Mapa de los comercios">
          <IslandMap
            businesses={businesses}
            visibleBusinessIds={visibleBusinessIds}
            activeId={activeId}
            highlightedId={highlightedId}
            onSelect={setSelectedId}
            markerStyle="dot"
            scrollWheelZoom={mapExpanded}
            clipToIsland={false}
          />
          <button
            type="button"
            className="directory-map-expand"
            aria-label={mapExpanded ? "Cerrar mapa ampliado" : "Ampliar mapa"}
            aria-pressed={mapExpanded}
            onClick={() => setMapExpanded((expanded) => !expanded)}
            title={mapExpanded ? "Cerrar mapa ampliado" : "Ampliar mapa"}
          >
            {mapExpanded ? <Minimize2 size={19} aria-hidden="true" /> : <Maximize2 size={19} aria-hidden="true" />}
          </button>
        </section>
      </div>
    </div>
  );
}
