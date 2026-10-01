import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Accesibilidad | El Hierro Premia Deportistas",
  description: "Alternativas de acceso y canales para comunicar dificultades de accesibilidad.",
};

export default function Page() {
  return <LegalPage contentKey="legal.accessibility" />;
}
