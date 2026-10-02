import type { Metadata } from "next";
import { AdminSectionNav } from "@/components/AdminSectionNav";
import { AdminAccounts } from "@/components/AdminAccounts";
import { Header } from "@/components/Header";
import { listAdminAccounts, requireAdmin } from "@/lib/auth";
import { demoWritesEnabled } from "@/lib/store";
import "../admin.css";

export const metadata: Metadata = { title: "Administradores | El Hierro Premia Deportistas" };
export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  const session = await requireAdmin();
  const accounts = (await listAdminAccounts()).map((account) => ({
    id: account.id,
    username: account.username,
    first_name: account.first_name,
    last_name: account.last_name,
    email: account.email,
    must_change_password: account.must_change_password,
    is_superuser: account.is_superuser,
  }));
  return <>
    <Header username={session.username} isAdmin />
    <main className="admin-main">
      <section className="admin-hero"><div><p className="eyebrow">Panel de administración</p><h1>Administradores</h1><p>Gestiona las cuentas de acceso y las contraseñas del equipo. La cuenta superadministradora está protegida.</p></div></section>
      <AdminSectionNav active="admins" isSuperuser={session.isSuperuser} />
      <AdminAccounts accounts={accounts} actingAdminId={session.id} canWrite={demoWritesEnabled()} />
    </main>
  </>;
}
