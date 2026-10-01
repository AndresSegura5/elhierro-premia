import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  switchHref?: string;
  switchLabel?: string;
};

export function AuthLayout({ eyebrow, title, description, children, switchHref, switchLabel }: Props) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-panel-content">
          <p className="auth-kicker"><span aria-hidden="true" />{eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
          {switchHref && switchLabel && (
            <Link className="auth-switch" href={switchHref}>
              {switchLabel}<ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
