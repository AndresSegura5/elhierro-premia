import type { Metadata } from "next";
import { ChevronDown, QrCode, Store, Ticket } from "lucide-react";
import { BonoLookupInline } from "@/components/BonoLookupInline";
import { Header } from "@/components/Header";
import { PageTitleHero } from "@/components/PageTitleHero";
import { siteContentDefaults } from "@/lib/data";
import { getSiteContent, listRaces } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "El bono | El Hierro Premia Deportistas",
  description: "Todo lo que necesitas saber sobre tu bono de 30 €: cómo se entrega, dónde canjearlo y cuánto dura.",
};

export default async function BonoPage() {
  const [races, pageContent] = await Promise.all([
    listRaces(),
    getSiteContent<typeof siteContentDefaults["coupon.page"]>("coupon.page"),
  ]);
  const content = pageContent ?? siteContentDefaults["coupon.page"];
  const stepIcons = { ticket: Ticket, store: Store, qr: QrCode };
  return (
    <>
      <Header />
      <main className="bono-main">
        <PageTitleHero>
          {content.titleLead} <em>{content.titleAccent}</em>
        </PageTitleHero>
        <section className="bono-steps-section" aria-label="Cómo utilizar el bono">
          <ol className="bono-steps-grid">
            {content.steps.map((step) => {
              const StepIcon = stepIcons[step.icon];
              return (
              <li key={step.title}>
                <span className="bono-step-icon-wrap">
                  <StepIcon size={38} strokeWidth={1.4} aria-hidden="true" />
                </span>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </li>
              );
            })}
          </ol>
        </section>
        <section className="bono-lookup-section" aria-label="Consultar un bono">
          <BonoLookupInline />
        </section>

        <section className="bono-races" aria-label="Bonos por carrera">
          <h2>{content.racesHeading}</h2>
          <div className="bono-race-grid">
            {races.map((race) => (
              <article className="bono-race-card" key={race.id}>
                <div className="bono-race-card-body">
                  <strong>{race.name}</strong>
                  <p>{race.description}</p>
                </div>
                <img className="bono-race-logo" src={race.logoPath} alt="" />
              </article>
            ))}
          </div>
        </section>

        <section className="bono-faq" aria-label="Preguntas frecuentes">
          <div className="bono-faq-inner">
            <h2>{content.faqHeading}</h2>
            <div className="bono-faq-list">
              {content.faqs.map((item) => (
                <details key={item.q}>
                  <summary>
                    <span>{item.q}</span>
                    <ChevronDown size={24} strokeWidth={2} aria-hidden="true" />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

      </main>
    </>
  );
}
