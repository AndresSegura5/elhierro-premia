import type { Metadata } from "next";
import { AdminSectionNav } from "@/components/AdminSectionNav";
import { Header } from "@/components/Header";
import { requireAdmin, listMerchantAccounts } from "@/lib/auth";
import { listBusinessCategories, listManagedBusinesses } from "@/lib/store";
import { BusinessManagement } from "@/components/BusinessManagement";
import "../admin.css";

export const metadata: Metadata = { title: "Gestión de comercios | El Hierro Premia Deportistas" };
export const dynamic = "force-dynamic";

export default async function AdminBusinessesPage() {
  const session = await requireAdmin();
  const [businesses, categories] = await Promise.all([listManagedBusinesses(), listBusinessCategories()]);
  const accounts = (await listMerchantAccounts()).map((account) => ({
    username: account.username,
    business_id: account.business_id,
  }));

  return (
    <>
      <Header username={session.username} isAdmin={session.role === "admin"} />
      <main className="admin-main">
        <section className="admin-hero">
          <div>
            <p className="eyebrow">Panel de administración</p>
            <h1>Gestión de comercios</h1>
            <p>Crea comercios y gestiona sus datos y credenciales de acceso.</p>
          </div>
        </section>
        <AdminSectionNav active="businesses" />
        <BusinessManagement businesses={businesses} accounts={accounts} categories={categories} />
      </main>
    </>
  );
}
