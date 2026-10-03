import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { InteractiveTable, type InteractiveTableColumn, type InteractiveTableRow } from "@/components/InteractiveTable";
import { CouponVoucher } from "@/components/CouponVoucher";
import { Header } from "@/components/Header";
import { consumeAuthenticatedCouponLookup, consumePublicCouponLookup } from "@/lib/coupon-lookup-limit";
import { isValidCouponCode } from "@/lib/coupon-code";
import { getSession } from "@/lib/auth";
import { formatDate, formatDateTime, formatEuros, VALIDITY_WINDOW_TEXT } from "@/lib/bonos";
import { getBusinessRecord, getCouponDetails } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const statusLabels = {
  "not-started": "Aún no vigente",
  available: "Disponible",
  partial: "Uso parcial",
  redeemed: "Agotado",
  expired: "Caducado",
};

type Props = {
  params: Promise<{ code: string }>;
};

export default async function CouponPage({ params }: Props) {
  const session = await getSession();
  {
    const limit = session ? await consumeAuthenticatedCouponLookup(session.id) : await consumePublicCouponLookup(await headers());
    if (!limit.allowed) {
      const waitMinutes = Math.ceil(limit.retryAfterSeconds / 60);
      return <>
        <Header />
        <main className="coupon-page-main">
          <section className="coupon-lookup-limit">
            <h1>Demasiadas consultas</h1>
            <p>Has alcanzado el límite temporal. Vuelve a intentarlo en unos {waitMinutes} minutos.</p>
            <Link className="button" href="/bono">Volver a la página del bono</Link>
          </section>
        </main>
      </>;
    }
  }
  const { code } = await params;
  if (!isValidCouponCode(code.trim().toUpperCase())) notFound();
  const details = await getCouponDetails(code);
  if (!details) notFound();
  if (session?.role === "merchant" && details.coupon.businessId !== session.businessId) notFound();
  const { coupon, race, redemptions } = details;
  const business = await getBusinessRecord(coupon.businessId);
  if (!business) notFound();
  const redemptionColumns: InteractiveTableColumn[] = [
    { key: "date", label: "Fecha y hora" }, { key: "amount", label: "Importe" }, { key: "balance", label: "Saldo posterior" },
  ];
  const redemptionRows: InteractiveTableRow[] = redemptions.map((redemption) => {
    const date = formatDateTime(redemption.createdAt);
    const amount = formatEuros(redemption.amountCents);
    const balance = formatEuros(redemption.balanceAfterCents);
    return { key: String(redemption.id), searchValues: { date, amount, balance }, sortValues: { date: redemption.createdAt, amount: redemption.amountCents, balance: redemption.balanceAfterCents }, cells: { date, amount, balance } };
  });

  return (
    <>
      <Header />
      <main className="coupon-page-main">
        <section className="coupon-voucher-section" aria-label="Bono deportivo">
          <div className="coupon-voucher-status">
            <span className={`status-pill ${coupon.status}`}>{statusLabels[coupon.status]}</span>
            <span>Saldo disponible <strong>{formatEuros(coupon.amountCents - coupon.usedCents)}</strong></span>
            <span>Gastado <strong>{formatEuros(coupon.usedCents)}</strong></span>
            <span>Inicio <strong>{formatDate(coupon.startDate)}</strong></span>
            <span>Caduca <strong>{formatDate(coupon.expiresAt)}</strong></span>
          </div>
          <p className="coupon-validity-note">{VALIDITY_WINDOW_TEXT}</p>
          <CouponVoucher coupon={coupon} race={race} business={business} />
        </section>

        {redemptions.length > 0 && <section id="historial-bono" className="section coupon-history">
          <div className="section-heading coupon-conditions-heading"><p className="eyebrow" role="heading" aria-level={2}>Gastos registrados</p></div>
          <InteractiveTable columns={redemptionColumns} rows={redemptionRows} ariaLabel="Gastos registrados del bono" label="movimientos" emptyMessage="Aún no hay gastos registrados." initialSort={{ key: "date", direction: "desc" }} />
        </section>}

      </main>
    </>
  );
}
