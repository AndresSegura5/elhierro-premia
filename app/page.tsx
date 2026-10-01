import type { CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { CommerceSection } from "@/components/CommerceSection";
import { Header } from "@/components/Header";
import { PageTitleHero } from "@/components/PageTitleHero";
import { QRPattern } from "@/components/QRPattern";
import { siteContentDefaults } from "@/lib/data";
import { getSiteContent, listBusinesses, listRaces } from "@/lib/store";

export const dynamic = "force-dynamic";
export default async function Home() {
  const [races, businesses, hero] = await Promise.all([
    listRaces(),
    listBusinesses(),
    getSiteContent<typeof siteContentDefaults["home.hero"]>("home.hero"),
  ]);
  const content = hero ?? siteContentDefaults["home.hero"];
  return (
    <>
      <Header />
      <section className="hero-banner">
        <QRPattern className="hero-qr" />
        <div className="hero-inner">
          <div className="hero-kicker-spacer" aria-hidden="true" />
          <h1 className="hero-headline">
            <span className="hero-kicker">{content.titleTop}</span>
            <span className="hero-ribbon-wrap">
              <span className="hero-ribbon" aria-hidden="true" />
              <em>{content.titleHighlight}</em>
            </span>
            <span className="hero-subline">{content.titleBottom}</span>
          </h1>
        </div>
        <PageTitleHero
          variant="home"
          headingLevel={2}
          description={content.offerDescription}
          linkHref={content.linkUrl}
          linkLabel={content.linkText}
        >
          {content.offerLead} <em>{content.offerAmount}</em>
        </PageTitleHero>
      </section>
      <main className="home-main">
        <div className="home-inner">
        <section className="race-rail" id="carreras" aria-label="Las tres pruebas deportivas">
          {races.map((race) => (
            <a className="race-rail-item" href="#carreras" key={race.id} style={{ "--race-color": race.color } as CSSProperties}>
              <img className="race-rail-photo" src={race.cardImagePath} style={{ objectPosition: race.cardImagePosition }} alt="" aria-hidden="true" />
              <span className="race-rail-overlay" aria-hidden="true" />
              <span className="race-rail-meta">
                <img src={race.logoPath} alt="" />
                <span className="race-rail-copy"><strong>{race.shortName}</strong><small>{race.couponQuantity.toLocaleString("es-ES")} bonos previstos</small></span>
                <ArrowUpRight size={16} />
              </span>
            </a>
          ))}
        </section>
        <CommerceSection businesses={businesses} />
      </div>
      </main>
    </>
  );
}
