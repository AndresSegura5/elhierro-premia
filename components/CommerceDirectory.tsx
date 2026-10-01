"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, MapPin, Maximize2, Minimize2, Search, X } from "lucide-react";
import { IslandMap, iconForBusiness } from "@/components/IslandMap";
import { BusinessPhoto } from "@/components/BusinessPhoto";
import { StyledSelect } from "@/components/StyledSelect";
import { PageTitleHero } from "@/components/PageTitleHero";
import { localPhoneNumber, phoneLink } from "@/lib/phone";
import type { Business, Municipality } from "@/lib/types";

const municipalities: Municipality[] = ["Valverde", "La Frontera", "El Pinar"];
const couponCodePattern = /^EH-(?:BES|BIM|MER)-[A-HJ-KM-NP-Z][1-9][A-HJ-KM-NP-Z][1-9]{3}[A-HJ-KM-NP-Z]$/i;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function CommerceDirectory({ businesses }: { businesses: Business[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [municipality, setMunicipality] = useState<Municipality | "">("");
  const [selectedId, setSelectedId] = useState<string | null>();
  const [mapExpanded, setMapExpanded] = useState(false);
  const [couponBusinessId, setCouponBusinessId] = useState<string>();
  const categories = useMemo(() => [...new Set(businesses.map((business) => business.category))], [businesses]);

  useEffect(() => {
    const code = query.trim();
    if (!couponCodePattern.test(code)) {
      setCouponBusinessId(undefined);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/bonos/${encodeURIComponent(code)}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!controller.signal.aborted) setCouponBusinessId(data?.coupon?.businessId); })
      .catch(() => { if (!controller.signal.aborted) setCouponBusinessId(undefined); });
    return () => controller.abort();
  }, [query]);

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
      (couponBusinessId
        ? business.id === couponBusinessId
        : normalize(`${business.name} ${business.category} ${business.area} ${business.municipality} ${business.address}`)
          .includes(term)),
    );
  }, [businesses, category, couponBusinessId, municipality, query]);

  const grouped = municipalities.map((name) => ({
    name,
    businesses: visibleBusinesses.filter((business) => business.municipality === name),
  })).filter((group) => group.businesses.length > 0);
  const activeId = selectedId === null
    ? undefined
    : selectedId ?? (visibleBusinesses.some((business) => business.id === couponBusinessId) ? couponBusinessId : undefined);

  return (
    <div className="directory-page" id="directorio">
      <PageTitleHero>
        Comercios de <em>El Hierro</em>
      </PageTitleHero>

      <div className="directory-content">
        <section className={`directory-map${mapExpanded ? " directory-map--expanded" : ""}`} aria-label="Mapa de los comercios">
          <IslandMap
            businesses={visibleBusinesses}
            activeId={activeId}
            onSelect={setSelectedId}
            basemap="street"
            markerStyle="dot"
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
                  if (couponCodePattern.test(event.target.value.trim())) {
                    setCategory("");
                    setMunicipality("");
                  }
                }}
                placeholder="Comercio, zona o código del bono"
                aria-label="Buscar comercio o código del bono"
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
              <span role="status">{visibleBusinesses.length} {visibleBusinesses.length === 1 ? "resultado" : "resultados"}</span>
            </div>
            <p className="directory-demo-note">Datos de ejemplo</p>
          </div>

          <div className="directory-list" aria-label="Listado de comercios por municipio">
            {grouped.length ? grouped.map((group) => (
              <section className="directory-group" key={group.name} aria-label={`Comercios en ${group.name}`}>
                <h3><MapPin size={15} aria-hidden="true" />{group.name}<span>{group.businesses.length}</span></h3>
                <ul>
                  {group.businesses.map((business) => {
                    const selected = activeId === business.id;
                    const Icon = iconForBusiness(business.category);
                    return (
                      <li className={selected ? "selected" : undefined} key={business.id}>
                        <button type="button" aria-expanded={selected} onClick={() => setSelectedId(selected ? null : business.id)}>
                          <BusinessPhoto
                            src={business.image}
                            category={business.category}
                            className="directory-business-thumb"
                            fallback={<Icon size={30} strokeWidth={1.7} aria-hidden="true" />}
                          />
                          <span className="directory-business-copy">
                            <strong>{business.name}</strong>
                            <small><MapPin size={12} aria-hidden="true" />{business.address}</small>
                            <span className="directory-business-hours"><Clock3 size={13} aria-hidden="true" />{business.openingHours}</span>
                          </span>
                        </button>
                        {selected && (
                          <div className="directory-business-detail">
                            <a href={phoneLink(business.phone)}>{localPhoneNumber(business.phone)}</a>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )) : <p className="directory-empty" role="status">No hay comercios que coincidan con la búsqueda.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
