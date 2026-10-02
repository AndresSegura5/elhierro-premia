import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { QRCodeCard } from "@/components/QRCodeCard";

export function HeroVoucher() {
  return (
    <Link className="hero-voucher" href="/bono" aria-label="Consultar bono deportista de 30 euros en El Hierro">
      <div className="hero-voucher-body">
        <div className="hero-voucher-info">
          <span className="hero-voucher-title">Bono<em>Deportista</em><small>El Hierro</small></span>
          <span className="hero-voucher-amount"><strong>30 €</strong><small>Bono canjeable</small></span>
          <span className="hero-voucher-action">Consultar bono <ArrowUpRight size={15} strokeWidth={2.5} aria-hidden="true" /></span>
        </div>
        <div className="hero-voucher-stub" aria-hidden="true">
          <div className="hero-voucher-qr"><QRCodeCard code="consulta" url="/bono" compact transparentBackground /></div>
        </div>
      </div>
    </Link>
  );
}
