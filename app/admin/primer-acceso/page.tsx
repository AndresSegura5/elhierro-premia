import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { AuthLayout } from "@/components/AuthLayout";
import { FirstAdminPasswordForm } from "@/components/AdminAccounts";
import { setFirstAdminPassword } from "@/app/admin/admin-account-actions";
import { getSession } from "@/lib/auth";
import "../../auth.css";

export const dynamic = "force-dynamic";

export default async function AdminFirstAccessPage() {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/admin/login");
  if (!session.mustChangePassword) redirect("/admin/carreras");
  return <>
    <Header username={session.username} isAdmin />
    <AuthLayout eyebrow="Primer acceso" title="Crea tu contraseña" description="Establece una contraseña personal de al menos 12 caracteres. La clave temporal dejará de funcionar al guardar.">
      <FirstAdminPasswordForm action={setFirstAdminPassword} />
    </AuthLayout>
  </>;
}
