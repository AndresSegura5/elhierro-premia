import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthForm } from "@/components/AuthForm";
import { getSession } from "@/lib/auth";
import { loginMerchant } from "@/app/auth-actions";
import "../../auth.css";

export const dynamic = "force-dynamic";
export default async function MerchantLoginPage() {
  if ((await getSession())?.businessId) redirect("/comercio");
  return <>
    <Header />
    <AuthLayout eyebrow="Acceso de comercios" title="Área de comercios" description="Consulta bonos, registra compras y revisa los movimientos de tu negocio.">
      <AuthForm action={loginMerchant} />
    </AuthLayout>
  </>;
}
