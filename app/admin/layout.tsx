import type { ReactNode } from "react";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getSession } from "@/lib/auth";
import { getLiveProps } from "@/lib/live";
import { liveScope } from "@/lib/live-scopes";

export const dynamic = "force-dynamic";

// Todas las pantallas de administración se actualizan solas cuando cambia algo.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const live = session?.role === "admin" && !session.mustChangePassword ? await getLiveProps([liveScope.admin]) : null;
  return (
    <>
      {children}
      {live && <LiveRefresh {...live} audience="admin" indicator />}
    </>
  );
}
