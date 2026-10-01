import Link from "next/link";
import { CalendarDays, ShieldCheck, Store } from "lucide-react";

export function AdminSectionNav({ active }: { active?: "races" | "businesses" | "admins" }) {
  return (
    <nav className="admin-section-nav" aria-label="Secciones de administración">
      <Link href="/admin/carreras" className={active === "races" ? "is-active" : undefined} aria-current={active === "races" ? "page" : undefined}>
        <CalendarDays size={18} aria-hidden="true" /> Carreras y bonos
      </Link>
      <Link href="/admin/comercios" className={active === "businesses" ? "is-active" : undefined} aria-current={active === "businesses" ? "page" : undefined}>
        <Store size={18} aria-hidden="true" /> Comercios
      </Link>
      <Link href="/admin/administradores" className={active === "admins" ? "is-active" : undefined} aria-current={active === "admins" ? "page" : undefined}>
        <ShieldCheck size={18} aria-hidden="true" /> Administradores
      </Link>
    </nav>
  );
}
