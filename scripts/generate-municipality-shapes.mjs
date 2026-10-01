// Genera iconos ligeros desde el GeoJSON local, sin cargar sus coordenadas en el navegador.
// Mismo método que el proyecto de Artesanía: proyección, escala uniforme y Douglas-Peucker.
import { readFile, writeFile } from "node:fs/promises";

const names = { 38048: "Valverde", 38013: "La Frontera", 38901: "El Pinar" };
const geo = JSON.parse(await readFile(new URL("../public/municipios-el-hierro.geojson", import.meta.url), "utf8"));

function area(ring) {
  return Math.abs(ring.reduce((sum, point, index) => {
    const previous = ring[(index + ring.length - 1) % ring.length];
    return sum + (previous[0] + point[0]) * (previous[1] - point[1]);
  }, 0) / 2);
}

function squaredDistance(point, start, end) {
  let [x, y] = start;
  const dx = end[0] - x, dy = end[1] - y;
  if (dx || dy) {
    const position = Math.max(0, Math.min(1, ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy)));
    x += position * dx;
    y += position * dy;
  }
  return (point[0] - x) ** 2 + (point[1] - y) ** 2;
}

function simplify(points, tolerance = 1.75) {
  const keep = new Set([0, points.length - 1]);
  const pending = [[0, points.length - 1]];
  while (pending.length) {
    const [first, last] = pending.pop();
    let furthest = -1, maximum = tolerance ** 2;
    for (let index = first + 1; index < last; index++) {
      const distance = squaredDistance(points[index], points[first], points[last]);
      if (distance > maximum) { maximum = distance; furthest = index; }
    }
    if (furthest !== -1) {
      keep.add(furthest);
      pending.push([first, furthest], [furthest, last]);
    }
  }
  return points.filter((_, index) => keep.has(index));
}

const shapes = {};
for (const feature of geo.features) {
  const name = names[feature.properties.codigo];
  if (!name) continue;
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const exteriors = polygons.map((polygon) => polygon[0]);
  const largest = Math.max(...exteriors.map(area));
  const rings = exteriors.filter((ring) => area(ring) >= largest * 0.05);
  const latitudes = rings.flatMap((ring) => ring.map((point) => point[1]));
  const latitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const factor = Math.cos(latitude * Math.PI / 180);
  const projected = rings.map((ring) => ring.map(([longitude, lat]) => [longitude * factor, -lat]));
  const points = projected.flat();
  const minX = Math.min(...points.map((point) => point[0])), maxX = Math.max(...points.map((point) => point[0]));
  const minY = Math.min(...points.map((point) => point[1])), maxY = Math.max(...points.map((point) => point[1]));
  const scale = Math.min(184 / (maxX - minX), 184 / (maxY - minY));
  const offsetX = (200 - (maxX - minX) * scale) / 2, offsetY = (200 - (maxY - minY) * scale) / 2;
  shapes[name] = projected.map((ring) => {
    const scaled = ring.map(([x, y]) => [(x - minX) * scale + offsetX, (y - minY) * scale + offsetY]);
    return `M ${simplify(scaled).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ")} Z`;
  }).join(" ");
}
if (Object.keys(shapes).length !== 3) throw new Error("El GeoJSON debe contener los tres municipios de El Hierro.");

await writeFile(new URL("../lib/municipality-shapes.ts", import.meta.url), [
  "// Generado por scripts/generate-municipality-shapes.mjs desde public/municipios-el-hierro.geojson.",
  "// Siluetas municipales normalizadas a viewBox 0 0 200 200.",
  'import type { Municipality } from "./types";',
  "",
  `export const municipalityShapes: Record<Municipality, string> = ${JSON.stringify(shapes, null, 2)};`,
  "",
].join("\n"));
console.log("Generadas las tres siluetas municipales.");
