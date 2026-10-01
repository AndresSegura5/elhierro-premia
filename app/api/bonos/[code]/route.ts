import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { consumeAuthenticatedCouponLookup, consumePublicCouponLookup } from "@/lib/coupon-lookup-limit";
import { consumeRequestLimit } from "@/lib/request-limit";
import { isSameOriginMutation, validIdempotencyKey } from "@/lib/request-security";
import { isValidCouponCode } from "@/lib/coupon-code";
import { demoWritesEnabled, getBusinessRecord, getCouponDetails, redeemCoupon } from "@/lib/store";
import { parseEuros } from "@/lib/bonos";

type Context = { params: Promise<{ code: string }> };

async function responseFor(code: string, businessId?: string | null) {
  if (!isValidCouponCode(code.trim().toUpperCase())) return NextResponse.json({ error: "Bono no encontrado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const details = await getCouponDetails(code);
  if (!details || (businessId && details.coupon.businessId !== businessId)) return NextResponse.json({ error: "Bono no encontrado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({
    coupon: details.coupon,
    raceName: details.race.name,
    businessName: (await getBusinessRecord(details.coupon.businessId))?.name ?? "Comercio no disponible",
    redemptions: details.redemptions,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, { params }: Context) {
  const session = await getSession();
  {
    const limit = session ? await consumeAuthenticatedCouponLookup(session.id) : await consumePublicCouponLookup(request.headers);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Has alcanzado el límite temporal de consultas. Espera unos minutos antes de intentarlo de nuevo." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } },
      );
    }
  }
  const { code } = await params;
  return responseFor(code, session?.role === "merchant" ? session.businessId : null);
}

export async function POST(request: Request, { params }: Context) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Solicitud no autorizada." }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sesión como comercio para registrar gastos." }, { status: 401 });
  if (session.role !== "merchant") return NextResponse.json({ error: "Inicia sesión como comercio para registrar gastos." }, { status: 403 });
  if (!session.businessId) return NextResponse.json({ error: "Esta cuenta no tiene un comercio asignado." }, { status: 403 });
  const limit = await consumeRequestLimit("redeem-user", String(session.id), 30, 60);
  if (!limit.allowed) return NextResponse.json({ error: "Demasiadas operaciones. Espera antes de volver a intentarlo." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } });
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!validIdempotencyKey(idempotencyKey)) return NextResponse.json({ error: "Falta un identificador válido para la compra. Actualiza la página." }, { status: 400 });
  if (!demoWritesEnabled()) return NextResponse.json({ error: "El registro de canjes requiere una base de datos persistente de producción." }, { status: 403 });
  const { code } = await params;
  if (!isValidCouponCode(code.trim().toUpperCase())) return NextResponse.json({ error: "Bono no encontrado." }, { status: 404 });
  let data: unknown;
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json") || Number(request.headers.get("content-length") ?? 0) > 1024) throw new Error("Invalid body");
    const body = await request.text();
    if (body.length > 1024) throw new Error("Invalid body");
    data = JSON.parse(body);
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
    await redeemCoupon(code, session.businessId, cents, new Date(), idempotencyKey);
    return responseFor(code, session.businessId);
  } catch (error) {
    if (error instanceof Error && error.message === "Este bono pertenece a otro comercio.") return NextResponse.json({ error: "Bono no encontrado." }, { status: 404 });
    const message = error instanceof Error && error.name !== "PostgresError" ? error.message : "No se pudo registrar el canje.";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
