import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthForm } from "@/components/AuthForm";
import { adminExists, getSession } from "@/lib/auth";
import { demoWritesEnabled } from "@/lib/store";
import { loginAdmin } from "@/app/auth-actions";
import "../../auth.css";

export const dynamic = "force-dynamic";
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ creada?: string }> }) {
  if (!(await adminExists()) && demoWritesEnabled()) redirect("/admin/setup");
  const session = await getSession();
  if (session?.role === "admin") redirect(session.mustChangePassword ? "/admin/primer-acceso" : "/admin/carreras");
  const params = await searchParams;
  return <>
    <Header />
    <AuthLayout eyebrow="Acceso de organización" title="Administración" description="Gestiona las carreras, la emisión de bonos y los comercios participantes." switchHref="/comercio/login" switchLabel="Acceso para comercios">
      {!demoWritesEnabled() && <p className="admin-notice admin-notice--error">La autenticación de producción estará disponible al conectar la base de datos persistente.</p>}
      {params.creada === "1" && <p className="admin-notice">Cuenta creada. Ya puedes iniciar sesión.</p>}
      <AuthForm action={loginAdmin} identifierLabel="Correo electrónico o usuario" />
    </AuthLayout>
  </>;
}
