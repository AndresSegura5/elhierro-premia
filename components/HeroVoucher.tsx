import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
          <span className="hero-voucher-cut">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <g className="hero-voucher-blade hero-voucher-blade--a">
                <path d="M12 12 L23 11.7 Q18.5 9.6 12.4 9.9 Z" fill="currentColor" stroke="none" />
                <path d="M12 12.4 8.3 15" />
                <circle cx="5.9" cy="16.7" r="2.6" />
              </g>
              <g className="hero-voucher-blade hero-voucher-blade--b">
                <path d="M12 12 L23 12.3 Q18.5 14.4 12.4 14.1 Z" fill="currentColor" stroke="none" />
                <path d="M12 11.6 8.3 9" />
                <circle cx="5.9" cy="7.3" r="2.6" />
              </g>
              <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <div className="hero-voucher-qr"><QRCodeCard code="consulta" url="/bono" compact transparentBackground /></div>
        </div>
      </div>
    </Link>
  );
}
