import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isValidCouponCode } from "@/lib/coupon-code";
import { getLiveVersions } from "@/lib/live";
import { canSeeLiveScope, LIVE_MAX_SCOPES, needsSession, parseLiveScope, type LiveViewer } from "@/lib/live-scopes";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

// Devuelve solo números de versión de los ámbitos pedidos; nunca datos. Las pantallas lo
// consultan para saber si hay algo nuevo (y para ponerse al día tras una desconexión).
export async function GET(request: Request) {
  const raw = (new URL(request.url).searchParams.get("scopes") ?? "").split(",").map((scope) => scope.trim()).filter(Boolean);
  if (!raw.length || raw.length > LIVE_MAX_SCOPES) return NextResponse.json({ error: "Ámbitos no válidos." }, { status: 400, headers });
  const parsed = raw.map((scope) => ({ scope, parsed: parseLiveScope(scope) }));
  if (parsed.some((item) => !item.parsed || (item.parsed.kind === "coupon" && !isValidCouponCode(item.parsed.code)))) {
    return NextResponse.json({ error: "Ámbitos no válidos." }, { status: 400, headers });
  }

  let viewer: LiveViewer = null;
  if (parsed.some((item) => needsSession(item.parsed!))) {
    const session = await getSession();
    if (session?.role === "admin") viewer = { role: "admin" };
    else if (session?.role === "merchant" && session.businessId) viewer = { role: "merchant", businessId: session.businessId };
  }
  const denied = parsed.filter((item) => !canSeeLiveScope(item.parsed!, viewer)).map((item) => item.scope);
  if (denied.length) {
    // Sin sesión o sin permiso: la pantalla se recarga y el servidor decide qué mostrar (por ejemplo, el acceso).
    return NextResponse.json({ error: "Sesión no válida.", denied }, { status: viewer ? 403 : 401, headers });
  }

  try {
    return NextResponse.json({ versions: await getLiveVersions(raw) }, { headers });
  } catch {
    return NextResponse.json({ error: "No se pudo comprobar." }, { status: 503, headers });
  }
}
