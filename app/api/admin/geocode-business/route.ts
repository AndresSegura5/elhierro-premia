import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { locateBusinessAddress } from "@/lib/geocoding";
import type { Municipality } from "@/lib/types";
import { isSameOriginMutation } from "@/lib/request-security";

const municipalities: Municipality[] = ["Valverde", "La Frontera", "El Pinar"];

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Solicitud no autorizada." }, { status: 403 });
  const session = await getSession();
  if (session?.role !== "admin" || session.mustChangePassword) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null) as { address?: unknown; municipality?: unknown } | null;
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  const municipality = body?.municipality;
  if (!address || address.length > 150 || !municipalities.includes(municipality as Municipality)) {
    return NextResponse.json({ error: "Indica una dirección y un municipio válidos." }, { status: 400 });
  }

  try {
    const location = await locateBusinessAddress(address, municipality as Municipality);
    return NextResponse.json(location);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo localizar la dirección." }, { status: 422 });
  }
}
