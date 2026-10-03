import Link from "next/link";
import { ArrowUpRight, Scissors } from "lucide-react";
import { QRCodeCard } from "@/components/QRCodeCard";

export function HeroVoucher() {
  return (
    <Link className="hero-voucher" href="/bono" aria-label="Consultar tu bono de 30 euros en El Hierro">
      <div className="hero-voucher-body">
        <div className="hero-voucher-info">
          <span className="hero-voucher-title"><span>Tu bono de</span><em>30€</em><span>En El Hierro</span></span>
          <span className="hero-voucher-action">Consultar bono <ArrowUpRight size={15} strokeWidth={2.5} aria-hidden="true" /></span>
        </div>
        <div className="hero-voucher-stub" aria-hidden="true">
          <span className="hero-voucher-cut"><Scissors size={16} strokeWidth={2.25} /></span>
          <div className="hero-voucher-qr"><QRCodeCard code="consulta" url="/bono" compact transparentBackground /></div>
        </div>
      </div>
    </Link>
  );
}
