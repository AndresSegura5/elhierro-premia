import Link from "next/link";

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-footer-inner">
      <div className="site-footer-brand">
        <div className="site-footer-brand-logos">
          <img className="site-footer-cabildo" src="/branding/cabildo-el-hierro.svg" alt="Cabildo de El Hierro" />
          <span aria-hidden="true" />
          <strong>El Hierro<br />premia deportistas</strong>
        </div>
        <p>Deporte que conecta. Comercio que da vida.</p>
        <small>DEPORTE, COMERCIO Y VIDA EN EL HIERRO.</small>
      </div>
      <nav className="site-footer-map" aria-label="Árbol de páginas">
        <strong>Páginas</strong>
        <ul>
          <li><Link href="/">Inicio</Link></li>
          <li><Link href="/comercios">Comercios</Link></li>
          <li><Link href="/bono">El bono</Link></li>
          <li><Link href="/comercio/login">Acceso de comercios</Link></li>
        </ul>
      </nav>
      <address className="site-footer-contact">
        <strong>Contacto</strong>
        <span>C/ General Sánchez Rodríguez y Espinosa, 12</span>
        <span>38900 Villa de Valverde, El Hierro</span>
        <a href="tel:922554132">922 554 132</a>
        <a href="mailto:deportes@elhierro.es">deportes@elhierro.es</a>
      </address>
      <div className="site-footer-bottom">
        <small>© {new Date().getFullYear()} Excmo. Cabildo Insular de El Hierro</small>
        <nav className="site-footer-legal" aria-label="Información legal">
          <span>Aviso legal</span>
          <span>Privacidad</span>
          <span>Cookies</span>
          <span>Accesibilidad</span>
        </nav>
      </div>
    </div>
  </footer>;
}
