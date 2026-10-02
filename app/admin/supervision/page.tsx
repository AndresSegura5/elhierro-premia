import type { Metadata } from "next";
import Link from "next/link";
import { History, KeyRound, QrCode, ReceiptText, ShieldAlert, Store, Trash2 } from "lucide-react";
import { AdminSectionNav } from "@/components/AdminSectionNav";
import { Header } from "@/components/Header";
import { InteractiveTable, type InteractiveTableColumn, type InteractiveTableRow } from "@/components/InteractiveTable";
import { formatDateTime, formatEuros } from "@/lib/bonos";
import { requireSuperAdmin } from "@/lib/auth";
import { listAllCouponAudit, listAllRedemptionAudit, listAuditEvents, listLoginAudit, listMerchantAccountAudit } from "@/lib/store";
import "../admin.css";

export const metadata: Metadata = { title: "Supervisión | El Hierro Premia Deportistas" };
export const dynamic = "force-dynamic";

const loginColumns: InteractiveTableColumn[] = [
  { key: "date", label: "Inicio de sesión" },
  { key: "user", label: "Usuario" },
  { key: "role", label: "Tipo" },
  { key: "end", label: "Fin de sesión" },
];

const eventColumns: InteractiveTableColumn[] = [
  { key: "date", label: "Fecha y hora" },
  { key: "user", label: "Usuario" },
  { key: "action", label: "Acción" },
  { key: "details", label: "Detalle" },
];

const couponColumns: InteractiveTableColumn[] = [
  { key: "created", label: "Generado" },
  { key: "code", label: "Bono" },
  { key: "race", label: "Carrera" },
  { key: "business", label: "Comercio" },
  { key: "spent", label: "Gastado" },
  { key: "state", label: "Estado" },
  { key: "deleted", label: "Eliminado" },
];

const redemptionColumns: InteractiveTableColumn[] = [
  { key: "date", label: "Fecha y hora" },
  { key: "race", label: "Carrera" },
  { key: "business", label: "Comercio" },
  { key: "code", label: "Bono" },
  { key: "amount", label: "Importe" },
  { key: "balance", label: "Saldo posterior" },
];

const accountColumns: InteractiveTableColumn[] = [
  { key: "business", label: "Comercio" },
  { key: "username", label: "Usuario" },
  { key: "state", label: "Estado" },
  { key: "archived", label: "Archivado" },
];

export default async function SupervisionPage() {
  const session = await requireSuperAdmin();
  const [loginEvents, auditEvents, coupons, redemptions, merchantAccounts] = await Promise.all([listLoginAudit(), listAuditEvents(), listAllCouponAudit(), listAllRedemptionAudit(), listMerchantAccountAudit()]);
  const deletedCoupons = coupons.filter((coupon) => coupon.deletedAt);

  const loginRows: InteractiveTableRow[] = loginEvents.map((event) => {
    const date = formatDateTime(event.signedInAt);
    const end = event.signedOutAt ? formatDateTime(event.signedOutAt) : "Sesión activa o caducada";
    const role = event.role === "admin" ? "Administración" : "Comercio";
    return { key: String(event.id), searchValues: { date, user: event.username, role, end }, sortValues: { date: event.signedInAt, user: event.username, role, end }, cells: { date, user: <strong>{event.username}</strong>, role, end } };
  });

  const eventRows: InteractiveTableRow[] = auditEvents.map((event) => {
    const date = formatDateTime(event.createdAt);
    const action = event.action === "delete_coupons" ? "Bonos archivados" : event.action === "delete_business" ? "Comercio archivado" : event.action;
    return { key: String(event.id), searchValues: { date, user: event.actorUsername ?? "Sistema", action, details: event.details }, sortValues: { date: event.createdAt, user: event.actorUsername ?? "", action, details: event.details }, cells: { date, user: event.actorUsername ?? "Sistema", action: <strong>{action}</strong>, details: event.details } };
  });

  const couponRows: InteractiveTableRow[] = coupons.map((coupon) => {
    const created = formatDateTime(coupon.createdAt);
    const state = coupon.deletedAt ? "Archivado" : "Activo";
    const deleted = coupon.deletedAt ? `${formatDateTime(coupon.deletedAt)} · ${coupon.deletedByUsername ?? "Usuario desconocido"}` : "—";
    const spent = formatEuros(coupon.usedCents);
    const code = coupon.deletedAt ? <span className="mono">{coupon.code}</span> : <Link className="mono" href={`/bono/${coupon.code}`}>{coupon.code}</Link>;
    return { key: coupon.code, searchValues: { created, code: coupon.code, race: coupon.raceName, business: coupon.businessName, spent, state, deleted }, sortValues: { created: coupon.createdAt, code: coupon.code, race: coupon.raceName, business: coupon.businessName, spent: coupon.usedCents, state, deleted }, cells: { created, code, race: coupon.raceName, business: coupon.businessName, spent, state: <span className={coupon.deletedAt ? "audit-status audit-status--deleted" : "audit-status"}>{state}</span>, deleted } };
  });

  const redemptionRows: InteractiveTableRow[] = redemptions.map((redemption) => {
    const date = formatDateTime(redemption.createdAt);
    const amount = formatEuros(redemption.amountCents);
    const balance = formatEuros(redemption.balanceAfterCents);
    return { key: String(redemption.id), searchValues: { date, race: redemption.raceName, business: redemption.businessName, code: redemption.code, amount, balance }, sortValues: { date: redemption.createdAt, race: redemption.raceName, business: redemption.businessName, code: redemption.code, amount: redemption.amountCents, balance: redemption.balanceAfterCents }, cells: { date, race: redemption.raceName, business: redemption.businessName, code: <span className="mono">{redemption.code}</span>, amount, balance } };
  });

  const accountRows: InteractiveTableRow[] = merchantAccounts.map((account) => {
    const state = account.archivedAt ? "Archivada" : "Activa";
    const archived = account.archivedAt ? `${formatDateTime(account.archivedAt)} · ${account.archivedByUsername ?? "Sistema"}` : "—";
    return { key: String(account.id), searchValues: { business: account.businessName, username: account.username, state, archived }, sortValues: { business: account.businessName, username: account.username, state, archived }, cells: { business: <strong>{account.businessName}</strong>, username: <span className="mono">{account.username}</span>, state: <span className={account.archivedAt ? "audit-status audit-status--deleted" : "audit-status"}>{state}</span>, archived } };
  });

  return <>
    <Header username={session.username} isAdmin />
    <main className="admin-main">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Superusuario</p>
          <h1>Supervisión</h1>
          <p>Historial de accesos, acciones y bonos archivados. Esta información solo está disponible para el superusuario.</p>
        </div>
      </section>
      <AdminSectionNav active="supervision" isSuperuser />

      <section className="metric-grid admin-supervision-metrics" aria-label="Resumen de supervisión">
        <article><KeyRound size={22} aria-hidden="true" /><strong>{loginEvents.length.toLocaleString("es-ES")}</strong><span>inicios registrados</span></article>
        <article><History size={22} aria-hidden="true" /><strong>{auditEvents.length.toLocaleString("es-ES")}</strong><span>acciones registradas</span></article>
        <article><Trash2 size={22} aria-hidden="true" /><strong>{deletedCoupons.length.toLocaleString("es-ES")}</strong><span>bonos archivados</span></article>
        <article><QrCode size={22} aria-hidden="true" /><strong>{coupons.length.toLocaleString("es-ES")}</strong><span>bonos conservados</span></article>
        <article><ReceiptText size={22} aria-hidden="true" /><strong>{redemptions.length.toLocaleString("es-ES")}</strong><span>movimientos registrados</span></article>
      </section>

      <section className="admin-supervision-panel">
        <div className="admin-supervision-heading"><div><p className="eyebrow">Trazabilidad</p><h2><KeyRound size={20} aria-hidden="true" />Accesos</h2></div><small>Histórico completo de inicios</small></div>
        {loginRows.length ? <InteractiveTable columns={loginColumns} rows={loginRows} ariaLabel="Historial de accesos" label="accesos" initialSort={{ key: "date", direction: "desc" }} /> : <p className="admin-table-empty">Todavía no hay accesos registrados.</p>}
      </section>

      <section className="admin-supervision-panel">
        <div className="admin-supervision-heading"><div><p className="eyebrow">Retención de accesos</p><h2><Store size={20} aria-hidden="true" />Cuentas de comercios</h2></div><small>Las cuentas archivadas siguen siendo consultables</small></div>
        {accountRows.length ? <InteractiveTable columns={accountColumns} rows={accountRows} ariaLabel="Historial de cuentas de comercios" label="cuentas" initialSort={{ key: "state", direction: "asc" }} /> : <p className="admin-table-empty">Todavía no hay cuentas de comercios registradas.</p>}
      </section>

      <section className="admin-supervision-panel">
        <div className="admin-supervision-heading"><div><p className="eyebrow">Registro de cambios</p><h2><ShieldAlert size={20} aria-hidden="true" />Acciones sensibles</h2></div><small>Histórico completo de acciones</small></div>
        {eventRows.length ? <InteractiveTable columns={eventColumns} rows={eventRows} ariaLabel="Historial de acciones" label="acciones" initialSort={{ key: "date", direction: "desc" }} /> : <p className="admin-table-empty">Todavía no hay acciones sensibles registradas.</p>}
      </section>

      <section className="admin-supervision-panel">
        <div className="admin-supervision-heading"><div><p className="eyebrow">Retención</p><h2><QrCode size={20} aria-hidden="true" />Todos los bonos</h2></div><small>Los archivados permanecen visibles aquí</small></div>
        {couponRows.length ? <InteractiveTable columns={couponColumns} rows={couponRows} ariaLabel="Todos los bonos, incluidos los archivados" label="bonos" initialSort={{ key: "deleted", direction: "desc" }} /> : <p className="admin-table-empty">Todavía no hay bonos registrados.</p>}
      </section>

      <section className="admin-supervision-panel">
        <div className="admin-supervision-heading"><div><p className="eyebrow">Histórico económico</p><h2><ReceiptText size={20} aria-hidden="true" />Movimientos de gasto</h2></div><small>Todos los movimientos, incluso de bonos archivados</small></div>
        {redemptionRows.length ? <InteractiveTable columns={redemptionColumns} rows={redemptionRows} ariaLabel="Historial completo de movimientos" label="movimientos" initialSort={{ key: "date", direction: "desc" }} /> : <p className="admin-table-empty">Todavía no hay movimientos registrados.</p>}
      </section>
    </main>
  </>;
}
