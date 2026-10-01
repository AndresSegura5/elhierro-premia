import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Cookies | El Hierro Premia Deportistas",
  description: "Información sobre la cookie técnica de sesión y cómo gestionarla.",
};

export default function Page() {
  return <LegalPage contentKey="legal.cookies" />;
}
