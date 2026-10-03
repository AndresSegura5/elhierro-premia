import type { ReactNode } from "react";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getSession } from "@/lib/auth";
import { getLiveProps } from "@/lib/live";
import { liveScope } from "@/lib/live-scopes";

export const dynamic = "force-dynamic";

// El área del comercio se actualiza sola: movimientos de cualquier móvil de la tienda y cambios del administrador.
export default async function MerchantLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const live = session?.role === "merchant" && session.businessId
    ? await getLiveProps([liveScope.business(session.businessId), liveScope.merchants])
    : null;
  return (
    <>
      {children}
      {live && <LiveRefresh {...live} audience="merchant" indicator />}
    </>
  );
}
