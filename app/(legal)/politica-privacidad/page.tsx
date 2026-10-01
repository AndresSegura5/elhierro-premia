import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacidad | El Hierro Premia Deportistas",
  description: "Tratamiento de datos, cuentas, consultas de bonos y derechos de las personas usuarias.",
};

export default function Page() {
  return <LegalPage contentKey="legal.privacy" />;
}
