import type { Metadata } from "next";
import { FileDown, FileSpreadsheet, Store } from "lucide-react";
import { Header } from "@/components/Header";
import { PageTitleHero } from "@/components/PageTitleHero";
import { InteractiveTable, type InteractiveTableColumn, type InteractiveTableRow } from "@/components/InteractiveTable";
import { Scanner } from "@/components/Scanner";
import { requireMerchant } from "@/lib/auth";
import { formatDateTime, formatEuros } from "@/lib/bonos";
import { getBusinessRecord, listBusinessRedemptions } from "@/lib/store";

export const metadata: Metadata = {
  title: "Área de comercios | El Hierro Premia Deportistas",
  description: "Consulta el estado de los bonos de El Hierro Premia Deportistas.",
};

export const dynamic = "force-dynamic";

export default async function BusinessAccessPage() {
  const session = await requireMerchant();
  const business = await getBusinessRecord(session.businessId!);
  if (!business) return null;
  const redemptions = await listBusinessRedemptions(business.id);
  const totalCents = redemptions.reduce((sum, entry) => sum + entry.amountCents, 0);
  const byCoupon = new Map<string, { code: string; spentCents: number; purchases: number; balanceCents: number; lastUsedAt: string }>();
  for (const entry of redemptions) {
    const current = byCoupon.get(entry.code);
    if (current) {
      current.spentCents += entry.amountCents;
      current.purchases += 1;
    } else {
      byCoupon.set(entry.code, { code: entry.code, spentCents: entry.amountCents, purchases: 1, balanceCents: entry.balanceAfterCents, lastUsedAt: entry.createdAt });
    }
  }
  const couponCount = byCoupon.size;
  const couponEntries = [...byCoupon.values()];
  const couponColumns: InteractiveTableColumn[] = [
    { key: "code", label: "Bono" }, { key: "purchases", label: "Compras" }, { key: "spent", label: "Total gastado" },
    { key: "balance", label: "Saldo" }, { key: "lastUsed", label: "Último uso" },
  ];
  const couponRows: InteractiveTableRow[] = couponEntries.map((entry) => {
    const purchases = entry.purchases.toLocaleString("es-ES");
    const spent = formatEuros(entry.spentCents);
    const balance = formatEuros(entry.balanceCents);
    const lastUsed = formatDateTime(entry.lastUsedAt);
    return { key: entry.code, searchValues: { code: entry.code, purchases, spent, balance, lastUsed }, sortValues: { code: entry.code, purchases: entry.purchases, spent: entry.spentCents, balance: entry.balanceCents, lastUsed: entry.lastUsedAt }, cells: { code: <span className="mono">{entry.code}</span>, purchases, spent, balance, lastUsed } };
  });
  const movementColumns: InteractiveTableColumn[] = [
    { key: "date", label: "Fecha y hora" }, { key: "code", label: "Bono" },
    { key: "amount", label: "Importe de la compra" }, { key: "balance", label: "Saldo posterior" },
  ];
  const movementRows: InteractiveTableRow[] = redemptions.map((entry) => {
    const date = formatDateTime(entry.createdAt);
    const amount = formatEuros(entry.amountCents);
    const balance = formatEuros(entry.balanceAfterCents);
    return { key: String(entry.id), searchValues: { date, code: entry.code, amount, balance }, sortValues: { date: entry.createdAt, code: entry.code, amount: entry.amountCents, balance: entry.balanceAfterCents }, cells: { date, code: <span className="mono">{entry.code}</span>, amount, balance } };
  });
  return (
    <>
      <Header merchantName={business.name} merchantAddress={business.address} merchantPhone={business.phone} merchantHours={business.openingHours} username={session.username} />
      <main className="merchant-main">
        <section className="merchant-hero">
          <PageTitleHero variant="embedded">
            Área de <em>comercios</em>
          </PageTitleHero>
          <div className="merchant-hero-inner">
            <div className="merchant-hero-intro">
              <Store size={60} strokeWidth={1.4} aria-hidden="true" />
              <p>Comprueba el saldo y registra cada compra del bono asignado a tu comercio.</p>
            </div>
          </div>
        </section>
        <div className="merchant-content">
          <Scanner businessName={business.name} businessId={business.id} />
          <section className="merchant-ledger" aria-labelledby="merchant-ledger-title">
            <div className="merchant-ledger-heading">
              <div><p className="eyebrow">Movimiento de la tienda</p><h2 id="merchant-ledger-title">Registro de bonos</h2></div>
              <div className="merchant-export-actions" aria-label="Exportar movimientos">
                <a href="/comercio/movimientos/export?format=pdf"><FileDown size={17} aria-hidden="true" />PDF</a>
                <a href="/comercio/movimientos/export?format=xlsx"><FileSpreadsheet size={17} aria-hidden="true" />Excel</a>
              </div>
            </div>
            <div className="merchant-ledger-metrics"><p><strong>{couponCount}</strong><span>bonos utilizados</span></p><p><strong>{redemptions.length}</strong><span>compras registradas</span></p><p><strong>{formatEuros(totalCents)}</strong><span>importe gastado</span></p></div>
            {redemptions.length ? <>
              <h3 id="gasto-por-bono">Gasto por bono</h3>
              <InteractiveTable columns={couponColumns} rows={couponRows} ariaLabel="Gasto por bono" label="bonos" emptyMessage="No hay bonos utilizados." initialSort={{ key: "lastUsed", direction: "desc" }} />
              <h3 id="todos-los-movimientos">Todos los movimientos</h3>
              <InteractiveTable columns={movementColumns} rows={movementRows} ariaLabel="Todos los movimientos" label="movimientos" emptyMessage="Aún no hay movimientos registrados." initialSort={{ key: "date", direction: "desc" }} />
            </> : <p className="merchant-ledger-empty">Aún no hay gastos registrados en este comercio.</p>}
          </section>
        </div>
      </main>
    </>
  );
}
