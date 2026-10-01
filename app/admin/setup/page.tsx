import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthForm } from "@/components/AuthForm";
import { adminExists } from "@/lib/auth";
import { demoWritesEnabled } from "@/lib/store";
import { setupAdmin } from "@/app/auth-actions";
import "../../auth.css";

export const dynamic = "force-dynamic";
export default async function AdminSetupPage() {
  if (await adminExists() || !demoWritesEnabled()) redirect("/admin/login");
  return <>
    <Header />
    <AuthLayout eyebrow="Configuración inicial" title="Crear administrador" description="Crea la primera cuenta para este entorno local. Usa una contraseña exclusiva de al menos 12 caracteres.">
      <AuthForm action={setupAdmin} setup />
    </AuthLayout>
  </>;
}
