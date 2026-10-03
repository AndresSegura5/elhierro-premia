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
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Sun,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type { Business } from "@/lib/types";
import type { Map as LeafletMap, Marker, Path as LeafletPath } from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE = "/branding/positron-sea.json";
const MAP_ATTRIBUTION = '<span class="map-attribution-copyright">&copy;</span> <a href="https://www.openmaptiles.org/">OpenMapTiles</a> · <span class="map-attribution-copyright">&copy;</span> <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MUNICIPALITY_LABEL_POSITIONS: Record<string, [number, number]> = {
  FRONTERA: [27.76, -18.07],
  VALVERDE: [27.83, -17.87],
  "EL PINAR": [27.68, -18.07],
};
type CoastSide = "north" | "south" | "east";
// On narrow maps the island fills the frame, so each label sits a fixed distance
// off its own stretch of coast, found where this line crosses the island outline.
const COMPACT_LABEL_COASTS: Record<string, { lat?: number; lng?: number; side: CoastSide }> = {
  FRONTERA: { lng: -18.07, side: "north" },
  "EL PINAR": { lng: -18.08, side: "south" },
  VALVERDE: { lat: 27.77, side: "east" },
};
const COMPACT_EAST_LABEL_WIDTH = 80;
const COMPACT_EAST_LABEL_MIN_LAT = 27.7;
const COMPACT_MAP_WIDTH = 720;
const COMPACT_LABEL_GAP = 10;
const COMPACT_LABEL_SIZE: [number, number] = [104, 24];

function coastPoint(coords: [number, number][], { lat, lng, side }: { lat?: number; lng?: number; side: CoastSide }) {
  const fixed = lng === undefined ? 0 : 1;
  const value = (lng ?? lat)!;
  const crossings: number[] = [];
  coords.forEach((a, index) => {
    const b = coords[(index + 1) % coords.length];
    if (a[fixed] === b[fixed] || (a[fixed] - value) * (b[fixed] - value) > 0) return;
    const t = (value - a[fixed]) / (b[fixed] - a[fixed]);
    crossings.push(a[1 - fixed] + t * (b[1 - fixed] - a[1 - fixed]));
  });
  if (!crossings.length) return undefined;
  const edge = side === "south" ? Math.min(...crossings) : Math.max(...crossings);
  return (fixed === 1 ? [edge, value] : [value, edge]) as [number, number];
}

function compactLabelAnchor(side: CoastSide): [number, number] {
  const [width, height] = COMPACT_LABEL_SIZE;
  if (side === "north") return [width / 2, height + COMPACT_LABEL_GAP];
  if (side === "south") return [width / 2, -COMPACT_LABEL_GAP];
  return [-COMPACT_LABEL_GAP, height / 2];
}

function weatherIconMarkup(code: number) {
  const Icon = code === 0 ? Sun
    : code <= 2 ? CloudSun
      : code === 3 || (code >= 45 && code <= 48) ? (code >= 45 ? CloudFog : Cloud)
        : code >= 95 ? CloudLightning
          : CloudRain;
  return renderToStaticMarkup(<Icon size={22} strokeWidth={2.2} aria-hidden="true" />);
}

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
  showMunicipalities = false,
  weatherTheme = "dark",
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
  showMunicipalities?: boolean;
  weatherTheme?: "dark" | "light";
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
      if (clipToIsland || showMunicipalities) {
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
      // Keep weather details outside Leaflet's clipped container so they can
      // expand over the map edge when a label sits near the side.
      const weatherPane = instance.createPane("weatherPane", element.current.parentElement ?? instance.getContainer());
      weatherPane.style.zIndex = "900";
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
      if ((clipToIsland || showMunicipalities) && municipalityGeoJson?.features?.length) {
        const municipalityWeather = new Map<string, {
          temperature: string;
          weatherCode: number;
        }>();
        if (showMunicipalities) {
          await Promise.all(
            ["Valverde", "Frontera", "El Pinar"].map(async (name) => {
              try {
                const response = await fetch(`/api/weather?municipality=${encodeURIComponent(name)}`);
                if (!response.ok) return;
                const data = await response.json();
                const temperature = data.current?.temperature_2m;
                if (typeof temperature === "number" && typeof data.current?.weather_code === "number") {
                  municipalityWeather.set(name.toUpperCase(), {
                    temperature: `${Math.round(temperature)}°C`,
                    weatherCode: data.current.weather_code,
                  });
                }
              } catch {
                // The boundaries remain useful if a weather request fails.
              }
            }),
          );
        }

        L.geoJSON(municipalityGeoJson, {
          style: {
            color: "#071626",
            weight: showMunicipalities ? 2 : 3,
            opacity: 0.95,
            fillColor: showMunicipalities ? "#8aa6b7" : "#071626",
            fillOpacity: showMunicipalities ? 0.1 : 0.02,
            fill: true,
          },
          onEachFeature: (feature, layer) => {
            const municipality = layer as LeafletPath;
            const rawName = String(feature.properties?.nombre ?? "").trim();
            const weather = municipalityWeather.get(rawName.toUpperCase());
            if (showMunicipalities && weather) {
              const coast = instance.getSize().x < COMPACT_MAP_WIDTH ? COMPACT_LABEL_COASTS[rawName.toUpperCase()] : undefined;
              let coastPosition = coast && coastPoint(islandCoords, coast);
              // Labels are placed before the map fits the island, so measure against that final view.
              // The east label slides down the coast until it fits inside the frame.
              if (coast?.side === "east" && coastPosition) {
                const islandBounds = L.latLngBounds(islandCoords);
                const padding = clipToIsland ? 12 : 24;
                const fitZoom = instance.getBoundsZoom(islandBounds, false, L.point(padding, padding)) + (clipToIsland ? 0.1 : 0);
                const frameRight = instance.project(islandBounds.getCenter(), fitZoom).x + instance.getSize().x / 2;
                while (coastPosition && coastPosition[0] > COMPACT_EAST_LABEL_MIN_LAT
                  && instance.project(coastPosition, fitZoom).x + COMPACT_LABEL_GAP + COMPACT_EAST_LABEL_WIDTH > frameRight) {
                  coastPosition = coastPoint(islandCoords, { ...coast, lat: coastPosition[0] - 0.005 });
                }
              }
              const labelPosition = coastPosition ?? MUNICIPALITY_LABEL_POSITIONS[rawName.toUpperCase()];
              const startAligned = Boolean(coastPosition) && coast?.side === "east";
              if (labelPosition) {
                L.marker(labelPosition, {
                  interactive: false,
                  keyboard: false,
                  pane: "weatherPane",
                  icon: L.divIcon({
                    className: "municipality-weather-label-marker",
                    html: `<span class="municipality-weather-label${weatherTheme === "light" ? " municipality-weather-label--light" : ""}${coastPosition ? " municipality-weather-label--coast" : ""}${startAligned ? " municipality-weather-label--start" : ""}"><span class="municipality-weather-icon">${weatherIconMarkup(weather.weatherCode)}</span><strong>${weather.temperature}</strong></span>`,
                    iconSize: coastPosition ? COMPACT_LABEL_SIZE : [104, 42],
                    iconAnchor: coast && coastPosition ? compactLabelAnchor(coast.side) : [52, 21],
                  }),
                }).addTo(instance);
              }
            }
            municipality.on({
              mouseover: () => municipality.setStyle({ fillColor: "#2563eb", fillOpacity: showMunicipalities ? 0.2 : 0.22 }),
              mouseout: () => municipality.setStyle({ fillColor: showMunicipalities ? "#8aa6b7" : "#071626", fillOpacity: showMunicipalities ? 0.1 : 0.02 }),
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
  }, [markerStyle, zoomEnabled, scrollWheelZoom, clipToIsland, showMunicipalities, weatherTheme]);

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
