"use client";

import { useState } from "react";
import { CalendarClock, MapPin, Phone, RotateCw } from "lucide-react";
import type { Business, Coupon, Race } from "@/lib/types";
import { formatDate, formatEuros } from "@/lib/bonos";
import { localPhoneNumber, phoneLink } from "@/lib/phone";
import { QRCodeCard } from "@/components/QRCodeCard";

type Props = { coupon: Coupon; race: Race; business: Business; printMode?: "front" | "back" };

const artwork: Record<string, { front: string; back: string }> = {
  bimbache: { front: "/branding/vouchers/bimbache-front.jpg", back: "/branding/vouchers/bimbache-back.jpg" },
  meridiano: { front: "/branding/vouchers/meridiano-front.jpg", back: "/branding/vouchers/meridiano-back.jpg" },
  bestial: { front: "/branding/vouchers/bestial-front-final.png", back: "/branding/vouchers/bestial-back-final.png" },
};

export function CouponVoucher({ coupon, race, business, printMode }: Props) {
  const [showBack, setShowBack] = useState(false);
  const raceLabel = (race.id + " " + race.name).toLocaleLowerCase();
  const designId = raceLabel.includes("bestial") ? "bestial" : raceLabel.includes("meridiano") ? "meridiano" : raceLabel.includes("bimbache") ? "bimbache" : race.id;
  const images = artwork[designId] ?? { front: race.cardImagePath ?? artwork.bimbache.front, back: artwork.bimbache.back };
  const address = business.address.toLocaleLowerCase().endsWith(business.municipality.toLocaleLowerCase())
    ? business.address
    : business.address + ", " + business.municipality;
  const businessInfo = (
    <div className="coupon-voucher-business">
      <div className="coupon-voucher-merchant">
        <span>{business.name}</span>
      </div>
      <div className="coupon-voucher-dates">
        <p><span>Inicio</span><time dateTime={coupon.startDate}>{formatDate(coupon.startDate)}</time></p>
        <p><span>Caduca</span><time dateTime={coupon.expiresAt}>{formatDate(coupon.expiresAt)}</time></p>
      </div>
      <div className="coupon-voucher-details">
        <p><MapPin size={16} aria-hidden="true" /><span>{address}</span></p>
        <p><Phone size={16} aria-hidden="true" /><a href={phoneLink(business.phone)}>{localPhoneNumber(business.phone)}</a></p>
        <p><CalendarClock size={16} aria-hidden="true" /><span>{business.openingHours}</span></p>
      </div>
    </div>
  );
  const value = <div className="coupon-voucher-value"><strong>{formatEuros(coupon.amountCents)}</strong><span>Bono canjeable</span></div>;
  const qr = (
    <div className="coupon-voucher-qr">
      <QRCodeCard code={coupon.code} compact printOptimized={Boolean(printMode)} />
      <span className="coupon-voucher-code">{coupon.code}</span>
    </div>
  );

  const front = (
      <article className="coupon-voucher coupon-voucher-front coupon-voucher-face" style={{ backgroundImage: "url(\"" + images.front + "\")" }} aria-label={"Anverso del bono de " + race.name} inert={showBack ? true : undefined}>
        {designId === "bestial" ? (
          <>
            <svg className="coupon-voucher-bestial-svg" viewBox="0 0 2172 724" preserveAspectRatio="xMidYMid meet" role="img" aria-label={"Anverso del bono de " + race.name}>
              <image href={images.front} x="0" y="0" width="2172" height="724" preserveAspectRatio="none" />
              <foreignObject x="1438" y="428" width="412" height="296">
                <div className="coupon-voucher-svg-business">{businessInfo}</div>
              </foreignObject>
              <foreignObject x="1865" y="428" width="270" height="296">
                <div className="coupon-voucher-svg-qr">
                  <QRCodeCard code={coupon.code} compact printOptimized={Boolean(printMode)} />
                  <span className="coupon-voucher-code"><span>{coupon.code.slice(0, 7)}</span><span>{coupon.code.slice(7)}</span></span>
                </div>
              </foreignObject>
            </svg>
            {!printMode && (
              <div className="coupon-voucher-bestial-mobile">
                <img className="coupon-voucher-mobile-art" src={images.front} alt="" />
                <div className="coupon-voucher-bestial-business">{businessInfo}</div>
                {qr}
              </div>
            )}
          </>
        ) : (
          <>
            <div className={"coupon-voucher-front-info " + (designId === "bimbache" ? "has-value" : "")}>
              {designId === "bimbache" && value}
              {businessInfo}
              {qr}
            </div>
          </>
        )}
        <span className="visually-hidden">Prueba: {race.name}. Código: {coupon.code}.</span>
      </article>
  );
  const back = (
      <article className="coupon-voucher coupon-voucher-back coupon-voucher-face" aria-label={"Reverso del bono de " + race.name}>
        <img className="coupon-voucher-back-image" src={images.back} alt={"Reverso del bono: " + race.name} />
        {designId === "bestial" && !printMode && (
          <div className="coupon-voucher-bestial-mobile coupon-voucher-back-mobile-info">
            <div className="coupon-voucher-bestial-business">{businessInfo}</div>
            {qr}
          </div>
        )}
      </article>
  );

  if (printMode) {
    return (
      <div className={`coupon-voucher-stack coupon-voucher-${designId} coupon-voucher-print-face coupon-voucher-print-${printMode}`}>
        {printMode === "front" ? front : back}
      </div>
    );
  }

  if (designId !== "bestial") {
    return <div className={"coupon-voucher-stack coupon-voucher-" + designId}>
      {front}{back}
      <a className="coupon-voucher-map" href={`https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lng}`} target="_blank" rel="noreferrer">
        <MapPin size={16} aria-hidden="true" /> Ver cómo llegar a {business.name}
      </a>
    </div>;
  }

  return (
    <div className={"coupon-voucher-stack coupon-voucher-bestial coupon-voucher-flip-stack" + (showBack ? " is-flipped" : "")}>
      <div className="coupon-voucher-flip-stage">
        <div className="coupon-voucher-flip-inner">
          {front}
          {back}
        </div>
      </div>
      <div className="coupon-voucher-toolbar">
        <a className="coupon-voucher-map" href={`https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lng}`} target="_blank" rel="noreferrer">
          <MapPin size={16} aria-hidden="true" /> Ver cómo llegar a {business.name}
        </a>
        <button
          type="button"
          className="coupon-voucher-flip-button"
          aria-pressed={showBack}
          onClick={() => setShowBack((current) => !current)}
        >
          <RotateCw size={18} aria-hidden="true" />
          {showBack ? "Ver anverso" : "Ver reverso"}
        </button>
      </div>
    </div>
  );
}
