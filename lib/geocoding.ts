import "server-only";
import { getGeocodingCache, saveGeocodingCache } from "@/lib/store";
import type { Municipality } from "@/lib/types";

const EL_HIERRO_VIEWBOX = "-18.25,27.84,-17.85,27.60";
let requestQueue = Promise.resolve();
let lastRequestAt = 0;

async function waitForNominatimTurn() {
  const turn = requestQueue.then(async () => {
    const waitMs = Math.max(0, 1000 - (Date.now() - lastRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastRequestAt = Date.now();
  });
  requestQueue = turn.catch(() => undefined);
  await turn;
}

export async function locateBusinessAddress(address: string, municipality: Municipality) {
  const cleanAddress = address.trim().replace(/\s+/g, " ");
  const query = [cleanAddress, municipality, "Spain"].filter(Boolean).join(", ");
  const cacheKey = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const cached = await getGeocodingCache(cacheKey);
  if (cached) return cached;

  const endpoint = process.env.BONOS_GEOCODER_URL ?? "https://nominatim.openstreetmap.org/search";
  const addressWithoutMunicipality = cleanAddress.split(",").map((part) => part.trim()).filter((part) => part && part.toLocaleLowerCase("es") !== municipality.toLocaleLowerCase("es")).join(", ");
  const addressWithoutStreetType = addressWithoutMunicipality.replace(/^(calle|c\/|c\.|avenida|avda?\.?|carretera|camino|plaza|paseo|travesía|travesia|urbanización|urbanizacion)\s+/i, "").trim();
  // Don't put El Hierro/Canarias in the query: Nominatim already knows the
  // municipality hierarchy, and those extra terms can make valid streets fail.
  // The viewbox boosts island results without excluding them; the coordinate
  // check still prevents an off-island pin.
  const searches = [
    { q: query },
    { q: [addressWithoutStreetType, municipality, "Spain"].filter(Boolean).join(", ") },
    { street: addressWithoutMunicipality, city: municipality, country: "Spain" },
  ];
  let lastError: Error | null = null;

  for (const search of searches) {
    await waitForNominatimTurn();
    const url = new URL(endpoint);
    for (const [key, value] of Object.entries(search)) {
      if (value) url.searchParams.set(key, value);
    }
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "es");
    url.searchParams.set("viewbox", EL_HIERRO_VIEWBOX);
    url.searchParams.set("accept-language", "es");

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": process.env.BONOS_GEOCODER_USER_AGENT ?? "ElHierroPremia/1.0 (business address geocoding)",
        },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
    } catch {
      lastError = new Error("No se pudo consultar el servicio de mapas. Revisa la conexión e inténtalo de nuevo.");
      continue;
    }
    if (!response.ok) {
      lastError = response.status === 429
        ? new Error("El servicio de mapas está recibiendo demasiadas consultas. Espera un momento e inténtalo de nuevo.")
        : new Error("El servicio de mapas no está disponible ahora. Inténtalo de nuevo más tarde.");
      continue;
    }

    let results: Array<{ lat?: string; lon?: string }>;
    try {
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) throw new Error("Invalid geocoding response");
      results = payload as Array<{ lat?: string; lon?: string }>;
    } catch {
      lastError = new Error("El servicio de mapas devolvió una respuesta no válida. Inténtalo de nuevo.");
      continue;
    }
    const result = results.find((candidate) => {
      const lat = Number(candidate.lat);
      const lng = Number(candidate.lon);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 27.59 && lat <= 27.86 && lng >= -18.26 && lng <= -17.82;
    });
    if (result) {
      const location = { lat: Number(result.lat), lng: Number(result.lon) };
      await saveGeocodingCache(cacheKey, location);
      return location;
    }
  }

  if (lastError) throw lastError;
  throw new Error("No encontramos esa calle automáticamente. Prueba con la dirección y el municipio o haz clic en el mapa para colocar el punto.");
}
