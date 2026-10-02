import { NextRequest, NextResponse } from "next/server";

const MUNICIPALITY_POINTS: Record<string, { latitude: number; longitude: number; name: string }> = {
  VALVERDE: { latitude: 27.8062, longitude: -17.9158, name: "Valverde" },
  FRONTERA: { latitude: 27.7527, longitude: -18.0042, name: "La Frontera" },
  "EL PINAR": { latitude: 27.7017, longitude: -18.0067, name: "El Pinar" },
};

function getPoint(request: NextRequest) {
  const municipality = request.nextUrl.searchParams.get("municipality")?.trim().toUpperCase();
  return (municipality && MUNICIPALITY_POINTS[municipality]) || {
    latitude: 27.75,
    longitude: -18,
    name: "El Hierro",
  };
}

export async function GET(request: NextRequest) {
  const point = getPoint(request);
  const params = new URLSearchParams({
    latitude: String(point.latitude),
    longitude: String(point.longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    timezone: "Atlantic/Canary",
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "No se pudo consultar el tiempo" }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json({
      municipality: point.name,
      current: data.current,
      units: data.current_units,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar el tiempo" }, { status: 502 });
  }
}
