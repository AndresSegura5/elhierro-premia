"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Dumbbell,
  Heart,
  MapPin,
  MoreHorizontal,
  Scissors,
  Search,
  ShoppingBag,
  Store,
  Utensils,
  X,
} from "lucide-react";
import { BusinessMap } from "@/components/BusinessMap";
import type { Business } from "@/lib/types";

const categories = [
  { label: "Todos", icon: MapPin },
  { label: "Alimentación", icon: Utensils },
  { label: "Deporte", icon: Dumbbell },
  { label: "Restauración", icon: Utensils },
  { label: "Artesanía", icon: Scissors },
  { label: "Salud", icon: Heart },
  { label: "Moda", icon: ShoppingBag },
  { label: "Otros", icon: MoreHorizontal },
] as const;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchesCategory(business: Business, category: string): boolean {
  if (category === "Todos") return true;
  const name = normalize(business.category);
  if (category === "Deporte") return name.includes("deport");
  if (category === "Restauración") return name.includes("restaur");
  if (category === "Otros") {
    return !categories.slice(1, -1).some(({ label }) => matchesCategory(business, label));
  }
  return name.includes(normalize(category));
}

export function CommerceSection({ businesses }: { businesses: Business[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selectedId, setSelectedId] = useState<string>();
  const [highlightedId, setHighlightedId] = useState<string>();
  const [isOpen, setIsOpen] = useState(false);
  const visibleBusinesses = useMemo(
    () => businesses.filter((business) => matchesCategory(business, category)),
    [businesses, category],
  );
  const normalizedQuery = normalize(query.trim());
  const results = visibleBusinesses.filter((business) =>
    normalize(
      `${business.name} ${business.category} ${business.municipality} ${business.area}`,
    ).includes(normalizedQuery),
  );

  function chooseBusiness(business: Business) {
    setSelectedId(business.id);
    setQuery(business.name);
    setIsOpen(false);
  }

  return (
    <section className="section section-tight commerce-section" id="comercios">
      <div className="commerce-copy">
        <p className="eyebrow">Comercios locales</p>
        <h2>
          Descubre el<br className="commerce-break" />{" "}
          comercio de<br className="commerce-break" />{" "}
          <em>El Hierro.</em>
        </h2>
        <p className="commerce-intro">
          Cada puerta de la isla guarda un oficio, un sabor, una historia.<br className="commerce-break" />{" "}
          Acércate a tu comercio, elige con calma<br className="commerce-break" />{" "}
          y deja que tu bono se quede en El Hierro.
        </p>
        <div
          className="commerce-search"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
          }}
        >
          <div className="commerce-search-field">
            <Search size={20} aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar comercio, producto o zona"
              aria-controls="commerce-search-results"
              autoComplete="off"
              placeholder="Buscar comercio, producto o zona"
              value={query}
              onFocus={() => setIsOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedId(undefined);
                setIsOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setIsOpen(false);
                if (event.key === "Enter" && isOpen && results[0]) {
                  event.preventDefault();
                  chooseBusiness(results[0]);
                }
              }}
            />
            {query && (
              <button
                type="button"
                className="commerce-search-clear"
                aria-label="Limpiar búsqueda"
                onClick={() => {
                  setQuery("");
                  setSelectedId(undefined);
                  setIsOpen(true);
                }}
              >
                <X size={17} aria-hidden="true" />
              </button>
            )}
          </div>
          {isOpen && (
            <div className="commerce-search-results" id="commerce-search-results">
              <p>{results.length === 1 ? "1 comercio" : `${results.length} comercios`}</p>
              {results.length ? (
                <ul>
                  {results.map((business) => (
                    <li
                      key={business.id}
                      onMouseEnter={() => setHighlightedId(business.id)}
                      onMouseLeave={() => setHighlightedId(undefined)}
                    >
                      <button type="button" onClick={() => chooseBusiness(business)}>
                        <Store size={18} aria-hidden="true" />
                        <span>
                          <strong>{business.name}</strong>
                          <small>{business.category} · {business.municipality}</small>
                        </span>
                        <ArrowUpRight size={17} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="commerce-search-empty">No hay comercios que coincidan.</span>
              )}
            </div>
          )}
        </div>
        <div className="commerce-categories" aria-label="Categorías de comercios">
          {categories.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={category === label ? "active" : undefined}
              type="button"
              aria-pressed={category === label}
              onClick={() => {
                setCategory(label);
                setQuery("");
                setSelectedId(undefined);
                setIsOpen(false);
              }}
            >
              <Icon size={14} aria-hidden="true" />{label}
            </button>
          ))}
        </div>
      </div>
      <div className="commerce-map-panel">
        <BusinessMap
          businesses={visibleBusinesses}
          selectedId={selectedId}
          highlightedId={highlightedId}
          onSelect={(id) => setSelectedId(id ?? undefined)}
          hideToolbar
          zoomEnabled={false}
          showMunicipalities
          weatherTheme="light"
        />
      </div>
    </section>
  );
}
