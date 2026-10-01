import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { consumePublicCouponLookup } from "@/lib/coupon-lookup-limit";
import { demoWritesEnabled, getBusinessRecord, getCouponDetails, redeemCoupon } from "@/lib/store";
import { parseEuros } from "@/lib/bonos";

type Context = { params: Promise<{ code: string }> };

async function responseFor(code: string) {
  const details = await getCouponDetails(code);
  if (!details) return NextResponse.json({ error: "Bono no encontrado." }, { status: 404 });
  return NextResponse.json({
    coupon: details.coupon,
    raceName: details.race.name,
    businessName: (await getBusinessRecord(details.coupon.businessId))?.name ?? "Comercio no disponible",
    redemptions: details.redemptions,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) {
    const limit = await consumePublicCouponLookup(request.headers);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Has alcanzado el límite temporal de consultas. Espera unos minutos antes de intentarlo de nuevo." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } },
      );
    }
  }
  const { code } = await params;
  return responseFor(code);
}

export async function POST(request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sesión como comercio para registrar gastos." }, { status: 401 });
  if (!session.businessId) return NextResponse.json({ error: "Esta cuenta no tiene un comercio asignado." }, { status: 403 });
  if (!demoWritesEnabled()) return NextResponse.json({ error: "El registro de canjes requiere una base de datos persistente de producción." }, { status: 403 });
  const { code } = await params;
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
  }
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
  const { amount } = data as Record<string, unknown>;
  const cents = typeof amount === "string" ? parseEuros(amount) : null;
  if (cents === null) {
    return NextResponse.json({ error: "Indica un importe válido, con hasta dos decimales." }, { status: 400 });
  }
  try {
    await redeemCoupon(code, session.businessId, cents);
    return responseFor(code);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo registrar el canje." }, { status: 400 });
  }
}
