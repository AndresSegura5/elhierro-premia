import Link from "next/link";
import { Header } from "@/components/Header";
import { PageTitleHero } from "@/components/PageTitleHero";
import { legalContentDefaults, legalNavigation, type LegalContent, type LegalContentKey } from "@/lib/legal-content";
import { getSiteContent } from "@/lib/store";

export async function LegalPage({ contentKey }: { contentKey: LegalContentKey }) {
  const content = await getSiteContent<LegalContent>(contentKey) ?? legalContentDefaults[contentKey];
  const updatedLabel = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${content.updatedAt}T00:00:00Z`));

  return <>
    <Header />
    <main className="legal-main" id="contenido-legal">
      <PageTitleHero>{content.title}</PageTitleHero>
      <div className="legal-container">
        <nav className="legal-navigation" aria-label="Páginas legales">
          {legalNavigation.map((page) => <Link key={page.key} href={page.href} aria-current={page.key === contentKey ? "page" : undefined}>{page.label}</Link>)}
        </nav>
        <div className="legal-layout">
          <nav className="legal-index" aria-label={`Índice de ${content.title}`}>
            <p className="eyebrow">En esta página</p>
            <ol>{content.sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
          </nav>
          <article className="legal-article" aria-label={content.title}>
            <div className="legal-intro">
              <p>{content.summary}</p>
              <span>Actualizado el <time dateTime={content.updatedAt}>{updatedLabel}</time></span>
            </div>
            {content.sections.map((section) => <section className="legal-section" id={section.id} key={section.id} aria-labelledby={`heading-${section.id}`}>
              <h2 id={`heading-${section.id}`}>{section.title}</h2>
              {section.table && <div className="legal-table-scroll" role="region" aria-label="Cookies utilizadas" tabIndex={0}>
                <table className="legal-table">
                  <caption>{section.title}</caption>
                  <thead><tr>{section.table.headings.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
                  <tbody>{section.table.rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th scope="row" key={index}>{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>}
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
              {section.links && <ul className="legal-links">{section.links.map((link) => <li key={link.href}>{link.href.startsWith("/") ? <Link href={link.href}>{link.label}</Link> : <a href={link.href}>{link.label}</a>}</li>)}</ul>}
            </section>)}
          </article>
        </div>
      </div>
    </main>
  </>;
}
