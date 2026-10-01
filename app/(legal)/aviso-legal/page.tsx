import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Aviso legal | El Hierro Premia Deportistas",
  description: "Titularidad, contacto y condiciones de uso de El Hierro Premia Deportistas.",
};

export default function Page() {
  return <LegalPage contentKey="legal.notice" />;
}
