import type { Metadata } from "next";
import { CommerceDirectory } from "@/components/CommerceDirectory";
import { Header } from "@/components/Header";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getLiveProps } from "@/lib/live";
import { liveScope } from "@/lib/live-scopes";
import { listBusinesses } from "@/lib/store";
import "./directory.css";

export const metadata: Metadata = {
  title: "Comercios de El Hierro | El Hierro Premia Deportistas",
  description: "Explora en el mapa los comercios participantes y consulta el listado por municipio.",
};

export const dynamic = "force-dynamic";

export default async function CommercePage() {
  const [live, businesses] = await Promise.all([getLiveProps([liveScope.public]), listBusinesses()]);
  return (
    <>
      <Header />
      <main className="directory-main">
        <CommerceDirectory businesses={businesses} />
      </main>
      <LiveRefresh {...live} audience="public" />
    </>
  );
}
