import type { CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { CommerceSection } from "@/components/CommerceSection";
import { Header } from "@/components/Header";
import { HeroVoucher } from "@/components/HeroVoucher";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getLiveProps } from "@/lib/live";
import { liveScope } from "@/lib/live-scopes";
import { listBusinesses, listRaces } from "@/lib/store";
import { formatDate } from "@/lib/bonos";

export const dynamic = "force-dynamic";
export default async function Home() {
  // Las versiones se leen primero: cualquier cambio posterior a los datos se detecta como más reciente.
  const [live, races, businesses] = await Promise.all([
    getLiveProps([liveScope.public]),
    listRaces(),
    listBusinesses(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const nextRaceId = races
    .filter((race) => race.raceDate >= today)
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate))[0]?.id;
  return (
    <>
      <Header />
      <section className="hero-banner">
        <div className="hero-slider" aria-hidden="true">
          {races.map((race, index) => (
            <img
              className="hero-slide"
              key={race.id}
              src={race.cardImagePath}
              style={{ "--hero-slide-index": index } as CSSProperties}
              alt=""
            />
          ))}
        </div>
        <div className="hero-inner">
          <div className="hero-kicker-spacer" aria-hidden="true" />
          <h1 className="hero-headline">
            <span className="hero-kicker">Ganamos</span>
            <span className="hero-ribbon-wrap">
              <span className="hero-ribbon" aria-hidden="true" />
              <em>todos</em>
            </span>
            <span className="hero-subline">Deporte y comercio</span>
          </h1>
          <HeroVoucher />
        </div>
      </section>
      <main className="home-main">
        <div className="home-inner">
        <section className="race-rail" id="carreras" aria-label="Las tres pruebas deportivas">
          {races.map((race) => (
            <a
              className={`race-rail-item${race.id === nextRaceId ? " is-next" : " is-not-next"}`}
              href="#carreras"
              key={race.id}
              style={{ "--race-color": race.color } as CSSProperties}
            >
              <img className="race-rail-photo" src={race.cardImagePath} style={{ objectPosition: race.cardImagePosition }} alt="" aria-hidden="true" />
              <span className="race-rail-overlay" aria-hidden="true" />
              <span className="race-rail-meta">
                <img src={race.logoPath} alt="" />
                <span className="race-rail-copy"><strong>{race.shortName}</strong><small>{formatDate(race.raceDate)}</small></span>
                <ArrowUpRight size={16} />
              </span>
            </a>
          ))}
        </section>
        <CommerceSection businesses={businesses} />
      </div>
      </main>
      <LiveRefresh {...live} audience="public" />
    </>
  );
}
