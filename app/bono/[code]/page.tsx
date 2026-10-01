import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { CalendarClock, MapPin, Phone, Trophy } from "lucide-react";
import { InteractiveTable, type InteractiveTableColumn, type InteractiveTableRow } from "@/components/InteractiveTable";
import { QRCodeCard } from "@/components/QRCodeCard";
import { Header } from "@/components/Header";
import { consumeAuthenticatedCouponLookup, consumePublicCouponLookup } from "@/lib/coupon-lookup-limit";
import { isValidCouponCode } from "@/lib/coupon-code";
import { getSession } from "@/lib/auth";
import { localPhoneNumber, phoneLink } from "@/lib/phone";
import { formatDate, formatDateTime, formatEuros } from "@/lib/bonos";
import { getBusinessRecord, getCouponDetails, listCouponRules } from "@/lib/store";

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
  const couponRules = await listCouponRules();
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
        <section className="coupon-layout">
          <article className="coupon-summary">
            <div className="coupon-summary-heading">
              <p className="eyebrow" role="heading" aria-level={1}>Bono asignado a {business.name}</p>
              <div className={`status-pill ${coupon.status}`}>{statusLabels[coupon.status]}</div>
            </div>
            <h2 className="mono">{coupon.code}</h2>
            <dl className="coupon-core-facts">
              <div>
                <dt>Saldo disponible</dt>
                <dd>{formatEuros(coupon.amountCents - coupon.usedCents)}</dd>
              </div>
              <div><dt>Gastado</dt><dd>{formatEuros(coupon.usedCents)}</dd></div>
              <div className="coupon-race-fact">
                <dt>Prueba</dt>
                <dd className="coupon-race-identity">
                  {race.logoPath && <img src={race.logoPath} alt={`Logo de ${race.name}`} />}
                  <span>{race.name}</span>
                </dd>
              </div>
            </dl>
            <dl className="coupon-date-facts">
              <div><dt>Inicio</dt><dd>{formatDate(coupon.startDate)}</dd></div>
              <div><dt>Caducidad</dt><dd>{formatDate(coupon.expiresAt)}</dd></div>
            </dl>
          </article>

          <article className="business-detail">
            <div className="business-detail-content">
              <p className="eyebrow" role="heading" aria-level={2}>{business.name}</p>
              <p>{business.description}</p>
              <ul className="icon-list">
                <li>
                  <MapPin size={18} aria-hidden="true" />
                  {business.address}
                </li>
                <li>
                  <Phone size={18} aria-hidden="true" />
                  <a href={phoneLink(business.phone)}>{localPhoneNumber(business.phone)}</a>
                </li>
                <li>
                  <CalendarClock size={18} aria-hidden="true" />
                  {business.openingHours}
                </li>
                <li>
                  <Trophy size={18} aria-hidden="true" />
                  {race.name}
                </li>
              </ul>
              <Link
                className="button"
                href={`https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lng}`}
                target="_blank"
              >
                Abrir ruta
              </Link>
            </div>
            <QRCodeCard code={coupon.code} />
          </article>
        </section>

        {redemptions.length > 0 && <section id="historial-bono" className="section coupon-history">
          <div className="section-heading coupon-conditions-heading"><p className="eyebrow" role="heading" aria-level={2}>Gastos registrados</p></div>
          <InteractiveTable columns={redemptionColumns} rows={redemptionRows} ariaLabel="Gastos registrados del bono" label="movimientos" emptyMessage="Aún no hay gastos registrados." initialSort={{ key: "date", direction: "desc" }} />
        </section>}

        <section className="section">
          <div className="section-heading coupon-conditions-heading">
            <p className="eyebrow" role="heading" aria-level={2}>Condiciones del bono</p>
          </div>
          <ol className="rules-list">
            {couponRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </section>

      </main>
    </>
  );
}
