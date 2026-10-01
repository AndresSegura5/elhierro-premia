"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Clock3, MapPin, Menu, Phone, Store, UserRound, X } from "lucide-react";
import { logout } from "@/app/auth-actions";
import { localPhoneNumber } from "@/lib/phone";
export function Header({ merchantName, merchantAddress, merchantPhone, merchantHours, username, isAdmin = false }: { merchantName?: string; merchantAddress?: string; merchantPhone?: string; merchantHours?: string; username?: string; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const merchantMenuRef = useRef<HTMLDetailsElement>(null);
  const accountMenuRef = useRef<HTMLDetailsElement>(null);
  const overlay = pathname === "/";
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);
  useEffect(() => {
    const closeMenusOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!merchantMenuRef.current?.contains(target)) merchantMenuRef.current?.removeAttribute("open");
      if (!accountMenuRef.current?.contains(target)) accountMenuRef.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeMenusOutside);
    return () => document.removeEventListener("pointerdown", closeMenusOutside);
  }, []);
  return (
    <>
      <header className={`site-header${overlay ? " site-header--overlay" : ""}${menuOpen ? " site-header--menu-open" : ""}`}>
        <Link href="/" className="brand">
          <img className="brand-logo" src="/branding/site-logo.svg" alt="El Hierro premia deportistas" />
          <span className="brand-affiliations" aria-label="Consejería de Deportes y Consejería de Empleo">
            <span>Consejería de Deportes</span>
            <span>Consejería de Empleo</span>
          </span>
        </Link>
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
        <nav id="primary-navigation" className={`main-nav${menuOpen ? " main-nav--open" : ""}`} aria-label="Navegación principal">
          <Link href="/comercios" onClick={() => setMenuOpen(false)} aria-current={pathname === "/comercios" ? "page" : undefined}>Comercios</Link>
          <Link href="/bono" onClick={() => setMenuOpen(false)} aria-current={pathname === "/bono" ? "page" : undefined}>El bono</Link>
          {merchantName ? (
            <details className="nav-merchant-menu" ref={merchantMenuRef}>
              <summary aria-label={`Menú de ${merchantName}`}>
                <Store size={16} />
                <span>{merchantName}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div className="nav-merchant-popover">
                <strong>{merchantName}</strong>
                <div className="nav-merchant-details" aria-label="Datos del comercio">
                  <span><Clock3 size={15} aria-hidden="true" />{merchantHours || "Horario no disponible"}</span>
                  <span><MapPin size={15} aria-hidden="true" />{merchantAddress || "Dirección no disponible"}</span>
                  <span><Phone size={15} aria-hidden="true" />{merchantPhone ? localPhoneNumber(merchantPhone) : "Teléfono no disponible"}</span>
                </div>
                {username && <form action={logout}><button type="submit">Cerrar sesión</button></form>}
              </div>
            </details>
          ) : (
            <Link
              className="nav-business"
              href="/comercio"
              onClick={() => setMenuOpen(false)}
              aria-current={pathname.startsWith("/comercio") ? "page" : undefined}
            >
              <Store size={16} />
              Área de comercios
              <ArrowUpRight size={15} />
            </Link>
          )}
          {username && isAdmin && merchantName ? (
            <Link href="/admin" onClick={() => setMenuOpen(false)} className="nav-admin nav-icon" title="Panel de administración" aria-label="Ir al panel de administración">
              <UserRound size={19} aria-hidden="true" />
            </Link>
          ) : username ? (
            <details className="nav-account-menu" ref={accountMenuRef}>
              <summary className="nav-admin nav-icon" title="Cuenta" aria-label="Abrir opciones de cuenta"><UserRound size={19} aria-hidden="true" /></summary>
              <div className="nav-account-popover nav-merchant-popover">
                <strong>{username}</strong>
                <form action={logout}><button type="submit">Cerrar sesión</button></form>
              </div>
            </details>
          ) : (
            <Link href="/admin" onClick={() => setMenuOpen(false)} className="nav-admin nav-icon" title="Administración" aria-label="Administración" aria-current={pathname.startsWith("/admin") ? "page" : undefined}>
              <UserRound size={19} />
            </Link>
          )}
        </nav>
      </header>
    </>
  );
}
