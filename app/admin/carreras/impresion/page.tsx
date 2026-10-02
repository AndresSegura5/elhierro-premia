import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getRace, listAllBusinesses, listRaceCoupons } from "@/lib/store";
import { CouponVoucher } from "@/components/CouponVoucher";
import { PrintPageActions } from "@/components/PrintPageActions";
import { verifyPrintToken } from "@/lib/print-token";
import "../../print.css";

export const metadata: Metadata = { title: "Impresión de bonos | El Hierro Premia Deportistas" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ carrera?: string | string[]; modo?: string | string[]; token?: string | string[] }>;
const COUPONS_PER_SHEET = 14;
const COUPONS_PER_PAIRED_SHEET = 6;

export default async function PrintCouponsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raceId = typeof params.carrera === "string" ? params.carrera : undefined;
  const mode = typeof params.modo === "string" ? params.modo : "una-cara";
  const printToken = typeof params.token === "string" ? params.token : null;
  if (!raceId || !verifyPrintToken(printToken, raceId, mode)) await requireAdmin();
  const race = raceId ? await getRace(raceId) : undefined;
  if (!race || (mode !== "una-cara" && mode !== "dos-caras")) {
    return <main className="coupon-print-page"><p>No se ha encontrado la impresión solicitada.</p></main>;
  }

  const rawCoupons = await listRaceCoupons(race.id);
  const businesses = new Map((await listAllBusinesses()).map((business) => [business.id, business]));
  const items = (await Promise.all(rawCoupons.map(async (coupon) => {
    const business = businesses.get(coupon.businessId);
    return business ? { coupon, business } : null;
  }))).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <main className="coupon-print-page">
      <PrintPageActions />
      <div className="coupon-print-document">
        {mode === "una-cara" ? (
          <PrintPairedSheets race={race} items={items} />
        ) : (
          <PrintDuplexSheets race={race} items={items} />
        )}
      </div>
    </main>
  );
}

function PrintDuplexSheets({ race, items }: { race: Awaited<ReturnType<typeof getRace>>; items: Array<{ coupon: Awaited<ReturnType<typeof listRaceCoupons>>[number]; business: Awaited<ReturnType<typeof listAllBusinesses>>[number] }> }) {
  if (!race) return null;
  const sheets = [];
  for (let index = 0; index < items.length; index += COUPONS_PER_SHEET) {
    const sheetItems = items.slice(index, index + COUPONS_PER_SHEET);
    for (const side of ["front", "back"] as const) {
      sheets.push(
        <section className={`coupon-print-sheet coupon-print-sheet-${side}`} key={`${side}-${index}`} aria-label={`${side === "front" ? "Anversos" : "Reversos"} de ${race.name}`}>
          {sheetItems.map(({ coupon, business }) => (
            <div className="coupon-print-slot" key={`${side}-${coupon.code}`}>
              <CouponVoucher coupon={coupon} race={race} business={business} printMode={side} />
            </div>
          ))}
        </section>,
      );
    }
  }
  return sheets;
}

function PrintPairedSheets({ race, items }: { race: Awaited<ReturnType<typeof getRace>>; items: Array<{ coupon: Awaited<ReturnType<typeof listRaceCoupons>>[number]; business: Awaited<ReturnType<typeof listAllBusinesses>>[number] }> }) {
  if (!race) return null;
  const sheets = [];
  for (let index = 0; index < items.length; index += COUPONS_PER_PAIRED_SHEET) {
    const sheetItems = items.slice(index, index + COUPONS_PER_PAIRED_SHEET);
    sheets.push(
      <section className="coupon-print-sheet coupon-print-sheet-paired" key={`paired-${index}`} aria-label={`Bonos completos de ${race.name}`}>
        {sheetItems.map(({ coupon, business }) => (
          <div className="coupon-print-pair" key={`paired-${coupon.code}`}>
            <div className="coupon-print-slot">
              <CouponVoucher coupon={coupon} race={race} business={business} printMode="front" />
            </div>
            <div className="coupon-print-slot">
              <CouponVoucher coupon={coupon} race={race} business={business} printMode="back" />
            </div>
          </div>
        ))}
      </section>,
    );
  }
  return sheets;
}
