import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

type Props = {
  children: ReactNode;
  variant?: "standard" | "home" | "embedded";
  headingLevel?: 1 | 2;
  description?: string;
  linkHref?: string;
  linkLabel?: string;
};

export function PageTitleHero({
  children,
  variant = "standard",
  headingLevel = 1,
  description,
  linkHref,
  linkLabel,
}: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h1";
  return (
    <header className={`page-title-hero${variant === "home" ? " page-title-hero--home" : variant === "embedded" ? " page-title-hero--embedded" : ""}`}>
      <Heading>
        <span className="page-title-hero-text">{children}</span>
      </Heading>
      {description && <p className="page-title-hero-description">{description}</p>}
      {variant === "home" && <span className="page-title-hero-rule" aria-hidden="true" />}
      {linkHref && linkLabel && <Link className="page-title-hero-link" href={linkHref}>{linkLabel}<ArrowUpRight className="page-title-hero-link-arrow" aria-hidden="true" /></Link>}
    </header>
  );
}
