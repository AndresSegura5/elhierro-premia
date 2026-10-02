"use client";
import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ArrowUpRight,
  Clock3,
  Dumbbell,
  Hammer,
  HeartPulse,
  MapPin,
  Shirt,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type { Business } from "@/lib/types";
import type { Map as LeafletMap, Marker, Path as LeafletPath } from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE = "/branding/positron-sea.json";
const MAP_ATTRIBUTION = '<span class="map-attribution-copyright">&copy;</span> <a href="https://www.openmaptiles.org/">OpenMapTiles</a> · <span class="map-attribution-copyright">&copy;</span> <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function iconForBusiness(category: string) {
  const name = category.toLowerCase();
  if (name.includes("aliment") || name.includes("producto")) return ShoppingBasket;
  if (name.includes("deport")) return Dumbbell;
  if (name.includes("restaur") || name.includes("gastronom")) return UtensilsCrossed;
  if (name.includes("salud") || name.includes("farmacia")) return HeartPulse;
  if (name.includes("artesan")) return Hammer;
  if (name.includes("moda")) return Shirt;
  return Store;
}

function cardPositionFor(point: { x: number; y: number }, size: { x: number; y: number }) {
  const width = Math.min(286, size.x - 24);
  const gap = 16;
  const fitsRight = point.x + width + gap <= size.x - 12;
  const fitsLeft = point.x - width - gap >= 12;
  const side = fitsRight ? "right" : fitsLeft ? "left" : "over";
  const left = fitsRight
    ? point.x + gap
    : fitsLeft
      ? point.x - width - gap
      : point.x > size.x / 2 ? 12 : size.x - width - 12;
  return {
    x: Math.max(12, Math.min(left, size.x - width - 12)),
    y: Math.max(150, Math.min(point.y, size.y - 150)),
    side,
  };
}

export function IslandMap({
  businesses,
  activeId,
  highlightedId,
  onSelect,
  markerStyle = "icon",
  visibleBusinessIds,
  zoomEnabled = true,
  scrollWheelZoom = false,
  clipToIsland = true,
}: {
  businesses: Business[];
  activeId?: string;
  highlightedId?: string;
  onSelect: (id: string | null) => void;
  markerStyle?: "icon" | "dot";
  visibleBusinessIds?: ReadonlySet<string>;
  zoomEnabled?: boolean;
  scrollWheelZoom?: boolean;
  clipToIsland?: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const markerBusinesses = useRef<Map<string, Business>>(new Map());
  const businessesRef = useRef(businesses);
  const visibleBusinessIdsRef = useRef(visibleBusinessIds);
  const syncMarkersRef = useRef<((items: Business[], visibleIds?: ReadonlySet<string>) => void) | null>(null);
  const onSelectRef = useRef(onSelect);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredId, setHoveredId] = useState<string | undefined>();
  const displayedId = hoveredId ?? activeId;
  const activeIdRef = useRef(displayedId);
  const highlightedIdRef = useRef(highlightedId);
  const [cardPosition, setCardPosition] = useState<ReturnType<typeof cardPositionFor> | null>(null);
  onSelectRef.current = onSelect;
  businessesRef.current = businesses;
  visibleBusinessIdsRef.current = visibleBusinessIds;
  activeIdRef.current = displayedId;
  highlightedIdRef.current = highlightedId;
  const activeBusiness = displayedId
    ? businesses.find((business) => business.id === displayedId)
    : undefined;

  useEffect(() => {
    markers.current.forEach((marker, id) => {
      const markerSpan = marker.getElement()?.querySelector("span");
      markerSpan?.classList.toggle("selected", id === displayedId);
      markerSpan?.classList.toggle("highlighted", id === highlightedId);
    });
    if (!activeBusiness || !map.current || !element.current) return;
    const point = map.current.latLngToContainerPoint([activeBusiness.lat, activeBusiness.lng]);
    setCardPosition(cardPositionFor(point, map.current.getSize()));
  }, [displayedId, highlightedId, activeBusiness]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;
    let layoutFrame = 0;
    let instanceForCleanup: LeafletMap | null = null;
    let updateIslandClip = () => {};
    let islandMapPane: HTMLElement | null = null;

    (async () => {
      let islandCoords: [number, number][] = [];
      let municipalityGeoJson: any = null;
      try {
        const response = await fetch("/el-hierro.geojson");
        const data = await response.json();
        const feature = data.features?.[0];
        if (feature?.geometry?.type === "Polygon") {
          islandCoords = feature.geometry.coordinates[0].map(
            ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
          );
        }
      } catch {
        islandCoords = [];
      }
      if (clipToIsland) {
        try {
          const response = await fetch("/municipios-el-hierro.geojson");
          const data = await response.json();
          municipalityGeoJson = data;
        } catch {
          municipalityGeoJson = null;
        }
      }

      if (disposed || !element.current) return;
      const [L, { maplibreGL }, { setWorkerUrl }] = await Promise.all([
        import("leaflet"),
        import("@maplibre/maplibre-gl-leaflet"),
        import("maplibre-gl"),
      ]);
      if (disposed || !element.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

      const instance = L.map(element.current, {
        scrollWheelZoom,
        zoomControl: false,
        doubleClickZoom: zoomEnabled,
        touchZoom: zoomEnabled,
        boxZoom: zoomEnabled,
        keyboard: zoomEnabled,
        dragging: zoomEnabled,
        attributionControl: false,
        minZoom: 1,
        maxZoom: 20,
        zoomSnap: clipToIsland ? 0.1 : 1,
        zoomDelta: 1,
      }).setView([27.75, -17.98], 11);
      map.current = instance;
      instanceForCleanup = instance;
      if (zoomEnabled) {
        L.control.zoom({ position: clipToIsland ? "topright" : "bottomright" }).addTo(instance);
      }
      L.control.attribution({ position: "bottomleft", prefix: false })
        .addTo(instance).addAttribution(MAP_ATTRIBUTION);
      maplibreGL({ style: MAP_STYLE, attributionControl: false }).addTo(instance);

      if (clipToIsland && islandCoords.length) {
        islandMapPane = instance.getPanes().mapPane as HTMLElement;
        const clipStride = Math.max(1, Math.ceil(islandCoords.length / 1000));
        const clipCoords = islandCoords.filter((_, index) => index % clipStride === 0);
        updateIslandClip = () => {
          const size = instance.getSize();
          islandMapPane!.style.width = `${size.x}px`;
          islandMapPane!.style.height = `${size.y}px`;
          islandMapPane!.style.clipPath = `polygon(${clipCoords
            .map(([lat, lng]) => {
              const point = instance.latLngToLayerPoint([lat, lng]);
              return `${(point.x / size.x) * 100}% ${(point.y / size.y) * 100}%`;
            })
            .join(", ")})`;
        };
        instance.on("move zoom resize", updateIslandClip);
        updateIslandClip();
      }

      if (clipToIsland && islandCoords.length) {
        L.polygon(islandCoords, {
          color: "#071626",
          weight: 4,
          opacity: 0.95,
          fill: false,
        }).addTo(instance);
      }
      if (clipToIsland && municipalityGeoJson?.features?.length) {
        L.geoJSON(municipalityGeoJson, {
          style: {
            color: "#071626",
            weight: 3,
            opacity: 0.95,
            fillColor: "#071626",
            fillOpacity: 0.02,
            fill: true,
          },
          onEachFeature: (_feature, layer) => {
            const municipality = layer as LeafletPath;
            municipality.on({
              mouseover: () => municipality.setStyle({ fillColor: "#071626", fillOpacity: 0.22 }),
              mouseout: () => municipality.setStyle({ fillColor: "#071626", fillOpacity: 0.02 }),
            });
          },
        }).addTo(instance);
      }

      const syncMarkers = (items: Business[], visibleIds?: ReadonlySet<string>) => {
        const nextIds = new Set(items.map((business) => business.id));
        markers.current.forEach((marker, id) => {
          if (nextIds.has(id)) return;
          marker.off();
          instance.removeLayer(marker);
          markers.current.delete(id);
          markerBusinesses.current.delete(id);
        });

        items.forEach((business) => {
          let marker = markers.current.get(business.id);
          const Icon = iconForBusiness(business.category);
          const icon = L.divIcon({
            className: "island-marker",
            html: `<span class="${markerStyle === "dot" ? "directory-dot " : ""}${business.id === activeIdRef.current ? "selected " : ""}${business.id === highlightedIdRef.current ? "highlighted" : ""}">${markerStyle === "icon" ? renderToStaticMarkup(<Icon size={19} strokeWidth={2.4} aria-hidden="true" />) : ""}</span>`,
            iconSize: markerStyle === "dot" ? [16, 16] : [38, 38],
            iconAnchor: markerStyle === "dot" ? [8, 8] : [19, 36],
          });

          if (marker) {
            marker.setLatLng([business.lat, business.lng]);
            if (markerBusinesses.current.get(business.id) !== business) marker.setIcon(icon);
          } else {
            marker = L.marker([business.lat, business.lng], { icon }).addTo(instance);
            marker.on("mouseover", () => {
              if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
              setHoveredId(business.id);
            });
            marker.on("mouseout", () => {
              hoverCloseTimer.current = setTimeout(() => setHoveredId(undefined), 250);
            });
            marker.on("click", () => onSelectRef.current(business.id));
            markers.current.set(business.id, marker);
          }
          markerBusinesses.current.set(business.id, business);

          const isVisible = !visibleIds || visibleIds.has(business.id);
          marker.setOpacity(isVisible ? 1 : 0);
          const markerElement = marker.getElement();
          markerElement?.setAttribute("aria-label", business.name);
          markerElement?.setAttribute("aria-hidden", String(!isVisible));
          if (markerElement) markerElement.style.pointerEvents = isVisible ? "auto" : "none";
        });
      };
      syncMarkersRef.current = syncMarkers;
      syncMarkers(businessesRef.current, visibleBusinessIdsRef.current);

      const updateCardPosition = () => {
        const selectedBusiness = activeIdRef.current
          ? businessesRef.current.find((business) => business.id === activeIdRef.current)
          : undefined;
        if (!selectedBusiness) {
          setCardPosition(null);
          return;
        }

        const point = instance.latLngToContainerPoint([selectedBusiness.lat, selectedBusiness.lng]);
        const size = instance.getSize();
        // Keep the card attached to the marker, and hide it while its marker is
        // outside the visible map area instead of leaving the card stranded at an edge.
        if (point.x < 0 || point.y < 0 || point.x > size.x || point.y > size.y) {
          setCardPosition(null);
          return;
        }
        setCardPosition(cardPositionFor(point, size));
      };
      instance.on("move zoom resize", updateCardPosition);

      const fitView = () => {
        if (islandCoords.length) {
          instance.fitBounds(
            L.latLngBounds(islandCoords.map(([lat, lng]) => L.latLng(lat, lng))),
            { padding: clipToIsland ? [12, 12] : [24, 24], animate: false },
          );
          if (clipToIsland) instance.setZoom(instance.getZoom() + 0.1, { animate: false });
        } else if (businessesRef.current.length) {
          instance.fitBounds(
            L.latLngBounds(businessesRef.current.map((b) => [b.lat, b.lng])),
            { padding: [45, 45], maxZoom: 12 },
          );
        }
      };
      const updateLayout = () => {
        cancelAnimationFrame(layoutFrame);
        layoutFrame = requestAnimationFrame(() => {
          if (disposed) return;
          instance.invalidateSize({ pan: false });
          fitView();
          updateIslandClip();
          updateCardPosition();
        });
      };
      instance.whenReady(updateLayout);
      resizeObserver = new ResizeObserver(updateLayout);
      resizeObserver.observe(element.current);
    })();

    return () => {
      disposed = true;
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
      cancelAnimationFrame(layoutFrame);
      resizeObserver?.disconnect();
      instanceForCleanup?.off("move zoom resize", updateIslandClip);
      if (islandMapPane) {
        islandMapPane.style.width = "";
        islandMapPane.style.height = "";
        islandMapPane.style.clipPath = "";
      }
      syncMarkersRef.current = null;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
      markerBusinesses.current.clear();
    };
  }, [markerStyle, zoomEnabled, scrollWheelZoom, clipToIsland]);

  useEffect(() => {
    syncMarkersRef.current?.(businesses, visibleBusinessIds);
  }, [businesses, visibleBusinessIds, markerStyle]);

  return (
    <div className="island-map-stage">
      <div
        className="island-map"
        ref={element}
        role="region"
        aria-label="Ubicación de los comercios en El Hierro"
      />
      {activeBusiness && cardPosition ? (
        <article
          className={`business-map-card business-map-card--${cardPosition.side}`}
          style={{ left: cardPosition.x, top: cardPosition.y }}
          aria-label={`Información de ${activeBusiness.name}`}
          onMouseEnter={() => {
            if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
          }}
          onMouseLeave={() => setHoveredId(undefined)}
        >
          <div className="business-map-card-top">
            <button
              className="business-map-card-close"
              type="button"
              aria-label="Cerrar información del comercio"
              onClick={() => {
                setHoveredId(undefined);
                setCardPosition(null);
                onSelect(null);
              }}
            >
              <X size={17} aria-hidden="true" />
            </button>
            <div className="business-map-card-heading">
              <div>
                <p className="business-map-card-kicker">{activeBusiness.category}</p>
                <h3>{activeBusiness.name}</h3>
              </div>
            </div>
          </div>
          <div className="business-map-card-body">
            <p className="business-map-card-description">{activeBusiness.description}</p>
            <dl>
              <div>
                <dt><MapPin size={16} aria-hidden="true" /> Dirección</dt>
                <dd>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${activeBusiness.name}, ${activeBusiness.address}, El Hierro`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ver ${activeBusiness.name} en Google Maps`}
                  >
                    {activeBusiness.address}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </dd>
              </div>
              <div>
                <dt><Clock3 size={16} aria-hidden="true" /> Horario</dt>
                <dd>{activeBusiness.openingHours}</dd>
              </div>
            </dl>
          </div>
        </article>
      ) : null}
    </div>
  );
}
