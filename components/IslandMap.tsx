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
  Phone,
  Shirt,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type { Business } from "@/lib/types";
import { localPhoneNumber, phoneLink } from "@/lib/phone";
import type { Map as LeafletMap, Marker, TileLayerOptions } from "leaflet";
import "leaflet/dist/leaflet.css";

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
  onSelect,
  basemap = "satellite",
  markerStyle = "icon",
  zoomEnabled = true,
}: {
  businesses: Business[];
  activeId?: string;
  onSelect: (id: string | null) => void;
  basemap?: "satellite" | "street";
  markerStyle?: "icon" | "dot";
  zoomEnabled?: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredId, setHoveredId] = useState<string | undefined>();
  const displayedId = hoveredId ?? activeId;
  const activeIdRef = useRef(displayedId);
  const [cardPosition, setCardPosition] = useState<ReturnType<typeof cardPositionFor> | null>(null);
  onSelectRef.current = onSelect;
  activeIdRef.current = displayedId;
  const activeBusiness = displayedId
    ? businesses.find((business) => business.id === displayedId)
    : undefined;

  useEffect(() => {
    markers.current.forEach((marker, id) => {
      marker.getElement()?.querySelector("span")?.classList.toggle("selected", id === displayedId);
    });
    if (!activeBusiness || !map.current || !element.current) return;
    const point = map.current.latLngToContainerPoint([activeBusiness.lat, activeBusiness.lng]);
    setCardPosition(cardPositionFor(point, map.current.getSize()));
  }, [displayedId, activeBusiness]);

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
      if (basemap === "satellite") {
        try {
          const response = await fetch("/municipios-el-hierro.geojson");
          const data = await response.json();
          municipalityGeoJson = data;
        } catch {
          municipalityGeoJson = null;
        }
      }

      if (disposed || !element.current) return;
      const L = await import("leaflet");
      if (disposed || !element.current) return;

      const instance = L.map(element.current, {
        scrollWheelZoom: false,
        zoomControl: false,
        doubleClickZoom: zoomEnabled,
        touchZoom: zoomEnabled,
        boxZoom: zoomEnabled,
        keyboard: zoomEnabled,
        dragging: zoomEnabled,
        attributionControl: false,
        zoomSnap: 0.1,
        zoomDelta: 1,
      }).setView([27.75, -17.98], 11);
      map.current = instance;
      instanceForCleanup = instance;
      if (zoomEnabled) {
        L.control.zoom({ position: basemap === "street" ? "bottomright" : "topright" }).addTo(instance);
      }
      L.control.attribution({ position: basemap === "street" ? "bottomleft" : "bottomright" }).addTo(instance);
      if (basemap === "street") {
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 19,
          attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
        }).addTo(instance);
      } else {
        const satelliteOptions: TileLayerOptions & { ext: string } = {
          minZoom: 0,
          maxZoom: 20,
          maxNativeZoom: 20,
          keepBuffer: 2,
          attribution:
            "&copy; CNES, Distribution Airbus DS, &copy; Airbus DS, &copy; PlanetObserver (Contains Copernicus Data) | &copy; <a href=\"https://www.stadiamaps.com/\" target=\"_blank\">Stadia Maps</a> &copy; <a href=\"https://openmaptiles.org/\" target=\"_blank\">OpenMapTiles</a> &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
          ext: "jpg",
        };
        L.tileLayer(
          "https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}@2x.{ext}",
          satelliteOptions,
        ).addTo(instance);
      }

      if (islandCoords.length) {
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

      if (islandCoords.length) {
        L.polygon(islandCoords, {
          color: basemap === "satellite" ? "#ff7a1a" : "#d9edf7",
          weight: basemap === "satellite" ? 3 : 2.5,
          opacity: basemap === "satellite" ? 1 : 0.85,
          fillColor: basemap === "satellite" ? "#ff7a1a" : "#eaf6fc",
          fillOpacity: basemap === "satellite" ? 0.08 : 0.13,
        }).addTo(instance);
      }
      if (basemap === "satellite" && municipalityGeoJson?.features?.length) {
        L.geoJSON(municipalityGeoJson, {
          style: {
            color: "#ff7a1a",
            weight: 2,
            opacity: 0.95,
            fill: false,
          },
          onEachFeature: (feature, layer) => {
            const name = feature.properties?.nombre;
            if (name) layer.bindTooltip(name, { sticky: true });
          },
        }).addTo(instance);
      }

      businesses.forEach((business) => {
        const Icon = iconForBusiness(business.category);
        const marker = L.marker([business.lat, business.lng], {
          icon: L.divIcon({
            className: "island-marker",
            html: `<span class="${markerStyle === "dot" ? "directory-dot " : ""}${business.id === activeIdRef.current ? "selected" : ""}">${markerStyle === "icon" ? renderToStaticMarkup(<Icon size={19} strokeWidth={2.4} aria-hidden="true" />) : ""}</span>`,
            iconSize: markerStyle === "dot" ? [16, 16] : [38, 38],
            iconAnchor: markerStyle === "dot" ? [8, 8] : [19, 36],
          }),
        }).addTo(instance);
        marker.getElement()?.setAttribute("aria-label", business.name);
        markers.current.set(business.id, marker);
        marker.on("mouseover", () => {
          if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
          setHoveredId(business.id);
        });
        marker.on("mouseout", () => {
          hoverCloseTimer.current = setTimeout(() => setHoveredId(undefined), 250);
        });
        marker.on("click", () => {
          onSelectRef.current(business.id);
        });
      });

      const fitView = () => {
        if (islandCoords.length) {
          instance.fitBounds(
            L.latLngBounds(islandCoords.map(([lat, lng]) => L.latLng(lat, lng))),
            { padding: basemap === "street" ? [24, 24] : [12, 12], animate: false },
          );
          if (basemap === "satellite") instance.setZoom(instance.getZoom() + 0.1, { animate: false });
        } else if (businesses.length) {
          instance.fitBounds(
            L.latLngBounds(businesses.map((b) => [b.lat, b.lng])),
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
          const selectedBusiness = activeIdRef.current
            ? businesses.find((business) => business.id === activeIdRef.current)
            : undefined;
          if (selectedBusiness) {
            const point = instance.latLngToContainerPoint(
              L.latLng(selectedBusiness.lat, selectedBusiness.lng),
            );
            setCardPosition(cardPositionFor(point, instance.getSize()));
          }
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
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
  }, [businesses, basemap, markerStyle, zoomEnabled]);

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
                <dd>{activeBusiness.address}</dd>
              </div>
              <div>
                <dt><Clock3 size={16} aria-hidden="true" /> Horario</dt>
                <dd>{activeBusiness.openingHours}</dd>
              </div>
            </dl>
            <a className="business-map-card-phone" href={phoneLink(activeBusiness.phone)}>
              <Phone size={16} aria-hidden="true" />
              <span>{localPhoneNumber(activeBusiness.phone)}</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </article>
      ) : null}
    </div>
  );
}
